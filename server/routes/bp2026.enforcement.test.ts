// server/routes/bp2026.enforcement.test.ts
import { describe, it, expect } from "vitest";
import { filtrarPayloadPorAbas } from "./bp2026.enforcement";

const payload = {
  ano: 2026, mesCorrente: 6, mesFechado: 5,
  linhas: [1], metricasGerais: [2], revenue: [3], funil: [4], vendasProduto: [5],
  capacity: [6], sgaDetalhe: [7], cacDetalhe: [8], outrasDetalhe: [9], pontual: [10],
  atualizadoEm: "x",
};

describe("filtrarPayloadPorAbas", () => {
  it("mantém metadados e só as chaves das abas liberadas", () => {
    const r = filtrarPayloadPorAbas(payload as any, ["dre", "revenue"]);
    expect(r.linhas).toEqual([1]);
    expect(r.revenue).toEqual([3]);
    expect("cacDetalhe" in r).toBe(false);
    expect("sgaDetalhe" in r).toBe(false);
    expect(r.ano).toBe(2026);
    expect(r.mesCorrente).toBe(6);
  });
  it("nenhuma aba → só metadados", () => {
    const r = filtrarPayloadPorAbas(payload as any, []);
    expect("linhas" in r).toBe(false);
    expect("cacDetalhe" in r).toBe(false);
    expect(r.atualizadoEm).toBe("x");
  });
  it("não muta o payload original", () => {
    filtrarPayloadPorAbas(payload as any, ["dre"]);
    expect("cacDetalhe" in payload).toBe(true);
  });
});
