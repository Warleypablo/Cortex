import { describe, it, expect } from "vitest";
import {
  temperatureFrom, leadScore, interactionPoints, normalizeScoringConfig,
  DEFAULT_SCORING_CONFIG, type ScoringConfig,
} from "./crmInstagramScoring";

const NOW = new Date("2026-06-08T12:00:00Z").getTime();
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

describe("temperatureFrom", () => {
  it("classifica por dias sem interação (15/30 default)", () => {
    expect(temperatureFrom(daysAgo(2), NOW)).toBe("hot");
    expect(temperatureFrom(daysAgo(20), NOW)).toBe("warm");
    expect(temperatureFrom(daysAgo(60), NOW)).toBe("cold");
    expect(temperatureFrom(null, NOW)).toBe("cold");
  });

  it("respeita limites customizados", () => {
    expect(temperatureFrom(daysAgo(5), NOW, 3, 10)).toBe("warm");
    expect(temperatureFrom(daysAgo(2), NOW, 3, 10)).toBe("hot");
  });
});

describe("leadScore (aditivo)", () => {
  it("soma os pontos por interação (defaults: dm5 coment3 like1 follow1)", () => {
    expect(leadScore({ counts: { spontaneous_dm: 1 } })).toBe(5);
    expect(leadScore({ counts: { comment: 2 } })).toBe(6);
    expect(leadScore({ counts: { like: 3 } })).toBe(3);
    expect(leadScore({ counts: { follow: 1 } })).toBe(1);
    expect(leadScore({ counts: { spontaneous_dm: 1, comment: 1, like: 3, follow: 1 } })).toBe(12);
  });

  it("lead sem interações = 0", () => {
    expect(leadScore({ counts: {} })).toBe(0);
  });

  it("usa pesos do config customizado", () => {
    const cfg: ScoringConfig = {
      points: { spontaneous_dm: 10, comment: 1, like: 0, like_ad: 5, follow: 2 },
      recurrenceBonus: 0, hotDays: 7, warmDays: 14,
    };
    expect(leadScore({ counts: { spontaneous_dm: 2, comment: 5, like: 9, like_ad: 1, follow: 1 } }, cfg)).toBe(20 + 5 + 0 + 5 + 2);
  });

  it("bônus de recorrência: por post distinto além do 1º", () => {
    // 2 comentários(6) + 3 posts distintos → +2 bônus por post extra (×2) = 6 + 4 = 10
    expect(leadScore({ counts: { comment: 2 }, distinctPosts: 3 })).toBe(6 + 4);
    // 1 post distinto → sem bônus
    expect(leadScore({ counts: { comment: 1 }, distinctPosts: 1 })).toBe(3);
  });

});

describe("interactionPoints", () => {
  it("retorna o peso do tipo; desconhecido = 0", () => {
    expect(interactionPoints("spontaneous_dm")).toBe(5);
    expect(interactionPoints("comment")).toBe(3);
    expect(interactionPoints("like")).toBe(1);
    expect(interactionPoints("follow")).toBe(1);
    expect(interactionPoints("save")).toBe(0);
    expect(interactionPoints("")).toBe(0);
  });
});

describe("normalizeScoringConfig", () => {
  it("mescla parcial com defaults e descarta lixo", () => {
    const c = normalizeScoringConfig({ points: { comment: 9, like: -3, save: 99 }, hotDays: 7, warmDays: "x" });
    expect(c.points.comment).toBe(9);
    expect(c.points.like).toBe(DEFAULT_SCORING_CONFIG.points.like); // negativo ignorado
    expect(c.points.spontaneous_dm).toBe(DEFAULT_SCORING_CONFIG.points.spontaneous_dm);
    expect(c.hotDays).toBe(7);
    expect(c.warmDays).toBe(DEFAULT_SCORING_CONFIG.warmDays); // inválido → default
    expect((c.points as any).save).toBeUndefined();
  });

  it("entrada vazia/inválida = defaults", () => {
    expect(normalizeScoringConfig(null)).toEqual(DEFAULT_SCORING_CONFIG);
    expect(normalizeScoringConfig("nope")).toEqual(DEFAULT_SCORING_CONFIG);
  });
});
