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
  showDeliveryDate?: boolean;
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
  return tags.replace(/[{}]/g, "").split(",").filter(Boolean);
}

const URGENCY_DOT_COLOR: Record<string, string> = {
  overdue: "bg-red-500",
  risk: "bg-amber-500",
  ok: "bg-emerald-500",
  none: "bg-gray-300 dark:bg-zinc-600",
};

// --- Component ---

export default function ProjectCard({ project, onClick, showDeliveryDate }: ProjectCardProps) {
  const urgency = getUrgency(project.data_vencimento);
  const tags = parseTags(project.tags_ativas);

  const dateToShow = showDeliveryDate
    ? project.lancamento
    : project.data_vencimento;

  const dateLabel = showDeliveryDate ? "Entrega" : "Prazo";

  const formattedDate = dateToShow
    ? new Date(dateToShow).toLocaleDateString("pt-BR")
    : null;

  return (
    <div
      onClick={onClick}
      className="rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer p-3"
    >
      {/* Row 1: Project name */}
      <p className="text-sm font-medium text-foreground truncate" title={project.task_name}>
        {project.task_name}
      </p>

      {/* Row 2: Status badge + Phase */}
      <div className="flex items-center gap-2 mt-1.5">
        {project.status_projeto && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
            {project.status_projeto}
          </Badge>
        )}
        {project.fase_projeto && (
          <span className="text-xs text-muted-foreground truncate">
            {project.fase_projeto}
          </span>
        )}
      </div>

      {/* Row 3: Due date with urgency dot + Alert tags */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          {formattedDate && (
            <>
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${URGENCY_DOT_COLOR[urgency]}`} />
              <span className="text-xs text-muted-foreground">
                {dateLabel}: {formattedDate}
              </span>
            </>
          )}
          {!formattedDate && (
            <span className="text-xs text-muted-foreground italic">Sem data</span>
          )}
        </div>

        {tags.length > 0 && (
          <div className="flex gap-1">
            {tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-[10px] px-1 py-0 h-4 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
