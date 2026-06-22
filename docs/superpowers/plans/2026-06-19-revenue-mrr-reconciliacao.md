# Reconciliação de MRR por produto (aba Revenue) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir a distorção do MRR por produto (causada por corrupção do campo `cup_data_hist.produto` em 28/jan–10/fev/2026) e adicionar um waterfall de reconciliação por produto×mês com células auditáveis.

**Architecture:** (1) Migração SQL idempotente faz backfill do `produto` corrompido por carry-forward. (2) Helper puro `computeReconciliacao` classifica o movimento de cada `id_subtask` entre dois snapshots em componentes (vendas, expansão, reativação, churn, downsell, pausas, saídas sem rastreio). (3) Endpoint `/api/bp2026/reconciliacao` busca os dois snapshots, chama o helper e enriquece as saídas. (4) Painel `BPReconciliacao` (Sheet) abre ao clicar numa célula de MRR de produto.

**Tech Stack:** TypeScript, Express, Drizzle (`db.execute(sql\`...\`)`), PostgreSQL (GCP), React + TanStack Query, Tailwind (dark/light), Vitest.

## Global Constraints

- Banco: PostgreSQL GCP. Schemas com espaço/maiúscula exigem aspas duplas: `"Clickup"`, `"Conta Azul"`. Status em `cup_data_hist` é **minúsculo**.
- Pool de MRR = `status IN ('ativo','onboarding','triagem')` (idêntico a `bp2026.revenue.ts`).
- Classificação de produto: reutilizar `CASE_PRODUTO` exportado de `server/routes/bp2026.revenue.ts` — nunca duplicar.
- Backfill aplicado em **local (`cortex_dev`) E produção (`dados_turbo`)** — ver `reference_databases.md` para credenciais (senha prod no `.env`, bloco `# DB_PASSWORD=`).
- Dark/light obrigatório: classes com variante `dark:` em todo componente novo.
- Commits: Conventional Commits, terminar com `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`.
- Branch: `feature/bp2026-revenue-reconciliacao` (já criada).
- Spec de referência: `docs/superpowers/specs/2026-06-19-revenue-mrr-reconciliacao-design.md`.

---

## File Structure

- Create: `scripts/backfill-cup-data-hist-produto-2026.sql` — migração de backfill (idempotente).
- Create: `server/routes/bp2026.reconciliacao.helpers.ts` — tipos + `computeReconciliacao` (puro).
- Create: `server/routes/bp2026.reconciliacao.helpers.test.ts` — vitest do helper.
- Create: `server/routes/bp2026.reconciliacao.ts` — `registerBp2026ReconciliacaoRoutes(app, db)`.
- Modify: `server/routes.ts` — registrar a rota nova.
- Create: `client/src/components/bp2026/BPReconciliacao.tsx` — painel waterfall.
- Modify: `client/src/pages/BP2026.tsx` — interceptar clique em célula de MRR de produto.

---

## Task 1: Backfill do campo `produto` corrompido

**Files:**
- Create: `scripts/backfill-cup-data-hist-produto-2026.sql`

**Interfaces:**
- Produces: `cup_data_hist.produto` correto nos snapshots de `2026-01-28`..`2026-02-10` (local e prod). Critério: MRR Performance de jan (último snapshot do mês, via `CASE_PRODUTO`) passa de 422.159 → ~509.412.

- [ ] **Step 1: Escrever o script de backfill (idempotente, em transação)**

