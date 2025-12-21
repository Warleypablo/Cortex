import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { useSetPageInfo } from "@/contexts/PageContext";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { 
  DollarSign, 
  TrendingUp, 
  Target, 
  Filter,
  RotateCcw,
  Trophy,
  Star,
  Calendar,
  Clock,
  Banknote,
  BarChart3,
  Award,
  Users,
  Sparkles,
  Crown,
  Rocket,
  Activity,
  FileText,
  Briefcase,
  Layers
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar
} from "recharts";

interface VendasKPIs {
  receitaRecorrente: number;
  receitaPontual: number;
  receitaTotal: number;
  totalContratos: number;
  contratosRecorrentes: number;
  contratosPontuais: number;
  tempoFechamentoDias: number;
  ticketMedioRecorrente: number;
  ticketMedioPontual: number;
}

interface ContratosPorDia {
  dia: string;
  contratos: number;
  valorRecorrente: number;
  valorPontual: number;
}

interface MrrPorCloser {
  closer: string;
  mrr: number;
  pontual: number;
  contratos: number;
}

interface MrrPorSdr {
  sdr: string;
  mrr: number;
  pontual: number;
  contratos: number;
}

interface ReceitaPorFonte {
  fonte: string;
  mrr: number;
  pontual: number;
  contratos: number;
}

interface Filtros {
  pipelines: string[];
  sources: string[];
  utmContents: string[];
}

function AnimatedCounter({ value, duration = 2000, prefix = "", suffix = "" }: { value: number; duration?: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0);
  const countRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    countRef.current = 0;
    startTimeRef.current = null;
    
    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      countRef.current = Math.floor(easeOutQuart * value);
      setCount(countRef.current);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(value);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value, duration]);

  return <>{prefix}{count.toLocaleString('pt-BR')}{suffix}</>;
}

function FloatingParticles() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: Math.random() * 4 + 1,
            height: Math.random() * 4 + 1,
            background: `rgba(${Math.random() > 0.5 ? '139, 92, 246' : '59, 130, 246'}, ${Math.random() * 0.3 + 0.1})`,
          }}
          initial={{
            x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1920),
            y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1080),
          }}
          animate={{
            y: [null, -150],
            x: [null, Math.random() * 100 - 50],
            opacity: [0, 0.8, 0],
          }}
          transition={{
            duration: 4 + Math.random() * 3,
            repeat: Infinity,
            delay: Math.random() * 3,
            ease: "easeOut"
          }}
        />
      ))}
    </div>
  );
}


