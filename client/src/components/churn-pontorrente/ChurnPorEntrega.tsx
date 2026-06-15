import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { Jornada } from "./types";

const fmtPct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export function ChurnPorEntrega({ jornadas }: { jornadas: Jornada[] }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";

  const maxNivel = jornadas.length
    ? Math.max(1, ...jornadas.flatMap((j) => j.entregas.map((e) => e.nivel)))
    : 4;

  const data = Array.from({ length: maxNivel }, (_, i) => i + 1).map((n) => {
    let total = 0, qtd = 0, valor = 0;
    for (const j of jornadas) {
      for (const e of j.entregas) {
        if (e.nivel !== n) continue;
        total += 1;
        if (e.situacao === "churn") { qtd += 1; valor += e.valorp; }
      }
    }
    return { nome: `Entrega ${n}`, total, qtd, valor, pct: total > 0 ? Math.round((qtd / total) * 1000) / 10 : 0 };
  });

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <CardTitle className="text-base">Churn por entrega</CardTitle>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Valor perdido (barras) e taxa de churn (linha = cancelados ÷ contratos da entrega)
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={data} margin={{ top: 24, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="nome" tick={{ fill: axis, fontSize: 12 }} />
            <YAxis
              yAxisId="left" tick={{ fill: axis, fontSize: 11 }}
              tickFormatter={(v) => formatCurrencyNoDecimals(v)}
            />
            <YAxis
              yAxisId="right" orientation="right" tick={{ fill: axis, fontSize: 11 }}
              tickFormatter={(v) => `${v}%`} domain={[0, "auto"]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#18181b" : "#ffffff",
                border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
                borderRadius: 8, color: isDark ? "#f4f4f5" : "#111827",
              }}
              formatter={(value: number, name: string, item: any) => {
                if (name === "Valor perdido") return [formatCurrencyNoDecimals(value), name];
                return [`${fmtPct(value)} (${item.payload.qtd}/${item.payload.total})`, "Taxa de churn"];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="left" dataKey="valor" name="Valor perdido" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={70}>
              <LabelList dataKey="valor" position="top" style={{ fill: axis, fontSize: 10 }} formatter={(v: number) => (v > 0 ? formatCurrencyNoDecimals(v) : "")} />
            </Bar>
            <Line yAxisId="right" type="monotone" dataKey="pct" name="Taxa de churn" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }}>
              <LabelList dataKey="pct" position="top" style={{ fill: "#f59e0b", fontSize: 11, fontWeight: 600 }} formatter={(v: number) => fmtPct(v)} />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
