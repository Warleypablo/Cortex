import { describe, it, expect } from "vitest";
import { temperatureFrom, leadScore } from "./crmInstagramScoring";

const NOW = new Date("2026-06-08T12:00:00Z").getTime();
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

describe("temperatureFrom", () => {
  it("null → cold", () => {
    expect(temperatureFrom(null, NOW)).toBe("cold");
  });
  it("≤15 dias → hot", () => {
    expect(temperatureFrom(daysAgo(0), NOW)).toBe("hot");
    expect(temperatureFrom(daysAgo(15), NOW)).toBe("hot");
  });
  it("16–30 dias → warm", () => {
    expect(temperatureFrom(daysAgo(16), NOW)).toBe("warm");
    expect(temperatureFrom(daysAgo(30), NOW)).toBe("warm");
  });
  it(">30 dias → cold", () => {
    expect(temperatureFrom(daysAgo(31), NOW)).toBe("cold");
  });
});

describe("leadScore", () => {
  it("descarte (competitor/poor_fit) zera", () => {
    expect(leadScore({ dmCount: 5, commentCount: 5, lastInteractionAt: daysAgo(0), subcategory: "competitor" }, NOW)).toBe(0);
    expect(leadScore({ dmCount: 5, commentCount: 5, lastInteractionAt: daysAgo(0), subcategory: "poor_fit" }, NOW)).toBe(0);
  });

  it("DM quente pontua mais que comentário único frio", () => {
    const dm = leadScore({ dmCount: 1, commentCount: 0, lastInteractionAt: daysAgo(1) }, NOW);
    const comment = leadScore({ dmCount: 0, commentCount: 1, lastInteractionAt: daysAgo(40) }, NOW);
    expect(dm).toBeGreaterThan(comment);
  });

  it("recência aumenta o score (mesmos sinais)", () => {
    const hot = leadScore({ dmCount: 1, commentCount: 0, lastInteractionAt: daysAgo(2) }, NOW);
    const cold = leadScore({ dmCount: 1, commentCount: 0, lastInteractionAt: daysAgo(60) }, NOW);
    expect(hot).toBeGreaterThan(cold);
  });

  it("mais interações (insistência) aumenta o score", () => {
    const few = leadScore({ dmCount: 1, commentCount: 1, lastInteractionAt: daysAgo(1) }, NOW);
    const many = leadScore({ dmCount: 1, commentCount: 6, lastInteractionAt: daysAgo(1) }, NOW);
    expect(many).toBeGreaterThan(few);
  });

  it("job_candidate corta o score pela metade", () => {
    const base = leadScore({ dmCount: 1, commentCount: 0, lastInteractionAt: daysAgo(1) }, NOW);
    const cand = leadScore({ dmCount: 1, commentCount: 0, lastInteractionAt: daysAgo(1), subcategory: "job_candidate" }, NOW);
    expect(cand).toBe(Math.round(base * 0.5));
  });

  it("score fica sempre entre 0 e 100", () => {
    const max = leadScore({ dmCount: 9, commentCount: 9, lastInteractionAt: daysAgo(0), followersCount: 5_000_000 }, NOW);
    expect(max).toBeLessThanOrEqual(100);
    expect(max).toBeGreaterThanOrEqual(0);
    const min = leadScore({ dmCount: 0, commentCount: 0, lastInteractionAt: null }, NOW);
    expect(min).toBeGreaterThanOrEqual(0);
  });
});
