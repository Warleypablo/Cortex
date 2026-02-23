import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrency, formatCurrencyCompact, formatPercent } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { format, startOfYear } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  DollarSign,
  TrendingUp,
  Target,
  BarChart3,
  PieChart as PieChartIcon,
  ArrowUpDown,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface TechFinanceiroAnalise {
  porTipo: {
    tipo: string;
    quantidadeRealizado: number;
    valorRealizado: number;
    ticketMedioRealizado: number;
    quantidadePrevisto: number;
    valorPrevisto: number;
    ticketMedioPrevisto: number;
  }[];
  totais: {
    valorRealizado: number;
    valorPrevisto: number;
    quantidadeRealizado: number;
    quantidadePrevisto: number;
    ticketMedioGeral: number;
  };
  evolucaoMensal: {
    mes: string;
    valorRealizado: number;
    valorPrevisto: number;
  }[];
}

const TIPO_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#22c55e', '#06b6d4', '#eab308', '#ef4444'];

const formatMesLabel = (mes: string) => {
  const [year, month] = mes.split('-');
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${monthNames[parseInt(month) - 1]}/${year.slice(2)}`;
};

export default function TechFinanceiro() {
  usePageTitle("Tech - Financeiro");
  useSetPageInfo("Tech - Análise Financeira", "Análise de receita pontual: previsto vs realizado");

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: startOfYear(new Date()),
    to: new Date(),
  }));

  const startDate = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '';
  const endDate = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : '';

  const { data: financeiro, isLoading } = useQuery<TechFinanceiroAnalise>({
    queryKey: ['/api/tech/financeiro', startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await fetch(`/api/tech/financeiro?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const atingimento = useMemo(() => {
    if (!financeiro?.totais) return 0;
    const { valorRealizado, valorPrevisto } = financeiro.totais;
    if (valorPrevisto === 0 && valorRealizado === 0) return 0;
    if (valorPrevisto === 0) return 100;
    return (valorRealizado / valorPrevisto) * 100;
  }, [financeiro]);

  // Dados para gráfico de barras agrupadas
  const evolucaoChartData = useMemo(() => {
    return financeiro?.evolucaoMensal.map(m => ({
      mes: formatMesLabel(m.mes),
      realizado: m.valorRealizado,
      previsto: m.valorPrevisto,
    })) || [];
  }, [financeiro]);

  // Dados para pie chart
  const pieData = useMemo(() => {
    return financeiro?.porTipo
      .filter(t => t.valorRealizado > 0)
      .map((t, i) => ({
        name: t.tipo,
        value: t.valorRealizado,
        fill: TIPO_COLORS[i % TIPO_COLORS.length],
      })) || [];
  }, [financeiro]);

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header com filtro */}
        <div className="flex items-center justify-between mb-6">
          <div />
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            triggerClassName="h-9"
          />
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Realizado</p>
                  {isLoading ? (
                    <Skeleton className="h-7 w-20 mt-1" />
                  ) : (
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrencyCompact(financeiro?.totais.valorRealizado || 0)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Previsto</p>
                  {isLoading ? (
                    <Skeleton className="h-7 w-20 mt-1" />
                  ) : (
                    <p className="text-xl font-bold text-blue-600">
                      {formatCurrencyCompact(financeiro?.totais.valorPrevisto || 0)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <ArrowUpDown className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ticket Médio</p>
                  {isLoading ? (
                    <Skeleton className="h-7 w-20 mt-1" />
                  ) : (
                    <p className="text-xl font-bold text-purple-600">
                      {formatCurrencyCompact(financeiro?.totais.ticketMedioGeral || 0)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`bg-gradient-to-br ${atingimento >= 80 ? 'from-green-500/10 to-green-500/5 border-green-500/20' : atingimento >= 50 ? 'from-yellow-500/10 to-yellow-500/5 border-yellow-500/20' : 'from-red-500/10 to-red-500/5 border-red-500/20'}`}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${atingimento >= 80 ? 'bg-green-500/20' : atingimento >= 50 ? 'bg-yellow-500/20' : 'bg-red-500/20'}`}>
                  <Target className={`h-5 w-5 ${atingimento >= 80 ? 'text-green-500' : atingimento >= 50 ? 'text-yellow-500' : 'text-red-500'}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Atingimento</p>
                  {isLoading ? (
                    <Skeleton className="h-7 w-14 mt-1" />
                  ) : (
                    <p className={`text-2xl font-bold ${atingimento >= 80 ? 'text-green-600' : atingimento >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {formatPercent(atingimento)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico Previsto vs Realizado */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Previsto vs Realizado por Mês
            </CardTitle>
            <CardDescription>Comparação mensal entre valor previsto e valor realizado</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[320px] w-full" />
            ) : evolucaoChartData.length === 0 ? (
              <div className="flex items-center justify-center h-[320px] text-muted-foreground">
                Nenhum dado encontrado para o período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={evolucaoChartData} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis
                    dataKey="mes"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickFormatter={(v) => formatCurrencyCompact(v)}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatCurrency(value),
                      name === 'realizado' ? 'Realizado' : 'Previsto',
                    ]}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend formatter={(value) => value === 'realizado' ? 'Realizado' : 'Previsto'} />
                  <Bar dataKey="previsto" fill="#3b82f6" radius={[4, 4, 0, 0]} name="previsto" />
                  <Bar dataKey="realizado" fill="#22c55e" radius={[4, 4, 0, 0]} name="realizado" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Tabela por Tipo */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Análise por Tipo de Projeto
              </CardTitle>
              <CardDescription>Comparação detalhada de realizado vs previsto por tipo</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : !financeiro?.porTipo || financeiro.porTipo.length === 0 ? (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  Nenhum dado encontrado
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">Tipo</th>
                        <th className="text-right py-3 px-3 font-medium text-muted-foreground">Qtd Real.</th>
                        <th className="text-right py-3 px-3 font-medium text-muted-foreground">Valor Real.</th>
                        <th className="text-right py-3 px-3 font-medium text-muted-foreground">Ticket Real.</th>
                        <th className="text-right py-3 px-3 font-medium text-muted-foreground">Qtd Prev.</th>
                        <th className="text-right py-3 px-3 font-medium text-muted-foreground">Valor Prev.</th>
                        <th className="text-right py-3 px-3 font-medium text-muted-foreground">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {financeiro.porTipo.map((tipo, i) => {
                        const delta = tipo.valorPrevisto > 0
                          ? ((tipo.valorRealizado - tipo.valorPrevisto) / tipo.valorPrevisto) * 100
                          : tipo.valorRealizado > 0 ? 100 : 0;
                        return (
                          <tr key={tipo.tipo} className="border-b border-border/50 hover:bg-muted/50">
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TIPO_COLORS[i % TIPO_COLORS.length] }} />
                                <span className="font-medium">{tipo.tipo}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <Badge variant="secondary">{tipo.quantidadeRealizado}</Badge>
                            </td>
                            <td className="py-3 px-3 text-right font-medium text-green-600">
                              {formatCurrency(tipo.valorRealizado)}
                            </td>
                            <td className="py-3 px-3 text-right text-muted-foreground">
                              {formatCurrencyCompact(tipo.ticketMedioRealizado)}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <Badge variant="outline">{tipo.quantidadePrevisto}</Badge>
                            </td>
                            <td className="py-3 px-3 text-right font-medium text-blue-600">
                              {formatCurrency(tipo.valorPrevisto)}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <span className={delta >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {delta >= 0 ? '+' : ''}{Math.round(delta)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pie Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <PieChartIcon className="h-4 w-4" />
                Receita por Tipo
              </CardTitle>
              <CardDescription>Distribuição do valor realizado</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : pieData.length === 0 ? (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  Nenhum dado encontrado
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [formatCurrency(value), name]}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-2">
                    {pieData.map((item, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }} />
                          <span className="text-sm truncate">{item.name}</span>
                        </div>
                        <span className="text-sm font-medium">{formatCurrencyCompact(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
