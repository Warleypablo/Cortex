import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
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
  Calendar
} from "lucide-react";

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
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];

  const [dataReuniaoInicio, setDataReuniaoInicio] = useState<string>("");
  const [dataReuniaoFim, setDataReuniaoFim] = useState<string>("");
  const [dataFechamentoInicio, setDataFechamentoInicio] = useState<string>(inicioMes);
  const [dataFechamentoFim, setDataFechamentoFim] = useState<string>(fimMes);
  const [dataLeadInicio, setDataLeadInicio] = useState<string>("");
  const [dataLeadFim, setDataLeadFim] = useState<string>("");
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
    const dataAtual = new Date(dataFechamentoInicio + 'T00:00:00');
    const novoMes = direcao === 'anterior' 
      ? new Date(dataAtual.getFullYear(), dataAtual.getMonth() - 1, 1)
      : new Date(dataAtual.getFullYear(), dataAtual.getMonth() + 1, 1);
    
    const inicioNovoMes = new Date(novoMes.getFullYear(), novoMes.getMonth(), 1).toISOString().split('T')[0];
    const fimNovoMes = new Date(novoMes.getFullYear(), novoMes.getMonth() + 1, 0).toISOString().split('T')[0];
    
    setDataFechamentoInicio(inicioNovoMes);
    setDataFechamentoFim(fimNovoMes);
    setMesAtual(novoMes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));
  };

  const irParaMesAtual = () => {
    const agora = new Date();
    const inicioMesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString().split('T')[0];
    const fimMesAtual = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).toISOString().split('T')[0];
    
    setDataFechamentoInicio(inicioMesAtual);
    setDataFechamentoFim(fimMesAtual);
    setMesAtual(agora.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));
  };

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (dataReuniaoInicio) params.append("dataReuniaoInicio", dataReuniaoInicio);
    if (dataReuniaoFim) params.append("dataReuniaoFim", dataReuniaoFim);
    if (dataFechamentoInicio) params.append("dataFechamentoInicio", dataFechamentoInicio);
    if (dataFechamentoFim) params.append("dataFechamentoFim", dataFechamentoFim);
    if (dataLeadInicio) params.append("dataLeadInicio", dataLeadInicio);
    if (dataLeadFim) params.append("dataLeadFim", dataLeadFim);
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
    const inicioMesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString().split('T')[0];
    const fimMesAtual = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).toISOString().split('T')[0];
    
    setDataReuniaoInicio("");
    setDataReuniaoFim("");
    setDataFechamentoInicio(inicioMesAtual);
    setDataFechamentoFim(fimMesAtual);
    setDataLeadInicio("");
    setDataLeadFim("");
    setSource("all");
    setPipeline("all");
    setCloserId("all");
    setMesAtual(agora.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCurrencyCompact = (value: number) => {
    if (value >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(0)}k`;
    }
    return formatCurrency(value);
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
    .sort((a, b) => b.total - a.total)
    .map((c, idx) => ({ ...c, position: idx + 1 }));

  const top3 = ranking.slice(0, 3);
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
      default: return "border-slate-700/50";
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <ChevronUp className="w-4 h-4 text-emerald-400" />;
      case 'down': return <ChevronDown className="w-4 h-4 text-rose-400" />;
      default: return <Minus className="w-4 h-4 text-slate-400" />;
    }
  };

  const isLoading = isLoadingMetrics || isLoadingChart1 || isLoadingChart2;

  const hasActiveFilters = dataReuniaoInicio || dataReuniaoFim || 
    dataLeadInicio || dataLeadFim ||
    (source && source !== "all") || 
    (pipeline && pipeline !== "all") || (closerId && closerId !== "all");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
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
                <Trophy className="w-10 h-10 text-white" />
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
              <h1 className="text-4xl lg:text-5xl font-black bg-gradient-to-r from-white via-violet-200 to-violet-400 bg-clip-text text-transparent" data-testid="text-page-title">
                ARENA DOS CLOSERS
              </h1>
              <p className="text-slate-400 text-lg mt-1">
                Quem será o campeão de vendas?
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-xl px-2 py-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navegarMes('anterior')}
                className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-700"
                data-testid="button-mes-anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              
              <div className="flex items-center gap-2 px-3 min-w-[180px] justify-center">
                <Calendar className="w-4 h-4 text-violet-400" />
                <span className="text-white font-semibold capitalize" data-testid="text-mes-atual">
                  {mesAtual}
                </span>
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navegarMes('proximo')}
                className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-700"
                data-testid="button-mes-proximo"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={irParaMesAtual}
                className="text-xs text-violet-400 hover:text-violet-300 hover:bg-slate-700 ml-1"
                data-testid="button-mes-atual"
              >
                Hoje
              </Button>
            </div>

            <div className="text-right">
              <div className="text-2xl font-mono font-bold text-white">
                {currentTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div className="text-slate-400 text-xs">
                {currentTime.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric" })}
              </div>
            </div>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className={`relative border-slate-700 bg-slate-800/50 hover:bg-slate-700/50 ${hasActiveFilters ? 'border-violet-500' : ''}`}
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
              <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm" data-testid="card-filters">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <Filter className="w-4 h-4" /> Filtros Independentes
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowFilters(false)}
                      className="text-slate-400 hover:text-white"
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
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-400">Início</Label>
                            <Input
                              type="date"
                              value={dataReuniaoInicio}
                              onChange={(e) => setDataReuniaoInicio(e.target.value)}
                              className="h-8 bg-slate-800 border-slate-700 text-white text-sm"
                              data-testid="input-data-reuniao-inicio"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-400">Fim</Label>
                            <Input
                              type="date"
                              value={dataReuniaoFim}
                              onChange={(e) => setDataReuniaoFim(e.target.value)}
                              className="h-8 bg-slate-800 border-slate-700 text-white text-sm"
                              data-testid="input-data-reuniao-fim"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Negócios Fechados filter */}
                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                        <div className="text-xs font-medium text-emerald-300 mb-2 flex items-center gap-1">
                          <Target className="w-3 h-3" /> Negócios Fechados / MRR / Pontual
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-400">Início</Label>
                            <Input
                              type="date"
                              value={dataFechamentoInicio}
                              onChange={(e) => setDataFechamentoInicio(e.target.value)}
                              className="h-8 bg-slate-800 border-slate-700 text-white text-sm"
                              data-testid="input-data-fechamento-inicio"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-400">Fim</Label>
                            <Input
                              type="date"
                              value={dataFechamentoFim}
                              onChange={(e) => setDataFechamentoFim(e.target.value)}
                              className="h-8 bg-slate-800 border-slate-700 text-white text-sm"
                              data-testid="input-data-fechamento-fim"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Leads Criados filter */}
                      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                        <div className="text-xs font-medium text-blue-300 mb-2 flex items-center gap-1">
                          <Users className="w-3 h-3" /> Leads Criados
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-400">Início</Label>
                            <Input
                              type="date"
                              value={dataLeadInicio}
                              onChange={(e) => setDataLeadInicio(e.target.value)}
                              className="h-8 bg-slate-800 border-slate-700 text-white text-sm"
                              data-testid="input-data-lead-inicio"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-400">Fim</Label>
                            <Input
                              type="date"
                              value={dataLeadFim}
                              onChange={(e) => setDataLeadFim(e.target.value)}
                              className="h-8 bg-slate-800 border-slate-700 text-white text-sm"
                              data-testid="input-data-lead-fim"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Other filters */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-400">Fonte</Label>
                        <Select value={source} onValueChange={setSource}>
                          <SelectTrigger className="h-8 bg-slate-800 border-slate-700 text-white text-sm" data-testid="select-source">
                            <SelectValue placeholder="Todas" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            <SelectItem value="all">Todas</SelectItem>
                            {sources?.filter(s => s && s.trim() !== '').map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-400">Pipeline</Label>
                        <Select value={pipeline} onValueChange={setPipeline}>
                          <SelectTrigger className="h-8 bg-slate-800 border-slate-700 text-white text-sm" data-testid="select-pipeline">
                            <SelectValue placeholder="Todos" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            <SelectItem value="all">Todos</SelectItem>
                            {pipelines?.filter(p => p && p.trim() !== '').map((p) => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-400">Closer</Label>
                        <Select value={closerId} onValueChange={setCloserId}>
                          <SelectTrigger className="h-8 bg-slate-800 border-slate-700 text-white text-sm" data-testid="select-closer">
                            <SelectValue placeholder="Todos" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
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
                          className="w-full h-8 border-slate-700 bg-slate-800 hover:bg-slate-700 text-white"
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
              </div>
              {isLoading ? (
                <Skeleton className="h-10 w-32 bg-slate-700" />
              ) : (
                <motion.div 
                  className="text-3xl lg:text-4xl font-black text-white"
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
              </div>
              {isLoading ? (
                <Skeleton className="h-10 w-32 bg-slate-700" />
              ) : (
                <motion.div 
                  className="text-3xl lg:text-4xl font-black text-white"
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
              </div>
              {isLoading ? (
                <Skeleton className="h-10 w-20 bg-slate-700" />
              ) : (
                <motion.div 
                  className="text-3xl lg:text-4xl font-black text-white"
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
              </div>
              {isLoading ? (
                <Skeleton className="h-10 w-20 bg-slate-700" />
              ) : (
                <motion.div 
                  className="text-3xl lg:text-4xl font-black text-white"
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
              </div>
              {isLoading ? (
                <Skeleton className="h-10 w-20 bg-slate-700" />
              ) : (
                <motion.div 
                  className="text-3xl lg:text-4xl font-black text-white"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  key={metrics?.taxaConversao}
                >
                  {(metrics?.taxaConversao || 0).toFixed(1)}%
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-400" />
              <h2 className="text-2xl font-bold text-white">Pódio dos Campeões</h2>
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
                  <Skeleton key={i} className="h-64 bg-slate-800 rounded-2xl" />
                ))}
              </div>
            ) : top3.length > 0 ? (
              <div className="grid grid-cols-3 gap-4 items-end">
                {[1, 0, 2].map((orderIndex) => {
                  const closer = top3[orderIndex];
                  if (!closer) return <div key={orderIndex} />;
                  
                  const isFirst = closer.position === 1;
                  const heights = { 0: 'h-80', 1: 'h-64', 2: 'h-56' };
                  
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
                            <h3 className="text-xl lg:text-2xl font-bold text-white truncate mb-3">
                              {closer.name}
                            </h3>

                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-400">Total</span>
                                <span className="text-lg font-bold text-white">
                                  {formatCurrencyCompact(closer.total)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-400">MRR</span>
                                <span className="text-sm font-semibold text-emerald-400">
                                  {formatCurrencyCompact(closer.mrr)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-400">Pontual</span>
                                <span className="text-sm font-semibold text-blue-400">
                                  {formatCurrencyCompact(closer.pontual)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 pt-4 border-t border-slate-700/50 grid grid-cols-3 gap-2 text-center">
                            <div>
                              <div className="text-lg font-bold text-white">{closer.reunioes}</div>
                              <div className="text-[10px] text-slate-400 uppercase">Reuniões</div>
                            </div>
                            <div>
                              <div className="text-lg font-bold text-white">{closer.negocios}</div>
                              <div className="text-[10px] text-slate-400 uppercase">Fechados</div>
                            </div>
                            <div>
                              <div className="text-lg font-bold text-white">{closer.taxa.toFixed(0)}%</div>
                              <div className="text-[10px] text-slate-400 uppercase">Taxa</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 rounded-2xl bg-slate-900/50 border border-slate-800">
                <p className="text-slate-400">Nenhum dado disponível</p>
              </div>
            )}
          </div>

          <div>
            <div className="mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-violet-400" />
              <h2 className="text-xl font-bold text-white">Ranking Completo</h2>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-12 gap-2 p-3 bg-slate-800/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <div className="col-span-1">#</div>
                <div className="col-span-5">Closer</div>
                <div className="col-span-3 text-right">Total</div>
                <div className="col-span-2 text-right">Taxa</div>
                <div className="col-span-1"></div>
              </div>

              <div className="divide-y divide-slate-800/50 max-h-[400px] overflow-y-auto">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="p-3">
                      <Skeleton className="h-8 bg-slate-800" />
                    </div>
                  ))
                ) : ranking.length > 0 ? (
                  ranking.map((closer, index) => (
                    <motion.div
                      key={closer.name}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * index }}
                      className={`grid grid-cols-12 gap-2 p-3 items-center hover:bg-slate-800/30 transition-colors ${
                        closer.position <= 3 ? 'bg-gradient-to-r ' + getPositionGradient(closer.position) : ''
                      }`}
                      data-testid={`ranking-row-${index}`}
                    >
                      <div className="col-span-1">
                        {closer.position <= 3 ? (
                          <div className="w-6 h-6 flex items-center justify-center">
                            {closer.position === 1 && <Crown className="w-5 h-5 text-yellow-400" />}
                            {closer.position === 2 && <Medal className="w-4 h-4 text-gray-300" />}
                            {closer.position === 3 && <Medal className="w-4 h-4 text-amber-600" />}
                          </div>
                        ) : (
                          <span className="text-slate-500 font-mono text-sm">{closer.position}</span>
                        )}
                      </div>
                      <div className="col-span-5 font-medium text-white truncate">
                        {closer.name}
                      </div>
                      <div className="col-span-3 text-right font-bold text-white">
                        {formatCurrencyCompact(closer.total)}
                      </div>
                      <div className="col-span-2 text-right">
                        <Badge 
                          variant="outline" 
                          className={`text-xs border-0 ${
                            closer.taxa >= 30 ? 'bg-emerald-500/20 text-emerald-400' :
                            closer.taxa >= 15 ? 'bg-amber-500/20 text-amber-400' :
                            'bg-slate-700/50 text-slate-400'
                          }`}
                        >
                          {closer.taxa.toFixed(0)}%
                        </Badge>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        {getTrendIcon(closer.trend)}
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="p-8 text-center text-slate-400">
                    Nenhum closer encontrado
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* BARRA DE META ÉPICA */}
        <motion.div 
          className="mt-8 relative"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 p-8">
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
                    <Target className="w-8 h-8 text-white" />
                  </motion.div>
                  <div>
                    <h2 className="text-3xl font-black text-white">META DO MÊS</h2>
                    <p className="text-slate-400 text-lg">Receita Recorrente (MRR)</p>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-sm text-slate-400 uppercase tracking-wider mb-1">Meta</div>
                  <div className="text-4xl font-black text-white">R$ 180k</div>
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
                    <div className="relative h-16 bg-slate-800/80 rounded-2xl overflow-hidden border border-slate-700/50">
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
                          className="text-3xl font-black text-white drop-shadow-lg"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 1.5, type: "spring", stiffness: 200 }}
                        >
                          {percentual.toFixed(1)}%
                        </motion.span>
                      </div>

                      {/* Milestone markers */}
                      {[25, 50, 75, 100].map((milestone) => (
                        <div
                          key={milestone}
                          className="absolute top-0 bottom-0 w-px bg-slate-600/50"
                          style={{ left: `${milestone}%` }}
                        />
                      ))}
                    </div>

                    {/* Stats below bar */}
                    <div className="flex items-center justify-between mt-6">
                      <div className="flex items-center gap-8">
                        <div>
                          <div className="text-sm text-slate-400 uppercase tracking-wider mb-1">Conquistado</div>
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
                            <div className="text-sm text-slate-400 uppercase tracking-wider mb-1">Faltam</div>
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
            <p className="text-sm text-slate-500">
              Atualizado automaticamente a cada minuto
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
