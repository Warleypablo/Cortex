import { describe, it, expect } from "vitest";
import { normalizePhoneBR, samePhoneBR } from "./phone";

describe("normalizePhoneBR", () => {
  it("normaliza celular GHL com DDI e 9º dígito", () => {
    expect(normalizePhoneBR("+5521975993170")).toBe("2175993170");
  });

  it("normaliza com espaços e hífen", () => {
    expect(normalizePhoneBR("+55 27 99753-5768")).toBe("2797535768");
  });

  it("normaliza formato Bitrix sem DDI", () => {
    expect(normalizePhoneBR("(21) 97599-3170")).toBe("2175993170");
  });

  it("remove zero de tronco", () => {
    expect(normalizePhoneBR("021975993170")).toBe("2175993170");
  });

  it("trata fixo de 8 dígitos (sem 9º dígito)", () => {
    expect(normalizePhoneBR("2733335768")).toBe("2733335768");
  });

  it("retorna null pra entrada vazia/curta/inválida", () => {
    expect(normalizePhoneBR("")).toBeNull();
    expect(normalizePhoneBR(null)).toBeNull();
    expect(normalizePhoneBR("123")).toBeNull();
  });
});

describe("samePhoneBR", () => {
  it("casa celular com e sem 9º dígito / com e sem DDI", () => {
    expect(samePhoneBR("+5521975993170", "(21) 97599-3170")).toBe(true);
    expect(samePhoneBR("5521975993170", "2175993170")).toBe(true);
  });

  it("não casa DDDs diferentes", () => {
    expect(samePhoneBR("21975993170", "11975993170")).toBe(false);
  });

  it("não casa quando algum é inválido", () => {
    expect(samePhoneBR("123", "21975993170")).toBe(false);
  });
});
