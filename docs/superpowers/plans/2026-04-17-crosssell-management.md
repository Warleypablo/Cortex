# CrossSell Management System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a CrossSell pipeline management tool with card-based UI, comment history, deal-won tracking, and analytics dashboard within the Comercial area.

**Architecture:** 4 new tables in `cortex_core` (oportunidades, comentarios, negocios_ganhos, etapa_log). New backend route file `server/routes/crosssell.ts` with 9 endpoints. Two new frontend pages: pipeline (card grid with filters) and dashboard (KPIs, funnel, rankings). Client data comes via JOINs with `cup_clientes`/`cup_contratos` — no duplication.

**Tech Stack:** React + TypeScript + Tailwind + dark mode, React Query, Recharts, Drizzle ORM, shadcn/ui components (Card, Dialog, Sheet, Select, Badge, Button).

**Spec:** `docs/superpowers/specs/2026-04-17-crosssell-management-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `migrations/2026-04-17-crosssell-tables.sql` | Create 4 tables + indexes |
| `shared/schema.ts` (modify) | Drizzle schemas for 4 tables |
| `server/routes/crosssell.ts` | All 9 API endpoints |
| `client/src/pages/CrossSellPipeline.tsx` | Pipeline page — card grid, filters, modals |
| `client/src/pages/CrossSellDashboard.tsx` | Dashboard page — KPIs, charts, rankings |

### Modified Files
| File | Change |
|------|--------|
| `shared/nav-config.ts` | Add `CROSSSELL` permission key + 2 nav items + route-to-permission mapping |
| `server/routes.ts` | Import and register `crosssellRouter` |
| `client/src/App.tsx` | Add 2 lazy-loaded routes |

---

## Task 1: Database Migration

**Files:**
- Create: `migrations/2026-04-17-crosssell-tables.sql`

- [ ] **Step 1: Write migration SQL**

Create file `migrations/2026-04-17-crosssell-tables.sql`:

```sql
-- CrossSell Management System tables
-- Schema: cortex_core

