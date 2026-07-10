import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Target, Calendar, Facebook, Search as SearchIcon, Loader2, ChevronRight, ChevronDown, Linkedin, Music2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const ALLOWED_EDITOR_EMAILS = new Set([
  "ferramentas@turbopartners.com.br",
  "vinicius.ichino@turbopartners.com.br",
  "warleyreserva4@gmail.com",
]);

// Plataformas suportadas. Manter em sincronia com PLATFORMS no backend.
// Adicionar um canal = incluir em PLATFORM_ORDER + LABELS + STYLES + PlatformIcon.
type Platform = "meta" | "google" | "tiktok" | "linkedin";

const PLATFORM_LABELS: Record<Platform, string> = {
  meta: "Meta",
  google: "Google",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
};
// Ordem de exibição das plataformas dentro de cada produto.
const PLATFORM_ORDER: Platform[] = ["meta", "google", "tiktok", "linkedin"];
// Cor de FUNDO (leve) aplicada às linhas da plataforma + cor do ícone.
const PLATFORM_STYLES: Record<Platform, { row: string; icon: string }> = {
  meta: { row: "bg-blue-500/5 dark:bg-blue-400/[0.07]", icon: "text-blue-600 dark:text-blue-400" },
  google: { row: "bg-amber-500/5 dark:bg-amber-400/[0.07]", icon: "text-amber-600 dark:text-amber-400" },
  tiktok: { row: "bg-rose-500/5 dark:bg-rose-400/[0.07]", icon: "text-rose-500 dark:text-rose-400" },
  linkedin: { row: "bg-cyan-500/5 dark:bg-cyan-400/[0.07]", icon: "text-cyan-600 dark:text-cyan-400" },
};

// Tags/grupos (pools). Manter em sincronia com CAMPAIGN_TAGS no backend.
type CampaignTag = "inbound" | "evento" | "creators_summit";
const TAG_OPTIONS: { value: CampaignTag; label: string }[] = [
  { value: "inbound", label: "Inbound" },
  { value: "evento", label: "Evento" },
  { value: "creators_summit", label: "Creators Summit" },
];
const TAG_LABELS: Record<CampaignTag, string> = { inbound: "Inbound", evento: "Evento", creators_summit: "Creators Summit" };
const POOLS: CampaignTag[] = ["inbound", "evento", "creators_summit"];
const NO_TAG = "__none__"; // sentinela p/ "Sem tag" no Select (Radix não aceita value vazio)

// Produtos. Manter em sincronia com CAMPAIGN_PRODUCTS no backend. Nível raiz
// de planejamento (o pai é o total do pool); o Canal pendura embaixo.
type CampaignProduct = "creators" | "turbo" | "comunidade" | "crm" | "summit";
const PRODUCT_OPTIONS: { value: CampaignProduct; label: string }[] = [
  { value: "creators", label: "Creators" },
  { value: "turbo", label: "Turbo" },
  { value: "comunidade", label: "Comunidade" },
  { value: "crm", label: "CRM" },
  { value: "summit", label: "Summit" },
];
const PRODUCT_LABELS: Record<CampaignProduct, string> = {
  creators: "Creators",
  turbo: "Turbo",
  comunidade: "Comunidade",
  crm: "CRM",
  summit: "Summit",
};
const PRODUCT_ORDER: CampaignProduct[] = PRODUCT_OPTIONS.map((o) => o.value);
const NO_PRODUCT = "__none__";

// Níveis plantáveis na árvore de metas (budget_plan_node). Manter em
// sincronia com LEVEL_TYPES no backend.
type LevelType = "product" | "platform";

// Abas de filtro no topo. "sem-tag" lista campanhas ainda não classificadas.
type TabValue = "todas" | CampaignTag | "sem-tag";
const TABS: { value: TabValue; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "inbound", label: "Inbound" },
  { value: "evento", label: "Evento" },
  { value: "creators_summit", label: "Creators Summit" },
  { value: "sem-tag", label: "Sem tag" },
];

type PlanUnit = "pct" | "brl";

// Plano de um pool no mês: só o total (a árvore de metas por nível vem em
// `planNodes` — ver PlanNode abaixo).
interface PoolPlan {
  total: number | null;
}

// Um nó da árvore de metas (product/platform) dentro de um pool/mês.
// parentKey = "" na raiz (pai é o total do pool); senão "type:key|type:key...".
interface PlanNode {
  pool: CampaignTag;
  levelType: LevelType;
  levelKey: string;
  parentKey: string;
  value: number;
  unit: PlanUnit;
}

// Meta travada por campanha individual (qualquer plataforma).
interface CampaignTargetRow {
  pool: CampaignTag;
  platform: Platform;
  campaignId: string;
  value: number;
  unit: PlanUnit;
}

interface Campanha {
  platform: Platform;
  campaignId: string;
  name: string;
  status: string | null;
  isActive: boolean;
  dailyBudgetAtual: number;
  investidoTotal: number;
  projecaoAsIs: number;
  isDelivering: boolean;
  tag: CampaignTag | null;
  produto: CampaignProduct | null;
}

