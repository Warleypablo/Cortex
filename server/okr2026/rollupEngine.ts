import { BP_2026_TARGETS, MetricDefinition } from "./bp2026Targets";

export type PeriodType = "month_end" | "month_sum";
export type Period = "Q1" | "Q2" | "Q3" | "Q4" | "YTD" | string;

export interface PeriodValue {
  value: number | null;
  source: "plan" | "actual" | "derived";
  status: "ready" | "partial" | "not_ready";
}

export interface RollupResult {
  plan: number | null;
  actual: number | null;
  variance: number | null;
  variancePct: number | null;
  status: "green" | "yellow" | "red" | "gray";
}

const QUARTER_MONTHS: Record<string, string[]> = {
  Q1: ["2026-01", "2026-02", "2026-03"],
  Q2: ["2026-04", "2026-05", "2026-06"],
  Q3: ["2026-07", "2026-08", "2026-09"],
  Q4: ["2026-10", "2026-11", "2026-12"],
};

const QUARTER_END_MONTHS: Record<string, string> = {
  Q1: "2026-03",
  Q2: "2026-06",
  Q3: "2026-09",
  Q4: "2026-12",
};

const ALL_MONTHS = [
  "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
  "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"
];

export function getMetricDefinition(metricKey: string): MetricDefinition | undefined {
  return BP_2026_TARGETS.find(m => m.metric_key === metricKey);
}

export function getMonthsForPeriod(period: Period, upToMonth?: string): string[] {
  if (period.startsWith("2026-")) {
    return [period];
  }
  
  if (period === "YTD") {
    const endMonth = upToMonth || "2026-12";
    const endIndex = ALL_MONTHS.indexOf(endMonth);
    if (endIndex === -1) return ALL_MONTHS;
    return ALL_MONTHS.slice(0, endIndex + 1);
  }
  
  if (period in QUARTER_MONTHS) {
    return QUARTER_MONTHS[period];
  }
  
  return [];
}

export function getEndMonthForPeriod(period: Period, upToMonth?: string): string {
  if (period.startsWith("2026-")) {
    return period;
  }
  
  if (period === "YTD") {
    return upToMonth || "2026-12";
  }
  
  if (period in QUARTER_END_MONTHS) {
    return QUARTER_END_MONTHS[period];
  }
  
  return "2026-12";
}

export interface ComputeOptions {
  periodType?: PeriodType;
  unit?: "BRL" | "COUNT" | "PCT";
  upToMonth?: string;
}

export function getLastAvailableMonth(values: Record<string, number>): string | null {
  const months = Object.keys(values).filter(k => k.startsWith("2026-")).sort();
  return months.length > 0 ? months[months.length - 1] : null;
}

export function computePeriodValue(
  metricKey: string,
  year: number,
  period: Period,
  values: Record<string, number>,
  periodTypeOrOptions?: PeriodType | ComputeOptions
): number | null {
  const metric = getMetricDefinition(metricKey);
  
  let effectivePeriodType: PeriodType;
  let unit: "BRL" | "COUNT" | "PCT";
  let upToMonth: string | undefined;
  
  if (typeof periodTypeOrOptions === "object") {
    effectivePeriodType = periodTypeOrOptions.periodType || metric?.period_type || "month_sum";
    unit = periodTypeOrOptions.unit || metric?.unit || "BRL";
    upToMonth = periodTypeOrOptions.upToMonth;
  } else {
    effectivePeriodType = periodTypeOrOptions || metric?.period_type || "month_sum";
    unit = metric?.unit || "BRL";
  }
  
  if (period === "YTD" && effectivePeriodType === "month_end" && !upToMonth) {
    upToMonth = getLastAvailableMonth(values) || "2026-12";
  }
  
  const months = getMonthsForPeriod(period, upToMonth);
  if (months.length === 0) return null;
  
  const monthValues = months
    .map(m => values[m])
    .filter((v): v is number => v !== undefined && v !== null);
  
  if (monthValues.length === 0) return null;
  
  if (unit === "PCT") {
    return monthValues.reduce((sum, v) => sum + v, 0) / monthValues.length;
  }
  
  switch (effectivePeriodType) {
    case "month_end":
      const endMonth = getEndMonthForPeriod(period, upToMonth);
      return values[endMonth] ?? null;
    
    case "month_sum":
      return monthValues.reduce((sum, v) => sum + v, 0);
    
    default:
      return monthValues.reduce((sum, v) => sum + v, 0);
  }
}

export function computePlanValue(
  metricKey: string,
  period: Period
): number | null {
  const metric = getMetricDefinition(metricKey);
  if (!metric) return null;
  
  return computePeriodValue(metricKey, 2026, period, metric.months, metric.period_type);
}

