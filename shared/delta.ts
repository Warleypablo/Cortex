/**
 * Variação entre duas semanas.
 *
 * Linhas de moeda usam variação RELATIVA (%). Linhas que já são percentuais
 * (`percentual = true`) usam diferença em PONTOS PERCENTUAIS: churn indo de 2%
 * para 3% é '+1,0 p.p.', não '+50%'. Como não há divisão, o caso
 * `anterior = 0` continua definido para elas — o guard de zero existe só para
 * as linhas de moeda.
 *
 * `null` em qualquer ponta (métrica indisponível, ex.: headcount zero)
 * propaga como `null`: a tela mostra '—' em vez de inventar uma variação.
 */
export function calcularDelta(
  atual: number | null,
  anterior: number | null,
  percentual = false,
): number | null {
  if (atual === null || anterior === null) return null;
  if (percentual) return atual - anterior;
  if (anterior === 0) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}
