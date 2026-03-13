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

interface PrazoPorStatus {
  status: string;
  media_dias: number;
  total_transicoes: number;
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

// ── Helpers ────────────────────────────────────────────────────────────

// Pipeline phases in logical order with display names and colors
const PHASE_CONFIG: { key: string; label: string; color: string; patterns: string[] }[] = [
  { key: "backlog", label: "Backlog / Triagem", color: "#94a3b8", patterns: ["open", "backlog", "não iniciado", "novo projeto", "to do", "aguardando", "em andamento"] },
  { key: "planejamento", label: "Planejamento", color: "#a78bfa", patterns: ["planejamento", "kickoff"] },
  { key: "design", label: "Design", color: "#8b5cf6", patterns: ["pronto p/ design", "design", "em design", "wireframe", "design + copy"] },
  { key: "design_review", label: "Design Review", color: "#7c3aed", patterns: ["design - review", "design review", "ajuste design"] },
  { key: "pronto_dev", label: "Pronto p/ Dev", color: "#6366f1", patterns: ["pronto p/ dev", "pronto desenvolvimento", "pronto p/ desenvolvimento"] },
  { key: "dev", label: "Desenvolvimento", color: "#4f46e5", patterns: ["dev", "desenvolvimento", "em progresso", "doing"] },
  { key: "dev_review", label: "Dev Review", color: "#4338ca", patterns: ["dev. review", "dev review", "review final", "qualidade", "configurações & review"] },
  { key: "lancamento", label: "Lançamento", color: "#3730a3", patterns: ["pronto para lançar", "telas ok"] },
  { key: "pendencias", label: "Pendências", color: "#f59e0b", patterns: ["deploy com pend", "deplay com ped"] },
  { key: "bloqueado", label: "Bloqueado / Pausado", color: "#ef4444", patterns: ["bloqueado", "pausado"] },
  { key: "aguardando", label: "Aguardando Externo", color: "#f97316", patterns: ["aguardando externo", "aguardando interno"] },
];

// End-state statuses to exclude
const END_STATES = ["deploy 🚀", "deploy", "encerrado 🚀", "complete", "completo"];

function groupStatusIntoPhases(data: PrazoPorStatus[]): { label: string; media_dias: number; total_transicoes: number; color: string }[] {
  // Filter out end states
  const filtered = data.filter(d => !END_STATES.includes(d.status.toLowerCase().trim()));

  // Group by phase using weighted average
  const phaseMap: Record<string, { totalWeightedDays: number; totalTransitions: number; color: string; label: string; order: number }> = {};

  for (const item of filtered) {
    const statusLower = item.status.toLowerCase().trim();
    let matched = false;

    for (let i = 0; i < PHASE_CONFIG.length; i++) {
      const phase = PHASE_CONFIG[i];
      if (phase.patterns.some(p => statusLower.includes(p))) {
        if (!phaseMap[phase.key]) {
          phaseMap[phase.key] = { totalWeightedDays: 0, totalTransitions: 0, color: phase.color, label: phase.label, order: i };
        }
        const dias = parseFloat(String(item.media_dias || 0));
        const trans = parseInt(String(item.total_transicoes || 0));
        phaseMap[phase.key].totalWeightedDays += dias * trans;
        phaseMap[phase.key].totalTransitions += trans;
        matched = true;
        break;
      }
    }

    // Skip unmatched statuses with very few transitions
    if (!matched && parseInt(String(item.total_transicoes || 0)) >= 10) {
      const key = `_other_${statusLower}`;
      phaseMap[key] = {
        totalWeightedDays: parseFloat(String(item.media_dias || 0)) * parseInt(String(item.total_transicoes || 0)),
        totalTransitions: parseInt(String(item.total_transicoes || 0)),
        color: "#94a3b8",
        label: item.status.charAt(0).toUpperCase() + item.status.slice(1),
        order: 99,
      };
    }
  }

  return Object.values(phaseMap)
    .map(p => ({
      label: p.label,
      media_dias: p.totalTransitions > 0 ? Math.round((p.totalWeightedDays / p.totalTransitions) * 10) / 10 : 0,
      total_transicoes: p.totalTransitions,
      color: p.color,
    }))
    .filter(p => p.media_dias > 0)
    .sort((a, b) => b.media_dias - a.media_dias);
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr).getTime();
  if (isNaN(target)) return null;
  return (target - Date.now()) / 86400000;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
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