interface ApiResponse {
  month: string;
  firstDay: string;
  lastDay: string;
  diasTotal: number;
  diasDecorridos: number;
  diasRestantes: number;
  campanhas: Campanha[];
  plans: Record<string, PoolPlan>;
  planNodes: PlanNode[];
  campaignTargets: CampaignTargetRow[];
}

function getMonthOptions(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = -6; i <= 1; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    opts.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return opts.reverse();
}

function parseNumberInput(raw: string): number {
  const cleaned = raw.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// Caminho canônico de um nó da árvore de metas (mesma codificação de
// parent_key no banco): "" na raiz, senão "type:key" encadeado por "|".
function nodePath(parentKey: string, levelType: LevelType, levelKey: string): string {
  return parentKey ? `${parentKey}|${levelType}:${levelKey}` : `${levelType}:${levelKey}`;
}

// Alvo R$ de um nó: valor travado (brl) ou % do pai imediato (pct).
function resolveNode(node: PlanNode | undefined, resolvedParentBrl: number | null): number | null {
  if (!node) return null;
  if (node.unit === "brl") return node.value;
  if (resolvedParentBrl == null) return null;
  return (node.value / 100) * resolvedParentBrl;
}

// Resolve a árvore inteira de um pool numa passada top-down única: raiz =
// total do pool, cada nível seguinte resolve contra o valor já resolvido do
// pai (não sempre o total do pool, uma vez que agora há mais de 2 níveis).
function resolvePlanTree(nodes: PlanNode[], poolTotal: number | null): Map<string, number | null> {
  const byPath = new Map<string, PlanNode>();
  for (const n of nodes) byPath.set(nodePath(n.parentKey, n.levelType, n.levelKey), n);
  const resolved = new Map<string, number | null>();
  // Guarda contra ciclo em parent_key (não deveria acontecer — a API valida
  // o path do pai — mas dado legado/editado direto no banco não tem essa
  // garantia; sem isso um ciclo trava o browser em recursão infinita).
  const visiting = new Set<string>();
  const resolveOne = (path: string, node: PlanNode): number | null => {
    if (resolved.has(path)) return resolved.get(path)!;
    if (visiting.has(path)) return null;
    visiting.add(path);
    let val: number | null;
    if (node.unit === "brl") {
      val = node.value;
    } else {
      const parentResolved = node.parentKey === ""
        ? poolTotal
        : (() => {
            const parentNode = byPath.get(node.parentKey);
            return parentNode ? resolveOne(node.parentKey, parentNode) : null;
          })();
      val = parentResolved != null ? (node.value / 100) * parentResolved : null;
    }
    visiting.delete(path);
    resolved.set(path, val);
    return val;
  };
  byPath.forEach((node, path) => resolveOne(path, node));
  return resolved;
}

// Soma dos valores resolvidos dos filhos diretos de `ownPath` dentre `nodes`
// (usado pro indicador "fecha 100%" de Produto). null se nenhum filho
// tem alvo definido.
function directChildrenSum(nodes: { parentKey: string; levelType: LevelType; levelKey: string }[], resolved: Map<string, number | null>, ownPath: string): number | null {
  let sum = 0;
  let any = false;
  for (const n of nodes) {
    if (n.parentKey !== ownPath) continue;
    const v = resolved.get(nodePath(n.parentKey, n.levelType, n.levelKey));
    if (v != null) { sum += v; any = true; }
  }
  return any ? sum : null;
}

// Ritmo diário necessário p/ bater o alvo e o gap vs o orçamento diário atual.
// gap > 0: está abaixo do ritmo (precisa subir). gap < 0: vai estourar (pode baixar).
function pacing(target: number | null, investido: number, currentDaily: number, diasRestantes: number):
  { required: number; gap: number } | null {
  if (target == null || target <= 0 || diasRestantes <= 0) return null;
  const required = Math.max(0, (target - investido) / diasRestantes);
  return { required, gap: required - currentDaily };
}

function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  const cls = cn("w-4 h-4", className);
  switch (platform) {
    case "meta": return <Facebook className={cls} />;
    case "google": return <SearchIcon className={cls} />;
    case "tiktok": return <Music2 className={cls} />;
    case "linkedin": return <Linkedin className={cls} />;
    default: return <SearchIcon className={cls} />;
  }
}

// Investido vs alvo: verde abaixo de 80%, amarelo 80-100%, vermelho >=100%.
function variancePctColor(investido: number, meta: number | null): string {
  if (meta === null || meta === 0) return "";
  const pct = (investido / meta) * 100;
  if (pct >= 100) return "text-red-500 dark:text-red-400";
  if (pct >= 80) return "text-yellow-500 dark:text-yellow-400";
  return "text-green-600 dark:text-green-400";
}

// Projeção vs alvo: vermelho se vai estourar (>105%), amarelo 100-105%, verde dentro.
function projecaoColor(projecao: number, meta: number | null): string {
  if (meta === null || meta === 0) return "";
  const pct = (projecao / meta) * 100;
  if (pct > 105) return "text-red-500 dark:text-red-400";
  if (pct > 100) return "text-yellow-500 dark:text-yellow-400";
  return "text-green-600 dark:text-green-400";
}

