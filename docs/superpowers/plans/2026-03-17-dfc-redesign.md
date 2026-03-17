# DFC Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate FluxoCaixa.tsx (remaining violations) and DashboardDFC.tsx (full migration) to the dashboard design system, removing all gradient/blur/decorative-icon anti-patterns.

**Architecture:** Visual-only migration — no data/API changes. FluxoCaixa is ~80% done (only classification cards + accessibility remain). DashboardDFC needs full KPI replacement (HeroMetric + StatsCardV2), gradient removal across 7+ locations, chart cleanup, and import pruning.

**Tech Stack:** React, TypeScript, Tailwind CSS, shadcn/ui, Recharts

**Spec:** `docs/superpowers/specs/2026-03-17-dfc-redesign.md`
**Skill:** `agents/dashboard-design-SKILL.md`

---

## File Structure

### Files to Modify

| File | Responsibility | Complexity |
|------|---------------|------------|
| `client/src/pages/FluxoCaixa.tsx` (~1,005 lines) | Classification filter cards + accessibility | Low |
| `client/src/pages/DashboardDFC.tsx` (~1,304 lines) | Full design system migration | High |

### Reference Files (read-only)

| File | Why |
|------|-----|
| `agents/dashboard-design-SKILL.md` | Design system rules and checklist |
| `client/src/components/HeroMetric.tsx` | Component API reference |
| `client/src/components/StatsCardV2.tsx` | Component API reference |
| `client/src/lib/utils.ts` | Available formatters: `formatCurrency`, `formatCurrencyNoDecimals`, `formatCurrencyCompact`, `formatPercent` |

---

## Task 1: FluxoCaixa — Clean Classification Filter Cards

**Files:**
- Modify: `client/src/pages/FluxoCaixa.tsx:432-497`

- [ ] **Step 1: Read current classification cards section**

Read lines 432-497 of `client/src/pages/FluxoCaixa.tsx`. Understand the 3 cards: "Em dia" (green), "Receosos" (amber), "Duvidosos" (red). Each has a decorative icon, colored background, and onClick toggle behavior.

- [ ] **Step 2: Replace "Em dia" card (lines 440-455)**

Replace the div from line 440 to 455 with:
```tsx
<div
  className={cn(
    "p-4 rounded-lg border cursor-pointer transition-colors",
    "bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800",
    "border-l-[3px] border-l-emerald-500 dark:border-l-emerald-400",
    classificacaoFiltro.includes('em_dia') && "ring-2 ring-emerald-500/30"
  )}
  onClick={() => toggleClassificacao('em_dia')}
>
  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Em dia</p>
  <p className="text-lg font-medium text-foreground mt-1">
    {classificacaoData.resumo.emDia} clientes
  </p>
</div>
```

- [ ] **Step 3: Replace "Receosos" card (lines 457-475)**

```tsx
<div
  className={cn(
    "p-4 rounded-lg border cursor-pointer transition-colors",
    "bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800",
    "border-l-[3px] border-l-amber-500 dark:border-l-amber-400",
    classificacaoFiltro.includes('receoso') && "ring-2 ring-amber-500/30"
  )}
  onClick={() => toggleClassificacao('receoso')}
>
  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Receosos (1 parcela vencida)</p>
  <p className="text-lg font-medium text-foreground mt-1">
    {classificacaoData.resumo.receosos.count} clientes
  </p>
  <p className="text-xs text-muted-foreground">
    {formatCurrency(classificacaoData.resumo.receosos.totalVencido)} vencido
  </p>
</div>
```

- [ ] **Step 4: Replace "Duvidosos" card (lines 477-495)**

```tsx
<div
  className={cn(
    "p-4 rounded-lg border cursor-pointer transition-colors",
    "bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800",
    "border-l-[3px] border-l-red-500 dark:border-l-red-400",
    classificacaoFiltro.includes('duvidoso') && "ring-2 ring-red-500/30"
  )}
  onClick={() => toggleClassificacao('duvidoso')}
>
  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Duvidosos (2+ parcelas vencidas)</p>
  <p className="text-lg font-medium text-foreground mt-1">
    {classificacaoData.resumo.duvidosos.count} clientes
  </p>
  <p className="text-xs text-muted-foreground">
    {formatCurrency(classificacaoData.resumo.duvidosos.totalVencido)} vencido
  </p>
</div>
```

