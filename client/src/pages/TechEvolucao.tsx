import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrency, formatCurrencyCompact, formatPercent } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";
import { StatsCardV2 } from "@/components/StatsCardV2";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Line,
  Legend,
  CartesianGrid,
  Area,
  AreaChart,
  Cell,
} from "recharts";

interface TechEvolucaoMensal {
  mes: string;
  entregas: number;
  valorTotal: number;
  tempoMedioEntrega: number;
  taxaNoPrazo: number;
}

interface TechEvolucaoTipo {
  mes: string;
  tipo: string;
  entregas: number;
  valorTotal: number;
}

const TIPO_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#22c55e', '#06b6d4', '#eab308', '#ef4444'];

const formatMesLabel = (mes: string) => {
  const [year, month] = mes.split('-');
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${monthNames[parseInt(month) - 1]}/${year.slice(2)}`;
};

export default function TechEvolucao() {
  usePageTitle("Tech - Evolução");
  useSetPageInfo("Tech - Evolução Mensal", "Análise temporal de entregas, valores e tendências");
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [periodo, setPeriodo] = useState<string>('12');

  const { data: evolucao, isLoading: isLoadingEvolucao } = useQuery<TechEvolucaoMensal[]>({
    queryKey: ['/api/tech/evolucao-mensal', periodo],
    queryFn: async () => {
      const res = await fetch(`/api/tech/evolucao-mensal?meses=${periodo}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const { data: evolucaoTipo, isLoading: isLoadingTipo } = useQuery<TechEvolucaoTipo[]>({
    queryKey: ['/api/tech/evolucao-por-tipo', periodo],
    queryFn: async () => {
      const res = await fetch(`/api/tech/evolucao-por-tipo?meses=${periodo}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  // KPIs do período
  const stats = useMemo(() => {
    if (!evolucao || evolucao.length === 0) {
      return { totalEntregas: 0, valorTotal: 0, tempoMedio: 0, taxaMedia: 0 };
    }
    const totalEntregas = evolucao.reduce((s, m) => s + m.entregas, 0);
    const valorTotal = evolucao.reduce((s, m) => s + m.valorTotal, 0);
    const mesesComTempo = evolucao.filter(m => m.tempoMedioEntrega > 0);
    const tempoMedio = mesesComTempo.length > 0
      ? mesesComTempo.reduce((s, m) => s + m.tempoMedioEntrega * m.entregas, 0) /
        mesesComTempo.reduce((s, m) => s + m.entregas, 0)
      : 0;
    const mesesComTaxa = evolucao.filter(m => m.entregas > 0);
    const taxaMedia = mesesComTaxa.length > 0
      ? mesesComTaxa.reduce((s, m) => s + m.taxaNoPrazo * m.entregas, 0) /
        mesesComTaxa.reduce((s, m) => s + m.entregas, 0)
      : 0;
    return { totalEntregas, valorTotal, tempoMedio, taxaMedia };
  }, [evolucao]);

  // Dados do gráfico de entregas + tempo médio
  const entregasChartData = useMemo(() => {
    return evolucao?.map(m => ({
      mes: formatMesLabel(m.mes),
      entregas: m.entregas,
      valor: m.valorTotal,
      tempoMedio: Math.round(m.tempoMedioEntrega),
    })) || [];
  }, [evolucao]);

  // Dados do gráfico empilhado por tipo
  const tipoChartData = useMemo(() => {
    if (!evolucaoTipo || evolucaoTipo.length === 0) return { data: [], tipos: [] };

    const tipos = Array.from(new Set(evolucaoTipo.map(t => t.tipo)));
    const meses = Array.from(new Set(evolucaoTipo.map(t => t.mes))).sort();

    const data = meses.map(mes => {
      const entry: any = { mes: formatMesLabel(mes) };
      for (const tipo of tipos) {
        const item = evolucaoTipo.find(t => t.mes === mes && t.tipo === tipo);
        entry[tipo] = item ? item.valorTotal : 0;
      }
      return entry;
    });

    return { data, tipos };
  }, [evolucaoTipo]);

  // Dados do gráfico de taxa de cumprimento
  const taxaChartData = useMemo(() => {
    return evolucao?.filter(m => m.entregas > 0).map(m => ({
      mes: formatMesLabel(m.mes),
      taxa: Math.round(m.taxaNoPrazo * 10) / 10,
    })) || [];
  }, [evolucao]);

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header com filtro */}
        <div className="flex items-center justify-between mb-6">
          <div />
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Últimos 3 meses</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
              <SelectItem value="12">Últimos 12 meses</SelectItem>
              <SelectItem value="24">Últimos 24 meses</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {isLoadingEvolucao ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))
          ) : (
            <>
              <StatsCardV2 title="Total Entregas" value={String(stats.totalEntregas)} variant="success" />
              <StatsCardV2 title="Valor Entregue" value={formatCurrencyCompact(stats.valorTotal)} />
              <StatsCardV2 title="Tempo Médio" value={`${Math.round(stats.tempoMedio)} dias`} variant={stats.tempoMedio > 30 ? "warning" : "default"} />
              <StatsCardV2 title="No Prazo" value={formatPercent(stats.taxaMedia)} variant={stats.taxaMedia >= 80 ? "success" : stats.taxaMedia >= 60 ? "warning" : "error"} />
            </>
          )}
        </div>

        {/* Gráfico 1: Entregas + Tempo Médio */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              Entregas e Tempo Médio por Mês
            </CardTitle>
            <CardDescription>Quantidade de projetos entregues e tempo médio de entrega</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingEvolucao ? (
              <Skeleton className="h-[320px] w-full" />
            ) : entregasChartData.length === 0 ? (
              <div className="flex items-center justify-center h-[320px] text-muted-foreground">
                Nenhum dado encontrado para o período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={entregasChartData} margin={{ top: 20, right: 40, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#3f3f46' : '#d1d5db'} opacity={0.5} />
                  <XAxis
                    dataKey="mes"
                    tick={{ fontSize: 11, fill: isDark ? '#71717a' : '#6b7280' }}
                    axisLine={{ stroke: isDark ? '#3f3f46' : '#d1d5db' }}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: isDark ? '#71717a' : '#6b7280' }}
                    axisLine={{ stroke: isDark ? '#3f3f46' : '#d1d5db' }}
                    label={{ value: 'Entregas', angle: -90, position: 'insideLeft', fontSize: 10, fill: isDark ? '#71717a' : '#6b7280' }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: isDark ? '#71717a' : '#6b7280' }}
                    axisLine={{ stroke: isDark ? '#3f3f46' : '#d1d5db' }}
                    label={{ value: 'Dias', angle: 90, position: 'insideRight', fontSize: 10, fill: isDark ? '#71717a' : '#6b7280' }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg p-3 text-sm text-foreground">
                            <p className="font-medium mb-2">{data.mes}</p>
                            <div className="space-y-1 text-sm">
                              <p>Entregas: <span className="font-medium">{data.entregas}</span></p>
                              <p>Valor: <span className="font-medium">{formatCurrency(data.valor)}</span></p>
                              <p>Tempo médio: <span className="font-medium">{data.tempoMedio}d</span></p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend formatter={(value) => value === 'entregas' ? 'Entregas' : 'Tempo Médio (dias)'} />
                  <Bar yAxisId="left" dataKey="entregas" fill="#22c55e" radius={[4, 4, 0, 0]} name="entregas" />
                  <Line yAxisId="right" type="monotone" dataKey="tempoMedio" stroke="#f97316" strokeWidth={3} dot={{ fill: '#f97316', r: 4 }} name="tempoMedio" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Gráfico 2: Valor por Tipo (empilhado) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">
                Valor Entregue por Tipo
              </CardTitle>
              <CardDescription>Distribuição de receita por tipo de projeto ao longo do tempo</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingTipo ? (
                <Skeleton className="h-[300px] w-full" />
              ) : tipoChartData.data.length === 0 ? (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  Nenhum dado encontrado
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={tipoChartData.data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#3f3f46' : '#d1d5db'} opacity={0.5} />
                      <XAxis dataKey="mes" tick={{ fontSize: 10, fill: isDark ? '#71717a' : '#6b7280' }} />
                      <YAxis
                        tick={{ fontSize: 10, fill: isDark ? '#71717a' : '#6b7280' }}
                        tickFormatter={(v) => formatCurrencyCompact(v)}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [formatCurrency(value), name]}
                        contentStyle={{
                          backgroundColor: isDark ? '#18181b' : '#ffffff',
                          border: `1px solid ${isDark ? '#3f3f46' : '#d1d5db'}`,
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      {tipoChartData.tipos.map((tipo, i) => (
                        <Bar
                          key={tipo}
                          dataKey={tipo}
                          stackId="a"
                          fill={TIPO_COLORS[i % TIPO_COLORS.length]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
            </CardContent>
          </Card>

          {/* Gráfico 3: Taxa de Cumprimento de Prazo */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">
                Taxa de Cumprimento de Prazo
              </CardTitle>
              <CardDescription>Percentual de projetos entregues dentro do prazo por mês</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingEvolucao ? (
                <Skeleton className="h-[300px] w-full" />
              ) : taxaChartData.length === 0 ? (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  Nenhum dado encontrado
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={taxaChartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#3f3f46' : '#d1d5db'} opacity={0.5} />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: isDark ? '#71717a' : '#6b7280' }} />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: isDark ? '#71717a' : '#6b7280' }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      formatter={(value: number) => [`${value}%`, 'No Prazo']}
                      contentStyle={{
                        backgroundColor: isDark ? '#18181b' : '#ffffff',
                        border: `1px solid ${isDark ? '#3f3f46' : '#d1d5db'}`,
                        borderRadius: '8px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="taxa"
                      stroke="#06b6d4"
                      strokeWidth={3}
                      fill="#06b6d4"
                      fillOpacity={0.1}
                      dot={{ fill: '#06b6d4', r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabela resumo mensal */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              Resumo Mensal
            </CardTitle>
            <CardDescription>Detalhamento mês a mês das métricas de entrega</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingEvolucao ? (
              <Skeleton className="h-[200px] w-full" />
            ) : !evolucao || evolucao.length === 0 ? (
              <div className="flex items-center justify-center h-[150px] text-muted-foreground">
                Nenhum dado encontrado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Mês</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">Entregas</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">Valor Total</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">Tempo Médio</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">No Prazo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...evolucao].reverse().map((m, i) => (
                      <tr key={m.mes} className="border-b border-border/50 hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{formatMesLabel(m.mes)}</td>
                        <td className="py-3 px-4 text-right">
                          <Badge variant="secondary">{m.entregas}</Badge>
                        </td>
                        <td className="py-3 px-4 text-right font-medium">{formatCurrency(m.valorTotal)}</td>
                        <td className="py-3 px-4 text-right">
                          <span className={m.tempoMedioEntrega > 30 ? 'text-orange-600' : 'text-green-600'}>
                            {Math.round(m.tempoMedioEntrega)}d
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={m.taxaNoPrazo >= 80 ? 'text-green-600' : m.taxaNoPrazo >= 60 ? 'text-yellow-600' : 'text-red-600'}>
                            {formatPercent(m.taxaNoPrazo)}
                          </span>
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
    </div>
  );
}
