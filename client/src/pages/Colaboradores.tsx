import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Colaborador, InsertColaborador } from "@shared/schema";
import { insertColaboradorSchema } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Search, Mail, Phone, Calendar, Briefcase, Award, Loader2, MapPin, Building2, CreditCard, Plus, Pencil, Trash2, BarChart3, Package, Users, Filter, X, UserPlus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useSetPageInfo } from "@/contexts/PageContext";
import { formatCurrency } from "@/lib/utils";

type ColaboradorComPatrimonios = Colaborador & {
  patrimonios: { id: number; numeroAtivo: string | null; descricao: string | null }[];
};
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { z } from "zod";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Label } from "@/components/ui/label";

const squadColors: Record<string, string> = {
  "Performance": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "Vendas": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "Comunicação": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "Tech": "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  "Commerce": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

const statusOptions = ["Vai Começar", "Ativo", "Dispensado", "Em Desligamento"];

interface CargoOption {
  id: number;
  nome: string;
}

interface NivelOption {
  id: number;
  nome: string;
}

interface SquadOption {
  id: number;
  nome: string;
  emoji: string | null;
}

interface EstadoOption {
  uf: string;
  nome: string;
}

interface CidadeOption {
  id: number;
  nome: string;
}

interface FilterState {
  search: string;
  squad: string;
  status: string;
  cargo: string;
  nivel: string;
  setor: string;
  admissaoFrom: string;
  admissaoTo: string;
}

const initialFilterState: FilterState = {
  search: "",
  squad: "all",
  status: "all",
  cargo: "all",
  nivel: "all",
  setor: "",
  admissaoFrom: "",
  admissaoTo: "",
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

function calcularTempoTurbo(admissao: string | Date | null | undefined, demissao: string | Date | null | undefined, status: string | null): string {
  if (!admissao) return "-";
  const admissaoDate = new Date(admissao);
  admissaoDate.setHours(0, 0, 0, 0);
  let endDate: Date;
  if (status === "Dispensado" && demissao) {
    endDate = new Date(demissao);
  } else {
    endDate = new Date();
  }
  endDate.setHours(0, 0, 0, 0);
  const diffTime = endDate.getTime() - admissaoDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  const diffMonths = diffDays / 30;
  if (diffMonths <= 0) return "-";
  const formatted = diffMonths.toFixed(1).replace(".", ",");
  return `${formatted} ${diffMonths === 1 ? "mês" : "meses"}`;
}

function FilterDialog({
  filters,
  onApplyFilters,
  squads,
  cargos,
  niveis,
}: {
  filters: FilterState;
  onApplyFilters: (filters: FilterState) => void;
  squads: SquadOption[];
  cargos: CargoOption[];
  niveis: NivelOption[];
}) {
  const [open, setOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);

  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (localFilters.search) count++;
    if (localFilters.squad !== "all") count++;
    if (localFilters.status !== "all") count++;
    if (localFilters.cargo !== "all") count++;
    if (localFilters.nivel !== "all") count++;
    if (localFilters.setor) count++;
    if (localFilters.admissaoFrom) count++;
    if (localFilters.admissaoTo) count++;
    return count;
  }, [localFilters]);

  const appliedFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.squad !== "all") count++;
    if (filters.status !== "all") count++;
    if (filters.cargo !== "all") count++;
    if (filters.nivel !== "all") count++;
    if (filters.setor) count++;
    if (filters.admissaoFrom) count++;
    if (filters.admissaoTo) count++;
    return count;
  }, [filters]);

  const handleApply = () => {
    onApplyFilters(localFilters);
    setOpen(false);
  };

  const handleClear = () => {
    setLocalFilters(initialFilterState);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-open-filters" className="relative">
          <Filter className="w-4 h-4 mr-2" />
          Filtros
          {appliedFilterCount > 0 && (
            <Badge variant="default" className="ml-2 px-1.5 py-0.5 text-xs" data-testid="badge-filter-count">
              {appliedFilterCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros de Colaboradores
          </DialogTitle>
          <DialogDescription>
            Configure os filtros para refinar a lista de colaboradores
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="filter-search">Busca</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="filter-search"
                type="text"
                placeholder="Buscar por nome, cargo, email, CPF..."
                value={localFilters.search}
                onChange={(e) => setLocalFilters({ ...localFilters, search: e.target.value })}
                className="pl-10"
                data-testid="input-filter-search"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Squad</Label>
              <Select
                value={localFilters.squad}
                onValueChange={(value) => setLocalFilters({ ...localFilters, squad: value })}
              >
                <SelectTrigger data-testid="select-filter-squad">
                  <SelectValue placeholder="Todas as squads" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as squads</SelectItem>
                  {squads.map((squad) => (
                    <SelectItem key={squad.id} value={squad.nome}>
                      {squad.emoji ? `${squad.emoji} ${squad.nome}` : squad.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={localFilters.status}
                onValueChange={(value) => setLocalFilters({ ...localFilters, status: value })}
              >
                <SelectTrigger data-testid="select-filter-status">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cargo</Label>
              <Select
                value={localFilters.cargo}
                onValueChange={(value) => setLocalFilters({ ...localFilters, cargo: value })}
              >
                <SelectTrigger data-testid="select-filter-cargo">
                  <SelectValue placeholder="Todos os cargos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os cargos</SelectItem>
                  {cargos.map((cargo) => (
                    <SelectItem key={cargo.id} value={cargo.nome}>
                      {cargo.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nível</Label>
              <Select
                value={localFilters.nivel}
                onValueChange={(value) => setLocalFilters({ ...localFilters, nivel: value })}
              >
                <SelectTrigger data-testid="select-filter-nivel">
                  <SelectValue placeholder="Todos os níveis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os níveis</SelectItem>
                  {niveis.map((nivel) => (
                    <SelectItem key={nivel.id} value={nivel.nome}>
                      {nivel.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="filter-setor">Setor</Label>
            <Input
              id="filter-setor"
              type="text"
              placeholder="Filtrar por setor..."
              value={localFilters.setor}
              onChange={(e) => setLocalFilters({ ...localFilters, setor: e.target.value })}
              data-testid="input-filter-setor"
            />
          </div>

          <div className="space-y-2">
            <Label>Data de Admissão</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">De</Label>
                <Input
                  type="date"
                  value={localFilters.admissaoFrom}
                  onChange={(e) => setLocalFilters({ ...localFilters, admissaoFrom: e.target.value })}
                  data-testid="input-filter-admissao-from"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Até</Label>
                <Input
                  type="date"
                  value={localFilters.admissaoTo}
                  onChange={(e) => setLocalFilters({ ...localFilters, admissaoTo: e.target.value })}
                  data-testid="input-filter-admissao-to"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClear}
            data-testid="button-clear-filters"
          >
            Limpar Filtros
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            data-testid="button-apply-filters"
          >
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilterChips({
  filters,
  onRemoveFilter,
  squads,
  cargos,
  niveis,
}: {
  filters: FilterState;
  onRemoveFilter: (key: keyof FilterState) => void;
  squads: SquadOption[];
  cargos: CargoOption[];
  niveis: NivelOption[];
}) {
  const chips: { key: keyof FilterState; label: string }[] = [];

  if (filters.search) {
    chips.push({ key: "search", label: `Busca: "${filters.search}"` });
  }
  if (filters.squad !== "all") {
    const squad = squads.find((s) => s.nome === filters.squad);
    chips.push({ key: "squad", label: `Squad: ${squad?.emoji ? `${squad.emoji} ` : ""}${filters.squad}` });
  }
  if (filters.status !== "all") {
    chips.push({ key: "status", label: `Status: ${filters.status}` });
  }
  if (filters.cargo !== "all") {
    chips.push({ key: "cargo", label: `Cargo: ${filters.cargo}` });
  }
  if (filters.nivel !== "all") {
    chips.push({ key: "nivel", label: `Nível: ${filters.nivel}` });
  }
  if (filters.setor) {
    chips.push({ key: "setor", label: `Setor: ${filters.setor}` });
  }
  if (filters.admissaoFrom) {
    chips.push({ key: "admissaoFrom", label: `Admissão de: ${formatDate(filters.admissaoFrom)}` });
  }
  if (filters.admissaoTo) {
    chips.push({ key: "admissaoTo", label: `Admissão até: ${formatDate(filters.admissaoTo)}` });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2" data-testid="filter-chips-container">
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="secondary"
          className="flex items-center gap-1 pr-1"
          data-testid={`filter-chip-${chip.key}`}
        >
          <span className="text-xs">{chip.label}</span>
          <button
            type="button"
            className="ml-1 rounded-full hover:bg-muted-foreground/20 focus:outline-none"
            onClick={() => onRemoveFilter(chip.key)}
            data-testid={`button-remove-filter-${chip.key}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}

function AddColaboradorDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: cargos = [], isLoading: cargosLoading } = useQuery<CargoOption[]>({
    queryKey: ["/api/rh/cargos"],
  });

  const { data: niveis = [], isLoading: niveisLoading } = useQuery<NivelOption[]>({
    queryKey: ["/api/rh/niveis"],
  });

  const { data: squads = [], isLoading: squadsLoading } = useQuery<SquadOption[]>({
    queryKey: ["/api/rh/squads"],
  });

  const { data: estados = [], isLoading: estadosLoading } = useQuery<EstadoOption[]>({
    queryKey: ["/api/geo/estados"],
  });

  const addColaboradorSchema = insertColaboradorSchema.extend({
    cidade: z.string().optional(),
  });

  const form = useForm<InsertColaborador & { cidade?: string }>({
    resolver: zodResolver(addColaboradorSchema),
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
      cidade: "",
      pix: "",
      cnpj: "",
      aniversario: undefined,
      admissao: undefined,
    },
  });

  const estado = form.watch("estado");

  const { data: cidades = [], isLoading: cidadesLoading } = useQuery<CidadeOption[]>({
    queryKey: ["/api/geo/cidades", estado],
    enabled: !!estado,
  });

  useEffect(() => {
    form.setValue("cidade", "", { shouldValidate: false });
  }, [estado, form]);

  const createMutation = useMutation({
    mutationFn: async (data: InsertColaborador) => {
      const response = await apiRequest("POST", "/api/colaboradores", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colaboradores/com-patrimonios"] });
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
                        {statusOptions.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
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
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="select-cargo">
                          <SelectValue placeholder={cargosLoading ? "Carregando..." : "Selecione o cargo"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {cargos.map((cargo) => (
                          <SelectItem key={cargo.id} value={cargo.nome}>
                            {cargo.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="select-nivel">
                          <SelectValue placeholder={niveisLoading ? "Carregando..." : "Selecione o nível"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {niveis.map((nivel) => (
                          <SelectItem key={nivel.id} value={nivel.nome}>
                            {nivel.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="select-squad">
                          <SelectValue placeholder={squadsLoading ? "Carregando..." : "Selecione o squad"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {squads.map((squad) => (
                          <SelectItem key={squad.id} value={squad.nome}>
                            {squad.emoji ? `${squad.emoji} ${squad.nome}` : squad.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="select-estado">
                          <SelectValue placeholder={estadosLoading ? "Carregando..." : "Selecione o estado"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {estados.map((est) => (
                          <SelectItem key={est.uf} value={est.uf}>
                            {est.uf} - {est.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value || undefined}
                      disabled={!estado || cidadesLoading}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-cidade">
                          <SelectValue placeholder={
                            !estado 
                              ? "Selecione um estado primeiro" 
                              : cidadesLoading 
                                ? "Carregando cidades..." 
                                : "Selecione a cidade"
                          } />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {cidades.map((cidade) => (
                          <SelectItem key={cidade.id} value={cidade.nome}>
                            {cidade.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

function EditColaboradorDialog({ colaborador, open, onOpenChange }: { colaborador: Colaborador; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();

  const { data: cargos = [], isLoading: cargosLoading } = useQuery<CargoOption[]>({
    queryKey: ["/api/rh/cargos"],
  });

  const { data: niveis = [], isLoading: niveisLoading } = useQuery<NivelOption[]>({
    queryKey: ["/api/rh/niveis"],
  });

  const { data: squads = [], isLoading: squadsLoading } = useQuery<SquadOption[]>({
    queryKey: ["/api/rh/squads"],
  });

  const { data: estados = [], isLoading: estadosLoading } = useQuery<EstadoOption[]>({
    queryKey: ["/api/geo/estados"],
  });

  const editColaboradorSchema = insertColaboradorSchema.extend({
    demissao: z.string().optional(),
    cidade: z.string().optional(),
  }).refine(
    (data) => {
      if (data.status === "Dispensado") {
        return !!data.demissao;
      }
      return true;
    },
    {
      message: "Data de demissão é obrigatória quando o status é 'Dispensado'",
      path: ["demissao"],
    }
  );

  const extractEstadoSigla = (estadoValue: string | null | undefined): string => {
    if (!estadoValue) return "";
    const trimmed = estadoValue.trim();
    if (trimmed.length === 2) return trimmed.toUpperCase();
    const match = trimmed.match(/^([A-Z]{2})\s*-/i);
    if (match) return match[1].toUpperCase();
    const states: Record<string, string> = {
      "acre": "AC", "alagoas": "AL", "amapá": "AP", "amazonas": "AM", "bahia": "BA",
      "ceará": "CE", "distrito federal": "DF", "espírito santo": "ES", "goiás": "GO",
      "maranhão": "MA", "mato grosso": "MT", "mato grosso do sul": "MS", "minas gerais": "MG",
      "pará": "PA", "paraíba": "PB", "paraná": "PR", "pernambuco": "PE", "piauí": "PI",
      "rio de janeiro": "RJ", "rio grande do norte": "RN", "rio grande do sul": "RS",
      "rondônia": "RO", "roraima": "RR", "santa catarina": "SC", "são paulo": "SP",
      "sergipe": "SE", "tocantins": "TO"
    };
    const lowerVal = trimmed.toLowerCase();
    for (const [name, sigla] of Object.entries(states)) {
      if (lowerVal.includes(name)) return sigla;
    }
    return "";
  };

  const extractCidadeFromEndereco = (endereco: string | null | undefined): string => {
    if (!endereco) return "";
    const parts = endereco.split(",").map(p => p.trim());
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      if (part.match(/\d{5}-?\d{3}/)) continue;
      if (part.match(/^[A-Z]{2}$/i)) continue;
      if (part.match(/^[A-Z]{2}\s*-/i)) continue;
      if (part.length > 2 && !part.match(/^\d+$/)) {
        const cityMatch = part.match(/^([^-]+)/);
        if (cityMatch) return cityMatch[1].trim();
      }
    }
    return "";
  };

  const estadoSigla = extractEstadoSigla(colaborador.estado);

  const form = useForm<InsertColaborador & { demissao?: string; cidade?: string }>({
    resolver: zodResolver(editColaboradorSchema),
    defaultValues: {
      nome: colaborador.nome || "",
      status: colaborador.status || "Ativo",
      cpf: colaborador.cpf || "",
      telefone: colaborador.telefone || "",
      emailTurbo: colaborador.emailTurbo || "",
      emailPessoal: colaborador.emailPessoal || "",
      cargo: colaborador.cargo || "",
      nivel: colaborador.nivel || "",
      squad: colaborador.squad || "",
      setor: colaborador.setor || "",
      endereco: colaborador.endereco || "",
      estado: estadoSigla,
      cidade: (colaborador as any).cidade || extractCidadeFromEndereco(colaborador.endereco),
      pix: colaborador.pix || "",
      cnpj: colaborador.cnpj || "",
      aniversario: colaborador.aniversario ? new Date(colaborador.aniversario).toISOString().split('T')[0] : undefined,
      admissao: colaborador.admissao ? new Date(colaborador.admissao).toISOString().split('T')[0] : undefined,
      demissao: colaborador.demissao ? new Date(colaborador.demissao).toISOString().split('T')[0] : undefined,
    },
  });

  const status = form.watch("status");
  const estado = form.watch("estado");

  const { data: cidades = [], isLoading: cidadesLoading } = useQuery<CidadeOption[]>({
    queryKey: ["/api/geo/cidades", estado],
    enabled: !!estado,
  });

  useEffect(() => {
    if (status !== "Dispensado") {
      form.setValue("demissao", undefined, { shouldValidate: true });
    }
  }, [status, form]);

  useEffect(() => {
    if (estado !== estadoSigla && estado !== "") {
      form.setValue("cidade", "", { shouldValidate: false });
    }
  }, [estado, estadoSigla, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: InsertColaborador) => {
      const response = await apiRequest("PATCH", `/api/colaboradores/${colaborador.id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colaboradores/com-patrimonios"] });
      toast({
        title: "Colaborador atualizado",
        description: "As informações do colaborador foram atualizadas com sucesso.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar colaborador",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertColaborador) => {
    updateMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Colaborador</DialogTitle>
          <DialogDescription>
            Atualize as informações do colaborador {colaborador.nome}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-nome" />
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
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-status">
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {statusOptions.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-edit-cpf" />
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
                      <Input {...field} value={field.value || ""} data-testid="input-edit-telefone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="emailTurbo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Turbo</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} type="email" data-testid="input-edit-email-turbo" />
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
                      <Input {...field} value={field.value || ""} type="email" data-testid="input-edit-email-pessoal" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="cargo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cargo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-cargo">
                          <SelectValue placeholder={cargosLoading ? "Carregando..." : "Selecione o cargo"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {cargos.map((cargo) => (
                          <SelectItem key={cargo.id} value={cargo.nome}>
                            {cargo.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-nivel">
                          <SelectValue placeholder={niveisLoading ? "Carregando..." : "Selecione o nível"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {niveis.map((nivel) => (
                          <SelectItem key={nivel.id} value={nivel.nome}>
                            {nivel.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-setor">
                          <SelectValue placeholder="Selecione o setor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Commerce">Commerce</SelectItem>
                        <SelectItem value="Growth Interno">Growth Interno</SelectItem>
                        <SelectItem value="Backoffice">Backoffice</SelectItem>
                        <SelectItem value="Tech Sites">Tech Sites</SelectItem>
                        <SelectItem value="Ventures">Ventures</SelectItem>
                        <SelectItem value="Sócios">Sócios</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="squad"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Squad</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-squad">
                        <SelectValue placeholder={squadsLoading ? "Carregando..." : "Selecione o squad"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {squads.map((squad) => (
                        <SelectItem key={squad.id} value={squad.nome}>
                          {squad.emoji ? `${squad.emoji} ${squad.nome}` : squad.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="estado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-estado">
                          <SelectValue placeholder={estadosLoading ? "Carregando..." : "Selecione o estado"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {estados.map((est) => (
                          <SelectItem key={est.uf} value={est.uf}>
                            {est.uf} - {est.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value || undefined}
                      disabled={!estado || cidadesLoading}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-cidade">
                          <SelectValue placeholder={
                            !estado 
                              ? "Selecione um estado primeiro" 
                              : cidadesLoading 
                                ? "Carregando cidades..." 
                                : "Selecione a cidade"
                          } />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {cidades.map((cidade) => (
                          <SelectItem key={cidade.id} value={cidade.nome}>
                            {cidade.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="endereco"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} data-testid="input-edit-endereco" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="pix"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PIX</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-edit-pix" />
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
                      <Input {...field} value={field.value || ""} data-testid="input-edit-cnpj" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        data-testid="input-edit-aniversario"
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
                        data-testid="input-edit-admissao"
                        type="date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {status === "Dispensado" && (
              <FormField
                control={form.control}
                name="demissao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Demissão *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        data-testid="input-edit-demissao"
                        type="date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-edit-cancel"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                data-testid="button-edit-submit"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar Alterações"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirmDialog({ colaborador, open, onOpenChange }: { colaborador: Colaborador; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/colaboradores/${colaborador.id}`, {});
      if (response.status !== 204) {
        throw new Error("Erro ao excluir colaborador");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colaboradores/com-patrimonios"] });
      toast({
        title: "Colaborador excluído",
        description: `${colaborador.nome} foi removido com sucesso.`,
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir colaborador",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir o colaborador <strong>{colaborador.nome}</strong>? 
            Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-delete-cancel">Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="button-delete-confirm"
          >
            {deleteMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Excluindo...
              </>
            ) : (
              "Excluir"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function Colaboradores() {
  useSetPageInfo("Colaboradores", "Gerencie os colaboradores da sua equipe");
  const [, setLocation] = useLocation();
  
  const [filters, setFilters] = useState<FilterState>(initialFilterState);
  const [editingColaborador, setEditingColaborador] = useState<ColaboradorComPatrimonios | null>(null);
  const [deletingColaborador, setDeletingColaborador] = useState<ColaboradorComPatrimonios | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortColumn, setSortColumn] = useState<string | null>("status");
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const { data: colaboradores = [], isLoading } = useQuery<ColaboradorComPatrimonios[]>({
    queryKey: ["/api/colaboradores/com-patrimonios"],
  });

  const { data: squads = [] } = useQuery<SquadOption[]>({
    queryKey: ["/api/rh/squads"],
  });

  const { data: cargos = [] } = useQuery<CargoOption[]>({
    queryKey: ["/api/rh/cargos"],
  });

  const { data: niveis = [] } = useQuery<NivelOption[]>({
    queryKey: ["/api/rh/niveis"],
  });

  const { data: userPhotos = {} } = useQuery<Record<string, string>>({
    queryKey: ["/api/user-photos"],
  });

  const getColaboradorPhoto = (colaborador: ColaboradorComPatrimonios) => {
    const email = colaborador.emailTurbo?.toLowerCase().trim();
    if (email && userPhotos[email]) {
      return userPhotos[email];
    }
    return null;
  };

  const filteredColaboradores = useMemo(() => {
    let filtered = colaboradores;

    if (filters.search) {
      const query = filters.search.toLowerCase();
      filtered = filtered.filter(
        (col) =>
          col.nome?.toLowerCase().includes(query) ||
          col.cargo?.toLowerCase().includes(query) ||
          col.emailTurbo?.toLowerCase().includes(query) ||
          col.cpf?.includes(query) ||
          col.setor?.toLowerCase().includes(query)
      );
    }

    if (filters.squad !== "all") {
      filtered = filtered.filter((col) => col.squad === filters.squad);
    }

    if (filters.status !== "all") {
      filtered = filtered.filter((col) => col.status === filters.status);
    }

    if (filters.cargo !== "all") {
      filtered = filtered.filter((col) => col.cargo === filters.cargo);
    }

    if (filters.nivel !== "all") {
      filtered = filtered.filter((col) => col.nivel === filters.nivel);
    }

    if (filters.setor) {
      const setorQuery = filters.setor.toLowerCase();
      filtered = filtered.filter((col) => col.setor?.toLowerCase().includes(setorQuery));
    }

    if (filters.admissaoFrom) {
      const fromDate = new Date(filters.admissaoFrom);
      filtered = filtered.filter((col) => {
        if (!col.admissao) return false;
        return new Date(col.admissao) >= fromDate;
      });
    }

    if (filters.admissaoTo) {
      const toDate = new Date(filters.admissaoTo);
      filtered = filtered.filter((col) => {
        if (!col.admissao) return false;
        return new Date(col.admissao) <= toDate;
      });
    }

    return filtered;
  }, [colaboradores, filters]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-4 h-4 ml-1 text-muted-foreground/50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 ml-1 text-primary" />
      : <ArrowDown className="w-4 h-4 ml-1 text-primary" />;
  };

  const sortedColaboradores = useMemo(() => {
    if (!sortColumn) return filteredColaboradores;

    return [...filteredColaboradores].sort((a, b) => {
      let aVal: string | number | null = null;
      let bVal: string | number | null = null;

      switch (sortColumn) {
        case 'id':
          aVal = a.id;
          bVal = b.id;
          break;
        case 'nome':
          aVal = a.nome?.toLowerCase() || '';
          bVal = b.nome?.toLowerCase() || '';
          break;
        case 'status':
          aVal = a.status?.toLowerCase() || '';
          bVal = b.status?.toLowerCase() || '';
          break;
        case 'cargo':
          aVal = `${a.cargo || ''} ${a.nivel || ''}`.toLowerCase().trim();
          bVal = `${b.cargo || ''} ${b.nivel || ''}`.toLowerCase().trim();
          break;
        case 'squad':
          aVal = a.squad?.toLowerCase() || '';
          bVal = b.squad?.toLowerCase() || '';
          break;
        case 'setor':
          aVal = a.setor?.toLowerCase() || '';
          bVal = b.setor?.toLowerCase() || '';
          break;
        default:
          return 0;
      }

      if (aVal === null || aVal === '') return sortDirection === 'asc' ? 1 : -1;
      if (bVal === null || bVal === '') return sortDirection === 'asc' ? -1 : 1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const comparison = String(aVal).localeCompare(String(bVal), 'pt-BR');
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredColaboradores, sortColumn, sortDirection]);

  const totalPages = Math.ceil(sortedColaboradores.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedColaboradores = sortedColaboradores.slice(startIndex, endIndex);

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages]);

  const metrics = useMemo(() => {
    const total = colaboradores.length;
    const ativos = colaboradores.filter((c) => c.status === "Ativo").length;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    const novosUltimos30d = colaboradores.filter((c) => {
      if (!c.admissao || c.status !== "Ativo") return false;
      const admissaoDate = new Date(c.admissao);
      admissaoDate.setHours(0, 0, 0, 0);
      return admissaoDate >= thirtyDaysAgo;
    }).length;
    return { total, ativos, novosUltimos30d };
  }, [colaboradores]);

  const handleRemoveFilter = (key: keyof FilterState) => {
    setFilters((prev) => ({
      ...prev,
      [key]: key === "search" || key === "setor" || key === "admissaoFrom" || key === "admissaoTo" ? "" : "all",
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loading-colaboradores" />
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold" data-testid="text-page-title">Colaboradores</h1>
                <p className="text-sm text-muted-foreground">Gerencie os colaboradores da sua equipe</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <FilterDialog
                filters={filters}
                onApplyFilters={setFilters}
                squads={squads}
                cargos={cargos}
                niveis={niveis}
              />
              <Link href="/colaboradores/analise">
                <Button variant="outline" data-testid="button-analise-colaboradores">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Análise
                </Button>
              </Link>
              <AddColaboradorDialog />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="metrics-summary">
            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total de Colaboradores</CardTitle>
                <Users className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="metric-total">{metrics.total}</div>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Colaboradores Ativos</CardTitle>
                <Briefcase className="w-4 h-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="metric-ativos">{metrics.ativos}</div>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Novos (Últimos 30 dias)</CardTitle>
                <UserPlus className="w-4 h-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="metric-novos">{metrics.novosUltimos30d}</div>
              </CardContent>
            </Card>
          </div>

          <FilterChips
            filters={filters}
            onRemoveFilter={handleRemoveFilter}
            squads={squads}
            cargos={cargos}
            niveis={niveis}
          />

          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between gap-4 px-4 py-3 border-b">
                <div className="text-sm text-muted-foreground" data-testid="text-result-count">
                  {sortedColaboradores.length}{" "}
                  {sortedColaboradores.length === 1 ? "colaborador encontrado" : "colaboradores encontrados"}
                </div>
              </div>
              <div className="min-h-[600px] max-h-[calc(100vh-450px)] overflow-y-auto overflow-x-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-20">
                    <TableRow className="bg-muted/50 border-b">
                      <TableHead 
                        className="min-w-[80px] bg-muted/50 cursor-pointer select-none" 
                        onClick={() => handleSort('id')}
                        data-testid="table-header-id"
                      >
                        <div className="flex items-center">
                          ID
                          {getSortIcon('id')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="min-w-[220px] bg-muted/50 cursor-pointer select-none" 
                        onClick={() => handleSort('nome')}
                        data-testid="table-header-nome"
                      >
                        <div className="flex items-center">
                          Colaborador
                          {getSortIcon('nome')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="min-w-[100px] bg-muted/50 cursor-pointer select-none" 
                        onClick={() => handleSort('status')}
                        data-testid="table-header-status"
                      >
                        <div className="flex items-center">
                          Status
                          {getSortIcon('status')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="min-w-[180px] bg-muted/50 cursor-pointer select-none" 
                        onClick={() => handleSort('cargo')}
                        data-testid="table-header-cargo"
                      >
                        <div className="flex items-center">
                          Cargo / Nível
                          {getSortIcon('cargo')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="min-w-[140px] bg-muted/50 cursor-pointer select-none" 
                        onClick={() => handleSort('squad')}
                        data-testid="table-header-squad"
                      >
                        <div className="flex items-center">
                          Squad
                          {getSortIcon('squad')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="min-w-[140px] bg-muted/50 cursor-pointer select-none" 
                        onClick={() => handleSort('setor')}
                        data-testid="table-header-setor"
                      >
                        <div className="flex items-center">
                          Setor
                          {getSortIcon('setor')}
                        </div>
                      </TableHead>
                      <TableHead className="min-w-[120px] bg-muted/50">Tempo Turbo</TableHead>
                      <TableHead className="min-w-[280px] bg-muted/50">Contatos</TableHead>
                      <TableHead className="min-w-[120px] bg-muted/50">CPF</TableHead>
                      <TableHead className="min-w-[140px] bg-muted/50">CNPJ</TableHead>
                      <TableHead className="min-w-[180px] bg-muted/50">PIX</TableHead>
                      <TableHead className="min-w-[200px] bg-muted/50">Localização</TableHead>
                      <TableHead className="min-w-[120px] bg-muted/50">Admissão</TableHead>
                      <TableHead className="min-w-[140px] bg-muted/50">Último Aumento</TableHead>
                      <TableHead className="min-w-[150px] bg-muted/50">Patrimônios</TableHead>
                      <TableHead className="min-w-[120px] bg-muted/50">Demissão</TableHead>
                      <TableHead className="min-w-[200px] bg-muted/50">Motivo Demissão</TableHead>
                      <TableHead className="min-w-[120px] sticky right-0 bg-muted/50">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedColaboradores.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={18} className="text-center py-12 text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <Users className="w-8 h-8 text-muted-foreground/50" />
                            <span>Nenhum colaborador encontrado</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedColaboradores.map((colaborador, index) => (
                        <TableRow
                          key={colaborador.id}
                          className={`hover:bg-muted/30 cursor-pointer transition-colors ${index % 2 === 0 ? '' : 'bg-muted/10'}`}
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (target.closest('button') || target.closest('[role="button"]')) {
                              return;
                            }
                            setLocation(`/colaborador/${colaborador.id}`);
                          }}
                          data-testid={`row-colaborador-${colaborador.id}`}
                        >
                          <TableCell className="py-3">
                            <div className="text-sm text-muted-foreground font-mono" data-testid={`text-id-${colaborador.id}`}>
                              {colaborador.id}
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                                <AvatarImage 
                                  src={getColaboradorPhoto(colaborador) || undefined} 
                                  alt={colaborador.nome}
                                />
                                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                  {getInitials(colaborador.nome)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="font-medium leading-tight" data-testid={`text-nome-${colaborador.id}`}>
                                  {colaborador.nome}
                                </span>
                                {colaborador.aniversario && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5" data-testid={`text-aniversario-${colaborador.id}`}>
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(colaborador.aniversario)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge
                              variant={colaborador.status === "Ativo" ? "default" : colaborador.status === "Dispensado" ? "destructive" : "secondary"}
                              data-testid={`badge-status-${colaborador.id}`}
                            >
                              {colaborador.status || "Desconhecido"}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3">
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
                          <TableCell className="py-3">
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
                          <TableCell className="py-3">
                            <div className="text-sm text-muted-foreground" data-testid={`text-setor-${colaborador.id}`}>
                              {colaborador.setor || "-"}
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="text-sm text-muted-foreground" data-testid={`text-meses-turbo-${colaborador.id}`}>
                              {calcularTempoTurbo(colaborador.admissao, colaborador.demissao, colaborador.status)}
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
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
                          <TableCell className="py-3">
                            <div className="text-sm text-muted-foreground font-mono" data-testid={`text-cpf-${colaborador.id}`}>
                              {colaborador.cpf || "-"}
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="text-sm text-muted-foreground font-mono" data-testid={`text-cnpj-${colaborador.id}`}>
                              {colaborador.cnpj || "-"}
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
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
                          <TableCell className="py-3">
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
                          <TableCell className="py-3">
                            <div className="text-sm text-muted-foreground" data-testid={`text-admissao-${colaborador.id}`}>
                              {formatDate(colaborador.admissao)}
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
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
                          <TableCell className="py-3">
                            <div className="flex flex-wrap gap-1" data-testid={`patrimonios-${colaborador.id}`}>
                              {colaborador.patrimonios && colaborador.patrimonios.length > 0 ? (
                                colaborador.patrimonios.map((p) => (
                                  <Link key={p.id} href={`/patrimonio/${p.id}`}>
                                    <Badge
                                      variant="outline"
                                      className="cursor-pointer hover:bg-primary/10"
                                      title={p.descricao || `Patrimônio #${p.numeroAtivo || p.id}`}
                                      data-testid={`badge-patrimonio-${p.id}`}
                                    >
                                      <Package className="w-3 h-3 mr-1" />
                                      {p.numeroAtivo || p.id}
                                    </Badge>
                                  </Link>
                                ))
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
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
                          <TableCell className="py-3">
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
                          <TableCell className="py-3 sticky right-0 bg-background">
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingColaborador(colaborador);
                                }}
                                data-testid={`button-edit-${colaborador.id}`}
                                title="Editar colaborador"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingColaborador(colaborador);
                                }}
                                data-testid={`button-delete-${colaborador.id}`}
                                title="Excluir colaborador"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <Card>
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">Itens por página:</span>
                    <Select
                      value={itemsPerPage.toString()}
                      onValueChange={(value) => {
                        setItemsPerPage(Number(value));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-[80px]" data-testid="select-items-per-page">
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

                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground" data-testid="text-pagination-info">
                      Mostrando {startIndex + 1}-{Math.min(endIndex, filteredColaboradores.length)} de {filteredColaboradores.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        data-testid="button-first-page"
                        title="Primeira página"
                      >
                        <ChevronsLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        data-testid="button-prev-page"
                        title="Página anterior"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <div className="px-3 py-1 text-sm font-medium">
                        {currentPage} / {totalPages}
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        data-testid="button-next-page"
                        title="Próxima página"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        data-testid="button-last-page"
                        title="Última página"
                      >
                        <ChevronsRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {editingColaborador && (
        <EditColaboradorDialog
          colaborador={editingColaborador}
          open={!!editingColaborador}
          onOpenChange={(open) => !open && setEditingColaborador(null)}
        />
      )}

      {deletingColaborador && (
        <DeleteConfirmDialog
          colaborador={deletingColaborador}
          open={!!deletingColaborador}
          onOpenChange={(open) => !open && setDeletingColaborador(null)}
        />
      )}
    </div>
  );
}
