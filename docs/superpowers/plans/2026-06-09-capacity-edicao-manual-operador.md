# Edição manual de Capacity por operador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir criar, editar, ativar/desativar, reordenar e remover operadores e suas capacities (`cap_mrr`, `cap_recorrente`, `cap_pontual`, `cap_contas`) pela interface, numa nova aba "Configurar" da página Capacity Times.

**Architecture:** Backend ganha 5 endpoints CRUD em `server/routes/capacity.ts` sobre a tabela `cortex_core.capacity_metas` (que já existe). O seed vira bootstrap idempotente (só popula se vazio) para que edições manuais persistam. Frontend ganha uma aba com tabela + `Dialog` de add/edit; ao salvar, invalida `/api/capacity-metas` e `/api/capacity-times` para refletir nos cálculos das outras abas.

**Tech Stack:** Express + Drizzle (`db.execute(sql\`\`)`), Zod (validação), Vitest + supertest (testes de endpoint), React + React Query (`useQuery`/`useMutation`), shadcn/ui (Dialog, Select, Switch, Table, AlertDialog), Tailwind (dark/light).

**Spec:** `docs/superpowers/specs/2026-06-09-capacity-edicao-manual-operador-design.md`

---

## File Structure

| Arquivo | Responsabilidade | Ação |
|---------|------------------|------|
| `server/routes/capacity.ts` | 5 endpoints CRUD + schema Zod | Modify |
| `server/routes/capacityMetas.crud.test.ts` | Testes dos endpoints CRUD | Create |
| `server/seed/capacityMetas.ts` | Bootstrap idempotente | Modify |
| `server/seed/capacityMetas.test.ts` | Teste do bootstrap | Create |
| `client/src/components/capacity-times/CapacityMetasConfig.tsx` | Aba: query + tabela + ações (toggle/remover) | Create |
| `client/src/components/capacity-times/CapacityMetaDialog.tsx` | Form de add/edit + mutations POST/PUT | Create |
| `client/src/pages/CapacityTimes.tsx` | Registrar a aba "Configurar" | Modify |

**Tipos compartilhados** (definidos e exportados em `CapacityMetasConfig.tsx`, importados pelo Dialog):
```ts
export interface CapacityMeta {
  id: number;
  nome: string;
  match_responsavel: string;
  categoria: string;
  cap_recorrente: number | null;
  cap_mrr: number | null;
  cap_pontual: number | null;
  cap_contas: number | null;
  ordem: number;
  ativo: boolean;
}

export interface ResponsavelOption {
  responsavel: string;
  contratos: number;
  mrr: number;
}
```

---

## Task 1: Backend — `GET /api/capacity-metas` (lista completa) + import do Zod

