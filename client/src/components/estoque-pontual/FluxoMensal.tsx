import { useQuery } from "@tanstack/react-query";
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
import { fetchJson } from "./utils";
import type { FluxoPonto } from "./types";

export function FluxoMensal() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";

  const { data, isLoading } = useQuery({
    queryKey: ["/api/estoque-pontual/fluxo"],
    queryFn: () => fetchJson<{ serie: FluxoPonto[] }>("/api/estoque-pontual/fluxo?meses=8"),
  });

  if (isLoading || !data) {
    return <div className="h-72 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />;
  }

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <CardTitle className="text-base">Fluxo mensal: vendas × entregas</CardTitle>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Entradas (pontuais criados) e entregas (data de entrega) por mês — quantidade
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.serie} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="mes" tick={{ fill: axis, fontSize: 11 }} />
            <YAxis tick={{ fill: axis, fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#18181b" : "#ffffff",
                border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
                borderRadius: 8,
                color: isDark ? "#f4f4f5" : "#111827",
              }}
            />
            <Legend />
            <Bar dataKey="entradas" fill="#6366f1" name="Vendas (entradas)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="entregas" fill="#10b981" name="Entregas" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
