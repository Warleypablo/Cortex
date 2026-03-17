# Contribuição por Squad Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate ContribuicaoSquad.tsx to the dashboard design system — add hero metrics, fix accessibility, remove decorative elements, and improve loading/empty states.

**Architecture:** Single-file visual migration of `client/src/pages/ContribuicaoSquad.tsx`. All 7 design system violations are addressed across 5 tasks. No backend, API, or data logic changes. The page already uses the correct Financeiro pattern (hierarchical collapsible table) — we're adding heroes on top and cleaning up the visual layer.

**Tech Stack:** React, TypeScript, Tailwind CSS, HeroMetric component, shadcn/ui (Card, Skeleton, Select, Input, ScrollArea)

**Spec:** `docs/superpowers/specs/2026-03-17-contribuicao-squad-redesign.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `client/src/pages/ContribuicaoSquad.tsx` | All changes — imports, heroes, empty state, loading state, table accessibility, sticky backgrounds |

No new files. No test files (visual-only migration, no testable logic changes).

---

### Task 1: Update imports and remove decorative Percent icon from tax input

**Spec violations addressed:** #2 (DollarSign — prep), #3 (Percent icon)

**Files:**
- Modify: `client/src/pages/ContribuicaoSquad.tsx:11` (imports)
- Modify: `client/src/pages/ContribuicaoSquad.tsx:232-234` (Percent icon removal)

- [ ] **Step 1: Update the lucide-react import line**

Change line 11 from:
```tsx
import { ChevronRight, ChevronDown, DollarSign, Percent } from "lucide-react";
```
To:
```tsx
import { ChevronRight, ChevronDown } from "lucide-react";
```

- [ ] **Step 2: Add HeroMetric import**

Add after line 10 (after the Input import):
```tsx
import { HeroMetric } from "@/components/HeroMetric";
```

- [ ] **Step 3: Remove the Percent icon from the tax input area**

Replace lines 232-233:
```tsx
          <div className="flex items-center gap-1.5">
            <Percent className="h-3.5 w-3.5 text-muted-foreground" />
```
With:
```tsx
          <div className="flex items-center gap-1.5">
```

The `<Input>` element already has `title="Alíquota de imposto (%)"` which provides sufficient context.

- [ ] **Step 4: Verify the app compiles**

Run: `cd /Users/mac0267/Cortex && npx tsc --noEmit --project client/tsconfig.json 2>&1 | head -20`

Expected: No errors related to ContribuicaoSquad.tsx. (DollarSign removal will be addressed in Task 3 where the empty state is replaced.)

**Note:** At this point, `DollarSign` will show a "declared but never used" warning or error because we removed the import but it's still used in the empty state. If the TypeScript compiler flags this, **temporarily keep DollarSign in the import** and only remove it in Task 3 Step 1 when the empty state is replaced. The cleaner approach: do Step 1 of this task as removing only `Percent` from the import (keep `DollarSign`), then remove `DollarSign` in Task 3.

**Corrected Step 1:** Change line 11 to:
```tsx
import { ChevronRight, ChevronDown, DollarSign } from "lucide-react";
```

`DollarSign` will be removed in Task 3 when the empty state that uses it is replaced.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/ContribuicaoSquad.tsx
git commit -m "refactor(contribuicao-squad): remove decorative Percent icon, add HeroMetric import

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Add Hero Metrics section

**Spec violations addressed:** #1 (no hero metrics)

**Files:**
- Modify: `client/src/pages/ContribuicaoSquad.tsx` — insert hero section between filters and empty/loading/table

**Context:** The heroes display `tableData.totalReceita`, `tableData.totalDespesa`, and `tableData.totalMargemPct`. These depend on `squadRanking` which depends on `bulkData`. Heroes should show skeletons when `isLoading || !tableData`.

- [ ] **Step 1: Add the Hero Metrics section**

Insert immediately after the closing `</div>` of the filters section (after line 246, before the `{/* Empty state */}` comment at line 248). Add:

```tsx
      {/* Hero Metrics */}
      {isLoading || !tableData ? (
        <div className="hidden md:flex items-start gap-12">
          <Skeleton className="h-12 w-40 rounded" />
          <Skeleton className="h-12 w-40 rounded" />
          <Skeleton className="h-12 w-40 rounded" />
        </div>
      ) : (
        <div className="hidden md:flex items-start gap-12">
          <HeroMetric
            label="Receita Total"
            value={formatCurrencyNoDecimals(tableData.totalReceita)}
            subtitle="Receita bruta acumulada no ano"
          />
          <HeroMetric
            label="Total Despesas"
            value={formatCurrencyNoDecimals(tableData.totalDespesa)}
            subtitle="Despesas rateadas (impostos + salários + CXCs + freelancers)"
          />
          <HeroMetric
            label="Margem"
            value={`${tableData.totalMargemPct.toFixed(1)}%`}
            subtitle="Margem de contribuição consolidada"
          />
        </div>
      )}
      {/* Mobile heroes */}
      {isLoading || !tableData ? null : (
        <div className="grid grid-cols-1 gap-4 md:hidden">
          <HeroMetric
            label="Receita Total"
            value={formatCurrencyNoDecimals(tableData.totalReceita)}
            subtitle="Receita bruta acumulada no ano"
          />
          <HeroMetric
            label="Total Despesas"
            value={formatCurrencyNoDecimals(tableData.totalDespesa)}
            subtitle="Despesas rateadas (impostos + salários + CXCs + freelancers)"
          />
          <HeroMetric
            label="Margem"
            value={`${tableData.totalMargemPct.toFixed(1)}%`}
            subtitle="Margem de contribuição consolidada"
          />
        </div>
      )}
