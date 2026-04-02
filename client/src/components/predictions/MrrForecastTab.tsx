// client/src/components/predictions/MrrForecastTab.tsx
import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { ForecastChart } from "./ForecastChart";
import { SimulationPanel, type SliderConfig } from "./SimulationPanel";

interface MrrForecastData {
  historico: { mes: string; mrr: number }[];
  projecao: { dataAlvo: string; valorOtimista: number; valorRealista: number; valorPessimista: number }[];
  breakdownSquad: { squad: string; mrr: number; projetado: number }[];
  churnRateBase: number;
  ticketMedioBase: number;
  novosContratosBase: number;
}

const SQUAD_COLORS: Record<string, string> = {
  Supreme: "#3b82f6", Forja: "#a855f7", Nitro: "#f59e0b",
  Starter: "#10b981", Hub: "#ef4444", Venture: "#6366f1",
};

export function MrrForecastTab({ horizonte }: { horizonte: number }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { data, isLoading } = useQuery<MrrForecastData>({
    queryKey: ["/api/predictions/mrr-forecast", { horizonte }],
  });

  const sliderConfigs: SliderConfig[] = useMemo(() => [
    {
      key: "novosContratos",
      label: "Novos contratos/mês",
      min: 0, max: 30, step: 1,
      defaultValue: Math.round(data?.novosContratosBase || 5),
      format: (v) => `${v}`,
    },
    {
      key: "ticketMedio",
      label: "Ticket médio (R$)",
      min: 500, max: 10000, step: 250,
      defaultValue: Math.round(data?.ticketMedioBase || 2000),
      format: (v) => `R$ ${v.toLocaleString("pt-BR")}`,
    },
    {
      key: "churnRate",
      label: "Taxa de churn mensal",
      min: 0, max: 10, step: 0.5,
      defaultValue: Math.round((data?.churnRateBase || 0.03) * 1000) / 10,
      format: (v) => `${v.toFixed(1)}%`,
    },
  ], [data]);

  const [sliderValues, setSliderValues] = useState<Record<string, number>>({
    novosContratos: Math.round(data?.novosContratosBase || 5),
    ticketMedio: Math.round(data?.ticketMedioBase || 2000),
    churnRate: Math.round((data?.churnRateBase || 0.03) * 1000) / 10,
  });

  // Atualizar defaults quando dados carregam
  useMemo(() => {
    if (data) {
      setSliderValues({
        novosContratos: Math.round(data.novosContratosBase),
        ticketMedio: Math.round(data.ticketMedioBase),
        churnRate: Math.round(data.churnRateBase * 1000) / 10,
      });
    }
  }, [data]);

  // Simulação client-side
  const chartData = useMemo(() => {
    if (!data) return [];

    const historico = data.historico.map(h => ({
      mes: h.mes,
      real: h.mrr,
    }));

    const hasSimChanges = sliderConfigs.some(s => sliderValues[s.key] !== s.defaultValue);

    const projecao = data.projecao.map((p, i) => {
      const mesesAcumulados = i + 1;
      const ganhoNovos = sliderValues.novosContratos * sliderValues.ticketMedio * mesesAcumulados;
      const churnDiff = (sliderValues.churnRate / 100) - data.churnRateBase;
      const perdaExtra = p.valorRealista * churnDiff * mesesAcumulados;
      const simulado = p.valorRealista + ganhoNovos - perdaExtra;

      return {
        mes: p.dataAlvo,
        realista: p.valorRealista,
        otimista: p.valorOtimista,
        pessimista: p.valorPessimista,
        ...(hasSimChanges ? { simulado: Math.round(simulado) } : {}),
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
    return `${sign}R$ ${(delta / 1000).toFixed(0)}k`;
  }, [chartData, data]);

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        {/* Gráfico */}
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-zinc-300">
              Forecast de MRR — {horizonte} meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ForecastChart
              data={chartData}
              todayIndex={data?.historico?.length ? data.historico.length - 1 : 0}
            />
          </CardContent>
        </Card>

        {/* Simulador */}
        <SimulationPanel
          sliders={sliderConfigs}
          values={sliderValues}
          onChange={setSliderValues}
          deltaLabel="vs baseline"
          deltaValue={deltaValue}
        />
      </div>

      {/* Breakdown por Squad */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-700 dark:text-zinc-300">
            MRR Projetado por Squad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data?.breakdownSquad || []} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#3f3f46" : "#e5e7eb"} />
              <XAxis
                type="number"
                tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }}
              />
              <YAxis
                type="category"
                dataKey="squad"
                tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? "#18181b" : "#fff",
                  border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR")}`, ""]}
              />
              <Bar dataKey="projetado" radius={[0, 4, 4, 0]}>
                {(data?.breakdownSquad || []).map((entry) => (
                  <Cell key={entry.squad} fill={SQUAD_COLORS[entry.squad] || "#6b7280"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
