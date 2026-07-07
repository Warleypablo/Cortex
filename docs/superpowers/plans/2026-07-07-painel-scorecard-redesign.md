# Painel Executivo — Redesign "Company Scorecard" (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Transformar as 7 abas do Painel Executivo (`/dashboard/painel-executivo`) de layout de cards para **scorecard em tabela** (ref: "COMPANY SCORECARD"), com dois modos de leitura — **Mês em foco** (Métrica · Atual · Δ M-1 · Meta · Status · Responsável) e **Evolução** (colunas = meses) — mantendo a auditabilidade (drill-down) e a identidade Turbo (navy).

**Architecture:** Reaproveita 100% da camada de dados existente (`hooks.ts`, `tipos.ts`, `DrillSheet`, `temporalidade.ts`). Adiciona: (1) um componente `Scorecard` genérico que renderiza seções/linhas nos 2 modos; (2) backend mínimo — endpoint que consolida METAS do BP2026+OKR por métrica/mês, e tabela editável `cortex_core.scorecard_responsaveis`; (3) helpers de status (atual vs meta) e de série (Δ M-1 / evolução). Cada aba vira um "builder" que monta `ScorecardSection[]` a partir dos hooks.

**Tech Stack:** React + TS, @tanstack/react-query, Tailwind (tokens shadcn do tema Turbo: `bg-card`, `border-card-border`, navy = `hsl(var(--primary))` light), Recharts (sparkline), Poppins. Backend: Express + Postgres (Drizzle/SQL). Testes: vitest.

## Global Constraints

- **Identidade Turbo (não hardcodar teal/gray):** usar tokens do tema — superfícies `bg-card`/`bg-background`, hairlines `border-border`/`border-card-border`, texto `text-foreground`/`text-muted-foreground`. Header de seção do scorecard = navy sólido (`bg-[hsl(var(--primary))]` no light / um navy escuro no dark) com texto branco, uppercase tracking. Coluna "Atual" realçada (fundo azul-claro `bg-accent`/token dedicado). Dark E light obrigatórios via tokens.
- **Tipografia:** Poppins; `tabular-nums` em TODA célula numérica; column headers e eyebrows uppercase `tracking-wide` menores; números-herói peso 600-700.
- **Auditabilidade preservada:** clicar numa métrica abre o `DrillSheet` existente quando há endpoint de detalhe que reconcilia (regra da v1). Sem drill onde não reconcilia.
- **Temporalidade explícita:** métricas de endpoint snapshot (LT/LTV overview, Capacity, Estoque) marcadas como "Snapshot" (sem Δ M-1 nem coluna de meses reais); métricas mensais mostram Δ e evolução.
- **Meta receita/cabeça = R$ 20.000 fixo** (override; o OKR tem 16k, o BP tem curva 11k→16k — usar 20k por decisão do produto).
- **Fetch:** `useQuery({queryKey:[url, paramsObj]})` sem queryFn. Mutations via `apiRequest`. Formatadores de `@/lib/utils`.
- **Arquivos < 500 linhas.** Commits Conventional; co-author `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Subagentes:** NÃO rodar `npm run dev`, NÃO matar porta 3000, NÃO usar `git stash`. Validar com `npm run check 2>&1 | grep <arquivos>` + `vitest`. Ao escrever SQL, ler `agents/db-specialist.md` e `DATABASE.md`; aplicar DDL em local E prod.

## Design tokens (do preview aprovado)

```
navy (section header):   light hsl(221 45% 18%)  /  dark  #16234a
actual highlight bg:     light #e7eefb            /  dark  #14213f  (usar token accent-ish)
status good:  emerald   warn: amber   bad: rose  (chart-3 / chart-4 / chart-5)  + versões -bg suaves
snapshot pill: muted
colunas: Métrica | Atual(realce) | Δ M-1 | Meta | Status | Responsável   (modo foco)
         Métrica | [meses...] | mês-atual(realce) | Meta | Tend.(sparkline)  (modo evolução)
