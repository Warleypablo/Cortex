import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ComposedChart,
  Line,
  Tooltip as RechartsTooltip,
  Legend,
  Cell,
} from "recharts";
import {
  AlertTriangle,
  Users,
  DollarSign,
  Clock,
  TrendingDown,
  Building2,
  Filter,
  Search,
  Eye,
  Receipt,
  Loader2,
  X,
  AlertCircle,
  CreditCard,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface InadimplenciaResumo {
  totalInadimplente: number;
  quantidadeClientes: number;
  quantidadeParcelas: number;
  ticketMedio: number;
  valorUltimos45Dias: number;
  quantidadeUltimos45Dias: number;
  faixas: {
    ate30dias: { valor: number; quantidade: number; percentual: number };
    de31a60dias: { valor: number; quantidade: number; percentual: number };
    de61a90dias: { valor: number; quantidade: number; percentual: number };
    acima90dias: { valor: number; quantidade: number; percentual: number };
  };
  evolucaoMensal: { mes: string; mesLabel: string; valor: number; quantidade: number }[];
}

interface ClienteInadimplente {
  idCliente: string;
  nomeCliente: string;
  valorTotal: number;
  quantidadeParcelas: number;
  parcelaMaisAntiga: string;
  diasAtrasoMax: number;
  empresa: string;
  cnpj: string | null;
  statusClickup: string | null;
  responsavel: string | null;
  cluster: string | null;
  servicos: string | null;
}

interface EmpresaInadimplente {
  empresa: string;
  valorTotal: number;
  quantidadeClientes: number;
  quantidadeParcelas: number;
  percentual: number;
}

interface MetodoPagamentoInadimplente {
  metodo: string;
  valorTotal: number;
  quantidadeClientes: number;
  quantidadeParcelas: number;
  percentual: number;
}

interface ParcelaDetalhe {
  id: number;
  descricao: string;
  valorBruto: number;
  naoPago: number;
  dataVencimento: string;
  diasAtraso: number;
  empresa: string;
  status: string;
}

const COLORS = {
  ate30dias: "#22c55e",
  de31a60dias: "#f59e0b",
  de61a90dias: "#f97316",
  acima90dias: "#ef4444",
};

const FAIXA_LABELS = {
  ate30dias: "1-30 dias",
  de31a60dias: "31-60 dias",
  de61a90dias: "61-90 dias",
  acima90dias: "90+ dias",
};

function ErrorDisplay({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground" data-testid="error-display">
      <AlertCircle className="h-10 w-10 mb-2 text-destructive" />
      <p>{message}</p>
    </div>
  );
}

export default function DashboardInadimplencia() {
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [ordenarPor, setOrdenarPor] = useState<"valor" | "diasAtraso" | "nome">("valor");
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteInadimplente | null>(null);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");

  useEffect(() => {
    setClienteSelecionado(null);
  }, [dataInicio, dataFim]);

  const resumoParams = {
    ...(dataInicio && { dataInicio }),
    ...(dataFim && { dataFim }),
  };

  const clientesParams = {
    ...(dataInicio && { dataInicio }),
    ...(dataFim && { dataFim }),
    ordenarPor,
    limite: "200",
  };

  const empresasParams = {
    ...(dataInicio && { dataInicio }),
    ...(dataFim && { dataFim }),
  };

  const { data: resumoData, isLoading: isLoadingResumo, isError: isErrorResumo } = useQuery<InadimplenciaResumo>({
    queryKey: ['/api/inadimplencia/resumo', resumoParams],
  });

  const { data: clientesData, isLoading: isLoadingClientes, isError: isErrorClientes } = useQuery<{ clientes: ClienteInadimplente[] }>({
    queryKey: ['/api/inadimplencia/clientes', clientesParams],
  });

  const { data: empresasData, isLoading: isLoadingEmpresas, isError: isErrorEmpresas } = useQuery<{ empresas: EmpresaInadimplente[] }>({
    queryKey: ['/api/inadimplencia/por-empresa', empresasParams],
  });

  const { data: metodosData, isLoading: isLoadingMetodos, isError: isErrorMetodos } = useQuery<{ metodos: MetodoPagamentoInadimplente[] }>({
    queryKey: ['/api/inadimplencia/por-metodo-pagamento', empresasParams],
  });

  const parcelasParams = {
    ...(dataInicio && { dataInicio }),
    ...(dataFim && { dataFim }),
  };

  const parcelasUrl = clienteSelecionado?.idCliente 
    ? `/api/inadimplencia/cliente/${encodeURIComponent(clienteSelecionado.idCliente)}/parcelas`
    : '/api/inadimplencia/cliente/none/parcelas';

  const { data: parcelasData, isLoading: isLoadingParcelas, isError: isErrorParcelas } = useQuery<{ parcelas: ParcelaDetalhe[] }>({
    queryKey: [parcelasUrl, parcelasParams],
    enabled: !!clienteSelecionado?.idCliente,
  });

  // Extrair status únicos dos clientes para o filtro
  const statusUnicos = useMemo(() => {
    if (!clientesData?.clientes) return [];
    const statusSet = new Set<string>();
    clientesData.clientes.forEach((c) => {
      if (c.statusClickup) {
        statusSet.add(c.statusClickup);
      }
    });
    return Array.from(statusSet).sort();
  }, [clientesData]);

  const clientesFiltrados = useMemo(() => {
    if (!clientesData?.clientes) return [];
    
    let filtrados = clientesData.clientes;
    
    // Filtrar por status
    if (statusFiltro !== "todos") {
      if (statusFiltro === "sem-status") {
        filtrados = filtrados.filter((c) => !c.statusClickup);
      } else {
        filtrados = filtrados.filter((c) => c.statusClickup === statusFiltro);
      }
    }
    
    // Filtrar por busca
    if (busca.trim()) {
      const termo = busca.toLowerCase();
      filtrados = filtrados.filter(
        (c) =>
          c.nomeCliente.toLowerCase().includes(termo) ||
          c.empresa.toLowerCase().includes(termo)
      );
    }
    
    return filtrados;
  }, [clientesData, busca, statusFiltro]);

  const faixasChartData = useMemo(() => {
    if (!resumoData) return [];
    return Object.entries(resumoData.faixas).map(([key, value]) => ({
      name: FAIXA_LABELS[key as keyof typeof FAIXA_LABELS],
      valor: value.valor,
      quantidade: value.quantidade,
      percentual: value.percentual,
      fill: COLORS[key as keyof typeof COLORS],
    }));
  }, [resumoData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCurrencyCompact = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `R$ ${(value / 1000).toFixed(0)}k`;
    }
    return `R$ ${value.toFixed(0)}`;
  };

  const limparFiltros = () => {
    setDataInicio("");
    setDataFim("");
    setBusca("");
    setStatusFiltro("todos");
  };

  const getDiasAtrasoColor = (dias: number) => {
    if (dias <= 30) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    if (dias <= 60) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    if (dias <= 90) return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes("ativo") || statusLower.includes("onboarding")) return "default";
    if (statusLower.includes("churn") || statusLower.includes("cancelado") || statusLower.includes("encerrado")) return "destructive";
    if (statusLower.includes("triagem") || statusLower.includes("prospect")) return "secondary";
    return "outline";
  };

  const KPICard = ({
    title,
    value,
    subtitle,
    icon: Icon,
    variant = "default",
    loading = false,
    testId,
  }: {
    title: string;
    value: string;
    subtitle?: string;
    icon: any;
    variant?: "default" | "success" | "danger" | "warning" | "info";
    loading?: boolean;
    testId: string;
  }) => {
    const variantStyles = {
      default: {
        bg: "bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900",
        icon: "bg-primary/10 text-primary",
      },
      success: {
        bg: "bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/20",
        icon: "bg-green-500/20 text-green-600 dark:text-green-400",
      },
      danger: {
        bg: "bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-900/30 dark:to-rose-900/20",
        icon: "bg-red-500/20 text-red-600 dark:text-red-400",
      },
      warning: {
        bg: "bg-gradient-to-br from-amber-50 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/20",
        icon: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
      },
      info: {
        bg: "bg-gradient-to-br from-blue-50 to-sky-100 dark:from-blue-900/30 dark:to-sky-900/20",
        icon: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
      },
    };

    const styles = variantStyles[variant];

    if (loading) {
      return (
        <Card className={`${styles.bg} border-0 shadow-lg overflow-hidden`} data-testid={`${testId}-loading`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-2 flex-1 min-w-0">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className={`${styles.bg} border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 overflow-hidden`} data-testid={testId}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground truncate">{title}</p>
              <p className="text-lg font-bold text-foreground truncate" data-testid={`${testId}-value`}>{value}</p>
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
            <div className={`p-2.5 rounded-xl ${styles.icon} flex-shrink-0`}>
              <Icon className="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderFiltros = () => (
    <Card className="mb-6" data-testid="card-filtros">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
          {(dataInicio || dataFim) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={limparFiltros}
              className="text-muted-foreground hover:text-foreground"
              data-testid="button-limpar-filtros"
            >
              <X className="h-4 w-4 mr-1" />
              Limpar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1.5">
            <Label htmlFor="dataInicio" className="text-sm">Data Vencimento Inicial</Label>
            <Input
              id="dataInicio"
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-40"
              data-testid="input-data-inicio"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dataFim" className="text-sm">Data Vencimento Final</Label>
            <Input
              id="dataFim"
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-40"
              data-testid="input-data-fim"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const hoje = new Date();
                const inicio = subDays(hoje, 45);
                setDataInicio(format(inicio, "yyyy-MM-dd"));
                setDataFim(format(hoje, "yyyy-MM-dd"));
              }}
              data-testid="button-ultimos-45-dias"
            >
              Últimos 45 dias
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const hoje = new Date();
                const inicio = subDays(hoje, 90);
                setDataInicio(format(inicio, "yyyy-MM-dd"));
                setDataFim(format(hoje, "yyyy-MM-dd"));
              }}
              data-testid="button-ultimos-90-dias"
            >
              Últimos 90 dias
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderVisaoGeral = () => (
    <div className="space-y-6" data-testid="section-visao-geral">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Inadimplente"
          value={formatCurrency(resumoData?.totalInadimplente || 0)}
          subtitle={`${resumoData?.quantidadeParcelas || 0} parcelas em aberto`}
          icon={AlertTriangle}
          variant="danger"
          loading={isLoadingResumo}
          testId="kpi-total-inadimplente"
        />
        <KPICard
          title="Clientes Inadimplentes"
          value={String(resumoData?.quantidadeClientes || 0)}
          subtitle="Com valores em atraso"
          icon={Users}
          variant="warning"
          loading={isLoadingResumo}
          testId="kpi-clientes-inadimplentes"
        />
        <KPICard
          title="Ticket Médio"
          value={formatCurrency(resumoData?.ticketMedio || 0)}
          subtitle="Valor médio por cliente"
          icon={DollarSign}
          variant="info"
          loading={isLoadingResumo}
          testId="kpi-ticket-medio"
        />
        <KPICard
          title="Últimos 45 dias"
          value={formatCurrency(resumoData?.valorUltimos45Dias || 0)}
          subtitle={`${resumoData?.quantidadeUltimos45Dias || 0} parcelas recentes`}
          icon={Clock}
          variant="warning"
          loading={isLoadingResumo}
          testId="kpi-ultimos-45-dias"
        />
      </div>

      {isErrorResumo && (
        <ErrorDisplay message="Erro ao carregar dados de resumo. Tente novamente." />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-distribuicao-faixas">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Distribuição por Faixa de Atraso
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingResumo ? (
              <div className="h-[280px] flex items-center justify-center" data-testid="loading-chart-faixas">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : isErrorResumo ? (
              <ErrorDisplay message="Erro ao carregar dados do gráfico." />
            ) : faixasChartData.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground" data-testid="empty-chart-faixas">
                Nenhum dado disponível
              </div>
            ) : (
              <div className="h-[280px]" data-testid="chart-distribuicao-faixas">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={faixasChartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" tickFormatter={formatCurrencyCompact} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [
                        formatCurrency(value),
                        "Valor",
                      ]}
                    />
                    <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                      {faixasChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2" data-testid="legend-faixas">
              {faixasChartData.map((faixa) => (
                <div key={faixa.name} className="flex items-center gap-2 text-sm">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: faixa.fill }}
                  />
                  <span className="text-muted-foreground">{faixa.name}:</span>
                  <span className="font-medium">{faixa.percentual.toFixed(1)}%</span>
                  <span className="text-muted-foreground">({faixa.quantidade})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-evolucao-mensal">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Evolução Mensal da Inadimplência
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingResumo ? (
              <div className="h-[280px] flex items-center justify-center" data-testid="loading-chart-evolucao">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : isErrorResumo ? (
              <ErrorDisplay message="Erro ao carregar dados do gráfico." />
            ) : !resumoData?.evolucaoMensal?.length ? (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground" data-testid="empty-chart-evolucao">
                Nenhum dado disponível
              </div>
            ) : (
              <div className="h-[280px]" data-testid="chart-evolucao-mensal">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={resumoData.evolucaoMensal} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="mesLabel" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="valor" tickFormatter={formatCurrencyCompact} tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="quantidade" orientation="right" tick={{ fontSize: 11 }} />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === "valor") return [formatCurrency(value), "Valor"];
                        return [value, "Parcelas"];
                      }}
                    />
                    <Legend />
                    <Bar yAxisId="valor" dataKey="valor" fill="#ef4444" name="Valor" radius={[4, 4, 0, 0]} />
                    <Line
                      yAxisId="quantidade"
                      type="monotone"
                      dataKey="quantidade"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="Parcelas"
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-por-empresa">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Inadimplência por Empresa
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingEmpresas ? (
            <div className="space-y-3" data-testid="loading-empresas">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : isErrorEmpresas ? (
            <ErrorDisplay message="Erro ao carregar dados por empresa." />
          ) : !empresasData?.empresas?.length ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground" data-testid="empty-empresas">
              Nenhum dado disponível
            </div>
          ) : (
            <div className="space-y-3" data-testid="list-empresas">
              {empresasData.empresas.map((empresa, index) => (
                <div key={empresa.empresa} className="flex items-center gap-4" data-testid={`row-empresa-${index}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium truncate">{empresa.empresa}</span>
                      <span className="text-sm text-muted-foreground">
                        {empresa.quantidadeClientes} cliente{empresa.quantidadeClientes !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <Progress value={empresa.percentual} className="h-2" />
                  </div>
                  <div className="text-right min-w-[100px]">
                    <p className="font-bold text-red-600 dark:text-red-400">
                      {formatCurrency(empresa.valorTotal)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {empresa.percentual.toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-por-metodo-pagamento">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Inadimplência por Método de Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingMetodos ? (
            <div className="space-y-3" data-testid="loading-metodos">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : isErrorMetodos ? (
            <ErrorDisplay message="Erro ao carregar dados por método de pagamento." />
          ) : !metodosData?.metodos?.length ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground" data-testid="empty-metodos">
              Nenhum dado disponível
            </div>
          ) : (
            <div className="space-y-3" data-testid="list-metodos">
              {metodosData.metodos.map((metodo, index) => (
                <div key={metodo.metodo} className="flex items-center gap-4" data-testid={`row-metodo-${index}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium truncate">{metodo.metodo}</span>
                      <span className="text-sm text-muted-foreground">
                        {metodo.quantidadeParcelas} parcela{metodo.quantidadeParcelas !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <Progress value={metodo.percentual} className="h-2" />
                  </div>
                  <div className="text-right min-w-[100px]">
                    <p className="font-bold text-red-600 dark:text-red-400">
                      {formatCurrency(metodo.valorTotal)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {metodo.percentual.toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderClientes = () => (
    <div className="space-y-4" data-testid="section-clientes">
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente ou empresa..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
            data-testid="input-busca-cliente"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Ordenar por:</Label>
          <Select value={ordenarPor} onValueChange={(v) => setOrdenarPor(v as any)}>
            <SelectTrigger className="w-40" data-testid="select-ordenar">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="valor" data-testid="option-ordenar-valor">Maior Valor</SelectItem>
              <SelectItem value="diasAtraso" data-testid="option-ordenar-dias">Maior Atraso</SelectItem>
              <SelectItem value="nome" data-testid="option-ordenar-nome">Nome A-Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filtro de Status */}
      <div className="flex items-center gap-2" data-testid="filtro-status">
        <Label className="text-sm text-muted-foreground flex items-center gap-1">
          <Filter className="h-4 w-4" />
          Status:
        </Label>
        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger className="w-56" data-testid="select-filtro-status">
            <SelectValue placeholder="Selecione um status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos" data-testid="option-status-todos">
              <span className="flex items-center gap-2">
                Todos ({clientesData?.clientes?.length || 0})
              </span>
            </SelectItem>
            {statusUnicos.map((status) => {
              const count = clientesData?.clientes?.filter(c => c.statusClickup === status).length || 0;
              const statusLower = status.toLowerCase();
              const isAtivo = statusLower.includes("ativo") && !statusLower.includes("inativo") && !statusLower.includes("cancelado");
              const isCancelado = statusLower.includes("cancelado") || statusLower.includes("cancelamento") || statusLower.includes("inativo");
              const dotColor = isAtivo ? "bg-green-500" : isCancelado ? "bg-red-500" : "bg-blue-500";
              
              return (
                <SelectItem key={status} value={status} data-testid={`option-status-${status.toLowerCase().replace(/\s+/g, '-')}`}>
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                    {status} ({count})
                  </span>
                </SelectItem>
              );
            })}
            {clientesData?.clientes?.some(c => !c.statusClickup) && (
              <SelectItem value="sem-status" data-testid="option-status-sem-status">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-gray-400" />
                  Sem Status ({clientesData?.clientes?.filter(c => !c.statusClickup).length || 0})
                </span>
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      <Card data-testid="card-tabela-clientes">
        <CardContent className="p-0">
          {isLoadingClientes ? (
            <div className="p-8 flex items-center justify-center" data-testid="loading-clientes">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : isErrorClientes ? (
            <ErrorDisplay message="Erro ao carregar lista de clientes. Tente novamente." />
          ) : clientesFiltrados.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground" data-testid="empty-clientes">
              {busca ? "Nenhum cliente encontrado com os filtros aplicados" : "Nenhum cliente inadimplente"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status ClickUp</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Serviços</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-center">Parcelas</TableHead>
                    <TableHead className="text-center">Dias Atraso</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientesFiltrados.map((cliente) => (
                    <TableRow key={cliente.idCliente} data-testid={`row-cliente-${cliente.idCliente}`}>
                      <TableCell className="font-medium max-w-[180px]">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="truncate cursor-help">
                                <span>{cliente.nomeCliente}</span>
                                {cliente.empresa && (
                                  <p className="text-xs text-muted-foreground truncate">{cliente.empresa}</p>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">{cliente.nomeCliente}</p>
                              {cliente.cnpj && <p className="text-xs">CNPJ: {cliente.cnpj}</p>}
                              {cliente.empresa && <p className="text-xs">Empresa: {cliente.empresa}</p>}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        {cliente.statusClickup ? (
                          <Badge variant={getStatusVariant(cliente.statusClickup)} data-testid={`status-${cliente.idCliente}`}>
                            {cliente.statusClickup}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm max-w-[120px] truncate">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">{cliente.responsavel || "-"}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{cliente.responsavel || "Sem responsável"}</p>
                              {cliente.cluster && <p className="text-xs">Cluster: {cliente.cluster}</p>}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-sm max-w-[150px] truncate">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">{cliente.servicos || "-"}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">{cliente.servicos || "Sem serviços"}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-right font-bold text-red-600 dark:text-red-400" data-testid={`value-cliente-${cliente.idCliente}`}>
                        {formatCurrency(cliente.valorTotal)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{cliente.quantidadeParcelas}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={getDiasAtrasoColor(cliente.diasAtrasoMax)}>
                          {cliente.diasAtrasoMax} dias
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setClienteSelecionado(cliente)}
                          data-testid={`button-ver-parcelas-${cliente.idCliente}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground" data-testid="text-contador-clientes">
        Exibindo {clientesFiltrados.length} de {clientesData?.clientes?.length || 0} clientes
      </div>

      <Dialog open={!!clienteSelecionado} onOpenChange={(open) => !open && setClienteSelecionado(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" data-testid="dialog-parcelas">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Parcelas em Atraso - {clienteSelecionado?.nomeCliente}
            </DialogTitle>
          </DialogHeader>
          {isLoadingParcelas ? (
            <div className="p-8 flex items-center justify-center" data-testid="loading-parcelas">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : isErrorParcelas ? (
            <ErrorDisplay message="Erro ao carregar parcelas do cliente." />
          ) : !parcelasData?.parcelas?.length ? (
            <div className="p-8 text-center text-muted-foreground" data-testid="empty-parcelas">
              Nenhuma parcela encontrada
            </div>
          ) : (
            <>
              <div className="mb-4 p-4 bg-muted/50 rounded-lg" data-testid="resumo-parcelas">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total em Aberto</p>
                    <p className="text-lg font-bold text-red-600 dark:text-red-400" data-testid="total-parcelas-aberto">
                      {formatCurrency(parcelasData.parcelas.reduce((sum, p) => sum + p.naoPago, 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Parcelas</p>
                    <p className="text-lg font-bold" data-testid="quantidade-parcelas">{parcelasData.parcelas.length}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status ClickUp</p>
                    {clienteSelecionado?.statusClickup ? (
                      <Badge variant={getStatusVariant(clienteSelecionado.statusClickup)} className="mt-1">
                        {clienteSelecionado.statusClickup}
                      </Badge>
                    ) : (
                      <p className="text-lg font-bold">-</p>
                    )}
                  </div>
                  <div>
                    <p className="text-muted-foreground">Responsável</p>
                    <p className="text-lg font-bold truncate">{clienteSelecionado?.responsavel || "-"}</p>
                  </div>
                </div>
                {(clienteSelecionado?.servicos || clienteSelecionado?.cnpj) && (
                  <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t text-sm">
                    {clienteSelecionado?.servicos && (
                      <div>
                        <p className="text-muted-foreground">Serviços</p>
                        <p className="font-medium">{clienteSelecionado.servicos}</p>
                      </div>
                    )}
                    {clienteSelecionado?.cnpj && (
                      <div>
                        <p className="text-muted-foreground">CNPJ</p>
                        <p className="font-medium">{clienteSelecionado.cnpj}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor Bruto</TableHead>
                    <TableHead className="text-right">Não Pago</TableHead>
                    <TableHead className="text-center">Vencimento</TableHead>
                    <TableHead className="text-center">Dias Atraso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parcelasData.parcelas.map((parcela) => (
                    <TableRow key={parcela.id} data-testid={`row-parcela-${parcela.id}`}>
                      <TableCell className="max-w-[250px] truncate">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">{parcela.descricao}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-md">{parcela.descricao}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(parcela.valorBruto)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-red-600 dark:text-red-400">
                        {formatCurrency(parcela.naoPago)}
                      </TableCell>
                      <TableCell className="text-center">
                        {format(new Date(parcela.dataVencimento), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={getDiasAtrasoColor(parcela.diasAtraso)}>
                          {parcela.diasAtraso} dias
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <div className="p-6 space-y-6" data-testid="page-inadimplencia">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="title-inadimplencia">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            Inadimplência
          </h1>
          <p className="text-muted-foreground">
            Análise detalhada de clientes com pagamentos em atraso
          </p>
        </div>
      </div>

      {renderFiltros()}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4" data-testid="tabs-inadimplencia">
          <TabsTrigger value="visao-geral" data-testid="tab-visao-geral">
            <TrendingDown className="h-4 w-4 mr-2" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="clientes" data-testid="tab-clientes">
            <Users className="h-4 w-4 mr-2" />
            Clientes ({clientesData?.clientes?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral">
          {renderVisaoGeral()}
        </TabsContent>

        <TabsContent value="clientes">
          {renderClientes()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
