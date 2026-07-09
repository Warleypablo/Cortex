import { describe, it, expect } from "vitest";
import {
  bpLinhaToKpi,
  momFromSerie,
  simpleKpi,
  emBreveKpi,
  assembleCeoKpis,
  canAccessCeo,
  receitaCabecaCaixaLinha,
  receitaCabecaCaixaFromBp,
  receitaRecebidaLinha,
  geracaoCaixaFromBp,
  type BpLinha,
} from "./ceoDashboard.helpers";

const linhaReceita: BpLinha = {
  metrica: "receita_total",
  direcao: "maior_melhor",
  unidade: "brl",
  meses: [
    { mes: 1, orcado: 100, realizado: 90, atingimento: 0.9 },
    { mes: 2, orcado: 100, realizado: 110, atingimento: 1.1 },
    { mes: 3, orcado: 100, realizado: null, atingimento: null },
  ],
};

describe("bpLinhaToKpi", () => {
  it("seleciona o mês pedido e copia orcado/realizado/atingimento do BP", () => {
    const kpi = bpLinhaToKpi(linhaReceita, {
      key: "receita", label: "Receita", mesNum: 2, direcao: "maior_melhor", unidade: "brl",
    });
    expect(kpi.valor).toBe(110);
    expect(kpi.meta).toBe(100);
    expect(kpi.atingimentoPct).toBe(110);
    expect(kpi.status).toBe("ok");
    expect(kpi.direcao).toBe("maior_melhor");
  });

  it("monta a sparkline com os realizados até o mês pedido (ignora null)", () => {
    const kpi = bpLinhaToKpi(linhaReceita, {
      key: "receita", label: "Receita", mesNum: 3, direcao: "maior_melhor", unidade: "brl",
    });
    expect(kpi.sparkline).toEqual([90, 110]);
    expect(kpi.valor).toBeNull(); // mês 3 sem realizado
  });

  it("linha inexistente vira KPI vazio, sem quebrar", () => {
    const kpi = bpLinhaToKpi(undefined, {
      key: "x", label: "X", mesNum: 1, direcao: "maior_melhor", unidade: "brl",
    });
    expect(kpi.valor).toBeNull();
    expect(kpi.sparkline).toBeNull();
  });
});

describe("momFromSerie", () => {
  it("calcula variação % do último vs o anterior", () => {
    expect(momFromSerie([100, 110])).toBe(10);
    expect(momFromSerie([100, 90])).toBe(-10);
  });
  it("retorna null com menos de 2 pontos ou base zero", () => {
    expect(momFromSerie([100])).toBeNull();
    expect(momFromSerie(null)).toBeNull();
    expect(momFromSerie([0, 5])).toBeNull();
  });
});

describe("simpleKpi", () => {
  it("nunca tem meta/atingimento e calcula MoM da série", () => {
    const kpi = simpleKpi({
      key: "inadimplencia", label: "Inadimplência Total", valor: 50,
      unidade: "brl", direcao: "menor_melhor", serie: [40, 50],
    });
    expect(kpi.meta).toBeNull();
    expect(kpi.atingimentoPct).toBeNull();
    expect(kpi.mom).toBe(25);
    expect(kpi.status).toBe("sem_meta");
  });
});

describe("emBreveKpi", () => {
  it("marca status em_breve com valor null", () => {
    const kpi = emBreveKpi({ key: "nps", label: "NPS Clientes", unidade: "score" });
    expect(kpi.status).toBe("em_breve");
    expect(kpi.valor).toBeNull();
  });
});

