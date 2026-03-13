# Tech Hub Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the tech area into a centralized Hub with Overview, Board, Projetos, and Performance sections — powered by ClickUp status history and comments data.

**Architecture:** New database tables (`cup_status_history`, `cup_comentarios`) capture ClickUp status transitions and comments. Expanded sync uses bulk APIs with rate limiting. A single-page Hub (`/tech`) with internal sidebar navigation replaces 4 separate pages. All data flows through new API endpoints to React components using React Query + Recharts.

**Tech Stack:** React, TypeScript, Tailwind CSS (dark/light mode), Recharts, React Query, Express, PostgreSQL, ClickUp API v2, Radix UI Sheet (drawer)

**Spec:** `docs/superpowers/specs/2026-03-13-tech-hub-redesign-design.md`

---

## File Structure

### New Files (Backend)
| File | Responsibility |
|------|---------------|
| `server/routes/tech-hub.ts` | New Hub endpoints (board, historico, comentarios, prazo-por-status, entregas-trimestre, tempo-deploy, hub-metricas) |

### New Files (Frontend)
| File | Responsibility |
|------|---------------|
| `client/src/pages/TechHub.tsx` | Main Hub page with sidebar + internal tab routing |
| `client/src/pages/tech/TechOverview.tsx` | Overview section (KPIs, prazo por status, entregas, vencimentos) |
| `client/src/pages/tech/TechBoard.tsx` | Board section (Kanban por PO) |
| `client/src/pages/tech/TechProjetosHub.tsx` | Projetos section (list + drawer) |
| `client/src/pages/tech/TechPerformance.tsx` | Performance section (tempo deploy, entregas trimestrais) |
| `client/src/components/tech/ProjectCard.tsx` | Reusable project card (Board + Lista) |
| `client/src/components/tech/ProjectDrawer.tsx` | Drawer lateral with meta cards, prazo bar, timeline |
| `client/src/components/tech/StatusTimeline.tsx` | Unified timeline (comments + status + blocks) |
| `client/src/components/tech/PrazoStatusBar.tsx` | Stacked horizontal bar for time per status |

### Modified Files
| File | What Changes |
|------|-------------|
| `server/routes/tech.ts` | Add sync-status-history and sync-comments to existing sync endpoint |
| `server/storage.ts` | Add new getTechHub* methods to interface and DatabaseStorage |
| `server/routes.ts` | Import and register new tech-hub routes |
| `client/src/App.tsx` | Add `/tech` route, lazy import TechHub, redirect legacy routes |

---

## Chunk 1: Database Tables & Sync Infrastructure

### Task 1: Create database tables

**Files:**
- Modify: `server/routes/tech.ts` (add table creation to sync flow)

- [ ] **Step 1: Add cup_status_history table creation SQL**

Add to the sync endpoint, before the main sync logic. The tables should be created if they don't exist:

```sql
CREATE TABLE IF NOT EXISTS "Clickup".cup_status_history (
  id SERIAL PRIMARY KEY,
  clickup_task_id TEXT NOT NULL,
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  data_transicao TIMESTAMP,
  duracao_ms BIGINT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_status_history_task_id
ON "Clickup".cup_status_history (clickup_task_id, data_transicao);
```

- [ ] **Step 2: Add cup_comentarios table creation SQL**

```sql
CREATE TABLE IF NOT EXISTS "Clickup".cup_comentarios (
  id SERIAL PRIMARY KEY,
  clickup_task_id TEXT NOT NULL,
  clickup_comment_id TEXT UNIQUE NOT NULL,
  autor TEXT,
  texto TEXT,
  data_criacao TIMESTAMP,
  tags_extraidas TEXT[] DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_comentarios_task_id
ON "Clickup".cup_comentarios (clickup_task_id, data_criacao);
```

- [ ] **Step 3: Run sync to verify tables are created**

Run: `curl -X POST http://localhost:3000/api/tech/sync-clickup`
Expected: 200 OK, tables created in database

- [ ] **Step 4: Verify tables exist in database**

Check via SQL: `SELECT * FROM "Clickup".cup_status_history LIMIT 1;` and `SELECT * FROM "Clickup".cup_comentarios LIMIT 1;`

- [ ] **Step 5: Commit**

```bash
git add server/routes/tech.ts
git commit -m "feat(tech): create cup_status_history and cup_comentarios tables"
```

---

### Task 2: Implement status history sync (bulk API)

**Files:**
- Modify: `server/routes/tech.ts:263-336` (expand sync endpoint)

- [ ] **Step 1: Add bulk time_in_status fetch function**

Add after the existing `fetchAllClickUpTasks` function (~line 101):

