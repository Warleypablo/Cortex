import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Calendar, Clock, Tag, MessageSquare, AlertTriangle, ChevronDown, ChevronUp, User } from "lucide-react";
import PrazoStatusBar from "./PrazoStatusBar";
import StatusTimeline from "./StatusTimeline";

interface ProjectDrawerProps {
  project: any | null;
  open: boolean;
  onClose: () => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min atras`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atras`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ontem';
  if (days < 30) return `${days}d atras`;
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

const ALERTA_LABELS: Record<string, { label: string; color: string }> = {
  bloqueio: { label: 'Bloqueio', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  pendencia_cliente: { label: 'Pendencia Cliente', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  alerta: { label: 'Alerta', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
};

export default function ProjectDrawer({ project, open, onClose }: ProjectDrawerProps) {
  const taskId = project?.clickup_task_id;
  const [showAllComments, setShowAllComments] = useState(false);

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

  // Fetch comment summary
  const { data: resumo, isLoading: loadingResumo } = useQuery({
    queryKey: ['/api/tech/projeto', taskId, 'resumo-comentarios'],
    queryFn: async () => {
      const res = await fetch(`/api/tech/projeto/${taskId}/resumo-comentarios`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!taskId && open,
  });

  // Fetch full comments (only when expanded)
  const { data: allComments = [], isLoading: loadingComments } = useQuery({
    queryKey: ['/api/tech/projeto', taskId, 'comentarios'],
    queryFn: async () => {
      const res = await fetch(`/api/tech/projeto/${taskId}/comentarios`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!taskId && open && showAllComments,
  });

  if (!project) return null;

  // Transform status history events into PrazoStatusBar format
  const barData = statusHistory
    .filter((e: any) => e.duracao_ms && e.duracao_ms > 0)
    .map((e: any) => {
      const parts = (e.descricao || '').split(' \u2192 ');
      return {
        status_novo: parts.length > 1 ? parts[1] : parts[0],
        duracao_ms: parseInt(e.duracao_ms) || 0,
      };
    });

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) { onClose(); setShowAllComments(false); } }}>
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
              <p className="text-[10px] text-gray-500 dark:text-zinc-400 uppercase">Lancamento</p>
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

          {/* Comment Summary */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                Resumo de Andamento
              </h4>
              {resumo?.totalComentarios > 0 && (
                <span className="text-[10px] text-gray-400 dark:text-zinc-500">
                  {resumo.totalComentarios} comentarios
                </span>
              )}
            </div>

            {loadingResumo ? (
              <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-4 animate-pulse">
                <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded w-1/2" />
              </div>
            ) : resumo?.totalComentarios === 0 ? (
              <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-4 text-center">
                <p className="text-xs text-gray-400 dark:text-zinc-500">Nenhum comentario registrado</p>
              </div>
            ) : resumo ? (
              <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg border border-gray-100 dark:border-zinc-700 overflow-hidden">
                {/* Alerts banner */}
                {resumo.alertas.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/10 border-b border-red-100 dark:border-red-900/20">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <div className="flex gap-1.5 flex-wrap">
                      {resumo.alertas.map((a: string) => {
                        const config = ALERTA_LABELS[a] || { label: a, color: 'bg-gray-100 text-gray-600' };
                        return (
                          <span key={a} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${config.color}`}>
                            {config.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Latest comment highlight */}
                {resumo.ultimoComentario && (
                  <div className="px-3 py-3 border-b border-gray-100 dark:border-zinc-700">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                        <User className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <span className="text-xs font-medium text-gray-700 dark:text-zinc-300">
                        {resumo.ultimoComentario.autor}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-zinc-500 ml-auto">
                        {timeAgo(resumo.ultimoComentario.data)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-zinc-300 leading-relaxed">
                      {resumo.ultimoComentario.texto}
                    </p>
                  </div>
                )}

                {/* Recent activity summary */}
                {resumo.resumo && (
                  <div className="px-3 py-2.5">
                    <p className="text-[10px] font-medium text-gray-400 dark:text-zinc-500 uppercase mb-1.5">Atividade recente</p>
                    <div className="space-y-1">
                      {resumo.resumo.split('\n').slice(1).map((line: string, i: number) => (
                        <p key={i} className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Participants */}
                {resumo.autores.length > 0 && (
                  <div className="px-3 py-2 border-t border-gray-100 dark:border-zinc-700 flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400 dark:text-zinc-500">Participantes:</span>
                    <div className="flex gap-1 flex-wrap">
                      {resumo.autores.map((a: string) => (
                        <span key={a} className="text-[10px] bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-zinc-400 px-1.5 py-0.5 rounded">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expand to all comments */}
                {resumo.totalComentarios > 1 && (
                  <button
                    onClick={() => setShowAllComments(!showAllComments)}
                    className="w-full px-3 py-2 border-t border-gray-100 dark:border-zinc-700 flex items-center justify-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    {showAllComments ? (
                      <>Recolher <ChevronUp className="w-3.5 h-3.5" /></>
                    ) : (
                      <>Ver todos os {resumo.totalComentarios} comentarios <ChevronDown className="w-3.5 h-3.5" /></>
                    )}
                  </button>
                )}
              </div>
            ) : null}

            {/* All comments expanded */}
            {showAllComments && (
              <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">
                {loadingComments ? (
                  <div className="text-center py-4">
                    <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded w-1/2 mx-auto animate-pulse" />
                  </div>
                ) : allComments.map((c: any) => (
                  <div key={c.clickup_comment_id} className="bg-white dark:bg-zinc-800 rounded-lg border border-gray-100 dark:border-zinc-700 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-700 dark:text-zinc-300">{c.autor}</span>
                      <span className="text-[10px] text-gray-400 dark:text-zinc-500">
                        {c.data_criacao ? new Date(c.data_criacao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                      {Array.isArray(c.tags_extraidas) && c.tags_extraidas.length > 0 && (
                        <div className="flex gap-1 ml-auto">
                          {c.tags_extraidas.map((t: string) => {
                            const config = ALERTA_LABELS[t] || { label: t, color: 'bg-gray-100 text-gray-600' };
                            return <span key={t} className={`text-[10px] px-1 py-0.5 rounded ${config.color}`}>{config.label}</span>;
                          })}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap">
                      {(c.texto || '').trim()}
                    </p>
                  </div>
                ))}
              </div>
            )}
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
