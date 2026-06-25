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
  ExternalLink, Send, CalendarClock, CalendarX,
} from "lucide-react";

// ── tipos do payload de /api/growth/organico/overview ──────────────────────
interface Setting { platform: string; agentEnabled: boolean; dryRun: boolean; updatedAt: string }
interface Run { platform: string; runId: string; status: string; dryRun: boolean; startedAt: string; finishedAt: string | null; counts: any }
interface Post {
  id: number; platform: string; clickupTaskId: string; taskName: string | null;
  postingDate: string | null; slot: string | null; scheduledAt: string | null;
  tipoPost: string | null; assetCount: number | null; legendaSource: string | null;
  legendaLen: number | null; state: string; permalink: string | null; clickupUrl: string | null;
}
interface Overview {
  today: string; platforms: string[]; settings: Setting[]; health: Run[];
  aprovados: Post[]; agendados: Post[]; publicados: Post[];
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

export default function GrowthOrganico() {
  useSetPageInfo("Orgânico", "Publicação de conteúdo orgânico — IG, TikTok e além");
  const [plat, setPlat] = useState<string>("all");
  const [confirmPost, setConfirmPost] = useState<Post | null>(null);
  const [schedulePost, setSchedulePost] = useState<Post | null>(null);

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
        </div>

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
                      <TableCell className="whitespace-nowrap">{fmtData(p.postingDate)}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
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
                  {agendados.map((p) => (
                    <TableRow key={`${p.platform}-${p.id}`}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {p.scheduledAt ? fmtDataHora(p.scheduledAt) : `${fmtData(p.postingDate)}${p.slot ? ` · ${p.slot}` : ""}`}
                      </TableCell>
                      <TableCell><PlatformCell platform={p.platform} /></TableCell>
                      <TableCell className="max-w-[260px] truncate" title={p.taskName ?? ""}>{p.taskName ?? "—"}</TableCell>
                      <TableCell>{p.tipoPost ?? "—"}</TableCell>
                      <TableCell><StateBadge state={p.state} /></TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
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
                  ))}
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
                        {p.permalink ? (
                          <a href={p.permalink} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline">
                            abrir <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        <p className="text-xs text-muted-foreground">
          "Soltar agora" enfileira a publicação imediata; "Agendar" escolhe data/hora. A produção do conteúdo
          segue no Google Doc + Drive + ClickUp — este painel mostra e opera a fila.
        </p>
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
