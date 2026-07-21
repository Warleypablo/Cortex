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

/**
 * Tom de cada faixa de temperatura do forecast: ponto indicador, barra de
 * participação e texto do valor exposto. Mesma escala do badge de risco
 * (vermelho = mais quente … cinza = sinal fraco), theme-aware.
 */
export function temperaturaTom(id: string): { ponto: string; barra: string; valor: string } {
  switch (id) {
    case "negociando":
      return {
        ponto: "bg-red-500 dark:bg-red-400",
        barra: "bg-red-500 dark:bg-red-400",
        valor: "text-red-600 dark:text-red-400",
      };
    case "insatisfeito":
      return {
        ponto: "bg-orange-500 dark:bg-orange-400",
        barra: "bg-orange-500 dark:bg-orange-400",
        valor: "text-orange-600 dark:text-orange-400",
      };
    case "atencao":
      return {
        ponto: "bg-amber-500 dark:bg-amber-400",
        barra: "bg-amber-500 dark:bg-amber-400",
        valor: "text-amber-600 dark:text-amber-400",
      };
    default:
      return {
        ponto: "bg-gray-300 dark:bg-zinc-600",
        barra: "bg-gray-400 dark:bg-zinc-500",
        valor: "text-gray-600 dark:text-zinc-400",
      };
  }
}
