import { describe, it, expect } from "vitest";
import { derivarOperacao, compararOperacao, type EntradaOperacao } from "./derivarOperacao";

// Ordem de grandeza real de uma semana de julho/2026 em produção.
const ENTRADA: EntradaOperacao = {
  semana: { inicio: "2026-07-13", fim: "2026-07-19", label: "13/07", parcial: false },
  carteira: { triagemOnboarding: 120000, ativo: 1023674, emCancelamento: 106874 },
  base: { mrr: 1150000, pontual: 1950000 },
  entregaPontual: 142800,
  // A soma de estoquePorProduto TEM que dar estoquePontual — a fixture respeita
  // a invariante que o último teste deste bloco verifica.
  estoquePontual: 1903200,
  estoquePorProduto: [
    { produto: "Creators", valor: 1024543, qtd: 140 },
    { produto: "Ecommerce", valor: 340500, qtd: 19 },
    { produto: "Performance", valor: 321928, qtd: 38 },
    { produto: "Sem produto", valor: 216229, qtd: 19 },
  ],
  churnMrr: { total: 38400, ajustado: 30000, abonado: 6900 },
  churnPontual: { total: 13700, ajustado: 11000, abonado: 2000 },
  churnPorMotivo: [
    { motivo: "Erro na Venda", mrr: 12400, pontual: 8000 },
    { motivo: "Inadimplente", mrr: 9800, pontual: 0 },
  ],
  headcountOperacao: 75,
  faturavelMes: 1380000,
};

describe("derivarOperacao", () => {
  it("repassa a identidade da semana", () => {
    expect(derivarOperacao(ENTRADA)).toMatchObject({
      inicio: "2026-07-13",
      fim: "2026-07-19",
      label: "13/07",
    });
  });

  it("MRR Ativo = triagem/onboarding + ativo; Operando soma em cancelamento", () => {
    const r = derivarOperacao(ENTRADA);
    expect(r.mrrAtivo).toBe(1143674);
    expect(r.mrrOperando).toBe(1250548);
  });

  it("Churn Líquido = Total − Abonado, em MRR e em pontual", () => {
    const r = derivarOperacao(ENTRADA);
    expect(r.churnMrrLiquido).toBe(31500);
    expect(r.churnPontualLiquido).toBe(11700);
  });

  it("tudo abonado zera o líquido, sem virar negativo", () => {
    const r = derivarOperacao({
      ...ENTRADA,
      churnMrr: { total: 38400, ajustado: 0, abonado: 38400 },
    });
    expect(r.churnMrrLiquido).toBe(0);
  });

  it("percentuais de churn usam a base de ABERTURA, não a carteira do fim", () => {
    const r = derivarOperacao(ENTRADA);
    // 31500 / 1150000 = 2,7391%  (e não sobre mrrAtivo = 1143674)
    expect(r.churnMrrLiquidoPct).toBeCloseTo(2.7391, 3);
    // 11700 / 1950000 = 0,6%
    expect(r.churnPontualLiquidoPct).toBeCloseTo(0.6, 3);
  });

  it("base zero não vira divisão por zero", () => {
    const r = derivarOperacao({ ...ENTRADA, base: { mrr: 0, pontual: 0 } });
    expect(r.churnMrrLiquidoPct).toBe(0);
    expect(r.churnPontualLiquidoPct).toBe(0);
  });

  it("MRR por cabeça divide o MRR Ativo pelo headcount de operação", () => {
    // 1143674 / 75
    expect(derivarOperacao(ENTRADA).mrrPorCabeca).toBeCloseTo(15248.99, 2);
  });

  it("Faturamento por cabeça usa o faturável do mês", () => {
    // 1380000 / 75
    expect(derivarOperacao(ENTRADA).faturamentoPorCabeca).toBe(18400);
  });

  it("headcount zero vira null, nunca Infinity", () => {
    const r = derivarOperacao({ ...ENTRADA, headcountOperacao: 0 });
    expect(r.mrrPorCabeca).toBeNull();
    expect(r.faturamentoPorCabeca).toBeNull();
  });

  it("faturável indisponível vira null, não zero", () => {
    // zero se leria como 'faturou nada no mês'
    const r = derivarOperacao({ ...ENTRADA, faturavelMes: null });
    expect(r.faturamentoPorCabeca).toBeNull();
    expect(r.mrrPorCabeca).not.toBeNull();
  });

  it("a soma do estoque por produto reproduz o estoque total", () => {
    const r = derivarOperacao(ENTRADA);
    const soma = r.estoquePorProduto.reduce((s, p) => s + p.valor, 0);
    expect(soma).toBe(r.estoquePontual);
  });
});

describe("compararOperacao", () => {
  const anterior = derivarOperacao({
    ...ENTRADA,
    semana: { inicio: "2026-07-06", fim: "2026-07-12", label: "06/07", parcial: false },
    estoquePontual: 1060750,
    estoquePorProduto: [
      { produto: "Creators", valor: 1000000, qtd: 138 },
      { produto: "Landing Page", valor: 60750, qtd: 11 },
    ],
    churnPorMotivo: [
      { motivo: "Inadimplente", mrr: 11400, pontual: 0 },
      { motivo: "Troca de Agência", mrr: 4500, pontual: 1200 },
    ],
  });
  const atual = derivarOperacao(ENTRADA);

  it("produto que existe só na semana atual aparece com anterior zerado", () => {
    const c = compararOperacao(atual, anterior);
    const eco = c.produtos.find((p) => p.chave === "Ecommerce");
    expect(eco).toMatchObject({ atual: 340500, anterior: 0 });
  });

  it("produto que existe só na semana anterior NÃO some da tabela", () => {
    // sumir esconderia justamente o estoque que foi zerado na semana
    const c = compararOperacao(atual, anterior);
    const lp = c.produtos.find((p) => p.chave === "Landing Page");
    expect(lp).toMatchObject({ atual: 0, anterior: 60750 });
  });

  it("produtos saem ordenados pelo valor atual, desc; os que só existem no anterior vão para o fim", () => {
    const c = compararOperacao(atual, anterior);
    expect(c.produtos.map((p) => p.chave)).toEqual([
      "Creators",
      "Ecommerce",
      "Performance",
      "Sem produto",
      "Landing Page",
    ]);
  });

  it("motivos pareiam MRR e pontual das duas semanas", () => {
    const c = compararOperacao(atual, anterior);
    expect(c.motivos.find((m) => m.chave === "Erro na Venda")).toMatchObject({
      atual: 12400,
      anterior: 0,
      pontualAtual: 8000,
      pontualAnterior: 0,
    });
    expect(c.motivos.find((m) => m.chave === "Inadimplente")).toMatchObject({
      atual: 9800,
      anterior: 11400,
    });
  });

  it("a soma dos motivos reproduz o churn total das duas semanas", () => {
    const c = compararOperacao(atual, anterior);
    const somaAtual = c.motivos.reduce((s, m) => s + m.atual, 0);
    const somaAnterior = c.motivos.reduce((s, m) => s + m.anterior, 0);
    expect(somaAtual).toBe(22200); // 12400 + 9800
    expect(somaAnterior).toBe(15900); // 11400 + 4500
  });
});
