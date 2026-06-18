# Churn Produto — Taxa Total + Drill-down Drawer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar toggle "Taxa Total" ao gráfico Histórico Mensal por Produto, filtrar meses vazios em modos de taxa, e habilitar drill-down por clique em barra com drawer lateral mostrando breakdown por squad/operador, LTV mediano e lista de contratos.

**Architecture:** Novo endpoint `/api/churn/produto-mes-detalhe` retorna agregados e lista de contratos para produto+mês. Novo componente `ChurnDetalheDrawer` consome esse endpoint via React Query e renderiza um `Sheet` do shadcn. `ChurnEvolucaoMensal` recebe 3 modificações: tipo `Metrica` expandido, useMemo para Taxa Total, click handler nas barras.

**Tech Stack:** React Query, Recharts (PieChart), shadcn Sheet, Drizzle `sql` template, PostgreSQL `PERCENTILE_CONT`

---

## Arquivos

| Ação | Caminho |
|------|---------|
| Criar | `client/src/components/ChurnDetalheDrawer.tsx` |
| Modificar | `client/src/components/ChurnEvolucaoMensal.tsx` |
| Modificar | `server/routes/churnProdutoMotivo.ts` |

---

## Task 1: Endpoint `/api/churn/produto-mes-detalhe`

**Arquivos:**
- Modify: `server/routes/churnProdutoMotivo.ts` — inserir antes do endpoint `/api/churn/produto-motivo/mensal` (linha ~424)

- [ ] **1.1 — Adicionar o endpoint**

Inserir o bloco abaixo logo antes da linha `app.get("/api/churn/produto-motivo/mensal", ...`:

```typescript
  app.get("/api/churn/produto-mes-detalhe", async (req, res) => {
    const produto = String(req.query.produto || "");
    const mes = String(req.query.mes || ""); // formato YYYY-MM
    if (!produto || !mes) {
      return res.status(400).json({ error: "produto e mes são obrigatórios" });
    }
    const mesDate = `${mes}-01`;
    const SQUADS_EXCLUIDOS = ['🌟 Aurea','🗝️ Bloomfield','🔥 Chama','🏹 Hunters','👾 Squad X','👑 Supreme','🖥️ Tech','🚀 Turbo Interno'];

    try {
      // Query 1 — totais + LTV mediano
      const totaisResult = await db.execute(sql`
        SELECT
          COUNT(*)::int AS total_cancelamentos,
          COALESCE(SUM(valor_r), 0)::numeric AS total_mrr,
          COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY
            valor_r * GREATEST(
              EXTRACT(YEAR FROM AGE(data_solicitacao_encerramento,
                COALESCE(data_primeiro_pagamento, data_criado))) * 12
              + EXTRACT(MONTH FROM AGE(data_solicitacao_encerramento,
                COALESCE(data_primeiro_pagamento, data_criado))),
              1
            )
          ), 0)::numeric AS ltv_mediano
        FROM cortex_core.vw_cup_churn_ajustado
        WHERE valor_r > 0
          AND data_solicitacao_encerramento IS NOT NULL
          AND DATE_TRUNC('month', data_solicitacao_encerramento)::date = ${mesDate}::date
          AND COALESCE(abonar_churn, '') != 'Sim'
          AND COALESCE(motivo_cancelamento, '') NOT IN ('Inadimplente 1º Mês','Não começou','Erro na Venda')
          AND squad NOT IN (${SQUADS_EXCLUIDOS[0]},${SQUADS_EXCLUIDOS[1]},${SQUADS_EXCLUIDOS[2]},${SQUADS_EXCLUIDOS[3]},${SQUADS_EXCLUIDOS[4]},${SQUADS_EXCLUIDOS[5]},${SQUADS_EXCLUIDOS[6]},${SQUADS_EXCLUIDOS[7]})
          AND COALESCE(produto, 'Não Identificado') = ${produto}
      `);

      // Query 2 — por squad
      const squadResult = await db.execute(sql`
        SELECT
          COALESCE(squad, 'Não Informado') AS squad,
          COUNT(*)::int AS cancelamentos,
          COALESCE(SUM(valor_r), 0)::numeric AS mrr
        FROM cortex_core.vw_cup_churn_ajustado
        WHERE valor_r > 0
          AND data_solicitacao_encerramento IS NOT NULL
          AND DATE_TRUNC('month', data_solicitacao_encerramento)::date = ${mesDate}::date
          AND COALESCE(abonar_churn, '') != 'Sim'
          AND COALESCE(motivo_cancelamento, '') NOT IN ('Inadimplente 1º Mês','Não começou','Erro na Venda')
          AND squad NOT IN (${SQUADS_EXCLUIDOS[0]},${SQUADS_EXCLUIDOS[1]},${SQUADS_EXCLUIDOS[2]},${SQUADS_EXCLUIDOS[3]},${SQUADS_EXCLUIDOS[4]},${SQUADS_EXCLUIDOS[5]},${SQUADS_EXCLUIDOS[6]},${SQUADS_EXCLUIDOS[7]})
          AND COALESCE(produto, 'Não Identificado') = ${produto}
        GROUP BY COALESCE(squad, 'Não Informado')
        ORDER BY cancelamentos DESC
      `);

      // Query 3 — por operador
      const operadorResult = await db.execute(sql`
        SELECT
          COALESCE(responsavel_geral, 'Não Informado') AS operador,
          COUNT(*)::int AS cancelamentos,
          COALESCE(SUM(valor_r), 0)::numeric AS mrr
        FROM cortex_core.vw_cup_churn_ajustado
        WHERE valor_r > 0
          AND data_solicitacao_encerramento IS NOT NULL
          AND DATE_TRUNC('month', data_solicitacao_encerramento)::date = ${mesDate}::date
          AND COALESCE(abonar_churn, '') != 'Sim'
          AND COALESCE(motivo_cancelamento, '') NOT IN ('Inadimplente 1º Mês','Não começou','Erro na Venda')
          AND squad NOT IN (${SQUADS_EXCLUIDOS[0]},${SQUADS_EXCLUIDOS[1]},${SQUADS_EXCLUIDOS[2]},${SQUADS_EXCLUIDOS[3]},${SQUADS_EXCLUIDOS[4]},${SQUADS_EXCLUIDOS[5]},${SQUADS_EXCLUIDOS[6]},${SQUADS_EXCLUIDOS[7]})
          AND COALESCE(produto, 'Não Identificado') = ${produto}
        GROUP BY COALESCE(responsavel_geral, 'Não Informado')
        ORDER BY cancelamentos DESC
      `);

      // Query 4 — lista de contratos
      const contratosResult = await db.execute(sql`
        SELECT
          COALESCE(nome, 'Sem nome') AS nome,
          COALESCE(squad, 'Não Informado') AS squad,
          COALESCE(responsavel_geral, 'Não Informado') AS operador,
          valor_r,
          COALESCE(motivo_cancelamento, 'Não Informado') AS motivo
        FROM cortex_core.vw_cup_churn_ajustado
        WHERE valor_r > 0
          AND data_solicitacao_encerramento IS NOT NULL
          AND DATE_TRUNC('month', data_solicitacao_encerramento)::date = ${mesDate}::date
          AND COALESCE(abonar_churn, '') != 'Sim'
          AND COALESCE(motivo_cancelamento, '') NOT IN ('Inadimplente 1º Mês','Não começou','Erro na Venda')
          AND squad NOT IN (${SQUADS_EXCLUIDOS[0]},${SQUADS_EXCLUIDOS[1]},${SQUADS_EXCLUIDOS[2]},${SQUADS_EXCLUIDOS[3]},${SQUADS_EXCLUIDOS[4]},${SQUADS_EXCLUIDOS[5]},${SQUADS_EXCLUIDOS[6]},${SQUADS_EXCLUIDOS[7]})
          AND COALESCE(produto, 'Não Identificado') = ${produto}
        ORDER BY valor_r DESC
      `);

      const totais = totaisResult.rows[0] as { total_cancelamentos: number; total_mrr: string; ltv_mediano: string };
      const totalCancelamentos = Number(totais.total_cancelamentos) || 0;

      const squads = (squadResult.rows as { squad: string; cancelamentos: number; mrr: string }[]).map(r => ({
        squad: r.squad,
        cancelamentos: Number(r.cancelamentos),
        mrr: Number(r.mrr),
        pct: totalCancelamentos > 0 ? Math.round(Number(r.cancelamentos) / totalCancelamentos * 10000) / 100 : 0,
      }));

      const operadores = (operadorResult.rows as { operador: string; cancelamentos: number; mrr: string }[]).map(r => ({
        operador: r.operador,
        cancelamentos: Number(r.cancelamentos),
        mrr: Number(r.mrr),
        pct: totalCancelamentos > 0 ? Math.round(Number(r.cancelamentos) / totalCancelamentos * 10000) / 100 : 0,
      }));

      res.json({
        produto,
        mes,
        total_cancelamentos: totalCancelamentos,
        total_mrr: Number(totais.total_mrr),
        ltv_mediano: Number(totais.ltv_mediano),
        squads,
        operadores,
        contratos: contratosResult.rows,
      });
    } catch (error) {
      console.error("[produto-mes-detalhe] erro:", error);
      res.status(500).json({ error: "Failed to fetch produto-mes-detalhe" });
    }
  });
```

