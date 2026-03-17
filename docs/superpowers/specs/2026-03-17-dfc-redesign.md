# DFC Redesign — Design Spec

> **Scope:** Visual migration of FluxoCaixa.tsx and DashboardDFC.tsx to the dashboard design system.
> **Type:** Visual-only — no functional/data changes. Aria-label additions are in-scope as accessibility improvements.
> **Design System Skill:** `agents/dashboard-design-SKILL.md`
> **Domain:** Financeiro

---

## Context

Two pages handle cash flow visualization:

| Page | File | Lines | Purpose | Migration Status |
|------|------|-------|---------|-----------------|
| Fluxo de Caixa | `client/src/pages/FluxoCaixa.tsx` | ~1,005 | Daily/monthly/weekly cash flow with charts and tables | **Partially migrated** — already uses HeroMetric + StatsCardV2 |
| Dashboard DFC | `client/src/pages/DashboardDFC.tsx` | ~1,304 | DFC analysis with AI assistant and hierarchical breakdown | **Not migrated** — full migration needed |

Both pages remain separate after migration. No merging.

---

## Page 1: FluxoCaixa.tsx (Partial — Remaining Work)

FluxoCaixa already uses `HeroMetric` and `StatsCardV2` (imported at lines 47-48). The main chart already uses solid fills (`#10b981`, `#ef4444`). No pie chart exists. No gradient backgrounds in cards.

### What Already Works

- 2 HeroMetric: "Saldo Atual" and "Saldo Projetado (Fim do Mês/Ano)" — **keep as-is**
- 4 StatsCardV2: Entradas, Saídas, Entradas Vencidas, Saídas Vencidas — **keep as-is**
- Main ComposedChart with solid bar fills — **keep as-is**
- Skeleton loading states — **keep as-is**
- View modes (Diário/Mensal/Semanal) — **keep as-is**

### Remaining Violations to Fix

| # | Violation | Location | Fix |
|---|-----------|----------|-----|
| 1 | Classification filter cards use decorative icons (`UserCheck`, `AlertTriangle`, `UserX`) and non-standard colored backgrounds (`bg-green-500/10`, `bg-amber-500/10`, `bg-red-500/10`) | Lines 432-497 | Replace with a clean toggle group using semantic border-left styling. Keep the count data and interactive behavior. Remove icons — the color coding is sufficient. Use `bg-white dark:bg-zinc-900` base with `border-l-3` for color. Active state: `ring-2 ring-{color}-500/30` (already similar). |
| 2 | Decorative icons imported but used in detail dialog | `ArrowUpCircle`, `ArrowDownCircle` in imports (line 31) | Audit usage — if only decorative, remove. If indicating direction in table rows, keep. |
| 3 | No `aria-label` on `ResponsiveContainer` | Main chart section | Add `aria-label="Gráfico de fluxo de caixa diário"` (or mensal/semanal per mode) |
| 4 | Table headers in detail dialog may lack `scope="col"` | Detail dialog tables | Add `scope="col"` to all `<th>` elements |

### Semanal View

The Semanal view renders `RelatorioSemanalFinanceiro` (a separate component, line 365). This component is **out of scope** for this migration — it will be addressed when we migrate that component independently.

### Classification Filter Cards — Target Design

Current (lines 440-455):
```tsx
// BEFORE: colored bg, decorative icon
<div className="p-4 rounded-lg border bg-green-500/10 border-green-500/20">
  <UserCheck className="w-4 h-4" /> Em dia
  <p className="text-lg font-bold">42 clientes</p>
</div>
```

Target:
```tsx
// AFTER: clean card, semantic border, no icon
<div className={cn(
  "p-4 rounded-lg border cursor-pointer transition-colors",
  "bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800",
  "border-l-[3px] border-l-emerald-500 dark:border-l-emerald-400",
  isActive && "ring-2 ring-emerald-500/30"
)}>
  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Em dia</p>
  <p className="text-lg font-medium text-foreground">42 clientes</p>
</div>
```

---

## Page 2: DashboardDFC.tsx (Full Migration)

### Design System Violations to Fix

