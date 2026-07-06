import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Ticket, MapPin, Users, CalendarClock, Target, Copy, Check, MessageCircle, Megaphone, RotateCcw, PartyPopper, ListChecks } from "lucide-react";
import {
  SUMMIT_INFO, SUMMIT_CUPONS, SUMMIT_METAS, SUMMIT_DISPAROS, SUMMIT_CHECKLIST,
  type SummitDisparo, type SummitDisparoTipo,
} from "@shared/ghl-broadcast/summit-es-2026";

// Cores por tipo de disparo — mesmas nos chips e nos cards
const TIPO_STYLE: Record<SummitDisparoTipo, { label: string; chip: string; borda: string }> = {
  onda: { label: "Onda (venda)", chip: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400", borda: "border-l-blue-500" },
  followup: { label: "Follow-up", chip: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400", borda: "border-l-amber-500" },
  contagem: { label: "Contagem (compradores)", chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400", borda: "border-l-emerald-500" },
};

const SEMANAS: Array<{ titulo: string; de: string; ate: string }> = [
  { titulo: "Semana 1 · Onda 1 — Convite + gatilho \"BORA\" · cupom SUMMIT10", de: "2026-07-06", ate: "2026-07-12" },
  { titulo: "Semana 2 · Onda 2 — Lineup / headliner Manu Cit · cupom MANU10", de: "2026-07-13", ate: "2026-07-19" },
  { titulo: "Semana 3 · Onda 3 — Case Bready / playbook + grupo · cupom BORA10", de: "2026-07-20", ate: "2026-07-26" },
  { titulo: "Semana 4 · Onda 4 — Última chamada / escassez · cupom AGORA10", de: "2026-07-27", ate: "2026-08-02" },
  { titulo: "Dia do evento — 03/08", de: "2026-08-03", ate: "2026-08-03" },
];

const fmtDia = (ymd: string) => format(parseISO(ymd), "EEE dd/MM", { locale: ptBR });

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline" size="sm" className="gap-1.5"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copiada!" : "Copiar copy"}
    </Button>
  );
}

