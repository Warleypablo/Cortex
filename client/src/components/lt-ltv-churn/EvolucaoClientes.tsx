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

  const [metrica, setMetrica] = useState<"lt" | "ltv">("lt");

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Evolução de LT/LTV dos clientes</CardTitle>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Média mensal da carteira ativa de clientes (snapshots)
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
          <LineChart data={evolucao.serie} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
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
            <Line
              dataKey={metrica}
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ r: 3 }}
              type="monotone"
              connectNulls
              name={metrica === "lt" ? "LT médio (m)" : "LTV médio"}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
