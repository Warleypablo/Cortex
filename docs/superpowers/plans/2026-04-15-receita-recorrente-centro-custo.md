# Receita Recorrente por Centro de Custo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a página `/financeiro/receita-recorrente` mostrando MRR realizado (recorrente/pontual) extraído do Conta Azul via `caz_parcelas.centro_custo_nome`, comparando contra MRR contratado do ClickUp, com drill-down por cliente.

**Architecture:** Router Express novo (`server/routes/receitaRecorrente.ts`) com dois endpoints (`/resumo` e `/drilldown`) executando queries SQL raw via `db.execute(sql\`\`)`. Frontend em React/TypeScript com React Query, compondo 4 subcomponentes (`KpiCards`, `ChartReceitaMensal`, `TabelaReceitaMensal`, `DrilldownClientesModal`) numa página principal. Tipos compartilhados em `shared/receitaRecorrenteTypes.ts`.

**Tech Stack:**
- Backend: TypeScript, Express, drizzle-orm (`sql` tag + `db.execute`), PostgreSQL (Conta Azul schema + Clickup schema)
- Frontend: React, Vite, TanStack Query v5, Recharts, shadcn/ui, Tailwind CSS
- Tests: vitest (v4)

**Design spec:** `docs/superpowers/specs/2026-04-15-receita-recorrente-centro-custo-design.md`

---

## File structure

**New files:**

```
shared/
  receitaRecorrenteTypes.ts                        # Tipos compartilhados backend/frontend

server/receitaRecorrente/
  classifyCC.ts                                    # Função pura de classificação (espelho do SQL)
  classifyCC.test.ts                               # Testes unitários (vitest)
server/routes/
  receitaRecorrente.ts                             # Router com 2 endpoints

client/src/pages/financeiro/
  ReceitaRecorrente.tsx                            # Página principal
  receita-recorrente/
    KpiCards.tsx                                   # 7 cards KPI
    ChartReceitaMensal.tsx                         # ComposedChart Recharts
    TabelaReceitaMensal.tsx                        # Tabela mês × empresa
    DrilldownClientesModal.tsx                     # Modal de parcelas por cliente
```

**Modified files:**

```
shared/nav-config.ts                               # +PERMISSION_KEYS.FIN.RECEITA_RECORRENTE, +ROUTE_PERMISSIONS entry, +nav item
server/routes.ts                                   # +import + registerReceitaRecorrenteRoutes(app, db, storage)
client/src/App.tsx                                 # +lazy import + <Route>
```

---

## Task 1: Shared types + permission key + empty router registered

**Goal:** Tipos, permissão e esqueleto do router instalados. Dev server sobe sem erro.

**Files:**
- Create: `shared/receitaRecorrenteTypes.ts`
- Modify: `shared/nav-config.ts` (add FIN.RECEITA_RECORRENTE + ROUTE_PERMISSIONS + nav item)
- Create: `server/routes/receitaRecorrente.ts`
- Modify: `server/routes.ts` (register router)

---

- [ ] **Step 1.1: Create shared types file**

Create `shared/receitaRecorrenteTypes.ts`:

```ts
export type Empresa = "TURBO PARTNERS" | "PEIXOTO DEBBANE";
export type TipoReceita = "RECORRENTE" | "PONTUAL" | "NAO_CLASSIFICADO";

export interface MesReceita {
  mes: string;                         // ISO date "2026-03-01"
  empresa: Empresa;
  recorrente_previsto: number;
  recorrente_realizado: number;
  pontual_previsto: number;
  pontual_realizado: number;
  nao_classif_previsto: number;
  nao_classif_realizado: number;
  total_previsto: number;
  total_realizado: number;
  cobertura_cc_pct: number;            // 0-100
  mrr_contratado: number;
  is_futuro: boolean;
}

export interface CardsReceita {
  mrr_recorrente_atual: number;
  mrr_recorrente_delta_pct: number;    // -100..+inf
  pontual_atual: number;
  pontual_delta_pct: number;
  mix_recorrente_pct: number;          // 0-100
  realizado_pct: number;               // 0-100
  gap_contratado: { valor: number; pct: number } | null;
  ticket_medio_recorrente: number;
  novos_recorrente: number;
  churned_recorrente: number;
}

export interface ResumoReceitaResponse {
  meses: MesReceita[];
  cards: CardsReceita;
  range: { data_ini: string; data_fim: string };
  empresa_filtro: Empresa | null;
}

export interface DrilldownParcela {
  id_parcela: string;
  cliente_nome: string | null;
  cliente_cnpj: string | null;
  descricao: string;
  categoria_nome: string;
  valor_bruto: number;
  status: string;
  data_competencia: string;
  data_vencimento: string;
  venda_id: string | null;
  empresa: Empresa;
}

export type DrilldownResponse = DrilldownParcela[];
```

---

- [ ] **Step 1.2: Add PERMISSION_KEY.FIN.RECEITA_RECORRENTE**

Modify `shared/nav-config.ts` — locate `FIN: {` block (around line 22) and add the key:

```ts
  FIN: {
    VISAO_GERAL: 'fin.visao_geral',
    DFC: 'fin.dfc',
    FLUXO_CAIXA: 'fin.fluxo_caixa',
    REVENUE_GOALS: 'fin.revenue_goals',
    INADIMPLENCIA: 'fin.inadimplencia',
    AUDITORIA: 'fin.auditoria',
    CONTRIBUICAO_COLABORADOR: 'fin.contribuicao_colaborador',
    CONTRIBUICAO_OPERADOR: 'fin.contribuicao_operador',
    TURBOZAP: 'fin.turbozap',
    DRE: 'fin.dre',
    NOTAS_FISCAIS: 'fin.notas_fiscais',
    RECEITA_RECORRENTE: 'fin.receita_recorrente',   // NEW
  },
```

---

- [ ] **Step 1.3: Add ROUTE_PERMISSIONS entry**

In the same file, locate the `// Financeiro` block inside the route-permission map (around line 205–216) and add:

```ts
  '/financeiro/receita-recorrente': PERMISSION_KEYS.FIN.RECEITA_RECORRENTE,
```

It should go right after the `/financeiro/negativacao` line.

---

- [ ] **Step 1.4: Add nav item in Financeiro section**

In the same file, locate the Financeiro `items: [...]` array (around line 416–426) and add a new item after the Negativacao entry:

```ts
        { title: 'Receita Recorrente', url: '/financeiro/receita-recorrente', icon: 'Repeat', permissionKey: PERMISSION_KEYS.FIN.RECEITA_RECORRENTE },
```

Use the `Repeat` icon from lucide-react (already a common icon).

---

- [ ] **Step 1.5: Create empty router file**

Create `server/routes/receitaRecorrente.ts`:

```ts
import type { Express } from "express";
import { sql } from "drizzle-orm";
import type { IStorage } from "../storage";

export function registerReceitaRecorrenteRoutes(app: Express, db: any, storage: IStorage) {
  app.get("/api/financeiro/receita-recorrente/resumo", async (req, res) => {
    try {
      res.json({
        meses: [],
        cards: {
          mrr_recorrente_atual: 0,
          mrr_recorrente_delta_pct: 0,
          pontual_atual: 0,
          pontual_delta_pct: 0,
          mix_recorrente_pct: 0,
          realizado_pct: 0,
          gap_contratado: null,
          ticket_medio_recorrente: 0,
          novos_recorrente: 0,
          churned_recorrente: 0,
        },
        range: { data_ini: "", data_fim: "" },
        empresa_filtro: null,
      });
    } catch (error: any) {
      console.error("[api] Error fetching receita-recorrente/resumo:", error);
      res.status(500).json({ error: error.message || "Failed to fetch resumo" });
    }
  });

  app.get("/api/financeiro/receita-recorrente/drilldown", async (req, res) => {
    try {
      res.json([]);
    } catch (error: any) {
      console.error("[api] Error fetching receita-recorrente/drilldown:", error);
      res.status(500).json({ error: error.message || "Failed to fetch drilldown" });
    }
  });
}
```

---

- [ ] **Step 1.6: Register router in server/routes.ts**

Modify `server/routes.ts`. First, add the import at the top with the other route imports (around line 41-51):

```ts
import { registerReceitaRecorrenteRoutes } from "./routes/receitaRecorrente";
```

Then locate the `registerOKR2026Routes(app)` line (around line 8053) and add the registration right after:

```ts
  registerOKR2026Routes(app);
  registerReceitaRecorrenteRoutes(app, db, storage);
```

---

- [ ] **Step 1.7: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors related to the new files.

If errors appear, fix them inline before continuing.

---

- [ ] **Step 1.8: Start dev server and smoke test**

Run: `lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &`

Wait a few seconds for server to start, then in another terminal:

```bash
curl -s http://localhost:3000/api/financeiro/receita-recorrente/resumo | head -100
```

Expected: JSON response with `{"meses":[],"cards":{...}}`. Status 200 (or 401 if unauthenticated — both OK, means route is registered).

---

- [ ] **Step 1.9: Commit**

```bash
git add shared/receitaRecorrenteTypes.ts shared/nav-config.ts server/routes/receitaRecorrente.ts server/routes.ts
git commit -m "$(cat <<'EOF'
feat(receita-recorrente): scaffold router, types and nav entry

Adds empty endpoints (/resumo, /drilldown) and menu item under Financeiro.
Next step: implement CC classifier and SQL query.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Pure CC classifier function (TDD)

**Goal:** Função pura que classifica uma parcela nos 3 casos (CC único, múltiplos do mesmo tipo, misto Pontual+Recorrente). Serve como especificação executável da lógica SQL.

**Files:**
- Create: `server/receitaRecorrente/classifyCC.ts`
- Create: `server/receitaRecorrente/classifyCC.test.ts`

---

- [ ] **Step 2.1: Create test file with all 6 cases failing**

Create `server/receitaRecorrente/classifyCC.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { classifyParcela, type ParcelaInput, type ClassifiedResult } from './classifyCC';

function mkParcela(overrides: Partial<ParcelaInput>): ParcelaInput {
  return {
    centro_custo_nome: null,
    valor_centro_custo: null,
    valor_bruto: 0,
    status: 'PAGO',
    ...overrides,
  };
}

