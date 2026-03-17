import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface HeroMetricProps {
  label: string;
  value: string;
  subtitle?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export function HeroMetric({ label, value, subtitle, trend }: HeroMetricProps) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        {subtitle && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="w-3.5 h-3.5 rounded-full bg-muted/50 dark:bg-white/10 flex items-center justify-center hover:bg-muted dark:hover:bg-white/20 transition-colors shrink-0"
              >
                <Info className="w-2 h-2 text-muted-foreground" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg p-3 text-sm text-foreground max-w-[250px]"
            >
              {subtitle}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <p className="text-2xl sm:text-3xl font-semibold text-foreground mt-1">
        {value}
      </p>
      {trend && (
        <span
          className={cn(
            "text-sm font-medium mt-1",
            trend.isPositive
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
          )}
        >
          {trend.isPositive ? "▲" : "▼"} {trend.value}
        </span>
      )}
    </div>
  );
}
