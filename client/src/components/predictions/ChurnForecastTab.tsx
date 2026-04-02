// client/src/components/predictions/ChurnForecastTab.tsx
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { SimulationPanel, type SliderConfig } from "./SimulationPanel";
import { AlertTriangle, Users, DollarSign, TrendingDown } from "lucide-react";

// --- Types ---

interface ChurnMensal {
  mes: string;
  contratos: number;
  mrrPerdido: number;
  porTier: Record<string, number>;
}

interface TopContrato {
  contratoId: string;
  clienteNome: string;
  mrr: number;
  score: number;
  squad: string;
  probabilidade: number;
}

interface ChurnForecastData {
  mensal: ChurnMensal[];
  topContratos: TopContrato[];
  porTier: Record<string, { contratos: number; mrr: number; probabilidade: number }>;
  taxasPorTier: Record<string, number>;
}

// --- Constants ---

const TIER_COLORS: Record<string, string> = {
  critico: "#ef4444",
  alto: "#f97316",
  moderado: "#eab308",
  baixo: "#22c55e",
};

const TIER_LABELS: Record<string, string> = {
  critico: "Crítico",
  alto: "Alto",
  moderado: "Moderado",
  baixo: "Baixo",
};

// --- Component ---

export function ChurnForecastTab({ horizonte }: { horizonte: number }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { data, isLoading } = useQuery<ChurnForecastData>({
    queryKey: ["/api/predictions/churn-forecast", { horizonte }],
  });

  // Slider configs based on API taxasPorTier
  const sliderConfigs: SliderConfig[] = useMemo(() => [
    {
      key: "retencaoCritico",
      label: "Retenção de críticos",
      min: 0, max: 100, step: 5,
      defaultValue: Math.round((data?.taxasPorTier?.critico ?? 0.1) * 100),
      format: (v: number) => `${v}%`,
    },
    {
      key: "retencaoAlto",
      label: "Retenção de alto risco",
      min: 0, max: 100, step: 5,
      defaultValue: Math.round((data?.taxasPorTier?.alto ?? 0.2) * 100),
      format: (v: number) => `${v}%`,
    },
  ], [data]);

  const [sliderValues, setSliderValues] = useState<Record<string, number>>({
    retencaoCritico: Math.round((data?.taxasPorTier?.critico ?? 0.1) * 100),
    retencaoAlto: Math.round((data?.taxasPorTier?.alto ?? 0.2) * 100),
  });

  // Update defaults when data loads
  useMemo(() => {
    if (data?.taxasPorTier) {
      setSliderValues({
        retencaoCritico: Math.round((data.taxasPorTier.critico ?? 0.1) * 100),
        retencaoAlto: Math.round((data.taxasPorTier.alto ?? 0.2) * 100),
      });
    }
  }, [data]);

  // Chart data with simulation applied
  const chartData = useMemo(() => {
    if (!data?.mensal) return [];

    const hasChanges = sliderConfigs.some(s => sliderValues[s.key] !== s.defaultValue);

    let cumulativeMrr = 0;
    let cumulativeSimMrr = 0;

    return data.mensal.map((m) => {
      cumulativeMrr += m.mrrPerdido;

      // Simulate: reduce churn for critico and alto tiers based on retention sliders
      let simMrrPerdido = m.mrrPerdido;
      if (hasChanges) {
        const defaultRetCritico = sliderConfigs[0].defaultValue / 100;
        const defaultRetAlto = sliderConfigs[1].defaultValue / 100;
        const newRetCritico = sliderValues.retencaoCritico / 100;
        const newRetAlto = sliderValues.retencaoAlto / 100;

        const criticoMrr = m.porTier?.critico ?? 0;
        const altoMrr = m.porTier?.alto ?? 0;

        // More retention = less MRR lost
        const savedCritico = criticoMrr * (newRetCritico - defaultRetCritico);
        const savedAlto = altoMrr * (newRetAlto - defaultRetAlto);
        simMrrPerdido = Math.max(0, m.mrrPerdido - savedCritico - savedAlto);
      }

      cumulativeSimMrr += simMrrPerdido;

      return {
        mes: m.mes,
        critico: m.porTier?.critico ?? 0,
        alto: m.porTier?.alto ?? 0,
        moderado: m.porTier?.moderado ?? 0,
        baixo: m.porTier?.baixo ?? 0,
        mrrAcumulado: cumulativeMrr,
        ...(hasChanges ? { mrrAcumuladoSim: cumulativeSimMrr } : {}),
      };
    });
  }, [data, sliderValues, sliderConfigs]);

  // Delta value for simulation panel
  const deltaValue = useMemo(() => {
    if (!chartData.length) return "";
    const last = chartData[chartData.length - 1];
    if (last.mrrAcumuladoSim === undefined) return "";
    const delta = last.mrrAcumulado - (last.mrrAcumuladoSim ?? last.mrrAcumulado);
    if (delta <= 0) return "";
    return `−R$ ${(delta / 1000).toFixed(0)}k salvo`;
  }, [chartData]);

  // Tier summary cards
  const tierEntries = useMemo(() => {
    if (!data?.porTier) return [];
    return Object.entries(data.porTier).sort((a, b) => b[1].mrr - a[1].mrr);
  }, [data]);

  const gridColor = isDark ? "#3f3f46" : "#e5e7eb";
  const axisColor = isDark ? "#a1a1aa" : "#6b7280";

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  return (
    <div className="space-y-4 mt-4">
      {/* Tier summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tierEntries.map(([tier, info]) => (
          <Card key={tier} className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: TIER_COLORS[tier] || "#6b7280" }}
                />
                <span className="text-xs font-medium text-gray-600 dark:text-zinc-400">
                  {TIER_LABELS[tier] || tier}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  {info.contratos}
                </span>
                <span className="text-xs text-gray-500 dark:text-zinc-500">contratos</span>
              </div>
              <div className="text-xs text-gray-500 dark:text-zinc-500 mt-1">
                R$ {(info.mrr / 1000).toFixed(1)}k MRR ·{" "}
                {(info.probabilidade * 100).toFixed(0)}% prob.
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart + Simulation */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        {/* ComposedChart: bars by tier + cumulative MRR line */}
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-zinc-300">
              Churn Projetado por Tier — {horizonte} meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  dataKey="mes"
                  tick={{ fontSize: 11, fill: axisColor }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: axisColor }}
                  tickFormatter={(v: number) => `R$ ${(v / 1000).toFixed(0)}k`}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: axisColor }}
                  tickFormatter={(v: number) => `R$ ${(v / 1000).toFixed(0)}k`}
                  tickLine={false}
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
                    name,
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                />

                {/* Stacked bars by tier */}
                <Bar yAxisId="left" dataKey="critico" stackId="tier" fill={TIER_COLORS.critico} name="Crítico" radius={[0, 0, 0, 0]} />
                <Bar yAxisId="left" dataKey="alto" stackId="tier" fill={TIER_COLORS.alto} name="Alto" />
                <Bar yAxisId="left" dataKey="moderado" stackId="tier" fill={TIER_COLORS.moderado} name="Moderado" />
                <Bar yAxisId="left" dataKey="baixo" stackId="tier" fill={TIER_COLORS.baixo} name="Baixo" radius={[4, 4, 0, 0]} />

                {/* Cumulative MRR lost line */}
                <Line
                  yAxisId="right"
                  dataKey="mrrAcumulado"
                  stroke={isDark ? "#a78bfa" : "#7c3aed"}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="MRR Perdido (acum.)"
                />

                {/* Simulated cumulative line */}
                {chartData.some(d => d.mrrAcumuladoSim !== undefined) && (
                  <Line
                    yAxisId="right"
                    dataKey="mrrAcumuladoSim"
                    stroke={isDark ? "#fbbf24" : "#d97706"}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    name="Simulação (acum.)"
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Simulation Panel */}
        <SimulationPanel
          sliders={sliderConfigs}
          values={sliderValues}
          onChange={setSliderValues}
          deltaLabel="MRR salvo vs baseline"
          deltaValue={deltaValue}
        />
      </div>

      {/* Top 10 Contracts at Risk */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-zinc-300">
              Top 10 Contratos em Risco
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-zinc-700">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-zinc-500">
                    Cliente
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-zinc-500">
                    MRR
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-zinc-500">
                    Score
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-zinc-500">
                    Probabilidade
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-zinc-500">
                    Squad
                  </th>
                </tr>
              </thead>
              <tbody>
                {(data?.topContratos || []).slice(0, 10).map((c, i) => (
                  <tr
                    key={c.contratoId}
                    className={`border-b border-gray-100 dark:border-zinc-800 ${
                      i % 2 === 0
                        ? "bg-gray-50/50 dark:bg-zinc-800/30"
                        : "bg-white dark:bg-zinc-900"
                    }`}
                  >
                    <td className="py-2.5 px-3 text-gray-900 dark:text-white font-medium">
                      {c.clienteNome}
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-700 dark:text-zinc-300 font-mono">
                      R$ {c.mrr.toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          c.score >= 80
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : c.score >= 60
                            ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                            : c.score >= 40
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                            : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        }`}
                      >
                        {c.score}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-700 dark:text-zinc-300 font-mono">
                      {(c.probabilidade * 100).toFixed(0)}%
                    </td>
                    <td className="py-2.5 px-3 text-gray-600 dark:text-zinc-400">
                      {c.squad}
                    </td>
                  </tr>
                ))}
                {(!data?.topContratos || data.topContratos.length === 0) && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-gray-400 dark:text-zinc-600 text-sm"
                    >
                      Nenhum contrato em risco identificado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
