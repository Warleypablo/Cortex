// server/routes/creatorsConversao.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const mockExecute = vi.fn();

import { registerCreatorsConversaoRoutes } from "./creatorsConversao";

function makeApp() {
  const app = express();
  app.use((req, _res, next) => { (req as any).user = { email: "t@t.com" }; next(); });
  registerCreatorsConversaoRoutes(app, { execute: mockExecute } as any);
  return app;
}

beforeEach(() => vi.clearAllMocks());

// ORDEM dos executes no handler: 1º convertidos, 2º total de pontuais.
const convertidosRows = [
  {
    id_task: "T1", nome: "Creamy", n_pontuais: 3, valor_pontual: "32997",
    primeiro_pontual: "2026-04-08", primeiro_rec: "2026-06-23",
    dias_ate_converter: 76, mrr: "150000",
    servicos_rec: "Creators Recorrente - Enterprise", rec_em_creators: true,
  },
  {
    id_task: "T2", nome: "Organoils", n_pontuais: 1, valor_pontual: "6000",
    primeiro_pontual: "2026-01-15", primeiro_rec: "2026-03-17",
    dias_ate_converter: 61, mrr: "5097",
    servicos_rec: "Gestão de performance - Starter", rec_em_creators: false,
  },
];

describe("GET /api/creators-conversao", () => {
  it("retorna resumo e clientes convertidos mapeados", async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: convertidosRows })
      .mockResolvedValueOnce({ rows: [{ total: 181 }] });
    const res = await request(makeApp()).get("/api/creators-conversao");
    expect(res.status).toBe(200);
    expect(res.body.resumo.totalPontuais).toBe(181);
    expect(res.body.resumo.convertidos).toBe(2);
    expect(res.body.resumo.convertidosCreators).toBe(1);
    expect(res.body.resumo.taxa).toBeCloseTo(2 / 181, 5);
    expect(res.body.clientes).toHaveLength(2);
    expect(res.body.clientes[0]).toEqual({
      idTask: "T1", nome: "Creamy", nPontuais: 3, valorPontual: 32997,
      primeiroPontual: "2026-04-08", primeiroRecorrente: "2026-06-23",
      diasAteConverter: 76, mrr: 150000,
      servicosRecorrentes: "Creators Recorrente - Enterprise", recEmCreators: true,
    });
  });

  it("base vazia → taxa 0 (sem divisão por zero)", async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: 0 }] });
    const res = await request(makeApp()).get("/api/creators-conversao");
    expect(res.status).toBe(200);
    expect(res.body.resumo.taxa).toBe(0);
    expect(res.body.clientes).toEqual([]);
  });

  it("params de período inválidos → 400", async () => {
    const res = await request(makeApp()).get("/api/creators-conversao?de=2026-1&ate=x");
    expect(res.status).toBe(400);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("falha de banco → 500", async () => {
    mockExecute.mockRejectedValueOnce(new Error("db down"));
    const res = await request(makeApp()).get("/api/creators-conversao");
    expect(res.status).toBe(500);
  });
});