```sql
-- scripts/backfill-cup-data-hist-produto-2026.sql
-- Repara o campo produto corrompido na janela 2026-01-28..2026-02-10 (falha de pipeline).
-- Fonte do valor correto por id_subtask: produto de 2026-02-11 (restaurado), fallback 2025-12-27.
-- Idempotente: só atualiza linhas onde o produto diverge da fonte.
BEGIN;

-- diagnóstico ANTES
\echo '== fill-rate ANTES (janela corrompida) =='
SELECT data_snapshot::date dia, COUNT(*) total,
       COUNT(*) FILTER (WHERE TRIM(COALESCE(produto,'')) <> '') com_produto
FROM "Clickup".cup_data_hist
WHERE data_snapshot::date BETWEEN '2026-01-28' AND '2026-02-10'
GROUP BY 1 ORDER BY 1;

WITH fonte AS (
  SELECT id_subtask,
         COALESCE(
           (SELECT NULLIF(TRIM(f.produto),'') FROM "Clickup".cup_data_hist f
            WHERE f.id_subtask = h.id_subtask AND f.data_snapshot::date = '2026-02-11' LIMIT 1),
           (SELECT NULLIF(TRIM(d.produto),'') FROM "Clickup".cup_data_hist d
            WHERE d.id_subtask = h.id_subtask AND d.data_snapshot::date = '2025-12-27' LIMIT 1)
         ) AS produto_correto
  FROM (SELECT DISTINCT id_subtask FROM "Clickup".cup_data_hist
        WHERE data_snapshot::date BETWEEN '2026-01-28' AND '2026-02-10') h
)
UPDATE "Clickup".cup_data_hist t
SET produto = fonte.produto_correto
FROM fonte
WHERE t.id_subtask = fonte.id_subtask
  AND t.data_snapshot::date BETWEEN '2026-01-28' AND '2026-02-10'
  AND fonte.produto_correto IS NOT NULL
  AND COALESCE(NULLIF(TRIM(t.produto),''), '') IS DISTINCT FROM fonte.produto_correto;

-- diagnóstico DEPOIS
\echo '== fill-rate DEPOIS =='
SELECT data_snapshot::date dia, COUNT(*) total,
       COUNT(*) FILTER (WHERE TRIM(COALESCE(produto,'')) <> '') com_produto
FROM "Clickup".cup_data_hist
WHERE data_snapshot::date BETWEEN '2026-01-28' AND '2026-02-10'
GROUP BY 1 ORDER BY 1;

\echo '== MRR Performance jan (deve ser ~509.412) =='
WITH alvo AS (
  SELECT MAX(data_snapshot::date) d FROM "Clickup".cup_data_hist
  WHERE data_snapshot::date >= '2026-01-01' AND data_snapshot::date < '2026-02-01'
)
SELECT ROUND(SUM(h.valorr::numeric),0) mrr_performance_jan
FROM "Clickup".cup_data_hist h, alvo a
WHERE h.data_snapshot::date = a.d
  AND h.status IN ('ativo','onboarding','triagem')
  AND (CASE
        WHEN TRIM(COALESCE(h.produto,'')) = 'Performance' THEN 'performance'
        WHEN TRIM(COALESCE(h.produto,'')) = 'Creators' THEN 'creators'
        WHEN TRIM(COALESCE(h.produto,'')) = 'Social Media' THEN 'social'
        WHEN TRIM(COALESCE(h.produto,'')) = 'Gestão de Comunidade' THEN 'gc'
        WHEN TRIM(COALESCE(h.produto,'')) != '' THEN 'others'
        WHEN h.servico ILIKE '%performance%' THEN 'performance'
        ELSE 'others' END) = 'performance';

COMMIT;
```

- [ ] **Step 2: Rodar em LOCAL e validar**

Run:
```bash
PGPASSWORD=dev123 psql -h localhost -U cortex -d cortex_dev -f scripts/backfill-cup-data-hist-produto-2026.sql
```
Expected: fill-rate DEPOIS ≥ 97% nos dias da janela; `mrr_performance_jan` ≈ **509412**.
(Se o local não tiver os snapshots de jan/fev, re-sincronizar `cup_data_hist` do prod antes — ver `reference_databases.md`.)

- [ ] **Step 3: Rodar de novo em LOCAL (confirmar idempotência)**

Run: o mesmo comando do Step 2.
Expected: `UPDATE 0` (nada a atualizar na 2ª passada); `mrr_performance_jan` continua ~509412.

- [ ] **Step 4: Rodar em PRODUÇÃO e validar**

Run:
```bash
PROD_PASS=$(grep -E "^# *DB_PASSWORD=" .env | head -1 | sed -E 's/^# *DB_PASSWORD=//' | tr -d '"'"'"' \r')
PGPASSWORD="$PROD_PASS" psql -h 34.95.249.110 -U postgres -d dados_turbo -f scripts/backfill-cup-data-hist-produto-2026.sql
```
Expected: mesmo resultado (fill-rate ≥97%, `mrr_performance_jan` ≈ 509412).

- [ ] **Step 5: Commit**

