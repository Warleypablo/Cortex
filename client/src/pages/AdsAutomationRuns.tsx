import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  RefreshCw,
  Bot,
  Clock,
  CheckCircle2,
  XCircle,
  UploadCloud,
  MinusCircle,
  CalendarClock,
  ExternalLink,
  AlertTriangle,
  Layers,
  Film,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSetPageInfo } from "@/contexts/PageContext";

// ===================== tipos (espelham a API read-only) =====================

type StepStatus = "pending" | "running" | "done" | "failed" | "awaiting_manual_upload" | "skipped";
type RunStatus = "running" | "success" | "partial" | "error";

interface RunTotals {
  lotesTotal: number;
  lotesDone: number;
  lotesAwaitingUpload: number;
  lotesFailed: number;
  conjuntosCriados: number;
  adsCriados: number;
}
interface RunSummary {
  id: number;
  status: RunStatus;
  triggeredBy: string;
  weekOf: string;
  dryRun: boolean;
  totals: RunTotals;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
}
interface RunStep {
  id: number;
  ordem: number;
  loteNome: string | null;
  clickupTaskId: string;
  clickupParentId: string | null;
  clickupUrl: string | null;
  status: StepStatus;
  detalhe: string | null;
  warnings: string[];
  conjuntoId: string | null;
  adIds: string[];
  hasBookmark: boolean;
  attempts: number;
  startedAt: string | null;
  finishedAt: string | null;
}
interface RunDetail {
  run: RunSummary;
  steps: RunStep[];
}
interface NextInfo {
  nextRunAt: string;
  currentWeekOf: string;
  runExistsThisWeek: boolean;
  planned: Array<{ loteNome: string | null; clickupTaskId: string; status: StepStatus }>;
}

// ===================== mapeamento de status =====================

const STEP_META: Record<StepStatus, { label: string; border: string; text: string; bg: string }> = {
  pending: { label: "Na fila", border: "border-l-gray-300 dark:border-l-zinc-700", text: "text-muted-foreground", bg: "bg-gray-500/15" },
  running: { label: "Rodando", border: "border-l-amber-500", text: "text-amber-500", bg: "bg-amber-500/15" },
  done: { label: "Concluído", border: "border-l-emerald-500", text: "text-emerald-500", bg: "bg-emerald-500/15" },
  awaiting_manual_upload: { label: "Aguardando upload", border: "border-l-blue-500", text: "text-blue-500", bg: "bg-blue-500/15" },
  failed: { label: "Falhou", border: "border-l-red-500", text: "text-red-500", bg: "bg-red-500/15" },
  skipped: { label: "Pulado", border: "border-l-gray-300 dark:border-l-zinc-700", text: "text-muted-foreground", bg: "bg-gray-500/10" },
};

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "running":
      return <Loader2 className="w-4 h-4 text-amber-500 animate-spin shrink-0" />;
    case "done":
      return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
    case "awaiting_manual_upload":
      return <UploadCloud className="w-4 h-4 text-blue-500 shrink-0" />;
    case "failed":
      return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
    case "skipped":
      return <MinusCircle className="w-4 h-4 text-muted-foreground shrink-0" />;
    case "pending":
    default:
      return <Clock className="w-4 h-4 text-muted-foreground shrink-0" />;
  }
}

function StepBadge({ status }: { status: StepStatus }) {
  const m = STEP_META[status];
  return <Badge className={`${m.bg} ${m.text} border-transparent`}>{m.label}</Badge>;
}

const RUN_META: Record<RunStatus, { label: string; text: string; bg: string }> = {
  running: { label: "Rodando", text: "text-amber-500", bg: "bg-amber-500/15" },
  success: { label: "Sucesso", text: "text-emerald-500", bg: "bg-emerald-500/15" },
  partial: { label: "Parcial", text: "text-blue-500", bg: "bg-blue-500/15" },
  error: { label: "Erro", text: "text-red-500", bg: "bg-red-500/15" },
};

