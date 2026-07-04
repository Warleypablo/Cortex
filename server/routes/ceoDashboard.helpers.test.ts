import { describe, it, expect } from "vitest";
import {
  bpLinhaToKpi,
  momFromSerie,
  simpleKpi,
  emBreveKpi,
  assembleCeoKpis,
  canAccessCeo,
  type BpLinha,
} from "./ceoDashboard.helpers";

const linhaReceita: BpLinha = {
  metrica: "receita_total",
  direcao: "maior_melhor",
  unidade: "brl",
  meses: [
    { mes: 1, orcado: 100, realizado: 90, atingimento: 90 },
    { mes: 2, orcado: 100, realizado: 110, atingimento: 110 },
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
      bpLinhas: [{ metrica: "ebitda", direcao: "maior_melhor", unidade: "brl", meses: [{ mes: 1, orcado: 10, realizado: 8, atingimento: 80 }] },
                 { metrica: "cac", direcao: "menor_melhor", unidade: "brl", meses: [{ mes: 1, orcado: 5, realizado: 4, atingimento: 80 }] }],
      bpMetricas: [
        { metrica: "receita_total", direcao: "maior_melhor", unidade: "brl", meses: [{ mes: 1, orcado: 100, realizado: 90, atingimento: 90 }] },
        { metrica: "despesa_total", direcao: "menor_melhor", unidade: "brl", meses: [{ mes: 1, orcado: 80, realizado: 70, atingimento: 87 }] },
        { metrica: "saldo_caixa", direcao: "maior_melhor", unidade: "brl", meses: [{ mes: 1, orcado: 50, realizado: 60, atingimento: 120 }] },
        { metrica: "colaboradores", direcao: "menor_melhor", unidade: "int", meses: [{ mes: 1, orcado: 140, realizado: 142, atingimento: 101 }] },
        { metrica: "receita_cabeca", direcao: "maior_melhor", unidade: "brl", meses: [{ mes: 1, orcado: 12, realizado: 13, atingimento: 108 }] },
      ],
      mesNum: 1,
      inadimplencia: { total: 20, serie: [18, 20] },
      ltvMedioCliente: 28000,
      enpsScore: 48,
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
