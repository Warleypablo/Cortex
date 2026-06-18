import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { fetchJson, buildUrl } from "./utils";
import type { BucketDist } from "./types";

interface Props {
  produto?: string;
  status?: string;
}

export function DistClientesCharts({ produto, status }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";

  const tooltipStyle = {
    backgroundColor: isDark ? "#18181b" : "#ffffff",
    border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
    borderRadius: 8,
    color: isDark ? "#f4f4f5" : "#111827",
  };

  const { data } = useQuery({
    queryKey: ["/api/lt-ltv-churn/dist-clientes", produto, status],
    queryFn: () =>
      fetchJson<{ ltv: BucketDist[]; lt: BucketDist[] }>(
        buildUrl("/api/lt-ltv-churn/dist-clientes", { produto, status })
      ),
  });

  if (!data) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
        <div className="h-64 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
        <CardHeader>
          <CardTitle className="text-base">Distribuição de LTV por cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.ltv} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="faixa" tick={{ fill: axis, fontSize: 11 }} />
              <YAxis tick={{ fill: axis, fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="qtd" fill="#6366f1" radius={[4, 4, 0, 0]} name="Clientes" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
        <CardHeader>
          <CardTitle className="text-base">Distribuição de LT por cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.lt} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="faixa" tick={{ fill: axis, fontSize: 11 }} />
              <YAxis tick={{ fill: axis, fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="qtd" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Clientes" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
