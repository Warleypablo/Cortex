import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Percent,
  Clock,
  BarChart3,
  Target,
  CalendarDays,
  Pause,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { type ChurnContract, type ChurnDetalhamentoData } from "@/components/churn/types";
import { ChurnControls } from "@/components/churn/ChurnControls";
import { ChurnKpisHero } from "@/components/churn/ChurnKpisHero";
import { ChurnDrillDrawer } from "@/components/churn/ChurnDrillDrawer";
import { RitmoDiario } from "@/components/churn/RitmoDiario";
import { SecaoMotivos } from "@/components/churn/SecaoMotivos";
import { SecaoVozCliente } from "@/components/churn/SecaoVozCliente";
import { SecaoSegmentacao } from "@/components/churn/SecaoSegmentacao";
import { SecaoTiming } from "@/components/churn/SecaoTiming";
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

  const filteredChurnPorSquad = useMemo(() => {
    if (filteredContratos.length === 0 || !data?.metricas?.churn_por_squad) return [];

    const churnContratos = filteredContratos.filter(c => c.tipo === 'churn' && !c.is_abonado);
    if (churnContratos.length === 0) return [];
    
    const squadData: Record<string, { mrr_perdido: number; mrr_base: number }> = {};
    
    churnContratos.forEach(c => {
      const squad = c.squad || "Não especificado";
      if (!squadData[squad]) {
        const originalSquadData = data.metricas.churn_por_squad?.find(s => s.squad === squad);
        squadData[squad] = { 
          mrr_perdido: 0, 
          mrr_base: originalSquadData?.mrr_ativo || 0 
        };
      }
      squadData[squad].mrr_perdido += c.valorr || 0;
    });
    
    // Lista de squads irrelevantes a serem excluídos
    const squadsIrrelevantes = ['turbo interno', 'squad x', 'interno', 'x'];
    
    return Object.entries(squadData)
      .map(([squad, info]) => ({
        squad,
        mrr_perdido: info.mrr_perdido,
        mrr_ativo: info.mrr_base,
        percentual: info.mrr_base > 0 ? (info.mrr_perdido / info.mrr_base) * 100 : 0
      }))
      .filter(s => s.mrr_perdido > 0) // Remover squads com valor zerado
      .filter(s => !squadsIrrelevantes.includes(s.squad.toLowerCase().trim())) // Remover squads irrelevantes
      .sort((a, b) => b.mrr_perdido - a.mrr_perdido); // Ordenar por valor (R$) ao invés de percentual
  }, [filteredContratos, data?.metricas?.churn_por_squad]);

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
    const dailyCap = remainingDays > 0 ? remainingBudget / remainingDays : remainingBudget;
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
      dailyCap,
      dailyIdeal,
      dailyActual,
      progressPct,
      pacePct,
      status,
    };
  }, [filteredMetricas.mrr_perdido, dataInicio, dataFim, mrrBaseReal, churnExcessFromPreviousMonths]);

  const dailyStatusConfig = {
    on_track: {
      label: "No alvo",
      badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      barClass: "bg-emerald-500",
      textClass: "text-emerald-600 dark:text-emerald-400",
    },
    warning: {
      label: "Atenção",
      badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
      barClass: "bg-amber-500",
      textClass: "text-amber-600 dark:text-amber-400",
    },
    critical: {
      label: "Crítico",
      badgeClass: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30",
      barClass: "bg-orange-500",
      textClass: "text-orange-600 dark:text-orange-400",
    },
    over_budget: {
      label: "Meta estourada",
      badgeClass: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
      barClass: "bg-red-500",
      textClass: "text-red-600 dark:text-red-400",
    },
    future: {
      label: "Período futuro",
      badgeClass: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30",
      barClass: "bg-slate-400",
      textClass: "text-slate-600 dark:text-slate-300",
    },
  } as const;

  const dailyStatus = dailyStatusConfig[churnDailyInsights.status as keyof typeof dailyStatusConfig];

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

  // Clientes perdidos (maior impacto financeiro) — todos, sem limite
  const topClientesPerdidos = useMemo(() => {
    if (filteredContratos.length === 0) return [];

    const churnContratos = filteredContratos.filter(c => c.tipo === 'churn' && !c.is_abonado);
    return churnContratos
      .sort((a, b) => b.valorr - a.valorr);
  }, [filteredContratos]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

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

      {/* Seções analíticas — skeleton enquanto carrega */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-64" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <Skeleton key={j} className="h-40 rounded-xl" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Seção Motivos & Evitabilidade */}
          <SecaoMotivos contratos={filteredContratos} onDrill={onDrill} />

          {/* Seção Voz do Cliente (IA) */}
          <SecaoVozCliente contratos={filteredContratos} onDrill={onDrill} />

          {/* Seção Segmentação: squad, produto/serviço, ticket, responsável */}
          <SecaoSegmentacao contratos={filteredContratos} onDrill={onDrill} />

          {/* Seção Timing: distribuição por lifetime, evolução mensal, cohort, curva de sobrevivência, MRR perdido */}
          <SecaoTiming contratos={filteredContratos} onDrill={onDrill} />
        </>
      )}

      {/* Painel Executivo Detalhado (MRR Base, Abonado, NRR, Squad) */}
      {!isLoading && data?.metricas?.mrr_ativo_ref !== undefined && (
        <Card className="relative overflow-hidden border-2 border-red-200/50 dark:border-red-900/30 bg-gradient-to-br from-slate-50 via-white to-red-50/30 dark:from-zinc-900 dark:via-zinc-900 dark:to-red-950/20">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }} />
          </div>
          
          <CardContent className="relative p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Coluna 1: Métricas principais */}
              <div className="flex flex-col gap-3">
                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/50 flex flex-col justify-center">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">MRR Base</span>
                    <DollarSign className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{formatCurrency(mrrBaseReal)}</div>
                  <div className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">base de referência do período</div>
                </div>

                <div className={`flex-1 p-4 rounded-xl border flex flex-col justify-center ${filterAbono === "abonados" ? "bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/50" : "bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/50"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium uppercase ${filterAbono === "abonados" ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>{filterAbono === "abonados" ? "MRR Abonado" : "MRR Perdido"}</span>
                    <DollarSign className={`h-4 w-4 ${filterAbono === "abonados" ? "text-amber-500" : "text-red-500"}`} />
                  </div>
                  <div className={`text-2xl font-bold ${filterAbono === "abonados" ? "text-amber-700 dark:text-amber-300" : "text-red-700 dark:text-red-300"}`}>{formatCurrency(filteredMetricas.mrr_perdido)}</div>
                  <div className={`text-xs mt-1 ${filterAbono === "abonados" ? "text-amber-600/70 dark:text-amber-400/70" : "text-red-600/70 dark:text-red-400/70"}`}>{filteredMetricas.total_churned} contratos {filterAbono === "abonados" ? "abonados" : "encerrados"}</div>
                  {filterAbono !== "abonados" && churnPlanejado.mrrPlanejado > 0 && (
                    <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-800/50">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-red-600/70 dark:text-red-400/70">Planejado até hoje</span>
                        <span className="text-[11px] font-semibold text-red-600 dark:text-red-400 tabular-nums">{formatCurrencyNoDecimals(churnPlanejado.mrrPlanejado)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[11px] text-red-600/70 dark:text-red-400/70">Meta do mês</span>
                        <span className="text-[11px] font-semibold text-red-600 dark:text-red-400 tabular-nums">{formatCurrencyNoDecimals(churnPlanejado.targetMensal || 0)}</span>
                      </div>
                      {(() => {
                        const diff = filteredMetricas.mrr_perdido - churnPlanejado.mrrPlanejado;
                        const isOver = diff > 0;
                        return (
                          <div className={`flex items-center gap-1 mt-1 text-[11px] font-medium ${isOver ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {isOver ? <TrendingDown className="h-3 w-3" /> : <TrendingDown className="h-3 w-3 rotate-180" />}
                            <span>{isOver ? '+' : ''}{formatCurrencyNoDecimals(diff)} {isOver ? 'acima' : 'abaixo'} do planejado</span>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
                
                {filterAbono === "todos" && (
                <div className="flex-1 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-100 dark:border-amber-900/50 flex flex-col justify-center">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase">Churn Abonado</span>
                    <Pause className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{formatCurrency(filteredMetricas.mrr_abonado || 0)}</div>
                  <div className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">{filteredMetricas.total_abonado || 0} contratos abonados</div>
                  {filteredMetricas.abonado_por_motivo && Object.keys(filteredMetricas.abonado_por_motivo).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-800/50 space-y-1">
                      {Object.entries(filteredMetricas.abonado_por_motivo)
                        .sort(([,a], [,b]) => b.mrr - a.mrr)
                        .map(([motivo, info]) => (
                          <div key={motivo} className="flex items-center justify-between text-[11px]">
                            <span className="text-amber-700 dark:text-amber-400 truncate max-w-[140px]">{motivo}</span>
                            <span className="text-amber-800 dark:text-amber-300 font-semibold tabular-nums ml-2">{info.count}x · {formatCurrencyNoDecimals(info.mrr)}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                )}

                {filterAbono === "todos" && (
                <div className="flex-1 p-4 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-100 dark:border-purple-900/50 flex flex-col justify-center">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase">Churn Total</span>
                    <Target className="h-4 w-4 text-purple-500" />
                  </div>
                  <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{formatCurrency(filteredMetricas.mrr_perdido + filteredMetricas.mrr_abonado)}</div>
                  <div className="text-xs text-purple-600/70 dark:text-purple-400/70 mt-1">
                    {filteredMetricas.total_churned + filteredMetricas.total_abonado} contratos (MRR Perdido + Abonado)
                  </div>
                  <div className="flex items-center gap-3 text-xs mt-2">
                    <span className="text-red-500">Perdido: {formatCurrency(filteredMetricas.mrr_perdido)}</span>
                    <span className="text-amber-500">Abonado: {formatCurrency(filteredMetricas.mrr_abonado)}</span>
                  </div>
                </div>
                )}
              </div>

              {/* Coluna NRR & Cross-sell */}
              <div className="flex flex-col gap-3">
                <div className={`flex-1 p-4 rounded-xl border flex flex-col justify-center ${
                  (nrrData?.nrr_pct ?? 0) <= 0
                    ? 'bg-green-50 dark:bg-green-950/30 border-green-100 dark:border-green-900/50'
                    : 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/50'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium uppercase ${
                      (nrrData?.nrr_pct ?? 0) <= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>NRR (Net Revenue Retention)</span>
                    <Percent className={`h-4 w-4 ${
                      (nrrData?.nrr_pct ?? 0) <= 0
                        ? 'text-green-500'
                        : 'text-red-500'
                    }`} />
                  </div>
                  <div className={`text-2xl font-bold ${
                    (nrrData?.nrr_pct ?? 0) <= 0
                      ? 'text-green-700 dark:text-green-300'
                      : 'text-red-700 dark:text-red-300'
                  }`}>{(nrrData?.nrr_pct ?? 0).toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground mt-1">(Churn - Vendas) / MRR Base</div>
                </div>

                <div className="flex-1 p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/50 flex flex-col justify-center">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase">Cross-sell MRR</span>
                    <TrendingDown className="h-4 w-4 text-emerald-500 rotate-180" />
                  </div>
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(nrrData?.crosssell_mrr ?? 0)}</div>
                  <div className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1">vendas para clientes existentes</div>
                  {(nrrData?.crosssell_pontual ?? 0) > 0 && (
                    <div className="text-xs text-emerald-600/50 dark:text-emerald-400/50 mt-0.5">Pontual: {formatCurrency(nrrData?.crosssell_pontual ?? 0)}</div>
                  )}
                </div>

                <div className="flex-1 p-4 bg-gray-50 dark:bg-zinc-800/30 rounded-xl border border-gray-100 dark:border-zinc-700/50 flex flex-col justify-center">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase">Vendas MRR (Novo)</span>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-bold text-foreground">{formatCurrency(nrrData?.vendas_mrr_novo ?? 0)}</div>
                  <div className="text-xs text-muted-foreground mt-1">vendas para clientes novos</div>
                </div>
              </div>
              
              {/* Coluna 3: Ranking de Churn por Squad */}
              <div className="bg-white/50 dark:bg-zinc-800/30 rounded-xl border border-gray-100 dark:border-zinc-700/50 p-4 flex flex-col">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-foreground">Churn por Squad</h3>
                  <Badge variant="outline" className="text-xs">Top {filteredChurnPorSquad.length}</Badge>
                </div>
                <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                  {filteredChurnPorSquad.map((squad, index) => {
                    const isTop3 = index < 3;
                    const medalColors = ['bg-amber-500', 'bg-gray-400', 'bg-amber-700'];
                    
                    return (
                      <div 
                        key={squad.squad} 
                        data-testid={`squad-ranking-${index}`}
                        className={`flex items-center gap-2 p-2.5 rounded-lg transition-all ${
                          isTop3 
                            ? 'bg-red-50/80 dark:bg-red-950/40 border border-red-100 dark:border-red-900/50' 
                            : 'bg-gray-50/50 dark:bg-zinc-900/30 border border-gray-100/50 dark:border-zinc-800/50'
                        }`}
                      >
                        <div className="w-6 text-center flex-shrink-0">
                          {isTop3 ? (
                            <div className={`w-5 h-5 rounded-full ${medalColors[index]} flex items-center justify-center`}>
                              <span className="text-[10px] font-bold text-white">{index + 1}</span>
                            </div>
                          ) : (
                            <span className="text-xs font-medium text-muted-foreground">{index + 1}º</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium truncate">{squad.squad}</span>
                            <span className={`text-sm font-bold tabular-nums ${
                              squad.percentual >= 5 ? 'text-red-600 dark:text-red-400' : 
                              squad.percentual >= 2 ? 'text-orange-600 dark:text-orange-400' : 
                              'text-emerald-600 dark:text-emerald-400'
                            }`}>
                              {squad.percentual.toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  squad.percentual >= 5 ? 'bg-red-500' : 
                                  squad.percentual >= 2 ? 'bg-orange-500' : 
                                  'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(squad.percentual * 10, 100)}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatCurrencyNoDecimals(squad.mrr_perdido)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Observação de Churn Máximo Diário */}
      {isLoading ? (
        <Card className="border-border/50">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-gray-100 dark:border-zinc-800/60 p-4 bg-white/70 dark:bg-zinc-900/40">
                  <Skeleton className="h-4 w-32 mb-3" />
                  <Skeleton className="h-7 w-40 mb-2" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50 bg-gradient-to-br from-emerald-50 via-white to-amber-50/40 dark:from-zinc-900 dark:via-zinc-900 dark:to-emerald-950/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 shadow-lg">
                  <Target className="h-4 w-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">Observatório de Churn Diário</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Meta referência: {churnDailyInsights.churnTargetPct}% do MRR base no período selecionado
                  </p>
                </div>
              </div>
              <Badge variant="outline" className={`text-xs ${dailyStatus.badgeClass}`}>
                {dailyStatus.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-2">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-white/70 dark:bg-zinc-900/40 p-4">
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase">
                  <span>Meta de churn do período</span>
                  <Badge variant="outline" className="text-[10px]">MRR base</Badge>
                </div>
                <div className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                  {formatCurrencyNoDecimals(churnDailyInsights.churnTarget)}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Churn acumulado</span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                    {formatCurrencyNoDecimals(churnDailyInsights.churnSpent)}
                  </span>
                </div>
                <Progress value={Math.min(Math.max(churnDailyInsights.progressPct, 0), 100)} className="h-2 mt-2" />
                <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{churnDailyInsights.progressPct.toFixed(1)}% da meta</span>
                  <span className={churnDailyInsights.remainingBudget >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                    Saldo: {formatCurrencyNoDecimals(churnDailyInsights.remainingBudget)}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-amber-100 dark:border-amber-900/40 bg-white/70 dark:bg-zinc-900/40 p-4">
                <div className="flex items-center justify-between text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase">
                  <span>Churn máximo diário</span>
                  <CalendarDays className="h-3.5 w-3.5" />
                </div>
                <div className="mt-2 text-3xl font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                  {churnDailyInsights.remainingDays > 0 
                    ? formatCurrencyNoDecimals(Math.max(churnDailyInsights.dailyCap, 0)) 
                    : "R$ 0"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {churnDailyInsights.remainingDays > 0 
                    ? `restam ${churnDailyInsights.remainingDays} dias` 
                    : "período encerrado"}
                </div>
                <div className="mt-3 p-2 rounded-lg bg-amber-50/80 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/40 text-[11px] text-amber-700 dark:text-amber-300">
                  Limite diário sugerido para fechar no alvo sem estourar a meta.
                </div>
              </div>

              <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-white/70 dark:bg-zinc-900/40 p-4">
                <div className="flex items-center justify-between text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase">
                  <span>Ritmo diário</span>
                  <BarChart3 className="h-3.5 w-3.5" />
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Ideal</span>
                    <span className="font-semibold tabular-nums">{formatCurrencyNoDecimals(churnDailyInsights.dailyIdeal)}/dia</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Atual</span>
                    <span className={`font-semibold tabular-nums ${dailyStatus.textClass}`}>
                      {formatCurrencyNoDecimals(churnDailyInsights.dailyActual)}/dia
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${dailyStatus.barClass}`}
                      style={{ width: `${Math.min(churnDailyInsights.pacePct, 100)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Ritmo atual em {churnDailyInsights.pacePct.toFixed(0)}% do ideal
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
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

      {/* Top Clientes Perdidos - movido para sub-aba Resumo */}
      {!isLoading && topClientesPerdidos.length > 0 && (
        <Card className="border-red-200 dark:border-red-900/40">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-r from-red-500 to-rose-600 shadow-lg">
                <TrendingDown className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base">Clientes Perdidos ({topClientesPerdidos.length})</CardTitle>
                <CardDescription>Maior impacto financeiro no período</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Squad</TableHead>
                    <TableHead className="text-right">MRR</TableHead>
                    <TableHead className="text-right">LTV</TableHead>
                    <TableHead className="text-center">Lifetime</TableHead>
                    <TableHead>Data Saída</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topClientesPerdidos.map((c, idx) => (
                    <TableRow key={c.id} data-testid={`row-top-cliente-${idx}`}>
                      <TableCell>
                        <Badge variant={idx < 3 ? "destructive" : "secondary"} className="font-bold">
                          {idx + 1}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{c.cliente_nome}</span>
                          {c.is_abonado && (
                            <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                              Abonado
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{c.contrato_nome || c.cliente_nome}</TableCell>
                      <TableCell className="text-sm">{c.produto}</TableCell>
                      <TableCell className="text-sm">{c.squad}</TableCell>
                      <TableCell className="text-right font-semibold text-red-600 dark:text-red-400">
                        {formatCurrency(c.valorr)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrencyNoDecimals(c.ltv)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{c.lifetime_meses.toFixed(1)}m</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(c.data_encerramento)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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


