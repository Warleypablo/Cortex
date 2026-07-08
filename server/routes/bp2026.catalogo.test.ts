// server/routes/bp2026.catalogo.test.ts
import { describe, it, expect } from "vitest";
import { abasDaMetrica, metricaPertenceAAba } from "./bp2026.catalogo";

describe("abasDaMetrica", () => {
  it("detalhadas por prefixo", () => {
    expect(abasDaMetrica("cac_vendas")).toEqual(["cac"]);
    expect(abasDaMetrica("sga_uzk")).toEqual(["sga"]);
    expect(abasDaMetrica("or_demais")).toEqual(["outras"]);
    expect(abasDaMetrica("funil_vendas_mrr")).toEqual(["funil"]);
    expect(abasDaMetrica("cap_contratos_performance")).toEqual(["capacity"]);
    expect(abasDaMetrica("vendas_mrr_performance")).toEqual(["vendasProduto"]);
    expect(abasDaMetrica("mrr_performance")).toEqual(["revenue"]);
  });
  it("churn total (R$ e %) pertencem ao revenue", () => {
    expect(abasDaMetrica("churn_rs_total")).toEqual(["revenue"]);
    expect(abasDaMetrica("churn_pct_total")).toEqual(["revenue"]);
    expect(metricaPertenceAAba("churn_pct_total", "revenue")).toBe(true);
  });
  it("pontual aparece em pontual E pontual-creators", () => {
    expect(abasDaMetrica("pontual_entrega")).toEqual(["pontual", "pontual-creators"]);
    expect(abasDaMetrica("pontual_squad:Alpha")).toEqual(["pontual", "pontual-creators"]);
  });
  it("agregados de resumo ficam no DRE/Métricas, não na aba detalhada", () => {
    expect(abasDaMetrica("cac")).toEqual(["dre"]);
    expect(abasDaMetrica("sga")).toEqual(["dre"]);
    expect(abasDaMetrica("mrr_ativo")).toEqual(["dre", "revenue"]);
    expect(abasDaMetrica("churn_mes")).toEqual(["metricas"]);
  });
  it("desconhecida → vazio", () => {
    expect(abasDaMetrica("xpto_qualquer")).toEqual([]);
  });
});

describe("metricaPertenceAAba (anti-spoof)", () => {
  it("bloqueia métrica de CAC pedida via aba dre", () => {
    expect(metricaPertenceAAba("cac_vendas", "dre")).toBe(false);
  });
  it("aceita métrica na sua aba", () => {
    expect(metricaPertenceAAba("cac_vendas", "cac")).toBe(true);
    expect(metricaPertenceAAba("pontual_entrega", "pontual-creators")).toBe(true);
  });
  it("mrr_ativo pertence a dre E revenue", () => {
    expect(metricaPertenceAAba("mrr_ativo", "dre")).toBe(true);
    expect(metricaPertenceAAba("mrr_ativo", "revenue")).toBe(true);
  });
});
