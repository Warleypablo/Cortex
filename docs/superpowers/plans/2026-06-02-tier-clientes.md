# Tier (cluster) dos Clientes — Implementation Plan (v1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar um ambiente para incluir/editar o tier (cluster) de cada cliente na tabela da tela LTV por Cliente, com sugestão automática por MRR e override manual.

**Architecture:** Reusa `"Clickup".cup_clientes.cluster` (valores "1"-"4" = NFNC/Regulares/Chaves/Imperdíveis) + nova coluna `cluster_manual`. Backend estende `/api/lt-ltv-churn/clientes` (cluster + sugestão) e adiciona PATCH (edição) + POST (aplicar automático em massa). Frontend adiciona coluna "Tier" editável na `ClientesTable`, filtro por tier e botão de aplicar sugestões.

**Tech Stack:** TypeScript, Express, Drizzle (`db.execute(sql\`...\`)`), Vitest + supertest, React, @tanstack/react-query, Tailwind, shadcn Select/Badge.

**Spec:** `docs/superpowers/specs/2026-06-02-tier-clientes-design.md`

**Validado em produção (2026-06-02):** join `cup_clientes.task_id = vw_lt_contratos.id_task` é 1:1 · MRR ativo: p50 R$3k / p75 R$5k / p90 R$9k · clusters em `shared/constants.ts` (`CLUSTER_OPTIONS`: 1=NFNC, 2=Regulares, 3=Chaves, 4=Imperdíveis).

---

## File Structure

- Migration: `"Clickup".cup_clientes` += `cluster_manual boolean DEFAULT false` (prod + local)
- Modify: `server/routes/ltLtvChurn.helpers.ts` — helper `sugerirTier`
- Modify: `server/routes/ltLtvChurn.helpers.test.ts` — testes do helper
- Modify: `server/routes/ltLtvChurn.ts` — `/clientes` estendido + `PATCH .../:idTask/tier` + `POST .../aplicar-tiers-auto`
- Modify: `server/routes/ltLtvChurn.test.ts` — testes dos endpoints
- Modify: `client/src/components/lt-ltv-churn/types.ts` — `ClienteRow` += campos de tier
- Modify: `client/src/components/lt-ltv-churn/ClientesTable.tsx` — coluna Tier editável + filtro + botão aplicar

---

## Task 1: Migração — coluna `cluster_manual` (prod + local)

**Files:** none (schema migration via psql)

- [ ] **Step 1: Add the column in PRODUCTION (idempotent)**

```bash
PSQL=$(command -v psql || echo /opt/homebrew/opt/postgresql@16/bin/psql); [ -x "$PSQL" ] || PSQL=/Library/PostgreSQL/16/bin/psql
PGPASSWORD='Turbosenha*' "$PSQL" -h 34.95.249.110 -U postgres -d dados_turbo -c \
  'ALTER TABLE "Clickup".cup_clientes ADD COLUMN IF NOT EXISTS cluster_manual boolean DEFAULT false;'
```
Expected: `ALTER TABLE`

- [ ] **Step 2: Add the column in LOCAL (idempotent)**

```bash
PGPASSWORD='dev123' "$PSQL" -h localhost -U cortex -d cortex_dev -c \
  'ALTER TABLE "Clickup".cup_clientes ADD COLUMN IF NOT EXISTS cluster_manual boolean DEFAULT false;' 2>&1 || echo "(local indisponível — ok, prod é a fonte do dev server)"
```
Expected: `ALTER TABLE` (ou aviso se o local não estiver rodando — não bloqueia, pois o dev server lê de produção)

- [ ] **Step 3: Verify in production**

```bash
PGPASSWORD='Turbosenha*' "$PSQL" -h 34.95.249.110 -U postgres -d dados_turbo -t -A -c \
  "SELECT column_name FROM information_schema.columns WHERE table_schema='Clickup' AND table_name='cup_clientes' AND column_name='cluster_manual';"
```
Expected: `cluster_manual`

