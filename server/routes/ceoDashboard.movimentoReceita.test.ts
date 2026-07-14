// server/routes/ceoDashboard.movimentoReceita.test.ts
import { describe, it, expect } from "vitest";
import { montarMovimentoReceita } from "./ceoDashboard.movimentoReceita";
import type { BpLinha } from "./ceoDashboard.helpers";

// Constrói uma BpLinha com meses 1..n a partir de pares [orcado, realizado].
function linha(metrica: string, pares: Array<[number, number | null]>): BpLinha {
  return {
    metrica,
    meses: pares.map(([orcado, realizado], i) => ({
      mes: i + 1, orcado, realizado,
      atingimento: realizado != null && orcado ? realizado / orcado : null,
    })),
  };
}

describe("montarMovimentoReceita", () => {
  const base = {
    vendasMrr: linha("vendas_mrr", [[100, 120], [100, 90]]),
    churnMes: linha("churn_mes", [[0, 10], [0, 20]]),          // positivo
    vendasPontual: linha("vendas_pontual", [[50, 60], [50, 40]]),
    pontualChurn: linha("pontual_churn", [[0, -5], [0, -8]]),   // negativo
    pontualEstoqueIni: linha("pontual_estoque_ini", [[0, 200], [0, 250]]),
    queries: {
      crossMrrPorMes: { 1: 4, 2: 6 },
      crossPontPorMes: { 1: 1, 2: 2 },
      mrrInicioPorMes: { 1: 1000, 2: 2000 },
    },
    mesNum: 2,
  };

  it("Churn % MRR = churn / mrr_início × 100", () => {
    const r = montarMovimentoReceita(base);
    // mês 1: 10 / 1000 × 100 = 1.0 ; mês 2: 20 / 2000 × 100 = 1.0
    expect(r.linhas.churnPct.meses[0].realizado).toBeCloseTo(1.0, 5);
    expect(r.linhas.churnPct.meses[1].realizado).toBeCloseTo(1.0, 5);
    expect(r.linhas.churnPct.unidade).toBe("pct");
  });

  it("Churn % Pontual = churn_pont_abs / estoque_ini × 100", () => {
    const r = montarMovimentoReceita(base);
    // mês 1: 5 / 200 × 100 = 2.5 ; mês 2: 8 / 250 × 100 = 3.2
    expect(r.linhas.churnPctPontual.meses[0].realizado).toBeCloseTo(2.5, 5);
    expect(r.linhas.churnPctPontual.meses[1].realizado).toBeCloseTo(3.2, 5);
  });

  it("base ausente/zero → Churn % null (não 0)", () => {
    const r = montarMovimentoReceita({
      ...base,
      queries: { ...base.queries, mrrInicioPorMes: { 1: 0 } },
    });
    expect(r.linhas.churnPct.meses[0].realizado).toBeNull();
  });

  it("NRR (erosão) = (churn − cross) / base × 100, coexiste com Churn %", () => {
    const r = montarMovimentoReceita(base);
    // mês 1: (10−4) / 1000 × 100 = 0.6 ; mês 2: (20−6) / 2000 × 100 = 0.7
    expect(r.linhas.nrr.meses[0].realizado).toBeCloseTo(0.6, 5);
    expect(r.linhas.nrr.meses[1].realizado).toBeCloseTo(0.7, 5);
    expect(r.linhas.nrr.unidade).toBe("pct");
    // Churn % continua existindo e correto (não removido).
    expect(r.linhas.churnPct.meses[0].realizado).toBeCloseTo(1.0, 5);
  });

  it("NRR Pontual = (churn_pont_abs − cross_pont) / estoque_ini × 100", () => {
    const r = montarMovimentoReceita(base);
    // mês 1: (5−1) / 200 × 100 = 2.0 ; mês 2: (8−2) / 250 × 100 = 2.4
    expect(r.linhas.nrrPontual.meses[0].realizado).toBeCloseTo(2.0, 5);
    expect(r.linhas.nrrPontual.meses[1].realizado).toBeCloseTo(2.4, 5);
    // Churn % Pontual continua existindo e correto (não removido).
    expect(r.linhas.churnPctPontual.meses[0].realizado).toBeCloseTo(2.5, 5);
  });

  it("churn pontual é normalizado para positivo", () => {
    const r = montarMovimentoReceita(base);
    expect(r.linhas.churnPontual.meses[0].realizado).toBe(5);
    expect(r.ingredientes.churnPontualPorMes[1]).toBe(5);
  });

  it("venda/churn MRR e venda pontual reusam a linha do BP (com meta)", () => {
    const r = montarMovimentoReceita(base);
    expect(r.linhas.vendaMrr.meses[0].realizado).toBe(120);
    expect(r.linhas.vendaMrr.meses[0].orcado).toBe(100);
    expect(r.linhas.churnMrr.meses[1].realizado).toBe(20);
    expect(r.linhas.vendaPontual.meses[0].orcado).toBe(50);
  });

  it("cross-sell entra como série sem meta (orcado 0, atingimento null)", () => {
    const r = montarMovimentoReceita(base);
    expect(r.linhas.crossMrr.meses[0].realizado).toBe(4);
    expect(r.linhas.crossMrr.meses[0].orcado).toBe(0);
    expect(r.linhas.crossMrr.meses[0].atingimento).toBeNull();
  });

  it("séries respeitam 1..mesNum", () => {
    const r = montarMovimentoReceita(base);
    expect(r.linhas.crossMrr.meses).toHaveLength(2);
    expect(r.linhas.churnPct.meses).toHaveLength(2);
  });
});
