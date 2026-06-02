# Estoque de Produtos Pontuais — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir uma página `/estoque-pontual` no Cortex que gerencia o estoque de produtos pontuais (vendidos, não entregues) e diagnostica seu crescimento.

**Architecture:** Backend Express/Drizzle (`registerEstoquePontualRoutes(app, db)`) lê `"Clickup".cup_contratos` para o estoque atual (tem `data_criado`/`data_entrega`) e `"Clickup".cup_data_hist` para a evolução histórica. Frontend React + Recharts + React Query, módulo isolado em `client/src/components/estoque-pontual/`, página em `client/src/pages/EstoquePontual.tsx`, rota e menu via `App.tsx` + `shared/nav-config.ts`.

**Tech Stack:** TypeScript, Express, Drizzle (`db.execute(sql\`...\`)`), Vitest + supertest, React, wouter, @tanstack/react-query, Recharts, Tailwind (dark/light via `useTheme`).

**Spec:** `docs/superpowers/specs/2026-06-02-estoque-pontual-design.md`

**Definição canônica do estoque (validada em produção, 2026-06-02):**
```
valorp > 0 AND status NOT IN ('entregue','cancelado/inativo','não usar')
```
→ 244 itens, R$ 1.872.688. Inclui status `ativo`, `triagem`, `pausado`, `onboarding`, `em cancelamento`.

**Idade:** `GREATEST(CURRENT_DATE - data_criado, 0)` dias (nunca negativa). **Envelhecido:** idade ≥ 90 dias.
**Nome do cliente:** `LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = c.id_task` (NÃO `cl.id` — `id` é integer, `id_task` é text).
**Responsável:** `COALESCE(NULLIF(c.responsavel,''), c.cs_responsavel)`.

---

## File Structure

**Backend:**
- Create: `server/routes/estoquePontual.helpers.ts` — helpers puros de aging (testáveis)
- Create: `server/routes/estoquePontual.helpers.test.ts`
- Create: `server/routes/estoquePontual.ts` — `registerEstoquePontualRoutes(app, db)` com 7 endpoints
- Create: `server/routes/estoquePontual.test.ts`
- Modify: `server/routes.ts` — import + registro (linhas ~68 e ~8146)

**Frontend:**
- Create: `client/src/components/estoque-pontual/types.ts`
- Create: `client/src/components/estoque-pontual/utils.ts`
- Create: `client/src/components/estoque-pontual/OverviewCards.tsx`
- Create: `client/src/components/estoque-pontual/EvolucaoEstoque.tsx`
- Create: `client/src/components/estoque-pontual/FluxoMensal.tsx`
- Create: `client/src/components/estoque-pontual/DistribuicaoTabela.tsx`
- Create: `client/src/components/estoque-pontual/AgingChart.tsx`
- Create: `client/src/components/estoque-pontual/ItensTable.tsx`
- Create: `client/src/pages/EstoquePontual.tsx`
- Modify: `client/src/App.tsx` — lazy import + route
- Modify: `shared/nav-config.ts` — permission key, route map, nav item, label
- Modify: `client/src/components/app-sidebar.tsx` — ícone `Package`

---

## Task 1: Helpers de Aging (backend, TDD)

**Files:**
- Create: `server/routes/estoquePontual.helpers.ts`
- Test: `server/routes/estoquePontual.helpers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/routes/estoquePontual.helpers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { AGING_FAIXAS, agingBucket, groupAging } from "./estoquePontual.helpers";

describe("agingBucket", () => {
  it("classifica idade em faixas", () => {
    expect(agingBucket(0)).toBe("0-30d");
    expect(agingBucket(29)).toBe("0-30d");
    expect(agingBucket(30)).toBe("30-90d");
    expect(agingBucket(89)).toBe("30-90d");
    expect(agingBucket(90)).toBe("90-180d");
    expect(agingBucket(179)).toBe("90-180d");
    expect(agingBucket(180)).toBe("180-365d");
    expect(agingBucket(364)).toBe("180-365d");
    expect(agingBucket(365)).toBe("+365d");
    expect(agingBucket(999)).toBe("+365d");
  });
});

describe("groupAging", () => {
  it("agrupa por faixa preservando a ordem e somando valor", () => {
    const rows = [
      { idadeDias: 10, valor: 100 },
      { idadeDias: 20, valor: 50 },
      { idadeDias: 100, valor: 300 },
      { idadeDias: 400, valor: 1000 },
    ];
    const out = groupAging(rows);
    expect(out.map((b) => b.faixa)).toEqual([...AGING_FAIXAS]);
    expect(out[0]).toEqual({ faixa: "0-30d", qtd: 2, valor: 150 });
    expect(out[2]).toEqual({ faixa: "90-180d", qtd: 1, valor: 300 });
    expect(out[4]).toEqual({ faixa: "+365d", qtd: 1, valor: 1000 });
  });

  it("retorna todas as faixas com zero quando não há linhas", () => {
    const out = groupAging([]);
    expect(out).toHaveLength(5);
    expect(out.every((b) => b.qtd === 0 && b.valor === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/mac0267/Cortex/.claude/worktrees/lt-ltv-churn-dashboard && npx vitest run server/routes/estoquePontual.helpers.test.ts`
Expected: FAIL — `Cannot find module './estoquePontual.helpers'`

- [ ] **Step 3: Write minimal implementation**

Create `server/routes/estoquePontual.helpers.ts`:

```ts
export const AGING_FAIXAS = ["0-30d", "30-90d", "90-180d", "180-365d", "+365d"] as const;

export function agingBucket(idadeDias: number): string {
  if (idadeDias < 30) return "0-30d";
  if (idadeDias < 90) return "30-90d";
  if (idadeDias < 180) return "90-180d";
  if (idadeDias < 365) return "180-365d";
  return "+365d";
}

export function groupAging(
  rows: { idadeDias: number; valor: number }[],
): { faixa: string; qtd: number; valor: number }[] {
  const map = new Map<string, { qtd: number; valor: number }>();
  for (const f of AGING_FAIXAS) map.set(f, { qtd: 0, valor: 0 });
  for (const r of rows) {
    const e = map.get(agingBucket(r.idadeDias))!;
    e.qtd += 1;
    e.valor += r.valor;
  }
  return AGING_FAIXAS.map((f) => ({ faixa: f, qtd: map.get(f)!.qtd, valor: map.get(f)!.valor }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/routes/estoquePontual.helpers.test.ts`
