# Painel Executivo Mensal — Design

**Data:** 2026-07-07
**Autor:** Warleypablo + Claude
**Status:** Aprovado para implementação (MVP)

---

## 1. Objetivo

Criar **uma única view** (página no Cortex) que consolide, para um mês de referência,
todas as métricas executivas hoje espalhadas em ~15 telas diferentes: Receita (MRR +
Pontual), Financeiro, Churn (recorrente e pontual), NPS, LT/LTV, Performance e Entregas
Pontuais.

Requisitos inegociáveis do solicitante:
- **Auditável** — clicar em qualquer número abre a lista de registros que o compõem.
- **Intuitivo e bonito** — leitura executiva, dark/light mode, padrão visual Cortex.

## 2. Princípio norteador — reaproveitar, não recalcular

O levantamento do código mostrou que **quase todas** as métricas pedidas já têm endpoint
oficial no backend. Portanto o painel **consome os endpoints existentes** (mesma query que
alimenta as telas oficiais). Consequência direta: **os números batem por construção** com
as telas-fonte — é isso que torna o painel auditável sem reimplementar lógica de negócio.

## 3. Decisões de design (fechadas no brainstorming)

| # | Decisão | Escolha |
|---|---------|---------|
| 1 | Formato | Nova página React no Cortex, autenticada |
| 2 | Rota | `/painel-executivo` |
| 3 | Auditável | Drill-down **inline** (drawer lateral) + link "abrir tela completa" |
| 4 | Mês | Seletor mês/ano, default = último mês fechado |
| 5 | Navegação | **Abas de topo**: Visão Geral + 6 abas |
| 6 | Arquitetura de dados | Consumir endpoints existentes em paralelo (React Query). **Zero backend novo no MVP** |
| 7 | Margem de Contribuição | Fase 2 |

## 4. Escopo

### MVP (esta entrega)
Blocos que já possuem endpoint pronto:
- **Receita** (MRR + Pontual e seus movimentos)
- **Churn** (recorrente + pontual)
- **LT/LTV**
- **Capacity / Receita por cabeça**
- **Entregas Pontuais**
- **Performance** (maiores clientes R$, maiores investimentos)

### Fase 2 (fora deste MVP — aparecem como cards "em breve" desde já)
- **NPS de clientes** — hoje é *hardcoded* em `SlideNPS.tsx`; exige criar fonte
  (`cortex_core.nps_clientes`) + endpoint.
- **Margem de Contribuição** por squad/produto — Receita − Custos de operação; as peças
  existem (receita do capacity − custo de folha `rh_pessoal`/CEO dashboard), mas não há
  cálculo nomeado unindo-as.
- **Maiores crescimentos do mês** (delta MoM por cliente) — precisa derivar de séries
  temporais existentes.

## 5. Arquitetura

### 5.1 Frontend
- **Página:** `client/src/pages/PainelExecutivo.tsx`, registrada com `lazyWithRetry` em
  `client/src/App.tsx`, rota `/painel-executivo`, dentro do bloco autenticado.
- **Estado de mês:** um único estado `mesRef` (`YYYY-MM`) no topo da página, default
  calculado como o último mês fechado (hoje 07/07/2026 → `2026-06`). Propagado como
  parâmetro a todos os hooks de dados.
- **Hooks de dados:** um hook React Query por seção (ex: `usePainelReceita(mes)`,
  `usePainelChurn(mes)`, …), cada um chamando o endpoint oficial correspondente. Chamadas
  disparam em paralelo; cada seção tem `isLoading` / `isError` independentes.
- **Isolamento de falha:** cada aba/card renderiza `skeleton` no loading e um card de erro
  com botão "tentar novamente" no erro. Um endpoint lento ou quebrado **não** derruba o
  restante do painel.

### 5.2 Backend
- **Nenhum endpoint novo no MVP.** Apenas consumo dos endpoints já registrados.
- Fase 2 introduzirá um único endpoint de composição para as lacunas (margem, maiores
  crescimentos) e a fonte de NPS. Ao escrever SQL nessa fase, seguir `agents/db-specialist.md`
  e `DATABASE.md` (regra do projeto).

## 6. Navegação e layout

**Header fixo:** título "Painel Executivo Mensal" + **seletor de mês** (default último mês
fechado). Dark/light mode nativo (classes `dark:` Tailwind). Visualizações com Recharts.

**Abas de topo:**

| Aba | Papel |
|-----|-------|
| **Visão Geral** | One-pager executivo: 1 KPI macro por bloco (Receita total MRR+Pontual, Churn % rec/pontual, LTV médio, Receita/cabeça vs meta 20k, Entregas total, [NPS — fase 2]). É a aba default. |
| **Receita** | Detalhe de MRR e Pontual |
| **Churn** | Recorrente + Pontual |
| **LT/LTV** | Lifetime / Lifetime Value |
| **Capacity** | Receita por cabeça |
| **Entregas** | Entregas pontuais |
| **Performance** | Rankings TOP 10 |

## 7. Conteúdo por aba (MVP) e fontes de dados

