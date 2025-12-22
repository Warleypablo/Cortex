import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { 
  BarChart3,
  TrendingUp,
  Clock,
  Building2,
  DollarSign,
  Repeat,
  Zap,
  Users,
  Calendar,
  Filter,
  RotateCcw,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

interface Metricas {
  totalNegocios: number;
  totalMrr: number;
  totalPontual: number;
  receitaTotal: number;
  ticketMedio: number;
  cicloMedioDias: number;
  empresasUnicas: number;
  closersAtivos: number;
  negociosRecorrentes: number;
  negociosPontuais: number;
  negociosMistos: number;
  mrrMedio: number;
  pontualMedio: number;
  primeiraVenda: string | null;
  ultimaVenda: string | null;
}

interface Negocio {
  dealId: string;
  dealName: string;
  companyName: string;
  valorRecorrente: number;
  valorPontual: number;
  valorTotal: number;
  categoryName: string;
  source: string;
  pipelineName: string;
  ownerName: string;
  createdDate: string;
  closeDate: string;
  cicloDias: number;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
}

interface DistribuicaoItem {
  fonte?: string;
  closer?: string;
  quantidade: number;
  mrr: number;
  pontual: number;
  total: number;
  ticketMedio?: number;
  cicloMedio?: number;
}

interface EvolucaoMensal {
  mes: string;
  mesLabel: string;
  quantidade: number;
  mrr: number;
  pontual: number;
  total: number;
  ticketMedio: number;
}

interface CicloVendas {
  faixa: string;
  quantidade: number;
  valorTotal: number;
  ticketMedio: number;
}

interface TipoContrato {
  tipo: string;
  quantidade: number;
  mrr: number;
  pontual: number;
  total: number;
}

interface Filtros {
  sources: string[];
  categories: string[];
  closers: string[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const formatCurrencyCompact = (value: number) => {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(0)}k`;
  }
  return `R$ ${value.toFixed(0)}`;
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('pt-BR');
};

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const SOURCE_NAME_MAP: Record<string, string> = {
  "CALL": "Agendamento Direto",
  "EMAIL": "Automação",
  "WEB": "Contato - Instagram",
  "ADVERTISING": "Contato Recebido",
  "PARTNER": "CrossSell",
  "RECOMMENDATION": "Eventos",
  "TRADE_SHOW": "Indound(Linkedin)",
  "WEBFORM": "Formulário",
  "CALLBACK": "Indicação",
  "RC_GENERATOR": "Indique e Ganhe",
  "STORE": "Wpp Marketing",
  "OTHER": "Lista - Wpp Marketing",
  "REPEAT_SALE": "Vendas Recorrentes",
  "UC_YWZVA2": "Prospecção Ativa",
  "UC_PTYW1Y": "Recomendação",
  "UC_4VCKGM": "Social Selling - Instagram",
  "UC_7WV0LW": "Upsell",
  "UC_KYOYOW": "Workshop",
  "UC_8HI30Y": "Recuperação de Churn"
};

function getSourceDisplayName(sourceId: string): string {
  return SOURCE_NAME_MAP[sourceId] || sourceId || "Não informado";
}

export default function DetalhamentoVendas() {
  useSetPageInfo("Detalhamento de Vendas", "Análise técnica de negócios ganhos");
  const hoje = new Date();
  const [selectedMonth, setSelectedMonth] = useState({ month: hoje.getMonth() + 1, year: hoje.getFullYear() });
  const [source, setSource] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [closer, setCloser] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [orderBy, setOrderBy] = useState<string>("close_date");
  const [orderDir, setOrderDir] = useState<string>("desc");
  const [utmType, setUtmType] = useState<string>("source");

  const dateObj = new Date(selectedMonth.year, selectedMonth.month - 1, 1);
  const dataInicio = format(startOfMonth(dateObj), 'yyyy-MM-dd');
  const dataFim = format(endOfMonth(dateObj), 'yyyy-MM-dd');

  const queryParamsObj = {
    dataInicio,
    dataFim,
    source,
    category,
    closer
  };

  const { data: filtros } = useQuery<Filtros>({
    queryKey: ['/api/vendas/detalhamento/filtros']
  });

  const { data: metricas, isLoading: isLoadingMetricas } = useQuery<Metricas>({
    queryKey: ['/api/vendas/detalhamento/metricas', queryParamsObj]
  });

  const { data: negocios, isLoading: isLoadingNegocios } = useQuery<Negocio[]>({
    queryKey: ['/api/vendas/detalhamento/negocios', { ...queryParamsObj, orderBy, orderDir }]
  });

  const { data: porFonte } = useQuery<DistribuicaoItem[]>({
    queryKey: ['/api/vendas/detalhamento/por-fonte', { dataInicio, dataFim }]
  });

  const { data: porCloser } = useQuery<DistribuicaoItem[]>({
    queryKey: ['/api/vendas/detalhamento/por-closer', { dataInicio, dataFim }]
  });

  const { data: evolucaoMensal } = useQuery<EvolucaoMensal[]>({
    queryKey: ['/api/vendas/detalhamento/evolucao-mensal', { dataInicio, dataFim }]
  });

  const { data: cicloVendas } = useQuery<CicloVendas[]>({
    queryKey: ['/api/vendas/detalhamento/ciclo-vendas', { dataInicio, dataFim }]
  });

  const { data: tipoContrato } = useQuery<TipoContrato[]>({
    queryKey: ['/api/vendas/detalhamento/tipo-contrato', { dataInicio, dataFim }]
  });

  const { data: porUtm } = useQuery<{ utmValue: string; quantidade: number; mrr: number; pontual: number; total: number }[]>({
    queryKey: ['/api/vendas/detalhamento/por-utm', { dataInicio, dataFim, utmType }]
  });

  const resetFilters = () => {
    const hoje = new Date();
    setSelectedMonth({ month: hoje.getMonth() + 1, year: hoje.getFullYear() });
    setSource("all");
    setCategory("all");
    setCloser("all");
  };

  const navegarMes = (direcao: 'anterior' | 'proximo') => {
    const novoMes = direcao === 'anterior' ? selectedMonth.month - 1 : selectedMonth.month + 1;
    const novoAno = selectedMonth.year + (novoMes > 12 ? 1 : novoMes < 1 ? -1 : 0);
    const mesFinal = novoMes > 12 ? 1 : novoMes < 1 ? 12 : novoMes;
    
    setSelectedMonth({ month: mesFinal, year: novoAno });
  };

  const toggleSort = (column: string) => {
    if (orderBy === column) {
      setOrderDir(orderDir === 'desc' ? 'asc' : 'desc');
    } else {
      setOrderBy(column);
      setOrderDir('desc');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-400" />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navegarMes('anterior')}
              className="bg-muted border-border hover:bg-muted"
              data-testid="button-mes-anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navegarMes('proximo')}
              className="bg-muted border-border hover:bg-muted"
              data-testid="button-mes-proximo"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="bg-muted border-border hover:bg-muted"
              data-testid="button-toggle-filters"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filtros
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="bg-muted border-border hover:bg-muted"
              data-testid="button-reset-filters"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {showFilters && (
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Período</Label>
                  <MonthYearPicker
                    value={selectedMonth}
                    onChange={setSelectedMonth}
                    triggerClassName="bg-muted border-border text-sm h-9 w-full"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Fonte</Label>
                  <Select value={source} onValueChange={setSource}>
                    <SelectTrigger className="bg-muted border-border text-sm h-9" data-testid="select-source">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent className="bg-muted border-border">
                      <SelectItem value="all">Todas</SelectItem>
                      {filtros?.sources?.filter(s => s && s.trim() !== '').map((s) => (
                        <SelectItem key={s} value={s}>{getSourceDisplayName(s)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Categoria</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="bg-muted border-border text-sm h-9" data-testid="select-category">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent className="bg-muted border-border">
                      <SelectItem value="all">Todas</SelectItem>
                      {filtros?.categories?.filter(c => c && c.trim() !== '').map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Closer</Label>
                  <Select value={closer} onValueChange={setCloser}>
                    <SelectTrigger className="bg-muted border-border text-sm h-9" data-testid="select-closer">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent className="bg-muted border-border">
                      <SelectItem value="all">Todos</SelectItem>
                      {filtros?.closers?.filter(c => c && c.trim() !== '').map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <Card className="bg-card border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase">Negócios</span>
              </div>
              {isLoadingMetricas ? (
                <Skeleton className="h-7 w-16 bg-muted" />
              ) : (
                <div className="text-xl font-bold text-foreground" data-testid="text-total-negocios">
                  {metricas?.totalNegocios || 0}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase">Receita Total</span>
              </div>
              {isLoadingMetricas ? (
                <Skeleton className="h-7 w-20 bg-muted" />
              ) : (
                <div className="text-xl font-bold text-emerald-400" data-testid="text-receita-total">
                  {formatCurrencyCompact(metricas?.receitaTotal || 0)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Repeat className="w-4 h-4 text-green-400" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase">MRR</span>
              </div>
              {isLoadingMetricas ? (
                <Skeleton className="h-7 w-20 bg-muted" />
              ) : (
                <div className="text-xl font-bold text-green-400" data-testid="text-total-mrr">
                  {formatCurrencyCompact(metricas?.totalMrr || 0)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-blue-400" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase">Pontual</span>
              </div>
              {isLoadingMetricas ? (
                <Skeleton className="h-7 w-20 bg-muted" />
              ) : (
                <div className="text-xl font-bold text-blue-400" data-testid="text-total-pontual">
                  {formatCurrencyCompact(metricas?.totalPontual || 0)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-violet-400" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase">Ticket Médio</span>
              </div>
              {isLoadingMetricas ? (
                <Skeleton className="h-7 w-20 bg-muted" />
              ) : (
                <div className="text-xl font-bold text-violet-400" data-testid="text-ticket-medio">
                  {formatCurrencyCompact(metricas?.ticketMedio || 0)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase">Ciclo Médio</span>
              </div>
              {isLoadingMetricas ? (
                <Skeleton className="h-7 w-16 bg-muted" />
              ) : (
                <div className="text-xl font-bold text-amber-400" data-testid="text-ciclo-medio">
                  {(metricas?.cicloMedioDias || 0).toFixed(0)}d
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase">Empresas</span>
              </div>
              {isLoadingMetricas ? (
                <Skeleton className="h-7 w-12 bg-muted" />
              ) : (
                <div className="text-xl font-bold text-cyan-400" data-testid="text-empresas">
                  {metricas?.empresasUnicas || 0}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-pink-400" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase">Closers</span>
              </div>
              {isLoadingMetricas ? (
                <Skeleton className="h-7 w-12 bg-muted" />
              ) : (
                <div className="text-xl font-bold text-pink-400" data-testid="text-closers">
                  {metricas?.closersAtivos || 0}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-card/50 border-border">
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground">Recorrentes</span>
                <div className="text-lg font-bold text-green-400">{metricas?.negociosRecorrentes || 0}</div>
              </div>
              <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                MRR
              </Badge>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border">
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground">Pontuais</span>
                <div className="text-lg font-bold text-blue-400">{metricas?.negociosPontuais || 0}</div>
              </div>
              <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                One-time
              </Badge>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border">
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground">Mistos</span>
                <div className="text-lg font-bold text-violet-400">{metricas?.negociosMistos || 0}</div>
              </div>
              <Badge variant="outline" className="bg-violet-500/10 text-violet-400 border-violet-500/30">
                MRR + Pontual
              </Badge>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border">
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground">Período</span>
                <div className="text-sm font-medium text-muted-foreground">
                  {formatDate(metricas?.primeiraVenda || null)} - {formatDate(metricas?.ultimaVenda || null)}
                </div>
              </div>
              <Calendar className="w-5 h-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="lista" className="space-y-4">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="lista" className="data-[state=active]:bg-muted">
              Lista de Negócios
            </TabsTrigger>
            <TabsTrigger value="distribuicao" className="data-[state=active]:bg-muted">
              Distribuição
            </TabsTrigger>
            <TabsTrigger value="evolucao" className="data-[state=active]:bg-muted">
              Evolução
            </TabsTrigger>
            <TabsTrigger value="ciclo" className="data-[state=active]:bg-muted">
              Ciclo de Vendas
            </TabsTrigger>
            <TabsTrigger value="utm" className="data-[state=active]:bg-muted">
              UTM
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Negócios Ganhos ({negocios?.length || 0})
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Select value={orderBy} onValueChange={setOrderBy}>
                      <SelectTrigger className="w-32 bg-muted border-border h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-muted border-border">
                        <SelectItem value="close_date">Data</SelectItem>
                        <SelectItem value="valor">Valor Total</SelectItem>
                        <SelectItem value="mrr">MRR</SelectItem>
                        <SelectItem value="pontual">Pontual</SelectItem>
                        <SelectItem value="ciclo">Ciclo</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOrderDir(orderDir === 'desc' ? 'asc' : 'desc')}
                      className="bg-muted border-border h-8"
                    >
                      <ArrowUpDown className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr className="text-muted-foreground uppercase tracking-wider">
                        <th className="text-left p-2 font-medium">Empresa</th>
                        <th className="text-right p-2 font-medium">MRR</th>
                        <th className="text-right p-2 font-medium">Pontual</th>
                        <th className="text-right p-2 font-medium">Total</th>
                        <th className="text-center p-2 font-medium">Ciclo</th>
                        <th className="text-left p-2 font-medium">Closer</th>
                        <th className="text-left p-2 font-medium">Fonte</th>
                        <th className="text-left p-2 font-medium">Fechamento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {isLoadingNegocios ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i}>
                            <td colSpan={8} className="p-2">
                              <Skeleton className="h-6 bg-muted" />
                            </td>
                          </tr>
                        ))
                      ) : negocios && negocios.length > 0 ? (
                        negocios.map((n) => (
                          <tr key={n.dealId} className="hover:bg-muted/30" data-testid={`row-negocio-${n.dealId}`}>
                            <td className="p-2">
                              <div className="font-medium text-foreground truncate max-w-[180px]">{n.companyName || '-'}</div>
                              <div className="text-muted-foreground text-[10px] truncate max-w-[180px]">{n.dealName}</div>
                            </td>
                            <td className="p-2 text-right">
                              {n.valorRecorrente > 0 ? (
                                <span className="text-green-400 font-medium">{formatCurrency(n.valorRecorrente)}</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="p-2 text-right">
                              {n.valorPontual > 0 ? (
                                <span className="text-blue-400 font-medium">{formatCurrency(n.valorPontual)}</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="p-2 text-right">
                              <span className="text-foreground font-bold">{formatCurrency(n.valorTotal)}</span>
                            </td>
                            <td className="p-2 text-center">
                              <Badge 
                                variant="outline" 
                                className={`text-[10px] ${
                                  n.cicloDias <= 14 ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                                  n.cicloDias <= 30 ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                                  'bg-red-500/10 text-red-400 border-red-500/30'
                                }`}
                              >
                                {n.cicloDias.toFixed(0)}d
                              </Badge>
                            </td>
                            <td className="p-2">
                              <span className="text-muted-foreground">{n.ownerName || '-'}</span>
                            </td>
                            <td className="p-2">
                              <Badge variant="outline" className="text-[10px] bg-muted border-border">
                                {getSourceDisplayName(n.source)}
                              </Badge>
                            </td>
                            <td className="p-2 text-muted-foreground">
                              {formatDate(n.closeDate)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-muted-foreground">
                            Nenhum negócio encontrado para o período selecionado
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="distribuicao" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-card border-border">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Por Fonte</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={(porFonte || []).map(item => ({ ...item, fonte: getSourceDisplayName(item.fonte || '') }))} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis type="number" tickFormatter={(v) => formatCurrencyCompact(v)} stroke="#94a3b8" fontSize={10} />
                        <YAxis type="category" dataKey="fonte" stroke="#94a3b8" fontSize={10} width={100} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                          formatter={(value: number) => formatCurrency(value)}
                        />
                        <Bar dataKey="mrr" fill="#10b981" name="MRR" stackId="a" />
                        <Bar dataKey="pontual" fill="#3b82f6" name="Pontual" stackId="a" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 space-y-2">
                    {porFonte?.map((item) => (
                      <div key={item.fonte} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{getSourceDisplayName(item.fonte || '')}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">{item.quantidade} neg.</span>
                          <span className="text-foreground font-medium">{formatCurrency(item.total)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Por Closer</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={porCloser || []} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis type="number" tickFormatter={(v) => formatCurrencyCompact(v)} stroke="#94a3b8" fontSize={10} />
                        <YAxis type="category" dataKey="closer" stroke="#94a3b8" fontSize={10} width={80} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                          formatter={(value: number) => formatCurrency(value)}
                        />
                        <Bar dataKey="mrr" fill="#10b981" name="MRR" stackId="a" />
                        <Bar dataKey="pontual" fill="#3b82f6" name="Pontual" stackId="a" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 space-y-2">
                    {porCloser?.map((item) => (
                      <div key={item.closer} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{item.closer}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">{item.quantidade} neg.</span>
                          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30">
                            {(item.cicloMedio || 0).toFixed(0)}d
                          </Badge>
                          <span className="text-foreground font-medium">{formatCurrency(item.total)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-card border-border">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Tipo de Contrato</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={tipoContrato || []}
                          dataKey="quantidade"
                          nameKey="tipo"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ tipo, percent }) => `${tipo} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {tipoContrato?.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    {tipoContrato?.map((item, index) => (
                      <div key={item.tipo} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          <span className="text-sm text-muted-foreground">{item.tipo}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-foreground">{formatCurrency(item.total)}</div>
                          <div className="text-xs text-muted-foreground">{item.quantidade} negócios</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="evolucao" className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Evolução Mensal de Vendas</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={evolucaoMensal || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="mesLabel" stroke="#94a3b8" fontSize={10} />
                      <YAxis tickFormatter={(v) => formatCurrencyCompact(v)} stroke="#94a3b8" fontSize={10} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Legend />
                      <Bar dataKey="mrr" fill="#10b981" name="MRR" />
                      <Bar dataKey="pontual" fill="#3b82f6" name="Pontual" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr className="text-muted-foreground uppercase">
                        <th className="text-left p-2">Mês</th>
                        <th className="text-right p-2">Negócios</th>
                        <th className="text-right p-2">MRR</th>
                        <th className="text-right p-2">Pontual</th>
                        <th className="text-right p-2">Total</th>
                        <th className="text-right p-2">Ticket Médio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {evolucaoMensal?.map((m) => (
                        <tr key={m.mes} className="hover:bg-muted/30">
                          <td className="p-2 text-muted-foreground">{m.mesLabel}</td>
                          <td className="p-2 text-right text-foreground font-medium">{m.quantidade}</td>
                          <td className="p-2 text-right text-green-400">{formatCurrency(m.mrr)}</td>
                          <td className="p-2 text-right text-blue-400">{formatCurrency(m.pontual)}</td>
                          <td className="p-2 text-right text-foreground font-bold">{formatCurrency(m.total)}</td>
                          <td className="p-2 text-right text-violet-400">{formatCurrency(m.ticketMedio)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ciclo" className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Análise de Ciclo de Vendas</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={cicloVendas || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="faixa" stroke="#94a3b8" fontSize={10} />
                        <YAxis stroke="#94a3b8" fontSize={10} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                        />
                        <Bar dataKey="quantidade" fill="#8b5cf6" name="Negócios" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    {cicloVendas?.map((item, index) => (
                      <div key={item.faixa} className="p-3 bg-muted/50 rounded">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-foreground">{item.faixa}</span>
                          <Badge 
                            variant="outline" 
                            className={`${
                              index === 0 ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                              index === 1 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                              index === 2 ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                              index === 3 ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' :
                              'bg-red-500/10 text-red-400 border-red-500/30'
                            }`}
                          >
                            {item.quantidade} negócios
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Valor Total</span>
                          <span className="text-foreground">{formatCurrency(item.valorTotal)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs mt-1">
                          <span className="text-muted-foreground">Ticket Médio</span>
                          <span className="text-violet-400">{formatCurrency(item.ticketMedio)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="utm" className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Análise por UTM</CardTitle>
                  <Select value={utmType} onValueChange={setUtmType}>
                    <SelectTrigger className="w-36 bg-muted border-border h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-muted border-border">
                      <SelectItem value="source">UTM Source</SelectItem>
                      <SelectItem value="medium">UTM Medium</SelectItem>
                      <SelectItem value="campaign">UTM Campaign</SelectItem>
                      <SelectItem value="term">UTM Term</SelectItem>
                      <SelectItem value="content">UTM Content</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porUtm || []} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis type="number" tickFormatter={(v) => formatCurrencyCompact(v)} stroke="#94a3b8" fontSize={10} />
                      <YAxis type="category" dataKey="utmValue" stroke="#94a3b8" fontSize={10} width={100} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Bar dataKey="mrr" fill="#10b981" name="MRR" stackId="a" />
                      <Bar dataKey="pontual" fill="#3b82f6" name="Pontual" stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr className="text-muted-foreground uppercase">
                        <th className="text-left p-2">Valor</th>
                        <th className="text-right p-2">Negócios</th>
                        <th className="text-right p-2">MRR</th>
                        <th className="text-right p-2">Pontual</th>
                        <th className="text-right p-2">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {porUtm?.map((item) => (
                        <tr key={item.utmValue} className="hover:bg-muted/30">
                          <td className="p-2">
                            <Badge variant="outline" className="bg-muted border-border">
                              {item.utmValue}
                            </Badge>
                          </td>
                          <td className="p-2 text-right text-foreground">{item.quantidade}</td>
                          <td className="p-2 text-right text-green-400">{formatCurrency(item.mrr)}</td>
                          <td className="p-2 text-right text-blue-400">{formatCurrency(item.pontual)}</td>
                          <td className="p-2 text-right text-foreground font-bold">{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
