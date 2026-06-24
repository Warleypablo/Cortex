import { useMemo, useState, useEffect, useRef, Fragment, type CSSProperties } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Target, Calendar, Facebook, Search as SearchIcon, Loader2, ChevronRight, ChevronDown, Linkedin, Music2, Settings, Plus, ArrowUp, ArrowDown, Archive, RotateCcw } from "lucide-react";
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
// Ordem de exibição das plataformas dentro de cada etapa.
const PLATFORM_ORDER: Platform[] = ["meta", "google", "tiktok", "linkedin"];
// Cor de FUNDO (leve) aplicada às linhas da plataforma + cor do ícone.
const PLATFORM_STYLES: Record<Platform, { row: string; icon: string }> = {
  meta: { row: "bg-blue-500/5 dark:bg-blue-400/[0.07]", icon: "text-blue-600 dark:text-blue-400" },
  google: { row: "bg-amber-500/5 dark:bg-amber-400/[0.07]", icon: "text-amber-600 dark:text-amber-400" },
  tiktok: { row: "bg-rose-500/5 dark:bg-rose-400/[0.07]", icon: "text-rose-500 dark:text-rose-400" },
  linkedin: { row: "bg-cyan-500/5 dark:bg-cyan-400/[0.07]", icon: "text-cyan-600 dark:text-cyan-400" },
};

// Tags/grupos (pools) — agora configuráveis pela aba "Configuração"
// (tabela cortex_core.budget_tags), carregadas do backend a cada request.
type CampaignTag = string;
interface TagDef {
  key: string;
  label: string;
  color: string | null;
  sortOrder: number;
  active: boolean;
}
const NO_TAG = "__none__"; // sentinela p/ "Sem grupo" no Select (Radix não aceita value vazio)

// Abas especiais (não são tags).
const TAB_TODAS = "__todas__";
const TAB_SEM_TAG = "__sem_tag__";
const TAB_CONFIG = "__config__";

// Tinge um badge/realce com a cor da tag (hex #rrggbb). Acrescenta alpha em hex.
function tagTint(color: string | null | undefined): CSSProperties | undefined {
  if (!color) return undefined;
  return { backgroundColor: `${color}1f`, color, borderColor: `${color}55` };
}

// Etapas do funil. Manter em sincronia com CAMPAIGN_STAGES no backend.
type CampaignStage = "descoberta" | "relacionamento" | "conversao" | "remarketing" | "institucional";
const STAGE_OPTIONS: { value: CampaignStage; label: string }[] = [
  { value: "descoberta", label: "Descoberta" },
  { value: "relacionamento", label: "Relacionamento" },
  { value: "conversao", label: "Conversão" },
  { value: "remarketing", label: "Remarketing" },
  { value: "institucional", label: "Institucional" },
];
const STAGE_LABELS: Record<CampaignStage, string> = {
  descoberta: "Descoberta",
  relacionamento: "Relacionamento",
  conversao: "Conversão",
  remarketing: "Remarketing",
  institucional: "Institucional",
};
const STAGE_ORDER: CampaignStage[] = STAGE_OPTIONS.map((o) => o.value);
const NO_STAGE = "__none__";

type PlanUnit = "pct" | "brl";
interface StagePlan {
  value: number;
  unit: PlanUnit;
}
interface PoolPlan {
  total: number | null;
  stages: Partial<Record<CampaignStage, StagePlan>>;
}

