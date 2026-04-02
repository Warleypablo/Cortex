// client/src/components/predictions/NrrProjectionTab.tsx
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { ForecastChart } from "./ForecastChart";
import { SimulationPanel, type SliderConfig } from "./SimulationPanel";

interface NrrProjectionData {
  historico: { mes: string; nrr: number; expansao: number; contracao: number }[];
  projecao: { dataAlvo: string; valorOtimista: number; valorRealista: number; valorPessimista: number }[];
  breakdownSquad: { squad: string; nrr: number }[];
  taxaExpansaoBase: number;
  taxaChurnBase: number;
}

export function NrrProjectionTab({ horizonte }: { horizonte: number }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { data, isLoading } = useQuery<NrrProjectionData>({
    queryKey: ["/api/predictions/nrr-projection", { horizonte }],
  });

  const sliderConfigs: SliderConfig[] = useMemo(() => [
    {
      key: "taxaExpansao",
      label: "Taxa de expansao",
      min: 0, max: 20, step: 0.5,
      defaultValue: Math.round((data?.taxaExpansaoBase || 5) * 10) / 10,
      format: (v) => `${v.toFixed(1)}%`,
    },
    {
      key: "taxaChurn",
      label: "Taxa de churn",
      min: 0, max: 15, step: 0.5,
      defaultValue: Math.round((data?.taxaChurnBase || 3) * 10) / 10,
      format: (v) => `${v.toFixed(1)}%`,
    },
  ], [data]);

  const [sliderValues, setSliderValues] = useState<Record<string, number>>({
    taxaExpansao: Math.round((data?.taxaExpansaoBase || 5) * 10) / 10,
    taxaChurn: Math.round((data?.taxaChurnBase || 3) * 10) / 10,
  });

  // Update defaults when data loads
  useMemo(() => {
    if (data) {
      setSliderValues({
        taxaExpansao: Math.round(data.taxaExpansaoBase * 10) / 10,
        taxaChurn: Math.round(data.taxaChurnBase * 10) / 10,
      });
    }
  }, [data]);

  // Client-side simulation
  const chartData = useMemo(() => {
    if (!data) return [];

    const historico = data.historico.map(h => ({
      mes: h.mes,
      real: h.nrr,
    }));

    const hasSimChanges = sliderConfigs.some(s => sliderValues[s.key] !== s.defaultValue);

    const projecao = data.projecao.map((p) => {
      // NRR = 100% + expansion - contraction
      // Adjust based on slider deltas
      const expansaoDiff = sliderValues.taxaExpansao - (data.taxaExpansaoBase || 5);
      const churnDiff = sliderValues.taxaChurn - (data.taxaChurnBase || 3);
      const simulado = p.valorRealista + expansaoDiff - churnDiff;

      return {
        mes: p.dataAlvo,
        realista: p.valorRealista,
        otimista: p.valorOtimista,
        pessimista: p.valorPessimista,
        ...(hasSimChanges ? { simulado: Math.round(simulado * 10) / 10 } : {}),
      };
    });

    return [...historico, ...projecao];
  }, [data, sliderValues, sliderConfigs]);

  const deltaValue = useMemo(() => {
    if (!data || !chartData.length) return "";
    const lastProj = chartData[chartData.length - 1] as any;
    if (!lastProj?.simulado || !lastProj?.realista) return "";
    const delta = (lastProj.simulado as number) - (lastProj.realista as number);
    const sign = delta >= 0 ? "+" : "";
    return `${sign}${delta.toFixed(1)}%`;
  }, [chartData, data]);

  // Sort breakdown squads by NRR descending
  const sortedBreakdown = useMemo(() => {
    if (!data?.breakdownSquad) return [];
    return [...data.breakdownSquad].sort((a, b) => b.nrr - a.nrr);
  }, [data]);

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        {/* Chart */}
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-zinc-300">
              Projecao de NRR — {horizonte} meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ForecastChart
              data={chartData}
              todayIndex={data?.historico?.length ? data.historico.length - 1 : 0}
              referenceLine={{ y: 100, label: "100%" }}
              formatValue={(v) => `${v.toFixed(1)}%`}
              yDomain={["auto", "auto"]}
            />
          </CardContent>
        </Card>

        {/* Simulator */}
        <SimulationPanel
          sliders={sliderConfigs}
          values={sliderValues}
          onChange={setSliderValues}
          deltaLabel="vs baseline"
          deltaValue={deltaValue}
        />
      </div>

      {/* Squad Breakdown */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-700 dark:text-zinc-300">
            NRR por Squad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(200, sortedBreakdown.length * 45)}>
            <BarChart data={sortedBreakdown} layout="vertical" margin={{ left: 80, right: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#3f3f46" : "#e5e7eb"} />
              <XAxis
                type="number"
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }}
                domain={["auto", "auto"]}
              />
              <YAxis
                type="category"
                dataKey="squad"
                tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }}
                width={75}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? "#18181b" : "#fff",
                  border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number) => [`${value.toFixed(1)}%`, "NRR"]}
              />
              <ReferenceLine
                x={100}
                stroke={isDark ? "#ef4444" : "#dc2626"}
                strokeDasharray="4 4"
                label={{ value: "100%", position: "top", fontSize: 10, fill: isDark ? "#ef4444" : "#dc2626" }}
              />
              <Bar dataKey="nrr" radius={[0, 4, 4, 0]}>
                {sortedBreakdown.map((entry) => (
                  <Cell
                    key={entry.squad}
                    fill={entry.nrr >= 100
                      ? (isDark ? "#22c55e" : "#16a34a")
                      : (isDark ? "#ef4444" : "#dc2626")
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