**Files:**
- Modify: `server/routes/capacity.ts`
- Create: `server/routes/capacityMetas.crud.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `server/routes/capacityMetas.crud.test.ts`:
```ts
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
          cap_recorrente: 15, cap_mrr: "45000", cap_pontual: 0, cap_contas: null, ordem: 1, ativo: true },
        { id: 2, nome: "Old", match_responsavel: "Old Person", categoria: "Pulse",
          cap_recorrente: null, cap_mrr: null, cap_pontual: null, cap_contas: null, ordem: 99, ativo: false },
      ],
    });
    const res = await request(makeApp()).get("/api/capacity-metas");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toEqual({
      id: 1, nome: "Brenda", match_responsavel: "Brenda Federici", categoria: "Pulse",
      cap_recorrente: 15, cap_mrr: 45000, cap_pontual: 0, cap_contas: null, ordem: 1, ativo: true,
    });
    expect(res.body[1].ativo).toBe(false);
    expect(res.body[1].cap_mrr).toBeNull();
  });

  it("retorna 500 em erro de banco", async () => {
    mockExecute.mockRejectedValueOnce(new Error("db down"));
    const res = await request(makeApp()).get("/api/capacity-metas");
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run server/routes/capacityMetas.crud.test.ts`
Expected: FAIL (rota `/api/capacity-metas` retorna 404, não 200).

- [ ] **Step 3: Implementar**

Em `server/routes/capacity.ts`, adicionar o import do Zod no topo (após a linha 2):
```ts
import { z } from "zod";
```

Dentro de `registerCapacityRoutes`, logo após o endpoint `GET /api/capacity-times/contratos` (depois da linha 212), adicionar:
```ts
  // ── CRUD de capacity_metas (edição manual) ──

  function normalizeMetaRow(r: any) {
    const numOrNull = (v: any) => (v === null || v === undefined ? null : Number(v));
    return {
      id: Number(r.id),
      nome: String(r.nome),
      match_responsavel: String(r.match_responsavel),
      categoria: String(r.categoria),
      cap_recorrente: numOrNull(r.cap_recorrente),
      cap_mrr: numOrNull(r.cap_mrr),
      cap_pontual: numOrNull(r.cap_pontual),
      cap_contas: numOrNull(r.cap_contas),
      ordem: Number(r.ordem),
      ativo: Boolean(r.ativo),
    };
  }

  // GET /api/capacity-metas — lista TODAS as metas (inclusive inativas)
  app.get("/api/capacity-metas", async (_req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, nome, match_responsavel, categoria,
               cap_recorrente, cap_mrr, cap_pontual, cap_contas, ordem, ativo
        FROM cortex_core.capacity_metas
        ORDER BY ordem, nome
      `);
      res.json(result.rows.map(normalizeMetaRow));
    } catch (error) {
      console.error("[api] Error fetching capacity-metas:", error);
      res.status(500).json({ error: "Failed to fetch capacity-metas" });
    }
  });
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run server/routes/capacityMetas.crud.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add server/routes/capacity.ts server/routes/capacityMetas.crud.test.ts
git commit -m "feat(capacity): endpoint GET /api/capacity-metas com lista completa

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Backend — `GET /api/capacity-metas/responsaveis`

**Files:**
- Modify: `server/routes/capacity.ts`
- Modify: `server/routes/capacityMetas.crud.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar em `capacityMetas.crud.test.ts`, dentro do arquivo (novo `describe`):
```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run server/routes/capacityMetas.crud.test.ts -t responsaveis`
Expected: FAIL (404).

- [ ] **Step 3: Implementar**

Em `server/routes/capacity.ts`, logo após o endpoint `GET /api/capacity-metas` (criado na Task 1), adicionar. **Registrar antes dos endpoints com `:id`** para evitar ambiguidade de rota:
```ts
  // GET /api/capacity-metas/responsaveis — responsáveis reais de cup_contratos (dropdown + prévia)
  app.get("/api/capacity-metas/responsaveis", async (_req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT TRIM(r.parte) AS responsavel,
               COUNT(DISTINCT c.id_subtask) AS contratos,
               COALESCE(SUM(c.valorr), 0)   AS mrr
        FROM "Clickup".cup_contratos c
        CROSS JOIN LATERAL regexp_split_to_table(c.responsavel, ';') AS r(parte)
        WHERE c.status IN ('ativo','onboarding','em cancelamento')
          AND c.responsavel IS NOT NULL AND c.responsavel <> ''
          AND TRIM(r.parte) <> ''
        GROUP BY TRIM(r.parte)
        ORDER BY mrr DESC
      `);
      res.json(result.rows.map((r: any) => ({
        responsavel: String(r.responsavel),
        contratos: Number(r.contratos),
        mrr: Number(r.mrr),
      })));
    } catch (error) {
      console.error("[api] Error fetching responsaveis:", error);
      res.status(500).json({ error: "Failed to fetch responsaveis" });
    }
  });
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run server/routes/capacityMetas.crud.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add server/routes/capacity.ts server/routes/capacityMetas.crud.test.ts
git commit -m "feat(capacity): endpoint de responsáveis reais para vínculo

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Backend — Schema Zod + `POST /api/capacity-metas`

