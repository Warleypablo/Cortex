import { describe, it, expect, vi, beforeEach } from "vitest";
import { COMMERCIAL_CATEGORIAS } from "../routes/capacityTimes.helpers";

const mockExecute = vi.hoisted(() => vi.fn());
vi.mock("../db", () => ({ db: { execute: mockExecute } }));

import { seedCapacityMetas, CAPACITY_METAS_SEED } from "./capacityMetas";

beforeEach(() => vi.clearAllMocks());

describe("CAPACITY_METAS_SEED", () => {
  it("tem a contagem esperada por categoria", () => {
    const byCat = (c: string) => CAPACITY_METAS_SEED.filter((m) => m.categoria === c).length;
    expect(byCat("Pulse")).toBe(5);
    expect(byCat("Aura")).toBe(3);
    expect(byCat("Olimpo")).toBe(3);
    expect(byCat("vendedor")).toBe(6);
    expect(byCat("account")).toBe(4);
    expect(byCat("gestor")).toBe(7);
    expect(CAPACITY_METAS_SEED).toHaveLength(28);
  });

  it("não tem (match_responsavel, categoria) duplicado", () => {
    const keys = CAPACITY_METAS_SEED.map((m) => `${m.categoria}::${m.match_responsavel}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("ordem é global e única (1..28)", () => {
    const ordens = CAPACITY_METAS_SEED.map((m) => m.ordem).sort((a, b) => a - b);
    expect(ordens).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
  });

  it("squads operacionais têm cap_recorrente; comerciais têm cap_mrr e cap_contas", () => {
    const comercial = new Set<string>(COMMERCIAL_CATEGORIAS);
    for (const m of CAPACITY_METAS_SEED) {
      if (comercial.has(m.categoria)) {
        expect(m.cap_mrr).not.toBeNull();
        expect(m.cap_contas).not.toBeNull();
      } else {
        expect(m.cap_recorrente).not.toBeNull();
      }
    }
  });
});

describe("seedCapacityMetas (bootstrap)", () => {
  it("não insere quando a tabela já tem linhas", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ n: 28 }] }); // SELECT COUNT(*)
    await seedCapacityMetas();
    expect(mockExecute).toHaveBeenCalledTimes(1); // só o COUNT, nenhum INSERT
  });

  it("insere todas as linhas do seed quando a tabela está vazia", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ n: 0 }] }); // COUNT = 0
    mockExecute.mockResolvedValue({ rows: [] });             // INSERTs
    await seedCapacityMetas();
    // 1 COUNT + N INSERTs
    expect(mockExecute).toHaveBeenCalledTimes(1 + CAPACITY_METAS_SEED.length);
  });
});