```bash
git add scripts/backfill-cup-data-hist-produto-2026.sql
git commit -m "fix(bp2026): backfill do produto corrompido em cup_data_hist (28/jan-10/fev)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Helper puro `computeReconciliacao`

**Files:**
- Create: `server/routes/bp2026.reconciliacao.helpers.ts`
- Test: `server/routes/bp2026.reconciliacao.helpers.test.ts`

**Interfaces:**
- Produces:
  - `interface SnapRow { id_subtask: string; cliente: string; servico: string; status: string; linha: string; valorr: number }`
  - `interface ContratoMov { id_subtask: string; cliente: string; servico: string; valorrIni: number; valorrFim: number; delta: number }`
  - `interface Componente { chave: ComponenteChave; titulo: string; valor: number; n: number; contratos: ContratoMov[] }`
  - `interface Reconciliacao { produto: string; mrrInicio: number; mrrFim: number; componentes: Componente[]; reconcilia: boolean }`
  - `function computeReconciliacao(produto: string, prev: SnapRow[], cur: SnapRow[]): Reconciliacao`
  - `const POOL_STATUS: readonly string[]`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// server/routes/bp2026.reconciliacao.helpers.test.ts
import { describe, it, expect } from "vitest";
import { computeReconciliacao, type SnapRow } from "./bp2026.reconciliacao.helpers";

const row = (id: string, status: string, linha: string, valorr: number, servico = id): SnapRow =>
  ({ id_subtask: id, cliente: `cliente-${id}`, servico, status, linha, valorr });

describe("computeReconciliacao", () => {
  // prev (jan) pool performance = A100 B50 C30 D20 E10 = 210
  const prev: SnapRow[] = [
    row("A", "ativo", "performance", 100),
    row("B", "ativo", "performance", 50),
    row("C", "ativo", "performance", 30),
    row("D", "ativo", "performance", 20),
    row("E", "ativo", "performance", 10),
    row("F", "pausado", "performance", 70), // fora do pool (pausado) -> reativa em cur
    row("G", "ativo", "creators", 200),     // outro produto, irrelevante
  ];
  // cur (fev) pool performance = A120 B40 F70 H80 = 310
  const cur: SnapRow[] = [
    row("A", "ativo", "performance", 120),            // expansão +20
    row("B", "ativo", "performance", 40),             // downsell -10
    row("C", "cancelado/inativo", "performance", 30), // churn -30
    row("D", "pausado", "performance", 20),           // pausa -20
    // E ausente -> saída sem rastreio -10
    row("F", "ativo", "performance", 70),             // reativação +70
    row("H", "ativo", "performance", 80),             // venda +80
    row("G", "ativo", "creators", 200),
  ];

  const rec = computeReconciliacao("performance", prev, cur);
  const val = (chave: string) => rec.componentes.find((c) => c.chave === chave)?.valor ?? 0;

  it("calcula MRR início e fim do produto", () => {
    expect(rec.mrrInicio).toBe(210);
    expect(rec.mrrFim).toBe(310);
  });

  it("classifica cada componente do movimento", () => {
    expect(val("vendas")).toBe(80);
    expect(val("expansao")).toBe(20);
    expect(val("reativacao")).toBe(70);
    expect(val("churn_cancel")).toBe(-30);
    expect(val("churn_downsell")).toBe(-10);
    expect(val("pausas")).toBe(-20);
    expect(val("saidas_sem_rastreio")).toBe(-10);
  });

  it("a venda H lista o contrato certo", () => {
    const vendas = rec.componentes.find((c) => c.chave === "vendas")!;
    expect(vendas.n).toBe(1);
    expect(vendas.contratos[0].id_subtask).toBe("H");
    expect(vendas.contratos[0].valorrFim).toBe(80);
  });

  it("reconcilia: mrrInicio + Σ componentes == mrrFim", () => {
    const soma = rec.componentes.reduce((s, c) => s + c.valor, 0);
    expect(rec.mrrInicio + soma).toBe(rec.mrrFim);
    expect(rec.reconcilia).toBe(true);
  });

  it("omite componentes vazios", () => {
    expect(rec.componentes.find((c) => c.chave === "entregue")).toBeUndefined();
    expect(rec.componentes.find((c) => c.chave === "mudanca_produto")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run server/routes/bp2026.reconciliacao.helpers.test.ts`
Expected: FAIL — `Cannot find module './bp2026.reconciliacao.helpers'`.

