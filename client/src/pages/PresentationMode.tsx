import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePageTitle } from "@/hooks/use-page-title";
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
  Headphones,
  BarChart3,
  Shield,
  Wallet,
  ArrowLeftRight,
  Megaphone,
  Construction,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { DealCelebration } from "@/components/DealCelebration";
import { formatCurrency, formatCurrencyCompact, formatDecimal, formatPercent } from "@/lib/utils";
import turboLogo from "@assets/Logo-Turbo-branca_(1)_1766081013390.png";

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

interface VisaoGeralMetricas {
  receitaTotal: number;
  mrr: number;
  aquisicaoMrr: number;
  aquisicaoPontual: number;
  cac: number;
  churn: number;
  pausados: number;
}

interface ChurnPorServico {
  servico: string;
  mes: string;
  quantidade: number;
  valorTotal: number;
  percentualChurn: number;
  valorAtivoMes: number;
}

interface ChurnPorResponsavel {
  responsavel: string;
  quantidadeContratos: number;
  valorTotal: number;
  percentualChurn: number;
  valorAtivoTotal: number;
}

interface FinanceiroKPIs {
  saldoTotal: number;
  aReceberTotal: number;
  aReceberQtd: number;
  aReceberVencidosQtd: number;
  aReceberVencidoValor: number;
  aPagarTotal: number;
  aPagarQtd: number;
  aPagarVencidosQtd: number;
  aPagarVencidoValor: number;
  receitaMesAtual: number;
  despesaMesAtual: number;
  receitaMesAnterior: number;
  despesaMesAnterior: number;
  lucroMesAtual: number;
}

interface FluxoCaixaInsights {
  saldoHoje: number;
  saldoFuturo30Dias: number;
  entradasPrevistas30Dias: number;
  saidasPrevistas30Dias: number;
  entradasVencidas: number;
  saidasVencidas: number;
  diasAteNegativo: number | null;
}

interface FluxoProximosDias {
  data: string;
  tipo: 'RECEITA' | 'DESPESA';
  valor: number;
}

interface MetaOverview {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalReach: number;
  avgCtr: number;
  avgCpc: number;
  avgCpm: number;
  totalLeads: number;
  totalWon: number;
  totalWonValue: number;
  roas: number;
  costPerLead: number;
  cac: number;
  conversionRate: number;
}

type DashboardView = 'closers' | 'sdrs' | 'visao-geral' | 'retencao' | 'financeiro-resumo' | 'fluxo-caixa' | 'growth-visao-geral';

const ALL_DASHBOARD_VIEWS: DashboardView[] = ['closers', 'sdrs', 'visao-geral', 'retencao', 'financeiro-resumo', 'fluxo-caixa', 'growth-visao-geral'];

interface PresentationConfig {
  dashboards: string[];
  interval: number;
}

