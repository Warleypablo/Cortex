import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Maximize2,
  Minimize2,
  Play,
  Pause,
  X,
  Handshake, 
  DollarSign, 
  Users, 
  Target, 
  Crown,
  Medal,
  Trophy,
  Flame,
  Zap,
  TrendingUp,
  Repeat,
  CalendarCheck,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Minus,
  Headphones
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { DealCelebration } from "@/components/DealCelebration";

interface CloserMetrics {
  mrrObtido: number;
  pontualObtido: number;
  reunioesRealizadas: number;
  negociosGanhos: number;
  leadsCriados: number;
  taxaConversao: number;
}

interface SDRMetrics {
  leadsTotais: number;
  reunioesRealizadas: number;
  taxaConversao: number;
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

interface ChartDataReunioes {
  sdr: string;
  sdrId: number;
  leads: number;
  reunioesRealizadas: number;
  conversao: number;
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

interface MRRData {
  sdr: string;
  mrr: number;
  pontual: number;
  contratos: number;
}

interface RankingSDR {
  position: number;
  name: string;
  leads: number;
  reunioesRealizadas: number;
  conversao: number;
  mrr: number;
  pontual: number;
  contratos: number;
  trend: 'up' | 'down' | 'stable';
}

type DashboardView = 'closers' | 'sdrs';

const ROTATION_INTERVAL = 30000;

export default function PresentationMode() {
  const [, navigate] = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentView, setCurrentView] = useState<DashboardView>('closers');
  const [showControls, setShowControls] = useState(true);
  const [countdown, setCountdown] = useState(ROTATION_INTERVAL / 1000);
  const [currentTime, setCurrentTime] = useState(new Date());

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];
  const mesAtual = hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const closerQueryParams = new URLSearchParams({
    dataFechamentoInicio: inicioMes,
    dataFechamentoFim: fimMes,
    dataReuniaoInicio: inicioMes,
    dataReuniaoFim: fimMes,
    dataLeadInicio: inicioMes,
    dataLeadFim: fimMes,
  }).toString();

  const sdrQueryParams = new URLSearchParams({
    dataReuniaoInicio: inicioMes,
    dataReuniaoFim: fimMes,
    dataLeadInicio: inicioMes,
    dataLeadFim: fimMes,
  }).toString();

