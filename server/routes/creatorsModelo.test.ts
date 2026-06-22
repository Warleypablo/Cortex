// server/routes/creatorsModelo.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const mockExecute = vi.fn();
vi.mock("../db", () => ({ db: { execute: mockExecute } }));

import { registerCreatorsModeloRoutes } from "./creatorsModelo";

function makeApp() {
  const app = express();
  app.use((req, _res, next) => { (req as any).user = { email: "t@t.com" }; next(); });
  registerCreatorsModeloRoutes(app, { execute: mockExecute } as any);
  return app;
}

beforeEach(() => vi.clearAllMocks());

const dbRows = [
  { id_task: "R1", id_subtask: "S1", produto: "Creators", servico: "Creators Recorrente", status: "cancelado/inativo", tipo_receita: "recorrente", valorr: "1000", valorp: "0", lt_meses: "4", ltv_recorrente: "4000", is_ativo: false, is_churned: true, data_inconsistente: false, data_inicio: "2026-01-01", data_fim: "2026-05-01" },
  { id_task: "P1", id_subtask: "S2", produto: "Creators", servico: "Creators Pontual", status: "entregue", tipo_receita: "pontual", valorr: "0", valorp: "5000", lt_meses: null, ltv_recorrente: null, is_ativo: false, is_churned: false, data_inconsistente: false, data_inicio: "2026-03-01", data_fim: null },
];

describe("GET /api/creators-modelo", () => {
  it("retorna o payload com tabela, funil, curva, recompra e coorte", async () => {
    mockExecute.mockResolvedValueOnce({ rows: dbRows });
    const res = await request(makeApp()).get("/api/creators-modelo");
    expect(res.status).toBe(200);
    expect(res.body.tabela.cliente.length).toBeGreaterThan(0);
    expect(res.body.tabela.contrato.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty("funilVendido");
    expect(res.body).toHaveProperty("curvaRecorrente");
    expect(res.body).toHaveProperty("recompra");
    expect(res.body.meta).toHaveProperty("nAvulsos");
  });

  it("propaga de/ate como filtro de período", async () => {
    mockExecute.mockResolvedValueOnce({ rows: dbRows });
    const res = await request(makeApp()).get("/api/creators-modelo?de=2026-03&ate=2026-03");
    expect(res.status).toBe(200);
    expect(res.body.meta.de).toBe("2026-03");
    // R1 (jan) fica de fora; só P1 (mar) entra
    const pontTotal = res.body.tabela.cliente.find((g: any) => g.modelo === "pontual" && g.estado === "total");
    expect(pontTotal.metricas.n).toBe(1);
    const recTotal = res.body.tabela.cliente.find((g: any) => g.modelo === "recorrente" && g.estado === "total");
    expect(recTotal.metricas.n).toBe(0);
  });

  it("retorna 500 quando a query falha", async () => {
    mockExecute.mockRejectedValueOnce(new Error("db down"));
    const res = await request(makeApp()).get("/api/creators-modelo");
    expect(res.status).toBe(500);
  });
});
