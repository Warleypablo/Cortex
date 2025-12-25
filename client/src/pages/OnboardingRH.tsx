import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, UserPlus, ClipboardList, Settings, Loader2, CheckCircle2, Clock, AlertCircle, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OnboardingTemplate {
  id: number;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  createdAt: string;
}

interface OnboardingEtapa {
  id: number;
  templateId: number;
  ordem: number;
  titulo: string;
  descricao: string | null;
  responsavelPadrao: string | null;
  prazoDias: number | null;
}

interface OnboardingListItem {
  id: number;
  colaboradorId: number;
  templateId: number;
  dataInicio: string;
  status: string;
  createdAt: string;
  templateNome: string;
  colaboradorNome: string;
  cargo: string;
  squad: string;
  totalEtapas: string;
  etapasConcluidas: string;
}

interface OnboardingProgress {
  id: number;
  etapaId: number;
  status: string;
  responsavelId: number | null;
  dataConclusao: string | null;
  observacoes: string | null;
  titulo: string;
  descricao: string | null;
  ordem: number;
  prazoDias: number | null;
  responsavelNome: string | null;
}

interface OnboardingDetail {
  id: number;
  colaboradorId: number;
  templateId: number;
  dataInicio: string;
  status: string;
  createdAt: string;
  templateNome: string;
  colaboradorNome: string;
  etapas: OnboardingProgress[];
}

interface Colaborador {
  id: number;
  nome: string;
  cargo: string;
  squad: string;
}

const templateSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  descricao: z.string().optional(),
});

const etapaSchema = z.object({
  ordem: z.coerce.number().min(1, "Ordem é obrigatória"),
  titulo: z.string().min(1, "Título é obrigatório"),
  descricao: z.string().optional(),
  responsavelPadrao: z.string().optional(),
  prazoDias: z.coerce.number().optional(),
});

const iniciarOnboardingSchema = z.object({
  colaboradorId: z.string().min(1, "Colaborador é obrigatório"),
  templateId: z.string().min(1, "Template é obrigatório"),
  dataInicio: z.string().min(1, "Data de início é obrigatória"),
});

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; className: string; icon: any }> = {
    pending: { label: "Pendente", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Clock },
    in_progress: { label: "Em Progresso", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: AlertCircle },
    completed: { label: "Concluído", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2 },
  };
  const config = variants[status] || variants.pending;
  const Icon = config.icon;
  return (
    <Badge className={config.className} data-testid={`badge-status-${status}`}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
}

function AddTemplateDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const form = useForm<z.infer<typeof templateSchema>>({
    resolver: zodResolver(templateSchema),
    defaultValues: { nome: "", descricao: "" },
  });

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof templateSchema>) => {
      const response = await apiRequest("POST", "/api/rh/onboarding/templates", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rh/onboarding/templates"] });
      toast({ title: "Template criado com sucesso" });
      setOpen(false);
      form.reset();
      onSuccess();
    },
    onError: () => {
      toast({ title: "Erro ao criar template", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-template">
          <Plus className="w-4 h-4 mr-2" />
          Novo Template
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Template de Onboarding</DialogTitle>
          <DialogDescription>Crie um novo template para o processo de onboarding.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-template-nome" placeholder="Ex: Onboarding Desenvolvedor" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea {...field} data-testid="input-template-descricao" placeholder="Descrição do template..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-template">
                {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Criar Template
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function AddEtapaDialog({ templateId, onSuccess }: { templateId: number; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const form = useForm<z.infer<typeof etapaSchema>>({
    resolver: zodResolver(etapaSchema),
    defaultValues: { ordem: 1, titulo: "", descricao: "", responsavelPadrao: "", prazoDias: undefined },
  });

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof etapaSchema>) => {
      const response = await apiRequest("POST", `/api/rh/onboarding/templates/${templateId}/etapas`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rh/onboarding/templates", templateId, "etapas"] });
      toast({ title: "Etapa adicionada com sucesso" });
      setOpen(false);
      form.reset();
      onSuccess();
    },
    onError: () => {
      toast({ title: "Erro ao adicionar etapa", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid="button-add-etapa">
          <Plus className="w-4 h-4 mr-2" />
          Nova Etapa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Etapa</DialogTitle>
          <DialogDescription>Adicione uma nova etapa ao template de onboarding.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="ordem"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ordem *</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} data-testid="input-etapa-ordem" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="prazoDias"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prazo (dias)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} value={field.value || ""} onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)} data-testid="input-etapa-prazo" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="titulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título *</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-etapa-titulo" placeholder="Ex: Configurar acesso ao email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea {...field} data-testid="input-etapa-descricao" placeholder="Descrição da etapa..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="responsavelPadrao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Responsável Padrão</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-etapa-responsavel" placeholder="Ex: RH, TI, Gestor" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-etapa">
                {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Adicionar Etapa
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function IniciarOnboardingDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const form = useForm<z.infer<typeof iniciarOnboardingSchema>>({
    resolver: zodResolver(iniciarOnboardingSchema),
    defaultValues: { colaboradorId: "", templateId: "", dataInicio: new Date().toISOString().split("T")[0] },
  });

  const { data: templates = [] } = useQuery<OnboardingTemplate[]>({
    queryKey: ["/api/rh/onboarding/templates"],
  });

  const { data: colaboradores = [] } = useQuery<Colaborador[]>({
    queryKey: ["/api/rh/colaboradores"],
  });

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof iniciarOnboardingSchema>) => {
      const response = await apiRequest("POST", "/api/rh/onboarding/iniciar", {
        colaboradorId: parseInt(data.colaboradorId),
        templateId: parseInt(data.templateId),
        dataInicio: data.dataInicio,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rh/onboarding"] });
      toast({ title: "Onboarding iniciado com sucesso" });
      setOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Erro ao iniciar onboarding", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-iniciar-onboarding">
          <UserPlus className="w-4 h-4 mr-2" />
          Iniciar Onboarding
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Iniciar Onboarding</DialogTitle>
          <DialogDescription>Selecione o colaborador e o template para iniciar o onboarding.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="colaboradorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Colaborador *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-colaborador">
                        <SelectValue placeholder="Selecione um colaborador" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {colaboradores.map((c) => (
                        <SelectItem key={c.id} value={c.id.toString()} data-testid={`option-colaborador-${c.id}`}>
                          {c.nome} - {c.cargo}
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
              name="templateId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-template">
                        <SelectValue placeholder="Selecione um template" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id.toString()} data-testid={`option-template-${t.id}`}>
                          {t.nome}
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
              name="dataInicio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Início *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} data-testid="input-data-inicio" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-iniciar">
                {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Iniciar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function OnboardingDetailDialog({ colaboradorId }: { colaboradorId: number }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: onboarding, isLoading, refetch } = useQuery<OnboardingDetail | null>({
    queryKey: ["/api/rh/onboarding", colaboradorId],
    enabled: open,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, observacoes }: { id: number; status: string; observacoes?: string }) => {
      const response = await apiRequest("PATCH", `/api/rh/onboarding/progresso/${id}`, { status, observacoes });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rh/onboarding", colaboradorId] });
      queryClient.invalidateQueries({ queryKey: ["/api/rh/onboarding"] });
      refetch();
      toast({ title: "Progresso atualizado" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    },
  });

  const handleToggle = (etapa: OnboardingProgress) => {
    const newStatus = etapa.status === "completed" ? "pending" : "completed";
    updateMutation.mutate({ id: etapa.id, status: newStatus });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" data-testid={`button-view-onboarding-${colaboradorId}`}>
          <Eye className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : onboarding ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5" />
                Onboarding: {onboarding.colaboradorNome}
              </DialogTitle>
              <DialogDescription>
                Template: {onboarding.templateNome} | Início: {format(new Date(onboarding.dataInicio), "dd/MM/yyyy", { locale: ptBR })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-4">
                <StatusBadge status={onboarding.status} />
                <Progress
                  value={(onboarding.etapas.filter((e) => e.status === "completed").length / onboarding.etapas.length) * 100}
                  className="flex-1"
                  data-testid="progress-onboarding"
                />
                <span className="text-sm text-muted-foreground" data-testid="text-progress-count">
                  {onboarding.etapas.filter((e) => e.status === "completed").length}/{onboarding.etapas.length}
                </span>
              </div>
              <div className="space-y-2">
                {onboarding.etapas.map((etapa) => (
                  <Card key={etapa.id} className={etapa.status === "completed" ? "opacity-75" : ""} data-testid={`card-etapa-${etapa.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={etapa.status === "completed"}
                          onCheckedChange={() => handleToggle(etapa)}
                          disabled={updateMutation.isPending}
                          data-testid={`checkbox-etapa-${etapa.id}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-medium ${etapa.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                              {etapa.ordem}. {etapa.titulo}
                            </span>
                            {etapa.prazoDias && (
                              <Badge variant="outline" className="text-xs">
                                {etapa.prazoDias} dias
                              </Badge>
                            )}
                          </div>
                          {etapa.descricao && <p className="text-sm text-muted-foreground mt-1">{etapa.descricao}</p>}
                          {etapa.dataConclusao && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Concluído em: {format(new Date(etapa.dataConclusao), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="py-8 text-center text-muted-foreground">Nenhum onboarding encontrado para este colaborador.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({ template, isAdmin }: { template: OnboardingTemplate; isAdmin: boolean }) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { toast } = useToast();

  const { data: etapas = [], refetch } = useQuery<OnboardingEtapa[]>({
    queryKey: ["/api/rh/onboarding/templates", template.id, "etapas"],
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/rh/onboarding/templates/${template.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rh/onboarding/templates"] });
      toast({ title: "Template removido" });
    },
  });

  const deleteEtapaMutation = useMutation({
    mutationFn: async (etapaId: number) => {
      await apiRequest("DELETE", `/api/rh/onboarding/etapas/${etapaId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rh/onboarding/templates", template.id, "etapas"] });
      refetch();
      toast({ title: "Etapa removida" });
    },
  });

  return (
    <Card data-testid={`card-template-${template.id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div>
          <CardTitle className="text-lg">{template.nome}</CardTitle>
          {template.descricao && <CardDescription>{template.descricao}</CardDescription>}
        </div>
        {isAdmin && (
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={() => setDeleteOpen(true)} data-testid={`button-delete-template-${template.id}`}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{etapas.length} etapa(s)</span>
            {isAdmin && <AddEtapaDialog templateId={template.id} onSuccess={() => refetch()} />}
          </div>
          {etapas.length > 0 && (
            <div className="border rounded-lg divide-y">
              {etapas.map((etapa) => (
                <div key={etapa.id} className="p-2 flex items-center justify-between gap-2" data-testid={`row-etapa-${etapa.id}`}>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm">
                      {etapa.ordem}. {etapa.titulo}
                    </span>
                    {etapa.prazoDias && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        {etapa.prazoDias}d
                      </Badge>
                    )}
                  </div>
                  {isAdmin && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => deleteEtapaMutation.mutate(etapa.id)}
                      data-testid={`button-delete-etapa-${etapa.id}`}
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Template?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação irá desativar o template. Onboardings existentes não serão afetados.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()} data-testid="button-confirm-delete-template">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default function OnboardingRH() {
  useSetPageInfo("Onboarding RH", "Gestão de onboarding de colaboradores");
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: onboardings = [], isLoading } = useQuery<OnboardingListItem[]>({
    queryKey: ["/api/rh/onboarding"],
  });

  const { data: templates = [], refetch: refetchTemplates } = useQuery<OnboardingTemplate[]>({
    queryKey: ["/api/rh/onboarding/templates"],
  });

  return (
    <div className="p-6 space-y-6" data-testid="page-onboarding-rh">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="title-onboarding-rh">Onboarding RH</h1>
          <p className="text-muted-foreground">Acompanhe e gerencie o processo de onboarding dos colaboradores</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <IniciarOnboardingDialog />
        </div>
      </div>

      <Tabs defaultValue="onboardings">
        <TabsList data-testid="tabs-list-onboarding">
          <TabsTrigger value="onboardings" data-testid="tab-onboardings">
            <ClipboardList className="w-4 h-4 mr-2" />
            Onboardings Ativos
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="templates" data-testid="tab-templates">
              <Settings className="w-4 h-4 mr-2" />
              Templates
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="onboardings" className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : onboardings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum onboarding ativo no momento.</p>
                <p className="text-sm text-muted-foreground mt-1">Clique em "Iniciar Onboarding" para começar.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Squad</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Progresso</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {onboardings.map((item) => {
                    const total = parseInt(item.totalEtapas) || 0;
                    const completed = parseInt(item.etapasConcluidas) || 0;
                    const percent = total > 0 ? (completed / total) * 100 : 0;
                    return (
                      <TableRow key={item.id} data-testid={`row-onboarding-${item.id}`}>
                        <TableCell className="font-medium" data-testid={`text-colaborador-${item.id}`}>
                          {item.colaboradorNome}
                        </TableCell>
                        <TableCell>{item.cargo}</TableCell>
                        <TableCell>{item.squad}</TableCell>
                        <TableCell>{item.templateNome}</TableCell>
                        <TableCell>{format(new Date(item.dataInicio), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <Progress value={percent} className="flex-1 h-2" />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {completed}/{total}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={item.status} />
                        </TableCell>
                        <TableCell>
                          <OnboardingDetailDialog colaboradorId={item.colaboradorId} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="templates" className="space-y-4">
            <div className="flex justify-end">
              <AddTemplateDialog onSuccess={() => refetchTemplates()} />
            </div>
            {templates.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Settings className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum template criado.</p>
                  <p className="text-sm text-muted-foreground mt-1">Crie um template para começar a usar o onboarding.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {templates.map((template) => (
                  <TemplateCard key={template.id} template={template} isAdmin={isAdmin} />
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
