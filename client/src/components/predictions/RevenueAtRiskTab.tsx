// client/src/components/predictions/RevenueAtRiskTab.tsx
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area,
} from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { SimulationPanel, type SliderConfig } from "./SimulationPanel";

// ============== TYPES ==============

interface TierData {
  contratos: number;
  mrr: number;
}

interface EvolucaoPoint {
  mes: string;
  critico: number;
  alto: number;
  moderado: number;
  baixo: number;
  total: number;
}

interface RevenueAtRiskData {
  porTier: Record<string, TierData>;
  evolucao: EvolucaoPoint[];
  efetividadeBase: number;
}

// ============== CONSTANTS ==============

const TIER_COLORS: Record<string, string> = {
  critico: "#ef4444",
  alto: "#f59e0b",
  moderado: "#eab308",
  baixo: "#22c55e",
};

const TIER_LABELS: Record<string, string> = {
  critico: "Critico",
  alto: "Alto",
  moderado: "Moderado",
  baixo: "Baixo",
};

const TIER_ORDER = ["critico", "alto", "moderado", "baixo"];

// ============== COMPONENT ==============

export function RevenueAtRiskTab({ horizonte }: { horizonte: number }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { data, isLoading } = useQuery<RevenueAtRiskData>({
    queryKey: ["/api/predictions/revenue-at-risk", { horizonte }],
  });

  const sliderConfigs: SliderConfig[] = useMemo(() => [
    {
      key: "efetividade",
      label: "Efetividade de intervencao CS",
      min: 0,
      max: 100,
      step: 5,
      defaultValue: Math.round((data?.efetividadeBase || 0.3) * 100),
      format: (v) => `${v}%`,
    },
  ], [data]);

  const [sliderValues, setSliderValues] = useState<Record<string, number>>({
    efetividade: Math.round((data?.efetividadeBase || 0.3) * 100),
  });

  // Atualizar defaults quando dados carregam
  useMemo(() => {
    if (data) {
      setSliderValues({
        efetividade: Math.round(data.efetividadeBase * 100),
      });
    }
  }, [data]);

  // Simulacao client-side: higher effectiveness moves MRR from critical -> alto, alto -> moderado
  const simulatedTiers = useMemo(() => {
    if (!data?.porTier) return [];

    const baseEfetividade = data.efetividadeBase;
    const currentEfetividade = sliderValues.efetividade / 100;
    const delta = currentEfetividade - baseEfetividade;

    const tiers = { ...data.porTier };
    const critico = { ...tiers.critico } || { contratos: 0, mrr: 0 };
    const alto = { ...tiers.alto } || { contratos: 0, mrr: 0 };
    const moderado = { ...tiers.moderado } || { contratos: 0, mrr: 0 };
    const baixo = { ...tiers.baixo } || { contratos: 0, mrr: 0 };

    if (delta > 0) {
      // Move portion of critical MRR to alto
      const criticoMove = critico.mrr * delta * 0.6;
      critico.mrr = Math.max(0, critico.mrr - criticoMove);
      alto.mrr = alto.mrr + criticoMove * 0.5;

      // Move portion of alto MRR to moderado
      const altoMove = alto.mrr * delta * 0.4;
      alto.mrr = Math.max(0, alto.mrr - altoMove);
      moderado.mrr = moderado.mrr + altoMove * 0.5;
      baixo.mrr = baixo.mrr + criticoMove * 0.5 + altoMove * 0.5;
    }

    return TIER_ORDER.map((tier) => {
      const original = data.porTier[tier] || { contratos: 0, mrr: 0 };
      const simulated = { critico, alto, moderado, baixo }[tier]!;
      return {
        tier,
        label: TIER_LABELS[tier],
        contratos: original.contratos,
        mrr: Math.round(simulated.mrr),
        mrrOriginal: original.mrr,
      };
    });
  }, [data, sliderValues]);

  const deltaValue = useMemo(() => {
    if (!data?.porTier || !simulatedTiers.length) return "";
    const originalTotal = Object.values(data.porTier).reduce((sum, t) => sum + t.mrr, 0);
    const criticoOriginal = (data.porTier.critico?.mrr || 0) + (data.porTier.alto?.mrr || 0);
    const criticoSimulated = (simulatedTiers.find(t => t.tier === "critico")?.mrr || 0)
      + (simulatedTiers.find(t => t.tier === "alto")?.mrr || 0);
    const saved = criticoOriginal - criticoSimulated;
    if (saved === 0) return "";
    const sign = saved >= 0 ? "-" : "+";
    return `${sign}R$ ${Math.abs(Math.round(saved / 1000))}k em risco`;
  }, [data, simulatedTiers]);

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        {/* Horizontal BarChart - MRR por Tier */}
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-zinc-300">
              MRR em Risco por Tier
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={simulatedTiers} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#3f3f46" : "#e5e7eb"} />
                <XAxis
                  type="number"
                  tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }}
                />
                <YAxis
                  type="category"
                  dataKey="label"
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
                    name === "mrr" ? "MRR" : name,
                  ]}
                  labelFormatter={(label) => `Tier: ${label}`}
                />
                <Bar dataKey="mrr" radius={[0, 4, 4, 0]}>
                  {simulatedTiers.map((entry) => (
                    <Cell key={entry.tier} fill={TIER_COLORS[entry.tier]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Legend with contract counts */}
            <div className="flex flex-wrap gap-4 mt-3 px-2">
              {simulatedTiers.map((t) => (
                <div key={t.tier} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-zinc-400">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TIER_COLORS[t.tier] }} />
                  {t.label}: {t.contratos} contratos
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Simulador */}
        <SimulationPanel
          sliders={sliderConfigs}
          values={sliderValues}
          onChange={setSliderValues}
          deltaLabel="Impacto da intervencao"
          deltaValue={deltaValue}
        />
      </div>

      {/* Evolucao temporal - Revenue at Risk ultimos 6 meses */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-700 dark:text-zinc-300">
            Evolucao de Revenue at Risk
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data?.evolucao || []} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#3f3f46" : "#e5e7eb"} />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }}
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
                  TIER_LABELS[name] || name,
                ]}
              />
              <Area
                type="monotone"
                dataKey="critico"
                stackId="1"
                stroke={TIER_COLORS.critico}
                fill={TIER_COLORS.critico}
                fillOpacity={0.7}
              />
              <Area
                type="monotone"
                dataKey="alto"
                stackId="1"
                stroke={TIER_COLORS.alto}
                fill={TIER_COLORS.alto}
                fillOpacity={0.7}
              />
              <Area
                type="monotone"
                dataKey="moderado"
                stackId="1"
                stroke={TIER_COLORS.moderado}
                fill={TIER_COLORS.moderado}
                fillOpacity={0.7}
              />
              <Area
                type="monotone"
                dataKey="baixo"
                stackId="1"
                stroke={TIER_COLORS.baixo}
                fill={TIER_COLORS.baixo}
                fillOpacity={0.7}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