```

**Why desktop/mobile split:** The spec requires `flex items-start gap-12` on desktop and `grid grid-cols-1 gap-4` on mobile. Using responsive `hidden`/`md:flex` + `md:hidden` avoids the need for a breakpoint hook.

**Important:** The heroes are OUTSIDE the `{!isLoading && tableData && squadRanking.length > 0 && (...)}` guard for the table. They show independently — either as skeletons (loading) or populated values (when tableData is computed). When `totalReceitas === 0` (empty state), heroes should still not show since `tableData` will be null (squadRanking.length === 0 → tableData returns null at line 139).

- [ ] **Step 2: Verify the app compiles**

Run: `cd /Users/mac0267/Cortex && npx tsc --noEmit --project client/tsconfig.json 2>&1 | head -20`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/ContribuicaoSquad.tsx
git commit -m "feat(contribuicao-squad): add hero metrics (Receita Total, Despesas, Margem %)

Three HeroMetric components above the table showing aggregated totals.
Responsive layout: flex gap-12 on desktop, grid on mobile. Shows
skeletons while loading.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Replace empty state and remove DollarSign import

**Spec violations addressed:** #2 (decorative DollarSign), #7 (Card-wrapped empty state)

**Files:**
- Modify: `client/src/pages/ContribuicaoSquad.tsx` — lines 249-257 (empty state), line 11 (DollarSign import)

- [ ] **Step 1: Replace the empty state block**

Replace lines 249-257:
```tsx
      {!isLoading && totalReceitas === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <DollarSign className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground text-sm">Nenhum dado de receita encontrado para {anoSelecionado}.</p>
            <p className="text-muted-foreground text-xs mt-1">Tente selecionar outro ano ou verifique os dados.</p>
          </CardContent>
        </Card>
      )}
```

With:
```tsx
      {!isLoading && totalReceitas === 0 && (
        <p className="text-sm text-muted-foreground text-center py-12">
          Nenhum dado de receita encontrado para {anoSelecionado}.
        </p>
      )}
