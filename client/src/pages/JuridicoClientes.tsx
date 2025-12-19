import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Scale,
  Users,
  DollarSign,
  Search,
  AlertTriangle,
  Phone,
  Building2,
  Edit3,
  Loader2,
  CheckCircle2,
  Gavel,
  FileWarning,
  Handshake,
  Send,
  XCircle,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Calendar,
  FileText,
  ExternalLink,
  Trophy,
  Target,
  Wallet,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  telefone: string | null;
}

interface Contexto {
  contexto: string | null;
  evidencias: string | null;
  acao: string | null;
  statusFinanceiro: string | null;
  detalheFinanceiro: string | null;
  atualizadoPor: string | null;
  atualizadoEm: string | null;
  contextoJuridico: string | null;
  procedimentoJuridico: string | null;
  statusJuridico: string | null;
  valorAcordado: number | null;
  atualizadoJuridicoPor: string | null;
  atualizadoJuridicoEm: string | null;
}

interface Parcela {
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

interface ClienteJuridico {
  cliente: ClienteInadimplente;
  contexto: Contexto;
  parcelas: Parcela[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const formatDate = (date: string | null) => {
  if (!date) return "-";
  try {
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "-";
  }
};

const PROCEDIMENTOS = [
  { value: "notificacao", label: "Notificação", icon: Send, color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "protesto", label: "Protesto", icon: FileWarning, color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "acao_judicial", label: "Ação Judicial", icon: Gavel, color: "bg-red-100 text-red-700 border-red-200" },
  { value: "acordo", label: "Acordo", icon: Handshake, color: "bg-green-100 text-green-700 border-green-200" },
  { value: "baixa", label: "Baixa", icon: XCircle, color: "bg-gray-100 text-gray-600 border-gray-200" },
];

const STATUS_JURIDICO = [
  { value: "pendente", label: "Aguardando", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  { value: "em_andamento", label: "Em Andamento", color: "bg-blue-100 text-blue-700 border-blue-200", icon: TrendingUp },
  { value: "concluido", label: "Concluído", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
  { value: "cancelado", label: "Cancelado", color: "bg-gray-100 text-gray-600 border-gray-200", icon: XCircle },
];

export default function JuridicoClientes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [editingCliente, setEditingCliente] = useState<ClienteJuridico | null>(null);
  const [editForm, setEditForm] = useState({
    contextoJuridico: "",
    procedimentoJuridico: "",
    statusJuridico: "",
    valorAcordado: "",
  });
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ clientes: ClienteJuridico[] }>({
    queryKey: ["/api/juridico/clientes"],
    staleTime: 5 * 60 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { clienteId: string; contextoJuridico: string; procedimentoJuridico: string; statusJuridico: string; valorAcordado?: number }) => {
      return apiRequest("PUT", `/api/juridico/clientes/${data.clienteId}/contexto`, {
        contextoJuridico: data.contextoJuridico,
        procedimentoJuridico: data.procedimentoJuridico,
        statusJuridico: data.statusJuridico,
        valorAcordado: data.valorAcordado,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/juridico/clientes"] });
      toast({ title: "Salvo com sucesso!" });
      setEditingCliente(null);
    },
    onError: () => {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    },
  });

  const clientes = data?.clientes || [];

  const filteredClientes = useMemo(() => {
    return clientes.filter((item) => {
      const matchesSearch =
        searchTerm === "" ||
        item.cliente.nomeCliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.cliente.empresa?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "pendente" && !item.contexto?.procedimentoJuridico) ||
        item.contexto?.procedimentoJuridico === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [clientes, searchTerm, statusFilter]);

  const sortedClientes = useMemo(() => {
    return [...filteredClientes].sort((a, b) => b.cliente.diasAtrasoMax - a.cliente.diasAtrasoMax);
  }, [filteredClientes]);

  const totals = useMemo(() => {
    const total = filteredClientes.reduce((acc, item) => acc + item.cliente.valorTotal, 0);
    const urgentes = filteredClientes.filter(c => c.cliente.diasAtrasoMax > 90).length;
    const semAcao = filteredClientes.filter(c => !c.contexto?.procedimentoJuridico).length;
    return { total, count: filteredClientes.length, urgentes, semAcao };
  }, [filteredClientes]);

  // Clientes pré-negociados (recuperados antes do registro no sistema jurídico)
  const clientesPreNegociados = useMemo(() => [
    { nome: "GC BY ME", valorOriginal: 3447.50, valorRecuperado: 3447.50 },
    { nome: "100% Voce Industria e Comércio", valorOriginal: 3997.00, valorRecuperado: 3997.00 },
    { nome: "Livraria Nossa Senhora Aparecida", valorOriginal: 3697.00, valorRecuperado: 3697.00 },
    { nome: "COPPINI Empreendimentos Digitais LTDA", valorOriginal: 2209.70, valorRecuperado: 2209.70 },
    { nome: "FLOREST", valorOriginal: 3997.00, valorRecuperado: 3997.00 },
    { nome: "GO COFFE", valorOriginal: 3283.00, valorRecuperado: 3283.00 },
    { nome: "GOLIK", valorOriginal: 2800.00, valorRecuperado: 1500.00 },
    { nome: "100% CIFRAS", valorOriginal: 882.83, valorRecuperado: 882.83 },
    { nome: "VOLTA VIBE", valorOriginal: 1000.00, valorRecuperado: 1000.00 },
    { nome: "CHOCOLATERIA BRASIL", valorOriginal: 6987.59, valorRecuperado: 6987.59 },
  ], []);

  const recuperadosStats = useMemo(() => {
    const recuperadosSistema = clientes.filter(c => 
      c.contexto?.statusJuridico === 'concluido' && 
      (c.contexto?.procedimentoJuridico === 'acordo' || c.contexto?.procedimentoJuridico === 'baixa')
    );
    
    // Combina recuperados do sistema + pré-negociados
    const totalRecuperados = recuperadosSistema.length + clientesPreNegociados.length;
    const valorNegociadoSistema = recuperadosSistema.reduce((acc, c) => acc + (c.contexto?.valorAcordado || 0), 0);
    const valorOriginalSistema = recuperadosSistema.reduce((acc, c) => acc + c.cliente.valorTotal, 0);
    
    const valorPreNegociado = clientesPreNegociados.reduce((acc, c) => acc + c.valorRecuperado, 0);
    const valorOriginalPre = clientesPreNegociados.reduce((acc, c) => acc + c.valorOriginal, 0);
    
    const valorNegociado = valorNegociadoSistema + valorPreNegociado;
    const valorOriginal = valorOriginalSistema + valorOriginalPre;
    const taxaRecuperacao = valorOriginal > 0 ? (valorNegociado / valorOriginal) * 100 : 0;
    
    const porProcedimento = {
      acordo: recuperadosSistema.filter(c => c.contexto?.procedimentoJuridico === 'acordo').length + clientesPreNegociados.length,
      baixa: recuperadosSistema.filter(c => c.contexto?.procedimentoJuridico === 'baixa').length,
    };
    
    return { 
      clientesRecuperados: totalRecuperados, 
      valorNegociado, 
      valorOriginal, 
      taxaRecuperacao, 
      porProcedimento, 
      lista: recuperadosSistema,
      listaPreNegociados: clientesPreNegociados
    };
  }, [clientes, clientesPreNegociados]);

  const openEditModal = (cliente: ClienteJuridico) => {
    setEditingCliente(cliente);
    setEditForm({
      contextoJuridico: cliente.contexto?.contextoJuridico || "",
      procedimentoJuridico: cliente.contexto?.procedimentoJuridico || "",
      statusJuridico: cliente.contexto?.statusJuridico || "",
      valorAcordado: cliente.contexto?.valorAcordado?.toString() || "",
    });
  };

  const parseBRLCurrency = (value: string): number | undefined => {
    if (!value || value.trim() === '') return undefined;
    // Remove R$, spaces, and handle both formats: 1.234,56 (BRL) and 1234.56 (US)
    let cleaned = value.replace(/R\$\s*/gi, '').replace(/\s/g, '').trim();
    // If has comma, assume BRL format (1.234,56)
    if (cleaned.includes(',')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }
    const num = parseFloat(cleaned);
    return isNaN(num) ? undefined : num;
  };

  const handleSave = () => {
    if (!editingCliente) return;
    const valorNum = parseBRLCurrency(editForm.valorAcordado);
    updateMutation.mutate({
      clienteId: editingCliente.cliente.idCliente,
      contextoJuridico: editForm.contextoJuridico,
      procedimentoJuridico: editForm.procedimentoJuridico,
      statusJuridico: editForm.statusJuridico,
      valorAcordado: valorNum,
    });
  };

  const getProcedimentoInfo = (value: string | null) => {
    if (!value) return null;
    return PROCEDIMENTOS.find(p => p.value === value);
  };

  const getStatusInfo = (value: string | null) => {
    if (!value) return null;
    return STATUS_JURIDICO.find(s => s.value === value);
  };

  const getUrgencyLevel = (dias: number) => {
    if (dias > 90) return { level: "URGENTE", color: "bg-red-500", textColor: "text-white" };
    if (dias > 60) return { level: "ATENÇÃO", color: "bg-orange-500", textColor: "text-white" };
    if (dias > 30) return { level: "MODERADO", color: "bg-amber-400", textColor: "text-amber-900" };
    return { level: "RECENTE", color: "bg-slate-300", textColor: "text-slate-700" };
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
        <Skeleton className="h-12 w-80" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header Simples */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Scale className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800" data-testid="text-page-title">
                Cobrança Jurídica
              </h1>
              <p className="text-slate-500">
                {totals.count} cliente{totals.count !== 1 && 's'} • {formatCurrency(totals.total)} em aberto
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        
        <Tabs defaultValue="ativos" className="space-y-6">
          <TabsList className="bg-white shadow-sm border p-1 h-auto">
            <TabsTrigger 
              value="ativos" 
              className="data-[state=active]:bg-primary data-[state=active]:text-white px-6 py-3 text-base"
              data-testid="tab-casos-ativos"
            >
              <Gavel className="w-5 h-5 mr-2" />
              Casos Ativos ({totals.count})
            </TabsTrigger>
            <TabsTrigger 
              value="recuperados" 
              className="data-[state=active]:bg-green-600 data-[state=active]:text-white px-6 py-3 text-base"
              data-testid="tab-recuperados"
            >
              <Trophy className="w-5 h-5 mr-2" />
              Recuperados ({recuperadosStats.clientesRecuperados})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ativos" className="space-y-6 mt-0">
            {/* Cards de Resumo - Grandes e Claros */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-red-50 rounded-2xl">
                      <DollarSign className="h-8 w-8 text-red-500" />
                    </div>
                    <div>
                      <p className="text-slate-500 text-sm font-medium">Valor Total</p>
                      <p className="text-3xl font-bold text-slate-800" data-testid="text-total-value">
                        {formatCurrency(totals.total)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={`bg-white shadow-sm hover:shadow-md transition-shadow ${totals.urgentes > 0 ? 'ring-2 ring-red-200' : ''}`}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-orange-50 rounded-2xl">
                      <AlertTriangle className="h-8 w-8 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-slate-500 text-sm font-medium">Casos Urgentes</p>
                      <p className="text-3xl font-bold text-orange-600" data-testid="text-urgent-cases">
                        {totals.urgentes}
                      </p>
                      <p className="text-xs text-slate-400">mais de 90 dias</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-amber-50 rounded-2xl">
                      <Clock className="h-8 w-8 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-slate-500 text-sm font-medium">Sem Ação Definida</p>
                      <p className="text-3xl font-bold text-amber-600" data-testid="text-no-action">
                        {totals.semAcao}
                      </p>
                      <p className="text-xs text-slate-400">precisam de análise</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filtros Simples */}
            <Card className="bg-white shadow-sm">
              <CardContent className="py-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      placeholder="Buscar por nome ou empresa..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 h-12 text-base bg-slate-50 border-slate-200"
                      data-testid="input-search"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full md:w-[220px] h-12 bg-slate-50 border-slate-200" data-testid="filter-status">
                      <SelectValue placeholder="Filtrar por ação" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="all">Todos os casos</SelectItem>
                      <SelectItem value="pendente">Sem ação definida</SelectItem>
                      {PROCEDIMENTOS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Lista de Clientes - Cards Grandes */}
            {sortedClientes.length === 0 ? (
              <Card className="bg-white shadow-sm">
                <CardContent className="py-16 text-center">
                  <Scale className="h-16 w-16 mx-auto text-slate-200 mb-4" />
                  <p className="text-xl font-medium text-slate-600">Nenhum caso encontrado</p>
                  <p className="text-slate-400 mt-1">Tente mudar os filtros de busca</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
            {sortedClientes.map((item, index) => {
              const urgency = getUrgencyLevel(item.cliente.diasAtrasoMax);
              const procedimento = getProcedimentoInfo(item.contexto?.procedimentoJuridico);
              const status = getStatusInfo(item.contexto?.statusJuridico);
              const isExpanded = expandedClient === item.cliente.idCliente;
              const ProcIcon = procedimento?.icon;
              const StatusIcon = status?.icon;

              return (
                <Card 
                  key={item.cliente.idCliente} 
                  className={`bg-white shadow-sm hover:shadow-md transition-all ${
                    item.cliente.diasAtrasoMax > 90 ? 'border-l-4 border-l-red-500' : 
                    item.cliente.diasAtrasoMax > 60 ? 'border-l-4 border-l-orange-400' : ''
                  }`}
                  data-testid={`card-client-${index}`}
                >
                  <CardContent className="py-5">
                    {/* Linha Principal */}
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      
                      {/* Info do Cliente */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3">
                          <Badge className={`${urgency.color} ${urgency.textColor} text-xs font-bold px-2 py-1 shrink-0`}>
                            {urgency.level}
                          </Badge>
                          <div className="min-w-0">
                            <h3 className="text-lg font-semibold text-slate-800 truncate" data-testid={`text-client-name-${index}`}>
                              {item.cliente.nomeCliente}
                            </h3>
                            <p className="text-slate-500 text-sm truncate">
                              {item.cliente.empresa}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Valor e Dias */}
                      <div className="flex items-center gap-6 lg:gap-8">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-red-600" data-testid={`text-value-${index}`}>
                            {formatCurrency(item.cliente.valorTotal)}
                          </p>
                          <p className="text-xs text-slate-400">
                            {item.cliente.quantidadeParcelas} parcela{item.cliente.quantidadeParcelas !== 1 && 's'}
                          </p>
                        </div>
                        {item.contexto?.valorAcordado != null && item.contexto.valorAcordado > 0 && (
                          <div className="text-center">
                            <p className="text-2xl font-bold text-green-600" data-testid={`text-valor-pago-${index}`}>
                              {formatCurrency(item.contexto.valorAcordado)}
                            </p>
                            <p className="text-xs text-green-500 font-medium">recebido</p>
                          </div>
                        )}
                        <div className="text-center min-w-[80px]">
                          <p className="text-2xl font-bold text-slate-700">
                            {item.cliente.diasAtrasoMax}
                          </p>
                          <p className="text-xs text-slate-400">dias atraso</p>
                        </div>
                      </div>

                      {/* Status e Ações */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {procedimento ? (
                          <Badge className={`${procedimento.color} border text-sm px-3 py-1.5`}>
                            {ProcIcon && <ProcIcon className="h-4 w-4 mr-1.5" />}
                            {procedimento.label}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-dashed border-2 text-slate-400 px-3 py-1.5">
                            Sem ação
                          </Badge>
                        )}
                        {status && (
                          <Badge className={`${status.color} border text-sm px-3 py-1.5`}>
                            {StatusIcon && <StatusIcon className="h-4 w-4 mr-1.5" />}
                            {status.label}
                          </Badge>
                        )}
                        
                        <Button 
                          size="lg"
                          className="bg-primary hover:bg-primary/90 text-white font-medium"
                          onClick={() => openEditModal(item)}
                          data-testid={`button-edit-${index}`}
                        >
                          <Edit3 className="h-4 w-4 mr-2" />
                          Atualizar
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setExpandedClient(isExpanded ? null : item.cliente.idCliente)}
                          data-testid={`button-expand-${index}`}
                        >
                          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </Button>
                      </div>
                    </div>

                    {/* Área Expandida */}
                    {isExpanded && (
                      <div className="mt-6 pt-6 border-t border-slate-100 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          
                          {/* Informações do Cliente */}
                          <div className="bg-slate-50 rounded-xl p-4">
                            <h4 className="font-semibold text-slate-700 flex items-center gap-2 mb-3">
                              <Building2 className="h-4 w-4" />
                              Dados do Cliente
                            </h4>
                            <div className="space-y-2 text-sm">
                              {item.cliente.telefone && (
                                <div className="flex items-center gap-2 text-slate-600">
                                  <Phone className="h-4 w-4 text-slate-400" />
                                  <span>{item.cliente.telefone}</span>
                                </div>
                              )}
                              {item.cliente.responsavel && (
                                <div className="flex items-center gap-2 text-slate-600">
                                  <Users className="h-4 w-4 text-slate-400" />
                                  <span>Responsável: {item.cliente.responsavel}</span>
                                </div>
                              )}
                              {item.cliente.cnpj && (
                                <p className="text-slate-500">CNPJ: {item.cliente.cnpj}</p>
                              )}
                            </div>
                          </div>

                          {/* Contexto do CS */}
                          <div className="bg-amber-50 rounded-xl p-4">
                            <h4 className="font-semibold text-amber-800 flex items-center gap-2 mb-3">
                              <AlertTriangle className="h-4 w-4" />
                              Observações do CS
                            </h4>
                            <p className="text-sm text-amber-900/80 leading-relaxed">
                              {item.contexto?.contexto || "Sem observações registradas"}
                            </p>
                          </div>

                          {/* Contexto Jurídico */}
                          <div className="bg-primary/5 rounded-xl p-4">
                            <h4 className="font-semibold text-primary flex items-center gap-2 mb-3">
                              <Scale className="h-4 w-4" />
                              Anotações Jurídicas
                            </h4>
                            {item.contexto?.contextoJuridico ? (
                              <>
                                <p className="text-sm text-slate-600 leading-relaxed">
                                  {item.contexto.contextoJuridico}
                                </p>
                                {item.contexto.atualizadoJuridicoPor && (
                                  <p className="text-xs text-slate-400 mt-3 pt-2 border-t border-slate-200">
                                    Por {item.contexto.atualizadoJuridicoPor} em {formatDate(item.contexto.atualizadoJuridicoEm)}
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-sm text-slate-400 italic">
                                Nenhuma anotação ainda
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Parcelas */}
                        <div className="bg-white rounded-xl border border-slate-200">
                          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                            <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              Parcelas em Atraso
                            </h4>
                            <Badge variant="secondary">{item.parcelas.length}</Badge>
                          </div>
                          <div className="max-h-[200px] overflow-y-auto">
                            {item.parcelas.map((parcela, pIndex) => (
                              <div 
                                key={parcela.id}
                                className="px-4 py-3 border-b border-slate-50 last:border-0 flex items-center justify-between hover:bg-slate-50"
                                data-testid={`row-parcela-${index}-${pIndex}`}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-slate-700 truncate">{parcela.descricao}</p>
                                  <p className="text-sm text-slate-400">
                                    Venceu em {formatDate(parcela.dataVencimento)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-4">
                                  <Badge 
                                    variant={parcela.diasAtraso > 90 ? "destructive" : "secondary"}
                                    className="font-mono"
                                  >
                                    {parcela.diasAtraso}d
                                  </Badge>
                                  <p className="font-bold text-red-600 min-w-[100px] text-right">
                                    {formatCurrency(parcela.naoPago)}
                                  </p>
                                  {parcela.urlCobranca && (
                                    <a
                                      href={parcela.urlCobranca}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:text-primary/80"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
              })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="recuperados" className="space-y-6 mt-0">
            {/* Cards de Métricas de Recuperação */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-green-50 rounded-2xl">
                      <Trophy className="h-8 w-8 text-green-600" />
                    </div>
                    <div>
                      <p className="text-slate-500 text-sm font-medium">Clientes Recuperados</p>
                      <p className="text-3xl font-bold text-green-600" data-testid="text-clientes-recuperados">
                        {recuperadosStats.clientesRecuperados}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-emerald-50 rounded-2xl">
                      <Wallet className="h-8 w-8 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-slate-500 text-sm font-medium">Valor Recuperado</p>
                      <p className="text-2xl font-bold text-emerald-600" data-testid="text-valor-recuperado">
                        {formatCurrency(recuperadosStats.valorNegociado)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-blue-50 rounded-2xl">
                      <Target className="h-8 w-8 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-slate-500 text-sm font-medium">Valor Original</p>
                      <p className="text-2xl font-bold text-blue-600" data-testid="text-valor-original">
                        {formatCurrency(recuperadosStats.valorOriginal)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-purple-50 rounded-2xl">
                      <TrendingUp className="h-8 w-8 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-slate-500 text-sm font-medium">Taxa de Recuperação</p>
                      <p className="text-3xl font-bold text-purple-600" data-testid="text-taxa-recuperacao">
                        {recuperadosStats.taxaRecuperacao.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Breakdown por Tipo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-white shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-green-50 rounded-xl">
                        <Handshake className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-slate-500 text-sm">Acordos Fechados</p>
                        <p className="text-2xl font-bold text-green-600">{recuperadosStats.porProcedimento.acordo}</p>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-700 border-green-200 text-lg px-4 py-1">
                      Acordo
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-gray-50 rounded-xl">
                        <XCircle className="h-6 w-6 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-slate-500 text-sm">Baixas Realizadas</p>
                        <p className="text-2xl font-bold text-gray-600">{recuperadosStats.porProcedimento.baixa}</p>
                      </div>
                    </div>
                    <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-lg px-4 py-1">
                      Baixa
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Lista de Clientes Recuperados */}
            <Card className="bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Clientes Recuperados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Clientes do sistema */}
                  {recuperadosStats.lista.map((item, index) => {
                    const procInfo = getProcedimentoInfo(item.contexto?.procedimentoJuridico);
                    return (
                      <div 
                        key={item.cliente.idCliente}
                        className="flex items-center justify-between p-4 bg-green-50/50 rounded-xl border border-green-100"
                        data-testid={`row-recuperado-${index}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{item.cliente.nomeCliente}</p>
                            <p className="text-sm text-slate-500">{item.cliente.empresa}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 flex-wrap">
                          {procInfo && (
                            <Badge className={`${procInfo.color} border`}>
                              {procInfo.label}
                            </Badge>
                          )}
                          <div className="text-right">
                            <p className="text-sm text-slate-500">Valor Original</p>
                            <p className="font-medium text-slate-600">{formatCurrency(item.cliente.valorTotal)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-slate-500">Valor Recuperado</p>
                            <p className="font-bold text-green-600">{formatCurrency(item.contexto?.valorAcordado || 0)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Clientes pré-negociados (históricos) */}
                  {recuperadosStats.listaPreNegociados.map((item, index) => (
                    <div 
                      key={`pre-${index}`}
                      className="flex items-center justify-between p-4 bg-emerald-50/50 rounded-xl border border-emerald-100"
                      data-testid={`row-pre-negociado-${index}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-emerald-100 rounded-lg">
                          <Handshake className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{item.nome}</p>
                          <p className="text-xs text-emerald-600">Negociado antes do registro</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 flex-wrap">
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                          Acordo
                        </Badge>
                        <div className="text-right">
                          <p className="text-sm text-slate-500">Valor Original</p>
                          <p className="font-medium text-slate-600">{formatCurrency(item.valorOriginal)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-slate-500">Valor Recuperado</p>
                          <p className="font-bold text-emerald-600">{formatCurrency(item.valorRecuperado)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de Edição - Simples e Grande */}
      <Dialog open={!!editingCliente} onOpenChange={() => setEditingCliente(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Scale className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">Atualizar Caso</DialogTitle>
                <DialogDescription className="text-base">
                  {editingCliente?.cliente.nomeCliente}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Tipo de Ação */}
            <div className="space-y-3">
              <label className="text-base font-semibold text-slate-700">
                Qual ação está sendo tomada?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PROCEDIMENTOS.map((proc) => {
                  const Icon = proc.icon;
                  const isSelected = editForm.procedimentoJuridico === proc.value;
                  return (
                    <Button
                      key={proc.value}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      className={`h-auto py-3 justify-start ${isSelected ? '' : 'hover:bg-slate-50'}`}
                      onClick={() => setEditForm({ ...editForm, procedimentoJuridico: proc.value })}
                      data-testid={`button-proc-${proc.value}`}
                    >
                      <Icon className="h-5 w-5 mr-2" />
                      {proc.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Status */}
            <div className="space-y-3">
              <label className="text-base font-semibold text-slate-700">
                Qual o status atual?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {STATUS_JURIDICO.map((status) => {
                  const Icon = status.icon;
                  const isSelected = editForm.statusJuridico === status.value;
                  return (
                    <Button
                      key={status.value}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      className={`h-auto py-3 justify-start ${isSelected ? '' : 'hover:bg-slate-50'}`}
                      onClick={() => setEditForm({ ...editForm, statusJuridico: status.value })}
                      data-testid={`button-status-${status.value}`}
                    >
                      <Icon className="h-5 w-5 mr-2" />
                      {status.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Valor Recebido */}
            <div className="space-y-3">
              <label className="text-base font-semibold text-slate-700">
                Valor pago pelo cliente (após negociação)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">R$</span>
                <Input
                  type="text"
                  placeholder="0,00"
                  value={editForm.valorAcordado}
                  onChange={(e) => setEditForm({ ...editForm, valorAcordado: e.target.value })}
                  className="pl-10 h-12 text-lg font-semibold"
                  data-testid="input-valor-acordado"
                />
              </div>
              <p className="text-sm text-slate-400">
                Deixe em branco se ainda não houve pagamento
              </p>
            </div>

            {/* Anotações */}
            <div className="space-y-3">
              <label className="text-base font-semibold text-slate-700">
                Anotações e observações
              </label>
              <Textarea
                placeholder="Descreva o andamento do caso, acordos, protocolos..."
                value={editForm.contextoJuridico}
                onChange={(e) => setEditForm({ ...editForm, contextoJuridico: e.target.value })}
                className="min-h-[120px] text-base resize-none"
                data-testid="textarea-contexto"
              />
            </div>

            {editingCliente?.contexto?.atualizadoJuridicoPor && (
              <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 p-3 rounded-lg">
                <Calendar className="h-4 w-4" />
                Última atualização por {editingCliente.contexto.atualizadoJuridicoPor} em{" "}
                {formatDate(editingCliente.contexto.atualizadoJuridicoEm)}
              </div>
            )}
          </div>

          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setEditingCliente(null)}
              className="flex-1"
              data-testid="button-cancel"
            >
              Cancelar
            </Button>
            <Button
              size="lg"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="flex-1 bg-primary hover:bg-primary/90"
              data-testid="button-save"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  Salvar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
