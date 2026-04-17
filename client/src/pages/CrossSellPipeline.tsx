import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  MessageSquare,
  Trophy,
  Search,
  ChevronDown,
  Send,
  Calendar,
  User,
  Package,
  Clock,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRODUTOS = [
  "Performance", "Creators", "Social Media", "Inbound", "Outbound",
  "CRM", "BI", "Automacao", "Consultoria", "Treinamento",
  "Design", "Video", "SEO", "Midia Paga", "E-mail Marketing",
  "Eventos", "PR", "Branding", "Web", "App", "Marketplace", "Outros",
];

const ETAPAS = [
  "fazer_contato",
  "tentativa_contato",
  "reuniao_agendada",
  "em_contato",
  "proposta_enviada",
  "forte_interesse",
  "descartado",
] as const;

type Etapa = (typeof ETAPAS)[number];

const ETAPA_LABELS: Record<Etapa, string> = {
  fazer_contato: "Fazer Contato",
  tentativa_contato: "Tentativa de Contato",
  reuniao_agendada: "Reuniao Agendada",
  em_contato: "Em Contato",
  proposta_enviada: "Proposta Enviada",
  forte_interesse: "Forte Interesse",
  descartado: "Descartado",
};

const ETAPA_COLORS: Record<Etapa, string> = {
  fazer_contato: "bg-gray-200 text-gray-800 dark:bg-zinc-700 dark:text-zinc-200",
  tentativa_contato: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  reuniao_agendada: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  em_contato: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  proposta_enviada: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  forte_interesse: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  descartado: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const CLUSTERS = ["Regulares", "Imperdiveis", "Chaves", "NFNC"];

const OPERACOES = ["Upsell", "CrossSell", "Renovacao", "Upgrade"];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Oportunidade {
  id: number;
  clienteId: string;
  cnpj: string;
  clienteNome: string | null;
  clienteStatus: string | null;
  cluster: string | null;
  cxCliente: string | null;
  produtoMapeado: string;
  etapa: string;
  valorRNegociacao: number | null;
  valorPNegociacao: number | null;
  cxResponsavel: string;
  ultimoContato: string | null;
  criadoEm: string;
  atualizadoEm: string;
  valorRAtual: number;
  valorPAtual: number;
  contratoInicio: string | null;
  totalComentarios: number;
}

interface ClienteSearch {
  task_id: string;
  cnpj: string;
  nome: string;
  status: string;
  cluster: string;
  responsavel: string;
}

interface Comentario {
  id: number;
  oportunidade_id: number;
  autor: string;
  texto: string;
  criado_em: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calcLifetime(contratoInicio: string | null): string {
  if (!contratoInicio) return "-";
  const start = new Date(contratoInicio);
  const now = new Date();
  const months = Math.max(
    0,
    (now.getFullYear() - start.getFullYear()) * 12 +
      now.getMonth() -
      start.getMonth()
  );
  if (months < 12) return `${months}m`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years}a ${rem}m` : `${years}a`;
}

function formatDate(d: string | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("pt-BR");
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function CrossSellPipeline() {
  useSetPageInfo("CrossSell Pipeline", "Comercial");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Filters
  const [cluster, setCluster] = useState("todos");
  const [cxResp, setCxResp] = useState("todos");
  const [etapaFilter, setEtapaFilter] = useState("todas");
  const [produtoFilter, setProdutoFilter] = useState("todos");

  // Modals
  const [showNew, setShowNew] = useState(false);
  const [ganhoOp, setGanhoOp] = useState<Oportunidade | null>(null);
  const [commentOp, setCommentOp] = useState<Oportunidade | null>(null);

  // Query
  const { data: oportunidades = [], isLoading } = useQuery<Oportunidade[]>({
    queryKey: ["/api/comercial/crosssell"],
  });

  // Derived filters
  const cxResponsaveis = useMemo(() => {
    const set = new Set(oportunidades.map((o) => o.cxResponsavel));
    return Array.from(set).sort();
  }, [oportunidades]);

  const filtered = useMemo(() => {
    return oportunidades.filter((o) => {
      if (cluster !== "todos" && o.cluster !== cluster) return false;
      if (cxResp !== "todos" && o.cxResponsavel !== cxResp) return false;
      if (etapaFilter !== "todas" && o.etapa !== etapaFilter) return false;
      if (produtoFilter !== "todos" && o.produtoMapeado !== produtoFilter)
        return false;
      return true;
    });
  }, [oportunidades, cluster, cxResp, etapaFilter, produtoFilter]);

  // Mutation: change etapa
  const changeEtapa = useMutation({
    mutationFn: async ({ id, etapa }: { id: number; etapa: string }) => {
      const res = await fetch(`/api/comercial/crosssell/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etapa, alteradoPor: user?.name }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar etapa");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comercial/crosssell"] });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-48" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={cluster} onValueChange={setCluster}>
          <SelectTrigger className="w-40 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <SelectValue placeholder="Cluster" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Clusters</SelectItem>
            {CLUSTERS.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={cxResp} onValueChange={setCxResp}>
          <SelectTrigger className="w-48 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <SelectValue placeholder="CX Responsavel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos CX</SelectItem>
            {cxResponsaveis.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={etapaFilter} onValueChange={setEtapaFilter}>
          <SelectTrigger className="w-48 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <SelectValue placeholder="Etapa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas Etapas</SelectItem>
            {ETAPAS.map((e) => (
              <SelectItem key={e} value={e}>{ETAPA_LABELS[e]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={produtoFilter} onValueChange={setProdutoFilter}>
          <SelectTrigger className="w-44 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <SelectValue placeholder="Produto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Produtos</SelectItem>
            {PRODUTOS.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button onClick={() => setShowNew(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Oportunidade
        </Button>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-zinc-400">
        <span>{filtered.length} oportunidades</span>
        <span>|</span>
        <span>
          Valor R em negociacao:{" "}
          {formatCurrency(
            filtered.reduce((s, o) => s + (o.valorRNegociacao ?? 0), 0)
          )}
        </span>
        <span>
          Valor P em negociacao:{" "}
          {formatCurrency(
            filtered.reduce((s, o) => s + (o.valorPNegociacao ?? 0), 0)
          )}
        </span>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((op) => (
          <OpCard
            key={op.id}
            op={op}
            onChangeEtapa={(etapa) => changeEtapa.mutate({ id: op.id, etapa })}
            onGanho={() => setGanhoOp(op)}
            onComments={() => setCommentOp(op)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16 text-gray-400 dark:text-zinc-500">
            Nenhuma oportunidade encontrada com os filtros selecionados.
          </div>
        )}
      </div>

      {/* Modals */}
      {showNew && (
        <NewOpDialog
          open={showNew}
          onClose={() => setShowNew(false)}
          userName={user?.name ?? ""}
        />
      )}
      {ganhoOp && (
        <GanhoDialog
          open={!!ganhoOp}
          op={ganhoOp}
          onClose={() => setGanhoOp(null)}
          userName={user?.name ?? ""}
        />
      )}
      {commentOp && (
        <CommentsSheet
          open={!!commentOp}
          op={commentOp}
          onClose={() => setCommentOp(null)}
          userName={user?.name ?? ""}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OpCard
// ---------------------------------------------------------------------------

function OpCard({
  op,
  onChangeEtapa,
  onGanho,
  onComments,
}: {
  op: Oportunidade;
  onChangeEtapa: (etapa: string) => void;
  onGanho: () => void;
  onComments: () => void;
}) {
  const etapa = op.etapa as Etapa;
  const isDescartado = etapa === "descartado";

  return (
    <Card
      className={`bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 ${
        isDescartado ? "opacity-60" : ""
      }`}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
              {op.clienteNome ?? op.cnpj}
            </h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400 flex items-center gap-1">
              <User className="h-3 w-3" />
              {op.cxResponsavel}
            </p>
          </div>
          <Select value={etapa} onValueChange={onChangeEtapa}>
            <SelectTrigger className="h-auto py-0.5 px-2 border-0 w-auto gap-1">
              <Badge className={`text-xs ${ETAPA_COLORS[etapa] ?? "bg-gray-200 text-gray-800"}`}>
                {ETAPA_LABELS[etapa] ?? etapa}
              </Badge>
            </SelectTrigger>
            <SelectContent>
              {ETAPAS.map((e) => (
                <SelectItem key={e} value={e}>
                  {ETAPA_LABELS[e]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Data grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          <DataCell
            icon={<Package className="h-3 w-3" />}
            label="Produto"
            value={op.produtoMapeado}
          />
          <DataCell label="Status Conta" value={op.clienteStatus ?? "-"} />
          <DataCell
            label="Valor R Atual"
            value={formatCurrency(op.valorRAtual)}
          />
          <DataCell
            label="Valor P Atual"
            value={formatCurrency(op.valorPAtual)}
          />
          <DataCell
            label="Valor R Neg."
            value={
              op.valorRNegociacao != null
                ? formatCurrency(op.valorRNegociacao)
                : "-"
            }
          />
          <DataCell
            label="Valor P Neg."
            value={
              op.valorPNegociacao != null
                ? formatCurrency(op.valorPNegociacao)
                : "-"
            }
          />
          <DataCell
            icon={<Clock className="h-3 w-3" />}
            label="Lifetime"
            value={calcLifetime(op.contratoInicio)}
          />
          <DataCell
            icon={<Calendar className="h-3 w-3" />}
            label="Ultimo Contato"
            value={formatDate(op.ultimoContato)}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-zinc-800">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white"
            onClick={onComments}
          >
            <MessageSquare className="h-4 w-4" />
            {op.totalComentarios > 0 && (
              <span className="text-xs">{op.totalComentarios}</span>
            )}
          </Button>
          {!isDescartado && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
              onClick={onGanho}
            >
              <Trophy className="h-4 w-4" />
              Ganho
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DataCell({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-zinc-500 flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="text-gray-900 dark:text-white font-medium truncate">
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// New Oportunidade Dialog
// ---------------------------------------------------------------------------

function NewOpDialog({
  open,
  onClose,
  userName,
}: {
  open: boolean;
  onClose: () => void;
  userName: string;
}) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<ClienteSearch | null>(null);
  const [produto, setProduto] = useState("");
  const [valorR, setValorR] = useState("");
  const [valorP, setValorP] = useState("");

  const { data: clientes = [] } = useQuery<ClienteSearch[]>({
    queryKey: ["/api/comercial/crosssell/clientes", searchQuery],
    queryFn: async () => {
      if (searchQuery.length < 2) return [];
      const res = await fetch(
        `/api/comercial/crosssell/clientes?q=${encodeURIComponent(searchQuery)}`
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: searchQuery.length >= 2,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!selectedCliente || !produto) throw new Error("Preencha os campos");
      const res = await fetch("/api/comercial/crosssell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId: selectedCliente.task_id,
          cnpj: selectedCliente.cnpj,
          produtoMapeado: produto,
          cxResponsavel: userName || selectedCliente.responsavel,
          valorRNegociacao: valorR ? Number(valorR) : undefined,
          valorPNegociacao: valorP ? Number(valorP) : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Erro ao criar oportunidade");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comercial/crosssell"] });
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-white">
            Nova Oportunidade de CrossSell
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client search */}
          <div className="space-y-2">
            <Label className="text-gray-700 dark:text-zinc-300">Cliente</Label>
            {selectedCliente ? (
              <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedCliente.nome}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    {selectedCliente.cnpj} - {selectedCliente.cluster}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCliente(null)}
                >
                  Trocar
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nome ou CNPJ..."
                  className="pl-9 bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {clientes.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg">
                    {clientes.map((c) => (
                      <button
                        key={c.task_id}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-zinc-800 text-sm"
                        onClick={() => {
                          setSelectedCliente(c);
                          setSearchQuery("");
                        }}
                      >
                        <p className="font-medium text-gray-900 dark:text-white">
                          {c.nome}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-zinc-400">
                          {c.cnpj} - {c.cluster}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Product */}
          <div className="space-y-2">
            <Label className="text-gray-700 dark:text-zinc-300">Produto</Label>
            <Select value={produto} onValueChange={setProduto}>
              <SelectTrigger className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
                <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>
              <SelectContent>
                {PRODUTOS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Values */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-zinc-300">
                Valor R Negociacao
              </Label>
              <Input
                type="number"
                placeholder="0.00"
                className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
                value={valorR}
                onChange={(e) => setValorR(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-zinc-300">
                Valor P Negociacao
              </Label>
              <Input
                type="number"
                placeholder="0.00"
                className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
                value={valorP}
                onChange={(e) => setValorP(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => createMut.mutate()}
            disabled={!selectedCliente || !produto || createMut.isPending}
          >
            {createMut.isPending ? "Criando..." : "Criar Oportunidade"}
          </Button>
        </DialogFooter>

        {createMut.isError && (
          <p className="text-sm text-red-500 mt-2">
            {(createMut.error as Error).message}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Negocio Ganho Dialog
// ---------------------------------------------------------------------------

function GanhoDialog({
  open,
  op,
  onClose,
  userName,
}: {
  open: boolean;
  op: Oportunidade;
  onClose: () => void;
  userName: string;
}) {
  const queryClient = useQueryClient();
  const [operacoes, setOperacoes] = useState<string[]>([]);
  const [produto, setProduto] = useState(op.produtoMapeado);
  const [mesGanho, setMesGanho] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [valorR, setValorR] = useState(
    op.valorRNegociacao?.toString() ?? ""
  );
  const [valorP, setValorP] = useState(
    op.valorPNegociacao?.toString() ?? ""
  );

  const toggleOp = (o: string) => {
    setOperacoes((prev) =>
      prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]
    );
  };

  const ganhoMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/comercial/crosssell/${op.id}/ganho`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operacao: operacoes,
          produto,
          mesGanho,
          valorR: valorR ? Number(valorR) : undefined,
          valorP: valorP ? Number(valorP) : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Erro ao registrar ganho");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comercial/crosssell"] });
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-white">
            Registrar Negocio Ganho
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-zinc-400">
            Cliente: <strong className="text-gray-900 dark:text-white">{op.clienteNome ?? op.cnpj}</strong>
          </p>

          {/* Operacao badges */}
          <div className="space-y-2">
            <Label className="text-gray-700 dark:text-zinc-300">
              Tipo de Operacao
            </Label>
            <div className="flex flex-wrap gap-2">
              {OPERACOES.map((o) => (
                <button
                  key={o}
                  onClick={() => toggleOp(o)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    operacoes.includes(o)
                      ? "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700"
                      : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 border-gray-200 dark:border-zinc-700"
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          {/* Product */}
          <div className="space-y-2">
            <Label className="text-gray-700 dark:text-zinc-300">Produto</Label>
            <Select value={produto} onValueChange={setProduto}>
              <SelectTrigger className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUTOS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Month */}
          <div className="space-y-2">
            <Label className="text-gray-700 dark:text-zinc-300">
              Mes do Ganho
            </Label>
            <Input
              type="month"
              className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
              value={mesGanho}
              onChange={(e) => setMesGanho(e.target.value)}
            />
          </div>

          {/* Values */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-zinc-300">Valor R</Label>
              <Input
                type="number"
                placeholder="0.00"
                className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
                value={valorR}
                onChange={(e) => setValorR(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-zinc-300">Valor P</Label>
              <Input
                type="number"
                placeholder="0.00"
                className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
                value={valorP}
                onChange={(e) => setValorP(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => ganhoMut.mutate()}
            disabled={operacoes.length === 0 || ganhoMut.isPending}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {ganhoMut.isPending ? "Registrando..." : "Registrar Ganho"}
          </Button>
        </DialogFooter>

        {ganhoMut.isError && (
          <p className="text-sm text-red-500 mt-2">
            {(ganhoMut.error as Error).message}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Comments Sheet
// ---------------------------------------------------------------------------

function CommentsSheet({
  open,
  op,
  onClose,
  userName,
}: {
  open: boolean;
  op: Oportunidade;
  onClose: () => void;
  userName: string;
}) {
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState("");

  const { data: comentarios = [], isLoading } = useQuery<Comentario[]>({
    queryKey: [`/api/comercial/crosssell/${op.id}/comentarios`],
    enabled: open,
  });

  const addComment = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/comercial/crosssell/${op.id}/comentarios`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ autor: userName, texto }),
        }
      );
      if (!res.ok) throw new Error("Erro ao adicionar comentario");
      return res.json();
    },
    onSuccess: () => {
      setTexto("");
      queryClient.invalidateQueries({
        queryKey: [`/api/comercial/crosssell/${op.id}/comentarios`],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/comercial/crosssell"],
      });
    },
  });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-gray-900 dark:text-white">
            Comentarios - {op.clienteNome ?? op.cnpj}
          </SheetTitle>
        </SheetHeader>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto space-y-3 py-4">
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          )}
          {!isLoading && comentarios.length === 0 && (
            <p className="text-center text-gray-400 dark:text-zinc-500 py-8">
              Nenhum comentario ainda.
            </p>
          )}
          {comentarios.map((c) => (
            <div
              key={c.id}
              className="p-3 rounded-lg bg-gray-50 dark:bg-zinc-800 space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {c.autor}
                </span>
                <span className="text-xs text-gray-400 dark:text-zinc-500">
                  {new Date(c.criado_em).toLocaleString("pt-BR")}
                </span>
              </div>
              <p className="text-sm text-gray-700 dark:text-zinc-300">
                {c.texto}
              </p>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 dark:border-zinc-700 pt-3 flex gap-2">
          <Textarea
            placeholder="Escreva um comentario..."
            className="flex-1 resize-none bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white"
            rows={2}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && texto.trim()) {
                e.preventDefault();
                addComment.mutate();
              }
            }}
          />
          <Button
            size="icon"
            disabled={!texto.trim() || addComment.isPending}
            onClick={() => addComment.mutate()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
