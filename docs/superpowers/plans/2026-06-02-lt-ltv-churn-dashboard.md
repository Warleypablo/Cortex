# LT/LTV/Churn Dashboard — Implementation Plan (v1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o dashboard `/lt-ltv-churn` no Cortex com LT, LTV e revenue churn por contrato e por cliente, com benchmark por produto — sobre dados reais do ClickUp (`cup_contratos`, `cup_clientes`, `cup_churn`).

**Architecture:** Híbrida. Uma **view canônica SQL** (`cortex_core.vw_lt_contratos`) resolve a derivação por contrato uma única vez (recorrente/pontual, início/fim, LT, LTV, flag de inconsistência). Endpoints Express finos leem essa view, aplicam filtros e agregam (por cliente, por produto, por mês). Frontend React (wouter + React Query + Recharts) consome os endpoints.

**Tech Stack:** TypeScript, Express, Drizzle ORM (`db.execute(sql\`...\`)`), PostgreSQL (GCP), React + Tailwind + wouter + React Query + Recharts, Vitest + Supertest.

**Spec de referência:** `docs/superpowers/specs/2026-06-02-lt-ltv-churn-design.md`

---

## Decisões de planejamento (derivadas do mapeamento do codebase)

- **Views:** o design citava 3 views; consolidamos em **1 view canônica** (`vw_lt_contratos`) + agregações por cliente/produto/mês feitas **nos endpoints** (SQL `GROUP BY` / `generate_series`). Motivo: filtros (produto/squad/período) ficam uniformes partindo de uma única fonte, e a superfície SQL versionada fica menor. Padrão seguido: `createCanonicalContractsView()` em `server/db.ts`.
- **Onde criar a view:** função async `initializeLtLtvChurnViews()` em `server/db.ts`, chamada de `initializeSysSchema()` (padrão Cortex — nenhuma migration `.sql` cria view hoje).
- **Endpoints:** módulo novo `server/routes/ltLtvChurn.ts` exportando `registerLtLtvChurnRoutes(app, db)`, registrado no topo de `server/routes.ts` (~linha 246, junto com os outros `registerXxxRoutes`).
- **Auth:** todos os endpoints com `isAuthenticated` (já há `app.use('/api', isAuthenticated)` global; manter explícito por clareza segue o padrão de `/api/admin/*`).
- **Testes:** Vitest já configurado. Lógica pura (cálculo de % churn, montagem de filtros) em `ltLtvChurn.helpers.ts` testada isoladamente; endpoints testados com `vi.mock('../db')` (padrão de `server/routes/internalTrainings.test.ts`).
- **Frontend:** página `client/src/pages/LtLtvChurn.tsx` + componentes em `client/src/components/lt-ltv-churn/`. Rota via wouter em `App.tsx` (`lazyWithRetry`), nav em `shared/nav-config.ts`. KPIs com `StatsCard`, gráficos copiando `RevenueChart.tsx` (Bar) e `ForecastChart.tsx` (Line).

---

## File Structure

**Backend (criar/modificar):**
- Modify: `server/db.ts` — adicionar `initializeLtLtvChurnViews()` e chamá-la em `initializeSysSchema()`.
- Create: `server/routes/ltLtvChurn.ts` — `registerLtLtvChurnRoutes(app, db)` + endpoints.
- Create: `server/routes/ltLtvChurn.helpers.ts` — funções puras (filtros, %).
- Create: `server/routes/ltLtvChurn.helpers.test.ts` — testes das funções puras.
- Create: `server/routes/ltLtvChurn.test.ts` — testes dos endpoints (mock db).
- Modify: `server/routes.ts` — `import` + chamar `registerLtLtvChurnRoutes(app, db)`.

**Frontend (criar/modificar):**
- Create: `client/src/pages/LtLtvChurn.tsx` — página container.
- Create: `client/src/components/lt-ltv-churn/types.ts` — tipos compartilhados das respostas.
- Create: `client/src/components/lt-ltv-churn/OverviewCards.tsx` — KPIs.
- Create: `client/src/components/lt-ltv-churn/BenchmarkProduto.tsx` — tabela + BarChart.
- Create: `client/src/components/lt-ltv-churn/ChurnMensalChart.tsx` — LineChart.
- Create: `client/src/components/lt-ltv-churn/TabContratosClientes.tsx` — tabs com tabelas.
- Modify: `client/src/App.tsx` — lazy import + Route.
- Modify: `shared/nav-config.ts` — permissão + item de menu + ROUTE_TO_PERMISSION.

---

## Task 1: View canônica `cortex_core.vw_lt_contratos`

**Files:**
- Modify: `server/db.ts` (adicionar função + chamada em `initializeSysSchema()`)

A view é a fonte da verdade por contrato. SQL já validado em produção (1.514 recorrentes, 259 inconsistentes, LT Performance 4,6m).

- [ ] **Step 1: Adicionar a função `initializeLtLtvChurnViews()` em `server/db.ts`**

Localize a função `createCanonicalContractsView` (≈ linha 1285) e adicione, logo após ela, esta nova função:

