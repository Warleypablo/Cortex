import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { usePageTitle } from "@/hooks/use-page-title";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Loader2, CheckCircle2, Clock, XCircle, ShoppingCart, Package, ExternalLink, Wrench, Eye, EyeOff, KeyRound } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SolicitacaoItem {
  id: number;
  nome_item: string;
  categoria: string;
  valor_unitario: string;
  quantidade: number;
  valor_total: string;
  recorrencia: string;
  descricao_produto: string | null;
  link_compra: string;
  motivo: string;
  login_email: string | null;
  login_senha: string | null;
  status: string;
  motivo_rejeicao: string | null;
  solicitante_id: string;
  solicitante_nome: string;
  solicitante_email: string;
  aprovador_nome: string | null;
  aprovador_email: string | null;
  criado_em: string;
  atualizado_em: string;
  aprovado_em: string | null;
  comprado_em: string | null;
}

interface Stats {
  pendentes: string;
  aprovadas: string;
  compradas: string;
  rejeitadas: string;
  total: string;
  valor_aprovado: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
}

const RECORRENCIA_OPTIONS = [
  { value: "unico", label: "Pagamento Único" },
  { value: "mensal", label: "Mensal" },
  { value: "anual", label: "Anual" },
];

const CATEGORIA_OPTIONS = [
  { value: "ferramenta_ia", label: "Ferramenta de IA" },
  { value: "curso", label: "Curso / Treinamento" },
  { value: "software", label: "Software / SaaS" },
  { value: "hardware", label: "Hardware / Equipamento" },
  { value: "livro", label: "Livro / Material" },
  { value: "certificacao", label: "Certificação" },
  { value: "outros", label: "Outros" },
];

const solicitacaoFormSchema = z.object({
  nome_item: z.string().min(3, "Nome deve ter pelo menos 3 caracteres").max(255),
  descricao_produto: z.string().min(5, "Descreva o que o produto faz"),
  categoria: z.string().min(1, "Selecione uma categoria"),
  valor_unitario: z.number().min(0.01, "Valor deve ser maior que 0"),
  quantidade: z.number().int().min(1, "Quantidade mínima é 1"),
  recorrencia: z.enum(["mensal", "anual", "unico"]),
  link_compra: z.string().url("Insira uma URL válida"),
  motivo: z.string().min(10, "Descreva melhor o motivo (mínimo 10 caracteres)"),
  login_email: z.string().optional().default(""),
  login_senha: z.string().optional().default(""),
});

type SolicitacaoFormData = z.infer<typeof solicitacaoFormSchema>;

