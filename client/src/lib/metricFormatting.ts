import type { MetricRulesetWithThresholds, MetricThreshold } from "@shared/schema";

export type MetricColor = 'default' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple';

export const COLOR_TOKENS: Record<MetricColor, { bg: string; text: string; label: string }> = {
  default: { bg: '', text: '', label: 'Padrão' },
  red: { bg: 'bg-red-500/20', text: 'text-red-500', label: 'Vermelho' },
  orange: { bg: 'bg-orange-500/20', text: 'text-orange-500', label: 'Laranja' },
  yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-500', label: 'Amarelo' },
  green: { bg: 'bg-green-500/20', text: 'text-green-500', label: 'Verde' },
  blue: { bg: 'bg-blue-500/20', text: 'text-blue-500', label: 'Azul' },
  purple: { bg: 'bg-purple-500/20', text: 'text-purple-500', label: 'Roxo' },
};

export function getMetricColor(
  value: number | null,
  rulesets: MetricRulesetWithThresholds[],
  metricKey: string
): MetricColor {
  if (value === null || value === undefined) return 'default';
  
  const ruleset = rulesets.find(r => r.metricKey === metricKey);
  if (!ruleset || !ruleset.thresholds.length) return 'default';
  
  for (const threshold of ruleset.thresholds) {
    const minVal = threshold.minValue !== null && threshold.minValue !== undefined 
      ? Number(threshold.minValue) : null;
    const maxVal = threshold.maxValue !== null && threshold.maxValue !== undefined 
      ? Number(threshold.maxValue) : null;
    
    const minOk = minVal === null || value >= minVal;
    const maxOk = maxVal === null || value <= maxVal;
    
    if (minOk && maxOk) {
      return (threshold.color as MetricColor) || 'default';
    }
  }
  
  return (ruleset.defaultColor as MetricColor) || 'default';
}

export function getColorClasses(color: MetricColor): string {
  const token = COLOR_TOKENS[color];
  if (!token || color === 'default') return '';
  return `${token.bg} ${token.text}`;
}

export const AVAILABLE_METRICS = [
  { key: 'cpmql', label: 'CPMQL' },
  { key: 'cpl', label: 'CPL' },
  { key: 'ctr', label: 'CTR (%)' },
  { key: 'cpm', label: 'CPM' },
  { key: 'videoHook', label: 'Video Hook (%)' },
  { key: 'videoHold', label: 'Video HOLD (%)' },
  { key: 'connectRate', label: 'Connect Rate (%)' },
  { key: 'taxaConversao', label: 'Taxa de Conversão (%)' },
  { key: 'percMql', label: '% MQL' },
  { key: 'percRa', label: 'RA (%)' },
  { key: 'percRaMql', label: 'RA MQL (%)' },
  { key: 'percRaNmql', label: 'RA NMQL (%)' },
  { key: 'percRrMql', label: 'RR MQL (%)' },
  { key: 'percRrNmql', label: 'RR NMQL (%)' },
  { key: 'percRrVendas', label: 'RR→V (%)' },
  { key: 'percRrMqlVendas', label: 'RR MQL→V (%)' },
  { key: 'percRrNmqlVendas', label: 'RR NMQL→V (%)' },
  { key: 'cacUnico', label: 'CAC Único' },
  { key: 'cacContrato', label: 'CAC Contrato' },
  { key: 'leadTime', label: 'Lead Time (dias)' },
  { key: 'aov', label: 'AOV' },
  { key: 'percRr', label: 'RR (%)' },
  { key: 'receita', label: 'Receita' },
];

// ===== Benchmark-Based Color System =====

const BENCHMARK_TOLERANCE = 0.15; // 15%

/**
 * Maps Criativos metric keys → budget segment/key + polarity.
 * lowerIsBetter: true for cost metrics (CPM, CPL, etc.), false for performance metrics (CTR, etc.)
 */
