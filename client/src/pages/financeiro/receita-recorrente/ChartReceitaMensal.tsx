import { useMemo } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { MesReceita } from "@shared/receitaRecorrenteTypes";

interface Props {
  meses: MesReceita[];
}

interface ChartPoint {
  mes: string;
  mesLabel: string;
  recorrente_realizado: number;
  pontual_realizado: number;
  nao_classif_realizado: number;
  total_previsto: number;
  total_realizado: number;
  mrr_contratado: number;
  is_futuro: boolean;
}

// Parse ISO "YYYY-MM-01" como data local (não UTC) para evitar off-by-one.
function monthLabel(iso: string): string {
  const [year, month] = iso.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  const label = d.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
  return `${label}/${year.slice(-2)}`;
}

export function ChartReceitaMensal({ meses }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const chartData: ChartPoint[] = useMemo(() => {
    // Consolidar por mes (somando empresas) para um único ponto por mês
    const map = new Map<string, ChartPoint>();
    for (const m of meses) {
      const existing = map.get(m.mes);
      if (existing) {
        existing.recorrente_realizado += m.recorrente_realizado;
        existing.pontual_realizado += m.pontual_realizado;
        existing.nao_classif_realizado += m.nao_classif_realizado;
        existing.total_previsto += m.total_previsto;
        existing.total_realizado += m.total_realizado;
      } else {
        map.set(m.mes, {
          mes: m.mes,
          mesLabel: monthLabel(m.mes),
          recorrente_realizado: m.recorrente_realizado,
          pontual_realizado: m.pontual_realizado,
          nao_classif_realizado: m.nao_classif_realizado,
          total_previsto: m.total_previsto,
          total_realizado: m.total_realizado,
          mrr_contratado: m.mrr_contratado,
          is_futuro: m.is_futuro,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.mes.localeCompare(b.mes));
  }, [meses]);

  const gridColor = isDark ? "#27272a" : "#e5e7eb";
  const axisColor = isDark ? "#a1a1aa" : "#6b7280";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolução Mensal</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[420px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="mesLabel" stroke={axisColor} tick={{ fill: axisColor, fontSize: 12 }} />
              <YAxis
                stroke={axisColor}
                tick={{ fill: axisColor, fontSize: 11 }}
                tickFormatter={(v) => formatCurrencyNoDecimals(v).replace("R$", "").trim()}
                width={80}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? "#18181b" : "#ffffff",
                  border: `1px solid ${gridColor}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: axisColor }}
                formatter={(value: number | string, name: string) => {
                  if (typeof value !== "number") return [value, name];
                  return [formatCurrencyNoDecimals(value), name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />

              <Bar
                dataKey="recorrente_realizado"
                name="Recorrente"
                stackId="realizado"
                fill="#10b981"
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-rec-${index}`}
                    fillOpacity={entry.is_futuro ? 0.35 : 1}
                  />
                ))}
              </Bar>
              <Bar
                dataKey="pontual_realizado"
                name="Pontual"
                stackId="realizado"
                fill="#f59e0b"
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-pon-${index}`}
                    fillOpacity={entry.is_futuro ? 0.35 : 1}
                  />
                ))}
              </Bar>
              <Bar
                dataKey="nao_classif_realizado"
                name="Não Classif"
                stackId="realizado"
                fill="#64748b"
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-nc-${index}`}
                    fillOpacity={entry.is_futuro ? 0.35 : 1}
                  />
                ))}
              </Bar>

              <Line
                type="monotone"
                dataKey="mrr_contratado"
                name="MRR Contratado (ClickUp)"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 4, fill: "#3b82f6" }}
              />
              <Line
                type="monotone"
                dataKey="total_previsto"
                name="Previsto total"
                stroke="#9ca3af"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-zinc-400">
          Barras claras = meses futuros com parcelas agendadas. Linha azul = MRR contratado (snapshot ClickUp). Linha cinza tracejada = total previsto do mês.
        </p>
      </CardContent>
    </Card>
  );
}