export default function PresentationMode() {
  usePageTitle("Modo Apresentação");
  const [, navigate] = useLocation();
  const [config, setConfig] = useState<PresentationConfig>({
    dashboards: ['closers', 'sdrs'],
    interval: 30000
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentViewIndex, setCurrentViewIndex] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [countdown, setCountdown] = useState(30);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const activeDashboards = config.dashboards.filter(d => ALL_DASHBOARD_VIEWS.includes(d as DashboardView)) as DashboardView[];
  const currentView = activeDashboards[currentViewIndex] || 'closers';

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

  const { data: closerPhotos } = useQuery<Record<string, string>>({
    queryKey: ["/api/closers/photos"],
    queryFn: async () => {
      const res = await fetch("/api/closers/photos");
      return res.json();
    },
    refetchInterval: 300000,
  });

  const { data: sdrPhotos } = useQuery<Record<string, string>>({
    queryKey: ["/api/sdrs/photos"],
    queryFn: async () => {
      const res = await fetch("/api/sdrs/photos");
      return res.json();
    },
    refetchInterval: 300000,
  });

  const mesAnoAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

  const { data: visaoGeralMetricas, isLoading: isLoadingVisaoGeral } = useQuery<VisaoGeralMetricas>({
    queryKey: ["/api/visao-geral/metricas", mesAnoAtual],
    queryFn: async () => {
      const res = await fetch(`/api/visao-geral/metricas?mesAno=${mesAnoAtual}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: churnPorServico, isLoading: isLoadingChurnServico } = useQuery<ChurnPorServico[]>({
    queryKey: ["/api/churn-por-servico"],
    queryFn: async () => {
      const res = await fetch("/api/churn-por-servico");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: churnPorResponsavel, isLoading: isLoadingChurnResponsavel } = useQuery<ChurnPorResponsavel[]>({
    queryKey: ["/api/churn-por-responsavel"],
    queryFn: async () => {
      const res = await fetch("/api/churn-por-responsavel");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: financeiroKPIs, isLoading: isLoadingFinanceiroKPIs } = useQuery<FinanceiroKPIs>({
    queryKey: ["/api/financeiro/kpis-completos"],
    queryFn: async () => {
      const res = await fetch("/api/financeiro/kpis-completos");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: fluxoCaixaInsights, isLoading: isLoadingFluxoCaixa } = useQuery<FluxoCaixaInsights>({
    queryKey: ["/api/fluxo-caixa/insights"],
    queryFn: async () => {
      const res = await fetch("/api/fluxo-caixa/insights");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: fluxoProximosDias, isLoading: isLoadingFluxoProximosDias } = useQuery<FluxoProximosDias[]>({
    queryKey: ["/api/financeiro/fluxo-proximos-dias"],
    queryFn: async () => {
      const res = await fetch("/api/financeiro/fluxo-proximos-dias?dias=7");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const metaAdsQueryParams = new URLSearchParams({
    startDate: inicioMes,
    endDate: fimMes,
  }).toString();

  const { data: metaAdsOverview, isLoading: isLoadingMetaAds } = useQuery<MetaOverview>({
    queryKey: ["/api/meta-ads/overview", metaAdsQueryParams],
    queryFn: async () => {
      const res = await fetch(`/api/meta-ads/overview?${metaAdsQueryParams}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

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
      case 1: return <Crown className="w-10 h-10 text-orange-400 drop-shadow-[0_0_12px_rgba(251,146,60,0.8)]" />;
      case 2: return <Medal className="w-9 h-9 text-slate-300 drop-shadow-[0_0_8px_rgba(203,213,225,0.6)]" />;
      case 3: return <Medal className="w-8 h-8 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" />;
      default: return null;
    }
  };

  const getPositionGradient = (position: number) => {
    switch (position) {
      case 1: return "from-orange-500/30 via-amber-500/20 to-yellow-500/30";
      case 2: return "from-slate-400/25 via-slate-500/15 to-slate-400/25";
      case 3: return "from-amber-600/25 via-orange-500/15 to-amber-600/25";
      default: return "from-slate-800/50 to-slate-900/50";
    }
  };

  const getPositionBorder = (position: number) => {
    switch (position) {
      case 1: return "border-orange-500/60 shadow-[0_0_30px_rgba(249,115,22,0.4)]";
      case 2: return "border-slate-400/50 shadow-[0_0_20px_rgba(148,163,184,0.3)]";
      case 3: return "border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.3)]";
      default: return "border-slate-700/50";
    }
  };

  const getPositionGlow = (position: number) => {
    switch (position) {
      case 1: return "animate-pulse shadow-[0_0_40px_rgba(249,115,22,0.5),0_0_80px_rgba(249,115,22,0.2)]";
      case 2: return "shadow-[0_0_25px_rgba(148,163,184,0.3)]";
      case 3: return "shadow-[0_0_25px_rgba(245,158,11,0.3)]";
      default: return "";
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
    const stored = sessionStorage.getItem("presentationConfig");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setConfig(parsed);
        setCountdown(parsed.interval / 1000);
      } catch (e) {
        console.error("Failed to parse presentation config", e);
      }
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isPaused || activeDashboards.length <= 1) return;

    const rotationTimer = setInterval(() => {
      setCurrentViewIndex(prev => (prev + 1) % activeDashboards.length);
      setCountdown(config.interval / 1000);
    }, config.interval);

    const countdownTimer = setInterval(() => {
      setCountdown(prev => prev > 0 ? prev - 1 : config.interval / 1000);
    }, 1000);

    return () => {
      clearInterval(rotationTimer);
      clearInterval(countdownTimer);
    };
  }, [isPaused, config.interval, activeDashboards.length]);

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
        setCurrentViewIndex(prev => (prev - 1 + activeDashboards.length) % activeDashboards.length);
        setCountdown(config.interval / 1000);
      }
      if (e.key === 'ArrowRight') {
        setCurrentViewIndex(prev => (prev + 1) % activeDashboards.length);
        setCountdown(config.interval / 1000);
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

  const getDashboardTitle = (view: DashboardView) => {
    switch (view) {
      case 'closers': return 'Dashboard Closers';
      case 'sdrs': return 'Dashboard SDRs';
      case 'visao-geral': return 'Visão Geral';
      case 'retencao': return 'Análise de Retenção';
      case 'financeiro-resumo': return 'Resumo Financeiro';
      case 'fluxo-caixa': return 'Fluxo de Caixa';
      case 'growth-visao-geral': return 'Growth Overview';
      default: return 'Dashboard';
    }
  };

  return (
    <div 
      ref={containerRef}
      className="h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-white overflow-hidden relative flex flex-col"
      data-testid="presentation-mode-container"
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-20 left-1/4 w-[500px] h-[500px] bg-orange-600/8 rounded-full blur-[120px] transition-all duration-1000`} />
        <div className={`absolute -bottom-20 right-1/4 w-[500px] h-[500px] bg-amber-500/8 rounded-full blur-[120px] transition-all duration-1000`} />
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] ${currentView === 'closers' ? 'bg-orange-500/5' : 'bg-cyan-500/5'} rounded-full blur-[150px] transition-colors duration-1000`} />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0)_0%,rgba(0,0,0,0.3)_100%)]" />
      </div>

      <DealCelebration />

      <motion.header 
        className="relative z-20 flex items-center justify-between px-6 py-4 border-b border-slate-800/50 bg-slate-950/40 backdrop-blur-xl"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        data-testid="presentation-header"
      >
        <div className="flex items-center gap-6">
          <motion.img 
            src={turboLogo} 
            alt="Turbo Partners" 
            className="h-10 w-auto drop-shadow-[0_0_10px_rgba(249,115,22,0.3)]"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            data-testid="img-turbo-logo"
          />
          <div className="h-8 w-px bg-gradient-to-b from-transparent via-slate-600 to-transparent" />
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-orange-100 to-orange-300 bg-clip-text text-transparent tracking-tight">
              {getDashboardTitle(currentView)}
            </h1>
            <p className="text-sm text-slate-400 capitalize">{mesAtual}</p>
          </motion.div>
        </div>

        <motion.div 
          className="flex items-center gap-4"
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/60 border border-slate-700/50">
            <Clock className="w-5 h-5 text-orange-400" />
            <div className="text-right">
              <div className="text-3xl font-mono font-bold text-white tracking-wider">
                {currentTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">
                {currentTime.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" })}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.header>

      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-3 px-5 py-3 bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl shadow-black/50">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setCurrentViewIndex(prev => (prev - 1 + activeDashboards.length) % activeDashboards.length);
                  setCountdown(config.interval / 1000);
                }}
                className="h-10 w-10 text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 transition-all"
                data-testid="button-view-prev"
              >
                <ChevronDown className="w-5 h-5 rotate-90" />
              </Button>
              
              <div className="flex items-center gap-2 px-3">
                {activeDashboards.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setCurrentViewIndex(idx);
                      setCountdown(config.interval / 1000);
                    }}
                    className={`transition-all duration-300 ${
                      idx === currentViewIndex 
                        ? 'w-8 h-3 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 shadow-[0_0_12px_rgba(249,115,22,0.5)]' 
                        : 'w-3 h-3 rounded-full bg-slate-600 hover:bg-slate-400'
                    }`}
                  />
                ))}
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setCurrentViewIndex(prev => (prev + 1) % activeDashboards.length);
                  setCountdown(config.interval / 1000);
                }}
                className="h-10 w-10 text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 transition-all"
                data-testid="button-view-next"
              >
                <ChevronUp className="w-5 h-5 rotate-90" />
              </Button>

              <div className="w-px h-8 bg-gradient-to-b from-transparent via-slate-600 to-transparent" />
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsPaused(p => !p)}
                className={`h-10 w-10 transition-all ${isPaused ? 'text-orange-400 bg-orange-500/20' : 'text-slate-300 hover:text-white'}`}
                data-testid="button-toggle-pause"
              >
                {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
              </Button>
              
              <div className="flex flex-col items-center justify-center min-w-[48px]">
                <span className="text-lg font-mono font-bold text-white">{countdown}</span>
                <span className="text-[10px] text-slate-500 uppercase">seg</span>
              </div>

              <div className="w-px h-8 bg-gradient-to-b from-transparent via-slate-600 to-transparent" />

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="h-10 w-10 text-slate-300 hover:text-orange-400 hover:bg-orange-500/10 transition-all"
                data-testid="button-toggle-fullscreen"
              >
                {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/dashboard/comercial/closers')}
                className="h-10 w-10 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                data-testid="button-exit-presentation"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex-1 flex flex-col p-5 lg:p-6 overflow-hidden">
        <AnimatePresence mode="wait">
          {currentView === 'closers' && (
            <motion.div
              key="closers"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full flex flex-col gap-4"
            >
              <div className="grid grid-cols-5 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.5 }}
                  className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-600/25 via-amber-600/15 to-yellow-600/20 border border-orange-500/40 p-4 shadow-lg shadow-orange-500/10"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-400/5 to-transparent" />
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 rounded-lg bg-orange-500/30">
                        <Repeat className="w-5 h-5 text-orange-400" />
                      </div>
                      <span className="text-sm font-semibold text-orange-200 uppercase tracking-wide">MRR Obtido</span>
                    </div>
                    {isLoadingClosers ? (
                      <Skeleton className="h-12 w-28 bg-slate-700" />
                    ) : (
                      <motion.div 
                        className="text-4xl lg:text-5xl font-black text-white drop-shadow-lg"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        key={closerMetrics?.mrrObtido}
                      >
                        {formatCurrencyCompact(closerMetrics?.mrrObtido || 0)}
                      </motion.div>
                    )}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.5 }}
                  className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-600/25 via-yellow-600/15 to-orange-600/20 border border-amber-500/40 p-4 shadow-lg shadow-amber-500/10"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-400/5 to-transparent" />
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 rounded-lg bg-amber-500/30">
                        <DollarSign className="w-5 h-5 text-amber-400" />
                      </div>
                      <span className="text-sm font-semibold text-amber-200 uppercase tracking-wide">Pontual</span>
                    </div>
                    {isLoadingClosers ? (
                      <Skeleton className="h-12 w-28 bg-slate-700" />
                    ) : (
                      <motion.div 
                        className="text-4xl lg:text-5xl font-black text-white drop-shadow-lg"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        key={closerMetrics?.pontualObtido}
                      >
                        {formatCurrencyCompact(closerMetrics?.pontualObtido || 0)}
                      </motion.div>
                    )}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600/25 via-purple-600/15 to-indigo-600/20 border border-violet-500/40 p-4 shadow-lg shadow-violet-500/10"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-400/5 to-transparent" />
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 rounded-lg bg-violet-500/30">
                        <Users className="w-5 h-5 text-violet-400" />
                      </div>
                      <span className="text-sm font-semibold text-violet-200 uppercase tracking-wide">Reuniões</span>
                    </div>
                    {isLoadingClosers ? (
                      <Skeleton className="h-12 w-20 bg-slate-700" />
                    ) : (
                      <motion.div 
                        className="text-4xl lg:text-5xl font-black text-white drop-shadow-lg"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        key={closerMetrics?.reunioesRealizadas}
                      >
                        {closerMetrics?.reunioesRealizadas || 0}
                      </motion.div>
                    )}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.5 }}
                  className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600/25 via-teal-600/15 to-cyan-600/20 border border-emerald-500/40 p-4 shadow-lg shadow-emerald-500/10"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/5 to-transparent" />
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 rounded-lg bg-emerald-500/30">
                        <Handshake className="w-5 h-5 text-emerald-400" />
                      </div>
                      <span className="text-sm font-semibold text-emerald-200 uppercase tracking-wide">Negócios</span>
                    </div>
                    {isLoadingClosers ? (
                      <Skeleton className="h-12 w-20 bg-slate-700" />
                    ) : (
                      <motion.div 
                        className="text-4xl lg:text-5xl font-black text-white drop-shadow-lg"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        key={closerMetrics?.negociosGanhos}
                      >
                        {closerMetrics?.negociosGanhos || 0}
                      </motion.div>
                    )}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-600/25 via-blue-600/15 to-indigo-600/20 border border-cyan-500/40 p-4 shadow-lg shadow-cyan-500/10"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/5 to-transparent" />
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 rounded-lg bg-cyan-500/30">
                        <Target className="w-5 h-5 text-cyan-400" />
                      </div>
                      <span className="text-sm font-semibold text-cyan-200 uppercase tracking-wide">Conversão</span>
                    </div>
                    {isLoadingClosers ? (
                      <Skeleton className="h-12 w-20 bg-slate-700" />
                    ) : (
                      <motion.div 
                        className="text-4xl lg:text-5xl font-black text-white drop-shadow-lg"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        key={closerMetrics?.taxaConversao}
                      >
                        {formatPercent(closerMetrics?.taxaConversao || 0)}
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              </div>

              <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-5 min-h-0">
                <div className="lg:col-span-2 flex flex-col">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/30 to-amber-500/20 border border-orange-500/30">
                      <Trophy className="w-6 h-6 text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.6)]" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Pódio dos Campeões</h2>
                    <motion.div
                      animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.1, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 2 }}
                    >
                      <Flame className="w-6 h-6 text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                    </motion.div>
                  </div>

                  {isLoadingClosers ? (
                    <div className="flex-1 grid grid-cols-3 gap-4">
                      {[0, 1, 2].map(i => (
                        <Skeleton key={i} className="bg-slate-800 rounded-2xl" />
                      ))}
                    </div>
                  ) : closerTop3.length > 0 ? (
                    <div className="flex-1 grid grid-cols-3 gap-4 items-end">
                      {[1, 0, 2].map((orderIndex) => {
                        const closer = closerTop3[orderIndex];
                        if (!closer) return <div key={orderIndex} />;
                        
                        const isFirst = closer.position === 1;
                        const heightPercents = { 0: '100%', 1: '88%', 2: '76%' };
                        
                        return (
                          <motion.div
                            key={closer.name}
                            initial={{ opacity: 0, y: 60, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ delay: 0.4 + orderIndex * 0.15, duration: 0.6, ease: "easeOut" }}
                            className="relative"
                            style={{ height: heightPercents[orderIndex as keyof typeof heightPercents] }}
                          >
                            <div 
                              className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${getPositionGradient(closer.position)} border-2 ${getPositionBorder(closer.position)} ${getPositionGlow(closer.position)} backdrop-blur-sm overflow-hidden transition-all duration-500`}
                            >
                              {isFirst && (
                                <div className="absolute inset-0 overflow-hidden">
                                  <motion.div
                                    className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-400/15 to-transparent"
                                    animate={{ x: ["-100%", "100%"] }}
                                    transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1 }}
                                  />
                                </div>
                              )}

                              <div className="relative p-5 h-full flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                  <motion.div 
                                    className={`flex items-center justify-center w-14 h-14 rounded-xl ${
                                      closer.position === 1 ? 'bg-gradient-to-br from-orange-500/30 to-amber-500/20 border border-orange-500/40' :
                                      closer.position === 2 ? 'bg-gradient-to-br from-slate-400/30 to-slate-500/20 border border-slate-400/40' : 
                                      'bg-gradient-to-br from-amber-600/30 to-amber-700/20 border border-amber-500/40'
                                    }`}
                                    animate={isFirst ? { scale: [1, 1.05, 1] } : {}}
                                    transition={{ duration: 2, repeat: Infinity }}
                                  >
                                    {closer.position === 1 && <Crown className="w-8 h-8 text-orange-400 drop-shadow-[0_0_10px_rgba(251,146,60,0.8)]" />}
                                    {closer.position === 2 && <Medal className="w-7 h-7 text-slate-300 drop-shadow-[0_0_6px_rgba(203,213,225,0.6)]" />}
                                    {closer.position === 3 && <Medal className="w-7 h-7 text-amber-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]" />}
                                  </motion.div>
                                  <div className={`text-sm font-black uppercase tracking-wider ${
                                    closer.position === 1 ? 'text-orange-400' :
                                    closer.position === 2 ? 'text-slate-300' : 'text-amber-500'
                                  }`}>
                                    {closer.position === 1 ? 'CAMPEÃO' : 
                                     closer.position === 2 ? 'VICE' : 'BRONZE'}
                                  </div>
                                </div>

                                <div className="flex items-center gap-4 mb-4">
                                  {closerPhotos?.[closer.name] ? (
                                    <img 
                                      src={closerPhotos[closer.name]} 
                                      alt={closer.name}
                                      className={`w-16 h-16 rounded-full object-cover border-3 shadow-lg ${
                                        closer.position === 1 ? 'border-orange-400 shadow-orange-500/30' :
                                        closer.position === 2 ? 'border-slate-300 shadow-slate-400/20' : 'border-amber-500 shadow-amber-500/20'
                                      }`}
                                    />
                                  ) : (
                                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black ${
                                      closer.position === 1 ? 'bg-gradient-to-br from-orange-500/30 to-amber-500/20 text-orange-400 border-2 border-orange-500/40' :
                                      closer.position === 2 ? 'bg-gradient-to-br from-slate-400/30 to-slate-500/20 text-slate-300 border-2 border-slate-400/40' : 
                                      'bg-gradient-to-br from-amber-600/30 to-amber-700/20 text-amber-500 border-2 border-amber-500/40'
                                    }`}>
                                      {closer.name.charAt(0)}
                                    </div>
                                  )}
                                  <h3 className="text-lg lg:text-xl font-black text-white truncate flex-1">
                                    {closer.name}
                                  </h3>
                                </div>

                                <div className="flex-1 space-y-3">
                                  <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900/40">
                                    <span className="text-sm text-slate-400 font-medium">Total</span>
                                    <span className="text-xl font-black text-white">
                                      {formatCurrencyCompact(closer.total)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-400">MRR</span>
                                    <span className="text-base font-bold text-orange-400">
                                      {formatCurrencyCompact(closer.mrr)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-400">Pontual</span>
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
                                    <div className="text-base font-bold text-white">{formatPercent(closer.taxa)}</div>
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

                <div className="flex flex-col gap-4 overflow-hidden">
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-gradient-to-br from-orange-500/30 to-amber-500/20 border border-orange-500/30">
                        <Zap className="w-5 h-5 text-orange-400 drop-shadow-[0_0_6px_rgba(251,146,60,0.6)]" />
                      </div>
                      <h2 className="text-lg font-bold text-white">Ranking Completo</h2>
                    </div>

                    <div className="flex-1 bg-slate-900/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden flex flex-col shadow-xl">
                      <div className="flex items-center gap-1 p-2 bg-gradient-to-r from-slate-800/80 to-slate-800/50 text-[8px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700/30">
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
                                  {closer.position === 1 && <Crown className="w-4 h-4 text-orange-400 drop-shadow-[0_0_4px_rgba(251,146,60,0.6)]" />}
                                  {closer.position === 2 && <Medal className="w-3.5 h-3.5 text-slate-300" />}
                                  {closer.position === 3 && <Medal className="w-3.5 h-3.5 text-amber-500" />}
                                </div>
                              ) : (
                                <span className="text-slate-500 font-mono text-[10px]">{closer.position}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 font-semibold text-white truncate text-[11px]">
                              {closer.name}
                            </div>
                            <div className="w-12 text-right font-bold text-orange-400 text-[11px] shrink-0">
                              {formatCurrencyCompact(closer.mrr)}
                            </div>
                            <div className="w-12 text-right font-semibold text-amber-400 text-[11px] shrink-0">
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
                                {formatPercent(closer.taxa)}
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
                    <div className="mb-3 flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500/30 to-orange-500/20 border border-amber-500/30">
                        <Zap className="w-4 h-4 text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
                      </div>
                      <h2 className="text-sm font-bold text-white">Destaque Pontual</h2>
                      <Badge className="bg-amber-500/20 text-amber-400 text-[9px] border border-amber-500/30">Top Pontuais</Badge>
                    </div>

                    <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden shadow-lg">
                      {isLoadingClosers ? (
                        <div className="p-2 space-y-2">
                          {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-8 bg-slate-800 rounded-lg" />
                          ))}
                        </div>
                      ) : closerTop3Pontual.length > 0 ? (
                        <div className="divide-y divide-slate-700/30">
                          {closerTop3Pontual.map((closer, index) => (
                            <motion.div
                              key={closer.name}
                              initial={{ opacity: 0, x: 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.1 * index }}
                              className={`p-2.5 flex items-center gap-2 ${
                                index === 0 ? 'bg-gradient-to-r from-amber-500/20 to-transparent' : ''
                              }`}
                            >
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                index === 0 ? 'bg-amber-500/30 border border-amber-500/40' :
                                index === 1 ? 'bg-slate-600/30 border border-slate-500/30' :
                                'bg-orange-600/30 border border-orange-500/30'
                              }`}>
                                {index === 0 && <Crown className="w-4 h-4 text-amber-400 drop-shadow-[0_0_4px_rgba(245,158,11,0.6)]" />}
                                {index === 1 && <Medal className="w-3 h-3 text-slate-300" />}
                                {index === 2 && <Medal className="w-3 h-3 text-orange-400" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-white truncate text-xs">{closer.name}</div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-sm font-bold text-amber-400">{formatCurrencyCompact(closer.pontual)}</div>
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
                className="mt-3 relative"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.6 }}
              >
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800/90 to-slate-900 border border-orange-500/20 p-4 shadow-xl shadow-orange-500/5">
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 via-transparent to-orange-500/5" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <motion.div 
                          className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg shadow-orange-500/40"
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
                                {formatPercent(percentual)}
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
          )}
          {currentView === 'sdrs' && (
            <motion.div
              key="sdrs"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full flex flex-col gap-4"
            >
              <div className="grid grid-cols-3 gap-4">
                {[
                  { 
                    label: "Leads Criados", 
                    value: sdrMetrics?.leadsTotais || 0, 
                    icon: Users,
                    gradient: "from-orange-600/25 via-amber-600/15 to-yellow-600/20",
                    border: "border-orange-500/40",
                    iconBg: "bg-orange-500/30",
                    iconColor: "text-orange-400",
                    shadow: "shadow-orange-500/10",
                    format: (v: number) => v.toString()
                  },
                  { 
                    label: "Reuniões Realizadas", 
                    value: sdrMetrics?.reunioesRealizadas || 0, 
                    icon: CalendarCheck,
                    gradient: "from-cyan-600/25 via-teal-600/15 to-emerald-600/20",
                    border: "border-cyan-500/40",
                    iconBg: "bg-cyan-500/30",
                    iconColor: "text-cyan-400",
                    shadow: "shadow-cyan-500/10",
                    format: (v: number) => v.toString()
                  },
                  { 
                    label: "Taxa de Conversão", 
                    value: sdrMetrics?.taxaConversao || 0, 
                    icon: TrendingUp,
                    gradient: "from-emerald-600/25 via-teal-600/15 to-cyan-600/20",
                    border: "border-emerald-500/40",
                    iconBg: "bg-emerald-500/30",
                    iconColor: "text-emerald-400",
                    shadow: "shadow-emerald-500/10",
                    format: (v: number) => `${v.toFixed(1)}%`
                  },
                ].map((kpi, index) => (
                  <motion.div
                    key={kpi.label}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * index, duration: 0.5 }}
                  >
                    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${kpi.gradient} ${kpi.border} border p-5 shadow-lg ${kpi.shadow}`}>
                      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
                      
                      <div className="relative">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`p-2 rounded-lg ${kpi.iconBg}`}>
                            <kpi.icon className={`w-5 h-5 ${kpi.iconColor}`} />
                          </div>
                          <span className="text-sm font-semibold text-slate-200 uppercase tracking-wide">{kpi.label}</span>
                        </div>
                        
                        {isLoadingSDRs ? (
                          <Skeleton className="h-12 w-32 bg-slate-700" />
                        ) : (
                          <motion.div
                            className="text-4xl lg:text-5xl font-black text-white drop-shadow-lg"
                            initial={{ scale: 0.5 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200, delay: 0.2 + 0.1 * index }}
                          >
                            {kpi.format(kpi.value)}
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-5 min-h-0">
                <div className="flex flex-col min-h-0">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/30 to-amber-500/20 border border-orange-500/30">
                      <Trophy className="w-6 h-6 text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.6)]" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Pódio dos Campeões</h2>
                    <motion.div
                      animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.1, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 2 }}
                    >
                      <Flame className="w-6 h-6 text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                    </motion.div>
                  </div>
                  
                  {isLoadingSDRs ? (
                    <div className="grid grid-cols-3 gap-4">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-64 rounded-2xl bg-slate-800" />
                      ))}
                    </div>
                  ) : sdrTop3.length > 0 ? (
                    <div className="flex-1 grid grid-cols-3 gap-4 items-end">
                      {[1, 0, 2].map((orderIndex) => {
                        const sdr = sdrTop3[orderIndex];
                        if (!sdr) return <div key={orderIndex} />;
                        
                        const isFirst = sdr.position === 1;
                        const heightPercents = { 0: '100%', 1: '88%', 2: '76%' };
                        
                        return (
                          <motion.div
                            key={sdr.name}
                            initial={{ opacity: 0, y: 60, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ delay: 0.4 + orderIndex * 0.15, duration: 0.6, ease: "easeOut" }}
                            className="relative"
                            style={{ height: heightPercents[orderIndex as keyof typeof heightPercents] }}
                          >
                            <div 
                              className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${getPositionGradient(sdr.position)} border-2 ${getPositionBorder(sdr.position)} ${getPositionGlow(sdr.position)} backdrop-blur-sm overflow-hidden transition-all duration-500`}
                            >
                              {isFirst && (
                                <div className="absolute inset-0 overflow-hidden">
                                  <motion.div
                                    className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-400/15 to-transparent"
                                    animate={{ x: ["-100%", "100%"] }}
                                    transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1 }}
                                  />
                                </div>
                              )}

                              <div className="relative p-5 h-full flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                  <motion.div 
                                    className={`flex items-center justify-center w-14 h-14 rounded-xl ${
                                      sdr.position === 1 ? 'bg-gradient-to-br from-orange-500/30 to-amber-500/20 border border-orange-500/40' :
                                      sdr.position === 2 ? 'bg-gradient-to-br from-slate-400/30 to-slate-500/20 border border-slate-400/40' : 
                                      'bg-gradient-to-br from-amber-600/30 to-amber-700/20 border border-amber-500/40'
                                    }`}
                                    animate={isFirst ? { scale: [1, 1.05, 1] } : {}}
                                    transition={{ duration: 2, repeat: Infinity }}
                                  >
                                    {sdr.position === 1 && <Crown className="w-8 h-8 text-orange-400 drop-shadow-[0_0_10px_rgba(251,146,60,0.8)]" />}
                                    {sdr.position === 2 && <Medal className="w-7 h-7 text-slate-300 drop-shadow-[0_0_6px_rgba(203,213,225,0.6)]" />}
                                    {sdr.position === 3 && <Medal className="w-7 h-7 text-amber-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]" />}
                                  </motion.div>
                                  <div className={`text-sm font-black uppercase tracking-wider ${
                                    sdr.position === 1 ? 'text-orange-400' :
                                    sdr.position === 2 ? 'text-slate-300' : 'text-amber-500'
                                  }`}>
                                    {sdr.position === 1 ? 'CAMPEÃO' : 
                                     sdr.position === 2 ? 'VICE' : 'BRONZE'}
                                  </div>
                                </div>

                                <div className="flex items-center gap-4 mb-4">
                                  {sdrPhotos?.[sdr.name] ? (
                                    <img 
                                      src={sdrPhotos[sdr.name]} 
                                      alt={sdr.name}
                                      className={`w-16 h-16 rounded-full object-cover border-3 shadow-lg ${
                                        sdr.position === 1 ? 'border-orange-400 shadow-orange-500/30' :
                                        sdr.position === 2 ? 'border-slate-300 shadow-slate-400/20' : 'border-amber-500 shadow-amber-500/20'
                                      }`}
                                    />
                                  ) : (
                                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black ${
                                      sdr.position === 1 ? 'bg-gradient-to-br from-orange-500/30 to-amber-500/20 text-orange-400 border-2 border-orange-500/40' :
                                      sdr.position === 2 ? 'bg-gradient-to-br from-slate-400/30 to-slate-500/20 text-slate-300 border-2 border-slate-400/40' : 
                                      'bg-gradient-to-br from-amber-600/30 to-amber-700/20 text-amber-500 border-2 border-amber-500/40'
                                    }`}>
                                      {sdr.name.charAt(0)}
                                    </div>
                                  )}
                                  <h3 className="text-lg lg:text-xl font-black text-white truncate flex-1">
                                    {sdr.name}
                                  </h3>
                                </div>

                                <div className="flex-1 space-y-3">
                                  <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900/40">
                                    <span className="text-sm text-slate-400 font-medium">Reuniões</span>
                                    <span className="text-xl font-black text-orange-400">
                                      {sdr.reunioesRealizadas}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-400">MRR</span>
                                    <span className="text-base font-bold text-emerald-400">
                                      {formatCurrencyCompact(sdr.mrr)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-400">Pontual</span>
                                    <span className="text-base font-bold text-amber-400">
                                      {formatCurrencyCompact(sdr.pontual)}
                                    </span>
                                  </div>
                                </div>

                                <div className="mt-3 pt-3 border-t border-slate-700/50 grid grid-cols-3 gap-2 text-center">
                                  <div>
                                    <div className="text-lg font-bold text-white">{sdr.leads}</div>
                                    <div className="text-[10px] text-slate-400 uppercase font-medium">Leads</div>
                                  </div>
                                  <div>
                                    <div className="text-lg font-bold text-white">{sdr.contratos}</div>
                                    <div className="text-[10px] text-slate-400 uppercase font-medium">Contratos</div>
                                  </div>
                                  <div>
                                    <div className="text-lg font-bold text-white">{formatPercent(sdr.conversao)}</div>
                                    <div className="text-[10px] text-slate-400 uppercase font-medium">Conv.</div>
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

                <div className="flex flex-col min-h-0">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-orange-500/30 to-amber-500/20 border border-orange-500/30">
                      <Zap className="w-5 h-5 text-orange-400 drop-shadow-[0_0_6px_rgba(251,146,60,0.6)]" />
                    </div>
                    <h2 className="text-lg font-bold text-white">Ranking Completo</h2>
                  </div>

                  <div className="flex-1 bg-slate-900/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden flex flex-col min-h-0 shadow-xl">
                    <div className="grid grid-cols-12 gap-1 p-2 bg-gradient-to-r from-slate-800/80 to-slate-800/50 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700/30">
                      <div className="col-span-1">#</div>
                      <div className="col-span-2">SDR</div>
                      <div className="col-span-1 text-right">Leads</div>
                      <div className="col-span-1 text-right text-orange-400">Reuniões</div>
                      <div className="col-span-1 text-right">% RR/L</div>
                      <div className="col-span-1 text-right">Contr.</div>
                      <div className="col-span-1 text-right">% V/RR</div>
                      <div className="col-span-2 text-right">MRR</div>
                      <div className="col-span-2 text-right">Pontual</div>
                    </div>

                    <div className="flex-1 divide-y divide-slate-800/50 overflow-y-auto">
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
                            className={`grid grid-cols-12 gap-1 p-2 items-center hover:bg-slate-800/30 transition-colors ${
                              sdr.position <= 3 ? 'bg-gradient-to-r ' + getPositionGradient(sdr.position) : ''
                            }`}
                          >
                            <div className="col-span-1">
                              {sdr.position <= 3 ? (
                                <div className="w-5 h-5 flex items-center justify-center">
                                  {sdr.position === 1 && <Crown className="w-4 h-4 text-orange-400 drop-shadow-[0_0_4px_rgba(251,146,60,0.6)]" />}
                                  {sdr.position === 2 && <Medal className="w-3.5 h-3.5 text-slate-300" />}
                                  {sdr.position === 3 && <Medal className="w-3.5 h-3.5 text-amber-500" />}
                                </div>
                              ) : (
                                <span className="text-slate-500 font-mono text-xs">{sdr.position}</span>
                              )}
                            </div>
                            <div className="col-span-2 font-semibold text-white truncate text-xs">
                              {sdr.name}
                            </div>
                            <div className="col-span-1 text-right text-slate-300 text-xs">
                              {sdr.leads}
                            </div>
                            <div className="col-span-1 text-right font-black text-orange-400 text-sm">
                              {sdr.reunioesRealizadas}
                            </div>
                            <div className="col-span-1 text-right">
                              <Badge 
                                variant="outline" 
                                className={`text-[10px] border-0 px-1 ${
                                  convRRLead >= 30 ? 'bg-emerald-500/20 text-emerald-400' :
                                  convRRLead >= 15 ? 'bg-amber-500/20 text-amber-400' :
                                  'bg-slate-700/50 text-slate-400'
                                }`}
                              >
                                {formatPercent(convRRLead)}
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
                                {formatPercent(convVRR)}
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
                className="relative shrink-0"
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
                                {formatPercent(percentual)}
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

          {currentView === 'visao-geral' && (
            <motion.div
              key="visao-geral"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full flex flex-col gap-4"
            >
              <div className="flex-1 grid grid-cols-3 gap-5 lg:gap-6">
                {isLoadingVisaoGeral ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * i }}
                      className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-6"
                    >
                      <Skeleton className="h-6 w-24 bg-slate-700 mb-4" />
                      <Skeleton className="h-12 w-32 bg-slate-700 mb-2" />
                      <Skeleton className="h-4 w-20 bg-slate-700" />
                    </motion.div>
                  ))
                ) : (
                  <>
                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.1 }}
                      className="rounded-2xl bg-gradient-to-br from-emerald-600/30 via-emerald-500/20 to-teal-600/30 border border-emerald-500/40 p-6 shadow-xl shadow-emerald-500/10"
                      data-testid="card-mrr-ativo"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-emerald-500/30">
                          <DollarSign className="w-5 h-5 text-emerald-400" />
                        </div>
                        <span className="text-slate-300 font-medium text-sm uppercase tracking-wider">MRR Ativo</span>
                      </div>
                      <motion.div 
                        className="text-4xl lg:text-5xl font-black text-emerald-400"
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.3, type: "spring" }}
                      >
                        {formatCurrencyCompact(visaoGeralMetricas?.mrr || 0)}
                      </motion.div>
                      <div className="text-slate-400 text-sm mt-2 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <span>Receita Recorrente Mensal</span>
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.15 }}
                      className="rounded-2xl bg-gradient-to-br from-cyan-600/30 via-cyan-500/20 to-blue-600/30 border border-cyan-500/40 p-6 shadow-xl shadow-cyan-500/10"
                      data-testid="card-aquisicao-mrr"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-cyan-500/30">
                          <TrendingUp className="w-5 h-5 text-cyan-400" />
                        </div>
                        <span className="text-slate-300 font-medium text-sm uppercase tracking-wider">Aquisição MRR</span>
                      </div>
                      <motion.div 
                        className="text-4xl lg:text-5xl font-black text-cyan-400"
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.35, type: "spring" }}
                      >
                        {formatCurrencyCompact(visaoGeralMetricas?.aquisicaoMrr || 0)}
                      </motion.div>
                      <div className="text-slate-400 text-sm mt-2 flex items-center gap-1">
                        <Sparkles className="w-4 h-4 text-cyan-400" />
                        <span>Novos Contratos no Mês</span>
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.2 }}
                      className="rounded-2xl bg-gradient-to-br from-rose-600/30 via-rose-500/20 to-red-600/30 border border-rose-500/40 p-6 shadow-xl shadow-rose-500/10"
                      data-testid="card-churn-mrr"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-rose-500/30">
                          <TrendingUp className="w-5 h-5 text-rose-400 rotate-180" />
                        </div>
                        <span className="text-slate-300 font-medium text-sm uppercase tracking-wider">Churn MRR</span>
                      </div>
                      <motion.div 
                        className="text-4xl lg:text-5xl font-black text-rose-400"
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.4, type: "spring" }}
                      >
                        -{formatCurrencyCompact(visaoGeralMetricas?.churn || 0)}
                      </motion.div>
                      <div className="text-slate-400 text-sm mt-2 flex items-center gap-1">
                        <ChevronDown className="w-4 h-4 text-rose-400" />
                        <span>Perda de Receita</span>
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.25 }}
                      className="rounded-2xl bg-gradient-to-br from-violet-600/30 via-violet-500/20 to-purple-600/30 border border-violet-500/40 p-6 shadow-xl shadow-violet-500/10"
                      data-testid="card-receita-total"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-violet-500/30">
                          <Wallet className="w-5 h-5 text-violet-400" />
                        </div>
                        <span className="text-slate-300 font-medium text-sm uppercase tracking-wider">Receita Total</span>
                      </div>
                      <motion.div 
                        className="text-4xl lg:text-5xl font-black text-violet-400"
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.45, type: "spring" }}
                      >
                        {formatCurrencyCompact(visaoGeralMetricas?.receitaTotal || 0)}
                      </motion.div>
                      <div className="text-slate-400 text-sm mt-2 flex items-center gap-1">
                        <BarChart3 className="w-4 h-4 text-violet-400" />
                        <span>MRR + Pontual</span>
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.3 }}
                      className="rounded-2xl bg-gradient-to-br from-amber-600/30 via-amber-500/20 to-orange-600/30 border border-amber-500/40 p-6 shadow-xl shadow-amber-500/10"
                      data-testid="card-aquisicao-pontual"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-amber-500/30">
                          <Zap className="w-5 h-5 text-amber-400" />
                        </div>
                        <span className="text-slate-300 font-medium text-sm uppercase tracking-wider">Aquisição Pontual</span>
                      </div>
                      <motion.div 
                        className="text-4xl lg:text-5xl font-black text-amber-400"
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.5, type: "spring" }}
                      >
                        {formatCurrencyCompact(visaoGeralMetricas?.aquisicaoPontual || 0)}
                      </motion.div>
                      <div className="text-slate-400 text-sm mt-2 flex items-center gap-1">
                        <Handshake className="w-4 h-4 text-amber-400" />
                        <span>Projetos Pontuais</span>
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.35 }}
                      className="rounded-2xl bg-gradient-to-br from-blue-600/30 via-blue-500/20 to-indigo-600/30 border border-blue-500/40 p-6 shadow-xl shadow-blue-500/10"
                      data-testid="card-pausados"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-blue-500/30">
                          <Pause className="w-5 h-5 text-blue-400" />
                        </div>
                        <span className="text-slate-300 font-medium text-sm uppercase tracking-wider">Pausados</span>
                      </div>
                      <motion.div 
                        className="text-4xl lg:text-5xl font-black text-blue-400"
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.55, type: "spring" }}
                      >
                        {visaoGeralMetricas?.pausados || 0}
                      </motion.div>
                      <div className="text-slate-400 text-sm mt-2 flex items-center gap-1">
                        <CalendarCheck className="w-4 h-4 text-blue-400" />
                        <span>Contratos em Pausa</span>
                      </div>
                    </motion.div>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {currentView === 'retencao' && (
            <motion.div
              key="retencao"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full flex flex-col gap-4"
            >
              <div className="flex-1 grid grid-cols-2 gap-4 lg:gap-6">
                {/* Churn por Serviço - Left Column */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="rounded-2xl bg-slate-900/70 border border-slate-700/50 p-5 flex flex-col"
                  data-testid="card-churn-por-servico"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-rose-500/30">
                      <BarChart3 className="w-5 h-5 text-rose-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Churn por Serviço</h2>
                    <Badge className="bg-rose-500/20 text-rose-400 text-xs ml-auto">Top Serviços</Badge>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-3">
                    {isLoadingChurnServico ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <Skeleton className="h-10 flex-1 bg-slate-800 rounded-lg" />
                        </div>
                      ))
                    ) : churnPorServico && churnPorServico.length > 0 ? (
                      [...churnPorServico]
                        .sort((a, b) => b.valorTotal - a.valorTotal)
                        .slice(0, 8)
                        .map((item, index) => {
                          const maxValue = Math.max(...churnPorServico.map(s => s.valorTotal));
                          const widthPercent = maxValue > 0 ? (item.valorTotal / maxValue) * 100 : 0;
                          
                          return (
                            <motion.div
                              key={item.servico}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.1 * index }}
                              className="relative"
                            >
                              <div className="absolute inset-0 bg-rose-500/10 rounded-lg" />
                              <motion.div
                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-rose-600/40 to-rose-500/20 rounded-lg"
                                initial={{ width: 0 }}
                                animate={{ width: `${widthPercent}%` }}
                                transition={{ delay: 0.3 + (0.1 * index), duration: 0.6 }}
                              />
                              <div className="relative flex items-center justify-between p-3">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className="text-slate-400 font-mono text-xs w-5">{index + 1}.</span>
                                  <span className="text-white font-medium text-sm truncate">{item.servico}</span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="text-rose-400 font-bold text-lg">
                                    {formatCurrencyCompact(item.valorTotal)}
                                  </span>
                                  <Badge className="bg-slate-700/50 text-slate-300 text-xs">
                                    {item.quantidade} contratos
                                  </Badge>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400">
                        Nenhum dado de churn disponível
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Churn por Responsável - Right Column */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="rounded-2xl bg-slate-900/70 border border-slate-700/50 p-5 flex flex-col"
                  data-testid="card-churn-por-responsavel"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-amber-500/30">
                      <Users className="w-5 h-5 text-amber-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Churn por Responsável</h2>
                    <Badge className="bg-amber-500/20 text-amber-400 text-xs ml-auto">Análise</Badge>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-3">
                    {isLoadingChurnResponsavel ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <Skeleton className="h-10 flex-1 bg-slate-800 rounded-lg" />
                        </div>
                      ))
                    ) : churnPorResponsavel && churnPorResponsavel.length > 0 ? (
                      [...churnPorResponsavel]
                        .sort((a, b) => b.valorTotal - a.valorTotal)
                        .slice(0, 8)
                        .map((item, index) => {
                          const maxValue = Math.max(...churnPorResponsavel.map(r => r.valorTotal));
                          const widthPercent = maxValue > 0 ? (item.valorTotal / maxValue) * 100 : 0;
                          
                          return (
                            <motion.div
                              key={item.responsavel}
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.1 * index }}
                              className="relative"
                            >
                              <div className="absolute inset-0 bg-amber-500/10 rounded-lg" />
                              <motion.div
                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-600/40 to-amber-500/20 rounded-lg"
                                initial={{ width: 0 }}
                                animate={{ width: `${widthPercent}%` }}
                                transition={{ delay: 0.3 + (0.1 * index), duration: 0.6 }}
                              />
                              <div className="relative flex items-center justify-between p-3">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                                    index === 0 ? 'bg-rose-500/30' :
                                    index === 1 ? 'bg-orange-500/30' :
                                    index === 2 ? 'bg-amber-500/30' :
                                    'bg-slate-700/50'
                                  }`}>
                                    <span className="text-xs font-bold text-white">{index + 1}</span>
                                  </div>
                                  <span className="text-white font-medium text-sm truncate">{item.responsavel}</span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="text-amber-400 font-bold text-lg">
                                    {formatCurrencyCompact(item.valorTotal)}
                                  </span>
                                  <div className="text-right">
                                    <div className="text-slate-400 text-xs">{item.quantidadeContratos} contratos</div>
                                    <div className={`text-xs font-semibold ${
                                      item.percentualChurn > 10 ? 'text-rose-400' :
                                      item.percentualChurn > 5 ? 'text-amber-400' :
                                      'text-emerald-400'
                                    }`}>
                                      {formatPercent(item.percentualChurn)} churn
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400">
                        Nenhum dado de churn disponível
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}

          {currentView === 'financeiro-resumo' && (
            <motion.div
              key="financeiro-resumo"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full flex flex-col gap-4"
            >
              <div className="flex-1 grid grid-cols-3 gap-4 lg:gap-6">
                {isLoadingFinanceiroKPIs ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * i }}
                      className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-6"
                    >
                      <Skeleton className="h-6 w-24 bg-slate-700 mb-4" />
                      <Skeleton className="h-12 w-32 bg-slate-700 mb-2" />
                      <Skeleton className="h-4 w-20 bg-slate-700" />
                    </motion.div>
                  ))
                ) : (
                  <>
                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.1 }}
                      className="rounded-2xl bg-gradient-to-br from-emerald-600/30 via-emerald-500/20 to-teal-600/30 border border-emerald-500/40 p-6 shadow-xl shadow-emerald-500/10"
                      data-testid="card-saldo-bancos"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-emerald-500/30">
                          <Wallet className="w-5 h-5 text-emerald-400" />
                        </div>
                        <span className="text-slate-300 font-medium text-sm uppercase tracking-wider">Saldo em Bancos</span>
                      </div>
                      <motion.div 
                        className="text-4xl lg:text-5xl font-black text-emerald-400"
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.3, type: "spring" }}
                      >
                        {formatCurrencyCompact(financeiroKPIs?.saldoTotal || 0)}
                      </motion.div>
                      <div className="text-slate-400 text-sm mt-2">Saldo atual consolidado</div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.15 }}
                      className="rounded-2xl bg-gradient-to-br from-amber-600/30 via-amber-500/20 to-orange-600/30 border border-amber-500/40 p-6 shadow-xl shadow-amber-500/10"
                      data-testid="card-receita-mes"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-amber-500/30">
                          <TrendingUp className="w-5 h-5 text-amber-400" />
                        </div>
                        <span className="text-slate-300 font-medium text-sm uppercase tracking-wider">Receita do Mês</span>
                      </div>
                      <motion.div 
                        className="text-4xl lg:text-5xl font-black text-amber-400"
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.35, type: "spring" }}
                      >
                        {formatCurrencyCompact(financeiroKPIs?.receitaMesAtual || 0)}
                      </motion.div>
                      <div className="text-slate-400 text-sm mt-2 flex items-center gap-1">
                        {financeiroKPIs?.receitaMesAnterior && financeiroKPIs.receitaMesAnterior > 0 && (
                          <>
                            <span className={financeiroKPIs.receitaMesAtual >= financeiroKPIs.receitaMesAnterior ? 'text-emerald-400' : 'text-rose-400'}>
                              {financeiroKPIs.receitaMesAtual >= financeiroKPIs.receitaMesAnterior ? '+' : ''}
                              {formatPercent(((financeiroKPIs.receitaMesAtual - financeiroKPIs.receitaMesAnterior) / financeiroKPIs.receitaMesAnterior) * 100)}
                            </span>
                            <span>vs mês anterior</span>
                          </>
                        )}
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.2 }}
                      className="rounded-2xl bg-gradient-to-br from-rose-600/30 via-rose-500/20 to-red-600/30 border border-rose-500/40 p-6 shadow-xl shadow-rose-500/10"
                      data-testid="card-despesa-mes"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-rose-500/30">
                          <TrendingUp className="w-5 h-5 text-rose-400 rotate-180" />
                        </div>
                        <span className="text-slate-300 font-medium text-sm uppercase tracking-wider">Despesas do Mês</span>
                      </div>
                      <motion.div 
                        className="text-4xl lg:text-5xl font-black text-rose-400"
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.4, type: "spring" }}
                      >
                        {formatCurrencyCompact(financeiroKPIs?.despesaMesAtual || 0)}
                      </motion.div>
                      <div className="text-slate-400 text-sm mt-2">Total de saídas no mês</div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.25 }}
                      className={`rounded-2xl bg-gradient-to-br ${
                        (financeiroKPIs?.lucroMesAtual || 0) >= 0 
                          ? 'from-cyan-600/30 via-cyan-500/20 to-blue-600/30 border-cyan-500/40 shadow-cyan-500/10'
                          : 'from-red-600/30 via-red-500/20 to-rose-600/30 border-red-500/40 shadow-red-500/10'
                      } border p-6 shadow-xl`}
                      data-testid="card-lucro-mes"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`p-2 rounded-lg ${(financeiroKPIs?.lucroMesAtual || 0) >= 0 ? 'bg-cyan-500/30' : 'bg-red-500/30'}`}>
                          <DollarSign className={`w-5 h-5 ${(financeiroKPIs?.lucroMesAtual || 0) >= 0 ? 'text-cyan-400' : 'text-red-400'}`} />
                        </div>
                        <span className="text-slate-300 font-medium text-sm uppercase tracking-wider">Resultado do Mês</span>
                      </div>
                      <motion.div 
                        className={`text-4xl lg:text-5xl font-black ${(financeiroKPIs?.lucroMesAtual || 0) >= 0 ? 'text-cyan-400' : 'text-red-400'}`}
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.45, type: "spring" }}
                      >
                        {formatCurrencyCompact(financeiroKPIs?.lucroMesAtual || 0)}
                      </motion.div>
                      <div className="text-slate-400 text-sm mt-2">Receita - Despesas</div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.3 }}
                      className="rounded-2xl bg-gradient-to-br from-violet-600/30 via-violet-500/20 to-purple-600/30 border border-violet-500/40 p-6 shadow-xl shadow-violet-500/10"
                      data-testid="card-a-receber"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-violet-500/30">
                          <DollarSign className="w-5 h-5 text-violet-400" />
                        </div>
                        <span className="text-slate-300 font-medium text-sm uppercase tracking-wider">A Receber</span>
                      </div>
                      <motion.div 
                        className="text-4xl lg:text-5xl font-black text-violet-400"
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.5, type: "spring" }}
                      >
                        {formatCurrencyCompact(financeiroKPIs?.aReceberTotal || 0)}
                      </motion.div>
                      <div className="text-slate-400 text-sm mt-2 flex items-center gap-2">
                        <span>{financeiroKPIs?.aReceberQtd || 0} títulos</span>
                        {(financeiroKPIs?.aReceberVencidoValor || 0) > 0 && (
                          <Badge className="bg-rose-500/20 text-rose-400 text-xs">
                            {formatCurrencyCompact(financeiroKPIs?.aReceberVencidoValor || 0)} vencido
                          </Badge>
                        )}
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.35 }}
                      className="rounded-2xl bg-gradient-to-br from-orange-600/30 via-orange-500/20 to-amber-600/30 border border-orange-500/40 p-6 shadow-xl shadow-orange-500/10"
                      data-testid="card-a-pagar"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-orange-500/30">
                          <DollarSign className="w-5 h-5 text-orange-400" />
                        </div>
                        <span className="text-slate-300 font-medium text-sm uppercase tracking-wider">A Pagar</span>
                      </div>
                      <motion.div 
                        className="text-4xl lg:text-5xl font-black text-orange-400"
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.55, type: "spring" }}
                      >
                        {formatCurrencyCompact(financeiroKPIs?.aPagarTotal || 0)}
                      </motion.div>
                      <div className="text-slate-400 text-sm mt-2 flex items-center gap-2">
                        <span>{financeiroKPIs?.aPagarQtd || 0} títulos</span>
                        {(financeiroKPIs?.aPagarVencidoValor || 0) > 0 && (
                          <Badge className="bg-rose-500/20 text-rose-400 text-xs">
                            {formatCurrencyCompact(financeiroKPIs?.aPagarVencidoValor || 0)} vencido
                          </Badge>
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {currentView === 'fluxo-caixa' && (
            <motion.div
              key="fluxo-caixa"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full flex flex-col gap-4"
            >
              <div className="flex-1 flex flex-col gap-4 lg:gap-6">
                <div className="grid grid-cols-4 gap-4 lg:gap-6">
                  {isLoadingFluxoCaixa ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 * i }}
                        className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-6"
                      >
                        <Skeleton className="h-6 w-24 bg-slate-700 mb-4" />
                        <Skeleton className="h-12 w-32 bg-slate-700 mb-2" />
                        <Skeleton className="h-4 w-20 bg-slate-700" />
                      </motion.div>
                    ))
                  ) : (
                    <>
                      <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: 0.1 }}
                        className="rounded-2xl bg-gradient-to-br from-blue-600/30 via-blue-500/20 to-sky-600/30 border border-blue-500/40 p-6 shadow-xl shadow-blue-500/10"
                        data-testid="card-saldo-hoje"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-2 rounded-lg bg-blue-500/30">
                            <Wallet className="w-5 h-5 text-blue-400" />
                          </div>
                          <span className="text-slate-300 font-medium text-sm uppercase tracking-wider">Saldo Atual</span>
                        </div>
                        <motion.div 
                          className="text-4xl lg:text-5xl font-black text-blue-400"
                          initial={{ scale: 0.5 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.3, type: "spring" }}
                        >
                          {formatCurrencyCompact(fluxoCaixaInsights?.saldoHoje || 0)}
                        </motion.div>
                        <div className="text-slate-400 text-sm mt-2">Saldo consolidado hoje</div>
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: 0.15 }}
                        className="rounded-2xl bg-gradient-to-br from-emerald-600/30 via-emerald-500/20 to-teal-600/30 border border-emerald-500/40 p-6 shadow-xl shadow-emerald-500/10"
                        data-testid="card-entradas-previstas"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-2 rounded-lg bg-emerald-500/30">
                            <TrendingUp className="w-5 h-5 text-emerald-400" />
                          </div>
                          <span className="text-slate-300 font-medium text-sm uppercase tracking-wider">Entradas (30d)</span>
                        </div>
                        <motion.div 
                          className="text-4xl lg:text-5xl font-black text-emerald-400"
                          initial={{ scale: 0.5 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.35, type: "spring" }}
                        >
                          {formatCurrencyCompact(fluxoCaixaInsights?.entradasPrevistas30Dias || 0)}
                        </motion.div>
                        <div className="text-slate-400 text-sm mt-2">
                          {(fluxoCaixaInsights?.entradasVencidas || 0) > 0 && (
                            <span className="text-rose-400">{formatCurrencyCompact(fluxoCaixaInsights?.entradasVencidas || 0)} vencido</span>
                          )}
                        </div>
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="rounded-2xl bg-gradient-to-br from-rose-600/30 via-rose-500/20 to-red-600/30 border border-rose-500/40 p-6 shadow-xl shadow-rose-500/10"
                        data-testid="card-saidas-previstas"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-2 rounded-lg bg-rose-500/30">
                            <TrendingUp className="w-5 h-5 text-rose-400 rotate-180" />
                          </div>
                          <span className="text-slate-300 font-medium text-sm uppercase tracking-wider">Saídas (30d)</span>
                        </div>
                        <motion.div 
                          className="text-4xl lg:text-5xl font-black text-rose-400"
                          initial={{ scale: 0.5 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.4, type: "spring" }}
                        >
                          {formatCurrencyCompact(fluxoCaixaInsights?.saidasPrevistas30Dias || 0)}
                        </motion.div>
                        <div className="text-slate-400 text-sm mt-2">
                          {(fluxoCaixaInsights?.saidasVencidas || 0) > 0 && (
                            <span className="text-rose-400">{formatCurrencyCompact(fluxoCaixaInsights?.saidasVencidas || 0)} vencido</span>
                          )}
                        </div>
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: 0.25 }}
                        className={`rounded-2xl bg-gradient-to-br ${
                          (fluxoCaixaInsights?.saldoFuturo30Dias || 0) >= 0 
                            ? 'from-cyan-600/30 via-cyan-500/20 to-sky-600/30 border-cyan-500/40 shadow-cyan-500/10'
                            : 'from-red-600/30 via-red-500/20 to-rose-600/30 border-red-500/40 shadow-red-500/10'
                        } border p-6 shadow-xl`}
                        data-testid="card-saldo-projetado"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div className={`p-2 rounded-lg ${(fluxoCaixaInsights?.saldoFuturo30Dias || 0) >= 0 ? 'bg-cyan-500/30' : 'bg-red-500/30'}`}>
                            <Target className={`w-5 h-5 ${(fluxoCaixaInsights?.saldoFuturo30Dias || 0) >= 0 ? 'text-cyan-400' : 'text-red-400'}`} />
                          </div>
                          <span className="text-slate-300 font-medium text-sm uppercase tracking-wider">Saldo Projetado</span>
                        </div>
                        <motion.div 
                          className={`text-4xl lg:text-5xl font-black ${(fluxoCaixaInsights?.saldoFuturo30Dias || 0) >= 0 ? 'text-cyan-400' : 'text-red-400'}`}
                          initial={{ scale: 0.5 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.45, type: "spring" }}
                        >
                          {formatCurrencyCompact(fluxoCaixaInsights?.saldoFuturo30Dias || 0)}
                        </motion.div>
                        <div className="text-slate-400 text-sm mt-2">
                          {fluxoCaixaInsights?.diasAteNegativo != null && fluxoCaixaInsights.diasAteNegativo > 0 && (
                            <span className="text-amber-400">{fluxoCaixaInsights.diasAteNegativo} dias até ficar negativo</span>
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex-1 rounded-2xl bg-slate-900/70 border border-slate-700/50 p-5"
                  data-testid="card-fluxo-proximos-dias"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-blue-500/30">
                      <BarChart3 className="w-5 h-5 text-blue-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Fluxo dos Próximos 7 Dias</h2>
                  </div>
                  
                  <div className="grid grid-cols-7 gap-3 h-[calc(100%-3rem)]">
                    {isLoadingFluxoProximosDias ? (
                      Array.from({ length: 7 }).map((_, i) => (
                        <div key={i} className="flex flex-col items-center justify-end">
                          <Skeleton className="h-32 w-full bg-slate-800 rounded-lg" />
                          <Skeleton className="h-4 w-12 bg-slate-700 mt-2" />
                        </div>
                      ))
                    ) : (() => {
                      const groupedByDate = new Map<string, { entradas: number; saidas: number }>();
                      const today = new Date();
                      for (let i = 0; i < 7; i++) {
                        const d = new Date(today);
                        d.setDate(d.getDate() + i);
                        const key = d.toISOString().split('T')[0];
                        groupedByDate.set(key, { entradas: 0, saidas: 0 });
                      }
                      (fluxoProximosDias || []).forEach(item => {
                        const existing = groupedByDate.get(item.data);
                        if (existing) {
                          if (item.tipo === 'RECEITA') {
                            existing.entradas += item.valor;
                          } else {
                            existing.saidas += item.valor;
                          }
                        }
                      });
                      const allValues = Array.from(groupedByDate.values()).flatMap(v => [v.entradas, v.saidas]);
                      const maxValue = Math.max(...allValues, 1);

                      return Array.from(groupedByDate.entries()).map(([date, values], index) => {
                        const d = new Date(date + 'T12:00:00');
                        const dayName = d.toLocaleDateString('pt-BR', { weekday: 'short' });
                        const dayNum = d.getDate();
                        const entradasHeight = (values.entradas / maxValue) * 100;
                        const saidasHeight = (values.saidas / maxValue) * 100;

                        return (
                          <motion.div
                            key={date}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 * index }}
                            className="flex flex-col items-center h-full"
                          >
                            <div className="flex-1 flex items-end gap-1 w-full">
                              <motion.div
                                className="flex-1 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-lg"
                                initial={{ height: 0 }}
                                animate={{ height: `${Math.max(entradasHeight, 2)}%` }}
                                transition={{ delay: 0.3 + (0.1 * index), duration: 0.5 }}
                                title={`Entradas: ${formatCurrencyCompact(values.entradas)}`}
                              />
                              <motion.div
                                className="flex-1 bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-lg"
                                initial={{ height: 0 }}
                                animate={{ height: `${Math.max(saidasHeight, 2)}%` }}
                                transition={{ delay: 0.35 + (0.1 * index), duration: 0.5 }}
                                title={`Saídas: ${formatCurrencyCompact(values.saidas)}`}
                              />
                            </div>
                            <div className="text-center mt-2">
                              <div className="text-slate-400 text-xs capitalize">{dayName}</div>
                              <div className="text-white font-bold text-sm">{dayNum}</div>
                            </div>
                          </motion.div>
                        );
                      });
                    })()}
                  </div>
                  
                  <div className="flex items-center justify-center gap-6 mt-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-emerald-500" />
                      <span className="text-slate-400 text-sm">Entradas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-rose-500" />
                      <span className="text-slate-400 text-sm">Saídas</span>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}

          {currentView === 'growth-visao-geral' && (
            <motion.div
              key="growth-visao-geral"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full flex flex-col gap-4"
            >
              <div className="flex-1 grid grid-cols-3 gap-4 lg:gap-6">
                {isLoadingMetaAds ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * i }}
                      className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-6"
                    >
                      <Skeleton className="h-6 w-24 bg-slate-700 mb-4" />
                      <Skeleton className="h-12 w-32 bg-slate-700 mb-2" />
                      <Skeleton className="h-4 w-20 bg-slate-700" />
                    </motion.div>
                  ))
                ) : (
                  <>
                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.1 }}
                      className="rounded-2xl bg-gradient-to-br from-rose-600/30 via-rose-500/20 to-pink-600/30 border border-rose-500/40 p-6 shadow-xl shadow-rose-500/10"
                      data-testid="card-investimento-total"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-rose-500/30">
                          <DollarSign className="w-5 h-5 text-rose-400" />
                        </div>
                        <span className="text-slate-300 font-medium text-sm uppercase tracking-wider">Investimento Total</span>
                      </div>
                      <motion.div 
                        className="text-4xl lg:text-5xl font-black text-rose-400"
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.3, type: "spring" }}
                      >
                        {formatCurrencyCompact(metaAdsOverview?.totalSpend || 0)}
                      </motion.div>
                      <div className="text-slate-400 text-sm mt-2">Gasto em anúncios Meta</div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.15 }}
                      className="rounded-2xl bg-gradient-to-br from-pink-600/30 via-pink-500/20 to-fuchsia-600/30 border border-pink-500/40 p-6 shadow-xl shadow-pink-500/10"
                      data-testid="card-leads-gerados"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-pink-500/30">
                          <Users className="w-5 h-5 text-pink-400" />
                        </div>
                        <span className="text-slate-300 font-medium text-sm uppercase tracking-wider">Leads Gerados</span>
                      </div>
                      <motion.div 
                        className="text-4xl lg:text-5xl font-black text-pink-400"
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.35, type: "spring" }}
                      >
                        {metaAdsOverview?.totalLeads?.toLocaleString('pt-BR') || 0}
                      </motion.div>
                      <div className="text-slate-400 text-sm mt-2 flex items-center gap-1">
                        <span className="text-emerald-400">{metaAdsOverview?.totalWon?.toLocaleString('pt-BR') || 0}</span>
                        <span>conversões</span>
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.2 }}
                      className="rounded-2xl bg-gradient-to-br from-violet-600/30 via-violet-500/20 to-purple-600/30 border border-violet-500/40 p-6 shadow-xl shadow-violet-500/10"
                      data-testid="card-cpl"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-violet-500/30">
                          <Target className="w-5 h-5 text-violet-400" />
                        </div>
                        <span className="text-slate-300 font-medium text-sm uppercase tracking-wider">CPL</span>
                      </div>
                      <motion.div 
                        className="text-4xl lg:text-5xl font-black text-violet-400"
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.4, type: "spring" }}
                      >
                        {formatCurrency(metaAdsOverview?.costPerLead || 0)}
                      </motion.div>
                      <div className="text-slate-400 text-sm mt-2">Custo por Lead</div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.25 }}
                      className="rounded-2xl bg-gradient-to-br from-amber-600/30 via-amber-500/20 to-orange-600/30 border border-amber-500/40 p-6 shadow-xl shadow-amber-500/10"
                      data-testid="card-cac"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-amber-500/30">
                          <Handshake className="w-5 h-5 text-amber-400" />
                        </div>
                        <span className="text-slate-300 font-medium text-sm uppercase tracking-wider">CAC</span>
                      </div>
                      <motion.div 
                        className="text-4xl lg:text-5xl font-black text-amber-400"
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.45, type: "spring" }}
                      >
                        {formatCurrency(metaAdsOverview?.cac || 0)}
                      </motion.div>
                      <div className="text-slate-400 text-sm mt-2">Custo de Aquisição</div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.3 }}
                      className="rounded-2xl bg-gradient-to-br from-cyan-600/30 via-cyan-500/20 to-sky-600/30 border border-cyan-500/40 p-6 shadow-xl shadow-cyan-500/10"
                      data-testid="card-ctr"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-cyan-500/30">
                          <TrendingUp className="w-5 h-5 text-cyan-400" />
                        </div>
                        <span className="text-slate-300 font-medium text-sm uppercase tracking-wider">CTR</span>
                      </div>
                      <motion.div 
                        className="text-4xl lg:text-5xl font-black text-cyan-400"
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.5, type: "spring" }}
                      >
                        {formatPercent(metaAdsOverview?.avgCtr || 0)}
                      </motion.div>
                      <div className="text-slate-400 text-sm mt-2">Taxa de Clique</div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.35 }}
                      className="rounded-2xl bg-gradient-to-br from-emerald-600/30 via-emerald-500/20 to-teal-600/30 border border-emerald-500/40 p-6 shadow-xl shadow-emerald-500/10"
                      data-testid="card-alcance"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-emerald-500/30">
                          <Megaphone className="w-5 h-5 text-emerald-400" />
                        </div>
                        <span className="text-slate-300 font-medium text-sm uppercase tracking-wider">Alcance</span>
                      </div>
                      <motion.div 
                        className="text-4xl lg:text-5xl font-black text-emerald-400"
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.55, type: "spring" }}
                      >
                        {metaAdsOverview?.totalReach ? (metaAdsOverview.totalReach / 1000).toFixed(0) + 'K' : '0'}
                      </motion.div>
                      <div className="text-slate-400 text-sm mt-2 flex items-center gap-1">
                        <span>{metaAdsOverview?.totalImpressions ? (metaAdsOverview.totalImpressions / 1000).toFixed(0) + 'K' : '0'}</span>
                        <span>impressões</span>
                      </div>
                    </motion.div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