Expected: PASS (2 suites, 3 tests)

- [ ] **Step 5: Commit**

```bash
git add server/routes/estoquePontual.helpers.ts server/routes/estoquePontual.helpers.test.ts
git commit -m "feat(estoque): helpers de aging buckets"
```

---

## Task 2: Endpoints do backend (TDD)

**Files:**
- Create: `server/routes/estoquePontual.ts`
- Test: `server/routes/estoquePontual.test.ts`
- Modify: `server/routes.ts:68` (import), `server/routes.ts:8146` (registro)

Endpoints (todos sob `/api/estoque-pontual`):
- `GET /overview` → `{ valorEstoque, qtdItens, idadeMedia, qtdEnvelhecidos, valorEnvelhecidos }`
- `GET /evolucao?meses=8` → `{ serie: [{ mes, valorEstoque, qtdEstoque }] }`
- `GET /fluxo?meses=8` → `{ serie: [{ mes, entradas, valEntrada, entregas, valEntregue }] }`
- `GET /por-produto` → `{ produtos: [{ produto, qtd, valor, idadeMedia }] }`
- `GET /por-squad` → `{ squads: [{ squad, qtd, valor, idadeMedia }] }`
- `GET /aging` → `{ buckets: [{ faixa, qtd, valor }] }`
- `GET /itens?produto=&squad=&page=` → `{ total, page, pageSize, itens: [{ idSubtask, nomeCliente, produto, squad, responsavel, valor, idadeDias, status }] }`

- [ ] **Step 1: Write the failing test**

Create `server/routes/estoquePontual.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const mockExecute = vi.fn();
vi.mock("../db", () => ({ db: { execute: mockExecute } }));

import { registerEstoquePontualRoutes } from "./estoquePontual";

function makeApp() {
  const app = express();
  app.use((req, _res, next) => { (req as any).user = { email: "t@t.com" }; next(); });
  registerEstoquePontualRoutes(app, { execute: mockExecute } as any);
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/estoque-pontual/overview", () => {
  it("retorna os KPIs do estoque", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ valor_estoque: 1872688, qtd_itens: 244, idade_media: 52,
        qtd_envelhecidos: 36, valor_envelhecidos: 407000 }],
    });
    const res = await request(makeApp()).get("/api/estoque-pontual/overview");
    expect(res.status).toBe(200);
    expect(res.body.valorEstoque).toBe(1872688);
    expect(res.body.qtdItens).toBe(244);
    expect(res.body.qtdEnvelhecidos).toBe(36);
  });

  it("retorna 500 em erro de banco", async () => {
    mockExecute.mockRejectedValueOnce(new Error("db down"));
    const res = await request(makeApp()).get("/api/estoque-pontual/overview");
    expect(res.status).toBe(500);
  });
});

describe("GET /api/estoque-pontual/evolucao", () => {
  it("retorna a série mensal do estoque", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        { mes: "2026-03", valor_estoque: 1165158, qtd_estoque: 116 },
        { mes: "2026-04", valor_estoque: 1929268, qtd_estoque: 239 },
      ],
    });
    const res = await request(makeApp()).get("/api/estoque-pontual/evolucao?meses=2");
    expect(res.status).toBe(200);
    expect(res.body.serie).toHaveLength(2);
    expect(res.body.serie[1].valorEstoque).toBe(1929268);
    expect(res.body.serie[1].qtdEstoque).toBe(239);
  });
});

describe("GET /api/estoque-pontual/fluxo", () => {
  it("retorna entradas e entregas por mês", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        { mes: "2026-03", entradas: 139, val_entrada: 954000, entregas: 54, val_entregue: 300000 },
        { mes: "2026-05", entradas: 101, val_entrada: 600000, entregas: 87, val_entregue: 500000 },
      ],
    });
    const res = await request(makeApp()).get("/api/estoque-pontual/fluxo?meses=2");
    expect(res.status).toBe(200);
    expect(res.body.serie).toHaveLength(2);
    expect(res.body.serie[0].entradas).toBe(139);
    expect(res.body.serie[1].entregas).toBe(87);
  });
});

describe("GET /api/estoque-pontual/por-produto", () => {
  it("retorna distribuição por produto", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ produto: "Creators", qtd: 80, valor: 528000, idade_media: 45 }],
    });
    const res = await request(makeApp()).get("/api/estoque-pontual/por-produto");
    expect(res.status).toBe(200);
    expect(res.body.produtos[0].produto).toBe("Creators");
    expect(res.body.produtos[0].idadeMedia).toBe(45);
  });
});

describe("GET /api/estoque-pontual/por-squad", () => {
  it("retorna distribuição por squad", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ squad: "🏛️ Olimpo", qtd: 76, valor: 528000, idade_media: 50 }],
    });
    const res = await request(makeApp()).get("/api/estoque-pontual/por-squad");
    expect(res.status).toBe(200);
    expect(res.body.squads[0].squad).toBe("🏛️ Olimpo");
    expect(res.body.squads[0].qtd).toBe(76);
  });
});

describe("GET /api/estoque-pontual/aging", () => {
  it("agrupa por faixa de idade na ordem fixa", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        { idade_dias: 10, valor: 100 },
        { idade_dias: 100, valor: 300 },
        { idade_dias: 400, valor: 1000 },
      ],
    });
    const res = await request(makeApp()).get("/api/estoque-pontual/aging");
    expect(res.status).toBe(200);
    expect(res.body.buckets).toHaveLength(5);
    expect(res.body.buckets.map((b: any) => b.faixa)).toEqual(
      ["0-30d", "30-90d", "90-180d", "180-365d", "+365d"]);
    expect(res.body.buckets[0]).toEqual({ faixa: "0-30d", qtd: 1, valor: 100 });
    expect(res.body.buckets[2]).toEqual({ faixa: "90-180d", qtd: 1, valor: 300 });
  });
});

describe("GET /api/estoque-pontual/itens", () => {
  it("retorna itens paginados ordenados por idade", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ total: 244 }] });
    mockExecute.mockResolvedValueOnce({
      rows: [{ id_subtask: "86a92f1dr", nome_cliente: "Sopro", produto: "Creators",
        squad: "✨ Aura", responsavel: "Lara Grobério", valor: 1997,
        idade_dias: 368, status: "pausado" }],
    });
    const res = await request(makeApp()).get("/api/estoque-pontual/itens?produto=Creators");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(244);
    expect(res.body.itens[0].nomeCliente).toBe("Sopro");
    expect(res.body.itens[0].idadeDias).toBe(368);
  });

  it("retorna 500 em erro de banco", async () => {
    mockExecute.mockRejectedValueOnce(new Error("db down"));
    const res = await request(makeApp()).get("/api/estoque-pontual/itens");
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/routes/estoquePontual.test.ts`
Expected: FAIL — `Cannot find module './estoquePontual'`

