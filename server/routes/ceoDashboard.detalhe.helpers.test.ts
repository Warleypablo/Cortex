import { describe, it, expect } from "vitest";
import {
  achatarComponente, mapDetalheBpGrupos, bancosToGrupo, inadClientesToGrupos,
  enpsRespostasToGrupos, ltvRowsToGrupos, receitaCabecaGrupos, KPI_COMPONENTES,
} from "./ceoDashboard.detalhe.helpers";
import type { DetalheBpResult } from "./bp2026.detalhe";

const det = (over: Partial<DetalheBpResult> = {}): DetalheBpResult => ({
  metrica: "cac", mes: 6, titulo: "CAC", orcado: 100, realizado: 80,
  grupos: [
    { titulo: "Vendas", total: 50, itens: [{ nome: "A", detalhe: "", data: null, valor: 30 }, { nome: "B", detalhe: "", data: null, valor: 20 }] },
    { titulo: "Ads", total: 30, itens: [{ nome: "C", detalhe: "", data: null, valor: 30 }] },
  ],
  ...over,
});

describe("achatarComponente", () => {
  it("junta todos os itens num grupo só, total = realizado, com sinal/formato", () => {
    const g = achatarComponente(det(), { titulo: "CAC", sinal: "-", formato: "brl" });
    expect(g.titulo).toBe("CAC");
    expect(g.total).toBe(80);           // realizado
    expect(g.sinal).toBe("-");
    expect(g.formato).toBe("brl");
    expect(g.itens.map((i) => i.nome).sort()).toEqual(["A", "B", "C"]); // achatado
  });
  it("total cai para soma dos grupos quando realizado é null", () => {
    const g = achatarComponente(det({ realizado: null }), { formato: "brl" });
    expect(g.total).toBe(80); // 50 + 30
  });
});

describe("mapDetalheBpGrupos", () => {
  it("preserva os grupos do BP, aplicando formato/sinal", () => {
    const gs = mapDetalheBpGrupos(det(), { formato: "num" });
    expect(gs.map((g) => g.titulo)).toEqual(["Vendas", "Ads"]);
    expect(gs.every((g) => g.formato === "num")).toBe(true);
  });
});

describe("bancosToGrupo", () => {
  it("um grupo com uma linha por conta, total = soma", () => {
    const g = bancosToGrupo([
      { nmbanco: "Itaú", empresa: "Partners", balance: 100 },
      { nmbanco: "BB", empresa: "Filial", balance: 50 },
    ]);
    expect(g.total).toBe(150);
    expect(g.formato).toBe("brl");
    expect(g.itens[0].nome).toContain("Itaú");
  });
});

describe("inadClientesToGrupos", () => {
  it("um grupo de clientes, item por cliente", () => {
    const gs = inadClientesToGrupos([
      { idCliente: "1", nomeCliente: "Cliente X", valorTotal: 500, quantidadeParcelas: 2 },
    ]);
    expect(gs[0].itens[0].nome).toBe("Cliente X");
    expect(gs[0].itens[0].valor).toBe(500);
    expect(gs[0].formato).toBe("brl");
  });
});

describe("enpsRespostasToGrupos", () => {
  it("classifica em Promotores(>=9)/Neutros(7-8)/Detratores(<=6), formato num", () => {
    const gs = enpsRespostasToGrupos([
      { area: "Growth", scoreEmpresa: 10, comentarioEmpresa: "ótimo" },
      { area: "Ops", scoreEmpresa: 7, comentarioEmpresa: null },
      { area: "CX", scoreEmpresa: 3, comentarioEmpresa: "ruim" },
      { area: null, scoreEmpresa: null, comentarioEmpresa: null }, // ignorado
    ]);
    expect(gs.map((g) => g.titulo)).toEqual(["Promotores", "Neutros", "Detratores"]);
    expect(gs.every((g) => g.formato === "num")).toBe(true);
    expect(gs[0].itens[0].detalhe).toContain("nota 10");
  });
});

describe("ltvRowsToGrupos", () => {
  it("um grupo de clientes por LTV, formato brl", () => {
    const gs = ltvRowsToGrupos([{ nome: "Cliente Y", ltv_total: 28000 }]);
    expect(gs[0].itens[0].valor).toBe(28000);
    expect(gs[0].formato).toBe("brl");
  });
});

describe("receitaCabecaGrupos", () => {
  it("dois grupos só-valor (Receita brl, Headcount num) + nota da fórmula", () => {
    const r = receitaCabecaGrupos(1938555, 140);
    expect(r.grupos.map((g) => g.formato)).toEqual(["brl", "num"]);
    expect(r.grupos[1].total).toBe(140);
    expect(r.nota).toContain("÷ 140");
  });
});

describe("KPI_COMPONENTES", () => {
  it("custos tem 9 componentes, receita 4", () => {
    expect(KPI_COMPONENTES.custos).toHaveLength(9);
    expect(KPI_COMPONENTES.receita).toHaveLength(4);
  });
  it("todos os componentes de custos têm sinal '-'; receita inclui inadimplencia com sinal '-'", () => {
    expect(KPI_COMPONENTES.custos.every((c) => c.sinal === "-")).toBe(true);
    const inad = KPI_COMPONENTES.receita.find((c) => c.slug === "inadimplencia");
    expect(inad?.sinal).toBe("-");
  });
});
