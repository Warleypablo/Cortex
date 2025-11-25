import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Package, User, DollarSign, Info, FileText, Mail, Phone, Briefcase, Calendar, Check, ChevronsUpDown, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

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
  colaborador?: Colaborador;
}

interface ColaboradorDropdown {
  id: number;
  nome: string;
}

export default function PatrimonioDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const patrimonioId = params.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [comboboxOpen, setComboboxOpen] = useState(false);

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

  const updateResponsavelMutation = useMutation({
    mutationFn: async (responsavelNome: string | null) => {
      return apiRequest("PATCH", `/api/patrimonio/${patrimonioId}/responsavel`, {
        responsavelNome,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patrimonio", patrimonioId] });
      queryClient.invalidateQueries({ queryKey: ["/api/patrimonio"] });
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

  const getEstadoColor = (estado: string | null) => {
    if (!estado) return "";
    const estadoLower = estado.toLowerCase();
    if (estadoLower.includes("bom") || estadoLower.includes("novo") || estadoLower.includes("ótimo")) {
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    }
    if (estadoLower.includes("regular") || estadoLower.includes("médio") || estadoLower.includes("medio")) {
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    }
    if (estadoLower.includes("ruim") || estadoLower.includes("péssimo") || estadoLower.includes("pessimo")) {
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    }
    return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
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
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <span>Gestão de Ativos</span>
                <span>/</span>
                <span>Patrimônio</span>
                <span>/</span>
                <span className="text-foreground">Detalhes do patrimônio</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight" data-testid="title-patrimonio-detail">
                Detalhes do Patrimônio
              </h1>
            </div>
            <Package className="w-8 h-8 text-primary" />
          </div>

          <Tabs defaultValue="geral" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="geral" data-testid="tab-geral">Informações Gerais</TabsTrigger>
              <TabsTrigger value="tecnicas" data-testid="tab-tecnicas">Informações Técnicas</TabsTrigger>
            </TabsList>

            <TabsContent value="geral" className="space-y-6 mt-6">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Info className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Informações do Bem</CardTitle>
                      <CardDescription>Dados principais do ativo</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">Número do Patrimônio</div>
                      <div className="text-lg font-semibold" data-testid="numero-patrimonio">
                        {patrimonio.numeroAtivo || "-"}
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">Tipo de Bem</div>
                      <div className="text-base" data-testid="tipo-bem">
                        {patrimonio.ativo || "-"}
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">Marca</div>
                      <div className="text-base" data-testid="marca-bem">
                        {patrimonio.marca || "-"}
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">Estado de Conservação</div>
                      {patrimonio.estadoConservacao ? (
                        <Badge variant="outline" className={getEstadoColor(patrimonio.estadoConservacao)} data-testid="estado-conservacao">
                          {patrimonio.estadoConservacao}
                        </Badge>
                      ) : (
                        <div className="text-base">-</div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Valores</CardTitle>
                      <CardDescription>Informações financeiras</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">Valor Pago</div>
                      <div className="text-lg font-semibold text-green-600 dark:text-green-400" data-testid="valor-pago">
                        {formatCurrency(patrimonio.valorPago)}
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">Valor de Mercado</div>
                      <div className="text-lg font-semibold text-blue-600 dark:text-blue-400" data-testid="valor-mercado">
                        {formatCurrency(patrimonio.valorMercado)}
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">Valor de Venda</div>
                      <div className="text-lg font-semibold text-purple-600 dark:text-purple-400" data-testid="valor-venda">
                        {formatCurrency(patrimonio.valorVenda)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

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
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    patrimonio.responsavelAtual === colaborador.nome
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                {colaborador.nome}
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
                            <div className="text-xl font-semibold" data-testid="colaborador-nome">
                              {patrimonio.colaborador.nome}
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

                        <div className="grid gap-3 sm:grid-cols-2">
                          {patrimonio.colaborador.emailTurbo && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span data-testid="colaborador-email">{patrimonio.colaborador.emailTurbo}</span>
                            </div>
                          )}
                          {patrimonio.colaborador.telefone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span data-testid="colaborador-telefone">{patrimonio.colaborador.telefone}</span>
                            </div>
                          )}
                          {patrimonio.colaborador.admissao && (
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span>Admissão: {formatDate(patrimonio.colaborador.admissao)}</span>
                            </div>
                          )}
                          {patrimonio.colaborador.squad && (
                            <div className="flex items-center gap-2 text-sm">
                              <Badge variant="secondary">{patrimonio.colaborador.squad}</Badge>
                            </div>
                          )}
                        </div>
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
            </TabsContent>

            <TabsContent value="tecnicas" className="space-y-6 mt-6">
              <Card>
                <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Descrição e Especificações</CardTitle>
                    <CardDescription>Detalhes técnicos do bem</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">Descrição/Modelo</div>
                    <div className="text-base whitespace-pre-wrap" data-testid="descricao-bem">
                      {patrimonio.descricao || "Nenhuma descrição disponível"}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Resumo Técnico</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground">ID do Sistema</div>
                      <div className="text-base font-mono">{patrimonio.id}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground">Número de Ativo</div>
                      <div className="text-base font-mono">{patrimonio.numeroAtivo || "-"}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground">Categoria</div>
                      <div className="text-base">{patrimonio.ativo || "-"}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground">Fabricante</div>
                      <div className="text-base">{patrimonio.marca || "-"}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
