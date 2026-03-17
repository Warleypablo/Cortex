# Visão Geral (Gestão) Redesign — Design Spec

> **Scope:** Visual migration of VisaoGeral.tsx to the dashboard design system.
> **Type:** Visual-only — no functional/data changes.
> **Design System Skill:** `agents/dashboard-design-SKILL.md`
> **Domain:** Operações / Gestão

---

## Context

| Page | File | Lines | Purpose | Migration Status |
|------|------|-------|---------|-----------------|
| Visão Geral | `client/src/pages/VisaoGeral.tsx` | 519 | MRR overview, team rankings, squad distribution | **Not migrated** |

This is the **main overview page** within Gestão. Per Operações domain rules, heroes are MRR Total and Churn Rate (%). NRR is defined in the design system but does not exist in the current data — omitted since this is visual-only (no new data sources).

---

## Design System Violations to Fix

| # | Violation | Location | Fix |
|---|-----------|----------|-----|
| 1 | 6 KPI cards without hero/supporting hierarchy — all use plain `Card` | Lines 134-289 | Replace with 2 HeroMetric + 5 StatsCardV2 |
| 2 | Decorative icons on KPI cards (`DollarSign`, `TrendingUp` x2, `TrendingDown`, `PauseCircle`, `CheckCircle`) | Lines 150, 175, 200, 225, 250, 280 | Remove decorative icons. Keep `Info` tooltip icons (functional). |
| 3 | Colored text on KPI values (`text-green-600`, `text-blue-600`, `text-purple-600`, `text-red-600`, `text-orange-600`) | Lines 178, 203, 228, 253, 283 | Use `text-foreground` for all values. Semantic color via StatsCardV2 `variant` border-left only. |
| 4 | `CartesianGrid strokeDasharray="3 3"` with `className="stroke-muted"` on both charts | Lines 324, 483 | Remove `className` and `strokeDasharray`. Use `vertical={false} stroke={isDark ? "#27272a" : "#f0f0f0"}` (Evolução) and `horizontal={false} stroke={...}` (Squad, layout="vertical") |
| 5 | `YAxis` visible with tickFormatter on Evolução MRR chart | Lines 335-338 | `<YAxis hide />` |
| 11 | `className="text-sm"` on XAxis/YAxis elements conflicts with inline `tick` props | Lines 327, 336, 486, 493 | Remove `className="text-sm"` — font size is set via `tick={{ fontSize: 12 }}` |
| 12 | Churn rate `(X.X%)` displayed in Churn card subtitle creates redundancy with Hero | Lines 256-261 | Remove the `(X.X%)` span from Churn StatsCardV2 — Churn Rate is now a Hero metric |
| 6 | No `aria-label` on any `ResponsiveContainer` | Lines 322, 481 | Add descriptive aria-labels |
| 7 | Gradients in podium pillars (`bg-gradient-to-t from-yellow-200 to-yellow-100`, etc.) | Lines 455-458 | Replace with solid colors: `bg-yellow-100 dark:bg-yellow-900/30`, `bg-gray-100 dark:bg-gray-800/30`, `bg-orange-100 dark:bg-orange-900/30`, `bg-muted` for ranks 4-5 |
| 8 | Loading states using text "Carregando..." instead of Skeleton | Lines 313-316, 379-382 | Replace with `<Skeleton>` per section |
| 9 | Inline `formatCurrency` function | Lines 25-32 | Replace with `formatCurrencyNoDecimals` from `@/lib/utils` |
| 10 | Tooltip `contentStyle` missing shadow-lg, proper padding, and design system tokens | Lines 350-354, 498-503 | Use custom `CustomTooltip` component (see Tooltip section) |

---

## Target Page Anatomy

```
Título "Visão Geral" + MonthYearPicker
──────────────────────────────────────
Hero Metrics (sem card wrapper, flex gap-12):
  MRR Ativo (R$ 142.350) | Churn Rate (3,2%)
──────────────────────────────────────
Supporting Cards (StatsCardV2, grid 5 cols desktop / 2 cols mobile):
  Aquisição MRR (success) | Aquisição Pontual (default) | Receita Pontual Entregue (default) | Churn valor (error) | Pausados (warning)
──────────────────────────────────────
Evolução MRR e Receita Pontual (ComposedChart, height 300, full width)
──────────────────────────────────────
Grid 2-col:
  Top 5 Responsáveis (podium, sem gradientes) | MRR por Squad (horizontal BarChart)
```

