# Evolução Temporal — Handoff

Documento de passagem de contexto entre sessões de Claude Code. Lê isso antes de continuar a feature.

- **Branch:** `feature/evolucao-temporal` (pushed to `origin`)
- **Último commit:** `06a04185 feat(growth-evolucao): export XLSX da matriz visível (admin-only)`
- **Data:** 2026-04-21
- **Plano-mãe:** `/Users/ichino/.claude/plans/preciso-da-sua-ajuda-delegated-summit.md`

---

## 1. O que é a feature

Uma nova aba em `/growth/evolucao-temporal` que mostra uma **matriz pivot**: métricas como linhas, meses do ano como colunas. Ao clicar no header de um mês, as ~4-5 semanas ISO daquele mês aparecem inline como colunas extras (drill-down). Serve pra comparar performance mês-a-mês ao longo do ano, com possibilidade de aprofundar em semanas quando interessar.

A feature precisa ter **paridade 100% de métricas** com a aba `/growth/orcado-realizado` (O×R) — foi requisito explícito do usuário, pra ele poder comparar os dois lados.

---

## 2. Estado atual (o que está pronto)

✅ Rota registrada em `client/src/App.tsx` com `lazyWithRetry`
✅ Permissão `growth.evolucao_temporal` adicionada em `shared/nav-config.ts`
✅ Entrada no menu lateral sob o grupo Growth, ícone `TrendingUp`
✅ Página renderiza 12 meses × ~55 métricas (Marketing + MQL + Não-MQL + Total)
✅ Filtros: Ano (dropdown 2023-2027), Produto/Funil (MultiSelect), Plataforma (MultiSelect)
✅ Drill-down semanal: clique no header do mês expande/colapsa semanas ISO
✅ Botões "Expandir todos" / "Colapsar todos"
✅ Orçado rateado por dias úteis (semana que atravessa meses soma as duas porções)
✅ Export XLSX da matriz visível (meses expandidos viram colunas de semana no arquivo)
✅ Gating do export: `role === 'admin'` OU email em whitelist (`ferramentas@`, `vinicius.ichino@`)

## 3. O que falta

- [ ] **Aprofundado Meta/Google** (v1 escopada, mas ainda não implementada)
  - Toggle de seção "Consolidado | Aprofundado"
  - Quando aprofundado + Meta Ads: mostrar métricas detalhadas por canal (investimento, CPM, CTR, CPL, leads, MQLs)
  - Backend pode precisar de endpoint específico ou reusar `/meta-ads` e `/google-ads` de `server/routes/growth.ts`
- [ ] **Teste end-to-end em dark + light mode** (rodar visualmente em ambos, ver se não quebra nada)
- [ ] **Abrir PR para main** (se a v1 for considerada completa sem o aprofundado)
- [ ] **Limpeza do endpoint órfão** `server/routes/growthTimeseries.ts` + `/api/growth/orcado-realizado/timeseries` — criado no início como v0 backend-orquestrado, mas NÃO é mais usado pelo frontend (fizemos pivô). Pode ser removido ou deixado; ainda está registrado em `server/routes.ts`.

---

## 4. Arquitetura — decisão crítica (LEIA)

### Pivô importante: backend-orchestrated → frontend-orchestrated

Na sessão inicial, criei um endpoint consolidado `GET /api/growth/orcado-realizado/timeseries` que agregava tudo no backend. Esse endpoint vive em `server/routes/growthTimeseries.ts` e retornava 13 métricas.

**Problema:** o usuário exigiu paridade 100% com O×R. Replicar todo o SQL das rotas `/mql`, `/nao-mql`, `/ads` e `/budgets/year` dentro de um novo endpoint seria muito código e risco de divergência.

**Solução adotada (Option A):** o frontend faz **fan-out** disparando `useQueries` em paralelo contra os endpoints **já existentes**:
- `GET /api/growth/orcado-realizado/mql?startDate=...&endDate=...`
- `GET /api/growth/orcado-realizado/nao-mql?startDate=...&endDate=...`
- `GET /api/growth/orcado-realizado/ads?startDate=...&endDate=...`
- `GET /api/growth/orcado-realizado/budgets/year?year=...&funil=...` (1 única fetch do orçado anual)

