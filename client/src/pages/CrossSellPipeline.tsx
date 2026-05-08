import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/utils";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  MessageSquare,
  Trophy,
  Search,
  Send,
  User,
  Briefcase,
  Clock,
  Sparkles,
  Check,
  X,
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
  "sugerido_sistema",
  "fazer_contato",
  "tentativa_contato",
  "reuniao_agendada",
  "em_contato",
  "proposta_enviada",
  "forte_interesse",
  "ganho",
  "descartado",
] as const;

type Etapa = (typeof ETAPAS)[number];

const ETAPA_LABELS: Record<Etapa, string> = {
  sugerido_sistema: "Sugerido",
  fazer_contato: "Fazer Contato",
  tentativa_contato: "Tentativa de Contato",
  reuniao_agendada: "Reuniao Agendada",
  em_contato: "Em Contato",
  proposta_enviada: "Proposta Enviada",
  forte_interesse: "Forte Interesse",
  ganho: "Ganho",
  descartado: "Descartado",
};

const ETAPA_COLORS: Record<Etapa, string> = {
  sugerido_sistema: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  fazer_contato: "bg-gray-200 text-gray-800 dark:bg-zinc-700 dark:text-zinc-200",
  tentativa_contato: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  reuniao_agendada: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  em_contato: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  proposta_enviada: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  forte_interesse: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  ganho: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  descartado: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const CLUSTERS = ["Regulares", "Imperdiveis", "Chaves", "NFNC"];

const OPERACOES = ["Upsell", "CrossSell", "Renovacao", "Upgrade"];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Oportunidade {
  id: number;
  produto: string;
  etapa: string;
  valorRNegociacao: number | null;
  valorPNegociacao: number | null;
  cxResponsavel: string;
  vendedor: string | null;
  ultimoContato: string | null;
  origem: "manual" | "sistema";
  prioridade: "alta" | "media" | "baixa" | null;
  motivo: string | null;
  totalComentarios: number;
  atualizadoEm: string;
}

interface ClienteCrossSell {
  cnpj: string;
  clienteId: string;
  nome: string;
  cluster: string | null;
  status: string | null;
  cxConta: string | null;
  vendedor: string | null;
  valorRAtual: number;
  valorPAtual: number;
  contratoInicio: string | null;
  servicosAtivos: string[];
  scoreMaximo: number;
  oportunidades: Oportunidade[];
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
  oportunidadeId: number;
  autor: string;
  texto: string;
  criadoEm: string;
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

function formatCurrencyCompact(value: number | null | undefined): string {
  if (value == null || value === 0) return "—";
  if (value >= 1000) {
    const k = value / 1000;
    return `R$ ${k.toFixed(k >= 10 ? 0 : 1)}k`;
  }
  return `R$ ${value.toFixed(0)}`;
}

type ClienteEtapaGroup = {
  cliente: ClienteCrossSell;
  oportunidades: Oportunidade[];
};

function groupClientesByEtapa(
  clientes: ClienteCrossSell[]
): Map<Etapa, ClienteEtapaGroup[]> {
  const groups = new Map<Etapa, ClienteEtapaGroup[]>();
  for (const cliente of clientes) {
    const byEtapa = new Map<Etapa, Oportunidade[]>();
    for (const op of cliente.oportunidades) {
      const e = op.etapa as Etapa;
      if (!byEtapa.has(e)) byEtapa.set(e, []);
      byEtapa.get(e)!.push(op);
    }
    for (const [e, ops] of byEtapa) {
      if (!groups.has(e)) groups.set(e, []);
      groups.get(e)!.push({ cliente, oportunidades: ops });
    }
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function CrossSellPipeline() {
  useSetPageInfo("CrossSell Pipeline", "Comercial");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // View tabs
  const [view, setView] = useState<"pipeline" | "ganhos">("pipeline");

  // Filters
  const [cluster, setCluster] = useState("todos");
  const [cxResp, setCxResp] = useState("todos");
  const [etapaFilter, setEtapaFilter] = useState("todas");
  const [produtoFilter, setProdutoFilter] = useState("todos");
  const [ordenacao, setOrdenacao] = useState<"score" | "mrr" | "recente" | "nome">("score");

  // Modals
  const [newOpEtapa, setNewOpEtapa] = useState<Etapa | null>(null);
  const [ganhoCtx, setGanhoCtx] = useState<{ op: Oportunidade; clienteNome: string } | null>(null);
  const [commentCtx, setCommentCtx] = useState<{ op: Oportunidade; clienteNome: string } | null>(null);

  // Accordion expansion
  const [etapasExpandidas, setEtapasExpandidas] = useState<Set<Etapa>>(new Set());
  const initializedExpansion = useRef(false);

  // Build query string for backend filters
  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (cluster !== "todos") p.set("cluster", cluster);
    if (cxResp !== "todos") p.set("cx", cxResp);
    if (etapaFilter !== "todas") p.set("etapa", etapaFilter);
    if (produtoFilter !== "todos") p.set("produto", produtoFilter);
    return p.toString();
  }, [cluster, cxResp, etapaFilter, produtoFilter]);

  // Query
  const { data: clientes = [], isLoading } = useQuery<ClienteCrossSell[]>({
    queryKey: ["/api/comercial/crosssell", queryString],
    queryFn: async () => {
      const url = queryString
        ? `/api/comercial/crosssell?${queryString}`
        : `/api/comercial/crosssell`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Erro ao carregar clientes");
      return res.json();
    },
  });

  // Lista unificada de vendedores (cup_clientes.vendedor ∪ responsavel_geral ∪ responsavel)
  const { data: vendedoresList = [] } = useQuery<string[]>({
    queryKey: ["/api/comercial/crosssell/vendedores"],
    queryFn: async () => {
      const res = await fetch("/api/comercial/crosssell/vendedores");
      if (!res.ok) throw new Error("Erro ao carregar vendedores");
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 min — dado quase estático
  });

  // Derived: list of distinct CX responsáveis (entre todas oportunidades)
  const cxResponsaveis = useMemo(() => {
    const set = new Set<string>();
    for (const c of clientes) {
      for (const op of c.oportunidades) set.add(op.cxResponsavel);
    }
    return Array.from(set).sort();
  }, [clientes]);

  // Group clientes by etapa (each cliente appears in N sections, one per etapa where they have ≥1 op)
  const grupos = useMemo(() => groupClientesByEtapa(clientes), [clientes]);

  // Initialize default expansion: 3 first etapas with cards (excluding sugerido_sistema/descartado)
  useEffect(() => {
    if (initializedExpansion.current || clientes.length === 0) return;
    const etapasComCards = ETAPAS.filter(
      (e) => e !== "sugerido_sistema" && e !== "descartado" && e !== "ganho" && (grupos.get(e)?.length ?? 0) > 0
    );
    setEtapasExpandidas(new Set(etapasComCards.slice(0, 3)));
    initializedExpansion.current = true;
  }, [clientes, grupos]);

  const totalOportunidades = useMemo(
    () => clientes.reduce((s, c) => s + c.oportunidades.length, 0),
    [clientes]
  );
  const totalRNegociacao = useMemo(
    () =>
      clientes.reduce(
        (s, c) =>
          s + c.oportunidades.reduce((s2, op) => s2 + (op.valorRNegociacao ?? 0), 0),
        0
      ),
    [clientes]
  );

  const mapear = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/comercial/crosssell/mapear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Erro ao mapear oportunidades");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/comercial/crosssell"] });
      alert(
        `${data.criadas} oportunidades mapeadas:\n` +
        `Alta: ${data.distribuicao.alta}\n` +
        `Média: ${data.distribuicao.media}\n` +
        `Baixa: ${data.distribuicao.baixa}\n` +
        `${data.ignoradas} ignoradas (já existentes)`
      );
    },
  });

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

  const changeValor = useMutation({
    mutationFn: async ({ id, field, value }: { id: number; field: "valorRNegociacao" | "valorPNegociacao"; value: number }) => {
      const res = await fetch(`/api/comercial/crosssell/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value, alteradoPor: user?.name }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar valor");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comercial/crosssell"] });
    },
  });

  const changeVendedor = useMutation({
    mutationFn: async ({ id, vendedor }: { id: number; vendedor: string | null }) => {
      const res = await fetch(`/api/comercial/crosssell/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendedor, alteradoPor: user?.name }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar vendedor");
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
            <Skeleton key={i} className="h-72 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-zinc-700">
        <button
          onClick={() => setView("pipeline")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            view === "pipeline"
              ? "border-indigo-500 text-indigo-700 dark:text-indigo-300"
              : "border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200"
          }`}
        >
          Pipeline
        </button>
        <button
          onClick={() => setView("ganhos")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            view === "ganhos"
              ? "border-indigo-500 text-indigo-700 dark:text-indigo-300"
              : "border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200"
          }`}
        >
          Ganhos
        </button>
      </div>

      {view === "ganhos" && <GanhosList />}

      {view === "pipeline" && (
      <>
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

        <Select value={ordenacao} onValueChange={(v) => setOrdenacao(v as any)}>
          <SelectTrigger className="w-52 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="score">Maior potencial</SelectItem>
            <SelectItem value="mrr">Maior MRR atual</SelectItem>
            <SelectItem value="recente">Mais recentes</SelectItem>
            <SelectItem value="nome">Alfabético</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button
          variant="outline"
          onClick={() => mapear.mutate()}
          disabled={mapear.isPending}
          className="gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/30"
        >
          <Sparkles className="h-4 w-4" />
          {mapear.isPending ? "Mapeando..." : "Mapear Oportunidades"}
        </Button>

        <Button onClick={() => setNewOpEtapa("fazer_contato")} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Oportunidade
        </Button>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-zinc-400">
        <span>{clientes.length} clientes únicos</span>
        <span>·</span>
        <span>{totalOportunidades} oportunidades</span>
        <span>·</span>
        <span>{formatCurrency(totalRNegociacao)} em negociação</span>
      </div>

      {/* Etapas accordion */}
      <div className="space-y-1">
        {ETAPAS.filter((e) => (grupos.get(e)?.length ?? 0) > 0).map((etapa) => (
          <EtapaSection
            key={etapa}
            etapa={etapa}
            grupos={grupos.get(etapa) ?? []}
            expanded={etapasExpandidas.has(etapa)}
            onToggle={() =>
              setEtapasExpandidas((prev) => {
                const next = new Set(prev);
                if (next.has(etapa)) next.delete(etapa);
                else next.add(etapa);
                return next;
              })
            }
            onNewOpForEtapa={(e) => setNewOpEtapa(e)}
            ordenacao={ordenacao}
            onChangeEtapa={(opId, e) => changeEtapa.mutate({ id: opId, etapa: e })}
            onChangeValor={(opId, field, value) => changeValor.mutate({ id: opId, field, value })}
            onChangeVendedor={(opId, vendedor) => changeVendedor.mutate({ id: opId, vendedor })}
            vendedoresList={vendedoresList}
            onGanho={(op) => {
              const grupo = grupos.get(etapa)?.find((g) => g.oportunidades.some((o) => o.id === op.id));
              if (grupo) setGanhoCtx({ op, clienteNome: grupo.cliente.nome ?? grupo.cliente.cnpj });
            }}
            onComments={(op) => {
              const grupo = grupos.get(etapa)?.find((g) => g.oportunidades.some((o) => o.id === op.id));
              if (grupo) setCommentCtx({ op, clienteNome: grupo.cliente.nome ?? grupo.cliente.cnpj });
            }}
          />
        ))}
        {grupos.size === 0 && (
          <div className="text-center py-16 text-gray-400 dark:text-zinc-500">
            Nenhum cliente encontrado com os filtros selecionados.
          </div>
        )}
      </div>
      </>
      )}

      {/* Modals */}
      {newOpEtapa && (
        <NewOpDialog
          open={!!newOpEtapa}
          etapaInicial={newOpEtapa}
          onClose={() => setNewOpEtapa(null)}
          userName={user?.name ?? ""}
        />
      )}
      {ganhoCtx && (
        <GanhoDialog
          open={!!ganhoCtx}
          op={ganhoCtx.op}
          clienteNome={ganhoCtx.clienteNome}
          onClose={() => setGanhoCtx(null)}
          userName={user?.name ?? ""}
        />
      )}
      {commentCtx && (
        <CommentsSheet
          open={!!commentCtx}
          op={commentCtx.op}
          clienteNome={commentCtx.clienteNome}
          onClose={() => setCommentCtx(null)}
          userName={user?.name ?? ""}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EtapaSection
// ---------------------------------------------------------------------------

function EtapaSection({
  etapa,
  grupos,
  expanded,
  onToggle,
  onNewOpForEtapa,
  ordenacao,
  onChangeEtapa,
  onChangeValor,
  onChangeVendedor,
  vendedoresList,
  onGanho,
  onComments,
}: {
  etapa: Etapa;
  grupos: ClienteEtapaGroup[];
  expanded: boolean;
  onToggle: () => void;
  onNewOpForEtapa: (etapa: Etapa) => void;
  ordenacao: "score" | "mrr" | "recente" | "nome";
  onChangeEtapa: (opId: number, etapa: string) => void;
  onChangeValor: (opId: number, field: "valorRNegociacao" | "valorPNegociacao", value: number) => void;
  onChangeVendedor: (opId: number, vendedor: string | null) => void;
  vendedoresList: string[];
  onGanho: (op: Oportunidade) => void;
  onComments: (op: Oportunidade) => void;
}) {
  const sorted = useMemo(() => {
    const arr = [...grupos];
    switch (ordenacao) {
      case "mrr":
        arr.sort((a, b) => b.cliente.valorRAtual - a.cliente.valorRAtual);
        break;
      case "recente":
        arr.sort((a, b) => {
          const aMax = a.oportunidades.reduce((m, op) => Math.max(m, new Date(op.atualizadoEm).getTime()), 0);
          const bMax = b.oportunidades.reduce((m, op) => Math.max(m, new Date(op.atualizadoEm).getTime()), 0);
          return bMax - aMax;
        });
        break;
      case "nome":
        arr.sort((a, b) => (a.cliente.nome ?? "").localeCompare(b.cliente.nome ?? ""));
        break;
      case "score":
      default:
        arr.sort((a, b) => b.cliente.scoreMaximo - a.cliente.scoreMaximo);
        break;
    }
    return arr;
  }, [grupos, ordenacao]);

  const [clientesExpandidos, setClientesExpandidos] = useState<Set<string>>(new Set());

  return (
    <section>
      <div
        onClick={onToggle}
        className="w-full flex items-center gap-2 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-900/50 rounded px-1"
      >
        <span className={`text-gray-500 dark:text-zinc-400 transition-transform inline-block ${expanded ? "rotate-90" : ""}`}>▸</span>
        <Badge className={`text-xs ${ETAPA_COLORS[etapa] ?? "bg-gray-200 text-gray-800"}`}>
          {ETAPA_LABELS[etapa] ?? etapa}
        </Badge>
        <span className="text-sm text-gray-500 dark:text-zinc-400">{grupos.length}</span>
        <div className="flex-1" />
        <button
          onClick={(e) => { e.stopPropagation(); onNewOpForEtapa(etapa); }}
          className="text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 px-2 py-0.5 text-sm"
          title={`Nova oportunidade em ${ETAPA_LABELS[etapa]}`}
        >
          +
        </button>
      </div>

      {expanded && etapa === "ganho" && (
        <div className="mt-2 mb-4 ml-6">
          <GanhosList embedded />
        </div>
      )}

      {expanded && etapa !== "ganho" && (
        <div className="mt-2 mb-4 ml-6 border border-gray-200 dark:border-zinc-700/60 rounded-md divide-y divide-gray-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
          {sorted.map(({ cliente, oportunidades }) => (
            <ClienteRow
              key={`${etapa}-${cliente.cnpj}`}
              cliente={cliente}
              oportunidadesFiltradas={oportunidades}
              expanded={clientesExpandidos.has(cliente.cnpj)}
              onToggle={() => {
                setClientesExpandidos((prev) => {
                  const next = new Set(prev);
                  if (next.has(cliente.cnpj)) next.delete(cliente.cnpj);
                  else next.add(cliente.cnpj);
                  return next;
                });
              }}
              onChangeEtapa={onChangeEtapa}
              onChangeValor={onChangeValor}
              onChangeVendedor={onChangeVendedor}
              vendedoresList={vendedoresList}
              onGanho={onGanho}
              onComments={onComments}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// ClienteRow — linha compacta (colapsada) que expande in-place revelando
// serviços ativos + oportunidades editáveis
// ---------------------------------------------------------------------------

function ClienteRow({
  cliente,
  oportunidadesFiltradas,
  expanded,
  onToggle,
  onChangeEtapa,
  onChangeValor,
  onChangeVendedor,
  vendedoresList,
  onGanho,
  onComments,
}: {
  cliente: ClienteCrossSell;
  oportunidadesFiltradas?: Oportunidade[];
  expanded: boolean;
  onToggle: () => void;
  onChangeEtapa: (opId: number, etapa: string) => void;
  onChangeValor: (opId: number, field: "valorRNegociacao" | "valorPNegociacao", value: number) => void;
  onChangeVendedor: (opId: number, vendedor: string | null) => void;
  vendedoresList: string[];
  onGanho: (op: Oportunidade) => void;
  onComments: (op: Oportunidade) => void;
}) {
  const oportunidadesVisiveis = oportunidadesFiltradas ?? cliente.oportunidades;
  return (
    <div>
      {/* Linha colapsada — grid de 9 colunas alinhadas para todas as linhas */}
      <div
        onClick={onToggle}
        className="w-full grid items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 text-sm"
        style={{
          gridTemplateColumns:
            "16px minmax(160px, 1.5fr) 80px 110px 56px minmax(140px, 1.2fr) minmax(140px, 1.2fr) 200px 64px",
        }}
      >
        <span
          className={`text-gray-400 dark:text-zinc-500 transition-transform inline-block ${expanded ? "rotate-90" : ""}`}
        >
          ▸
        </span>
        <span className="font-semibold text-gray-900 dark:text-white truncate">
          {cliente.nome ?? cliente.cnpj}
        </span>
        <span className="text-xs text-gray-500 dark:text-zinc-400 truncate">
          {cliente.cluster ?? "—"}
        </span>
        <span className="text-xs text-gray-500 dark:text-zinc-400 truncate">
          {cliente.status ?? "—"}
        </span>
        <span className="text-xs text-gray-500 dark:text-zinc-400 flex items-center gap-1 whitespace-nowrap">
          <Clock className="h-3 w-3 shrink-0" />
          <span className="truncate">{calcLifetime(cliente.contratoInicio)}</span>
        </span>
        <span className="text-xs text-gray-500 dark:text-zinc-400 flex items-center gap-1 min-w-0">
          <User className="h-3 w-3 text-gray-400 dark:text-zinc-500 shrink-0" />
          <span className="text-gray-400 dark:text-zinc-500 shrink-0">CxCs:</span>
          <span className="text-gray-700 dark:text-zinc-300 font-medium truncate">{cliente.cxConta ?? "—"}</span>
        </span>
        <span className="text-xs text-gray-500 dark:text-zinc-400 flex items-center gap-1 min-w-0">
          <Briefcase className="h-3 w-3 text-gray-400 dark:text-zinc-500 shrink-0" />
          <span className="text-gray-400 dark:text-zinc-500 shrink-0">Vendedor:</span>
          <span className="text-gray-700 dark:text-zinc-300 font-medium truncate">{cliente.vendedor ?? "—"}</span>
        </span>
        <span className="text-xs text-gray-600 dark:text-zinc-300 font-medium whitespace-nowrap text-right">
          R {formatCurrency(cliente.valorRAtual)} · P {formatCurrency(cliente.valorPAtual)}
        </span>
        <span className="text-xs text-gray-500 dark:text-zinc-400 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-zinc-800 whitespace-nowrap text-center justify-self-end">
          {oportunidadesVisiveis.length} op
        </span>
      </div>

      {/* Conteúdo expandido — side-by-side: serviços (esquerda fixa) + oportunidades (resto) */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 bg-gray-50/40 dark:bg-zinc-900/40">
          <div className="grid gap-6" style={{ gridTemplateColumns: "minmax(180px, 240px) 1fr" }}>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-zinc-500 mb-1.5">
                Serviços ativos
              </p>
              {cliente.servicosAtivos.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {cliente.servicosAtivos.map((s) => (
                    <span
                      key={s}
                      className="px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-[11px] text-gray-700 dark:text-zinc-300"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 dark:text-zinc-600 italic">Nenhum serviço ativo</p>
              )}
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-zinc-500 mb-0.5">
                Oportunidades mapeadas ({oportunidadesVisiveis.length})
              </p>
              <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                {oportunidadesVisiveis.map((op) => (
                  <OportunidadeRow
                    key={op.id}
                    op={op}
                    onChangeEtapa={(etapa) => onChangeEtapa(op.id, etapa)}
                    onChangeValor={(field, value) => onChangeValor(op.id, field, value)}
                    onChangeVendedor={(vendedor) => onChangeVendedor(op.id, vendedor)}
                    vendedoresList={vendedoresList}
                    onGanho={() => onGanho(op)}
                    onComments={() => onComments(op)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// InlineValorInput — input numerico inline (somente leitura quando nao editavel)
// ---------------------------------------------------------------------------

function InlineValorInput({
  label,
  value,
  editable,
  onSave,
}: {
  label: string;
  value: number | null;
  editable: boolean;
  onSave: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string>(value != null ? String(value) : "");

  useEffect(() => {
    setDraft(value != null ? String(value) : "");
  }, [value]);

  if (!editable) {
    return (
      <span className="text-xs text-gray-500 dark:text-zinc-500 whitespace-nowrap">
        <span className="text-gray-400 dark:text-zinc-600">{label}:</span>{" "}
        {formatCurrencyCompact(value)}
      </span>
    );
  }

  const commit = () => {
    const cleaned = draft.replace(/\./g, "").replace(",", ".").trim();
    const parsed = cleaned === "" ? 0 : Number(cleaned);
    if (!Number.isFinite(parsed)) {
      setDraft(value != null ? String(value) : "");
      return;
    }
    if (parsed === (value ?? 0)) return;
    onSave(parsed);
  };

  return (
    <span className="flex items-center gap-1 text-xs text-gray-600 dark:text-zinc-400 whitespace-nowrap">
      <span className="text-gray-400 dark:text-zinc-500">{label}:</span>
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(value != null ? String(value) : "");
            (e.target as HTMLInputElement).blur();
          }
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-16 px-1 py-0.5 bg-transparent border border-transparent hover:border-gray-300 dark:hover:border-zinc-600 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 rounded text-xs text-left outline-none"
        placeholder="0"
      />
    </span>
  );
}

// ---------------------------------------------------------------------------
// VendedorCombobox — combobox pesquisável para selecionar vendedor da
// oportunidade. Lista vinda da união de cup_clientes (vendedor, responsavel_geral,
// responsavel). Aceita null (mostra "—").
// ---------------------------------------------------------------------------

function VendedorCombobox({
  value,
  options,
  onChange,
}: {
  value: string | null;
  options: string[];
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          aria-label="Selecionar vendedor"
          className="flex items-center gap-1 text-xs text-left w-full max-w-[130px] px-1 py-0.5 rounded border border-transparent hover:border-gray-300 dark:hover:border-zinc-600 hover:bg-white dark:hover:bg-zinc-800 transition-colors"
          title={value ?? "Selecionar vendedor"}
        >
          <span
            className={`truncate ${
              value
                ? "text-gray-700 dark:text-zinc-300"
                : "text-gray-400 dark:text-zinc-600"
            }`}
          >
            {value ?? "—"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-64 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700"
        align="start"
      >
        <Command className="bg-transparent">
          <CommandInput placeholder="Buscar vendedor..." className="h-9" />
          <CommandList>
            <CommandEmpty>Nenhum vendedor encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__limpar__"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="text-gray-500 dark:text-zinc-400"
              >
                <X className="mr-2 h-3.5 w-3.5" />
                Limpar
              </CommandItem>
              {options.map((nome) => (
                <CommandItem
                  key={nome}
                  value={nome}
                  onSelect={() => {
                    onChange(nome === value ? null : nome);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`mr-2 h-3.5 w-3.5 ${
                      value === nome ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  {nome}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// OportunidadeRow
// ---------------------------------------------------------------------------

function OportunidadeRow({
  op,
  onChangeEtapa,
  onChangeValor,
  onChangeVendedor,
  vendedoresList,
  onGanho,
  onComments,
}: {
  op: Oportunidade;
  onChangeEtapa: (etapa: string) => void;
  onChangeValor: (field: "valorRNegociacao" | "valorPNegociacao", value: number) => void;
  onChangeVendedor: (vendedor: string | null) => void;
  vendedoresList: string[];
  onGanho: () => void;
  onComments: () => void;
}) {
  const etapa = op.etapa as Etapa;
  const isSugerido = etapa === "sugerido_sistema";
  const isDescartado = etapa === "descartado";
  const valoresEditaveis = !isSugerido && !isDescartado;

  // Cor da bolinha: prioridade (se sistema) ou neutra (manual)
  const dotColor = isSugerido && op.prioridade
    ? op.prioridade === "alta"
      ? "bg-green-500"
      : op.prioridade === "media"
        ? "bg-yellow-500"
        : "bg-gray-400"
    : "bg-blue-400";

  return (
    <div className={`flex flex-col gap-1 py-2 ${isDescartado ? "opacity-50" : ""}`}>
      <div
        className="grid items-center gap-2"
        style={{
          gridTemplateColumns:
            "16px 200px 130px 130px 90px 90px 32px 56px",
        }}
      >
        <span className={`h-2 w-2 rounded-full ${dotColor}`} />
        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {op.produto}
        </span>

        <VendedorCombobox
          value={op.vendedor}
          options={vendedoresList}
          onChange={onChangeVendedor}
        />

        <Select
          value={etapa}
          onValueChange={(v) => (v === "ganho" ? onGanho() : onChangeEtapa(v))}
        >
          <SelectTrigger className="h-auto py-0.5 px-2 border-0 w-auto gap-1 text-xs justify-self-start">
            <Badge className={`text-xs ${ETAPA_COLORS[etapa] ?? "bg-gray-200 text-gray-800"}`}>
              {ETAPA_LABELS[etapa] ?? etapa}
            </Badge>
          </SelectTrigger>
          <SelectContent>
            {ETAPAS.map((e) => (
              <SelectItem key={e} value={e}>{ETAPA_LABELS[e]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <InlineValorInput
          label="R"
          value={op.valorRNegociacao}
          editable={valoresEditaveis}
          onSave={(v) => onChangeValor("valorRNegociacao", v)}
        />
        <InlineValorInput
          label="P"
          value={op.valorPNegociacao}
          editable={valoresEditaveis}
          onSave={(v) => onChangeValor("valorPNegociacao", v)}
        />

        <button
          className="text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 flex items-center gap-0.5 text-xs justify-self-center"
          onClick={onComments}
          title="Comentários"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {op.totalComentarios > 0 && <span>{op.totalComentarios}</span>}
        </button>

        {!isDescartado && !isSugerido && (
          <button
            className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 justify-self-center"
            onClick={onGanho}
            title="Marcar como ganho"
          >
            <Trophy className="h-3.5 w-3.5" />
          </button>
        )}

        {isSugerido && (
          <div className="flex items-center gap-1 justify-self-center">
            <button
              className="text-green-600 hover:text-green-700 dark:text-green-400 text-xs px-1.5 py-0.5 rounded hover:bg-green-50 dark:hover:bg-green-900/30"
              onClick={() => onChangeEtapa("fazer_contato")}
              title="Aceitar sugestão"
            >
              ✓
            </button>
            <button
              className="text-red-500 hover:text-red-600 dark:text-red-400 text-xs px-1.5 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30"
              onClick={() => onChangeEtapa("descartado")}
              title="Descartar sugestão"
            >
              ✗
            </button>
          </div>
        )}

        {isDescartado && <span />}
      </div>

      {isSugerido && op.motivo && (
        <p className="text-[11px] text-gray-500 dark:text-zinc-500 pl-4 truncate">
          {op.motivo}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// New Oportunidade Dialog
// ---------------------------------------------------------------------------

function NewOpDialog({
  open,
  etapaInicial,
  onClose,
  userName,
}: {
  open: boolean;
  etapaInicial?: Etapa;
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
          etapa: etapaInicial,
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
          {etapaInicial && etapaInicial !== "fazer_contato" && (
            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
              Será criada em: <strong className="text-gray-900 dark:text-white">{ETAPA_LABELS[etapaInicial]}</strong>
            </p>
          )}
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
  clienteNome,
  onClose,
  userName,
}: {
  open: boolean;
  op: Oportunidade;
  clienteNome: string;
  onClose: () => void;
  userName: string;
}) {
  const queryClient = useQueryClient();
  const [mesGanho, setMesGanho] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [valorR, setValorR] = useState(
    op.valorRNegociacao?.toString() ?? ""
  );
  const [valorP, setValorP] = useState(
    op.valorPNegociacao?.toString() ?? ""
  );

  const ganhoMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/comercial/crosssell/${op.id}/ganho`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
          <div className="text-sm text-gray-600 dark:text-zinc-400 space-y-0.5">
            <p>
              Cliente: <strong className="text-gray-900 dark:text-white">{clienteNome}</strong>
            </p>
            <p>
              Produto: <strong className="text-gray-900 dark:text-white">{op.produto}</strong>
            </p>
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
            disabled={!mesGanho || ganhoMut.isPending}
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
  clienteNome,
  onClose,
  userName,
}: {
  open: boolean;
  op: Oportunidade;
  clienteNome: string;
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
            Comentários — {clienteNome}
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
                  {new Date(c.criadoEm).toLocaleString("pt-BR")}
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

// ---------------------------------------------------------------------------
// GanhosList — visualizacao em tabela dos negocios ganhos
// ---------------------------------------------------------------------------

interface Ganho {
  id: number;
  oportunidadeId: number;
  clienteNome: string;
  cnpj: string;
  valorR: number | null;
  valorP: number | null;
  cxResponsavel: string | null;
  vendedor: string | null;
  operacao: string[];
  produto: string;
  mesGanho: string;
  criadoEm: string;
}

const MESES_LABEL = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function formatMesGanho(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return `${MESES_LABEL[dt.getMonth()]}/${dt.getFullYear()}`;
}

const GANHOS_GRID_TEMPLATE =
  "minmax(180px, 2fr) 110px 110px minmax(140px, 1.2fr) minmax(140px, 1.2fr) 120px minmax(140px, 1.2fr) 100px";

function GanhosList({ embedded = false }: { embedded?: boolean }) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const [ano, setAno] = useState<string>(embedded ? "todos" : String(currentYear));
  const [mes, setMes] = useState<string>("todos");
  const [operacoesFilter, setOperacoesFilter] = useState<string[]>([]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (ano !== "todos") p.set("ano", ano);
    if (mes !== "todos") p.set("mes", mes);
    if (operacoesFilter.length > 0) p.set("operacao", operacoesFilter.join(","));
    return p.toString();
  }, [ano, mes, operacoesFilter]);

  const { data: ganhos = [], isLoading } = useQuery<Ganho[]>({
    queryKey: ["/api/comercial/crosssell/ganhos", queryString],
    queryFn: async () => {
      const url = queryString
        ? `/api/comercial/crosssell/ganhos?${queryString}`
        : `/api/comercial/crosssell/ganhos`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Erro ao carregar ganhos");
      return res.json();
    },
  });

  const totalR = ganhos.reduce((s, g) => s + (g.valorR ?? 0), 0);
  const totalP = ganhos.reduce((s, g) => s + (g.valorP ?? 0), 0);

  const toggleOperacao = (op: string) => {
    setOperacoesFilter((prev) =>
      prev.includes(op) ? prev.filter((x) => x !== op) : [...prev, op]
    );
  };

  return (
    <div className="space-y-4">
      {!embedded && (
      <>
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={ano} onValueChange={setAno}>
          <SelectTrigger className="w-32 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos anos</SelectItem>
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-32 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos meses</SelectItem>
            {MESES_LABEL.map((m, i) => (
              <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-gray-400 dark:text-zinc-500 mr-1">Operação:</span>
          {OPERACOES.map((op) => {
            const active = operacoesFilter.includes(op);
            return (
              <button
                key={op}
                onClick={() => toggleOperacao(op)}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  active
                    ? "bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700 dark:hover:bg-zinc-800"
                }`}
              >
                {op}
              </button>
            );
          })}
          {operacoesFilter.length > 0 && (
            <button
              onClick={() => setOperacoesFilter([])}
              className="ml-1 text-xs text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-200"
            >
              limpar
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-zinc-400">
        <span>{ganhos.length} ganhos</span>
        <span>·</span>
        <span>R total: {formatCurrency(totalR)}</span>
        <span>·</span>
        <span>P total: {formatCurrency(totalP)}</span>
      </div>
      </>
      )}

      {/* Tabela */}
      <div className="border border-gray-200 dark:border-zinc-700/60 rounded-md overflow-x-auto">
        {/* Header */}
        <div
          className="grid items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-zinc-900/80 text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-400 border-b border-gray-200 dark:border-zinc-700/60"
          style={{ gridTemplateColumns: GANHOS_GRID_TEMPLATE }}
        >
          <span>Cliente</span>
          <span className="text-right">Valor R</span>
          <span className="text-right">Valor P</span>
          <span>CX</span>
          <span>Vendedor</span>
          <span>Operação</span>
          <span>Produto</span>
          <span>Mês ganho</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-gray-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
          {isLoading && (
            <div className="px-3 py-8 text-center text-gray-400 dark:text-zinc-500">
              Carregando...
            </div>
          )}
          {!isLoading && ganhos.length === 0 && (
            <div className="px-3 py-8 text-center text-gray-400 dark:text-zinc-500">
              Nenhum ganho registrado para os filtros selecionados.
            </div>
          )}
          {ganhos.map((g) => (
            <div
              key={g.id}
              className="grid items-center gap-3 px-3 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800/50"
              style={{ gridTemplateColumns: GANHOS_GRID_TEMPLATE }}
            >
              <span className="font-medium text-gray-900 dark:text-white truncate">{g.clienteNome}</span>
              <span className="text-right text-gray-700 dark:text-zinc-300 whitespace-nowrap">
                {formatCurrency(g.valorR ?? 0)}
              </span>
              <span className="text-right text-gray-700 dark:text-zinc-300 whitespace-nowrap">
                {formatCurrency(g.valorP ?? 0)}
              </span>
              <span className="text-gray-700 dark:text-zinc-300 truncate">{g.cxResponsavel ?? "—"}</span>
              <span className="text-gray-700 dark:text-zinc-300 truncate">{g.vendedor ?? "—"}</span>
              <span className="flex flex-wrap gap-1">
                {(g.operacao ?? []).map((op) => (
                  <Badge
                    key={op}
                    className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                  >
                    {op}
                  </Badge>
                ))}
              </span>
              <span className="text-gray-700 dark:text-zinc-300 truncate">{g.produto}</span>
              <span className="text-gray-700 dark:text-zinc-300 whitespace-nowrap">{formatMesGanho(g.mesGanho)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
