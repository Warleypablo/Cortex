import { describe, it, expect } from "vitest";
import { somarValoresDrawer, pctDaBase, formatPct } from "./churnAggregations";
import type { ChurnContract } from "./types";

/** Constrói um ChurnContract mínimo; só os campos do teste importam. */
function contrato(over: Partial<ChurnContract>): ChurnContract {
  return {
    id: "t1", cliente_nome: "Cliente", cnpj: "", produto: "P", squad: "S",
    responsavel: "Não especificado", cs_responsavel: "", vendedor: "",
    valorr: 0, valorp: 0, data_inicio: "2026-01-01", data_encerramento: "2026-07-01",
    data_pausa: null, status: "encerrado", servico: "P", tipo: "churn",
    lifetime_meses: 0, ltv: 0, ...over,
  };
}

describe("somarValoresDrawer", () => {
  it("soma MRR e pontual independentemente", () => {
    const r = somarValoresDrawer([
      contrato({ valorr: 2997, valorp: 0 }),
      contrato({ valorr: 0, valorp: 14997 }),
      contrato({ valorr: 2000, valorp: 500 }),
    ]);
    expect(r.mrr).toBe(4997);
    expect(r.pontual).toBe(15497);
  });

  it("trata nulos e undefined como zero", () => {
    const r = somarValoresDrawer([
      contrato({ valorr: undefined as unknown as number, valorp: null as unknown as number }),
      contrato({ valorr: 1000, valorp: 100 }),
    ]);
    expect(r.mrr).toBe(1000);
    expect(r.pontual).toBe(100);
  });

  it("retorna zeros para lista vazia", () => {
    expect(somarValoresDrawer([])).toEqual({ mrr: 0, pontual: 0 });
  });

  it("preserva ajustes manuais negativos", () => {
    const r = somarValoresDrawer([
      contrato({ valorr: 10000 }),
      contrato({ valorr: -26500 }),
    ]);
    expect(r.mrr).toBe(-16500);
  });
});

describe("pctDaBase", () => {
  it("calcula a fração sobre a base", () => {
    expect(pctDaBase(162431, 1930000)).toBeCloseTo(0.08416, 5);
  });

  it("retorna null quando a base é zero", () => {
    expect(pctDaBase(1000, 0)).toBeNull();
  });

  it("retorna null quando a base é ausente", () => {
    expect(pctDaBase(1000, undefined as unknown as number)).toBeNull();
    expect(pctDaBase(1000, NaN)).toBeNull();
  });

  it("retorna null quando a base é negativa", () => {
    expect(pctDaBase(1000, -500)).toBeNull();
  });

  it("aceita valor zero com base válida", () => {
    expect(pctDaBase(0, 1000)).toBe(0);
  });
});

describe("formatPct", () => {
  it("formata com uma casa e vírgula decimal", () => {
    expect(formatPct(0.084)).toBe("8,4%");
  });

  it("respeita o número de casas pedido", () => {
    expect(formatPct(0.0169, 2)).toBe("1,69%");
  });

  it("formata zero", () => {
    expect(formatPct(0)).toBe("0,0%");
  });
});
