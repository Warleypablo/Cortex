import { describe, it, expect } from "vitest";
import {
  revenueChurnPct,
  resolveClienteSort,
  produtoBucket,
  mediana,
  buildMatrizEvolucaoProduto,
} from "./ltLtvChurn.helpers";

describe("revenueChurnPct", () => {
  it("calcula percentual com 1 casa decimal", () => {
    expect(revenueChurnPct(92468, 863597)).toBe(10.7);
  });
  it("retorna 0 quando base ativa é 0 (evita divisão por zero)", () => {
    expect(revenueChurnPct(1000, 0)).toBe(0);
  });
  it("retorna 0 quando não há MRR perdido", () => {
    expect(revenueChurnPct(0, 500000)).toBe(0);
  });
});

describe("resolveClienteSort", () => {
  it("mapeia colunas da whitelist", () => {
    expect(resolveClienteSort("lt", "asc")).toEqual({ col: "lt_meses", dir: "ASC" });
    expect(resolveClienteSort("ltvTotal", "desc")).toEqual({ col: "ltv_total", dir: "DESC" });
    expect(resolveClienteSort("contratos", "asc")).toEqual({ col: "n_contratos_rec", dir: "ASC" });
  });
  it("usa ltv_total DESC como default (sort/dir ausentes ou inválidos)", () => {
    expect(resolveClienteSort(undefined, undefined)).toEqual({ col: "ltv_total", dir: "DESC" });
    expect(resolveClienteSort("coluna_inexistente", "qualquer")).toEqual({ col: "ltv_total", dir: "DESC" });
  });
  it("nunca retorna entrada não-whitelisted (anti-injection)", () => {
    expect(resolveClienteSort("ltv_total; DROP TABLE", "asc").col).toBe("ltv_total");
  });
});

describe("produtoBucket", () => {
  it("mantém o nome dos 3 produtos principais", () => {
    expect(produtoBucket("Performance")).toBe("Performance");
    expect(produtoBucket("Social Media")).toBe("Social Media");
    expect(produtoBucket("Creators")).toBe("Creators");
  });
  it("joga qualquer outro produto (ou null) em Outros", () => {
    expect(produtoBucket("Broadcast")).toBe("Outros");
    expect(produtoBucket("CRM de Vendas")).toBe("Outros");
    expect(produtoBucket(null)).toBe("Outros");
    expect(produtoBucket(undefined)).toBe("Outros");
  });
});

describe("mediana", () => {
  it("ímpar = elemento do meio", () => {
    expect(mediana([4, 6, 10])).toBe(6);
  });
  it("par = média dos dois centrais", () => {
    expect(mediana([4, 6, 8, 12])).toBe(7);
  });
  it("vetor vazio retorna 0", () => {
    expect(mediana([])).toBe(0);
  });
});

describe("buildMatrizEvolucaoProduto", () => {
  const rows = [
    { mes: "2026-01", produto: "Performance", lt: 4, valorr: 1000 },
    { mes: "2026-01", produto: "Performance", lt: 6, valorr: 2000 },
    { mes: "2026-01", produto: "Broadcast", lt: 10, valorr: 500 },
    { mes: "2026-02", produto: "Creators", lt: 2, valorr: 3000 },
    { mes: "2025-12", produto: "Performance", lt: 99, valorr: 9999 }, // fora do eixo
  ];
  const meses = ["2026-01", "2026-02"];
  const out = buildMatrizEvolucaoProduto(rows, meses);

  it("preserva o eixo de meses recebido", () => {
    expect(out.meses).toEqual(["2026-01", "2026-02"]);
  });
  it("só lista buckets com dados, na ordem de BUCKETS_ORDER (Social Media sai)", () => {
    expect(out.produtos).toEqual(["Performance", "Creators", "Outros", "Total"]);
  });
  it("agrega média/mediana/n por produto e mês", () => {
    expect(out.celulas["Performance"]["2026-01"]).toEqual({
      lt: 5, ltv: 8000, lt_mediana: 5, ltv_mediana: 8000, n: 2,
    });
    expect(out.celulas["Outros"]["2026-01"]).toEqual({
      lt: 10, ltv: 5000, lt_mediana: 10, ltv_mediana: 5000, n: 1,
    });
  });
  it("Total soma todos os produtos do mês", () => {
    // lt [4,6,10] avg=6.7 mediana=6 ; ltv [4000,12000,5000] avg=7000 mediana=5000
    expect(out.celulas["Total"]["2026-01"]).toEqual({
      lt: 6.7, ltv: 7000, lt_mediana: 6, ltv_mediana: 5000, n: 3,
    });
  });
  it("ignora linhas de meses fora do eixo (2025-12)", () => {
    expect(out.celulas["Performance"]["2025-12"]).toBeUndefined();
  });
  it("célula sem dado fica ausente (não vira 0)", () => {
    expect(out.celulas["Performance"]?.["2026-02"]).toBeUndefined();
  });
});
