// client/src/pages/gestao/AnalisePreditiva.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Activity, AlertTriangle, ShieldAlert } from "lucide-react";
import { AccuracyBadge } from "@/components/predictions/AccuracyBadge";
// Tab components will be created in subsequent tasks
// import { MrrForecastTab } from "@/components/predictions/MrrForecastTab";
// import { ChurnForecastTab } from "@/components/predictions/ChurnForecastTab";
// import { NrrProjectionTab } from "@/components/predictions/NrrProjectionTab";
// import { InadimplenciaForecastTab } from "@/components/predictions/InadimplenciaForecastTab";
// import { RevenueAtRiskTab } from "@/components/predictions/RevenueAtRiskTab";

function formatCurrencyCompact(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return `R$ ${value.toFixed(0)}`;
}

export default function AnalisePreditiva() {
  usePageTitle("Análise Preditiva");
  useSetPageInfo("Análise Preditiva", "Projeções e simulações de cenários");

  const [horizonte, setHorizonte] = useState<string>("6");
  const [abaAtiva, setAbaAtiva] = useState("mrr");

  const { data: summary, isLoading } = useQuery<{
    mrrProjetado: { valorOtimista: number; valorRealista: number; valorPessimista: number };
    churnProjetado: { contratos: number; mrr: number };
    nrrProjetado: number;
    acuracia: Record<string, number>;
  }>({
    queryKey: ["/api/predictions/summary", { horizonte }],
  });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Análise Preditiva
            </h1>
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              Projeções baseadas em dados históricos com simulação de cenários
            </p>
          </div>
        </div>
        <Select value={horizonte} onValueChange={setHorizonte}>
          <SelectTrigger className="w-40 bg-white dark:bg-zinc-900">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">3 meses</SelectItem>
            <SelectItem value="6">6 meses</SelectItem>
            <SelectItem value="12">12 meses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Hero KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardContent className="pt-5 pb-4">
            {isLoading ? <Skeleton className="h-12 w-32" /> : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
                    MRR Projetado ({horizonte}m)
                  </span>
                  <AccuracyBadge accuracy={summary?.acuracia?.mrr_forecast} label="MRR" />
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrencyCompact(summary?.mrrProjetado?.valorRealista || 0)}
                </div>
                <div className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                  {formatCurrencyCompact(summary?.mrrProjetado?.valorPessimista || 0)} — {formatCurrencyCompact(summary?.mrrProjetado?.valorOtimista || 0)}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardContent className="pt-5 pb-4">
            {isLoading ? <Skeleton className="h-12 w-32" /> : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
                    Churn Projetado ({horizonte}m)
                  </span>
                  <AccuracyBadge accuracy={summary?.acuracia?.churn_forecast} label="Churn" />
                </div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatCurrencyCompact(summary?.churnProjetado?.mrr || 0)}
                </div>
                <div className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                  ~{summary?.churnProjetado?.contratos || 0} contratos
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardContent className="pt-5 pb-4">
            {isLoading ? <Skeleton className="h-12 w-32" /> : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
                    NRR Projetado
                  </span>
                  <AccuracyBadge accuracy={summary?.acuracia?.nrr_projection} label="NRR" />
                </div>
                <div className={`text-2xl font-bold ${
                  (summary?.nrrProjetado || 100) >= 100
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {(summary?.nrrProjetado || 100).toFixed(1)}%
                </div>
                <div className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                  {(summary?.nrrProjetado || 100) >= 100 ? 'Base crescendo' : 'Base encolhendo'}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
        <TabsList className="bg-gray-100 dark:bg-zinc-800">
          <TabsTrigger value="mrr" className="gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> MRR
          </TabsTrigger>
          <TabsTrigger value="churn" className="gap-1.5">
            <TrendingDown className="w-3.5 h-3.5" /> Churn
          </TabsTrigger>
          <TabsTrigger value="nrr" className="gap-1.5">
            <Activity className="w-3.5 h-3.5" /> NRR
          </TabsTrigger>
          <TabsTrigger value="inadimplencia" className="gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Inadimplência
          </TabsTrigger>
          <TabsTrigger value="risk" className="gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" /> Risk
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mrr">
          {/* <MrrForecastTab horizonte={parseInt(horizonte)} /> */}
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <CardContent className="py-12 text-center text-gray-400 dark:text-zinc-500">
              MRR Forecast — em desenvolvimento
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="churn">
          {/* <ChurnForecastTab horizonte={parseInt(horizonte)} /> */}
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <CardContent className="py-12 text-center text-gray-400 dark:text-zinc-500">
              Churn Forecast — em desenvolvimento
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="nrr">
          {/* <NrrProjectionTab horizonte={parseInt(horizonte)} /> */}
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <CardContent className="py-12 text-center text-gray-400 dark:text-zinc-500">
              NRR Projection — em desenvolvimento
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="inadimplencia">
          {/* <InadimplenciaForecastTab horizonte={parseInt(horizonte)} /> */}
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <CardContent className="py-12 text-center text-gray-400 dark:text-zinc-500">
              Inadimplência Forecast — em desenvolvimento
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="risk">
          {/* <RevenueAtRiskTab horizonte={parseInt(horizonte)} /> */}
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <CardContent className="py-12 text-center text-gray-400 dark:text-zinc-500">
              Revenue at Risk — em desenvolvimento
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