describe('classifyParcela', () => {
  it('case 1: CC único Recorrente → 100% RECORRENTE previsto+realizado', () => {
    const result = classifyParcela(mkParcela({
      centro_custo_nome: 'Recorrente',
      valor_bruto: 1000,
      status: 'PAGO',
    }));
    expect(result).toEqual([
      { tipo: 'RECORRENTE', previsto: 1000, realizado: 1000 },
    ]);
  });

  it('case 1b: CC único Pontual não-pago → 100% PONTUAL previsto, realizado 0', () => {
    const result = classifyParcela(mkParcela({
      centro_custo_nome: 'Pontual',
      valor_bruto: 500,
      status: 'PENDENTE',
    }));
    expect(result).toEqual([
      { tipo: 'PONTUAL', previsto: 500, realizado: 0 },
    ]);
  });

  it('case 1c: CC único não classificado → NAO_CLASSIFICADO', () => {
    const result = classifyParcela(mkParcela({
      centro_custo_nome: 'Turbo Commerce',
      valor_bruto: 2000,
      status: 'PAGO',
    }));
    expect(result).toEqual([
      { tipo: 'NAO_CLASSIFICADO', previsto: 2000, realizado: 2000 },
    ]);
  });

  it('case 2: múltiplos CCs do mesmo tipo → usa valor_bruto direto (ignora split inflado)', () => {
    // Bug do Conta Azul: repete valor total em cada parcela de venda parcelada
    const result = classifyParcela(mkParcela({
      centro_custo_nome: 'Recorrente;Recorrente',
      valor_centro_custo: '3937.04;0.0',   // inflado (valor total da venda, não da parcela)
      valor_bruto: 1312.35,                 // valor real da parcela
      status: 'PAGO',
    }));
    expect(result).toEqual([
      { tipo: 'RECORRENTE', previsto: 1312.35, realizado: 1312.35 },
    ]);
  });

  it('case 3: CC misto Pontual;Recorrente → split posicional', () => {
    const result = classifyParcela(mkParcela({
      centro_custo_nome: 'Pontual;Recorrente',
      valor_centro_custo: '2748.5;2997.0',
      valor_bruto: 5745.50,
      status: 'PAGO',
    }));
    // Ordem do array importa: usar sort para não depender
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ tipo: 'PONTUAL', previsto: 2748.5, realizado: 2748.5 });
    expect(result).toContainEqual({ tipo: 'RECORRENTE', previsto: 2997.0, realizado: 2997.0 });
  });

  it('case 3b: CC misto com zeros e mais de 2 itens', () => {
    const result = classifyParcela(mkParcela({
      centro_custo_nome: 'Pontual;Recorrente;Pontual;Recorrente',
      valor_centro_custo: '0.0;0.0;3599.77;6294.6',
      valor_bruto: 9894.37,
      status: 'PENDENTE',
    }));
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ tipo: 'PONTUAL', previsto: 3599.77, realizado: 0 });
    expect(result).toContainEqual({ tipo: 'RECORRENTE', previsto: 6294.6, realizado: 0 });
  });

  it('case 3c: CC misto maiúsculas (PEIXOTO DEBBANE)', () => {
    const result = classifyParcela(mkParcela({
      centro_custo_nome: 'RECORRENTE;PONTUAL',
      valor_centro_custo: '1997.0;833.08',
      valor_bruto: 2830.08,
      status: 'QUITADO',
    }));
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ tipo: 'RECORRENTE', previsto: 1997.0, realizado: 1997.0 });
    expect(result).toContainEqual({ tipo: 'PONTUAL', previsto: 833.08, realizado: 833.08 });
  });

  it('centro_custo_nome null → NAO_CLASSIFICADO', () => {
    const result = classifyParcela(mkParcela({
      centro_custo_nome: null,
      valor_bruto: 500,
      status: 'PAGO',
    }));
    expect(result).toEqual([
      { tipo: 'NAO_CLASSIFICADO', previsto: 500, realizado: 500 },
    ]);
  });

  it('valor_centro_custo com string vazia no meio → trata como 0', () => {
    const result = classifyParcela(mkParcela({
      centro_custo_nome: 'Pontual;Recorrente',
      valor_centro_custo: ';500',
      valor_bruto: 500,
      status: 'PAGO',
    }));
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ tipo: 'PONTUAL', previsto: 0, realizado: 0 });
    expect(result).toContainEqual({ tipo: 'RECORRENTE', previsto: 500, realizado: 500 });
  });
});
```

---

- [ ] **Step 2.2: Run tests to confirm they fail**

Run: `npx vitest run server/receitaRecorrente/classifyCC.test.ts`
Expected: FAIL with "Cannot find module './classifyCC'" or similar.

---

- [ ] **Step 2.3: Implement classifyCC.ts**

Create `server/receitaRecorrente/classifyCC.ts`:

```ts
export type TipoReceita = "RECORRENTE" | "PONTUAL" | "NAO_CLASSIFICADO";

export interface ParcelaInput {
  centro_custo_nome: string | null;
  valor_centro_custo: string | null;
  valor_bruto: number;
  status: string;
}

export interface ClassifiedResult {
  tipo: TipoReceita;
  previsto: number;
  realizado: number;
}

const REALIZADO_STATUSES = new Set(['PAGO', 'QUITADO']);

function classifySingle(nome: string | null): TipoReceita {
  if (!nome) return 'NAO_CLASSIFICADO';
  const lower = nome.toLowerCase();
  if (lower.includes('recorrente')) return 'RECORRENTE';
  if (lower.includes('pontual')) return 'PONTUAL';
  return 'NAO_CLASSIFICADO';
}

export function classifyParcela(p: ParcelaInput): ClassifiedResult[] {
  const isRealizado = REALIZADO_STATUSES.has(p.status);

  const nome = p.centro_custo_nome ?? '';
  const hasDelim = nome.includes(';');

  // Case 1: CC único (sem ';') — usa valor_bruto direto
  if (!hasDelim) {
    const tipo = classifySingle(nome);
    return [{
      tipo,
      previsto: p.valor_bruto,
      realizado: isRealizado ? p.valor_bruto : 0,
    }];
  }

  // Detecta se é misto (Recorrente + Pontual juntos) ou mesmo-tipo
  const lower = nome.toLowerCase();
  const hasRec = lower.includes('recorrente');
  const hasPon = lower.includes('pontual');
  const isMisto = hasRec && hasPon;

  // Case 2: múltiplos CCs mas todos do mesmo tipo → usa valor_bruto
  //         (contorna o bug do CA que infla valor_centro_custo em vendas parceladas)
  if (!isMisto) {
    const tipo = classifySingle(nome);
    return [{
      tipo,
      previsto: p.valor_bruto,
      realizado: isRealizado ? p.valor_bruto : 0,
    }];
  }

  // Case 3: CC misto (Recorrente + Pontual) → split posicional
  const nomes = nome.split(';');
  const valores = (p.valor_centro_custo ?? '').split(';');

  const agregado: Record<TipoReceita, ClassifiedResult> = {
    RECORRENTE: { tipo: 'RECORRENTE', previsto: 0, realizado: 0 },
    PONTUAL: { tipo: 'PONTUAL', previsto: 0, realizado: 0 },
    NAO_CLASSIFICADO: { tipo: 'NAO_CLASSIFICADO', previsto: 0, realizado: 0 },
  };

  for (let i = 0; i < nomes.length; i++) {
    const itemTipo = classifySingle(nomes[i]);
    const rawValor = valores[i] ?? '';
    const valor = rawValor.trim() === '' ? 0 : Number(rawValor);
    if (Number.isNaN(valor)) continue;
    agregado[itemTipo].previsto += valor;
    if (isRealizado) agregado[itemTipo].realizado += valor;
  }

  return Object.values(agregado).filter(r => r.previsto > 0 || r.realizado > 0);
}
```

---

- [ ] **Step 2.4: Run tests to confirm they pass**

Run: `npx vitest run server/receitaRecorrente/classifyCC.test.ts`
Expected: all 9 tests pass (green).

If any fail, fix the implementation (NOT the test) until green.

---

- [ ] **Step 2.5: Commit**

```bash
git add server/receitaRecorrente/classifyCC.ts server/receitaRecorrente/classifyCC.test.ts
git commit -m "$(cat <<'EOF'
feat(receita-recorrente): pure CC classifier with unit tests

3-case logic mirroring the SQL query:
1. Single CC → valor_bruto direct
2. Multi-CC same type → valor_bruto direct (bypass CA split bug)
3. Mixed Recorrente+Pontual → positional split from valor_centro_custo

9 test cases covering TURBO and PD naming, edge cases.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: SQL query for /resumo — meses breakdown

**Goal:** Endpoint `/resumo` retorna `meses[]` com valores corretos por mês × empresa × tipo. Valida contra os números-snapshot da conversa (Mar/26: R$ 901K recorrente TURBO).

**Files:**
- Modify: `server/routes/receitaRecorrente.ts` (replace stub `/resumo` impl)

---

- [ ] **Step 3.1: Implement /resumo query (meses only)**

Replace the `/resumo` handler in `server/routes/receitaRecorrente.ts` with:

```ts
  app.get("/api/financeiro/receita-recorrente/resumo", async (req, res) => {
    try {
      // Parâmetros com defaults (6 meses: 5m atrás até 2m à frente)
      const now = new Date();
      const defaultIni = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const defaultFim = new Date(now.getFullYear(), now.getMonth() + 2, 1);
      const dataIni = (req.query.data_ini as string) || defaultIni.toISOString().slice(0, 10);
      const dataFim = (req.query.data_fim as string) || defaultFim.toISOString().slice(0, 10);
      const empresaFiltro = (req.query.empresa as string) || null;

      const empresaClause = empresaFiltro
        ? sql` AND p.empresa = ${empresaFiltro}`
        : sql``;

      // Query principal com 3-case split
      const mesesResult = await db.execute(sql`
        WITH classified AS (
          SELECT
            p.id,
            p.empresa,
            DATE_TRUNC('month', COALESCE(p.data_competencia, p.data_vencimento))::date AS mes,
            p.valor_bruto,
            p.status,
            p.centro_custo_nome,
            p.valor_centro_custo,
            CASE
              WHEN p.centro_custo_nome ILIKE '%recorrente%' AND p.centro_custo_nome ILIKE '%pontual%' THEN 'MISTO'
              WHEN p.centro_custo_nome ILIKE '%recorrente%' THEN 'RECORRENTE'
              WHEN p.centro_custo_nome ILIKE '%pontual%' THEN 'PONTUAL'
              ELSE 'NAO_CLASSIFICADO'
            END AS classe
          FROM "Conta Azul".caz_parcelas p
          WHERE p.tipo_evento = 'RECEITA'
            AND COALESCE(p.data_competencia, p.data_vencimento) >= ${dataIni}::date
            AND COALESCE(p.data_competencia, p.data_vencimento) < ${dataFim}::date
            AND COALESCE(p.status, '') <> 'CANCELADO'
            AND COALESCE(p.categoria_nome, '') NOT LIKE '04.%'
            ${empresaClause}
        ),
        simples AS (
          SELECT
            empresa, mes, classe AS tipo,
            SUM(valor_bruto) AS previsto,
            SUM(valor_bruto) FILTER (WHERE status IN ('PAGO','QUITADO')) AS realizado
          FROM classified
          WHERE classe <> 'MISTO'
          GROUP BY 1, 2, 3
        ),
        mistos AS (
          SELECT
            c.empresa, c.mes,
            CASE
              WHEN nome_i ILIKE '%recorrente%' THEN 'RECORRENTE'
              WHEN nome_i ILIKE '%pontual%' THEN 'PONTUAL'
              ELSE 'NAO_CLASSIFICADO'
            END AS tipo,
            SUM(COALESCE(NULLIF(TRIM(valor_i), '')::numeric, 0)) AS previsto,
            SUM(
              CASE WHEN c.status IN ('PAGO','QUITADO')
                   THEN COALESCE(NULLIF(TRIM(valor_i), '')::numeric, 0)
                   ELSE 0 END
            ) AS realizado
          FROM classified c,
               unnest(
                 string_to_array(c.centro_custo_nome, ';'),
                 string_to_array(c.valor_centro_custo, ';')
               ) WITH ORDINALITY AS t(nome_i, valor_i, pos)
          WHERE c.classe = 'MISTO'
          GROUP BY 1, 2, 3
        ),
        consolidado AS (
          SELECT empresa, mes, tipo,
                 SUM(previsto) AS previsto,
                 SUM(realizado) AS realizado
          FROM (SELECT * FROM simples UNION ALL SELECT * FROM mistos) u
          GROUP BY 1, 2, 3
        )
        SELECT
          empresa::text AS empresa,
          mes::text AS mes,
          tipo::text AS tipo,
          COALESCE(previsto, 0)::float AS previsto,
          COALESCE(realizado, 0)::float AS realizado
        FROM consolidado
        ORDER BY empresa, mes, tipo;
      `);

      // Cobertura CC por mês × empresa
      const coberturaResult = await db.execute(sql`
        SELECT
          p.empresa::text AS empresa,
          DATE_TRUNC('month', COALESCE(p.data_competencia, p.data_vencimento))::date::text AS mes,
          (SUM(p.valor_bruto) FILTER (WHERE p.centro_custo_nome IS NOT NULL AND p.centro_custo_nome <> ''))::float AS com_cc,
          SUM(p.valor_bruto)::float AS total
        FROM "Conta Azul".caz_parcelas p
        WHERE p.tipo_evento = 'RECEITA'
          AND COALESCE(p.data_competencia, p.data_vencimento) >= ${dataIni}::date
          AND COALESCE(p.data_competencia, p.data_vencimento) < ${dataFim}::date
          AND COALESCE(p.status, '') <> 'CANCELADO'
          AND COALESCE(p.categoria_nome, '') NOT LIKE '04.%'
          ${empresaClause}
        GROUP BY 1, 2
      `);

      // MRR contratado (snapshot atual)
      const mrrContratadoResult = await db.execute(sql`
        SELECT COALESCE(SUM(valorr)::float, 0) AS total
        FROM "Clickup".cup_contratos
        WHERE status IN ('ativo', 'entregue', 'em cancelamento', 'pausado')
          AND valorr > 0
      `);
      const mrrContratado = (mrrContratadoResult.rows[0] as any)?.total || 0;

      // Mapa de cobertura
      const coberturaMap = new Map<string, number>();
      for (const row of coberturaResult.rows as any[]) {
        const key = `${row.empresa}|${row.mes}`;
        const com = row.com_cc || 0;
        const tot = row.total || 0;
        const pct = tot > 0 ? (com / tot) * 100 : 0;
        coberturaMap.set(key, pct);
      }

      // Agrupa resultado por mês × empresa
      const mesMap = new Map<string, any>();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      for (const row of mesesResult.rows as any[]) {
        const key = `${row.empresa}|${row.mes}`;
        if (!mesMap.has(key)) {
          const coberturaKey = `${row.empresa}|${row.mes}`;
          const mesDate = new Date(row.mes);
          mesMap.set(key, {
            mes: row.mes,
            empresa: row.empresa,
            recorrente_previsto: 0,
            recorrente_realizado: 0,
            pontual_previsto: 0,
            pontual_realizado: 0,
            nao_classif_previsto: 0,
            nao_classif_realizado: 0,
            total_previsto: 0,
            total_realizado: 0,
            cobertura_cc_pct: coberturaMap.get(coberturaKey) ?? 0,
            mrr_contratado: mrrContratado,
            is_futuro: mesDate > currentMonthStart,
          });
        }
        const entry = mesMap.get(key);
        const prev = row.previsto || 0;
        const real = row.realizado || 0;
        if (row.tipo === 'RECORRENTE') {
          entry.recorrente_previsto += prev;
          entry.recorrente_realizado += real;
        } else if (row.tipo === 'PONTUAL') {
          entry.pontual_previsto += prev;
          entry.pontual_realizado += real;
        } else {
          entry.nao_classif_previsto += prev;
          entry.nao_classif_realizado += real;
        }
        entry.total_previsto += prev;
        entry.total_realizado += real;
      }

      const meses = Array.from(mesMap.values()).sort((a, b) => {
        if (a.empresa !== b.empresa) return a.empresa.localeCompare(b.empresa);
        return a.mes.localeCompare(b.mes);
      });

      res.json({
        meses,
        cards: {
          mrr_recorrente_atual: 0,
          mrr_recorrente_delta_pct: 0,
          pontual_atual: 0,
          pontual_delta_pct: 0,
          mix_recorrente_pct: 0,
          realizado_pct: 0,
          gap_contratado: null,
          ticket_medio_recorrente: 0,
          novos_recorrente: 0,
          churned_recorrente: 0,
        },
        range: { data_ini: dataIni, data_fim: dataFim },
        empresa_filtro: empresaFiltro,
      });
    } catch (error: any) {
      console.error("[api] Error fetching receita-recorrente/resumo:", error);
      res.status(500).json({ error: error.message || "Failed to fetch resumo" });
    }
  });
```

---

- [ ] **Step 3.2: Restart dev server**

Run: `lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &`

Wait 5 seconds for startup.

---

- [ ] **Step 3.3: Sanity check against production snapshot**

Expected numbers from the spec (validated against prod):
```
Mar/26 TURBO PARTNERS: Recorrente R$ 901.112, Pontual R$ 432.359, Não Classif R$ 20.479
Abr/26 TURBO PARTNERS: Recorrente R$ 997.122, Pontual R$ 375.561, Não Classif R$ 8.478
```

Run (requires auth cookie — simpler: query DB directly to cross-validate):

```bash
PGPASSWORD='Turbosenha*' psql -h 34.95.249.110 -U postgres -d dados_turbo -c "
WITH classified AS (
  SELECT p.id, p.empresa, DATE_TRUNC('month', COALESCE(p.data_competencia, p.data_vencimento))::date AS mes, p.valor_bruto, p.status, p.centro_custo_nome, p.valor_centro_custo,
    CASE WHEN p.centro_custo_nome ILIKE '%recorrente%' AND p.centro_custo_nome ILIKE '%pontual%' THEN 'MISTO'
         WHEN p.centro_custo_nome ILIKE '%recorrente%' THEN 'RECORRENTE'
         WHEN p.centro_custo_nome ILIKE '%pontual%' THEN 'PONTUAL'
         ELSE 'NAO_CLASSIFICADO' END AS classe
  FROM \"Conta Azul\".caz_parcelas p
  WHERE p.tipo_evento = 'RECEITA' AND DATE_TRUNC('month', COALESCE(p.data_competencia, p.data_vencimento)) = '2026-03-01'
    AND p.empresa = 'TURBO PARTNERS' AND COALESCE(p.status, '') <> 'CANCELADO' AND COALESCE(p.categoria_nome, '') NOT LIKE '04.%'
),
simples AS (SELECT classe AS tipo, SUM(valor_bruto) AS val FROM classified WHERE classe <> 'MISTO' GROUP BY 1),
mistos AS (
  SELECT CASE WHEN nome_i ILIKE '%recorrente%' THEN 'RECORRENTE' WHEN nome_i ILIKE '%pontual%' THEN 'PONTUAL' ELSE 'NAO_CLASSIFICADO' END AS tipo,
         SUM(COALESCE(NULLIF(TRIM(valor_i), '')::numeric, 0)) AS val
  FROM classified c, unnest(string_to_array(c.centro_custo_nome, ';'), string_to_array(c.valor_centro_custo, ';')) WITH ORDINALITY AS t(nome_i, valor_i, pos)
  WHERE c.classe = 'MISTO' GROUP BY 1
)
SELECT tipo, ROUND(SUM(val)::numeric, 2) AS total FROM (SELECT * FROM simples UNION ALL SELECT * FROM mistos) u GROUP BY 1 ORDER BY 1;
"
```

Expected output (approximate):
```
       tipo       |   total   
------------------+-----------
 NAO_CLASSIFICADO |  20479.43
 PONTUAL          | 432359.60
 RECORRENTE       | 901112.34
```

If numbers differ by more than R$ 1, the query has a bug. Investigate before proceeding.

---

- [ ] **Step 3.4: Smoke test the endpoint via curl (if auth permits)**

If dev is logged in (session cookie exists in browser):