- [ ] **Step 5: Remove unused icon imports**

Check if `UserCheck`, `UserX`, and `AlertTriangle` are used anywhere else in the file beyond the classification cards being replaced. `AlertTriangle` is used only at line 466 (inside the Receosos card being replaced) — remove it from imports along with `UserCheck` and `UserX`.

- [ ] **Step 6: Verify in browser**

Open `/dashboard/fluxo-caixa`. Check classification filter cards in both dark and light mode. Verify click toggles still work. Verify the `ring` highlight appears on active filters.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/FluxoCaixa.tsx
git commit -m "refactor(fluxo-caixa): clean classification filter cards per design system

Replace colored backgrounds and decorative icons with semantic border-left
styling. Keep interactive toggle behavior.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: FluxoCaixa — Accessibility Pass

**Files:**
- Modify: `client/src/pages/FluxoCaixa.tsx`

- [ ] **Step 1: Add aria-label to main chart ResponsiveContainer**

Find the `<ResponsiveContainer` in the main chart section. The chart only renders when `viewMode !== 'semanal'`, so only diário and mensal are possible:

```tsx
<ResponsiveContainer width="100%" height={400} aria-label={
  viewMode === 'diario' ? "Gráfico de fluxo de caixa diário" : "Gráfico de fluxo de caixa mensal"
}>
```

- [ ] **Step 2: Audit table headers in detail dialog**

Search for `<TableHead` or `<th` in the file. Ensure they use the shadcn Table component (which handles scope internally). If there are raw `<th>` elements, add `scope="col"`.

- [ ] **Step 3: Audit ArrowUpCircle / ArrowDownCircle usage**

Search for `ArrowUpCircle` and `ArrowDownCircle` in the file beyond the import line. If used only as decorative icons in the detail dialog headers, remove them and use text labels instead. If used to indicate entry/exit direction in data rows, keep them (functional purpose).

- [ ] **Step 4: Verify in browser**

Check the detail dialog (click a day bar in the chart). Confirm no visual regressions.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/FluxoCaixa.tsx
git commit -m "fix(fluxo-caixa): add accessibility aria-labels and audit icons

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: DashboardDFC — Replace KPI Cards with HeroMetric + StatsCardV2

**Files:**
- Modify: `client/src/pages/DashboardDFC.tsx:567-740`

This is the largest single change. The 6 gradient KPI cards (lines 567-740) get replaced with 3 HeroMetric + 3 StatsCardV2.

- [ ] **Step 1: Read current KPI section and component APIs**

Read `client/src/pages/DashboardDFC.tsx` lines 560-745 (the full KPI grid).
Read `client/src/components/HeroMetric.tsx` and `client/src/components/StatsCardV2.tsx` for the prop interfaces.

- [ ] **Step 2: Add new imports**

At the top of DashboardDFC.tsx, add:
```tsx
import { HeroMetric } from "@/components/HeroMetric";
import { StatsCardV2 } from "@/components/StatsCardV2";
import { useTheme } from "@/components/ThemeProvider";
```

Also add `cn` to the existing `@/lib/utils` import (line 3):
```tsx
import { formatDecimal, formatPercent, formatCurrencyNoDecimals, formatCurrencyCompact, cn } from "@/lib/utils";
```

Inside the component function, add:
```tsx
const { theme } = useTheme();
const isDark = theme === "dark";
```

- [ ] **Step 3: Replace the KPI grid (lines 566-741)**

Replace the entire `{/* KPI Cards - Modern Design */}` section with:

