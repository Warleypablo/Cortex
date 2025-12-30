import { useState, useEffect, useRef } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { usePageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { useAuth } from "@/contexts/AuthContext";
import { formatDecimal, cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SelectWithAdd } from "@/components/ui/select-with-add";
import { ArrowLeft, Pencil, Loader2, Mail, Phone, MapPin, Calendar, Briefcase, Award, CreditCard, Building2, Package, User, DollarSign, Plus, TrendingUp, TrendingDown, Minus, UserCircle, ExternalLink, Search, MessageSquare, Target, BarChart2, FileText, Check, ChevronDown, ChevronUp, Hash, Clock, CheckCircle2, AlertTriangle, AlertCircle, Upload, Receipt, Download, Eye, LayoutGrid, List, Info, HelpCircle } from "lucide-react";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
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

interface PagamentoItem {
  id: number;
  colaborador_id: number;
  mes_referencia: number;
  ano_referencia: number;
  valor_bruto: string;
  valor_liquido: string | null;
  data_pagamento: string | null;
  status: string;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
  total_nfs: string;
}

interface NotaFiscalItem {
  id: number;
  pagamento_id: number;
  colaborador_id: number;
  numero_nf: string | null;
  valor_nf: string | null;
  arquivo_path: string | null;
  arquivo_nome: string | null;
  data_emissao: string | null;
  status: string;
  criado_em: string;
  criado_por: string | null;
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
  pdfObjectKey?: string | null;
  pdfFilename?: string | null;
  transcriptUrl?: string | null;
  transcriptText?: string | null;
  uploadedBy?: string | null;
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

interface PdiCheckpointItem {
  id: number;
  pdiId: number;
  descricao: string;
  dataAlvo: string | null;
  concluido: string | null;
  concluidoEm: string | null;
  ordem: number | null;
  criadoEm: string | null;
}

interface TimelineEvent {
  id: string;
  type: "enps" | "one_on_one" | "pdi" | "pdi_checkpoint" | "promocao" | "health";
  title: string;
  description: string | null;
  date: string;
  metadata: Record<string, any>;
}

interface PdiItem {
  id: number;
  colaboradorId: number;
  titulo: string;
  descricao: string | null;
  competencia: string | null;
  categoria: string | null;
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

const AGENDA_TEMPLATES = [
  { 
    id: "checkin", 
    nome: "Check-in Semanal", 
    topicos: "- Bem-estar: Como você está?\n- Bloqueios: O que está te impedindo de avançar?\n- Prioridades: Quais são as prioridades da semana?" 
  },
  { 
    id: "feedback", 
    nome: "Feedback", 
    topicos: "- Pontos positivos: O que está funcionando bem?\n- Áreas de melhoria: O que pode melhorar?\n- Ações: Quais próximos passos?" 
  },
  { 
    id: "desenvolvimento", 
    nome: "Desenvolvimento", 
    topicos: "- Metas: Como estão as metas de desenvolvimento?\n- Aprendizado: O que aprendeu recentemente?\n- Carreira: Onde quer chegar?" 
  },
  { 
    id: "livre", 
    nome: "Livre", 
    topicos: "" 
  },
];

function getAcaoStatusInfo(status: string | null, prazo: string | null, criadoEm: string | null): { label: string; color: string; bgColor: string; isOverdue: boolean } {
  const SLA_DAYS = 14;
  const now = new Date();
  
  let isOverdue = false;
  if (status !== "concluida" && status !== "em_andamento") {
    if (prazo) {
      isOverdue = new Date(prazo) < now;
    } else if (criadoEm) {
      const createdDate = new Date(criadoEm);
      const dueDate = new Date(createdDate);
      dueDate.setDate(dueDate.getDate() + SLA_DAYS);
      isOverdue = dueDate < now;
    }
  }
  
  if (status === "concluida") {
    return { label: "Concluído", color: "text-green-600 dark:text-green-400", bgColor: "bg-green-100 dark:bg-green-900/30", isOverdue: false };
  }
  if (status === "em_andamento") {
    return { label: "Em Andamento", color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/30", isOverdue: false };
  }
  if (isOverdue) {
    return { label: "Atrasado", color: "text-red-600 dark:text-red-400", bgColor: "bg-red-100 dark:bg-red-900/30", isOverdue: true };
  }
  return { label: "Pendente", color: "text-yellow-600 dark:text-yellow-400", bgColor: "bg-yellow-100 dark:bg-yellow-900/30", isOverdue: false };
}

function OneOnOneCard({ colaboradorId }: { colaboradorId: string }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addAcaoDialogOpen, setAddAcaoDialogOpen] = useState(false);
  const [attachmentDialogOpen, setAttachmentDialogOpen] = useState(false);
  const [selectedOneOnOneId, setSelectedOneOnOneId] = useState<number | null>(null);
  const [expandedMeetings, setExpandedMeetings] = useState<Set<number>>(new Set());
  const [expandedTranscript, setExpandedTranscript] = useState<Set<number>>(new Set());
  const [formData, setFormData] = useState({ data: new Date().toISOString().split("T")[0], pauta: "", notas: "" });
  const [acaoFormData, setAcaoFormData] = useState({ descricao: "", responsavel: "", prazo: "", status: "pendente" });
  const [attachmentData, setAttachmentData] = useState({ transcriptUrl: "", transcriptText: "" });
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: oneOnOnes = [], isLoading } = useQuery<OneOnOneItem[]>({
    queryKey: ["/api/colaboradores", colaboradorId, "one-on-one"],
  });

  const allAcoes = oneOnOnes.flatMap(m => m.acoes || []);
  const pendingAcoes = allAcoes.filter(a => a.status !== "concluida");
  const completedAcoes = allAcoes.filter(a => a.status === "concluida");

  const stats = {
    totalMeetings: oneOnOnes.length,
    averageFrequency: oneOnOnes.length >= 2 
      ? Math.round(
          oneOnOnes
            .slice(0, -1)
            .map((m, i) => {
              const current = new Date(m.data);
              const next = new Date(oneOnOnes[i + 1].data);
              return Math.abs((current.getTime() - next.getTime()) / (1000 * 60 * 60 * 24));
            })
            .reduce((a, b) => a + b, 0) / (oneOnOnes.length - 1)
        )
      : 0,
    lastMeeting: oneOnOnes.length > 0 ? oneOnOnes[0].data : null,
    pendingCount: pendingAcoes.length,
    completedCount: completedAcoes.length,
  };

  const donutData = [
    { name: "Concluídas", value: stats.completedCount, color: "#22c55e" },
    { name: "Pendentes", value: stats.pendingCount, color: "#eab308" },
  ];

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
      setSelectedTemplate("");
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao registrar 1x1", description: error.message, variant: "destructive" });
    },
  });

  const addAcaoMutation = useMutation({
    mutationFn: async (data: { descricao: string; responsavel: string; prazo: string; status: string }) => {
      const response = await apiRequest("POST", `/api/one-on-one/${selectedOneOnOneId}/acoes`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colaboradores", colaboradorId, "one-on-one"] });
      toast({ title: "Ação adicionada", description: "A ação foi registrada com sucesso." });
      setAddAcaoDialogOpen(false);
      setAcaoFormData({ descricao: "", responsavel: "", prazo: "", status: "pendente" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao adicionar ação", description: error.message, variant: "destructive" });
    },
  });

  const updateAcaoMutation = useMutation({
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

  const updateAttachmentsMutation = useMutation({
    mutationFn: async (data: { pdfObjectKey?: string; pdfFilename?: string; transcriptUrl?: string; transcriptText?: string }) => {
      const response = await apiRequest("PATCH", `/api/one-on-one/${selectedOneOnOneId}/attachments`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colaboradores", colaboradorId, "one-on-one"] });
      toast({ title: "Anexos salvos", description: "Os anexos foram atualizados com sucesso." });
      setAttachmentDialogOpen(false);
      setAttachmentData({ transcriptUrl: "", transcriptText: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao salvar anexos", description: error.message, variant: "destructive" });
    },
  });

  const handlePdfUpload = async (file: File) => {
    if (!selectedOneOnOneId || !file) return;
    
    setIsUploading(true);
    try {
      // Step 1: Get presigned upload URL
      const urlResponse = await apiRequest("POST", `/api/one-on-one/${selectedOneOnOneId}/upload-url`, {
        filename: file.name,
        contentType: file.type
      });
      const { uploadURL, objectPath } = await urlResponse.json();
      
      // Step 2: Upload file directly to presigned URL
      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type }
      });
      
      // Step 3: Save object path to database
      await apiRequest("PATCH", `/api/one-on-one/${selectedOneOnOneId}/attachments`, {
        pdfObjectKey: objectPath,
        pdfFilename: file.name
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/colaboradores", colaboradorId, "one-on-one"] });
      toast({ title: "PDF enviado", description: `${file.name} foi anexado com sucesso.` });
    } catch (error) {
      toast({ title: "Erro ao enviar PDF", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleTranscript = (id: number) => {
    setExpandedTranscript(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const toggleMeeting = (id: number) => {
    setExpandedMeetings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = AGENDA_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setFormData(prev => ({ ...prev, pauta: template.topicos }));
    }
  };

  const cycleStatus = (currentStatus: string | null) => {
    if (currentStatus === "pendente" || !currentStatus) return "em_andamento";
    if (currentStatus === "em_andamento") return "concluida";
    return "pendente";
  };

  return (
    <Card className="p-6" data-testid="card-1x1">
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <MessageSquare className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Reuniões 1x1</h3>
            {stats.pendingCount > 0 && (
              <span className="text-xs text-yellow-600 dark:text-yellow-400" data-testid="text-pending-count">
                {stats.pendingCount} {stats.pendingCount === 1 ? "ação pendente" : "ações pendentes"}
              </span>
            )}
          </div>
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
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4" data-testid="stats-summary">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground uppercase mb-1">Total 1x1s</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.totalMeetings}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground uppercase mb-1">Frequência</p>
              <p className="text-2xl font-bold">{stats.averageFrequency > 0 ? `${stats.averageFrequency}d` : "-"}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground uppercase mb-1">Último 1x1</p>
              <p className="text-sm font-medium">{stats.lastMeeting ? formatDateFns(stats.lastMeeting) : "-"}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 flex flex-col items-center justify-center">
              <p className="text-xs text-muted-foreground uppercase mb-1">Ações</p>
              {allAcoes.length > 0 ? (
                <div className="flex items-center gap-2">
                  <div className="w-12 h-12">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutData}
                          cx="50%"
                          cy="50%"
                          innerRadius={12}
                          outerRadius={20}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {donutData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="text-xs">
                    <span className="text-green-600 dark:text-green-400">{stats.completedCount}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-yellow-600 dark:text-yellow-400">{stats.pendingCount}</span>
                  </div>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">-</span>
              )}
            </div>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {oneOnOnes.map((meeting) => {
              const meetingPendingCount = (meeting.acoes || []).filter(a => a.status !== "concluida").length;
              return (
                <Collapsible key={meeting.id} open={expandedMeetings.has(meeting.id)} onOpenChange={() => toggleMeeting(meeting.id)}>
                  <div className="border rounded-lg p-3" data-testid={`meeting-${meeting.id}`}>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center justify-between w-full text-left">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{formatDateFns(meeting.data)}</span>
                          {meeting.acoes && meeting.acoes.length > 0 && (
                            <Badge variant="secondary" className="text-xs">{meeting.acoes.length} ações</Badge>
                          )}
                          {meetingPendingCount > 0 && (
                            <Badge className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                              {meetingPendingCount} pendente{meetingPendingCount > 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                        {expandedMeetings.has(meeting.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3 space-y-3">
                      {meeting.pauta && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase mb-1">Pauta</p>
                          <p className="text-sm whitespace-pre-wrap">{meeting.pauta}</p>
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
                            {meeting.acoes.map((acao) => {
                              const statusInfo = getAcaoStatusInfo(acao.status, acao.prazo, acao.concluidaEm);
                              return (
                                <div key={acao.id} className="flex items-start gap-2 text-sm" data-testid={`acao-${acao.id}`}>
                                  <button
                                    onClick={() => updateAcaoMutation.mutate({ acaoId: acao.id, status: cycleStatus(acao.status) })}
                                    className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                      acao.status === "concluida" 
                                        ? "bg-green-500 border-green-500 text-white" 
                                        : acao.status === "em_andamento"
                                        ? "bg-blue-500 border-blue-500 text-white"
                                        : statusInfo.isOverdue
                                        ? "border-red-500"
                                        : "border-muted-foreground"
                                    }`}
                                    data-testid={`toggle-acao-${acao.id}`}
                                    title={`Clique para ${acao.status === "pendente" || !acao.status ? "iniciar" : acao.status === "em_andamento" ? "concluir" : "reabrir"}`}
                                  >
                                    {acao.status === "concluida" && <Check className="w-3 h-3" />}
                                    {acao.status === "em_andamento" && <Clock className="w-3 h-3" />}
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <span className={acao.status === "concluida" ? "line-through text-muted-foreground" : statusInfo.isOverdue ? "text-red-600 dark:text-red-400" : ""}>
                                      {acao.descricao}
                                    </span>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                      <Badge className={`text-xs ${statusInfo.bgColor} ${statusInfo.color}`}>
                                        {statusInfo.label}
                                      </Badge>
                                      {acao.responsavel && (
                                        <span className="text-xs text-muted-foreground">{acao.responsavel}</span>
                                      )}
                                      {acao.prazo && (
                                        <span className={`text-xs ${statusInfo.isOverdue && acao.status !== "concluida" ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                                          Prazo: {formatDateFns(acao.prazo)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">Nenhuma ação registrada</p>
                        )}
                      </div>
                      
                      <div className="pt-2 border-t">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-muted-foreground uppercase">Anexos & Transcrição</p>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => { 
                              setSelectedOneOnOneId(meeting.id); 
                              setAttachmentData({ 
                                transcriptUrl: meeting.transcriptUrl || "", 
                                transcriptText: meeting.transcriptText || "" 
                              });
                              setAttachmentDialogOpen(true); 
                            }}
                            data-testid={`button-add-attachment-${meeting.id}`}
                          >
                            <Upload className="w-3 h-3 mr-1" /> Anexar
                          </Button>
                        </div>
                        
                        <div className="space-y-2">
                          {meeting.pdfFilename && (
                            <div className="flex items-center gap-2 text-sm">
                              <FileText className="w-4 h-4 text-red-500" />
                              <span className="flex-1 truncate">{meeting.pdfFilename}</span>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => window.open(`/api/one-on-one/${meeting.id}/download-pdf`, '_blank')}
                                data-testid={`button-download-pdf-${meeting.id}`}
                              >
                                <Download className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                          
                          {meeting.transcriptUrl && (
                            <div className="flex items-center gap-2 text-sm">
                              <ExternalLink className="w-4 h-4 text-blue-500" />
                              <a 
                                href={meeting.transcriptUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-blue-600 dark:text-blue-400 hover:underline truncate flex-1"
                                data-testid={`link-transcript-${meeting.id}`}
                              >
                                Link da Transcrição
                              </a>
                            </div>
                          )}
                          
                          {meeting.transcriptText && (
                            <div className="space-y-1">
                              <button 
                                onClick={() => toggleTranscript(meeting.id)}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                data-testid={`toggle-transcript-${meeting.id}`}
                              >
                                {expandedTranscript.has(meeting.id) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                Transcrição da Reunião
                              </button>
                              {expandedTranscript.has(meeting.id) && (
                                <div className="bg-muted/50 p-3 rounded-lg text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                                  {meeting.transcriptText}
                                </div>
                              )}
                            </div>
                          )}
                          
                          {!meeting.pdfFilename && !meeting.transcriptUrl && !meeting.transcriptText && (
                            <p className="text-xs text-muted-foreground">Nenhum anexo ou transcrição</p>
                          )}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Reunião 1x1</DialogTitle>
            <DialogDescription>Registre uma nova reunião one-on-one</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Template de Pauta</label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {AGENDA_TEMPLATES.map((template) => (
                  <Button
                    key={template.id}
                    type="button"
                    variant={selectedTemplate === template.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleTemplateSelect(template.id)}
                    className="justify-start"
                    data-testid={`template-${template.id}`}
                  >
                    {template.nome}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Data *</label>
              <Input type="date" value={formData.data} onChange={(e) => setFormData({ ...formData, data: e.target.value })} data-testid="input-1x1-data" />
            </div>
            <div>
              <label className="text-sm font-medium">Pauta</label>
              <Textarea 
                value={formData.pauta} 
                onChange={(e) => setFormData({ ...formData, pauta: e.target.value })} 
                placeholder="Tópicos a serem discutidos..." 
                rows={5}
                data-testid="input-1x1-pauta" 
              />
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
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={acaoFormData.status} onValueChange={(v) => setAcaoFormData({ ...acaoFormData, status: v })}>
                <SelectTrigger data-testid="select-acao-status">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluida">Concluído</SelectItem>
                </SelectContent>
              </Select>
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

      <Dialog open={attachmentDialogOpen} onOpenChange={setAttachmentDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Anexos & Transcrição</DialogTitle>
            <DialogDescription>Adicione PDF, link ou texto de transcrição da reunião</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Upload de PDF</label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePdfUpload(file);
                  }}
                  className="hidden"
                  data-testid="input-pdf-upload"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  data-testid="button-select-pdf"
                >
                  {isUploading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                  ) : (
                    <><Upload className="w-4 h-4 mr-2" /> Selecionar PDF</>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Apenas arquivos PDF são aceitos</p>
            </div>
            
            <div>
              <label className="text-sm font-medium">Link da Transcrição</label>
              <Input 
                value={attachmentData.transcriptUrl} 
                onChange={(e) => setAttachmentData({ ...attachmentData, transcriptUrl: e.target.value })} 
                placeholder="https://docs.google.com/... ou https://notion.so/..." 
                data-testid="input-transcript-url" 
              />
              <p className="text-xs text-muted-foreground mt-1">Cole um link público para a transcrição (Google Docs, Notion, etc.)</p>
            </div>
            
            <div>
              <label className="text-sm font-medium">Texto da Transcrição</label>
              <Textarea 
                value={attachmentData.transcriptText} 
                onChange={(e) => setAttachmentData({ ...attachmentData, transcriptText: e.target.value })} 
                placeholder="Cole aqui a transcrição da reunião..." 
                rows={6}
                data-testid="input-transcript-text" 
              />
              <p className="text-xs text-muted-foreground mt-1">Ou cole diretamente o texto da transcrição da gravação</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachmentDialogOpen(false)}>Cancelar</Button>
            <Button 
              onClick={() => updateAttachmentsMutation.mutate(attachmentData)} 
              disabled={updateAttachmentsMutation.isPending}
              data-testid="button-save-attachments"
            >
              {updateAttachmentsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Interface para comentários
interface ComentarioItem {
  id: number;
  colaborador_id: number;
  autor_id: number | null;
  autor_nome: string;
  autor_email: string;
  comentario: string;
  tipo: string;
  visibilidade: string;
  criado_em: string;
  autor_nome_completo?: string;
}

function ComentariosCard({ colaboradorId }: { colaboradorId: string }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoComentario, setNovoComentario] = useState("");

  const { data: comentarios = [], isLoading } = useQuery<ComentarioItem[]>({
    queryKey: ["/api/rh/colaborador", colaboradorId, "comentarios"],
    queryFn: async () => {
      const res = await fetch(`/api/rh/colaborador/${colaboradorId}/comentarios`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar comentários");
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: { comentario: string }) => {
      const response = await apiRequest("POST", `/api/rh/colaborador/${colaboradorId}/comentarios`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rh/colaborador", colaboradorId, "comentarios"] });
      toast({ title: "Comentário adicionado", description: "A anotação foi salva com sucesso." });
      setDialogOpen(false);
      setNovoComentario("");
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao adicionar comentário", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (comentarioId: number) => {
      const response = await apiRequest("DELETE", `/api/rh/comentarios/${comentarioId}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rh/colaborador", colaboradorId, "comentarios"] });
      toast({ title: "Comentário removido", description: "A anotação foi excluída." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remover comentário", description: error.message, variant: "destructive" });
    },
  });

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <Card className="p-6" data-testid="card-comentarios">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30">
            <FileText className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold">Comentários</h3>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)} data-testid="button-add-comentario">
          <Plus className="w-4 h-4 mr-1" /> Novo
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : comentarios.length > 0 ? (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {comentarios.map((c) => (
            <div 
              key={c.id} 
              className="p-3 rounded-lg bg-muted/50 border border-border/50"
              data-testid={`comentario-${c.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-medium">{c.autor_nome_completo || c.autor_nome}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(c.criado_em)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{c.comentario}</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMutation.mutate(c.id)}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-comentario-${c.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8" data-testid="text-no-comentarios">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
            <FileText className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground font-medium mb-1">Sem comentários</p>
          <p className="text-xs text-muted-foreground">Adicione notas e observações sobre este colaborador</p>
        </div>
      )}

      {/* Dialog para adicionar comentário */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-600" />
              Novo Comentário
            </DialogTitle>
            <DialogDescription>
              Adicione uma nota ou observação sobre este colaborador.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Escreva seu comentário aqui..."
              value={novoComentario}
              onChange={(e) => setNovoComentario(e.target.value)}
              rows={4}
              data-testid="textarea-novo-comentario"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button 
              onClick={() => addMutation.mutate({ comentario: novoComentario })} 
              disabled={addMutation.isPending || !novoComentario.trim()}
              data-testid="button-save-comentario"
            >
              {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Opções para pergunta de motivo de permanência
const MOTIVOS_PERMANENCIA = [
  "O fato dela me proporcionar equilíbrio entre minha vida pessoal e profissional",
  "A remuneração e benefícios oferecidos pela empresa",
  "A oportunidade que tenho de crescer e me desenvolver",
  "O alinhamento dos meus valores com os valores da empresa",
  "Outro"
];

// Interface para pesquisa completa
interface PesquisaEnpsData {
  motivoPermanencia: string;
  score: number;
  comentarioEmpresa: string;
  scoreLider: number;
  comentarioLider: string;
  scoreProdutos: number;
  comentarioProdutos: string;
  feedbackGeral: string;
}

function EnpsCard({ colaboradorId }: { colaboradorId: string }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState(1);
  const totalSteps = 8;
  
  // Estado do formulário
  const [formData, setFormData] = useState<Partial<PesquisaEnpsData>>({});

  const { data: enpsResponses = [], isLoading } = useQuery<EnpsItem[]>({
    queryKey: ["/api/colaboradores", colaboradorId, "enps"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: PesquisaEnpsData) => {
      const payload = {
        score: data.score,
        comentario: data.comentarioEmpresa,
        motivoPermanencia: data.motivoPermanencia,
        comentarioEmpresa: data.comentarioEmpresa,
        scoreLider: data.scoreLider,
        comentarioLider: data.comentarioLider,
        scoreProdutos: data.scoreProdutos,
        comentarioProdutos: data.comentarioProdutos,
        feedbackGeral: data.feedbackGeral,
        data: new Date().toISOString().split("T")[0]
      };
      const response = await apiRequest("POST", `/api/colaboradores/${colaboradorId}/enps`, payload);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colaboradores", colaboradorId, "enps"] });
      toast({ title: "Pesquisa registrada", description: "Suas respostas foram salvas com sucesso." });
      setDialogOpen(false);
      setStep(1);
      setFormData({});
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao registrar pesquisa", description: error.message, variant: "destructive" });
    },
  });
  
  const resetAndCloseDialog = () => {
    setDialogOpen(false);
    setStep(1);
    setFormData({});
  };
  
  const canProceed = () => {
    switch(step) {
      case 1: return !!formData.motivoPermanencia;
      case 2: return formData.score !== undefined;
      case 3: return true; // comentário opcional
      case 4: return formData.scoreLider !== undefined;
      case 5: return true; // comentário opcional
      case 6: return formData.scoreProdutos !== undefined;
      case 7: return true; // comentário opcional
      case 8: return true; // feedback opcional
      default: return false;
    }
  };
  
  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      // Submeter pesquisa
      addMutation.mutate(formData as PesquisaEnpsData);
    }
  };
  
  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };
  
  // Componente para escala 0-10
  const ScaleSelector = ({ value, onChange, label }: { value?: number; onChange: (v: number) => void; label: string }) => (
    <div className="space-y-4">
      <p className="text-sm font-medium text-center">{label}</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => {
          const cat = getEnpsCategory(score);
          return (
            <button
              key={score}
              type="button"
              onClick={() => onChange(score)}
              className={`w-10 h-10 rounded-lg font-bold transition-all ${value === score ? `${cat.bgColor} ${cat.color} ring-2 ring-offset-2` : "bg-muted hover:bg-muted/80"}`}
              data-testid={`button-score-${score}`}
            >
              {score}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground px-2">
        <span className="text-red-500">0-6 Detrator</span>
        <span className="text-yellow-500">7-8 Neutro</span>
        <span className="text-green-500">9-10 Promotor</span>
      </div>
    </div>
  );

  const lastResponse = enpsResponses.length > 0 ? enpsResponses[0] : null;
  const category = lastResponse ? getEnpsCategory(lastResponse.score) : null;

  // Calculate stats
  const averageScore = enpsResponses.length > 0 
    ? enpsResponses.reduce((sum, r) => sum + r.score, 0) / enpsResponses.length 
    : 0;
  const avgCategory = getEnpsCategory(Math.round(averageScore));

  // Calculate trend (comparing last 3 vs previous 3)
  const getTrend = (): { icon: typeof TrendingUp; label: string; color: string } => {
    if (enpsResponses.length < 2) return { icon: Minus, label: "Estável", color: "text-muted-foreground" };
    const recent = enpsResponses.slice(0, Math.min(3, enpsResponses.length));
    const previous = enpsResponses.slice(Math.min(3, enpsResponses.length), Math.min(6, enpsResponses.length));
    if (previous.length === 0) return { icon: Minus, label: "Estável", color: "text-muted-foreground" };
    const recentAvg = recent.reduce((sum, r) => sum + r.score, 0) / recent.length;
    const prevAvg = previous.reduce((sum, r) => sum + r.score, 0) / previous.length;
    const diff = recentAvg - prevAvg;
    if (diff > 0.5) return { icon: TrendingUp, label: "Melhorando", color: "text-green-600 dark:text-green-400" };
    if (diff < -0.5) return { icon: TrendingDown, label: "Declinando", color: "text-red-600 dark:text-red-400" };
    return { icon: Minus, label: "Estável", color: "text-yellow-600 dark:text-yellow-400" };
  };
  const trend = getTrend();
  const TrendIcon = trend.icon;

  // Prepare chart data (last 6 entries, oldest first for chart)
  const chartData = enpsResponses
    .slice(0, 6)
    .reverse()
    .map((resp) => ({
      date: format(new Date(resp.data), "MMM/yy", { locale: ptBR }),
      score: resp.score,
      fullDate: formatDateFns(resp.data),
    }));

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const cat = getEnpsCategory(data.score);
      return (
        <div className="bg-popover border rounded-lg p-2 shadow-lg">
          <p className="text-xs text-muted-foreground">{data.fullDate}</p>
          <p className={`font-bold ${cat.color}`}>{data.score} - {cat.label}</p>
        </div>
      );
    }
    return null;
  };

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
      ) : enpsResponses.length > 0 ? (
        <div className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 text-center" data-testid="stat-average">
              <p className="text-xs text-muted-foreground uppercase mb-1">Média</p>
              <p className={`text-2xl font-bold ${avgCategory.color}`}>{averageScore.toFixed(1)}</p>
              <Badge className={`text-xs mt-1 ${avgCategory.bgColor}`}>{avgCategory.label}</Badge>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center" data-testid="stat-total">
              <p className="text-xs text-muted-foreground uppercase mb-1">Respostas</p>
              <div className="flex items-center justify-center gap-1">
                <Hash className="w-4 h-4 text-muted-foreground" />
                <p className="text-2xl font-bold">{enpsResponses.length}</p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center" data-testid="stat-last">
              <p className="text-xs text-muted-foreground uppercase mb-1">Última</p>
              <div className="flex items-center justify-center gap-1">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-medium">{formatDateFns(lastResponse?.data)}</p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center" data-testid="stat-trend">
              <p className="text-xs text-muted-foreground uppercase mb-1">Tendência</p>
              <div className="flex items-center justify-center gap-1">
                <TrendIcon className={`w-5 h-5 ${trend.color}`} />
                <p className={`text-sm font-medium ${trend.color}`}>{trend.label}</p>
              </div>
            </div>
          </div>

          {/* Trend Chart */}
          {chartData.length >= 2 && (
            <div className="pt-3 border-t" data-testid="enps-chart">
              <p className="text-xs text-muted-foreground uppercase mb-3">Evolução e-NPS</p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    {/* Color zones as reference areas */}
                    <ReferenceArea y1={0} y2={6.5} fill="#ef4444" fillOpacity={0.1} />
                    <ReferenceArea y1={6.5} y2={8.5} fill="#eab308" fillOpacity={0.1} />
                    <ReferenceArea y1={8.5} y2={10} fill="#22c55e" fillOpacity={0.1} />
                    {/* Reference lines for boundaries */}
                    <ReferenceLine y={6.5} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
                    <ReferenceLine y={8.5} stroke="#eab308" strokeDasharray="3 3" strokeOpacity={0.5} />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 11 }} 
                      tickLine={false}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <YAxis 
                      domain={[0, 10]} 
                      ticks={[0, 3, 6, 8, 10]} 
                      tick={{ fontSize: 11 }} 
                      tickLine={false}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Latest response highlight */}
          {lastResponse && (
            <div className="pt-3 border-t">
              <p className="text-xs text-muted-foreground uppercase mb-2">Última Resposta</p>
              <div className="flex items-center gap-4">
                <div className={`text-3xl font-bold ${category?.color}`}>{lastResponse.score}</div>
                <div>
                  <Badge className={category?.bgColor}>{category?.label}</Badge>
                  <p className="text-xs text-muted-foreground mt-1">{formatDateFns(lastResponse.data)}</p>
                </div>
              </div>
              {lastResponse.comentario && (
                <p className="text-sm text-muted-foreground italic mt-2">"{lastResponse.comentario}"</p>
              )}
            </div>
          )}

          {/* Mini bar chart for history */}
          {enpsResponses.length > 1 && (
            <div className="pt-3 border-t">
              <p className="text-xs text-muted-foreground uppercase mb-2">Histórico ({enpsResponses.length} respostas)</p>
              <div className="flex items-end gap-1 h-12">
                {enpsResponses.slice(0, 12).reverse().map((resp) => {
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
        /* Empty state with call-to-action */
        <div className="text-center py-8" data-testid="enps-empty-state">
          <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
            <BarChart2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h4 className="font-semibold text-foreground mb-2">Sem registros de e-NPS</h4>
          <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto">
            O e-NPS ajuda a medir o nível de satisfação e engajamento do colaborador.
          </p>
          <Button onClick={() => setDialogOpen(true)} data-testid="button-add-first-enps">
            <Plus className="w-4 h-4 mr-2" />
            Registrar primeira resposta
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={resetAndCloseDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-blue-600" />
              Pesquisa e-NPS
            </DialogTitle>
            <DialogDescription>
              Pergunta {step} de {totalSteps}
            </DialogDescription>
          </DialogHeader>
          
          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all" 
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
          
          <div className="py-4 min-h-[200px]">
            {/* Step 1: Motivo de permanência */}
            {step === 1 && (
              <div className="space-y-4">
                <p className="text-sm font-medium">O principal motivo que me faz permanecer na empresa é:</p>
                <div className="space-y-2">
                  {MOTIVOS_PERMANENCIA.map((motivo, idx) => (
                    <label 
                      key={idx}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${formData.motivoPermanencia === motivo ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'}`}
                    >
                      <input 
                        type="radio" 
                        name="motivoPermanencia"
                        checked={formData.motivoPermanencia === motivo}
                        onChange={() => setFormData({...formData, motivoPermanencia: motivo})}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{motivo}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            
            {/* Step 2: Score empresa (0-10) */}
            {step === 2 && (
              <ScaleSelector 
                value={formData.score}
                onChange={(v) => setFormData({...formData, score: v})}
                label="Em uma escala de 0 a 10, o quanto você avalia a Turbo Partners? (Sendo 0 não indicaria de jeito nenhum e 10 indicaria para todos)"
              />
            )}
            
            {/* Step 3: Comentário empresa */}
            {step === 3 && (
              <div className="space-y-4">
                <p className="text-sm font-medium">O que precisamos fazer para sermos ou mantermos um 10?</p>
                <Textarea 
                  value={formData.comentarioEmpresa || ''} 
                  onChange={(e) => setFormData({...formData, comentarioEmpresa: e.target.value})}
                  placeholder="Compartilhe suas sugestões..."
                  rows={5}
                  data-testid="textarea-comentario-empresa"
                />
              </div>
            )}
            
            {/* Step 4: Score líder (0-10) */}
            {step === 4 && (
              <ScaleSelector 
                value={formData.scoreLider}
                onChange={(v) => setFormData({...formData, scoreLider: v})}
                label="Em uma escala de 0 a 10, o quanto você avalia o seu líder de equipe como uma boa pessoa para se trabalhar?"
              />
            )}
            
            {/* Step 5: Comentário líder */}
            {step === 5 && (
              <div className="space-y-4">
                <p className="text-sm font-medium">O que o seu líder precisa fazer ou manter para receber um 10?</p>
                <Textarea 
                  value={formData.comentarioLider || ''} 
                  onChange={(e) => setFormData({...formData, comentarioLider: e.target.value})}
                  placeholder="Compartilhe seu feedback sobre a liderança..."
                  rows={5}
                  data-testid="textarea-comentario-lider"
                />
              </div>
            )}
            
            {/* Step 6: Score produtos (0-10) */}
            {step === 6 && (
              <ScaleSelector 
                value={formData.scoreProdutos}
                onChange={(v) => setFormData({...formData, scoreProdutos: v})}
                label="Em uma escala de 0 a 10, o quanto você avalia os produtos da nossa empresa?"
              />
            )}
            
            {/* Step 7: Comentário produtos */}
            {step === 7 && (
              <div className="space-y-4">
                <p className="text-sm font-medium">O que podemos fazer para recebermos ou mantermos um 10?</p>
                <Textarea 
                  value={formData.comentarioProdutos || ''} 
                  onChange={(e) => setFormData({...formData, comentarioProdutos: e.target.value})}
                  placeholder="Compartilhe suas sugestões sobre os produtos..."
                  rows={5}
                  data-testid="textarea-comentario-produtos"
                />
              </div>
            )}
            
            {/* Step 8: Feedback geral */}
            {step === 8 && (
              <div className="space-y-4">
                <p className="text-sm font-medium">Espaço para feedbacks, críticas construtivas e opiniões:</p>
                <Textarea 
                  value={formData.feedbackGeral || ''} 
                  onChange={(e) => setFormData({...formData, feedbackGeral: e.target.value})}
                  placeholder="Fique à vontade para compartilhar qualquer feedback adicional..."
                  rows={5}
                  data-testid="textarea-feedback-geral"
                />
              </div>
            )}
          </div>
          
          <DialogFooter className="flex justify-between gap-2">
            <div>
              {step > 1 && (
                <Button variant="outline" onClick={handleBack} data-testid="button-back">
                  Voltar
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={resetAndCloseDialog}>Cancelar</Button>
              <Button 
                onClick={handleNext} 
                disabled={!canProceed() || addMutation.isPending}
                data-testid="button-next"
              >
                {addMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : step === totalSteps ? (
                  "Enviar Pesquisa"
                ) : (
                  "Próximo"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

const PDI_CATEGORIES = [
  { value: "tecnica", label: "Técnica", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  { value: "comportamental", label: "Comportamental", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400" },
  { value: "lideranca", label: "Liderança", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  { value: "comunicacao", label: "Comunicação", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" },
  { value: "processos", label: "Processos", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" },
];

function PdiProgressBar({ progresso }: { progresso: number }) {
  const getGradientColor = (value: number) => {
    if (value >= 100) return "from-green-500 to-emerald-600";
    if (value >= 75) return "from-blue-500 to-cyan-500";
    if (value >= 50) return "from-yellow-500 to-orange-500";
    if (value >= 25) return "from-orange-500 to-red-500";
    return "from-red-500 to-red-600";
  };

  return (
    <div className="relative w-full">
      <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${getGradientColor(progresso)} transition-all duration-300 flex items-center justify-end pr-1`}
          style={{ width: `${Math.max(progresso, 8)}%` }}
        >
          {progresso >= 15 && (
            <span className="text-[10px] font-bold text-white drop-shadow-sm">{progresso}%</span>
          )}
        </div>
      </div>
      {progresso < 15 && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground">{progresso}%</span>
      )}
    </div>
  );
}

function PdiCheckpointTimeline({ pdiId, colaboradorId }: { pdiId: number; colaboradorId: string }) {
  const { toast } = useToast();
  const [newCheckpoint, setNewCheckpoint] = useState({ descricao: "", dataAlvo: "" });
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: checkpoints = [], isLoading, isError } = useQuery<PdiCheckpointItem[]>({
    queryKey: ["/api/pdi", pdiId, "checkpoints"],
    retry: false,
  });

  const addCheckpointMutation = useMutation({
    mutationFn: async (data: { descricao: string; dataAlvo: string }) => {
      const response = await apiRequest("POST", `/api/pdi/${pdiId}/checkpoints`, { ...data, pdiId, ordem: checkpoints.length });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdi", pdiId, "checkpoints"] });
      toast({ title: "Marco criado", description: "O checkpoint foi adicionado." });
      setNewCheckpoint({ descricao: "", dataAlvo: "" });
      setShowAddForm(false);
    },
  });

  const toggleCheckpointMutation = useMutation({
    mutationFn: async ({ id, concluido }: { id: number; concluido: string }) => {
      const response = await apiRequest("PUT", `/api/pdi/checkpoints/${id}`, { concluido });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pdi", pdiId, "checkpoints"] });
    },
  });

  const getCheckpointStatus = (cp: PdiCheckpointItem) => {
    if (cp.concluido === "true") return "completed";
    if (cp.dataAlvo) {
      const targetDate = new Date(cp.dataAlvo);
      const today = new Date();
      if (targetDate < today) return "overdue";
    }
    return "pending";
  };

  if (isLoading) return <Loader2 className="w-4 h-4 animate-spin" />;

  // Graceful degradation when checkpoints table doesn't exist yet
  if (isError) {
    return (
      <div className="mt-3 pt-3 border-t border-dashed">
        <span className="text-xs text-muted-foreground italic">Checkpoints em breve disponíveis</span>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-dashed">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">Marcos / Checkpoints</span>
        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowAddForm(!showAddForm)} data-testid={`button-add-checkpoint-${pdiId}`}>
          <Plus className="w-3 h-3 mr-1" /> Adicionar
        </Button>
      </div>
      
      {showAddForm && (
        <div className="flex gap-2 mb-3">
          <Input 
            placeholder="Descrição do marco" 
            value={newCheckpoint.descricao} 
            onChange={(e) => setNewCheckpoint({ ...newCheckpoint, descricao: e.target.value })}
            className="h-8 text-sm flex-1"
            data-testid={`input-checkpoint-descricao-${pdiId}`}
          />
          <Input 
            type="date" 
            value={newCheckpoint.dataAlvo} 
            onChange={(e) => setNewCheckpoint({ ...newCheckpoint, dataAlvo: e.target.value })}
            className="h-8 text-sm w-36"
            data-testid={`input-checkpoint-data-${pdiId}`}
          />
          <Button 
            size="sm" 
            className="h-8" 
            onClick={() => addCheckpointMutation.mutate(newCheckpoint)}
            disabled={!newCheckpoint.descricao || addCheckpointMutation.isPending}
            data-testid={`button-save-checkpoint-${pdiId}`}
          >
            {addCheckpointMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          </Button>
        </div>
      )}

      {checkpoints.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nenhum marco definido</p>
      ) : (
        <div className="space-y-2">
          {checkpoints.map((cp, idx) => {
            const status = getCheckpointStatus(cp);
            return (
              <div 
                key={cp.id} 
                className="flex items-center gap-2 text-sm"
                data-testid={`checkpoint-${cp.id}`}
              >
                <button
                  onClick={() => toggleCheckpointMutation.mutate({ id: cp.id, concluido: cp.concluido === "true" ? "false" : "true" })}
                  className="flex-shrink-0"
                  data-testid={`button-toggle-checkpoint-${cp.id}`}
                >
                  {status === "completed" ? (
                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  ) : status === "overdue" ? (
                    <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                      <AlertTriangle className="w-3 h-3 text-white" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                  )}
                </button>
                <span className={`flex-1 ${status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                  {cp.descricao}
                </span>
                {cp.dataAlvo && (
                  <span className={`text-xs ${status === "overdue" ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                    {formatDateFns(cp.dataAlvo)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PdiCard({ colaboradorId }: { colaboradorId: string }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPdi, setEditingPdi] = useState<PdiItem | null>(null);
  const [expandedPdi, setExpandedPdi] = useState<number | null>(null);
  const [formData, setFormData] = useState({ titulo: "", descricao: "", competencia: "", categoria: "", recursos: "", prazo: "" });

  const { data: pdiGoals = [], isLoading } = useQuery<PdiItem[]>({
    queryKey: ["/api/colaboradores", colaboradorId, "pdi"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: { titulo: string; descricao: string; competencia: string; categoria: string; recursos: string; prazo: string }) => {
      const response = await apiRequest("POST", `/api/colaboradores/${colaboradorId}/pdi`, { ...data, colaboradorId: Number(colaboradorId) });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colaboradores", colaboradorId, "pdi"] });
      toast({ title: "Objetivo adicionado", description: "O objetivo PDI foi criado com sucesso." });
      setDialogOpen(false);
      setFormData({ titulo: "", descricao: "", competencia: "", categoria: "", recursos: "", prazo: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar objetivo", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; progresso?: number; status?: string }) => {
      const response = await apiRequest("PUT", `/api/pdi/${id}`, data);
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

  const getCategoryBadge = (categoria: string | null) => {
    const cat = PDI_CATEGORIES.find(c => c.value === categoria);
    if (!cat) return null;
    return <Badge className={cat.color}>{cat.label}</Badge>;
  };

  const getDueDateInfo = (prazo: string | null) => {
    if (!prazo) return null;
    const targetDate = new Date(prazo);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { text: `Atrasado ${Math.abs(diffDays)} dias`, isOverdue: true };
    } else if (diffDays === 0) {
      return { text: "Vence hoje", isOverdue: false, isUrgent: true };
    } else if (diffDays <= 7) {
      return { text: `${diffDays} dias restantes`, isOverdue: false, isUrgent: true };
    }
    return { text: `${diffDays} dias restantes`, isOverdue: false };
  };

  const getProgressIcon = (progresso: number, status: string | null) => {
    if (progresso >= 100 || status === "concluido") {
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    }
    return <Clock className="w-5 h-5 text-blue-500" />;
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
        <div className="space-y-4 max-h-[500px] overflow-y-auto">
          {pdiGoals.map((pdi) => {
            const dueDateInfo = getDueDateInfo(pdi.prazo);
            return (
              <div key={pdi.id} className="border rounded-lg p-4 space-y-3" data-testid={`pdi-${pdi.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium">{pdi.titulo}</h4>
                      {getCategoryBadge(pdi.categoria)}
                    </div>
                    {pdi.competencia && <p className="text-xs text-muted-foreground mt-1">{pdi.competencia}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {getProgressIcon(pdi.progresso, pdi.status)}
                    {getStatusBadge(pdi.status)}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>Progresso</span>
                  </div>
                  <PdiProgressBar progresso={pdi.progresso} />
                </div>

                {pdi.prazo && dueDateInfo && (
                  <div className={`flex items-center gap-1 text-xs ${dueDateInfo.isOverdue ? "text-red-500 font-medium" : dueDateInfo.isUrgent ? "text-orange-500" : "text-muted-foreground"}`}>
                    {dueDateInfo.isOverdue ? (
                      <AlertTriangle className="w-3 h-3" />
                    ) : (
                      <Calendar className="w-3 h-3" />
                    )}
                    <span>{formatDateFns(pdi.prazo)} - {dueDateInfo.text}</span>
                  </div>
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
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => setExpandedPdi(expandedPdi === pdi.id ? null : pdi.id)}
                    data-testid={`button-toggle-checkpoints-${pdi.id}`}
                  >
                    {expandedPdi === pdi.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    Marcos
                  </Button>
                </div>

                {expandedPdi === pdi.id && (
                  <PdiCheckpointTimeline pdiId={pdi.id} colaboradorId={colaboradorId} />
                )}
              </div>
            );
          })}
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
              <label className="text-sm font-medium">Categoria</label>
              <Select value={formData.categoria} onValueChange={(v) => setFormData({ ...formData, categoria: v })}>
                <SelectTrigger data-testid="select-pdi-categoria">
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {PDI_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <div className="mt-2">
                  <PdiProgressBar progresso={editingPdi.progresso} />
                </div>
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

interface HealthHistoryItem {
  month: string;
  healthScore: number;
}

const MONTH_NAMES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MONTH_NAMES_SHORT = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Interface para pagamentos do Conta Azul
interface PagamentoCazItem {
  id: number;
  descricao: string;
  valor_bruto: string;
  data_pagamento: string;
  data_vencimento: string;
  status: string;
  categoria_nome: string;
  mes_referencia: number;
  ano_referencia: number;
  nf_status: string;
}

// Card compacto de Financeiro para a aba de Informações
function FinanceiroCard({ colaboradorId, colaborador }: { colaboradorId: string; colaborador: Colaborador }) {
  const { toast } = useToast();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Buscar pagamentos do Conta Azul pelo PIX/CNPJ do colaborador
  const { data: pagamentos = [], isLoading } = useQuery<PagamentoCazItem[]>({
    queryKey: ["/api/rh/colaborador", colaboradorId, "pagamentos-caz"],
    queryFn: async () => {
      const res = await fetch(`/api/rh/colaborador/${colaboradorId}/pagamentos-caz`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar pagamentos");
      return res.json();
    },
  });

  const handleFileUpload = async (file: File) => {
    try {
      setUploading(true);
      
      const requestRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "application/pdf",
        }),
      });

      if (!requestRes.ok) {
        throw new Error("Falha ao solicitar URL de upload");
      }

      const { uploadURL, objectPath } = await requestRes.json();

      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/pdf" },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("Falha ao fazer upload do arquivo");
      }

      await apiRequest("POST", `/api/rh/colaboradores/${colaboradorId}/nf`, {
        arquivoPath: objectPath,
        arquivoNome: file.name,
        mesReferencia: selectedMonth,
        anoReferencia: selectedYear,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/rh/colaborador", colaboradorId, "pagamentos-caz"] });

      toast({
        title: "Nota fiscal enviada",
        description: `A NF foi enviada com sucesso para ${MONTH_NAMES[selectedMonth]}/${selectedYear}`,
      });

      setUploadDialogOpen(false);
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Erro no upload",
        description: "Não foi possível anexar a nota fiscal. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];
  
  const pagamentosRecentes = pagamentos
    .sort((a, b) => {
      const dateA = a.ano_referencia * 12 + a.mes_referencia;
      const dateB = b.ano_referencia * 12 + b.mes_referencia;
      return dateB - dateA;
    })
    .slice(0, 4);

  const nfsAnexadas = pagamentos.filter(p => p.nf_status === "nf_anexada").length;

  // Calcular total de premiações e bônus (pagamentos com categoria "Premiações")
  const totalPremiacoes = pagamentos
    .filter(p => p.categoria_nome?.toLowerCase().includes("premia") || p.categoria_nome?.toLowerCase().includes("bonus") || p.categoria_nome?.toLowerCase().includes("bônus"))
    .reduce((sum, p) => sum + parseFloat(p.valor_bruto || "0"), 0);

  // Calcular total geral de todos os pagamentos
  const totalGeral = pagamentos.reduce((sum, p) => sum + parseFloat(p.valor_bruto || "0"), 0);

  return (
    <Card className="p-5 hover-elevate" data-testid="card-financeiro-resumo">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            Financeiro
          </h2>
          <UITooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs p-4">
              <div className="space-y-2 text-sm">
                <p className="font-semibold">Instruções para emissão de NF:</p>
                <div className="space-y-1.5">
                  <p><span className="font-medium">Nome do Tomador:</span> Turbo Partners LTDA</p>
                  <p><span className="font-medium">CNPJ:</span> 42.100.292/0001-84</p>
                  <p><span className="font-medium">Código Serviço:</span> —</p>
                  <p><span className="font-medium">Descrição:</span> —</p>
                </div>
                <p className="text-muted-foreground pt-2 border-t">
                  Dúvidas? Envie email para{" "}
                  <a href="mailto:financeiro@turbopartners.com.br" className="text-primary hover:underline">
                    financeiro@turbopartners.com.br
                  </a>
                </p>
              </div>
            </TooltipContent>
          </UITooltip>
        </div>
        <Button 
          size="sm" 
          onClick={() => setUploadDialogOpen(true)}
          data-testid="button-add-nf"
        >
          <Plus className="w-4 h-4 mr-1" />
          Nota Fiscal
        </Button>
      </div>

      {/* Resumo financeiro */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-xs text-muted-foreground mb-1">Salário Atual</p>
          <p className="text-base font-bold text-green-600 dark:text-green-400">
            {colaborador.salario ? `R$ ${parseFloat(colaborador.salario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : "-"}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-xs text-muted-foreground mb-1">NFs Enviadas</p>
          <p className="text-base font-bold">
            {nfsAnexadas} / {pagamentos.length}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-xs text-muted-foreground mb-1">Total Premiações</p>
          <p className="text-base font-bold text-purple-600 dark:text-purple-400" data-testid="text-total-premiacoes">
            R$ {totalPremiacoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-xs text-muted-foreground mb-1">Total Recebido</p>
          <p className="text-base font-bold text-blue-600 dark:text-blue-400" data-testid="text-total-geral">
            R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Histórico completo de pagamentos */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : pagamentos.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Histórico Completo ({pagamentos.length} faturas)</p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {pagamentos
              .sort((a, b) => {
                const dateA = a.ano_referencia * 12 + a.mes_referencia;
                const dateB = b.ano_referencia * 12 + b.mes_referencia;
                return dateB - dateA;
              })
              .map((pagamento) => {
              const temNf = pagamento.nf_status === "nf_anexada";
              const isPremiacao = pagamento.categoria_nome?.toLowerCase().includes("premia") || 
                                  pagamento.categoria_nome?.toLowerCase().includes("bonus") || 
                                  pagamento.categoria_nome?.toLowerCase().includes("bônus");
              return (
                <div 
                  key={pagamento.id} 
                  className="flex items-center justify-between p-2 rounded-md bg-muted/30"
                  data-testid={`row-pagamento-${pagamento.id}`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0",
                      temNf ? "bg-green-500" : "bg-amber-500"
                    )} />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm">
                        {MONTH_NAMES_SHORT[pagamento.mes_referencia]}/{pagamento.ano_referencia}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {isPremiacao ? (
                          <span className="text-purple-600 dark:text-purple-400 font-medium">Premiação</span>
                        ) : (
                          pagamento.descricao || "Fixo"
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn(
                      "text-sm font-mono font-medium",
                      isPremiacao && "text-purple-600 dark:text-purple-400"
                    )}>
                      R$ {parseFloat(pagamento.valor_bruto || "0").toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    {temNf ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-4" data-testid="text-no-pagamentos">
          <p className="text-sm text-muted-foreground">Nenhum pagamento registrado</p>
        </div>
      )}

      {/* Dialog para upload de NF */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              Enviar Nota Fiscal
            </DialogTitle>
            <DialogDescription>
              Selecione o mês/ano de referência e anexe o arquivo da NF.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Informações do Tomador */}
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1.5 text-sm">
                  <p className="font-semibold text-blue-900 dark:text-blue-100">Dados do Tomador:</p>
                  <p><span className="font-medium">Nome:</span> Turbo Partners LTDA</p>
                  <p><span className="font-medium">CNPJ:</span> 42.100.292/0001-84</p>
                  <p className="text-xs text-muted-foreground pt-1">
                    Dúvidas? <a href="mailto:financeiro@turbopartners.com.br" className="text-primary hover:underline">financeiro@turbopartners.com.br</a>
                  </p>
                </div>
              </div>
            </div>

            {/* Seletor de Mês/Ano */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Mês</label>
                <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                  <SelectTrigger data-testid="select-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.slice(1).map((month, index) => (
                      <SelectItem key={index + 1} value={(index + 1).toString()}>{month}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Ano</label>
                <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                  <SelectTrigger data-testid="select-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Upload de arquivo */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Arquivo da NF</label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="nf-upload"
                  disabled={uploading}
                  data-testid="input-nf-file"
                />
                <label htmlFor="nf-upload" className="cursor-pointer">
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Enviando...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-8 h-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Clique para selecionar ou arraste o arquivo
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        PDF, PNG ou JPG (máx. 10MB)
                      </p>
                    </div>
                  )}
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)} disabled={uploading}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function FinanceiroTab({ colaboradorId }: { colaboradorId: string }) {
  const { toast } = useToast();
  const [selectedPagamento, setSelectedPagamento] = useState<PagamentoItem | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewingNf, setViewingNf] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: pagamentos = [], isLoading } = useQuery<PagamentoItem[]>({
    queryKey: ["/api/rh/pagamentos", colaboradorId],
  });

  const handleViewNf = async (pagamentoId: number) => {
    try {
      setViewingNf(pagamentoId);
      const res = await fetch(`/api/rh/pagamentos/${pagamentoId}/nf`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar NF");
      const nf = await res.json();
      if (nf?.arquivo_path) {
        window.open(nf.arquivo_path, "_blank");
      } else {
        toast({ title: "NF não encontrada", description: "O arquivo da nota fiscal não está disponível.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error viewing NF:", error);
      toast({ title: "Erro", description: "Não foi possível visualizar a nota fiscal.", variant: "destructive" });
    } finally {
      setViewingNf(null);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!selectedPagamento) return;

    try {
      setUploading(true);
      
      const requestRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "application/pdf",
        }),
      });

      if (!requestRes.ok) {
        throw new Error("Falha ao solicitar URL de upload");
      }

      const { uploadURL, objectPath } = await requestRes.json();

      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/pdf" },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("Falha ao fazer upload do arquivo");
      }

      await apiRequest("POST", `/api/rh/pagamentos/${selectedPagamento.id}/nf`, {
        arquivoPath: objectPath,
        arquivoNome: file.name,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/rh/colaborador", colaboradorId, "pagamentos-caz"] });

      toast({
        title: "Nota fiscal anexada",
        description: `A NF foi enviada com sucesso para ${MONTH_NAMES[selectedPagamento.mes_referencia]}/${selectedPagamento.ano_referencia}`,
      });

      setUploadDialogOpen(false);
      setSelectedPagamento(null);
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Erro no upload",
        description: "Não foi possível anexar a nota fiscal. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (pagamentos.length === 0) {
    return (
      <Card className="p-8" data-testid="card-no-pagamentos">
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-6">
            <Receipt className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Nenhum pagamento registrado</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Os pagamentos deste colaborador serão exibidos aqui assim que forem registrados no sistema.
          </p>
        </div>
      </Card>
    );
  }

  const availableYears = [...new Set(pagamentos.map(p => p.ano_referencia))].sort((a, b) => b - a);
  const pagamentosAnoSelecionado = pagamentos.filter(p => p.ano_referencia === selectedYear);
  const totalAnoSelecionado = pagamentosAnoSelecionado.reduce((sum, p) => sum + parseFloat(p.valor_bruto || "0"), 0);
  const nfsAnexadasAno = pagamentosAnoSelecionado.filter(p => parseInt(p.total_nfs || "0") > 0 || p.status === "nf_anexada").length;
  const nfsPendentes = pagamentosAnoSelecionado.length - nfsAnexadasAno;
  
  const pagamentosPorMes = new Map<number, PagamentoItem>();
  pagamentosAnoSelecionado.forEach(p => {
    pagamentosPorMes.set(p.mes_referencia, p);
  });

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6" data-testid="tab-content-financeiro">
      {/* Header com seletor de ano */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <Receipt className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Notas Fiscais</h2>
            <p className="text-sm text-muted-foreground">Histórico de pagamentos e envio de NFs</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-32" data-testid="select-year">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(year => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="flex border rounded-lg overflow-hidden">
            <Button 
              variant={viewMode === "grid" ? "secondary" : "ghost"} 
              size="sm" 
              className="rounded-none px-3"
              onClick={() => setViewMode("grid")}
              data-testid="button-view-grid"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button 
              variant={viewMode === "list" ? "secondary" : "ghost"} 
              size="sm" 
              className="rounded-none px-3"
              onClick={() => setViewMode("list")}
              data-testid="button-view-list"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 hover-elevate" data-testid="card-total-ano">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total {selectedYear}</p>
              <p className="text-lg font-bold">R$ {totalAnoSelecionado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover-elevate" data-testid="card-pagamentos-count">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pagamentos</p>
              <p className="text-lg font-bold">{pagamentosAnoSelecionado.length} meses</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover-elevate" data-testid="card-nfs-anexadas">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">NFs Anexadas</p>
              <p className="text-lg font-bold">{nfsAnexadasAno} / {pagamentosAnoSelecionado.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover-elevate" data-testid="card-nfs-pendentes">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pendentes</p>
              <p className="text-lg font-bold">{nfsPendentes}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Progress bar */}
      {pagamentosAnoSelecionado.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progresso de envio de NFs</span>
            <span className="text-sm text-muted-foreground">
              {Math.round((nfsAnexadasAno / pagamentosAnoSelecionado.length) * 100)}%
            </span>
          </div>
          <Progress value={(nfsAnexadasAno / pagamentosAnoSelecionado.length) * 100} className="h-2" />
        </Card>
      )}

      {/* Grid View - Mês a Mês */}
      {viewMode === "grid" ? (
        <Card className="p-6" data-testid="card-nf-grid">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Notas Fiscais por Mês - {selectedYear}
          </h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(mes => {
              const pagamento = pagamentosPorMes.get(mes);
              const hasNf = pagamento && (parseInt(pagamento.total_nfs || "0") > 0 || pagamento.status === "nf_anexada");
              const isFutureMonth = selectedYear === currentYear && mes > currentMonth;
              const isPastMonthWithoutPayment = !pagamento && !isFutureMonth;
              
              return (
                <Card 
                  key={mes}
                  className={cn(
                    "p-4 relative transition-all cursor-pointer",
                    hasNf 
                      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:border-green-400" 
                      : pagamento 
                        ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 hover:border-amber-400"
                        : isFutureMonth
                          ? "bg-muted/30 border-dashed opacity-50"
                          : "bg-muted/50 border-dashed",
                    "hover-elevate"
                  )}
                  onClick={() => {
                    if (pagamento && !hasNf) {
                      setSelectedPagamento(pagamento);
                      setUploadDialogOpen(true);
                    } else if (hasNf && pagamento) {
                      handleViewNf(pagamento.id);
                    }
                  }}
                  data-testid={`card-month-${mes}`}
                >
                  {hasNf && (
                    <div className="absolute -top-1.5 -right-1.5">
                      <div className="bg-green-500 rounded-full p-1">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    </div>
                  )}
                  
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      {MONTH_NAMES_SHORT[mes]}
                    </p>
                    <p className="font-bold text-lg">
                      {mes.toString().padStart(2, '0')}
                    </p>
                    
                    {pagamento ? (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          R$ {parseFloat(pagamento.valor_bruto).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                        </p>
                        {hasNf ? (
                          <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <Eye className="w-3 h-3 mr-1" />
                            Ver NF
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            <Upload className="w-3 h-3 mr-1" />
                            Anexar
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-2">
                        {isFutureMonth ? "Futuro" : "—"}
                      </p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </Card>
      ) : (
        /* List View */
        <Card className="p-6" data-testid="card-pagamentos-lista">
          <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Histórico de Pagamentos - {selectedYear}
            </h3>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead>Valor Bruto</TableHead>
                  <TableHead>Valor Líquido</TableHead>
                  <TableHead>Data Pagamento</TableHead>
                  <TableHead>Status NF</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagamentosAnoSelecionado
                  .sort((a, b) => b.mes_referencia - a.mes_referencia)
                  .map((pagamento) => {
                    const hasNf = parseInt(pagamento.total_nfs || "0") > 0 || pagamento.status === "nf_anexada";
                    return (
                      <TableRow key={pagamento.id} data-testid={`row-pagamento-${pagamento.id}`}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              hasNf ? "bg-green-500" : "bg-amber-500"
                            )} />
                            {MONTH_NAMES[pagamento.mes_referencia]}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono font-medium">
                          R$ {parseFloat(pagamento.valor_bruto).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          {pagamento.valor_liquido 
                            ? `R$ ${parseFloat(pagamento.valor_liquido).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                            : "-"
                          }
                        </TableCell>
                        <TableCell>
                          {pagamento.data_pagamento 
                            ? format(new Date(pagamento.data_pagamento), "dd/MM/yyyy")
                            : "-"
                          }
                        </TableCell>
                        <TableCell>
                          {hasNf ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Anexada
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Pendente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {hasNf ? (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="gap-1"
                                onClick={() => handleViewNf(pagamento.id)}
                                disabled={viewingNf === pagamento.id}
                                data-testid={`button-view-nf-${pagamento.id}`}
                              >
                                {viewingNf === pagamento.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                                Ver NF
                              </Button>
                            ) : (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="gap-1"
                                onClick={() => {
                                  setSelectedPagamento(pagamento);
                                  setUploadDialogOpen(true);
                                }}
                                data-testid={`button-upload-nf-${pagamento.id}`}
                              >
                                <Upload className="w-4 h-4" />
                                Anexar NF
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Dialog de Upload */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Anexar Nota Fiscal
            </DialogTitle>
            <DialogDescription>
              {selectedPagamento && (
                <div className="mt-2 p-3 bg-muted rounded-lg">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Referência:</span>
                      <p className="font-medium">{MONTH_NAMES[selectedPagamento.mes_referencia]}/{selectedPagamento.ano_referencia}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Valor:</span>
                      <p className="font-medium">R$ {parseFloat(selectedPagamento.valor_bruto).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label 
              htmlFor="nf-upload"
              className={cn(
                "flex flex-col items-center justify-center w-full h-44 border-2 border-dashed rounded-xl cursor-pointer transition-all",
                uploading 
                  ? "bg-primary/5 border-primary/30" 
                  : "hover:bg-muted/50 hover:border-primary/50"
              )}
            >
              {uploading ? (
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                  </div>
                  <p className="text-sm font-medium mt-4">Enviando arquivo...</p>
                  <p className="text-xs text-muted-foreground mt-1">Aguarde enquanto processamos</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="p-4 rounded-full bg-primary/10 mb-3">
                    <Upload className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-sm font-medium">Clique para selecionar o arquivo</p>
                  <p className="text-xs text-muted-foreground mt-1">ou arraste e solte aqui</p>
                  <div className="flex items-center gap-2 mt-3">
                    <Badge variant="outline" className="text-xs">PDF</Badge>
                    <Badge variant="outline" className="text-xs">PNG</Badge>
                    <Badge variant="outline" className="text-xs">JPG</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Tamanho máximo: 10MB</p>
                </div>
              )}
              <input 
                id="nf-upload"
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileSelect}
                disabled={uploading}
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)} disabled={uploading}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
  '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez'
};

const EVENT_TYPE_CONFIG: Record<string, { icon: typeof Calendar; label: string; color: string; bgColor: string }> = {
  enps: { icon: BarChart2, label: "E-NPS", color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
  one_on_one: { icon: MessageSquare, label: "1x1", color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-100 dark:bg-purple-900/30" },
  pdi: { icon: Target, label: "PDI", color: "text-green-600 dark:text-green-400", bgColor: "bg-green-100 dark:bg-green-900/30" },
  pdi_checkpoint: { icon: CheckCircle2, label: "Checkpoint PDI", color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-100 dark:bg-emerald-900/30" },
  promocao: { icon: TrendingUp, label: "Promoção", color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
  health: { icon: Award, label: "Health Score", color: "text-pink-600 dark:text-pink-400", bgColor: "bg-pink-100 dark:bg-pink-900/30" },
};

function TimelineCard({ colaboradorId }: { colaboradorId: string }) {
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState(false);

  const { data: events = [], isLoading } = useQuery<TimelineEvent[]>({
    queryKey: ["/api/colaboradores", colaboradorId, "timeline"],
  });

  const filteredEvents = filter === "all" 
    ? events 
    : events.filter(e => e.type === filter);

  const displayEvents = expanded ? filteredEvents : filteredEvents.slice(0, 5);

  const formatEventDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return format(date, "dd MMM yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const getEventConfig = (type: string) => {
    return EVENT_TYPE_CONFIG[type] || { icon: Calendar, label: type, color: "text-muted-foreground", bgColor: "bg-muted" };
  };

  return (
    <Card className="p-6 md:col-span-2" data-testid="card-timeline">
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-gradient-to-br from-primary/20 to-orange-500/20">
            <Clock className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Timeline do Colaborador</h3>
            <p className="text-xs text-muted-foreground">{events.length} evento{events.length !== 1 ? "s" : ""} registrado{events.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-timeline-filter">
            <SelectValue placeholder="Filtrar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="enps">E-NPS</SelectItem>
            <SelectItem value="one_on_one">1x1</SelectItem>
            <SelectItem value="pdi">PDI</SelectItem>
            <SelectItem value="pdi_checkpoint">Checkpoints</SelectItem>
            <SelectItem value="promocao">Promoções</SelectItem>
            <SelectItem value="health">Health Score</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-8">
          <Clock className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground text-sm">Nenhum evento registrado ainda</p>
        </div>
      ) : (
        <>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
            <div className="space-y-4">
              {displayEvents.map((event) => {
                const config = getEventConfig(event.type);
                const IconComponent = config.icon;
                return (
                  <div key={event.id} className="relative pl-10" data-testid={`timeline-event-${event.id}`}>
                    <div className={`absolute left-2 top-1 p-1.5 rounded-full ${config.bgColor} ring-4 ring-background`}>
                      <IconComponent className={`w-3 h-3 ${config.color}`} />
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 hover-elevate">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className={`text-xs ${config.bgColor} ${config.color}`}>
                              {config.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatEventDate(event.date)}
                            </span>
                          </div>
                          <p className="font-medium text-sm mt-1">{event.title}</p>
                          {event.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.description}</p>
                          )}
                        </div>
                        {event.type === "enps" && event.metadata.score !== undefined && (
                          <div className={`text-xl font-bold ${
                            event.metadata.score >= 9 ? "text-green-600 dark:text-green-400" :
                            event.metadata.score >= 7 ? "text-yellow-600 dark:text-yellow-400" :
                            "text-red-600 dark:text-red-400"
                          }`}>
                            {event.metadata.score}
                          </div>
                        )}
                        {event.type === "health" && event.metadata.score !== undefined && (
                          <div className={`text-xl font-bold ${
                            event.metadata.score >= 70 ? "text-green-600 dark:text-green-400" :
                            event.metadata.score >= 40 ? "text-yellow-600 dark:text-yellow-400" :
                            "text-red-600 dark:text-red-400"
                          }`}>
                            {event.metadata.score}%
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {filteredEvents.length > 5 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full mt-4" 
              onClick={() => setExpanded(!expanded)}
              data-testid="button-toggle-timeline"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  Mostrar menos
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  Ver mais {filteredEvents.length - 5} evento{filteredEvents.length - 5 !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          )}
        </>
      )}
    </Card>
  );
}

function HealthCard({ colaboradorId }: { colaboradorId: string }) {
  const { data: enpsResponses = [], isLoading: enpsLoading } = useQuery<EnpsItem[]>({
    queryKey: ["/api/colaboradores", colaboradorId, "enps"],
  });

  const { data: oneOnOnes = [], isLoading: oneOnOneLoading } = useQuery<OneOnOneItem[]>({
    queryKey: ["/api/colaboradores", colaboradorId, "one-on-one"],
  });

  const { data: pdiGoals = [], isLoading: pdiLoading } = useQuery<PdiItem[]>({
    queryKey: ["/api/colaboradores", colaboradorId, "pdi"],
  });

  const { data: healthHistory = [], isLoading: historyLoading } = useQuery<HealthHistoryItem[]>({
    queryKey: ["/api/colaboradores", colaboradorId, "health-history"],
  });

  const isLoading = enpsLoading || oneOnOneLoading || pdiLoading;

  const lastEnps = enpsResponses.length > 0 ? enpsResponses[0] : null;
  const enpsCategory = lastEnps ? getEnpsCategory(lastEnps.score) : null;

  const enpsTrend = (() => {
    if (enpsResponses.length < 2) return { icon: Minus, color: "text-muted-foreground" };
    const recent = enpsResponses.slice(0, Math.min(3, enpsResponses.length));
    const previous = enpsResponses.slice(Math.min(3, enpsResponses.length), Math.min(6, enpsResponses.length));
    if (previous.length === 0) return { icon: Minus, color: "text-muted-foreground" };
    const recentAvg = recent.reduce((sum, r) => sum + r.score, 0) / recent.length;
    const prevAvg = previous.reduce((sum, r) => sum + r.score, 0) / previous.length;
    const diff = recentAvg - prevAvg;
    if (diff > 0.5) return { icon: TrendingUp, color: "text-green-600 dark:text-green-400" };
    if (diff < -0.5) return { icon: TrendingDown, color: "text-red-600 dark:text-red-400" };
    return { icon: Minus, color: "text-yellow-600 dark:text-yellow-400" };
  })();

  const lastOneOnOne = oneOnOnes.length > 0 ? oneOnOnes[0] : null;
  const daysSinceLastOneOnOne = lastOneOnOne
    ? Math.floor((new Date().getTime() - new Date(lastOneOnOne.data).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const allAcoes = oneOnOnes.flatMap(m => m.acoes || []);
  const pendingAcoes = allAcoes.filter(a => a.status !== "concluida");

  const pdiProgress = pdiGoals.length > 0
    ? Math.round(pdiGoals.reduce((sum, p) => sum + p.progresso, 0) / pdiGoals.length)
    : 0;

  const activePdiCount = pdiGoals.filter(p => p.status !== "concluido" && p.status !== "cancelado").length;

  const calculateHealthScore = (): number => {
    let score = 0;
    let totalWeight = 0;

    if (lastEnps) {
      totalWeight += 30;
      if (lastEnps.score >= 9) score += 30;
      else if (lastEnps.score >= 7) score += 20;
      else if (lastEnps.score >= 5) score += 10;
    }

    if (daysSinceLastOneOnOne !== null) {
      totalWeight += 25;
      if (daysSinceLastOneOnOne <= 14) score += 25;
      else if (daysSinceLastOneOnOne <= 30) score += 15;
      else if (daysSinceLastOneOnOne <= 45) score += 5;
    }

    totalWeight += 25;
    score += Math.round((pdiProgress / 100) * 25);

    totalWeight += 20;
    if (pendingAcoes.length === 0) score += 20;
    else if (pendingAcoes.length <= 2) score += 15;
    else if (pendingAcoes.length <= 5) score += 10;
    else if (pendingAcoes.length <= 8) score += 5;

    return totalWeight > 0 ? Math.round((score / totalWeight) * 100) : 0;
  };

  const healthScore = calculateHealthScore();

  const getHealthColor = (score: number) => {
    if (score >= 80) return { bg: "text-green-500", stroke: "#22c55e", label: "Excelente" };
    if (score >= 50) return { bg: "text-yellow-500", stroke: "#eab308", label: "Atenção" };
    return { bg: "text-red-500", stroke: "#ef4444", label: "Crítico" };
  };

  const healthColor = getHealthColor(healthScore);

  const getOneOnOneStatus = () => {
    if (daysSinceLastOneOnOne === null) return { status: "none", color: "text-muted-foreground", icon: Minus, label: "Sem registro" };
    if (daysSinceLastOneOnOne > 30) return { status: "critical", color: "text-red-600 dark:text-red-400", icon: AlertTriangle, label: `${daysSinceLastOneOnOne} dias` };
    if (daysSinceLastOneOnOne > 14) return { status: "warning", color: "text-yellow-600 dark:text-yellow-400", icon: Clock, label: `${daysSinceLastOneOnOne} dias` };
    return { status: "healthy", color: "text-green-600 dark:text-green-400", icon: CheckCircle2, label: `${daysSinceLastOneOnOne} dias` };
  };

  const oneOnOneStatus = getOneOnOneStatus();

  const getAcoesStatus = () => {
    if (pendingAcoes.length === 0) return { status: "healthy", color: "text-green-600 dark:text-green-400", icon: CheckCircle2 };
    if (pendingAcoes.length > 5) return { status: "critical", color: "text-red-600 dark:text-red-400", icon: AlertTriangle };
    if (pendingAcoes.length > 2) return { status: "warning", color: "text-yellow-600 dark:text-yellow-400", icon: Clock };
    return { status: "healthy", color: "text-green-600 dark:text-green-400", icon: CheckCircle2 };
  };

  const acoesStatus = getAcoesStatus();

  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (healthScore / 100) * circumference;

  if (isLoading) {
    return (
      <Card className="p-6 col-span-full" data-testid="card-health-loading">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 col-span-full" data-testid="card-saude-colaborador">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
          <User className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Saúde do Colaborador</h3>
          <p className="text-xs text-muted-foreground">Visão consolidada dos indicadores de desenvolvimento</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex flex-col items-center justify-center lg:border-r lg:pr-6">
          <div className="relative w-28 h-28">
            <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted/30"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke={healthColor.stroke}
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{ transition: "stroke-dashoffset 0.5s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold ${healthColor.bg}`} data-testid="text-health-score">{healthScore}</span>
              <span className="text-[10px] text-muted-foreground uppercase">Score</span>
            </div>
          </div>
          <Badge className={`mt-2 ${healthScore >= 80 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : healthScore >= 50 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`} data-testid="badge-health-status">
            {healthColor.label}
          </Badge>
        </div>

        <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-muted/50 space-y-2" data-testid="indicator-enps">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase font-medium">E-NPS</span>
              {lastEnps && <enpsTrend.icon className={`w-4 h-4 ${enpsTrend.color}`} />}
            </div>
            {lastEnps ? (
              <>
                <p className={`text-3xl font-bold ${enpsCategory?.color}`} data-testid="text-enps-score">{lastEnps.score}</p>
                <Badge className={`text-xs ${enpsCategory?.bgColor} ${enpsCategory?.color}`} data-testid="badge-enps-category">
                  {enpsCategory?.label}
                </Badge>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Sem registro</p>
            )}
          </div>

          <div className="p-4 rounded-lg bg-muted/50 space-y-2" data-testid="indicator-1x1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase font-medium">Último 1x1</span>
              <oneOnOneStatus.icon className={`w-4 h-4 ${oneOnOneStatus.color}`} />
            </div>
            <p className={`text-3xl font-bold ${oneOnOneStatus.color}`} data-testid="text-1x1-days">
              {daysSinceLastOneOnOne !== null ? daysSinceLastOneOnOne : "-"}
            </p>
            <p className="text-xs text-muted-foreground">dias atrás</p>
          </div>

          <div className="p-4 rounded-lg bg-muted/50 space-y-2" data-testid="indicator-pdi">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase font-medium">PDI</span>
              {pdiProgress >= 70 ? (
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
              ) : pdiProgress >= 40 ? (
                <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              )}
            </div>
            <p className={`text-3xl font-bold ${pdiProgress >= 70 ? "text-green-600 dark:text-green-400" : pdiProgress >= 40 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-pdi-progress">
              {pdiProgress}%
            </p>
            <p className="text-xs text-muted-foreground">{activePdiCount} objetivo{activePdiCount !== 1 ? "s" : ""} ativo{activePdiCount !== 1 ? "s" : ""}</p>
          </div>

          <div className="p-4 rounded-lg bg-muted/50 space-y-2" data-testid="indicator-acoes">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase font-medium">Ações</span>
              <acoesStatus.icon className={`w-4 h-4 ${acoesStatus.color}`} />
            </div>
            <p className={`text-3xl font-bold ${acoesStatus.color}`} data-testid="text-acoes-pendentes">
              {pendingAcoes.length}
            </p>
            <p className="text-xs text-muted-foreground">pendente{pendingAcoes.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>

      {!historyLoading && healthHistory.length === 0 && (
        <div className="mt-6 pt-6 border-t" data-testid="health-no-history">
          <p className="text-xs text-muted-foreground uppercase font-medium mb-2">Evolução</p>
          <p className="text-xs text-muted-foreground italic">Sem histórico suficiente para exibir gráfico</p>
        </div>
      )}

      {!historyLoading && healthHistory.length > 0 && (
        <div className="mt-6 pt-6 border-t" data-testid="health-evolution-chart">
          <p className="text-xs text-muted-foreground uppercase font-medium mb-3">Evolução</p>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart 
                data={healthHistory.map(item => ({
                  ...item,
                  label: MONTH_LABELS[item.month.split('-')[1]] || item.month.split('-')[1]
                }))} 
                margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="healthGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.8}/>
                    <stop offset="40%" stopColor="#eab308" stopOpacity={0.5}/>
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.3}/>
                  </linearGradient>
                </defs>
                <ReferenceArea y1={80} y2={100} fill="#22c55e" fillOpacity={0.1} />
                <ReferenceArea y1={50} y2={80} fill="#eab308" fillOpacity={0.1} />
                <ReferenceArea y1={0} y2={50} fill="#ef4444" fillOpacity={0.1} />
                <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.5} />
                <ReferenceLine y={50} stroke="#eab308" strokeDasharray="3 3" strokeOpacity={0.5} />
                <XAxis 
                  dataKey="label" 
                  tick={{ fontSize: 11 }} 
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis 
                  domain={[0, 100]} 
                  ticks={[0, 25, 50, 75, 100]} 
                  tick={{ fontSize: 11 }} 
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const score = payload[0].value as number;
                      const color = score >= 80 ? "text-green-600" : score >= 50 ? "text-yellow-600" : "text-red-600";
                      return (
                        <div className="bg-background border rounded-lg shadow-lg p-2">
                          <p className={`font-bold ${color}`}>{score}</p>
                          <p className="text-xs text-muted-foreground">Health Score</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="healthScore" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  fill="url(#healthGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function DetailColaborador() {
  usePageTitle("Detalhes do Colaborador");
  const { setPageInfo } = usePageInfo();
  const { user } = useAuth();
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

  // Verificar se usuário pode ver a aba Financeiro (admin ou próprio colaborador)
  const canViewFinanceiro = () => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    // Verificar se o email do usuário coincide com o email do colaborador
    const userEmail = user.email?.toLowerCase().trim();
    const colaboradorEmail = colaborador?.emailTurbo?.toLowerCase().trim();
    return userEmail && colaboradorEmail && userEmail === colaboradorEmail;
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

        {/* Layout de 2 colunas para cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Histórico de Promoções */}
          <Card className="p-5 hover-elevate" data-testid="card-promocoes">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                Histórico de Promoções
              </h2>
              <Button 
                size="sm" 
                onClick={() => setAddPromocaoDialogOpen(true)}
                data-testid="button-add-promocao"
              >
                <Plus className="w-4 h-4 mr-1" />
                Adicionar
              </Button>
            </div>
            {colaborador.promocoes && colaborador.promocoes.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {colaborador.promocoes.map((promocao, index, arr) => {
                  const nextPromo = arr[index + 1];
                  let mesesDesdeUltimo: number | null = null;
                  if (nextPromo && promocao.dataPromocao && nextPromo.dataPromocao) {
                    const dataAtual = new Date(promocao.dataPromocao);
                    const dataAnterior = new Date(nextPromo.dataPromocao);
                    mesesDesdeUltimo = Math.round((dataAtual.getTime() - dataAnterior.getTime()) / (1000 * 60 * 60 * 24 * 30));
                  }
                  return (
                    <div 
                      key={promocao.id} 
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      data-testid={`row-promocao-${promocao.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{formatDateFns(promocao.dataPromocao)}</p>
                          <p className="text-xs text-muted-foreground">
                            {promocao.cargoAnterior || "—"} → {promocao.cargoNovo || "—"}
                          </p>
                          {mesesDesdeUltimo !== null && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                              {mesesDesdeUltimo} {mesesDesdeUltimo === 1 ? "mês" : "meses"} após última promoção
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono font-semibold text-green-600 dark:text-green-400">
                          {formatCurrency(promocao.salarioNovo)}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          de {formatCurrency(promocao.salarioAnterior)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8" data-testid="text-no-promocoes">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                  <TrendingUp className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Nenhum histórico de promoção</p>
              </div>
            )}
          </Card>

          {/* Financeiro */}
          {canViewFinanceiro() && (
            <FinanceiroCard colaboradorId={colaboradorId} colaborador={colaborador} />
          )}

          {/* Ativos / Patrimônios */}
          <Card className="p-5 hover-elevate" data-testid="card-patrimonios">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                    <Package className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  Ativos / Patrimônios
                </h2>
                <Button 
                  size="sm" 
                  onClick={() => setAssignPatrimonioDialogOpen(true)}
                  data-testid="button-add-patrimonio"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar
                </Button>
              </div>
              {colaborador.patrimonios && colaborador.patrimonios.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {colaborador.patrimonios.map((patrimonio) => (
                    <Link 
                      key={patrimonio.id} 
                      href={`/patrimonio/${patrimonio.id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                      data-testid={`row-patrimonio-${patrimonio.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded bg-violet-100 dark:bg-violet-900/30">
                          <Package className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{patrimonio.ativo || patrimonio.descricao || "—"}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            #{patrimonio.numeroAtivo || patrimonio.id}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {patrimonio.estadoConservacao || "N/A"}
                      </Badge>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8" data-testid="text-no-patrimonios">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                    <Package className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Nenhum patrimônio atribuído</p>
                </div>
              )}
            </Card>

            <Card className="p-5 hover-elevate" data-testid="card-telefones">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/30">
                    <Phone className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  </div>
                  Linhas Telefônicas
                </h2>
                <Badge variant="secondary" className="text-xs">
                  {colaboradorTelefones.length} linha{colaboradorTelefones.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              {colaboradorTelefones.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {colaboradorTelefones.map((telefone) => (
                    <div 
                      key={telefone.id} 
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      data-testid={`row-telefone-${telefone.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded bg-teal-100 dark:bg-teal-900/30">
                          <Phone className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{telefone.telefone}</p>
                          <p className="text-xs text-muted-foreground">
                            {telefone.planoOperadora || "—"} • {telefone.setor || "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8" data-testid="text-no-telefones">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                    <Phone className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Nenhuma linha telefônica</p>
                </div>
              )}
            </Card>
        </div>
          </TabsContent>

          <TabsContent value="desenvolvimento" data-testid="tab-content-desenvolvimento">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <HealthCard colaboradorId={colaboradorId} />
              <EnpsCard colaboradorId={colaboradorId} />
              <PdiCard colaboradorId={colaboradorId} />
              <OneOnOneCard colaboradorId={colaboradorId} />
              <ComentariosCard colaboradorId={colaboradorId} />
              <TimelineCard colaboradorId={colaboradorId} />
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