describe("assembleCeoKpis", () => {
  it("devolve 11 KPIs na ordem fixa da grade", () => {
    const kpis = assembleCeoKpis({
      bpLinhas: [{ metrica: "ebitda", direcao: "maior_melhor", unidade: "brl", meses: [{ mes: 1, orcado: 10, realizado: 8, atingimento: 0.8 }] },
                 { metrica: "cac", direcao: "menor_melhor", unidade: "brl", meses: [{ mes: 1, orcado: 5, realizado: 4, atingimento: 0.8 }] }],
      bpMetricas: [
        { metrica: "receita_total", direcao: "maior_melhor", unidade: "brl", meses: [{ mes: 1, orcado: 100, realizado: 90, atingimento: 0.9 }] },
        { metrica: "despesa_total", direcao: "menor_melhor", unidade: "brl", meses: [{ mes: 1, orcado: 80, realizado: 70, atingimento: 0.87 }] },
        { metrica: "saldo_caixa", direcao: "maior_melhor", unidade: "brl", meses: [{ mes: 1, orcado: 50, realizado: 60, atingimento: 1.2 }] },
        { metrica: "colaboradores", direcao: "menor_melhor", unidade: "int", meses: [{ mes: 1, orcado: 140, realizado: 142, atingimento: 1.01 }] },
        { metrica: "receita_cabeca", direcao: "maior_melhor", unidade: "brl", meses: [{ mes: 1, orcado: 12, realizado: 13, atingimento: 1.08 }] },
      ],
      mesNum: 1,
      inadimplencia: { total: 20, serie: [18, 20] },
      ltvMedioCliente: 28000,
      enpsScore: 48,
      receitaRecebida: { metrica: "receita_total", direcao: "maior_melhor", unidade: "brl", meses: [{ mes: 1, orcado: 100, realizado: 95, atingimento: 0.95 }] },
      receitaCabecaCaixa: { metrica: "receita_cabeca", direcao: "maior_melhor", unidade: "brl", meses: [{ mes: 1, orcado: 12, realizado: 13.6, atingimento: 1.13 }] },
    });
    expect(kpis.map((k) => k.key)).toEqual([
      "receita", "custos", "lucro", "caixa",
      "inadimplencia", "nps", "cac", "ltv",
      "headcount", "enps", "receita_cabeca",
    ]);
    // BP com meta
    expect(kpis.find((k) => k.key === "custos")!.meta).toBe(80);
    // fonte própria sem meta
    expect(kpis.find((k) => k.key === "ltv")!.meta).toBeNull();
    expect(kpis.find((k) => k.key === "ltv")!.valor).toBe(28000);
    expect(kpis.find((k) => k.key === "nps")!.status).toBe("em_breve");
    // Receita vem da linha em regime de caixa (recebido), não da receita_total por competência
    expect(kpis.find((k) => k.key === "receita")!.valor).toBe(95);
    expect(kpis.find((k) => k.key === "receita")!.meta).toBe(100);
    // Receita/Cabeça vem da linha em regime de caixa (não da linha do BP)
    expect(kpis.find((k) => k.key === "receita_cabeca")!.valor).toBe(13.6);
    expect(kpis.find((k) => k.key === "receita_cabeca")!.meta).toBe(12);
  });
});

describe("receitaRecebidaLinha", () => {
  const original: BpLinha = {
    metrica: "receita_total", direcao: "maior_melhor", unidade: "brl",
    meses: [
      { mes: 1, orcado: 1_332_560, realizado: 1_409_050, atingimento: 1.05 }, // competência (ignorado)
      { mes: 2, orcado: 1_500_000, realizado: null, atingimento: null },
    ],
  };
  it("substitui o realizado pelo recebido e recalcula o atingimento; meta preservada", () => {
    const linha = receitaRecebidaLinha(original, { 1: 1_525_643 });
    const m1 = linha.meses.find((m) => m.mes === 1)!;
    expect(m1.realizado).toBe(1_525_643);
    expect(m1.orcado).toBe(1_332_560);
    expect(m1.atingimento).toBeCloseTo(1_525_643 / 1_332_560, 6);
  });
  it("mês sem recebido → realizado null", () => {
    const linha = receitaRecebidaLinha(original, { 1: 1_525_643 });
    expect(linha.meses.find((m) => m.mes === 2)!.realizado).toBeNull();
  });
});

