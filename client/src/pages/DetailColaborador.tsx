import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { usePageInfo } from "@/contexts/PageContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Pencil, Loader2, Mail, Phone, MapPin, Calendar, Briefcase, Award, CreditCard, Building2, Package, User, DollarSign, Plus, TrendingUp, UserCircle, ExternalLink } from "lucide-react";
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

interface PatrimonioItem {
  id: number;
  numeroAtivo: string | null;
  descricao: string | null;
  status: string | null;
  ativo: string | null;
  marca: string | null;
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

interface SystemUser {
  id: string;
  email: string;
  name: string;
  picture: string | null;
  role: string;
}

type ColaboradorDetail = Colaborador & {
  patrimonios: PatrimonioItem[];
  promocoes?: PromocaoItem[];
  linkedUser?: LinkedUser | null;
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
  sigla: string;
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

function EditColaboradorDialog({ colaborador, open, onOpenChange }: { colaborador: ColaboradorDetail; open: boolean; onOpenChange: (open: boolean) => void }) {
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

  const { data: systemUsers = [], isLoading: usersLoading } = useQuery<SystemUser[]>({
    queryKey: ["/api/admin/users"],
  });

  const editColaboradorSchema = insertColaboradorSchema.extend({
    demissao: z.string().optional(),
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

  const form = useForm<InsertColaborador & { demissao?: string; cidade?: string; userId?: string | null }>({
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
      estado: colaborador.estado || "",
      cidade: (colaborador as any).cidade || "",
      pix: colaborador.pix || "",
      cnpj: colaborador.cnpj || "",
      salario: colaborador.salario || "",
      aniversario: colaborador.aniversario ? new Date(colaborador.aniversario).toISOString().split('T')[0] : undefined,
      admissao: colaborador.admissao ? new Date(colaborador.admissao).toISOString().split('T')[0] : undefined,
      demissao: colaborador.demissao ? new Date(colaborador.demissao).toISOString().split('T')[0] : undefined,
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
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-edit-setor" />
                    </FormControl>
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
                          <SelectItem key={est.sigla} value={est.sigla}>
                            {est.sigla} - {est.nome}
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

function InfoCard({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-card rounded-lg border border-border">
      <div className="p-2 bg-primary/10 rounded-lg">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-medium text-foreground">{value || "-"}</p>
      </div>
    </div>
  );
}

export default function DetailColaborador() {
  const { setPageInfo } = usePageInfo();
  const [, params] = useRoute("/colaborador/:id");
  const colaboradorId = params?.id || "";
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addPromocaoDialogOpen, setAddPromocaoDialogOpen] = useState(false);

  const { data: colaborador, isLoading, error } = useQuery<ColaboradorDetail>({
    queryKey: ["/api/colaboradores", colaboradorId],
    enabled: !!colaboradorId,
  });

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

  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <Link href="/colaboradores">
            <Button variant="ghost" size="sm" className="hover-elevate -ml-2 mb-4" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para colaboradores
            </Button>
          </Link>
          
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                {colaborador.linkedUser?.picture ? (
                  <AvatarImage src={colaborador.linkedUser.picture} alt={colaborador.nome} />
                ) : null}
                <AvatarFallback className="text-xl">{getInitials(colaborador.nome)}</AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold text-foreground" data-testid="text-colaborador-nome">
                  {colaborador.nome}
                </h1>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  {colaborador.cargo && (
                    <span data-testid="text-colaborador-cargo">{colaborador.cargo}</span>
                  )}
                  {colaborador.cargo && colaborador.nivel && <span>•</span>}
                  {colaborador.nivel && (
                    <span data-testid="text-colaborador-nivel">{colaborador.nivel}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge 
                variant={getStatusBadgeVariant(colaborador.status)} 
                data-testid="badge-status"
              >
                {colaborador.status || "Desconhecido"}
              </Badge>
              <Button onClick={() => setEditDialogOpen(true)} data-testid="button-edit-colaborador">
                <Pencil className="w-4 h-4 mr-2" />
                Editar
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <InfoCard 
            icon={Calendar} 
            label="Meses de Turbo" 
            value={colaborador.mesesDeTurbo?.toString() || "-"} 
          />
          <InfoCard 
            icon={Building2} 
            label="Setor" 
            value={colaborador.setor} 
          />
          <InfoCard 
            icon={Briefcase} 
            label="Squad" 
            value={colaborador.squad} 
          />
          <InfoCard 
            icon={Award} 
            label="Cargo" 
            value={colaborador.cargo} 
          />
          <InfoCard 
            icon={Award} 
            label="Nível" 
            value={colaborador.nivel} 
          />
        </div>

        {colaborador.linkedUser && (
          <Card className="p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <UserCircle className="w-5 h-5" />
              Usuário Vinculado ao Sistema
            </h2>
            <div className="flex items-center gap-4">
              <Avatar className="w-12 h-12">
                {colaborador.linkedUser.picture ? (
                  <AvatarImage src={colaborador.linkedUser.picture} alt={colaborador.linkedUser.name} />
                ) : null}
                <AvatarFallback>{getInitials(colaborador.linkedUser.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium text-foreground" data-testid="text-linked-user-name">
                  {colaborador.linkedUser.name}
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-2" data-testid="text-linked-user-email">
                  <Mail className="w-4 h-4" />
                  {colaborador.linkedUser.email}
                </p>
              </div>
              <Badge variant="outline" data-testid="badge-linked-user-role">
                {colaborador.linkedUser.role}
              </Badge>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Informações Pessoais
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="font-medium" data-testid="text-info-nome">{colaborador.nome}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">CPF</p>
                  <p className="font-medium font-mono" data-testid="text-info-cpf">{colaborador.cpf || "-"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <p className="font-medium flex items-center gap-2" data-testid="text-info-telefone">
                    {colaborador.telefone && <Phone className="w-4 h-4 text-muted-foreground" />}
                    {colaborador.telefone || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Aniversário</p>
                  <p className="font-medium" data-testid="text-info-aniversario">{formatDate(colaborador.aniversario)}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email Turbo</p>
                <p className="font-medium flex items-center gap-2" data-testid="text-info-email-turbo">
                  {colaborador.emailTurbo && <Mail className="w-4 h-4 text-primary" />}
                  {colaborador.emailTurbo || "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email Pessoal</p>
                <p className="font-medium flex items-center gap-2" data-testid="text-info-email-pessoal">
                  {colaborador.emailPessoal && <Mail className="w-4 h-4 text-muted-foreground" />}
                  {colaborador.emailPessoal || "-"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Estado</p>
                  <p className="font-medium flex items-center gap-2" data-testid="text-info-estado">
                    {colaborador.estado && <MapPin className="w-4 h-4 text-muted-foreground" />}
                    {colaborador.estado || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">PIX</p>
                  <p className="font-medium flex items-center gap-2 truncate" title={colaborador.pix || undefined} data-testid="text-info-pix">
                    {colaborador.pix && <CreditCard className="w-4 h-4 text-muted-foreground" />}
                    {colaborador.pix || "-"}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Endereço</p>
                <p className="font-medium" data-testid="text-info-endereco">{colaborador.endereco || "-"}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              Informações Profissionais
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Cargo</p>
                  <p className="font-medium" data-testid="text-prof-cargo">{colaborador.cargo || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nível</p>
                  <p className="font-medium" data-testid="text-prof-nivel">{colaborador.nivel || "-"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Setor</p>
                  <p className="font-medium" data-testid="text-prof-setor">{colaborador.setor || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Squad</p>
                  {colaborador.squad ? (
                    <Badge
                      variant="secondary"
                      className={squadColors[colaborador.squad] || ""}
                      data-testid="badge-prof-squad"
                    >
                      {colaborador.squad}
                    </Badge>
                  ) : (
                    <p className="font-medium">-</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Admissão</p>
                  <p className="font-medium" data-testid="text-prof-admissao">{formatDate(colaborador.admissao)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Meses de Turbo</p>
                  <p className="font-medium" data-testid="text-prof-meses-turbo">{colaborador.mesesDeTurbo || "-"}</p>
                </div>
              </div>
              {colaborador.demissao && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Demissão</p>
                    <p className="font-medium" data-testid="text-prof-demissao">{formatDate(colaborador.demissao)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tipo Demissão</p>
                    <p className="font-medium" data-testid="text-prof-tipo-demissao">{colaborador.tipoDemissao || "-"}</p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Salário</p>
                  <p className="font-medium flex items-center gap-2" data-testid="text-prof-salario">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    {colaborador.salario ? `R$ ${parseFloat(colaborador.salario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Último Aumento</p>
                  <p className="font-medium" data-testid="text-prof-ultimo-aumento">{formatDate(colaborador.ultimoAumento)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">CNPJ</p>
                  <p className="font-medium font-mono" data-testid="text-prof-cnpj">{colaborador.cnpj || "-"}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6 mb-8">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Salário Anterior</TableHead>
                    <TableHead>Salário Novo</TableHead>
                    <TableHead>Cargo Anterior</TableHead>
                    <TableHead>Cargo Novo</TableHead>
                    <TableHead>Nível Anterior</TableHead>
                    <TableHead>Nível Novo</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {colaborador.promocoes.map((promocao) => (
                    <TableRow key={promocao.id} data-testid={`row-promocao-${promocao.id}`}>
                      <TableCell data-testid={`text-promocao-data-${promocao.id}`}>
                        {formatDateFns(promocao.dataPromocao)}
                      </TableCell>
                      <TableCell className="font-mono" data-testid={`text-promocao-salario-anterior-${promocao.id}`}>
                        {formatCurrency(promocao.salarioAnterior)}
                      </TableCell>
                      <TableCell className="font-mono text-green-600 dark:text-green-400" data-testid={`text-promocao-salario-novo-${promocao.id}`}>
                        {formatCurrency(promocao.salarioNovo)}
                      </TableCell>
                      <TableCell data-testid={`text-promocao-cargo-anterior-${promocao.id}`}>
                        {promocao.cargoAnterior || "-"}
                      </TableCell>
                      <TableCell data-testid={`text-promocao-cargo-novo-${promocao.id}`}>
                        {promocao.cargoNovo || "-"}
                      </TableCell>
                      <TableCell data-testid={`text-promocao-nivel-anterior-${promocao.id}`}>
                        {promocao.nivelAnterior || "-"}
                      </TableCell>
                      <TableCell data-testid={`text-promocao-nivel-novo-${promocao.id}`}>
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
            <p className="text-muted-foreground text-center py-8" data-testid="text-no-promocoes">
              Nenhum histórico de promoção registrado
            </p>
          )}
        </Card>

        <Card className="p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Package className="w-5 h-5" />
            Ativos / Patrimônios
          </h2>
          {colaborador.patrimonios && colaborador.patrimonios.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Número Ativo</TableHead>
                    <TableHead>Equipamento</TableHead>
                    <TableHead>Marca</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {colaborador.patrimonios.map((patrimonio) => (
                    <TableRow key={patrimonio.id} data-testid={`row-patrimonio-${patrimonio.id}`}>
                      <TableCell className="font-mono" data-testid={`text-patrimonio-id-${patrimonio.id}`}>
                        {patrimonio.id}
                      </TableCell>
                      <TableCell className="font-mono" data-testid={`text-patrimonio-numero-${patrimonio.id}`}>
                        {patrimonio.numeroAtivo || "-"}
                      </TableCell>
                      <TableCell data-testid={`text-patrimonio-ativo-${patrimonio.id}`}>
                        {patrimonio.ativo || patrimonio.descricao || "-"}
                      </TableCell>
                      <TableCell data-testid={`text-patrimonio-marca-${patrimonio.id}`}>
                        {patrimonio.marca || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" data-testid={`badge-patrimonio-status-${patrimonio.id}`}>
                          {patrimonio.status || "N/A"}
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
            <p className="text-muted-foreground text-center py-8" data-testid="text-no-patrimonios">
              Nenhum patrimônio atribuído a este colaborador
            </p>
          )}
        </Card>

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
      </div>
    </div>
  );
}
