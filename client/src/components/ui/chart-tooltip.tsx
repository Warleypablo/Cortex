import { cn } from "@/lib/utils";
import { AlertTriangle, TrendingDown, TrendingUp, Info } from "lucide-react";

export type ChartTooltipDataType = "currency" | "percentage" | "count" | "text";

export interface ChartTooltipItem {
  label: string;
  value: number | string;
  type?: ChartTooltipDataType;
  color?: string;
  isAnomaly?: boolean;
  anomalyDirection?: "up" | "down";
}

export interface ChartTooltipProps {
  title?: string;
  subtitle?: string;
  items: ChartTooltipItem[];
  footer?: string;
  showAnomalyWarning?: boolean;
  className?: string;
}

function formatValue(value: number | string, type: ChartTooltipDataType = "text"): string {
  if (typeof value === "string") return value;
  
  switch (type) {
    case "currency":
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    case "percentage":
      return `${value.toFixed(1)}%`;
    case "count":
      return value.toLocaleString("pt-BR");
    default:
      return String(value);
  }
}

export function ChartTooltip({
  title,
  subtitle,
  items,
  footer,
  showAnomalyWarning,
  className,
}: ChartTooltipProps) {
  const hasAnomalies = items.some((item) => item.isAnomaly);

  return (
    <div
      className={cn(
        "bg-background border border-border rounded-lg shadow-lg p-3 min-w-[180px] max-w-[300px]",
        className
      )}
      data-testid="chart-tooltip"
    >
      {title && (
        <div className="flex items-center gap-2 mb-2">
          <h4 className="font-semibold text-sm">{title}</h4>
          {showAnomalyWarning && hasAnomalies && (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
        </div>
      )}
      
      {subtitle && (
        <p className="text-xs text-muted-foreground mb-2">{subtitle}</p>
      )}

      <div className="space-y-1.5">
        {items.map((item, index) => (
          <div
            key={index}
            className={cn(
              "flex items-center justify-between gap-4 text-sm",
              item.isAnomaly && "font-medium"
            )}
          >
            <div className="flex items-center gap-2">
              {item.color && (
                <div
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
              )}
              <span className="text-muted-foreground truncate">{item.label}</span>
            </div>
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "font-medium",
                  item.isAnomaly && item.anomalyDirection === "up" && "text-red-600 dark:text-red-400",
                  item.isAnomaly && item.anomalyDirection === "down" && "text-green-600 dark:text-green-400"
                )}
              >
                {formatValue(item.value, item.type)}
              </span>
              {item.isAnomaly && item.anomalyDirection === "up" && (
                <TrendingUp className="h-3 w-3 text-red-600 dark:text-red-400" />
              )}
              {item.isAnomaly && item.anomalyDirection === "down" && (
                <TrendingDown className="h-3 w-3 text-green-600 dark:text-green-400" />
              )}
            </div>
          </div>
        ))}
      </div>

      {footer && (
        <div className="mt-2 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Info className="h-3 w-3" />
            {footer}
          </p>
        </div>
      )}
    </div>
  );
}

export interface CohortCellTooltipProps {
  cohortLabel: string;
  monthOffset: number;
  retentionRate: number;
  expectedRate?: number;
  activeCount: number;
  totalCount: number;
  activeValue?: number;
  isOutlier?: boolean;
  outlierType?: "high" | "low";
}

export function CohortCellTooltip({
  cohortLabel,
  monthOffset,
  retentionRate,
  expectedRate,
  activeCount,
  totalCount,
  activeValue,
  isOutlier,
  outlierType,
}: CohortCellTooltipProps) {
  const deviation = expectedRate ? ((retentionRate - expectedRate) / expectedRate) * 100 : null;

  return (
    <div
      className="bg-background border border-border rounded-lg shadow-lg p-3 min-w-[200px]"
      data-testid="cohort-cell-tooltip"
    >
      <div className="flex items-center gap-2 mb-2">
        <h4 className="font-semibold text-sm">
          {cohortLabel} - Mês {monthOffset}
        </h4>
        {isOutlier && (
          <AlertTriangle
            className={cn(
              "h-4 w-4",
              outlierType === "high" ? "text-green-500" : "text-amber-500"
            )}
          />
        )}
      </div>

      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Taxa de Retenção:</span>
          <span
            className={cn(
              "font-semibold",
              isOutlier && outlierType === "high" && "text-green-600 dark:text-green-400",
              isOutlier && outlierType === "low" && "text-amber-600 dark:text-amber-400"
            )}
          >
            {retentionRate.toFixed(1)}%
          </span>
        </div>

        {expectedRate !== undefined && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Esperado:</span>
            <span className="font-medium">{expectedRate.toFixed(0)}%</span>
          </div>
        )}

        {deviation !== null && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Desvio:</span>
            <span
              className={cn(
                "font-medium",
                deviation > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              )}
            >
              {deviation > 0 ? "+" : ""}
              {deviation.toFixed(1)}%
            </span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-muted-foreground">Ativos / Total:</span>
          <span className="font-medium">
            {activeCount} / {totalCount}
          </span>
        </div>

        {activeValue !== undefined && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Valor Ativo:</span>
            <span className="font-medium">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
                minimumFractionDigits: 0,
              }).format(activeValue)}
            </span>
          </div>
        )}
      </div>

      <div className="mt-2 pt-2 border-t border-border">
        <p className="text-xs text-muted-foreground">
          {monthOffset === 0
            ? "Mês de entrada da safra"
            : `${monthOffset} ${monthOffset === 1 ? "mês" : "meses"} após entrada`}
        </p>
      </div>
    </div>
  );
}

export function isAnomaly(value: number, average: number, threshold: number = 0.2): boolean {
  if (average === 0) return false;
  const deviation = Math.abs((value - average) / average);
  return deviation > threshold;
}

export function getAnomalyDirection(value: number, average: number): "up" | "down" {
  return value > average ? "up" : "down";
}