CREATE TABLE IF NOT EXISTS cortex_core.crosssell_oportunidades (
  id SERIAL PRIMARY KEY,
  cliente_id TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  produto_mapeado TEXT NOT NULL,
  etapa TEXT NOT NULL DEFAULT 'fazer_contato',
  valor_r_negociacao NUMERIC(12,2) DEFAULT 0,
  valor_p_negociacao NUMERIC(12,2) DEFAULT 0,
  cx_responsavel TEXT NOT NULL,
  ultimo_contato DATE,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cortex_core.crosssell_comentarios (
  id SERIAL PRIMARY KEY,
  oportunidade_id INTEGER NOT NULL REFERENCES cortex_core.crosssell_oportunidades(id) ON DELETE CASCADE,
  autor TEXT NOT NULL,
  texto TEXT NOT NULL,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cortex_core.crosssell_negocios_ganhos (
  id SERIAL PRIMARY KEY,
  oportunidade_id INTEGER NOT NULL REFERENCES cortex_core.crosssell_oportunidades(id),
  cliente_nome TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  valor_r NUMERIC(12,2) NOT NULL,
  valor_p NUMERIC(12,2) NOT NULL,
  cx_responsavel TEXT NOT NULL,
  operacao TEXT[] NOT NULL,
  produto TEXT NOT NULL,
  mes_ganho DATE NOT NULL,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cortex_core.crosssell_etapa_log (
  id SERIAL PRIMARY KEY,
  oportunidade_id INTEGER NOT NULL REFERENCES cortex_core.crosssell_oportunidades(id) ON DELETE CASCADE,
  etapa_anterior TEXT NOT NULL,
  etapa_nova TEXT NOT NULL,
  alterado_por TEXT NOT NULL,
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crosssell_oport_etapa ON cortex_core.crosssell_oportunidades(etapa);
CREATE INDEX IF NOT EXISTS idx_crosssell_oport_cx ON cortex_core.crosssell_oportunidades(cx_responsavel);
CREATE INDEX IF NOT EXISTS idx_crosssell_oport_cnpj ON cortex_core.crosssell_oportunidades(cnpj);
CREATE INDEX IF NOT EXISTS idx_crosssell_comentarios_oport ON cortex_core.crosssell_comentarios(oportunidade_id);
CREATE INDEX IF NOT EXISTS idx_crosssell_ganhos_oport ON cortex_core.crosssell_negocios_ganhos(oportunidade_id);
CREATE INDEX IF NOT EXISTS idx_crosssell_etapa_log_oport ON cortex_core.crosssell_etapa_log(oportunidade_id);
CREATE INDEX IF NOT EXISTS idx_crosssell_etapa_log_etapa_nova ON cortex_core.crosssell_etapa_log(etapa_nova);
```

- [ ] **Step 2: Run migration against production database**

```bash
psql -h 34.95.249.110 -U cortex -d dados_turbo -f migrations/2026-04-17-crosssell-tables.sql
```

Expected: `CREATE TABLE` x4 + `CREATE INDEX` x7, no errors.

- [ ] **Step 3: Verify tables exist**

```bash
psql -h 34.95.249.110 -U cortex -d dados_turbo -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'cortex_core' AND table_name LIKE 'crosssell%' ORDER BY table_name;"
```

Expected: 4 rows — `crosssell_comentarios`, `crosssell_etapa_log`, `crosssell_negocios_ganhos`, `crosssell_oportunidades`.

- [ ] **Step 4: Commit**

```bash
git add migrations/2026-04-17-crosssell-tables.sql
git commit -m "feat(crosssell): add migration for 4 crosssell tables

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Drizzle Schema Definitions

**Files:**
- Modify: `shared/schema.ts`

- [ ] **Step 1: Add Drizzle table definitions**

Add at the end of `shared/schema.ts`, before any final exports:

```typescript
// ==================== CROSSSELL ====================

export const crosssellOportunidades = cortexCoreSchema.table("crosssell_oportunidades", {
  id: serial("id").primaryKey(),
  clienteId: text("cliente_id").notNull(),
  cnpj: text("cnpj").notNull(),
  produtoMapeado: text("produto_mapeado").notNull(),
  etapa: text("etapa").notNull().default("fazer_contato"),
  valorRNegociacao: decimal("valor_r_negociacao", { precision: 12, scale: 2 }).default("0"),
  valorPNegociacao: decimal("valor_p_negociacao", { precision: 12, scale: 2 }).default("0"),
  cxResponsavel: text("cx_responsavel").notNull(),
  ultimoContato: date("ultimo_contato"),
  criadoEm: timestamp("criado_em").defaultNow(),
  atualizadoEm: timestamp("atualizado_em").defaultNow(),
});

export type CrosssellOportunidade = typeof crosssellOportunidades.$inferSelect;
export type InsertCrosssellOportunidade = typeof crosssellOportunidades.$inferInsert;

export const crosssellComentarios = cortexCoreSchema.table("crosssell_comentarios", {
  id: serial("id").primaryKey(),
  oportunidadeId: integer("oportunidade_id").notNull(),
  autor: text("autor").notNull(),
  texto: text("texto").notNull(),
  criadoEm: timestamp("criado_em").defaultNow(),
});

export type CrosssellComentario = typeof crosssellComentarios.$inferSelect;

export const crosssellNegociosGanhos = cortexCoreSchema.table("crosssell_negocios_ganhos", {
  id: serial("id").primaryKey(),
  oportunidadeId: integer("oportunidade_id").notNull(),
  clienteNome: text("cliente_nome").notNull(),
  cnpj: text("cnpj").notNull(),
  valorR: decimal("valor_r", { precision: 12, scale: 2 }).notNull(),
  valorP: decimal("valor_p", { precision: 12, scale: 2 }).notNull(),
  cxResponsavel: text("cx_responsavel").notNull(),
  operacao: text("operacao").array().notNull(),
  produto: text("produto").notNull(),
  mesGanho: date("mes_ganho").notNull(),
  criadoEm: timestamp("criado_em").defaultNow(),
});

export type CrosssellNegocioGanho = typeof crosssellNegociosGanhos.$inferSelect;

export const crosssellEtapaLog = cortexCoreSchema.table("crosssell_etapa_log", {
  id: serial("id").primaryKey(),
  oportunidadeId: integer("oportunidade_id").notNull(),
  etapaAnterior: text("etapa_anterior").notNull(),
  etapaNova: text("etapa_nova").notNull(),
  alteradoPor: text("alterado_por").notNull(),
  criadoEm: timestamp("criado_em").defaultNow(),
});

export type CrosssellEtapaLog = typeof crosssellEtapaLog.$inferSelect;
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit shared/schema.ts 2>&1 | head -20
```

Expected: no errors (or only pre-existing warnings unrelated to crosssell).

- [ ] **Step 3: Commit**

```bash
git add shared/schema.ts
git commit -m "feat(crosssell): add Drizzle schemas for 4 crosssell tables

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Navigation and Permissions

**Files:**
- Modify: `shared/nav-config.ts`

- [ ] **Step 1: Add permission key**

In `PERMISSION_KEYS.COM` (around line 60-71), add after `SDR_ASSISTANT`:

```typescript
CROSSSELL: 'com.crosssell',
```

- [ ] **Step 2: Add route-to-permission mappings**

In `ROUTE_TO_PERMISSION` object (around line 240-250), add after the last comercial entry:

```typescript
'/dashboard/comercial/crosssell': PERMISSION_KEYS.COM.CROSSSELL,
'/dashboard/comercial/crosssell-dashboard': PERMISSION_KEYS.COM.CROSSSELL,
```

- [ ] **Step 3: Add nav items to Comercial section**

In the Comercial `items` array (around line 448-462), add before the last item (Contratos Clientes):

```typescript
{ title: 'CrossSell', url: '/dashboard/comercial/crosssell', icon: 'Repeat2', permissionKey: PERMISSION_KEYS.COM.CROSSSELL },
{ title: 'CrossSell Dashboard', url: '/dashboard/comercial/crosssell-dashboard', icon: 'BarChart3', permissionKey: PERMISSION_KEYS.COM.CROSSSELL },
```

- [ ] **Step 4: Commit**

```bash
git add shared/nav-config.ts
git commit -m "feat(crosssell): add navigation items and permission keys

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Backend API — CRUD Endpoints

**Files:**
- Create: `server/routes/crosssell.ts`
- Modify: `server/routes.ts`

- [ ] **Step 1: Create crosssell routes file with list + create + update endpoints**

Create `server/routes/crosssell.ts`:

```typescript
import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

export function registerCrosssellRoutes(app: Express) {

  // ==================== LIST OPORTUNIDADES ====================
  app.get("/api/comercial/crosssell", async (req, res) => {
    try {
      const { cluster, cx, etapa, produto } = req.query;

      const conditions: string[] = [];
      if (cluster) conditions.push(`cli.cluster = '${cluster}'`);
      if (cx) conditions.push(`o.cx_responsavel = '${cx}'`);
      if (etapa) conditions.push(`o.etapa = '${etapa}'`);
      if (produto) conditions.push(`o.produto_mapeado = '${produto}'`);

      const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

      const result = await db.execute(sql.raw(`
        SELECT
          o.*,
          cli.nome AS cliente_nome,
          cli.status AS cliente_status,
          cli.cluster AS cliente_cluster,
          cli.responsavel AS cliente_cx,
          COALESCE(
            (SELECT SUM(c.valorr::numeric) FROM "Clickup".cup_contratos c
             WHERE c.cnpj = o.cnpj AND c.status IN ('ativo', 'Ativo')), 0
          ) AS valor_r_atual,
          COALESCE(
            (SELECT SUM(c.valorp::numeric) FROM "Clickup".cup_contratos c
             WHERE c.cnpj = o.cnpj AND c.status IN ('ativo', 'Ativo')), 0
          ) AS valor_p_atual,
          (SELECT MIN(c.data_inicio) FROM "Clickup".cup_contratos c
           WHERE c.cnpj = o.cnpj AND c.status IN ('ativo', 'Ativo')
          ) AS contrato_inicio,
          COALESCE(
            (SELECT COUNT(*) FROM cortex_core.crosssell_comentarios cm
             WHERE cm.oportunidade_id = o.id), 0
          ) AS total_comentarios
        FROM cortex_core.crosssell_oportunidades o
        LEFT JOIN "Clickup".cup_clientes cli ON cli.cnpj = o.cnpj
        ${whereClause}
        ORDER BY o.atualizado_em DESC
      `));

      const rows = (result.rows as any[]).map(r => ({
        id: r.id,
        clienteId: r.cliente_id,
        cnpj: r.cnpj,
        produtoMapeado: r.produto_mapeado,
        etapa: r.etapa,
        valorRNegociacao: parseFloat(r.valor_r_negociacao) || 0,
        valorPNegociacao: parseFloat(r.valor_p_negociacao) || 0,
        cxResponsavel: r.cx_responsavel,
        ultimoContato: r.ultimo_contato,
        criadoEm: r.criado_em,
        atualizadoEm: r.atualizado_em,
        clienteNome: r.cliente_nome || "Cliente não encontrado",
        clienteStatus: r.cliente_status || "—",
        clienteCluster: r.cliente_cluster || "—",
        clienteCx: r.cliente_cx || "—",
        valorRAtual: parseFloat(r.valor_r_atual) || 0,
        valorPAtual: parseFloat(r.valor_p_atual) || 0,
        lifetimeMeses: r.contrato_inicio
          ? Math.max(1, Math.round((Date.now() - new Date(r.contrato_inicio).getTime()) / (1000 * 60 * 60 * 24 * 30)))
          : 0,
        totalComentarios: parseInt(r.total_comentarios) || 0,
      }));

      res.json(rows);
    } catch (error) {
      console.error("[api] Error fetching crosssell oportunidades:", error);
      res.status(500).json({ error: "Failed to fetch crosssell oportunidades" });
    }
  });

  // ==================== CREATE OPORTUNIDADE ====================
  app.post("/api/comercial/crosssell", async (req, res) => {
    try {
      const { clienteId, cnpj, produtoMapeado, valorRNegociacao, valorPNegociacao, cxResponsavel } = req.body;

      if (!clienteId || !cnpj || !produtoMapeado || !cxResponsavel) {
        return res.status(400).json({ error: "Campos obrigatórios: clienteId, cnpj, produtoMapeado, cxResponsavel" });
      }

      const result = await db.execute(sql`
        INSERT INTO cortex_core.crosssell_oportunidades
          (cliente_id, cnpj, produto_mapeado, etapa, valor_r_negociacao, valor_p_negociacao, cx_responsavel)
        VALUES
          (${clienteId}, ${cnpj}, ${produtoMapeado}, 'fazer_contato', ${valorRNegociacao || 0}, ${valorPNegociacao || 0}, ${cxResponsavel})
        RETURNING *
      `);

      res.json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error creating crosssell oportunidade:", error);
      res.status(500).json({ error: "Failed to create oportunidade" });
    }
  });

  // ==================== UPDATE OPORTUNIDADE ====================
  app.patch("/api/comercial/crosssell/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { etapa, valorRNegociacao, valorPNegociacao, ultimoContato, alteradoPor } = req.body;

      // Get current state for etapa log
      const current = await db.execute(sql`
        SELECT etapa FROM cortex_core.crosssell_oportunidades WHERE id = ${parseInt(id)}
      `);

      if (current.rows.length === 0) {
        return res.status(404).json({ error: "Oportunidade não encontrada" });
      }

      const etapaAnterior = (current.rows[0] as any).etapa;

      // Build SET clause dynamically
      const sets: string[] = ["atualizado_em = NOW()"];
      if (etapa !== undefined) sets.push(`etapa = '${etapa}'`);
      if (valorRNegociacao !== undefined) sets.push(`valor_r_negociacao = ${valorRNegociacao}`);
      if (valorPNegociacao !== undefined) sets.push(`valor_p_negociacao = ${valorPNegociacao}`);
      if (ultimoContato !== undefined) sets.push(`ultimo_contato = '${ultimoContato}'`);

      await db.execute(sql.raw(`
        UPDATE cortex_core.crosssell_oportunidades
        SET ${sets.join(", ")}
        WHERE id = ${parseInt(id)}
      `));

      // Log etapa change if etapa changed
      if (etapa && etapa !== etapaAnterior) {
        await db.execute(sql`
          INSERT INTO cortex_core.crosssell_etapa_log
            (oportunidade_id, etapa_anterior, etapa_nova, alterado_por)
          VALUES
            (${parseInt(id)}, ${etapaAnterior}, ${etapa}, ${alteradoPor || 'sistema'})
        `);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error updating crosssell oportunidade:", error);
      res.status(500).json({ error: "Failed to update oportunidade" });
    }
  });

  // ==================== COMENTARIOS ====================
  app.get("/api/comercial/crosssell/:id/comentarios", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await db.execute(sql`
        SELECT * FROM cortex_core.crosssell_comentarios
        WHERE oportunidade_id = ${parseInt(id)}
        ORDER BY criado_em DESC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching comentarios:", error);
      res.status(500).json({ error: "Failed to fetch comentarios" });
    }
  });

  app.post("/api/comercial/crosssell/:id/comentarios", async (req, res) => {
    try {
      const { id } = req.params;
      const { autor, texto } = req.body;

      if (!autor || !texto) {
        return res.status(400).json({ error: "Campos obrigatórios: autor, texto" });
      }

      const result = await db.execute(sql`
        INSERT INTO cortex_core.crosssell_comentarios (oportunidade_id, autor, texto)
        VALUES (${parseInt(id)}, ${autor}, ${texto})
        RETURNING *
      `);

      res.json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error creating comentario:", error);
      res.status(500).json({ error: "Failed to create comentario" });
    }
  });

  // ==================== NEGOCIO GANHO ====================
  app.post("/api/comercial/crosssell/:id/ganho", async (req, res) => {
    try {
      const { id } = req.params;
      const { operacao, produto, mesGanho, valorR, valorP } = req.body;

      if (!operacao || !produto || !mesGanho) {
        return res.status(400).json({ error: "Campos obrigatórios: operacao, produto, mesGanho" });
      }

      // Get oportunidade data
      const oport = await db.execute(sql`
        SELECT o.*, cli.nome AS cliente_nome
        FROM cortex_core.crosssell_oportunidades o
        LEFT JOIN "Clickup".cup_clientes cli ON cli.cnpj = o.cnpj
        WHERE o.id = ${parseInt(id)}
      `);

      if (oport.rows.length === 0) {
        return res.status(404).json({ error: "Oportunidade não encontrada" });
      }

      const op = oport.rows[0] as any;

      // Create negocio ganho
      await db.execute(sql`
        INSERT INTO cortex_core.crosssell_negocios_ganhos
          (oportunidade_id, cliente_nome, cnpj, valor_r, valor_p, cx_responsavel, operacao, produto, mes_ganho)
        VALUES
          (${parseInt(id)}, ${op.cliente_nome || 'N/A'}, ${op.cnpj},
           ${valorR ?? parseFloat(op.valor_r_negociacao) || 0},
           ${valorP ?? parseFloat(op.valor_p_negociacao) || 0},
           ${op.cx_responsavel}, ${operacao}, ${produto}, ${mesGanho})
      `);

      // Update oportunidade etapa to 'ganho'
      const etapaAnterior = op.etapa;
      await db.execute(sql`
        UPDATE cortex_core.crosssell_oportunidades
        SET etapa = 'ganho', atualizado_em = NOW()
        WHERE id = ${parseInt(id)}
      `);

      // Log etapa change
      await db.execute(sql`
        INSERT INTO cortex_core.crosssell_etapa_log
          (oportunidade_id, etapa_anterior, etapa_nova, alterado_por)
        VALUES
          (${parseInt(id)}, ${etapaAnterior}, 'ganho', ${op.cx_responsavel})
      `);

      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error converting to negocio ganho:", error);
      res.status(500).json({ error: "Failed to convert to negocio ganho" });
    }
  });

  app.get("/api/comercial/crosssell/ganhos", async (req, res) => {
    try {
      const { mes, ano } = req.query;
      let whereClause = "";
      if (mes && ano) {
        whereClause = `WHERE EXTRACT(MONTH FROM mes_ganho) = ${mes} AND EXTRACT(YEAR FROM mes_ganho) = ${ano}`;
      } else if (ano) {
        whereClause = `WHERE EXTRACT(YEAR FROM mes_ganho) = ${ano}`;
      }

      const result = await db.execute(sql.raw(`
        SELECT * FROM cortex_core.crosssell_negocios_ganhos
        ${whereClause}
        ORDER BY criado_em DESC
      `));

      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching negocios ganhos:", error);
      res.status(500).json({ error: "Failed to fetch negocios ganhos" });
    }
  });

  // ==================== DASHBOARD ====================
  app.get("/api/comercial/crosssell/dashboard", async (req, res) => {
    try {
      const { mes, ano } = req.query;
      const currentYear = ano || new Date().getFullYear();
      const currentMonth = mes || (new Date().getMonth() + 1);

      const dateFilter = `AND EXTRACT(MONTH FROM el.criado_em) = ${currentMonth} AND EXTRACT(YEAR FROM el.criado_em) = ${currentYear}`;

      // KPIs
      const [reunioesAgendadas, reunioesRealizadas, totaisNegociacao, totalOportunidades, totalGanhos, funilEtapas, reunioesPorCx, rankingValor, rankingReunioes] = await Promise.all([
        // Reuniões agendadas
        db.execute(sql.raw(`
          SELECT COUNT(*) as total FROM cortex_core.crosssell_etapa_log el
          WHERE el.etapa_nova = 'reuniao_agendada' ${dateFilter}
        `)),
        // Reuniões realizadas
        db.execute(sql.raw(`
          SELECT COUNT(*) as total FROM cortex_core.crosssell_etapa_log el
          WHERE el.etapa_anterior = 'reuniao_agendada'
          AND el.etapa_nova NOT IN ('fazer_contato', 'tentativa_contato', 'reuniao_agendada')
          ${dateFilter}
        `)),
        // Totais em negociação
        db.execute(sql.raw(`
          SELECT
            COALESCE(SUM(valor_r_negociacao::numeric), 0) as total_r,
            COALESCE(SUM(valor_p_negociacao::numeric), 0) as total_p
          FROM cortex_core.crosssell_oportunidades
          WHERE etapa NOT IN ('ganho', 'descartado')
        `)),
        // Total oportunidades criadas no período
        db.execute(sql.raw(`
          SELECT COUNT(*) as total FROM cortex_core.crosssell_oportunidades
          WHERE EXTRACT(MONTH FROM criado_em) = ${currentMonth}
          AND EXTRACT(YEAR FROM criado_em) = ${currentYear}
        `)),
        // Total ganhos no período
        db.execute(sql.raw(`
          SELECT COUNT(*) as total FROM cortex_core.crosssell_negocios_ganhos
          WHERE EXTRACT(MONTH FROM mes_ganho) = ${currentMonth}
          AND EXTRACT(YEAR FROM mes_ganho) = ${currentYear}
        `)),
        // Funil por etapa
        db.execute(sql.raw(`
          SELECT etapa, COUNT(*) as total
          FROM cortex_core.crosssell_oportunidades
          WHERE etapa NOT IN ('ganho')
          GROUP BY etapa
          ORDER BY CASE etapa
            WHEN 'fazer_contato' THEN 1
            WHEN 'tentativa_contato' THEN 2
            WHEN 'reuniao_agendada' THEN 3
            WHEN 'em_contato' THEN 4
            WHEN 'proposta_enviada' THEN 5
            WHEN 'forte_interesse' THEN 6
            WHEN 'descartado' THEN 7
          END
        `)),
        // Reuniões por CX
        db.execute(sql.raw(`
          SELECT el.alterado_por as cx, COUNT(*) as total
          FROM cortex_core.crosssell_etapa_log el
          WHERE el.etapa_nova = 'reuniao_agendada' ${dateFilter}
          GROUP BY el.alterado_por
          ORDER BY total DESC
        `)),
        // Ranking valor gerado
        db.execute(sql.raw(`
          SELECT cx_responsavel as cx,
            SUM(valor_r::numeric) as total_r,
            SUM(valor_p::numeric) as total_p,
            SUM(valor_r::numeric + valor_p::numeric) as total
          FROM cortex_core.crosssell_negocios_ganhos
          WHERE EXTRACT(MONTH FROM mes_ganho) = ${currentMonth}
          AND EXTRACT(YEAR FROM mes_ganho) = ${currentYear}
          GROUP BY cx_responsavel
          ORDER BY total DESC
        `)),
        // Ranking reuniões
        db.execute(sql.raw(`
          SELECT el.alterado_por as cx, COUNT(*) as total
          FROM cortex_core.crosssell_etapa_log el
          WHERE el.etapa_nova = 'reuniao_agendada' ${dateFilter}
          GROUP BY el.alterado_por
          ORDER BY total DESC
        `)),
      ]);

      const totalOport = parseInt((totalOportunidades.rows[0] as any).total) || 0;
      const totalGan = parseInt((totalGanhos.rows[0] as any).total) || 0;
      const taxaConversao = totalOport > 0 ? ((totalGan / totalOport) * 100) : 0;

      res.json({
        kpis: {
          reunioesAgendadas: parseInt((reunioesAgendadas.rows[0] as any).total) || 0,
          reunioesRealizadas: parseInt((reunioesRealizadas.rows[0] as any).total) || 0,
          totalRNegociacao: parseFloat((totaisNegociacao.rows[0] as any).total_r) || 0,
          totalPNegociacao: parseFloat((totaisNegociacao.rows[0] as any).total_p) || 0,
          taxaConversao: Math.round(taxaConversao * 10) / 10,
        },
        funilEtapas: funilEtapas.rows,
        reunioesPorCx: reunioesPorCx.rows,
        rankingValor: (rankingValor.rows as any[]).map(r => ({
          cx: r.cx,
          totalR: parseFloat(r.total_r) || 0,
          totalP: parseFloat(r.total_p) || 0,
          total: parseFloat(r.total) || 0,
        })),
        rankingReunioes: rankingReunioes.rows,
      });
    } catch (error) {
      console.error("[api] Error fetching crosssell dashboard:", error);
      res.status(500).json({ error: "Failed to fetch crosssell dashboard" });
    }
  });

  // ==================== BUSCAR CLIENTES (autocomplete) ====================
  app.get("/api/comercial/crosssell/clientes", async (req, res) => {
    try {
      const { q } = req.query;
      const searchFilter = q ? `WHERE LOWER(nome) LIKE LOWER('%${q}%') OR cnpj LIKE '%${q}%'` : "";

      const result = await db.execute(sql.raw(`
        SELECT task_id, cnpj, nome, status, cluster, responsavel
        FROM "Clickup".cup_clientes
        ${searchFilter}
        ORDER BY nome
        LIMIT 50
      `));

      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching clientes:", error);
      res.status(500).json({ error: "Failed to fetch clientes" });
    }
  });

} // end registerCrosssellRoutes
```

- [ ] **Step 2: Register routes in routes.ts**

In `server/routes.ts`, add import near the other route imports (around line 40):

```typescript
import { registerCrosssellRoutes } from "./routes/crosssell";
```

Then add the registration call near where `registerComercialRoutes(app)` is called:

```typescript
registerCrosssellRoutes(app);
```

- [ ] **Step 3: Restart dev server and test endpoints**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; cd /Users/mac0267/Cortex && npm run dev &
sleep 3
# Test list (should return empty array)
curl -s http://localhost:3000/api/comercial/crosssell | head -20
# Test clientes autocomplete
curl -s "http://localhost:3000/api/comercial/crosssell/clientes?q=turbo" | head -20
```

