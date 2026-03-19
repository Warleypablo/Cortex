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
import { Loader2, AlertTriangle, Clock, CheckCircle, ShieldAlert, FolderOpen } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import StatsCard from "@/components/StatsCard";
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
      return days !== null && days <= 3 && days > 0;
    }).length;
  }, [allBoardProjects]);

  const bloqueiosCount = useMemo(() => {
    return allBoardProjects.filter((p) => {
      const tags = Array.isArray(p.tags_ativas) ? p.tags_ativas : [];
      return tags.some((t: string) => t.toLowerCase().includes("bloqueio"));
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
      .slice(0, 5);
  }, [projetosAndamento]);

  // ── Loading state ──────────────────────────────────────────────────

  if (loadingMetricas || loadingBoard) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* ── KPI Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatsCard
          title="Projetos Ativos"
          value={String(metricas?.projetosEmAndamento ?? 0)}
          icon={FolderOpen}
          variant="default"
        />
        <StatsCard
          title="Em Risco"
          value={String(emRiscoCount)}
          icon={AlertTriangle}
          variant="warning"
        />
        <StatsCard
          title="Tempo Medio"
          value={`${Math.round(metricas?.tempoMedioEntrega ?? 0)}d`}
          icon={Clock}
          variant="info"
        />
        <StatsCard
          title="Taxa No Prazo"
          value={`${taxaNoPrazo}%`}
          icon={CheckCircle}
          variant="success"
        />
        <StatsCard
          title="Bloqueios Ativos"
          value={String(bloqueiosCount)}
          icon={ShieldAlert}
          variant="error"
        />
      </div>

      {/* ── Charts Row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tempo Medio por Fase */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tempo Medio por Fase</CardTitle>
            <p className="text-xs text-muted-foreground">
              Media ponderada em dias (excluindo fases finais)
            </p>
          </CardHeader>
          <CardContent>
            {loadingPrazo ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
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
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.1} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: "#9ca3af" }}
                        tickFormatter={(v: number) => `${Math.round(v)}d`}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        dataKey="label"
                        type="category"
                        tick={{ fontSize: 12, fill: "#d1d5db" }}
                        width={140}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(255,255,255,0.04)" }}
                        formatter={(value: number, _name: string, props: any) => [
                          `${value} dias (${props.payload.total_transicoes} transicoes)`,
                          "Media",
                        ]}
                        contentStyle={{
                          backgroundColor: "#18181b",
                          border: "1px solid #3f3f46",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "#e4e4e7",
                        }}
                        labelStyle={{ color: "#a1a1aa", fontWeight: 600 }}
                      />
                      <Bar dataKey="media_dias" radius={[0, 6, 6, 0]} maxBarSize={24}>
                        {grouped.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
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
          </CardContent>
        </Card>

        {/* Entregas por Trimestre */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Entregas por Trimestre</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingEntregas ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
              </div>
            ) : entregasTrimestre && entregasTrimestre.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={entregasTrimestre.map((d) => ({
                    ...d,
                    total_entregas: parseInt(String(d.total_entregas || 0)),
                  }))}
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(value: number) => [`${value} entregas`, "Total"]}
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #3f3f46",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#e4e4e7",
                    }}
                  />
                  <Bar dataKey="total_entregas" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">
                Sem dados de entregas trimestrais
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Pipeline Snapshot ──────────────────────────────────────── */}
      {pipelineSnapshot.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Pipeline</CardTitle>
            <p className="text-xs text-muted-foreground">
              Distribuicao dos {pipelineTotal} projetos ativos por fase
            </p>
          </CardHeader>
          <CardContent>
            {/* Stacked bar */}
            <div className="flex rounded-lg overflow-hidden h-8">
              {pipelineSnapshot.map((phase) => {
                const pct = (phase.count / pipelineTotal) * 100;
                return (
                  <div
                    key={phase.key}
                    className="relative group flex items-center justify-center text-[10px] font-semibold text-white transition-all hover:brightness-110"
                    style={{ width: `${pct}%`, backgroundColor: phase.color, minWidth: pct > 3 ? undefined : "24px" }}
                    title={`${phase.label}: ${phase.count}`}
                  >
                    {pct > 8 && phase.count}
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
              {pipelineSnapshot.map((phase) => (
                <div key={phase.key} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: phase.color }} />
                  <span className="text-xs text-muted-foreground">
                    {phase.label} ({phase.count})
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Proximos Vencimentos ────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Proximos Vencimentos</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingProjetos ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            </div>
          ) : proximosVencimentos.length > 0 ? (
            <div className="space-y-2">
              {proximosVencimentos.map((projeto) => {
                const days = daysUntil(projeto.dataVencimento);
                let borderColor = "border-l-green-500";
                let textColor = "text-green-600";
                let badgeBg = "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400";

                if (days !== null && days < 0) {
                  borderColor = "border-l-red-500";
                  textColor = "text-red-600";
                  badgeBg = "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400";
                } else if (days !== null && days <= 3) {
                  borderColor = "border-l-amber-500";
                  textColor = "text-amber-600";
                  badgeBg = "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400";
                }

                return (
                  <div
                    key={projeto.clickupTaskId}
                    className={`flex items-center justify-between p-3 rounded-lg border-l-4 ${borderColor} bg-gray-50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-700`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {projeto.taskName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                        {projeto.responsavel || "Sem responsavel"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-4 shrink-0">
                      <span className={`text-xs font-medium ${textColor}`}>
                        {formatDate(projeto.dataVencimento)}
                      </span>
                      {projeto.statusProjeto && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeBg}`}>
                          {projeto.statusProjeto}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum projeto com data de vencimento
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
