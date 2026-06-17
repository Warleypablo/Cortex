import { describe, it, expect } from "vitest";
import { distribuirDeal, aovMedioPorSegmento } from "./bp2026.vendasProduto.helpers";

const noPr = new Map<number, Map<any, number>>();
const noMix = new Map<string, Map<any, number>>();
const aovVazio = {} as Record<string, number>;

describe("distribuirDeal", () => {
  it("produto único: valor inteiro vai para o segmento", () => {
    const r = distribuirDeal(
      { id: 1, cnpjNorm: "X", mes: 6, valorRec: 2997, valorPont: 0, ids: [846] },
      noPr, noMix, noMix, aovVazio, aovVazio
    );
    expect(r).toEqual([{ segmento: "Performance", natureza: "recorrente", valor: 2997, contrato: 1 }]);
  });

  it("multi-produto com mix do ClickUp cobrindo todos os segmentos: usa proporção, total = deal (Badbeat)", () => {
    const mixRec = new Map([["BAD", new Map<any, number>([["Performance", 2801], ["Social", 2501], ["Creators", 5498]])]]);
    const r = distribuirDeal(
      { id: 2, cnpjNorm: "BAD", mes: 5, valorRec: 10800, valorPont: 0, ids: [846, 848, 852] },
      noPr, mixRec, noMix, aovVazio, aovVazio
    );
    const total = r.reduce((s, x) => s + x.valor, 0);
    expect(Math.round(total)).toBe(10800);
    const perf = r.find((x) => x.segmento === "Performance")!;
    expect(Math.round(perf.valor)).toBe(2801);
  });

  it("product rows do Bitrix têm prioridade sobre o mix do ClickUp (Repeat)", () => {
    const prMix = new Map([[27418, new Map<any, number>([["Performance", 6000], ["Creators", 8000]])]]);
    // ClickUp com proporção bem diferente — NÃO deve ser usado quando há product rows
    const mixRec = new Map([["RPT", new Map<any, number>([["Performance", 9000], ["Creators", 1000]])]]);
    const r = distribuirDeal(
      { id: 27418, cnpjNorm: "RPT", mes: 1, valorRec: 14000, valorPont: 0, ids: [846, 852] },
      prMix, mixRec, noMix, {}, {}
    );
    expect(Math.round(r.find((x) => x.segmento === "Performance")!.valor)).toBe(6000);
    expect(Math.round(r.find((x) => x.segmento === "Creators")!.valor)).toBe(8000);
  });

  it("mix parcial (ClickUp não cobre todos os segmentos) -> fallback AOV no deal todo (Flico)", () => {
    const mixRec = new Map([["FLI", new Map<any, number>([["Social", 2734]])]]);
    const aovRec = { Performance: 4000, Social: 2000, Creators: 6000 };
    const r = distribuirDeal(
      { id: 3, cnpjNorm: "FLI", mes: 5, valorRec: 11500, valorPont: 0, ids: [846, 848, 852] },
      noPr, mixRec, noMix, aovRec, {}
    );
    const total = r.reduce((s, x) => s + x.valor, 0);
    expect(Math.round(total)).toBe(11500);
    expect(Math.round(r.find((x) => x.segmento === "Creators")!.valor)).toBe(5750);
  });

  it("rec e pont no mesmo deal: cada natureza usa seu valor (Clube45-like)", () => {
    const r = distribuirDeal(
      { id: 4, cnpjNorm: "Y", mes: 5, valorRec: 6000, valorPont: 7000, ids: [846, 868] },
      noPr, noMix, noMix, aovVazio, aovVazio
    );
    expect(r.find((x) => x.segmento === "Performance")!.valor).toBe(6000);
    expect(r.find((x) => x.segmento === "E-commerce")!.valor).toBe(7000);
  });

  it("conta 1 contrato por segmento distinto da natureza", () => {
    const r = distribuirDeal(
      { id: 5, cnpjNorm: "Z", mes: 5, valorRec: 6000, valorPont: 0, ids: [846, 848] },
      noPr, new Map([["Z", new Map<any, number>([["Performance", 1], ["Social", 1]])]]), noMix, {}, {}
    );
    expect(r.filter((x) => x.contrato === 1).length).toBe(2);
  });
});

describe("aovMedioPorSegmento", () => {
  it("média do valor recorrente dos deals de segmento recorrente único", () => {
    const deals = [
      { id: 1, cnpjNorm: "", mes: 1, valorRec: 3000, valorPont: 0, ids: [846] },
      { id: 2, cnpjNorm: "", mes: 1, valorRec: 5000, valorPont: 0, ids: [846] },
      { id: 3, cnpjNorm: "", mes: 1, valorRec: 9999, valorPont: 0, ids: [846, 848] },
    ];
    expect(aovMedioPorSegmento(deals, "recorrente").Performance).toBe(4000);
  });
});

