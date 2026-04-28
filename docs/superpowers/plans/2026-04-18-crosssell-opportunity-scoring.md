# Cross-Sell Opportunity Scoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automated opportunity mapping to the cross-sell pipeline — a scoring engine analyzes clients/contracts and creates prioritized opportunities in the existing pipeline.

**Architecture:** New backend endpoint `POST /api/comercial/crosssell/mapear` calculates a 5-factor composite score per (client, product) pair and bulk-inserts opportunities with `etapa = 'sugerido_sistema'`. Frontend adds the new stage, a "Mapear Oportunidades" button, priority badges, new filters, and dashboard KPIs.

**Tech Stack:** TypeScript, Express, PostgreSQL (raw SQL via drizzle `sql.raw`), React, TanStack Query, Tailwind CSS, Recharts, shadcn/ui

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `migrations/2026-04-18-crosssell-scoring-columns.sql` | ALTER TABLE + new columns |
| Create | `server/services/crosssell-scoring.ts` | Scoring engine (co-occurrence matrix, 5-factor calc, opportunity generation) |
| Modify | `server/routes/crosssell.ts` | New `/mapear` endpoint + return new columns in GET |
| Modify | `client/src/pages/CrossSellPipeline.tsx` | New stage, button, priority badges, filters, card enhancements |
| Modify | `client/src/pages/CrossSellDashboard.tsx` | 2 new KPIs (sugestões ativas, taxa aceitação) + funil stage |

---

### Task 1: Database Migration — Add Scoring Columns

**Files:**
- Create: `migrations/2026-04-18-crosssell-scoring-columns.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Cross-sell opportunity scoring columns
-- Adds origin, priority, score details, and reason to oportunidades

ALTER TABLE cortex_core.crosssell_oportunidades
  ADD COLUMN IF NOT EXISTS origem VARCHAR(20) DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS prioridade VARCHAR(10),
  ADD COLUMN IF NOT EXISTS score_detalhes JSONB,
  ADD COLUMN IF NOT EXISTS motivo TEXT;

-- Index for filtering by origem and prioridade
CREATE INDEX IF NOT EXISTS idx_crosssell_oport_origem ON cortex_core.crosssell_oportunidades(origem);
CREATE INDEX IF NOT EXISTS idx_crosssell_oport_prioridade ON cortex_core.crosssell_oportunidades(prioridade);
```

Save this to `migrations/2026-04-18-crosssell-scoring-columns.sql`.

- [ ] **Step 2: Run the migration against the database**

Run the migration on both local and production databases:

```bash
# Local
psql -h localhost -U postgres -d cortex_dev -f migrations/2026-04-18-crosssell-scoring-columns.sql

# Production
psql -h 34.95.249.110 -U postgres -d dados_turbo -f migrations/2026-04-18-crosssell-scoring-columns.sql
```

Expected: `ALTER TABLE` and `CREATE INDEX` succeed.

- [ ] **Step 3: Verify columns exist**

```bash
psql -h localhost -U postgres -d cortex_dev -c "\d cortex_core.crosssell_oportunidades"
```

Expected: `origem`, `prioridade`, `score_detalhes`, `motivo` columns present.

- [ ] **Step 4: Commit**

```bash
git add migrations/2026-04-18-crosssell-scoring-columns.sql
git commit -m "feat(crosssell): add scoring columns to oportunidades table

Adds origem, prioridade, score_detalhes (JSONB), motivo columns
for automated opportunity mapping system.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Scoring Engine — Core Service

**Files:**
- Create: `server/services/crosssell-scoring.ts`

This is the core logic: co-occurrence matrix, 5-factor scoring, opportunity generation.

- [ ] **Step 1: Create the scoring service file**

Create `server/services/crosssell-scoring.ts` with this content:

```typescript
import { db } from "../db";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClienteContrato {
  cnpj: string;
  clienteId: string;
  nome: string;
  cluster: string | null;
  faturamentoMensal: number;
  investimentoAds: number;
  responsavel: string | null;
  produtos: string[];
  mrrTotal: number;
  contratoMaisAntigo: Date | null;
  produtosCancelados: string[];
}

