import React, { useState, useMemo } from "react";
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
import RelatorioSemanalChurn from "./RelatorioSemanalChurn";
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
  tipo: 'churn' | 'pausado' | 'em_cancelamento';
  lifetime_meses: number;
  ltv: number;
  // Novos campos de cup_churn
  plano?: string | null;
  cluster?: string | null;
  submotivo?: string | null;
  mensagem_cliente?: string | null;
  contexto_operacao?: string | null;
  contexto_cx?: string | null;
  possibilidade_retencao?: string | null;
  evitabilidade_churn?: string | null;
  status_cancelamento?: string | null;
  status_conta?: string | null;
  ultimo_dia_operacao?: string | null;
  is_abonado?: boolean;
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

interface ChurnBreakdownItem {
  label: string;
  mrr: number;
  count: number;
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
    churn_por_evitabilidade?: ChurnBreakdownItem[];
    churn_por_cluster?: ChurnBreakdownItem[];
    churn_por_plano?: ChurnBreakdownItem[];
    periodo_referencia?: string;
    total_abonado?: number;
    mrr_abonado?: number;
  };
  filtros: {
    squads: string[];
    produtos: string[];
    responsaveis: string[];
    servicos: string[];
    planos?: string[];
    clusters?: string[];
    evitabilidades?: string[];
    possibilidades_retencao?: string[];
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

  // BP 2026 - Metas mensais de churn MRR (planejado)
  const BP_CHURN_MRR_TARGETS: Record<string, number> = {
    "2026-01": 104117, "2026-02": 114096, "2026-03": 123177,
    "2026-04": 133691, "2026-05": 143259, "2026-06": 151966,
    "2026-07": 162589, "2026-08": 172256, "2026-09": 181053,
    "2026-10": 191758, "2026-11": 201500, "2026-12": 210365,
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
  const [viewMode, setViewMode] = useState<"contratos" | "clientes">("contratos");
  const [mainTab, setMainTab] = useState<"analise" | "contratos" | "relatorio">("analise");
  const [crossAnalysisView, setCrossAnalysisView] = useState<"motivo" | "cluster" | "plano">("motivo");
  const [expandedMotivo, setExpandedMotivo] = useState<string | null>(null);
  const [analysisSubTab, setAnalysisSubTab] = useState<"resumo" | "distribuicao" | "inteligencia">("resumo");

  // Voz do Cliente states
  const [muralSortBy, setMuralSortBy] = useState<"mrr" | "date">("mrr");
  const [muralFilterSentiment, setMuralFilterSentiment] = useState<string | null>(null);
  const [muralFilterTheme, setMuralFilterTheme] = useState<string | null>(null);
  const [muralExpandedId, setMuralExpandedId] = useState<string | null>(null);
  const [selectedThemeKeyword, setSelectedThemeKeyword] = useState<string | null>(null);
  const [expandedOpTheme, setExpandedOpTheme] = useState<string | null>(null);
  const [expandedCxTheme, setExpandedCxTheme] = useState<string | null>(null);

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
  }, [data?.contratos, searchTerm, filterSquads, filterProdutos, filterResponsaveis, filterServicos, filterPlanos, filterClusters, filterEvitabilidades, filterPossibilidadesRetencao, dataInicio, dataFim, sortBy, sortOrder]);

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

  const filteredTaxaChurn = useMemo(() => {
    const mrrBase = MRR_BASE_OVERRIDE;
    const mrrPerdido = filteredMetricas.mrr_perdido;
    return mrrBase > 0 ? (mrrPerdido / mrrBase) * 100 : 0;
  }, [filteredMetricas.mrr_perdido]);

  // Meta planejada pro-rateada até hoje (BP 2026)
  const churnPlanejado = useMemo(() => {
    const today = new Date();
    const periodStart = dataInicio ? parseISO(dataInicio) : null;
    const periodEnd = dataFim ? parseISO(dataFim) : null;
    if (!periodStart || !periodEnd) return { mrrPlanejado: 0, taxaPlanejada: 0 };

    // Pegar o mês de referência do filtro
    const monthKey = format(periodStart, "yyyy-MM");
    const targetMensal = BP_CHURN_MRR_TARGETS[monthKey] || 0;
    if (targetMensal === 0) return { mrrPlanejado: 0, taxaPlanejada: 0 };

    // Total de dias no mês
    const totalDaysInMonth = getDaysInMonth(periodStart);

    // Dias decorridos até hoje (ou até o fim do período se já passou)
    const effectiveEnd = today < periodStart ? periodStart : today > periodEnd ? periodEnd : today;
    const elapsedDays = differenceInCalendarDays(effectiveEnd, periodStart) + 1;
    const safeDays = Math.max(0, Math.min(elapsedDays, totalDaysInMonth));

    // Meta pro-rateada até hoje
    const mrrPlanejado = (targetMensal / totalDaysInMonth) * safeDays;
    const taxaPlanejada = MRR_BASE_OVERRIDE > 0 ? (mrrPlanejado / MRR_BASE_OVERRIDE) * 100 : 0;

    return { mrrPlanejado, taxaPlanejada, targetMensal };
  }, [dataInicio, dataFim]);

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

  // Top clientes perdidos (maior impacto financeiro)
  const topClientesPerdidos = useMemo(() => {
    if (filteredContratos.length === 0) return [];

    const churnContratos = filteredContratos.filter(c => c.tipo === 'churn' && !c.is_abonado);
    return churnContratos
      .sort((a, b) => b.valorr - a.valorr)
      .slice(0, 10);
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

      {/* Tabs de nível superior */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "analise" | "contratos" | "relatorio")}>
        <TabsList>
          <TabsTrigger value="analise" className="gap-2" data-testid="main-tab-analise">
            <BarChart3 className="h-4 w-4" />
            Análise Detalhada
          </TabsTrigger>
          <TabsTrigger value="contratos" className="gap-2" data-testid="main-tab-contratos">
            <FileText className="h-4 w-4" />
            Contratos
          </TabsTrigger>
          <TabsTrigger value="relatorio" className="gap-2" data-testid="main-tab-relatorio">
            <CalendarRange className="h-4 w-4" />
            Relatório Semanal
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {mainTab === "relatorio" ? (
        <RelatorioSemanalChurn />
      ) : mainTab === "analise" ? (
      <>

      {/* Sub-abas da Análise */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted/50 border border-border/40 w-fit">
        {([
          { key: "resumo", label: "Resumo" },
          { key: "distribuicao", label: "Distribuição" },
          { key: "inteligencia", label: "Inteligência" },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setAnalysisSubTab(tab.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              analysisSubTab === tab.key
                ? "bg-white dark:bg-zinc-800 shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-zinc-800/50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {analysisSubTab === "resumo" && (
      <>
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
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Taxa de Churn</h3>
                <ChurnGauge value={filteredTaxaChurn || 0} statusOverride={gaugeStatusOverride} />
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  Base: {format(BASE_REFERENCE_DATE, "MMMM/yyyy", { locale: ptBR })}
                </p>
                {churnPlanejado.taxaPlanejada > 0 && (
                  <p className="text-[11px] text-muted-foreground text-center mt-1">
                    Planejado até hoje: <span className="font-semibold">{churnPlanejado.taxaPlanejada.toFixed(2)}%</span>
                  </p>
                )}
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
                  {churnPlanejado.mrrPlanejado > 0 && (
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
                
                <div className="flex-1 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/50 flex flex-col justify-center">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">MRR Base Referência</span>
                    <Target className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{formatCurrency(MRR_BASE_OVERRIDE)}</div>
                  <div className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">base para cálculo do churn</div>
                </div>
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
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{c.cliente_nome}</span>
                          {c.is_abonado && (
                            <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                              Abonado
                            </Badge>
                          )}
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
      </>
      )}

      {analysisSubTab === "distribuicao" && (
      <>
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
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="count" stackId="a" fill="url(#barGradient)" radius={[0, 0, 0, 0]} name="Churn Efetivo" />
                <Bar dataKey="countAbonado" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Abonado" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </TechChartCard>

        <TechChartCard
          title="Distribuição por Serviço"
          subtitle="Percentual de churn por serviço"
          icon={BarChart3}
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
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {distribuicaoPorProduto.map((item, i) => {
                const color = REFINED_COLORS[i % REFINED_COLORS.length];
                const barWidth = Math.max(item.percentual, 3);

                return (
                  <div key={item.name} className="rounded-md border border-border/40 bg-white/70 dark:bg-zinc-900/50 px-2 py-1.5 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: color }}
                        />
                        <span className="truncate text-xs text-muted-foreground">{item.fullName}</span>
                      </div>
                      <span className="text-xs font-semibold text-foreground tabular-nums whitespace-nowrap">
                        {item.count} contratos
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${barWidth}%`, backgroundColor: color }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                        {item.percentual.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-[10px] text-red-500 dark:text-red-400">
                      {formatCurrencyNoDecimals(item.mrr)} MRR
                    </div>
                  </div>
                );
              })}
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
          subtitle="Churn efetivo + abonado por mês"
          icon={DollarSign}
          iconBg="bg-gradient-to-r from-red-500 to-rose-500"
          meta={
            <div className="flex flex-wrap items-center gap-2">
              <StatPill label="Efetivo 12m" value={formatCurrencyNoDecimals(mrrPerdidoTotal)} tone="danger" />
              {mrrAbonadoTotal > 0 && <StatPill label="Abonado 12m" value={formatCurrencyNoDecimals(mrrAbonadoTotal)} tone="warning" />}
            </div>
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
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="mrr" stackId="a" fill="url(#mrrGradient)" radius={[0, 0, 0, 0]} name="Churn Efetivo" />
                <Bar dataKey="mrrAbonado" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Churn Abonado" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </TechChartCard>

        {/* Comparativo MRR Churn vs Pausado */}
        <TechChartCard
          title="MRR Churn vs Abonado"
          subtitle="Comparativo mensal de valor (R$)"
          icon={DollarSign}
          iconBg="bg-gradient-to-r from-amber-500 to-yellow-500"
          meta={
            <div className="flex flex-wrap items-center gap-2">
              <StatPill label="Churn" value={formatCurrencyNoDecimals(comparativoChurnTotal)} tone="danger" />
              <StatPill label="Abonado" value={formatCurrencyNoDecimals(comparativoAbonadoTotal)} tone="warning" />
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
                <Bar dataKey="mrrAbonado" fill="#f59e0b" radius={[4, 4, 0, 0]} name="MRR Abonado" />
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
      </>
      )}

      {analysisSubTab === "inteligencia" && (
      <>
      {/* Inteligência de Churn: Evitabilidade, Cluster, Plano */}
      {!isLoading && data?.metricas && (
        <SectionBlock
          title="Inteligência de Churn"
          subtitle="Evitabilidade, cluster e plano"
          icon={PieChart}
          accent="bg-gradient-to-r from-purple-500 to-indigo-500"
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Evitabilidade - Donut */}
            <TechChartCard
              title="Evitabilidade"
              subtitle="Churn evitável vs inevitável"
              icon={AlertTriangle}
              iconBg="bg-gradient-to-r from-purple-500 to-indigo-500"
            >
              {(data.metricas.churn_por_evitabilidade?.length ?? 0) === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                  Sem dados
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <ResponsiveContainer width="55%" height={200}>
                    <RechartsPie>
                      <Pie
                        data={data.metricas.churn_por_evitabilidade}
                        dataKey="count"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={65}
                        strokeWidth={2}
                        stroke="hsl(var(--card))"
                      >
                        {data.metricas.churn_por_evitabilidade!.map((_, index) => (
                          <Cell key={index} fill={index === 0 ? "#ef4444" : "#10b981"} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip valueFormatter={(v: number) => `${v} contratos`} />} />
                    </RechartsPie>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2 text-xs">
                    {data.metricas.churn_por_evitabilidade!.map((item, i) => (
                      <div key={item.label} className="rounded-md border border-border/40 bg-white/70 dark:bg-zinc-900/50 px-2 py-1.5 space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: i === 0 ? "#ef4444" : "#10b981" }} />
                            <span className="text-muted-foreground">{item.label}</span>
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

            {/* Cluster - Bar */}
            <TechChartCard
              title="Churn por Cluster"
              subtitle="Distribuição por cluster de cliente"
              icon={Users}
              iconBg="bg-gradient-to-r from-cyan-500 to-blue-500"
            >
              {(data.metricas.churn_por_cluster?.length ?? 0) === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                  Sem dados
                </div>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {data.metricas.churn_por_cluster!.map((item, i) => {
                    const maxCount = Math.max(...data.metricas.churn_por_cluster!.map(d => d.count), 1);
                    const barWidth = Math.max((item.count / maxCount) * 100, 3);
                    return (
                      <div key={item.label} className="rounded-md border border-border/40 bg-white/70 dark:bg-zinc-900/50 px-2 py-1.5 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: REFINED_COLORS[i % REFINED_COLORS.length] }} />
                            <span className="truncate text-xs text-muted-foreground">{item.label}</span>
                          </div>
                          <span className="text-xs font-semibold text-foreground tabular-nums whitespace-nowrap">{item.count}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${barWidth}%`, backgroundColor: REFINED_COLORS[i % REFINED_COLORS.length] }} />
                          </div>
                        </div>
                        <div className="text-[10px] text-red-500 dark:text-red-400">
                          {formatCurrencyNoDecimals(item.mrr)} MRR
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TechChartCard>

            {/* Plano - Bar */}
            <TechChartCard
              title="Churn por Plano"
              subtitle="Distribuição por plano contratado"
              icon={BarChart3}
              iconBg="bg-gradient-to-r from-amber-500 to-orange-500"
            >
              {(data.metricas.churn_por_plano?.length ?? 0) === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                  Sem dados
                </div>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {data.metricas.churn_por_plano!.map((item, i) => {
                    const maxCount = Math.max(...data.metricas.churn_por_plano!.map(d => d.count), 1);
                    const barWidth = Math.max((item.count / maxCount) * 100, 3);
                    return (
                      <div key={item.label} className="rounded-md border border-border/40 bg-white/70 dark:bg-zinc-900/50 px-2 py-1.5 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: REFINED_COLORS[i % REFINED_COLORS.length] }} />
                            <span className="truncate text-xs text-muted-foreground">{item.label}</span>
                          </div>
                          <span className="text-xs font-semibold text-foreground tabular-nums whitespace-nowrap">{item.count}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${barWidth}%`, backgroundColor: REFINED_COLORS[i % REFINED_COLORS.length] }} />
                          </div>
                        </div>
                        <div className="text-[10px] text-red-500 dark:text-red-400">
                          {formatCurrencyNoDecimals(item.mrr)} MRR
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TechChartCard>
          </div>
        </SectionBlock>
      )}

      {/* Churn por Tipo de Erro - movido para sub-aba Inteligência */}
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

      {/* NOVO: Análise Profunda (Features 2-5) */}
      {!isLoading && filteredContratos.length > 0 && (
        <SectionBlock
          title="Análise Profunda"
          subtitle="Padrões de texto, motivos e cruzamentos"
          icon={Brain}
          accent="bg-gradient-to-r from-indigo-500 to-purple-600"
        >
          {/* Feature 2 + Feature 3: Text Patterns + Motivo→Submotivo */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Feature 2: Análise de Padrões de Texto (2/3) */}
            <TechChartCard
              title="Padrões nas Mensagens"
              subtitle="Keywords identificadas na mensagem do cliente"
              icon={MessageSquare}
              iconBg="bg-gradient-to-r from-indigo-500 to-purple-500"
              meta={<StatPill label="Com mensagem" value={`${filteredContratos.filter(c => c.mensagem_cliente).length}`} tone="info" />}
            >
              <div className="lg:col-span-2">
                {textPatternAnalysis.length === 0 ? (
                  <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                    Sem mensagens para analisar
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(220, textPatternAnalysis.length * 40)}>
                    <BarChart data={textPatternAnalysis} layout="vertical" margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                      <defs>
                        <linearGradient id="deepBarGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#6366f1" />
                          <stop offset="100%" stopColor="#8b5cf6" />
                        </linearGradient>
                      </defs>
                      <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis type="category" dataKey="keyword" width={80} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        content={({ active, payload, label }: any) => {
                          if (!active || !payload?.length) return null;
                          const d = textPatternAnalysis.find((t: any) => t.keyword === label);
                          return (
                            <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-gray-200 dark:border-zinc-700/50 rounded-lg shadow-xl p-3 min-w-[200px]">
                              <p className="text-xs font-semibold text-foreground mb-2">{label}</p>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between"><span className="text-muted-foreground">Contratos</span><span className="font-bold text-foreground">{d?.count}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">MRR Impactado</span><span className="font-bold text-red-500">{formatCurrencyNoDecimals(d?.mrr || 0)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">% Evitável</span><span className="font-bold text-foreground">{(d?.evitavelPct || 0).toFixed(0)}%</span></div>
                              </div>
                              {d?.contratos && d.contratos.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-border/50">
                                  <p className="text-[10px] text-muted-foreground mb-1">Clientes:</p>
                                  {d.contratos.map((n: string, i: number) => (
                                    <p key={i} className="text-[10px] text-foreground truncate">{n}</p>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        }}
                      />
                      <Bar
                        dataKey="count"
                        fill="url(#deepBarGradient)"
                        radius={[0, 4, 4, 0]}
                        name="Contratos"
                        cursor="pointer"
                        onClick={(data: any) => {
                          if (data?.keyword) {
                            setSelectedThemeKeyword(selectedThemeKeyword === data.keyword ? null : data.keyword);
                          }
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
                {/* Drill-down: mensagens matchadas */}
                {selectedThemeKeyword && (() => {
                  const themeData = textPatternAnalysis.find(t => t.keyword === selectedThemeKeyword);
                  const terms = EXPANDED_KEYWORDS[selectedThemeKeyword] || [];
                  if (!themeData || themeData.matchedContratos.length === 0) return null;
                  return (
                    <div className="mt-3 border-t border-border/50 pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-foreground">
                          Mensagens com "{selectedThemeKeyword}" ({themeData.matchedContratos.length})
                        </p>
                        <button
                          onClick={() => setSelectedThemeKeyword(null)}
                          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Fechar
                        </button>
                      </div>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {themeData.matchedContratos.slice(0, 15).map((c, i) => (
                          <div key={`drill-${c.id}-${i}`} className="rounded-md border border-border/40 bg-white/70 dark:bg-zinc-900/50 p-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-foreground">{c.cliente_nome}</span>
                              <span className="text-[10px] text-red-500 font-semibold">{formatCurrencyNoDecimals(c.valorr)}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                              {highlightKeywords(c.mensagem_cliente || '', terms)}
                            </p>
                          </div>
                        ))}
                        {themeData.matchedContratos.length > 15 && (
                          <p className="text-[10px] text-muted-foreground text-center pt-1">
                            Mostrando 15 de {themeData.matchedContratos.length}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </TechChartCard>

            {/* Feature 3: Drill-down Motivo → Submotivo (1/3) */}
            <TechChartCard
              title="Motivo → Submotivo"
              subtitle="Hierarquia de motivos de cancelamento"
              icon={GitBranch}
              iconBg="bg-gradient-to-r from-orange-500 to-red-500"
            >
              {motivoSubmotivoTree.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                  Sem dados
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                  {motivoSubmotivoTree.map((item) => {
                    const maxCount = Math.max(...motivoSubmotivoTree.map(d => d.count), 1);
                    const barWidth = Math.max((item.count / maxCount) * 100, 5);
                    const isOpen = expandedMotivo === item.motivo;
                    return (
                      <div key={item.motivo}>
                        <div
                          className="rounded-md border border-border/40 bg-white/70 dark:bg-zinc-900/50 px-2 py-1.5 cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => setExpandedMotivo(isOpen ? null : item.motivo)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {isOpen ? <ChevronUp className="h-3 w-3 flex-shrink-0 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 flex-shrink-0 text-muted-foreground" />}
                              <span className="truncate text-xs text-foreground font-medium">{item.motivo}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs font-semibold text-foreground tabular-nums">{item.count}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-1 pl-5">
                            <div className="flex-1 h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-500 transition-all" style={{ width: `${barWidth}%` }} />
                            </div>
                            <span className="text-[10px] text-red-500 dark:text-red-400 tabular-nums whitespace-nowrap">{formatCurrencyNoDecimals(item.mrr)}</span>
                          </div>
                        </div>
                        {isOpen && item.submotivos.length > 0 && (
                          <div className="ml-5 mt-1 space-y-1 border-l-2 border-orange-200 dark:border-orange-800 pl-2">
                            {item.submotivos.map((sub) => {
                              const subMaxCount = Math.max(...item.submotivos.map(s => s.count), 1);
                              const subBarWidth = Math.max((sub.count / subMaxCount) * 100, 5);
                              return (
                                <div key={sub.submotivo} className="rounded-md border border-border/30 bg-white/50 dark:bg-zinc-900/30 px-2 py-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="truncate text-[11px] text-muted-foreground">{sub.submotivo}</span>
                                    <span className="text-[11px] font-semibold text-foreground tabular-nums">{sub.count}</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <div className="flex-1 h-1 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                      <div className="h-full rounded-full bg-orange-300 dark:bg-orange-600 transition-all" style={{ width: `${subBarWidth}%` }} />
                                    </div>
                                    <span className="text-[9px] text-red-500 dark:text-red-400 tabular-nums whitespace-nowrap">{formatCurrencyNoDecimals(sub.mrr)}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TechChartCard>
          </div>

          {/* Feature 4: Matriz Cruzada (full-width) */}
          <TechChartCard
            title="Matriz de Evitabilidade"
            subtitle="Cruzamento evitável × dimensão"
            icon={Target}
            iconBg="bg-gradient-to-r from-rose-500 to-red-600"
            meta={
              <div className="flex gap-1">
                {(['motivo', 'cluster', 'plano'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setCrossAnalysisView(v)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                      crossAnalysisView === v
                        ? 'bg-rose-500 text-white shadow-sm'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {v === 'motivo' ? 'Por Motivo' : v === 'cluster' ? 'Por Cluster' : 'Por Plano'}
                  </button>
                ))}
              </div>
            }
          >
            {crossAnalysisData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                Sem dados
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, crossAnalysisData.length * 36)}>
                <BarChart data={crossAnalysisData} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                  <defs>
                    <linearGradient id="deepEvitGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#ef4444" />
                      <stop offset="100%" stopColor="#f87171" />
                    </linearGradient>
                    <linearGradient id="deepInevGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                  </defs>
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    content={({ active, payload, label }: any) => {
                      if (!active || !payload?.length) return null;
                      const d = crossAnalysisData.find((x: any) => x.name === label);
                      return (
                        <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-gray-200 dark:border-zinc-700/50 rounded-lg shadow-xl p-3 min-w-[180px]">
                          <p className="text-xs font-semibold text-foreground mb-2">{d?.fullName || label}</p>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between gap-4"><span className="text-red-500">Evitável</span><span className="font-bold">{d?.evitavel} ({formatCurrencyNoDecimals(d?.mrrEvitavel || 0)})</span></div>
                            <div className="flex justify-between gap-4"><span className="text-emerald-500">Inevitável</span><span className="font-bold">{d?.inevitavel} ({formatCurrencyNoDecimals(d?.mrrInevitavel || 0)})</span></div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    formatter={(value: string) => <span className="text-[10px] text-muted-foreground">{value}</span>}
                    iconSize={8}
                  />
                  <Bar dataKey="evitavel" name="Evitável" fill="url(#deepEvitGradient)" stackId="a" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="inevitavel" name="Inevitável" fill="url(#deepInevGradient)" stackId="a" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </TechChartCard>

          {/* Feature 5: Cards de Contexto (Operação + CX) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TechChartCard
              title="Temas Operacionais"
              subtitle="Padrões no contexto de operação"
              icon={Shield}
              iconBg="bg-gradient-to-r from-slate-500 to-zinc-600"
            >
              {contextThemes.operacao.length === 0 ? (
                <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                  Sem dados de operação
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {contextThemes.operacao.map((item, i) => {
                    const maxMrr = Math.max(...contextThemes.operacao.map(d => d.mrr), 1);
                    const barWidth = Math.max((item.mrr / maxMrr) * 100, 5);
                    const isExpanded = expandedOpTheme === item.theme;
                    return (
                      <div key={item.theme} className="rounded-md border border-border/40 bg-white/70 dark:bg-zinc-900/50 overflow-hidden">
                        <button
                          onClick={() => setExpandedOpTheme(isExpanded ? null : item.theme)}
                          className="w-full px-2.5 py-2 space-y-1 text-left hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                              <span className="text-xs font-medium text-foreground">{item.theme}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="secondary" className="text-[10px] h-5">{item.count}</Badge>
                              {isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${barWidth}%`, backgroundColor: PALETTE[i % PALETTE.length] }} />
                            </div>
                            <span className="text-[10px] text-red-500 dark:text-red-400 tabular-nums whitespace-nowrap">{formatCurrencyNoDecimals(item.mrr)}</span>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="border-t border-border/30 bg-gray-50/50 dark:bg-zinc-950/30 px-2.5 py-2 space-y-1.5 max-h-[200px] overflow-y-auto">
                            {item.matchedContratos.slice(0, 20).map(c => (
                              <div key={c.id} className="flex items-start gap-2 text-[11px]">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-zinc-500 flex-shrink-0 mt-1.5" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-medium text-foreground truncate max-w-[140px]">{c.cliente_nome}</span>
                                    <span className="text-red-500 dark:text-red-400 tabular-nums">{formatCurrencyNoDecimals(c.valorr)}</span>
                                  </div>
                                  <p className="text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">{c.contexto_operacao}</p>
                                </div>
                              </div>
                            ))}
                            {item.matchedContratos.length > 20 && (
                              <p className="text-[10px] text-muted-foreground text-center pt-1">+{item.matchedContratos.length - 20} contratos</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TechChartCard>

            <TechChartCard
              title="Temas CX"
              subtitle="Padrões no contexto de experiência do cliente"
              icon={Users}
              iconBg="bg-gradient-to-r from-teal-500 to-cyan-500"
            >
              {contextThemes.cx.length === 0 ? (
                <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                  Sem dados de CX
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {contextThemes.cx.map((item, i) => {
                    const maxMrr = Math.max(...contextThemes.cx.map(d => d.mrr), 1);
                    const barWidth = Math.max((item.mrr / maxMrr) * 100, 5);
                    const isExpanded = expandedCxTheme === item.theme;
                    return (
                      <div key={item.theme} className="rounded-md border border-border/40 bg-white/70 dark:bg-zinc-900/50 overflow-hidden">
                        <button
                          onClick={() => setExpandedCxTheme(isExpanded ? null : item.theme)}
                          className="w-full px-2.5 py-2 space-y-1 text-left hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PALETTE[(i + 5) % PALETTE.length] }} />
                              <span className="text-xs font-medium text-foreground">{item.theme}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="secondary" className="text-[10px] h-5">{item.count}</Badge>
                              {isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${barWidth}%`, backgroundColor: PALETTE[(i + 5) % PALETTE.length] }} />
                            </div>
                            <span className="text-[10px] text-red-500 dark:text-red-400 tabular-nums whitespace-nowrap">{formatCurrencyNoDecimals(item.mrr)}</span>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="border-t border-border/30 bg-gray-50/50 dark:bg-zinc-950/30 px-2.5 py-2 space-y-1.5 max-h-[200px] overflow-y-auto">
                            {item.matchedContratos.slice(0, 20).map(c => (
                              <div key={c.id} className="flex items-start gap-2 text-[11px]">
                                <div className="w-1.5 h-1.5 rounded-full bg-teal-400 dark:bg-teal-600 flex-shrink-0 mt-1.5" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-medium text-foreground truncate max-w-[140px]">{c.cliente_nome}</span>
                                    <span className="text-red-500 dark:text-red-400 tabular-nums">{formatCurrencyNoDecimals(c.valorr)}</span>
                                  </div>
                                  <p className="text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">{c.contexto_cx}</p>
                                </div>
                              </div>
                            ))}
                            {item.matchedContratos.length > 20 && (
                              <p className="text-[10px] text-muted-foreground text-center pt-1">+{item.matchedContratos.length - 20} contratos</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TechChartCard>
          </div>
        </SectionBlock>
      )}

      {/* NOVO: Voz do Cliente — Análise por IA */}
      {!isLoading && contratosComMensagem.length > 0 && (
        <SectionBlock
          title="Voz do Cliente"
          subtitle="Análise por inteligência artificial das mensagens reais de churn"
          icon={Megaphone}
          accent="bg-gradient-to-r from-teal-500 to-cyan-600"
        >
          {/* Loading / Error states */}
          {aiLoading && (
            <div className="flex items-center justify-center gap-3 py-8">
              <div className="h-5 w-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">Analisando {contratosComMensagem.length} mensagens com IA...</span>
            </div>
          )}

          {aiError && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 p-4">
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">Erro na análise IA</p>
              <p className="text-xs text-red-500/80 dark:text-red-400/60 mt-1">{(aiError as Error).message}</p>
              <button onClick={() => refetchAI()} className="mt-3 text-xs text-teal-600 dark:text-teal-400 underline hover:text-teal-800 dark:hover:text-teal-300">Tentar novamente</button>
            </div>
          )}

          {aiAnalysis && !aiLoading && (
            <>
              {/* Síntese da IA — o insight mais valioso */}
              {aiAnalysis.sintese && (
                <Card className="border-teal-200/60 dark:border-teal-800/40 bg-teal-50/30 dark:bg-teal-950/20">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 flex-shrink-0">
                        <Brain className="h-4 w-4 text-white" />
                      </div>
                      <div className="space-y-2 min-w-0">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Principal Causa</p>
                          <p className="text-sm font-semibold text-foreground">{aiAnalysis.sintese.principal_motivo}</p>
                        </div>
                        {aiAnalysis.sintese.padrao_critico && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Padrão Crítico</p>
                            <p className="text-sm text-foreground/80">{aiAnalysis.sintese.padrao_critico}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Recomendação</p>
                          <p className="text-sm font-medium text-teal-700 dark:text-teal-400">{aiAnalysis.sintese.recomendacao}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Charts: Sentimento + Temas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Donut Sentimento IA */}
                <TechChartCard
                  title="Sentimento"
                  subtitle="Classificação por IA (análise contextual completa)"
                  icon={PieChart}
                  iconBg="bg-gradient-to-r from-rose-500 to-orange-500"
                >
                  {sentimentDistribution.length === 0 ? (
                    <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <RechartsPie>
                        <Pie data={sentimentDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="count" nameKey="sentiment">
                          {sentimentDistribution.map((entry, index) => (
                            <Cell key={`sent-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={({ active, payload }: any) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-gray-200 dark:border-zinc-700/50 rounded-lg shadow-xl p-3 min-w-[160px]">
                              <p className="text-xs font-semibold text-foreground mb-1">{d.sentiment}</p>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between"><span className="text-muted-foreground">Contratos</span><span className="font-bold">{d.count}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">MRR</span><span className="font-bold text-red-500">{formatCurrencyNoDecimals(d.mrr)}</span></div>
                              </div>
                            </div>
                          );
                        }} />
                        <Legend formatter={(value: string) => <span className="text-[10px] text-muted-foreground">{value}</span>} iconSize={8} />
                      </RechartsPie>
                    </ResponsiveContainer>
                  )}
                </TechChartCard>

                {/* Temas identificados pela IA */}
                <TechChartCard
                  title="Temas Identificados"
                  subtitle="Classificação por IA — o que os clientes estão dizendo"
                  icon={Hash}
                  iconBg="bg-gradient-to-r from-violet-500 to-purple-600"
                >
                  {themeDistribution.length === 0 ? (
                    <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
                  ) : (
                    <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                      {themeDistribution.map((item, i) => {
                        const maxCount = themeDistribution[0]?.count || 1;
                        const barWidth = Math.max((item.count / maxCount) * 100, 8);
                        const isActive = muralFilterTheme === item.theme;
                        return (
                          <button
                            key={`theme-${i}`}
                            onClick={() => setMuralFilterTheme(isActive ? null : item.theme)}
                            className={`w-full text-left rounded-md border p-2 transition-all ${
                              isActive
                                ? 'border-violet-400 dark:border-violet-600 bg-violet-50/50 dark:bg-violet-950/30'
                                : 'border-border/30 bg-white/50 dark:bg-zinc-900/30 hover:bg-muted/30'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs font-medium text-foreground">{item.theme}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground tabular-nums">{item.count}x</span>
                                <span className="text-[10px] text-red-500 font-semibold tabular-nums">{formatCurrencyNoDecimals(item.mrr)}</span>
                              </div>
                            </div>
                            <div className="h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-500 transition-all" style={{ width: `${barWidth}%` }} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </TechChartCard>
              </div>

              {/* Mural de Mensagens */}
              <Card className="border-border/50">
                <CardHeader className="py-3 px-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm font-semibold">Mensagens dos Clientes</CardTitle>
                      <CardDescription className="text-xs">{contratosComMensagem.length} mensagens analisadas por IA</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Sentiment filter pills */}
                      {['negativo', 'neutro', 'positivo'].map(s => (
                        <button
                          key={s}
                          onClick={() => setMuralFilterSentiment(muralFilterSentiment === s ? null : s)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors border ${
                            muralFilterSentiment === s
                              ? s === 'negativo' ? 'bg-red-500 text-white border-red-500'
                                : s === 'positivo' ? 'bg-green-500 text-white border-green-500'
                                : 'bg-gray-500 text-white border-gray-500'
                              : 'border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {s === 'negativo' ? 'Negativo' : s === 'positivo' ? 'Positivo' : 'Neutro'}
                        </button>
                      ))}
                      <span className="text-border/60">|</span>
                      {/* Sort buttons */}
                      <div className="flex gap-1">
                        {(['mrr', 'date'] as const).map(s => (
                          <button
                            key={s}
                            onClick={() => setMuralSortBy(s)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                              muralSortBy === s
                                ? 'bg-teal-500 text-white shadow-sm'
                                : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            {s === 'mrr' ? 'Por MRR' : 'Por Data'}
                          </button>
                        ))}
                      </div>
                      {(muralFilterSentiment || muralFilterTheme) && (
                        <button
                          onClick={() => { setMuralFilterSentiment(null); setMuralFilterTheme(null); }}
                          className="text-[10px] text-muted-foreground hover:text-foreground underline transition-colors"
                        >
                          Limpar filtros
                        </button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {muralMessages.length === 0 ? (
                    <div className="h-[100px] flex items-center justify-center text-muted-foreground text-sm">
                      Nenhuma mensagem com os filtros selecionados
                    </div>
                  ) : (
                    <>
                      {muralMessages.length > 50 && (
                        <p className="text-[10px] text-muted-foreground mb-2">Mostrando 50 de {muralMessages.length}</p>
                      )}
                      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                        {muralMessages.slice(0, 50).map((msg, i) => {
                          const sentColor = msg.sentiment === 'negativo' ? 'border-l-red-500' : msg.sentiment === 'positivo' ? 'border-l-green-500' : 'border-l-gray-400 dark:border-l-zinc-500';
                          const isExpanded = muralExpandedId === msg.id;
                          const msgDate = msg.data_encerramento || msg.data_pausa;
                          return (
                            <div
                              key={`mural-${msg.id}-${i}`}
                              className={`rounded-lg border border-border/40 bg-white/70 dark:bg-zinc-900/50 p-3 border-l-4 ${sentColor} transition-all`}
                            >
                              {/* Header */}
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-foreground truncate">{msg.cliente_nome}</p>
                                    <span className="text-[10px] text-red-500 font-semibold">{formatCurrencyNoDecimals(msg.valorr)}</span>
                                  </div>
                                  {/* Resumo IA */}
                                  {msg.resumo && (
                                    <p className="text-xs text-muted-foreground italic mt-0.5">{msg.resumo}</p>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-1 flex-shrink-0">
                                  {msg.temas.map((t, ti) => (
                                    <Badge key={ti} variant="outline" className="text-[9px] px-1.5 py-0 bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800">
                                      {t}
                                    </Badge>
                                  ))}
                                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${
                                    msg.sentiment === 'negativo'
                                      ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                                      : msg.sentiment === 'positivo'
                                      ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                                      : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                                  }`}>
                                    {msg.sentiment === 'negativo' ? 'Negativo' : msg.sentiment === 'positivo' ? 'Positivo' : 'Neutro'}
                                  </Badge>
                                </div>
                              </div>
                              {/* Metadata row */}
                              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0">{msg.squad}</Badge>
                                {msg.motivo_cancelamento && (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800">
                                    {msg.motivo_cancelamento}
                                  </Badge>
                                )}
                                {msg.evitabilidade_churn && (
                                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${
                                    msg.evitabilidade_churn === 'Evitável'
                                      ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                                      : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                                  }`}>
                                    {msg.evitabilidade_churn}
                                  </Badge>
                                )}
                                {msgDate && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {format(parseISO(msgDate), "dd/MM/yyyy", { locale: ptBR })}
                                  </span>
                                )}
                              </div>
                              {/* Message body */}
                              <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-line">
                                {msg.mensagem_cliente}
                              </p>
                              {/* Expandable context */}
                              {(msg.contexto_operacao || msg.contexto_cx) && (
                                <div className="mt-2">
                                  <button
                                    onClick={() => setMuralExpandedId(isExpanded ? null : msg.id)}
                                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                                  >
                                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                    Contexto adicional
                                  </button>
                                  {isExpanded && (
                                    <div className="mt-2 space-y-2 pl-3 border-l-2 border-border/40">
                                      {msg.contexto_operacao && (
                                        <div>
                                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Contexto Operação</p>
                                          <p className="text-[11px] text-foreground/70 whitespace-pre-line">{msg.contexto_operacao}</p>
                                        </div>
                                      )}
                                      {msg.contexto_cx && (
                                        <div>
                                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Contexto CX</p>
                                          <p className="text-[11px] text-foreground/70 whitespace-pre-line">{msg.contexto_cx}</p>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </SectionBlock>
      )}

      {/* NOVO: Oportunidades de Retenção (Feature 6) */}
      {!isLoading && filteredContratos.length > 0 && retentionOpportunities.scored.length > 0 && (
        <SectionBlock
          title="Oportunidades de Retenção"
          subtitle="Score de oportunidade e análise de retenção"
          icon={Lightbulb}
          accent="bg-gradient-to-r from-amber-500 to-orange-500"
        >
          {/* KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <TechKpiCard
              title="Oportunidades Perdidas"
              value={String(retentionOpportunities.totalMissed)}
              subtitle="Evitáveis com retenção alta/média"
              icon={AlertTriangle}
              gradient="bg-gradient-to-r from-red-500 to-rose-600"
              shadowColor="shadow-red-500/10"
            />
            <TechKpiCard
              title="MRR Oportunidades"
              value={formatCurrencyNoDecimals(retentionOpportunities.mrrMissed)}
              subtitle="Valor das oportunidades perdidas"
              icon={DollarSign}
              gradient="bg-gradient-to-r from-amber-500 to-orange-500"
              shadowColor="shadow-amber-500/10"
            />
            <TechKpiCard
              title="Score Médio"
              value={`${retentionOpportunities.avgScore.toFixed(0)}/100`}
              subtitle="Score médio de oportunidade"
              icon={Target}
              gradient="bg-gradient-to-r from-indigo-500 to-purple-500"
              shadowColor="shadow-indigo-500/10"
            />
          </div>

          {/* Tabela de oportunidades */}
          <Card className="border-border/50">
            <CardContent className="p-0">
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[80px]">Score</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead className="text-right">MRR</TableHead>
                      <TableHead className="text-center">Lifetime</TableHead>
                      <TableHead className="text-center">Evitabilidade</TableHead>
                      <TableHead className="text-center">Retenção</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {retentionOpportunities.scored.slice(0, 20).map((c, idx) => (
                      <TableRow
                        key={`opp-${c.id}-${idx}`}
                        className={c.isMissedOpportunity ? 'border-l-4 border-l-red-400 dark:border-l-red-600' : ''}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  c.score >= 70 ? 'bg-red-500' : c.score >= 40 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${c.score}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-foreground tabular-nums">{c.score}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-foreground">{c.cliente_nome}</span>
                            {c.is_abonado && (
                              <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                                Abonado
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{c.motivo_cancelamento || '-'}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm font-semibold text-red-600 dark:text-red-400">{formatCurrencyNoDecimals(c.valorr)}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={c.lifetime_meses < 3 ? "destructive" : c.lifetime_meses < 6 ? "secondary" : "default"}
                            className="text-[10px]"
                          >
                            {c.lifetime_meses.toFixed(1)}m
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {c.evitabilidade_churn && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                c.evitabilidade_churn === 'Evitável'
                                  ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                                  : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                              }`}
                            >
                              {c.evitabilidade_churn}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {c.possibilidade_retencao && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                c.possibilidade_retencao === 'Alta'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                                  : c.possibilidade_retencao === 'Média'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
                                  : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                              }`}
                            >
                              {c.possibilidade_retencao}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {retentionOpportunities.scored.length > 20 && (
                  <div className="p-3 text-center text-muted-foreground text-xs border-t">
                    Mostrando top 20 de {retentionOpportunities.scored.length} contratos por score
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </SectionBlock>
      )}
      </>
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
      ) : (
      <>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "contratos" | "clientes")}>
              <TabsList>
                <TabsTrigger value="contratos" className="gap-2" data-testid="tab-contratos">
                  <FileText className="h-4 w-4" />
                  Contratos
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
                      <TableHead className="w-[30px]"></TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/80"
                        onClick={() => handleSort("cliente_nome")}
                      >
                        <div className="flex items-center gap-1">
                          Cliente
                          <SortIcon column="cliente_nome" />
                        </div>
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Cluster</TableHead>
                      <TableHead>Squad</TableHead>
                      <TableHead>Evitabilidade</TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/80 text-right"
                        onClick={() => handleSort("valorr")}
                      >
                        <div className="flex items-center justify-end gap-1">
                          MRR
                          <SortIcon column="valorr" />
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/80"
                        onClick={() => handleSort("data_encerramento")}
                      >
                        <div className="flex items-center gap-1">
                          Solicitação
                          <SortIcon column="data_encerramento" />
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/80 text-right"
                        onClick={() => handleSort("lifetime_meses")}
                      >
                        <div className="flex items-center justify-end gap-1">
                          LT
                          <SortIcon column="lifetime_meses" />
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContratos.slice(0, 100).map((contrato, index) => {
                      const isExpanded = expandedRow === `${contrato.id}-${index}`;
                      const hasDetails = contrato.mensagem_cliente || contrato.contexto_operacao || contrato.contexto_cx;
                      return (
                        <React.Fragment key={`${contrato.id}-${index}`}>
                          <TableRow
                            data-testid={`row-churn-${contrato.id}`}
                            className={`hover:bg-muted/30 ${hasDetails ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-muted/20' : ''}`}
                            onClick={() => hasDetails && setExpandedRow(isExpanded ? null : `${contrato.id}-${index}`)}
                          >
                            <TableCell className="w-[30px] px-2">
                              {hasDetails && (
                                isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-sm">{contrato.cliente_nome || "-"}</span>
                                  {contrato.is_abonado && (
                                    <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                                      Abonado
                                    </Badge>
                                  )}
                                </div>
                                {contrato.motivo_cancelamento && contrato.motivo_cancelamento !== 'Não especificado' && (
                                  <span className="text-[10px] text-muted-foreground">{contrato.motivo_cancelamento}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={contrato.is_abonado ? 'secondary' : contrato.status?.toLowerCase().includes('em cancelamento') ? 'secondary' : 'destructive'}
                                className={contrato.is_abonado ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-[10px]' : contrato.status?.toLowerCase().includes('em cancelamento') ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-[10px]' : 'text-[10px]'}
                              >
                                {contrato.is_abonado ? 'Abonado' : contrato.status?.toLowerCase().includes('em cancelamento') ? 'Em Cancel.' : 'Churn'}
                              </Badge>
                              {contrato.status_cancelamento && (
                                <div className="text-[10px] text-muted-foreground mt-0.5">{contrato.status_cancelamento}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">{contrato.produto || "-"}</Badge>
                            </TableCell>
                            <TableCell className="text-xs">{contrato.plano || "-"}</TableCell>
                            <TableCell className="text-xs">{contrato.cluster || "-"}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-[10px]">{contrato.squad || "-"}</Badge>
                            </TableCell>
                            <TableCell>
                              {contrato.evitabilidade_churn && (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${
                                    contrato.evitabilidade_churn === 'Evitável'
                                      ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                                      : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                                  }`}
                                >
                                  {contrato.evitabilidade_churn}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className={`text-right font-semibold ${contrato.status?.toLowerCase().includes('em cancelamento') ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                              {contrato.valorr > 0 ? formatCurrency(contrato.valorr) : '-'}
                            </TableCell>
                            <TableCell className="text-xs">{formatDate(contrato.data_encerramento)}</TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant={contrato.lifetime_meses < 3 ? "destructive" : contrato.lifetime_meses < 6 ? "secondary" : "default"}
                                className="text-[10px]"
                              >
                                {contrato.lifetime_meses.toFixed(1)}m
                              </Badge>
                            </TableCell>
                          </TableRow>
                          {isExpanded && hasDetails && (
                            <TableRow key={`${contrato.id}-${index}-details`} className="bg-muted/10 hover:bg-muted/10">
                              <TableCell colSpan={11} className="p-0">
                                <div className="px-6 py-4 space-y-3 border-l-4 border-primary/30">
                                  {/* Churn DNA Tags */}
                                  {getChurnDNATags(contrato).length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-1">
                                      {getChurnDNATags(contrato).map((tag, i) => (
                                        <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${tag.color}`}>
                                          <span className="text-[9px] opacity-70">{tag.label}:</span> {tag.value}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="flex flex-wrap gap-2">
                                      <StatPill label="Responsável" value={contrato.responsavel || '-'} />
                                      <StatPill label="CS" value={contrato.cs_responsavel || '-'} />
                                      <StatPill label="Vendedor" value={contrato.vendedor || '-'} />
                                      {contrato.possibilidade_retencao && (
                                        <StatPill label="Retenção" value={contrato.possibilidade_retencao} tone={contrato.possibilidade_retencao === 'Baixa' ? 'danger' : contrato.possibilidade_retencao === 'Média' ? 'warning' : 'success'} />
                                      )}
                                      {contrato.status_conta && (
                                        <StatPill label="Status Conta" value={contrato.status_conta} />
                                      )}
                                    </div>
                                  </div>
                                  {contrato.mensagem_cliente && (
                                    <div className="rounded-lg border border-border/50 bg-white/60 dark:bg-zinc-900/40 p-3">
                                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Mensagem do Cliente</p>
                                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{contrato.mensagem_cliente}</p>
                                    </div>
                                  )}
                                  {contrato.contexto_operacao && (
                                    <div className="rounded-lg border border-border/50 bg-white/60 dark:bg-zinc-900/40 p-3">
                                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Contexto Operação</p>
                                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{contrato.contexto_operacao}</p>
                                    </div>
                                  )}
                                  {contrato.contexto_cx && (
                                    <div className="rounded-lg border border-border/50 bg-white/60 dark:bg-zinc-900/40 p-3">
                                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Contexto CX</p>
                                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{contrato.contexto_cx}</p>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
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

      </>
      )}
    </div>
  );
}





