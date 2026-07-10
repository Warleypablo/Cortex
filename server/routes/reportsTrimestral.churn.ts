// Churn médio mensal (ponderado) de uma squad no trimestre.
//
// Decisão 2026-07-10 (Ichino): no slide "Squad em Destaque" o churn do trimestre
// passa a ser lido como TAXA MENSAL média, não como acumulado sobre a base do 1º
// dia. A régua antiga (Σ churn do tri / MRR do início do tri) inflava squads que
// cresceram no período — a Pulse aparecia com 85,2% quando o churn mensal médio
// dela era ~29%. A nova régua é ponderada pela base:
//
//   taxa mensal = Σ churn do tri  ÷  Σ (MRR no início de cada mês computado)
//
// Se cada mês teve r% de churn, o resultado é r% (não o acumulado). É a mesma
// escala da meta de ~8%/mês. O numerador é idêntico ao que já era somado no tri;
// só o denominador troca (base do 1º dia → soma das bases mensais).

/**
 * Taxa de churn mensal média ponderada, em pontos percentuais, arredondada a 1
 * casa. `numeradorBrl` = churn somado no trimestre (pode ser negativo no NRR
 * quando a expansão supera o churn). `somaBasesMensais` = Σ do MRR no início de
 * cada mês computado do tri. Base ≤ 0 → 0 (sem base não há taxa).
 */
export function churnMensalPonderadoPct(numeradorBrl: number, somaBasesMensais: number): number {
  if (!(somaBasesMensais > 0)) return 0;
  return Math.round((numeradorBrl / somaBasesMensais) * 1000) / 10;
}
