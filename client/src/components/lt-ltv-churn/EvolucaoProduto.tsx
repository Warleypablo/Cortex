import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export function EvolucaoProduto() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";

  const [metrica, setMetrica] = useState<"lt" | "ltv">("lt");

  const { data: evolucao, isLoading } = useQuery({
    queryKey: ["/api/lt-ltv-churn/evolucao-produto"],
    queryFn: () => fetchJson<EvolucaoProdutoData>("/api/lt-ltv-churn/evolucao-produto"),
  });

  if (isLoading || !evolucao) {
    return <div className="h-72 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />;
  }

  const chartData = metrica === "lt" ? evolucao.lt : evolucao.ltv;

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Evolução de LT/LTV por produto</CardTitle>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Média mensal da carteira ativa (snapshots) · meses sem produto preenchido são omitidos
            </p>
          </div>
          <Select value={metrica} onValueChange={(v) => setMetrica(v as "lt" | "ltv")}>
            <SelectTrigger className="w-[170px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lt">LT médio (meses)</SelectItem>
              <SelectItem value="ltv">LTV médio (R$)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis
              dataKey="mes"
              tick={{ fill: axis, fontSize: 11 }}
            />
            <YAxis
              tick={{ fill: axis, fontSize: 11 }}
              tickFormatter={(v) =>
                metrica === "lt" ? `${v}m` : formatCurrencyNoDecimals(v)
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#18181b" : "#ffffff",
                border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
                borderRadius: 8,
                color: isDark ? "#f4f4f5" : "#111827",
              }}
              formatter={(v: number) =>
                metrica === "lt" ? `${v}m` : formatCurrencyNoDecimals(v)
              }
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
      </CardContent>
    </Card>
  );
}
