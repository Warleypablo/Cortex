import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Target, Calendar, Facebook, Search as SearchIcon, Loader2 } from "lucide-react";
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

type Platform = "meta" | "google";

const SHOW_GOOGLE = true;

// Tags/grupos para classificar campanhas. Manter em sincronia com CAMPAIGN_TAGS
// no backend (server/routes/orcamentoCampanhas.ts).
type CampaignTag = "inbound" | "evento";
const TAG_OPTIONS: { value: CampaignTag; label: string }[] = [
  { value: "inbound", label: "Inbound" },
  { value: "evento", label: "Evento" },
];
const TAG_LABELS: Record<CampaignTag, string> = { inbound: "Inbound", evento: "Evento" };
const NO_TAG = "__none__"; // sentinela para "Sem tag" no Select (Radix não aceita value vazio)

// Abas de filtro no topo. "sem-tag" lista campanhas ainda não classificadas.
type TabValue = "todas" | CampaignTag | "sem-tag";
const TABS: { value: TabValue; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "inbound", label: "Inbound" },
  { value: "evento", label: "Evento" },
  { value: "sem-tag", label: "Sem tag" },
];

interface Campanha {
  platform: Platform;
  campaignId: string;
  name: string;
  status: string | null;
  dailyBudgetAtual: number;
  investidoTotal: number;
  investimentoMensalMeta: number | null;
  orcamentoDiarioMeta: number | null;
  projecaoAsIs: number;
  isDelivering: boolean;
  tag: CampaignTag | null;
}

interface ApiResponse {
  month: string;
  firstDay: string;
  lastDay: string;
  diasTotal: number;
  diasDecorridos: number;
  diasRestantes: number;
  campanhas: Campanha[];
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

function MetaInput({
  platform,
  campaignId,
  month,
  value,
  onSaved,
  canEdit,
}: {
  platform: Platform;
  campaignId: string;
  month: string;
  value: number | null;
  onSaved: () => void;
  canEdit: boolean;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = async () => {
    const parsed = parseNumberInput(draft);
    setEditing(false);
    if (parsed === (value ?? 0)) return;
    try {
      await apiRequest("PUT", "/api/growth/orcamento-campanhas/meta", {
        platform,
        campaignId,
        month,
        monthlyBudgetTarget: parsed,
      });
      onSaved();
    } catch (err) {
      toast({ title: "Erro ao salvar meta", description: String(err), variant: "destructive" });
    }
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        defaultValue={value !== null ? String(value) : ""}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft("");
            setEditing(false);
          }
        }}
        className="h-8 text-right font-mono"
        placeholder="0,00"
      />
    );
  }

  if (!canEdit) {
    return (
      <span className="block text-right font-mono px-1 py-1" data-testid={`meta-readonly-${platform}-${campaignId}`}>
        {value !== null ? formatCurrency(value) : <span className="text-muted-foreground">—</span>}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value !== null ? String(value) : "");
        setEditing(true);
      }}
      className="w-full text-right font-mono hover:bg-accent hover:text-accent-foreground rounded px-1 py-1 cursor-pointer transition-colors"
      data-testid={`input-meta-${platform}-${campaignId}`}
    >
      {value !== null ? formatCurrency(value) : <span className="text-muted-foreground italic">definir</span>}
    </button>
  );
}

