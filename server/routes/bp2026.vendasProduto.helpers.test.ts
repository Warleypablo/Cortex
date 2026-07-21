import { describe, it, expect } from "vitest";
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
    { idSubtask: "86a", idTask: "t1", cliente: "A", produto: "Performance", servico: "x", status: "ativo", valorr: 100, valorp: 0, data: null },
    { idSubtask: "86b", idTask: "t2", cliente: "B", produto: "Ecommerce", servico: "y", status: "ativo", valorr: 50, valorp: 900, data: null },
    { idSubtask: "86c", idTask: "t3", cliente: "C", produto: "Performance", servico: "z", status: "ativo", valorr: 0, valorp: 0, data: null },
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
