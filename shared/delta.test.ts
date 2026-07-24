import { describe, it, expect } from "vitest";
import { calcularDelta } from "./delta";

describe("calcularDelta", () => {
  it("moeda: variação relativa em %", () => {
    expect(calcularDelta(150, 100)).toBe(50);
    expect(calcularDelta(50, 100)).toBe(-50);
  });

  it("percentual: diferença em pontos percentuais, sem divisão", () => {
    // churn de 2% para 3% é '+1 p.p.', não '+50%' — que se lê como o churn
    // tendo subido pela metade.
    expect(calcularDelta(3, 2, true)).toBe(1);
    expect(calcularDelta(2, 3, true)).toBe(-1);
  });

  it("percentual com anterior zero continua definido", () => {
    expect(calcularDelta(3, 0, true)).toBe(3);
  });

  it("moeda com anterior zero é indefinido, não Infinity", () => {
    expect(calcularDelta(100, 0)).toBeNull();
  });

  it("anterior negativo usa módulo na base, preservando o sinal da variação", () => {
    // de -100 para -50 é melhora de 50%, não piora
    expect(calcularDelta(-50, -100)).toBe(50);
  });

  it("null em qualquer ponta é null", () => {
    expect(calcularDelta(null, 100)).toBeNull();
    expect(calcularDelta(100, null)).toBeNull();
    expect(calcularDelta(null, null)).toBeNull();
  });

  it("sem variação é zero, não null", () => {
    expect(calcularDelta(100, 100)).toBe(0);
    expect(calcularDelta(0, 0, true)).toBe(0);
  });
});
