import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getServiceIcon } from "@/lib/service-icons";

interface ServiceIconsProps {
  services: string | null;
}

export function ServiceIcons({ services }: ServiceIconsProps) {
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

  return (
    <div className="flex items-center gap-2" data-testid="service-icons-container">
      {serviceList.map((service, index) => {
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
    </div>
  );
}