(No commit — pure schema change.)

---

## Task 2: Helper `sugerirTier` (TDD)

**Files:**
- Modify: `server/routes/ltLtvChurn.helpers.ts`
- Test: `server/routes/ltLtvChurn.helpers.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `server/routes/ltLtvChurn.helpers.test.ts` (add `sugerirTier` to the existing import from `./ltLtvChurn.helpers`):

```ts
describe("sugerirTier", () => {
  it("classifica por faixa de MRR (NFNC/Regulares/Chaves/Imperdíveis)", () => {
    expect(sugerirTier(0)).toBe("1");
    expect(sugerirTier(1999)).toBe("1");
    expect(sugerirTier(2000)).toBe("2");
    expect(sugerirTier(3999)).toBe("2");
    expect(sugerirTier(4000)).toBe("3");
    expect(sugerirTier(6999)).toBe("3");
    expect(sugerirTier(7000)).toBe("4");
    expect(sugerirTier(30000)).toBe("4");
  });
  it("trata null/undefined como NFNC (cliente sem MRR ativo)", () => {
    expect(sugerirTier(null)).toBe("1");
    expect(sugerirTier(undefined)).toBe("1");
  });
});
```

The import line at the top of the file must become:
```ts
import { revenueChurnPct, resolveClienteSort, sugerirTier } from "./ltLtvChurn.helpers";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/mac0267/Cortex/.claude/worktrees/lt-ltv-churn-dashboard && npx vitest run server/routes/ltLtvChurn.helpers.test.ts`
Expected: FAIL — `sugerirTier is not a function`

- [ ] **Step 3: Implement the helper**

Append to `server/routes/ltLtvChurn.helpers.ts`:

```ts
/** Sugere o tier (cluster "1".."4") a partir do MRR ativo do cliente. */
export function sugerirTier(mrr: number | null | undefined): "1" | "2" | "3" | "4" {
  if (!mrr || mrr < 2000) return "1"; // NFNC
  if (mrr < 4000) return "2"; // Regulares
  if (mrr < 7000) return "3"; // Chaves
  return "4"; // Imperdíveis
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/routes/ltLtvChurn.helpers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/routes/ltLtvChurn.helpers.ts server/routes/ltLtvChurn.helpers.test.ts
git commit -m "feat(tier): helper sugerirTier por faixa de MRR"
```

---

## Task 3: Backend — endpoints de tier (TDD)

**Files:**
- Modify: `server/routes/ltLtvChurn.ts`
- Test: `server/routes/ltLtvChurn.test.ts`

- [ ] **Step 1: Add the failing tests**

In `server/routes/ltLtvChurn.test.ts`, replace the existing `/clientes` "retorna clientes agregados" test body's mock + assertions to include the new tier fields, AND add two new describe blocks. Concretely:

First, update the existing test inside `describe("GET /api/lt-ltv-churn/clientes", ...)` (the "retorna clientes agregados" one) so the second mock row includes the new columns and asserts them:

```ts
  it("retorna clientes agregados com tier e sugestão", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ total: 1387 }] });
    mockExecute.mockResolvedValueOnce({
      rows: [{ id_task: "t1", nome_cliente: "Cliente X", n_contratos_rec: 2,
        ltv_recorrente: 13000, ltv_pontual: 5000, ltv_total: 18000,
        lt_meses: 6.6, ativo: true, mrr_ativo: 8000, cluster: null, cluster_manual: false }],
    });
    const res = await request(makeApp()).get("/api/lt-ltv-churn/clientes");
    expect(res.status).toBe(200);
    expect(res.body.clientes[0].ltvTotal).toBe(18000);
    expect(res.body.clientes[0].mrrAtivo).toBe(8000);
    expect(res.body.clientes[0].cluster).toBeNull();
    expect(res.body.clientes[0].clusterSugerido).toBe("4"); // 8000 >= 7000 → Imperdíveis
  });
