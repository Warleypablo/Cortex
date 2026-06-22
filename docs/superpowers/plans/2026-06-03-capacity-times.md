# Capacity por Times — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nova página `/capacity-times` mostrando ocupação atual (ao vivo, de `cup_contratos`) vs. capacidade-alvo (fixa, semeada) por pessoa, nos times CS, Vendedores, Accounts e Gestores.

**Architecture:** Tabela `cortex_core.capacity_metas` guarda as metas (seed idempotente no boot). Um endpoint `GET /api/capacity-times` casa cada pessoa em `cup_contratos.responsavel` (única coluna populada), agrega operando (recorrente/MRR/pontual) e devolve agrupado por categoria. A lógica de shaping (utilização, diferenças, agrupamento) fica em helpers puros testados; a página React espelha `Capacity.tsx` com abas por categoria.

**Tech Stack:** TypeScript, Express + Drizzle (`db.execute(sql\`\`)`), Postgres, React + React Query + shadcn/ui + Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-03-capacity-times-design.md`

**Branch:** `feature/capacity-times` (já criada).

---

## File Structure

| Arquivo | Responsabilidade | Ação |
|---------|------------------|------|
| `server/db.ts` | DDL `initializeCapacityMetasTable()` | Modificar |
| `server/seed/capacityMetas.ts` | Dados do seed + `seedCapacityMetas()` | Criar |
| `server/seed/capacityMetas.test.ts` | Teste de integridade do seed | Criar |
| `server/routes/capacityTimes.helpers.ts` | Tipos + utilização/diff/shaping (puro) | Criar |
| `server/routes/capacityTimes.helpers.test.ts` | Testes dos helpers | Criar |
| `server/routes/capacity.ts` | Endpoint `GET /api/capacity-times` | Modificar |
| `server/index.ts` | Wire boot (init table + seed) | Modificar |
| `client/src/pages/CapacityTimes.tsx` | Página com abas/tabelas | Criar |
| `client/src/App.tsx` | Rota `/capacity-times` | Modificar |
| `shared/nav-config.ts` | Permissão + rota + item de menu | Modificar |

---

## Task 1: Tabela `capacity_metas` + wiring no boot

**Files:**
- Modify: `server/db.ts` (após `initializeCapacityTable`, ~linha 2265)
- Modify: `server/index.ts` (import ~linha 10; Fase 1 ~linha 143)

- [ ] **Step 1: Adicionar a função de DDL em `server/db.ts`** (logo após o fim de `initializeCapacityTable`, antes de `initializeBroadcastLeadEventsTable`)

```ts
export async function initializeCapacityMetasTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_core.capacity_metas (
        id                SERIAL PRIMARY KEY,
        nome              TEXT NOT NULL,
        match_responsavel TEXT NOT NULL,
        categoria         TEXT NOT NULL,
        cap_recorrente    INTEGER,
        cap_mrr           NUMERIC,
        cap_pontual       INTEGER,
        cap_contas        INTEGER,
        ordem             INTEGER DEFAULT 0,
        ativo             BOOLEAN DEFAULT TRUE,
        atualizado_em     TIMESTAMP DEFAULT NOW(),
        UNIQUE(match_responsavel, categoria)
      )
    `);
    console.log('[database] capacity_metas table initialized');
  } catch (error) {
    console.error('[database] Error initializing capacity_metas table:', error);
  }
}
```

- [ ] **Step 2: Importar a função no boot** — em `server/index.ts` linha 10, adicionar `initializeCapacityMetasTable` à lista do `import { ... } from "./db";` (logo após `initializeCapacityTable`).

- [ ] **Step 3: Chamar no array da Fase 1** — em `server/index.ts`, dentro do `Promise.all([...])` (~linha 143), adicionar a linha logo abaixo de `initializeCapacityTable(),`:

```ts
    initializeCapacityMetasTable(),
```

- [ ] **Step 4: Subir o servidor e verificar a criação da tabela**

Run:
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
sleep 8
PGPASSWORD=dev123 psql -h localhost -U cortex -d cortex_dev -c "\d cortex_core.capacity_metas"
```
Expected: a definição da tabela é impressa (colunas `id, nome, match_responsavel, categoria, cap_recorrente, cap_mrr, cap_pontual, cap_contas, ordem, ativo, atualizado_em`).

- [ ] **Step 5: Commit**

```bash
git add server/db.ts server/index.ts
git commit -m "feat(capacity-times): add capacity_metas table + boot init

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Seed das metas (dados da planilha)

**Files:**
- Create: `server/seed/capacityMetas.ts`
- Create: `server/seed/capacityMetas.test.ts`
- Modify: `server/index.ts` (Fase 3, ~linha 161)