interface OportunidadeSugerida {
  clienteId: string;
  cnpj: string;
  produtoMapeado: string;
  cxResponsavel: string;
  origem: "sistema";
  prioridade: "alta" | "media" | "baixa";
  scoreDetalhes: {
    afinidade: number;
    gap: number;
    financeiro: number;
    tenure: number;
    churn: number;
    total: number;
  };
  motivo: string;
}

interface MapearResult {
  criadas: number;
  distribuicao: { alta: number; media: number; baixa: number };
  ignoradas: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PESOS = {
  afinidade: 0.30,
  gap: 0.20,
  financeiro: 0.20,
  tenure: 0.15,
  churn: 0.15,
};

const SCORE_MINIMO = 0.30;
const AFINIDADE_MINIMA = 0.15;
const MAX_SUGESTOES_POR_CLIENTE = 3;

// ---------------------------------------------------------------------------
// Co-occurrence Matrix
// ---------------------------------------------------------------------------

/**
 * Builds a co-occurrence matrix from active contracts.
 * For each pair (A, B): of clients who have product A, what % also have B?
 */
async function buildCoOccurrenceMatrix(): Promise<Record<string, Record<string, number>>> {
  // Get all clients with their active products
  const result = await db.execute(sql.raw(`
    SELECT ct.cnpj, ct.produto
    FROM "Clickup".cup_contratos ct
    WHERE ct.status IN ('ativo', 'Ativo', 'ATIVO')
      AND ct.produto IS NOT NULL
      AND ct.produto != ''
    GROUP BY ct.cnpj, ct.produto
  `));

  // Build client -> products map
  const clientProducts: Record<string, Set<string>> = {};
  for (const row of result.rows as any[]) {
    if (!clientProducts[row.cnpj]) clientProducts[row.cnpj] = new Set();
    clientProducts[row.cnpj].add(row.produto);
  }

  // Count how many clients have each product
  const productCount: Record<string, number> = {};
  // Count co-occurrences
  const coCount: Record<string, Record<string, number>> = {};

  for (const products of Object.values(clientProducts)) {
    const arr = Array.from(products);
    for (const p of arr) {
      productCount[p] = (productCount[p] || 0) + 1;
      if (!coCount[p]) coCount[p] = {};
      for (const q of arr) {
        if (p !== q) {
          coCount[p][q] = (coCount[p][q] || 0) + 1;
        }
      }
    }
  }

  // Convert to percentages
  const matrix: Record<string, Record<string, number>> = {};
  for (const [p, others] of Object.entries(coCount)) {
    matrix[p] = {};
    for (const [q, count] of Object.entries(others)) {
      matrix[p][q] = count / (productCount[p] || 1);
    }
  }

  return matrix;
}

// ---------------------------------------------------------------------------
// Factor Calculations
// ---------------------------------------------------------------------------

function calcAfinidade(
  matrix: Record<string, Record<string, number>>,
  clientProducts: string[],
  targetProduct: string
): number {
  if (clientProducts.length === 0) return 0;
  let sum = 0;
  let count = 0;
  for (const p of clientProducts) {
    const aff = matrix[p]?.[targetProduct];
    if (aff !== undefined) {
      sum += aff;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

function calcGap(
  clientProductCount: number,
  clusterAvg: Record<string, number>,
  cluster: string | null
): number {
  const avg = clusterAvg[cluster ?? ""] ?? clusterAvg["_global"] ?? 1;
  if (avg <= 0) return 0;
  const score = 1 - clientProductCount / avg;
  return Math.max(0, Math.min(1, score));
}

function calcFinanceiro(
  faturamento: number,
  investAds: number,
  mrr: number,
  percentis: { faturamento: number[]; investAds: number[]; mrr: number[] }
): number {
  const pFat = percentilRank(faturamento, percentis.faturamento);
  const pAds = percentilRank(investAds, percentis.investAds);
  const pMrr = percentilRank(mrr, percentis.mrr);
  return (pFat + pAds + pMrr) / 3;
}

function calcTenure(contratoMaisAntigo: Date | null): number {
  if (!contratoMaisAntigo) return 0;
  const now = new Date();
  const months =
    (now.getFullYear() - contratoMaisAntigo.getFullYear()) * 12 +
    now.getMonth() -
    contratoMaisAntigo.getMonth();
  if (months < 6) return 0.2;
  if (months < 12) return 0.5;
  if (months < 24) return 0.8;
  return 1.0;
}

function calcChurn(
  targetProduct: string,
  produtosCancelados: string[]
): number {
  if (produtosCancelados.length === 0) return 0.5; // stable
  if (produtosCancelados.includes(targetProduct)) return 0.8; // reactivation opportunity
  // Many cancellations = risk
  if (produtosCancelados.length >= 3) return 0.2;
  return 0.5;
}

function percentilRank(value: number, sorted: number[]): number {
  if (sorted.length === 0 || value <= 0) return 0;
  let count = 0;
  for (const v of sorted) {
    if (v <= value) count++;
    else break;
  }
  return count / sorted.length;
}

function classificarPrioridade(score: number): "alta" | "media" | "baixa" {
  if (score > 0.70) return "alta";
  if (score >= 0.40) return "media";
  return "baixa";
}

// ---------------------------------------------------------------------------
// Main: mapearOportunidades
// ---------------------------------------------------------------------------

export async function mapearOportunidades(): Promise<MapearResult> {
  // 1. Get all active clients with their contracts
  const clientesResult = await db.execute(sql.raw(`
    SELECT
      c.cnpj,
      c.task_id AS cliente_id,
      c.nome,
      c.cluster,
      COALESCE(c.faturamento_mensal, 0)::float AS faturamento_mensal,
      COALESCE(c.investimento_ads, 0)::float AS investimento_ads,
      c.responsavel
    FROM "Clickup".cup_clientes c
    WHERE c.status IN ('ativo', 'Ativo', 'ATIVO', 'Ativo ')
      AND c.cnpj IS NOT NULL
      AND c.cnpj != ''
  `));

  const contratosResult = await db.execute(sql.raw(`
    SELECT
      ct.cnpj,
      ct.produto,
      ct.status,
      COALESCE(ct.valorr, 0)::float AS valorr,
      ct.data_inicio
    FROM "Clickup".cup_contratos ct
    WHERE ct.cnpj IS NOT NULL AND ct.cnpj != ''
  `));

  // 2. Get existing opportunities for deduplication
  const existingResult = await db.execute(sql.raw(`
    SELECT cnpj, produto_mapeado, etapa
    FROM cortex_core.crosssell_oportunidades
  `));

  const existingPairs = new Set(
    (existingResult.rows as any[]).map((r) => `${r.cnpj}|${r.produto_mapeado}`)
  );
  // Also track discarded pairs (never suggest again)
  const discardedPairs = new Set(
    (existingResult.rows as any[])
      .filter((r) => r.etapa === "descartado")
      .map((r) => `${r.cnpj}|${r.produto_mapeado}`)
  );

  // 3. Build client data structures
  const clienteMap: Record<string, ClienteContrato> = {};

  for (const row of clientesResult.rows as any[]) {
    clienteMap[row.cnpj] = {
      cnpj: row.cnpj,
      clienteId: row.cliente_id,
      nome: row.nome,
      cluster: row.cluster,
      faturamentoMensal: row.faturamento_mensal,
      investimentoAds: row.investimento_ads,
      responsavel: row.responsavel,
      produtos: [],
      mrrTotal: 0,
      contratoMaisAntigo: null,
      produtosCancelados: [],
    };
  }

  for (const row of contratosResult.rows as any[]) {
    const cliente = clienteMap[row.cnpj];
    if (!cliente) continue;

    const isActive = ["ativo", "Ativo", "ATIVO"].includes(row.status);
    const isCancelled = ["cancelado", "Cancelado", "CANCELADO", "pausado", "Pausado"].includes(row.status);

    if (isActive && row.produto) {
      if (!cliente.produtos.includes(row.produto)) {
        cliente.produtos.push(row.produto);
      }
      cliente.mrrTotal += row.valorr;
      if (row.data_inicio) {
        const d = new Date(row.data_inicio);
        if (!cliente.contratoMaisAntigo || d < cliente.contratoMaisAntigo) {
          cliente.contratoMaisAntigo = d;
        }
      }
    }

    if (isCancelled && row.produto && !cliente.produtosCancelados.includes(row.produto)) {
      cliente.produtosCancelados.push(row.produto);
    }
  }

  // 4. Calculate co-occurrence matrix
  const matrix = await buildCoOccurrenceMatrix();

  // 5. Calculate cluster averages (products per cluster)
  const clusterProducts: Record<string, number[]> = {};
  const allCounts: number[] = [];
  for (const c of Object.values(clienteMap)) {
    if (c.produtos.length === 0) continue;
    const key = c.cluster ?? "_global";
    if (!clusterProducts[key]) clusterProducts[key] = [];
    clusterProducts[key].push(c.produtos.length);
    allCounts.push(c.produtos.length);
  }
  const clusterAvg: Record<string, number> = {};
  for (const [key, counts] of Object.entries(clusterProducts)) {
    clusterAvg[key] = counts.reduce((a, b) => a + b, 0) / counts.length;
  }
  clusterAvg["_global"] = allCounts.length > 0
    ? allCounts.reduce((a, b) => a + b, 0) / allCounts.length
    : 1;

  // 6. Calculate percentile arrays for financial scoring
  const faturamentos = Object.values(clienteMap)
    .map((c) => c.faturamentoMensal)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const investimentos = Object.values(clienteMap)
    .map((c) => c.investimentoAds)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const mrrs = Object.values(clienteMap)
    .map((c) => c.mrrTotal)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);

  const percentis = { faturamento: faturamentos, investAds: investimentos, mrr: mrrs };

  // 7. Get all known products from the matrix
  const allProducts = new Set<string>(Object.keys(matrix));

  // 8. Score and generate suggestions
  const sugestoes: OportunidadeSugerida[] = [];
  let ignoradas = 0;

  for (const cliente of Object.values(clienteMap)) {
    if (cliente.produtos.length === 0) continue; // skip clients with no active products

    const candidatos: OportunidadeSugerida[] = [];

    for (const targetProduct of allProducts) {
      // Skip if client already has this product
      if (cliente.produtos.includes(targetProduct)) continue;

      // Skip if opportunity already exists or was discarded
      const key = `${cliente.cnpj}|${targetProduct}`;
      if (existingPairs.has(key) || discardedPairs.has(key)) {
        ignoradas++;
        continue;
      }

      // Calculate affinity first (early exit)
      const afinidade = calcAfinidade(matrix, cliente.produtos, targetProduct);
      if (afinidade < AFINIDADE_MINIMA) continue;

      // Calculate remaining factors
      const gap = calcGap(cliente.produtos.length, clusterAvg, cliente.cluster);
      const financeiro = calcFinanceiro(
        cliente.faturamentoMensal,
        cliente.investimentoAds,
        cliente.mrrTotal,
        percentis
      );
      const tenure = calcTenure(cliente.contratoMaisAntigo);
      const churn = calcChurn(targetProduct, cliente.produtosCancelados);

      // Composite score
      const total =
        afinidade * PESOS.afinidade +
        gap * PESOS.gap +
        financeiro * PESOS.financeiro +
        tenure * PESOS.tenure +
        churn * PESOS.churn;

      if (total < SCORE_MINIMO) continue;

      // Build reason string
      const afinidadePct = Math.round(afinidade * 100);
      const motivo = `${afinidadePct}% dos clientes com ${cliente.produtos[0]}${
        cliente.produtos.length > 1 ? ` (e outros ${cliente.produtos.length - 1} produtos)` : ""
      } também contratam ${targetProduct}`;

      candidatos.push({
        clienteId: cliente.clienteId,
        cnpj: cliente.cnpj,
        produtoMapeado: targetProduct,
        cxResponsavel: cliente.responsavel ?? "N/A",
        origem: "sistema",
        prioridade: classificarPrioridade(total),
        scoreDetalhes: {
          afinidade: Math.round(afinidade * 100) / 100,
          gap: Math.round(gap * 100) / 100,
          financeiro: Math.round(financeiro * 100) / 100,
          tenure: Math.round(tenure * 100) / 100,
          churn: Math.round(churn * 100) / 100,
          total: Math.round(total * 100) / 100,
        },
        motivo,
      });
    }

    // Top 3 per client
    candidatos.sort((a, b) => b.scoreDetalhes.total - a.scoreDetalhes.total);
    sugestoes.push(...candidatos.slice(0, MAX_SUGESTOES_POR_CLIENTE));
  }

  // 9. Bulk insert opportunities
  const distribuicao = { alta: 0, media: 0, baixa: 0 };

  for (const s of sugestoes) {
    await db.execute(sql`
      INSERT INTO cortex_core.crosssell_oportunidades
        (cliente_id, cnpj, produto_mapeado, etapa, cx_responsavel, origem, prioridade, score_detalhes, motivo)
      VALUES
        (${s.clienteId}, ${s.cnpj}, ${s.produtoMapeado}, 'sugerido_sistema', ${s.cxResponsavel},
         ${s.origem}, ${s.prioridade}, ${JSON.stringify(s.scoreDetalhes)}::jsonb, ${s.motivo})
    `);
    distribuicao[s.prioridade]++;
  }

  return {
    criadas: sugestoes.length,
    distribuicao,
    ignoradas,
  };
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit server/services/crosssell-scoring.ts 2>&1 | head -20
```

Fix any type errors if they appear.

- [ ] **Step 3: Commit**

```bash
git add server/services/crosssell-scoring.ts
git commit -m "feat(crosssell): add scoring engine with 5-factor composite scoring

Implements co-occurrence matrix, portfolio gap, financial health,
tenure, and churn history scoring. Generates up to 3 suggestions
per client with priority classification (alta/media/baixa).

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Backend — New `/mapear` Endpoint + Updated GET

**Files:**
- Modify: `server/routes/crosssell.ts`

- [ ] **Step 1: Add the import at the top of crosssell.ts**

At line 3 of `server/routes/crosssell.ts`, after the existing imports, add:

```typescript
import { mapearOportunidades } from "../services/crosssell-scoring";
```

- [ ] **Step 2: Add the POST /mapear endpoint**

Insert this endpoint **before** the existing `GET /api/comercial/crosssell/:id/comentarios` route (before line 201), because Express matches routes in order and `:id` would match "mapear" otherwise:

```typescript
  // POST /api/comercial/crosssell/mapear — Auto-map opportunities
  app.post("/api/comercial/crosssell/mapear", async (req, res) => {
    try {
      const result = await mapearOportunidades();
      res.json(result);
    } catch (error) {
      console.error("[crosssell] Error mapping oportunidades:", error);
      res.status(500).json({ error: "Failed to map oportunidades" });
    }
  });
```

**IMPORTANT:** This route MUST be placed before any `/:id` routes. Insert it right after the PATCH `/:id` route (after line 199), but before the GET `/:id/comentarios` route (line 201).

- [ ] **Step 3: Update the GET /api/comercial/crosssell query to return new columns**

In the main GET query (starting at line 38), add the new columns to the SELECT. After line 54 (`o.atualizado_em,`), add:

```sql
          o.origem,
          o.prioridade,
          o.score_detalhes,
          o.motivo,
```

And in the response mapping (starting at line 84), add these fields after `atualizadoEm`:

```typescript
        origem: r.origem ?? "manual",
        prioridade: r.prioridade,
        scoreDetalhes: r.score_detalhes,
        motivo: r.motivo,
```

- [ ] **Step 4: Update the dashboard endpoint to include sugerido_sistema KPIs**

In the dashboard endpoint (line 346), add two new subqueries to the KPIs promise. Add these after the `total_oportunidades` subquery (inside the KPIs SQL, after line 375):

```sql
            (SELECT COUNT(*)::int FROM cortex_core.crosssell_oportunidades o WHERE o.etapa = 'sugerido_sistema' ${opDateFilter}) AS sugestoes_ativas,
            (SELECT COUNT(*)::int FROM cortex_core.crosssell_etapa_log el WHERE el.etapa_anterior = 'sugerido_sistema' AND el.etapa_nova != 'descartado') AS sugestoes_aceitas,
            (SELECT COUNT(*)::int FROM cortex_core.crosssell_etapa_log el WHERE el.etapa_anterior = 'sugerido_sistema') AS sugestoes_total_transicoes
```

And add the new fields to the KPIs response (after `taxaConversao` in the response object around line 428):

```typescript
          sugestoesAtivas: Number(kpis.sugestoes_ativas),
          taxaAceitacao: Number(kpis.sugestoes_total_transicoes) > 0
            ? Number(((Number(kpis.sugestoes_aceitas) / Number(kpis.sugestoes_total_transicoes)) * 100).toFixed(1))
            : 0,
```

- [ ] **Step 5: Restart dev server and test the endpoint**

```bash
# Kill existing server
lsof -ti:3000 | xargs kill -9 2>/dev/null
# Start fresh
cd /Users/mac0267/Cortex && npm run dev &
# Wait for startup
sleep 3
# Test the mapear endpoint
curl -X POST http://localhost:3000/api/comercial/crosssell/mapear -H "Content-Type: application/json" 2>/dev/null | jq .
```

Expected: JSON with `{ criadas: N, distribuicao: { alta: N, media: N, baixa: N }, ignoradas: N }`.

- [ ] **Step 6: Verify GET returns new columns**

```bash
curl http://localhost:3000/api/comercial/crosssell 2>/dev/null | jq '.[0] | {origem, prioridade, scoreDetalhes, motivo}'
```

Expected: new fields visible in the response.

- [ ] **Step 7: Commit**

```bash
git add server/routes/crosssell.ts
git commit -m "feat(crosssell): add /mapear endpoint and return scoring columns in GET

New POST /api/comercial/crosssell/mapear triggers opportunity mapping.
GET now returns origem, prioridade, scoreDetalhes, motivo.
Dashboard includes sugestoesAtivas and taxaAceitacao KPIs.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 4: Frontend — Pipeline Page Updates

**Files:**
- Modify: `client/src/pages/CrossSellPipeline.tsx`

- [ ] **Step 1: Add `sugerido_sistema` to ETAPAS, labels, and colors**

In `CrossSellPipeline.tsx`, update the constants section:

**ETAPAS** (line 57): Add `"sugerido_sistema"` as the first element:

```typescript
const ETAPAS = [
  "sugerido_sistema",
  "fazer_contato",
  "tentativa_contato",
  "reuniao_agendada",
  "em_contato",
  "proposta_enviada",
  "forte_interesse",
  "descartado",
] as const;
```

**ETAPA_LABELS** (line 69): Add the new entry at the top:

```typescript
const ETAPA_LABELS: Record<Etapa, string> = {
  sugerido_sistema: "Sugerido",
  fazer_contato: "Fazer Contato",
  tentativa_contato: "Tentativa de Contato",
  reuniao_agendada: "Reuniao Agendada",
  em_contato: "Em Contato",
  proposta_enviada: "Proposta Enviada",
  forte_interesse: "Forte Interesse",
  descartado: "Descartado",
};
```

**ETAPA_COLORS** (line 79): Add the new entry at the top:

```typescript
const ETAPA_COLORS: Record<Etapa, string> = {
  sugerido_sistema: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  fazer_contato: "bg-gray-200 text-gray-800 dark:bg-zinc-700 dark:text-zinc-200",
  tentativa_contato: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  reuniao_agendada: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  em_contato: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  proposta_enviada: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  forte_interesse: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  descartado: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};
```

- [ ] **Step 2: Add priority badge constants**

After the `ETAPA_COLORS` constant (after line 87), add:

```typescript
const PRIORIDADE_COLORS: Record<string, string> = {
  alta: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  media: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  baixa: "bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-zinc-400",
};

const PRIORIDADE_LABELS: Record<string, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};
```

- [ ] **Step 3: Update the Oportunidade interface**

In the `Oportunidade` interface (line 97), add the new fields after `totalComentarios`:

```typescript
  origem: string | null;
  prioridade: string | null;
  scoreDetalhes: {
    afinidade: number;
    gap: number;
    financeiro: number;
    tenure: number;
    churn: number;
    total: number;
  } | null;
  motivo: string | null;
```

- [ ] **Step 4: Add new filter states and mapear mutation**

In the main component function (after the existing filter states around line 174), add:

```typescript
  const [origemFilter, setOrigemFilter] = useState("todas");
  const [prioridadeFilter, setPrioridadeFilter] = useState("todas");
```

After the `changeEtapa` mutation (after line 217), add the mapear mutation:

```typescript
  const mapear = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/comercial/crosssell/mapear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Erro ao mapear oportunidades");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/comercial/crosssell"] });
      alert(
        `${data.criadas} oportunidades mapeadas:\n` +
        `Alta: ${data.distribuicao.alta}\n` +
        `Média: ${data.distribuicao.media}\n` +
        `Baixa: ${data.distribuicao.baixa}\n` +
        `${data.ignoradas} ignoradas (já existentes)`
      );
    },
  });
