import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Loader2, Info } from "lucide-react";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  PHASE_CONFIG,
  END_STATES,
  groupStatusIntoPhases,
  daysUntil,
  formatDate,
  type PrazoPorStatus,
} from "@/lib/tech-utils";

// ── Types ──────────────────────────────────────────────────────────────

interface TechMetricas {
  projetosEmAndamento: number;
  projetosFechados: number;
  totalTasks: number;
  valorTotalProjetos: number;
  valorMedioProjeto: number;
  tempoMedioEntrega: number;
}

interface BoardProject {
  clickup_task_id: string;
  task_name: string;
  data_vencimento: string | null;
  tags_ativas: string[];
  status_projeto: string;
  responsavel: string;
  [key: string]: any;
}

interface BoardGroup {
  responsavel: string;
  projetos: BoardProject[];
  total: number;
}

interface EntregaTrimestre {
  ano: number;
  trimestre: number;
  label: string;
  total_entregas: number;
  valor_medio: number;
  valor_total: number;
}

interface ProjetoEmAndamento {
  clickupTaskId: string;
  taskName: string;
  statusProjeto: string;
  responsavel: string;
  faseProjeto: string;
  tipo: string;
  tipoProjeto: string;
  valorP: number | null;
  dataVencimento: string | null;
  lancamento: string | null;
  dataCriada: string | null;
}

// ── Pipeline Snapshot Helpers ─────────────────────────────────────────

function classifyProjectPhase(status: string): string | null {
  const statusLower = status.toLowerCase().trim();
  if (END_STATES.includes(statusLower)) return null;
  for (const phase of PHASE_CONFIG) {
    if (phase.patterns.some((p) => statusLower.includes(p))) return phase.key;
  }
  return "backlog";
}

// ── Component ──────────────────────────────────────────────────────────

