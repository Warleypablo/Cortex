/**
 * Aba "Planejamento" — calendário editorial do mês (planejamento interno dos disparos).
 *
 *  - Navega por mês (default: mês seguinte).
 *  - Cada dia mostra slots planejados + datas comerciais + alertas de cadência.
 *  - Editor de slot: base/objetivo/padrão/status/título/copy + geração de copy por IA
 *    a partir do padrão que mais converteu naquela base (cruzamento real).
 *
 * Dados: /api/ghl/plano (GET/POST/PATCH/DELETE) e /api/ghl/plano/gerar-copy.
 */
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Plus, Loader2, Sparkles, Trash2, AlertTriangle, CalendarClock } from "lucide-react";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, addMonths, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BASES_DISPONIVEIS } from "@shared/ghl-broadcast/base-tag-map";
import { OBJETIVOS, PADROES_COPY_LABEL, STATUS_ORDER, STATUS_CONFIG, type PadraoKey } from "@shared/ghl-broadcast/types";

interface Slot {
  id: number; plan_date: string; canal: string; base: string | null; objetivo: string | null;
  padrao: string | null; titulo: string | null; copy_text: string | null; status: string;
  cadencia: { status: string; alertas: Array<{ nivel: string; mensagem: string }> };
}
interface DataComercial { nome: string; data: string; antecedenciaDias: number; dica?: string }

const STATUS_TONE: Record<string, string> = {
  backlog: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  pronta: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
  agendada: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  enviada: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  congelada: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
};

// Ordem + rótulos exibidos na legenda. "enviada" = já disparado (verde); os demais
// ainda não foram enviados — a cor diferencia enviado x não-enviado (ver review #1).
const STATUS_LEGENDA: Array<{ key: string; label: string }> = [
  { key: "backlog", label: "Backlog" },
  { key: "pronta", label: "Pronta" },
  { key: "agendada", label: "Agendada" },
  { key: "enviada", label: "Enviada" },
  { key: "congelada", label: "Congelada" },
];

function jsonReq(url: string, method: string, body?: any) {
  return fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
    .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); });
}

const novoSlot = (date: string): Partial<Slot> => ({ plan_date: date, canal: "WhatsApp", status: "backlog" });