---

## Hero Metrics (2x HeroMetric, no card wrapper)

| Metric | Source | Format | Notes |
|--------|--------|--------|-------|
| MRR Ativo | `metricas.mrr` | `formatCurrencyNoDecimals(value)` → `"R$ 142.350"` | Primary metric for Operações |
| Churn Rate | `metricas.churnRate` | `${value.toFixed(1)}%` → `"3,2%"` | Shown as percentage, not monetary |

Layout: `flex items-start gap-12` (desktop), `grid grid-cols-1 gap-4` (mobile).

Use `subtitle` prop on HeroMetric for context: `subtitle="Receita Mensal Recorrente de contratos ativos"` on MRR, `subtitle="Taxa de cancelamento sobre MRR"` on Churn Rate.

---

## Supporting Cards (5x StatsCardV2)

| Card | Source | Variant | Format | Info Tooltip |
|------|--------|---------|--------|--------------|
| Aquisição MRR | `metricas.aquisicaoMrr` | `success` | `formatCurrencyNoDecimals(value)` | "Valor de novos contratos recorrentes no mês" |
| Aquisição Pontual | `metricas.aquisicaoPontual` | `default` | `formatCurrencyNoDecimals(value)` | "Valor de novos contratos pontuais no mês" |
| Receita Pontual Entregue | `metricas.receitaPontualEntregue` | `default` | `formatCurrencyNoDecimals(value)` | "Valor de projetos pontuais entregues no mês" |
| Churn (valor) | `metricas.churn` | `error` (if > 0, else `default`) | `formatCurrencyNoDecimals(value)` | "Valor de contratos cancelados no mês" — **remove the `(X.X%)` churn rate from subtitle** (lines 256-261) since Churn Rate is now a Hero metric. Avoids redundancy. |
| Pausados | `metricas.pausados` | `warning` (if > 0, else `default`) | `formatCurrencyNoDecimals(value)` | "Valor de contratos pausados no mês" |

Total: 2 heroes + 5 supporting = **7 KPIs** (under max 8).

Both `StatsCardV2` and `HeroMetric` natively support an Info tooltip via the `subtitle` prop. Pass the tooltip text as `subtitle="..."` — the component renders the `Info` icon and tooltip internally. No external tooltip wrapping needed.

---

## Charts

### Evolução MRR e Receita Pontual (ComposedChart — keep type)

- `ResponsiveContainer height={300}` with `aria-label="Gráfico de evolução mensal de MRR e receita pontual"`
- `CartesianGrid vertical={false} stroke={isDark ? "#27272a" : "#f0f0f0"}`
- `<YAxis hide />`
- `<XAxis dataKey="mes" tick={{ fill: 'currentColor', fontSize: 12 }} tickFormatter={formatMesLabel} />`
- Keep 2 series: Bar (MRR, `fill="hsl(var(--primary))"`) + Line (Pontual Entregue, `stroke="#9333ea"`) — 2 series within limit
- Keep `<Legend>` — multi-series chart needs it. Style: `<Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }} formatter={...} />`
- Keep period selector (6/9/12 meses) — functional
- Tooltip: custom `CustomTooltip` component

### MRR por Squad (horizontal BarChart — keep type)

- `ResponsiveContainer height={300}` with `aria-label="Gráfico de MRR por squad"`
- `CartesianGrid horizontal={false} stroke={isDark ? "#27272a" : "#f0f0f0"}`
- `<XAxis type="number" hide />`
- `<YAxis type="category" dataKey="squad" tick={{ fill: 'currentColor', fontSize: 12 }} width={80} />`
- Keep `Cell` with per-squad colors — categorical coloring (1 series, 4 categories) is acceptable
- Tooltip: custom `CustomTooltip` component

### Tooltip Implementation (all charts)

Replace inline `contentStyle` with a custom Tooltip component:

```tsx
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg p-3 text-sm text-foreground">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name === 'mrr' ? 'MRR' : entry.name === 'receitaPontualEntregue' ? 'Pontual Entregue' : entry.name}:{' '}
          {typeof entry.value === 'number' ? formatCurrencyNoDecimals(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
};
```

Usage: `<RechartsTooltip content={<CustomTooltip />} />` on both charts.

