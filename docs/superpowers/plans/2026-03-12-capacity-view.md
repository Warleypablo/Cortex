# Capacity View - Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que gestores definam a capacity (max contratos) de cada operador por produto e visualizem utilizacao consolidada por squad/produto.

**Architecture:** Nova tabela `cortex_core.capacity_operador` para armazenar limites. Backend com CRUD routes em arquivo separado. Frontend com pagina de 2 abas (Configuracao + Dashboard) usando React Query, Recharts e shadcn/ui.

**Tech Stack:** PostgreSQL (GCP), Express, Drizzle ORM (raw SQL), React, TailwindCSS, Recharts, React Query, shadcn/ui, Zod.

**Spec:** `docs/superpowers/specs/2026-03-12-capacity-view-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `server/routes/capacity.ts` | API routes (GET/POST/DELETE capacity) |
| Modify | `server/routes.ts` (~line 6855) | Register capacity routes |
| Modify | `shared/schema.ts` | Zod schemas + types para capacity |
| Modify | `shared/nav-config.ts` | Permissao `gestao.capacity` |
| Create | `client/src/pages/Capacity.tsx` | Pagina principal com 2 abas |
| Modify | `client/src/App.tsx` (~line 50) | Lazy import + Route |

---

## Chunk 1: Backend (DB + API)

### Task 1: Criar tabela e tipos

**Files:**
- Modify: `shared/schema.ts`
- Modify: `server/db.ts`

- [ ] **Step 1: Adicionar Zod schema e types em `shared/schema.ts`**

No final do arquivo, adicionar:

```typescript
// Capacity
export const capacityOperadorSchema = z.object({
  id: z.number().optional(),
  operador: z.string().min(1),
  produto: z.string().min(1),
  squad: z.string().min(1),
  max_contratos: z.number().int().positive(),
});

export const upsertCapacitySchema = capacityOperadorSchema.omit({ id: true });

export type CapacityOperador = z.infer<typeof capacityOperadorSchema>;
export type UpsertCapacity = z.infer<typeof upsertCapacitySchema>;

export type CapacityComUtilizacao = CapacityOperador & {
  contratos_atuais: number;
  vagas_livres: number;
  utilizacao_pct: number;
};
```

- [ ] **Step 2: Adicionar funcao de inicializacao da tabela em `server/db.ts`**

Seguir o padrao de `initializeNotificationsTable`. Adicionar:

```typescript
export async function initializeCapacityTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_core.capacity_operador (
        id SERIAL PRIMARY KEY,
        operador TEXT NOT NULL,
        produto TEXT NOT NULL,
        squad TEXT NOT NULL,
        max_contratos INTEGER NOT NULL,
        atualizado_por TEXT,
        atualizado_em TIMESTAMP DEFAULT NOW(),
        UNIQUE(operador, produto)
      )
    `);
    console.log('[database] Capacity table initialized');
  } catch (error) {
    console.error('[database] Error initializing capacity table:', error);
  }
}
```

Chamar `initializeCapacityTable()` junto com as outras inicializacoes existentes no startup do server.

- [ ] **Step 3: Commit**

```bash
git add shared/schema.ts server/db.ts
git commit -m "feat(capacity): add capacity table schema and initialization

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Criar rotas de API

**Files:**
- Create: `server/routes/capacity.ts`
- Modify: `server/routes.ts`

- [ ] **Step 1: Criar `server/routes/capacity.ts`**

Seguir o padrao de `server/routes/growth.ts`:

```typescript
import { Express } from "express";
import { sql } from "drizzle-orm";
import { upsertCapacitySchema } from "@shared/schema";