```

## Fontes de META (endpoint novo consolida)

- **BP2026 mensal** (`server/okr2026/bp2026Targets.ts`, `getMetricByKey(key).months["YYYY-MM"]`): `mrr_active`, `sales_mrr_new_target`, `sales_mrr_monetization_target`, `revenue_one_time`, `churn_mrr_month`, `cac_total`.
- **OKR trimestral** (`server/okr2026/okrRegistry.ts`, `krs[].targets.Q#`, `direction gte|lte`): `nps`=70, `entregas_no_prazo_pct`=90, `churn_brl`, `vendas_mrr`, `vendas_pontual`, `faturamento_por_pessoa`.
- **Override:** `receita_cabeca` = 20000 fixo.
- Churn % não tem meta direta → derivar `churn_mrr_month / mrr_active` OU deixar sem meta.

## Séries p/ Δ M-1 e Evolução (de `/api/reports/mensal`, já retornadas)

- `turboMetrics.receitaChurnSeries[]` = `{month,label,mrr,pontual,churnBrl,churnPct}`
- `contratosMes.vendasSeries[]` = `{month,label,vendasMrr,vendasPontual,numContratos}` (ESTENDER o tipo `ReportsMensal`)
- `turboMetrics.crosssellHistorico[]` = `{mes,mrr,pontual}` (ESTENDER o tipo)
- `pontualData.entregasPorProdutoMes[]` (série por produto/ano)
- `/api/churn/taxa-mensal` → `rows[]` (série; hook já pede janela 12m)
- Snapshot (sem série mês-a-mês): LT/LTV overview/dist/clientes, capacity-times, estoque-pontual. Exceção: `/api/lt-ltv-churn/evolucao-produto-tabela` é temporal (usar no modo Evolução da aba LT/LTV).

---

## Task 1: Backend — endpoint de metas consolidadas

**Files:** Create `server/routes/scorecard.ts`; Modify `server/routes.ts` (registrar); Test `server/routes/scorecard.metas.test.ts`.

**Interfaces:**
- Produces: `GET /api/scorecard/metas?mes=YYYY-MM` → `{ metas: Record<string, { valor: number; unit: "BRL"|"PCT"|"COUNT"; direction: "up"|"down"; origem: "bp"|"okr"|"override"; label: string }> }`. Chaves = metric_key canônicas usadas pelas abas (ver mapa). Função pura `montarMetasScorecard(mes)` exportada e testada.

- [ ] **Step 1: Test do consolidador** — `montarMetasScorecard("2026-06")` retorna `mrr_active` (do BP months), `churn_brl` mensalizado do OKR (targetQ ÷ 3), `nps`=70, `entregas_no_prazo_pct`=90, `receita_cabeca`=20000 (override), com `direction` correto (`down` p/ churn). Assert nos valores e direction.
- [ ] **Step 2:** rodar `npx vitest run server/routes/scorecard.metas.test.ts` → FAIL.
- [ ] **Step 3: Implementar** `montarMetasScorecard(mes)`: lê `bp2026Targets` (getMetricByKey por mês), `okrRegistry.krs` (targets do trimestre do mês, mensalizar `quarter_sum`÷3, `quarter_avg` mantém, mapear `gte→up`/`lte→down`), aplica override `receita_cabeca=20000`. Registrar handler que chama a função. Registrar rota em `server/routes.ts`.
- [ ] **Step 4:** vitest → PASS; `npm run check`.
- [ ] **Step 5: Commit** `feat(scorecard): endpoint /api/scorecard/metas consolidando BP2026 + OKR`.

## Task 2: Backend — tabela + endpoints de responsáveis (editável)

**Files:** Modify `server/db.ts` (DDL `initializeScorecardResponsaveisTable`), `server/index.ts` (chamar no bootstrap), `server/routes/scorecard.ts` (GET/PUT), `server/routes.ts` (registrar já feito na Task 1).

**Interfaces:**
- Produces: `GET /api/scorecard/responsaveis` → `{ itens: {metrica_key,responsavel}[] }`. `PUT /api/scorecard/responsaveis` body `{ itens:[{metrica_key,responsavel}] }` → upsert `ON CONFLICT (metrica_key)`.
- Tabela `cortex_core.scorecard_responsaveis (metrica_key TEXT PRIMARY KEY, responsavel TEXT, atualizado_em TIMESTAMP DEFAULT NOW())`.

