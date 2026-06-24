import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Sprout, Instagram, Music2, Youtube, Linkedin,
  Loader2, PauseCircle, PlayCircle, ExternalLink,
} from "lucide-react";

// ── tipos do payload de /api/growth/organico/overview ──────────────────────
interface Setting { platform: string; agentEnabled: boolean; dryRun: boolean; updatedAt: string }
interface Run { platform: string; runId: string; status: string; dryRun: boolean; startedAt: string; finishedAt: string | null; counts: any }
interface Post {
  id: number; platform: string; taskName: string | null; postingDate: string | null;
  slot: string | null; tipoPost: string | null; assetCount: number | null;
  legendaSource: string | null; legendaLen: number | null; state: string; permalink: string | null;
}
interface Overview {
  today: string; platforms: string[]; settings: Setting[]; health: Run[]; queue: Post[]; history: Post[];
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

// estado do post → rótulo + cor (cores explícitas com variante dark)
const STATE_STYLES: Record<string, { label: string; className: string }> = {
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

export default function GrowthOrganico() {
  useSetPageInfo("Orgânico", "Publicação de conteúdo orgânico — IG, TikTok e além");
  const [plat, setPlat] = useState<string>("all");

  const { data, isLoading, isError } = useQuery<Overview>({
    queryKey: ["/api/growth/organico/overview"],
    refetchInterval: 20000, // sensação de "ao vivo"
  });

  const settings = data?.settings ?? [];
  const healthByPlat = useMemo(() => {
    const m = new Map<string, Run>();
    (data?.health ?? []).forEach((h) => m.set(h.platform, h));
    return m;
  }, [data]);

  const platforms = settings.length ? settings.map((s) => s.platform) : ["instagram", "tiktok"];
  const onlyPlat = (rows: Post[]) => (plat === "all" ? rows : rows.filter((r) => r.platform === plat));
  const queue = onlyPlat(data?.queue ?? []);
  const history = onlyPlat(data?.history ?? []);

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
              Não consegui carregar o painel. Confirme que a migration <code>content_*</code> foi
              aplicada no banco (<code>npm run db:push</code> ou rodar o SQL).
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
                />
              ))}
          </div>
        </section>

        {/* FILA */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Fila de publicação</h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Data</TableHead>
                    <TableHead>Slot</TableHead>
                    <TableHead>Rede</TableHead>
                    <TableHead>Post</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-center">Assets</TableHead>
                    <TableHead>Legenda</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <EmptyRow span={8}>
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando…
                    </EmptyRow>
                  )}
                  {!isLoading && queue.length === 0 && (
                    <EmptyRow span={8}>
                      Nada na fila. Quando houver task aprovada com data de hoje/futura, aparece aqui.
                    </EmptyRow>
                  )}
                  {queue.map((p) => (
                    <TableRow key={`${p.platform}-${p.id}`}>
                      <TableCell className="whitespace-nowrap">{fmtData(p.postingDate)}</TableCell>
                      <TableCell>{p.slot ?? "—"}</TableCell>
                      <TableCell><PlatformCell platform={p.platform} /></TableCell>
                      <TableCell className="max-w-[280px] truncate" title={p.taskName ?? ""}>{p.taskName ?? "—"}</TableCell>
                      <TableCell>{p.tipoPost ?? "—"}</TableCell>
                      <TableCell className="text-center">{p.assetCount ?? 0}</TableCell>
                      <TableCell><LegendaCell post={p} /></TableCell>
                      <TableCell><StateBadge state={p.state} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        {/* HISTÓRICO */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Histórico recente</h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Data</TableHead>
                    <TableHead>Rede</TableHead>
                    <TableHead>Post</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!isLoading && history.length === 0 && (
                    <EmptyRow span={5}>Sem publicações registradas ainda.</EmptyRow>
                  )}
                  {history.map((p) => (
                    <TableRow key={`${p.platform}-${p.id}`}>
                      <TableCell className="whitespace-nowrap">{fmtData(p.postingDate)}</TableCell>
                      <TableCell><PlatformCell platform={p.platform} /></TableCell>
                      <TableCell className="max-w-[280px] truncate" title={p.taskName ?? ""}>{p.taskName ?? "—"}</TableCell>
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
          Somente leitura (Fase 1). Os botões de publicar / retry / aprovar legenda entram na Fase 3.
          A produção do conteúdo segue no Google Doc + Drive + ClickUp — este painel só mostra e (em breve) opera.
        </p>
      </div>
    </div>
  );
}

// ── componentes auxiliares ─────────────────────────────────────────────────

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
      }`}
    >
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

function HealthCard({ platform, setting, run, loading }: { platform: string; setting?: Setting; run?: Run; loading: boolean }) {
  const enabled = setting?.agentEnabled ?? true;
  const dryRun = setting?.dryRun ?? true;
  const dot = !run
    ? "bg-zinc-400"
    : run.status === "error"
    ? "bg-red-500"
    : run.status === "ok"
    ? "bg-emerald-500"
    : "bg-amber-500";
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
