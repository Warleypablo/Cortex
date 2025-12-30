import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { usePageTitle } from "@/hooks/use-page-title";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Lightbulb, Bug, Sparkles, Plus, Clock, CheckCircle2, XCircle, Loader2, AlertTriangle, MessageSquare, Send, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Sugestao {
  id: number;
  tipo: string;
  titulo: string;
  descricao: string;
  prioridade: string;
  status: string;
  autorId: string;
  autorNome: string;
  autorEmail: string | null;
  modulo: string | null;
  anexoPath: string | null;
  criadoEm: string;
  atualizadoEm: string;
  comentarioAdmin: string | null;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

const sugestaoFormSchema = z.object({
  tipo: z.enum(["feature", "melhoria", "bug"]),
  titulo: z.string().min(5, "Título deve ter pelo menos 5 caracteres").max(255),
  descricao: z.string().min(20, "Descreva melhor sua sugestão (mínimo 20 caracteres)"),
  prioridade: z.enum(["baixa", "media", "alta", "critica"]).default("media"),
  modulo: z.string().optional(),
});

type SugestaoFormData = z.infer<typeof sugestaoFormSchema>;

const TIPOS = [
  { value: "feature", label: "Nova Funcionalidade", icon: Sparkles, color: "text-blue-500" },
  { value: "melhoria", label: "Melhoria", icon: Lightbulb, color: "text-amber-500" },
  { value: "bug", label: "Bug / Erro", icon: Bug, color: "text-red-500" },
];

const PRIORIDADES = [
  { value: "baixa", label: "Baixa", color: "bg-slate-500" },
  { value: "media", label: "Média", color: "bg-blue-500" },
  { value: "alta", label: "Alta", color: "bg-amber-500" },
  { value: "critica", label: "Crítica", color: "bg-red-500" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pendente: { label: "Pendente", color: "bg-slate-500", icon: Clock },
  em_analise: { label: "Em Análise", color: "bg-blue-500", icon: MessageSquare },
  aprovado: { label: "Aprovado", color: "bg-green-500", icon: CheckCircle2 },
  em_desenvolvimento: { label: "Em Desenvolvimento", color: "bg-purple-500", icon: Loader2 },
  concluido: { label: "Concluído", color: "bg-emerald-500", icon: CheckCircle2 },
  rejeitado: { label: "Rejeitado", color: "bg-red-500", icon: XCircle },
};

const MODULOS = [
  { value: "homepage", label: "Homepage" },
  { value: "clientes", label: "Clientes" },
  { value: "colaboradores", label: "Colaboradores" },
  { value: "financeiro", label: "Financeiro" },
  { value: "operacao", label: "Operação" },
  { value: "comercial", label: "Comercial" },
  { value: "growth", label: "Growth" },
  { value: "gg", label: "G&G (Pessoas)" },
  { value: "tech", label: "Tech" },
  { value: "geral", label: "Geral" },
  { value: "outro", label: "Outro" },
];

export default function Sugestoes() {
  usePageTitle("Sugestões");
  useSetPageInfo("Sugestões", "Sugira novas funcionalidades, melhorias ou reporte bugs");
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("todas");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: sugestoes = [], isLoading } = useQuery<Sugestao[]>({
    queryKey: ["/api/sugestoes"],
  });

  const form = useForm<SugestaoFormData>({
    resolver: zodResolver(sugestaoFormSchema),
    defaultValues: {
      tipo: "melhoria",
      titulo: "",
      descricao: "",
      prioridade: "media",
      modulo: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: SugestaoFormData) => {
      return apiRequest("POST", "/api/sugestoes", data);
    },
    onSuccess: () => {
      toast({ title: "Sugestão enviada!", description: "Sua sugestão foi registrada com sucesso." });
      queryClient.invalidateQueries({ queryKey: ["/api/sugestoes"] });
      form.reset();
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível enviar sua sugestão.", variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, comentarioAdmin }: { id: number; status: string; comentarioAdmin?: string }) => {
      return apiRequest("PATCH", `/api/sugestoes/${id}`, { status, comentarioAdmin });
    },
    onSuccess: () => {
      toast({ title: "Status atualizado!" });
      queryClient.invalidateQueries({ queryKey: ["/api/sugestoes"] });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível atualizar o status.", variant: "destructive" });
    },
  });

  const onSubmit = (data: SugestaoFormData) => {
    createMutation.mutate(data);
  };

  const filteredSugestoes = sugestoes.filter((s) => {
    if (activeTab === "todas") return true;
    if (activeTab === "minhas") return s.autorId === user?.id;
    return s.tipo === activeTab;
  });

  const stats = {
    total: sugestoes.length,
    pendentes: sugestoes.filter(s => s.status === "pendente").length,
    emAnalise: sugestoes.filter(s => s.status === "em_analise" || s.status === "em_desenvolvimento").length,
    concluidas: sugestoes.filter(s => s.status === "concluido").length,
  };

  const getTipoIcon = (tipo: string) => {
    const config = TIPOS.find(t => t.value === tipo);
    if (!config) return Lightbulb;
    return config.icon;
  };

  const getTipoColor = (tipo: string) => {
    const config = TIPOS.find(t => t.value === tipo);
    return config?.color || "text-muted-foreground";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Sugestões</h1>
          <p className="text-muted-foreground">Contribua para melhorar o Turbo Cortex</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-nova-sugestao">
              <Plus className="w-4 h-4 mr-2" />
              Nova Sugestão
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Enviar Sugestão</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-tipo">
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TIPOS.map((tipo) => (
                            <SelectItem key={tipo.value} value={tipo.value}>
                              <div className="flex items-center gap-2">
                                <tipo.icon className={`w-4 h-4 ${tipo.color}`} />
                                {tipo.label}
                              </div>
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
                  name="titulo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título</FormLabel>
                      <FormControl>
                        <Input placeholder="Descreva brevemente sua sugestão" {...field} data-testid="input-titulo" />
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
                      <FormLabel>Descrição Detalhada</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Explique com detalhes o que você gostaria de ver no sistema..." 
                          className="min-h-[120px]"
                          {...field} 
                          data-testid="input-descricao"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="prioridade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prioridade</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-prioridade">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PRIORIDADES.map((p) => (
                              <SelectItem key={p.value} value={p.value}>
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${p.color}`} />
                                  {p.label}
                                </div>
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
                    name="modulo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Módulo (opcional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-modulo">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MODULOS.map((m) => (
                              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="button-cancelar">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-enviar">
                    {createMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Enviar
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="hover-elevate">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold" data-testid="metric-total">{stats.total}</p>
              </div>
              <Lightbulb className="w-8 h-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-amber-500" data-testid="metric-pendentes">{stats.pendentes}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Em Análise</p>
                <p className="text-2xl font-bold text-blue-500" data-testid="metric-analise">{stats.emAnalise}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Concluídas</p>
                <p className="text-2xl font-bold text-emerald-500" data-testid="metric-concluidas">{stats.concluidas}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="todas" data-testid="tab-todas">Todas</TabsTrigger>
          <TabsTrigger value="minhas" data-testid="tab-minhas">Minhas</TabsTrigger>
          <TabsTrigger value="feature" data-testid="tab-features">
            <Sparkles className="w-4 h-4 mr-1" />
            Features
          </TabsTrigger>
          <TabsTrigger value="melhoria" data-testid="tab-melhorias">
            <Lightbulb className="w-4 h-4 mr-1" />
            Melhorias
          </TabsTrigger>
          <TabsTrigger value="bug" data-testid="tab-bugs">
            <Bug className="w-4 h-4 mr-1" />
            Bugs
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredSugestoes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Lightbulb className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhuma sugestão encontrada</p>
                <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar primeira sugestão
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredSugestoes.map((sugestao) => {
                const TipoIcon = getTipoIcon(sugestao.tipo);
                const statusConfig = STATUS_CONFIG[sugestao.status] || STATUS_CONFIG.pendente;
                const StatusIcon = statusConfig.icon;
                const isExpanded = expandedId === sugestao.id;
                const prioridadeConfig = PRIORIDADES.find(p => p.value === sugestao.prioridade);

                return (
                  <Card 
                    key={sugestao.id} 
                    className="hover-elevate cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : sugestao.id)}
                    data-testid={`card-sugestao-${sugestao.id}`}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg bg-muted ${getTipoColor(sugestao.tipo)}`}>
                          <TipoIcon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold truncate">{sugestao.titulo}</h3>
                            <Badge variant="outline" className={`${statusConfig.color} text-white border-0`}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {statusConfig.label}
                            </Badge>
                            {prioridadeConfig && sugestao.prioridade !== "media" && (
                              <Badge variant="outline" className={`${prioridadeConfig.color} text-white border-0`}>
                                {prioridadeConfig.label}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {sugestao.descricao}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>{sugestao.autorNome}</span>
                            <span>{format(new Date(sugestao.criadoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                            {sugestao.modulo && (
                              <Badge variant="secondary" className="text-xs">{sugestao.modulo}</Badge>
                            )}
                          </div>

                          {isExpanded && (
                            <div className="mt-4 pt-4 border-t space-y-3">
                              <div>
                                <h4 className="text-sm font-medium mb-1">Descrição Completa</h4>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{sugestao.descricao}</p>
                              </div>
                              
                              {sugestao.comentarioAdmin && (
                                <div className="p-3 bg-muted rounded-lg">
                                  <h4 className="text-sm font-medium mb-1 flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4" />
                                    Resposta da Equipe
                                  </h4>
                                  <p className="text-sm">{sugestao.comentarioAdmin}</p>
                                </div>
                              )}

                              {user?.role === "admin" && (
                                <div className="flex items-center gap-2 pt-2">
                                  <Select
                                    value={sugestao.status}
                                    onValueChange={(value) => {
                                      updateStatusMutation.mutate({ id: sugestao.id, status: value });
                                    }}
                                  >
                                    <SelectTrigger className="w-48" data-testid={`select-status-${sugestao.id}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                        <SelectItem key={key} value={key}>
                                          <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${config.color}`} />
                                            {config.label}
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