export const CRIATIVOS_BENCHMARK_MAP: Record<string, {
  budgetSegment: string;
  budgetKey: string;
  lowerIsBetter: boolean;
}> = {
  cpm:            { budgetSegment: 'meta_ads', budgetKey: 'cpm', lowerIsBetter: true },
  ctr:            { budgetSegment: 'meta_ads', budgetKey: 'ctr', lowerIsBetter: false },
  cpl:            { budgetSegment: 'meta_ads', budgetKey: 'cpl', lowerIsBetter: true },
  cpmql:          { budgetSegment: 'meta_ads', budgetKey: 'cpmql', lowerIsBetter: true },
  videoHook:      { budgetSegment: 'meta_ads', budgetKey: 'videoHook', lowerIsBetter: false },
  videoHold:      { budgetSegment: 'meta_ads', budgetKey: 'videoHold', lowerIsBetter: false },
  connectRate:    { budgetSegment: 'meta_ads', budgetKey: 'connectRate', lowerIsBetter: false },
  taxaConversao:  { budgetSegment: 'meta_ads', budgetKey: 'taxaConversaoPagina', lowerIsBetter: false },
  percMql:        { budgetSegment: 'meta_ads', budgetKey: 'percMqls', lowerIsBetter: false },
  percRa:         { budgetSegment: 'meta_ads', budgetKey: 'percRa', lowerIsBetter: false },
  percRaMql:      { budgetSegment: 'meta_ads', budgetKey: 'percRaMql', lowerIsBetter: false },
  percRaNmql:     { budgetSegment: 'meta_ads', budgetKey: 'percRaNmql', lowerIsBetter: false },
  percRr:         { budgetSegment: 'meta_ads', budgetKey: 'percRr', lowerIsBetter: false },
  percRrMql:      { budgetSegment: 'meta_ads', budgetKey: 'percRrMql', lowerIsBetter: false },
  percRrNmql:     { budgetSegment: 'meta_ads', budgetKey: 'percRrNmql', lowerIsBetter: false },
  percRrVendas:   { budgetSegment: 'meta_ads', budgetKey: 'percRrVendas', lowerIsBetter: false },
  percRrMqlVendas:  { budgetSegment: 'meta_ads', budgetKey: 'percRrMqlVendas', lowerIsBetter: false },
  percRrNmqlVendas: { budgetSegment: 'meta_ads', budgetKey: 'percRrNmqlVendas', lowerIsBetter: false },
  cacUnico:       { budgetSegment: 'meta_ads', budgetKey: 'cacUnico', lowerIsBetter: true },
  cacContrato:    { budgetSegment: 'meta_ads', budgetKey: 'cacContrato', lowerIsBetter: true },
  leadTime:       { budgetSegment: 'meta_ads', budgetKey: 'leadTime', lowerIsBetter: true },
  aov:            { budgetSegment: 'meta_ads', budgetKey: 'aov', lowerIsBetter: false },
  receita:        { budgetSegment: 'meta_ads', budgetKey: 'receita', lowerIsBetter: false },
};

/**
 * Determines color based on deviation from benchmark with polarity awareness.
 * - Green: performance is >15% better than benchmark
 * - Orange: performance is within ±15% of benchmark
 * - Red: performance is >15% worse than benchmark
 */
export function getBenchmarkColor(
  actual: number | null,
  benchmark: number | null,
  lowerIsBetter: boolean
): MetricColor {
  if (actual == null || benchmark == null || benchmark === 0) return 'default';

  // Positive deviation = actual above benchmark
  let deviation = (actual - benchmark) / Math.abs(benchmark);

  // For "lower is better" metrics (CPM, CPL, etc.):
  // actual < benchmark → negative deviation → but that's GOOD → invert
  if (lowerIsBetter) deviation = -deviation;

  // Now: positive deviation = good, negative deviation = bad
  if (deviation > BENCHMARK_TOLERANCE) return 'green';
  if (deviation >= -BENCHMARK_TOLERANCE) return 'orange';
  return 'red';
}
