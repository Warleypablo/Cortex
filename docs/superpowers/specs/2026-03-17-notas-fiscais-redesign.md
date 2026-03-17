# Notas Fiscais Redesign — Design Spec

> **Scope:** Visual migration of NotasFiscais.tsx to the dashboard design system.
> **Type:** Visual-only — no functional/data changes.
> **Design System Skill:** `agents/dashboard-design-SKILL.md`
> **Domain:** Financeiro (operational/process monitoring sub-page)

---

## Context

| Page | File | Lines | Purpose | Migration Status |
|------|------|-------|---------|-----------------|
| Notas Fiscais | `client/src/pages/NotasFiscais.tsx` | 735 | Invoice processing management — upload, extraction, reconciliation | **Not migrated** |

This is an **operational page** within Financeiro, not a pure financial dashboard. The 4 KPIs (Total NFs, Processadas OK, Com Erro, Valor Total) are process metrics — no Financeiro hero metrics apply here. All 4 become StatsCardV2 (supporting).

---

## Design System Violations to Fix

| # | Violation | Location | Fix |
|---|-----------|----------|-----|
| 1 | Custom `KPICards` function with decorative icons (`FileText`, `CheckCircle2`, `AlertTriangle`, `DollarSign`) and icon-container pattern | Lines 57-85 | Replace with 4 StatsCardV2 in grid. Remove decorative icons. |
| 2 | **PieChart** for "Distribuição por Categoria" | Lines 242-257 | Replace with horizontal BarChart (per Financeiro: PROIBIDO pizza) |
| 3 | **Tabs hiding content** (Visão Geral / Detalhado / Erros / Conciliação) | Lines 622-732 | Replace with vertical scroll sections. Keep each section visible. |
| 4 | Decorative icon in page title (`FileText`) | Line 571 | Remove — page title suffices |
| 5 | Decorative icon in "Evolução Mensal" card header (`TrendingUp`) | Line 210 | Remove decorative icon |
| 6 | Decorative icon in "Erros" card header (`AlertTriangle`) | Line 720 | Remove decorative icon |
| 7 | `CartesianGrid strokeDasharray="3 3"` with hardcoded stroke color | Lines 217, 464 | `vertical={false} stroke={isDark ? "#27272a" : "#f0f0f0"}` |
| 8 | `YAxis` visible with hardcoded tick colors | Lines 219, 466 | `<YAxis hide />` |
| 9 | Tooltip `contentStyle` hardcoded dark bg | Lines 222, 468-469 | Use design system tooltip: `bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg p-3 text-sm text-foreground` |
| 10 | XAxis hardcoded tick colors `fill: "#9ca3af"` | Lines 218, 465 | `fill: 'currentColor'` |
| 11 | No `aria-label` on any `ResponsiveContainer` | Lines 215, 241, 462 | Add descriptive aria-labels |
| 12 | No `scope="col"` on table headers | Lines 349-358, 405-411 | Add `scope="col"` to all `<th>` |
| 13 | No pagination on detail table (can exceed 20 rows) | Lines 346-391 | Add pagination with page size 20 |
| 14 | No Skeleton loading (uses spinner) | Lines 557-563 | Replace spinner with Skeleton per section |
| 15 | Inline `formatCurrency`/`formatCurrencyFull` functions | Lines 47-53 | Replace with `formatCurrencyNoDecimals`/`formatCurrency` from `@/lib/utils` |
| 16 | `CHART_COLORS` array with 9 colors (exceeds max 3 per chart) | Lines 42-45 | Category chart: use max 3 colors. For bar charts, use 1-2 semantic colors. |
| 17 | Table rows missing alternating styling | Both detail and error tables | Add `even:bg-gray-50/50 dark:even:bg-zinc-800/30` |
| 18 | Table headers not sticky | Both tables | Add `sticky top-0 bg-white dark:bg-zinc-900` |
| 19 | Card border tokens wrong (`border-gray-200 dark:border-zinc-700` instead of design system `border-gray-100 dark:border-zinc-800`) | Lines 207, 235, 266, 456, 483, 646, 717 | Replace with `border-gray-100 dark:border-zinc-800` on all Card wrappers (StatsCardV2 handles its own borders) |
| 20 | `gap-6` used inside 2-col grid (should be `gap-4` per design system: "`gap-6` entre seções, `gap-4` dentro de grids") | Line 233 | Change to `gap-4` |