**Files:**
- Modify: `server/routes/capacity.ts`
- Modify: `server/routes/capacityMetas.crud.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar em `capacityMetas.crud.test.ts`:
```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run server/routes/capacityMetas.crud.test.ts -t "POST"`
Expected: FAIL (404).

- [ ] **Step 3: Implementar**

Em `server/routes/capacity.ts`, antes da função `registerCapacityRoutes` (no escopo do módulo, após o `normalizeSquad`), adicionar o schema:
```ts
const capacityMetaSchema = z.object({
  nome: z.string().trim().min(1, "nome é obrigatório"),
  match_responsavel: z.string().trim().min(1, "match_responsavel é obrigatório"),
  categoria: z.string().trim().min(1, "categoria é obrigatória"),
  cap_recorrente: z.number().int().nonnegative().nullable(),
  cap_mrr: z.number().nonnegative().nullable(),
  cap_pontual: z.number().int().nonnegative().nullable(),
  cap_contas: z.number().int().nonnegative().nullable(),
  ordem: z.number().int().nonnegative().default(0),
  ativo: z.boolean().default(true),
});
```

Dentro de `registerCapacityRoutes`, após o endpoint `GET /api/capacity-metas/responsaveis`, adicionar:
```ts
  // POST /api/capacity-metas — cria operador
  app.post("/api/capacity-metas", async (req, res) => {
    const parsed = capacityMetaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "dados inválidos" });
    }
    const m = parsed.data;
    try {
      const result = await db.execute(sql`
        INSERT INTO cortex_core.capacity_metas
          (nome, match_responsavel, categoria, cap_recorrente, cap_mrr, cap_pontual, cap_contas, ordem, ativo)
        VALUES (${m.nome}, ${m.match_responsavel}, ${m.categoria}, ${m.cap_recorrente},
                ${m.cap_mrr}, ${m.cap_pontual}, ${m.cap_contas}, ${m.ordem}, ${m.ativo})
        RETURNING id
      `);
      res.status(201).json({ id: Number((result.rows[0] as any).id) });
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({ error: "Operador já cadastrado nesse time" });
      }
      console.error("[api] Error creating capacity-meta:", error);
      res.status(500).json({ error: "Failed to create capacity-meta" });
    }
  });
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run server/routes/capacityMetas.crud.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add server/routes/capacity.ts server/routes/capacityMetas.crud.test.ts
git commit -m "feat(capacity): POST /api/capacity-metas com validação Zod

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Backend — `PUT /api/capacity-metas/:id`

**Files:**
- Modify: `server/routes/capacity.ts`
- Modify: `server/routes/capacityMetas.crud.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar em `capacityMetas.crud.test.ts` (reusa `validBody` do escopo do arquivo):
```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run server/routes/capacityMetas.crud.test.ts -t "PUT"`
Expected: FAIL (404 onde deveria ser 200).

- [ ] **Step 3: Implementar**

Em `server/routes/capacity.ts`, após o endpoint `POST /api/capacity-metas`, adicionar:
```ts
  // PUT /api/capacity-metas/:id — atualiza operador
  app.put("/api/capacity-metas/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "id inválido" });
    const parsed = capacityMetaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "dados inválidos" });
    }
    const m = parsed.data;
    try {
      const result = await db.execute(sql`
        UPDATE cortex_core.capacity_metas SET
          nome = ${m.nome}, match_responsavel = ${m.match_responsavel}, categoria = ${m.categoria},
          cap_recorrente = ${m.cap_recorrente}, cap_mrr = ${m.cap_mrr},
          cap_pontual = ${m.cap_pontual}, cap_contas = ${m.cap_contas},
          ordem = ${m.ordem}, ativo = ${m.ativo}, atualizado_em = NOW()
        WHERE id = ${id}
        RETURNING id
      `);
      if (result.rows.length === 0) return res.status(404).json({ error: "operador não encontrado" });
      res.json({ id });
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({ error: "Operador já cadastrado nesse time" });
      }
      console.error("[api] Error updating capacity-meta:", error);
      res.status(500).json({ error: "Failed to update capacity-meta" });
    }
  });
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run server/routes/capacityMetas.crud.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add server/routes/capacity.ts server/routes/capacityMetas.crud.test.ts
git commit -m "feat(capacity): PUT /api/capacity-metas/:id

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Backend — `DELETE /api/capacity-metas/:id`