```typescript
async function fetchBulkTimeInStatus(taskIds: string[]): Promise<Record<string, any>> {
  const results: Record<string, any> = {};
  // ClickUp bulk endpoint accepts up to 100 task IDs
  for (let i = 0; i < taskIds.length; i += 100) {
    const batch = taskIds.slice(i, i + 100);
    const queryParams = batch.map(id => `task_ids=${id}`).join('&');
    const response = await fetch(
      `https://api.clickup.com/api/v2/task/bulk_time_in_status/task_ids?${queryParams}`,
      { headers: { Authorization: process.env.CLICKUP_API_KEY || '' } }
    );
    if (response.ok) {
      const data = await response.json();
      // data.data is array of {task_id, status_history: {status_id: {total_time, orderindex, status_history: [...]}}}
      if (data.data) {
        for (const item of data.data) {
          results[item.task_id] = item.status_history;
        }
      }
    }
    // Rate limit: pause between batches if more than one
    if (i + 100 < taskIds.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return results;
}
```

- [ ] **Step 2: Add status history parsing and insert logic**

Add a function to transform ClickUp's time_in_status response into rows for `cup_status_history`. The ClickUp API returns per-status data; we need to reconstruct the transition sequence:

```typescript
async function syncStatusHistory(db: any, taskIds: string[], taskCreationDates: Record<string, string>) {
  const bulkData = await fetchBulkTimeInStatus(taskIds);

  // Truncate and re-insert
  await db.execute(sql`TRUNCATE TABLE "Clickup".cup_status_history`);

  for (const [taskId, statusData] of Object.entries(bulkData)) {
    if (!statusData) continue;

    // Collect all status entries with their orderindex
    const entries: Array<{status: string, totalTime: number, orderindex: number}> = [];

    for (const [statusName, info] of Object.entries(statusData as Record<string, any>)) {
      if (info.status_history) {
        for (const hist of info.status_history) {
          entries.push({
            status: statusName.toLowerCase(),
            totalTime: parseInt(hist.total_time) || 0,
            orderindex: parseInt(hist.orderindex) || 0,
          });
        }
      } else {
        entries.push({
          status: statusName.toLowerCase(),
          totalTime: parseInt(info.total_time) || 0,
          orderindex: parseInt(info.orderindex) || 0,
        });
      }
    }

    // Sort by orderindex to get chronological order
    entries.sort((a, b) => a.orderindex - b.orderindex);

    // Reconstruct approximate transition timestamps from task creation date + accumulated durations
    const creationDate = taskCreationDates[taskId];
    let cumulativeMs = 0;
    const baseTime = creationDate ? new Date(parseInt(creationDate)).getTime() : Date.now();

    for (let i = 0; i < entries.length; i++) {
      const prev = i > 0 ? entries[i - 1].status : null;
      const curr = entries[i];
      const transicaoDate = new Date(baseTime + cumulativeMs);

      await db.execute(sql`
        INSERT INTO "Clickup".cup_status_history
        (clickup_task_id, status_anterior, status_novo, data_transicao, duracao_ms)
        VALUES (${taskId}, ${prev}, ${curr.status}, ${transicaoDate}, ${curr.totalTime})
      `);

      cumulativeMs += curr.totalTime;
    }
  }
}
```

- [ ] **Step 3: Integrate into existing sync endpoint**

In the POST `/api/tech/sync-clickup` handler (line ~263), after the existing sync logic for open/closed tasks, add:

```typescript
// After existing insert logic, before response
// 'tasks' is the array from fetchAllClickUpTasks() already in scope
const allTaskIds = tasks.map((t: any) => t.id);
const taskCreationDates: Record<string, string> = {};
for (const t of tasks) {
  taskCreationDates[t.id] = t.date_created;
}
await syncStatusHistory(db, allTaskIds, taskCreationDates);
console.log(`[Tech Sync] Status history synced for ${allTaskIds.length} tasks`);
```

- [ ] **Step 4: Test the sync**

Run: `curl -X POST http://localhost:3000/api/tech/sync-clickup`
Verify: Check `SELECT COUNT(*) FROM "Clickup".cup_status_history;` returns rows

- [ ] **Step 5: Commit**

```bash
git add server/routes/tech.ts
git commit -m "feat(tech): sync status history from ClickUp bulk API"
```

---

### Task 3: Implement comments sync with tag parsing

**Files:**
- Modify: `server/routes/tech.ts` (add comments sync)

- [ ] **Step 1: Add comment fetch function**

