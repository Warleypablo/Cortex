import { describe, it, expect } from "vitest";
import { calcAtingimento, calcYtd, ultimoDiaDoMes } from "./bp2026.helpers";

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