```

- [ ] **Step 5: Update the filter logic**

In the `filtered` useMemo (line 192), add the new filters. Replace the existing filter block with:

```typescript
  const filtered = useMemo(() => {
    return oportunidades.filter((o) => {
      if (cluster !== "todos" && o.cluster !== cluster) return false;
      if (cxResp !== "todos" && o.cxResponsavel !== cxResp) return false;
      if (etapaFilter !== "todas" && o.etapa !== etapaFilter) return false;
      if (produtoFilter !== "todos" && o.produtoMapeado !== produtoFilter) return false;
      if (origemFilter !== "todas" && (o.origem ?? "manual") !== origemFilter) return false;
      if (prioridadeFilter !== "todas" && o.prioridade !== prioridadeFilter) return false;
      return true;
    });
  }, [oportunidades, cluster, cxResp, etapaFilter, produtoFilter, origemFilter, prioridadeFilter]);
```

- [ ] **Step 6: Add new filters and "Mapear" button to the filter bar**

In the JSX filter bar (line 239), add the new filters and button. After the Produto select (after line 286) and before `<div className="flex-1" />` (line 288), add:

```tsx
        <Select value={origemFilter} onValueChange={setOrigemFilter}>
          <SelectTrigger className="w-36 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas Origens</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="sistema">Sistema</SelectItem>
          </SelectContent>
        </Select>

        <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
          <SelectTrigger className="w-40 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas Prioridades</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>