describe("receitaCabecaCaixaLinha", () => {
  const original: BpLinha = {
    metrica: "receita_cabeca", direcao: "maior_melhor", unidade: "brl",
    meses: [
      { mes: 1, orcado: 14000, realizado: 13797, atingimento: 0.985 }, // realizado antigo (competência)
      { mes: 2, orcado: 14000, realizado: null, atingimento: null },   // mês futuro
    ],
  };
  const colaboradores: BpLinha = {
    metrica: "colaboradores", direcao: "menor_melhor", unidade: "int",
    meses: [
      { mes: 1, orcado: 110, realizado: 112, atingimento: 1.01 },
      { mes: 2, orcado: 110, realizado: null, atingimento: null },
    ],
  };

  it("usa o recebido ÷ headcount como realizado e preserva a meta do BP", () => {
    const linha = receitaCabecaCaixaLinha(original, colaboradores, { 1: 1_525_643 });
    const m1 = linha.meses.find((m) => m.mes === 1)!;
    expect(m1.orcado).toBe(14000); // meta herdada, intacta
    expect(m1.realizado).toBeCloseTo(1_525_643 / 112, 4); // ~13622,7
    expect(m1.atingimento).toBeCloseTo(1_525_643 / 112 / 14000, 6);
  });

  it("mês sem recebido (ou headcount 0/ausente) → realizado null", () => {
    const linha = receitaCabecaCaixaLinha(original, colaboradores, { 1: 1_525_643 });
    expect(linha.meses.find((m) => m.mes === 2)!.realizado).toBeNull(); // sem recebido no mês 2
    const semHead = receitaCabecaCaixaLinha(original, { ...colaboradores, meses: [{ mes: 1, orcado: 0, realizado: 0, atingimento: null }] }, { 1: 1000 });
    expect(semHead.meses.find((m) => m.mes === 1)!.realizado).toBeNull(); // headcount 0
  });

  it("linha original ausente → sem meses, não quebra", () => {
    const linha = receitaCabecaCaixaLinha(undefined, colaboradores, { 1: 1000 });
    expect(linha.metrica).toBe("receita_cabeca");
    expect(linha.meses).toEqual([]);
  });

  it("receitaCabecaCaixaFromBp extrai as linhas certas do payload do BP", () => {
    const linha = receitaCabecaCaixaFromBp({
      metricasGerais: [original, colaboradores],
      receitaRecebidaCaixaPorMes: { 1: 1_525_643 },
    });
    expect(linha.meses.find((m) => m.mes === 1)!.realizado).toBeCloseTo(1_525_643 / 112, 4);
  });
});

describe("canAccessCeo", () => {
  it("libera admin", () => {
    expect(canAccessCeo({ role: "admin" })).toBe(true);
  });
  it("libera quem tem /ceo-dashboard em allowedRoutes", () => {
    expect(canAccessCeo({ role: "user", allowedRoutes: ["/ceo-dashboard"] })).toBe(true);
  });
  it("bloqueia os demais", () => {
    expect(canAccessCeo({ role: "user", allowedRoutes: ["/outra"] })).toBe(false);
    expect(canAccessCeo(undefined)).toBe(false);
  });
});

describe("geracaoCaixaFromBp", () => {
  const bp = {
    linhas: [
      { metrica: "geracao_caixa", direcao: "maior_melhor", unidade: "brl", meses: [
        { mes: 1, orcado: 250, realizado: 111, atingimento: null },
        { mes: 2, orcado: 260, realizado: null, atingimento: null },
        { mes: 3, orcado: 500, realizado: 222, atingimento: null },
      ] },
    ] as BpLinha[],
    metricasGerais: [
      { metrica: "receita_total", direcao: "maior_melhor", unidade: "brl", meses: [
        { mes: 1, orcado: 1000, realizado: 950, atingimento: 0.95 },
        { mes: 2, orcado: 1000, realizado: 990, atingimento: 0.99 },
        { mes: 3, orcado: 1200, realizado: null, atingimento: null },
      ] },
      { metrica: "despesa_total", direcao: "menor_melhor", unidade: "brl", meses: [
        { mes: 1, orcado: 700, realizado: 600, atingimento: 600 / 700 },
        { mes: 2, orcado: 700, realizado: null, atingimento: null },
        { mes: 3, orcado: 800, realizado: 650, atingimento: 650 / 800 },
      ] },
    ] as BpLinha[],
    receitaRecebidaCaixaPorMes: { 1: 900, 3: 1100 } as Record<number, number>,
  };

  it("realizado = recebido − despesa (um menos o outro); meta = orçado geracao_caixa do BP", () => {
    const l = geracaoCaixaFromBp(bp);
    // mês 1: 900 − 600 = 300; meta = 250 (do BP, NÃO derivada)
    expect(l.meses[0]).toEqual({ mes: 1, orcado: 250, realizado: 300, atingimento: 300 / 250 });
    // mês 3: 1100 − 650 = 450; meta 500 do BP
    expect(l.meses[2]).toEqual({ mes: 3, orcado: 500, realizado: 450, atingimento: 450 / 500 });
  });

  it("sem recebido OU sem despesa realizada → realizado null (não finge resultado)", () => {
    const l = geracaoCaixaFromBp(bp);
    expect(l.meses[1].realizado).toBeNull(); // mês 2: despesa null
    expect(l.meses[1].atingimento).toBeNull();
    expect(l.meses[1].orcado).toBe(260); // meta do BP segue visível
  });
});
