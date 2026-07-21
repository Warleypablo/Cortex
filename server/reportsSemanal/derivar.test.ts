import { describe, it, expect } from "vitest";
import { derivarSemana, type EntradaSemana } from "./derivar";

// Números reais da semana 22/06–28/06 apurados em produção, usados como base
// para as variações abaixo.
const ENTRADA: EntradaSemana = {
  semana: { inicio: "2026-06-22", fim: "2026-06-28", label: "22/06", parcial: false },
  vendas: { novoMrr: 75724, novoPontual: 93994, crossMrr: 36747, crossPontual: 6875 },
  carteira: { triagemOnboarding: 120000, ativo: 1023674, emCancelamento: 106874 },
  baseMrr: 924086,
  basePontual: 2000000,
  entregaPontual: 50000,
  churnMrr: { total: 51023, ajustado: 32032 },
  churnPontual: { total: 16000, ajustado: 10000 },
};

describe("derivarSemana", () => {
  it("repassa a identidade da semana", () => {
    const r = derivarSemana(ENTRADA);
    expect(r).toMatchObject({ inicio: "2026-06-22", fim: "2026-06-28", label: "22/06", parcial: false });
  });

  it("MRR Ativo = triagem/onboarding + ativo", () => {
    expect(derivarSemana(ENTRADA).mrrAtivo).toBe(1143674);
  });

  it("MRR Operando = MRR Ativo + em cancelamento", () => {
    expect(derivarSemana(ENTRADA).mrrOperando).toBe(1250548);
  });

  it("crossTotal = crossMrr + crossPontual", () => {
    expect(derivarSemana(ENTRADA).crossTotal).toBe(43622);
  });

  it("Net Churn ajustado subtrai APENAS o cross de MRR", () => {
    // 32032 - 36747 = -4715 (expansão líquida na semana)
    expect(derivarSemana(ENTRADA).netChurnAjustado).toBe(-4715);
  });

  it("Net Churn bruto subtrai APENAS o cross de MRR", () => {
    // 51023 - 36747 = 14276
    expect(derivarSemana(ENTRADA).netChurnBruto).toBe(14276);
  });

  it("percentuais de MRR usam a base de abertura da semana", () => {
    const r = derivarSemana(ENTRADA);
    expect(r.churnMrrTotalPct).toBeCloseTo(5.5215, 3);
    expect(r.churnMrrAjustadoPct).toBeCloseTo(3.4664, 3);
  });

  it("percentuais de pontual usam a base pontual de abertura", () => {
    const r = derivarSemana(ENTRADA);
    expect(r.churnPontualTotalPct).toBeCloseTo(0.8, 3);
    expect(r.churnPontualAjustadoPct).toBeCloseTo(0.5, 3);
  });

  it("base de MRR zero não vira divisão por zero — percentuais saem 0", () => {
    const r = derivarSemana({ ...ENTRADA, baseMrr: 0 });
    expect(r.churnMrrTotalPct).toBe(0);
    expect(r.churnMrrAjustadoPct).toBe(0);
    expect(r.netChurnAjustadoPct).toBe(0);
    expect(r.netChurnBrutoPct).toBe(0);
  });

  it("base pontual zero não vira divisão por zero", () => {
    const r = derivarSemana({ ...ENTRADA, basePontual: 0 });
    expect(r.churnPontualTotalPct).toBe(0);
    expect(r.churnPontualAjustadoPct).toBe(0);
  });

  it("venda nova e cross-sell nunca se sobrepõem: a soma reproduz o total ganho", () => {
    const r = derivarSemana(ENTRADA);
    expect(r.mrrAdicionado + r.crossMrr).toBe(75724 + 36747);
    expect(r.pontualVendido + r.crossPontual).toBe(93994 + 6875);
  });

  it("erro na query de vendas vira vendasIndisponivel, para o zero não passar por 'sem vendas'", () => {
    const r = derivarSemana({
      ...ENTRADA,
      vendas: { novoMrr: 0, novoPontual: 0, crossMrr: 0, crossPontual: 0, erro: true },
    });
    expect(r.vendasIndisponivel).toBe(true);
    expect(r.mrrAdicionado).toBe(0);
  });

  it("sem erro na query, vendasIndisponivel é false mesmo com tudo zerado", () => {
    const r = derivarSemana({
      ...ENTRADA,
      vendas: { novoMrr: 0, novoPontual: 0, crossMrr: 0, crossPontual: 0 },
    });
    expect(r.vendasIndisponivel).toBe(false);
  });
});