export default function AnaliseVendas() {
  useSetPageInfo("Análise de Vendas", "Métricas de performance comercial em tempo real");
  
  const hoje = new Date();
  const inicioAno = new Date(hoje.getFullYear(), 0, 1);
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: inicioAno,
    to: fimMes
  });
  const [pipeline, setPipeline] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const dataInicioStr = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '';
  const dataFimStr = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : '';

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (dataInicioStr) params.append("dataInicio", dataInicioStr);
    if (dataFimStr) params.append("dataFim", dataFimStr);
    if (pipeline && pipeline !== "all") params.append("pipeline", pipeline);
    if (source && source !== "all") params.append("source", source);
    return params.toString();
  };

  const queryParams = buildQueryParams();

  const { data: filtros } = useQuery<Filtros>({
    queryKey: ["/api/vendas/filtros"],
  });

  const { data: kpis, isLoading: isLoadingKpis } = useQuery<VendasKPIs>({
    queryKey: ["/api/vendas/kpis", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/vendas/kpis?${queryParams}`);
      return res.json();
    },
  });

  const { data: contratosPorDia, isLoading: isLoadingContratos } = useQuery<ContratosPorDia[]>({
    queryKey: ["/api/vendas/contratos-por-dia", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/vendas/contratos-por-dia?${queryParams}`);
      return res.json();
    },
  });

  const { data: mrrPorCloser, isLoading: isLoadingCloser } = useQuery<MrrPorCloser[]>({
    queryKey: ["/api/vendas/mrr-por-closer", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/vendas/mrr-por-closer?${queryParams}`);
      return res.json();
    },
  });

  const { data: mrrPorSdr, isLoading: isLoadingSdr } = useQuery<MrrPorSdr[]>({
    queryKey: ["/api/vendas/mrr-por-sdr", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/vendas/mrr-por-sdr?${queryParams}`);
      return res.json();
    },
  });

  const { data: receitaPorFonte, isLoading: isLoadingFonte } = useQuery<ReceitaPorFonte[]>({
    queryKey: ["/api/vendas/receita-por-fonte", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/vendas/receita-por-fonte?${queryParams}`);
      return res.json();
    },
  });

  const resetFilters = () => {
    setDateRange({ from: inicioAno, to: fimMes });
    setPipeline("");
    setSource("");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  const aggregateByWeek = (data: ContratosPorDia[]) => {
    if (!data || data.length === 0) return [];
    
    const weeklyData: Record<string, { semana: string; contratos: number; valorRecorrente: number; valorPontual: number }> = {};
    
    data.forEach(item => {
      const date = new Date(item.dia + 'T00:00:00');
      const startOfYear = new Date(date.getFullYear(), 0, 1);
      const weekNumber = Math.ceil((((date.getTime() - startOfYear.getTime()) / 86400000) + startOfYear.getDay() + 1) / 7);
      const weekKey = `${date.getFullYear()}-S${weekNumber.toString().padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('pt-BR', { month: 'short' });
      const weekLabel = `S${weekNumber} ${monthName}`;
      
      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = {
          semana: weekLabel,
          contratos: 0,
          valorRecorrente: 0,
          valorPontual: 0
        };
      }
      
      weeklyData[weekKey].contratos += item.contratos;
      weeklyData[weekKey].valorRecorrente += item.valorRecorrente;
      weeklyData[weekKey].valorPontual += item.valorPontual;
    });
    
    return Object.values(weeklyData).sort((a, b) => a.semana.localeCompare(b.semana));
  };

  const chartContratosData = aggregateByWeek(contratosPorDia || []);

  const getMedalStyle = (position: number) => {
    switch (position) {
      case 0:
        return {
          bg: "from-amber-500/30 via-yellow-500/20 to-orange-500/30",
          border: "border-amber-400/50",
          glow: "shadow-amber-500/30",
          icon: <Crown className="w-6 h-6 text-amber-400" />,
          badge: "bg-gradient-to-r from-amber-500 to-yellow-500"
        };
      case 1:
        return {
          bg: "from-slate-300/20 via-gray-400/15 to-slate-400/20",
          border: "border-slate-400/50",
          glow: "shadow-slate-400/20",
          icon: <Trophy className="w-5 h-5 text-slate-300" />,
          badge: "bg-gradient-to-r from-slate-400 to-gray-400"
        };
      case 2:
        return {
          bg: "from-orange-600/25 via-amber-700/20 to-orange-700/25",
          border: "border-orange-500/50",
          glow: "shadow-orange-500/20",
          icon: <Award className="w-5 h-5 text-orange-400" />,
          badge: "bg-gradient-to-r from-orange-600 to-amber-600"
        };
      default:
        return {
          bg: "from-slate-800/60 via-slate-700/40 to-slate-800/60",
          border: "border-slate-600/30",
          glow: "",
          icon: <Star className="w-4 h-4 text-slate-400" />,
          badge: "bg-slate-600"
        };
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] relative overflow-hidden">
      {/* Premium Aurora Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ 
            scale: [1, 1.1, 1],
            opacity: [0.15, 0.25, 0.15]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-20%] left-[-10%] w-[700px] h-[700px] bg-violet-600/20 rounded-full blur-[180px]" 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.15, 1],
            opacity: [0.12, 0.22, 0.12]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[180px]" 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.08, 0.15, 0.08]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute top-[40%] left-[50%] w-[500px] h-[500px] bg-indigo-500/15 rounded-full blur-[150px] transform -translate-x-1/2 -translate-y-1/2" 
        />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
      </div>
      
      <FloatingParticles />

      <div className="relative z-10 p-6 lg:p-8 space-y-6">
        {/* Filters Row */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-end gap-4"
        >
          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="relative group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 to-blue-600/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative bg-slate-900/80 backdrop-blur-xl rounded-xl border border-violet-500/20 px-4 py-2">
              <p className="text-xs text-slate-500">Atualizado em</p>
              <p className="text-xl font-mono font-bold bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
                {currentTime.toLocaleTimeString('pt-BR')}
              </p>
            </div>
          </motion.div>
          
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="bg-violet-500/10 border-violet-500/30 text-violet-300 hover:bg-violet-500/20 hover:border-violet-400/50 backdrop-blur-xl"
              data-testid="button-toggle-filters"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filtros
              {(pipeline || source) && (
                <Badge className="ml-2 bg-violet-500 text-white border-0">
                  {[pipeline, source].filter(Boolean).length}
                </Badge>
              )}
            </Button>
          </motion.div>
          
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="ghost"
              onClick={resetFilters}
              className="text-slate-400 hover:text-white hover:bg-slate-800/50"
              data-testid="button-reset-filters"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Limpar
            </Button>
          </motion.div>
        </motion.div>

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -20 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-violet-600/20 to-blue-600/20 rounded-2xl blur-lg" />
                <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-violet-500/20 p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-violet-300 flex items-center gap-2 text-sm font-medium">
                        <Calendar className="w-4 h-4" />
                        Período
                      </Label>
                      <DateRangePicker
                        value={dateRange}
                        onChange={setDateRange}
                        triggerClassName="bg-slate-800/50 border-slate-700/50 text-white focus:ring-violet-500/50 focus:border-violet-500/50 rounded-xl w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-blue-300 flex items-center gap-2 text-sm font-medium">
                        <Layers className="w-4 h-4" />
                        Pipeline
                      </Label>
                      <Select value={pipeline} onValueChange={setPipeline}>
                        <SelectTrigger className="bg-slate-800/50 border-slate-700/50 text-white rounded-xl" data-testid="select-pipeline">
                          <SelectValue placeholder="Todos os pipelines" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700 rounded-xl">
                          <SelectItem value="all">Todos os pipelines</SelectItem>
                          {filtros?.pipelines.map((p) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-indigo-300 flex items-center gap-2 text-sm font-medium">
                        <Target className="w-4 h-4" />
                        Fonte
                      </Label>
                      <Select value={source} onValueChange={setSource}>
                        <SelectTrigger className="bg-slate-800/50 border-slate-700/50 text-white rounded-xl" data-testid="select-source">
                          <SelectValue placeholder="Todas as fontes" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700 rounded-xl">
                          <SelectItem value="all">Todas as fontes</SelectItem>
                          {filtros?.sources.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* KPI Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5"
        >
          {/* Receita Total */}
          <motion.div whileHover={{ scale: 1.02, y: -4 }} className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-600 to-blue-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition-opacity" />
            <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-violet-500/20 p-6 h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-violet-500/20 to-blue-500/20 rounded-xl border border-violet-500/20">
                  <DollarSign className="w-6 h-6 text-violet-400" />
                </div>
                <Badge className="bg-gradient-to-r from-violet-500/20 to-blue-500/20 text-violet-300 border-violet-500/30">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Total
                </Badge>
              </div>
              <p className="text-sm text-slate-400 mb-1">Receita Total</p>
              {isLoadingKpis ? (
                <Skeleton className="h-9 w-40 bg-slate-800" />
              ) : (
                <p className="text-3xl font-black bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
                  <AnimatedCounter value={kpis?.receitaTotal || 0} prefix="R$ " />
                </p>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/30">
                  <span className="text-xs text-slate-500">Recorrente</span>
                  <p className="text-violet-400 font-bold">{formatCurrency(kpis?.receitaRecorrente || 0)}</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/30">
                  <span className="text-xs text-slate-500">Pontual</span>
                  <p className="text-blue-400 font-bold">{formatCurrency(kpis?.receitaPontual || 0)}</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Total Contratos */}
          <motion.div whileHover={{ scale: 1.02, y: -4 }} className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition-opacity" />
            <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-indigo-500/20 p-6 h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl border border-indigo-500/20">
                  <FileText className="w-6 h-6 text-indigo-400" />
                </div>
                <Badge className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 border-indigo-500/30">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Ganhos
                </Badge>
              </div>
              <p className="text-sm text-slate-400 mb-1">Total de Contratos</p>
              {isLoadingKpis ? (
                <Skeleton className="h-9 w-24 bg-slate-800" />
              ) : (
                <p className="text-3xl font-black bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  <AnimatedCounter value={kpis?.totalContratos || 0} />
                </p>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/30">
                  <span className="text-xs text-slate-500">Recorrentes</span>
                  <p className="text-indigo-400 font-bold">{kpis?.contratosRecorrentes || 0}</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/30">
                  <span className="text-xs text-slate-500">Pontuais</span>
                  <p className="text-purple-400 font-bold">{kpis?.contratosPontuais || 0}</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Ticket Médio */}
          <motion.div whileHover={{ scale: 1.02, y: -4 }} className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-600 to-teal-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition-opacity" />
            <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-cyan-500/20 p-6 h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-teal-500/20 rounded-xl border border-cyan-500/20">
                  <Banknote className="w-6 h-6 text-cyan-400" />
                </div>
                <Badge className="bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-300 border-cyan-500/30">
                  <Target className="w-3 h-3 mr-1" />
                  Médio
                </Badge>
              </div>
              <p className="text-sm text-slate-400 mb-1">Ticket Médio Recorrente</p>
              {isLoadingKpis ? (
                <Skeleton className="h-9 w-32 bg-slate-800" />
              ) : (
                <p className="text-3xl font-black bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
                  <AnimatedCounter value={kpis?.ticketMedioRecorrente || 0} prefix="R$ " />
                </p>
              )}
              <div className="mt-4 bg-slate-800/50 rounded-xl p-3 border border-slate-700/30">
                <span className="text-xs text-slate-500">Ticket Médio Pontual</span>
                <p className="text-cyan-400 font-bold">{formatCurrency(kpis?.ticketMedioPontual || 0)}</p>
              </div>
            </div>
          </motion.div>

          {/* Tempo Médio Fechamento */}
          <motion.div whileHover={{ scale: 1.02, y: -4 }} className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-600 to-green-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition-opacity" />
            <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-emerald-500/20 p-6 h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-green-500/20 rounded-xl border border-emerald-500/20">
                  <Clock className="w-6 h-6 text-emerald-400" />
                </div>
                <Badge className="bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-300 border-emerald-500/30">
                  <Rocket className="w-3 h-3 mr-1" />
                  Ciclo
                </Badge>
              </div>
              <p className="text-sm text-slate-400 mb-1">Tempo Médio de Fechamento</p>
              {isLoadingKpis ? (
                <Skeleton className="h-9 w-24 bg-slate-800" />
              ) : (
                <p className="text-3xl font-black bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">
                  <AnimatedCounter value={Math.round(kpis?.tempoFechamentoDias || 0)} suffix=" dias" />
                </p>
              )}
              <div className="mt-4 bg-slate-800/50 rounded-xl p-3 border border-slate-700/30 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-300 text-sm">Ciclo de vendas médio</span>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Evolução de Vendas */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-600/20 to-blue-600/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-700/30 overflow-hidden">
                <div className="p-6 border-b border-slate-700/30">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-violet-500/20 to-blue-500/20 rounded-xl border border-violet-500/20">
                      <TrendingUp className="w-5 h-5 text-violet-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Evolução de Vendas</h3>
                  </div>
                </div>
                <div className="p-6">
                  {isLoadingContratos ? (
                    <Skeleton className="h-80 w-full bg-slate-800/50" />
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={chartContratosData} barCategoryGap="15%">
                        <defs>
                          <linearGradient id="barRecorrente" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1}/>
                            <stop offset="100%" stopColor="#6d28d9" stopOpacity={0.8}/>
                          </linearGradient>
                          <linearGradient id="barPontual" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={1}/>
                            <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.8}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis 
                          dataKey="semana" 
                          stroke="#64748b" 
                          fontSize={10}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          interval={0}
                          tick={{ fill: '#94a3b8' }}
                        />
                        <YAxis 
                          stroke="#64748b" 
                          fontSize={11} 
                          tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`}
                          tick={{ fill: '#94a3b8' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            border: '1px solid rgba(139, 92, 246, 0.3)',
                            borderRadius: '12px',
                            color: '#f1f5f9',
                            backdropFilter: 'blur(12px)'
                          }}
                          formatter={(value: number, name: string) => [
                            formatCurrency(value),
                            name === 'valorRecorrente' ? 'MRR' : 'Pontual'
                          ]}
                          labelFormatter={(label) => `Semana: ${label}`}
                        />
                        <Legend 
                          wrapperStyle={{ paddingTop: '10px' }}
                          formatter={(value) => value === 'valorRecorrente' ? 'MRR' : 'Pontual'}
                        />
                        <Bar 
                          dataKey="valorRecorrente" 
                          fill="url(#barRecorrente)" 
                          radius={[4, 4, 0, 0]} 
                          name="valorRecorrente"
                          stackId="stack"
                        />
                        <Bar 
                          dataKey="valorPontual" 
                          fill="url(#barPontual)" 
                          radius={[4, 4, 0, 0]} 
                          name="valorPontual"
                          stackId="stack"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Receita por Fonte */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-700/30 overflow-hidden">
                <div className="p-6 border-b border-slate-700/30">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl border border-indigo-500/20">
                      <Target className="w-5 h-5 text-indigo-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Receita por Fonte</h3>
                  </div>
                </div>
                <div className="p-6">
                  {isLoadingFonte ? (
                    <Skeleton className="h-80 w-full bg-slate-800/50" />
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart 
                        data={receitaPorFonte?.slice(0, 8).map(item => ({
                          ...item,
                          total: item.mrr + item.pontual,
                          fonteLabel: (item.fonte || 'N/A').substring(0, 20)
                        }))} 
                        layout="vertical"
                        margin={{ left: 10, right: 20 }}
                      >
                        <defs>
                          <linearGradient id="barFonteMrr" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#8b5cf6" />
                            <stop offset="100%" stopColor="#a855f7" />
                          </linearGradient>
                          <linearGradient id="barFontePontual" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#6366f1" />
                            <stop offset="100%" stopColor="#818cf8" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={true} vertical={false} />
                        <XAxis 
                          type="number" 
                          stroke="#64748b" 
                          fontSize={11}
                          tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`}
                          tick={{ fill: '#94a3b8' }}
                        />
                        <YAxis 
                          type="category" 
                          dataKey="fonteLabel" 
                          stroke="#64748b" 
                          fontSize={10}
                          width={100}
                          tick={{ fill: '#94a3b8' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            border: '1px solid rgba(139, 92, 246, 0.3)',
                            borderRadius: '12px',
                            color: '#f1f5f9',
                            backdropFilter: 'blur(12px)'
                          }}
                          formatter={(value: number, name: string) => [
                            formatCurrency(value),
                            name === 'mrr' ? 'MRR' : 'Pontual'
                          ]}
                          labelFormatter={(label) => `Fonte: ${label}`}
                        />
                        <Legend 
                          wrapperStyle={{ paddingTop: '10px' }}
                          formatter={(value) => value === 'mrr' ? 'MRR' : 'Pontual'}
                        />
                        <Bar 
                          dataKey="mrr" 
                          fill="url(#barFonteMrr)" 
                          radius={[0, 4, 4, 0]} 
                          name="mrr"
                          stackId="fonte"
                        />
                        <Bar 
                          dataKey="pontual" 
                          fill="url(#barFontePontual)" 
                          radius={[0, 4, 4, 0]} 
                          name="pontual"
                          stackId="fonte"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Rankings Section */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Ranking Closers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-600/20 to-purple-600/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-violet-500/20 overflow-hidden">
                <div className="p-6 border-b border-violet-500/10 bg-gradient-to-r from-violet-500/5 to-purple-500/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-xl border border-violet-500/20">
                        <Users className="w-5 h-5 text-violet-400" />
                      </div>
                      <h3 className="text-lg font-bold text-white">Ranking Closers</h3>
                    </div>
                    <Badge className="bg-gradient-to-r from-violet-500 to-purple-500 text-white border-0 shadow-lg shadow-violet-500/20">
                      <Crown className="w-3 h-3 mr-1" />
                      MRR
                    </Badge>
                  </div>
                </div>
                <div className="p-6">
                  {isLoadingCloser ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-20 w-full bg-slate-800/50" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {mrrPorCloser?.slice(0, 5).map((closer, index) => {
                        const style = getMedalStyle(index);
                        return (
                          <motion.div
                            key={closer.closer}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.08 }}
                            whileHover={{ scale: 1.01, x: 4 }}
                            className={`relative p-4 rounded-xl border bg-gradient-to-r ${style.bg} ${style.border} shadow-lg ${style.glow}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${index < 3 ? style.badge : 'bg-slate-700/50'} shadow-lg`}>
                                  {style.icon}
                                </div>
                                <div>
                                  <p className="text-white font-bold">{closer.closer}</p>
                                  <p className="text-sm text-slate-400">{closer.contratos} contratos fechados</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-violet-400 font-black text-xl">{formatCurrency(closer.mrr)}</p>
                                <p className="text-xs text-slate-500">+ {formatCurrency(closer.pontual)} pontual</p>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Ranking SDRs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-600/20 to-teal-600/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-cyan-500/20 overflow-hidden">
                <div className="p-6 border-b border-cyan-500/10 bg-gradient-to-r from-cyan-500/5 to-teal-500/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-teal-500/20 rounded-xl border border-cyan-500/20">
                        <Briefcase className="w-5 h-5 text-cyan-400" />
                      </div>
                      <h3 className="text-lg font-bold text-white">Ranking SDRs</h3>
                    </div>
                    <Badge className="bg-gradient-to-r from-cyan-500 to-teal-500 text-white border-0 shadow-lg shadow-cyan-500/20">
                      <Crown className="w-3 h-3 mr-1" />
                      MRR
                    </Badge>
                  </div>
                </div>
                <div className="p-6">
                  {isLoadingSdr ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-20 w-full bg-slate-800/50" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {mrrPorSdr?.slice(0, 5).map((sdr, index) => {
                        const style = getMedalStyle(index);
                        return (
                          <motion.div
                            key={sdr.sdr}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.08 }}
                            whileHover={{ scale: 1.01, x: 4 }}
                            className={`relative p-4 rounded-xl border bg-gradient-to-r ${style.bg} ${style.border} shadow-lg ${style.glow}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${index < 3 ? style.badge : 'bg-slate-700/50'} shadow-lg`}>
                                  {style.icon}
                                </div>
                                <div>
                                  <p className="text-white font-bold">{sdr.sdr}</p>
                                  <p className="text-sm text-slate-400">{sdr.contratos} contratos gerados</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-cyan-400 font-black text-xl">{formatCurrency(sdr.mrr)}</p>
                                <p className="text-xs text-slate-500">+ {formatCurrency(sdr.pontual)} pontual</p>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bar Charts Section */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* MRR por Closer - Bar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-600/20 to-indigo-600/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-700/30 overflow-hidden">
                <div className="p-6 border-b border-slate-700/30">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-violet-500/20 to-indigo-500/20 rounded-xl border border-violet-500/20">
                      <BarChart3 className="w-5 h-5 text-violet-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">MRR por Closer</h3>
                  </div>
                </div>
                <div className="p-6">
                  {isLoadingCloser ? (
                    <Skeleton className="h-64 w-full bg-slate-800/50" />
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={mrrPorCloser?.slice(0, 8)} layout="vertical">
                        <defs>
                          <linearGradient id="barGradientMrr" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#8b5cf6" />
                            <stop offset="100%" stopColor="#a855f7" />
                          </linearGradient>
                          <linearGradient id="barGradientPontual" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#60a5fa" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis type="number" stroke="#64748b" fontSize={11} tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="closer" stroke="#64748b" fontSize={10} width={90} tick={{ fill: '#94a3b8' }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            border: '1px solid rgba(139, 92, 246, 0.3)',
                            borderRadius: '12px',
                            color: '#f1f5f9',
                            backdropFilter: 'blur(12px)'
                          }}
                          formatter={(value: number) => formatCurrency(value)}
                        />
                        <Legend />
                        <Bar dataKey="mrr" fill="url(#barGradientMrr)" radius={[0, 8, 8, 0]} name="MRR" />
                        <Bar dataKey="pontual" fill="url(#barGradientPontual)" radius={[0, 8, 8, 0]} name="Pontual" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* MRR por SDR - Bar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-600/20 to-teal-600/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-700/30 overflow-hidden">
                <div className="p-6 border-b border-slate-700/30">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-teal-500/20 rounded-xl border border-cyan-500/20">
                      <BarChart3 className="w-5 h-5 text-cyan-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">MRR por SDR</h3>
                  </div>
                </div>
                <div className="p-6">
                  {isLoadingSdr ? (
                    <Skeleton className="h-64 w-full bg-slate-800/50" />
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={mrrPorSdr?.slice(0, 8)} layout="vertical">
                        <defs>
                          <linearGradient id="barGradientSdrMrr" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#06b6d4" />
                            <stop offset="100%" stopColor="#22d3ee" />
                          </linearGradient>
                          <linearGradient id="barGradientSdrPontual" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#10b981" />
                            <stop offset="100%" stopColor="#34d399" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis type="number" stroke="#64748b" fontSize={11} tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="sdr" stroke="#64748b" fontSize={10} width={90} tick={{ fill: '#94a3b8' }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            border: '1px solid rgba(6, 182, 212, 0.3)',
                            borderRadius: '12px',
                            color: '#f1f5f9',
                            backdropFilter: 'blur(12px)'
                          }}
                          formatter={(value: number) => formatCurrency(value)}
                        />
                        <Legend />
                        <Bar dataKey="mrr" fill="url(#barGradientSdrMrr)" radius={[0, 8, 8, 0]} name="MRR" />
                        <Bar dataKey="pontual" fill="url(#barGradientSdrPontual)" radius={[0, 8, 8, 0]} name="Pontual" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
