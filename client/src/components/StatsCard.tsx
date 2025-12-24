import { LucideIcon, Info, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCountUpNumber } from "@/hooks/useCountUp";

type CardVariant = "default" | "success" | "warning" | "error" | "info" | "status";

interface StatsCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  variant?: CardVariant;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  statusActive?: boolean;
  subtitle?: string;
  tooltipType?: "info" | "help";
  animateValue?: boolean;
  rawValue?: number;
  formatValue?: (value: number) => string;
}

const variantStyles: Record<CardVariant, { bg: string; border: string; icon: string; iconBg: string }> = {
  default: {
    bg: "bg-white/60 dark:bg-white/5",
    border: "border-white/40 dark:border-white/10",
    icon: "text-primary",
    iconBg: "bg-primary/10 dark:bg-primary/20",
  },
  success: {
    bg: "bg-gradient-to-br from-emerald-50/80 to-white/60 dark:from-emerald-950/30 dark:to-white/5",
    border: "border-emerald-200/50 dark:border-emerald-500/20",
    icon: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
  },
  warning: {
    bg: "bg-gradient-to-br from-amber-50/80 to-white/60 dark:from-amber-950/30 dark:to-white/5",
    border: "border-amber-200/50 dark:border-amber-500/20",
    icon: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-100 dark:bg-amber-900/40",
  },
  error: {
    bg: "bg-gradient-to-br from-red-50/80 to-white/60 dark:from-red-950/30 dark:to-white/5",
    border: "border-red-200/50 dark:border-red-500/20",
    icon: "text-red-600 dark:text-red-400",
    iconBg: "bg-red-100 dark:bg-red-900/40",
  },
  info: {
    bg: "bg-gradient-to-br from-blue-50/80 to-white/60 dark:from-blue-950/30 dark:to-white/5",
    border: "border-blue-200/50 dark:border-blue-500/20",
    icon: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-100 dark:bg-blue-900/40",
  },
  status: {
    bg: "bg-white/60 dark:bg-white/5",
    border: "border-white/40 dark:border-white/10",
    icon: "text-primary",
    iconBg: "bg-primary/10 dark:bg-primary/20",
  },
};

export default function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  variant = "default",
  trend,
  statusActive,
  subtitle,
  tooltipType = "info",
  animateValue = false,
  rawValue,
  formatValue
}: StatsCardProps) {
  const TooltipIcon = tooltipType === "help" ? HelpCircle : Info;
  const styles = variantStyles[variant];
  
  const animatedNumber = useCountUpNumber(rawValue ?? 0, 800, animateValue && rawValue !== undefined);
  const displayValue = animateValue && rawValue !== undefined && formatValue 
    ? formatValue(animatedNumber) 
    : value;
  
  const isStatusCard = variant === "status";
  const statusStyles = statusActive 
    ? {
        bg: "bg-gradient-to-br from-emerald-50/80 to-white/60 dark:from-emerald-950/30 dark:to-white/5",
        border: "border-emerald-300/50 dark:border-emerald-500/30",
        icon: "text-emerald-600 dark:text-emerald-400",
        iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
        ring: "ring-2 ring-emerald-400/30 dark:ring-emerald-500/20",
      }
    : {
        bg: "bg-gradient-to-br from-slate-100/80 to-white/60 dark:from-slate-900/50 dark:to-white/5",
        border: "border-slate-300/50 dark:border-slate-500/30",
        icon: "text-slate-500 dark:text-slate-400",
        iconBg: "bg-slate-200 dark:bg-slate-800/60",
        ring: "",
      };

  const finalStyles = isStatusCard ? statusStyles : styles;

  return (
    <div
      className={cn(
        "relative rounded-xl p-4",
        "backdrop-blur-xl",
        "border",
        "shadow-md shadow-black/5 dark:shadow-black/20",
        "transition-shadow duration-300",
        "hover:shadow-lg hover:shadow-black/10 dark:hover:shadow-black/30",
        isStatusCard ? statusStyles.bg : finalStyles.bg,
        isStatusCard ? statusStyles.border : finalStyles.border,
        isStatusCard && statusStyles.ring,
      )}
      data-testid={`stats-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent dark:from-white/5 pointer-events-none rounded-xl overflow-hidden" />
      
      <div className="relative flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div 
            className={cn(
              "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
              isStatusCard ? statusStyles.iconBg : finalStyles.iconBg
            )}
          >
            <Icon className={cn(
              "w-3.5 h-3.5",
              isStatusCard ? statusStyles.icon : finalStyles.icon
            )} />
          </div>
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider truncate">
              {title}
            </p>
            {subtitle && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    type="button"
                    className="w-3.5 h-3.5 rounded-full bg-muted/50 dark:bg-white/10 flex items-center justify-center hover:bg-muted dark:hover:bg-white/20 transition-colors shrink-0"
                    data-testid={`tooltip-${title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <TooltipIcon className="w-2 h-2 text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent 
                  side="bottom" 
                  align="start"
                  sideOffset={8}
                  className="z-[9999] backdrop-blur-xl bg-white/95 dark:bg-slate-900/95 border border-white/40 dark:border-white/10 shadow-xl shadow-black/10 dark:shadow-black/30 px-3 py-2 rounded-lg max-w-[250px]"
                >
                  <p className="text-sm text-foreground">{subtitle}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        <div className="pl-9">
          <p className="text-lg sm:text-xl font-bold text-foreground leading-tight break-words">
            {displayValue}
          </p>
          {trend && (
            <p className={cn(
              "text-xs font-medium mt-1 flex items-center gap-1",
              trend.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
            )}>
              <span>{trend.isPositive ? "↑" : "↓"}</span>
              <span>{trend.value}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
