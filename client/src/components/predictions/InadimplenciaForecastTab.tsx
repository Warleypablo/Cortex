// client/src/components/predictions/InadimplenciaForecastTab.tsx
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { SimulationPanel, type SliderConfig } from "./SimulationPanel";

interface InadimplenciaForecastData {
  mensal: {
    mes: string;
    faixa_1_30: number;
    faixa_31_60: number;
    faixa_61_90: number;
    faixa_90_plus: number;
    total: number;
  }[];
  porFaixa: Record<string, { valor: number; tendencia: "up" | "down" | "stable" }>;
  taxaRecuperacaoBase: Record<string, number>;
  novosInadimplentesBase: number;
}

const FAIXA_COLORS = {
  faixa_1_30: "#22c55e",   // green
  faixa_31_60: "#eab308",  // yellow
  faixa_61_90: "#f97316",  // orange
  faixa_90_plus: "#ef4444", // red
};

const FAIXA_LABELS: Record<string, string> = {
  faixa_1_30: "1-30 dias",
  faixa_31_60: "31-60 dias",
  faixa_61_90: "61-90 dias",
  faixa_90_plus: "90+ dias",
};

function TrendArrow({ tendencia }: { tendencia: "up" | "down" | "stable" }) {
  if (tendencia === "up") {
    return <span className="text-red-500 font-bold text-sm" title="Tendência de alta">{"\u2191"}</span>;
  }
  if (tendencia === "down") {
    return <span className="text-green-500 font-bold text-sm" title="Tendência de queda">{"\u2193"}</span>;
  }
  return <span className="text-gray-400 dark:text-zinc-500 font-bold text-sm" title="Estável">{"\u2192"}</span>;
}

