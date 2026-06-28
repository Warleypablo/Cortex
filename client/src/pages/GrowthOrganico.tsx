import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
  Sprout, Instagram, Music2, Youtube, Linkedin, Loader2, PauseCircle, PlayCircle,
  ExternalLink, Send, CalendarClock, CalendarX, AlertTriangle,
  CalendarDays, List, ChevronLeft, ChevronRight,
} from "lucide-react";

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
}
interface Overview {
  today: string; platforms: string[]; settings: Setting[]; health: Run[];
  aprovados: Post[]; agendados: Post[]; publicados: Post[]; posts: Post[];
}

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", linkedin: "LinkedIn",
};

function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  switch (platform) {
    case "instagram": return <Instagram className={className} />;
    case "tiktok": return <Music2 className={className} />;
    case "youtube": return <Youtube className={className} />;
    case "linkedin": return <Linkedin className={className} />;
    default: return <Sprout className={className} />;
  }
}

const STATE_STYLES: Record<string, { label: string; className: string }> = {
  aprovado: { label: "Aprovado", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  agendado: { label: "Agendado", className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  aguardando_ia: { label: "Aguardando IA", className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  publicado: { label: "Publicado", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  falhou: { label: "Falhou", className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  pulado: { label: "Pulado", className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
};

function StateBadge({ state }: { state: string }) {
  const s = STATE_STYLES[state] ?? { label: state, className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" };
  return <Badge variant="outline" className={`border-0 ${s.className}`}>{s.label}</Badge>;
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

function TimeBadge({ ts }: { ts: TimeState }) {
  if (ts === "atrasado")
    return <Badge variant="outline" className="border-0 bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">Atrasado</Badge>;
  if (ts === "perdeu")
    return <Badge variant="outline" className="border-0 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">Perdeu o horário</Badge>;
  return null;
}

// ── Fase 2: prontidão por card → pílula do calendário ───────────────────────
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

export default function GrowthOrganico() {
  useSetPageInfo("Orgânico", "Publicação de conteúdo orgânico — IG, TikTok e além");
  const [plat, setPlat] = useState<string>("all");
  const [confirmPost, setConfirmPost] = useState<Post | null>(null);
  const [schedulePost, setSchedulePost] = useState<Post | null>(null);
  const [view, setView] = useState<"calendario" | "listas">("calendario");
  const [monthDate, setMonthDate] = useState<Date>(() => new Date());

  const qc = useQueryClient();
  const { toast } = useToast();
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

  const inFlightTask = commandMut.isPending ? (commandMut.variables as any)?.clickupTaskId : null;

  const settings = data?.settings ?? [];
  const healthByPlat = useMemo(() => {
    const m = new Map<string, Run>();
    (data?.health ?? []).forEach((h) => m.set(h.platform, h));
    return m;
  }, [data]);

  const platforms = settings.length ? settings.map((s) => s.platform) : ["instagram", "tiktok"];
  const onlyPlat = (rows: Post[]) => (plat === "all" ? rows : rows.filter((r) => r.platform === plat));
  const aprovados = onlyPlat(data?.aprovados ?? []);
  const agendados = onlyPlat(data?.agendados ?? []);
  const publicados = onlyPlat(data?.publicados ?? []);
  const allPosts = onlyPlat(data?.posts ?? []);  // conjunto completo p/ o calendário

  const agentActiveFor = (platform: string) =>
    settings.find((s) => s.platform === platform)?.agentEnabled ?? true;
  const tsOf = (p: Post) => timeState(p, agentActiveFor(p.platform));
  // posts que passaram do horário e NÃO vão sair sozinhos → alimentam o banner de alerta
  const perdidos = agendados.filter((p) => tsOf(p) === "perdeu");

  // conflito de horário: 2+ posts da MESMA rede no MESMO horário efetivo (minuto).
  // Regra: nunca deve sair mais de um post no mesmo horário.
  const horarioKey = (p: Post) => {
    const eff = effectiveWhen(p);
    return eff ? `${p.platform}|${new Date(eff).toISOString().slice(0, 16)}` : null;
  };
  const horarioCount = new Map<string, number>();
  agendados.forEach((p) => {
    const k = horarioKey(p);
    if (k) horarioCount.set(k, (horarioCount.get(k) ?? 0) + 1);
  });
  const emConflito = (p: Post) => {
    const k = horarioKey(p);
    return !!k && (horarioCount.get(k) ?? 0) > 1;
  };
  const temConflito = agendados.some(emConflito);

  const runNow = (p: Post) =>
    commandMut.mutate({ platform: p.platform, clickupTaskId: p.clickupTaskId, action: "publish_now" });
  const doSchedule = (p: Post, whenIso: string) =>
    commandMut.mutate({ platform: p.platform, clickupTaskId: p.clickupTaskId, action: "schedule", payload: { scheduled_at: whenIso } });
  const cancelSchedule = (p: Post) =>
    commandMut.mutate({ platform: p.platform, clickupTaskId: p.clickupTaskId, action: "cancel_schedule" });

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-4 space-y-5">
        {/* filtro de plataforma */}
        <div className="flex items-center gap-2 flex-wrap">
          <Sprout className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-sm font-semibold mr-2">Orgânico</span>
          <Chip active={plat === "all"} onClick={() => setPlat("all")}>Todos</Chip>
          {platforms.map((p) => (
            <Chip key={p} active={plat === p} onClick={() => setPlat(p)}>
              <PlatformIcon platform={p} className="h-3.5 w-3.5" />
              {PLATFORM_LABEL[p] ?? p}
            </Chip>
          ))}
          <div className="ml-auto inline-flex items-center gap-1.5">
            <Chip active={view === "calendario"} onClick={() => setView("calendario")}>
              <CalendarDays className="h-3.5 w-3.5" />Calendário
            </Chip>
            <Chip active={view === "listas"} onClick={() => setView("listas")}>
              <List className="h-3.5 w-3.5" />Listas
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
                    <span key={`${p.platform}-${p.id}`} className="truncate">
                      "{p.taskName ?? "—"}" · {fmtDataHora(effectiveWhen(p))} ·{" "}
                      {motivoPerdeu(p, agentActiveFor(p.platform))}
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
                  ajuste o campo <strong>Horário</strong> no card pra dar um horário diferente a cada um.
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
            {platforms
              .filter((p) => plat === "all" || p === plat)
              .map((p) => (
                <HealthCard
                  key={p}
                  platform={p}
                  setting={settings.find((x) => x.platform === p)}
                  run={healthByPlat.get(p)}
                  loading={isLoading}
                  onToggleAgent={(enabled) => settingsMut.mutate({ platform: p, agentEnabled: enabled })}
                  toggling={settingsMut.isPending && (settingsMut.variables as any)?.platform === p}
                />
              ))}
          </div>
        </section>

        {/* CALENDÁRIO DE PRONTIDÃO (Fase 2) — a cor de cada card vem do readiness do worker */}
        {view === "calendario" && (
          <CalendarSection
            posts={allPosts}
            monthDate={monthDate}
            settings={settings}
            loading={isLoading}
            onPrev={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            onNext={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            onToday={() => setMonthDate(new Date())}
          />
        )}

        {view === "listas" && (
          <>
        {/* (A) APROVADOS — com ações */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Aprovados <span className="text-xs font-normal">({aprovados.length})</span>
          </h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Rede</TableHead>
                    <TableHead>Post</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-center">Assets</TableHead>
                    <TableHead>Legenda</TableHead>
                    <TableHead>Data plan.</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && <EmptyRow span={7}><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando…</EmptyRow>}
                  {!isLoading && aprovados.length === 0 && (
                    <EmptyRow span={7}>Nenhum post aprovado aguardando ação.</EmptyRow>
                  )}
                  {aprovados.map((p) => (
                    <TableRow key={`${p.platform}-${p.id}`}>
                      <TableCell><PlatformCell platform={p.platform} /></TableCell>
                      <TableCell className="max-w-[260px] truncate" title={p.taskName ?? ""}>{p.taskName ?? "—"}</TableCell>
                      <TableCell>{p.tipoPost ?? "—"}</TableCell>
                      <TableCell className="text-center">{p.assetCount ?? 0}</TableCell>
                      <TableCell><LegendaCell post={p} /></TableCell>
                      <TableCell className="whitespace-nowrap">
                        {fmtData(p.postingDate)}
                        {p.postingDate && (
                          <span className="text-xs text-amber-600 dark:text-amber-400 ml-1">· sem horário</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <ClickUpButton post={p} />
                          <Button size="sm" variant="default" className="h-7 px-2"
                            disabled={commandMut.isPending}
                            onClick={() => setConfirmPost(p)}>
                            {inFlightTask === p.clickupTaskId
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Send className="h-3.5 w-3.5" />}
                            <span className="ml-1">Soltar agora</span>
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 px-2"
                            disabled={commandMut.isPending}
                            onClick={() => setSchedulePost(p)}>
                            <CalendarClock className="h-3.5 w-3.5" /><span className="ml-1">Agendar</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        {/* (B) AGENDADOS */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Agendados <span className="text-xs font-normal">({agendados.length})</span>
          </h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Quando</TableHead>
                    <TableHead>Rede</TableHead>
                    <TableHead>Post</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!isLoading && agendados.length === 0 && (
                    <EmptyRow span={6}>Nada agendado.</EmptyRow>
                  )}
                  {agendados.map((p) => {
                    const eff = effectiveWhen(p);
                    return (
                    <TableRow key={`${p.platform}-${p.id}`}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {eff ? (
                          <>
                            {fmtDataHora(eff)}
                            {!p.scheduledAt && !p.postingTime && p.cardScheduledAt && (
                              <span className="text-xs font-normal text-muted-foreground ml-1">(padrão)</span>
                            )}
                          </>
                        ) : `${fmtData(p.postingDate)}${p.slot ? ` · ${p.slot}` : ""}`}
                      </TableCell>
                      <TableCell><PlatformCell platform={p.platform} /></TableCell>
                      <TableCell className="max-w-[260px] truncate" title={p.taskName ?? ""}>{p.taskName ?? "—"}</TableCell>
                      <TableCell>{p.tipoPost ?? "—"}</TableCell>
                      <TableCell>
                        <div className="inline-flex items-center gap-1.5 flex-wrap">
                          <StateBadge state={p.state} />
                          <TimeBadge ts={tsOf(p)} />
                          {emConflito(p) && (
                            <Badge variant="outline" className="border-0 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                              Mesmo horário
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <ClickUpButton post={p} />
                          <Button size="sm" variant="default" className="h-7 px-2"
                            disabled={commandMut.isPending} onClick={() => setConfirmPost(p)}>
                            <Send className="h-3.5 w-3.5" /><span className="ml-1">Soltar agora</span>
                          </Button>
                          {p.scheduledAt && (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground"
                              disabled={commandMut.isPending} onClick={() => cancelSchedule(p)}>
                              <CalendarX className="h-3.5 w-3.5" /><span className="ml-1">Cancelar</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        {/* (C) PUBLICADOS DO DIA */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Publicados hoje <span className="text-xs font-normal">({publicados.length})</span>
          </h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Rede</TableHead>
                    <TableHead>Post</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!isLoading && publicados.length === 0 && (
                    <EmptyRow span={5}>Nada publicado hoje ainda.</EmptyRow>
                  )}
                  {publicados.map((p) => (
                    <TableRow key={`${p.platform}-${p.id}`}>
                      <TableCell><PlatformCell platform={p.platform} /></TableCell>
                      <TableCell className="max-w-[280px] truncate" title={p.taskName ?? ""}>{p.taskName ?? "—"}</TableCell>
                      <TableCell>{p.tipoPost ?? "—"}</TableCell>
                      <TableCell><StateBadge state={p.state} /></TableCell>
                      <TableCell>
                        <div className="inline-flex items-center gap-1.5">
                          <ClickUpButton post={p} />
                          {p.permalink && (
                            <a href={p.permalink} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline">
                              abrir post <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        <p className="text-xs text-muted-foreground">
          O horário de cada post vem do próprio card (campo <strong>Horário</strong> + <strong>Data de postagem</strong>);
          "Reagendar" sobrescreve pontualmente e "Soltar agora" publica no próximo ciclo. <span className="text-orange-600 dark:text-orange-400">Atrasado</span> = passou
          da hora mas ainda sai; <span className="text-red-600 dark:text-red-400">Perdeu o horário</span> = não sai sozinho, precisa de você.
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
              Vai publicar <strong>{confirmPost?.taskName ?? "este post"}</strong> em{" "}
              {PLATFORM_LABEL[confirmPost?.platform ?? ""] ?? confirmPost?.platform} no próximo ciclo do agente.
              Publicação é irreversível na conta real.
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

function PlatformCell({ platform }: { platform: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <PlatformIcon platform={platform} className="h-4 w-4" />
      {PLATFORM_LABEL[platform] ?? platform}
    </span>
  );
}

function LegendaCell({ post }: { post: Post }) {
  if (post.legendaSource === "doc")
    return <span className="text-xs text-muted-foreground">Doc ({post.legendaLen ?? 0})</span>;
  if (post.legendaSource === "ia" || post.legendaSource === "claude-precisa")
    return <Badge variant="outline" className="border-0 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">IA</Badge>;
  return <span className="text-xs text-muted-foreground">—</span>;
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

function HealthCard({ platform, setting, run, loading, onToggleAgent, toggling }: {
  platform: string; setting?: Setting; run?: Run; loading: boolean;
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
            <PlatformIcon platform={platform} className="h-4 w-4" />
            {PLATFORM_LABEL[platform] ?? platform}
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
          <Button size="sm" variant="ghost" className="h-6 px-2 ml-auto text-xs"
            disabled={toggling} onClick={() => onToggleAgent(!enabled)}>
            {toggling ? <Loader2 className="h-3 w-3 animate-spin" /> : enabled ? "Pausar" : "Retomar"}
          </Button>
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

// ── Fase 2: Calendário de Prontidão (grade do mês + resumo/legenda) ─────────
function CalendarSection({ posts, monthDate, settings, loading, onPrev, onNext, onToday }: {
  posts: Post[]; monthDate: Date; settings: Setting[]; loading: boolean;
  onPrev: () => void; onNext: () => void; onToday: () => void;
}) {
  const publishingFor = (platform: string) => {
    const s = settings.find((x) => x.platform === platform);
    return (s?.agentEnabled ?? true) && !(s?.dryRun ?? true);
  };
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
  const semData = posts.filter((p) => !postDayKey(p)).length;  // somem do calendário → avisar

  // resumo do mês visível (conta por tipo de pílula)
  const summary: Partial<Record<PillKind, number>> = {};
  for (const p of posts) {
    const k = postDayKey(p);
    if (!k || !k.startsWith(monthPrefix)) continue;
    const kind = pillKind(p, publishingFor(p.platform));
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
            {semData} sem data — veja em "Listas"
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
                    <CalPill key={`${p.platform}-${p.id}`} post={p} publishing={publishingFor(p.platform)} />
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
