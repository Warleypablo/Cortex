import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const mockExecute = vi.fn();
vi.mock("../db", () => ({ db: { execute: mockExecute } }));

import { registerEstoquePontualRoutes } from "./estoquePontual";

function makeApp() {
  const app = express();
  app.use((req, _res, next) => { (req as any).user = { email: "t@t.com" }; next(); });
  registerEstoquePontualRoutes(app, { execute: mockExecute } as any);
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/estoque-pontual/overview", () => {
  it("retorna os KPIs do estoque", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ valor_estoque: 1872688, qtd_itens: 244, idade_media: 52,
        qtd_envelhecidos: 36, valor_envelhecidos: 407000 }],
    });
    const res = await request(makeApp()).get("/api/estoque-pontual/overview");
    expect(res.status).toBe(200);
    expect(res.body.valorEstoque).toBe(1872688);
    expect(res.body.qtdItens).toBe(244);
    expect(res.body.qtdEnvelhecidos).toBe(36);
  });

  it("retorna 500 em erro de banco", async () => {
    mockExecute.mockRejectedValueOnce(new Error("db down"));
    const res = await request(makeApp()).get("/api/estoque-pontual/overview");
    expect(res.status).toBe(500);
  });
});

describe("GET /api/estoque-pontual/evolucao", () => {
  it("retorna a série mensal do estoque", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        { mes: "2026-03", valor_estoque: 1165158, qtd_estoque: 116 },
        { mes: "2026-04", valor_estoque: 1929268, qtd_estoque: 239 },
      ],
    });
    const res = await request(makeApp()).get("/api/estoque-pontual/evolucao?meses=2");
    expect(res.status).toBe(200);
    expect(res.body.serie).toHaveLength(2);
    expect(res.body.serie[1].valorEstoque).toBe(1929268);
    expect(res.body.serie[1].qtdEstoque).toBe(239);
  });
});

describe("GET /api/estoque-pontual/fluxo", () => {
  it("retorna entradas e entregas por mês", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        { mes: "2026-03", entradas: 139, val_entrada: 954000, entregas: 54, val_entregue: 300000 },
        { mes: "2026-05", entradas: 101, val_entrada: 600000, entregas: 87, val_entregue: 500000 },
      ],
    });
    const res = await request(makeApp()).get("/api/estoque-pontual/fluxo?meses=2");
    expect(res.status).toBe(200);
    expect(res.body.serie).toHaveLength(2);
    expect(res.body.serie[0].entradas).toBe(139);
    expect(res.body.serie[1].entregas).toBe(87);
  });
});

describe("GET /api/estoque-pontual/por-produto", () => {
  it("retorna distribuição por produto", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ produto: "Creators", qtd: 80, valor: 528000, idade_media: 45 }],
    });
    const res = await request(makeApp()).get("/api/estoque-pontual/por-produto");
    expect(res.status).toBe(200);
    expect(res.body.produtos[0].produto).toBe("Creators");
    expect(res.body.produtos[0].idadeMedia).toBe(45);
  });
});

describe("GET /api/estoque-pontual/por-squad", () => {
  it("retorna distribuição por squad", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ squad: "🏛️ Olimpo", qtd: 76, valor: 528000, idade_media: 50 }],
    });
    const res = await request(makeApp()).get("/api/estoque-pontual/por-squad");
    expect(res.status).toBe(200);
    expect(res.body.squads[0].squad).toBe("🏛️ Olimpo");
    expect(res.body.squads[0].qtd).toBe(76);
  });
});

describe("GET /api/estoque-pontual/aging", () => {
  it("agrupa por faixa de idade na ordem fixa", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        { idade_dias: 10, valor: 100 },
        { idade_dias: 100, valor: 300 },
        { idade_dias: 400, valor: 1000 },
      ],
    });
    const res = await request(makeApp()).get("/api/estoque-pontual/aging");
    expect(res.status).toBe(200);
    expect(res.body.buckets).toHaveLength(5);
    expect(res.body.buckets.map((b: any) => b.faixa)).toEqual(
      ["0-30d", "30-90d", "90-180d", "180-365d", "+365d"]);
    expect(res.body.buckets[0]).toEqual({ faixa: "0-30d", qtd: 1, valor: 100 });
    expect(res.body.buckets[2]).toEqual({ faixa: "90-180d", qtd: 1, valor: 300 });
  });
});

describe("GET /api/estoque-pontual/itens", () => {
  it("retorna itens paginados ordenados por idade", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ total: 244 }] });
    mockExecute.mockResolvedValueOnce({
      rows: [{ id_subtask: "86a92f1dr", nome_cliente: "Sopro", produto: "Creators",
        squad: "✨ Aura", responsavel: "Lara Grobério", valor: 1997,
        idade_dias: 368, status: "pausado" }],
    });
    const res = await request(makeApp()).get("/api/estoque-pontual/itens?produto=Creators");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(244);
    expect(res.body.itens[0].nomeCliente).toBe("Sopro");
    expect(res.body.itens[0].idadeDias).toBe(368);
  });

  it("retorna 500 em erro de banco", async () => {
    mockExecute.mockRejectedValueOnce(new Error("db down"));
    const res = await request(makeApp()).get("/api/estoque-pontual/itens");
    expect(res.status).toBe(500);
  });
});