- [ ] **Step 3: Write the implementation**

Create `server/routes/estoquePontual.ts`:

```ts
import type { Express } from "express";
import { sql } from "drizzle-orm";
import { groupAging } from "./estoquePontual.helpers";

// Estoque = pontual vendido, não entregue, não cancelado.
const ESTOQUE_WHERE = sql`valorp > 0 AND status NOT IN ('entregue','cancelado/inativo','não usar')`;

export function registerEstoquePontualRoutes(app: Express, db: any) {
  // KPIs do estoque atual
  app.get("/api/estoque-pontual/overview", async (_req, res) => {
    try {
      const r = (await db.execute(sql`
        SELECT
          ROUND(SUM(valorp)::numeric, 0) AS valor_estoque,
          COUNT(*) AS qtd_itens,
          ROUND(AVG(GREATEST(CURRENT_DATE - data_criado, 0)) FILTER (WHERE data_criado IS NOT NULL), 0) AS idade_media,
          COUNT(*) FILTER (WHERE GREATEST(CURRENT_DATE - data_criado, 0) >= 90) AS qtd_envelhecidos,
          ROUND(SUM(valorp) FILTER (WHERE GREATEST(CURRENT_DATE - data_criado, 0) >= 90)::numeric, 0) AS valor_envelhecidos
        FROM "Clickup".cup_contratos
        WHERE ${ESTOQUE_WHERE}
      `)).rows[0] || {};
      res.json({
        valorEstoque: Number(r.valor_estoque) || 0,
        qtdItens: Number(r.qtd_itens) || 0,
        idadeMedia: Number(r.idade_media) || 0,
        qtdEnvelhecidos: Number(r.qtd_envelhecidos) || 0,
        valorEnvelhecidos: Number(r.valor_envelhecidos) || 0,
      });
    } catch (error) {
      console.error("[api] Error fetching estoque-pontual overview:", error);
      res.status(500).json({ error: "Failed to fetch overview" });
    }
  });

  // Evolução do estoque mês a mês (snapshots de cup_data_hist; último snapshot de cada mês)
  app.get("/api/estoque-pontual/evolucao", async (req, res) => {
    try {
      const meses = Math.min(Math.max(parseInt(req.query.meses as string) || 8, 1), 24);
      const rows = (await db.execute(sql`
        WITH meses AS (
          SELECT generate_series(
            date_trunc('month', CURRENT_DATE) - (${meses - 1} || ' months')::interval,
            date_trunc('month', CURRENT_DATE), '1 month')::date AS m
        ),
        snap AS (
          SELECT meses.m,
            (SELECT MAX(data_snapshot) FROM "Clickup".cup_data_hist
             WHERE date_trunc('month', data_snapshot) = meses.m) AS snap_ref
          FROM meses
        )
        SELECT to_char(s.m, 'YYYY-MM') AS mes,
          COUNT(*) FILTER (WHERE ${ESTOQUE_WHERE}) AS qtd_estoque,
          ROUND(SUM(h.valorp) FILTER (WHERE ${ESTOQUE_WHERE})::numeric, 0) AS valor_estoque
        FROM snap s
        JOIN "Clickup".cup_data_hist h ON h.data_snapshot = s.snap_ref
        GROUP BY s.m
        ORDER BY s.m
      `)).rows;
      res.json({
        serie: rows.map((r: any) => ({
          mes: r.mes,
          valorEstoque: Number(r.valor_estoque) || 0,
          qtdEstoque: Number(r.qtd_estoque) || 0,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching estoque-pontual evolucao:", error);
      res.status(500).json({ error: "Failed to fetch evolucao" });
    }
  });

  // Fluxo: entradas (data_criado) x entregas (data_entrega) por mês
  app.get("/api/estoque-pontual/fluxo", async (req, res) => {
    try {
      const meses = Math.min(Math.max(parseInt(req.query.meses as string) || 8, 1), 24);
      const rows = (await db.execute(sql`
        WITH meses AS (
          SELECT generate_series(
            date_trunc('month', CURRENT_DATE) - (${meses - 1} || ' months')::interval,
            date_trunc('month', CURRENT_DATE), '1 month')::date AS m
        )
        SELECT to_char(meses.m, 'YYYY-MM') AS mes,
          (SELECT COUNT(*) FROM "Clickup".cup_contratos
           WHERE valorp > 0 AND date_trunc('month', data_criado) = meses.m) AS entradas,
          (SELECT ROUND(COALESCE(SUM(valorp),0)::numeric,0) FROM "Clickup".cup_contratos
           WHERE valorp > 0 AND date_trunc('month', data_criado) = meses.m) AS val_entrada,
          (SELECT COUNT(*) FROM "Clickup".cup_contratos
           WHERE valorp > 0 AND date_trunc('month', data_entrega) = meses.m) AS entregas,
          (SELECT ROUND(COALESCE(SUM(valorp),0)::numeric,0) FROM "Clickup".cup_contratos
           WHERE valorp > 0 AND date_trunc('month', data_entrega) = meses.m) AS val_entregue
        FROM meses
        ORDER BY meses.m
      `)).rows;
      res.json({
        serie: rows.map((r: any) => ({
          mes: r.mes,
          entradas: Number(r.entradas) || 0,
          valEntrada: Number(r.val_entrada) || 0,
          entregas: Number(r.entregas) || 0,
          valEntregue: Number(r.val_entregue) || 0,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching estoque-pontual fluxo:", error);
      res.status(500).json({ error: "Failed to fetch fluxo" });
    }
  });

  // Distribuição por produto
  app.get("/api/estoque-pontual/por-produto", async (_req, res) => {
    try {
      const rows = (await db.execute(sql`
        SELECT COALESCE(NULLIF(produto, ''), '(sem produto)') AS produto,
          COUNT(*) AS qtd,
          ROUND(SUM(valorp)::numeric, 0) AS valor,
          ROUND(AVG(GREATEST(CURRENT_DATE - data_criado, 0)) FILTER (WHERE data_criado IS NOT NULL), 0) AS idade_media
        FROM "Clickup".cup_contratos
        WHERE ${ESTOQUE_WHERE}
        GROUP BY COALESCE(NULLIF(produto, ''), '(sem produto)')
        ORDER BY valor DESC NULLS LAST
      `)).rows;
      res.json({
        produtos: rows.map((r: any) => ({
          produto: r.produto,
          qtd: Number(r.qtd) || 0,
          valor: Number(r.valor) || 0,
          idadeMedia: Number(r.idade_media) || 0,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching estoque-pontual por-produto:", error);
      res.status(500).json({ error: "Failed to fetch por-produto" });
    }
  });

  // Distribuição por squad
  app.get("/api/estoque-pontual/por-squad", async (_req, res) => {
    try {
      const rows = (await db.execute(sql`
        SELECT COALESCE(NULLIF(squad, ''), '(sem squad)') AS squad,
          COUNT(*) AS qtd,
          ROUND(SUM(valorp)::numeric, 0) AS valor,
          ROUND(AVG(GREATEST(CURRENT_DATE - data_criado, 0)) FILTER (WHERE data_criado IS NOT NULL), 0) AS idade_media
        FROM "Clickup".cup_contratos
        WHERE ${ESTOQUE_WHERE}
        GROUP BY COALESCE(NULLIF(squad, ''), '(sem squad)')
        ORDER BY valor DESC NULLS LAST
      `)).rows;
      res.json({
        squads: rows.map((r: any) => ({
          squad: r.squad,
          qtd: Number(r.qtd) || 0,
          valor: Number(r.valor) || 0,
          idadeMedia: Number(r.idade_media) || 0,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching estoque-pontual por-squad:", error);
      res.status(500).json({ error: "Failed to fetch por-squad" });
    }
  });

  // Aging: agrupado no JS via helper (DRY com o helper testado)
  app.get("/api/estoque-pontual/aging", async (_req, res) => {
    try {
      const rows = (await db.execute(sql`
        SELECT GREATEST(CURRENT_DATE - data_criado, 0) AS idade_dias, valorp AS valor
        FROM "Clickup".cup_contratos
        WHERE ${ESTOQUE_WHERE} AND data_criado IS NOT NULL
      `)).rows;
      const buckets = groupAging(
        rows.map((r: any) => ({ idadeDias: Number(r.idade_dias) || 0, valor: Number(r.valor) || 0 })),
      );
      res.json({ buckets });
    } catch (error) {
      console.error("[api] Error fetching estoque-pontual aging:", error);
      res.status(500).json({ error: "Failed to fetch aging" });
    }
  });

  // Tabela de gestão: itens em aberto, paginada, ordenada por idade DESC
  app.get("/api/estoque-pontual/itens", async (req, res) => {
    try {
      const produto = (req.query.produto as string) || undefined;
      const squad = (req.query.squad as string) || undefined;
      const page = Math.max(parseInt(req.query.page as string) || 1, 1);
      const pageSize = 50;
      const offset = (page - 1) * pageSize;

      const whereExtra = sql`
        ${produto ? sql`AND c.produto = ${produto}` : sql``}
        ${squad ? sql`AND c.squad = ${squad}` : sql``}`;

      const totalRes = await db.execute(sql`
        SELECT COUNT(*) AS total
        FROM "Clickup".cup_contratos c
        WHERE c.valorp > 0
          AND c.status NOT IN ('entregue','cancelado/inativo','não usar')
          ${whereExtra}`);

      const rows = (await db.execute(sql`
        SELECT c.id_subtask, cl.nome AS nome_cliente, c.produto, c.squad,
          COALESCE(NULLIF(c.responsavel, ''), c.cs_responsavel) AS responsavel,
          ROUND(c.valorp::numeric, 0) AS valor,
          GREATEST(CURRENT_DATE - c.data_criado, 0) AS idade_dias,
          c.status
        FROM "Clickup".cup_contratos c
        LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = c.id_task
        WHERE c.valorp > 0
          AND c.status NOT IN ('entregue','cancelado/inativo','não usar')
          ${whereExtra}
        ORDER BY GREATEST(CURRENT_DATE - c.data_criado, 0) DESC NULLS LAST
        LIMIT ${pageSize} OFFSET ${offset}`)).rows;

      res.json({
        total: Number(totalRes.rows[0]?.total) || 0,
        page,
        pageSize,
        itens: rows.map((r: any) => ({
          idSubtask: r.id_subtask,
          nomeCliente: r.nome_cliente,
          produto: r.produto,
          squad: r.squad,
          responsavel: r.responsavel,
          valor: Number(r.valor) || 0,
          idadeDias: Number(r.idade_dias) || 0,
          status: r.status,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching estoque-pontual itens:", error);
      res.status(500).json({ error: "Failed to fetch itens" });
    }
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/routes/estoquePontual.test.ts`
Expected: PASS (7 suites, 9 tests)