**Custo:** 12 meses × 3 endpoints = **36 requisições paralelas** no load inicial. Mais +3 por mês expandido (semanas). React Query cacheia tudo com `staleTime: 5min`.

**Ganho:** paridade garantida, zero risco de regressão no O×R, zero refactor de SQL.

### Consequência: onde as métricas são calculadas

Todas as métricas derivadas (% RA, RR→V%, CAC, Ticket Médio, etc.) são calculadas **no frontend** via closures declarativas no array `METRIC_DEFS` (client/src/pages/GrowthEvolucaoTemporal.tsx:126).

Cada `MetricDef` tem duas funções:
- `realizado: (d: { mql?, naoMql?, ads? }) => number | null` — derivada a partir do payload dos 3 endpoints
- `orcado: (b: BudgetMonth) => number | null` — lê da estrutura `budgetsYear[monthKey]`

Pra semanas, `orcado` é passado pro helper `prorateBudgetToWeek` que rateia mensal → semanal por dias úteis.

---

## 5. Inventário de arquivos

### Criados
| Arquivo | Propósito |
|---|---|
| `client/src/pages/GrowthEvolucaoTemporal.tsx` | Página inteira (~898 linhas). Single-file por enquanto; ver seção 9 se quiser refatorar |
| `server/routes/growthTimeseries.ts` | **ÓRFÃO** — criado no v0 backend-orquestrado, não é mais usado pelo frontend |

### Modificados
| Arquivo | Mudança |
|---|---|
| `client/src/App.tsx` | Import lazy + rota protegida `/growth/evolucao-temporal` |
| `shared/nav-config.ts` | `PERMISSION_KEYS.GROWTH.EVOLUCAO_TEMPORAL`, `ROUTE_TO_PERMISSION`, `NAV_CONFIG` |
| `server/routes.ts` | Registra `registerGrowthTimeseriesRoutes(app, db)` (endpoint órfão, ainda registrado) |

### Não tocados (mas referenciados)
- `server/routes/growth.ts` — contém as rotas `/mql`, `/nao-mql`, `/ads`, `/budgets/year` que o frontend consome
- `client/src/pages/GrowthOrcadoRealizado.tsx` — fonte de verdade pras fórmulas de métricas e pro padrão de export

---

## 6. Fluxo de dados (resumido)

```
Usuário abre /growth/evolucao-temporal
   │
   ├─ buildMonthBuckets(year) → 12 MonthBuckets {key, label, startDate, endDate}
   │
   ├─ useQuery /budgets/year?year=2026&funil=todos
   │     → budgetsYear = { "2026-01": { marketing: {...}, mql: {...}, ... }, ... }
   │
   └─ useQueries (36 queries em paralelo)
         → monthlyQueries[i*3+0].data = MqlData do mês i
         → monthlyQueries[i*3+1].data = NaoMqlData do mês i
         → monthlyQueries[i*3+2].data = AdsData do mês i

Quando usuário clica no header de Junho:
   expandedMonths.add("2026-06")
   │
   ├─ buildWeekBucketsForMonth(2026, 5) → [W22, W23, W24, W25, W26] (dedup cross-month)
   │
   └─ useQueries adicional (5 semanas × 3 endpoints = 15 queries)
         → weeklyQueries[i*3+0..2].data indexados por w.key ("2026-W23" etc.)

byBucket = { "2026-06": {mql, naoMql, ads}, "2026-W23": {...}, ... }

columns = [
  { kind: "month", bucket: Jan },
  { kind: "month", bucket: Fev },
  ...
  { kind: "month", bucket: Jun },
  { kind: "week", week: W22 },
  { kind: "week", week: W23 },
  ...
]

Render: para cada (métrica, coluna):
  realizado = metric.realizado(byBucket[col.key])
  orcado = col.kind === "month"
    ? metric.orcado(budgetsYear[col.key])
    : prorateBudgetToWeek(budgetsYear, col.week, metric.orcado)
```

