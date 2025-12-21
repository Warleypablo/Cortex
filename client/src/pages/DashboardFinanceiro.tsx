import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Loader2, TrendingUp, TrendingDown, DollarSign, X, ChevronRight, 
  ArrowUpCircle, ArrowDownCircle, Wallet, PieChart, Users, CreditCard,
  Building2, Target, BarChart3, LineChart as LineChartIcon, AlertTriangle,
  Clock, Banknote, Receipt, FileWarning
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  Cell, ComposedChart, Line, PieChart as RechartsPie, Pie, AreaChart, Area,
  LineChart
} from "recharts";
import type { 
  FluxoCaixaItem, FluxoCaixaDiarioItem, SaldoBancos, TransacaoDiaItem,
  FinanceiroResumo, FinanceiroEvolucaoMensal, FinanceiroCategoria, 
  FinanceiroTopCliente, FinanceiroMetodoPagamento, FinanceiroContaBancaria
} from "@shared/schema";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1'];
const COLORS_DESPESA = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4'];

export default function DashboardFinanceiro() {
  useSetPageInfo("Dashboard Financeiro", "Análise completa de receitas, despesas e fluxo de caixa");
  
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [periodoMeses, setPeriodoMeses] = useState(6);
  const [mesSelecionado, setMesSelecionado] = useState<{ ano: number; mes: number; mesAno: string } | null>(null);
  const [diaSelecionado, setDiaSelecionado] = useState<{ ano: number; mes: number; dia: number; diaFormatado: string } | null>(null);
  
  const detalhamentoDiarioRef = useRef<HTMLDivElement>(null);
  const transacoesDiaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDiaSelecionado(null);
  }, [mesSelecionado]);

  const { data: resumoData, isLoading: isLoadingResumo } = useQuery<FinanceiroResumo>({
    queryKey: ["/api/financeiro/resumo"],
  });

  const { data: evolucaoData, isLoading: isLoadingEvolucao } = useQuery<FinanceiroEvolucaoMensal[]>({
    queryKey: ["/api/financeiro/evolucao-mensal", periodoMeses],
    queryFn: async () => {
      const response = await fetch(`/api/financeiro/evolucao-mensal?meses=${periodoMeses}`);
      if (!response.ok) throw new Error('Failed to fetch evolucao');
      return response.json();
    },
  });

  const { data: categoriasData, isLoading: isLoadingCategorias } = useQuery<FinanceiroCategoria[]>({
    queryKey: ["/api/financeiro/categorias"],
  });

  const { data: topClientesData, isLoading: isLoadingClientes } = useQuery<FinanceiroTopCliente[]>({
    queryKey: ["/api/financeiro/top-clientes"],
  });

  const { data: metodosData, isLoading: isLoadingMetodos } = useQuery<FinanceiroMetodoPagamento[]>({
    queryKey: ["/api/financeiro/metodos-pagamento"],
  });

  const { data: contasData, isLoading: isLoadingContas } = useQuery<FinanceiroContaBancaria[]>({
    queryKey: ["/api/financeiro/contas-bancarias"],
  });

  const { data: kpisCompletos, isLoading: isLoadingKpisCompletos } = useQuery<{
    saldoTotal: number;
    aReceberTotal: number;
    aReceberQtd: number;
    aReceberVencidoValor: number;
    aReceberVencidoQtd: number;
    aPagarTotal: number;
    aPagarQtd: number;
    aPagarVencidoValor: number;
    aPagarVencidoQtd: number;
    receitaMesAtual: number;
    despesaMesAtual: number;
    resultadoMesAtual: number;
    margemMesAtual: number;
    receitaMesAnterior: number;
    despesaMesAnterior: number;
    variacaoReceita: number;
    variacaoDespesa: number;
    saldoProjetado: number;
    taxaInadimplencia: number;
  }>({
    queryKey: ["/api/financeiro/kpis-completos"],
  });

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
    return fluxoCaixaData.filter(item => new Date(item.dataVencimento) >= dataLimite);
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
    return Object.values(groupedByMonth).sort((a, b) => {
      const [mesA, anoA] = a.mes.split('/').map(Number);
      const [mesB, anoB] = b.mes.split('/').map(Number);
      return anoA === anoB ? mesA - mesB : anoA - anoB;
    });
  }, [fluxoCaixaFiltrado]);

  const categoriasReceita = useMemo(() => 
    categoriasData?.filter(c => c.tipo === 'RECEITA').slice(0, 8) || [], 
    [categoriasData]
  );

  const categoriasDespesa = useMemo(() => 
    categoriasData?.filter(c => c.tipo === 'DESPESA').slice(0, 8) || [], 
    [categoriasData]
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCurrencyCompact = (value: number) => {
    if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}K`;
    return formatCurrency(value);
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  const handleBarClick = (data: any) => {
    if (data && data.payload && data.payload.mes) {
      const [mes, ano] = data.payload.mes.split('/').map(Number);
      setMesSelecionado({ ano, mes, mesAno: data.payload.mes });
      setTimeout(() => {
        detalhamentoDiarioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  const handleLimparSelecao = () => {
    setMesSelecionado(null);
    setDiaSelecionado(null);
  };

  const handleDiaClick = (data: any) => {
    if (data && data.payload && data.payload.dia && mesSelecionado) {
      const [dia, mes, ano] = data.payload.dia.split('/').map(Number);
      setDiaSelecionado({ ano, mes, dia, diaFormatado: data.payload.dia });
      setTimeout(() => {
        transacoesDiaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  const handleLimparDia = () => {
    setDiaSelecionado(null);
  };

  const getNomeMes = (mesAno: string) => {
    const [mes, ano] = mesAno.split('/');
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${meses[parseInt(mes) - 1]} ${ano}`;
  };

  const KPICard = ({ 
    title, value, subtitle, icon: Icon, trend, trendValue, loading, variant = 'default' 
  }: { 
    title: string; 
    value: string; 
    subtitle?: string; 
    icon: any; 
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    loading?: boolean;
    variant?: 'default' | 'success' | 'danger' | 'warning';
  }) => {
    const variantStyles = {
      default: 'text-foreground',
      success: 'text-green-600',
      danger: 'text-red-600',
      warning: 'text-yellow-600'
    };

    if (loading) {
      return (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-12 w-12 rounded-full" />
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="hover-elevate transition-all duration-200">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className={`text-2xl font-bold ${variantStyles[variant]}`}>{value}</p>
              {(trend || subtitle) && (
                <div className="flex items-center gap-2 mt-1">
                  {trend && trendValue && (
                    <Badge 
                      variant={trend === 'up' ? 'default' : trend === 'down' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {trend === 'up' ? <TrendingUp className="w-3 h-3 mr-1" /> : trend === 'down' ? <TrendingDown className="w-3 h-3 mr-1" /> : null}
                      {trendValue}
                    </Badge>
                  )}
                  {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
                </div>
              )}
            </div>
            <div className={`p-3 rounded-full ${
              variant === 'success' ? 'bg-green-100 dark:bg-green-900/30' :
              variant === 'danger' ? 'bg-red-100 dark:bg-red-900/30' :
              variant === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
              'bg-primary/10'
            }`}>
              <Icon className={`w-6 h-6 ${variantStyles[variant]}`} />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const mesAtualLabel = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  
  const renderVisaoGeral = () => (
    <div className="space-y-6">
      {/* Header com mês atual */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-muted-foreground capitalize">
          Resultados de {mesAtualLabel}
        </h2>
      </div>

      {/* KPIs do Mês Atual */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Receita do Mês"
          value={formatCurrency(kpisCompletos?.receitaMesAtual || 0)}
          icon={TrendingUp}
          variant="success"
          trend={kpisCompletos?.variacaoReceita && kpisCompletos.variacaoReceita > 0 ? 'up' : kpisCompletos?.variacaoReceita && kpisCompletos.variacaoReceita < 0 ? 'down' : 'neutral'}
          trendValue={kpisCompletos?.variacaoReceita ? `${kpisCompletos.variacaoReceita.toFixed(1)}%` : undefined}
          subtitle="vs mês anterior"
          loading={isLoadingKpisCompletos}
        />
        <KPICard
          title="Despesa do Mês"
          value={formatCurrency(kpisCompletos?.despesaMesAtual || 0)}
          icon={TrendingDown}
          variant="danger"
          trend={kpisCompletos?.variacaoDespesa && kpisCompletos.variacaoDespesa > 0 ? 'up' : kpisCompletos?.variacaoDespesa && kpisCompletos.variacaoDespesa < 0 ? 'down' : 'neutral'}
          trendValue={kpisCompletos?.variacaoDespesa ? `${kpisCompletos.variacaoDespesa.toFixed(1)}%` : undefined}
          subtitle="vs mês anterior"
          loading={isLoadingKpisCompletos}
        />
        <KPICard
          title="Resultado do Mês"
          value={formatCurrency(kpisCompletos?.resultadoMesAtual || 0)}
          icon={Banknote}
          variant={(kpisCompletos?.resultadoMesAtual || 0) >= 0 ? 'success' : 'danger'}
          loading={isLoadingKpisCompletos}
        />
        <KPICard
          title="Margem do Mês"
          value={`${(kpisCompletos?.margemMesAtual || 0).toFixed(1)}%`}
          icon={PieChart}
          variant={(kpisCompletos?.margemMesAtual || 0) >= 20 ? 'success' : (kpisCompletos?.margemMesAtual || 0) >= 0 ? 'warning' : 'danger'}
          subtitle="Receita - Despesa / Receita"
          loading={isLoadingKpisCompletos}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Evolução Receita vs Despesa
                </CardTitle>
                <CardDescription>Últimos {periodoMeses} meses</CardDescription>
              </div>
              <Select value={periodoMeses.toString()} onValueChange={(v) => setPeriodoMeses(Number(v))}>
                <SelectTrigger className="w-[140px]" data-testid="select-periodo-evolucao">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6 meses</SelectItem>
                  <SelectItem value="12">12 meses</SelectItem>
                  <SelectItem value="24">24 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingEvolucao ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : evolucaoData && evolucaoData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={evolucaoData}>
                  <defs>
                    <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mesLabel" tick={{ fill: 'currentColor', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'currentColor' }} tickFormatter={formatCurrencyCompact} />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="receita" name="Receita" stroke="#22c55e" fillOpacity={1} fill="url(#colorReceita)" />
                  <Area type="monotone" dataKey="despesa" name="Despesa" stroke="#ef4444" fillOpacity={1} fill="url(#colorDespesa)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Sem dados disponíveis
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChartIcon className="w-5 h-5" />
              Margem Operacional Mensal
            </CardTitle>
            <CardDescription>Evolução da margem ao longo do tempo</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingEvolucao ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : evolucaoData && evolucaoData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={evolucaoData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mesLabel" tick={{ fill: 'currentColor', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'currentColor' }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                  <Tooltip 
                    formatter={(value: number) => `${value.toFixed(1)}%`}
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="margemPercentual" 
                    name="Margem %" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#3b82f6' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Sem dados disponíveis
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Contas Bancárias
            </CardTitle>
            <CardDescription>Saldo atual por conta</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingContas ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : contasData && contasData.length > 0 ? (
              <div className="space-y-3">
                {contasData.slice(0, 5).map((conta, idx) => (
                  <div key={conta.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-8 rounded-full`} style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <div>
                        <p className="font-medium text-sm">{conta.nome}</p>
                        <p className="text-xs text-muted-foreground">{conta.empresa}</p>
                      </div>
                    </div>
                    <span className={`font-bold ${conta.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(conta.saldo)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Sem contas disponíveis
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Métodos de Pagamento
            </CardTitle>
            <CardDescription>Distribuição de recebimentos</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingMetodos ? (
              <div className="h-[250px] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : metodosData && metodosData.length > 0 ? (
              <div className="flex items-center">
                <ResponsiveContainer width="50%" height={250}>
                  <RechartsPie>
                    <Pie
                      data={metodosData}
                      dataKey="valor"
                      nameKey="metodo"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    >
                      {metodosData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </RechartsPie>
                </ResponsiveContainer>
                <div className="w-1/2 space-y-2">
                  {metodosData.slice(0, 5).map((metodo, idx) => (
                    <div key={metodo.metodo} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="text-sm truncate flex-1">{metodo.metodo}</span>
                      <span className="text-sm font-medium">{formatPercent(metodo.percentual)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Sem dados disponíveis
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderCategorias = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <TrendingUp className="w-5 h-5" />
              Receitas por Categoria
            </CardTitle>
            <CardDescription>Top 8 categorias de receita</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingCategorias ? (
              <div className="h-[350px] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : categoriasReceita.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={categoriasReceita} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={formatCurrencyCompact} />
                  <YAxis 
                    type="category" 
                    dataKey="categoriaNome" 
                    width={150}
                    tick={{ fill: 'currentColor', fontSize: 11 }}
                    tickFormatter={(value) => value.length > 20 ? value.substring(0, 20) + '...' : value}
                  />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="valor" name="Valor" fill="#22c55e" radius={[0, 4, 4, 0]}>
                    {categoriasReceita.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                Sem dados disponíveis
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <TrendingDown className="w-5 h-5" />
              Despesas por Categoria
            </CardTitle>
            <CardDescription>Top 8 categorias de despesa</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingCategorias ? (
              <div className="h-[350px] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : categoriasDespesa.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={categoriasDespesa} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={formatCurrencyCompact} />
                  <YAxis 
                    type="category" 
                    dataKey="categoriaNome" 
                    width={150}
                    tick={{ fill: 'currentColor', fontSize: 11 }}
                    tickFormatter={(value) => value.length > 20 ? value.substring(0, 20) + '...' : value}
                  />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="valor" name="Valor" radius={[0, 4, 4, 0]}>
                    {categoriasDespesa.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS_DESPESA[index % COLORS_DESPESA.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                Sem dados disponíveis
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Categoria</CardTitle>
          <CardDescription>Todas as categorias com valores e percentuais</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingCategorias ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : categoriasData && categoriasData.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoriasData.slice(0, 15).map((cat) => (
                    <TableRow key={`${cat.categoriaId}-${cat.tipo}`}>
                      <TableCell className="font-medium">{cat.categoriaNome}</TableCell>
                      <TableCell>
                        <Badge variant={cat.tipo === 'RECEITA' ? 'default' : 'destructive'}>
                          {cat.tipo === 'RECEITA' ? 'Receita' : 'Despesa'}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${cat.tipo === 'RECEITA' ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(cat.valor)}
                      </TableCell>
                      <TableCell className="text-right">{formatPercent(cat.percentual)}</TableCell>
                      <TableCell className="text-right">{cat.quantidade}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              Sem dados disponíveis
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderClientes = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title="Total Receita Clientes"
          value={formatCurrency(topClientesData?.reduce((sum, c) => sum + c.receitaTotal, 0) || 0)}
          icon={DollarSign}
          variant="success"
          subtitle="Top 10 clientes"
          loading={isLoadingClientes}
        />
        <KPICard
          title="Ticket Médio"
          value={formatCurrency(
            topClientesData && topClientesData.length > 0 
              ? topClientesData.reduce((sum, c) => sum + c.ticketMedio, 0) / topClientesData.length 
              : 0
          )}
          icon={Target}
          loading={isLoadingClientes}
        />
        <KPICard
          title="Total Títulos"
          value={`${topClientesData?.reduce((sum, c) => sum + c.quantidadeTitulos, 0) || 0}`}
          icon={BarChart3}
          loading={isLoadingClientes}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Ranking de Clientes por Receita
          </CardTitle>
          <CardDescription>Top 10 clientes nos últimos 12 meses</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingClientes ? (
            <div className="h-[400px] flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : topClientesData && topClientesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={topClientesData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tickFormatter={formatCurrencyCompact} />
                <YAxis 
                  type="category" 
                  dataKey="clienteNome" 
                  width={180}
                  tick={{ fill: 'currentColor', fontSize: 11 }}
                  tickFormatter={(value) => value.length > 25 ? value.substring(0, 25) + '...' : value}
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)} 
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}
                />
                <Bar dataKey="receitaTotal" name="Receita Total" fill="#22c55e" radius={[0, 4, 4, 0]}>
                  {topClientesData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[400px] flex items-center justify-center text-muted-foreground">
              Sem dados disponíveis
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Cliente</CardTitle>
          <CardDescription>Informações completas dos principais clientes</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingClientes ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : topClientesData && topClientesData.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Receita Total</TableHead>
                    <TableHead className="text-right">Ticket Médio</TableHead>
                    <TableHead className="text-right">Títulos</TableHead>
                    <TableHead className="text-right">Último Pgto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topClientesData.map((cliente, idx) => (
                    <TableRow key={cliente.clienteId}>
                      <TableCell>
                        <Badge variant={idx < 3 ? 'default' : 'secondary'}>
                          {idx + 1}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{cliente.clienteNome}</TableCell>
                      <TableCell className="text-right text-green-600 font-bold">
                        {formatCurrency(cliente.receitaTotal)}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(cliente.ticketMedio)}</TableCell>
                      <TableCell className="text-right">{cliente.quantidadeTitulos}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {cliente.ultimoPagamento || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              Sem dados disponíveis
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderFluxoCaixa = () => (
    <div className="space-y-6">
      <Card>
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
          {isLoadingFluxo ? (
            <div className="h-[400px] flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData} data-testid="chart-fluxo-caixa">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" tick={{ fill: 'currentColor' }} />
                <YAxis tick={{ fill: 'currentColor' }} tickFormatter={formatCurrencyCompact} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}
                />
                <Legend />
                <Bar dataKey="receitas" name="Receitas" fill="#16a34a" radius={[4, 4, 0, 0]} cursor="pointer" onClick={handleBarClick}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-receita-${index}`} opacity={mesSelecionado?.mesAno === entry.mes ? 1 : 0.7} />
                  ))}
                </Bar>
                <Bar dataKey="despesas" name="Despesas" fill="#dc2626" radius={[4, 4, 0, 0]} cursor="pointer" onClick={handleBarClick}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-despesa-${index}`} opacity={mesSelecionado?.mesAno === entry.mes ? 1 : 0.7} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[400px] flex items-center justify-center text-muted-foreground">
              Nenhum dado disponível para o período selecionado
            </div>
          )}
        </CardContent>
      </Card>

      {mesSelecionado && (
        <Card ref={detalhamentoDiarioRef} data-testid="card-detalhamento-diario">
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
              <Button variant="ghost" size="icon" onClick={handleLimparSelecao} data-testid="button-limpar-selecao">
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
                    <XAxis dataKey="dia" tick={{ fill: 'currentColor', fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
                    <YAxis yAxisId="left" tick={{ fill: 'currentColor' }} tickFormatter={formatCurrencyCompact} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: 'currentColor' }} tickFormatter={formatCurrencyCompact} />
                    <Tooltip 
                      formatter={(value: number, name: string) => [formatCurrency(value), name === 'saldoAcumulado' ? 'Saldo Acumulado' : name]}
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="receitas" name="Receitas" fill="#16a34a" radius={[4, 4, 0, 0]} cursor="pointer" onClick={handleDiaClick}>
                      {fluxoCaixaDiarioData.map((entry, index) => (
                        <Cell key={`cell-receita-${index}`} opacity={diaSelecionado?.diaFormatado === entry.dia ? 1 : 0.7} />
                      ))}
                    </Bar>
                    <Bar yAxisId="left" dataKey="despesas" name="Despesas" fill="#dc2626" radius={[4, 4, 0, 0]} cursor="pointer" onClick={handleDiaClick}>
                      {fluxoCaixaDiarioData.map((entry, index) => (
                        <Cell key={`cell-despesa-${index}`} opacity={diaSelecionado?.diaFormatado === entry.dia ? 1 : 0.7} />
                      ))}
                    </Bar>
                    <Line yAxisId="right" type="monotone" dataKey="saldoAcumulado" name="Saldo Acumulado" stroke="#1d4ed8" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                Nenhum dado disponível para este mês
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {diaSelecionado && (
        <Card ref={transacoesDiaRef} data-testid="card-transacoes-dia">
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
              <Button variant="ghost" size="icon" onClick={handleLimparDia} data-testid="button-limpar-dia">
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
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                Nenhuma transação encontrada para este dia
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
            <TabsTrigger value="visao-geral" className="gap-2" data-testid="tab-visao-geral">
              <PieChart className="w-4 h-4" />
              <span className="hidden sm:inline">Visão Geral</span>
            </TabsTrigger>
            <TabsTrigger value="categorias" className="gap-2" data-testid="tab-categorias">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Categorias</span>
            </TabsTrigger>
            <TabsTrigger value="clientes" className="gap-2" data-testid="tab-clientes">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Clientes</span>
            </TabsTrigger>
            <TabsTrigger value="fluxo-caixa" className="gap-2" data-testid="tab-fluxo-caixa">
              <DollarSign className="w-4 h-4" />
              <span className="hidden sm:inline">Fluxo de Caixa</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="visao-geral" className="mt-6">
            {renderVisaoGeral()}
          </TabsContent>

          <TabsContent value="categorias" className="mt-6">
            {renderCategorias()}
          </TabsContent>

          <TabsContent value="clientes" className="mt-6">
            {renderClientes()}
          </TabsContent>

          <TabsContent value="fluxo-caixa" className="mt-6">
            {renderFluxoCaixa()}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