- [ ] **1.2 — Reiniciar o servidor e validar o endpoint via curl**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; sleep 1
npm run dev > /tmp/cortex-dev.log 2>&1 &
sleep 6
# Testar direto no banco para validar a query (auth não disponível via curl)
PGPASSWORD=dev123 psql -h localhost -U cortex -d cortex_dev -c "
SELECT COUNT(*)::int, COALESCE(SUM(valor_r),0)::numeric
FROM cortex_core.vw_cup_churn_ajustado
WHERE DATE_TRUNC('month', data_solicitacao_encerramento)::date = '2026-03-01'
  AND COALESCE(produto,'Não Identificado') = 'Performance'
  AND valor_r > 0
  AND COALESCE(abonar_churn,'') != 'Sim'
  AND COALESCE(motivo_cancelamento,'') NOT IN ('Inadimplente 1º Mês','Não começou','Erro na Venda');
"
```

Esperado: linha com contagem > 0 e MRR > 0 para Performance/Mar-26.

- [ ] **1.3 — Commit**

```bash
git add server/routes/churnProdutoMotivo.ts
git commit -m "feat(churn): endpoint produto-mes-detalhe com squads, operadores, LTV e contratos

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Componente `ChurnDetalheDrawer`

**Arquivos:**
- Create: `client/src/components/ChurnDetalheDrawer.tsx`

- [ ] **2.1 — Criar o arquivo**

