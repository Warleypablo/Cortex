import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { RedesignPayload } from "./types";

export function MixReceitaTempo({ data }: { data: RedesignPayload }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";
  const dados = data.mixMensal.map((m) => ({
    mes: m.mes, "Pontual (R$)": m.pontualValor, "Novo MRR rec (R$)": m.recorrenteMrrNovo,
    "Pontual (nº)": m.pontualN, "Recorrente (nº)": m.recorrenteN,
  }));
  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <CardTitle className="text-base">Mix de vendas no tempo</CardTitle>
        <p className="text-xs text-gray-500 dark:text-zinc-400">Vendas novas por mês de início · barras = R$ vendido · linha = nº de contratos novos. O pivot de mar/2026 salta aos olhos.</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={dados} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="mes" tick={{ fill: axis, fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
            <YAxis yAxisId="r" tick={{ fill: axis, fontSize: 11 }} tickFormatter={(v) => formatCurrencyNoDecimals(v)} />
            <YAxis yAxisId="n" orientation="right" tick={{ fill: axis, fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={{ backgroundColor: isDark ? "#18181b" : "#fff", border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`, borderRadius: 8, color: isDark ? "#f4f4f5" : "#111827" }}
              formatter={(v: number, n: string) => n.includes("R$") ? formatCurrencyNoDecimals(v) : v} />
            <Legend />
            <Bar yAxisId="r" dataKey="Pontual (R$)" fill="#6366f1" radius={[3, 3, 0, 0]} />
            <Bar yAxisId="r" dataKey="Novo MRR rec (R$)" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
            <Line yAxisId="n" dataKey="Pontual (nº)" stroke="#818cf8" strokeWidth={2} dot={false} />
            <Line yAxisId="n" dataKey="Recorrente (nº)" stroke="#38bdf8" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
