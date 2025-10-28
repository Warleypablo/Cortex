import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, TrendingDown, DollarSign, X, ChevronRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import type { FluxoCaixaItem, FluxoCaixaDiarioItem, SaldoBancos } from "@shared/schema";

export default function DashboardFinanceiro() {
  const [periodoMeses, setPeriodoMeses] = useState(6);
  const [mesSelecionado, setMesSelecionado] = useState<{ ano: number; mes: number; mesAno: string } | null>(null);

  const { data: saldoData, isLoading: isLoadingSaldo } = useQuery<SaldoBancos>({
    queryKey: ["/api/dashboard/saldo-atual"],
  });

  const { data: fluxoCaixaData, isLoading: isLoadingFluxo } = useQuery<FluxoCaixaItem[]>({
    queryKey: ["/api/dashboard/fluxo-caixa"],
  });

  const { data: fluxoCaixaDiarioData, isLoading: isLoadingDiario } = useQuery<FluxoCaixaDiarioItem[]>({
    queryKey: ["/api/dashboard/fluxo-caixa-diario", mesSelecionado?.ano, mesSelecionado?.mes],
    enabled: mesSelecionado !== null,
  });

  const fluxoCaixaFiltrado = useMemo(() => {
    if (!fluxoCaixaData) return [];
    
    const dataLimite = new Date();
    dataLimite.setMonth(dataLimite.getMonth() - periodoMeses);
    
    return fluxoCaixaData.filter(item => {
      const dataVencimento = new Date(item.dataVencimento);
      return dataVencimento >= dataLimite;
    });
  }, [fluxoCaixaData, periodoMeses]);

  const chartData = useMemo(() => {
    if (!fluxoCaixaFiltrado.length) return [];
    
    const groupedByMonth: Record<string, { mes: string; receitas: number; despesas: number }> = {};
    
    fluxoCaixaFiltrado.forEach(item => {
      const data = new Date(item.dataVencimento);
      const mesAno = `${String(data.getMonth() + 1).padStart(2, '0')}/${data.getFullYear()}`;
      
      if (!groupedByMonth[mesAno]) {
        groupedByMonth[mesAno] = { mes: mesAno, receitas: 0, despesas: 0 };
      }
      
      if (item.tipoEvento === 'RECEITA') {
        groupedByMonth[mesAno].receitas += item.valorBruto;
      } else if (item.tipoEvento === 'DESPESA') {
        groupedByMonth[mesAno].despesas += item.valorBruto;
      }
    });
    
    return Object.values(groupedByMonth)
      .sort((a, b) => {
        const [mesA, anoA] = a.mes.split('/').map(Number);
        const [mesB, anoB] = b.mes.split('/').map(Number);
        return anoA === anoB ? mesA - mesB : anoA - anoB;
      });
  }, [fluxoCaixaFiltrado]);

  const totalReceitas = useMemo(() => {
    return fluxoCaixaFiltrado
      .filter(item => item.tipoEvento === 'RECEITA')
      .reduce((sum, item) => sum + item.valorBruto, 0);
  }, [fluxoCaixaFiltrado]);

  const totalDespesas = useMemo(() => {
    return fluxoCaixaFiltrado
      .filter(item => item.tipoEvento === 'DESPESA')
      .reduce((sum, item) => sum + item.valorBruto, 0);
  }, [fluxoCaixaFiltrado]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleBarClick = (data: any) => {
    if (data && data.mes) {
      const [mes, ano] = data.mes.split('/').map(Number);
      setMesSelecionado({ ano, mes, mesAno: data.mes });
    }
  };

  const handleLimparSelecao = () => {
    setMesSelecionado(null);
  };

  const getNomeMes = (mesAno: string) => {
    const [mes, ano] = mesAno.split('/');
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${meses[parseInt(mes) - 1]} ${ano}`;
  };

  const isLoading = isLoadingSaldo || isLoadingFluxo;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loading-dashboard" />
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2" data-testid="text-title">Dashboard Financeiro</h1>
          <p className="text-muted-foreground">Visão geral do fluxo de caixa e saldo bancário</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card data-testid="card-saldo">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-saldo">
                {formatCurrency(saldoData?.saldoTotal || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Soma de todas as contas bancárias</p>
            </CardContent>
          </Card>

          <Card data-testid="card-receitas">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Receitas</CardTitle>
              <TrendingUp className="w-4 h-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-receitas">
                {formatCurrency(totalReceitas)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Últimos {periodoMeses} meses</p>
            </CardContent>
          </Card>

          <Card data-testid="card-despesas">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Despesas</CardTitle>
              <TrendingDown className="w-4 h-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600" data-testid="text-despesas">
                {formatCurrency(totalDespesas)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Últimos {periodoMeses} meses</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle data-testid="text-chart-title">Fluxo de Caixa - Visão Mensal</CardTitle>
                <CardDescription>Clique em um mês para ver detalhamento diário</CardDescription>
              </div>
              <Select value={periodoMeses.toString()} onValueChange={(value) => setPeriodoMeses(Number(value))}>
                <SelectTrigger className="w-[180px]" data-testid="select-periodo">
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">Últimos 3 meses</SelectItem>
                  <SelectItem value="6">Últimos 6 meses</SelectItem>
                  <SelectItem value="12">Últimos 12 meses</SelectItem>
                  <SelectItem value="24">Últimos 24 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData} data-testid="chart-fluxo-caixa" onClick={handleBarClick}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="mes" 
                    className="text-sm"
                    tick={{ fill: 'currentColor' }}
                  />
                  <YAxis 
                    className="text-sm"
                    tick={{ fill: 'currentColor' }}
                    tickFormatter={(value) => formatCurrency(value)}
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Legend />
                  <Bar 
                    dataKey="receitas" 
                    name="Receitas" 
                    fill="#16a34a" 
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                  >
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-receita-${index}`} 
                        opacity={mesSelecionado?.mesAno === entry.mes ? 1 : 0.7}
                      />
                    ))}
                  </Bar>
                  <Bar 
                    dataKey="despesas" 
                    name="Despesas" 
                    fill="#dc2626" 
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                  >
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-despesa-${index}`} 
                        opacity={mesSelecionado?.mesAno === entry.mes ? 1 : 0.7}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[400px]" data-testid="text-no-data">
                <p className="text-muted-foreground">Nenhum dado disponível para o período selecionado</p>
              </div>
            )}
          </CardContent>
        </Card>

        {mesSelecionado && (
          <Card data-testid="card-detalhamento-diario">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <span>Visão Mensal</span>
                    <ChevronRight className="w-4 h-4" />
                    <span className="text-foreground font-medium">{getNomeMes(mesSelecionado.mesAno)}</span>
                  </div>
                  <CardTitle data-testid="text-detalhamento-title">Detalhamento Diário</CardTitle>
                  <CardDescription>Receitas e despesas dia a dia</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLimparSelecao}
                  data-testid="button-limpar-selecao"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingDiario ? (
                <div className="flex items-center justify-center h-[400px]">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loading-diario" />
                </div>
              ) : fluxoCaixaDiarioData && fluxoCaixaDiarioData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={fluxoCaixaDiarioData} data-testid="chart-fluxo-caixa-diario">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="dia" 
                      className="text-sm"
                      tick={{ fill: 'currentColor', fontSize: 11 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      className="text-sm"
                      tick={{ fill: 'currentColor' }}
                      tickFormatter={(value) => formatCurrency(value)}
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                    />
                    <Legend />
                    <Bar 
                      dataKey="receitas" 
                      name="Receitas" 
                      fill="#16a34a" 
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar 
                      dataKey="despesas" 
                      name="Despesas" 
                      fill="#dc2626" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[400px]" data-testid="text-no-data-diario">
                  <p className="text-muted-foreground">Nenhum dado disponível para este mês</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
