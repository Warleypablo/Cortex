/**
 * Aba "Funil" do CRM Marketing (read-only).
 *
 * Mostra, pra um disparo de WhatsApp selecionado, o funil lead-a-lead:
 *   enviadas → responderam (positiva/negativa/neutra/opt-out) → reunião marcada
 *   → compareceu → venda
 * e a tabela de respondedores com identidade (nome, empresa, telefone, e-mail),
 * sentimento, etapa atual no Bitrix e link direto pro card.
 *
 * Dados: GET /api/ghl/broadcasts (seletor) + /:id/funnel + /:id/leads.
 * As etapas reunião/comparecimento/venda vêm live do Bitrix (crm_deal).
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Domínio do Bitrix da Turbo (pra deep-link no card do deal).
const BITRIX_BASE = "https://turbopartners.bitrix24.com.br";

const fmtInt = (n: number | null | undefined) => (n ?? 0).toLocaleString("pt-BR");
const fmtPct = (num: number, den: number) => (den > 0 ? `${((num / den) * 100).toFixed(1)}%` : "—");
const fmtBRL = (n: number | string | null | undefined) => {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (v == null || isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
};

function fetchJson<T>(url: string): Promise<T> {
  return fetch(url, { credentials: "include" }).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json() as Promise<T>;
  });
}

interface BroadcastRow {
  id: string;
  channel: "Email" | "WhatsApp";
  date: string | null;
  preview: string | null;
  list_size: number;
}

interface Funnel {
  enviadas: number;
  responderam: number;
  positivas: number;
  negativas: number;
  neutras: number;
  opt_out: number;
  reuniao_marcada: number;
  compareceu: number;
  venda: number;
}

interface LeadRow {
  reply_message_id: string;
  lead_phone: string | null;
  sentiment: "positiva" | "negativa" | "neutra" | "opt_out" | null;
  sentiment_motivo: string | null;
  reply_body: string | null;
  reply_at: string | null;
  bitrix_deal_id: number | null;
  nome: string | null;
  empresa: string | null;
  email: string | null;
  stage_name: string | null;
  data_reuniao_agendada: string | null;
  data_reuniao_realizada: string | null;
  data_fechamento: string | null;
  valor_recorrente: string | null;
  valor_pontual: string | null;
  n_respostas: number;
}

/** Uma data Bitrix (YYYY-MM-DD) é causada pelo broadcast se for >= dia da resposta. */
function posResposta(dataBitrix: string | null, replyAt: string | null): boolean {
  if (!dataBitrix || !replyAt) return false;
  return dataBitrix.slice(0, 10) >= replyAt.slice(0, 10);
}

const SENTIMENT_BADGE: Record<string, string> = {
  positiva: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  negativa: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  neutra: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  opt_out: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
};
const SENTIMENT_LABEL: Record<string, string> = {
  positiva: "Positiva",
  negativa: "Negativa",
  neutra: "Neutra",
  opt_out: "Opt-out",
};

/**
 * Etapa do funil Bitrix. Só atribui a etapa ao broadcast se ela ocorreu APÓS a resposta
 * (causalidade). Deal que já estava nessa etapa antes do disparo aparece, mas marcado como
 * "pré-broadcast" (não atribuído) — não infla o funil.
 */
function etapaBitrix(l: LeadRow): { label: string; tone: string; atribuido: boolean } {
  const muted = "text-muted-foreground";
  if (l.stage_name === "Negócio Ganho") {
    const ok = posResposta(l.data_fechamento, l.reply_at);
    return { label: ok ? "Venda" : "Venda (pré-broadcast)", tone: ok ? "text-emerald-600 dark:text-emerald-400" : muted, atribuido: ok };
  }
  if (l.data_reuniao_realizada) {
    const ok = posResposta(l.data_reuniao_realizada, l.reply_at);
    return { label: ok ? "Compareceu" : "Compareceu (pré-broadcast)", tone: ok ? "text-blue-600 dark:text-blue-400" : muted, atribuido: ok };
  }
  if (l.data_reuniao_agendada) {
    const ok = posResposta(l.data_reuniao_agendada, l.reply_at);
    return { label: ok ? "Reunião marcada" : "Reunião marcada (pré-broadcast)", tone: ok ? "text-violet-600 dark:text-violet-400" : muted, atribuido: ok };
  }
  if (l.bitrix_deal_id) return { label: l.stage_name || "No Bitrix", tone: muted, atribuido: false };
  return { label: "Sem deal", tone: "text-muted-foreground/60", atribuido: false };
}