```typescript
async function fetchTaskComments(taskId: string): Promise<any[]> {
  const comments: any[] = [];
  let startId: string | undefined;

  while (true) {
    let url = `https://api.clickup.com/api/v2/task/${taskId}/comment?`;
    if (startId) url += `start_id=${startId}&`;

    const response = await fetch(url, {
      headers: { Authorization: process.env.CLICKUP_API_KEY || '' }
    });

    if (!response.ok) break;
    const data = await response.json();
    if (!data.comments || data.comments.length === 0) break;

    comments.push(...data.comments);

    // ClickUp paginates at 25
    if (data.comments.length < 25) break;
    startId = data.comments[data.comments.length - 1].id;
  }

  return comments;
}
```

- [ ] **Step 2: Add tag extraction function**

```typescript
function extractTags(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const tags: string[] = [];

  if (/bloqueio|bloqueado|impedimento|impedido/.test(lower)) {
    tags.push('bloqueio');
  }
  if (/pendência|pendencia|aguardando cliente|aguardando aprovação|aguardando aprovacao/.test(lower)) {
    tags.push('pendencia_cliente');
  }
  if (/atraso|risco|urgente|crítico|critico/.test(lower)) {
    tags.push('alerta');
  }

  return tags;
}
```

- [ ] **Step 3: Add comments sync function (open projects only)**

```typescript
async function syncComments(db: any, openTaskIds: string[]) {
  for (const taskId of openTaskIds) {
    const comments = await fetchTaskComments(taskId);

    for (const comment of comments) {
      // Extract plain text from ClickUp comment_text array
      const text = Array.isArray(comment.comment_text)
        ? comment.comment_text.map((c: any) => c.text || '').join('')
        : (comment.comment_text || '');

      const tags = extractTags(text);
      const autor = comment.user?.username || comment.user?.email || 'unknown';
      const dataCriacao = comment.date ? new Date(parseInt(comment.date)) : null;

      await db.execute(sql`
        INSERT INTO "Clickup".cup_comentarios
        (clickup_task_id, clickup_comment_id, autor, texto, data_criacao, tags_extraidas)
        VALUES (${taskId}, ${comment.id}, ${autor}, ${text}, ${dataCriacao}, ${tags})
        ON CONFLICT (clickup_comment_id) DO UPDATE SET
          texto = EXCLUDED.texto,
          tags_extraidas = EXCLUDED.tags_extraidas
      `);
    }

    // Small delay between tasks to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}
```

- [ ] **Step 4: Integrate into sync endpoint**

After status history sync, add:

```typescript
const openTaskIds = openTasks.map((t: any) => t.id);
await syncComments(db, openTaskIds);
console.log(`[Tech Sync] Comments synced for ${openTaskIds.length} open tasks`);
```

- [ ] **Step 5: Test the sync**

Run: `curl -X POST http://localhost:3000/api/tech/sync-clickup`
Verify: `SELECT COUNT(*) FROM "Clickup".cup_comentarios;` and `SELECT DISTINCT unnest(tags_extraidas) FROM "Clickup".cup_comentarios;`

- [ ] **Step 6: Commit**

```bash
git add server/routes/tech.ts
git commit -m "feat(tech): sync comments from ClickUp with tag extraction"
```

---

## Chunk 2: New API Endpoints

### Task 4: Add storage interface methods

**Files:**
- Modify: `server/storage.ts:270-283` (IStorage interface)
- Modify: `server/storage.ts:1028-1082` (MemStorage stubs)

- [ ] **Step 1: Add new method signatures to IStorage interface**

After line 283 (end of existing tech methods), add:

```typescript
getTechBoard(status?: string, tipo?: string, prioridade?: string): Promise<any[]>;
getTechProjetoHistorico(taskId: string, tipo?: string): Promise<any[]>;
getTechProjetoComentarios(taskId: string): Promise<any[]>;
getTechPrazoPorStatus(responsavel?: string): Promise<any[]>;
getTechEntregasTrimestre(meses?: number): Promise<any[]>;
getTechTempoDeploy(meses?: number, responsavel?: string): Promise<any[]>;
```

- [ ] **Step 2: Add MemStorage stubs**

After existing tech stubs (~line 1082), add throw stubs for each new method.

- [ ] **Step 3: Commit**

```bash
git add server/storage.ts
git commit -m "feat(tech): add Hub storage interface methods"
```

---

### Task 5: Implement getTechBoard

**Files:**
- Modify: `server/storage.ts` (add after last getTech method ~line 8400)

- [ ] **Step 1: Implement getTechBoard**

```typescript
async getTechBoard(status?: string, tipo?: string, prioridade?: string): Promise<any[]> {
  // Build WHERE conditions - inputs are whitelisted/sanitized, not user-freetext
  // Use sql.raw() with string interpolation (same pattern as existing storage.ts methods)
  // Sanitize by removing any SQL-special characters from filter values
  const sanitize = (v: string) => v.replace(/['"%;\\]/g, '');

  const conditions: string[] = [];
  if (status) conditions.push(`p.status_projeto ILIKE '%${sanitize(status)}%'`);
  if (tipo) conditions.push(`p.tipo ILIKE '%${sanitize(tipo)}%'`);
  if (prioridade) conditions.push(`p.prioridade ILIKE '%${sanitize(prioridade)}%'`);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await this.db.execute(sql.raw(`
    SELECT
      p.*,
      COALESCE(
        (SELECT array_agg(DISTINCT tag)
         FROM "Clickup".cup_comentarios c, unnest(c.tags_extraidas) AS tag
         WHERE c.clickup_task_id = p.clickup_task_id),
        '{}'
      ) AS tags_ativas,
      (SELECT MIN(data_transicao)
       FROM "Clickup".cup_status_history h
       WHERE h.clickup_task_id = p.clickup_task_id
       AND h.status_novo ILIKE '%design%') AS data_inicio_prazo
    FROM "Clickup".cup_projetos_tech p
    ${whereClause}
    ORDER BY p.responsavel, p.data_vencimento ASC
  `));
  return result.rows;
}
```

**Note on sql.raw():** Drizzle's `sql.raw()` does NOT accept a params array. The codebase uses `sql.raw(string)` throughout. For these queries, filter values come from controlled dropdowns (not free-text user input), so we sanitize with a strip function. For `taskId` parameters that are ClickUp IDs, use the tagged `sql` template where possible (as shown in `getTechProjetoComentarios`).

- [ ] **Step 2: Test manually**

Run server, then: `curl http://localhost:3000/api/tech/board`

- [ ] **Step 3: Commit**

```bash
git add server/storage.ts
git commit -m "feat(tech): implement getTechBoard with tags and prazo"
```

---

### Task 6: Implement getTechProjetoHistorico and getTechProjetoComentarios

**Files:**
- Modify: `server/storage.ts`

- [ ] **Step 1: Implement getTechProjetoHistorico**

Returns interleaved timeline of status changes + comments:

```typescript
async getTechProjetoHistorico(taskId: string, tipo?: string): Promise<any[]> {
  // Use parameterized query to prevent SQL injection
  const validTipos = ['tudo', 'bloqueios', 'comentarios', 'status'];
  const safeTipo = validTipos.includes(tipo || '') ? tipo : 'tudo';

  let tipoFilter = '';
  if (safeTipo === 'bloqueios') {
    tipoFilter = `WHERE tipo_evento = 'bloqueio'`;
  } else if (safeTipo === 'comentarios') {
    tipoFilter = `WHERE tipo_evento IN ('comentario', 'bloqueio')`;
  } else if (safeTipo === 'status') {
    tipoFilter = `WHERE tipo_evento = 'status'`;
  }

  const result = await this.db.execute(sql.raw(`
    SELECT * FROM (
      -- Status changes
      SELECT
        'status' AS tipo_evento,
        COALESCE(status_anterior, '(início)') || ' → ' || status_novo AS descricao,
        NULL AS autor,
        data_transicao AS data_evento,
        duracao_ms,
        NULL AS tags
      FROM "Clickup".cup_status_history
      WHERE clickup_task_id = '${taskId.replace(/'/g, "''")}'

      UNION ALL

      -- Comments
      SELECT
        CASE
          WHEN 'bloqueio' = ANY(tags_extraidas) THEN 'bloqueio'
          ELSE 'comentario'
        END AS tipo_evento,
        texto AS descricao,
        autor,
        data_criacao AS data_evento,
        NULL AS duracao_ms,
        tags_extraidas::text AS tags
      FROM "Clickup".cup_comentarios
      WHERE clickup_task_id = '${taskId.replace(/'/g, "''")}'
    ) combined
    ${tipoFilter}
    ORDER BY data_evento DESC
  `));
  return result.rows;
}
```

