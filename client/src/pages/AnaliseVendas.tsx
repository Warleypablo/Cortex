import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Target, 
  CalendarDays,
  Filter,
  RotateCcw,
  Trophy,
  Flame,
  Zap,
  Star,
  Calendar,
  Clock,
  Repeat,
  Banknote,
  PiggyBank,
  BarChart3,
  Award,
  Users,
  Sparkles,
  Crown,
  Rocket,
  Activity,
  FileText,
  Briefcase,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
  ComposedChart
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

function GlowingBorder({ color = "blue" }: { color?: string }) {
  const gradients: Record<string, string> = {
    blue: "from-blue-500 via-indigo-500 to-violet-500",
    cyan: "from-cyan-500 via-teal-500 to-emerald-500",
    green: "from-green-500 via-emerald-500 to-teal-500",
    amber: "from-amber-500 via-orange-500 to-red-500",
    pink: "from-pink-500 via-rose-500 to-red-500",
    violet: "from-violet-500 via-purple-500 to-fuchsia-500",
  };
  
  return (
    <div className="absolute inset-0 rounded-2xl overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-r ${gradients[color]} opacity-20`} />
      <div className={`absolute -inset-1 bg-gradient-to-r ${gradients[color]} opacity-30 blur-xl animate-pulse`} />
    </div>
  );
}

function FloatingParticles() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-blue-500/30 rounded-full"
          initial={{
            x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1920),
            y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1080),
          }}
          animate={{
            y: [null, -100],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 2,
          }}
        />
      ))}
    </div>
  );
}

const CHART_COLORS = [
  "#3b82f6", // blue-500
  "#8b5cf6", // violet-500
  "#06b6d4", // cyan-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#ec4899", // pink-500
  "#6366f1", // indigo-500
];

