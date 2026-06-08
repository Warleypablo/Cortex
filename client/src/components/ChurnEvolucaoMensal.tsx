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

const TOP_N_PRODUTOS = 7;

type Metrica = "cancelamentos" | "mrr_perdido";

export function ChurnEvolucaoMensal() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [metrica, setMetrica] = useState<Metrica>("cancelamentos");

  const { data, isLoading, isError } = useQuery<MensalResponse>({
    queryKey: ["/api/churn/produto-motivo/mensal"],
    queryFn: () => fetch("/api/churn/produto-motivo/mensal").then(r => r.json()),
  });

  const { chartData, produtos } = useMemo(() => {
    if (!data?.rows?.length) return { chartData: [], produtos: [] };

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

    const produtoTotais = new Map<string, number>();
    data.rows.forEach(r => {
      produtoTotais.set(r.produto, (produtoTotais.get(r.produto) || 0) + Number(r.cancelamentos));
    });
    const todosProdutos = Array.from(produtoTotais.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([p]) => p);

    const topProdutos = todosProdutos.slice(0, TOP_N_PRODUTOS);
    const temOutros = todosProdutos.length > TOP_N_PRODUTOS;
    const produtos = temOutros ? [...topProdutos, "Outros"] : topProdutos;

    const chartData = mesesOrdenados.map(mes => {
      const mesMap = aggMap.get(mes)!;
      const entry: Record<string, string | number> = {
        mes: mes.slice(0, 7),
        mesLabel: formatMes(mes),
      };
      topProdutos.forEach(p => {
        const v = mesMap.get(p);
        entry[p] = v ? v[metrica === "cancelamentos" ? "cancelamentos" : "mrr_perdido"] : 0;
      });
      if (temOutros) {
        let outros = 0;
        mesMap.forEach((v, p) => {
          if (!topProdutos.includes(p)) {
            outros += metrica === "cancelamentos" ? v.cancelamentos : v.mrr_perdido;
          }
        });
        entry["Outros"] = outros;
      }
      return entry;
    });

    return { chartData, produtos };
  }, [data, metrica]);

  function formatMes(isoDate: string): string {
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
                   "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const parts = isoDate.split("-");
    const m = parts[1];
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
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
            {produtos.map((produto, i) => (
              <Line
                key={produto}
                type="monotone"
                dataKey={produto}
                stroke={produto === "Outros" ? "#9ca3af" : PRODUTO_COLORS[i % PRODUTO_COLORS.length]}
                strokeWidth={produto === "Outros" ? 1.5 : 2}
                strokeDasharray={produto === "Outros" ? "4 3" : undefined}
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
