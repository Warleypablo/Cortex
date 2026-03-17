# Visão Geral (Gestão) Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate VisaoGeral.tsx to the dashboard design system — visual-only, no functional changes.

**Architecture:** Replace 6 flat KPI cards with 2 HeroMetric + 5 StatsCardV2 components. Fix chart styling (CartesianGrid, YAxis, Tooltip). Remove gradients from podium. Add Skeleton loading. Clean up imports.

**Tech Stack:** React, TypeScript, Tailwind CSS, Recharts, shadcn/ui, HeroMetric, StatsCardV2

**Spec:** `docs/superpowers/specs/2026-03-17-visao-geral-redesign.md`

**Reference components:**
- `client/src/components/HeroMetric.tsx` — accepts `label`, `value`, `subtitle?`, `trend?`
- `client/src/components/StatsCardV2.tsx` — accepts `title`, `value`, `variant?`, `subtitle?`, `trend?`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `client/src/pages/VisaoGeral.tsx` | Modify | All changes happen here (single-file page) |

No new files created. All changes are in-place modifications.

---

### Task 1: Replace imports and remove inline formatCurrency

**Files:**
- Modify: `client/src/pages/VisaoGeral.tsx:1-11` (imports) and `25-32` (inline function)

- [ ] **Step 1: Update imports — remove decorative icons and unused tooltip components**

Replace lines 1-11 with:

```tsx
import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { HeroMetric } from "@/components/HeroMetric";
import { StatsCardV2 } from "@/components/StatsCardV2";
import { useTheme } from "@/components/ThemeProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { ComposedChart, Bar, BarChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
```

Removed: `DollarSign`, `TrendingUp`, `TrendingDown`, `PauseCircle`, `Info`, `CheckCircle` from lucide-react. Removed: `Tooltip`, `TooltipTrigger`, `TooltipContent` from shadcn. Added: `HeroMetric`, `StatsCardV2`, `useTheme`, `Skeleton`, `formatCurrencyNoDecimals`.

- [ ] **Step 2: Remove inline formatCurrency function (lines 25-32)**

Delete the entire `formatCurrency` function:

```tsx
// DELETE THIS BLOCK (lines 25-32):
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};
```

- [ ] **Step 3: Add `useTheme` and `CustomTooltip` inside the component**

After the `usePageTitle` / `useSetPageInfo` calls (around line 14), add:

```tsx
const { theme } = useTheme();
const isDark = theme === "dark";
```

After the `squadColors` record (after line ~110), add the CustomTooltip:

```tsx
const formatMesNome = (mesAno: string) => {
  if (typeof mesAno === 'string' && mesAno.includes('-')) {
    const [ano, mes] = mesAno.split('-');
    const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const idx = parseInt(mes) - 1;
    if (idx >= 0 && idx < 12) return `${mesesNomes[idx]} ${ano}`;
  }
  return mesAno;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg p-3 text-sm text-foreground">
      <p className="font-medium mb-1">{formatMesNome(label)}</p>
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

- [ ] **Step 4: Verify the file compiles**

Run: `cd client && npx tsc --noEmit --pretty 2>&1 | head -30`

Expected: Errors related to removed `formatCurrency` calls at lines 154, 179, etc. (these will be fixed in Task 2). No import errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/VisaoGeral.tsx
git commit -m "refactor(visao-geral): update imports and add CustomTooltip for design system migration

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Replace 6 KPI cards with 2 HeroMetric + 5 StatsCardV2

**Files:**
- Modify: `client/src/pages/VisaoGeral.tsx:134-289`

- [ ] **Step 1: Replace the entire KPI grid (lines 134-289) with Hero + Supporting sections**

Replace the `<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">` block and all 6 Card children with:

```tsx
{/* Hero Metrics */}
<div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-12 mb-8" data-testid="hero-metrics">
  <div data-testid="card-mrr">
    {isLoadingMetricas ? (
      <Skeleton className="h-12 w-48 rounded" />
    ) : (
      <HeroMetric
        label="MRR Ativo"
        value={formatCurrencyNoDecimals(metricas?.mrr || 0)}
        subtitle="Receita Mensal Recorrente de contratos ativos"
      />
    )}
  </div>
  <div data-testid="card-churn-rate">
    {isLoadingMetricas ? (
      <Skeleton className="h-12 w-32 rounded" />
    ) : (
      <HeroMetric
        label="Churn Rate"
        value={`${(metricas?.churnRate || 0).toFixed(1)}%`}
        subtitle="Taxa de cancelamento sobre MRR"
      />
    )}
  </div>
</div>

{/* Supporting Cards */}
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8" data-testid="supporting-cards">
  {isLoadingMetricas ? (
    <>
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-24 rounded-lg" />
    </>
  ) : (
    <>
      <div data-testid="card-aquisicao-mrr">
        <StatsCardV2
          title="Aquisição MRR"
          value={formatCurrencyNoDecimals(metricas?.aquisicaoMrr || 0)}
          variant="success"
          subtitle="Valor de novos contratos recorrentes no mês"
        />
      </div>
      <div data-testid="card-aquisicao-pontual">
        <StatsCardV2
          title="Aquisição Pontual"
          value={formatCurrencyNoDecimals(metricas?.aquisicaoPontual || 0)}
          subtitle="Valor de novos contratos pontuais no mês"
        />
      </div>
      <div data-testid="card-receita-pontual-entregue">
        <StatsCardV2
          title="Receita Pontual Entregue"
          value={formatCurrencyNoDecimals(metricas?.receitaPontualEntregue || 0)}
          subtitle="Valor de projetos pontuais entregues no mês"
        />
      </div>
      <div data-testid="card-churn">
        <StatsCardV2
          title="Churn"
          value={formatCurrencyNoDecimals(metricas?.churn || 0)}
          variant={(metricas?.churn || 0) > 0 ? "error" : "default"}
          subtitle="Valor de contratos cancelados no mês"
        />
      </div>
      <div data-testid="card-pausados">
        <StatsCardV2
          title="Pausados"
          value={formatCurrencyNoDecimals(metricas?.pausados || 0)}
          variant={(metricas?.pausados || 0) > 0 ? "warning" : "default"}
          subtitle="Valor de contratos pausados no mês"
        />
      </div>
    </>
  )}
</div>
```

Key changes:
- MRR Ativo and Churn Rate → `HeroMetric` (no card wrapper, `text-2xl` built-in)
- 5 remaining metrics → `StatsCardV2` with semantic `variant`
- Churn Rate `(X.X%)` removed from Churn card subtitle (now a Hero — no redundancy)
- All decorative icons removed (Info tooltip via `subtitle` prop)
- `data-testid` attributes preserved on wrapper divs (outer `card-*` IDs). Inner `text-*` IDs (e.g., `data-testid="text-mrr"`) are dropped — HeroMetric and StatsCardV2 do not expose inner `data-testid` props. If tests depend on these selectors, update tests to query the outer wrapper + component text content instead.
- Skeleton loading per section

- [ ] **Step 2: Verify the file compiles**

Run: `cd client && npx tsc --noEmit --pretty 2>&1 | head -30`

Expected: Remaining errors only from `formatCurrency` in chart/podium sections (fixed in Tasks 3-4). No errors in the KPI section.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/VisaoGeral.tsx
git commit -m "feat(visao-geral): replace 6 KPI cards with 2 HeroMetric + 5 StatsCardV2

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Fix Evolução MRR chart

**Files:**
- Modify: `client/src/pages/VisaoGeral.tsx` — the ComposedChart section (around lines 291-371 in original, shifted after Task 2)

- [ ] **Step 1: Replace loading text with Skeleton**

Find the loading block inside the Evolução MRR card:

```tsx
// BEFORE:
{isLoadingMrrEvolucao ? (
  <div className="flex items-center justify-center h-[300px]">
    <p className="text-muted-foreground">Carregando...</p>
  </div>
```

Replace with:

```tsx
// AFTER:
{isLoadingMrrEvolucao ? (
  <Skeleton className="h-[300px] rounded-lg" />
```

- [ ] **Step 2: Add aria-label wrapper around ResponsiveContainer**

Recharts `ResponsiveContainer` does not accept `aria-label` as a prop. Wrap it in a div:

```tsx
// BEFORE:
<ResponsiveContainer width="100%" height={300}>

// AFTER:
<div role="img" aria-label="Gráfico de evolução mensal de MRR e receita pontual">
  <ResponsiveContainer width="100%" height={300}>
```

And close the wrapper `</div>` after `</ResponsiveContainer>`:
```tsx
// BEFORE:
  </ResponsiveContainer>

// AFTER:
  </ResponsiveContainer>
</div>
```

- [ ] **Step 3: Fix CartesianGrid — remove strokeDasharray and className**