| # | Violation | Location | Fix |
|---|-----------|----------|-----|
| 1 | 6 KPI cards with `bg-gradient-to-br` backgrounds | Lines 567-740 | Replace with 3 HeroMetric + 3 StatsCardV2 |
| 2 | Decorative icons in KPI cards (`ArrowUpCircle`, `ArrowDownCircle`, `Wallet`, `Percent`, `Calendar`, `Receipt`) | Each card header | Remove all decorative icons from KPI section |
| 3 | `linearGradient` in AreaChart fills | Lines 758-766 | Solid fill with low opacity (`fill="#10b981" fillOpacity={0.1}`) |
| 4 | `backdrop-blur-sm` in sticky table header | Line 953 | Replace with opaque `bg-muted` (remove `bg-muted/80 backdrop-blur-sm`) |
| 5 | Gradient button in AI Chat send | Line 548 (`bg-gradient-to-r from-violet-600 to-purple-600`) | Solid `bg-violet-600 hover:bg-violet-700` |
| 6 | Gradient in AI Chat dialog header | Line 446 (`bg-gradient-to-r from-violet-50 to-purple-50`) | Solid `bg-background border-b` |
| 7 | Gradient icon container in AI Chat header | Line 448 (`bg-gradient-to-br from-violet-500/20 to-purple-500/20`) | Solid `bg-violet-500/10` |
| 8 | Gradient page header icon | Line 376 (`bg-gradient-to-br from-emerald-500 to-teal-600`) | Remove decorative icon entirely — page title suffices |
| 9 | Gradient date picker wrapper | Line 396 (`bg-gradient-to-r from-slate-100 to-slate-50`) | Replace with `bg-muted rounded-xl px-3 py-2 border border-border` |
| 10 | Gradient root node cards in "Cards" view | Lines 863-866 (`bg-gradient-to-r from-emerald-50/rose-50`) | Replace with `bg-white dark:bg-zinc-900 border-l-[3px]` using semantic color (emerald for RECEITAS, red for DESPESAS) |
| 11 | Gradient RESULTADO row in DFC table | Line 1167 (`bg-gradient-to-r from-blue-50 to-indigo-50`) | Replace with solid `bg-blue-50 dark:bg-blue-950` |
| 12 | Gradient MARGEM row in DFC table | Line 1235 (`bg-gradient-to-r from-violet-50 to-purple-50`) | Replace with solid `bg-violet-50 dark:bg-violet-950` |
| 13 | Decorative icons in chart card headers (`LineChart`, `BarChart3`) | Lines 750, 791 | Remove decorative icons from card titles |
| 14 | Decorative icon in DFC table header (`Activity`) | Line 834 | Remove decorative icon |
| 15 | Decorative icons in RESULTADO/MARGEM rows (`Target`, `Percent`) | Lines 1171, 1239 | Remove decorative icons |
| 16 | Chart height 220 | Lines 756, 797 | Increase to `height={300}` per design system |
| 17 | `CartesianGrid strokeDasharray="3 3"` | Lines 768, 799 | Replace with `vertical={false} stroke={isDark ? "#27272a" : "#f0f0f0"}` |
| 18 | `YAxis` visible with tickFormatter | Lines 770, 801-802 | `<YAxis hide />` (values go in tooltip) |
| 19 | No `aria-label` on any `ResponsiveContainer` | Lines 756, 797 | Add descriptive aria-labels |
| 20 | Colored text per category in KPI cards (e.g., `text-emerald-700`) | Throughout KPI section | Use `text-foreground` for values, semantic color only on border-left |

### Hero Metrics (3, no card wrapper)

Reuse existing data from current KPIs. Per Financeiro domain rules:

| Metric | Current Card | Source Data | Format |
|--------|-------------|-------------|--------|
| Receita Líquida | "Entradas" card (line 569) | `kpis.totalReceitas` | `R$ 142.350,00` (full, `formatCurrencyNoDecimals`) |
| Resultado do Período | "Saldo" card (line 618) | `kpis.saldoLiquido` | `R$ 42.130,00` (full) |
| Total Despesas | "Saídas" card (line 594) | `kpis.totalDespesas` | `R$ 100.220,00` (full) |

All three values are distinct (`totalReceitas`, `saldoLiquido`, `totalDespesas`). No redundancy.

Layout: `flex items-start gap-12` (desktop), `grid grid-cols-1 gap-4` (mobile).

### Supporting Cards (StatsCardV2, grid 3 cols)

| Card | Source | Variant |
|------|--------|---------|
| Margem Média | `kpis.margemMedia` | Dynamic: `success` (>=20%), `warning` (0-20%), `error` (<0%) |
| Período | `kpis.totalMeses` meses | `default` |
| Categorias Ativas | `kpis.totalCategorias` | `default` |

### Filters (2 visible — well within max 4)

1. DateRange picker (default: start of current year to now)
2. View mode: Tabela | Cards (toggle)

No changes needed to filter layout.

### Charts (2, grid 2-col)

#### Chart 1: Evolução Mensal (AreaChart → keep as AreaChart)

