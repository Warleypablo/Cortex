# Dashboard Design System — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create foundation components (HeroMetric, StatsCardV2) and migrate Phase 1 dashboards (Operacoes) to the new minimalist design system.

**Architecture:** Progressive migration — new components coexist with old ones. Each dashboard is migrated independently. The old StatsCard is only removed when zero imports remain. None of the Phase 1 target files currently import StatsCard — they all use custom inline KPI rendering that will be replaced with the new components.

**Tech Stack:** React, TypeScript, Tailwind CSS, shadcn/ui, Recharts, React Query

**Spec:** `docs/superpowers/specs/2026-03-17-dashboard-design-system.md`
**Skill:** `agents/dashboard-design-SKILL.md`

**Prerequisites:**
- `TooltipProvider` already wraps the app in `App.tsx:460` — no changes needed
- `ChartTooltip` already exists at `client/src/components/ui/chart-tooltip.tsx` — validate alignment in Task 1
- Formatters available in `client/src/lib/utils.ts`: `formatCurrency`, `formatCurrencyWithDecimals`, `formatCurrencyCompact`, `formatPercent`
- `Skeleton` component available at `import { Skeleton } from "@/components/ui/skeleton"`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `client/src/components/HeroMetric.tsx` | Hero-level metric (1-3 per page, no card wrapper) |
| `client/src/components/StatsCardV2.tsx` | Supporting metric card (clean, no gradients/blur/icons) |

### Existing Files (validate, no major changes)
| File | Why |
|------|-----|
| `client/src/components/ui/chart-tooltip.tsx` | Already exists — validate spec alignment |
| `client/src/lib/utils.ts` | Formatters already available |
| `client/src/components/StatsCard.tsx` | Kept as-is until all consumers migrate (4 files import it: Clients, Patrimonio, Contracts, ClientDetail — none in Phase 1) |

### Files to Migrate (Phase 1 — Operacoes)
| File | Lines | Complexity | Anti-patterns present |
|------|-------|-----------|----------------------|
| `client/src/pages/VisaoGeral.tsx` | 519 | Medium | Custom inline KPIs, inline formatCurrency |
| `client/src/pages/EvolucaoMensal.tsx` | 1,191 | High | Custom inline KPIs, gradient chart fills |
| `client/src/pages/ChurnDetalhamento.tsx` | 4,618 | Very High | Tabs, Collapsibles, PieChart, multiple chart types, 40+ icon imports |
| `client/src/pages/ChurnPredicao.tsx` | 508 | Medium | Custom inline KPIs, inline formatCurrencyBR, tier-colored cards |
| `client/src/pages/DashboardRetencao.tsx` | 1,270 | High | MultiSelect, HoverCard, Dialog, bar charts with anomaly detection |
| `client/src/pages/SaudeBaseAtiva.tsx` | 491 | Medium | `backdrop-blur`, `bg-white/80`, gradient chart fills, custom tooltips |

---

## Task 1: Create HeroMetric Component + Validate ChartTooltip

**Files:**
- Create: `client/src/components/HeroMetric.tsx`
- Validate: `client/src/components/ui/chart-tooltip.tsx`

- [ ] **Step 1: Validate existing ChartTooltip alignment**

Read `client/src/components/ui/chart-tooltip.tsx`. Check if the tooltip container uses styling close to the spec requirement:
```
bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg p-3 text-sm text-foreground
```
The existing component uses `bg-background border-border` (Tailwind theme tokens). This is acceptable since it resolves to equivalent colors. If there are major deviations, note them for a separate fix. Do NOT modify the file if it works — it's used across many pages.

- [ ] **Step 2: Create HeroMetric component**

```tsx
import { cn } from "@/lib/utils";

interface HeroMetricProps {
  label: string;
  value: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export function HeroMetric({ label, value, trend }: HeroMetricProps) {
  return (
    <div className="flex flex-col">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className="text-2xl sm:text-3xl font-semibold text-foreground mt-1">
        {value}
      </p>
      {trend && (
        <span
          className={cn(
            "text-sm font-medium mt-1",
            trend.isPositive
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
          )}
        >
          {trend.isPositive ? "▲" : "▼"} {trend.value}
        </span>
      )}
    </div>
  );
}
```

