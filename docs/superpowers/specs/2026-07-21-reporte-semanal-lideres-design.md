# Reporte Semanal dos Líderes + unificação da régua de expansão

**Data:** 2026-07-21
**Rota:** `/reports/semanal` (substitui a tela de cards existente)
**Também altera:** `server/services/resumoLideres.ts` — a mensagem diária dos líderes

---

## 1. Problema

A mensagem diária dos líderes entrega as métricas do **mês corrente acumulado (MTD)** contra o
fechamento do mês anterior. Ela responde "como o mês está andando", mas não responde **"como foi a
semana"** — que é a pergunta da rotina semanal de gestão.

A tela `/reports/semanal` que existe hoje mostra três cards KPI (MRR ativo, churn, entregas
pontuais) com réguas próprias, produzindo números que não conversam com o que os líderes leem no
WhatsApp.

Ao desenhar o recorte semanal, apareceu um problema mais profundo: **a mensagem diária usa duas
réguas incompatíveis de classificação de venda no mesmo texto.** Venda nova sai de
`getVendasNovasBreakdown` (CNPJ sem contrato anterior) e cross-sell sai de um **valor digitado à
mão por mês** em `metric_actual_overrides_monthly`, porque a régua automática por trás
(`source='PARTNER'`) está morta — 1 deal em toda a base desde que `crm_deal` virou espelho do
Synapse.

Duas consequências medidas em produção (2026):

1. **Dupla contagem.** Dos 106 deals marcados `channel='Expansão de Conta'`, **40 (R$ 121.129 de
   R$ 235.408 de MRR, 51%)** também passam pela régua de CNPJ, por não terem CNPJ preenchido. A
   mensagem os conta como aquisição nova *e* o override os conta como cross-sell.
2. **Venda nova superestimada.** Em junho, a régua de CNPJ dá R$ 296.282 de MRR novo contra
   R$ 242.791 pela marcação do CRM — **R$ 53k a mais**, quase todo ele cross-sell sem CNPJ entrando
   como aquisição.

Além disso, o cross-sell mensal digitado à mão **não é semanalizável**: não existe "o cross-sell da
semana de 13/jul" dentro de um valor mensal, e ratear por 4 seria inventar número.

## 2. Objetivo

1. Criar a tela semanal em tabela, com as métricas da mensagem recortadas por semana
   (segunda→domingo), 12 semanas de histórico, variação vs. semana anterior e drill auditável.
2. **Unificar a régua de classificação de venda** entre a tela e a mensagem, adotando a marcação
   `channel` do CRM nas duas. Os números passam a bater por construção, e o cross-sell volta a ser
   automático.

**Fora de escopo:** enviar mensagem semanal por WhatsApp; migrar as outras telas que seguem em
`source='PARTNER'` (`relatorioMensalSlides`, `reportsTrimestral`, `scorecard.detalhe.helpers`,
`metricsAdapter`, drawer de `/detalhamento-churn`).

## 3. Régua unificada

**Cross-sell é `TRIM(crm_deal.channel) = 'Expansão de Conta'`. Venda nova é todo o resto dos deals
ganhos.** As duas são mutuamente exclusivas e somam o total ganho no período, seja ele um mês ou
uma semana.

`channel = 'Reativação'` (3 deals ganhos em 2026) conta como **venda nova**: win-back de cliente
perdido não é expansão de conta ativa (decisão de 2026-07-21). Não há guard de CNPJ — a régua
confia na marcação do comercial; exigir CNPJ descartaria 32 dos 106 deals e 51% do MRR de expansão.

### 3.1 Impacto na mensagem diária

A mensagem muda de número nas linhas de venda nova e cross-sell. Medido em produção:

| Mês | MRR novo (CNPJ, hoje) | MRR novo (`channel`) | Cross total (hoje) | Cross total (`channel`) |
|---|---|---|---|---|
| abr | R$ 217.951 | R$ 205.951 | — | R$ 123.194* |
| mai | R$ 264.817 | R$ 268.817 | — | R$ 61.894 |
| jun | R$ 296.282 | R$ 242.791 | — | R$ 140.396 |
| jul | R$ 179.339 | R$ 180.339 | R$ 28.797 (manual) | R$ 24.600 |

`*` meses anteriores a julho não tinham override cadastrado; o cross-sell saía **zero** na mensagem.

Julho, o único mês com override manual, fica a −15% do valor digitado — a marcação do CRM já
reproduz sozinha o que vinha sendo informado à mão.

### 3.2 O override manual é aposentado

O mecanismo de override de cross-sell (`metric_actual_overrides_monthly`, chaves
`resumo_lideres_cross_r` / `resumo_lideres_cross_p`) **é removido**: código em `resumoLideres.ts` e
as linhas de jul/2026.

