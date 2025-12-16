import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Scale,
  Users,
  DollarSign,
  Clock,
  Search,
  AlertTriangle,
  Phone,
  Building2,
  Receipt,
  ExternalLink,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Edit,
  FileText,
  Loader2,
  CheckCircle2,
  Gavel,
  FileWarning,
  Handshake,
  Send,
  XCircle,
  Filter,
  TrendingUp,
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
  { value: "notificacao", label: "Notificação Extrajudicial", icon: Send, color: "text-blue-500" },
  { value: "protesto", label: "Protesto", icon: FileWarning, color: "text-orange-500" },
  { value: "acao_judicial", label: "Ação Judicial", icon: Gavel, color: "text-red-500" },
  { value: "acordo", label: "Acordo", icon: Handshake, color: "text-green-500" },
  { value: "baixa", label: "Baixa", icon: XCircle, color: "text-gray-500" },
];

const STATUS_JURIDICO = [
  { value: "pendente", label: "Pendente", color: "bg-amber-500/20 text-amber-700 border-amber-500/30", icon: Clock },
  { value: "em_andamento", label: "Em Andamento", color: "bg-blue-500/20 text-blue-700 border-blue-500/30", icon: TrendingUp },
  { value: "concluido", label: "Concluído", color: "bg-emerald-500/20 text-emerald-700 border-emerald-500/30", icon: CheckCircle2 },
  { value: "cancelado", label: "Cancelado", color: "bg-gray-500/20 text-gray-600 border-gray-500/30", icon: XCircle },
];

