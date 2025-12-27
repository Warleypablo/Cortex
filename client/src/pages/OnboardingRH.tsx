import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
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
import { UserPlus, ClipboardList, Loader2, CheckCircle2, Clock, AlertCircle, Eye, Trash2, AlertTriangle, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

interface ProximoVencimento {
  colaboradorNome: string;
  etapaTitulo: string;
  diasRestantes: number;
}

interface OnboardingMetricas {
  emAndamento: number;
  concluidos: number;
  pendentes: number;
  atrasados: number;
  tempoMedioConclusao: number;
  proximosVencimentos: ProximoVencimento[];
}

const iniciarOnboardingSchema = z.object({
  colaboradorId: z.string().min(1, "Colaborador é obrigatório"),
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

function IniciarOnboardingDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const form = useForm<z.infer<typeof iniciarOnboardingSchema>>({
    resolver: zodResolver(iniciarOnboardingSchema),
    defaultValues: { colaboradorId: "", dataInicio: new Date().toISOString().split("T")[0] },
  });

  const { data: colaboradores = [] } = useQuery<Colaborador[]>({
    queryKey: ["/api/rh/colaboradores"],
  });

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof iniciarOnboardingSchema>) => {
      const response = await apiRequest("POST", "/api/rh/onboarding/iniciar", {
        colaboradorId: parseInt(data.colaboradorId),
        dataInicio: data.dataInicio,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao iniciar onboarding");
      }
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rh/onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rh/onboarding/metricas"] });
      toast({ title: "Onboarding iniciado com sucesso" });
      setOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao iniciar onboarding", description: error.message, variant: "destructive" });
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
          <DialogDescription>Selecione o colaborador para iniciar o processo de onboarding padrão.</DialogDescription>
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

function OnboardingDetailDialog({ colaboradorId, onboardingId }: { colaboradorId: number; onboardingId: number }) {
  const [open, setOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
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
      queryClient.invalidateQueries({ queryKey: ["/api/rh/onboarding/metricas"] });
      refetch();
      toast({ title: "Progresso atualizado" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/rh/onboarding/${onboardingId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rh/onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rh/onboarding/metricas"] });
      toast({ title: "Onboarding removido" });
      setOpen(false);
    },
    onError: () => {
      toast({ title: "Erro ao remover", variant: "destructive" });
    },
  });

  const handleToggle = (etapa: OnboardingProgress) => {
    const newStatus = etapa.status === "completed" ? "pending" : "completed";
    updateMutation.mutate({ id: etapa.id, status: newStatus });
  };

  return (
    <>
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
                  Início: {format(new Date(onboarding.dataInicio), "dd/MM/yyyy", { locale: ptBR })}
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
                <div className="flex justify-end pt-4 border-t">
                  <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)} data-testid="button-delete-onboarding">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remover Onboarding
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-muted-foreground">Nenhum onboarding encontrado para este colaborador.</div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Onboarding?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá remover permanentemente o onboarding e todo o progresso associado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()} data-testid="button-confirm-delete-onboarding">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function OnboardingRH() {
  usePageTitle("Onboarding RH");
  useSetPageInfo("Onboarding RH", "Gestão de onboarding de colaboradores");
  const { user } = useAuth();

  const { data: onboardings = [], isLoading } = useQuery<OnboardingListItem[]>({
    queryKey: ["/api/rh/onboarding"],
  });

  const { data: metricas } = useQuery<OnboardingMetricas>({
    queryKey: ["/api/rh/onboarding/metricas"],
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

      {metricas && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card data-testid="kpi-em-andamento" className="bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Em Andamento</span>
                </div>
                <p className="text-3xl font-bold text-blue-800 dark:text-blue-200 mt-2" data-testid="value-em-andamento">
                  {metricas.emAndamento}
                </p>
              </CardContent>
            </Card>

            <Card data-testid="kpi-concluidos" className="bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">Concluídos</span>
                </div>
                <p className="text-3xl font-bold text-green-800 dark:text-green-200 mt-2" data-testid="value-concluidos">
                  {metricas.concluidos}
                </p>
              </CardContent>
            </Card>

            <Card data-testid="kpi-pendentes" className="bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                  <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Pendentes</span>
                </div>
                <p className="text-3xl font-bold text-yellow-800 dark:text-yellow-200 mt-2" data-testid="value-pendentes">
                  {metricas.pendentes}
                </p>
              </CardContent>
            </Card>

            <Card data-testid="kpi-atrasados" className="bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  {metricas.atrasados > 0 ? (
                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                  )}
                  <span className="text-sm font-medium text-red-700 dark:text-red-300">Atrasados</span>
                </div>
                <p className="text-3xl font-bold text-red-800 dark:text-red-200 mt-2" data-testid="value-atrasados">
                  {metricas.atrasados}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-tempo-medio-conclusao">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-medium">Tempo Médio de Conclusão</span>
              </div>
              <p className="text-2xl font-bold mt-2">
                {metricas.tempoMedioConclusao} {metricas.tempoMedioConclusao === 1 ? "dia" : "dias"}
              </p>
            </CardContent>
          </Card>

          {metricas.atrasados > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Existem <strong>{metricas.atrasados}</strong> onboarding{metricas.atrasados > 1 ? "s" : ""} com etapas atrasadas. Verifique os processos pendentes.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ClipboardList className="w-5 h-5" />
          Onboardings Ativos
        </h2>

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
                        <OnboardingDetailDialog colaboradorId={item.colaboradorId} onboardingId={item.id} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
