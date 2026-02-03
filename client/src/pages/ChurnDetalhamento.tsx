import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
  Pause
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, parseISO, subMonths, startOfMonth, endOfMonth, differenceInCalendarDays } from "date-fns";
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

interface ChurnContract {
  id: string;
  cliente_nome: string;
  cnpj: string;
  produto: string;
  squad: string;
  responsavel: string;
  cs_responsavel: string;
  vendedor: string;
  valorr: number;
  data_inicio: string;
  data_encerramento: string | null;
  data_pausa: string | null;
  status: string;
  servico: string;
  motivo_cancelamento?: string;
  tipo: 'churn' | 'pausado';
  lifetime_meses: number;
  ltv: number;
}

interface ChurnPorSquad {
  squad: string;
  mrr_ativo: number;
  mrr_perdido: number;
  percentual: number;
}

interface RetentionPoint {
  monthIndex: number;
  retainedPct: number;
  mrrRetainedPct: number;
  retainedCount: number;
  totalStarted: number;
  retainedMrr: number;
  churnedCount: number;
}

interface ChurnPorMotivo {
  motivo: string;
  mrr_perdido: number;
  quantidade: number;
  percentual: number;
}

interface ChurnDetalhamentoData {
  contratos: ChurnContract[];
  metricas: {
    total_churned: number;
    total_pausados: number;
    mrr_perdido: number;
    mrr_pausado: number;
    ltv_total: number;
    lt_medio: number;
    mrr_ativo_ref?: number;
    churn_percentual?: number;
    churn_por_squad?: ChurnPorSquad[];
    churn_por_motivo?: ChurnPorMotivo[];
    periodo_referencia?: string;
  };
  filtros: {
    squads: string[];
    produtos: string[];
    responsaveis: string[];
    servicos: string[];
  };
  retentionCurve?: RetentionPoint[];
}

const CHART_COLORS = {
  primary: "hsl(var(--chart-1))",
  secondary: "hsl(var(--chart-2))",
  tertiary: "hsl(var(--chart-3))",
  quaternary: "hsl(var(--chart-4))",
  quinary: "hsl(var(--chart-5))",
};

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