export default function JuridicoClientes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [procedimentoFilter, setProcedimentoFilter] = useState<string>("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [editingCliente, setEditingCliente] = useState<ClienteJuridico | null>(null);
  const [editForm, setEditForm] = useState({
    contextoJuridico: "",
    procedimentoJuridico: "",
    statusJuridico: "",
  });
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ clientes: ClienteJuridico[] }>({
    queryKey: ["/api/juridico/clientes"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { clienteId: string; contextoJuridico: string; procedimentoJuridico: string; statusJuridico: string }) => {
      return apiRequest("PUT", `/api/juridico/clientes/${data.clienteId}/contexto`, {
        contextoJuridico: data.contextoJuridico,
        procedimentoJuridico: data.procedimentoJuridico,
        statusJuridico: data.statusJuridico,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/juridico/clientes"] });
      toast({
        title: "Contexto atualizado",
        description: "O contexto jurídico foi salvo com sucesso.",
      });
      setEditingCliente(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível salvar o contexto jurídico.",
        variant: "destructive",
      });
    },
  });

  const clientes = data?.clientes || [];

  const filteredClientes = useMemo(() => {
    return clientes.filter((item) => {
      const matchesSearch =
        searchTerm === "" ||
        item.cliente.nomeCliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.cliente.empresa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.cliente.cnpj?.includes(searchTerm);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "sem_status" && !item.contexto?.statusJuridico) ||
        item.contexto?.statusJuridico === statusFilter;

      const matchesProcedimento =
        procedimentoFilter === "all" ||
        (procedimentoFilter === "sem_procedimento" && !item.contexto?.procedimentoJuridico) ||
        item.contexto?.procedimentoJuridico === procedimentoFilter;

      return matchesSearch && matchesStatus && matchesProcedimento;
    });
  }, [clientes, searchTerm, statusFilter, procedimentoFilter]);

  const totals = useMemo(() => {
    const total = filteredClientes.reduce((acc, item) => acc + item.cliente.valorTotal, 0);
    const totalParcelas = filteredClientes.reduce((acc, item) => acc + item.cliente.quantidadeParcelas, 0);
    const comContextoJuridico = filteredClientes.filter(c => c.contexto?.procedimentoJuridico || c.contexto?.statusJuridico).length;
    const urgentes = filteredClientes.filter(c => c.cliente.diasAtrasoMax > 90).length;
    return { total, totalParcelas, count: filteredClientes.length, comContextoJuridico, urgentes };
  }, [filteredClientes]);

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const openEditModal = (cliente: ClienteJuridico) => {
    setEditingCliente(cliente);
    setEditForm({
      contextoJuridico: cliente.contexto?.contextoJuridico || "",
      procedimentoJuridico: cliente.contexto?.procedimentoJuridico || "",
      statusJuridico: cliente.contexto?.statusJuridico || "",
    });
  };

  const handleSave = () => {
    if (!editingCliente) return;
    updateMutation.mutate({
      clienteId: editingCliente.cliente.idCliente,
      ...editForm,
    });
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) {
      return (
        <Badge variant="outline" className="text-muted-foreground border-dashed">
          <AlertCircle className="h-3 w-3 mr-1" />
          Sem status
        </Badge>
      );
    }
    const statusConfig = STATUS_JURIDICO.find(s => s.value === status);
    if (!statusConfig) return <Badge variant="outline">{status}</Badge>;
    const IconComponent = statusConfig.icon;
    return (
      <Badge className={`${statusConfig.color} border`}>
        <IconComponent className="h-3 w-3 mr-1" />
        {statusConfig.label}
      </Badge>
    );
  };

  const getProcedimentoBadge = (value: string | null) => {
    if (!value) {
      return (
        <span className="text-muted-foreground text-sm italic">Não definido</span>
      );
    }
    const proc = PROCEDIMENTOS.find(p => p.value === value);
    if (!proc) return <span className="text-sm">{value}</span>;
    const IconComponent = proc.icon;
    return (
      <div className="flex items-center gap-1.5">
        <IconComponent className={`h-4 w-4 ${proc.color}`} />
        <span className="text-sm font-medium">{proc.label}</span>
      </div>
    );
  };

  const getUrgencyIndicator = (diasAtraso: number) => {
    if (diasAtraso > 90) {
      return (
        <Tooltip>
          <TooltipTrigger>
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          </TooltipTrigger>
          <TooltipContent>Urgente: mais de 90 dias de atraso</TooltipContent>
        </Tooltip>
      );
    }
    if (diasAtraso > 60) {
      return (
        <Tooltip>
          <TooltipTrigger>
            <div className="w-2 h-2 rounded-full bg-orange-500" />
          </TooltipTrigger>
          <TooltipContent>Atenção: mais de 60 dias de atraso</TooltipContent>
        </Tooltip>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const progressPercent = totals.count > 0 ? (totals.comContextoJuridico / totals.count) * 100 : 0;

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Scale className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">
                Cobrança Jurídica
              </h1>
              <p className="text-muted-foreground text-sm">
                Clientes inadimplentes com mais de 3 dias de atraso
              </p>
            </div>
          </div>
          {totals.urgentes > 0 && (
            <Badge variant="destructive" className="text-sm px-3 py-1.5">
              <AlertTriangle className="h-4 w-4 mr-1.5" />
              {totals.urgentes} caso{totals.urgentes !== 1 ? "s" : ""} urgente{totals.urgentes !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Valor em Cobrança</CardTitle>
              <DollarSign className="h-5 w-5 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-value">
                {formatCurrency(totals.total)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {totals.totalParcelas} parcela{totals.totalParcelas !== 1 ? "s" : ""} em atraso
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Clientes</CardTitle>
              <Users className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-client-count">
                {totals.count}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Ticket médio: {formatCurrency(totals.count > 0 ? totals.total / totals.count : 0)}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Casos Urgentes</CardTitle>
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600" data-testid="text-urgent-cases">
                {totals.urgentes}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Mais de 90 dias de atraso
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Andamento</CardTitle>
              <FileText className="h-5 w-5 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-600" data-testid="text-with-treatment">
                  {totals.comContextoJuridico}
                </span>
                <span className="text-sm text-muted-foreground">/ {totals.count}</span>
              </div>
              <Progress value={progressPercent} className="h-2 mt-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {Math.round(progressPercent)}% com procedimento definido
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 mb-6">
              <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, empresa ou CNPJ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]" data-testid="filter-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="sem_status">Sem status</SelectItem>
                    {STATUS_JURIDICO.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={procedimentoFilter} onValueChange={setProcedimentoFilter}>
                  <SelectTrigger className="w-[200px]" data-testid="filter-procedimento">
                    <SelectValue placeholder="Procedimento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os procedimentos</SelectItem>
                    <SelectItem value="sem_procedimento">Sem procedimento</SelectItem>
                    {PROCEDIMENTOS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {filteredClientes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Scale className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg font-medium">Nenhum cliente encontrado</p>
                <p className="text-sm">Tente ajustar os filtros de busca</p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12"></TableHead>
                      <TableHead className="font-semibold">Cliente</TableHead>
                      <TableHead className="text-right font-semibold">Valor Devido</TableHead>
                      <TableHead className="text-center font-semibold">Atraso</TableHead>
                      <TableHead className="font-semibold">Procedimento</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClientes.map((item, index) => {
                      const isExpanded = expandedRows.has(item.cliente.idCliente);
                      return (
                        <>
                          <TableRow 
                            key={item.cliente.idCliente}
                            className={`cursor-pointer transition-colors ${isExpanded ? 'bg-muted/30' : 'hover:bg-muted/20'}`}
                            onClick={() => toggleRow(item.cliente.idCliente)}
                            data-testid={`row-client-${index}`}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getUrgencyIndicator(item.cliente.diasAtrasoMax)}
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="h-7 w-7"
                                  data-testid={`button-expand-${index}`}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-semibold" data-testid={`text-client-name-${index}`}>
                                  {item.cliente.nomeCliente}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {item.cliente.empresa}
                                  {item.cliente.cnpj && ` - ${item.cliente.cnpj}`}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end">
                                <span className="font-bold text-destructive" data-testid={`text-value-${index}`}>
                                  {formatCurrency(item.cliente.valorTotal)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {item.cliente.quantidadeParcelas} parcela{item.cliente.quantidadeParcelas !== 1 ? "s" : ""}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge 
                                variant={item.cliente.diasAtrasoMax > 90 ? "destructive" : item.cliente.diasAtrasoMax > 60 ? "secondary" : "outline"}
                                className="font-mono"
                              >
                                {item.cliente.diasAtrasoMax}d
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {getProcedimentoBadge(item.contexto?.procedimentoJuridico)}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(item.contexto?.statusJuridico)}
                            </TableCell>
                            <TableCell>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditModal(item);
                                    }}
                                    data-testid={`button-edit-${index}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Editar contexto jurídico</TooltipContent>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow className="bg-muted/20 hover:bg-muted/20">
                              <TableCell colSpan={7} className="p-0">
                                <div className="p-6 space-y-6">
                                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <Card className="bg-background">
                                      <CardHeader className="pb-3">
                                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                          <Building2 className="h-4 w-4 text-muted-foreground" />
                                          Informações do Cliente
                                        </CardTitle>
                                      </CardHeader>
                                      <CardContent className="space-y-2 text-sm">
                                        {item.cliente.telefone && (
                                          <div className="flex items-center gap-2">
                                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span>{item.cliente.telefone}</span>
                                          </div>
                                        )}
                                        {item.cliente.responsavel && (
                                          <div className="flex items-center gap-2">
                                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span>Responsável: {item.cliente.responsavel}</span>
                                          </div>
                                        )}
                                        {item.cliente.servicos && (
                                          <div className="text-muted-foreground">
                                            Serviços: {item.cliente.servicos}
                                          </div>
                                        )}
                                        {item.cliente.cluster && (
                                          <Badge variant="outline" className="mt-2">{item.cliente.cluster}</Badge>
                                        )}
                                      </CardContent>
                                    </Card>

                                    <Card className="bg-background border-amber-500/30">
                                      <CardHeader className="pb-3">
                                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                                          Contexto CS
                                        </CardTitle>
                                      </CardHeader>
                                      <CardContent className="text-sm">
                                        {item.contexto?.contexto ? (
                                          <p className="text-muted-foreground leading-relaxed">{item.contexto.contexto}</p>
                                        ) : (
                                          <p className="text-muted-foreground italic">Sem contexto registrado pelo CS</p>
                                        )}
                                      </CardContent>
                                    </Card>

                                    <Card className="bg-background border-primary/30">
                                      <CardHeader className="pb-3">
                                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                          <Scale className="h-4 w-4 text-primary" />
                                          Contexto Jurídico
                                        </CardTitle>
                                      </CardHeader>
                                      <CardContent className="text-sm">
                                        {item.contexto?.contextoJuridico ? (
                                          <>
                                            <p className="text-muted-foreground leading-relaxed">{item.contexto.contextoJuridico}</p>
                                            {item.contexto.atualizadoJuridicoPor && (
                                              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
                                                Atualizado por <span className="font-medium">{item.contexto.atualizadoJuridicoPor}</span> em {formatDate(item.contexto.atualizadoJuridicoEm)}
                                              </p>
                                            )}
                                          </>
                                        ) : (
                                          <div className="flex flex-col items-center justify-center py-4 text-center">
                                            <FileText className="h-8 w-8 text-muted-foreground/30 mb-2" />
                                            <p className="text-muted-foreground italic text-xs">
                                              Nenhum contexto jurídico registrado
                                            </p>
                                            <Button 
                                              variant="ghost" 
                                              size="sm" 
                                              className="mt-2 text-primary"
                                              onClick={() => openEditModal(item)}
                                            >
                                              Adicionar contexto
                                            </Button>
                                          </div>
                                        )}
                                      </CardContent>
                                    </Card>
                                  </div>

                                  <Card className="bg-background">
                                    <CardHeader className="pb-3">
                                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                        <Receipt className="h-4 w-4 text-muted-foreground" />
                                        Parcelas em Atraso
                                        <Badge variant="outline" className="ml-2">{item.parcelas.length}</Badge>
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="max-h-[200px] overflow-auto rounded-md border">
                                        <Table>
                                          <TableHeader>
                                            <TableRow className="bg-muted/30">
                                              <TableHead className="text-xs">Descrição</TableHead>
                                              <TableHead className="text-xs">Vencimento</TableHead>
                                              <TableHead className="text-xs text-center">Dias Atraso</TableHead>
                                              <TableHead className="text-xs text-right">Valor</TableHead>
                                              <TableHead className="w-10"></TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {item.parcelas.map((parcela, pIndex) => (
                                              <TableRow key={parcela.id} data-testid={`row-parcela-${index}-${pIndex}`}>
                                                <TableCell className="font-medium max-w-[200px] truncate text-sm">
                                                  {parcela.descricao}
                                                </TableCell>
                                                <TableCell className="text-sm">{formatDate(parcela.dataVencimento)}</TableCell>
                                                <TableCell className="text-center">
                                                  <Badge
                                                    variant={
                                                      parcela.diasAtraso > 90
                                                        ? "destructive"
                                                        : parcela.diasAtraso > 30
                                                        ? "secondary"
                                                        : "outline"
                                                    }
                                                    className="font-mono text-xs"
                                                  >
                                                    {parcela.diasAtraso}d
                                                  </Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-medium text-destructive text-sm">
                                                  {formatCurrency(parcela.naoPago)}
                                                </TableCell>
                                                <TableCell>
                                                  {parcela.urlCobranca && (
                                                    <Tooltip>
                                                      <TooltipTrigger asChild>
                                                        <a
                                                          href={parcela.urlCobranca}
                                                          target="_blank"
                                                          rel="noopener noreferrer"
                                                          className="text-primary hover:text-primary/80"
                                                          onClick={(e) => e.stopPropagation()}
                                                        >
                                                          <ExternalLink className="h-4 w-4" />
                                                        </a>
                                                      </TooltipTrigger>
                                                      <TooltipContent>Abrir cobrança</TooltipContent>
                                                    </Tooltip>
                                                  )}
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </CardContent>
                                  </Card>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!editingCliente} onOpenChange={() => setEditingCliente(null)}>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Scale className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle>Contexto Jurídico</DialogTitle>
                  <DialogDescription className="mt-1">
                    {editingCliente?.cliente.nomeCliente}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-5 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Procedimento</label>
                  <Select
                    value={editForm.procedimentoJuridico}
                    onValueChange={(value) => setEditForm({ ...editForm, procedimentoJuridico: value })}
                  >
                    <SelectTrigger data-testid="select-procedimento">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PROCEDIMENTOS.map((proc) => {
                        const IconComponent = proc.icon;
                        return (
                          <SelectItem key={proc.value} value={proc.value}>
                            <div className="flex items-center gap-2">
                              <IconComponent className={`h-4 w-4 ${proc.color}`} />
                              {proc.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={editForm.statusJuridico}
                    onValueChange={(value) => setEditForm({ ...editForm, statusJuridico: value })}
                  >
                    <SelectTrigger data-testid="select-status">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_JURIDICO.map((status) => {
                        const IconComponent = status.icon;
                        return (
                          <SelectItem key={status.value} value={status.value}>
                            <div className="flex items-center gap-2">
                              <IconComponent className="h-4 w-4" />
                              {status.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Observações / Contexto</label>
                <Textarea
                  placeholder="Descreva as ações tomadas, acordos realizados, protocolo de processos, datas importantes..."
                  value={editForm.contextoJuridico}
                  onChange={(e) => setEditForm({ ...editForm, contextoJuridico: e.target.value })}
                  className="min-h-[140px] resize-none"
                  data-testid="textarea-contexto"
                />
              </div>

              {editingCliente?.contexto?.atualizadoJuridicoPor && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  <Clock className="h-3.5 w-3.5" />
                  Última atualização por <span className="font-medium">{editingCliente.contexto.atualizadoJuridicoPor}</span> em{" "}
                  {formatDate(editingCliente.contexto.atualizadoJuridicoEm)}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setEditingCliente(null)}
                data-testid="button-cancel"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                data-testid="button-save"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