- [ ] **Step 5: Register routes in `server/routes.ts`**

Add the import next to the other route-module imports (near line 68, after `import { registerLtLtvChurnRoutes } from "./routes/ltLtvChurn";`):

```ts
import { registerEstoquePontualRoutes } from "./routes/estoquePontual";
```

Add the registration next to the other registrations (near line 8146, after `registerLtLtvChurnRoutes(app, db);`):

```ts
  registerEstoquePontualRoutes(app, db);
```

- [ ] **Step 6: Typecheck and commit**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i estoque || echo "no estoque type errors"`
Expected: `no estoque type errors`

```bash
git add server/routes/estoquePontual.ts server/routes/estoquePontual.test.ts server/routes.ts
git commit -m "feat(estoque): endpoints da API de estoque de pontual"
```

---

## Task 3: Tipos e utils do frontend

**Files:**
- Create: `client/src/components/estoque-pontual/types.ts`
- Create: `client/src/components/estoque-pontual/utils.ts`

- [ ] **Step 1: Create `client/src/components/estoque-pontual/types.ts`**

```ts
export interface EstoqueOverview {
  valorEstoque: number;
  qtdItens: number;
  idadeMedia: number;
  qtdEnvelhecidos: number;
  valorEnvelhecidos: number;
}

export interface EvolucaoPonto {
  mes: string;
  valorEstoque: number;
  qtdEstoque: number;
}

