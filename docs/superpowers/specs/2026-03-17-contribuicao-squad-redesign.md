# Contribuição por Squad Redesign — Design Spec

> **Scope:** Visual migration of ContribuicaoSquad.tsx to the dashboard design system.
> **Type:** Visual-only — no functional/data changes.
> **Design System Skill:** `agents/dashboard-design-SKILL.md`
> **Domain:** Financeiro

---

## Context

| Page | File | Lines | Purpose | Migration Status |
|------|------|-------|---------|-----------------|
| Contribuição por Squad | `client/src/pages/ContribuicaoSquad.tsx` | 533 | Squad contribution to revenue — hierarchical DRE-style table with expense allocation and margin | **Not migrated** |

This is a **Financeiro page** showing DRE-style hierarchical data. Per Financeiro domain rules: "DRE/DFC = tabelas hierárquicas colapsíveis, NÃO cards." The table structure is already correct — the migration adds hero metrics, fixes accessibility, and removes decorative elements.

---

## Design System Violations to Fix

| # | Violation | Location | Fix |
|---|-----------|----------|-----|
| 1 | No hero metrics — table is the first visible content after filters | Entire page | Add 3 HeroMetric above the table: Receita Total, Total Despesas, Margem % |
| 2 | Decorative `DollarSign` icon in empty state | Line 252 | Remove — text is sufficient per design system empty state pattern |
| 3 | Decorative `Percent` icon next to tax rate input | Line 233 | Remove — input title/label is sufficient |
| 4 | `<th>` elements missing `scope="col"` | Lines 281-294 | Add `scope="col"` to all `<th>` elements |
| 5 | Sticky cells use semi-transparent backgrounds (`bg-muted/50`, `bg-muted/30`) — text becomes unreadable when scrolling horizontally | Lines 280-281, 311, 437-438, 448-449, 463-464, 478-479, 502-503 | Replace with opaque `bg-muted` for all sticky cells and their parent row backgrounds |
| 6 | Loading state is generic (8 identical skeletons) — doesn't match page layout | Lines 260-269 | Replace with per-section skeletons: heroes + table rows |
| 7 | Empty state uses Card wrapper with decorative icon instead of inline text | Lines 249-257 | Replace with simple centered text per design system empty state pattern |

---

## Target Page Anatomy

```
Título "Contribuição por Squad" + Filtros (Squad, Ano, Taxa %)
──────────────────────────────────────────────────────────────
Hero Metrics (sem card wrapper, flex gap-12):
  Receita Total (R$ X) | Total Despesas (R$ X) | Margem (X.X%)
──────────────────────────────────────────────────────────────
Tabela Hierárquica Colapsível (mantém estrutura atual):
  Squad rows (collapsible) → Receita / Despesas / Margem / Margem %
  Footer: TOTAL → Receita / Despesas / Margem / Margem %
```

---

## Hero Metrics (3x HeroMetric, no card wrapper)

| Metric | Source | Format | Subtitle |
|--------|--------|--------|----------|
| Receita Total | `tableData.totalReceita` | `formatCurrencyNoDecimals(value)` | "Receita bruta acumulada no ano" |
| Total Despesas | `tableData.totalDespesa` | `formatCurrencyNoDecimals(value)` | "Despesas rateadas (impostos + salários + CXCs + freelancers)" |
| Margem | `tableData.totalMargemPct` | `${value.toFixed(1)}%` | "Margem de contribuição consolidada" |

Layout: `flex items-start gap-12` (desktop), `grid grid-cols-1 gap-4` (mobile).

Heroes depend on `tableData` which requires `squadRanking` to be computed. Show skeletons while `isLoading` is true OR when `tableData` is null.

HeroMetric natively supports an Info tooltip via the `subtitle` prop — the component renders the `Info` icon and tooltip internally. No external tooltip wrapping needed.

---

## Table Changes

### Accessibility

- Add `scope="col"` to all `<th>` elements in thead (lines 281, 285, 289, 292)

### Sticky Cell Backgrounds

Replace all semi-transparent backgrounds on sticky cells with opaque equivalents to prevent text overlap when scrolling:

| Current | Replacement | Where |
|---------|-------------|-------|
| `bg-muted/50` | `bg-muted` | thead row (line 280), tfoot TOTAL row (line 437), sticky `<td>` in thead (line 281) |
| `bg-muted/30` | `bg-muted` | Squad header row (lines 308, 311), tfoot detail rows (lines 448-449, 463-464, 478-479, 502-503) and their sticky `<td>` cells |
| `bg-background` | Keep as-is | Expanded detail rows (lines 348, 364, 383, 410) — these are not in muted rows |

**Note:** The non-sticky cells in those same rows should also match (`bg-muted`) so there's no visual inconsistency between the sticky first column and the scrolling columns.

### Everything Else — Keep As-Is

- Collapsible squad rows with ChevronDown/ChevronRight icons (functional, not decorative)
- Semantic colors: emerald (receita), red (despesas), blue (margem)
- Currency formatting with `formatCurrencyNoDecimals`
- Expense allocation logic (proportional rateio)
- Tax rate input (functional)
- Squad filter and year filter
- ScrollArea with horizontal scroll
- Footer totals section
- "← Voltar para todos os squads" link

---

## Empty State

Replace the Card-wrapped empty state with the design system pattern:

**Before (lines 249-257):**
```tsx
<Card>
  <CardContent className="py-12 text-center">
    <DollarSign className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
    <p>...</p>
  </CardContent>
</Card>
```

**After:**
```tsx
<p className="text-sm text-muted-foreground text-center py-12">
  Nenhum dado de receita encontrado para {anoSelecionado}.
</p>
```

---

## Loading States

Replace the generic 8-skeleton loading with per-section skeletons:

- Hero metrics: 3x `<Skeleton className="h-12 w-40 rounded" />` in a flex row
- Table: `<Card><CardContent className="p-4"><div className="space-y-3">` with 6 rows of `<Skeleton className="h-8 w-full" />` with varied widths (100%, 95%, 90%, etc.) to suggest table structure `</div></CardContent></Card>`

---

## Import Changes

**Remove:**
- `DollarSign` from lucide-react — decorative in empty state, zero usages after migration
- `Percent` from lucide-react — decorative next to tax input, zero usages after migration

**Add:**
- `import { HeroMetric } from "@/components/HeroMetric";`

**Keep:**
- `ChevronRight`, `ChevronDown` — functional toggle icons for collapsible rows
- `Card`, `CardContent` — used by table wrapper and loading state
- `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` — filters
- `Skeleton` — loading states
- `ScrollArea`, `ScrollBar` — horizontal scroll for table
- `Input` — tax rate input
- `formatCurrencyNoDecimals`, `cn` — formatting and conditional classes

---

## Out of Scope

- No changes to API endpoints or data fetching logic
- No changes to expense allocation/rateio calculation
- No changes to collapsible row behavior
- No changes to tax rate input functionality
- No backend changes