**Files:**
- Modify: `server/routes/capacity.ts`
- Modify: `server/routes/capacityMetas.crud.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar em `capacityMetas.crud.test.ts`:
```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run server/routes/capacityMetas.crud.test.ts -t "DELETE"`
Expected: FAIL (404).

- [ ] **Step 3: Implementar**

Em `server/routes/capacity.ts`, após o endpoint `PUT`, adicionar:
```ts
  // DELETE /api/capacity-metas/:id — hard delete
  app.delete("/api/capacity-metas/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "id inválido" });
    try {
      await db.execute(sql`DELETE FROM cortex_core.capacity_metas WHERE id = ${id}`);
      res.status(204).end();
    } catch (error) {
      console.error("[api] Error deleting capacity-meta:", error);
      res.status(500).json({ error: "Failed to delete capacity-meta" });
    }
  });
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run server/routes/capacityMetas.crud.test.ts`
Expected: PASS (todos os describes).

- [ ] **Step 5: Commit**

```bash
git add server/routes/capacity.ts server/routes/capacityMetas.crud.test.ts
git commit -m "feat(capacity): DELETE /api/capacity-metas/:id

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Seed bootstrap idempotente

**Files:**
- Modify: `server/seed/capacityMetas.ts:58-100`
- Create: `server/seed/capacityMetas.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `server/seed/capacityMetas.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockExecute = vi.fn();
vi.mock("../db", () => ({ db: { execute: mockExecute } }));

import { seedCapacityMetas, CAPACITY_METAS_SEED } from "./capacityMetas";

beforeEach(() => vi.clearAllMocks());

