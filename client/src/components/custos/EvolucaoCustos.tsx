import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals, formatCurrencyUSD } from "@/lib/utils";
import type { ResumoMes } from "./KpisCustos";

const PILARES = [
  { key: "assinaturas", label: "Assinaturas", cor: "#6366f1" },
  { key: "anthropic", label: "API Anthropic", cor: "#f59e0b" },
  { key: "gcp", label: "GCP", cor: "#10b981" },
  { key: "ferramentas", label: "Ferramentas", cor: "#ec4899" },
];

export function EvolucaoCustos({ dados, moeda }: { dados: ResumoMes[]; moeda: "BRL" | "USD" }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const fmt = moeda === "BRL" ? formatCurrencyNoDecimals : formatCurrencyUSD;

  const chartData = dados.map((d) => {
    const fator = moeda === "USD" && d.totalBRL ? d.totalUSD / d.totalBRL : 1;
    const row: any = { mes: d.mes };
    for (const p of PILARES) row[p.key] = (d.porPilar?.[p.key] || 0) * (moeda === "USD" ? fator : 1);
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#3f3f46" : "#e5e7eb"} vertical={false} />
        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }} />
        <YAxis tickFormatter={(v) => fmt(v)} tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }} width={60} />
        <Tooltip
          formatter={(v: number, name: string) => [fmt(v), PILARES.find((p) => p.key === name)?.label || name]}
          contentStyle={{ background: isDark ? "#18181b" : "#fff", border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`, borderRadius: 6, fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} formatter={(name) => PILARES.find((p) => p.key === name)?.label || name} />
        {PILARES.map((p, i) => (
          <Bar key={p.key} dataKey={p.key} stackId="a" fill={p.cor} radius={i === PILARES.length - 1 ? [3, 3, 0, 0] : undefined} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
