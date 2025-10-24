import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Colaborador, InsertColaborador } from "@shared/schema";
import { insertColaboradorSchema } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Search, Mail, Phone, Calendar, Briefcase, Award, Loader2, MapPin, Building2, CreditCard, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const squadColors: Record<string, string> = {
  "Performance": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "Vendas": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "Comunicação": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "Tech": "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  "Commerce": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

function getInitials(nome: string) {
  if (!nome) return "??";
  return nome
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(date: string | Date | null | undefined) {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleDateString("pt-BR");
  } catch {
    return "-";
  }
}

function AddColaboradorDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<InsertColaborador>({
    resolver: zodResolver(insertColaboradorSchema),
    defaultValues: {
      nome: "",
      status: "Ativo",
      cpf: "",
      telefone: "",
      emailTurbo: "",
      emailPessoal: "",
      cargo: "",
      nivel: "",
      squad: "",
      setor: "",
      endereco: "",
      estado: "",
      pix: "",
      cnpj: "",
      aniversario: undefined,
      admissao: undefined,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertColaborador) => {
      const response = await apiRequest("POST", "/api/colaboradores", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colaboradores"] });
      toast({
        title: "Colaborador adicionado",
        description: "O colaborador foi adicionado com sucesso.",
      });
      setOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao adicionar colaborador",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertColaborador) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-colaborador">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Colaborador
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Novo Colaborador</DialogTitle>
          <DialogDescription>
            Preencha os dados do novo colaborador. Campos com * são obrigatórios.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-nome" placeholder="Nome completo" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "Ativo"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Ativo">Ativo</SelectItem>
                        <SelectItem value="Inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cargo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cargo</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-cargo" placeholder="Ex: Desenvolvedor" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nivel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nível</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-nivel" placeholder="Ex: Pleno" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="squad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Squad</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-squad" placeholder="Ex: Tech" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="setor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Setor</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-setor" placeholder="Ex: Tecnologia" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-cpf" placeholder="000.000.000-00" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNPJ</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-cnpj" placeholder="00.000.000/0000-00" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="telefone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-telefone" placeholder="(00) 00000-0000" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emailTurbo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Turbo</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-email-turbo" type="email" placeholder="nome@turbo.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emailPessoal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Pessoal</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-email-pessoal" type="email" placeholder="nome@email.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pix"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PIX</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-pix" placeholder="Chave PIX" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="estado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-estado" placeholder="SP" maxLength={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endereco"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Endereço</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-endereco" placeholder="Rua, número, bairro" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="aniversario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aniversário</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        data-testid="input-aniversario"
                        type="date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="admissao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admissão</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        data-testid="input-admissao"
                        type="date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                data-testid="button-cancel"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-submit"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adicionando...
                  </>
                ) : (
                  "Adicionar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function Colaboradores() {
  const [searchQuery, setSearchQuery] = useState("");
  const [squadFilter, setSquadFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: colaboradores = [], isLoading } = useQuery<Colaborador[]>({
    queryKey: ["/api/colaboradores"],
  });

  const uniqueSquads = useMemo(() => {
    const squads = new Set(colaboradores.map((c) => c.squad).filter(Boolean));
    return Array.from(squads).sort();
  }, [colaboradores]);

  const filteredColaboradores = useMemo(() => {
    let filtered = colaboradores;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (col) =>
          col.nome?.toLowerCase().includes(query) ||
          col.cargo?.toLowerCase().includes(query) ||
          col.emailTurbo?.toLowerCase().includes(query) ||
          col.cpf?.includes(query) ||
          col.setor?.toLowerCase().includes(query)
      );
    }

    if (squadFilter !== "all") {
      filtered = filtered.filter((col) => col.squad === squadFilter);
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((col) => col.status === statusFilter);
    }

    return filtered;
  }, [colaboradores, searchQuery, squadFilter, statusFilter]);

  const ativos = filteredColaboradores.filter((c) => c.status === "Ativo").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loading-colaboradores" />
      </div>
    );
  }

  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2">Colaboradores</h1>
          <p className="text-muted-foreground">
            Gerencie os colaboradores da sua equipe ({colaboradores.length} total)
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[300px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por nome, cargo, email, CPF..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-colaboradores"
              />
            </div>

            <Select value={squadFilter} onValueChange={setSquadFilter}>
              <SelectTrigger className="w-[200px]" data-testid="select-squad-filter">
                <SelectValue placeholder="Todas as squads" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as squads</SelectItem>
                {uniqueSquads.map((squad) => (
                  <SelectItem key={squad} value={squad!}>
                    {squad}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="Ativo">Ativo</SelectItem>
                <SelectItem value="Inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>

            <AddColaboradorDialog />
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              {filteredColaboradores.length}{" "}
              {filteredColaboradores.length === 1 ? "colaborador" : "colaboradores"} •{" "}
              {ativos} {ativos === 1 ? "ativo" : "ativos"}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[80px]">ID</TableHead>
                  <TableHead className="min-w-[220px]">Colaborador</TableHead>
                  <TableHead className="min-w-[180px]">Cargo / Nível</TableHead>
                  <TableHead className="min-w-[140px]">Squad</TableHead>
                  <TableHead className="min-w-[140px]">Setor</TableHead>
                  <TableHead className="min-w-[280px]">Contatos</TableHead>
                  <TableHead className="min-w-[120px]">CPF</TableHead>
                  <TableHead className="min-w-[140px]">CNPJ</TableHead>
                  <TableHead className="min-w-[180px]">PIX</TableHead>
                  <TableHead className="min-w-[200px]">Localização</TableHead>
                  <TableHead className="min-w-[100px]">Status</TableHead>
                  <TableHead className="min-w-[120px]">Admissão</TableHead>
                  <TableHead className="min-w-[120px]">Demissão</TableHead>
                  <TableHead className="min-w-[200px]">Motivo Demissão</TableHead>
                  <TableHead className="min-w-[140px]">Proporcional</TableHead>
                  <TableHead className="min-w-[120px]">Tempo Turbo</TableHead>
                  <TableHead className="min-w-[140px]">Último Aumento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredColaboradores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={17} className="text-center py-8 text-muted-foreground">
                      Nenhum colaborador encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredColaboradores.map((colaborador) => (
                    <TableRow
                      key={colaborador.id}
                      className="hover-elevate cursor-pointer"
                      data-testid={`row-colaborador-${colaborador.id}`}
                    >
                      <TableCell>
                        <div className="text-sm text-muted-foreground font-mono" data-testid={`text-id-${colaborador.id}`}>
                          {colaborador.id}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>{getInitials(colaborador.nome)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium" data-testid={`text-nome-${colaborador.id}`}>
                              {colaborador.nome}
                            </div>
                            {colaborador.aniversario && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1" data-testid={`text-aniversario-${colaborador.id}`}>
                                <Calendar className="w-3 h-3" />
                                {formatDate(colaborador.aniversario)}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm font-medium flex items-center gap-1.5" data-testid={`text-cargo-${colaborador.id}`}>
                            <Briefcase className="w-3 h-3 text-muted-foreground" />
                            {colaborador.cargo || "-"}
                          </div>
                          {colaborador.nivel && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5" data-testid={`text-nivel-${colaborador.id}`}>
                              <Award className="w-3 h-3" />
                              {colaborador.nivel}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {colaborador.squad ? (
                          <Badge
                            variant="secondary"
                            className={squadColors[colaborador.squad] || "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"}
                            data-testid={`badge-squad-${colaborador.id}`}
                          >
                            {colaborador.squad}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground" data-testid={`text-setor-${colaborador.id}`}>
                          {colaborador.setor || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1.5">
                          {colaborador.emailTurbo && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="w-3 h-3 text-primary" />
                              <span className="text-muted-foreground truncate max-w-[220px]" title={colaborador.emailTurbo} data-testid={`text-email-turbo-${colaborador.id}`}>
                                {colaborador.emailTurbo}
                              </span>
                            </div>
                          )}
                          {colaborador.emailPessoal && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="w-3 h-3 text-muted-foreground" />
                              <span className="text-muted-foreground truncate max-w-[220px]" title={colaborador.emailPessoal} data-testid={`text-email-pessoal-${colaborador.id}`}>
                                {colaborador.emailPessoal}
                              </span>
                            </div>
                          )}
                          {colaborador.telefone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="w-3 h-3 text-muted-foreground" />
                              <span className="text-muted-foreground" data-testid={`text-telefone-${colaborador.id}`}>{colaborador.telefone}</span>
                            </div>
                          )}
                          {!colaborador.emailTurbo && !colaborador.emailPessoal && !colaborador.telefone && (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground font-mono" data-testid={`text-cpf-${colaborador.id}`}>
                          {colaborador.cpf || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground font-mono" data-testid={`text-cnpj-${colaborador.id}`}>
                          {colaborador.cnpj || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          {colaborador.pix && (
                            <>
                              <CreditCard className="w-3 h-3 text-muted-foreground" />
                              <span className="text-muted-foreground truncate max-w-[160px]" title={colaborador.pix} data-testid={`text-pix-${colaborador.id}`}>
                                {colaborador.pix}
                              </span>
                            </>
                          )}
                          {!colaborador.pix && <span className="text-muted-foreground">-</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {colaborador.estado && (
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="w-3 h-3 text-muted-foreground" />
                              <span className="text-muted-foreground font-medium" data-testid={`text-estado-${colaborador.id}`}>{colaborador.estado}</span>
                            </div>
                          )}
                          {colaborador.endereco && (
                            <div className="text-xs text-muted-foreground truncate max-w-[180px]" title={colaborador.endereco} data-testid={`text-endereco-${colaborador.id}`}>
                              {colaborador.endereco}
                            </div>
                          )}
                          {!colaborador.estado && !colaborador.endereco && (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={colaborador.status === "Ativo" ? "default" : "secondary"}
                          data-testid={`badge-status-${colaborador.id}`}
                        >
                          {colaborador.status || "Desconhecido"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground" data-testid={`text-admissao-${colaborador.id}`}>
                          {formatDate(colaborador.admissao)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {colaborador.demissao ? (
                            <>
                              <div className="text-sm text-muted-foreground" data-testid={`text-demissao-${colaborador.id}`}>
                                {formatDate(colaborador.demissao)}
                              </div>
                              {colaborador.tipoDemissao && (
                                <div className="text-xs text-muted-foreground" data-testid={`text-tipo-demissao-${colaborador.id}`}>
                                  {colaborador.tipoDemissao}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {colaborador.motivoDemissao ? (
                            <div className="text-sm text-muted-foreground max-w-[180px] truncate" title={colaborador.motivoDemissao} data-testid={`text-motivo-demissao-${colaborador.id}`}>
                              {colaborador.motivoDemissao}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {(colaborador.proporcional || colaborador.proporcionalCaju) ? (
                            <>
                              {colaborador.proporcional && (
                                <div className="text-sm text-muted-foreground" data-testid={`text-proporcional-${colaborador.id}`}>
                                  R$ {Number(colaborador.proporcional).toFixed(2)}
                                </div>
                              )}
                              {colaborador.proporcionalCaju && (
                                <div className="text-xs text-muted-foreground" data-testid={`text-proporcional-caju-${colaborador.id}`}>
                                  Caju: R$ {Number(colaborador.proporcionalCaju).toFixed(2)}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground" data-testid={`text-meses-turbo-${colaborador.id}`}>
                          {colaborador.mesesDeTurbo ? `${colaborador.mesesDeTurbo} ${colaborador.mesesDeTurbo === 1 ? "mês" : "meses"}` : "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {colaborador.ultimoAumento ? (
                            <>
                              <div className="text-sm text-muted-foreground" data-testid={`text-ultimo-aumento-${colaborador.id}`}>
                                {formatDate(colaborador.ultimoAumento)}
                              </div>
                              {colaborador.mesesUltAumento !== null && colaborador.mesesUltAumento !== undefined && (
                                <div className="text-xs text-muted-foreground" data-testid={`text-meses-ult-aumento-${colaborador.id}`}>
                                  há {colaborador.mesesUltAumento} {colaborador.mesesUltAumento === 1 ? "mês" : "meses"}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