### 7.1 Receita
Dois blocos: **MRR** e **Pontual**. Cada bloco expõe: Receita, Churn, Pausado/Reativado,
Nova receita, Upsell/Downsell, Cross-sell. O bloco Pontual acrescenta **Entregue**.
- Fontes: `GET /api/gestao/receita`, `GET /api/dashboard/evolucao-mensal`,
  `GET /api/analytics/nrr`, `GET /api/comercial/crosssell`, apoio de BP2026
  (`/api/bp2026/receitas`).

### 7.2 Churn
Sub-abas **Recorrente** e **Pontual**, cada uma com: Geral, Percentual, Por produto,
Motivos de churn, Por operador, Por squad.
- Fontes: `GET /api/churn/taxa-mensal`, `/api/churn/taxa-por-produto`,
  `/api/churn/produto-motivo`, `/api/churn/squad-motivo`, `/api/churn-por-responsavel`,
  `/api/churn-por-servico`, `GET /api/churn-pontorrente` (pontual),
  `GET /api/analytics/churn-detalhamento`.

### 7.3 LT/LTV
LT e LTV por produto + média/mediana.
- Fontes: `GET /api/lt-ltv-churn/overview`, `/api/lt-ltv-churn/evolucao-produto-tabela`,
  `/api/lt-ltv-churn/dist-clientes`.

### 7.4 Capacity / Receita por cabeça
Receita por cabeça geral, por squad e por operador, com **meta 20k/cabeça** destacada
(barra vs meta).
- Fontes: `GET /api/capacity-times`, `GET /api/ceo-dashboard` (métrica `receita_cabeca`).

### 7.5 Entregas Pontuais
Total, Por produto, Por operador, Aberto × Entregue, Lead time por produto.
- Fontes: `GET /api/estoque-pontual/overview`, `/api/estoque-pontual/por-produto`,
  `/api/estoque-pontual/por-squad`, `/api/estoque-pontual/aging` (lead time),
  `GET /api/creators-pontual/operadores`.

### 7.6 Performance
TOP 10 Maiores clientes (R$) + TOP 10 Maiores investimentos (ads).
- Fontes: `GET /api/saude-base-ativa`, `GET /api/gestao/receita` (rankings), domínio Growth
  (`/api/growth/*`) para investimentos.
- (TOP 10 Maiores crescimentos MoM = Fase 2.)

## 8. Drill-down (auditabilidade)

Componente genérico **`<DrillSheet>`** (drawer lateral, `@/components/ui/sheet`):
- Recebe `{ endpoint, params, colunas, titulo }` e renderiza uma tabela paginável dos
  registros (clientes/contratos/parcelas) que compõem o número clicado.
- Reusa endpoints de detalhe já existentes: `/api/gestao/receita/detalhe`,
  `/api/churn/produto-mes-detalhe`, `/api/lt-ltv-churn/clientes`,
  `/api/estoque-pontual/itens`, `/api/capacity-times/contratos`.
- Todo número "auditável" no painel é um botão que abre o `DrillSheet` com o contexto certo.
- Cada aba também tem um link "abrir tela completa" para a tela-fonte correspondente,
  já filtrada pelo mês.

## 9. Tratamento de erro e loading
- Por seção (não global): skeleton no loading, card de erro com retry no erro.
- Endpoints que retornam vazio para o mês → estado "sem dados neste mês", não erro.
- `DrillSheet` tem seus próprios loading/erro internos.

## 10. Principal risco técnico — filtro de mês

Nem todos os endpoints aceitam o filtro de mês do mesmo jeito: alguns usam `?mes=YYYY-MM`,
outros assumem "mês corrente", outros usam `data_inicio`/`data_fim`. **Antes de conectar cada
seção**, a implementação deve executar a Etapa 3 (INVESTIGAR) do workflow do projeto: chamar
cada endpoint com dados reais (curl/browser autenticado) e confirmar que junho/2026 retorna
junho de fato. Endpoints sem filtro de mês adequado serão anotados e, se necessário, ganham
um parâmetro (mudança mínima e localizada) ou entram como ressalva visível no card.

## 11. Testes (mínimos)
- Utilitários puros: formatadores de moeda/percentual, cálculo do "último mês fechado",
  montagem dos KPIs macro da Visão Geral a partir dos payloads.
- Smoke da página: renderiza abas, troca de mês dispara refetch, drill-down abre o Sheet.
- Não recriar testes de lógica de negócio já cobertos pelas telas-fonte.

## 12. Critérios de sucesso
1. Página `/painel-executivo` acessível e autenticada, com seletor de mês.
2. As 7 abas (Visão Geral + 6) renderizam com dados reais de junho/2026.
3. Cada número dos blocos MVP reconcilia com sua tela-fonte oficial (auditável).
4. Drill-down inline funciona em pelo menos um número de cada aba.
5. Dark e light mode corretos.
6. NPS, Margem e Maiores crescimentos presentes como cards "em breve" (fase 2).

## 13. Fora de escopo (explícito)
- Recalcular qualquer métrica de negócio (reusamos endpoints).
- Exportação PDF/slides (já existe `/reports/mensal`).
- Comparação M-1 por métrica (pode entrar em iteração futura).