```bash
curl -s "http://localhost:3000/api/financeiro/receita-recorrente/resumo?data_ini=2026-03-01&data_fim=2026-04-01&empresa=TURBO%20PARTNERS" \
  -H "Cookie: $(grep -o 'connect.sid=[^;]*' ~/.cortex-session 2>/dev/null)" 2>&1 | head -50
```

Or simply open the page in dev mode and watch the Network tab.

Expected: JSON response with `meses[0]` containing `recorrente_previsto: ~901112`.

If auth blocks, skip this step — the SQL validation in 3.3 is sufficient.

---

- [ ] **Step 3.5: Commit**

```bash
git add server/routes/receitaRecorrente.ts
git commit -m "$(cat <<'EOF'
feat(receita-recorrente): /resumo endpoint com query 3-case split

Endpoint retorna meses[] com recorrente/pontual/não-classif previsto e realizado,
cobertura CC %, MRR contratado (snapshot) e flag is_futuro.

Validado contra snapshot: Mar/26 TURBO recorrente R$ 901.112.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Cards metrics (mrr_atual, delta, mix, realizado, gap, ticket, novos/churned)

**Goal:** Adicionar todos os 7 cards ao payload de `/resumo`. Valores calculados com base nos `meses[]` já agrupados + queries auxiliares para ticket médio e novos/churned.

**Files:**
- Modify: `server/routes/receitaRecorrente.ts` (replace `cards: { ... zerado }` com cálculo real)

---

- [ ] **Step 4.1: Add helper function to find "mês corrente"**

At the top of `receitaRecorrente.ts` (below the imports), add:

```ts
function findMesCorrente(now: Date): string {
  const mesCorrente = new Date(now.getFullYear(), now.getMonth(), 1);
  return mesCorrente.toISOString().slice(0, 10);
}

function findMesAnterior(now: Date): string {
  const mesAnt = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return mesAnt.toISOString().slice(0, 10);
}
```

---

- [ ] **Step 4.2: Query ticket médio + novos/churned (add two queries before res.json)**

In the `/resumo` handler, after the existing queries but before `res.json`, add:

```ts
      const mesCorrenteStr = findMesCorrente(now);
      const mesAnteriorStr = findMesAnterior(now);

      // Clientes recorrentes do mês corrente (para ticket médio)
      const clientesRecorrenteAtualResult = await db.execute(sql`
        SELECT COUNT(DISTINCT p.id_cliente)::int AS total
        FROM "Conta Azul".caz_parcelas p
        WHERE p.tipo_evento = 'RECEITA'
          AND DATE_TRUNC('month', COALESCE(p.data_competencia, p.data_vencimento)) = ${mesCorrenteStr}::date
          AND COALESCE(p.status, '') <> 'CANCELADO'
          AND p.centro_custo_nome ILIKE '%recorrente%'
          AND COALESCE(p.categoria_nome, '') NOT LIKE '04.%'
          ${empresaClause}
          AND p.id_cliente IS NOT NULL
      `);
      const totalClientesRecorrente = (clientesRecorrenteAtualResult.rows[0] as any)?.total || 0;

      // Novos/churned: comparar sets de clientes entre mês corrente e anterior
      const clientesRecorrenteMesAtualResult = await db.execute(sql`
        SELECT DISTINCT p.id_cliente::text AS id_cliente
        FROM "Conta Azul".caz_parcelas p
        WHERE p.tipo_evento = 'RECEITA'
          AND DATE_TRUNC('month', COALESCE(p.data_competencia, p.data_vencimento)) = ${mesCorrenteStr}::date
          AND COALESCE(p.status, '') <> 'CANCELADO'
          AND p.centro_custo_nome ILIKE '%recorrente%'
          ${empresaClause}
          AND p.id_cliente IS NOT NULL
      `);
      const clientesRecorrenteMesAnteriorResult = await db.execute(sql`
        SELECT DISTINCT p.id_cliente::text AS id_cliente
        FROM "Conta Azul".caz_parcelas p
        WHERE p.tipo_evento = 'RECEITA'
          AND DATE_TRUNC('month', COALESCE(p.data_competencia, p.data_vencimento)) = ${mesAnteriorStr}::date
          AND COALESCE(p.status, '') <> 'CANCELADO'
          AND p.centro_custo_nome ILIKE '%recorrente%'
          ${empresaClause}
          AND p.id_cliente IS NOT NULL
      `);

      const setAtual = new Set((clientesRecorrenteMesAtualResult.rows as any[]).map(r => r.id_cliente));
      const setAnterior = new Set((clientesRecorrenteMesAnteriorResult.rows as any[]).map(r => r.id_cliente));
      const novos_recorrente = [...setAtual].filter(id => !setAnterior.has(id)).length;
      const churned_recorrente = [...setAnterior].filter(id => !setAtual.has(id)).length;
```

---

- [ ] **Step 4.3: Calculate cards from meses array**

Replace the `cards: { ... zerado }` object in `res.json` with:

```ts
      // Consolidar meses por data (somando empresas) para calcular cards
      const mesesConsolidados = new Map<string, { previsto: number; realizado: number; recorrente_previsto: number; recorrente_realizado: number; pontual_previsto: number; pontual_realizado: number }>();
      for (const m of meses) {
        const entry = mesesConsolidados.get(m.mes) || {
          previsto: 0, realizado: 0,
          recorrente_previsto: 0, recorrente_realizado: 0,
          pontual_previsto: 0, pontual_realizado: 0,
        };
        entry.previsto += m.total_previsto;
        entry.realizado += m.total_realizado;
        entry.recorrente_previsto += m.recorrente_previsto;
        entry.recorrente_realizado += m.recorrente_realizado;
        entry.pontual_previsto += m.pontual_previsto;
        entry.pontual_realizado += m.pontual_realizado;
        mesesConsolidados.set(m.mes, entry);
      }

      const corrente = mesesConsolidados.get(mesCorrenteStr);
      const anterior = mesesConsolidados.get(mesAnteriorStr);

      const mrrRecorrenteAtual = corrente?.recorrente_realizado || 0;
      const mrrRecorrenteAnt = anterior?.recorrente_realizado || 0;
      const mrrRecorrenteDeltaPct = mrrRecorrenteAnt > 0
        ? ((mrrRecorrenteAtual - mrrRecorrenteAnt) / mrrRecorrenteAnt) * 100
        : 0;

      const pontualAtual = corrente?.pontual_realizado || 0;
      const pontualAnt = anterior?.pontual_realizado || 0;
      const pontualDeltaPct = pontualAnt > 0
        ? ((pontualAtual - pontualAnt) / pontualAnt) * 100
        : 0;

      const totalCorrente = corrente?.realizado || 0;
      const mixRecorrentePct = totalCorrente > 0
        ? (mrrRecorrenteAtual / totalCorrente) * 100
        : 0;

      const realizadoPct = (corrente?.previsto || 0) > 0
        ? ((corrente?.realizado || 0) / (corrente?.previsto || 1)) * 100
        : 0;

      const gapAbs = mrrContratado - mrrRecorrenteAtual;
      const gapPct = mrrContratado > 0 ? (gapAbs / mrrContratado) * 100 : 0;
      const gapContratado = mrrContratado > 0
        ? { valor: gapAbs, pct: gapPct }
        : null;

      const ticketMedioRecorrente = totalClientesRecorrente > 0
        ? mrrRecorrenteAtual / totalClientesRecorrente
        : 0;

      res.json({
        meses,
        cards: {
          mrr_recorrente_atual: mrrRecorrenteAtual,
          mrr_recorrente_delta_pct: mrrRecorrenteDeltaPct,
          pontual_atual: pontualAtual,
          pontual_delta_pct: pontualDeltaPct,
          mix_recorrente_pct: mixRecorrentePct,
          realizado_pct: realizadoPct,
          gap_contratado: gapContratado,
          ticket_medio_recorrente: ticketMedioRecorrente,
          novos_recorrente,
          churned_recorrente,
        },
        range: { data_ini: dataIni, data_fim: dataFim },
        empresa_filtro: empresaFiltro,
      });
```

---

- [ ] **Step 4.4: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors in `receitaRecorrente.ts`.

---

- [ ] **Step 4.5: Restart dev server and sanity check**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
```

Wait 5s. Then query the DB to cross-check the expected card values for April 2026 (mês corrente), both empresas:

```bash
PGPASSWORD='Turbosenha*' psql -h 34.95.249.110 -U postgres -d dados_turbo -c "
SELECT 
  COUNT(DISTINCT p.id_cliente)::int AS clientes_rec_abril,
  ROUND(SUM(p.valor_bruto) FILTER (WHERE p.status IN ('PAGO','QUITADO'))::numeric, 2) AS recorrente_realizado_abril
FROM \"Conta Azul\".caz_parcelas p
WHERE p.tipo_evento = 'RECEITA'
  AND DATE_TRUNC('month', COALESCE(p.data_competencia, p.data_vencimento)) = '2026-04-01'
  AND COALESCE(p.status, '') <> 'CANCELADO'
  AND p.centro_custo_nome ILIKE '%recorrente%'
  AND COALESCE(p.categoria_nome, '') NOT LIKE '04.%';
"
```

Document the result (number of clients + realized value). Quando a UI estiver pronta, comparar os cards com esses números.

---

- [ ] **Step 4.6: Commit**