export default function PlanejamentoMensal() {
  const qc = useQueryClient();
  // Default: mês seguinte (planejamento). Sem Date.now em escopo proibido — aqui é client, ok.
  const [ref, setRef] = useState<Date>(() => startOfMonth(addMonths(new Date(), 1)));
  const [editing, setEditing] = useState<Partial<Slot> | null>(null);
  const [variacoes, setVariacoes] = useState<Array<{ titulo: string; padrao: string; copy: string }>>([]);
  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [gerandoMes, setGerandoMes] = useState(false);
  const [msgMes, setMsgMes] = useState<string | null>(null);

  const from = format(startOfMonth(ref), "yyyy-MM-dd");
  const to = format(endOfMonth(ref), "yyyy-MM-dd");

  const q = useQuery<{ slots: Slot[]; datasComerciais: DataComercial[] }>({
    queryKey: ["/api/ghl/plano", from, to],
    queryFn: () => fetch(`/api/ghl/plano?from=${from}&to=${to}`, { credentials: "include" }).then((r) => r.json()),
  });

  const dias = useMemo(() => {
    const ini = startOfWeek(startOfMonth(ref), { weekStartsOn: 1 });
    const fim = endOfWeek(endOfMonth(ref), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: ini, end: fim });
  }, [ref]);

  const slotsPorDia = useMemo(() => {
    const m: Record<string, Slot[]> = {};
    for (const s of q.data?.slots ?? []) (m[s.plan_date] ??= []).push(s);
    return m;
  }, [q.data]);
  const datasPorDia = useMemo(() => {
    const m: Record<string, DataComercial[]> = {};
    for (const d of q.data?.datasComerciais ?? []) (m[d.data] ??= []).push(d);
    return m;
  }, [q.data]);

  const refetch = () => qc.invalidateQueries({ queryKey: ["/api/ghl/plano"] });

  async function salvar() {
    if (!editing) return;
    setSalvando(true);
    try {
      if (editing.id) await jsonReq(`/api/ghl/plano/${editing.id}`, "PATCH", editing);
      else await jsonReq("/api/ghl/plano", "POST", editing);
      setEditing(null); setVariacoes([]); refetch();
    } finally { setSalvando(false); }
  }
  async function excluir() {
    if (!editing?.id) return;
    setSalvando(true);
    try { await jsonReq(`/api/ghl/plano/${editing.id}`, "DELETE"); setEditing(null); setVariacoes([]); refetch(); }
    finally { setSalvando(false); }
  }
  async function gerarCopy() {
    if (!editing?.base || !editing?.objetivo) return;
    setGerando(true); setVariacoes([]);
    try {
      const r = await jsonReq("/api/ghl/plano/gerar-copy", "POST", { base: editing.base, objetivo: editing.objetivo });
      setVariacoes(r.variacoes ?? []);
      if (r.padraoAlvo && !editing.padrao) setEditing((e) => ({ ...e!, padrao: r.padraoAlvo }));
    } catch { setVariacoes([]); }
    finally { setGerando(false); }
  }

  async function gerarMes() {
    const mesLabel = format(ref, "MMMM yyyy", { locale: ptBR });
    if (!confirm(`Gerar o planejamento de ${mesLabel}?\n\nIsso cria disparos seg-sex baseados nas melhores bases/padrões do mês anterior + datas comerciais. Substitui apenas os gerados automaticamente (seus disparos manuais são preservados).`)) return;
    setGerandoMes(true); setMsgMes(null);
    try {
      const r = await jsonReq("/api/ghl/plano/gerar-mes", "POST", { month: format(ref, "yyyy-MM") });
      if (r.ok === false) setMsgMes(r.motivo || "Sem dados suficientes pra gerar.");
      else setMsgMes(`✓ ${r.criados}/${r.dias_uteis} dias úteis preenchidos (${r.com_copy} com copy, ${r.sazonais} em datas comerciais${r.sem_credito ? `, ${r.sem_credito} aguardando créditos Claude` : ""}).${r.sem_historico ? " Sem histórico do mês anterior — baseado na matriz Turbo." : ""}`);
      refetch();
    } catch (e: any) { setMsgMes("Erro ao gerar o planejamento."); }
    finally { setGerandoMes(false); }
  }

  return (
    <div className="space-y-4">
      {/* Navegação de mês */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setRef((r) => addMonths(r, -1))}><ChevronLeft className="w-4 h-4" /></Button>
        <div className="text-lg font-semibold capitalize min-w-[180px] text-center">{format(ref, "MMMM yyyy", { locale: ptBR })}</div>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setRef((r) => addMonths(r, 1))}><ChevronRight className="w-4 h-4" /></Button>
        {q.isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={gerarMes} disabled={gerandoMes} title="Gera o mês inteiro com IA: melhores bases/padrões do mês anterior + datas comerciais + cadência">
          {gerandoMes ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />} Gerar planejamento do mês (IA)
        </Button>
        <Button size="sm" onClick={() => { setEditing(novoSlot(format(startOfMonth(ref), "yyyy-MM-dd"))); setVariacoes([]); }}>
          <Plus className="w-4 h-4 mr-1" /> Novo disparo
        </Button>
      </div>

      {msgMes && (
        <div className="text-xs rounded border border-border bg-muted/30 px-3 py-2 text-muted-foreground">{msgMes}</div>
      )}

      {/* Grade do mês */}
      <div className="grid grid-cols-7 gap-1.5">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
          <div key={d} className="text-xs font-semibold text-muted-foreground text-center py-1">{d}</div>
        ))}
        {dias.map((dia) => {
          const ymd = format(dia, "yyyy-MM-dd");
          const slots = slotsPorDia[ymd] ?? [];
          const datas = datasPorDia[ymd] ?? [];
          const foraDoMes = !isSameMonth(dia, ref);
          return (
            <div key={ymd} className={`min-h-[110px] rounded border border-border p-1.5 flex flex-col gap-1 ${foraDoMes ? "opacity-40" : ""}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{format(dia, "d")}</span>
                <button className="text-muted-foreground hover:text-foreground" onClick={() => { setEditing(novoSlot(ymd)); setVariacoes([]); }}>
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              {datas.map((d) => (
                <div key={d.nome} className="text-[10px] rounded bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 px-1 py-0.5 flex items-center gap-1" title={d.dica}>
                  <CalendarClock className="w-2.5 h-2.5" /> {d.nome}
                </div>
              ))}
              {slots.map((s) => {
                const block = s.cadencia?.alertas?.some((a) => a.nivel === "block");
                return (
                  <button key={s.id} onClick={() => { setEditing(s); setVariacoes([]); }}
                    title={[`Status: ${s.status}`, ...(s.cadencia?.alertas?.map((a) => a.mensagem) ?? [])].join(" · ")}
                    className={`text-left text-[11px] rounded px-1.5 py-1 border-l-2 ${STATUS_TONE[s.status] ?? ""} ${block ? "border-l-rose-500" : "border-l-transparent"}`}>
                    <div className="flex items-center gap-1">
                      {block && <AlertTriangle className="w-2.5 h-2.5 text-rose-500 shrink-0" />}
                      <span className="font-medium truncate">{s.titulo || s.base || "(sem título)"}</span>
                    </div>
                    {s.base && <div className="text-[10px] opacity-70 truncate">{s.base}</div>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Legenda — explica as cores de status e os marcadores (review #1) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground pt-1">
        <span className="font-medium text-foreground">Status do disparo:</span>
        {STATUS_LEGENDA.map((st) => (
          <span key={st.key} className="inline-flex items-center gap-1">
            <span className={`inline-block w-2.5 h-2.5 rounded-sm ${STATUS_TONE[st.key]}`} />
            {st.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-rose-500" /> Alerta de cadência (risco de fadiga)
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="w-3 h-3 text-rose-500" /> Data comercial
        </span>
      </div>

      {/* Editor de slot */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setVariacoes([]); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar disparo" : "Novo disparo"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Data</Label><Input type="date" value={editing.plan_date ?? ""} onChange={(e) => setEditing({ ...editing, plan_date: e.target.value })} /></div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={editing.status ?? "backlog"} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS_ORDER.map((s) => <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Base</Label>
                  <Select value={editing.base ?? undefined} onValueChange={(v) => setEditing({ ...editing, base: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent>{BASES_DISPONIVEIS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Objetivo</Label>
                  <Select value={editing.objetivo ?? undefined} onValueChange={(v) => setEditing({ ...editing, objetivo: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent>{OBJETIVOS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Padrão de copy</Label>
                  <Select value={editing.padrao ?? undefined} onValueChange={(v) => setEditing({ ...editing, padrao: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent>{(Object.keys(PADROES_COPY_LABEL) as PadraoKey[]).map((p) => <SelectItem key={p} value={p}>{PADROES_COPY_LABEL[p]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label className="text-xs">Título</Label><Input value={editing.titulo ?? ""} onChange={(e) => setEditing({ ...editing, titulo: e.target.value })} placeholder="Ex.: Pré-Black Friday — base Ecommerce" /></div>
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Copy</Label>
                  <Button variant="outline" size="sm" className="h-7 text-xs" disabled={!editing.base || !editing.objetivo || gerando} onClick={gerarCopy}>
                    {gerando ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />} Gerar copy IA
                  </Button>
                </div>
                <Textarea rows={5} value={editing.copy_text ?? ""} onChange={(e) => setEditing({ ...editing, copy_text: e.target.value })} placeholder="Escreva ou gere com IA (usa o padrão que mais converteu nessa base)…" />
                {!editing.base || !editing.objetivo ? <p className="text-[11px] text-muted-foreground mt-1">Selecione base e objetivo pra gerar copy.</p> : null}
              </div>
              {variacoes.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs">Variações geradas (clique pra usar)</Label>
                  {variacoes.map((v, i) => (
                    <button key={i} onClick={() => setEditing({ ...editing, copy_text: v.copy, titulo: editing.titulo || v.titulo, padrao: editing.padrao || v.padrao })}
                      className="block w-full text-left rounded border border-border hover:border-violet-400 p-2 text-xs">
                      <div className="flex items-center gap-2 mb-1"><Badge variant="outline">{v.padrao}</Badge><span className="font-medium">{v.titulo}</span></div>
                      <div className="text-muted-foreground whitespace-pre-wrap line-clamp-3">{v.copy}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            {editing?.id ? <Button variant="ghost" size="sm" className="text-rose-600" onClick={excluir} disabled={salvando}><Trash2 className="w-4 h-4 mr-1" /> Excluir</Button> : <span />}
            <Button onClick={salvar} disabled={salvando || !editing?.plan_date}>{salvando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null} Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
