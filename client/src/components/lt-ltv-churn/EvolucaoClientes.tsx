import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { EvolucaoClientePonto } from "./types";

interface EvolucaoClientesData {
  serie: EvolucaoClientePonto[];
}

export function EvolucaoClientes() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";

  const { data: evolucao, isLoading } = useQuery({
    queryKey: ["/api/lt-ltv-churn/evolucao-clientes"],
    queryFn: () => fetchJson<EvolucaoClientesData>("/api/lt-ltv-churn/evolucao-clientes"),
  });

  if (isLoading || !evolucao) {
    return <div className="h-72 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />;
  }

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <CardTitle className="text-base">Evolução de LT/LTV dos clientes</CardTitle>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Carteira ativa de clientes (snapshots) · LT (meses, esq.) e LTV (R$, dir.) · linha cheia = média, tracejada = mediana
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={evolucao.serie} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="mes" tick={{ fill: axis, fontSize: 11 }} />
            <YAxis
              yAxisId="lt"
              tick={{ fill: axis, fontSize: 11 }}
              tickFormatter={(v) => `${v}m`}
            />
            <YAxis
              yAxisId="ltv"
              orientation="right"
              tick={{ fill: axis, fontSize: 11 }}
              tickFormatter={(v) => formatCurrencyNoDecimals(v)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#18181b" : "#ffffff",
                border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
                borderRadius: 8,
                color: isDark ? "#f4f4f5" : "#111827",
              }}
              formatter={(v: number, name: string) =>
                name.includes("LTV") ? formatCurrencyNoDecimals(v) : `${v} m`
              }
            />
            <Legend />
            <Line
              yAxisId="lt"
              dataKey="lt"
              stroke="#0ea5e9"
              strokeWidth={2}
              dot={{ r: 3 }}
              type="monotone"
              connectNulls
              name="LT médio (m)"
            />
            <Line
              yAxisId="ltv"
              dataKey="ltv"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ r: 3 }}
              type="monotone"
              connectNulls
              name="LTV médio"
            />
            <Line
              yAxisId="lt"
              dataKey="ltMediana"
              stroke="#0ea5e9"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={{ r: 2 }}
              type="monotone"
              connectNulls
              name="LT mediano (m)"
            />
            <Line
              yAxisId="ltv"
              dataKey="ltvMediana"
              stroke="#6366f1"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={{ r: 2 }}
              type="monotone"
              connectNulls
              name="LTV mediano"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
