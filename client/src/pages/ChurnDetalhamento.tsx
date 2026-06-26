import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrency, formatCurrencyNoDecimals } from "@/lib/utils";
import {
  TrendingDown,
  DollarSign,
  AlertTriangle,
  Clock,
  BarChart3,
  Target,
} from "lucide-react";
import { type ChurnContract, type ChurnDetalhamentoData } from "@/components/churn/types";
import { ChurnControls } from "@/components/churn/ChurnControls";
import { ChurnKpisHero } from "@/components/churn/ChurnKpisHero";
import { ChurnDrillDrawer } from "@/components/churn/ChurnDrillDrawer";
import { RitmoDiario } from "@/components/churn/RitmoDiario";
import { ChurnPorDimensao } from "@/components/churn/ChurnPorDimensao";
import { TechKpiCard } from "@/components/churn/ui/TechKpiCard";
import { format, parseISO, startOfMonth, endOfMonth, differenceInCalendarDays, getDaysInMonth } from "date-fns";
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

  const [searchTerm, setSearchTerm] = useState("");
  const [filterSquads, setFilterSquads] = useState<string[]>([]);
  const [filterProdutos, setFilterProdutos] = useState<string[]>([]);
  const [filterResponsaveis, setFilterResponsaveis] = useState<string[]>([]);
  const [filterServicos, setFilterServicos] = useState<string[]>([]);
  const [filterPlanos, setFilterPlanos] = useState<string[]>([]);
  const [filterClusters, setFilterClusters] = useState<string[]>([]);
  const [filterEvitabilidades, setFilterEvitabilidades] = useState<string[]>([]);
  const [filterPossibilidadesRetencao, setFilterPossibilidadesRetencao] = useState<string[]>([]);
  const [dataInicio, setDataInicio] = useState<string>(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState<string>(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [sortBy, setSortBy] = useState<string>("data_encerramento");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterAbono, setFilterAbono] = useState<"todos" | "abonados" | "nao_abonados">("todos");

  const [abonadoOverrides, setAbonadoOverrides] = useState<Record<string, boolean>>({});
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [drill, setDrill] = useState<{ titulo: string; contratos: ChurnContract[] } | null>(null);
  const onDrill = (titulo: string, contratos: ChurnContract[]) => setDrill({ titulo, contratos });
  const queryClient = useQueryClient();

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

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.cliente_nome?.toLowerCase().includes(term) ||
        c.cnpj?.includes(term) ||
        c.produto?.toLowerCase().includes(term) ||
        c.responsavel?.toLowerCase().includes(term)
      );
    }

    if (filterSquads.length > 0) {
      filtered = filtered.filter(c => filterSquads.includes(c.squad));
    }

    if (filterProdutos.length > 0) {
      filtered = filtered.filter(c => filterProdutos.includes(c.produto));
    }

    if (filterResponsaveis.length > 0) {
      filtered = filtered.filter(c => filterResponsaveis.includes(c.responsavel));
    }

    if (filterServicos.length > 0) {
      filtered = filtered.filter(c => c.servico && filterServicos.includes(c.servico));
    }

    if (filterPlanos.length > 0) {
      filtered = filtered.filter(c => c.plano && filterPlanos.includes(c.plano));
    }

    if (filterClusters.length > 0) {
      filtered = filtered.filter(c => c.cluster && filterClusters.includes(c.cluster));
    }

    if (filterEvitabilidades.length > 0) {
      filtered = filtered.filter(c => c.evitabilidade_churn && filterEvitabilidades.includes(c.evitabilidade_churn));
    }

    if (filterPossibilidadesRetencao.length > 0) {
      filtered = filtered.filter(c => c.possibilidade_retencao && filterPossibilidadesRetencao.includes(c.possibilidade_retencao));
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

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "data_encerramento":
          const dateA = a.data_encerramento || a.data_pausa || '';
          const dateB = b.data_encerramento || b.data_pausa || '';
          comparison = new Date(dateA).getTime() - new Date(dateB).getTime();
          break;
        case "valorr":
          comparison = a.valorr - b.valorr;
          break;
        case "lifetime_meses":
          comparison = a.lifetime_meses - b.lifetime_meses;
          break;
        case "ltv":
          comparison = a.ltv - b.ltv;
          break;
        case "cliente_nome":
          comparison = (a.cliente_nome || "").localeCompare(b.cliente_nome || "");
          break;
        default:
          comparison = 0;
      }
      return sortOrder === "desc" ? -comparison : comparison;
    });

    return filtered;
  }, [data?.contratos, searchTerm, filterSquads, filterProdutos, filterResponsaveis, filterServicos, filterPlanos, filterClusters, filterEvitabilidades, filterPossibilidadesRetencao, dataInicio, dataFim, sortBy, sortOrder, filterAbono, abonadoOverrides]);

  const filteredMetricas = useMemo(() => {
    if (filteredContratos.length === 0) {
      return { total_churned: 0, total_pausados: 0, mrr_perdido: 0, mrr_pausado: 0, ltv_total: 0, lt_medio: 0, ticket_medio: 0, total_abonado: 0, mrr_abonado: 0, abonado_por_motivo: {} as Record<string, { count: number; mrr: number }> };
    }

    // Separar contratos regulares de abonados
    const regulares = filteredContratos.filter(c => !c.is_abonado);
    const abonados = filteredContratos.filter(c => c.is_abonado);

    const totalChurned = regulares.length;
    const totalPausados = 0;
    const mrrPerdido = regulares.reduce((sum, c) => sum + (c.valorr || 0), 0);
    const mrrPausado = 0;
    const ltvTotal = regulares.reduce((sum, c) => sum + (c.ltv || 0), 0);
    const ltMedio = totalChurned > 0 ? regulares.reduce((sum, c) => sum + (c.lifetime_meses || 0), 0) / totalChurned : 0;
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

  const filteredTaxaChurn = useMemo(() => {
    // Usar soma dos MRR bases para média ponderada correta em ranges multi-mês
    const mrrBase = somaMrrBases > 0 ? somaMrrBases : mrrBaseReal;
    const mrrPerdido = filteredMetricas.mrr_perdido;
    return mrrBase > 0 ? (mrrPerdido / mrrBase) * 100 : 0;
  }, [filteredMetricas.mrr_perdido, somaMrrBases, mrrBaseReal]);

  // Meta planejada pro-rateada até hoje (BP 2026) — DINÂMICA baseada no MRR real
  const churnPlanejado = useMemo(() => {
    const today = new Date();
    const periodStart = dataInicio ? parseISO(dataInicio) : null;
    const periodEnd = dataFim ? parseISO(dataFim) : null;
    if (!periodStart || !periodEnd) return { mrrPlanejado: 0, taxaPlanejada: 0 };

    // Pegar o mês de referência do filtro
    const monthKey = format(periodStart, "yyyy-MM");
    const churnRate = getChurnRateBP(monthKey);
    // Meta dinâmica: taxa do BP × MRR real, descontando excesso acumulado de meses anteriores
    const targetBase = mrrBaseReal > 0 ? mrrBaseReal * churnRate : (BP_CHURN_MRR_TARGETS[monthKey] || 0);
    const targetMensal = Math.max(0, targetBase - churnExcessFromPreviousMonths);
    if (targetBase === 0) return { mrrPlanejado: 0, taxaPlanejada: 0 };

    // Total de dias no mês
    const totalDaysInMonth = getDaysInMonth(periodStart);

    // Dias decorridos até hoje (ou até o fim do período se já passou)
    const effectiveEnd = today < periodStart ? periodStart : today > periodEnd ? periodEnd : today;
    const elapsedDays = differenceInCalendarDays(effectiveEnd, periodStart) + 1;
    const safeDays = Math.max(0, Math.min(elapsedDays, totalDaysInMonth));

    // Meta pro-rateada até hoje, capped at 8% (meta máxima de churn)
    const MAX_CHURN_RATE = 0.08;
    const cappedTargetMensal = mrrBaseReal > 0 ? Math.min(targetMensal, mrrBaseReal * MAX_CHURN_RATE) : targetMensal;
    const mrrPlanejado = (cappedTargetMensal / totalDaysInMonth) * safeDays;
    const taxaPlanejada = mrrBaseReal > 0 ? (mrrPlanejado / mrrBaseReal) * 100 : 0;

    return { mrrPlanejado, taxaPlanejada, targetMensal: cappedTargetMensal };
  }, [dataInicio, dataFim, mrrBaseReal, churnExcessFromPreviousMonths]);

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

  const gaugeStatusOverride = useMemo(() => {
    switch (churnDailyInsights.status) {
      case "on_track":
        return { label: "No alvo", color: "text-emerald-500", bg: "from-emerald-500 to-green-500", dotBg: "bg-emerald-500" };
      case "warning":
        return { label: "Atenção", color: "text-amber-500", bg: "from-amber-500 to-orange-500", dotBg: "bg-amber-500" };
      case "critical":
        return { label: "Crítico", color: "text-orange-500", bg: "from-orange-500 to-red-500", dotBg: "bg-orange-500" };
      case "over_budget":
        return { label: "Fora da meta", color: "text-red-600", bg: "from-red-600 to-rose-700", dotBg: "bg-red-600" };
      case "future":
        return { label: "Período futuro", color: "text-slate-500", bg: "from-slate-500 to-slate-700", dotBg: "bg-slate-500" };
      default:
        return undefined;
    }
  }, [churnDailyInsights.status]);

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
        filtros={data?.filtros}
        filterSquads={filterSquads}
        setFilterSquads={setFilterSquads}
        filterProdutos={filterProdutos}
        setFilterProdutos={setFilterProdutos}
        filterResponsaveis={filterResponsaveis}
        setFilterResponsaveis={setFilterResponsaveis}
        filterServicos={filterServicos}
        setFilterServicos={setFilterServicos}
        filterPlanos={filterPlanos}
        setFilterPlanos={setFilterPlanos}
        filterClusters={filterClusters}
        setFilterClusters={setFilterClusters}
        filterEvitabilidades={filterEvitabilidades}
        setFilterEvitabilidades={setFilterEvitabilidades}
        filterPossibilidadesRetencao={filterPossibilidadesRetencao}
        setFilterPossibilidadesRetencao={setFilterPossibilidadesRetencao}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
      />

      {/* Painel Executivo Hero - KPIs de Diagnóstico */}
      {!isLoading && data?.metricas?.mrr_ativo_ref !== undefined && (
        <ChurnKpisHero
          contratos={filteredContratos}
          mrrPerdido={filteredMetricas.mrr_perdido}
          taxaChurn={filteredTaxaChurn}
          nrrPct={nrrData?.nrr_pct}
          gaugeStatusOverride={gaugeStatusOverride}
          churnPlanejado={churnPlanejado.mrrPlanejado}
          ltMedio={filteredMetricas.lt_medio}
          ticketMedio={filteredMetricas.ticket_medio}
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
        <ChurnPorDimensao contratos={filteredContratos} onDrill={onDrill} />
      )}

      {/* Métricas Secundárias */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-white dark:bg-zinc-900/50 border border-gray-100 dark:border-zinc-800/50 p-4 shadow">
              <Skeleton className="h-4 w-20 mb-3" />
              <Skeleton className="h-7 w-24" />
            </div>
          ))
        ) : (
          <>
            <TechKpiCard
              title="LTV Total"
              value={formatCurrencyNoDecimals(filteredMetricas.ltv_total)}
              subtitle="valor gerado antes do churn"
              icon={Target}
              gradient="bg-gradient-to-r from-emerald-500 to-teal-600"
              shadowColor="rgba(16,185,129,0.25)"
            />
            <TechKpiCard
              title="Lifetime Médio"
              value={`${filteredMetricas.lt_medio.toFixed(1)} meses`}
              subtitle="tempo médio de permanência"
              icon={Clock}
              gradient="bg-gradient-to-r from-blue-500 to-cyan-600"
              shadowColor="rgba(59,130,246,0.25)"
            />
            <TechKpiCard
              title="Ticket Médio"
              value={formatCurrencyNoDecimals(filteredMetricas.ticket_medio)}
              subtitle="MRR médio por contrato"
              icon={BarChart3}
              gradient="bg-gradient-to-r from-violet-500 to-purple-600"
              shadowColor="rgba(139,92,246,0.25)"
            />
            <TechKpiCard
              title="LTV Médio"
              value={filteredMetricas.total_churned > 0
                ? formatCurrencyNoDecimals(filteredMetricas.ltv_total / filteredMetricas.total_churned)
                : "R$ 0"}
              subtitle="por contrato churned"
              icon={DollarSign}
              gradient="bg-gradient-to-r from-indigo-500 to-purple-600"
              shadowColor="rgba(99,102,241,0.25)"
            />
          </>
        )}
      </div>

      {/* MRR Perdido por Motivo de Cancelamento */}
      {data?.metricas?.churn_por_motivo && data.metricas.churn_por_motivo.length > 0 && (
        <Card className="border-border/50" data-testid="card-mrr-por-motivo">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-r from-rose-500 to-pink-600 shadow-lg">
                <AlertTriangle className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-base" data-testid="title-mrr-por-motivo">MRR Perdido por Motivo de Cancelamento</CardTitle>
                <p className="text-xs text-muted-foreground">Análise dos principais motivos de churn</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.metricas.churn_por_motivo.slice(0, 10).map((item, index) => {
                const maxMrr = data.metricas.churn_por_motivo?.[0]?.mrr_perdido || 1;
                const barWidth = (item.mrr_perdido / maxMrr) * 100;
                const ticketMedioMotivo = item.quantidade > 0 ? item.mrr_perdido / item.quantidade : 0;

                return (
                  <div key={item.motivo} className="group" data-testid={`motivo-ranking-${index}`}>
                    <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                          index < 3
                            ? 'bg-rose-500 text-white'
                            : 'bg-gray-100 dark:bg-zinc-800 text-muted-foreground'
                        }`}>
                          <span className="text-[10px] font-bold">{index + 1}</span>
                        </div>
                        <span className="text-sm font-medium truncate" data-testid={`text-motivo-${index}`}>{item.motivo}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <Badge variant="outline" className="text-xs" data-testid={`badge-qtd-motivo-${index}`}>
                          {item.quantidade} {item.quantidade === 1 ? 'contrato' : 'contratos'}
                        </Badge>
                        <div className="flex flex-col items-end leading-tight">
                          <span className="text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums" data-testid={`text-mrr-motivo-${index}`}>
                            {formatCurrencyNoDecimals(item.mrr_perdido)}
                          </span>
                          <span className="text-[10px] text-muted-foreground tabular-nums" data-testid={`text-ticket-medio-motivo-${index}`}>
                            Ticket médio: {formatCurrencyNoDecimals(ticketMedioMotivo)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="ml-8 h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden" data-testid={`bar-motivo-${index}`}>
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-500"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <div className="ml-8 mt-0.5 text-[10px] text-muted-foreground" data-testid={`text-percent-motivo-${index}`}>
                      {item.percentual.toFixed(1)}% do total perdido
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <ChurnDrillDrawer
        open={!!drill}
        titulo={drill?.titulo ?? ""}
        contratos={drill?.contratos ?? []}
        onClose={() => setDrill(null)}
        onToggleAbono={onToggleAbono}
        pendingIds={pendingIds}
        abonadoOverrides={abonadoOverrides}
      />
    </div>
  );
}
