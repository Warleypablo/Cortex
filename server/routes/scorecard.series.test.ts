import { describe, it, expect } from "vitest";
import {
  addMeses,
  listaMeses12,
  rowsParaSeries,
  rowsParaSeriesNullFill,
  rowsParaSerieUnica,
  normalizarNomeSquad,
  encontrarSquadCorrespondente,
} from "./scorecard.helpers";

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

describe("rowsParaSeriesNullFill", () => {
  const meses = listaMeses12("2026-03"); // 2025-04 .. 2026-03

  it("preenche meses SEM dado com null (não 0) — ex: lead time, mês sem entrega", () => {
    const rows = [{ mes: "2026-03", dim: "Performance", valor: 12 }];
    const series = rowsParaSeriesNullFill(rows, meses);
    expect(series["Performance"]).toHaveLength(12);
    expect(series["Performance"][11]).toEqual({ month: "2026-03", valor: 12 });
    expect(series["Performance"].slice(0, 11).every((p) => p.valor === null)).toBe(true);
  });

  it("mantém a ordem cronológica dos meses no array de pontos", () => {
    const rows = [
      { mes: "2025-04", dim: "Makers", valor: 5 },
      { mes: "2026-03", dim: "Makers", valor: 8 },
    ];
    const series = rowsParaSeriesNullFill(rows, meses);
    expect(series["Makers"].map((p) => p.month)).toEqual(meses);
    expect(series["Makers"][0].valor).toBe(5);
    expect(series["Makers"][11].valor).toBe(8);
  });

  it("separa séries por dimensão", () => {
    const rows = [
      { mes: "2026-01", dim: "Alice", valor: 10 },
      { mes: "2026-01", dim: "Bob", valor: 20 },
    ];
    const series = rowsParaSeriesNullFill(rows, meses);
    expect(Object.keys(series).sort()).toEqual(["Alice", "Bob"]);
    expect(series["Alice"].find((p) => p.month === "2026-01")?.valor).toBe(10);
    expect(series["Bob"].find((p) => p.month === "2026-01")?.valor).toBe(20);
  });

  it("aceita valor como string (retorno cru do driver pg para numeric)", () => {
    const rows = [{ mes: "2026-03", dim: "Performance", valor: "12.0" }];
    const series = rowsParaSeriesNullFill(rows, meses);
    expect(series["Performance"][11].valor).toBeCloseTo(12);
  });

  it("retorna objeto vazio quando não há linhas", () => {
    expect(rowsParaSeriesNullFill([], meses)).toEqual({});
  });
});

describe("rowsParaSerieUnica", () => {
  const meses = listaMeses12("2026-03"); // 2025-04 .. 2026-03

  it("preenche os 12 meses com 0 onde não há dado — é um saldo, 0 é válido (diferente de rowsParaSeriesNullFill)", () => {
    const rows = [{ mes: "2026-03", valor: 1500 }];
    const serie = rowsParaSerieUnica(rows, meses);
    expect(serie).toHaveLength(12);
    expect(serie[11]).toEqual({ month: "2026-03", valor: 1500 });
    expect(serie.slice(0, 11).every((p) => p.valor === 0)).toBe(true);
  });

  it("mantém a ordem cronológica dos meses no array de pontos", () => {
    const rows = [
      { mes: "2025-04", valor: 100 },
      { mes: "2026-03", valor: 200 },
    ];
    const serie = rowsParaSerieUnica(rows, meses);
    expect(serie.map((p) => p.month)).toEqual(meses);
    expect(serie[0].valor).toBe(100);
    expect(serie[11].valor).toBe(200);
  });

  it("soma valores quando o mesmo mês aparece em mais de uma linha (defensivo)", () => {
    const rows = [
      { mes: "2026-03", valor: 30 },
      { mes: "2026-03", valor: 20 },
    ];
    const serie = rowsParaSerieUnica(rows, meses);
    expect(serie[11].valor).toBe(50);
  });

  it("aceita valor como string/null (retorno cru do driver pg para numeric)", () => {
    const rows = [{ mes: "2026-03", valor: "123.45" as unknown as number }];
    expect(rowsParaSerieUnica(rows, meses)[11].valor).toBeCloseTo(123.45);

    const rowsNull = [{ mes: "2026-03", valor: null }];
    expect(rowsParaSerieUnica(rowsNull, meses)[11].valor).toBe(0);
  });

  it("nenhuma linha → todos os 12 meses zerados", () => {
    const serie = rowsParaSerieUnica([], meses);
    expect(serie).toHaveLength(12);
    expect(serie.every((p) => p.valor === 0)).toBe(true);
  });
});

