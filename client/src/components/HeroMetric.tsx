import { cn } from "@/lib/utils";

interface HeroMetricProps {
  label: string;
  value: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export function HeroMetric({ label, value, trend }: HeroMetricProps) {
  return (
    <div className="flex flex-col">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
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
