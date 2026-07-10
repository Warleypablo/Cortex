import { describe, it, expect } from "vitest";
import { churnMensalPonderadoPct } from "./reportsTrimestral.churn";

describe("churnMensalPonderadoPct", () => {
  it("Pulse Q2/2026: Σ churn total 149.362 / Σ bases mensais 507.592 = 29,4% /mês", () => {
    // Bases mensais (MRR no início de abr/mai/jun): 175.292 + 168.169 + 164.131
    const somaBases = 175292 + 168169 + 164131; // 507.592
    // Churn total do tri (abr+mai+jun): 42.436 + 34.456 + 72.470
    const churnTotal = 42436 + 34456 + 72470; // 149.362
    expect(churnMensalPonderadoPct(churnTotal, somaBases)).toBe(29.4);
  });

  it("Pulse Q2/2026 s/ abonados: 116.031 / 507.592 = 22,9% /mês", () => {
    const somaBases = 175292 + 168169 + 164131;
    const churnSemAbon = 30086 + 29466 + 56479; // 116.031
    expect(churnMensalPonderadoPct(churnSemAbon, somaBases)).toBe(22.9);
  });

  it("se cada mês teve a MESMA taxa, a média ponderada é essa taxa (10/10/10 → 10)", () => {
    // Três meses com 10% sobre bases diferentes → 10% no trimestre.
    const bases = [100_000, 200_000, 300_000];
    const churn = bases.map((b) => b * 0.1);
    const somaBases = bases.reduce((a, b) => a + b, 0);
    const somaChurn = churn.reduce((a, b) => a + b, 0);
    expect(churnMensalPonderadoPct(somaChurn, somaBases)).toBe(10);
  });

  it("NRR: numerador negativo (expansão > churn) devolve taxa negativa", () => {
    // churn s/ abonados 30k, expansão 50k → nrrBrl = −20k sobre base 400k = −5%
    expect(churnMensalPonderadoPct(-20000, 400000)).toBe(-5);
  });

  it("base ≤ 0 devolve 0 (sem base não há taxa)", () => {
    expect(churnMensalPonderadoPct(10000, 0)).toBe(0);
    expect(churnMensalPonderadoPct(10000, -1)).toBe(0);
  });

  it("arredonda a 1 casa decimal", () => {
    // 12.345 / 100.000 = 12,345% → 12,3
    expect(churnMensalPonderadoPct(12345, 100000)).toBe(12.3);
  });
});
