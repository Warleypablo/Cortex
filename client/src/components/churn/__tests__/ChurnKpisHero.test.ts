import { describe, it, expect } from "vitest";
import { pctEvitavel } from "../ChurnKpisHero";

describe("pctEvitavel", () => {
  it("retorna a fração de churn marcado como evitável", () => {
    const contratos = [
      { tipo: "churn", is_abonado: false, evitabilidade_churn: "Evitável" },
      { tipo: "churn", is_abonado: false, evitabilidade_churn: "Inevitável" },
      { tipo: "churn", is_abonado: false, evitabilidade_churn: "Evitável" },
    ] as any;
    expect(pctEvitavel(contratos)).toBeCloseTo(66.67, 1);
  });
  it("retorna 0 para lista vazia", () => {
    expect(pctEvitavel([])).toBe(0);
  });
});
