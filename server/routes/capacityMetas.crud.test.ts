import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const mockExecute = vi.fn();
vi.mock("../db", () => ({ db: { execute: mockExecute } }));

import { registerCapacityRoutes } from "./capacity";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as any).user = { email: "t@t.com" }; next(); });
  registerCapacityRoutes(app, { execute: mockExecute } as any);
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/capacity-metas", () => {
  it("lista todas as metas, inclusive inativas, com tipos normalizados", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        { id: 1, nome: "Brenda", match_responsavel: "Brenda Federici", categoria: "Pulse",
          cap_recorrente: 15, cap_mrr: "45000", cap_pontual: 0, cap_contas: null, cap_clientes: 20, ordem: 1, ativo: true },
        { id: 2, nome: "Old", match_responsavel: "Old Person", categoria: "Pulse",
          cap_recorrente: null, cap_mrr: null, cap_pontual: null, cap_contas: null, ordem: 99, ativo: false },
      ],
    });
    const res = await request(makeApp()).get("/api/capacity-metas");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toEqual({
      id: 1, nome: "Brenda", match_responsavel: "Brenda Federici", categoria: "Pulse",
      cap_recorrente: 15, cap_mrr: 45000, cap_pontual: 0, cap_contas: null, cap_clientes: 20, ordem: 1, ativo: true,
    });
    expect(res.body[1].ativo).toBe(false);
    expect(res.body[1].cap_mrr).toBeNull();
    // linha sem a coluna preenchida vira null, não undefined
    expect(res.body[1].cap_clientes).toBeNull();
  });

  it("retorna 500 em erro de banco", async () => {
    mockExecute.mockRejectedValueOnce(new Error("db down"));
    const res = await request(makeApp()).get("/api/capacity-metas");
    expect(res.status).toBe(500);
  });
});

describe("GET /api/capacity-metas/responsaveis", () => {
  it("lista responsáveis reais com contratos e mrr normalizados", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        { responsavel: "Brenda Federici", contratos: 8, mrr: "30238" },
        { responsavel: "Karla Pin", contratos: "5", mrr: "12000.5" },
      ],
    });
    const res = await request(makeApp()).get("/api/capacity-metas/responsaveis");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { responsavel: "Brenda Federici", contratos: 8, mrr: 30238 },
      { responsavel: "Karla Pin", contratos: 5, mrr: 12000.5 },
    ]);
  });

  it("retorna 500 em erro de banco", async () => {
    mockExecute.mockRejectedValueOnce(new Error("db down"));
    const res = await request(makeApp()).get("/api/capacity-metas/responsaveis");
    expect(res.status).toBe(500);
  });
});

const validBody = {
  nome: "Novo", match_responsavel: "Novo Operador", categoria: "Pulse",
  cap_recorrente: 15, cap_mrr: 45000, cap_pontual: null, cap_contas: null,
  ordem: 5, ativo: true,
};

describe("POST /api/capacity-metas", () => {
  it("cria e retorna 201 com id", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 42 }] });
    const res = await request(makeApp()).post("/api/capacity-metas").send(validBody);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 42 });
  });

  it("aceita cap_* nulos", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 43 }] });
    const res = await request(makeApp()).post("/api/capacity-metas").send({
      ...validBody, cap_recorrente: null, cap_mrr: null, cap_pontual: null, cap_contas: null,
    });
    expect(res.status).toBe(201);
  });

  it("rejeita nome vazio com 400", async () => {
    const res = await request(makeApp()).post("/api/capacity-metas").send({ ...validBody, nome: "" });
    expect(res.status).toBe(400);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("rejeita match_responsavel ausente com 400", async () => {
    const { match_responsavel, ...rest } = validBody;
    const res = await request(makeApp()).post("/api/capacity-metas").send(rest);
    expect(res.status).toBe(400);
  });

  it("retorna 409 em violação de unicidade", async () => {
    mockExecute.mockRejectedValueOnce({ code: "23505" });
    const res = await request(makeApp()).post("/api/capacity-metas").send(validBody);
    expect(res.status).toBe(409);
  });
});

describe("PUT /api/capacity-metas/:id", () => {
  it("atualiza e retorna o id", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 7 }] });
    const res = await request(makeApp()).put("/api/capacity-metas/7").send(validBody);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 7 });
  });

  it("retorna 404 quando id não existe", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });
    const res = await request(makeApp()).put("/api/capacity-metas/999").send(validBody);
    expect(res.status).toBe(404);
  });

  it("retorna 400 com body inválido", async () => {
    const res = await request(makeApp()).put("/api/capacity-metas/7").send({ ...validBody, nome: "" });
    expect(res.status).toBe(400);
  });

  it("retorna 400 com id não numérico", async () => {
    const res = await request(makeApp()).put("/api/capacity-metas/abc").send(validBody);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/capacity-metas/:id", () => {
  it("remove e retorna 204", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });
    const res = await request(makeApp()).delete("/api/capacity-metas/7");
    expect(res.status).toBe(204);
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("retorna 400 com id não numérico", async () => {
    const res = await request(makeApp()).delete("/api/capacity-metas/abc");
    expect(res.status).toBe(400);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("retorna 500 em erro de banco", async () => {
    mockExecute.mockRejectedValueOnce(new Error("db down"));
    const res = await request(makeApp()).delete("/api/capacity-metas/7");
    expect(res.status).toBe(500);
  });
});
