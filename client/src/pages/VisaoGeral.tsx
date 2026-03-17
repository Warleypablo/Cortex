import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { HeroMetric } from "@/components/HeroMetric";
import { StatsCardV2 } from "@/components/StatsCardV2";
import { useTheme } from "@/components/ThemeProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { ComposedChart, Bar, BarChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";

export default function VisaoGeral() {
  usePageTitle("Visão Geral");
  useSetPageInfo("Visão Geral", "Métricas de MRR e performance");
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  });
  const [qtdMesesGrafico, setQtdMesesGrafico] = useState<number>(12);

  const mesVisaoGeral = useMemo(() => {
    return `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}`;
  }, [selectedMonth]);

  const getMesesDesdeNovembro2025 = () => {
    const meses = [];
    const now = new Date();
    const inicio = new Date(2025, 10, 1);
    
    let data = new Date(inicio);
    while (data <= now) {
      const mesAno = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
      const mesNome = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ][data.getMonth()];
      meses.push({ valor: mesAno, label: `${mesNome} ${data.getFullYear()}` });
      data.setMonth(data.getMonth() + 1);
    }
    
    return meses.reverse();
  };

  const { data: metricas, isLoading: isLoadingMetricas } = useQuery({
    queryKey: ['/api/visao-geral/metricas', mesVisaoGeral],
    queryFn: async () => {
      const response = await fetch(`/api/visao-geral/metricas?mesAno=${mesVisaoGeral}`);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      return response.json();
    },
  });

  const { data: topResponsaveis, isLoading: isLoadingTopResponsaveis, isError: isErrorTopResponsaveis } = useQuery<{ nome: string; mrr: number; posicao: number }[]>({
    queryKey: ['/api/top-responsaveis', mesVisaoGeral],
    queryFn: async () => {
      const response = await fetch(`/api/top-responsaveis?mesAno=${mesVisaoGeral}`);
      if (!response.ok) throw new Error('Failed to fetch top responsaveis');
      return response.json();
    },
  });

  const { data: topSquads, isLoading: isLoadingTopSquads } = useQuery<{ squad: string; mrr: number; posicao: number }[]>({
    queryKey: ['/api/top-squads', mesVisaoGeral],
    queryFn: async () => {
      const response = await fetch(`/api/top-squads?mesAno=${mesVisaoGeral}`);
      if (!response.ok) throw new Error('Failed to fetch top squads');
      return response.json();
    },
  });

  const { data: mrrEvolucaoData, isLoading: isLoadingMrrEvolucao } = useQuery<{ mes: string; mrr: number; receitaPontualEntregue: number }[]>({
    queryKey: ['/api/visao-geral/mrr-evolucao', mesVisaoGeral, qtdMesesGrafico],
    queryFn: async () => {
      const response = await fetch(`/api/visao-geral/mrr-evolucao?mesAno=${mesVisaoGeral}&qtdMeses=${qtdMesesGrafico}`);
      if (!response.ok) throw new Error('Failed to fetch MRR evolucao');
      return response.json();
    },
  });

  const mrrEvolution = (mrrEvolucaoData || []).map(item => ({
    mes: item.mes,
    mrr: item.mrr,
    receitaPontualEntregue: item.receitaPontualEntregue || 0,
  }));

  const squadColors: Record<string, string> = {
    'Supreme': '#3b82f6',
    'Forja': '#a855f7',
    'Squadra': '#14b8a6',
    'Chama': '#f97316',
  };

  const mrrSquadData = (topSquads || []).map(item => ({
    squad: item.squad,
    mrr: item.mrr,
    cor: squadColors[item.squad] || '#6b7280',
  }));

  const formatMesNome = (mesAno: string) => {
    if (typeof mesAno === 'string' && mesAno.includes('-')) {
      const [ano, mes] = mesAno.split('-');
      const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      const idx = parseInt(mes) - 1;
      if (idx >= 0 && idx < 12) return `${mesesNomes[idx]} ${ano}`;
    }
    return mesAno;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg p-3 text-sm text-foreground">
        <p className="font-medium mb-1">{formatMesNome(label)}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} style={{ color: entry.color }}>
            {entry.name === 'mrr' ? 'MRR' : entry.name === 'receitaPontualEntregue' ? 'Pontual Entregue' : entry.name}:{' '}
            {typeof entry.value === 'number' ? formatCurrencyNoDecimals(entry.value) : entry.value}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold">Período de Análise</h2>
              <p className="text-sm text-muted-foreground mt-1">Selecione o mês para visualizar as métricas</p>
            </div>
            <MonthYearPicker
              value={selectedMonth}
              onChange={setSelectedMonth}
              minYear={2025}
            />
          </div>

          {/* Hero Metrics */}
          <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-12 mb-8" data-testid="hero-metrics">
            <div data-testid="card-mrr">
              {isLoadingMetricas ? (
                <Skeleton className="h-12 w-48 rounded" />
              ) : (
                <HeroMetric
                  label="MRR Ativo"
                  value={formatCurrencyNoDecimals(metricas?.mrr || 0)}
                  subtitle="Receita Mensal Recorrente de contratos ativos"
                />
              )}
            </div>
            <div data-testid="card-churn-rate">
              {isLoadingMetricas ? (
                <Skeleton className="h-12 w-32 rounded" />
              ) : (
                <HeroMetric
                  label="Churn Rate"
                  value={`${(metricas?.churnRate || 0).toFixed(1)}%`}
                  subtitle="Taxa de cancelamento sobre MRR"
                />
              )}
            </div>
          </div>

          {/* Supporting Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8" data-testid="supporting-cards">
            {isLoadingMetricas ? (
              <>
                <Skeleton className="h-24 rounded-lg" />
                <Skeleton className="h-24 rounded-lg" />
                <Skeleton className="h-24 rounded-lg" />
                <Skeleton className="h-24 rounded-lg" />
                <Skeleton className="h-24 rounded-lg" />
              </>
            ) : (
              <>
                <div data-testid="card-aquisicao-mrr">
                  <StatsCardV2
                    title="Aquisição MRR"
                    value={formatCurrencyNoDecimals(metricas?.aquisicaoMrr || 0)}
                    variant="success"
                    subtitle="Valor de novos contratos recorrentes no mês"
                  />
                </div>
                <div data-testid="card-aquisicao-pontual">
                  <StatsCardV2
                    title="Aquisição Pontual"
                    value={formatCurrencyNoDecimals(metricas?.aquisicaoPontual || 0)}
                    subtitle="Valor de novos contratos pontuais no mês"
                  />
                </div>
                <div data-testid="card-receita-pontual-entregue">
                  <StatsCardV2
                    title="Receita Pontual Entregue"
                    value={formatCurrencyNoDecimals(metricas?.receitaPontualEntregue || 0)}
                    subtitle="Valor de projetos pontuais entregues no mês"
                  />
                </div>
                <div data-testid="card-churn">
                  <StatsCardV2
                    title="Churn"
                    value={formatCurrencyNoDecimals(metricas?.churn || 0)}
                    variant={(metricas?.churn || 0) > 0 ? "error" : "default"}
                    subtitle="Valor de contratos cancelados no mês"
                  />
                </div>
                <div data-testid="card-pausados">
                  <StatsCardV2
                    title="Pausados"
                    value={formatCurrencyNoDecimals(metricas?.pausados || 0)}
                    variant={(metricas?.pausados || 0) > 0 ? "warning" : "default"}
                    subtitle="Valor de contratos pausados no mês"
                  />
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="lg:col-span-2" data-testid="card-evolucao-mrr">
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle>Evolução MRR e Receita Pontual</CardTitle>
                  <CardDescription>Histórico dos últimos {qtdMesesGrafico} meses</CardDescription>
                </div>
                <Select
                  value={String(qtdMesesGrafico)}
                  onValueChange={(value) => setQtdMesesGrafico(Number(value))}
                >
                  <SelectTrigger className="w-28" data-testid="select-periodo-grafico">
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">6 meses</SelectItem>
                    <SelectItem value="9">9 meses</SelectItem>
                    <SelectItem value="12">12 meses</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                {isLoadingMrrEvolucao ? (
                  <Skeleton className="h-[300px] rounded-lg" />
                ) : mrrEvolution.length === 0 ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <p className="text-muted-foreground">Sem dados disponíveis para o período</p>
                  </div>
                ) : (
                  <div role="img" aria-label="Gráfico de evolução mensal de MRR e receita pontual">
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={mrrEvolution}>
                      <CartesianGrid vertical={false} stroke={isDark ? "#27272a" : "#f0f0f0"} />
                      <XAxis
                        dataKey="mes"
                        tick={{ fill: 'currentColor', fontSize: 12 }}
                        tickFormatter={(value) => {
                          const [ano, mes] = value.split('-');
                          const mesesAbrev = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                          return `${mesesAbrev[parseInt(mes) - 1]}/${ano.slice(2)}`;
                        }}
                      />
                      <YAxis hide />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend
                        formatter={(value) => value === 'mrr' ? 'MRR' : 'Pontual Entregue'}
                        wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }}
                      />
                      <Bar dataKey="mrr" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Line
                        type="monotone"
                        dataKey="receitaPontualEntregue"
                        stroke="#9333ea"
                        strokeWidth={2}
                        dot={{ fill: '#9333ea', strokeWidth: 2, r: 4 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-top-responsaveis">
              <CardHeader>
                <CardTitle>Top 5 Responsáveis</CardTitle>
                <CardDescription>Líderes em MRR gerenciado</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingTopResponsaveis ? (
                  <Skeleton className="h-48 rounded-lg" />
                ) : isErrorTopResponsaveis ? (
                  <div className="flex items-center justify-center h-48">
                    <p className="text-destructive">Erro ao carregar dados. Tente novamente.</p>
                  </div>
                ) : (
                  <div className="flex items-end justify-center gap-2 pb-4">
                    {(() => {
                      const top5 = (topResponsaveis || []).slice(0, 5);
                      const slots = [
                        top5[0] || null,
                        top5[1] || null,
                        top5[2] || null,
                        top5[3] || null,
                        top5[4] || null,
                      ];
                      const podiumOrder = [3, 1, 0, 2, 4];
                    
                    return podiumOrder.map((slotIndex) => {
                      const resp = slots[slotIndex];
                      const rank = slotIndex + 1;
                      const heights: Record<number, string> = {
                        1: 'h-40',
                        2: 'h-32', 
                        3: 'h-28',
                        4: 'h-20',
                        5: 'h-16'
                      };
                      
                      if (!resp) {
                        return (
                          <div 
                            key={`empty-${rank}`}
                            className="flex flex-col items-center flex-1"
                          >
                            <div className="mb-2 text-center">
                              <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg mx-auto mb-1 bg-muted/30 text-muted-foreground/30">
                                -
                              </div>
                              <p className="text-xs font-medium text-muted-foreground/50">-</p>
                              <p className="text-xs font-bold text-muted-foreground/50">-</p>
                            </div>
                            <div className={`w-full ${heights[rank]} rounded-t-lg bg-muted/20`} />
                          </div>
                        );
                      }
                      
                      return (
                        <div 
                          key={resp.nome}
                          className="flex flex-col items-center flex-1"
                          data-testid={`podium-responsavel-${rank}`}
                        >
                          <div className="mb-2 text-center">
                            <div className={`
                              w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg mx-auto mb-1
                              ${rank === 1 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' : ''}
                              ${rank === 2 ? 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300' : ''}
                              ${rank === 3 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' : ''}
                              ${rank > 3 ? 'bg-muted text-muted-foreground' : ''}
                            `}>
                              {rank}º
                            </div>
                            <p className="text-xs font-medium truncate px-1" title={resp.nome}>
                              {resp.nome.split(' ')[0]}
                            </p>
                            <p className="text-xs font-bold text-primary">
                              {formatCurrencyNoDecimals(resp.mrr)}
                            </p>
                          </div>
                          <div 
                            className={`
                              w-full ${heights[rank]} rounded-t-lg
                              ${rank === 1 ? 'bg-yellow-100 dark:bg-yellow-900/30' : ''}
                              ${rank === 2 ? 'bg-gray-100 dark:bg-gray-800/30' : ''}
                              ${rank === 3 ? 'bg-orange-100 dark:bg-orange-900/30' : ''}
                              ${rank > 3 ? 'bg-muted' : ''}
                              flex items-center justify-center
                            `}
                          >
                            <span className="font-bold text-2xl text-muted-foreground/30">
                              {rank}
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-mrr-squad">
              <CardHeader>
                <CardTitle>MRR por Squad</CardTitle>
                <CardDescription>Distribuição de receita por equipe</CardDescription>
              </CardHeader>
              <CardContent>
                <div role="img" aria-label="Gráfico de MRR por squad">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={mrrSquadData} layout="vertical">
                    <CartesianGrid horizontal={false} stroke={isDark ? "#27272a" : "#f0f0f0"} />
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="squad"
                      tick={{ fill: 'currentColor', fontSize: 12 }}
                      width={80}
                    />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Bar dataKey="mrr" radius={[0, 8, 8, 0]}>
                      {mrrSquadData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.cor} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
