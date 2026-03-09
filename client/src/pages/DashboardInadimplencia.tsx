import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatCurrency, formatCurrencyCompact, formatPercent } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { usePageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Cell,
  LabelList,
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
  AlertCircle,
  CreditCard,
  RotateCcw,
  ExternalLink,
  MessageSquarePlus,
  CheckCircle2,
  Pause,
  XCircle,
  BarChart3,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";

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

interface VendedorInadimplente {
  vendedor: string;
  valorTotal: number;
  quantidadeClientes: number;
  quantidadeParcelas: number;
  percentual: number;
}

interface SquadInadimplente {
  squad: string;
  valorTotal: number;
  quantidadeClientes: number;
  quantidadeParcelas: number;
  percentual: number;
}

interface ResponsavelInadimplente {
  responsavel: string;
  valorTotal: number;
  quantidadeClientes: number;
  quantidadeParcelas: number;
  percentual: number;
}

interface ProdutoInadimplente {
  produto: string;
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
  urlCobranca: string | null;
}

interface MetricasRecebimento {
  tempoMedioRecebimento: number;
  tempoMedioRecebimentoInadimplentes: number;
  clientesInadimPrimeiraParcela: number;
  percentualInadimPrimeiraParcela: number;
  valorInadimPrimeiraParcela: number;
  clientesNuncaPagaram: number;
  percentualNuncaPagaram: number;
  valorNuncaPagaram: number;
  totalClientesComParcelas: number;
}

interface ClienteNuncaPagou {
  idCliente: string;
  nomeCliente: string;
  valorTotal: number;
  quantidadeParcelas: number;
  parcelaMaisAntiga: string;
  diasAtrasoMax: number;
  vendedor: string | null;
  squad: string | null;
  responsavel: string | null;
}

interface InadimplenciaContexto {
  contexto: string | null;
  evidencias: string | null;
  acao: string | null;
  statusFinanceiro: string | null;
  detalheFinanceiro: string | null;
  atualizadoPor: string | null;
  atualizadoEm: string | null;
}

type AcaoContexto = 'cobrar' | 'aguardar' | 'abonar';
type StatusFinanceiro = 'cobrado' | 'acordo_realizado' | 'juridico';

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

const TAB_TITLES: Record<string, { title: string; subtitle: string }> = {
  "visao-geral": { title: "Inadimplência - Visão Geral", subtitle: "Análise geral de inadimplência e métricas" },
  "clientes": { title: "Inadimplência - Clientes", subtitle: "Lista de clientes inadimplentes" },
  "empresas": { title: "Inadimplência - Por Empresa", subtitle: "Inadimplência agrupada por empresa" },
};

export default function DashboardInadimplencia() {
  usePageTitle("Inadimplência");
  const { setPageInfo } = usePageInfo();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("visao-geral");

  useEffect(() => {
    const { title, subtitle } = TAB_TITLES[activeTab] || TAB_TITLES["visao-geral"];
    setPageInfo(title, subtitle);
  }, [activeTab, setPageInfo]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [filterSquad, setFilterSquad] = useState("todos");
  const [filterVendedor, setFilterVendedor] = useState("todos");
  const [filterFaixa, setFilterFaixa] = useState("todos");
  const [evolucaoMode, setEvolucaoMode] = useState<'valor' | 'parcelas'>('valor');
  const [ordenarPor, setOrdenarPor] = useState<"valor" | "diasAtraso" | "nome">("valor");
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteInadimplente | null>(null);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [responsavelFiltro, setResponsavelFiltro] = useState<string>("todos");
  
  // Estados para contextualização de inadimplência
  const [clienteContexto, setClienteContexto] = useState<ClienteInadimplente | null>(null);
  const [contextoTexto, setContextoTexto] = useState("");
  const [evidenciasTexto, setEvidenciasTexto] = useState("");
  const [acaoSelecionada, setAcaoSelecionada] = useState<AcaoContexto | null>(null);
  const [statusFinanceiroSelecionado, setStatusFinanceiroSelecionado] = useState<StatusFinanceiro | null>(null);
  const [detalheFinanceiroTexto, setDetalheFinanceiroTexto] = useState("");
  
  // Estados para drill-down de inadimplência
  const [drillDown, setDrillDown] = useState<{ tipo: 'vendedor' | 'squad' | 'responsavel' | 'produto'; valor: string } | null>(null);

  useEffect(() => {
    setClienteSelecionado(null);
  }, [dateRange]);

  const dataInicio = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '';
  const dataFim = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : '';

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

  // Novas queries para detalhamento por vendedor, squad e responsável
  const { data: vendedoresData, isLoading: isLoadingVendedores, isError: isErrorVendedores } = useQuery<{ vendedores: VendedorInadimplente[] }>({
    queryKey: ['/api/inadimplencia/por-vendedor', empresasParams],
  });

  const { data: squadsData, isLoading: isLoadingSquads, isError: isErrorSquads } = useQuery<{ squads: SquadInadimplente[] }>({
    queryKey: ['/api/inadimplencia/por-squad', empresasParams],
  });

  const { data: responsaveisDetData, isLoading: isLoadingResponsaveisDet, isError: isErrorResponsaveisDet } = useQuery<{ responsaveis: ResponsavelInadimplente[] }>({
    queryKey: ['/api/inadimplencia/por-responsavel', empresasParams],
  });

  // Query para inadimplência por produto
  const { data: produtosData, isLoading: isLoadingProdutos, isError: isErrorProdutos } = useQuery<{ produtos: ProdutoInadimplente[] }>({
    queryKey: ['/api/inadimplencia/por-produto', empresasParams],
  });

  // Query para métricas de recebimento
  const { data: metricasRecebimento, isLoading: isLoadingMetricas, isError: isErrorMetricas } = useQuery<MetricasRecebimento>({
    queryKey: ['/api/inadimplencia/metricas-recebimento', resumoParams],
  });

  // Query para clientes que nunca pagaram
  const { data: clientesNuncaPagaramData, isLoading: isLoadingNuncaPagaram, isError: isErrorNuncaPagaram } = useQuery<{ clientes: ClienteNuncaPagou[] }>({
    queryKey: ['/api/inadimplencia/clientes-nunca-pagaram', resumoParams],
  });

  // Query para drill-down - busca clientes filtrados por vendedor/squad/responsável
  const drillDownParams = useMemo(() => {
    if (!drillDown) return null;
    const params: Record<string, string> = {
      ...(dataInicio && { dataInicio }),
      ...(dataFim && { dataFim }),
      ordenarPor: 'valor',
      limite: '100',
    };
    if (drillDown.tipo === 'vendedor') params.vendedor = drillDown.valor;
    if (drillDown.tipo === 'squad') params.squad = drillDown.valor;
    if (drillDown.tipo === 'responsavel') params.responsavel = drillDown.valor;
    if (drillDown.tipo === 'produto') params.produto = drillDown.valor;
    return params;
  }, [drillDown, dataInicio, dataFim]);

  const { data: drillDownData, isLoading: isLoadingDrillDown, isError: isErrorDrillDown } = useQuery<{ 
    clientes: (ClienteInadimplente & { vendedor: string | null; squad: string | null })[] 
  }>({
    queryKey: ['/api/inadimplencia/clientes', drillDownParams],
    enabled: !!drillDown && !!drillDownParams,
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

  // Query para buscar contextos de inadimplência
  const clienteIds = useMemo(() => {
    return clientesData?.clientes?.map(c => c.idCliente).join(',') || '';
  }, [clientesData]);

  const { data: contextosData } = useQuery<{ contextos: Record<string, InadimplenciaContexto> }>({
    queryKey: ['/api/inadimplencia/contextos', { ids: clienteIds }],
    enabled: !!clienteIds,
  });

  // Query para buscar contexto individual ao abrir dialog
  const { data: contextoAtualData, isLoading: isLoadingContexto } = useQuery<{ contexto: InadimplenciaContexto | null }>({
    queryKey: ['/api/inadimplencia/contexto', clienteContexto?.idCliente],
    enabled: !!clienteContexto?.idCliente,
  });

  // Preencher form quando contexto é carregado
  useEffect(() => {
    if (contextoAtualData?.contexto && clienteContexto) {
      setContextoTexto(contextoAtualData.contexto.contexto || '');
      setEvidenciasTexto(contextoAtualData.contexto.evidencias || '');
      setAcaoSelecionada(contextoAtualData.contexto.acao as AcaoContexto || null);
      setStatusFinanceiroSelecionado(contextoAtualData.contexto.statusFinanceiro as StatusFinanceiro || null);
      setDetalheFinanceiroTexto(contextoAtualData.contexto.detalheFinanceiro || '');
    }
  }, [contextoAtualData, clienteContexto]);

  // Mutation para salvar contexto
  const salvarContextoMutation = useMutation({
    mutationFn: async (data: { 
      clienteId: string; 
      contexto: string; 
      evidencias: string; 
      acao: AcaoContexto; 
      statusFinanceiro: StatusFinanceiro | null;
      detalheFinanceiro: string;
    }) => {
      return apiRequest('PUT', `/api/inadimplencia/contexto/${encodeURIComponent(data.clienteId)}`, {
        contexto: data.contexto,
        evidencias: data.evidencias,
        acao: data.acao,
        statusFinanceiro: data.statusFinanceiro,
        detalheFinanceiro: data.detalheFinanceiro,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inadimplencia/contextos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inadimplencia/contexto', clienteContexto?.idCliente] });
      toast({
        title: "Contexto salvo",
        description: "O contexto de inadimplência foi salvo com sucesso.",
      });
      fecharDialogContexto();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível salvar o contexto.",
        variant: "destructive",
      });
    },
  });

  const abrirDialogContexto = (cliente: ClienteInadimplente) => {
    setClienteContexto(cliente);
    setContextoTexto('');
    setEvidenciasTexto('');
    setAcaoSelecionada(null);
    setStatusFinanceiroSelecionado(null);
    setDetalheFinanceiroTexto('');
  };

  const fecharDialogContexto = () => {
    setClienteContexto(null);
    setContextoTexto('');
    setEvidenciasTexto('');
    setAcaoSelecionada(null);
    setStatusFinanceiroSelecionado(null);
    setDetalheFinanceiroTexto('');
  };

  const handleSalvarContexto = () => {
    if (!clienteContexto) {
      return;
    }
    salvarContextoMutation.mutate({
      clienteId: clienteContexto.idCliente,
      contexto: contextoTexto,
      evidencias: evidenciasTexto,
      acao: acaoSelecionada || 'cobrar',
      statusFinanceiro: statusFinanceiroSelecionado,
      detalheFinanceiro: detalheFinanceiroTexto,
    });
  };

  const getStatusFinanceiroBadge = (status: string | null | undefined) => {
    if (!status) return { label: 'Não informado', variant: 'secondary' as const, color: 'text-muted-foreground' };
    switch (status) {
      case 'cobrado':
        return { label: 'Cobrado', variant: 'outline' as const, color: 'text-blue-600 dark:text-blue-400' };
      case 'acordo_realizado':
        return { label: 'Acordo Realizado', variant: 'default' as const, color: 'text-green-600 dark:text-green-400' };
      case 'juridico':
        return { label: 'Jurídico', variant: 'destructive' as const, color: 'text-red-600 dark:text-red-400' };
      default:
        return { label: 'Não informado', variant: 'secondary' as const, color: 'text-muted-foreground' };
    }
  };

  const getAcaoBadge = (acao: string | null | undefined) => {
    if (!acao) return { label: 'Sem contexto', variant: 'secondary' as const, icon: AlertCircle };
    switch (acao) {
      case 'cobrar':
        return { label: 'Cobrar', variant: 'destructive' as const, icon: CheckCircle2 };
      case 'aguardar':
        return { label: 'Aguardar', variant: 'secondary' as const, icon: Pause };
      case 'abonar':
        return { label: 'Abonar', variant: 'outline' as const, icon: XCircle };
      default:
        return { label: 'Sem contexto', variant: 'secondary' as const, icon: AlertCircle };
    }
  };

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

  // Extrair responsáveis únicos dos clientes para o filtro
  const responsaveisUnicos = useMemo(() => {
    if (!clientesData?.clientes) return [];
    const responsavelSet = new Set<string>();
    clientesData.clientes.forEach((c) => {
      if (c.responsavel) {
        responsavelSet.add(c.responsavel);
      }
    });
    return Array.from(responsavelSet).sort();
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
    
    // Filtrar por responsável
    if (responsavelFiltro !== "todos") {
      if (responsavelFiltro === "sem-responsavel") {
        filtrados = filtrados.filter((c) => !c.responsavel);
      } else {
        filtrados = filtrados.filter((c) => c.responsavel === responsavelFiltro);
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
  }, [clientesData, busca, statusFiltro, responsavelFiltro]);

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

  // Compute KPI deltas from evolucaoMensal (last 2 months)
  const kpiDeltas = useMemo(() => {
    const evol = resumoData?.evolucaoMensal;
    if (!evol || evol.length < 2) return { valor: undefined, clientes: undefined };
    const current = evol[evol.length - 1];
    const previous = evol[evol.length - 2];
    const valorDiff = current.valor - previous.valor;
    const valorPct = previous.valor > 0 ? Math.abs(valorDiff / previous.valor * 100) : 0;
    const qtdDiff = current.quantidade - previous.quantidade;
    return {
      valor: {
        value: `${valorPct.toFixed(1)}%`,
        isPositive: valorDiff <= 0, // less overdue = positive
      },
      clientes: {
        value: `${Math.abs(qtdDiff)} parcelas`,
        isPositive: qtdDiff <= 0,
      },
    };
  }, [resumoData]);

  // Sort bar chart data by value descending
  const sortedVendedores = useMemo(() => {
    if (!vendedoresData?.vendedores) return [];
    return [...vendedoresData.vendedores].sort((a, b) => b.valorTotal - a.valorTotal).slice(0, 8);
  }, [vendedoresData]);

  const sortedSquads = useMemo(() => {
    if (!squadsData?.squads) return [];
    return [...squadsData.squads].sort((a, b) => b.valorTotal - a.valorTotal).slice(0, 8);
  }, [squadsData]);

  const sortedResponsaveis = useMemo(() => {
    if (!responsaveisDetData?.responsaveis) return [];
    return [...responsaveisDetData.responsaveis].sort((a, b) => b.valorTotal - a.valorTotal).slice(0, 8);
  }, [responsaveisDetData]);

  // Smart name truncation: first name + last initial
  const smartTruncate = (name: string, max: number = 18) => {
    if (name.length <= max) return name;
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      const short = `${parts[0]} ${parts[parts.length - 1][0]}.`;
      if (short.length <= max) return short;
    }
    return name.substring(0, max) + '…';
  };

  const limparFiltros = () => {
    setDateRange(undefined);
    setBusca("");
    setStatusFiltro("todos");
    setResponsavelFiltro("todos");
    setFilterSquad("todos");
    setFilterVendedor("todos");
    setFilterFaixa("todos");
  };

  const hasActiveFilters = !!(dataInicio || dataFim || filterSquad !== "todos" || filterVendedor !== "todos" || filterFaixa !== "todos");

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
    delta,
  }: {
    title: string;
    value: string;
    subtitle?: string;
    icon: any;
    variant?: "default" | "success" | "danger" | "warning" | "info";
    loading?: boolean;
    testId: string;
    delta?: { value: string; isPositive: boolean };
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
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground truncate">{title}</p>
              <p className="text-xl font-bold text-foreground truncate" data-testid={`${testId}-value`}>{value}</p>
              {subtitle && (
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>
              )}
              {delta && (
                <span className={`inline-flex items-center gap-0.5 mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  delta.isPositive
                    ? "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-red-100/80 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                }`}>
                  {delta.isPositive ? "↓" : "↑"} {delta.value} vs mês ant.
                </span>
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

  // Custom rich tooltip for bar charts
  const BarChartRichTooltip = ({ active, payload, totalInadimplente }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload;
    const nameKey = data.vendedor || data.squad || data.responsavel || 'N/A';
    const pctOfTotal = totalInadimplente > 0 ? (data.valorTotal / totalInadimplente * 100).toFixed(1) : '0';
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm min-w-[180px]">
        <p className="font-semibold text-foreground mb-1.5">{nameKey}</p>
        <div className="space-y-1 text-muted-foreground">
          <p>Valor: <span className="font-medium text-foreground">{formatCurrency(data.valorTotal)}</span></p>
          <p>Parcelas: <span className="font-medium text-foreground">{data.quantidadeParcelas}</span></p>
          <p>Clientes: <span className="font-medium text-foreground">{data.quantidadeClientes}</span></p>
          <p>% do Total: <span className="font-medium text-foreground">{pctOfTotal}%</span></p>
        </div>
      </div>
    );
  };

  const renderFiltros = () => (
    <div className="flex items-center gap-4 flex-wrap mb-4 p-3 rounded-lg bg-muted/40 dark:bg-muted/20 border border-border/50" data-testid="card-filtros">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground font-medium">Período:</span>
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          placeholder="Selecione o período"
          triggerClassName="h-8 text-xs"
        />
      </div>

      <div className="w-px h-6 bg-border hidden sm:block" />

      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground font-medium">Squad:</span>
        <Select value={filterSquad} onValueChange={setFilterSquad}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {squadsData?.squads?.map((s) => (
              <SelectItem key={s.squad} value={s.squad}>{s.squad}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-px h-6 bg-border hidden sm:block" />

      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground font-medium">Vendedor:</span>
        <Select value={filterVendedor} onValueChange={setFilterVendedor}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {vendedoresData?.vendedores?.map((v) => (
              <SelectItem key={v.vendedor} value={v.vendedor}>{v.vendedor}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-px h-6 bg-border hidden sm:block" />

      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground font-medium">Faixa:</span>
        <Select value={filterFaixa} onValueChange={setFilterFaixa}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            <SelectItem value="ate30">Até 30 dias</SelectItem>
            <SelectItem value="31a60">31-60 dias</SelectItem>
            <SelectItem value="61a90">61-90 dias</SelectItem>
            <SelectItem value="acima90">90+ dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasActiveFilters && (
        <>
          <div className="w-px h-6 bg-border hidden sm:block" />
          <Button
            variant="ghost"
            size="sm"
            onClick={limparFiltros}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            data-testid="button-limpar-filtros"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Limpar
          </Button>
        </>
      )}
    </div>
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
          delta={kpiDeltas.valor}
        />
        <KPICard
          title="Clientes Inadimplentes"
          value={String(resumoData?.quantidadeClientes || 0)}
          subtitle="Com valores em atraso"
          icon={Users}
          variant="warning"
          loading={isLoadingResumo}
          testId="kpi-clientes-inadimplentes"
          delta={kpiDeltas.clientes}
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

      {/* Métricas de Recebimento */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Tempo Médio Recebimento"
          value={`${metricasRecebimento?.tempoMedioRecebimento || 0} dias`}
          subtitle="Prazo médio entre vencimento e quitação"
          icon={Clock}
          variant="info"
          loading={isLoadingMetricas}
          testId="kpi-tempo-medio-recebimento"
        />
        <KPICard
          title="Tempo Médio (Atrasados)"
          value={`${metricasRecebimento?.tempoMedioRecebimentoInadimplentes || 0} dias`}
          subtitle="Pagos após o vencimento"
          icon={Clock}
          variant="warning"
          loading={isLoadingMetricas}
          testId="kpi-tempo-medio-inadimplentes"
        />
        <KPICard
          title="Inadimplentes 1ª Parcela"
          value={String(metricasRecebimento?.clientesInadimPrimeiraParcela || 0)}
          subtitle={`${formatPercent(metricasRecebimento?.percentualInadimPrimeiraParcela || 0)} sobre ${metricasRecebimento?.totalClientesComParcelas || 0} clientes • ${formatCurrency(metricasRecebimento?.valorInadimPrimeiraParcela || 0)}`}
          icon={AlertTriangle}
          variant="danger"
          loading={isLoadingMetricas}
          testId="kpi-inadim-primeira-parcela"
        />
        <KPICard
          title="Nunca Pagaram"
          value={String(metricasRecebimento?.clientesNuncaPagaram || 0)}
          subtitle={`${formatPercent(metricasRecebimento?.percentualNuncaPagaram || 0)} • ${formatCurrency(metricasRecebimento?.valorNuncaPagaram || 0)}`}
          icon={XCircle}
          variant="danger"
          loading={isLoadingMetricas}
          testId="kpi-nunca-pagaram"
        />
      </div>

      {isErrorResumo && (
        <ErrorDisplay message="Erro ao carregar dados de resumo. Tente novamente." />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/50" data-testid="card-distribuicao-faixas">
          <CardHeader className="border-b border-slate-100 dark:border-slate-700/50 pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
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
              <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground gap-2" data-testid="empty-chart-faixas">
                <BarChart3 className="h-8 w-8" />
                <span className="text-sm">Sem dados de faixas para o período</span>
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
                  <span className="font-medium">{formatPercent(faixa.percentual)}</span>
                  <span className="text-muted-foreground">({faixa.quantidade})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/50" data-testid="card-evolucao-mensal">
          <CardHeader className="border-b border-slate-100 dark:border-slate-700/50 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
                Evolução Mensal
              </CardTitle>
              <div className="flex items-center gap-1 bg-muted/50 rounded-md p-0.5">
                <button
                  onClick={() => setEvolucaoMode('valor')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    evolucaoMode === 'valor'
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Valor
                </button>
                <button
                  onClick={() => setEvolucaoMode('parcelas')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    evolucaoMode === 'parcelas'
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Parcelas
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingResumo ? (
              <div className="h-[280px] flex items-center justify-center" data-testid="loading-chart-evolucao">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : isErrorResumo ? (
              <ErrorDisplay message="Erro ao carregar dados do gráfico." />
            ) : !resumoData?.evolucaoMensal?.length ? (
              <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground gap-2" data-testid="empty-chart-evolucao">
                <BarChart3 className="h-8 w-8" />
                <span className="text-sm">Sem dados de evolução para o período</span>
              </div>
            ) : (
              <div className="h-[280px]" data-testid="chart-evolucao-mensal">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={resumoData.evolucaoMensal} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="mesLabel" tick={{ fontSize: 11 }} />
                    <YAxis
                      tickFormatter={evolucaoMode === 'valor' ? formatCurrencyCompact : (v) => String(v)}
                      tick={{ fontSize: 11 }}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [
                        evolucaoMode === 'valor' ? formatCurrency(value) : `${value} parcelas`,
                        evolucaoMode === 'valor' ? "Valor" : "Parcelas",
                      ]}
                    />
                    <Bar
                      dataKey={evolucaoMode === 'valor' ? 'valor' : 'quantidade'}
                      fill={evolucaoMode === 'valor' ? '#ef4444' : '#3b82f6'}
                      radius={[4, 4, 0, 0]}
                      name={evolucaoMode === 'valor' ? 'Valor' : 'Parcelas'}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráficos de Inadimplência por Vendedor, Squad e Responsável */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Por Vendedor - Gráfico */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/50 hover:shadow-xl transition-shadow duration-300" data-testid="card-chart-vendedor">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-700/50">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              </div>
              Por Vendedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingVendedores ? (
              <div className="h-[250px] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : isErrorVendedores ? (
              <ErrorDisplay message="Erro ao carregar dados." />
            ) : !sortedVendedores.length ? (
              <div className="h-[250px] flex flex-col items-center justify-center text-muted-foreground gap-2">
                <BarChart3 className="h-6 w-6" />
                <span className="text-xs">Sem dados de vendedores</span>
              </div>
            ) : (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={sortedVendedores}
                    layout="vertical"
                    margin={{ left: 10, right: 50 }}
                    style={{ cursor: 'pointer' }}
                    onClick={(data) => {
                      if (data?.activePayload?.[0]?.payload?.vendedor) {
                        setDrillDown({ tipo: 'vendedor', valor: data.activePayload[0].payload.vendedor });
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" tickFormatter={formatCurrencyCompact} tick={{ fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="vendedor"
                      width={120}
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => smartTruncate(v)}
                    />
                    <RechartsTooltip content={<BarChartRichTooltip totalInadimplente={resumoData?.totalInadimplente || 0} />} />
                    <Bar dataKey="valorTotal" fill="#ef4444" radius={[0, 4, 4, 0]} style={{ cursor: 'pointer' }}>
                      <LabelList dataKey="valorTotal" position="right" formatter={formatCurrencyCompact} style={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Por Squad - Gráfico */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/50 hover:shadow-xl transition-shadow duration-300" data-testid="card-chart-squad">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-700/50">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Building2 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              Por Squad
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingSquads ? (
              <div className="h-[250px] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : isErrorSquads ? (
              <ErrorDisplay message="Erro ao carregar dados." />
            ) : !sortedSquads.length ? (
              <div className="h-[250px] flex flex-col items-center justify-center text-muted-foreground gap-2">
                <BarChart3 className="h-6 w-6" />
                <span className="text-xs">Sem dados de squads</span>
              </div>
            ) : (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={sortedSquads}
                    layout="vertical"
                    margin={{ left: 10, right: 50 }}
                    style={{ cursor: 'pointer' }}
                    onClick={(data) => {
                      if (data?.activePayload?.[0]?.payload?.squad) {
                        setDrillDown({ tipo: 'squad', valor: data.activePayload[0].payload.squad });
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" tickFormatter={formatCurrencyCompact} tick={{ fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="squad"
                      width={120}
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => smartTruncate(v)}
                    />
                    <RechartsTooltip content={<BarChartRichTooltip totalInadimplente={resumoData?.totalInadimplente || 0} />} />
                    <Bar dataKey="valorTotal" fill="#f59e0b" radius={[0, 4, 4, 0]} style={{ cursor: 'pointer' }}>
                      <LabelList dataKey="valorTotal" position="right" formatter={formatCurrencyCompact} style={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Por Responsável - Gráfico */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/50 hover:shadow-xl transition-shadow duration-300" data-testid="card-chart-responsavel">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-700/50">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30">
                <Users className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              </div>
              Por Responsável
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingResponsaveisDet ? (
              <div className="h-[250px] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : isErrorResponsaveisDet ? (
              <ErrorDisplay message="Erro ao carregar dados." />
            ) : !sortedResponsaveis.length ? (
              <div className="h-[250px] flex flex-col items-center justify-center text-muted-foreground gap-2">
                <BarChart3 className="h-6 w-6" />
                <span className="text-xs">Sem dados de responsáveis</span>
              </div>
            ) : (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={sortedResponsaveis}
                    layout="vertical"
                    margin={{ left: 10, right: 50 }}
                    style={{ cursor: 'pointer' }}
                    onClick={(data) => {
                      if (data?.activePayload?.[0]?.payload?.responsavel) {
                        setDrillDown({ tipo: 'responsavel', valor: data.activePayload[0].payload.responsavel });
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" tickFormatter={formatCurrencyCompact} tick={{ fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="responsavel"
                      width={120}
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => smartTruncate(v)}
                    />
                    <RechartsTooltip content={<BarChartRichTooltip totalInadimplente={resumoData?.totalInadimplente || 0} />} />
                    <Bar dataKey="valorTotal" fill="#3b82f6" radius={[0, 4, 4, 0]} style={{ cursor: 'pointer' }}>
                      <LabelList dataKey="valorTotal" position="right" formatter={formatCurrencyCompact} style={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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

      {/* Filtros de Status e Responsável */}
      <div className="flex flex-wrap items-center gap-4" data-testid="filtros-clientes">
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

        <div className="flex items-center gap-2" data-testid="filtro-responsavel">
          <Label className="text-sm text-muted-foreground flex items-center gap-1">
            <Users className="h-4 w-4" />
            Responsável:
          </Label>
          <Select value={responsavelFiltro} onValueChange={setResponsavelFiltro}>
            <SelectTrigger className="w-56" data-testid="select-filtro-responsavel">
              <SelectValue placeholder="Selecione um responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos" data-testid="option-responsavel-todos">
                <span className="flex items-center gap-2">
                  Todos ({clientesData?.clientes?.length || 0})
                </span>
              </SelectItem>
              {responsaveisUnicos.map((responsavel) => {
                const count = clientesData?.clientes?.filter(c => c.responsavel === responsavel).length || 0;
                return (
                  <SelectItem key={responsavel} value={responsavel} data-testid={`option-responsavel-${responsavel.toLowerCase().replace(/\s+/g, '-')}`}>
                    <span className="flex items-center gap-2">
                      {responsavel} ({count})
                    </span>
                  </SelectItem>
                );
              })}
              {clientesData?.clientes?.some(c => !c.responsavel) && (
                <SelectItem value="sem-responsavel" data-testid="option-responsavel-sem-responsavel">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-gray-400" />
                    Sem Responsável ({clientesData?.clientes?.filter(c => !c.responsavel).length || 0})
                  </span>
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
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
                    <TableHead className="text-center">Contexto CS</TableHead>
                    <TableHead className="text-center">Contexto Financeiro</TableHead>
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
                        {(() => {
                          const contexto = contextosData?.contextos?.[cliente.idCliente];
                          const badge = getAcaoBadge(contexto?.acao);
                          const IconComponent = badge.icon;
                          return (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge 
                                    variant={badge.variant} 
                                    className="cursor-pointer gap-1"
                                    onClick={() => abrirDialogContexto(cliente)}
                                    data-testid={`badge-contexto-${cliente.idCliente}`}
                                  >
                                    <IconComponent className="h-3 w-3" />
                                    {badge.label}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {contexto?.contexto ? (
                                    <div className="max-w-xs">
                                      <p className="font-medium mb-1">Contexto:</p>
                                      <p className="text-sm">{contexto.contexto}</p>
                                    </div>
                                  ) : (
                                    <p>Clique para contextualizar</p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const contexto = contextosData?.contextos?.[cliente.idCliente];
                          const badge = getStatusFinanceiroBadge(contexto?.statusFinanceiro);
                          return (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge 
                                    variant={badge.variant} 
                                    className="cursor-pointer"
                                    onClick={() => abrirDialogContexto(cliente)}
                                    data-testid={`badge-financeiro-${cliente.idCliente}`}
                                  >
                                    {badge.label}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {contexto?.detalheFinanceiro ? (
                                    <div className="max-w-xs">
                                      <p className="font-medium mb-1">Detalhe:</p>
                                      <p className="text-sm">{contexto.detalheFinanceiro}</p>
                                    </div>
                                  ) : (
                                    <p>Clique para adicionar contexto financeiro</p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setClienteSelecionado(cliente)}
                            data-testid={`button-ver-parcelas-${cliente.idCliente}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => abrirDialogContexto(cliente)}
                            data-testid={`button-contextualizar-${cliente.idCliente}`}
                          >
                            <MessageSquarePlus className="h-4 w-4" />
                          </Button>
                        </div>
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
                    <TableHead className="text-center">Link</TableHead>
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
                      <TableCell className="text-center">
                        {parcela.urlCobranca ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <a
                                  href={parcela.urlCobranca}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 transition-colors"
                                  data-testid={`link-cobranca-${parcela.id}`}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Abrir link de cobrança</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Contextualização */}
      <Dialog open={!!clienteContexto} onOpenChange={(open) => !open && fecharDialogContexto()}>
        <DialogContent className="max-w-lg" data-testid="dialog-contextualizar">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquarePlus className="h-5 w-5" />
              Contextualizar Inadimplência
            </DialogTitle>
          </DialogHeader>
          
          {isLoadingContexto ? (
            <div className="p-8 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium">{clienteContexto?.nomeCliente}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(clienteContexto?.valorTotal || 0)} em atraso
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contexto">Contexto do Cliente</Label>
                <Textarea
                  id="contexto"
                  placeholder="Descreva a situação do cliente, histórico de contatos, negociações em andamento..."
                  value={contextoTexto}
                  onChange={(e) => setContextoTexto(e.target.value)}
                  className="min-h-[100px]"
                  data-testid="textarea-contexto"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="evidencias">Evidências de Trabalho</Label>
                <Textarea
                  id="evidencias"
                  placeholder="Links, prints, registros de contato, e-mails enviados..."
                  value={evidenciasTexto}
                  onChange={(e) => setEvidenciasTexto(e.target.value)}
                  className="min-h-[80px]"
                  data-testid="textarea-evidencias"
                />
              </div>

              <div className="space-y-2">
                <Label>Ação CS/CX</Label>
                <RadioGroup
                  value={acaoSelecionada || ''}
                  onValueChange={(v) => setAcaoSelecionada(v as AcaoContexto)}
                  className="flex gap-4"
                  data-testid="radio-acao"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cobrar" id="cobrar" />
                    <Label htmlFor="cobrar" className="flex items-center gap-1 cursor-pointer text-red-600 dark:text-red-400 font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      Cobrar
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="aguardar" id="aguardar" />
                    <Label htmlFor="aguardar" className="flex items-center gap-1 cursor-pointer text-amber-600 dark:text-amber-400 font-medium">
                      <Pause className="h-4 w-4" />
                      Aguardar
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="abonar" id="abonar" />
                    <Label htmlFor="abonar" className="flex items-center gap-1 cursor-pointer text-green-600 dark:text-green-400 font-medium">
                      <XCircle className="h-4 w-4" />
                      Abonar
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium flex items-center gap-2 mb-4">
                  <CreditCard className="h-4 w-4" />
                  Contexto Financeiro
                </h4>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Status da Cobrança</Label>
                    <RadioGroup
                      value={statusFinanceiroSelecionado || ''}
                      onValueChange={(v) => setStatusFinanceiroSelecionado(v as StatusFinanceiro)}
                      className="flex gap-4"
                      data-testid="radio-status-financeiro"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="cobrado" id="cobrado" />
                        <Label htmlFor="cobrado" className="flex items-center gap-1 cursor-pointer text-blue-600 dark:text-blue-400 font-medium">
                          Cobrado
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="acordo_realizado" id="acordo_realizado" />
                        <Label htmlFor="acordo_realizado" className="flex items-center gap-1 cursor-pointer text-green-600 dark:text-green-400 font-medium">
                          Acordo Realizado
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="juridico" id="juridico" />
                        <Label htmlFor="juridico" className="flex items-center gap-1 cursor-pointer text-red-600 dark:text-red-400 font-medium">
                          Jurídico
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="detalheFinanceiro">Detalhamento Financeiro</Label>
                    <Textarea
                      id="detalheFinanceiro"
                      placeholder="Detalhes sobre a cobrança, acordos realizados, valores negociados, datas de pagamento..."
                      value={detalheFinanceiroTexto}
                      onChange={(e) => setDetalheFinanceiroTexto(e.target.value)}
                      className="min-h-[80px]"
                      data-testid="textarea-detalhe-financeiro"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={fecharDialogContexto} data-testid="button-cancelar-contexto">
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSalvarContexto} 
                  disabled={salvarContextoMutation.isPending}
                  data-testid="button-salvar-contexto"
                >
                  {salvarContextoMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Salvar Contexto
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-background via-background to-muted/20 min-h-screen" data-testid="page-inadimplencia">
      {renderFiltros()}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 p-1.5 rounded-xl shadow-sm border border-slate-200/50 dark:border-slate-700/50" data-testid="tabs-inadimplencia">
          <TabsTrigger 
            value="visao-geral" 
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-md rounded-lg px-4 py-2.5 transition-all duration-200"
            data-testid="tab-visao-geral"
          >
            <TrendingDown className="h-4 w-4 mr-2" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger
            value="clientes"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-md rounded-lg px-4 py-2.5 transition-all duration-200"
            data-testid="tab-clientes"
          >
            <Users className="h-4 w-4 mr-2" />
            Clientes ({clientesData?.clientes?.length || 0})
            {(resumoData?.faixas?.acima90dias?.quantidade || 0) > 0 && (
              <Badge variant="destructive" className="ml-1.5 text-[10px] px-1.5 py-0">
                {resumoData?.faixas?.acima90dias?.quantidade}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral">
          {renderVisaoGeral()}
        </TabsContent>

        <TabsContent value="clientes">
          {renderClientes()}
        </TabsContent>



      </Tabs>

      {/* Modal de Drill-down - Clientes por Vendedor/Squad/Responsável */}
      <Dialog open={!!drillDown} onOpenChange={(open) => !open && setDrillDown(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col" data-testid="dialog-drill-down">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Clientes Inadimplentes - {drillDown?.tipo === 'vendedor' ? 'Vendedor' : drillDown?.tipo === 'squad' ? 'Squad' : drillDown?.tipo === 'produto' ? 'Produto' : 'Responsável'}: {drillDown?.valor}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {isLoadingDrillDown ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : isErrorDrillDown ? (
              <ErrorDisplay message="Erro ao carregar clientes." />
            ) : !drillDownData?.clientes?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum cliente encontrado
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Parcelas</TableHead>
                      <TableHead className="text-right">Dias Atraso</TableHead>
                      <TableHead>Responsável</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drillDownData.clientes.map((cliente, idx) => (
                      <TableRow key={idx} data-testid={`row-drilldown-${idx}`}>
                        <TableCell>
                          <div className="font-medium">{cliente.nomeCliente}</div>
                          {cliente.cnpj && (
                            <div className="text-xs text-muted-foreground">{cliente.cnpj}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-red-600 dark:text-red-400">
                          {formatCurrency(cliente.valorTotal)}
                        </TableCell>
                        <TableCell className="text-right">{cliente.quantidadeParcelas}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={cliente.diasAtrasoMax > 90 ? "destructive" : cliente.diasAtrasoMax > 30 ? "secondary" : "outline"}>
                            {cliente.diasAtrasoMax} dias
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {cliente.responsavel || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <div className="pt-4 border-t flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {drillDownData?.clientes?.length || 0} cliente(s) • Total: {formatCurrency(drillDownData?.clientes?.reduce((acc, c) => acc + c.valorTotal, 0) || 0)}
            </div>
            <Button variant="outline" onClick={() => setDrillDown(null)} data-testid="button-close-drilldown">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
