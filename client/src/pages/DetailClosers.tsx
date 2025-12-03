import { useState, useEffect } from "react";
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
  Users
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
  AreaChart
} from "recharts";

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

export default function DetailClosers() {
  const hoje = new Date();
  const inicioAno = new Date(hoje.getFullYear(), 0, 1).toISOString().split('T')[0];
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];

  const [closerId, setCloserId] = useState<string>("");
  const [dataInicio, setDataInicio] = useState<string>(inicioAno);
  const [dataFim, setDataFim] = useState<string>(fimMes);
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
    if (dataInicio) params.append("dataInicio", dataInicio);
    if (dataFim) params.append("dataFim", dataFim);
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

  const resetFilters = () => {
    setDataInicio(inicioAno);
    setDataFim(fimMes);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const selectedCloser = closers?.find(c => c.id.toString() === closerId);

  const COLORS = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1', '#14B8A6'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-violet-950/30 to-slate-950">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Detalhamento de Closers</h1>
              <p className="text-slate-400 text-sm">Análise individual de performance</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-slate-500">Atualizado em</p>
              <p className="text-lg font-mono text-violet-400">
                {currentTime.toLocaleTimeString('pt-BR')}
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="border-violet-500/50 text-violet-300 hover:bg-violet-500/20"
              data-testid="button-toggle-filters"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filtros
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <Label className="text-slate-300 mb-2 block">Selecione o Closer</Label>
          <Select value={closerId} onValueChange={setCloserId}>
            <SelectTrigger 
              className="w-full md:w-96 bg-slate-800/50 border-slate-700 text-white"
              data-testid="select-closer"
            >
              <SelectValue placeholder="Escolha um closer para analisar..." />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {closers?.map(closer => (
                <SelectItem key={closer.id} value={closer.id.toString()}>
                  {closer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6"
            >
              <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-slate-300 text-sm">Data Início</Label>
                      <Input
                        type="date"
                        value={dataInicio}
                        onChange={(e) => setDataInicio(e.target.value)}
                        className="bg-slate-800/50 border-slate-700 text-white"
                        data-testid="input-data-inicio"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300 text-sm">Data Fim</Label>
                      <Input
                        type="date"
                        value={dataFim}
                        onChange={(e) => setDataFim(e.target.value)}
                        className="bg-slate-800/50 border-slate-700 text-white"
                        data-testid="input-data-fim"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button 
                        variant="outline" 
                        onClick={resetFilters}
                        className="border-slate-600 text-slate-300 hover:bg-slate-700"
                        data-testid="button-reset-filters"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Resetar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {!closerId ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 rounded-full bg-violet-500/20 flex items-center justify-center mb-4">
              <Users className="w-10 h-10 text-violet-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Selecione um Closer</h2>
            <p className="text-slate-400 text-center max-w-md">
              Escolha um closer no menu acima para visualizar suas métricas detalhadas de performance.
            </p>
          </div>
        ) : isLoadingMetrics ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-32 bg-slate-800/50" />
            ))}
          </div>
        ) : metrics ? (
          <>
            <div className="mb-6">
              <Card className="bg-gradient-to-r from-violet-600/20 via-purple-600/20 to-fuchsia-600/20 border-violet-500/30 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-violet-500/30">
                      {metrics.closerName.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-white">{metrics.closerName}</h2>
                      <div className="flex items-center gap-4 mt-1">
                        <Badge className="bg-violet-500/30 text-violet-300 border-violet-500/50">
                          <Clock className="w-3 h-3 mr-1" />
                          {metrics.lt} meses ativos
                        </Badge>
                        <Badge className="bg-green-500/30 text-green-300 border-green-500/50">
                          <Trophy className="w-3 h-3 mr-1" />
                          {metrics.negociosGanhos} negócios ganhos
                        </Badge>
                        {metrics.primeiroNegocio && (
                          <span className="text-sm text-slate-400">
                            Desde {new Date(metrics.primeiroNegocio).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-400">Valor Total Gerado</p>
                      <p className="text-3xl font-bold text-green-400">{formatCurrency(metrics.valorTotal)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <MetricCard
                title="Valor Recorrente"
                value={formatCurrency(metrics.valorRecorrente)}
                icon={Repeat}
                color="violet"
                subtitle={`Ticket médio: ${formatCurrency(metrics.ticketMedioRecorrente)}`}
              />
              <MetricCard
                title="Valor Pontual"
                value={formatCurrency(metrics.valorPontual)}
                icon={Banknote}
                color="cyan"
                subtitle={`Ticket médio: ${formatCurrency(metrics.ticketMedioPontual)}`}
              />
              <MetricCard
                title="Ticket Médio Total"
                value={formatCurrency(metrics.ticketMedio)}
                icon={DollarSign}
                color="green"
                subtitle={`${metrics.negociosGanhos} negócios ganhos`}
              />
              <MetricCard
                title="Taxa de Conversão"
                value={formatPercent(metrics.taxaConversao)}
                icon={Target}
                color="amber"
                subtitle={`${metrics.negociosGanhos}/${metrics.reunioesRealizadas} reuniões`}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <MetricCard
                title="Reuniões Realizadas"
                value={metrics.reunioesRealizadas.toString()}
                icon={Calendar}
                color="blue"
                subtitle="Total no período"
              />
              <MetricCard
                title="Negócios Ganhos"
                value={metrics.negociosGanhos.toString()}
                icon={Trophy}
                color="emerald"
                subtitle={`${metrics.negociosPerdidos} perdidos`}
              />
              <MetricCard
                title="Em Andamento"
                value={metrics.negociosEmAndamento.toString()}
                icon={Briefcase}
                color="orange"
                subtitle="Negócios ativos"
              />
              <MetricCard
                title="Média Contratos/Mês"
                value={metrics.mediaContratosPorMes.toFixed(1)}
                icon={TrendingUp}
                color="pink"
                subtitle={`${metrics.lt} meses ativos`}
              />
            </div>

            <Tabs defaultValue="evolucao" className="space-y-4">
              <TabsList className="bg-slate-800/50 border border-slate-700/50">
                <TabsTrigger 
                  value="evolucao" 
                  className="data-[state=active]:bg-violet-600 data-[state=active]:text-white"
                  data-testid="tab-evolucao"
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Evolução Mensal
                </TabsTrigger>
                <TabsTrigger 
                  value="funil" 
                  className="data-[state=active]:bg-violet-600 data-[state=active]:text-white"
                  data-testid="tab-funil"
                >
                  <Target className="w-4 h-4 mr-2" />
                  Funil de Vendas
                </TabsTrigger>
                <TabsTrigger 
                  value="fontes" 
                  className="data-[state=active]:bg-violet-600 data-[state=active]:text-white"
                  data-testid="tab-fontes"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Fontes de Lead
                </TabsTrigger>
              </TabsList>

              <TabsContent value="evolucao">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-green-400" />
                        Receita Mensal
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoadingMonthly ? (
                        <Skeleton className="h-64 bg-slate-800/50" />
                      ) : monthlyData && monthlyData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={monthlyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="mesLabel" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                            <YAxis 
                              tick={{ fill: '#94a3b8', fontSize: 12 }} 
                              tickFormatter={(value) => `R$ ${(value/1000).toFixed(0)}k`}
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                              labelStyle={{ color: '#fff' }}
                              formatter={(value: number, name: string) => [
                                formatCurrency(value),
                                name === 'valorRecorrente' ? 'Recorrente' : 'Pontual'
                              ]}
                            />
                            <Legend />
                            <Bar dataKey="valorRecorrente" name="Recorrente" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="valorPontual" name="Pontual" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-64 flex items-center justify-center text-slate-500">
                          Sem dados para o período
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-violet-400" />
                        Negócios e Reuniões
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoadingMonthly ? (
                        <Skeleton className="h-64 bg-slate-800/50" />
                      ) : monthlyData && monthlyData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                          <AreaChart data={monthlyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="mesLabel" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                            <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                              labelStyle={{ color: '#fff' }}
                            />
                            <Legend />
                            <Area 
                              type="monotone" 
                              dataKey="reunioes" 
                              name="Reuniões" 
                              stroke="#06B6D4" 
                              fill="#06B6D4" 
                              fillOpacity={0.3} 
                            />
                            <Area 
                              type="monotone" 
                              dataKey="negocios" 
                              name="Negócios Ganhos" 
                              stroke="#10B981" 
                              fill="#10B981" 
                              fillOpacity={0.3} 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-64 flex items-center justify-center text-slate-500">
                          Sem dados para o período
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="funil">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Target className="w-5 h-5 text-violet-400" />
                        Distribuição por Etapa
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoadingStage ? (
                        <Skeleton className="h-64 bg-slate-800/50" />
                      ) : stageData && stageData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                          <PieChart>
                            <Pie
                              data={stageData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              dataKey="count"
                              nameKey="stage"
                              label={({ stage, percentage }) => `${stage}: ${percentage.toFixed(0)}%`}
                              labelLine={false}
                            >
                              {stageData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                              formatter={(value: number, name: string) => [value, name]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-64 flex items-center justify-center text-slate-500">
                          Sem dados para o período
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="text-white">Detalhamento por Etapa</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoadingStage ? (
                        <Skeleton className="h-64 bg-slate-800/50" />
                      ) : stageData && stageData.length > 0 ? (
                        <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                          {stageData.map((stage, index) => (
                            <div key={stage.stage} className="flex items-center gap-3">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              />
                              <span className="flex-1 text-slate-300 text-sm truncate">{stage.stage}</span>
                              <Badge variant="secondary" className="bg-slate-700/50 text-slate-300">
                                {stage.count}
                              </Badge>
                              <span className="text-slate-500 text-sm w-12 text-right">
                                {formatPercent(stage.percentage)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-64 flex items-center justify-center text-slate-500">
                          Sem dados para o período
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="fontes">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-cyan-400" />
                        Leads por Fonte
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoadingSource ? (
                        <Skeleton className="h-64 bg-slate-800/50" />
                      ) : sourceData && sourceData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={sourceData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                            <YAxis 
                              type="category" 
                              dataKey="source" 
                              tick={{ fill: '#94a3b8', fontSize: 11 }}
                              width={100}
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                              labelStyle={{ color: '#fff' }}
                            />
                            <Bar dataKey="count" fill="#06B6D4" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-64 flex items-center justify-center text-slate-500">
                          Sem dados para o período
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="text-white">Top Fontes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoadingSource ? (
                        <Skeleton className="h-64 bg-slate-800/50" />
                      ) : sourceData && sourceData.length > 0 ? (
                        <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                          {sourceData.slice(0, 10).map((source, index) => (
                            <div key={source.source} className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400 text-sm font-bold">
                                {index + 1}
                              </div>
                              <span className="flex-1 text-slate-300 text-sm truncate">{source.source || 'Não informado'}</span>
                              <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30">
                                {source.count} leads
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-64 flex items-center justify-center text-slate-500">
                          Sem dados para o período
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'violet' | 'cyan' | 'green' | 'amber' | 'blue' | 'emerald' | 'orange' | 'pink';
  subtitle?: string;
}

function MetricCard({ title, value, icon: Icon, color, subtitle }: MetricCardProps) {
  const colorClasses = {
    violet: 'from-violet-500/20 to-purple-500/20 border-violet-500/30 text-violet-400',
    cyan: 'from-cyan-500/20 to-teal-500/20 border-cyan-500/30 text-cyan-400',
    green: 'from-green-500/20 to-emerald-500/20 border-green-500/30 text-green-400',
    amber: 'from-amber-500/20 to-yellow-500/20 border-amber-500/30 text-amber-400',
    blue: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30 text-blue-400',
    emerald: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400',
    orange: 'from-orange-500/20 to-amber-500/20 border-orange-500/30 text-orange-400',
    pink: 'from-pink-500/20 to-rose-500/20 border-pink-500/30 text-pink-400',
  };

  return (
    <Card className={`bg-gradient-to-br ${colorClasses[color]} backdrop-blur-sm`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-slate-400 text-sm">{title}</p>
            <p className="text-2xl font-bold text-white mt-1">{value}</p>
            {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
          </div>
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorClasses[color].split(' ')[0].replace('from-', 'from-').replace('/20', '/30')} flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${colorClasses[color].split(' ').pop()}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
