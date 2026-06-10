import { describe, it, expect } from "vitest";
import { calcAtingimento, calcYtd, ultimoDiaDoMes, subtrairMeses, ratear } from "./bp2026.helpers";

describe("calcAtingimento", () => {
  it("calcula razão realizado/orçado", () => {
    expect(calcAtingimento(1156850, 1119046)).toBeCloseTo(0.9673, 3);
  });
  it("retorna null sem realizado", () => {
    expect(calcAtingimento(1156850, null)).toBeNull();
  });
  it("retorna null com orçado zero (sem divisão por zero)", () => {
    expect(calcAtingimento(0, 100)).toBeNull();
  });
});

describe("calcYtd", () => {
  const meses = [
    { mes: 1, orcado: 100, realizado: 90 },
    { mes: 2, orcado: 110, realizado: 120 },
    { mes: 3, orcado: 120, realizado: null },
  ];
  it("soma fluxo até o mês selecionado, ignorando meses sem realizado no realizado", () => {
    expect(calcYtd(meses, 2, "fluxo")).toEqual({ orcado: 210, realizado: 210 });
    expect(calcYtd(meses, 3, "fluxo")).toEqual({ orcado: 330, realizado: 210 });
  });
  it("estoque usa o valor do mês selecionado (ou último com dado)", () => {
    expect(calcYtd(meses, 2, "estoque")).toEqual({ orcado: 110, realizado: 120 });
    expect(calcYtd(meses, 3, "estoque")).toEqual({ orcado: 120, realizado: 120 });
  });
});

describe("ultimoDiaDoMes", () => {
  it("calcula último dia, inclusive fevereiro", () => {
    expect(ultimoDiaDoMes(2026, 2)).toBe("2026-02-28");
    expect(ultimoDiaDoMes(2026, 12)).toBe("2026-12-31");
  });
});

describe("subtrairMeses", () => {
  const base = [
    { mes: 1, orcado: 1000, realizado: 900 },
    { mes: 2, orcado: 1100, realizado: 1200 },
    { mes: 3, orcado: 1200, realizado: null },
  ];
  const ded1 = [
    { mes: 1, orcado: 100, realizado: 50 },
    { mes: 2, orcado: 110, realizado: null },
    { mes: 3, orcado: 120, realizado: null },
  ];
  const ded2 = [
    { mes: 1, orcado: 200, realizado: 150 },
    { mes: 2, orcado: 210, realizado: 200 },
    { mes: 3, orcado: 220, realizado: null },
  ];

  it("subtrai orçado e realizado mês a mês", () => {
    const r = subtrairMeses(base, [ded1, ded2]);
    expect(r[0]).toEqual({ mes: 1, orcado: 700, realizado: 700 });
  });

  it("propaga null: qualquer componente sem realizado zera o realizado derivado", () => {
    const r = subtrairMeses(base, [ded1, ded2]);
    expect(r[1]).toEqual({ mes: 2, orcado: 780, realizado: null });
    expect(r[2]).toEqual({ mes: 3, orcado: 860, realizado: null });
  });
});

describe("ratear", () => {
  it("aplica a fração numerador/denominador ao valor", () => {
    expect(ratear(48678, 29200, 44000)).toBeCloseTo(32304.49, 1);
  });
  it("retorna null para valor null", () => {
    expect(ratear(null, 29200, 44000)).toBeNull();
  });
  it("retorna null com denominador zero (não mascara seed quebrado)", () => {
    expect(ratear(48678, 29200, 0)).toBeNull();
  });
});
