import { describe, it, expect } from "vitest";
import { pontualTemCobertura, LIMIAR_COBERTURA_PONTUAL } from "./churnPontual";

describe("pontualTemCobertura", () => {
  it("aceita a cobertura real de 2026 (23,5%)", () => {
    expect(pontualTemCobertura(120, 510)).toBe(true);
  });

  it("rejeita a cobertura real de 2025 (3,7%)", () => {
    expect(pontualTemCobertura(35, 945)).toBe(false);
  });

  it("rejeita 2024, que não tem nenhuma linha com pontual", () => {
    expect(pontualTemCobertura(0, 428)).toBe(false);
  });

  it("aceita exatamente no limiar", () => {
    expect(pontualTemCobertura(10, 100)).toBe(true);
  });

  it("rejeita logo abaixo do limiar", () => {
    expect(pontualTemCobertura(9, 100)).toBe(false);
  });

  it("rejeita ano sem nenhuma linha, sem dividir por zero", () => {
    expect(pontualTemCobertura(0, 0)).toBe(false);
    expect(pontualTemCobertura(5, 0)).toBe(false);
  });

  it("expõe o limiar como 10%", () => {
    expect(LIMIAR_COBERTURA_PONTUAL).toBe(0.1);
  });
});
