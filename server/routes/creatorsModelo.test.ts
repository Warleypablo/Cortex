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
  { id_task: "R1", id_subtask: "S1", produto: "Creators", servico: "Creators Recorrente", status: "ativo", tipo_receita: "recorrente", valorr: "1000", valorp: "0", lt_meses: "6", ltv_recorrente: "6000", is_ativo: true, is_churned: false, data_inconsistente: false, data_inicio: "2026-01-01", data_fim: null },
  { id_task: "R2", id_subtask: "S2", produto: "Creators", servico: "Creators Recorrente", status: "cancelado/inativo", tipo_receita: "recorrente", valorr: "1000", valorp: "0", lt_meses: "2", ltv_recorrente: "2000", is_ativo: false, is_churned: true, data_inconsistente: false, data_inicio: "2026-01-01", data_fim: "2026-03-01" },
  { id_task: "P1", id_subtask: "S3", produto: "Creators", servico: "Creators Pontual", status: "entregue", tipo_receita: "pontual", valorr: "0", valorp: "2000", lt_meses: null, ltv_recorrente: null, is_ativo: false, is_churned: false, data_inconsistente: false, data_inicio: "2026-03-01", data_fim: null },
];

describe("GET /api/creators-modelo (redesign)", () => {
  it("retorna placar, ltvMaduro, mixMensal, retencao e maturidade", async () => {
    mockExecute.mockResolvedValueOnce({ rows: dbRows });
    const res = await request(makeApp()).get("/api/creators-modelo");
    expect(res.status).toBe(200);
    expect(res.body.placar.porCliente.recorrente).toBe(4000);
    expect(res.body.placar.volume.pontualReceita).toBe(2000);
    expect(res.body.ltvMaduro.realizadoAtivo).toBe(6000);
    expect(Array.isArray(res.body.mixMensal)).toBe(true);
    expect(res.body.retencao).toHaveProperty("safra");
    expect(res.body.retencao).toHaveProperty("funilEntregue");
    expect(typeof res.body.maturidade.aviso).toBe("boolean");
    expect(Array.isArray(res.body.tabela.cliente)).toBe(true);
    expect(res.body.tabela.cliente.some((g: any) => g.modelo === "pontual" && g.estado === "total")).toBe(true);
    expect(Array.isArray(res.body.tabela.contrato)).toBe(true);
  });
  it("período filtra todos os blocos", async () => {
    mockExecute.mockResolvedValueOnce({ rows: dbRows });
    const res = await request(makeApp()).get("/api/creators-modelo?de=2026-03&ate=2026-03");
    expect(res.status).toBe(200);
    // só P1 (mar) entra; recorrentes (jan) saem → placar recorrente zera
    expect(res.body.placar.volume.recorrenteClientes).toBe(0);
    expect(res.body.placar.volume.pontualReceita).toBe(2000);
  });

  it("retorna 500 quando a query falha", async () => {
    mockExecute.mockRejectedValueOnce(new Error("db down"));
    const res = await request(makeApp()).get("/api/creators-modelo");
    expect(res.status).toBe(500);
  });
});
