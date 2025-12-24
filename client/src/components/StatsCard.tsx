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
    bg: "bg-gradient-to-br from-white/80 via-white/60 to-slate-50/40 dark:from-slate-800/60 dark:via-slate-900/50 dark:to-slate-950/40",
    border: "border-white/60 dark:border-white/10",
    icon: "text-primary",
    iconBg: "bg-gradient-to-br from-primary/20 to-primary/10 dark:from-primary/30 dark:to-primary/15",
  },
  success: {
    bg: "bg-gradient-to-br from-emerald-50/90 via-white/70 to-white/70 dark:from-emerald-950/50 dark:via-emerald-900/30 dark:to-slate-900/40",
    border: "border-emerald-200/60 dark:border-emerald-500/25",
    icon: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-gradient-to-br from-emerald-200/80 to-emerald-100/60 dark:from-emerald-800/60 dark:to-emerald-900/40",
  },
  warning: {
    bg: "bg-gradient-to-br from-amber-50/90 via-white/70 to-white/70 dark:from-amber-950/50 dark:via-amber-900/30 dark:to-slate-900/40",
    border: "border-amber-200/60 dark:border-amber-500/25",
    icon: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-gradient-to-br from-amber-200/80 to-amber-100/60 dark:from-amber-800/60 dark:to-amber-900/40",
  },
  error: {
    bg: "bg-gradient-to-br from-red-50/90 via-white/70 to-white/70 dark:from-red-950/50 dark:via-red-900/30 dark:to-slate-900/40",
    border: "border-red-200/60 dark:border-red-500/25",
    icon: "text-red-600 dark:text-red-400",
    iconBg: "bg-gradient-to-br from-red-200/80 to-red-100/60 dark:from-red-800/60 dark:to-red-900/40",
  },
  info: {
    bg: "bg-gradient-to-br from-blue-50/90 via-white/70 to-white/70 dark:from-blue-950/50 dark:via-blue-900/30 dark:to-slate-900/40",
    border: "border-blue-200/60 dark:border-blue-500/25",
    icon: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-gradient-to-br from-blue-200/80 to-blue-100/60 dark:from-blue-800/60 dark:to-blue-900/40",
  },
  status: {
    bg: "bg-gradient-to-br from-white/80 via-white/60 to-slate-50/40 dark:from-slate-800/60 dark:via-slate-900/50 dark:to-slate-950/40",
    border: "border-white/60 dark:border-white/10",
    icon: "text-primary",
    iconBg: "bg-gradient-to-br from-primary/20 to-primary/10 dark:from-primary/30 dark:to-primary/15",
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
        "shadow-md",
        "transition-all duration-300 ease-out",
        "hover:shadow-lg hover:scale-[1.01]",
        "group",
        isStatusCard ? statusStyles.bg : finalStyles.bg,
        isStatusCard ? statusStyles.border : finalStyles.border,
        isStatusCard && statusStyles.ring,
      )}
      data-testid={`stats-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-white/5 to-transparent dark:from-white/8 dark:via-white/3 dark:to-transparent pointer-events-none rounded-xl overflow-hidden" />
      
      <div className="relative flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div 
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
              "shadow-sm",
              "transition-transform duration-300 group-hover:scale-110",
              isStatusCard ? statusStyles.iconBg : finalStyles.iconBg
            )}
          >
            <Icon className={cn(
              "w-4 h-4 transition-transform duration-300",
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
        <div className="pl-10">
          <p className="text-xl sm:text-2xl font-bold text-foreground leading-tight break-words tracking-tight">
            {displayValue}
          </p>
          {trend && (
            <div className={cn(
              "inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-xs font-semibold",
              trend.isPositive 
                ? "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" 
                : "bg-red-100/80 text-red-700 dark:bg-red-900/40 dark:text-red-300"
            )}>
              <span className="text-[10px]">{trend.isPositive ? "▲" : "▼"}</span>
              <span>{trend.value}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
