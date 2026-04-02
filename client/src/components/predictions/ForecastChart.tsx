// client/src/components/predictions/ForecastChart.tsx
import {
  AreaChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import { useTheme } from "@/components/ThemeProvider";

interface ForecastDataPoint {
  mes: string;
  real?: number;
  realista?: number;
  otimista?: number;
  pessimista?: number;
  simulado?: number;
}

interface ForecastChartProps {
  data: ForecastDataPoint[];
  todayIndex: number; // index where projection starts
  formatValue?: (value: number) => string;
  height?: number;
  yDomain?: [number | string, number | string];
  referenceLine?: { y: number; label: string };
}

export function ForecastChart({
  data,
  todayIndex,
  formatValue = (v) => `R$ ${(v / 1000).toFixed(0)}k`,
  height = 350,
  yDomain,
  referenceLine,
}: ForecastChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const gridColor = isDark ? "#3f3f46" : "#e5e7eb";
  const axisColor = isDark ? "#a1a1aa" : "#6b7280";
  const todayMonth = data[todayIndex]?.mes || '';

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis
          dataKey="mes"
          tick={{ fontSize: 11, fill: axisColor }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: axisColor }}
          tickFormatter={formatValue}
          tickLine={false}
          domain={yDomain}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? "#18181b" : "#fff",
            border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value: number, name: string) => [formatValue(value), name]}
        />

        {/* Cone de incerteza */}
        <Area
          dataKey="otimista"
          stroke="none"
          fill={isDark ? "#22d3ee20" : "#06b6d420"}
          name="Otimista"
        />
        <Area
          dataKey="pessimista"
          stroke="none"
          fill={isDark ? "#18181b" : "#ffffff"}
          name="Pessimista"
        />

        {/* Linha real (histórico) */}
        <Line
          dataKey="real"
          stroke={isDark ? "#a78bfa" : "#7c3aed"}
          strokeWidth={2}
          dot={{ r: 3 }}
          name="Real"
          connectNulls={false}
        />

        {/* Linha realista (projeção) */}
        <Line
          dataKey="realista"
          stroke={isDark ? "#22d3ee" : "#0891b2"}
          strokeWidth={2}
          strokeDasharray="6 3"
          dot={{ r: 2 }}
          name="Projeção"
          connectNulls={false}
        />

        {/* Linha simulada */}
        {data.some(d => d.simulado !== undefined) && (
          <Line
            dataKey="simulado"
            stroke={isDark ? "#fbbf24" : "#d97706"}
            strokeWidth={2}
            strokeDasharray="3 3"
            dot={false}
            name="Simulação"
            connectNulls={false}
          />
        )}

        {/* Linha vertical "Hoje" */}
        <ReferenceLine
          x={todayMonth}
          stroke={isDark ? "#71717a" : "#9ca3af"}
          strokeDasharray="4 4"
          label={{ value: "Hoje", position: "top", fontSize: 10, fill: axisColor }}
        />

        {/* Linha de referência opcional */}
        {referenceLine && (
          <ReferenceLine
            y={referenceLine.y}
            stroke={isDark ? "#ef4444" : "#dc2626"}
            strokeDasharray="8 4"
            label={{ value: referenceLine.label, position: "right", fontSize: 10, fill: isDark ? "#ef4444" : "#dc2626" }}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
