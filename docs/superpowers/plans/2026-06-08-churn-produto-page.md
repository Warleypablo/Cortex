# Página Churn por Produto — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a página `/dashboard/churn-produto` com duas abas — "Produto × Motivo" (heatmap existente movido de ChurnDetalhamento) e "Evolução Mensal" (line chart por produto) — e removê-la de ChurnDetalhamento.

**Architecture:** Nova página `ChurnProduto.tsx` com dois componentes: `ChurnProdutoMotivo` (já existe, só move) e `ChurnEvolucaoMensal` (novo). Ambos os endpoints de API já existem. Nav-config e App.tsx recebem entradas simples. ChurnDetalhamento perde a aba "Produto × Motivo".

**Tech Stack:** TypeScript, React, TanStack Query, Recharts (LineChart), Tailwind CSS com `dark:` variants, `useSetPageInfo`, `useTheme`, `formatCurrencyNoDecimals` de `@/lib/utils`.

---

## Arquivos

| Ação | Arquivo |
|------|---------|
| Modificar | `shared/nav-config.ts` — permission key, route mapping, nav entry, label |
| Modificar | `client/src/App.tsx` — lazy import + rota `/dashboard/churn-produto` |
| Criar | `client/src/components/ChurnEvolucaoMensal.tsx` — line chart evolução mensal |
| Criar | `client/src/pages/ChurnProduto.tsx` — página com 2 abas |
| Modificar | `client/src/pages/ChurnDetalhamento.tsx` — remover aba "Produto × Motivo" |

---

### Task 1: Atualizar `shared/nav-config.ts`

**Files:**
- Modify: `shared/nav-config.ts`

- [ ] **Step 1: Adicionar permission key CHURN_PRODUTO**

Localizar a linha com `CAPACITY_TIMES: 'gestao.capacity_times',` (linha ~54) e adicionar antes do fechamento do objeto `GESTAO`:

```typescript
// Antes:
    CAPACITY_TIMES: 'gestao.capacity_times',
  },

// Depois:
    CAPACITY_TIMES: 'gestao.capacity_times',
    CHURN_PRODUTO: 'gestao.churn_produto',
  },
```

- [ ] **Step 2: Adicionar mapeamento em permissionsToRoutes**

Localizar `'/dashboard/churn-predicao': PERMISSION_KEYS.GESTAO.CHURN_PREDICAO,` (linha ~238) e adicionar logo abaixo:

```typescript
  '/dashboard/churn-produto': PERMISSION_KEYS.GESTAO.CHURN_PRODUTO,
```

- [ ] **Step 3: Adicionar entrada no menu Gestão**

Localizar `{ title: 'Detalhamento de Churn', url: '/dashboard/churn-detalhamento', icon: 'TrendingDown', permissionKey: PERMISSION_KEYS.GESTAO.CHURN_DETALHAMENTO },` (linha ~470) e adicionar logo depois:

```typescript
        { title: 'Churn por Produto', url: '/dashboard/churn-produto', icon: 'TrendingDown', permissionKey: PERMISSION_KEYS.GESTAO.CHURN_PRODUTO },
```

- [ ] **Step 4: Adicionar label de permissão**

Localizar `[PERMISSION_KEYS.GESTAO.CHURN_DETALHAMENTO]: 'Detalhamento de Churn',` (linha ~703) e adicionar logo depois:

```typescript
  [PERMISSION_KEYS.GESTAO.CHURN_PRODUTO]: 'Churn por Produto',
```

- [ ] **Step 5: Verificar TypeScript**

```bash
cd /Users/mac0267/Cortex
npx tsc --noEmit 2>&1 | grep "nav-config" | head -5
```

Esperado: nenhum erro de nav-config.

- [ ] **Step 6: Commit**

```bash
cd /Users/mac0267/Cortex
git add shared/nav-config.ts
git commit -m "feat(nav): adicionar entrada Churn por Produto em Gestão

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Adicionar rota em `client/src/App.tsx`

**Files:**
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Adicionar lazy import**

Localizar a linha com `const ChurnPredicao = lazyWithRetry(...)` (linha ~74) e adicionar depois:

```typescript
const ChurnProduto = lazyWithRetry(() => import("@/pages/ChurnProduto"));
```

- [ ] **Step 2: Adicionar rota**

Localizar a linha com `<Route path="/dashboard/churn-predicao">...` (linha ~321) e adicionar depois:

```tsx
      <Route path="/dashboard/churn-produto">{() => <ProtectedRoute path="/dashboard/churn-produto" component={ChurnProduto} />}</Route>
```

- [ ] **Step 3: Commit**

```bash
cd /Users/mac0267/Cortex
git add client/src/App.tsx
git commit -m "feat(routing): adicionar rota /dashboard/churn-produto

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Criar `client/src/components/ChurnEvolucaoMensal.tsx`

**Files:**
- Create: `client/src/components/ChurnEvolucaoMensal.tsx`

- [ ] **Step 1: Criar o componente**

Criar `/Users/mac0267/Cortex/client/src/components/ChurnEvolucaoMensal.tsx`:

```tsx
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid,
} from "recharts";

interface MensalRow {
  ano_mes: string;
  produto: string;
  motivo_cancelamento: string;
  cancelamentos: number;
  mrr_perdido: number;
  ticket_medio: number;
}

interface MensalResponse {
  rows: MensalRow[];
}

const PRODUTO_COLORS = [
  "#6d28d9", "#2563eb", "#059669", "#d97706", "#dc2626",
  "#7c3aed", "#0891b2", "#65a30d", "#ea580c", "#db2777",
  "#4f46e5", "#0284c7", "#16a34a", "#ca8a04", "#e11d48",
];

type Metrica = "cancelamentos" | "mrr_perdido";

export function ChurnEvolucaoMensal() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [metrica, setMetrica] = useState<Metrica>("cancelamentos");

  const { data, isLoading, isError } = useQuery<MensalResponse>({
    queryKey: ["/api/churn/produto-motivo/mensal"],
    queryFn: () => fetch("/api/churn/produto-motivo/mensal").then(r => r.json()),
  });

  // Agregar por (ano_mes, produto) — somar cancelamentos e mrr_perdido ignorando motivo
  const { chartData, produtos, meses } = useMemo(() => {
    if (!data?.rows?.length) return { chartData: [], produtos: [], meses: [] };

    const aggMap = new Map<string, Map<string, { cancelamentos: number; mrr_perdido: number }>>();

    data.rows.forEach(r => {
      if (!aggMap.has(r.ano_mes)) aggMap.set(r.ano_mes, new Map());
      const mesMap = aggMap.get(r.ano_mes)!;
      const cur = mesMap.get(r.produto) || { cancelamentos: 0, mrr_perdido: 0 };
      cur.cancelamentos += Number(r.cancelamentos);
      cur.mrr_perdido += Number(r.mrr_perdido);
      mesMap.set(r.produto, cur);
    });

    const mesesOrdenados = Array.from(aggMap.keys()).sort();

    // produtos ordenados por total de cancelamentos desc
    const produtoTotais = new Map<string, number>();
    data.rows.forEach(r => {
      produtoTotais.set(r.produto, (produtoTotais.get(r.produto) || 0) + Number(r.cancelamentos));
    });
    const produtosOrdenados = Array.from(produtoTotais.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([p]) => p);

    const chartData = mesesOrdenados.map(mes => {
      const mesMap = aggMap.get(mes)!;
      const entry: Record<string, string | number> = {
        mes: mes.slice(0, 7), // "2026-05"
        mesLabel: formatMes(mes),
      };
      produtosOrdenados.forEach(p => {
        const v = mesMap.get(p);
        entry[p] = v ? v[metrica === "cancelamentos" ? "cancelamentos" : "mrr_perdido"] : 0;
      });
      return entry;
    });

    return { chartData, produtos: produtosOrdenados, meses: mesesOrdenados };
  }, [data, metrica]);

  function formatMes(isoDate: string): string {
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
                   "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const [, m, ] = isoDate.split("-");
    const ano = isoDate.slice(2, 4);
    return `${meses[parseInt(m, 10) - 1]}/${ano}`;
  }

  const yFormatter = (v: number) =>
    metrica === "mrr_perdido" ? formatCurrencyNoDecimals(v) : String(v);

  const tooltipFormatter = (value: number, name: string) => {
    const formatted = metrica === "mrr_perdido"
      ? formatCurrencyNoDecimals(value)
      : String(value);
    return [formatted, name];
  };

  if (isLoading) {
    return (
      <div className="h-96 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
    );
  }

  if (isError || !data?.rows?.length) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Sem dados disponíveis.
      </div>
    );
  }

  return (
    <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-gray-900 dark:text-white">
            Cancelamentos por Produto ao Longo do Tempo
          </CardTitle>
          <div className="flex gap-1 p-1 rounded-lg bg-muted/50 border border-border/40">
            {(["cancelamentos", "mrr_perdido"] as Metrica[]).map(m => (
              <button
                key={m}
                onClick={() => setMetrica(m)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  metrica === m
                    ? "bg-white dark:bg-zinc-800 shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "cancelamentos" ? "Cancelamentos" : "MRR Perdido"}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Histórico completo disponível</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDark ? "#3f3f46" : "#e5e7eb"}
            />
            <XAxis
              dataKey="mesLabel"
              tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={yFormatter}
              tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }}
              width={metrica === "mrr_perdido" ? 80 : 40}
            />
            <Tooltip
              formatter={tooltipFormatter}
              contentStyle={{
                background: isDark ? "#18181b" : "#fff",
                border: isDark ? "1px solid #3f3f46" : "1px solid #e5e7eb",
                borderRadius: 6,
                fontSize: 12,
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
            />
            {produtos.map((produto, i) => (
              <Line
                key={produto}
                type="monotone"
                dataKey={produto}
                stroke={PRODUTO_COLORS[i % PRODUTO_COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /Users/mac0267/Cortex
npx tsc --noEmit 2>&1 | grep "ChurnEvolucao" | head -5
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
cd /Users/mac0267/Cortex
git add client/src/components/ChurnEvolucaoMensal.tsx
git commit -m "feat(ui): criar componente ChurnEvolucaoMensal

Line chart histórico com toggle cancelamentos/MRR por produto.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Criar `client/src/pages/ChurnProduto.tsx`

**Files:**
- Create: `client/src/pages/ChurnProduto.tsx`

- [ ] **Step 1: Criar a página**

Criar `/Users/mac0267/Cortex/client/src/pages/ChurnProduto.tsx`:

```tsx
import { useState } from "react";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, LineChart } from "lucide-react";
import { ChurnProdutoMotivo } from "@/components/ChurnProdutoMotivo";
import { ChurnEvolucaoMensal } from "@/components/ChurnEvolucaoMensal";

