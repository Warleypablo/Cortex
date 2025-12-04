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
  CalendarCheck,
  TrendingUp,
  Repeat,
  Monitor,
  ChevronLeft,
  ChevronRight,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

type DashboardView = 'closers' | 'sdrs';

const ROTATION_INTERVAL = 30000;

function AnimatedBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-[#0A0A0F]" />
      <motion.div
        className="absolute top-0 left-1/4 w-[800px] h-[800px] rounded-full bg-gradient-to-r from-violet-600/20 to-purple-600/20 blur-[150px]"
        animate={{
          x: [0, 100, 0],
          y: [0, 50, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      <motion.div
        className="absolute bottom-0 right-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-r from-blue-600/15 to-cyan-600/15 blur-[120px]"
        animate={{
          x: [0, -80, 0],
          y: [0, -60, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-r from-emerald-600/10 to-teal-600/10 blur-[100px]"
        animate={{
          x: [0, 60, -60, 0],
          y: [0, -40, 40, 0],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:50px_50px]" />
    </div>
  );
}

function formatCurrency(value: number) {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(0)}K`;
  }
  return `R$ ${value.toFixed(0)}`;
}

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
  }).toString();

  const sdrQueryParams = new URLSearchParams({
    dataReuniaoInicio: inicioMes,
    dataReuniaoFim: fimMes,
  }).toString();

  const { data: closerMetrics } = useQuery<CloserMetrics>({
    queryKey: ["/api/closers/metrics", closerQueryParams],
    queryFn: async () => {
      const res = await fetch(`/api/closers/metrics?${closerQueryParams}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: closerChart } = useQuery<ChartDataReunioesNegocios[]>({
    queryKey: ["/api/closers/chart-reunioes-negocios", closerQueryParams],
    queryFn: async () => {
      const res = await fetch(`/api/closers/chart-reunioes-negocios?${closerQueryParams}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: sdrMetrics } = useQuery<SDRMetrics>({
    queryKey: ["/api/sdrs/metrics", sdrQueryParams],
    queryFn: async () => {
      const res = await fetch(`/api/sdrs/metrics?${sdrQueryParams}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: sdrChart } = useQuery<ChartDataReunioes[]>({
    queryKey: ["/api/sdrs/chart-reunioes", sdrQueryParams],
    queryFn: async () => {
      const res = await fetch(`/api/sdrs/chart-reunioes?${sdrQueryParams}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const closerRanking = (closerChart || [])
    .map((c, i) => ({
      position: i + 1,
      name: c.closer,
      mrr: c.mrr || 0,
      pontual: c.pontual || 0,
      total: (c.mrr || 0) + (c.pontual || 0),
      reunioes: c.reunioes,
      negocios: c.negociosGanhos,
      taxa: c.taxaConversao,
    }))
    .sort((a, b) => b.total - a.total)
    .map((c, i) => ({ ...c, position: i + 1 }));

  const sdrRanking = (sdrChart || [])
    .map((s, i) => ({
      position: i + 1,
      name: s.sdr,
      leads: s.leads,
      reunioes: s.reunioesRealizadas,
      conversao: s.conversao,
    }))
    .sort((a, b) => b.reunioes - a.reunioes)
    .map((s, i) => ({ ...s, position: i + 1 }));

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

  const getPositionStyle = (position: number) => {
    switch (position) {
      case 1:
        return {
          bg: "from-amber-500/30 via-yellow-500/20 to-orange-500/30",
          border: "border-amber-400/50",
          icon: <Crown className="w-8 h-8 text-amber-400" />,
        };
      case 2:
        return {
          bg: "from-slate-400/20 via-gray-400/15 to-slate-500/20",
          border: "border-slate-400/50",
          icon: <Medal className="w-6 h-6 text-slate-300" />,
        };
      case 3:
        return {
          bg: "from-amber-700/20 via-orange-700/15 to-amber-800/20",
          border: "border-amber-600/50",
          icon: <Medal className="w-6 h-6 text-amber-600" />,
        };
      default:
        return {
          bg: "from-slate-800/50 to-slate-900/50",
          border: "border-slate-700/50",
          icon: null,
        };
    }
  };

  return (
    <div 
      ref={containerRef}
      className="min-h-screen w-full bg-[#0A0A0F] relative overflow-hidden"
      data-testid="presentation-mode-container"
    >
      <AnimatedBackground />
      <DealCelebration />

      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/90 backdrop-blur-md rounded-full border border-slate-700/50">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setCurrentView('closers');
                  setCountdown(ROTATION_INTERVAL / 1000);
                }}
                className={`h-8 w-8 ${currentView === 'closers' ? 'bg-violet-600 text-white' : 'text-slate-400'}`}
                data-testid="button-view-closers"
              >
                <Handshake className="w-4 h-4" />
              </Button>
              
              <div className="flex items-center gap-1 px-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsPaused(p => !p)}
                  className="h-8 w-8 text-slate-300"
                  data-testid="button-toggle-pause"
                >
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </Button>
                <span className="text-xs text-slate-400 w-8 text-center font-mono">
                  {countdown}s
                </span>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setCurrentView('sdrs');
                  setCountdown(ROTATION_INTERVAL / 1000);
                }}
                className={`h-8 w-8 ${currentView === 'sdrs' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}
                data-testid="button-view-sdrs"
              >
                <Users className="w-4 h-4" />
              </Button>

              <div className="w-px h-6 bg-slate-700" />

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="h-8 w-8 text-slate-300"
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

      <div className="relative z-10 p-6 lg:p-8 h-screen flex flex-col">
        <AnimatePresence mode="wait">
          {currentView === 'closers' ? (
            <motion.div
              key="closers"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.5 }}
              className="flex-1 flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 shadow-lg shadow-violet-500/30">
                    <Handshake className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-4xl lg:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400">
                      Dashboard Closers
                    </h1>
                    <p className="text-lg text-slate-400 capitalize">{mesAtual}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold text-white font-mono">
                    {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-sm text-slate-400">
                    {currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-4 mb-6">
                {[
                  { label: "MRR Obtido", value: formatCurrency(closerMetrics?.mrrObtido || 0), icon: Repeat, gradient: "from-emerald-600/30 to-teal-600/20", color: "text-emerald-400" },
                  { label: "Pontual", value: formatCurrency(closerMetrics?.pontualObtido || 0), icon: DollarSign, gradient: "from-blue-600/30 to-indigo-600/20", color: "text-blue-400" },
                  { label: "Reuniões", value: closerMetrics?.reunioesRealizadas || 0, icon: Users, gradient: "from-violet-600/30 to-purple-600/20", color: "text-violet-400" },
                  { label: "Negócios", value: closerMetrics?.negociosGanhos || 0, icon: Handshake, gradient: "from-amber-600/30 to-orange-600/20", color: "text-amber-400" },
                  { label: "Conversão", value: `${(closerMetrics?.taxaConversao || 0).toFixed(1)}%`, icon: Target, gradient: "from-rose-600/30 to-pink-600/20", color: "text-rose-400" },
                ].map((kpi, i) => (
                  <motion.div
                    key={kpi.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * i }}
                    className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${kpi.gradient} border border-white/10 p-4`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                      <span className="text-sm text-slate-300">{kpi.label}</span>
                    </div>
                    <div className="text-3xl lg:text-4xl font-black text-white">
                      {kpi.value}
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="flex-1 grid grid-cols-3 gap-6">
                <div className="col-span-2">
                  <div className="flex items-center gap-2 mb-4">
                    <Trophy className="w-6 h-6 text-yellow-400" />
                    <h2 className="text-2xl font-bold text-white">Pódio dos Closers</h2>
                    <Flame className="w-5 h-5 text-orange-500 animate-pulse" />
                  </div>
                  
                  <div className="flex items-end justify-center gap-6 h-[calc(100%-3rem)]">
                    {[1, 0, 2].map((idx, visualIdx) => {
                      const closer = closerRanking[idx];
                      if (!closer) return null;
                      const style = getPositionStyle(closer.position);
                      const heights = ['h-56', 'h-64', 'h-48'];
                      
                      return (
                        <motion.div
                          key={closer.name}
                          initial={{ opacity: 0, y: 50 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 + visualIdx * 0.1 }}
                          className={`${heights[visualIdx]} w-52 flex flex-col`}
                        >
                          <div className={`flex-1 rounded-2xl bg-gradient-to-b ${style.bg} border-2 ${style.border} p-4 flex flex-col`}>
                            <div className="flex items-center gap-2 mb-2">
                              {style.icon}
                              <Badge className="bg-white/10 text-white text-xs">
                                #{closer.position}
                              </Badge>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-auto truncate">
                              {closer.name.split(' ').slice(0, 2).join(' ')}
                            </h3>
                            <div className="space-y-1 mt-2">
                              <div className="flex justify-between">
                                <span className="text-xs text-slate-400">MRR</span>
                                <span className="text-lg font-bold text-emerald-400">{formatCurrency(closer.mrr)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-xs text-slate-400">Negócios</span>
                                <span className="text-lg font-bold text-amber-400">{closer.negocios}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-xs text-slate-400">Conversão</span>
                                <span className="text-sm font-semibold text-rose-400">{closer.taxa.toFixed(1)}%</span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-5 h-5 text-violet-400" />
                    <h2 className="text-xl font-bold text-white">Ranking</h2>
                  </div>
                  
                  <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-2xl overflow-hidden h-[calc(100%-3rem)]">
                    <div className="divide-y divide-slate-800/50 overflow-y-auto max-h-full">
                      {closerRanking.slice(0, 8).map((closer, index) => (
                        <motion.div
                          key={closer.name}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.05 * index }}
                          className={`flex items-center gap-3 p-3 ${index < 3 ? 'bg-gradient-to-r ' + getPositionStyle(index + 1).bg : ''}`}
                        >
                          <div className="w-8 text-center">
                            {closer.position <= 3 ? (
                              getPositionStyle(closer.position).icon
                            ) : (
                              <span className="text-slate-500 font-mono">{closer.position}</span>
                            )}
                          </div>
                          <div className="flex-1 truncate">
                            <span className="text-sm font-medium text-white">{closer.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold text-emerald-400">{formatCurrency(closer.total)}</span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="sdrs"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.5 }}
              className="flex-1 flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-600 to-teal-600 shadow-lg shadow-cyan-500/30">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-4xl lg:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400">
                      Dashboard SDRs
                    </h1>
                    <p className="text-lg text-slate-400 capitalize">{mesAtual}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold text-white font-mono">
                    {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-sm text-slate-400">
                    {currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6 mb-6">
                {[
                  { label: "Leads Criados", value: sdrMetrics?.leadsTotais || 0, icon: Users, gradient: "from-blue-600/30 to-indigo-600/20", color: "text-blue-400" },
                  { label: "Reuniões Realizadas", value: sdrMetrics?.reunioesRealizadas || 0, icon: CalendarCheck, gradient: "from-cyan-600/30 to-teal-600/20", color: "text-cyan-400" },
                  { label: "Taxa de Conversão", value: `${(sdrMetrics?.taxaConversao || 0).toFixed(1)}%`, icon: TrendingUp, gradient: "from-emerald-600/30 to-green-600/20", color: "text-emerald-400" },
                ].map((kpi, i) => (
                  <motion.div
                    key={kpi.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * i }}
                    className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${kpi.gradient} border border-white/10 p-6`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2.5 rounded-xl bg-gradient-to-br ${kpi.gradient.replace('/30', '').replace('/20', '')} shadow-lg`}>
                        <kpi.icon className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-lg text-slate-300">{kpi.label}</span>
                    </div>
                    <div className="text-5xl font-black text-white">
                      {kpi.value}
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="flex-1 grid grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Trophy className="w-6 h-6 text-yellow-400" />
                    <h2 className="text-2xl font-bold text-white">Pódio dos SDRs</h2>
                    <Flame className="w-5 h-5 text-orange-500 animate-pulse" />
                  </div>
                  
                  <div className="flex items-end justify-center gap-6 h-[calc(100%-3rem)]">
                    {[1, 0, 2].map((idx, visualIdx) => {
                      const sdr = sdrRanking[idx];
                      if (!sdr) return null;
                      const style = getPositionStyle(sdr.position);
                      const heights = ['h-52', 'h-60', 'h-44'];
                      
                      return (
                        <motion.div
                          key={sdr.name}
                          initial={{ opacity: 0, y: 50 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 + visualIdx * 0.1 }}
                          className={`${heights[visualIdx]} w-44 flex flex-col`}
                        >
                          <div className={`flex-1 rounded-2xl bg-gradient-to-b ${style.bg} border-2 ${style.border} p-4 flex flex-col`}>
                            <div className="flex items-center gap-2 mb-2">
                              {style.icon}
                              <Badge className="bg-white/10 text-white text-xs">
                                #{sdr.position}
                              </Badge>
                            </div>
                            <h3 className="text-lg font-bold text-white mb-auto truncate">
                              {sdr.name.split(' ').slice(0, 2).join(' ')}
                            </h3>
                            <div className="space-y-1 mt-2">
                              <div className="flex justify-between">
                                <span className="text-xs text-slate-400">Reuniões</span>
                                <span className="text-xl font-bold text-cyan-400">{sdr.reunioes}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-xs text-slate-400">Leads</span>
                                <span className="text-sm font-semibold text-blue-400">{sdr.leads}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-xs text-slate-400">Conversão</span>
                                <span className="text-sm font-semibold text-emerald-400">{sdr.conversao.toFixed(1)}%</span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-5 h-5 text-cyan-400" />
                    <h2 className="text-xl font-bold text-white">Ranking Completo</h2>
                  </div>
                  
                  <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-2xl overflow-hidden h-[calc(100%-3rem)]">
                    <div className="grid grid-cols-12 gap-2 p-3 bg-slate-800/50 text-xs font-semibold text-slate-400 uppercase">
                      <div className="col-span-1">#</div>
                      <div className="col-span-5">SDR</div>
                      <div className="col-span-2 text-right">Leads</div>
                      <div className="col-span-2 text-right">Reuniões</div>
                      <div className="col-span-2 text-right">Conv.</div>
                    </div>
                    
                    <div className="divide-y divide-slate-800/50 overflow-y-auto max-h-[calc(100%-3rem)]">
                      {sdrRanking.map((sdr, index) => (
                        <motion.div
                          key={sdr.name}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.05 * index }}
                          className={`grid grid-cols-12 gap-2 p-3 items-center ${
                            index < 3 ? 'bg-gradient-to-r ' + getPositionStyle(index + 1).bg : ''
                          }`}
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
                          <div className="col-span-5 font-medium text-white truncate text-sm">
                            {sdr.name}
                          </div>
                          <div className="col-span-2 text-right text-blue-400 text-sm">
                            {sdr.leads}
                          </div>
                          <div className="col-span-2 text-right font-bold text-cyan-400">
                            {sdr.reunioes}
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
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-center gap-3 mt-4">
          <div 
            className={`h-2 w-16 rounded-full transition-all duration-300 ${
              currentView === 'closers' ? 'bg-violet-500' : 'bg-slate-700'
            }`}
          />
          <div 
            className={`h-2 w-16 rounded-full transition-all duration-300 ${
              currentView === 'sdrs' ? 'bg-cyan-500' : 'bg-slate-700'
            }`}
          />
        </div>
      </div>
    </div>
  );
}
