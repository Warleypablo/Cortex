import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { formatCurrency, formatCurrencyCompact, formatPercent } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Monitor, 
  Rocket, 
  Clock, 
  DollarSign, 
  Users, 
  CheckCircle2, 
  Target,
  AlertCircle,
  Calendar,
  TrendingUp,
  Zap,
  Timer,
  AlertTriangle,
  ArrowRight
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  RadialBarChart,
  RadialBar,
} from "recharts";

interface TechMetricas {
  projetosEmAndamento: number;
  projetosFechados: number;
  totalTasks: number;
  valorTotalProjetos: number;
  valorMedioProjeto: number;
  tempoMedioEntrega: number;
}

interface TechProjetoStatus {
  status: string;
  quantidade: number;
  percentual: number;
}

interface TechProjetoResponsavel {
  responsavel: string | null;
  projetosAtivos: number;
  projetosFechados: number;
  valorTotal: number;
}

interface TechProjetoTipo {
  tipo: string;
  quantidade: number;
  valorTotal: number;
}

interface TechProjetoDetalhe {
  clickupTaskId: string;
  taskName: string;
  statusProjeto: string;
  responsavel: string | null;
  faseProjeto: string | null;
  tipo: string | null;
  tipoProjeto: string | null;
  valorP: number | null;
  dataVencimento: string | null;
  lancamento: string | null;
  dataCriada: string | null;
}

interface TechVelocidade {
  projetosEntreguesMes: number;
  tempoMedioEntrega: number;
  taxaCumprimentoPrazo: number;
}

const STATUS_COLORS: Record<string, string> = {
  'deploy': '#22c55e',
  'completo': '#22c55e',
  'finalizado': '#22c55e',
  'review': '#a855f7',
  'qa': '#a855f7',
  'teste': '#a855f7',
  'andamento': '#3b82f6',
  'progresso': '#3b82f6',
  'dev': '#3b82f6',
  'design': '#ec4899',
  'kickoff': '#eab308',
  'planejamento': '#eab308',
  'default': '#94a3b8'
};

const getStatusColor = (status: string): string => {
  const statusLower = status.toLowerCase();
  for (const [key, color] of Object.entries(STATUS_COLORS)) {
    if (statusLower.includes(key)) return color;
  }
  return STATUS_COLORS.default;
};

const TIPO_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#22c55e', '#06b6d4', '#eab308'];

const isOverdue = (dateStr: string | null) => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

const getDaysUntil = (dateStr: string | null) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diffTime = date.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getDeadlineStatus = (days: number | null): { color: string; label: string; bgColor: string } => {
  if (days === null) return { color: 'text-muted-foreground', label: 'Sem prazo', bgColor: 'bg-muted' };
  if (days < 0) return { color: 'text-red-600', label: `${Math.abs(days)}d atrasado`, bgColor: 'bg-red-500' };
  if (days === 0) return { color: 'text-red-600', label: 'Vence hoje', bgColor: 'bg-red-500' };
  if (days <= 3) return { color: 'text-orange-600', label: `${days}d`, bgColor: 'bg-orange-500' };
  if (days <= 7) return { color: 'text-yellow-600', label: `${days}d`, bgColor: 'bg-yellow-500' };
  return { color: 'text-green-600', label: `${days}d`, bgColor: 'bg-green-500' };
};