function DisparoCard({ d, onOpen, hoje }: { d: SummitDisparo; onOpen: (d: SummitDisparo) => void; hoje: boolean }) {
  const st = TIPO_STYLE[d.tipo];
  return (
    <button
      type="button"
      onClick={() => onOpen(d)}
      className={cn(
        "w-full text-left rounded-md border border-l-4 p-3 transition-colors",
        "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800/60",
        st.borda,
        hoje && "ring-2 ring-primary/60",
      )}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold tabular-nums text-gray-500 dark:text-zinc-400 uppercase">{fmtDia(d.data)}</span>
        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", st.chip)}>{st.label}</span>
        {d.cupom && <Badge variant="outline" className="text-[10px] font-mono">{d.cupom}</Badge>}
        {d.opcional && <Badge variant="outline" className="text-[10px]">opcional</Badge>}
        {d.copy.includes("[") && <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800">preencher dado</Badge>}
      </div>
      <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{d.titulo}</div>
      <div className="text-xs text-gray-600 dark:text-zinc-400 mt-0.5">{d.publico}</div>
    </button>
  );
}

export default function SummitBroadcasts() {
  const [filtro, setFiltro] = useState<"todos" | SummitDisparoTipo>("todos");
  const [aberto, setAberto] = useState<SummitDisparo | null>(null);

  const hoje = format(new Date(), "yyyy-MM-dd");
  const disparos = useMemo(
    () => SUMMIT_DISPAROS.filter((d) => filtro === "todos" || d.tipo === filtro).sort((a, b) => a.data.localeCompare(b.data)),
    [filtro],
  );
  const deHoje = useMemo(() => SUMMIT_DISPAROS.filter((d) => d.data === hoje), [hoje]);
  const proximos = useMemo(() => {
    const futuras = Array.from(new Set(SUMMIT_DISPAROS.map((d) => d.data))).filter((dt) => dt > hoje).sort();
    return futuras.length ? SUMMIT_DISPAROS.filter((d) => d.data === futuras[0]) : [];
  }, [hoje]);

  return (
    <div className="space-y-4">
      {/* Cabeçalho: evento + base + regras */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><PartyPopper className="w-4 h-4" /> Evento</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="font-medium">{SUMMIT_INFO.evento}</div>
            <div className="flex items-center gap-1.5 text-gray-600 dark:text-zinc-400"><CalendarClock className="w-3.5 h-3.5" /> seg 03/08/2026</div>
            <div className="flex items-center gap-1.5 text-gray-600 dark:text-zinc-400"><MapPin className="w-3.5 h-3.5" /> {SUMMIT_INFO.local}</div>
            <div className="flex items-center gap-1.5 text-gray-600 dark:text-zinc-400"><Ticket className="w-3.5 h-3.5" /> {SUMMIT_INFO.ingressos}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4" /> Base fracionada (DDD 27/28)</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="text-xs text-gray-600 dark:text-zinc-400">{SUMMIT_INFO.base}</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1">
              {SUMMIT_INFO.fracoes.map((f) => (
                <div key={f.fracao} className="text-xs"><span className="font-mono font-semibold">{f.fracao}</span> · {f.contatos.toLocaleString("pt-BR")} · {f.dia}</div>
              ))}
              <div className="text-xs col-span-2"><span className="font-semibold">Follow-up</span> · sex/sáb, só quem não respondeu/clicou</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MessageCircle className="w-4 h-4" /> Regras da campanha</CardTitle></CardHeader>
          <CardContent>
            <ul className="text-xs text-gray-600 dark:text-zinc-400 space-y-1 list-disc pl-4">
              {SUMMIT_INFO.regras.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Disparos de HOJE (ou os próximos) */}
      <Card className={cn(deHoje.length && "border-primary/50")}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Megaphone className="w-4 h-4" />
            {deHoje.length ? `Sai HOJE (${fmtDia(hoje)})` : proximos.length ? `Próximo disparo (${fmtDia(proximos[0].data)})` : "Campanha encerrada"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(deHoje.length ? deHoje : proximos).length === 0 ? (
            <p className="text-sm text-muted-foreground">Todos os disparos do Summit já passaram.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {(deHoje.length ? deHoje : proximos).map((d, i) => <DisparoCard key={i} d={d} onOpen={setAberto} hoje={deHoje.length > 0} />)}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-2">Horários de envio: 10h–12h ou 18h–20h. Clique no disparo pra ver a copy completa.</p>
        </CardContent>
      </Card>

      {/* Cupons + Metas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Ticket className="w-4 h-4" /> Cupons por onda (10%) — cupom mede a venda, UTM mede o clique</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {SUMMIT_CUPONS.map((c) => (
              <div key={c.cupom} className="flex items-center gap-2 text-sm">
                <span className="text-xs text-gray-500 dark:text-zinc-400 w-14 shrink-0">Onda {c.onda}</span>
                <Badge variant="outline" className="font-mono">{c.cupom}</Badge>
                <span className="text-xs text-gray-600 dark:text-zinc-400">{c.validade}</span>
                <span className="text-xs text-gray-500 dark:text-zinc-500 truncate hidden md:inline">· {c.mede}</span>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground pt-1">{SUMMIT_INFO.utm}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4" /> Metas da campanha</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {SUMMIT_METAS.map((m) => (
              <div key={m.metrica} className="flex items-baseline gap-2 text-sm">
                <span className="text-xs w-36 shrink-0 text-gray-600 dark:text-zinc-400">{m.metrica}</span>
                <span className="font-semibold tabular-nums text-sm">{m.meta}</span>
                <span className="text-[11px] text-gray-500 dark:text-zinc-500 truncate hidden md:inline">se abaixo: {m.seFicarAbaixo}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Timeline semana a semana */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Calendário completo — o que sai em cada dia</CardTitle>
            <div className="flex gap-1.5">
              {([["todos", "Tudo"], ["onda", "Ondas"], ["followup", "Follow-ups"], ["contagem", "Compradores"]] as const).map(([k, label]) => (
                <Button key={k} variant={filtro === k ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setFiltro(k)}>
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {SEMANAS.map((s) => {
            const doPeriodo = disparos.filter((d) => d.data >= s.de && d.data <= s.ate);
            if (!doPeriodo.length) return null;
            return (
              <div key={s.de}>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-2">{s.titulo}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {doPeriodo.map((d, i) => <DisparoCard key={`${s.de}-${i}`} d={d} onOpen={setAberto} hoje={d.data === hoje} />)}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Checklist pré-disparo */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><ListChecks className="w-4 h-4" /> Checklist antes do primeiro disparo</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-1">
            {SUMMIT_CHECKLIST.map((c) => (
              <li key={c.item} className="flex items-start gap-2 text-sm">
                <span className={cn("mt-0.5 shrink-0", c.feito ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-zinc-500")}>
                  {c.feito ? <Check className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                </span>
                <span className={cn(c.feito && "line-through text-gray-500 dark:text-zinc-500")}>{c.item}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Dialog: copy completa do disparo */}
      <Dialog open={!!aberto} onOpenChange={(o) => !o && setAberto(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {aberto && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base pr-8">{aberto.titulo}</DialogTitle>
              </DialogHeader>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-semibold uppercase">{fmtDia(aberto.data)}</span>
                <span className={cn("px-1.5 py-0.5 rounded font-medium", TIPO_STYLE[aberto.tipo].chip)}>{TIPO_STYLE[aberto.tipo].label}</span>
                {aberto.cupom && <Badge variant="outline" className="font-mono">{aberto.cupom}</Badge>}
              </div>
              <div className="text-xs text-gray-600 dark:text-zinc-400"><span className="font-medium">Público:</span> {aberto.publico}</div>
              <div className="rounded-md border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/60 p-3 text-sm whitespace-pre-wrap">{aberto.copy}</div>
              <div className="flex justify-end"><CopyButton text={aberto.copy} /></div>
              {aberto.variantes?.map((v) => (
                <div key={v.label}>
                  <div className="text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">{v.label}</div>
                  <div className="rounded-md border border-dashed border-gray-200 dark:border-zinc-700 p-3 text-sm whitespace-pre-wrap">{v.copy}</div>
                </div>
              ))}
              {aberto.obs && (
                <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md p-2.5">{aberto.obs}</p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