```tsx
{/* Hero Metrics */}
<div className="flex flex-col sm:flex-row items-start gap-6 sm:gap-12">
  {isLoading ? (
    <>
      {[1, 2, 3].map(i => (
        <div key={i} className="flex flex-col gap-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-36" />
        </div>
      ))}
    </>
  ) : (
    <>
      <HeroMetric
        label="Receita Líquida"
        value={formatCurrencyNoDecimals(kpis.totalReceitas)}
      />
      <HeroMetric
        label="Resultado do Período"
        value={formatCurrencyNoDecimals(kpis.saldoLiquido)}
      />
      <HeroMetric
        label="Total Despesas"
        value={formatCurrencyNoDecimals(kpis.totalDespesas)}
      />
    </>
  )}
</div>

{/* Supporting Cards */}
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
  {isLoading ? (
    <>
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
    </>
  ) : (
    <>
      <StatsCardV2
        title="Margem Média"
        value={formatPercent(kpis.margemMedia)}
        variant={kpis.margemMedia >= 20 ? "success" : kpis.margemMedia >= 0 ? "warning" : "error"}
      />
      <StatsCardV2
        title="Período"
        value={`${kpis.totalMeses} meses`}
      />
      <StatsCardV2
        title="Categorias Ativas"
        value={`${kpis.totalCategorias}`}
      />
    </>
  )}
</div>
```

- [ ] **Step 4: Verify in browser**

Open `/dashboard/dfc`. Check:
- 3 hero metrics (no card wrapper, large text)
- 3 supporting cards (StatsCardV2 with proper variants)
- Dark and light mode
- Loading state (throttle network to Slow 3G)

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/DashboardDFC.tsx
git commit -m "refactor(dfc): replace 6 gradient KPI cards with HeroMetric + StatsCardV2

3 hero metrics (Receita, Resultado, Despesas) + 3 supporting cards
(Margem, Período, Categorias). Remove gradient backgrounds and decorative icons.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: DashboardDFC — Clean Header, Date Picker, AI Chat Gradients

**Files:**
- Modify: `client/src/pages/DashboardDFC.tsx`

Addresses spec violations #5, #6, #7, #8, #9.

- [ ] **Step 1: Remove page header gradient icon (line 376)**

Remove the entire decorative icon container:
```tsx
// REMOVE this block (lines 375-378):
<div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
  <BarChart3 className="w-7 h-7 text-white" />
</div>
```

The page title in the breadcrumb/PageContext is sufficient.

- [ ] **Step 2: Clean date picker wrapper gradient (line 396)**

Replace:
```tsx
<div className="flex items-center gap-2 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-xl px-3 py-2 border border-slate-200/60 dark:border-slate-700/60 shadow-sm">
```
With:
```tsx
<div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2 border border-border">
```

- [ ] **Step 3: Clean AI Chat dialog header gradient (line 446)**

Replace:
```tsx
<DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30">
```
With:
```tsx
<DialogHeader className="px-6 py-4 border-b bg-background">
```

- [ ] **Step 4: Clean AI Chat header icon container (line 448)**

Replace:
```tsx
<div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20">
```
With:
```tsx
<div className="p-2 rounded-lg bg-violet-500/10">
```

- [ ] **Step 5: Clean AI Chat send button gradient (line 548)**

Replace:
```tsx
className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
```
With:
```tsx
className="bg-violet-600 hover:bg-violet-700"
```

- [ ] **Step 6: Verify in browser**

Open `/dashboard/dfc`. Check:
- Header: no gradient icon, clean date picker wrapper
- Open AI Chat dialog: no gradient in header, solid send button
- Dark and light mode for all changed areas

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/DashboardDFC.tsx
git commit -m "refactor(dfc): remove gradient backgrounds from header, date picker, and AI chat

Replace with solid backgrounds per design system rules.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: DashboardDFC — Clean Charts

**Files:**
- Modify: `client/src/pages/DashboardDFC.tsx:743-825`

Addresses spec violations #3, #13, #16, #17, #18, #19.

- [ ] **Step 1: Clean Chart 1 — Evolução Mensal (AreaChart)**

