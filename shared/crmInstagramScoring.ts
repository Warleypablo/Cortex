/**
 * CRM Instagram — lead scoring (modelo aditivo) + temperatura.
 *
 * Score = SOMA dos pontos de cada interação + bônus (recorrência, intenção).
 * A temperatura é uma dimensão SEPARADA (decay por dias sem interação), não
 * entra no número. Funções puras (sem I/O), reusadas por server e client.
 *
 * Os pesos saem de um `ScoringConfig` (default abaixo). A tab de Lead Scoring
 * persiste overrides no banco; server e client usam a MESMA função.
 */

export type Temperature = "hot" | "warm" | "cold";

// Tipos de interação que pontuam. comment/spontaneous_dm são capturáveis hoje;
// like/like_ad/follow dependem da captura por scraper (alimentam 0 até existir).
export type InteractionType = "spontaneous_dm" | "comment" | "like" | "like_ad" | "follow";

export const INTERACTION_TYPES: InteractionType[] = [
  "spontaneous_dm", "comment", "like", "like_ad", "follow",
];

export type ScoringConfig = {
  points: Record<InteractionType, number>;
  recurrenceBonus: number; // por post distinto engajado além do 1º
  intentBonus: number; // por comentário com intenção de compra
  hotDays: number; // 🔥 até N dias sem nova interação
  warmDays: number; // 🌡 até N dias; acima disso ❄️
};

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  points: {
    spontaneous_dm: 5,
    comment: 3,
    like: 1,
    like_ad: 2,
    follow: 1,
  },
  recurrenceBonus: 2,
  intentBonus: 3,
  hotDays: 15,
  warmDays: 30,
};

// Palavras-chave que sinalizam intenção de compra num comentário/DM.
// Fonte única (server monta regex SQL com a mesma lista; client usa hasPurchaseIntent).
export const PURCHASE_INTENT_KEYWORDS = [
  "preço", "preco", "valor", "quanto custa", "quanto é", "quero", "comprar",
  "contato", "orçamento", "orcamento", "interessad", "como funciona",
  "me chama", "chama no dm", "fechar", "quanto fica",
];

export function hasPurchaseIntent(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return PURCHASE_INTENT_KEYWORDS.some((k) => t.includes(k));
}

// Merge defensivo de um config parcial/desconhecido (banco/UI) com os defaults,
// coagindo cada campo pra número finito >= 0. Garante config sempre válido.
export function normalizeScoringConfig(partial: unknown): ScoringConfig {
  const p = (partial && typeof partial === "object" ? partial : {}) as Record<string, unknown>;
  const pts = (p.points && typeof p.points === "object" ? p.points : {}) as Record<string, unknown>;
  const out: ScoringConfig = {
    points: { ...DEFAULT_SCORING_CONFIG.points },
    recurrenceBonus: DEFAULT_SCORING_CONFIG.recurrenceBonus,
    intentBonus: DEFAULT_SCORING_CONFIG.intentBonus,
    hotDays: DEFAULT_SCORING_CONFIG.hotDays,
    warmDays: DEFAULT_SCORING_CONFIG.warmDays,
  };
  for (const k of INTERACTION_TYPES) {
    const v = Number(pts[k]);
    if (Number.isFinite(v) && v >= 0) out.points[k] = v;
  }
  for (const k of ["recurrenceBonus", "intentBonus", "hotDays", "warmDays"] as const) {
    const v = Number(p[k]);
    if (Number.isFinite(v) && v >= 0 && (k.endsWith("Days") ? v > 0 : true)) out[k] = v;
  }
  return out;
}

export function temperatureFrom(
  lastInteractionAt: string | Date | null,
  now: number = Date.now(),
  hotDays: number = DEFAULT_SCORING_CONFIG.hotDays,
  warmDays: number = DEFAULT_SCORING_CONFIG.warmDays,
): Temperature {
  if (!lastInteractionAt) return "cold";
  const days = (now - new Date(lastInteractionAt).getTime()) / 86_400_000;
  if (!Number.isFinite(days)) return "cold"; // data inválida
  if (days <= hotDays) return "hot"; // inclui datas futuras (days < 0) = muito recente
  if (days <= warmDays) return "warm";
  return "cold";
}

export type LeadSignals = {
  counts: Partial<Record<InteractionType, number>>;
  distinctPosts?: number; // posts distintos engajados (recorrência)
  intentComments?: number; // comentários com intenção de compra
};

/**
 * Score = soma dos pontos por interação + bônus de recorrência e intenção.
 * Aberto (sem teto). Ex: "1 DM(5) + 1 coment(3) + intenção(3) + 2 posts(+2) = 13".
 */
export function leadScore(s: LeadSignals, config: ScoringConfig = DEFAULT_SCORING_CONFIG): number {
  let score = 0;
  for (const k of INTERACTION_TYPES) {
    score += (s.counts[k] || 0) * config.points[k];
  }
  if (s.distinctPosts && s.distinctPosts > 1) {
    score += (s.distinctPosts - 1) * config.recurrenceBonus;
  }
  if (s.intentComments) {
    score += s.intentComments * config.intentBonus;
  }
  return Math.max(0, Math.round(score));
}

/**
 * Pontos de um tipo de interação — usado no Histórico de Interações pra mostrar
 * o "+N pts" de cada evento. Mesma fonte de verdade do leadScore.
 */
export function interactionPoints(type: string, config: ScoringConfig = DEFAULT_SCORING_CONFIG): number {
  return (config.points as Record<string, number>)[type] ?? 0;
}
