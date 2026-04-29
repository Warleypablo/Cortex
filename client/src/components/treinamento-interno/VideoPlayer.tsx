import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VideoPlayerProps {
  driveFileId: string;
  titulo: string;
}

export function VideoPlayer({ driveFileId, titulo }: VideoPlayerProps) {
  const driveUrl = `https://drive.google.com/file/d/${driveFileId}/view`;
  const embedUrl = `https://drive.google.com/file/d/${driveFileId}/preview`;

  return (
    <div className="space-y-3">
      <div className="aspect-video w-full overflow-hidden rounded-lg border border-gray-200 dark:border-zinc-700 bg-black">
        <iframe
          src={embedUrl}
          title={titulo}
          allow="autoplay; fullscreen"
          allowFullScreen
          className="w-full h-full"
          data-testid="video-player-iframe"
        />
      </div>
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" asChild>
          <a href={driveUrl} target="_blank" rel="noopener noreferrer" data-testid="link-open-drive">
            <ExternalLink className="w-3 h-3 mr-1" />
            Abrir no Drive
          </a>
        </Button>
      </div>
    </div>
  );
}
