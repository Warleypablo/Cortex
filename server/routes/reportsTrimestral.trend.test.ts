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

  it("metaMrr é null quando nenhuma meta é passada", () => {
    expect(series.every((s) => s.metaMrr === null)).toBe(true);
  });
});

describe("aggregateTrend — meta de MRR", () => {
  const w = buildQuarterWindow("2026-Q2", new Date(2026, 6, 8));

  it("usa a meta do MÊS DA FOTO (último mês do tri), não a soma nem a média", () => {
    const metas = { "2026-01": 10, "2026-02": 20, "2026-03": 1368637, "2026-06": 1688510 };
    const { series } = aggregateTrend(vendas, mrrChurn, w, metas);
    expect(series.find((s) => s.q === "2026-Q1")!.metaMrr).toBe(1368637); // meta de mar
    expect(series.find((s) => s.q === "2026-Q2")!.metaMrr).toBe(1688510); // meta de jun
  });

  it("trimestre sem meta no BP fica com metaMrr null (não zero)", () => {
    // Só Q2 tem meta: o Q1 não deve virar 0, senão a linha do gráfico despenca.
    const { series } = aggregateTrend(vendas, mrrChurn, w, { "2026-06": 1688510 });
    expect(series.find((s) => s.q === "2026-Q1")!.metaMrr).toBeNull();
    expect(series.find((s) => s.q === "2026-Q2")!.metaMrr).toBe(1688510);
  });
});
