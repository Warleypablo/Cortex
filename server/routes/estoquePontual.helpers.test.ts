import { describe, it, expect } from "vitest";
import { AGING_FAIXAS, agingBucket, groupAging } from "./estoquePontual.helpers";

describe("agingBucket", () => {
  it("classifica idade em faixas", () => {
    expect(agingBucket(0)).toBe("0-30d");
    expect(agingBucket(29)).toBe("0-30d");
    expect(agingBucket(30)).toBe("30-90d");
    expect(agingBucket(89)).toBe("30-90d");
    expect(agingBucket(90)).toBe("90-180d");
    expect(agingBucket(179)).toBe("90-180d");
    expect(agingBucket(180)).toBe("180-365d");
    expect(agingBucket(364)).toBe("180-365d");
    expect(agingBucket(365)).toBe("+365d");
    expect(agingBucket(999)).toBe("+365d");
  });
});

describe("groupAging", () => {
  it("agrupa por faixa preservando a ordem e somando valor", () => {
    const rows = [
      { idadeDias: 10, valor: 100 },
      { idadeDias: 20, valor: 50 },
      { idadeDias: 100, valor: 300 },
      { idadeDias: 400, valor: 1000 },
    ];
    const out = groupAging(rows);
    expect(out.map((b) => b.faixa)).toEqual([...AGING_FAIXAS]);
    expect(out[0]).toEqual({ faixa: "0-30d", qtd: 2, valor: 150 });
    expect(out[2]).toEqual({ faixa: "90-180d", qtd: 1, valor: 300 });
    expect(out[4]).toEqual({ faixa: "+365d", qtd: 1, valor: 1000 });
  });

  it("retorna todas as faixas com zero quando não há linhas", () => {
    const out = groupAging([]);
    expect(out).toHaveLength(5);
    expect(out.every((b) => b.qtd === 0 && b.valor === 0)).toBe(true);
  });
});
