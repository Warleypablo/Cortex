# Módulo de Negativação de Inadimplentes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a Kanban-based workflow page to manage the delinquent client negativação pipeline (Notificação → Protesto → Negativação → Ação Judicial) with detailed tracking per action.

**Architecture:** New database table `cortex_core.negativacao_acoes` for action tracking, new backend routes for CRUD, and a new React page with drag-and-drop Kanban board + detail drawer. Clients are sourced from existing `caz_parcelas` (overdue installments) and `inadimplencia_contextos`.

**Tech Stack:** React, TanStack Query, Tailwind CSS, Recharts, dnd (HTML drag/drop API), Drizzle ORM, PostgreSQL

---

### Task 1: Create database table and Drizzle schema

**Files:**
- Modify: `shared/schema.ts` — add `negativacaoAcoes` table
- Run SQL on local + production databases

**Step 1: Add table to Drizzle schema**

After the `inadimplenciaContextos` table definition in `shared/schema.ts`, add:

```typescript
export const negativacaoAcoes = pgTable("negativacao_acoes", {
  id: serial("id").primaryKey(),
  clienteId: text("cliente_id").notNull(),
  clienteNome: text("cliente_nome").notNull(),
  clienteCnpj: text("cliente_cnpj"),
  etapa: text("etapa").notNull(), // 'notificacao' | 'protesto' | 'negativacao' | 'acao_judicial'
  status: text("status").notNull().default("pendente"), // 'pendente' | 'concluido'
  valorInadimplente: numeric("valor_inadimplente", { precision: 12, scale: 2 }).default("0"),
  diasAtraso: integer("dias_atraso").default(0),
  protocolo: text("protocolo"),
  responsavel: text("responsavel"),
  valorAcordado: numeric("valor_acordado", { precision: 12, scale: 2 }),
  dataAcao: date("data_acao"),
  dataAcordo: date("data_acordo"),
  observacoes: text("observacoes"),
  documentoUrl: text("documento_url"),
  criadoPor: text("criado_por"),
  criadoEm: timestamp("criado_em").defaultNow(),
  atualizadoEm: timestamp("atualizado_em").defaultNow(),
}, (table) => ({
  idxClienteId: index("idx_neg_cliente_id").on(table.clienteId),
  idxEtapa: index("idx_neg_etapa").on(table.etapa),
}));
```

**Step 2: Run SQL on local and production databases**

```sql
CREATE TABLE IF NOT EXISTS cortex_core.negativacao_acoes (
  id SERIAL PRIMARY KEY,
  cliente_id TEXT NOT NULL,
  cliente_nome TEXT NOT NULL,
  cliente_cnpj TEXT,
  etapa TEXT NOT NULL DEFAULT 'notificacao',
  status TEXT NOT NULL DEFAULT 'pendente',
  valor_inadimplente NUMERIC(12,2) DEFAULT 0,
  dias_atraso INTEGER DEFAULT 0,
  protocolo TEXT,
  responsavel TEXT,
  valor_acordado NUMERIC(12,2),
  data_acao DATE,
  data_acordo DATE,
  observacoes TEXT,
  documento_url TEXT,
  criado_por TEXT,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_neg_cliente_id ON cortex_core.negativacao_acoes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_neg_etapa ON cortex_core.negativacao_acoes(etapa);
```

**Step 3: Commit**
```bash
git add shared/schema.ts
git commit -m "feat(negativacao): add negativacao_acoes table schema"
```

---

### Task 2: Create backend API routes

**Files:**
- Create: `server/routes/negativacao.ts`
- Modify: `server/index.ts` — register new routes

