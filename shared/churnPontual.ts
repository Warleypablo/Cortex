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

/**
 * Nº mínimo de linhas de churn no ano para decidir cobertura.
 *
 * Sem esse piso, a cobertura CUMULATIVA de um ano corrente mente cedo: até o
 * fim de janeiro/2026 há só 81 linhas no ano, das quais 4 com pontual (4/81 =
 * 4,9% de cobertura acumulada) — já reprovaria o limiar mesmo o ano fechando
 * em 23,5%. Nos primeiros dias de janeiro a amostra é ainda menor que essas
 * 81 linhas. Abaixo de 100 linhas a amostra é pequena demais para decidir —
 * melhor esperar mais dado do que acender/apagar a série a cada início de ano.
 */
export const MINIMO_LINHAS_COBERTURA_PONTUAL = 100;

/**
 * Decide se o dado pontual de um ano tem cobertura suficiente para ser exibido.
 *
 * Retorno ternário — `undefined` NÃO é sinônimo de `false`:
 * - `true` / `false`: amostra suficiente (`totalLinhas >= MINIMO_LINHAS_COBERTURA_PONTUAL`).
 *   `false` é uma afirmação — "este ano não tem cobertura de pontual".
 * - `undefined`: amostra insuficiente para decidir qualquer coisa (ex.: início de
 *   ano, poucas linhas de churn ainda). Não é "sem dado", é "cedo demais pra saber".
 *
 * O chamador (endpoint + frontend) deve tratar os três casos — nunca tratar
 * `undefined` como `false`, senão a tela mente durante janeiro/fevereiro de
 * todo ano (cobertura cumulativa começa baixa mesmo em anos com cobertura boa).
 */
export function pontualTemCobertura(linhasComPontual: number, totalLinhas: number): boolean | undefined {
  if (!totalLinhas || totalLinhas < MINIMO_LINHAS_COBERTURA_PONTUAL) return undefined;
  return linhasComPontual / totalLinhas >= LIMIAR_COBERTURA_PONTUAL;
}
