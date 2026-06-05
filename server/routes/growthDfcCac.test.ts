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
// 10 total, 8 com recorrente, 6 com pontual
const RECEITA_ROWS = [
  { mes: "2026-04", contratos: "10", contratos_rec: "8", contratos_pont: "6", mrr: "100000", pontual: "50000" },
  { mes: "2026-05", contratos: "5",  contratos_rec: "5", contratos_pont: "3", mrr: "30000",  pontual: "10000" },
];

describe("GET /api/growth/dfc-cac", () => {
  it("retorna 3 sets de métricas (recorrente, pontual, ambos)", async () => {
    mockExecute.mockResolvedValueOnce({ rows: CUSTOS_ROWS });
    mockExecute.mockResolvedValueOnce({ rows: RECEITA_ROWS });

    const res = await request(makeApp()).get("/api/growth/dfc-cac?meses=2");
    expect(res.status).toBe(200);
    expect(res.body.meses).toEqual(["2026-04", "2026-05"]);
    expect(res.body.custos.grupos).toHaveLength(3);
    expect(res.body.custos.total["2026-04"]).toBe(60000);

    // Recorrente: denominador = 8
    expect(res.body.metricas.recorrente["2026-04"].cac).toBe(7500);    // 60000/8
    expect(res.body.metricas.recorrente["2026-04"].ticket).toBe(12500); // 100000/8
    expect(res.body.metricas.recorrente["2026-04"].payback).toBe(0.6);  // 7500/12500
    expect(res.body.metricas.recorrente["2026-04"].roi).toBeCloseTo(66.7, 0); // (100000-60000)/60000*100

    // Pontual: denominador = 6, sem payback
    expect(res.body.metricas.pontual["2026-04"].cac).toBe(10000);     // 60000/6
    expect(res.body.metricas.pontual["2026-04"].ticket).toBe(8333);   // 50000/6
    expect(res.body.metricas.pontual["2026-04"].payback).toBeNull();
    expect(res.body.metricas.pontual["2026-04"].roi).toBeCloseTo(-16.7, 0); // (50000-60000)/60000*100

    // Ambos: denominador = 10
    expect(res.body.metricas.ambos["2026-04"].cac).toBe(6000);        // 60000/10
    expect(res.body.metricas.ambos["2026-04"].ticket).toBe(15000);    // 150000/10
    expect(res.body.metricas.ambos["2026-04"].payback).toBeNull();
    expect(res.body.metricas.ambos["2026-04"].roi).toBeCloseTo(150);  // (150000-60000)/60000*100
  });

  it("retorna null em cac/ticket quando contratos = 0", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ mes: "2026-04", categoria: "06.06.01 Despesas com Anúncios", total: "10000" }] });
    mockExecute.mockResolvedValueOnce({ rows: [{ mes: "2026-04", contratos: "0", contratos_rec: "0", contratos_pont: "0", mrr: "0", pontual: "0" }] });

    const res = await request(makeApp()).get("/api/growth/dfc-cac?meses=1");
    expect(res.status).toBe(200);
    expect(res.body.metricas.recorrente["2026-04"].cac).toBeNull();
    expect(res.body.metricas.pontual["2026-04"].cac).toBeNull();
    expect(res.body.metricas.ambos["2026-04"].cac).toBeNull();
  });

  it("retorna null em roi quando custo é zero", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });
    mockExecute.mockResolvedValueOnce({ rows: [{ mes: "2026-04", contratos: "5", contratos_rec: "5", contratos_pont: "3", mrr: "50000", pontual: "10000" }] });

    const res = await request(makeApp()).get("/api/growth/dfc-cac?meses=1");
    expect(res.status).toBe(200);
    expect(res.body.metricas.recorrente["2026-04"].roi).toBeNull();
  });

  it("retorna 500 em erro de banco", async () => {
    mockExecute.mockRejectedValueOnce(new Error("db down"));
    const res = await request(makeApp()).get("/api/growth/dfc-cac?meses=2");
    expect(res.status).toBe(500);
  });
});
