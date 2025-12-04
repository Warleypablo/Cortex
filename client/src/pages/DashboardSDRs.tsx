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
  Phone, 
  CalendarCheck, 
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
  X,
  Calendar,
  Headphones,
  Bell
} from "lucide-react";
import { DealCelebration, useDealCelebrationTrigger } from "@/components/DealCelebration";

interface SDRMetrics {
  leadsTotais: number;
  reunioesRealizadas: number;
  taxaConversao: number;
}

interface SDR {
  id: number;
  name: string;
  email: string | null;
  active: boolean;
}

interface ChartDataReunioes {
  sdr: string;
  sdrId: number;
  leads: number;
  reunioesRealizadas: number;
  conversao: number;
}

interface RankingSDR {
  position: number;
  name: string;
  leads: number;
  reunioesRealizadas: number;
  conversao: number;
  trend: 'up' | 'down' | 'stable';
}

export default function DashboardSDRs() {
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];

  const [dataReuniaoInicio, setDataReuniaoInicio] = useState<string>(inicioMes);
  const [dataReuniaoFim, setDataReuniaoFim] = useState<string>(fimMes);
  const [dataLeadInicio, setDataLeadInicio] = useState<string>("");
  const [dataLeadFim, setDataLeadFim] = useState<string>("");
  const [source, setSource] = useState<string>("all");
  const [pipeline, setPipeline] = useState<string>("all");
  const [sdrId, setSdrId] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mesAtual, setMesAtual] = useState<string>(
    hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  );

  const { triggerTest } = useDealCelebrationTrigger();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const navegarMes = (direcao: 'anterior' | 'proximo') => {
    const dataAtual = new Date(dataReuniaoInicio + 'T00:00:00');
    const novoMes = direcao === 'anterior' 
      ? new Date(dataAtual.getFullYear(), dataAtual.getMonth() - 1, 1)
      : new Date(dataAtual.getFullYear(), dataAtual.getMonth() + 1, 1);
    
    const inicioNovoMes = new Date(novoMes.getFullYear(), novoMes.getMonth(), 1).toISOString().split('T')[0];
    const fimNovoMes = new Date(novoMes.getFullYear(), novoMes.getMonth() + 1, 0).toISOString().split('T')[0];
    
    setDataReuniaoInicio(inicioNovoMes);
    setDataReuniaoFim(fimNovoMes);
    setMesAtual(novoMes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));
  };

  const irParaMesAtual = () => {
    const agora = new Date();
    const inicioMesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString().split('T')[0];
    const fimMesAtual = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).toISOString().split('T')[0];
    
    setDataReuniaoInicio(inicioMesAtual);
    setDataReuniaoFim(fimMesAtual);
    setMesAtual(agora.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));
  };

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (dataReuniaoInicio) params.append("dataReuniaoInicio", dataReuniaoInicio);
    if (dataReuniaoFim) params.append("dataReuniaoFim", dataReuniaoFim);
    if (dataLeadInicio) params.append("dataLeadInicio", dataLeadInicio);
    if (dataLeadFim) params.append("dataLeadFim", dataLeadFim);
    if (source && source !== "all") params.append("source", source);
    if (pipeline && pipeline !== "all") params.append("pipeline", pipeline);
    if (sdrId && sdrId !== "all") params.append("sdrId", sdrId);
    return params.toString();
  };

  const queryParams = buildQueryParams();

  const { data: sdrs } = useQuery<SDR[]>({
    queryKey: ["/api/sdrs/list"],
  });

  const { data: sources } = useQuery<string[]>({
    queryKey: ["/api/sdrs/sources"],
  });

  const { data: pipelines } = useQuery<string[]>({
    queryKey: ["/api/sdrs/pipelines"],
  });

  const { data: metrics, isLoading: isLoadingMetrics } = useQuery<SDRMetrics>({
    queryKey: ["/api/sdrs/metrics", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/sdrs/metrics?${queryParams}`);
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data: chartReunioes, isLoading: isLoadingChart } = useQuery<ChartDataReunioes[]>({
    queryKey: ["/api/sdrs/chart-reunioes", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/sdrs/chart-reunioes?${queryParams}`);
      return res.json();
    },
    refetchInterval: 60000,
  });

  const clearFilters = () => {
    const agora = new Date();
    const inicioMesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString().split('T')[0];
    const fimMesAtual = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).toISOString().split('T')[0];
    
    setDataReuniaoInicio(inicioMesAtual);
    setDataReuniaoFim(fimMesAtual);
    setDataLeadInicio("");
    setDataLeadFim("");
    setSource("all");
    setPipeline("all");
    setSdrId("all");
    setMesAtual(agora.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));
  };

  const META_REUNIOES = 100;

  const trends: Array<'up' | 'down' | 'stable'> = ['up', 'down', 'stable'];
  
  const ranking: RankingSDR[] = (chartReunioes || [])
    .map((c, idx) => {
      const trend: 'up' | 'down' | 'stable' = trends[Math.floor(Math.random() * 3)];
      return {
        position: idx + 1,
        name: c.sdr,
        leads: c.leads,
        reunioesRealizadas: c.reunioesRealizadas,
        conversao: c.conversao,
        trend,
      };
    })
    .sort((a, b) => b.reunioesRealizadas - a.reunioesRealizadas)
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

  const isLoading = isLoadingMetrics || isLoadingChart;

  const hasActiveFilters = (source && source !== "all") || 
    (pipeline && pipeline !== "all") || (sdrId && sdrId !== "all");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-teal-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.div 
              className="relative"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-600 to-teal-700 shadow-2xl shadow-cyan-600/30">
                <Headphones className="w-10 h-10 text-white" />
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
              <h1 className="text-4xl lg:text-5xl font-black bg-gradient-to-r from-white via-cyan-200 to-cyan-400 bg-clip-text text-transparent" data-testid="text-page-title">
                ARENA DOS SDRs
              </h1>
              <p className="text-slate-400 text-lg mt-1">
                Quem agendará mais reuniões?
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
                <Calendar className="w-4 h-4 text-cyan-400" />
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
                className="text-xs text-cyan-400 hover:text-cyan-300 hover:bg-slate-700 ml-1"
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
              className={`relative border-slate-700 bg-slate-800/50 hover:bg-slate-700/50 ${hasActiveFilters ? 'border-cyan-500' : ''}`}
              data-testid="button-toggle-filters"
            >
              <Filter className="w-5 h-5" />
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-500 rounded-full animate-pulse" />
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Reuniões filter */}
                      <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                        <div className="text-xs font-medium text-cyan-300 mb-2 flex items-center gap-1">
                          <CalendarCheck className="w-3 h-3" /> Reuniões Realizadas
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
                        <Label className="text-xs text-slate-400">Origem</Label>
                        <Select value={source} onValueChange={setSource}>
                          <SelectTrigger className="h-8 bg-slate-800 border-slate-700 text-white text-sm" data-testid="select-source">
                            <SelectValue placeholder="Todas" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            <SelectItem value="all">Todas</SelectItem>
                            {sources?.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-400">Pipeline</Label>
                        <Select value={pipeline} onValueChange={setPipeline}>
                          <SelectTrigger className="h-8 bg-slate-800 border-slate-700 text-white text-sm" data-testid="select-pipeline">
                            <SelectValue placeholder="Todas" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            <SelectItem value="all">Todas</SelectItem>
                            {pipelines?.map((p) => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-400">SDR</Label>
                        <Select value={sdrId} onValueChange={setSdrId}>
                          <SelectTrigger className="h-8 bg-slate-800 border-slate-700 text-white text-sm" data-testid="select-sdr">
                            <SelectValue placeholder="Todos" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            <SelectItem value="all">Todos</SelectItem>
                            {sdrs?.filter(s => s.active).map((s) => (
                              <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={clearFilters}
                          className="h-8 border-slate-700 text-slate-300 hover:bg-slate-700 w-full"
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

        <div className="grid grid-cols-3 gap-4">
          {[
            { 
              label: "Leads Criados", 
              value: metrics?.leadsTotais || 0, 
              icon: Users,
              gradient: "from-blue-600 to-indigo-600",
              format: (v: number) => v.toString()
            },
            { 
              label: "Reuniões Realizadas", 
              value: metrics?.reunioesRealizadas || 0, 
              icon: CalendarCheck,
              gradient: "from-cyan-600 to-teal-600",
              format: (v: number) => v.toString()
            },
            { 
              label: "Taxa de Conversão", 
              value: metrics?.taxaConversao || 0, 
              icon: TrendingUp,
              gradient: "from-emerald-600 to-green-600",
              format: (v: number) => `${v.toFixed(1)}%`
            },
          ].map((kpi, index) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
            >
              <div className="relative overflow-hidden rounded-2xl bg-slate-900/60 backdrop-blur-sm border border-slate-800 p-5">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br opacity-10 rounded-full -translate-y-1/2 translate-x-1/2"
                     style={{ backgroundImage: `linear-gradient(to bottom right, var(--tw-gradient-stops))` }} />
                
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br ${kpi.gradient} shadow-lg`}>
                    <kpi.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-sm font-medium text-slate-400">{kpi.label}</span>
                </div>
                
                {isLoading ? (
                  <Skeleton className="h-10 w-32 bg-slate-800" />
                ) : (
                  <motion.div
                    className="text-4xl font-black text-white"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.2 + 0.1 * index }}
                    data-testid={`kpi-value-${index}`}
                  >
                    {kpi.format(kpi.value)}
                  </motion.div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <h2 className="text-xl font-bold text-white">Pódio dos Campeões</h2>
              <motion.div
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }}
              >
                <Flame className="w-5 h-5 text-orange-500" />
              </motion.div>
            </div>
            
            {isLoading ? (
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-64 rounded-2xl bg-slate-800" />
                ))}
              </div>
            ) : top3.length > 0 ? (
              <div className="flex items-end justify-center gap-4 h-[380px]">
                {[1, 0, 2].map((dataIndex, visualIndex) => {
                  const sdr = top3[dataIndex];
                  if (!sdr) return null;
                  
                  const heights = ['h-72', 'h-80', 'h-64'];
                  const sizes = ['text-3xl', 'text-4xl', 'text-2xl'];
                  const badges = ['VICE', 'CAMPEÃO', 'BRONZE'];
                  const badgeColors = ['bg-gray-500', 'bg-gradient-to-r from-yellow-500 to-amber-500', 'bg-amber-700'];
                  
                  return (
                    <motion.div
                      key={sdr.name}
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + visualIndex * 0.1 }}
                      className={`relative ${heights[visualIndex]} w-56 flex flex-col`}
                    >
                      <div className={`flex-1 rounded-2xl bg-gradient-to-b ${getPositionGradient(sdr.position)} border-2 ${getPositionBorder(sdr.position)} shadow-xl p-4 flex flex-col justify-between backdrop-blur-sm`}>
                        <div>
                          {sdr.position === 1 && (
                            <motion.div 
                              className="flex justify-center mb-2"
                              animate={{ y: [0, -5, 0] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            >
                              <Crown className="w-10 h-10 text-yellow-400 drop-shadow-lg" />
                            </motion.div>
                          )}
                          
                          <Badge className={`${badgeColors[visualIndex]} text-white text-xs mb-2 font-bold`}>
                            {badges[visualIndex]}
                          </Badge>
                          
                          <h3 className={`${sizes[visualIndex]} font-black text-white mb-1 leading-tight`}>
                            {sdr.name.split(' ').slice(0, 2).join(' ')}
                          </h3>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400 text-sm">Reuniões</span>
                            <span className="text-2xl font-black text-cyan-400">
                              {sdr.reunioesRealizadas}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400 text-xs">Leads</span>
                            <span className="text-sm font-semibold text-blue-400">
                              {sdr.leads}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400 text-xs">Conversão</span>
                            <span className="text-sm font-semibold text-emerald-400">
                              {sdr.conversao.toFixed(1)}%
                            </span>
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
              <Zap className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl font-bold text-white">Ranking Completo</h2>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-12 gap-2 p-3 bg-slate-800/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <div className="col-span-1">#</div>
                <div className="col-span-4">SDR</div>
                <div className="col-span-2 text-right">Leads</div>
                <div className="col-span-2 text-right">Reuniões</div>
                <div className="col-span-2 text-right">Conversão</div>
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
                  ranking.map((sdr, index) => (
                    <motion.div
                      key={sdr.name}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * index }}
                      className={`grid grid-cols-12 gap-2 p-3 items-center hover:bg-slate-800/30 transition-colors ${
                        sdr.position <= 3 ? 'bg-gradient-to-r ' + getPositionGradient(sdr.position) : ''
                      }`}
                      data-testid={`ranking-row-${index}`}
                    >
                      <div className="col-span-1">
                        {sdr.position <= 3 ? (
                          <div className="w-6 h-6 flex items-center justify-center">
                            {sdr.position === 1 && <Crown className="w-5 h-5 text-yellow-400" />}
                            {sdr.position === 2 && <Medal className="w-4 h-4 text-gray-300" />}
                            {sdr.position === 3 && <Medal className="w-4 h-4 text-amber-600" />}
                          </div>
                        ) : (
                          <span className="text-slate-500 font-mono text-sm">{sdr.position}</span>
                        )}
                      </div>
                      <div className="col-span-4 font-medium text-white truncate">
                        {sdr.name}
                      </div>
                      <div className="col-span-2 text-right text-blue-400">
                        {sdr.leads}
                      </div>
                      <div className="col-span-2 text-right font-bold text-cyan-400">
                        {sdr.reunioesRealizadas}
                      </div>
                      <div className="col-span-2 text-right">
                        <Badge 
                          variant="outline" 
                          className={`text-xs border-0 ${
                            sdr.conversao >= 30 ? 'bg-emerald-500/20 text-emerald-400' :
                            sdr.conversao >= 15 ? 'bg-amber-500/20 text-amber-400' :
                            'bg-slate-700/50 text-slate-400'
                          }`}
                        >
                          {sdr.conversao.toFixed(1)}%
                        </Badge>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        {getTrendIcon(sdr.trend)}
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="p-8 text-center text-slate-400">
                    Nenhum SDR encontrado
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
              <div className="absolute -top-20 -left-20 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl" />
              {(() => {
                const reunioesAtual = metrics?.reunioesRealizadas || 0;
                const percentual = Math.min((reunioesAtual / META_REUNIOES) * 100, 100);
                
                if (percentual >= 100) {
                  return (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-yellow-500/10 to-cyan-500/5"
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
                    className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 shadow-lg shadow-cyan-500/30"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Target className="w-8 h-8 text-white" />
                  </motion.div>
                  <div>
                    <h2 className="text-3xl font-black text-white">META DO MÊS</h2>
                    <p className="text-slate-400 text-lg">Reuniões Realizadas</p>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-sm text-slate-400 uppercase tracking-wider mb-1">Meta</div>
                  <div className="text-4xl font-black text-white">{META_REUNIOES} reuniões</div>
                </div>
              </div>

              {/* Progress Bar */}
              {(() => {
                const reunioesAtual = metrics?.reunioesRealizadas || 0;
                const percentual = Math.min((reunioesAtual / META_REUNIOES) * 100, 100);
                const faltam = Math.max(META_REUNIOES - reunioesAtual, 0);
                const atingida = percentual >= 100;
                
                return (
                  <>
                    <div className="relative h-16 bg-slate-800/80 rounded-2xl overflow-hidden border border-slate-700/50">
                      {/* Progress fill */}
                      <motion.div
                        className={`absolute inset-y-0 left-0 rounded-2xl ${
                          atingida 
                            ? 'bg-gradient-to-r from-cyan-500 via-yellow-400 to-cyan-500'
                            : percentual >= 80 
                              ? 'bg-gradient-to-r from-cyan-600 via-cyan-500 to-teal-400'
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
                            className="text-4xl font-black text-cyan-400"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.8 }}
                          >
                            {reunioesAtual}
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
                              {faltam}
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
                          <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500/20 to-teal-500/20 border border-cyan-500/30">
                            <motion.div
                              animate={{ rotate: [0, 10, -10, 0] }}
                              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                            >
                              <Trophy className="w-8 h-8 text-yellow-400" />
                            </motion.div>
                            <span className="text-2xl font-black text-cyan-400">META BATIDA!</span>
                            <motion.div
                              animate={{ scale: [1, 1.3, 1] }}
                              transition={{ duration: 1, repeat: Infinity }}
                            >
                              <Sparkles className="w-6 h-6 text-yellow-400" />
                            </motion.div>
                          </div>
                        ) : percentual >= 80 ? (
                          <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500/20 to-teal-500/20 border border-cyan-500/30">
                            <Flame className="w-6 h-6 text-orange-400" />
                            <span className="text-xl font-bold text-cyan-400">Quase lá!</span>
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
          <div className="flex items-center justify-center gap-4 mt-4">
            <p className="text-sm text-slate-500">
              Atualizado automaticamente a cada minuto
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => triggerTest()}
              className="text-slate-500 hover:text-cyan-400 gap-1"
              data-testid="button-test-celebration"
            >
              <Bell className="w-4 h-4" />
              Testar Celebração
            </Button>
          </div>
        </motion.div>
      </div>

      <DealCelebration autoClose={15000} />
    </div>
  );
}
