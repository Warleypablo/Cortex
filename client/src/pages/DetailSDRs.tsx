import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePageInfo } from "@/contexts/PageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { motion, AnimatePresence } from "framer-motion";
import { format, startOfYear, endOfMonth } from "date-fns";
import type { DateRange } from "react-day-picker";
import { 
  User,
  Users, 
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
  Phone,
  MessageSquare,
  BarChart3,
  Award,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Briefcase,
  Sparkles,
  Crown,
  Rocket,
  Activity,
  TrendingDown,
  CheckCircle2,
  XCircle,
  CircleDot,
  FileText,
  Handshake,
  DollarSign
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

interface SDR {
  id: number;
  name: string;
  email: string | null;
  active: boolean;
}

interface SDRDetailMetrics {
  sdrId: number;
  sdrName: string;
  sdrEmail: string | null;
  leadsTotais: number;
  reunioesRealizadas: number;
  negociosGanhos: number;
  negociosPerdidos: number;
  negociosEmAndamento: number;
  valorRecorrente: number;
  valorPontual: number;
  valorTotal: number;
  taxaLeadReuniao: number;
  taxaReuniaoVenda: number;
  taxaLeadVenda: number;
  primeiroLead: string | null;
  ultimoLead: string | null;
  ticketMedio: number;
}

interface MonthlyData {
  mes: string;
  mesLabel: string;
  leads: number;
  reunioes: number;
  vendas: number;
  valorRecorrente: number;
  valorPontual: number;
}

interface SourceDistribution {
  source: string;
  leads: number;
  reunioes: number;
  vendas: number;
  percentage: number;
}

interface PipelineDistribution {
  pipeline: string;
  leads: number;
  reunioes: number;
  vendas: number;
  valorRecorrente: number;
  percentage: number;
}

interface StageDistribution {
  stage: string;
  count: number;
  percentage: number;
}

const SOURCE_NAME_MAP: Record<string, string> = {
  "CALL": "Agendamento Direto",
  "EMAIL": "Automação",
  "WEB": "Contato - Instagram",
  "ADVERTISING": "Contato Recebido",
  "PARTNER": "CrossSell",
  "RECOMMENDATION": "Eventos",
  "TRADE_SHOW": "Indbound(Linkedin)",
  "WEBFORM": "Formulário",
  "CALLBACK": "Indicação",
  "RC_GENERATOR": "Indique e Ganhe",
  "STORE": "Wpp Marketing",
  "OTHER": "Lista - Wpp Marketing",
  "REPEAT_SALE": "Vendas Recorrentes",
  "UC_YWZVA2": "Prospecção Ativa",
  "UC_PTYW1Y": "Recomendação",
  "UC_4VCKGM": "Social Selling",
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

function GlowingBorder({ color = "cyan" }: { color?: string }) {
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
          className="absolute w-1 h-1 bg-cyan-500/30 rounded-full"
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

export default function DetailSDRs() {
  const { setPageInfo } = usePageInfo();
  const now = new Date();
  
  const [sdrId, setSdrId] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfYear(now),
    to: endOfMonth(now),
  });

  const { data: sdrs, isLoading: isLoadingSDRs } = useQuery<SDR[]>({
    queryKey: ["/api/sdrs/list"],
  });

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (sdrId) params.append("sdrId", sdrId);
    if (dateRange?.from) params.append("dataInicio", format(dateRange.from, 'yyyy-MM-dd'));
    if (dateRange?.to) params.append("dataFim", format(dateRange.to, 'yyyy-MM-dd'));
    return params.toString();
  };

  const queryParams = buildQueryParams();

  const { data: metrics, isLoading: isLoadingMetrics } = useQuery<SDRDetailMetrics>({
    queryKey: ["/api/sdrs/detail", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/sdrs/detail?${queryParams}`);
      return res.json();
    },
    enabled: !!sdrId,
    refetchInterval: 60000,
  });

  const { data: monthlyData, isLoading: isLoadingMonthly } = useQuery<MonthlyData[]>({
    queryKey: ["/api/sdrs/detail/monthly", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/sdrs/detail/monthly?${queryParams}`);
      return res.json();
    },
    enabled: !!sdrId,
    refetchInterval: 60000,
  });

  const { data: stageData, isLoading: isLoadingStage } = useQuery<StageDistribution[]>({
    queryKey: ["/api/sdrs/detail/stages", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/sdrs/detail/stages?${queryParams}`);
      return res.json();
    },
    enabled: !!sdrId,
    refetchInterval: 60000,
  });

  const { data: sourceData, isLoading: isLoadingSource } = useQuery<SourceDistribution[]>({
    queryKey: ["/api/sdrs/detail/sources", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/sdrs/detail/sources?${queryParams}`);
      return res.json();
    },
    enabled: !!sdrId,
    refetchInterval: 60000,
  });

  const { data: pipelineData, isLoading: isLoadingPipeline } = useQuery<PipelineDistribution[]>({
    queryKey: ["/api/sdrs/detail/pipelines", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/sdrs/detail/pipelines?${queryParams}`);
      return res.json();
    },
    enabled: !!sdrId,
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (metrics?.sdrName) {
      setPageInfo(metrics.sdrName, "Análise detalhada de performance individual");
    } else {
      setPageInfo("Detalhamento de SDRs", "Selecione um SDR para ver detalhes");
    }
  }, [metrics?.sdrName, setPageInfo]);

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
    return `R$ ${value.toFixed(0)}`;
  };

  const limparFiltros = () => {
    setDateRange({
      from: startOfYear(now),
      to: endOfMonth(now),
    });
  };

  const COLORS = ['#06b6d4', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6'];

  const stageChartData = stageData?.map((item, index) => ({
    name: item.stage,
    value: item.count,
    percentage: item.percentage,
    fill: COLORS[index % COLORS.length],
  })) || [];

  const sourceChartData = sourceData?.map((item, index) => ({
    name: getSourceDisplayName(item.source),
    leads: item.leads,
    reunioes: item.reunioes,
    vendas: item.vendas,
    percentage: item.percentage,
    fill: COLORS[index % COLORS.length],
  })) || [];

  const pipelineChartData = pipelineData?.map((item, index) => ({
    name: item.pipeline,
    leads: item.leads,
    reunioes: item.reunioes,
    vendas: item.vendas,
    valor: item.valorRecorrente,
    percentage: item.percentage,
    fill: COLORS[index % COLORS.length],
  })) || [];

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden" data-testid="page-detail-sdrs">
      <FloatingParticles />

      <div className="relative z-10 p-6 lg:p-8">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500">
              <Users className="h-6 w-6 text-foreground" />
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <Card className="bg-muted/50 border-border backdrop-blur-xl" data-testid="card-filters">
            <CardContent className="p-6">
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[200px]" data-testid="filter-sdr">
                  <Label className="text-muted-foreground mb-2 block">
                    <User className="h-4 w-4 inline mr-2" />
                    SDR
                  </Label>
                  <Select value={sdrId} onValueChange={setSdrId}>
                    <SelectTrigger className="bg-muted border-border text-foreground" data-testid="select-sdr">
                      <SelectValue placeholder="Selecione um SDR" />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingSDRs ? (
                        <SelectItem value="loading" disabled>Carregando...</SelectItem>
                      ) : (
                        sdrs?.map((sdr) => (
                          <SelectItem key={sdr.id} value={sdr.id.toString()} data-testid={`option-sdr-${sdr.id}`}>
                            {sdr.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-[280px]" data-testid="filter-date-range">
                  <Label className="text-muted-foreground mb-2 block">
                    <CalendarDays className="h-4 w-4 inline mr-2" />
                    Período
                  </Label>
                  <DateRangePicker
                    value={dateRange}
                    onChange={setDateRange}
                    triggerClassName="bg-muted border-border text-foreground hover:bg-muted"
                    placeholder="Selecione o período"
                  />
                </div>

                <Button
                  variant="outline"
                  onClick={limparFiltros}
                  className="border-border text-muted-foreground hover:bg-muted"
                  data-testid="button-limpar-filtros"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Limpar
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {!sdrId ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="p-6 rounded-full bg-muted/50 mb-6">
              <Users className="h-16 w-16 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-semibold text-muted-foreground mb-2" data-testid="text-select-sdr">Selecione um SDR</h2>
            <p className="text-muted-foreground">Escolha um SDR acima para visualizar suas métricas detalhadas</p>
          </motion.div>
        ) : isLoadingMetrics ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-40 bg-muted" />
              ))}
            </div>
          </div>
        ) : metrics ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={sdrId}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center text-2xl font-bold shadow-lg shadow-cyan-500/30">
                    {metrics.sdrName?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center">
                    <Zap className="h-3 w-3 text-foreground" />
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground" data-testid="text-sdr-name">{metrics.sdrName}</h2>
                  {metrics.sdrEmail && (
                    <p className="text-muted-foreground" data-testid="text-sdr-email">{metrics.sdrEmail}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <Card className="relative overflow-hidden bg-muted/50 border-border backdrop-blur-xl" data-testid="card-leads">
                    <GlowingBorder color="cyan" />
                    <CardContent className="relative z-10 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-3 rounded-xl bg-cyan-500/20">
                          <FileText className="h-6 w-6 text-cyan-400" />
                        </div>
                        <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-400 border-0">
                          Leads
                        </Badge>
                      </div>
                      <div className="text-4xl font-bold text-foreground mb-1" data-testid="value-leads">
                        <AnimatedCounter value={metrics.leadsTotais} />
                      </div>
                      <p className="text-muted-foreground text-sm">Leads gerados</p>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Card className="relative overflow-hidden bg-muted/50 border-border backdrop-blur-xl" data-testid="card-reunioes">
                    <GlowingBorder color="green" />
                    <CardContent className="relative z-10 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-3 rounded-xl bg-emerald-500/20">
                          <Calendar className="h-6 w-6 text-emerald-400" />
                        </div>
                        <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400 border-0">
                          Reuniões
                        </Badge>
                      </div>
                      <div className="text-4xl font-bold text-foreground mb-1" data-testid="value-reunioes">
                        <AnimatedCounter value={metrics.reunioesRealizadas} />
                      </div>
                      <p className="text-muted-foreground text-sm">Reuniões realizadas</p>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Card className="relative overflow-hidden bg-muted/50 border-border backdrop-blur-xl" data-testid="card-taxa-conversao">
                    <GlowingBorder color="violet" />
                    <CardContent className="relative z-10 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-3 rounded-xl bg-violet-500/20">
                          <Percent className="h-6 w-6 text-violet-400" />
                        </div>
                        <Badge variant="secondary" className="bg-violet-500/20 text-violet-400 border-0">
                          Taxa
                        </Badge>
                      </div>
                      <div className="text-4xl font-bold text-foreground mb-1" data-testid="value-taxa-lead-reuniao">
                        <AnimatedCounter value={Math.round(metrics.taxaLeadReuniao)} suffix="%" />
                      </div>
                      <p className="text-muted-foreground text-sm">Lead → Reunião</p>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <Card className="relative overflow-hidden bg-muted/50 border-border backdrop-blur-xl" data-testid="card-vendas">
                    <GlowingBorder color="amber" />
                    <CardContent className="relative z-10 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-3 rounded-xl bg-amber-500/20">
                          <Handshake className="h-6 w-6 text-amber-400" />
                        </div>
                        <Badge variant="secondary" className="bg-amber-500/20 text-amber-400 border-0">
                          Vendas
                        </Badge>
                      </div>
                      <div className="text-4xl font-bold text-foreground mb-1" data-testid="value-vendas">
                        <AnimatedCounter value={metrics.negociosGanhos} />
                      </div>
                      <p className="text-muted-foreground text-sm">Negócios fechados</p>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <Card className="bg-muted/50 border-border" data-testid="card-taxa-reuniao-venda">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg bg-teal-500/20">
                        <TrendingUp className="h-5 w-5 text-teal-400" />
                      </div>
                      <span className="text-muted-foreground">Taxa Reunião → Venda</span>
                    </div>
                    <div className="text-3xl font-bold text-foreground" data-testid="value-taxa-reuniao-venda">
                      {metrics.taxaReuniaoVenda.toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-muted/50 border-border" data-testid="card-taxa-lead-venda">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg bg-rose-500/20">
                        <Target className="h-5 w-5 text-rose-400" />
                      </div>
                      <span className="text-muted-foreground">Taxa Lead → Venda</span>
                    </div>
                    <div className="text-3xl font-bold text-foreground" data-testid="value-taxa-lead-venda">
                      {metrics.taxaLeadVenda.toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-muted/50 border-border" data-testid="card-mrr-gerado">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg bg-green-500/20">
                        <DollarSign className="h-5 w-5 text-green-400" />
                      </div>
                      <span className="text-muted-foreground">MRR Gerado</span>
                    </div>
                    <div className="text-3xl font-bold text-foreground" data-testid="value-mrr-gerado">
                      {formatCurrencyCompact(metrics.valorRecorrente)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
                <Card className="bg-muted/50 border-border" data-testid="card-negocios-em-andamento">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-blue-500/20">
                      <Activity className="h-6 w-6 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">Em Andamento</p>
                      <p className="text-2xl font-bold text-foreground" data-testid="value-em-andamento">{metrics.negociosEmAndamento}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-muted/50 border-border" data-testid="card-negocios-perdidos">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-red-500/20">
                      <XCircle className="h-6 w-6 text-red-400" />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">Perdidos</p>
                      <p className="text-2xl font-bold text-foreground" data-testid="value-perdidos">{metrics.negociosPerdidos}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-muted/50 border-border" data-testid="card-ticket-medio">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-amber-500/20">
                      <Briefcase className="h-6 w-6 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">Ticket Médio</p>
                      <p className="text-2xl font-bold text-foreground" data-testid="value-ticket-medio">{formatCurrency(metrics.ticketMedio)}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="evolucao" className="mb-8">
                <TabsList className="bg-muted border-border">
                  <TabsTrigger value="evolucao" className="data-[state=active]:bg-cyan-600" data-testid="tab-evolucao">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Evolução
                  </TabsTrigger>
                  <TabsTrigger value="fontes" className="data-[state=active]:bg-cyan-600" data-testid="tab-fontes">
                    <Target className="h-4 w-4 mr-2" />
                    Fontes
                  </TabsTrigger>
                  <TabsTrigger value="pipelines" className="data-[state=active]:bg-cyan-600" data-testid="tab-pipelines">
                    <Briefcase className="h-4 w-4 mr-2" />
                    Pipelines
                  </TabsTrigger>
                  <TabsTrigger value="funil" className="data-[state=active]:bg-cyan-600" data-testid="tab-funil">
                    <Activity className="h-4 w-4 mr-2" />
                    Funil
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="evolucao" className="mt-6">
                  <Card className="bg-muted/50 border-border" data-testid="card-chart-evolucao">
                    <CardHeader>
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-cyan-400" />
                        Evolução Mensal
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoadingMonthly ? (
                        <Skeleton className="h-80 bg-muted" />
                      ) : monthlyData && monthlyData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={350}>
                          <AreaChart data={monthlyData}>
                            <defs>
                              <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="colorReunioes" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis 
                              dataKey="mesLabel" 
                              stroke="#94a3b8"
                              tick={{ fill: '#94a3b8' }}
                            />
                            <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8' }} />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#1e293b', 
                                border: '1px solid #334155',
                                borderRadius: '8px',
                                color: '#fff'
                              }}
                            />
                            <Legend />
                            <Area 
                              type="monotone" 
                              dataKey="leads" 
                              name="Leads"
                              stroke="#06b6d4" 
                              fillOpacity={1}
                              fill="url(#colorLeads)"
                              strokeWidth={2}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="reunioes" 
                              name="Reuniões"
                              stroke="#10b981" 
                              fillOpacity={1}
                              fill="url(#colorReunioes)"
                              strokeWidth={2}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="vendas" 
                              name="Vendas"
                              stroke="#f59e0b" 
                              fillOpacity={1}
                              fill="url(#colorVendas)"
                              strokeWidth={2}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-80 flex items-center justify-center text-muted-foreground">
                          Sem dados para exibir
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="fontes" className="mt-6">
                  <Card className="bg-muted/50 border-border" data-testid="card-chart-fontes">
                    <CardHeader>
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <Target className="h-5 w-5 text-cyan-400" />
                        Distribuição por Fonte
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoadingSource ? (
                        <Skeleton className="h-80 bg-muted" />
                      ) : sourceData && sourceData.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                              <Pie
                                data={sourceChartData}
                                dataKey="leads"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                label={({ name, percentage }) => `${percentage?.toFixed(0)}%`}
                              >
                                {sourceChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                              </Pie>
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: '#1e293b', 
                                  border: '1px solid #334155',
                                  borderRadius: '8px',
                                  color: '#fff'
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="space-y-3">
                            {sourceChartData.slice(0, 8).map((item, index) => (
                              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                <div className="flex items-center gap-3">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }} />
                                  <span className="text-muted-foreground text-sm">{item.name}</span>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                  <span className="text-cyan-400">{item.leads} leads</span>
                                  <span className="text-emerald-400">{item.reunioes} reuniões</span>
                                  <span className="text-amber-400">{item.vendas} vendas</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="h-80 flex items-center justify-center text-muted-foreground">
                          Sem dados para exibir
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="pipelines" className="mt-6">
                  <Card className="bg-muted/50 border-border" data-testid="card-chart-pipelines">
                    <CardHeader>
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <Briefcase className="h-5 w-5 text-cyan-400" />
                        Distribuição por Pipeline
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoadingPipeline ? (
                        <Skeleton className="h-80 bg-muted" />
                      ) : pipelineData && pipelineData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={350}>
                          <BarChart data={pipelineChartData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis type="number" stroke="#94a3b8" tick={{ fill: '#94a3b8' }} />
                            <YAxis 
                              type="category" 
                              dataKey="name" 
                              stroke="#94a3b8" 
                              tick={{ fill: '#94a3b8' }}
                              width={150}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#1e293b', 
                                border: '1px solid #334155',
                                borderRadius: '8px',
                                color: '#fff'
                              }}
                              formatter={(value: number, name: string) => {
                                if (name === 'valor') return [formatCurrency(value), 'MRR'];
                                return [value, name === 'leads' ? 'Leads' : name === 'reunioes' ? 'Reuniões' : 'Vendas'];
                              }}
                            />
                            <Legend />
                            <Bar dataKey="leads" name="Leads" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                            <Bar dataKey="reunioes" name="Reuniões" fill="#10b981" radius={[0, 4, 4, 0]} />
                            <Bar dataKey="vendas" name="Vendas" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-80 flex items-center justify-center text-muted-foreground">
                          Sem dados para exibir
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="funil" className="mt-6">
                  <Card className="bg-muted/50 border-border" data-testid="card-chart-funil">
                    <CardHeader>
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <Activity className="h-5 w-5 text-cyan-400" />
                        Distribuição por Estágio
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoadingStage ? (
                        <Skeleton className="h-80 bg-muted" />
                      ) : stageData && stageData.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                              <Pie
                                data={stageChartData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                label={({ percentage }) => `${percentage?.toFixed(0)}%`}
                              >
                                {stageChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                              </Pie>
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: '#1e293b', 
                                  border: '1px solid #334155',
                                  borderRadius: '8px',
                                  color: '#fff'
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="space-y-3">
                            {stageChartData.map((item, index) => (
                              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                <div className="flex items-center gap-3">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }} />
                                  <span className="text-muted-foreground">{item.name}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="text-foreground font-semibold">{item.value}</span>
                                  <span className="text-muted-foreground text-sm">({item.percentage?.toFixed(1)}%)</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="h-80 flex items-center justify-center text-muted-foreground">
                          Sem dados para exibir
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </motion.div>
          </AnimatePresence>
        ) : null}
      </div>
    </div>
  );
}
