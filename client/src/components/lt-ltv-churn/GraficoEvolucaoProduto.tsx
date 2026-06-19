import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { fetchJson } from "./utils";
import type { EvolucaoProdutoData } from "./types";

const CORES = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#a855f7"];

export function GraficoEvolucaoProduto({
  metrica,
  agregador,
}: {
  metrica: "lt" | "ltv";
  agregador: "media" | "mediana";
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";

  const { data: evolucao, isLoading } = useQuery({
    queryKey: ["/api/lt-ltv-churn/evolucao-produto"],
    queryFn: () => fetchJson<EvolucaoProdutoData>("/api/lt-ltv-churn/evolucao-produto"),
  });

  if (isLoading || !evolucao) {
    return <div className="h-72 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />;
  }

  const chaveArray =
    agregador === "media" ? metrica : (`${metrica}_mediana` as keyof EvolucaoProdutoData);
  const chartData = evolucao[chaveArray] as Array<Record<string, number | string>>;

  return (
    <>
      <p className="mb-2 text-xs text-gray-500 dark:text-zinc-400">
        {agregador === "media" ? "Média" : "Mediana"} mensal da carteira ativa (snapshots) ·
        meses sem produto preenchido são omitidos
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} />
          <XAxis dataKey="mes" tick={{ fill: axis, fontSize: 11 }} />
          <YAxis
            tick={{ fill: axis, fontSize: 11 }}
            tickFormatter={(v) => (metrica === "lt" ? `${v}m` : formatCurrencyNoDecimals(v))}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? "#18181b" : "#ffffff",
              border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
              borderRadius: 8,
              color: isDark ? "#f4f4f5" : "#111827",
            }}
            formatter={(v: number) => (metrica === "lt" ? `${v}m` : formatCurrencyNoDecimals(v))}
          />
          <Legend />
          {evolucao.produtos.map((produto, i) => (
            <Line
              key={produto}
              dataKey={produto}
              type="monotone"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
              stroke={CORES[i % CORES.length]}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </>
  );
}
