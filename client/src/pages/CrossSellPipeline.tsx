import { useState, useMemo, useEffect, useRef } from "react";
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
  Send,
  User,
  Briefcase,
  Clock,
  Sparkles,
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
  "descartado",
] as const;

type Etapa = (typeof ETAPAS)[number];

// Etapa terminal — não aparece em filtros/accordion (cards em ganho saem do pipeline),
// mas aparece no dropdown da row para registrar negócio fechado via GanhoDialog.
const ETAPAS_DROPDOWN = [...ETAPAS, "ganho"] as const;
type EtapaDropdown = (typeof ETAPAS_DROPDOWN)[number];

const ETAPA_LABELS: Record<EtapaDropdown, string> = {
  sugerido_sistema: "Sugerido",
  fazer_contato: "Fazer Contato",
  tentativa_contato: "Tentativa de Contato",
  reuniao_agendada: "Reuniao Agendada",
  em_contato: "Em Contato",
  proposta_enviada: "Proposta Enviada",
  forte_interesse: "Forte Interesse",
  descartado: "Descartado",
  ganho: "Ganho",
};

const ETAPA_COLORS: Record<EtapaDropdown, string> = {
  sugerido_sistema: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  fazer_contato: "bg-gray-200 text-gray-800 dark:bg-zinc-700 dark:text-zinc-200",
  tentativa_contato: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  reuniao_agendada: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  em_contato: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  proposta_enviada: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  forte_interesse: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  descartado: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  ganho: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
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
      (e) => e !== "sugerido_sistema" && e !== "descartado" && (grupos.get(e)?.length ?? 0) > 0
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

      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-2 mb-4 pl-6">
          {sorted.map(({ cliente, oportunidades }) => (
            <ClienteCard
              key={`${etapa}-${cliente.cnpj}`}
              cliente={cliente}
              oportunidadesFiltradas={oportunidades}
              onChangeEtapa={onChangeEtapa}
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
// ClienteCard
// ---------------------------------------------------------------------------

function ClienteCard({
  cliente,
  oportunidadesFiltradas,
  onChangeEtapa,
  onGanho,
  onComments,
}: {
  cliente: ClienteCrossSell;
  oportunidadesFiltradas?: Oportunidade[];
  onChangeEtapa: (opId: number, etapa: string) => void;
  onGanho: (op: Oportunidade) => void;
  onComments: (op: Oportunidade) => void;
}) {
  const oportunidadesVisiveis = oportunidadesFiltradas ?? cliente.oportunidades;
  return (
    <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white truncate">
            {cliente.nome ?? cliente.cnpj}
          </h3>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400 mt-1 flex-wrap">
            <span>{cliente.cluster ?? "—"}</span>
            <span>·</span>
            <span>{cliente.status ?? "—"}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {calcLifetime(cliente.contratoInicio)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-zinc-300 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3 text-gray-400 dark:text-zinc-500" />
              <span className="text-gray-400 dark:text-zinc-500">CxCs:</span>
              <span className="font-medium">{cliente.cxConta ?? "—"}</span>
            </span>
            <span className="flex items-center gap-1">
              <Briefcase className="h-3 w-3 text-gray-400 dark:text-zinc-500" />
              <span className="text-gray-400 dark:text-zinc-500">Vendedor:</span>
              <span className="font-medium">{cliente.vendedor ?? "—"}</span>
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-zinc-300 mt-1.5 font-medium">
            <span>R: {formatCurrency(cliente.valorRAtual)}</span>
            <span className="text-gray-400 dark:text-zinc-600">·</span>
            <span>P: {formatCurrency(cliente.valorPAtual)}</span>
          </div>
        </div>

        {/* Serviços ativos */}
        {cliente.servicosAtivos.length > 0 && (
          <div className="border-t border-gray-100 dark:border-zinc-800 pt-2">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-zinc-500 mb-1.5">
              Serviços ativos
            </p>
            <div className="flex flex-wrap gap-1">
              {cliente.servicosAtivos.map((s) => (
                <span
                  key={s}
                  className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-zinc-800 text-[11px] text-gray-700 dark:text-zinc-300"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Oportunidades */}
        <div className="border-t border-gray-100 dark:border-zinc-800 pt-2">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-zinc-500 mb-0.5">
            Oportunidades mapeadas ({oportunidadesVisiveis.length})
          </p>
          <div className="divide-y divide-gray-50 dark:divide-zinc-800/60">
            {oportunidadesVisiveis.map((op) => (
              <OportunidadeRow
                key={op.id}
                op={op}
                onChangeEtapa={(etapa) => onChangeEtapa(op.id, etapa)}
                onGanho={() => onGanho(op)}
                onComments={() => onComments(op)}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// OportunidadeRow
// ---------------------------------------------------------------------------

function OportunidadeRow({
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
  const isSugerido = etapa === "sugerido_sistema";
  const isDescartado = etapa === "descartado";

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
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor}`} />
        <span className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1 min-w-0">
          {op.produto}
        </span>

        <Select
          value={etapa}
          onValueChange={(v) => (v === "ganho" ? onGanho() : onChangeEtapa(v))}
        >
          <SelectTrigger className="h-auto py-0.5 px-2 border-0 w-auto gap-1 text-xs">
            <Badge className={`text-xs ${ETAPA_COLORS[etapa] ?? "bg-gray-200 text-gray-800"}`}>
              {ETAPA_LABELS[etapa] ?? etapa}
            </Badge>
          </SelectTrigger>
          <SelectContent>
            {ETAPAS_DROPDOWN.map((e) => (
              <SelectItem key={e} value={e}>{ETAPA_LABELS[e]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-xs text-gray-600 dark:text-zinc-400 w-14 text-right">
          {formatCurrencyCompact(op.valorRNegociacao)}
        </span>

        <button
          className="text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 flex items-center gap-0.5 text-xs"
          onClick={onComments}
          title="Comentários"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {op.totalComentarios > 0 && <span>{op.totalComentarios}</span>}
        </button>

        {!isDescartado && !isSugerido && (
          <button
            className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
            onClick={onGanho}
            title="Marcar como ganho"
          >
            <Trophy className="h-3.5 w-3.5" />
          </button>
        )}

        {isSugerido && (
          <div className="flex items-center gap-1">
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
  const [operacoes, setOperacoes] = useState<string[]>([]);
  const [produto, setProduto] = useState(op.produto);
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
            Cliente: <strong className="text-gray-900 dark:text-white">{clienteNome}</strong>
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
