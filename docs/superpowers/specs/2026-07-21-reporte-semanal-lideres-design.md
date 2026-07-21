# Reporte Semanal — tela de métricas dos líderes em recorte semanal

**Data:** 2026-07-21
**Rota:** `/reports/semanal` (substitui a tela de cards existente)
**Origem:** mensagem diária do Resumo dos Líderes (`server/services/resumoLideres.ts`, modelo v3)

---

## 1. Problema

A mensagem diária dos líderes entrega as métricas do **mês corrente acumulado (MTD)** contra o
fechamento do mês anterior. Ela responde "como o mês está andando", mas não responde **"como foi a
semana"** — e é essa a pergunta da rotina semanal de gestão.

A tela `/reports/semanal` que existe hoje mostra três cards KPI (MRR ativo, churn, entregas
pontuais) com variação vs. semana anterior. É um subconjunto pobre das métricas da mensagem e usa
réguas próprias, o que produz números que não conversam com o que os líderes leem no WhatsApp.

## 2. Objetivo

Uma tela que mostre, **em tabela**, as métricas da mensagem dos líderes recortadas por semana
(segunda→domingo), com histórico de 12 semanas, variação vs. semana anterior e drill auditável
célula a célula.

**Não faz parte deste escopo:** enviar mensagem semanal por WhatsApp; alterar a mensagem diária;
migrar as outras 6 telas que seguem na régua morta de cross-sell.

## 3. Réguas das métricas

Tudo em `America/Sao_Paulo`. Semana = **segunda→domingo** (`date_trunc('week')` do Postgres já
começa na segunda).

| Métrica | Régua semanal | Fonte |
|---|---|---|
| MRR Adicionado | Deals ganhos com `data_fechamento` na semana, `channel <> 'Expansão de Conta'` — soma de `valor_recorrente` | `"Bitrix".crm_deal` |
| Pontual Vendido | Idem, soma de `valor_pontual` | `"Bitrix".crm_deal` |
| Triagem/Onboarding, Ativo, Em Cancelamento | **Foto** do último snapshot ≤ domingo da semana | `"Clickup".cup_data_hist` |
| MRR Ativo | Triagem + Onboarding + Ativo (mesma definição do v3) | derivado |
| MRR Operando | MRR Ativo + Em Cancelamento | derivado |
| Entrega Pontual | `valorp` dos contratos que passaram a `entregue` entre o snapshot de abertura e o de fechamento da semana | `cup_data_hist` |
| Churn MRR Total | `SUM(valor_r)` com `data_solicitacao_encerramento` na semana | `"Clickup".cup_churn` |
| Churn MRR Ajustado | Idem, excluindo `motivo_cancelamento IN ('Erro na Venda','Não começou','Inadimplente 1º Mês')` | `cup_churn` |
| Churn Pontual Total / Ajustado | Idem, somando `valorp` do contrato via `JOIN cup_contratos ON id_subtask = task_id AND valorp > 0` | `cup_churn` + `cup_contratos` |
| Cross Sell MRR / Pontual | Deals ganhos na semana com `TRIM(channel) = 'Expansão de Conta'` | `"Bitrix".crm_deal` |
| Net Churn Ajustado | `churnAjustado − crossR` | derivado |
| Net Churn Bruto | `churnTotal − crossR` | derivado |
| **Base dos percentuais (MRR)** | MRR (triagem+onboarding+ativo) no **último snapshot anterior à segunda-feira** da semana | `cup_data_hist` |
| **Base dos percentuais (Pontual)** | `valorp` em aberto no mesmo snapshot de abertura (exclui `entregue`, `cancelado/inativo`, `não usar`) | `cup_data_hist` |

### 3.1 Decisão: classificação por `channel`, não por CNPJ

**Venda nova e cross-sell são classificados pela marcação `channel` do CRM.** Cross-sell é
`channel = 'Expansão de Conta'`; venda nova é todo o resto dos deals ganhos.

Motivo: a mensagem diária usa duas réguas incompatíveis no mesmo texto — venda nova por CNPJ sem
contrato anterior (`getVendasNovasBreakdown`) e cross-sell por override manual mensal. Medido em
produção sobre 2026: **dos 106 deals marcados como Expansão de Conta, 40 (R$ 121.129 de R$ 235.408
de MRR, 51%) também seriam contados como "venda nova"** pela régua de CNPJ, porque não têm CNPJ
preenchido. Numa tabela com as duas linhas visíveis lado a lado, metade do cross-sell apareceria
duas vezes.

Com `channel`, as duas linhas são mutuamente exclusivas e somam o total ganho na semana.

**Consequência aceita:** os números desta tela **não batem** com os da mensagem diária nas linhas de
venda nova e cross-sell. A tela declara isso no rodapé.

`channel = 'Reativação'` (3 deals ganhos em 2026) conta como **venda nova**, não como expansão —
win-back de cliente perdido não é expansão de conta ativa (decisão de 2026-07-21).

O override manual mensal de cross-sell (`metric_actual_overrides_monthly`, chaves
`resumo_lideres_cross_r` / `resumo_lideres_cross_p`) **não é usado** nesta tela: é um valor mensal,
sem como ser rateado por semana. A mensagem diária segue usando-o.

### 3.2 Semana parcial