type ActiveTab = "produto-motivo" | "evolucao-mensal";

export default function ChurnProduto() {
  useSetPageInfo("Churn por Produto", "Análise de cancelamentos segmentada por produto");
  const [activeTab, setActiveTab] = useState<ActiveTab>("produto-motivo");

  return (
    <div className="space-y-6 p-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)}>
        <TabsList>
          <TabsTrigger value="produto-motivo" className="gap-2">
            <PieChart className="h-4 w-4" />
            Produto × Motivo
          </TabsTrigger>
          <TabsTrigger value="evolucao-mensal" className="gap-2">
            <LineChart className="h-4 w-4" />
            Evolução Mensal
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === "produto-motivo" && <ChurnProdutoMotivo />}
      {activeTab === "evolucao-mensal" && <ChurnEvolucaoMensal />}
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /Users/mac0267/Cortex
npx tsc --noEmit 2>&1 | grep "ChurnProduto\b" | head -5
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
cd /Users/mac0267/Cortex
git add client/src/pages/ChurnProduto.tsx
git commit -m "feat(ui): criar página ChurnProduto com abas Produto×Motivo e Evolução Mensal

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Limpar `client/src/pages/ChurnDetalhamento.tsx`

**Files:**
- Modify: `client/src/pages/ChurnDetalhamento.tsx`

- [ ] **Step 1: Remover import do ChurnProdutoMotivo**

Localizar e remover a linha (linha ~58):

```typescript
import { ChurnProdutoMotivo } from "@/components/ChurnProdutoMotivo";
```

- [ ] **Step 2: Remover "produto-motivo" do tipo do mainTab**

Localizar (linha ~495):

```typescript
const [mainTab, setMainTab] = useState<"analise" | "contratos" | "relatorio" | "consolidado" | "produto-motivo">("analise");
```

Substituir por:

```typescript
const [mainTab, setMainTab] = useState<"analise" | "contratos" | "relatorio" | "consolidado">("analise");
```

- [ ] **Step 3: Remover TabsTrigger "produto-motivo"**

Localizar e remover o bloco (linhas ~1904-1907):

```tsx
          <TabsTrigger value="produto-motivo" className="gap-2" data-testid="main-tab-produto-motivo">
            <PieChart className="h-4 w-4" />
            Produto × Motivo
          </TabsTrigger>
```

- [ ] **Step 4: Remover "produto-motivo" do cast do onValueChange**

Localizar (linha ~1890):

```tsx
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "analise" | "contratos" | "relatorio" | "consolidado" | "produto-motivo")}>
```

Substituir por:

```tsx
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "analise" | "contratos" | "relatorio" | "consolidado")}>
```

- [ ] **Step 5: Remover bloco condicional de renderização**

Localizar e remover o bloco (linhas ~1913-1914):

```tsx
      ) : mainTab === "produto-motivo" ? (
        <ChurnProdutoMotivo />
```

Após remover, o código deve ficar:

```tsx
      {mainTab === "relatorio" ? (
        <RelatorioSemanalChurn />
      ) : mainTab === "analise" ? (
```

- [ ] **Step 6: Verificar TypeScript**

```bash
cd /Users/mac0267/Cortex
npx tsc --noEmit 2>&1 | grep "ChurnDetalhamento\|ChurnProdutoMotivo" | head -10
```

Esperado: sem erros relacionados.

- [ ] **Step 7: Testar no browser**

Reiniciar o servidor se necessário:

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
sleep 5
```

Verificar:
1. `/dashboard/churn-detalhamento` — confirmar que a aba "Produto × Motivo" **não aparece mais**
2. `/dashboard/churn-produto` — confirmar que a página carrega com ambas as abas
3. Aba "Produto × Motivo" mostra o heatmap com dados reais
4. Aba "Evolução Mensal" mostra o line chart com linhas por produto e toggle funcional
5. Sidebar "Gestão" mostra "Churn por Produto" como item de menu

- [ ] **Step 8: Commit**

```bash
cd /Users/mac0267/Cortex
git add client/src/pages/ChurnDetalhamento.tsx
git commit -m "refactor(churn): remover aba Produto×Motivo de ChurnDetalhamento

Conteúdo movido para /dashboard/churn-produto.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

- [ ] **Step 9: Push**

```bash
cd /Users/mac0267/Cortex
git push origin main
```
