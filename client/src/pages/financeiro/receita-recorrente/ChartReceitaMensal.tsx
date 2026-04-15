import { useMemo } from "react";
import {
  ComposedChart, Bar, XAxis, YAxis,
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
  recorrente_previsto: number;
  pontual_previsto: number;
  nao_classif_previsto: number;
  total_previsto: number;
  total_realizado: number;
  is_futuro: boolean;
}

// Parse ISO "YYYY-MM-01" como data local (não UTC) para evitar off-by-one.
function monthLabel(iso: string): string {
  const [year, month] = iso.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  const label = d.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
  return `${label}/${year.slice(-2)}`;
}

const SERIES_LABELS: Record<string, string> = {
  recorrente_previsto: "Recorrente",
  pontual_previsto: "Pontual",
  nao_classif_previsto: "Não Classif",
};

interface TooltipRow {
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({
  active,
  payload,
  label,
  isDark,
  gridColor,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; dataKey?: string; value?: number; color?: string }>;
  label?: string;
  isDark: boolean;
  gridColor: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const rows: TooltipRow[] = [];
  let stackedTotal = 0;
  for (const p of payload) {
    const key = p.dataKey || "";
    const valor = typeof p.value === "number" ? p.value : 0;
    const nome = SERIES_LABELS[key] || p.name || key;
    rows.push({ name: nome, value: valor, color: p.color || "#888" });
    if (key === "recorrente_previsto" || key === "pontual_previsto" || key === "nao_classif_previsto") {
      stackedTotal += valor;
    }
  }

  return (
    <div
      style={{
        backgroundColor: isDark ? "#18181b" : "#ffffff",
        border: `1px solid ${gridColor}`,
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 12,
        minWidth: 200,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6, color: isDark ? "#fafafa" : "#18181b" }}>
        {label}
      </div>
      {rows.map((r) => (
        <div
          key={r.name}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            color: isDark ? "#d4d4d8" : "#374151",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: 2,
                backgroundColor: r.color,
              }}
            />
            {r.name}
          </span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatCurrencyNoDecimals(r.value)}
          </span>
        </div>
      ))}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          marginTop: 6,
          paddingTop: 6,
          borderTop: `1px solid ${gridColor}`,
          fontWeight: 600,
          color: isDark ? "#fafafa" : "#18181b",
        }}
      >
        <span>Total</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatCurrencyNoDecimals(stackedTotal)}
        </span>
      </div>
    </div>
  );
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
        existing.recorrente_previsto += m.recorrente_previsto;
        existing.pontual_previsto += m.pontual_previsto;
        existing.nao_classif_previsto += m.nao_classif_previsto;
        existing.total_previsto += m.total_previsto;
        existing.total_realizado += m.total_realizado;
      } else {
        map.set(m.mes, {
          mes: m.mes,
          mesLabel: monthLabel(m.mes),
          recorrente_previsto: m.recorrente_previsto,
          pontual_previsto: m.pontual_previsto,
          nao_classif_previsto: m.nao_classif_previsto,
          total_previsto: m.total_previsto,
          total_realizado: m.total_realizado,
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
              <Tooltip content={<CustomTooltip isDark={isDark} gridColor={gridColor} />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />

              <Bar
                dataKey="recorrente_previsto"
                name="Recorrente"
                stackId="total"
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
                dataKey="pontual_previsto"
                name="Pontual"
                stackId="total"
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
                dataKey="nao_classif_previsto"
                name="Não Classif"
                stackId="total"
                fill="#64748b"
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-nc-${index}`}
                    fillOpacity={entry.is_futuro ? 0.35 : 1}
                  />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-zinc-400">
          Barras claras = meses futuros com parcelas agendadas.
        </p>
      </CardContent>
    </Card>
  );
}