```typescript
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface SquadRow { squad: string; cancelamentos: number; mrr: number; pct: number; }
interface OperadorRow { operador: string; cancelamentos: number; mrr: number; pct: number; }
interface ContratoRow { nome: string; squad: string; operador: string; valor_r: number; motivo: string; }

interface DetalheData {
  produto: string;
  mes: string;
  total_cancelamentos: number;
  total_mrr: number;
  ltv_mediano: number;
  squads: SquadRow[];
  operadores: OperadorRow[];
  contratos: ContratoRow[];
}

const PIE_COLORS = [
  "#6d28d9","#2563eb","#059669","#d97706","#dc2626",
  "#7c3aed","#0891b2","#65a30d","#ea580c","#db2777",
];

function formatMesLabel(mes: string): string {
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const [ano, m] = mes.split("-");
  return `${meses[parseInt(m) - 1]}/${ano.slice(2)}`;
}

interface Props {
  produto: string;
  mes: string | null;
  onClose: () => void;
}

function PieLegend({ items, colors }: { items: { label: string; pct: number }[]; colors: string[] }) {
  return (
    <div className="space-y-1 mt-2">
      {items.slice(0, 6).map((item, i) => (
        <div key={item.label} className="flex items-center gap-1.5 text-xs">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: colors[i % colors.length] }}
          />
          <span className="truncate text-gray-700 dark:text-zinc-300 flex-1" title={item.label}>
            {item.label}
          </span>
          <span className="font-medium text-gray-900 dark:text-white tabular-nums">
            {item.pct.toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

export function ChurnDetalheDrawer({ produto, mes, onClose }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { data, isLoading } = useQuery<DetalheData>({
    queryKey: ["/api/churn/produto-mes-detalhe", produto, mes],
    queryFn: () =>
      fetch(`/api/churn/produto-mes-detalhe?produto=${encodeURIComponent(produto)}&mes=${mes}`)
        .then(r => { if (!r.ok) throw new Error("API error"); return r.json(); }),
    enabled: !!mes && !!produto,
  });

  const tooltipStyle = {
    background: isDark ? "#18181b" : "#fff",
    border: isDark ? "1px solid #3f3f46" : "1px solid #e5e7eb",
    borderRadius: 6,
    fontSize: 11,
  };

  return (
    <Sheet open={!!mes} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className="w-[520px] sm:max-w-[520px] overflow-y-auto bg-white dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-700 p-0"
      >
        <SheetHeader className="border-b border-gray-200 dark:border-zinc-700 px-5 py-4">
          <SheetTitle className="text-base font-semibold text-gray-900 dark:text-white">
            {produto} — {mes ? formatMesLabel(mes) : ""}
          </SheetTitle>
          {data && !isLoading && (
            <p className="text-sm text-muted-foreground">
              {data.total_cancelamentos} contratos · {formatCurrencyNoDecimals(data.total_mrr)} perdidos
            </p>
          )}
        </SheetHeader>

        <div className="px-5 py-4">
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-36 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800" />
              ))}
            </div>
          )}

          {data && !isLoading && (
            <div className="space-y-6">

              {/* Pies: Squad e Operador */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                    Por Squad
                  </p>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={data.squads}
                        dataKey="cancelamentos"
                        nameKey="squad"
                        cx="50%"
                        cy="50%"
                        outerRadius={62}
                        strokeWidth={0}
                      >
                        {data.squads.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number, name: string) => [`${v} contratos`, name]}
                        contentStyle={tooltipStyle}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <PieLegend
                    items={data.squads.map(s => ({ label: s.squad, pct: s.pct }))}
                    colors={PIE_COLORS}
                  />
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                    Por Operador
                  </p>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={data.operadores}
                        dataKey="cancelamentos"
                        nameKey="operador"
                        cx="50%"
                        cy="50%"
                        outerRadius={62}
                        strokeWidth={0}
                      >
                        {data.operadores.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number, name: string) => [`${v} contratos`, name]}
                        contentStyle={tooltipStyle}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <PieLegend
                    items={data.operadores.map(o => ({ label: o.operador, pct: o.pct }))}
                    colors={PIE_COLORS}
                  />
                </div>
              </div>

              {/* LTV Mediano */}
              <div className="rounded-lg bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 p-4">
                <p className="text-xs text-muted-foreground mb-1">LTV Mediano da Safra Perdida</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrencyNoDecimals(data.ltv_mediano)}
                </p>
              </div>

              {/* Contratos perdidos */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                  Contratos Perdidos ({data.contratos.length})
                </p>
                <div className="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-zinc-800/60">
                        <th className="text-left p-2 font-medium text-gray-600 dark:text-zinc-400">Cliente</th>
                        <th className="text-left p-2 font-medium text-gray-600 dark:text-zinc-400">Squad</th>
                        <th className="text-right p-2 font-medium text-gray-600 dark:text-zinc-400">MRR</th>
                        <th className="text-left p-2 font-medium text-gray-600 dark:text-zinc-400">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.contratos.map((c, i) => (
                        <tr key={i} className="border-t border-gray-100 dark:border-zinc-800">
                          <td className="p-2 text-gray-900 dark:text-zinc-100 max-w-[140px] truncate" title={c.nome}>
                            {c.nome}
                          </td>
                          <td className="p-2 text-gray-600 dark:text-zinc-400 max-w-[90px] truncate" title={c.squad}>
                            {c.squad}
                          </td>
                          <td className="p-2 text-right font-medium text-gray-900 dark:text-zinc-100 tabular-nums">
                            {formatCurrencyNoDecimals(c.valor_r)}
                          </td>
                          <td className="p-2 text-gray-600 dark:text-zinc-400 max-w-[110px] truncate" title={c.motivo}>
                            {c.motivo}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **2.2 — Commit**

```bash
git add client/src/components/ChurnDetalheDrawer.tsx
git commit -m "feat(churn): componente ChurnDetalheDrawer com pies, LTV e lista de contratos

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Modificações em `ChurnEvolucaoMensal.tsx`

**Arquivos:**
- Modify: `client/src/components/ChurnEvolucaoMensal.tsx`

**Mudanças necessárias (em ordem):**

### 3.1 — Adicionar import do drawer

- [ ] Adicionar no topo do arquivo, após os imports existentes de componentes:

```typescript
import { ChurnDetalheDrawer } from "@/components/ChurnDetalheDrawer";
```

### 3.2 — Expandir o tipo `Metrica`

- [ ] Linha 34 — alterar:

```typescript
// DE:
type Metrica = "cancelamentos" | "mrr_perdido" | "taxa_churn";

// PARA:
type Metrica = "cancelamentos" | "mrr_perdido" | "taxa_churn" | "taxa_total_produto";
```

### 3.3 — Adicionar estado `selectedMes`