Ele existia como muleta para a régua morta. Com `channel` funcionando, manter o mecanismo só
preservaria a possibilidade de a mensagem divergir da tela em silêncio — a mensagem, por decisão
anterior, não sinaliza que um valor é manual. Efeito colateral bom: ninguém precisa digitar o valor
todo mês.

Some junto a flag `crossIndisponivel`, que hoje depende do override para decidir se o cross está
mesmo indisponível; passa a ser simplesmente "a query falhou".

### 3.3 Métricas por semana

Tudo em `America/Sao_Paulo`. Semana = **segunda→domingo** (`date_trunc('week')` do Postgres já
começa na segunda).

| Métrica | Régua semanal | Fonte |
|---|---|---|
| MRR Adicionado | Deals ganhos na semana, `channel <> 'Expansão de Conta'`, soma de `valor_recorrente` | `"Bitrix".crm_deal` |
| Pontual Vendido | Idem, soma de `valor_pontual` | `crm_deal` |
| Triagem/Onboarding, Ativo, Em Cancelamento | **Foto** do último snapshot ≤ domingo | `"Clickup".cup_data_hist` |
| MRR Ativo | Triagem + Onboarding + Ativo | derivado |
| MRR Operando | MRR Ativo + Em Cancelamento | derivado |
| Entrega Pontual | `valorp` que passou a `entregue` entre o snapshot de abertura e o de fechamento | `cup_data_hist` |
| Churn MRR Total | `SUM(valor_r)` com `data_solicitacao_encerramento` na semana | `"Clickup".cup_churn` |
| Churn MRR Ajustado | Idem, excluindo `motivo_cancelamento IN ('Erro na Venda','Não começou','Inadimplente 1º Mês')` | `cup_churn` |
| Churn Pontual Total / Ajustado | Idem, somando `valorp` via `JOIN cup_contratos ON id_subtask = task_id AND valorp > 0` | `cup_churn` + `cup_contratos` |
| Cross Sell MRR / Pontual | Deals ganhos na semana com `TRIM(channel) = 'Expansão de Conta'` | `crm_deal` |
| Net Churn Ajustado | `churnAjustado − crossMrr` | derivado |
| Net Churn Bruto | `churnTotal − crossMrr` | derivado |
| **Base % de MRR** | MRR (triagem+onboarding+ativo) no **último snapshot anterior à segunda** | `cup_data_hist` |
| **Base % pontual** | `valorp` em aberto no mesmo snapshot de abertura (exclui `entregue`, `cancelado/inativo`, `não usar`) | `cup_data_hist` |

### 3.4 Semana parcial

A semana corrente é sempre incompleta. É marcada com `*`, cabeçalho esmaecido e legenda "semana em
curso — dados parciais", e **fica de fora do cálculo da coluna Δ**. Sem isso, a semana em curso
parece uma catástrofe na segunda e um milagre no domingo.

### 3.5 Notas de dado verificadas em produção

- `cup_data_hist` cobre **17/nov/2025 → hoje**, com snapshot em quase todos os dias (ocasionalmente
  6 de 7 numa semana). Por isso as queries usam `MAX(data_snapshot) <= <data>`, nunca o dia exato.
- `cup_data_hist` **não tem linha duplicada** por `id_subtask` dentro de um snapshot (2.929 linhas =
  2.929 subtasks em 21/07/2026). O `DISTINCT ON (id_subtask)` da rota antiga é dispensável.
- 12 semanas cabem folgadamente na janela de snapshots disponível.

## 4. Arquitetura

### 4.1 Módulo compartilhado da régua

```
shared/crm-channel.ts        # CHANNEL_EXPANSAO — a constante, um lugar só
server/crm/expansao.ts       # vendasPorChannel(db, inicio, fim) e dealsPorChannel(...) p/ drill
```

`vendasPorChannel` devolve `{ novoMrr, novoPontual, crossMrr, crossPontual, erro? }` para um
intervalo de datas — serve tanto o mês corrente (mensagem) quanto a semana (tela). É o que garante
que as duas superfícies não possam divergir: **existe uma query só**.

`ceoDashboard.movimentoReceita.ts` passa a importar `CHANNEL_EXPANSAO` de `shared/crm-channel.ts`,
resolvendo o TODO que ele próprio deixou escrito. Suas queries não mudam — já estão na régua certa
e funcionando; mexer nelas agora só adicionaria risco.

`metricsAdapter.getVendasNovasBreakdown` / `getVendasMrrBreakdown` **não são alterados**: outras
telas dependem deles. O `resumoLideres` deixa de chamá-los.

### 4.2 Server — tela semanal

