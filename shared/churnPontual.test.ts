import { describe, it, expect } from "vitest";
import {
  pontualTemCobertura,
  LIMIAR_COBERTURA_PONTUAL,
  MINIMO_LINHAS_COBERTURA_PONTUAL,
} from "./churnPontual";

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

  it("rejeita logo abaixo do limiar", () => {
    expect(pontualTemCobertura(9, 100)).toBe(false);
  });

  it("não decide (amostra insuficiente) ano sem nenhuma linha, sem dividir por zero", () => {
    expect(pontualTemCobertura(0, 0)).toBeUndefined();
    expect(pontualTemCobertura(5, 0)).toBeUndefined();
  });

  it("expõe o limiar como 10%", () => {
    expect(LIMIAR_COBERTURA_PONTUAL).toBe(0.1);
  });

  it("expõe o mínimo de amostra como 100 linhas", () => {
    expect(MINIMO_LINHAS_COBERTURA_PONTUAL).toBe(100);
  });

  it("não decide amostra pequena mesmo com proporção alta (ex.: início de janeiro cumulativo)", () => {
    // Caso real: fim de janeiro/2026 tem 4/81 = 4,9% de cobertura acumulada
    // (já reprovaria por limiar); nos primeiros dias do ano a amostra é ainda
    // menor que essas 81 linhas. Mesmo com proporção alta, amostra < 100
    // linhas não é suficiente para decidir true nem false.
    expect(pontualTemCobertura(90, 99)).toBeUndefined();
  });

  it("aceita exatamente no mínimo de amostra com proporção suficiente", () => {
    expect(pontualTemCobertura(10, 100)).toBe(true);
  });

  it("não decide amostra um abaixo do mínimo, mesmo com proporção suficiente", () => {
    expect(pontualTemCobertura(99, 99)).toBeUndefined();
  });

  it("diferencia 'decidiu que não tem cobertura' (false) de 'não deu para decidir' (undefined)", () => {
    // Amostra grande (>= 100) e proporção baixa (2,5%): decidiu — este ano
    // REALMENTE não tem cobertura de pontual. É uma afirmação, não um "ainda
    // não sei".
    expect(pontualTemCobertura(5, 200)).toBe(false);
    // Mesma proporção baixa (2,5%), mas amostra pequena (< 100): não dá para
    // decidir nada ainda — nem true, nem false. Isola o efeito do tamanho da
    // amostra (não da proporção). A série deve ficar calada.
    expect(pontualTemCobertura(1, 40)).toBeUndefined();
  });
});
