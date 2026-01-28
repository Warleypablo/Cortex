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
import { format, parseISO, subMonths, startOfMonth, endOfMonth } from "date-fns";
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
  valorr: number;
  data_inicio: string;
  data_encerramento: string | null;
  data_pausa: string | null;
  status: string;
  servico: string;
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

// Componente de Gauge visual para taxa de churn
const ChurnGauge = ({ value, maxValue = 10 }: { value: number; maxValue?: number }) => {
  const percentage = Math.min((value / maxValue) * 100, 100);
  const getColor = () => {
    if (value <= 2) return { color: "text-emerald-500", bg: "from-emerald-500 to-green-500", status: "Excelente", dotBg: "bg-emerald-500" };
    if (value <= 4) return { color: "text-yellow-500", bg: "from-yellow-500 to-amber-500", status: "Atenção", dotBg: "bg-yellow-500" };
    if (value <= 6) return { color: "text-orange-500", bg: "from-orange-500 to-red-500", status: "Crítico", dotBg: "bg-orange-500" };
    return { color: "text-red-600", bg: "from-red-600 to-rose-700", status: "Emergência", dotBg: "bg-red-600" };
  };
  const config = getColor();
  
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

const TechChartCard = ({ title, subtitle, icon: Icon, iconBg, children }: {
  title: string;
  subtitle: string;
  icon: any;
  iconBg: string;
  children: React.ReactNode;
}) => (
  <Card className="border-border/50">
    <CardContent className="p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-md ${iconBg}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </CardContent>
  </Card>
);

export default function ChurnDetalhamento() {
  usePageTitle("Detalhamento de Churn");
  useSetPageInfo("Detalhamento de Churn", "Análise detalhada de contratos encerrados");
  
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
    // Ajuste artificial de R$ 9.878 para 2 contratos faltantes no banco (squad Makers)
    const CHURN_ADJUSTMENT = 9878;
    const mrrPerdido = churnContratos.reduce((sum, c) => sum + (c.valorr || 0), 0) + CHURN_ADJUSTMENT;
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
    
    // Ajuste artificial de R$ 9.878 para o squad ⚡ Makers (2 contratos faltantes no banco)
    const CHURN_ADJUSTMENT_MAKERS = 9878;
    // Procurar ⚡ Makers ou variações (Makers sem emoji)
    const makersKey = Object.keys(squadData).find(s => 
      s === '⚡ Makers' || s === '⚡Makers' || (s.toLowerCase() === 'makers')
    );
    if (makersKey) {
      squadData[makersKey].mrr_perdido += CHURN_ADJUSTMENT_MAKERS;
    } else if (squadData['⚡ Makers']) {
      squadData['⚡ Makers'].mrr_perdido += CHURN_ADJUSTMENT_MAKERS;
    } else {
      // Se não existe ⚡ Makers nos contratos de churn, criar entrada
      const makersOriginal = data.metricas.churn_por_squad?.find(s => 
        s.squad === '⚡ Makers' || s.squad.toLowerCase().includes('makers')
      );
      squadData['⚡ Makers'] = { 
        mrr_perdido: CHURN_ADJUSTMENT_MAKERS, 
        mrr_base: makersOriginal?.mrr_ativo || 265622 
      };
    }
    
    return Object.entries(squadData)
      .map(([squad, info]) => ({
        squad,
        mrr_perdido: info.mrr_perdido,
        mrr_ativo: info.mrr_base,
        percentual: info.mrr_base > 0 ? (info.mrr_perdido / info.mrr_base) * 100 : 0
      }))
      .filter(s => s.mrr_perdido > 0) // Remover squads com valor zerado
      .sort((a, b) => b.percentual - a.percentual);
  }, [filteredContratos, data?.metricas?.churn_por_squad]);

  const filteredTaxaChurn = useMemo(() => {
    const mrrBase = data?.metricas?.mrr_ativo_ref || 0;
    const mrrPerdido = filteredMetricas.mrr_perdido;
    return mrrBase > 0 ? (mrrPerdido / mrrBase) * 100 : 0;
  }, [filteredMetricas.mrr_perdido, data?.metricas?.mrr_ativo_ref]);

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
      const produto = c.produto || "Não especificado";
      if (!prodCounts[produto]) prodCounts[produto] = { count: 0, mrr: 0 };
      prodCounts[produto].count++;
      prodCounts[produto].mrr += c.valorr || 0;
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
                <ChurnGauge value={data.metricas.churn_percentual || 0} />
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  Base: {data.metricas.periodo_referencia ? format(parseISO(data.metricas.periodo_referencia), "MMMM/yyyy", { locale: ptBR }) : "mês anterior"}
                </p>
              </div>
              
              {/* Coluna 2: Métricas principais */}
              <div className="flex flex-col gap-3">
                <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-100 dark:border-red-900/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-red-600 dark:text-red-400 uppercase">MRR Perdido</span>
                    <DollarSign className="h-4 w-4 text-red-500" />
                  </div>
                  <div className="text-2xl font-bold text-red-700 dark:text-red-300">{formatCurrency(filteredMetricas.mrr_perdido)}</div>
                  <div className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">{filteredMetricas.total_churned} contratos encerrados</div>
                </div>
                
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-100 dark:border-amber-900/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase">MRR Pausado</span>
                    <Pause className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{formatCurrency(filteredMetricas.mrr_pausado)}</div>
                  <div className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">{filteredMetricas.total_pausados} contratos pausados</div>
                </div>
                
                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">MRR Base Referência</span>
                    <Target className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{formatCurrency(data.metricas.mrr_ativo_ref || 0)}</div>
                  <div className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">base para cálculo do churn</div>
                </div>
              </div>
              
              {/* Coluna 3: Ranking de Churn por Squad */}
              <div className="bg-white/50 dark:bg-zinc-800/30 rounded-xl border border-gray-100 dark:border-zinc-700/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">Churn por Squad</h3>
                  <Badge variant="outline" className="text-xs">Top {filteredChurnPorSquad.length}</Badge>
                </div>
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TechChartCard
          title="Churn por Mês"
          subtitle="Evolução mensal de contratos encerrados"
          icon={BarChart3}
          iconBg="bg-gradient-to-r from-orange-500 to-amber-500"
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
          title="Distribuição por Produto"
          subtitle="Percentual de churn por produto"
          icon={PieChart}
          iconBg="bg-gradient-to-r from-blue-500 to-indigo-500"
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
                  <div key={item.name} className="space-y-0.5">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TechChartCard
          title="MRR Perdido por Squad"
          subtitle="Valor mensal perdido (R$)"
          icon={DollarSign}
          iconBg="bg-gradient-to-r from-emerald-500 to-teal-500"
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
                  <div key={item.name} className="space-y-0.5">
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

      {/* Nova seção: Análises Avançadas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* MRR Perdido por Mês */}
        <TechChartCard
          title="Evolução do MRR Perdido"
          subtitle="Valor perdido mensalmente"
          icon={DollarSign}
          iconBg="bg-gradient-to-r from-red-500 to-rose-500"
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

      {/* Distribuição por Ticket e Cohort */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Distribuição por Faixa de Ticket */}
        <TechChartCard
          title="Churn por Faixa de Ticket"
          subtitle="Distribuição por valor do contrato"
          icon={DollarSign}
          iconBg="bg-gradient-to-r from-indigo-500 to-purple-500"
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
                  <div key={item.name} className="space-y-0.5">
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

      {/* Distribuição de Lifetime */}
      <Card className="border-emerald-200 dark:border-emerald-900/40">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 shadow-lg">
              <Target className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">Distribuição de Lifetime</CardTitle>
              <CardDescription>Quanto tempo os clientes permaneceram antes de sair</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[280px] w-full" />
          ) : lifetimeCurve.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
              Nenhum dado disponível
            </div>
          ) : (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={lifetimeCurve} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="retentionGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.05}/>
                    </linearGradient>
                    <linearGradient id="mrrRetentionGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4}/>
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="monthIndex" 
                    tick={{ fontSize: 11 }} 
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}m`}
                    className="fill-muted-foreground"
                  />
                  <YAxis 
                    tick={{ fontSize: 11 }} 
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    className="fill-muted-foreground"
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const point = payload[0]?.payload as RetentionPoint;
                      return (
                        <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-gray-200 dark:border-zinc-700/50 rounded-lg shadow-xl p-3 min-w-[200px]">
                          <p className="text-xs font-medium text-gray-600 dark:text-zinc-300 mb-2 uppercase tracking-wider">
                            Mês {label}
                          </p>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="text-gray-500 dark:text-zinc-400">Contratos {label}+ meses</span>
                              </span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">{point?.retainedPct?.toFixed(1)}%</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                <span className="text-gray-500 dark:text-zinc-400">MRR {label}+ meses</span>
                              </span>
                              <span className="font-bold text-blue-600 dark:text-blue-400">{point?.mrrRetainedPct?.toFixed(1)}%</span>
                            </div>
                            <div className="border-t border-gray-200 dark:border-zinc-700 pt-1 mt-2">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Contratos que viveram {label}+ meses</span>
                                <span>{point?.retainedCount?.toLocaleString('pt-BR')} de {point?.totalStarted?.toLocaleString('pt-BR')}</span>
                              </div>
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Saíram entre {label}-{Number(label)+1} meses</span>
                                <span className="text-red-500">{point?.churnedCount?.toLocaleString('pt-BR')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="retainedPct" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    fill="url(#retentionGradient)" 
                    name="Retenção Clientes (%)"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="mrrRetainedPct" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    fill="url(#mrrRetentionGradient)" 
                    name="Retenção MRR (%)"
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-6 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-muted-foreground">% Contratos que viveram X+ meses</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-muted-foreground">% MRR que viveu X+ meses</span>
                </div>
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