```

After `<div className="flex-1" />`, before the "Nova Oportunidade" button (line 290), add:

```tsx
        <Button
          variant="outline"
          onClick={() => mapear.mutate()}
          disabled={mapear.isPending}
          className="gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/30"
        >
          <Sparkles className="h-4 w-4" />
          {mapear.isPending ? "Mapeando..." : "Mapear Oportunidades"}
        </Button>
```

Also add `Sparkles` to the lucide-react import at the top of the file (line 33):

```typescript
import {
  Plus,
  MessageSquare,
  Trophy,
  Search,
  ChevronDown,
  Send,
  Calendar,
  User,
  Package,
  Clock,
  Sparkles,
} from "lucide-react";
```

- [ ] **Step 7: Update the OpCard to show priority and motivo**

In the `OpCard` component, update the card to show scoring info when `origem === 'sistema'`.

After the header section (after line 410, after the etapa Select close tag), add a conditional section for system-generated cards:

```tsx
        {/* System scoring info */}
        {op.origem === "sistema" && op.prioridade && (
          <div className="flex items-center gap-2">
            <Badge className={`text-xs ${PRIORIDADE_COLORS[op.prioridade] ?? ""}`}>
              {PRIORIDADE_LABELS[op.prioridade] ?? op.prioridade}
            </Badge>
            {op.motivo && (
              <span className="text-xs text-gray-500 dark:text-zinc-400 truncate">
                {op.motivo}
              </span>
            )}
          </div>
        )}
