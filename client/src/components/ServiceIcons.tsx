import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getServiceIcon } from "@/lib/service-icons";
import { MoreHorizontal } from "lucide-react";

interface ServiceIconsProps {
  services: string | null;
  maxVisible?: number;
}

export function ServiceIcons({ services, maxVisible = 5 }: ServiceIconsProps) {
  if (!services) {
    return <span className="text-muted-foreground text-sm">-</span>;
  }

  const serviceList = services
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (serviceList.length === 0) {
    return <span className="text-muted-foreground text-sm">-</span>;
  }

  const visibleServices = serviceList.slice(0, maxVisible);
  const hiddenServices = serviceList.slice(maxVisible);
  const hasMore = hiddenServices.length > 0;

  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid="service-icons-container">
      {visibleServices.map((service, index) => {
        const { icon: Icon, color } = getServiceIcon(service);
        return (
          <Tooltip key={`${service}-${index}`}>
            <TooltipTrigger asChild>
              <div
                className={`${color} hover-elevate cursor-default rounded-md p-1.5`}
                data-testid={`service-icon-${index}`}
              >
                <Icon className="h-4 w-4" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{service}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
      {hasMore && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="text-muted-foreground hover-elevate cursor-default rounded-md p-1.5"
              data-testid="service-icon-more"
            >
              <MoreHorizontal className="h-4 w-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="max-w-xs">
              <p className="font-semibold mb-1">+{hiddenServices.length} serviços:</p>
              <p className="text-xs">{hiddenServices.join(", ")}</p>
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