export function registerCapacityRoutes(app: Express, db: any) {

  // GET /api/capacity — lista todas as capacities com utilizacao calculada
  app.get("/api/capacity", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT
          cap.id,
          cap.operador,
          cap.produto,
          cap.squad,
          cap.max_contratos,
          cap.atualizado_por,
          cap.atualizado_em,
          COALESCE(ctr.contratos_atuais, 0)::int as contratos_atuais,
          (cap.max_contratos - COALESCE(ctr.contratos_atuais, 0))::int as vagas_livres,
          CASE
            WHEN cap.max_contratos > 0
            THEN ROUND((COALESCE(ctr.contratos_atuais, 0)::numeric / cap.max_contratos) * 100, 1)
            ELSE 0
          END as utilizacao_pct
        FROM cortex_core.capacity_operador cap
        LEFT JOIN (
          SELECT
            responsavel,
            produto,
            COUNT(*)::int as contratos_atuais
          FROM "Clickup".cup_contratos
          WHERE status IN ('ativo', 'onboarding', 'triagem')
          GROUP BY responsavel, produto
        ) ctr ON cap.operador = ctr.responsavel AND cap.produto = ctr.produto
        ORDER BY cap.squad, cap.operador, cap.produto
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching capacity:", error);
      res.status(500).json({ error: "Failed to fetch capacity" });
    }
  });

  // GET /api/capacity/consolidado — dados agregados por squad e produto
  app.get("/api/capacity/consolidado", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT
          cap.squad,
          cap.produto,
          SUM(cap.max_contratos)::int as capacity_total,
          SUM(COALESCE(ctr.contratos_atuais, 0))::int as contratos_total,
          (SUM(cap.max_contratos) - SUM(COALESCE(ctr.contratos_atuais, 0)))::int as vagas_livres,
          CASE
            WHEN SUM(cap.max_contratos) > 0
            THEN ROUND((SUM(COALESCE(ctr.contratos_atuais, 0))::numeric / SUM(cap.max_contratos)) * 100, 1)
            ELSE 0
          END as utilizacao_pct
        FROM cortex_core.capacity_operador cap
        LEFT JOIN (
          SELECT
            responsavel,
            produto,
            COUNT(*)::int as contratos_atuais
          FROM "Clickup".cup_contratos
          WHERE status IN ('ativo', 'onboarding', 'triagem')
          GROUP BY responsavel, produto
        ) ctr ON cap.operador = ctr.responsavel AND cap.produto = ctr.produto
        GROUP BY cap.squad, cap.produto
        ORDER BY cap.squad, cap.produto
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching capacity consolidado:", error);
      res.status(500).json({ error: "Failed to fetch capacity consolidado" });
    }
  });

  // POST /api/capacity — upsert (cria ou atualiza)
  app.post("/api/capacity", async (req, res) => {
    try {
      const validation = upsertCapacitySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid data", details: validation.error });
      }
      const { operador, produto, squad, max_contratos } = validation.data;
      const email = (req as any).user?.email || "unknown";

      const result = await db.execute(sql`
        INSERT INTO cortex_core.capacity_operador (operador, produto, squad, max_contratos, atualizado_por, atualizado_em)
        VALUES (${operador}, ${produto}, ${squad}, ${max_contratos}, ${email}, NOW())
        ON CONFLICT (operador, produto)
        DO UPDATE SET
          max_contratos = ${max_contratos},
          squad = ${squad},
          atualizado_por = ${email},
          atualizado_em = NOW()
        RETURNING *
      `);
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error upserting capacity:", error);
      res.status(500).json({ error: "Failed to upsert capacity" });
    }
  });

  // DELETE /api/capacity/:id
  app.delete("/api/capacity/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await db.execute(sql`DELETE FROM cortex_core.capacity_operador WHERE id = ${parseInt(id)}`);
      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error deleting capacity:", error);
      res.status(500).json({ error: "Failed to delete capacity" });
    }
  });
}
```

- [ ] **Step 2: Registrar rotas em `server/routes.ts`**

Adicionar import no topo:
```typescript
import { registerCapacityRoutes } from "./routes/capacity";
```

Adicionar chamada junto com os outros `register*Routes` (~linha 6855):
```typescript
registerCapacityRoutes(app, db);
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/capacity.ts server/routes.ts
git commit -m "feat(capacity): add CRUD API routes for capacity management

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Chunk 2: Frontend (Pagina + Navegacao)

### Task 3: Registrar pagina na navegacao e roteamento

**Files:**
- Modify: `shared/nav-config.ts`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Adicionar permissao em `shared/nav-config.ts`**

Dentro de `PERMISSION_KEYS.GESTAO`, adicionar:
```typescript
CAPACITY: 'gestao.capacity',
```