- `ResponsiveContainer height={300}` with `aria-label="Gráfico de evolução mensal de receitas e despesas"`
- Remove `linearGradient` defs → use `fill="#10b981" fillOpacity={0.1}` and `fill="#f43f5e" fillOpacity={0.1}`
- `CartesianGrid vertical={false} stroke={isDark ? "#27272a" : "#f0f0f0"}`
- `<YAxis hide />`
- Keep 2 series: receitas + despesas (within max 2 limit for area charts)
- Remove decorative `LineChart` icon from card header

#### Chart 2: Resultado Mensal (ComposedChart)

- `ResponsiveContainer height={300}` with `aria-label="Gráfico de resultado mensal"`
- `CartesianGrid vertical={false} stroke={isDark ? "#27272a" : "#f0f0f0"}`
- `<YAxis yAxisId="left" hide />` + `<YAxis yAxisId="right" orientation="right" hide />` (keep dual axis for correct scale — saldo is monetary, margem is percentage — but hide both visually)
- Keep bar (saldo) + line (margem) — 2 series OK for ComposedChart
- Remove decorative `BarChart3` icon from card header
- Keep ReferenceLine at y=0 (functional, shows break-even)

### Hierarchical DFC Table

The main DFC table (lines 930+) is the core of this page — a hierarchical collapsible grid. Per Financeiro domain rules: "DFC = tabelas hierárquicas colapsíveis" — this is already correct.

Changes:
- **Line 953:** Replace `bg-muted/80 backdrop-blur-sm` with `bg-muted` (opaque, no blur)
- Add `scope="col"` to header cells if missing
- Ensure alternating row styling: `even:bg-gray-50/50 dark:even:bg-zinc-800/30`

### AI Assistant (Dialog)

Keep fully functional. Visual-only changes:
- **Line 548:** Replace gradient button `bg-gradient-to-r from-violet-600 to-purple-600` with solid `bg-violet-600 hover:bg-violet-700`
- Keep all chat logic, suggested questions, message rendering as-is

### States

- **Loading:** Already has Skeleton patterns in KPI cards. Ensure chart sections also show `<Skeleton className="h-[300px] rounded-lg" />` during load.
- **Error:** Add inline error per section with `AlertTriangle` if not present.
- **Empty:** `"Sem dados para o período selecionado."` centered in chart/table sections.

### Import Cleanup

After migration, remove these imports from DashboardDFC.tsx:
- `ArrowUpCircle`, `ArrowDownCircle` — decorative in KPI cards and "Cards" view root nodes. Cards view root nodes will use border-left color instead.
- `Wallet`, `Calendar` — decorative only in KPI cards
- `CircleDollarSign` — verify usage; if only decorative, remove
- `LineChart` — decorative icon in chart card header (line 750)
- `Activity` — decorative icon in DFC table section header (line 834)

**Keep these** (used in functional/table contexts):
- `Receipt` — used in DFC table header (line 943), functional label
- `Target` — used in RESULTADO row label (line 1171). Remove the icon per violation #15, then remove import.
- `Percent` — used in MARGEM row label (line 1239). Remove the icon per violation #15, then remove import.
- `BarChart3` — decorative in chart header (line 791) AND page header icon (line 377). Remove both per violations #8, #13, then remove import.
- `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger` — imported (line 9) but **not used** in the page rendering. Remove unused import.

Add these imports:
- `import { HeroMetric } from "@/components/HeroMetric";`
- `import { StatsCardV2 } from "@/components/StatsCardV2";`
- `import { useTheme } from "@/components/ThemeProvider";` (for `isDark` in CartesianGrid)

---

## Components Required

| Component | Status | Notes |
|-----------|--------|-------|
| `HeroMetric` | Exists at `client/src/components/HeroMetric.tsx` | Already used by FluxoCaixa |
| `StatsCardV2` | Exists at `client/src/components/StatsCardV2.tsx` | Already used by FluxoCaixa |

No new components need to be created.

---

## Accessibility Additions (Both Pages)

- `aria-label` on every `<ResponsiveContainer>` — these are new attributes being added
- `<th scope="col">` on all table headers
- Trends use symbol (▲/▼) + color (already handled by HeroMetric/StatsCardV2)

---

## Out of Scope

- No functional changes to data fetching or API endpoints
- No changes to hero metric labels in FluxoCaixa (already migrated)
- No "Orçado vs Realizado" (requires budget data)
- No merging of the two pages
- No changes to AI assistant logic
- No changes to RelatorioSemanalFinanceiro (separate component)
- No refactoring of backend services