In the "Evolução Mensal" card section (~lines 746-785):

1. Remove decorative icon from card header:
```tsx
// REMOVE: <LineChart className="w-5 h-5 text-primary" />
```

2. Change height:
```tsx
<ResponsiveContainer width="100%" height={300} aria-label="Gráfico de evolução mensal de receitas e despesas">
```

3. Remove `<defs>` with `linearGradient` blocks (lines 758-767). Delete entirely.

4. Replace CartesianGrid:
```tsx
<CartesianGrid vertical={false} stroke={isDark ? "#27272a" : "#f0f0f0"} />
```

5. Replace XAxis (keep but simplify):
```tsx
<XAxis dataKey="mes" tick={{ fill: 'currentColor', fontSize: 10 }} />
```

6. Hide YAxis:
```tsx
<YAxis hide />
```

7. Replace Area fills (remove `url(#colorReceitas)` and `url(#colorDespesas)`):
```tsx
<Area type="monotone" dataKey="receitas" stroke="#10b981" strokeWidth={2} fill="#10b981" fillOpacity={0.1} />
<Area type="monotone" dataKey="despesas" stroke="#f43f5e" strokeWidth={2} fill="#f43f5e" fillOpacity={0.1} />
```

- [ ] **Step 2: Clean Chart 2 — Resultado Mensal (ComposedChart)**

In the "Resultado Mensal" card section (~lines 787-825):

1. Remove decorative icon from card header:
```tsx
// REMOVE: <BarChart3 className="w-5 h-5 text-primary" />
```

2. Change height:
```tsx
<ResponsiveContainer width="100%" height={300} aria-label="Gráfico de resultado mensal">
```

3. Replace CartesianGrid:
```tsx
<CartesianGrid vertical={false} stroke={isDark ? "#27272a" : "#f0f0f0"} />
```

4. Hide both YAxis elements but keep dual axis for correct scaling (saldo is monetary, margem is percentage — they need separate scales):
```tsx
<YAxis yAxisId="left" hide />
<YAxis yAxisId="right" orientation="right" hide />
```

5. Keep yAxisId references on Bar and Line (needed for dual scale):
```tsx
<Bar yAxisId="left" dataKey="saldo" radius={[4, 4, 0, 0]}>
```
```tsx
<Line yAxisId="right" type="monotone" dataKey="margem" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
```

6. Keep ReferenceLine (functional — shows break-even):
```tsx
<ReferenceLine yAxisId="left" y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
```

- [ ] **Step 3: Verify in browser**

Open `/dashboard/dfc` with data. Check:
- Both charts render at height 300
- No gradient fills (solid low-opacity fills)
- No YAxis labels (values in tooltip only)
- Tooltip shows correct formatted values
- Dark and light mode

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/DashboardDFC.tsx
git commit -m "refactor(dfc): clean charts — remove gradients, fix height, hide YAxis

Apply design system: height 300, CartesianGrid vertical={false},
YAxis hide, solid fills with low opacity, aria-labels.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: DashboardDFC — Clean DFC Table and Cards View

**Files:**
- Modify: `client/src/pages/DashboardDFC.tsx`

Addresses spec violations #4, #10, #11, #12, #14, #15.

- [ ] **Step 1: Remove backdrop-blur from sticky table header (line 953)**

Replace:
```tsx
className="sticky top-0 z-20 bg-muted/80 backdrop-blur-sm font-semibold p-3 border-b text-center text-sm capitalize"
```
With:
```tsx
className="sticky top-0 z-20 bg-muted font-semibold p-3 border-b text-center text-sm capitalize"
```

- [ ] **Step 2: Clean RESULTADO row gradient (line 1167)**

Replace:
```tsx
className="sticky left-0 z-10 p-3 border-t-2 border-b border-r bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950"
```
With:
```tsx
className="sticky left-0 z-10 p-3 border-t-2 border-b border-r bg-blue-50 dark:bg-blue-950"
```

