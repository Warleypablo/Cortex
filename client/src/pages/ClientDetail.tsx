import { useState, useEffect, useMemo } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { usePageInfo } from "@/contexts/PageContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import StatsCard from "@/components/StatsCard";
import RevenueChart from "@/components/RevenueChart";
import { ArrowLeft, DollarSign, TrendingUp, Receipt, Loader2, ExternalLink, Key, Eye, EyeOff, Copy, Building2, MapPin, Phone, User, Calendar, Briefcase, Layers, CheckCircle, FileText, ChevronUp, ChevronDown, CreditCard, Activity, Globe, Mail, Link2, ListTodo, Pencil, Crown } from "lucide-react";
import { SiInstagram } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ContratoCompleto } from "@shared/schema";

interface CredentialGroup {
  id: string;
  name: string;
  credentials: Array<{
    id: string;
    platform: string;
    username: string;
    password: string;
    accessUrl: string;
    observations: string;
  }>;
}

interface ClienteDb {
  id: number;
  nome: string | null;
  cnpj: string | null;
  endereco: string | null;
  ativo: string | null;
  createdAt: string | null;
  empresa: string | null;
  ids: string | null;
  telefone: string | null;
  responsavel: string | null;
  responsavelGeral: string | null;
  nomeDono: string | null;
  site: string | null;
  email: string | null;
  instagram: string | null;
  linksContrato: string | null;
  linkListaClickup: string | null;
  cluster: string | null;
  servicos: string | null;
  dataInicio: Date | null;
}

interface ContaReceber {
  id: number;
  status: string | null;
  total: string | null;
  descricao: string | null;
  dataVencimento: string | null;
  naoPago: string | null;
  pago: string | null;
  dataCriacao: string | null;
  clienteId: string | null;
  clienteNome: string | null;
  empresa: string | null;
  urlCobranca: string | null;
}

