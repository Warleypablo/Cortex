/**
 * CRM Instagram — lógica pura de temperatura e lead scoring.
 *
 * Funções puras (sem I/O) pra serem testáveis e reusáveis entre server e client.
 * `now` é injetável pra testes determinísticos.
 */

export type Temperature = "hot" | "warm" | "cold";

export function temperatureFrom(
  lastInteractionAt: string | Date | null,
  now: number = Date.now(),
): Temperature {
  if (!lastInteractionAt) return "cold";
  const days = (now - new Date(lastInteractionAt).getTime()) / 86_400_000;
  if (!Number.isFinite(days)) return "cold"; // data inválida
  if (days <= 15) return "hot"; // inclui datas futuras (days < 0) = muito recente
  if (days <= 30) return "warm";
  return "cold";
}

export type LeadSignals = {
  dmCount: number;
  commentCount: number;
  lastInteractionAt: string | Date | null;
  followersCount?: number | null;
  subcategory?: string | null; // creator_ugc | job_candidate | competitor | poor_fit
};

/**
 * Score 0–100 de qualificação. Pesos (ajustáveis):
 * - DM (intenção ativa): +40
 * - Comentários: +8 cada, teto 30 (DM pesa mais que comentário)
 * - Insistência (>1 interação): +4 por interação extra, teto 16
 * - Recência: 🔥 +20 · 🌡 +10 · ❄️ 0
 * - Alcance (seguidores, log): teto +12
 * - Descarte: competitor/poor_fit zeram; job_candidate corta pela metade
 */
export function leadScore(s: LeadSignals, now: number = Date.now()): number {
  if (s.subcategory === "competitor" || s.subcategory === "poor_fit") return 0;

  let score = 0;
  if (s.dmCount > 0) score += 40;
  score += Math.min(s.commentCount * 8, 30);

  const total = s.dmCount + s.commentCount;
  if (total > 1) score += Math.min((total - 1) * 4, 16);

  const t = temperatureFrom(s.lastInteractionAt, now);
  score += t === "hot" ? 20 : t === "warm" ? 10 : 0;

  if (s.followersCount && s.followersCount > 0) {
    score += Math.min(Math.floor(Math.log10(s.followersCount) * 3), 12);
  }

  if (s.subcategory === "job_candidate") score = Math.round(score * 0.5);

  return Math.max(0, Math.min(100, Math.round(score)));
}