- [ ] **Step 3: Remove decorative Target icon from RESULTADO row (line 1171)**

Replace:
```tsx
<div className="flex items-center gap-2">
  <Target className="w-4 h-4 text-blue-600" />
  <span className="font-bold text-sm text-blue-700 dark:text-blue-400">
    RESULTADO
  </span>
</div>
```
With:
```tsx
<span className="font-bold text-sm text-blue-700 dark:text-blue-400">
  RESULTADO
</span>
```

- [ ] **Step 4: Clean MARGEM row gradient (line 1235)**

Replace:
```tsx
className="sticky left-0 z-10 p-3 border-b border-r bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950"
```
With:
```tsx
className="sticky left-0 z-10 p-3 border-b border-r bg-violet-50 dark:bg-violet-950"
```

- [ ] **Step 5: Remove decorative Percent icon from MARGEM row (line 1239)**

Replace:
```tsx
<div className="flex items-center gap-2">
  <Percent className="w-4 h-4 text-violet-600" />
  <span className="font-bold text-sm text-violet-700 dark:text-violet-400">
    MARGEM
  </span>
</div>
```
With:
```tsx
<span className="font-bold text-sm text-violet-700 dark:text-violet-400">
  MARGEM
</span>
```

- [ ] **Step 6: Remove decorative Activity icon from DFC table section header (line 834)**

Replace:
```tsx
<div className="flex items-center gap-3">
  <div className="p-2 rounded-lg bg-primary/10">
    <Activity className="w-5 h-5 text-primary" />
  </div>
  <div>
    <CardTitle className="text-lg">Demonstrativo de Fluxo de Caixa</CardTitle>
```
With:
```tsx
<div>
  <CardTitle className="text-lg">Demonstrativo de Fluxo de Caixa</CardTitle>
```

- [ ] **Step 7: Clean "Cards" view root node gradients (lines 863-866)**

Replace:
```tsx
<div className={`p-4 rounded-xl ${
  rootNode.categoriaId === 'RECEITAS'
    ? 'bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 border border-emerald-200/50 dark:border-emerald-800/30'
    : 'bg-gradient-to-r from-rose-50 to-rose-100/50 dark:from-rose-950/30 dark:to-rose-900/20 border border-rose-200/50 dark:border-rose-800/30'
}`}>
```
With:
```tsx
<div className={cn(
  "p-4 rounded-xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800",
  rootNode.categoriaId === 'RECEITAS'
    ? "border-l-[3px] border-l-emerald-500 dark:border-l-emerald-400"
    : "border-l-[3px] border-l-red-500 dark:border-l-red-400"
)}>
```

Also replace the decorative `ArrowUpCircle`/`ArrowDownCircle` icons in the cards view root nodes (~lines 870-874) — remove the entire icon conditional and keep just the text label.

- [ ] **Step 8: Verify in browser**

Check in `/dashboard/dfc`:
- Table view: no backdrop-blur on sticky headers, RESULTADO/MARGEM rows solid bg, no decorative icons
- Cards view: root nodes have border-left color, no gradient, no decorative icons
- Toggle between Table and Cards view
- Dark and light mode

- [ ] **Step 9: Commit**

