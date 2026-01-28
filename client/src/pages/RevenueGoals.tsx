import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  CalendarDays,
  Zap,
  X,
  Building2,
  User,
  FileText,
  Briefcase,
  MessageCircle
} from "lucide-react";
import { 
  ComposedChart, 
  Bar, 
  Line,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ReferenceLine
} from "recharts";

interface RevenueGoalsData {
  resumo: {
    totalPrevisto: number;
    totalRecebido: number;
    totalPendente: number;
    totalInadimplente: number;
    percentualRecebido: number;
    percentualInadimplencia: number;
    quantidadeParcelas: number;
    quantidadeRecebidas: number;
    quantidadePendentes: number;
    quantidadeInadimplentes: number;
  };
  porDia: {
    dia: number;
    dataCompleta: string;
    previsto: number;
    recebido: number;
    pendente: number;
    inadimplente: number;
  }[];
}

interface DiaDetalhesData {
  data: string;
  resumo: {
    totalPrevisto: number;
    totalRecebido: number;
    totalPendente: number;
    totalInadimplente: number;
    quantidadeParcelas: number;
  };
  parcelas: {
    id: number;
    descricao: string;
    valorBruto: number;
    valorPago: number;
    naoPago: number;
    dataVencimento: string;
    status: 'pago' | 'pendente' | 'inadimplente';
    empresa: string;
    idCliente: string;
    nomeCliente: string;
    cnpj: string | null;
    responsavel: string | null;
    squad: string | null;
    servico: string | null;
    statusClickup: string | null;
    telefone: string | null;
  }[];
}

const mesesNomes = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const mesesAbreviados = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'default' | 'success' | 'warning' | 'danger';
  progress?: number;
}

