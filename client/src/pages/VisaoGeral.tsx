import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { DollarSign, TrendingUp, TrendingDown, PauseCircle, Info, CheckCircle } from "lucide-react";
import { ComposedChart, Bar, BarChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";

export default function VisaoGeral() {
  usePageTitle("Visão Geral");
  useSetPageInfo("Visão Geral", "Métricas de MRR e performance");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  });
  const [qtdMesesGrafico, setQtdMesesGrafico] = useState<number>(12);

  const mesVisaoGeral = useMemo(() => {
    return `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}`;
  }, [selectedMonth]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

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

  const formatMesLabel = (mesAno: string) => {
    const [ano, mes] = mesAno.split('-');
    const mesNum = parseInt(mes, 10);
    const mesNomes = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];
    return `${mesNomes[mesNum - 1]}/${ano.slice(2)}`;
  };

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

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <Card data-testid="card-mrr">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  <span className="flex items-center gap-1.5">
                    MRR Ativo
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Receita Mensal Recorrente de contratos ativos</p>
                      </TooltipContent>
                    </Tooltip>
                  </span>
                </CardTitle>
                <DollarSign className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-mrr">
                  {isLoadingMetricas ? "..." : formatCurrency(metricas?.mrr || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Contratos ativos, onboarding e triagem</p>
              </CardContent>
            </Card>

            <Card data-testid="card-aquisicao-mrr">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  <span className="flex items-center gap-1.5">
                    Aquisição MRR
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Valor de novos contratos recorrentes no mês</p>
                      </TooltipContent>
                    </Tooltip>
                  </span>
                </CardTitle>
                <TrendingUp className="w-4 h-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600" data-testid="text-aquisicao-mrr">
                  {isLoadingMetricas ? "..." : formatCurrency(metricas?.aquisicaoMrr || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Novos MRR</p>
              </CardContent>
            </Card>

            <Card data-testid="card-aquisicao-pontual">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  <span className="flex items-center gap-1.5">
                    Aquisição Pontual
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Valor de novos contratos pontuais no mês</p>
                      </TooltipContent>
                    </Tooltip>
                  </span>
                </CardTitle>
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600" data-testid="text-aquisicao-pontual">
                  {isLoadingMetricas ? "..." : formatCurrency(metricas?.aquisicaoPontual || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Novos pontuais</p>
              </CardContent>
            </Card>

            <Card data-testid="card-receita-pontual-entregue">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  <span className="flex items-center gap-1.5">
                    Receita Pontual Entregue
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Valor de projetos pontuais entregues no mês</p>
                      </TooltipContent>
                    </Tooltip>
                  </span>
                </CardTitle>
                <CheckCircle className="w-4 h-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600" data-testid="text-receita-pontual-entregue">
                  {isLoadingMetricas ? "..." : formatCurrency(metricas?.receitaPontualEntregue || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Projetos entregues</p>
              </CardContent>
            </Card>

            <Card data-testid="card-churn">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  <span className="flex items-center gap-1.5">
                    Churn
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Valor de contratos cancelados no mês</p>
                      </TooltipContent>
                    </Tooltip>
                  </span>
                </CardTitle>
                <TrendingDown className="w-4 h-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <div className="text-2xl font-bold text-red-600" data-testid="text-churn">
                    {isLoadingMetricas ? "..." : formatCurrency(metricas?.churn || 0)}
                  </div>
                  <div className="text-sm font-semibold text-red-500" data-testid="text-churn-rate">
                    {isLoadingMetricas ? "" : `(${(metricas?.churnRate || 0).toFixed(1)}%)`}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Contratos encerrados</p>
              </CardContent>
            </Card>

            <Card data-testid="card-pausados">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  <span className="flex items-center gap-1.5">
                    Pausados
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Valor de contratos pausados no mês</p>
                      </TooltipContent>
                    </Tooltip>
                  </span>
                </CardTitle>
                <PauseCircle className="w-4 h-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600" data-testid="text-pausados">
                  {isLoadingMetricas ? "..." : formatCurrency(metricas?.pausados || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Contratos pausados no mês</p>
              </CardContent>
            </Card>
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
                  <div className="flex items-center justify-center h-[300px]">
                    <p className="text-muted-foreground">Carregando...</p>
                  </div>
                ) : mrrEvolution.length === 0 ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <p className="text-muted-foreground">Sem dados disponíveis para o período</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={mrrEvolution}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="mes" 
                        className="text-sm"
                        tick={{ fill: 'currentColor' }}
                        tickFormatter={(value) => {
                          const [ano, mes] = value.split('-');
                          const mesesAbrev = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                          return `${mesesAbrev[parseInt(mes) - 1]}/${ano.slice(2)}`;
                        }}
                      />
                      <YAxis 
                        className="text-sm"
                        tick={{ fill: 'currentColor' }}
                        tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                      />
                      <RechartsTooltip 
                        formatter={(value: number, name: string) => [
                          formatCurrency(value), 
                          name === 'mrr' ? 'MRR' : 'Pontual Entregue'
                        ]}
                        labelFormatter={(label) => {
                          const [ano, mes] = label.split('-');
                          const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
                          return `${mesesNomes[parseInt(mes) - 1]} ${ano}`;
                        }}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                        }}
                      />
                      <Legend 
                        formatter={(value) => value === 'mrr' ? 'MRR' : 'Pontual Entregue'}
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
                  <div className="flex items-center justify-center h-48">
                    <p className="text-muted-foreground">Carregando...</p>
                  </div>
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
                              {formatCurrency(resp.mrr)}
                            </p>
                          </div>
                          <div 
                            className={`
                              w-full ${heights[rank]} rounded-t-lg
                              ${rank === 1 ? 'bg-gradient-to-t from-yellow-200 to-yellow-100 dark:from-yellow-900/40 dark:to-yellow-900/20' : ''}
                              ${rank === 2 ? 'bg-gradient-to-t from-gray-200 to-gray-100 dark:from-gray-800/40 dark:to-gray-800/20' : ''}
                              ${rank === 3 ? 'bg-gradient-to-t from-orange-200 to-orange-100 dark:from-orange-900/40 dark:to-orange-900/20' : ''}
                              ${rank > 3 ? 'bg-gradient-to-t from-muted to-muted/50' : ''}
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
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={mrrSquadData} layout="vertical">
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
                    <RechartsTooltip 
                      formatter={(value: number) => [formatCurrency(value), 'MRR']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                    />
                    <Bar dataKey="mrr" radius={[0, 8, 8, 0]}>
                      {mrrSquadData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.cor} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