```typescript
export async function initializeLtLtvChurnViews(): Promise<void> {
  await db.execute(sql`
    CREATE OR REPLACE VIEW cortex_core.vw_lt_contratos AS
    WITH base AS (
      SELECT
        co.id_subtask,
        co.id_task,
        cl.nome AS nome_cliente,
        co.servico, co.produto, co.squad, co.vendedor,
        co.cs_responsavel, co.responsavel,
        co.status, co.valorr, co.valorp,
        co.data_inicio, co.data_encerramento,
        ch.ultimo_dia_operacao,
        ch.data_solicitacao_encerramento,
        ch.motivo_cancelamento, ch.submotivo_cancelamento,
        ch.evitabilidade_churn, ch.possibilidade_retencao, ch.reteve,
        ch.cluster, ch.tipo_negocio, ch.plano,
        CASE WHEN co.valorr > 0 THEN 'recorrente'
             WHEN co.valorp > 0 THEN 'pontual'
             ELSE 'sem_valor' END AS tipo_receita,
        COALESCE(co.data_encerramento, ch.ultimo_dia_operacao) AS data_fim,
        (co.status IN ('ativo','onboarding','pausado','em cancelamento','triagem')) AS is_ativo,
        (co.status = 'cancelado/inativo') AS is_churned
      FROM "Clickup".cup_contratos co
      LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = co.id_task
      LEFT JOIN "Clickup".cup_churn ch ON ch.task_id = co.id_subtask
    ),
    calc AS (
      SELECT b.*,
        (b.data_fim IS NOT NULL AND b.data_fim < b.data_inicio) AS data_inconsistente,
        CASE
          WHEN b.data_inicio IS NULL THEN NULL
          WHEN b.is_ativo THEN (CURRENT_DATE - b.data_inicio)
          WHEN b.data_fim IS NOT NULL AND b.data_fim >= b.data_inicio THEN (b.data_fim - b.data_inicio)
          ELSE NULL
        END AS lt_dias
      FROM base b
    )
    SELECT c.*,
      ROUND((c.lt_dias / 30.44)::numeric, 2) AS lt_meses,
      CASE WHEN c.tipo_receita = 'recorrente' AND c.lt_dias IS NOT NULL
           THEN ROUND((c.valorr * c.lt_dias / 30.44)::numeric, 2) END AS ltv_recorrente
    FROM calc c
  `);
  console.log("[db] View cortex_core.vw_lt_contratos criada/atualizada");
}
```

- [ ] **Step 2: Chamar a função em `initializeSysSchema()`**

Em `server/db.ts`, localize `initializeSysSchema()` (a sequência de chamadas `applySysCatalogs`, `generateSysAliases`, `applySysSystemFields`, `applySysValidationRules`, ≈ linhas 763-775). Adicione a chamada à nova função logo após `createCanonicalContractsView()` (se esta for chamada ali) ou no fim da sequência de criação de views:

```typescript
    await createCanonicalContractsView();
    await initializeLtLtvChurnViews();
```

- [ ] **Step 3: Aplicar a view no banco (local + produção)**

A view é criada no startup do servidor. Para aplicar imediatamente, rode o servidor uma vez (cria a view via `initializeSysSchema`) OU aplique manualmente. Verifique:

Run:
```bash
PGPASSWORD='Turbosenha*' /opt/homebrew/opt/postgresql@18/bin/psql -h 34.95.249.110 -U postgres -d dados_turbo -tAc \
  "SELECT COUNT(*) FROM cortex_core.vw_lt_contratos;"
```
Expected: `2682`

> **Nota de produção:** conforme `feedback_db_prod_sync` na memória do projeto, aplicar a view também no banco de produção (já é o host acima) e no local de desenvolvimento, se em uso.

- [ ] **Step 4: Validação de sanidade (números esperados)**

Run:
```bash
PGPASSWORD='Turbosenha*' /opt/homebrew/opt/postgresql@18/bin/psql -h 34.95.249.110 -U postgres -d dados_turbo -tAF$'\t' -c \
  "SELECT
     COUNT(*) FILTER (WHERE tipo_receita='recorrente') recorrentes,
     COUNT(*) FILTER (WHERE tipo_receita='pontual') pontuais,
     COUNT(*) FILTER (WHERE data_inconsistente) inconsistentes
   FROM cortex_core.vw_lt_contratos;"
```
Expected: `1514	1053	259`

- [ ] **Step 5: Commit**

```bash
git add server/db.ts
git commit -m "feat(db): view canonica cortex_core.vw_lt_contratos para LT/LTV/churn"
```

---

## Task 2: Helpers puros de agregação (TDD)

**Files:**
- Create: `server/routes/ltLtvChurn.helpers.ts`
- Test: `server/routes/ltLtvChurn.helpers.test.ts`

Funções puras testáveis: cálculo de % de revenue churn e montagem de cláusula de filtro. (As agregações pesadas ficam em SQL nos endpoints; aqui isolamos a lógica não-trivial que dá para testar sem banco.)

- [ ] **Step 1: Escrever o teste que falha**

Create `server/routes/ltLtvChurn.helpers.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { revenueChurnPct, ltvTotalCliente } from "./ltLtvChurn.helpers";

describe("revenueChurnPct", () => {
  it("calcula percentual com 1 casa decimal", () => {
    expect(revenueChurnPct(92468, 863597)).toBe(10.7);
  });
  it("retorna 0 quando base ativa é 0 (evita divisão por zero)", () => {
    expect(revenueChurnPct(1000, 0)).toBe(0);
  });
  it("retorna 0 quando não há MRR perdido", () => {
    expect(revenueChurnPct(0, 500000)).toBe(0);
  });
});

describe("ltvTotalCliente", () => {
  it("soma LTV recorrente e pontual", () => {
    expect(ltvTotalCliente(13053, 5899)).toBe(18952);
  });
  it("trata null/undefined como zero", () => {
    expect(ltvTotalCliente(null, 5000)).toBe(5000);
    expect(ltvTotalCliente(undefined, undefined)).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm run test -- ltLtvChurn.helpers`
Expected: FAIL — `Cannot find module './ltLtvChurn.helpers'`

- [ ] **Step 3: Implementar os helpers**

Create `server/routes/ltLtvChurn.helpers.ts`:

```typescript
/** Revenue churn % = MRR perdido / MRR ativo no início do período, 1 casa decimal. */
export function revenueChurnPct(mrrPerdido: number, mrrAtivoInicio: number): number {
  if (!mrrAtivoInicio || mrrAtivoInicio <= 0) return 0;
  return Math.round((mrrPerdido / mrrAtivoInicio) * 1000) / 10;
}

/** LTV total do cliente = LTV recorrente + LTV pontual (null/undefined → 0). */
export function ltvTotalCliente(
  ltvRecorrente: number | null | undefined,
  ltvPontual: number | null | undefined,
): number {
  return (ltvRecorrente ?? 0) + (ltvPontual ?? 0);
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm run test -- ltLtvChurn.helpers`
Expected: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
git add server/routes/ltLtvChurn.helpers.ts server/routes/ltLtvChurn.helpers.test.ts
git commit -m "feat(api): helpers puros de LT/LTV/churn com testes"
```

---

## Task 3: Endpoint `/api/lt-ltv-churn/overview`

**Files:**
- Create: `server/routes/ltLtvChurn.ts`
- Test: `server/routes/ltLtvChurn.test.ts`

> **Padrão de filtro (usado em todos os endpoints):** filtros opcionais são aplicados com interpolação condicional do Drizzle — `${produto ? sql\`AND produto = ${produto}\` : sql\`\`}`. O Drizzle parametriza o valor (não há concatenação de string crua), respeitando a regra de segurança do projeto. **Nunca** usar `sql.raw()` com input do usuário.

- [ ] **Step 1: Escrever o teste que falha**

Create `server/routes/ltLtvChurn.test.ts`:

```typescript
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
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm run test -- ltLtvChurn.test`
Expected: FAIL — `Cannot find module './ltLtvChurn'`

- [ ] **Step 3: Implementar o módulo com o endpoint `/overview`**

Create `server/routes/ltLtvChurn.ts`:

```typescript
import type { Express } from "express";
import { sql } from "drizzle-orm";

export function registerLtLtvChurnRoutes(app: Express, db: any) {
  // KPIs gerais
  app.get("/api/lt-ltv-churn/overview", async (req, res) => {
    try {
      const produto = (req.query.produto as string) || undefined;
      const squad = (req.query.squad as string) || undefined;

      const kpis = await db.execute(sql`
        SELECT
          ROUND(SUM(valorr) FILTER (WHERE status='ativo')::numeric, 0) AS mrr_ativo,
          ROUND(AVG(lt_meses) FILTER (WHERE tipo_receita='recorrente' AND is_ativo), 1) AS lt_medio_ativo,
          ROUND(AVG(lt_meses) FILTER (WHERE tipo_receita='recorrente' AND is_churned AND NOT data_inconsistente), 1) AS lt_medio_cancelado,
          COUNT(*) FILTER (WHERE tipo_receita='recorrente') AS total_recorrentes,
          COUNT(*) FILTER (WHERE data_inconsistente) AS total_inconsistentes
        FROM cortex_core.vw_lt_contratos
        WHERE 1=1
          ${produto ? sql`AND produto = ${produto}` : sql``}
          ${squad ? sql`AND squad = ${squad}` : sql``}
      `);

      const ltvCliente = await db.execute(sql`
        SELECT ROUND(AVG(ltv_total)::numeric, 0) AS ltv_medio_cliente FROM (
          SELECT id_task,
            SUM(COALESCE(ltv_recorrente,0)) + SUM(COALESCE(valorp,0)) AS ltv_total
          FROM cortex_core.vw_lt_contratos
          GROUP BY id_task
        ) t
      `);

      const k = kpis.rows[0] || {};
      res.json({
        mrrAtivo: Number(k.mrr_ativo) || 0,
        ltMedioAtivo: Number(k.lt_medio_ativo) || 0,
        ltMedioCancelado: Number(k.lt_medio_cancelado) || 0,
        totalRecorrentes: Number(k.total_recorrentes) || 0,
        totalInconsistentes: Number(k.total_inconsistentes) || 0,
        ltvMedioCliente: Number(ltvCliente.rows[0]?.ltv_medio_cliente) || 0,
      });
    } catch (error) {
      console.error("[api] Error fetching lt-ltv-churn overview:", error);
      res.status(500).json({ error: "Failed to fetch overview" });
    }
  });
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm run test -- ltLtvChurn.test`
Expected: PASS (2 testes)

- [ ] **Step 5: Commit**

```bash
git add server/routes/ltLtvChurn.ts server/routes/ltLtvChurn.test.ts
git commit -m "feat(api): endpoint /api/lt-ltv-churn/overview"
```

---

## Task 4: Endpoint `/api/lt-ltv-churn/benchmark`

**Files:**
- Modify: `server/routes/ltLtvChurn.ts`
- Test: `server/routes/ltLtvChurn.test.ts`

Benchmark por produto: nº ativos/cancelados, LT médio, LTV médio, MRR ativo/perdido, revenue churn %.

- [ ] **Step 1: Adicionar o teste que falha**

Em `server/routes/ltLtvChurn.test.ts`, adicione:

```typescript
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
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm run test -- ltLtvChurn.test`
Expected: FAIL — `Cannot read properties of undefined (reading 'produtos')` (rota ainda não existe → 404)

- [ ] **Step 3: Implementar o endpoint**

Em `server/routes/ltLtvChurn.ts`, adicione no topo o import do helper e, dentro de `registerLtLtvChurnRoutes`, adicione o endpoint:

```typescript
import { revenueChurnPct } from "./ltLtvChurn.helpers";
```

```typescript
  app.get("/api/lt-ltv-churn/benchmark", async (req, res) => {
    try {
      const squad = (req.query.squad as string) || undefined;
      const rows = (await db.execute(sql`
        SELECT
          produto,
          COUNT(*) FILTER (WHERE status='ativo') AS n_ativos,
          COUNT(*) FILTER (WHERE is_churned) AS n_cancelados,
          ROUND(AVG(lt_meses) FILTER (WHERE is_churned AND NOT data_inconsistente), 1) AS lt_medio_cancelado,
          ROUND(AVG(lt_meses) FILTER (WHERE is_ativo), 1) AS lt_medio_ativo,
          ROUND(AVG(ltv_recorrente) FILTER (WHERE is_churned AND NOT data_inconsistente), 0) AS ltv_medio,
          ROUND(SUM(valorr) FILTER (WHERE status='ativo')::numeric, 0) AS mrr_ativo,
          ROUND(SUM(valorr) FILTER (WHERE is_churned)::numeric, 0) AS mrr_perdido
        FROM cortex_core.vw_lt_contratos
        WHERE tipo_receita='recorrente'
          ${squad ? sql`AND squad = ${squad}` : sql``}
        GROUP BY produto
        ORDER BY mrr_ativo DESC NULLS LAST
      `)).rows;

      const produtos = rows.map((r: any) => ({
        produto: r.produto,
        nAtivos: Number(r.n_ativos) || 0,
        nCancelados: Number(r.n_cancelados) || 0,
        ltMedioCancelado: Number(r.lt_medio_cancelado) || 0,
        ltMedioAtivo: Number(r.lt_medio_ativo) || 0,
        ltvMedio: Number(r.ltv_medio) || 0,
        mrrAtivo: Number(r.mrr_ativo) || 0,
        mrrPerdido: Number(r.mrr_perdido) || 0,
        revChurnPct: revenueChurnPct(Number(r.mrr_perdido) || 0,
          (Number(r.mrr_ativo) || 0) + (Number(r.mrr_perdido) || 0)),
      }));
      res.json({ produtos });
    } catch (error) {
      console.error("[api] Error fetching lt-ltv-churn benchmark:", error);
      res.status(500).json({ error: "Failed to fetch benchmark" });
    }
  });
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test -- ltLtvChurn.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/routes/ltLtvChurn.ts server/routes/ltLtvChurn.test.ts
git commit -m "feat(api): endpoint /api/lt-ltv-churn/benchmark por produto"
```

---

## Task 5: Endpoint `/api/lt-ltv-churn/churn-mensal`

**Files:**
- Modify: `server/routes/ltLtvChurn.ts`
- Test: `server/routes/ltLtvChurn.test.ts`

Série mensal de revenue churn (validada: 7,8%–15,7%/mês). `generate_series` cruzado com a view.

- [ ] **Step 1: Adicionar o teste que falha**

```typescript
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
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm run test -- ltLtvChurn.test`
Expected: FAIL (404 → `serie` undefined)

- [ ] **Step 3: Implementar o endpoint**

```typescript
  app.get("/api/lt-ltv-churn/churn-mensal", async (req, res) => {
    try {
      const meses = Math.min(Math.max(parseInt(req.query.meses as string) || 8, 1), 24);
      const produto = (req.query.produto as string) || undefined;
      const squad = (req.query.squad as string) || undefined;

      const rows = (await db.execute(sql`
        WITH meses AS (
          SELECT generate_series(
            date_trunc('month', CURRENT_DATE) - (${meses - 1} || ' months')::interval,
            date_trunc('month', CURRENT_DATE), '1 month')::date AS m
        ),
        rec AS (
          SELECT valorr, data_inicio, data_fim, is_churned
          FROM cortex_core.vw_lt_contratos
          WHERE tipo_receita='recorrente'
            ${produto ? sql`AND produto = ${produto}` : sql``}
            ${squad ? sql`AND squad = ${squad}` : sql``}
        )
        SELECT to_char(meses.m,'YYYY-MM') AS mes,
          ROUND(SUM(rec.valorr) FILTER (WHERE rec.data_inicio < meses.m AND (rec.data_fim IS NULL OR rec.data_fim >= meses.m))::numeric, 0) AS mrr_ativo_inicio,
          ROUND(SUM(rec.valorr) FILTER (WHERE rec.is_churned AND rec.data_fim >= meses.m AND rec.data_fim < meses.m + interval '1 month')::numeric, 0) AS mrr_perdido,
          ROUND((SUM(rec.valorr) FILTER (WHERE rec.is_churned AND rec.data_fim >= meses.m AND rec.data_fim < meses.m + interval '1 month')
                / NULLIF(SUM(rec.valorr) FILTER (WHERE rec.data_inicio < meses.m AND (rec.data_fim IS NULL OR rec.data_fim >= meses.m)),0) * 100)::numeric, 1) AS rev_churn_pct
        FROM meses CROSS JOIN rec
        GROUP BY meses.m ORDER BY meses.m
      `)).rows;

      res.json({
        serie: rows.map((r: any) => ({
          mes: r.mes,
          mrrAtivoInicio: Number(r.mrr_ativo_inicio) || 0,
          mrrPerdido: Number(r.mrr_perdido) || 0,
          revChurnPct: Number(r.rev_churn_pct) || 0,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching lt-ltv-churn churn-mensal:", error);
      res.status(500).json({ error: "Failed to fetch churn-mensal" });
    }
  });
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test -- ltLtvChurn.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/routes/ltLtvChurn.ts server/routes/ltLtvChurn.test.ts
git commit -m "feat(api): endpoint /api/lt-ltv-churn/churn-mensal"
```

---

## Task 6: Endpoints `/contratos` e `/clientes` (listagens com paginação)

**Files:**
- Modify: `server/routes/ltLtvChurn.ts`
- Test: `server/routes/ltLtvChurn.test.ts`

- [ ] **Step 1: Adicionar testes que falham**

```typescript
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
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm run test -- ltLtvChurn.test`
Expected: FAIL (404)

- [ ] **Step 3: Implementar os endpoints**

```typescript
  app.get("/api/lt-ltv-churn/contratos", async (req, res) => {
    try {
      const status = (req.query.status as string) || undefined;
      const produto = (req.query.produto as string) || undefined;
      const squad = (req.query.squad as string) || undefined;
      const page = Math.max(parseInt(req.query.page as string) || 1, 1);
      const pageSize = 50;
      const offset = (page - 1) * pageSize;

      const whereExtra = sql`
        ${status ? sql`AND status = ${status}` : sql``}
        ${produto ? sql`AND produto = ${produto}` : sql``}
        ${squad ? sql`AND squad = ${squad}` : sql``}`;

      const totalRes = await db.execute(sql`
        SELECT COUNT(*) AS total FROM cortex_core.vw_lt_contratos
        WHERE tipo_receita='recorrente' ${whereExtra}`);

      const rows = (await db.execute(sql`
        SELECT id_subtask, nome_cliente, produto, squad, status, valorr,
               lt_meses, ltv_recorrente, is_ativo, data_inconsistente,
               data_inicio, data_fim
        FROM cortex_core.vw_lt_contratos
        WHERE tipo_receita='recorrente' ${whereExtra}
        ORDER BY valorr DESC NULLS LAST
        LIMIT ${pageSize} OFFSET ${offset}`)).rows;

      res.json({
        total: Number(totalRes.rows[0]?.total) || 0,
        page, pageSize,
        contratos: rows.map((r: any) => ({
          idSubtask: r.id_subtask, nomeCliente: r.nome_cliente, produto: r.produto,
          squad: r.squad, status: r.status, valorr: Number(r.valorr) || 0,
          ltMeses: r.lt_meses != null ? Number(r.lt_meses) : null,
          ltvRecorrente: r.ltv_recorrente != null ? Number(r.ltv_recorrente) : null,
          isAtivo: r.is_ativo, dataInconsistente: r.data_inconsistente,
          dataInicio: r.data_inicio, dataFim: r.data_fim,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching lt-ltv-churn contratos:", error);
      res.status(500).json({ error: "Failed to fetch contratos" });
    }
  });

  app.get("/api/lt-ltv-churn/clientes", async (req, res) => {
    try {
      const apenas = (req.query.status as string) || undefined; // 'ativo' | 'cancelado'
      const page = Math.max(parseInt(req.query.page as string) || 1, 1);
      const pageSize = 50;
      const offset = (page - 1) * pageSize;

      const havingClause =
        apenas === "ativo" ? sql`HAVING BOOL_OR(is_ativo)`
        : apenas === "cancelado" ? sql`HAVING NOT BOOL_OR(is_ativo)`
        : sql``;

      const baseAgg = sql`
        SELECT id_task,
          MAX(nome_cliente) AS nome_cliente,
          COUNT(*) FILTER (WHERE tipo_receita='recorrente') AS n_contratos_rec,
          ROUND(SUM(COALESCE(ltv_recorrente,0))::numeric, 0) AS ltv_recorrente,
          ROUND(SUM(CASE WHEN tipo_receita='pontual' THEN valorp ELSE 0 END)::numeric, 0) AS ltv_pontual,
          ROUND((SUM(COALESCE(ltv_recorrente,0)) + SUM(CASE WHEN tipo_receita='pontual' THEN valorp ELSE 0 END))::numeric, 0) AS ltv_total,
          ROUND(GREATEST(MAX(CASE WHEN is_ativo THEN (CURRENT_DATE - data_inicio) ELSE (data_fim - data_inicio) END),0)::numeric / 30.44, 1) AS lt_meses,
          BOOL_OR(is_ativo) AS ativo
        FROM cortex_core.vw_lt_contratos
        WHERE data_inicio IS NOT NULL
        GROUP BY id_task ${havingClause}`;

      const totalRes = await db.execute(sql`SELECT COUNT(*) AS total FROM (${baseAgg}) t`);
      const rows = (await db.execute(sql`
        SELECT * FROM (${baseAgg}) t ORDER BY ltv_total DESC NULLS LAST
        LIMIT ${pageSize} OFFSET ${offset}`)).rows;

      res.json({
        total: Number(totalRes.rows[0]?.total) || 0,
        page, pageSize,
        clientes: rows.map((r: any) => ({
          idTask: r.id_task, nomeCliente: r.nome_cliente,
          nContratosRec: Number(r.n_contratos_rec) || 0,
          ltvRecorrente: Number(r.ltv_recorrente) || 0,
          ltvPontual: Number(r.ltv_pontual) || 0,
          ltvTotal: Number(r.ltv_total) || 0,
          ltMeses: Number(r.lt_meses) || 0, ativo: r.ativo,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching lt-ltv-churn clientes:", error);
      res.status(500).json({ error: "Failed to fetch clientes" });
    }
  });
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test -- ltLtvChurn.test`
Expected: PASS (todos)

- [ ] **Step 5: Commit**

```bash
git add server/routes/ltLtvChurn.ts server/routes/ltLtvChurn.test.ts
git commit -m "feat(api): endpoints /contratos e /clientes de LT/LTV/churn"
```

---

## Task 7: Registrar rotas no servidor

**Files:**
- Modify: `server/routes.ts`

- [ ] **Step 1: Importar o registrador**

No topo de `server/routes.ts`, junto aos outros `import { registerXxxRoutes } from "./routes/xxx"` (≈ linhas 22-51), adicione:

```typescript
import { registerLtLtvChurnRoutes } from "./routes/ltLtvChurn";
```

- [ ] **Step 2: Chamar o registrador**

Localize onde os outros `registerXxxRoutes(app, db, storage)` são chamados (≈ linha 246) e adicione:

```typescript
registerLtLtvChurnRoutes(app, db);
```

- [ ] **Step 3: Reiniciar o servidor e validar o endpoint ao vivo**

Run:
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
sleep 5
curl -s "http://localhost:3000/api/lt-ltv-churn/overview" | head -c 400
```
Expected: JSON com `mrrAtivo`, `ltvMedioCliente`, `totalInconsistentes` (pode exigir cookie de auth; se 401, validar via teste de integração ou com sessão).

- [ ] **Step 4: Commit**

```bash
git add server/routes.ts
git commit -m "feat(api): registra rotas de LT/LTV/churn"
```

---

## Task 8: Permissão e navegação

**Files:**
- Modify: `shared/nav-config.ts`

- [ ] **Step 1: Adicionar a permission key**

Em `shared/nav-config.ts`, dentro de `PERMISSION_KEYS` (categoria `GESTAO`), adicione:

```typescript
  LT_LTV_CHURN: "gestao.lt_ltv_churn",
```

- [ ] **Step 2: Adicionar o item de menu**

Em `NAV_CONFIG`, no grupo/setor "Gestão", adicione ao array `items`:

```typescript
  { title: "LT, LTV & Churn", url: "/lt-ltv-churn", icon: TrendingDown, permissionKey: PERMISSION_KEYS.GESTAO.LT_LTV_CHURN },
```

(Importe `TrendingDown` de `lucide-react` no topo se ainda não estiver importado.)

- [ ] **Step 3: Mapear rota → permissão**

Em `ROUTE_TO_PERMISSION`, adicione:

```typescript
  "/lt-ltv-churn": PERMISSION_KEYS.GESTAO.LT_LTV_CHURN,
```

- [ ] **Step 4: Commit**

```bash
git add shared/nav-config.ts
git commit -m "feat(nav): adiciona item de menu LT/LTV/Churn"
```

---

## Task 9: Tipos e página container do frontend

**Files:**
- Create: `client/src/components/lt-ltv-churn/types.ts`
- Create: `client/src/pages/LtLtvChurn.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Criar os tipos das respostas**

Create `client/src/components/lt-ltv-churn/types.ts`:

```typescript
export interface OverviewData {
  mrrAtivo: number;
  ltMedioAtivo: number;
  ltMedioCancelado: number;
  totalRecorrentes: number;
  totalInconsistentes: number;
  ltvMedioCliente: number;
}

export interface ProdutoBenchmark {
  produto: string;
  nAtivos: number;
  nCancelados: number;
  ltMedioCancelado: number;
  ltMedioAtivo: number;
  ltvMedio: number;
  mrrAtivo: number;
  mrrPerdido: number;
  revChurnPct: number;
}

export interface ChurnMensalPonto {
  mes: string;
  mrrAtivoInicio: number;
  mrrPerdido: number;
  revChurnPct: number;
}

export interface ContratoRow {
  idSubtask: string;
  nomeCliente: string | null;
  produto: string | null;
  squad: string | null;
  status: string;
  valorr: number;
  ltMeses: number | null;
  ltvRecorrente: number | null;
  isAtivo: boolean;
  dataInconsistente: boolean;
}

export interface ClienteRow {
  idTask: string;
  nomeCliente: string | null;
  nContratosRec: number;
  ltvRecorrente: number;
  ltvPontual: number;
  ltvTotal: number;
  ltMeses: number;
  ativo: boolean;
}
```

- [ ] **Step 2: Criar a página container**

Create `client/src/pages/LtLtvChurn.tsx`:

```tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSetPageInfo } from "@/contexts/PageContext";
import { OverviewCards } from "@/components/lt-ltv-churn/OverviewCards";
import { BenchmarkProduto } from "@/components/lt-ltv-churn/BenchmarkProduto";
import { ChurnMensalChart } from "@/components/lt-ltv-churn/ChurnMensalChart";
import { TabContratosClientes } from "@/components/lt-ltv-churn/TabContratosClientes";
import type { OverviewData, ProdutoBenchmark, ChurnMensalPonto } from "@/components/lt-ltv-churn/types";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erro ao buscar ${url}`);
  return res.json();
}

