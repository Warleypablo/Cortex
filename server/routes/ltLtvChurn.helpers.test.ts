import { describe, it, expect } from "vitest";
import { revenueChurnPct, resolveClienteSort, sugerirTier } from "./ltLtvChurn.helpers";

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

describe("sugerirTier", () => {
  it("classifica por faixa de MRR (NFNC/Regulares/Chaves/Imperdíveis)", () => {
    expect(sugerirTier(0)).toBe("1");
    expect(sugerirTier(1999)).toBe("1");
    expect(sugerirTier(2000)).toBe("2");
    expect(sugerirTier(3999)).toBe("2");
    expect(sugerirTier(4000)).toBe("3");
    expect(sugerirTier(6999)).toBe("3");
    expect(sugerirTier(7000)).toBe("4");
    expect(sugerirTier(30000)).toBe("4");
  });
  it("trata null/undefined como NFNC (cliente sem MRR ativo)", () => {
    expect(sugerirTier(null)).toBe("1");
    expect(sugerirTier(undefined)).toBe("1");
  });
});