- [ ] Step 1: DDL `CREATE TABLE IF NOT EXISTS` em `server/db.ts` (espelhar `initializeGestaoReceitaMetasTable` :2255), chamar no bootstrap. Aplicar em local E prod.
- [ ] Step 2: GET + PUT em `scorecard.ts` (upsert idêntico a `gestaoReceita.ts:514`, pega `req.user.email` p/ auditoria opcional).
- [ ] Step 3: `npm run check`. Commit `feat(scorecard): tabela e endpoints de responsáveis editáveis`.

## Task 3: Frontend — tipos, hooks, helpers de scorecard

**Files:** Create `client/src/pages/painel-executivo/scorecard/tipos.ts`, `scorecard/logica.ts`, `scorecard/logica.test.ts`; Modify `painel-executivo/hooks.ts` (novos hooks), `painel-executivo/tipos.ts` (estender ReportsMensal).

**Interfaces:**
- Produces:
  - `ScorecardRow = { key:string; metrica:string; sub?:string; atual:number|null; formato:"brl"|"pct"|"int"|"meses"; serie?:{label:string;valor:number|null}[]; metaKey?:string; temporalidade:"mes"|"snapshot"; drill?:()=>void; responsavelAuto?:string }`
  - `ScorecardSection = { id:string; titulo:string; subtitulo?:string; linhas:ScorecardRow[] }`
  - `useScorecardMetas(mes)`, `useScorecardResponsaveis()` + `useSalvarResponsaveis()` (mutation).
  - `logica.ts`: `calcStatus(atual, meta, direction): "good"|"warn"|"bad"|null` (regra: `up`→good se atual≥meta, warn se ≥90%, senão bad; `down`→good se atual≤meta, warn se ≤110%, senão bad; sem meta→null); `deltaM1(serie): {pct:number, dir:"up"|"down"|"flat"} | null` (compara últimos 2 pontos); `formatValor(v, formato)`.
  - Estender `ReportsMensal` com `contratosMes.vendasSeries` e `turboMetrics.crosssellHistorico`.

- [ ] Step 1: Test de `logica.ts` — `calcStatus(100,100,"up")="good"`, `calcStatus(85,100,"up")="bad"`, `calcStatus(95,100,"up")="warn"`, `calcStatus(200,96,"down")="bad"` (churn acima da meta), `calcStatus(80,96,"down")="good"`; `deltaM1([{valor:100},{valor:110}])={pct:10,dir:"up"}`. Rodar → FAIL.
- [ ] Step 2: Implementar `logica.ts`, `tipos.ts`, hooks (metas/responsáveis via `useQuery`/`apiRequest`), estender ReportsMensal. Rodar test → PASS. `npm run check`.
- [ ] Step 3: Commit `feat(scorecard): tipos, hooks de metas/responsáveis e lógica de status/delta`.

## Task 4: Frontend — componente `Scorecard` (2 modos)

**Files:** Create `client/src/pages/painel-executivo/scorecard/Scorecard.tsx`, `scorecard/CelulaResponsavel.tsx`.

**Interfaces:**
- Consumes: `ScorecardSection[]`, `useScorecardMetas`, `logica.ts`, `DrillSheet` pattern.
- Produces: `Scorecard({ secoes, mes, modo, metas, responsaveis, onEditResponsavel })` — renderiza:
  - **modo "foco"**: tabela colunas Métrica | Atual(realce) | Δ M-1 | Meta | Status(pill) | Responsável(editável). Header de seção navy. Linha clicável se `row.drill`. `tabular-nums`.
  - **modo "evolução"**: colunas = meses de `row.serie` (último realçado) + Meta + sparkline (Recharts `<LineChart>` mini ou barras unicode). Linhas snapshot (sem série) mostram badge "Snapshot" e só o valor atual.
  - `CelulaResponsavel`: mostra `responsavelAuto` OU o valor editável (input inline on click → mutation). Dropdown de responsáveis reais de `GET /api/capacity-metas/responsaveis`.
- Todo estilo via tokens Turbo (Global Constraints). Loading/erro herdados do padrão das seções.

- [ ] Step 1: Implementar `Scorecard.tsx` (os 2 modos) + `CelulaResponsavel.tsx`. `npm run check`.
- [ ] Step 2: Commit `feat(scorecard): componente Scorecard com modos foco/evolução e responsável editável`.