export default function AnaliseVendas() {
  const hoje = new Date();
  const inicioAno = new Date(hoje.getFullYear(), 0, 1).toISOString().split('T')[0];
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];

  const [dataInicio, setDataInicio] = useState<string>(inicioAno);
  const [dataFim, setDataFim] = useState<string>(fimMes);
  const [pipeline, setPipeline] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (dataInicio) params.append("dataInicio", dataInicio);
    if (dataFim) params.append("dataFim", dataFim);
    if (pipeline) params.append("pipeline", pipeline);
    if (source) params.append("source", source);
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
    setDataInicio(inicioAno);
    setDataFim(fimMes);
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

  const chartContratosData = contratosPorDia?.map(item => ({
    ...item,
    diaLabel: formatDate(item.dia),
    total: item.valorRecorrente + item.valorPontual
  })) || [];

  const getMedalIcon = (position: number) => {
    switch (position) {
      case 0:
        return <Crown className="w-5 h-5 text-yellow-400" />;
      case 1:
        return <Trophy className="w-5 h-5 text-gray-300" />;
      case 2:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return <Star className="w-4 h-4 text-blue-400" />;
    }
  };

  const getMedalBg = (position: number) => {
    switch (position) {
      case 0:
        return "bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/30";
      case 1:
        return "bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-gray-400/30";
      case 2:
        return "bg-gradient-to-r from-amber-600/20 to-orange-600/20 border-amber-600/30";
      default:
        return "bg-slate-800/50 border-slate-700/30";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 relative overflow-hidden">
      <FloatingParticles />
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-violet-500/5 rounded-full blur-3xl" />
      </div>
      
      <div className="relative z-10 p-6 space-y-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-violet-500 rounded-2xl blur-xl opacity-50" />
              <div className="relative p-4 bg-gradient-to-br from-blue-600 to-violet-600 rounded-2xl shadow-2xl">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
                Análise de Vendas
              </h1>
              <p className="text-slate-400 mt-1 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {currentTime.toLocaleTimeString('pt-BR')} • {currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50 text-slate-300"
              data-testid="button-toggle-filters"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filtros
              {(pipeline || source) && (
                <Badge className="ml-2 bg-blue-500/20 text-blue-400 border-blue-500/30">
                  {[pipeline, source].filter(Boolean).length}
                </Badge>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-slate-400 hover:text-slate-200"
              data-testid="button-reset-filters"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Limpar
            </Button>
          </div>
        </motion.div>

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <Card className="bg-gradient-to-br from-slate-900/90 via-slate-800/80 to-blue-900/30 border-slate-700/50 backdrop-blur-xl shadow-2xl">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <Label className="text-slate-300 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-400" />
                        Data Início
                      </Label>
                      <div className="relative">
                        <Input
                          type="date"
                          value={dataInicio}
                          onChange={(e) => setDataInicio(e.target.value)}
                          className="bg-slate-800/50 border-slate-600/50 text-slate-200 focus:ring-blue-500/50 focus:border-blue-500/50"
                          data-testid="input-data-inicio"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300 flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-blue-400" />
                        Data Fim
                      </Label>
                      <div className="relative">
                        <Input
                          type="date"
                          value={dataFim}
                          onChange={(e) => setDataFim(e.target.value)}
                          className="bg-slate-800/50 border-slate-600/50 text-slate-200 focus:ring-blue-500/50 focus:border-blue-500/50"
                          data-testid="input-data-fim"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-indigo-400" />
                        Pipeline
                      </Label>
                      <Select value={pipeline} onValueChange={setPipeline}>
                        <SelectTrigger className="bg-slate-800/50 border-slate-600/50 text-slate-200" data-testid="select-pipeline">
                          <SelectValue placeholder="Todos os pipelines" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          <SelectItem value="all">Todos os pipelines</SelectItem>
                          {filtros?.pipelines.map((p) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300 flex items-center gap-2">
                        <Target className="w-4 h-4 text-violet-400" />
                        Fonte
                      </Label>
                      <Select value={source} onValueChange={setSource}>
                        <SelectTrigger className="bg-slate-800/50 border-slate-600/50 text-slate-200" data-testid="select-source">
                          <SelectValue placeholder="Todas as fontes" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          <SelectItem value="all">Todas as fontes</SelectItem>
                          {filtros?.sources.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* KPI Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {/* Receita Total */}
          <Card className="relative bg-gradient-to-br from-slate-900/90 via-blue-900/30 to-slate-900/90 border-blue-500/30 overflow-hidden">
            <GlowingBorder color="blue" />
            <CardContent className="relative z-10 p-6">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-blue-500/20 rounded-xl">
                  <DollarSign className="w-6 h-6 text-blue-400" />
                </div>
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Total
                </Badge>
              </div>
              <div className="mt-4">
                <p className="text-sm text-slate-400">Receita Total</p>
                {isLoadingKpis ? (
                  <Skeleton className="h-8 w-32 mt-1 bg-slate-700" />
                ) : (
                  <p className="text-2xl font-bold text-white">
                    <AnimatedCounter value={kpis?.receitaTotal || 0} prefix="R$ " />
                  </p>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="bg-slate-800/50 rounded-lg p-2">
                  <span className="text-slate-400">Recorrente</span>
                  <p className="text-blue-400 font-semibold">{formatCurrency(kpis?.receitaRecorrente || 0)}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-2">
                  <span className="text-slate-400">Pontual</span>
                  <p className="text-violet-400 font-semibold">{formatCurrency(kpis?.receitaPontual || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Contratos */}
          <Card className="relative bg-gradient-to-br from-slate-900/90 via-violet-900/30 to-slate-900/90 border-violet-500/30 overflow-hidden">
            <GlowingBorder color="violet" />
            <CardContent className="relative z-10 p-6">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-violet-500/20 rounded-xl">
                  <FileText className="w-6 h-6 text-violet-400" />
                </div>
                <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Ganhos
                </Badge>
              </div>
              <div className="mt-4">
                <p className="text-sm text-slate-400">Total de Contratos</p>
                {isLoadingKpis ? (
                  <Skeleton className="h-8 w-24 mt-1 bg-slate-700" />
                ) : (
                  <p className="text-2xl font-bold text-white">
                    <AnimatedCounter value={kpis?.totalContratos || 0} />
                  </p>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="bg-slate-800/50 rounded-lg p-2">
                  <span className="text-slate-400">Recorrentes</span>
                  <p className="text-violet-400 font-semibold">{kpis?.contratosRecorrentes || 0}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-2">
                  <span className="text-slate-400">Pontuais</span>
                  <p className="text-indigo-400 font-semibold">{kpis?.contratosPontuais || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ticket Médio */}
          <Card className="relative bg-gradient-to-br from-slate-900/90 via-cyan-900/30 to-slate-900/90 border-cyan-500/30 overflow-hidden">
            <GlowingBorder color="cyan" />
            <CardContent className="relative z-10 p-6">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-cyan-500/20 rounded-xl">
                  <Banknote className="w-6 h-6 text-cyan-400" />
                </div>
                <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                  <Target className="w-3 h-3 mr-1" />
                  Médio
                </Badge>
              </div>
              <div className="mt-4">
                <p className="text-sm text-slate-400">Ticket Médio Recorrente</p>
                {isLoadingKpis ? (
                  <Skeleton className="h-8 w-32 mt-1 bg-slate-700" />
                ) : (
                  <p className="text-2xl font-bold text-white">
                    <AnimatedCounter value={kpis?.ticketMedioRecorrente || 0} prefix="R$ " />
                  </p>
                )}
              </div>
              <div className="mt-4 bg-slate-800/50 rounded-lg p-2">
                <span className="text-slate-400 text-sm">Ticket Médio Pontual</span>
                <p className="text-cyan-400 font-semibold">{formatCurrency(kpis?.ticketMedioPontual || 0)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Tempo Médio Fechamento */}
          <Card className="relative bg-gradient-to-br from-slate-900/90 via-green-900/30 to-slate-900/90 border-green-500/30 overflow-hidden">
            <GlowingBorder color="green" />
            <CardContent className="relative z-10 p-6">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-green-500/20 rounded-xl">
                  <Clock className="w-6 h-6 text-green-400" />
                </div>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  <Rocket className="w-3 h-3 mr-1" />
                  Ciclo
                </Badge>
              </div>
              <div className="mt-4">
                <p className="text-sm text-slate-400">Tempo Médio de Fechamento</p>
                {isLoadingKpis ? (
                  <Skeleton className="h-8 w-24 mt-1 bg-slate-700" />
                ) : (
                  <p className="text-2xl font-bold text-white">
                    <AnimatedCounter value={Math.round(kpis?.tempoFechamentoDias || 0)} suffix=" dias" />
                  </p>
                )}
              </div>
              <div className="mt-4 bg-slate-800/50 rounded-lg p-2 flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-400" />
                <span className="text-slate-300 text-sm">Ciclo de vendas médio</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Contratos por Dia */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-gradient-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 border-slate-700/50 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-blue-400" />
                  </div>
                  Evolução de Vendas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingContratos ? (
                  <Skeleton className="h-80 w-full bg-slate-800/50" />
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={chartContratosData}>
                      <defs>
                        <linearGradient id="colorRecorrente" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorPontual" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="diaLabel" stroke="#94a3b8" fontSize={12} />
                      <YAxis yAxisId="left" stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                      <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #475569',
                          borderRadius: '12px',
                          color: '#f1f5f9'
                        }}
                        formatter={(value: number, name: string) => [
                          name === 'contratos' ? value : formatCurrency(value),
                          name === 'valorRecorrente' ? 'Recorrente' : name === 'valorPontual' ? 'Pontual' : 'Contratos'
                        ]}
                      />
                      <Legend />
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="valorRecorrente"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="url(#colorRecorrente)"
                        name="Recorrente"
                      />
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="valorPontual"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        fill="url(#colorPontual)"
                        name="Pontual"
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="contratos"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={{ fill: '#10b981', strokeWidth: 2 }}
                        name="Contratos"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Receita por Fonte */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-gradient-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 border-slate-700/50 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-violet-500/20 rounded-lg">
                    <Target className="w-5 h-5 text-violet-400" />
                  </div>
                  Receita por Fonte
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingFonte ? (
                  <Skeleton className="h-80 w-full bg-slate-800/50" />
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="50%" height={280}>
                      <PieChart>
                        <Pie
                          data={receitaPorFonte}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="mrr"
                          nameKey="fonte"
                        >
                          {receitaPorFonte?.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1e293b',
                            border: '1px solid #475569',
                            borderRadius: '12px',
                            color: '#f1f5f9'
                          }}
                          formatter={(value: number) => formatCurrency(value)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2">
                      {receitaPorFonte?.map((item, index) => (
                        <div
                          key={item.fonte}
                          className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/30"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                            />
                            <span className="text-slate-300">{item.fonte}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-white font-semibold">{formatCurrency(item.mrr + item.pontual)}</p>
                            <p className="text-xs text-slate-400">{item.contratos} contratos</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Rankings Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ranking Closers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-gradient-to-br from-slate-900/90 via-violet-900/20 to-slate-900/90 border-violet-500/30 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-violet-500/20 rounded-lg">
                    <Users className="w-5 h-5 text-violet-400" />
                  </div>
                  Ranking Closers
                  <Badge className="ml-auto bg-violet-500/20 text-violet-400 border-violet-500/30">
                    MRR
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingCloser ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full bg-slate-800/50" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mrrPorCloser?.slice(0, 5).map((closer, index) => (
                      <motion.div
                        key={closer.closer}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`p-4 rounded-xl border ${getMedalBg(index)}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-800/50 border border-slate-700/50">
                              {getMedalIcon(index)}
                            </div>
                            <div>
                              <p className="text-white font-semibold">{closer.closer}</p>
                              <p className="text-sm text-slate-400">{closer.contratos} contratos</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-violet-400 font-bold text-lg">{formatCurrency(closer.mrr)}</p>
                            <p className="text-xs text-slate-500">+ {formatCurrency(closer.pontual)} pontual</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Ranking SDRs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="bg-gradient-to-br from-slate-900/90 via-cyan-900/20 to-slate-900/90 border-cyan-500/30 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-cyan-500/20 rounded-lg">
                    <Briefcase className="w-5 h-5 text-cyan-400" />
                  </div>
                  Ranking SDRs
                  <Badge className="ml-auto bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                    MRR
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingSdr ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full bg-slate-800/50" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mrrPorSdr?.slice(0, 5).map((sdr, index) => (
                      <motion.div
                        key={sdr.sdr}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`p-4 rounded-xl border ${getMedalBg(index)}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-800/50 border border-slate-700/50">
                              {getMedalIcon(index)}
                            </div>
                            <div>
                              <p className="text-white font-semibold">{sdr.sdr}</p>
                              <p className="text-sm text-slate-400">{sdr.contratos} contratos</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-cyan-400 font-bold text-lg">{formatCurrency(sdr.mrr)}</p>
                            <p className="text-xs text-slate-500">+ {formatCurrency(sdr.pontual)} pontual</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Bar Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* MRR por Closer - Bar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="bg-gradient-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 border-slate-700/50 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-violet-500/20 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-violet-400" />
                  </div>
                  MRR por Closer
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingCloser ? (
                  <Skeleton className="h-64 w-full bg-slate-800/50" />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={mrrPorCloser} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis type="number" stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="closer" stroke="#94a3b8" fontSize={12} width={100} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #475569',
                          borderRadius: '12px',
                          color: '#f1f5f9'
                        }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Bar dataKey="mrr" fill="#8b5cf6" radius={[0, 6, 6, 0]} name="MRR" />
                      <Bar dataKey="pontual" fill="#3b82f6" radius={[0, 6, 6, 0]} name="Pontual" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* MRR por SDR - Bar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Card className="bg-gradient-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 border-slate-700/50 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-cyan-500/20 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-cyan-400" />
                  </div>
                  MRR por SDR
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingSdr ? (
                  <Skeleton className="h-64 w-full bg-slate-800/50" />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={mrrPorSdr} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis type="number" stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="sdr" stroke="#94a3b8" fontSize={12} width={100} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #475569',
                          borderRadius: '12px',
                          color: '#f1f5f9'
                        }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Bar dataKey="mrr" fill="#06b6d4" radius={[0, 6, 6, 0]} name="MRR" />
                      <Bar dataKey="pontual" fill="#10b981" radius={[0, 6, 6, 0]} name="Pontual" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
