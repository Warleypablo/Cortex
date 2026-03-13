import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Calendar, Clock, Tag } from "lucide-react";
import PrazoStatusBar from "./PrazoStatusBar";
import StatusTimeline from "./StatusTimeline";

interface ProjectDrawerProps {
  project: any | null;
  open: boolean;
  onClose: () => void;
}

export default function ProjectDrawer({ project, open, onClose }: ProjectDrawerProps) {
  const taskId = project?.clickup_task_id;

  // Fetch status history for PrazoStatusBar
  const { data: statusHistory = [] } = useQuery({
    queryKey: ['/api/tech/projeto', taskId, 'historico', 'status'],
    queryFn: async () => {
      const res = await fetch(`/api/tech/projeto/${taskId}/historico?tipo=status`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!taskId && open,
  });

  if (!project) return null;

  // Transform status history events into PrazoStatusBar format
  const barData = statusHistory
    .filter((e: any) => e.duracao_ms && e.duracao_ms > 0)
    .map((e: any) => {
      // Extract the new status from "X -> Y" format
      const parts = (e.descricao || '').split(' \u2192 ');
      return {
        status_novo: parts.length > 1 ? parts[1] : parts[0],
        duracao_ms: parseInt(e.duracao_ms) || 0,
      };
    });

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto bg-white dark:bg-zinc-900">
        <SheetHeader>
          <SheetTitle className="text-gray-900 dark:text-white text-lg">
            {project.task_name}
          </SheetTitle>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            {project.responsavel && (
              <span className="text-xs bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 px-2 py-0.5 rounded">
                {project.responsavel}
              </span>
            )}
            {project.tipo && (
              <span className="text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded">
                {project.tipo}
              </span>
            )}
            {project.prioridade && (
              <span className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded">
                {project.prioridade}
              </span>
            )}
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Meta cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3 text-center">
              <Calendar className="w-4 h-4 mx-auto text-gray-400 dark:text-zinc-500 mb-1" />
              <p className="text-[10px] text-gray-500 dark:text-zinc-400 uppercase">Prazo Contrato</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {project.data_vencimento ? new Date(project.data_vencimento).toLocaleDateString('pt-BR') : '\u2014'}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3 text-center">
              <Tag className="w-4 h-4 mx-auto text-gray-400 dark:text-zinc-500 mb-1" />
              <p className="text-[10px] text-gray-500 dark:text-zinc-400 uppercase">Lançamento</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {project.lancamento ? new Date(project.lancamento).toLocaleDateString('pt-BR') : '\u2014'}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3 text-center">
              <Clock className="w-4 h-4 mx-auto text-gray-400 dark:text-zinc-500 mb-1" />
              <p className="text-[10px] text-gray-500 dark:text-zinc-400 uppercase">Tempo Total</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {project.tempo_total ? `${project.tempo_total}h` : '\u2014'}
              </p>
            </div>
          </div>

          {/* Prazo por Status bar */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase mb-2">Prazo por Status</h4>
            <PrazoStatusBar statusHistory={barData} />
          </div>

          {/* Timeline */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase mb-2">Timeline</h4>
            <StatusTimeline taskId={taskId} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
