import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Wallet, TrendingUp, TrendingDown, Calendar, AlertCircle,
  ArrowUpCircle, ArrowDownCircle, Banknote, CreditCard, Building2,
  ChevronRight, CircleDollarSign
} from "lucide-react";
import {
  ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, Line
} from "recharts";
import type { FluxoCaixaDiarioCompleto, FluxoCaixaInsights, ContaBanco } from "@shared/schema";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatCurrencyCompact = (value: number) => {
  if (Math.abs(value) >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toFixed(0)}K`;
  }
  return formatCurrency(value);
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

export default function FluxoCaixa() {
  const hoje = new Date();
  const defaultDataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
  const defaultDataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];

  const [dataInicio, setDataInicio] = useState(defaultDataInicio);
  const [dataFim, setDataFim] = useState(defaultDataFim);
  const [activePreset, setActivePreset] = useState('mes-atual');

  const { data: insights, isLoading: isLoadingInsights } = useQuery<FluxoCaixaInsights>({
    queryKey: ['/api/fluxo-caixa/insights'],
  });

  const { data: contasBancos, isLoading: isLoadingContas } = useQuery<ContaBanco[]>({
    queryKey: ['/api/fluxo-caixa/contas-bancos'],
  });

  const { data: fluxoDiario, isLoading: isLoadingFluxo } = useQuery<FluxoCaixaDiarioCompleto[]>({
    queryKey: ['/api/fluxo-caixa/diario-completo', dataInicio, dataFim],
    queryFn: async () => {
      const params = new URLSearchParams({ dataInicio, dataFim });
      const res = await fetch(`/api/fluxo-caixa/diario-completo?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch fluxo diario");
      return res.json();
    },
    enabled: !!dataInicio && !!dataFim,
  });

  const chartData = useMemo(() => {
    if (!fluxoDiario) return [];
    return fluxoDiario.map(item => ({
      ...item,
      dataFormatada: formatDate(item.data),
    }));
  }, [fluxoDiario]);

  const totais = useMemo(() => {
    if (!fluxoDiario || fluxoDiario.length === 0) {
      return { entradas: 0, saidas: 0, saldo: 0, saldoFinal: insights?.saldoHoje || 0 };
    }
    const entradas = fluxoDiario.reduce((acc, item) => acc + item.entradas, 0);
    const saidas = fluxoDiario.reduce((acc, item) => acc + item.saidas, 0);
    const saldoFinal = fluxoDiario[fluxoDiario.length - 1]?.saldoAcumulado || insights?.saldoHoje || 0;
    return { entradas, saidas, saldo: entradas - saidas, saldoFinal };
  }, [fluxoDiario, insights]);

  const setRangePreset = (preset: 'mes-atual' | 'proximo-mes' | '30-dias' | '60-dias') => {
    const now = new Date();
    let inicio: Date, fim: Date;

    switch (preset) {
      case 'mes-atual':
        inicio = new Date(now.getFullYear(), now.getMonth(), 1);
        fim = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'proximo-mes':
        inicio = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        fim = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        break;
      case '30-dias':
        inicio = new Date(now);
        fim = new Date(now);
        fim.setDate(fim.getDate() + 30);
        break;
      case '60-dias':
        inicio = new Date(now);
        fim = new Date(now);
        fim.setDate(fim.getDate() + 60);
        break;
    }

    setActivePreset(preset);
    setDataInicio(inicio.toISOString().split('T')[0]);
    setDataFim(fim.toISOString().split('T')[0]);
  };

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <CircleDollarSign className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold" data-testid="text-title">Fluxo de Caixa</h1>
              <p className="text-sm text-muted-foreground">Análise e projeção de entradas e saídas</p>
            </div>
          </div>
        </div>

        {/* KPIs Principais */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20" data-testid="card-saldo-atual">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Saldo Atual</span>
                <Wallet className="w-5 h-5 text-emerald-500" />
              </div>
              {isLoadingInsights ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold text-emerald-600" data-testid="text-saldo-atual">
                  {formatCurrency(insights?.saldoHoje || 0)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20" data-testid="card-saldo-futuro">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Saldo em 30 dias</span>
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
              {isLoadingInsights ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className={`text-2xl font-bold ${(insights?.saldoFuturo30Dias || 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`} data-testid="text-saldo-futuro">
                  {formatCurrency(insights?.saldoFuturo30Dias || 0)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-entradas-previstas">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Entradas (30d)</span>
                <ArrowUpCircle className="w-5 h-5 text-green-500" />
              </div>
              {isLoadingInsights ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold text-green-600" data-testid="text-entradas-previstas">
                  {formatCurrency(insights?.entradasPrevistas30Dias || 0)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-saidas-previstas">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Saídas (30d)</span>
                <ArrowDownCircle className="w-5 h-5 text-red-500" />
              </div>
              {isLoadingInsights ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold text-red-600" data-testid="text-saidas-previstas">
                  {formatCurrency(insights?.saidasPrevistas30Dias || 0)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Alertas de Vencidos */}
        {((insights?.entradasVencidas || 0) > 0 || (insights?.saidasVencidas || 0) > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {(insights?.entradasVencidas || 0) > 0 && (
              <Card className="border-amber-500/50 bg-amber-500/5" data-testid="card-entradas-vencidas">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-amber-500/20">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Entradas Vencidas</p>
                      <p className="text-xl font-bold text-amber-600">{formatCurrency(insights?.entradasVencidas || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {(insights?.saidasVencidas || 0) > 0 && (
              <Card className="border-red-500/50 bg-red-500/5" data-testid="card-saidas-vencidas">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-red-500/20">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Saídas Vencidas</p>
                      <p className="text-xl font-bold text-red-600">{formatCurrency(insights?.saidasVencidas || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Destaques */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <Card data-testid="card-maior-entrada">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <Banknote className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Maior Entrada (30d)</p>
                    {isLoadingInsights ? (
                      <Skeleton className="h-6 w-32 mt-1" />
                    ) : insights?.maiorEntradaPrevista ? (
                      <>
                        <p className="text-lg font-bold text-green-600">{formatCurrency(insights.maiorEntradaPrevista.valor)}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{insights.maiorEntradaPrevista.descricao}</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sem entradas previstas</p>
                    )}
                  </div>
                </div>
                {insights?.maiorEntradaPrevista && (
                  <Badge variant="secondary" className="text-xs">
                    <Calendar className="w-3 h-3 mr-1" />
                    {new Date(insights.maiorEntradaPrevista.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-maior-saida">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/10">
                    <CreditCard className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Maior Saída (30d)</p>
                    {isLoadingInsights ? (
                      <Skeleton className="h-6 w-32 mt-1" />
                    ) : insights?.maiorSaidaPrevista ? (
                      <>
                        <p className="text-lg font-bold text-red-600">{formatCurrency(insights.maiorSaidaPrevista.valor)}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{insights.maiorSaidaPrevista.descricao}</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sem saídas previstas</p>
                    )}
                  </div>
                </div>
                {insights?.maiorSaidaPrevista && (
                  <Badge variant="secondary" className="text-xs">
                    <Calendar className="w-3 h-3 mr-1" />
                    {new Date(insights.maiorSaidaPrevista.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </Badge>
                )}
              </div>
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
                <CardTitle className="text-lg">Fluxo de Caixa</CardTitle>
                <CardDescription>Evolução do saldo no período selecionado</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['mes-atual', 'proximo-mes', '30-dias', '60-dias'] as const).map((preset) => (
                  <Button 
                    key={preset}
                    size="sm" 
                    variant={activePreset === preset ? "default" : "outline"}
                    onClick={() => setRangePreset(preset)} 
                    data-testid={`btn-${preset}`}
                  >
                    {preset === 'mes-atual' ? 'Mês Atual' : 
                     preset === 'proximo-mes' ? 'Próx. Mês' : 
                     preset === '30-dias' ? '30 Dias' : '60 Dias'}
                  </Button>
                ))}
              </div>
            </div>
            
            <div className="flex flex-wrap items-end gap-4 mt-4 pt-4 border-t">
              <div className="flex items-center gap-3">
                <div className="space-y-1">
                  <Label htmlFor="dataInicio" className="text-xs">Início</Label>
                  <Input
                    id="dataInicio"
                    type="date"
                    value={dataInicio}
                    onChange={(e) => { setDataInicio(e.target.value); setActivePreset(''); }}
                    className="w-36 h-9"
                    data-testid="input-data-inicio"
                  />
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground mt-6" />
                <div className="space-y-1">
                  <Label htmlFor="dataFim" className="text-xs">Fim</Label>
                  <Input
                    id="dataFim"
                    type="date"
                    value={dataFim}
                    onChange={(e) => { setDataFim(e.target.value); setActivePreset(''); }}
                    className="w-36 h-9"
                    data-testid="input-data-fim"
                  />
                </div>
              </div>
              
              <div className="flex gap-4 ml-auto">
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
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis 
                      dataKey="dataFormatada" 
                      tick={{ fill: 'currentColor', fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      interval={chartData.length > 15 ? Math.floor(chartData.length / 10) : 0}
                    />
                    <YAxis 
                      tick={{ fill: 'currentColor', fontSize: 11 }}
                      tickFormatter={(value) => formatCurrencyCompact(value)}
                      tickLine={false}
                      axisLine={false}
                      width={70}
                    />
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                      formatter={(value: number, name: string) => {
                        const labels: Record<string, string> = {
                          entradas: 'Entradas',
                          saidas: 'Saídas',
                          saldoAcumulado: 'Saldo Acumulado',
                        };
                        return [formatCurrency(value), labels[name] || name];
                      }}
                      labelFormatter={(label) => `Data: ${label}`}
                    />
                    <Legend 
                      verticalAlign="top"
                      height={36}
                      formatter={(value) => {
                        const labels: Record<string, string> = {
                          entradas: 'Entradas',
                          saidas: 'Saídas',
                          saldoAcumulado: 'Saldo Acumulado',
                        };
                        return labels[value] || value;
                      }}
                    />
                    <Bar 
                      dataKey="entradas" 
                      fill="#22c55e"
                      radius={[4, 4, 0, 0]}
                      name="entradas"
                    />
                    <Bar 
                      dataKey="saidas" 
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                      name="saidas"
                    />
                    <Line
                      type="monotone"
                      dataKey="saldoAcumulado"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                      name="saldoAcumulado"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
