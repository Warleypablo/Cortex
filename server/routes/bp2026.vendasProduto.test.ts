// server/routes/bp2026.vendasProduto.test.ts
import { describe, it, expect } from "vitest";
import { montarVendasProduto, montarItensVendaProduto } from "./bp2026.vendasProduto";
import type { CelulaSeg, ContratoRow } from "./bp2026.vendasProduto.helpers";
import type { SegmentoBP } from "../okr2026/servicosBitrix";

function mkAgg(mes: number, seg: SegmentoBP, c: CelulaSeg) {
  return new Map([[mes, new Map<SegmentoBP, CelulaSeg>([[seg, c]])]]);
}

describe("montarVendasProduto", () => {
  const totais = new Map([[1, { mrr: 1000, pont: 500, contratos: 5, clientes: 4 }]]);
  const orcado = {
    vendas_mrr: { 1: 800 }, vendas_pontual: { 1: 400 },
    contratos_vendidos_mrr_performance: { 1: 3 }, contratos_vendidos_pontual_ecommerce: { 1: 2 },
  } as Record<string, Record<number, number>>;
  const agg = mkAgg(1, "Performance", { mrr: 1000, pont: 0, contratosRec: 2, contratosPont: 0 });

  it("monta o bloco Visão Geral com Receita Total = MRR+Pontual e orçado combinado", () => {
    const linhas = montarVendasProduto({ agg, totais, orcado, mesCorrente: 1, mesFechado: 0 });
    const total = linhas.find((l) => l.metrica === "vp_receita_total")!;
    expect(total.grupo).toBe("Visão Geral");
    expect(total.meses[0].realizado).toBe(1500);   // 1000 + 500
    expect(total.meses[0].orcado).toBe(1200);       // 800 + 400
    expect(total.semDetalhe).toBe(true);
    expect(total.destaque).toBe(true);
  });

  it("Nº de Clientes é realizado-only (orçado 0)", () => {
    const linhas = montarVendasProduto({ agg, totais, orcado, mesCorrente: 1, mesFechado: 0 });
    const cli = linhas.find((l) => l.metrica === "vp_num_clientes")!;
    expect(cli.meses[0].realizado).toBe(4);
    expect(cli.meses[0].orcado).toBe(0);
    expect(cli.unidade).toBe("int");
    expect(cli.semDetalhe).toBe(true);
  });

  it("Nº de Contratos soma os contratos_vendidos_* como orçado", () => {
    const linhas = montarVendasProduto({ agg, totais, orcado, mesCorrente: 1, mesFechado: 0 });
    const ctr = linhas.find((l) => l.metrica === "vp_num_contratos")!;
    expect(ctr.meses[0].realizado).toBe(5);
    expect(ctr.meses[0].orcado).toBe(5);            // 3 (mrr_performance) + 2 (pontual_ecommerce)
  });

  it("gera as linhas por segmento com as chaves de métrica preservadas", () => {
    const linhas = montarVendasProduto({ agg, totais, orcado, mesCorrente: 1, mesFechado: 0 });
    const mrrPerf = linhas.find((l) => l.metrica === "vendas_mrr_performance")!;
    expect(mrrPerf.grupo).toBe("Recorrente");
    expect(mrrPerf.segmento).toBe("Performance");
    expect(mrrPerf.meses[0].realizado).toBe(1000);
    expect(linhas.some((l) => l.metrica === "aov_venda_mrr_performance")).toBe(true);
    expect(linhas.some((l) => l.metrica === "contratos_vendidos_mrr_performance")).toBe(true);
    // não há mais linha-total in-bloco "Total MRR"
    expect(linhas.some((l) => l.metrica === "vendas_mrr" && !l.segmento)).toBe(false);
  });
});

describe("montarItensVendaProduto", () => {
  const rows: ContratoRow[] = [
    { cliente: "Alpha", produto: "Performance", servico: "Gestão", status: "ativo", valorr: 300, valorp: 0, data: "2026-01-10" },
    { cliente: "Beta", produto: "Performance", servico: "Gestão", status: "cancelado/inativo", valorr: 200, valorp: 0, data: "2026-01-20" },
  ];
  it("modo valor: total = soma dos valores da natureza, ordenado desc", () => {
    const { itens, total } = montarItensVendaProduto(rows, "recorrente", "Performance", "valor");
    expect(total).toBe(500);
    expect(itens.map((i) => i.nome)).toEqual(["Alpha", "Beta"]);
    expect(itens[0].valor).toBe(300);
    expect(itens[0].grupo).toBe("Contratos");
  });
  it("modo contrato: total = contagem", () => {
    const { total } = montarItensVendaProduto(rows, "recorrente", "Performance", "contrato");
    expect(total).toBe(2);
  });
});
