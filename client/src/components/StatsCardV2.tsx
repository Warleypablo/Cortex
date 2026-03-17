import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

type CardVariant = "default" | "success" | "warning" | "error";

const variantBorder: Record<CardVariant, string> = {
  default: "",
  success: "border-l-[3px] border-l-emerald-500 dark:border-l-emerald-400",
  warning: "border-l-[3px] border-l-amber-500 dark:border-l-amber-400",
  error: "border-l-[3px] border-l-red-500 dark:border-l-red-400",
};

interface StatsCardV2Props {
  title: string;
  value: string;
  variant?: CardVariant;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  subtitle?: string;
}

export function StatsCardV2({
  title,
  value,
  variant = "default",
  trend,
  subtitle,
}: StatsCardV2Props) {
  return (
    <div
      className={cn(
        "bg-white dark:bg-zinc-900",
        "border border-gray-100 dark:border-zinc-800",
        "rounded-lg p-5",
        variantBorder[variant]
      )}
    >
      <div className="flex items-center gap-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
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
      <p className="text-lg font-medium text-foreground mt-1">{value}</p>
      {trend && (
        <span
          className={cn(
            "text-xs font-medium mt-1 inline-block",
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
