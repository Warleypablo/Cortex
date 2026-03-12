import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Plus,
  Pencil,
  Trash2,
  FileText,
  Send,
  Loader2,
  Eye,
  X,
  UserPlus,
  Mail,
  Phone,
  MapPin,
  DollarSign,
  Check,
  Clock,
  AlertCircle,
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
  cliente_task_id: string | null;
  cliente_nome: string;
  entregaveis: Entregavel[];
  valor_remuneracao: string | null;
  prazo_entrega_dias: number;
  observacoes: string | null;
  assinafy_document_id: string | null;
  assinafy_status: string | null;
  enviado_em: string | null;
  assinado_em: string | null;
  status: string;
  criado_em: string;
}

interface Entregavel {
  tipo: string;
  quantidade: number;
}

interface ClienteSearch {
  task_id: string;
  nome: string;
  cnpj: string | null;
  status: string | null;
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

// ── Entregáveis presets ───────────────────────────────────────────────────────

const TIPOS_ENTREGAVEIS = [
  "Vídeo UGC",
  "Reels/Stories",
  "Fotos",
  "Review de Produto",
  "Unboxing",
  "Tutorial",
  "Post Feed",
  "Carrossel",
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
  const [contratoForm, setContratoForm] = useState({
    cliente_nome: "", cliente_task_id: "", entregaveis: [{ tipo: "Vídeo UGC", quantidade: 1 }] as Entregavel[],
    valor_remuneracao: "", prazo_entrega_dias: "3", observacoes: ""
  });
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteResults, setClienteResults] = useState<ClienteSearch[]>([]);
  const [searchingClientes, setSearchingClientes] = useState(false);

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
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/creators/${selectedCreator!.id}/contratos`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Contrato criado" });
      queryClient.invalidateQueries({ queryKey: ["/api/creators", selectedCreator?.id, "contratos"] });
      setContratoDialogOpen(false);
      resetContratoForm();
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
      cliente_nome: "", cliente_task_id: "",
      entregaveis: [{ tipo: "Vídeo UGC", quantidade: 1 }],
      valor_remuneracao: "", prazo_entrega_dias: "3", observacoes: ""
    });
    setClienteSearch("");
    setClienteResults([]);
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

  // Cliente search with debounce
  const searchClientes = useCallback(async (q: string) => {
    if (q.length < 2) { setClienteResults([]); return; }
    setSearchingClientes(true);
    try {
      const res = await fetch(`/api/creators/clientes/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setClienteResults(data);
    } catch { setClienteResults([]); }
    finally { setSearchingClientes(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchClientes(clienteSearch), 300);
    return () => clearTimeout(t);
  }, [clienteSearch, searchClientes]);

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
            <TabsTrigger value="contratos" className="gap-2" disabled={!selectedCreator}>
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
                    <TableRow key={c.id} className={!c.ativo ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.email}</TableCell>
                      <TableCell className="text-sm">{c.cnpj || c.cpf || "—"}</TableCell>
                      <TableCell className="text-sm">{[c.cidade, c.estado].filter(Boolean).join("/") || "—"}</TableCell>
                      <TableCell className="text-sm">{c.chave_pix ? `${c.tipo_pix || "PIX"}: ${c.chave_pix.substring(0, 20)}...` : "—"}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedCreator(c); setActiveTab("contratos"); }}>
                          <FileText className="w-4 h-4" />
                        </Button>
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
          {selectedCreator && (
            <>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="font-semibold text-lg">{selectedCreator.nome}</h3>
                      <p className="text-sm text-muted-foreground">{selectedCreator.email} | {selectedCreator.cnpj || selectedCreator.cpf || "Sem doc"}</p>
                    </div>
                    <Button onClick={() => { resetContratoForm(); setContratoDialogOpen(true); }} className="gap-2">
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
                              <span className="font-medium">{ct.cliente_nome}</span>
                              {statusBadge(ct.status)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Valor: {formatCurrency(ct.valor_remuneracao)} | Prazo: {ct.prazo_entrega_dias} dias
                            </p>
                            {ct.entregaveis && Array.isArray(ct.entregaveis) && ct.entregaveis.length > 0 && (
                              <div className="flex gap-1 flex-wrap mt-1">
                                {ct.entregaveis.map((e: any, i: number) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {e.quantidade}x {e.tipo}
                                  </Badge>
                                ))}
                              </div>
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
      <Dialog open={contratoDialogOpen} onOpenChange={setContratoDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Contrato para {selectedCreator?.nome}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            saveContrato.mutate({
              cliente_nome: contratoForm.cliente_nome,
              cliente_task_id: contratoForm.cliente_task_id,
              entregaveis: contratoForm.entregaveis,
              valor_remuneracao: parseFloat(contratoForm.valor_remuneracao.replace(/[^\d.,]/g, '').replace(',', '.')) || 0,
              prazo_entrega_dias: parseInt(contratoForm.prazo_entrega_dias) || 3,
              observacoes: contratoForm.observacoes,
            });
          }} className="space-y-4">
            {/* Cliente search */}
            <div>
              <Label>Cliente / Marca *</Label>
              <div className="relative">
                <Input
                  placeholder="Buscar cliente..."
                  value={clienteSearch || contratoForm.cliente_nome}
                  onChange={e => {
                    setClienteSearch(e.target.value);
                    setContratoForm(f => ({ ...f, cliente_nome: e.target.value, cliente_task_id: "" }));
                  }}
                />
                {searchingClientes && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
              {clienteResults.length > 0 && (
                <div className="border rounded-md mt-1 max-h-40 overflow-y-auto dark:border-zinc-700 bg-background">
                  {clienteResults.map(cl => (
                    <button
                      key={cl.task_id}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 flex items-center justify-between"
                      onClick={() => {
                        setContratoForm(f => ({ ...f, cliente_nome: cl.nome, cliente_task_id: cl.task_id }));
                        setClienteSearch("");
                        setClienteResults([]);
                      }}
                    >
                      <span>{cl.nome}</span>
                      {cl.cnpj && <span className="text-xs text-muted-foreground">{cl.cnpj}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Entregáveis */}
            <div>
              <Label>Entregáveis</Label>
              <div className="space-y-2 mt-1">
                {contratoForm.entregaveis.map((ent, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Select
                      value={ent.tipo}
                      onValueChange={v => {
                        const updated = [...contratoForm.entregaveis];
                        updated[i] = { ...updated[i], tipo: v };
                        setContratoForm(f => ({ ...f, entregaveis: updated }));
                      }}
                    >
                      <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIPOS_ENTREGAVEIS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      className="w-20"
                      value={ent.quantidade}
                      onChange={e => {
                        const updated = [...contratoForm.entregaveis];
                        updated[i] = { ...updated[i], quantidade: parseInt(e.target.value) || 1 };
                        setContratoForm(f => ({ ...f, entregaveis: updated }));
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setContratoForm(f => ({ ...f, entregaveis: f.entregaveis.filter((_, idx) => idx !== i) }));
                      }}
                      disabled={contratoForm.entregaveis.length <= 1}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setContratoForm(f => ({ ...f, entregaveis: [...f.entregaveis, { tipo: "Vídeo UGC", quantidade: 1 }] }))}
                >
                  <Plus className="w-3 h-3 mr-1" /> Adicionar
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$) *</Label>
                <Input
                  placeholder="0,00"
                  value={contratoForm.valor_remuneracao}
                  onChange={e => setContratoForm(f => ({ ...f, valor_remuneracao: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label>Prazo de Entrega (dias)</Label>
                <Input
                  type="number"
                  min={1}
                  value={contratoForm.prazo_entrega_dias}
                  onChange={e => setContratoForm(f => ({ ...f, prazo_entrega_dias: e.target.value }))}
                />
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