function KPICard({ title, value, subtitle, icon, trend, trendValue, color = 'default', progress }: KPICardProps) {
  const colorConfig = {
    default: {
      bg: 'bg-primary/10',
      text: 'text-primary',
      border: 'border-primary/20',
      gradient: 'from-primary/5 to-primary/10'
    },
    success: {
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
      text: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-200 dark:border-emerald-800',
      gradient: 'from-emerald-500/5 to-emerald-500/10'
    },
    warning: {
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-200 dark:border-amber-800',
      gradient: 'from-amber-500/5 to-amber-500/10'
    },
    danger: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-600 dark:text-red-400',
      border: 'border-red-200 dark:border-red-800',
      gradient: 'from-red-500/5 to-red-500/10'
    },
  };

  const config = colorConfig[color];

  return (
    <Card className={`relative overflow-hidden border ${config.border}`} data-testid={`card-kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-50`} />
      <CardContent className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold mt-1.5 tracking-tight">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>
            )}
            {trend && trendValue && (
              <div className="flex items-center gap-1.5 mt-2">
                {trend === 'up' ? (
                  <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                ) : trend === 'down' ? (
                  <ArrowDownRight className="w-4 h-4 text-red-500" />
                ) : null}
                <span className={`text-xs font-medium ${trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground'}`}>
                  {trendValue}
                </span>
              </div>
            )}
            {progress !== undefined && (
              <div className="mt-3">
                <Progress value={progress} className="h-1.5" />
              </div>
            )}
          </div>
          <div className={`p-2.5 rounded-xl shrink-0 ${config.bg}`}>
            <div className={config.text}>{icon}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload;
    const totalDia = (data?.recebido || 0) + (data?.pendente || 0) + (data?.inadimplente || 0);
    
    return (
      <div className="bg-background/95 backdrop-blur-sm border rounded-xl shadow-xl p-4 min-w-[220px]">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <p className="font-semibold">Dia {label}</p>
        </div>
        
        <div className="space-y-2.5">
          {payload.map((entry: any, index: number) => {
            if (entry.dataKey === 'metaAcumulada' || entry.dataKey === 'recebidoAcumulado') return null;
            const percentage = totalDia > 0 ? ((entry.value / totalDia) * 100).toFixed(1) : '0';
            return (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm text-muted-foreground">{entry.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold">{formatCurrency(entry.value)}</span>
                  <span className="text-xs text-muted-foreground ml-1">({percentage}%)</span>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-3 pt-2 border-t">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Total do dia</span>
            <span className="text-sm font-bold">{formatCurrency(totalDia)}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

function CustomLegend({ payload }: any) {
  const visibleItems = payload?.filter((item: any) => 
    !['metaAcumulada', 'recebidoAcumulado'].includes(item.dataKey)
  ) || [];
  
  return (
    <div className="flex flex-wrap justify-center gap-4 mt-4">
      {visibleItems.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm text-muted-foreground">{entry.value}</span>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <div className="w-6 h-0.5 bg-blue-500" />
        <span className="text-sm text-muted-foreground">Meta Acumulada</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-6 h-0.5 bg-emerald-500" style={{ borderStyle: 'dashed' }} />
        <span className="text-sm text-muted-foreground">Recebido Acumulado</span>
      </div>
    </div>
  );
}

export default function RevenueGoals() {
  usePageTitle("Metas de Receita");
  useSetPageInfo("Revenue Goals", "Acompanhamento de recebimentos do mês");
  
  const hoje = new Date();
  const [selectedMonth, setSelectedMonth] = useState({ month: hoje.getMonth() + 1, year: hoje.getFullYear() });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { data, isLoading } = useQuery<RevenueGoalsData>({
    queryKey: ['/api/financeiro/revenue-goals', selectedMonth.month, selectedMonth.year],
    queryFn: async () => {
      const response = await fetch(`/api/financeiro/revenue-goals?mes=${selectedMonth.month}&ano=${selectedMonth.year}`);
      if (!response.ok) throw new Error('Failed to fetch revenue goals');
      return response.json();
    },
  });

  const { data: diaDetalhes, isLoading: isLoadingDetalhes } = useQuery<DiaDetalhesData>({
    queryKey: ['/api/financeiro/revenue-goals/detalhes-dia', selectedDay],
    queryFn: async () => {
      const response = await fetch(`/api/financeiro/revenue-goals/detalhes-dia?data=${selectedDay}`);
      if (!response.ok) throw new Error('Failed to fetch day details');
      return response.json();
    },
    enabled: !!selectedDay,
  });

  const handleBarClick = (data: any) => {
    if (data?.activePayload?.[0]?.payload) {
      const dia = data.activePayload[0].payload.dia;
      const dataCompleta = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      setSelectedDay(dataCompleta);
    }
  };

  const parcelasPagas = diaDetalhes?.parcelas.filter(p => p.status === 'pago') || [];
  const parcelasPendentes = diaDetalhes?.parcelas.filter(p => p.status === 'pendente') || [];
  const parcelasInadimplentes = diaDetalhes?.parcelas.filter(p => p.status === 'inadimplente') || [];

  const chartData = useMemo(() => {
    if (!data?.porDia) return [];
    
    let metaAcumulada = 0;
    let recebidoAcumulado = 0;
    
    return data.porDia.map(d => {
      metaAcumulada += d.previsto;
      recebidoAcumulado += d.recebido;
      
      return {
        dia: d.dia,
        recebido: d.recebido,
        pendente: d.pendente,
        inadimplente: d.inadimplente,
        metaAcumulada,
        recebidoAcumulado,
      };
    });
  }, [data]);

  const diasRestantes = useMemo(() => {
    const ultimoDia = new Date(selectedMonth.year, selectedMonth.month, 0).getDate();
    const diaAtual = selectedMonth.month === hoje.getMonth() + 1 && selectedMonth.year === hoje.getFullYear() 
      ? hoje.getDate() 
      : ultimoDia;
    return ultimoDia - diaAtual;
  }, [selectedMonth, hoje]);

  const mediaDiariaRecebida = useMemo(() => {
    if (!data || data.resumo.quantidadeRecebidas === 0) return 0;
    const diasComRecebimento = data.porDia.filter(d => d.recebido > 0).length;
    return diasComRecebimento > 0 ? data.resumo.totalRecebido / diasComRecebimento : 0;
  }, [data]);

  const projecaoFinal = useMemo(() => {
    if (!data) return 0;
    return data.resumo.totalRecebido + (mediaDiariaRecebida * diasRestantes);
  }, [data, mediaDiariaRecebida, diasRestantes]);

  const atingimentoMeta = useMemo(() => {
    if (!data || data.resumo.totalPrevisto === 0) return 0;
    return (data.resumo.totalRecebido / data.resumo.totalPrevisto) * 100;
  }, [data]);
  
  return (
    <div className="p-6 space-y-6" data-testid="page-revenue-goals">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {mesesNomes[selectedMonth.month - 1]} {selectedMonth.year}
          </h2>
          <p className="text-muted-foreground mt-1">
            Acompanhamento de metas e recebimentos
          </p>
        </div>
        <MonthYearPicker
          value={selectedMonth}
          onChange={setSelectedMonth}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-[140px]" />
          ))}
        </div>
      ) : data ? (
        <>
          {/* KPIs Principais */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KPICard
              title="Total a Receber"
              value={formatCurrency(data.resumo.totalPrevisto)}
              subtitle={`${data.resumo.quantidadeParcelas} parcelas no mês`}
              icon={<Target className="w-5 h-5" />}
              color="default"
            />
            <KPICard
              title="Recebido"
              value={formatCurrency(data.resumo.totalRecebido)}
              subtitle={`${data.resumo.quantidadeRecebidas} parcelas`}
              icon={<CheckCircle className="w-5 h-5" />}
              trend={atingimentoMeta >= 80 ? 'up' : atingimentoMeta >= 50 ? 'neutral' : 'down'}
              trendValue={`${atingimentoMeta.toFixed(1)}% da meta`}
              color="success"
              progress={Math.min(atingimentoMeta, 100)}
            />
            <KPICard
              title="Pendente"
              value={formatCurrency(data.resumo.totalPendente)}
              subtitle={`${data.resumo.quantidadePendentes} parcelas`}
              icon={<Clock className="w-5 h-5" />}
              color="warning"
            />
            <KPICard
              title="Inadimplente"
              value={formatCurrency(data.resumo.totalInadimplente)}
              subtitle={`${data.resumo.quantidadeInadimplentes} parcelas`}
              icon={<AlertTriangle className="w-5 h-5" />}
              trend={data.resumo.percentualInadimplencia > 10 ? 'down' : 'up'}
              trendValue={formatPercent(data.resumo.percentualInadimplencia)}
              color="danger"
            />
            <KPICard
              title="Projeção Final"
              value={formatCurrency(projecaoFinal)}
              subtitle={`${diasRestantes} dias restantes`}
              icon={<Zap className="w-5 h-5" />}
              trend={projecaoFinal >= data.resumo.totalPrevisto ? 'up' : 'down'}
              trendValue={projecaoFinal >= data.resumo.totalPrevisto ? 'Acima da meta' : 'Abaixo da meta'}
              color={projecaoFinal >= data.resumo.totalPrevisto ? 'success' : 'warning'}
            />
            <KPICard
              title="Média Diária"
              value={formatCurrency(mediaDiariaRecebida)}
              subtitle="Por dia com recebimento"
              icon={<BarChart3 className="w-5 h-5" />}
              color="default"
            />
          </div>

          {/* Gráfico Principal */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Evolução de Recebimentos
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Análise diária com comparativo de meta acumulada
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800">
                    <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                    {formatCurrency(data.resumo.totalRecebido)}
                  </Badge>
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800">
                    <Clock className="w-3.5 h-3.5 mr-1.5" />
                    {formatCurrency(data.resumo.totalPendente)}
                  </Badge>
                  <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200 dark:border-red-800">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                    {formatCurrency(data.resumo.totalInadimplente)}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[420px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }} onClick={handleBarClick} style={{ cursor: 'pointer' }}>
                    <defs>
                      <linearGradient id="recebidoGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.9}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.6}/>
                      </linearGradient>
                      <linearGradient id="pendenteGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.9}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.6}/>
                      </linearGradient>
                      <linearGradient id="inadimplenteGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.9}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.6}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis 
                      dataKey="dia" 
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <YAxis 
                      yAxisId="bars"
                      tickFormatter={(value) => {
                        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                        if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                        return value.toString();
                      }}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      yAxisId="lines"
                      orientation="right"
                      tickFormatter={(value) => {
                        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                        if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                        return value.toString();
                      }}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
                    <Legend content={<CustomLegend />} />
                    
                    <Bar 
                      yAxisId="bars"
                      dataKey="recebido" 
                      name="Recebido" 
                      stackId="a" 
                      fill="url(#recebidoGradient)"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar 
                      yAxisId="bars"
                      dataKey="pendente" 
                      name="Pendente" 
                      stackId="a" 
                      fill="url(#pendenteGradient)"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar 
                      yAxisId="bars"
                      dataKey="inadimplente" 
                      name="Inadimplente" 
                      stackId="a" 
                      fill="url(#inadimplenteGradient)"
                      radius={[4, 4, 0, 0]}
                    />
                    
                    <Line 
                      yAxisId="lines"
                      type="monotone" 
                      dataKey="metaAcumulada" 
                      name="Meta Acumulada"
                      stroke="#3b82f6" 
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 6, strokeWidth: 2, fill: '#3b82f6' }}
                    />
                    <Line 
                      yAxisId="lines"
                      type="monotone" 
                      dataKey="recebidoAcumulado" 
                      name="Recebido Acumulado"
                      stroke="#10b981" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 2, fill: '#10b981' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Cards de Métricas Detalhadas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-emerald-200 dark:border-emerald-900 overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                    <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground font-medium">Ticket Médio Recebido</p>
                    <p className="text-2xl font-bold mt-0.5">
                      {data.resumo.quantidadeRecebidas > 0 
                        ? formatCurrency(data.resumo.totalRecebido / data.resumo.quantidadeRecebidas)
                        : 'R$ 0'
                      }
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Base: {data.resumo.quantidadeRecebidas} parcelas
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-amber-200 dark:border-amber-900 overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                    <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground font-medium">Ticket Médio Pendente</p>
                    <p className="text-2xl font-bold mt-0.5">
                      {data.resumo.quantidadePendentes > 0 
                        ? formatCurrency(data.resumo.totalPendente / data.resumo.quantidadePendentes)
                        : 'R$ 0'
                      }
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Base: {data.resumo.quantidadePendentes} parcelas
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-red-200 dark:border-red-900 overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
                    <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground font-medium">Ticket Médio Inadimplente</p>
                    <p className="text-2xl font-bold mt-0.5">
                      {data.resumo.quantidadeInadimplentes > 0 
                        ? formatCurrency(data.resumo.totalInadimplente / data.resumo.quantidadeInadimplentes)
                        : 'R$ 0'
                      }
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Base: {data.resumo.quantidadeInadimplentes} parcelas
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Resumo de Atingimento */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                <div className="flex-1">
                  <h3 className="font-semibold mb-2">Atingimento da Meta</h3>
                  <div className="flex items-end gap-3">
                    <span className="text-4xl font-bold">{atingimentoMeta.toFixed(1)}%</span>
                    <span className="text-muted-foreground pb-1">do objetivo mensal</span>
                  </div>
                  <Progress value={Math.min(atingimentoMeta, 100)} className="h-3 mt-4" />
                </div>
                <div className="lg:w-px lg:h-20 lg:bg-border" />
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Falta Receber</p>
                    <p className="text-xl font-bold text-amber-600">
                      {formatCurrency(data.resumo.totalPendente + data.resumo.totalInadimplente)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Gap para Meta</p>
                    <p className={`text-xl font-bold ${data.resumo.totalRecebido >= data.resumo.totalPrevisto ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(Math.abs(data.resumo.totalPrevisto - data.resumo.totalRecebido))}
                      {data.resumo.totalRecebido >= data.resumo.totalPrevisto && (
                        <span className="text-sm font-normal text-emerald-600 ml-2">acima</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="p-12">
          <div className="text-center text-muted-foreground">
            Nenhum dado disponível para o período selecionado.
          </div>
        </Card>
      )}

      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              Detalhes do Dia {selectedDay ? new Date(selectedDay + 'T12:00:00').toLocaleDateString('pt-BR') : ''}
            </DialogTitle>
            <DialogDescription>
              Parcelas com vencimento nesta data
            </DialogDescription>
          </DialogHeader>

          {isLoadingDetalhes ? (
            <div className="space-y-4 p-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : diaDetalhes ? (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Previsto</p>
                  <p className="text-lg font-bold">{formatCurrency(diaDetalhes.resumo.totalPrevisto)}</p>
                </div>
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Recebido</p>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(diaDetalhes.resumo.totalRecebido)}</p>
                </div>
                <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <p className="text-xs text-amber-600 dark:text-amber-400">Pendente</p>
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{formatCurrency(diaDetalhes.resumo.totalPendente)}</p>
                </div>
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <p className="text-xs text-red-600 dark:text-red-400">Inadimplente</p>
                  <p className="text-lg font-bold text-red-600 dark:text-red-400">{formatCurrency(diaDetalhes.resumo.totalInadimplente)}</p>
                </div>
              </div>

              <Tabs defaultValue="todas" className="flex-1 overflow-hidden flex flex-col">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="todas" data-testid="tab-todas">
                    Todas ({diaDetalhes.parcelas.length})
                  </TabsTrigger>
                  <TabsTrigger value="pagas" data-testid="tab-pagas" className="text-emerald-600">
                    Pagas ({parcelasPagas.length})
                  </TabsTrigger>
                  <TabsTrigger value="pendentes" data-testid="tab-pendentes" className="text-amber-600">
                    Pendentes ({parcelasPendentes.length})
                  </TabsTrigger>
                  <TabsTrigger value="inadimplentes" data-testid="tab-inadimplentes" className="text-red-600">
                    Inadimplentes ({parcelasInadimplentes.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="todas" className="flex-1 overflow-hidden mt-4">
                  <ParcelasList parcelas={diaDetalhes.parcelas} />
                </TabsContent>
                <TabsContent value="pagas" className="flex-1 overflow-hidden mt-4">
                  <ParcelasList parcelas={parcelasPagas} />
                </TabsContent>
                <TabsContent value="pendentes" className="flex-1 overflow-hidden mt-4">
                  <ParcelasList parcelas={parcelasPendentes} />
                </TabsContent>
                <TabsContent value="inadimplentes" className="flex-1 overflow-hidden mt-4">
                  <ParcelasList parcelas={parcelasInadimplentes} />
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              Nenhum dado disponível
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ParcelasList({ parcelas }: { parcelas: DiaDetalhesData['parcelas'] }) {
  if (parcelas.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        Nenhuma parcela encontrada
      </div>
    );
  }

  const statusColors = {
    pago: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    pendente: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    inadimplente: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  const statusLabels = {
    pago: 'Pago',
    pendente: 'Pendente',
    inadimplente: 'Inadimplente',
  };

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3 pr-4">
        {parcelas.map((parcela) => (
          <Card key={parcela.id} className="p-4" data-testid={`card-parcela-${parcela.id}`}>
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold truncate">{parcela.nomeCliente}</h4>
                    <Badge variant="outline" className={statusColors[parcela.status]}>
                      {statusLabels[parcela.status]}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{parcela.descricao}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-lg">{formatCurrency(parcela.valorBruto)}</p>
                  {parcela.status === 'pago' && parcela.valorPago > 0 && (
                    <p className="text-xs text-emerald-600">Pago: {formatCurrency(parcela.valorPago)}</p>
                  )}
                  {parcela.naoPago > 0 && parcela.status !== 'pago' && (
                    <p className="text-xs text-red-600">Falta: {formatCurrency(parcela.naoPago)}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                {parcela.cnpj && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Building2 className="w-3.5 h-3.5" />
                    <span className="truncate">{parcela.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.***.***/****-$5')}</span>
                  </div>
                )}
                {parcela.responsavel && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <User className="w-3.5 h-3.5" />
                    <span className="truncate">{parcela.responsavel}</span>
                  </div>
                )}
                {parcela.squad && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Briefcase className="w-3.5 h-3.5" />
                    <span className="truncate">{parcela.squad}</span>
                  </div>
                )}
                {parcela.servico && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <FileText className="w-3.5 h-3.5" />
                    <span className="truncate">{parcela.servico}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                {parcela.statusClickup && (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-xs">
                      {parcela.statusClickup}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{parcela.empresa}</span>
                  </div>
                )}
                {parcela.status === 'inadimplente' && parcela.telefone && (
                  <a
                    href={`https://wa.me/55${parcela.telefone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-md transition-colors"
                    data-testid={`btn-whatsapp-${parcela.id}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    WhatsApp
                  </a>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