describe("seedCapacityMetas (bootstrap)", () => {
  it("não insere quando a tabela já tem linhas", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ n: 28 }] }); // SELECT COUNT(*)
    await seedCapacityMetas();
    expect(mockExecute).toHaveBeenCalledTimes(1); // só o COUNT, nenhum INSERT
  });

  it("insere todas as linhas do seed quando a tabela está vazia", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ n: 0 }] }); // COUNT = 0
    mockExecute.mockResolvedValue({ rows: [] });             // INSERTs
    await seedCapacityMetas();
    // 1 COUNT + N INSERTs
    expect(mockExecute).toHaveBeenCalledTimes(1 + CAPACITY_METAS_SEED.length);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run server/seed/capacityMetas.test.ts`
Expected: FAIL (o seed atual não checa COUNT; chama execute para DELETEs + upserts, contagem não bate).

- [ ] **Step 3: Implementar**

Em `server/seed/capacityMetas.ts`, substituir **toda** a função `seedCapacityMetas` (linhas 58-100) por:
```ts
export async function seedCapacityMetas(): Promise<void> {
  try {
    // Bootstrap idempotente: a edição manual via UI é a fonte de verdade.
    // O seed só popula a tabela na primeira vez (quando está vazia).
    const { rows } = await db.execute(
      sql`SELECT COUNT(*)::int AS n FROM cortex_core.capacity_metas`
    );
    const n = Number((rows[0] as any)?.n ?? 0);
    if (n > 0) {
      console.log(`[database] capacity_metas já populada (${n} linhas) — bootstrap pulado`);
      return;
    }

    for (const m of CAPACITY_METAS_SEED) {
      await db.execute(sql`
        INSERT INTO cortex_core.capacity_metas
          (nome, match_responsavel, categoria, cap_recorrente, cap_mrr, cap_pontual, cap_contas, ordem)
        VALUES (${m.nome}, ${m.match_responsavel}, ${m.categoria}, ${m.cap_recorrente},
                ${m.cap_mrr}, ${m.cap_pontual}, ${m.cap_contas}, ${m.ordem})
      `);
    }

    console.log(`[database] capacity_metas bootstrap (${CAPACITY_METAS_SEED.length} linhas)`);
  } catch (error) {
    console.error('[database] Error seeding capacity_metas:', error);
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run server/seed/capacityMetas.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Rodar a suíte completa de capacity para garantir que nada quebrou**

Run: `npx vitest run server/routes/capacityMetas.crud.test.ts server/routes/capacityTimes.helpers.test.ts server/routes/capacityTimes.contratos.test.ts server/seed/capacityMetas.test.ts`
Expected: PASS em todos.

- [ ] **Step 6: Commit**

```bash
git add server/seed/capacityMetas.ts server/seed/capacityMetas.test.ts
git commit -m "refactor(capacity): seed vira bootstrap idempotente (só popula se vazio)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Frontend — componente `CapacityMetasConfig` (tabela read-only) + aba

**Files:**
- Create: `client/src/components/capacity-times/CapacityMetasConfig.tsx`
- Modify: `client/src/pages/CapacityTimes.tsx`

> Sem teste unitário (UI). Validação é manual no browser (Step 4). Garante que a aba aparece e a tabela lista os operadores.

- [ ] **Step 1: Criar o componente com query + tabela**

Criar `client/src/components/capacity-times/CapacityMetasConfig.tsx`:
```tsx
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CapacityMetaDialog, CATEGORIA_LABELS } from "./CapacityMetaDialog";

export interface CapacityMeta {
  id: number;
  nome: string;
  match_responsavel: string;
  categoria: string;
  cap_recorrente: number | null;
  cap_mrr: number | null;
  cap_pontual: number | null;
  cap_contas: number | null;
  ordem: number;
  ativo: boolean;
}

export interface ResponsavelOption {
  responsavel: string;
  contratos: number;
  mrr: number;
}

function fmtCap(v: number | null): string {
  return v === null ? "—" : new Intl.NumberFormat("pt-BR").format(v);
}

export function CapacityMetasConfig() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CapacityMeta | null>(null);
  const [toDelete, setToDelete] = useState<CapacityMeta | null>(null);

  const { data: metas, isLoading } = useQuery<CapacityMeta[]>({
    queryKey: ["/api/capacity-metas"],
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["/api/capacity-metas"] });
    queryClient.invalidateQueries({ queryKey: ["/api/capacity-times"] });
  }

  const toggleMutation = useMutation({
    mutationFn: async (m: CapacityMeta) => {
      await apiRequest("PUT", `/api/capacity-metas/${m.id}`, { ...m, ativo: !m.ativo });
    },
    onSuccess: invalidateAll,
    onError: (e: Error) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/capacity-metas/${id}`); },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Operador removido" });
      setToDelete(null);
    },
    onError: (e: Error) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-zinc-400">
          Configure a capacity de cada operador. As edições alimentam os cálculos das outras abas.
        </p>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} data-testid="capacity-add">
          <Plus className="h-4 w-4 mr-1" /> Adicionar operador
        </Button>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-zinc-700">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ordem</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Vínculo</TableHead>
              <TableHead className="text-right">Cap. MRR</TableHead>
              <TableHead className="text-right">Cap. Rec.</TableHead>
              <TableHead className="text-right">Cap. Pont.</TableHead>
              <TableHead className="text-right">Cap. Contas</TableHead>
              <TableHead className="text-center">Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(metas ?? []).map((m) => (
              <TableRow key={m.id} className={m.ativo ? "" : "opacity-50"}>
                <TableCell>{m.ordem}</TableCell>
                <TableCell className="font-medium text-gray-900 dark:text-white">{m.nome}</TableCell>
                <TableCell className="text-gray-600 dark:text-zinc-400">
                  {CATEGORIA_LABELS[m.categoria] ?? m.categoria}
                </TableCell>
                <TableCell className="text-gray-600 dark:text-zinc-400">{m.match_responsavel}</TableCell>
                <TableCell className="text-right">{fmtCap(m.cap_mrr)}</TableCell>
                <TableCell className="text-right">{fmtCap(m.cap_recorrente)}</TableCell>
                <TableCell className="text-right">{fmtCap(m.cap_pontual)}</TableCell>
                <TableCell className="text-right">{fmtCap(m.cap_contas)}</TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={m.ativo}
                    onCheckedChange={() => toggleMutation.mutate(m)}
                    data-testid={`capacity-toggle-${m.id}`}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(m); setDialogOpen(true); }}
                      data-testid={`capacity-edit-${m.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setToDelete(m)}
                      data-testid={`capacity-delete-${m.id}`}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CapacityMetaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        meta={editing}
        existingCategorias={Array.from(new Set((metas ?? []).map((m) => m.categoria)))}
        onSaved={invalidateAll}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover operador?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.nome}" será removido permanentemente. Para apenas pausar, use o toggle "Ativo".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && deleteMutation.mutate(toDelete.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

> Nota: este componente importa `CapacityMetaDialog` e `CATEGORIA_LABELS`, que serão criados na Task 8. O app não compila até a Task 8 — por isso o teste no browser é no fim da Task 8. Faça as duas em sequência.

- [ ] **Step 2: Integrar a aba em `CapacityTimes.tsx`**

Adicionar o import no topo (após a linha 3):
```tsx
import { CapacityMetasConfig } from "@/components/capacity-times/CapacityMetasConfig";
```

Em `CapacityTimes.tsx:513`, após `<TabsTrigger value="gestor">...`, adicionar o trigger:
```tsx
            <TabsTrigger value="__config__">⚙️ Configurar</TabsTrigger>
```

Em `CapacityTimes.tsx:527`, após a `<TabsContent value="gestor">...`, adicionar:
```tsx
          <TabsContent value="__config__"><CapacityMetasConfig /></TabsContent>
```

- [ ] **Step 3: Commit (após Task 8 compilar)**

> Não commitar isoladamente — o build quebra sem a Task 8. Commit conjunto está no fim da Task 8.

---

## Task 8: Frontend — `CapacityMetaDialog` (form add/edit + mutations)

**Files:**
- Create: `client/src/components/capacity-times/CapacityMetaDialog.tsx`

- [ ] **Step 1: Criar o componente de Dialog/form**

Criar `client/src/components/capacity-times/CapacityMetaDialog.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CapacityMeta, ResponsavelOption } from "./CapacityMetasConfig";

// Labels amigáveis para as categorias comerciais; operacionais usam o próprio nome.
export const CATEGORIA_LABELS: Record<string, string> = {
  vendedor: "Selca (vendedor)",
  account: "Accounts (account)",
  gestor: "Squadra (gestor)",
};

const CATEGORIAS_BASE = ["Pulse", "Aura", "Olimpo", "vendedor", "account", "gestor"];
const NOVA = "__nova__";

interface FormState {
  nome: string;
  categoria: string;
  match_responsavel: string;
  cap_recorrente: number | null;
  cap_mrr: number | null;
  cap_pontual: number | null;
  cap_contas: number | null;
  ordem: number;
  ativo: boolean;
}

const EMPTY: FormState = {
  nome: "", categoria: "", match_responsavel: "",
  cap_recorrente: null, cap_mrr: null, cap_pontual: null, cap_contas: null,
  ordem: 0, ativo: true,
};

function numField(v: number | null, set: (n: number | null) => void, label: string, testId: string) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        type="number"
        value={v === null ? "" : v}
        onChange={(e) => set(e.target.value === "" ? null : Number(e.target.value))}
        placeholder="—"
        data-testid={testId}
      />
    </div>
  );
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  meta: CapacityMeta | null;
  existingCategorias: string[];
  onSaved: () => void;
}

export function CapacityMetaDialog({ open, onOpenChange, meta, existingCategorias, onSaved }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [novaCategoria, setNovaCategoria] = useState("");
  const isNovaCategoria = form.categoria === NOVA;

  const { data: responsaveis } = useQuery<ResponsavelOption[]>({
    queryKey: ["/api/capacity-metas/responsaveis"],
    enabled: open,
  });

  // Sincroniza o form quando abre (modo edição preenche, modo novo zera).
  useEffect(() => {
    if (!open) return;
    if (meta) {
      setForm({
        nome: meta.nome, categoria: meta.categoria, match_responsavel: meta.match_responsavel,
        cap_recorrente: meta.cap_recorrente, cap_mrr: meta.cap_mrr,
        cap_pontual: meta.cap_pontual, cap_contas: meta.cap_contas,
        ordem: meta.ordem, ativo: meta.ativo,
      });
    } else {
      setForm(EMPTY);
    }
    setNovaCategoria("");
  }, [open, meta]);

  const categoriaOptions = Array.from(new Set([...CATEGORIAS_BASE, ...existingCategorias]));
  const respOptions: ResponsavelOption[] = responsaveis ?? [];
  // Garante que o vínculo atual (em edição) apareça mesmo se não estiver na lista de ativos.
  const hasCurrent = form.match_responsavel && !respOptions.some((r) => r.responsavel === form.match_responsavel);
  const selectedResp = respOptions.find((r) => r.responsavel === form.match_responsavel);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const categoria = isNovaCategoria ? novaCategoria.trim() : form.categoria;
      const payload = { ...form, categoria };
      if (meta) {
        await apiRequest("PUT", `/api/capacity-metas/${meta.id}`, payload);
      } else {
        await apiRequest("POST", "/api/capacity-metas", payload);
      }
    },
    onSuccess: () => {
      toast({ title: meta ? "Operador atualizado" : "Operador criado" });
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const categoriaValida = isNovaCategoria ? novaCategoria.trim().length > 0 : form.categoria.length > 0;
  const canSave = form.nome.trim() && form.match_responsavel.trim() && categoriaValida && !saveMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{meta ? "Editar operador" : "Adicionar operador"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Nome de exibição" data-testid="meta-nome" />
          </div>

          <div className="space-y-1">
            <Label>Categoria / Time</Label>
            <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
              <SelectTrigger data-testid="meta-categoria"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {categoriaOptions.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORIA_LABELS[c] ?? c}</SelectItem>
                ))}
                <SelectItem value={NOVA}>➕ Nova squad…</SelectItem>
              </SelectContent>
            </Select>
            {isNovaCategoria && (
              <Input className="mt-2" value={novaCategoria} onChange={(e) => setNovaCategoria(e.target.value)}
                placeholder="Nome da nova squad" data-testid="meta-nova-categoria" autoFocus />
            )}
          </div>

          <div className="space-y-1">
            <Label>Vínculo (responsável em contratos)</Label>
            <Select value={form.match_responsavel}
              onValueChange={(v) => setForm({ ...form, match_responsavel: v })}>
              <SelectTrigger data-testid="meta-vinculo"><SelectValue placeholder="Selecione o responsável" /></SelectTrigger>
              <SelectContent>
                {hasCurrent && (
                  <SelectItem value={form.match_responsavel}>{form.match_responsavel} (atual)</SelectItem>
                )}
                {respOptions.map((r) => (
                  <SelectItem key={r.responsavel} value={r.responsavel}>
                    {r.responsavel} — {r.contratos} contratos · {brl.format(r.mrr)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedResp && (
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                {selectedResp.contratos} contratos · {brl.format(selectedResp.mrr)} de MRR
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {numField(form.cap_mrr, (n) => setForm({ ...form, cap_mrr: n }), "Cap. MRR", "meta-cap-mrr")}
            {numField(form.cap_recorrente, (n) => setForm({ ...form, cap_recorrente: n }), "Cap. Recorrente", "meta-cap-rec")}
            {numField(form.cap_pontual, (n) => setForm({ ...form, cap_pontual: n }), "Cap. Pontual", "meta-cap-pont")}
            {numField(form.cap_contas, (n) => setForm({ ...form, cap_contas: n }), "Cap. Contas", "meta-cap-contas")}
            {numField(form.ordem, (n) => setForm({ ...form, ordem: n ?? 0 }), "Ordem", "meta-ordem")}
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={form.ativo} onCheckedChange={(c) => setForm({ ...form, ativo: c })}
              data-testid="meta-ativo" />
            <Label>Ativo</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!canSave} data-testid="meta-salvar">
            {saveMutation.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verificar tipos / build do frontend**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sem erros relacionados a `CapacityMetasConfig.tsx` / `CapacityMetaDialog.tsx`.
(Se o projeto não tiver script de typecheck isolado, rode `npm run build` e confirme que compila.)

- [ ] **Step 3: Testar no browser**

Reiniciar o dev server (mudou backend):
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev
```
No browser (`localhost:3000`), abrir Capacity Times → aba **⚙️ Configurar**:
1. A tabela lista os operadores existentes ordenados por `ordem`. ✅
2. "Adicionar operador" → preencher nome, categoria, escolher um vínculo (a prévia mostra "X contratos · R$ Y"), setar Cap. MRR → Salvar → linha aparece. ✅
3. Editar um operador → mudar Cap. MRR → Salvar → valor atualiza na tabela E nos cards/abas (Visão Geral). ✅
4. Toggle "Ativo" off → operador some das outras abas; on → volta. ✅
5. Remover → confirmação → some. ✅
6. Verificar **dark mode e light mode**. ✅

- [ ] **Step 4: Commit (Task 7 + Task 8 juntas)**

```bash
git add client/src/components/capacity-times/CapacityMetasConfig.tsx \
        client/src/components/capacity-times/CapacityMetaDialog.tsx \
        client/src/pages/CapacityTimes.tsx
git commit -m "feat(capacity): aba Configurar com CRUD de capacity por operador

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Verificação final + push

**Files:** nenhum (verificação)

- [ ] **Step 1: Rodar a suíte de testes completa de capacity**

Run: `npx vitest run server/routes/capacityMetas.crud.test.ts server/routes/capacityTimes.helpers.test.ts server/routes/capacityTimes.contratos.test.ts server/seed/capacityMetas.test.ts`
Expected: todos PASS.

- [ ] **Step 2: Revisar o diff completo da branch**

Run: `git diff main...feature/capacity-edicao-manual-operador --stat` e revisar mudanças.
Conferir: nenhum endpoint legado quebrado; seed sem o `DELETE` destrutivo; aba renderiza.

- [ ] **Step 3: Push**

```bash
git push
```

- [ ] **Step 4: Atualizações pós-conclusão (conforme MEMORY.md)**

Se houver chamado associado no Cortex DB, atualizar status para `review`. Atualizar o vault Obsidian se aplicável.

---

## Self-Review (preenchido na escrita do plano)

**Spec coverage:**
- ✅ GET lista completa (Task 1) · GET responsáveis (Task 2) · POST (Task 3) · PUT (Task 4) · DELETE (Task 5)
- ✅ Seed bootstrap idempotente (Task 6)
- ✅ Aba "Configurar" + tabela + toggle + remover (Task 7) · Dialog add/edit + dropdown de vínculo com prévia + invalidação dupla (Task 8)
- ✅ Validação Zod com `.nullable()` nos `cap_*` (Task 3) · 409 em duplicado (Task 3/4)
- ✅ Reordenação por campo `ordem` (Task 8) · categoria com opção de nova squad (Task 8) · soft (toggle) + hard delete (Task 7)
- ✅ Dark/light mode (Task 8, Step 3)

**Placeholder scan:** sem TBD/TODO; todo passo de código tem código completo.

**Type consistency:** `CapacityMeta` e `ResponsavelOption` definidos em `CapacityMetasConfig.tsx` e importados pelo Dialog. `CATEGORIA_LABELS` definido no Dialog e importado pelo Config. Schema Zod (`capacityMetaSchema`) bate com o payload enviado pelo Dialog (`nome, match_responsavel, categoria, cap_*, ordem, ativo`).