  // ── Derived metrics from board ─────────────────────────────────────

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

  // taxa no prazo: projects delivered on time (from closed projects context, approximate from metricas)
  const taxaNoPrazo = useMemo(() => {
    if (!metricas) return 0;
    const total = metricas.projetosEmAndamento + metricas.projetosFechados;
    if (total === 0) return 0;
    // Approximate: overdue projects from board / total active
    const overdue = allBoardProjects.filter((p) => {
      const days = daysUntil(p.data_vencimento);
      return days !== null && days < 0;
    }).length;
    const active = metricas.projetosEmAndamento;
    if (active === 0) return 100;
    return Math.round(((active - overdue) / active) * 100);
  }, [metricas, allBoardProjects]);

  // ── Próximos Vencimentos ───────────────────────────────────────────

  const proximosVencimentos = useMemo(() => {
    if (!projetosAndamento) return [];
    return [...projetosAndamento]
      .filter((p) => p.dataVencimento)
      .sort((a, b) => {
        const da = new Date(a.dataVencimento!).getTime();
        const db = new Date(b.dataVencimento!).getTime();
        return da - db;
      })
      .slice(0, 8);
  }, [projetosAndamento]);

  // ── Loading state ──────────────────────────────────────────────────

  const isLoading = loadingMetricas || loadingBoard;

  if (isLoading) {
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
        <KPICard
          label="Projetos Ativos"
          value={metricas?.projetosEmAndamento ?? 0}
          icon={<FolderOpen className="h-4 w-4 text-indigo-500" />}
        />
        <KPICard
          label="Em Risco"
          value={emRiscoCount}
          valueClassName="text-amber-600"
          icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
        />
        <KPICard
          label="Tempo Medio"
          value={`${Math.round(metricas?.tempoMedioEntrega ?? 0)}d`}
          icon={<Clock className="h-4 w-4 text-blue-500" />}
        />
        <KPICard
          label="Taxa No Prazo"
          value={`${taxaNoPrazo}%`}
          icon={<CheckCircle className="h-4 w-4 text-green-500" />}
        />
        <KPICard
          label="Bloqueios Ativos"
          value={bloqueiosCount}
          valueClassName="text-red-600"
          icon={<ShieldAlert className="h-4 w-4 text-red-500" />}
        />
      </div>

      {/* ── Charts Row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tempo Médio por Fase */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 border border-gray-200 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1">
            Tempo Medio por Fase
          </h3>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">
            Media ponderada em dias (excluindo fases finais)
          </p>
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
            <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-12">
              Sem dados de prazo por status
            </p>
          )}
        </div>

        {/* Entregas por Trimestre */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 border border-gray-200 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-4">
            Entregas por Trimestre
          </h3>
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
                    backgroundColor: "var(--tooltip-bg, #fff)",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="total_entregas" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-12">
              Sem dados de entregas trimestrais
            </p>
          )}
        </div>
      </div>

      {/* ── Próximos Vencimentos ────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 border border-gray-200 dark:border-zinc-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-4">
          Proximos Vencimentos
        </h3>
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
          <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-8">
            Nenhum projeto com data de vencimento
          </p>
        )}
      </div>
    </div>
  );
}

// ── KPI Card ────────────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  valueClassName,
  icon,
}: {
  label: string;
  value: string | number;
  valueClassName?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-gray-200 dark:border-zinc-700">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wider">{label}</p>
        {icon}
      </div>
      <p className={`text-2xl font-bold mt-1 ${valueClassName || "text-gray-900 dark:text-white"}`}>
        {value}
      </p>
    </div>
  );
}
