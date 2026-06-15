import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { DimRow } from "./types";

type DimKey = "motivo" | "squad" | "responsavel" | "cs";
const LABELS: Record<DimKey, string> = {
  motivo: "Motivo do churn", squad: "Squad", responsavel: "Responsável", cs: "CS",
};

export function ChurnPorDimensao({
  data,
}: {
  data: { motivo: DimRow[]; squad: DimRow[]; responsavel: DimRow[]; cs: DimRow[] };
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";
  const [dim, setDim] = useState<DimKey>("motivo");
  const rows = data[dim].slice(0, 12);

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Churn por dimensão</CardTitle>
          <p className="text-xs text-gray-500 dark:text-zinc-400">Jornadas churnadas agrupadas — valor pontual no tooltip</p>
        </div>
        <Select value={dim} onValueChange={(v) => setDim(v as DimKey)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(LABELS) as DimKey[]).map((k) => (
              <SelectItem key={k} value={k}>{LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 34)}>
          <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis type="number" tick={{ fill: axis, fontSize: 11 }} allowDecimals={false} />
            <YAxis type="category" dataKey="label" tick={{ fill: axis, fontSize: 11 }} width={160} />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#18181b" : "#ffffff",
                border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
                borderRadius: 8, color: isDark ? "#f4f4f5" : "#111827",
              }}
              formatter={(v: number, _n, item: any) =>
                [`${v} jornada(s) — ${formatCurrencyNoDecimals(item.payload.valorp)}`, "Churn"]}
            />
            <Bar dataKey="qtd" name="Churn" fill="#ef4444" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
