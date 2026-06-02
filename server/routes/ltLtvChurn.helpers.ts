/** Revenue churn % = MRR perdido / MRR ativo no início do período, 1 casa decimal. */
export function revenueChurnPct(mrrPerdido: number, mrrAtivoInicio: number): number {
  if (!mrrAtivoInicio || mrrAtivoInicio <= 0) return 0;
  return Math.round((mrrPerdido / mrrAtivoInicio) * 1000) / 10;
}
