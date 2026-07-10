import { describe, it, expect } from "vitest";
import { buildFaturado, type FaturadoRow } from "./reportsTrimestral.faturado";

// Números reais de 2026, validados contra "Conta Azul".caz_parcelas em 2026-07-09.
const ROWS_2026: FaturadoRow[] = [
  { quarter: 1, faturavel: "4197627", inadimplencia: "140413", faturado: "3995537" },
  { quarter: 2, faturavel: "4745361", inadimplencia: "278565", faturado: "4446563" },
];

const HOJE = new Date("2026-07-09T12:00:00Z"); // Q3/2026, 190º dia do ano

describe("buildFaturado", () => {
  it("agrupa por trimestre até o selecionado, sem enxergar os seguintes", () => {
    const f = buildFaturado(ROWS_2026, 2026, 2, HOJE);
    expect(f.trimestres.map((t) => t.label)).toEqual(["Q1", "Q2"]);
    expect(f.atual?.faturado).toBe(4446563);
    expect(f.atual?.inadimplencia).toBe(278565);
  });

  it("soma o faturado YTD e calcula o atingimento da meta", () => {
    const f = buildFaturado(ROWS_2026, 2026, 2, HOJE);
    expect(f.ytdFaturado).toBe(8442100);
    expect(f.meta).toBe(25_000_000);
    expect(f.pctMeta).toBeCloseTo(33.77, 1);
  });

  it("expõe o ritmo esperado do ano, que revela a defasagem vs o atingido", () => {
    const f = buildFaturado(ROWS_2026, 2026, 2, HOJE);
    // 2026 não é bissexto; 09/jul = dia 190 de 365 ≈ 52%
    expect(f.pctAnoDecorrido).toBeCloseTo(52.05, 1);
    expect(f.pctMeta!).toBeLessThan(f.pctAnoDecorrido!);
  });

  it("marca como parcial só o trimestre em andamento", () => {
    const f = buildFaturado([...ROWS_2026, { quarter: 3, faturavel: 100, inadimplencia: 0, faturado: 80 }], 2026, 3, HOJE);
    expect(f.trimestres.map((t) => t.parcial)).toEqual([false, false, true]);
  });

  it("zera trimestres sem movimento em vez de omiti-los do eixo", () => {
    const f = buildFaturado([{ quarter: 2, faturavel: 10, inadimplencia: 1, faturado: 9 }], 2026, 2, HOJE);
    expect(f.trimestres).toHaveLength(2);
    expect(f.trimestres[0]).toMatchObject({ label: "Q1", faturavel: 0, faturado: 0 });
  });

  it("não inventa meta fora de 2026", () => {
    const f = buildFaturado([], 2025, 4, HOJE);
    expect(f.meta).toBeNull();
    expect(f.pctMeta).toBeNull();
    expect(f.pctAnoDecorrido).toBeNull();
  });

  it("sinaliza cobertura parcial antes de out/2025, quando caz_parcelas ainda não existia", () => {
    expect(buildFaturado([], 2025, 4, HOJE).coberturaParcial).toBe(true);
    expect(buildFaturado(ROWS_2026, 2026, 2, HOJE).coberturaParcial).toBe(false);
  });

  it("não divide por zero num ano sem faturamento", () => {
    const f = buildFaturado([], 2026, 1, HOJE);
    expect(f.ytdFaturado).toBe(0);
    expect(f.pctMeta).toBe(0);
    expect(f.atual).toMatchObject({ faturavel: 0, faturado: 0 });
  });
});