```

The secondary hint text ("Tente selecionar outro ano...") is intentionally dropped — per design system, empty state should be minimal.

- [ ] **Step 2: Remove DollarSign from the import**

Now that DollarSign has zero usages, change line 11 from:
```tsx
import { ChevronRight, ChevronDown, DollarSign } from "lucide-react";
```
To:
```tsx
import { ChevronRight, ChevronDown } from "lucide-react";
```

- [ ] **Step 3: Verify the app compiles**

Run: `cd /Users/mac0267/Cortex && npx tsc --noEmit --project client/tsconfig.json 2>&1 | head -20`

Expected: No errors. No unused import warnings.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/ContribuicaoSquad.tsx
git commit -m "fix(contribuicao-squad): replace Card-wrapped empty state with inline text

Remove decorative DollarSign icon and Card wrapper. Use simple centered
paragraph per design system empty state pattern.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 4: Replace loading state with per-section skeletons

**Spec violations addressed:** #6 (generic loading state)

**Files:**
- Modify: `client/src/pages/ContribuicaoSquad.tsx` — lines 260-269 (loading block)

- [ ] **Step 1: Replace the generic loading block**

Replace the loading section (currently 8 identical `<Skeleton>` in a Card):
```tsx
      {isLoading && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
```

With per-section skeletons:
```tsx
      {isLoading && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-[95%]" />
              <Skeleton className="h-8 w-[90%]" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-[85%]" />
              <Skeleton className="h-8 w-[92%]" />
            </div>
          </CardContent>
        </Card>
      )}
```

**Note:** The hero metric skeletons are already handled in Task 2 (the hero section shows its own 3 skeletons when `isLoading || !tableData`). This loading block is only for the table section. We change from 8 identical full-width rows to 6 rows with varied widths that suggest a table structure with shorter/longer rows.

- [ ] **Step 2: Verify the app compiles**

Run: `cd /Users/mac0267/Cortex && npx tsc --noEmit --project client/tsconfig.json 2>&1 | head -20`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/ContribuicaoSquad.tsx
git commit -m "fix(contribuicao-squad): replace generic skeleton loading with varied-width table skeleton

6 skeleton rows with varied widths (100%, 95%, 90%, 85%, 92%) instead
of 8 identical rows. Hero skeletons already handled separately.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 5: Table accessibility and sticky cell background fixes

**Spec violations addressed:** #4 (scope="col"), #5 (semi-transparent sticky backgrounds)

**Files:**
- Modify: `client/src/pages/ContribuicaoSquad.tsx` — thead `<th>` elements (add scope), all sticky cell backgrounds

This is the most mechanical task — many small find-and-replace operations across the table. Group them into one commit since they all serve the same purpose (table visual integrity).

- [ ] **Step 1: Add `scope="col"` to all `<th>` elements in thead**

There are 4 `<th>` elements in thead. Add `scope="col"` to each:

**Line 281** (Squad / Linha header — sticky):
```tsx
                      <th scope="col" className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground sticky left-0 z-10 bg-muted min-w-[160px]">
```

**Line 285** (month headers — inside `.map()`):
```tsx
                        <th scope="col" key={m.mes} className="text-right py-2.5 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap min-w-[80px]">
```

**Line 289** (Total header):
```tsx
                      <th scope="col" className="text-right py-2.5 px-3 text-xs font-bold text-foreground min-w-[100px]">
```

**Line 292** (Contrib % header):
```tsx
                      <th scope="col" className="text-right py-2.5 px-3 text-xs font-semibold text-muted-foreground min-w-[70px]">
```

- [ ] **Step 2: Fix sticky cell backgrounds — thead row and its sticky cell**

**Line 280** — thead `<tr>`: change `bg-muted/50` → `bg-muted`:
```tsx
                    <tr className="border-b bg-muted">
```

**Line 281** — thead sticky `<th>`: change `bg-muted/50` → `bg-muted`:
```tsx
                      <th scope="col" className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground sticky left-0 z-10 bg-muted min-w-[160px]">
```

(This was already done in Step 1 — just ensure the `bg-muted` is there, not `bg-muted/50`.)

- [ ] **Step 3: Fix sticky cell backgrounds — squad header rows**

**Line 308** — squad header `<tr>`: change `bg-muted/30` → `bg-muted`:
```tsx
                          <tr
                            className="border-b border-border bg-muted cursor-pointer hover:bg-muted/50 transition-colors"
```

**Line 311** — squad header sticky `<td>`: change `bg-muted/30` → `bg-muted`:
```tsx
                            <td className="py-2 px-3 font-semibold text-sm sticky left-0 z-10 bg-muted hover:bg-muted/50 transition-colors">
