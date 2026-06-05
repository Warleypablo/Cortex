import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { fetchJson } from "./utils";
import type { StatusRow } from "./types";

const COR: Record<string, string> = {
  triagem: "#f59e0b",
  ativo: "#10b981",
  onboarding: "#6366f1",
  pausado: "#a1a1aa",
};

export function FunilStatus() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";

  const { data, isLoading } = useQuery({
    queryKey: ["/api/creators-pontual/funil"],
    queryFn: () => fetchJson<{ status: StatusRow[] }>("/api/creators-pontual/funil"),
  });

  if (isLoading || !data) {
    return <div className="h-72 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />;
  }

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <CardTitle className="text-base">Funil por status</CardTitle>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Valor parado em cada etapa — destaque para o que ainda não começou (triagem)
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.status} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis type="number" tick={{ fill: axis, fontSize: 11 }} tickFormatter={(v) => formatCurrencyNoDecimals(v)} />
            <YAxis type="category" dataKey="status" tick={{ fill: axis, fontSize: 11 }} width={80} />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#18181b" : "#ffffff",
                border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
                borderRadius: 8,
                color: isDark ? "#f4f4f5" : "#111827",
              }}
              formatter={(v: number) => formatCurrencyNoDecimals(v)}
            />
            <Bar dataKey="valor" name="Valor" radius={[0, 4, 4, 0]}>
              {data.status.map((s) => (
                <Cell key={s.status} fill={COR[s.status?.toLowerCase()] ?? "#6366f1"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
