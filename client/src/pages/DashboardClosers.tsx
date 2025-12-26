import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { 
  Handshake, 
  DollarSign, 
  Users, 
  TrendingUp, 
  Target, 
  CalendarDays,
  Filter,
  RotateCcw,
  Crown,
  Medal,
  Trophy,
  Flame,
  Zap,
  Star,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Minus,
  Sparkles,
  Repeat,
  X,
  Calendar,
  Monitor,
  Info
} from "lucide-react";
import { formatCurrency, formatCurrencyCompact, formatPercent } from "@/lib/utils";

interface CloserMetrics {
  mrrObtido: number;
  pontualObtido: number;
  reunioesRealizadas: number;
  negociosGanhos: number;
  leadsCriados: number;
  taxaConversao: number;
}

interface Closer {
  id: number;
  name: string;
  email: string | null;
  active: boolean;
}

interface ChartDataReunioesNegocios {
  closer: string;
  reunioes: number;
  negociosGanhos: number;
  taxaConversao: number;
}

interface ChartDataReceita {
  closer: string;
  mrr: number;
  pontual: number;
}

interface RankingCloser {
  position: number;
  name: string;
  mrr: number;
  pontual: number;
  total: number;
  reunioes: number;
  negocios: number;
  taxa: number;
  trend: 'up' | 'down' | 'stable';
}