function FunnelBar({
  label,
  value,
  base,
  prev,
  color,
  onClick,
  active,
}: {
  label: string;
  value: number;
  base: number; // pra largura (geralmente "enviadas")
  prev?: number; // pra % de conversão da etapa anterior
  color: string;
  onClick?: () => void; // drill-down: filtra a lista de respondedores (review #6)
  active?: boolean;
}) {
  const widthPct = base > 0 ? Math.max(2, (value / base) * 100) : 0;
  const clickable = !!onClick && value > 0;
  return (
    <div
      className={`space-y-1 rounded px-1 -mx-1 ${clickable ? "cursor-pointer hover:bg-muted/40" : ""} ${active ? "ring-2 ring-primary/60 bg-muted/40" : ""}`}
      onClick={clickable ? onClick : undefined}
      title={clickable ? "Clique pra ver quem compõe este número" : undefined}
    >
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}{clickable && <span className="ml-1 text-[10px] text-muted-foreground align-middle">›</span>}</span>
        <span className="text-muted-foreground">
          <strong className="text-foreground">{fmtInt(value)}</strong>
          {prev !== undefined && <span className="ml-2 text-xs">({fmtPct(value, prev)} da etapa anterior)</span>}
        </span>
      </div>
      <div className="h-6 w-full rounded bg-muted/40 overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${widthPct}%` }} />
      </div>
    </div>
  );
}

// Drill-down: ao clicar numa etapa do funil / sentimento, filtra a lista de
// respondedores pra mostrar QUEM compõe aquele número (review #6, auditável — #4).
type Drill =
  | { kind: "sentiment"; value: string; label: string }
  | { kind: "reuniao"; label: string }
  | { kind: "compareceu"; label: string }
  | { kind: "venda"; label: string };

function matchDrill(l: LeadRow, d: Drill): boolean {
  switch (d.kind) {
    case "sentiment":
      return l.sentiment === d.value;
    case "reuniao":
      return !!l.data_reuniao_agendada && posResposta(l.data_reuniao_agendada, l.reply_at);
    case "compareceu":
      return !!l.data_reuniao_realizada && posResposta(l.data_reuniao_realizada, l.reply_at);
    case "venda":
      return l.stage_name === "Negócio Ganho" && posResposta(l.data_fechamento, l.reply_at);
  }
}

