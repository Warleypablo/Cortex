import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Scale,
  Gavel,
  Users,
  DollarSign,
  Clock,
  Search,
  AlertTriangle,
  FileText,
  Phone,
  Mail,
  Building2,
  User,
  Receipt,
  ExternalLink,
  Edit,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Hourglass,
  Handshake,
  Ban,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
}

interface Juridico {
  id: number;
  procedimento: string | null;
  statusJuridico: string | null;
  observacoes: string | null;
  valorAcordado: number | null;
  dataAcordo: string | null;
  numeroParcelas: number | null;
  protocoloProcesso: string | null;
  advogadoResponsavel: string | null;
  dataCriacao: string | null;
  dataAtualizacao: string | null;
  atualizadoPor: string | null;
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
  juridico: Juridico | null;
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

const procedimentoLabels: Record<string, { label: string; icon: any; color: string }> = {
  notificacao: { label: "Notificação", icon: FileText, color: "bg-blue-500" },
  protesto: { label: "Protesto", icon: AlertTriangle, color: "bg-orange-500" },
  acao_judicial: { label: "Ação Judicial", icon: Gavel, color: "bg-red-500" },
  acordo: { label: "Acordo", icon: Handshake, color: "bg-green-500" },
  baixa: { label: "Baixa", icon: Ban, color: "bg-gray-500" },
};

const statusJuridicoLabels: Record<string, { label: string; icon: any; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  aguardando_documentos: { label: "Aguardando Documentos", icon: Hourglass, variant: "secondary" },
  em_andamento: { label: "Em Andamento", icon: Loader2, variant: "default" },
  finalizado: { label: "Finalizado", icon: CheckCircle2, variant: "outline" },
  suspenso: { label: "Suspenso", icon: XCircle, variant: "destructive" },
};

export default function JuridicoClientes() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [procedimentoFilter, setProcedimentoFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [selectedCliente, setSelectedCliente] = useState<ClienteJuridico | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  
  const [editForm, setEditForm] = useState({
    procedimento: "",
    statusJuridico: "",
    observacoes: "",
    valorAcordado: "",
    dataAcordo: "",
    numeroParcelas: "",
    protocoloProcesso: "",
    advogadoResponsavel: "",
  });

  const { data, isLoading } = useQuery<{ clientes: ClienteJuridico[] }>({
    queryKey: ["/api/juridico/clientes"],
  });

  const updateMutation = useMutation({
    mutationFn: async (params: { clienteId: string; data: any }) => {
      return await apiRequest("PUT", `/api/juridico/cliente/${params.clienteId}`, params.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/juridico/clientes"] });
      setEditDialogOpen(false);
      toast({
        title: "Sucesso",
        description: "Status jurídico atualizado com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar status jurídico.",
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

      const matchesProcedimento =
        procedimentoFilter === "todos" ||
        (procedimentoFilter === "sem_procedimento" && !item.juridico?.procedimento) ||
        item.juridico?.procedimento === procedimentoFilter;

      const matchesStatus =
        statusFilter === "todos" ||
        (statusFilter === "sem_status" && !item.juridico?.statusJuridico) ||
        item.juridico?.statusJuridico === statusFilter;

      return matchesSearch && matchesProcedimento && matchesStatus;
    });
  }, [clientes, searchTerm, procedimentoFilter, statusFilter]);

  const totals = useMemo(() => {
    const total = filteredClientes.reduce((acc, item) => acc + item.cliente.valorTotal, 0);
    const totalParcelas = filteredClientes.reduce((acc, item) => acc + item.cliente.quantidadeParcelas, 0);
    return { total, totalParcelas, count: filteredClientes.length };
  }, [filteredClientes]);

  const openEditDialog = (item: ClienteJuridico) => {
    setSelectedCliente(item);
    setEditForm({
      procedimento: item.juridico?.procedimento || "",
      statusJuridico: item.juridico?.statusJuridico || "",
      observacoes: item.juridico?.observacoes || "",
      valorAcordado: item.juridico?.valorAcordado?.toString() || "",
      dataAcordo: item.juridico?.dataAcordo || "",
      numeroParcelas: item.juridico?.numeroParcelas?.toString() || "",
      protocoloProcesso: item.juridico?.protocoloProcesso || "",
      advogadoResponsavel: item.juridico?.advogadoResponsavel || "",
    });
    setEditDialogOpen(true);
  };

  const handleSave = () => {
    if (!selectedCliente) return;
    updateMutation.mutate({
      clienteId: selectedCliente.cliente.idCliente,
      data: {
        procedimento: editForm.procedimento || null,
        statusJuridico: editForm.statusJuridico || null,
        observacoes: editForm.observacoes || null,
        valorAcordado: editForm.valorAcordado ? parseFloat(editForm.valorAcordado) : null,
        dataAcordo: editForm.dataAcordo || null,
        numeroParcelas: editForm.numeroParcelas ? parseInt(editForm.numeroParcelas) : null,
        protocoloProcesso: editForm.protocoloProcesso || null,
        advogadoResponsavel: editForm.advogadoResponsavel || null,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <p className="text-muted-foreground">
                Clientes com ação "Cobrar" para tratamento jurídico
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="text-sm" data-testid="badge-total-clientes">
            {totals.count} clientes
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Valor Total Inadimplente</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive" data-testid="text-total-valor">
                {formatCurrency(totals.total)}
              </div>
              <p className="text-xs text-muted-foreground">
                {totals.totalParcelas} parcelas em atraso
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Clientes em Cobrança</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-clientes">
                {totals.count}
              </div>
              <p className="text-xs text-muted-foreground">
                Com ação "Cobrar" definida
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-ticket-medio">
                {formatCurrency(totals.count > 0 ? totals.total / totals.count : 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Por cliente inadimplente
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar por nome, empresa ou CNPJ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>

              <Select value={procedimentoFilter} onValueChange={setProcedimentoFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-procedimento">
                  <SelectValue placeholder="Procedimento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Procedimentos</SelectItem>
                  <SelectItem value="sem_procedimento">Sem Procedimento</SelectItem>
                  <SelectItem value="notificacao">Notificação</SelectItem>
                  <SelectItem value="protesto">Protesto</SelectItem>
                  <SelectItem value="acao_judicial">Ação Judicial</SelectItem>
                  <SelectItem value="acordo">Acordo</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]" data-testid="select-status">
                  <SelectValue placeholder="Status Jurídico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Status</SelectItem>
                  <SelectItem value="sem_status">Sem Status</SelectItem>
                  <SelectItem value="aguardando_documentos">Aguardando Documentos</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="finalizado">Finalizado</SelectItem>
                  <SelectItem value="suspenso">Suspenso</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Accordion type="multiple" className="w-full">
              {filteredClientes.map((item, index) => (
                <AccordionItem
                  key={item.cliente.idCliente}
                  value={item.cliente.idCliente}
                  className="border-b"
                >
                  <AccordionTrigger className="px-4 py-3 hover:bg-muted/50" data-testid={`accordion-cliente-${index}`}>
                    <div className="flex items-center justify-between w-full mr-4">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-start">
                          <span className="font-medium text-left">{item.cliente.nomeCliente}</span>
                          <span className="text-xs text-muted-foreground">{item.cliente.empresa}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {item.juridico?.procedimento && procedimentoLabels[item.juridico.procedimento] && (
                          <Badge className={`${procedimentoLabels[item.juridico.procedimento].color} text-white`}>
                            {procedimentoLabels[item.juridico.procedimento].label}
                          </Badge>
                        )}
                        {item.juridico?.statusJuridico && statusJuridicoLabels[item.juridico.statusJuridico] && (
                          <Badge variant={statusJuridicoLabels[item.juridico.statusJuridico].variant}>
                            {statusJuridicoLabels[item.juridico.statusJuridico].label}
                          </Badge>
                        )}
                        <div className="text-right">
                          <div className="font-bold text-destructive">{formatCurrency(item.cliente.valorTotal)}</div>
                          <div className="text-xs text-muted-foreground">{item.cliente.diasAtrasoMax} dias de atraso</div>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Dados do Cliente
                          </h4>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(item)}
                            data-testid={`button-edit-${index}`}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Editar Status
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <Label className="text-xs text-muted-foreground">CNPJ</Label>
                            <p className="font-medium">{item.cliente.cnpj || "-"}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Telefone</Label>
                            <p className="font-medium flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {item.cliente.telefone || "-"}
                            </p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Responsável</Label>
                            <p className="font-medium">{item.cliente.responsavel || "-"}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Status ClickUp</Label>
                            <p className="font-medium">{item.cliente.statusClickup || "-"}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Cluster</Label>
                            <p className="font-medium">{item.cliente.cluster || "-"}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Serviços</Label>
                            <p className="font-medium text-xs">{item.cliente.servicos || "-"}</p>
                          </div>
                        </div>

                        {item.contexto && (
                          <div className="mt-4 p-3 bg-muted rounded-lg">
                            <h5 className="font-medium text-sm mb-2 flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              Contexto CS
                            </h5>
                            {item.contexto.contexto && (
                              <p className="text-sm mb-1">{item.contexto.contexto}</p>
                            )}
                            {item.contexto.evidencias && (
                              <p className="text-sm text-muted-foreground">
                                <strong>Evidências:</strong> {item.contexto.evidencias}
                              </p>
                            )}
                            {item.contexto.statusFinanceiro && (
                              <Badge variant="outline" className="mt-2">
                                {item.contexto.statusFinanceiro === 'cobrado' ? 'Cobrado' :
                                 item.contexto.statusFinanceiro === 'acordo_realizado' ? 'Acordo Realizado' :
                                 item.contexto.statusFinanceiro === 'juridico' ? 'Jurídico' : item.contexto.statusFinanceiro}
                              </Badge>
                            )}
                          </div>
                        )}

                        {item.juridico && (
                          <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
                            <h5 className="font-medium text-sm mb-2 flex items-center gap-2">
                              <Gavel className="w-4 h-4" />
                              Status Jurídico
                            </h5>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              {item.juridico.protocoloProcesso && (
                                <div>
                                  <Label className="text-xs text-muted-foreground">Protocolo</Label>
                                  <p className="font-medium">{item.juridico.protocoloProcesso}</p>
                                </div>
                              )}
                              {item.juridico.advogadoResponsavel && (
                                <div>
                                  <Label className="text-xs text-muted-foreground">Advogado</Label>
                                  <p className="font-medium">{item.juridico.advogadoResponsavel}</p>
                                </div>
                              )}
                              {item.juridico.valorAcordado && (
                                <div>
                                  <Label className="text-xs text-muted-foreground">Valor Acordado</Label>
                                  <p className="font-medium text-green-600">{formatCurrency(item.juridico.valorAcordado)}</p>
                                </div>
                              )}
                              {item.juridico.numeroParcelas && (
                                <div>
                                  <Label className="text-xs text-muted-foreground">Parcelas</Label>
                                  <p className="font-medium">{item.juridico.numeroParcelas}x</p>
                                </div>
                              )}
                            </div>
                            {item.juridico.observacoes && (
                              <div className="mt-2">
                                <Label className="text-xs text-muted-foreground">Observações</Label>
                                <p className="text-sm">{item.juridico.observacoes}</p>
                              </div>
                            )}
                            {item.juridico.atualizadoPor && (
                              <p className="text-xs text-muted-foreground mt-2">
                                Atualizado por {item.juridico.atualizadoPor} em {formatDate(item.juridico.dataAtualizacao)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="font-semibold flex items-center gap-2 mb-3">
                          <Receipt className="w-4 h-4" />
                          Parcelas em Atraso ({item.parcelas.length})
                        </h4>
                        <div className="max-h-[300px] overflow-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Descrição</TableHead>
                                <TableHead className="text-right">Valor</TableHead>
                                <TableHead>Vencimento</TableHead>
                                <TableHead>Atraso</TableHead>
                                <TableHead></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {item.parcelas.map((parcela) => (
                                <TableRow key={parcela.id}>
                                  <TableCell className="text-xs max-w-[150px] truncate" title={parcela.descricao}>
                                    {parcela.descricao}
                                  </TableCell>
                                  <TableCell className="text-right font-medium text-destructive">
                                    {formatCurrency(parcela.naoPago)}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {formatDate(parcela.dataVencimento)}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="destructive" className="text-xs">
                                      {parcela.diasAtraso} dias
                                    </Badge>
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
                                          >
                                            <ExternalLink className="w-4 h-4" />
                                          </a>
                                        </TooltipTrigger>
                                        <TooltipContent>Acessar cobrança</TooltipContent>
                                      </Tooltip>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {filteredClientes.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum cliente encontrado com os filtros aplicados</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Gavel className="w-5 h-5" />
                Editar Status Jurídico
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="procedimento">Procedimento</Label>
                  <Select
                    value={editForm.procedimento}
                    onValueChange={(v) => setEditForm({ ...editForm, procedimento: v })}
                  >
                    <SelectTrigger id="procedimento" data-testid="select-edit-procedimento">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="notificacao">Notificação</SelectItem>
                      <SelectItem value="protesto">Protesto</SelectItem>
                      <SelectItem value="acao_judicial">Ação Judicial</SelectItem>
                      <SelectItem value="acordo">Acordo</SelectItem>
                      <SelectItem value="baixa">Baixa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="statusJuridico">Status</Label>
                  <Select
                    value={editForm.statusJuridico}
                    onValueChange={(v) => setEditForm({ ...editForm, statusJuridico: v })}
                  >
                    <SelectTrigger id="statusJuridico" data-testid="select-edit-status">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aguardando_documentos">Aguardando Documentos</SelectItem>
                      <SelectItem value="em_andamento">Em Andamento</SelectItem>
                      <SelectItem value="finalizado">Finalizado</SelectItem>
                      <SelectItem value="suspenso">Suspenso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="advogado">Advogado Responsável</Label>
                <Input
                  id="advogado"
                  value={editForm.advogadoResponsavel}
                  onChange={(e) => setEditForm({ ...editForm, advogadoResponsavel: e.target.value })}
                  placeholder="Nome do advogado..."
                  data-testid="input-advogado"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="protocolo">Protocolo/Processo</Label>
                <Input
                  id="protocolo"
                  value={editForm.protocoloProcesso}
                  onChange={(e) => setEditForm({ ...editForm, protocoloProcesso: e.target.value })}
                  placeholder="Número do protocolo ou processo..."
                  data-testid="input-protocolo"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="valorAcordado">Valor Acordado</Label>
                  <Input
                    id="valorAcordado"
                    type="number"
                    value={editForm.valorAcordado}
                    onChange={(e) => setEditForm({ ...editForm, valorAcordado: e.target.value })}
                    placeholder="0.00"
                    data-testid="input-valor-acordado"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numeroParcelas">Parcelas</Label>
                  <Input
                    id="numeroParcelas"
                    type="number"
                    value={editForm.numeroParcelas}
                    onChange={(e) => setEditForm({ ...editForm, numeroParcelas: e.target.value })}
                    placeholder="1"
                    data-testid="input-parcelas"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dataAcordo">Data Acordo</Label>
                  <Input
                    id="dataAcordo"
                    type="date"
                    value={editForm.dataAcordo}
                    onChange={(e) => setEditForm({ ...editForm, dataAcordo: e.target.value })}
                    data-testid="input-data-acordo"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={editForm.observacoes}
                  onChange={(e) => setEditForm({ ...editForm, observacoes: e.target.value })}
                  placeholder="Observações sobre o caso..."
                  rows={3}
                  data-testid="textarea-observacoes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save">
                {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
