import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { 
  Users, 
  FileText, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Clock, 
  UserCheck,
  Download,
  Building2,
  PieChart as PieChartIcon,
  BarChart3,
  AlertTriangle,
  Briefcase,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Target
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
  ComposedChart,
  Area,
  ReferenceLine
} from "recharts";

interface InvestorsReportData {
  clientes: {
    total: number;
    ativos: number;
  };
  contratos: {
    total: number;
    recorrentes: number;
    pontuais: number;
    contratosPorCliente: number;
  };
  receita: {
    mrrAtivo: number;
    aovRecorrente: number;
    faturamentoMes: number;
    taxaInadimplencia: number;
  };
  equipe: {
    headcount: number;
    tempoMedioMeses: number;
    receitaPorCabeca: number;
  };
  distribuicaoSetor: Array<{ setor: string; quantidade: number }>;
  evolucaoFaturamento: Array<{ 
    mes: string; 
    faturamento: number; 
    despesas: number;
    geracaoCaixa: number;
    inadimplencia: number;
  }>;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatCurrencyShort = (value: number) => {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(0)}K`;
  }
  return formatCurrency(value);
};

const formatPercent = (value: number) => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

type PeriodFilter = '12m' | '24m' | '36m' | 'all';

export default function InvestorsReport() {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('12m');
  
  const { data, isLoading, error } = useQuery<InvestorsReportData>({
    queryKey: ['/api/investors-report'],
  });

  const filteredData = useMemo(() => {
    if (!data?.evolucaoFaturamento) return [];
    
    const monthsToShow = periodFilter === '12m' ? 12 
      : periodFilter === '24m' ? 24 
      : periodFilter === '36m' ? 36 
      : data.evolucaoFaturamento.length;
    
    return data.evolucaoFaturamento.slice(-monthsToShow);
  }, [data?.evolucaoFaturamento, periodFilter]);

  const chartDataWithAccumulated = useMemo(() => {
    let accumulated = 0;
    return filteredData.map(item => {
      accumulated += item.geracaoCaixa;
      return {
        ...item,
        caixaAcumulado: accumulated,
        margem: item.faturamento > 0 ? ((item.geracaoCaixa / item.faturamento) * 100) : 0
      };
    });
  }, [filteredData]);

  const annualSummary = useMemo(() => {
    const byYear: Record<string, { faturamento: number; despesas: number; geracaoCaixa: number; meses: number }> = {};
    
    filteredData.forEach(item => {
      const year = item.mes.split('-')[0];
      if (!byYear[year]) {
        byYear[year] = { faturamento: 0, despesas: 0, geracaoCaixa: 0, meses: 0 };
      }
      byYear[year].faturamento += item.faturamento;
      byYear[year].despesas += item.despesas;
      byYear[year].geracaoCaixa += item.geracaoCaixa;
      byYear[year].meses += 1;
    });
    
    return Object.entries(byYear)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([year, values]) => ({
        year,
        ...values,
        margem: values.faturamento > 0 ? (values.geracaoCaixa / values.faturamento) * 100 : 0
      }));
  }, [filteredData]);

  const yoyGrowth = useMemo(() => {
    if (annualSummary.length < 2) return null;
    const currentYear = annualSummary[0];
    const previousYear = annualSummary[1];
    
    if (!previousYear || previousYear.faturamento === 0) return null;
    
    const adjustedPrevious = (previousYear.faturamento / previousYear.meses) * currentYear.meses;
    const growth = ((currentYear.faturamento - adjustedPrevious) / adjustedPrevious) * 100;
    
    return {
      growth,
      currentYear: currentYear.year,
      previousYear: previousYear.year
    };
  }, [annualSummary]);

  const totals = useMemo(() => {
    return filteredData.reduce((acc, item) => ({
      faturamento: acc.faturamento + item.faturamento,
      despesas: acc.despesas + item.despesas,
      geracaoCaixa: acc.geracaoCaixa + item.geracaoCaixa
    }), { faturamento: 0, despesas: 0, geracaoCaixa: 0 });
  }, [filteredData]);

  const handleExportPDF = async () => {
    try {
      const response = await fetch('/api/investors-report/pdf');
      if (!response.ok) throw new Error('Erro ao gerar PDF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `investors-report-${new Date().toISOString().slice(0, 7)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
    }
  };

  const pieData = data ? [
    { name: 'Recorrentes', value: data.contratos.recorrentes, color: '#3b82f6' },
    { name: 'Pontuais', value: data.contratos.pontuais, color: '#10b981' },
  ] : [];

  return (
    <div className="min-h-screen bg-background p-6" data-testid="investors-report-page">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="page-title">
              <Building2 className="h-6 w-6 text-primary" />
              Investors Report
            </h1>
            <p className="text-muted-foreground mt-1">
              Relatório consolidado de métricas para investidores
            </p>
          </div>
          <Button 
            onClick={handleExportPDF} 
            className="flex items-center gap-2"
            data-testid="button-export-pdf"
          >
            <Download className="h-4 w-4" />
            Exportar PDF
          </Button>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <span>Erro ao carregar dados: {String(error)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ROW 1: Clientes & Contratos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4">
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Users className="h-4 w-4 text-blue-500" />
                    Clientes
                  </div>
                  <div className="text-2xl font-bold" data-testid="kpi-clientes">
                    {data?.clientes.ativos || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {data?.clientes.total || 0} total cadastrados
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-indigo-500">
            <CardContent className="pt-4">
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <FileText className="h-4 w-4 text-indigo-500" />
                    Contratos Recorrentes
                  </div>
                  <div className="text-2xl font-bold" data-testid="kpi-recorrentes">
                    {data?.contratos.recorrentes || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {data?.contratos.pontuais || 0} pontuais
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="pt-4">
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    Contratos/Cliente
                  </div>
                  <div className="text-2xl font-bold" data-testid="kpi-contratos-cliente">
                    {data?.contratos.contratosPorCliente?.toFixed(2) || '0.00'}x
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {data?.contratos.total || 0} contratos totais
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="pt-4">
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <DollarSign className="h-4 w-4 text-purple-500" />
                    MRR Ativo
                  </div>
                  <div className="text-2xl font-bold" data-testid="kpi-mrr">
                    {formatCurrencyShort(data?.receita.mrrAtivo || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    AOV: {formatCurrency(data?.receita.aovRecorrente || 0)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ROW 2: Receita & Faturamento + YoY Growth */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="pt-4">
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <DollarSign className="h-4 w-4 text-emerald-500" />
                    AOV Recorrente
                  </div>
                  <div className="text-2xl font-bold" data-testid="kpi-aov">
                    {formatCurrency(data?.receita.aovRecorrente || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Ticket médio mensal
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="pt-4">
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Briefcase className="h-4 w-4 text-amber-500" />
                    Faturamento Mês
                  </div>
                  <div className="text-2xl font-bold" data-testid="kpi-faturamento">
                    {formatCurrencyShort(data?.receita.faturamentoMes || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Realizado via ERP
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardContent className="pt-4">
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Inadimplência
                  </div>
                  <div className="text-2xl font-bold" data-testid="kpi-inadimplencia">
                    {data?.receita.taxaInadimplencia?.toFixed(1) || '0.0'}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Taxa do mês atual
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-cyan-500">
            <CardContent className="pt-4">
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <UserCheck className="h-4 w-4 text-cyan-500" />
                    Colaboradores
                  </div>
                  <div className="text-2xl font-bold" data-testid="kpi-headcount">
                    {data?.equipe.headcount || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Ativos
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={`border-l-4 ${yoyGrowth && yoyGrowth.growth >= 0 ? 'border-l-green-500' : 'border-l-red-500'}`}>
            <CardContent className="pt-4">
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    {yoyGrowth && yoyGrowth.growth >= 0 ? (
                      <ArrowUpRight className="h-4 w-4 text-green-500" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-red-500" />
                    )}
                    Crescimento YoY
                  </div>
                  <div className={`text-2xl font-bold ${yoyGrowth && yoyGrowth.growth >= 0 ? 'text-green-500' : 'text-red-500'}`} data-testid="kpi-yoy">
                    {yoyGrowth ? formatPercent(yoyGrowth.growth) : 'N/A'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {yoyGrowth ? `${yoyGrowth.previousYear} → ${yoyGrowth.currentYear}` : 'Dados insuficientes'}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ROW 3: Equipe */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="pt-4">
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Clock className="h-4 w-4 text-orange-500" />
                    Tempo Médio de Casa
                  </div>
                  <div className="text-2xl font-bold" data-testid="kpi-tempo-casa">
                    {data?.equipe.tempoMedioMeses?.toFixed(1) || '0.0'} meses
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Média dos colaboradores ativos
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-pink-500">
            <CardContent className="pt-4">
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <DollarSign className="h-4 w-4 text-pink-500" />
                    Receita por Cabeça
                  </div>
                  <div className="text-2xl font-bold" data-testid="kpi-receita-cabeca">
                    {formatCurrency(data?.equipe.receitaPorCabeca || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    MRR ÷ Headcount
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-teal-500">
            <CardContent className="pt-4">
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Target className="h-4 w-4 text-teal-500" />
                    Margem Período
                  </div>
                  <div className={`text-2xl font-bold ${totals.faturamento > 0 && (totals.geracaoCaixa / totals.faturamento) >= 0 ? 'text-green-500' : 'text-red-500'}`} data-testid="kpi-margem">
                    {totals.faturamento > 0 ? ((totals.geracaoCaixa / totals.faturamento) * 100).toFixed(1) : '0.0'}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Geração de caixa / Faturamento
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Period Filter */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Análise Histórica
          </h2>
          <Tabs value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
            <TabsList className="bg-slate-800">
              <TabsTrigger value="12m" data-testid="filter-12m">12 meses</TabsTrigger>
              <TabsTrigger value="24m" data-testid="filter-24m">24 meses</TabsTrigger>
              <TabsTrigger value="36m" data-testid="filter-36m">36 meses</TabsTrigger>
              <TabsTrigger value="all" data-testid="filter-all">Todos</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Receita vs Despesas - Barras Empilhadas */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Receita vs Despesas
              </CardTitle>
              <CardDescription>Comparativo mensal com geração de caixa</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : !chartDataWithAccumulated.length ? (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  Nenhum dado encontrado
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={chartDataWithAccumulated} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis 
                      dataKey="mes" 
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => {
                        const [year, month] = value.split('-');
                        return `${month}/${year.slice(2)}`;
                      }}
                    />
                    <YAxis 
                      yAxisId="left"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => formatCurrencyShort(value)}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                      labelFormatter={(label) => {
                        const [year, month] = label.split('-');
                        return `${month}/${year}`;
                      }}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Legend />
                    <Bar 
                      yAxisId="left"
                      dataKey="faturamento" 
                      fill="#10b981" 
                      name="Faturamento"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar 
                      yAxisId="left"
                      dataKey="despesas" 
                      fill="#ef4444" 
                      name="Despesas"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="geracaoCaixa" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="Geração de Caixa"
                    />
                    <ReferenceLine yAxisId="left" y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Caixa Acumulado - Área */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Geração de Caixa Acumulada
              </CardTitle>
              <CardDescription>Evolução do caixa no período selecionado</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : !chartDataWithAccumulated.length ? (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  Nenhum dado encontrado
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={chartDataWithAccumulated} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                    <defs>
                      <linearGradient id="colorCaixa" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis 
                      dataKey="mes" 
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => {
                        const [year, month] = value.split('-');
                        return `${month}/${year.slice(2)}`;
                      }}
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => formatCurrencyShort(value)}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                      labelFormatter={(label) => {
                        const [year, month] = label.split('-');
                        return `${month}/${year}`;
                      }}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="caixaAcumulado" 
                      stroke="#3b82f6" 
                      fill="url(#colorCaixa)"
                      strokeWidth={2}
                      name="Caixa Acumulado"
                    />
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Second Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Mix de Contratos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 text-primary" />
                Mix de Contratos
              </CardTitle>
              <CardDescription>Recorrentes vs Pontuais</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : pieData.every(d => d.value === 0) ? (
                <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                  Nenhum dado encontrado
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [value, 'Contratos']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Headcount por Setor */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Headcount por Setor
              </CardTitle>
              <CardDescription>Distribuição da equipe</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : !data?.distribuicaoSetor?.length ? (
                <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                  Nenhum dado encontrado
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart 
                    data={data.distribuicaoSetor} 
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 80, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis 
                      dataKey="setor" 
                      type="category" 
                      tick={{ fontSize: 11 }}
                      width={70}
                    />
                    <Tooltip />
                    <Bar dataKey="quantidade" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Colaboradores" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Resumo Anual */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Resumo Anual
            </CardTitle>
            <CardDescription>Totais consolidados por ano</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[150px] w-full" />
            ) : !annualSummary.length ? (
              <div className="flex items-center justify-center h-[150px] text-muted-foreground">
                Nenhum dado encontrado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-muted-foreground">
                      <th className="text-left py-3 px-3 font-medium">Ano</th>
                      <th className="text-center py-3 px-3 font-medium">Meses</th>
                      <th className="text-right py-3 px-3 font-medium">Faturamento</th>
                      <th className="text-right py-3 px-3 font-medium">Despesas</th>
                      <th className="text-right py-3 px-3 font-medium">Geração Caixa</th>
                      <th className="text-right py-3 px-3 font-medium">Margem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {annualSummary.map((item, index) => (
                      <tr 
                        key={item.year}
                        className="hover:bg-muted/50"
                        data-testid={`resumo-anual-${index}`}
                      >
                        <td className="py-3 px-3 font-bold text-lg">{item.year}</td>
                        <td className="py-3 px-3 text-center">
                          <Badge variant="secondary">{item.meses}</Badge>
                        </td>
                        <td className="py-3 px-3 text-right text-green-500 font-medium">
                          {formatCurrency(item.faturamento)}
                        </td>
                        <td className="py-3 px-3 text-right text-red-500 font-medium">
                          {formatCurrency(item.despesas)}
                        </td>
                        <td className={`py-3 px-3 text-right font-bold ${item.geracaoCaixa >= 0 ? 'text-blue-500' : 'text-red-600'}`}>
                          {formatCurrency(item.geracaoCaixa)}
                        </td>
                        <td className={`py-3 px-3 text-right font-medium ${item.margem >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {item.margem.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Histórico Financeiro Mensal Detalhado */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Histórico Financeiro Mensal
            </CardTitle>
            <CardDescription>
              Detalhamento mês a mês ({filteredData.length} meses) - Total: {formatCurrency(totals.faturamento)} faturados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[350px] w-full" />
            ) : !chartDataWithAccumulated.length ? (
              <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                Nenhum dado encontrado
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[350px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background border-b z-10">
                    <tr className="text-muted-foreground">
                      <th className="text-left py-2 px-2 font-medium">Mês</th>
                      <th className="text-right py-2 px-2 font-medium">Faturamento</th>
                      <th className="text-right py-2 px-2 font-medium">Despesas</th>
                      <th className="text-right py-2 px-2 font-medium">Geração Caixa</th>
                      <th className="text-right py-2 px-2 font-medium">Margem</th>
                      <th className="text-right py-2 px-2 font-medium">Acumulado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {chartDataWithAccumulated.slice().reverse().map((item, index) => (
                      <tr 
                        key={item.mes}
                        className="hover:bg-muted/50"
                        data-testid={`historico-financeiro-${index}`}
                      >
                        <td className="py-2 px-2 font-medium">
                          {new Date(item.mes + '-01').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-2 px-2 text-right text-green-500">
                          {formatCurrencyShort(item.faturamento)}
                        </td>
                        <td className="py-2 px-2 text-right text-red-500">
                          {formatCurrencyShort(item.despesas)}
                        </td>
                        <td className={`py-2 px-2 text-right font-semibold ${item.geracaoCaixa >= 0 ? 'text-blue-500' : 'text-red-600'}`}>
                          {formatCurrencyShort(item.geracaoCaixa)}
                        </td>
                        <td className={`py-2 px-2 text-right ${item.margem >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {item.margem.toFixed(1)}%
                        </td>
                        <td className={`py-2 px-2 text-right font-medium ${item.caixaAcumulado >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                          {formatCurrencyShort(item.caixaAcumulado)}
                        </td>
                      </tr>
                    ))}
                    {/* Linha de Totais */}
                    <tr className="bg-muted/30 font-bold border-t-2">
                      <td className="py-3 px-2">TOTAL</td>
                      <td className="py-3 px-2 text-right text-green-500">
                        {formatCurrency(totals.faturamento)}
                      </td>
                      <td className="py-3 px-2 text-right text-red-500">
                        {formatCurrency(totals.despesas)}
                      </td>
                      <td className={`py-3 px-2 text-right ${totals.geracaoCaixa >= 0 ? 'text-blue-500' : 'text-red-600'}`}>
                        {formatCurrency(totals.geracaoCaixa)}
                      </td>
                      <td className={`py-3 px-2 text-right ${totals.faturamento > 0 && (totals.geracaoCaixa / totals.faturamento) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {totals.faturamento > 0 ? ((totals.geracaoCaixa / totals.faturamento) * 100).toFixed(1) : '0.0'}%
                      </td>
                      <td className="py-3 px-2 text-right text-muted-foreground">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer Quote */}
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="py-6">
            <blockquote className="text-center italic text-muted-foreground">
              "Tornamos a vida de quem vende online mais fácil e rentável, usando desse know how, para construir as marcas da próxima geração"
            </blockquote>
            <p className="text-center text-sm font-medium mt-2 text-primary">— Turbo Partners</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
