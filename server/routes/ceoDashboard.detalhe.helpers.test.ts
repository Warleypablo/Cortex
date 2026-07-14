import { describe, it, expect } from "vitest";
import {
  achatarComponente, mapDetalheBpGrupos, bancosToGrupo, inadClientesToGrupos,
  enpsRespostasToGrupos, receitaCabecaGrupos, recebidoCategoriasToGrupo,
  serieEvolucao, KPI_COMPONENTES,
  ltvAuditoriaToGrupos, ultimoDiaAnterior, type LtvAuditoriaRow,
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

describe("receitaCabecaGrupos", () => {
  it("dois grupos só-valor (Receita recebida brl, Headcount num) + nota da fórmula", () => {
    const r = receitaCabecaGrupos(1525643, 112);
    expect(r.grupos.map((g) => g.formato)).toEqual(["brl", "num"]);
    expect(r.grupos[0].titulo).toContain("regime de caixa");
    expect(r.grupos[0].total).toBe(1525643);
    expect(r.grupos[1].total).toBe(112);
    expect(r.nota).toContain("Receita recebida");
    expect(r.nota).toContain("÷ 112");
  });
});

describe("recebidoCategoriasToGrupo", () => {
  it("um item por categoria, total = soma, e limpa o código contábil do nome", () => {
    const g = recebidoCategoriasToGrupo([
      { categoria: "03.01.01 Receita de Serviços", valor: 1_508_432 },
      { categoria: "04.01.02 Rendimento de Investimentos", valor: 6_776 },
    ]);
    expect(g.titulo).toContain("regime de caixa");
    expect(g.total).toBe(1_515_208);
    expect(g.itens[0].nome).toBe("Receita de Serviços");
    expect(g.itens[1].nome).toBe("Rendimento de Investimentos");
    expect(g.formato).toBe("brl");
  });
});

describe("serieEvolucao", () => {
  const linha = {
    meses: [
      { mes: 1, orcado: 100, realizado: 90 },
      { mes: 2, orcado: 100, realizado: 110 },
      { mes: 3, orcado: 100, realizado: null }, // mês futuro: descartado
    ],
  };
  it("mantém só meses com realizado e carrega o orçado em paralelo", () => {
    const s = serieEvolucao(linha);
    expect(s).toEqual([
      { mes: 1, realizado: 90, orcado: 100 },
      { mes: 2, realizado: 110, orcado: 100 },
    ]);
  });
  it("corta no mês fechado — exclui o mês corrente parcial", () => {
    const s = serieEvolucao({ meses: [
      { mes: 1, orcado: 100, realizado: 90 },
      { mes: 2, orcado: 100, realizado: 110 },
      { mes: 3, orcado: 100, realizado: 5 }, // mês corrente parcial: excluído
    ] }, 2);
    expect(s.map((p) => p.mes)).toEqual([1, 2]);
  });
  it("linha ausente → série vazia, sem quebrar", () => {
    expect(serieEvolucao(undefined)).toEqual([]);
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

describe("ltvAuditoriaToGrupos", () => {
  const row = (over: Partial<LtvAuditoriaRow>): LtvAuditoriaRow => ({
    nome: "Cliente", tem_match: true, valorr_snap: 5000, n_rec_snap: 1,
    inicio_rec: "2025-07-30", rec_full: 50000, rec_pre: 10000,
    pont_full: 0, pont_pre: 0, pago: 40000, n_parcelas: 8,
    ltv_fat: 50000, ltv_dfc: 50000, ...over,
  });

  it("N ímpar: mediana = valor central; grupos particionam todos os clientes", () => {
    const rows = [row({ nome: "A", ltv_fat: 30000 }), row({ nome: "B", ltv_fat: 20000 }), row({ nome: "C", ltv_fat: 10000 })];
    const r = ltvAuditoriaToGrupos(rows, "ltv_fat", 6);
    expect(r.mediana).toBe(20000);
    expect(r.grupos.map((g) => g.titulo)).toEqual(["Acima da mediana (1)", "Mediana", "Abaixo da mediana (1)"]);
    expect(r.grupos[1].itens[0].nome).toBe("B");
    expect(r.grupos[1].aberto).toBe(true);
    expect(r.grupos[0].aberto).toBe(false);
    expect(r.grupos[0].total).toBe(30000);
    const totalItens = r.grupos.reduce((s, g) => s + g.itens.length, 0);
    expect(totalItens).toBe(3); // todos os clientes aparecem, sem corte
  });

  it("N par: mediana = média dos 2 centrais; grupo Mediana tem os 2", () => {
    const rows = [row({ ltv_dfc: 40000 }), row({ ltv_dfc: 30000 }), row({ ltv_dfc: 20000 }), row({ ltv_dfc: 10000 })];
    const r = ltvAuditoriaToGrupos(rows, "ltv_dfc", 6);
    expect(r.mediana).toBe(25000);
    expect(r.grupos[1].itens).toHaveLength(2);
    expect(r.grupos[1].itens.map((i) => i.valor)).toEqual([30000, 20000]);
    expect(r.grupos[1].total).toBe(25000); // total do grupo Mediana = a própria mediana, não a soma dos 2
  });

  it("rows vazio: sem grupos, mediana/média/soma null", () => {
    expect(ltvAuditoriaToGrupos([], "ltv_fat", 6)).toEqual({ grupos: [], mediana: null, media: null, soma: null, nSemMatch: 0 });
  });

  it("média = soma ÷ n sobre os mesmos clientes; outlier separa média da mediana", () => {
    const rows = [row({ ltv_fat: 100000 }), row({ ltv_fat: 20000 }), row({ ltv_fat: 10000 })];
    const r = ltvAuditoriaToGrupos(rows, "ltv_fat", 6);
    expect(r.mediana).toBe(20000);
    expect(r.soma).toBe(130000); // numerador exposto p/ a conta aberta no drawer
    expect(r.media).toBe(43333); // 130000/3 — outlier puxa a média p/ cima
  });

  it("FAT: detalhe decompõe recorrente (single e multi contrato) e pontual", () => {
    const single = ltvAuditoriaToGrupos([row({ rec_full: 70300, ltv_fat: 73300, pont_full: 3000 })], "ltv_fat", 6);
    expect(single.grupos[0].itens[0].detalhe).toBe("recorrente R$ 70,3k (R$ 5.000/mês desde 30/07/25) + pontual entregue R$ 3,0k");
    const multi = ltvAuditoriaToGrupos([row({ n_rec_snap: 2, valorr_snap: 7200, pont_full: 0 })], "ltv_fat", 6);
    expect(multi.grupos[0].itens[0].detalhe).toBe("recorrente R$ 50,0k (2 contratos, R$ 7.200/mês)");
  });

  it("DFC: match com teórico+pago; nascido pós-corte só pago; pago zero; sem match → faturável", () => {
    const cheio = ltvAuditoriaToGrupos([row({ rec_pre: 28100, pont_pre: 0, pago: 35200, n_parcelas: 18 })], "ltv_dfc", 6);
    expect(cheio.grupos[0].itens[0].detalhe).toBe("teórico pré-out/25 R$ 28,1k + pago real R$ 35,2k (18 parcelas até 31/05)");
    const novo = ltvAuditoriaToGrupos([row({ rec_pre: 0, pont_pre: 0, pago: 14100, n_parcelas: 9 })], "ltv_dfc", 7);
    expect(novo.grupos[0].itens[0].detalhe).toBe("pago real R$ 14,1k (9 parcelas até 30/06)");
    const zero = ltvAuditoriaToGrupos([row({ rec_pre: 0, pont_pre: 0, pago: 0, n_parcelas: 0 })], "ltv_dfc", 6);
    expect(zero.grupos[0].itens[0].detalhe).toBe("sem pagamento registrado até 31/05");
    const sem = ltvAuditoriaToGrupos([row({ tem_match: false, rec_full: 30500, pont_full: 0 })], "ltv_dfc", 6);
    expect(sem.grupos[0].itens[0].detalhe).toBe("sem match CNPJ → régua faturável: recorrente R$ 30,5k");
    expect(sem.nSemMatch).toBe(1);
  });

  it("ultimoDiaAnterior cobre viradas de mês", () => {
    expect(ultimoDiaAnterior(1)).toBe("31/12");
    expect(ultimoDiaAnterior(3)).toBe("28/02");
    expect(ultimoDiaAnterior(7)).toBe("30/06");
  });
});
