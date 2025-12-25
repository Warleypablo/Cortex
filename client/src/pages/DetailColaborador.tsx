import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { usePageInfo } from "@/contexts/PageContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatDecimal } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SelectWithAdd } from "@/components/ui/select-with-add";
import { ArrowLeft, Pencil, Loader2, Mail, Phone, MapPin, Calendar, Briefcase, Award, CreditCard, Building2, Package, User, DollarSign, Plus, TrendingUp, UserCircle, ExternalLink, Search, MessageSquare, Target, BarChart2, FileText, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Colaborador, InsertColaborador, RhPromocao } from "@shared/schema";
import { insertColaboradorSchema } from "@shared/schema";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

// Map old nivel format (with "X " prefix) to new format (without prefix)
function mapNivelToNew(nivel: string | null): string {
  if (!nivel) return "";
  if (nivel.startsWith("X ")) {
    return nivel.substring(2);
  }
  return nivel;
}

interface PatrimonioItem {
  id: number;
  numeroAtivo: string | null;
  descricao: string | null;
  estadoConservacao: string | null;
  ativo: string | null;
  marca: string | null;
  valorMercado: string | null;
}

interface AvailablePatrimonio {
  id: number;
  numeroAtivo: string | null;
  ativo: string | null;
  marca: string | null;
  estadoConservacao: string | null;
  responsavelAtual: string | null;
  responsavelId: number | null;
  valorPago: string | null;
  valorMercado: string | null;
  descricao: string | null;
}

interface PromocaoItem {
  id: number;
  colaboradorId: number;
  dataPromocao: string | Date;
  cargoAnterior: string | null;
  cargoNovo: string | null;
  nivelAnterior: string | null;
  nivelNovo: string | null;
  salarioAnterior: string | null;
  salarioNovo: string | null;
  observacoes: string | null;
  criadoEm: string | Date | null;
  criadoPor: string | null;
}

interface LinkedUser {
  id: string;
  email: string;
  name: string;
  picture: string | null;
  role: string;
}

interface TelefoneItem {
  id: number;
  conta: string | null;
  planoOperadora: string | null;
  telefone: string;
  responsavelNome: string | null;
  responsavelId: number | null;
  setor: string | null;
  ultimaRecarga: string | null;
  status: string;
}

interface SystemUser {
  id: string;
  email: string;
  name: string;
  picture: string | null;
  role: string;
}

interface OneOnOneAcao {
  id: number;
  oneOnOneId: number;
  descricao: string;
  responsavel: string | null;
  prazo: string | null;
  status: string | null;
  concluidaEm: string | null;
}

interface OneOnOneItem {
  id: number;
  colaboradorId: number;
  gestorId: number | null;
  data: string;
  pauta: string | null;
  notas: string | null;
  criadoEm: string | null;
  criadoPor: string | null;
  acoes?: OneOnOneAcao[];
}

interface EnpsItem {
  id: number;
  colaboradorId: number;
  score: number;
  comentario: string | null;
  data: string;
  criadoEm: string | null;
  criadoPor: string | null;
}

interface PdiItem {
  id: number;
  colaboradorId: number;
  titulo: string;
  descricao: string | null;
  competencia: string | null;
  recursos: string | null;
  prazo: string | null;
  progresso: number;
  status: string | null;
  criadoEm: string | null;
  criadoPor: string | null;
  atualizadoEm: string | null;
}

type ColaboradorDetail = Colaborador & {
  patrimonios: PatrimonioItem[];
  promocoes?: PromocaoItem[];
  linkedUser?: LinkedUser | null;
  cidade?: string | null;
};

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

function formatDateFns(date: string | Date | null | undefined) {
  if (!date) return "-";
  try {
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "-";
  }
}

