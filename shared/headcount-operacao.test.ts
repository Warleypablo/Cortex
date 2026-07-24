// shared/headcount-operacao.test.ts
import { describe, it, expect } from "vitest";
import { normalizarSquad, ehOperacao } from "./headcount-operacao";

describe("normalizarSquad", () => {
  it("remove emoji e variation selector, deixando o nome comparável", () => {
    expect(normalizarSquad("🪖 Selva")).toBe("selva");
    expect(normalizarSquad("Selva")).toBe("selva");
    expect(normalizarSquad("⚓️ Squadra")).toBe("squadra");
  });

  it("preserva & e ponto interno do nome", () => {
    expect(normalizarSquad("📊 CX&CS")).toBe("cx&cs");
    expect(normalizarSquad("Squad I.A")).toBe("squad ia");
  });

  it("nulo e vazio viram string vazia", () => {
    expect(normalizarSquad(null)).toBe("");
    expect(normalizarSquad(undefined)).toBe("");
    expect(normalizarSquad("   ")).toBe("");
  });
});

describe("ehOperacao", () => {
  it("aceita entrega em Commerce, com e sem emoji na squad", () => {
    expect(ehOperacao("Commerce", "🪖 Selva")).toBe(true);
    expect(ehOperacao("Commerce", "Selva")).toBe(true);
    expect(ehOperacao("Commerce", "Black Sheep")).toBe(true);
    expect(ehOperacao("Commerce", "📊 CX&CS")).toBe(true);
  });

  it("aceita Tech Sites", () => {
    expect(ehOperacao("Tech Sites", "🖥️ Tech")).toBe(true);
  });

  it("exclui Vendas mesmo dentro de Commerce, com e sem emoji", () => {
    expect(ehOperacao("Commerce", "💰 Vendas")).toBe(false);
    expect(ehOperacao("Commerce", "Vendas")).toBe(false);
  });

  it("exclui setores que não são de entrega", () => {
    expect(ehOperacao("Growth Interno", "🚀 Turbo Interno")).toBe(false);
    expect(ehOperacao("Backoffice", "Turbo Interno")).toBe(false);
    expect(ehOperacao("Sócios", "Turbo Interno")).toBe(false);
    expect(ehOperacao("Ventures", null)).toBe(false);
  });

  it("setor nulo ou desconhecido fica de fora", () => {
    expect(ehOperacao(null, "Selva")).toBe(false);
    expect(ehOperacao("", "Selva")).toBe(false);
    expect(ehOperacao("Comunicação", "Conteúdo")).toBe(false);
  });

  it("tolera espaço em volta do setor", () => {
    expect(ehOperacao("  Commerce  ", "Selva")).toBe(true);
  });
});
