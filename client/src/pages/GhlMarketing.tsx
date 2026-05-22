import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePageTitle } from "@/hooks/use-page-title";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Mail, MessageCircle, Tag as TagIcon, Loader2, AlertCircle, TrendingUp, TrendingDown, Activity, BarChart2, BookOpen, Search, X, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Sparkles, Wand2, ShieldCheck, ShieldAlert, ShieldX, Copy, Check } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths } from "date-fns";
import { BASES_DISPONIVEIS } from "@shared/ghl-broadcast/base-tag-map";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend, ScatterChart, Scatter, ZAxis, Cell } from "recharts";
import { avaliarPerformance, CLASSIFICACAO_TAILWIND, CLASSIFICACAO_LABEL, BENCHMARKS_TURBO, type Classificacao } from "@shared/ghl-broadcast/benchmarks";

// ────────────────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────────────────

interface CampaignRow {
  id: string;
  name: string | null;
  subject: string | null;
  campaign_type: string | null;
  status: string | null;
  total_count: number | null;
  success_count: number | null;
  failed_count: number | null;
  processed_count: number | null;
  scheduled_at: string | null;
  date_added: string | null;
  has_tracking: boolean | null;
  delivered_events: number;
  opened_events: number;
  unique_opens: number;
  clicked_events: number;
  unique_clicks: number;
  bounced_events: number;
  unsubscribed_events: number;
  complained_events: number;
}

interface WhatsappDaily {
  day: string;
  sent: number;
  received: number;
  unique_outbound_contacts: number;
  unique_inbound_contacts: number;
}

interface TagRow {
  tag: string;
  current_count: number;
  week_ago_count: number;
  delta_7d: number;
}

// ────────────────────────────────────────────────────────────────────────
// Utils
// ────────────────────────────────────────────────────────────────────────

const fmtInt = (n: number | null | undefined) => (n ?? 0).toLocaleString("pt-BR");
const fmtPct = (num: number, den: number) =>
  den > 0 ? `${((num / den) * 100).toFixed(1)}%` : "—";

function fetchJson<T>(url: string): Promise<T> {
  return fetch(url, { credentials: "include" }).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json() as Promise<T>;
  });
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Tab: Email
// ────────────────────────────────────────────────────────────────────────

