import { describe, it, expect } from "vitest";
import { participacaoPct, razaoYtd } from "./bp2026.cac.helpers";

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
