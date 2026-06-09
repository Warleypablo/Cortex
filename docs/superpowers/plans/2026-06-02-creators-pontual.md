# Creators Pontual — Implementation Plan (v1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a página `/creators-pontual` (grupo Gestão) que diagnostica o crescimento do estoque de Creators pontual cruzando vendas (entrada), produtividade do operador (saída) e o gargalo de triagem.

**Architecture:** Backend Express/Drizzle (`registerCreatorsPontualRoutes(app, db)`) lê `"Clickup".cup_contratos` (vendas, entregas, operador) + `cup_data_hist` (evolução) + `cup_clientes` (nome). Frontend React + Recharts + React Query, módulo isolado `client/src/components/creators-pontual/`, página `client/src/pages/CreatorsPontual.tsx`, wire-up em `App.tsx` + `shared/nav-config.ts` + `app-sidebar.tsx`. Espelha o módulo `estoque-pontual`.

**Tech Stack:** TypeScript, Express, Drizzle (`db.execute(sql\`...\`)`), Vitest + supertest, React, wouter, @tanstack/react-query, Recharts, Tailwind (dark/light via `useTheme`).

**Spec:** `docs/superpowers/specs/2026-06-02-creators-pontual-design.md`

**Filtros canônicos (validados em produção 2026-06-02):**
```
CREATORS (vendas/histórico):  produto ILIKE '%creators%' AND valorp > 0
ESTOQUE (em aberto):          + AND status NOT IN ('entregue','cancelado/inativo','não usar')
```
Estoque atual: 147 itens / R$ 1.000.925 · ticket R$ 6.809 · triagem 54,4% (R$ 544.458).

**Higienização obrigatória:** `TRIM()` em `vendedor` e `responsavel` (trailing spaces). Série histórica em `cup_data_hist` via `ILIKE '%creator%'` (capta compostos antigos). Operador = `responsavel` (NÃO `cs_responsavel`). Nome do cliente: `LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = c.id_task`. Ciclo de entrega exclui `data_entrega < data_criado`.

---

## File Structure

**Backend:**
- Create: `server/routes/creatorsPontual.ts` — `registerCreatorsPontualRoutes(app, db)`, 8 endpoints
- Create: `server/routes/creatorsPontual.test.ts`
- Modify: `server/routes.ts` — import (~linha 69) + registro (~linha 8149, após `registerEstoquePontualRoutes(app, db);`)

**Frontend:**
- Create: `client/src/components/creators-pontual/{types.ts,utils.ts,OverviewCards.tsx,EntradaSaida.tsx,EvolucaoCreators.tsx,FunilStatus.tsx,ProdutividadeOperadores.tsx,VendedoresRanking.tsx,VendasMensal.tsx,ItensTable.tsx}`
- Create: `client/src/pages/CreatorsPontual.tsx`
- Modify: `client/src/App.tsx` — lazy import + route
- Modify: `shared/nav-config.ts` — permission key, route map, nav item, label
- Modify: `client/src/components/app-sidebar.tsx` — ícone `Clapperboard`
- Modify: `client/src/components/estoque-pontual/DistribuicaoTabela.tsx` + `client/src/pages/EstoquePontual.tsx` — link cruzado da linha "Creators" → `/creators-pontual`

---

## Task 1: Backend — módulo creatorsPontual (8 endpoints, TDD)

**Files:**
- Create: `server/routes/creatorsPontual.ts`
- Test: `server/routes/creatorsPontual.test.ts`
- Modify: `server/routes.ts`

Endpoints (sob `/api/creators-pontual`):
`/overview`, `/funil`, `/fluxo`, `/evolucao`, `/operadores`, `/vendedores`, `/vendas-mensal`, `/itens`.

- [ ] **Step 1: Write the failing test**