```bash
git add server/routes/receitaRecorrente.ts
git commit -m "$(cat <<'EOF'
feat(receita-recorrente): adicionar 7 cards KPI ao endpoint /resumo

Inclui: MRR recorrente atual+delta, pontual atual+delta, mix %, realizado %,
gap vs contratado, ticket médio e contagem novos/churned.

Novos/churned calculados por diferença de sets de id_cliente entre mês
corrente e anterior.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: /drilldown endpoint

**Goal:** Endpoint retorna lista de parcelas de um mês/tipo/empresa específicos, com nome do cliente resolvido via JOIN com `caz_clientes`, ordenadas por `valor_bruto DESC`.

**Files:**
- Modify: `server/routes/receitaRecorrente.ts` (replace stub `/drilldown`)

---

- [ ] **Step 5.1: Implement /drilldown handler**

Replace the `/drilldown` handler in `server/routes/receitaRecorrente.ts` with:

```ts
  app.get("/api/financeiro/receita-recorrente/drilldown", async (req, res) => {
    try {
      const mes = req.query.mes as string;          // e.g. "2026-03-01"
      const tipo = req.query.tipo as string;        // "RECORRENTE" | "PONTUAL" | "NAO_CLASSIFICADO"
      const empresaFiltro = (req.query.empresa as string) || null;

      if (!mes || !tipo) {
        return res.status(400).json({ error: "Missing required params: mes, tipo" });
      }

      // Filtro por tipo no centro_custo_nome
      let tipoClause;
      if (tipo === 'RECORRENTE') {
        tipoClause = sql` AND p.centro_custo_nome ILIKE '%recorrente%' AND NOT (p.centro_custo_nome ILIKE '%recorrente%' AND p.centro_custo_nome ILIKE '%pontual%')`;
      } else if (tipo === 'PONTUAL') {
        tipoClause = sql` AND p.centro_custo_nome ILIKE '%pontual%' AND NOT (p.centro_custo_nome ILIKE '%recorrente%' AND p.centro_custo_nome ILIKE '%pontual%')`;
      } else {
        tipoClause = sql` AND (p.centro_custo_nome IS NULL OR p.centro_custo_nome = '' OR (p.centro_custo_nome NOT ILIKE '%recorrente%' AND p.centro_custo_nome NOT ILIKE '%pontual%'))`;
      }

      const empresaClause = empresaFiltro
        ? sql` AND p.empresa = ${empresaFiltro}`
        : sql``;

      const result = await db.execute(sql`
        SELECT
          p.id::text AS id_parcela,
          COALESCE(cl.nome, p.nome)::text AS cliente_nome,
          cl.cnpj::text AS cliente_cnpj,
          p.descricao::text AS descricao,
          p.categoria_nome::text AS categoria_nome,
          p.valor_bruto::float AS valor_bruto,
          p.status::text AS status,
          COALESCE(p.data_competencia, p.data_vencimento)::date::text AS data_competencia,
          p.data_vencimento::date::text AS data_vencimento,
          p.venda_id::text AS venda_id,
          p.empresa::text AS empresa
        FROM "Conta Azul".caz_parcelas p
        LEFT JOIN "Conta Azul".caz_clientes cl
          ON cl.ids::uuid = p.id_cliente
        WHERE p.tipo_evento = 'RECEITA'
          AND DATE_TRUNC('month', COALESCE(p.data_competencia, p.data_vencimento)) = ${mes}::date
          AND COALESCE(p.status, '') <> 'CANCELADO'
          AND COALESCE(p.categoria_nome, '') NOT LIKE '04.%'
          ${tipoClause}
          ${empresaClause}
        ORDER BY p.valor_bruto DESC NULLS LAST
      `);

      res.json(result.rows);
    } catch (error: any) {
      console.error("[api] Error fetching receita-recorrente/drilldown:", error);
      res.status(500).json({ error: error.message || "Failed to fetch drilldown" });
    }
  });
```

> **Nota sobre o filtro de tipo:** A query filtra no SQL diretamente (em vez de reusar a CTE principal), porque aqui queremos a lista granular. Casos mistos (`Recorrente;Pontual`) são excluídos de ambos os filtros — v1 assume que o valor do drill-down não quebra perfeitamente para esses casos. Documentar limitação: clicar em "Recorrente" numa célula cuja soma inclui split de mistos pode mostrar total ligeiramente menor que o card. Se ficar problema, v2 expande o unnest.

---

- [ ] **Step 5.2: Restart dev server**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
```

---

- [ ] **Step 5.3: Sanity check via DB direct query**

Cross-check: quantas parcelas RECORRENTE existem em março/26 TURBO?

```bash
PGPASSWORD='Turbosenha*' psql -h 34.95.249.110 -U postgres -d dados_turbo -c "
SELECT COUNT(*) AS parcelas, ROUND(SUM(valor_bruto)::numeric, 2) AS total
FROM \"Conta Azul\".caz_parcelas p
WHERE p.tipo_evento = 'RECEITA'
  AND DATE_TRUNC('month', COALESCE(p.data_competencia, p.data_vencimento)) = '2026-03-01'
  AND p.empresa = 'TURBO PARTNERS'
  AND COALESCE(p.status, '') <> 'CANCELADO'
  AND COALESCE(p.categoria_nome, '') NOT LIKE '04.%'
  AND p.centro_custo_nome ILIKE '%recorrente%'
  AND NOT (p.centro_custo_nome ILIKE '%recorrente%' AND p.centro_custo_nome ILIKE '%pontual%');
"
```

Record the expected count — quando testar manual no modal, deve bater.

---

- [ ] **Step 5.4: Commit**

```bash
git add server/routes/receitaRecorrente.ts
git commit -m "$(cat <<'EOF'
feat(receita-recorrente): endpoint /drilldown com clientes por mês/tipo

Retorna lista de parcelas filtradas por mês, tipo e empresa com JOIN
em caz_clientes para resolver nome do cliente. Ordenado por valor_bruto DESC.

Limitação v1: casos mistos (Recorrente;Pontual) são excluídos do drill-down.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Page skeleton + route + lazy import

**Goal:** Página mínima acessível em `/financeiro/receita-recorrente`, com título, loader e chamada ao endpoint `/resumo` (sem renderização dos componentes ainda).

**Files:**
- Create: `client/src/pages/financeiro/ReceitaRecorrente.tsx`
- Modify: `client/src/App.tsx` (+lazy import +Route)

---

- [ ] **Step 6.1: Create page skeleton**

Create `client/src/pages/financeiro/ReceitaRecorrente.tsx`:

```tsx
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type {
  ResumoReceitaResponse,
  Empresa,
} from "../../../../shared/receitaRecorrenteTypes";

type RangeKey = "6m" | "12m" | "ytd";

function computeRange(key: RangeKey): { ini: string; fim: string } {
  const now = new Date();
  const fim = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  let ini: Date;
  if (key === "6m") {
    ini = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  } else if (key === "12m") {
    ini = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  } else {
    ini = new Date(now.getFullYear(), 0, 1);
  }
  return {
    ini: ini.toISOString().slice(0, 10),
    fim: fim.toISOString().slice(0, 10),
  };
}

export default function ReceitaRecorrente() {
  usePageTitle("Receita Recorrente");
  useSetPageInfo({
    title: "Receita Recorrente",
    description: "MRR realizado por centro de custo (Conta Azul)",
  });

  const [rangeKey, setRangeKey] = useState<RangeKey>("6m");
  const [empresa, setEmpresa] = useState<Empresa | "todas">("todas");

  const { ini, fim } = useMemo(() => computeRange(rangeKey), [rangeKey]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({ data_ini: ini, data_fim: fim });
    if (empresa !== "todas") params.set("empresa", empresa);
    return params.toString();
  }, [ini, fim, empresa]);

  const { data, isLoading, error, refetch } = useQuery<ResumoReceitaResponse>({
    queryKey: ["/api/financeiro/receita-recorrente/resumo", queryParams],
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Receita Recorrente
          </h1>
          <p className="text-sm text-gray-600 dark:text-zinc-400">
            MRR realizado por centro de custo (Conta Azul) vs contratado (ClickUp)
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={rangeKey} onValueChange={(v) => setRangeKey(v as RangeKey)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="6m">Últimos 6 meses</SelectItem>
              <SelectItem value="12m">Últimos 12 meses</SelectItem>
              <SelectItem value="ytd">Ano corrente (YTD)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={empresa} onValueChange={(v) => setEmpresa(v as Empresa | "todas")}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas empresas</SelectItem>
              <SelectItem value="TURBO PARTNERS">Turbo Partners</SelectItem>
              <SelectItem value="PEIXOTO DEBBANE">Peixoto Debbane</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950">
          <CardContent className="p-4 flex items-center justify-between">
            <span className="text-red-700 dark:text-red-300">
              Falha ao carregar dados de receita.
            </span>
            <button
              onClick={() => refetch()}
              className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
            >
              Tentar novamente
            </button>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-[400px] w-full rounded-lg" />
          <Skeleton className="h-[300px] w-full rounded-lg" />
        </>
      )}

      {/* Content placeholder — subcomponents wired in Task 11 */}
      {data && !isLoading && (
        <div className="text-sm text-gray-500">
          Carregado: {data.meses.length} linhas × mês × empresa.
          Cards e gráficos nas próximas tasks.
        </div>
      )}
    </div>
  );
}
```

---

- [ ] **Step 6.2: Register lazy route in App.tsx**

Modify `client/src/App.tsx`:

1. Add the lazy import near the other lazy imports (around line 148 where `Negativacao` lives):

```tsx
const ReceitaRecorrente = lazyWithRetry(() => import("@/pages/financeiro/ReceitaRecorrente"));
```

2. Add the route right after the `/financeiro/negativacao` route (around line 316):

```tsx
      <Route path="/financeiro/receita-recorrente">{() => <ProtectedRoute path="/financeiro/receita-recorrente" component={ReceitaRecorrente} />}</Route>
```

---

- [ ] **Step 6.3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no new errors.

---

- [ ] **Step 6.4: Manual test — page loads**

Restart dev:
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
```

Open browser: `http://localhost:3000/financeiro/receita-recorrente`.

Expected:
- Página carrega com título "Receita Recorrente".
- Dois seletores no header funcionam.
- Loading skeletons aparecem brevemente.
- Depois do carregamento, texto "Carregado: N linhas × mês × empresa" aparece.
- Sem erros no console do browser.

Se der 401 (não autenticado), logar no app primeiro.

---

- [ ] **Step 6.5: Commit**

```bash
git add client/src/pages/financeiro/ReceitaRecorrente.tsx client/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(receita-recorrente): página skeleton com filtros e chamada ao endpoint

Header com seletores de range (6m/12m/YTD) e empresa, loading skeletons,
error state. Componentes visuais ficam para próximas tasks.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: KpiCards component

**Goal:** Componente que recebe `CardsReceita` e renderiza 7 cards usando `HeroMetric`.

**Files:**
- Create: `client/src/pages/financeiro/receita-recorrente/KpiCards.tsx`

---

- [ ] **Step 7.1: Create KpiCards component**

Create `client/src/pages/financeiro/receita-recorrente/KpiCards.tsx`:

```tsx
import { Card, CardContent } from "@/components/ui/card";
import { HeroMetric } from "@/components/HeroMetric";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { CardsReceita } from "../../../../../shared/receitaRecorrenteTypes";

