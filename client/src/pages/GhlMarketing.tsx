import { useState, useMemo } from "react";
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
import { Mail, MessageCircle, Tag as TagIcon, Loader2, AlertCircle, TrendingUp, TrendingDown, Activity, BarChart2 } from "lucide-react";
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
      </Tabs>
    </div>
  );
}