// ---- Select de pool (grupo) por campanha ----
function TagSelect({ platform, campaignId, value, onSaved, canEdit }: {
  platform: Platform; campaignId: string; value: CampaignTag | null; onSaved: () => void; canEdit: boolean;
}) {
  const { toast } = useToast();
  if (!canEdit) {
    return value
      ? <Badge variant="secondary" className="text-xs">{TAG_LABELS[value]}</Badge>
      : <span className="text-muted-foreground text-xs">—</span>;
  }
  const handleChange = async (next: string) => {
    const tag = next === NO_TAG ? null : next;
    try {
      await apiRequest("PUT", "/api/growth/orcamento-campanhas/tag", { platform, campaignId, tag });
      onSaved();
    } catch (err) {
      toast({ title: "Erro ao salvar grupo", description: String(err), variant: "destructive" });
    }
  };
  return (
    <Select value={value ?? NO_TAG} onValueChange={handleChange}>
      <SelectTrigger className="h-7 w-[120px] text-xs" data-testid={`select-tag-${platform}-${campaignId}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_TAG}><span className="text-muted-foreground">Sem grupo</span></SelectItem>
        {TAG_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

// ---- Select de produto por campanha ----
function ProdutoSelect({ platform, campaignId, value, onSaved, canEdit }: {
  platform: Platform; campaignId: string; value: CampaignProduct | null; onSaved: () => void; canEdit: boolean;
}) {
  const { toast } = useToast();
  if (!canEdit) {
    return value
      ? <Badge variant="outline" className="text-xs">{PRODUCT_LABELS[value]}</Badge>
      : <span className="text-muted-foreground text-xs">—</span>;
  }
  const handleChange = async (next: string) => {
    const produto = next === NO_PRODUCT ? null : next;
    try {
      await apiRequest("PUT", "/api/growth/orcamento-campanhas/produto", { platform, campaignId, produto });
      onSaved();
    } catch (err) {
      toast({ title: "Erro ao salvar produto", description: String(err), variant: "destructive" });
    }
  };
  return (
    <Select value={value ?? NO_PRODUCT} onValueChange={handleChange}>
      <SelectTrigger className="h-7 w-[150px] text-xs" data-testid={`select-produto-${platform}-${campaignId}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_PRODUCT}><span className="text-muted-foreground">Sem produto</span></SelectItem>
        {PRODUCT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

// ---- Editor do total mensal do pool ----
function PoolTotalInput({ pool, month, value, onSaved, canEdit }: {
  pool: CampaignTag; month: string; value: number | null; onSaved: () => void; canEdit: boolean;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [editing]);

  const save = async () => {
    const parsed = parseNumberInput(draft);
    setEditing(false);
    if (parsed === (value ?? 0)) return;
    try {
      await apiRequest("PUT", "/api/growth/orcamento-campanhas/plan/total", { pool, month, total: parsed });
      onSaved();
    } catch (err) {
      toast({ title: "Erro ao salvar total", description: String(err), variant: "destructive" });
    }
  };

  if (editing) {
    return (
      <Input
        ref={inputRef} type="text" inputMode="decimal"
        defaultValue={value !== null ? String(value) : ""}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setDraft(""); setEditing(false); }
        }}
        className="h-8 w-[140px] text-right font-mono" placeholder="0,00"
      />
    );
  }
  if (!canEdit) {
    return <span className="font-mono font-semibold">{value !== null ? formatCurrency(value) : "—"}</span>;
  }
  return (
    <button
      type="button"
      onClick={() => { setDraft(value !== null ? String(value) : ""); setEditing(true); }}
      className="font-mono font-semibold hover:bg-accent hover:text-accent-foreground rounded px-2 py-1 cursor-pointer transition-colors"
      data-testid={`input-pool-total-${pool}`}
    >
      {value !== null ? formatCurrency(value) : <span className="text-muted-foreground italic">definir total</span>}
    </button>
  );
}