function TagSelect({
  platform,
  campaignId,
  value,
  onSaved,
  canEdit,
}: {
  platform: Platform;
  campaignId: string;
  value: CampaignTag | null;
  onSaved: () => void;
  canEdit: boolean;
}) {
  const { toast } = useToast();

  if (!canEdit) {
    return value ? (
      <Badge variant="secondary" className="text-xs">{TAG_LABELS[value]}</Badge>
    ) : (
      <span className="text-muted-foreground text-xs">—</span>
    );
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
      <SelectTrigger
        className="h-7 w-[120px] text-xs"
        data-testid={`select-tag-${platform}-${campaignId}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_TAG}>
          <span className="text-muted-foreground">Sem tag</span>
        </SelectItem>
        {TAG_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface RowSums {
  daily: number;
  planejado: number;
  projecao: number;
  investido: number;
}

function sumRows(rows: Campanha[]): RowSums {
  let daily = 0;
  let planejado = 0;
  let projecao = 0;
  let investido = 0;
  for (const c of rows) {
    const isActive = c.status === "ACTIVE" || c.status === "ENABLED";
    daily += isActive ? c.dailyBudgetAtual : 0;
    planejado += c.investimentoMensalMeta ?? 0;
    projecao += c.projecaoAsIs;
    investido += c.investidoTotal;
  }
  return { daily, planejado, projecao, investido };
}

function PlatformIcon({ platform }: { platform: Platform }) {
  if (platform === "meta") return <Facebook className="w-4 h-4" />;
  return <SearchIcon className="w-4 h-4" />;
}

function variancePctColor(investido: number, meta: number | null): string {
  if (meta === null || meta === 0) return "";
  const pct = (investido / meta) * 100;
  if (pct >= 100) return "text-red-500 dark:text-red-400";
  if (pct >= 80) return "text-yellow-500 dark:text-yellow-400";
  return "text-green-600 dark:text-green-400";
}

// Cor da projeção comparada à meta mensal:
// vermelho se vai estourar (>105%), verde se vai ficar dentro/abaixo (<=100%),
// amarelo na zona de alerta entre 100-105%. Sem meta, sem cor.
function projecaoColor(projecao: number, meta: number | null): string {
  if (meta === null || meta === 0) return "";
  const pct = (projecao / meta) * 100;
  if (pct > 105) return "text-red-500 dark:text-red-400";
  if (pct > 100) return "text-yellow-500 dark:text-yellow-400";
  return "text-green-600 dark:text-green-400";
}

export default function GrowthOrcamentoCampanhas() {
  useSetPageInfo(
    "Orçamento por Campanha",
    SHOW_GOOGLE
      ? "Orçamento diário, investido e projeção por campanha — Meta + Google"
      : "Orçamento diário, investido e projeção por campanha — Meta Ads",
  );

  const { user } = useAuth();
  const canEditMeta = !!user?.email && ALLOWED_EDITOR_EMAILS.has(user.email);

  const queryClient = useQueryClient();
  const monthOptions = useMemo(() => getMonthOptions(), []);
  const defaultMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const [month, setMonth] = useState<string>(defaultMonth);
  const [activeTab, setActiveTab] = useState<TabValue>("todas");

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

  // Contagem por aba sobre TODAS as campanhas (independe da aba ativa).
  const tabCounts = useMemo(() => {
    const all = data?.campanhas ?? [];
    return {
      todas: all.length,
      inbound: all.filter((c) => c.tag === "inbound").length,
      evento: all.filter((c) => c.tag === "evento").length,
      "sem-tag": all.filter((c) => !c.tag).length,
    } as Record<TabValue, number>;
  }, [data]);

  // Campanhas filtradas pela aba ativa — alimenta tabela, subtotais e cards.
  const filteredCampanhas = useMemo(() => {
    const all = data?.campanhas ?? [];
    if (activeTab === "todas") return all;
    if (activeTab === "sem-tag") return all.filter((c) => !c.tag);
    return all.filter((c) => c.tag === activeTab);
  }, [data, activeTab]);

  const { metaRows, googleRows, totals } = useMemo(() => {
    const metaRows: Campanha[] = [];
    const googleRows: Campanha[] = [];
    for (const c of filteredCampanhas) {
      if (c.platform === "meta") metaRows.push(c);
      else if (SHOW_GOOGLE) googleRows.push(c);
      // Google escondido — não soma aos totais.
    }
    const allRows = SHOW_GOOGLE ? [...metaRows, ...googleRows] : metaRows;
    const s = sumRows(allRows);
    return {
      metaRows,
      googleRows,
      totals: {
        totalDaily: s.daily,
        totalPlanejado: s.planejado,
        totalProjecao: s.projecao,
        totalInvestido: s.investido,
      },
    };
  }, [filteredCampanhas]);

  const groupHeader = (label: string, color: string, count: number) => (
    <TableRow className={cn("font-semibold", color)}>
      <TableCell colSpan={7} className="py-2">
        <span className="uppercase tracking-wide text-xs">
          {label} <span className="opacity-60">({count})</span>
        </span>
      </TableCell>
    </TableRow>
  );

  const subtotalRow = (label: string, rows: Campanha[]) => {
    const s = sumRows(rows);
    return (
      <TableRow className="border-t-2 bg-muted/40 font-medium">
        <TableCell className="text-xs uppercase tracking-wide text-muted-foreground">
          Total {label}
        </TableCell>
        <TableCell />
        <TableCell className="text-right font-mono">{formatCurrency(s.planejado)}</TableCell>
        <TableCell className="text-right font-mono">{formatCurrency(s.daily)}</TableCell>
        <TableCell className={cn("text-right font-mono", projecaoColor(s.projecao, s.planejado || null))}>
          {formatCurrency(s.projecao)}
        </TableCell>
        <TableCell className="text-right font-mono">{formatCurrency(s.investido)}</TableCell>
        <TableCell className="text-right text-xs text-muted-foreground">
          {s.planejado > 0 ? `${((s.investido / s.planejado) * 100).toFixed(1)}%` : "—"}
        </TableCell>
      </TableRow>
    );
  };

  const renderRow = (c: Campanha) => (
    <TableRow key={`${c.platform}-${c.campaignId}`} data-testid={`row-${c.platform}-${c.campaignId}`}>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <PlatformIcon platform={c.platform} />
          <span className="truncate max-w-[360px]" title={c.name}>{c.name}</span>
          {c.status === "PAUSED" && <Badge variant="outline" className="text-xs">Pausada</Badge>}
          {c.status !== "PAUSED" && !c.isDelivering && (
            <Badge variant="outline" className="text-xs" title="Sem gasto nos últimos 3 dias — projeção não extrapola.">
              Sem entrega
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <TagSelect
          platform={c.platform}
          campaignId={c.campaignId}
          value={c.tag}
          onSaved={invalidate}
          canEdit={canEditMeta}
        />
      </TableCell>
      <TableCell className="text-right">
        <MetaInput
          platform={c.platform}
          campaignId={c.campaignId}
          month={month}
          value={c.investimentoMensalMeta}
          onSaved={invalidate}
          canEdit={canEditMeta}
        />
      </TableCell>
      <TableCell className="text-right font-mono">
        {c.status === "ACTIVE" || c.status === "ENABLED"
          ? formatCurrency(c.dailyBudgetAtual)
          : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className={cn("text-right font-mono", projecaoColor(c.projecaoAsIs, c.investimentoMensalMeta))}>
        {formatCurrency(c.projecaoAsIs)}
      </TableCell>
      <TableCell className={cn("text-right font-mono", variancePctColor(c.investidoTotal, c.investimentoMensalMeta))}>
        {formatCurrency(c.investidoTotal)}
      </TableCell>
      <TableCell className="text-right text-xs text-muted-foreground">
        {c.investimentoMensalMeta
          ? `${((c.investidoTotal / c.investimentoMensalMeta) * 100).toFixed(1)}%`
          : "—"}
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[200px]" data-testid="select-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
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

      {/* Abas de filtro por grupo. Cards e tabela abaixo refletem a aba ativa. */}
      <div className="flex items-center gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setActiveTab(t.value)}
            data-testid={`tab-${t.value}`}
            className={cn(
              "px-3 py-1.5 text-sm font-medium -mb-px border-b-2 transition-colors",
              activeTab === t.value
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            <span className="ml-1.5 text-xs opacity-60">{tabCounts[t.value]}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5" /> Investido Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{formatCurrency(totals.totalInvestido)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" /> Projeção (As Is)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{formatCurrency(totals.totalProjecao)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Target className="w-3.5 h-3.5" /> Planejado Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{formatCurrency(totals.totalPlanejado)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5" /> Orç. Diário Atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{formatCurrency(totals.totalDaily)}</div>
          </CardContent>
        </Card>
      </div>

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
                  <TableHead>Campanha</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead className="text-right">Investimento Planejado</TableHead>
                  <TableHead className="text-right">Orç. Diário (Atual)</TableHead>
                  <TableHead className="text-right">Projeção (As Is)</TableHead>
                  <TableHead className="text-right">Investido Total</TableHead>
                  <TableHead className="text-right">% Atingido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metaRows.length > 0 && groupHeader(
                  "Meta (Facebook e Instagram)",
                  "bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200",
                  metaRows.length,
                )}
                {metaRows.map(renderRow)}
                {metaRows.length > 0 && subtotalRow("Meta", metaRows)}

                {googleRows.length > 0 && groupHeader(
                  "Google Ads",
                  "bg-green-50 dark:bg-green-950/30 text-green-900 dark:text-green-200",
                  googleRows.length,
                )}
                {googleRows.map(renderRow)}
                {googleRows.length > 0 && subtotalRow("Google Ads", googleRows)}

                {metaRows.length === 0 && googleRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Nenhuma campanha nesta aba.
                    </TableCell>
                  </TableRow>
                )}

                <TableRow className="bg-amber-50 dark:bg-amber-950/30 font-semibold">
                  <TableCell>TOTAL</TableCell>
                  <TableCell />
                  <TableCell className="text-right font-mono">{formatCurrency(totals.totalPlanejado)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(totals.totalDaily)}</TableCell>
                  <TableCell className={cn("text-right font-mono", projecaoColor(totals.totalProjecao, totals.totalPlanejado || null))}>
                    {formatCurrency(totals.totalProjecao)}
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(totals.totalInvestido)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {totals.totalPlanejado > 0
                      ? `${((totals.totalInvestido / totals.totalPlanejado) * 100).toFixed(1)}%`
                      : "—"}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
