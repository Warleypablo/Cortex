import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { usePageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { ArrowLeft, Package, User, DollarSign, Info, Briefcase, Check, ChevronsUpDown, UserPlus, X, Edit, Trash2, History, Lock, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface Colaborador {
  id: number;
  status: string | null;
  nome: string;
  cpf: string | null;
  endereco: string | null;
  estado: string | null;
  telefone: string | null;
  aniversario: string | null;
  admissao: string | null;
  demissao: string | null;
  tipoDemissao: string | null;
  motivoDemissao: string | null;
  proporcional: string | null;
  proporcionalCaju: string | null;
  setor: string | null;
  squad: string | null;
  cargo: string | null;
  nivel: string | null;
  pix: string | null;
  cnpj: string | null;
  emailTurbo: string | null;
  emailPessoal: string | null;
  mesesDeTurbo: number | null;
  ultimoAumento: string | null;
  mesesUltAumento: number | null;
}

interface PatrimonioComResponsavel {
  id: number;
  numeroAtivo: string | null;
  ativo: string | null;
  marca: string | null;
  estadoConservacao: string | null;
  responsavelAtual: string | null;
  valorPago: string | null;
  valorMercado: string | null;
  valorVenda: string | null;
  descricao: string | null;
  senhaAtivo: string | null;
  empresa: string | null;
  colaborador?: Colaborador;
}

interface ColaboradorDropdown {
  id: number;
  nome: string;
  status?: string | null;
}

interface HistoricoItem {
  id: number;
  data: string;
  acao: string;
  usuario: string;
}

const editPatrimonioSchema = z.object({
  numeroAtivo: z.string().optional(),
  ativo: z.string().optional(),
  marca: z.string().optional(),
  estadoConservacao: z.string().optional(),
  descricao: z.string().optional(),
  valorPago: z.string().optional(),
  valorMercado: z.string().optional(),
  senhaAtivo: z.string().optional(),
  empresa: z.string().optional(),
});

type EditPatrimonioForm = z.infer<typeof editPatrimonioSchema>;

export default function PatrimonioDetail() {
  usePageTitle("Detalhes do Patrimônio");
  const { setPageInfo } = usePageInfo();
  const params = useParams();
  const [, setLocation] = useLocation();
  const patrimonioId = params.id;
  const qc = useQueryClient();
  const { toast } = useToast();
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: patrimonio, isLoading, error } = useQuery<PatrimonioComResponsavel>({
    queryKey: ["/api/patrimonio", patrimonioId],
    queryFn: async () => {
      const res = await fetch(`/api/patrimonio/${patrimonioId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch patrimonio');
      }
      return res.json();
    },
    enabled: !!patrimonioId,
  });

  const { data: colaboradoresDropdown = [] } = useQuery<ColaboradorDropdown[]>({
    queryKey: ["/api/colaboradores/dropdown"],
  });

  const { data: historico = [], isLoading: historicoLoading } = useQuery<HistoricoItem[]>({
    queryKey: ["/api/patrimonio", patrimonioId, "historico"],
    queryFn: async () => {
      const res = await fetch(`/api/patrimonio/${patrimonioId}/historico`);
      if (!res.ok) {
        return [];
      }
      return res.json();
    },
    enabled: !!patrimonioId,
  });

  const form = useForm<EditPatrimonioForm>({
    resolver: zodResolver(editPatrimonioSchema),
    defaultValues: {
      numeroAtivo: "",
      ativo: "",
      marca: "",
      estadoConservacao: "",
      descricao: "",
      valorPago: "",
      valorMercado: "",
      senhaAtivo: "",
      empresa: "",
    },
  });

  useEffect(() => {
    if (patrimonio && editDialogOpen) {
      form.reset({
        numeroAtivo: patrimonio.numeroAtivo || "",
        ativo: patrimonio.ativo || "",
        marca: patrimonio.marca || "",
        estadoConservacao: patrimonio.estadoConservacao || "",
        descricao: patrimonio.descricao || "",
        valorPago: patrimonio.valorPago || "",
        valorMercado: patrimonio.valorMercado || "",
        senhaAtivo: patrimonio.senhaAtivo || "",
        empresa: patrimonio.empresa || "Turbo Partners",
      });
    }
  }, [patrimonio, editDialogOpen, form]);

  const updateResponsavelMutation = useMutation({
    mutationFn: async (responsavelNome: string | null) => {
      return apiRequest("PATCH", `/api/patrimonio/${patrimonioId}/responsavel`, {
        responsavelNome,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/patrimonio", patrimonioId] });
      qc.invalidateQueries({ queryKey: ["/api/patrimonio"] });
      qc.invalidateQueries({ queryKey: ["/api/patrimonio", patrimonioId, "historico"] });
      toast({
        title: "Responsável atualizado",
        description: "O responsável pelo patrimônio foi atualizado com sucesso.",
      });
      setComboboxOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível atualizar o responsável.",
        variant: "destructive",
      });
    },
  });

  const updatePatrimonioMutation = useMutation({
    mutationFn: async (data: EditPatrimonioForm) => {
      return apiRequest("PATCH", `/api/patrimonio/${patrimonioId}`, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/patrimonio", patrimonioId] });
      qc.invalidateQueries({ queryKey: ["/api/patrimonio"] });
      toast({
        title: "Patrimônio atualizado",
        description: "Os dados do patrimônio foram atualizados com sucesso.",
      });
      setEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível atualizar o patrimônio.",
        variant: "destructive",
      });
    },
  });

  const deletePatrimonioMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/patrimonio/${patrimonioId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/patrimonio"] });
      toast({
        title: "Patrimônio excluído",
        description: "O patrimônio foi excluído com sucesso.",
      });
      setLocation("/patrimonio");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir",
        description: error.message || "Não foi possível excluir o patrimônio.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (patrimonio) {
      const title = patrimonio.ativo ? `${patrimonio.ativo}` : "Detalhes do Patrimônio";
      const subtitle = patrimonio.numeroAtivo ? `Patrimônio #${patrimonio.numeroAtivo}` : "Gestão de ativos";
      setPageInfo(title, subtitle);
    } else {
      setPageInfo("Detalhes do Patrimônio", "Carregando...");
    }
  }, [patrimonio, setPageInfo]);

  const handleSelectResponsavel = (nome: string) => {
    if (nome === patrimonio?.responsavelAtual) {
      setComboboxOpen(false);
      return;
    }
    updateResponsavelMutation.mutate(nome);
  };

  const handleRemoveResponsavel = () => {
    updateResponsavelMutation.mutate(null);
  };

  const onSubmitEdit = (data: EditPatrimonioForm) => {
    updatePatrimonioMutation.mutate(data);
  };

  const formatCurrency = (value: string | null) => {
    if (!value) return "-";
    const num = parseFloat(value);
    if (isNaN(num)) return "-";
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('pt-BR').format(date);
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getEstadoColor = (estado: string | null) => {
    if (!estado) return "";
    const estadoLower = estado.toLowerCase();
    
    // Em Estoque = Azul
    if (estadoLower.includes("estoque")) {
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    }
    
    // Baixado/Vendido = Vermelho
    if (estadoLower.includes("baixado") || estadoLower.includes("vendido")) {
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800";
    }
    
    // Bom/Novo/Ótimo = Verde
    if (estadoLower.includes("bom") || estadoLower.includes("novo") || estadoLower.includes("ótimo")) {
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800";
    }
    
    // Regular/Médio = Amarelo
    if (estadoLower.includes("regular") || estadoLower.includes("médio") || estadoLower.includes("medio")) {
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800";
    }
    
    // Ruim/Péssimo/Quebrado = Vermelho
    if (estadoLower.includes("ruim") || estadoLower.includes("péssimo") || estadoLower.includes("pessimo") || estadoLower.includes("quebrado")) {
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800";
    }
    
    return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 border-gray-200 dark:border-gray-800";
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen" data-testid="error-patrimonio-detail">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-destructive">Erro</CardTitle>
            <CardDescription>Não foi possível carregar os detalhes do patrimônio.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen" data-testid="loading-patrimonio-detail">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!patrimonio) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Não encontrado</CardTitle>
            <CardDescription>Patrimônio não encontrado.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-6 space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setLocation("/patrimonio")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setEditDialogOpen(true)}
              data-testid="button-edit"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  data-testid="button-delete"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir patrimônio</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja excluir este patrimônio? Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deletePatrimonioMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-testid="button-confirm-delete"
                  >
                    {deletePatrimonioMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Excluir"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <span>Gestão de Ativos</span>
                <span>/</span>
                <span>Patrimônio</span>
                <span>/</span>
                <span className="text-foreground">Detalhes do patrimônio</span>
              </div>
            </div>
            <Package className="w-8 h-8 text-primary" />
          </div>

          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Informações do Bem</CardTitle>
                    <CardDescription>Dados principais e financeiros do ativo</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground">ID do Sistema</div>
                      <div className="text-base font-mono">{patrimonio.id}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground">Número de Ativo</div>
                      <div className="text-base font-mono" data-testid="numero-patrimonio">{patrimonio.numeroAtivo || "-"}</div>
                    </div>
                  </div>
                  <Separator />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground">Empresa</div>
                      <Badge
                        variant="outline"
                        className={
                          patrimonio.empresa === "TurboOH"
                            ? "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-800"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                        }
                        data-testid="empresa-patrimonio"
                      >
                        {patrimonio.empresa || "Turbo Partners"}
                      </Badge>
                    </div>
                  </div>
                  <Separator />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground">Tipo de Bem</div>
                      <div className="text-base font-medium" data-testid="tipo-bem">{patrimonio.ativo || "-"}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground">Marca</div>
                      <div className="text-base" data-testid="marca-bem">{patrimonio.marca || "-"}</div>
                    </div>
                  </div>
                  <Separator />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground">Modelo / Descrição</div>
                      <div className="text-base" data-testid="descricao-bem">
                        {patrimonio.descricao || "-"}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground">Estado de Conservação</div>
                      {patrimonio.estadoConservacao ? (
                        <Badge variant="outline" className={getEstadoColor(patrimonio.estadoConservacao)} data-testid="estado-conservacao">
                          {patrimonio.estadoConservacao}
                        </Badge>
                      ) : (
                        <div className="text-base">-</div>
                      )}
                    </div>
                  </div>
                  <Separator />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground">Valor Pago</div>
                      <div className="text-lg font-semibold text-green-600 dark:text-green-400" data-testid="valor-pago">
                        {formatCurrency(patrimonio.valorPago)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground">Valor de Mercado</div>
                      <div className="text-lg font-semibold text-blue-600 dark:text-blue-400" data-testid="valor-mercado">
                        {formatCurrency(patrimonio.valorMercado)}
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Senha do Ativo
                    </div>
                    <div className="text-base font-mono" data-testid="senha-ativo">
                      {patrimonio.senhaAtivo || "-"}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Responsável pelo Patrimônio</CardTitle>
                      <CardDescription>Colaborador atualmente responsável pelo bem</CardDescription>
                    </div>
                  </div>
                <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={comboboxOpen}
                      className="w-[280px] justify-between"
                      data-testid="button-atribuir-responsavel"
                    >
                      {patrimonio.responsavelAtual ? (
                        <span className="truncate">{patrimonio.responsavelAtual}</span>
                      ) : (
                        <span className="text-muted-foreground">Atribuir responsável...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0" align="end">
                    <Command>
                      <CommandInput placeholder="Buscar colaborador..." data-testid="input-buscar-colaborador" />
                      <CommandList>
                        <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                        <CommandGroup>
                          {colaboradoresDropdown.map((colaborador) => (
                            <CommandItem
                              key={colaborador.id}
                              value={colaborador.nome}
                              onSelect={() => handleSelectResponsavel(colaborador.nome)}
                              data-testid={`option-colaborador-${colaborador.id}`}
                              className={colaborador.status === "Dispensado" ? "text-muted-foreground" : ""}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  patrimonio.responsavelAtual === colaborador.nome
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <span className="flex-1">{colaborador.nome}</span>
                              {colaborador.status === "Dispensado" && (
                                <span className="text-xs text-muted-foreground ml-2">(Dispensado)</span>
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </CardHeader>
              <CardContent>
                {patrimonio.colaborador ? (
                  <div className="flex items-start gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarFallback className="text-lg bg-primary/10 text-primary">
                        {getInitials(patrimonio.colaborador.nome)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-semibold" data-testid="colaborador-nome">
                              {patrimonio.colaborador.nome}
                            </span>
                            <Badge 
                              variant="outline" 
                              className={patrimonio.colaborador.status === "Ativo" 
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-300" 
                                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-300"
                              }
                              data-testid="colaborador-status"
                            >
                              {patrimonio.colaborador.status || "Ativo"}
                            </Badge>
                          </div>
                          {patrimonio.colaborador.cargo && (
                            <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                              <Briefcase className="h-3 w-3" />
                              {patrimonio.colaborador.cargo}
                              {patrimonio.colaborador.setor && ` • ${patrimonio.colaborador.setor}`}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleRemoveResponsavel}
                          disabled={updateResponsavelMutation.isPending}
                          data-testid="button-remover-responsavel"
                          title="Remover responsável"
                        >
                          {updateResponsavelMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>

                      {patrimonio.colaborador.squad && (
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">
                            <BarChart3 className="h-3 w-3 mr-1" />
                            {patrimonio.colaborador.squad}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                      <UserPlus className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Nenhum responsável atribuído.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Use o botão acima para atribuir um colaborador.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <History className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Histórico de Alterações</CardTitle>
                  <CardDescription>Registro de mudanças do patrimônio</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {historicoLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : historico.length > 0 ? (
                  <div className="space-y-4">
                    {historico.map((item) => (
                      <div key={item.id} className="flex items-start gap-3 pb-3 border-b last:border-b-0 last:pb-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                          <History className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium" data-testid={`historico-acao-${item.id}`}>
                            {item.acao}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <span data-testid={`historico-data-${item.id}`}>{formatDateTime(item.data)}</span>
                            {item.usuario && (
                              <>
                                <span>•</span>
                                <span data-testid={`historico-usuario-${item.id}`}>{item.usuario}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                      <History className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Nenhum histórico disponível
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Patrimônio</DialogTitle>
            <DialogDescription>
              Atualize as informações do patrimônio abaixo.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitEdit)} className="space-y-4">
              <FormField
                control={form.control}
                name="empresa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Empresa</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "Turbo Partners"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-empresa">
                          <SelectValue placeholder="Selecione a empresa" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Turbo Partners">Turbo Partners</SelectItem>
                        <SelectItem value="TurboOH">TurboOH</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="numeroAtivo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número do Ativo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 001" {...field} data-testid="input-numero-ativo" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ativo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Bem</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-ativo">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Notebook">Notebook</SelectItem>
                          <SelectItem value="Computador">Computador</SelectItem>
                          <SelectItem value="Monitor">Monitor</SelectItem>
                          <SelectItem value="Celular">Celular</SelectItem>
                          <SelectItem value="Moveis">Móveis</SelectItem>
                          <SelectItem value="Outros">Outros</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="marca"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marca</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-marca">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Apple">Apple</SelectItem>
                          <SelectItem value="Dell">Dell</SelectItem>
                          <SelectItem value="Samsung">Samsung</SelectItem>
                          <SelectItem value="Acer">Acer</SelectItem>
                          <SelectItem value="Philips">Philips</SelectItem>
                          <SelectItem value="LG">LG</SelectItem>
                          <SelectItem value="Warrior">Warrior</SelectItem>
                          <SelectItem value="AOC">AOC</SelectItem>
                          <SelectItem value="Outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="estadoConservacao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado de Conservação</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-estado-conservacao">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Em Estoque">Em Estoque</SelectItem>
                          <SelectItem value="Bom">Bom</SelectItem>
                          <SelectItem value="Ruim/Quebrado">Ruim/Quebrado</SelectItem>
                          <SelectItem value="Baixado/Vendido">Baixado/Vendido</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="descricao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição / Modelo</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Dell Latitude 5520" {...field} data-testid="input-descricao" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="valorPago"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Pago</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 5000.00" {...field} data-testid="input-valor-pago" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="valorMercado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor de Mercado</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 4500.00" {...field} data-testid="input-valor-mercado" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="senhaAtivo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Senha do Ativo
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 123456" {...field} data-testid="input-senha-ativo" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={updatePatrimonioMutation.isPending}
                  data-testid="button-save-edit"
                >
                  {updatePatrimonioMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
