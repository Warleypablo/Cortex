import { useParams, Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ChevronLeft, Heart, Check, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useSetPageInfo } from '@/contexts/PageContext';
import { usePageTitle } from '@/hooks/use-page-title';
import { VideoPlayer } from '@/components/treinamento-interno/VideoPlayer';
import { ComentariosThread } from '@/components/treinamento-interno/ComentariosThread';
import type { Comentario } from '@/components/treinamento-interno/ComentarioItem';

interface VideoDetail {
  video: {
    id: string;
    nome: string;
    driveFileId: string;
    thumbnailUrl: string | null;
    duracaoMs: number | null;
    driveModifiedTime: string | null;
  };
  trilha: { id: string; nome: string };
  userConcluiu: boolean;
  userCurtiu: boolean;
  totalLikes: number;
  comentarios: Comentario[];
}

function formatarDuracao(ms: number | null): string {
  if (!ms) return '';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export default function TreinamentoInternoVideo() {
  const { videoId } = useParams<{ videoId: string }>();
  const { toast } = useToast();
  usePageTitle('Treinamento Interno');
  useSetPageInfo('Treinamento Interno', 'Vídeos internos da equipe');

  const { data, isLoading, error } = useQuery<VideoDetail>({
    queryKey: ['/api/treinamentos-internos/videos', videoId],
    queryFn: async () => {
      const res = await fetch(`/api/treinamentos-internos/videos/${videoId}`, { credentials: 'include' });
      if (!res.ok) throw new Error(res.status === 404 ? 'Vídeo não disponível' : 'Falha ao carregar vídeo');
      return await res.json();
    },
  });

  const concluirMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/treinamentos-internos/videos/${videoId}/concluir`);
      return (await res.json()) as { concluido: boolean };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/treinamentos-internos/videos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/treinamentos-internos/trilhas'] });
    },
    onError: (err: Error) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/treinamentos-internos/videos/${videoId}/like`);
      return (await res.json()) as { curtiu: boolean; totalLikes: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/treinamentos-internos/videos'] });
    },
    onError: (err: Error) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96" data-testid="loading-video">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <Button variant="ghost" asChild>
          <Link href="/conhecimentos" data-testid="link-voltar">
            <ChevronLeft className="w-4 h-4 mr-1" />Voltar
          </Link>
        </Button>
        <div className="mt-12 text-center">
          <h2 className="text-xl font-semibold">Vídeo não disponível</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Este vídeo pode ter sido removido do Drive.
          </p>
        </div>
      </div>
    );
  }

  const { video, trilha, userConcluiu, userCurtiu, totalLikes, comentarios } = data;
  const modifiedDate = video.driveModifiedTime ? format(new Date(video.driveModifiedTime), "d 'de' MMM yyyy", { locale: ptBR }) : null;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/conhecimentos" data-testid="link-voltar">
            <ChevronLeft className="w-4 h-4 mr-1" />Voltar para Treinamento Interno
          </Link>
        </Button>
        <div className="text-sm text-muted-foreground">
          <Link href="/conhecimentos" className="hover:text-primary">{trilha.nome}</Link>
          {' / '}
          <span className="text-foreground">{video.nome}</span>
        </div>
      </div>

      <VideoPlayer driveFileId={video.driveFileId} titulo={video.nome} />

      <div>
        <h1 className="text-2xl font-bold">{video.nome}</h1>
        <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
          {video.duracaoMs && <span>{formatarDuracao(video.duracaoMs)}</span>}
          {modifiedDate && <span>· Atualizado em {modifiedDate}</span>}
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <Button
            variant={userConcluiu ? 'default' : 'outline'}
            onClick={() => concluirMutation.mutate()}
            disabled={concluirMutation.isPending}
            data-testid="button-concluir"
          >
            <Check className={cn('w-4 h-4 mr-2', userConcluiu ? 'opacity-100' : 'opacity-50')} />
            {userConcluiu ? 'Concluído' : 'Marcar como concluído'}
          </Button>
          <Button
            variant={userCurtiu ? 'default' : 'outline'}
            onClick={() => likeMutation.mutate()}
            disabled={likeMutation.isPending}
            data-testid="button-like"
          >
            <Heart className={cn('w-4 h-4 mr-2', userCurtiu && 'fill-current')} />
            {totalLikes} like{totalLikes === 1 ? '' : 's'}
          </Button>
        </div>
      </div>

      <hr className="border-gray-200 dark:border-zinc-700" />

      <ComentariosThread videoId={video.id} comentarios={comentarios} />
    </div>
  );
}