- [ ] **Step 3: Implementar o helper**

```ts
// server/routes/bp2026.reconciliacao.helpers.ts
// Classifica o movimento de MRR de um produto entre dois snapshots fim-de-mês.
// Puro (sem DB): a camada de rota fornece SnapRow[] com `linha` já calculada via CASE_PRODUTO.

export const POOL_STATUS: readonly string[] = ["ativo", "onboarding", "triagem"];

export interface SnapRow {
  id_subtask: string;
  cliente: string;
  servico: string;
  status: string; // minúsculo (cup_data_hist)
  linha: string;  // 'performance' | 'creators' | 'social' | 'gc' | 'others'
  valorr: number;
}

export type ComponenteChave =
  | "vendas" | "expansao" | "reativacao"
  | "churn_cancel" | "churn_downsell" | "pausas"
  | "saidas_sem_rastreio" | "entregue" | "mudanca_produto";

export interface ContratoMov {
  id_subtask: string;
  cliente: string;
  servico: string;
  valorrIni: number;
  valorrFim: number;
  delta: number;
}

export interface Componente {
  chave: ComponenteChave;
  titulo: string;
  valor: number;
  n: number;
  contratos: ContratoMov[];
}

export interface Reconciliacao {
  produto: string;
  mrrInicio: number;
  mrrFim: number;
  componentes: Componente[];
  reconcilia: boolean;
}

const TITULOS: Record<ComponenteChave, string> = {
  vendas: "Vendas (novos contratos)",
  expansao: "Expansão (upsell)",
  reativacao: "Reativação",
  churn_cancel: "Churn — cancelamento",
  churn_downsell: "Churn — downsell",
  pausas: "Pausas",
  saidas_sem_rastreio: "Saídas sem rastreio",
  entregue: "Entregue (pontual concluído)",
  mudanca_produto: "Mudança de produto",
};

const ORDEM: ComponenteChave[] = [
  "vendas", "expansao", "reativacao",
  "churn_cancel", "churn_downsell", "pausas",
  "saidas_sem_rastreio", "entregue", "mudanca_produto",
];

function inPool(row: SnapRow | undefined, produto: string): boolean {
  return !!row && POOL_STATUS.includes(row.status) && row.linha === produto;
}

export function computeReconciliacao(produto: string, prev: SnapRow[], cur: SnapRow[]): Reconciliacao {
  const prevMap = new Map(prev.map((r) => [r.id_subtask, r]));
  const curMap = new Map(cur.map((r) => [r.id_subtask, r]));

  const buckets: Record<ComponenteChave, ContratoMov[]> = {
    vendas: [], expansao: [], reativacao: [],
    churn_cancel: [], churn_downsell: [], pausas: [],
    saidas_sem_rastreio: [], entregue: [], mudanca_produto: [],
  };

  const ids = new Set<string>();
  for (const r of prev) if (inPool(r, produto)) ids.add(r.id_subtask);
  for (const r of cur) if (inPool(r, produto)) ids.add(r.id_subtask);

  let mrrInicio = 0;
  let mrrFim = 0;

  for (const id of ids) {
    const p = prevMap.get(id);
    const c = curMap.get(id);
    const wasIn = inPool(p, produto);
    const isIn = inPool(c, produto);
    const vIni = wasIn ? p!.valorr : 0;
    const vFim = isIn ? c!.valorr : 0;
    mrrInicio += vIni;
    mrrFim += vFim;
    const ref = c ?? p!;
    const mov: ContratoMov = {
      id_subtask: id, cliente: ref.cliente, servico: ref.servico,
      valorrIni: vIni, valorrFim: vFim, delta: vFim - vIni,
    };

    if (!wasIn && isIn) {
      if (!p) buckets.vendas.push(mov);
      else if (p.linha === produto) buckets.reativacao.push(mov);
      else buckets.mudanca_produto.push(mov);
    } else if (wasIn && !isIn) {
      if (!c) buckets.saidas_sem_rastreio.push(mov);
      else if (c.status === "pausado") buckets.pausas.push(mov);
      else if (c.status === "cancelado/inativo" || c.status === "em cancelamento") buckets.churn_cancel.push(mov);
      else if (c.status === "entregue") buckets.entregue.push(mov);
      else if (c.linha !== produto) buckets.mudanca_produto.push(mov);
      else buckets.churn_cancel.push(mov);
    } else if (wasIn && isIn) {
      if (vFim > vIni) buckets.expansao.push(mov);
      else if (vFim < vIni) buckets.churn_downsell.push(mov);
    }
  }

  const componentes: Componente[] = ORDEM
    .map((chave) => {
      const contratos = buckets[chave];
      const valor = contratos.reduce((s, m) => s + m.delta, 0);
      return { chave, titulo: TITULOS[chave], valor, n: contratos.length, contratos };
    })
    .filter((comp) => comp.n > 0);

  const soma = componentes.reduce((s, comp) => s + comp.valor, 0);
  const reconcilia = Math.abs(mrrInicio + soma - mrrFim) < 0.01;

  return { produto, mrrInicio, mrrFim, componentes, reconcilia };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run server/routes/bp2026.reconciliacao.helpers.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add server/routes/bp2026.reconciliacao.helpers.ts server/routes/bp2026.reconciliacao.helpers.test.ts
git commit -m "feat(bp2026): helper puro computeReconciliacao (waterfall de MRR)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Endpoint `/api/bp2026/reconciliacao`

**Files:**
- Create: `server/routes/bp2026.reconciliacao.ts`
- Modify: `server/routes.ts`

**Interfaces:**
- Consumes: `computeReconciliacao`, `SnapRow` (Task 2); `CASE_PRODUTO` de `./bp2026.revenue`.
- Produces: `function registerBp2026ReconciliacaoRoutes(app: Express, db: any): void`. Rota `GET /api/bp2026/reconciliacao?produto=<chave>&mes=<1..12>` → JSON `{ produto, mes, mrrInicio, mrrFim, reconcilia, componentes }`, onde cada componente é `{ chave, titulo, valor, n, contratos }` e os contratos de `saidas_sem_rastreio` têm `ultimoSnapshot: string|null` e `emCupChurn: boolean`.

- [ ] **Step 1: Escrever o endpoint**

```ts
// server/routes/bp2026.reconciliacao.ts
// Waterfall de reconciliação de MRR por produto×mês (snapshot M-1 -> M).
import type { Express } from "express";
import { sql } from "drizzle-orm";
import { CASE_PRODUTO } from "./bp2026.revenue";
import { computeReconciliacao, type SnapRow } from "./bp2026.reconciliacao.helpers";