export default function FunilTab({ from, to }: { from: string; to: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drill, setDrill] = useState<Drill | null>(null);
  const toggleDrill = (d: Drill) =>
    setDrill((cur) => (cur && cur.kind === d.kind && (cur as any).value === (d as any).value ? null : d));

  const broadcasts = useQuery<{ broadcasts: BroadcastRow[] }>({
    queryKey: ["/api/ghl/broadcasts", "wa-funnel", from, to],
    queryFn: () =>
      fetchJson(`/api/ghl/broadcasts?channel=WhatsApp&status=complete&from=${from}&to=${to}&limit=100`),
  });

  const waBroadcasts = (broadcasts.data?.broadcasts ?? []).filter((b) => b.id.startsWith("wa-"));

  const funnel = useQuery<{ funnel: Funnel }>({
    queryKey: ["/api/ghl/broadcasts", selectedId, "funnel"],
    queryFn: () => fetchJson(`/api/ghl/broadcasts/${encodeURIComponent(selectedId!)}/funnel`),
    enabled: !!selectedId,
  });

  const leads = useQuery<{ leads: LeadRow[]; count: number }>({
    queryKey: ["/api/ghl/broadcasts", selectedId, "leads"],
    queryFn: () => fetchJson(`/api/ghl/broadcasts/${encodeURIComponent(selectedId!)}/leads`),
    enabled: !!selectedId,
  });

  const f = funnel.data?.funnel;
  const allLeads = leads.data?.leads ?? [];
  const shownLeads = drill ? allLeads.filter((l) => matchDrill(l, drill)) : allLeads;

  return (
    <div className="space-y-6">
      {/* Seletor de disparo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="w-4 h-4" /> Funil de respondedores por disparo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {broadcasts.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando disparos…
            </div>
          ) : waBroadcasts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum disparo de WhatsApp no período selecionado.
            </p>
          ) : (
            <Select value={selectedId ?? undefined} onValueChange={(v) => { setSelectedId(v); setDrill(null); }}>
              <SelectTrigger className="w-full md:w-[640px]">
                <SelectValue placeholder="Selecione um disparo de WhatsApp…" />
              </SelectTrigger>
              <SelectContent>
                {waBroadcasts.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.date ? format(new Date(b.date), "dd/MM/yy", { locale: ptBR }) : "—"} ·{" "}
                    {fmtInt(b.list_size)} envios · {(b.preview || "(sem texto)").slice(0, 70)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {!selectedId && (
        <p className="text-sm text-muted-foreground px-1">
          Selecione um disparo acima para ver o funil lead-a-lead até a venda no Bitrix.
        </p>
      )}

      {selectedId && (
        <>
          {/* Funil */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Funil</CardTitle>
            </CardHeader>
            <CardContent>
              {funnel.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Calculando atribuição…
                </div>
              ) : funnel.error ? (
                <p className="text-sm text-rose-600 dark:text-rose-400">Erro ao carregar o funil.</p>
              ) : f ? (
                <div className="space-y-4">
                  {/* Etapas até "Compareceu" são encadeadas (cada uma subconjunto da anterior).
                      "Venda" tem âncora própria de causalidade (data_fechamento >= resposta) e
                      NÃO exige reunião marcada/realizada no Bitrix — SDRs nem sempre preenchem
                      essas datas. Por isso o % de Venda usa reuniao_marcada como base apenas
                      como aproximação da etapa anterior (pode passar de 100% se houver venda
                      sem reunião registrada).
                      Positivas/negativas/neutras NÃO são degrau — são o detalhamento dos
                      respondedores, mostrado nos chips abaixo. */}
                  <FunnelBar label="Enviadas" value={f.enviadas} base={f.enviadas} color="bg-sky-500" />
                  <FunnelBar label="Responderam" value={f.responderam} base={f.enviadas} prev={f.enviadas} color="bg-cyan-500" />
                  <FunnelBar label="Reunião marcada" value={f.reuniao_marcada} base={f.enviadas} prev={f.responderam} color="bg-violet-500"
                    onClick={() => toggleDrill({ kind: "reuniao", label: "Reunião marcada" })} active={drill?.kind === "reuniao"} />
                  <FunnelBar label="Compareceu" value={f.compareceu} base={f.enviadas} prev={f.reuniao_marcada} color="bg-blue-500"
                    onClick={() => toggleDrill({ kind: "compareceu", label: "Compareceu" })} active={drill?.kind === "compareceu"} />
                  <FunnelBar label="Venda" value={f.venda} base={f.enviadas} prev={f.reuniao_marcada} color="bg-amber-500"
                    onClick={() => toggleDrill({ kind: "venda", label: "Venda (ganho)" })} active={drill?.kind === "venda"} />

                  <div className="pt-2">
                    <div className="text-xs text-muted-foreground mb-1">Detalhamento dos {fmtInt(f.responderam)} respondedores (por sentimento da 1ª resposta):</div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {([
                        { v: "positiva", label: "Positivas", n: f.positivas, cls: SENTIMENT_BADGE.positiva },
                        { v: "negativa", label: "Negativas", n: f.negativas, cls: SENTIMENT_BADGE.negativa },
                        { v: "neutra", label: "Neutras", n: f.neutras, cls: SENTIMENT_BADGE.neutra },
                        { v: "opt_out", label: "Opt-out", n: f.opt_out, cls: SENTIMENT_BADGE.opt_out },
                      ] as const).map((s) => (
                        <button key={s.v} type="button" onClick={() => toggleDrill({ kind: "sentiment", value: s.v, label: s.label })} title="Clique pra ver quem compõe este número">
                          <Badge variant="outline" className={`${s.cls} cursor-pointer ${drill?.kind === "sentiment" && drill.value === s.v ? "ring-2 ring-primary/60" : ""}`}>
                            {s.label} {fmtInt(s.n)}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Respondedores lead-a-lead */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Respondedores {leads.data?.count ? `(${leads.data.count})` : ""}
              </CardTitle>
              {drill && (
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span className="rounded bg-primary/10 text-primary px-2 py-0.5 font-medium">
                    Filtrando por: {drill.label} — {fmtInt(shownLeads.length)} de {fmtInt(allLeads.length)}
                  </span>
                  <button type="button" onClick={() => setDrill(null)} className="text-muted-foreground hover:text-foreground underline">
                    limpar filtro
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {leads.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando respondedores…
                </div>
              ) : allLeads.length === 0 ? (
                <p className="text-sm text-muted-foreground p-6">Nenhuma resposta atribuída a este disparo ainda.</p>
              ) : shownLeads.length === 0 ? (
                <p className="text-sm text-muted-foreground p-6">Nenhum respondedor compõe "{drill?.label}" neste disparo.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lead</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Resposta</TableHead>
                        <TableHead>Sentimento</TableHead>
                        <TableHead>Etapa Bitrix</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shownLeads.map((l) => {
                        const etapa = etapaBitrix(l);
                        const venda = l.stage_name === "Negócio Ganho" && etapa.atribuido;
                        const valor = venda ? fmtBRL(l.valor_recorrente || l.valor_pontual) : null;
                        return (
                          <TableRow key={l.reply_message_id} className="hover:bg-muted/30">
                            <TableCell className="align-top py-3">
                              <div className="font-medium">{l.nome || "—"}</div>
                              {l.empresa && <div className="text-xs text-muted-foreground">{l.empresa}</div>}
                            </TableCell>
                            <TableCell className="align-top py-3 text-sm text-muted-foreground tabular-nums whitespace-nowrap">{l.lead_phone || "—"}</TableCell>
                            <TableCell className="align-top py-3 max-w-[340px]">
                              <span className="text-sm line-clamp-2" title={l.reply_body || ""}>{l.reply_body || "—"}</span>
                              {l.n_respostas > 1 && (
                                <span className="ml-1 align-middle text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground" title="follow-ups dessa pessoa neste disparo">
                                  +{l.n_respostas - 1}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="align-top py-3">
                              {l.sentiment ? (
                                <Badge variant="outline" className={SENTIMENT_BADGE[l.sentiment]} title={l.sentiment_motivo || ""}>
                                  {SENTIMENT_LABEL[l.sentiment]}
                                </Badge>
                              ) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="align-top py-3">
                              <span className={`text-sm ${etapa.tone}`}>{etapa.label}</span>
                              {valor && <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{valor}</div>}
                            </TableCell>
                            <TableCell className="align-top py-3 text-right">
                              {l.bitrix_deal_id ? (
                                <a
                                  href={`${BITRIX_BASE}/crm/deal/details/${l.bitrix_deal_id}/`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center text-muted-foreground hover:text-primary"
                                  title="Abrir card no Bitrix"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