```

Then add, after the `describe("GET /api/lt-ltv-churn/clientes", ...)` block:

```ts
describe("PATCH /api/lt-ltv-churn/clientes/:idTask/tier", () => {
  it("salva o cluster manual", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });
    const res = await request(makeApp())
      .patch("/api/lt-ltv-churn/clientes/86abc/tier")
      .send({ cluster: "3" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("rejeita cluster inválido", async () => {
    const res = await request(makeApp())
      .patch("/api/lt-ltv-churn/clientes/86abc/tier")
      .send({ cluster: "9" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/lt-ltv-churn/clientes/aplicar-tiers-auto", () => {
  it("retorna a contagem de atualizados", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ atualizados: 1180 }] });
    const res = await request(makeApp()).post("/api/lt-ltv-churn/clientes/aplicar-tiers-auto");
    expect(res.status).toBe(200);
    expect(res.body.atualizados).toBe(1180);
  });

  it("retorna 500 em erro de banco", async () => {
    mockExecute.mockRejectedValueOnce(new Error("db down"));
    const res = await request(makeApp()).post("/api/lt-ltv-churn/clientes/aplicar-tiers-auto");
    expect(res.status).toBe(500);
  });
});
```

Note: the test app uses `express()` — ensure `express.json()` body parsing is active. The existing `makeApp()` may not call `express.json()`. Add it: in the test file's `makeApp()`, after `const app = express();`, add `app.use(express.json());` (if not already present).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/routes/ltLtvChurn.test.ts`
Expected: FAIL (new routes 404 / missing fields)

- [ ] **Step 3: Extend `/clientes` in `server/routes/ltLtvChurn.ts`**

Add `sugerirTier` to the helper import:
```ts
import { revenueChurnPct, resolveClienteSort, sugerirTier } from "./ltLtvChurn.helpers";
```

In the `/clientes` handler: (a) read the `cluster` filter param, (b) add `mrr_ativo` to `baseAgg`, (c) wrap with a cluster join, (d) extend the response map.

Add the param near the other query params (after `squad`):
```ts
      const cluster = (req.query.cluster as string) || undefined;
```

Add `mrr_ativo` inside `baseAgg`, right after the `lt_pontual` line (before the `lt_meses` CASE):
```ts
          ROUND(SUM(valorr) FILTER (WHERE tipo_receita='recorrente' AND status IN ('ativo','onboarding','triagem'))::numeric, 0) AS mrr_ativo,
```

Replace the `totalRes`/`rows` block with a version that joins `cup_clientes` and applies the cluster filter:
```ts
      const { col: sortCol, dir: sortDir } = resolveClienteSort(
        req.query.sort as string,
        req.query.dir as string,
      );

      const withCluster = sql`
        SELECT t.*, cc.cluster, COALESCE(cc.cluster_manual, false) AS cluster_manual
        FROM (${baseAgg}) t
        LEFT JOIN "Clickup".cup_clientes cc ON cc.task_id = t.id_task
        WHERE 1=1 ${cluster ? sql`AND cc.cluster = ${cluster}` : sql``}`;

      const totalRes = await db.execute(sql`SELECT COUNT(*) AS total FROM (${withCluster}) f`);
      const rows = (await db.execute(sql`
        SELECT * FROM (${withCluster}) f
        ORDER BY ${sql.raw(sortCol)} ${sql.raw(sortDir)} NULLS LAST
        LIMIT ${pageSize} OFFSET ${offset}`)).rows;
```

Extend the response map (the `clientes: rows.map(...)` object) to add the tier fields:
```ts
        clientes: rows.map((r: any) => {
          const mrrAtivo = Number(r.mrr_ativo) || 0;
          return {
            idTask: r.id_task, nomeCliente: r.nome_cliente,
            nContratosRec: Number(r.n_contratos_rec) || 0,
            ltvRecorrente: Number(r.ltv_recorrente) || 0,
            ltvPontual: Number(r.ltv_pontual) || 0,
            ltvTotal: Number(r.ltv_total) || 0,
            ltMeses: r.lt_meses != null ? Number(r.lt_meses) : null, ativo: r.ativo,
            mrrAtivo,
            cluster: r.cluster || null,
            clusterManual: !!r.cluster_manual,
            clusterSugerido: sugerirTier(mrrAtivo),
          };
        }),
```