Create `server/routes/creatorsPontual.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const mockExecute = vi.fn();
vi.mock("../db", () => ({ db: { execute: mockExecute } }));

import { registerCreatorsPontualRoutes } from "./creatorsPontual";

function makeApp() {
  const app = express();
  app.use((req, _res, next) => { (req as any).user = { email: "t@t.com" }; next(); });
  registerCreatorsPontualRoutes(app, { execute: mockExecute } as any);
  return app;
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/creators-pontual/overview", () => {
  it("retorna KPIs incl. triagem", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ valor_estoque: 1000925, qtd_itens: 147, ticket_medio: 6809,
        idade_media: 51, valor_triagem: 544458, pct_triagem: 54.4 }],
    });
    const res = await request(makeApp()).get("/api/creators-pontual/overview");
    expect(res.status).toBe(200);
    expect(res.body.valorEstoque).toBe(1000925);
    expect(res.body.pctTriagem).toBe(54.4);
    expect(res.body.valorTriagem).toBe(544458);
  });

  it("retorna 500 em erro de banco", async () => {
    mockExecute.mockRejectedValueOnce(new Error("db down"));
    const res = await request(makeApp()).get("/api/creators-pontual/overview");
    expect(res.status).toBe(500);
  });
});

describe("GET /api/creators-pontual/funil", () => {
  it("retorna status por valor", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ status: "triagem", qtd: 78, valor: 544458 },
             { status: "ativo", qtd: 50, valor: 334263 }],
    });
    const res = await request(makeApp()).get("/api/creators-pontual/funil");
    expect(res.status).toBe(200);
    expect(res.body.status[0]).toEqual({ status: "triagem", qtd: 78, valor: 544458 });
  });
});

describe("GET /api/creators-pontual/fluxo", () => {
  it("retorna entradas e entregas mensais", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ mes: "2026-03", entradas: 109, val_entrada: 703000, entregas: 27, val_entregue: 180000 }],
    });
    const res = await request(makeApp()).get("/api/creators-pontual/fluxo?meses=1");
    expect(res.status).toBe(200);
    expect(res.body.serie[0].entradas).toBe(109);
    expect(res.body.serie[0].entregas).toBe(27);
  });
});

describe("GET /api/creators-pontual/evolucao", () => {
  it("retorna serie historica do estoque", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ mes: "2026-04", valor_estoque: 761052, qtd_estoque: 118 },
             { mes: "2026-05", valor_estoque: 924912, qtd_estoque: 143 }],
    });
    const res = await request(makeApp()).get("/api/creators-pontual/evolucao?meses=2");
    expect(res.status).toBe(200);
    expect(res.body.serie[1].valorEstoque).toBe(924912);
  });
});

describe("GET /api/creators-pontual/operadores", () => {
  it("retorna produtividade por operador", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ operador: "Mariana Dalto", aberto: 35, val_aberto: 222946,
        entregue: 21, ciclo_medio_dias: 52, idade_backlog_dias: 48 }],
    });
    const res = await request(makeApp()).get("/api/creators-pontual/operadores");
    expect(res.status).toBe(200);
    expect(res.body.operadores[0].operador).toBe("Mariana Dalto");
    expect(res.body.operadores[0].cicloMedioDias).toBe(52);
  });
});

describe("GET /api/creators-pontual/vendedores", () => {
  it("retorna ranking + semVendedor", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ vendedor: "Fabio Richard", qtd: 120, valor: 842395 }],
    });
    mockExecute.mockResolvedValueOnce({ rows: [{ qtd: 100, valor: 508443 }] });
    const res = await request(makeApp()).get("/api/creators-pontual/vendedores");
    expect(res.status).toBe(200);
    expect(res.body.vendedores[0].vendedor).toBe("Fabio Richard");
    expect(res.body.semVendedor).toEqual({ qtd: 100, valor: 508443 });
  });
});

describe("GET /api/creators-pontual/vendas-mensal", () => {
  it("retorna vendas por mes", async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ mes: "2026-03", qtd: 109, valor: 703000 }],
    });
    const res = await request(makeApp()).get("/api/creators-pontual/vendas-mensal?meses=1");
    expect(res.status).toBe(200);
    expect(res.body.serie[0].qtd).toBe(109);
  });
});

describe("GET /api/creators-pontual/itens", () => {
  it("retorna itens paginados com operador e vendedor", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ total: 147 }] });
    mockExecute.mockResolvedValueOnce({
      rows: [{ id_subtask: "86a92f1dr", nome_cliente: "Sopro", produto: "Creators",
        squad: "✨ Aura", operador: "Lara Grobério", vendedor: null,
        valor: 1997, idade_dias: 368, status: "pausado" }],
    });
    const res = await request(makeApp()).get("/api/creators-pontual/itens?status=triagem");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(147);
    expect(res.body.itens[0].operador).toBe("Lara Grobério");
    expect(res.body.itens[0].vendedor).toBeNull();
  });

  it("retorna 500 em erro de banco", async () => {
    mockExecute.mockRejectedValueOnce(new Error("db down"));
    const res = await request(makeApp()).get("/api/creators-pontual/itens");
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/mac0267/Cortex/.claude/worktrees/lt-ltv-churn-dashboard && npx vitest run server/routes/creatorsPontual.test.ts`
Expected: FAIL — `Cannot find module './creatorsPontual'`

- [ ] **Step 3: Write the implementation**

Create `server/routes/creatorsPontual.ts`:

```ts
import type { Express } from "express";
import { sql } from "drizzle-orm";

// Creators pontual (vendas/historico): produto Creators com valor pontual.
const CREATORS = sql`produto ILIKE '%creators%' AND valorp > 0`;
// Em estoque (nao entregue/cancelado). Mesma definicao com alias para /itens.
const ESTOQUE = sql`status NOT IN ('entregue','cancelado/inativo','não usar')`;
const CREATORS_C = sql`c.produto ILIKE '%creators%' AND c.valorp > 0`;
const ESTOQUE_C = sql`c.status NOT IN ('entregue','cancelado/inativo','não usar')`;

export function registerCreatorsPontualRoutes(app: Express, db: any) {
  // KPIs do estoque de Creators
  app.get("/api/creators-pontual/overview", async (_req, res) => {
    try {
      const r = (await db.execute(sql`
        SELECT
          ROUND(SUM(valorp)::numeric, 0) AS valor_estoque,
          COUNT(*) AS qtd_itens,
          ROUND(AVG(valorp)::numeric, 0) AS ticket_medio,
          ROUND(AVG(GREATEST(CURRENT_DATE - data_criado, 0))::numeric, 0) AS idade_media,
          ROUND(SUM(valorp) FILTER (WHERE status = 'triagem')::numeric, 0) AS valor_triagem,
          ROUND(100.0 * SUM(valorp) FILTER (WHERE status = 'triagem') / NULLIF(SUM(valorp), 0), 1) AS pct_triagem
        FROM "Clickup".cup_contratos
        WHERE ${CREATORS} AND ${ESTOQUE}
      `)).rows[0] || {};
      res.json({
        valorEstoque: Number(r.valor_estoque) || 0,
        qtdItens: Number(r.qtd_itens) || 0,
        ticketMedio: Number(r.ticket_medio) || 0,
        idadeMedia: Number(r.idade_media) || 0,
        valorTriagem: Number(r.valor_triagem) || 0,
        pctTriagem: Number(r.pct_triagem) || 0,
      });
    } catch (error) {
      console.error("[api] Error fetching creators-pontual overview:", error);
      res.status(500).json({ error: "Failed to fetch overview" });
    }
  });

  // Funil por status do estoque
  app.get("/api/creators-pontual/funil", async (_req, res) => {
    try {
      const rows = (await db.execute(sql`
        SELECT status, COUNT(*) AS qtd, ROUND(SUM(valorp)::numeric, 0) AS valor
        FROM "Clickup".cup_contratos
        WHERE ${CREATORS} AND ${ESTOQUE}
        GROUP BY status
        ORDER BY valor DESC NULLS LAST
      `)).rows;
      res.json({
        status: rows.map((r: any) => ({
          status: r.status, qtd: Number(r.qtd) || 0, valor: Number(r.valor) || 0,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching creators-pontual funil:", error);
      res.status(500).json({ error: "Failed to fetch funil" });
    }
  });

  // Fluxo: entradas (data_criado) x entregas (data_entrega) por mes — só Creators
  app.get("/api/creators-pontual/fluxo", async (req, res) => {
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
           WHERE ${CREATORS} AND date_trunc('month', data_criado) = meses.m) AS entradas,
          (SELECT ROUND(COALESCE(SUM(valorp),0)::numeric,0) FROM "Clickup".cup_contratos
           WHERE ${CREATORS} AND date_trunc('month', data_criado) = meses.m) AS val_entrada,
          (SELECT COUNT(*) FROM "Clickup".cup_contratos
           WHERE ${CREATORS} AND date_trunc('month', data_entrega) = meses.m) AS entregas,
          (SELECT ROUND(COALESCE(SUM(valorp),0)::numeric,0) FROM "Clickup".cup_contratos
           WHERE ${CREATORS} AND date_trunc('month', data_entrega) = meses.m) AS val_entregue
        FROM meses ORDER BY meses.m
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
      console.error("[api] Error fetching creators-pontual fluxo:", error);
      res.status(500).json({ error: "Failed to fetch fluxo" });
    }
  });

  // Evolucao do estoque (cup_data_hist, ILIKE '%creator%' capta compostos antigos)
  app.get("/api/creators-pontual/evolucao", async (req, res) => {
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
        -- INNER JOIN intencional: meses sem snapshot sao omitidos (mostrar R$0 seria enganoso)
        SELECT to_char(s.m, 'YYYY-MM') AS mes,
          COUNT(*) FILTER (WHERE h.produto ILIKE '%creator%' AND h.valorp > 0
            AND h.status NOT IN ('entregue','cancelado/inativo','não usar')) AS qtd_estoque,
          ROUND(SUM(h.valorp) FILTER (WHERE h.produto ILIKE '%creator%' AND h.valorp > 0
            AND h.status NOT IN ('entregue','cancelado/inativo','não usar'))::numeric, 0) AS valor_estoque
        FROM snap s
        JOIN "Clickup".cup_data_hist h ON h.data_snapshot = s.snap_ref
        GROUP BY s.m ORDER BY s.m
      `)).rows;
      res.json({
        serie: rows.map((r: any) => ({
          mes: r.mes,
          valorEstoque: Number(r.valor_estoque) || 0,
          qtdEstoque: Number(r.qtd_estoque) || 0,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching creators-pontual evolucao:", error);
      res.status(500).json({ error: "Failed to fetch evolucao" });
    }
  });

  // Produtividade por operador (responsavel, com trim)
  app.get("/api/creators-pontual/operadores", async (_req, res) => {
    try {
      const rows = (await db.execute(sql`
        SELECT TRIM(responsavel) AS operador,
          COUNT(*) FILTER (WHERE ${ESTOQUE}) AS aberto,
          ROUND(SUM(valorp) FILTER (WHERE ${ESTOQUE})::numeric, 0) AS val_aberto,
          COUNT(*) FILTER (WHERE status = 'entregue') AS entregue,
          ROUND(AVG((data_entrega - data_criado)) FILTER (
            WHERE status = 'entregue' AND data_entrega >= data_criado), 0) AS ciclo_medio_dias,
          ROUND(AVG(GREATEST(CURRENT_DATE - data_criado, 0)) FILTER (WHERE ${ESTOQUE}), 0) AS idade_backlog_dias
        FROM "Clickup".cup_contratos
        WHERE ${CREATORS} AND TRIM(COALESCE(responsavel, '')) <> ''
        GROUP BY TRIM(responsavel)
        ORDER BY aberto DESC NULLS LAST
      `)).rows;
      res.json({
        operadores: rows.map((r: any) => ({
          operador: r.operador,
          aberto: Number(r.aberto) || 0,
          valAberto: Number(r.val_aberto) || 0,
          entregue: Number(r.entregue) || 0,
          cicloMedioDias: r.ciclo_medio_dias != null ? Number(r.ciclo_medio_dias) : null,
          idadeBacklogDias: r.idade_backlog_dias != null ? Number(r.idade_backlog_dias) : null,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching creators-pontual operadores:", error);
      res.status(500).json({ error: "Failed to fetch operadores" });
    }
  });

  // Ranking de vendedores (vendas = todos Creators valorp>0) + agregado sem vendedor
  app.get("/api/creators-pontual/vendedores", async (_req, res) => {
    try {
      const rows = (await db.execute(sql`
        SELECT TRIM(vendedor) AS vendedor, COUNT(*) AS qtd, ROUND(SUM(valorp)::numeric, 0) AS valor
        FROM "Clickup".cup_contratos
        WHERE ${CREATORS} AND TRIM(COALESCE(vendedor, '')) <> ''
        GROUP BY TRIM(vendedor)
        ORDER BY qtd DESC
      `)).rows;
      const sem = (await db.execute(sql`
        SELECT COUNT(*) AS qtd, ROUND(SUM(valorp)::numeric, 0) AS valor
        FROM "Clickup".cup_contratos
        WHERE ${CREATORS} AND TRIM(COALESCE(vendedor, '')) = ''
      `)).rows[0] || {};
      res.json({
        vendedores: rows.map((r: any) => ({
          vendedor: r.vendedor, qtd: Number(r.qtd) || 0, valor: Number(r.valor) || 0,
        })),
        semVendedor: { qtd: Number(sem.qtd) || 0, valor: Number(sem.valor) || 0 },
      });
    } catch (error) {
      console.error("[api] Error fetching creators-pontual vendedores:", error);
      res.status(500).json({ error: "Failed to fetch vendedores" });
    }
  });

  // Vendas por mes (entrada = data_criado, todos Creators valorp>0)
  app.get("/api/creators-pontual/vendas-mensal", async (req, res) => {
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
           WHERE ${CREATORS} AND date_trunc('month', data_criado) = meses.m) AS qtd,
          (SELECT ROUND(COALESCE(SUM(valorp),0)::numeric,0) FROM "Clickup".cup_contratos
           WHERE ${CREATORS} AND date_trunc('month', data_criado) = meses.m) AS valor
        FROM meses ORDER BY meses.m
      `)).rows;
      res.json({
        serie: rows.map((r: any) => ({
          mes: r.mes, qtd: Number(r.qtd) || 0, valor: Number(r.valor) || 0,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching creators-pontual vendas-mensal:", error);
      res.status(500).json({ error: "Failed to fetch vendas-mensal" });
    }
  });

  // Tabela detalhada de itens em aberto (filtros status/operador)
  app.get("/api/creators-pontual/itens", async (req, res) => {
    try {
      const status = (req.query.status as string) || undefined;
      const operador = (req.query.operador as string) || undefined;
      const page = Math.max(parseInt(req.query.page as string) || 1, 1);
      const pageSize = 50;
      const offset = (page - 1) * pageSize;

      const whereExtra = sql`
        ${status ? sql`AND c.status = ${status}` : sql``}
        ${operador ? sql`AND TRIM(c.responsavel) = ${operador}` : sql``}`;

      const totalRes = await db.execute(sql`
        SELECT COUNT(*) AS total
        FROM "Clickup".cup_contratos c
        WHERE ${CREATORS_C} AND ${ESTOQUE_C} ${whereExtra}`);

      const rows = (await db.execute(sql`
        SELECT c.id_subtask, cl.nome AS nome_cliente, c.produto, c.squad,
          NULLIF(TRIM(COALESCE(c.responsavel, '')), '') AS operador,
          NULLIF(TRIM(COALESCE(c.vendedor, '')), '') AS vendedor,
          ROUND(c.valorp::numeric, 0) AS valor,
          GREATEST(CURRENT_DATE - c.data_criado, 0) AS idade_dias,
          c.status
        FROM "Clickup".cup_contratos c
        LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = c.id_task
        WHERE ${CREATORS_C} AND ${ESTOQUE_C} ${whereExtra}
        ORDER BY GREATEST(CURRENT_DATE - c.data_criado, 0) DESC NULLS LAST
        LIMIT ${pageSize} OFFSET ${offset}`)).rows;

      res.json({
        total: Number(totalRes.rows[0]?.total) || 0,
        page, pageSize,
        itens: rows.map((r: any) => ({
          idSubtask: r.id_subtask,
          nomeCliente: r.nome_cliente,
          produto: r.produto,
          squad: r.squad,
          operador: r.operador,
          vendedor: r.vendedor,
          valor: Number(r.valor) || 0,
          idadeDias: Number(r.idade_dias) || 0,
          status: r.status,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching creators-pontual itens:", error);
      res.status(500).json({ error: "Failed to fetch itens" });
    }
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/routes/creatorsPontual.test.ts`
Expected: PASS (8 suites, 10 tests)

- [ ] **Step 5: Register in `server/routes.ts`**

Add import after `import { registerEstoquePontualRoutes } from "./routes/estoquePontual";`:
```ts
import { registerCreatorsPontualRoutes } from "./routes/creatorsPontual";
```
Add registration after `registerEstoquePontualRoutes(app, db);`:
```ts
  registerCreatorsPontualRoutes(app, db);
```
Use Grep to find the exact lines; match the surrounding indentation.

- [ ] **Step 6: Typecheck and commit**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i creators || echo "no creators type errors"`
Expected: `no creators type errors`

```bash
git add server/routes/creatorsPontual.ts server/routes/creatorsPontual.test.ts server/routes.ts
git commit -m "feat(creators): endpoints da API de Creators pontual"
```

---

## Task 2: Frontend — tipos e utils

**Files:**
- Create: `client/src/components/creators-pontual/types.ts`
- Create: `client/src/components/creators-pontual/utils.ts`

- [ ] **Step 1: Create `client/src/components/creators-pontual/types.ts`**

```ts
export interface CreatorsOverview {
  valorEstoque: number;
  qtdItens: number;
  ticketMedio: number;
  idadeMedia: number;
  valorTriagem: number;
  pctTriagem: number;
}

export interface StatusRow {
  status: string;
  qtd: number;
  valor: number;
}

export interface FluxoPonto {
  mes: string;
  entradas: number;
  valEntrada: number;
  entregas: number;
  valEntregue: number;
}

export interface EvolucaoPonto {
  mes: string;
  valorEstoque: number;
  qtdEstoque: number;
}

export interface OperadorRow {
  operador: string;
  aberto: number;
  valAberto: number;
  entregue: number;
  cicloMedioDias: number | null;
  idadeBacklogDias: number | null;
}

export interface VendedorRow {
  vendedor: string;
  qtd: number;
  valor: number;
}

export interface VendasPonto {
  mes: string;
  qtd: number;
  valor: number;
}

export interface CreatorItem {
  idSubtask: string;
  nomeCliente: string | null;
  produto: string | null;
  squad: string | null;
  operador: string | null;
  vendedor: string | null;
  valor: number;
  idadeDias: number;
  status: string;
}
```

- [ ] **Step 2: Create `client/src/components/creators-pontual/utils.ts`**

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
git add client/src/components/creators-pontual/types.ts client/src/components/creators-pontual/utils.ts
git commit -m "feat(creators): tipos e utils do frontend"
```

---

## Task 3: OverviewCards (5 KPIs)

**Files:** Create `client/src/components/creators-pontual/OverviewCards.tsx`

- [ ] **Step 1: Create the component**

```tsx
import type { ElementType } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Boxes, Tag, Clock, AlertTriangle } from "lucide-react";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { CreatorsOverview } from "./types";

function Kpi({
  icon: Icon, label, value, sub,
}: { icon: ElementType; label: string; value: string; sub?: string }) {
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

export function OverviewCards({ data }: { data: CreatorsOverview }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Kpi icon={DollarSign} label="Valor em estoque" value={formatCurrencyNoDecimals(data.valorEstoque)} />
      <Kpi icon={Boxes} label="Itens em aberto" value={String(data.qtdItens)} />
      <Kpi icon={Tag} label="Ticket médio" value={formatCurrencyNoDecimals(data.ticketMedio)} />
      <Kpi
        icon={AlertTriangle}
        label="Parado em triagem"
        value={`${data.pctTriagem}%`}
        sub={formatCurrencyNoDecimals(data.valorTriagem)}
      />
      <Kpi icon={Clock} label="Idade média" value={`${data.idadeMedia} d`} />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "creators-pontual/OverviewCards" || echo "ok"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add client/src/components/creators-pontual/OverviewCards.tsx
git commit -m "feat(creators): cards de KPI"
```

---

## Task 4: Diagnóstico — EntradaSaida + EvolucaoCreators

**Files:**
- Create: `client/src/components/creators-pontual/EntradaSaida.tsx`
- Create: `client/src/components/creators-pontual/EvolucaoCreators.tsx`

- [ ] **Step 1: Create `client/src/components/creators-pontual/EntradaSaida.tsx`**

```tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer,
} from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { fetchJson } from "./utils";
import type { FluxoPonto } from "./types";

type Metrica = "qtd" | "valor";

export function EntradaSaida() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";
  const [metrica, setMetrica] = useState<Metrica>("valor");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/creators-pontual/fluxo"],
    queryFn: () => fetchJson<{ serie: FluxoPonto[] }>("/api/creators-pontual/fluxo?meses=8"),
  });

  if (isLoading || !data) {
    return <div className="h-72 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />;
  }

  const isValor = metrica === "valor";
  const fmt = (v: number) => (isValor ? formatCurrencyNoDecimals(v) : String(v));
  const chartData = data.serie.map((p) => ({
    mes: p.mes,
    entradas: isValor ? p.valEntrada : p.entradas,
    entregas: isValor ? p.valEntregue : p.entregas,
    saldo: isValor ? p.valEntrada - p.valEntregue : p.entradas - p.entregas,
  }));

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Entrada × saída (vendas × entregas)</CardTitle>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Vendas (entradas) e entregas por mês · linha = saldo (Δ estoque). Série afetada por retagueamento em jan/2026.
            </p>
          </div>
          <Select value={metrica} onValueChange={(v) => setMetrica(v as Metrica)}>
            <SelectTrigger className="w-[150px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="valor">Valor (R$)</SelectItem>
              <SelectItem value="qtd">Quantidade</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="mes" tick={{ fill: axis, fontSize: 11 }} />
            <YAxis tick={{ fill: axis, fontSize: 11 }} tickFormatter={fmt} width={isValor ? 72 : 40} />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#18181b" : "#ffffff",
                border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
                borderRadius: 8,
                color: isDark ? "#f4f4f5" : "#111827",
              }}
              formatter={(v: number) => fmt(v)}
            />
            <Legend />
            <ReferenceLine y={0} stroke={axis} strokeDasharray="2 2" />
            <Bar dataKey="entradas" fill="#6366f1" name="Vendas (entradas)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="entregas" fill="#10b981" name="Entregas" radius={[4, 4, 0, 0]} />
            <Line dataKey="saldo" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} type="monotone" name="Saldo (Δ estoque)" />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create `client/src/components/creators-pontual/EvolucaoCreators.tsx`**

```tsx
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { fetchJson } from "./utils";
import type { EvolucaoPonto } from "./types";

export function EvolucaoCreators() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";

  const { data, isLoading } = useQuery({
    queryKey: ["/api/creators-pontual/evolucao"],
    queryFn: () => fetchJson<{ serie: EvolucaoPonto[] }>("/api/creators-pontual/evolucao?meses=8"),
  });

  if (isLoading || !data) {
    return <div className="h-72 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />;
  }

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <CardTitle className="text-base">Evolução do estoque</CardTitle>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Valor em estoque de Creators por mês (snapshots) · série via ILIKE creator (capta compostos antigos)
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data.serie} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="mes" tick={{ fill: axis, fontSize: 11 }} />
            <YAxis tick={{ fill: axis, fontSize: 11 }} tickFormatter={(v) => formatCurrencyNoDecimals(v)} width={72} />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#18181b" : "#ffffff",
                border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
                borderRadius: 8,
                color: isDark ? "#f4f4f5" : "#111827",
              }}
              formatter={(v: number) => formatCurrencyNoDecimals(v)}
            />
            <Line dataKey="valorEstoque" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} type="monotone" name="Valor em estoque" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "creators-pontual/(EntradaSaida|EvolucaoCreators)" || echo "ok"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add client/src/components/creators-pontual/EntradaSaida.tsx client/src/components/creators-pontual/EvolucaoCreators.tsx
git commit -m "feat(creators): graficos de entrada x saida e evolucao do estoque"
```

---

## Task 5: FunilStatus (BarChart horizontal por status)

**Files:** Create `client/src/components/creators-pontual/FunilStatus.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { fetchJson } from "./utils";
import type { StatusRow } from "./types";

const COR: Record<string, string> = {
  triagem: "#f59e0b",
  ativo: "#10b981",
  onboarding: "#6366f1",
  pausado: "#a1a1aa",
};

export function FunilStatus() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";

  const { data, isLoading } = useQuery({
    queryKey: ["/api/creators-pontual/funil"],
    queryFn: () => fetchJson<{ status: StatusRow[] }>("/api/creators-pontual/funil"),
  });

  if (isLoading || !data) {
    return <div className="h-72 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />;
  }

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <CardTitle className="text-base">Funil por status</CardTitle>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Valor parado em cada etapa — destaque para o que ainda não começou (triagem)
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.status} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis type="number" tick={{ fill: axis, fontSize: 11 }} tickFormatter={(v) => formatCurrencyNoDecimals(v)} />
            <YAxis type="category" dataKey="status" tick={{ fill: axis, fontSize: 11 }} width={80} />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#18181b" : "#ffffff",
                border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
                borderRadius: 8,
                color: isDark ? "#f4f4f5" : "#111827",
              }}
              formatter={(v: number) => formatCurrencyNoDecimals(v)}
            />
            <Bar dataKey="valor" name="Valor" radius={[0, 4, 4, 0]}>
              {data.status.map((s) => (
                <Cell key={s.status} fill={COR[s.status] ?? "#6366f1"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "creators-pontual/FunilStatus" || echo "ok"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add client/src/components/creators-pontual/FunilStatus.tsx
git commit -m "feat(creators): funil por status"
```

---

## Task 6: ProdutividadeOperadores (tabela)

**Files:** Create `client/src/components/creators-pontual/ProdutividadeOperadores.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { fetchJson } from "./utils";
import type { OperadorRow } from "./types";

export function ProdutividadeOperadores() {
  const { data } = useQuery({
    queryKey: ["/api/creators-pontual/operadores"],
    queryFn: () => fetchJson<{ operadores: OperadorRow[] }>("/api/creators-pontual/operadores"),
  });

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Produtividade por operador</CardTitle>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Carga em aberto, entregas (throughput) e tempo de ciclo — sem horas trabalhadas (não há time tracking)
        </p>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {!data ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">Carregando…</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operador</TableHead>
                  <TableHead className="text-right">Aberto</TableHead>
                  <TableHead className="text-right">Valor aberto</TableHead>
                  <TableHead className="text-right">Entregue</TableHead>
                  <TableHead className="text-right">Ciclo (d)</TableHead>
                  <TableHead className="text-right">Idade backlog (d)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.operadores.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">
                      Sem operadores
                    </TableCell>
                  </TableRow>
                )}
                {data.operadores.map((o) => (
                  <TableRow key={o.operador}>
                    <TableCell className="font-medium">{o.operador}</TableCell>
                    <TableCell className="text-right">{o.aberto}</TableCell>
                    <TableCell className="text-right">{formatCurrencyNoDecimals(o.valAberto)}</TableCell>
                    <TableCell className="text-right">{o.entregue}</TableCell>
                    <TableCell className="text-right">{o.cicloMedioDias ?? "—"}</TableCell>
                    <TableCell className="text-right">{o.idadeBacklogDias ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "creators-pontual/ProdutividadeOperadores" || echo "ok"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add client/src/components/creators-pontual/ProdutividadeOperadores.tsx
git commit -m "feat(creators): tabela de produtividade por operador"
```

---

## Task 7: Vendas — VendedoresRanking + VendasMensal

**Files:**
- Create: `client/src/components/creators-pontual/VendedoresRanking.tsx`
- Create: `client/src/components/creators-pontual/VendasMensal.tsx`

- [ ] **Step 1: Create `client/src/components/creators-pontual/VendedoresRanking.tsx`**

```tsx
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { fetchJson } from "./utils";
import type { VendedorRow } from "./types";

interface VendedoresData {
  vendedores: VendedorRow[];
  semVendedor: { qtd: number; valor: number };
}

export function VendedoresRanking() {
  const { data } = useQuery({
    queryKey: ["/api/creators-pontual/vendedores"],
    queryFn: () => fetchJson<VendedoresData>("/api/creators-pontual/vendedores"),
  });

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Ranking de vendedores</CardTitle>
        {data && (
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            {data.semVendedor.qtd} vendas sem vendedor preenchido ({formatCurrencyNoDecimals(data.semVendedor.valor)})
          </p>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {!data ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">Carregando…</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.vendedores.map((v) => (
                  <TableRow key={v.vendedor}>
                    <TableCell className="font-medium">{v.vendedor}</TableCell>
                    <TableCell className="text-right">{v.qtd}</TableCell>
                    <TableCell className="text-right">{formatCurrencyNoDecimals(v.valor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create `client/src/components/creators-pontual/VendasMensal.tsx`**

```tsx
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { fetchJson } from "./utils";
import type { VendasPonto } from "./types";

export function VendasMensal() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";

  const { data, isLoading } = useQuery({
    queryKey: ["/api/creators-pontual/vendas-mensal"],
    queryFn: () => fetchJson<{ serie: VendasPonto[] }>("/api/creators-pontual/vendas-mensal?meses=8"),
  });

  if (isLoading || !data) {
    return <div className="h-72 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />;
  }

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <CardTitle className="text-base">Vendas por mês</CardTitle>
        <p className="text-xs text-gray-500 dark:text-zinc-400">Valor vendido de Creators pontual por mês</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data.serie} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="mes" tick={{ fill: axis, fontSize: 11 }} />
            <YAxis tick={{ fill: axis, fontSize: 11 }} tickFormatter={(v) => formatCurrencyNoDecimals(v)} width={72} />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#18181b" : "#ffffff",
                border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
                borderRadius: 8,
                color: isDark ? "#f4f4f5" : "#111827",
              }}
              formatter={(v: number) => formatCurrencyNoDecimals(v)}
            />
            <Line dataKey="valor" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} type="monotone" name="Vendas" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "creators-pontual/(VendedoresRanking|VendasMensal)" || echo "ok"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add client/src/components/creators-pontual/VendedoresRanking.tsx client/src/components/creators-pontual/VendasMensal.tsx
git commit -m "feat(creators): ranking de vendedores e vendas mensais"
```

---

## Task 8: ItensTable (filtros status/operador)

**Files:** Create `client/src/components/creators-pontual/ItensTable.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { fetchJson, buildUrl } from "./utils";
import type { CreatorItem } from "./types";

export function ItensTable({
  statusList, operadores,
}: { statusList: string[]; operadores: string[] }) {
  const [status, setStatus] = useState<string>("todos");
  const [operador, setOperador] = useState<string>("todos");

  const statusParam = status === "todos" ? undefined : status;
  const operadorParam = operador === "todos" ? undefined : operador;

  const { data } = useQuery({
    queryKey: ["/api/creators-pontual/itens", status, operador],
    queryFn: () =>
      fetchJson<{ itens: CreatorItem[]; total: number }>(
        buildUrl("/api/creators-pontual/itens", { page: "1", status: statusParam, operador: operadorParam }),
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
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[160px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {statusList.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={operador} onValueChange={setOperador}>
              <SelectTrigger className="w-[180px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
                <SelectValue placeholder="Operador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os operadores</SelectItem>
                {operadores.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
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
                  <TableHead>Squad</TableHead>
                  <TableHead>Operador</TableHead>
                  <TableHead>Vendedor</TableHead>
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
                    <TableCell>{it.squad ?? "—"}</TableCell>
                    <TableCell>{it.operador ?? "—"}</TableCell>
                    <TableCell>{it.vendedor ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrencyNoDecimals(it.valor)}</TableCell>
                    <TableCell className="text-right">
                      {it.idadeDias >= 90 ? (
                        <Badge variant="destructive">{it.idadeDias}</Badge>
                      ) : (
                        it.idadeDias
                      )}
                    </TableCell>
                    <TableCell><Badge variant="outline">{it.status}</Badge></TableCell>
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

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "creators-pontual/ItensTable" || echo "ok"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add client/src/components/creators-pontual/ItensTable.tsx
git commit -m "feat(creators): tabela de itens com filtros status/operador"
```

---

## Task 9: Página CreatorsPontual + link cruzado no Estoque

**Files:**
- Create: `client/src/pages/CreatorsPontual.tsx`
- Modify: `client/src/components/estoque-pontual/DistribuicaoTabela.tsx`
- Modify: `client/src/pages/EstoquePontual.tsx`

- [ ] **Step 1: Create `client/src/pages/CreatorsPontual.tsx`**

```tsx
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { OverviewCards } from "@/components/creators-pontual/OverviewCards";
import { EntradaSaida } from "@/components/creators-pontual/EntradaSaida";
import { EvolucaoCreators } from "@/components/creators-pontual/EvolucaoCreators";
import { FunilStatus } from "@/components/creators-pontual/FunilStatus";
import { ProdutividadeOperadores } from "@/components/creators-pontual/ProdutividadeOperadores";
import { VendedoresRanking } from "@/components/creators-pontual/VendedoresRanking";
import { VendasMensal } from "@/components/creators-pontual/VendasMensal";
import { ItensTable } from "@/components/creators-pontual/ItensTable";
import { fetchJson } from "@/components/creators-pontual/utils";
import type { CreatorsOverview, StatusRow, OperadorRow } from "@/components/creators-pontual/types";

export default function CreatorsPontual() {
  useSetPageInfo("Creators Pontual", "Aprofundamento no estoque de Creators: vendas, produtividade e diagnóstico");

  const { data: overview } = useQuery({
    queryKey: ["/api/creators-pontual/overview"],
    queryFn: () => fetchJson<CreatorsOverview>("/api/creators-pontual/overview"),
  });

  const { data: funil } = useQuery({
    queryKey: ["/api/creators-pontual/funil"],
    queryFn: () => fetchJson<{ status: StatusRow[] }>("/api/creators-pontual/funil"),
  });

  const { data: operadores } = useQuery({
    queryKey: ["/api/creators-pontual/operadores"],
    queryFn: () => fetchJson<{ operadores: OperadorRow[] }>("/api/creators-pontual/operadores"),
  });

  const statusList = funil?.status.map((s) => s.status) ?? [];
  const operadoresList = operadores?.operadores.map((o) => o.operador) ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      {!overview ? (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
      ) : (
        <OverviewCards data={overview} />
      )}

      <EntradaSaida />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <EvolucaoCreators />
        <VendasMensal />
      </div>

      <FunilStatus />

      <ProdutividadeOperadores />

      <VendedoresRanking />

      <ItensTable statusList={statusList} operadores={operadoresList} />
    </div>
  );
}
```

- [ ] **Step 2: Add optional cross-link to `DistribuicaoTabela.tsx`**

Modify `client/src/components/estoque-pontual/DistribuicaoTabela.tsx`. Add the wouter import at the top (after the existing imports):

```tsx
import { Link } from "wouter";
```

Change the component signature and the chave cell to support an optional link resolver. Replace the existing `export function DistribuicaoTabela({ titulo, colChave, itens }: {...}) {` props block with:

```tsx
export function DistribuicaoTabela({
  titulo,
  colChave,
  itens,
  getLink,
}: {
  titulo: string;
  colChave: string;
  itens: DistRow[];
  getLink?: (chave: string) => string | undefined;
}) {
```

Then replace the chave cell:

```tsx
                  <TableCell className="font-medium">{r.chave}</TableCell>
```

with:

```tsx
                  <TableCell className="font-medium">
                    {getLink?.(r.chave) ? (
                      <Link href={getLink(r.chave)!} className="text-primary hover:underline">
                        {r.chave}
                      </Link>
                    ) : (
                      r.chave
                    )}
                  </TableCell>
```

- [ ] **Step 3: Wire the link in `EstoquePontual.tsx`**

Modify `client/src/pages/EstoquePontual.tsx`. Find the "Por produto" `DistribuicaoTabela` usage:

```tsx
        <DistribuicaoTabela titulo="Por produto" colChave="Produto" itens={produtosRows} />
```

Replace it with:

```tsx
        <DistribuicaoTabela
          titulo="Por produto"
          colChave="Produto"
          itens={produtosRows}
          getLink={(chave) => (chave === "Creators" ? "/creators-pontual" : undefined)}
        />
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "CreatorsPontual|DistribuicaoTabela|EstoquePontual" || echo "ok"`
Expected: `ok`

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/CreatorsPontual.tsx client/src/components/estoque-pontual/DistribuicaoTabela.tsx client/src/pages/EstoquePontual.tsx
git commit -m "feat(creators): pagina CreatorsPontual + link cruzado do estoque"
```

---

## Task 10: Wire-up de navegação (rota + menu + ícone)

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `shared/nav-config.ts`
- Modify: `client/src/components/app-sidebar.tsx`

- [ ] **Step 1: Add lazy import in `client/src/App.tsx`**

After `const EstoquePontual = lazyWithRetry(() => import("@/pages/EstoquePontual"));`, add:

```tsx
const CreatorsPontual = lazyWithRetry(() => import("@/pages/CreatorsPontual"));
```

- [ ] **Step 2: Add the route in `client/src/App.tsx`**

After the `<Route path="/estoque-pontual">…</Route>` line, add:

```tsx
      <Route path="/creators-pontual">{() => <ProtectedRoute path="/creators-pontual" component={CreatorsPontual} />}</Route>
```

- [ ] **Step 3: Add the permission key in `shared/nav-config.ts`**

In the `GESTAO` block, after `ESTOQUE_PONTUAL: 'gestao.estoque_pontual',`, add:

```ts
    CREATORS_PONTUAL: 'gestao.creators_pontual',
```

- [ ] **Step 4: Add the route→permission mapping in `shared/nav-config.ts`**

After `'/estoque-pontual': PERMISSION_KEYS.GESTAO.ESTOQUE_PONTUAL,`, add:

```ts
  '/creators-pontual': PERMISSION_KEYS.GESTAO.CREATORS_PONTUAL,
```

- [ ] **Step 5: Add the nav item in `shared/nav-config.ts`**

In the Gestão `items` array, after the `{ title: 'Estoque de Pontual', url: '/estoque-pontual', icon: 'Package', ... }` line, add:

```ts
        { title: 'Creators Pontual', url: '/creators-pontual', icon: 'Clapperboard', permissionKey: PERMISSION_KEYS.GESTAO.CREATORS_PONTUAL },
```

- [ ] **Step 6: Add the permission label in `shared/nav-config.ts`**

In `PERMISSION_LABELS`, after `[PERMISSION_KEYS.GESTAO.ESTOQUE_PONTUAL]: 'Estoque de Pontual',`, add:

```ts
  [PERMISSION_KEYS.GESTAO.CREATORS_PONTUAL]: 'Creators Pontual',
```

- [ ] **Step 7: Register the `Clapperboard` icon in `client/src/components/app-sidebar.tsx`**

Add `Clapperboard` to the lucide-react import line that ends with `…Bot, Link2, Package` → change to `…Bot, Link2, Package, Clapperboard`. Add `Clapperboard` to the `ICONS` map line that ends with `…Bot, Link2, Package,` → change to `…Bot, Link2, Package, Clapperboard,`. Ensure `Clapperboard` appears in BOTH the import and the ICONS map.

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "App.tsx|nav-config|app-sidebar" || echo "ok"`
Expected: `ok`

- [ ] **Step 9: Commit**

```bash
git add client/src/App.tsx shared/nav-config.ts client/src/components/app-sidebar.tsx
git commit -m "feat(creators): rota, item de menu e icone no sidebar"
```

---

## Task 11: Validação E2E (testes + smoke + visual)

**Files:** none (validation only)

- [ ] **Step 1: Run module tests**

Run: `npx vitest run server/routes/creatorsPontual.test.ts`
Expected: PASS (all green)

- [ ] **Step 2: Typecheck the whole project**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "creators|CreatorsPontual|nav-config|app-sidebar" || echo "no relevant type errors"`
Expected: `no relevant type errors`

- [ ] **Step 3: Restart dev server and smoke-test the endpoints**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null
ENABLE_DEV_LOGIN=true npm run dev &
# aguardar boot + autenticar (curl com retry cobre o tempo de subida)
curl -s --retry 60 --retry-delay 1 --retry-connrefused --retry-all-errors \
  -c /tmp/cre-cookie.txt -X POST http://localhost:3000/auth/dev-login >/dev/null
C=/tmp/cre-cookie.txt
echo "--- overview ---";   curl -s -b $C http://localhost:3000/api/creators-pontual/overview
echo ""; echo "--- funil ---";       curl -s -b $C http://localhost:3000/api/creators-pontual/funil
echo ""; echo "--- fluxo ---";       curl -s -b $C "http://localhost:3000/api/creators-pontual/fluxo?meses=8"
echo ""; echo "--- operadores ---";  curl -s -b $C http://localhost:3000/api/creators-pontual/operadores | head -c 400
echo ""; echo "--- vendedores ---";  curl -s -b $C http://localhost:3000/api/creators-pontual/vendedores | head -c 400
echo ""; echo "--- itens ---";       curl -s -b $C "http://localhost:3000/api/creators-pontual/itens?status=triagem" | head -c 400
```

Expected (sanity vs. produção 2026-06-02):
- `/overview`: `valorEstoque` ≈ 1.000.925, `qtdItens` ≈ 147, `pctTriagem` ≈ 54.4
- `/funil`: triagem com o maior `valor` (≈ 544k)
- `/fluxo`: março com `entradas` ≈ 109 e `entregas` ≈ 27
- `/operadores`: Mariana Dalto / Larissa Farias no topo por `aberto`
- `/vendedores`: Fabio Richard no topo; `semVendedor.qtd` ≈ 100
- `/itens?status=triagem`: `total` > 0, itens com `operador` preenchido

- [ ] **Step 4: Visual check no browser (dark + light)**

Abrir `http://localhost:3000/creators-pontual`. Verificar:
- 5 KPI cards (incl. "Parado em triagem 54%")
- Entrada × Saída (barras + linha de saldo, abre em Valor; toggle para Quantidade)
- Funil por status (barras horizontais, triagem em destaque âmbar) + Vendas por mês lado a lado
- Tabela de produtividade por operador
- Ranking de vendedores (com nota "N sem vendedor")
- Tabela de itens com filtros status + operador funcionando; idade ≥90d com badge vermelho
- Alternar tema: todos legíveis em dark E light
- Menu "Creators Pontual" no grupo Gestão com ícone de claquete
- Na tela `/estoque-pontual`, a linha "Creators" da tabela "Por produto" é um link que leva a `/creators-pontual`

- [ ] **Step 5: Stop the dev server**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; echo "dev server parado"
```

---

## Self-Review

**1. Spec coverage:**
- Seção 1 KPIs → Task 3 (OverviewCards, 5 KPIs incl. triagem) ✓
- Seção 2 Entrada×Saída → Task 4 (EntradaSaida) ✓
- Seção 3 Funil por status → Task 5 (FunilStatus) ✓
- Seção 4 Produtividade operador → Task 6 (ProdutividadeOperadores) ✓
- Seção 5 Vendas → Task 7 (VendedoresRanking + VendasMensal) ✓
- Seção 7 Tabela detalhada → Task 8 (ItensTable) ✓
- Endpoints overview/funil/fluxo/evolucao/operadores/vendedores/vendas-mensal/itens → Task 1 ✓
- Higienização (trim, ILIKE creator, ciclo válido) → Task 1 SQL ✓
- Operador = responsavel (não cs) → Task 1 `/operadores` e `/itens` ✓
- Rota + menu + ícone + link cruzado → Tasks 9, 10 ✓
- Seção 6 (margem/creators externos) → **fora do escopo v1** (v2, conforme spec) ✓
- Evolução histórica (`/evolucao`) → endpoint em Task 1 + componente `EvolucaoCreators` em Task 4, renderizado na página (Task 9). Curva de crescimento (R$243k→925k) que ilustra "não para de crescer". ✓

**2. Placeholder scan:** Sem "TBD"/"implementar depois"; todo SQL e JSX completo. ✓

**3. Type consistency:**
- Filtros `CREATORS`/`ESTOQUE`/`CREATORS_C`/`ESTOQUE_C` consistentes; status list idêntica (`'entregue','cancelado/inativo','não usar'`).
- `CreatorsOverview`, `StatusRow`, `FluxoPonto`, `OperadorRow`, `VendedorRow`, `VendasPonto`, `CreatorItem` — usados de forma consistente entre types.ts, componentes e página.
- `/operadores` retorna `cicloMedioDias`/`idadeBacklogDias` que podem ser `null` (tipados `number | null`; render com `?? "—"`). ✓
- `/itens` retorna `operador`/`vendedor` que podem ser `null` (`NULLIF(TRIM(...),'')`); render com `?? "—"`. ✓
- `DistribuicaoTabela.getLink` opcional — só a página de estoque passa; não quebra o uso existente (squad). ✓

**Nota:** A página renderiza Entrada×Saída (fluxo mensal + saldo) e EvolucaoCreators (nível acumulado) como visões complementares do crescimento — a primeira mostra a dinâmica (entra > sai), a segunda confirma o nível subindo.
