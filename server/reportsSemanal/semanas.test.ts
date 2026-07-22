import { describe, it, expect } from "vitest";
import { gerarSemanas } from "./semanas";

describe("gerarSemanas", () => {
  it("devolve a quantidade pedida, em ordem cronológica", () => {
    const s = gerarSemanas("2026-07-21", 12);
    expect(s).toHaveLength(12);
    expect(s[0].inicio < s[11].inicio).toBe(true);
  });

  it("toda janela vai de segunda a domingo", () => {
    for (const semana of gerarSemanas("2026-07-21", 12)) {
      expect(new Date(semana.inicio + "T00:00:00Z").getUTCDay()).toBe(1); // segunda
      expect(new Date(semana.fim + "T00:00:00Z").getUTCDay()).toBe(0); // domingo
    }
  });

  it("a última janela é a semana que contém hoje", () => {
    // 2026-07-21 é uma terça-feira
    const s = gerarSemanas("2026-07-21", 3);
    expect(s[2]).toMatchObject({ inicio: "2026-07-20", fim: "2026-07-26" });
  });

  it("marca só a semana corrente como parcial", () => {
    const s = gerarSemanas("2026-07-21", 3);
    expect(s.map((x) => x.parcial)).toEqual([false, false, true]);
  });

  it("domingo ainda é semana corrente e parcial (o dia não acabou)", () => {
    const s = gerarSemanas("2026-07-26", 2); // 2026-07-26 é domingo
    expect(s[1]).toMatchObject({ inicio: "2026-07-20", fim: "2026-07-26", parcial: true });
  });

  it("segunda-feira abre uma semana nova, e a anterior já conta como fechada", () => {
    const s = gerarSemanas("2026-07-27", 2); // segunda
    expect(s[1]).toMatchObject({ inicio: "2026-07-27", fim: "2026-08-02", parcial: true });
    expect(s[0]).toMatchObject({ inicio: "2026-07-20", fim: "2026-07-26", parcial: false });
  });

  it("atravessa virada de mês sem quebrar", () => {
    const s = gerarSemanas("2026-07-02", 2); // quinta
    expect(s[0]).toMatchObject({ inicio: "2026-06-22", fim: "2026-06-28" });
    expect(s[1]).toMatchObject({ inicio: "2026-06-29", fim: "2026-07-05" });
  });

  it("atravessa virada de ano sem quebrar", () => {
    const s = gerarSemanas("2027-01-07", 2); // quinta
    expect(s[0]).toMatchObject({ inicio: "2026-12-28", fim: "2027-01-03" });
    expect(s[1]).toMatchObject({ inicio: "2027-01-04", fim: "2027-01-10" });
  });

  it("label é dia/mês do início da semana", () => {
    expect(gerarSemanas("2026-07-21", 1)[0].label).toBe("20/07");
  });

  it("quantidade 1 devolve só a semana corrente", () => {
    expect(gerarSemanas("2026-07-21", 1)).toHaveLength(1);
  });
});