- [ ] **Step 2: Implement getTechProjetoComentarios**

```typescript
async getTechProjetoComentarios(taskId: string): Promise<any[]> {
  const result = await this.db.execute(sql`
    SELECT * FROM "Clickup".cup_comentarios
    WHERE clickup_task_id = ${taskId}
    ORDER BY data_criacao DESC
  `);
  return result.rows;
}
```

- [ ] **Step 3: Commit**

```bash
git add server/storage.ts
git commit -m "feat(tech): implement project historico and comentarios methods"
```

---

### Task 7: Implement getTechPrazoPorStatus, getTechEntregasTrimestre, getTechTempoDeploy

**Files:**
- Modify: `server/storage.ts`

- [ ] **Step 1: Implement getTechPrazoPorStatus**

```typescript
async getTechPrazoPorStatus(responsavel?: string): Promise<any[]> {
  const sanitize = (v: string) => v.replace(/['"%;\\]/g, '');
  let responsavelFilter = '';

  if (responsavel) {
    responsavelFilter = `AND p.responsavel ILIKE '%${sanitize(responsavel)}%'`;
  }

  // Query both open AND closed projects for better sample size
  const query = `
    SELECT
      h.status_novo AS status,
      AVG(h.duracao_ms) / 86400000.0 AS media_dias,
      COUNT(*) AS total_transicoes
    FROM "Clickup".cup_status_history h
    LEFT JOIN (
      SELECT clickup_task_id, responsavel FROM "Clickup".cup_projetos_tech
      UNION ALL
      SELECT clickup_task_id, responsavel FROM "Clickup".cup_projetos_tech_fechados
    ) p ON p.clickup_task_id = h.clickup_task_id
    WHERE h.duracao_ms > 0
    ${responsavelFilter}
    GROUP BY h.status_novo
    ORDER BY AVG(h.duracao_ms) DESC
  `;

  const result = await this.db.execute(sql.raw(query));
  return result.rows;
}
```

- [ ] **Step 2: Implement getTechEntregasTrimestre**