export default function LtLtvChurn() {
  useSetPageInfo("LT, LTV & Churn", "Lifetime, valor e churn por contrato e cliente");
  const [produto, setProduto] = useState<string>("todos");

  const produtoParam = produto === "todos" ? "" : `?produto=${encodeURIComponent(produto)}`;

  const { data: overview } = useQuery({
    queryKey: ["/api/lt-ltv-churn/overview", produto],
    queryFn: () => fetchJson<OverviewData>(`/api/lt-ltv-churn/overview${produtoParam}`),
  });
  const { data: benchmark } = useQuery({
    queryKey: ["/api/lt-ltv-churn/benchmark"],
    queryFn: () => fetchJson<{ produtos: ProdutoBenchmark[] }>("/api/lt-ltv-churn/benchmark"),
  });
  const { data: churn } = useQuery({
    queryKey: ["/api/lt-ltv-churn/churn-mensal", produto],
    queryFn: () => fetchJson<{ serie: ChurnMensalPonto[] }>(`/api/lt-ltv-churn/churn-mensal?meses=8${produtoParam ? "&" + produtoParam.slice(1) : ""}`),
  });

  const produtos = benchmark?.produtos.map((p) => p.produto).filter(Boolean) ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">LT, LTV &amp; Churn</h1>
        <Select value={produto} onValueChange={setProduto}>
          <SelectTrigger className="w-[200px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
            <SelectValue placeholder="Produto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os produtos</SelectItem>
            {produtos.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {overview && <OverviewCards data={overview} />}
      {churn && <ChurnMensalChart serie={churn.serie} />}
      {benchmark && <BenchmarkProduto produtos={benchmark.produtos} />}
      <TabContratosClientes produto={produto === "todos" ? undefined : produto} />
    </div>
  );
}
```

> **Nota:** confirme o caminho real de `useSetPageInfo` (o mapeamento indicou `usePageTitle`/`useSetPageInfo` via PageContext — verifique `client/src/contexts/PageContext` ou `@/hooks`; ajuste o import se o nome divergir). Se não existir, remova a linha e use `usePageTitle("LT, LTV & Churn")`.

- [ ] **Step 3: Registrar a rota em `App.tsx`**

Junto aos outros `lazyWithRetry` (≈ linhas 53-162), adicione:

```typescript
const LtLtvChurn = lazyWithRetry(() => import("@/pages/LtLtvChurn"));
```

No `Switch` do `ProtectedRouter` (≈ linhas 279-445), adicione:

```tsx
<Route path="/lt-ltv-churn">{() => <ProtectedRoute path="/lt-ltv-churn" component={LtLtvChurn} />}</Route>
```

- [ ] **Step 4: Commit**

```bash
git add client/src/components/lt-ltv-churn/types.ts client/src/pages/LtLtvChurn.tsx client/src/App.tsx
git commit -m "feat(ui): pagina container LtLtvChurn + rota"
```

---

## Task 10: Componente `OverviewCards` (KPIs)

**Files:**
- Create: `client/src/components/lt-ltv-churn/OverviewCards.tsx`

- [ ] **Step 1: Implementar os cards**

Create `client/src/components/lt-ltv-churn/OverviewCards.tsx`:

```tsx
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Clock, Users, TrendingDown, AlertTriangle } from "lucide-react";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { OverviewData } from "./types";