- [ ] **Step 4: Add the PATCH and POST endpoints**

Immediately after the `/clientes` handler closes (after its `});`), add:
```ts
  app.patch("/api/lt-ltv-churn/clientes/:idTask/tier", async (req, res) => {
    try {
      const idTask = req.params.idTask;
      const cluster = (req.body?.cluster ?? null) as string | null;
      if (cluster !== null && !["1", "2", "3", "4"].includes(cluster)) {
        return res.status(400).json({ error: "Invalid cluster" });
      }
      await db.execute(sql`
        UPDATE "Clickup".cup_clientes
        SET cluster = ${cluster}, cluster_manual = ${cluster !== null}
        WHERE task_id = ${idTask}`);
      res.json({ ok: true });
    } catch (error) {
      console.error("[api] Error updating cliente tier:", error);
      res.status(500).json({ error: "Failed to update tier" });
    }
  });

  app.post("/api/lt-ltv-churn/clientes/aplicar-tiers-auto", async (_req, res) => {
    try {
      const r = await db.execute(sql`
        WITH upd AS (
          UPDATE "Clickup".cup_clientes cc SET cluster = CASE
              WHEN m.mrr >= 7000 THEN '4'
              WHEN m.mrr >= 4000 THEN '3'
              WHEN m.mrr >= 2000 THEN '2'
              ELSE '1' END
          FROM (
            SELECT id_task, SUM(valorr) FILTER (WHERE tipo_receita='recorrente'
                     AND status IN ('ativo','onboarding','triagem')) AS mrr
            FROM cortex_core.vw_lt_contratos GROUP BY id_task
          ) m
          WHERE cc.task_id = m.id_task AND COALESCE(cc.cluster_manual, false) = false
          RETURNING 1
        )
        SELECT COUNT(*) AS atualizados FROM upd`);
      res.json({ atualizados: Number(r.rows[0]?.atualizados) || 0 });
    } catch (error) {
      console.error("[api] Error applying auto tiers:", error);
      res.status(500).json({ error: "Failed to apply tiers" });
    }
  });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run server/routes/ltLtvChurn.test.ts server/routes/ltLtvChurn.helpers.test.ts`
Expected: PASS