interface RevenueData {
  mes: string;
  valor: number;
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export default function ClientDetail() {
  const { setPageInfo } = usePageInfo();
  const { toast } = useToast();
  const [, params] = useRoute("/cliente/:id");
  const clientId = params?.id || "";
  const [receitasCurrentPage, setReceitasCurrentPage] = useState(1);
  const [receitasItemsPerPage, setReceitasItemsPerPage] = useState(10);
  const [monthsFilter, setMonthsFilter] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [contratosSortConfig, setContratosSortConfig] = useState<SortConfig | null>(null);
  const [receitasSortConfig, setReceitasSortConfig] = useState<SortConfig | null>(null);
  const [isEditingDados, setIsEditingDados] = useState(false);

  interface EditFormData {
    telefone: string;
    responsavel: string;
    responsavelGeral: string;
    nomeDono: string;
    email: string;
    site: string;
    instagram: string;
    linksContrato: string;
    linkListaClickup: string;
    cluster: string;
  }

  const editForm = useForm<EditFormData>({
    defaultValues: {
      telefone: "",
      responsavel: "",
      responsavelGeral: "",
      nomeDono: "",
      email: "",
      site: "",
      instagram: "",
      linksContrato: "",
      linkListaClickup: "",
      cluster: "",
    },
  });

  const { data: cliente, isLoading: isLoadingCliente, error: clienteError } = useQuery<ClienteDb>({
    queryKey: ["/api/cliente", clientId],
    enabled: !!clientId,
  });

  const { data: receitas, isLoading: isLoadingReceitas } = useQuery<ContaReceber[]>({
    queryKey: ["/api/cliente", clientId, "receitas"],
    enabled: !!clientId && !!cliente,
  });

  const { data: revenueHistory, isLoading: isLoadingRevenue } = useQuery<RevenueData[]>({
    queryKey: ["/api/cliente", clientId, "revenue"],
    enabled: !!clientId && !!cliente,
  });

  const { data: contratos, isLoading: isLoadingContratos } = useQuery<ContratoCompleto[]>({
    queryKey: ["/api/cliente", clientId, "contratos"],
    enabled: !!clientId && !!cliente,
  });

  const { data: credenciais, isLoading: isLoadingCredenciais } = useQuery<CredentialGroup[]>({
    queryKey: ["/api/acessos/credentials-by-cnpj", cliente?.cnpj],
    queryFn: async () => {
      if (!cliente?.cnpj) return [];
      const encodedCnpj = encodeURIComponent(cliente.cnpj);
      const response = await fetch(`/api/acessos/credentials-by-cnpj/${encodedCnpj}`);
      if (!response.ok) throw new Error("Failed to fetch credentials");
      return response.json();
    },
    enabled: !!cliente?.cnpj,
  });

  const updateClienteMutation = useMutation({
    mutationFn: async (data: EditFormData) => {
      const response = await apiRequest("PATCH", `/api/cliente/${clientId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cliente", clientId] });
      setIsEditingDados(false);
      toast({
        title: "Sucesso!",
        description: "Dados do cliente atualizados com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível atualizar os dados do cliente.",
        variant: "destructive",
      });
    },
  });

  const mapClusterNameToCode = (name: string): string => {
    switch (name) {
      case "NFNC": return "0";
      case "Regulares": return "1";
      case "Chaves": return "2";
      case "Imperdíveis": return "3";
      default: return name;
    }
  };

  const handleToggleEdit = () => {
    if (!isEditingDados && cliente) {
      editForm.reset({
        telefone: cliente.telefone || "",
        responsavel: cliente.responsavel || "",
        responsavelGeral: cliente.responsavelGeral || "",
        nomeDono: cliente.nomeDono || "",
        email: cliente.email || "",
        site: cliente.site || "",
        instagram: cliente.instagram || "",
        linksContrato: cliente.linksContrato || "",
        linkListaClickup: cliente.linkListaClickup || "",
        cluster: cliente.cluster || "",
      });
    }
    setIsEditingDados(!isEditingDados);
  };

  const onSubmitEdit = (data: EditFormData) => {
    updateClienteMutation.mutate(data);
  };

  const handleContratoSort = (key: string) => {
    setContratosSortConfig(prev => ({
      key,
      direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleReceitaSort = (key: string) => {
    setReceitasSortConfig(prev => ({
      key,
      direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const togglePasswordVisibility = (credentialId: string) => {
    setVisiblePasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(credentialId)) {
        newSet.delete(credentialId);
      } else {
        newSet.add(credentialId);
      }
      return newSet;
    });
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copiado!",
        description: `${type} copiado para a área de transferência.`,
      });
    } catch {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o texto.",
        variant: "destructive",
      });
    }
  };

  const mapSquadCodeToName = (code: string | null): string => {
    if (!code) return "Não definido";
    switch (code) {
      case "0": return "Supreme";
      case "1": return "Forja";
      case "2": return "Squadra";
      case "3": return "Chama";
      default: return code;
    }
  };

  const mapClusterToName = (cluster: string | null): string => {
    if (!cluster) return "Não definido";
    switch (cluster) {
      case "0": return "NFNC";
      case "1": return "Regulares";
      case "2": return "Chaves";
      case "3": return "Imperdíveis";
      default: return cluster;
    }
  };

  const sortedContratos = useMemo(() => {
    if (!contratos) return [];
    if (!contratosSortConfig) return contratos;

    return [...contratos].sort((a, b) => {
      const { key, direction } = contratosSortConfig;
      const multiplier = direction === 'asc' ? 1 : -1;

      switch (key) {
        case 'servico':
          return multiplier * (a.servico || '').localeCompare(b.servico || '');
        case 'status':
          return multiplier * (a.status || '').localeCompare(b.status || '');
        case 'squad':
          return multiplier * mapSquadCodeToName(a.squad).localeCompare(mapSquadCodeToName(b.squad));
        case 'dataInicio':
          const dateA = a.dataInicio ? new Date(a.dataInicio).getTime() : 0;
          const dateB = b.dataInicio ? new Date(b.dataInicio).getTime() : 0;
          return multiplier * (dateA - dateB);
        case 'valorr':
          return multiplier * (parseFloat(a.valorr || '0') - parseFloat(b.valorr || '0'));
        case 'valorp':
          return multiplier * (parseFloat(a.valorp || '0') - parseFloat(b.valorp || '0'));
        default:
          return 0;
      }
    });
  }, [contratos, contratosSortConfig]);

  const sortedReceitas = useMemo(() => {
    if (!receitas) return [];
    
    const sorted = [...receitas];
    
    if (receitasSortConfig) {
      const { key, direction } = receitasSortConfig;
      const multiplier = direction === 'asc' ? 1 : -1;

      sorted.sort((a, b) => {
        switch (key) {
          case 'descricao':
            return multiplier * (a.descricao || '').localeCompare(b.descricao || '');
          case 'status':
            return multiplier * (a.status || '').localeCompare(b.status || '');
          case 'dataVencimento':
            const dateA = a.dataVencimento ? new Date(a.dataVencimento).getTime() : 0;
            const dateB = b.dataVencimento ? new Date(b.dataVencimento).getTime() : 0;
            return multiplier * (dateA - dateB);
          case 'total':
            return multiplier * (parseFloat(a.total || '0') - parseFloat(b.total || '0'));
          case 'pago':
            return multiplier * (parseFloat(a.pago || '0') - parseFloat(b.pago || '0'));
          case 'naoPago':
            return multiplier * (parseFloat(a.naoPago || '0') - parseFloat(b.naoPago || '0'));
          default:
            return 0;
        }
      });
    } else {
      sorted.sort((a, b) => {
        const dateA = a.dataVencimento ? new Date(a.dataVencimento).getTime() : 0;
        const dateB = b.dataVencimento ? new Date(b.dataVencimento).getTime() : 0;
        return dateB - dateA;
      });
    }
    
    return sorted;
  }, [receitas, receitasSortConfig]);

  const filteredReceitas = useMemo(() => {
    if (!selectedMonth) return sortedReceitas;
    
    return sortedReceitas.filter(r => {
      const dataParaUsar = r.dataVencimento || r.dataCriacao;
      if (!dataParaUsar) return false;
      
      const data = new Date(dataParaUsar);
      if (isNaN(data.getTime())) return false;
      
      const mesAno = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
      return mesAno === selectedMonth;
    });
  }, [sortedReceitas, selectedMonth]);

  const lt = useMemo(() => {
    if (!sortedReceitas || sortedReceitas.length === 0) return 0;
    
    const mesesUnicos = new Set<string>();
    
    sortedReceitas.forEach(r => {
      const statusUpper = r.status?.toUpperCase();
      if (statusUpper === "PAGO" || statusUpper === "ACQUITTED") {
        const dataParaUsar = r.dataVencimento || r.dataCriacao;
        if (dataParaUsar) {
          const data = new Date(dataParaUsar);
          if (!isNaN(data.getTime())) {
            const mesAno = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
            mesesUnicos.add(mesAno);
          }
        }
      }
    });
    
    return mesesUnicos.size;
  }, [sortedReceitas]);

  const totalReceitas = sortedReceitas?.reduce((sum, r) => sum + parseFloat(r.pago || "0"), 0) || 0;
  const ticketMedio = lt > 0 ? totalReceitas / lt : 0;
  
  const temContratoAtivo = contratos?.some(c => {
    const statusLower = c.status?.toLowerCase() || "";
    if (statusLower.includes("inativo") || statusLower.includes("inactive") || 
        statusLower.includes("cancelado") || statusLower.includes("canceled")) {
      return false;
    }
    return statusLower.includes("ativo") || statusLower.includes("active");
  }) || false;
  
  const temInadimplencia = sortedReceitas?.some(r => {
    if (!r.dataVencimento || r.status?.toUpperCase() === "PAGO") return false;
    const vencimento = new Date(r.dataVencimento);
    const hoje = new Date();
    const valorPendente = parseFloat(r.naoPago || "0");
    return vencimento < hoje && valorPendente > 0;
  }) || false;

  const statusFinanceiro = useMemo(() => {
    if (!sortedReceitas || sortedReceitas.length === 0) return { status: 'em_dia', diasAtraso: 0 };
    
    let maxDiasAtraso = 0;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    sortedReceitas.forEach(r => {
      const statusUpper = r.status?.toUpperCase();
      if (statusUpper === "PAGO" || statusUpper === "ACQUITTED") return;
      if (!r.dataVencimento) return;
      
      const valorPendente = parseFloat(r.naoPago || "0");
      if (valorPendente <= 0) return;
      
      const vencimento = new Date(r.dataVencimento);
      vencimento.setHours(0, 0, 0, 0);
      
      if (vencimento < hoje) {
        const diffTime = hoje.getTime() - vencimento.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > maxDiasAtraso) {
          maxDiasAtraso = diffDays;
        }
      }
    });
    
    if (maxDiasAtraso === 0) {
      return { status: 'em_dia', diasAtraso: 0 };
    } else if (maxDiasAtraso <= 7) {
      return { status: 'atrasado', diasAtraso: maxDiasAtraso };
    } else {
      return { status: 'inadimplente', diasAtraso: maxDiasAtraso };
    }
  }, [sortedReceitas]);

  const handleBarClick = (month: string) => {
    setSelectedMonth(prevMonth => prevMonth === month ? null : month);
    setReceitasCurrentPage(1);
  };

  const receitasStartIndex = (receitasCurrentPage - 1) * receitasItemsPerPage;
  const receitasEndIndex = receitasStartIndex + receitasItemsPerPage;
  const paginatedReceitas = filteredReceitas?.slice(receitasStartIndex, receitasEndIndex) || [];

  const chartData = useMemo(() => {
    if (!revenueHistory || revenueHistory.length === 0) return [];
    
    const allData = revenueHistory.map((item) => ({
      month: item.mes,
      revenue: item.valor,
    })).sort((a, b) => a.month.localeCompare(b.month));
    
    if (monthsFilter === "all") {
      return allData;
    }
    
    const numMonths = parseInt(monthsFilter);
    return allData.slice(-numMonths);
  }, [revenueHistory, monthsFilter]);

  const receitasTotalPages = Math.ceil((filteredReceitas?.length || 0) / receitasItemsPerPage);
  
  useEffect(() => {
    if (receitasTotalPages > 0 && receitasCurrentPage > receitasTotalPages) {
      setReceitasCurrentPage(receitasTotalPages);
    }
  }, [receitasTotalPages, receitasCurrentPage]);

  useEffect(() => {
    if (cliente?.nome) {
      setPageInfo(cliente.nome, `CNPJ: ${cliente.cnpj || "N/A"}`);
    } else {
      setPageInfo("Detalhes do Cliente", "Carregando...");
    }
  }, [cliente, setPageInfo]);

  const servicosAtivos = useMemo(() => {
    if (!contratos) return [];
    return contratos
      .filter(c => {
        const statusLower = c.status?.toLowerCase() || "";
        return statusLower.includes("ativo") || statusLower.includes("active");
      })
      .map(c => c.servico)
      .filter((s): s is string => !!s);
  }, [contratos]);

  const isLoading = isLoadingCliente;

  if (isLoading) {
    return (
      <div className="bg-background">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  if (clienteError || !cliente) {
    return (
      <div className="bg-background">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <Card className="p-8">
            <div className="text-center">
              <p className="text-destructive font-semibold mb-2">Cliente não encontrado</p>
              <p className="text-sm text-muted-foreground">
                {clienteError instanceof Error ? clienteError.message : "O cliente solicitado não existe"}
              </p>
              <Link href="/">
                <Button variant="default" className="mt-4">
                  Voltar para lista de clientes
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string | null, dataVencimento?: string | Date | null, naoPago?: string | null) => {
    const normalizedStatus = status?.toUpperCase();
    
    // Check if the invoice is overdue (past due date and has pending amount)
    if (dataVencimento && normalizedStatus !== "PAGO" && normalizedStatus !== "ACQUITTED") {
      const vencimento = new Date(dataVencimento);
      const hoje = new Date();
      vencimento.setHours(0, 0, 0, 0);
      hoje.setHours(0, 0, 0, 0);
      const valorPendente = parseFloat(naoPago || "0");
      
      if (vencimento < hoje && valorPendente > 0) {
        return <Badge variant="default" className="bg-amber-700 text-white" data-testid="badge-atrasado">Atrasado</Badge>;
      }
    }
    
    switch (normalizedStatus) {
      case "PAGO":
      case "ACQUITTED":
        return <Badge variant="default" className="bg-green-600" data-testid="badge-pago">Quitado</Badge>;
      case "PENDENTE":
      case "PENDING":
        return <Badge variant="secondary" data-testid="badge-pendente">Pendente</Badge>;
      case "EM ABERTO":
        return <Badge variant="default" className="bg-amber-500 text-white" data-testid="badge-em-aberto">Em Aberto</Badge>;
      case "PREVISTA":
        return <Badge variant="outline" className="border-blue-400 text-blue-600 dark:text-blue-400" data-testid="badge-prevista">Prevista</Badge>;
      case "VENCIDO":
      case "OVERDUE":
        return <Badge variant="destructive" data-testid="badge-vencido">Vencido</Badge>;
      case "CANCELED":
      case "CANCELADO":
      case "CANCELLED":
        return <Badge variant="destructive" data-testid="badge-cancelado">Cancelado</Badge>;
      default:
        return <Badge variant="outline" data-testid="badge-status">{status || "N/A"}</Badge>;
    }
  };

  const getContractStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes("cancelado") || statusLower.includes("inativo")) {
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-300 dark:border-red-700";
    } else if (statusLower.includes("entregue") || statusLower.includes("concluído") || statusLower.includes("finalizado")) {
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300 dark:border-blue-700";
    } else if (statusLower.includes("ativo") || statusLower.includes("active")) {
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-300 dark:border-green-700";
    } else if (statusLower.includes("onboard") || statusLower.includes("início")) {
      return "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300 border-sky-300 dark:border-sky-700";
    } else if (statusLower.includes("triagem") || statusLower.includes("análise")) {
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700";
    } else if (statusLower.includes("cancelamento") || statusLower.includes("pausa")) {
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-300 dark:border-orange-700";
    }
    return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 border-gray-300 dark:border-gray-700";
  };

  const getSquadColorForContract = (squad: string) => {
    switch (squad) {
      case "Supreme":
      case "Performance":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "Forja":
      case "Comunicação":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
      case "Squadra":
      case "Tech":
        return "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300";
      case "Chama":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
    }
  };

  const calcularLTContrato = (contrato: { status: string | null; dataInicio: Date | null; dataSolicitacaoEncerramento: Date | null; dataEncerramento: Date | null }) => {
    if (!contrato.dataInicio) return '-';
    
    const dataInicio = new Date(contrato.dataInicio);
    const statusLower = (contrato.status || '').toLowerCase();
    
    const statusAtivos = ['triagem', 'onboarding', 'ativo', 'em cancelamento', 'cancelamento'];
    const isStatusAtivo = statusAtivos.some(s => statusLower.includes(s));
    
    let dataFim: Date;
    
    if (statusLower.includes('entregue') || statusLower.includes('concluído') || statusLower.includes('finalizado')) {
      if (contrato.dataEncerramento) {
        dataFim = new Date(contrato.dataEncerramento);
      } else {
        return '-';
      }
    } else if (statusLower.includes('cancelado') || statusLower.includes('inativo')) {
      if (contrato.dataSolicitacaoEncerramento) {
        dataFim = new Date(contrato.dataSolicitacaoEncerramento);
      } else {
        return '-';
      }
    } else if (isStatusAtivo) {
      dataFim = new Date();
    } else {
      return '-';
    }
    
    const diffMs = dataFim.getTime() - dataInicio.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const months = Math.floor(diffDays / 30);
    
    return months > 0 ? `${months}m` : `${diffDays}d`;
  };

  const SortIndicator = ({ sortKey, config }: { sortKey: string; config: SortConfig | null }) => {
    if (config?.key !== sortKey) return null;
    return config.direction === 'asc' 
      ? <ChevronUp className="h-4 w-4" />
      : <ChevronDown className="h-4 w-4" />;
  };

  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="hover-elevate -ml-2" data-testid="button-back">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar para clientes
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              {temInadimplencia && (
                <Badge variant="destructive" data-testid="badge-inadimplente">
                  Inadimplente
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <StatsCard
            title="Receita Total"
            value={new Intl.NumberFormat('pt-BR', { 
              style: 'currency', 
              currency: 'BRL',
              minimumFractionDigits: 0
            }).format(totalReceitas)}
            icon={DollarSign}
            variant="success"
            subtitle="Soma de todos os pagamentos recebidos deste cliente"
          />
          <StatsCard
            title="Ticket Médio"
            value={new Intl.NumberFormat('pt-BR', { 
              style: 'currency', 
              currency: 'BRL',
              minimumFractionDigits: 0
            }).format(ticketMedio)}
            icon={TrendingUp}
            variant="info"
            subtitle="Valor médio por pagamento recebido"
          />
          <StatsCard
            title="LT"
            value={`${lt} meses`}
            icon={Receipt}
            variant="default"
            subtitle="Lifetime - quantidade de meses com pagamento"
            tooltipType="help"
          />
          <StatsCard
            title="Status"
            value={temContratoAtivo ? "Ativo" : "Inativo"}
            icon={Activity}
            variant="status"
            statusActive={temContratoAtivo}
            subtitle={temContratoAtivo ? "Cliente possui contratos ativos" : "Nenhum contrato ativo no momento"}
          />
          <StatsCard
            title="Financeiro"
            value={statusFinanceiro.status === 'em_dia' ? 'Em dia' : statusFinanceiro.status === 'atrasado' ? 'Atrasado' : 'Inadimplente'}
            icon={CreditCard}
            variant={statusFinanceiro.status === 'em_dia' ? 'success' : statusFinanceiro.status === 'atrasado' ? 'warning' : 'error'}
            subtitle={statusFinanceiro.diasAtraso > 0 ? `${statusFinanceiro.diasAtraso} dias em atraso` : 'Sem faturas pendentes vencidas'}
          />
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Dados Cadastrais</h2>
            </div>
            <Button
              variant={isEditingDados ? "default" : "outline"}
              size="sm"
              onClick={handleToggleEdit}
              data-testid="button-edit-client"
            >
              <Pencil className="w-4 h-4 mr-2" />
              {isEditingDados ? "Cancelar" : "Editar"}
            </Button>
          </div>
          <Card className="p-6" data-testid="card-client-info">
            {isEditingDados ? (
              <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(onSubmitEdit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="telefone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone</FormLabel>
                          <FormControl>
                            <Input placeholder="(00) 00000-0000" {...field} data-testid="input-telefone" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="responsavel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Responsável (CS)</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome do CS responsável" {...field} data-testid="input-responsavel" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="responsavelGeral"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome Responsável</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome do responsável do cliente" {...field} data-testid="input-responsavel-geral" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="nomeDono"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do Dono</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome do proprietário do negócio" {...field} data-testid="input-nome-dono" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="email@exemplo.com" {...field} data-testid="input-email" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="site"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Site</FormLabel>
                          <FormControl>
                            <Input placeholder="https://exemplo.com" {...field} data-testid="input-site" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="instagram"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Instagram</FormLabel>
                          <FormControl>
                            <Input placeholder="@usuario" {...field} data-testid="input-instagram" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="linkListaClickup"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Link Lista ClickUp</FormLabel>
                          <FormControl>
                            <Input placeholder="https://app.clickup.com/..." {...field} data-testid="input-link-clickup" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="cluster"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cluster</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-cluster">
                                <SelectValue placeholder="Selecione o cluster" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="0">NFNC</SelectItem>
                              <SelectItem value="1">Regulares</SelectItem>
                              <SelectItem value="2">Chaves</SelectItem>
                              <SelectItem value="3">Imperdíveis</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={editForm.control}
                    name="linksContrato"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Links Contrato</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Links dos contratos (um por linha)" 
                            className="min-h-[80px]"
                            {...field} 
                            data-testid="textarea-links-contrato" 
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditingDados(false)}
                      data-testid="button-cancel-edit"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={updateClienteMutation.isPending}
                      data-testid="button-save-edit"
                    >
                      {updateClienteMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        "Salvar"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="flex items-start gap-3" data-testid="info-cnpj">
                <Building2 className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">CNPJ</p>
                  <div className="flex items-center gap-2">
                    <p className="font-medium" data-testid="text-cnpj">{cliente.cnpj || "N/A"}</p>
                    {cliente.cnpj && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(cliente.cnpj!, "CNPJ")}
                        data-testid="button-copy-cnpj"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3" data-testid="info-endereco">
                <MapPin className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Endereço</p>
                  <p className="font-medium" data-testid="text-endereco">{cliente.endereco || "Não informado"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3" data-testid="info-telefone">
                <Phone className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Telefone</p>
                  <p className="font-medium" data-testid="text-telefone">{cliente.telefone || "Não informado"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3" data-testid="info-responsavel">
                <User className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Responsável</p>
                  <p className="font-medium" data-testid="text-responsavel">{cliente.responsavel || "Não informado"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3" data-testid="info-responsavel-geral">
                <User className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Nome Responsável</p>
                  <p className="font-medium" data-testid="text-responsavel-geral">{cliente.responsavelGeral || "Não informado"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3" data-testid="info-nome-dono">
                <Crown className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Nome do Dono</p>
                  <p className="font-medium" data-testid="text-nome-dono">{cliente.nomeDono || "Não informado"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3" data-testid="info-email">
                <Mail className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Email</p>
                  {cliente.email ? (
                    <a href={`mailto:${cliente.email}`} className="font-medium text-primary hover:underline" data-testid="text-email">{cliente.email}</a>
                  ) : (
                    <p className="font-medium text-muted-foreground" data-testid="text-email">Não informado</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3" data-testid="info-site">
                <Globe className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Site</p>
                  {cliente.site ? (
                    <a href={cliente.site.startsWith('http') ? cliente.site : `https://${cliente.site}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline flex items-center gap-1" data-testid="text-site">
                      {cliente.site}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <p className="font-medium text-muted-foreground" data-testid="text-site">Não informado</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3" data-testid="info-instagram">
                <SiInstagram className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Instagram</p>
                  {cliente.instagram ? (
                    <a href={cliente.instagram.startsWith('http') ? cliente.instagram : `https://instagram.com/${cliente.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline flex items-center gap-1" data-testid="text-instagram">
                      {cliente.instagram}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <p className="font-medium text-muted-foreground" data-testid="text-instagram">Não informado</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3" data-testid="info-data-cadastro">
                <Calendar className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Data de Cadastro</p>
                  <p className="font-medium" data-testid="text-data-cadastro">
                    {cliente.createdAt 
                      ? new Date(cliente.createdAt).toLocaleDateString('pt-BR')
                      : cliente.dataInicio 
                        ? new Date(cliente.dataInicio).toLocaleDateString('pt-BR')
                        : "N/A"
                    }
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3" data-testid="info-status">
                <CheckCircle className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                  <Badge variant={temContratoAtivo ? "default" : "secondary"} data-testid="badge-status-cliente">
                    {temContratoAtivo ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </div>

              <div className="flex items-start gap-3" data-testid="info-cluster">
                <Layers className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Cluster</p>
                  <p className="font-medium" data-testid="text-cluster">{mapClusterToName(cliente.cluster)}</p>
                </div>
              </div>

              <div className="flex items-start gap-3" data-testid="info-link-clickup">
                <ListTodo className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Link Lista ClickUp</p>
                  {cliente.linkListaClickup ? (
                    <a href={cliente.linkListaClickup} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline flex items-center gap-1" data-testid="text-link-clickup">
                      Abrir no ClickUp
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <p className="font-medium text-muted-foreground" data-testid="text-link-clickup">Não informado</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3" data-testid="info-links-contrato">
                <Link2 className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Links Contrato</p>
                  {cliente.linksContrato ? (
                    <div className="flex flex-col gap-1" data-testid="list-links-contrato">
                      {cliente.linksContrato.split(/[,\n]/).filter(link => link.trim()).map((link, idx) => (
                        <a key={idx} href={link.trim().startsWith('http') ? link.trim() : `https://${link.trim()}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline flex items-center gap-1 text-sm" data-testid={`link-contrato-${idx}`}>
                          Contrato {idx + 1}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="font-medium text-muted-foreground" data-testid="text-no-links-contrato">Não informado</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3 md:col-span-2" data-testid="info-servicos">
                <Briefcase className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Serviços Ativos</p>
                  {servicosAtivos.length > 0 ? (
                    <div className="flex flex-wrap gap-2" data-testid="list-servicos">
                      {servicosAtivos.map((servico, idx) => (
                        <Badge 
                          key={idx} 
                          variant="outline" 
                          className="bg-primary/10"
                          data-testid={`badge-servico-${idx}`}
                        >
                          {servico}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground" data-testid="text-no-servicos">Nenhum serviço ativo</p>
                  )}
                </div>
              </div>
            </div>
              )}
          </Card>
        </div>

        {isLoadingRevenue ? (
          <div className="mb-8 flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : chartData.length > 0 ? (
          <div className="mb-8">
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h2 className="text-xl font-semibold">Histórico de Faturamento</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Período:</span>
                    <Select
                      value={monthsFilter}
                      onValueChange={setMonthsFilter}
                    >
                      <SelectTrigger className="w-[140px]" data-testid="select-months-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 meses</SelectItem>
                        <SelectItem value="6">6 meses</SelectItem>
                        <SelectItem value="12">12 meses</SelectItem>
                        <SelectItem value="all">Todos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <RevenueChart 
                  data={chartData} 
                  onBarClick={handleBarClick}
                  selectedMonth={selectedMonth}
                />
              </div>
            </Card>
          </div>
        ) : null}

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Contratos</h2>
          </div>
          <Card className="overflow-hidden">
            {isLoadingContratos ? (
              <div className="flex items-center justify-center py-8" data-testid="loading-contratos">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-20 shadow-sm">
                    <TableRow className="bg-muted/30 border-b">
                      <TableHead 
                        className="bg-muted/30 cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleContratoSort('servico')}
                        data-testid="header-sort-service"
                      >
                        <div className="flex items-center gap-1">
                          Serviço
                          <SortIndicator sortKey="servico" config={contratosSortConfig} />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="bg-muted/30 cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleContratoSort('status')}
                        data-testid="header-sort-status"
                      >
                        <div className="flex items-center gap-1">
                          Status
                          <SortIndicator sortKey="status" config={contratosSortConfig} />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="bg-muted/30 cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleContratoSort('squad')}
                        data-testid="header-sort-squad"
                      >
                        <div className="flex items-center gap-1">
                          Squad
                          <SortIndicator sortKey="squad" config={contratosSortConfig} />
                        </div>
                      </TableHead>
                      <TableHead className="bg-muted/30" data-testid="header-responsavel">Responsável</TableHead>
                      <TableHead className="bg-muted/30" data-testid="header-cs">CS</TableHead>
                      <TableHead 
                        className="bg-muted/30 cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleContratoSort('dataInicio')}
                        data-testid="header-sort-date"
                      >
                        <div className="flex items-center gap-1">
                          Data Início
                          <SortIndicator sortKey="dataInicio" config={contratosSortConfig} />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="text-right bg-muted/30 cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleContratoSort('valorr')}
                        data-testid="header-sort-recurring"
                      >
                        <div className="flex items-center justify-end gap-1">
                          Valor Recorrente
                          <SortIndicator sortKey="valorr" config={contratosSortConfig} />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="text-right bg-muted/30 cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => handleContratoSort('valorp')}
                        data-testid="header-sort-onetime"
                      >
                        <div className="flex items-center justify-end gap-1">
                          Valor Pontual
                          <SortIndicator sortKey="valorp" config={contratosSortConfig} />
                        </div>
                      </TableHead>
                      <TableHead className="bg-muted/30" data-testid="header-plano">
                        Plano
                      </TableHead>
                      <TableHead className="bg-muted/30 text-center" data-testid="header-lt">
                        LT
                      </TableHead>
                      <TableHead className="bg-muted/30" data-testid="header-solic-cancel">
                        Solic. Cancel.
                      </TableHead>
                      <TableHead className="bg-muted/30" data-testid="header-data-entrega">
                        Data Entrega
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedContratos && sortedContratos.length > 0 ? (
                      sortedContratos.map((contrato) => (
                        <TableRow key={contrato.idSubtask} className="hover-elevate" data-testid={`contract-row-${contrato.idSubtask}`}>
                          <TableCell className="font-medium" data-testid={`text-service-${contrato.idSubtask}`}>
                            {contrato.servico || "Sem serviço"}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              className={getContractStatusColor(contrato.status || "")} 
                              variant="outline"
                              data-testid={`badge-status-${contrato.idSubtask}`}
                            >
                              {contrato.status || "Desconhecido"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              className={getSquadColorForContract(mapSquadCodeToName(contrato.squad))} 
                              variant="outline"
                              data-testid={`badge-squad-${contrato.idSubtask}`}
                            >
                              {mapSquadCodeToName(contrato.squad)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground" data-testid={`text-responsavel-${contrato.idSubtask}`}>
                            {contrato.responsavel || '-'}
                          </TableCell>
                          <TableCell className="text-muted-foreground" data-testid={`text-cs-${contrato.idSubtask}`}>
                            {contrato.csResponsavel || '-'}
                          </TableCell>
                          <TableCell className="text-muted-foreground" data-testid={`text-date-${contrato.idSubtask}`}>
                            {contrato.dataInicio ? new Date(contrato.dataInicio).toLocaleDateString('pt-BR') : '-'}
                          </TableCell>
                          <TableCell className="text-right font-semibold" data-testid={`text-recurring-${contrato.idSubtask}`}>
                            {contrato.valorr && parseFloat(contrato.valorr) > 0
                              ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(contrato.valorr))
                              : '-'
                            }
                          </TableCell>
                          <TableCell className="text-right font-semibold" data-testid={`text-onetime-${contrato.idSubtask}`}>
                            {contrato.valorp && parseFloat(contrato.valorp) > 0
                              ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(contrato.valorp))
                              : '-'
                            }
                          </TableCell>
                          <TableCell className="text-muted-foreground" data-testid={`text-plano-${contrato.idSubtask}`}>
                            {contrato.plano || '-'}
                          </TableCell>
                          <TableCell className="text-center font-medium" data-testid={`text-lt-${contrato.idSubtask}`}>
                            {calcularLTContrato(contrato)}
                          </TableCell>
                          <TableCell className="text-muted-foreground" data-testid={`text-solic-cancel-${contrato.idSubtask}`}>
                            {contrato.dataSolicitacaoEncerramento ? new Date(contrato.dataSolicitacaoEncerramento).toLocaleDateString('pt-BR') : '-'}
                          </TableCell>
                          <TableCell className="text-muted-foreground" data-testid={`text-data-entrega-${contrato.idSubtask}`}>
                            {contrato.dataEncerramento ? new Date(contrato.dataEncerramento).toLocaleDateString('pt-BR') : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center text-muted-foreground py-8" data-testid="text-no-contracts">
                          Nenhum contrato encontrado para este cliente
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Contas a Receber</h2>
            </div>
            {selectedMonth && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" data-testid="badge-month-filter">
                  Filtrado por: {selectedMonth}
                </Badge>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedMonth(null)}
                  data-testid="button-clear-month-filter"
                >
                  Limpar filtro
                </Button>
              </div>
            )}
          </div>
          <Card className="overflow-hidden">
            {isLoadingReceitas ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-20 shadow-sm">
                      <TableRow className="bg-muted/30 border-b">
                        <TableHead 
                          className="bg-muted/30 cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleReceitaSort('descricao')}
                          data-testid="header-sort-descricao"
                        >
                          <div className="flex items-center gap-1">
                            Descrição
                            <SortIndicator sortKey="descricao" config={receitasSortConfig} />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="bg-muted/30 cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleReceitaSort('status')}
                          data-testid="header-sort-receita-status"
                        >
                          <div className="flex items-center gap-1">
                            Status
                            <SortIndicator sortKey="status" config={receitasSortConfig} />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="bg-muted/30 cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleReceitaSort('dataVencimento')}
                          data-testid="header-sort-vencimento"
                        >
                          <div className="flex items-center gap-1">
                            Vencimento
                            <SortIndicator sortKey="dataVencimento" config={receitasSortConfig} />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="bg-muted/30 cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleReceitaSort('total')}
                          data-testid="header-sort-total"
                        >
                          <div className="flex items-center gap-1">
                            Valor Total
                            <SortIndicator sortKey="total" config={receitasSortConfig} />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="bg-muted/30 cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleReceitaSort('pago')}
                          data-testid="header-sort-pago"
                        >
                          <div className="flex items-center gap-1">
                            Pago
                            <SortIndicator sortKey="pago" config={receitasSortConfig} />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="bg-muted/30 cursor-pointer hover:bg-muted/50 select-none"
                          onClick={() => handleReceitaSort('naoPago')}
                          data-testid="header-sort-pendente"
                        >
                          <div className="flex items-center gap-1">
                            Pendente
                            <SortIndicator sortKey="naoPago" config={receitasSortConfig} />
                          </div>
                        </TableHead>
                        <TableHead className="bg-muted/30">Link Cobrança</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedReceitas.length > 0 ? (
                        paginatedReceitas.map((receita, idx) => (
                          <TableRow key={`receita-${receita.id}-${idx}`} className="hover-elevate">
                            <TableCell className="font-medium">
                              {receita.descricao || "Sem descrição"}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(receita.status, receita.dataVencimento, receita.naoPago)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {receita.dataVencimento 
                                ? new Date(receita.dataVencimento).toLocaleDateString('pt-BR')
                                : "N/A"
                              }
                            </TableCell>
                            <TableCell className="font-semibold">
                              {new Intl.NumberFormat('pt-BR', { 
                                style: 'currency', 
                                currency: 'BRL' 
                              }).format(parseFloat(receita.total || "0"))}
                            </TableCell>
                            <TableCell className="text-green-600">
                              {new Intl.NumberFormat('pt-BR', { 
                                style: 'currency', 
                                currency: 'BRL' 
                              }).format(parseFloat(receita.pago || "0"))}
                            </TableCell>
                            <TableCell className="text-orange-600">
                              {new Intl.NumberFormat('pt-BR', { 
                                style: 'currency', 
                                currency: 'BRL' 
                              }).format(parseFloat(receita.naoPago || "0"))}
                            </TableCell>
                            <TableCell>
                              {receita.urlCobranca ? (
                                <a 
                                  href={receita.urlCobranca} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-primary hover:underline"
                                  data-testid={`link-cobranca-${receita.id}`}
                                >
                                  Acessar
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <span className="text-muted-foreground text-sm" data-testid={`text-no-link-${receita.id}`}>-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            Nenhuma conta a receber encontrada
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {receitasTotalPages > 1 && (
                  <div className="flex items-center justify-between gap-4 p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Itens por página:</span>
                      <Select
                        value={receitasItemsPerPage.toString()}
                        onValueChange={(value) => {
                          setReceitasItemsPerPage(Number(value));
                          setReceitasCurrentPage(1);
                        }}
                      >
                        <SelectTrigger className="w-[100px]" data-testid="select-receitas-items-per-page">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Página {receitasCurrentPage} de {receitasTotalPages}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReceitasCurrentPage(1)}
                          disabled={receitasCurrentPage === 1}
                          data-testid="button-receitas-first-page"
                        >
                          Primeira
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReceitasCurrentPage(receitasCurrentPage - 1)}
                          disabled={receitasCurrentPage === 1}
                          data-testid="button-receitas-prev-page"
                        >
                          Anterior
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReceitasCurrentPage(receitasCurrentPage + 1)}
                          disabled={receitasCurrentPage === receitasTotalPages}
                          data-testid="button-receitas-next-page"
                        >
                          Próxima
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReceitasCurrentPage(receitasTotalPages)}
                          disabled={receitasCurrentPage === receitasTotalPages}
                          data-testid="button-receitas-last-page"
                        >
                          Última
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Key className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Credenciais de Acesso</h2>
          </div>
          <Card className="overflow-hidden">
            {isLoadingCredenciais ? (
              <div className="flex items-center justify-center py-8" data-testid="loading-credenciais">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : credenciais && credenciais.length > 0 && credenciais.some(g => g.credentials.length > 0) ? (
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-20 shadow-sm">
                    <TableRow className="bg-muted/30 border-b">
                      <TableHead className="bg-muted/30">Plataforma</TableHead>
                      <TableHead className="bg-muted/30">Login</TableHead>
                      <TableHead className="bg-muted/30">Senha</TableHead>
                      <TableHead className="bg-muted/30">URL</TableHead>
                      <TableHead className="bg-muted/30">Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {credenciais.flatMap((group) => 
                      group.credentials.map((cred) => (
                        <TableRow key={cred.id} className="hover-elevate" data-testid={`credential-row-${cred.id}`}>
                          <TableCell className="font-medium" data-testid={`text-platform-${cred.id}`}>
                            {cred.platform || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span data-testid={`text-username-${cred.id}`}>{cred.username || "-"}</span>
                              {cred.username && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => copyToClipboard(cred.username, "Login")}
                                  data-testid={`button-copy-username-${cred.id}`}
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span 
                                className="font-mono" 
                                data-testid={`text-password-${cred.id}`}
                              >
                                {visiblePasswords.has(cred.id) 
                                  ? (cred.password || "-")
                                  : cred.password ? "••••••••" : "-"
                                }
                              </span>
                              {cred.password && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => togglePasswordVisibility(cred.id)}
                                    data-testid={`button-toggle-password-${cred.id}`}
                                  >
                                    {visiblePasswords.has(cred.id) ? (
                                      <EyeOff className="w-3.5 h-3.5" />
                                    ) : (
                                      <Eye className="w-3.5 h-3.5" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => copyToClipboard(cred.password, "Senha")}
                                    data-testid={`button-copy-password-${cred.id}`}
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {cred.accessUrl ? (
                              <a
                                href={cred.accessUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline"
                                data-testid={`link-url-${cred.id}`}
                              >
                                Acessar
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground text-sm" data-testid={`text-no-url-${cred.id}`}>-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-[200px] truncate" data-testid={`text-observations-${cred.id}`}>
                            {cred.observations || "-"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center" data-testid="no-credentials">
                <Key className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Nenhuma credencial vinculada a este cliente</p>
              </div>
            )}
          </Card>
        </div>

      </div>
    </div>
  );
}
