import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { ProdutoBenchmark } from "./types";

export function LtLtvPorProduto({ produtos }: { produtos: ProdutoBenchmark[] }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";

  const data = produtos
    .filter((p) => p.produto && (p.ltvMedio > 0 || p.ltMedioCancelado > 0))
    .slice(0, 10)
    .map((p) => ({
      produto: p.produto,
      lt: p.ltMedioCancelado,
      ltv: p.ltvMedio,
    }));

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <CardTitle className="text-base">LT e LTV por produto</CardTitle>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          LT médio (meses, eixo esquerdo) e LTV médio (R$, eixo direito) — contratos encerrados
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis
              dataKey="produto"
              tick={{ fill: axis, fontSize: 11 }}
              angle={-20}
              textAnchor="end"
              height={60}
            />
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
            <Bar yAxisId="lt" dataKey="lt" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="LT médio (m)" />
            <Bar yAxisId="ltv" dataKey="ltv" fill="#6366f1" radius={[4, 4, 0, 0]} name="LTV médio" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