```

**Note:** The `hover:bg-muted/50` classes remain semi-transparent intentionally — these are hover states only visible on mouse interaction, not on scroll. Only the base `bg-*` class needs to be opaque.

- [ ] **Step 4: Fix sticky cell backgrounds — tfoot TOTAL row**

**Line 437** — TOTAL `<tr>`: change `bg-muted/50` → `bg-muted`:
```tsx
                    <tr className="border-t-2 border-foreground/20 bg-muted">
```

**Line 438** — TOTAL sticky `<td>`: change `bg-muted/50` → `bg-muted`:
```tsx
                      <td className="py-2.5 px-3 font-bold text-sm sticky left-0 z-10 bg-muted" colSpan={1}>
```

- [ ] **Step 5: Fix sticky cell backgrounds — tfoot detail rows**

Each of these 4 footer detail rows has `bg-muted/30` on both the `<tr>` and its sticky `<td>`. Change all to `bg-muted`:

**Lines 448-449** (Total Receita):
```tsx
                    <tr className="border-b border-border/30 bg-muted">
                      <td className="py-1.5 px-3 pl-9 text-xs text-emerald-600 dark:text-emerald-400 font-medium sticky left-0 z-10 bg-muted">
```

**Lines 463-464** (Total Despesas):
```tsx
                    <tr className="border-b border-border/30 bg-muted">
                      <td className="py-1.5 px-3 pl-9 text-xs text-red-500 dark:text-red-400 font-medium sticky left-0 z-10 bg-muted">
```

**Lines 478-479** (Total Margem):
```tsx
                    <tr className="border-b border-border/30 bg-muted">
                      <td className="py-1.5 px-3 pl-9 text-xs font-bold text-blue-600 dark:text-blue-400 sticky left-0 z-10 bg-muted">
```

**Lines 502-503** (Total Margem %):
```tsx
                    <tr className="bg-muted">
                      <td className="py-1.5 px-3 pl-9 text-xs text-muted-foreground font-medium sticky left-0 z-10 bg-muted">
```

- [ ] **Step 6: Verify the app compiles**

Run: `cd /Users/mac0267/Cortex && npx tsc --noEmit --project client/tsconfig.json 2>&1 | head -20`

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/ContribuicaoSquad.tsx
git commit -m "fix(contribuicao-squad): add scope=col to th elements, fix opaque sticky backgrounds

Add scope='col' to all 4 thead <th> elements for accessibility.
Replace semi-transparent bg-muted/50 and bg-muted/30 with opaque
bg-muted on all sticky cells and their parent rows to prevent text
overlap when scrolling horizontally.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Summary of Changes Per Task

| Task | Violations Fixed | Lines Changed | Commit Size |
|------|-----------------|---------------|-------------|
| 1 | #3 (Percent icon) | ~3 lines (imports + icon removal) | Small |
| 2 | #1 (Hero metrics) | ~30 lines inserted | Medium |
| 3 | #2 (DollarSign), #7 (empty state) | ~10 lines replaced | Small |
| 4 | #6 (loading state) | ~10 lines replaced | Small |
| 5 | #4 (scope=col), #5 (sticky bg) | ~20 lines modified | Medium |

Total: 5 tasks, 5 commits, ~70 lines changed.

---

## Verification

After all 5 tasks are complete, verify:

1. **Compilation:** `npx tsc --noEmit --project client/tsconfig.json` — zero errors
2. **Visual check:** Navigate to `/dashboard/contribuicao-squad` and confirm:
   - Hero metrics visible above the table with correct values
   - No decorative icons (Percent, DollarSign) anywhere
   - Loading state shows hero skeletons + table skeletons (separate sections)
   - Empty state is a plain `<p>` centered text, no Card wrapper
   - Table sticky columns have opaque backgrounds (scroll horizontally to verify)
   - All `<th>` elements have `scope="col"` (inspect via browser DevTools)
3. **Import check:** `grep -n "DollarSign\|Percent" client/src/pages/ContribuicaoSquad.tsx` — should return empty