```

Also add left border styling to the Card for system-generated opportunities. Update the Card className in OpCard (line 380):

```tsx
    <Card
      className={`bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 ${
        isDescartado ? "opacity-60" : ""
      } ${op.origem === "sistema" ? "border-l-4 border-l-indigo-400 dark:border-l-indigo-500" : ""}`}
    >
```

- [ ] **Step 8: Verify the page renders correctly**

Open the browser at `http://localhost:3000/dashboard/comercial/crosssell` and verify:
1. The "Mapear Oportunidades" button appears in the filter bar
2. New filters (Origem, Prioridade) appear
3. Clicking "Mapear" triggers the endpoint and shows results
4. System-generated cards have indigo left border and priority badge
5. Dark mode works correctly

- [ ] **Step 9: Commit**

```bash
git add client/src/pages/CrossSellPipeline.tsx
git commit -m "feat(crosssell): add opportunity mapping button, priority badges, and new filters

Adds sugerido_sistema stage, Mapear Oportunidades button,
Origem/Prioridade filters, and visual differentiation for
system-generated opportunity cards with scoring info.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 5: Frontend — Dashboard Updates

**Files:**
- Modify: `client/src/pages/CrossSellDashboard.tsx`

- [ ] **Step 1: Add sugerido_sistema to dashboard constants**

In `CrossSellDashboard.tsx`, update `ETAPA_LABELS` (line 30) to add:

```typescript
  sugerido_sistema: "Sugerido",
