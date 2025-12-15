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
  { key: 'percMql', label: '% MQL' },
  { key: 'percRaMql', label: '% RA MQL' },
  { key: 'percRrMql', label: '% RR MQL' },
  { key: 'cpra', label: 'CPRA' },
  { key: 'cprr', label: 'CPRR' },
  { key: 'cacUnico', label: 'CAC Único' },
  { key: 'frequency', label: 'Frequência' },
];
