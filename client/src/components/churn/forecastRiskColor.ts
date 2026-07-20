/**
 * Classe de badge (fundo + texto) por tier de risco do churnRiskEngine.
 * Alinhado à escala de severity.ts: baixo=emerald … critico=red. Theme-aware.
 * tier null/desconhecido (contrato sem score) → cinza neutro.
 */
export function forecastRiskBadgeClass(tier: string | null): string {
  switch (tier) {
    case "critico":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    case "alto":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
    case "moderado":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    case "baixo":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    default:
      return "bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400";
  }
}
