import { describe, it, expect, vi, beforeEach } from "vitest";
import { vendasPorChannel, dealsPorChannel } from "./expansao";
import { CHANNEL_EXPANSAO } from "../../shared/crm-channel";

function dbComLinhas(rows: any[]) {
  return { execute: vi.fn().mockResolvedValue({ rows }) } as any;
}

describe("CHANNEL_EXPANSAO", () => {
  it("é exatamente a marcação usada no CRM", () => {
    expect(CHANNEL_EXPANSAO).toBe("Expansão de Conta");
  });
});

describe("vendasPorChannel", () => {
  it("mapeia as 4 colunas da query para números", async () => {
    const db = dbComLinhas([
      { novo_mrr: "180339.00", novo_pontual: "383267.00", cross_mrr: "9300.00", cross_pontual: "15300.00" },
    ]);
    const r = await vendasPorChannel(db, "2026-07-01", "2026-07-31");
    expect(r).toEqual({
      novoMrr: 180339,
      novoPontual: 383267,
      crossMrr: 9300,
      crossPontual: 15300,
    });
  });

  it("devolve zeros com erro:true quando a query falha, em vez de propagar", async () => {
    const db = { execute: vi.fn().mockRejectedValue(new Error("connection reset")) } as any;
    const r = await vendasPorChannel(db, "2026-07-01", "2026-07-31");
    expect(r).toEqual({ novoMrr: 0, novoPontual: 0, crossMrr: 0, crossPontual: 0, erro: true });
  });

  it("trata período sem nenhum deal ganho como zeros, sem erro", async () => {
    const db = dbComLinhas([{ novo_mrr: "0", novo_pontual: "0", cross_mrr: "0", cross_pontual: "0" }]);
    const r = await vendasPorChannel(db, "2026-07-20", "2026-07-26");
    expect(r).toEqual({ novoMrr: 0, novoPontual: 0, crossMrr: 0, crossPontual: 0 });
  });

  it("trata resultado sem linhas (rows vazio) como zeros, sem erro", async () => {
    const db = dbComLinhas([]);
    const r = await vendasPorChannel(db, "2026-07-20", "2026-07-26");
    expect(r).toEqual({ novoMrr: 0, novoPontual: 0, crossMrr: 0, crossPontual: 0 });
  });
});

describe("dealsPorChannel", () => {
  it("mapeia as linhas do drill", async () => {
    const db = dbComLinhas([
      { cliente: "ACME", closer: "Ana", canal: "Expansão de Conta", data: "2026-07-21", rec: "3000.00", pont: "2500.00" },
    ]);
    const r = await dealsPorChannel(db, "2026-07-20", "2026-07-26", "cross");
    expect(r).toEqual([
      { cliente: "ACME", closer: "Ana", canal: "Expansão de Conta", data: "2026-07-21", recorrente: 3000, pontual: 2500 },
    ]);
  });

  it("devolve lista vazia quando a query falha", async () => {
    const db = { execute: vi.fn().mockRejectedValue(new Error("boom")) } as any;
    expect(await dealsPorChannel(db, "2026-07-20", "2026-07-26", "novo")).toEqual([]);
  });
});
