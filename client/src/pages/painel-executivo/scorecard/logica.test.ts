import { describe, it, expect } from "vitest";
import { calcStatus, deltaM1, formatValor } from "./logica";

describe("calcStatus", () => {
  it("direction up: atual >= meta → good", () => {
    expect(calcStatus(100, 100, "up")).toBe("good");
  });

  it("direction up: atual < 90% da meta → bad", () => {
    expect(calcStatus(85, 100, "up")).toBe("bad");
  });

  it("direction up: atual entre 90% e 100% da meta → warn", () => {
    expect(calcStatus(95, 100, "up")).toBe("warn");
  });

  it("direction down: atual muito acima da meta (churn) → bad", () => {
    expect(calcStatus(200, 96, "down")).toBe("bad");
  });

  it("direction down: atual <= meta → good", () => {
    expect(calcStatus(80, 96, "down")).toBe("good");
  });

  it("direction down: atual até 110% da meta → warn", () => {
    expect(calcStatus(100, 96, "down")).toBe("warn");
  });

  it("sem meta (null) → null", () => {
    expect(calcStatus(100, null, "up")).toBeNull();
  });

  it("sem meta (undefined) → null", () => {
    expect(calcStatus(100, undefined, "up")).toBeNull();
  });

  it("atual null → null", () => {
    expect(calcStatus(null, 100, "up")).toBeNull();
  });
});

describe("deltaM1", () => {
  it("compara os 2 últimos pontos válidos (alta)", () => {
    expect(deltaM1([{ valor: 100 }, { valor: 110 }])).toEqual({ pct: 10, dir: "up" });
  });

  it("compara os 2 últimos pontos válidos (queda)", () => {
    expect(deltaM1([{ valor: 100 }, { valor: 90 }])).toEqual({ pct: -10, dir: "down" });
  });

  it("variação pequena (<0.05%) → flat", () => {
    const r = deltaM1([{ valor: 1000 }, { valor: 1000.2 }]);
    expect(r?.dir).toBe("flat");
    expect(r?.pct).toBeCloseTo(0.02, 5);
  });

  it("ignora pontos null no fim, usa os 2 últimos válidos", () => {
    expect(deltaM1([{ valor: 100 }, { valor: 120 }, { valor: null }])).toEqual({ pct: 20, dir: "up" });
  });

  it("base 0 → flat (evita divisão por zero)", () => {
    expect(deltaM1([{ valor: 0 }, { valor: 50 }])).toEqual({ pct: 0, dir: "flat" });
  });

  it("menos de 2 pontos válidos → null", () => {
    expect(deltaM1([{ valor: 100 }])).toBeNull();
  });

  it("array vazio → null", () => {
    expect(deltaM1([])).toBeNull();
  });

  it("undefined → null", () => {
    expect(deltaM1(undefined)).toBeNull();
  });
});

describe("formatValor", () => {
  it("brl", () => {
    expect(formatValor(1234, "brl")).toBe("R$ 1.234");
  });

  it("pct", () => {
    expect(formatValor(12.5, "pct")).toBe("12.5%");
  });

  it("int", () => {
    expect(formatValor(1234, "int")).toBe("1.234");
  });

  it("meses", () => {
    expect(formatValor(8.4, "meses")).toBe("8.4 meses");
  });

  it("null → travessão", () => {
    expect(formatValor(null, "brl")).toBe("—");
  });

  it("undefined → travessão", () => {
    expect(formatValor(undefined, "pct")).toBe("—");
  });
});
