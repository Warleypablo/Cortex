import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const mockExecute = vi.fn();
vi.mock("../db", () => ({ db: { execute: mockExecute } }));

import { registerCapacityRoutes } from "./capacity";

function makeApp() {
  const app = express();
  app.use((req, _res, next) => { (req as any).user = { email: "t@t.com" }; next(); });
  registerCapacityRoutes(app, { execute: mockExecute } as any);
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/capacity-times/contratos", () => {
  it("retorna contratos do operador", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        { cliente: "Skyfit", produto: "Social Media", status: "ativo", valorr: "6000", valorp: "0", id_subtask: "abc123" },
        { cliente: "LaudoPsi", produto: "Social Media", status: "onboarding", valorr: "3897", valorp: "0", id_subtask: "def456" },
      ],
    });
    const res = await request(makeApp()).get("/api/capacity-times/contratos?nome=Brenda");
    expect(res.status).toBe(200);
    expect(res.body.contratos).toHaveLength(2);
    expect(res.body.contratos[0]).toEqual({
      cliente: "Skyfit",
      produto: "Social Media",
      status: "ativo",
      valorr: 6000,
      valorp: 0,
      id_subtask: "abc123",
    });
  });

  it("retorna 400 quando nome não fornecido", async () => {
    const res = await request(makeApp()).get("/api/capacity-times/contratos");
    expect(res.status).toBe(400);
  });

  it("retorna 500 em erro de banco", async () => {
    mockExecute.mockRejectedValueOnce(new Error("db down"));
    const res = await request(makeApp()).get("/api/capacity-times/contratos?nome=Brenda");
    expect(res.status).toBe(500);
  });

  it("substitui cliente null por '—'", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ cliente: null, produto: "Performance", status: "ativo", valorr: "5000", valorp: "0", id_subtask: "x1" }],
    });
    const res = await request(makeApp()).get("/api/capacity-times/contratos?nome=Victor");
    expect(res.body.contratos[0].cliente).toBe("—");
  });
});
