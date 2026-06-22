# Aba Churn Produto × Motivo — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar aba "Produto × Motivo" na página ChurnDetalhamento com heatmap interativo, drill-down por produto e tabela detalhada.

**Architecture:** Nova rota modular `server/routes/churnProdutoMotivo.ts` com dois endpoints; novo componente `client/src/components/churn-detalhamento/ChurnProdutoMotivo.tsx` montado lazily ao ativar a aba; integração na página existente `ChurnDetalhamento.tsx` adicionando um quarto item no switch de `mainTab`.

**Tech Stack:** TypeScript, React, TanStack Query, Recharts (BarChart horizontal), Tailwind CSS com `dark:` variants, Drizzle ORM (`sql` tagged template), `formatCurrencyNoDecimals` de `@/lib/utils`.

---

## Arquivos

| Ação | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Criar | `server/routes/churnProdutoMotivo.ts` | Endpoints `/api/churn/produto-motivo` e `/api/churn/produto-motivo/mensal` |
| Criar | `client/src/components/churn-detalhamento/ChurnProdutoMotivo.tsx` | Componente completo: cards, heatmap, drill-down, tabela |
| Modificar | `server/routes.ts` | Import + `registerChurnProdutoMotivoRoutes(app, db)` |
| Modificar | `client/src/pages/ChurnDetalhamento.tsx` | Import componente + nova aba `"produto-motivo"` no `mainTab` |

---

### Task 1: Rota de API `churnProdutoMotivo.ts`

**Files:**
- Create: `server/routes/churnProdutoMotivo.ts`

- [ ] **Step 1: Verificar que as views existem no banco**

```bash
psql "postgresql://cortex:dev123@localhost:5432/cortex_dev" -c "
SELECT COUNT(*) FROM cortex_core.vw_churn_detalhado_produto;
SELECT COUNT(*) FROM cortex_core.vw_churn_produto_motivo_mensal;"
```

Esperado: duas contagens > 0.

- [ ] **Step 2: Criar o arquivo da rota**

Criar `server/routes/churnProdutoMotivo.ts`:

```typescript
import type { Express } from "express";
import { sql } from "drizzle-orm";

interface ViewRow {
  produto: string;
  motivo_cancelamento: string;
  cancelamentos: string | number;
  mrr_perdido: string | number;
  ticket_medio: string | number;
  pct_dentro_produto: string | number;
  pct_total: string | number;
}

export function registerChurnProdutoMotivoRoutes(app: Express, db: any) {
  app.get("/api/churn/produto-motivo", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT produto, motivo_cancelamento, cancelamentos,
               mrr_perdido, ticket_medio, pct_dentro_produto, pct_total
        FROM cortex_core.vw_churn_detalhado_produto
        ORDER BY mrr_perdido DESC, cancelamentos DESC
      `);
      const data: ViewRow[] = result.rows;

      // Top 8 motivos por cancelamentos totais
      const motivoTotais = new Map<string, number>();
      data.forEach(r => {
        const m = r.motivo_cancelamento;
        motivoTotais.set(m, (motivoTotais.get(m) || 0) + Number(r.cancelamentos));
      });
      const motivosOrdenados = [...motivoTotais.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([m]) => m);
      const top8 = motivosOrdenados.slice(0, 8);
      const temOutros = motivosOrdenados.length > 8;
      const motivos = temOutros ? [...top8, "Outros"] : top8;

      // Produtos ordenados por mrr_perdido total
      const produtoMrr = new Map<string, number>();
      data.forEach(r => {
        produtoMrr.set(r.produto, (produtoMrr.get(r.produto) || 0) + Number(r.mrr_perdido));
      });
      const produtos = [...produtoMrr.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([p]) => p);

      // Agregar células — motivos fora do top8 viram "Outros"
      const cellMap = new Map<string, {
        cancelamentos: number; mrr_perdido: number; ticket_soma: number;
      }>();
      data.forEach(r => {
        const motivo = top8.includes(r.motivo_cancelamento) ? r.motivo_cancelamento : "Outros";
        const key = `${r.produto}|||${motivo}`;
        const cur = cellMap.get(key) || { cancelamentos: 0, mrr_perdido: 0, ticket_soma: 0 };
        const qtd = Number(r.cancelamentos);
        cur.cancelamentos += qtd;
        cur.mrr_perdido += Number(r.mrr_perdido);
        cur.ticket_soma += Number(r.ticket_medio) * qtd;
        cellMap.set(key, cur);
      });

      // Recalcular pct_dentro_produto após merge de "Outros"
      const prodTotais = new Map<string, number>();
      cellMap.forEach((v, key) => {
        const prod = key.split("|||")[0];
        prodTotais.set(prod, (prodTotais.get(prod) || 0) + v.cancelamentos);
      });
      const totalCancelamentos = [...prodTotais.values()].reduce((a, b) => a + b, 0);
      const totalMrr = [...cellMap.values()].reduce((a, v) => a + v.mrr_perdido, 0);
      const totalTicketSoma = [...cellMap.values()].reduce((a, v) => a + v.ticket_soma, 0);

      const celulas = [...cellMap.entries()].map(([key, v]) => {
        const [produto, motivo_cancelamento] = key.split("|||");
        const prodTotal = prodTotais.get(produto) || 1;
        return {
          produto,
          motivo_cancelamento,
          cancelamentos: v.cancelamentos,
          mrr_perdido: Math.round(v.mrr_perdido * 100) / 100,
          ticket_medio: v.cancelamentos > 0
            ? Math.round((v.ticket_soma / v.cancelamentos) * 100) / 100
            : 0,
          pct_dentro_produto: Math.round((v.cancelamentos / prodTotal) * 10000) / 100,
          pct_total: Math.round((v.cancelamentos / totalCancelamentos) * 10000) / 100,
        };
      });

      res.json({
        produtos,
        motivos,
        celulas,
        totais: {
          cancelamentos: totalCancelamentos,
          mrr_perdido: Math.round(totalMrr * 100) / 100,
          ticket_medio: totalCancelamentos > 0
            ? Math.round((totalTicketSoma / totalCancelamentos) * 100) / 100
            : 0,
        },
      });
    } catch (error) {
      console.error("[api] Error fetching churn produto-motivo:", error);
      res.status(500).json({ error: "Failed to fetch churn produto-motivo" });
    }
  });

  app.get("/api/churn/produto-motivo/mensal", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT
          to_char(ano_mes, 'YYYY-MM-DD') AS ano_mes,
          produto,
          motivo_cancelamento,
          cancelamentos,
          mrr_perdido,
          ticket_medio
        FROM cortex_core.vw_churn_produto_motivo_mensal
        ORDER BY ano_mes DESC, mrr_perdido DESC
      `);
      res.json({ rows: result.rows });
    } catch (error) {
      console.error("[api] Error fetching churn produto-motivo mensal:", error);
      res.status(500).json({ error: "Failed to fetch churn produto-motivo mensal" });
    }
  });
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/mac0267/Cortex
git add server/routes/churnProdutoMotivo.ts
git commit -m "feat(api): criar endpoints churn produto-motivo

GET /api/churn/produto-motivo — heatmap produto×motivo últimos 12m
GET /api/churn/produto-motivo/mensal — série temporal histórica

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Registrar rota em `routes.ts`

**Files:**
- Modify: `server/routes.ts`

- [ ] **Step 1: Adicionar import**

Em `server/routes.ts`, após a linha com `import { registerCreatorsRoutes }` (linha ~59), adicionar:

```typescript
import { registerChurnProdutoMotivoRoutes } from "./routes/churnProdutoMotivo";
```

- [ ] **Step 2: Registrar a rota**

Em `server/routes.ts`, após a linha com `registerLtLtvChurnRoutes(app, db);` (linha ~8174), adicionar:

```typescript
registerChurnProdutoMotivoRoutes(app, db);
```

- [ ] **Step 3: Testar o endpoint no banco local**

Reiniciar o servidor:
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
sleep 4
```

Testar:
```bash
curl -s http://localhost:3000/api/churn/produto-motivo | head -c 500
```

Esperado: JSON com campos `produtos`, `motivos`, `celulas`, `totais` — não erro 404 nem 500.

> Nota: o endpoint retorna 401 sem cookie de sessão no curl. Para testar autenticado, use o browser com sessão ativa ou adicione temporariamente um `console.log` antes do middleware `isAuthenticated` para confirmar que a rota é registrada.

- [ ] **Step 4: Commit**

```bash
cd /Users/mac0267/Cortex
git add server/routes.ts
git commit -m "feat(api): registrar rotas churnProdutoMotivo em routes.ts

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Componente `ChurnProdutoMotivo.tsx`

**Files:**
- Create: `client/src/components/churn-detalhamento/ChurnProdutoMotivo.tsx`

- [ ] **Step 1: Criar o componente**

Criar `client/src/components/churn-detalhamento/ChurnProdutoMotivo.tsx`:

```tsx
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { TrendingDown, DollarSign, Hash, ChevronDown, ChevronUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface Celula {
  produto: string;
  motivo_cancelamento: string;
  cancelamentos: number;
  mrr_perdido: number;
  ticket_medio: number;
  pct_dentro_produto: number;
  pct_total: number;
}

interface ProdutoMotivoData {
  produtos: string[];
  motivos: string[];
  celulas: Celula[];
  totais: { cancelamentos: number; mrr_perdido: number; ticket_medio: number };
}

function heatColor(pct: number, maxPct: number, isDark: boolean): string {
  if (maxPct === 0 || pct === 0) return "transparent";
  const t = Math.min(pct / maxPct, 1);
  if (isDark) {
    // zinc-900 → indigo-900
    const r = Math.round(24 + t * (49 - 24));
    const g = Math.round(24 + t * (46 - 24));
    const b = Math.round(27 + t * (129 - 27));
    return `rgb(${r},${g},${b})`;
  }
  // #f5f3ff → #6d28d9
  const r = Math.round(245 - t * (245 - 109));
  const g = Math.round(243 - t * (243 - 40));
  const b = Math.round(255 - t * (255 - 217));
  return `rgb(${r},${g},${b})`;
}

function textColor(pct: number, maxPct: number): string {
  const t = maxPct > 0 ? Math.min(pct / maxPct, 1) : 0;
  return t > 0.55 ? "text-white" : "text-gray-800 dark:text-zinc-200";
}

export function ChurnProdutoMotivo() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [produtoSelecionado, setProdutoSelecionado] = useState<string | null>(null);
  const [tabelaAberta, setTabelaAberta] = useState(false);
  const [ordenacao, setOrdenacao] = useState<{ col: keyof Celula; dir: "asc" | "desc" }>({
    col: "cancelamentos",
    dir: "desc",
  });

  const { data, isLoading, isError } = useQuery<ProdutoMotivoData>({
    queryKey: ["/api/churn/produto-motivo"],
    queryFn: () => fetch("/api/churn/produto-motivo").then(r => r.json()),
  });

  const maxPct = useMemo(() => {
    if (!data) return 0;
    return Math.max(...data.celulas.map(c => c.pct_dentro_produto));
  }, [data]);

  const celulaMap = useMemo(() => {
    if (!data) return new Map<string, Celula>();
    const m = new Map<string, Celula>();
    data.celulas.forEach(c => m.set(`${c.produto}|||${c.motivo_cancelamento}`, c));
    return m;
  }, [data]);

  const drillDown = useMemo(() => {
    if (!data || !produtoSelecionado) return [];
    return data.celulas
      .filter(c => c.produto === produtoSelecionado)
      .sort((a, b) => b.cancelamentos - a.cancelamentos);
  }, [data, produtoSelecionado]);

  const tabelaOrdenada = useMemo(() => {
    if (!data) return [];
    return [...data.celulas].sort((a, b) => {
      const va = a[ordenacao.col] as number;
      const vb = b[ordenacao.col] as number;
      return ordenacao.dir === "desc" ? vb - va : va - vb;
    });
  }, [data, ordenacao]);

  function toggleOrdenacao(col: keyof Celula) {
    setOrdenacao(prev =>
      prev.col === col
        ? { col, dir: prev.dir === "desc" ? "asc" : "desc" }
        : { col, dir: "desc" }
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Não foi possível carregar os dados.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Label período */}
      <p className="text-xs text-muted-foreground">Últimos 12 meses</p>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Total Cancelamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {data.totais.cancelamentos}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              MRR Perdido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrencyNoDecimals(data.totais.mrr_perdido)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Ticket Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrencyNoDecimals(data.totais.ticket_medio)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Heatmap */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardHeader>
          <CardTitle className="text-base text-gray-900 dark:text-white">
            Distribuição por Produto × Motivo
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            % de cancelamentos do produto atribuídos ao motivo. Clique em um produto para ver o detalhe.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left p-2 font-semibold text-gray-700 dark:text-zinc-300 min-w-[140px]">
                  Produto
                </th>
                {data.motivos.map(m => (
                  <th
                    key={m}
                    className="text-center p-2 font-medium text-gray-600 dark:text-zinc-400 min-w-[80px] max-w-[100px]"
                  >
                    <span className="block truncate" title={m}>{m}</span>
                  </th>
                ))}
                <th className="text-right p-2 font-semibold text-gray-700 dark:text-zinc-300 min-w-[80px]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {data.produtos.map(produto => {
                const isSelected = produtoSelecionado === produto;
                const prodTotal = data.celulas
                  .filter(c => c.produto === produto)
                  .reduce((a, c) => a + c.cancelamentos, 0);
                const prodMrr = data.celulas
                  .filter(c => c.produto === produto)
                  .reduce((a, c) => a + c.mrr_perdido, 0);

                return (
                  <tr
                    key={produto}
                    onClick={() => setProdutoSelecionado(isSelected ? null : produto)}
                    className={`cursor-pointer border-t border-gray-100 dark:border-zinc-800 transition-colors ${
                      isSelected
                        ? "bg-indigo-50 dark:bg-indigo-950/40"
                        : "hover:bg-gray-50 dark:hover:bg-zinc-800/40"
                    }`}
                  >
                    <td className="p-2 font-medium text-gray-900 dark:text-zinc-100">{produto}</td>
                    {data.motivos.map(motivo => {
                      const celula = celulaMap.get(`${produto}|||${motivo}`);
                      const pct = celula?.pct_dentro_produto ?? 0;
                      return (
                        <td key={motivo} className="p-1 text-center">
                          {pct > 0 ? (
                            <div
                              className={`rounded px-1 py-1.5 text-xs font-medium ${textColor(pct, maxPct)}`}
                              style={{ backgroundColor: heatColor(pct, maxPct, isDark) }}
                              title={`${celula?.cancelamentos ?? 0} churns · ${formatCurrencyNoDecimals(celula?.mrr_perdido ?? 0)}`}
                            >
                              {pct.toFixed(0)}%
                            </div>
                          ) : (
                            <span className="text-gray-300 dark:text-zinc-700">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-2 text-right">
                      <div className="font-semibold text-gray-900 dark:text-zinc-100">{prodTotal}</div>
                      <div className="text-gray-500 dark:text-zinc-500 text-[10px]">
                        {formatCurrencyNoDecimals(prodMrr)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Drill-down */}
      {produtoSelecionado && drillDown.length > 0 && (
        <Card className="bg-white dark:bg-zinc-900 border-indigo-200 dark:border-indigo-800">
          <CardHeader>
            <CardTitle className="text-base text-gray-900 dark:text-white">
              Motivos de churn — {produtoSelecionado}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(200, drillDown.length * 40)}>
              <BarChart
                data={drillDown}
                layout="vertical"
                margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="motivo_cancelamento"
                  width={160}
                  tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#374151" }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === "cancelamentos") return [value, "Cancelamentos"];
                    return [value, name];
                  }}
                  contentStyle={{
                    background: isDark ? "#18181b" : "#fff",
                    border: isDark ? "1px solid #3f3f46" : "1px solid #e5e7eb",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="cancelamentos" radius={[0, 4, 4, 0]}>
                  {drillDown.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i === 0 ? "#6d28d9" : i === 1 ? "#7c3aed" : i === 2 ? "#8b5cf6" : "#a78bfa"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 space-y-1">
              {drillDown.map(c => (
                <div key={c.motivo_cancelamento} className="flex justify-between text-xs text-muted-foreground">
                  <span>{c.motivo_cancelamento}</span>
                  <span>
                    {c.cancelamentos} churns · {formatCurrencyNoDecimals(c.mrr_perdido)} · {c.pct_dentro_produto.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela detalhada (collapsible) */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setTabelaAberta(v => !v)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-gray-900 dark:text-white">
              Dados completos
            </CardTitle>
            {tabelaAberta ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        {tabelaAberta && (
          <CardContent className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-zinc-700">
                  {(
                    [
                      { col: "produto" as const, label: "Produto" },
                      { col: "motivo_cancelamento" as const, label: "Motivo" },
                      { col: "cancelamentos" as const, label: "Cancelamentos" },
                      { col: "mrr_perdido" as const, label: "MRR Perdido" },
                      { col: "ticket_medio" as const, label: "Ticket Médio" },
                      { col: "pct_dentro_produto" as const, label: "% no Produto" },
                    ] as const
                  ).map(({ col, label }) => (
                    <th
                      key={col}
                      onClick={() => toggleOrdenacao(col)}
                      className="text-left p-2 font-semibold text-gray-600 dark:text-zinc-400 cursor-pointer hover:text-gray-900 dark:hover:text-zinc-100 whitespace-nowrap"
                    >
                      {label}
                      {ordenacao.col === col && (
                        <span className="ml-1">{ordenacao.dir === "desc" ? "↓" : "↑"}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tabelaOrdenada.map((c, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/40"
                  >
                    <td className="p-2 font-medium text-gray-900 dark:text-zinc-100">{c.produto}</td>
                    <td className="p-2 text-gray-700 dark:text-zinc-300">{c.motivo_cancelamento}</td>
                    <td className="p-2 text-right tabular-nums text-gray-700 dark:text-zinc-300">{c.cancelamentos}</td>
                    <td className="p-2 text-right tabular-nums text-gray-700 dark:text-zinc-300">
                      {formatCurrencyNoDecimals(c.mrr_perdido)}
                    </td>
                    <td className="p-2 text-right tabular-nums text-gray-700 dark:text-zinc-300">
                      {formatCurrencyNoDecimals(c.ticket_medio)}
                    </td>
                    <td className="p-2 text-right tabular-nums text-gray-700 dark:text-zinc-300">
                      {c.pct_dentro_produto.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mac0267/Cortex
git add client/src/components/churn-detalhamento/ChurnProdutoMotivo.tsx
git commit -m "feat(ui): criar componente ChurnProdutoMotivo

Heatmap produto×motivo com drill-down por produto e tabela
detalhada ordenável. Dark/light mode suportados.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Integrar aba em `ChurnDetalhamento.tsx`

**Files:**
- Modify: `client/src/pages/ChurnDetalhamento.tsx`

- [ ] **Step 1: Adicionar import do componente**

No início de `client/src/pages/ChurnDetalhamento.tsx`, após a linha com `import ChurnConsolidadoTrimestral` (linha ~57), adicionar:

```tsx
import { ChurnProdutoMotivo } from "@/components/churn-detalhamento/ChurnProdutoMotivo";
```

- [ ] **Step 2: Expandir o tipo do estado `mainTab`**

Localizar a linha (~494):
```tsx
const [mainTab, setMainTab] = useState<"analise" | "contratos" | "relatorio" | "consolidado">("analise");
```

Substituir por:
```tsx
const [mainTab, setMainTab] = useState<"analise" | "contratos" | "relatorio" | "consolidado" | "produto-motivo">("analise");
```

- [ ] **Step 3: Adicionar TabsTrigger no menu de abas**

Localizar o bloco de tabs (linha ~1889):
```tsx
<Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "analise" | "contratos" | "relatorio")}>
  <TabsList>
    <TabsTrigger value="analise" ...>
    <TabsTrigger value="contratos" ...>
    <TabsTrigger value="relatorio" ...>
  </TabsList>
</Tabs>
```

Substituir o `onValueChange` e adicionar o novo trigger:
```tsx
<Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "analise" | "contratos" | "relatorio" | "consolidado" | "produto-motivo")}>
  <TabsList>
    <TabsTrigger value="analise" className="gap-2" data-testid="main-tab-analise">
      <BarChart3 className="h-4 w-4" />
      Análise Detalhada
    </TabsTrigger>
    <TabsTrigger value="contratos" className="gap-2" data-testid="main-tab-contratos">
      <FileText className="h-4 w-4" />
      Contratos
    </TabsTrigger>
    <TabsTrigger value="relatorio" className="gap-2" data-testid="main-tab-relatorio">
      <CalendarRange className="h-4 w-4" />
      Relatório Semanal
    </TabsTrigger>
    <TabsTrigger value="produto-motivo" className="gap-2" data-testid="main-tab-produto-motivo">
      <PieChart className="h-4 w-4" />
      Produto × Motivo
    </TabsTrigger>
  </TabsList>
</Tabs>
```

> `PieChart` já está importado de `lucide-react` no topo do arquivo (linha ~29).

- [ ] **Step 4: Adicionar renderização condicional da nova aba**

Localizar o bloco de renderização condicional (logo após o `</Tabs>` das tabs, linha ~1906):
```tsx
{mainTab === "relatorio" ? (
  <RelatorioSemanalChurn />
) : mainTab === "analise" ? (
```

Adicionar um case para `produto-motivo` antes do `analise`:
```tsx
{mainTab === "relatorio" ? (
  <RelatorioSemanalChurn />
) : mainTab === "produto-motivo" ? (
  <ChurnProdutoMotivo />
) : mainTab === "analise" ? (
```

- [ ] **Step 5: Verificar que o TypeScript compila**

```bash
cd /Users/mac0267/Cortex
npx tsc --noEmit 2>&1 | grep -i "churnProduto\|ChurnProduto\|produto-motivo" | head -10
```

Esperado: nenhum erro relacionado aos novos arquivos.

- [ ] **Step 6: Testar no browser**

Iniciar o dev server se não estiver rodando:
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
sleep 5
```

Abrir `http://localhost:3000/dashboard/churn-detalhamento` no browser, clicar na aba "Produto × Motivo" e verificar:
- Cards de resumo com números reais
- Heatmap com produtos nas linhas e motivos nas colunas
- Células coloridas proporcionalmente
- Clique em produto exibe drill-down com bar chart
- Segundo clique no mesmo produto deseleciona e remove drill-down
- "Dados completos" abre a tabela detalhada com ordenação
- Dark mode funciona (testar alternando o tema)

- [ ] **Step 7: Commit**

```bash
cd /Users/mac0267/Cortex
git add client/src/pages/ChurnDetalhamento.tsx
git commit -m "feat(ui): integrar aba Produto × Motivo em ChurnDetalhamento

Nova aba com heatmap diagnóstico de causas de churn por produto.
Mount lazy — só carrega ao ativar a aba.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