interface Props {
  cards: CardsReceita;
}

function formatPct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

function formatDelta(pct: number): { value: string; isPositive: boolean } {
  const sign = pct >= 0 ? "+" : "";
  return {
    value: `${sign}${pct.toFixed(1)}% vs mês anterior`,
    isPositive: pct >= 0,
  };
}

export function KpiCards({ cards }: Props) {
  const gapColor = (() => {
    if (!cards.gap_contratado) return "text-gray-500";
    const pct = Math.abs(cards.gap_contratado.pct);
    if (pct < 3) return "text-emerald-600 dark:text-emerald-400";
    if (pct < 10) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  })();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <HeroMetric
            label="MRR Recorrente (mês)"
            value={formatCurrencyNoDecimals(cards.mrr_recorrente_atual)}
            trend={formatDelta(cards.mrr_recorrente_delta_pct)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <HeroMetric
            label="Receita Pontual (mês)"
            value={formatCurrencyNoDecimals(cards.pontual_atual)}
            trend={formatDelta(cards.pontual_delta_pct)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <HeroMetric
            label="Mix Recorrente %"
            value={formatPct(cards.mix_recorrente_pct)}
            subtitle="% da receita total do mês que é recorrente"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <HeroMetric
            label="Gap vs Contratado"
            value={
              cards.gap_contratado
                ? `${formatCurrencyNoDecimals(cards.gap_contratado.valor)} (${cards.gap_contratado.pct.toFixed(1)}%)`
                : "—"
            }
            subtitle="MRR contratado (ClickUp) − MRR realizado recorrente (Conta Azul)"
          />
          <div className={`mt-1 text-xs ${gapColor}`}>
            {cards.gap_contratado
              ? Math.abs(cards.gap_contratado.pct) < 3
                ? "Dentro da tolerância"
                : Math.abs(cards.gap_contratado.pct) < 10
                ? "Atenção"
                : "Divergência alta"
              : ""}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <HeroMetric
            label="Realizado do mês"
            value={formatPct(cards.realizado_pct)}
            subtitle="% do valor previsto que já foi pago"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <HeroMetric
            label="Ticket Médio Recorrente"
            value={formatCurrencyNoDecimals(cards.ticket_medio_recorrente)}
            subtitle="Valor recorrente do mês / clientes únicos"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <HeroMetric
            label="Entrantes / Saintes"
            value={`+${cards.novos_recorrente} / −${cards.churned_recorrente}`}
            subtitle="Clientes com parcela recorrente neste mês que não estavam no mês anterior (ou vice-versa)"
          />
        </CardContent>
      </Card>
    </div>
  );
}
```

---

- [ ] **Step 7.2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no new errors.

---

- [ ] **Step 7.3: Commit**

```bash
git add client/src/pages/financeiro/receita-recorrente/KpiCards.tsx
git commit -m "$(cat <<'EOF'
feat(receita-recorrente): KpiCards component com 7 métricas

Usa HeroMetric existente. Cores condicionais no gap vs contratado
(verde <3%, âmbar 3-10%, vermelho >10%). Labels e subtítulos
explicativos nos cards mais técnicos.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: ChartReceitaMensal component

**Goal:** Gráfico composto mostrando barras empilhadas de realizado (recorrente/pontual/não-classif) + linha de MRR contratado. Meses futuros com destaque visual.

**Files:**
- Create: `client/src/pages/financeiro/receita-recorrente/ChartReceitaMensal.tsx`

---

- [ ] **Step 8.1: Create ChartReceitaMensal component**

Create `client/src/pages/financeiro/receita-recorrente/ChartReceitaMensal.tsx`:

```tsx
import { useMemo } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { MesReceita } from "../../../../../shared/receitaRecorrenteTypes";

interface Props {
  meses: MesReceita[];
}

interface ChartPoint {
  mes: string;
  mesLabel: string;
  recorrente_realizado: number;
  pontual_realizado: number;
  nao_classif_realizado: number;
  total_previsto: number;
  total_realizado: number;
  mrr_contratado: number;
  is_futuro: boolean;
}

function monthLabel(iso: string): string {
  const d = new Date(iso);
  const month = d.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
  const year = String(d.getFullYear()).slice(-2);
  return `${month}/${year}`;
}

export function ChartReceitaMensal({ meses }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const chartData: ChartPoint[] = useMemo(() => {
    // Consolidar por mes (somando empresas) para um único ponto por mês
    const map = new Map<string, ChartPoint>();
    for (const m of meses) {
      const existing = map.get(m.mes);
      if (existing) {
        existing.recorrente_realizado += m.recorrente_realizado;
        existing.pontual_realizado += m.pontual_realizado;
        existing.nao_classif_realizado += m.nao_classif_realizado;
        existing.total_previsto += m.total_previsto;
        existing.total_realizado += m.total_realizado;
      } else {
        map.set(m.mes, {
          mes: m.mes,
          mesLabel: monthLabel(m.mes),
          recorrente_realizado: m.recorrente_realizado,
          pontual_realizado: m.pontual_realizado,
          nao_classif_realizado: m.nao_classif_realizado,
          total_previsto: m.total_previsto,
          total_realizado: m.total_realizado,
          mrr_contratado: m.mrr_contratado,
          is_futuro: m.is_futuro,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.mes.localeCompare(b.mes));
  }, [meses]);

  const gridColor = isDark ? "#27272a" : "#e5e7eb";
  const axisColor = isDark ? "#a1a1aa" : "#6b7280";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolução Mensal</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[420px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="mesLabel" stroke={axisColor} tick={{ fill: axisColor, fontSize: 12 }} />
              <YAxis
                stroke={axisColor}
                tick={{ fill: axisColor, fontSize: 11 }}
                tickFormatter={(v) => formatCurrencyNoDecimals(v).replace("R$", "").trim()}
                width={80}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? "#18181b" : "#ffffff",
                  border: `1px solid ${gridColor}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: axisColor }}
                formatter={(value: any, name: string) => {
                  if (typeof value !== "number") return [value, name];
                  return [formatCurrencyNoDecimals(value), name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />

              <Bar
                dataKey="recorrente_realizado"
                name="Recorrente"
                stackId="realizado"
                fill="#10b981"
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-rec-${index}`}
                    fillOpacity={entry.is_futuro ? 0.35 : 1}
                  />
                ))}
              </Bar>
              <Bar
                dataKey="pontual_realizado"
                name="Pontual"
                stackId="realizado"
                fill="#f59e0b"
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-pon-${index}`}
                    fillOpacity={entry.is_futuro ? 0.35 : 1}
                  />
                ))}
              </Bar>
              <Bar
                dataKey="nao_classif_realizado"
                name="Não Classif"
                stackId="realizado"
                fill="#64748b"
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-nc-${index}`}
                    fillOpacity={entry.is_futuro ? 0.35 : 1}
                  />
                ))}
              </Bar>

              <Line
                type="monotone"
                dataKey="mrr_contratado"
                name="MRR Contratado (ClickUp)"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 4, fill: "#3b82f6" }}
              />
              <Line
                type="monotone"
                dataKey="total_previsto"
                name="Previsto total"
                stroke="#9ca3af"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-zinc-400">
          Barras claras = meses futuros com parcelas agendadas. Linha azul = MRR contratado (snapshot ClickUp). Linha cinza tracejada = total previsto do mês.
        </p>
      </CardContent>
    </Card>
  );
}
```

---

- [ ] **Step 8.2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no new errors. Recharts types should all match.

---

- [ ] **Step 8.3: Commit**

```bash
git add client/src/pages/financeiro/receita-recorrente/ChartReceitaMensal.tsx
git commit -m "$(cat <<'EOF'
feat(receita-recorrente): ChartReceitaMensal com ComposedChart

Barras empilhadas (recorrente/pontual/não-classif) + linha MRR contratado
+ linha tracejada de previsto total. Meses futuros com opacity reduzida.
Dark/light mode via ThemeProvider.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: TabelaReceitaMensal component

**Goal:** Tabela com uma linha por mês × empresa, células de R$ clicáveis (dispara callback para abrir modal), badge de cobertura, linha de total.

**Files:**
- Create: `client/src/pages/financeiro/receita-recorrente/TabelaReceitaMensal.tsx`

---

- [ ] **Step 9.1: Create TabelaReceitaMensal component**

Create `client/src/pages/financeiro/receita-recorrente/TabelaReceitaMensal.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyNoDecimals, cn } from "@/lib/utils";
import { Clock } from "lucide-react";
import type {
  MesReceita, TipoReceita, Empresa,
} from "../../../../../shared/receitaRecorrenteTypes";

interface CellClickPayload {
  mes: string;
  tipo: TipoReceita;
  empresa: Empresa;
}

interface Props {
  meses: MesReceita[];
  onCellClick: (payload: CellClickPayload) => void;
}

function monthLabel(iso: string): string {
  const d = new Date(iso);
  const month = d.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
  const year = String(d.getFullYear()).slice(-2);
  return `${month}/${year}`;
}

function empresaLabel(e: Empresa): string {
  return e === "TURBO PARTNERS" ? "Turbo" : "PD";
}

function coberturaBadge(pct: number) {
  if (pct >= 90) {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-xs bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
        {pct.toFixed(0)}%
      </span>
    );
  }
  if (pct >= 70) {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-xs bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
        {pct.toFixed(0)}%
      </span>
    );
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
      {pct.toFixed(0)}%
    </span>
  );
}

function ValorCell({
  value, onClick, disabled,
}: {
  value: number;
  onClick?: () => void;
  disabled: boolean;
}) {
  if (disabled || value === 0) {
    return (
      <td className="px-3 py-2 text-right text-sm text-gray-400 dark:text-zinc-600">
        —
      </td>
    );
  }
  return (
    <td className="px-3 py-2 text-right text-sm">
      <button
        type="button"
        onClick={onClick}
        className="hover:underline hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
      >
        {formatCurrencyNoDecimals(value)}
      </button>
    </td>
  );
}