export default function DashboardTech() {
  useSetPageInfo("Tech - Visão Geral", "Dashboard visual do pipeline de entregas");
  const { data: metricas, isLoading: isLoadingMetricas } = useQuery<TechMetricas>({
    queryKey: ['/api/tech/metricas'],
  });

  const { data: projetosPorStatus, isLoading: isLoadingStatus } = useQuery<TechProjetoStatus[]>({
    queryKey: ['/api/tech/projetos-por-status'],
  });

  const { data: projetosPorResponsavel, isLoading: isLoadingResponsavel } = useQuery<TechProjetoResponsavel[]>({
    queryKey: ['/api/tech/projetos-por-responsavel'],
  });

  const { data: projetosPorTipo, isLoading: isLoadingTipo } = useQuery<TechProjetoTipo[]>({
    queryKey: ['/api/tech/projetos-por-tipo'],
  });

  const { data: projetosEmAndamento, isLoading: isLoadingAtivos } = useQuery<TechProjetoDetalhe[]>({
    queryKey: ['/api/tech/projetos-em-andamento'],
  });

  const { data: velocidade, isLoading: isLoadingVelocidade } = useQuery<TechVelocidade>({
    queryKey: ['/api/tech/velocidade'],
  });

  // Dados para gráficos
  const statusChartData = projetosPorStatus?.map(s => ({
    name: s.status,
    value: s.quantidade,
    fill: getStatusColor(s.status)
  })) || [];

  const tipoChartData = projetosPorTipo?.map((t, i) => ({
    name: t.tipo || 'Não definido',
    value: t.quantidade,
    valorTotal: t.valorTotal,
    fill: TIPO_COLORS[i % TIPO_COLORS.length]
  })) || [];

  const responsavelChartData = projetosPorResponsavel
    ?.filter(r => r.responsavel && r.responsavel !== 'Não atribuído')
    .slice(0, 6)
    .map(r => ({
      name: r.responsavel?.split(' ')[0] || 'N/A',
      fullName: r.responsavel,
      ativos: r.projetosAtivos,
      fechados: r.projetosFechados,
      valor: r.valorTotal
    })) || [];

  // Projetos críticos (atrasados ou próximos do prazo)
  const projetosAtrasados = projetosEmAndamento?.filter(p => isOverdue(p.dataVencimento)) || [];
  const projetosProximos = projetosEmAndamento?.filter(p => {
    const days = getDaysUntil(p.dataVencimento);
    return days !== null && days >= 0 && days <= 7;
  }) || [];

  // Dados para gauge de performance
  const taxaPrazo = velocidade?.taxaCumprimentoPrazo || 0;
  const gaugeData = [
    { name: 'Performance', value: taxaPrazo, fill: taxaPrazo >= 80 ? '#22c55e' : taxaPrazo >= 60 ? '#eab308' : '#ef4444' }
  ];

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          {velocidade && !isLoadingVelocidade && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-green-500/10 px-4 py-2 rounded-lg border border-green-500/20">
                <Rocket className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-green-600">
                  {velocidade.projetosEntreguesMes} entregas este mês
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Alertas Visuais */}
        {(projetosAtrasados.length > 0 || projetosProximos.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {projetosAtrasados.length > 0 && (
              <Card className="border-red-500/50 bg-red-500/5">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-red-500/20 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-red-600">
                        {projetosAtrasados.length} projeto{projetosAtrasados.length > 1 ? 's' : ''} atrasado{projetosAtrasados.length > 1 ? 's' : ''}
                      </p>
                      <div className="mt-2 space-y-1">
                        {projetosAtrasados.slice(0, 3).map((p, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-red-600/80">
                            <span className="truncate">{p.taskName}</span>
                            <Badge variant="destructive" className="text-xs flex-shrink-0">
                              {Math.abs(getDaysUntil(p.dataVencimento) || 0)}d
                            </Badge>
                          </div>
                        ))}
                        {projetosAtrasados.length > 3 && (
                          <p className="text-xs text-red-500/70">+ {projetosAtrasados.length - 3} mais</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {projetosProximos.length > 0 && (
              <Card className="border-yellow-500/50 bg-yellow-500/5">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-yellow-500/20 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-yellow-700">
                        {projetosProximos.length} projeto{projetosProximos.length > 1 ? 's' : ''} vence{projetosProximos.length > 1 ? 'm' : ''} em breve
                      </p>
                      <div className="mt-2 space-y-1">
                        {projetosProximos.slice(0, 3).map((p, i) => {
                          const days = getDaysUntil(p.dataVencimento);
                          return (
                            <div key={i} className="flex items-center gap-2 text-sm text-yellow-700/80">
                              <span className="truncate">{p.taskName}</span>
                              <Badge variant="outline" className="text-xs flex-shrink-0 border-yellow-500 text-yellow-700 bg-yellow-500/10">
                                {days === 0 ? 'Hoje' : `${days}d`}
                              </Badge>
                            </div>
                          );
                        })}
                        {projetosProximos.length > 3 && (
                          <p className="text-xs text-yellow-600/70">+ {projetosProximos.length - 3} mais</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* KPIs Principais com visual melhorado */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Monitor className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Em Andamento</p>
                  {isLoadingMetricas ? (
                    <Skeleton className="h-7 w-12 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-blue-600" data-testid="text-projetos-ativos">
                      {metricas?.projetosEmAndamento || 0}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Rocket className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Entregues</p>
                  {isLoadingMetricas ? (
                    <Skeleton className="h-7 w-12 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-green-600" data-testid="text-projetos-fechados">
                      {metricas?.projetosFechados || 0}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <DollarSign className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor Total</p>
                  {isLoadingMetricas ? (
                    <Skeleton className="h-7 w-20 mt-1" />
                  ) : (
                    <p className="text-xl font-bold text-purple-600" data-testid="text-valor-total">
                      {formatCurrencyCompact(metricas?.valorTotalProjetos || 0)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <Clock className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tempo Médio</p>
                  {isLoadingMetricas ? (
                    <Skeleton className="h-7 w-16 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-orange-600" data-testid="text-tempo-medio">
                      {Math.round(metricas?.tempoMedioEntrega || 0)}
                      <span className="text-sm font-normal ml-1">dias</span>
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border-cyan-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/20 rounded-lg">
                  <Target className="h-5 w-5 text-cyan-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">No Prazo</p>
                  {isLoadingVelocidade ? (
                    <Skeleton className="h-7 w-14 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-cyan-600" data-testid="text-taxa-prazo">
                      {formatPercent(velocidade?.taxaCumprimentoPrazo || 0)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos Principais */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Pipeline de Status - Gráfico de Barras Horizontal */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Pipeline de Projetos
              </CardTitle>
              <CardDescription>Distribuição por estágio de desenvolvimento</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingStatus ? (
                <Skeleton className="h-[280px] w-full" />
              ) : statusChartData.length === 0 ? (
                <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                  Nenhum projeto encontrado
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={statusChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                  >
                    <XAxis type="number" tickFormatter={(v) => `${v}`} />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      tick={{ fontSize: 12 }}
                      width={95}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`${value} projetos`, 'Quantidade']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar 
                      dataKey="value" 
                      radius={[0, 4, 4, 0]}
                      label={{ position: 'right', fontSize: 12, fill: 'hsl(var(--foreground))' }}
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Gauge de Performance */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Taxa de Cumprimento
              </CardTitle>
              <CardDescription>Projetos entregues no prazo</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center">
              {isLoadingVelocidade ? (
                <Skeleton className="h-[200px] w-[200px] rounded-full" />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <RadialBarChart 
                      cx="50%" 
                      cy="50%" 
                      innerRadius="60%" 
                      outerRadius="100%" 
                      barSize={20} 
                      data={gaugeData}
                      startAngle={180}
                      endAngle={0}
                    >
                      <RadialBar
                        dataKey="value"
                        cornerRadius={10}
                        background={{ fill: 'hsl(var(--muted))' }}
                      />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="text-center -mt-16">
                    <p className={`text-4xl font-bold ${
                      taxaPrazo >= 80 ? 'text-green-600' : 
                      taxaPrazo >= 60 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {formatPercent(taxaPrazo)}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {taxaPrazo >= 80 ? 'Excelente' : taxaPrazo >= 60 ? 'Atenção' : 'Crítico'}
                    </p>
                  </div>

                  <div className="w-full mt-6 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Entregas este mês</span>
                      <span className="font-semibold">{velocidade?.projetosEntreguesMes || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Tempo médio</span>
                      <span className="font-semibold">{Math.round(velocidade?.tempoMedioEntrega || 0)} dias</span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Gráficos Secundários */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Por Tipo de Projeto - Donut Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Por Tipo de Projeto
              </CardTitle>
              <CardDescription>Distribuição de projetos por categoria</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingTipo ? (
                <Skeleton className="h-[250px] w-full" />
              ) : tipoChartData.length === 0 ? (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                  Nenhum tipo encontrado
                </div>
              ) : (
                <div className="flex items-center">
                  <ResponsiveContainer width="55%" height={250}>
                    <PieChart>
                      <Pie
                        data={tipoChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {tipoChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number, name: string, props: any) => [
                          `${value} projetos - ${formatCurrency(props.payload.valorTotal)}`, 
                          props.payload.name
                        ]}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {tipoChartData.slice(0, 5).map((tipo, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tipo.fill }} />
                        <span className="text-sm truncate flex-1">{tipo.name}</span>
                        <Badge variant="secondary" className="text-xs">{tipo.value}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Carga por Responsável - Gráfico de Barras */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Carga por Responsável
              </CardTitle>
              <CardDescription>Projetos ativos vs. entregues por pessoa</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingResponsavel ? (
                <Skeleton className="h-[250px] w-full" />
              ) : responsavelChartData.length === 0 ? (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                  Nenhum responsável encontrado
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={responsavelChartData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 11 }}
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        value, 
                        name === 'ativos' ? 'Ativos' : 'Entregues'
                      ]}
                      labelFormatter={(label: string, payload: any[]) => 
                        payload[0]?.payload?.fullName || label
                      }
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend 
                      formatter={(value) => value === 'ativos' ? 'Ativos' : 'Entregues'}
                    />
                    <Bar dataKey="ativos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="fechados" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Timeline de Prazos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Linha do Tempo de Prazos
            </CardTitle>
            <CardDescription>Próximos projetos a vencer (ordenados por prazo)</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingAtivos ? (
              <Skeleton className="h-[200px] w-full" />
            ) : !projetosEmAndamento || projetosEmAndamento.length === 0 ? (
              <div className="flex items-center justify-center h-[150px] text-muted-foreground">
                Nenhum projeto em andamento
              </div>
            ) : (
              <ScrollArea className="h-[200px]">
                <div className="relative">
                  {/* Linha vertical */}
                  <div className="absolute left-[7px] top-0 bottom-0 w-[2px] bg-border" />
                  
                  <div className="space-y-3">
                    {projetosEmAndamento
                      .filter(p => p.dataVencimento)
                      .sort((a, b) => {
                        const daysA = getDaysUntil(a.dataVencimento) ?? 999;
                        const daysB = getDaysUntil(b.dataVencimento) ?? 999;
                        return daysA - daysB;
                      })
                      .slice(0, 10)
                      .map((projeto, index) => {
                        const days = getDaysUntil(projeto.dataVencimento);
                        const status = getDeadlineStatus(days);
                        return (
                          <div 
                            key={index}
                            className="flex items-center gap-4 pl-6 relative"
                            data-testid={`timeline-item-${index}`}
                          >
                            {/* Dot na timeline */}
                            <div className={`absolute left-0 w-4 h-4 rounded-full ${status.bgColor} border-2 border-background`} />
                            
                            <div className="flex-1 flex items-center justify-between p-3 rounded-lg bg-muted/50 hover-elevate">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{projeto.taskName}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-muted-foreground">
                                    {projeto.responsavel || 'Não atribuído'}
                                  </span>
                                  {projeto.tipo && (
                                    <>
                                      <span className="text-muted-foreground">•</span>
                                      <span className="text-xs text-muted-foreground">{projeto.tipo}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                {projeto.valorP && (
                                  <span className="text-sm font-medium text-muted-foreground">
                                    {formatCurrency(projeto.valorP)}
                                  </span>
                                )}
                                <Badge 
                                  variant={days !== null && days < 0 ? 'destructive' : 'outline'}
                                  className={days !== null && days >= 0 ? status.color : ''}
                                >
                                  {status.label}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
