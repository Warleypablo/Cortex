/**
 * Aba "Relatório" — retrospecto do período vs anterior + análise estratégica por IA.
 * Dados: GET /api/ghl/relatorio.
 */
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, Minus, Sparkles, Trophy, CalendarClock } from "lucide-react";

const fmtInt = (n: number | null | undefined) => (n ?? 0).toLocaleString("pt-BR");
const fmtBRL = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function fetchJson<T>(url: string): Promise<T> {
  return fetch(url, { credentials: "include" }).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json() as Promise<T>;
  });
}

type Metrics = { disparos: number; leads: number; abertura_pct: number | null; respostas: number; reunioes: number; vendas: number; gasto: number };
interface RelatorioData {
  atual: Metrics; anterior: Metrics;
  bases: Array<{ base: string; abertura_pct: number | null; reunioes: number; vendas: number }>;
  padroes: Array<{ padrao: string; abertura_pct: number | null; reunioes: number }>;
  datasComerciais: string[];
  narrativa: { resumo: string; recomendacoes: string[] };
}

/** Card de métrica com delta vs período anterior. */
function MetricDelta({ label, atual, anterior, money, pct }: { label: string; atual: number | null; anterior: number | null; money?: boolean; pct?: boolean }) {
  const fmt = (v: number | null) => (v == null ? "—" : money ? fmtBRL(v) : pct ? `${v}%` : fmtInt(v));
  const a = atual ?? 0, b = anterior ?? 0;
  const diff = a - b;
  const deltaPct = b !== 0 ? (diff / b) * 100 : null;
  const up = diff > 0, flat = diff === 0;
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="text-2xl font-bold mt-1">{fmt(atual)}</div>
        <div className={`text-xs flex items-center gap-1 mt-1 ${flat ? "text-muted-foreground" : up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
          {flat ? <Minus className="w-3 h-3" /> : up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {deltaPct != null ? `${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(0)}%` : "—"} vs anterior
        </div>
      </CardContent>
    </Card>
  );
}

export default function RelatorioBroadcast({ from, to }: { from: string; to: string }) {
  const q = useQuery<RelatorioData>({
    queryKey: ["/api/ghl/relatorio", from, to],
    queryFn: () => fetchJson(`/api/ghl/relatorio?from=${from}&to=${to}`),
  });

  if (q.isLoading)
    return <div className="flex items-center gap-2 text-sm text-muted-foreground p-6"><Loader2 className="w-4 h-4 animate-spin" /> Gerando relatório (atribuição + análise IA)…</div>;
  if (q.error || !q.data) return <p className="text-sm text-rose-600 dark:text-rose-400 p-6">Erro ao gerar o relatório.</p>;

  const { atual, anterior, bases, padroes, datasComerciais, narrativa } = q.data;

  return (
    <div className="space-y-6">
      {/* Narrativa IA */}
      <Card className="border-violet-200 dark:border-violet-900/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-500" /> Análise do período</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{narrativa.resumo}</p>
        </CardContent>
      </Card>

      {/* Métricas com delta vs anterior */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <MetricDelta label="Disparos" atual={atual.disparos} anterior={anterior.disparos} />
        <MetricDelta label="Leads" atual={atual.leads} anterior={anterior.leads} />
        <MetricDelta label="Abertura" atual={atual.abertura_pct} anterior={anterior.abertura_pct} pct />
        <MetricDelta label="Respostas" atual={atual.respostas} anterior={anterior.respostas} />
        <MetricDelta label="Reuniões" atual={atual.reunioes} anterior={anterior.reunioes} />
        <MetricDelta label="Vendas" atual={atual.vendas} anterior={anterior.vendas} />
        <MetricDelta label="Gasto" atual={atual.gasto} anterior={anterior.gasto} money />
      </div>

      {/* O que funcionou */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Trophy className="w-4 h-4" /> Bases que mais converteram</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {bases.slice(0, 6).map((b) => (
              <div key={b.base} className="flex items-center justify-between text-sm rounded bg-muted/30 px-3 py-1.5">
                <span>{b.base}</span>
                <span className="text-muted-foreground text-xs">{b.abertura_pct != null ? `${b.abertura_pct}% abertura` : "—"} · {b.reunioes} reun · {b.vendas} venda(s)</span>
              </div>
            ))}
            {bases.length === 0 && <p className="text-xs text-muted-foreground">Sem dados no período.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Trophy className="w-4 h-4" /> Padrões de copy que mais converteram</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {padroes.slice(0, 6).map((p) => (
              <div key={p.padrao} className="flex items-center justify-between text-sm rounded bg-muted/30 px-3 py-1.5">
                <span>{p.padrao}</span>
                <span className="text-muted-foreground text-xs">{p.abertura_pct != null ? `${p.abertura_pct}% abertura` : "—"} · {p.reunioes} reun</span>
              </div>
            ))}
            {padroes.length === 0 && <p className="text-xs text-muted-foreground">Sem padrões classificados no período.</p>}
          </CardContent>
        </Card>
      </div>

      {/* Recomendações IA */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-500" /> Recomendações para o próximo mês</CardTitle></CardHeader>
        <CardContent>
          {narrativa.recomendacoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem recomendações.</p>
          ) : (
            <ul className="space-y-2">
              {narrativa.recomendacoes.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-violet-500 mt-0.5">→</span><span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Datas comerciais à frente */}
      {datasComerciais.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><CalendarClock className="w-4 h-4" /> Datas comerciais à frente</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {datasComerciais.map((d) => <Badge key={d} variant="outline">{d}</Badge>)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