export function computeQuarterRollups(
  metricKey: string,
  values: Record<string, number>,
  periodType?: PeriodType
): Record<string, number | null> {
  const result: Record<string, number | null> = {};
  
  for (const quarter of ["Q1", "Q2", "Q3", "Q4"]) {
    result[quarter] = computePeriodValue(metricKey, 2026, quarter, values, periodType);
  }
  
  result["YTD"] = computePeriodValue(metricKey, 2026, "YTD", values, periodType);
  
  return result;
}

export function computePlanQuarterRollups(metricKey: string): Record<string, number | null> {
  const metric = getMetricDefinition(metricKey);
  if (!metric) return { Q1: null, Q2: null, Q3: null, Q4: null, YTD: null };
  
  return computeQuarterRollups(metricKey, metric.months, metric.period_type);
}

export type SignalStatus = "green" | "yellow" | "red" | "gray";

export interface ToleranceConfig {
  yellowThreshold: number;
  redThreshold: number;
}

const DEFAULT_TOLERANCE: ToleranceConfig = {
  yellowThreshold: 0.05,
  redThreshold: 0.10,
};

const PCT_TOLERANCE: ToleranceConfig = {
  yellowThreshold: 0.02,
  redThreshold: 0.04,
};

export function computeSignalStatus(
  actual: number | null,
  plan: number | null,
  direction: "up" | "down" | "flat",
  unit: "BRL" | "COUNT" | "PCT" = "BRL",
  tolerance?: ToleranceConfig
): SignalStatus {
  if (actual === null || plan === null || plan === 0) {
    return "gray";
  }
  
  const effectiveTolerance = tolerance || (unit === "PCT" ? PCT_TOLERANCE : DEFAULT_TOLERANCE);
  const ratio = actual / plan;
  
  switch (direction) {
    case "up":
      if (ratio >= 1) return "green";
      if (ratio >= 1 - effectiveTolerance.yellowThreshold) return "yellow";
      return "red";
    
    case "down":
      if (ratio <= 1) return "green";
      if (ratio <= 1 + effectiveTolerance.yellowThreshold) return "yellow";
      return "red";
    
    case "flat":
      const diff = Math.abs(ratio - 1);
      if (diff <= effectiveTolerance.yellowThreshold) return "green";
      if (diff <= effectiveTolerance.redThreshold) return "yellow";
      return "red";
    
    default:
      return "gray";
  }
}

export function computeVariance(
  actual: number | null,
  plan: number | null
): { variance: number | null; variancePct: number | null } {
  if (actual === null || plan === null) {
    return { variance: null, variancePct: null };
  }
  
  const variance = actual - plan;
  const variancePct = plan !== 0 ? ((actual - plan) / plan) * 100 : null;
  
  return { variance, variancePct };
}

export function computeRollup(
  metricKey: string,
  period: Period,
  actualValues: Record<string, number>
): RollupResult {
  const metric = getMetricDefinition(metricKey);
  if (!metric) {
    return {
      plan: null,
      actual: null,
      variance: null,
      variancePct: null,
      status: "gray"
    };
  }
  
  const plan = computePeriodValue(metricKey, 2026, period, metric.months, metric.period_type);
  const actual = computePeriodValue(metricKey, 2026, period, actualValues, metric.period_type);
  const { variance, variancePct } = computeVariance(actual, plan);
  const status = computeSignalStatus(actual, plan, metric.direction, metric.unit);
  
  return { plan, actual, variance, variancePct, status };
}

export function getYTDMonthsUpToQuarter(quarter: string): string[] {
  switch (quarter) {
    case "Q1":
      return QUARTER_MONTHS.Q1;
    case "Q2":
      return [...QUARTER_MONTHS.Q1, ...QUARTER_MONTHS.Q2];
    case "Q3":
      return [...QUARTER_MONTHS.Q1, ...QUARTER_MONTHS.Q2, ...QUARTER_MONTHS.Q3];
    case "Q4":
    default:
      return ALL_MONTHS;
  }
}

export function computeYTDValue(
  metricKey: string,
  upToQuarter: string,
  values: Record<string, number>,
  periodType?: PeriodType
): number | null {
  const metric = getMetricDefinition(metricKey);
  const effectivePeriodType = periodType || metric?.period_type || "month_sum";
  
  const months = getYTDMonthsUpToQuarter(upToQuarter);
  const endMonth = months[months.length - 1];
  
  if (effectivePeriodType === "month_end") {
    return values[endMonth] ?? null;
  }
  
  const monthValues = months
    .map(m => values[m])
    .filter((v): v is number => v !== undefined && v !== null);
  
  if (monthValues.length === 0) return null;
  
  return monthValues.reduce((sum, v) => sum + v, 0);
}

export function getAllMetrics(): MetricDefinition[] {
  return BP_2026_TARGETS;
}

export function getMetricsByCategory(category: string): MetricDefinition[] {
  return BP_2026_TARGETS.filter(m => m.dimension_key === category);
}
