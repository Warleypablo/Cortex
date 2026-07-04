import { describe, it, expect } from "vitest";
import { formatValor, atingimentoTom } from "./ceoFormat";

describe("formatValor", () => {
  it("formata brl sem casas decimais", () => {
    expect(formatValor(1830000, "brl")).toMatch(/R\$\s?1\.830\.000/);
  });
  it("formata int e score como número puro, e null como travessão", () => {
    expect(formatValor(142, "int")).toBe("142");
    expect(formatValor(48, "score")).toBe("48");
    expect(formatValor(null, "brl")).toBe("—");
  });
  it("formata pct com sinal de porcentagem", () => {
    expect(formatValor(4.2, "pct")).toBe("4,2%");
  });
});

describe("atingimentoTom", () => {
  it("maior_melhor: >=100 verde, 80-99 âmbar, <80 vermelho", () => {
    expect(atingimentoTom(105, "maior_melhor")).toBe("verde");
    expect(atingimentoTom(90, "maior_melhor")).toBe("ambar");
    expect(atingimentoTom(70, "maior_melhor")).toBe("vermelho");
  });
  it("menor_melhor: gastar menos que a meta é verde", () => {
    expect(atingimentoTom(90, "menor_melhor")).toBe("verde");   // 90% da meta = bom
    expect(atingimentoTom(110, "menor_melhor")).toBe("ambar");
    expect(atingimentoTom(140, "menor_melhor")).toBe("vermelho");
  });
  it("null vira neutro", () => {
    expect(atingimentoTom(null, "maior_melhor")).toBe("neutro");
  });
});
