import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "@/components/ThemeProvider";
import type { FunilNivel } from "./types";

export function FunilContinuidade({ data }: { data: FunilNivel[] }) {
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

  const chart = data.map((n) => ({
    nome: `Entrega ${n.nivel}`,
    atingiram: n.atingiram,
    dropLabel: n.dropPct > 0 ? `-${n.dropPct}%` : "",
    "Concluído": n.concluido,
    "Em andamento": n.emAndamento,
    Churn: n.churn,
  }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
        <CardHeader>
          <CardTitle className="text-base">Funil de continuidade</CardTitle>
          <p className="text-xs text-gray-500 dark:text-zinc-400">Jornadas que atingiram cada entrega (e a queda para a próxima)</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chart} margin={{ top: 24, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="nome" tick={{ fill: axis, fontSize: 11 }} />
              <YAxis tick={{ fill: axis, fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="atingiram" name="Atingiram" fill="#6366f1" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="atingiram" position="top" style={{ fill: axis, fontSize: 11 }} />
                <LabelList dataKey="dropLabel" position="insideTop" style={{ fill: "#ef4444", fontSize: 11, fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
        <CardHeader>
          <CardTitle className="text-base">Composição de quem parou em cada degrau</CardTitle>
          <p className="text-xs text-gray-500 dark:text-zinc-400">Churn (caiu) × em andamento (ainda roda) × concluído</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chart} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="nome" tick={{ fill: axis, fontSize: 11 }} />
              <YAxis tick={{ fill: axis, fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Concluído" stackId="s" fill="#10b981" />
              <Bar dataKey="Em andamento" stackId="s" fill="#f59e0b" />
              <Bar dataKey="Churn" stackId="s" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