const CustomTooltip = ({ active, payload, label, valueFormatter }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-gray-200 dark:border-zinc-700/50 rounded-lg shadow-xl p-3 min-w-[160px]">
      <p className="text-xs font-medium text-gray-600 dark:text-zinc-300 mb-2 uppercase tracking-wider">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-500 dark:text-zinc-400">{entry.name === "count" ? "Quantidade" : entry.name}</span>
          <span className="font-bold text-gray-900 dark:text-white">
            {valueFormatter ? valueFormatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const TechKpiCard = ({ title, value, subtitle, icon: Icon, gradient, shadowColor, size = "normal" }: {
  title: string;
  value: string;
  subtitle: string;
  icon: any;
  gradient: string;
  shadowColor: string;
  size?: "normal" | "large";
}) => (
  <Card className={`relative overflow-hidden border-border/50 hover:border-border transition-all hover:shadow-lg ${size === "large" ? "col-span-2" : ""}`}>
    <CardContent className={size === "large" ? "p-5" : "p-4"}>
      <div className="flex items-center justify-between mb-2">
        <span className={`font-semibold text-muted-foreground uppercase tracking-wider ${size === "large" ? "text-xs" : "text-[10px]"}`}>
          {title}
        </span>
        <div className={`rounded-md ${gradient} ${size === "large" ? "p-2" : "p-1.5"}`}>
          <Icon className={`text-white ${size === "large" ? "h-4 w-4" : "h-3 w-3"}`} />
        </div>
      </div>
      <div className={`font-bold text-foreground tracking-tight ${size === "large" ? "text-2xl" : "text-xl"}`}>{value}</div>
      <p className={`text-muted-foreground mt-0.5 ${size === "large" ? "text-xs" : "text-[10px]"}`}>{subtitle}</p>
    </CardContent>
  </Card>
);

const StatPill = ({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger" | "warning" | "success" | "info";
}) => {
  const toneStyles = {
    default: "border-border/60 bg-muted/40 text-foreground",
    danger: "border-red-200/60 bg-red-50/70 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
    warning: "border-amber-200/60 bg-amber-50/70 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
    success: "border-emerald-200/60 bg-emerald-50/70 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    info: "border-blue-200/60 bg-blue-50/70 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
  };

  return (
    <div className={`rounded-md border px-2.5 py-1 ${toneStyles[tone]}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xs font-semibold tabular-nums">{value}</div>
    </div>
  );
};

// Componente de Gauge visual para taxa de churn
const ChurnGauge = ({
  value,
  maxValue = 10,
  statusOverride,
}: {
  value: number;
  maxValue?: number;
  statusOverride?: { label: string; color: string; bg: string; dotBg: string };
}) => {
  const percentage = Math.min((value / maxValue) * 100, 100);
  const getColor = () => {
    if (value <= 2) return { color: "text-emerald-500", bg: "from-emerald-500 to-green-500", status: "Excelente", dotBg: "bg-emerald-500" };
    if (value <= 4) return { color: "text-yellow-500", bg: "from-yellow-500 to-amber-500", status: "Atenção", dotBg: "bg-yellow-500" };
    if (value <= 6) return { color: "text-orange-500", bg: "from-orange-500 to-red-500", status: "Crítico", dotBg: "bg-orange-500" };
    return { color: "text-red-600", bg: "from-red-600 to-rose-700", status: "Emergência", dotBg: "bg-red-600" };
  };
  const config = statusOverride
    ? { ...statusOverride, status: statusOverride.label }
    : getColor();
  
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-20 overflow-hidden">
        {/* Background arc */}
        <div className="absolute inset-0 bg-gray-200 dark:bg-zinc-800 rounded-t-full" />
        {/* Colored arc */}
        <div 
          className={`absolute inset-0 bg-gradient-to-r ${config.bg} rounded-t-full origin-bottom transition-transform duration-1000`}
          style={{ 
            clipPath: `polygon(0 100%, 0 ${100 - percentage}%, 100% ${100 - percentage}%, 100% 100%)`,
          }}
        />
        {/* Center circle */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-12 bg-white dark:bg-zinc-900 rounded-t-full flex items-end justify-center pb-1">
          <span className={`text-2xl font-bold ${config.color}`}>{value.toFixed(1)}%</span>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <div className={`w-3 h-3 rounded-full ${config.dotBg} animate-pulse`} />
        <span className={`text-sm font-semibold ${config.color}`}>{config.status}</span>
      </div>
    </div>
  );
};

const TechChartCard = ({ title, subtitle, icon: Icon, iconBg, meta, footer, children }: {
  title: string;
  subtitle: string;
  icon: any;
  iconBg: string;
  meta?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <Card className="border-border/50 bg-gradient-to-b from-white to-slate-50/80 dark:from-zinc-900/70 dark:to-zinc-950/40 shadow-sm hover:shadow-md transition-all">
    <CardHeader className="pb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-md ${iconBg} shadow-sm`}>
            <Icon className="h-4 w-4 text-white" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">{subtitle}</CardDescription>
          </div>
        </div>
        {meta && (
          <div className="hidden md:flex items-center gap-2">
            {meta}
          </div>
        )}
      </div>
    </CardHeader>
    <CardContent className="pt-0">
      <div className="rounded-lg border border-border/40 bg-white/80 dark:bg-zinc-900/50 p-3">
        {children}
      </div>
      {footer && (
        <div className="mt-3 text-[11px] text-muted-foreground">
          {footer}
        </div>
      )}
    </CardContent>
  </Card>
);

const SectionBlock = ({
  title,
  subtitle,
  icon: Icon,
  accent,
  children,
}: {
  title: string;
  subtitle: string;
  icon: any;
  accent: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 shadow-sm space-y-4">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${accent} shadow-sm`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
        <p className="text-sm font-semibold text-foreground">{subtitle}</p>
      </div>
    </div>
    {children}
  </div>
);

export default function ChurnDetalhamento() {
  usePageTitle("Detalhamento de Churn");
  useSetPageInfo("Detalhamento de Churn", "Análise detalhada de contratos encerrados");

  const MRR_BASE_OVERRIDE = 1119046;
  const CHURN_MAX_TARGET = 102000;
  const BASE_REFERENCE_DATE = new Date(2026, 0, 1);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSquads, setFilterSquads] = useState<string[]>([]);
  const [filterProdutos, setFilterProdutos] = useState<string[]>([]);
  const [filterResponsaveis, setFilterResponsaveis] = useState<string[]>([]);
  const [filterServicos, setFilterServicos] = useState<string[]>([]);
  const [dataInicio, setDataInicio] = useState<string>(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState<string>(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [sortBy, setSortBy] = useState<string>("data_encerramento");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false); // Fechado por padrão, dados principais no hero
  const [viewMode, setViewMode] = useState<"contratos" | "clientes">("contratos");

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
  }, [data?.contratos, searchTerm, filterSquads, filterProdutos, filterResponsaveis, filterServicos, dataInicio, dataFim, sortBy, sortOrder]);

  const filteredMetricas = useMemo(() => {
    if (filteredContratos.length === 0) {
      return { total_churned: 0, total_pausados: 0, mrr_perdido: 0, mrr_pausado: 0, ltv_total: 0, lt_medio: 0, ticket_medio: 0 };
    }
    
    const churnContratos = filteredContratos.filter(c => c.tipo === 'churn');
    const pausadoContratos = filteredContratos.filter(c => c.tipo === 'pausado');
    
    const totalChurned = churnContratos.length;
    const totalPausados = pausadoContratos.length;
    const mrrPerdido = churnContratos.reduce((sum, c) => sum + (c.valorr || 0), 0);
    const mrrPausado = pausadoContratos.reduce((sum, c) => sum + (c.valorr || 0), 0);
    const ltvTotal = churnContratos.reduce((sum, c) => sum + (c.ltv || 0), 0);
    const ltMedio = totalChurned > 0 ? churnContratos.reduce((sum, c) => sum + (c.lifetime_meses || 0), 0) / totalChurned : 0;
    const ticketMedio = totalChurned > 0 ? mrrPerdido / totalChurned : 0;
    
    return {
      total_churned: totalChurned,
      total_pausados: totalPausados,
      mrr_perdido: mrrPerdido,
      mrr_pausado: mrrPausado,
      ltv_total: ltvTotal,
      lt_medio: ltMedio,
      ticket_medio: ticketMedio
    };
  }, [filteredContratos]);

  const filteredChurnPorSquad = useMemo(() => {
    if (filteredContratos.length === 0 || !data?.metricas?.churn_por_squad) return [];
    
    const churnContratos = filteredContratos.filter(c => c.tipo === 'churn');
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

  const filteredTaxaChurn = useMemo(() => {
    const mrrBase = MRR_BASE_OVERRIDE;
    const mrrPerdido = filteredMetricas.mrr_perdido;
    return mrrBase > 0 ? (mrrPerdido / mrrBase) * 100 : 0;
  }, [filteredMetricas.mrr_perdido]);

  const churnDailyInsights = useMemo(() => {
    const mrrBase = MRR_BASE_OVERRIDE;
    const churnTarget = CHURN_MAX_TARGET;
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
  }, [filteredMetricas.mrr_perdido, dataInicio, dataFim]);

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
    if (filteredContratos.length === 0) return [];
    
    const squadCounts: Record<string, { count: number; mrr: number }> = {};
    filteredContratos.forEach(c => {
      const squad = c.squad || "Não especificado";
      if (!squadCounts[squad]) squadCounts[squad] = { count: 0, mrr: 0 };
      squadCounts[squad].count++;
      squadCounts[squad].mrr += c.valorr || 0;
    });
    
    const total = filteredContratos.length;
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
    
    const churnContratos = filteredContratos.filter(c => c.tipo === 'churn');
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
    
    const meses: Record<string, { count: number; mrr: number; sortKey: string }> = {};
    filteredContratos.forEach(c => {
      const refDate = c.tipo === 'pausado' ? c.data_pausa : c.data_encerramento;
      if (!refDate) return;
      const parsedDate = parseISO(refDate);
      const mes = format(parsedDate, "MMM/yy", { locale: ptBR });
      const sortKey = format(parsedDate, "yyyy-MM");
      if (!meses[mes]) meses[mes] = { count: 0, mrr: 0, sortKey };
      meses[mes].count++;
      meses[mes].mrr += c.valorr || 0;
    });
    
    return Object.entries(meses)
      .map(([mes, data]) => ({
        mes,
        count: data.count,
        mrr: data.mrr,
        sortKey: data.sortKey
      }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .slice(-12);
  }, [filteredContratos]);

  // Top clientes perdidos (maior impacto financeiro)
  const topClientesPerdidos = useMemo(() => {
    if (filteredContratos.length === 0) return [];
    
    const churnContratos = filteredContratos.filter(c => c.tipo === 'churn');
    return churnContratos
      .sort((a, b) => b.valorr - a.valorr)
      .slice(0, 10);
  }, [filteredContratos]);

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
    
    const meses: Record<string, { churn: number; pausado: number; mrrChurn: number; mrrPausado: number; sortKey: string }> = {};
    
    filteredContratos.forEach(c => {
      const refDate = c.tipo === 'pausado' ? c.data_pausa : c.data_encerramento;
      if (!refDate) return;
      const parsedDate = parseISO(refDate);
      const mes = format(parsedDate, "MMM/yy", { locale: ptBR });
      const sortKey = format(parsedDate, "yyyy-MM");
      
      if (!meses[mes]) meses[mes] = { churn: 0, pausado: 0, mrrChurn: 0, mrrPausado: 0, sortKey };
      
      if (c.tipo === 'churn') {
        meses[mes].churn++;
        meses[mes].mrrChurn += c.valorr || 0;
      } else {
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
    
    const churnContratos = filteredContratos.filter(c => c.tipo === 'churn' && c.data_inicio);
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
    
    const meses: Record<string, { mrr: number; sortKey: string }> = {};
    const churnContratos = filteredContratos.filter(c => c.tipo === 'churn');
    
    churnContratos.forEach(c => {
      if (!c.data_encerramento) return;
      const parsedDate = parseISO(c.data_encerramento);
      const mes = format(parsedDate, "MMM/yy", { locale: ptBR });
      const sortKey = format(parsedDate, "yyyy-MM");
      
      if (!meses[mes]) meses[mes] = { mrr: 0, sortKey };
      meses[mes].mrr += c.valorr || 0;
    });
    
    return Object.entries(meses)
      .map(([mes, data]) => ({ mes, mrr: data.mrr, sortKey: data.sortKey }))
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
  const comparativoChurnTotal = comparativoMensal.reduce((sum, item) => sum + item.mrrChurn, 0);
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

      {/* Painel Executivo Hero - Taxa de Churn */}
      {!isLoading && data?.metricas?.mrr_ativo_ref !== undefined && (
        <Card className="relative overflow-hidden border-2 border-red-200/50 dark:border-red-900/30 bg-gradient-to-br from-slate-50 via-white to-red-50/30 dark:from-zinc-900 dark:via-zinc-900 dark:to-red-950/20">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }} />
          </div>
          
          <CardContent className="relative p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Coluna 1: Gauge e status */}
              <div className="flex flex-col items-center justify-center p-4 bg-white/50 dark:bg-zinc-800/30 rounded-xl border border-gray-100 dark:border-zinc-700/50">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Taxa de Churn</h3>
                <ChurnGauge value={filteredTaxaChurn || 0} statusOverride={gaugeStatusOverride} />
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  Base: {format(BASE_REFERENCE_DATE, "MMMM/yyyy", { locale: ptBR })}
                </p>
                <p className="text-[10px] text-muted-foreground text-center">
                  Status baseado na media diaria
                </p>
              </div>
              
              {/* Coluna 2: Métricas principais */}
              <div className="flex flex-col gap-3">
                <div className="flex-1 p-4 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-100 dark:border-red-900/50 flex flex-col justify-center">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-red-600 dark:text-red-400 uppercase">MRR Perdido</span>
                    <DollarSign className="h-4 w-4 text-red-500" />
                  </div>
                  <div className="text-2xl font-bold text-red-700 dark:text-red-300">{formatCurrency(filteredMetricas.mrr_perdido)}</div>
                  <div className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">{filteredMetricas.total_churned} contratos encerrados</div>
                </div>
                
                <div className="flex-1 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-100 dark:border-amber-900/50 flex flex-col justify-center">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase">MRR Pausado</span>
                    <Pause className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{formatCurrency(filteredMetricas.mrr_pausado)}</div>
                  <div className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">{filteredMetricas.total_pausados} contratos pausados</div>
                </div>
                
                <div className="flex-1 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/50 flex flex-col justify-center">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">MRR Base Referência</span>
                    <Target className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{formatCurrency(MRR_BASE_OVERRIDE)}</div>
                  <div className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">base para cálculo do churn</div>
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
                        <span className="text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums" data-testid={`text-mrr-motivo-${index}`}>
                          {formatCurrencyNoDecimals(item.mrr_perdido)}
                        </span>
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

      <SectionBlock
        title="Volume e Mix"
        subtitle="Como o churn se distribui no periodo"
        icon={BarChart3}
        accent="bg-gradient-to-r from-orange-500 to-amber-500"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TechChartCard
          title="Churn por Mês"
          subtitle="Evolução mensal de contratos encerrados"
          icon={BarChart3}
          iconBg="bg-gradient-to-r from-orange-500 to-amber-500"
          meta={
            <div className="flex flex-wrap items-center gap-2">
              <StatPill label="Total 12m" value={`${churnPorMesTotal} contratos`} />
              <StatPill label="Media" value={`${churnPorMesMedia.toFixed(1)}/mes`} />
            </div>
          }
        >
          {isLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : churnPorMes.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Nenhum dado disponível
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={churnPorMes} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.9}/>
                    <stop offset="100%" stopColor="#ea580c" stopOpacity={0.7}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="mes" 
                  tick={{ fontSize: 10 }} 
                  axisLine={false}
                  tickLine={false}
                  className="fill-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 10 }} 
                  axisLine={false}
                  tickLine={false}
                  className="fill-muted-foreground"
                />
                <Tooltip content={<CustomTooltip valueFormatter={(v: number) => `${v} contratos`} />} />
                <Bar dataKey="count" fill="url(#barGradient)" radius={[4, 4, 0, 0]} name="Quantidade" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </TechChartCard>

        <TechChartCard
          title="Distribuição por Serviço"
          subtitle="Percentual de churn por serviço"
          icon={PieChart}
          iconBg="bg-gradient-to-r from-blue-500 to-indigo-500"
          meta={
            <StatPill
              label="Top servico"
              value={topServico ? `${topServico.name} (${topServico.percentual.toFixed(0)}%)` : "-"}
              tone="info"
            />
          }
        >
          {isLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : distribuicaoPorProduto.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Nenhum dado disponível
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={200}>
                <RechartsPie>
                  <Pie
                    data={distribuicaoPorProduto}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    strokeWidth={2}
                    stroke="hsl(var(--card))"
                  >
                    {distribuicaoPorProduto.map((entry, index) => (
                      <Cell key={entry.name} fill={REFINED_COLORS[index % REFINED_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip valueFormatter={(v: number) => `${v} contratos`} />} />
                </RechartsPie>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2 text-xs">
                {distribuicaoPorProduto.slice(0, 5).map((item, i) => (
                  <div key={item.name} className="rounded-md border border-border/40 bg-white/70 dark:bg-zinc-900/50 px-2 py-1 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div 
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" 
                          style={{ backgroundColor: REFINED_COLORS[i % REFINED_COLORS.length] }}
                        />
                        <span className="truncate text-muted-foreground">{item.fullName}</span>
                      </div>
                      <span className="font-semibold text-foreground tabular-nums">{item.count}</span>
                    </div>
                    <div className="pl-4 text-[10px] text-red-500 dark:text-red-400">
                      {formatCurrencyNoDecimals(item.mrr)} MRR
                    </div>
                  </div>
                ))}
                {distribuicaoPorProduto.length > 5 && (
                  <p className="text-[10px] text-muted-foreground pt-1">
                    +{distribuicaoPorProduto.length - 5} outros
                  </p>
                )}
              </div>
            </div>
          )}
        </TechChartCard>
      </div>
      </SectionBlock>

      <SectionBlock
        title="Segmentacao"
        subtitle="Onde o churn se concentra"
        icon={Users}
        accent="bg-gradient-to-r from-cyan-500 to-blue-500"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TechChartCard
          title="MRR Perdido por Squad"
          subtitle="Valor mensal perdido (R$)"
          icon={DollarSign}
          iconBg="bg-gradient-to-r from-emerald-500 to-teal-500"
          meta={
            <StatPill
              label="Top 8 MRR"
              value={formatCurrencyNoDecimals(mrrSquadTotal)}
              tone="success"
            />
          }
        >
          {isLoading ? (
            <Skeleton className="h-[180px] w-full" />
          ) : distribuicaoPorSquad.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
              Nenhum dado disponível
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={distribuicaoPorSquad.sort((a, b) => b.mrr - a.mrr)} layout="vertical" margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <XAxis 
                  type="number" 
                  tick={{ fontSize: 10 }} 
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v/1000).toFixed(0)}k`}
                  className="fill-muted-foreground"
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  tick={{ fontSize: 10 }} 
                  width={80}
                  axisLine={false}
                  tickLine={false}
                  className="fill-muted-foreground"
                />
                <Tooltip content={<CustomTooltip valueFormatter={(v: number) => formatCurrency(v)} />} />
                <Bar dataKey="mrr" radius={[0, 4, 4, 0]} name="MRR Perdido">
                  {distribuicaoPorSquad.map((entry, index) => (
                    <Cell key={entry.name} fill={REFINED_COLORS[index % REFINED_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </TechChartCard>

        <TechChartCard
          title="Distribuição por Lifetime"
          subtitle="Tempo de permanência"
          icon={Clock}
          iconBg="bg-gradient-to-r from-violet-500 to-purple-500"
          meta={
            <StatPill
              label="Faixa lider"
              value={topLifetime ? `${topLifetime.name} (${topLifetime.count})` : "-"}
              tone="info"
            />
          }
        >
          {isLoading ? (
            <Skeleton className="h-[180px] w-full" />
          ) : distribuicaoPorLifetime.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
              Nenhum dado disponível
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <ResponsiveContainer width="55%" height={180}>
                <RechartsPie>
                  <Pie
                    data={distribuicaoPorLifetime.filter(d => d.count > 0)}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    strokeWidth={2}
                    stroke="hsl(var(--card))"
                  >
                    {distribuicaoPorLifetime.map((entry, index) => (
                      <Cell key={entry.name} fill={REFINED_COLORS[index % REFINED_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip valueFormatter={(v: number) => `${v} contratos`} />} />
                </RechartsPie>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2 text-xs">
                {distribuicaoPorLifetime.filter(d => d.count > 0).map((item, i) => (
                  <div key={item.name} className="rounded-md border border-border/40 bg-white/70 dark:bg-zinc-900/50 px-2 py-1 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" 
                          style={{ backgroundColor: REFINED_COLORS[i % REFINED_COLORS.length] }}
                        />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="font-semibold text-foreground tabular-nums">{item.count}</span>
                    </div>
                    <div className="pl-4 text-[10px] text-red-500 dark:text-red-400">
                      {formatCurrencyNoDecimals(item.mrr)} MRR
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TechChartCard>

        <TechChartCard
          title="MRR Perdido por Responsável"
          subtitle="Top 6 responsáveis (R$)"
          icon={DollarSign}
          iconBg="bg-gradient-to-r from-cyan-500 to-blue-500"
          meta={
            <StatPill
              label="Top 6 MRR"
              value={formatCurrencyNoDecimals(mrrResponsavelTotal)}
              tone="info"
            />
          }
        >
          {isLoading ? (
            <Skeleton className="h-[180px] w-full" />
          ) : distribuicaoPorResponsavel.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
              Nenhum dado disponível
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={distribuicaoPorResponsavel.sort((a, b) => b.mrr - a.mrr)} layout="vertical" margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="blueBarGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={1}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  type="number" 
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v/1000).toFixed(0)}k`}
                  className="fill-muted-foreground"
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  tick={{ fontSize: 10 }} 
                  width={70}
                  axisLine={false}
                  tickLine={false}
                  className="fill-muted-foreground"
                />
                <Tooltip content={<CustomTooltip valueFormatter={(v: number) => formatCurrency(v)} />} />
                <Bar dataKey="mrr" fill="url(#blueBarGradient)" radius={[0, 4, 4, 0]} name="MRR Perdido" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </TechChartCard>
      </div>
      </SectionBlock>

      {/* Nova seção: Análises Avançadas */}
      <SectionBlock
        title="Evolucao Financeira"
        subtitle="Impacto do MRR perdido e pausado"
        icon={DollarSign}
        accent="bg-gradient-to-r from-red-500 to-rose-500"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* MRR Perdido por Mês */}
        <TechChartCard
          title="Evolução do MRR Perdido"
          subtitle="Valor perdido mensalmente"
          icon={DollarSign}
          iconBg="bg-gradient-to-r from-red-500 to-rose-500"
          meta={
            <StatPill
              label="Total 12m"
              value={formatCurrencyNoDecimals(mrrPerdidoTotal)}
              tone="danger"
            />
          }
        >
          {isLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : mrrPerdidoPorMes.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Nenhum dado disponível
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={mrrPerdidoPorMes} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9}/>
                    <stop offset="100%" stopColor="#dc2626" stopOpacity={0.7}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="mes" 
                  tick={{ fontSize: 10 }} 
                  axisLine={false}
                  tickLine={false}
                  className="fill-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 10 }} 
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v/1000).toFixed(0)}k`}
                  className="fill-muted-foreground"
                />
                <Tooltip content={<CustomTooltip valueFormatter={(v: number) => formatCurrency(v)} />} />
                <Bar dataKey="mrr" fill="url(#mrrGradient)" radius={[4, 4, 0, 0]} name="MRR Perdido" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </TechChartCard>

        {/* Comparativo MRR Churn vs Pausado */}
        <TechChartCard
          title="MRR Churn vs Pausados"
          subtitle="Comparativo mensal de valor (R$)"
          icon={DollarSign}
          iconBg="bg-gradient-to-r from-amber-500 to-yellow-500"
          meta={
            <div className="flex flex-wrap items-center gap-2">
              <StatPill label="Churn" value={formatCurrencyNoDecimals(comparativoChurnTotal)} tone="danger" />
              <StatPill label="Pausado" value={formatCurrencyNoDecimals(comparativoPausadoTotal)} tone="warning" />
            </div>
          }
        >
          {isLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : comparativoMensal.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Nenhum dado disponível
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={comparativoMensal} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <XAxis 
                  dataKey="mes" 
                  tick={{ fontSize: 10 }} 
                  axisLine={false}
                  tickLine={false}
                  className="fill-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 10 }} 
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v/1000).toFixed(0)}k`}
                  className="fill-muted-foreground"
                />
                <Tooltip content={<CustomTooltip valueFormatter={(v: number) => formatCurrency(v)} />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="mrrChurn" fill="#ef4444" radius={[4, 4, 0, 0]} name="MRR Churn" />
                <Bar dataKey="mrrPausado" fill="#f59e0b" radius={[4, 4, 0, 0]} name="MRR Pausado" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </TechChartCard>
      </div>
      </SectionBlock>

      {/* Distribuição por Ticket e Cohort */}
      <SectionBlock
        title="Ticket e Cohort"
        subtitle="Perfil de ticket e tempo ate churn"
        icon={Clock}
        accent="bg-gradient-to-r from-teal-500 to-emerald-500"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Distribuição por Faixa de Ticket */}
        <TechChartCard
          title="Churn por Faixa de Ticket"
          subtitle="Distribuição por valor do contrato"
          icon={DollarSign}
          iconBg="bg-gradient-to-r from-indigo-500 to-purple-500"
          meta={
            <StatPill
              label="Faixa lider"
              value={topTicket ? `${topTicket.name} (${topTicket.count})` : "-"}
              tone="info"
            />
          }
        >
          {isLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : distribuicaoPorTicket.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Nenhum dado disponível
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={200}>
                <RechartsPie>
                  <Pie
                    data={distribuicaoPorTicket}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    strokeWidth={2}
                    stroke="hsl(var(--card))"
                  >
                    {distribuicaoPorTicket.map((entry, index) => (
                      <Cell key={entry.name} fill={REFINED_COLORS[index % REFINED_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip valueFormatter={(v: number) => `${v} contratos`} />} />
                </RechartsPie>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2 text-xs">
                {distribuicaoPorTicket.map((item, i) => (
                  <div key={item.name} className="rounded-md border border-border/40 bg-white/70 dark:bg-zinc-900/50 px-2 py-1 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div 
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" 
                          style={{ backgroundColor: REFINED_COLORS[i % REFINED_COLORS.length] }}
                        />
                        <span className="truncate text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="font-semibold text-foreground tabular-nums">{item.count}</span>
                    </div>
                    <div className="pl-4 text-[10px] text-red-500 dark:text-red-400">
                      {formatCurrencyNoDecimals(item.mrr)} MRR
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TechChartCard>

        {/* Análise de Cohort */}
        <TechChartCard
          title="Tempo até Churn por Cohort"
          subtitle="Lifetime médio por mês de início"
          icon={Clock}
          iconBg="bg-gradient-to-r from-teal-500 to-emerald-500"
          meta={
            <StatPill
              label="Media geral"
              value={`${cohortMediaGeral.toFixed(1)}m`}
              tone="success"
            />
          }
        >
          {isLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : cohortAnalysis.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Nenhum dado disponível
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={cohortAnalysis} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="cohortGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.9}/>
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.7}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="cohort" 
                  tick={{ fontSize: 10 }} 
                  axisLine={false}
                  tickLine={false}
                  className="fill-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 10 }} 
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v.toFixed(0)}m`}
                  className="fill-muted-foreground"
                />
                <Tooltip content={<CustomTooltip valueFormatter={(v: number) => `${v.toFixed(1)} meses`} />} />
                <Bar dataKey="avgLifetime" fill="url(#cohortGradient)" radius={[4, 4, 0, 0]} name="Lifetime Médio" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </TechChartCard>
      </div>
      </SectionBlock>

      {/* Análise de Churn por Tipo de Erro */}
      <Card className="border-orange-200 dark:border-orange-900/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 shadow-lg">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base">Churn por Tipo de Erro</CardTitle>
                <CardDescription>Erro Operacional, Indireto e Falta de Resultado</CardDescription>
              </div>
            </div>
            {churnPorTipoErro.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {churnPorTipoErro.map((tipo) => (
                  <Button
                    key={tipo.tipo}
                    variant={tipoErroSelecionado === tipo.tipo || (!tipoErroSelecionado && tipo.tipo === churnPorTipoErro[0]?.tipo) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTipoErroSelecionado(tipo.tipo)}
                    data-testid={`btn-tipo-erro-${tipo.tipo.toLowerCase().replace(/\s+/g, '-')}`}
                    className="text-xs"
                  >
                    {tipo.tipo}
                    <Badge variant="secondary" className="ml-1.5 text-[10px]">{tipo.count}</Badge>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[320px] w-full" />
          ) : churnPorTipoErro.length === 0 ? (
            <div className="h-[320px] flex items-center justify-center text-muted-foreground text-sm">
              Nenhum dado de erro operacional encontrado no período
            </div>
          ) : (
            <div className="space-y-4">
              {/* Resumo do tipo selecionado */}
              {(() => {
                const tipoAtual = churnPorTipoErro.find(t => t.tipo === tipoErroSelecionado) || churnPorTipoErro[0];
                if (!tipoAtual) return null;
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{tipoAtual.count}</p>
                      <p className="text-xs text-muted-foreground">Contratos</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrencyNoDecimals(tipoAtual.mrr)}</p>
                      <p className="text-xs text-muted-foreground">MRR Perdido</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">{Object.keys(tipoAtual.porSquad).length}</p>
                      <p className="text-xs text-muted-foreground">Squads Afetados</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">{Object.keys(tipoAtual.porResponsavel).length}</p>
                      <p className="text-xs text-muted-foreground">Responsáveis</p>
                    </div>
                  </div>
                );
              })()}

              {/* Tabs de visualização */}
              <div className="flex items-center gap-2 border-b border-gray-200 dark:border-zinc-700 pb-2">
                {[
                  { key: 'squad', label: 'Por Squad' },
                  { key: 'responsavel', label: 'Por Responsável' },
                  { key: 'vendedor', label: 'Por Vendedor' },
                  { key: 'cs_responsavel', label: 'Por CS' }
                ].map(tab => (
                  <Button
                    key={tab.key}
                    variant={tipoErroTab === tab.key ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setTipoErroTab(tab.key as any)}
                    data-testid={`tab-tipo-erro-${tab.key}`}
                    className="text-xs"
                  >
                    {tab.label}
                  </Button>
                ))}
              </div>

              {/* Lista de ranking */}
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {dadosTipoErroAtual.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    Nenhum dado disponível para esta visualização
                  </div>
                ) : (
                  dadosTipoErroAtual.map((item, index) => {
                    const maxMrr = Math.max(...dadosTipoErroAtual.map(d => d.mrr));
                    const percentage = maxMrr > 0 ? (item.mrr / maxMrr) * 100 : 0;
                    const isTop3 = index < 3;
                    const medalColors = ['bg-amber-500', 'bg-gray-400', 'bg-amber-700'];
                    
                    return (
                      <div 
                        key={item.fullName}
                        data-testid={`tipo-erro-item-${index}`}
                        className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                          isTop3 
                            ? 'bg-orange-50/80 dark:bg-orange-950/40 border border-orange-100 dark:border-orange-900/50' 
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
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-sm font-medium truncate" title={item.fullName}>{item.fullName}</span>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="text-muted-foreground">{item.count} contratos</span>
                              <span className="font-bold text-red-600 dark:text-red-400 tabular-nums">{formatCurrencyNoDecimals(item.mrr)}</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Clientes Perdidos */}
      {!isLoading && topClientesPerdidos.length > 0 && (
        <Card className="border-red-200 dark:border-red-900/40">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-r from-red-500 to-rose-600 shadow-lg">
                <TrendingDown className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base">Top 10 Clientes Perdidos</CardTitle>
                <CardDescription>Maior impacto financeiro no período</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Cliente</TableHead>
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
                        <div>
                          <span className="font-medium">{c.cliente_nome}</span>
                          {c.cnpj && <p className="text-xs text-muted-foreground">{c.cnpj}</p>}
                        </div>
                      </TableCell>
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
                    {(searchTerm || filterSquads.length > 0 || filterProdutos.length > 0 || filterResponsaveis.length > 0 || filterServicos.length > 0) && (
                      <Badge variant="secondary" className="text-[10px] h-5">
                        {[searchTerm ? 1 : 0, filterSquads.length, filterProdutos.length, filterResponsaveis.length, filterServicos.length].reduce((a, b) => a + (b > 0 ? 1 : 0), 0)} ativo(s)
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "contratos" | "clientes")}>
              <TabsList>
                <TabsTrigger value="contratos" className="gap-2" data-testid="tab-contratos">
                  <FileText className="h-4 w-4" />
                  Contratos (Churn + Pausados)
                </TabsTrigger>
                <TabsTrigger value="clientes" className="gap-2" data-testid="tab-clientes">
                  <Building2 className="h-4 w-4" />
                  Clientes Encerrados
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {viewMode === "contratos" ? filteredContratos.length : clientesAgrupados.length}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {viewMode === "contratos" ? "contratos" : "clientes"}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : viewMode === "contratos" ? (
            filteredContratos.length === 0 ? (
              <div className="text-center py-12">
                <TrendingDown className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum contrato churned encontrado</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/80"
                        onClick={() => handleSort("cliente_nome")}
                      >
                        <div className="flex items-center gap-1">
                          Cliente
                          <SortIcon column="cliente_nome" />
                        </div>
                      </TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Squad</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/80 text-right"
                        onClick={() => handleSort("valorr")}
                      >
                        <div className="flex items-center justify-end gap-1">
                          MRR
                          <SortIcon column="valorr" />
                        </div>
                      </TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/80"
                        onClick={() => handleSort("data_encerramento")}
                      >
                        <div className="flex items-center gap-1">
                          Data Evento
                          <SortIcon column="data_encerramento" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/80 text-right"
                        onClick={() => handleSort("lifetime_meses")}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Lifetime
                          <SortIcon column="lifetime_meses" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/80 text-right"
                        onClick={() => handleSort("ltv")}
                      >
                        <div className="flex items-center justify-end gap-1">
                          LTV
                          <SortIcon column="ltv" />
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContratos.slice(0, 100).map((contrato, index) => (
                      <TableRow 
                        key={`${contrato.id}-${index}`} 
                        data-testid={`row-churn-${contrato.id}`}
                        className="hover:bg-muted/30"
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{contrato.cliente_nome || "-"}</span>
                            <span className="text-xs text-muted-foreground">{contrato.cnpj || "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={contrato.tipo === 'pausado' ? 'secondary' : 'destructive'}
                            className={contrato.tipo === 'pausado' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' : ''}
                          >
                            {contrato.tipo === 'pausado' ? 'Pausado' : 'Churn'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{contrato.produto || "-"}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{contrato.squad || "-"}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{contrato.responsavel || "-"}</TableCell>
                        <TableCell className={`text-right font-semibold ${contrato.tipo === 'pausado' ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                          {formatCurrency(contrato.valorr || 0)}
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(contrato.data_inicio)}</TableCell>
                        <TableCell className="text-sm">{formatDate(contrato.data_encerramento || contrato.data_pausa)}</TableCell>
                        <TableCell className="text-right">
                          <Badge 
                            variant={contrato.lifetime_meses < 6 ? "destructive" : contrato.lifetime_meses < 12 ? "secondary" : "default"}
                          >
                            {contrato.lifetime_meses.toFixed(1)}m
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(contrato.ltv || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filteredContratos.length > 100 && (
                  <div className="p-4 text-center text-muted-foreground text-sm border-t">
                    Mostrando 100 de {filteredContratos.length} contratos. Use os filtros para refinar a busca.
                  </div>
                )}
              </div>
            )
          ) : (
            clientesAgrupados.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum cliente churned encontrado</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/80"
                        onClick={() => handleSort("cliente_nome")}
                      >
                        <div className="flex items-center gap-1">
                          Cliente
                          <SortIcon column="cliente_nome" />
                        </div>
                      </TableHead>
                      <TableHead className="text-center">Contratos</TableHead>
                      <TableHead>Produtos</TableHead>
                      <TableHead>Squads</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/80 text-right"
                        onClick={() => handleSort("valorr")}
                      >
                        <div className="flex items-center justify-end gap-1">
                          MRR Total
                          <SortIcon column="valorr" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/80"
                        onClick={() => handleSort("data_encerramento")}
                      >
                        <div className="flex items-center gap-1">
                          Último Encerramento
                          <SortIcon column="data_encerramento" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/80 text-right"
                        onClick={() => handleSort("lifetime_meses")}
                      >
                        <div className="flex items-center justify-end gap-1">
                          LT Médio
                          <SortIcon column="lifetime_meses" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/80 text-right"
                        onClick={() => handleSort("ltv")}
                      >
                        <div className="flex items-center justify-end gap-1">
                          LTV Total
                          <SortIcon column="ltv" />
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientesAgrupados.slice(0, 100).map((cliente, index) => (
                      <TableRow 
                        key={`${cliente.cnpj}-${index}`} 
                        data-testid={`row-cliente-${cliente.cnpj}`}
                        className="hover:bg-muted/30"
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{cliente.cliente_nome || "-"}</span>
                            <span className="text-xs text-muted-foreground">{cliente.cnpj || "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="font-semibold">
                            {cliente.contratos_count}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[150px]">
                            {cliente.produtos.slice(0, 2).map((p, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{p}</Badge>
                            ))}
                            {cliente.produtos.length > 2 && (
                              <Badge variant="secondary" className="text-xs">+{cliente.produtos.length - 2}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[150px]">
                            {cliente.squads.slice(0, 2).map((s, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                            ))}
                            {cliente.squads.length > 2 && (
                              <Badge variant="secondary" className="text-xs">+{cliente.squads.length - 2}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-red-600 dark:text-red-400">
                          {formatCurrency(cliente.mrr_total || 0)}
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(cliente.ultima_data_encerramento)}</TableCell>
                        <TableCell className="text-right">
                          <Badge 
                            variant={cliente.lifetime_medio < 6 ? "destructive" : cliente.lifetime_medio < 12 ? "secondary" : "default"}
                          >
                            {cliente.lifetime_medio.toFixed(1)}m
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(cliente.ltv_total || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {clientesAgrupados.length > 100 && (
                  <div className="p-4 text-center text-muted-foreground text-sm border-t">
                    Mostrando 100 de {clientesAgrupados.length} clientes. Use os filtros para refinar a busca.
                  </div>
                )}
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}