**Endpoints to implement:**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/negativacao/kanban` | Get all clients grouped by etapa with summary metrics |
| GET | `/api/negativacao/cliente/:clienteId` | Get client detail + all actions history |
| POST | `/api/negativacao/acoes` | Create new action (add client to pipeline) |
| PUT | `/api/negativacao/acoes/:id` | Update action (edit details, change status) |
| PUT | `/api/negativacao/mover/:clienteId` | Move client to next/different etapa |
| GET | `/api/negativacao/resumo` | Summary metrics (total clients, value, recovery rate) |

**Key logic for `/api/negativacao/kanban`:**
- Query `negativacao_acoes` grouped by `etapa`
- For each client, get latest action per etapa
- Return: `{ columns: { notificacao: [...], protesto: [...], negativacao: [...], acao_judicial: [...] }, resumo: { total, valor, acordos, taxaRecuperacao } }`

**Key logic for POST `/api/negativacao/acoes`:**
- Accept: clienteId, clienteNome, clienteCnpj, etapa, valorInadimplente, diasAtraso, responsavel, observacoes
- Insert into negativacao_acoes
- Return created record

**Key logic for PUT `/api/negativacao/mover/:clienteId`:**
- Accept: novaEtapa
- Create new action record for the new etapa with status 'pendente'
- Mark previous etapa action as 'concluido'

**Step 1: Create the routes file with all endpoints**
**Step 2: Register in server/index.ts**
**Step 3: Commit**

```bash
git add server/routes/negativacao.ts server/index.ts
git commit -m "feat(negativacao): add CRUD API routes for negativação pipeline"
```

---

### Task 3: Create the Kanban frontend page

**Files:**
- Create: `client/src/pages/Negativacao.tsx`
- Modify: `client/src/App.tsx` — add route
- Modify: `shared/nav-config.ts` — add menu item under Financeiro

**Page structure:**

```
┌─────────────────────────────────────────────────┐
│ [Hero Metrics: 4 cards]                         │
│ Total em processo | Valor total | Acordos | Taxa│
├─────────────────────────────────────────────────┤
│ Notificação  │ Protesto  │ Negativação │ Ação   │
│  12 | R$45K  │ 5 | R$28K │ 3 | R$15K  │ 1|R$8K │
│ ┌──────────┐ │           │             │        │
│ │ Card     │ │ ...       │ ...         │ ...    │
│ │ Cliente  │ │           │             │        │
│ │ R$ valor │ │           │             │        │
│ └──────────┘ │           │             │        │
└─────────────────────────────────────────────────┘
```

**Kanban implementation:**
- Use HTML5 Drag and Drop API (no external lib needed)
- `onDragStart`, `onDragOver`, `onDrop` handlers
- On drop: call PUT `/api/negativacao/mover/:clienteId` with new etapa
- Optimistic update with React Query invalidation

**Card component:**
- Client name (bold)
- Value badge (red)
- Days overdue
- Last action date
- Responsible name
- Status indicator (pendente=yellow, concluido=green)
- Click → opens detail drawer

**Detail drawer (Sheet/Dialog):**
- Client info section (name, CNPJ, total value)
- Timeline of all actions (chronological)
- Form for current etapa:
  - Date, status, protocol number, responsible
  - Negotiated value (if agreement), agreement date
  - Notes, document URL
  - Save button
- "Avançar Etapa" button
- "Registrar Acordo" button (sets valorAcordado + dataAcordo)

**Colors per etapa:**
- Notificação: amber/yellow
- Protesto: orange
- Negativação: red
- Ação Judicial: purple

**Design system:** Follow existing dark theme (bg-white dark:bg-zinc-900, etc.)

**Step 1: Create the page component with all sections**
**Step 2: Add route to App.tsx and nav-config.ts**
**Step 3: Commit**

```bash
git add client/src/pages/Negativacao.tsx client/src/App.tsx shared/nav-config.ts
git commit -m "feat(negativacao): add Kanban page with drag-drop and detail drawer"
```

---

### Task 4: Add route permissions and push

**Files:**
- Modify: `server/auth/userDb.ts` — add to DEFAULT_USER_ROUTES or admin routes
- Run SQL to update existing users

**Step 1: Add permission and route**
**Step 2: Update users in production**

```sql
UPDATE cortex_core.auth_users
SET allowed_routes = array_append(allowed_routes, '/financeiro/negativacao')
WHERE NOT ('/financeiro/negativacao' = ANY(allowed_routes));
```

**Step 3: Push and create PR**
```bash
git push origin main
```
