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