export function TabelaReceitaMensal({ meses, onCellClick }: Props) {
  const sorted = [...meses].sort((a, b) => {
    if (a.mes !== b.mes) return a.mes.localeCompare(b.mes);
    return a.empresa.localeCompare(b.empresa);
  });

  // Totalizador do rodapé
  const totais = sorted.reduce(
    (acc, m) => ({
      recorrente: acc.recorrente + m.recorrente_realizado,
      pontual: acc.pontual + m.pontual_realizado,
      nao_classif: acc.nao_classif + m.nao_classif_realizado,
      previsto: acc.previsto + m.total_previsto,
      realizado: acc.realizado + m.total_realizado,
    }),
    { recorrente: 0, pontual: 0, nao_classif: 0, previsto: 0, realizado: 0 }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalhamento mensal</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 dark:border-zinc-700">
            <tr className="text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-400">
              <th className="px-3 py-2 text-left">Mês</th>
              <th className="px-3 py-2 text-left">Empresa</th>
              <th className="px-3 py-2 text-right">Recorrente</th>
              <th className="px-3 py-2 text-right">Pontual</th>
              <th className="px-3 py-2 text-right">Não Classif</th>
              <th className="px-3 py-2 text-right">Previsto</th>
              <th className="px-3 py-2 text-right">Realizado</th>
              <th className="px-3 py-2 text-right">% Real</th>
              <th className="px-3 py-2 text-center">Cobertura</th>
              <th className="px-3 py-2 text-right">Contratado</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => {
              const pctReal = m.total_previsto > 0 ? (m.total_realizado / m.total_previsto) * 100 : 0;
              const rowCls = cn(
                "border-b border-gray-100 dark:border-zinc-800",
                m.is_futuro && "opacity-60"
              );
              return (
                <tr key={`${m.mes}-${m.empresa}`} className={rowCls}>
                  <td className="px-3 py-2 flex items-center gap-1">
                    {m.is_futuro && <Clock className="w-3 h-3 text-gray-400" />}
                    <span>{monthLabel(m.mes)}</span>
                  </td>
                  <td className="px-3 py-2">{empresaLabel(m.empresa)}</td>
                  <ValorCell
                    value={m.recorrente_realizado}
                    onClick={() => onCellClick({ mes: m.mes, tipo: "RECORRENTE", empresa: m.empresa })}
                    disabled={m.is_futuro}
                  />
                  <ValorCell
                    value={m.pontual_realizado}
                    onClick={() => onCellClick({ mes: m.mes, tipo: "PONTUAL", empresa: m.empresa })}
                    disabled={m.is_futuro}
                  />
                  <ValorCell
                    value={m.nao_classif_realizado}
                    onClick={() => onCellClick({ mes: m.mes, tipo: "NAO_CLASSIFICADO", empresa: m.empresa })}
                    disabled={m.is_futuro}
                  />
                  <td className="px-3 py-2 text-right">{formatCurrencyNoDecimals(m.total_previsto)}</td>
                  <td className="px-3 py-2 text-right font-medium">
                    {formatCurrencyNoDecimals(m.total_realizado)}
                  </td>
                  <td className="px-3 py-2 text-right">{pctReal.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-center">{coberturaBadge(m.cobertura_cc_pct)}</td>
                  <td className="px-3 py-2 text-right text-gray-500">
                    {formatCurrencyNoDecimals(m.mrr_contratado)}
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-gray-500">
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
          </tbody>
          {sorted.length > 0 && (
            <tfoot className="border-t-2 border-gray-300 dark:border-zinc-600 font-semibold">
              <tr>
                <td className="px-3 py-2" colSpan={2}>Total</td>
                <td className="px-3 py-2 text-right">{formatCurrencyNoDecimals(totais.recorrente)}</td>
                <td className="px-3 py-2 text-right">{formatCurrencyNoDecimals(totais.pontual)}</td>
                <td className="px-3 py-2 text-right">{formatCurrencyNoDecimals(totais.nao_classif)}</td>
                <td className="px-3 py-2 text-right">{formatCurrencyNoDecimals(totais.previsto)}</td>
                <td className="px-3 py-2 text-right">{formatCurrencyNoDecimals(totais.realizado)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
      </CardContent>
    </Card>
  );
}
```

---

- [ ] **Step 9.2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no new errors.

---

- [ ] **Step 9.3: Commit**

```bash
git add client/src/pages/financeiro/receita-recorrente/TabelaReceitaMensal.tsx
git commit -m "$(cat <<'EOF'
feat(receita-recorrente): TabelaReceitaMensal com células clicáveis

Tabela com linha por mês × empresa, células de R$ viram botões que
disparam onCellClick para abrir modal de drilldown. Badge de cobertura
CC (verde >=90%, âmbar 70-90%, vermelho <70%). Meses futuros com
opacity-60 e ícone de relógio. Linha de total no rodapé.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: DrilldownClientesModal component

**Goal:** Modal que abre ao clicar numa célula, busca parcelas via `/drilldown`, exibe tabela com busca client-side.

**Files:**
- Create: `client/src/pages/financeiro/receita-recorrente/DrilldownClientesModal.tsx`

---

- [ ] **Step 10.1: Create DrilldownClientesModal component**

Create `client/src/pages/financeiro/receita-recorrente/DrilldownClientesModal.tsx`:

```tsx
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type {
  DrilldownResponse, TipoReceita, Empresa,
} from "../../../../../shared/receitaRecorrenteTypes";

interface Props {
  open: boolean;
  mes: string | null;
  tipo: TipoReceita | null;
  empresa: Empresa | null;
  onClose: () => void;
}

const TIPO_LABEL: Record<TipoReceita, string> = {
  RECORRENTE: "Recorrente",
  PONTUAL: "Pontual",
  NAO_CLASSIFICADO: "Não Classificado",
};

function monthLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { month: "long", year: "numeric" });
}

export function DrilldownClientesModal({ open, mes, tipo, empresa, onClose }: Props) {
  const [search, setSearch] = useState("");

  const queryParams = useMemo(() => {
    if (!mes || !tipo) return "";
    const p = new URLSearchParams({ mes, tipo });
    if (empresa) p.set("empresa", empresa);
    return p.toString();
  }, [mes, tipo, empresa]);

  const { data, isLoading, error, refetch } = useQuery<DrilldownResponse>({
    queryKey: ["/api/financeiro/receita-recorrente/drilldown", queryParams],
    enabled: open && !!mes && !!tipo,
    staleTime: 5 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(p =>
      (p.cliente_nome || "").toLowerCase().includes(q) ||
      (p.descricao || "").toLowerCase().includes(q)
    );
  }, [data, search]);

  const total = useMemo(
    () => filtered.reduce((acc, p) => acc + (p.valor_bruto || 0), 0),
    [filtered]
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Parcelas — {monthLabel(mes)} — {tipo ? TIPO_LABEL[tipo] : ""} — {empresa || "Todas empresas"}
          </DialogTitle>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            {isLoading
              ? "Carregando…"
              : `${formatCurrencyNoDecimals(total)} em ${filtered.length} parcelas`}
          </p>
        </DialogHeader>

        <div className="py-2">
          <Input
            placeholder="Buscar por cliente ou descrição…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-y-auto flex-1">
          {error && (
            <div className="p-4 text-center">
              <p className="text-red-600 dark:text-red-400 mb-2">Falha ao carregar parcelas.</p>
              <button
                onClick={() => refetch()}
                className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}

          {!isLoading && !error && filtered.length === 0 && (
            <div className="p-4 text-center text-gray-500">
              Sem parcelas nessa categoria.
            </div>
          )}

          {!isLoading && !error && filtered.length > 0 && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700">
                <tr className="text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                  <th className="px-3 py-2 text-left">Cliente</th>
                  <th className="px-3 py-2 text-left">Descrição</th>
                  <th className="px-3 py-2 text-left">Categoria</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2 text-left">Vencimento</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id_parcela}
                    className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="px-3 py-2 font-medium">
                      {p.cliente_nome || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-zinc-400 max-w-[300px] truncate">
                      {p.descricao || "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-zinc-400 text-xs">
                      {p.categoria_nome || "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatCurrencyNoDecimals(p.valor_bruto)}
                    </td>
                    <td className="px-3 py-2 text-center text-xs">{p.status}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-zinc-400">
                      {p.data_vencimento}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

- [ ] **Step 10.2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no new errors.

---

- [ ] **Step 10.3: Commit**

```bash
git add client/src/pages/financeiro/receita-recorrente/DrilldownClientesModal.tsx
git commit -m "$(cat <<'EOF'
feat(receita-recorrente): DrilldownClientesModal com busca client-side

Modal shadcn Dialog que carrega parcelas via React Query enabled quando
aberto. Filtro client-side por cliente ou descrição, sticky header na
tabela, skeleton de loading, tratamento de erro com retry.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Wire everything — final integration

**Goal:** Página principal importa e renderiza todos os subcomponentes. Estado do modal gerenciado na página. Tudo conectado.

**Files:**
- Modify: `client/src/pages/financeiro/ReceitaRecorrente.tsx`

---

- [ ] **Step 11.1: Replace placeholder with real components**

Replace the content of `client/src/pages/financeiro/ReceitaRecorrente.tsx` with the final version:

```tsx
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { KpiCards } from "./receita-recorrente/KpiCards";
import { ChartReceitaMensal } from "./receita-recorrente/ChartReceitaMensal";
import { TabelaReceitaMensal } from "./receita-recorrente/TabelaReceitaMensal";
import { DrilldownClientesModal } from "./receita-recorrente/DrilldownClientesModal";
import type {
  ResumoReceitaResponse,
  Empresa,
  TipoReceita,
} from "../../../../shared/receitaRecorrenteTypes";

type RangeKey = "6m" | "12m" | "ytd";

interface ModalState {
  open: boolean;
  mes: string | null;
  tipo: TipoReceita | null;
  empresa: Empresa | null;
}

function computeRange(key: RangeKey): { ini: string; fim: string } {
  const now = new Date();
  const fim = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  let ini: Date;
  if (key === "6m") {
    ini = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  } else if (key === "12m") {
    ini = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  } else {
    ini = new Date(now.getFullYear(), 0, 1);
  }
  return {
    ini: ini.toISOString().slice(0, 10),
    fim: fim.toISOString().slice(0, 10),
  };
}

export default function ReceitaRecorrente() {
  usePageTitle("Receita Recorrente");
  useSetPageInfo({
    title: "Receita Recorrente",
    description: "MRR realizado por centro de custo (Conta Azul)",
  });

  const [rangeKey, setRangeKey] = useState<RangeKey>("6m");
  const [empresa, setEmpresa] = useState<Empresa | "todas">("todas");
  const [modal, setModal] = useState<ModalState>({
    open: false, mes: null, tipo: null, empresa: null,
  });

  const { ini, fim } = useMemo(() => computeRange(rangeKey), [rangeKey]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({ data_ini: ini, data_fim: fim });
    if (empresa !== "todas") params.set("empresa", empresa);
    return params.toString();
  }, [ini, fim, empresa]);

  const { data, isLoading, error, refetch, isFetching } = useQuery<ResumoReceitaResponse>({
    queryKey: ["/api/financeiro/receita-recorrente/resumo", queryParams],
    staleTime: 5 * 60 * 1000,
  });

  const handleCellClick = (payload: { mes: string; tipo: TipoReceita; empresa: Empresa }) => {
    setModal({ open: true, ...payload });
  };

  const handleCloseModal = () => {
    setModal((m) => ({ ...m, open: false }));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Receita Recorrente
          </h1>
          <p className="text-sm text-gray-600 dark:text-zinc-400">
            MRR realizado por centro de custo (Conta Azul) vs contratado (ClickUp)
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={rangeKey} onValueChange={(v) => setRangeKey(v as RangeKey)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="6m">Últimos 6 meses</SelectItem>
              <SelectItem value="12m">Últimos 12 meses</SelectItem>
              <SelectItem value="ytd">Ano corrente (YTD)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={empresa} onValueChange={(v) => setEmpresa(v as Empresa | "todas")}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas empresas</SelectItem>
              <SelectItem value="TURBO PARTNERS">Turbo Partners</SelectItem>
              <SelectItem value="PEIXOTO DEBBANE">Peixoto Debbane</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <Card className="border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950">
          <CardContent className="p-4 flex items-center justify-between">
            <span className="text-red-700 dark:text-red-300">
              Falha ao carregar dados de receita.
            </span>
            <button
              onClick={() => refetch()}
              className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
            >
              Tentar novamente
            </button>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-[440px] w-full rounded-lg" />
          <Skeleton className="h-[300px] w-full rounded-lg" />
        </>
      )}

      {data && !isLoading && (
        <div className={isFetching ? "opacity-70 transition-opacity" : ""}>
          <KpiCards cards={data.cards} />
          <div className="mt-6">
            <ChartReceitaMensal meses={data.meses} />
          </div>
          <div className="mt-6">
            <TabelaReceitaMensal meses={data.meses} onCellClick={handleCellClick} />
          </div>
        </div>
      )}

      <DrilldownClientesModal
        open={modal.open}
        mes={modal.mes}
        tipo={modal.tipo}
        empresa={modal.empresa}
        onClose={handleCloseModal}
      />
    </div>
  );
}
```

---

- [ ] **Step 11.2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors.

---

- [ ] **Step 11.3: Restart dev server**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
```

Wait 5s.

---

- [ ] **Step 11.4: Commit**

```bash
git add client/src/pages/financeiro/ReceitaRecorrente.tsx
git commit -m "$(cat <<'EOF'
feat(receita-recorrente): integração final — compõe cards, chart, tabela e modal

Página principal importa todos os subcomponentes, gerencia estado de
modal e filtros, fluxo de click-to-drilldown funcional.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Manual smoke test + sanity check numérico

**Goal:** Validar end-to-end no browser. Comparar números contra os snapshots do spec. Dark/light mode OK.

**Files:** Nenhuma mudança esperada. Se bugs aparecerem, fixar em commits separados.

---

- [ ] **Step 12.1: Sanity check numérico contra spec**

Abrir `http://localhost:3000/financeiro/receita-recorrente` autenticado. Verificar na aba Network a resposta de `/resumo?data_ini=2025-10-01&data_fim=2026-05-01` (sem empresa).

Comparar valores dos meses (consolidado):

```
Mar/26 RECORRENTE previsto: 997.398 ± R$ 1 (TURBO 901.112 + PD 96.286)
Mar/26 PONTUAL previsto: 440.000 ± R$ 1.000 (TURBO 432K + PD 7K)
```

Se divergir, abrir a query no psql (mesmo SQL do Task 3 step 3) e comparar linha por linha.

---

- [ ] **Step 12.2: Checklist manual no browser**

Rodar o checklist do spec:

- [ ] Página abre sem erros no console.
- [ ] 7 cards aparecem com valores coerentes.
- [ ] Chart renderiza 7 meses no default (6m range).
- [ ] Meses futuros (maio+ se houver parcelas) estão com opacity reduzida.
- [ ] Trocar range para 12m → refetcha e aparece mais meses.
- [ ] Trocar empresa para TURBO PARTNERS → dados de PD somem.
- [ ] Trocar empresa para PEIXOTO DEBBANE → dados de TURBO somem, números coerentes.
- [ ] Voltar empresa para Todas → dados de ambas aparecem.
- [ ] Clicar numa célula "Recorrente" de TURBO no mês mais recente → modal abre com clientes.
- [ ] Modal: digitar nome parcial no input → filtra a lista.
- [ ] Modal: fechar e clicar noutra célula (Pontual) → abre com dados diferentes.
- [ ] Toggle dark mode (se disponível) → cores continuam legíveis.
- [ ] Toggle light mode → idem.
- [ ] Badge de cobertura na tabela: verde em meses recentes (>90%), âmbar/vermelho se range incluir 2025.

Documentar qualquer discrepância encontrada. Se alguma coisa não funciona, fixar com commit separado antes de considerar feito.

---

- [ ] **Step 12.3: Commit de fixes (se houver)**

Se algum ajuste for necessário durante o smoke test, commitar com mensagem descritiva:

```bash
git add <arquivos_alterados>
git commit -m "fix(receita-recorrente): <descrição do fix>

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

- [ ] **Step 12.4: Push da branch**

```bash
git push -u origin feature/receita-recorrente-mrr
```

---

- [ ] **Step 12.5: Criar PR para staging**

Usar `gh pr create` com título e descrição focados nos benefícios e no sanity check feito:

```bash
gh pr create --base staging --title "feat(receita-recorrente): página MRR realizado por centro de custo" --body "$(cat <<'EOF'
## Sumário

Nova página /financeiro/receita-recorrente que mostra MRR realizado (recorrente/pontual/não-classificado) extraído do Conta Azul via centro_custo_nome, comparado com MRR contratado do ClickUp.

- 7 cards KPI: MRR recorrente, pontual, mix %, gap vs contratado, realizado %, ticket médio, entrantes/saintes
- Gráfico composto (barras empilhadas + linha contratado + linha previsto)
- Tabela mês × empresa com drill-down por cliente
- Filtros de range (6m/12m/YTD) e empresa
- Classificação com 3 casos para tratar CCs multi-valor + bug de rateio do Conta Azul

## Sanity check

Gap vs MRR contratado (snapshot atual): 2,3% (abril/26). Validado contra valores conhecidos:
- Mar/26 Recorrente consolidado: R$ 997.398 (TURBO 901.112 + PD 96.286)
- Abr/26 Recorrente consolidado: R$ 1.084.218 (TURBO 997.123 + PD 87.095)

## Test plan

- [ ] Abrir /financeiro/receita-recorrente e validar carregamento completo
- [ ] Trocar range e empresa, conferir refetch
- [ ] Drill-down: clicar em célula e conferir lista de clientes
- [ ] Dark/light mode
- [ ] Comparar números Mar/26 contra snapshot

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

### Spec coverage

| Requisito do spec | Task |
|---|---|
| Tipos compartilhados | Task 1 |
| Rota `/financeiro/receita-recorrente` | Task 1 (permission) + Task 6 (React route) |
| Item de menu em Financeiro | Task 1 |
| Query SQL com 3-case split | Task 3 |
| Cobertura CC % por mês | Task 3 |
| MRR contratado do ClickUp | Task 3 |
| 7 cards KPI (mrr, pontual, mix, realizado, gap, ticket, novos/churned) | Task 4 |
| Endpoint /drilldown | Task 5 |
| Página skeleton com filtros | Task 6 |
| Componente KpiCards | Task 7 |
| ChartReceitaMensal | Task 8 |
| TabelaReceitaMensal com drill-down | Task 9 |
| DrilldownClientesModal | Task 10 |
| Integração final | Task 11 |
| Sanity check numérico | Task 12 |
| Testes unitários do classifier | Task 2 |
| Dark/light mode | Task 7-10 (Tailwind `dark:`) |
| Filtro ruído `04.*` | Task 3 |
| `data_competencia` com fallback `data_vencimento` | Task 3 |
| JOIN caz_clientes para nome no drilldown | Task 5 |
| Meses futuros (is_futuro) destacados | Task 3 + Task 8 + Task 9 |
| Empty/error states | Task 6 + Task 10 |

Todos os requisitos cobertos.

### Placeholder scan

- Todas as steps têm código completo inline.
- Nenhum "TODO", "TBD", "implement later".
- Todos os caminhos de arquivo são absolutos e exatos.
- Commits têm mensagens completas, não placeholders.

### Type consistency

- `TipoReceita`, `Empresa`, `MesReceita`, `CardsReceita`, `DrilldownParcela` definidos em Task 1 e usados consistentemente nas tasks 3–11.
- `classifyParcela` assinatura (Task 2) não é usada no runtime de /resumo (Task 3) — é apenas spec executável. Sem conflito.
- `onCellClick` payload em TabelaReceitaMensal (Task 9) casa com o state setter em ReceitaRecorrente.tsx (Task 11).
- Props de KpiCards, ChartReceitaMensal, DrilldownClientesModal batem com tipos.

### Scope check

Tudo cabe em um único plano. 12 tasks, ~2-4h de trabalho para um dev com contexto do projeto. Backend (Tasks 1–5) antes do frontend (Tasks 6–11) + sanity (Task 12).