// ---- Editor do alvo de um nó da árvore (híbrido % / R$) — Produto/Canal ----
function LevelTargetInput({ pool, month, levelType, levelKey, parentKey, plan, resolvedParentBrl, onSaved, canEdit }: {
  pool: CampaignTag; month: string; levelType: LevelType; levelKey: string; parentKey: string;
  plan: PlanNode | undefined; resolvedParentBrl: number | null; onSaved: () => void; canEdit: boolean;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [unit, setUnit] = useState<PlanUnit>(plan?.unit ?? "pct");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [editing]);

  const derived = resolveNode(plan, resolvedParentBrl);

  const save = async (overrideUnit?: PlanUnit) => {
    const u = overrideUnit ?? unit;
    const parsed = parseNumberInput(draft);
    setEditing(false);
    try {
      await apiRequest("PUT", "/api/growth/orcamento-campanhas/plan/node", {
        pool, month, levelType, levelKey, parentKey, value: parsed, unit: u,
      });
      onSaved();
    } catch (err) {
      toast({ title: "Erro ao salvar alvo", description: String(err), variant: "destructive" });
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 justify-end">
        <Input
          ref={inputRef} type="text" inputMode="decimal"
          defaultValue={plan ? String(plan.value) : ""}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => save()}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") { setDraft(""); setEditing(false); }
          }}
          className="h-8 w-[90px] text-right font-mono" placeholder="0"
        />
        <div className="flex rounded border overflow-hidden">
          {(["pct", "brl"] as PlanUnit[]).map((u) => (
            <button
              key={u} type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setUnit(u)}
              className={cn("px-1.5 py-1 text-xs", unit === u ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent")}
            >
              {u === "pct" ? "%" : "R$"}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const display = !plan ? (
    <span className="text-muted-foreground italic">definir</span>
  ) : plan.unit === "pct" ? (
    <span>{plan.value}%{derived != null && <span className="text-muted-foreground"> · {formatCurrency(derived)}</span>}</span>
  ) : (
    <span>{formatCurrency(plan.value)} <span className="text-muted-foreground" title="Valor travado">🔒</span></span>
  );

  if (!canEdit) return <span className="font-mono text-right block">{display}</span>;
  return (
    <button
      type="button"
      onClick={() => { setDraft(plan ? String(plan.value) : ""); setUnit(plan?.unit ?? "pct"); setEditing(true); }}
      className="w-full text-right font-mono hover:bg-accent hover:text-accent-foreground rounded px-1 py-1 cursor-pointer transition-colors"
      data-testid={`input-level-target-${pool}-${nodePath(parentKey, levelType, levelKey)}`}
    >
      {display}
    </button>
  );
}

// ---- Editor da meta travada de uma campanha individual (qualquer plataforma) ----
function CampaignTargetInput({ pool, month, platform, campaignId, plan, resolvedParentBrl, onSaved, canEdit }: {
  pool: CampaignTag; month: string; platform: Platform; campaignId: string;
  plan: CampaignTargetRow | undefined; resolvedParentBrl: number | null; onSaved: () => void; canEdit: boolean;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [unit, setUnit] = useState<PlanUnit>(plan?.unit ?? "brl");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [editing]);

  const derived = plan ? (plan.unit === "brl" ? plan.value : resolvedParentBrl != null ? (plan.value / 100) * resolvedParentBrl : null) : null;

  const save = async (overrideUnit?: PlanUnit) => {
    const u = overrideUnit ?? unit;
    const parsed = parseNumberInput(draft);
    setEditing(false);
    try {
      await apiRequest("PUT", "/api/growth/orcamento-campanhas/plan/campaign", {
        pool, month, platform, campaignId, value: parsed, unit: u,
      });
      onSaved();
    } catch (err) {
      toast({ title: "Erro ao salvar meta da campanha", description: String(err), variant: "destructive" });
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 justify-end">
        <Input
          ref={inputRef} type="text" inputMode="decimal"
          defaultValue={plan ? String(plan.value) : ""}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => save()}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") { setDraft(""); setEditing(false); }
          }}
          className="h-7 w-[80px] text-right font-mono text-xs" placeholder="0"
        />
        <div className="flex rounded border overflow-hidden">
          {(["pct", "brl"] as PlanUnit[]).map((u) => (
            <button
              key={u} type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setUnit(u)}
              className={cn("px-1 py-0.5 text-[10px]", unit === u ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent")}
            >
              {u === "pct" ? "%" : "R$"}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const display = !plan ? (
    <span className="text-muted-foreground italic text-xs">—</span>
  ) : plan.unit === "pct" ? (
    <span className="text-xs">{plan.value}%{derived != null && <span className="text-muted-foreground"> · {formatCurrency(derived)}</span>}</span>
  ) : (
    <span className="text-xs">{formatCurrency(plan.value)} <span className="text-muted-foreground" title="Valor travado">🔒</span></span>
  );

  if (!canEdit) return <span className="font-mono text-right block">{display}</span>;
  return (
    <button
      type="button"
      onClick={() => { setDraft(plan ? String(plan.value) : ""); setUnit(plan?.unit ?? "brl"); setEditing(true); }}
      className="w-full text-right font-mono hover:bg-accent hover:text-accent-foreground rounded px-1 py-1 cursor-pointer transition-colors"
      data-testid={`input-campaign-target-${platform}-${campaignId}`}
    >
      {display}
    </button>
  );
}

interface RowSums {
  daily: number;
  projecao: number;
  investido: number;
}
function sumRows(rows: Campanha[]): RowSums {
  let daily = 0, projecao = 0, investido = 0;
  for (const c of rows) {
    daily += c.isActive ? c.dailyBudgetAtual : 0;
    projecao += c.projecaoAsIs;
    investido += c.investidoTotal;
  }
  return { daily, projecao, investido };
}

const COLSPAN = 9;

// Níveis da árvore de agrupamento/planejamento, em ordem: Produto → Canal.
// Campanha é o caso-base da recursão (depth === LEVELS.length), tratado à
// parte em renderCampaignRow.
interface LevelDef {
  type: LevelType;
  groupKey: (c: Campanha) => string;
  order: string[];
  labels: Record<string, string>;
  hasNone: boolean;
}
const LEVELS: LevelDef[] = [
  { type: "product", groupKey: (c) => c.produto ?? "none", order: PRODUCT_ORDER, labels: PRODUCT_LABELS, hasNone: true },
  { type: "platform", groupKey: (c) => c.platform, order: PLATFORM_ORDER, labels: PLATFORM_LABELS, hasNone: false },
];

export default function GrowthOrcamentoCampanhas() {
  useSetPageInfo(
    "Orçamento por Campanha",
    "Planejamento por produto e canal — Meta, Google, TikTok e LinkedIn",
  );

  const { user } = useAuth();
  const canEdit = !!user?.email && ALLOWED_EDITOR_EMAILS.has(user.email);

  const queryClient = useQueryClient();
  const monthOptions = useMemo(() => getMonthOptions(), []);
  const defaultMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const [month, setMonth] = useState<string>(defaultMonth);
  const [activeTab, setActiveTab] = useState<TabValue>("todas");
  // Nós expandidos (chave = path completo do nó, só relevante no nível Canal).
  // Padrão: fechado — Produto fica sempre aberto.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleNode = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const { data, isLoading } = useQuery<ApiResponse>({
    queryKey: ["/api/growth/orcamento-campanhas", month],
    queryFn: async () => {
      const res = await fetch(`/api/growth/orcamento-campanhas?month=${month}`, { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar orçamento");
      return res.json();
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/growth/orcamento-campanhas", month] });

  const plans: Record<string, PoolPlan> = data?.plans ?? {};
  const allPlanNodes: PlanNode[] = data?.planNodes ?? [];
  const diasRestantes = data?.diasRestantes ?? 0;
  const poolForTab: CampaignTag | null =
    activeTab === "inbound" || activeTab === "evento" || activeTab === "creators_summit" ? activeTab : null;

  // Contagem por aba sobre TODAS as campanhas (independe da aba ativa).
  const tabCounts = useMemo(() => {
    const all = data?.campanhas ?? [];
    return {
      todas: all.length,
      inbound: all.filter((c) => c.tag === "inbound").length,
      evento: all.filter((c) => c.tag === "evento").length,
      creators_summit: all.filter((c) => c.tag === "creators_summit").length,
      "sem-tag": all.filter((c) => !c.tag).length,
    } as Record<TabValue, number>;
  }, [data]);

  const filteredCampanhas = useMemo(() => {
    const all = data?.campanhas ?? [];
    if (activeTab === "todas") return all;
    if (activeTab === "sem-tag") return all.filter((c) => !c.tag);
    return all.filter((c) => c.tag === activeTab);
  }, [data, activeTab]);

  const poolTotalForTab: number | null = (() => {
    if (poolForTab) return plans[poolForTab]?.total ?? null;
    if (activeTab === "todas") {
      let sum = 0, any = false;
      for (const pool of POOLS) {
        const t = plans[pool]?.total;
        if (t != null) { sum += t; any = true; }
      }
      return any ? sum : null;
    }
    return null;
  })();

  // Árvore de metas resolvida por pool (root = total do pool). Uma passada
  // top-down por pool; "todas" soma o resolvido de cada pool por path.
  const resolvedByPool = useMemo(() => {
    const map = new Map<CampaignTag, Map<string, number | null>>();
    for (const pool of POOLS) {
      const nodes = allPlanNodes.filter((n) => n.pool === pool);
      map.set(pool, resolvePlanTree(nodes, plans[pool]?.total ?? null));
    }
    return map;
  }, [data]);

  // Nós relevantes pra aba ativa: do pool único, ou a união de shapes
  // declarados em qualquer pool (pra "todas" saber quais grupos existem —
  // os valores em si vêm de resolvedForTab, que já soma corretamente por pool).
  const nodesForTab: PlanNode[] = useMemo(() => {
    if (poolForTab) return allPlanNodes.filter((n) => n.pool === poolForTab);
    if (activeTab === "todas") {
      const seen = new Map<string, PlanNode>();
      for (const n of allPlanNodes) {
        const key = nodePath(n.parentKey, n.levelType, n.levelKey);
        if (!seen.has(key)) seen.set(key, n);
      }
      return Array.from(seen.values());
    }
    return [];
  }, [data, activeTab, poolForTab]);

  const resolvedForTab: Map<string, number> = useMemo(() => {
    const out = new Map<string, number>();
    if (poolForTab) {
      const m = resolvedByPool.get(poolForTab);
      if (m) m.forEach((v, k) => { if (v != null) out.set(k, v); });
      return out;
    }
    if (activeTab === "todas") {
      for (const pool of POOLS) {
        const m = resolvedByPool.get(pool);
        if (!m) continue;
        m.forEach((v, k) => {
          if (v == null) return;
          out.set(k, (out.get(k) ?? 0) + v);
        });
      }
    }
    return out;
  }, [resolvedByPool, poolForTab, activeTab]);

  const getResolved = (path: string): number | null => resolvedForTab.get(path) ?? null;

  // Meta declarada de um nó, só quando um pool único está ativo (edição só
  // faz sentido dentro de um pool — "todas"/"sem-tag" mostram só o resolvido).
  const planForPoolTab = (levelType: LevelType, levelKey: string, parentKey: string): PlanNode | undefined => {
    if (!poolForTab) return undefined;
    return allPlanNodes.find((n) => n.pool === poolForTab && n.levelType === levelType && n.levelKey === levelKey && n.parentKey === parentKey);
  };

  // Metas travadas por campanha (esparso), escopadas ao pool ativo.
  const campaignTargetsMap = useMemo(() => {
    const map = new Map<string, CampaignTargetRow>();
    if (poolForTab) {
      for (const t of data?.campaignTargets ?? []) {
        if (t.pool === poolForTab) map.set(`${t.platform}:${t.campaignId}`, t);
      }
    }
    return map;
  }, [data, poolForTab]);

  const totals = useMemo(() => sumRows(filteredCampanhas), [filteredCampanhas]);

  // Fechamento do plano (só faz sentido num pool único): soma dos alvos de
  // produto vs total do pool. A árvore por nível tem seu próprio badge
  // "fecha 100%" no cabeçalho de cada Produto.
  const closing = useMemo(() => {
    if (!poolForTab) return null;
    const p = plans[poolForTab];
    const total = p?.total ?? null;
    const resolved = resolvedByPool.get(poolForTab);
    let sumTargets = 0;
    for (const produto of PRODUCT_ORDER) {
      const v = resolved?.get(nodePath("", "product", produto));
      if (v != null) sumTargets += v;
    }
    return { total, sumTargets, diff: (total ?? 0) - sumTargets };
  }, [plans, poolForTab, resolvedByPool]);

  // ---- Renderização ----
  // Célula "Ajuste/dia": quanto subir/baixar o diário p/ ficar no caminho do alvo.
  const renderAjusteCell = (target: number | null, investido: number, currentDaily: number) => {
    const a = pacing(target, investido, currentDaily, diasRestantes);
    if (!a) return <TableCell className="text-right text-muted-foreground text-xs">—</TableCell>;
    const tol = Math.max(50, a.required * 0.05);
    let content: string;
    let color: string;
    if (Math.abs(a.gap) <= tol) {
      content = "no ritmo";
      color = "text-green-600 dark:text-green-400";
    } else if (a.gap > 0) {
      content = `+${formatCurrency(a.gap)}/dia`;
      color = "text-red-500 dark:text-red-400";
    } else {
      content = `−${formatCurrency(-a.gap)}/dia`;
      color = "text-yellow-600 dark:text-yellow-400";
    }
    return (
      <TableCell
        className={cn("text-right font-mono text-xs whitespace-nowrap", color)}
        title={`Necessário ${formatCurrency(a.required)}/dia para o alvo · atual ${formatCurrency(currentDaily)}/dia`}
      >
        {content}
      </TableCell>
    );
  };

  // Badge "fecha 100%" / "resta X" / "passou X" — reconciliação genérica entre
  // a meta de um nó e a soma dos filhos diretos dele (Produto vs Canais).
  const renderClosingBadge = (ownResolved: number | null, childrenSum: number | null) => {
    if (ownResolved == null || childrenSum == null) return null;
    const diff = ownResolved - childrenSum;
    if (Math.abs(diff) < 0.5) return <Badge className="bg-green-600 hover:bg-green-600 text-xs font-normal">fecha 100%</Badge>;
    if (diff > 0) return <Badge variant="outline" className="text-xs font-normal">resta {formatCurrency(diff)}</Badge>;
    return <Badge variant="outline" className="text-xs font-normal text-red-500 dark:text-red-400">passou {formatCurrency(-diff)}</Badge>;
  };

  const renderCampaignRow = (c: Campanha, resolvedPlatformBrl: number | null) => {
    const isActive = c.isActive;
    const targetPlan = campaignTargetsMap.get(`${c.platform}:${c.campaignId}`);
    return (
      <TableRow key={`${c.platform}-${c.campaignId}`} className={PLATFORM_STYLES[c.platform].row} data-testid={`row-${c.platform}-${c.campaignId}`}>
        <TableCell className="font-medium pl-16">
          <div className="flex items-center gap-2">
            <span className="truncate max-w-[260px]" title={c.name}>{c.name}</span>
            {!isActive && <Badge variant="outline" className="text-xs">Pausada</Badge>}
            {isActive && !c.isDelivering && (
              <Badge variant="outline" className="text-xs" title="Sem gasto nos últimos 3 dias — projeção não extrapola.">
                Sem entrega
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell><TagSelect platform={c.platform} campaignId={c.campaignId} value={c.tag} onSaved={invalidate} canEdit={canEdit} /></TableCell>
        <TableCell><ProdutoSelect platform={c.platform} campaignId={c.campaignId} value={c.produto} onSaved={invalidate} canEdit={canEdit} /></TableCell>
        <TableCell className="text-right">
          {poolForTab ? (
            <CampaignTargetInput
              pool={poolForTab} month={month} platform={c.platform} campaignId={c.campaignId}
              plan={targetPlan} resolvedParentBrl={resolvedPlatformBrl} onSaved={invalidate} canEdit={canEdit}
            />
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </TableCell>
        <TableCell className="text-right font-mono">
          {isActive ? formatCurrency(c.dailyBudgetAtual) : <span className="text-muted-foreground">—</span>}
        </TableCell>
        <TableCell className="text-right font-mono">{formatCurrency(c.projecaoAsIs)}</TableCell>
        <TableCell className="text-right font-mono">{formatCurrency(c.investidoTotal)}</TableCell>
        <TableCell className="text-right text-muted-foreground">—</TableCell>
        <TableCell className="text-right text-muted-foreground">—</TableCell>
      </TableRow>
    );
  };

  // Recursão única pra Produto → Canal → Campanha. depth indexa
  // LEVELS; ao chegar em LEVELS.length, cai no caso-base (linhas de campanha).
  // parentKey é o path do nó pai ("" na raiz); resolvedParentBrl é o valor já
  // resolvido do pai, usado tanto pra %/R$ do LevelTargetInput quanto pra
  // colorir projeção/investido contra o alvo.
  const renderGroupLevel = (rows: Campanha[], depth: number, parentKey: string, resolvedParentBrl: number | null): JSX.Element[] => {
    if (depth === LEVELS.length) {
      return rows.map((c) => renderCampaignRow(c, resolvedParentBrl));
    }
    const level = LEVELS[depth];
    const grouped = new Map<string, Campanha[]>();
    for (const c of rows) {
      const key = level.groupKey(c);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(c);
    }
    const orderedKeys = level.hasNone ? [...level.order, "none"] : level.order;
    const elements: JSX.Element[] = [];

    for (const key of orderedKeys) {
      const groupRows = grouped.get(key) ?? [];
      const isNone = key === "none";
      const path = isNone ? null : nodePath(parentKey, level.type, key);
      const ownResolved = path ? getResolved(path) : null;
      if (groupRows.length === 0 && ownResolved == null) continue;

      const s = sumRows(groupRows);
      // Mesmo pra bucket "none" usa nodePath() — senão o path vira encoding
      // inválido (ex.: "|product:none" em vez de "product:none" na raiz), que
      // nunca resolve como pai de um filho real.
      const nodeKey = path ?? nodePath(parentKey, level.type, "none");
      const isCollapsible = level.type === "platform"; // Canal — único nível que precisa de clique
      const isOpen = !isCollapsible || expanded.has(nodeKey);
      const label = isNone ? "Sem produto" : level.labels[key];
      const plan = !isNone ? planForPoolTab(level.type, key, parentKey) : undefined;
      const childPath = path ?? nodeKey;

      if (level.type === "platform") {
        const p = key as Platform;
        const st = PLATFORM_STYLES[p];
        elements.push(
          <TableRow
            key={`node-${nodeKey}`}
            className={cn("cursor-pointer font-medium", st.row)}
            onClick={() => toggleNode(nodeKey)}
            data-testid={`platform-subheader-${nodeKey}`}
          >
            <TableCell colSpan={3} className="py-1.5 pl-10">
              <span className="flex items-center gap-1.5 text-xs">
                {isOpen
                  ? <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                  : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                <PlatformIcon platform={p} className={st.icon} />
                {PLATFORM_LABELS[p]}
                <span className="opacity-60">({groupRows.length})</span>
              </span>
            </TableCell>
            <TableCell className="text-right text-xs">
              {poolForTab ? (
                <LevelTargetInput
                  pool={poolForTab} month={month} levelType="platform" levelKey={key} parentKey={parentKey}
                  plan={plan} resolvedParentBrl={resolvedParentBrl} onSaved={invalidate} canEdit={canEdit}
                />
              ) : (
                <span className="font-mono">{ownResolved != null ? formatCurrency(ownResolved) : "—"}</span>
              )}
            </TableCell>
            <TableCell className="text-right font-mono text-xs">{formatCurrency(s.daily)}</TableCell>
            <TableCell className={cn("text-right font-mono text-xs", projecaoColor(s.projecao, ownResolved))}>{formatCurrency(s.projecao)}</TableCell>
            <TableCell className={cn("text-right font-mono text-xs", variancePctColor(s.investido, ownResolved))}>{formatCurrency(s.investido)}</TableCell>
            <TableCell className="text-right text-xs text-muted-foreground">
              {ownResolved && ownResolved > 0 ? `${((s.investido / ownResolved) * 100).toFixed(0)}%` : "—"}
            </TableCell>
            {renderAjusteCell(ownResolved, s.investido, s.daily)}
          </TableRow>,
        );
        if (isOpen) elements.push(...renderGroupLevel(groupRows, depth + 1, childPath, ownResolved));
        continue;
      }

      // Produto (depth 0) — cabeçalho maior, sempre expandido.
      const childrenSum = path ? directChildrenSum(nodesForTab, resolvedForTab, path) : null;
      elements.push(
        <TableRow
          key={`node-${nodeKey}`}
          className={cn("font-bold", depth === 0 ? "bg-muted" : "bg-muted/60")}
          data-testid={`group-header-${nodeKey}`}
        >
          <TableCell colSpan={3} className={cn("py-2.5", depth === 1 && "pl-6")}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("uppercase tracking-wide", depth === 0 ? "text-sm" : "text-xs")}>{label}</span>
              <span className="opacity-50 text-xs font-normal">({groupRows.length})</span>
              {renderClosingBadge(ownResolved, childrenSum)}
            </div>
          </TableCell>
          <TableCell className="text-right">
            {poolForTab && !isNone ? (
              <LevelTargetInput
                pool={poolForTab} month={month} levelType={level.type} levelKey={key} parentKey={parentKey}
                plan={plan} resolvedParentBrl={resolvedParentBrl} onSaved={invalidate} canEdit={canEdit}
              />
            ) : (
              <span className="font-mono">{ownResolved != null ? formatCurrency(ownResolved) : "—"}</span>
            )}
          </TableCell>
          <TableCell className="text-right font-mono">{formatCurrency(s.daily)}</TableCell>
          <TableCell className={cn("text-right font-mono", projecaoColor(s.projecao, ownResolved))}>{formatCurrency(s.projecao)}</TableCell>
          <TableCell className={cn("text-right font-mono", variancePctColor(s.investido, ownResolved))}>{formatCurrency(s.investido)}</TableCell>
          <TableCell className="text-right text-xs text-muted-foreground">
            {ownResolved && ownResolved > 0 ? `${((s.investido / ownResolved) * 100).toFixed(0)}%` : "—"}
          </TableCell>
          {renderAjusteCell(ownResolved, s.investido, s.daily)}
        </TableRow>,
      );
      elements.push(...renderGroupLevel(groupRows, depth + 1, childPath, ownResolved));
    }
    return elements;
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[200px]" data-testid="select-month"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {data && (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{data.diasDecorridos}</span> de {data.diasTotal} dias decorridos
            {" · "}
            <span className="font-medium text-foreground">{data.diasRestantes}</span> restantes
          </div>
        )}
      </div>

      {/* Abas por pool. Cards, planejamento e tabela refletem a aba ativa. */}
      <div className="flex items-center gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.value} type="button" onClick={() => setActiveTab(t.value)} data-testid={`tab-${t.value}`}
            className={cn(
              "px-3 py-1.5 text-sm font-medium -mb-px border-b-2 transition-colors",
              activeTab === t.value ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}<span className="ml-1.5 text-xs opacity-60">{tabCounts[t.value]}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2"><Target className="w-3.5 h-3.5" /> Planejado (Total)</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold font-mono">{poolTotalForTab != null ? formatCurrency(poolTotalForTab) : "—"}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2"><DollarSign className="w-3.5 h-3.5" /> Investido Total</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold font-mono">{formatCurrency(totals.investido)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5" /> Projeção (As Is)</CardTitle></CardHeader>
          <CardContent><div className={cn("text-2xl font-bold font-mono", projecaoColor(totals.projecao, poolTotalForTab))}>{formatCurrency(totals.projecao)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2"><DollarSign className="w-3.5 h-3.5" /> Orç. Diário Atual</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold font-mono">{formatCurrency(totals.daily)}</div></CardContent>
        </Card>
      </div>

      {/* Painel de planejamento do pool: total do mês + progresso da distribuição. */}
      {poolForTab && (
        <Card>
          <CardContent className="py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Total do mês ({TAG_LABELS[poolForTab]}):</span>
              <PoolTotalInput pool={poolForTab} month={month} value={plans[poolForTab]?.total ?? null} onSaved={invalidate} canEdit={canEdit} />
            </div>
            {closing && closing.total != null && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {closing.sumTargets === 0 ? (
                  <span>Defina o alvo de cada produto abaixo para distribuir o total.</span>
                ) : (
                  <>
                    <span>Distribuído entre produtos:</span>
                    <span className="font-mono text-foreground">{formatCurrency(closing.sumTargets)}</span>
                    <span>de {formatCurrency(closing.total)}</span>
                    {Math.abs(closing.diff) < 0.5 ? (
                      <Badge className="bg-green-600 hover:bg-green-600 text-xs">fecha 100%</Badge>
                    ) : closing.diff > 0 ? (
                      <Badge variant="outline" className="text-xs">resta distribuir {formatCurrency(closing.diff)}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-red-500 dark:text-red-400">passou {formatCurrency(-closing.diff)}</Badge>
                    )}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Carregando...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto / Campanha</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Planejado</TableHead>
                  <TableHead className="text-right">Orç. Diário (Atual)</TableHead>
                  <TableHead className="text-right">Projeção (As Is)</TableHead>
                  <TableHead className="text-right">Investido</TableHead>
                  <TableHead className="text-right">% Atingido</TableHead>
                  <TableHead className="text-right">Ajuste/dia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {renderGroupLevel(filteredCampanhas, 0, "", poolTotalForTab)}

                {filteredCampanhas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={COLSPAN} className="py-8 text-center text-muted-foreground">
                      Nenhuma campanha nesta aba.
                    </TableCell>
                  </TableRow>
                )}

                <TableRow className="bg-muted font-semibold border-t-2 border-foreground/20">
                  <TableCell colSpan={3}>TOTAL</TableCell>
                  <TableCell className="text-right font-mono">{poolTotalForTab != null ? formatCurrency(poolTotalForTab) : "—"}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(totals.daily)}</TableCell>
                  <TableCell className={cn("text-right font-mono", projecaoColor(totals.projecao, poolTotalForTab))}>{formatCurrency(totals.projecao)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(totals.investido)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {poolTotalForTab && poolTotalForTab > 0 ? `${((totals.investido / poolTotalForTab) * 100).toFixed(0)}%` : "—"}
                  </TableCell>
                  {renderAjusteCell(poolTotalForTab, totals.investido, totals.daily)}
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
