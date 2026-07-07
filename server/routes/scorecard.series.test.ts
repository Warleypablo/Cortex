import { describe, it, expect } from "vitest";
import { addMeses, listaMeses12, rowsParaSeries } from "./scorecard.helpers";

describe("addMeses", () => {
  it("soma meses dentro do mesmo ano", () => {
    expect(addMeses("2026-03", 1)).toBe("2026-04");
    expect(addMeses("2026-03", -1)).toBe("2026-02");
  });

  it("normaliza overflow de ano (frente e trás)", () => {
    expect(addMeses("2026-12", 1)).toBe("2027-01");
    expect(addMeses("2026-01", -1)).toBe("2025-12");
  });

  it("normaliza deltas maiores que 12 meses", () => {
    expect(addMeses("2026-06", -11)).toBe("2025-07");
    expect(addMeses("2025-07", 11)).toBe("2026-06");
  });
});

describe("listaMeses12", () => {
  it("gera 12 meses em ordem cronológica terminando no mês pedido (inclusive)", () => {
    const meses = listaMeses12("2026-06");
    expect(meses).toHaveLength(12);
    expect(meses[0]).toBe("2025-07");
    expect(meses[11]).toBe("2026-06");
    expect(meses).toEqual([
      "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
      "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
    ]);
  });

  it("cruza a virada de ano corretamente", () => {
    const meses = listaMeses12("2026-01");
    expect(meses[0]).toBe("2025-02");
    expect(meses[11]).toBe("2026-01");
  });
});

describe("rowsParaSeries", () => {
  const meses = listaMeses12("2026-03"); // 2025-04 .. 2026-03

  it("preenche os 12 meses com 0 onde não há dado", () => {
    const rows = [{ mes: "2026-03", dim: "Squadra", valor: 100 }];
    const series = rowsParaSeries(rows, meses);
    expect(series["Squadra"]).toHaveLength(12);
    expect(series["Squadra"][11]).toEqual({ month: "2026-03", valor: 100 });
    expect(series["Squadra"].slice(0, 11).every((p) => p.valor === 0)).toBe(true);
  });

  it("mantém a ordem cronológica dos meses no array de pontos", () => {
    const rows = [
      { mes: "2025-04", dim: "Makers", valor: 10 },
      { mes: "2026-03", dim: "Makers", valor: 20 },
    ];
    const series = rowsParaSeries(rows, meses);
    expect(series["Makers"].map((p) => p.month)).toEqual(meses);
    expect(series["Makers"][0].valor).toBe(10);
    expect(series["Makers"][11].valor).toBe(20);
  });

  it("separa séries por dimensão", () => {
    const rows = [
      { mes: "2026-01", dim: "Alice", valor: 50 },
      { mes: "2026-01", dim: "Bob", valor: 75 },
    ];
    const series = rowsParaSeries(rows, meses);
    expect(Object.keys(series).sort()).toEqual(["Alice", "Bob"]);
    expect(series["Alice"].find((p) => p.month === "2026-01")?.valor).toBe(50);
    expect(series["Bob"].find((p) => p.month === "2026-01")?.valor).toBe(75);
  });

  it("soma valores quando a mesma dimensão/mês aparece em mais de uma linha (defensivo)", () => {
    const rows = [
      { mes: "2026-03", dim: "Squadra", valor: 30 },
      { mes: "2026-03", dim: "Squadra", valor: 20 },
    ];
    const series = rowsParaSeries(rows, meses);
    expect(series["Squadra"][11].valor).toBe(50);
  });

  it("aceita valor como string (retorno cru do driver pg para numeric)", () => {
    const rows = [{ mes: "2026-03", dim: "Squadra", valor: "123.45" }];
    const series = rowsParaSeries(rows, meses);
    expect(series["Squadra"][11].valor).toBeCloseTo(123.45);
  });

  it("retorna objeto vazio quando não há linhas", () => {
    expect(rowsParaSeries([], meses)).toEqual({});
  });
});
