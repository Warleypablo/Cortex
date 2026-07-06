import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/components/ThemeProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Sprout, Instagram, Loader2, PauseCircle, PlayCircle,
  ExternalLink, Send, CalendarClock, CalendarX, AlertTriangle,
  CalendarDays, BarChart3, ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

// ── tipos do payload de /api/growth/organico/overview ──────────────────────
interface Setting { platform: string; agentEnabled: boolean; dryRun: boolean; updatedAt: string }
interface Run { platform: string; runId: string; status: string; dryRun: boolean; startedAt: string; finishedAt: string | null; counts: any }
interface Post {
  id: number; platform: string; clickupTaskId: string; taskName: string | null;
  postingDate: string | null; postingTime: string | null; slot: string | null;
  scheduledAt: string | null; cardScheduledAt: string | null;
  tipoPost: string | null; assetCount: number | null; legendaSource: string | null;
  legendaLen: number | null; state: string; permalink: string | null; clickupUrl: string | null;
  readiness: string | null; blockReasons: string[] | null;
  updatedAt: string | null;   // último toque do worker (deriva a cada report)
  publishedAt: string | null; // carimbo REAL da publicação (não deriva)
}
interface Overview {
  today: string; platforms: string[]; settings: Setting[]; health: Run[];
  aprovados: Post[]; agendados: Post[]; publicados: Post[]; posts: Post[];
}

