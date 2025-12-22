import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
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
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, Cell
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
  useSetPageInfo("Fluxo de Caixa", "Análise de entradas e saídas do período");
  
  const hoje = new Date();
  const [selectedMonth, setSelectedMonth] = useState({ month: hoje.getMonth() + 1, year: hoje.getFullYear() });
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  
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

  const { data: fluxoDiario, isLoading: isLoadingFluxo } = useQuery<FluxoCaixaDiarioCompleto[]>({
    queryKey: ['/api/fluxo-caixa/diario-completo', { dataInicio, dataFim }],
    queryFn: async () => {
      const params = new URLSearchParams({ dataInicio, dataFim });
      const res = await fetch(`/api/fluxo-caixa/diario-completo?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch fluxo diario");
      return res.json();
    },
    enabled: !!dataInicio && !!dataFim,
  });

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
    
    const saldos = chartData.map(d => d.saldoAcumulado || 0);
    const lineMin = Math.min(...saldos);
    const lineMax = Math.max(...saldos);
    const linePadding = (lineMax - lineMin) * 0.1 || 100000;
    
    return {
      barsMax: Math.ceil(barsMax / 50000) * 50000,
      lineMin: Math.floor((lineMin - linePadding) / 100000) * 100000,
      lineMax: Math.ceil((lineMax + linePadding) / 100000) * 100000,
    };
  }, [chartData]);

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

        {/* KPIs Principais */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
                <span className="text-sm font-medium text-muted-foreground">Saldo Projetado (Fim do Mês)</span>
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

          <Card data-testid="card-entradas-periodo">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Entradas do Mês</span>
                <ArrowUpCircle className="w-5 h-5 text-green-500" />
              </div>
              {isLoadingInsights ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold text-green-600" data-testid="text-entradas-periodo">
                  {formatCurrency(insightsPeriodo?.entradasPeriodo || 0)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-saidas-periodo">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Saídas do Mês</span>
                <ArrowDownCircle className="w-5 h-5 text-red-500" />
              </div>
              {isLoadingInsights ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold text-red-600" data-testid="text-saidas-periodo">
                  {formatCurrency(insightsPeriodo?.saidasPeriodo || 0)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Alertas de Vencidos */}
        {((insightsPeriodo?.entradasVencidas || 0) > 0 || (insightsPeriodo?.saidasVencidas || 0) > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {(insightsPeriodo?.entradasVencidas || 0) > 0 && (
              <Card className="border-amber-500/50 bg-amber-500/5" data-testid="card-entradas-vencidas">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-amber-500/20">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Entradas Vencidas</p>
                      <p className="text-xl font-bold text-amber-600">{formatCurrency(insightsPeriodo?.entradasVencidas || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {(insightsPeriodo?.saidasVencidas || 0) > 0 && (
              <Card className="border-red-500/50 bg-red-500/5" data-testid="card-saidas-vencidas">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-red-500/20">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Saídas Vencidas</p>
                      <p className="text-xl font-bold text-red-600">{formatCurrency(insightsPeriodo?.saidasVencidas || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Top Entradas e Saídas do Período */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <Card data-testid="card-top-entradas">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-green-500/10">
                  <Banknote className="w-4 h-4 text-green-600" />
                </div>
                <CardTitle className="text-base">Maiores Entradas - {periodoLabel}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingInsights ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : !insightsPeriodo?.topEntradas || insightsPeriodo.topEntradas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma entrada no período</p>
              ) : (
                <div className="space-y-3">
                  {insightsPeriodo.topEntradas.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.descricao}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span>{formatDateFull(item.data)}</span>
                          <span>•</span>
                          <span className="truncate">{item.empresa}</span>
                        </div>
                      </div>
                      <p className="text-green-600 font-bold ml-4">{formatCurrency(item.valor)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-top-saidas">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-red-500/10">
                  <CreditCard className="w-4 h-4 text-red-600" />
                </div>
                <CardTitle className="text-base">Maiores Saídas - {periodoLabel}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingInsights ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : !insightsPeriodo?.topSaidas || insightsPeriodo.topSaidas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma saída no período</p>
              ) : (
                <div className="space-y-3">
                  {insightsPeriodo.topSaidas.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.descricao}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span>{formatDateFull(item.data)}</span>
                          <span>•</span>
                          <span className="truncate">{item.empresa}</span>
                        </div>
                      </div>
                      <p className="text-red-600 font-bold ml-4">{formatCurrency(item.valor)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

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

        {/* Gráfico Principal */}
        <Card data-testid="card-fluxo-diario">
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
              <div className="h-[400px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart 
                    data={chartData} 
                    margin={{ top: 20, right: 80, left: 20, bottom: 50 }}
                    barGap={2}
                    barCategoryGap="15%"
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
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={1} />
                        <stop offset="100%" stopColor="#16a34a" stopOpacity={0.8} />
                      </linearGradient>
                      <linearGradient id="gradientSaidas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
                        <stop offset="100%" stopColor="#dc2626" stopOpacity={0.8} />
                      </linearGradient>
                    </defs>
                    
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      stroke="hsl(var(--border))" 
                      vertical={false} 
                      opacity={0.5}
                    />
                    
                    <XAxis 
                      dataKey="dataFormatada" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                      tickLine={false}
                      axisLine={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                      angle={-45}
                      textAnchor="end"
                      height={50}
                      interval={chartData.length > 20 ? Math.floor(chartData.length / 12) : chartData.length > 10 ? 1 : 0}
                      dy={10}
                    />
                    
                    <YAxis 
                      yAxisId="bars"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                      tickFormatter={(value) => formatCurrencyCompact(value)}
                      tickLine={false}
                      axisLine={false}
                      width={75}
                      domain={[0, chartDomains.barsMax]}
                    />
                    
                    <YAxis 
                      yAxisId="line"
                      orientation="right"
                      tick={{ fill: '#06b6d4', fontSize: 11, fontWeight: 600 }}
                      tickFormatter={(value) => formatCurrencyCompact(value)}
                      tickLine={false}
                      axisLine={false}
                      width={80}
                      domain={[chartDomains.lineMin, chartDomains.lineMax]}
                    />
                    
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3, radius: 4 }}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '12px',
                        boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.3)',
                        padding: '12px 16px',
                      }}
                      formatter={(value: number, name: string) => {
                        const labels: Record<string, string> = {
                          entradas: 'Entradas',
                          saidas: 'Saídas',
                          saldoAcumulado: 'Saldo'
                        };
                        return [formatCurrency(value), labels[name] || name];
                      }}
                      labelFormatter={(label) => `Data: ${label}`}
                    />
                    
                    <Bar 
                      yAxisId="bars"
                      dataKey="entradas" 
                      name="entradas"
                      fill="url(#gradientEntradas)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={20}
                    />
                    
                    <Bar 
                      yAxisId="bars"
                      dataKey="saidas" 
                      name="saidas"
                      fill="url(#gradientSaidas)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={20}
                    />
                    
                    <Line 
                      yAxisId="line"
                      type="monotone" 
                      dataKey="saldoAcumulado" 
                      name="saldoAcumulado"
                      stroke="#06b6d4" 
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6, fill: '#06b6d4', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
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