---

## Target Page Anatomy

```
Título "Notas Fiscais" + Botões (Upload, Scan, Reset)
─────────────────────────────────────────────────────
Filtros (Mês, Categoria, Status) — single row, max 4 visible
─────────────────────────────────────────────────────
Supporting Cards (StatsCardV2, grid 4 cols):
  Total NFs (default) | Processadas OK (success) | Com Erro (error) | Valor Total (default)
─────────────────────────────────────────────────────
Evolução Mensal (BarChart, height 300)
─────────────────────────────────────────────────────
Grid 2-col:
  Distribuição por Categoria (horizontal BarChart) | Top Prestadores (ranked list)
─────────────────────────────────────────────────────
Tabela Detalhada (sticky header, alternating rows, pagination >20, export button)
─────────────────────────────────────────────────────
Erros (Collapsible, default expanded, hidden if erros === 0)
─────────────────────────────────────────────────────
Conciliação NFs vs Conta Azul (BarChart + category breakdown)
```

**Key structural change:** Tabs → vertical scroll. The 4 current tabs (Visão Geral, Detalhado, Erros, Conciliação) show different data sets, not perspectives of the same data — per design system: "Sem tabs para esconder conteúdo."

---

## Supporting Cards (4x StatsCardV2)

| Card | Source | Variant | Format |
|------|--------|---------|--------|
| Total NFs | `totais.total_nfs` | `default` | `"142"` (plain number) |
| Processadas OK | `totais.total_ok` | `success` | `"138"` |
| Com Erro | `totais.total_erros` | `error` (only if > 0, else `default`) | `"4"` |
| Valor Total | `totais.valor_total` | `default` | `formatCurrencyNoDecimals(value)` |

No hero metrics — this is an operational page.

---

## Charts

### Evolução Mensal (BarChart — keep type)
- `ResponsiveContainer height={300}` with `aria-label="Gráfico de evolução mensal de notas fiscais"`
- `CartesianGrid vertical={false} stroke={isDark ? "#27272a" : "#f0f0f0"}`
- `<YAxis hide />`
- `<XAxis dataKey="name" tick={{ fill: 'currentColor', fontSize: 12 }} />`
- Single bar series: `fill="#3b82f6"` (total value) — max 1 series for clarity
- Tooltip: use custom `CustomTooltip` component (see Tooltip section below)

### Distribuição por Categoria (PieChart → horizontal BarChart)
- Replace PieChart with horizontal `BarChart` layout="vertical"
- `ResponsiveContainer height={300}` with `aria-label="Gráfico de distribuição por categoria"`
- `CartesianGrid horizontal={false} stroke={isDark ? "#27272a" : "#f0f0f0"}`
- `<XAxis type="number" hide />`
- `<YAxis type="category" dataKey="name" tick={{ fill: 'currentColor', fontSize: 12 }} width={120} />`
- Single color bar: `fill="#3b82f6"`
- No Legend needed (single series)
- Remove `CHART_COLORS` array (no longer needed)
- Remove `PieChart`, `Pie`, `Cell` from recharts imports

### Conciliação NFs vs Conta Azul (BarChart — keep type)
- `ResponsiveContainer height={300}` with `aria-label="Gráfico de conciliação NFs vs Conta Azul"`
- Same chart cleanup: `CartesianGrid vertical={false}`, `<YAxis hide />`, `currentColor` ticks
- 2 bar series: NFs (`#3b82f6`) + Conta Azul (`#10b981`) — within max 3 limit
- **Keep `<Legend />`** — required for multi-series chart. Style per design system: `<Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }} />`
- Tooltip: use custom `CustomTooltip` component (see Tooltip section below)

