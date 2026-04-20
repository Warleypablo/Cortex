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

type Platform = "meta" | "google";

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
}: {
  platform: Platform;
  campaignId: string;
  month: string;
  value: number | null;
  onSaved: () => void;
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

export default function GrowthOrcamentoCampanhas() {
  useSetPageInfo(
    "Orçamento por Campanha",
    "Orçamento diário, investido e projeção por campanha — Meta + Google",
  );

  const queryClient = useQueryClient();
  const monthOptions = useMemo(() => getMonthOptions(), []);
  const defaultMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const [month, setMonth] = useState<string>(defaultMonth);

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

  const { metaRows, googleRows, totals } = useMemo(() => {
    const metaRows: Campanha[] = [];
    const googleRows: Campanha[] = [];
    let totalDaily = 0;
    let totalDailyMeta = 0;
    let totalMensalMeta = 0;
    let totalProjecao = 0;
    let totalInvestido = 0;
    for (const c of data?.campanhas ?? []) {
      if (c.platform === "meta") metaRows.push(c);
      else googleRows.push(c);
      totalDaily += c.dailyBudgetAtual;
      totalDailyMeta += c.orcamentoDiarioMeta ?? 0;
      totalMensalMeta += c.investimentoMensalMeta ?? 0;
      totalProjecao += c.projecaoAsIs;
      totalInvestido += c.investidoTotal;
    }
    return {
      metaRows,
      googleRows,
      totals: { totalDaily, totalDailyMeta, totalMensalMeta, totalProjecao, totalInvestido },
    };
  }, [data]);

  const groupHeader = (label: string, color: string, count: number) => (
    <TableRow className={cn("font-semibold", color)}>
      <TableCell colSpan={7} className="py-2">
        <span className="uppercase tracking-wide text-xs">
          {label} <span className="opacity-60">({count})</span>
        </span>
      </TableCell>
    </TableRow>
  );

  const renderRow = (c: Campanha) => (
    <TableRow key={`${c.platform}-${c.campaignId}`} data-testid={`row-${c.platform}-${c.campaignId}`}>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <PlatformIcon platform={c.platform} />
          <span className="truncate max-w-[360px]" title={c.name}>{c.name}</span>
          {c.status === "PAUSED" && <Badge variant="outline" className="text-xs">Pausada</Badge>}
        </div>
      </TableCell>
      <TableCell className="text-right font-mono">{formatCurrency(c.dailyBudgetAtual)}</TableCell>
      <TableCell className="text-right font-mono">
        {c.orcamentoDiarioMeta !== null ? formatCurrency(c.orcamentoDiarioMeta) : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="text-right">
        <MetaInput
          platform={c.platform}
          campaignId={c.campaignId}
          month={month}
          value={c.investimentoMensalMeta}
          onSaved={invalidate}
        />
      </TableCell>
      <TableCell className="text-right font-mono">{formatCurrency(c.projecaoAsIs)}</TableCell>
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
              <Target className="w-3.5 h-3.5" /> Meta Mensal Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{formatCurrency(totals.totalMensalMeta)}</div>
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
            <div className="text-xs text-muted-foreground mt-1">
              Meta p/ bater: <span className="font-mono">{formatCurrency(totals.totalDailyMeta)}</span>
            </div>
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
                  <TableHead className="text-right">Orç. Diário (Atual)</TableHead>
                  <TableHead className="text-right">Orç. Diário (Meta)</TableHead>
                  <TableHead className="text-right">Investimento Mensal (Meta)</TableHead>
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

                {googleRows.length > 0 && groupHeader(
                  "Google Ads",
                  "bg-green-50 dark:bg-green-950/30 text-green-900 dark:text-green-200",
                  googleRows.length,
                )}
                {googleRows.map(renderRow)}

                <TableRow className="bg-amber-50 dark:bg-amber-950/30 font-semibold">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(totals.totalDaily)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(totals.totalDailyMeta)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(totals.totalMensalMeta)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(totals.totalProjecao)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(totals.totalInvestido)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {totals.totalMensalMeta > 0
                      ? `${((totals.totalInvestido / totals.totalMensalMeta) * 100).toFixed(1)}%`
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
