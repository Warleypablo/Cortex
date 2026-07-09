import { describe, it, expect } from "vitest";
import { aggregateTrend } from "./reportsTrimestral";
import { buildQuarterWindow } from "./reportsTrimestral.window";

// vendasPorMes: { month: "YYYY-MM"; vendasMrr: number }[]
// mrrChurnPorMes: { month: "YYYY-MM"; mrr: number; churnBrl: number }[]
const vendas = [
  { month: "2026-01", vendasMrr: 100 }, { month: "2026-02", vendasMrr: 110 }, { month: "2026-03", vendasMrr: 90 },
  { month: "2026-04", vendasMrr: 120 }, { month: "2026-05", vendasMrr: 130 }, { month: "2026-06", vendasMrr: 100 },
];
const mrrChurn = [
  { month: "2026-01", mrr: 1000, churnBrl: 30 }, { month: "2026-02", mrr: 1050, churnBrl: 20 }, { month: "2026-03", mrr: 1100, churnBrl: 25 },
  { month: "2026-04", mrr: 1150, churnBrl: 40 }, { month: "2026-05", mrr: 1200, churnBrl: 10 }, { month: "2026-06", mrr: 1300, churnBrl: 15 },
];

describe("aggregateTrend", () => {
  const w = buildQuarterWindow("2026-Q2", new Date(2026, 6, 8));
  const { series, qoq } = aggregateTrend(vendas, mrrChurn, w);

  it("vendas e churn somam os meses; mrr é a foto do ultimo mes do tri", () => {
    const q2 = series.find((s) => s.q === "2026-Q2")!;
    expect(q2.vendas).toBe(350);   // 120+130+100
    expect(q2.churn).toBe(65);     // 40+10+15
    expect(q2.mrr).toBe(1300);     // MRR de jun (fim do Q2)
  });

  it("qoq compara Q2 vs Q1", () => {
    expect(qoq.vendas.atual).toBe(350);
    expect(qoq.vendas.anterior).toBe(300);  // 100+110+90
    expect(qoq.churn.atual).toBe(65);
    expect(qoq.churn.anterior).toBe(75);    // 30+20+25
    expect(qoq.mrr.atual).toBe(1300);
    expect(qoq.mrr.anterior).toBe(1100);    // MRR de mar (fim do Q1)
    expect(qoq.churn.betterDirection).toBe("down");
    expect(qoq.mrr.betterDirection).toBe("up");
  });
});