export default function DashboardClosers() {
  usePageTitle("Dashboard Closers");
  useSetPageInfo("Arena dos Closers", "Quem será o campeão de vendas?");
  const [, navigate] = useLocation();
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

  const [dataReuniaoRange, setDataReuniaoRange] = useState<DateRange | undefined>({ from: inicioMes, to: fimMes });
  const [dataFechamentoRange, setDataFechamentoRange] = useState<DateRange | undefined>({ from: inicioMes, to: fimMes });
  const [dataLeadRange, setDataLeadRange] = useState<DateRange | undefined>({ from: inicioMes, to: fimMes });
  const [source, setSource] = useState<string>("all");
  const [pipeline, setPipeline] = useState<string>("all");
  const [closerId, setCloserId] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mesAtual, setMesAtual] = useState<string>(
    hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  );

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const navegarMes = (direcao: 'anterior' | 'proximo') => {
    const dataAtual = dataFechamentoRange?.from || new Date();
    const novoMes = direcao === 'anterior' 
      ? new Date(dataAtual.getFullYear(), dataAtual.getMonth() - 1, 1)
      : new Date(dataAtual.getFullYear(), dataAtual.getMonth() + 1, 1);
    
    const inicioNovoMes = new Date(novoMes.getFullYear(), novoMes.getMonth(), 1);
    const fimNovoMes = new Date(novoMes.getFullYear(), novoMes.getMonth() + 1, 0);
    
    const novoRange: DateRange = { from: inicioNovoMes, to: fimNovoMes };
    setDataReuniaoRange(novoRange);
    setDataFechamentoRange(novoRange);
    setDataLeadRange(novoRange);
    setMesAtual(novoMes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));
  };

  const irParaMesAtual = () => {
    const agora = new Date();
    const inicioMesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const fimMesAtual = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);
    
    const novoRange: DateRange = { from: inicioMesAtual, to: fimMesAtual };
    setDataReuniaoRange(novoRange);
    setDataFechamentoRange(novoRange);
    setDataLeadRange(novoRange);
    setMesAtual(agora.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));
  };

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (dataReuniaoRange?.from) params.append("dataReuniaoInicio", format(dataReuniaoRange.from, "yyyy-MM-dd"));
    if (dataReuniaoRange?.to) params.append("dataReuniaoFim", format(dataReuniaoRange.to, "yyyy-MM-dd"));
    if (dataFechamentoRange?.from) params.append("dataFechamentoInicio", format(dataFechamentoRange.from, "yyyy-MM-dd"));
    if (dataFechamentoRange?.to) params.append("dataFechamentoFim", format(dataFechamentoRange.to, "yyyy-MM-dd"));
    if (dataLeadRange?.from) params.append("dataLeadInicio", format(dataLeadRange.from, "yyyy-MM-dd"));
    if (dataLeadRange?.to) params.append("dataLeadFim", format(dataLeadRange.to, "yyyy-MM-dd"));
    if (source && source !== "all") params.append("source", source);
    if (pipeline && pipeline !== "all") params.append("pipeline", pipeline);
    if (closerId && closerId !== "all") params.append("closerId", closerId);
    return params.toString();
  };

  const queryParams = buildQueryParams();

  const { data: closers } = useQuery<Closer[]>({
    queryKey: ["/api/closers/list"],
  });

  const { data: sources } = useQuery<string[]>({
    queryKey: ["/api/closers/sources"],
  });

  const { data: pipelines } = useQuery<string[]>({
    queryKey: ["/api/closers/pipelines"],
  });

  const { data: metrics, isLoading: isLoadingMetrics } = useQuery<CloserMetrics>({
    queryKey: ["/api/closers/metrics", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/closers/metrics?${queryParams}`);
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data: chartReunioesNegocios, isLoading: isLoadingChart1 } = useQuery<ChartDataReunioesNegocios[]>({
    queryKey: ["/api/closers/chart-reunioes-negocios", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/closers/chart-reunioes-negocios?${queryParams}`);
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data: chartReceita, isLoading: isLoadingChart2 } = useQuery<ChartDataReceita[]>({
    queryKey: ["/api/closers/chart-receita", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/closers/chart-receita?${queryParams}`);
      return res.json();
    },
    refetchInterval: 60000,
  });

  const clearFilters = () => {
    const agora = new Date();
    const inicioMesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const fimMesAtual = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);
    
    setDataReuniaoRange(undefined);
    setDataFechamentoRange({ from: inicioMesAtual, to: fimMesAtual });
    setDataLeadRange(undefined);
    setSource("all");
    setPipeline("all");
    setCloserId("all");
    setMesAtual(agora.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));
  };


  const trends: Array<'up' | 'down' | 'stable'> = ['up', 'down', 'stable'];
  
  const ranking: RankingCloser[] = (chartReceita || [])
    .map((c, idx) => {
      const reunioesData = chartReunioesNegocios?.find(r => r.closer === c.closer);
      const trend: 'up' | 'down' | 'stable' = trends[Math.floor(Math.random() * 3)];
      return {
        position: idx + 1,
        name: c.closer,
        mrr: c.mrr,
        pontual: c.pontual,
        total: c.mrr + c.pontual,
        reunioes: reunioesData?.reunioes || 0,
        negocios: reunioesData?.negociosGanhos || 0,
        taxa: reunioesData?.taxaConversao || 0,
        trend,
      };
    })
    .sort((a, b) => b.mrr - a.mrr)
    .map((c, idx) => ({ ...c, position: idx + 1 }));

  const rankingPontual: RankingCloser[] = (chartReceita || [])
    .filter(c => c.pontual > 0)
    .sort((a, b) => b.pontual - a.pontual)
    .map((c, idx) => {
      const reunioesData = chartReunioesNegocios?.find(r => r.closer === c.closer);
      return {
        position: idx + 1,
        name: c.closer,
        mrr: c.mrr,
        pontual: c.pontual,
        total: c.mrr + c.pontual,
        reunioes: reunioesData?.reunioes || 0,
        negocios: reunioesData?.negociosGanhos || 0,
        taxa: reunioesData?.taxaConversao || 0,
        trend: 'stable' as const,
      };
    });

  const top3 = ranking.slice(0, 3);
  const top3Pontual = rankingPontual.slice(0, 3);
  const restOfRanking = ranking.slice(3);

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1: return <Crown className="w-8 h-8 text-yellow-400" />;
      case 2: return <Medal className="w-7 h-7 text-gray-300" />;
      case 3: return <Medal className="w-6 h-6 text-amber-600" />;
      default: return null;
    }
  };

  const getPositionGradient = (position: number) => {
    switch (position) {
      case 1: return "from-yellow-500/20 via-amber-500/10 to-orange-500/20";
      case 2: return "from-gray-400/20 via-slate-400/10 to-gray-500/20";
      case 3: return "from-amber-700/20 via-orange-600/10 to-amber-800/20";
      default: return "from-slate-800/50 to-slate-900/50";
    }
  };

  const getPositionBorder = (position: number) => {
    switch (position) {
      case 1: return "border-yellow-500/50 shadow-yellow-500/20";
      case 2: return "border-gray-400/50 shadow-gray-400/20";
      case 3: return "border-amber-600/50 shadow-amber-600/20";
      default: return "border-border/50";
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <ChevronUp className="w-4 h-4 text-emerald-400" />;
      case 'down': return <ChevronDown className="w-4 h-4 text-rose-400" />;
      default: return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const isLoading = isLoadingMetrics || isLoadingChart1 || isLoadingChart2;

  const hasActiveFilters = dataReuniaoRange?.from || dataReuniaoRange?.to || 
    dataLeadRange?.from || dataLeadRange?.to ||
    (source && source !== "all") || 
    (pipeline && pipeline !== "all") || (closerId && closerId !== "all");

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none dark:block hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.div 
              className="relative"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 shadow-2xl shadow-violet-600/30">
                <Trophy className="w-10 h-10 text-foreground" />
              </div>
              <motion.div
                className="absolute -top-1 -right-1"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Sparkles className="w-5 h-5 text-yellow-400" />
              </motion.div>
            </motion.div>
            <div>
              <span className="text-4xl lg:text-5xl font-black bg-gradient-to-r from-white via-violet-200 to-violet-400 bg-clip-text text-transparent">
                ARENA DOS CLOSERS
              </span>
              <p className="text-muted-foreground text-lg mt-1">
                Quem será o campeão de vendas?
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-2 py-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navegarMes('anterior')}
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                data-testid="button-mes-anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              
              <div className="flex items-center gap-2 px-3 min-w-[180px] justify-center">
                <Calendar className="w-4 h-4 text-violet-400" />
                <span className="text-foreground font-semibold capitalize" data-testid="text-mes-atual">
                  {mesAtual}
                </span>
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navegarMes('proximo')}
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                data-testid="button-mes-proximo"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={irParaMesAtual}
                className="text-xs text-violet-400 hover:text-violet-300 hover:bg-muted ml-1"
                data-testid="button-mes-atual"
              >
                Hoje
              </Button>
            </div>

            <div className="text-right">
              <div className="text-2xl font-mono font-bold text-foreground">
                {currentTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div className="text-muted-foreground text-xs">
                {currentTime.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric" })}
              </div>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => navigate('/dashboard/comercial/apresentacao')}
                  className="border-violet-500/50 bg-violet-600/20 hover:bg-violet-600/40 text-violet-300"
                  data-testid="button-presentation-mode"
                >
                  <Monitor className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Modo Apresentação (TV)</p>
              </TooltipContent>
            </Tooltip>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className={`relative border-border bg-muted/50 hover:bg-muted/50 ${hasActiveFilters ? 'border-violet-500' : ''}`}
              data-testid="button-toggle-filters"
            >
              <Filter className="w-5 h-5" />
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-violet-500 rounded-full animate-pulse" />
              )}
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <Card className="bg-card border-border/50 backdrop-blur-sm" data-testid="card-filters">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Filter className="w-4 h-4" /> Filtros Independentes
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowFilters(false)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Date filters organized by metric type */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Reuniões filter */}
                      <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/30">
                        <div className="text-xs font-medium text-violet-300 mb-2 flex items-center gap-1">
                          <Handshake className="w-3 h-3" /> Reuniões Realizadas
                        </div>
                        <DateRangePicker
                          value={dataReuniaoRange}
                          onChange={setDataReuniaoRange}
                          placeholder="Selecione o período"
                          triggerClassName="h-8 bg-muted border-border text-foreground text-sm w-full min-w-0"
                          numberOfMonths={1}
                        />
                      </div>

                      {/* Negócios Fechados filter */}
                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                        <div className="text-xs font-medium text-emerald-300 mb-2 flex items-center gap-1">
                          <Target className="w-3 h-3" /> Negócios Fechados / MRR / Pontual
                        </div>
                        <DateRangePicker
                          value={dataFechamentoRange}
                          onChange={setDataFechamentoRange}
                          placeholder="Selecione o período"
                          triggerClassName="h-8 bg-muted border-border text-foreground text-sm w-full min-w-0"
                          numberOfMonths={1}
                        />
                      </div>

                      {/* Leads Criados filter */}
                      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                        <div className="text-xs font-medium text-blue-300 mb-2 flex items-center gap-1">
                          <Users className="w-3 h-3" /> Leads Criados
                        </div>
                        <DateRangePicker
                          value={dataLeadRange}
                          onChange={setDataLeadRange}
                          placeholder="Selecione o período"
                          triggerClassName="h-8 bg-muted border-border text-foreground text-sm w-full min-w-0"
                          numberOfMonths={1}
                        />
                      </div>
                    </div>

                    {/* Other filters */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Fonte</Label>
                        <Select value={source} onValueChange={setSource}>
                          <SelectTrigger className="h-8 bg-muted border-border text-foreground text-sm" data-testid="select-source">
                            <SelectValue placeholder="Todas" />
                          </SelectTrigger>
                          <SelectContent className="bg-muted border-border">
                            <SelectItem value="all">Todas</SelectItem>
                            {sources?.filter(s => s && s.trim() !== '').map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Pipeline</Label>
                        <Select value={pipeline} onValueChange={setPipeline}>
                          <SelectTrigger className="h-8 bg-muted border-border text-foreground text-sm" data-testid="select-pipeline">
                            <SelectValue placeholder="Todos" />
                          </SelectTrigger>
                          <SelectContent className="bg-muted border-border">
                            <SelectItem value="all">Todos</SelectItem>
                            {pipelines?.filter(p => p && p.trim() !== '').map((p) => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Closer</Label>
                        <Select value={closerId} onValueChange={setCloserId}>
                          <SelectTrigger className="h-8 bg-muted border-border text-foreground text-sm" data-testid="select-closer">
                            <SelectValue placeholder="Todos" />
                          </SelectTrigger>
                          <SelectContent className="bg-muted border-border">
                            <SelectItem value="all">Todos</SelectItem>
                            {closers?.filter(c => c && c.name && c.name.trim() !== '').map((c) => (
                              <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={clearFilters}
                          className="w-full h-8 border-border bg-muted hover:bg-muted text-foreground"
                          data-testid="button-clear-filters"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Limpar
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-5 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600/20 to-teal-600/10 border border-emerald-500/30 p-5"
            data-testid="card-kpi-0"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Repeat className="w-5 h-5 text-emerald-400" />
                <span className="text-sm font-medium text-emerald-300">MRR Obtido</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-emerald-300/70 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Receita Mensal Recorrente dos negócios fechados</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              {isLoading ? (
                <Skeleton className="h-10 w-32" />
              ) : (
                <motion.div 
                  className="text-3xl lg:text-4xl font-black text-foreground"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  key={metrics?.mrrObtido}
                >
                  {formatCurrencyCompact(metrics?.mrrObtido || 0)}
                </motion.div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600/20 to-indigo-600/10 border border-blue-500/30 p-5"
            data-testid="card-kpi-1"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-blue-400" />
                <span className="text-sm font-medium text-blue-300">Pontual Obtido</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-blue-300/70 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Receita pontual (não recorrente) dos negócios fechados</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              {isLoading ? (
                <Skeleton className="h-10 w-32" />
              ) : (
                <motion.div 
                  className="text-3xl lg:text-4xl font-black text-foreground"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  key={metrics?.pontualObtido}
                >
                  {formatCurrencyCompact(metrics?.pontualObtido || 0)}
                </motion.div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600/20 to-purple-600/10 border border-violet-500/30 p-5"
            data-testid="card-kpi-2"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/10 rounded-full blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-violet-400" />
                <span className="text-sm font-medium text-violet-300">Reuniões</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-violet-300/70 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Reuniões realizadas pelos closers</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              {isLoading ? (
                <Skeleton className="h-10 w-20" />
              ) : (
                <motion.div 
                  className="text-3xl lg:text-4xl font-black text-foreground"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  key={metrics?.reunioesRealizadas}
                >
                  {metrics?.reunioesRealizadas || 0}
                </motion.div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-600/20 to-orange-600/10 border border-amber-500/30 p-5"
            data-testid="card-kpi-3"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Handshake className="w-5 h-5 text-amber-400" />
                <span className="text-sm font-medium text-amber-300">Negócios</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-amber-300/70 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Quantidade de negócios fechados no período</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              {isLoading ? (
                <Skeleton className="h-10 w-20" />
              ) : (
                <motion.div 
                  className="text-3xl lg:text-4xl font-black text-foreground"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  key={metrics?.negociosGanhos}
                >
                  {metrics?.negociosGanhos || 0}
                </motion.div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-600/20 to-pink-600/10 border border-rose-500/30 p-5"
            data-testid="card-kpi-4"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-rose-400" />
                <span className="text-sm font-medium text-rose-300">Conversão</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-rose-300/70 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Negócios ganhos dividido por reuniões (%)</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              {isLoading ? (
                <Skeleton className="h-10 w-20" />
              ) : (
                <motion.div 
                  className="text-3xl lg:text-4xl font-black text-foreground"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  key={metrics?.taxaConversao}
                >
                  {formatPercent(metrics?.taxaConversao || 0)}
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-400" />
              <h2 className="text-2xl font-bold text-foreground">Pódio dos Campeões</h2>
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
              >
                <Flame className="w-5 h-5 text-orange-500" />
              </motion.div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-3 gap-4">
                {[0, 1, 2].map(i => (
                  <Skeleton key={i} className="h-64 bg-muted rounded-2xl" />
                ))}
              </div>
            ) : top3.length > 0 ? (
              <div className="grid grid-cols-3 gap-4 items-end">
                {[1, 0, 2].map((orderIndex) => {
                  const closer = top3[orderIndex];
                  if (!closer) return <div key={orderIndex} />;
                  
                  const isFirst = closer.position === 1;
                  const heights = { 0: 'h-96', 1: 'h-80', 2: 'h-72' };
                  
                  return (
                    <motion.div
                      key={closer.name}
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + orderIndex * 0.15 }}
                      className={`relative ${heights[orderIndex as keyof typeof heights]}`}
                    >
                      <div 
                        className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${getPositionGradient(closer.position)} border-2 ${getPositionBorder(closer.position)} shadow-xl backdrop-blur-sm overflow-hidden`}
                      >
                        {isFirst && (
                          <div className="absolute inset-0 overflow-hidden">
                            <motion.div
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400/10 to-transparent"
                              animate={{ x: ["-100%", "100%"] }}
                              transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                            />
                          </div>
                        )}

                        <div className="relative p-5 h-full flex flex-col">
                          <div className="flex items-center justify-between mb-4">
                            <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${
                              closer.position === 1 ? 'bg-yellow-500/20' :
                              closer.position === 2 ? 'bg-gray-400/20' : 'bg-amber-600/20'
                            }`}>
                              {getPositionIcon(closer.position)}
                            </div>
                            {getTrendIcon(closer.trend)}
                          </div>

                          <div className="flex-1">
                            <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${
                              closer.position === 1 ? 'text-yellow-400' :
                              closer.position === 2 ? 'text-gray-300' : 'text-amber-500'
                            }`}>
                              {closer.position === 1 ? 'CAMPEÃO' : 
                               closer.position === 2 ? 'VICE' : 'BRONZE'}
                            </div>
                            <h3 className="text-xl lg:text-2xl font-bold text-foreground truncate mb-3">
                              {closer.name}
                            </h3>

                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Total</span>
                                <span className="text-lg font-bold text-foreground">
                                  {formatCurrencyCompact(closer.total)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">MRR</span>
                                <span className="text-sm font-semibold text-emerald-400">
                                  {formatCurrencyCompact(closer.mrr)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Pontual</span>
                                <span className="text-sm font-semibold text-blue-400">
                                  {formatCurrencyCompact(closer.pontual)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-3 gap-2 text-center">
                            <div>
                              <div className="text-lg font-bold text-foreground">{closer.reunioes}</div>
                              <div className="text-[10px] text-muted-foreground uppercase">Reuniões</div>
                            </div>
                            <div>
                              <div className="text-lg font-bold text-foreground">{closer.negocios}</div>
                              <div className="text-[10px] text-muted-foreground uppercase">Fechados</div>
                            </div>
                            <div>
                              <div className="text-lg font-bold text-foreground">{formatPercent(closer.taxa)}</div>
                              <div className="text-[10px] text-muted-foreground uppercase">Taxa</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 rounded-2xl bg-card/50 border border-border">
                <p className="text-muted-foreground">Nenhum dado disponível</p>
              </div>
            )}
          </div>

          <div>
            <div className="mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-violet-400" />
              <h2 className="text-xl font-bold text-foreground">Ranking Completo</h2>
            </div>

            <div className="bg-card/50 backdrop-blur-sm border border-border rounded-2xl overflow-hidden">
              <div className="grid grid-cols-12 gap-1 p-3 bg-muted/50 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                <div className="col-span-1">#</div>
                <div className="col-span-3">Closer</div>
                <div className="col-span-2 text-right">MRR</div>
                <div className="col-span-2 text-right">Pontual</div>
                <div className="col-span-2 text-right">Total</div>
                <div className="col-span-2 text-right">Reuniões</div>
              </div>

              <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="p-3">
                      <Skeleton className="h-8 bg-muted" />
                    </div>
                  ))
                ) : ranking.length > 0 ? (
                  ranking.map((closer, index) => (
                    <motion.div
                      key={closer.name}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * index }}
                      className={`grid grid-cols-12 gap-1 p-3 items-center hover:bg-muted/30 transition-colors ${
                        closer.position <= 3 ? 'bg-gradient-to-r ' + getPositionGradient(closer.position) : ''
                      }`}
                      data-testid={`ranking-row-${index}`}
                    >
                      <div className="col-span-1">
                        {closer.position <= 3 ? (
                          <div className="w-5 h-5 flex items-center justify-center">
                            {closer.position === 1 && <Crown className="w-4 h-4 text-yellow-400" />}
                            {closer.position === 2 && <Medal className="w-3 h-3 text-gray-300" />}
                            {closer.position === 3 && <Medal className="w-3 h-3 text-amber-600" />}
                          </div>
                        ) : (
                          <span className="text-muted-foreground font-mono text-xs">{closer.position}</span>
                        )}
                      </div>
                      <div className="col-span-3 font-medium text-foreground truncate text-sm">
                        {closer.name}
                      </div>
                      <div className="col-span-2 text-right font-bold text-emerald-400 text-sm">
                        {formatCurrencyCompact(closer.mrr)}
                      </div>
                      <div className="col-span-2 text-right font-semibold text-blue-400 text-sm">
                        {formatCurrencyCompact(closer.pontual)}
                      </div>
                      <div className="col-span-2 text-right font-bold text-foreground text-sm">
                        {formatCurrencyCompact(closer.total)}
                      </div>
                      <div className="col-span-2 text-right text-cyan-400 text-sm">
                        {closer.reunioes}
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    Nenhum closer encontrado
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* DESTAQUE PONTUAL - Compact horizontal display */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div className="mb-3 flex items-center gap-2">
            <Star className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold text-foreground">Destaque Pontual</h2>
            <Badge className="bg-blue-500/20 text-blue-400 text-xs">Top Vendas Pontuais</Badge>
          </div>

          <div className="bg-card/50 backdrop-blur-sm border border-border rounded-2xl overflow-hidden">
            {isLoading ? (
              <div className="p-4 flex gap-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 flex-1 bg-muted rounded-xl" />
                ))}
              </div>
            ) : top3Pontual.length > 0 ? (
              <div className="flex divide-x divide-border">
                {top3Pontual.map((closer, index) => (
                  <motion.div
                    key={closer.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * index }}
                    className={`flex-1 p-4 flex items-center gap-3 ${
                      index === 0 ? 'bg-gradient-to-r from-blue-500/20 to-transparent' : ''
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      index === 0 ? 'bg-blue-500/30' :
                      index === 1 ? 'bg-muted/30' :
                      'bg-amber-600/30'
                    }`}>
                      {index === 0 && <Crown className="w-5 h-5 text-blue-400" />}
                      {index === 1 && <Medal className="w-4 h-4 text-gray-300" />}
                      {index === 2 && <Medal className="w-4 h-4 text-amber-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground truncate text-sm">{closer.name}</div>
                      <div className="text-xs text-muted-foreground">{closer.negocios} neg. pontuais</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-bold text-blue-400">{formatCurrencyCompact(closer.pontual)}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-muted-foreground">
                Nenhuma venda pontual no período
              </div>
            )}
          </div>
        </motion.div>

        {/* BARRA DE META ÉPICA */}
        <motion.div 
          className="mt-8 relative"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-card via-muted to-card border border-border/50 p-8">
            {/* Background effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-20 -left-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl" />
              {(() => {
                const META_MRR = 180000;
                const mrrAtual = metrics?.mrrObtido || 0;
                const percentual = Math.min((mrrAtual / META_MRR) * 100, 100);
                
                if (percentual >= 100) {
                  return (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-yellow-500/10 to-emerald-500/5"
                      animate={{ opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  );
                }
                return null;
              })()}
            </div>

            <div className="relative z-10">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <motion.div 
                    className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Target className="w-8 h-8 text-foreground" />
                  </motion.div>
                  <div>
                    <h2 className="text-3xl font-black text-foreground">META DO MÊS</h2>
                    <p className="text-muted-foreground text-lg">Receita Recorrente (MRR)</p>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Meta</div>
                  <div className="text-4xl font-black text-foreground">R$ 180k</div>
                </div>
              </div>

              {/* Progress Bar */}
              {(() => {
                const META_MRR = 180000;
                const mrrAtual = metrics?.mrrObtido || 0;
                const percentual = Math.min((mrrAtual / META_MRR) * 100, 100);
                const faltam = Math.max(META_MRR - mrrAtual, 0);
                const atingida = percentual >= 100;
                
                return (
                  <>
                    <div className="relative h-16 bg-muted/80 rounded-2xl overflow-hidden border border-border/50">
                      {/* Progress fill */}
                      <motion.div
                        className={`absolute inset-y-0 left-0 rounded-2xl ${
                          atingida 
                            ? 'bg-gradient-to-r from-emerald-500 via-yellow-400 to-emerald-500'
                            : percentual >= 80 
                              ? 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400'
                              : percentual >= 50
                                ? 'bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-400'
                                : 'bg-gradient-to-r from-rose-600 via-rose-500 to-orange-400'
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${percentual}%` }}
                        transition={{ duration: 2, ease: "easeOut", delay: 0.3 }}
                      >
                        {/* Shimmer effect */}
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                          animate={{ x: ["-100%", "100%"] }}
                          transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                        />
                      </motion.div>
                      
                      {/* Percentage display in bar */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <motion.span 
                          className="text-3xl font-black text-foreground drop-shadow-lg"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 1.5, type: "spring", stiffness: 200 }}
                        >
                          {formatPercent(percentual)}
                        </motion.span>
                      </div>

                      {/* Milestone markers */}
                      {[25, 50, 75, 100].map((milestone) => (
                        <div
                          key={milestone}
                          className="absolute top-0 bottom-0 w-px bg-border/50"
                          style={{ left: `${milestone}%` }}
                        />
                      ))}
                    </div>

                    {/* Stats below bar */}
                    <div className="flex items-center justify-between mt-6">
                      <div className="flex items-center gap-8">
                        <div>
                          <div className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Conquistado</div>
                          <motion.div 
                            className="text-4xl font-black text-emerald-400"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.8 }}
                          >
                            {formatCurrencyCompact(mrrAtual)}
                          </motion.div>
                        </div>
                        
                        {!atingida && (
                          <div>
                            <div className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Faltam</div>
                            <motion.div 
                              className="text-4xl font-black text-amber-400"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 1 }}
                            >
                              {formatCurrencyCompact(faltam)}
                            </motion.div>
                          </div>
                        )}
                      </div>

                      {/* Status badge */}
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 1.2, type: "spring" }}
                      >
                        {atingida ? (
                          <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30">
                            <motion.div
                              animate={{ rotate: [0, 10, -10, 0] }}
                              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                            >
                              <Trophy className="w-8 h-8 text-yellow-400" />
                            </motion.div>
                            <span className="text-2xl font-black text-emerald-400">META BATIDA!</span>
                            <motion.div
                              animate={{ scale: [1, 1.3, 1] }}
                              transition={{ duration: 1, repeat: Infinity }}
                            >
                              <Sparkles className="w-6 h-6 text-yellow-400" />
                            </motion.div>
                          </div>
                        ) : percentual >= 80 ? (
                          <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30">
                            <Flame className="w-6 h-6 text-orange-400" />
                            <span className="text-xl font-bold text-emerald-400">Quase lá!</span>
                          </div>
                        ) : percentual >= 50 ? (
                          <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-amber-500/20 border border-amber-500/30">
                            <TrendingUp className="w-6 h-6 text-amber-400" />
                            <span className="text-xl font-bold text-amber-400">Bom progresso!</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-rose-500/20 border border-rose-500/30">
                            <Zap className="w-6 h-6 text-rose-400" />
                            <span className="text-xl font-bold text-rose-400">Hora de acelerar!</span>
                          </div>
                        )}
                      </motion.div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-4">
            <p className="text-sm text-muted-foreground">
              Atualizado automaticamente a cada minuto
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
