// Metas anuais da empresa, compartilhadas entre telas.
// Antes viviam duplicadas (o TV Leaderboard declarava a sua própria cópia da
// meta de faturamento) — qualquer revisão da meta precisava ser lembrada em
// dois lugares.

export const META_FATURAMENTO_2026 = 25_000_000;

/** Meta anual de faturamento do ano, ou null se não há meta definida. */
export function getMetaFaturamento(ano: number): number | null {
  return ano === 2026 ? META_FATURAMENTO_2026 : null;
}