```

And `ETAPA_COLORS` (line 40) to add:

```typescript
  sugerido_sistema: "#818cf8",
```

- [ ] **Step 2: Update the DashboardData interface**

In the `DashboardData` interface (line 73), add to the `kpis` type:

```typescript
    sugestoesAtivas: number;
    taxaAceitacao: number;
```

- [ ] **Step 3: Add 2 new KPI cards**

After the existing 5 KPI cards (after line 197, the Taxa de Conversao KpiCard), add:

```tsx
          <KpiCard
            title="Sugestoes Ativas"
            value={String(data?.kpis.sugestoesAtivas ?? 0)}
            icon={<Sparkles className="h-5 w-5 text-indigo-500" />}
            accent="text-indigo-600 dark:text-indigo-400"
          />
          <KpiCard
            title="Taxa Aceitacao"
            value={`${data?.kpis.taxaAceitacao ?? 0}%`}
            icon={<TrendingUp className="h-5 w-5 text-cyan-500" />}
            accent="text-cyan-600 dark:text-cyan-400"
          />
```

Update the grid from `md:grid-cols-5` to `md:grid-cols-4 lg:grid-cols-7` on line 169:

```tsx
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
```

Also update the skeleton grid on line 163 to match:

```tsx
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
```

Add `Sparkles` to the lucide-react import (line 14):

```typescript
import { Calendar, Phone, DollarSign, TrendingUp, BarChart3, Sparkles } from "lucide-react";
```

- [ ] **Step 4: Verify dashboard renders correctly**

Open `http://localhost:3000/dashboard/comercial/crosssell-dashboard` and verify:
1. 7 KPI cards render (including "Sugestoes Ativas" and "Taxa Aceitacao")
2. Funil chart includes `sugerido_sistema` stage (if opportunities exist)
3. Dark mode works correctly

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/CrossSellDashboard.tsx
git commit -m "feat(crosssell): add sugestoes ativas and taxa aceitacao KPIs to dashboard