A semana corrente é sempre incompleta. Ela é marcada com `*`, cabeçalho esmaecido e legenda
"semana em curso — dados parciais", e **fica de fora do cálculo da coluna Δ**. Sem isso, a semana
em curso parece uma catástrofe na segunda-feira e um milagre no domingo.

### 3.3 Notas de dado verificadas em produção

- `cup_data_hist` cobre **17/nov/2025 → hoje**, com snapshot em praticamente todos os dias
  (ocasionalmente 6 de 7 dias numa semana). Por isso as queries usam
  `MAX(data_snapshot) <= <data>` em vez de exigir o dia exato.
- `cup_data_hist` **não tem linha duplicada** por `id_subtask` dentro de um mesmo snapshot
  (2.929 linhas = 2.929 subtasks no snapshot de 21/07/2026). O `DISTINCT ON (id_subtask)` usado
  defensivamente na rota antiga é dispensável.
- 12 semanas de histórico cabem folgadamente na janela de snapshots disponível.

## 4. Arquitetura

### 4.1 Server

```
server/reportsSemanal/
  semanas.ts     # PURO — janelas seg→dom, N semanas, flag `parcial`
  queries.ts     # queries de série, todas parametrizadas por (inicio, fim)
  derivar.ts     # PURO — derivarSemana(): MRR Ativo/Operando, %, Net Churn
server/routes/reportsSemanal.ts   # GET /api/reports/semanal + /api/reports/semanal/detalhe
shared/crm-channel.ts             # CHANNEL_EXPANSAO
```

A separação espelha a de `resumoLideres.ts`, onde `derivarMetricas` (pura) foi extraída de
`calcularMetricasResumo` (I/O) justamente para tornar as fórmulas testáveis sem mockar banco.

`shared/crm-channel.ts` resolve o TODO já escrito em `ceoDashboard.movimentoReceita.ts` ("ao
unificar, mover isto para um módulo compartilhado"). O CEO Dashboard e a tela nova passam a ler de
lá. As outras 6 telas que seguem em `source='PARTNER'` **não são tocadas** — é outro trabalho, com
outro risco.

O `reportsSemanal.helpers.ts` existente (`calcularJanelas`, `montarKpi`, com testes) é aproveitado
no que couber; o restante da rota antiga sai junto com os cards.

**Endpoints:**

- `GET /api/reports/semanal?semanas=12` → `{ semanas: SemanaMetricas[] }`
- `GET /api/reports/semanal/detalhe?metrica=<chave>&inicio=YYYY-MM-DD&fim=YYYY-MM-DD` → linhas do drill

Autenticação: pelo `app.use("/api", isAuthenticated)` já existente. Permissão de rota:
`PERMISSION_KEYS.REPORTS.MENSAL`, inalterada — ninguém perde acesso, não há migration.

### 4.2 Client

```
client/src/pages/RelatorioSemanal.tsx          # reescrito
client/src/pages/relatorio-semanal/
  TabelaSemanal.tsx     # tabela, seções, coluna Δ
  DrawerDetalhe.tsx     # drill lateral
  types.ts              # tipos compartilhados com o server
  useRelatorioSemanal.ts
```

**Tabela:** 12 colunas de semana + coluna Δ. Primeira coluna (nome da métrica) fixa; scroll
horizontal **no contêiner da tabela**, nunca na página. Linhas agrupadas nas 5 seções da mensagem:
Novas Vendas · Carteira · Churn · Cross Sell · Net Churn.

**Coluna Δ:** última semana **fechada** vs. a anterior. Cor semântica por direção esperada — MRR
subindo é verde, churn subindo é vermelho.

**Dark/light** em todas as superfícies, com as variantes `dark:` do padrão do projeto.

### 4.3 Drill

| Célula | Drawer |
|---|---|
| MRR Adicionado / Pontual Vendido | deals ganhos: cliente, closer, canal, valor |
| Cross Sell MRR / Pontual | deals de Expansão: cliente, closer, valor |
| Churn MRR / Pontual | contratos: cliente, valor, motivo, abonado |
| Entrega Pontual | contratos que viraram `entregue` |
| Carteira / Base / Net Churn | não abre — foto ou derivação; fórmula em tooltip |

**Regra de construção:** a query do drawer é **gêmea** da query da série — mesmo filtro, mesmo
período — com comentário em ambas amarrando uma à outra. Foi assim que o cross-sell do CEO
Dashboard evitou o drawer que não soma a célula.

## 5. Testes

Somente nas funções puras, sem mockar banco:

- `semanas.ts` — virada de mês, virada de ano, detecção da semana parcial, contagem de janelas.
- `derivar.ts` — Net Churn (ajustado e bruto), percentuais com base zero, MRR Ativo/Operando, e a
  garantia de que venda nova e cross-sell não se sobrepõem.

## 6. Riscos

| Risco | Mitigação |
|---|---|
| Números divergem da mensagem diária e geram desconfiança | Rodapé declara a diferença de régua explicitamente |
| Query do drawer diverge da query da série | Queries gêmeas com comentário cruzado; teste manual de reconciliação em 2 semanas |
| Semana com snapshot faltando distorce a foto | `MAX(data_snapshot) <= data` em vez de dia exato |
| Semana corrente lida como fechada | Marcação `*`, tom esmaecido, exclusão do Δ |
