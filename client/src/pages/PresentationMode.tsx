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
  Flame,
  Zap,
  TrendingUp,
  Repeat,
  UserPlus,
  CalendarCheck
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
        className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-r from-violet-600/15 to-purple-600/15 blur-[120px]"
        animate={{
          x: [0, 80, 0],
          y: [0, 40, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      <motion.div
        className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-gradient-to-r from-blue-600/12 to-cyan-600/12 blur-[100px]"
        animate={{
          x: [0, -60, 0],
          y: [0, -40, 0],
          scale: [1, 1.15, 1],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
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
    .map(c => ({
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
    .map(s => ({
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

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Crown className="w-5 h-5 text-amber-400" />;
      case 2:
        return <Medal className="w-4 h-4 text-slate-300" />;
      case 3:
        return <Medal className="w-4 h-4 text-amber-600" />;
      default:
        return null;
    }
  };

  const getPositionBg = (position: number) => {
    switch (position) {
      case 1:
        return "from-amber-500/20 to-yellow-500/10 border-amber-400/40";
      case 2:
        return "from-slate-400/15 to-gray-400/10 border-slate-400/30";
      case 3:
        return "from-amber-700/15 to-orange-700/10 border-amber-600/30";
      default:
        return "from-slate-800/40 to-slate-900/40 border-slate-700/30";
    }
  };

  return (
    <div 
      ref={containerRef}
      className="h-screen w-screen bg-[#0A0A0F] relative overflow-hidden"
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
            className="absolute top-3 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 backdrop-blur-md rounded-full border border-slate-700/50">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setCurrentView('closers');
                  setCountdown(ROTATION_INTERVAL / 1000);
                }}
                className={`h-7 w-7 ${currentView === 'closers' ? 'bg-violet-600 text-white' : 'text-slate-400'}`}
                data-testid="button-view-closers"
              >
                <Handshake className="w-3.5 h-3.5" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsPaused(p => !p)}
                className="h-7 w-7 text-slate-300"
                data-testid="button-toggle-pause"
              >
                {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </Button>
              <span className="text-xs text-slate-400 w-6 text-center font-mono">{countdown}s</span>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setCurrentView('sdrs');
                  setCountdown(ROTATION_INTERVAL / 1000);
                }}
                className={`h-7 w-7 ${currentView === 'sdrs' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}
                data-testid="button-view-sdrs"
              >
                <Users className="w-3.5 h-3.5" />
              </Button>

              <div className="w-px h-5 bg-slate-700" />

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="h-7 w-7 text-slate-300"
                data-testid="button-toggle-fullscreen"
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/dashboard/comercial/closers')}
                className="h-7 w-7 text-slate-400 hover:text-red-400"
                data-testid="button-exit-presentation"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 h-full w-full p-4 flex flex-col">
        <AnimatePresence mode="wait">
          {currentView === 'closers' ? (
            <motion.div
              key="closers"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.4 }}
              className="flex-1 flex flex-col h-full"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 shadow-lg shadow-violet-500/20">
                    <Handshake className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400">
                      Dashboard Closers
                    </h1>
                    <p className="text-sm text-slate-400 capitalize">{mesAtual}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white font-mono">
                    {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-xs text-slate-400">
                    {currentTime.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-3 mb-3">
                {[
                  { label: "MRR Obtido", value: formatCurrency(closerMetrics?.mrrObtido || 0), icon: Repeat, gradient: "from-emerald-600/25 to-teal-600/15", color: "text-emerald-400" },
                  { label: "Pontual", value: formatCurrency(closerMetrics?.pontualObtido || 0), icon: DollarSign, gradient: "from-blue-600/25 to-indigo-600/15", color: "text-blue-400" },
                  { label: "Reuniões", value: closerMetrics?.reunioesRealizadas || 0, icon: CalendarCheck, gradient: "from-violet-600/25 to-purple-600/15", color: "text-violet-400" },
                  { label: "Negócios", value: closerMetrics?.negociosGanhos || 0, icon: Handshake, gradient: "from-amber-600/25 to-orange-600/15", color: "text-amber-400" },
                  { label: "Conversão", value: `${(closerMetrics?.taxaConversao || 0).toFixed(1)}%`, icon: Target, gradient: "from-rose-600/25 to-pink-600/15", color: "text-rose-400" },
                ].map((kpi, i) => (
                  <motion.div
                    key={kpi.label}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 * i }}
                    className={`rounded-xl bg-gradient-to-br ${kpi.gradient} border border-white/10 backdrop-blur-sm p-3`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                      <span className="text-xs text-slate-300">{kpi.label}</span>
                    </div>
                    <div className="text-2xl font-black text-white">{kpi.value}</div>
                  </motion.div>
                ))}
              </div>

              <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">
                <div className="col-span-8 flex flex-col min-h-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Flame className="w-4 h-4 text-orange-400" />
                    <h2 className="text-lg font-bold text-white">Pódio</h2>
                  </div>
                  
                  <div className="flex-1 flex items-end justify-center gap-4 pb-2">
                    {[1, 0, 2].map((idx, visualIdx) => {
                      const closer = closerRanking[idx];
                      if (!closer) return null;
                      const heights = ['h-[85%]', 'h-full', 'h-[70%]'];
                      const widths = ['w-44', 'w-48', 'w-40'];
                      
                      return (
                        <motion.div
                          key={closer.name}
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.15 + visualIdx * 0.1 }}
                          className={`${heights[visualIdx]} ${widths[visualIdx]} flex flex-col`}
                        >
                          <div className={`flex-1 rounded-xl bg-gradient-to-b ${getPositionBg(closer.position)} border backdrop-blur-sm p-3 flex flex-col`}>
                            <div className="flex items-center justify-between mb-2">
                              {getPositionIcon(closer.position)}
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/20 text-white/70">
                                #{closer.position}
                              </Badge>
                            </div>
                            <h3 className="text-base font-bold text-white mb-auto truncate">
                              {closer.name.split(' ').slice(0, 2).join(' ')}
                            </h3>
                            <div className="space-y-1.5 mt-2">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-400">MRR</span>
                                <span className="text-sm font-bold text-emerald-400">{formatCurrency(closer.mrr)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-400">Pontual</span>
                                <span className="text-sm font-bold text-blue-400">{formatCurrency(closer.pontual)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-400">Negócios</span>
                                <span className="text-sm font-bold text-amber-400">{closer.negocios}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-400">Conversão</span>
                                <span className="text-xs font-semibold text-rose-400">{closer.taxa.toFixed(1)}%</span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                <div className="col-span-4 flex flex-col min-h-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-violet-400" />
                    <h2 className="text-lg font-bold text-white">Ranking Completo</h2>
                  </div>
                  
                  <div className="flex-1 bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl overflow-hidden">
                    <div className="h-full overflow-y-auto">
                      {closerRanking.map((closer, index) => (
                        <motion.div
                          key={closer.name}
                          initial={{ opacity: 0, x: 15 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.03 * index }}
                          className={`flex items-center gap-2 px-3 py-2 border-b border-slate-800/30 ${index < 3 ? `bg-gradient-to-r ${getPositionBg(index + 1)}` : ''}`}
                        >
                          <div className="w-6 flex justify-center">
                            {getPositionIcon(closer.position) || (
                              <span className="text-xs text-slate-500 font-mono">{closer.position}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-medium text-white truncate block">{closer.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-emerald-400">{formatCurrency(closer.total)}</span>
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
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.4 }}
              className="flex-1 flex flex-col h-full"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-600 to-teal-600 shadow-lg shadow-cyan-500/20">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400">
                      Dashboard SDRs
                    </h1>
                    <p className="text-sm text-slate-400 capitalize">{mesAtual}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white font-mono">
                    {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-xs text-slate-400">
                    {currentTime.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-3">
                {[
                  { label: "Leads Gerados", value: sdrMetrics?.leadsTotais || 0, icon: UserPlus, gradient: "from-cyan-600/25 to-teal-600/15", color: "text-cyan-400" },
                  { label: "Reuniões Realizadas", value: sdrMetrics?.reunioesRealizadas || 0, icon: CalendarCheck, gradient: "from-violet-600/25 to-purple-600/15", color: "text-violet-400" },
                  { label: "Taxa de Conversão", value: `${(sdrMetrics?.taxaConversao || 0).toFixed(1)}%`, icon: TrendingUp, gradient: "from-emerald-600/25 to-green-600/15", color: "text-emerald-400" },
                ].map((kpi, i) => (
                  <motion.div
                    key={kpi.label}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 * i }}
                    className={`rounded-xl bg-gradient-to-br ${kpi.gradient} border border-white/10 backdrop-blur-sm p-4`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                      <span className="text-sm text-slate-300">{kpi.label}</span>
                    </div>
                    <div className="text-3xl font-black text-white">{kpi.value}</div>
                  </motion.div>
                ))}
              </div>

              <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">
                <div className="col-span-8 flex flex-col min-h-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Flame className="w-4 h-4 text-orange-400" />
                    <h2 className="text-lg font-bold text-white">Pódio</h2>
                  </div>
                  
                  <div className="flex-1 flex items-end justify-center gap-4 pb-2">
                    {[1, 0, 2].map((idx, visualIdx) => {
                      const sdr = sdrRanking[idx];
                      if (!sdr) return null;
                      const heights = ['h-[85%]', 'h-full', 'h-[70%]'];
                      const widths = ['w-44', 'w-48', 'w-40'];
                      
                      return (
                        <motion.div
                          key={sdr.name}
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.15 + visualIdx * 0.1 }}
                          className={`${heights[visualIdx]} ${widths[visualIdx]} flex flex-col`}
                        >
                          <div className={`flex-1 rounded-xl bg-gradient-to-b ${getPositionBg(sdr.position)} border backdrop-blur-sm p-3 flex flex-col`}>
                            <div className="flex items-center justify-between mb-2">
                              {getPositionIcon(sdr.position)}
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/20 text-white/70">
                                #{sdr.position}
                              </Badge>
                            </div>
                            <h3 className="text-base font-bold text-white mb-auto truncate">
                              {sdr.name.split(' ').slice(0, 2).join(' ')}
                            </h3>
                            <div className="space-y-2 mt-2">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-400">Leads</span>
                                <span className="text-lg font-bold text-cyan-400">{sdr.leads}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-400">Reuniões</span>
                                <span className="text-lg font-bold text-violet-400">{sdr.reunioes}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-400">Conversão</span>
                                <span className="text-sm font-semibold text-emerald-400">{sdr.conversao.toFixed(1)}%</span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                <div className="col-span-4 flex flex-col min-h-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    <h2 className="text-lg font-bold text-white">Ranking Completo</h2>
                  </div>
                  
                  <div className="flex-1 bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl overflow-hidden">
                    <div className="h-full overflow-y-auto">
                      {sdrRanking.map((sdr, index) => (
                        <motion.div
                          key={sdr.name}
                          initial={{ opacity: 0, x: 15 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.03 * index }}
                          className={`flex items-center gap-2 px-3 py-2 border-b border-slate-800/30 ${index < 3 ? `bg-gradient-to-r ${getPositionBg(index + 1)}` : ''}`}
                        >
                          <div className="w-6 flex justify-center">
                            {getPositionIcon(sdr.position) || (
                              <span className="text-xs text-slate-500 font-mono">{sdr.position}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-medium text-white truncate block">{sdr.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="text-[10px] text-slate-500">Leads</span>
                              <span className="text-xs font-bold text-cyan-400 ml-1">{sdr.leads}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-slate-500">Reuniões</span>
                              <span className="text-xs font-bold text-violet-400 ml-1">{sdr.reunioes}</span>
                            </div>
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
      </div>
    </div>
  );
}