```bash
git add client/src/pages/DashboardDFC.tsx
git commit -m "refactor(dfc): clean table and cards view — remove gradients, blur, decorative icons

Replace backdrop-blur with opaque bg, gradient rows with solid colors,
remove Target/Percent/Activity decorative icons, semantic border-left
on cards view root nodes.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: DashboardDFC — Import Cleanup

**Files:**
- Modify: `client/src/pages/DashboardDFC.tsx:1-38`

- [ ] **Step 1: Remove unused Tabs import (line 9)**

Remove entire line:
```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
```

- [ ] **Step 2: Clean lucide-react imports (lines 19-25)**

After all previous tasks, these icons should no longer be used in the file:
- `ArrowUpCircle`, `ArrowDownCircle` — were in KPI cards and cards view (both replaced)
- `Wallet`, `Calendar` — were in KPI cards (replaced)
- `CircleDollarSign` — confirmed unused in file body, remove
- `LineChart` — was in chart card header (removed)
- `BarChart3` — was in chart header + page header (both removed)
- `Activity` — was in DFC table header (removed)
- `Target` — was in RESULTADO row (removed)
- `Percent` — was in MARGEM row (removed, BUT check if still used in `formatPercent` context — it's a lucide icon, not a formatter)

**Keep:** `Loader2`, `TrendingUp`, `TrendingDown`, `DollarSign`, `ChevronRight`, `ChevronDown`, `Receipt`, `Sparkles`, `BrainCircuit`, `Send`, `MessageCircle`, `Bot`, `User`, `Minus`, `LayoutGrid`, `Table2`, `RotateCcw`

Run a grep/search for each icon name in the file body (excluding import line) to confirm which are safe to remove.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit --project client/tsconfig.json 2>&1 | head -20
```

If there are errors about missing imports, add them back. If errors are unrelated, note and continue.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/DashboardDFC.tsx
git commit -m "refactor(dfc): remove unused imports — Tabs, decorative icons

Clean imports after design system migration. Remove Tabs (never used),
ArrowUpCircle, ArrowDownCircle, Wallet, Calendar, LineChart, BarChart3,
Activity, Target, Percent.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Final Verification — Anti-Pattern Grep + Checklist

**Files:**
- Verify: `client/src/pages/FluxoCaixa.tsx`, `client/src/pages/DashboardDFC.tsx`

- [ ] **Step 1: Grep for remaining anti-patterns**

```bash
FILES="client/src/pages/FluxoCaixa.tsx client/src/pages/DashboardDFC.tsx"
echo "=== Gradients ===" && grep -n "bg-gradient-to" $FILES
echo "=== Backdrop blur ===" && grep -n "backdrop-blur" $FILES
echo "=== LinearGradient ===" && grep -n "linearGradient" $FILES
echo "=== Hover scale ===" && grep -n "hover:scale" $FILES
```

Expected: **zero results** for all 4 greps.

- [ ] **Step 2: Verify aria-labels exist**

```bash
grep -n "aria-label" $FILES
```

Expected: at least 1 aria-label per chart (2 in DashboardDFC, 1 in FluxoCaixa).

- [ ] **Step 3: Run design system checklist**

Per `agents/dashboard-design-SKILL.md` checklist:

**Hierarquia:**
- [ ] Max 3 hero metrics? (FluxoCaixa: 2, DashboardDFC: 3) ✓
- [ ] Supporting cards <= 6? (FluxoCaixa: 4, DashboardDFC: 3) ✓
- [ ] Fluxo top-down? ✓

**Visual:**
- [ ] Zero gradientes em cards? ✓
- [ ] Zero backdrop-blur? ✓
- [ ] Zero hover:scale em não-interativos? ✓
- [ ] Cores só semânticas? ✓
- [ ] Max 3 cores por gráfico? ✓

**Dados:**
- [ ] Filtros com defaults inteligentes? ✓
- [ ] Tabelas paginadas >20 linhas? (Check DFC table)

**Estados:**
- [ ] Loading state com Skeleton? ✓
- [ ] Error state isolado? (Verify exists)
- [ ] Empty state? ✓

**Consistência:**
- [ ] Valores monetários formatados? ✓
- [ ] Labels uppercase + tracking-wide? ✓
- [ ] gap-6 seções / gap-4 grids? ✓
- [ ] Dark + light mode ok? (Verify visually)

**Acessibilidade:**
- [ ] Trends com símbolo + cor? ✓
- [ ] aria-labels em charts? ✓

- [ ] **Step 4: Fix any issues found**

If any grep returns results or checklist items fail, fix them now.

- [ ] **Step 5: Commit fixes (if any)**

```bash
git add client/src/pages/FluxoCaixa.tsx client/src/pages/DashboardDFC.tsx
git commit -m "fix(dfc): address final review findings from design system checklist

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Push**

```bash
git push
```
