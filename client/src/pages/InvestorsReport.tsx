import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { 
  Users, 
  FileText, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  UserCheck,
  Download,
  Building2,
  PieChart as PieChartIcon,
  BarChart3,
  AlertTriangle,
  Briefcase
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
  Legend
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

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function InvestorsReport() {
  const { data, isLoading, error } = useQuery<InvestorsReportData>({
    queryKey: ['/api/investors-report'],
  });

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

        {/* ROW 2: Receita & Faturamento */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                    <TrendingUp className="h-4 w-4 text-teal-500" />
                    Eficiência
                  </div>
                  <div className="text-2xl font-bold" data-testid="kpi-eficiencia">
                    {data?.equipe.headcount && data?.receita.mrrAtivo
                      ? `${((data.receita.mrrAtivo / (data.equipe.headcount * 4000)) * 100).toFixed(0)}%`
                      : '0%'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Receita / Custo estimado
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Evolução Faturamento */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Evolução do Faturamento
              </CardTitle>
              <CardDescription>Últimos 12 meses (caz_parcelas)</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : !data?.evolucaoFaturamento?.length ? (
                <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                  Nenhum dado encontrado
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data.evolucaoFaturamento} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis 
                      dataKey="mes" 
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => {
                        const [year, month] = value.split('-');
                        return `${month}/${year.slice(2)}`;
                      }}
                    />
                    <YAxis 
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => formatCurrencyShort(value)}
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), '']}
                      labelFormatter={(label) => {
                        const [year, month] = label.split('-');
                        return `${month}/${year}`;
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="faturamento" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="Faturamento"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="inadimplencia" 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="Inadimplência"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Mix de Contratos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 text-primary" />
                Mix de Contratos
              </CardTitle>
              <CardDescription>Recorrentes vs Pontuais (cup_contratos)</CardDescription>
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
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Headcount por Setor */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Headcount por Setor
              </CardTitle>
              <CardDescription>Distribuição da equipe (rh_pessoal)</CardDescription>
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

          {/* Histórico Financeiro Mensal */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Histórico Financeiro (12 meses)
              </CardTitle>
              <CardDescription>Evolução mensal de faturamento, despesas e geração de caixa</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : !data?.evolucaoFaturamento?.length ? (
                <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                  Nenhum dado encontrado
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[280px]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background border-b">
                      <tr className="text-muted-foreground">
                        <th className="text-left py-2 px-2 font-medium">Mês</th>
                        <th className="text-right py-2 px-2 font-medium">Faturamento</th>
                        <th className="text-right py-2 px-2 font-medium">Despesas</th>
                        <th className="text-right py-2 px-2 font-medium">Geração Caixa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.evolucaoFaturamento.map((item, index) => (
                        <tr 
                          key={item.mes}
                          className="hover:bg-muted/50"
                          data-testid={`historico-financeiro-${index}`}
                        >
                          <td className="py-2 px-2 font-medium">
                            {new Date(item.mes + '-01').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
                          </td>
                          <td className="py-2 px-2 text-right text-green-600">
                            {formatCurrencyShort(item.faturamento)}
                          </td>
                          <td className="py-2 px-2 text-right text-red-500">
                            {formatCurrencyShort(item.despesas)}
                          </td>
                          <td className={`py-2 px-2 text-right font-semibold ${item.geracaoCaixa >= 0 ? 'text-blue-500' : 'text-red-600'}`}>
                            {formatCurrencyShort(item.geracaoCaixa)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

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