- [ ] **Step 1: Escrever o teste de integridade do seed (FALHA primeiro)** — `server/seed/capacityMetas.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { CAPACITY_METAS_SEED } from "./capacityMetas";

describe("CAPACITY_METAS_SEED", () => {
  it("tem a contagem esperada por categoria", () => {
    const byCat = (c: string) => CAPACITY_METAS_SEED.filter((m) => m.categoria === c).length;
    expect(byCat("cs")).toBe(11);
    expect(byCat("vendedor")).toBe(6);
    expect(byCat("account")).toBe(4);
    expect(byCat("gestor")).toBe(7);
    expect(CAPACITY_METAS_SEED).toHaveLength(28);
  });

  it("não tem (match_responsavel, categoria) duplicado", () => {
    const keys = CAPACITY_METAS_SEED.map((m) => `${m.categoria}::${m.match_responsavel}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("CS tem cap_recorrente; comerciais têm cap_mrr e cap_contas", () => {
    for (const m of CAPACITY_METAS_SEED) {
      if (m.categoria === "cs") {
        expect(m.cap_recorrente).not.toBeNull();
      } else {
        expect(m.cap_mrr).not.toBeNull();
        expect(m.cap_contas).not.toBeNull();
      }
    }
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar a falha**

Run: `npx vitest run server/seed/capacityMetas.test.ts`
Expected: FAIL — `Cannot find module './capacityMetas'`.

- [ ] **Step 3: Criar `server/seed/capacityMetas.ts` com os dados + função de upsert**

```ts
import { sql } from "drizzle-orm";
import { db } from "../db";
import type { Categoria } from "../routes/capacityTimes.helpers";

export interface CapacityMetaSeed {
  nome: string;
  match_responsavel: string;
  categoria: Categoria;
  cap_recorrente: number | null;
  cap_mrr: number | null;
  cap_pontual: number | null;
  cap_contas: number | null;
  ordem: number;
}

export const CAPACITY_METAS_SEED: CapacityMetaSeed[] = [
  // ── CS ──
  { nome: "Brenda",        match_responsavel: "Brenda Federici",    categoria: "cs", cap_recorrente: 15, cap_mrr: 45000, cap_pontual: 0,  cap_contas: null, ordem: 1 },
  { nome: "Fernanda",      match_responsavel: "Fernanda Almeida",   categoria: "cs", cap_recorrente: 16, cap_mrr: 40000, cap_pontual: 0,  cap_contas: null, ordem: 2 },
  { nome: "Karla",         match_responsavel: "Karla Pin",          categoria: "cs", cap_recorrente: 14, cap_mrr: 30000, cap_pontual: 0,  cap_contas: null, ordem: 3 },
  { nome: "Iasmim",        match_responsavel: "Iasmim Torres",      categoria: "cs", cap_recorrente: 15, cap_mrr: 45000, cap_pontual: 0,  cap_contas: null, ordem: 4 },
  { nome: "Victor (CS)",   match_responsavel: "Victor Klein",       categoria: "cs", cap_recorrente: 12, cap_mrr: 45000, cap_pontual: 10, cap_contas: null, ordem: 5 },
  { nome: "Mariana Dalto", match_responsavel: "Mariana Dalto",      categoria: "cs", cap_recorrente: 20, cap_mrr: null,  cap_pontual: null, cap_contas: null, ordem: 6 },
  { nome: "Lara Grobério", match_responsavel: "Lara Grobério",      categoria: "cs", cap_recorrente: 20, cap_mrr: null,  cap_pontual: null, cap_contas: null, ordem: 7 },
  { nome: "Julia Manhães", match_responsavel: "Julia Manhães",      categoria: "cs", cap_recorrente: 20, cap_mrr: null,  cap_pontual: null, cap_contas: null, ordem: 8 },
  { nome: "Debora",        match_responsavel: "Debora Mund",        categoria: "cs", cap_recorrente: 25, cap_mrr: null,  cap_pontual: null, cap_contas: null, ordem: 9 },
  { nome: "Larissa",       match_responsavel: "Larissa Farias",     categoria: "cs", cap_recorrente: 25, cap_mrr: null,  cap_pontual: null, cap_contas: null, ordem: 10 },
  { nome: "Ana",           match_responsavel: "Ana Clara Cordeiro", categoria: "cs", cap_recorrente: 20, cap_mrr: null,  cap_pontual: null, cap_contas: null, ordem: 11 },

  // ── Vendedores / Closers ──
  { nome: "Gabriel Taufner", match_responsavel: "Gabriel Taufner", categoria: "vendedor", cap_recorrente: null, cap_mrr: 107510,    cap_pontual: null, cap_contas: 30, ordem: 1 },
  { nome: "Bruno da Silva",  match_responsavel: "Bruno Da Silva",  categoria: "vendedor", cap_recorrente: null, cap_mrr: 100077.69, cap_pontual: null, cap_contas: 30, ordem: 2 },
  { nome: "José Neto",       match_responsavel: "José Neto",       categoria: "vendedor", cap_recorrente: null, cap_mrr: 73446.43,  cap_pontual: null, cap_contas: 30, ordem: 3 },
  { nome: "Gabriel Magno",   match_responsavel: "Gabriel Magno",   categoria: "vendedor", cap_recorrente: null, cap_mrr: 54330.91,  cap_pontual: null, cap_contas: 20, ordem: 4 },
  { nome: "Felipe Almeida",  match_responsavel: "Felipe Almeida",  categoria: "vendedor", cap_recorrente: null, cap_mrr: 65812.50,  cap_pontual: null, cap_contas: 20, ordem: 5 },
  { nome: "Richard Meira",   match_responsavel: "Richard Meira",   categoria: "vendedor", cap_recorrente: null, cap_mrr: 59980,     cap_pontual: null, cap_contas: 20, ordem: 6 },

  // ── Accounts ──
  { nome: "Moises",       match_responsavel: "Moises Silva Fernandes", categoria: "account", cap_recorrente: null, cap_mrr: 76085.63, cap_pontual: null, cap_contas: 30, ordem: 1 },
  { nome: "Pedro",        match_responsavel: "Pedro Antonio",          categoria: "account", cap_recorrente: null, cap_mrr: 86685,    cap_pontual: null, cap_contas: 30, ordem: 2 },
  { nome: "Leonardo Acc", match_responsavel: "Leonardo",               categoria: "account", cap_recorrente: null, cap_mrr: 104650,   cap_pontual: null, cap_contas: 25, ordem: 3 },
  { nome: "Breno Acc",    match_responsavel: "Breno Carmo",            categoria: "account", cap_recorrente: null, cap_mrr: 60376.56, cap_pontual: null, cap_contas: 25, ordem: 4 },

  // ── Gestores / Accounts Prime ──
  { nome: "Victor Arpini (Account Prime)", match_responsavel: "Victor Arpini",      categoria: "gestor", cap_recorrente: null, cap_mrr: 57411.76, cap_pontual: null, cap_contas: 10, ordem: 1 },
  { nome: "Jonatas (Account)",             match_responsavel: "Jônatas Cavalcante", categoria: "gestor", cap_recorrente: null, cap_mrr: 67396.88, cap_pontual: null, cap_contas: 25, ordem: 2 },
  { nome: "Renan (Account)",               match_responsavel: "Renan Fortunato",    categoria: "gestor", cap_recorrente: null, cap_mrr: 70126.04, cap_pontual: null, cap_contas: 25, ordem: 3 },
  { nome: "Thiago Andrey (Gestor Prime)",  match_responsavel: "Thiago Andrey",      categoria: "gestor", cap_recorrente: null, cap_mrr: 77085,    cap_pontual: null, cap_contas: 15, ordem: 4 },
  { nome: "Thiago Martins (Gestor Prime)", match_responsavel: "Thiago Martins",     categoria: "gestor", cap_recorrente: null, cap_mrr: 81794.06, cap_pontual: null, cap_contas: 15, ordem: 5 },
  { nome: "Allan (Gestor)",                match_responsavel: "Allan",              categoria: "gestor", cap_recorrente: null, cap_mrr: 84151.25, cap_pontual: null, cap_contas: 30, ordem: 6 },
  { nome: "Victor Matsushita (Gestor)",    match_responsavel: "Victor Matsushita",  categoria: "gestor", cap_recorrente: null, cap_mrr: 81652.11, cap_pontual: null, cap_contas: 30, ordem: 7 },
];

export async function seedCapacityMetas(): Promise<void> {
  try {
    for (const m of CAPACITY_METAS_SEED) {
      await db.execute(sql`
        INSERT INTO cortex_core.capacity_metas
          (nome, match_responsavel, categoria, cap_recorrente, cap_mrr, cap_pontual, cap_contas, ordem)
        VALUES (${m.nome}, ${m.match_responsavel}, ${m.categoria}, ${m.cap_recorrente},
                ${m.cap_mrr}, ${m.cap_pontual}, ${m.cap_contas}, ${m.ordem})
        ON CONFLICT (match_responsavel, categoria) DO UPDATE SET
          nome = EXCLUDED.nome,
          cap_recorrente = EXCLUDED.cap_recorrente,
          cap_mrr = EXCLUDED.cap_mrr,
          cap_pontual = EXCLUDED.cap_pontual,
          cap_contas = EXCLUDED.cap_contas,
          ordem = EXCLUDED.ordem,
          atualizado_em = NOW()
      `);
    }
    console.log(`[database] capacity_metas seeded (${CAPACITY_METAS_SEED.length} rows)`);
  } catch (error) {
    console.error('[database] Error seeding capacity_metas:', error);
  }
}
```

> Nota: este arquivo importa o tipo `Categoria` de `../routes/capacityTimes.helpers` (criado na Task 3). Faça a Task 3 antes do Step 6 (rodar o seed no boot) — o teste do Step 4 só usa `CAPACITY_METAS_SEED` e o `import type` não é avaliado em runtime pelo Vitest, então passa mesmo antes da Task 3.

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run server/seed/capacityMetas.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Wire do seed no boot** — em `server/index.ts`:
  1. Adicionar ao topo: `import { seedCapacityMetas } from "./seed/capacityMetas";`
  2. No `Promise.all` da Fase 3 (~linha 161), adicionar após `seedChamadoCategories(),`:

```ts
    seedCapacityMetas(),
```

- [ ] **Step 6: Subir o servidor e validar o seed (após Task 3 existir)**

Run:
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
sleep 8
PGPASSWORD=dev123 psql -h localhost -U cortex -d cortex_dev -t -A -F'|' -c \
"SELECT categoria, count(*) FROM cortex_core.capacity_metas GROUP BY categoria ORDER BY categoria;"
```
Expected: `account|4`, `cs|11`, `gestor|7`, `vendedor|6`.

- [ ] **Step 7: Commit**

```bash
git add server/seed/capacityMetas.ts server/seed/capacityMetas.test.ts server/index.ts
git commit -m "feat(capacity-times): seed capacity_metas from spreadsheet

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> **Produção:** o seed roda no boot via `ON CONFLICT DO UPDATE`, então aplica-se automaticamente em produção no próximo deploy/restart (ver [[feedback_db_prod_sync]]). Não precisa de psql manual em prod.

---

## Task 3: Helpers puros de shaping (utilização, diferenças, agrupamento)

**Files:**
- Create: `server/routes/capacityTimes.helpers.ts`
- Test: `server/routes/capacityTimes.helpers.test.ts`

- [ ] **Step 1: Escrever os testes (FALHA primeiro)** — `server/routes/capacityTimes.helpers.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  utilPct, diff, num, numOrNull, parseAggRow, buildResponse,
  type CapacityAggRow,
} from "./capacityTimes.helpers";

describe("utilPct", () => {
  it("calcula % com 1 casa decimal", () => {
    expect(utilPct(43004, 107510)).toBe(40);
    expect(utilPct(58094, 58094)).toBe(100);
  });
  it("retorna null quando cap é null ou zero", () => {
    expect(utilPct(10, null)).toBeNull();
    expect(utilPct(10, 0)).toBeNull();
  });
});

describe("diff", () => {
  it("retorna cap - atual, ou null quando cap é null", () => {
    expect(diff(30, 12)).toBe(18);
    expect(diff(null, 12)).toBeNull();
  });
});

describe("num / numOrNull", () => {
  it("num coage strings do pg em número, default 0", () => {
    expect(num("58094")).toBe(58094);
    expect(num(null)).toBe(0);
  });
  it("numOrNull preserva null", () => {
    expect(numOrNull(null)).toBeNull();
    expect(numOrNull("45000")).toBe(45000);
  });
});

describe("parseAggRow", () => {
  it("coage uma linha crua do pg", () => {
    const raw = {
      nome: "Brenda", categoria: "cs",
      cap_recorrente: "15", cap_mrr: "45000", cap_pontual: "0", cap_contas: null,
      op_recorrente: "10", mrr_operando: "30238", mrr_ativo: "30238",
      mrr_onboarding: "0", mrr_cancelamento: "0", op_pontual: "0",
    };
    const r = parseAggRow(raw);
    expect(r.cap_recorrente).toBe(15);
    expect(r.cap_contas).toBeNull();
    expect(r.op_recorrente).toBe(10);
    expect(r.mrr_operando).toBe(30238);
  });
});

describe("buildResponse", () => {
  const rows: CapacityAggRow[] = [
    { nome: "Brenda", categoria: "cs", cap_recorrente: 15, cap_mrr: 45000, cap_pontual: 0, cap_contas: null,
      op_recorrente: 10, mrr_operando: 30238, mrr_ativo: 30238, mrr_onboarding: 0, mrr_cancelamento: 0, op_pontual: 0 },
    { nome: "Mariana Dalto", categoria: "cs", cap_recorrente: 20, cap_mrr: null, cap_pontual: null, cap_contas: null,
      op_recorrente: 6, mrr_operando: 36488, mrr_ativo: 29488, mrr_onboarding: 0, mrr_cancelamento: 7000, op_pontual: 11 },
    { nome: "Gabriel Taufner", categoria: "vendedor", cap_recorrente: null, cap_mrr: 107510, cap_pontual: null, cap_contas: 30,
      op_recorrente: 12, mrr_operando: 43004, mrr_ativo: 43004, mrr_onboarding: 0, mrr_cancelamento: 0, op_pontual: 0 },
  ];

  it("agrupa por categoria", () => {
    const out = buildResponse(rows);
    expect(out.cs).toHaveLength(2);
    expect(out.vendedor).toHaveLength(1);
    expect(out.account).toHaveLength(0);
    expect(out.gestor).toHaveLength(0);
  });

  it("CS com cap_mrr usa utilização por MRR", () => {
    const brenda = buildResponse(rows).cs.find((r) => r.nome === "Brenda")!;
    expect(brenda.util_pct).toBe(utilPct(30238, 45000)); // ~67.2
    expect(brenda.op_total).toBe(10);
  });

  it("CS sem cap_mrr usa utilização por total de contas (rec+pont)", () => {
    const mari = buildResponse(rows).cs.find((r) => r.nome === "Mariana Dalto")!;
    expect(mari.op_total).toBe(17);
    expect(mari.util_pct).toBe(utilPct(17, 20)); // 85
  });

  it("comercial calcula diferenças e utilização por MRR", () => {
    const g = buildResponse(rows).vendedor[0];
    expect(g.dif_mrr).toBe(107510 - 43004);
    expect(g.dif_contas).toBe(30 - 12);
    expect(g.util_pct).toBe(utilPct(43004, 107510));
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run server/routes/capacityTimes.helpers.test.ts`
Expected: FAIL — `Cannot find module './capacityTimes.helpers'`.

- [ ] **Step 3: Implementar `server/routes/capacityTimes.helpers.ts`**

```ts
export type Categoria = "cs" | "vendedor" | "account" | "gestor";

export interface CapacityAggRow {
  nome: string;
  categoria: Categoria;
  cap_recorrente: number | null;
  cap_mrr: number | null;
  cap_pontual: number | null;
  cap_contas: number | null;
  op_recorrente: number;
  mrr_operando: number;
  mrr_ativo: number;
  mrr_onboarding: number;
  mrr_cancelamento: number;
  op_pontual: number;
}

export interface CsRow {
  nome: string;
  op_recorrente: number;
  cap_recorrente: number | null;
  op_pontual: number;
  cap_pontual: number | null;
  op_total: number;
  mrr_operando: number;
  mrr_ativo: number;
  mrr_onboarding: number;
  mrr_cancelamento: number;
  cap_mrr: number | null;
  util_pct: number | null;
}

export interface ComercialRow {
  nome: string;
  mrr_atual: number;
  cap_mrr: number | null;
  dif_mrr: number | null;
  contas_ativas: number;
  cap_contas: number | null;
  dif_contas: number | null;
  util_pct: number | null;
}

export interface CapacityTimesResponse {
  cs: CsRow[];
  vendedor: ComercialRow[];
  account: ComercialRow[];
  gestor: ComercialRow[];
}

export function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

export function utilPct(atual: number, cap: number | null | undefined): number | null {
  if (cap === null || cap === undefined || cap === 0) return null;
  return Math.round((atual / cap) * 1000) / 10;
}

export function diff(cap: number | null | undefined, atual: number): number | null {
  if (cap === null || cap === undefined) return null;
  return cap - atual;
}

export function parseAggRow(raw: any): CapacityAggRow {
  return {
    nome: String(raw.nome),
    categoria: raw.categoria as Categoria,
    cap_recorrente: numOrNull(raw.cap_recorrente),
    cap_mrr: numOrNull(raw.cap_mrr),
    cap_pontual: numOrNull(raw.cap_pontual),
    cap_contas: numOrNull(raw.cap_contas),
    op_recorrente: num(raw.op_recorrente),
    mrr_operando: num(raw.mrr_operando),
    mrr_ativo: num(raw.mrr_ativo),
    mrr_onboarding: num(raw.mrr_onboarding),
    mrr_cancelamento: num(raw.mrr_cancelamento),
    op_pontual: num(raw.op_pontual),
  };
}

export function toCsRow(r: CapacityAggRow): CsRow {
  const op_total = r.op_recorrente + r.op_pontual;
  // grupos com metas separadas (têm cap_mrr) → utilização por MRR;
  // grupos com capacity único (só cap_recorrente) → utilização por total de contas.
  const util_pct = r.cap_mrr !== null
    ? utilPct(r.mrr_operando, r.cap_mrr)
    : utilPct(op_total, r.cap_recorrente);
  return {
    nome: r.nome,
    op_recorrente: r.op_recorrente,
    cap_recorrente: r.cap_recorrente,
    op_pontual: r.op_pontual,
    cap_pontual: r.cap_pontual,
    op_total,
    mrr_operando: r.mrr_operando,
    mrr_ativo: r.mrr_ativo,
    mrr_onboarding: r.mrr_onboarding,
    mrr_cancelamento: r.mrr_cancelamento,
    cap_mrr: r.cap_mrr,
    util_pct,
  };
}

export function toComercialRow(r: CapacityAggRow): ComercialRow {
  return {
    nome: r.nome,
    mrr_atual: r.mrr_operando,
    cap_mrr: r.cap_mrr,
    dif_mrr: diff(r.cap_mrr, r.mrr_operando),
    contas_ativas: r.op_recorrente,
    cap_contas: r.cap_contas,
    dif_contas: diff(r.cap_contas, r.op_recorrente),
    util_pct: utilPct(r.mrr_operando, r.cap_mrr),
  };
}

export function buildResponse(rows: CapacityAggRow[]): CapacityTimesResponse {
  const out: CapacityTimesResponse = { cs: [], vendedor: [], account: [], gestor: [] };
  for (const r of rows) {
    if (r.categoria === "cs") out.cs.push(toCsRow(r));
    else if (r.categoria === "vendedor") out.vendedor.push(toComercialRow(r));
    else if (r.categoria === "account") out.account.push(toComercialRow(r));
    else if (r.categoria === "gestor") out.gestor.push(toComercialRow(r));
  }
  return out;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run server/routes/capacityTimes.helpers.test.ts`
Expected: PASS (todos os blocos).

- [ ] **Step 5: Commit**

```bash
git add server/routes/capacityTimes.helpers.ts server/routes/capacityTimes.helpers.test.ts
git commit -m "feat(capacity-times): pure helpers for shaping/utilization

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Endpoint `GET /api/capacity-times`

**Files:**
- Modify: `server/routes/capacity.ts` (adicionar a rota dentro de `registerCapacityRoutes`, antes dos endpoints legados)

- [ ] **Step 1: Importar os helpers no topo de `server/routes/capacity.ts`** (após o `import { sql } from "drizzle-orm";`)

```ts
import { parseAggRow, buildResponse } from "./capacityTimes.helpers";
```

- [ ] **Step 2: Adicionar a rota** dentro de `registerCapacityRoutes`, logo antes do comentário `// ── Endpoints legados ──`

```ts
  // GET /api/capacity-times — ocupação atual vs capacidade por pessoa/time
  app.get("/api/capacity-times", async (_req, res) => {
    try {
      const result = await db.execute(sql`
        WITH m AS (
          SELECT nome, categoria, match_responsavel,
                 cap_recorrente, cap_mrr, cap_pontual, cap_contas, ordem
          FROM cortex_core.capacity_metas
          WHERE ativo = TRUE
        ),
        agg AS (
          SELECT
            m.nome, m.categoria, m.ordem,
            m.cap_recorrente, m.cap_mrr, m.cap_pontual, m.cap_contas,
            COUNT(*) FILTER (
              WHERE COALESCE(c.valorr, 0) > 0
                AND c.status IN ('ativo','onboarding','em cancelamento')
            ) AS op_recorrente,
            COALESCE(SUM(c.valorr) FILTER (
              WHERE COALESCE(c.valorr, 0) > 0
                AND c.status IN ('ativo','onboarding','em cancelamento')
            ), 0) AS mrr_operando,
            COALESCE(SUM(c.valorr) FILTER (
              WHERE COALESCE(c.valorr, 0) > 0 AND c.status = 'ativo'
            ), 0) AS mrr_ativo,
            COALESCE(SUM(c.valorr) FILTER (
              WHERE COALESCE(c.valorr, 0) > 0 AND c.status = 'onboarding'
            ), 0) AS mrr_onboarding,
            COALESCE(SUM(c.valorr) FILTER (
              WHERE COALESCE(c.valorr, 0) > 0 AND c.status = 'em cancelamento'
            ), 0) AS mrr_cancelamento,
            COUNT(*) FILTER (
              WHERE COALESCE(c.valorp, 0) > 0
                AND c.status IN ('ativo','onboarding')
            ) AS op_pontual
          FROM m
          LEFT JOIN "Clickup".cup_contratos c
            ON c.responsavel ILIKE '%' || m.match_responsavel || '%'
          GROUP BY m.nome, m.categoria, m.ordem,
                   m.cap_recorrente, m.cap_mrr, m.cap_pontual, m.cap_contas
        )
        SELECT * FROM agg ORDER BY categoria, ordem, nome
      `);

      const rows = result.rows.map(parseAggRow);
      res.json(buildResponse(rows));
    } catch (error) {
      console.error("[api] Error fetching capacity-times:", error);
      res.status(500).json({ error: "Failed to fetch capacity-times" });
    }
  });
```

- [ ] **Step 3: Subir o servidor e testar o endpoint via curl autenticado**

Run (reinicia + valida shape — usa o cookie de sessão de um login no browser; se não tiver, valide pelo browser na Task 7):
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
sleep 8
PGPASSWORD=dev123 psql -h localhost -U cortex -d cortex_dev -t -A -F'|' -c \
"SELECT m.nome,
  COUNT(*) FILTER (WHERE COALESCE(c.valorr,0)>0 AND c.status IN ('ativo','onboarding','em cancelamento')) op_rec,
  COALESCE(SUM(c.valorr) FILTER (WHERE COALESCE(c.valorr,0)>0 AND c.status IN ('ativo','onboarding','em cancelamento')),0) mrr
 FROM cortex_core.capacity_metas m
 LEFT JOIN \"Clickup\".cup_contratos c ON c.responsavel ILIKE '%'||m.match_responsavel||'%'
 WHERE m.categoria='cs' GROUP BY m.nome ORDER BY m.nome;"
```
Expected: Brenda `op_rec=10`, Mariana Dalto `mrr≈36488`, Debora `mrr≈58094` (mesma lógica do endpoint validada direto no banco).

- [ ] **Step 4: Commit**

```bash
git add server/routes/capacity.ts
git commit -m "feat(capacity-times): add GET /api/capacity-times endpoint

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Página `CapacityTimes.tsx`

**Files:**
- Create: `client/src/pages/CapacityTimes.tsx`

- [ ] **Step 1: Criar a página completa** — `client/src/pages/CapacityTimes.tsx`

```tsx
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Gauge } from "lucide-react";

interface CsRow {
  nome: string;
  op_recorrente: number; cap_recorrente: number | null;
  op_pontual: number; cap_pontual: number | null;
  op_total: number;
  mrr_operando: number; mrr_ativo: number; mrr_onboarding: number; mrr_cancelamento: number;
  cap_mrr: number | null;
  util_pct: number | null;
}
interface ComercialRow {
  nome: string;
  mrr_atual: number; cap_mrr: number | null; dif_mrr: number | null;
  contas_ativas: number; cap_contas: number | null; dif_contas: number | null;
  util_pct: number | null;
}
interface CapacityTimesResponse {
  cs: CsRow[]; vendedor: ComercialRow[]; account: ComercialRow[]; gestor: ComercialRow[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}
function utilColor(pct: number | null): string {
  if (pct === null) return "text-gray-400 dark:text-zinc-500";
  if (pct >= 90) return "text-red-600 dark:text-red-400";
  if (pct >= 70) return "text-yellow-600 dark:text-yellow-400";
  return "text-green-600 dark:text-green-400";
}
function utilBarColor(pct: number | null): string {
  if (pct === null) return "bg-gray-300 dark:bg-zinc-600";
  if (pct >= 90) return "bg-red-500";
  if (pct >= 70) return "bg-yellow-500";
  return "bg-green-500";
}
function pctText(pct: number | null): string {
  return pct === null ? "—" : `${pct}%`;
}
function numOrDash(v: number | null): string {
  return v === null ? "—" : String(v);
}
function moneyOrDash(v: number | null): string {
  return v === null ? "—" : formatCurrency(v);
}

function UtilBar({ pct }: { pct: number | null }) {
  const width = pct === null ? 0 : Math.min(pct, 100);
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-20 h-2 rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden">
        <div className={cn("h-full rounded-full", utilBarColor(pct))} style={{ width: `${width}%` }} />
      </div>
      <span className={cn("text-xs font-semibold w-12 text-right", utilColor(pct))}>{pctText(pct)}</span>
    </div>
  );
}

function MrrStatusBar({ ativo, onboarding, cancelamento }: { ativo: number; onboarding: number; cancelamento: number }) {
  const total = ativo + onboarding + cancelamento;
  if (total === 0) return null;
  const w = (v: number) => `${(v / total) * 100}%`;
  return (
    <div className="flex h-1.5 w-full rounded-full overflow-hidden mt-1" title={`Ativo ${formatCurrency(ativo)} · Onboarding ${formatCurrency(onboarding)} · Cancelamento ${formatCurrency(cancelamento)}`}>
      <div className="bg-green-500" style={{ width: w(ativo) }} />
      <div className="bg-blue-500" style={{ width: w(onboarding) }} />
      <div className="bg-red-500" style={{ width: w(cancelamento) }} />
    </div>
  );
}

function th(extra = "") { return cn("text-gray-600 dark:text-zinc-400", extra); }
function td(extra = "") { return cn("text-gray-900 dark:text-white", extra); }

function CsTable({ rows }: { rows: CsRow[] }) {
  if (!rows.length) return <p className="text-center text-gray-500 dark:text-zinc-400 py-8">Nenhuma pessoa neste time.</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-gray-200 dark:border-zinc-700">
            <TableHead className={th()}>Nome</TableHead>
            <TableHead className={th("text-right")}>Recorrente</TableHead>
            <TableHead className={th("text-right")}>Cap. Rec.</TableHead>
            <TableHead className={th("text-right")}>Pontual</TableHead>
            <TableHead className={th("text-right")}>Cap. Pont.</TableHead>
            <TableHead className={th("text-right")}>MRR Operando</TableHead>
            <TableHead className={th("text-right")}>Cap. MRR</TableHead>
            <TableHead className={th("text-right")}>Utilização</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.nome} className="border-gray-200 dark:border-zinc-700">
              <TableCell className={td("font-medium")}>{r.nome}</TableCell>
              <TableCell className={td("text-right")}>{r.op_recorrente}</TableCell>
              <TableCell className="text-right text-gray-500 dark:text-zinc-400">{numOrDash(r.cap_recorrente)}</TableCell>
              <TableCell className={td("text-right")}>{r.op_pontual}</TableCell>
              <TableCell className="text-right text-gray-500 dark:text-zinc-400">{numOrDash(r.cap_pontual)}</TableCell>
              <TableCell className={td("text-right")}>
                {formatCurrency(r.mrr_operando)}
                <MrrStatusBar ativo={r.mrr_ativo} onboarding={r.mrr_onboarding} cancelamento={r.mrr_cancelamento} />
              </TableCell>
              <TableCell className="text-right text-gray-500 dark:text-zinc-400">{moneyOrDash(r.cap_mrr)}</TableCell>
              <TableCell className="text-right"><UtilBar pct={r.util_pct} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ComercialTable({ rows }: { rows: ComercialRow[] }) {
  if (!rows.length) return <p className="text-center text-gray-500 dark:text-zinc-400 py-8">Nenhuma pessoa neste time.</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-gray-200 dark:border-zinc-700">
            <TableHead className={th()}>Nome</TableHead>
            <TableHead className={th("text-right")}>MRR Atual</TableHead>
            <TableHead className={th("text-right")}>Cap. MRR</TableHead>
            <TableHead className={th("text-right")}>Δ MRR</TableHead>
            <TableHead className={th("text-right")}>Contas</TableHead>
            <TableHead className={th("text-right")}>Cap. Contas</TableHead>
            <TableHead className={th("text-right")}>Δ Contas</TableHead>
            <TableHead className={th("text-right")}>Utilização</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.nome} className="border-gray-200 dark:border-zinc-700">
              <TableCell className={td("font-medium")}>{r.nome}</TableCell>
              <TableCell className={td("text-right")}>{formatCurrency(r.mrr_atual)}</TableCell>
              <TableCell className="text-right text-gray-500 dark:text-zinc-400">{moneyOrDash(r.cap_mrr)}</TableCell>
              <TableCell className={cn("text-right", (r.dif_mrr ?? 0) < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400")}>{r.dif_mrr === null ? "—" : formatCurrency(r.dif_mrr)}</TableCell>
              <TableCell className={td("text-right")}>{r.contas_ativas}</TableCell>
              <TableCell className="text-right text-gray-500 dark:text-zinc-400">{numOrDash(r.cap_contas)}</TableCell>
              <TableCell className={cn("text-right", (r.dif_contas ?? 0) < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400")}>{numOrDash(r.dif_contas)}</TableCell>
              <TableCell className="text-right"><UtilBar pct={r.util_pct} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function CapacityTimes() {
  useSetPageInfo("Capacity Times", "Ocupação atual vs. capacidade por pessoa e time");
  usePageTitle("Capacity Times");

  const { data, isLoading } = useQuery<CapacityTimesResponse>({
    queryKey: ["/api/capacity-times"],
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Gauge className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Capacity Times</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Ocupação atual vs. capacidade por pessoa e time</p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <Tabs defaultValue="cs">
          <TabsList>
            <TabsTrigger value="cs">CS ({data?.cs.length ?? 0})</TabsTrigger>
            <TabsTrigger value="vendedor">Vendedores ({data?.vendedor.length ?? 0})</TabsTrigger>
            <TabsTrigger value="account">Accounts ({data?.account.length ?? 0})</TabsTrigger>
            <TabsTrigger value="gestor">Gestores ({data?.gestor.length ?? 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="cs">
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
              <CardHeader><CardTitle className="text-gray-900 dark:text-white">CS</CardTitle></CardHeader>
              <CardContent><CsTable rows={data?.cs ?? []} /></CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="vendedor">
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
              <CardHeader><CardTitle className="text-gray-900 dark:text-white">Vendedores / Closers</CardTitle></CardHeader>
              <CardContent><ComercialTable rows={data?.vendedor ?? []} /></CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="account">
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
              <CardHeader><CardTitle className="text-gray-900 dark:text-white">Accounts</CardTitle></CardHeader>
              <CardContent><ComercialTable rows={data?.account ?? []} /></CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="gestor">
            <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
              <CardHeader><CardTitle className="text-gray-900 dark:text-white">Gestores</CardTitle></CardHeader>
              <CardContent><ComercialTable rows={data?.gestor ?? []} /></CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -i capacitytimes || echo "sem erros em CapacityTimes"`
Expected: `sem erros em CapacityTimes`.

> Se `@/components/ui/tabs` não exportar `Tabs/TabsList/TabsTrigger/TabsContent`, abrir `client/src/components/ui/tabs.tsx` e usar os nomes exportados reais (componente shadcn padrão exporta exatamente esses).

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/CapacityTimes.tsx
git commit -m "feat(capacity-times): add CapacityTimes page with tabs per team

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Rota, permissão e item de menu

**Files:**
- Modify: `client/src/App.tsx` (~linha 152 import; ~linha 417 route)
- Modify: `shared/nav-config.ts` (PERMISSION_KEYS ~linha 53; ROUTE_TO_PERMISSION ~linha 243; nav item ~linha 474)

- [ ] **Step 1: Registrar o lazy import em `App.tsx`** — logo após a linha `const Capacity = lazyWithRetry(() => import("@/pages/Capacity"));` (linha 152):

```tsx
const CapacityTimes = lazyWithRetry(() => import("@/pages/CapacityTimes"));
```

- [ ] **Step 2: Registrar a rota em `App.tsx`** — logo após a linha da rota `/capacity` (linha 417):

```tsx
      <Route path="/capacity-times">{() => <ProtectedRoute path="/capacity-times" component={CapacityTimes} />}</Route>
```

- [ ] **Step 3: Adicionar a permissão em `shared/nav-config.ts`** — dentro de `PERMISSION_KEYS.GESTAO` (após `CREATORS_PONTUAL: 'gestao.creators_pontual',`, linha 53):

```ts
    CAPACITY_TIMES: 'gestao.capacity_times',
```

- [ ] **Step 4: Mapear rota→permissão** — em `ROUTE_TO_PERMISSION`, na seção `// Gestão` (após `'/creators-pontual': PERMISSION_KEYS.GESTAO.CREATORS_PONTUAL,`, linha 243):

```ts
  '/capacity-times': PERMISSION_KEYS.GESTAO.CAPACITY_TIMES,
```

- [ ] **Step 5: Adicionar o item de menu** — no array `items` da categoria `'Gestão'` (após a linha de `'Creators Pontual'`, linha 474):

```ts
        { title: 'Capacity Times', url: '/capacity-times', icon: 'Gauge', permissionKey: PERMISSION_KEYS.GESTAO.CAPACITY_TIMES },
```

- [ ] **Step 6: Verificar typecheck + lint**

Run: `npx tsc --noEmit 2>&1 | grep -iE "capacity|nav-config|App.tsx" || echo "ok"`
Expected: `ok`.

- [ ] **Step 7: Commit**

```bash
git add client/src/App.tsx shared/nav-config.ts
git commit -m "feat(capacity-times): wire route, permission and nav menu item

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Validação contra a planilha + conciliação de nomes + checagem visual

**Files:** nenhum novo; ajustes pontuais em `server/seed/capacityMetas.ts` se algum `match_responsavel` não reconciliar.

- [ ] **Step 1: Reconciliar match strings dos comerciais** — rodar a query abaixo e comparar com a planilha (Contas Ativas): Moises 16, Pedro 16, Breno 16, Gabriel Taufner 12, José Neto 14, Jonatas 24, Victor Arpini 17.

Run:
```bash
PGPASSWORD=dev123 psql -h localhost -U cortex -d cortex_dev -t -A -F'|' -c \
"SELECT m.nome,
  COUNT(*) FILTER (WHERE COALESCE(c.valorr,0)>0 AND c.status IN ('ativo','onboarding','em cancelamento')) contas,
  COALESCE(SUM(c.valorr) FILTER (WHERE COALESCE(c.valorr,0)>0 AND c.status IN ('ativo','onboarding','em cancelamento')),0) mrr
 FROM cortex_core.capacity_metas m
 LEFT JOIN \"Clickup\".cup_contratos c ON c.responsavel ILIKE '%'||m.match_responsavel||'%'
 WHERE m.categoria IN ('vendedor','account','gestor') GROUP BY m.nome, m.ordem ORDER BY m.ordem;"
```
Expected: a maioria bate com tolerância (snapshot mais novo). **Para discrepâncias grandes (Jônatas, Victor Arpini):** investigar a forma real do nome em `responsavel` —
```bash
PGPASSWORD=dev123 psql -h localhost -U cortex -d cortex_dev -t -A -c \
"SELECT DISTINCT responsavel FROM \"Clickup\".cup_contratos WHERE responsavel ILIKE '%arpini%' OR responsavel ILIKE '%jônatas%' OR responsavel ILIKE '%jonatas%';"
```
Se houver variação (ex.: nome do meio), ajustar `match_responsavel` no seed e reaplicar (reiniciar `npm run dev`). **Se mesmo assim não reconciliar** (a atribuição de Accounts não vive em `responsavel`), NÃO inventar: deixar o número que o banco mostra e registrar a divergência para levar ao solicitante (ver §10 do spec).

- [ ] **Step 2: Conferir 3 pessoas de CS ponta a ponta** contra a planilha: Brenda (rec 10, MRR ~R$28–30k, pont 0), Lara (rec 11, pont 5), Debora (MRR ativo R$58.094). Usar a query do Task 4 Step 3.

- [ ] **Step 3: Rodar a suíte de testes completa do que foi criado**

Run: `npx vitest run server/seed/capacityMetas.test.ts server/routes/capacityTimes.helpers.test.ts`
Expected: PASS em todos.

- [ ] **Step 4: Checagem visual no browser** — abrir `http://localhost:3000/capacity-times` logado. Verificar:
  - As 4 abas (CS/Vendedores/Accounts/Gestores) renderizam com dados.
  - Barras de utilização coloridas; "—" onde não há capacity.
  - Mini-barra de status do MRR aparece na aba CS.
  - **Dark mode E light mode** (alternar o tema) — sem texto ilegível.
  - Item "Capacity Times" aparece no menu Gestão.

- [ ] **Step 5: Commit (se houver ajuste de seed)**

```bash
git add server/seed/capacityMetas.ts
git commit -m "fix(capacity-times): reconcile match_responsavel against contracts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (preenchido)

**1. Cobertura do spec:**
- Tabela `capacity_metas` → Task 1. Seed da planilha → Task 2. Definições recorrente/MRR/pontual validadas → Task 4 (SQL) + Task 7 (validação). Endpoint agrupado por categoria → Task 4. Página com abas unificadas → Task 5. Rota/permissão/menu → Task 6. Conciliação Jônatas/Arpini → Task 7 Step 1. Dark/light → Task 7 Step 4. ✅ Sem lacunas.

**2. Placeholders:** Nenhum "TBD/TODO". Código completo em cada step. ✅

**3. Consistência de tipos:** `CapacityAggRow`, `CsRow`, `ComercialRow`, `CapacityTimesResponse`, `Categoria` definidos na Task 3 e reusados identicamente no endpoint (Task 4) e na página (Task 5, redeclarados no client com os mesmos campos). `seedCapacityMetas()` no-arg (importa `db` internamente) — bate com a chamada no boot (Task 2 Step 5). `parseAggRow`/`buildResponse` exportados e importados igual. ✅

## Notas de execução
- Reiniciar `npm run dev` após mudanças no backend (sem watch — ver memória do projeto). Matar a porta antes: `lsof -ti:3000 | xargs kill -9`.
- Workflow pós-conclusão (Obsidian + chamado) só ao finalizar a feature inteira, não por task.
- Decisões em aberto do spec (§10) a confirmar com o solicitante no review: semântica do capacity de CS (grupos 2/3) e conciliação de Accounts.
```
