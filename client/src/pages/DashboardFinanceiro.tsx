import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, TrendingUp, TrendingDown, DollarSign, X, ChevronRight, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ComposedChart, Line } from "recharts";
import type { FluxoCaixaItem, FluxoCaixaDiarioItem, SaldoBancos, TransacaoDiaItem } from "@shared/schema";

export default function DashboardFinanceiro() {
  const [periodoMeses, setPeriodoMeses] = useState(6);
  const [mesSelecionado, setMesSelecionado] = useState<{ ano: number; mes: number; mesAno: string } | null>(null);
  const [diaSelecionado, setDiaSelecionado] = useState<{ ano: number; mes: number; dia: number; diaFormatado: string } | null>(null);
  const [mesVisaoGeral, setMesVisaoGeral] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    setDiaSelecionado(null);
  }, [mesSelecionado]);

  const { data: saldoData, isLoading: isLoadingSaldo } = useQuery<SaldoBancos>({
    queryKey: ["/api/dashboard/saldo-atual"],
  });

  const { data: fluxoCaixaData, isLoading: isLoadingFluxo } = useQuery<FluxoCaixaItem[]>({
    queryKey: ["/api/dashboard/fluxo-caixa"],
  });

  const { data: fluxoCaixaDiarioData, isLoading: isLoadingDiario } = useQuery<FluxoCaixaDiarioItem[]>({
    queryKey: ["/api/dashboard/fluxo-caixa-diario", mesSelecionado?.ano, mesSelecionado?.mes],
    queryFn: async () => {
      if (!mesSelecionado) return [];
      const response = await fetch(`/api/dashboard/fluxo-caixa-diario?ano=${mesSelecionado.ano}&mes=${mesSelecionado.mes}`);
      if (!response.ok) throw new Error('Failed to fetch daily cash flow');
      return response.json();
    },
    enabled: mesSelecionado !== null,
  });

  const { data: transacoesDiaData, isLoading: isLoadingTransacoes } = useQuery<TransacaoDiaItem[]>({
    queryKey: ["/api/dashboard/transacoes-dia", diaSelecionado?.ano, diaSelecionado?.mes, diaSelecionado?.dia],
    queryFn: async () => {
      if (!diaSelecionado) return [];
      const response = await fetch(`/api/dashboard/transacoes-dia?ano=${diaSelecionado.ano}&mes=${diaSelecionado.mes}&dia=${diaSelecionado.dia}`);
      if (!response.ok) throw new Error('Failed to fetch transactions');
      return response.json();
    },
    enabled: diaSelecionado !== null,
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
    if (data && data.payload && data.payload.mes) {
      const [mes, ano] = data.payload.mes.split('/').map(Number);
      setMesSelecionado({ ano, mes, mesAno: data.payload.mes });
    }
  };

  const handleLimparSelecao = () => {
    setMesSelecionado(null);
  };

  const handleDiaClick = (data: any) => {
    if (data && data.payload && data.payload.dia && mesSelecionado) {
      const [dia, mes, ano] = data.payload.dia.split('/').map(Number);
      setDiaSelecionado({ ano, mes, dia, diaFormatado: data.payload.dia });
    }
  };

  const handleLimparDia = () => {
    setDiaSelecionado(null);
  };

  const getNomeMes = (mesAno: string) => {
    const [mes, ano] = mesAno.split('/');
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${meses[parseInt(mes) - 1]} ${ano}`;
  };

  const getUltimos6Meses = () => {
    const meses = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const data = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mesAno = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
      const mesNome = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ][data.getMonth()];
      meses.push({ valor: mesAno, label: `${mesNome} ${data.getFullYear()}` });
    }
    return meses;
  };

  const getMockDataVisaoGeral = (mesRef: string) => {
    const mesesDisponiveis = getUltimos6Meses().map(m => m.valor);
    const indice = mesesDisponiveis.indexOf(mesRef);
    
    const multiplier = indice >= 0 ? 1.0 - ((mesesDisponiveis.length - 1 - indice) * 0.03) : 0.90;
    
    return {
      mrrAtivo: 450000 * multiplier,
      aquisicaoMrr: 85000 * multiplier,
      aquisicaoPontual: 120000 * multiplier,
      entreguePontual: 95000 * multiplier,
      churnReais: 25000 * multiplier,
      churnPercentual: 5.5,
    };
  };

  const mockDataVisaoGeral = useMemo(() => getMockDataVisaoGeral(mesVisaoGeral), [mesVisaoGeral]);

  const mockMrrEvolution = [
    { mes: mesVisaoGeral, mrr: mockDataVisaoGeral.mrrAtivo }
  ];

  const mockTopResponsaveis = [
    { nome: 'João Silva', mrr: 125000, posicao: 1 },
    { nome: 'Maria Santos', mrr: 98000, posicao: 2 },
    { nome: 'Pedro Costa', mrr: 87000, posicao: 3 },
    { nome: 'Ana Oliveira', mrr: 72000, posicao: 4 },
    { nome: 'Carlos Souza', mrr: 68000, posicao: 5 },
  ];

  const mockMrrSquad = [
    { squad: 'Supreme', mrr: 145000, cor: '#3b82f6' },
    { squad: 'Forja', mrr: 132000, cor: '#a855f7' },
    { squad: 'Squadra', mrr: 108000, cor: '#14b8a6' },
    { squad: 'Chama', mrr: 65000, cor: '#f97316' },
  ];

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

        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold">Visão Geral</h2>
              <p className="text-sm text-muted-foreground mt-1">Métricas de MRR e performance</p>
            </div>
            <Select value={mesVisaoGeral} onValueChange={setMesVisaoGeral}>
              <SelectTrigger className="w-[200px]" data-testid="select-mes-visao-geral">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getUltimos6Meses().map(m => (
                  <SelectItem key={m.valor} value={m.valor}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <Card data-testid="card-mrr-ativo">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">MRR Ativo</CardTitle>
                <DollarSign className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-mrr-ativo">
                  {formatCurrency(mockDataVisaoGeral.mrrAtivo)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Receita recorrente mensal</p>
              </CardContent>
            </Card>

            <Card data-testid="card-aquisicao-mrr">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Aquisição MRR</CardTitle>
                <TrendingUp className="w-4 h-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600" data-testid="text-aquisicao-mrr">
                  {formatCurrency(mockDataVisaoGeral.aquisicaoMrr)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Novos contratos recorrentes</p>
              </CardContent>
            </Card>

            <Card data-testid="card-aquisicao-pontual">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Aquisição Pontual</CardTitle>
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600" data-testid="text-aquisicao-pontual">
                  {formatCurrency(mockDataVisaoGeral.aquisicaoPontual)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Novos contratos pontuais</p>
              </CardContent>
            </Card>

            <Card data-testid="card-entregue-pontual">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Entregue Pontual</CardTitle>
                <TrendingUp className="w-4 h-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600" data-testid="text-entregue-pontual">
                  {formatCurrency(mockDataVisaoGeral.entreguePontual)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Serviços pontuais concluídos</p>
              </CardContent>
            </Card>

            <Card data-testid="card-churn">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Churn R$</CardTitle>
                <TrendingDown className="w-4 h-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600" data-testid="text-churn-reais">
                  {formatCurrency(mockDataVisaoGeral.churnReais)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {mockDataVisaoGeral.churnPercentual}% de perda
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="lg:col-span-2" data-testid="card-evolucao-mrr">
              <CardHeader>
                <CardTitle>Evolução MRR Mensal</CardTitle>
                <CardDescription>Histórico de receita recorrente mensal</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={mockMrrEvolution}>
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
                      formatter={(value: number) => [formatCurrency(value), 'MRR']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                    />
                    <Bar dataKey="mrr" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card data-testid="card-top-responsaveis">
              <CardHeader>
                <CardTitle>Top 5 Responsáveis</CardTitle>
                <CardDescription>Líderes em MRR gerenciado</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockTopResponsaveis.map((resp, idx) => (
                    <div 
                      key={resp.nome} 
                      className="flex items-center justify-between p-3 rounded-lg hover-elevate"
                      data-testid={`row-responsavel-${idx + 1}`}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className={`
                            flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm
                            ${idx === 0 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' : ''}
                            ${idx === 1 ? 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300' : ''}
                            ${idx === 2 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' : ''}
                            ${idx > 2 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : ''}
                          `}
                        >
                          {resp.posicao}º
                        </div>
                        <span className="font-medium">{resp.nome}</span>
                      </div>
                      <span className="font-bold text-primary">{formatCurrency(resp.mrr)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-mrr-squad">
              <CardHeader>
                <CardTitle>MRR por Squad</CardTitle>
                <CardDescription>Distribuição de receita por equipe</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={mockMrrSquad} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      type="number"
                      className="text-sm"
                      tick={{ fill: 'currentColor' }}
                      tickFormatter={(value) => formatCurrency(value)}
                    />
                    <YAxis 
                      type="category"
                      dataKey="squad"
                      className="text-sm"
                      tick={{ fill: 'currentColor' }}
                      width={80}
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'MRR']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                    />
                    <Bar dataKey="mrr" radius={[0, 8, 8, 0]}>
                      {mockMrrSquad.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.cor} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
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
                <BarChart data={chartData} data-testid="chart-fluxo-caixa">
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
                    onClick={handleBarClick}
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
                    onClick={handleBarClick}
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
                <div className="w-full overflow-x-auto">
                  <ResponsiveContainer width={Math.max(fluxoCaixaDiarioData.length * 60, 800)} height={400}>
                    <ComposedChart data={fluxoCaixaDiarioData} data-testid="chart-fluxo-caixa-diario">
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
                        yAxisId="left"
                        className="text-sm"
                        tick={{ fill: 'currentColor' }}
                        tickFormatter={(value) => formatCurrency(value)}
                      />
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        className="text-sm"
                        tick={{ fill: 'currentColor' }}
                        tickFormatter={(value) => formatCurrency(value)}
                      />
                      <Tooltip 
                        formatter={(value: number, name: string) => [formatCurrency(value), name === 'saldoAcumulado' ? 'Saldo Acumulado' : name]}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                        }}
                      />
                      <Legend />
                      <Bar 
                        yAxisId="left"
                        dataKey="receitas" 
                        name="Receitas" 
                        fill="#16a34a" 
                        radius={[4, 4, 0, 0]}
                        cursor="pointer"
                        onClick={handleDiaClick}
                      >
                        {fluxoCaixaDiarioData.map((entry, index) => (
                          <Cell 
                            key={`cell-receita-${index}`} 
                            opacity={diaSelecionado?.diaFormatado === entry.dia ? 1 : 0.7}
                          />
                        ))}
                      </Bar>
                      <Bar 
                        yAxisId="left"
                        dataKey="despesas" 
                        name="Despesas" 
                        fill="#dc2626" 
                        radius={[4, 4, 0, 0]}
                        cursor="pointer"
                        onClick={handleDiaClick}
                      >
                        {fluxoCaixaDiarioData.map((entry, index) => (
                          <Cell 
                            key={`cell-despesa-${index}`} 
                            opacity={diaSelecionado?.diaFormatado === entry.dia ? 1 : 0.7}
                          />
                        ))}
                      </Bar>
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="saldoAcumulado" 
                        name="Saldo Acumulado"
                        stroke="#1d4ed8" 
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[400px]" data-testid="text-no-data-diario">
                  <p className="text-muted-foreground">Nenhum dado disponível para este mês</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {diaSelecionado && (
          <Card data-testid="card-transacoes-dia">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <span>Visão Mensal</span>
                    <ChevronRight className="w-4 h-4" />
                    <span>{getNomeMes(mesSelecionado!.mesAno)}</span>
                    <ChevronRight className="w-4 h-4" />
                    <span className="text-foreground font-medium">{diaSelecionado.diaFormatado}</span>
                  </div>
                  <CardTitle data-testid="text-transacoes-title">Transações do Dia</CardTitle>
                  <CardDescription>Detalhamento completo de receitas e despesas</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLimparDia}
                  data-testid="button-limpar-dia"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingTransacoes ? (
                <div className="flex items-center justify-center h-[200px]">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loading-transacoes" />
                </div>
              ) : transacoesDiaData && transacoesDiaData.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]" data-testid="header-tipo">Tipo</TableHead>
                        <TableHead data-testid="header-descricao">Descrição</TableHead>
                        <TableHead data-testid="header-empresa">Empresa</TableHead>
                        <TableHead className="text-right" data-testid="header-valor">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transacoesDiaData.map((transacao) => (
                        <TableRow key={transacao.id} data-testid={`row-transacao-${transacao.id}`}>
                          <TableCell data-testid={`cell-tipo-${transacao.id}`}>
                            <div className="flex items-center gap-2">
                              {transacao.tipoEvento === 'RECEITA' ? (
                                <>
                                  <ArrowUpCircle className="w-4 h-4 text-green-600" />
                                  <span className="text-green-600 font-medium">Receita</span>
                                </>
                              ) : (
                                <>
                                  <ArrowDownCircle className="w-4 h-4 text-red-600" />
                                  <span className="text-red-600 font-medium">Despesa</span>
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell data-testid={`cell-descricao-${transacao.id}`}>
                            {transacao.descricao || 'Sem descrição'}
                          </TableCell>
                          <TableCell data-testid={`cell-empresa-${transacao.id}`}>
                            {transacao.empresa || '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium" data-testid={`cell-valor-${transacao.id}`}>
                            <span className={transacao.tipoEvento === 'RECEITA' ? 'text-green-600' : 'text-red-600'}>
                              {transacao.tipoEvento === 'RECEITA' ? '+' : '-'} {formatCurrency(transacao.valorBruto)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[200px]" data-testid="text-no-transacoes">
                  <p className="text-muted-foreground">Nenhuma transação encontrada para este dia</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