export function InadimplenciaForecastTab({ horizonte }: { horizonte: number }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { data, isLoading } = useQuery<InadimplenciaForecastData>({
    queryKey: ["/api/predictions/inadimplencia-forecast", { horizonte }],
  });

  const sliderConfigs: SliderConfig[] = useMemo(() => [
    {
      key: "recup_1_30",
      label: "Taxa recuperacao 1-30d",
      min: 0, max: 100, step: 1,
      defaultValue: Math.round((data?.taxaRecuperacaoBase?.["faixa_1_30"] ?? 50) * 100) / 100,
      format: (v) => `${v}%`,
    },
    {
      key: "recup_31_60",
      label: "Taxa recuperacao 31-60d",
      min: 0, max: 100, step: 1,
      defaultValue: Math.round((data?.taxaRecuperacaoBase?.["faixa_31_60"] ?? 30) * 100) / 100,
      format: (v) => `${v}%`,
    },
    {
      key: "novosInadimplentes",
      label: "Novos inadimplentes/mes",
      min: 0, max: 100, step: 1,
      defaultValue: Math.round(data?.novosInadimplentesBase ?? 10),
      format: (v) => `${v}`,
    },
  ], [data]);

  const [sliderValues, setSliderValues] = useState<Record<string, number>>({
    recup_1_30: 50,
    recup_31_60: 30,
    novosInadimplentes: 10,
  });

  // Update defaults when data loads
  useMemo(() => {
    if (data) {
      setSliderValues({
        recup_1_30: Math.round((data.taxaRecuperacaoBase?.["faixa_1_30"] ?? 50) * 100) / 100,
        recup_31_60: Math.round((data.taxaRecuperacaoBase?.["faixa_31_60"] ?? 30) * 100) / 100,
        novosInadimplentes: Math.round(data.novosInadimplentesBase),
      });
    }
  }, [data]);

  // Client-side simulation
  const chartData = useMemo(() => {
    if (!data?.mensal) return [];

    const hasSimChanges = sliderConfigs.some(s => sliderValues[s.key] !== s.defaultValue);
    if (!hasSimChanges) return data.mensal;

    const baseRecup1_30 = data.taxaRecuperacaoBase?.["faixa_1_30"] ?? 50;
    const baseRecup31_60 = data.taxaRecuperacaoBase?.["faixa_31_60"] ?? 30;
    const baseNovos = data.novosInadimplentesBase ?? 10;

    return data.mensal.map((m) => {
      const recup1_30_ratio = baseRecup1_30 > 0 ? sliderValues.recup_1_30 / baseRecup1_30 : 1;
      const recup31_60_ratio = baseRecup31_60 > 0 ? sliderValues.recup_31_60 / baseRecup31_60 : 1;
      const novosRatio = baseNovos > 0 ? sliderValues.novosInadimplentes / baseNovos : 1;

      // Higher recovery rate reduces the aging bucket value
      const sim_1_30 = Math.round(m.faixa_1_30 * novosRatio / recup1_30_ratio);
      const sim_31_60 = Math.round(m.faixa_31_60 / recup31_60_ratio);
      const sim_61_90 = Math.round(m.faixa_61_90 / recup31_60_ratio);
      const sim_90_plus = Math.round(m.faixa_90_plus);

      return {
        ...m,
        faixa_1_30: Math.max(0, sim_1_30),
        faixa_31_60: Math.max(0, sim_31_60),
        faixa_61_90: Math.max(0, sim_61_90),
        faixa_90_plus: Math.max(0, sim_90_plus),
        total: Math.max(0, sim_1_30 + sim_31_60 + sim_61_90 + sim_90_plus),
      };
    });
  }, [data, sliderValues, sliderConfigs]);

  // Delta for simulation panel
  const deltaValue = useMemo(() => {
    if (!data?.mensal?.length || !chartData.length) return "";
    const hasSimChanges = sliderConfigs.some(s => sliderValues[s.key] !== s.defaultValue);
    if (!hasSimChanges) return "";

    const originalTotal = data.mensal.reduce((sum, m) => sum + m.total, 0);
    const simTotal = chartData.reduce((sum, m) => sum + m.total, 0);
    const delta = simTotal - originalTotal;
    const sign = delta >= 0 ? "+" : "";
    return `${sign}R$ ${(delta / 1000).toFixed(0)}k`;
  }, [data, chartData, sliderValues, sliderConfigs]);

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  const faixaEntries = data?.porFaixa ? Object.entries(data.porFaixa) : [];

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        {/* Stacked BarChart */}
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-zinc-300">
              Projecao de Inadimplencia por Faixa de Aging — {horizonte} meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#3f3f46" : "#e5e7eb"} />
                <XAxis
                  dataKey="mes"
                  tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }}
                  tickFormatter={(v) => {
                    const [year, month] = v.split("-");
                    return `${month}/${year?.slice(2)}`;
                  }}
                />
                <YAxis
                  tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#18181b" : "#fff",
                    border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => [
                    `R$ ${value.toLocaleString("pt-BR")}`,
                    FAIXA_LABELS[name] || name,
                  ]}
                />
                <Legend
                  formatter={(value: string) => (
                    <span className="text-xs text-gray-600 dark:text-zinc-400">
                      {FAIXA_LABELS[value] || value}
                    </span>
                  )}
                />
                <Bar dataKey="faixa_1_30" stackId="aging" fill={FAIXA_COLORS.faixa_1_30} radius={[0, 0, 0, 0]} />
                <Bar dataKey="faixa_31_60" stackId="aging" fill={FAIXA_COLORS.faixa_31_60} radius={[0, 0, 0, 0]} />
                <Bar dataKey="faixa_61_90" stackId="aging" fill={FAIXA_COLORS.faixa_61_90} radius={[0, 0, 0, 0]} />
                <Bar dataKey="faixa_90_plus" stackId="aging" fill={FAIXA_COLORS.faixa_90_plus} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Simulation Panel */}
        <SimulationPanel
          sliders={sliderConfigs}
          values={sliderValues}
          onChange={setSliderValues}
          deltaLabel="vs baseline"
          deltaValue={deltaValue}
        />
      </div>

      {/* Breakdown cards by aging bucket */}
      {faixaEntries.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {faixaEntries.map(([faixa, info]) => (
            <Card
              key={faixa}
              className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700"
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 dark:text-zinc-400">
                    {FAIXA_LABELS[faixa] || faixa}
                  </span>
                  <TrendArrow tendencia={info.tendencia} />
                </div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  R$ {info.valor.toLocaleString("pt-BR")}
                </div>
                <div
                  className="h-1 mt-2 rounded-full"
                  style={{ backgroundColor: FAIXA_COLORS[faixa as keyof typeof FAIXA_COLORS] || "#6b7280" }}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
