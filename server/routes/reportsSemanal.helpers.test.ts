import { describe, it, expect } from "vitest";
import { calcularJanelas, variacaoPct, montarKpi } from "./reportsSemanal.helpers";

describe("calcularJanelas", () => {
  it("meio da semana: quinta 2026-06-25 → atual seg(22)-25, anterior seg(15)-18", () => {
    expect(calcularJanelas("2026-06-25")).toEqual({
      atual: { inicio: "2026-06-22", fim: "2026-06-25" },
      anterior: { inicio: "2026-06-15", fim: "2026-06-18" },
    });
  });

  it("quando 'ate' é segunda, a janela atual tem 1 dia (inicio === fim)", () => {
    expect(calcularJanelas("2026-06-22")).toEqual({
      atual: { inicio: "2026-06-22", fim: "2026-06-22" },
      anterior: { inicio: "2026-06-15", fim: "2026-06-15" },
    });
  });

  it("domingo pertence à semana que começou na segunda anterior", () => {
    expect(calcularJanelas("2026-06-28")).toEqual({
      atual: { inicio: "2026-06-22", fim: "2026-06-28" },
      anterior: { inicio: "2026-06-15", fim: "2026-06-21" },
    });
  });

  it("virada de mês", () => {
    expect(calcularJanelas("2026-07-01")).toEqual({
      atual: { inicio: "2026-06-29", fim: "2026-07-01" },
      anterior: { inicio: "2026-06-22", fim: "2026-06-24" },
    });
  });

  it("virada de ano", () => {
    expect(calcularJanelas("2026-01-01")).toEqual({
      atual: { inicio: "2025-12-29", fim: "2026-01-01" },
      anterior: { inicio: "2025-12-22", fim: "2025-12-25" },
    });
  });
});

describe("variacaoPct", () => {
  it("calcula a variação percentual", () => {
    expect(variacaoPct(110, 100)).toBeCloseTo(10);
    expect(variacaoPct(90, 100)).toBeCloseTo(-10);
  });
  it("retorna null quando anterior é 0 ou algum valor é null", () => {
    expect(variacaoPct(50, 0)).toBeNull();
    expect(variacaoPct(null, 100)).toBeNull();
    expect(variacaoPct(100, null)).toBeNull();
  });
});

describe("montarKpi", () => {
  it("monta o objeto com variação e direção", () => {
    expect(montarKpi(110, 100, "up")).toEqual({
      atual: 110, anterior: 100, variacaoPct: 10, betterDirection: "up",
    });
  });
  it("propaga null sem quebrar", () => {
    expect(montarKpi(null, null, "down")).toEqual({
      atual: null, anterior: null, variacaoPct: null, betterDirection: "down",
    });
  });
});