export default function TechOverview() {
  // ── Data fetching ──────────────────────────────────────────────────

  const { data: metricas, isLoading: loadingMetricas } = useQuery<TechMetricas>({
    queryKey: ["tech-metricas"],
    queryFn: () => fetch("/api/tech/metricas").then((r) => r.json()),
  });

  const { data: boardData, isLoading: loadingBoard } = useQuery<BoardGroup[]>({
    queryKey: ["tech-board"],
    queryFn: () => fetch("/api/tech/board").then((r) => r.json()),
  });

  const { data: prazoPorStatus, isLoading: loadingPrazo } = useQuery<PrazoPorStatus[]>({
    queryKey: ["tech-prazo-por-status"],
    queryFn: () => fetch("/api/tech/prazo-por-status").then((r) => r.json()),
  });

  const { data: entregasTrimestre, isLoading: loadingEntregas } = useQuery<EntregaTrimestre[]>({
    queryKey: ["tech-entregas-trimestre"],
    queryFn: () => fetch("/api/tech/entregas-trimestre").then((r) => r.json()),
  });

  const { data: projetosAndamento, isLoading: loadingProjetos } = useQuery<ProjetoEmAndamento[]>({
    queryKey: ["tech-projetos-em-andamento"],
    queryFn: () => fetch("/api/tech/projetos-em-andamento").then((r) => r.json()),
  });

  // ── Derived metrics ────────────────────────────────────────────────

  const allBoardProjects = useMemo<BoardProject[]>(() => {
    if (!boardData) return [];
    return boardData.flatMap((g) => g.projetos);
  }, [boardData]);

  const emRiscoCount = useMemo(() => {
    return allBoardProjects.filter((p) => {
      const days = daysUntil(p.data_vencimento);
      return days !== null && ((days <= 3 && days > 0) || days < 0);
    }).length;
  }, [allBoardProjects]);

  const taxaNoPrazo = useMemo(() => {
    if (!metricas) return 0;
    const overdue = allBoardProjects.filter((p) => {
      const days = daysUntil(p.data_vencimento);
      return days !== null && days < 0;
    }).length;
    const active = metricas.projetosEmAndamento;
    if (active === 0) return 100;
    return Math.round(((active - overdue) / active) * 100);
  }, [metricas, allBoardProjects]);

  // ── Pipeline Snapshot ──────────────────────────────────────────────

  const pipelineSnapshot = useMemo(() => {
    if (!allBoardProjects.length) return [];
    const counts: Record<string, number> = {};
    for (const p of allBoardProjects) {
      const phase = classifyProjectPhase(p.status_projeto || "");
      if (phase) counts[phase] = (counts[phase] || 0) + 1;
    }
    return PHASE_CONFIG.filter((ph) => counts[ph.key])
      .map((ph) => ({ key: ph.key, label: ph.label, color: ph.color, count: counts[ph.key] }));
  }, [allBoardProjects]);

  const pipelineTotal = pipelineSnapshot.reduce((s, p) => s + p.count, 0);

  // ── Proximos Vencimentos ───────────────────────────────────────────

  const proximosVencimentos = useMemo(() => {
    if (!projetosAndamento) return [];
    return [...projetosAndamento]
      .filter((p) => p.dataVencimento)
      .sort((a, b) => new Date(a.dataVencimento!).getTime() - new Date(b.dataVencimento!).getTime())
      .slice(0, 8);
  }, [projetosAndamento]);

  // ── Loading state ──────────────────────────────────────────────────

  if (loadingMetricas || loadingBoard) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* ── KPI Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-5">
          <div className="text-3xl font-light text-foreground">
            {metricas?.projetosEmAndamento ?? 0}
          </div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
            Projetos Ativos
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <div className="text-3xl font-light text-red-500">
            {emRiscoCount}
          </div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1 flex items-center gap-1.5">
            Em Risco
            <UITooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                Projetos com 3 dias ou menos até o vencimento, ou já vencidos.
              </TooltipContent>
            </UITooltip>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <div className="text-3xl font-light text-foreground">
            {Math.round(metricas?.tempoMedioEntrega ?? 0)}d
          </div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
            Tempo Medio
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <div className="text-3xl font-light text-foreground">
            {taxaNoPrazo}%
          </div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
            Taxa No Prazo
          </div>
        </div>
      </div>

      {/* ── Pipeline Snapshot ──────────────────────────────────────── */}
      {pipelineSnapshot.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Pipeline — {pipelineTotal} projetos
          </h3>
          <div className="flex rounded-md overflow-hidden h-7">
            {pipelineSnapshot.map((phase) => {
              const pct = (phase.count / pipelineTotal) * 100;
              return (
                <div
                  key={phase.key}
                  className="flex items-center justify-center text-[10px] font-medium text-white/90 transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: phase.color,
                    opacity: 0.7,
                    minWidth: pct > 3 ? undefined : "20px",
                  }}
                  title={`${phase.label}: ${phase.count}`}
                >
                  {pct > 8 && phase.count}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {pipelineSnapshot.map((phase) => (
              <div key={phase.key} className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: phase.color, opacity: 0.7 }}
                />
                <span className="text-xs text-muted-foreground">
                  {phase.label} ({phase.count})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Charts Row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prazo por Status */}
        <div className="rounded-lg border bg-card p-5">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-4">
            Prazo por Status
          </h3>
          {loadingPrazo ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : prazoPorStatus && prazoPorStatus.length > 0 ? (
            (() => {
              const grouped = groupStatusIntoPhases(prazoPorStatus);
              const barH = 36;
              const chartHeight = Math.max(220, grouped.length * barH + 40);
              return (
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <BarChart
                    layout="vertical"
                    data={grouped}
                    margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
                    barCategoryGap="20%"
                  >
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(v: number) => `${Math.round(v)}d`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      dataKey="label"
                      type="category"
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      width={140}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                      formatter={(value: number, _name: string, props: any) => [
                        `${value} dias (${props.payload.total_transicoes} transicoes)`,
                        "Media",
                      ]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                        color: "hsl(var(--foreground))",
                      }}
                      labelStyle={{ color: "hsl(var(--muted-foreground))", fontWeight: 600 }}
                    />
                    <Bar dataKey="media_dias" radius={[0, 4, 4, 0]} maxBarSize={24}>
                      {grouped.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} fillOpacity={0.7} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              );
            })()
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">
              Sem dados de prazo por status
            </p>
          )}
        </div>

        {/* Entregas por Trimestre */}
        <div className="rounded-lg border bg-card p-5">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-4">
            Entregas por Trimestre
          </h3>
          {loadingEntregas ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : entregasTrimestre && entregasTrimestre.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={entregasTrimestre.map((d) => ({
                  ...d,
                  total_entregas: parseInt(String(d.total_entregas || 0)),
                  valor_total: parseFloat(String(d.valor_total || 0)),
                }))}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  opacity={0.5}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    return (
                      <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-lg">
                        <p className="font-medium text-foreground mb-1">{label}</p>
                        <p className="text-muted-foreground">{d?.total_entregas} projetos</p>
                        {d?.valor_total > 0 && (
                          <p className="text-emerald-600 dark:text-emerald-400 font-medium">
                            R$ {d.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                        )}
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="total_entregas"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.6}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">
              Sem dados de entregas trimestrais
            </p>
          )}
        </div>
      </div>

      {/* ── Proximos Vencimentos ────────────────────────────────────── */}
      <div>
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
          Proximos Vencimentos
        </h3>
        {loadingProjetos ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : proximosVencimentos.length > 0 ? (
          <div className="divide-y divide-border">
            {proximosVencimentos.map((projeto) => {
              const days = daysUntil(projeto.dataVencimento);
              let dotColor = "bg-green-500";
              if (days !== null && days < 0) {
                dotColor = "bg-red-500";
              } else if (days !== null && days <= 3) {
                dotColor = "bg-yellow-500";
              }

              return (
                <div
                  key={projeto.clickupTaskId}
                  className="flex items-center gap-3 py-3"
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground truncate block">
                      {projeto.taskName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {projeto.responsavel || "Sem responsavel"}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDate(projeto.dataVencimento)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum projeto com data de vencimento
          </p>
        )}
      </div>
    </div>
  );
}