const STATUS_CONFIG: Record<string, { label: string; variant: string; icon: any }> = {
  pendente_aprovacao: { label: "Pendente", variant: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Clock },
  aprovado: { label: "Aprovado", variant: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: CheckCircle2 },
  rejeitado: { label: "Rejeitado", variant: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
  comprado: { label: "Comprado", variant: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: ShoppingCart },
};

const APPROVER_EMAILS = [
  "victor.peixoto@turbopartners.com.br",
  "rodrigo.queiroz@turbopartners.com.br",
];

function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function SolicitacaoFerramentas() {
  usePageTitle("Solicitação de Ferramentas");
  useSetPageInfo("Solicitação de Ferramentas", "Solicite ferramentas e cursos para seu trabalho");
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("minhas");
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });
  const [rejectReason, setRejectReason] = useState("");

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const approver = user && (APPROVER_EMAILS.includes(user.email) || user.role === "admin");

  const { data: solicitacoes = [], isLoading } = useQuery<SolicitacaoItem[]>({
    queryKey: ["/api/solicitacao-ferramentas", { view: activeTab }],
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/solicitacao-ferramentas/stats"],
  });

  const form = useForm<SolicitacaoFormData>({
    resolver: zodResolver(solicitacaoFormSchema),
    defaultValues: {
      nome_item: "",
      descricao_produto: "",
      categoria: "",
      valor_unitario: 0,
      quantidade: 1,
      recorrencia: "unico" as const,
      link_compra: "",
      motivo: "",
      login_email: "",
      login_senha: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: SolicitacaoFormData) => {
      const res = await apiRequest("POST", "/api/solicitacao-ferramentas", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Solicitação enviada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/solicitacao-ferramentas"] });
      form.reset();
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Erro ao enviar solicitação", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, motivo_rejeicao }: { id: number; status: string; motivo_rejeicao?: string }) => {
      const res = await apiRequest("PATCH", `/api/solicitacao-ferramentas/${id}`, { status, motivo_rejeicao });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Status atualizado!" });
      queryClient.invalidateQueries({ queryKey: ["/api/solicitacao-ferramentas"] });
      setRejectDialog({ open: false, id: null });
      setRejectReason("");
    },
    onError: () => {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    },
  });

  const watchValor = form.watch("valor_unitario") || 0;
  const watchQtd = form.watch("quantidade") || 0;
  const valorTotal = watchValor * watchQtd;

  const handleReject = () => {
    if (!rejectDialog.id || !rejectReason.trim()) {
      toast({ title: "Informe o motivo da rejeição", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ id: rejectDialog.id, status: "rejeitado", motivo_rejeicao: rejectReason });
  };

  const pendentes = parseInt(stats?.pendentes || "0");
  const aprovadas = parseInt(stats?.aprovadas || "0");
  const compradas = parseInt(stats?.compradas || "0");
  const valorAprovado = parseFloat(stats?.valor_aprovado || "0");

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Solicitação de Ferramentas</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Solicite ferramentas e cursos para seu trabalho</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Solicitação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white">Nova Solicitação de Ferramenta/Curso</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="nome_item"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 dark:text-zinc-300">Nome do Item</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Notion Pro, Curso React Avançado" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="descricao_produto"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 dark:text-zinc-300">O que faz? (Descrição do produto)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descreva brevemente o que essa ferramenta/curso faz e como será usado..."
                          className="min-h-[60px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="categoria"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700 dark:text-zinc-300">Categoria</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CATEGORIA_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="recorrencia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700 dark:text-zinc-300">Recorrência</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {RECORRENCIA_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    control={form.control}
                    name="valor_unitario"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700 dark:text-zinc-300">Valor Unit. (R$)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0,00"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="quantidade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700 dark:text-zinc-300">Qtd.</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            placeholder="1"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">Valor Total</p>
                    <div className="h-9 flex items-center px-3 rounded-md bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700">
                      <span className="font-semibold text-sm text-gray-900 dark:text-white">
                        {formatCurrency(valorTotal)}
                      </span>
                    </div>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="link_compra"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 dark:text-zinc-300">Link de Compra</FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="motivo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 dark:text-zinc-300">Motivo da Solicitação</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Explique por que você precisa dessa ferramenta/curso..."
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Login credentials - optional */}
                <div className="border border-gray-200 dark:border-zinc-700 rounded-lg p-3 space-y-3">
                  <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 flex items-center gap-1">
                    <KeyRound className="w-3 h-3" />
                    Credenciais de acesso (opcional — preencha se a ferramenta precisar de login)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="login_email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700 dark:text-zinc-300 text-xs">E-mail da plataforma</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="email@exemplo.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="login_senha"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700 dark:text-zinc-300 text-xs">Senha da plataforma</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Enviar Solicitação
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-zinc-400">Pendentes</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{pendentes}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500/40" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-zinc-400">Aprovadas</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{aprovadas}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-blue-500/40" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-zinc-400">Compradas</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{compradas}</p>
              </div>
              <ShoppingCart className="w-8 h-8 text-green-500/40" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-zinc-400">Valor Aprovado</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(valorAprovado)}</p>
              </div>
              <Package className="w-8 h-8 text-gray-400/40 dark:text-zinc-500/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + Table */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100 dark:bg-zinc-800">
          <TabsTrigger value="minhas">Minhas Solicitações</TabsTrigger>
          {approver && <TabsTrigger value="aprovacoes">Aprovações</TabsTrigger>}
          {approver && <TabsTrigger value="compras">Compras</TabsTrigger>}
          {approver && <TabsTrigger value="todas">Todas</TabsTrigger>}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : solicitacoes.length === 0 ? (
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
              <CardContent className="py-12 text-center">
                <Wrench className="w-12 h-12 mx-auto text-gray-300 dark:text-zinc-600 mb-3" />
                <p className="text-gray-500 dark:text-zinc-400">Nenhuma solicitação encontrada</p>
                <Button variant="outline" className="mt-4" onClick={() => setIsDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar primeira solicitação
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-200 dark:border-zinc-700">
                      <TableHead className="text-gray-600 dark:text-zinc-400">Item</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400">Solicitante</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400 text-right">Valor Total</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400">Status</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400">Data</TableHead>
                      <TableHead className="text-gray-600 dark:text-zinc-400">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {solicitacoes.map((s) => {
                      const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.pendente_aprovacao;
                      const StatusIcon = cfg.icon;
                      return (
                        <TableRow key={s.id} className="border-gray-100 dark:border-zinc-800">
                          <TableCell>
                            <div className="max-w-md">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-gray-900 dark:text-white">{s.nome_item}</p>
                                {s.categoria && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400">
                                    {CATEGORIA_OPTIONS.find(c => c.value === s.categoria)?.label || s.categoria}
                                  </span>
                                )}
                              </div>
                              {s.descricao_produto && (
                                <p className="text-xs text-gray-600 dark:text-zinc-400 mt-0.5 line-clamp-2">
                                  {s.descricao_produto}
                                </p>
                              )}
                              <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">
                                {s.quantidade}x {formatCurrency(s.valor_unitario)}
                                {s.recorrencia && s.recorrencia !== "unico" && (
                                  <span className="ml-1 text-purple-600 dark:text-purple-400">
                                    ({RECORRENCIA_OPTIONS.find(r => r.value === s.recorrencia)?.label || s.recorrencia})
                                  </span>
                                )}
                              </p>
                              {approver && (s.login_email || s.login_senha) && (
                                <div className="mt-1 text-[10px] text-gray-500 dark:text-zinc-500 flex items-center gap-2">
                                  <KeyRound className="w-3 h-3" />
                                  <span>{s.login_email || "—"}</span>
                                  <span className="select-all bg-gray-100 dark:bg-zinc-800 px-1 rounded">{s.login_senha || "—"}</span>
                                </div>
                              )}
                              {s.motivo_rejeicao && (
                                <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                                  Motivo: {s.motivo_rejeicao}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-700 dark:text-zinc-300">
                            {s.solicitante_nome}
                          </TableCell>
                          <TableCell className="text-right font-medium text-gray-900 dark:text-white">
                            {formatCurrency(s.valor_total)}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.variant}`}>
                              <StatusIcon className="w-3 h-3" />
                              {cfg.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500 dark:text-zinc-400">
                            {format(new Date(s.criado_em), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <a
                                href={s.link_compra}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                                title="Abrir link de compra"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>

                              {approver && s.status === "pendente_aprovacao" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/20"
                                    onClick={() => updateMutation.mutate({ id: s.id, status: "aprovado" })}
                                    disabled={updateMutation.isPending}
                                  >
                                    Aprovar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                                    onClick={() => setRejectDialog({ open: true, id: s.id })}
                                    disabled={updateMutation.isPending}
                                  >
                                    Rejeitar
                                  </Button>
                                </>
                              )}

                              {approver && s.status === "aprovado" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20"
                                  onClick={() => updateMutation.mutate({ id: s.id, status: "comprado" })}
                                  disabled={updateMutation.isPending}
                                >
                                  <ShoppingCart className="w-3 h-3 mr-1" />
                                  Marcar Comprado
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
        </TabsContent>
      </Tabs>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={(open) => { setRejectDialog({ open, id: open ? rejectDialog.id : null }); setRejectReason(""); }}>
        <DialogContent className="max-w-md bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Rejeitar Solicitação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-zinc-400">Informe o motivo da rejeição:</p>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Motivo da rejeição..."
              className="min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, id: null })}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={updateMutation.isPending || !rejectReason.trim()}
            >
              {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