Adds 2 new KPI cards for system-generated opportunities tracking.
Includes sugerido_sistema stage in funil chart with indigo color.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 6: End-to-End Testing

**Files:** None (testing only)

- [ ] **Step 1: Restart dev server**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null
cd /Users/mac0267/Cortex && npm run dev &
sleep 3
```

- [ ] **Step 2: Test the full flow in browser**

1. Navigate to `/dashboard/comercial/crosssell`
2. Click "Mapear Oportunidades" button
3. Verify the toast/alert shows results with counts
4. Verify new cards appear with `Sugerido` etapa badge (indigo)
5. Verify priority badges (Alta/Média/Baixa) appear on system cards
6. Verify the motivo text appears on cards
7. Verify indigo left border on system-generated cards
8. Test "Origem" filter — select "Sistema" → only system cards show
9. Test "Prioridade" filter — select "Alta" → only high priority cards show
10. Change a system card's etapa to "Fazer Contato" (accept suggestion)
11. Change a system card's etapa to "Descartado" (reject suggestion)
12. Click "Mapear" again → verify rejected pair is not re-created

- [ ] **Step 3: Test dashboard**

1. Navigate to `/dashboard/comercial/crosssell-dashboard`
2. Verify "Sugestoes Ativas" KPI shows correct count
3. Verify "Taxa Aceitacao" KPI shows percentage
4. Verify funil chart includes "Sugerido" bar

- [ ] **Step 4: Test dark mode**

Toggle dark mode and verify all new elements render correctly:
- Indigo border on system cards
- Priority badges
- Mapear button
- New KPI cards
- New filter dropdowns

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(crosssell): polish opportunity scoring UI after e2e testing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```
