import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CalendarDays, Building2, User, FileText, Briefcase, MessageCircle
} from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { HeroMetric } from "@/components/HeroMetric";
import { StatsCardV2 } from "@/components/StatsCardV2";

interface RevenueGoalsData {
  resumo: {
    totalPrevisto: number;
    totalRecebido: number;
    totalPendente: number;
    totalInadimplente: number;
    percentualRecebido: number;
    percentualInadimplencia: number;
    quantidadeParcelas: number;
    quantidadeRecebidas: number;
    quantidadePendentes: number;
    quantidadeInadimplentes: number;
  };
  porDia: {
    dia: number;
    dataCompleta: string;
    previsto: number;
    recebido: number;
    pendente: number;
    inadimplente: number;
  }[];
}

interface DiaDetalhesData {
  data: string;
  resumo: {
    totalPrevisto: number;
    totalRecebido: number;
    totalPendente: number;
    totalInadimplente: number;
    quantidadeParcelas: number;
  };
  parcelas: {
    id: number;
    descricao: string;
    valorBruto: number;
    valorPago: number;
    naoPago: number;
    dataVencimento: string;
    status: 'pago' | 'pendente' | 'inadimplente';
    empresa: string;
    idCliente: string;
    nomeCliente: string;
    cnpj: string | null;
    responsavel: string | null;
    squad: string | null;
    servico: string | null;
    statusClickup: string | null;
    telefone: string | null;
  }[];
}

