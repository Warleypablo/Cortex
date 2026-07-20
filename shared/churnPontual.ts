/**
 * Fração mínima de linhas de churn com valor pontual para que a série
 * pontual do histórico seja exibida.
 *
 * Medido em prod (2026-07-20): 2026 tem 23,5% de cobertura, 2025 tem 3,7%
 * e 2024 tem 0%. O limiar de 10% separa 2026 dos demais com folga dos dois
 * lados, então não é sensível a pequenas variações do dado.
 *
 * Régua por cobertura, e não por "existe algum valorp > 0", porque 2025 tem
 * R$ 152.743 espalhados em 3,7% das linhas: uma série que aparenta medir
 * churn pontual mas mede ~4% dele é pior do que série nenhuma.
 */
export const LIMIAR_COBERTURA_PONTUAL = 0.1;

/** Decide se o dado pontual de um ano tem cobertura suficiente para ser exibido. */
export function pontualTemCobertura(linhasComPontual: number, totalLinhas: number): boolean {
  if (!totalLinhas || totalLinhas <= 0) return false;
  return linhasComPontual / totalLinhas >= LIMIAR_COBERTURA_PONTUAL;
}