- [ ] Após `const [highlightMotivo, setHighlightMotivo] = useState<string | null>(null);` (linha ~43), adicionar:

```typescript
const [selectedMes, setSelectedMes] = useState<string | null>(null);
```

### 3.4 — Habilitar fetch `taxaProdutoData` para o novo modo

- [ ] Linha ~53 — alterar a prop `enabled` do useQuery de `taxaProdutoData`:

```typescript
// DE:
enabled: metricaLinha === "taxa_churn" || metrica === "taxa_churn",

// PARA:
enabled: metricaLinha === "taxa_churn" || metrica === "taxa_churn" || metrica === "taxa_total_produto",
```

### 3.5 — Adicionar `mes` aos dados de `produtoChartData` e `produtoMotivoTaxaChartData`

O click handler precisa do campo `mes` (YYYY-MM) no payload de cada ponto. O `produtoChartData` usa `ano_mes` de `mensalRow` que vem como "YYYY-MM-DD" do backend.

- [ ] No `useMemo` de `produtoChartData` (linha ~329), trocar:

```typescript
// DE:
const produtoChartData = mesesOrdenados.map(mes => ({
  mesLabel: formatMes(mes),
  ...mesAgg.get(mes),
}));

// PARA:
const produtoChartData = mesesOrdenados.map(mes => ({
  mes: mes.slice(0, 7),
  mesLabel: formatMes(mes),
  ...mesAgg.get(mes),
}));
```

- [ ] No `useMemo` de `produtoMotivoTaxaChartData` (linha ~289), trocar:

```typescript
// DE:
const entry: Record<string, number | string> = { mesLabel: formatMes(mes) };

// PARA:
const entry: Record<string, number | string> = { mes: mes.slice(0, 7), mesLabel: formatMes(mes) };
```

### 3.6 — Novo useMemo `produtoTaxaTotalChartData`

- [ ] Após o bloco de `produtoMotivoTaxaChartData` (linha ~300), adicionar:

```typescript
const produtoTaxaTotalChartData = useMemo(() => {
  if (!taxaProdutoData?.rows?.length || !produtoEfetivo) return [];
  return taxaProdutoData.rows
    .filter(r => r.produto === produtoEfetivo && Number(r.mrr_churn) > 0)
    .map(r => ({
      mes: r.mes,
      mesLabel: formatMes(r.mes + "-01"),
      taxa: Math.min(Number(r.taxa ?? 0), 100),
    }))
    .sort((a, b) => a.mes.localeCompare(b.mes));
}, [taxaProdutoData, produtoEfetivo]);
```

### 3.7 — Atualizar os formatters para o novo modo

- [ ] Trocar `yFormatter` e `tooltipFormatter` existentes:

```typescript
const yFormatter = (v: number) => {
  if (metrica === "mrr_perdido") return formatCurrencyNoDecimals(v);
  if (metrica === "taxa_churn" || metrica === "taxa_total_produto") return `${v.toFixed(1)}%`;
  return String(v);
};

const tooltipFormatter = (value: number, name: string) => {
  if (metrica === "mrr_perdido") return [formatCurrencyNoDecimals(value), name];
  if (metrica === "taxa_churn" || metrica === "taxa_total_produto") return [`${Number(value).toFixed(2)}%`, name];
  return [String(value), name];
};
```

### 3.8 — Substituir o bloco do Card "Histórico Mensal por Produto"

Este é o passo maior. Substituir o conteúdo do primeiro `<Card>` (linhas ~387–467) pelo bloco abaixo, que inclui:
- Toggle com 4 opções
- Filtro de meses vazios no modo taxa
- Click handler nas barras
- Bars condicionais por modo

- [ ] Substituir o Card inteiro:

