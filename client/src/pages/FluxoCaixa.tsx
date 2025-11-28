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
  ArrowUpCircle, ArrowDownCircle, Banknote, CreditCard, Building2
} from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine
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
      entradasPositivas: item.entradas,
      saidasNegativas: -item.saidas,
    }));
  }, [fluxoDiario]);

  const totais = useMemo(() => {
    if (!fluxoDiario || fluxoDiario.length === 0) {
      return { entradas: 0, saidas: 0, saldo: 0 };
    }
    const entradas = fluxoDiario.reduce((acc, item) => acc + item.entradas, 0);
    const saidas = fluxoDiario.reduce((acc, item) => acc + item.saidas, 0);
    return { entradas, saidas, saldo: entradas - saidas };
  }, [fluxoDiario]);

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

    setDataInicio(inicio.toISOString().split('T')[0]);
    setDataFim(fim.toISOString().split('T')[0]);
  };

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2" data-testid="text-title">Fluxo de Caixa</h1>
          <p className="text-muted-foreground">Análise diária de entradas e saídas</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card data-testid="card-saldo-atual">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
              <Wallet className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingInsights ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <>
                  <div className={`text-2xl font-bold ${(insights?.saldoHoje || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-saldo-atual">
                    {formatCurrency(insights?.saldoHoje || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Soma de todas as contas bancárias</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-saldo-futuro">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo em 30 Dias</CardTitle>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingInsights ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <>
                  <div className={`text-2xl font-bold ${(insights?.saldoFuturo30Dias || 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`} data-testid="text-saldo-futuro">
                    {formatCurrency(insights?.saldoFuturo30Dias || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Projeção baseada em provisões</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-entradas-previstas">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Entradas Previstas</CardTitle>
              <ArrowUpCircle className="w-4 h-4 text-green-600" />
            </CardHeader>
            <CardContent>
              {isLoadingInsights ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-green-600" data-testid="text-entradas-previstas">
                    {formatCurrency(insights?.entradasPrevistas30Dias || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Próximos 30 dias</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-saidas-previstas">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saídas Previstas</CardTitle>
              <ArrowDownCircle className="w-4 h-4 text-red-600" />
            </CardHeader>
            <CardContent>
              {isLoadingInsights ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-red-600" data-testid="text-saidas-previstas">
                    {formatCurrency(insights?.saidasPrevistas30Dias || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Próximos 30 dias</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {(insights?.entradasVencidas || 0) > 0 || (insights?.saidasVencidas || 0) > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {(insights?.entradasVencidas || 0) > 0 && (
              <Card className="border-amber-200 dark:border-amber-900" data-testid="card-entradas-vencidas">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-amber-600">Entradas Vencidas</CardTitle>
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-amber-600">
                    {formatCurrency(insights?.entradasVencidas || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Recebimentos não realizados</p>
                </CardContent>
              </Card>
            )}
            {(insights?.saidasVencidas || 0) > 0 && (
              <Card className="border-red-200 dark:border-red-900" data-testid="card-saidas-vencidas">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-red-600">Saídas Vencidas</CardTitle>
                  <AlertCircle className="w-4 h-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-red-600">
                    {formatCurrency(insights?.saidasVencidas || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Pagamentos em atraso</p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="lg:col-span-2" data-testid="card-maior-entrada">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Banknote className="w-4 h-4 text-green-600" />
                Maior Entrada Prevista (30 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingInsights ? (
                <Skeleton className="h-12 w-full" />
              ) : insights?.maiorEntradaPrevista ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-green-600">{formatCurrency(insights.maiorEntradaPrevista.valor)}</p>
                    <p className="text-sm text-muted-foreground truncate max-w-[300px]" title={insights.maiorEntradaPrevista.descricao}>
                      {insights.maiorEntradaPrevista.descricao}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    <Calendar className="w-3 h-3 mr-1" />
                    {new Date(insights.maiorEntradaPrevista.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </Badge>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma entrada prevista</p>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-maior-saida">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-red-600" />
                Maior Saída Prevista (30 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingInsights ? (
                <Skeleton className="h-12 w-full" />
              ) : insights?.maiorSaidaPrevista ? (
                <div>
                  <p className="text-lg font-semibold text-red-600">{formatCurrency(insights.maiorSaidaPrevista.valor)}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm text-muted-foreground truncate max-w-[150px]" title={insights.maiorSaidaPrevista.descricao}>
                      {insights.maiorSaidaPrevista.descricao}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {new Date(insights.maiorSaidaPrevista.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </Badge>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma saída prevista</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8" data-testid="card-contas-bancos">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Contas Bancárias
            </CardTitle>
            <CardDescription>Saldo atual por conta</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingContas ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}
              </div>
            ) : !contasBancos || contasBancos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma conta bancária encontrada</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {contasBancos.map((conta, index) => (
                  <div 
                    key={conta.id || index}
                    className="p-4 rounded-lg border bg-muted/30"
                    data-testid={`card-conta-${index}`}
                  >
                    <p className="text-sm font-medium truncate" title={conta.nome}>{conta.nome}</p>
                    <p className={`text-lg font-bold mt-1 ${conta.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(conta.saldo)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{conta.empresa}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-fluxo-diario">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Fluxo de Caixa Diário</CardTitle>
                <CardDescription>Entradas, saídas e evolução do saldo</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setRangePreset('mes-atual')} data-testid="btn-mes-atual">
                  Mês Atual
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRangePreset('proximo-mes')} data-testid="btn-proximo-mes">
                  Próximo Mês
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRangePreset('30-dias')} data-testid="btn-30-dias">
                  30 Dias
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRangePreset('60-dias')} data-testid="btn-60-dias">
                  60 Dias
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-4 mt-4">
              <div className="space-y-1">
                <Label htmlFor="dataInicio">Data Início</Label>
                <Input
                  id="dataInicio"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-40"
                  data-testid="input-data-inicio"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dataFim">Data Fim</Label>
                <Input
                  id="dataFim"
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-40"
                  data-testid="input-data-fim"
                />
              </div>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-green-500" />
                  <span data-testid="text-total-entradas">Entradas: {formatCurrencyCompact(totais.entradas)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-red-500" />
                  <span data-testid="text-total-saidas">Saídas: {formatCurrencyCompact(totais.saidas)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-blue-500" />
                  <span className={totais.saldo >= 0 ? 'text-green-600' : 'text-red-600'} data-testid="text-total-saldo">
                    Saldo: {formatCurrencyCompact(totais.saldo)}
                  </span>
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
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="dataFormatada" 
                    className="text-xs"
                    tick={{ fill: 'currentColor', fontSize: 11 }}
                    interval={Math.floor(chartData.length / 10)}
                  />
                  <YAxis 
                    yAxisId="bars"
                    className="text-xs"
                    tick={{ fill: 'currentColor', fontSize: 11 }}
                    tickFormatter={(value) => formatCurrencyCompact(value)}
                  />
                  <YAxis 
                    yAxisId="line"
                    orientation="right"
                    className="text-xs"
                    tick={{ fill: 'currentColor', fontSize: 11 }}
                    tickFormatter={(value) => formatCurrencyCompact(value)}
                  />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = {
                        entradasPositivas: 'Entradas',
                        saidasNegativas: 'Saídas',
                        saldoAcumulado: 'Saldo Acumulado',
                      };
                      return [formatCurrency(Math.abs(value)), labels[name] || name];
                    }}
                    labelFormatter={(label) => `Data: ${label}`}
                  />
                  <Legend 
                    formatter={(value) => {
                      const labels: Record<string, string> = {
                        entradasPositivas: 'Entradas',
                        saidasNegativas: 'Saídas',
                        saldoAcumulado: 'Saldo Acumulado',
                      };
                      return labels[value] || value;
                    }}
                  />
                  <ReferenceLine yAxisId="bars" y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                  <Bar 
                    yAxisId="bars"
                    dataKey="entradasPositivas" 
                    fill="hsl(142.1 76.2% 36.3%)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={20}
                  />
                  <Bar 
                    yAxisId="bars"
                    dataKey="saidasNegativas" 
                    fill="hsl(0 84.2% 60.2%)"
                    radius={[0, 0, 4, 4]}
                    maxBarSize={20}
                  />
                  <Line
                    yAxisId="line"
                    type="monotone"
                    dataKey="saldoAcumulado"
                    stroke="hsl(217.2 91.2% 59.8%)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
