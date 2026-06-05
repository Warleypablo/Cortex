import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const mockExecute = vi.fn();
vi.mock("../db", () => ({ db: { execute: mockExecute } }));

import { registerGrowthDfcCacRoutes } from "./growthDfcCac";

function makeApp() {
  const app = express();
  app.use((req, _res, next) => { (req as any).user = { email: "t@t.com" }; next(); });
  registerGrowthDfcCacRoutes(app, { execute: mockExecute } as any);
  return app;
}

beforeEach(() => vi.clearAllMocks());

const CUSTOS_ROWS = [
  { mes: "2026-04", categoria: "06.04.01 Gestor Comercial", total: "10000" },
  { mes: "2026-04", categoria: "06.06.01 Despesas com Anúncios", total: "50000" },
  { mes: "2026-05", categoria: "06.04.04 Comissão Comercial", total: "20000" },
];
const RECEITA_ROWS = [
  { mes: "2026-04", contratos: "10", contratos_rec: "8", mrr: "100000", pontual: "50000" },
  { mes: "2026-05", contratos: "5",  contratos_rec: "5", mrr: "30000",  pontual: "10000" },
];

describe("GET /api/growth/dfc-cac", () => {
  it("retorna estrutura completa com meses, receita, custos e métricas", async () => {
    mockExecute.mockResolvedValueOnce({ rows: CUSTOS_ROWS });
    mockExecute.mockResolvedValueOnce({ rows: RECEITA_ROWS });

    const res = await request(makeApp()).get("/api/growth/dfc-cac?meses=2");
    expect(res.status).toBe(200);
    expect(res.body.meses).toEqual(["2026-04", "2026-05"]);
    expect(res.body.receita.recorrente["2026-04"]).toBe(100000);
    expect(res.body.receita.pontual["2026-04"]).toBe(50000);
    expect(res.body.receita.total["2026-04"]).toBe(150000);
    expect(res.body.receita.contratos["2026-04"]).toBe(10);
    expect(res.body.custos.grupos).toHaveLength(3);
    expect(res.body.custos.total["2026-04"]).toBe(60000);
    expect(res.body.metricas.cac["2026-04"]).toBe(6000);
    expect(res.body.metricas.ticketMedioRec["2026-04"]).toBe(12500); // 100000 / 8 contratos com recorrente
    expect(res.body.metricas.payback["2026-04"]).toBe(0.5); // 6000 / 12500
    expect(res.body.metricas.roi["2026-04"]).toBeCloseTo(150);
  });

  it("retorna null em métricas quando não há contratos no mês", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ mes: "2026-04", categoria: "06.06.01 Despesas com Anúncios", total: "10000" }] });
    mockExecute.mockResolvedValueOnce({ rows: [{ mes: "2026-04", contratos: "0", contratos_rec: "0", mrr: "0", pontual: "0" }] });

    const res = await request(makeApp()).get("/api/growth/dfc-cac?meses=1");
    expect(res.status).toBe(200);
    expect(res.body.metricas.cac["2026-04"]).toBeNull();
    expect(res.body.metricas.payback["2026-04"]).toBeNull();
  });

  it("retorna null em roi quando custo é zero", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });
    mockExecute.mockResolvedValueOnce({ rows: [{ mes: "2026-04", contratos: "5", contratos_rec: "5", mrr: "50000", pontual: "0" }] });

    const res = await request(makeApp()).get("/api/growth/dfc-cac?meses=1");
    expect(res.status).toBe(200);
    expect(res.body.metricas.roi["2026-04"]).toBeNull();
  });

  it("retorna 500 em erro de banco", async () => {
    mockExecute.mockRejectedValueOnce(new Error("db down"));
    const res = await request(makeApp()).get("/api/growth/dfc-cac?meses=2");
    expect(res.status).toBe(500);
  });
});
