import { describe, it, expect } from "vitest";
import { buildCrosssell, type CrosssellDealRow } from "./reportsTrimestral.crosssell";

// 852 = Creators Recorrente · 850 = Creators Pontual · 846 = Gestão de Performance (rec)
// 854 = CRM (pontual) · 868 = E-commerce (pontual)
const row = (o: Partial<CrosssellDealRow>): CrosssellDealRow => ({
  cx: "Deborah Guimaraes",
  valor_recorrente: 0,
  valor_pontual: 0,
  servicos_vendidos: null,
  ...o,
});

describe("buildCrosssell", () => {
  it("soma recorrente, pontual e total, e conta os deals", () => {
    const c = buildCrosssell([
      row({ valor_recorrente: "3000", servicos_vendidos: "[846]" }),
      row({ valor_pontual: "5500", servicos_vendidos: "[850]" }),
    ]);
    expect(c.totalDeals).toBe(2);
    expect(c.recorrente).toBe(3000);
    expect(c.pontual).toBe(5500);
    expect(c.total).toBe(8500);
  });

  it("ranqueia CX por total decrescente", () => {
    const c = buildCrosssell([
      row({ cx: "Lucas Antunes", valor_pontual: 63000 }),
      row({ cx: "Deborah Guimaraes", valor_recorrente: 83091, valor_pontual: 61500 }),
      row({ cx: "Rayane Ambrósio", valor_recorrente: 10400 }),
    ]);
    expect(c.porCx.map((r) => r.nome)).toEqual(["Deborah Guimaraes", "Lucas Antunes", "Rayane Ambrósio"]);
    expect(c.porCx[0].total).toBe(144591);
  });

  it("agrupa CX vazio ou nulo em 'Sem CX'", () => {
    const c = buildCrosssell([row({ cx: null, valor_pontual: 100 }), row({ cx: "  ", valor_pontual: 50 })]);
    expect(c.porCx).toHaveLength(1);
    expect(c.porCx[0]).toMatchObject({ nome: "Sem CX", deals: 2, total: 150 });
  });

  it("mapeia servicos_vendidos para o segmento canônico", () => {
    const c = buildCrosssell([row({ valor_recorrente: 3000, servicos_vendidos: "[846]" })]);
    expect(c.porProduto[0]).toMatchObject({ nome: "Performance", recorrente: 3000, deals: 1 });
  });

  it("divide o valor igualmente entre segmentos da MESMA natureza", () => {
    // dois recorrentes distintos: Performance (846) e Social (848)
    const c = buildCrosssell([row({ valor_recorrente: 3000, servicos_vendidos: "[846, 848]" })]);
    const perf = c.porProduto.find((p) => p.nome === "Performance")!;
    const social = c.porProduto.find((p) => p.nome === "Social")!;
    expect(perf.recorrente).toBe(1500);
    expect(social.recorrente).toBe(1500);
  });

  it("não mistura naturezas: recorrente vai só para segmento recorrente, pontual só para pontual", () => {
    // 852 = Creators Recorrente, 854 = CRM pontual
    const c = buildCrosssell([row({ valor_recorrente: 1000, valor_pontual: 400, servicos_vendidos: "[852, 854]" })]);
    const creators = c.porProduto.find((p) => p.nome === "Creators")!;
    const crm = c.porProduto.find((p) => p.nome === "CRM")!;
    expect(creators).toMatchObject({ recorrente: 1000, pontual: 0 });
    expect(crm).toMatchObject({ recorrente: 0, pontual: 400 });
  });

  it("joga deal sem serviço mapeado em Others, em vez de sumir com o valor", () => {
    const c = buildCrosssell([
      row({ valor_recorrente: 700, servicos_vendidos: "False" }),
      row({ valor_pontual: 300, servicos_vendidos: null }),
    ]);
    const others = c.porProduto.find((p) => p.nome === "Others")!;
    expect(others).toMatchObject({ recorrente: 700, pontual: 300, total: 1000 });
  });

  it("a soma dos produtos fecha com o total do bloco — nenhum centavo se perde", () => {
    const rows = [
      row({ valor_recorrente: 3000, servicos_vendidos: "[846, 848]" }),
      row({ valor_pontual: 5500, servicos_vendidos: "[850]" }),
      row({ valor_recorrente: 1000, valor_pontual: 400, servicos_vendidos: "[852, 854]" }),
      row({ valor_pontual: 999, servicos_vendidos: "[]" }),
    ];
    const c = buildCrosssell(rows);
    const somaProdutos = c.porProduto.reduce((a, p) => a + p.total, 0);
    expect(somaProdutos).toBeCloseTo(c.total, 6);
    const somaCx = c.porCx.reduce((a, p) => a + p.total, 0);
    expect(somaCx).toBeCloseTo(c.total, 6);
  });

  it("conta o deal uma vez por produto tocado, sem inflar totalDeals", () => {
    const c = buildCrosssell([row({ valor_recorrente: 1000, valor_pontual: 400, servicos_vendidos: "[852, 854]" })]);
    expect(c.totalDeals).toBe(1);
    expect(c.porProduto.find((p) => p.nome === "Creators")!.deals).toBe(1);
    expect(c.porProduto.find((p) => p.nome === "CRM")!.deals).toBe(1);
  });

  it("aguenta trimestre sem cross-sell", () => {
    const c = buildCrosssell([]);
    expect(c).toMatchObject({ totalDeals: 0, total: 0, porCx: [], porProduto: [] });
  });
});
