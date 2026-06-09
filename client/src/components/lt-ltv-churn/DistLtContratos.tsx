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
import { fetchJson, buildUrl } from "./utils";
import type { BucketLtContrato } from "./types";

interface Props {
  produto?: string;
}

export function DistLtContratos({ produto }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";

  const { data } = useQuery({
    queryKey: ["/api/lt-ltv-churn/dist-lt-contratos", produto],
    queryFn: () =>
      fetchJson<{ buckets: BucketLtContrato[] }>(
        buildUrl("/api/lt-ltv-churn/dist-lt-contratos", { produto })
      ),
  });

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <CardTitle className="text-base">Distribuição de LT dos contratos</CardTitle>
      </CardHeader>
      <CardContent>
        {!data ? (
          <div className="h-64 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.buckets} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="faixa" tick={{ fill: axis, fontSize: 11 }} />
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
              <Bar dataKey="ativos" fill="#10b981" radius={[4, 4, 0, 0]} name="Ativos" />
              <Bar dataKey="cancelados" fill="#ef4444" radius={[4, 4, 0, 0]} name="Cancelados" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
