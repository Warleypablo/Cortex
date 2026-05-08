import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { PLATFORM_CLASSES, type PlatformKind } from './tokens';

interface PlatformChipProps {
  platform: PlatformKind;
  configured: boolean;
  id: string;
}

export default function PlatformChip({ platform, configured, id }: PlatformChipProps) {
  const classes = configured
    ? PLATFORM_CLASSES[platform].configured
    : PLATFORM_CLASSES[platform].notConfigured;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${classes}`}
        >
          {platform}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {configured
          ? `${platform}: Configurado (ID: ${id})`
          : `${platform}: Não configurado`}
      </TooltipContent>
    </Tooltip>
  );
}