```tsx
// BEFORE:
<CartesianGrid strokeDasharray="3 3" className="stroke-muted" />

// AFTER:
<CartesianGrid vertical={false} stroke={isDark ? "#27272a" : "#f0f0f0"} />
```

- [ ] **Step 4: Fix XAxis — remove className**

```tsx
// BEFORE:
<XAxis
  dataKey="mes"
  className="text-sm"
  tick={{ fill: 'currentColor' }}
  tickFormatter={(value) => {

// AFTER:
<XAxis
  dataKey="mes"
  tick={{ fill: 'currentColor', fontSize: 12 }}
  tickFormatter={(value) => {
```

- [ ] **Step 5: Hide YAxis**

```tsx
// BEFORE:
<YAxis
  className="text-sm"
  tick={{ fill: 'currentColor' }}
  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
/>

// AFTER:
<YAxis hide />
```

- [ ] **Step 6: Replace Tooltip with CustomTooltip**

```tsx
// BEFORE:
<RechartsTooltip
  formatter={(value: number, name: string) => [
    formatCurrency(value),
    name === 'mrr' ? 'MRR' : 'Pontual Entregue'
  ]}
  labelFormatter={(label) => {
    const [ano, mes] = label.split('-');
    const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${mesesNomes[parseInt(mes) - 1]} ${ano}`;
  }}
  contentStyle={{
    backgroundColor: 'hsl(var(--background))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '6px',
  }}
/>

// AFTER (labelFormatter is ignored when content prop is used — CustomTooltip handles label formatting internally via formatMesNome):
<RechartsTooltip content={<CustomTooltip />} />
```

- [ ] **Step 7: Style Legend per design system**

```tsx
// BEFORE:
<Legend
  formatter={(value) => value === 'mrr' ? 'MRR' : 'Pontual Entregue'}
/>

// AFTER:
<Legend
  wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }}
  formatter={(value) => value === 'mrr' ? 'MRR' : 'Pontual Entregue'}
/>
```

- [ ] **Step 8: Verify chart compiles**

Run: `cd client && npx tsc --noEmit --pretty 2>&1 | head -30`

Expected: Remaining errors only from `formatCurrency` in podium and squad chart (fixed in Tasks 4-5).

- [ ] **Step 9: Commit**

```bash
git add client/src/pages/VisaoGeral.tsx
git commit -m "fix(visao-geral): apply design system to Evolução MRR chart

CartesianGrid, YAxis hide, CustomTooltip, Legend styling, Skeleton loading, aria-label.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 4: Fix Podium — remove gradients and replace formatCurrency

**Files:**
- Modify: `client/src/pages/VisaoGeral.tsx` — the Top 5 Responsáveis section (around lines 373-473 in original)

- [ ] **Step 1: Replace podium loading text with Skeleton**

```tsx
// BEFORE:
{isLoadingTopResponsaveis ? (
  <div className="flex items-center justify-center h-48">
    <p className="text-muted-foreground">Carregando...</p>
  </div>

// AFTER:
{isLoadingTopResponsaveis ? (
  <Skeleton className="h-48 rounded-lg" />
```

- [ ] **Step 2: Replace formatCurrency with formatCurrencyNoDecimals in podium**

Find in the podium rendering:

```tsx
// BEFORE:
{formatCurrency(resp.mrr)}

// AFTER:
{formatCurrencyNoDecimals(resp.mrr)}
```

- [ ] **Step 3: Replace gradient pillar backgrounds with solid colors**

Find the pillar `className` block (the template string with rank-based gradients):

```tsx
// BEFORE:
className={`
  w-full ${heights[rank]} rounded-t-lg
  ${rank === 1 ? 'bg-gradient-to-t from-yellow-200 to-yellow-100 dark:from-yellow-900/40 dark:to-yellow-900/20' : ''}
  ${rank === 2 ? 'bg-gradient-to-t from-gray-200 to-gray-100 dark:from-gray-800/40 dark:to-gray-800/20' : ''}
  ${rank === 3 ? 'bg-gradient-to-t from-orange-200 to-orange-100 dark:from-orange-900/40 dark:to-orange-900/20' : ''}
  ${rank > 3 ? 'bg-gradient-to-t from-muted to-muted/50' : ''}
  flex items-center justify-center