## Task 5: Shell redesenhado (header + tabs + toggle de modo)

**Files:** Modify `client/src/pages/PainelExecutivo.tsx`.

- Header executivo: eyebrow "TURBO PARTNERS · PAINEL EXECUTIVO", título "Company Scorecard", seletor de mês (pill), toggle de tema já existe no app.
- Barra: Tabs (as 7) + toggle **Mês em foco / Evolução** (segmented, à direita) cujo estado (`modo`) é passado às seções.
- Aplicar tokens navy; borda inferior navy no header.
- [ ] Step 1: Implementar shell; passar `mes` e `modo` às seções. `npm run check`. Commit `feat(scorecard): shell executivo com toggle de modo e header navy`.

## Tasks 6–12: Reescrever cada aba como builder de Scorecard

Cada task: cria `Secao<Nome>.tsx` que monta `ScorecardSection[]` a partir dos hooks existentes e renderiza `<Scorecard secoes={...} modo={modo} .../>`. Substitui o conteúdo de cards da v1. Mapeamento métrica→dado→série→metaKey abaixo. Cada aba: `npm run check` + commit próprio.

- [ ] **Task 6 — Receita:** seções MRR e Pontual. Linhas com `metaKey`: MRR ativo(`mrr_active`,serie receitaChurnSeries.mrr), Nova receita MRR(`sales_mrr_new_target`,vendasSeries.vendasMrr), Churn(`churn_mrr_month`,receitaChurnSeries.churnBrl,dir down), Pausado/Reativado(sem meta), Cross-sell MRR(`sales_mrr_monetization_target`,crosssellHistorico.mrr), Pontual nova(`revenue_one_time`,vendasSeries.vendasPontual), Entregue(entregasPorProdutoMes.total), Em aberto(snapshot). Drill: Nova receita MRR → `venda_mrr` (reconcilia, v1).
- [ ] **Task 7 — Churn:** seções Recorrente Geral (Churn R$ `churn_brl` dir down, Churn %, Nº), Por produto (churn/produto-motivo), Por operador (churn-por-responsavel), Por squad (churn_por_squad), Pontual (churn-pontorrente). Série de churn R$/% via receitaChurnSeries + taxa-mensal.
- [ ] **Task 8 — Entregas:** Total entregue(mês), Por produto(entregasPorProdutoMes série), Por operador(topEntregas), Aberto×Entregue, Lead time(tempoMedioEntrega), Entregas no prazo %(`entregas_no_prazo_pct`=90 do OKR se disponível).
- [ ] **Task 9 — Capacity:** Receita por cabeça(`receita_cabeca`=20000 fixo, ceo-dashboard) + por squad/operador (capacity-times, snapshot).
- [ ] **Task 10 — LT/LTV:** overview (snapshot) + por produto (evolucao-produto-tabela = série no modo evolução) + dist/maiores. Sem meta (marcar snapshot).
- [ ] **Task 11 — Performance:** Maiores clientes (lt-ltv clientes, snapshot), Top operadores/squads (reports/mensal, mês), Maiores investimentos/crescimentos = EmBreve.
- [ ] **Task 12 — Visão Geral + polish:** resumo (1 linha por aba: métrica-chave, atual, meta, status) como um scorecard-síntese + NPS(`nps`=70 do OKR, valor pode vir null → "—") e Margem como EmBreve. Polish final: responsividade (sticky primeira coluna), dark/light em todos os tokens, `npm run check` + `vitest` + `lint`.

## Validação

`npm run check` (0 erros no painel), `vitest run` (logica + metas), e validação visual em `/dashboard/painel-executivo` (dark/light, os 2 modos, edição de responsável, drill). Metas devem bater com BP2026/OKR nas telas oficiais.

## Self-review (contra o pedido do usuário)

Formato tabela ✅ (Scorecard); todas as métricas mandadas ✅ (mapeamento por aba); dividido por abas ✅; mês em foco + evolução ✅ (2 modos); auditável ✅ (drill mantido); identidade Turbo ✅ (tokens navy). Meta 20k/cabeça = override consciente. Δ/evolução limitados a fontes com série (snapshot marcado, não finge).