```tsx
<Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
  <CardHeader>
    <div className="flex items-center justify-between flex-wrap gap-3">
      <CardTitle className="text-base text-gray-900 dark:text-white">
        Histórico Mensal por Produto
      </CardTitle>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 p-1 rounded-lg bg-muted/50 border border-border/40">
          {(["cancelamentos", "mrr_perdido", "taxa_churn", "taxa_total_produto"] as Metrica[]).map(m => (
            <button
              key={m}
              onClick={() => setMetrica(m)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                metrica === m
                  ? "bg-white dark:bg-zinc-800 shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "cancelamentos" ? "Contratos"
                : m === "mrr_perdido" ? "MRR Perdido"
                : m === "taxa_churn" ? "% Churn"
                : "Taxa Total"}
            </button>
          ))}
        </div>
        <select
          value={produtoEfetivo}
          onChange={e => setProdutoSelecionado(e.target.value)}
          className="text-xs px-2 py-1.5 rounded-md border border-border/60 bg-white dark:bg-zinc-800 text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
        >
          {todosProdutos.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
    </div>
    <p className="text-xs text-muted-foreground">
      {metrica === "taxa_total_produto"
        ? "Taxa de churn total do produto por mês"
        : "Cancelamentos por motivo mês a mês"}
    </p>
  </CardHeader>
  <CardContent>
    {(metrica === "taxa_churn" && !produtoMotivoTaxaChartData) ||
     (metrica === "taxa_total_produto" && isFetchingTaxa && !taxaProdutoData) ? (
      <div className="h-80 flex items-center justify-center text-sm text-muted-foreground animate-pulse">
        Calculando taxas...
      </div>
    ) : (
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={
            metrica === "taxa_churn"
              ? (produtoMotivoTaxaChartData ?? produtoChartData).filter(entry =>
                  Object.keys(entry)
                    .filter(k => k !== "mes" && k !== "mesLabel")
                    .some(k => Number(entry[k]) > 0)
                )
              : metrica === "taxa_total_produto"
              ? produtoTaxaTotalChartData
              : produtoChartData
          }
          margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
          onClick={chartData => {
            const mes = chartData?.activePayload?.[0]?.payload?.mes as string | undefined;
            if (mes) setSelectedMes(mes);
          }}
          style={{ cursor: "pointer" }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#3f3f46" : "#e5e7eb"} vertical={false} />
          <XAxis
            dataKey="mesLabel"
            tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={yFormatter}
            tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }}
            width={metrica === "mrr_perdido" ? 80 : 45}
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
          {metrica !== "taxa_total_produto" && (
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
          )}
          {metrica === "taxa_total_produto" ? (
            <Bar
              dataKey="taxa"
              name={produtoEfetivo}
              fill={PRODUTO_COLORS[0]}
              radius={[3, 3, 0, 0]}
            />
          ) : (
            motivosBarras.map((motivo, i) => (
              <Bar
                key={motivo}
                dataKey={motivo}
                stackId="a"
                fill={motivo === "Outros" ? "#9ca3af" : PRODUTO_COLORS[i % PRODUTO_COLORS.length]}
                radius={i === motivosBarras.length - 1 ? [3, 3, 0, 0] : undefined}
              />
            ))
          )}
        </BarChart>
      </ResponsiveContainer>
    )}
  </CardContent>
</Card>
```

### 3.9 — Adicionar `<ChurnDetalheDrawer>` no final do JSX

- [ ] Antes do fechamento final `</div>` do return (última linha antes do `}`), adicionar:

```tsx
<ChurnDetalheDrawer
  produto={produtoEfetivo}
  mes={selectedMes}
  onClose={() => setSelectedMes(null)}
/>
```

### 3.10 — Commit

- [ ] Executar:

```bash
git add client/src/components/ChurnEvolucaoMensal.tsx
git commit -m "feat(churn): toggle Taxa Total, filtro meses vazios e drill-down por clique na barra

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Verificação visual e push

- [ ] **4.1 — Reiniciar o servidor**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null
npm run dev > /tmp/cortex-dev.log 2>&1 &
sleep 6 && tail -3 /tmp/cortex-dev.log
```

Esperado: sem erros de TypeScript, "serving on port 3000".

- [ ] **4.2 — Verificar no browser**

Abrir `http://localhost:3000` → navegar até a página de Churn → aba com o gráfico "Histórico Mensal por Produto".

Checklist:
- [ ] Toggle mostra 4 opções: Contratos · MRR Perdido · % Churn · Taxa Total
- [ ] Ao clicar "% Churn": meses sem dados some da esquerda
- [ ] Ao clicar "Taxa Total": gráfico mostra uma barra única por mês (sem legenda de motivos)
- [ ] Ao clicar qualquer barra: drawer desliza da direita com título `[Produto] — [Mês]`
- [ ] Drawer mostra dois pies (Squad e Operador), LTV Mediano e tabela de contratos
- [ ] Fechar o drawer clicando no X ou fora: gráfico volta ao normal
- [ ] Dark mode: drawer respeitando `dark:` classes

- [ ] **4.3 — Push**

```bash
git push
```