function RunBadge({ status, dryRun }: { status: RunStatus; dryRun: boolean }) {
  const m = RUN_META[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge className={`${m.bg} ${m.text} border-transparent`}>
        {status === "running" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
        {m.label}
      </Badge>
      {dryRun && <Badge className="bg-zinc-500/15 text-muted-foreground border-transparent">DRY-RUN</Badge>}
    </span>
  );
}

function relTime(iso: string | null): string {
  if (!iso) return "";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return "";
  }
}

// ===================== card de step =====================

function StepCard({ step }: { step: RunStep }) {
  const m = STEP_META[step.status];
  const pulse = step.status === "running" ? "animate-pulse" : "";
  return (
    <div
      className={`p-3 rounded-r-lg bg-muted/30 dark:bg-zinc-900/40 border-l-[3px] ${m.border} ${pulse}`}
      data-testid={`ads-step-${step.id}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <StepIcon status={step.status} />
        <span className="font-medium text-sm truncate flex-1">{step.loteNome || step.clickupTaskId}</span>
        <StepBadge status={step.status} />
      </div>
      {step.detalhe && <p className="text-xs text-muted-foreground ml-6 mb-1">{step.detalhe}</p>}
      <div className="ml-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {step.conjuntoId && (
          <span className="inline-flex items-center gap-1">
            <Layers className="w-3 h-3" /> conjunto {step.conjuntoId}
          </span>
        )}
        {step.adIds.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <Film className="w-3 h-3" /> {step.adIds.length} ad(s)
          </span>
        )}
        {step.finishedAt && <span>{relTime(step.finishedAt)}</span>}
        {step.attempts > 1 && <span>· {step.attempts} tentativas</span>}
        {step.clickupUrl && (
          <a
            href={step.clickupUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <ExternalLink className="w-3 h-3" /> ClickUp
          </a>
        )}
      </div>
      {step.warnings?.length > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400 ml-6 mt-1">⚠ {step.warnings.join(" · ")}</p>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string | number;
  icon: any;
  tone?: "ok" | "warn" | "err";
}) {
  const colors = { ok: "text-emerald-500", warn: "text-blue-500", err: "text-red-500" } as const;
  const c = tone ? colors[tone] : "";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold ${c}`}>{value}</p>
          </div>
          <Icon className={`h-5 w-5 ${c || "text-muted-foreground"}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title} {count > 0 && <span className="text-muted-foreground/70">({count})</span>}
      </h3>
      {count === 0 ? <p className="text-sm text-muted-foreground/70 italic">nada aqui</p> : children}
    </div>
  );
}

// ===================== página =====================

export default function AdsAutomationRuns() {
  useSetPageInfo("Automação de Ads", "O que o agente está fazendo, vai fazer e já fez");
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);

  const { data: runsData, refetch, isRefetching, isLoading } = useQuery<{ runs: RunSummary[] }>({
    queryKey: ["/api/ads-automation/runs"],
    refetchInterval: 10000,
  });
  const { data: nextData } = useQuery<NextInfo>({
    queryKey: ["/api/ads-automation/next"],
    refetchInterval: 30000,
  });

  const runs = runsData?.runs ?? [];
  // por padrão, mostra o run mais recente
  useEffect(() => {
    if (selectedRunId == null && runs.length) setSelectedRunId(runs[0].id);
  }, [runs, selectedRunId]);

  const anyRunning = runs.some((r) => r.status === "running");
  const { data: detail } = useQuery<RunDetail>({
    queryKey: ["/api/ads-automation/runs", selectedRunId],
    enabled: selectedRunId != null,
    refetchInterval: anyRunning ? 5000 : false,
  });

  const steps = detail?.steps ?? [];
  const grouped = useMemo(
    () => ({
      agora: steps.filter((s) => s.status === "running"),
      vaiFazer: steps.filter((s) => s.status === "pending"),
      jaFez: steps.filter((s) => ["done", "awaiting_manual_upload", "failed", "skipped"].includes(s.status)),
    }),
    [steps],
  );

  const nextLabel = nextData?.nextRunAt
    ? format(new Date(nextData.nextRunAt), "EEEE, dd/MM 'às' HH'h'", { locale: ptBR })
    : "—";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-ads-automation">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold leading-tight">Automação de Ads</h1>
            <p className="text-sm text-muted-foreground">
              Sobe conjuntos e anúncios toda segunda a partir das tasks "Subir ad" no ClickUp. Só visualização.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching} data-testid="btn-refresh">
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Próxima execução */}
      <Card className="border-dashed">
        <CardContent className="p-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Próxima execução</p>
              <p className="text-sm font-medium capitalize">{nextLabel}</p>
            </div>
          </div>
          {nextData && (
            <Badge className={nextData.runExistsThisWeek ? "bg-emerald-500/15 text-emerald-500 border-transparent" : "bg-gray-500/15 text-muted-foreground border-transparent"}>
              {nextData.runExistsThisWeek ? "Semana atual já rodou" : "Aguardando segunda"}
            </Badge>
          )}
          {nextData && nextData.planned.length > 0 && !anyRunning && (
            <span className="text-xs text-muted-foreground">{nextData.planned.length} lote(s) pendente(s) do último run</span>
          )}
        </CardContent>
      </Card>

      {/* Stats do run selecionado */}
      {detail && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Conjuntos criados" value={detail.run.totals.conjuntosCriados} icon={Layers} tone="ok" />
          <StatCard title="Anúncios criados" value={detail.run.totals.adsCriados} icon={Film} tone="ok" />
          <StatCard title="Aguardando upload" value={detail.run.totals.lotesAwaitingUpload} icon={UploadCloud} tone="warn" />
          <StatCard title="Falhas" value={detail.run.totals.lotesFailed} icon={AlertTriangle} tone={detail.run.totals.lotesFailed > 0 ? "err" : undefined} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Execução selecionada (Agora / Vai fazer / Já fez) */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">
                {detail ? (
                  <span className="flex items-center gap-2">
                    Execução de {detail.run.weekOf} <RunBadge status={detail.run.status} dryRun={detail.run.dryRun} />
                  </span>
                ) : (
                  "Execução"
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {!detail || steps.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum lote nesta execução ainda.</p>
              ) : (
                <>
                  <Section title="Agora" count={grouped.agora.length}>
                    <div className="space-y-2">{grouped.agora.map((s) => <StepCard key={s.id} step={s} />)}</div>
                  </Section>
                  <Section title="Vai fazer" count={grouped.vaiFazer.length}>
                    <div className="space-y-2">{grouped.vaiFazer.map((s) => <StepCard key={s.id} step={s} />)}</div>
                  </Section>
                  <Section title="Já fez" count={grouped.jaFez.length}>
                    <div className="space-y-2">{grouped.jaFez.map((s) => <StepCard key={s.id} step={s} />)}</div>
                  </Section>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Histórico de execuções */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma execução ainda.</p>
              ) : (
                runs.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRunId(r.id)}
                    className={`w-full text-left p-3 rounded-lg border transition hover:bg-muted ${
                      r.id === selectedRunId ? "border-primary/50 bg-muted/50" : "border-gray-200 dark:border-zinc-800"
                    }`}
                    data-testid={`ads-run-${r.id}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-medium">{r.weekOf}</span>
                      <RunBadge status={r.status} dryRun={r.dryRun} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      <span>{r.totals.conjuntosCriados} conj · {r.totals.adsCriados} ads</span>
                      {r.totals.lotesAwaitingUpload > 0 && <span className="text-blue-500">{r.totals.lotesAwaitingUpload} aguardando</span>}
                      {r.totals.lotesFailed > 0 && <span className="text-red-500">{r.totals.lotesFailed} falha(s)</span>}
                      <span>{relTime(r.startedAt)}</span>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
