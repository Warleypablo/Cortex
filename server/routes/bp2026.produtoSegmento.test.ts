import { describe, it, expect } from "vitest";
import { segmentoDeProduto } from "./bp2026.produtoSegmento";

describe("segmentoDeProduto", () => {
  it("mapeia produtos óbvios", () => {
    expect(segmentoDeProduto("Performance")).toBe("Performance");
    expect(segmentoDeProduto("Creators")).toBe("Creators");
    expect(segmentoDeProduto("Social Media")).toBe("Social");
    expect(segmentoDeProduto("Gestão de Comunidade")).toBe("Gestão de Comunidade");
    expect(segmentoDeProduto("Ecommerce")).toBe("E-commerce");
    expect(segmentoDeProduto("Site")).toBe("Site Institucional");
    expect(segmentoDeProduto("Landing Page")).toBe("Landing Page");
    expect(segmentoDeProduto("CRM de Vendas")).toBe("CRM");
  });
  it("aplica os julgamentos do de-para", () => {
    expect(segmentoDeProduto("Gameplan")).toBe("Performance");
    expect(segmentoDeProduto("Consultoria de Performance")).toBe("Performance");
    expect(segmentoDeProduto("TikTok Shop")).toBe("E-commerce");
    expect(segmentoDeProduto("CRO & Alteração")).toBe("E-commerce");
    expect(segmentoDeProduto("Régua de Automação")).toBe("CRM");
    expect(segmentoDeProduto("Broadcast")).toBe("Others");
  });
  it("default Others para desconhecido, vazio e nulo", () => {
    expect(segmentoDeProduto("Produto Novo XYZ")).toBe("Others");
    expect(segmentoDeProduto("(sem produto)")).toBe("Others");
    expect(segmentoDeProduto("")).toBe("Others");
    expect(segmentoDeProduto(null)).toBe("Others");
    expect(segmentoDeProduto(undefined)).toBe("Others");
  });
  it("tolera espaços nas bordas", () => {
    expect(segmentoDeProduto("  Performance  ")).toBe("Performance");
  });
});