```typescript
async getTechEntregasTrimestre(meses: number = 12): Promise<any[]> {
  // Validate meses is a positive integer to prevent invalid SQL
  const safeMeses = Math.max(1, Math.min(Math.floor(meses) || 12, 60));

  const result = await this.db.execute(sql.raw(`
    SELECT
      EXTRACT(YEAR FROM data_entregue::date) AS ano,
      EXTRACT(QUARTER FROM data_entregue::date) AS trimestre,
      'Q' || EXTRACT(QUARTER FROM data_entregue::date) || ' ' || EXTRACT(YEAR FROM data_entregue::date) AS label,
      COUNT(*) AS total_entregas,
      AVG(CASE WHEN valor_p IS NOT NULL AND valor_p != '' THEN valor_p::numeric / 100.0 ELSE 0 END) AS valor_medio
    FROM "Clickup".cup_projetos_tech_fechados
    WHERE data_entregue IS NOT NULL
    AND data_entregue != ''
    AND data_entregue::date >= NOW() - INTERVAL '${safeMeses} months'
    GROUP BY ano, trimestre
    ORDER BY ano, trimestre
  `));
  return result.rows;
}
```

- [ ] **Step 3: Implement getTechTempoDeploy**

```typescript
async getTechTempoDeploy(meses: number = 12, responsavel?: string): Promise<any[]> {
  const safeMeses = Math.max(1, Math.min(Math.floor(meses) || 12, 60));
  const sanitize = (v: string) => v.replace(/['"%;\\]/g, '');
  let responsavelFilter = '';
  let groupByResponsavel = 'NULL AS responsavel';
  let groupByClause = 'GROUP BY ano, trimestre';

  if (responsavel) {
    responsavelFilter = `AND responsavel ILIKE '%${sanitize(responsavel)}%'`;
    groupByResponsavel = 'responsavel';
    groupByClause = 'GROUP BY ano, trimestre, responsavel';
  }

  const query = `
    WITH deploy_times AS (
      SELECT
        p.clickup_task_id,
        p.responsavel,
        p.data_entregue,
        MIN(CASE WHEN h.status_novo ILIKE '%design%' THEN h.data_transicao END) AS inicio_design,
        EXTRACT(YEAR FROM p.data_entregue::date) AS ano,
        EXTRACT(QUARTER FROM p.data_entregue::date) AS trimestre
      FROM "Clickup".cup_projetos_tech_fechados p
      JOIN "Clickup".cup_status_history h ON h.clickup_task_id = p.clickup_task_id
      WHERE p.data_entregue IS NOT NULL
      AND p.data_entregue != ''
      AND p.data_entregue::date >= NOW() - INTERVAL '${safeMeses} months'
      GROUP BY p.clickup_task_id, p.responsavel, p.data_entregue
    )
    SELECT
      'Q' || trimestre || ' ' || ano AS label,
      ano, trimestre,
      ${groupByResponsavel},
      AVG(EXTRACT(EPOCH FROM (data_entregue::timestamp - inicio_design)) / 86400) AS media_dias,
      COUNT(*) AS total_projetos
    FROM deploy_times
    WHERE inicio_design IS NOT NULL
    ${responsavelFilter}
    ${groupByClause}
    ORDER BY ano, trimestre
  `;

  const result = await this.db.execute(sql.raw(query));
  return result.rows;
}
```

- [ ] **Step 4: Commit**

```bash
git add server/storage.ts
git commit -m "feat(tech): implement prazo-por-status, entregas-trimestre, tempo-deploy methods"
```

---

### Task 8: Register new API routes

**Files:**
- Create: `server/routes/tech-hub.ts`
- Modify: `server/routes.ts:28,6872` (import + register)

- [ ] **Step 1: Create tech-hub.ts route file**

```typescript
import { Express } from 'express';
import { IStorage } from '../storage';

export function registerTechHubRoutes(app: Express, db: any, storage: IStorage) {

  app.get('/api/tech/board', async (req, res) => {
    try {
      const { status, tipo, prioridade } = req.query;
      const data = await storage.getTechBoard(
        status as string, tipo as string, prioridade as string
      );

      // Group by responsavel
      const grouped: Record<string, any[]> = {};
      for (const row of data) {
        const resp = row.responsavel || 'Sem responsável';
        if (!grouped[resp]) grouped[resp] = [];
        grouped[resp].push(row);
      }

      res.json(Object.entries(grouped).map(([responsavel, projetos]) => ({
        responsavel,
        projetos,
        total: projetos.length,
      })));
    } catch (error) {
      console.error('Error fetching board:', error);
      res.status(500).json({ error: 'Failed to fetch board data' });
    }
  });

  app.get('/api/tech/projeto/:id/historico', async (req, res) => {
    try {
      const { tipo } = req.query;
      const data = await storage.getTechProjetoHistorico(req.params.id, tipo as string);
      res.json(data);
    } catch (error) {
      console.error('Error fetching historico:', error);
      res.status(500).json({ error: 'Failed to fetch project history' });
    }
  });

  app.get('/api/tech/projeto/:id/comentarios', async (req, res) => {
    try {
      const data = await storage.getTechProjetoComentarios(req.params.id);
      res.json(data);
    } catch (error) {
      console.error('Error fetching comentarios:', error);
      res.status(500).json({ error: 'Failed to fetch comments' });
    }
  });

  app.get('/api/tech/prazo-por-status', async (req, res) => {
    try {
      const { responsavel } = req.query;
      const data = await storage.getTechPrazoPorStatus(responsavel as string);
      res.json(data);
    } catch (error) {
      console.error('Error fetching prazo-por-status:', error);
      res.status(500).json({ error: 'Failed to fetch status timing' });
    }
  });

  app.get('/api/tech/entregas-trimestre', async (req, res) => {
    try {
      const meses = parseInt(req.query.meses as string) || 12;
      const data = await storage.getTechEntregasTrimestre(meses);
      res.json(data);
    } catch (error) {
      console.error('Error fetching entregas-trimestre:', error);
      res.status(500).json({ error: 'Failed to fetch quarterly deliveries' });
    }
  });

  app.get('/api/tech/tempo-deploy', async (req, res) => {
    try {
      const meses = parseInt(req.query.meses as string) || 12;
      const { responsavel } = req.query;
      const data = await storage.getTechTempoDeploy(meses, responsavel as string);
      res.json(data);
    } catch (error) {
      console.error('Error fetching tempo-deploy:', error);
      res.status(500).json({ error: 'Failed to fetch deploy time' });
    }
  });
}
```