Expected: `[]` for list, array of clients for autocomplete.

Note: if auth blocks the request, test via browser while logged in.

- [ ] **Step 4: Commit**

```bash
git add server/routes/crosssell.ts server/routes.ts
git commit -m "feat(crosssell): add all backend API endpoints (9 routes)

Includes: list, create, update oportunidades; comentarios CRUD;
negocio ganho conversion; dashboard analytics; cliente autocomplete.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Frontend — CrossSell Pipeline Page

**Files:**
- Create: `client/src/pages/CrossSellPipeline.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Create CrossSellPipeline.tsx**

Create `client/src/pages/CrossSellPipeline.tsx`:

```tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MessageSquare, Trophy, Search } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

// ==================== TYPES ====================

interface Oportunidade {
  id: number;
  clienteId: string;
  cnpj: string;
  produtoMapeado: string;
  etapa: string;
  valorRNegociacao: number;
  valorPNegociacao: number;
  cxResponsavel: string;
  ultimoContato: string | null;
  criadoEm: string;
  atualizadoEm: string;
  clienteNome: string;
  clienteStatus: string;
  clienteCluster: string;
  clienteCx: string;
  valorRAtual: number;
  valorPAtual: number;
  lifetimeMeses: number;
  totalComentarios: number;
}

interface Cliente {
  task_id: string;
  cnpj: string;
  nome: string;
  status: string;
  cluster: string;
  responsavel: string;
}

interface Comentario {
  id: number;
  oportunidade_id: number;
  autor: string;
  texto: string;
  criado_em: string;
}

// ==================== CONSTANTS ====================

const ETAPAS = [
  { value: "fazer_contato", label: "Fazer contato", color: "bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300" },
  { value: "tentativa_contato", label: "Tentativa de contato", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  { value: "reuniao_agendada", label: "Reunião agendada", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  { value: "em_contato", label: "Em contato", color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" },
  { value: "proposta_enviada", label: "Proposta enviada", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "forte_interesse", label: "Fortemente interessado", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  { value: "descartado", label: "Descartado", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
];

const OPERACOES = ["Upsell", "CrossSell", "Renovação", "Upgrade"];

const PRODUTOS = [
  "Performance", "Creators", "Social Media", "Inbound", "Outbound",
  "CRM", "BI", "Automação", "Consultoria", "Treinamento",
  "Design", "Vídeo", "SEO", "Mídia Paga", "E-mail Marketing",
  "Eventos", "PR", "Branding", "Web", "App", "Marketplace", "Outros",
];

function getEtapa(value: string) {
  return ETAPAS.find(e => e.value === value) || ETAPAS[0];
}

// ==================== COMPONENT ====================

export default function CrossSellPipeline() {
  useSetPageInfo({ title: "CrossSell Pipeline", breadcrumbs: [{ label: "Comercial" }, { label: "CrossSell" }] });
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Filters
  const [filterCluster, setFilterCluster] = useState<string>("");
  const [filterCx, setFilterCx] = useState<string>("");
  const [filterEtapa, setFilterEtapa] = useState<string>("");
  const [filterProduto, setFilterProduto] = useState<string>("");

  // Modals
  const [showNewModal, setShowNewModal] = useState(false);
  const [showGanhoModal, setShowGanhoModal] = useState<Oportunidade | null>(null);
  const [showComments, setShowComments] = useState<Oportunidade | null>(null);

  // New oportunidade form
  const [clienteSearch, setClienteSearch] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [newProduto, setNewProduto] = useState("");
  const [newValorR, setNewValorR] = useState("");
  const [newValorP, setNewValorP] = useState("");

  // Ganho form
  const [ganhoOperacao, setGanhoOperacao] = useState<string[]>([]);
  const [ganhoProduto, setGanhoProduto] = useState("");
  const [ganhoMes, setGanhoMes] = useState("");
  const [ganhoValorR, setGanhoValorR] = useState("");
  const [ganhoValorP, setGanhoValorP] = useState("");

  // Comment form
  const [newComment, setNewComment] = useState("");

  // Build query params
  const queryParams = new URLSearchParams();
  if (filterCluster) queryParams.set("cluster", filterCluster);
  if (filterCx) queryParams.set("cx", filterCx);
  if (filterEtapa) queryParams.set("etapa", filterEtapa);
  if (filterProduto) queryParams.set("produto", filterProduto);

  // ==================== QUERIES ====================

  const { data: oportunidades, isLoading } = useQuery<Oportunidade[]>({
    queryKey: ["/api/comercial/crosssell", queryParams.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/comercial/crosssell?${queryParams}`);
      return res.json();
    },
  });

  const { data: clientes } = useQuery<Cliente[]>({
    queryKey: ["/api/comercial/crosssell/clientes", clienteSearch],
    queryFn: async () => {
      const res = await fetch(`/api/comercial/crosssell/clientes?q=${encodeURIComponent(clienteSearch)}`);
      return res.json();
    },
    enabled: clienteSearch.length >= 2,
  });

  const { data: comentarios } = useQuery<Comentario[]>({
    queryKey: ["/api/comercial/crosssell/comentarios", showComments?.id],
    queryFn: async () => {
      const res = await fetch(`/api/comercial/crosssell/${showComments!.id}/comentarios`);
      return res.json();
    },
    enabled: !!showComments,
  });

  // ==================== MUTATIONS ====================

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/comercial/crosssell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comercial/crosssell"] });
      setShowNewModal(false);
      setSelectedCliente(null);
      setClienteSearch("");
      setNewProduto("");
      setNewValorR("");
      setNewValorP("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await fetch(`/api/comercial/crosssell/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comercial/crosssell"] });
    },
  });

  const ganhoMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await fetch(`/api/comercial/crosssell/${id}/ganho`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comercial/crosssell"] });
      setShowGanhoModal(null);
      setGanhoOperacao([]);
      setGanhoProduto("");
      setGanhoMes("");
      setGanhoValorR("");
      setGanhoValorP("");
    },
  });

  const commentMutation = useMutation({
    mutationFn: async ({ id, autor, texto }: { id: number; autor: string; texto: string }) => {
      const res = await fetch(`/api/comercial/crosssell/${id}/comentarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autor, texto }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comercial/crosssell/comentarios"] });
      setNewComment("");
    },
  });

  // ==================== HANDLERS ====================

  const handleCreate = () => {
    if (!selectedCliente || !newProduto) return;
    createMutation.mutate({
      clienteId: selectedCliente.task_id,
      cnpj: selectedCliente.cnpj,
      produtoMapeado: newProduto,
      valorRNegociacao: parseFloat(newValorR) || 0,
      valorPNegociacao: parseFloat(newValorP) || 0,
      cxResponsavel: user?.name || "CX",
    });
  };

  const handleEtapaChange = (oport: Oportunidade, novaEtapa: string) => {
    updateMutation.mutate({
      id: oport.id,
      etapa: novaEtapa,
      alteradoPor: user?.name || "CX",
    });
  };

  const handleGanho = () => {
    if (!showGanhoModal || ganhoOperacao.length === 0 || !ganhoProduto || !ganhoMes) return;
    ganhoMutation.mutate({
      id: showGanhoModal.id,
      operacao: ganhoOperacao,
      produto: ganhoProduto,
      mesGanho: ganhoMes,
      valorR: parseFloat(ganhoValorR) || showGanhoModal.valorRNegociacao,
      valorP: parseFloat(ganhoValorP) || showGanhoModal.valorPNegociacao,
    });
  };

  const handleComment = () => {
    if (!showComments || !newComment.trim()) return;
    commentMutation.mutate({
      id: showComments.id,
      autor: user?.name || "CX",
      texto: newComment.trim(),
    });
  };

  const openGanhoModal = (oport: Oportunidade) => {
    setShowGanhoModal(oport);
    setGanhoProduto(oport.produtoMapeado);
    setGanhoValorR(oport.valorRNegociacao.toString());
    setGanhoValorP(oport.valorPNegociacao.toString());
    setGanhoMes(new Date().toISOString().slice(0, 10));
  };

  // Get unique CXs for filter
  const cxList = [...new Set((oportunidades || []).map(o => o.cxResponsavel))].sort();

  // ==================== RENDER ====================

  return (
    <div className="space-y-6 p-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
        <Select value={filterCluster} onValueChange={v => setFilterCluster(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[160px] bg-white dark:bg-zinc-800">
            <SelectValue placeholder="Cluster" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos clusters</SelectItem>
            <SelectItem value="Regulares">Regulares</SelectItem>
            <SelectItem value="Imperdiveis">Imperdíveis</SelectItem>
            <SelectItem value="Chaves">Chaves</SelectItem>
            <SelectItem value="NFNC">NFNC</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterCx} onValueChange={v => setFilterCx(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[160px] bg-white dark:bg-zinc-800">
            <SelectValue placeholder="CX" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos CX</SelectItem>
            {cxList.map(cx => (
              <SelectItem key={cx} value={cx}>{cx}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterEtapa} onValueChange={v => setFilterEtapa(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[180px] bg-white dark:bg-zinc-800">
            <SelectValue placeholder="Etapa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas etapas</SelectItem>
            {ETAPAS.map(e => (
              <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterProduto} onValueChange={v => setFilterProduto(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[160px] bg-white dark:bg-zinc-800">
            <SelectValue placeholder="Produto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos produtos</SelectItem>
            {PRODUTOS.map(p => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={() => setShowNewModal(true)} className="ml-auto">
          <Plus className="mr-2 h-4 w-4" /> Nova Oportunidade
        </Button>
      </div>

      {/* Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(oportunidades || [])
            .filter(o => o.etapa !== "ganho")
            .map(oport => {
              const etapa = getEtapa(oport.etapa);
              const isDescartado = oport.etapa === "descartado";
              return (
                <Card
                  key={oport.id}
                  className={`border border-gray-200 dark:border-zinc-700 ${isDescartado ? "opacity-60" : ""}`}
                >
                  <CardContent className="p-4">
                    {/* Header */}
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">{oport.clienteNome}</h3>
                        <p className="text-xs text-gray-500 dark:text-zinc-400">CX: {oport.cxResponsavel}</p>
                      </div>
                      <Select
                        value={oport.etapa}
                        onValueChange={(v) => handleEtapaChange(oport, v)}
                      >
                        <SelectTrigger className={`h-7 w-auto border-0 px-2 text-xs font-semibold ${etapa.color}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ETAPAS.map(e => (
                            <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Data Grid */}
                    <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-400 dark:text-zinc-500">Produto Mapeado</span>
                        <p className="font-semibold text-gray-900 dark:text-white">{oport.produtoMapeado}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 dark:text-zinc-500">Status Conta</span>
                        <p className="font-semibold text-gray-900 dark:text-white">{oport.clienteStatus}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 dark:text-zinc-500">Valor R atual</span>
                        <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(oport.valorRAtual)}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 dark:text-zinc-500">Valor P atual</span>
                        <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(oport.valorPAtual)}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 dark:text-zinc-500">Valor R negociação</span>
                        <p className="font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(oport.valorRNegociacao)}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 dark:text-zinc-500">Valor P negociação</span>
                        <p className="font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(oport.valorPNegociacao)}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 dark:text-zinc-500">Lifetime</span>
                        <p className="font-semibold text-gray-900 dark:text-white">{oport.lifetimeMeses} meses</p>
                      </div>
                      <div>
                        <span className="text-gray-400 dark:text-zinc-500">Último contato</span>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {oport.ultimoContato ? new Date(oport.ultimoContato).toLocaleDateString("pt-BR") : "—"}
                        </p>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex gap-2 border-t border-gray-100 pt-3 dark:border-zinc-700">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => setShowComments(oport)}
                      >
                        <MessageSquare className="mr-1 h-3 w-3" />
                        {oport.totalComentarios} comentários
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-600 text-xs text-white hover:bg-green-700"
                        onClick={() => openGanhoModal(oport)}
                      >
                        <Trophy className="mr-1 h-3 w-3" /> Ganho
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && (oportunidades || []).filter(o => o.etapa !== "ganho").length === 0 && (
        <div className="py-16 text-center text-gray-500 dark:text-zinc-400">
          Nenhuma oportunidade encontrada. Crie uma nova oportunidade para começar.
        </div>
      )}

      {/* ==================== NEW OPORTUNIDADE MODAL ==================== */}
      <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Oportunidade de CrossSell</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Cliente search */}
            <div>
              <Label>Cliente</Label>
              {selectedCliente ? (
                <div className="mt-1 flex items-center justify-between rounded-md border border-gray-200 p-2 dark:border-zinc-700">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedCliente.nome}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400">{selectedCliente.cnpj}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedCliente(null); setClienteSearch(""); }}>
                    Trocar
                  </Button>
                </div>
              ) : (
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por nome ou CNPJ..."
                    value={clienteSearch}
                    onChange={e => setClienteSearch(e.target.value)}
                    className="pl-9"
                  />
                  {clientes && clientes.length > 0 && (
                    <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                      {clientes.map(cli => (
                        <button
                          key={cli.task_id}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-zinc-700"
                          onClick={() => { setSelectedCliente(cli); setClienteSearch(""); }}
                        >
                          <p className="font-medium text-gray-900 dark:text-white">{cli.nome}</p>
                          <p className="text-xs text-gray-500 dark:text-zinc-400">{cli.cnpj} — {cli.cluster}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Produto */}
            <div>
              <Label>Produto Mapeado</Label>
              <Select value={newProduto} onValueChange={setNewProduto}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecionar produto" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUTOS.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Valores */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor R em negociação</Label>
                <Input type="number" value={newValorR} onChange={e => setNewValorR(e.target.value)} placeholder="0.00" className="mt-1" />
              </div>
              <div>
                <Label>Valor P em negociação</Label>
                <Input type="number" value={newValorP} onChange={e => setNewValorP(e.target.value)} placeholder="0.00" className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewModal(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!selectedCliente || !newProduto || createMutation.isPending}>
              {createMutation.isPending ? "Criando..." : "Criar Oportunidade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== GANHO MODAL ==================== */}
      <Dialog open={!!showGanhoModal} onOpenChange={() => setShowGanhoModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Converter em Negócio Ganho</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Operação (selecione uma ou mais)</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {OPERACOES.map(op => (
                  <Badge
                    key={op}
                    variant={ganhoOperacao.includes(op) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      setGanhoOperacao(prev =>
                        prev.includes(op) ? prev.filter(x => x !== op) : [...prev, op]
                      );
                    }}
                  >
                    {op}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label>Produto</Label>
              <Select value={ganhoProduto} onValueChange={setGanhoProduto}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRODUTOS.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mês Ganho</Label>
              <Input type="date" value={ganhoMes} onChange={e => setGanhoMes(e.target.value)} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor R</Label>
                <Input type="number" value={ganhoValorR} onChange={e => setGanhoValorR(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Valor P</Label>
                <Input type="number" value={ganhoValorP} onChange={e => setGanhoValorP(e.target.value)} className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGanhoModal(null)}>Cancelar</Button>
            <Button
              className="bg-green-600 text-white hover:bg-green-700"
              onClick={handleGanho}
              disabled={ganhoOperacao.length === 0 || !ganhoProduto || !ganhoMes || ganhoMutation.isPending}
            >
              {ganhoMutation.isPending ? "Convertendo..." : "Confirmar Ganho"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== COMMENTS SHEET ==================== */}
      <Sheet open={!!showComments} onOpenChange={() => setShowComments(null)}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle>Comentários — {showComments?.clienteNome}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex h-[calc(100vh-140px)] flex-col">
            {/* Input */}
            <div className="mb-4 flex gap-2">
              <Textarea
                placeholder="Adicionar comentário..."
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                className="min-h-[60px] flex-1"
              />
              <Button
                onClick={handleComment}
                disabled={!newComment.trim() || commentMutation.isPending}
                className="self-end"
              >
                Enviar
              </Button>
            </div>
            {/* Timeline */}
            <div className="flex-1 space-y-3 overflow-auto">
              {(comentarios || []).map(c => (
                <div key={c.id} className="rounded-lg border border-gray-200 p-3 dark:border-zinc-700">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{c.autor}</span>
                    <span className="text-xs text-gray-500 dark:text-zinc-400">
                      {new Date(c.criado_em).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-zinc-300">{c.texto}</p>
                </div>
              ))}
              {comentarios?.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">
                  Nenhum comentário ainda.
                </p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
```

- [ ] **Step 2: Add lazy import and route in App.tsx**

In `client/src/App.tsx`, add lazy import near other Comercial imports (around line 53-80):

```typescript
const CrossSellPipeline = lazyWithRetry(() => import("@/pages/CrossSellPipeline"));
const CrossSellDashboard = lazyWithRetry(() => import("@/pages/CrossSellDashboard"));
```

Add routes in the Comercial section (around line 342-354):

```tsx
<Route path="/dashboard/comercial/crosssell">{() => <ProtectedRoute path="/dashboard/comercial/crosssell" component={CrossSellPipeline} />}</Route>
<Route path="/dashboard/comercial/crosssell-dashboard">{() => <ProtectedRoute path="/dashboard/comercial/crosssell-dashboard" component={CrossSellDashboard} />}</Route>
```

- [ ] **Step 3: Restart dev server and test pipeline page**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; cd /Users/mac0267/Cortex && npm run dev &
```

Open `http://localhost:3000/dashboard/comercial/crosssell` in browser. Verify:
- Page loads without errors
- Filter bar renders with 4 dropdowns + button
- Empty state message shows
- "+ Nova Oportunidade" opens modal
- Client search autocomplete works
- Dark mode styling correct

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/CrossSellPipeline.tsx client/src/App.tsx
git commit -m "feat(crosssell): add pipeline page with card grid, filters, modals

Includes: filter bar (cluster, CX, etapa, produto), card grid with
client data via JOINs, new oportunidade modal with client search,
ganho conversion modal, comments drawer with timeline.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Frontend — CrossSell Dashboard Page

**Files:**
- Create: `client/src/pages/CrossSellDashboard.tsx`

- [ ] **Step 1: Create CrossSellDashboard.tsx**

Create `client/src/pages/CrossSellDashboard.tsx`:

```tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Phone, DollarSign, TrendingUp, BarChart3 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

// ==================== TYPES ====================

interface DashboardData {
  kpis: {
    reunioesAgendadas: number;
    reunioesRealizadas: number;
    totalRNegociacao: number;
    totalPNegociacao: number;
    taxaConversao: number;
  };
  funilEtapas: Array<{ etapa: string; total: string }>;
  reunioesPorCx: Array<{ cx: string; total: string }>;
  rankingValor: Array<{ cx: string; totalR: number; totalP: number; total: number }>;
  rankingReunioes: Array<{ cx: string; total: string }>;
}

// ==================== CONSTANTS ====================

const ETAPA_LABELS: Record<string, string> = {
  fazer_contato: "Fazer contato",
  tentativa_contato: "Tentativa de contato",
  reuniao_agendada: "Reunião agendada",
  em_contato: "Em contato",
  proposta_enviada: "Proposta enviada",
  forte_interesse: "Forte interesse",
  descartado: "Descartado",
};

const ETAPA_COLORS: Record<string, string> = {
  fazer_contato: "#94a3b8",
  tentativa_contato: "#fb923c",
  reuniao_agendada: "#facc15",
  em_contato: "#38bdf8",
  proposta_enviada: "#3b82f6",
  forte_interesse: "#a855f7",
  descartado: "#ef4444",
};

const MESES = [
  { value: "1", label: "Janeiro" }, { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" }, { value: "4", label: "Abril" },
  { value: "5", label: "Maio" }, { value: "6", label: "Junho" },
  { value: "7", label: "Julho" }, { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" }, { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" }, { value: "12", label: "Dezembro" },
];

const MEDAL = ["🥇", "🥈", "🥉"];

// ==================== COMPONENT ====================

export default function CrossSellDashboard() {
  useSetPageInfo({ title: "CrossSell Dashboard", breadcrumbs: [{ label: "Comercial" }, { label: "CrossSell Dashboard" }] });

  const now = new Date();
  const [mes, setMes] = useState(String(now.getMonth() + 1));
  const [ano, setAno] = useState(String(now.getFullYear()));

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/comercial/crosssell/dashboard", mes, ano],
    queryFn: async () => {
      const res = await fetch(`/api/comercial/crosssell/dashboard?mes=${mes}&ano=${ano}`);
      return res.json();
    },
  });

  const kpis = data?.kpis;

  const funilData = (data?.funilEtapas || []).map(f => ({
    etapa: ETAPA_LABELS[f.etapa] || f.etapa,
    total: parseInt(f.total),
    fill: ETAPA_COLORS[f.etapa] || "#94a3b8",
  }));

  const reunioesCxData = (data?.reunioesPorCx || []).map(r => ({
    cx: r.cx,
    total: parseInt(r.total),
  }));

  // ==================== RENDER ====================

  return (
    <div className="space-y-6 p-6">
      {/* Period Filter */}
      <div className="flex items-center gap-3">
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-[140px] bg-white dark:bg-zinc-800">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MESES.map(m => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ano} onValueChange={setAno}>
          <SelectTrigger className="w-[100px] bg-white dark:bg-zinc-800">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026].map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="p-4 text-center">
              <Calendar className="mx-auto mb-2 h-5 w-5 text-gray-400" />
              <p className="text-xs uppercase text-gray-500 dark:text-zinc-400">Reuniões Agendadas</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{kpis?.reunioesAgendadas ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Phone className="mx-auto mb-2 h-5 w-5 text-gray-400" />
              <p className="text-xs uppercase text-gray-500 dark:text-zinc-400">Reuniões Realizadas</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{kpis?.reunioesRealizadas ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <DollarSign className="mx-auto mb-2 h-5 w-5 text-blue-500" />
              <p className="text-xs uppercase text-gray-500 dark:text-zinc-400">Negociação (R)</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(kpis?.totalRNegociacao ?? 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <DollarSign className="mx-auto mb-2 h-5 w-5 text-purple-500" />
              <p className="text-xs uppercase text-gray-500 dark:text-zinc-400">Negociação (P)</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatCurrency(kpis?.totalPNegociacao ?? 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="mx-auto mb-2 h-5 w-5 text-green-500" />
              <p className="text-xs uppercase text-gray-500 dark:text-zinc-400">Taxa de Conversão</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{kpis?.taxaConversao ?? 0}%</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" /> Funil por Etapa
            </CardTitle>
          </CardHeader>
          <CardContent>
            {funilData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={funilData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="etapa" width={140} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {funilData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-center text-sm text-gray-500 dark:text-zinc-400">Sem dados no período</p>
            )}
          </CardContent>
        </Card>

        {/* Reuniões por CX */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" /> Reuniões Agendadas por CX
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reunioesCxData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={reunioesCxData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="cx" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-center text-sm text-gray-500 dark:text-zinc-400">Sem dados no período</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rankings Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Ranking Valor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ranking — Valor Gerado</CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.rankingValor || []).length > 0 ? (
              <div className="space-y-2">
                {(data?.rankingValor || []).map((r, i) => (
                  <div key={r.cx} className="flex items-center justify-between rounded-lg border border-gray-100 p-3 dark:border-zinc-700">
                    <span className="text-sm text-gray-900 dark:text-white">
                      {MEDAL[i] || `${i + 1}.`} {r.cx}
                    </span>
                    <span className="font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(r.total)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">Sem dados no período</p>
            )}
          </CardContent>
        </Card>

        {/* Ranking Reuniões */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ranking — Reuniões Agendadas</CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.rankingReunioes || []).length > 0 ? (
              <div className="space-y-2">
                {(data?.rankingReunioes || []).map((r, i) => (
                  <div key={r.cx} className="flex items-center justify-between rounded-lg border border-gray-100 p-3 dark:border-zinc-700">
                    <span className="text-sm text-gray-900 dark:text-white">
                      {MEDAL[i] || `${i + 1}.`} {r.cx}
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {r.total} reuniões
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">Sem dados no período</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Restart dev server and test dashboard page**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; cd /Users/mac0267/Cortex && npm run dev &
```

Open `http://localhost:3000/dashboard/comercial/crosssell-dashboard` in browser. Verify:
- Page loads without errors
- Period selector (month/year) renders
- 5 KPI cards render (all zeros initially)
- Funil chart area renders (empty state message)
- Rankings render (empty state messages)
- Dark mode styling correct

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/CrossSellDashboard.tsx
git commit -m "feat(crosssell): add analytics dashboard with KPIs, funnel, rankings

Includes: 5 KPI cards (reuniões, valores, conversão), horizontal bar
charts for funnel and meetings per CX, value and meetings rankings
with period filter.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Integration Testing & Polish

**Files:**
- All previously created/modified files

- [ ] **Step 1: End-to-end flow test**

In the browser, test the complete flow:

1. Navigate to CrossSell Pipeline via sidebar
2. Click "+ Nova Oportunidade"
3. Search for a client, select it
4. Choose a product, set values, create
5. Card should appear in the grid
6. Change the etapa via dropdown on the card
7. Add a comment via the comments drawer
8. Convert to "Negócio Ganho"
9. Card should disappear from pipeline
10. Navigate to CrossSell Dashboard
11. Verify KPIs update (at least 1 reunião if you went through that etapa)
12. Check negócios ganhos list via `curl http://localhost:3000/api/comercial/crosssell/ganhos`

- [ ] **Step 2: Test dark mode**

Toggle dark mode and verify:
- All cards, modals, and drawers have proper dark variants
- No white-on-white or dark-on-dark text issues
- Charts are readable in dark mode

- [ ] **Step 3: Test filter behavior**

On Pipeline page:
- Filter by cluster — cards should filter
- Filter by CX — cards should filter
- Filter by etapa — cards should filter
- Combine filters — should AND them
- Reset to "Todos" — all cards return

- [ ] **Step 4: Fix any issues found**

Address any bugs discovered during testing. Commit fixes individually.

- [ ] **Step 5: Final commit with any remaining fixes**

```bash
git add -A
git commit -m "fix(crosssell): polish and fixes from integration testing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```