// Extract cidade from endereco field if cidade column is empty
function getCidadeFromEndereco(endereco: string | null, cidadeColumn: string | null): string {
  if (cidadeColumn) return cidadeColumn;
  if (!endereco) return "";
  // Try to extract city from address patterns like "..., CityName SP - ..." or "..., CityName - Neighborhood, ..."
  const patterns = [
    /,\s*([A-Za-zÀ-ú\s]+)\s+[A-Z]{2}\s*-/,  // "..., Votorantim SP - ..."
    /,\s*([A-Za-zÀ-ú\s]+)\s*-\s*[A-Za-zÀ-ú\s]+,/,  // "..., City - Neighborhood, ..."
  ];
  for (const pattern of patterns) {
    const match = endereco.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return "";
}

function formatCurrency(value: string | number | null | undefined) {
  if (!value) return "-";
  try {
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    return `R$ ${numValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  } catch {
    return "-";
  }
}

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

const addPromocaoSchema = z.object({
  dataPromocao: z.string().min(1, "Data é obrigatória"),
  salarioAnterior: z.string().optional(),
  salarioNovo: z.string().optional(),
  cargoAnterior: z.string().optional(),
  cargoNovo: z.string().optional(),
  nivelAnterior: z.string().optional(),
  nivelNovo: z.string().optional(),
  observacoes: z.string().optional(),
});

type AddPromocaoForm = z.infer<typeof addPromocaoSchema>;

function AddPromocaoDialog({ 
  colaborador, 
  open, 
  onOpenChange 
}: { 
  colaborador: ColaboradorDetail; 
  open: boolean; 
  onOpenChange: (open: boolean) => void 
}) {
  const { toast } = useToast();

  const { data: cargos = [] } = useQuery<CargoOption[]>({
    queryKey: ["/api/rh/cargos"],
  });

  const { data: niveis = [] } = useQuery<NivelOption[]>({
    queryKey: ["/api/rh/niveis"],
  });

  const form = useForm<AddPromocaoForm>({
    resolver: zodResolver(addPromocaoSchema),
    defaultValues: {
      dataPromocao: new Date().toISOString().split("T")[0],
      salarioAnterior: colaborador.salario || "",
      salarioNovo: "",
      cargoAnterior: colaborador.cargo || "",
      cargoNovo: "",
      nivelAnterior: colaborador.nivel || "",
      nivelNovo: "",
      observacoes: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        dataPromocao: new Date().toISOString().split("T")[0],
        salarioAnterior: colaborador.salario || "",
        salarioNovo: "",
        cargoAnterior: colaborador.cargo || "",
        cargoNovo: "",
        nivelAnterior: colaborador.nivel || "",
        nivelNovo: "",
        observacoes: "",
      });
    }
  }, [open, colaborador, form]);

  const addPromocaoMutation = useMutation({
    mutationFn: async (data: AddPromocaoForm) => {
      const response = await apiRequest("POST", `/api/colaboradores/${colaborador.id}/promocoes`, {
        dataPromocao: data.dataPromocao,
        salarioAnterior: data.salarioAnterior || null,
        salarioNovo: data.salarioNovo || null,
        cargoAnterior: data.cargoAnterior || null,
        cargoNovo: data.cargoNovo || null,
        nivelAnterior: data.nivelAnterior || null,
        nivelNovo: data.nivelNovo || null,
        observacoes: data.observacoes || null,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colaboradores", colaborador.id.toString()] });
      toast({
        title: "Promoção registrada",
        description: "O histórico de promoção foi adicionado com sucesso.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao registrar promoção",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AddPromocaoForm) => {
    addPromocaoMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Promoção</DialogTitle>
          <DialogDescription>
            Adicione um registro de promoção ou alteração para {colaborador.nome}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="dataPromocao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data da Promoção *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} data-testid="input-promocao-data" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="salarioAnterior"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salário Anterior</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00" 
                        {...field} 
                        data-testid="input-promocao-salario-anterior" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="salarioNovo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salário Novo</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00" 
                        {...field} 
                        data-testid="input-promocao-salario-novo" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cargoAnterior"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cargo Anterior</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="select-promocao-cargo-anterior">
                          <SelectValue placeholder="Selecione o cargo" />
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
                name="cargoNovo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cargo Novo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="select-promocao-cargo-novo">
                          <SelectValue placeholder="Selecione o cargo" />
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nivelAnterior"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nível Anterior</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="select-promocao-nivel-anterior">
                          <SelectValue placeholder="Selecione o nível" />
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
                name="nivelNovo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nível Novo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="select-promocao-nivel-novo">
                          <SelectValue placeholder="Selecione o nível" />
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
            </div>

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo / Observações</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Descreva o motivo da promoção ou observações relevantes..."
                      className="resize-none"
                      rows={3}
                      {...field} 
                      data-testid="textarea-promocao-observacoes" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-promocao-cancel"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={addPromocaoMutation.isPending}
                data-testid="button-promocao-submit"
              >
                {addPromocaoMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Registrar Promoção"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function AssignPatrimonioDialog({ 
  colaborador, 
  open, 
  onOpenChange 
}: { 
  colaborador: ColaboradorDetail; 
  open: boolean; 
  onOpenChange: (open: boolean) => void 
}) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: patrimonios = [], isLoading } = useQuery<AvailablePatrimonio[]>({
    queryKey: ["/api/patrimonio/disponiveis"],
    enabled: open,
  });

  const filteredPatrimonios = patrimonios.filter((p) => {
    const search = searchTerm.toLowerCase();
    return (
      (p.ativo?.toLowerCase().includes(search) || false) ||
      (p.marca?.toLowerCase().includes(search) || false) ||
      (p.numeroAtivo?.toLowerCase().includes(search) || false) ||
      (p.descricao?.toLowerCase().includes(search) || false)
    );
  });

  const assignMutation = useMutation({
    mutationFn: async (patrimonioId: number) => {
      try {
        const response = await apiRequest("PATCH", `/api/patrimonio/${patrimonioId}/atribuir`, {
          responsavelId: colaborador.id,
          responsavelNome: colaborador.nome,
        });
        return await response.json();
      } catch (err) {
        if (err instanceof Error) {
          throw err;
        }
        throw new Error("Falha ao atribuir patrimônio");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colaboradores", colaborador.id.toString()] });
      queryClient.invalidateQueries({ queryKey: ["/api/patrimonio/disponiveis"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patrimonio"] });
      toast({
        title: "Patrimônio atribuído",
        description: `O patrimônio foi atribuído a ${colaborador.nome} com sucesso.`,
      });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao atribuir patrimônio";
      toast({
        title: "Erro ao atribuir patrimônio",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleAssign = (patrimonioId: number) => {
    assignMutation.mutate(patrimonioId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Atribuir Patrimônio</DialogTitle>
          <DialogDescription>
            Selecione um patrimônio para atribuir a {colaborador.nome}
          </DialogDescription>
        </DialogHeader>
        
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por equipamento, marca ou número..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-patrimonio"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filteredPatrimonios.length > 0 ? (
          <div className="overflow-x-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Ativo</TableHead>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Responsável Atual</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPatrimonios.map((patrimonio) => (
                  <TableRow key={patrimonio.id} data-testid={`row-assign-patrimonio-${patrimonio.id}`}>
                    <TableCell className="font-mono" data-testid={`text-assign-numero-${patrimonio.id}`}>
                      {patrimonio.numeroAtivo || "-"}
                    </TableCell>
                    <TableCell data-testid={`text-assign-ativo-${patrimonio.id}`}>
                      {patrimonio.ativo || patrimonio.descricao || "-"}
                    </TableCell>
                    <TableCell data-testid={`text-assign-marca-${patrimonio.id}`}>
                      {patrimonio.marca || "-"}
                    </TableCell>
                    <TableCell>
                      {patrimonio.responsavelAtual ? (
                        <Badge variant="outline" data-testid={`badge-assign-responsavel-${patrimonio.id}`}>
                          {patrimonio.responsavelAtual}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">Disponível</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => handleAssign(patrimonio.id)}
                        disabled={assignMutation.isPending}
                        data-testid={`button-assign-patrimonio-${patrimonio.id}`}
                      >
                        {assignMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>Atribuir</>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground" data-testid="text-no-patrimonios-available">
            {searchTerm ? "Nenhum patrimônio encontrado com esse termo" : "Nenhum patrimônio disponível"}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-assign-cancel"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditColaboradorDialog({ colaborador, open, onOpenChange }: { colaborador: ColaboradorDetail; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

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

  const { data: systemUsers = [], isLoading: usersLoading } = useQuery<SystemUser[]>({
    queryKey: ["/api/admin/users"],
  });

  const editColaboradorSchema = insertColaboradorSchema.extend({
    demissao: z.string().optional(),
    tipoDemissao: z.string().optional(),
    ultimoAumento: z.string().optional(),
    cidade: z.string().optional(),
    userId: z.string().optional().nullable(),
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

  // Extract estado sigla from format "ES - Espírito Santo" to "ES"
  const getEstadoSigla = (estado: string | null): string => {
    if (!estado) return "";
    if (estado.includes(" - ")) {
      return estado.split(" - ")[0].trim();
    }
    return estado;
  };

  const form = useForm<InsertColaborador & { demissao?: string; tipoDemissao?: string; ultimoAumento?: string; cidade?: string; userId?: string | null }>({
    resolver: zodResolver(editColaboradorSchema),
    defaultValues: {
      nome: colaborador.nome || "",
      status: colaborador.status || "Ativo",
      cpf: colaborador.cpf || "",
      telefone: colaborador.telefone || "",
      emailTurbo: colaborador.emailTurbo || "",
      emailPessoal: colaborador.emailPessoal || "",
      cargo: colaborador.cargo || "",
      nivel: mapNivelToNew(colaborador.nivel),
      squad: colaborador.squad || "",
      setor: colaborador.setor || "",
      endereco: colaborador.endereco || "",
      estado: getEstadoSigla(colaborador.estado),
      cidade: getCidadeFromEndereco(colaborador.endereco, (colaborador as any).cidade),
      pix: colaborador.pix || "",
      cnpj: colaborador.cnpj || "",
      salario: colaborador.salario || "",
      aniversario: colaborador.aniversario ? new Date(colaborador.aniversario).toISOString().split('T')[0] : undefined,
      admissao: colaborador.admissao ? new Date(colaborador.admissao).toISOString().split('T')[0] : undefined,
      demissao: colaborador.demissao ? new Date(colaborador.demissao).toISOString().split('T')[0] : undefined,
      tipoDemissao: colaborador.tipoDemissao || "",
      ultimoAumento: colaborador.ultimoAumento ? new Date(colaborador.ultimoAumento).toISOString().split('T')[0] : undefined,
      userId: colaborador.userId || null,
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
    if (estado !== colaborador.estado) {
      form.setValue("cidade", "", { shouldValidate: false });
    }
  }, [estado, colaborador.estado, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: InsertColaborador & { userId?: string | null }) => {
      const response = await apiRequest("PATCH", `/api/colaboradores/${colaborador.id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colaboradores", colaborador.id.toString()] });
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

  const onSubmit = (data: InsertColaborador & { userId?: string | null }) => {
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

            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vincular Usuário do Sistema</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(value === "__none__" ? null : value)} 
                    value={field.value || "__none__"}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-user">
                        <SelectValue placeholder={usersLoading ? "Carregando..." : "Selecione um usuário"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhum usuário vinculado</SelectItem>
                      {systemUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.email})
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
                    <FormControl>
                      <SelectWithAdd
                        value={field.value || undefined}
                        onValueChange={field.onChange}
                        options={cargos}
                        isLoading={cargosLoading}
                        placeholder="Selecione o cargo"
                        isAdmin={isAdmin}
                        apiEndpoint="/api/rh/cargos"
                        queryKey={["/api/rh/cargos"]}
                        testIdPrefix="select-edit-cargo"
                      />
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
                      <SelectWithAdd
                        value={field.value || undefined}
                        onValueChange={field.onChange}
                        options={niveis}
                        isLoading={niveisLoading}
                        placeholder="Selecione o nível"
                        isAdmin={isAdmin}
                        apiEndpoint="/api/rh/niveis"
                        queryKey={["/api/rh/niveis"]}
                        testIdPrefix="select-edit-nivel"
                      />
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
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-setor">
                          <SelectValue placeholder="Selecione o setor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Commerce">Commerce</SelectItem>
                        <SelectItem value="Growth Interno">Growth Interno</SelectItem>
                        <SelectItem value="Tech Sites">Tech Sites</SelectItem>
                        <SelectItem value="Backoffice">Backoffice</SelectItem>
                        <SelectItem value="Sócios">Sócios</SelectItem>
                        <SelectItem value="Ventures">Ventures</SelectItem>
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
                name="squad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Squad</FormLabel>
                    <FormControl>
                      <SelectWithAdd
                        value={field.value || undefined}
                        onValueChange={field.onChange}
                        options={squads}
                        isLoading={squadsLoading}
                        placeholder="Selecione o squad"
                        isAdmin={isAdmin}
                        apiEndpoint="/api/rh/squads"
                        queryKey={["/api/rh/squads"]}
                        displayEmoji={true}
                        testIdPrefix="select-edit-squad"
                      />
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
                      <Input {...field} value={field.value || ""} data-testid="input-edit-pix" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="salario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salário</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        value={field.value || ""} 
                        data-testid="input-edit-salario" 
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                      />
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <FormField
                  control={form.control}
                  name="tipoDemissao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Demissão</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-tipo-demissao">
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Pediu Demissão">Pediu Demissão</SelectItem>
                          <SelectItem value="Demitido">Demitido</SelectItem>
                          <SelectItem value="Acordo">Acordo</SelectItem>
                          <SelectItem value="Término de Contrato">Término de Contrato</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <FormField
              control={form.control}
              name="ultimoAumento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Último Aumento</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ""}
                      data-testid="input-edit-ultimo-aumento"
                      type="date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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

interface InfoCardProps {
  icon: typeof User;
  label: string;
  value: string | null | undefined;
  iconBgColor?: string;
  iconColor?: string;
}

function InfoCard({ icon: Icon, label, value, iconBgColor = "bg-primary/10", iconColor = "text-primary" }: InfoCardProps) {
  return (
    <Card className="p-4 hover-elevate" data-testid={`info-card-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${iconBgColor}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="font-semibold text-foreground truncate text-lg">{value || "-"}</p>
        </div>
      </div>
    </Card>
  );
}

function getEnpsCategory(score: number): { label: string; color: string; bgColor: string } {
  if (score >= 9) return { label: "Promotor", color: "text-green-600 dark:text-green-400", bgColor: "bg-green-100 dark:bg-green-900/30" };
  if (score >= 7) return { label: "Neutro", color: "text-yellow-600 dark:text-yellow-400", bgColor: "bg-yellow-100 dark:bg-yellow-900/30" };
  return { label: "Detrator", color: "text-red-600 dark:text-red-400", bgColor: "bg-red-100 dark:bg-red-900/30" };
}

function OneOnOneCard({ colaboradorId }: { colaboradorId: string }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addAcaoDialogOpen, setAddAcaoDialogOpen] = useState(false);
  const [selectedOneOnOneId, setSelectedOneOnOneId] = useState<number | null>(null);
  const [expandedMeetings, setExpandedMeetings] = useState<Set<number>>(new Set());
  const [formData, setFormData] = useState({ data: new Date().toISOString().split("T")[0], pauta: "", notas: "" });
  const [acaoFormData, setAcaoFormData] = useState({ descricao: "", responsavel: "", prazo: "" });

  const { data: oneOnOnes = [], isLoading } = useQuery<OneOnOneItem[]>({
    queryKey: ["/api/colaboradores", colaboradorId, "one-on-one"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: { data: string; pauta: string; notas: string }) => {
      const response = await apiRequest("POST", `/api/colaboradores/${colaboradorId}/one-on-one`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colaboradores", colaboradorId, "one-on-one"] });
      toast({ title: "1x1 registrado", description: "A reunião foi adicionada com sucesso." });
      setDialogOpen(false);
      setFormData({ data: new Date().toISOString().split("T")[0], pauta: "", notas: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao registrar 1x1", description: error.message, variant: "destructive" });
    },
  });

  const addAcaoMutation = useMutation({
    mutationFn: async (data: { descricao: string; responsavel: string; prazo: string }) => {
      const response = await apiRequest("POST", `/api/one-on-one/${selectedOneOnOneId}/acoes`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colaboradores", colaboradorId, "one-on-one"] });
      toast({ title: "Ação adicionada", description: "A ação foi registrada com sucesso." });
      setAddAcaoDialogOpen(false);
      setAcaoFormData({ descricao: "", responsavel: "", prazo: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao adicionar ação", description: error.message, variant: "destructive" });
    },
  });

  const toggleAcaoMutation = useMutation({
    mutationFn: async ({ acaoId, status }: { acaoId: number; status: string }) => {
      const response = await apiRequest("PATCH", `/api/one-on-one/acoes/${acaoId}`, { status });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colaboradores", colaboradorId, "one-on-one"] });
      toast({ title: "Ação atualizada", description: "Status da ação foi alterado." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar ação", description: error.message, variant: "destructive" });
    },
  });

  const toggleMeeting = (id: number) => {
    setExpandedMeetings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  return (
    <Card className="p-6" data-testid="card-1x1">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <MessageSquare className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="text-lg font-semibold">Reuniões 1x1</h3>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)} data-testid="button-add-1x1">
          <Plus className="w-4 h-4 mr-1" /> Nova
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : oneOnOnes.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-6">Nenhuma reunião 1x1 registrada</p>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {oneOnOnes.map((meeting) => (
            <Collapsible key={meeting.id} open={expandedMeetings.has(meeting.id)} onOpenChange={() => toggleMeeting(meeting.id)}>
              <div className="border rounded-lg p-3" data-testid={`meeting-${meeting.id}`}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center justify-between w-full text-left">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{formatDateFns(meeting.data)}</span>
                      {meeting.acoes && meeting.acoes.length > 0 && (
                        <Badge variant="secondary" className="text-xs">{meeting.acoes.length} ações</Badge>
                      )}
                    </div>
                    {expandedMeetings.has(meeting.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-3">
                  {meeting.pauta && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase mb-1">Pauta</p>
                      <p className="text-sm">{meeting.pauta}</p>
                    </div>
                  )}
                  {meeting.notas && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase mb-1">Notas</p>
                      <p className="text-sm whitespace-pre-wrap">{meeting.notas}</p>
                    </div>
                  )}
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground uppercase">Ações</p>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => { setSelectedOneOnOneId(meeting.id); setAddAcaoDialogOpen(true); }}
                        data-testid={`button-add-acao-${meeting.id}`}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Ação
                      </Button>
                    </div>
                    {meeting.acoes && meeting.acoes.length > 0 ? (
                      <div className="space-y-2">
                        {meeting.acoes.map((acao) => (
                          <div key={acao.id} className="flex items-start gap-2 text-sm" data-testid={`acao-${acao.id}`}>
                            <button
                              onClick={() => toggleAcaoMutation.mutate({ acaoId: acao.id, status: acao.status === "concluida" ? "pendente" : "concluida" })}
                              className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${acao.status === "concluida" ? "bg-green-500 border-green-500 text-white" : "border-muted-foreground"}`}
                              data-testid={`toggle-acao-${acao.id}`}
                            >
                              {acao.status === "concluida" && <Check className="w-3 h-3" />}
                            </button>
                            <span className={acao.status === "concluida" ? "line-through text-muted-foreground" : ""}>{acao.descricao}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhuma ação registrada</p>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Reunião 1x1</DialogTitle>
            <DialogDescription>Registre uma nova reunião one-on-one</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Data *</label>
              <Input type="date" value={formData.data} onChange={(e) => setFormData({ ...formData, data: e.target.value })} data-testid="input-1x1-data" />
            </div>
            <div>
              <label className="text-sm font-medium">Pauta</label>
              <Textarea value={formData.pauta} onChange={(e) => setFormData({ ...formData, pauta: e.target.value })} placeholder="Tópicos a serem discutidos..." data-testid="input-1x1-pauta" />
            </div>
            <div>
              <label className="text-sm font-medium">Notas</label>
              <Textarea value={formData.notas} onChange={(e) => setFormData({ ...formData, notas: e.target.value })} placeholder="Anotações da reunião..." rows={4} data-testid="input-1x1-notas" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => addMutation.mutate(formData)} disabled={addMutation.isPending || !formData.data} data-testid="button-save-1x1">
              {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addAcaoDialogOpen} onOpenChange={setAddAcaoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Ação</DialogTitle>
            <DialogDescription>Adicione uma ação para esta reunião</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Descrição *</label>
              <Input value={acaoFormData.descricao} onChange={(e) => setAcaoFormData({ ...acaoFormData, descricao: e.target.value })} placeholder="O que precisa ser feito..." data-testid="input-acao-descricao" />
            </div>
            <div>
              <label className="text-sm font-medium">Responsável</label>
              <Input value={acaoFormData.responsavel} onChange={(e) => setAcaoFormData({ ...acaoFormData, responsavel: e.target.value })} placeholder="Quem é responsável..." data-testid="input-acao-responsavel" />
            </div>
            <div>
              <label className="text-sm font-medium">Prazo</label>
              <Input type="date" value={acaoFormData.prazo} onChange={(e) => setAcaoFormData({ ...acaoFormData, prazo: e.target.value })} data-testid="input-acao-prazo" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAcaoDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => addAcaoMutation.mutate(acaoFormData)} disabled={addAcaoMutation.isPending || !acaoFormData.descricao} data-testid="button-save-acao">
              {addAcaoMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function EnpsCard({ colaboradorId }: { colaboradorId: string }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");

  const { data: enpsResponses = [], isLoading } = useQuery<EnpsItem[]>({
    queryKey: ["/api/colaboradores", colaboradorId, "enps"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: { score: number; comentario: string; data: string }) => {
      const response = await apiRequest("POST", `/api/colaboradores/${colaboradorId}/enps`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colaboradores", colaboradorId, "enps"] });
      toast({ title: "e-NPS registrado", description: "A resposta foi adicionada com sucesso." });
      setDialogOpen(false);
      setSelectedScore(null);
      setComentario("");
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao registrar e-NPS", description: error.message, variant: "destructive" });
    },
  });

  const lastResponse = enpsResponses.length > 0 ? enpsResponses[0] : null;
  const category = lastResponse ? getEnpsCategory(lastResponse.score) : null;

  return (
    <Card className="p-6" data-testid="card-enps">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <BarChart2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold">e-NPS</h3>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)} data-testid="button-add-enps">
          <Plus className="w-4 h-4 mr-1" /> Nova
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : lastResponse ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className={`text-4xl font-bold ${category?.color}`}>{lastResponse.score}</div>
            <div>
              <Badge className={category?.bgColor}>{category?.label}</Badge>
              <p className="text-xs text-muted-foreground mt-1">{formatDateFns(lastResponse.data)}</p>
            </div>
          </div>
          {lastResponse.comentario && (
            <p className="text-sm text-muted-foreground italic">"{lastResponse.comentario}"</p>
          )}
          {enpsResponses.length > 1 && (
            <div className="pt-3 border-t">
              <p className="text-xs text-muted-foreground uppercase mb-2">Histórico ({enpsResponses.length} respostas)</p>
              <div className="flex items-end gap-1 h-12">
                {enpsResponses.slice(0, 12).reverse().map((resp, idx) => {
                  const cat = getEnpsCategory(resp.score);
                  const height = (resp.score + 1) * 10;
                  return (
                    <div 
                      key={resp.id} 
                      className={`w-4 rounded-t ${cat.bgColor}`} 
                      style={{ height: `${height}%` }}
                      title={`${resp.score} - ${formatDateFns(resp.data)}`}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm text-center py-6">Nenhuma resposta e-NPS registrada</p>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Resposta e-NPS</DialogTitle>
            <DialogDescription>Em uma escala de 0 a 10, quanto você recomendaria a Turbo como lugar para trabalhar?</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 justify-center">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => {
                const cat = getEnpsCategory(score);
                return (
                  <button
                    key={score}
                    onClick={() => setSelectedScore(score)}
                    className={`w-10 h-10 rounded-lg font-bold transition-all ${selectedScore === score ? `${cat.bgColor} ${cat.color} ring-2 ring-offset-2` : "bg-muted hover:bg-muted/80"}`}
                    data-testid={`button-score-${score}`}
                  >
                    {score}
                  </button>
                );
              })}
            </div>
            <div>
              <label className="text-sm font-medium">Comentário (opcional)</label>
              <Textarea 
                value={comentario} 
                onChange={(e) => setComentario(e.target.value)} 
                placeholder="Conte-nos mais sobre sua experiência..." 
                rows={3}
                data-testid="input-enps-comentario" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button 
              onClick={() => addMutation.mutate({ score: selectedScore!, comentario, data: new Date().toISOString().split("T")[0] })} 
              disabled={addMutation.isPending || selectedScore === null} 
              data-testid="button-save-enps"
            >
              {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function PdiCard({ colaboradorId }: { colaboradorId: string }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPdi, setEditingPdi] = useState<PdiItem | null>(null);
  const [formData, setFormData] = useState({ titulo: "", descricao: "", competencia: "", recursos: "", prazo: "" });

  const { data: pdiGoals = [], isLoading } = useQuery<PdiItem[]>({
    queryKey: ["/api/colaboradores", colaboradorId, "pdi"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: { titulo: string; descricao: string; competencia: string; recursos: string; prazo: string }) => {
      const response = await apiRequest("POST", `/api/colaboradores/${colaboradorId}/pdi`, { ...data, colaboradorId: Number(colaboradorId) });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colaboradores", colaboradorId, "pdi"] });
      toast({ title: "Objetivo adicionado", description: "O objetivo PDI foi criado com sucesso." });
      setDialogOpen(false);
      setFormData({ titulo: "", descricao: "", competencia: "", recursos: "", prazo: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar objetivo", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; progresso?: number; status?: string }) => {
      const response = await apiRequest("PUT", `/api/colaboradores/${colaboradorId}/pdi/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colaboradores", colaboradorId, "pdi"] });
      toast({ title: "Objetivo atualizado", description: "O progresso foi salvo." });
      setEditingPdi(null);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "concluido": return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Concluído</Badge>;
      case "pausado": return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Pausado</Badge>;
      case "cancelado": return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Cancelado</Badge>;
      default: return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Em Andamento</Badge>;
    }
  };

  return (
    <Card className="p-6" data-testid="card-pdi">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
            <Target className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-semibold">PDI</h3>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)} data-testid="button-add-pdi">
          <Plus className="w-4 h-4 mr-1" /> Novo
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : pdiGoals.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-6">Nenhum objetivo PDI registrado</p>
      ) : (
        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {pdiGoals.map((pdi) => (
            <div key={pdi.id} className="border rounded-lg p-4 space-y-3" data-testid={`pdi-${pdi.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h4 className="font-medium">{pdi.titulo}</h4>
                  {pdi.competencia && <p className="text-xs text-muted-foreground">{pdi.competencia}</p>}
                </div>
                {getStatusBadge(pdi.status)}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>Progresso</span>
                  <span className="font-medium">{pdi.progresso}%</span>
                </div>
                <Progress value={pdi.progresso} className="h-2" />
              </div>
              {pdi.prazo && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Prazo: {formatDateFns(pdi.prazo)}
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setEditingPdi(pdi)}
                  data-testid={`button-edit-pdi-${pdi.id}`}
                >
                  Atualizar Progresso
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Objetivo PDI</DialogTitle>
            <DialogDescription>Adicione um objetivo de desenvolvimento individual</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Título *</label>
              <Input value={formData.titulo} onChange={(e) => setFormData({ ...formData, titulo: e.target.value })} placeholder="Ex: Desenvolver habilidades de liderança" data-testid="input-pdi-titulo" />
            </div>
            <div>
              <label className="text-sm font-medium">Descrição</label>
              <Textarea value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} placeholder="Descreva o objetivo em detalhes..." data-testid="input-pdi-descricao" />
            </div>
            <div>
              <label className="text-sm font-medium">Competência</label>
              <Input value={formData.competencia} onChange={(e) => setFormData({ ...formData, competencia: e.target.value })} placeholder="Ex: Liderança, Comunicação, Técnico" data-testid="input-pdi-competencia" />
            </div>
            <div>
              <label className="text-sm font-medium">Recursos</label>
              <Textarea value={formData.recursos} onChange={(e) => setFormData({ ...formData, recursos: e.target.value })} placeholder="Cursos, mentoria, livros..." data-testid="input-pdi-recursos" />
            </div>
            <div>
              <label className="text-sm font-medium">Prazo</label>
              <Input type="date" value={formData.prazo} onChange={(e) => setFormData({ ...formData, prazo: e.target.value })} data-testid="input-pdi-prazo" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => addMutation.mutate(formData)} disabled={addMutation.isPending || !formData.titulo} data-testid="button-save-pdi">
              {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar Objetivo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingPdi} onOpenChange={(open) => !open && setEditingPdi(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar Progresso</DialogTitle>
            <DialogDescription>{editingPdi?.titulo}</DialogDescription>
          </DialogHeader>
          {editingPdi && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Progresso: {editingPdi.progresso}%</label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  step="5"
                  value={editingPdi.progresso} 
                  onChange={(e) => setEditingPdi({ ...editingPdi, progresso: Number(e.target.value) })}
                  className="w-full mt-2"
                  data-testid="slider-pdi-progresso"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select value={editingPdi.status || "em_andamento"} onValueChange={(v) => setEditingPdi({ ...editingPdi, status: v })}>
                  <SelectTrigger data-testid="select-pdi-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                    <SelectItem value="pausado">Pausado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPdi(null)}>Cancelar</Button>
            <Button 
              onClick={() => editingPdi && updateMutation.mutate({ id: editingPdi.id, progresso: editingPdi.progresso, status: editingPdi.status || "em_andamento" })} 
              disabled={updateMutation.isPending}
              data-testid="button-update-pdi"
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function DetailColaborador() {
  const { setPageInfo } = usePageInfo();
  const [, params] = useRoute("/colaborador/:id");
  const colaboradorId = params?.id || "";
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addPromocaoDialogOpen, setAddPromocaoDialogOpen] = useState(false);
  const [assignPatrimonioDialogOpen, setAssignPatrimonioDialogOpen] = useState(false);

  const { data: colaborador, isLoading, error } = useQuery<ColaboradorDetail>({
    queryKey: ["/api/colaboradores", colaboradorId],
    enabled: !!colaboradorId,
  });

  // Fetch user photos for profile picture fallback
  const { data: userPhotos = {} } = useQuery<Record<string, string>>({
    queryKey: ["/api/user-photos"],
  });

  // Fetch all telefones and filter by colaboradorId
  const { data: allTelefones = [] } = useQuery<TelefoneItem[]>({
    queryKey: ["/api/telefones"],
  });

  // Filter telefones that belong to this colaborador
  const colaboradorTelefones = allTelefones.filter(
    (t) => t.responsavelId === Number(colaboradorId) && t.status === "Ativo"
  );

  // Get photo from linkedUser or userPhotos by emailTurbo
  const getColaboradorPhoto = () => {
    if (colaborador?.linkedUser?.picture) {
      return colaborador.linkedUser.picture;
    }
    if (colaborador?.emailTurbo) {
      const email = colaborador.emailTurbo.toLowerCase().trim();
      if (userPhotos[email]) {
        return userPhotos[email];
      }
    }
    return null;
  };

  useEffect(() => {
    if (colaborador?.nome) {
      setPageInfo(colaborador.nome, `${colaborador.cargo || "Colaborador"} • ${colaborador.squad || "Sem squad"}`);
    } else {
      setPageInfo("Detalhes do Colaborador", "Carregando...");
    }
  }, [colaborador, setPageInfo]);

  if (isLoading) {
    return (
      <div className="bg-background">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loading-colaborador" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !colaborador) {
    return (
      <div className="bg-background">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <Card className="p-8">
            <div className="text-center">
              <p className="text-destructive font-semibold mb-2">Colaborador não encontrado</p>
              <p className="text-sm text-muted-foreground">
                {error instanceof Error ? error.message : "O colaborador solicitado não existe"}
              </p>
              <Link href="/colaboradores">
                <Button variant="default" className="mt-4" data-testid="button-back-to-list">
                  Voltar para colaboradores
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const getStatusBadgeVariant = (status: string | null) => {
    switch (status) {
      case "Ativo":
        return "default";
      case "Inativo":
        return "secondary";
      case "Dispensado":
        return "destructive";
      default:
        return "outline";
    }
  };

  const calcularMesesDeTurbo = (): string => {
    if (!colaborador.admissao) return "-";
    const admissaoDate = new Date(colaborador.admissao);
    admissaoDate.setHours(0, 0, 0, 0);
    let endDate: Date;
    if (colaborador.status === "Dispensado" && colaborador.demissao) {
      endDate = new Date(colaborador.demissao);
    } else {
      endDate = new Date();
    }
    endDate.setHours(0, 0, 0, 0);
    const diffTime = endDate.getTime() - admissaoDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const diffMonths = diffDays / 30;
    return diffMonths > 0 ? formatDecimal(diffMonths, 1) : "0";
  };

  const calcularMesesDesdeUltimoAumento = (): string => {
    if (!colaborador.ultimoAumento) return "-";
    try {
      const ultimoAumentoDate = new Date(colaborador.ultimoAumento);
      ultimoAumentoDate.setHours(0, 0, 0, 0);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const diffTime = hoje.getTime() - ultimoAumentoDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const diffMonths = diffDays / 30;
      return diffMonths > 0 ? formatDecimal(diffMonths, 1) : "0";
    } catch {
      return "-";
    }
  };

  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Link href="/colaboradores">
          <Button variant="ghost" size="sm" className="hover-elevate -ml-2 mb-4" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para colaboradores
          </Button>
        </Link>

        <Card className="mb-8 overflow-hidden" data-testid="card-header">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent dark:from-primary/20 dark:via-primary/10 dark:to-transparent p-6">
            <div className="flex items-start justify-between flex-wrap gap-6">
              <div className="flex items-center gap-5">
                <Avatar className="w-20 h-20 ring-4 ring-background shadow-lg">
                  {getColaboradorPhoto() ? (
                    <AvatarImage src={getColaboradorPhoto()!} alt={colaborador.nome} />
                  ) : null}
                  <AvatarFallback className="text-2xl bg-primary/20 text-primary font-bold">{getInitials(colaborador.nome)}</AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-foreground" data-testid="text-colaborador-nome">
                      {colaborador.nome}
                    </h1>
                    <Badge 
                      variant={getStatusBadgeVariant(colaborador.status)} 
                      className="px-3 py-1 text-sm font-medium"
                      data-testid="badge-status-header"
                    >
                      {colaborador.status || "Desconhecido"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {colaborador.cargo && (
                      <span className="flex items-center gap-1.5" data-testid="text-colaborador-cargo">
                        <Briefcase className="w-4 h-4" />
                        {colaborador.cargo}
                      </span>
                    )}
                    {colaborador.cargo && colaborador.nivel && <span className="text-border">•</span>}
                    {colaborador.nivel && (
                      <span className="flex items-center gap-1.5" data-testid="text-colaborador-nivel">
                        <Award className="w-4 h-4" />
                        {mapNivelToNew(colaborador.nivel)}
                      </span>
                    )}
                  </div>
                  {colaborador.squad && (
                    <Badge
                      variant="secondary"
                      className={`mt-1 ${squadColors[colaborador.squad] || ""}`}
                      data-testid="badge-header-squad"
                    >
                      {colaborador.squad}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={() => setEditDialogOpen(true)} data-testid="button-edit-colaborador">
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Tabs defaultValue="informacoes" className="mb-8" data-testid="tabs-colaborador">
          <TabsList className="mb-6" data-testid="tabs-list">
            <TabsTrigger value="informacoes" className="gap-2" data-testid="tab-informacoes">
              <User className="w-4 h-4" />
              Informações
            </TabsTrigger>
            <TabsTrigger value="desenvolvimento" className="gap-2" data-testid="tab-desenvolvimento">
              <TrendingUp className="w-4 h-4" />
              Desenvolvimento
            </TabsTrigger>
          </TabsList>

          <TabsContent value="informacoes" data-testid="tab-content-informacoes">
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8" data-testid="info-cards-grid">
          <InfoCard 
            icon={Calendar} 
            label="Meses de Turbo" 
            value={calcularMesesDeTurbo()}
            iconBgColor="bg-orange-100 dark:bg-orange-900/30"
            iconColor="text-orange-600 dark:text-orange-400"
          />
          <InfoCard 
            icon={Building2} 
            label="Setor" 
            value={colaborador.setor}
            iconBgColor="bg-blue-100 dark:bg-blue-900/30"
            iconColor="text-blue-600 dark:text-blue-400"
          />
          <InfoCard 
            icon={Briefcase} 
            label="Squad" 
            value={colaborador.squad}
            iconBgColor="bg-purple-100 dark:bg-purple-900/30"
            iconColor="text-purple-600 dark:text-purple-400"
          />
          <InfoCard 
            icon={Award} 
            label="Cargo" 
            value={colaborador.cargo}
            iconBgColor="bg-green-100 dark:bg-green-900/30"
            iconColor="text-green-600 dark:text-green-400"
          />
          <InfoCard 
            icon={TrendingUp} 
            label="Nível" 
            value={mapNivelToNew(colaborador.nivel)}
            iconBgColor="bg-teal-100 dark:bg-teal-900/30"
            iconColor="text-teal-600 dark:text-teal-400"
          />
          <InfoCard 
            icon={DollarSign} 
            label="Salário" 
            value={colaborador.salario ? `R$ ${Math.floor(parseFloat(colaborador.salario)).toLocaleString('pt-BR')}` : null}
            iconBgColor="bg-emerald-100 dark:bg-emerald-900/30"
            iconColor="text-emerald-600 dark:text-emerald-400"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="p-6 hover-elevate" data-testid="card-personal-info">
            <h2 className="text-lg font-semibold mb-5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              Informações Pessoais
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-border/50">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Nome</p>
                  <p className="font-semibold text-foreground" data-testid="text-info-nome">{colaborador.nome}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">CPF</p>
                  <p className="font-semibold font-mono text-foreground" data-testid="text-info-cpf">{colaborador.cpf || "-"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-border/50">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Telefone</p>
                  <p className="font-semibold flex items-center gap-2 text-foreground" data-testid="text-info-telefone">
                    {colaborador.telefone && <Phone className="w-4 h-4 text-green-500" />}
                    {colaborador.telefone || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Aniversário</p>
                  <p className="font-semibold flex items-center gap-2 text-foreground" data-testid="text-info-aniversario">
                    <Calendar className="w-4 h-4 text-pink-500" />
                    {formatDate(colaborador.aniversario)}
                  </p>
                </div>
              </div>
              <div className="pb-4 border-b border-border/50">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Email Turbo</p>
                <p className="font-semibold flex items-center gap-2 text-foreground" data-testid="text-info-email-turbo">
                  <Mail className="w-4 h-4 text-primary" />
                  {colaborador.emailTurbo || "-"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-border/50">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Email Pessoal</p>
                  <p className="font-semibold flex items-center gap-2 text-foreground" data-testid="text-info-email-pessoal">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    {colaborador.emailPessoal || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">PIX</p>
                  <p className="font-semibold flex items-center gap-2 truncate text-foreground" title={colaborador.pix || undefined} data-testid="text-info-pix">
                    <CreditCard className="w-4 h-4 text-violet-500" />
                    {colaborador.pix || "-"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-border/50">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Estado</p>
                  <p className="font-semibold flex items-center gap-2 text-foreground" data-testid="text-info-estado">
                    <MapPin className="w-4 h-4 text-red-500" />
                    {colaborador.estado || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Cidade</p>
                  <p className="font-semibold flex items-center gap-2 text-foreground" data-testid="text-info-cidade">
                    <MapPin className="w-4 h-4 text-orange-500" />
                    {getCidadeFromEndereco(colaborador.endereco, (colaborador as any).cidade) || "-"}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Endereço</p>
                <p className="font-semibold flex items-center gap-2 text-foreground" data-testid="text-info-endereco">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  {colaborador.endereco || "-"}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 hover-elevate" data-testid="card-professional-info">
            <h2 className="text-lg font-semibold mb-5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <Briefcase className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              Informações Profissionais
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-border/50">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Cargo</p>
                  <p className="font-semibold text-foreground" data-testid="text-prof-cargo">{colaborador.cargo || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Nível</p>
                  <p className="font-semibold text-foreground" data-testid="text-prof-nivel">{mapNivelToNew(colaborador.nivel) || "-"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-border/50">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Setor</p>
                  <p className="font-semibold text-foreground" data-testid="text-prof-setor">{colaborador.setor || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Squad</p>
                  {colaborador.squad ? (
                    <Badge
                      variant="secondary"
                      className={squadColors[colaborador.squad] || ""}
                      data-testid="badge-prof-squad"
                    >
                      {colaborador.squad}
                    </Badge>
                  ) : (
                    <p className="font-semibold text-foreground">-</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-border/50">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Admissão</p>
                  <p className="font-semibold flex items-center gap-2 text-foreground" data-testid="text-prof-admissao">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    {formatDate(colaborador.admissao)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Meses de Turbo</p>
                  <p className="font-semibold text-foreground" data-testid="text-prof-meses-turbo">
                    <span className="text-primary font-bold">{calcularMesesDeTurbo()}</span>
                  </p>
                </div>
              </div>
              {colaborador.demissao && (
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-border/50">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Demissão</p>
                    <p className="font-semibold flex items-center gap-2 text-destructive" data-testid="text-prof-demissao">
                      <Calendar className="w-4 h-4" />
                      {formatDate(colaborador.demissao)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Tipo Demissão</p>
                    <p className="font-semibold text-foreground" data-testid="text-prof-tipo-demissao">{colaborador.tipoDemissao || "-"}</p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-4 pb-4 border-b border-border/50">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Salário</p>
                  <p className="font-semibold flex items-center gap-2 text-green-600 dark:text-green-400" data-testid="text-prof-salario">
                    <DollarSign className="w-4 h-4" />
                    {colaborador.salario ? `R$ ${parseFloat(colaborador.salario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Último Aumento</p>
                  <p className="font-semibold flex items-center gap-2 text-foreground" data-testid="text-prof-ultimo-aumento">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    {formatDate(colaborador.ultimoAumento)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Meses Sem Aumento</p>
                  <p className="font-semibold text-foreground" data-testid="text-prof-meses-sem-aumento">
                    <span className="text-primary font-bold">{calcularMesesDesdeUltimoAumento()}</span>
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">CNPJ</p>
                <p className="font-semibold font-mono text-foreground flex items-center gap-2" data-testid="text-prof-cnpj">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  {colaborador.cnpj || "-"}
                </p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6 mb-8 hover-elevate" data-testid="card-promocoes">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <h2 className="text-lg font-semibold flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              Histórico de Promoções
            </h2>
            <Button 
              size="sm" 
              onClick={() => setAddPromocaoDialogOpen(true)}
              data-testid="button-add-promocao"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Promoção
            </Button>
          </div>
          {colaborador.promocoes && colaborador.promocoes.length > 0 ? (
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Data</TableHead>
                    <TableHead className="font-semibold">Salário Anterior</TableHead>
                    <TableHead className="font-semibold">Salário Novo</TableHead>
                    <TableHead className="font-semibold">Cargo Anterior</TableHead>
                    <TableHead className="font-semibold">Cargo Novo</TableHead>
                    <TableHead className="font-semibold">Nível Anterior</TableHead>
                    <TableHead className="font-semibold">Nível Novo</TableHead>
                    <TableHead className="font-semibold">Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {colaborador.promocoes.map((promocao, index) => (
                    <TableRow key={promocao.id} data-testid={`row-promocao-${promocao.id}`}>
                      <TableCell data-testid={`text-promocao-data-${promocao.id}`}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                          <span className="font-medium">{formatDateFns(promocao.dataPromocao)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground" data-testid={`text-promocao-salario-anterior-${promocao.id}`}>
                        {formatCurrency(promocao.salarioAnterior)}
                      </TableCell>
                      <TableCell data-testid={`text-promocao-salario-novo-${promocao.id}`}>
                        <span className="font-mono font-semibold text-green-600 dark:text-green-400">
                          {formatCurrency(promocao.salarioNovo)}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground" data-testid={`text-promocao-cargo-anterior-${promocao.id}`}>
                        {promocao.cargoAnterior || "-"}
                      </TableCell>
                      <TableCell className="font-medium" data-testid={`text-promocao-cargo-novo-${promocao.id}`}>
                        {promocao.cargoNovo || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground" data-testid={`text-promocao-nivel-anterior-${promocao.id}`}>
                        {promocao.nivelAnterior || "-"}
                      </TableCell>
                      <TableCell className="font-medium" data-testid={`text-promocao-nivel-novo-${promocao.id}`}>
                        {promocao.nivelNovo || "-"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={promocao.observacoes || undefined} data-testid={`text-promocao-observacoes-${promocao.id}`}>
                        {promocao.observacoes || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12" data-testid="text-no-promocoes">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <TrendingUp className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground font-medium mb-1">Nenhum histórico de promoção</p>
              <p className="text-sm text-muted-foreground/80">Clique em "Adicionar Promoção" para registrar uma nova promoção</p>
            </div>
          )}
        </Card>

        <Card className="p-6 mb-8 hover-elevate" data-testid="card-patrimonios">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <h2 className="text-lg font-semibold flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                <Package className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              Ativos / Patrimônios
            </h2>
            <Button 
              size="sm" 
              onClick={() => setAssignPatrimonioDialogOpen(true)}
              data-testid="button-add-patrimonio"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Patrimônio
            </Button>
          </div>
          {colaborador.patrimonios && colaborador.patrimonios.length > 0 ? (
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">ID</TableHead>
                    <TableHead className="font-semibold">Número Ativo</TableHead>
                    <TableHead className="font-semibold">Equipamento</TableHead>
                    <TableHead className="font-semibold">Marca</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {colaborador.patrimonios.map((patrimonio) => (
                    <TableRow key={patrimonio.id} data-testid={`row-patrimonio-${patrimonio.id}`}>
                      <TableCell className="font-mono text-muted-foreground" data-testid={`text-patrimonio-id-${patrimonio.id}`}>
                        #{patrimonio.id}
                      </TableCell>
                      <TableCell className="font-mono font-medium" data-testid={`text-patrimonio-numero-${patrimonio.id}`}>
                        {patrimonio.numeroAtivo || "-"}
                      </TableCell>
                      <TableCell className="font-medium" data-testid={`text-patrimonio-ativo-${patrimonio.id}`}>
                        {patrimonio.ativo || patrimonio.descricao || "-"}
                      </TableCell>
                      <TableCell data-testid={`text-patrimonio-marca-${patrimonio.id}`}>
                        {patrimonio.marca || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" data-testid={`badge-patrimonio-status-${patrimonio.id}`}>
                          {patrimonio.estadoConservacao || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link href={`/patrimonio/${patrimonio.id}`}>
                          <Button variant="ghost" size="sm" data-testid={`button-view-patrimonio-${patrimonio.id}`}>
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Ver detalhes
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12" data-testid="text-no-patrimonios">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <Package className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground font-medium mb-1">Nenhum patrimônio atribuído</p>
              <p className="text-sm text-muted-foreground/80">Clique em "Adicionar Patrimônio" para atribuir equipamentos a este colaborador</p>
            </div>
          )}
        </Card>

        <Card className="p-6 mb-8 hover-elevate" data-testid="card-telefones">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <h2 className="text-lg font-semibold flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/30">
                <Phone className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              </div>
              Linhas Telefônicas
            </h2>
          </div>
          {colaboradorTelefones.length > 0 ? (
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Telefone</TableHead>
                    <TableHead className="font-semibold">Plano/Operadora</TableHead>
                    <TableHead className="font-semibold">Setor</TableHead>
                    <TableHead className="font-semibold">Conta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {colaboradorTelefones.map((telefone) => (
                    <TableRow key={telefone.id} data-testid={`row-telefone-${telefone.id}`}>
                      <TableCell className="font-medium" data-testid={`text-telefone-numero-${telefone.id}`}>
                        {telefone.telefone}
                      </TableCell>
                      <TableCell data-testid={`text-telefone-plano-${telefone.id}`}>
                        {telefone.planoOperadora || "-"}
                      </TableCell>
                      <TableCell data-testid={`text-telefone-setor-${telefone.id}`}>
                        {telefone.setor || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground" data-testid={`text-telefone-conta-${telefone.id}`}>
                        {telefone.conta || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12" data-testid="text-no-telefones">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <Phone className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground font-medium mb-1">Nenhuma linha telefônica ativa</p>
              <p className="text-sm text-muted-foreground/80">Este colaborador não possui linhas telefônicas atribuídas</p>
            </div>
          )}
        </Card>
          </TabsContent>

          <TabsContent value="desenvolvimento" data-testid="tab-content-desenvolvimento">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <EnpsCard colaboradorId={colaboradorId} />
              <PdiCard colaboradorId={colaboradorId} />
              <OneOnOneCard colaboradorId={colaboradorId} />
              <Card className="p-6 opacity-70" data-testid="card-comentarios">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                    <FileText className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">Comentários</h3>
                      <Badge variant="secondary" className="text-xs">Em breve</Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      Em breve - Notas e observações sobre o colaborador
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <EditColaboradorDialog 
          colaborador={colaborador} 
          open={editDialogOpen} 
          onOpenChange={setEditDialogOpen} 
        />

        <AddPromocaoDialog
          colaborador={colaborador}
          open={addPromocaoDialogOpen}
          onOpenChange={setAddPromocaoDialogOpen}
        />

        <AssignPatrimonioDialog
          colaborador={colaborador}
          open={assignPatrimonioDialogOpen}
          onOpenChange={setAssignPatrimonioDialogOpen}
        />
      </div>
    </div>
  );
}