---

## Podium (Top 5 Responsáveis)

Keep the podium layout and visual concept. Changes:

- **Remove gradients** from pillar backgrounds (lines 455-458):
  - Rank 1: `bg-gradient-to-t from-yellow-200 to-yellow-100` → `bg-yellow-100 dark:bg-yellow-900/30`
  - Rank 2: `bg-gradient-to-t from-gray-200 to-gray-100` → `bg-gray-100 dark:bg-gray-800/30`
  - Rank 3: `bg-gradient-to-t from-orange-200 to-orange-100` → `bg-orange-100 dark:bg-orange-900/30`
  - Rank 4-5: `bg-gradient-to-t from-muted to-muted/50` → `bg-muted`
- Keep rank badges (colored circles with position number) — functional, not decorative
- **Replace `formatCurrency(resp.mrr)` at line 449** with `formatCurrencyNoDecimals(resp.mrr)` — this is an additional call site of the inline function being removed (Violation #9)
- Keep the "Carregando..." → replace with `<Skeleton>` (violation #8)
- Keep error state (line 383-386) — already correct

---

## Loading States

Replace text-based loading with per-section Skeletons:

- Hero metrics: `<Skeleton className="h-8 w-32 rounded" />` (2 instances)
- Supporting cards: `<Skeleton className="h-24 rounded-lg" />` (5 in grid)
- Evolução MRR chart: `<Skeleton className="h-[300px] rounded-lg" />`
- Podium: `<Skeleton className="h-48 rounded-lg" />`
- MRR por Squad: no current loading state needed (data loads with same query pattern)

---

## Import Changes

**Remove:**
- `DollarSign`, `TrendingUp`, `TrendingDown`, `PauseCircle`, `CheckCircle`, `Info` from lucide-react — all decorative or now handled internally by HeroMetric/StatsCardV2 components. Zero usages after migration.
- `Tooltip`, `TooltipTrigger`, `TooltipContent` from `@/components/ui/tooltip` — tooltip rendering is handled internally by HeroMetric and StatsCardV2 via their `subtitle` prop. Zero usages after migration.
- Inline `formatCurrency` function (lines 25-32)

**All `formatCurrency` call sites to replace with `formatCurrencyNoDecimals`:**
- Line 154: `metricas?.mrr` (becomes HeroMetric value)
- Line 179: `metricas?.aquisicaoMrr` (becomes StatsCardV2 value)
- Line 204: `metricas?.aquisicaoPontual` (becomes StatsCardV2 value)
- Line 229: `metricas?.receitaPontualEntregue` (becomes StatsCardV2 value)
- Line 254: `metricas?.churn` (becomes StatsCardV2 value)
- Line 284: `metricas?.pausados` (becomes StatsCardV2 value)
- Line 342: inside Evolução tooltip (replaced by CustomTooltip)
- Line 449: `resp.mrr` in podium
- Line 488: Squad XAxis tickFormatter (removed — XAxis is hidden)
- Line 498: Squad tooltip formatter (replaced by CustomTooltip)

**Add:**
- `import { HeroMetric } from "@/components/HeroMetric";`
- `import { StatsCardV2 } from "@/components/StatsCardV2";`
- `import { useTheme } from "@/components/ThemeProvider";`
- `import { Skeleton } from "@/components/ui/skeleton";`
- `import { formatCurrencyNoDecimals } from "@/lib/utils";`

**Keep:**
- `Card`, `CardContent`, `CardHeader`, `CardTitle`, `CardDescription` — used by chart wrapper cards and podium card
- `ComposedChart`, `Bar`, `BarChart`, `Line`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip as RechartsTooltip`, `ResponsiveContainer`, `Cell`, `Legend` — all used by charts
- `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` — period selector
- `MonthYearPicker` — main filter
- `squadColors` record (lines 105-110) — categorical coloring for squad chart

---

## Additional Notes

- **Preserve `data-testid` attributes** from the current cards/elements. Map them to the new components (e.g., `data-testid="card-mrr"` on the HeroMetric wrapper div, `data-testid="text-mrr"` on the value).

---

## Out of Scope

- No changes to API endpoints or data fetching logic
- No addition of NRR metric (requires new backend data)
- No changes to MonthYearPicker or period selector functionality
- No changes to podium layout/ordering logic
- No backend changes