---

## 7. Convenções importantes (gotchas)

### ISO weeks (Monday-Sunday)
- Usamos `getISOWeek()` (ISO-8601 puro)
- A semana de um mês = **qualquer semana ISO que tenha pelo menos 1 dia no mês** (regra "intersect")
- Consequência: semanas de transição (W01/W52/W53) podem aparecer em 2 meses quando ambos são expandidos. Dedup por `w.key` é feito em `expandedWeeks`.

### Rateio de orçado (business days)
- `prorateBudgetToWeek(budgetsYear, week, extractFn)` — divide o orçado mensal por dias úteis (Mon-Fri).
- Semana que atravessa 2 meses: soma as porções de cada mês proporcionalmente aos dias úteis daquele mês na semana.
- Fórmula: `orcadoSemana = Σ monthBudget[m] × (weekBizDaysInMonth[m] / totalBizDaysInMonth[m])`

### `funilForBudget` (workaround)
- O endpoint `/budgets/year` só aceita 1 funil específico ou "todos".
- Se o usuário seleciona múltiplos produtos, caímos em `"todos"` — isso não é o ideal e pode mascarar o orçado real. Backlog: expandir endpoint pra aceitar múltiplos funis.

### `BudgetMonth` type
- Declarado como `Record<string, any>` em `GrowthEvolucaoTemporal.tsx:222`.
- Estrutura real: `{ marketing: {...}, mql: {...}, "nao-mql": {...}, total: {...} }`.
- Dentro de cada segmento há os campos de orçado (investimento, leads, etc.) retornados por `/budgets/year`. Ver `server/routes/growth.ts:1788-1815` pra contrato exato.

### TypeScript hoisting
- `type BudgetMonth` é usado em `prorateBudgetToWeek` (linha 154) antes de ser declarado (linha 222). Funciona porque types são hoisted no TS module scope. Se reordenar, manter tudo no mesmo módulo.

---

## 8. Permissões & gating

### Permissão de acesso à página
- Chave: `growth.evolucao_temporal` (em `shared/nav-config.ts`)
- `ProtectedRoute` checa via `hasAccess(path)` do `AuthContext`
- Usuários `role === 'admin'` entram sempre; outros precisam ter a chave em `allowedRoutes` no banco

### Gate do export XLSX
- Em `GrowthEvolucaoTemporal.tsx`:
  ```ts
  const canExport = user?.role === "admin"
    || (!!user?.email && EXPORT_ALLOWED_EMAILS.has(user.email));
  ```
- `EXPORT_ALLOWED_EMAILS` = `{ferramentas@turbopartners.com.br, vinicius.ichino@turbopartners.com.br}`
- Motivo da restrição: o usuário pediu pra limitar pra evitar problemas enquanto a feature amadurece.

---

## 9. Estrutura do arquivo principal

`client/src/pages/GrowthEvolucaoTemporal.tsx` (~898 linhas). Organização:

```
1-12    Imports (React Query, shadcn/ui, lucide icons, AuthContext)
13-24   Types: MetricFormat, SectionKey, SECTION_META, SECTION_ORDER
25-60   Interfaces: MqlData, NaoMqlData, AdsData
61-70   MonthBucket, WeekBucket interfaces
71-85   buildMonthBuckets(year)
87-104  formatValue, percColor
106-112 getISOWeek (ISO-8601)
114-124 isoWeekStart, formatDayMonth
126-150 buildWeekBucketsForMonth
152-160 businessDaysInMonth
162-195 prorateBudgetToWeek (CRITICAL helper — usa BudgetMonth type)
197-210 MetricDef interface, BudgetMonth type, safeDiv
212-375 METRIC_DEFS array (~55 métricas declarativas) — FONTE DE VERDADE
377...  Component: GrowthEvolucaoTemporal()
  - useAuth, canExport gate
  - yearOptions, buckets useMemo
  - funis dropdown query
  - budgetsYear query
  - monthlyQueries (36 parallel)
  - expandedWeeks, weeklyQueries (dynamic)
  - byBucket indexer
  - columns dynamic array
  - metricsBySection
  - renderCell (handles month vs week differently)
  - expandAll, collapseAll
  - buildExportRows, fileBase, exportXLSX
  - JSX: Card + toolbar + Table
```

