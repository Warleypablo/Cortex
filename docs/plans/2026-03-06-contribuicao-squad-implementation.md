# Contribuição por Squad — Executive Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the Contribuição por Squad page into an executive dashboard that surfaces squad contribution % and ranking immediately, with drill-down to monthly details.

**Architecture:** Add per-squad summary data to the existing bulk API response. Frontend rebuilt in 3 tiers: Hero Ranking (cards sorted by contribution %) → Annual Summary Table (sortable, with sparklines) → Collapsible Monthly Detail (existing hierarchy, improved).

**Tech Stack:** React, TanStack Query, Recharts (sparklines), Tailwind CSS, shadcn/ui components.

---

### Task 1: Backend — Add per-squad summary to bulk response

**Files:**
- Modify: `server/routes.ts` (lines ~10049-10300, the `/api/contribuicao-squad/dfc/bulk` handler)

**What to do:**

After the existing data processing loop (which builds `mesesResult`), add a new aggregation that computes per-squad annual totals. Add a `resumoPorSquad` field to the response.

**Step 1:** Find the response object construction (near line ~10290) and add a `resumoPorSquad` array. Iterate through `rawRows` (the SQL result) grouped by squad, summing `valor_atribuido` per squad per month.

The new field structure:
```typescript
resumoPorSquad: Array<{
  squad: string;
  receitaTotal: number;           // sum of all months
  porMes: number[];               // 12 values, one per month
  quantidadeContratos: number;
}>
```

**Step 2:** Build this by iterating `rawRows` and grouping by `squad` and `month`:
```typescript
const squadMap = new Map<string, { total: number; porMes: number[]; contratos: Set<string> }>();
for (const row of rawRows) {
  const sq = row.squad || 'Sem Squad';
  if (!squadMap.has(sq)) {
    squadMap.set(sq, { total: 0, porMes: new Array(12).fill(0), contratos: new Set() });
  }
  const entry = squadMap.get(sq)!;
  const monthIdx = parseInt(row.mes_ref.split('-')[1]) - 1;
  const valor = Number(row.valor_atribuido) || 0;
  entry.total += valor;
  entry.porMes[monthIdx] += valor;
  if (row.id_contrato) entry.contratos.add(row.id_contrato);
}

const resumoPorSquad = Array.from(squadMap.entries())
  .filter(([sq]) => !/\bOFF\b/i.test(sq))
  .map(([squad, data]) => ({
    squad,
    receitaTotal: data.total,
    porMes: data.porMes,
    quantidadeContratos: data.contratos.size,
  }))
  .sort((a, b) => b.receitaTotal - a.receitaTotal);
```

**Step 3:** Add `resumoPorSquad` to the response JSON alongside existing fields.

**Step 4:** Commit.
```
feat(squad): adiciona resumoPorSquad no endpoint bulk
```

---

### Task 2: Frontend — Add types, state, and configurable tax rate

**Files:**
- Modify: `client/src/pages/ContribuicaoSquad.tsx` (lines 1-66)

**What to do:**

**Step 1:** Add the new interface and extend BulkResponse:
```typescript
interface SquadResumo {
  squad: string;
  receitaTotal: number;
  porMes: number[];
  quantidadeContratos: number;
}

// Add to BulkResponse interface:
resumoPorSquad?: SquadResumo[];
```

**Step 2:** Add configurable tax rate state (replace hardcoded `TAXA_IMPOSTO = 0.18`):
```typescript
const [taxaImposto, setTaxaImposto] = useState(18); // percentage
const taxaDecimal = taxaImposto / 100;
```

**Step 3:** Replace all `0.18` and `0.82` and `TAXA_IMPOSTO` references with `taxaDecimal` and `(1 - taxaDecimal)`.

**Step 4:** Add new imports needed for the redesign:
```typescript
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { Trophy, ChevronUp, ArrowUpRight, ArrowDownRight, Percent, Minus } from "lucide-react";
```

**Step 5:** Commit.
```
feat(squad): tipos, taxa configurável e imports
```

---

### Task 3: Frontend — Hero Ranking Section

**Files:**
- Modify: `client/src/pages/ContribuicaoSquad.tsx`

**What to do:**

Build the ranking cards section. Insert after the header controls and BEFORE the existing KPI cards.

