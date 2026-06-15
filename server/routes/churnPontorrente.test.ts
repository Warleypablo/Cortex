import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const mockExecute = vi.fn();
vi.mock("../db", () => ({ db: { execute: mockExecute } }));

import { registerChurnPontorrenteRoutes } from "./churnPontorrente";

function makeApp() {
  const app = express();
  app.use((req, _res, next) => { (req as any).user = { email: "t@t.com" }; next(); });
  registerChurnPontorrenteRoutes(app, { execute: mockExecute } as any);
  return app;
}

beforeEach(() => vi.clearAllMocks());

const dbRows = [
  { idTask: "A", produto: "Creators", servico: "Entrega 1 - Creators", status: "entregue", valorp: "10", squad: "Olimpo", responsavel: "Mariana", csResponsavel: "CS1", vendedor: "V1", motivoCancelamento: null, dataInicio: "2025-06-25", dataEncerramento: null, nomeCliente: "Cliente A" },
  { idTask: "A", produto: "Creators", servico: "Entrega 4 - Creators", status: "cancelado/inativo", valorp: "1000", squad: "Olimpo", responsavel: "Mariana", csResponsavel: "CS1", vendedor: "V1", motivoCancelamento: "Inadimplente", dataInicio: "2025-09-01", dataEncerramento: "2026-02-01", nomeCliente: "Cliente A" },
  { idTask: "C", produto: "Performance", servico: "Entrega 1 - Performance", status: "cancelado/inativo", valorp: "800", squad: "Selva", responsavel: "Larissa", csResponsavel: "CS2", vendedor: "V2", motivoCancelamento: "Erro na Venda", dataInicio: "2026-01-10", dataEncerramento: "2026-03-01", nomeCliente: "Cliente C" },
];

describe("GET /api/churn-pontorrente", () => {
  it("retorna payload com overview, funil e detalhamento", async () => {
    mockExecute.mockResolvedValueOnce({ rows: dbRows });
    const res = await request(makeApp()).get("/api/churn-pontorrente");
    expect(res.status).toBe(200);
    expect(res.body.overview.jornadas).toBe(2);
    expect(res.body.overview.churnConfirmado).toBe(2);
    expect(res.body.overview.valorpPerdido).toBe(1800);
    expect(res.body.detalhamento[0].valorp).toBe(1000);
    expect(res.body.filtrosDisponiveis.produtos).toEqual(["Creators", "Performance"]);
  });

  it("aplica filtro de produto via query", async () => {
    mockExecute.mockResolvedValueOnce({ rows: dbRows });
    const res = await request(makeApp()).get("/api/churn-pontorrente?produto=Performance");
    expect(res.status).toBe(200);
    expect(res.body.overview.jornadas).toBe(1);
    expect(res.body.detalhamento[0].produto).toBe("Performance");
  });

  it("base=entregue zera o churn", async () => {
    mockExecute.mockResolvedValueOnce({ rows: dbRows });
    const res = await request(makeApp()).get("/api/churn-pontorrente?base=entregue");
    expect(res.status).toBe(200);
    expect(res.body.overview.churnConfirmado).toBe(0);
  });

  it("retorna 500 em erro de banco", async () => {
    mockExecute.mockRejectedValueOnce(new Error("db down"));
    const res = await request(makeApp()).get("/api/churn-pontorrente");
    expect(res.status).toBe(500);
  });
});