  const { data: closerMetrics, isLoading: isLoadingCloserMetrics } = useQuery<CloserMetrics>({
    queryKey: ["/api/closers/metrics", closerQueryParams],
    queryFn: async () => {
      const res = await fetch(`/api/closers/metrics?${closerQueryParams}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: chartReunioesNegocios, isLoading: isLoadingChart1 } = useQuery<ChartDataReunioesNegocios[]>({
    queryKey: ["/api/closers/chart-reunioes-negocios", closerQueryParams],
    queryFn: async () => {
      const res = await fetch(`/api/closers/chart-reunioes-negocios?${closerQueryParams}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: chartReceita, isLoading: isLoadingChart2 } = useQuery<ChartDataReceita[]>({
    queryKey: ["/api/closers/chart-receita", closerQueryParams],
    queryFn: async () => {
      const res = await fetch(`/api/closers/chart-receita?${closerQueryParams}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: sdrMetrics, isLoading: isLoadingSDRMetrics } = useQuery<SDRMetrics>({
    queryKey: ["/api/sdrs/metrics", sdrQueryParams],
    queryFn: async () => {
      const res = await fetch(`/api/sdrs/metrics?${sdrQueryParams}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: chartReunioes, isLoading: isLoadingChartSDR } = useQuery<ChartDataReunioes[]>({
    queryKey: ["/api/sdrs/chart-reunioes", sdrQueryParams],
    queryFn: async () => {
      const res = await fetch(`/api/sdrs/chart-reunioes?${sdrQueryParams}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const mrrQueryParams = new URLSearchParams({
    dataInicio: inicioMes,
    dataFim: fimMes,
  }).toString();

  const { data: sdrMrrData, isLoading: isLoadingSDRMrr } = useQuery<MRRData[]>({
    queryKey: ["/api/vendas/mrr-por-sdr", mrrQueryParams],
    queryFn: async () => {
      const res = await fetch(`/api/vendas/mrr-por-sdr?${mrrQueryParams}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

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

  const closerRanking: RankingCloser[] = (chartReceita || [])
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
    })
    .sort((a, b) => b.mrr - a.mrr)
    .map((c, idx) => ({ ...c, position: idx + 1 }));

  const sdrMrrMap = new Map<string, { mrr: number; pontual: number; contratos: number }>();
  (sdrMrrData || []).forEach(m => {
    sdrMrrMap.set(m.sdr, { mrr: m.mrr, pontual: m.pontual, contratos: m.contratos });
  });

  const sdrRanking: RankingSDR[] = (chartReunioes || [])
    .map((c, idx) => {
      const mrrData = sdrMrrMap.get(c.sdr) || { mrr: 0, pontual: 0, contratos: 0 };
      return {
        position: idx + 1,
        name: c.sdr,
        leads: c.leads,
        reunioesRealizadas: c.reunioesRealizadas,
        conversao: c.conversao,
        mrr: mrrData.mrr,
        pontual: mrrData.pontual,
        contratos: mrrData.contratos,
        trend: 'stable' as const,
      };
    })
    .sort((a, b) => b.reunioesRealizadas - a.reunioesRealizadas || b.mrr - a.mrr)
    .map((c, idx) => ({ ...c, position: idx + 1 }));

  const closerTop3 = closerRanking.slice(0, 3);
  const sdrTop3 = sdrRanking.slice(0, 3);

  const closerTop3Pontual: RankingCloser[] = (chartReceita || [])
    .filter(c => c.pontual > 0)
    .sort((a, b) => b.pontual - a.pontual)
    .slice(0, 3)
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

  const isLoadingClosers = isLoadingCloserMetrics || isLoadingChart1 || isLoadingChart2;
  const isLoadingSDRs = isLoadingSDRMetrics || isLoadingChartSDR || isLoadingSDRMrr;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isPaused) return;

    const rotationTimer = setInterval(() => {
      setCurrentView(prev => prev === 'closers' ? 'sdrs' : 'closers');
      setCountdown(ROTATION_INTERVAL / 1000);
    }, ROTATION_INTERVAL);

    const countdownTimer = setInterval(() => {
      setCountdown(prev => prev > 0 ? prev - 1 : ROTATION_INTERVAL / 1000);
    }, 1000);

    return () => {
      clearInterval(rotationTimer);
      clearInterval(countdownTimer);
    };
  }, [isPaused]);

  useEffect(() => {
    let hideTimer: NodeJS.Timeout;
    
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setShowControls(false), 3000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    hideTimer = setTimeout(() => setShowControls(false), 3000);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(hideTimer);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          exitFullscreen();
        } else {
          navigate('/dashboard/comercial/closers');
        }
      }
      if (e.key === ' ') {
        e.preventDefault();
        setIsPaused(p => !p);
      }
      if (e.key === 'ArrowLeft') {
        setCurrentView('closers');
        setCountdown(ROTATION_INTERVAL / 1000);
      }
      if (e.key === 'ArrowRight') {
        setCurrentView('sdrs');
        setCountdown(ROTATION_INTERVAL / 1000);
      }
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, navigate]);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden relative flex flex-col"
      data-testid="presentation-mode-container"
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-0 left-1/4 w-96 h-96 ${currentView === 'closers' ? 'bg-violet-600/10' : 'bg-cyan-600/10'} rounded-full blur-3xl transition-colors duration-1000`} />
        <div className={`absolute bottom-0 right-1/4 w-96 h-96 ${currentView === 'closers' ? 'bg-emerald-600/10' : 'bg-blue-600/10'} rounded-full blur-3xl transition-colors duration-1000`} />
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] ${currentView === 'closers' ? 'bg-blue-600/5' : 'bg-teal-600/5'} rounded-full blur-3xl transition-colors duration-1000`} />
      </div>

      <DealCelebration />

      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/95 backdrop-blur-md rounded-full border border-slate-700/50 shadow-xl">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setCurrentView('closers');
                  setCountdown(ROTATION_INTERVAL / 1000);
                }}
                className={`h-8 w-8 ${currentView === 'closers' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}
                data-testid="button-view-closers"
              >
                <Handshake className="w-4 h-4" />
              </Button>
              
              <div className="w-px h-5 bg-slate-700" />
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsPaused(p => !p)}
                className="h-8 w-8 text-slate-300 hover:text-white"
                data-testid="button-toggle-pause"
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </Button>
              
              <span className="text-sm text-slate-400 w-8 text-center font-mono">{countdown}s</span>
              
              <div className="w-px h-5 bg-slate-700" />

              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setCurrentView('sdrs');
                  setCountdown(ROTATION_INTERVAL / 1000);
                }}
                className={`h-8 w-8 ${currentView === 'sdrs' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
                data-testid="button-view-sdrs"
              >
                <Headphones className="w-4 h-4" />
              </Button>

              <div className="w-px h-5 bg-slate-700" />

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="h-8 w-8 text-slate-300 hover:text-white"
                data-testid="button-toggle-fullscreen"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/dashboard/comercial/closers')}
                className="h-8 w-8 text-slate-400 hover:text-red-400"
                data-testid="button-exit-presentation"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex-1 flex flex-col p-4 lg:p-5 overflow-hidden">
        <AnimatePresence mode="wait">
          {currentView === 'closers' ? (
            <motion.div
              key="closers"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.4 }}
              className="h-full flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div 
                    className="relative"
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                  >
                    <div className="p-3 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 shadow-xl shadow-violet-600/30">
                      <Trophy className="w-8 h-8 text-white" />
                    </div>
                    <motion.div
                      className="absolute -top-1 -right-1"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <Sparkles className="w-4 h-4 text-yellow-400" />
                    </motion.div>
                  </motion.div>
                  <div>
                    <h1 className="text-3xl lg:text-4xl font-black bg-gradient-to-r from-white via-violet-200 to-violet-400 bg-clip-text text-transparent">
                      Dashboard Closers
                    </h1>
                    <p className="text-slate-400 text-sm capitalize">
                      {mesAtual}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xl font-mono font-bold text-white">
                    {currentTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="text-slate-400 text-[10px]">
                    {currentTime.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-3">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-600/20 to-teal-600/10 border border-emerald-500/30 p-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Repeat className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-300">MRR Obtido</span>
                  </div>
                  {isLoadingClosers ? (
                    <Skeleton className="h-8 w-24 bg-slate-700" />
                  ) : (
                    <motion.div 
                      className="text-2xl lg:text-3xl font-black text-white"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      key={closerMetrics?.mrrObtido}
                    >
                      {formatCurrencyCompact(closerMetrics?.mrrObtido || 0)}
                    </motion.div>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600/20 to-indigo-600/10 border border-blue-500/30 p-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-medium text-blue-300">Pontual</span>
                  </div>
                  {isLoadingClosers ? (
                    <Skeleton className="h-8 w-24 bg-slate-700" />
                  ) : (
                    <motion.div 
                      className="text-2xl lg:text-3xl font-black text-white"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      key={closerMetrics?.pontualObtido}
                    >
                      {formatCurrencyCompact(closerMetrics?.pontualObtido || 0)}
                    </motion.div>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="relative overflow-hidden rounded-xl bg-gradient-to-br from-violet-600/20 to-purple-600/10 border border-violet-500/30 p-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-violet-400" />
                    <span className="text-xs font-medium text-violet-300">Reuniões</span>
                  </div>
                  {isLoadingClosers ? (
                    <Skeleton className="h-8 w-16 bg-slate-700" />
                  ) : (
                    <motion.div 
                      className="text-2xl lg:text-3xl font-black text-white"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      key={closerMetrics?.reunioesRealizadas}
                    >
                      {closerMetrics?.reunioesRealizadas || 0}
                    </motion.div>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-600/20 to-orange-600/10 border border-amber-500/30 p-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Handshake className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-medium text-amber-300">Negócios</span>
                  </div>
                  {isLoadingClosers ? (
                    <Skeleton className="h-8 w-16 bg-slate-700" />
                  ) : (
                    <motion.div 
                      className="text-2xl lg:text-3xl font-black text-white"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      key={closerMetrics?.negociosGanhos}
                    >
                      {closerMetrics?.negociosGanhos || 0}
                    </motion.div>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="relative overflow-hidden rounded-xl bg-gradient-to-br from-rose-600/20 to-pink-600/10 border border-rose-500/30 p-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="w-4 h-4 text-rose-400" />
                    <span className="text-xs font-medium text-rose-300">Conversão</span>
                  </div>
                  {isLoadingClosers ? (
                    <Skeleton className="h-8 w-16 bg-slate-700" />
                  ) : (
                    <motion.div 
                      className="text-2xl lg:text-3xl font-black text-white"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      key={closerMetrics?.taxaConversao}
                    >
                      {(closerMetrics?.taxaConversao || 0).toFixed(1)}%
                    </motion.div>
                  )}
                </motion.div>
              </div>

              <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
                <div className="lg:col-span-2 flex flex-col">
                  <div className="mb-2 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    <h2 className="text-xl font-bold text-white">Pódio</h2>
                    <motion.div
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                    >
                      <Flame className="w-4 h-4 text-orange-500" />
                    </motion.div>
                  </div>

                  {isLoadingClosers ? (
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      {[0, 1, 2].map(i => (
                        <Skeleton key={i} className="bg-slate-800 rounded-xl" />
                      ))}
                    </div>
                  ) : closerTop3.length > 0 ? (
                    <div className="flex-1 grid grid-cols-3 gap-3 items-end">
                      {[1, 0, 2].map((orderIndex) => {
                        const closer = closerTop3[orderIndex];
                        if (!closer) return <div key={orderIndex} />;
                        
                        const isFirst = closer.position === 1;
                        const heightPercents = { 0: '100%', 1: '85%', 2: '70%' };
                        
                        return (
                          <motion.div
                            key={closer.name}
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 + orderIndex * 0.15 }}
                            className="relative"
                            style={{ height: heightPercents[orderIndex as keyof typeof heightPercents] }}
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

                              <div className="relative p-4 h-full flex flex-col">
                                <div className="flex items-center justify-between mb-3">
                                  <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${
                                    closer.position === 1 ? 'bg-yellow-500/20' :
                                    closer.position === 2 ? 'bg-gray-400/20' : 'bg-amber-600/20'
                                  }`}>
                                    {closer.position === 1 && <Crown className="w-6 h-6 text-yellow-400" />}
                                    {closer.position === 2 && <Medal className="w-5 h-5 text-gray-300" />}
                                    {closer.position === 3 && <Medal className="w-5 h-5 text-amber-600" />}
                                  </div>
                                  <div className={`text-xs font-bold uppercase tracking-wide ${
                                    closer.position === 1 ? 'text-yellow-400' :
                                    closer.position === 2 ? 'text-gray-300' : 'text-amber-500'
                                  }`}>
                                    {closer.position === 1 ? 'CAMPEÃO' : 
                                     closer.position === 2 ? 'VICE' : 'BRONZE'}
                                  </div>
                                </div>

                                <h3 className="text-base lg:text-lg font-bold text-white truncate mb-3">
                                  {closer.name}
                                </h3>

                                <div className="flex-1 space-y-2">
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

                                <div className="mt-3 pt-3 border-t border-slate-700/50 grid grid-cols-3 gap-2 text-center">
                                  <div>
                                    <div className="text-base font-bold text-white">{closer.reunioes}</div>
                                    <div className="text-[9px] text-slate-400 uppercase">Reuniões</div>
                                  </div>
                                  <div>
                                    <div className="text-base font-bold text-white">{closer.negocios}</div>
                                    <div className="text-[9px] text-slate-400 uppercase">Fechados</div>
                                  </div>
                                  <div>
                                    <div className="text-base font-bold text-white">{closer.taxa.toFixed(0)}%</div>
                                    <div className="text-[9px] text-slate-400 uppercase">Taxa</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center rounded-2xl bg-slate-900/50 border border-slate-800">
                      <p className="text-slate-400">Nenhum dado disponível</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3 overflow-hidden">
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="mb-2 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-violet-400" />
                      <h2 className="text-lg font-bold text-white">Ranking Completo</h2>
                    </div>

                    <div className="flex-1 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl overflow-hidden flex flex-col">
                      <div className="flex items-center gap-1 p-1.5 bg-slate-800/50 text-[7px] font-semibold text-slate-400 uppercase tracking-wider">
                        <div className="w-5 shrink-0">#</div>
                        <div className="flex-1 min-w-0">Closer</div>
                        <div className="w-12 text-right shrink-0">MRR</div>
                        <div className="w-12 text-right shrink-0">Pont.</div>
                        <div className="w-12 text-right shrink-0">Total</div>
                        <div className="w-8 text-center shrink-0">Neg.</div>
                        <div className="w-8 text-center shrink-0">Reun.</div>
                        <div className="w-10 text-center shrink-0">Conv.</div>
                      </div>

                      <div className="divide-y divide-slate-800/50 flex-1 overflow-y-auto">
                      {isLoadingClosers ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="p-2">
                            <Skeleton className="h-6 bg-slate-800" />
                          </div>
                        ))
                      ) : closerRanking.length > 0 ? (
                        closerRanking.map((closer, index) => (
                          <motion.div
                            key={closer.name}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.03 * index }}
                            className={`flex items-center gap-1 py-1.5 px-1.5 hover:bg-slate-800/30 transition-colors ${
                              closer.position <= 3 ? 'bg-gradient-to-r ' + getPositionGradient(closer.position) : ''
                            }`}
                          >
                            <div className="w-5 shrink-0">
                              {closer.position <= 3 ? (
                                <div className="w-5 h-5 flex items-center justify-center">
                                  {closer.position === 1 && <Crown className="w-4 h-4 text-yellow-400" />}
                                  {closer.position === 2 && <Medal className="w-3 h-3 text-gray-300" />}
                                  {closer.position === 3 && <Medal className="w-3 h-3 text-amber-600" />}
                                </div>
                              ) : (
                                <span className="text-slate-500 font-mono text-[10px]">{closer.position}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 font-medium text-white truncate text-[10px]">
                              {closer.name}
                            </div>
                            <div className="w-12 text-right font-bold text-emerald-400 text-[10px] shrink-0">
                              {formatCurrencyCompact(closer.mrr)}
                            </div>
                            <div className="w-12 text-right font-semibold text-blue-400 text-[10px] shrink-0">
                              {formatCurrencyCompact(closer.pontual)}
                            </div>
                            <div className="w-12 text-right font-bold text-white text-[10px] shrink-0">
                              {formatCurrencyCompact(closer.total)}
                            </div>
                            <div className="w-8 text-center shrink-0">
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-amber-500/20 text-amber-400 text-[9px] font-bold">
                                {closer.negocios}
                              </span>
                            </div>
                            <div className="w-8 text-center shrink-0">
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-violet-500/20 text-violet-400 text-[9px] font-bold">
                                {closer.reunioes}
                              </span>
                            </div>
                            <div className="w-10 text-center shrink-0">
                              <span className={`inline-flex items-center justify-center px-1 py-0.5 rounded text-[9px] font-bold ${
                                closer.taxa >= 40 ? 'bg-emerald-500/20 text-emerald-400' :
                                closer.taxa >= 25 ? 'bg-cyan-500/20 text-cyan-400' :
                                closer.taxa >= 15 ? 'bg-amber-500/20 text-amber-400' :
                                'bg-slate-700/50 text-slate-400'
                              }`}>
                                {closer.taxa.toFixed(0)}%
                              </span>
                            </div>
                          </motion.div>
                        ))
                      ) : (
                        <div className="p-6 text-center text-slate-400">
                          Nenhum closer encontrado
                        </div>
                      )}
                      </div>
                    </div>
                  </div>

                  {/* DESTAQUE PONTUAL - Below Ranking */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-blue-400" />
                      <h2 className="text-sm font-bold text-white">Destaque Pontual</h2>
                      <Badge className="bg-blue-500/20 text-blue-400 text-[9px]">Top Pontuais</Badge>
                    </div>

                    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl overflow-hidden">
                      {isLoadingClosers ? (
                        <div className="p-2 space-y-2">
                          {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-8 bg-slate-800 rounded-lg" />
                          ))}
                        </div>
                      ) : closerTop3Pontual.length > 0 ? (
                        <div className="divide-y divide-slate-800/50">
                          {closerTop3Pontual.map((closer, index) => (
                            <motion.div
                              key={closer.name}
                              initial={{ opacity: 0, x: 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.1 * index }}
                              className={`p-2 flex items-center gap-2 ${
                                index === 0 ? 'bg-gradient-to-r from-blue-500/20 to-transparent' : ''
                              }`}
                            >
                              <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                index === 0 ? 'bg-blue-500/30' :
                                index === 1 ? 'bg-slate-600/30' :
                                'bg-amber-600/30'
                              }`}>
                                {index === 0 && <Crown className="w-3 h-3 text-blue-400" />}
                                {index === 1 && <Medal className="w-2.5 h-2.5 text-gray-300" />}
                                {index === 2 && <Medal className="w-2.5 h-2.5 text-amber-600" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-white truncate text-xs">{closer.name}</div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-xs font-bold text-blue-400">{formatCurrencyCompact(closer.pontual)}</div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 text-center text-slate-400 text-xs">
                          Nenhuma venda pontual
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>
              </div>

              {/* BARRA DE META */}
              <motion.div 
                className="mt-2 relative"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6 }}
              >
                <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 p-3">
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <motion.div 
                          className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30"
                          animate={{ scale: [1, 1.05, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <Target className="w-4 h-4 text-white" />
                        </motion.div>
                        <div>
                          <h2 className="text-lg font-black text-white">META DO MÊS</h2>
                          <p className="text-slate-400 text-[10px]">Receita Recorrente (MRR)</p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">Meta</div>
                        <div className="text-xl font-black text-white">R$ 180k</div>
                      </div>
                    </div>

                    {(() => {
                      const META_MRR = 180000;
                      const mrrAtual = closerMetrics?.mrrObtido || 0;
                      const percentual = Math.min((mrrAtual / META_MRR) * 100, 100);
                      const faltam = Math.max(META_MRR - mrrAtual, 0);
                      const atingida = percentual >= 100;
                      
                      return (
                        <>
                          <div className="relative h-8 bg-slate-800/80 rounded-lg overflow-hidden border border-slate-700/50">
                            <motion.div
                              className={`absolute inset-y-0 left-0 rounded-lg ${
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
                              <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                                animate={{ x: ["-100%", "100%"] }}
                                transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                              />
                            </motion.div>
                            
                            <div className="absolute inset-0 flex items-center justify-center">
                              <motion.span 
                                className="text-lg font-black text-white drop-shadow-lg"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 1.5, type: "spring", stiffness: 200 }}
                              >
                                {percentual.toFixed(1)}%
                              </motion.span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-4">
                              <div>
                                <div className="text-[10px] text-slate-400 uppercase">Conquistado</div>
                                <motion.div 
                                  className="text-xl font-black text-emerald-400"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: 0.8 }}
                                >
                                  {formatCurrencyCompact(mrrAtual)}
                                </motion.div>
                              </div>
                              
                              {!atingida && (
                                <div>
                                  <div className="text-[10px] text-slate-400 uppercase">Faltam</div>
                                  <motion.div 
                                    className="text-xl font-black text-amber-400"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 1 }}
                                  >
                                    {formatCurrencyCompact(faltam)}
                                  </motion.div>
                                </div>
                              )}
                            </div>

                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: 1.2, type: "spring" }}
                            >
                              {atingida ? (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30">
                                  <Trophy className="w-4 h-4 text-yellow-400" />
                                  <span className="text-sm font-black text-emerald-400">META BATIDA!</span>
                                  <Sparkles className="w-4 h-4 text-yellow-400" />
                                </div>
                              ) : percentual >= 80 ? (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30">
                                  <Flame className="w-4 h-4 text-orange-400" />
                                  <span className="text-sm font-bold text-emerald-400">Quase lá!</span>
                                </div>
                              ) : percentual >= 50 ? (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30">
                                  <TrendingUp className="w-4 h-4 text-amber-400" />
                                  <span className="text-sm font-bold text-amber-400">Bom progresso!</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-500/30">
                                  <Zap className="w-4 h-4 text-rose-400" />
                                  <span className="text-sm font-bold text-rose-400">Hora de acelerar!</span>
                                </div>
                              )}
                            </motion.div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="sdrs"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.4 }}
              className="space-y-3"
            >
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
                    <h1 className="text-4xl lg:text-5xl font-black bg-gradient-to-r from-white via-cyan-200 to-cyan-400 bg-clip-text text-transparent">
                      Dashboard SDRs
                    </h1>
                    <p className="text-slate-400 text-lg mt-1 capitalize">
                      {mesAtual}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-mono font-bold text-white">
                    {currentTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="text-slate-400 text-xs">
                    {currentTime.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { 
                    label: "Leads Criados", 
                    value: sdrMetrics?.leadsTotais || 0, 
                    icon: Users,
                    gradient: "from-blue-600 to-indigo-600",
                    format: (v: number) => v.toString()
                  },
                  { 
                    label: "Reuniões Realizadas", 
                    value: sdrMetrics?.reunioesRealizadas || 0, 
                    icon: CalendarCheck,
                    gradient: "from-cyan-600 to-teal-600",
                    format: (v: number) => v.toString()
                  },
                  { 
                    label: "Taxa de Conversão", 
                    value: sdrMetrics?.taxaConversao || 0, 
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
                    <div className="relative overflow-hidden rounded-2xl bg-slate-900/60 backdrop-blur-sm border border-slate-800 p-4">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br opacity-10 rounded-full -translate-y-1/2 translate-x-1/2" />
                      
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${kpi.gradient} shadow-lg`}>
                          <kpi.icon className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-sm font-medium text-slate-400">{kpi.label}</span>
                      </div>
                      
                      {isLoadingSDRs ? (
                        <Skeleton className="h-10 w-32 bg-slate-800" />
                      ) : (
                        <motion.div
                          className="text-4xl font-black text-white"
                          initial={{ scale: 0.5 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 200, delay: 0.2 + 0.1 * index }}
                        >
                          {kpi.format(kpi.value)}
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                  
                  {isLoadingSDRs ? (
                    <div className="grid grid-cols-3 gap-4">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-64 rounded-2xl bg-slate-800" />
                      ))}
                    </div>
                  ) : sdrTop3.length > 0 ? (
                    <div className="flex items-end justify-center gap-4 h-[320px]">
                      {[1, 0, 2].map((dataIndex, visualIndex) => {
                        const sdr = sdrTop3[dataIndex];
                        if (!sdr) return null;
                        
                        const heights = ['h-64', 'h-72', 'h-56'];
                        const sizes = ['text-2xl', 'text-3xl', 'text-xl'];
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
                              
                              <div className="space-y-3 mt-auto">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-slate-400">Reuniões</span>
                                  <span className="text-2xl font-black text-cyan-400">{sdr.reunioesRealizadas}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-slate-400">MRR</span>
                                  <span className="text-sm font-semibold text-emerald-400">{formatCurrency(sdr.mrr)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-slate-400">Leads</span>
                                  <span className="text-sm font-semibold text-blue-400">{sdr.leads}</span>
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
                    <div className="grid grid-cols-14 gap-1 p-2 bg-slate-800/50 text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                      <div className="col-span-1">#</div>
                      <div className="col-span-2">SDR</div>
                      <div className="col-span-1 text-right">Leads</div>
                      <div className="col-span-2 text-right text-cyan-400">Reuniões</div>
                      <div className="col-span-2 text-right">% RR/Lead</div>
                      <div className="col-span-1 text-right">Contr.</div>
                      <div className="col-span-1 text-right">% V/RR</div>
                      <div className="col-span-2 text-right">MRR</div>
                      <div className="col-span-2 text-right">Pontual</div>
                    </div>

                    <div className="divide-y divide-slate-800/50 max-h-[290px] overflow-y-auto">
                      {isLoadingSDRs ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="p-2">
                            <Skeleton className="h-6 bg-slate-800" />
                          </div>
                        ))
                      ) : sdrRanking.length > 0 ? (
                        sdrRanking.map((sdr, index) => {
                          const convRRLead = sdr.leads > 0 ? (sdr.reunioesRealizadas / sdr.leads) * 100 : 0;
                          const convVRR = sdr.reunioesRealizadas > 0 ? (sdr.contratos / sdr.reunioesRealizadas) * 100 : 0;
                          return (
                          <motion.div
                            key={sdr.name}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.03 * index }}
                            className={`grid grid-cols-14 gap-1 p-2 items-center hover:bg-slate-800/30 transition-colors ${
                              sdr.position <= 3 ? 'bg-gradient-to-r ' + getPositionGradient(sdr.position) : ''
                            }`}
                          >
                            <div className="col-span-1">
                              {sdr.position <= 3 ? (
                                <div className="w-5 h-5 flex items-center justify-center">
                                  {sdr.position === 1 && <Crown className="w-4 h-4 text-yellow-400" />}
                                  {sdr.position === 2 && <Medal className="w-3 h-3 text-gray-300" />}
                                  {sdr.position === 3 && <Medal className="w-3 h-3 text-amber-600" />}
                                </div>
                              ) : (
                                <span className="text-slate-500 font-mono text-xs">{sdr.position}</span>
                              )}
                            </div>
                            <div className="col-span-2 font-medium text-white truncate text-xs">
                              {sdr.name}
                            </div>
                            <div className="col-span-1 text-right text-slate-300 text-xs">
                              {sdr.leads}
                            </div>
                            <div className="col-span-2 text-right font-black text-cyan-400 text-sm">
                              {sdr.reunioesRealizadas}
                            </div>
                            <div className="col-span-2 text-right">
                              <Badge 
                                variant="outline" 
                                className={`text-[10px] border-0 px-1 ${
                                  convRRLead >= 30 ? 'bg-emerald-500/20 text-emerald-400' :
                                  convRRLead >= 15 ? 'bg-amber-500/20 text-amber-400' :
                                  'bg-slate-700/50 text-slate-400'
                                }`}
                              >
                                {convRRLead.toFixed(0)}%
                              </Badge>
                            </div>
                            <div className="col-span-1 text-right text-violet-400 text-xs font-semibold">
                              {sdr.contratos}
                            </div>
                            <div className="col-span-1 text-right">
                              <Badge 
                                variant="outline" 
                                className={`text-[10px] border-0 px-1 ${
                                  convVRR >= 30 ? 'bg-emerald-500/20 text-emerald-400' :
                                  convVRR >= 15 ? 'bg-amber-500/20 text-amber-400' :
                                  'bg-slate-700/50 text-slate-400'
                                }`}
                              >
                                {convVRR.toFixed(0)}%
                              </Badge>
                            </div>
                            <div className="col-span-2 text-right font-semibold text-emerald-400 text-xs">
                              {formatCurrencyCompact(sdr.mrr)}
                            </div>
                            <div className="col-span-2 text-right font-semibold text-blue-400 text-xs">
                              {formatCurrencyCompact(sdr.pontual)}
                            </div>
                          </motion.div>
                        );})
                      ) : (
                        <div className="p-6 text-center text-slate-400">
                          Nenhum SDR encontrado
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* BARRA DE META REUNIÕES SDR */}
              <motion.div 
                className="mt-1 relative"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6 }}
              >
                <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 p-3">
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <motion.div 
                          className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 shadow-lg shadow-cyan-500/30"
                          animate={{ scale: [1, 1.05, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <CalendarCheck className="w-4 h-4 text-white" />
                        </motion.div>
                        <div>
                          <h2 className="text-lg font-black text-white">META DE REUNIÕES</h2>
                          <p className="text-slate-400 text-[10px]">Reuniões Agendadas</p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">Meta</div>
                        <div className="text-xl font-black text-white">250</div>
                      </div>
                    </div>

                    {(() => {
                      const META_REUNIOES = 250;
                      const reunioesAtual = sdrMetrics?.reunioesRealizadas || 0;
                      const percentual = Math.min((reunioesAtual / META_REUNIOES) * 100, 100);
                      const faltam = Math.max(META_REUNIOES - reunioesAtual, 0);
                      const atingida = percentual >= 100;
                      
                      return (
                        <>
                          <div className="relative h-8 bg-slate-800/80 rounded-lg overflow-hidden border border-slate-700/50">
                            <motion.div
                              className={`absolute inset-y-0 left-0 rounded-lg ${
                                atingida 
                                  ? 'bg-gradient-to-r from-cyan-500 via-teal-400 to-cyan-500'
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
                              <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                                animate={{ x: ["-100%", "100%"] }}
                                transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                              />
                            </motion.div>
                            
                            <div className="absolute inset-0 flex items-center justify-center">
                              <motion.span 
                                className="text-lg font-black text-white drop-shadow-lg"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 1.5, type: "spring", stiffness: 200 }}
                              >
                                {percentual.toFixed(1)}%
                              </motion.span>
                            </div>

                            {[25, 50, 75, 100].map((milestone) => (
                              <div
                                key={milestone}
                                className="absolute top-0 bottom-0 w-px bg-slate-600/50"
                                style={{ left: `${milestone}%` }}
                              />
                            ))}
                          </div>

                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-4">
                              <div>
                                <div className="text-[10px] text-slate-400 uppercase">Realizadas</div>
                                <motion.div 
                                  className="text-xl font-black text-cyan-400"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: 0.8 }}
                                >
                                  {reunioesAtual}
                                </motion.div>
                              </div>
                              
                              {!atingida && (
                                <div>
                                  <div className="text-[10px] text-slate-400 uppercase">Faltam</div>
                                  <motion.div 
                                    className="text-xl font-black text-amber-400"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 1 }}
                                  >
                                    {faltam}
                                  </motion.div>
                                </div>
                              )}
                            </div>

                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: 1.2, type: "spring" }}
                            >
                              {atingida ? (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500/20 to-teal-500/20 border border-cyan-500/30">
                                  <Trophy className="w-4 h-4 text-yellow-400" />
                                  <span className="text-sm font-black text-cyan-400">META BATIDA!</span>
                                  <Sparkles className="w-4 h-4 text-yellow-400" />
                                </div>
                              ) : percentual >= 80 ? (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500/20 to-teal-500/20 border border-cyan-500/30">
                                  <Flame className="w-4 h-4 text-orange-400" />
                                  <span className="text-sm font-bold text-cyan-400">Quase lá!</span>
                                </div>
                              ) : percentual >= 50 ? (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30">
                                  <TrendingUp className="w-4 h-4 text-amber-400" />
                                  <span className="text-sm font-bold text-amber-400">Bom progresso!</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-500/30">
                                  <Zap className="w-4 h-4 text-rose-400" />
                                  <span className="text-sm font-bold text-rose-400">Hora de acelerar!</span>
                                </div>
                              )}
                            </motion.div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