function minutosAtras(iso?: string | null): string {
  if (!iso) return "nunca rodou";
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

function fmtData(d?: string | null): string {
  if (!d) return "—";
  const s = String(d).slice(0, 10);
  const [, m, day] = s.split("-");
  return day && m ? `${day}/${m}` : s;
}

function fmtDataHora(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── horário-por-card: tempo efetivo + estado de atraso ─────────────────────
// Horário em que o post DEVE sair: override do operador (scheduledAt) tem prioridade;
// senão o horário-alvo vindo do card (cardScheduledAt = Data de postagem + Horário).
function effectiveWhen(p: Post): string | null {
  return p.scheduledAt ?? p.cardScheduledAt ?? null;
}

// Início do dia em São Paulo (UTC-3, sem horário de verão) em ms — separa
// "atrasado hoje (ainda sai)" de "perdeu (caiu num dia anterior)".
function startOfTodaySPms(): number {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  return new Date(`${ymd}T00:00:00-03:00`).getTime();
}

type TimeState = "futuro" | "atrasado" | "perdeu" | "none";

// Estado de TEMPO, sobreposto ao state do post:
//  futuro   = horário ainda não chegou
//  atrasado = passou da hora HOJE e vai sair (agente ativo, legenda ok)
//  perdeu   = passou e NÃO vai sair sozinho (agente pausado / legenda pendente /
//             erro / o dia já virou) → precisa de ação
function timeState(p: Post, agentActive: boolean): TimeState {
  const eff = effectiveWhen(p);
  if (!eff || p.state === "publicado" || p.state === "pulado") return "none";
  const t = new Date(eff).getTime();
  if (isNaN(t)) return "none";
  if (t > Date.now()) return "futuro";
  const legendaPendente =
    p.state === "aguardando_ia" || p.legendaSource === "ia" || p.legendaSource === "claude-precisa";
  if (t < startOfTodaySPms() || !agentActive || legendaPendente || p.state === "falhou") return "perdeu";
  return "atrasado";
}

function motivoPerdeu(p: Post, agentActive: boolean): string {
  if (!agentActive) return "agente pausado";
  if (p.state === "falhou") return "erro ao publicar";
  if (p.state === "aguardando_ia" || p.legendaSource === "ia" || p.legendaSource === "claude-precisa")
    return "legenda pendente";
  const eff = effectiveWhen(p);
  if (eff && new Date(eff).getTime() < startOfTodaySPms()) return "passou do dia";
  return "travado";
}

// ── prontidão por card (veredito do worker) ─────────────────────────────────
// O `readiness` vem do WORKER (autoritativo). Aqui só PINTAMOS + reconciliamos o que o
// front conhece e o worker não: override do operador (scheduledAt) e o estado GLOBAL
// (o agente está publicando? = ativo E não dry-run).
function readinessOf(p: Post): string {
  if (p.readiness) return p.readiness;
  // posts antigos/leftover sem readiness do worker: aproxima pelo state (legado)
  if (p.state === "publicado") return "published";
  if (p.state === "falhou") return "failed";
  if (p.state === "aguardando_ia" || p.state === "pulado") return "blocked";
  return "ready";
}
// 'horario' deixa de ser bloqueio quando o operador agendou (ele deu o horário)
function effectiveReasons(p: Post): string[] {
  return (p.blockReasons ?? []).filter((r) => !(r === "horario" && !!p.scheduledAt));
}

type PillKind =
  | "publicado" | "vai_sair" | "pronto_pausado" | "atrasado"
  | "perdeu" | "falta_algo" | "producao" | "falhou";

const REASON_LABEL: Record<string, string> = {
  legenda: "legenda", midia: "mídia", horario: "horário",
  google: "Google", erro: "erro", pulado: "incompleto",
};

function pillKind(p: Post, publishing: boolean): PillKind {
  const rd = readinessOf(p);
  if (rd === "published") return "publicado";
  if (rd === "failed") return "falhou";
  // sem veredito do worker (post legado/leftover) → NEUTRO; nunca inventamos "vai sair"
  if (p.readiness == null) return "producao";
  const reasons = effectiveReasons(p);
  const ready = rd === "ready" || (rd === "blocked" && p.readiness != null && reasons.length === 0);
  const eff = effectiveWhen(p);
  const now = Date.now();
  if (ready) {
    if (!eff) return "producao";
    const t = new Date(eff).getTime();
    if (t > now) return publishing ? "vai_sair" : "pronto_pausado";
    if (t >= startOfTodaySPms() && publishing) return "atrasado";
    return "perdeu";
  }
  // bloqueado por motivo real
  if (eff) {
    const t = new Date(eff).getTime();
    if (t < now) return "perdeu";
    if (t <= now + 48 * 3600_000) return "falta_algo";
  }
  return "producao";
}

// glyph = sinal de FORMA além da cor (acessibilidade: daltônico distingue sem hover)
const PILL_STYLES: Record<PillKind, { dot: string; chip: string; label: string; glyph: string }> = {
  vai_sair:       { glyph: "→", dot: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800/70", label: "vai sair" },
  publicado:      { glyph: "✓", dot: "bg-blue-500",    chip: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300/60 dark:border-blue-800/70", label: "publicado" },
  atrasado:       { glyph: "!", dot: "bg-orange-500",  chip: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border border-orange-300/60 dark:border-orange-800/70", label: "atrasado" },
  perdeu:         { glyph: "✕", dot: "bg-red-500",     chip: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-300/60 dark:border-red-800/70", label: "perdeu o horário" },
  falta_algo:     { glyph: "!", dot: "bg-amber-500",   chip: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800/70", label: "falta algo" },
  falhou:         { glyph: "✕", dot: "bg-red-600",     chip: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-400/60 dark:border-red-800/70", label: "falhou" },
  pronto_pausado: { glyph: "⏸", dot: "bg-zinc-400",    chip: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-300/50 dark:border-zinc-700", label: "pronto (pausado)" },
  producao:       { glyph: "·", dot: "bg-zinc-300 dark:bg-zinc-600", chip: "bg-zinc-50 text-zinc-500 dark:bg-zinc-900/60 dark:text-zinc-400 border border-dashed border-zinc-300 dark:border-zinc-700", label: "em produção" },
};

// dia-calendário (YYYY-MM-DD) de um ISO, no fuso de São Paulo
function spDayKey(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
}
function postDayKey(p: Post): string | null {
  return spDayKey(effectiveWhen(p)) ?? (p.postingDate ? String(p.postingDate).slice(0, 10) : null);
}
function fmtHora(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const h = parts.find((x) => x.type === "hour")?.value ?? "00";
  const m = parts.find((x) => x.type === "minute")?.value ?? "00";
  return `${h}:${m}`;
}

// ── aba "Como está indo": métricas derivadas dos posts ──────────────────────
// Tolerância de pontualidade: o publicador roda a cada 15min, então até ~20min
// depois do horário do card ainda conta como "no horário".
const TOLERANCIA_MIN = 20;

// dia planejado (YYYY-MM-DD) — coluna date do banco; NUNCA passar por fuso
function plannedDay(p: Post): string | null {
  return p.postingDate ? String(p.postingDate).slice(0, 10) : null;
}

// publicado de verdade? (state pode ficar 'agendado' em linhas antigas; publishedAt não mente)
function isPublished(p: Post): boolean {
  return p.state === "publicado" || !!p.publishedAt;
}

// momento da publicação: publishedAt (carimbo real) com fallback pro updatedAt de
// linhas antigas gravadas antes da coluna existir
function publishedMoment(p: Post): string | null {
  if (!isPublished(p)) return null;
  return p.publishedAt ?? p.updatedAt;
}

// atraso da publicação em minutos (null = sem horário-alvo pra comparar)
function delayMin(p: Post): number | null {
  const eff = effectiveWhen(p);
  const pub = publishedMoment(p);
  if (!eff || !pub) return null;
  const a = new Date(eff).getTime();
  const b = new Date(pub).getTime();
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / 60000);
}

function fmtAtraso(min: number): string {
  if (min < 60) return `+${min}min`;
  const h = Math.floor(min / 60);
  return `+${h}h${String(min % 60).padStart(2, "0")}`;
}

// soma dias a uma chave YYYY-MM-DD sem sofrer com fuso (ancora no meio-dia UTC)
function addDays(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function GrowthOrganico() {
  useSetPageInfo("Orgânico", "Publicação de conteúdo orgânico — Instagram");
  const [confirmPost, setConfirmPost] = useState<Post | null>(null);
  const [schedulePost, setSchedulePost] = useState<Post | null>(null);
  const [view, setView] = useState<"resumo" | "calendario">("resumo");
  const [monthDate, setMonthDate] = useState<Date>(() => new Date());

  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/growth/organico/overview"] });

  const { data, isLoading, isError } = useQuery<Overview>({
    queryKey: ["/api/growth/organico/overview"],
    refetchInterval: 20000,
  });

  const commandMut = useMutation({
    mutationFn: async (body: { platform: string; clickupTaskId?: string | null; action: string; payload?: any }) => {
      const res = await apiRequest("POST", "/api/growth/organico/commands", body);
      return res.json();
    },
    onSuccess: (_d, vars) => {
      invalidate();
      const msg: Record<string, string> = {
        publish_now: "Publicação enfileirada — o agente vai soltar no próximo ciclo.",
        schedule: "Agendamento criado.",
        cancel_schedule: "Agendamento cancelado.",
      };
      toast({ title: "Feito", description: msg[vars.action] ?? "Comando enviado." });
    },
    onError: (e: any) => toast({ title: "Falhou", description: String(e?.message ?? e), variant: "destructive" }),
  });

  const settingsMut = useMutation({
    mutationFn: async (body: { platform: string; agentEnabled?: boolean; dryRun?: boolean }) => {
      const res = await apiRequest("POST", "/api/growth/organico/settings", body);
      return res.json();
    },
    onSuccess: () => { invalidate(); toast({ title: "Configuração salva" }); },
    onError: (e: any) => toast({ title: "Falhou", description: String(e?.message ?? e), variant: "destructive" }),
  });

  // painel é só Instagram por ora (TikTok volta quando a automação de lá existir)
  const onlyIg = (rows: Post[]) => rows.filter((r) => r.platform === "instagram");
  const setting = (data?.settings ?? []).find((s) => s.platform === "instagram");
  const run = (data?.health ?? []).find((h) => h.platform === "instagram");
  const agendados = onlyIg(data?.agendados ?? []);
  const allPosts = onlyIg(data?.posts ?? []);

  const agentActive = setting?.agentEnabled ?? true;
  const publishing = agentActive && !(setting?.dryRun ?? true);
  // posts que passaram do horário e NÃO vão sair sozinhos → alimentam o banner de alerta
  const perdidos = agendados.filter((p) => timeState(p, agentActive) === "perdeu");

  // conflito de horário: 2+ posts no MESMO horário efetivo (minuto).
  // Regra: nunca deve sair mais de um post no mesmo horário.
  const horarioKey = (p: Post) => {
    const eff = effectiveWhen(p);
    return eff ? new Date(eff).toISOString().slice(0, 16) : null;
  };
  const horarioCount = new Map<string, number>();
  agendados.forEach((p) => {
    const k = horarioKey(p);
    if (k) horarioCount.set(k, (horarioCount.get(k) ?? 0) + 1);
  });
  const temConflito = agendados.some((p) => {
    const k = horarioKey(p);
    return !!k && (horarioCount.get(k) ?? 0) > 1;
  });

  const doSchedule = (p: Post, whenIso: string) =>
    commandMut.mutate({ platform: p.platform, clickupTaskId: p.clickupTaskId, action: "schedule", payload: { scheduled_at: whenIso } });
  const runNow = (p: Post) =>
    commandMut.mutate({ platform: p.platform, clickupTaskId: p.clickupTaskId, action: "publish_now" });

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-4 space-y-5">
        {/* cabeçalho + troca de visão */}
        <div className="flex items-center gap-2 flex-wrap">
          <Sprout className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-sm font-semibold">Orgânico</span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Instagram className="h-3.5 w-3.5" />Instagram
          </span>
          <div className="ml-auto inline-flex items-center gap-1.5">
            <Chip active={view === "resumo"} onClick={() => setView("resumo")}>
              <BarChart3 className="h-3.5 w-3.5" />Como está indo
            </Chip>
            <Chip active={view === "calendario"} onClick={() => setView("calendario")}>
              <CalendarDays className="h-3.5 w-3.5" />Calendário
            </Chip>
          </div>
        </div>

        {/* ALERTA — posts que passaram do horário e não saíram (precisam de ação) */}
        {perdidos.length > 0 && (
          <Card className="border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40">
            <CardContent className="p-3 flex items-start gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-red-700 dark:text-red-300">
                  {perdidos.length} post{perdidos.length > 1 ? "s passaram" : " passou"} do horário e não{" "}
                  {perdidos.length > 1 ? "saíram" : "saiu"}
                </span>
                <div className="text-red-700/80 dark:text-red-300/80 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                  {perdidos.slice(0, 3).map((p) => (
                    <span key={p.id} className="truncate">
                      "{p.taskName ?? "—"}" · {fmtDataHora(effectiveWhen(p))} · {motivoPerdeu(p, agentActive)}
                    </span>
                  ))}
                  {perdidos.length > 3 && <span>+{perdidos.length - 3}</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ALERTA — dois ou mais posts marcados pro mesmo horário (não pode sair junto) */}
        {temConflito && (
          <Card className="border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40">
            <CardContent className="p-3 flex items-start gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold text-amber-700 dark:text-amber-300">Conflito de horário</span>
                <span className="text-amber-700/80 dark:text-amber-300/80">
                  {" "}— há posts marcados pro mesmo horário. Nunca deve sair mais de um post na mesma hora;
                  ajuste a hora no campo <strong>Data de postagem</strong> pra dar um horário diferente a cada um.
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {isError && (
          <Card>
            <CardContent className="p-4 text-sm text-red-600 dark:text-red-400">
              Não consegui carregar o painel. Confirme que a migration <code>content_*</code> foi aplicada no banco.
            </CardContent>
          </Card>
        )}

        {/* SAÚDE DO AGENTE */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Saúde do agente</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <HealthCard
              setting={setting}
              run={run}
              loading={isLoading}
              canToggle={isAdmin}
              onToggleAgent={(enabled) => settingsMut.mutate({ platform: "instagram", agentEnabled: enabled })}
              toggling={settingsMut.isPending}
            />
          </div>
        </section>

        {/* COMO ESTÁ INDO — avaliação pro time: pontualidade, volume e gargalos */}
        {view === "resumo" && (
          <ResumoSection
            posts={allPosts}
            loading={isLoading}
            isAdmin={isAdmin}
            commandPending={commandMut.isPending}
            onPublishNow={setConfirmPost}
            onSchedule={setSchedulePost}
          />
        )}

        {/* CALENDÁRIO DE PRONTIDÃO — a cor de cada card vem do readiness do worker */}
        {view === "calendario" && (
          <>
            <CalendarSection
              posts={allPosts}
              monthDate={monthDate}
              publishing={publishing}
              loading={isLoading}
              onPrev={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              onNext={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              onToday={() => setMonthDate(new Date())}
            />
            <p className="text-xs text-muted-foreground">
              O horário de cada post vem do próprio card (hora dentro do campo <strong>Data de postagem</strong>).
              <span className="text-orange-600 dark:text-orange-400"> Atrasado</span> = passou da hora mas ainda sai;{" "}
              <span className="text-red-600 dark:text-red-400">perdeu o horário</span> = não sai sozinho, precisa de ação.
              A produção do conteúdo segue no Google Doc + Drive + ClickUp.
            </p>
          </>
        )}
      </div>

      {/* CONFIRMAÇÃO — Soltar agora (ação irreversível: publica na conta real) */}
      <AlertDialog open={!!confirmPost} onOpenChange={(o) => !o && setConfirmPost(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Soltar agora?</AlertDialogTitle>
            <AlertDialogDescription>
              Vai publicar <strong>{confirmPost?.taskName ?? "este post"}</strong> no Instagram no próximo
              ciclo do agente. Publicação é irreversível na conta real.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmPost) runNow(confirmPost); setConfirmPost(null); }}>
              Soltar agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AGENDAR — date-picker */}
      <ScheduleDialog
        post={schedulePost}
        onClose={() => setSchedulePost(null)}
        onConfirm={(whenIso) => { if (schedulePost) doSchedule(schedulePost, whenIso); setSchedulePost(null); }}
      />
    </div>
  );
}

// ── aba "Como está indo" ─────────────────────────────────────────────────────
// Cores das 2 séries validadas (lightness/chroma/CVD/contraste) contra superfície
// clara E escura — o mesmo par passa nos dois temas.
const COR_PLANEJADO = "#3b82f6";
const COR_PUBLICADO = "#059669";

function ResumoSection({ posts, loading, isAdmin, commandPending, onPublishNow, onSchedule }: {
  posts: Post[]; loading: boolean; isAdmin: boolean; commandPending: boolean;
  onPublishNow: (p: Post) => void; onSchedule: (p: Post) => void;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const chartColors = {
    grid: isDark ? "#27272a" : "#e5e7eb",
    axisLine: isDark ? "#3f3f46" : "#d1d5db",
    axisTick: isDark ? "#71717a" : "#6b7280",
  };

  const stats = useMemo(() => {
    const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    const monthPrefix = todayKey.slice(0, 7);

    // publicados no mês (pelo dia da PUBLICAÇÃO, em SP)
    const publicadosMes = posts.filter(
      (p) => isPublished(p) && (spDayKey(publishedMoment(p)) ?? "").startsWith(monthPrefix),
    );
    const comAlvo = publicadosMes.filter((p) => delayMin(p) != null);
    const noHorario = comAlvo.filter((p) => (delayMin(p) as number) <= TOLERANCIA_MIN);
    const atrasados = comAlvo.filter((p) => (delayMin(p) as number) > TOLERANCIA_MIN);

    // planejado pro mês que o dia passou e não saiu
    const naoSairam = posts.filter((p) => {
      const d = plannedDay(p);
      return !isPublished(p) && p.state !== "pulado" &&
        !!d && d < todayKey && d.startsWith(monthPrefix);
    });

    // planejado × publicado por semana (últimas 6, seg→dom, pelo dia PLANEJADO)
    const base = new Date(`${todayKey}T12:00:00Z`);
    base.setUTCDate(base.getUTCDate() - ((base.getUTCDay() + 6) % 7)); // segunda da semana atual
    const mondayKey = base.toISOString().slice(0, 10);
    const semanas = Array.from({ length: 6 }, (_, i) => {
      const ini = addDays(mondayKey, (i - 5) * 7);
      const fim = addDays(ini, 6);
      const daSemana = posts.filter((p) => {
        const d = plannedDay(p);
        return p.state !== "pulado" && !!d && d >= ini && d <= fim;
      });
      return {
        label: `${fmtData(ini)}–${fmtData(fim)}`,
        planejado: daSemana.length,
        publicado: daSemana.filter(isPublished).length,
      };
    });

    // o que está travando agora: bloqueios dos posts pendentes (recentes ou futuros)
    const corte = addDays(todayKey, -14);
    const travados = posts
      .filter((p) => {
        if (isPublished(p) || p.state === "pulado") return false;
        if (readinessOf(p) !== "blocked" || effectiveReasons(p).length === 0) return false;
        const d = plannedDay(p);
        return !d || d >= corte;
      })
      .sort((a, b) => String(plannedDay(a) ?? "9999").localeCompare(String(plannedDay(b) ?? "9999")));
    const motivos = new Map<string, number>();
    travados.forEach((p) =>
      effectiveReasons(p).forEach((r) => {
        const label = REASON_LABEL[r] ?? r;
        motivos.set(label, (motivos.get(label) ?? 0) + 1);
      }),
    );
    const motivosRank = Array.from(motivos.entries()).sort((a, b) => b[1] - a[1]);

    // feed dos últimos publicados (qualquer mês), mais recente primeiro
    const feed = posts
      .filter((p) => isPublished(p) && publishedMoment(p))
      .sort((a, b) => new Date(publishedMoment(b)!).getTime() - new Date(publishedMoment(a)!).getTime())
      .slice(0, 12);

    return { publicadosMes, comAlvo, noHorario, atrasados, naoSairam, semanas, travados, motivosRank, feed };
  }, [posts]);

  const pct = stats.comAlvo.length
    ? Math.round((stats.noHorario.length / stats.comAlvo.length) * 100)
    : null;

  return (
    <>
      {/* KPIs do mês */}
      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiTile label="Publicados no mês" value={String(stats.publicadosMes.length)} sub="posts no ar" />
        <KpiTile
          label="No horário"
          value={pct == null ? "—" : `${pct}%`}
          sub={pct == null ? "sem posts com horário ainda" : `${stats.noHorario.length} de ${stats.comAlvo.length} com horário`}
        />
        <KpiTile label="Atrasados" value={String(stats.atrasados.length)} sub={`saíram >${TOLERANCIA_MIN}min depois`} />
        <KpiTile label="Não saíram" value={String(stats.naoSairam.length)} sub="o dia passou sem publicar" tone={stats.naoSairam.length > 0 ? "bad" : undefined} />
      </section>

      {/* planejado × publicado por semana */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Planejado × publicado por semana</h2>
        <Card>
          <CardContent className="p-3 pt-4">
            {loading ? (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />Carregando…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.semanas} margin={{ top: 4, right: 8, left: -22, bottom: 0 }} barCategoryGap="28%" barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: chartColors.axisTick }}
                    axisLine={{ stroke: chartColors.axisLine }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: chartColors.axisTick }}
                    axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: isDark ? "#27272a55" : "#e5e7eb55" }}
                    contentStyle={{
                      backgroundColor: isDark ? "#18181b" : "#ffffff",
                      border: `1px solid ${chartColors.grid}`, borderRadius: 8, fontSize: 12,
                    }}
                    labelStyle={{ color: chartColors.axisTick }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {/* sem animação: com refetch a cada 20s a animação inicial trava as
                      barras em zero quando os dados chegam durante o primeiro paint */}
                  <Bar dataKey="planejado" name="Planejado" fill={COR_PLANEJADO} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                  <Bar dataKey="publicado" name="Publicado" fill={COR_PUBLICADO} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        {/* o que está travando agora */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            O que está travando <span className="text-xs font-normal">({stats.travados.length} post{stats.travados.length === 1 ? "" : "s"})</span>
          </h2>
          <Card>
            <CardContent className="p-3 space-y-3">
              {!loading && stats.travados.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">Nada travado — fila limpa. 🎉</p>
              )}

              {stats.motivosRank.length > 0 && (
                <div className="space-y-1.5">
                  {stats.motivosRank.map(([label, n]) => (
                    <div key={label} className="flex items-center gap-2 text-xs">
                      <span className="w-20 shrink-0 text-muted-foreground capitalize">{label}</span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-amber-500"
                          style={{ width: `${(n / stats.motivosRank[0][1]) * 100}%` }} />
                      </div>
                      <span className="w-6 text-right font-semibold tabular-nums">{n}</span>
                    </div>
                  ))}
                </div>
              )}

              {stats.travados.slice(0, 8).map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-sm border-t border-border pt-2 first:border-t-0 first:pt-0">
                  <div className="flex-1 min-w-0">
                    <div className="truncate" title={p.taskName ?? ""}>{p.taskName ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {plannedDay(p) ? fmtData(plannedDay(p)) : "sem data"} · falta:{" "}
                      {effectiveReasons(p).map((r) => REASON_LABEL[r] ?? r).join(", ")}
                    </div>
                  </div>
                  <ClickUpButton post={p} />
                  {isAdmin && (
                    <>
                      <Button size="sm" variant="outline" className="h-7 px-2" disabled={commandPending}
                        onClick={() => onSchedule(p)}>
                        <CalendarClock className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="default" className="h-7 px-2" disabled={commandPending}
                        onClick={() => onPublishNow(p)}>
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
              {stats.travados.length > 8 && (
                <p className="text-xs text-muted-foreground">+{stats.travados.length - 8} outros — veja o Calendário.</p>
              )}
            </CardContent>
          </Card>
        </section>

        {/* últimos publicados */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Últimos publicados</h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Quando</TableHead>
                    <TableHead>Post</TableHead>
                    <TableHead>Pontualidade</TableHead>
                    <TableHead className="text-right">Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && <EmptyRow span={4}><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando…</EmptyRow>}
                  {!loading && stats.feed.length === 0 && <EmptyRow span={4}>Nada publicado ainda.</EmptyRow>}
                  {stats.feed.map((p) => {
                    const d = delayMin(p);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap text-xs">{fmtDataHora(publishedMoment(p))}</TableCell>
                        <TableCell className="max-w-[220px] truncate" title={p.taskName ?? ""}>{p.taskName ?? "—"}</TableCell>
                        <TableCell>
                          {d == null ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : d <= TOLERANCIA_MIN ? (
                            <Badge variant="outline" className="border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">no horário</Badge>
                          ) : (
                            <Badge variant="outline" className="border-0 bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">{fmtAtraso(d)}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {p.permalink ? (
                            <a href={p.permalink} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap">
                              abrir post <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      </div>

      <p className="text-xs text-muted-foreground">
        <strong>No horário</strong> = publicado até {TOLERANCIA_MIN}min depois da hora do card (o publicador roda a
        cada 15min). <strong>Não saiu</strong> = o dia planejado passou sem publicação — os motivos aparecem em
        "O que está travando". A produção do conteúdo segue no Google Doc + Drive + ClickUp.
      </p>
    </>
  );
}

function KpiTile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "bad" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold tabular-nums mt-1 ${tone === "bad" ? "text-red-600 dark:text-red-400" : ""}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}

// ── Agendar: dialog com datetime-local ─────────────────────────────────────
function ScheduleDialog({ post, onClose, onConfirm }: {
  post: Post | null; onClose: () => void; onConfirm: (whenIso: string) => void;
}) {
  const [when, setWhen] = useState("");
  const open = !!post;

  // inicializa em now+1h sempre que abrir um post novo
  useEffect(() => { if (post) setWhen(toLocalInput(new Date(Date.now() + 60 * 60 * 1000))); }, [post?.id]);

  const whenDate = when ? new Date(when) : null;
  const valido = !!whenDate && !isNaN(whenDate.getTime()) && whenDate.getTime() > Date.now();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar post</DialogTitle>
          <DialogDescription className="truncate">{post?.taskName ?? ""}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="sched-when">Data e hora</Label>
          <Input id="sched-when" type="datetime-local" value={when}
            min={toLocalInput(new Date())} onChange={(e) => setWhen(e.target.value)} />
          {!valido && when && <p className="text-xs text-red-600 dark:text-red-400">Escolha um horário no futuro.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!valido} onClick={() => valido && whenDate && onConfirm(whenDate.toISOString())}>
            <CalendarClock className="h-4 w-4 mr-1" />Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── componentes auxiliares ─────────────────────────────────────────────────
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
      }`}>
      {children}
    </button>
  );
}

// Botão que abre o card correspondente no ClickUp. Usa a URL salva (clickupUrl)
// quando existe; senão monta a partir do task id (formato curto que redireciona).
function ClickUpButton({ post }: { post: Post }) {
  const url = post.clickupUrl ?? `https://app.clickup.com/t/${post.clickupTaskId}`;
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 px-2 text-muted-foreground"
      title="Abrir card no ClickUp"
      onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
    >
      <ExternalLink className="h-3.5 w-3.5" /><span className="ml-1">ClickUp</span>
    </Button>
  );
}

function EmptyRow({ span, children }: { span: number; children: ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={span} className="text-center text-sm text-muted-foreground py-8">{children}</TableCell>
    </TableRow>
  );
}

function HealthCard({ setting, run, loading, canToggle, onToggleAgent, toggling }: {
  setting?: Setting; run?: Run; loading: boolean; canToggle: boolean;
  onToggleAgent: (enabled: boolean) => void; toggling: boolean;
}) {
  const enabled = setting?.agentEnabled ?? true;
  const dryRun = setting?.dryRun ?? true;
  const dot = !run ? "bg-zinc-400"
    : run.status === "error" ? "bg-red-500"
    : run.status === "ok" ? "bg-emerald-500" : "bg-amber-500";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            <Instagram className="h-4 w-4" />
            Instagram
          </span>
          <span className={`h-2.5 w-2.5 rounded-full ${dot}`} title={run?.status ?? "sem ciclo"} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Último ciclo</span>
          <span>{loading ? "…" : minutosAtras(run?.startedAt)}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className={`border-0 ${enabled ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}>
            {enabled ? <><PlayCircle className="h-3 w-3 mr-1 inline" />Ativo</> : <><PauseCircle className="h-3 w-3 mr-1 inline" />Pausado</>}
          </Badge>
          <Badge variant="outline" className={`border-0 ${dryRun ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"}`}>
            {dryRun ? "Dry-run" : "Publicando"}
          </Badge>
          {canToggle && (
            <Button size="sm" variant="ghost" className="h-6 px-2 ml-auto text-xs"
              disabled={toggling} onClick={() => onToggleAgent(!enabled)}>
              {toggling ? <Loader2 className="h-3 w-3 animate-spin" /> : enabled ? "Pausar" : "Retomar"}
            </Button>
          )}
        </div>
        {run?.counts && (run.counts.published != null || run.counts.errors != null) && (
          <div className="text-xs text-muted-foreground">
            {run.counts.published != null && <>publicados: {run.counts.published}</>}
            {run.counts.published != null && run.counts.errors != null && <> · </>}
            {run.counts.errors != null && <>erros: {run.counts.errors}</>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Calendário de Prontidão (grade do mês + resumo/legenda) ─────────────────
function CalendarSection({ posts, monthDate, publishing, loading, onPrev, onNext, onToday }: {
  posts: Post[]; monthDate: Date; publishing: boolean; loading: boolean;
  onPrev: () => void; onNext: () => void; onToday: () => void;
}) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthPrefix = `${year}-${pad(month + 1)}`;

  // bucket de posts por dia-calendário
  const byDay = new Map<string, Post[]>();
  for (const p of posts) {
    const k = postDayKey(p);
    if (!k) continue;
    const arr = byDay.get(k);
    if (arr) arr.push(p); else byDay.set(k, [p]);
  }
  byDay.forEach((arr) =>
    arr.sort((a, b) => String(effectiveWhen(a) ?? "").localeCompare(String(effectiveWhen(b) ?? ""))));
  const semData = posts.filter((p) => !postDayKey(p) && p.state !== "pulado").length;

  // resumo do mês visível (conta por tipo de pílula)
  const summary: Partial<Record<PillKind, number>> = {};
  for (const p of posts) {
    const k = postDayKey(p);
    if (!k || !k.startsWith(monthPrefix)) continue;
    const kind = pillKind(p, publishing);
    summary[kind] = (summary[kind] ?? 0) + 1;
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = new Date(year, month, 1).getDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const monthName = new Date(year, month, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const summaryOrder: PillKind[] = ["vai_sair", "falta_algo", "producao", "perdeu", "atrasado", "publicado"];

  return (
    <section className="space-y-2">
      {/* resumo + legenda de cores (a cor nunca é o único sinal — sempre tem rótulo) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {summaryOrder.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${PILL_STYLES[k].dot}`} />
            {PILL_STYLES[k].label}
            <span className="font-semibold text-foreground">{summary[k] ?? 0}</span>
          </span>
        ))}
        {semData > 0 && (
          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400" title="Posts sem Data de postagem não aparecem no calendário">
            <AlertTriangle className="h-3 w-3" />
            {semData} sem data (fora do calendário)
          </span>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm capitalize">
            {monthName}
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin inline ml-2 text-muted-foreground" />}
          </CardTitle>
          <div className="inline-flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onToday}>Hoje</Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onPrev}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onNext}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="p-2">
          <div className="grid grid-cols-7 gap-1">
            {weekdays.map((w) => (
              <div key={w} className="text-[11px] font-medium text-muted-foreground text-center pb-1">{w}</div>
            ))}
            {cells.map((d, i) => {
              if (d === null) return <div key={`b${i}`} className="min-h-[92px] rounded-md bg-muted/20" />;
              const key = `${monthPrefix}-${pad(d)}`;
              const dayPosts = byDay.get(key) ?? [];
              const isToday = key === todayKey;
              return (
                <div key={key} className={`min-h-[92px] rounded-md border p-1 flex flex-col gap-1 overflow-hidden ${isToday ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                  <div className={`text-[11px] font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>{d}</div>
                  {dayPosts.slice(0, 4).map((p) => (
                    <CalPill key={p.id} post={p} publishing={publishing} />
                  ))}
                  {dayPosts.length > 4 && (
                    <span className="text-[10px] text-muted-foreground pl-0.5">+{dayPosts.length - 4} mais</span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function CalPill({ post, publishing }: { post: Post; publishing: boolean }) {
  const kind = pillKind(post, publishing);
  const s = PILL_STYLES[kind];
  const eff = effectiveWhen(post);
  const hora = fmtHora(eff);
  const reasons = effectiveReasons(post).map((r) => REASON_LABEL[r] ?? r);
  const tip = [
    post.taskName ?? "—",
    s.label + (hora ? ` · ${hora}` : ""),
    reasons.length ? `falta: ${reasons.join(", ")}` : "",
  ].filter(Boolean).join(" · ");
  const url = post.clickupUrl ?? `https://app.clickup.com/t/${post.clickupTaskId}`;
  const showHora = !!hora && (kind === "vai_sair" || kind === "atrasado" || kind === "perdeu" || kind === "publicado");
  return (
    <button
      type="button"
      title={tip}
      onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
      className={`w-full text-left rounded px-1 py-0.5 text-[10px] leading-tight flex items-center gap-1 ${s.chip} hover:opacity-80 transition-opacity`}
    >
      <span className="font-bold shrink-0 w-2.5 text-center leading-none" aria-hidden="true">{s.glyph}</span>
      {showHora && <span className="font-semibold tabular-nums shrink-0">{hora}</span>}
      <span className="truncate">{post.taskName ?? "—"}</span>
    </button>
  );
}