const mesesNomes = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const mesesAbreviados = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload;
    const totalDia = (data?.recebido || 0) + (data?.pendente || 0) + (data?.inadimplente || 0);
    
    return (
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg p-3 text-sm text-foreground min-w-[220px]">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <p className="font-semibold">Dia {label}</p>
        </div>
        
        <div className="space-y-2.5">
          {payload.map((entry: any, index: number) => {
            if (entry.dataKey === 'metaAcumulada' || entry.dataKey === 'recebidoAcumulado') return null;
            const percentage = totalDia > 0 ? ((entry.value / totalDia) * 100).toFixed(1) : '0';
            return (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm text-muted-foreground">{entry.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold">{formatCurrency(entry.value)}</span>
                  <span className="text-xs text-muted-foreground ml-1">({percentage}%)</span>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-3 pt-2 border-t">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Total do dia</span>
            <span className="text-sm font-bold">{formatCurrency(totalDia)}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

function CustomLegend({ payload }: any) {
  const barItems = payload?.filter((item: any) =>
    !['metaAcumulada', 'recebidoAcumulado'].includes(item.dataKey)
  ) || [];

  return (
    <div className="flex flex-wrap justify-center items-center gap-3 mt-4">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Diário:</span>
      {barItems.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-1.5">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-muted-foreground">{entry.value}</span>
        </div>
      ))}
      <span className="text-muted-foreground/30 mx-1">|</span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Acumulado:</span>
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-0.5 bg-blue-500 rounded" />
        <span className="text-xs text-muted-foreground">Meta</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-0.5 bg-emerald-500 rounded" style={{ borderTop: '2px dashed #10b981', background: 'none' }} />
        <span className="text-xs text-muted-foreground">Recebido</span>
      </div>
    </div>
  );
}

export default function RevenueGoals() {
  usePageTitle("Metas de Receita");
  useSetPageInfo("Metas de Receita", "Acompanhamento de recebimentos do mês");
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const hoje = new Date();
  const [selectedMonth, setSelectedMonth] = useState({ month: hoje.getMonth() + 1, year: hoje.getFullYear() });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { data, isLoading } = useQuery<RevenueGoalsData>({
    queryKey: ['/api/financeiro/revenue-goals', selectedMonth.month, selectedMonth.year],
    queryFn: async () => {
      const response = await fetch(`/api/financeiro/revenue-goals?mes=${selectedMonth.month}&ano=${selectedMonth.year}`);
      if (!response.ok) throw new Error('Failed to fetch revenue goals');
      return response.json();
    },
  });

  const { data: diaDetalhes, isLoading: isLoadingDetalhes } = useQuery<DiaDetalhesData>({
    queryKey: ['/api/financeiro/revenue-goals/detalhes-dia', selectedDay],
    queryFn: async () => {
      const response = await fetch(`/api/financeiro/revenue-goals/detalhes-dia?data=${selectedDay}`);
      if (!response.ok) throw new Error('Failed to fetch day details');
      return response.json();
    },
    enabled: !!selectedDay,
  });

  const handleBarClick = (data: any) => {
    if (data?.activePayload?.[0]?.payload) {
      const dia = data.activePayload[0].payload.dia;
      const dataCompleta = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      setSelectedDay(dataCompleta);
    }
  };

  const parcelasPagas = diaDetalhes?.parcelas.filter(p => p.status === 'pago') || [];
  const parcelasPendentes = diaDetalhes?.parcelas.filter(p => p.status === 'pendente') || [];
  const parcelasInadimplentes = diaDetalhes?.parcelas.filter(p => p.status === 'inadimplente') || [];

  const chartData = useMemo(() => {
    if (!data?.porDia) return [];
    
    let metaAcumulada = 0;
    let recebidoAcumulado = 0;
    
    return data.porDia.map(d => {
      metaAcumulada += d.previsto;
      recebidoAcumulado += d.recebido;
      
      return {
        dia: d.dia,
        recebido: d.recebido,
        pendente: d.pendente,
        inadimplente: d.inadimplente,
        metaAcumulada,
        recebidoAcumulado,
      };
    });
  }, [data]);

  const diasRestantes = useMemo(() => {
    const ultimoDia = new Date(selectedMonth.year, selectedMonth.month, 0).getDate();
    const diaAtual = selectedMonth.month === hoje.getMonth() + 1 && selectedMonth.year === hoje.getFullYear() 
      ? hoje.getDate() 
      : ultimoDia;
    return ultimoDia - diaAtual;
  }, [selectedMonth, hoje]);

  const mediaDiariaRecebida = useMemo(() => {
    if (!data || data.resumo.quantidadeRecebidas === 0) return 0;
    const diasComRecebimento = data.porDia.filter(d => d.recebido > 0).length;
    return diasComRecebimento > 0 ? data.resumo.totalRecebido / diasComRecebimento : 0;
  }, [data]);

  const projecaoFinal = useMemo(() => {
    if (!data) return 0;
    return data.resumo.totalRecebido + (mediaDiariaRecebida * diasRestantes);
  }, [data, mediaDiariaRecebida, diasRestantes]);

  return (
    <div className="p-6 space-y-6" data-testid="page-revenue-goals">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {mesesNomes[selectedMonth.month - 1]} {selectedMonth.year}
          </h2>
          <p className="text-muted-foreground mt-1">
            Acompanhamento de metas e recebimentos
          </p>
        </div>
        <MonthYearPicker
          value={selectedMonth}
          onChange={setSelectedMonth}
        />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="flex items-start gap-12">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-[300px] rounded-lg" />
        </div>
      ) : data ? (
        <>
          {/* Hero Metrics */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-12">
            <HeroMetric
              label="Recebido"
              value={formatCurrency(data.resumo.totalRecebido)}
              subtitle={`${data.resumo.quantidadeRecebidas} parcelas recebidas`}
              trend={{
                value: `${formatPercent(data.resumo.percentualRecebido)} da meta`,
                isPositive: data.resumo.percentualRecebido >= 50,
              }}
            />
            <HeroMetric
              label="Total a Receber"
              value={formatCurrency(data.resumo.totalPrevisto)}
              subtitle={`${data.resumo.quantidadeParcelas} parcelas no mês`}
            />
          </div>

          {/* Supporting Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCardV2
              title="Pendente"
              value={formatCurrency(data.resumo.totalPendente)}
              subtitle={`${data.resumo.quantidadePendentes} parcelas aguardando pagamento`}
              variant="warning"
            />
            <StatsCardV2
              title="Inadimplente"
              value={formatCurrency(data.resumo.totalInadimplente)}
              subtitle={`${data.resumo.quantidadeInadimplentes} parcelas · ${formatPercent(data.resumo.percentualInadimplencia)}`}
              variant="error"
              trend={{
                value: data.resumo.percentualInadimplencia > 10 ? 'Acima de 10%' : 'Controlado',
                isPositive: data.resumo.percentualInadimplencia <= 10,
              }}
            />
            <StatsCardV2
              title="Projeção Final"
              value={formatCurrency(projecaoFinal)}
              subtitle={`${diasRestantes} dias restantes`}
              variant={projecaoFinal >= data.resumo.totalPrevisto ? 'success' : 'warning'}
              trend={{
                value: projecaoFinal >= data.resumo.totalPrevisto ? 'Acima da meta' : 'Abaixo da meta',
                isPositive: projecaoFinal >= data.resumo.totalPrevisto,
              }}
            />
            <StatsCardV2
              title="Média Diária"
              value={formatCurrency(mediaDiariaRecebida)}
              subtitle="Por dia com recebimento"
            />
          </div>

          {/* Ticket Médio */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatsCardV2
              title="Ticket Médio Recebido"
              value={data.resumo.quantidadeRecebidas > 0
                ? formatCurrency(data.resumo.totalRecebido / data.resumo.quantidadeRecebidas)
                : 'R$ 0'}
              subtitle={`Base: ${data.resumo.quantidadeRecebidas} parcelas`}
              variant="success"
            />
            <StatsCardV2
              title="Ticket Médio Pendente"
              value={data.resumo.quantidadePendentes > 0
                ? formatCurrency(data.resumo.totalPendente / data.resumo.quantidadePendentes)
                : 'R$ 0'}
              subtitle={`Base: ${data.resumo.quantidadePendentes} parcelas`}
              variant="warning"
            />
            <StatsCardV2
              title="Ticket Médio Inadimplente"
              value={data.resumo.quantidadeInadimplentes > 0
                ? formatCurrency(data.resumo.totalInadimplente / data.resumo.quantidadeInadimplentes)
                : 'R$ 0'}
              subtitle={`Base: ${data.resumo.quantidadeInadimplentes} parcelas`}
              variant="error"
            />
          </div>

          {/* Gráfico Principal */}
          <Card className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Evolução de Recebimentos</CardTitle>
              <CardDescription>Análise diária com comparativo de meta acumulada</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }} onClick={handleBarClick} style={{ cursor: 'pointer' }}>
                    <CartesianGrid vertical={false} stroke={isDark ? '#27272a' : '#f0f0f0'} />
                    <XAxis
                      dataKey="dia"
                      tick={{ fontSize: 11, fill: isDark ? '#a1a1aa' : '#6b7280' }}
                      tickLine={false}
                      axisLine={{ stroke: isDark ? '#3f3f46' : '#e5e7eb' }}
                    />
                    <YAxis
                      yAxisId="bars"
                      tickFormatter={(value) => {
                        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                        if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                        return value.toString();
                      }}
                      tick={{ fontSize: 11, fill: isDark ? '#a1a1aa' : '#6b7280' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      yAxisId="lines"
                      orientation="right"
                      tickFormatter={(value) => {
                        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                        if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                        return value.toString();
                      }}
                      tick={{ fontSize: 11, fill: isDark ? '#a1a1aa' : '#6b7280' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: isDark ? '#27272a' : '#f3f4f6', opacity: 0.5 }} />
                    <Legend content={<CustomLegend />} />

                    <Bar yAxisId="bars" dataKey="recebido" name="Recebido" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                    <Bar yAxisId="bars" dataKey="pendente" name="Pendente" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                    <Bar yAxisId="bars" dataKey="inadimplente" name="Inadimplente" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />

                    <Line yAxisId="lines" type="monotone" dataKey="metaAcumulada" name="Meta Acumulada" stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{ r: 6, strokeWidth: 2, fill: '#3b82f6' }} />
                    <Line yAxisId="lines" type="monotone" dataKey="recebidoAcumulado" name="Recebido Acumulado" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 5, strokeWidth: 2, fill: '#10b981' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Metas de Inadimplência */}
          {(() => {
            const pctInad = data.resumo.percentualInadimplencia;
            const totalInad = data.resumo.totalInadimplente;
            const totalPrev = data.resumo.totalPrevisto;

            const metas = [
              { label: "Meta Ideal", target: 4 },
              { label: "Meta Máxima", target: 6 },
            ];

            const getStatusBadge = (pct: number, target: number) => {
              if (pct > target) return { label: 'CRÍTICO', className: 'bg-red-500 text-white hover:bg-red-500' };
              if (pct > target * 0.75) return { label: 'ATENÇÃO', className: 'bg-amber-500 text-white hover:bg-amber-500' };
              return { label: 'OK', className: 'bg-emerald-500 text-white hover:bg-emerald-500' };
            };

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {metas.map(({ label, target }) => {
                  const limiteReais = totalPrev * (target / 100);
                  const progressoPct = totalPrev > 0 ? Math.min((pctInad / target) * 100, 100) : 0;
                  const dentroMeta = pctInad <= target;
                  const excedente = totalInad - limiteReais;
                  const statusBadge = getStatusBadge(pctInad, target);

                  return (
                    <div
                      key={target}
                      className={cn(
                        "bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-lg p-5",
                        dentroMeta
                          ? "border-l-[3px] border-l-emerald-500 dark:border-l-emerald-400"
                          : "border-l-[3px] border-l-red-500 dark:border-l-red-400"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                            <Badge className={`text-[10px] px-1.5 py-0 ${statusBadge.className}`}>
                              {statusBadge.label}
                            </Badge>
                          </div>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-2xl font-semibold text-foreground">{pctInad.toFixed(2)}%</span>
                            <span className="text-sm text-muted-foreground">/ {target}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Progresso</span>
                          <span>{progressoPct.toFixed(0)}% do limite</span>
                        </div>
                        <div className="relative h-2.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                              dentroMeta ? "bg-emerald-500" : "bg-red-500"
                            }`}
                            style={{ width: `${Math.min(progressoPct, 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Inadimplente Atual</p>
                          <p className="text-sm font-semibold mt-0.5">{formatCurrency(totalInad)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Limite ({target}%)</p>
                          <p className="text-sm font-semibold mt-0.5">{formatCurrency(limiteReais)}</p>
                        </div>
                      </div>

                      {!dentroMeta && (
                        <div className="mt-3 px-3 py-2 bg-red-50 dark:bg-red-950/30 rounded-lg">
                          <p className="text-xs font-medium text-red-600 dark:text-red-400">
                            Excedente: {formatCurrency(excedente)} acima do limite
                          </p>
                        </div>
                      )}
                      {dentroMeta && (
                        <div className="mt-3 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            Folga: {formatCurrency(Math.abs(excedente))} abaixo do limite
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

        </>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-12">
          Sem dados para o período selecionado.
        </p>
      )}

      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              Detalhes do Dia {selectedDay ? new Date(selectedDay + 'T12:00:00').toLocaleDateString('pt-BR') : ''}
            </DialogTitle>
            <DialogDescription>
              Parcelas com vencimento nesta data
            </DialogDescription>
          </DialogHeader>

          {isLoadingDetalhes ? (
            <div className="space-y-4 p-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : diaDetalhes ? (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="p-3 bg-gray-50 dark:bg-zinc-800/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Previsto</p>
                  <p className="text-lg font-medium">{formatCurrency(diaDetalhes.resumo.totalPrevisto)}</p>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Recebido</p>
                  <p className="text-lg font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(diaDetalhes.resumo.totalRecebido)}</p>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                  <p className="text-xs text-amber-600 dark:text-amber-400">Pendente</p>
                  <p className="text-lg font-medium text-amber-600 dark:text-amber-400">{formatCurrency(diaDetalhes.resumo.totalPendente)}</p>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                  <p className="text-xs text-red-600 dark:text-red-400">Inadimplente</p>
                  <p className="text-lg font-medium text-red-600 dark:text-red-400">{formatCurrency(diaDetalhes.resumo.totalInadimplente)}</p>
                </div>
              </div>

              <Tabs defaultValue="todas" className="flex-1 overflow-hidden flex flex-col">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="todas" data-testid="tab-todas">
                    Todas ({diaDetalhes.parcelas.length})
                  </TabsTrigger>
                  <TabsTrigger value="pagas" data-testid="tab-pagas" className="text-emerald-600">
                    Pagas ({parcelasPagas.length})
                  </TabsTrigger>
                  <TabsTrigger value="pendentes" data-testid="tab-pendentes" className="text-amber-600">
                    Pendentes ({parcelasPendentes.length})
                  </TabsTrigger>
                  <TabsTrigger value="inadimplentes" data-testid="tab-inadimplentes" className="text-red-600">
                    Inadimplentes ({parcelasInadimplentes.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="todas" className="flex-1 overflow-hidden mt-4">
                  <ParcelasList parcelas={diaDetalhes.parcelas} />
                </TabsContent>
                <TabsContent value="pagas" className="flex-1 overflow-hidden mt-4">
                  <ParcelasList parcelas={parcelasPagas} />
                </TabsContent>
                <TabsContent value="pendentes" className="flex-1 overflow-hidden mt-4">
                  <ParcelasList parcelas={parcelasPendentes} />
                </TabsContent>
                <TabsContent value="inadimplentes" className="flex-1 overflow-hidden mt-4">
                  <ParcelasList parcelas={parcelasInadimplentes} />
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              Nenhum dado disponível
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ParcelasList({ parcelas }: { parcelas: DiaDetalhesData['parcelas'] }) {
  if (parcelas.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        Nenhuma parcela encontrada
      </div>
    );
  }

  const statusColors = {
    pago: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    pendente: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    inadimplente: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  const statusLabels = {
    pago: 'Pago',
    pendente: 'Pendente',
    inadimplente: 'Inadimplente',
  };

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3 pr-4">
        {parcelas.map((parcela) => (
          <Card key={parcela.id} className="p-4" data-testid={`card-parcela-${parcela.id}`}>
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold truncate">{parcela.nomeCliente}</h4>
                    <Badge variant="outline" className={statusColors[parcela.status]}>
                      {statusLabels[parcela.status]}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{parcela.descricao}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-lg">{formatCurrency(parcela.valorBruto)}</p>
                  {parcela.status === 'pago' && parcela.valorPago > 0 && (
                    <p className="text-xs text-emerald-600">Pago: {formatCurrency(parcela.valorPago)}</p>
                  )}
                  {parcela.naoPago > 0 && parcela.status !== 'pago' && (
                    <p className="text-xs text-red-600">Falta: {formatCurrency(parcela.naoPago)}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                {parcela.cnpj && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Building2 className="w-3.5 h-3.5" />
                    <span className="truncate">{parcela.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.***.***/****-$5')}</span>
                  </div>
                )}
                {parcela.responsavel && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <User className="w-3.5 h-3.5" />
                    <span className="truncate">{parcela.responsavel}</span>
                  </div>
                )}
                {parcela.squad && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Briefcase className="w-3.5 h-3.5" />
                    <span className="truncate">{parcela.squad}</span>
                  </div>
                )}
                {parcela.servico && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <FileText className="w-3.5 h-3.5" />
                    <span className="truncate">{parcela.servico}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                {parcela.statusClickup && (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-xs">
                      {parcela.statusClickup}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{parcela.empresa}</span>
                  </div>
                )}
                {parcela.status === 'inadimplente' && parcela.telefone && (
                  <a
                    href={`https://wa.me/55${parcela.telefone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-md transition-colors"
                    data-testid={`btn-whatsapp-${parcela.id}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    WhatsApp
                  </a>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
