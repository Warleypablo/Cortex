import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { MultiSelect } from "@/components/ui/multi-select";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrency } from "@/lib/utils";
import { 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  Search,
  AlertTriangle,
  FileText,
  Filter,
  ChevronDown,
  ChevronUp,
  Percent,
  Clock,
  BarChart3,
  PieChart,
  Target,
  CalendarDays,
  Building2,
  Users,
  Pause,
  CalendarRange,
  Brain,
  MessageSquare,
  GitBranch,
  Lightbulb,
  Shield,
  Hash,
  Megaphone
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ChurnConsolidadoTrimestral from "@/components/ChurnConsolidadoTrimestral";
import { type ChurnContract, type ChurnDetalhamentoData, type ChurnPorSquad, type ChurnPorMotivo, type ChurnBreakdownItem, type RetentionPoint, CHART_COLORS } from "@/components/churn/types";
import { CustomTooltip } from "@/components/churn/ui/CustomTooltip";
import { TechKpiCard } from "@/components/churn/ui/TechKpiCard";
import { StatPill } from "@/components/churn/ui/StatPill";
import { ChurnGauge } from "@/components/churn/ui/ChurnGauge";
import { TechChartCard } from "@/components/churn/ui/TechChartCard";
import { SectionBlock } from "@/components/churn/ui/SectionBlock";
import { format, parseISO, subMonths, startOfMonth, endOfMonth, differenceInCalendarDays, getDaysInMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Cell,
  PieChart as RechartsPie,
  Pie,
  Legend,
  LineChart,
  Line,
  Area,
  AreaChart
} from "recharts";


const PALETTE = [
  "#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b",
  "#ec4899", "#6366f1", "#14b8a6", "#f97316", "#84cc16"
];

const REFINED_COLORS = [
  "#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b",
  "#ec4899", "#6366f1", "#14b8a6", "#f97316", "#84cc16"
];

const formatCurrencyNoDecimals = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

// === Voz do Cliente: Constants & Helpers ===

const EXPANDED_KEYWORDS: Record<string, string[]> = {
  'Resultado': ['resultado', 'performance', 'meta', 'retorno', 'roi', 'entrega'],
  'Preço': ['preco', 'valor', 'custo', 'caro', 'investimento', 'orcamento', 'budget'],
  'Atendimento': ['atendimento', 'suporte', 'resposta', 'demora', 'comunicacao', 'contato'],
  'Operação': ['operacao', 'operacional', 'execucao', 'qualidade', 'erro', 'falha'],
  'Estratégia': ['estrategia', 'estrategico', 'planejamento', 'direcionamento', 'alinhamento'],
  'Interno': ['interno', 'reestruturacao', 'mudanca interna', 'corte', 'reducao'],
  'Concorrência': ['concorrencia', 'concorrente', 'agencia', 'inhouse', 'in-house'],
  'Prazo': ['prazo', 'tempo', 'urgencia', 'deadline', 'atraso', 'lento'],
  'Produto': ['produto', 'ferramenta', 'plataforma', 'funcionalidade', 'feature', 'sistema'],
  'Confiança': ['confianca', 'credibilidade', 'transparencia', 'honestidade', 'seguranca'],
  'Onboarding': ['onboarding', 'implantacao', 'inicio', 'setup', 'treinamento', 'integracao'],
  'Relacionamento': ['relacionamento', 'parceria', 'proximidade', 'dedicacao', 'empatia', 'cuidado'],
};

const normalizeText = (text: string): string =>
  text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const highlightKeywords = (text: string, keywords: string[]): React.ReactNode => {
  if (!text || keywords.length === 0) return text;
  const normalizedText = normalizeText(text);
  const segments: { start: number; end: number }[] = [];

  keywords.forEach(kw => {
    const normalizedKw = normalizeText(kw);
    let idx = normalizedText.indexOf(normalizedKw);
    while (idx !== -1) {
      segments.push({ start: idx, end: idx + normalizedKw.length });
      idx = normalizedText.indexOf(normalizedKw, idx + 1);
    }
  });

  if (segments.length === 0) return text;

  // Merge overlapping segments
  segments.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [segments[0]];
  for (let i = 1; i < segments.length; i++) {
    const last = merged[merged.length - 1];
    if (segments[i].start <= last.end) {
      last.end = Math.max(last.end, segments[i].end);
    } else {
      merged.push(segments[i]);
    }
  }

  const parts: React.ReactNode[] = [];
  let lastEnd = 0;
  merged.forEach((seg, i) => {
    if (seg.start > lastEnd) parts.push(text.slice(lastEnd, seg.start));
    parts.push(
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/60 rounded px-0.5">
        {text.slice(seg.start, seg.end)}
      </mark>
    );
    lastEnd = seg.end;
  });
  if (lastEnd < text.length) parts.push(text.slice(lastEnd));
  return <>{parts}</>;
};


export default function ChurnDetalhamento() {
  usePageTitle("Detalhamento de Churn");
  useSetPageInfo("Detalhamento de Churn", "Análise detalhada de contratos encerrados");

  const BASE_REFERENCE_DATE = new Date(2026, 0, 1);

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
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [dataInicio, setDataInicio] = useState<string>(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState<string>(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [sortBy, setSortBy] = useState<string>("data_encerramento");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false); // Fechado por padrão, dados principais no hero
  const [mainTab, setMainTab] = useState<"analise" | "contratos" | "relatorio" | "consolidado">("analise");
  const [crossAnalysisView, setCrossAnalysisView] = useState<"motivo" | "cluster" | "plano">("motivo");
  const [expandedMotivo, setExpandedMotivo] = useState<string | null>(null);
  const [filterAbono, setFilterAbono] = useState<"todos" | "abonados" | "nao_abonados">("todos");

  // Voz do Cliente states
  const [muralSortBy, setMuralSortBy] = useState<"mrr" | "date">("mrr");
  const [muralFilterSentiment, setMuralFilterSentiment] = useState<string | null>(null);
  const [muralFilterTheme, setMuralFilterTheme] = useState<string | null>(null);
  const [muralExpandedId, setMuralExpandedId] = useState<string | null>(null);
  const [selectedThemeKeyword, setSelectedThemeKeyword] = useState<string | null>(null);
  const [expandedOpTheme, setExpandedOpTheme] = useState<string | null>(null);
  const [expandedCxTheme, setExpandedCxTheme] = useState<string | null>(null);
  const [abonadoOverrides, setAbonadoOverrides] = useState<Record<string, boolean>>({});
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
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

    // Filtro de abono — só na aba Análise, onde o controle fica visível
    if (mainTab === "analise" && filterAbono !== "todos") {
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
  }, [data?.contratos, searchTerm, filterSquads, filterProdutos, filterResponsaveis, filterServicos, filterPlanos, filterClusters, filterEvitabilidades, filterPossibilidadesRetencao, dataInicio, dataFim, sortBy, sortOrder, mainTab, filterAbono, abonadoOverrides]);

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
      label: "AtenÃ§Ã£o",
      badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
      barClass: "bg-amber-500",
      textClass: "text-amber-600 dark:text-amber-400",
    },
    critical: {
      label: "CrÃ­tico",
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
      label: "PerÃ­odo futuro",
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
        return { label: "Atencao", color: "text-amber-500", bg: "from-amber-500 to-orange-500", dotBg: "bg-amber-500" };
      case "critical":
        return { label: "Critico", color: "text-orange-500", bg: "from-orange-500 to-red-500", dotBg: "bg-orange-500" };
      case "over_budget":
        return { label: "Fora da meta", color: "text-red-600", bg: "from-red-600 to-rose-700", dotBg: "bg-red-600" };
      case "future":
        return { label: "Periodo futuro", color: "text-slate-500", bg: "from-slate-500 to-slate-700", dotBg: "bg-slate-500" };
      default:
        return undefined;
    }
  }, [churnDailyInsights.status]);

  const distribuicaoPorSquad = useMemo(() => {
    const churnOnly = filteredContratos.filter(c => c.tipo === 'churn' && !c.is_abonado);
    if (churnOnly.length === 0) return [];

    const squadCounts: Record<string, { count: number; mrr: number }> = {};
    churnOnly.forEach(c => {
      const squad = c.squad || "Não especificado";
      if (!squadCounts[squad]) squadCounts[squad] = { count: 0, mrr: 0 };
      squadCounts[squad].count++;
      squadCounts[squad].mrr += c.valorr || 0;
    });

    const total = churnOnly.length;
    return Object.entries(squadCounts)
      .map(([name, data]) => ({
        name: name.length > 15 ? name.substring(0, 15) + "..." : name,
        fullName: name,
        count: data.count,
        mrr: data.mrr,
        percentual: (data.count / total) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filteredContratos]);

  const distribuicaoPorProduto = useMemo(() => {
    if (filteredContratos.length === 0) return [];
    
    const prodCounts: Record<string, { count: number; mrr: number }> = {};
    filteredContratos.forEach(c => {
      const servico = c.servico || "Não especificado";
      if (!prodCounts[servico]) prodCounts[servico] = { count: 0, mrr: 0 };
      prodCounts[servico].count++;
      prodCounts[servico].mrr += c.valorr || 0;
    });
    
    const total = filteredContratos.length;
    return Object.entries(prodCounts)
      .map(([name, data]) => ({
        name: name.length > 15 ? name.substring(0, 15) + "..." : name,
        fullName: name,
        count: data.count,
        mrr: data.mrr,
        percentual: (data.count / total) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filteredContratos]);

  const distribuicaoPorLifetime = useMemo(() => {
    if (filteredContratos.length === 0) return [];
    
    const ranges = [
      { name: "< 3m", min: 0, max: 3, count: 0, mrr: 0 },
      { name: "3-6m", min: 3, max: 6, count: 0, mrr: 0 },
      { name: "6-12m", min: 6, max: 12, count: 0, mrr: 0 },
      { name: "12-24m", min: 12, max: 24, count: 0, mrr: 0 },
      { name: "> 24m", min: 24, max: Infinity, count: 0, mrr: 0 },
    ];
    
    filteredContratos.forEach(c => {
      const lt = c.lifetime_meses;
      for (const range of ranges) {
        if (lt >= range.min && lt < range.max) {
          range.count++;
          range.mrr += c.valorr || 0;
          break;
        }
      }
    });
    
    const total = filteredContratos.length;
    return ranges.map(r => ({
      ...r,
      percentual: (r.count / total) * 100
    }));
  }, [filteredContratos]);

  const distribuicaoPorResponsavel = useMemo(() => {
    if (filteredContratos.length === 0) return [];
    
    const respCounts: Record<string, { count: number; mrr: number }> = {};
    filteredContratos.forEach(c => {
      const resp = c.responsavel || "Não especificado";
      if (!respCounts[resp]) respCounts[resp] = { count: 0, mrr: 0 };
      respCounts[resp].count++;
      respCounts[resp].mrr += c.valorr || 0;
    });
    
    const total = filteredContratos.length;
    return Object.entries(respCounts)
      .map(([name, data]) => ({
        name: name.length > 12 ? name.substring(0, 12) + "..." : name,
        fullName: name,
        count: data.count,
        mrr: data.mrr,
        percentual: (data.count / total) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [filteredContratos]);

  // Análise de Churn por Tipo de Erro (Erro Operacional, Erro Operacional Indireto, Falta de Resultado)
  type ChurnTipoErro = {
    tipo: string;
    count: number;
    mrr: number;
    porSquad: Record<string, { count: number; mrr: number }>;
    porResponsavel: Record<string, { count: number; mrr: number }>;
    porVendedor: Record<string, { count: number; mrr: number }>;
    porCsResponsavel: Record<string, { count: number; mrr: number }>;
  };

  const churnPorTipoErro = useMemo(() => {
    if (filteredContratos.length === 0) return [];

    const churnContratos = filteredContratos.filter(c => c.tipo === 'churn' && !c.is_abonado);
    if (churnContratos.length === 0) return [];
    
    const tiposErro: Record<string, ChurnTipoErro> = {};
    
    // Categorias de motivo que representam erro operacional
    const erroOperacionalMotivos = [
      'erro operacional',
      'erro interno',
      'falha operacional',
      'problema interno',
      'erro de operação'
    ];
    
    const erroOperacionalIndiretoMotivos = [
      'erro operacional indireto',
      'erro indireto',
      'falha indireta'
    ];
    
    const faltaResultadoMotivos = [
      'falta de resultado',
      'sem resultado',
      'resultado insatisfatório',
      'não atingiu meta',
      'baixa performance',
      'performance'
    ];
    
    churnContratos.forEach(c => {
      const motivo = (c.motivo_cancelamento || '').toLowerCase().trim();
      
      let categoria = 'Outros';
      if (erroOperacionalMotivos.some(m => motivo.includes(m))) {
        categoria = 'Erro Operacional';
      } else if (erroOperacionalIndiretoMotivos.some(m => motivo.includes(m))) {
        categoria = 'Erro Operacional Indireto';
      } else if (faltaResultadoMotivos.some(m => motivo.includes(m))) {
        categoria = 'Falta de Resultado';
      }
      
      if (!tiposErro[categoria]) {
        tiposErro[categoria] = {
          tipo: categoria,
          count: 0,
          mrr: 0,
          porSquad: {},
          porResponsavel: {},
          porVendedor: {},
          porCsResponsavel: {}
        };
      }
      
      tiposErro[categoria].count++;
      tiposErro[categoria].mrr += c.valorr || 0;
      
      // Agregar por Squad
      const squad = c.squad || 'Não especificado';
      if (!tiposErro[categoria].porSquad[squad]) {
        tiposErro[categoria].porSquad[squad] = { count: 0, mrr: 0 };
      }
      tiposErro[categoria].porSquad[squad].count++;
      tiposErro[categoria].porSquad[squad].mrr += c.valorr || 0;
      
      // Agregar por Responsável
      const resp = c.responsavel || 'Não especificado';
      if (!tiposErro[categoria].porResponsavel[resp]) {
        tiposErro[categoria].porResponsavel[resp] = { count: 0, mrr: 0 };
      }
      tiposErro[categoria].porResponsavel[resp].count++;
      tiposErro[categoria].porResponsavel[resp].mrr += c.valorr || 0;
      
      // Agregar por Vendedor
      const vendedor = c.vendedor || 'Não especificado';
      if (!tiposErro[categoria].porVendedor[vendedor]) {
        tiposErro[categoria].porVendedor[vendedor] = { count: 0, mrr: 0 };
      }
      tiposErro[categoria].porVendedor[vendedor].count++;
      tiposErro[categoria].porVendedor[vendedor].mrr += c.valorr || 0;
      
      // Agregar por CS Responsável
      const csResp = c.cs_responsavel || 'Não especificado';
      if (!tiposErro[categoria].porCsResponsavel[csResp]) {
        tiposErro[categoria].porCsResponsavel[csResp] = { count: 0, mrr: 0 };
      }
      tiposErro[categoria].porCsResponsavel[csResp].count++;
      tiposErro[categoria].porCsResponsavel[csResp].mrr += c.valorr || 0;
    });
    
    return Object.values(tiposErro)
      .filter(t => t.tipo !== 'Outros')
      .sort((a, b) => b.mrr - a.mrr);
  }, [filteredContratos]);

  const [tipoErroTab, setTipoErroTab] = useState<'squad' | 'responsavel' | 'vendedor' | 'cs_responsavel'>('squad');
  const [tipoErroSelecionado, setTipoErroSelecionado] = useState<string>('');

  const dadosTipoErroAtual = useMemo(() => {
    if (churnPorTipoErro.length === 0) return [];
    
    const tipoSelecionado = tipoErroSelecionado || churnPorTipoErro[0]?.tipo || '';
    const tipoData = churnPorTipoErro.find(t => t.tipo === tipoSelecionado);
    if (!tipoData) return [];
    
    let dados: Record<string, { count: number; mrr: number }> = {};
    
    switch (tipoErroTab) {
      case 'squad':
        dados = tipoData.porSquad;
        break;
      case 'responsavel':
        dados = tipoData.porResponsavel;
        break;
      case 'vendedor':
        dados = tipoData.porVendedor;
        break;
      case 'cs_responsavel':
        dados = tipoData.porCsResponsavel;
        break;
    }
    
    return Object.entries(dados)
      .map(([name, info]) => ({
        name: name.length > 20 ? name.substring(0, 20) + '...' : name,
        fullName: name,
        count: info.count,
        mrr: info.mrr
      }))
      .sort((a, b) => b.mrr - a.mrr)
      .slice(0, 10);
  }, [churnPorTipoErro, tipoErroTab, tipoErroSelecionado]);

  const churnPorMes = useMemo(() => {
    if (filteredContratos.length === 0) return [];

    const meses: Record<string, { count: number; countAbonado: number; mrr: number; mrrAbonado: number; sortKey: string }> = {};
    filteredContratos.forEach(c => {
      const refDate = c.tipo === 'pausado' ? c.data_pausa : c.data_encerramento;
      if (!refDate) return;
      const parsedDate = parseISO(refDate);
      const mes = format(parsedDate, "MMM/yy", { locale: ptBR });
      const sortKey = format(parsedDate, "yyyy-MM");
      if (!meses[mes]) meses[mes] = { count: 0, countAbonado: 0, mrr: 0, mrrAbonado: 0, sortKey };
      if (c.is_abonado) {
        meses[mes].countAbonado++;
        meses[mes].mrrAbonado += c.valorr || 0;
      } else {
        meses[mes].count++;
        meses[mes].mrr += c.valorr || 0;
      }
    });

    return Object.entries(meses)
      .map(([mes, data]) => ({
        mes,
        count: data.count,
        countAbonado: data.countAbonado,
        mrr: data.mrr,
        mrrAbonado: data.mrrAbonado,
        sortKey: data.sortKey
      }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .slice(-12);
  }, [filteredContratos]);

  // Clientes perdidos (maior impacto financeiro) — todos, sem limite
  const topClientesPerdidos = useMemo(() => {
    if (filteredContratos.length === 0) return [];

    const churnContratos = filteredContratos.filter(c => c.tipo === 'churn' && !c.is_abonado);
    return churnContratos
      .sort((a, b) => b.valorr - a.valorr);
  }, [filteredContratos]);

  // Feature 1: Churn DNA Tags helper
  const getChurnDNATags = (contrato: ChurnContract) => {
    const tags: { label: string; value: string; color: string }[] = [];
    if (contrato.evitabilidade_churn) {
      tags.push({
        label: "Evitabilidade",
        value: contrato.evitabilidade_churn,
        color: contrato.evitabilidade_churn === 'Evitável'
          ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
          : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
      });
    }
    if (contrato.possibilidade_retencao) {
      const retColor = contrato.possibilidade_retencao === 'Alta'
        ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
        : contrato.possibilidade_retencao === 'Média'
        ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
        : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
      tags.push({ label: "Retenção", value: contrato.possibilidade_retencao, color: retColor });
    }
    if (contrato.cluster) {
      tags.push({ label: "Cluster", value: contrato.cluster, color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' });
    }
    if (contrato.plano) {
      tags.push({ label: "Plano", value: contrato.plano, color: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800' });
    }
    if (contrato.motivo_cancelamento && contrato.motivo_cancelamento !== 'Não especificado') {
      tags.push({ label: "Motivo", value: contrato.motivo_cancelamento, color: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800' });
    }
    if (contrato.submotivo) {
      tags.push({ label: "Submotivo", value: contrato.submotivo, color: 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-400 dark:border-pink-800' });
    }
    return tags;
  };

  // Feature 2: Análise de Padrões de Texto (mensagem_cliente)
  const textPatternAnalysis = useMemo(() => {
    if (filteredContratos.length === 0) return [];

    const results: { keyword: string; count: number; mrr: number; evitavelPct: number; contratos: string[]; matchedContratos: ChurnContract[] }[] = [];

    Object.entries(EXPANDED_KEYWORDS).forEach(([keyword, terms]) => {
      const matched = filteredContratos.filter(c => {
        const msg = normalizeText(c.mensagem_cliente || '');
        return terms.some(t => msg.includes(t));
      });
      if (matched.length > 0) {
        const evitavel = matched.filter(c => c.evitabilidade_churn === 'Evitável').length;
        results.push({
          keyword,
          count: matched.length,
          mrr: matched.reduce((sum, c) => sum + (c.valorr || 0), 0),
          evitavelPct: matched.length > 0 ? (evitavel / matched.length) * 100 : 0,
          contratos: matched.map(c => c.cliente_nome).slice(0, 5),
          matchedContratos: matched,
        });
      }
    });

    return results.sort((a, b) => b.count - a.count);
  }, [filteredContratos]);

  // Feature 3: Drill-down Motivo → Submotivo
  const motivoSubmotivoTree = useMemo(() => {
    if (filteredContratos.length === 0) return [];

    const tree: Record<string, { count: number; mrr: number; submotivos: Record<string, { count: number; mrr: number }> }> = {};

    filteredContratos.forEach(c => {
      const motivo = c.motivo_cancelamento || 'Não especificado';
      if (!tree[motivo]) tree[motivo] = { count: 0, mrr: 0, submotivos: {} };
      tree[motivo].count++;
      tree[motivo].mrr += c.valorr || 0;

      const sub = c.submotivo || 'Sem submotivo';
      if (!tree[motivo].submotivos[sub]) tree[motivo].submotivos[sub] = { count: 0, mrr: 0 };
      tree[motivo].submotivos[sub].count++;
      tree[motivo].submotivos[sub].mrr += c.valorr || 0;
    });

    return Object.entries(tree)
      .map(([motivo, data]) => ({
        motivo,
        count: data.count,
        mrr: data.mrr,
        submotivos: Object.entries(data.submotivos)
          .map(([sub, info]) => ({ submotivo: sub, count: info.count, mrr: info.mrr }))
          .sort((a, b) => b.mrr - a.mrr),
      }))
      .sort((a, b) => b.mrr - a.mrr);
  }, [filteredContratos]);

  // Feature 4: Matriz Cruzada (Evitabilidade × Motivo/Cluster/Plano)
  const crossAnalysisData = useMemo(() => {
    if (filteredContratos.length === 0) return [];

    const getDimension = (c: ChurnContract) => {
      switch (crossAnalysisView) {
        case 'motivo': return c.motivo_cancelamento || 'Não especificado';
        case 'cluster': return c.cluster || 'Não especificado';
        case 'plano': return c.plano || 'Não especificado';
      }
    };

    const groups: Record<string, { evitavel: number; inevitavel: number; mrrEvitavel: number; mrrInevitavel: number }> = {};

    filteredContratos.forEach(c => {
      const dim = getDimension(c);
      if (!groups[dim]) groups[dim] = { evitavel: 0, inevitavel: 0, mrrEvitavel: 0, mrrInevitavel: 0 };
      if (c.evitabilidade_churn === 'Evitável') {
        groups[dim].evitavel++;
        groups[dim].mrrEvitavel += c.valorr || 0;
      } else {
        groups[dim].inevitavel++;
        groups[dim].mrrInevitavel += c.valorr || 0;
      }
    });

    return Object.entries(groups)
      .map(([name, data]) => ({
        name: name.length > 20 ? name.substring(0, 20) + '...' : name,
        fullName: name,
        evitavel: data.evitavel,
        inevitavel: data.inevitavel,
        mrrEvitavel: data.mrrEvitavel,
        mrrInevitavel: data.mrrInevitavel,
        total: data.evitavel + data.inevitavel,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [filteredContratos, crossAnalysisView]);

  // Feature 5: Cards de Contexto (Operação + CX)
  const contextThemes = useMemo(() => {
    if (filteredContratos.length === 0) return { operacao: [], cx: [] };

    const opThemes: Record<string, string[]> = {
      'Falha de Comunicação': ['comunicação', 'contato', 'resposta', 'alinhamento', 'informação'],
      'Erro Operacional': ['erro', 'falha', 'bug', 'problema técnico', 'incorreto'],
      'Atraso': ['atraso', 'demora', 'prazo', 'lento', 'demorou'],
      'Falta de Acompanhamento': ['acompanhamento', 'follow', 'proativo', 'abandonado', 'negligência'],
      'Turnover': ['turnover', 'troca', 'saiu', 'mudança de equipe', 'rotatividade'],
      'Qualidade': ['qualidade', 'entrega', 'padrão', 'expectativa', 'insatisf'],
    };

    const cxThemes: Record<string, string[]> = {
      'Insatisfação Geral': ['insatisf', 'frustrad', 'descontente', 'chateado', 'decepcion'],
      'Falta de Resultado': ['resultado', 'retorno', 'meta', 'roi', 'performance'],
      'Problema de Comunicação': ['comunicação', 'contato', 'resposta', 'demora', 'suporte'],
      'Questão Financeira': ['preço', 'custo', 'valor', 'caro', 'investimento', 'orçamento'],
      'Mudança de Estratégia': ['estratégia', 'mudança', 'reestrutur', 'direcionamento', 'interno'],
      'Concorrência': ['concorrência', 'concorrente', 'agência', 'inhouse', 'proposta'],
    };

    const analyzeContext = (field: 'contexto_operacao' | 'contexto_cx', themes: Record<string, string[]>) => {
      const results: { theme: string; count: number; mrr: number; examples: string[]; matchedContratos: ChurnContract[] }[] = [];

      Object.entries(themes).forEach(([theme, terms]) => {
        const matched = filteredContratos.filter(c => {
          const text = (c[field] || '').toLowerCase();
          return text.length > 0 && terms.some(t => text.includes(t));
        });
        if (matched.length > 0) {
          results.push({
            theme,
            count: matched.length,
            mrr: matched.reduce((sum, c) => sum + (c.valorr || 0), 0),
            examples: matched.map(c => (c[field] || '').substring(0, 80)).slice(0, 3),
            matchedContratos: matched,
          });
        }
      });

      return results.sort((a, b) => b.count - a.count);
    };

    return {
      operacao: analyzeContext('contexto_operacao', opThemes),
      cx: analyzeContext('contexto_cx', cxThemes),
    };
  }, [filteredContratos]);

  // Feature 6: Score de Oportunidade de Retenção
  const retentionOpportunities = useMemo(() => {
    if (filteredContratos.length === 0) return { scored: [], totalMissed: 0, mrrMissed: 0, avgScore: 0 };

    const scored = filteredContratos.map(c => {
      let score = 0;

      // Possibilidade de retenção (0-30 pts)
      if (c.possibilidade_retencao === 'Alta') score += 30;
      else if (c.possibilidade_retencao === 'Média') score += 20;
      else if (c.possibilidade_retencao === 'Baixa') score += 5;

      // Evitabilidade (0-25 pts)
      if (c.evitabilidade_churn === 'Evitável') score += 25;

      // Lifetime (0-15 pts)
      if (c.lifetime_meses >= 12) score += 15;
      else if (c.lifetime_meses >= 6) score += 10;

      // MRR alto (0-20 pts) - escala relativa
      const maxMrr = Math.max(...filteredContratos.map(x => x.valorr || 0), 1);
      score += Math.round(((c.valorr || 0) / maxMrr) * 20);

      // Tem mensagem_cliente (10 pts)
      if (c.mensagem_cliente && c.mensagem_cliente.trim().length > 0) score += 10;

      const isMissedOpportunity = c.evitabilidade_churn === 'Evitável' &&
        (c.possibilidade_retencao === 'Alta' || c.possibilidade_retencao === 'Média');

      return { ...c, score: Math.min(score, 100), isMissedOpportunity };
    }).sort((a, b) => b.score - a.score);

    const missed = scored.filter(c => c.isMissedOpportunity);
    const avgScore = scored.length > 0 ? scored.reduce((sum, c) => sum + c.score, 0) / scored.length : 0;

    return {
      scored,
      totalMissed: missed.length,
      mrrMissed: missed.reduce((sum, c) => sum + (c.valorr || 0), 0),
      avgScore,
    };
  }, [filteredContratos]);

  // === Voz do Cliente: Análise IA ===

  // Mensagens que têm texto real
  const contratosComMensagem = useMemo(() =>
    filteredContratos.filter(c => c.mensagem_cliente && c.mensagem_cliente.trim().length > 0),
    [filteredContratos]
  );

  // Payload para a IA — só monta quando tem mensagens
  const aiPayload = useMemo(() => {
    if (contratosComMensagem.length === 0) return null;
    return contratosComMensagem.map(c => ({
      id: c.id,
      cliente: c.cliente_nome,
      mensagem: c.mensagem_cliente!,
      motivo: c.motivo_cancelamento || undefined,
      mrr: c.valorr || 0,
    }));
  }, [contratosComMensagem]);

  // Chamada à IA
  const { data: aiAnalysis, isLoading: aiLoading, error: aiError, refetch: refetchAI } = useQuery<{
    analises: { id: string; sentimento: string; temas: string[]; resumo: string }[];
    sintese: { principal_motivo: string; padrao_critico: string; recomendacao: string };
  }>({
    queryKey: ["/api/analytics/churn-mensagens-ai", aiPayload?.map(m => m.id).sort().join(',')],
    queryFn: async () => {
      const res = await fetch("/api/analytics/churn-mensagens-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagens: aiPayload }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${res.status}`);
      }
      return res.json();
    },
    enabled: !!aiPayload && aiPayload.length > 0,
    staleTime: 1000 * 60 * 30, // 30 min cache
    retry: 1,
  });

  // Mapas derivados da análise IA
  const aiByContract = useMemo(() => {
    const map = new Map<string, { sentimento: string; temas: string[]; resumo: string }>();
    if (!aiAnalysis?.analises) return map;
    aiAnalysis.analises.forEach(a => map.set(a.id, a));
    return map;
  }, [aiAnalysis]);

  // Distribuição de sentimento a partir da IA
  const sentimentDistribution = useMemo(() => {
    if (!aiAnalysis?.analises) return [];
    let neg = 0, neu = 0, pos = 0;
    let mrrNeg = 0, mrrNeu = 0, mrrPos = 0;

    aiAnalysis.analises.forEach(a => {
      const c = contratosComMensagem.find(x => x.id === a.id);
      const mrr = c?.valorr || 0;
      if (a.sentimento === 'negativo') { neg++; mrrNeg += mrr; }
      else if (a.sentimento === 'positivo') { pos++; mrrPos += mrr; }
      else { neu++; mrrNeu += mrr; }
    });

    const result: { sentiment: string; count: number; mrr: number; color: string }[] = [];
    if (neg > 0) result.push({ sentiment: 'Negativo', count: neg, mrr: mrrNeg, color: '#ef4444' });
    if (neu > 0) result.push({ sentiment: 'Neutro', count: neu, mrr: mrrNeu, color: '#94a3b8' });
    if (pos > 0) result.push({ sentiment: 'Positivo', count: pos, mrr: mrrPos, color: '#22c55e' });
    return result;
  }, [aiAnalysis, contratosComMensagem]);

  // Distribuição de temas a partir da IA
  const themeDistribution = useMemo(() => {
    if (!aiAnalysis?.analises) return [];
    const themes: Record<string, { count: number; mrr: number }> = {};

    aiAnalysis.analises.forEach(a => {
      const c = contratosComMensagem.find(x => x.id === a.id);
      const mrr = c?.valorr || 0;
      (a.temas || []).forEach(t => {
        if (!themes[t]) themes[t] = { count: 0, mrr: 0 };
        themes[t].count++;
        themes[t].mrr += mrr;
      });
    });

    return Object.entries(themes)
      .map(([theme, data]) => ({ theme, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [aiAnalysis, contratosComMensagem]);

  // Mural filtrado
  const muralMessages = useMemo(() => {
    let msgs = contratosComMensagem.map(c => {
      const ai = aiByContract.get(c.id);
      return {
        ...c,
        sentiment: ai?.sentimento || 'neutro',
        temas: ai?.temas || [],
        resumo: ai?.resumo || '',
      };
    });

    if (muralFilterSentiment) {
      msgs = msgs.filter(m => m.sentiment === muralFilterSentiment);
    }

    if (muralFilterTheme) {
      msgs = msgs.filter(m => m.temas.includes(muralFilterTheme));
    }

    if (muralSortBy === 'mrr') {
      msgs.sort((a, b) => (b.valorr || 0) - (a.valorr || 0));
    } else {
      msgs.sort((a, b) => {
        const da = a.data_encerramento || a.data_pausa || '';
        const db = b.data_encerramento || b.data_pausa || '';
        return db.localeCompare(da);
      });
    }

    return msgs;
  }, [contratosComMensagem, aiByContract, muralFilterSentiment, muralFilterTheme, muralSortBy]);

  // Distribuição por faixa de ticket (MRR)
  const distribuicaoPorTicket = useMemo(() => {
    if (filteredContratos.length === 0) return [];
    
    const ranges = [
      { name: "< R$1k", min: 0, max: 1000, count: 0, mrr: 0 },
      { name: "R$1k-3k", min: 1000, max: 3000, count: 0, mrr: 0 },
      { name: "R$3k-5k", min: 3000, max: 5000, count: 0, mrr: 0 },
      { name: "R$5k-10k", min: 5000, max: 10000, count: 0, mrr: 0 },
      { name: "> R$10k", min: 10000, max: Infinity, count: 0, mrr: 0 },
    ];
    
    filteredContratos.forEach(c => {
      const valor = c.valorr || 0;
      for (const range of ranges) {
        if (valor >= range.min && valor < range.max) {
          range.count++;
          range.mrr += valor;
          break;
        }
      }
    });
    
    const total = filteredContratos.length;
    return ranges.map(r => ({
      ...r,
      percentual: total > 0 ? (r.count / total) * 100 : 0
    })).filter(r => r.count > 0);
  }, [filteredContratos]);

  // Comparativo Churn vs Pausado por mês
  const comparativoMensal = useMemo(() => {
    if (filteredContratos.length === 0) return [];

    const meses: Record<string, { churn: number; pausado: number; abonado: number; mrrChurn: number; mrrPausado: number; mrrAbonado: number; sortKey: string }> = {};

    filteredContratos.forEach(c => {
      const refDate = c.tipo === 'pausado' ? c.data_pausa : c.data_encerramento;
      if (!refDate) return;
      const parsedDate = parseISO(refDate);
      const mes = format(parsedDate, "MMM/yy", { locale: ptBR });
      const sortKey = format(parsedDate, "yyyy-MM");

      if (!meses[mes]) meses[mes] = { churn: 0, pausado: 0, abonado: 0, mrrChurn: 0, mrrPausado: 0, mrrAbonado: 0, sortKey };

      if (c.is_abonado) {
        meses[mes].abonado++;
        meses[mes].mrrAbonado += c.valorr || 0;
      } else if (c.tipo === 'churn') {
        meses[mes].churn++;
        meses[mes].mrrChurn += c.valorr || 0;
      } else if (c.tipo === 'pausado') {
        meses[mes].pausado++;
        meses[mes].mrrPausado += c.valorr || 0;
      }
    });

    return Object.entries(meses)
      .map(([mes, data]) => ({ mes, ...data }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .slice(-12);
  }, [filteredContratos]);

  // Análise de cohort: tempo médio até churn por mês de início
  const cohortAnalysis = useMemo(() => {
    if (filteredContratos.length === 0) return [];
    
    const churnContratos = filteredContratos.filter(c => c.tipo === 'churn' && !c.is_abonado && c.data_inicio);
    if (churnContratos.length === 0) return [];
    
    const cohorts: Record<string, { count: number; totalLifetime: number; totalMrr: number }> = {};
    
    churnContratos.forEach(c => {
      if (!c.data_inicio) return;
      const startDate = parseISO(c.data_inicio);
      const cohort = format(startDate, "MMM/yy", { locale: ptBR });
      const sortKey = format(startDate, "yyyy-MM");
      
      if (!cohorts[cohort]) {
        cohorts[cohort] = { count: 0, totalLifetime: 0, totalMrr: 0 };
        (cohorts[cohort] as any).sortKey = sortKey;
      }
      cohorts[cohort].count++;
      cohorts[cohort].totalLifetime += c.lifetime_meses || 0;
      cohorts[cohort].totalMrr += c.valorr || 0;
    });
    
    return Object.entries(cohorts)
      .map(([cohort, data]) => ({
        cohort,
        count: data.count,
        avgLifetime: data.count > 0 ? data.totalLifetime / data.count : 0,
        avgMrr: data.count > 0 ? data.totalMrr / data.count : 0,
        sortKey: (data as any).sortKey
      }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .slice(-12);
  }, [filteredContratos]);

  // Curva de distribuição de lifetime (calculada no frontend com filtros)
  const lifetimeCurve = useMemo(() => {
    const contratosComLifetime = filteredContratos.filter(c => 
      c.lifetime_meses !== undefined && c.lifetime_meses !== null && c.lifetime_meses >= 0
    );
    
    if (contratosComLifetime.length === 0) return [];
    
    const totalBase = contratosComLifetime.length;
    const totalMrrBase = contratosComLifetime.reduce((sum, c) => sum + (c.valorr || 0), 0);
    
    const curve: { monthIndex: number; retainedPct: number; mrrRetainedPct: number; retainedCount: number; totalStarted: number; churnedCount: number }[] = [];
    
    for (let month = 0; month <= 12; month++) {
      const sobreviventes = contratosComLifetime.filter(c => c.lifetime_meses >= month);
      const sobrevivMrr = sobreviventes.reduce((sum, c) => sum + (c.valorr || 0), 0);
      const churnedNoPeriodo = contratosComLifetime.filter(c => 
        c.lifetime_meses >= month && c.lifetime_meses < month + 1
      );
      
      const retainedPct = totalBase > 0 ? (sobreviventes.length / totalBase) * 100 : 0;
      const mrrRetainedPct = totalMrrBase > 0 ? (sobrevivMrr / totalMrrBase) * 100 : 0;
      
      curve.push({
        monthIndex: month,
        retainedPct: Math.round(retainedPct * 10) / 10,
        mrrRetainedPct: Math.round(mrrRetainedPct * 10) / 10,
        retainedCount: sobreviventes.length,
        totalStarted: totalBase,
        churnedCount: churnedNoPeriodo.length,
      });
    }
    
    return curve;
  }, [filteredContratos]);

  // MRR perdido por mês (evolução)
  const mrrPerdidoPorMes = useMemo(() => {
    if (filteredContratos.length === 0) return [];

    const meses: Record<string, { mrr: number; mrrAbonado: number; sortKey: string }> = {};

    filteredContratos.forEach(c => {
      if (c.tipo !== 'churn') return;
      if (!c.data_encerramento) return;
      const parsedDate = parseISO(c.data_encerramento);
      const mes = format(parsedDate, "MMM/yy", { locale: ptBR });
      const sortKey = format(parsedDate, "yyyy-MM");

      if (!meses[mes]) meses[mes] = { mrr: 0, mrrAbonado: 0, sortKey };
      if (c.is_abonado) {
        meses[mes].mrrAbonado += c.valorr || 0;
      } else {
        meses[mes].mrr += c.valorr || 0;
      }
    });

    return Object.entries(meses)
      .map(([mes, data]) => ({ mes, mrr: data.mrr, mrrAbonado: data.mrrAbonado, sortKey: data.sortKey }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .slice(-12);
  }, [filteredContratos]);

  interface ClienteAgrupado {
    cnpj: string;
    cliente_nome: string;
    contratos_count: number;
    mrr_total: number;
    ltv_total: number;
    lifetime_medio: number;
    ultima_data_encerramento: string;
    produtos: string[];
    squads: string[];
  }

  const clientesAgrupados = useMemo((): ClienteAgrupado[] => {
    if (filteredContratos.length === 0) return [];
    
    const clientesMap: Record<string, {
      cnpj: string;
      cliente_nome: string;
      contratos: ChurnContract[];
    }> = {};
    
    filteredContratos.forEach(c => {
      const key = c.cnpj || c.cliente_nome || "unknown";
      if (!clientesMap[key]) {
        clientesMap[key] = {
          cnpj: c.cnpj,
          cliente_nome: c.cliente_nome,
          contratos: []
        };
      }
      clientesMap[key].contratos.push(c);
    });
    
    return Object.values(clientesMap)
      .map(cliente => {
        const contratos = cliente.contratos;
        const mrrTotal = contratos.reduce((sum, c) => sum + (c.valorr || 0), 0);
        const ltvTotal = contratos.reduce((sum, c) => sum + (c.ltv || 0), 0);
        const ltMedio = contratos.reduce((sum, c) => sum + (c.lifetime_meses || 0), 0) / contratos.length;
        const ultimaData = contratos.reduce((max, c) => {
          if (!c.data_encerramento) return max;
          return !max || new Date(c.data_encerramento) > new Date(max) ? c.data_encerramento : max;
        }, "" as string);
        const produtos = Array.from(new Set(contratos.map(c => c.produto).filter(Boolean)));
        const squads = Array.from(new Set(contratos.map(c => c.squad).filter(Boolean)));
        
        return {
          cnpj: cliente.cnpj,
          cliente_nome: cliente.cliente_nome,
          contratos_count: contratos.length,
          mrr_total: mrrTotal,
          ltv_total: ltvTotal,
          lifetime_medio: ltMedio,
          ultima_data_encerramento: ultimaData,
          produtos,
          squads
        };
      })
      .sort((a, b) => {
        if (sortBy === "mrr_total" || sortBy === "valorr") {
          return sortOrder === "desc" ? b.mrr_total - a.mrr_total : a.mrr_total - b.mrr_total;
        }
        if (sortBy === "ltv" || sortBy === "ltv_total") {
          return sortOrder === "desc" ? b.ltv_total - a.ltv_total : a.ltv_total - b.ltv_total;
        }
        if (sortBy === "lifetime_meses") {
          return sortOrder === "desc" ? b.lifetime_medio - a.lifetime_medio : a.lifetime_medio - b.lifetime_medio;
        }
        if (sortBy === "data_encerramento") {
          const dateA = a.ultima_data_encerramento ? new Date(a.ultima_data_encerramento).getTime() : 0;
          const dateB = b.ultima_data_encerramento ? new Date(b.ultima_data_encerramento).getTime() : 0;
          return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
        }
        return sortOrder === "desc" 
          ? (b.cliente_nome || "").localeCompare(a.cliente_nome || "")
          : (a.cliente_nome || "").localeCompare(b.cliente_nome || "");
      });
  }, [filteredContratos, sortBy, sortOrder]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return null;
    return sortOrder === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const setQuickPeriod = (months: number) => {
    setDataFim(format(new Date(), "yyyy-MM-dd"));
    setDataInicio(format(subMonths(new Date(), months), "yyyy-MM-dd"));
  };

  const colors = {
    danger: "text-red-500",
    warning: "text-amber-500",
    success: "text-emerald-500",
    info: "text-blue-500",
  };

  const churnPorMesTotal = churnPorMes.reduce((sum, item) => sum + item.count, 0);
  const churnPorMesMedia = churnPorMes.length > 0 ? churnPorMesTotal / churnPorMes.length : 0;
  const topServico = distribuicaoPorProduto[0];
  const topLifetime = distribuicaoPorLifetime.length > 0
    ? distribuicaoPorLifetime.reduce((best, item) => (item.count > best.count ? item : best))
    : undefined;
  const topTicket = distribuicaoPorTicket.length > 0
    ? distribuicaoPorTicket.reduce((best, item) => (item.count > best.count ? item : best))
    : undefined;
  const mrrSquadTotal = distribuicaoPorSquad.reduce((sum, item) => sum + item.mrr, 0);
  const mrrResponsavelTotal = distribuicaoPorResponsavel.reduce((sum, item) => sum + item.mrr, 0);
  const mrrPerdidoTotal = mrrPerdidoPorMes.reduce((sum, item) => sum + item.mrr, 0);
  const mrrAbonadoTotal = mrrPerdidoPorMes.reduce((sum, item) => sum + item.mrrAbonado, 0);
  const comparativoChurnTotal = comparativoMensal.reduce((sum, item) => sum + item.mrrChurn, 0);
  const comparativoAbonadoTotal = comparativoMensal.reduce((sum, item) => sum + item.mrrAbonado, 0);
  const comparativoPausadoTotal = comparativoMensal.reduce((sum, item) => sum + item.mrrPausado, 0);
  const cohortMediaGeral = cohortAnalysis.length > 0
    ? cohortAnalysis.reduce((sum, item) => sum + item.avgLifetime, 0) / cohortAnalysis.length
    : 0;

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
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Período de Análise</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Início</label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-40"
                data-testid="input-data-inicio"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Fim</label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-40"
                data-testid="input-data-fim"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod(3)} data-testid="button-period-3m">3M</Button>
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod(6)} data-testid="button-period-6m">6M</Button>
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod(12)} data-testid="button-period-12m">12M</Button>
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod(24)} data-testid="button-period-24m">24M</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <>

      {/* Filtro de abono */}
      <div className="flex items-center justify-end gap-3 flex-wrap">
        <div className="flex gap-1 p-1 rounded-lg bg-muted/50 border border-border/40 w-fit">
          {([
            { key: "todos", label: "Todos" },
            { key: "nao_abonados", label: "Não abonados" },
            { key: "abonados", label: "Abonados" },
          ] as const).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilterAbono(opt.key)}
              data-testid={`filter-abono-${opt.key}`}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filterAbono === opt.key
                  ? opt.key === "abonados"
                    ? "bg-amber-100 dark:bg-amber-900/40 shadow-sm text-amber-800 dark:text-amber-300"
                    : "bg-white dark:bg-zinc-800 shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-zinc-800/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Painel Executivo Hero - Taxa de Churn */}
      {!isLoading && data?.metricas?.mrr_ativo_ref !== undefined && (
        <Card className="relative overflow-hidden border-2 border-red-200/50 dark:border-red-900/30 bg-gradient-to-br from-slate-50 via-white to-red-50/30 dark:from-zinc-900 dark:via-zinc-900 dark:to-red-950/20">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }} />
          </div>
          
          <CardContent className="relative p-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Coluna 1: Gauge e status */}
              <div className="flex flex-col items-center justify-center p-4 bg-white/50 dark:bg-zinc-800/30 rounded-xl border border-gray-100 dark:border-zinc-700/50">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">{filterAbono === "abonados" ? "Taxa de Abono" : "Taxa de Churn"}</h3>
                <ChurnGauge
                  value={filteredTaxaChurn || 0}
                  statusOverride={filterAbono === "abonados"
                    ? { label: "Recorte: abonados", color: "text-amber-500", bg: "from-amber-500 to-orange-500", dotBg: "bg-amber-500" }
                    : gaugeStatusOverride}
                />
                {filterAbono !== "abonados" && churnPlanejado.taxaPlanejada > 0 && (
                  <p className="text-[11px] text-muted-foreground text-center mt-1">
                    Planejado até hoje: <span className="font-semibold">{churnPlanejado.taxaPlanejada.toFixed(2)}%</span>
                  </p>
                )}
                {filterAbono !== "abonados" && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    Status baseado na media diaria
                  </p>
                )}
              </div>
              
              {/* Coluna 2: Métricas principais */}
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

      {/* Filtros Avançados - sempre visível em qualquer sub-aba */}
      <Card className="border-border/50">
        <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
          <CardHeader className="py-3">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto no-default-hover-elevate" data-testid="button-toggle-filters">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-gradient-to-r from-slate-500 to-gray-600">
                    <Filter className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Filtros Avançados</span>
                    {(searchTerm || filterSquads.length > 0 || filterProdutos.length > 0 || filterResponsaveis.length > 0 || filterServicos.length > 0 || filterPlanos.length > 0 || filterClusters.length > 0 || filterEvitabilidades.length > 0 || filterPossibilidadesRetencao.length > 0) && (
                      <Badge variant="secondary" className="text-[10px] h-5">
                        {[searchTerm ? 1 : 0, filterSquads.length, filterProdutos.length, filterResponsaveis.length, filterServicos.length, filterPlanos.length, filterClusters.length, filterEvitabilidades.length, filterPossibilidadesRetencao.length].reduce((a, b) => a + (b > 0 ? 1 : 0), 0)} ativo(s)
                      </Badge>
                    )}
                  </div>
                </div>
                {isFiltersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Buscar</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Cliente, CNPJ, produto..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-churn"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Squads</label>
                  <MultiSelect
                    options={data?.filtros?.squads || []}
                    selected={filterSquads}
                    onChange={setFilterSquads}
                    placeholder="Todos os squads"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Produtos</label>
                  <MultiSelect
                    options={data?.filtros?.produtos || []}
                    selected={filterProdutos}
                    onChange={setFilterProdutos}
                    placeholder="Todos os produtos"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Responsáveis</label>
                  <MultiSelect
                    options={data?.filtros?.responsaveis || []}
                    selected={filterResponsaveis}
                    onChange={setFilterResponsaveis}
                    placeholder="Todos os responsáveis"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Serviço</label>
                  <MultiSelect
                    options={data?.filtros?.servicos || []}
                    selected={filterServicos}
                    onChange={setFilterServicos}
                    placeholder="Todos os serviços"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Plano</label>
                  <MultiSelect
                    options={data?.filtros?.planos || []}
                    selected={filterPlanos}
                    onChange={setFilterPlanos}
                    placeholder="Todos os planos"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Cluster</label>
                  <MultiSelect
                    options={data?.filtros?.clusters || []}
                    selected={filterClusters}
                    onChange={setFilterClusters}
                    placeholder="Todos os clusters"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Evitabilidade</label>
                  <MultiSelect
                    options={data?.filtros?.evitabilidades || []}
                    selected={filterEvitabilidades}
                    onChange={setFilterEvitabilidades}
                    placeholder="Todas"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Possib. Retenção</label>
                  <MultiSelect
                    options={data?.filtros?.possibilidades_retencao || []}
                    selected={filterPossibilidadesRetencao}
                    onChange={setFilterPossibilidadesRetencao}
                    placeholder="Todas"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Ordenar por</label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger data-testid="select-sort">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="data_encerramento">Data de Encerramento</SelectItem>
                      <SelectItem value="valorr">MRR</SelectItem>
                      <SelectItem value="lifetime_meses">Lifetime</SelectItem>
                      <SelectItem value="ltv">LTV</SelectItem>
                      <SelectItem value="cliente_nome">Cliente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end col-span-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm("");
                      setFilterSquads([]);
                      setFilterProdutos([]);
                      setFilterResponsaveis([]);
                      setFilterServicos([]);
                      setFilterPlanos([]);
                      setFilterClusters([]);
                      setFilterEvitabilidades([]);
                      setFilterPossibilidadesRetencao([]);
                      setDataInicio(format(subMonths(new Date(), 12), "yyyy-MM-dd"));
                      setDataFim(format(new Date(), "yyyy-MM-dd"));
                      setSortBy("data_encerramento");
                      setSortOrder("desc");
                    }}
                    data-testid="button-clear-filters"
                  >
                    Limpar Todos os Filtros
                  </Button>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>


      </>
    </div>
  );
}





