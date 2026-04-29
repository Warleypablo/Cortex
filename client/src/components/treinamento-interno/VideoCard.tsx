import { Link } from 'wouter';
import { Check, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface VideoSummary {
  id: string;
  nome: string;
  driveFileId: string;
  thumbnailUrl: string | null;
  duracaoMs: number | null;
  userConcluiu: boolean;
}

function formatarDuracao(ms: number | null): string {
  if (!ms) return '';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

interface VideoCardProps {
  video: VideoSummary;
}

export function VideoCard({ video }: VideoCardProps) {
  return (
    <Link
      href={`/conhecimentos/treinamentos/${video.id}`}
      data-testid={`video-card-${video.id}`}
      className={cn(
        'group flex gap-3 p-3 rounded-lg border border-transparent',
        'hover:border-gray-200 dark:hover:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800/50',
        'transition-colors cursor-pointer'
      )}
    >
      <div className="relative w-32 aspect-video shrink-0 overflow-hidden rounded-md bg-gray-200 dark:bg-zinc-800">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.nome}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
        {video.duracaoMs && (
          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 text-xs bg-black/70 text-white rounded">
            {formatarDuracao(video.duracaoMs)}
          </span>
        )}
        {video.userConcluiu && (
          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-green-600 text-white flex items-center justify-center">
            <Check className="w-3 h-3" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 flex items-center">
        <div className="text-sm font-medium line-clamp-2 group-hover:text-primary">
          {video.nome}
        </div>
      </div>
    </Link>
  );
}
