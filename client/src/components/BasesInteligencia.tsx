/**
 * Aba "Bases / Inteligência" do CRM Marketing.
 *
 * Combina o que a Turbo ACREDITA que funciona (matriz de compatibilidade estática,
 * matriz-validacao.ts) com o que de fato FUNCIONOU (performance real por base).
 *
 *  - Ranking de bases (ordenável): entrega/abertura/conv/reuniões/custo-reunião/fadiga
 *  - Matriz de compatibilidade da base selecionada (padrões + ofertas: TOP/BOM/OK/EVITAR)
 *  - Insights automáticos (melhor base, maior conversão, alerta, combinação vencedora)
 *  - Cruzamento base × padrão (pendente até a classificação por IA rodar)
 *
 * Dados: GET /api/ghl/bases/performance.
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Trophy, TrendingUp, AlertTriangle, Sparkles } from "lucide-react";
import { compatibilidadePadroes, compatibilidadeOfertas, type NivelCompat } from "@shared/ghl-broadcast/matriz-validacao";
import { PADROES_COPY_LABEL, type PadraoKey } from "@shared/ghl-broadcast/types";

const fmtInt = (n: number | null | undefined) => (n ?? 0).toLocaleString("pt-BR");
const fmtPct = (n: number | null | undefined) => (n == null ? "—" : `${n}%`);
const fmtBRL = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function fetchJson<T>(url: string): Promise<T> {
  return fetch(url, { credentials: "include" }).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json() as Promise<T>;
  });
}

interface BaseRow {
  base: string;
  disparos: number;
  leads_totais: number;
  entrega_pct: number | null;
  abertura_pct: number | null;
  conv_pct: number | null;
  responderam: number;
  reunioes: number;
  vendas: number;
  custo_brl: number;
  custo_reuniao: number | null;
  ultimo: string | null;
}
interface CruzRow { base: string; padrao: string | null; disparos: number; abertura_pct: number | null }

type SortKey = "abertura_pct" | "reunioes" | "entrega_pct" | "disparos";

// "++"/"+"/"~"/"-" → rótulo + cor (TOP/BOM/OK/EVITAR)
const COMPAT_PADRAO: Record<NivelCompat, { label: string; cls: string }> = {
  "++": { label: "TOP", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
  "+": { label: "BOM", cls: "bg-lime-100 text-lime-700 dark:bg-lime-950/40 dark:text-lime-400" },
  "~": { label: "OK", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
  "-": { label: "EVITAR", cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400" },
};
const COMPAT_OFERTA: Record<string, { label: string; cls: string }> = {
  "+": { label: "TOP", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
  "~": { label: "OK", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
  "-": { label: "EVITAR", cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400" },
};

function prettyOferta(key: string): string {
  return key.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}

function diasDesde(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export default function BasesInteligencia({ from, to }: { from: string; to: string }) {
  const [sortKey, setSortKey] = useState<SortKey>("abertura_pct");
  const [baseSel, setBaseSel] = useState<string | null>(null);

  const q = useQuery<{ ranking: BaseRow[]; cruzamento: CruzRow[]; unit_cost: number }>({
    queryKey: ["/api/ghl/bases/performance", from, to],
    queryFn: () => fetchJson(`/api/ghl/bases/performance?from=${from}&to=${to}`),
  });

  const ranking = useMemo(() => {
    const rows = [...(q.data?.ranking ?? [])];
    rows.sort((a, b) => (Number(b[sortKey] ?? -1) - Number(a[sortKey] ?? -1)));
    return rows;
  }, [q.data, sortKey]);

  const baseAtiva = baseSel ?? ranking[0]?.base ?? null;
  const temPadrao = (q.data?.cruzamento ?? []).some((c) => c.padrao);

  // Segmentação por produto da base selecionada (Congelados × E-commerce/Creators…).
  const seg = useQuery<{ baseTotal: number; produtos: Array<{ produto: string; label: string; size: number; tags: string[] }> }>({
    queryKey: ["/api/ghl/segmento", baseAtiva],
    queryFn: () => fetchJson(`/api/ghl/segmento?base=${encodeURIComponent(baseAtiva!)}`),
    enabled: !!baseAtiva,
  });

  // Insights automáticos (dos dados reais; combinação vencedora depende de padrão).
  const insights = useMemo(() => {
    const r = ranking;
    if (!r.length) return [];
    const out: { icon: "best" | "conv" | "alert" | "win"; titulo: string; desc: string }[] = [];
    const melhorAbertura = [...r].sort((a, b) => (b.abertura_pct ?? 0) - (a.abertura_pct ?? 0))[0];
    if (melhorAbertura?.abertura_pct != null)
      out.push({ icon: "best", titulo: `Melhor base: ${melhorAbertura.base}`, desc: `${melhorAbertura.abertura_pct}% de abertura média em ${melhorAbertura.disparos} disparo(s).` });
    const melhorReuniao = [...r].filter((x) => x.reunioes > 0).sort((a, b) => b.reunioes - a.reunioes)[0];
    if (melhorReuniao)
      out.push({ icon: "conv", titulo: `Maior conversão em reuniões: ${melhorReuniao.base}`, desc: `${melhorReuniao.reunioes} reunião(ões) atribuída(s)${melhorReuniao.custo_reuniao != null ? ` a ${fmtBRL(melhorReuniao.custo_reuniao)}/reunião` : ""}.` });
    const pior = [...r].filter((x) => x.abertura_pct != null).sort((a, b) => (a.abertura_pct ?? 0) - (b.abertura_pct ?? 0))[0];
    if (pior?.abertura_pct != null)
      out.push({ icon: "alert", titulo: `Alerta: ${pior.base}`, desc: `Apenas ${pior.abertura_pct}% de abertura. Considere um hook diferente ou descanso da base.` });
    return out;
  }, [ranking]);

  const SortBtn = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <Button variant={sortKey === k ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setSortKey(k)}>
      {children}
    </Button>
  );

  if (q.isLoading)
    return <div className="flex items-center gap-2 text-sm text-muted-foreground p-6"><Loader2 className="w-4 h-4 animate-spin" /> Carregando análise de bases…</div>;
  if (q.error) return <p className="text-sm text-rose-600 dark:text-rose-400 p-6">Erro ao carregar a análise de bases.</p>;

  return (
    <div className="space-y-6">
      {/* Ranking de bases */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2"><Trophy className="w-4 h-4" /> Ranking de bases</CardTitle>
          <div className="flex gap-1 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1 self-center">Ordenar:</span>
            <SortBtn k="abertura_pct">Abertura</SortBtn>
            <SortBtn k="reunioes">Reuniões</SortBtn>
            <SortBtn k="entrega_pct">Entrega</SortBtn>
            <SortBtn k="disparos">Nº disparos</SortBtn>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Base</TableHead>
                <TableHead className="text-right">Disparos</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Entrega</TableHead>
                <TableHead className="text-right">Abertura</TableHead>
                <TableHead className="text-right">Conv.</TableHead>
                <TableHead className="text-right">Reun.</TableHead>
                <TableHead className="text-right">Custo/reun.</TableHead>
                <TableHead className="text-right">Último</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranking.map((r) => {
                const dias = diasDesde(r.ultimo);
                const ativo = r.base === baseAtiva;
                return (
                  <TableRow key={r.base} className={`cursor-pointer ${ativo ? "bg-muted/50" : ""}`} onClick={() => setBaseSel(r.base)}>
                    <TableCell className="font-medium">{r.base}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtInt(r.disparos)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmtInt(r.leads_totais)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtPct(r.entrega_pct)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{fmtPct(r.abertura_pct)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtPct(r.conv_pct)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtInt(r.reunioes)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtBRL(r.custo_reuniao)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{dias != null ? `${dias}d` : "—"}</TableCell>
                  </TableRow>
                );
              })}
              {ranking.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Nenhuma base com disparos no período.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Matriz de compatibilidade da base selecionada */}
      {baseAtiva && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{baseAtiva} — matriz de compatibilidade</CardTitle>
            <p className="text-xs text-muted-foreground">O que funciona melhor nesta base (conhecimento Turbo)</p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">PADRÕES DE COPY</div>
              <div className="space-y-1.5">
                {Object.entries(compatibilidadePadroes(baseAtiva)).map(([k, nivel]) => (
                  <div key={k} className="flex items-center justify-between rounded bg-muted/30 px-3 py-1.5 text-sm">
                    <span>{PADROES_COPY_LABEL[k as PadraoKey] ?? k}</span>
                    <Badge variant="outline" className={COMPAT_PADRAO[nivel as NivelCompat]?.cls}>{COMPAT_PADRAO[nivel as NivelCompat]?.label}</Badge>
                  </div>
                ))}
                {Object.keys(compatibilidadePadroes(baseAtiva)).length === 0 && <p className="text-xs text-muted-foreground">Sem matriz definida para esta base.</p>}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">OFERTAS / SERVIÇOS</div>
              <div className="space-y-1.5">
                {Object.entries(compatibilidadeOfertas(baseAtiva)).map(([k, nivel]) => (
                  <div key={k} className="flex items-center justify-between rounded bg-muted/30 px-3 py-1.5 text-sm">
                    <span>{prettyOferta(k)}</span>
                    <Badge variant="outline" className={COMPAT_OFERTA[nivel as string]?.cls}>{COMPAT_OFERTA[nivel as string]?.label}</Badge>
                  </div>
                ))}
                {Object.keys(compatibilidadeOfertas(baseAtiva)).length === 0 && <p className="text-xs text-muted-foreground">Sem matriz definida para esta base.</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Segmentação por produto da base selecionada */}
      {baseAtiva && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{baseAtiva} — segmentação por produto</CardTitle>
            <p className="text-xs text-muted-foreground">
              Quem nessa base tem interesse em cada produto (pra disparo segmentado). {seg.data ? `${fmtInt(seg.data.baseTotal)} com algum interesse mapeado.` : ""}
            </p>
          </CardHeader>
          <CardContent>
            {seg.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Calculando segmentos…</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {(seg.data?.produtos ?? []).map((p) => (
                  <div key={p.produto} className="rounded border border-border p-3" title={`Tags: ${p.tags.join(", ")}`}>
                    <div className="text-2xl font-bold">{fmtInt(p.size)}</div>
                    <div className="text-sm">{p.label}</div>
                    <div className="text-[10px] text-muted-foreground truncate mt-1">{p.tags.join(" · ")}</div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-3">
              No Funnels, monte o público combinando as tags da base <strong>{baseAtiva}</strong> + a tag do produto acima.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Insights automáticos */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4" /> Insights automáticos</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {insights.map((i, idx) => (
            <div key={idx} className="flex items-start gap-3 rounded border border-border bg-muted/20 px-3 py-2">
              {i.icon === "best" && <TrendingUp className="w-4 h-4 text-emerald-500 mt-0.5" />}
              {i.icon === "conv" && <Trophy className="w-4 h-4 text-blue-500 mt-0.5" />}
              {i.icon === "alert" && <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />}
              <div>
                <div className="text-sm font-medium">{i.titulo}</div>
                <div className="text-xs text-muted-foreground">{i.desc}</div>
              </div>
            </div>
          ))}
          {!temPadrao && (
            <div className="flex items-start gap-3 rounded border border-dashed border-border px-3 py-2">
              <Sparkles className="w-4 h-4 text-violet-500 mt-0.5" />
              <div>
                <div className="text-sm font-medium">Cruzamento base × padrão de copy — pendente</div>
                <div className="text-xs text-muted-foreground">Requer a classificação de padrão por IA (chave Claude). Quando ativa, mostra a combinação base×padrão vencedora.</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
