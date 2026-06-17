import { describe, it, expect } from "vitest";
import { ratearSeriePorPeso, participacaoPct, razaoYtd } from "./bp2026.cac.helpers";

describe("ratearSeriePorPeso", () => {
  it("rateia proporcional aos pesos e soma fecha com o total", () => {
    const r = ratearSeriePorPeso([300000, null], { a: [30, null], b: [10, null] });
    expect(r.a).toEqual([225000, null]);
    expect(r.b).toEqual([75000, null]);
    expect((r.a[0] as number) + (r.b[0] as number)).toBe(300000);
  });

  it("peso 0 num produto => alocação 0 (os demais absorvem o total)", () => {
    const r = ratearSeriePorPeso([100], { a: [0], b: [10] });
    expect(r.a).toEqual([0]);
    expect(r.b).toEqual([100]);
  });

  it("soma dos pesos = 0 no mês => null para todos", () => {
    const r = ratearSeriePorPeso([100], { a: [0], b: [0] });
    expect(r.a).toEqual([null]);
    expect(r.b).toEqual([null]);
  });

  it("total null no mês => null para todos", () => {
    const r = ratearSeriePorPeso([null], { a: [5], b: [5] });
    expect(r.a).toEqual([null]);
    expect(r.b).toEqual([null]);
  });
});

describe("participacaoPct", () => {
  it("razão parte/total por mês, null quando indefinido", () => {
    expect(participacaoPct([50, null, 10], [200, 100, null])).toEqual([0.25, null, null]);
  });
  it("denominador 0 => null", () => {
    expect(participacaoPct([5], [0])).toEqual([null]);
  });
});

describe("razaoYtd", () => {
  it("Σnum / Σden até mesFechado", () => {
    expect(razaoYtd([10, 20, 30], [100, 200, 300], 2)).toBeCloseTo(0.1, 6); // 30/300
  });
  it("ignora meses null no numerador e denominador", () => {
    expect(razaoYtd([10, null, 30], [100, null, 300], 3)).toBeCloseTo(0.1, 6); // 40/400
  });
  it("Σden = 0 => null", () => {
    expect(razaoYtd([0], [0], 1)).toBeNull();
  });
  it("mesFechado 0 => null", () => {
    expect(razaoYtd([10], [100], 0)).toBeNull();
  });
});