`}

// AFTER:
className={`
  w-full ${heights[rank]} rounded-t-lg
  ${rank === 1 ? 'bg-yellow-100 dark:bg-yellow-900/30' : ''}
  ${rank === 2 ? 'bg-gray-100 dark:bg-gray-800/30' : ''}
  ${rank === 3 ? 'bg-orange-100 dark:bg-orange-900/30' : ''}
  ${rank > 3 ? 'bg-muted' : ''}
  flex items-center justify-center
`}
```

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/VisaoGeral.tsx
git commit -m "fix(visao-geral): remove podium gradients, use solid backgrounds

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 5: Fix MRR por Squad chart

**Files:**
- Modify: `client/src/pages/VisaoGeral.tsx` — the Squad BarChart section (around lines 475-513 in original)

- [ ] **Step 1: Add aria-label wrapper around ResponsiveContainer**

Recharts `ResponsiveContainer` does not accept `aria-label`. Wrap in a div:

```tsx
// BEFORE:
<ResponsiveContainer width="100%" height={300}>

// AFTER:
<div role="img" aria-label="Gráfico de MRR por squad">
  <ResponsiveContainer width="100%" height={300}>
```

And close the wrapper `</div>` after `</ResponsiveContainer>`:
```tsx
// BEFORE:
  </ResponsiveContainer>

// AFTER:
  </ResponsiveContainer>
</div>
```

- [ ] **Step 2: Fix CartesianGrid**

```tsx
// BEFORE:
<CartesianGrid strokeDasharray="3 3" className="stroke-muted" />

// AFTER:
<CartesianGrid horizontal={false} stroke={isDark ? "#27272a" : "#f0f0f0"} />
```

Note: `horizontal={false}` (not `vertical={false}`) because this is a `layout="vertical"` chart — the bars run horizontally, so we hide the horizontal grid lines.

- [ ] **Step 3: Hide XAxis and fix YAxis className**

```tsx
// BEFORE:
<XAxis
  type="number"
  className="text-sm"
  tick={{ fill: 'currentColor' }}
  tickFormatter={(value) => formatCurrency(value)}
/>
<YAxis
  type="category"
  dataKey="squad"
  className="text-sm"
  tick={{ fill: 'currentColor' }}
  width={80}
/>

// AFTER:
<XAxis type="number" hide />
<YAxis
  type="category"
  dataKey="squad"
  tick={{ fill: 'currentColor', fontSize: 12 }}
  width={80}
/>
```

- [ ] **Step 4: Replace Tooltip with CustomTooltip**

```tsx
// BEFORE:
<RechartsTooltip
  formatter={(value: number) => [formatCurrency(value), 'MRR']}
  contentStyle={{
    backgroundColor: 'hsl(var(--background))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '6px',
  }}
/>

// AFTER:
<RechartsTooltip content={<CustomTooltip />} />
```

- [ ] **Step 5: Verify full file compiles with zero errors**

Run: `cd client && npx tsc --noEmit --pretty 2>&1 | head -30`

Expected: No errors. All `formatCurrency` references have been replaced.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/VisaoGeral.tsx
git commit -m "fix(visao-geral): apply design system to MRR por Squad chart

CartesianGrid, XAxis hide, CustomTooltip, aria-label.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 6: Final cleanup and remove dead code

**Files:**
- Modify: `client/src/pages/VisaoGeral.tsx`

- [ ] **Step 1: Remove unused `formatMesLabel` function**

Delete `formatMesLabel` (lines 89-97). It is confirmed unused — the Evolução chart's XAxis keeps its inline `tickFormatter` lambda (Task 3 Step 4), and no other code references `formatMesLabel`.

- [ ] **Step 2: Verify no remaining references to removed imports**

Search for any remaining references to: `DollarSign`, `TrendingUp`, `TrendingDown`, `PauseCircle`, `CheckCircle`, `Info`, `TooltipTrigger`, `TooltipContent`, `formatCurrency` (the inline function — not `formatCurrencyNoDecimals`).

Run: `cd client && grep -n "DollarSign\|TrendingUp\|TrendingDown\|PauseCircle\|CheckCircle\|\"Info\"\|TooltipTrigger\|TooltipContent\|formatCurrency[^N]" src/pages/VisaoGeral.tsx`

Expected: No matches.

- [ ] **Step 3: Verify the dev server starts cleanly**

Run: `cd /Users/mac0267/Cortex && lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &`

Wait 5 seconds, then: `curl -s http://localhost:3000 | head -5`

Expected: HTML response (the app loads).

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/VisaoGeral.tsx
git commit -m "chore(visao-geral): remove dead code after design system migration

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Push**

```bash
git push
```
