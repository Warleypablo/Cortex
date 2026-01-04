import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Wallet, TrendingUp, TrendingDown, Calendar, AlertCircle,
  ArrowUpCircle, ArrowDownCircle, Banknote, CreditCard, Building2,
  ChevronRight, CircleDollarSign, CalendarDays, ArrowRight, Receipt,
  Loader2, X
} from "lucide-react";
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, Cell, Area
} from "recharts";
import type { FluxoCaixaDiarioCompleto, FluxoCaixaInsightsPeriodo, ContaBanco } from "@shared/schema";

interface FluxoDiaDetalhe {
  entradas: {
    id: number;
    descricao: string;
    valor: number;
    status: string;
    categoria: string;
    meioPagamento: string;
    conta: string;
  }[];
  saidas: {
    id: number;
    descricao: string;
    valor: number;
    status: string;
    categoria: string;
    meioPagamento: string;
    conta: string;
  }[];
  totalEntradas: number;
  totalSaidas: number;
  saldo: number;
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

const formatDateFull = (dateStr: string) => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getMesNome = (mes: number, ano: number) => {
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `${meses[mes]} ${ano}`;
};

export default function FluxoCaixa() {
  usePageTitle("Fluxo de Caixa");
  useSetPageInfo("Fluxo de Caixa", "Análise de entradas e saídas do período");
  const { theme } = useTheme();
  
  const hoje = new Date();
  const [selectedMonth, setSelectedMonth] = useState({ month: hoje.getMonth() + 1, year: hoje.getFullYear() });
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  
  const chartColors = useMemo(() => ({
    axisLabel: theme === 'dark' ? 'rgba(148, 163, 184, 0.8)' : 'rgba(71, 85, 105, 0.9)',
    axisLine: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(71, 85, 105, 0.3)',
    gridLine: theme === 'dark' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(71, 85, 105, 0.15)',
  }), [theme]);
  
  const dataInicio = useMemo(() => {
    return new Date(selectedMonth.year, selectedMonth.month - 1, 1).toISOString().split('T')[0];
  }, [selectedMonth]);
  
  const dataFim = useMemo(() => {
    return new Date(selectedMonth.year, selectedMonth.month, 0).toISOString().split('T')[0];
  }, [selectedMonth]);

  const periodoLabel = useMemo(() => {
    return getMesNome(selectedMonth.month - 1, selectedMonth.year);
  }, [selectedMonth]);

  const { data: insightsPeriodo, isLoading: isLoadingInsights } = useQuery<FluxoCaixaInsightsPeriodo>({
    queryKey: ['/api/fluxo-caixa/insights-periodo', { dataInicio, dataFim }],
    queryFn: async () => {
      const params = new URLSearchParams({ dataInicio, dataFim });
      const res = await fetch(`/api/fluxo-caixa/insights-periodo?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch insights");
      return res.json();
    },
    enabled: !!dataInicio && !!dataFim,
  });

  const { data: contasBancos, isLoading: isLoadingContas } = useQuery<ContaBanco[]>({
    queryKey: ['/api/fluxo-caixa/contas-bancos'],
  });

  const { data: fluxoDiarioResponse, isLoading: isLoadingFluxo } = useQuery<{ hasSnapshot: boolean; snapshotDate: string | null; dados: FluxoCaixaDiarioCompleto[] }>({
    queryKey: ['/api/fluxo-caixa/diario-completo', { dataInicio, dataFim }],
    queryFn: async () => {
      const params = new URLSearchParams({ dataInicio, dataFim });
      const res = await fetch(`/api/fluxo-caixa/diario-completo?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch fluxo diario");
      return res.json();
    },
    enabled: !!dataInicio && !!dataFim,
  });
  
  const fluxoDiario = fluxoDiarioResponse?.dados;
  const hasSnapshot = fluxoDiarioResponse?.hasSnapshot ?? false;

  const { data: diaDetalhe, isLoading: isLoadingDiaDetalhe } = useQuery<FluxoDiaDetalhe>({
    queryKey: ['/api/fluxo-caixa/dia-detalhe', diaSelecionado],
    queryFn: async () => {
      const res = await fetch(`/api/fluxo-caixa/dia-detalhe?data=${diaSelecionado}`);
      if (!res.ok) throw new Error("Failed to fetch dia detalhe");
      return res.json();
    },
    enabled: !!diaSelecionado,
  });

  const chartData = useMemo(() => {
    if (!fluxoDiario) return [];
    return fluxoDiario.map(item => ({
      ...item,
      dataFormatada: formatDate(item.data),
    }));
  }, [fluxoDiario]);

  const chartDomains = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return { barsMax: 100000, lineMin: 0, lineMax: 100000 };
    }
    
    const maxEntrada = Math.max(...chartData.map(d => d.entradas || 0));
    const maxSaida = Math.max(...chartData.map(d => d.saidas || 0));
    const barsMax = Math.max(maxEntrada, maxSaida) * 1.1 || 100000;
    
    const saldosReal = chartData.map(d => d.saldoAcumulado || 0);
    const saldosEsperado = hasSnapshot ? chartData.map(d => d.saldoEsperado || 0) : [];
    const allSaldos = [...saldosReal, ...saldosEsperado];
    const lineMin = Math.min(...allSaldos);
    const lineMax = Math.max(...allSaldos);
    const linePadding = (lineMax - lineMin) * 0.1 || 100000;
    
    return {
      barsMax: Math.ceil(barsMax / 50000) * 50000,
      lineMin: Math.floor((lineMin - linePadding) / 100000) * 100000,
      lineMax: Math.ceil((lineMax + linePadding) / 100000) * 100000,
    };
  }, [chartData, hasSnapshot]);

  const totais = useMemo(() => {
    if (!fluxoDiario || fluxoDiario.length === 0) {
      return { entradas: 0, saidas: 0, saldo: 0, saldoFinal: insightsPeriodo?.saldoAtual || 0 };
    }
    const entradas = fluxoDiario.reduce((acc, item) => acc + item.entradas, 0);
    const saidas = fluxoDiario.reduce((acc, item) => acc + item.saidas, 0);
    const saldoFinal = fluxoDiario[fluxoDiario.length - 1]?.saldoAcumulado || insightsPeriodo?.saldoAtual || 0;
    return { entradas, saidas, saldo: entradas - saidas, saldoFinal };
  }, [fluxoDiario, insightsPeriodo]);
  
  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Seletor de Mês */}
        <div className="mb-6">
          <MonthYearPicker
            value={selectedMonth}
            onChange={setSelectedMonth}
          />
        </div>

        {/* KPIs Principais - 4 cards em linha */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20" data-testid="card-saldo-atual">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Saldo Atual (Hoje)</span>
                <Wallet className="w-5 h-5 text-emerald-500" />
              </div>
              {isLoadingInsights ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold text-emerald-600" data-testid="text-saldo-atual">
                  {formatCurrency(insightsPeriodo?.saldoAtual || 0)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20" data-testid="card-saldo-final">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Saldo Projetado</span>
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
              {isLoadingInsights ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className={`text-2xl font-bold ${(insightsPeriodo?.saldoFinalPeriodo || 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`} data-testid="text-saldo-final">
                  {formatCurrency(insightsPeriodo?.saldoFinalPeriodo || 0)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20" data-testid="card-entradas-vencidas">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Entradas Vencidas</span>
                <AlertCircle className="w-5 h-5 text-amber-500" />
              </div>
              {isLoadingInsights ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold text-amber-600" data-testid="text-entradas-vencidas">
                  {formatCurrency(insightsPeriodo?.entradasVencidas || 0)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20" data-testid="card-saidas-vencidas">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Saídas Vencidas</span>
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              {isLoadingInsights ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold text-red-600" data-testid="text-saidas-vencidas">
                  {formatCurrency(insightsPeriodo?.saidasVencidas || 0)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Gráfico Principal */}
        <Card className="mb-6" data-testid="card-fluxo-diario">
          <CardHeader className="pb-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Fluxo Diário - {periodoLabel}</CardTitle>
                <CardDescription>Evolução do saldo no período selecionado</CardDescription>
              </div>
              
              <div className="flex gap-4">
                <div className="text-center px-4 py-2 rounded-lg bg-green-500/10">
                  <p className="text-xs text-muted-foreground">Entradas</p>
                  <p className="text-sm font-semibold text-green-600" data-testid="text-total-entradas">
                    {formatCurrencyCompact(totais.entradas)}
                  </p>
                </div>
                <div className="text-center px-4 py-2 rounded-lg bg-red-500/10">
                  <p className="text-xs text-muted-foreground">Saídas</p>
                  <p className="text-sm font-semibold text-red-600" data-testid="text-total-saidas">
                    {formatCurrencyCompact(totais.saidas)}
                  </p>
                </div>
                <div className="text-center px-4 py-2 rounded-lg bg-blue-500/10">
                  <p className="text-xs text-muted-foreground">Saldo Final</p>
                  <p className={`text-sm font-semibold ${totais.saldoFinal >= 0 ? 'text-blue-600' : 'text-red-600'}`} data-testid="text-total-saldo">
                    {formatCurrencyCompact(totais.saldoFinal)}
                  </p>
                </div>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            {isLoadingFluxo ? (
              <div className="flex items-center justify-center h-[400px]">
                <Skeleton className="h-full w-full" />
              </div>
            ) : !chartData || chartData.length === 0 ? (
              <div className="flex items-center justify-center h-[400px]">
                <p className="text-muted-foreground">Nenhum dado para o período selecionado</p>
              </div>
            ) : (
              <div className="h-[400px] relative rounded-xl overflow-hidden bg-gradient-to-b from-cyan-500/[0.02] to-slate-200/30 dark:to-slate-900/40">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart 
                    data={chartData} 
                    margin={{ top: 30, right: 85, left: 25, bottom: 55 }}
                    barGap={4}
                    barCategoryGap="20%"
                    onClick={(chartEvent) => {
                      if (chartEvent) {
                        let targetData: string | null = null;
                        
                        if (chartEvent.activePayload && chartEvent.activePayload.length > 0) {
                          const payload = chartEvent.activePayload[0].payload as typeof chartData[0];
                          if (payload?.data) {
                            targetData = payload.data;
                          }
                        }
                        
                        if (!targetData && typeof chartEvent.activeTooltipIndex === 'number' && chartData[chartEvent.activeTooltipIndex]) {
                          targetData = chartData[chartEvent.activeTooltipIndex].data;
                        }
                        
                        if (targetData) {
                          setDiaSelecionado(targetData);
                        }
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <defs>
                      <linearGradient id="gradientEntradas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity={1} />
                        <stop offset="20%" stopColor="#10b981" stopOpacity={1} />
                        <stop offset="80%" stopColor="#059669" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#047857" stopOpacity={0.85} />
                      </linearGradient>
                      <linearGradient id="gradientSaidas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fb7185" stopOpacity={1} />
                        <stop offset="20%" stopColor="#f43f5e" stopOpacity={1} />
                        <stop offset="80%" stopColor="#e11d48" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#be123c" stopOpacity={0.85} />
                      </linearGradient>
                      <linearGradient id="gradientSaldo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.3} />
                        <stop offset="50%" stopColor="#06b6d4" stopOpacity={0.12} />
                        <stop offset="100%" stopColor="#0891b2" stopOpacity={0.02} />
                      </linearGradient>
                      <filter id="glowCyan" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                        <feMerge>
                          <feMergeNode in="coloredBlur"/>
                          <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                      </filter>
                      <filter id="glowGreen" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#34d399" floodOpacity="0.5"/>
                      </filter>
                      <filter id="glowRed" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#fb7185" floodOpacity="0.4"/>
                      </filter>
                      <filter id="barShadow" x="-20%" y="-10%" width="140%" height="130%">
                        <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,0.3)" floodOpacity="0.5"/>
                      </filter>
                    </defs>
                    
                    <CartesianGrid 
                      strokeDasharray="1 6" 
                      stroke={chartColors.gridLine} 
                      vertical={false} 
                    />
                    
                    <XAxis 
                      dataKey="dataFormatada" 
                      tick={{ fill: chartColors.axisLabel, fontSize: 10, fontWeight: 500 }}
                      tickLine={false}
                      axisLine={{ stroke: chartColors.axisLine, strokeWidth: 1 }}
                      angle={-45}
                      textAnchor="end"
                      height={55}
                      interval={chartData.length > 20 ? Math.floor(chartData.length / 10) : chartData.length > 10 ? 1 : 0}
                      dy={12}
                    />
                    
                    <YAxis 
                      yAxisId="bars"
                      tick={{ fill: chartColors.axisLabel, fontSize: 10, fontWeight: 500 }}
                      tickFormatter={(value) => formatCurrencyCompact(value)}
                      tickLine={false}
                      axisLine={false}
                      width={70}
                      domain={[0, chartDomains.barsMax]}
                    />
                    
                    <YAxis 
                      yAxisId="line"
                      orientation="right"
                      tick={{ fill: '#22d3ee', fontSize: 10, fontWeight: 600 }}
                      tickFormatter={(value) => formatCurrencyCompact(value)}
                      tickLine={false}
                      axisLine={false}
                      width={75}
                      domain={[chartDomains.lineMin, chartDomains.lineMax]}
                    />
                    
                    <Tooltip
                      cursor={{ fill: 'rgba(34, 211, 238, 0.08)', radius: 6 }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const data = payload[0]?.payload as typeof chartData[0];
                        const saldo = (data?.entradas || 0) - (data?.saidas || 0);
                        return (
                          <div className="bg-slate-900/95 backdrop-blur-md border border-cyan-500/30 rounded-xl shadow-2xl p-4 min-w-[220px]" style={{ boxShadow: '0 0 20px rgba(34, 211, 238, 0.15)' }}>
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-700">
                              <CalendarDays className="w-4 h-4 text-cyan-400" />
                              <p className="font-semibold text-white">{label}</p>
                            </div>
                            <div className="space-y-2.5">
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px rgba(52, 211, 153, 0.6)' }} />
                                  <span className="text-sm text-slate-400">Entradas</span>
                                </div>
                                <span className="text-sm font-semibold text-emerald-400">{formatCurrency(data?.entradas || 0)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full bg-rose-400" style={{ boxShadow: '0 0 6px rgba(251, 113, 133, 0.6)' }} />
                                  <span className="text-sm text-slate-400">Saídas</span>
                                </div>
                                <span className="text-sm font-semibold text-rose-400">{formatCurrency(data?.saidas || 0)}</span>
                              </div>
                              <div className="flex justify-between items-center pt-2 border-t border-slate-700 mt-2">
                                <span className="text-sm font-medium text-slate-300">Saldo do Dia</span>
                                <span className={`text-sm font-bold ${saldo >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {formatCurrency(saldo)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" style={{ boxShadow: '0 0 6px rgba(34, 211, 238, 0.6)' }} />
                                  <span className="text-sm text-slate-400">{hasSnapshot ? 'Saldo Real' : 'Saldo Acumulado'}</span>
                                </div>
                                <span className="text-sm font-semibold text-cyan-400">{formatCurrency(data?.saldoAcumulado || 0)}</span>
                              </div>
                              {hasSnapshot && (
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" style={{ boxShadow: '0 0 6px rgba(251, 191, 36, 0.6)' }} />
                                    <span className="text-sm text-slate-400">Saldo Esperado</span>
                                  </div>
                                  <span className="text-sm font-semibold text-amber-400">{formatCurrency(data?.saldoEsperado || 0)}</span>
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-3 pt-2 border-t border-slate-700 text-center">
                              Clique para ver detalhes
                            </p>
                          </div>
                        );
                      }}
                    />
                    
                    <Bar 
                      yAxisId="bars"
                      dataKey="entradas" 
                      name="entradas"
                      fill="url(#gradientEntradas)"
                      radius={[8, 8, 2, 2]}
                      maxBarSize={14}
                      style={{ filter: 'url(#glowGreen)' }}
                    />
                    
                    <Bar 
                      yAxisId="bars"
                      dataKey="saidas" 
                      name="saidas"
                      fill="url(#gradientSaidas)"
                      radius={[8, 8, 2, 2]}
                      maxBarSize={14}
                      style={{ filter: 'url(#glowRed)' }}
                    />
                    
                    <Area
                      yAxisId="line"
                      type="monotone"
                      dataKey="saldoAcumulado"
                      fill="url(#gradientSaldo)"
                      stroke="none"
                    />
                    
                    <Line 
                      yAxisId="line"
                      type="monotone" 
                      dataKey="saldoAcumulado" 
                      name={hasSnapshot ? "Saldo Real" : "Saldo Acumulado"}
                      stroke="#22d3ee" 
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 7, fill: '#22d3ee', stroke: '#0f172a', strokeWidth: 3, style: { filter: 'drop-shadow(0 0 8px rgba(34, 211, 238, 0.8))' } }}
                      style={{ filter: 'url(#glowCyan)' }}
                    />
                    
                    {hasSnapshot && (
                      <Line 
                        yAxisId="line"
                        type="monotone" 
                        dataKey="saldoEsperado" 
                        name="Saldo Esperado"
                        stroke="#fbbf24" 
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        activeDot={{ r: 5, fill: '#fbbf24', stroke: '#0f172a', strokeWidth: 2 }}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Provisão Mensal */}
        <Card className="mb-6 border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-purple-500/10" data-testid="card-provisao-mensal">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-purple-500" />
              <CardTitle className="text-base">Provisão Mensal - {periodoLabel}</CardTitle>
            </div>
            <CardDescription>Projeção de geração de caixa considerando inadimplência de 6%</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingInsights ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20" />)}
              </div>
            ) : (() => {
              const entradasPrevistas = insightsPeriodo?.entradasPeriodo || 0;
              const saidasPrevistas = insightsPeriodo?.saidasPeriodo || 0;
              const inadimplenciaPrevista = entradasPrevistas * 0.06;
              const geracaoCaixaPrevista = entradasPrevistas - saidasPrevistas - inadimplenciaPrevista;
              const margemPrevista = entradasPrevistas > 0 ? (geracaoCaixaPrevista / entradasPrevistas) * 100 : 0;
              
              return (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Entradas Previstas</p>
                    <p className="text-lg font-bold text-green-600" data-testid="text-entradas-previstas">
                      {formatCurrency(entradasPrevistas)}
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Saídas Previstas</p>
                    <p className="text-lg font-bold text-red-600" data-testid="text-saidas-previstas">
                      {formatCurrency(saidasPrevistas)}
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Inadimplência (6%)</p>
                    <p className="text-lg font-bold text-amber-600" data-testid="text-inadimplencia-prevista">
                      -{formatCurrency(inadimplenciaPrevista)}
                    </p>
                  </div>
                  
                  <div className={`p-4 rounded-lg border ${geracaoCaixaPrevista >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Geração de Caixa</p>
                    <p className={`text-lg font-bold ${geracaoCaixaPrevista >= 0 ? 'text-emerald-600' : 'text-red-600'}`} data-testid="text-geracao-caixa">
                      {formatCurrency(geracaoCaixaPrevista)}
                    </p>
                  </div>
                  
                  <div className={`p-4 rounded-lg border ${margemPrevista >= 0 ? 'bg-purple-500/10 border-purple-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Margem Prevista</p>
                    <p className={`text-lg font-bold ${margemPrevista >= 0 ? 'text-purple-600' : 'text-red-600'}`} data-testid="text-margem-prevista">
                      {margemPrevista.toFixed(1)}%
                    </p>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Contas Bancárias */}
        <Card className="mb-6" data-testid="card-contas-bancos">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-muted-foreground" />
              <CardTitle className="text-base">Contas Bancárias</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingContas ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : !contasBancos || contasBancos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma conta bancária encontrada</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {contasBancos.map((conta, index) => (
                  <div 
                    key={conta.id || index}
                    className="p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
                    data-testid={`card-conta-${index}`}
                  >
                    <p className="text-xs font-medium text-muted-foreground truncate">{conta.nome}</p>
                    <p className={`text-base font-bold ${conta.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(conta.saldo)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Detalhamento do Dia */}
      <Dialog open={!!diaSelecionado} onOpenChange={(open) => !open && setDiaSelecionado(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col" data-testid="dialog-dia-detalhe">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CalendarDays className="w-5 h-5 text-primary" />
              </div>
              <div>
                <span className="text-lg">Movimentações do Dia</span>
                {diaSelecionado && (
                  <span className="block text-sm font-normal text-muted-foreground">
                    {formatDateFull(diaSelecionado)}
                  </span>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {isLoadingDiaDetalhe ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : diaDetalhe ? (
            <div className="flex flex-col gap-4 overflow-y-auto pr-2" style={{ maxHeight: 'calc(90vh - 120px)' }}>
              {/* Resumo do Dia */}
              <div className="grid grid-cols-3 gap-4 flex-shrink-0">
                <div className="p-4 rounded-lg bg-green-500/10">
                  <p className="text-xs text-muted-foreground">Total Entradas</p>
                  <p className="text-xl font-bold text-green-600" data-testid="text-dia-entradas">
                    {formatCurrency(diaDetalhe.totalEntradas)}
                  </p>
                  <p className="text-xs text-muted-foreground">{diaDetalhe.entradas.length} transações</p>
                </div>
                <div className="p-4 rounded-lg bg-red-500/10">
                  <p className="text-xs text-muted-foreground">Total Saídas</p>
                  <p className="text-xl font-bold text-red-600" data-testid="text-dia-saidas">
                    {formatCurrency(diaDetalhe.totalSaidas)}
                  </p>
                  <p className="text-xs text-muted-foreground">{diaDetalhe.saidas.length} transações</p>
                </div>
                <div className="p-4 rounded-lg bg-blue-500/10">
                  <p className="text-xs text-muted-foreground">Saldo do Dia</p>
                  <p className={`text-xl font-bold ${diaDetalhe.saldo >= 0 ? 'text-blue-600' : 'text-red-600'}`} data-testid="text-dia-saldo">
                    {formatCurrency(diaDetalhe.saldo)}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                  {/* Entradas */}
                  {diaDetalhe.entradas.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-green-600 mb-2 flex items-center gap-2">
                        <ArrowUpCircle className="w-4 h-4" />
                        Entradas ({diaDetalhe.entradas.length})
                      </h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {diaDetalhe.entradas.map((entrada, idx) => (
                            <TableRow key={entrada.id || idx} data-testid={`row-entrada-${idx}`}>
                              <TableCell className="font-medium max-w-[200px] truncate" title={entrada.descricao}>
                                {entrada.descricao}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs">
                                  {entrada.categoria}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant={entrada.status === 'QUITADO' ? 'default' : 'outline'}
                                  className={entrada.status === 'QUITADO' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : ''}
                                >
                                  {entrada.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-semibold text-green-600">
                                {formatCurrency(entrada.valor)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Saídas */}
                  {diaDetalhe.saidas.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-2">
                        <ArrowDownCircle className="w-4 h-4" />
                        Saídas ({diaDetalhe.saidas.length})
                      </h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {diaDetalhe.saidas.map((saida, idx) => (
                            <TableRow key={saida.id || idx} data-testid={`row-saida-${idx}`}>
                              <TableCell className="font-medium max-w-[200px] truncate" title={saida.descricao}>
                                {saida.descricao}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs">
                                  {saida.categoria}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant={saida.status === 'QUITADO' ? 'default' : 'outline'}
                                  className={saida.status === 'QUITADO' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : ''}
                                >
                                  {saida.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-semibold text-red-600">
                                {formatCurrency(saida.valor)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {diaDetalhe.entradas.length === 0 && diaDetalhe.saidas.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhuma movimentação registrada para este dia
                    </div>
                  )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Erro ao carregar detalhes do dia
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
