import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  FolderOpen, 
  FolderCheck, 
  Clock, 
  User, 
  Search,
  Timer,
  Target,
  TrendingUp,
  DollarSign,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ArrowUpDown,
  Trophy,
  Gauge,
  Activity,
  Zap,
  BarChart3
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  RadialBarChart,
  RadialBar,
  ComposedChart,
  Line,
  Legend,
  CartesianGrid,
} from "recharts";

interface TechProjetoDetalhe {
  clickupTaskId: string;
  taskName: string;
  statusProjeto: string;
  responsavel: string | null;
  faseProjeto: string | null;
  tipo: string | null;
  tipoProjeto: string | null;
  valorP: number | null;
  dataVencimento: string | null;
  lancamento: string | null;
  dataCriada: string | null;
}

interface TechTempoResponsavel {
  responsavel: string;
  totalEntregas: number;
  tempoMedioEntrega: number;
  taxaNoPrazo: number;
  valorTotalEntregue: number;
  projetosAtivos?: number;
  tempoEmAberto?: number;
  valorAtivos?: number;
}

interface TechProjetoResponsavel {
  responsavel: string;
  projetosAtivos: number;
  projetosFechados: number;
  valorTotal: number;
}

interface TechProjetoTipo {
  tipo: string;
  quantidade: number;
  valorTotal: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatCurrencyShort = (value: number) => {
  if (value >= 1000000) return `R$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$${(value / 1000).toFixed(0)}K`;
  return `R$${value}`;
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR');
};

const getStatusInfo = (status: string): { bgColor: string; textColor: string } => {
  const statusLower = status?.toLowerCase() || '';
  if (statusLower.includes('deploy') || statusLower.includes('completo') || statusLower.includes('finalizado')) {
    return { bgColor: 'bg-green-500', textColor: 'text-green-600' };
  }
  if (statusLower.includes('review') || statusLower.includes('qa') || statusLower.includes('teste')) {
    return { bgColor: 'bg-purple-500', textColor: 'text-purple-600' };
  }
  if (statusLower.includes('andamento') || statusLower.includes('progresso') || statusLower.includes('dev')) {
    return { bgColor: 'bg-blue-500', textColor: 'text-blue-600' };
  }
  if (statusLower.includes('design')) {
    return { bgColor: 'bg-pink-500', textColor: 'text-pink-600' };
  }
  if (statusLower.includes('kickoff') || statusLower.includes('planejamento')) {
    return { bgColor: 'bg-yellow-500', textColor: 'text-yellow-600' };
  }
  return { bgColor: 'bg-slate-400', textColor: 'text-slate-600' };
};

const isOverdue = (dateStr: string | null) => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

const getDaysUntil = (dateStr: string | null) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diffTime = date.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getDaysFromCreation = (dateStr: string | null) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diffTime = today.getTime() - date.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getPerformanceColor = (taxa: number): string => {
  if (taxa >= 80) return '#22c55e';
  if (taxa >= 60) return '#eab308';
  return '#ef4444';
};

const getTempoColor = (dias: number): string => {
  if (dias <= 15) return '#22c55e';
  if (dias <= 30) return '#3b82f6';
  if (dias <= 45) return '#eab308';
  return '#ef4444';
};

export default function TechProjetos() {
  useSetPageInfo("Tech - Projetos", "Análise técnica detalhada e métricas de performance");
  const [activeTab, setActiveTab] = useState<'abertos' | 'fechados'>('abertos');
  const [responsavelFilter, setResponsavelFilter] = useState<string>('todos');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'data' | 'valor' | 'prazo'>('data');
  
  // Filtros de período - padrão últimos 90 dias
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [statsResponsavelFilter, setStatsResponsavelFilter] = useState<string>('todos');

  const { data: tempoResponsavel, isLoading: isLoadingTempo } = useQuery<TechTempoResponsavel[]>({
    queryKey: ['/api/tech/tempo-responsavel', startDate, endDate, statsResponsavelFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (statsResponsavelFilter !== 'todos') params.set('responsavel', statsResponsavelFilter);
      const res = await fetch(`/api/tech/tempo-responsavel?${params.toString()}`, {
        credentials: "include"
      });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    }
  });

  const { data: responsaveis, isLoading: isLoadingResp } = useQuery<TechProjetoResponsavel[]>({
    queryKey: ['/api/tech/projetos-por-responsavel'],
  });

  const { data: tipos, isLoading: isLoadingTipos } = useQuery<TechProjetoTipo[]>({
    queryKey: ['/api/tech/projetos-por-tipo'],
  });

  const { data: projetos, isLoading: isLoadingProjetos } = useQuery<TechProjetoDetalhe[]>({
    queryKey: ['/api/tech/projetos', activeTab, responsavelFilter, tipoFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('tipo', activeTab);
      if (responsavelFilter !== 'todos') params.set('responsavel', responsavelFilter);
      if (tipoFilter !== 'todos') params.set('tipoP', tipoFilter);
      const res = await fetch(`/api/tech/projetos?${params.toString()}`, {
        credentials: "include"
      });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    }
  });

  const uniqueResponsaveis = useMemo(() => {
    return responsaveis?.map(r => r.responsavel).filter(r => r && r !== 'Não atribuído') || [];
  }, [responsaveis]);

  const uniqueTipos = useMemo(() => {
    return tipos?.map(t => t.tipo).filter(t => t && t !== 'Não definido') || [];
  }, [tipos]);

  const filteredProjetos = useMemo(() => {
    let result = projetos || [];
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.taskName?.toLowerCase().includes(term) ||
        p.responsavel?.toLowerCase().includes(term) ||
        p.tipo?.toLowerCase().includes(term)
      );
    }

    if (sortBy === 'valor') {
      result = [...result].sort((a, b) => (b.valorP || 0) - (a.valorP || 0));
    } else if (sortBy === 'prazo' && activeTab === 'abertos') {
      result = [...result].sort((a, b) => {
        if (!a.dataVencimento) return 1;
        if (!b.dataVencimento) return -1;
        return new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime();
      });
    }

    return result;
  }, [projetos, searchTerm, sortBy, activeTab]);

  const totalValor = filteredProjetos.reduce((sum, p) => sum + (p.valorP || 0), 0);
  const projetosAtrasados = activeTab === 'abertos' 
    ? filteredProjetos.filter(p => isOverdue(p.dataVencimento)).length 
    : 0;

  // Dados para gráfico de performance
  const performanceChartData = useMemo(() => {
    return tempoResponsavel?.slice(0, 8).map(r => ({
      name: r.responsavel?.split(' ')[0] || 'N/A',
      fullName: r.responsavel,
      entregas: r.totalEntregas,
      ativos: r.projetosAtivos || 0,
      tempoMedio: Math.round(r.tempoMedioEntrega || 0),
      tempoEmAberto: Math.round(r.tempoEmAberto || 0),
      taxa: Math.round(r.taxaNoPrazo || 0),
      valor: r.valorTotalEntregue,
      valorAtivos: r.valorAtivos || 0,
      fill: getPerformanceColor(r.taxaNoPrazo || 0)
    })) || [];
  }, [tempoResponsavel]);

  // Ranking de carga de trabalho (projetos ativos)
  const rankingCargaData = useMemo(() => {
    if (!tempoResponsavel) return [];
    return [...tempoResponsavel]
      .filter(r => (r.projetosAtivos || 0) > 0)
      .sort((a, b) => (b.projetosAtivos || 0) - (a.projetosAtivos || 0))
      .slice(0, 5);
  }, [tempoResponsavel]);

  // Estatísticas gerais
  const stats = useMemo(() => {
    if (!tempoResponsavel || tempoResponsavel.length === 0) {
      return { avgTempo: 0, avgTaxa: 0, totalEntregas: 0, totalValor: 0, totalAtivos: 0, avgTempoEmAberto: 0, valorAtivos: 0, ticketMedio: 0 };
    }
    const totalEntregas = tempoResponsavel.reduce((sum, r) => sum + r.totalEntregas, 0);
    const totalValor = tempoResponsavel.reduce((sum, r) => sum + r.valorTotalEntregue, 0);
    const totalAtivos = tempoResponsavel.reduce((sum, r) => sum + (r.projetosAtivos || 0), 0);
    const valorAtivos = tempoResponsavel.reduce((sum, r) => sum + (r.valorAtivos || 0), 0);
    const ticketMedio = totalEntregas > 0 ? totalValor / totalEntregas : 0;
    
    // Calcular média ponderada do tempo de entrega
    const entregasComTempo = tempoResponsavel.filter(r => r.totalEntregas > 0 && r.tempoMedioEntrega > 0);
    const avgTempo = entregasComTempo.length > 0 
      ? entregasComTempo.reduce((sum, r) => sum + r.tempoMedioEntrega * r.totalEntregas, 0) / 
        entregasComTempo.reduce((sum, r) => sum + r.totalEntregas, 0)
      : 0;
    
    // Calcular média ponderada da taxa de cumprimento
    const entregasComTaxa = tempoResponsavel.filter(r => r.totalEntregas > 0 && r.taxaNoPrazo > 0);
    const avgTaxa = entregasComTaxa.length > 0
      ? entregasComTaxa.reduce((sum, r) => sum + r.taxaNoPrazo * r.totalEntregas, 0) / 
        entregasComTaxa.reduce((sum, r) => sum + r.totalEntregas, 0)
      : 0;
    
    // Calcular média do tempo em aberto
    const ativosComTempo = tempoResponsavel.filter(r => (r.projetosAtivos || 0) > 0 && (r.tempoEmAberto || 0) > 0);
    const avgTempoEmAberto = ativosComTempo.length > 0
      ? ativosComTempo.reduce((sum, r) => sum + (r.tempoEmAberto || 0) * (r.projetosAtivos || 0), 0) / 
        ativosComTempo.reduce((sum, r) => sum + (r.projetosAtivos || 0), 0)
      : 0;
    
    return { avgTempo, avgTaxa, totalEntregas, totalValor, totalAtivos, avgTempoEmAberto, valorAtivos, ticketMedio };
  }, [tempoResponsavel]);

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-6 max-w-7xl">

        {/* Card de Análise com Filtros */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Visão Geral de Performance
                </CardTitle>
                <CardDescription>Métricas e análises por período e responsável</CardDescription>
              </div>
              
              {/* Barra de Filtros */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-[140px] h-9"
                    data-testid="input-start-date"
                  />
                  <span className="text-muted-foreground">até</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-[140px] h-9"
                    data-testid="input-end-date"
                  />
                </div>
                
                <Select value={statsResponsavelFilter} onValueChange={setStatsResponsavelFilter}>
                  <SelectTrigger className="w-[160px] h-9" data-testid="select-stats-responsavel">
                    <User className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {uniqueResponsaveis.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            {/* KPIs de Performance Geral */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <FolderOpen className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Proj. Ativos</p>
                  {isLoadingTempo ? (
                    <Skeleton className="h-7 w-12 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-blue-600">{stats.totalAtivos}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border-indigo-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 rounded-lg">
                  <Clock className="h-5 w-5 text-indigo-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tempo Aberto</p>
                  {isLoadingTempo ? (
                    <Skeleton className="h-7 w-16 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-indigo-600">
                      {Math.round(stats.avgTempoEmAberto)}
                      <span className="text-sm font-normal ml-1">dias</span>
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <FolderCheck className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Entregas</p>
                  {isLoadingTempo ? (
                    <Skeleton className="h-7 w-12 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-green-600">{stats.totalEntregas}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <Timer className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tempo Entrega</p>
                  {isLoadingTempo ? (
                    <Skeleton className="h-7 w-16 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-orange-600">
                      {stats.avgTempo > 0 ? Math.round(stats.avgTempo) : '-'}
                      {stats.avgTempo > 0 && <span className="text-sm font-normal ml-1">dias</span>}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <Target className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">No Prazo</p>
                  {isLoadingTempo ? (
                    <Skeleton className="h-7 w-14 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-emerald-600">
                      {stats.avgTaxa > 0 ? `${stats.avgTaxa.toFixed(0)}%` : '-'}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <DollarSign className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor Entregue</p>
                  {isLoadingTempo ? (
                    <Skeleton className="h-7 w-20 mt-1" />
                  ) : (
                    <p className="text-xl font-bold text-purple-600">{formatCurrencyShort(stats.totalValor)}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor em Aberto</p>
                  {isLoadingTempo ? (
                    <Skeleton className="h-7 w-20 mt-1" />
                  ) : (
                    <p className="text-xl font-bold text-amber-600">{formatCurrencyShort(stats.valorAtivos)}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border-cyan-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/20 rounded-lg">
                  <DollarSign className="h-5 w-5 text-cyan-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ticket Médio</p>
                  {isLoadingTempo ? (
                    <Skeleton className="h-7 w-20 mt-1" />
                  ) : (
                    <p className="text-xl font-bold text-cyan-600">{formatCurrencyShort(stats.ticketMedio)}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos de Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          {/* Gráfico de Barras - Entregas e Tempo */}
          <Card className="lg:col-span-2 border flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Performance por Desenvolvedor
              </CardTitle>
              <CardDescription>Entregas e tempo médio de cada responsável</CardDescription>
            </CardHeader>
            <CardContent className="pt-2 flex-1 flex flex-col">
              {isLoadingTempo ? (
                <Skeleton className="flex-1 w-full min-h-[300px]" />
              ) : performanceChartData.length === 0 ? (
                <div className="flex items-center justify-center flex-1 min-h-[300px] text-muted-foreground">
                  Nenhum dado encontrado
                </div>
              ) : (
                <div className="bg-muted/30 rounded-lg p-4 flex-1 flex flex-col min-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={performanceChartData} margin={{ top: 20, right: 40, left: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        tickLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <YAxis 
                        yAxisId="left" 
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        tickLine={{ stroke: 'hsl(var(--border))' }}
                        label={{ value: 'Entregas', angle: -90, position: 'insideLeft', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        yAxisId="right" 
                        orientation="right" 
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        tickLine={{ stroke: 'hsl(var(--border))' }}
                        label={{ value: 'Dias', angle: 90, position: 'insideRight', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <RechartsTooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-card border rounded-lg p-3 shadow-lg">
                                <p className="font-medium mb-2">{data.fullName}</p>
                                <div className="space-y-1 text-sm">
                                  <p>Entregas: <span className="font-medium">{data.entregas}</span></p>
                                  <p>Tempo médio: <span className="font-medium">{data.tempoMedio}d</span></p>
                                  <p>No prazo: <span className="font-medium">{data.taxa}%</span></p>
                                  <p>Valor: <span className="font-medium">{formatCurrency(data.valor)}</span></p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend 
                        formatter={(value) => value === 'entregas' ? 'Entregas' : 'Tempo (dias)'} 
                        wrapperStyle={{ paddingTop: '10px' }}
                      />
                      <Bar yAxisId="left" dataKey="entregas" fill="#3b82f6" radius={[4, 4, 0, 0]} name="entregas" />
                      <Line yAxisId="right" type="monotone" dataKey="tempoMedio" stroke="#f97316" strokeWidth={3} dot={{ fill: '#f97316', r: 5 }} name="tempoMedio" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ranking de Carga de Trabalho */}
          <Card className="border flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <User className="h-4 w-4 text-blue-500" />
                Carga por Responsável
              </CardTitle>
              <CardDescription>Top 5 por projetos ativos</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              {isLoadingTempo ? (
                <Skeleton className="flex-1 w-full min-h-[300px]" />
              ) : rankingCargaData.length === 0 ? (
                <div className="flex items-center justify-center flex-1 min-h-[300px] text-muted-foreground">
                  Nenhum dado encontrado
                </div>
              ) : (
                <div className="space-y-3 flex-1">
                  {rankingCargaData.map((r: TechTempoResponsavel, index: number) => {
                    const tempoColor = getTempoColor(r.tempoEmAberto || 0);
                    const maxAtivos = Math.max(...rankingCargaData.map(x => x.projetosAtivos || 0));
                    const percentual = maxAtivos > 0 ? ((r.projetosAtivos || 0) / maxAtivos) * 100 : 0;
                    return (
                      <div 
                        key={index}
                        className="p-3 rounded-lg border bg-card hover-elevate"
                        data-testid={`ranking-item-${index}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                              style={{ backgroundColor: '#3b82f6' }}
                            >
                              {(r.responsavel || 'NA').substring(0, 2).toUpperCase()}
                            </div>
                            <span className="font-medium text-sm truncate max-w-[100px]">
                              {r.responsavel}
                            </span>
                          </div>
                          <Badge variant="secondary">
                            {r.projetosAtivos || 0} ativos
                          </Badge>
                        </div>
                        <Progress 
                          value={percentual} 
                          className="h-2"
                        />
                        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                          <span style={{ color: tempoColor }}>
                            {Math.round(r.tempoEmAberto || 0)}d em aberto
                          </span>
                          <span>{formatCurrencyShort(r.valorAtivos || 0)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
          </CardContent>
        </Card>

        {/* Cards de Performance Detalhada */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              Métricas Detalhadas por Responsável
            </CardTitle>
            <CardDescription>Projetos ativos, tempo em aberto e entregas</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTempo ? (
              <Skeleton className="h-[180px] w-full" />
            ) : !tempoResponsavel || tempoResponsavel.length === 0 ? (
              <div className="flex items-center justify-center h-[150px] text-muted-foreground">
                Nenhum dado encontrado
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {tempoResponsavel.slice(0, 8).map((resp, index) => {
                  const tempoAbertoColor = getTempoColor(resp.tempoEmAberto || 0);
                  const hasAtivos = (resp.projetosAtivos || 0) > 0;
                  const hasEntregas = resp.totalEntregas > 0;
                  return (
                    <div 
                      key={index}
                      className="p-4 rounded-lg border bg-card hover-elevate relative overflow-hidden"
                      data-testid={`card-responsavel-${index}`}
                    >
                      {/* Indicador visual de carga */}
                      <div 
                        className="absolute top-0 left-0 w-1 h-full" 
                        style={{ backgroundColor: hasAtivos ? tempoAbertoColor : '#94a3b8' }}
                      />
                      
                      <div className="flex items-center gap-3 mb-3 pl-2">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold"
                          style={{ backgroundColor: '#3b82f6' }}
                        >
                          {(resp.responsavel || 'NA').substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{resp.responsavel}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="text-blue-600 font-medium">{resp.projetosAtivos || 0} ativos</span>
                            <span>|</span>
                            <span className="text-green-600">{resp.totalEntregas} entregas</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 pl-2 mb-3">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="p-2 rounded-md bg-blue-500/10">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                <Clock className="h-3 w-3 text-blue-500" />
                                Em Aberto
                              </div>
                              <p className="font-bold" style={{ color: tempoAbertoColor }}>
                                {hasAtivos ? `${Math.round(resp.tempoEmAberto || 0)}d` : '-'}
                              </p>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>Tempo médio dos projetos em aberto</TooltipContent>
                        </Tooltip>
                        
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="p-2 rounded-md bg-green-500/10">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                <Timer className="h-3 w-3 text-green-500" />
                                Entrega
                              </div>
                              <p className="font-bold text-green-600">
                                {hasEntregas && resp.tempoMedioEntrega > 0 ? `${Math.round(resp.tempoMedioEntrega)}d` : '-'}
                              </p>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>Tempo médio de entrega (projetos fechados)</TooltipContent>
                        </Tooltip>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 pl-2">
                        <div className="text-center">
                          <span className="text-xs text-muted-foreground">Valor Ativos</span>
                          <p className="font-semibold text-sm text-blue-600">
                            {formatCurrencyShort(resp.valorAtivos || 0)}
                          </p>
                        </div>
                        <div className="text-center">
                          <span className="text-xs text-muted-foreground">Valor Entregue</span>
                          <p className="font-semibold text-sm text-green-600">
                            {formatCurrencyShort(resp.valorTotalEntregue)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs Abertos/Fechados + Filtros */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'abertos' | 'fechados')}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <TabsList>
              <TabsTrigger value="abertos" data-testid="tab-abertos" className="gap-2">
                <FolderOpen className="h-4 w-4" />
                Projetos Abertos
              </TabsTrigger>
              <TabsTrigger value="fechados" data-testid="tab-fechados" className="gap-2">
                <FolderCheck className="h-4 w-4" />
                Projetos Fechados
              </TabsTrigger>
            </TabsList>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar projeto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-[180px]"
                  data-testid="input-search"
                />
              </div>

              <Select value={responsavelFilter} onValueChange={setResponsavelFilter}>
                <SelectTrigger className="w-[160px]" data-testid="select-responsavel">
                  <User className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {uniqueResponsaveis.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-tipo">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {uniqueTipos.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="w-[130px]" data-testid="select-ordenar">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="data">Data</SelectItem>
                  <SelectItem value="valor">Valor</SelectItem>
                  {activeTab === 'abertos' && <SelectItem value="prazo">Prazo</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-muted-foreground">Total</span>
                  {activeTab === 'abertos' ? <FolderOpen className="h-4 w-4 text-blue-500" /> : <FolderCheck className="h-4 w-4 text-green-500" />}
                </div>
                <p className="text-2xl font-bold" data-testid="text-total-projetos">
                  {filteredProjetos.length}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-muted-foreground">Valor Total</span>
                  <DollarSign className="h-4 w-4 text-purple-500" />
                </div>
                <p className="text-xl font-bold" data-testid="text-valor-total">
                  {formatCurrency(totalValor)}
                </p>
              </CardContent>
            </Card>

            {activeTab === 'abertos' && (
              <>
                <Card className={projetosAtrasados > 0 ? 'border-destructive/50' : ''}>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Atrasados</span>
                      <AlertCircle className={`h-4 w-4 ${projetosAtrasados > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                    </div>
                    <p className={`text-2xl font-bold ${projetosAtrasados > 0 ? 'text-destructive' : ''}`} data-testid="text-atrasados">
                      {projetosAtrasados}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Próximos 7d</span>
                      <Calendar className="h-4 w-4 text-yellow-500" />
                    </div>
                    <p className="text-2xl font-bold" data-testid="text-proximos">
                      {filteredProjetos.filter(p => {
                        const days = getDaysUntil(p.dataVencimento);
                        return days !== null && days >= 0 && days <= 7;
                      }).length}
                    </p>
                  </CardContent>
                </Card>
              </>
            )}

            {activeTab === 'fechados' && (
              <>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Responsáveis</span>
                      <User className="h-4 w-4 text-blue-500" />
                    </div>
                    <p className="text-2xl font-bold">
                      {new Set(filteredProjetos.map(p => p.responsavel).filter(Boolean)).size}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Tipos</span>
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    </div>
                    <p className="text-2xl font-bold">
                      {new Set(filteredProjetos.map(p => p.tipo).filter(Boolean)).size}
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Lista de Projetos */}
          <Card>
            <CardContent className="p-0">
              {isLoadingProjetos ? (
                <div className="p-6">
                  <Skeleton className="h-[400px] w-full" />
                </div>
              ) : !filteredProjetos || filteredProjetos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  {activeTab === 'abertos' ? <FolderOpen className="h-12 w-12 mb-4 opacity-50" /> : <FolderCheck className="h-12 w-12 mb-4 opacity-50" />}
                  <p>Nenhum projeto encontrado</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead className="min-w-[280px]">Projeto</TableHead>
                        <TableHead className="w-[140px]">Status</TableHead>
                        <TableHead className="w-[140px]">Responsável</TableHead>
                        <TableHead className="w-[100px]">Tipo</TableHead>
                        <TableHead className="text-right w-[100px]">Valor</TableHead>
                        {activeTab === 'abertos' ? (
                          <>
                            <TableHead className="w-[80px]">Idade</TableHead>
                            <TableHead className="w-[100px]">Prazo</TableHead>
                          </>
                        ) : (
                          <>
                            <TableHead className="w-[80px]">Tempo</TableHead>
                            <TableHead className="w-[120px]">Lançamento</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProjetos.map((projeto, index) => {
                        const statusInfo = getStatusInfo(projeto.statusProjeto);
                        const overdue = activeTab === 'abertos' && isOverdue(projeto.dataVencimento);
                        const daysUntil = getDaysUntil(projeto.dataVencimento);
                        const daysFromCreation = getDaysFromCreation(projeto.dataCriada);
                        const deliveryTime = projeto.lancamento && projeto.dataCriada 
                          ? Math.ceil((new Date(projeto.lancamento).getTime() - new Date(projeto.dataCriada).getTime()) / (1000 * 60 * 60 * 24))
                          : null;

                        return (
                          <TableRow 
                            key={projeto.clickupTaskId} 
                            data-testid={`row-projeto-${index}`}
                            className={overdue ? 'bg-destructive/5' : ''}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusInfo.bgColor}`} />
                                <p className="truncate max-w-[260px]">{projeto.taskName}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-xs ${statusInfo.textColor}`}>
                                {projeto.statusProjeto || '-'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <span className="text-[10px] font-medium text-primary">
                                    {(projeto.responsavel || '-').substring(0, 2).toUpperCase()}
                                  </span>
                                </div>
                                <span className="truncate max-w-[100px]">{projeto.responsavel || '-'}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {projeto.tipo || '-'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium">
                              {projeto.valorP ? formatCurrencyShort(projeto.valorP) : '-'}
                            </TableCell>
                            
                            {activeTab === 'abertos' ? (
                              <>
                                <TableCell>
                                  <span className={`text-sm ${daysFromCreation !== null && daysFromCreation > 30 ? 'text-orange-600 font-medium' : 'text-muted-foreground'}`}>
                                    {daysFromCreation !== null ? `${daysFromCreation}d` : '-'}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {projeto.dataVencimento ? (
                                    overdue ? (
                                      <Badge variant="destructive" className="text-xs">
                                        {Math.abs(daysUntil || 0)}d atrasado
                                      </Badge>
                                    ) : daysUntil !== null && daysUntil <= 7 ? (
                                      <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                                        {daysUntil === 0 ? 'Hoje' : `${daysUntil}d`}
                                      </Badge>
                                    ) : (
                                      <span className="text-sm text-muted-foreground">
                                        {formatDate(projeto.dataVencimento)}
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-sm text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                              </>
                            ) : (
                              <>
                                <TableCell>
                                  {deliveryTime !== null ? (
                                    <Badge variant="outline" className={
                                      deliveryTime <= 15 
                                        ? 'bg-green-500/10 text-green-600 border-green-500/30'
                                        : deliveryTime <= 30 
                                          ? 'bg-blue-500/10 text-blue-600 border-blue-500/30'
                                          : deliveryTime <= 45
                                            ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30'
                                            : 'bg-red-500/10 text-red-600 border-red-500/30'
                                    }>
                                      {deliveryTime}d
                                    </Badge>
                                  ) : '-'}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1 text-sm text-green-600">
                                    <CheckCircle2 className="h-3 w-3" />
                                    {formatDate(projeto.lancamento)}
                                  </div>
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </Tabs>
      </div>
    </div>
  );
}