export interface FluxoPonto {
  mes: string;
  entradas: number;
  valEntrada: number;
  entregas: number;
  valEntregue: number;
}

export interface DistRow {
  chave: string;
  qtd: number;
  valor: number;
  idadeMedia: number;
}

export interface AgingBucket {
  faixa: string;
  qtd: number;
  valor: number;
}

export interface EstoqueItem {
  idSubtask: string;
  nomeCliente: string | null;
  produto: string | null;
  squad: string | null;
  responsavel: string | null;
  valor: number;
  idadeDias: number;
  status: string;
}
```

- [ ] **Step 2: Create `client/src/components/estoque-pontual/utils.ts`**

```ts
export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erro ao buscar ${url}`);
  return res.json();
}

export function buildUrl(base: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") search.set(k, v);
  });
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/estoque-pontual/types.ts client/src/components/estoque-pontual/utils.ts
git commit -m "feat(estoque): tipos e utils do frontend"
```

---

## Task 4: Cards de KPI (OverviewCards)

**Files:**
- Create: `client/src/components/estoque-pontual/OverviewCards.tsx`

- [ ] **Step 1: Create `client/src/components/estoque-pontual/OverviewCards.tsx`**

```tsx
import type { ElementType } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Boxes, Clock, AlertTriangle } from "lucide-react";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { EstoqueOverview } from "./types";

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: ElementType;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-zinc-400">{label}</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
          {sub && <p className="text-xs text-gray-400 dark:text-zinc-500">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function OverviewCards({ data }: { data: EstoqueOverview }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi
        icon={Package}
        label="Valor em estoque"
        value={formatCurrencyNoDecimals(data.valorEstoque)}
      />
      <Kpi icon={Boxes} label="Itens em aberto" value={String(data.qtdItens)} />
      <Kpi icon={Clock} label="Idade média" value={`${data.idadeMedia} d`} />
      <Kpi
        icon={AlertTriangle}
        label="Envelhecidos (90+ d)"
        value={String(data.qtdEnvelhecidos)}
        sub={formatCurrencyNoDecimals(data.valorEnvelhecidos)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "estoque-pontual/OverviewCards" || echo "ok"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add client/src/components/estoque-pontual/OverviewCards.tsx
git commit -m "feat(estoque): cards de KPI"
```

---

## Task 5: Diagnóstico — EvolucaoEstoque + FluxoMensal

**Files:**
- Create: `client/src/components/estoque-pontual/EvolucaoEstoque.tsx`
- Create: `client/src/components/estoque-pontual/FluxoMensal.tsx`

- [ ] **Step 1: Create `client/src/components/estoque-pontual/EvolucaoEstoque.tsx`**

```tsx
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { fetchJson } from "./utils";
import type { EvolucaoPonto } from "./types";

export function EvolucaoEstoque() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";

  const { data, isLoading } = useQuery({
    queryKey: ["/api/estoque-pontual/evolucao"],
    queryFn: () => fetchJson<{ serie: EvolucaoPonto[] }>("/api/estoque-pontual/evolucao?meses=8"),
  });

  if (isLoading || !data) {
    return <div className="h-72 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />;
  }

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <CardTitle className="text-base">Evolução do estoque</CardTitle>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Valor em estoque por mês (snapshots de cup_data_hist)
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.serie} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="mes" tick={{ fill: axis, fontSize: 11 }} />
            <YAxis
              tick={{ fill: axis, fontSize: 11 }}
              tickFormatter={(v) => formatCurrencyNoDecimals(v)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#18181b" : "#ffffff",
                border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
                borderRadius: 8,
                color: isDark ? "#f4f4f5" : "#111827",
              }}
              formatter={(v: number) => formatCurrencyNoDecimals(v)}
            />
            <Line
              dataKey="valorEstoque"
              stroke="#0ea5e9"
              strokeWidth={2}
              dot={{ r: 3 }}
              type="monotone"
              name="Valor em estoque"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create `client/src/components/estoque-pontual/FluxoMensal.tsx`**

```tsx
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { fetchJson } from "./utils";
import type { FluxoPonto } from "./types";

export function FluxoMensal() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";

  const { data, isLoading } = useQuery({
    queryKey: ["/api/estoque-pontual/fluxo"],
    queryFn: () => fetchJson<{ serie: FluxoPonto[] }>("/api/estoque-pontual/fluxo?meses=8"),
  });

  if (isLoading || !data) {
    return <div className="h-72 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />;
  }

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <CardTitle className="text-base">Fluxo mensal: vendas × entregas</CardTitle>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Entradas (pontuais criados) e entregas (data de entrega) por mês — quantidade
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.serie} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="mes" tick={{ fill: axis, fontSize: 11 }} />
            <YAxis tick={{ fill: axis, fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#18181b" : "#ffffff",
                border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
                borderRadius: 8,
                color: isDark ? "#f4f4f5" : "#111827",
              }}
            />
            <Legend />
            <Bar dataKey="entradas" fill="#6366f1" name="Vendas (entradas)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="entregas" fill="#10b981" name="Entregas" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "estoque-pontual/(EvolucaoEstoque|FluxoMensal)" || echo "ok"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add client/src/components/estoque-pontual/EvolucaoEstoque.tsx client/src/components/estoque-pontual/FluxoMensal.tsx