const ANO = 2026;
const PRODUTOS = ["performance", "creators", "social", "gc", "others"];

async function fetchSnapRows(db: any, dia: string): Promise<SnapRow[]> {
  const result = await db.execute(sql`
    SELECT h.id_subtask,
           COALESCE(NULLIF(TRIM(cl.nome), ''), '(sem cliente)') AS cliente,
           COALESCE(h.servico, '') AS servico,
           LOWER(COALESCE(h.status, '')) AS status,
           ${CASE_PRODUTO} AS linha,
           COALESCE(h.valorr::numeric, 0) AS valorr
    FROM "Clickup".cup_data_hist h
    LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = h.id_task
    WHERE h.data_snapshot::date = ${dia}::date
  `);
  return (result.rows as any[]).map((r) => ({
    id_subtask: r.id_subtask, cliente: r.cliente, servico: r.servico,
    status: r.status, linha: r.linha, valorr: parseFloat(r.valorr),
  }));
}

export function registerBp2026ReconciliacaoRoutes(app: Express, db: any) {
  app.get("/api/bp2026/reconciliacao", async (req, res) => {
    try {
      const produto = String(req.query.produto ?? "");
      const mes = Number(req.query.mes);
      if (!PRODUTOS.includes(produto) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
        return res.status(400).json({ error: "produto/mes inválidos" });
      }

      // datas dos snapshots: cur = último do mês; prev = último do mês anterior
      const datas = await db.execute(sql`
        SELECT
          (SELECT MAX(data_snapshot::date) FROM "Clickup".cup_data_hist
           WHERE data_snapshot::date >= make_date(${ANO}, ${mes}, 1)
             AND data_snapshot::date < (make_date(${ANO}, ${mes}, 1) + INTERVAL '1 month')) AS cur,
          (SELECT MAX(data_snapshot::date) FROM "Clickup".cup_data_hist
           WHERE data_snapshot::date >= (make_date(${ANO}, ${mes}, 1) - INTERVAL '1 month')
             AND data_snapshot::date < make_date(${ANO}, ${mes}, 1)) AS prev
      `);
      const curD = (datas.rows[0] as any).cur;
      const prevD = (datas.rows[0] as any).prev;
      if (!curD || !prevD) {
        return res.json({ produto, mes, mrrInicio: 0, mrrFim: 0, reconcilia: true, componentes: [] });
      }

      const [prevRows, curRows] = await Promise.all([
        fetchSnapRows(db, prevD), fetchSnapRows(db, curD),
      ]);
      const rec = computeReconciliacao(produto, prevRows, curRows);

      // enriquecer saídas sem rastreio: último snapshot visto + presença em cup_churn
      const saidas = rec.componentes.find((c) => c.chave === "saidas_sem_rastreio");
      let contratosPorComp = rec.componentes.map((c) => ({
        chave: c.chave, titulo: c.titulo, valor: c.valor, n: c.n,
        contratos: c.contratos as any[],
      }));
      if (saidas && saidas.contratos.length) {
        const ids = saidas.contratos.map((m) => m.id_subtask);
        const enr = await db.execute(sql`
          SELECT h.id_subtask,
                 (SELECT MAX(x.data_snapshot::date)::text FROM "Clickup".cup_data_hist x WHERE x.id_subtask = h.id_subtask) AS ultimo,
                 EXISTS (SELECT 1 FROM "Clickup".cup_churn ch WHERE ch.task_id = h.id_subtask) AS em_churn
          FROM (SELECT DISTINCT unnest(${ids}::text[]) AS id_subtask) h
        `);
        const meta = new Map((enr.rows as any[]).map((r) => [r.id_subtask, r]));
        contratosPorComp = contratosPorComp.map((c) =>
          c.chave !== "saidas_sem_rastreio" ? c : {
            ...c,
            contratos: c.contratos.map((m) => ({
              ...m,
              ultimoSnapshot: meta.get(m.id_subtask)?.ultimo ?? null,
              emCupChurn: meta.get(m.id_subtask)?.em_churn ?? false,
            })),
          }
        );
      }

      res.json({
        produto, mes,
        mrrInicio: rec.mrrInicio, mrrFim: rec.mrrFim, reconcilia: rec.reconcilia,
        componentes: contratosPorComp,
      });
    } catch (error) {
      console.error("[bp2026] Erro em /api/bp2026/reconciliacao:", error);
      res.status(500).json({ error: "Erro ao montar reconciliação" });
    }
  });
}
```

- [ ] **Step 2: Registrar a rota em `server/routes.ts`**

Adicionar o import perto da linha 81 (junto de `registerBp2026DetalheRoutes`):

```ts
import { registerBp2026ReconciliacaoRoutes } from "./routes/bp2026.reconciliacao";
```

E, onde `registerBp2026DetalheRoutes(app, db)` é chamado, adicionar logo abaixo:

```ts
registerBp2026ReconciliacaoRoutes(app, db);
```

(Confirmar o nome do handle do banco usado na chamada vizinha — usar o mesmo, provavelmente `db`.)

- [ ] **Step 3: Verificar compilação**

Run: `npm run check`
Expected: sem erros de tipo novos em `bp2026.reconciliacao.ts` / `routes.ts`.

- [ ] **Step 4: Subir o dev server e validar com curl (Performance, fev)**

Run:
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
sleep 4
curl -s "http://localhost:3000/api/bp2026/reconciliacao?produto=performance&mes=2" | npx json -0 | head -60
```
Expected: JSON com `mrrInicio` ≈ 509412, `mrrFim` ≈ 510012, `reconcilia: true`, e componentes `vendas` (+61064), `expansao` (+4280), `reativacao` (+8697), `churn_cancel` (-41761), `churn_downsell` (-7699), `pausas` (-13991), `saidas_sem_rastreio` (-9991, contratos com `emCupChurn: false`).
(Se o endpoint exigir auth — `app.use("/api", isAuthenticated)` — testar logado pelo browser na Task 4, ou adicionar header de sessão.)