```
server/reportsSemanal/
  semanas.ts     # PURO — janelas seg→dom, N semanas, flag `parcial`
  queries.ts     # queries de série, parametrizadas por (inicio, fim)
  derivar.ts     # PURO — derivarSemana(): MRR Ativo/Operando, %, Net Churn
server/routes/reportsSemanal.ts   # GET /api/reports/semanal + /api/reports/semanal/detalhe
```

A separação puro/I-O espelha a de `resumoLideres.ts`, onde `derivarMetricas` foi extraída
justamente para tornar as fórmulas testáveis sem mockar banco.

**Endpoints:**

- `GET /api/reports/semanal?semanas=12` → `{ semanas: SemanaMetricas[] }`
- `GET /api/reports/semanal/detalhe?metrica=<chave>&inicio=YYYY-MM-DD&fim=YYYY-MM-DD`

Autenticação pelo `app.use("/api", isAuthenticated)` existente. Permissão de rota
`PERMISSION_KEYS.REPORTS.MENSAL`, inalterada — ninguém perde acesso, não há migration.

O `reportsSemanal.helpers.ts` atual (`calcularJanelas`, `montarKpi`, com testes) é aproveitado no
que couber; o resto da rota antiga sai junto com os cards.

### 4.3 Server — mensagem diária

Em `server/services/resumoLideres.ts`:

- `calcularMetricasResumo` passa a chamar `vendasPorChannel(db, primeiroDiaDoMes, hoje)` no lugar de
  `getVendasNovasBreakdown` + `getVendasMrrBreakdown`.
- `getCrossOverrideMesAtual` e o parâmetro `crossOverride` de `derivarMetricas` são removidos.
- `crossIndisponivel` passa a refletir só o erro da query.
- O texto muda em dois pontos, porque a régua mudou:
  - a nota "Considera vendas para clientes sem contrato anterior. Deals sem CNPJ preenchido entram
    nesta linha…" vira "Considera deals ganhos não marcados como Expansão de Conta no CRM.";
  - o disclaimer correspondente acompanha.

Os 40 testes existentes de `resumoLideres.test.ts` são atualizados; os que cobrem override saem.

### 4.4 Client

```
client/src/pages/RelatorioSemanal.tsx          # reescrito
client/src/pages/relatorio-semanal/
  TabelaSemanal.tsx     # tabela, seções, coluna Δ
  DrawerDetalhe.tsx     # drill lateral
  types.ts
  useRelatorioSemanal.ts
```

**Tabela:** 12 colunas de semana + coluna Δ. Primeira coluna (nome da métrica) fixa; scroll
horizontal **no contêiner da tabela**, nunca na página. Linhas agrupadas nas 5 seções da mensagem:
Novas Vendas · Carteira · Churn · Cross Sell · Net Churn.

**Coluna Δ:** última semana **fechada** vs. a anterior, com cor semântica por direção esperada —
MRR subindo é verde, churn subindo é vermelho.

**Dark/light** em todas as superfícies, com as variantes `dark:` do padrão do projeto.

### 4.5 Drill

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

Somente funções puras, sem mockar banco:

- `semanas.ts` — virada de mês, virada de ano, detecção de semana parcial, contagem de janelas.
- `derivar.ts` — Net Churn (ajustado e bruto), percentuais com base zero, MRR Ativo/Operando, e a
  garantia de que venda nova e cross-sell não se sobrepõem.
- `resumoLideres.test.ts` — atualizado para a régua nova; testes de override removidos.

**Reconciliação manual antes do merge:** conferir que o mesmo intervalo agregado de duas formas bate
— soma das N semanas que o cobrem vs. um único agregado sobre `[primeira segunda, último domingo]`
desse intervalo — para MRR Adicionado, Cross Sell e Churn. (A soma de semanas contra o valor
*mensal* da mensagem não serve de checagem: semanas atravessam virada de mês, então as duas nunca
cobrem o mesmo intervalo.) Divergência aqui significa que uma das duas superfícies não está usando
`vendasPorChannel`.

## 6. Riscos

| Risco | Mitigação |
|---|---|
| A mensagem diária muda de número da noite para o dia e assusta os líderes | Avisar antes do primeiro envio pós-merge; a variação é pequena (jul: −15% no cross, +0,6% no MRR novo) |
| Comercial para de marcar `channel` e o cross-sell despenca sem aviso | `crossIndisponivel` cobre falha de query, não falta de marcação — monitorar a linha nas primeiras semanas |
| Query do drawer diverge da query da série | Queries gêmeas com comentário cruzado; reconciliação manual em 2 semanas |
| Semana com snapshot faltando distorce a foto | `MAX(data_snapshot) <= data` em vez de dia exato |
| Semana corrente lida como fechada | Marcação `*`, tom esmaecido, exclusão do Δ |
| Telas fora de escopo seguem em `source='PARTNER'` e divergem desta | Documentado; a lista está em `reference_crosssell_channel_expansao` |
