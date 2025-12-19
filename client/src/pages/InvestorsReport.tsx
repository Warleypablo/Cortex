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
  Target,
  Percent,
  Activity
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

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4'];

type YearFilter = '2022' | '2023' | '2024' | '2025' | 'all';

export default function InvestorsReport() {
  const [yearFilter, setYearFilter] = useState<YearFilter>('all');
  
  const { data, isLoading, error } = useQuery<InvestorsReportData>({
    queryKey: ['/api/investors-report'],
  });

  const filteredData = useMemo(() => {
    if (!data?.evolucaoFaturamento) return [];
    
    return data.evolucaoFaturamento.filter(item => {
      const year = parseInt(item.mes.split('-')[0]);
      if (year < 2022 || year > 2025) return false;
      if (yearFilter === 'all') return true;
      return item.mes.startsWith(yearFilter);
    });
  }, [data?.evolucaoFaturamento, yearFilter]);

  const chartDataWithMetrics = useMemo(() => {
    let accumulated = 0;
    return filteredData.map(item => {
      accumulated += item.geracaoCaixa;
      const margem = item.faturamento > 0 ? ((item.geracaoCaixa / item.faturamento) * 100) : 0;
      return {
        ...item,
        caixaAcumulado: accumulated,
        margem: Math.round(margem * 10) / 10,
        mesLabel: (() => {
          const [year, month] = item.mes.split('-');
          const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
          return `${monthNames[parseInt(month) - 1]}/${year.slice(2)}`;
        })()
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

  const avgMargem = useMemo(() => {
    if (chartDataWithMetrics.length === 0) return 0;
    const sum = chartDataWithMetrics.reduce((acc, item) => acc + item.margem, 0);
    return sum / chartDataWithMetrics.length;
  }, [chartDataWithMetrics]);

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
    { name: 'Recorrentes', value: data.contratos.recorrentes, color: '#f97316' },
    { name: 'Pontuais', value: data.contratos.pontuais, color: '#3b82f6' },
  ] : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6" data-testid="investors-report-page">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-orange-500/20 via-orange-600/10 to-transparent border border-orange-500/20 p-6">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-transparent" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3 text-white" data-testid="page-title">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <Building2 className="h-7 w-7 text-orange-400" />
                </div>
                Investors Report
              </h1>
              <p className="text-slate-400 mt-2 text-lg">
                Métricas financeiras consolidadas • 2022-2025
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-orange-500/50 text-orange-400 px-3 py-1">
                <Activity className="h-3 w-3 mr-1" />
                Live Data
              </Badge>
              <Button 
                onClick={handleExportPDF} 
                className="bg-orange-500 hover:bg-orange-600 text-white"
                data-testid="button-export-pdf"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <Card className="border-red-500/50 bg-red-500/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="h-5 w-5" />
                <span>Erro ao carregar dados: {String(error)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPIs Row 1 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-slate-900/50 border-slate-700/50 hover:border-blue-500/30 transition-colors">
            <CardContent className="pt-5 pb-4">
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-500/20 rounded">
                      <Users className="h-4 w-4 text-blue-400" />
                    </div>
                    <span className="text-slate-400 text-sm">Clientes Ativos</span>
                  </div>
                  <div className="text-3xl font-bold text-white" data-testid="kpi-clientes">
                    {data?.clientes.ativos || 0}
                  </div>
                  <div className="text-xs text-slate-500">
                    de {data?.clientes.total || 0} cadastrados
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700/50 hover:border-orange-500/30 transition-colors">
            <CardContent className="pt-5 pb-4">
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-orange-500/20 rounded">
                      <FileText className="h-4 w-4 text-orange-400" />
                    </div>
                    <span className="text-slate-400 text-sm">Contratos Rec.</span>
                  </div>
                  <div className="text-3xl font-bold text-white" data-testid="kpi-recorrentes">
                    {data?.contratos.recorrentes || 0}
                  </div>
                  <div className="text-xs text-slate-500">
                    {data?.contratos.pontuais || 0} pontuais
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700/50 hover:border-purple-500/30 transition-colors">
            <CardContent className="pt-5 pb-4">
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-purple-500/20 rounded">
                      <DollarSign className="h-4 w-4 text-purple-400" />
                    </div>
                    <span className="text-slate-400 text-sm">MRR Ativo</span>
                  </div>
                  <div className="text-3xl font-bold text-white" data-testid="kpi-mrr">
                    {formatCurrencyShort(data?.receita.mrrAtivo || 0)}
                  </div>
                  <div className="text-xs text-slate-500">
                    AOV: {formatCurrency(data?.receita.aovRecorrente || 0)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700/50 hover:border-emerald-500/30 transition-colors">
            <CardContent className="pt-5 pb-4">
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-500/20 rounded">
                      <Briefcase className="h-4 w-4 text-emerald-400" />
                    </div>
                    <span className="text-slate-400 text-sm">Fat. Mês Atual</span>
                  </div>
                  <div className="text-3xl font-bold text-white" data-testid="kpi-faturamento">
                    {formatCurrencyShort(data?.receita.faturamentoMes || 0)}
                  </div>
                  <div className="text-xs text-slate-500">
                    Realizado ERP
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={`bg-slate-900/50 border-slate-700/50 hover:border-green-500/30 transition-colors`}>
            <CardContent className="pt-5 pb-4">
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded ${yoyGrowth && yoyGrowth.growth >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                      {yoyGrowth && yoyGrowth.growth >= 0 ? (
                        <ArrowUpRight className="h-4 w-4 text-green-400" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-red-400" />
                      )}
                    </div>
                    <span className="text-slate-400 text-sm">Cresc. YoY</span>
                  </div>
                  <div className={`text-3xl font-bold ${yoyGrowth && yoyGrowth.growth >= 0 ? 'text-green-400' : 'text-red-400'}`} data-testid="kpi-yoy">
                    {yoyGrowth ? formatPercent(yoyGrowth.growth) : 'N/A'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {yoyGrowth ? `${yoyGrowth.previousYear} → ${yoyGrowth.currentYear}` : 'Dados insuf.'}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* KPIs Row 2 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="pt-5 pb-4">
              {isLoading ? (
                <Skeleton className="h-14 w-full" />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-red-500/20 rounded">
                      <AlertTriangle className="h-4 w-4 text-red-400" />
                    </div>
                    <span className="text-slate-400 text-sm">Inadimplência</span>
                  </div>
                  <div className="text-2xl font-bold text-red-400" data-testid="kpi-inadimplencia">
                    {data?.receita.taxaInadimplencia?.toFixed(1) || '0.0'}%
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="pt-5 pb-4">
              {isLoading ? (
                <Skeleton className="h-14 w-full" />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-cyan-500/20 rounded">
                      <UserCheck className="h-4 w-4 text-cyan-400" />
                    </div>
                    <span className="text-slate-400 text-sm">Headcount</span>
                  </div>
                  <div className="text-2xl font-bold text-white" data-testid="kpi-headcount">
                    {data?.equipe.headcount || 0} <span className="text-sm text-slate-500 font-normal">pessoas</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="pt-5 pb-4">
              {isLoading ? (
                <Skeleton className="h-14 w-full" />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-pink-500/20 rounded">
                      <DollarSign className="h-4 w-4 text-pink-400" />
                    </div>
                    <span className="text-slate-400 text-sm">Receita/Cabeça</span>
                  </div>
                  <div className="text-2xl font-bold text-white" data-testid="kpi-receita-cabeca">
                    {formatCurrency(data?.equipe.receitaPorCabeca || 0)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="pt-5 pb-4">
              {isLoading ? (
                <Skeleton className="h-14 w-full" />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded ${avgMargem >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                      <Percent className="h-4 w-4" style={{ color: avgMargem >= 0 ? '#4ade80' : '#f87171' }} />
                    </div>
                    <span className="text-slate-400 text-sm">Margem Média</span>
                  </div>
                  <div className={`text-2xl font-bold ${avgMargem >= 0 ? 'text-green-400' : 'text-red-400'}`} data-testid="kpi-margem">
                    {avgMargem.toFixed(1)}%
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Year Filter */}
        <div className="flex items-center justify-between bg-slate-900/30 rounded-lg p-4 border border-slate-700/30">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-orange-400" />
            <span className="text-white font-medium">Período de Análise</span>
            <Badge variant="secondary" className="bg-slate-700 text-slate-300">
              {chartDataWithMetrics.length} meses
            </Badge>
          </div>
          <Tabs value={yearFilter} onValueChange={(v) => setYearFilter(v as YearFilter)}>
            <TabsList className="bg-slate-800 border border-slate-700">
              <TabsTrigger value="2022" data-testid="filter-2022" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">2022</TabsTrigger>
              <TabsTrigger value="2023" data-testid="filter-2023" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">2023</TabsTrigger>
              <TabsTrigger value="2024" data-testid="filter-2024" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">2024</TabsTrigger>
              <TabsTrigger value="2025" data-testid="filter-2025" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">2025</TabsTrigger>
              <TabsTrigger value="all" data-testid="filter-all" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">2022-2025</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Charts Row 1: Faturamento Evolution + Margem */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Evolução do Faturamento */}
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2 text-white">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                Evolução do Faturamento
              </CardTitle>
              <CardDescription className="text-slate-400">Receita mensal ao longo do tempo</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : !chartDataWithMetrics.length ? (
                <div className="flex items-center justify-center h-[280px] text-slate-500">
                  Nenhum dado no período
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartDataWithMetrics} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                    <defs>
                      <linearGradient id="gradientFat" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                    <XAxis dataKey="mesLabel" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => formatCurrencyShort(v)} />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      labelStyle={{ color: '#f8fafc' }}
                    />
                    <Area type="monotone" dataKey="faturamento" stroke="#10b981" fill="url(#gradientFat)" strokeWidth={0} />
                    <Line type="monotone" dataKey="faturamento" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Evolução da Margem */}
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2 text-white">
                <Percent className="h-5 w-5 text-blue-400" />
                Evolução da Margem
              </CardTitle>
              <CardDescription className="text-slate-400">Margem operacional mensal (%)</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : !chartDataWithMetrics.length ? (
                <div className="flex items-center justify-center h-[280px] text-slate-500">
                  Nenhum dado no período
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={chartDataWithMetrics} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                    <defs>
                      <linearGradient id="gradientMargem" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                    <XAxis dataKey="mesLabel" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `${v}%`} domain={['auto', 'auto']} />
                    <Tooltip 
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Margem']}
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      labelStyle={{ color: '#f8fafc' }}
                    />
                    <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1.5} />
                    <ReferenceLine y={avgMargem} stroke="#f97316" strokeDasharray="5 5" strokeWidth={1} label={{ value: `Média: ${avgMargem.toFixed(1)}%`, position: 'right', fill: '#f97316', fontSize: 10 }} />
                    <Area type="monotone" dataKey="margem" stroke="#3b82f6" fill="url(#gradientMargem)" strokeWidth={0} />
                    <Line type="monotone" dataKey="margem" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6' }} activeDot={{ r: 5 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2: Receita vs Despesas + Caixa Acumulado */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Receita vs Despesas */}
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2 text-white">
                <BarChart3 className="h-5 w-5 text-orange-400" />
                Receita vs Despesas
              </CardTitle>
              <CardDescription className="text-slate-400">Comparativo mensal</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : !chartDataWithMetrics.length ? (
                <div className="flex items-center justify-center h-[280px] text-slate-500">
                  Nenhum dado no período
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={chartDataWithMetrics} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                    <XAxis dataKey="mesLabel" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => formatCurrencyShort(v)} />
                    <Tooltip 
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      labelStyle={{ color: '#f8fafc' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    <Bar dataKey="faturamento" fill="#10b981" name="Faturamento" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="despesas" fill="#ef4444" name="Despesas" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="geracaoCaixa" stroke="#f97316" strokeWidth={2.5} dot={{ r: 3, fill: '#f97316' }} name="Geração Caixa" />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Caixa Acumulado */}
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2 text-white">
                <TrendingUp className="h-5 w-5 text-purple-400" />
                Geração de Caixa Acumulada
              </CardTitle>
              <CardDescription className="text-slate-400">Evolução do caixa no período</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : !chartDataWithMetrics.length ? (
                <div className="flex items-center justify-center h-[280px] text-slate-500">
                  Nenhum dado no período
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={chartDataWithMetrics} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                    <defs>
                      <linearGradient id="gradientCaixa" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                    <XAxis dataKey="mesLabel" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => formatCurrencyShort(v)} />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Caixa Acumulado']}
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      labelStyle={{ color: '#f8fafc' }}
                    />
                    <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="caixaAcumulado" stroke="#8b5cf6" fill="url(#gradientCaixa)" strokeWidth={2.5} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 3: Mix Contratos + Headcount */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2 text-white">
                <PieChartIcon className="h-5 w-5 text-orange-400" />
                Mix de Contratos
              </CardTitle>
              <CardDescription className="text-slate-400">Recorrentes vs Pontuais</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[250px] w-full" />
              ) : pieData.every(d => d.value === 0) ? (
                <div className="flex items-center justify-center h-[250px] text-slate-500">
                  Nenhum dado encontrado
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      labelLine={{ stroke: '#64748b' }}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [value, 'Contratos']} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2 text-white">
                <Users className="h-5 w-5 text-cyan-400" />
                Headcount por Setor
              </CardTitle>
              <CardDescription className="text-slate-400">Distribuição da equipe</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[250px] w-full" />
              ) : !data?.distribuicaoSetor?.length ? (
                <div className="flex items-center justify-center h-[250px] text-slate-500">
                  Nenhum dado encontrado
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.distribuicaoSetor} layout="vertical" margin={{ top: 10, right: 30, left: 70, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis dataKey="setor" type="category" tick={{ fontSize: 11, fill: '#94a3b8' }} width={65} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                    <Bar dataKey="quantidade" fill="#06b6d4" radius={[0, 4, 4, 0]} name="Colaboradores" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Resumo Anual */}
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2 text-white">
              <Calendar className="h-5 w-5 text-orange-400" />
              Resumo por Ano
            </CardTitle>
            <CardDescription className="text-slate-400">Totais consolidados</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[120px] w-full" />
            ) : !annualSummary.length ? (
              <div className="flex items-center justify-center h-[120px] text-slate-500">
                Nenhum dado no período
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-700">
                    <tr className="text-slate-400">
                      <th className="text-left py-3 px-4 font-medium">Ano</th>
                      <th className="text-center py-3 px-4 font-medium">Meses</th>
                      <th className="text-right py-3 px-4 font-medium">Faturamento</th>
                      <th className="text-right py-3 px-4 font-medium">Despesas</th>
                      <th className="text-right py-3 px-4 font-medium">Geração Caixa</th>
                      <th className="text-right py-3 px-4 font-medium">Margem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {annualSummary.map((item) => (
                      <tr key={item.year} className="hover:bg-slate-800/50 transition-colors" data-testid={`resumo-anual-${item.year}`}>
                        <td className="py-3 px-4 font-bold text-xl text-white">{item.year}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant="secondary" className="bg-slate-700">{item.meses}</Badge>
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-400 font-medium">{formatCurrency(item.faturamento)}</td>
                        <td className="py-3 px-4 text-right text-red-400 font-medium">{formatCurrency(item.despesas)}</td>
                        <td className={`py-3 px-4 text-right font-bold ${item.geracaoCaixa >= 0 ? 'text-blue-400' : 'text-red-500'}`}>
                          {formatCurrency(item.geracaoCaixa)}
                        </td>
                        <td className={`py-3 px-4 text-right font-medium ${item.margem >= 0 ? 'text-green-400' : 'text-red-400'}`}>
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

        {/* Histórico Mensal */}
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2 text-white">
              <BarChart3 className="h-5 w-5 text-blue-400" />
              Histórico Mensal Detalhado
            </CardTitle>
            <CardDescription className="text-slate-400">
              {chartDataWithMetrics.length} meses • Total: {formatCurrency(totals.faturamento)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : !chartDataWithMetrics.length ? (
              <div className="flex items-center justify-center h-[300px] text-slate-500">
                Nenhum dado no período
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[320px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-900 border-b border-slate-700 z-10">
                    <tr className="text-slate-400">
                      <th className="text-left py-2 px-3 font-medium">Mês</th>
                      <th className="text-right py-2 px-3 font-medium">Faturamento</th>
                      <th className="text-right py-2 px-3 font-medium">Despesas</th>
                      <th className="text-right py-2 px-3 font-medium">Geração Caixa</th>
                      <th className="text-right py-2 px-3 font-medium">Margem</th>
                      <th className="text-right py-2 px-3 font-medium">Acumulado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {chartDataWithMetrics.slice().reverse().map((item, index) => (
                      <tr key={item.mes} className="hover:bg-slate-800/50" data-testid={`historico-${index}`}>
                        <td className="py-2 px-3 font-medium text-white">{item.mesLabel}</td>
                        <td className="py-2 px-3 text-right text-emerald-400">{formatCurrencyShort(item.faturamento)}</td>
                        <td className="py-2 px-3 text-right text-red-400">{formatCurrencyShort(item.despesas)}</td>
                        <td className={`py-2 px-3 text-right font-semibold ${item.geracaoCaixa >= 0 ? 'text-blue-400' : 'text-red-500'}`}>
                          {formatCurrencyShort(item.geracaoCaixa)}
                        </td>
                        <td className={`py-2 px-3 text-right ${item.margem >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {item.margem}%
                        </td>
                        <td className={`py-2 px-3 text-right font-medium ${item.caixaAcumulado >= 0 ? 'text-purple-400' : 'text-red-400'}`}>
                          {formatCurrencyShort(item.caixaAcumulado)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-800/70 font-bold border-t-2 border-orange-500/30">
                      <td className="py-3 px-3 text-white">TOTAL</td>
                      <td className="py-3 px-3 text-right text-emerald-400">{formatCurrency(totals.faturamento)}</td>
                      <td className="py-3 px-3 text-right text-red-400">{formatCurrency(totals.despesas)}</td>
                      <td className={`py-3 px-3 text-right ${totals.geracaoCaixa >= 0 ? 'text-blue-400' : 'text-red-500'}`}>
                        {formatCurrency(totals.geracaoCaixa)}
                      </td>
                      <td className={`py-3 px-3 text-right ${totals.faturamento > 0 && (totals.geracaoCaixa / totals.faturamento) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {totals.faturamento > 0 ? ((totals.geracaoCaixa / totals.faturamento) * 100).toFixed(1) : '0.0'}%
                      </td>
                      <td className="py-3 px-3 text-right text-slate-500">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer Quote */}
        <Card className="bg-gradient-to-r from-orange-500/10 via-orange-600/5 to-transparent border-orange-500/20">
          <CardContent className="py-6">
            <blockquote className="text-center italic text-slate-400 text-lg">
              "Tornamos a vida de quem vende online mais fácil e rentável, usando desse know how, para construir as marcas da próxima geração"
            </blockquote>
            <p className="text-center text-sm font-semibold mt-3 text-orange-400">— Turbo Partners</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