**Step 1:** Create a `squadRanking` useMemo that takes `bulkData.resumoPorSquad` and computes:
```typescript
const squadRanking = useMemo(() => {
  if (!bulkData?.resumoPorSquad) return [];
  const totalGeral = bulkData.resumoPorSquad.reduce((s, sq) => s + sq.receitaTotal, 0);
  return bulkData.resumoPorSquad.map((sq, idx) => ({
    ...sq,
    posicao: idx + 1,
    contribuicaoPct: totalGeral > 0 ? (sq.receitaTotal * (1 - taxaDecimal) / (totalGeral * (1 - taxaDecimal))) * 100 : 0,
    resultadoLiquido: sq.receitaTotal * (1 - taxaDecimal),
  }));
}, [bulkData, taxaDecimal]);
```

**Step 2:** Render ranking cards (only when `squadSelecionado === "todos"`):
```tsx
{squadSelecionado === "todos" && squadRanking.length > 0 && (
  <div className="space-y-2">
    <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
      <Trophy className="h-4 w-4" />
      Ranking de Contribuição
    </h3>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {squadRanking.map((sq) => (
        <Card
          key={sq.squad}
          className="cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.01] border-l-4"
          style={{ borderLeftColor: sq.posicao <= 3 ? ['#10b981', '#3b82f6', '#f59e0b'][sq.posicao - 1] : '#71717a' }}
          onClick={() => setSquadSelecionado(sq.squad)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-muted-foreground">{sq.posicao}º</span>
                <div>
                  <p className="font-semibold text-sm">{sq.squad}</p>
                  <p className="text-xs text-muted-foreground">{sq.quantidadeContratos} contratos</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs font-bold">
                {sq.contribuicaoPct.toFixed(1)}%
              </Badge>
            </div>
            <div className="mt-3">
              <Progress value={sq.contribuicaoPct} className="h-2" />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>Receita: {formatCurrencyNoDecimals(sq.receitaTotal)}</span>
              <span>Líquido: {formatCurrencyNoDecimals(sq.resultadoLiquido)}</span>
            </div>
            {/* Mini sparkline */}
            <div className="h-8 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sq.porMes.map((v, i) => ({ m: i, v }))}>
                  <Area type="monotone" dataKey="v" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
)}
```

**Step 3:** Commit.
```
feat(squad): hero ranking de squads com sparklines
```

---

### Task 4: Frontend — Redesign Header Controls (tax rate input)

**Files:**
- Modify: `client/src/pages/ContribuicaoSquad.tsx` (lines 200-242)

**What to do:**

Add the tax rate input to the controls row.

**Step 1:** After the year selector, add:
```tsx
<div className="flex items-center gap-1.5">
  <Percent className="h-3.5 w-3.5 text-muted-foreground" />
  <Input
    type="number"
    min={0}
    max={100}
    step={0.5}
    value={taxaImposto}
    onChange={(e) => setTaxaImposto(Number(e.target.value) || 0)}
    className="w-[70px] h-9 text-sm text-center"
    title="Alíquota de imposto (%)"
  />
</div>
```

**Step 2:** Commit.
```
feat(squad): input configurável para alíquota de imposto
```

---

### Task 5: Frontend — Annual Summary Table

**Files:**
- Modify: `client/src/pages/ContribuicaoSquad.tsx`

**What to do:**

Replace the 4 existing KPI cards with a compact annual summary table (when `squadSelecionado === "todos"`). When a specific squad is selected, show KPI cards for that squad only.

**Step 1:** Build the summary table after the Hero Ranking section:

```tsx
{squadSelecionado === "todos" && squadRanking.length > 0 && (
  <Card>
    <CardHeader className="px-4 py-3">
      <CardTitle className="text-sm font-semibold">Resumo Anual por Squad</CardTitle>
    </CardHeader>
    <CardContent className="px-4 pb-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="text-left py-2 pr-4">#</th>
              <th className="text-left py-2 pr-4">Squad</th>
              <th className="text-right py-2 px-3">Receita Bruta</th>
              <th className="text-right py-2 px-3">Impostos ({taxaImposto}%)</th>
              <th className="text-right py-2 px-3">Resultado Líquido</th>
              <th className="text-right py-2 px-3">Contribuição</th>
              <th className="text-center py-2 px-3 w-24">Tendência</th>
            </tr>
          </thead>
          <tbody>
            {squadRanking.map((sq) => (
              <tr
                key={sq.squad}
                className="border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => setSquadSelecionado(sq.squad)}
              >
                <td className="py-2 pr-4 font-bold text-muted-foreground">{sq.posicao}º</td>
                <td className="py-2 pr-4 font-medium">{sq.squad}</td>
                <td className="py-2 px-3 text-right">{formatCurrencyNoDecimals(sq.receitaTotal)}</td>
                <td className="py-2 px-3 text-right text-purple-500">{formatCurrencyNoDecimals(sq.receitaTotal * taxaDecimal)}</td>
                <td className="py-2 px-3 text-right font-semibold">{formatCurrencyNoDecimals(sq.resultadoLiquido)}</td>
                <td className="py-2 px-3 text-right font-bold">{sq.contribuicaoPct.toFixed(1)}%</td>
                <td className="py-2 px-3">
                  <div className="h-6 w-20 mx-auto">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sq.porMes.map((v, i) => ({ m: i, v }))}>
                        <Area type="monotone" dataKey="v" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={1} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 font-bold">
              <td className="py-2 pr-4" colSpan={2}>Total</td>
              <td className="py-2 px-3 text-right">{formatCurrencyNoDecimals(totalReceitas)}</td>
              <td className="py-2 px-3 text-right text-purple-500">{formatCurrencyNoDecimals(totalReceitas * taxaDecimal)}</td>
              <td className="py-2 px-3 text-right">{formatCurrencyNoDecimals(totalReceitas * (1 - taxaDecimal))}</td>
              <td className="py-2 px-3 text-right">100%</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </CardContent>
  </Card>
)}
```

