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

describe("aggregateTrend — trilha do pontual", () => {
  const w = buildQuarterWindow("2026-Q2", new Date(2026, 6, 8));
  const vendasP = vendas.map((v, i) => ({ ...v, vendasPontual: (i + 1) * 10 }));
  const mrrChurnP = mrrChurn.map((m, i) => ({ ...m, pontual: (i + 1) * 100, pontualContratos: i + 1 }));
  const estoque = { "2026-Q1": 1779093, "2026-Q2": 2090519 };

  it("receita pontual, contratos e vendas pontuais SOMAM os meses do tri", () => {
    const { series } = aggregateTrend(vendasP, mrrChurnP, w, {}, estoque);
    const q2 = series.find((s) => s.q === "2026-Q2")!;
    expect(q2.pontual).toBe(1500);          // 400+500+600
    expect(q2.pontualContratos).toBe(15);   // 4+5+6
    expect(q2.vendasPontual).toBe(150);     // 40+50+60
  });

  it("estoque é FOTO do fim do tri (vem do mapa, não soma meses)", () => {
    const { series, qoq } = aggregateTrend(vendasP, mrrChurnP, w, {}, estoque);
    expect(series.find((s) => s.q === "2026-Q2")!.estoquePontual).toBe(2090519);
    expect(qoq.pontualEstoque.atual).toBe(2090519);
    expect(qoq.pontualEstoque.anterior).toBe(1779093);
  });

  it("trimestre sem snapshot fica com estoquePontual null (não zero)", () => {
    const { series } = aggregateTrend(vendasP, mrrChurnP, w, {}, { "2026-Q2": 2090519 });
    expect(series.find((s) => s.q === "2026-Q1")!.estoquePontual).toBeNull();
  });

  it("estoque crescendo é RUIM (betterDirection down); receita e vendas, bom", () => {
    const { qoq } = aggregateTrend(vendasP, mrrChurnP, w, {}, estoque);
    expect(qoq.pontualEstoque.betterDirection).toBe("down");
    expect(qoq.pontualReceita.betterDirection).toBe("up");
    expect(qoq.pontualVendas.betterDirection).toBe("up");
  });

  it("mês sem snapshot (mrr 0) soma churn/pontual mas NÃO zera a foto do MRR", () => {
    // Espelha o Q4 2025 real: out/2025 sem snapshot, nov e dez com. A receita pontual
    // do tri tem de incluir outubro; o MRR do tri é a foto de dezembro.
    const meses = [
      { month: "2025-10", mrr: 0, churnBrl: 5, pontual: 170408, pontualContratos: 30 },
      { month: "2025-11", mrr: 900, churnBrl: 7, pontual: 200000, pontualContratos: 40 },
      { month: "2025-12", mrr: 950, churnBrl: 9, pontual: 240015, pontualContratos: 42 },
    ];
    const w4 = buildQuarterWindow("2025-Q4", new Date(2026, 0, 5));
    const { series } = aggregateTrend([], meses, w4);
    const q4 = series.find((s) => s.q === "2025-Q4")!;
    expect(q4.mrr).toBe(950);            // foto de dez, não 0 de out
    expect(q4.pontual).toBe(610423);     // out + nov + dez
    expect(q4.pontualContratos).toBe(112);
    expect(q4.churn).toBe(21);           // out entra no churn também
  });

  it("mês final sem snapshot não derruba o trimestre da série", () => {
    const meses = [
      { month: "2026-04", mrr: 1000, churnBrl: 0, pontual: 10 },
      { month: "2026-05", mrr: 1100, churnBrl: 0, pontual: 20 },
      { month: "2026-06", mrr: 0, churnBrl: 0, pontual: 30 }, // sem snapshot
    ];
    const { series } = aggregateTrend([], meses, w);
    const q2 = series.find((s) => s.q === "2026-Q2");
    expect(q2).toBeDefined();      // não foi filtrado por mrr > 0
    expect(q2!.mrr).toBe(1100);    // foto de maio
    expect(q2!.pontual).toBe(60);  // junho ainda soma no pontual
  });
});
