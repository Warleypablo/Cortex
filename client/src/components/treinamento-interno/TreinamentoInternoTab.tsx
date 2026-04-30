import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Search, RefreshCw, GraduationCap, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { getTrackTheme } from './trackThemes';
import { VideoCard, type VideoSummary } from './VideoCard';

export interface TrilhaSummary {
  id: string;
  nome: string;
  totalVideos: number;
  videosConcluidos: number;
  ultimoVideoModificadoEm: string | null;
}

interface SyncReport {
  ok: boolean;
  trilhasAtivas: number;
  videosAtivos: number;
  trilhasDesativadas: number;
  videosDesativados: number;
  erros: Array<{ contexto: string; mensagem: string }>;
  alreadyRunning?: boolean;
}

export function TreinamentoInternoTab() {
  const [busca, setBusca] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: trilhas = [], isLoading: loadingTrilhas } = useQuery<TrilhaSummary[]>({
    queryKey: ['/api/treinamentos-internos/trilhas'],
  });

  // Seleciona a primeira trilha com vídeos automaticamente
  useEffect(() => {
    if (trilhas.length > 0 && !selectedId) {
      const comVideos = trilhas.find((t) => t.totalVideos > 0) ?? trilhas[0];
      setSelectedId(comVideos.id);
    }
  }, [trilhas, selectedId]);

  const trilhaAtiva = selectedId ?? trilhas[0]?.id ?? null;
  const trilhaAtivaObj = trilhas.find((t) => t.id === trilhaAtiva);

  const { data: videos = [], isLoading: loadingVideos } = useQuery<VideoSummary[]>({
    queryKey: ['/api/treinamentos-internos/videos', { trackId: trilhaAtiva }],
    queryFn: async () => {
      const res = await fetch(`/api/treinamentos-internos/videos?trackId=${trilhaAtiva}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Falha ao carregar vídeos');
      return res.json();
    },
    enabled: !!trilhaAtiva,
  });

  const filtrados = busca
    ? videos.filter((v) => v.nome.toLowerCase().includes(busca.toLowerCase()))
    : videos;

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/treinamentos-internos/sync');
      return (await res.json()) as SyncReport;
    },
    onSuccess: (report) => {
      queryClient.invalidateQueries({ queryKey: ['/api/treinamentos-internos/trilhas'] });
      queryClient.invalidateQueries({ queryKey: ['/api/treinamentos-internos/videos'] });
      if (report.alreadyRunning) {
        toast({ title: 'Sincronização já em andamento' });
      } else if (!report.ok) {
        toast({
          title: 'Falha na sincronização',
          description: report.erros[0]?.mensagem || 'Erro desconhecido',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sincronizado!',
          description: `${report.trilhasAtivas} trilhas, ${report.videosAtivos} vídeos`
            + (report.erros.length > 0 ? ` (${report.erros.length} erros parciais)` : ''),
        });
      }
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao sincronizar', description: err.message, variant: 'destructive' });
    },
  });

  if (loadingTrilhas) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-trilhas">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (trilhas.length === 0) {
    return (
      <div className="text-center py-12" data-testid="empty-trilhas">
        <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground">Nenhuma trilha sincronizada ainda</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Clique em "Sincronizar agora" para puxar os vídeos do Drive.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          data-testid="button-sync-treinamentos"
        >
          {syncMutation.isPending
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sincronizando...</>
            : <><RefreshCw className="w-4 h-4 mr-2" />Sincronizar agora</>}
        </Button>
      </div>
    );
  }

  const pct = trilhaAtivaObj && trilhaAtivaObj.totalVideos > 0
    ? (trilhaAtivaObj.videosConcluidos / trilhaAtivaObj.totalVideos) * 100
    : 0;

  return (
    <div className="space-y-4">
      {/* Linha superior: busca + sync */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar vídeo..."
            className="pl-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            data-testid="input-buscar-treinamento"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          data-testid="button-sync-treinamentos"
        >
          {syncMutation.isPending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <RefreshCw className="w-4 h-4" />}
        </Button>
      </div>

      {/* Chips de filtro — scroll horizontal */}
      <div
        ref={chipsRef}
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
        data-testid="filtro-trilhas"
      >
        {trilhas.map((trilha) => {
          const theme = getTrackTheme(trilha.nome);
          const Icon = theme.icon;
          const isSelected = trilha.id === trilhaAtiva;

          return (
            <button
              key={trilha.id}
              onClick={() => setSelectedId(trilha.id)}
              data-testid={`chip-trilha-${trilha.id}`}
              className={[
                'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap',
                'transition-all duration-150 border shrink-0',
                isSelected
                  ? 'border-transparent text-white shadow-sm'
                  : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 bg-transparent hover:border-gray-300 dark:hover:border-zinc-600 hover:text-gray-900 dark:hover:text-zinc-200',
              ].join(' ')}
              style={isSelected ? {
                background: `linear-gradient(135deg, ${getChipColor(theme.color, 'from')}, ${getChipColor(theme.color, 'to')})`,
              } : undefined}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{trilha.nome}</span>
              {trilha.totalVideos > 0 && (
                <span className={isSelected ? 'opacity-80 text-xs' : 'text-xs text-muted-foreground'}>
                  {trilha.videosConcluidos}/{trilha.totalVideos}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Barra de progresso da trilha selecionada */}
      {trilhaAtivaObj && trilhaAtivaObj.totalVideos > 0 && (
        <div className="flex items-center gap-3">
          <Progress value={pct} className="h-1.5 flex-1" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {Math.round(pct)}% concluído
          </span>
        </div>
      )}

      {/* Lista de vídeos */}
      {loadingVideos ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          {busca ? `Nenhum vídeo encontrado para "${busca}".` : 'Nenhum vídeo nesta trilha ainda.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-1">
          {filtrados.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
      )}
    </div>
  );
}

// Extrai a cor hex aproximada do nome da classe Tailwind para o gradiente inline
const TAILWIND_COLORS: Record<string, string> = {
  'orange-500': '#f97316', 'amber-400': '#fbbf24',
  'purple-500': '#a855f7', 'violet-400': '#a78bfa',
  'blue-500': '#3b82f6',   'cyan-400': '#22d3ee',
  'emerald-500': '#10b981','green-400': '#4ade80',
  'pink-500': '#ec4899',   'rose-400': '#fb7185',
  'indigo-500': '#6366f1', 'blue-400': '#60a5fa',
  'teal-500': '#14b8a6',   'cyan-400b': '#22d3ee',
  'fuchsia-500': '#d946ef','pink-400': '#f472b6',
  'amber-500': '#f59e0b',  'yellow-400': '#facc15',
  'gray-500': '#6b7280',   'slate-400': '#94a3b8',
};

function getChipColor(gradientClass: string, stop: 'from' | 'to'): string {
  const match = gradientClass.match(stop === 'from' ? /from-([\w-]+)/ : /to-([\w-]+)/);
  if (!match) return stop === 'from' ? '#6366f1' : '#8b5cf6';
  return TAILWIND_COLORS[match[1]] ?? '#6366f1';
}
