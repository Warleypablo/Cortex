import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CheckCircle2, XCircle, Pencil } from "lucide-react";
import {
  useProposeOptimization,
  usePatchProposal,
  useExecuteBatch,
  type OptimizationProposal,
  type ProposeResponse,
  type IgnoredEntity,
  type ExecuteResult,
} from "@/hooks/useAdsOptimization";
import { EditProposalSheet } from "./EditProposalSheet";

interface Props {
  open: boolean;
  onClose: () => void;
}

const ACTION_LABEL: Record<string, string> = {
  pause: "Pausar",
  reactivate: "Reativar",
  skip: "Pular",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Negada",
  edited: "Editada",
  executed: "Executada",
  failed: "Falhou",
};

export function AdsOptimizationDialog({ open, onClose }: Props) {
  const propose = useProposeOptimization();
  const patch = usePatchProposal();
  const execute = useExecuteBatch();

  const [batchId, setBatchId] = useState<string | null>(null);
  const [proposalsRunMeta, setProposalsRunMeta] = useState<{
    totalCandidates: number;
    totalEvaluated: number;
    ignored: IgnoredEntity[];
    lastSyncAt: string;
    ranSync: boolean;
  } | null>(null);
  const [executionResults, setExecutionResults] = useState<ExecuteResult[] | null>(null);
  const [editingProposal, setEditingProposal] =
    useState<OptimizationProposal | null>(null);

  // Query da lista após edits — sempre revalida do servidor.
  const { data: proposalsData, refetch: refetchProposals } = useQuery<{
    batchId: string;
    proposals: OptimizationProposal[];
  }>({
    queryKey: [`/api/growth/ads-optimization/proposals/${batchId}`],
    enabled: !!batchId,
  });

  const proposals = proposalsData?.proposals ?? [];

  useEffect(() => {
    if (!open) {
      setBatchId(null);
      setProposalsRunMeta(null);
      setExecutionResults(null);
      setEditingProposal(null);
    }
  }, [open]);

  function handleRunAgent() {
    setExecutionResults(null);
    propose.mutate(undefined, {
      onSuccess: (data: ProposeResponse) => {
        setBatchId(data.batchId);
        setProposalsRunMeta({
          totalCandidates: data.totalCandidates,
          totalEvaluated: data.totalEvaluated,
          ignored: data.ignored,
          lastSyncAt: data.lastSyncAt,
          ranSync: data.ranSync,
        });
      },
    });
  }

  function handleApprove(p: OptimizationProposal) {
    patch.mutate({ id: p.id, batchId: p.batchId, status: "approved" });
  }
  function handleReject(p: OptimizationProposal) {
    patch.mutate({ id: p.id, batchId: p.batchId, status: "rejected" });
  }

  function handleExecute() {
    if (!batchId) return;
    execute.mutate(
      { batchId },
      {
        onSuccess: (data) => {
          setExecutionResults(data.results);
          refetchProposals();
        },
      },
    );
  }

  const grouped = useMemo(() => {
    const map = new Map<string, OptimizationProposal[]>();
    for (const p of proposals) {
      const key = p.produto ?? "Sem produto";
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [proposals]);

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, edited: 0, rejected: 0, executed: 0, failed: 0 };
    for (const p of proposals) {
      c[p.status as keyof typeof c] = (c[p.status as keyof typeof c] ?? 0) + 1;
    }
    return c;
  }, [proposals]);

  const executableCount = counts.approved + counts.edited;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Otimização de Ads — Agente IA</DialogTitle>
            <DialogDescription>
              O agente analisa as campanhas dos últimos dias contra o playbook
              e propõe ações. Você revisa, edita se quiser, e aprova antes
              de qualquer execução real no Meta.
            </DialogDescription>
          </DialogHeader>

          {!batchId && !propose.isPending && (
            <div className="py-8 text-center">
              <Button onClick={handleRunAgent} size="lg">
                Analisar campanhas e gerar propostas
              </Button>
              <p className="mt-3 text-xs text-muted-foreground">
                Pode levar até 1 minuto (sincroniza dados do Meta primeiro).
              </p>
            </div>
          )}

          {propose.isPending && (
            <div className="py-12 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                Atualizando dados do Meta e analisando campanhas...
              </p>
            </div>
          )}

          {propose.error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mr-2 inline h-4 w-4" />
              {propose.error.message}
            </div>
          )}

          {batchId && proposalsRunMeta && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 p-3 text-xs">
                <span className="font-medium">
                  {proposalsRunMeta.totalCandidates} candidatas •{" "}
                  {proposalsRunMeta.totalEvaluated} avaliadas •{" "}
                  {proposals.length} propostas
                </span>
                <span className="text-muted-foreground">
                  · Última atualização Meta:{" "}
                  {new Date(proposalsRunMeta.lastSyncAt).toLocaleString("pt-BR")}
                </span>
                {proposalsRunMeta.ranSync && (
                  <Badge variant="outline" className="text-[10px]">
                    sync agora
                  </Badge>
                )}
              </div>

              {proposalsRunMeta.ignored.length > 0 && (
                <details className="rounded-md border border-border p-2 text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    {proposalsRunMeta.ignored.length} entidades ignoradas
                  </summary>
                  <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto pl-2">
                    {proposalsRunMeta.ignored.map((i, idx) => (
                      <li key={idx} className="text-muted-foreground">
                        <span className="font-mono">{i.id}</span> — {i.name} ·{" "}
                        <code>{i.reason}</code>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {proposals.length === 0 && (
                <div className="rounded-md border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  Nenhuma proposta gerada — nada nos últimos dias bate com as
                  regras do playbook.
                </div>
              )}

              {grouped.map(([produto, items]) => (
                <div key={produto} className="space-y-2">
                  <h4 className="text-sm font-semibold">
                    {produto}{" "}
                    <span className="font-normal text-muted-foreground">
                      ({items.length})
                    </span>
                  </h4>
                  <div className="space-y-2">
                    {items.map((p) => (
                      <ProposalCard
                        key={p.id}
                        proposal={p}
                        onApprove={() => handleApprove(p)}
                        onReject={() => handleReject(p)}
                        onEdit={() => setEditingProposal(p)}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {executionResults && (
                <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                  <div className="font-medium">Execução concluída</div>
                  <ul className="mt-2 space-y-1 text-xs">
                    {executionResults.map((r) => (
                      <li
                        key={r.id}
                        className={
                          r.status === "executed"
                            ? "text-green-600 dark:text-green-400"
                            : "text-destructive"
                        }
                      >
                        #{r.id} {r.status} {r.note ? `· ${r.note}` : ""}{" "}
                        {r.error ? `· ${r.error}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {batchId && proposals.length > 0 && (
            <DialogFooter className="flex-wrap gap-2 sm:justify-between">
              <div className="text-xs text-muted-foreground">
                {counts.approved + counts.edited} a executar ·{" "}
                {counts.rejected} negadas · {counts.pending} pendentes ·{" "}
                {counts.executed} executadas · {counts.failed} falharam
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Fechar
                </Button>
                <Button
                  onClick={handleExecute}
                  disabled={execute.isPending || executableCount === 0}
                >
                  {execute.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Executar {executableCount} no Meta
                </Button>
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {editingProposal && (
        <EditProposalSheet
          proposal={editingProposal}
          open={!!editingProposal}
          onClose={() => setEditingProposal(null)}
        />
      )}
    </>
  );
}

interface ProposalCardProps {
  proposal: OptimizationProposal;
  onApprove: () => void;
  onReject: () => void;
  onEdit: () => void;
}

function ProposalCard({ proposal, onApprove, onReject, onEdit }: ProposalCardProps) {
  const isFinal = proposal.status === "executed" || proposal.status === "failed";
  const isReviewed =
    proposal.status === "approved" ||
    proposal.status === "rejected" ||
    proposal.status === "edited";

  const action = proposal.finalAction ?? proposal.proposedAction;
  const entityName = proposal.finalEntityName ?? proposal.proposedEntityName ?? "";
  const entityType = proposal.finalEntityType ?? proposal.proposedEntityType;

  const metricsSummary = formatMetricsSummary(proposal.currentMetrics);

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                action === "pause"
                  ? "destructive"
                  : action === "reactivate"
                    ? "default"
                    : "secondary"
              }
            >
              {ACTION_LABEL[action] ?? action}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {entityType}
            </Badge>
            {proposal.playbookRule && (
              <Badge variant="secondary" className="text-[10px]">
                {proposal.playbookRule}
              </Badge>
            )}
            <Badge
              variant={
                proposal.status === "executed"
                  ? "default"
                  : proposal.status === "failed"
                    ? "destructive"
                    : "outline"
              }
              className="text-[10px]"
            >
              {STATUS_LABEL[proposal.status]}
            </Badge>
          </div>
          <div className="text-sm font-medium">{entityName}</div>
          <p className="text-xs text-muted-foreground">{proposal.reason}</p>
          {metricsSummary && (
            <p className="text-[11px] text-muted-foreground/80">{metricsSummary}</p>
          )}
          {proposal.editNotes && (
            <p className="text-[11px] italic text-muted-foreground">
              Notas: {proposal.editNotes}
            </p>
          )}
          {proposal.executionError && (
            <p className="text-[11px] text-destructive">
              Erro: {proposal.executionError}
            </p>
          )}
        </div>

        {!isFinal && (
          <div className="flex shrink-0 flex-col gap-1">
            {!isReviewed && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={onApprove}
                >
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={onEdit}
                >
                  <Pencil className="mr-1 h-3 w-3" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={onReject}
                >
                  <XCircle className="mr-1 h-3 w-3" />
                  Negar
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatMetricsSummary(metrics: Record<string, unknown>): string | null {
  if (!metrics || typeof metrics !== "object") return null;
  const m = metrics as Record<string, any>;
  const parts: string[] = [];

  if (m.cpmql_alvo !== undefined) {
    parts.push(`alvo CPMQL R$ ${m.cpmql_alvo}`);
  }
  if (m.mql_min_pct !== undefined && m.mql_min_pct !== null) {
    parts.push(`%MQL min ${m.mql_min_pct}%`);
  }
  if (m.age_in_days !== undefined) parts.push(`${m.age_in_days}d ativo`);
  if (m.is_scaled !== undefined) parts.push(m.is_scaled ? "escalado" : "base");

  const d14 = m.d14 ?? {};
  if (d14.cpmql !== undefined && d14.cpmql !== null) {
    const zona = d14.zona ? ` (${d14.zona})` : "";
    parts.push(`14d: CPMQL R$ ${d14.cpmql}${zona}, ${d14.leads ?? 0} leads, ${d14.mqls ?? 0} MQLs`);
  } else if (d14.spend !== undefined) {
    parts.push(`14d: gasto R$ ${d14.spend}, ${d14.leads ?? 0} leads`);
  }

  return parts.join(" · ");
}
