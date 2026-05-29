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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { compatibilidadePadroes, compatibilidadeOfertas, type NivelCompat } from "@shared/ghl-broadcast/matriz-validacao";
import { PADROES_COPY_LABEL, type PadraoKey } from "@shared/ghl-broadcast/types";
import { BASES_DISPONIVEIS } from "@shared/ghl-broadcast/base-tag-map";

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
interface ListRow {
  list: string; contacts: number; new_leads_7d: number;
  tags_all: string[]; tags_any: string[]; tags_not: string[];
  top_origins: Array<{ medium: string; count: number }>;
}

type SortKey = "contacts" | "abertura_pct" | "reunioes" | "entrega_pct" | "disparos";

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
  const [sortKey, setSortKey] = useState<SortKey>("contacts");
  const [baseSel, setBaseSel] = useState<string | null>(null);

  const q = useQuery<{ ranking: BaseRow[]; cruzamento: CruzRow[]; unit_cost: number }>({
    queryKey: ["/api/ghl/bases/performance", from, to],
    queryFn: () => fetchJson(`/api/ghl/bases/performance?from=${from}&to=${to}`),
  });
  const listsQ = useQuery<{ lists: ListRow[] }>({
    queryKey: ["/api/ghl/lists"],
    queryFn: () => fetchJson("/api/ghl/lists"),
  });

  // Tabela unificada de bases: definição + tamanho (lists) + performance (se houve disparo).
  const ranking = useMemo(() => {
    const perf = new Map((q.data?.ranking ?? []).map((r) => [r.base, r]));
    const merged = (listsQ.data?.lists ?? []).map((l) => {
      const p = perf.get(l.list);
      return {
        base: l.list, contacts: l.contacts, new_leads_7d: l.new_leads_7d, top_origins: l.top_origins,
        tags_all: l.tags_all, tags_any: l.tags_any, tags_not: l.tags_not,
        disparos: p?.disparos ?? 0, entrega_pct: p?.entrega_pct ?? null, abertura_pct: p?.abertura_pct ?? null,
        conv_pct: p?.conv_pct ?? null, reunioes: p?.reunioes ?? 0, vendas: p?.vendas ?? 0,
        custo_reuniao: p?.custo_reuniao ?? null, ultimo: p?.ultimo ?? null,
      };
    });
    merged.sort((a, b) => Number((b as any)[sortKey] ?? -1) - Number((a as any)[sortKey] ?? -1));
    return merged;
  }, [q.data, listsQ.data, sortKey]);

  const baseAtiva = baseSel ?? ranking[0]?.base ?? null;
  const baseInfo = ranking.find((r) => r.base === baseAtiva) ?? null;
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
      {/* Seletor de base (controla matriz + segmentação; funciona pra qualquer base,
          inclusive as sem disparo no período) */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Base selecionada:</span>
        <Select value={baseAtiva ?? undefined} onValueChange={setBaseSel}>
          <SelectTrigger className="w-[280px]"><SelectValue placeholder="Selecione uma base…" /></SelectTrigger>
          <SelectContent>
            {BASES_DISPONIVEIS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">— ou clique numa linha do ranking</span>
      </div>

      {/* Tabela unificada de bases (definição + tamanho + performance) */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Trophy className="w-4 h-4" /> Bases</CardTitle>
            <p className="text-xs text-muted-foreground">Tamanho + performance — clique numa base pra ver definição, matriz e segmentação</p>
          </div>
          <div className="flex gap-1 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1 self-center">Ordenar:</span>
            <SortBtn k="contacts">Contatos</SortBtn>
            <SortBtn k="abertura_pct">Abertura</SortBtn>
            <SortBtn k="reunioes">Reuniões</SortBtn>
            <SortBtn k="disparos">Disparos</SortBtn>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Base</TableHead>
                <TableHead className="text-right">Contatos</TableHead>
                <TableHead className="text-right">Leads 7d</TableHead>
                <TableHead className="text-right">Disparos</TableHead>
                <TableHead className="text-right">Entrega</TableHead>
                <TableHead className="text-right">Abertura</TableHead>
                <TableHead className="text-right">Reun.</TableHead>
                <TableHead className="text-right">Custo/reun.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranking.map((r) => {
                const ativo = r.base === baseAtiva;
                return (
                  <TableRow key={r.base} className={`cursor-pointer ${ativo ? "bg-muted/50" : ""}`} onClick={() => setBaseSel(r.base)}>
                    <TableCell className="font-medium">{r.base}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtInt(r.contacts)}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">{r.new_leads_7d ? `+${fmtInt(r.new_leads_7d)}` : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.disparos ? fmtInt(r.disparos) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtPct(r.entrega_pct)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{fmtPct(r.abertura_pct)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.disparos ? fmtInt(r.reunioes) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtBRL(r.custo_reuniao)}</TableCell>
                  </TableRow>
                );
              })}
              {ranking.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Carregando bases…</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Definição & origem da base selecionada (vindo da antiga aba Listas) */}
      {baseInfo && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{baseAtiva} — definição & origem</CardTitle>
            <p className="text-xs text-muted-foreground">{fmtInt(baseInfo.contacts)} contatos{baseInfo.new_leads_7d ? ` · +${fmtInt(baseInfo.new_leads_7d)} novos em 7d` : ""}</p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-muted-foreground">DEFINIÇÃO (tags)</div>
              {baseInfo.tags_all?.length > 0 && (
                <div><span className="text-xs text-muted-foreground">precisa ter todas: </span>{baseInfo.tags_all.map((t) => <Badge key={t} variant="outline" className="mr-1 mb-1 font-mono text-[10px]">{t}</Badge>)}</div>
              )}
              {baseInfo.tags_any?.length > 0 && (
                <div><span className="text-xs text-muted-foreground">pelo menos uma: </span>{baseInfo.tags_any.map((t) => <Badge key={t} variant="outline" className="mr-1 mb-1 font-mono text-[10px]">{t}</Badge>)}</div>
              )}
              {baseInfo.tags_not?.length > 0 && (
                <div><span className="text-xs text-muted-foreground">não pode ter: </span>{baseInfo.tags_not.map((t) => <Badge key={t} variant="outline" className="mr-1 mb-1 font-mono text-[10px] text-rose-600 dark:text-rose-400">{t}</Badge>)}</div>
              )}
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">ORIGEM (top 3)</div>
              {baseInfo.top_origins?.length ? baseInfo.top_origins.map((o) => (
                <div key={o.medium} className="flex justify-between"><span>{o.medium}</span><span className="text-muted-foreground tabular-nums">{fmtInt(o.count)}</span></div>
              )) : <span className="text-xs text-muted-foreground">—</span>}
            </div>
          </CardContent>
        </Card>
      )}

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