**Step 2:** When a specific squad IS selected, show 4 KPI cards scoped to that squad (keep existing KPI cards but update values from `squadRanking` filtered by selected squad).

**Step 3:** Commit.
```
feat(squad): tabela resumo anual com sparklines e totais
```

---

### Task 6: Frontend — Make Monthly Detail Collapsible

**Files:**
- Modify: `client/src/pages/ContribuicaoSquad.tsx` (lines 324-555)

**What to do:**

**Step 1:** Add state:
```typescript
const [showDetail, setShowDetail] = useState(false);
```

**Step 2:** Wrap the existing Card (monthly table) in a collapsible container:
```tsx
<Card>
  <CardHeader
    className="px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
    onClick={() => setShowDetail(!showDetail)}
  >
    <CardTitle className="text-sm flex items-center justify-between">
      <span className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-emerald-500" />
        Detalhamento Mensal
      </span>
      {showDetail ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
    </CardTitle>
  </CardHeader>
  {showDetail && (
    <CardContent className="px-4 pb-4">
      {/* existing ScrollArea table content */}
    </CardContent>
  )}
</Card>
```

**Step 3:** Update the Impostos row to use `taxaDecimal` dynamically:
- Line 506: `Impostos (18%)` → `Impostos (${taxaImposto}%)`
- Line 510: `col.receitaTotal * 0.18` → `col.receitaTotal * taxaDecimal`
- Line 527: `col.receitaTotal * 0.82` → `col.receitaTotal * (1 - taxaDecimal)`

**Step 4:** Commit.
```
feat(squad): detalhamento mensal colapsável com taxa dinâmica
```

---

### Task 7: Frontend — UX Polish and Empty States

**Files:**
- Modify: `client/src/pages/ContribuicaoSquad.tsx`

**What to do:**

**Step 1:** Add loading skeletons proportional to new layout:
```tsx
{isLoading && (
  <div className="space-y-4">
    <Skeleton className="h-8 w-64" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-[160px]" />)}
    </div>
    <Skeleton className="h-[300px]" />
  </div>
)}
```

**Step 2:** Add empty state when no data:
```tsx
{!isLoading && (!bulkData || squadRanking.length === 0) && (
  <Card className="p-12">
    <div className="text-center text-muted-foreground">
      <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
      <p className="font-medium">Nenhum dado disponível para {anoSelecionado}</p>
      <p className="text-sm mt-1">Tente selecionar outro ano ou verifique os dados de faturamento.</p>
    </div>
  </Card>
)}
```

**Step 3:** Add "voltar para todos" button when a specific squad is filtered:
```tsx
{squadSelecionado !== "todos" && (
  <button
    onClick={() => setSquadSelecionado("todos")}
    className="text-xs text-primary hover:underline flex items-center gap-1"
  >
    ← Voltar para todos os squads
  </button>
)}
```

**Step 4:** Commit.
```
feat(squad): empty states, loading skeletons e botão voltar
```

---

### Task 8: CHANGELOG and Final Commit

**Files:**
- Modify: `docs/CHANGELOG.md`

**Step 1:** Add changelog entry at the top with all changes.

**Step 2:** Final commit and push.
```
docs: changelog do overhaul Contribuição por Squad
```

---

## Execution Order

Tasks 1-8 are sequential. Task 1 (backend) must be done first as Tasks 3 and 5 depend on `resumoPorSquad` data.

## Key Constraints

- Dark/light mode support on all new components
- No breaking changes to API (additive only — new field)
- Mobile responsive (grid cols adapt)
- Tax rate persists in component state only (no backend storage needed)