- [ ] **Step 2: Register in routes.ts**

At line 28, add import:
```typescript
import { registerTechHubRoutes } from "./routes/tech-hub";
```

At line ~6872 (after registerTechRoutes), add:
```typescript
registerTechHubRoutes(app, db, storage);
```

- [ ] **Step 3: Test all endpoints**

```bash
curl http://localhost:3000/api/tech/board
curl http://localhost:3000/api/tech/prazo-por-status
curl http://localhost:3000/api/tech/entregas-trimestre
curl http://localhost:3000/api/tech/tempo-deploy
```

- [ ] **Step 4: Commit**

```bash
git add server/routes/tech-hub.ts server/routes.ts server/storage.ts
git commit -m "feat(tech): register new Tech Hub API endpoints"
```

---

## Chunk 3: Frontend — Hub Structure & Overview

### Task 9: Create TechHub main page with sidebar

**Files:**
- Create: `client/src/pages/TechHub.tsx`
- Modify: `client/src/App.tsx:77-80,317-320`

- [ ] **Step 1: Create TechHub.tsx**

```tsx
import { useState } from "react";
import { useTheme } from "@/components/ThemeProvider";

// Lazy-loaded sections
import TechOverview from "./tech/TechOverview";
import TechBoard from "./tech/TechBoard";
import TechProjetosHub from "./tech/TechProjetosHub";
import TechPerformance from "./tech/TechPerformance";

type Section = "overview" | "board" | "projetos" | "performance";

const sections: { id: Section; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "BarChart3" },
  { id: "board", label: "Board", icon: "Columns3" },
  { id: "projetos", label: "Projetos", icon: "FolderOpen" },
  { id: "performance", label: "Performance", icon: "TrendingUp" },
];

export default function TechHub() {
  // Read initial section from URL query param (for legacy redirects)
  const searchParams = new URLSearchParams(window.location.search);
  const initialSection = (searchParams.get("section") as Section) || "overview";
  const [activeSection, setActiveSection] = useState<Section>(
    sections.some(s => s.id === initialSection) ? initialSection : "overview"
  );

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <div className="w-52 bg-white dark:bg-zinc-950 border-r border-gray-200 dark:border-zinc-800 p-4 flex flex-col gap-1">
        <div className="text-indigo-600 dark:text-indigo-400 font-bold text-sm mb-4 px-3">
          Tech Hub
        </div>
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeSection === s.id
                ? "bg-indigo-600 text-white"
                : "text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-zinc-900">
        {activeSection === "overview" && <TechOverview />}
        {activeSection === "board" && <TechBoard />}
        {activeSection === "projetos" && <TechProjetosHub />}
        {activeSection === "performance" && <TechPerformance />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create placeholder files for sub-sections**

Create minimal placeholder components for `TechOverview.tsx`, `TechBoard.tsx`, `TechProjetosHub.tsx`, `TechPerformance.tsx` in `client/src/pages/tech/` — each returns `<div>Section Name (coming soon)</div>`.

- [ ] **Step 3: Update App.tsx routes**

**Important:** The project uses **wouter** (not react-router) and `lazyWithRetry` (not `lazy`).

At line ~77, add lazy import using the existing pattern:
```tsx
const TechHub = lazyWithRetry(() => import("@/pages/TechHub"));
```

At line ~317, replace the 4 existing tech routes with:
```tsx
{/* Tech */}
<Route path="/tech">{() => <ProtectedRoute path="/tech" component={TechHub} />}</Route>
<Route path="/dashboard/tech">{() => <RedirectTo to="/tech" />}</Route>
<Route path="/tech/projetos">{() => <RedirectTo to="/tech?section=projetos" />}</Route>
<Route path="/tech/evolucao">{() => <RedirectTo to="/tech" />}</Route>
<Route path="/tech/financeiro">{() => <RedirectTo to="/tech" />}</Route>
```

Add a small redirect helper component (wouter has no `<Navigate>`):
```tsx
function RedirectTo({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  React.useEffect(() => { setLocation(to); }, [to, setLocation]);
  return null;
}
```

- [ ] **Step 4: Test navigation**

Open browser, navigate to `/tech`. Sidebar should render with 4 buttons. Clicking each shows the placeholder.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/TechHub.tsx client/src/pages/tech/ client/src/App.tsx
git commit -m "feat(tech): create TechHub page with sidebar navigation"
```

---

### Task 10: Implement TechOverview

**Files:**
- Modify: `client/src/pages/tech/TechOverview.tsx`

- [ ] **Step 1: Implement KPIs section**

Use `useQuery` to fetch from:
- `/api/tech/metricas` (existing) — gives `projetos_ativos`, `tempo_medio`, `taxa_no_prazo`
- `/api/tech/board` — compute "Em Risco" and "Bloqueios" client-side from the response:
  - **Em Risco count:** filter projects where `data_vencimento` exists and `(new Date(data_vencimento) - now) <= 3 days AND > 0` (yellow zone)
  - **Bloqueios count:** count projects whose `tags_ativas` array includes `'bloqueio'`

Display 5 KPI cards: Projetos Ativos (from metricas), Em Risco (computed), Tempo Médio (from metricas), Taxa No Prazo (from metricas), Bloqueios Ativos (computed).

Follow the wireframe layout: grid of 5 cards across the top.

- [ ] **Step 2: Implement Prazo por Status chart**

Fetch `/api/tech/prazo-por-status`. Render Recharts `BarChart` horizontal with bars for each status (Design, Dev, Review, QA, Deploy) showing `media_dias`.

Colors: Design=#a78bfa, Dev=#6366f1, Review=#818cf8, QA=#c4b5fd, Deploy=#ddd6fe

- [ ] **Step 3: Implement Entregas por Trimestre chart**

Fetch `/api/tech/entregas-trimestre`. Render Recharts `BarChart` vertical with bars per quarter.

- [ ] **Step 4: Implement Próximos Vencimentos list**

Fetch from `/api/tech/projetos-em-andamento` (existing). Sort by `data_vencimento`, show top 5-10. Color-code: red (overdue), yellow (≤3 days), green (>3 days).

- [ ] **Step 5: Test both themes**

Toggle dark/light mode, verify all cards and charts render correctly.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/tech/TechOverview.tsx
git commit -m "feat(tech): implement Overview section with KPIs, charts, and timeline"
```

---

## Chunk 4: Frontend — Board & Shared Components

### Task 11: Implement ProjectCard and PrazoStatusBar components

**Files:**
- Create: `client/src/components/tech/ProjectCard.tsx`
- Create: `client/src/components/tech/PrazoStatusBar.tsx`

- [ ] **Step 1: Create ProjectCard.tsx**

Card component used in Board and Projetos list. Props: project data object. Renders:
- Border color based on urgency (green/yellow/red)
- Project name + status badge
- Fase atual badge + tipo badge
- Prazo Contrato + Lançamento Previsto dates
- Progress bar (% of prazo consumed)
- Alert line (blocker/pendency tags from `tags_ativas`)
- onClick handler for drawer

Follow wireframe from `tech-hub-board.html`.

- [ ] **Step 2: Create PrazoStatusBar.tsx**

Stacked horizontal bar component. Props: array of `{status, duracao_ms}`. Renders each segment proportionally colored by status. Shows days label inside each segment.

Follow wireframe from `tech-hub-projetos.html` (drawer section).

- [ ] **Step 3: Commit**

```bash
git add client/src/components/tech/
git commit -m "feat(tech): create ProjectCard and PrazoStatusBar components"
```

---

### Task 12: Implement StatusTimeline and ProjectDrawer

**Files:**
- Create: `client/src/components/tech/StatusTimeline.tsx`
- Create: `client/src/components/tech/ProjectDrawer.tsx`

- [ ] **Step 1: Create StatusTimeline.tsx**

Timeline component. Props: `taskId`, `filterType` (tudo|comentarios|status|bloqueios). Fetches `/api/tech/projeto/:id/historico?tipo=<filter>`. Renders:
- Vertical line with colored dots (red=bloqueio, purple=comment, green=status change, gray=start)
- Each entry: type icon, author/description, timestamp, tags

Follow wireframe from `tech-hub-projetos.html` (drawer timeline section).

- [ ] **Step 2: Create ProjectDrawer.tsx**

Uses Radix Sheet component (`client/src/components/ui/sheet.tsx`). Props: `project` object, `open`, `onClose`. Renders:
- Header: project name, responsável, tipo, prioridade
- Meta cards row: Prazo Contrato, Lançamento Previsto, Tempo Total
- PrazoStatusBar (fetches status history for this task)
- StatusTimeline with filter tabs (Tudo / Comentários / Status / Bloqueios)

- [ ] **Step 3: Commit**

```bash
git add client/src/components/tech/
git commit -m "feat(tech): create StatusTimeline and ProjectDrawer components"
```

---

### Task 13: Implement TechBoard (Kanban por PO)

**Files:**
- Modify: `client/src/pages/tech/TechBoard.tsx`

- [ ] **Step 1: Implement board layout**

Fetch `/api/tech/board`. State: `selectedProject`, filter values (status, tipo, prioridade).

Layout:
- Filter bar at top with 3 Select dropdowns + project count
- Horizontal scrollable container with columns
- Each column: PO header (initials circle, name, project count, carga indicator) + list of ProjectCards
- Clicking a card sets `selectedProject` and opens ProjectDrawer

Carga indicator logic: >7=Alta(red), 4-7=Média(yellow), <4=OK(green)

- [ ] **Step 2: Test with real data**

Run sync first, then navigate to Board. Verify columns appear per PO, cards show correct data.

- [ ] **Step 3: Test both themes**

Toggle dark/light, verify all elements.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/tech/TechBoard.tsx
git commit -m "feat(tech): implement Board section with Kanban layout by PO"
```

---

## Chunk 5: Frontend — Projetos & Performance

### Task 14: Implement TechProjetosHub (List + Drawer)

**Files:**
- Modify: `client/src/pages/tech/TechProjetosHub.tsx`

- [ ] **Step 1: Implement project list with filters**

Fetch `/api/tech/projetos` (existing endpoint). State: filters (responsável, status, tipo), search query, toggle abertos/fechados, selectedProject.

Layout:
- Full-width project list with filter chips, search input, scrollable rows
- Each row: project name, status badge, responsável, fase, data vencimento
- Selected row highlighted with indigo border
- Clicking a row opens `ProjectDrawer` as a **Sheet (slide-out drawer from the right)** using Radix Sheet component — same pattern as Board. NOT a persistent side panel.

- [ ] **Step 2: Test search and filters**

Type in search, toggle filters, verify list updates.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/tech/TechProjetosHub.tsx
git commit -m "feat(tech): implement Projetos section with list and drawer"
```

---

### Task 15: Implement TechPerformance

**Files:**
- Modify: `client/src/pages/tech/TechPerformance.tsx`

- [ ] **Step 1: Implement KPIs and period selector**

State: `viewMode` (geral|por-po), `periodo` (6|12|24 months), `selectedPO`.

Fetch `/api/tech/tempo-deploy?meses=N` and `/api/tech/entregas-trimestre?meses=N`.

KPI cards: Tempo Médio Deploy, Entregas no Trimestre, Taxa No Prazo, Gargalo Principal.

- [ ] **Step 2: Implement Tempo Deploy por Trimestre chart**

Recharts `BarChart` vertical. Current quarter bar with dashed border.

- [ ] **Step 3: Implement Entregas por Trimestre chart**

Recharts `BarChart` vertical, similar to Overview but with period selector context.

- [ ] **Step 4: Implement Tempo Deploy por PO chart**

Recharts horizontal `BarChart`. Each bar = PO with initials, days value, and % change vs previous quarter. Color per PO.

- [ ] **Step 5: Implement Tempo Médio por Fase cards**

5 cards grid: Design, Dev, Review, QA, Deploy. Each shows: days, % of cycle, trend arrow, gargalo highlight (amber border for highest %).

Fetch `/api/tech/prazo-por-status`.

- [ ] **Step 6: Test both modes (geral + por PO) and both themes**

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/tech/TechPerformance.tsx
git commit -m "feat(tech): implement Performance section with deploy metrics"
```

---

## Chunk 6: Integration & Validation

### Task 16: Wire up sidebar navigation menu

**Files:**
- Modify: navigation/sidebar component (find via existing tech menu items)

- [ ] **Step 1: Update sidebar menu**

Replace existing 4 tech menu items (Dashboard Tech, Projetos, Evolução, Financeiro) with single "Tech Hub" entry pointing to `/tech`.

- [ ] **Step 2: Commit**

```bash
git add client/src/components/
git commit -m "feat(tech): update sidebar navigation to Tech Hub"
```

---

### Task 17: End-to-end validation

- [ ] **Step 1: Run full ClickUp sync**

```bash
curl -X POST http://localhost:3000/api/tech/sync-clickup
```

Verify logs show: tasks synced + status history synced + comments synced.

- [ ] **Step 2: Test Overview section**

Navigate to `/tech`. Verify: KPIs load, prazo por status chart renders, entregas trimestre chart renders, vencimentos list shows projects.

- [ ] **Step 3: Test Board section**

Click "Board" in sidebar. Verify: columns per PO appear, cards show urgency colors, clicking card opens drawer with timeline.

- [ ] **Step 4: Test Projetos section**

Click "Projetos". Verify: list loads, search works, filters work, clicking a project opens drawer with meta cards + prazo bar + timeline.

- [ ] **Step 5: Test Performance section**

Click "Performance". Verify: KPIs load, toggle Geral/Por PO works, period selector changes data, all charts render.

- [ ] **Step 6: Test legacy route redirects**

Navigate to `/dashboard/tech`, `/tech/projetos`, `/tech/evolucao`, `/tech/financeiro` — all should redirect to `/tech`.

- [ ] **Step 7: Test dark mode and light mode**

Toggle theme. All sections, cards, charts, drawer must render correctly in both modes.

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat(tech): complete Tech Hub redesign validation"
```
