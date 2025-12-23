import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type CardVariant = "default" | "success" | "warning" | "info" | "status";

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
  statusActive 
}: StatsCardProps) {
  const styles = variantStyles[variant];
  
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
        "relative overflow-hidden rounded-2xl p-6",
        "backdrop-blur-xl",
        "border",
        "shadow-lg shadow-black/5 dark:shadow-black/20",
        "transition-shadow duration-300",
        "hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-black/30",
        isStatusCard ? statusStyles.bg : finalStyles.bg,
        isStatusCard ? statusStyles.border : finalStyles.border,
        isStatusCard && statusStyles.ring,
      )}
      data-testid={`stats-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent dark:from-white/5 pointer-events-none" />
      
      <div className="relative flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            {title}
          </p>
          <p className="text-3xl font-bold text-foreground truncate">
            {value}
          </p>
          {trend && (
            <p className={cn(
              "text-sm font-medium mt-2 flex items-center gap-1",
              trend.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
            )}>
              <span>{trend.isPositive ? "↑" : "↓"}</span>
              <span>{trend.value}</span>
            </p>
          )}
          {isStatusCard && (
            <div className="flex items-center gap-2 mt-2">
              <span className={cn(
                "w-2.5 h-2.5 rounded-full animate-pulse",
                statusActive ? "bg-emerald-500" : "bg-slate-400"
              )} />
              <span className={cn(
                "text-sm font-medium",
                statusActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"
              )}>
                {statusActive ? "Cliente Ativo" : "Cliente Inativo"}
              </span>
            </div>
          )}
        </div>
        <div 
          className={cn(
            "w-14 h-14 rounded-xl flex items-center justify-center shrink-0",
            "transition-transform duration-300",
            isStatusCard ? statusStyles.iconBg : finalStyles.iconBg
          )}
        >
          <Icon className={cn(
            "w-7 h-7",
            isStatusCard ? statusStyles.icon : finalStyles.icon
          )} />
        </div>
      </div>
    </div>
  );
}
