import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User,
  DollarSign, 
  TrendingUp, 
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
  Timer,
  Percent,
  Repeat,
  Banknote,
  PiggyBank,
  BarChart3,
  Award,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Briefcase,
  Users,
  Sparkles,
  Crown,
  Rocket,
  Activity,
  TrendingDown,
  CheckCircle2,
  XCircle,
  CircleDot
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
  RadialBarChart,
  RadialBar
} from "recharts";
import { formatCurrency, formatCurrencyCompact, formatPercent, formatDecimal } from "@/lib/utils";

interface Closer {
  id: number;
  name: string;
  email: string | null;
  active: boolean;
}

interface CloserDetailMetrics {
  closerId: number;
  closerName: string;
  negociosGanhos: number;
  negociosPerdidos: number;
  negociosEmAndamento: number;
  totalNegocios: number;
  negociosRecorrentes: number;
  negociosPontuais: number;
  reunioesRealizadas: number;
  taxaConversao: number;
  valorRecorrente: number;
  valorPontual: number;
  valorTotal: number;
  ticketMedio: number;
  ticketMedioRecorrente: number;
  ticketMedioPontual: number;
  lt: number;
  primeiroNegocio: string | null;
  ultimoNegocio: string | null;
  diasAtivo: number;
  mediaContratosPorMes: number;
}

interface MonthlyData {
  mes: string;
  mesLabel: string;
  valorRecorrente: number;
  valorPontual: number;
  negocios: number;
  reunioes: number;
}

interface StageDistribution {
  stage: string;
  count: number;
  percentage: number;
}

interface SourceDistribution {
  source: string;
  count: number;
  percentage: number;
}

interface LeadTimeData {
  leadTimeMedio: number;
  leadTimeMin: number;
  leadTimeMax: number;
  leadTimeMediana: number;
  totalNegocios: number;
}

const SOURCE_NAME_MAP: Record<string, string> = {
  "CALL": "Agendamento Direto",
  "EMAIL": "Automação",
  "WEB": "Contato - Instagram",
  "ADVERTISING": "Contato Recebido",
  "PARTNER": "CrossSell",
  "RECOMMENDATION": "Eventos",
  "TRADE_SHOW": "Indound(Linkedin)",
  "WEBFORM": "Formulário",
  "CALLBACK": "Indicação",
  "RC_GENERATOR": "Indique e Ganhe",
  "STORE": "Wpp Marketing",
  "OTHER": "Lista - Wpp Marketing",
  "REPEAT_SALE": "Vendas Recorrentes",
  "UC_YWZVA2": "Prospecção Ativa",
  "UC_PTYW1Y": "Recomendação",
  "UC_4VCKGM": "Social Selling - Instagram",
  "UC_7WV0LW": "Upsell",
  "UC_KYOYOW": "Workshop",
  "UC_8HI30Y": "Recuperação de Churn"
};

