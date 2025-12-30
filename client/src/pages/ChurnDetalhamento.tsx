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
  Users
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
import { format, parseISO, subMonths } from "date-fns";
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
  Legend
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
  data_encerramento: string;
  status: string;
  servico: string;
  lifetime_meses: number;
  ltv: number;
}

interface ChurnDetalhamentoData {
  contratos: ChurnContract[];
  metricas: {
    total_churned: number;
    mrr_perdido: number;
    ltv_total: number;
    lt_medio: number;
  };
  filtros: {
    squads: string[];
    produtos: string[];
    responsaveis: string[];
    servicos: string[];
  };
}

const CHART_COLORS = {
  primary: "hsl(var(--chart-1))",
  secondary: "hsl(var(--chart-2))",
  tertiary: "hsl(var(--chart-3))",
  quaternary: "hsl(var(--chart-4))",
  quinary: "hsl(var(--chart-5))",
};

const PALETTE = [
  "#f87171", "#fb923c", "#fbbf24", "#4ade80", "#2dd4bf",
  "#60a5fa", "#a78bfa", "#f472b6", "#818cf8", "#a3e635"
];

const REFINED_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e",
  "#14b8a6", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"
];

const CustomTooltip = ({ active, payload, label, valueFormatter }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 min-w-[140px]">
      <p className="text-sm font-medium text-foreground mb-2">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">{entry.name === "count" ? "Quantidade" : entry.name}</span>
          <span className="font-semibold text-foreground">
            {valueFormatter ? valueFormatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function ChurnDetalhamento() {
  usePageTitle("Detalhamento de Churn");
  useSetPageInfo("Detalhamento de Churn", "Análise detalhada de contratos encerrados");
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSquads, setFilterSquads] = useState<string[]>([]);
  const [filterProdutos, setFilterProdutos] = useState<string[]>([]);
  const [filterResponsaveis, setFilterResponsaveis] = useState<string[]>([]);
  const [filterServicos, setFilterServicos] = useState<string[]>([]);
  const [dataInicio, setDataInicio] = useState<string>(format(subMonths(new Date(), 12), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [sortBy, setSortBy] = useState<string>("data_encerramento");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);
  const [viewMode, setViewMode] = useState<"contratos" | "clientes">("contratos");

  const { data, isLoading, error } = useQuery<ChurnDetalhamentoData>({
    queryKey: ["/api/analytics/churn-detalhamento", "all"],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/churn-detalhamento?meses=all`);
      if (!res.ok) throw new Error("Failed to fetch churn data");
      return res.json();
    },
  });

  const filteredContratos = useMemo(() => {
    if (!data?.contratos) return [];
    
    let filtered = [...data.contratos];
    
    if (dataInicio) {
      const inicio = new Date(dataInicio);
      filtered = filtered.filter(c => c.data_encerramento && new Date(c.data_encerramento) >= inicio);
    }
    
    if (dataFim) {
      const fim = new Date(dataFim);
      fim.setHours(23, 59, 59, 999);
      filtered = filtered.filter(c => c.data_encerramento && new Date(c.data_encerramento) <= fim);
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
          comparison = new Date(a.data_encerramento).getTime() - new Date(b.data_encerramento).getTime();
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
      return { total_churned: 0, mrr_perdido: 0, ltv_total: 0, lt_medio: 0, ticket_medio: 0 };
    }
    
    const total = filteredContratos.length;
    const mrrPerdido = filteredContratos.reduce((sum, c) => sum + (c.valorr || 0), 0);
    const ltvTotal = filteredContratos.reduce((sum, c) => sum + (c.ltv || 0), 0);
    const ltMedio = filteredContratos.reduce((sum, c) => sum + (c.lifetime_meses || 0), 0) / total;
    const ticketMedio = mrrPerdido / total;
    
    return {
      total_churned: total,
      mrr_perdido: mrrPerdido,
      ltv_total: ltvTotal,
      lt_medio: ltMedio,
      ticket_medio: ticketMedio
    };
  }, [filteredContratos]);

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
    
    const meses: Record<string, { count: number; mrr: number }> = {};
    filteredContratos.forEach(c => {
      if (!c.data_encerramento) return;
      const mes = format(parseISO(c.data_encerramento), "MMM/yy", { locale: ptBR });
      if (!meses[mes]) meses[mes] = { count: 0, mrr: 0 };
      meses[mes].count++;
      meses[mes].mrr += c.valorr || 0;
    });
    
    return Object.entries(meses)
      .map(([mes, data]) => ({
        mes,
        count: data.count,
        mrr: data.mrr
      }))
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Período de Análise</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod(3)}>3M</Button>
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod(6)}>6M</Button>
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod(12)}>12M</Button>
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod(24)}>24M</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
            <div className="text-sm text-muted-foreground">
              Mostrando <span className="font-semibold text-foreground">{filteredContratos.length}</span> contratos no período
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { 
            title: "Total Churned", 
            value: filteredMetricas.total_churned.toString(),
            subtitle: "contratos encerrados",
            icon: TrendingDown,
            accent: "border-l-red-500"
          },
          { 
            title: "MRR Perdido", 
            value: formatCurrency(filteredMetricas.mrr_perdido),
            subtitle: "receita mensal perdida",
            icon: DollarSign,
            accent: "border-l-orange-500"
          },
          { 
            title: "LTV Total", 
            value: formatCurrency(filteredMetricas.ltv_total),
            subtitle: "valor gerado antes do churn",
            icon: Target,
            accent: "border-l-amber-500"
          },
          { 
            title: "Lifetime Médio", 
            value: `${filteredMetricas.lt_medio.toFixed(1)}m`,
            subtitle: "meses em média",
            icon: Clock,
            accent: "border-l-blue-500"
          },
          { 
            title: "Ticket Médio", 
            value: formatCurrency(filteredMetricas.ticket_medio),
            subtitle: "MRR médio por contrato",
            icon: BarChart3,
            accent: "border-l-violet-500"
          },
          { 
            title: "LTV Médio", 
            value: filteredMetricas.total_churned > 0 
              ? formatCurrency(filteredMetricas.ltv_total / filteredMetricas.total_churned)
              : "R$ 0",
            subtitle: "por contrato churned",
            icon: Percent,
            accent: "border-l-emerald-500"
          }
        ].map((kpi, index) => (
          <Card key={index} className={`border-l-4 ${kpi.accent} bg-card/50`}>
            <CardContent className="p-4">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-7 w-24" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {kpi.title}
                    </span>
                    <kpi.icon className="h-4 w-4 text-muted-foreground/60" />
                  </div>
                  <div className="text-2xl font-bold tracking-tight">{kpi.value}</div>
                  <p className="text-[10px] text-muted-foreground mt-1">{kpi.subtitle}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-red-500/10">
                <BarChart3 className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Churn por Mês</CardTitle>
                <CardDescription className="text-xs">Evolução mensal de contratos encerrados</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : churnPorMes.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                Nenhum dado disponível
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={churnPorMes} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <XAxis 
                    dataKey="mes" 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip valueFormatter={(v: number) => `${v} contratos`} />} />
                  <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} name="Quantidade" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-orange-500/10">
                <PieChart className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Distribuição por Produto</CardTitle>
                <CardDescription className="text-xs">Percentual de churn por produto</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : distribuicaoPorProduto.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                Nenhum dado disponível
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={220}>
                  <RechartsPie>
                    <Pie
                      data={distribuicaoPorProduto}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={85}
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
                <div className="flex-1 space-y-1.5 text-xs">
                  {distribuicaoPorProduto.slice(0, 5).map((item, i) => (
                    <div key={item.name} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div 
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: REFINED_COLORS[i % REFINED_COLORS.length] }}
                        />
                        <span className="truncate text-muted-foreground">{item.fullName}</span>
                      </div>
                      <span className="font-medium tabular-nums">{item.percentual.toFixed(0)}%</span>
                    </div>
                  ))}
                  {distribuicaoPorProduto.length > 5 && (
                    <p className="text-[10px] text-muted-foreground/60 pt-1">
                      +{distribuicaoPorProduto.length - 5} outros
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-violet-500/10">
                <Users className="h-4 w-4 text-violet-500" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Churn por Squad</CardTitle>
                <CardDescription className="text-xs">Quantidade por squad</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : distribuicaoPorSquad.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                Nenhum dado disponível
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={distribuicaoPorSquad} layout="vertical" margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <XAxis 
                    type="number" 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
                    width={80}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip valueFormatter={(v: number) => `${v} contratos`} />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Quantidade">
                    {distribuicaoPorSquad.map((entry, index) => (
                      <Cell key={entry.name} fill={REFINED_COLORS[index % REFINED_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-amber-500/10">
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Distribuição por Lifetime</CardTitle>
                <CardDescription className="text-xs">Tempo de permanência</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : distribuicaoPorLifetime.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                Nenhum dado disponível
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <ResponsiveContainer width="55%" height={200}>
                  <RechartsPie>
                    <Pie
                      data={distribuicaoPorLifetime.filter(d => d.count > 0)}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
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
                <div className="flex-1 space-y-1.5 text-xs">
                  {distribuicaoPorLifetime.filter(d => d.count > 0).map((item, i) => (
                    <div key={item.name} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: REFINED_COLORS[i % REFINED_COLORS.length] }}
                        />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="font-medium tabular-nums">{item.percentual.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-blue-500/10">
                <Users className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Churn por Responsável</CardTitle>
                <CardDescription className="text-xs">Top 6 responsáveis</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : distribuicaoPorResponsavel.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                Nenhum dado disponível
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={distribuicaoPorResponsavel} layout="vertical" margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                  <XAxis 
                    type="number" 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
                    width={70}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip valueFormatter={(v: number) => `${v} contratos`} />} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Quantidade" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
          <CardHeader className="pb-3">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <CardTitle className="text-base">Filtros Avançados</CardTitle>
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
                  Contratos Encerrados
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
                          Encerramento
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
                          <Badge variant="outline">{contrato.produto || "-"}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{contrato.squad || "-"}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{contrato.responsavel || "-"}</TableCell>
                        <TableCell className="text-right font-semibold text-red-600 dark:text-red-400">
                          {formatCurrency(contrato.valorr || 0)}
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(contrato.data_inicio)}</TableCell>
                        <TableCell className="text-sm">{formatDate(contrato.data_encerramento)}</TableCell>
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