describe("normalizarNomeSquad", () => {
  it("remove emoji e colapsa espaço, minúsculas — caso simples", () => {
    expect(normalizarNomeSquad("🪖 Selva")).toBe("selva");
    expect(normalizarNomeSquad("Selva")).toBe("selva");
  });

  it("mantém letras de sufixo '(OFF)' mas remove os parênteses (& e . preservados)", () => {
    expect(normalizarNomeSquad("✨ Aura (OFF)")).toBe("aura off");
    expect(normalizarNomeSquad("📊 CX&CS")).toBe("cx&cs");
    expect(normalizarNomeSquad("Squad I.A")).toBe("squad i.a");
  });

  it("remove diacríticos (ex: 'Não Informado')", () => {
    expect(normalizarNomeSquad("Não Informado")).toBe("nao informado");
  });

  it("null/undefined/vazio → string vazia", () => {
    expect(normalizarNomeSquad("")).toBe("");
    expect(normalizarNomeSquad(null as unknown as string)).toBe("");
    expect(normalizarNomeSquad(undefined as unknown as string)).toBe("");
  });

  it("variante com caractere invisível antes do nome (ex: '️ Squadra') normaliza igual à com emoji", () => {
    expect(normalizarNomeSquad("️ Squadra")).toBe(normalizarNomeSquad("⚓️ Squadra"));
  });
});

describe("encontrarSquadCorrespondente", () => {
  const squadsPorNorm = new Map<string, string>([
    ["selva", "🪖 Selva"],
    ["squadra", "⚓️ Squadra"],
    ["aura", "✨ Aura"],
    ["aura off", "✨ Aura (OFF)"],
    ["aurea off", "🌟 Aurea (OFF)"],
    ["black", "🐑 Black"],
  ]);

  it("match exato tem prioridade sobre prefixo", () => {
    expect(encontrarSquadCorrespondente("aura", squadsPorNorm)).toBe("✨ Aura");
    expect(encontrarSquadCorrespondente("selva", squadsPorNorm)).toBe("🪖 Selva");
  });

  it("cai para o melhor match por prefixo quando não há exato (ex: 'Black Sheep' RH → 'Black' revenue)", () => {
    expect(encontrarSquadCorrespondente("black sheep", squadsPorNorm)).toBe("🐑 Black");
  });

  it("não confunde squads com prefixo parecido ('aura' vs 'aurea off') no fallback por prefixo", () => {
    // Sem o match exato "aura", cai no fallback por prefixo — "aura" é prefixo de "aura off"
    // mas NÃO de "aurea off" (4º caractere diverge: a-u-r-A vs a-u-r-E) — não deve casar com Aurea.
    const semExato = new Map(squadsPorNorm);
    semExato.delete("aura");
    expect(encontrarSquadCorrespondente("aura", semExato)).toBe("✨ Aura (OFF)");
  });

  it("sem nenhum squad de receita correspondente → null (ex: squad comercial 'Vendas')", () => {
    expect(encontrarSquadCorrespondente("vendas", squadsPorNorm)).toBeNull();
  });

  it("chave normalizada vazia → null", () => {
    expect(encontrarSquadCorrespondente("", squadsPorNorm)).toBeNull();
  });
});