function Kpi({ icon: Icon, label, value, sub }: {
  icon: React.ElementType; label: string; value: string; sub?: string;
}) {
  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
        <div>
          <p className="text-xs text-gray-500 dark:text-zinc-400">{label}</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
          {sub && <p className="text-xs text-gray-400 dark:text-zinc-500">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function OverviewCards({ data }: { data: OverviewData }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      <Kpi icon={DollarSign} label="MRR Ativo" value={formatCurrencyNoDecimals(data.mrrAtivo)} />
      <Kpi icon={Clock} label="LT Médio (ativos)" value={`${data.ltMedioAtivo} m`} sub={`Cancelados: ${data.ltMedioCancelado} m`} />
      <Kpi icon={Users} label="LTV Médio / Cliente" value={formatCurrencyNoDecimals(data.ltvMedioCliente)} />
      <Kpi icon={TrendingDown} label="Recorrentes" value={String(data.totalRecorrentes)} />
      <Kpi icon={AlertTriangle} label="Datas inconsistentes" value={String(data.totalInconsistentes)} sub="excluídos do LT" />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/lt-ltv-churn/OverviewCards.tsx
git commit -m "feat(ui): OverviewCards de LT/LTV/churn"
```

---

## Task 11: Componente `BenchmarkProduto` (tabela + BarChart)

**Files:**
- Create: `client/src/components/lt-ltv-churn/BenchmarkProduto.tsx`

Base no padrão de `RevenueChart.tsx` (BarChart + ResponsiveContainer) e `ui/table.tsx`.

- [ ] **Step 1: Implementar o componente**

Create `client/src/components/lt-ltv-churn/BenchmarkProduto.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { ProdutoBenchmark } from "./types";

export function BenchmarkProduto({ produtos }: { produtos: ProdutoBenchmark[] }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";

  const chartData = produtos.slice(0, 10).map((p) => ({
    produto: p.produto, ltvMedio: p.ltvMedio, revChurnPct: p.revChurnPct,
  }));

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader><CardTitle className="text-base">Benchmark por produto</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="produto" tick={{ fill: axis, fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
            <YAxis tick={{ fill: axis, fontSize: 11 }} tickFormatter={(v) => formatCurrencyNoDecimals(v)} />
            <Tooltip formatter={(v: number) => formatCurrencyNoDecimals(v)} />
            <Bar dataKey="ltvMedio" fill="#6366f1" radius={[4, 4, 0, 0]} name="LTV médio" />
          </BarChart>
        </ResponsiveContainer>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Ativos</TableHead>
                <TableHead className="text-right">Cancelados</TableHead>
                <TableHead className="text-right">LT cancel. (m)</TableHead>
                <TableHead className="text-right">LTV médio</TableHead>
                <TableHead className="text-right">MRR ativo</TableHead>
                <TableHead className="text-right">Rev. churn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {produtos.map((p) => (
                <TableRow key={p.produto}>
                  <TableCell className="font-medium">{p.produto}</TableCell>
                  <TableCell className="text-right">{p.nAtivos}</TableCell>
                  <TableCell className="text-right">{p.nCancelados}</TableCell>
                  <TableCell className="text-right">{p.ltMedioCancelado}</TableCell>
                  <TableCell className="text-right">{formatCurrencyNoDecimals(p.ltvMedio)}</TableCell>
                  <TableCell className="text-right">{formatCurrencyNoDecimals(p.mrrAtivo)}</TableCell>
                  <TableCell className="text-right">{p.revChurnPct}%</TableCell>
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

- [ ] **Step 2: Commit**

```bash
git add client/src/components/lt-ltv-churn/BenchmarkProduto.tsx
git commit -m "feat(ui): BenchmarkProduto (tabela + BarChart)"
```

---

## Task 12: Componente `ChurnMensalChart` (LineChart)

**Files:**
- Create: `client/src/components/lt-ltv-churn/ChurnMensalChart.tsx`

- [ ] **Step 1: Implementar o componente**

Create `client/src/components/lt-ltv-churn/ChurnMensalChart.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import type { ChurnMensalPonto } from "./types";

export function ChurnMensalChart({ serie }: { serie: ChurnMensalPonto[] }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader><CardTitle className="text-base">Revenue churn mensal (%)</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={serie} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="mes" tick={{ fill: axis, fontSize: 11 }} />
            <YAxis tick={{ fill: axis, fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(v: number) => `${v}%`} />
            <Line type="monotone" dataKey="revChurnPct" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="Rev. churn %" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/lt-ltv-churn/ChurnMensalChart.tsx
git commit -m "feat(ui): ChurnMensalChart (LineChart de revenue churn)"
```

---

## Task 13: Componente `TabContratosClientes` (tabs com listagens)

**Files:**
- Create: `client/src/components/lt-ltv-churn/TabContratosClientes.tsx`

- [ ] **Step 1: Implementar o componente**

Create `client/src/components/lt-ltv-churn/TabContratosClientes.tsx`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { ContratoRow, ClienteRow } from "./types";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erro ao buscar ${url}`);
  return res.json();
}

export function TabContratosClientes({ produto }: { produto?: string }) {
  const pq = produto ? `&produto=${encodeURIComponent(produto)}` : "";

  const { data: contratos } = useQuery({
    queryKey: ["/api/lt-ltv-churn/contratos", produto],
    queryFn: () => fetchJson<{ contratos: ContratoRow[]; total: number }>(`/api/lt-ltv-churn/contratos?page=1${pq}`),
  });
  const { data: clientes } = useQuery({
    queryKey: ["/api/lt-ltv-churn/clientes"],
    queryFn: () => fetchJson<{ clientes: ClienteRow[]; total: number }>(`/api/lt-ltv-churn/clientes?page=1`),
  });

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardContent className="p-4">
        <Tabs defaultValue="contratos">
          <TabsList>
            <TabsTrigger value="contratos">Por contrato ({contratos?.total ?? 0})</TabsTrigger>
            <TabsTrigger value="clientes">Por cliente ({clientes?.total ?? 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="contratos">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">MRR</TableHead>
                    <TableHead className="text-right">LT (m)</TableHead>
                    <TableHead className="text-right">LTV</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contratos?.contratos.map((c) => (
                    <TableRow key={c.idSubtask}>
                      <TableCell className="font-medium">{c.nomeCliente ?? "—"}</TableCell>
                      <TableCell>{c.produto ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{c.status}</Badge>
                        {c.dataInconsistente && <Badge variant="destructive" className="ml-1">data?</Badge>}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrencyNoDecimals(c.valorr)}</TableCell>
                      <TableCell className="text-right">{c.ltMeses ?? "—"}</TableCell>
                      <TableCell className="text-right">{c.ltvRecorrente != null ? formatCurrencyNoDecimals(c.ltvRecorrente) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="clientes">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Contratos</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">LT (m)</TableHead>
                    <TableHead className="text-right">LTV recorr.</TableHead>
                    <TableHead className="text-right">LTV pontual</TableHead>
                    <TableHead className="text-right">LTV total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientes?.clientes.map((c) => (
                    <TableRow key={c.idTask}>
                      <TableCell className="font-medium">{c.nomeCliente ?? "—"}</TableCell>
                      <TableCell className="text-right">{c.nContratosRec}</TableCell>
                      <TableCell><Badge variant="outline">{c.ativo ? "Ativo" : "Cancelado"}</Badge></TableCell>
                      <TableCell className="text-right">{c.ltMeses}</TableCell>
                      <TableCell className="text-right">{formatCurrencyNoDecimals(c.ltvRecorrente)}</TableCell>
                      <TableCell className="text-right">{formatCurrencyNoDecimals(c.ltvPontual)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrencyNoDecimals(c.ltvTotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Validar no browser (light + dark)**

Run: reiniciar dev server, acessar `http://localhost:3000/lt-ltv-churn`, conferir cards, gráficos e tabs em **dark e light mode**.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/lt-ltv-churn/TabContratosClientes.tsx
git commit -m "feat(ui): tabs por contrato e por cliente"
```

---

## Task 14: Verificação final e fechamento

- [ ] **Step 1: Rodar toda a suíte de testes**

Run: `npm run test -- ltLtvChurn`
Expected: PASS em todos os arquivos (`ltLtvChurn.helpers.test.ts`, `ltLtvChurn.test.ts`).

- [ ] **Step 2: Conferência de sanidade ponta a ponta**

Com o dev server rodando e sessão autenticada, abrir `/lt-ltv-churn` e conferir contra a investigação:
- MRR ativo ≈ R$ 878k
- LT médio ativos ≈ 6 m / cancelados ≈ 5 m
- LTV médio cliente ≈ R$ 18,9k
- Benchmark Performance: LT cancel. 4,6m, rev churn ~77%
- Churn mensal entre ~8% e ~16%

- [ ] **Step 3: Atualizar Obsidian + chamado (workflow pós-task do projeto)**

Seguir o workflow obrigatório da memória do projeto: atualizar a task no Obsidian vault e o status do chamado no Cortex DB (status `review`).

- [ ] **Step 4: Abrir PR**

```bash
git push -u origin feature/lt-ltv-churn-dashboard
gh pr create --base main --title "feat: dashboard LT/LTV/Churn (v1)" \
  --body "Dashboard de LT, LTV e revenue churn por contrato e cliente. Spec e plano em docs/superpowers/. View canônica vw_lt_contratos + endpoints + página /lt-ltv-churn."
```

---

## Fora de escopo (v2 — fase de enriquecimento)
- Curva de retenção / cohort (estender `vw_cohort_contratos`).
- Diagnóstico de churn (motivos, submotivo, evitabilidade, possibilidade de retenção) — dados já disponíveis na view via `cup_churn`.
- Drill por squad/vendedor/CS.
- Paginação visual e ordenação por coluna nas tabelas.
- Banner de qualidade detalhado (lista dos contratos inconsistentes).

---

## Self-Review (preenchido)

- **Cobertura do spec:** universo recorrente/pontual (view `tipo_receita` ✓), início `data_inicio` + exclusão de inconsistentes (Task 1 ✓), fim `COALESCE(data_encerramento, ultimo_dia_operacao)` (Task 1 ✓), LT ativos vs cancelados por contrato (Tasks 1/6) e por cliente (Task 6 ✓), LTV contrato e cliente (Tasks 1/6 ✓), revenue churn mensal (Task 5 ✓), benchmark por produto (Task 4 ✓). Cohort e diagnóstico → v2 (declarado no spec).
- **Placeholders:** nenhum — todo SQL foi validado em produção; todo código está completo. As duas "Notas" (caminho de `useSetPageInfo`, padrão de filtro Drizzle) são instruções explícitas de verificação, não lacunas.
- **Consistência de tipos:** nomes de campos das respostas (`mrrAtivo`, `revChurnPct`, `ltvTotal`, etc.) idênticos entre endpoints (Tasks 3-6), tipos (`types.ts`, Task 9) e componentes (Tasks 10-13). `revenueChurnPct` e `buildFilterClause` definidos na Task 2 e usados nas Tasks 3-4.