- [ ] **Step 5: Commit**

```bash
git add server/routes/bp2026.reconciliacao.ts server/routes.ts
git commit -m "feat(bp2026): endpoint /api/bp2026/reconciliacao (waterfall por produto)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Painel `BPReconciliacao` + clique na célula de MRR

**Files:**
- Create: `client/src/components/bp2026/BPReconciliacao.tsx`
- Modify: `client/src/pages/BP2026.tsx`

**Interfaces:**
- Consumes: endpoint da Task 3; componentes UI `Sheet` (`@/components/ui/sheet`), `Skeleton`.
- Produces: `function BPReconciliacao({ produto, mes, titulo, onClose }: { produto: string|null; mes: number|null; titulo: string; onClose: () => void })`.

- [ ] **Step 1: Escrever o componente do waterfall**

```tsx
// client/src/components/bp2026/BPReconciliacao.tsx
import { useQuery } from "@tanstack/react-query";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

interface ContratoMov {
  id_subtask: string; cliente: string; servico: string;
  valorrIni: number; valorrFim: number; delta: number;
  ultimoSnapshot?: string | null; emCupChurn?: boolean;
}
interface Componente {
  chave: string; titulo: string; valor: number; n: number; contratos: ContratoMov[];
}
interface RecResponse {
  produto: string; mes: number; mrrInicio: number; mrrFim: number;
  reconcilia: boolean; componentes: Componente[];
}

