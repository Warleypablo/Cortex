import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";

import { toast } from "sonner";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrency, formatCurrencyNoDecimals } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import { type ChurnContract, type ChurnDetalhamentoData } from "@/components/churn/types";
import { ChurnControls } from "@/components/churn/ChurnControls";
import { ChurnKpisHero } from "@/components/churn/ChurnKpisHero";
import { CrossSellDrillDrawer, type CrosssellDeal } from "@/components/churn/CrossSellDrillDrawer";
import { ChurnDrillDrawer } from "@/components/churn/ChurnDrillDrawer";
import { RitmoDiario } from "@/components/churn/RitmoDiario";
import { ChurnHistoricoMensal } from "@/components/churn/ChurnHistoricoMensal";
import { ChurnPorDimensao } from "@/components/churn/ChurnPorDimensao";
import { ChurnForecast } from "@/components/churn/ChurnForecast";

import { format, parseISO, startOfMonth, endOfMonth, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";



export default function ChurnDetalhamento() {
  usePageTitle("Detalhamento de Churn");
  useSetPageInfo("Detalhamento de Churn", "Análise detalhada de contratos encerrados");

  // BP 2026 - MRR planejado por mês (para calcular taxa de churn)
  const BP_MRR_TARGETS: Record<string, number> = {
    "2026-01": 1156850, "2026-02": 1267734, "2026-03": 1368637,
    "2026-04": 1485460, "2026-05": 1591769, "2026-06": 1688510,
    "2026-07": 1806544, "2026-08": 1913955, "2026-09": 2011699,
    "2026-10": 2130646, "2026-11": 2238888, "2026-12": 2337388,
  };

  // BP 2026 - Metas mensais de churn MRR (planejado estático)
  const BP_CHURN_MRR_TARGETS: Record<string, number> = {
    "2026-01": 104117, "2026-02": 114096, "2026-03": 123177,
    "2026-04": 133691, "2026-05": 143259, "2026-06": 151966,
    "2026-07": 162589, "2026-08": 172256, "2026-09": 181053,
    "2026-10": 191758, "2026-11": 201500, "2026-12": 210365,
  };

  // Taxa de churn planejada por mês (%) = churn_bp / mrr_bp
  const getChurnRateBP = (monthKey: string): number => {
    const mrrBP = BP_MRR_TARGETS[monthKey];
    const churnBP = BP_CHURN_MRR_TARGETS[monthKey];
    if (!mrrBP || !churnBP) return 0;
    return churnBP / mrrBP;
  };

  const [dataInicio, setDataInicio] = useState<string>(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState<string>(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [filterAbono, setFilterAbono] = useState<"todos" | "abonados" | "nao_abonados">("todos");

  const [abonadoOverrides, setAbonadoOverrides] = useState<Record<string, boolean>>({});
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [drill, setDrill] = useState<{ titulo: string; contratos: ChurnContract[] } | null>(null);
  const onDrill = (titulo: string, contratos: ChurnContract[]) => setDrill({ titulo, contratos });
  const [nrrDrillOpen, setNrrDrillOpen] = useState(false);
  const queryClient = useQueryClient();

  // Deals de cross-sell/up-sell do período — buscados só quando o drawer do NRR abre
  const { data: crosssellDeals, isLoading: isLoadingCrosssell } = useQuery<{
    items: CrosssellDeal[];
    total_recorrente: number;
    total_pontual: number;
    count: number;
  }>({
    queryKey: ["/api/analytics/nrr/crosssell-deals", dataInicio, dataFim],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate: dataInicio, endDate: dataFim });
      const res = await fetch(`/api/analytics/nrr/crosssell-deals?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch cross-sell deals");
      return res.json();
    },
    enabled: nrrDrillOpen && !!dataInicio && !!dataFim,
  });

  const abonarMutation = useMutation({
    mutationFn: async ({ taskId, abonar }: { taskId: string; abonar: boolean }) => {
      const res = await fetch(`/api/churn/abonar/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ abonar }),
      });
      if (!res.ok) throw new Error("Falha ao atualizar");
      return res.json();
    },
    onMutate: ({ taskId, abonar }) => {
      setAbonadoOverrides(prev => ({ ...prev, [taskId]: abonar }));
      setPendingIds(prev => new Set(prev).add(taskId));
    },
    onError: (_err, { taskId }) => {
      setAbonadoOverrides(prev => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      setPendingIds(prev => { const s = new Set(prev); s.delete(taskId); return s; });
      toast.error("Erro ao atualizar abono");
    },
    onSuccess: (_data, { taskId }) => {
      setPendingIds(prev => { const s = new Set(prev); s.delete(taskId); return s; });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/churn-detalhamento"] });
    },
  });

  const onToggleAbono = (taskId: string, abonar: boolean) => abonarMutation.mutate({ taskId, abonar });

  // Buscar série de churn do ano para calcular excesso acumulado de meses anteriores
  const currentMonthKey = dataInicio ? format(parseISO(dataInicio), "yyyy-MM") : "";
  const { data: churnSeriesData } = useQuery<{ series: { date: string; value: number }[] }>({
    queryKey: ["/api/okr2026/metric-series", "churn", "2026-01", currentMonthKey],
    queryFn: async () => {
      const res = await fetch(`/api/okr2026/metric-series?metricKey=churn&start=2026-01&end=${currentMonthKey}`);
      if (!res.ok) throw new Error("Failed to fetch churn series");
      return res.json();
    },
    enabled: !!currentMonthKey && currentMonthKey > "2026-01",
  });

  // Calcular excesso acumulado de churn de meses anteriores ao mês selecionado
  const churnExcessFromPreviousMonths = useMemo(() => {
    if (!churnSeriesData?.series || !currentMonthKey || currentMonthKey <= "2026-01") return 0;
    let totalExcess = 0;
    for (const entry of churnSeriesData.series) {
      if (entry.date >= currentMonthKey) continue; // ignorar mês atual e futuros
      const mrrBP = BP_MRR_TARGETS[entry.date];
      const churnBP = BP_CHURN_MRR_TARGETS[entry.date];
      if (!mrrBP || !churnBP) continue;
      const rate = churnBP / mrrBP;
      // Para o target dinâmico do mês anterior, usamos o BP estático como aproximação
      // (o MRR real daquele mês não está disponível aqui)
      const targetForMonth = mrrBP * rate; // = churnBP
      if (entry.value > targetForMonth) {
        totalExcess += entry.value - targetForMonth;
      }
    }
    return totalExcess;
  }, [churnSeriesData, currentMonthKey]);

  const { data: nrrData } = useQuery<{ nrr_pct: number; crosssell_mrr: number; crosssell_pontual: number; vendas_mrr_novo: number; vendas_mrr_total: number; gross_churn_mrr: number; mrr_inicio: number }>({
    queryKey: ["/api/analytics/nrr", dataInicio, dataFim],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dataInicio) params.set("startDate", dataInicio);
      if (dataFim) params.set("endDate", dataFim);
      const res = await fetch(`/api/analytics/nrr?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch NRR data");
      return res.json();
    },
  });

  const { data, isLoading, error } = useQuery<ChurnDetalhamentoData>({
    queryKey: ["/api/analytics/churn-detalhamento", dataInicio, dataFim],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dataInicio) params.set("startDate", dataInicio);
      if (dataFim) params.set("endDate", dataFim);
      const res = await fetch(`/api/analytics/churn-detalhamento?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch churn data");
      return res.json();
    },
  });

  const filteredContratos = useMemo(() => {
    if (!data?.contratos) return [];

    let filtered = [...data.contratos];

    // Filter by date using the correct date column for each type:
    // - Churn: uses data_encerramento
    // - Pausado: uses data_pausa
    if (dataInicio) {
      const inicio = new Date(dataInicio);
      filtered = filtered.filter(c => {
        const refDate = c.tipo === 'pausado' ? c.data_pausa : c.data_encerramento;
        return refDate && new Date(refDate) >= inicio;
      });
    }

    if (dataFim) {
      const fim = new Date(dataFim);
      fim.setHours(23, 59, 59, 999);
      filtered = filtered.filter(c => {
        const refDate = c.tipo === 'pausado' ? c.data_pausa : c.data_encerramento;
        return refDate && new Date(refDate) <= fim;
      });
    }

    // Filtro de abono
    if (filterAbono !== "todos") {
      filtered = filtered.filter(c => {
        const isAbonado = abonadoOverrides[c.id] ?? c.is_abonado ?? false;
        return filterAbono === "abonados" ? isAbonado : !isAbonado;
      });
      if (filterAbono === "abonados") {
        // Abonados viram a população analisada: sem o flag, todos os
        // cálculos (taxa, squads, motivos, gráficos) os tratam como churn
        filtered = filtered.map(c => ({ ...c, is_abonado: false }));
      }
    }

    // Default stable sort: most recent encerramento first
    filtered.sort((a, b) => {
      const dateA = a.data_encerramento || a.data_pausa || '';
      const dateB = b.data_encerramento || b.data_pausa || '';
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    return filtered;
  }, [data?.contratos, dataInicio, dataFim, filterAbono, abonadoOverrides]);

  const filteredMetricas = useMemo(() => {
    if (filteredContratos.length === 0) {
      return { total_churned: 0, total_pausados: 0, mrr_perdido: 0, mrr_pausado: 0, ltv_total: 0, lt_medio: 0, ticket_medio: 0, total_abonado: 0, mrr_abonado: 0, abonado_por_motivo: {} as Record<string, { count: number; mrr: number }> };
    }

    // O filtro por abono já foi aplicado em filteredContratos (toggle Todos/Não abonados/Abonados).
    // Por padrão ("Todos") os abonados CONTAM como churn — alinhado ao ClickUp.
    const churns = filteredContratos;
    const abonados = filteredContratos.filter(c => c.is_abonado);

    const totalChurned = churns.length;
    const totalPausados = 0;
    const mrrPerdido = churns.reduce((sum, c) => sum + (c.valorr || 0), 0);
    const mrrPausado = 0;
    const ltvTotal = churns.reduce((sum, c) => sum + (c.ltv || 0), 0);
    const ltMedio = totalChurned > 0 ? churns.reduce((sum, c) => sum + (c.lifetime_meses || 0), 0) / totalChurned : 0;
    const ticketMedio = totalChurned > 0 ? mrrPerdido / totalChurned : 0;

    const totalAbonado = abonados.length;
    const mrrAbonado = abonados.reduce((sum, c) => sum + (c.valorr || 0), 0);

    // Breakdown abonado por motivo
    const abonadoPorMotivo: Record<string, { count: number; mrr: number }> = {};
    abonados.forEach(c => {
      const motivo = c.motivo_cancelamento || 'Outros';
      if (!abonadoPorMotivo[motivo]) abonadoPorMotivo[motivo] = { count: 0, mrr: 0 };
      abonadoPorMotivo[motivo].count++;
      abonadoPorMotivo[motivo].mrr += c.valorr || 0;
    });

    return {
      total_churned: totalChurned,
      total_pausados: totalPausados,
      mrr_perdido: mrrPerdido,
      mrr_pausado: mrrPausado,
      ltv_total: ltvTotal,
      lt_medio: ltMedio,
      ticket_medio: ticketMedio,
      total_abonado: totalAbonado,
      mrr_abonado: mrrAbonado,
      abonado_por_motivo: abonadoPorMotivo,
    };
  }, [filteredContratos]);

  // MRR base dinâmico: usa MRR real do período quando disponível
  const mrrBaseReal = data?.metricas?.mrr_ativo_ref ?? 0;
  // Soma dos MRR bases de cada mês (para média ponderada em ranges multi-mês)
  const somaMrrBases = data?.metricas?.soma_mrr_bases ?? mrrBaseReal;
  // Denominador efetivo da taxa de churn — exibido no card para tornar o cálculo auditável
  const mrrBaseCalculo = somaMrrBases > 0 ? somaMrrBases : mrrBaseReal;

  const filteredTaxaChurn = useMemo(() => {
    // Usar soma dos MRR bases para média ponderada correta em ranges multi-mês
    const mrrBase = somaMrrBases > 0 ? somaMrrBases : mrrBaseReal;
    const mrrPerdido = filteredMetricas.mrr_perdido;
    return mrrBase > 0 ? (mrrPerdido / mrrBase) * 100 : 0;
  }, [filteredMetricas.mrr_perdido, somaMrrBases, mrrBaseReal]);

  // ── KPIs do topo (FIXOS — independem do toggle de abono) ────────────────────
  // Os cards Churn Bruto / Churn Ajustado / NRR são SEMPRE sobre a população
  // do período (só filtrada por data). O toggle "Todos/Não abonados/Abonados"
  // filtra apenas a tabela e os gráficos abaixo.
  const heroContratos = useMemo(() => {
    if (!data?.contratos) return [] as any[];
    let filtered = [...data.contratos];
    if (dataInicio) {
      const inicio = new Date(dataInicio);
      filtered = filtered.filter((c: any) => {
        const refDate = c.tipo === 'pausado' ? c.data_pausa : c.data_encerramento;
        return refDate && new Date(refDate) >= inicio;
      });
    }
    if (dataFim) {
      const fim = new Date(dataFim);
      fim.setHours(23, 59, 59, 999);
      filtered = filtered.filter((c: any) => {
        const refDate = c.tipo === 'pausado' ? c.data_pausa : c.data_encerramento;
        return refDate && new Date(refDate) <= fim;
      });
    }
    return filtered;
  }, [data?.contratos, dataInicio, dataFim]);

  const heroMetricas = useMemo(() => {
    const churns = heroContratos;
    const isAbon = (c: any) => (abonadoOverrides[c.id] ?? c.is_abonado ?? false);
    const churnTotal = churns.reduce((s: number, c: any) => s + (c.valorr || 0), 0);
    const abonados = churns.filter(isAbon);
    const mrrAbonado = abonados.reduce((s: number, c: any) => s + (c.valorr || 0), 0);
    const logos = churns.length;
    const ltMedio = logos > 0 ? churns.reduce((s: number, c: any) => s + (c.lifetime_meses || 0), 0) / logos : 0;
    const ticketMedio = logos > 0 ? churnTotal / logos : 0;
    return {
      churnTotal,
      churnSemAbonados: churnTotal - mrrAbonado,
      mrrAbonado,
      abonadoCount: abonados.length,
      logos,
      ltMedio,
      ticketMedio,
    };
  }, [heroContratos, abonadoOverrides]);

  const heroTaxaChurn = useMemo(() => {
    const mrrBase = somaMrrBases > 0 ? somaMrrBases : mrrBaseReal;
    return mrrBase > 0 ? (heroMetricas.churnTotal / mrrBase) * 100 : 0;
  }, [heroMetricas.churnTotal, somaMrrBases, mrrBaseReal]);

  const churnDailyInsights = useMemo(() => {
    const mrrBase = mrrBaseReal;
    const monthKey = dataInicio ? format(parseISO(dataInicio), "yyyy-MM") : "";
    const churnRate = getChurnRateBP(monthKey);
    const churnTargetBase = mrrBase > 0 ? mrrBase * churnRate : 0;
    const churnTarget = Math.max(0, churnTargetBase - churnExcessFromPreviousMonths);
    const churnTargetPct = mrrBase > 0 ? (churnTarget / mrrBase) * 100 : 0;
    const churnSpent = filteredMetricas.mrr_perdido || 0;

    const periodStart = dataInicio ? parseISO(dataInicio) : null;
    const periodEnd = dataFim ? parseISO(dataFim) : null;
    let totalDays = 0;
    if (periodStart && periodEnd) {
      totalDays = differenceInCalendarDays(periodEnd, periodStart) + 1;
      if (totalDays < 0) totalDays = 0;
    }

    const today = new Date();
    let elapsedDays = 0;
    if (periodStart && periodEnd && totalDays > 0) {
      const effectiveEnd = today < periodStart ? periodStart : today > periodEnd ? periodEnd : today;
      elapsedDays = differenceInCalendarDays(effectiveEnd, periodStart) + 1;
      if (elapsedDays < 0) elapsedDays = 0;
      if (elapsedDays > totalDays) elapsedDays = totalDays;
    }

    const remainingDays = Math.max(totalDays - elapsedDays, 0);
    const remainingBudget = churnTarget - churnSpent;
    const dailyIdeal = totalDays > 0 ? churnTarget / totalDays : 0;
    const dailyActual = elapsedDays > 0 ? churnSpent / elapsedDays : 0;
    const progressPct = churnTarget > 0 ? (churnSpent / churnTarget) * 100 : 0;
    const pacePct = dailyIdeal > 0 ? (dailyActual / dailyIdeal) * 100 : 0;

    let status: "on_track" | "warning" | "critical" | "over_budget" | "future";
    if (periodStart && today < periodStart) {
      status = "future";
    } else if (remainingBudget < 0) {
      status = "over_budget";
    } else if (pacePct <= 100) {
      status = "on_track";
    } else if (pacePct <= 115) {
      status = "warning";
    } else {
      status = "critical";
    }

    return {
      churnTargetPct,
      churnTarget,
      churnSpent,
      remainingBudget,
      totalDays,
      elapsedDays,
      remainingDays,
      dailyIdeal,
      dailyActual,
      progressPct,
      pacePct,
      status,
    };
  }, [filteredMetricas.mrr_perdido, dataInicio, dataFim, mrrBaseReal, churnExcessFromPreviousMonths]);

  // Severity color for compact Observatório strip: over 100% pace = worse
  const paceColor = churnDailyInsights.status === "on_track"
    ? "text-emerald-600 dark:text-emerald-400"
    : churnDailyInsights.status === "warning"
    ? "text-amber-600 dark:text-amber-400"
    : churnDailyInsights.status === "future"
    ? "text-slate-500 dark:text-slate-400"
    : "text-red-600 dark:text-red-400";

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-muted-foreground">Erro ao carregar dados de churn</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <ChurnControls
        dataInicio={dataInicio}
        dataFim={dataFim}
        onChangePeriodo={(inicio, fim) => { setDataInicio(inicio); setDataFim(fim); }}
        filterAbono={filterAbono}
        onChangeAbono={setFilterAbono}
      />

      {/* Painel Executivo Hero - KPIs de Diagnóstico */}
      {!isLoading && data?.metricas?.mrr_ativo_ref !== undefined && (
        <ChurnKpisHero
          contratos={heroContratos}
          churnTotal={heroMetricas.churnTotal}
          churnSemAbonados={heroMetricas.churnSemAbonados}
          mrrAbonado={heroMetricas.mrrAbonado}
          abonadoCount={heroMetricas.abonadoCount}
          taxaChurn={heroTaxaChurn}
          mrrBase={mrrBaseCalculo}
          nrrPct={nrrData?.nrr_pct}
          ltMedio={heroMetricas.ltMedio}
          ticketMedio={heroMetricas.ticketMedio}
          onDrill={onDrill}
          onNrrClick={() => setNrrDrillOpen(true)}
        />
      )}

      {/* Ritmo Diário — série por dia do período */}
      {!isLoading && (
        <RitmoDiario contratos={filteredContratos} onDrill={onDrill} />
      )}

      {/* Observatório compacto: meta/gasto/saldo/ritmo em uma linha */}
      {!isLoading && churnDailyInsights.churnTarget > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 rounded-lg border border-border/50 bg-muted/30 text-xs text-muted-foreground">
          <span>
            Meta do período:{" "}
            <span className="font-semibold text-foreground">
              {formatCurrencyNoDecimals(churnDailyInsights.churnTarget)}
            </span>
          </span>
          <span className="text-border/60">·</span>
          <span>
            Gasto:{" "}
            <span className="font-semibold text-foreground">
              {formatCurrencyNoDecimals(churnDailyInsights.churnSpent)}
            </span>
          </span>
          <span className="text-border/60">·</span>
          <span>
            Saldo:{" "}
            <span className={`font-semibold ${churnDailyInsights.remainingBudget >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {formatCurrencyNoDecimals(churnDailyInsights.remainingBudget)}
            </span>
          </span>
          <span className="text-border/60">·</span>
          <span>
            Ritmo:{" "}
            <span className={`font-semibold ${paceColor}`}>
              {churnDailyInsights.pacePct.toFixed(0)}% do ideal
            </span>
          </span>
        </div>
      )}

      {/* Churn por Dimensão — seletor único com ranking */}
      {!isLoading && (
        <ChurnPorDimensao
          contratos={filteredContratos}
          onDrill={onDrill}
          churnPorSquad={data?.metricas?.churn_por_squad}
          churnPorPessoa={data?.metricas?.churn_por_pessoa}
        />
      )}

      {/* Histórico mensal de churn do ano (mesma régua da tela) */}
      <ChurnHistoricoMensal filterAbono={filterAbono} />

      {/* Forecast Churn — indicador antecedente, foto do agora. Fica por último:
          é a única seção que não respeita o período selecionado no topo. */}
      <ChurnForecast />

      <ChurnDrillDrawer
        open={!!drill}
        titulo={drill?.titulo ?? ""}
        contratos={drill?.contratos ?? []}
        onClose={() => setDrill(null)}
        onToggleAbono={onToggleAbono}
        pendingIds={pendingIds}
        abonadoOverrides={abonadoOverrides}
        basePorResponsavel={data?.metricas?.soma_mrr_bases_por_pessoa}
      />

      <CrossSellDrillDrawer
        open={nrrDrillOpen}
        onClose={() => setNrrDrillOpen(false)}
        deals={crosssellDeals?.items ?? []}
        totalRecorrente={crosssellDeals?.total_recorrente ?? 0}
        totalPontual={crosssellDeals?.total_pontual ?? 0}
        isLoading={isLoadingCrosssell}
      />
    </div>
  );
}
