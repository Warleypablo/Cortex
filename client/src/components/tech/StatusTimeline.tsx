import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MessageSquare, ArrowRight, AlertTriangle, Loader2 } from "lucide-react";

interface StatusTimelineProps {
  taskId: string;
}

const FILTER_OPTIONS = [
  { value: 'tudo', label: 'Tudo' },
  { value: 'comentarios', label: 'Comentários' },
  { value: 'status', label: 'Status' },
  { value: 'bloqueios', label: 'Bloqueios' },
] as const;

export default function StatusTimeline({ taskId }: StatusTimelineProps) {
  const [filterType, setFilterType] = useState<string>('tudo');

  const { data: timeline = [], isLoading } = useQuery({
    queryKey: ['/api/tech/projeto', taskId, 'historico', filterType],
    queryFn: async () => {
      const res = await fetch(`/api/tech/projeto/${taskId}/historico?tipo=${filterType}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!taskId,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-1 mb-4">
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilterType(opt.value)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filterType === opt.value
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {timeline.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-zinc-500 py-4">Nenhum evento encontrado.</p>
      ) : (
        <div className="relative">
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-zinc-700" />
          <div className="space-y-4">
            {timeline.map((entry: any, i: number) => {
              const isBlocker = entry.tipo_evento === 'bloqueio';
              const isComment = entry.tipo_evento === 'comentario' || isBlocker;
              const isStatus = entry.tipo_evento === 'status';

              const dotColor = isBlocker
                ? 'bg-red-500'
                : isComment
                ? 'bg-purple-500'
                : 'bg-green-500';

              const Icon = isBlocker ? AlertTriangle : isComment ? MessageSquare : ArrowRight;

              return (
                <div key={i} className="relative flex gap-3 pl-8">
                  <div className={`absolute left-1.5 top-1.5 w-3 h-3 rounded-full ${dotColor} ring-2 ring-white dark:ring-zinc-900`} />
                  <div className="flex-1 bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-3.5 h-3.5 text-gray-500 dark:text-zinc-400" />
                      {entry.autor && (
                        <span className="text-xs font-medium text-gray-700 dark:text-zinc-300">{entry.autor}</span>
                      )}
                      {entry.data_evento && (
                        <span className="text-xs text-gray-400 dark:text-zinc-500 ml-auto">
                          {new Date(entry.data_evento).toLocaleDateString('pt-BR')} {new Date(entry.data_evento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-800 dark:text-zinc-200 whitespace-pre-wrap">
                      {entry.descricao}
                    </p>
                    {entry.duracao_ms && entry.duracao_ms > 0 && (
                      <span className="text-xs text-gray-400 dark:text-zinc-500 mt-1 block">
                        Duração: {Math.round(entry.duracao_ms / 86400000 * 10) / 10} dias
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