interface Campanha {
  platform: Platform;
  campaignId: string;
  name: string;
  status: string | null;
  dailyBudgetAtual: number;
  investidoTotal: number;
  projecaoAsIs: number;
  isDelivering: boolean;
  tag: CampaignTag | null;
  stage: CampaignStage | null;
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
  tags: TagDef[];
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

// Alvo R$ de uma etapa: valor travado (brl) ou % do total do pool (pct).
function deriveStageTarget(plan: StagePlan | undefined, poolTotal: number | null): number | null {
  if (!plan) return null;
  if (plan.unit === "brl") return plan.value;
  if (poolTotal == null) return null;
  return (plan.value / 100) * poolTotal;
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
function TagSelect({ platform, campaignId, value, onSaved, canEdit, tags }: {
  platform: Platform; campaignId: string; value: CampaignTag | null; onSaved: () => void; canEdit: boolean; tags: TagDef[];
}) {
  const { toast } = useToast();
  const current = value ? tags.find((t) => t.key === value) : undefined;
  if (!canEdit) {
    return value
      ? <Badge variant="secondary" className="text-xs" style={tagTint(current?.color)}>{current?.label ?? value}</Badge>
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
  // Tag arquivada ainda atribuída: mostra como opção para não "sumir" o valor atual.
  const options = tags.filter((t) => t.active || t.key === value);
  return (
    <Select value={value ?? NO_TAG} onValueChange={handleChange}>
      <SelectTrigger className="h-7 w-[140px] text-xs" data-testid={`select-tag-${platform}-${campaignId}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_TAG}><span className="text-muted-foreground">Sem grupo</span></SelectItem>
        {options.map((t) => (
          <SelectItem key={t.key} value={t.key}>
            {t.label}{!t.active && <span className="text-muted-foreground"> (arquivada)</span>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---- Select de etapa por campanha ----
function StageSelect({ platform, campaignId, value, onSaved, canEdit }: {
  platform: Platform; campaignId: string; value: CampaignStage | null; onSaved: () => void; canEdit: boolean;
}) {
  const { toast } = useToast();
  if (!canEdit) {
    return value
      ? <Badge variant="outline" className="text-xs">{STAGE_LABELS[value]}</Badge>
      : <span className="text-muted-foreground text-xs">—</span>;
  }
  const handleChange = async (next: string) => {
    const stage = next === NO_STAGE ? null : next;
    try {
      await apiRequest("PUT", "/api/growth/orcamento-campanhas/stage", { platform, campaignId, stage });
      onSaved();
    } catch (err) {
      toast({ title: "Erro ao salvar etapa", description: String(err), variant: "destructive" });
    }
  };
  return (
    <Select value={value ?? NO_STAGE} onValueChange={handleChange}>
      <SelectTrigger className="h-7 w-[150px] text-xs" data-testid={`select-stage-${platform}-${campaignId}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_STAGE}><span className="text-muted-foreground">Sem etapa</span></SelectItem>
        {STAGE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
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

// ---- Editor do alvo de uma etapa (híbrido % / R$) ----
function StageTargetInput({ pool, month, stage, plan, poolTotal, onSaved, canEdit }: {
  pool: CampaignTag; month: string; stage: CampaignStage; plan: StagePlan | undefined;
  poolTotal: number | null; onSaved: () => void; canEdit: boolean;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [unit, setUnit] = useState<PlanUnit>(plan?.unit ?? "pct");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [editing]);

  const derived = deriveStageTarget(plan, poolTotal);

  const save = async (overrideUnit?: PlanUnit) => {
    const u = overrideUnit ?? unit;
    const parsed = parseNumberInput(draft);
    setEditing(false);
    try {
      await apiRequest("PUT", "/api/growth/orcamento-campanhas/plan/stage", {
        pool, month, stage, value: parsed, unit: u,
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
      data-testid={`input-stage-target-${pool}-${stage}`}
    >
      {display}
    </button>
  );
}

interface StageSums {
  daily: number;
  projecao: number;
  investido: number;
}
function sumStage(rows: Campanha[]): StageSums {
  let daily = 0, projecao = 0, investido = 0;
  for (const c of rows) {
    const isActive = c.status === "ACTIVE" || c.status === "ENABLED";
    daily += isActive ? c.dailyBudgetAtual : 0;
    projecao += c.projecaoAsIs;
    investido += c.investidoTotal;
  }
  return { daily, projecao, investido };
}

const COLSPAN = 9;

// ---- Aba de Configuração: gerencia o catálogo de tags/grupos ----
function TagsConfig({ tags, onChanged, canEdit }: { tags: TagDef[]; onChanged: () => void; canEdit: boolean }) {
  const { toast } = useToast();
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");
  const [busy, setBusy] = useState(false);

  const activeSorted = tags.filter((t) => t.active).sort((a, b) => a.sortOrder - b.sortOrder);
  const archived = tags.filter((t) => !t.active).sort((a, b) => a.label.localeCompare(b.label));
  const activeKeys = activeSorted.map((t) => t.key);

  const run = async (fn: () => Promise<any>, errTitle: string) => {
    setBusy(true);
    try { await fn(); onChanged(); }
    catch (err) { toast({ title: errTitle, description: String(err), variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const create = () => {
    const label = newLabel.trim();
    if (!label) return;
    run(async () => {
      await apiRequest("POST", "/api/growth/orcamento-campanhas/tags", { label, color: newColor });
      setNewLabel("");
    }, "Erro ao criar tag");
  };
  const rename = (key: string, label: string, prev: string) => {
    if (!label.trim() || label.trim() === prev) return;
    run(() => apiRequest("PUT", "/api/growth/orcamento-campanhas/tags", { key, label: label.trim() }), "Erro ao renomear");
  };
  const recolor = (key: string, color: string) =>
    run(() => apiRequest("PUT", "/api/growth/orcamento-campanhas/tags", { key, color }), "Erro ao alterar cor");
  const setActive = (key: string, active: boolean) =>
    run(() => apiRequest("PUT", "/api/growth/orcamento-campanhas/tags", { key, active }), active ? "Erro ao reativar" : "Erro ao arquivar");
  const move = (key: string, dir: -1 | 1) => {
    const idx = activeKeys.indexOf(key);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= activeKeys.length) return;
    const next = [...activeKeys];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    run(() => apiRequest("PUT", "/api/growth/orcamento-campanhas/tags/reorder", { keys: next }), "Erro ao reordenar");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Settings className="w-4 h-4" /> Configuração de grupos</CardTitle>
        <p className="text-sm text-muted-foreground">
          Cada grupo vira uma aba e um pool de orçamento. Renomear preserva os dados; arquivar esconde a aba sem apagar nada.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Criar nova tag */}
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2 border-b pb-4">
            <input
              type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)}
              className="h-9 w-9 rounded cursor-pointer bg-transparent border" title="Cor do grupo"
              data-testid="input-new-tag-color"
            />
            <Input
              value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") create(); }}
              placeholder="Nome do grupo (ex: Creators Summit)"
              className="h-9 w-[260px]" data-testid="input-new-tag-label"
            />
            <button
              type="button" onClick={create} disabled={busy || !newLabel.trim()}
              className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              data-testid="button-create-tag"
            >
              <Plus className="w-4 h-4" /> Criar
            </button>
          </div>
        )}

        {/* Tags ativas */}
        <div className="space-y-1.5">
          {activeSorted.length === 0 && <p className="text-sm text-muted-foreground">Nenhum grupo ativo.</p>}
          {activeSorted.map((t, i) => (
            <div key={t.key} className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-accent/50" data-testid={`tag-row-${t.key}`}>
              {canEdit && (
                <div className="flex flex-col">
                  <button type="button" onClick={() => move(t.key, -1)} disabled={i === 0 || busy}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30" title="Subir">
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => move(t.key, 1)} disabled={i === activeSorted.length - 1 || busy}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30" title="Descer">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <input
                type="color" value={t.color ?? "#888888"} disabled={!canEdit}
                onChange={(e) => recolor(t.key, e.target.value)}
                className="h-7 w-7 rounded cursor-pointer bg-transparent border disabled:cursor-default" title="Cor"
              />
              {canEdit ? (
                <Input
                  defaultValue={t.label}
                  onBlur={(e) => rename(t.key, e.target.value, t.label)}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  className="h-8 w-[240px]" data-testid={`input-tag-label-${t.key}`}
                />
              ) : (
                <Badge variant="secondary" style={tagTint(t.color)}>{t.label}</Badge>
              )}
              <span className="text-xs text-muted-foreground font-mono">{t.key}</span>
              {canEdit && (
                <button type="button" onClick={() => setActive(t.key, false)} disabled={busy}
                  className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  data-testid={`button-archive-${t.key}`}>
                  <Archive className="w-3.5 h-3.5" /> Arquivar
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Tags arquivadas */}
        {archived.length > 0 && (
          <div className="space-y-1.5 border-t pt-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Arquivadas</p>
            {archived.map((t) => (
              <div key={t.key} className="flex items-center gap-2 py-1 px-2 opacity-70" data-testid={`tag-row-archived-${t.key}`}>
                <span className="h-3 w-3 rounded-full border" style={{ backgroundColor: t.color ?? "#888" }} />
                <span className="text-sm">{t.label}</span>
                <span className="text-xs text-muted-foreground font-mono">{t.key}</span>
                {canEdit && (
                  <button type="button" onClick={() => setActive(t.key, true)} disabled={busy}
                    className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    data-testid={`button-restore-${t.key}`}>
                    <RotateCcw className="w-3.5 h-3.5" /> Reativar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function GrowthOrcamentoCampanhas() {
  useSetPageInfo(
    "Orçamento por Campanha",
    "Planejamento por etapa do funil — Meta + Google",
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
  const [activeTab, setActiveTab] = useState<string>(TAB_TODAS);
  // Plataformas expandidas (chave `${etapa}:${plataforma}`). Padrão: fechado.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const togglePlatform = (key: string) =>
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
  const diasRestantes = data?.diasRestantes ?? 0;

  // Catálogo de tags dinâmico. Abas só mostram as ativas; o mapa cobre todas
  // (inclusive arquivadas) p/ rotular badges de campanhas já classificadas.
  const allTags: TagDef[] = data?.tags ?? [];
  const activeTags = useMemo(
    () => allTags.filter((t) => t.active).sort((a, b) => a.sortOrder - b.sortOrder),
    [allTags],
  );
  const tagMap = useMemo(() => new Map(allTags.map((t) => [t.key, t])), [allTags]);
  const tagLabel = (key: string) => tagMap.get(key)?.label ?? key;
  const POOLS: CampaignTag[] = useMemo(() => activeTags.map((t) => t.key), [activeTags]);

  const isConfig = activeTab === TAB_CONFIG;
  const poolForTab: CampaignTag | null =
    activeTab !== TAB_TODAS && activeTab !== TAB_SEM_TAG && activeTab !== TAB_CONFIG && tagMap.has(activeTab)
      ? activeTab
      : null;

  // Abas: Todas + cada tag ativa + Sem tag (+ Configuração à parte).
  const TABS = useMemo(
    () => [
      { value: TAB_TODAS, label: "Todas", color: null as string | null },
      ...activeTags.map((t) => ({ value: t.key, label: t.label, color: t.color })),
      { value: TAB_SEM_TAG, label: "Sem tag", color: null as string | null },
    ],
    [activeTags],
  );

  // Contagem por aba sobre TODAS as campanhas (independe da aba ativa).
  const tabCounts = useMemo(() => {
    const all = data?.campanhas ?? [];
    const counts: Record<string, number> = {
      [TAB_TODAS]: all.length,
      [TAB_SEM_TAG]: all.filter((c) => !c.tag).length,
    };
    for (const t of activeTags) counts[t.key] = all.filter((c) => c.tag === t.key).length;
    return counts;
  }, [data, activeTags]);

  const filteredCampanhas = useMemo(() => {
    const all = data?.campanhas ?? [];
    if (activeTab === TAB_TODAS) return all;
    if (activeTab === TAB_SEM_TAG) return all.filter((c) => !c.tag);
    return all.filter((c) => c.tag === activeTab);
  }, [data, activeTab]);

  // Alvo R$ de uma etapa na aba ativa (pool único, soma p/ "todas", null p/ sem-tag).
  const targetForStage = (stage: CampaignStage): number | null => {
    if (poolForTab) {
      const p = plans[poolForTab];
      return p ? deriveStageTarget(p.stages[stage], p.total) : null;
    }
    if (activeTab === TAB_TODAS) {
      let sum = 0, any = false;
      for (const pool of POOLS) {
        const p = plans[pool];
        const t = p ? deriveStageTarget(p.stages[stage], p.total) : null;
        if (t != null) { sum += t; any = true; }
      }
      return any ? sum : null;
    }
    return null;
  };

  const poolTotalForTab: number | null = (() => {
    if (poolForTab) return plans[poolForTab]?.total ?? null;
    if (activeTab === TAB_TODAS) {
      let sum = 0, any = false;
      for (const pool of POOLS) {
        const t = plans[pool]?.total;
        if (t != null) { sum += t; any = true; }
      }
      return any ? sum : null;
    }
    return null;
  })();

  // Agrupa campanhas filtradas por etapa (+ bucket "sem etapa").
  const stageGroups = useMemo(() => {
    const map = new Map<CampaignStage | "none", Campanha[]>();
    for (const c of filteredCampanhas) {
      const key = c.stage ?? "none";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  }, [filteredCampanhas]);

  const totals = useMemo(() => sumStage(filteredCampanhas), [filteredCampanhas]);

  // Fechamento do plano (só faz sentido num pool único): soma dos alvos vs total.
  const closing = useMemo(() => {
    if (!poolForTab) return null;
    const p = plans[poolForTab];
    const total = p?.total ?? null;
    let sumTargets = 0;
    for (const s of STAGE_ORDER) {
      const t = p ? deriveStageTarget(p.stages[s], p.total) : null;
      if (t != null) sumTargets += t;
    }
    return { total, sumTargets, diff: (total ?? 0) - sumTargets };
  }, [plans, poolForTab]);

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

  const renderCampaignRow = (c: Campanha) => {
    const isActive = c.status === "ACTIVE" || c.status === "ENABLED";
    return (
      <TableRow key={`${c.platform}-${c.campaignId}`} className={PLATFORM_STYLES[c.platform].row} data-testid={`row-${c.platform}-${c.campaignId}`}>
        <TableCell className="font-medium pl-12">
          <div className="flex items-center gap-2">
            <span className="truncate max-w-[300px]" title={c.name}>{c.name}</span>
            {c.status === "PAUSED" && <Badge variant="outline" className="text-xs">Pausada</Badge>}
            {c.status !== "PAUSED" && !c.isDelivering && (
              <Badge variant="outline" className="text-xs" title="Sem gasto nos últimos 3 dias — projeção não extrapola.">
                Sem entrega
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell><TagSelect platform={c.platform} campaignId={c.campaignId} value={c.tag} onSaved={invalidate} canEdit={canEdit} tags={allTags} /></TableCell>
        <TableCell><StageSelect platform={c.platform} campaignId={c.campaignId} value={c.stage} onSaved={invalidate} canEdit={canEdit} /></TableCell>
        <TableCell className="text-right text-muted-foreground">—</TableCell>
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

  // Dentro de uma etapa, separa as campanhas por plataforma (sub-cabeçalho + subtotal).
  const renderPlatformBlocks = (rows: Campanha[], keyPrefix: string) => {
    const byPlatform = new Map<Platform, Campanha[]>();
    for (const c of rows) {
      if (!byPlatform.has(c.platform)) byPlatform.set(c.platform, []);
      byPlatform.get(c.platform)!.push(c);
    }
    const blocks: JSX.Element[] = [];
    for (const p of PLATFORM_ORDER) {
      const prs = byPlatform.get(p);
      if (!prs || prs.length === 0) continue;
      const s = sumStage(prs);
      const key = `${keyPrefix}:${p}`;
      const isOpen = expanded.has(key);
      const st = PLATFORM_STYLES[p];
      blocks.push(
        <TableRow
          key={`plat-${keyPrefix}-${p}`}
          className={cn("cursor-pointer font-medium", st.row)}
          onClick={() => togglePlatform(key)}
          data-testid={`platform-subheader-${keyPrefix}-${p}`}
        >
          <TableCell colSpan={3} className="py-1.5 pl-6">
            <span className="flex items-center gap-1.5 text-xs">
              {isOpen
                ? <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
              <PlatformIcon platform={p} className={st.icon} />
              {PLATFORM_LABELS[p]}
              <span className="opacity-60">({prs.length})</span>
            </span>
          </TableCell>
          <TableCell className="text-right text-xs opacity-40">—</TableCell>
          <TableCell className="text-right font-mono text-xs">{formatCurrency(s.daily)}</TableCell>
          <TableCell className="text-right font-mono text-xs">{formatCurrency(s.projecao)}</TableCell>
          <TableCell className="text-right font-mono text-xs">{formatCurrency(s.investido)}</TableCell>
          <TableCell className="text-right text-xs opacity-40">—</TableCell>
          <TableCell className="text-right text-xs opacity-40">—</TableCell>
        </TableRow>,
      );
      if (isOpen) for (const c of prs) blocks.push(renderCampaignRow(c));
    }
    return blocks;
  };

  const renderStageGroup = (stage: CampaignStage) => {
    const rows = stageGroups.get(stage) ?? [];
    const target = targetForStage(stage);
    if (rows.length === 0 && target == null) return null;
    const s = sumStage(rows);
    return (
      <>
        <TableRow className="bg-muted font-bold" data-testid={`stage-header-${stage}`}>
          <TableCell colSpan={3} className="py-2.5">
            <div className="flex items-center gap-2">
              <span className="uppercase tracking-wide text-sm">{STAGE_LABELS[stage]}</span>
              <span className="opacity-50 text-xs font-normal">({rows.length})</span>
            </div>
          </TableCell>
          <TableCell className="text-right">
            {poolForTab ? (
              <StageTargetInput
                pool={poolForTab} month={month} stage={stage}
                plan={plans[poolForTab]?.stages[stage]} poolTotal={plans[poolForTab]?.total ?? null}
                onSaved={invalidate} canEdit={canEdit}
              />
            ) : (
              <span className="font-mono">{target != null ? formatCurrency(target) : "—"}</span>
            )}
          </TableCell>
          <TableCell className="text-right font-mono">{formatCurrency(s.daily)}</TableCell>
          <TableCell className={cn("text-right font-mono", projecaoColor(s.projecao, target))}>{formatCurrency(s.projecao)}</TableCell>
          <TableCell className={cn("text-right font-mono", variancePctColor(s.investido, target))}>{formatCurrency(s.investido)}</TableCell>
          <TableCell className="text-right text-xs text-muted-foreground">
            {target && target > 0 ? `${((s.investido / target) * 100).toFixed(0)}%` : "—"}
          </TableCell>
          {renderAjusteCell(target, s.investido, s.daily)}
        </TableRow>
        {renderPlatformBlocks(rows, stage)}
      </>
    );
  };

  const semEtapaRows = stageGroups.get("none") ?? [];

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
        {TABS.map((t) => {
          const isActive = activeTab === t.value;
          return (
            <button
              key={t.value} type="button" onClick={() => setActiveTab(t.value)} data-testid={`tab-${t.value}`}
              className={cn(
                "px-3 py-1.5 text-sm font-medium -mb-px border-b-2 transition-colors flex items-center gap-1.5",
                isActive ? "text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                isActive && !t.color && "border-primary",
              )}
              style={isActive && t.color ? { borderBottomColor: t.color, color: t.color } : undefined}
            >
              {t.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />}
              {t.label}<span className="text-xs opacity-60">{tabCounts[t.value] ?? 0}</span>
            </button>
          );
        })}
        {/* Aba de configuração das tags (separada, à direita) */}
        <button
          type="button" onClick={() => setActiveTab(TAB_CONFIG)} data-testid="tab-config"
          className={cn(
            "ml-auto px-3 py-1.5 text-sm font-medium -mb-px border-b-2 transition-colors flex items-center gap-1.5",
            isConfig ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
          title="Configurar grupos"
        >
          <Settings className="w-3.5 h-3.5" /> Configuração
        </button>
      </div>

      {isConfig ? (
        <TagsConfig tags={allTags} onChanged={invalidate} canEdit={canEdit} />
      ) : (
      <>
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
              <span className="text-sm text-muted-foreground">Total do mês ({tagLabel(poolForTab)}):</span>
              <PoolTotalInput pool={poolForTab} month={month} value={plans[poolForTab]?.total ?? null} onSaved={invalidate} canEdit={canEdit} />
            </div>
            {closing && closing.total != null && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {closing.sumTargets === 0 ? (
                  <span>Defina o alvo de cada etapa abaixo para distribuir o total.</span>
                ) : (
                  <>
                    <span>Distribuído entre etapas:</span>
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
                  <TableHead>Etapa / Campanha</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead className="text-right">Planejado</TableHead>
                  <TableHead className="text-right">Orç. Diário (Atual)</TableHead>
                  <TableHead className="text-right">Projeção (As Is)</TableHead>
                  <TableHead className="text-right">Investido</TableHead>
                  <TableHead className="text-right">% Atingido</TableHead>
                  <TableHead className="text-right">Ajuste/dia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {STAGE_ORDER.map((stage) => <Fragment key={stage}>{renderStageGroup(stage)}</Fragment>)}

                {semEtapaRows.length > 0 && (
                  <>
                    <TableRow className="bg-muted font-bold" data-testid="stage-header-none">
                      <TableCell colSpan={3} className="py-2.5">
                        <span className="uppercase tracking-wide text-sm text-muted-foreground">Sem etapa</span>
                        <span className="opacity-50 text-xs font-normal"> ({semEtapaRows.length})</span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">—</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(sumStage(semEtapaRows).daily)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(sumStage(semEtapaRows).projecao)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(sumStage(semEtapaRows).investido)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">—</TableCell>
                      <TableCell className="text-right text-muted-foreground">—</TableCell>
                    </TableRow>
                    {renderPlatformBlocks(semEtapaRows, "none")}
                  </>
                )}

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
      </>
      )}
    </div>
  );
}