function getSourceDisplayName(sourceId: string): string {
  return SOURCE_NAME_MAP[sourceId] || sourceId || "Não informado";
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

function GlowingBorder({ color = "violet" }: { color?: string }) {
  const gradients: Record<string, string> = {
    violet: "from-violet-500 via-purple-500 to-fuchsia-500",
    cyan: "from-cyan-500 via-teal-500 to-emerald-500",
    green: "from-green-500 via-emerald-500 to-teal-500",
    amber: "from-amber-500 via-orange-500 to-red-500",
    pink: "from-pink-500 via-rose-500 to-red-500",
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
          className="absolute w-1 h-1 bg-violet-500/30 rounded-full"
          initial={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
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

export default function DetailClosers() {
  usePageTitle("Detalhes Closer");
  const { setPageInfo } = usePageInfo();
  const hoje = new Date();
  const inicioAno = new Date(hoje.getFullYear(), 0, 1);
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

  const [closerId, setCloserId] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: inicioAno,
    to: fimMes,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: closers, isLoading: isLoadingClosers } = useQuery<Closer[]>({
    queryKey: ["/api/closers/list"],
  });

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (closerId) params.append("closerId", closerId);
    if (dateRange?.from) params.append("dataInicio", format(dateRange.from, 'yyyy-MM-dd'));
    if (dateRange?.to) params.append("dataFim", format(dateRange.to, 'yyyy-MM-dd'));
    return params.toString();
  };

  const queryParams = buildQueryParams();

  const { data: metrics, isLoading: isLoadingMetrics } = useQuery<CloserDetailMetrics>({
    queryKey: ["/api/closers/detail", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/closers/detail?${queryParams}`);
      return res.json();
    },
    enabled: !!closerId,
    refetchInterval: 60000,
  });

  const { data: monthlyData, isLoading: isLoadingMonthly } = useQuery<MonthlyData[]>({
    queryKey: ["/api/closers/detail/monthly", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/closers/detail/monthly?${queryParams}`);
      return res.json();
    },
    enabled: !!closerId,
    refetchInterval: 60000,
  });

  const { data: stageData, isLoading: isLoadingStage } = useQuery<StageDistribution[]>({
    queryKey: ["/api/closers/detail/stages", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/closers/detail/stages?${queryParams}`);
      return res.json();
    },
    enabled: !!closerId,
    refetchInterval: 60000,
  });

  const { data: sourceData, isLoading: isLoadingSource } = useQuery<SourceDistribution[]>({
    queryKey: ["/api/closers/detail/sources", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/closers/detail/sources?${queryParams}`);
      return res.json();
    },
    enabled: !!closerId,
    refetchInterval: 60000,
  });

  const { data: leadTimeData, isLoading: isLoadingLeadTime } = useQuery<LeadTimeData>({
    queryKey: ["/api/closers/detail/lead-time", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/closers/detail/lead-time?${queryParams}`);
      return res.json();
    },
    enabled: !!closerId,
    refetchInterval: 60000,
  });

  const resetFilters = () => {
    setDateRange({
      from: inicioAno,
      to: fimMes,
    });
  };

  useEffect(() => {
    if (metrics?.closerName) {
      setPageInfo(metrics.closerName, "Análise individual de performance em tempo real");
    } else {
      setPageInfo("Detalhamento de Closers", "Selecione um closer para ver detalhes");
    }
  }, [metrics?.closerName, setPageInfo]);


  const selectedCloser = closers?.find(c => c.id.toString() === closerId);

  const COLORS = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1', '#14B8A6'];
  const GRADIENT_COLORS = [
    ['#8B5CF6', '#A855F7'],
    ['#06B6D4', '#22D3EE'],
    ['#10B981', '#34D399'],
    ['#F59E0B', '#FBBF24'],
    ['#EF4444', '#F87171'],
    ['#EC4899', '#F472B6'],
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet-600/20 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-fuchsia-600/10 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
      </div>
      
      <FloatingParticles />

      <div className="relative z-10 p-6 lg:p-8">
        {/* Premium Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8 gap-4"
        >
          <div className="flex items-center gap-5">
            <motion.div 
              whileHover={{ scale: 1.05, rotate: 5 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl blur-xl opacity-60 animate-pulse" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-2xl shadow-violet-500/30">
                <User className="w-8 h-8 text-foreground" />
              </div>
            </motion.div>
          </div>
          
          <div className="flex items-center gap-4">
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 to-purple-600/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative bg-card/80 backdrop-blur-xl rounded-xl border border-violet-500/20 px-4 py-2">
                <p className="text-xs text-muted-foreground">Atualizado em</p>
                <p className="text-xl font-mono font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
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
              </Button>
            </motion.div>
          </div>
        </motion.div>

        {/* Closer Selector - Premium Style */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="relative max-w-lg">
            <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 to-purple-600 rounded-xl blur-lg opacity-30" />
            <div className="relative bg-card/90 backdrop-blur-xl rounded-xl border border-violet-500/30 p-4">
              <Label className="text-violet-300 mb-3 block flex items-center gap-2 text-sm font-medium">
                <Crown className="w-4 h-4 text-amber-400" />
                Selecione o Closer
              </Label>
              <Select value={closerId} onValueChange={setCloserId}>
                <SelectTrigger 
                  className="w-full bg-muted/50 border-border/50 text-foreground text-lg py-6 rounded-xl focus:ring-violet-500/50 focus:border-violet-500/50"
                  data-testid="select-closer"
                >
                  <SelectValue placeholder="Escolha um closer para analisar..." />
                </SelectTrigger>
                <SelectContent className="bg-card border-border rounded-xl">
                  {closers?.map(closer => (
                    <SelectItem 
                      key={closer.id} 
                      value={closer.id.toString()}
                      className="text-foreground hover:bg-violet-500/20 focus:bg-violet-500/20 cursor-pointer py-3"
                    >
                      <span className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-xs font-bold">
                          {closer.name.charAt(0)}
                        </div>
                        {closer.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </motion.div>

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -20 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -20 }}
              className="mb-8 overflow-hidden"
            >
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-violet-600/20 to-purple-600/20 rounded-2xl blur-lg" />
                <Card className="relative bg-card/80 border-border/50 backdrop-blur-xl rounded-2xl overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />
                  <CardContent className="p-6">
                    <div className="flex flex-wrap items-end gap-4">
                      <div>
                        <Label className="text-muted-foreground text-sm font-medium mb-2 block">Período</Label>
                        <DateRangePicker
                          value={dateRange}
                          onChange={setDateRange}
                          triggerClassName="bg-muted/50 border-border text-foreground rounded-xl hover:bg-muted/50"
                          className="bg-card border-border"
                        />
                      </div>
                      <Button 
                        variant="outline" 
                        onClick={resetFilters}
                        className="border-border text-muted-foreground hover:bg-muted/50 rounded-xl"
                        data-testid="button-reset-filters"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Resetar Filtros
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!closerId ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-24"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/30 to-purple-500/30 rounded-full blur-3xl animate-pulse" />
              <motion.div 
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ duration: 4, repeat: Infinity }}
                className="relative w-32 h-32 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 flex items-center justify-center"
              >
                <Users className="w-16 h-16 text-violet-400" />
              </motion.div>
            </div>
            <h2 className="text-2xl font-bold text-foreground mt-8 mb-3">Selecione um Closer</h2>
            <p className="text-muted-foreground text-center max-w-md">
              Escolha um closer no menu acima para visualizar suas métricas detalhadas de performance.
            </p>
          </motion.div>
        ) : isLoadingMetrics ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Skeleton className="h-36 bg-muted/50 rounded-2xl" />
              </motion.div>
            ))}
          </div>
        ) : metrics ? (
          <>
            {/* Profile Hero Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 rounded-3xl blur-xl opacity-40 group-hover:opacity-60 transition-opacity" />
                <Card className="relative bg-gradient-to-br from-slate-900/95 via-violet-950/50 to-slate-900/95 border-0 rounded-3xl overflow-hidden">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.05)_1px,transparent_1px)] bg-[size:30px_30px]" />
                  <CardContent className="relative p-8">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
                      {/* Avatar with Glow */}
                      <motion.div 
                        whileHover={{ scale: 1.05 }}
                        className="relative"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl blur-xl opacity-60" />
                        <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-2xl">
                          <span className="text-4xl font-black text-foreground">
                            {metrics.closerName.charAt(0)}
                          </span>
                          <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                            <Trophy className="w-4 h-4 text-foreground" />
                          </div>
                        </div>
                      </motion.div>

                      {/* Info */}
                      <div className="flex-1">
                        <h2 className="text-3xl lg:text-4xl font-black bg-gradient-to-r from-white via-violet-200 to-purple-200 bg-clip-text text-transparent">
                          {metrics.closerName}
                        </h2>
                        <div className="flex flex-wrap items-center gap-3 mt-3">
                          <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 px-4 py-1.5 text-sm font-semibold">
                            <Clock className="w-4 h-4 mr-2" />
                            {metrics.lt} meses ativos
                          </Badge>
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 px-4 py-1.5 text-sm font-semibold">
                            <Trophy className="w-4 h-4 mr-2" />
                            {metrics.negociosGanhos} negócios ganhos
                          </Badge>
                          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 px-4 py-1.5 text-sm font-semibold">
                            <Flame className="w-4 h-4 mr-2" />
                            {formatPercent(metrics.taxaConversao)} conversão
                          </Badge>
                          {metrics.primeiroNegocio && (
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <CalendarDays className="w-4 h-4" />
                              Desde {new Date(metrics.primeiroNegocio).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Total Value */}
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground mb-1">Valor Total Gerado</p>
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", delay: 0.3 }}
                        >
                          <p className="text-4xl lg:text-5xl font-black bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400 bg-clip-text text-transparent">
                            <AnimatedCounter value={metrics.valorTotal} prefix="R$ " />
                          </p>
                        </motion.div>
                        <div className="flex items-center justify-end gap-2 mt-2">
                          <div className="flex items-center gap-1 text-emerald-400 text-sm">
                            <ArrowUpRight className="w-4 h-4" />
                            <span>Excelente performance</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>

            {/* Premium Metrics Grid - Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <PremiumMetricCard
                title="Valor Recorrente"
                value={metrics.valorRecorrente}
                icon={Repeat}
                color="violet"
                subtitle={`Ticket médio: ${formatCurrency(metrics.ticketMedioRecorrente)} (${metrics.negociosRecorrentes || 0} contratos)`}
                delay={0}
                isCurrency
              />
              <PremiumMetricCard
                title="Valor Pontual"
                value={metrics.valorPontual}
                icon={Banknote}
                color="cyan"
                subtitle={`Ticket médio: ${formatCurrency(metrics.ticketMedioPontual)} (${metrics.negociosPontuais || 0} contratos)`}
                delay={0.1}
                isCurrency
              />
              <PremiumMetricCard
                title="Ticket Médio Total"
                value={metrics.ticketMedio}
                icon={DollarSign}
                color="green"
                subtitle={`${metrics.negociosGanhos} negócios ganhos`}
                delay={0.2}
                isCurrency
              />
              <PremiumMetricCard
                title="Taxa de Conversão"
                value={metrics.taxaConversao}
                icon={Target}
                color="amber"
                subtitle={`${metrics.negociosGanhos}/${metrics.reunioesRealizadas} reuniões`}
                delay={0.3}
                isPercentage
              />
            </div>

            {/* Premium Metrics Grid - Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <PremiumMetricCard
                title="Reuniões Realizadas"
                value={metrics.reunioesRealizadas}
                icon={Calendar}
                color="blue"
                subtitle="Total no período"
                delay={0.4}
              />
              <PremiumMetricCard
                title="Negócios Ganhos"
                value={metrics.negociosGanhos}
                icon={Trophy}
                color="emerald"
                subtitle={`${metrics.negociosPerdidos} perdidos`}
                delay={0.5}
                extraBadge={
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Campeão
                  </Badge>
                }
              />
              <PremiumMetricCard
                title="Em Andamento"
                value={metrics.negociosEmAndamento}
                icon={Activity}
                color="orange"
                subtitle="Negócios ativos"
                delay={0.6}
              />
              <PremiumMetricCard
                title="Média Contratos/Mês"
                value={parseFloat(formatDecimal(metrics.mediaContratosPorMes))}
                icon={TrendingUp}
                color="pink"
                subtitle={`${metrics.lt} meses ativos`}
                delay={0.7}
              />
            </div>

            {/* Lead Time Card */}
            {leadTimeData && leadTimeData.totalNegocios > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="md:col-span-4"
                >
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/30 to-cyan-600/30 rounded-2xl blur-xl opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
                    <Card className="relative bg-card/80 border-border/50 backdrop-blur-xl rounded-2xl overflow-hidden">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-3 text-foreground">
                          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/25">
                            <Timer className="w-6 h-6 text-foreground" />
                          </div>
                          <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                            Lead Time (Tempo de Fechamento)
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                          <div className="text-center p-4 bg-muted/50 rounded-xl border border-border/30">
                            <div className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                              {formatDecimal(leadTimeData.leadTimeMedio)}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">Média (dias)</div>
                          </div>
                          <div className="text-center p-4 bg-muted/50 rounded-xl border border-border/30">
                            <div className="text-3xl font-bold text-emerald-400">
                              {formatDecimal(leadTimeData.leadTimeMin)}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">Mínimo (dias)</div>
                          </div>
                          <div className="text-center p-4 bg-muted/50 rounded-xl border border-border/30">
                            <div className="text-3xl font-bold text-amber-400">
                              {formatDecimal(leadTimeData.leadTimeMax)}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">Máximo (dias)</div>
                          </div>
                          <div className="text-center p-4 bg-muted/50 rounded-xl border border-border/30">
                            <div className="text-3xl font-bold text-violet-400">
                              {formatDecimal(leadTimeData.leadTimeMediana)}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">Mediana (dias)</div>
                          </div>
                        </div>
                        <div className="mt-4 text-center text-muted-foreground text-sm">
                          Baseado em {leadTimeData.totalNegocios} negócios ganhos no período
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Premium Tabs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <Tabs defaultValue="evolucao" className="space-y-6">
                <div className="relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-violet-600/20 to-purple-600/20 rounded-2xl blur-lg" />
                  <TabsList className="relative bg-card/90 border border-border/50 p-1.5 rounded-2xl backdrop-blur-xl">
                    <TabsTrigger 
                      value="evolucao" 
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-purple-600 data-[state=active]:text-foreground rounded-xl px-6 py-3 transition-all duration-300"
                      data-testid="tab-evolucao"
                    >
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Evolução Mensal
                    </TabsTrigger>
                    <TabsTrigger 
                      value="funil" 
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-purple-600 data-[state=active]:text-foreground rounded-xl px-6 py-3 transition-all duration-300"
                      data-testid="tab-funil"
                    >
                      <Target className="w-4 h-4 mr-2" />
                      Funil de Vendas
                    </TabsTrigger>
                    <TabsTrigger 
                      value="fontes" 
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-purple-600 data-[state=active]:text-foreground rounded-xl px-6 py-3 transition-all duration-300"
                      data-testid="tab-fontes"
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Fontes de Lead
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="evolucao">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <PremiumChartCard
                      title="Receita Mensal"
                      icon={DollarSign}
                      iconColor="text-emerald-400"
                    >
                      {isLoadingMonthly ? (
                        <Skeleton className="h-72 bg-muted/50 rounded-xl" />
                      ) : monthlyData && monthlyData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={monthlyData} barGap={8}>
                            <defs>
                              <linearGradient id="recorrenteGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#8B5CF6" stopOpacity={1} />
                                <stop offset="100%" stopColor="#6D28D9" stopOpacity={0.8} />
                              </linearGradient>
                              <linearGradient id="pontualGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#06B6D4" stopOpacity={1} />
                                <stop offset="100%" stopColor="#0891B2" stopOpacity={0.8} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis 
                              dataKey="mesLabel" 
                              tick={{ fill: '#94a3b8', fontSize: 12 }} 
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis 
                              tick={{ fill: '#94a3b8', fontSize: 12 }} 
                              tickFormatter={(value) => `R$ ${(value/1000).toFixed(0)}k`}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#0f172a', 
                                border: '1px solid rgba(139,92,246,0.3)', 
                                borderRadius: '12px',
                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
                              }}
                              labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                              formatter={(value: number, name: string) => [
                                formatCurrency(value),
                                name === 'valorRecorrente' ? 'Recorrente' : 'Pontual'
                              ]}
                            />
                            <Legend 
                              wrapperStyle={{ paddingTop: '20px' }}
                              formatter={(value) => <span style={{ color: '#94a3b8' }}>{value}</span>}
                            />
                            <Bar 
                              dataKey="valorRecorrente" 
                              name="Recorrente" 
                              fill="url(#recorrenteGradient)" 
                              radius={[8, 8, 0, 0]} 
                            />
                            <Bar 
                              dataKey="valorPontual" 
                              name="Pontual" 
                              fill="url(#pontualGradient)" 
                              radius={[8, 8, 0, 0]} 
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <EmptyChartState />
                      )}
                    </PremiumChartCard>

                    <PremiumChartCard
                      title="Negócios e Reuniões"
                      icon={TrendingUp}
                      iconColor="text-violet-400"
                    >
                      {isLoadingMonthly ? (
                        <Skeleton className="h-72 bg-muted/50 rounded-xl" />
                      ) : monthlyData && monthlyData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <AreaChart data={monthlyData}>
                            <defs>
                              <linearGradient id="reunioesGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.5} />
                                <stop offset="100%" stopColor="#06B6D4" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="negociosGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10B981" stopOpacity={0.5} />
                                <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis 
                              dataKey="mesLabel" 
                              tick={{ fill: '#94a3b8', fontSize: 12 }} 
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis 
                              tick={{ fill: '#94a3b8', fontSize: 12 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#0f172a', 
                                border: '1px solid rgba(139,92,246,0.3)', 
                                borderRadius: '12px',
                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
                              }}
                              labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                            />
                            <Legend 
                              wrapperStyle={{ paddingTop: '20px' }}
                              formatter={(value) => <span style={{ color: '#94a3b8' }}>{value}</span>}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="reunioes" 
                              name="Reuniões" 
                              stroke="#06B6D4" 
                              strokeWidth={3}
                              fill="url(#reunioesGradient)" 
                            />
                            <Area 
                              type="monotone" 
                              dataKey="negocios" 
                              name="Negócios Ganhos" 
                              stroke="#10B981" 
                              strokeWidth={3}
                              fill="url(#negociosGradient)" 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <EmptyChartState />
                      )}
                    </PremiumChartCard>
                  </div>
                </TabsContent>

                <TabsContent value="funil">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <PremiumChartCard
                      title="Distribuição por Etapa"
                      icon={Target}
                      iconColor="text-violet-400"
                    >
                      {isLoadingStage ? (
                        <Skeleton className="h-72 bg-muted/50 rounded-xl" />
                      ) : stageData && stageData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <defs>
                              {GRADIENT_COLORS.map(([start, end], index) => (
                                <linearGradient key={index} id={`pieGradient${index}`} x1="0" y1="0" x2="1" y2="1">
                                  <stop offset="0%" stopColor={start} stopOpacity={1} />
                                  <stop offset="100%" stopColor={end} stopOpacity={0.8} />
                                </linearGradient>
                              ))}
                            </defs>
                            <Pie
                              data={stageData}
                              cx="50%"
                              cy="50%"
                              innerRadius={70}
                              outerRadius={110}
                              paddingAngle={3}
                              dataKey="count"
                              nameKey="stage"
                            >
                              {stageData.map((entry, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={`url(#pieGradient${index % GRADIENT_COLORS.length})`}
                                  stroke="transparent"
                                />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#0f172a', 
                                border: '1px solid rgba(139,92,246,0.3)', 
                                borderRadius: '12px',
                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
                              }}
                              formatter={(value: number, name: string) => [value, name]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <EmptyChartState />
                      )}
                    </PremiumChartCard>

                    <PremiumChartCard
                      title="Detalhamento por Etapa"
                      icon={BarChart3}
                      iconColor="text-purple-400"
                    >
                      {isLoadingStage ? (
                        <Skeleton className="h-72 bg-muted/50 rounded-xl" />
                      ) : stageData && stageData.length > 0 ? (
                        <div className="space-y-4 max-h-72 overflow-y-auto pr-2 scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-violet-600">
                          {stageData.map((stage, index) => (
                            <motion.div 
                              key={stage.stage}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="group"
                            >
                              <div className="flex items-center gap-4 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                                <div 
                                  className="w-4 h-4 rounded-full shadow-lg" 
                                  style={{ 
                                    background: `linear-gradient(135deg, ${GRADIENT_COLORS[index % GRADIENT_COLORS.length][0]}, ${GRADIENT_COLORS[index % GRADIENT_COLORS.length][1]})`,
                                    boxShadow: `0 0 20px ${GRADIENT_COLORS[index % GRADIENT_COLORS.length][0]}40`
                                  }}
                                />
                                <span className="flex-1 text-foreground text-sm font-medium truncate">{stage.stage}</span>
                                <Badge className="bg-muted/50 text-foreground border-0 font-bold px-3">
                                  {stage.count}
                                </Badge>
                                <div className="w-20">
                                  <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                                    <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${stage.percentage}%` }}
                                      transition={{ delay: index * 0.1 + 0.3, duration: 0.5 }}
                                      className="h-full rounded-full"
                                      style={{ 
                                        background: `linear-gradient(90deg, ${GRADIENT_COLORS[index % GRADIENT_COLORS.length][0]}, ${GRADIENT_COLORS[index % GRADIENT_COLORS.length][1]})`
                                      }}
                                    />
                                  </div>
                                  <span className="text-xs text-muted-foreground mt-1 block text-right">
                                    {formatPercent(stage.percentage)}
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <EmptyChartState />
                      )}
                    </PremiumChartCard>
                  </div>
                </TabsContent>

                <TabsContent value="fontes">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <PremiumChartCard
                      title="Leads por Fonte"
                      icon={Users}
                      iconColor="text-cyan-400"
                    >
                      {isLoadingSource ? (
                        <Skeleton className="h-72 bg-muted/50 rounded-xl" />
                      ) : sourceData && sourceData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={sourceData.slice(0, 8).map(s => ({ ...s, source: getSourceDisplayName(s.source) }))} layout="vertical" barSize={20}>
                            <defs>
                              <linearGradient id="sourceGradient" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#06B6D4" stopOpacity={1} />
                                <stop offset="100%" stopColor="#22D3EE" stopOpacity={0.8} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                            <XAxis 
                              type="number" 
                              tick={{ fill: '#94a3b8', fontSize: 12 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis 
                              type="category" 
                              dataKey="source" 
                              tick={{ fill: '#94a3b8', fontSize: 11 }}
                              width={120}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#0f172a', 
                                border: '1px solid rgba(6,182,212,0.3)', 
                                borderRadius: '12px',
                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
                              }}
                              labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                            />
                            <Bar 
                              dataKey="count" 
                              fill="url(#sourceGradient)" 
                              radius={[0, 8, 8, 0]} 
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <EmptyChartState />
                      )}
                    </PremiumChartCard>

                    <PremiumChartCard
                      title="Top Fontes"
                      icon={Award}
                      iconColor="text-amber-400"
                    >
                      {isLoadingSource ? (
                        <Skeleton className="h-72 bg-muted/50 rounded-xl" />
                      ) : sourceData && sourceData.length > 0 ? (
                        <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
                          {sourceData.slice(0, 10).map((source, index) => (
                            <motion.div 
                              key={source.source}
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="flex items-center gap-4 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors group"
                            >
                              <div className={`
                                w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black
                                ${index === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-foreground shadow-lg shadow-amber-500/30' : 
                                  index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-foreground' :
                                  index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-foreground' :
                                  'bg-muted/50 text-muted-foreground'}
                              `}>
                                {index === 0 ? <Crown className="w-5 h-5" /> : index + 1}
                              </div>
                              <span className="flex-1 text-foreground text-sm font-medium truncate">
                                {getSourceDisplayName(source.source)}
                              </span>
                              <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 font-bold px-3 py-1">
                                {source.count} leads
                              </Badge>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <EmptyChartState />
                      )}
                    </PremiumChartCard>
                  </div>
                </TabsContent>
              </Tabs>
            </motion.div>
          </>
        ) : null}
      </div>
    </div>
  );
}

interface PremiumMetricCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: 'violet' | 'cyan' | 'green' | 'amber' | 'blue' | 'emerald' | 'orange' | 'pink';
  subtitle?: string;
  delay?: number;
  isCurrency?: boolean;
  isPercentage?: boolean;
  extraBadge?: React.ReactNode;
}

function PremiumMetricCard({ 
  title, 
  value, 
  icon: Icon, 
  color, 
  subtitle, 
  delay = 0,
  isCurrency = false,
  isPercentage = false,
  extraBadge
}: PremiumMetricCardProps) {
  const colorConfig = {
    violet: {
      gradient: 'from-violet-500/20 via-purple-500/10 to-fuchsia-500/20',
      border: 'border-violet-500/30',
      glow: 'violet-500',
      icon: 'from-violet-500 to-purple-600',
      text: 'text-violet-400',
      shadow: 'shadow-violet-500/20'
    },
    cyan: {
      gradient: 'from-cyan-500/20 via-teal-500/10 to-emerald-500/20',
      border: 'border-cyan-500/30',
      glow: 'cyan-500',
      icon: 'from-cyan-500 to-teal-500',
      text: 'text-cyan-400',
      shadow: 'shadow-cyan-500/20'
    },
    green: {
      gradient: 'from-green-500/20 via-emerald-500/10 to-teal-500/20',
      border: 'border-green-500/30',
      glow: 'green-500',
      icon: 'from-green-500 to-emerald-500',
      text: 'text-green-400',
      shadow: 'shadow-green-500/20'
    },
    amber: {
      gradient: 'from-amber-500/20 via-orange-500/10 to-yellow-500/20',
      border: 'border-amber-500/30',
      glow: 'amber-500',
      icon: 'from-amber-500 to-orange-500',
      text: 'text-amber-400',
      shadow: 'shadow-amber-500/20'
    },
    blue: {
      gradient: 'from-blue-500/20 via-indigo-500/10 to-violet-500/20',
      border: 'border-blue-500/30',
      glow: 'blue-500',
      icon: 'from-blue-500 to-indigo-500',
      text: 'text-blue-400',
      shadow: 'shadow-blue-500/20'
    },
    emerald: {
      gradient: 'from-emerald-500/20 via-teal-500/10 to-cyan-500/20',
      border: 'border-emerald-500/30',
      glow: 'emerald-500',
      icon: 'from-emerald-500 to-teal-500',
      text: 'text-emerald-400',
      shadow: 'shadow-emerald-500/20'
    },
    orange: {
      gradient: 'from-orange-500/20 via-amber-500/10 to-yellow-500/20',
      border: 'border-orange-500/30',
      glow: 'orange-500',
      icon: 'from-orange-500 to-amber-500',
      text: 'text-orange-400',
      shadow: 'shadow-orange-500/20'
    },
    pink: {
      gradient: 'from-pink-500/20 via-rose-500/10 to-red-500/20',
      border: 'border-pink-500/30',
      glow: 'pink-500',
      icon: 'from-pink-500 to-rose-500',
      text: 'text-pink-400',
      shadow: 'shadow-pink-500/20'
    },
  };

  const config = colorConfig[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 100 }}
      whileHover={{ scale: 1.02, y: -5 }}
      className="group"
    >
      <div className="relative">
        <div className={`absolute -inset-1 bg-gradient-to-r ${config.gradient} rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
        <Card className={`relative bg-gradient-to-br ${config.gradient} ${config.border} backdrop-blur-xl rounded-2xl overflow-hidden shadow-xl ${config.shadow}`}>
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-muted-foreground text-sm font-medium mb-1">{title}</p>
                <p className="text-3xl font-black text-foreground">
                  {isCurrency ? (
                    <AnimatedCounter value={value} prefix="R$ " />
                  ) : isPercentage ? (
                    <><AnimatedCounter value={Math.floor(value)} suffix=""/><span className="text-2xl">.{Math.round((value % 1) * 10)}%</span></>
                  ) : (
                    <AnimatedCounter value={value} />
                  )}
                </p>
                {subtitle && <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>}
                {extraBadge && <div className="mt-2">{extraBadge}</div>}
              </div>
              <motion.div 
                whileHover={{ rotate: 10, scale: 1.1 }}
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.icon} flex items-center justify-center shadow-lg ${config.shadow}`}
              >
                <Icon className="w-6 h-6 text-foreground" />
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

interface PremiumChartCardProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  children: React.ReactNode;
}

function PremiumChartCard({ title, icon: Icon, iconColor, children }: PremiumChartCardProps) {
  return (
    <div className="relative group">
      <div className="absolute -inset-1 bg-gradient-to-r from-violet-600/10 to-purple-600/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <Card className="relative bg-card/80 border-border/50 backdrop-blur-xl rounded-2xl overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
        <CardHeader className="pb-2">
          <CardTitle className="text-foreground flex items-center gap-3 text-lg">
            <div className="w-10 h-10 rounded-xl bg-muted/80 flex items-center justify-center">
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {children}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyChartState() {
  return (
    <div className="h-72 flex flex-col items-center justify-center text-muted-foreground">
      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
        <BarChart3 className="w-8 h-8 text-muted-foreground" />
      </div>
      <p className="text-sm">Sem dados para o período</p>
    </div>
  );
}