- [ ] **Step 2: Adicionar lazy import e rota em `client/src/App.tsx`**

Adicionar junto com os outros lazy imports:
```typescript
const Capacity = lazyWithRetry(() => import("@/pages/Capacity"));
```

Adicionar rota junto com as outras dentro do `<Switch>`:
```tsx
<Route path="/capacity" component={Capacity} />
```

- [ ] **Step 3: Commit**

```bash
git add shared/nav-config.ts client/src/App.tsx
git commit -m "feat(capacity): register capacity page in nav and routing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 4: Criar pagina de Capacity

**Files:**
- Create: `client/src/pages/Capacity.tsx`

- [ ] **Step 1: Criar `client/src/pages/Capacity.tsx`**

Seguir o padrao de paginas existentes (EvolucaoMensal, Colaboradores). A pagina tem 2 abas:

**Aba "Configuracao":**
- Select de squad (filtra operadores daquele squad)
- Select de operador (vem de `cup_contratos.responsavel` DISTINCT)
- Select de produto (vem de `/api/contratos/produtos-distintos`)
- Input numerico para max_contratos
- Botao "Salvar" que faz POST `/api/capacity`
- Tabela listando todas as capacities configuradas com botao de deletar
- Filtro por squad na tabela

**Aba "Dashboard":**
- 4 cards no topo: Capacity Total, Contratos Ativos, Vagas Livres, Utilizacao %
- Grafico de barras horizontais: utilizacao % por squad (dados de `/api/capacity/consolidado`)
- Tabela detalhada: operador, produto, squad, capacity, atuais, vagas, % (dados de `/api/capacity`)
- Cores de status: verde (<70%), amarelo (70-90%), vermelho (>90%)

Componentes UI a usar:
- `Card, CardContent, CardHeader, CardTitle` de `@/components/ui/card`
- `Tabs, TabsList, TabsTrigger, TabsContent` de `@/components/ui/tabs`
- `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` de `@/components/ui/select`
- `Input` de `@/components/ui/input`
- `Button` de `@/components/ui/button`
- `Table, TableBody, TableCell, TableHead, TableHeader, TableRow` de `@/components/ui/table`
- `Skeleton` de `@/components/ui/skeleton`
- `BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer` de `recharts`

Hooks:
- `useQuery` para GET de dados
- `useMutation` + `queryClient.invalidateQueries` para POST/DELETE
- `useSetPageInfo` para titulo da pagina
- `usePageTitle` para titulo do browser
- `useState` para filtros locais

Dark mode: todas as classes com `dark:` variant.

- [ ] **Step 2: Testar manualmente**

Reiniciar o servidor (`npm run dev`) e verificar:
1. Pagina carrega em `/capacity`
2. Selects de operador e produto carregam dados
3. Salvar capacity funciona (aparece na tabela)
4. Dashboard mostra cards e grafico
5. Dark mode funciona
6. Deletar capacity funciona

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/Capacity.tsx
git commit -m "feat(capacity): add capacity management page with config and dashboard tabs

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 5: Adicionar link na sidebar

**Files:**
- Modify: arquivo de sidebar (verificar `client/src/components/app-sidebar.tsx` ou similar)

- [ ] **Step 1: Adicionar item de menu na sidebar**

Procurar onde os itens de menu de "Gestao" sao definidos e adicionar:
```typescript
{
  title: "Capacity",
  url: "/capacity",
  icon: Gauge, // ou Users ou BarChart3 do lucide-react
  permissionKey: PERMISSION_KEYS.GESTAO.CAPACITY,
}
```

- [ ] **Step 2: Commit e push final**

```bash
git add client/src/components/app-sidebar.tsx
git commit -m "feat(capacity): add capacity link to sidebar navigation

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push
```

---

## Chunk 3: Finalizacao

### Task 6: Atualizar Obsidian e chamados

- [ ] **Step 1: Atualizar TASK-14 no Obsidian**

Marcar subtask de Implementacao como concluida. Atualizar status para `review`.

- [ ] **Step 2: Atualizar chamado #14 no DB**

```sql
UPDATE cortex_core.chamados SET status='review', atualizado_em=NOW() WHERE id=14;
```

- [ ] **Step 3: Push final**

```bash
git push
```
