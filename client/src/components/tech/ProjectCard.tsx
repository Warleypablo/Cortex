import { Badge } from "@/components/ui/badge";

// --- Types ---

interface ProjectCardProps {
  project: {
    clickup_task_id: string;
    task_name: string;
    status_projeto: string;
    prioridade: string;
    data_vencimento: string | null;
    lancamento: string | null;
    responsavel: string | null;
    fase_projeto: string | null;
    tipo: string | null;
    tags_ativas?: string[] | string;
    data_inicio_prazo?: string | null;
  };
  onClick?: () => void;
}

// --- Helpers ---

function getUrgency(dueDate: string | null): "overdue" | "risk" | "ok" | "none" {
  if (!dueDate) return "none";
  const due = new Date(dueDate);
  const now = new Date();
  const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 3) return "risk";
  return "ok";
}

function parseTags(tags: string[] | string | undefined): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  // PostgreSQL array format: "{bloqueio,alerta}"
  return tags.replace(/[{}]/g, "").split(",").filter(Boolean);
}

function getStatusBadgeClasses(status: string): string {
  const normalized = status.toLowerCase().trim();
  switch (normalized) {
    case "kickoff":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "design":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
    case "dev":
    case "desenvolvimento":
      return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400";
    case "review":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "qa":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    case "deploy":
      return "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400";
    case "done":
    case "closed":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
  }
}

const URGENCY_BORDER: Record<string, string> = {
  overdue: "border-l-red-500",
  risk: "border-l-amber-500",
  ok: "border-l-green-500",
  none: "border-l-gray-300 dark:border-l-zinc-600",
};

function getDeadlineProgress(
  startDate: string | null | undefined,
  dueDate: string | null,
): number | null {
  if (!startDate || !dueDate) return null;
  const start = new Date(startDate).getTime();
  const due = new Date(dueDate).getTime();
  const now = Date.now();
  const total = due - start;
  if (total <= 0) return 100;
  const elapsed = now - start;
  const pct = Math.round((elapsed / total) * 100);
  return Math.max(0, Math.min(pct, 100));
}

function getProgressBarColor(pct: number): string {
  if (pct >= 100) return "bg-red-500";
  if (pct >= 80) return "bg-amber-500";
  return "bg-green-500";
}

// --- Component ---

export default function ProjectCard({ project, onClick }: ProjectCardProps) {
  const urgency = getUrgency(project.data_vencimento);
  const tags = parseTags(project.tags_ativas);
  const progress = getDeadlineProgress(project.data_inicio_prazo, project.data_vencimento);

  const formattedDueDate = project.data_vencimento
    ? new Date(project.data_vencimento).toLocaleDateString("pt-BR")
    : null;

  const formattedLancamento = project.lancamento
    ? new Date(project.lancamento).toLocaleDateString("pt-BR")
    : null;

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 p-3 border-l-4 ${URGENCY_BORDER[urgency]} hover:shadow-md transition-shadow cursor-pointer`}
    >
      {/* Row 1: Project name */}
      <p className="font-medium text-sm text-gray-900 dark:text-white truncate" title={project.task_name}>
        {project.task_name}
      </p>

      {/* Row 2: Status + Fase + Tipo badges */}
      <div className="flex flex-wrap gap-1 mt-1.5">
        {project.status_projeto && (
          <Badge className={`text-[10px] px-1.5 py-0 ${getStatusBadgeClasses(project.status_projeto)}`}>
            {project.status_projeto}
          </Badge>
        )}
        {project.fase_projeto && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {project.fase_projeto}
          </Badge>
        )}
        {project.tipo && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {project.tipo}
          </Badge>
        )}
      </div>

      {/* Row 3: Due date + Lancamento */}
      <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-500 dark:text-zinc-400">
        {formattedDueDate && <span>Vencimento: {formattedDueDate}</span>}
        {formattedLancamento && <span>Lanc: {formattedLancamento}</span>}
        {!formattedDueDate && !formattedLancamento && (
          <span className="italic">Sem data definida</span>
        )}
      </div>

      {/* Row 4: Progress bar (deadline consumed) */}
      {progress !== null && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-zinc-400 mb-0.5">
            <span>Prazo</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${getProgressBarColor(progress)}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Row 5: Alert tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
