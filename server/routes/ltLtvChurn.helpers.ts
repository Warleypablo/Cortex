/** Revenue churn % = MRR perdido / MRR ativo no início do período, 1 casa decimal. */
export function revenueChurnPct(mrrPerdido: number, mrrAtivoInicio: number): number {
  if (!mrrAtivoInicio || mrrAtivoInicio <= 0) return 0;
  return Math.round((mrrPerdido / mrrAtivoInicio) * 1000) / 10;
}

/** LTV total do cliente = LTV recorrente + LTV pontual (null/undefined → 0). */
export function ltvTotalCliente(
  ltvRecorrente: number | null | undefined,
  ltvPontual: number | null | undefined,
): number {
  return (ltvRecorrente ?? 0) + (ltvPontual ?? 0);
}
