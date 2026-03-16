import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Megaphone,
  Search,
  Pencil,
  Trash2,
  FileText,
  Send,
  Loader2,
  Eye,
  UserPlus,
  Check,
  Clock,
  AlertCircle,
  Plus,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Creator {
  id: number;
  nome: string;
  cpf: string | null;
  cnpj: string | null;
  email: string;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  chave_pix: string | null;
  tipo_pix: string | null;
  ativo: boolean;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

interface ContratoCreator {
  id: number;
  creator_id: number;
  cargo: string | null;
  descricao_servicos: string | null;
  valor_remuneracao: string | null;
  duracao_meses: number;
  data_inicio: string | null;
  data_fim: string | null;
  observacoes: string | null;
  assinafy_document_id: string | null;
  assinafy_status: string | null;
  enviado_em: string | null;
  assinado_em: string | null;
  status: string;
  criado_em: string;
  qtd_videos: number | null;
  qtd_creators: number | null;
  qtd_variacoes_gancho: number | null;
  unidade_prazo: string | null;
  cliente_nome: string | null;
  cliente_task_id: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(value: string | number | null): string {
  const num = typeof value === 'string' ? parseFloat(value) : (value || 0);
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function statusBadge(status: string) {
  const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Check }> = {
    rascunho: { variant: "secondary", icon: Clock },
    enviado: { variant: "default", icon: Send },
    assinado: { variant: "default", icon: Check },
    recusado: { variant: "destructive", icon: AlertCircle },
  };
  const cfg = map[status] || map.rascunho;
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} className="gap-1">
      <Icon className="w-3 h-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

// ── Presets de cargo ──────────────────────────────────────────────────────────

const CARGOS_PRESET = [
  "Editor de Vídeo",
  "Designer",
  "Social Media",
  "Copywriter",
  "Gestor de Tráfego",
  "Fotógrafo",
  "Motion Designer",
  "Produtor de Conteúdo",
  "Consultor de Marketing",
  "Outro",
];

// ── Main Component ────────────────────────────────────────────────────────────

export default function Creators() {
  useSetPageInfo("Contratos Creators", "Gestão de creators/freelancers e contratos de prestação de serviços");
  usePageTitle("Contratos Creators");

  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("creators");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  // Creator form state
  const [creatorDialogOpen, setCreatorDialogOpen] = useState(false);
  const [editingCreator, setEditingCreator] = useState<Creator | null>(null);
  const [creatorForm, setCreatorForm] = useState({
    nome: "", cpf: "", cnpj: "", email: "", endereco: "", cidade: "", estado: "", cep: "",
    chave_pix: "", tipo_pix: "", observacoes: ""
  });

  // Contrato state
  const [selectedCreator, setSelectedCreator] = useState<Creator | null>(null);
  const [contratoDialogOpen, setContratoDialogOpen] = useState(false);
  const [contratoCriadoId, setContratoCriadoId] = useState<number | null>(null);
  const [contratoForm, setContratoForm] = useState({
    cargo: "", descricao_servicos: "",
    valor_remuneracao: "", duracao_meses: "6",
    data_inicio: "", data_fim: "", observacoes: "",
    qtd_videos: "", qtd_creators: "", qtd_variacoes_gancho: "",
    unidade_prazo: "meses", cliente_nome: "", cliente_task_id: ""
  });
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteResults, setClienteResults] = useState<Array<{ task_id: string; nome: string; cnpj: string }>>([]);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const clienteSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchClientes = useCallback((q: string) => {
    if (clienteSearchTimer.current) clearTimeout(clienteSearchTimer.current);
    if (q.length < 2) { setClienteResults([]); setShowClienteDropdown(false); return; }
    clienteSearchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/creators/clientes/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setClienteResults(data);
          setShowClienteDropdown(data.length > 0);
        }
      } catch { /* ignore */ }
    }, 300);
  }, []);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: creators = [], isLoading: loadingCreators } = useQuery<Creator[]>({
    queryKey: ["/api/creators", showInactive],
    queryFn: async () => {
      const ativo = showInactive ? '' : 'true';
      const res = await fetch(`/api/creators?ativo=${ativo}`);
      if (!res.ok) throw new Error("Erro ao carregar creators");
      return res.json();
    },
  });

  const { data: contratos = [], isLoading: loadingContratos } = useQuery<ContratoCreator[]>({
    queryKey: ["/api/creators", selectedCreator?.id, "contratos"],
    queryFn: async () => {
      if (!selectedCreator) return [];
      const res = await fetch(`/api/creators/${selectedCreator.id}/contratos`);
      if (!res.ok) throw new Error("Erro ao carregar contratos");
      return res.json();
    },
    enabled: !!selectedCreator,
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  const saveCreator = useMutation({
    mutationFn: async (data: typeof creatorForm) => {
      const url = editingCreator ? `/api/creators/${editingCreator.id}` : "/api/creators";
      const method = editingCreator ? "PUT" : "POST";
      const res = await apiRequest(method, url, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: editingCreator ? "Creator atualizado" : "Creator cadastrado" });
      queryClient.invalidateQueries({ queryKey: ["/api/creators"] });
      setCreatorDialogOpen(false);
      resetCreatorForm();
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const deleteCreator = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/creators/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Creator desativado" });
      queryClient.invalidateQueries({ queryKey: ["/api/creators"] });
    },
  });

  const saveContrato = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("POST", `/api/creators/${selectedCreator!.id}/contratos`, data);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Contrato criado" });
      queryClient.invalidateQueries({ queryKey: ["/api/creators", selectedCreator?.id, "contratos"] });
      setContratoCriadoId(data.id);
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const enviarAssinatura = useMutation({
    mutationFn: async (contratoId: number) => {
      const res = await apiRequest("POST", `/api/creators/contratos/${contratoId}/enviar-assinatura`);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Contrato enviado!", description: `Email: ${data.emailEnviado}` });
      queryClient.invalidateQueries({ queryKey: ["/api/creators", selectedCreator?.id, "contratos"] });
      setContratoDialogOpen(false);
      setContratoCriadoId(null);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    },
  });

  // ── Helpers ──────────────────────────────────────────────────────────────

  function resetCreatorForm() {
    setEditingCreator(null);
    setCreatorForm({ nome: "", cpf: "", cnpj: "", email: "", endereco: "", cidade: "", estado: "", cep: "", chave_pix: "", tipo_pix: "", observacoes: "" });
  }

  function resetContratoForm() {
    setContratoForm({
      cargo: "", descricao_servicos: "",
      valor_remuneracao: "", duracao_meses: "6",
      data_inicio: "", data_fim: "", observacoes: "",
      qtd_videos: "", qtd_creators: "", qtd_variacoes_gancho: "",
      unidade_prazo: "meses", cliente_nome: "", cliente_task_id: ""
    });
    setClienteSearch("");
    setClienteResults([]);
  }

  function calcDataFim(dataInicio: string, valor: number, unidade: string = "meses"): string {
    if (!dataInicio) return "";
    try {
      const d = new Date(dataInicio + 'T12:00:00');
      if (unidade === "dias") {
        d.setDate(d.getDate() + valor);
      } else {
        d.setMonth(d.getMonth() + valor);
      }
      return d.toISOString().split('T')[0];
    } catch { return ""; }
  }

  function openEditCreator(creator: Creator) {
    setEditingCreator(creator);
    setCreatorForm({
      nome: creator.nome, cpf: creator.cpf || "", cnpj: creator.cnpj || "",
      email: creator.email, endereco: creator.endereco || "", cidade: creator.cidade || "",
      estado: creator.estado || "", cep: creator.cep || "", chave_pix: creator.chave_pix || "",
      tipo_pix: creator.tipo_pix || "", observacoes: creator.observacoes || ""
    });
    setCreatorDialogOpen(true);
  }

  function openNewCreator() {
    resetCreatorForm();
    setCreatorDialogOpen(true);
  }

  // Filter creators
  const filtered = creators.filter(c =>
    !search || c.nome.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase())
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="creators" className="gap-2">
              <Megaphone className="w-4 h-4" />
              Creators
            </TabsTrigger>
            <TabsTrigger value="contratos" className="gap-2">
              <FileText className="w-4 h-4" />
              Contratos {selectedCreator ? `- ${selectedCreator.nome}` : ""}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── TAB CREATORS ─────────────────────────────────────────────── */}
        <TabsContent value="creators" className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar creator..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
              Mostrar inativos
            </label>
            <Button onClick={openNewCreator} className="gap-2 ml-auto">
              <UserPlus className="w-4 h-4" />
              Novo Creator
            </Button>
          </div>

          {loadingCreators ? (
            <div className="grid gap-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum creator encontrado</CardContent></Card>
          ) : (
            <div className="rounded-md border dark:border-zinc-700">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>CPF/CNPJ</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead>PIX</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(c => (
                    <TableRow
                      key={c.id}
                      className={`cursor-pointer hover:bg-muted/50 ${!c.ativo ? "opacity-50" : ""} ${selectedCreator?.id === c.id ? "bg-muted/30" : ""}`}
                      onClick={() => { setSelectedCreator(c); setActiveTab("contratos"); }}
                    >
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.email}</TableCell>
                      <TableCell className="text-sm">{c.cnpj || c.cpf || "—"}</TableCell>
                      <TableCell className="text-sm">{[c.cidade, c.estado].filter(Boolean).join("/") || "—"}</TableCell>
                      <TableCell className="text-sm">{c.chave_pix ? `${c.tipo_pix || "PIX"}: ${c.chave_pix.substring(0, 20)}...` : "—"}</TableCell>
                      <TableCell className="text-right space-x-1" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" onClick={() => openEditCreator(c)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {c.ativo && (
                          <Button variant="ghost" size="sm" onClick={() => deleteCreator.mutate(c.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── TAB CONTRATOS ────────────────────────────────────────────── */}
        <TabsContent value="contratos" className="space-y-4">
          {!selectedCreator ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Megaphone className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">Selecione um creator na aba anterior para ver os contratos</p>
                <Button variant="outline" className="mt-4" onClick={() => setActiveTab("creators")}>
                  Ir para Creators
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="font-semibold text-lg">{selectedCreator.nome}</h3>
                      <p className="text-sm text-muted-foreground">{selectedCreator.email} | {selectedCreator.cnpj || selectedCreator.cpf || "Sem doc"}</p>
                    </div>
                    <Button onClick={() => { resetContratoForm(); setContratoCriadoId(null); setContratoDialogOpen(true); }} className="gap-2">
                      <Plus className="w-4 h-4" />
                      Novo Contrato
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {loadingContratos ? (
                <div className="grid gap-3">{[1,2].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
              ) : contratos.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum contrato ainda</CardContent></Card>
              ) : (
                <div className="grid gap-3">
                  {contratos.map(ct => (
                    <Card key={ct.id}>
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{ct.cargo || 'Contrato'}</span>
                              {statusBadge(ct.status)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Valor: {formatCurrency(ct.valor_remuneracao)} | Prazo: {ct.duracao_meses} {ct.unidade_prazo || 'meses'}
                            </p>
                            {ct.data_inicio && ct.data_fim && (
                              <p className="text-sm text-muted-foreground">
                                Vigência: {format(new Date(ct.data_inicio + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })} a {format(new Date(ct.data_fim + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              Criado em {format(new Date(ct.criado_em), "dd/MM/yyyy", { locale: ptBR })}
                              {ct.enviado_em && ` | Enviado em ${format(new Date(ct.enviado_em), "dd/MM/yyyy", { locale: ptBR })}`}
                              {ct.assinado_em && ` | Assinado em ${format(new Date(ct.assinado_em), "dd/MM/yyyy", { locale: ptBR })}`}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => window.open(`/api/creators/contratos/${ct.id}/preview-pdf`, '_blank')}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              PDF
                            </Button>
                            {ct.status === 'rascunho' && (
                              <Button
                                size="sm"
                                className="gap-1"
                                disabled={enviarAssinatura.isPending}
                                onClick={() => enviarAssinatura.mutate(ct.id)}
                              >
                                {enviarAssinatura.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                Enviar
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

      </Tabs>

      {/* ── Dialog: Creator Form ──────────────────────────────────────── */}
      <Dialog open={creatorDialogOpen} onOpenChange={setCreatorDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCreator ? "Editar Creator" : "Novo Creator"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveCreator.mutate(creatorForm); }} className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label>Nome *</Label>
                <Input value={creatorForm.nome} onChange={e => setCreatorForm(f => ({ ...f, nome: e.target.value }))} required />
              </div>
              <div>
                <Label>Email *</Label>
                <Input type="email" value={creatorForm.email} onChange={e => setCreatorForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>CPF</Label>
                  <Input value={creatorForm.cpf} onChange={e => setCreatorForm(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" />
                </div>
                <div>
                  <Label>CNPJ</Label>
                  <Input value={creatorForm.cnpj} onChange={e => setCreatorForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
                </div>
              </div>
              <div>
                <Label>Endereço</Label>
                <Input value={creatorForm.endereco} onChange={e => setCreatorForm(f => ({ ...f, endereco: e.target.value }))} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Cidade</Label>
                  <Input value={creatorForm.cidade} onChange={e => setCreatorForm(f => ({ ...f, cidade: e.target.value }))} />
                </div>
                <div>
                  <Label>UF</Label>
                  <Input maxLength={2} value={creatorForm.estado} onChange={e => setCreatorForm(f => ({ ...f, estado: e.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <Label>CEP</Label>
                  <Input value={creatorForm.cep} onChange={e => setCreatorForm(f => ({ ...f, cep: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo PIX</Label>
                  <Select value={creatorForm.tipo_pix} onValueChange={v => setCreatorForm(f => ({ ...f, tipo_pix: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="cnpj">CNPJ</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="telefone">Telefone</SelectItem>
                      <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Chave PIX</Label>
                  <Input value={creatorForm.chave_pix} onChange={e => setCreatorForm(f => ({ ...f, chave_pix: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={creatorForm.observacoes} onChange={e => setCreatorForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreatorDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveCreator.isPending}>
                {saveCreator.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Contrato Form ─────────────────────────────────────── */}
      <Dialog open={contratoDialogOpen} onOpenChange={(open) => { setContratoDialogOpen(open); if (!open) setContratoCriadoId(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{contratoCriadoId ? 'Contrato Criado' : `Novo Contrato para ${selectedCreator?.nome}`}</DialogTitle>
          </DialogHeader>

          {contratoCriadoId ? (
            <div className="space-y-6 py-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <Check className="w-5 h-5 text-green-500 shrink-0" />
                <p className="text-sm">Contrato criado com sucesso para <strong>{selectedCreator?.nome}</strong></p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="gap-2 h-auto py-4 flex-col"
                  onClick={() => window.open(`/api/creators/contratos/${contratoCriadoId}/preview-pdf`, '_blank')}
                >
                  <Eye className="w-5 h-5" />
                  Visualizar PDF
                </Button>
                <Button
                  className="gap-2 h-auto py-4 flex-col"
                  disabled={enviarAssinatura.isPending}
                  onClick={() => enviarAssinatura.mutate(contratoCriadoId)}
                >
                  {enviarAssinatura.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  Enviar para Assinatura
                </Button>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setContratoDialogOpen(false); setContratoCriadoId(null); }}>
                  Fechar
                </Button>
              </DialogFooter>
            </div>
          ) : (
          <form onSubmit={(e) => {
            e.preventDefault();
            const duracao = parseInt(contratoForm.duracao_meses) || 6;
            saveContrato.mutate({
              cargo: contratoForm.cargo,
              descricao_servicos: contratoForm.descricao_servicos,
              valor_remuneracao: parseFloat(contratoForm.valor_remuneracao.replace(/[^\d.,]/g, '').replace(',', '.')) || 0,
              duracao_meses: duracao,
              data_inicio: contratoForm.data_inicio,
              data_fim: contratoForm.data_fim || calcDataFim(contratoForm.data_inicio, duracao, contratoForm.unidade_prazo),
              observacoes: contratoForm.observacoes,
              unidade_prazo: contratoForm.unidade_prazo,
              cliente_nome: contratoForm.cliente_nome || null,
              cliente_task_id: contratoForm.cliente_task_id || null,
              ...(contratoForm.cargo === "Produtor de Conteúdo" ? {
                qtd_videos: parseInt(contratoForm.qtd_videos) || null,
                qtd_variacoes_gancho: parseInt(contratoForm.qtd_variacoes_gancho) || null,
              } : {}),
            });
          }} className="space-y-4">
            {/* Busca de Cliente */}
            <div className="relative">
              <Label>Cliente (opcional)</Label>
              {contratoForm.cliente_nome ? (
                <div className="flex items-center gap-2 mt-1 p-2 rounded-md border dark:border-zinc-700 bg-muted/30">
                  <span className="text-sm flex-1">{contratoForm.cliente_nome}</span>
                  <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => {
                    setContratoForm(f => ({ ...f, cliente_nome: "", cliente_task_id: "" }));
                    setClienteSearch("");
                  }}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Buscar cliente por nome..."
                    value={clienteSearch}
                    onChange={e => { setClienteSearch(e.target.value); searchClientes(e.target.value); }}
                    onFocus={() => { if (clienteResults.length > 0) setShowClienteDropdown(true); }}
                    onBlur={() => setTimeout(() => setShowClienteDropdown(false), 200)}
                  />
                  {showClienteDropdown && clienteResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto rounded-md border dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg">
                      {clienteResults.map(c => (
                        <button
                          key={c.task_id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 border-b dark:border-zinc-800 last:border-0"
                          onMouseDown={() => {
                            setContratoForm(f => ({ ...f, cliente_nome: c.nome, cliente_task_id: c.task_id }));
                            setClienteSearch("");
                            setShowClienteDropdown(false);
                          }}
                        >
                          <span className="font-medium">{c.nome}</span>
                          {c.cnpj && <span className="text-muted-foreground ml-2">({c.cnpj})</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Cargo */}
            <div>
              <Label>Cargo / Função *</Label>
              <Select
                value={CARGOS_PRESET.includes(contratoForm.cargo) ? contratoForm.cargo : "Outro"}
                onValueChange={v => {
                  if (v === "Outro") {
                    setContratoForm(f => ({ ...f, cargo: "" }));
                  } else {
                    setContratoForm(f => ({ ...f, cargo: v }));
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
                <SelectContent>
                  {CARGOS_PRESET.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              {(!CARGOS_PRESET.includes(contratoForm.cargo) || contratoForm.cargo === "") && (
                <Input
                  className="mt-2"
                  placeholder="Digite o cargo..."
                  value={contratoForm.cargo === "Outro" ? "" : contratoForm.cargo}
                  onChange={e => setContratoForm(f => ({ ...f, cargo: e.target.value }))}
                  required
                />
              )}
            </div>

            {/* Campos condicionais — Produtor de Conteúdo */}
            {contratoForm.cargo === "Produtor de Conteúdo" && (
              <div className="grid grid-cols-2 gap-3 p-3 rounded-md border dark:border-zinc-700 bg-muted/20">
                <div>
                  <Label>Qtd Vídeos</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="10"
                    value={contratoForm.qtd_videos}
                    onChange={e => setContratoForm(f => ({ ...f, qtd_videos: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Variações de Gancho</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="2"
                    value={contratoForm.qtd_variacoes_gancho}
                    onChange={e => setContratoForm(f => ({ ...f, qtd_variacoes_gancho: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {/* Descrição dos Serviços */}
            <div>
              <Label>Descrição dos Serviços *</Label>
              <Textarea
                placeholder="Ex: criar, gravar e editar vídeos para campanhas de marketing digital, redes sociais, YouTube..."
                value={contratoForm.descricao_servicos}
                onChange={e => setContratoForm(f => ({ ...f, descricao_servicos: e.target.value }))}
                rows={4}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">Descreva as atribuições que constarão na cláusula do objeto do contrato</p>
            </div>

            {/* Valor e Duração */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$) *</Label>
                <Input
                  placeholder="2.500,00"
                  value={contratoForm.valor_remuneracao}
                  onChange={e => setContratoForm(f => ({ ...f, valor_remuneracao: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label>Prazo</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={contratoForm.unidade_prazo === "dias" ? 365 : 60}
                    className="flex-1"
                    value={contratoForm.duracao_meses}
                    onChange={e => {
                      const val = parseInt(e.target.value) || 6;
                      setContratoForm(f => ({
                        ...f,
                        duracao_meses: e.target.value,
                        data_fim: f.data_inicio ? calcDataFim(f.data_inicio, val, f.unidade_prazo) : f.data_fim
                      }));
                    }}
                  />
                  <Select
                    value={contratoForm.unidade_prazo}
                    onValueChange={v => {
                      const val = parseInt(contratoForm.duracao_meses) || 6;
                      setContratoForm(f => ({
                        ...f,
                        unidade_prazo: v,
                        data_fim: f.data_inicio ? calcDataFim(f.data_inicio, val, v) : f.data_fim
                      }));
                    }}
                  >
                    <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meses">Meses</SelectItem>
                      <SelectItem value="dias">Dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Datas */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data de Início *</Label>
                <Input
                  type="date"
                  value={contratoForm.data_inicio}
                  onChange={e => {
                    const inicio = e.target.value;
                    const val = parseInt(contratoForm.duracao_meses) || 6;
                    setContratoForm(f => ({
                      ...f,
                      data_inicio: inicio,
                      data_fim: calcDataFim(inicio, val, f.unidade_prazo)
                    }));
                  }}
                  required
                />
              </div>
              <div>
                <Label>Data de Fim</Label>
                <Input
                  type="date"
                  value={contratoForm.data_fim}
                  onChange={e => setContratoForm(f => ({ ...f, data_fim: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground mt-1">Calculada automaticamente</p>
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={contratoForm.observacoes}
                onChange={e => setContratoForm(f => ({ ...f, observacoes: e.target.value }))}
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setContratoDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveContrato.isPending}>
                {saveContrato.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Criar Contrato
              </Button>
            </DialogFooter>
          </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