git commit -m "feat(estoque): graficos de evolucao e fluxo (diagnostico)"
```

---

## Task 6: Distribuição — DistribuicaoTabela + AgingChart

**Files:**
- Create: `client/src/components/estoque-pontual/DistribuicaoTabela.tsx`
- Create: `client/src/components/estoque-pontual/AgingChart.tsx`

- [ ] **Step 1: Create `client/src/components/estoque-pontual/DistribuicaoTabela.tsx`**

Componente genérico reutilizado para "por produto" e "por squad". Recebe a lista já normalizada (`DistRow` com campo `chave`).

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { DistRow } from "./types";

export function DistribuicaoTabela({
  titulo,
  colChave,
  itens,
}: {
  titulo: string;
  colChave: string;
  itens: DistRow[];
}) {
  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{colChave}</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Idade média</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">
                    Sem itens
                  </TableCell>
                </TableRow>
              )}
              {itens.map((r) => (
                <TableRow key={r.chave}>
                  <TableCell className="font-medium">{r.chave}</TableCell>
                  <TableCell className="text-right">{r.qtd}</TableCell>
                  <TableCell className="text-right">{formatCurrencyNoDecimals(r.valor)}</TableCell>
                  <TableCell className="text-right">{r.idadeMedia} d</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create `client/src/components/estoque-pontual/AgingChart.tsx`**

```tsx
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { fetchJson } from "./utils";
import type { AgingBucket } from "./types";

export function AgingChart() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";

  const { data, isLoading } = useQuery({
    queryKey: ["/api/estoque-pontual/aging"],
    queryFn: () => fetchJson<{ buckets: AgingBucket[] }>("/api/estoque-pontual/aging"),
  });

  if (isLoading || !data) {
    return <div className="h-72 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />;
  }

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <CardTitle className="text-base">Aging do estoque</CardTitle>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Valor parado por faixa de idade
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.buckets} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="faixa" tick={{ fill: axis, fontSize: 11 }} />
            <YAxis
              tick={{ fill: axis, fontSize: 11 }}
              tickFormatter={(v) => formatCurrencyNoDecimals(v)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#18181b" : "#ffffff",
                border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
                borderRadius: 8,
                color: isDark ? "#f4f4f5" : "#111827",
              }}
              formatter={(v: number) => formatCurrencyNoDecimals(v)}
            />
            <Bar dataKey="valor" fill="#f59e0b" name="Valor" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "estoque-pontual/(DistribuicaoTabela|AgingChart)" || echo "ok"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add client/src/components/estoque-pontual/DistribuicaoTabela.tsx client/src/components/estoque-pontual/AgingChart.tsx
git commit -m "feat(estoque): distribuicao por produto/squad e aging chart"
```

---

## Task 7: Tabela de gestão (ItensTable)

**Files:**
- Create: `client/src/components/estoque-pontual/ItensTable.tsx`

- [ ] **Step 1: Create `client/src/components/estoque-pontual/ItensTable.tsx`**

Tabela de itens em aberto com filtros de produto e squad, ordenada por idade DESC. Os dropdowns são populados pelas listas `produtos`/`squads` recebidas via props (vêm dos endpoints de distribuição, já carregados na página).

```tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { fetchJson, buildUrl } from "./utils";
import type { EstoqueItem } from "./types";