const fmt = (v: number) =>
  `${v < 0 ? "−" : v > 0 ? "+" : ""}R$ ${Math.abs(Math.round(v)).toLocaleString("pt-BR")}`;
const fmtAbs = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;

interface Props {
  produto: string | null;
  mes: number | null;
  titulo: string;
  onClose: () => void;
}

export function BPReconciliacao({ produto, mes, titulo, onClose }: Props) {
  const aberto = produto !== null && mes !== null;
  const { data, isLoading, error } = useQuery<RecResponse>({
    queryKey: ["/api/bp2026/reconciliacao", { produto: produto ?? "", mes: String(mes ?? "") }],
    enabled: aberto,
  });

  return (
    <Sheet open={aberto} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-white dark:bg-zinc-900">
        <SheetHeader>
          <SheetTitle className="text-gray-900 dark:text-white">
            Reconciliação · {titulo} · {mes ? MESES[mes - 1] : ""} 2026
          </SheetTitle>
          <SheetDescription className="text-gray-600 dark:text-zinc-400">
            Movimento de MRR do fim do mês anterior até o fim deste mês.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {isLoading ? (
            <><Skeleton className="h-10 w-full" /><Skeleton className="h-40 w-full" /></>
          ) : error || !data ? (
            <p className="text-sm text-red-600 dark:text-red-400">Erro ao carregar a reconciliação.</p>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white">
                <span>MRR início (mês anterior)</span>
                <span className="tabular-nums">{fmtAbs(data.mrrInicio)}</span>
              </div>

              {data.componentes.map((c) => (
                <details key={c.chave} className="rounded-lg border border-gray-200 dark:border-zinc-700">
                  <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm text-gray-800 dark:text-zinc-200">
                    <span>{c.titulo} <span className="text-gray-400 dark:text-zinc-500">({c.n})</span></span>
                    <span className={`tabular-nums font-medium ${c.valor < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {fmt(c.valor)}
                    </span>
                  </summary>
                  <div className="border-t border-gray-100 dark:border-zinc-800">
                    {c.contratos.map((m) => (
                      <div key={m.id_subtask} className="flex items-start justify-between gap-2 px-3 py-1.5 text-xs border-b border-gray-50 dark:border-zinc-800/50 last:border-0">
                        <div className="min-w-0">
                          <p className="truncate text-gray-800 dark:text-zinc-200">{m.cliente}</p>
                          <p className="truncate text-gray-500 dark:text-zinc-500">
                            {[m.servico,
                              m.valorrIni && m.valorrFim ? `${fmtAbs(m.valorrIni)} → ${fmtAbs(m.valorrFim)}` : null,
                              c.chave === "saidas_sem_rastreio" ? `último ${m.ultimoSnapshot ?? "?"}` : null,
                              c.chave === "saidas_sem_rastreio" && m.emCupChurn === false ? "⚠ ausente em cup_churn" : null,
                            ].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <span className="shrink-0 tabular-nums text-gray-900 dark:text-white">{fmt(m.delta)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              ))}

              <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white">
                <span>MRR fim (este mês)</span>
                <span className="tabular-nums">{fmtAbs(data.mrrFim)}</span>
              </div>

              {!data.reconcilia && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠ Componentes não fecham com o MRR fim — investigar.
                </p>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Fiar o clique em `BP2026.tsx`**

Em `client/src/pages/BP2026.tsx`:

(a) importar o componente, perto dos outros imports:
```tsx
import { BPReconciliacao } from "@/components/bp2026/BPReconciliacao";
```

(b) adicionar estado, perto do `const [detalhe, setDetalhe] = useState(...)` (linha ~29):
```tsx
const [recon, setRecon] = useState<{ produto: string; mes: number; titulo: string } | null>(null);
const PRODUTOS_REVENUE = ["performance", "creators", "social", "gc", "others"];
```

(c) trocar APENAS o `onCellClick` da `<TabsContent value="revenue">` (a `BPDreTable` que recebe `linhas={data.revenue}`, ~linha 91) por um que intercepta MRR de produto:
```tsx
onCellClick={(metrica, mes) => {
  const prod = metrica.startsWith("mrr_") ? metrica.slice(4) : "";
  if (PRODUTOS_REVENUE.includes(prod)) {
    const titulo = data.revenue.find((l) => l.metrica === metrica)?.titulo ?? prod;
    setRecon({ produto: prod, mes, titulo });
  } else {
    setDetalhe({ metrica, mes });
  }
}}
```

(d) renderizar o painel, logo após `<BPCellDetail ... />` (~linha 152):
```tsx
<BPReconciliacao
  produto={recon?.produto ?? null}
  mes={recon?.mes ?? null}
  titulo={recon?.titulo ?? ""}
  onClose={() => setRecon(null)}
/>
```

- [ ] **Step 3: Verificar compilação**

Run: `npm run check`
Expected: sem erros novos.

- [ ] **Step 4: Validar no browser (dark e light)**

Run: `lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev` e abrir `http://localhost:3000/bp-2026` → aba Revenue.
Verificar:
- Clicar na célula de MRR — Performance de **Fevereiro** abre o painel de reconciliação.
- MRR início ≈ 509.412, MRR fim ≈ 510.012; componentes com sinais/cores corretos.
- Expandir "Saídas sem rastreio" lista **IANIS** (3×) e **Florest**, com "⚠ ausente em cup_churn".
- Testar em **dark e light**.
- Clicar numa célula de MRR Ativo (total) ou Churn ainda abre o `BPCellDetail` antigo (não quebrou).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/bp2026/BPReconciliacao.tsx client/src/pages/BP2026.tsx
git commit -m "feat(bp2026): painel de reconciliação de MRR ao clicar na célula de produto

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**
- Backfill (spec §4) → Task 1 ✓
- Lógica do waterfall + componentes (spec §5) → Task 2 ✓ (downsell separado de churn; bordas entregue/mudança de produto omitidas quando 0)
- Drill auditável + saídas com `ultimoSnapshot`/`emCupChurn` (spec §6) → Task 3 ✓
- Frontend drill-down (spec §7) → Task 4 ✓
- Testes/validação (spec §8): teste de reconciliação automatizado (Task 2 step 1) ✓; números conhecidos (Task 3 step 4, Task 4 step 4) ✓; backfill (Task 1) ✓
- Churn R$ atual intacta (spec §2): nenhuma task toca `bp2026.revenue.ts` churn ✓
- "Churn+downsell juntos no display, separáveis no drill": helper devolve `churn_cancel` e `churn_downsell` separados; o painel mostra os dois — decisão de fundir visualmente fica como possível ajuste de UI, dados já auditáveis ✓

**2. Placeholder scan:** sem TBD/TODO; todo passo de código tem código completo; comandos com expected output. ✓

**3. Type consistency:** `SnapRow`, `Componente`, `ContratoMov`, `computeReconciliacao` idênticos entre Task 2 (def), Task 3 (consumo) e Task 4 (shape JSON `valorrIni/valorrFim/delta`, `ultimoSnapshot/emCupChurn`). `CASE_PRODUTO` importado de `./bp2026.revenue`. ✓

**Nota de execução:** Task 1 depende de o `cup_data_hist` local ter os snapshots de jan/fev; se faltar, sincronizar do prod antes (ver `reference_databases.md`). Tasks 2→3→4 são sequenciais (3 consome 2, 4 consome 3).