Se o arquivo ficar grande demais (>1000 linhas), candidatos para extrair:
- Helpers puros (getISOWeek, prorateBudgetToWeek, buildWeekBucketsForMonth) → `client/src/lib/timeseriesHelpers.ts`
- METRIC_DEFS → `client/src/lib/evolucaoTemporalMetrics.ts`
- Export logic → `client/src/lib/exportHelpers.ts` (reutilizável com O×R)

---

## 10. Como rodar / testar

```bash
# Dev server já costuma estar rodando em background (tsx watch + Vite HMR)
# Se não:
npm run dev
# → http://localhost:3000

# Logar como ferramentas@turbopartners.com.br (admin)
# Abrir: http://localhost:3000/growth/evolucao-temporal
```

Checklist manual:
- [ ] 12 colunas de mês aparecem com métricas preenchidas
- [ ] Clicar em "Jun/26" expande ~4-5 colunas de semana com fundo diferente
- [ ] "Expandir todos" → todos os meses abrem; "Colapsar todos" fecha
- [ ] Valores de um mês batem com o que aparece na mesma seleção em `/growth/orcado-realizado`
- [ ] Botão "Exportar XLSX" aparece (admin) e gera arquivo com colunas = mêses + semanas expandidas
- [ ] Filtros Produto/Plataforma filtram dados corretamente
- [ ] Dark mode + light mode (CLAUDE.md exige)

---

## 11. Commits desta feature

```
06a04185  feat(growth-evolucao): export XLSX da matriz visível (admin-only)
1461faca  feat(growth-evolucao): página Evolução Temporal com drill-down semanal
49deabf8  feat(growth-evolucao): endpoint /timeseries para matriz métricas × meses  (← órfão, endpoint v0)
```

---

## 12. Próximos passos sugeridos

Ordem recomendada:

1. **Limpar endpoint órfão** (opcional, baixa prioridade) — deletar `server/routes/growthTimeseries.ts` + remover o `registerGrowthTimeseriesRoutes` em `server/routes.ts`. Só se decidirmos não usar pra nada.
2. **Testar dark/light mode** — abrir a página em ambos, verificar contraste das células de semana (`bg-muted/30`), dos headers clicáveis e das células com %.
3. **Abrir PR para `main`** — feature está utilizável. Título sugerido: `feat(growth): nova aba Evolução Temporal com drill-down semanal`.
4. **Aprofundado Meta/Google (v2)** — depois do merge, nova branch. Toggle "Consolidado | Aprofundado" na toolbar, reusar `/meta-ads` e `/google-ads` com mesmo padrão de fan-out.

Não-prioritários / backlog:
- Orçado semanal manual (tabela `growth_budgets_weekly`) em vez de rateio automático
- Comparação de anos (2025 vs 2026 lado a lado)
- Export direto pro Google Sheets
- Suporte a múltiplos funis no `/budgets/year`

---

## 13. Memória relacionada

- `/Users/ichino/.claude/projects/-Users-ichino-Documents-Turbo-Cortex/memory/project_evolucao_temporal.md`
- `/Users/ichino/.claude/projects/-Users-ichino-Documents-Turbo-Cortex/memory/MEMORY.md`
- `/Users/ichino/.claude/plans/preciso-da-sua-ajuda-delegated-summit.md` — plano original aprovado (contexto maior)

## 14. Branch paralela pausada

A branch `feature/agente-gestor-meta-ads` existe localmente e no remote com trabalho commitado, mas **pausada**. Não tocar nos arquivos dela (AGENTE_GESTOR_PERFORMANCE.md, server/routes/metaActions.ts, server/services/metaAdsWrite.ts, server/routes/criativosAgent.ts, etc.) enquanto estiver nessa feature. O usuário volta pra ela depois de fechar Evolução Temporal.