- [ ] **Step 6: Typecheck and commit**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i ltLtvChurn || echo "no ltLtvChurn type errors"`
Expected: `no ltLtvChurn type errors`

```bash
git add server/routes/ltLtvChurn.ts server/routes/ltLtvChurn.test.ts
git commit -m "feat(tier): /clientes com tier+sugestao, PATCH tier e aplicar-auto"
```

---

## Task 4: Frontend — tipos

**Files:** Modify `client/src/components/lt-ltv-churn/types.ts`

- [ ] **Step 1: Extend `ClienteRow`**

Replace the existing `ClienteRow` interface with:
```ts
export interface ClienteRow {
  idTask: string;
  nomeCliente: string | null;
  nContratosRec: number;
  ltvRecorrente: number;
  ltvPontual: number;
  ltvTotal: number;
  ltMeses: number | null;
  ativo: boolean;
  mrrAtivo: number;
  cluster: string | null;
  clusterManual: boolean;
  clusterSugerido: string;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "lt-ltv-churn/types" || echo "ok"`
Expected: `ok` (ClientesTable will be updated in Task 5; transient errors there are fine until then)

- [ ] **Step 3: Commit**

```bash
git add client/src/components/lt-ltv-churn/types.ts
git commit -m "feat(tier): tipos de tier em ClienteRow"
```

---

## Task 5: Frontend — coluna Tier editável + filtro + botão aplicar

**Files:** Modify `client/src/components/lt-ltv-churn/ClientesTable.tsx`

This rewrites `ClientesTable.tsx` to add: a tier filter (Select), an "Aplicar sugestões automáticas" button, and an editable "Tier" column (Select per row that PATCHes). It keeps the existing sortable headers.

- [ ] **Step 1: Replace `client/src/components/lt-ltv-churn/ClientesTable.tsx` with:**

```tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { CLUSTER_OPTIONS, CLUSTER_MAP } from "@shared/constants";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { fetchJson, buildUrl } from "./utils";
import type { ClienteRow } from "./types";

type Dir = "asc" | "desc";

const CLUSTER_COLOR: Record<string, string> = Object.fromEntries(
  CLUSTER_OPTIONS.map((o) => [o.value, o.color]),
);

export function ClientesTable({ produto, status }: { produto?: string; status?: string }) {
  const qc = useQueryClient();
  const [sort, setSort] = useState<string>("ltvTotal");
  const [dir, setDir] = useState<Dir>("desc");
  const [tier, setTier] = useState<string>("todos");
  const [msg, setMsg] = useState<string>("");

  const tierParam = tier === "todos" ? undefined : tier;

  const queryKey = ["/api/lt-ltv-churn/clientes", produto, status, sort, dir, tier];
  const { data: clientes } = useQuery({
    queryKey,
    queryFn: () =>
      fetchJson<{ clientes: ClienteRow[]; total: number }>(
        buildUrl("/api/lt-ltv-churn/clientes", {
          page: "1", produto, status, sort, dir, cluster: tierParam,
        })
      ),
  });

  const setTierMut = useMutation({
    mutationFn: async ({ idTask, cluster }: { idTask: string; cluster: string | null }) => {
      const res = await fetch(`/api/lt-ltv-churn/clientes/${idTask}/tier`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cluster }),
      });
      if (!res.ok) throw new Error("falha ao salvar tier");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/lt-ltv-churn/clientes"] }),
  });

  const aplicarMut = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/lt-ltv-churn/clientes/aplicar-tiers-auto", { method: "POST" });
      if (!res.ok) throw new Error("falha ao aplicar");
      return (await res.json()) as { atualizados: number };
    },
    onSuccess: (d) => {
      setMsg(`${d.atualizados} clientes atualizados`);
      qc.invalidateQueries({ queryKey: ["/api/lt-ltv-churn/clientes"] });
    },
  });

  function toggleSort(col: string) {
    if (sort === col) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSort(col); setDir("desc"); }
  }

  function onTierChange(idTask: string, value: string) {
    const cluster = value === "__clear__" ? null : value;
    setTierMut.mutate({ idTask, cluster });
  }

  function SortHead({ col, label, align = "left" }: { col: string; label: string; align?: "left" | "right" }) {
    const active = sort === col;
    const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <TableHead className={align === "right" ? "text-right" : ""}>
        <button
          type="button"
          onClick={() => toggleSort(col)}
          className={`inline-flex w-full items-center gap-1 ${
            align === "right" ? "justify-end" : "justify-start"
          } hover:text-gray-900 dark:hover:text-white ${active ? "text-gray-900 dark:text-white" : ""}`}
        >
          {label}
          <Icon className={`h-3.5 w-3.5 ${active ? "opacity-100" : "opacity-40"}`} />
        </button>
      </TableHead>
    );
  }

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
            Clientes ({clientes?.total ?? 0})
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {msg && <span className="text-xs text-gray-500 dark:text-zinc-400">{msg}</span>}
            <Button
              variant="outline"
              size="sm"
              disabled={aplicarMut.isPending}
              onClick={() => aplicarMut.mutate()}
            >
              {aplicarMut.isPending ? "Aplicando…" : "Aplicar sugestões automáticas"}
            </Button>
            <Select value={tier} onValueChange={setTier}>
              <SelectTrigger className="w-[150px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tiers</SelectItem>
                {CLUSTER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {!clientes ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">Carregando…</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead col="nome" label="Cliente" />
                  <TableHead>Tier</TableHead>
                  <SortHead col="contratos" label="Contratos" align="right" />
                  <TableHead>Status</TableHead>
                  <SortHead col="lt" label="LT (m)" align="right" />
                  <SortHead col="ltvRecorrente" label="LTV recorr." align="right" />
                  <SortHead col="ltvPontual" label="LTV pontual" align="right" />
                  <SortHead col="ltvTotal" label="LTV total" align="right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.clientes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">
                      Nenhum cliente encontrado
                    </TableCell>
                  </TableRow>
                )}
                {clientes.clientes.map((c) => (
                  <TableRow key={c.idTask}>
                    <TableCell className="font-medium">{c.nomeCliente ?? "—"}</TableCell>
                    <TableCell>
                      <Select
                        value={c.cluster ?? ""}
                        onValueChange={(v) => onTierChange(c.idTask, v)}
                      >
                        <SelectTrigger className="h-7 w-[150px] border-gray-200 dark:border-zinc-700/50 bg-transparent">
                          {c.cluster && CLUSTER_MAP[c.cluster] ? (
                            <Badge variant="outline" className={CLUSTER_COLOR[c.cluster]}>
                              {CLUSTER_MAP[c.cluster]}
                            </Badge>
                          ) : (
                            <span className="text-xs italic text-gray-400 dark:text-zinc-500">
                              sugere: {CLUSTER_MAP[c.clusterSugerido] ?? "—"}
                            </span>
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {CLUSTER_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                          <SelectItem value="__clear__">Limpar (automático)</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">{c.nContratosRec}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{c.ativo ? "Ativo" : "Cancelado"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {c.ltMeses != null ? c.ltMeses : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrencyNoDecimals(c.ltvRecorrente)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrencyNoDecimals(c.ltvPontual)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrencyNoDecimals(c.ltvTotal)}
                    </TableCell>
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

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "ClientesTable" || echo "ok"`
Expected: `ok`

(If `@/components/ui/button` import path differs, confirm with `ls client/src/components/ui/button.tsx`; the project uses shadcn so it should exist.)

- [ ] **Step 3: Commit**

```bash
git add client/src/components/lt-ltv-churn/ClientesTable.tsx
git commit -m "feat(tier): coluna Tier editavel, filtro e botao aplicar na tabela de clientes"
```

---

## Task 6: Validação E2E

**Files:** none (validation only)

- [ ] **Step 1: Run the module tests**

Run: `npx vitest run server/routes/ltLtvChurn.test.ts server/routes/ltLtvChurn.helpers.test.ts`
Expected: PASS (all green)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "ltLtvChurn|ClientesTable|lt-ltv-churn/types" || echo "no relevant type errors"`
Expected: `no relevant type errors`

- [ ] **Step 3: Restart dev server and smoke-test**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null
ENABLE_DEV_LOGIN=true npm run dev &
curl -s --retry 60 --retry-delay 1 --retry-connrefused --retry-all-errors \
  -c /tmp/tier-cookie.txt -X POST http://localhost:3000/auth/dev-login >/dev/null
C=/tmp/tier-cookie.txt
echo "--- clientes (tem cluster + clusterSugerido?) ---"
curl -s -b $C "http://localhost:3000/api/lt-ltv-churn/clientes" | python3 -c "import sys,json; c=json.load(sys.stdin)['clientes'][0]; print(c['nomeCliente'],'| mrr',c['mrrAtivo'],'| cluster',c['cluster'],'| sugerido',c['clusterSugerido'])"
echo "--- PATCH tier (define Chaves para 1 cliente) ---"
IDT=$(curl -s -b $C "http://localhost:3000/api/lt-ltv-churn/clientes" | python3 -c "import sys,json; print(json.load(sys.stdin)['clientes'][0]['idTask'])")
curl -s -b $C -X PATCH "http://localhost:3000/api/lt-ltv-churn/clientes/$IDT/tier" -H "Content-Type: application/json" -d '{"cluster":"3"}'
echo ""
echo "--- confirma persistência (cluster=3, manual) ---"
curl -s -b $C "http://localhost:3000/api/lt-ltv-churn/clientes?cluster=3" | python3 -c "import sys,json; d=json.load(sys.stdin); print('total tier Chaves:',d['total'])"
echo "--- aplicar automático ---"
curl -s -b $C -X POST "http://localhost:3000/api/lt-ltv-churn/clientes/aplicar-tiers-auto"
```

Expected:
- `/clientes`: primeiro cliente com `mrrAtivo`, `cluster` e `clusterSugerido` (ex.: Phooto mrr 25000 → sugerido "4")
- PATCH: `{"ok":true}`
- `?cluster=3`: total ≥ 1 (o cliente que acabamos de marcar)
- aplicar-auto: `{"atualizados": N}` com N grande (preenche os não-manuais)

- [ ] **Step 4: Visual check no browser (dark + light)**

Abrir `http://localhost:3000/ltv-clientes`. Verificar:
- Coluna "Tier" entre Cliente e Contratos: badge colorido quando atribuído, "sugere: X" em cinza quando vazio
- Clicar no Tier de uma linha → dropdown com NFNC/Regulares/Chaves/Imperdíveis + "Limpar (automático)"; escolher salva e o badge aparece
- Botão "Aplicar sugestões automáticas" → preenche os tiers vazios; mostra "N clientes atualizados"
- Filtro "Tier" no topo → filtra a tabela por tier
- Headers de ordenação continuam funcionando
- Dark E light legíveis

- [ ] **Step 5: Stop the dev server**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; echo "dev server parado"
```

---

## Self-Review

**1. Spec coverage:**
- Migração `cluster_manual` (prod+local) → Task 1 ✓
- Reusar cluster existente (valores 1-4) → Tasks 3/5 usam `cup_clientes.cluster` + `CLUSTER_OPTIONS` ✓
- Sugestão automática por MRR (faixas) → Task 2 `sugerirTier` + Task 3 (`clusterSugerido`, aplicar-auto CASE) ✓
- Override manual (não sobrescrever) → Task 3 PATCH seta `cluster_manual=true`; aplicar-auto filtra `cluster_manual=false` ✓
- Ambiente = coluna editável na tabela → Task 5 ✓
- Botão aplicar em massa (respeita manuais, todos os clientes) → Task 3 (endpoint) + Task 5 (botão) ✓
- Filtro por tier → Task 3 (param `cluster`) + Task 5 (Select) ✓
- Endpoint focado (não reusar PATCH genérico) → Task 3 cria `PATCH .../:idTask/tier` dedicado ✓
- Edge cases (cancelado→NFNC, cluster inválido, limpar→auto) → `sugerirTier(null)="1"`, validação 400, `cluster=null → cluster_manual=false` ✓

**2. Placeholder scan:** Sem "TBD"/"implementar depois"; todo SQL/JSX/TS completo. ✓

**3. Type consistency:**
- `ClienteRow` (Task 4) com `mrrAtivo`, `cluster: string|null`, `clusterManual`, `clusterSugerido` — usado em Task 5 e batendo com o retorno do `/clientes` (Task 3). ✓
- `sugerirTier` retorna `"1"|"2"|"3"|"4"`; `cluster` no PATCH validado contra `["1","2","3","4"]`; `CLUSTER_OPTIONS`/`CLUSTER_MAP` usam as mesmas chaves. ✓
- Endpoint `PATCH .../:idTask/tier` e `POST .../aplicar-tiers-auto` — mesmos paths no backend (Task 3) e no frontend (Task 5). ✓

**Nota:** o filtro `?cluster=` e o sort coexistem; `resolveClienteSort` continua com sua whitelist (tier não é coluna ordenável — fora da whitelist, por design).