// ===== Task 2: agregarVendasProdutoClickup + contratosDoSegmento =====
import {
  agregarVendasProdutoClickup, contratosDoSegmento,
  type VendaProdutoRow, type TotalMesRow, type ContratoRow,
} from "./bp2026.vendasProduto.helpers";

describe("agregarVendasProdutoClickup", () => {
  it("soma MRR/Pontual e contratos por segmento e reconcilia os totais", () => {
    const prod: VendaProdutoRow[] = [
      { mes: 1, produto: "Performance", mrr: 1000, pont: 0, contratosMrr: 2, contratosPont: 0 },
      { mes: 1, produto: "Creators", mrr: 0, pont: 500, contratosMrr: 0, contratosPont: 3 },
    ];
    const tot: TotalMesRow[] = [{ mes: 1, clientes: 4 }];
    const { agg, totais } = agregarVendasProdutoClickup(prod, tot);
    expect(agg.get(1)!.get("Performance")).toEqual({ mrr: 1000, pont: 0, contratosRec: 2, contratosPont: 0 });
    expect(agg.get(1)!.get("Creators")!.pont).toBe(500);
    expect(totais.get(1)).toEqual({ mrr: 1000, pont: 500, contratos: 5, clientes: 4 });
  });

  it("reatribui a Others a parcela cujo segmento não existe no bloco da natureza", () => {
    // E-commerce é segmento pontual; MRR de Ecommerce cai em Others (bloco recorrente)
    const prod: VendaProdutoRow[] = [
      { mes: 2, produto: "Ecommerce", mrr: 300, pont: 800, contratosMrr: 1, contratosPont: 4 },
    ];
    const { agg, totais } = agregarVendasProdutoClickup(prod, []);
    expect(agg.get(2)!.get("Others")!.mrr).toBe(300);
    expect(agg.get(2)!.get("E-commerce")!.pont).toBe(800);
    expect(agg.get(2)!.get("E-commerce")?.mrr ?? 0).toBe(0);
    expect(totais.get(2)!.mrr).toBe(300);
    expect(totais.get(2)!.pont).toBe(800);
  });

  it("conta um contrato com MRR e Pontual nos dois blocos", () => {
    const prod: VendaProdutoRow[] = [
      { mes: 3, produto: "Creators", mrr: 100, pont: 200, contratosMrr: 1, contratosPont: 1 },
    ];
    const { agg } = agregarVendasProdutoClickup(prod, []);
    expect(agg.get(3)!.get("Creators")).toEqual({ mrr: 100, pont: 200, contratosRec: 1, contratosPont: 1 });
  });

  it("totais.contratos = soma dos contratos por natureza (deriva dos blocos, não de totalRows)", () => {
    const prod: VendaProdutoRow[] = [
      { mes: 5, produto: "Creators", mrr: 100, pont: 200, contratosMrr: 1, contratosPont: 1 }, // dual: conta 2
      { mes: 5, produto: "Performance", mrr: 50, pont: 0, contratosMrr: 1, contratosPont: 0 },  // 1
    ];
    const { totais } = agregarVendasProdutoClickup(prod, [{ mes: 5, clientes: 9 }]);
    expect(totais.get(5)!.contratos).toBe(3); // 1+1 (Creators) + 1 (Performance)
    expect(totais.get(5)!.clientes).toBe(9);  // vem de totalRows
  });
});

describe("contratosDoSegmento", () => {
  const rows: ContratoRow[] = [
    { cliente: "A", produto: "Performance", servico: "x", status: "ativo", valorr: 100, valorp: 0, data: null },
    { cliente: "B", produto: "Ecommerce", servico: "y", status: "ativo", valorr: 50, valorp: 900, data: null },
    { cliente: "C", produto: "Performance", servico: "z", status: "ativo", valorr: 0, valorp: 0, data: null },
  ];
  it("filtra por natureza e reatribui Others", () => {
    expect(contratosDoSegmento(rows, "recorrente", "Performance").map((r) => r.cliente)).toEqual(["A"]);
    // MRR de Ecommerce reatribuído a Others
    expect(contratosDoSegmento(rows, "recorrente", "Others").map((r) => r.cliente)).toEqual(["B"]);
    // Pontual de Ecommerce fica em E-commerce
    expect(contratosDoSegmento(rows, "pontual", "E-commerce").map((r) => r.cliente)).toEqual(["B"]);
  });
  it("ignora contratos sem valor na natureza", () => {
    expect(contratosDoSegmento(rows, "recorrente", "Performance").map((r) => r.cliente)).not.toContain("C");
  });
});
