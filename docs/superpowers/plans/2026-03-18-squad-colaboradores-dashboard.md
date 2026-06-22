# Squad Colaboradores Dashboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enriquecer a aba "Colaboradores" do SquadDetalhe com painel de 3 cards (ranking MRR, concentracao de receita, alertas) + tabela com sparklines e barras de % MRR.

**Architecture:** Frontend-only. Adiciona componentes visuais inline (`MiniSparkline`, `MrrProgressBar`) e 3 cards de contexto acima da tabela existente, todos usando dados ja disponiveis na `DetalheResponse`. Nenhuma mudanca no backend.

**Tech Stack:** React, TypeScript, Tailwind CSS, Recharts, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-18-squad-colaboradores-dashboard-design.md`

---

## File Structure

- **Modify:** `client/src/components/squads/SquadDetalhe.tsx` (unico arquivo)
  - Adicionar imports: `LineChart` do Recharts; `CheckCircle2`, `AlertTriangle` do Lucide
  - Adicionar constantes de threshold (linhas ~30, apos OPERATOR_COLORS)
  - Adicionar componentes `MiniSparkline` e `MrrProgressBar` (antes do `export default`)
  - Modificar aba Colaboradores (linhas ~604-722): painel de cards + tabela enriquecida
  - Ajustar Top 6 → Top 5 (linhas ~234, ~241, ~704)

---

### Task 1: Adicionar constantes e imports

**Files:**
- Modify: `client/src/components/squads/SquadDetalhe.tsx:11-20` (imports)
- Modify: `client/src/components/squads/SquadDetalhe.tsx:35` (apos OPERATOR_COLORS)

- [ ] **Step 1: Adicionar `LineChart` e `Cell` ao import de Recharts**

Na linha 19, adicionar `LineChart` e `Cell` ao import existente:
```typescript
import {
  AreaChart, Area, BarChart, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Bar, ComposedChart, Line, LineChart,
} from "recharts";
```

- [ ] **Step 2: Adicionar icones Lucide**

Na linha 16, adicionar `CheckCircle2` e `AlertTriangle`:
```typescript
import {
  DollarSign, Users, TrendingDown, TrendingUp, FileText, ArrowLeft, Search, UserCheck, Clock, FileDown,
  CheckCircle2, AlertTriangle,
} from "lucide-react";
```

- [ ] **Step 3: Adicionar constantes de threshold**

Apos a linha 35 (fim do `OPERATOR_COLORS`), adicionar:
```typescript
const CHURN_RATE_ALERT_THRESHOLD = 5;
const MRR_DELTA_ALERT_THRESHOLD = 10;
const CONCENTRATION_ALERT_THRESHOLD = 40;
```

- [ ] **Step 4: Verificar que o servidor compila sem erros**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`
Expected: `200` (sem erros de compilacao)

- [ ] **Step 5: Commit**

```bash
git add client/src/components/squads/SquadDetalhe.tsx
git commit -m "refactor(squads): add imports and constants for colaboradores dashboard"
```

---

### Task 2: Criar componentes MiniSparkline e MrrProgressBar

**Files:**
- Modify: `client/src/components/squads/SquadDetalhe.tsx:178-188` (apos `ChurnRateIndicator`, antes de `getMotivoBadgeColor`)

- [ ] **Step 1: Adicionar componente MiniSparkline**

Inserir apos a funcao `ChurnRateIndicator` (linha ~178):
```typescript
function MiniSparkline({ data, width = 60, height = 24 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const color = data[data.length - 1] >= data[0] ? "#10b981" : "#f43f5e";
  const chartData = data.map((value, index) => ({ index, value }));
  return (
    <LineChart width={width} height={height} data={chartData}>
      <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} />
    </LineChart>
  );
}
```

- [ ] **Step 2: Adicionar componente MrrProgressBar**

Inserir logo apos `MiniSparkline`:
```typescript
function MrrProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color, opacity: 0.7 }}
        />
      </div>
      <span className="text-xs text-gray-600 dark:text-zinc-400 w-10 text-right">{value.toFixed(1)}%</span>
    </div>
  );
}
```

