import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const mockExecute = vi.fn();
vi.mock("../db", () => ({ db: { execute: mockExecute } }));

import { registerLtLtvChurnRoutes } from "./ltLtvChurn";

function makeApp() {
  const app = express();
  app.use((req, _res, next) => { (req as any).user = { email: "t@t.com" }; next(); });
  registerLtLtvChurnRoutes(app, { execute: mockExecute } as any);
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/lt-ltv-churn/overview", () => {
  it("retorna os KPIs agregados", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{
        mrr_ativo: 877945, lt_medio_ativo: 6.0, lt_medio_cancelado: 4.9,
        total_recorrentes: 1514, total_inconsistentes: 259,
      }],
    });
    mockExecute.mockResolvedValueOnce({ rows: [{ ltv_medio_cliente: 18952 }] });

    const res = await request(makeApp()).get("/api/lt-ltv-churn/overview");
    expect(res.status).toBe(200);
    expect(res.body.mrrAtivo).toBe(877945);
    expect(res.body.ltvMedioCliente).toBe(18952);
    expect(res.body.totalInconsistentes).toBe(259);
  });

  it("retorna 500 em erro de banco", async () => {
    mockExecute.mockRejectedValueOnce(new Error("db down"));
    const res = await request(makeApp()).get("/api/lt-ltv-churn/overview");
    expect(res.status).toBe(500);
  });
});

describe("GET /api/lt-ltv-churn/benchmark", () => {
  it("retorna lista por produto com revenue churn %", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{
        produto: "Performance", n_ativos: 134, n_cancelados: 697,
        lt_medio_cancelado: 4.6, lt_medio_ativo: 6.3, ltv_medio: 10686,
        mrr_ativo: 448114, mrr_perdido: 1536188,
      }],
    });
    const res = await request(makeApp()).get("/api/lt-ltv-churn/benchmark");
    expect(res.status).toBe(200);
    expect(res.body.produtos[0].produto).toBe("Performance");
    expect(res.body.produtos[0].revChurnPct).toBe(77.4);
  });
});

describe("GET /api/lt-ltv-churn/churn-mensal", () => {
  it("retorna a serie mensal", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        { mes: "2026-04", mrr_ativo_inicio: 1059611, mrr_perdido: 159274, rev_churn_pct: 15.0 },
        { mes: "2026-05", mrr_ativo_inicio: 1079394, mrr_perdido: 98833, rev_churn_pct: 9.2 },
      ],
    });
    const res = await request(makeApp()).get("/api/lt-ltv-churn/churn-mensal?meses=2");
    expect(res.status).toBe(200);
    expect(res.body.serie).toHaveLength(2);
    expect(res.body.serie[1].revChurnPct).toBe(9.2);
  });
});

describe("GET /api/lt-ltv-churn/contratos", () => {
  it("retorna contratos paginados", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ total: 1514 }] });
    mockExecute.mockResolvedValueOnce({
      rows: [{ id_subtask: "abc", produto: "Performance", status: "ativo",
        valorr: 1000, lt_meses: 6.3, ltv_recorrente: 6300, is_ativo: true,
        data_inconsistente: false, nome_cliente: "Cliente X" }],
    });
    const res = await request(makeApp()).get("/api/lt-ltv-churn/contratos?status=ativo");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1514);
    expect(res.body.contratos[0].produto).toBe("Performance");
  });
});

describe("GET /api/lt-ltv-churn/clientes", () => {
  it("retorna clientes agregados", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ total: 1387 }] });
    mockExecute.mockResolvedValueOnce({
      rows: [{ id_task: "t1", nome_cliente: "Cliente X", n_contratos_rec: 2,
        ltv_recorrente: 13000, ltv_pontual: 5000, ltv_total: 18000,
        lt_meses: 6.6, ativo: true }],
    });
    const res = await request(makeApp()).get("/api/lt-ltv-churn/clientes");
    expect(res.status).toBe(200);
    expect(res.body.clientes[0].ltvTotal).toBe(18000);
  });
});
