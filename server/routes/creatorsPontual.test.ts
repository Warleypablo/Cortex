import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const mockExecute = vi.fn();
vi.mock("../db", () => ({ db: { execute: mockExecute } }));

import { registerCreatorsPontualRoutes } from "./creatorsPontual";

function makeApp() {
  const app = express();
  app.use((req, _res, next) => { (req as any).user = { email: "t@t.com" }; next(); });
  registerCreatorsPontualRoutes(app, { execute: mockExecute } as any);
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/creators-pontual/overview", () => {
  it("retorna KPIs incl. triagem", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ valor_estoque: 1000925, qtd_itens: 147, ticket_medio: 6809,
        idade_media: 51, valor_triagem: 544458, pct_triagem: 54.4 }],
    });
    const res = await request(makeApp()).get("/api/creators-pontual/overview");
    expect(res.status).toBe(200);
    expect(res.body.valorEstoque).toBe(1000925);
    expect(res.body.pctTriagem).toBe(54.4);
    expect(res.body.valorTriagem).toBe(544458);
  });

  it("retorna 500 em erro de banco", async () => {
    mockExecute.mockRejectedValueOnce(new Error("db down"));
    const res = await request(makeApp()).get("/api/creators-pontual/overview");
    expect(res.status).toBe(500);
  });
});

describe("GET /api/creators-pontual/funil", () => {
  it("retorna status por valor", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ status: "triagem", qtd: 78, valor: 544458 },
             { status: "ativo", qtd: 50, valor: 334263 }],
    });
    const res = await request(makeApp()).get("/api/creators-pontual/funil");
    expect(res.status).toBe(200);
    expect(res.body.status[0]).toEqual({ status: "triagem", qtd: 78, valor: 544458 });
  });
});

describe("GET /api/creators-pontual/fluxo", () => {
  it("retorna entradas e entregas mensais", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ mes: "2026-03", entradas: 109, val_entrada: 703000, entregas: 27, val_entregue: 180000 }],
    });
    const res = await request(makeApp()).get("/api/creators-pontual/fluxo?meses=1");
    expect(res.status).toBe(200);
    expect(res.body.serie[0].entradas).toBe(109);
    expect(res.body.serie[0].entregas).toBe(27);
  });
});

describe("GET /api/creators-pontual/evolucao", () => {
  it("retorna serie historica do estoque", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ mes: "2026-04", valor_estoque: 761052, qtd_estoque: 118 },
             { mes: "2026-05", valor_estoque: 924912, qtd_estoque: 143 }],
    });
    const res = await request(makeApp()).get("/api/creators-pontual/evolucao?meses=2");
    expect(res.status).toBe(200);
    expect(res.body.serie[1].valorEstoque).toBe(924912);
  });
});

describe("GET /api/creators-pontual/operadores", () => {
  it("retorna produtividade por operador", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ operador: "Mariana Dalto", aberto: 35, val_aberto: 222946,
        entregue: 21, ciclo_medio_dias: 52, idade_backlog_dias: 48 }],
    });
    const res = await request(makeApp()).get("/api/creators-pontual/operadores");
    expect(res.status).toBe(200);
    expect(res.body.operadores[0].operador).toBe("Mariana Dalto");
    expect(res.body.operadores[0].cicloMedioDias).toBe(52);
  });

  it("preserva null em ciclo/idade quando operador sem entregas", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ operador: "Novato Silva", aberto: 3, val_aberto: 15000,
        entregue: 0, ciclo_medio_dias: null, idade_backlog_dias: 12 }],
    });
    const res = await request(makeApp()).get("/api/creators-pontual/operadores");
    expect(res.status).toBe(200);
    expect(res.body.operadores[0].cicloMedioDias).toBeNull();
    expect(res.body.operadores[0].entregue).toBe(0);
    expect(res.body.operadores[0].idadeBacklogDias).toBe(12);
  });
});

describe("GET /api/creators-pontual/vendedores", () => {
  it("retorna ranking + semVendedor", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ vendedor: "Fabio Richard", qtd: 120, valor: 842395 }],
    });
    mockExecute.mockResolvedValueOnce({ rows: [{ qtd: 100, valor: 508443 }] });
    const res = await request(makeApp()).get("/api/creators-pontual/vendedores");
    expect(res.status).toBe(200);
    expect(res.body.vendedores[0].vendedor).toBe("Fabio Richard");
    expect(res.body.semVendedor).toEqual({ qtd: 100, valor: 508443 });
  });
});

describe("GET /api/creators-pontual/vendas-mensal", () => {
  it("retorna vendas por mes", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ mes: "2026-03", qtd: 109, valor: 703000 }],
    });
    const res = await request(makeApp()).get("/api/creators-pontual/vendas-mensal?meses=1");
    expect(res.status).toBe(200);
    expect(res.body.serie[0].qtd).toBe(109);
  });
});

describe("GET /api/creators-pontual/itens", () => {
  it("retorna itens paginados com operador e vendedor", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ total: 147 }] });
    mockExecute.mockResolvedValueOnce({
      rows: [{ id_subtask: "86a92f1dr", nome_cliente: "Sopro", produto: "Creators",
        squad: "✨ Aura", operador: "Lara Grobério", vendedor: null,
        valor: 1997, idade_dias: 368, status: "pausado" }],
    });
    const res = await request(makeApp()).get("/api/creators-pontual/itens?status=triagem");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(147);
    expect(res.body.itens[0].operador).toBe("Lara Grobério");
    expect(res.body.itens[0].vendedor).toBeNull();
  });

  it("retorna 500 em erro de banco", async () => {
    mockExecute.mockRejectedValueOnce(new Error("db down"));
    const res = await request(makeApp()).get("/api/creators-pontual/itens");
    expect(res.status).toBe(500);
  });
});