### Tooltip Implementation (all charts)

Replace hardcoded `contentStyle` with a custom Tooltip component:

```tsx
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg p-3 text-sm text-foreground">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString('pt-BR') : entry.value}
        </p>
      ))}
    </div>
  );
};
```

Usage: `<Tooltip content={<CustomTooltip />} />` on all three charts.

---

## Tables

### Detail Table
- Sticky header: `sticky top-0 bg-white dark:bg-zinc-900 z-10`
- `<th scope="col">` on all headers
- Alternating rows: `even:bg-gray-50/50 dark:even:bg-zinc-800/30`
- **Pagination:** Add state for `currentPage`, show 20 rows per page with prev/next controls
- Export button: keep as-is (functional)

### Errors Table
- Same styling: sticky header, scope, alternating rows
- Only shown if errors exist (conditional rendering, not tab)

### Pagination (Detail Table)
- Add state: `const [currentPage, setCurrentPage] = useState(1);` with `PAGE_SIZE = 20`
- Slice data: `detalhado.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)`
- Prev/Next buttons below the table with page indicator: `"Página {current} de {total}"`
- No external pagination component needed — simple prev/next with `<Button variant="outline" size="sm">`

---

## Erros Section (Collapsible)

- **Visibility:** Only rendered if `erros.length > 0`. If no errors, entire section is hidden.
- **Default state:** Expanded (open) — errors should be immediately visible.
- **Trigger:** Card header with title "NFs com Problemas" + `ChevronDown` icon (rotates on collapse). Use `<CollapsibleTrigger>` wrapping the header.
- **Content:** The errors table inside `<CollapsibleContent>`.
- No decorative `AlertTriangle` icon in the header (removed per violation #6).

---

## Filters

Move filters from inside the Detalhado tab to the top-level (below title, above KPIs):
- Mês, Categoria, Status — 3 filters in a single row
- Apply filters to ALL sections (not just detalhado)
- Default: all empty = show everything (already works this way)
- "Limpar filtros" button only visible when filters active

---

## Loading States

Replace the full-page spinner (lines 557-563) with per-section Skeletons:
- KPI cards: `<Skeleton className="h-24 rounded-lg" />` (4 in grid)
- Charts: `<Skeleton className="h-[300px] rounded-lg" />`
- Tables: 5 skeleton rows with varied widths
- Conciliação: has its own query — show skeleton independently

---

## Import Changes

**Remove:**
- `PieChart`, `Pie`, `Cell` from recharts (Legend is kept — used by Conciliação chart)
- `FileText`, `CheckCircle2`, `Hash`, `TrendingUp`, `AlertTriangle`, `DollarSign` from lucide-react — all decorative. `AlertTriangle` is used only in KPICards (line 62, removed) and Erros header (line 720, removed); zero remaining usages. `DollarSign` is used only in KPICards (line 63, removed).
- `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger` from shadcn
- `KPICards` function (lines 57-85)
- `CHART_COLORS` array (lines 42-45)
- Inline `formatCurrency`/`formatCurrencyFull` functions (lines 47-53)

**Add:**
- `import { StatsCardV2 } from "@/components/StatsCardV2";`
- `import { useTheme } from "@/components/ThemeProvider";`
- `import { Skeleton } from "@/components/ui/skeleton";`
- `import { formatCurrencyNoDecimals, formatCurrency } from "@/lib/utils";`
- `import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";` (for Erros section)
- `import { ChevronDown } from "lucide-react";` (for Collapsible trigger icon)

**Keep:**
- `Legend` from recharts — used by Conciliação chart (2 series needs legend)
- `Upload`, `FolderSearch`, `Loader2`, `RotateCcw`, `Download` — functional action icons

---

## Out of Scope

- No changes to API endpoints or data fetching logic
- No changes to upload/scan/reset functionality
- No changes to export CSV logic
- No backend changes