export function ItensTable({
  produtos,
  squads,
}: {
  produtos: string[];
  squads: string[];
}) {
  const [produto, setProduto] = useState<string>("todos");
  const [squad, setSquad] = useState<string>("todos");

  const produtoParam = produto === "todos" ? undefined : produto;
  const squadParam = squad === "todos" ? undefined : squad;

  const { data } = useQuery({
    queryKey: ["/api/estoque-pontual/itens", produto, squad],
    queryFn: () =>
      fetchJson<{ itens: EstoqueItem[]; total: number }>(
        buildUrl("/api/estoque-pontual/itens", { page: "1", produto: produtoParam, squad: squadParam }),
      ),
  });

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
            Itens em aberto ({data?.total ?? 0})
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Select value={produto} onValueChange={setProduto}>
              <SelectTrigger className="w-[180px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
                <SelectValue placeholder="Produto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os produtos</SelectItem>
                {produtos.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={squad} onValueChange={setSquad}>
              <SelectTrigger className="w-[170px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
                <SelectValue placeholder="Squad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os squads</SelectItem>
                {squads.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {!data ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">Carregando…</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Squad</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Idade (d)</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.itens.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">
                      Nenhum item encontrado
                    </TableCell>
                  </TableRow>
                )}
                {data.itens.map((it) => (
                  <TableRow key={it.idSubtask}>
                    <TableCell className="font-medium">{it.nomeCliente ?? "—"}</TableCell>
                    <TableCell>{it.produto ?? "—"}</TableCell>
                    <TableCell>{it.squad ?? "—"}</TableCell>
                    <TableCell>{it.responsavel ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrencyNoDecimals(it.valor)}</TableCell>
                    <TableCell className="text-right">
                      {it.idadeDias >= 90 ? (
                        <Badge variant="destructive">{it.idadeDias}</Badge>
                      ) : (
                        it.idadeDias
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{it.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data.total > data.itens.length && (
              <p className="pt-3 text-center text-xs text-gray-400 dark:text-zinc-500">
                Mostrando os {data.itens.length} itens mais antigos de {data.total}.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "estoque-pontual/ItensTable" || echo "ok"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add client/src/components/estoque-pontual/ItensTable.tsx
git commit -m "feat(estoque): tabela de gestao de itens em aberto"
```

---

## Task 8: Página EstoquePontual

**Files:**
- Create: `client/src/pages/EstoquePontual.tsx`

A página carrega overview + por-produto + por-squad e monta as 4 seções. As listas de produtos/squads servem tanto para as tabelas de distribuição quanto para alimentar os filtros da `ItensTable`.

- [ ] **Step 1: Create `client/src/pages/EstoquePontual.tsx`**

```tsx
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { OverviewCards } from "@/components/estoque-pontual/OverviewCards";
import { EvolucaoEstoque } from "@/components/estoque-pontual/EvolucaoEstoque";
import { FluxoMensal } from "@/components/estoque-pontual/FluxoMensal";
import { DistribuicaoTabela } from "@/components/estoque-pontual/DistribuicaoTabela";
import { AgingChart } from "@/components/estoque-pontual/AgingChart";
import { ItensTable } from "@/components/estoque-pontual/ItensTable";
import { fetchJson } from "@/components/estoque-pontual/utils";
import type { EstoqueOverview, DistRow } from "@/components/estoque-pontual/types";

export default function EstoquePontual() {
  useSetPageInfo("Estoque de Pontual", "Gestão e diagnóstico do estoque de produtos pontuais");

  const { data: overview } = useQuery({
    queryKey: ["/api/estoque-pontual/overview"],
    queryFn: () => fetchJson<EstoqueOverview>("/api/estoque-pontual/overview"),
  });

  const { data: porProduto } = useQuery({
    queryKey: ["/api/estoque-pontual/por-produto"],
    queryFn: () =>
      fetchJson<{ produtos: { produto: string; qtd: number; valor: number; idadeMedia: number }[] }>(
        "/api/estoque-pontual/por-produto",
      ),
  });

  const { data: porSquad } = useQuery({
    queryKey: ["/api/estoque-pontual/por-squad"],
    queryFn: () =>
      fetchJson<{ squads: { squad: string; qtd: number; valor: number; idadeMedia: number }[] }>(
        "/api/estoque-pontual/por-squad",
      ),
  });

  const produtosRows: DistRow[] =
    porProduto?.produtos.map((p) => ({ chave: p.produto, qtd: p.qtd, valor: p.valor, idadeMedia: p.idadeMedia })) ?? [];
  const squadsRows: DistRow[] =
    porSquad?.squads.map((s) => ({ chave: s.squad, qtd: s.qtd, valor: s.valor, idadeMedia: s.idadeMedia })) ?? [];

  const produtosFiltro = produtosRows.map((r) => r.chave).filter((c) => c !== "(sem produto)");
  const squadsFiltro = squadsRows.map((r) => r.chave).filter((c) => c !== "(sem squad)");

  return (
    <div className="space-y-6 p-4 md:p-6">
      {!overview ? (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
      ) : (
        <OverviewCards data={overview} />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <EvolucaoEstoque />
        <FluxoMensal />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DistribuicaoTabela titulo="Por produto" colChave="Produto" itens={produtosRows} />
        <DistribuicaoTabela titulo="Por squad" colChave="Squad" itens={squadsRows} />
      </div>

      <AgingChart />

      <ItensTable produtos={produtosFiltro} squads={squadsFiltro} />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "pages/EstoquePontual" || echo "ok"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/EstoquePontual.tsx
git commit -m "feat(estoque): pagina EstoquePontual montando as 4 secoes"
```

---

## Task 9: Wire-up de navegação (rota + menu + ícone)

**Files:**
- Modify: `client/src/App.tsx` (lazy import ~linha 164; route ~linha 318)
- Modify: `shared/nav-config.ts` (permission key ~linha 51; route map ~linha 239; nav item ~linha 468; label ~linha 700)
- Modify: `client/src/components/app-sidebar.tsx` (import + ICONS map, linhas 3-10 e 43-50)

- [ ] **Step 1: Add lazy import in `client/src/App.tsx`**

After the line `const LtvClientes = lazyWithRetry(() => import("@/pages/LtvClientes"));` (line 164), add:

```tsx
const EstoquePontual = lazyWithRetry(() => import("@/pages/EstoquePontual"));
```

- [ ] **Step 2: Add the route in `client/src/App.tsx`**

After the line `<Route path="/ltv-clientes">{() => <ProtectedRoute path="/ltv-clientes" component={LtvClientes} />}</Route>` (line 318), add:

```tsx
      <Route path="/estoque-pontual">{() => <ProtectedRoute path="/estoque-pontual" component={EstoquePontual} />}</Route>
```

- [ ] **Step 3: Add the permission key in `shared/nav-config.ts`**

In the `GESTAO` block, after `LTV_CLIENTES: 'gestao.ltv_clientes',` (line 51), add:

```ts
    ESTOQUE_PONTUAL: 'gestao.estoque_pontual',
```

- [ ] **Step 4: Add the route→permission mapping in `shared/nav-config.ts`**

After `'/ltv-clientes': PERMISSION_KEYS.GESTAO.LTV_CLIENTES,` (line 239), add:

```ts
  '/estoque-pontual': PERMISSION_KEYS.GESTAO.ESTOQUE_PONTUAL,
```

- [ ] **Step 5: Add the nav item in `shared/nav-config.ts`**

In the Gestão `items` array, after `{ title: 'LTV por Cliente', url: '/ltv-clientes', icon: 'Users', permissionKey: PERMISSION_KEYS.GESTAO.LTV_CLIENTES },` (line 468), add:

```ts
        { title: 'Estoque de Pontual', url: '/estoque-pontual', icon: 'Package', permissionKey: PERMISSION_KEYS.GESTAO.ESTOQUE_PONTUAL },
```

- [ ] **Step 6: Add the permission label in `shared/nav-config.ts`**

In `PERMISSION_LABELS`, after `[PERMISSION_KEYS.GESTAO.LTV_CLIENTES]: 'LTV por Cliente',` (line 700), add:

```ts
  [PERMISSION_KEYS.GESTAO.ESTOQUE_PONTUAL]: 'Estoque de Pontual',
```

- [ ] **Step 7: Register the `Package` icon in `client/src/components/app-sidebar.tsx`**

Add `Package` to the lucide-react import (line 9, after `Star, Gauge, Bot, Link2`):

```tsx
  Star, Gauge, Bot, Link2, Package
```

Add `Package` to the `ICONS` map (line 49, after `Sliders, Bell, Lightbulb, Megaphone, Ticket, Gauge, Bot, Link2,`):

```tsx
  Sliders, Bell, Lightbulb, Megaphone, Ticket, Gauge, Bot, Link2, Package,
```

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "App.tsx|nav-config|app-sidebar" || echo "ok"`
Expected: `ok`

- [ ] **Step 9: Commit**

```bash
git add client/src/App.tsx shared/nav-config.ts client/src/components/app-sidebar.tsx
git commit -m "feat(estoque): rota, item de menu e icone no sidebar"
```

---

## Task 10: Validação E2E (build + smoke test no browser)

**Files:** none (validation only)

- [ ] **Step 1: Run the full test suite for the new module**

Run: `npx vitest run server/routes/estoquePontual.helpers.test.ts server/routes/estoquePontual.test.ts`
Expected: PASS (all tests green)

- [ ] **Step 2: Typecheck the whole project**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | tail -20`
Expected: no errors referencing `estoque-pontual`, `EstoquePontual`, `nav-config`, or `app-sidebar`

- [ ] **Step 3: Restart the dev server and smoke-test the endpoints**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; sleep 1
ENABLE_DEV_LOGIN=true npm run dev &
sleep 6
# Authenticate (dev login) and capture cookie
curl -s -c /tmp/estoque-cookie.txt -X POST http://localhost:3000/auth/dev-login >/dev/null
echo "--- overview ---"
curl -s -b /tmp/estoque-cookie.txt http://localhost:3000/api/estoque-pontual/overview
echo ""
echo "--- evolucao ---"
curl -s -b /tmp/estoque-cookie.txt "http://localhost:3000/api/estoque-pontual/evolucao?meses=8"
echo ""
echo "--- fluxo ---"
curl -s -b /tmp/estoque-cookie.txt "http://localhost:3000/api/estoque-pontual/fluxo?meses=8"
echo ""
echo "--- aging ---"
curl -s -b /tmp/estoque-cookie.txt http://localhost:3000/api/estoque-pontual/aging
echo ""
echo "--- itens ---"
curl -s -b /tmp/estoque-cookie.txt "http://localhost:3000/api/estoque-pontual/itens" | head -c 600
```

Expected (sanity vs. produção 2026-06-02):
- `/overview`: `valorEstoque` ≈ 1.870.000, `qtdItens` ≈ 244, `idadeMedia` ≈ 52
- `/evolucao`: série de ~8 meses, com salto de ~1,16M (mar) para ~1,93M (abr)
- `/fluxo`: março com `entradas` ≈ 139 (pico), maio com `entregas` ≈ 87
- `/aging`: 5 buckets na ordem fixa
- `/itens`: `total` ≈ 244, primeiro item com a maior `idadeDias`

> ⚠️ Se o servidor local usar o banco `cortex_dev` (local), os números podem diferir dos de produção. O importante é que os endpoints respondam 200 com shape correto. Para conferir os números de produção, valide via psql conforme as queries do plano.

- [ ] **Step 4: Visual check no browser (dark + light)**

Abrir `http://localhost:3000/estoque-pontual`. Verificar:
- 4 cards de KPI no topo
- Evolução (linha) + Fluxo (barras agrupadas) lado a lado
- Tabelas "Por produto" e "Por squad" lado a lado
- Aging chart (barras)
- Tabela de itens com filtros de produto e squad funcionando; itens 90+ dias com badge vermelho
- Alternar tema (botão de tema): todos os componentes legíveis em dark E light
- Item de menu "Estoque de Pontual" aparece no grupo Gestão com ícone de pacote

- [ ] **Step 5: Stop the dev server**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; echo "dev server parado"
```

- [ ] **Step 6: Final commit (se algum ajuste foi necessário durante a validação)**

```bash
git add -A
git commit -m "chore(estoque): ajustes da validacao E2E" || echo "nada a commitar"
```

---

## Self-Review

**1. Spec coverage:**
- Objetivo gestão operacional → Task 7 (ItensTable) ✓
- Objetivo diagnóstico → Task 5 (Evolução + Fluxo) ✓
- Definição de estoque → `ESTOQUE_WHERE` em Task 2 ✓
- Endpoints overview/evolucao/fluxo/por-produto/por-squad/aging/itens → Task 2 ✓
- 4 seções da página (KPIs, diagnóstico, distribuição, tabela) → Task 8 ✓
- Aging (0-30/30-90/90-180/180-365/+365) → Task 1 + Task 6 ✓
- Item de menu no grupo Gestão → Task 9 ✓
- Edge cases (idade negativa→0, squad/produto NULL→"(sem ...)") → `GREATEST(...,0)` e `COALESCE(NULLIF(...))` em Task 2 ✓
- Faseamento v1 → este plano cobre o v1 (cards + evolução + fluxo + por produto + por squad + tabela). v2 (SLA, drill por responsável, export CSV) fica fora, conforme spec. Aging chart está incluído (v1 leve, já que o helper é trivial).

**2. Placeholder scan:** Nenhum "TBD"/"implementar depois"; todo SQL e JSX está completo. ✓

**3. Type consistency:**
- `ESTOQUE_WHERE` usado consistentemente; status list idêntica em todos os endpoints (`'entregue','cancelado/inativo','não usar'`).
- `DistRow` (`chave/qtd/valor/idadeMedia`) consistente entre types.ts, DistribuicaoTabela e a página.
- Endpoints retornam `produtos`/`squads` com campo de domínio (`produto`/`squad`); a página mapeia para `DistRow.chave`. ✓
- `EstoqueItem` casa com o retorno de `/itens`. ✓
- Funções do helper: `agingBucket`, `groupAging`, `AGING_FAIXAS` — mesmos nomes em helpers, teste e endpoint `/aging`. ✓

**Nota de design:** o endpoint `/aging` busca idade+valor e agrupa em JS via `groupAging` (helper testado), em vez de `CASE` no SQL, para manter a lógica de faixas DRY e testável. São ~244 linhas, custo trivial.
