import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getTrackTheme } from './trackThemes';
import { VideoCard, type VideoSummary } from './VideoCard';

export interface TrilhaSummary {
  id: string;
  nome: string;
  totalVideos: number;
  videosConcluidos: number;
  ultimoVideoModificadoEm: string | null;
}

interface TrilhaCardProps {
  trilha: TrilhaSummary;
  filtroBusca?: string;
}

export function TrilhaCard({ trilha, filtroBusca = '' }: TrilhaCardProps) {
  const [expanded, setExpanded] = useState(false);
  const theme = getTrackTheme(trilha.nome);
  const Icon = theme.icon;
  const pct = trilha.totalVideos > 0 ? (trilha.videosConcluidos / trilha.totalVideos) * 100 : 0;

  const { data: videos = [], isLoading } = useQuery<VideoSummary[]>({
    queryKey: ['/api/treinamentos-internos/videos', { trackId: trilha.id }],
    queryFn: async () => {
      const res = await fetch(`/api/treinamentos-internos/videos?trackId=${trilha.id}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Falha ao carregar vídeos');
      return await res.json();
    },
    enabled: expanded,
  });

  const filtrados = filtroBusca
    ? videos.filter((v) => v.nome.toLowerCase().includes(filtroBusca.toLowerCase()))
    : videos;

  return (
    <Card className="overflow-hidden" data-testid={`trilha-card-${trilha.id}`}>
      <div className={`h-1 bg-gradient-to-r ${theme.color}`} />
      <CardHeader
        className="cursor-pointer hover-elevate pb-3"
        onClick={() => setExpanded((v) => !v)}
        data-testid={`trilha-header-${trilha.id}`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${theme.bgIcon}`}>
            <Icon className={`w-5 h-5 ${theme.textIcon}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold truncate">{trilha.nome}</h3>
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {trilha.videosConcluidos}/{trilha.totalVideos}
              </span>
            </div>
            <Progress value={pct} className="h-1.5 mt-2" />
          </div>
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtrados.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              {filtroBusca ? 'Nenhum vídeo bate com a busca.' : 'Nenhum vídeo nesta trilha ainda.'}
            </div>
          ) : (
            <div className="space-y-1">
              {filtrados.map((v) => <VideoCard key={v.id} video={v} />)}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
