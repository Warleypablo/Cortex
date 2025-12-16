import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  { value: "notificacao", label: "Notificação Extrajudicial" },
  { value: "protesto", label: "Protesto" },
  { value: "acao_judicial", label: "Ação Judicial" },
  { value: "acordo", label: "Acordo" },
  { value: "baixa", label: "Baixa" },
];

const STATUS_JURIDICO = [
  { value: "pendente", label: "Pendente", color: "bg-yellow-500" },
  { value: "em_andamento", label: "Em Andamento", color: "bg-blue-500" },
  { value: "concluido", label: "Concluído", color: "bg-green-500" },
  { value: "cancelado", label: "Cancelado", color: "bg-gray-500" },
];

export default function JuridicoClientes() {
  const [searchTerm, setSearchTerm] = useState("");
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

      return matchesSearch;
    });
  }, [clientes, searchTerm]);

  const totals = useMemo(() => {
    const total = filteredClientes.reduce((acc, item) => acc + item.cliente.valorTotal, 0);
    const totalParcelas = filteredClientes.reduce((acc, item) => acc + item.cliente.quantidadeParcelas, 0);
    const comContextoJuridico = filteredClientes.filter(c => c.contexto?.contextoJuridico).length;
    return { total, totalParcelas, count: filteredClientes.length, comContextoJuridico };
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
    if (!status) return null;
    const statusConfig = STATUS_JURIDICO.find(s => s.value === status);
    if (!statusConfig) return <Badge variant="outline">{status}</Badge>;
    return (
      <Badge className={`${statusConfig.color} text-white`}>
        {statusConfig.label}
      </Badge>
    );
  };

  const getProcedimentoLabel = (value: string | null) => {
    if (!value) return "-";
    const proc = PROCEDIMENTOS.find(p => p.value === value);
    return proc?.label || value;
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

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Scale className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">
                Jurídico - Clientes Inadimplentes
              </h1>
              <p className="text-muted-foreground text-sm">
                Clientes com ação "Cobrar" para tratamento jurídico
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive" data-testid="text-total-value">
                {formatCurrency(totals.total)}
              </div>
              <p className="text-xs text-muted-foreground">{totals.totalParcelas} parcelas em atraso</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-client-count">
                {totals.count}
              </div>
              <p className="text-xs text-muted-foreground">Com ação "Cobrar"</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-average-ticket">
                {formatCurrency(totals.count > 0 ? totals.total / totals.count : 0)}
              </div>
              <p className="text-xs text-muted-foreground">Por cliente</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Com Tratamento</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-with-treatment">
                {totals.comContextoJuridico}
              </div>
              <p className="text-xs text-muted-foreground">
                {totals.count > 0 ? Math.round((totals.comContextoJuridico / totals.count) * 100) : 0}% documentados
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 mb-6 flex-wrap">
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
            </div>

            {filteredClientes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-4" />
                <p className="text-lg">Nenhum cliente encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Valor Devido</TableHead>
                      <TableHead className="text-center">Atraso Máx.</TableHead>
                      <TableHead className="text-center">Parcelas</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Procedimento</TableHead>
                      <TableHead>Status Jurídico</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClientes.map((item, index) => (
                      <Collapsible key={item.cliente.idCliente} asChild>
                        <>
                          <TableRow 
                            className="cursor-pointer hover-elevate"
                            data-testid={`row-client-${index}`}
                          >
                            <TableCell>
                              <CollapsibleTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => toggleRow(item.cliente.idCliente)}
                                  data-testid={`button-expand-${index}`}
                                >
                                  {expandedRows.has(item.cliente.idCliente) ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-semibold" data-testid={`text-client-name-${index}`}>
                                  {item.cliente.nomeCliente}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {item.cliente.empresa}
                                  {item.cliente.cnpj && ` • ${item.cliente.cnpj}`}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="font-bold text-destructive" data-testid={`text-value-${index}`}>
                                {formatCurrency(item.cliente.valorTotal)}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge 
                                variant={item.cliente.diasAtrasoMax > 90 ? "destructive" : item.cliente.diasAtrasoMax > 30 ? "secondary" : "outline"}
                              >
                                <Clock className="h-3 w-3 mr-1" />
                                {item.cliente.diasAtrasoMax}d
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">{item.cliente.quantidadeParcelas}</Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{item.cliente.responsavel || "-"}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{getProcedimentoLabel(item.contexto?.procedimentoJuridico)}</span>
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
                          <CollapsibleContent asChild>
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={9} className="p-0">
                                <div className="p-4 space-y-4">
                                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                    <div className="space-y-3">
                                      <h4 className="font-semibold flex items-center gap-2 text-sm">
                                        <Building2 className="h-4 w-4" />
                                        Informações do Cliente
                                      </h4>
                                      <div className="text-sm space-y-1">
                                        {item.cliente.telefone && (
                                          <div className="flex items-center gap-2">
                                            <Phone className="h-3 w-3 text-muted-foreground" />
                                            <span>{item.cliente.telefone}</span>
                                          </div>
                                        )}
                                        {item.cliente.servicos && (
                                          <div className="text-muted-foreground">
                                            Serviços: {item.cliente.servicos}
                                          </div>
                                        )}
                                        {item.cliente.cluster && (
                                          <Badge variant="outline" className="mt-1">{item.cliente.cluster}</Badge>
                                        )}
                                      </div>
                                    </div>

                                    <div className="space-y-3">
                                      <h4 className="font-semibold flex items-center gap-2 text-sm">
                                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                        Contexto CS
                                      </h4>
                                      <div className="text-sm">
                                        {item.contexto?.contexto ? (
                                          <p className="text-muted-foreground">{item.contexto.contexto}</p>
                                        ) : (
                                          <p className="text-muted-foreground italic">Sem contexto registrado</p>
                                        )}
                                      </div>
                                    </div>

                                    <div className="space-y-3">
                                      <h4 className="font-semibold flex items-center gap-2 text-sm">
                                        <Scale className="h-4 w-4 text-primary" />
                                        Contexto Jurídico
                                      </h4>
                                      <div className="text-sm">
                                        {item.contexto?.contextoJuridico ? (
                                          <>
                                            <p className="text-muted-foreground">{item.contexto.contextoJuridico}</p>
                                            {item.contexto.atualizadoJuridicoPor && (
                                              <p className="text-xs text-muted-foreground mt-2">
                                                Atualizado por {item.contexto.atualizadoJuridicoPor} em {formatDate(item.contexto.atualizadoJuridicoEm)}
                                              </p>
                                            )}
                                          </>
                                        ) : (
                                          <p className="text-muted-foreground italic">
                                            Nenhum contexto jurídico adicionado
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="border-t pt-4">
                                    <h4 className="font-semibold flex items-center gap-2 text-sm mb-3">
                                      <Receipt className="h-4 w-4" />
                                      Parcelas em Atraso ({item.parcelas.length})
                                    </h4>
                                    <div className="max-h-[200px] overflow-auto">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Descrição</TableHead>
                                            <TableHead>Vencimento</TableHead>
                                            <TableHead>Dias Atraso</TableHead>
                                            <TableHead className="text-right">Valor</TableHead>
                                            <TableHead></TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {item.parcelas.map((parcela, pIndex) => (
                                            <TableRow key={parcela.id} data-testid={`row-parcela-${index}-${pIndex}`}>
                                              <TableCell className="font-medium max-w-[200px] truncate">
                                                {parcela.descricao}
                                              </TableCell>
                                              <TableCell>{formatDate(parcela.dataVencimento)}</TableCell>
                                              <TableCell>
                                                <Badge
                                                  variant={
                                                    parcela.diasAtraso > 90
                                                      ? "destructive"
                                                      : parcela.diasAtraso > 30
                                                      ? "secondary"
                                                      : "outline"
                                                  }
                                                >
                                                  {parcela.diasAtraso}d
                                                </Badge>
                                              </TableCell>
                                              <TableCell className="text-right font-medium text-destructive">
                                                {formatCurrency(parcela.naoPago)}
                                              </TableCell>
                                              <TableCell>
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
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!editingCliente} onOpenChange={() => setEditingCliente(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Contexto Jurídico
              </DialogTitle>
              <DialogDescription>
                {editingCliente?.cliente.nomeCliente} - {editingCliente?.cliente.empresa}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Procedimento</label>
                <Select
                  value={editForm.procedimentoJuridico}
                  onValueChange={(value) => setEditForm({ ...editForm, procedimentoJuridico: value })}
                >
                  <SelectTrigger data-testid="select-procedimento">
                    <SelectValue placeholder="Selecione o procedimento" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROCEDIMENTOS.map((proc) => (
                      <SelectItem key={proc.value} value={proc.value}>
                        {proc.label}
                      </SelectItem>
                    ))}
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
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_JURIDICO.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Observações / Contexto</label>
                <Textarea
                  placeholder="Descreva as ações tomadas, acordos realizados, protocolo de processos..."
                  value={editForm.contextoJuridico}
                  onChange={(e) => setEditForm({ ...editForm, contextoJuridico: e.target.value })}
                  className="min-h-[120px]"
                  data-testid="textarea-contexto"
                />
              </div>

              {editingCliente?.contexto?.atualizadoJuridicoPor && (
                <p className="text-xs text-muted-foreground">
                  Última atualização por {editingCliente.contexto.atualizadoJuridicoPor} em{" "}
                  {formatDate(editingCliente.contexto.atualizadoJuridicoEm)}
                </p>
              )}
            </div>

            <DialogFooter>
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
                    Salvar
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
