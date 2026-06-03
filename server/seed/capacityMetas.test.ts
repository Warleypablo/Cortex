import { describe, it, expect } from "vitest";
import { CAPACITY_METAS_SEED } from "./capacityMetas";

describe("CAPACITY_METAS_SEED", () => {
  it("tem a contagem esperada por categoria", () => {
    const byCat = (c: string) => CAPACITY_METAS_SEED.filter((m) => m.categoria === c).length;
    expect(byCat("cs")).toBe(11);
    expect(byCat("vendedor")).toBe(6);
    expect(byCat("account")).toBe(4);
    expect(byCat("gestor")).toBe(7);
    expect(CAPACITY_METAS_SEED).toHaveLength(28);
  });

  it("não tem (match_responsavel, categoria) duplicado", () => {
    const keys = CAPACITY_METAS_SEED.map((m) => `${m.categoria}::${m.match_responsavel}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("CS tem cap_recorrente; comerciais têm cap_mrr e cap_contas", () => {
    for (const m of CAPACITY_METAS_SEED) {
      if (m.categoria === "cs") {
        expect(m.cap_recorrente).not.toBeNull();
      } else {
        expect(m.cap_mrr).not.toBeNull();
        expect(m.cap_contas).not.toBeNull();
      }
    }
  });
});