function EmailTab({ from, to }: { from: string; to: string }) {
  const { data, isLoading, error } = useQuery<{ campaigns: CampaignRow[]; count: number }>({
    queryKey: ["/api/ghl/email-campaigns", from, to],
    queryFn: () => fetchJson(`/api/ghl/email-campaigns?from=${from}&to=${to}`),
  });

  const totals = useMemo(() => {
    const rows = data?.campaigns ?? [];
    return rows.reduce(
      (acc, c) => {
        acc.total += c.total_count ?? 0;
        acc.success += c.success_count ?? 0;
        acc.failed += c.failed_count ?? 0;
        acc.opened += c.unique_opens ?? 0;
        acc.clicked += c.unique_clicks ?? 0;
        acc.bounced += c.bounced_events ?? 0;
        acc.unsubscribed += c.unsubscribed_events ?? 0;
        return acc;
      },
      { total: 0, success: 0, failed: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 },
    );
  }, [data]);

  const hasWebhookData = (data?.campaigns ?? []).some((c) => c.opened_events > 0 || c.clicked_events > 0);

  if (isLoading) return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Carregando campanhas...</div>;
  if (error) return <div className="text-destructive">Erro: {(error as Error).message}</div>;

  return (
    <div className="space-y-6">
      {!hasWebhookData && (
        <Card className="border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20">
          <CardContent className="pt-6 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <div className="font-medium">Open/Click Rate ainda não disponível</div>
              <div className="mt-1 text-muted-foreground">
                Esses dados chegam por webhook do GHL e ainda não foram configurados. Por ora, só Taxa de Entrega e Bounce estão disponíveis. Veja <code className="text-xs">docs/handover-ghl-integracao.md</code> §8.1.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total enviado" value={fmtInt(totals.total)} />
        <StatCard label="Entregue (success)" value={fmtInt(totals.success)} hint={`Taxa: ${fmtPct(totals.success, totals.total)}`} />
        <StatCard label="Falhou" value={fmtInt(totals.failed)} hint={`Taxa: ${fmtPct(totals.failed, totals.total)}`} />
        <StatCard
          label="Open rate (único)"
          value={hasWebhookData ? fmtPct(totals.opened, totals.success) : "—"}
          hint={hasWebhookData ? `${fmtInt(totals.opened)} abriram` : "Aguarda webhook"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campanhas no período ({data?.count ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Enviado</TableHead>
                  <TableHead className="text-right">Entregue</TableHead>
                  <TableHead className="text-right">Falhou</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                  <TableHead className="text-right">Click</TableHead>
                  <TableHead className="text-right">Bounce</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.campaigns ?? []).map((c) => {
                  const date = c.scheduled_at || c.date_added;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {date ? format(new Date(date), "dd/MM/yy", { locale: ptBR }) : "—"}
                      </TableCell>
                      <TableCell className="max-w-md truncate" title={c.name ?? ""}>{c.name ?? "—"}</TableCell>
                      <TableCell className="text-xs"><Badge variant="outline">{c.campaign_type ?? "—"}</Badge></TableCell>
                      <TableCell className="text-right">{fmtInt(c.total_count)}</TableCell>
                      <TableCell className="text-right">
                        {fmtInt(c.success_count)} <span className="text-xs text-muted-foreground">({fmtPct(c.success_count ?? 0, c.total_count ?? 0)})</span>
                      </TableCell>
                      <TableCell className="text-right text-rose-600 dark:text-rose-400">{fmtInt(c.failed_count)}</TableCell>
                      <TableCell className="text-right">{c.unique_opens > 0 ? `${fmtInt(c.unique_opens)} (${fmtPct(c.unique_opens, c.success_count ?? 0)})` : "—"}</TableCell>
                      <TableCell className="text-right">{c.unique_clicks > 0 ? `${fmtInt(c.unique_clicks)} (${fmtPct(c.unique_clicks, c.success_count ?? 0)})` : "—"}</TableCell>
                      <TableCell className="text-right">{c.bounced_events > 0 ? fmtInt(c.bounced_events) : "—"}</TableCell>
                    </TableRow>
                  );
                })}
                {(data?.campaigns ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Nenhuma campanha no período</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Tab: WhatsApp
// ────────────────────────────────────────────────────────────────────────

function WhatsappTab({ from, to }: { from: string; to: string }) {
  const [source, setSource] = useState<"marketing" | "all">("marketing");

  const { data, isLoading, error } = useQuery<{
    daily: WhatsappDaily[];
    totals: { sent_total: number; received_total: number; unique_outbound_total: number; unique_inbound_total: number; sources_used: number };
    bySource: Array<{ source: string | null; direction: string; n: number }>;
    sourceFilter: string;
  }>({
    queryKey: ["/api/ghl/whatsapp-metrics", from, to, source],
    queryFn: () => fetchJson(`/api/ghl/whatsapp-metrics?from=${from}&to=${to}&source=${source}`),
  });

  if (isLoading) return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Carregando WhatsApp...</div>;
  if (error) return <div className="text-destructive">Erro: {(error as Error).message}</div>;

  const t = data?.totals ?? { sent_total: 0, received_total: 0, unique_outbound_total: 0, unique_inbound_total: 0, sources_used: 0 };
  const responseRate = t.sent_total > 0 ? fmtPct(t.received_total, t.sent_total) : "—";

  const chartData = (data?.daily ?? []).map((d) => ({
    day: format(new Date(d.day), "dd/MM", { locale: ptBR }),
    Enviadas: d.sent,
    Recebidas: d.received,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Label htmlFor="wa-source" className="text-sm">Fonte:</Label>
        <Select value={source} onValueChange={(v) => setSource(v as any)}>
          <SelectTrigger id="wa-source" className="w-[260px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="marketing">Marketing (workflow + bulk + campaign)</SelectItem>
            <SelectItem value="all">Todas (inclui SDR/atendimento)</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground">
          Open rate / Read rate exigem webhook do GHL (ainda não configurado).
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Enviadas" value={fmtInt(t.sent_total)} hint={`${fmtInt(t.unique_outbound_total)} contatos únicos`} />
        <StatCard label="Recebidas" value={fmtInt(t.received_total)} hint={`${fmtInt(t.unique_inbound_total)} contatos únicos`} />
        <StatCard label="Response rate" value={responseRate} hint="Recebidas / Enviadas" />
        <StatCard label="Sources distintas" value={fmtInt(t.sources_used)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Volume diário</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="day" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Enviadas" fill="#2563eb" />
                <Bar dataKey="Recebidas" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Breakdown por origem</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Direção</TableHead>
                <TableHead className="text-right">Mensagens</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.bySource ?? []).map((r, i) => (
                <TableRow key={i}>
                  <TableCell><Badge variant="outline">{r.source ?? "(null)"}</Badge></TableCell>
                  <TableCell>{r.direction}</TableCell>
                  <TableCell className="text-right">{fmtInt(r.n)}</TableCell>
                </TableRow>
              ))}
              {(data?.bySource ?? []).length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Sem mensagens no período</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Tab: Tags
// ────────────────────────────────────────────────────────────────────────

function TagsTab() {
  const { data, isLoading, error } = useQuery<{ tags: TagRow[] }>({
    queryKey: ["/api/ghl/tags"],
    queryFn: () => fetchJson("/api/ghl/tags?limit=100"),
  });

  if (isLoading) return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Carregando tags...</div>;
  if (error) return <div className="text-destructive">Erro: {(error as Error).message}</div>;

  const rows = data?.tags ?? [];
  const top20 = rows.slice(0, 20);
  const chartData = top20.map((t) => ({ tag: t.tag.length > 25 ? t.tag.slice(0, 23) + "…" : t.tag, contatos: t.current_count }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 20 tags por contatos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 180 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="tag" width={180} fontSize={10} interval={0} />
                <Tooltip />
                <Bar dataKey="contatos" fill="#7c3aed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Todas as tags ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tag</TableHead>
                <TableHead className="text-right">Contatos</TableHead>
                <TableHead className="text-right">7 dias atrás</TableHead>
                <TableHead className="text-right">Δ 7d</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.tag}>
                  <TableCell className="font-mono text-xs">{r.tag}</TableCell>
                  <TableCell className="text-right">{fmtInt(r.current_count)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{r.week_ago_count > 0 ? fmtInt(r.week_ago_count) : "—"}</TableCell>
                  <TableCell className="text-right">
                    {r.delta_7d === 0 || r.week_ago_count === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : r.delta_7d > 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> +{fmtInt(r.delta_7d)}
                      </span>
                    ) : (
                      <span className="text-rose-600 dark:text-rose-400 inline-flex items-center gap-1">
                        <TrendingDown className="w-3 h-3" /> {fmtInt(r.delta_7d)}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Tab: Diagnóstico (benchmarks Turbo + scoring por base)
// ────────────────────────────────────────────────────────────────────────

interface BasePerformance {
  base: string;
  contacts: number;
  wa_sent: number;
  wa_received: number;
  email_sent: number;
  wa_contacts_reached: number;
  error?: string;
}

function DiagnosticoTab({ from, to }: { from: string; to: string }) {
  const { data, isLoading, error } = useQuery<{ bases: BasePerformance[] }>({
    queryKey: ["/api/ghl/diagnostico", from, to],
    queryFn: () => fetchJson(`/api/ghl/diagnostico?from=${from}&to=${to}`),
  });

  const rows = useMemo(() => {
    const bases = data?.bases ?? [];
    return bases.map((b) => {
      const responseRate = b.wa_sent > 0 ? (b.wa_received / b.wa_sent) * 100 : 0;
      // WA proxy: % de contatos da base que receberam pelo menos 1 mensagem outbound
      const reachRate = b.contacts > 0 ? (b.wa_contacts_reached / b.contacts) * 100 : 0;
      const avalResponse = avaliarPerformance(responseRate, b.base, "wpp"); // wpp benchmark é p/ open, mas serve como referência
      return { ...b, responseRate, reachRate, classificacao: avalResponse.classificacao, benchmark: avalResponse.benchmark, delta: avalResponse.delta };
    });
  }, [data]);

  const top = useMemo(() => [...rows].filter((r) => r.wa_sent > 0).sort((a, b) => b.responseRate - a.responseRate), [rows]);
  const scatterData = top.map((r) => ({ base: r.base, x: r.wa_sent, y: r.responseRate, classificacao: r.classificacao, contacts: r.contacts }));

  // Insights automáticos
  const insights = useMemo(() => {
    const list: { tone: "good" | "warn" | "bad"; msg: string }[] = [];
    const excelentes = top.filter((r) => r.classificacao === "excelente");
    const alertas = top.filter((r) => r.classificacao === "alerta");
    if (excelentes.length > 0) {
      list.push({
        tone: "good",
        msg: `${excelentes.length} base(s) com response rate excelente: ${excelentes.slice(0, 3).map((r) => `${r.base} (${r.responseRate.toFixed(1)}%)`).join(", ")}`,
      });
    }
    if (alertas.length > 0) {
      list.push({
        tone: "bad",
        msg: `${alertas.length} base(s) em alerta — response rate abaixo do esperado: ${alertas.slice(0, 3).map((r) => r.base).join(", ")}`,
      });
    }
    const total = rows.reduce((s, r) => s + r.wa_sent, 0);
    if (total === 0) {
      list.push({ tone: "warn", msg: "Nenhum envio de WhatsApp no período. Verifique o filtro de datas." });
    }
    return list;
  }, [rows, top]);

  if (isLoading) return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Carregando diagnóstico (pode demorar uns 10-20s, são 18 bases)...</div>;
  if (error) return <div className="text-destructive">Erro: {(error as Error).message}</div>;

  return (
    <div className="space-y-6">
      <Card className="border-blue-500/40 bg-blue-50/40 dark:bg-blue-950/20">
        <CardContent className="pt-6 flex gap-3">
          <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <div className="font-medium">Como ler este diagnóstico</div>
            <div className="mt-1 text-muted-foreground">
              Métricas comparadas contra benchmarks internos Turbo (não média de mercado). Sem webhook do GHL, "abertura" e "leitura" não estão disponíveis ainda — usamos <strong>response rate</strong> (inbound/outbound) como proxy de engajamento.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Insights automáticos */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Insights automáticos</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {insights.map((i, idx) => (
                <li key={idx} className={cn("text-sm flex gap-2",
                  i.tone === "good" && "text-emerald-700 dark:text-emerald-400",
                  i.tone === "warn" && "text-amber-700 dark:text-amber-400",
                  i.tone === "bad" && "text-rose-700 dark:text-rose-400",
                )}>
                  <span>{i.tone === "good" ? "✓" : i.tone === "warn" ? "⚠" : "✗"}</span>
                  <span>{i.msg}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Scatter: volume × response rate */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance por base — volume vs response rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" dataKey="x" name="Volume enviado" fontSize={11} />
                <YAxis type="number" dataKey="y" name="Response rate %" unit="%" fontSize={11} />
                <ZAxis dataKey="contacts" range={[60, 600]} name="Contatos" />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v: any, n: string) => [typeof v === "number" ? v.toFixed(1) : v, n]} labelFormatter={(_, payload) => (payload && payload[0]) ? (payload[0].payload as any).base : ""} />
                <Scatter name="Bases" data={scatterData}>
                  {scatterData.map((entry, i) => {
                    const color = entry.classificacao === "excelente" ? "#10b981" : entry.classificacao === "bom" ? "#84cc16" : entry.classificacao === "medio" ? "#f59e0b" : "#ef4444";
                    return <Cell key={i} fill={color} />;
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Tamanho do ponto = contatos da base. Cores: verde = excelente, lime = bom, âmbar = médio, vermelho = alerta.
          </div>
        </CardContent>
      </Card>

      {/* Tabela completa */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ranking de bases ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Base</TableHead>
                <TableHead className="text-right">Contatos</TableHead>
                <TableHead className="text-right">WA enviadas</TableHead>
                <TableHead className="text-right">WA recebidas</TableHead>
                <TableHead className="text-right">Response rate</TableHead>
                <TableHead className="text-right">Benchmark</TableHead>
                <TableHead className="text-right">Email enviadas</TableHead>
                <TableHead>Classificação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.sort((a, b) => b.wa_sent - a.wa_sent).map((r) => {
                const cls = r.classificacao as Classificacao;
                const tw = CLASSIFICACAO_TAILWIND[cls];
                return (
                  <TableRow key={r.base}>
                    <TableCell className="font-medium">{r.base}</TableCell>
                    <TableCell className="text-right">{fmtInt(r.contacts)}</TableCell>
                    <TableCell className="text-right">{fmtInt(r.wa_sent)}</TableCell>
                    <TableCell className="text-right">{fmtInt(r.wa_received)}</TableCell>
                    <TableCell className="text-right font-semibold">{r.wa_sent > 0 ? `${r.responseRate.toFixed(1)}%` : "—"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.benchmark.toFixed(0)}%</TableCell>
                    <TableCell className="text-right">{fmtInt(r.email_sent)}</TableCell>
                    <TableCell>
                      {r.wa_sent > 0 ? (
                        <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs border", tw.bg, tw.text, tw.border)}>
                          {CLASSIFICACAO_LABEL[cls]}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Benchmarks Turbo (referência) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Benchmarks Turbo (referência)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium mb-1">WhatsApp — open rate esperado</div>
              <ul className="text-muted-foreground space-y-0.5 ml-3">
                <li>Premium (Clientes, Mix da Nata, SMTM): <strong>{BENCHMARKS_TURBO.wpp.premium}%</strong></li>
                <li>MQLs (Geral, Creators, CRM): <strong>{BENCHMARKS_TURBO.wpp.mql}%</strong></li>
                <li>Congelados: <strong>{BENCHMARKS_TURBO.wpp.congelados}%</strong></li>
                <li>Leads 30-100k: <strong>{BENCHMARKS_TURBO.wpp.leads_30_100k}%</strong></li>
                <li>Leads &lt;30k: <strong>{BENCHMARKS_TURBO.wpp.leads_abaixo_30k}%</strong></li>
              </ul>
            </div>
            <div>
              <div className="font-medium mb-1">Reply rate</div>
              <ul className="text-muted-foreground space-y-0.5 ml-3">
                <li>Excelente: ≥ <strong>{BENCHMARKS_TURBO.replyRate.excelente}%</strong></li>
                <li>Bom: ≥ <strong>{BENCHMARKS_TURBO.replyRate.bom}%</strong></li>
                <li>Médio: ≥ <strong>{BENCHMARKS_TURBO.replyRate.medio}%</strong></li>
                <li>Alerta: &lt; {BENCHMARKS_TURBO.replyRate.alerta}%</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Tab: Biblioteca (histórico de mensagens com filtros)
// ────────────────────────────────────────────────────────────────────────

interface MessageRow {
  id: string;
  conversation_id: string;
  contact_id: string | null;
  direction: string;
  message_type: string;
  status: string;
  source: string | null;
  subject: string | null;
  email_message_id: string | null;
  date_added: string;
  body_preview: string;
  body_length: number;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_tags: string[] | null;
}

function BibliotecaTab({ from, to }: { from: string; to: string }) {
  const [channel, setChannel] = useState<string>("all");
  const [direction, setDirection] = useState<string>("outbound");
  const [source, setSource] = useState<string>("workflow,bulk");
  const [base, setBase] = useState<string>("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<MessageRow | null>(null);
  const limit = 50;

  // Reset page quando filtros mudam
  useEffect(() => { setPage(0); }, [channel, direction, source, base, search, from, to]);

  const params = new URLSearchParams({ from, to, channel, direction, source, limit: String(limit), offset: String(page * limit) });
  if (base) params.set("base", base);
  if (search) params.set("search", search);

  const { data, isLoading, error } = useQuery<{ messages: MessageRow[]; total: number }>({
    queryKey: ["/api/ghl/messages", params.toString()],
    queryFn: () => fetchJson(`/api/ghl/messages?${params.toString()}`),
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div>
            <Label className="text-xs">Canal</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="TYPE_WHATSAPP">WhatsApp</SelectItem>
                <SelectItem value="TYPE_EMAIL">Email</SelectItem>
                <SelectItem value="TYPE_SMS">SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Direção</Label>
            <Select value={direction} onValueChange={setDirection}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="outbound">Outbound (enviada)</SelectItem>
                <SelectItem value="inbound">Inbound (recebida)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Origem</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="workflow,bulk">Marketing (workflow + bulk)</SelectItem>
                <SelectItem value="workflow">Workflow só</SelectItem>
                <SelectItem value="bulk">Bulk só</SelectItem>
                <SelectItem value="manual">Manual (SDR/closer)</SelectItem>
                <SelectItem value="all">Todas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Base</Label>
            <Select value={base || "__none__"} onValueChange={(v) => setBase(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Todas as bases" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Todas as bases</SelectItem>
                {BASES_DISPONIVEIS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Busca</Label>
            <div className="flex gap-1">
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") setSearch(searchInput); }}
                placeholder="Texto da mensagem..."
                className="text-sm"
              />
              <button onClick={() => setSearch(searchInput)} className="px-2 hover:bg-muted rounded" title="Buscar">
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {isLoading && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>}
      {error && <div className="text-destructive">Erro: {(error as Error).message}</div>}

      {data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex justify-between items-baseline">
              <span>Mensagens ({fmtInt(data.total)})</span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2 text-sm font-normal">
                  <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-2 py-1 hover:bg-muted rounded disabled:opacity-30">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-muted-foreground">Página {page + 1} de {totalPages}</span>
                  <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-2 py-1 hover:bg-muted rounded disabled:opacity-30">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Preview</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.messages.map((m) => (
                    <TableRow key={m.id} onClick={() => setDetail(m)} className="cursor-pointer hover:bg-muted/40">
                      <TableCell className="text-xs whitespace-nowrap">{format(new Date(m.date_added), "dd/MM/yy HH:mm", { locale: ptBR })}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {m.message_type === "TYPE_WHATSAPP" ? "WA" : m.message_type === "TYPE_EMAIL" ? "Email" : m.message_type === "TYPE_SMS" ? "SMS" : m.message_type}
                          <span className={cn("ml-1", m.direction === "outbound" ? "text-blue-600" : "text-emerald-600")}>{m.direction === "outbound" ? "↑" : "↓"}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs"><Badge variant="outline">{m.source ?? "—"}</Badge></TableCell>
                      <TableCell className="max-w-[180px] truncate text-xs">
                        <div className="font-medium truncate">{m.contact_name ?? "—"}</div>
                        <div className="text-muted-foreground truncate">{m.contact_email ?? m.contact_phone ?? ""}</div>
                      </TableCell>
                      <TableCell className="max-w-md text-xs">
                        {m.subject && <div className="font-medium truncate">{m.subject}</div>}
                        <div className="truncate text-muted-foreground">{m.body_preview?.replace(/\s+/g, " ").slice(0, 120) || "—"}</div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.messages.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhuma mensagem encontrada com esses filtros</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de detalhes */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <Card className="max-w-3xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="flex flex-row justify-between items-start">
              <div>
                <CardTitle className="text-base">
                  {detail.subject || `Mensagem ${detail.message_type}`}
                </CardTitle>
                <div className="text-sm text-muted-foreground mt-1">
                  {format(new Date(detail.date_added), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })} · {detail.contact_name ?? "Sem nome"} · <Badge variant="outline">{detail.source ?? "—"}</Badge>
                </div>
              </div>
              <button onClick={() => setDetail(null)} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </CardHeader>
            <CardContent>
              <DetailLoader messageId={detail.id} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function DetailLoader({ messageId }: { messageId: string }) {
  const { data, isLoading } = useQuery<{ message: any }>({
    queryKey: ["/api/ghl/messages", messageId],
    queryFn: () => fetchJson(`/api/ghl/messages/${messageId}`),
  });
  if (isLoading) return <div className="flex items-center gap-2 text-muted-foreground py-4"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>;
  if (!data?.message) return <div className="text-muted-foreground py-4">Não foi possível carregar.</div>;
  const m = data.message;
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><span className="text-muted-foreground">Direção:</span> <strong>{m.direction}</strong></div>
        <div><span className="text-muted-foreground">Status:</span> <strong>{m.status}</strong></div>
        <div><span className="text-muted-foreground">Contato:</span> {m.contact_name ?? "—"}</div>
        <div><span className="text-muted-foreground">Email:</span> {m.contact_email ?? "—"}</div>
        <div><span className="text-muted-foreground">Phone:</span> {m.contact_phone ?? "—"}</div>
        <div><span className="text-muted-foreground">Source:</span> {m.source ?? "—"}</div>
        {m.email_message_id && <div className="col-span-2"><span className="text-muted-foreground">Email Msg ID:</span> <code className="text-xs">{m.email_message_id}</code></div>}
      </div>
      {m.contact_tags && m.contact_tags.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">Tags do contato:</div>
          <div className="flex flex-wrap gap-1">
            {m.contact_tags.slice(0, 15).map((t: string) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
            {m.contact_tags.length > 15 && <span className="text-xs text-muted-foreground">+{m.contact_tags.length - 15}</span>}
          </div>
        </div>
      )}
      <div className="border-t pt-3">
        <div className="text-xs text-muted-foreground mb-2">Conteúdo da mensagem:</div>
        {m.content_type === "text/html" ? (
          <iframe srcDoc={m.body || ""} sandbox="" className="w-full h-96 border rounded bg-white" title="Email content" />
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-sm bg-muted/40 p-3 rounded max-h-96 overflow-auto">{m.body || "(sem corpo)"}</pre>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Tab: Calendário Editorial
// ────────────────────────────────────────────────────────────────────────

type Broadcast =
  | {
      kind: "email_campaign";
      id: string;
      date: string;
      name: string | null;
      subject: string | null;
      campaign_type: string | null;
      status: string | null;
      total_count: number | null;
      success_count: number | null;
      failed_count: number | null;
    }
  | {
      kind: "wa_broadcast";
      id: string;
      date: string;
      source: string;
      messages: number;
      contacts_reached: number;
    };

function CalendarioTab() {
  // Calendário tem sua própria seleção de mês — não usa o range do header
  const [monthCursor, setMonthCursor] = useState(new Date());
  const monthStart = startOfMonth(monthCursor);
  const monthEnd = endOfMonth(monthCursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const apiFrom = format(monthStart, "yyyy-MM-dd");
  const apiTo = format(monthEnd, "yyyy-MM-dd");

  const { data, isLoading, error } = useQuery<{ broadcasts: Broadcast[]; counts: { email: number; whatsapp: number } }>({
    queryKey: ["/api/ghl/calendar", apiFrom, apiTo],
    queryFn: () => fetchJson(`/api/ghl/calendar?from=${apiFrom}&to=${apiTo}`),
  });

  // Index broadcasts por dia (chave YYYY-MM-DD)
  const broadcastsByDay = useMemo(() => {
    const map = new Map<string, Broadcast[]>();
    for (const b of data?.broadcasts ?? []) {
      const dayKey = format(new Date(b.date), "yyyy-MM-dd");
      const arr = map.get(dayKey) ?? [];
      arr.push(b);
      map.set(dayKey, arr);
    }
    return map;
  }, [data]);

  // Detecção retroativa de violação de cadência (mesmo "tipo de envio" 2× em 7 dias)
  const cadenceWarnings = useMemo(() => {
    const warnings = new Map<string, string[]>(); // dayKey → mensagens
    const dailyList = Array.from(broadcastsByDay.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (let i = 0; i < dailyList.length; i++) {
      const [dayKey, broadcasts] = dailyList[i];
      const dayDate = new Date(dayKey);
      const sevenDaysAgo = new Date(dayDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Procura outro dia com broadcast nos últimos 7 dias
      for (let j = 0; j < i; j++) {
        const [prevDay] = dailyList[j];
        const prevDate = new Date(prevDay);
        if (prevDate >= sevenDaysAgo) {
          const list = warnings.get(dayKey) ?? [];
          if (!list.length) {
            list.push(`Outro broadcast em ${format(prevDate, "dd/MM", { locale: ptBR })} (regra Turbo: mín 7 dias entre disparos)`);
          }
          warnings.set(dayKey, list);
          break;
        }
      }
    }
    return warnings;
  }, [broadcastsByDay]);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const selectedBroadcasts = selectedDay ? broadcastsByDay.get(selectedDay) ?? [] : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <CardTitle className="text-base capitalize">
            {format(monthCursor, "MMMM yyyy", { locale: ptBR })}
          </CardTitle>
          <div className="flex gap-2">
            <button onClick={() => setMonthCursor((m) => addMonths(m, -1))} className="px-3 py-1 hover:bg-muted rounded text-sm flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Mês anterior
            </button>
            <button onClick={() => setMonthCursor(new Date())} className="px-3 py-1 hover:bg-muted rounded text-sm">Hoje</button>
            <button onClick={() => setMonthCursor((m) => addMonths(m, 1))} className="px-3 py-1 hover:bg-muted rounded text-sm flex items-center gap-1">
              Próximo <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Carregando broadcasts...</div>}
          {error && <div className="text-destructive">Erro: {(error as Error).message}</div>}

          {data && (
            <>
              <div className="text-xs text-muted-foreground mb-3">
                {data.counts.email} broadcast(s) de email · {data.counts.whatsapp} broadcast(s) de WhatsApp detectados (dias com ≥30 mensagens outbound workflow/bulk/campaign)
              </div>

              {/* Grid 7 dias × 6 semanas */}
              <div className="grid grid-cols-7 gap-1 text-xs">
                {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
                  <div key={d} className="text-center font-medium text-muted-foreground py-1">{d}</div>
                ))}
                {days.map((d) => {
                  const dayKey = format(d, "yyyy-MM-dd");
                  const inMonth = isSameMonth(d, monthCursor);
                  const isToday = isSameDay(d, new Date());
                  const dayBroadcasts = broadcastsByDay.get(dayKey) ?? [];
                  const hasEmail = dayBroadcasts.some((b) => b.kind === "email_campaign");
                  const hasWa = dayBroadcasts.some((b) => b.kind === "wa_broadcast");
                  const warning = cadenceWarnings.get(dayKey);
                  return (
                    <button
                      key={dayKey}
                      onClick={() => dayBroadcasts.length > 0 && setSelectedDay(dayKey)}
                      disabled={dayBroadcasts.length === 0}
                      className={cn(
                        "border rounded p-2 min-h-[88px] text-left flex flex-col gap-1 transition-colors",
                        inMonth ? "bg-card" : "bg-muted/20 opacity-60",
                        isToday && "ring-2 ring-blue-500",
                        dayBroadcasts.length > 0 && "hover:bg-muted/40 cursor-pointer",
                        dayBroadcasts.length === 0 && "cursor-default",
                      )}
                      title={warning?.join(", ")}
                    >
                      <div className={cn("text-xs font-medium", isToday && "text-blue-600 dark:text-blue-400")}>{format(d, "d")}</div>
                      {dayBroadcasts.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-auto">
                          {hasEmail && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-blue-50 dark:bg-blue-950/40 border-blue-300">
                              <Mail className="w-2.5 h-2.5 mr-0.5" />
                              {dayBroadcasts.filter((b) => b.kind === "email_campaign").length}
                            </Badge>
                          )}
                          {hasWa && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300">
                              <MessageCircle className="w-2.5 h-2.5 mr-0.5" />
                              {dayBroadcasts.filter((b) => b.kind === "wa_broadcast").length}
                            </Badge>
                          )}
                          {warning && warning.length > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-700 dark:text-amber-300">
                              <AlertCircle className="w-2.5 h-2.5" />
                            </Badge>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalhes do dia */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelectedDay(null)}>
          <Card className="max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="flex flex-row justify-between items-start">
              <div>
                <CardTitle className="text-base">{format(new Date(selectedDay), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</CardTitle>
                <div className="text-sm text-muted-foreground mt-1">{selectedBroadcasts.length} broadcast(s) neste dia</div>
                {cadenceWarnings.get(selectedDay) && (
                  <div className="mt-2 text-xs text-amber-700 dark:text-amber-300 inline-flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {cadenceWarnings.get(selectedDay)!.join(", ")}
                  </div>
                )}
              </div>
              <button onClick={() => setSelectedDay(null)} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedBroadcasts.map((b) => (
                <div key={b.id} className="border rounded p-3">
                  {b.kind === "email_campaign" ? (
                    <div>
                      <div className="flex justify-between gap-3 items-start">
                        <div>
                          <Badge variant="outline" className="text-xs"><Mail className="w-3 h-3 mr-1" /> Email</Badge>
                          <div className="font-medium mt-1">{b.name ?? "Sem nome"}</div>
                          {b.subject && <div className="text-sm text-muted-foreground">{b.subject}</div>}
                        </div>
                        <Badge variant="outline" className="text-xs">{b.campaign_type ?? "—"}</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
                        <div><span className="text-muted-foreground">Enviado:</span> <strong>{fmtInt(b.total_count)}</strong></div>
                        <div><span className="text-muted-foreground">Entregue:</span> <strong>{fmtInt(b.success_count)}</strong> ({fmtPct(b.success_count ?? 0, b.total_count ?? 0)})</div>
                        <div><span className="text-muted-foreground">Falhou:</span> <strong>{fmtInt(b.failed_count)}</strong></div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between gap-3 items-start">
                        <div>
                          <Badge variant="outline" className="text-xs"><MessageCircle className="w-3 h-3 mr-1" /> WhatsApp</Badge>
                          <div className="font-medium mt-1">Broadcast detectado · source: <Badge variant="outline" className="ml-1 text-xs">{b.source}</Badge></div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                        <div><span className="text-muted-foreground">Mensagens:</span> <strong>{fmtInt(b.messages)}</strong></div>
                        <div><span className="text-muted-foreground">Contatos alcançados:</span> <strong>{fmtInt(b.contacts_reached)}</strong></div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Tab: Gerador IA (Claude API)
// ────────────────────────────────────────────────────────────────────────

interface AnaliseCopy {
  score_geral: number;
  veredicto: "Aprovado" | "Pode melhorar" | "Reescrever";
  criterios: Record<string, { pontos: number; max: number; feedback: string }>;
  pontos_fortes: string[];
  pontos_atencao: string[];
  sugestao_melhoria: string;
}

interface VariacaoCopy {
  titulo: string;
  padrao: string;
  copy: string;
  raciocinio: string;
}

function GeradorTab() {
  const [mode, setMode] = useState<"analisar" | "gerar">("analisar");

  // ── Modo Analisar ─────────────────────────────────────────────────
  const [texto, setTexto] = useState("");
  const [canal, setCanal] = useState<"WhatsApp" | "Email">("WhatsApp");

  const analyzeMut = useMutation<AnaliseCopy, Error, void>({
    mutationFn: async () => {
      const res = await fetch("/api/ghl/copy/analyze", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto, canal }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Erro");
      return res.json();
    },
  });

  // ── Modo Gerar ────────────────────────────────────────────────────
  const [objetivo, setObjetivo] = useState("Agendar reunião");
  const [base, setBase] = useState("Geral - MQLs");
  const [tom, setTom] = useState("Direto e provocativo");
  const [tamanho, setTamanho] = useState("Médio (400-800 caracteres)");
  const [contexto, setContexto] = useState("");
  const [padraoAlvo, setPadraoAlvo] = useState("");
  const [usarTop, setUsarTop] = useState(true);

  const generateMut = useMutation<{ variacoes: VariacaoCopy[] }, Error, void>({
    mutationFn: async () => {
      const res = await fetch("/api/ghl/copy/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objetivo, base, tom, tamanho, contexto, padraoAlvo: padraoAlvo || undefined, usarTopPerformers: usarTop }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Erro");
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setMode("analisar")} className={cn("px-4 py-2 rounded text-sm font-medium", mode === "analisar" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70")}>
          <ShieldCheck className="w-4 h-4 inline mr-1" /> Analisar uma copy
        </button>
        <button onClick={() => setMode("gerar")} className={cn("px-4 py-2 rounded text-sm font-medium", mode === "gerar" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70")}>
          <Wand2 className="w-4 h-4 inline mr-1" /> Gerar copies novas
        </button>
      </div>

      {mode === "analisar" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sua copy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Canal</Label>
                <Select value={canal} onValueChange={(v) => setCanal(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                    <SelectItem value="Email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Mensagem</Label>
                <Textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Cola aqui a copy que você quer avaliar..."
                  className="min-h-[260px] text-sm font-mono"
                />
                <div className="text-xs text-muted-foreground mt-1">{texto.length} caracteres</div>
              </div>
              <button
                onClick={() => analyzeMut.mutate()}
                disabled={!texto.trim() || analyzeMut.isPending}
                className="w-full bg-primary text-primary-foreground rounded px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {analyzeMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Analisar com IA
              </button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Análise</CardTitle>
            </CardHeader>
            <CardContent>
              {analyzeMut.isError && <div className="text-destructive text-sm">{analyzeMut.error.message}</div>}
              {!analyzeMut.data && !analyzeMut.isPending && (
                <div className="text-muted-foreground text-sm">Cole uma copy ao lado e clique em <strong>Analisar com IA</strong>.</div>
              )}
              {analyzeMut.data && (
                <div className="space-y-4">
                  <div className={cn("p-3 rounded border flex items-center gap-3",
                    analyzeMut.data.veredicto === "Aprovado" && "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30",
                    analyzeMut.data.veredicto === "Pode melhorar" && "border-amber-300 bg-amber-50 dark:bg-amber-950/30",
                    analyzeMut.data.veredicto === "Reescrever" && "border-rose-300 bg-rose-50 dark:bg-rose-950/30",
                  )}>
                    {analyzeMut.data.veredicto === "Aprovado" ? <ShieldCheck className="w-6 h-6 text-emerald-600" /> :
                     analyzeMut.data.veredicto === "Pode melhorar" ? <ShieldAlert className="w-6 h-6 text-amber-600" /> :
                     <ShieldX className="w-6 h-6 text-rose-600" />}
                    <div>
                      <div className="text-2xl font-bold">{analyzeMut.data.score_geral}<span className="text-base text-muted-foreground">/100</span></div>
                      <div className="text-sm">{analyzeMut.data.veredicto}</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium mb-1">Critérios</div>
                    <div className="space-y-1.5">
                      {Object.entries(analyzeMut.data.criterios).map(([k, v]) => (
                        <div key={k} className="text-xs">
                          <div className="flex justify-between">
                            <span className="capitalize">{k}</span>
                            <span><strong>{v.pontos}</strong>/{v.max}</span>
                          </div>
                          <div className="text-muted-foreground">{v.feedback}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {analyzeMut.data.pontos_fortes.length > 0 && (
                    <div>
                      <div className="text-xs font-medium mb-1 text-emerald-700 dark:text-emerald-400">Pontos fortes</div>
                      <ul className="text-xs text-muted-foreground list-disc ml-5">
                        {analyzeMut.data.pontos_fortes.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    </div>
                  )}

                  {analyzeMut.data.pontos_atencao.length > 0 && (
                    <div>
                      <div className="text-xs font-medium mb-1 text-amber-700 dark:text-amber-400">Atenção</div>
                      <ul className="text-xs text-muted-foreground list-disc ml-5">
                        {analyzeMut.data.pontos_atencao.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    </div>
                  )}

                  <div>
                    <div className="text-xs font-medium mb-1">Sugestão de melhoria</div>
                    <pre className="whitespace-pre-wrap text-xs bg-muted/40 p-3 rounded font-sans">{analyzeMut.data.sugestao_melhoria}</pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Briefing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Objetivo</Label>
                  <Select value={objetivo} onValueChange={setObjetivo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Agendar reunião">Agendar reunião</SelectItem>
                      <SelectItem value="Convite p/ evento">Convite p/ evento</SelectItem>
                      <SelectItem value="Nutrição">Nutrição</SelectItem>
                      <SelectItem value="Reativação">Reativação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Base-alvo</Label>
                  <Select value={base} onValueChange={setBase}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BASES_DISPONIVEIS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Tom</Label>
                  <Select value={tom} onValueChange={setTom}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Direto e provocativo">Direto e provocativo</SelectItem>
                      <SelectItem value="Consultivo e educativo">Consultivo e educativo</SelectItem>
                      <SelectItem value="Urgente e oportuno">Urgente e oportuno</SelectItem>
                      <SelectItem value="Empático e conversacional">Empático e conversacional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Tamanho</Label>
                  <Select value={tamanho} onValueChange={setTamanho}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Curto (até 400 caracteres)">Curto</SelectItem>
                      <SelectItem value="Médio (400-800 caracteres)">Médio</SelectItem>
                      <SelectItem value="Longo (800+ caracteres)">Longo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Padrão preferido (opcional)</Label>
                <Input value={padraoAlvo} onChange={(e) => setPadraoAlvo(e.target.value)} placeholder="ex: HOOK_PROVOCATIVO" />
              </div>
              <div>
                <Label className="text-xs">Contexto adicional (opcional)</Label>
                <Textarea value={contexto} onChange={(e) => setContexto(e.target.value)} placeholder="ex: Lançamento workshop dia 30/05, vagas limitadas" className="min-h-[80px] text-sm" />
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={usarTop} onChange={(e) => setUsarTop(e.target.checked)} className="rounded" />
                Usar como referência as 5 mensagens com mais respostas (últimos 90 dias)
              </label>
              <button
                onClick={() => generateMut.mutate()}
                disabled={generateMut.isPending}
                className="w-full bg-primary text-primary-foreground rounded px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {generateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                Gerar 3 variações
              </button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Variações geradas</CardTitle>
            </CardHeader>
            <CardContent>
              {generateMut.isError && <div className="text-destructive text-sm">{generateMut.error.message}</div>}
              {!generateMut.data && !generateMut.isPending && (
                <div className="text-muted-foreground text-sm">Preencha o briefing ao lado e clique em <strong>Gerar 3 variações</strong>. Demora ~10-20s.</div>
              )}
              {generateMut.isPending && (
                <div className="text-muted-foreground text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Gerando variações com Claude…</div>
              )}
              {generateMut.data && (
                <div className="space-y-3">
                  {generateMut.data.variacoes.map((v, i) => <VariacaoCard key={i} v={v} />)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function VariacaoCard({ v }: { v: VariacaoCopy }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="border rounded p-3 space-y-2">
      <div className="flex justify-between items-start gap-2">
        <div>
          <div className="font-medium text-sm">{v.titulo}</div>
          <Badge variant="outline" className="text-xs mt-0.5">{v.padrao}</Badge>
        </div>
        <button
          onClick={() => { navigator.clipboard.writeText(v.copy); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="p-1.5 hover:bg-muted rounded shrink-0"
          title="Copiar"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <pre className="whitespace-pre-wrap text-xs bg-muted/40 p-2 rounded font-sans">{v.copy}</pre>
      <div className="text-xs text-muted-foreground italic">{v.raciocinio}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────

export default function GhlMarketing() {
  usePageTitle("GHL Marketing");
  useSetPageInfo("GHL Marketing", "Email, WhatsApp e Tags do GoHighLevel");

  const [from, setFrom] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: overview } = useQuery<{ counts: any; lastSyncs: any[] }>({
    queryKey: ["/api/ghl/overview"],
    queryFn: () => fetchJson("/api/ghl/overview"),
  });

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div className="flex flex-col md:flex-row md:items-end gap-4 justify-between">
        <div className="flex gap-3 items-end">
          <div>
            <Label htmlFor="ghl-from" className="text-xs">De</Label>
            <Input id="ghl-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label htmlFor="ghl-to" className="text-xs">Até</Label>
            <Input id="ghl-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
        </div>
        {overview?.counts && (
          <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
            <span><strong>{fmtInt(overview.counts.contacts)}</strong> contatos</span>
            <span><strong>{fmtInt(overview.counts.conversations)}</strong> conversas</span>
            <span><strong>{fmtInt(overview.counts.messages)}</strong> mensagens</span>
            <span><strong>{fmtInt(overview.counts.email_campaigns)}</strong> campanhas</span>
            <span><strong>{fmtInt(overview.counts.tags)}</strong> tags</span>
            <span><strong>{fmtInt(overview.counts.email_events)}</strong> events</span>
          </div>
        )}
      </div>

      <Tabs defaultValue="email" className="w-full">
        <TabsList>
          <TabsTrigger value="email" data-testid="tab-email">
            <Mail className="w-4 h-4 mr-2" /> Email Marketing
          </TabsTrigger>
          <TabsTrigger value="whatsapp" data-testid="tab-whatsapp">
            <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp Marketing
          </TabsTrigger>
          <TabsTrigger value="tags" data-testid="tab-tags">
            <TagIcon className="w-4 h-4 mr-2" /> Tags
          </TabsTrigger>
          <TabsTrigger value="diagnostico" data-testid="tab-diagnostico">
            <BarChart2 className="w-4 h-4 mr-2" /> Diagnóstico
          </TabsTrigger>
          <TabsTrigger value="biblioteca" data-testid="tab-biblioteca">
            <BookOpen className="w-4 h-4 mr-2" /> Biblioteca
          </TabsTrigger>
          <TabsTrigger value="calendario" data-testid="tab-calendario">
            <CalendarIcon className="w-4 h-4 mr-2" /> Calendário
          </TabsTrigger>
          <TabsTrigger value="gerador" data-testid="tab-gerador">
            <Sparkles className="w-4 h-4 mr-2" /> Gerador IA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="mt-6">
          <EmailTab from={from} to={to} />
        </TabsContent>
        <TabsContent value="whatsapp" className="mt-6">
          <WhatsappTab from={from} to={to} />
        </TabsContent>
        <TabsContent value="tags" className="mt-6">
          <TagsTab />
        </TabsContent>
        <TabsContent value="diagnostico" className="mt-6">
          <DiagnosticoTab from={from} to={to} />
        </TabsContent>
        <TabsContent value="biblioteca" className="mt-6">
          <BibliotecaTab from={from} to={to} />
        </TabsContent>
        <TabsContent value="calendario" className="mt-6">
          <CalendarioTab />
        </TabsContent>
        <TabsContent value="gerador" className="mt-6">
          <GeradorTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