> **Note:** Spec defines a `format` prop — deferred to Phase 2 when we have more usage patterns. For now, callers pre-format the `value` string using utils.

- [ ] **Step 3: Verify renders in browser**

Temporarily add to any existing page:
```tsx
<HeroMetric label="MRR Total" value="R$ 487.230" trend={{ value: "3,2%", isPositive: true }} />
```
Verify in both dark and light mode. Remove after verification.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/HeroMetric.tsx
git commit -m "feat: add HeroMetric component for dashboard design system"
```

---

## Task 2: Create StatsCardV2 Component

**Files:**
- Create: `client/src/components/StatsCardV2.tsx`

- [ ] **Step 1: Create StatsCardV2 component**

```tsx
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

type CardVariant = "default" | "success" | "warning" | "error";

const variantBorder: Record<CardVariant, string> = {
  default: "",
  success: "border-l-[3px] border-l-emerald-500 dark:border-l-emerald-400",
  warning: "border-l-[3px] border-l-amber-500 dark:border-l-amber-400",
  error: "border-l-[3px] border-l-red-500 dark:border-l-red-400",
};

interface StatsCardV2Props {
  title: string;
  value: string;
  variant?: CardVariant;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  subtitle?: string;
}

export function StatsCardV2({
  title,
  value,
  variant = "default",
  trend,
  subtitle,
}: StatsCardV2Props) {
  return (
    <div
      className={cn(
        "bg-white dark:bg-zinc-900",
        "border border-gray-100 dark:border-zinc-800",
        "rounded-lg p-5",
        variantBorder[variant]
      )}
    >
      <div className="flex items-center gap-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </p>
        {subtitle && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="w-3.5 h-3.5 rounded-full bg-muted/50 dark:bg-white/10 flex items-center justify-center hover:bg-muted dark:hover:bg-white/20 transition-colors shrink-0"
              >
                <Info className="w-2 h-2 text-muted-foreground" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg p-3 text-sm text-foreground max-w-[250px]"
            >
              {subtitle}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <p className="text-lg font-medium text-foreground mt-1">{value}</p>
      {trend && (
        <span
          className={cn(
            "text-xs font-medium mt-1 inline-block",
            trend.isPositive
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
          )}
        >
          {trend.isPositive ? "▲" : "▼"} {trend.value}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify renders in browser (both themes, all 4 variants)**

- [ ] **Step 3: Commit**

```bash
git add client/src/components/StatsCardV2.tsx
git commit -m "feat: add StatsCardV2 component for dashboard design system"
```

---

## Task 3: Migrate VisaoGeral.tsx

**Files:**
- Modify: `client/src/pages/VisaoGeral.tsx` (519 lines)
- Ref: `agents/dashboard-design-SKILL.md`

**Context:** Shows MRR metrics, top managers/squads rankings, and MRR evolution chart. Does NOT import StatsCard — uses custom inline components. Has an inline `formatCurrency` function (should use `@/lib/utils`).

- [ ] **Step 1: Read the current file and the design skill**

Read `client/src/pages/VisaoGeral.tsx` and `agents/dashboard-design-SKILL.md` fully.

- [ ] **Step 2: Identify hero metrics vs supporting metrics**

Per the Operacoes domain rules:
- **Heroes (max 3):** MRR Total, Churn Rate (%), NRR (%)
- **Supporting:** Other secondary metrics currently shown

- [ ] **Step 3: Refactor the metrics section**

Replace the current KPI cards section with:
1. `HeroMetric` components for the 3 hero metrics (no card wrapper, `flex items-start gap-12`)
2. `StatsCardV2` for any remaining supporting metrics (grid 3-4 cols, `gap-4`)

Import pattern:
```tsx
import { HeroMetric } from "@/components/HeroMetric";
import { StatsCardV2 } from "@/components/StatsCardV2";
```

- [ ] **Step 4: Clean up chart section**

- `ResponsiveContainer height={300}` (not 400)
- `CartesianGrid vertical={false}` with correct theme colors (`isDark ? "#27272a" : "#f0f0f0"`)
- `<YAxis hide />` if values are in tooltip
- Max 2 series for line/area charts
- Add `aria-label` to `ResponsiveContainer` (e.g., `aria-label="Grafico de evolucao do MRR"`)

- [ ] **Step 5: Remove visual anti-patterns**

Search and remove:
- Any `bg-gradient-to-*` classes
- Any `backdrop-blur-*` classes
- Any `hover:scale-*` on non-interactive elements
- Any decorative icons that don't convey information
- Any `useCountUpNumber` usage
- Replace inline `formatCurrency` with import from `@/lib/utils`

- [ ] **Step 6: Add proper states**

```tsx
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
```

- Loading: `<Skeleton className="h-8 w-32" />` for heroes, `<Skeleton className="h-24 rounded-lg" />` for cards, `<Skeleton className="h-[300px] rounded-lg" />` for charts
- Error: inline message per section with `AlertTriangle`
- Empty: `"Sem dados para o periodo selecionado."` centered

- [ ] **Step 7: Accessibility pass**

- Add `aria-label` to all `<ResponsiveContainer>` wrappers
- Verify table headers use `<th scope="col">`
- Trends use symbol (▲/▼) + color (already handled by HeroMetric/StatsCardV2)

- [ ] **Step 8: Verify in browser**

Check: dark/light mode, loading state (throttle network), responsive sm/md/lg, hero metrics, chart.

- [ ] **Step 9: Run the full checklist from `agents/dashboard-design-SKILL.md`**

- [ ] **Step 10: Commit**

```bash
git add client/src/pages/VisaoGeral.tsx
git commit -m "refactor(visao-geral): migrate to dashboard design system

Apply minimalist design: HeroMetric for top metrics, StatsCardV2 for
supporting, clean chart with proper states. Remove gradients, blur,
decorative icons per dashboard-design-SKILL."
```

---

## Task 4: Migrate EvolucaoMensal.tsx

**Files:**
- Modify: `client/src/pages/EvolucaoMensal.tsx` (1,191 lines)
- Ref: `agents/dashboard-design-SKILL.md`

**Context:** Complex page with squad/operador view modes, MRR/churn table modes, area charts with gradient fills, and SQUAD_COLORS mapping. Does NOT import StatsCard. Has custom inline KPI rendering and chart theme colors object.

- [ ] **Step 1: Read the current file fully (1,191 lines)**

Understand the view modes (squad/operador), data flow, SQUAD_COLORS mapping, and chart logic.

- [ ] **Step 2: Identify hero metrics**

Per Operacoes rules: MRR Total, Churn Rate (%), NRR (%) — extract from current data.

- [ ] **Step 3: Apply page anatomy**

```
Title + Filters (max 4: period, squad/operador toggle, +2)
────────────────────────────
Hero Metrics (HeroMetric, no card)
────────────────────────────
Supporting Cards (StatsCardV2, grid)
────────────────────────────
Chart (area chart, max 2 series — selected squad + total)
────────────────────────────
Table (always last)
```

- [ ] **Step 4: Simplify filters to max 4 visible**

Keep: period selector, squad/operador toggle, squad/operador selector. Move rest to popover.

- [ ] **Step 5: Clean charts**

- `height={300}`, `CartesianGrid vertical={false}`, `<YAxis hide />`
- Remove gradient fills (linearGradient in area charts) — use solid fill with low opacity instead
- If area chart has >2 series, show only selected squad + total
- Add `aria-label` to each `<ResponsiveContainer>`

- [ ] **Step 6: Remove all visual anti-patterns**

Gradients, blur, hover:scale, decorative icons, count-up animations.

- [ ] **Step 7: Add proper states (loading/error/empty)**

- [ ] **Step 8: Accessibility pass (aria-labels, table headers)**

- [ ] **Step 9: Verify in browser + run full checklist**

- [ ] **Step 10: Commit**

```bash
git add client/src/pages/EvolucaoMensal.tsx
git commit -m "refactor(evolucao-mensal): migrate to dashboard design system"
```

---

## Task 5: Migrate ChurnDetalhamento.tsx

**Files:**
- Modify: `client/src/pages/ChurnDetalhamento.tsx` (4,618 lines — LARGEST file)
- Ref: `agents/dashboard-design-SKILL.md`

**Context:** Massive file with: Tabs (MRR/Quantidade/Motivos), Collapsible sections, multiple chart types (BarChart, PieChart, LineChart, AreaChart), heavy table rendering with expandable rows, MultiSelect filters, Progress bars, date-fns formatting, RelatorioSemanalChurn sub-component, and 40+ icon imports. Does NOT import StatsCard.

**Important:** Due to the file size (4,618 lines), this task is the most complex. Read thoroughly before touching anything. Consider splitting the migration into sub-commits if needed (e.g., metrics section first, then charts, then tables).

- [ ] **Step 1: Read current file and map internal structure**

At 4,618 lines, understand the major sections:
- KPI/metrics area (what data, what layout)
- Tab structure (what each tab shows)
- Collapsible sections (what they contain)
- Charts (which types, how many)
- Tables (which data, row expansion logic)
- Filters (how many, what state they control)

- [ ] **Step 2: Identify hero metrics**

Per Operacoes: Churn MRR (R$), Churn Logos (count), Churn Rate (%)
- **Critical:** Separate churned MRR from churned logos — NEVER combine

- [ ] **Step 3: Apply page anatomy — restructure top section**

Replace current KPI cards with:
1. `HeroMetric` for Churn MRR, Churn Logos, Churn Rate (top, no card wrapper)
2. `StatsCardV2` for secondary metrics (supporting grid)

- [ ] **Step 4: Address tabs**

Per design system: "Sem tabs para esconder conteudo." Exception: tabs for alternating perspective of same data. Evaluate current tabs:
- If MRR/Quantidade tabs show the same data from different perspectives → tabs are OK
- If Motivos tab shows fundamentally different content → consider making it a separate section below (scroll), not a hidden tab

- [ ] **Step 5: Replace PieChart with horizontal bar**

ChurnDetalhamento imports PieChart. Per spec anti-pattern: "PROIBIDO grafico de pizza." Replace with horizontal stacked bars or horizontal bar chart showing the same data.

- [ ] **Step 6: Clean all charts**

For each chart (Bar, Line, Area):
- `height={300}`, `CartesianGrid vertical={false}`, `<YAxis hide />`
- Max 2 series for line/area, max 3 for stacked bars
- Add `aria-label` to each `<ResponsiveContainer>`

- [ ] **Step 7: Simplify filters to max 4 visible**

Current page likely has many filters (MultiSelect, date pickers, etc.). Keep 4 most important visible, rest in "Mais filtros" popover.

- [ ] **Step 8: Clean tables**

- Sticky headers, alternating rows, no vertical borders
- Pagination >20 rows
- Expandable rows stay but simplify visual treatment

- [ ] **Step 9: Remove all visual anti-patterns**

Gradients, blur, hover:scale, decorative icons, count-up, emojis in labels.

- [ ] **Step 10: Add proper states (loading/error/empty)**

Per-section isolation: if one API call fails, only that section shows error.

- [ ] **Step 11: Accessibility pass**

- `aria-label` on all charts
- `<th scope="col">` on all table headers
- Trends use symbol + color

- [ ] **Step 12: Verify in browser + run full checklist**

Pay special attention to: all tab contents, collapsed/expanded states, table pagination, dark/light mode.

- [ ] **Step 13: Commit (or multiple sub-commits)**

```bash
git add client/src/pages/ChurnDetalhamento.tsx
git commit -m "refactor(churn-detalhamento): migrate to dashboard design system

Replace PieChart with horizontal bars, apply HeroMetric/StatsCardV2,
clean charts, simplify filters, add proper states."
```

---

## Task 6: Migrate ChurnPredicao.tsx

**Files:**
- Modify: `client/src/pages/ChurnPredicao.tsx` (508 lines)
- Ref: `agents/dashboard-design-SKILL.md`

**Context:** Churn prediction/risk scoring page. Uses custom TIER_CONFIG for risk levels (color-coded), inline `formatCurrencyBR()` function (should use centralized utils), ScoreBar inline component, table with expandable row details, Badge-based KPI rendering. Does NOT import StatsCard. No gradients, no backdrop-blur, no hover:scale.

- [ ] **Step 1: Read current file (508 lines)**

Understand: risk tier system, prediction data flow, table structure, inline formatting.

- [ ] **Step 2: Identify hero metrics**

Candidates: Total em Risco (R$), Contratos em Risco (count), Score Medio de Risco
- Map these to HeroMetric components

- [ ] **Step 3: Apply page anatomy**

```
Title + Filters
────────────────
Hero Metrics (risk totals)
────────────────
Supporting Cards (StatsCardV2 — per-tier breakdown)
────────────────
Risk table (sortable, with expandable rows)
```

- [ ] **Step 4: Replace inline formatCurrencyBR with import from utils**

```tsx
// Remove: const formatCurrencyBR = ...
// Add: import { formatCurrency } from "@/lib/utils";
```

- [ ] **Step 5: Replace custom KPI cards/Badges with HeroMetric + StatsCardV2**

The tier-colored cards can use StatsCardV2 with semantic variants (success/warning/error mapping to low/medium/high risk).

- [ ] **Step 6: Clean table — sticky header, alternating rows, pagination**

- [ ] **Step 7: Add proper states (loading/error/empty)**

- [ ] **Step 8: Accessibility pass (aria-labels, table headers)**

- [ ] **Step 9: Verify in browser + run full checklist**

- [ ] **Step 10: Commit**

```bash
git add client/src/pages/ChurnPredicao.tsx
git commit -m "refactor(churn-predicao): migrate to dashboard design system"
```

---

## Task 7: Migrate DashboardRetencao.tsx

**Files:**
- Modify: `client/src/pages/DashboardRetencao.tsx` (1,270 lines)
- Ref: `agents/dashboard-design-SKILL.md`

**Context:** Retention analysis with cohort data. Uses MultiSelect, HoverCard, Dialog, BarChart with anomaly detection (isAnomaly, getAnomalyDirection from chart utils), custom chart tooltips, extensive data transformation. Does NOT import StatsCard. Has complex filter state.

**Special rule:** Cohort retention should be a heatmap (no series limit applies to heatmaps).

- [ ] **Step 1: Read current file (1,270 lines)**

Understand: cohort data structure, anomaly detection logic, filter combinations, chart types used.

- [ ] **Step 2: Identify hero metrics**

Per Operacoes: Retention Rate (%), Average LTV, Cohort Count
- Map to HeroMetric

- [ ] **Step 3: Apply page anatomy**

```
Title + Filters (max 4)
────────────────────────
Hero Metrics
────────────────────────
Supporting Cards (StatsCardV2)
────────────────────────
Cohort Heatmap (primary chart — no series limit)
────────────────────────
Bar chart (secondary, if needed — max 2 series)
────────────────────────
Detail table
```

- [ ] **Step 4: Simplify filters to max 4 visible**

MultiSelect is fine for the visible filters. Move excess to popover.

- [ ] **Step 5: Clean charts**

- `height={300}`, `CartesianGrid vertical={false}`, `<YAxis hide />`
- Heatmap: ensure color tokens follow spec (emerald for high retention, red for low)
- Bar charts: max 2 series
- Keep anomaly detection logic (it's functional, not decorative)
- Add `aria-label` to each chart container

- [ ] **Step 6: Replace custom KPI rendering with HeroMetric + StatsCardV2**

- [ ] **Step 7: Remove visual anti-patterns + add states**

- [ ] **Step 8: Accessibility pass**

- [ ] **Step 9: Verify in browser + run full checklist**

- [ ] **Step 10: Commit**

```bash
git add client/src/pages/DashboardRetencao.tsx
git commit -m "refactor(retencao): migrate to dashboard design system"
```

---

## Task 8: Migrate SaudeBaseAtiva.tsx

**Files:**
- Modify: `client/src/pages/SaudeBaseAtiva.tsx` (491 lines)
- Ref: `agents/dashboard-design-SKILL.md`

**Context:** Base health analysis with BarChart and AreaChart. Uses `useTheme` hook with custom `chartColors` object. Has **confirmed anti-patterns:** `backdrop-blur`, `bg-white/80 dark:bg-zinc-900/80` (semi-transparent), gradient chart fills (linearGradient), custom CustomTooltip component. Does NOT import StatsCard.

**Special rule:** Base health distribution = horizontal stacked bars (saudavel/atencao/critico = 3 series allowed).

- [ ] **Step 1: Read current file (491 lines)**

Understand: health scoring logic, chart data structure, CustomTooltip implementation.

- [ ] **Step 2: Identify hero metrics**

Candidates: Contratos Ativos (count), MRR Base Ativa (R$), Score Medio de Saude
- Map to HeroMetric

- [ ] **Step 3: Apply page anatomy with stacked bar distribution**

```
Title + Filters
────────────────
Hero Metrics
────────────────
Supporting Cards (StatsCardV2)
────────────────
Stacked horizontal bar (saudavel/atencao/critico — 3 series OK)
────────────────
Detail table
```

- [ ] **Step 4: Remove confirmed anti-patterns**

Specific lines to address:
- Replace `bg-white/80 dark:bg-zinc-900/80` → `bg-white dark:bg-zinc-900` (opaque)
- Remove `backdrop-blur` classes
- Remove linearGradient from chart fills — use solid `fill` with low opacity
- Replace custom `CustomTooltip` with `ChartTooltip` from `@/components/ui/chart-tooltip`

- [ ] **Step 5: Apply 3-state color scheme for stacked bars**

```tsx
// Saudavel: emerald-500 (light) / emerald-400 (dark)
// Atencao: amber-500 / amber-400
// Critico: red-500 / red-400
```

- [ ] **Step 6: Replace custom KPI rendering with HeroMetric + StatsCardV2**

- [ ] **Step 7: Clean charts — height, grid, axis, aria-labels**

- [ ] **Step 8: Add proper states (loading/error/empty)**

- [ ] **Step 9: Accessibility pass**

- [ ] **Step 10: Verify in browser + run full checklist**

- [ ] **Step 11: Commit**

```bash
git add client/src/pages/SaudeBaseAtiva.tsx
git commit -m "refactor(saude-base): migrate to dashboard design system

Remove backdrop-blur, gradient fills, semi-transparent backgrounds.
Apply HeroMetric/StatsCardV2, 3-state stacked bars (emerald/amber/red)."
```

---

## Task 9: Phase 1 Final Review

- [ ] **Step 1: Run full visual audit**

Open each migrated page in browser, both dark and light mode:
1. VisaoGeral
2. EvolucaoMensal
3. ChurnDetalhamento
4. ChurnPredicao
5. DashboardRetencao
6. SaudeBaseAtiva

- [ ] **Step 2: Cross-page consistency check**

Verify:
- Hero metrics consistent (same font sizes, spacing)
- StatsCardV2 looks identical across all pages
- Chart height is 300px on all pages
- Filters are in the same position on all pages
- Color tokens match across pages
- Labels are all uppercase + tracking-wide

- [ ] **Step 3: Grep for remaining anti-patterns**

```bash
FILES="client/src/pages/VisaoGeral.tsx client/src/pages/EvolucaoMensal.tsx client/src/pages/ChurnDetalhamento.tsx client/src/pages/ChurnPredicao.tsx client/src/pages/DashboardRetencao.tsx client/src/pages/SaudeBaseAtiva.tsx"
grep -n "bg-gradient-to" $FILES
grep -n "backdrop-blur" $FILES
grep -n "hover:scale" $FILES
grep -n "useCountUpNumber\|useCountUp" $FILES
grep -Pn "[\x{1F300}-\x{1F9FF}]" $FILES  # emoji check
```

Expected: zero results for all greps.

- [ ] **Step 4: Accessibility audit**

```bash
# Verify aria-labels on charts
grep -n "aria-label" $FILES
# Verify table headers
grep -n "scope=" $FILES
```

Expected: at least 1 aria-label per chart, scope="col" on all th elements.

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add client/src/pages/VisaoGeral.tsx client/src/pages/EvolucaoMensal.tsx client/src/pages/ChurnDetalhamento.tsx client/src/pages/ChurnPredicao.tsx client/src/pages/DashboardRetencao.tsx client/src/pages/SaudeBaseAtiva.tsx
git commit -m "fix: address Phase 1 review findings in migrated dashboards"
```

- [ ] **Step 6: Update Obsidian task tracking**

Update the relevant task file in `/Users/mac0267/Documents/Obsidian Vault/Cortex 2.0/Tasks/` with completion status.

- [ ] **Step 7: Push all changes**

```bash
git push
```
