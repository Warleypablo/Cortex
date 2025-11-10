import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingUp, TrendingDown, Users, PauseCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useQuery } from "@tanstack/react-query";

export default function VisaoGeral() {
  const [mesVisaoGeral, setMesVisaoGeral] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
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

  const { data: metricas, isLoading: isLoadingMetricas } = useQuery({
    queryKey: ['/api/visao-geral/metricas', mesVisaoGeral],
    queryFn: async () => {
      const response = await fetch(`/api/visao-geral/metricas?mesAno=${mesVisaoGeral}`);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      return response.json();
    },
  });

  const { data: topResponsaveis, isLoading: isLoadingTopResponsaveis, isError: isErrorTopResponsaveis } = useQuery<{ nome: string; mrr: number; posicao: number }[]>({
    queryKey: ['/api/top-responsaveis'],
    queryFn: async () => {
      const response = await fetch('/api/top-responsaveis');
      if (!response.ok) throw new Error('Failed to fetch top responsaveis');
      return response.json();
    },
  });

  const mockMrrEvolution = [
    { mes: mesVisaoGeral, mrr: metricas?.mrr || 0 }
  ];

  const mockMrrSquad = [
    { squad: 'Supreme', mrr: 145000, cor: '#3b82f6' },
    { squad: 'Forja', mrr: 132000, cor: '#a855f7' },
    { squad: 'Squadra', mrr: 108000, cor: '#14b8a6' },
    { squad: 'Chama', mrr: 65000, cor: '#f97316' },
  ];

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2" data-testid="text-title">Visão Geral</h1>
          <p className="text-muted-foreground">Métricas de MRR e performance</p>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold">Período de Análise</h2>
              <p className="text-sm text-muted-foreground mt-1">Selecione o mês para visualizar as métricas</p>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <Card data-testid="card-mrr">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">MRR Ativo</CardTitle>
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
                <CardTitle className="text-sm font-medium">Aquisição MRR</CardTitle>
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
                <CardTitle className="text-sm font-medium">Aquisição Pontual</CardTitle>
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600" data-testid="text-aquisicao-pontual">
                  {isLoadingMetricas ? "..." : formatCurrency(metricas?.aquisicaoPontual || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Novos pontuais</p>
              </CardContent>
            </Card>

            <Card data-testid="card-cac">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">CAC</CardTitle>
                <Users className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-muted-foreground" data-testid="text-cac">
                  -
                </div>
                <p className="text-xs text-muted-foreground mt-1">Em breve</p>
              </CardContent>
            </Card>

            <Card data-testid="card-churn">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Churn</CardTitle>
                <TrendingDown className="w-4 h-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600" data-testid="text-churn">
                  {isLoadingMetricas ? "..." : formatCurrency(metricas?.churn || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Contratos encerrados</p>
              </CardContent>
            </Card>

            <Card data-testid="card-pausados">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pausados</CardTitle>
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
      </div>
    </div>
  );
}