- [ ] **Step 3: Verificar compilacao**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`
Expected: `200`

- [ ] **Step 4: Commit**

```bash
git add client/src/components/squads/SquadDetalhe.tsx
git commit -m "feat(squads): add MiniSparkline and MrrProgressBar components"
```

---

### Task 3: Adicionar painel superior com 3 cards

**Files:**
- Modify: `client/src/components/squads/SquadDetalhe.tsx:604-606` (inicio da aba Colaboradores)

O painel e inserido logo apos o `<TabsContent value="colaboradores">`, antes do Card existente "Desempenho por Colaborador".

- [ ] **Step 1: Adicionar painel de 3 cards**

Substituir a linha:
```tsx
<TabsContent value="colaboradores" className="space-y-6">
```

Por toda a estrutura abaixo. Note: o Card existente "Desempenho por Colaborador" (que comeca na proxima linha) permanece intacto — o painel e inserido ENTRE o `<TabsContent>` e o `<Card>` existente.

```tsx
<TabsContent value="colaboradores" className="space-y-6">
  {/* Painel de Cards */}
  {data && data.operadores.length > 0 && (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Card 1: Ranking MRR */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">Ranking MRR</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(150, data.operadores.length * 28 + 20)}>
            <BarChart layout="vertical" data={[...data.operadores].sort((a, b) => b.mrr - a.mrr)} margin={{ left: 0, right: 10 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="nome" width={100} tick={{ fill: 'currentColor', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => formatCurrencyNoDecimals(v)} contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, color: chartColors.tooltipText, borderRadius: 8 }} />
              <Bar dataKey="mrr" radius={[0, 4, 4, 0]} fill={squadColor} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Card 2: Concentracao de Receita */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">Concentracao de Receita</CardTitle>
        </CardHeader>
        <CardContent>
          {t && t.mrr > 0 ? (() => {
            const sorted = [...data.operadores].sort((a, b) => b.mrr - a.mrr);
            const top3 = sorted.slice(0, 3);
            const top3Pct = top3.map(op => ({ nome: op.nome, pct: (op.mrr / t.mrr) * 100 }));
            const outrosPct = Math.max(0, 100 - top3Pct.reduce((sum, o) => sum + o.pct, 0));
            const isConcentrated = top3Pct[0]?.pct > CONCENTRATION_ALERT_THRESHOLD;
            return (
              <div className="space-y-3">
                {isConcentrated && (
                  <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px]">
                    <AlertTriangle className="w-3 h-3 mr-1" /> Alta concentracao
                  </Badge>
                )}
                {top3Pct.map((item, idx) => (
                  <div key={item.nome} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-700 dark:text-zinc-300 truncate">{idx + 1}. {item.nome}</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{item.pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${item.pct}%`, backgroundColor: squadColor, opacity: 0.7 }} />
                    </div>
                  </div>
                ))}
                {sorted.length > 3 && outrosPct > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500 dark:text-zinc-500">Outros</span>
                      <span className="text-gray-500 dark:text-zinc-500">{outrosPct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gray-300 dark:bg-zinc-600" style={{ width: `${outrosPct}%` }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })() : <span className="text-xs text-gray-400 dark:text-zinc-600">Sem dados de MRR</span>}
        </CardContent>
      </Card>

      {/* Card 3: Alertas de Saude */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">Alertas</CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const alerts: { nome: string; type: 'churn' | 'mrr'; label: string }[] = [];
            for (const op of data.operadores) {
              if (op.churnRate > CHURN_RATE_ALERT_THRESHOLD) {
                alerts.push({ nome: op.nome, type: 'churn', label: `Churn alto: ${formatPercent(op.churnRate)}` });
              }
            }
            if (data.operadoresAnterior) {
              for (const op of data.operadores) {
                const prev = data.operadoresAnterior.find(p => p.nome === op.nome);
                if (prev && prev.mrr > 0) {
                  const deltaPct = ((op.mrr - prev.mrr) / prev.mrr) * 100;
                  if (deltaPct < -MRR_DELTA_ALERT_THRESHOLD) {
                    alerts.push({ nome: op.nome, type: 'mrr', label: `Queda MRR: ${deltaPct.toFixed(1)}%` });
                  }
                }
              }
            }
            const sorted = alerts.sort((a, b) => a.type === 'churn' && b.type !== 'churn' ? -1 : a.type !== 'churn' && b.type === 'churn' ? 1 : 0);
            if (sorted.length === 0) {
              return (
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm">Todos os indicadores saudaveis</span>
                </div>
              );
            }
            return (
              <div className="space-y-2 max-h-[180px] overflow-y-auto">
                {sorted.map((alert, idx) => (
                  <div key={`${alert.nome}-${alert.type}-${idx}`} className="flex items-center gap-2">
                    <Badge className={cn("text-[10px] shrink-0",
                      alert.type === 'churn'
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    )}>
                      {alert.type === 'churn' ? <TrendingDown className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
                      {alert.label}
                    </Badge>
                    <span className="text-xs text-gray-600 dark:text-zinc-400 truncate">{alert.nome}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  )}
```

- [ ] **Step 2: Verificar compilacao e renderizacao**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`
Expected: `200`

- [ ] **Step 3: Commit**

```bash
git add client/src/components/squads/SquadDetalhe.tsx
git commit -m "feat(squads): add 3-card dashboard panel to colaboradores tab"
```

---

### Task 4: Enriquecer tabela com colunas Tendencia e % MRR

**Files:**
- Modify: `client/src/components/squads/SquadDetalhe.tsx` — secao da tabela de colaboradores (linhas ~614-692)

- [ ] **Step 1: Adicionar headers das novas colunas**

No `<TableHeader>`, apos o head "MRR" e antes de "Delta MRR", inserir:
```tsx
<TableHead className="text-gray-600 dark:text-zinc-400 text-center">Tendencia</TableHead>
```

Apos o head "Delta MRR" e antes de "Contratos", inserir:
```tsx
<TableHead className="text-gray-600 dark:text-zinc-400 text-right">% Squad</TableHead>
```

- [ ] **Step 2: Adicionar celulas nas linhas de operadores**

No `<TableBody>`, dentro do `.map((op, idx))`, apos a celula de MRR e antes da celula de Delta MRR, inserir a celula de sparkline:
```tsx
<TableCell className="text-center">
  {(() => {
    const opData = (data?.evolucaoOperadores || [])
      .filter(e => e.operador === op.nome)
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map(e => parseFloat(String(e.mrr)) || 0);
    return opData.length >= 2 ? <MiniSparkline data={opData} /> : null;
  })()}
</TableCell>
```

Apos a celula de Delta MRR e antes de Contratos, inserir a celula de % MRR:
```tsx
<TableCell className="text-right">
  {t && t.mrr > 0 ? <MrrProgressBar value={(op.mrr / t.mrr) * 100} color={squadColor} /> : null}
</TableCell>
```

- [ ] **Step 3: Adicionar hover e separador Top 3**

Primeiro, alterar o `.map()` callback para incluir `idx`. Trocar:
```tsx
{(data?.operadores || []).map((op) => (
```
Por:
```tsx
{(data?.operadores || []).map((op, idx) => (
```

Em seguida, na `<TableRow>` dos operadores, adicionar hover e separador condicional. Alterar:
```tsx
<TableRow key={op.nome} className="border-gray-100 dark:border-zinc-800">
```
Para:
```tsx
<TableRow key={op.nome} className={cn(
  "border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors",
  idx === 2 && (data?.operadores || []).length >= 4 && "border-b-2 border-gray-300 dark:border-zinc-600"
)}>
```

- [ ] **Step 4: Atualizar footer (Total) com as 2 colunas novas**

No footer `<TableRow>` do Total, apos a celula de MRR e antes de Delta MRR, inserir:
```tsx
<TableCell /> {/* Tendencia: vazio */}
```

Apos a celula de Delta MRR e antes de Contratos, inserir:
```tsx
<TableCell className="text-right text-xs text-gray-500 dark:text-zinc-500">100%</TableCell>
```

- [ ] **Step 5: Verificar compilacao**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`
Expected: `200`

- [ ] **Step 6: Commit**

```bash
git add client/src/components/squads/SquadDetalhe.tsx
git commit -m "feat(squads): add sparkline and MRR% columns to colaboradores table"
```

---

### Task 5: Ajustar grafico de evolucao Top 6 → Top 5

**Files:**
- Modify: `client/src/components/squads/SquadDetalhe.tsx:234,241,704`

- [ ] **Step 1: Alterar comentario e slice**

Linha ~234, alterar comentario:
```typescript
// Top 5 operadores por MRR total
```

Linha ~241, alterar slice:
```typescript
.slice(0, 5)
```

- [ ] **Step 2: Alterar titulo do card**

Linha ~704, alterar de:
```tsx
Evolucao MRR por Colaborador (Top 6)
```
Para:
```tsx
Evolucao MRR por Colaborador (Top 5)
```

- [ ] **Step 3: Verificar compilacao**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`
Expected: `200`

- [ ] **Step 4: Commit**

```bash
git add client/src/components/squads/SquadDetalhe.tsx
git commit -m "refactor(squads): reduce evolution chart from top 6 to top 5 operators"
```

---

### Task 6: Verificacao visual e push final

- [ ] **Step 1: Reiniciar servidor**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; sleep 1; npm run dev &
```

- [ ] **Step 2: Verificar que a pagina carrega sem erros no console**

Abrir a pagina de Analise Squads > selecionar um squad > aba Colaboradores.
Verificar:
- Painel de 3 cards renderiza acima da tabela
- Ranking MRR mostra barras horizontais ordenadas
- Concentracao de Receita mostra top 3 com barras de %
- Alertas mostra badges vermelhos/amarelos ou mensagem verde
- Tabela mostra colunas Tendencia (sparklines) e % Squad (barras)
- Hover nas linhas funciona
- Separador visual apos 3a linha (se >= 4 operadores)
- Footer Total mostra celula vazia para Tendencia e "100%" para % Squad
- Grafico de evolucao mostra Top 5
- Tudo funciona em dark mode

- [ ] **Step 3: Push**

```bash
git push
```
