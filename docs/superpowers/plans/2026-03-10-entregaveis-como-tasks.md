# Entregaveis como Tasks - Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-generate hierarchical deliverable tasks from contract scope via AI when a contract is activated, with full CRUD, checklist UI, progress dashboard, and overdue alerts.

**Architecture:** New table `staging.entregaveis` with recursive parent_id. A service uses OpenAI to parse `planos_servicos.escopo` into a task tree. Hook added to contract activation trigger. Frontend shows nested checklist with progress bars, dashboard cards, and overdue badges.

**Tech Stack:** PostgreSQL (recursive CTE), OpenAI gpt-4o-mini (JSON mode), Express.js, React + Tailwind + Recharts, React Query

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `server/services/entregaveisGenerator.ts` | Create | AI-powered deliverable generation from scope text |
| `server/routes/contratos.ts` | Modify | CREATE TABLE, CRUD endpoints, hook in PUT handler |
| `server/services/clienteProvisioning.ts` | Modify | Add call to entregaveis generator |
| `client/src/components/EntregaveisChecklist.tsx` | Create | Nested checklist component with progress bar |
| `client/src/components/EntregaveisDashboard.tsx` | Create | Dashboard cards with progress and alerts |
| `client/src/pages/ContratosModule.tsx` | Modify | Integrate checklist in contract detail panel |

---

## Chunk 1: Backend (Table + Service + CRUD)

### Task 1: Create entregaveis table

**Files:**
- Modify: `server/routes/contratos.ts` (in `ensureContratosTablesExist` function, after contratos_itens table creation ~line 338)

- [ ] **Step 1: Add CREATE TABLE statement**

In `server/routes/contratos.ts`, inside `ensureContratosTablesExist()`, after the `staging.contratos_itens` CREATE TABLE block (~line 338), add:

```typescript
    // Entregaveis - tasks de entrega hierarquicas
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staging.entregaveis (
        id SERIAL PRIMARY KEY,
        contrato_id INTEGER REFERENCES staging.contratos(id) ON DELETE CASCADE,
        contrato_item_id INTEGER REFERENCES staging.contratos_itens(id),
        parent_id INTEGER REFERENCES staging.entregaveis(id) ON DELETE CASCADE,
        titulo VARCHAR(255) NOT NULL,
        descricao TEXT,
        status VARCHAR(30) DEFAULT 'pendente',
        responsavel VARCHAR(255),
        prazo DATE,
        data_conclusao DATE,
        prioridade VARCHAR(20) DEFAULT 'media',
        ordem INTEGER DEFAULT 0,
        nivel INTEGER DEFAULT 0,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_entregaveis_contrato ON staging.entregaveis(contrato_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_entregaveis_parent ON staging.entregaveis(parent_id)`);
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/contratos.ts
git commit -m "feat: add staging.entregaveis table with recursive hierarchy"
```

---

### Task 2: Create entregaveisGenerator service

**Files:**
- Create: `server/services/entregaveisGenerator.ts`

- [ ] **Step 1: Create the generator service**

```typescript
// server/services/entregaveisGenerator.ts
import { db } from "../db";
import { sql } from "drizzle-orm";
import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openaiClient;
}

interface EntregavelNode {
  titulo: string;
  descricao: string;
  prioridade: string;
  subtasks: EntregavelNode[];
}

interface GenerateContext {
  contratoId: number;
}

export async function generateEntregaveisFromContrato(ctx: GenerateContext): Promise<void> {
  try {
    const openai = getOpenAI();
    if (!openai) {
      console.warn("[entregaveis] OpenAI not configured, skipping generation");
      return;
    }

    // 1. Fetch contract items with their plan scope
    const itensResult = await db.execute(sql`
      SELECT ci.id as item_id, ci.contrato_id,
             ps.nome as servico_nome, ps.escopo, ps.diretrizes
      FROM staging.contratos_itens ci
      JOIN staging.planos_servicos ps ON ps.id = ci.plano_servico_id
      WHERE ci.contrato_id = ${ctx.contratoId}
        AND ci.plano_servico_id IS NOT NULL
        AND ps.escopo IS NOT NULL
        AND ps.escopo != ''
    `);

    if (itensResult.rows.length === 0) {
      console.log("[entregaveis] No items with scope found for contrato:", ctx.contratoId);
      return;
    }

    // 2. For each item, generate entregaveis via AI
    for (const row of itensResult.rows) {
      const item = row as any;
      try {
        await generateForItem(openai, ctx.contratoId, item.item_id, item.servico_nome, item.escopo, item.diretrizes);
      } catch (err) {
        console.error(`[entregaveis] Error generating for item ${item.item_id}:`, err);
      }
    }

    console.log(`[entregaveis] Generation complete for contrato ${ctx.contratoId}`);
  } catch (error) {
    console.error("[entregaveis] Generation failed:", error);
  }
}

async function generateForItem(
  openai: OpenAI,
  contratoId: number,
  itemId: number,
  servicoNome: string,
  escopo: string,
  diretrizes: string | null
): Promise<void> {
  const prompt = `Dado o escopo e diretrizes abaixo de um servico de marketing digital contratado, gere uma lista JSON hierarquica de entregaveis necessarios para cumprir o escopo.

Cada item pode ter sub-items recursivamente. Seja concreto e pratico.

Formato JSON obrigatorio:
{
  "entregaveis": [
    {
      "titulo": "Nome da fase/entrega",
      "descricao": "O que fazer concretamente",
      "prioridade": "alta|media|baixa",
      "subtasks": [
        { "titulo": "...", "descricao": "...", "prioridade": "...", "subtasks": [] }
      ]
    }
  ]
}

Servico: ${servicoNome}
Escopo: ${escopo}
${diretrizes ? `Diretrizes: ${diretrizes}` : ''}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Voce e um especialista em gestao de projetos de marketing digital. Retorne APENAS JSON valido." },
      { role: "user", content: prompt }
    ]
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return;

  let parsed: { entregaveis: EntregavelNode[] };
  try {
    parsed = JSON.parse(content);
  } catch {
    console.error("[entregaveis] Failed to parse AI response as JSON");
    return;
  }

  if (!parsed.entregaveis || !Array.isArray(parsed.entregaveis)) return;

  // 3. Insert recursively
  await insertTree(contratoId, itemId, null, parsed.entregaveis, 0);
}

async function insertTree(
  contratoId: number,
  itemId: number,
  parentId: number | null,
  nodes: EntregavelNode[],
  nivel: number
): Promise<void> {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const result = await db.execute(sql`
      INSERT INTO staging.entregaveis (contrato_id, contrato_item_id, parent_id, titulo, descricao, prioridade, ordem, nivel)
      VALUES (${contratoId}, ${itemId}, ${parentId}, ${node.titulo}, ${node.descricao || null}, ${node.prioridade || 'media'}, ${i}, ${nivel})
      RETURNING id
    `);

    const newId = (result.rows[0] as any).id;

    if (node.subtasks && node.subtasks.length > 0) {
      await insertTree(contratoId, itemId, newId, node.subtasks, nivel + 1);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add server/services/entregaveisGenerator.ts
git commit -m "feat: add entregaveisGenerator service with AI-powered scope parsing"
```

---

### Task 3: Add CRUD endpoints for entregaveis

**Files:**
- Modify: `server/routes/contratos.ts` (add endpoints after existing contrato endpoints)

- [ ] **Step 1: Add GET endpoint (tree query)**

At the end of the contratos routes (before the closing of `registerContratosRoutes`), add:

```typescript
  // ============================================================================
  // ENTREGAVEIS - CRUD
  // ============================================================================

  // List entregaveis as flat list (frontend builds tree)
  app.get("/api/contratos/:id/entregaveis", isAuthenticated, async (req, res) => {
    try {
      const contratoId = parseInt(req.params.id);
      const result = await db.execute(sql`
        WITH RECURSIVE tree AS (
          SELECT *, 0 as depth FROM staging.entregaveis
          WHERE contrato_id = ${contratoId} AND parent_id IS NULL
          UNION ALL
          SELECT e.*, t.depth + 1
          FROM staging.entregaveis e
          JOIN tree t ON e.parent_id = t.id
        )
        SELECT * FROM tree ORDER BY depth, ordem
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching entregaveis:", error);
      res.status(500).json({ error: "Failed to fetch entregaveis" });
    }
  });
```

- [ ] **Step 2: Add POST endpoint (create manual)**

```typescript
  // Create entregavel manually
  app.post("/api/contratos/:id/entregaveis", isAuthenticated, async (req, res) => {
    try {
      const contratoId = parseInt(req.params.id);
      const { titulo, descricao, parent_id, prioridade, prazo, responsavel } = req.body;

      if (!titulo) return res.status(400).json({ error: "Titulo obrigatorio" });

      // Calculate nivel from parent
      let nivel = 0;
      if (parent_id) {
        const parentResult = await db.execute(sql`SELECT nivel FROM staging.entregaveis WHERE id = ${parent_id}`);
        if (parentResult.rows.length > 0) nivel = (parentResult.rows[0] as any).nivel + 1;
      }

      const result = await db.execute(sql`
        INSERT INTO staging.entregaveis (contrato_id, parent_id, titulo, descricao, prioridade, prazo, responsavel, nivel)
        VALUES (${contratoId}, ${parent_id || null}, ${titulo}, ${descricao || null}, ${prioridade || 'media'}, ${prazo || null}, ${responsavel || null}, ${nivel})
        RETURNING *
      `);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error creating entregavel:", error);
      res.status(500).json({ error: "Failed to create entregavel" });
    }
  });
```

- [ ] **Step 3: Add PATCH endpoint (update)**

```typescript
  // Update entregavel
  app.patch("/api/contratos/entregaveis/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { titulo, descricao, status, responsavel, prazo, prioridade, ordem } = req.body;

      const dataConclusao = status === 'concluido' ? sql`CURRENT_DATE` : sql`data_conclusao`;

      const result = await db.execute(sql`
        UPDATE staging.entregaveis SET
          titulo = COALESCE(${titulo || null}, titulo),
          descricao = COALESCE(${descricao !== undefined ? descricao : null}, descricao),
          status = COALESCE(${status || null}, status),
          responsavel = COALESCE(${responsavel !== undefined ? responsavel : null}, responsavel),
          prazo = COALESCE(${prazo || null}, prazo),
          prioridade = COALESCE(${prioridade || null}, prioridade),
          ordem = COALESCE(${ordem !== undefined ? ordem : null}, ordem),
          data_conclusao = ${status === 'concluido' ? sql`CURRENT_DATE` : sql`data_conclusao`},
          atualizado_em = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `);

      if (result.rows.length === 0) return res.status(404).json({ error: "Entregavel nao encontrado" });
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error updating entregavel:", error);
      res.status(500).json({ error: "Failed to update entregavel" });
    }
  });
```

- [ ] **Step 4: Add DELETE and regenerate endpoints**

```typescript
  // Delete entregavel (cascades to children)
  app.delete("/api/contratos/entregaveis/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.execute(sql`DELETE FROM staging.entregaveis WHERE id = ${id}`);
      res.json({ message: "Entregavel excluido" });
    } catch (error) {
      console.error("[api] Error deleting entregavel:", error);
      res.status(500).json({ error: "Failed to delete entregavel" });
    }
  });

  // Regenerate entregaveis via AI (deletes existing, generates new)
  app.post("/api/contratos/:id/gerar-entregaveis", isAuthenticated, async (req, res) => {
    try {
      const contratoId = parseInt(req.params.id);
      await db.execute(sql`DELETE FROM staging.entregaveis WHERE contrato_id = ${contratoId}`);

      const { generateEntregaveisFromContrato } = await import("../services/entregaveisGenerator");
      await generateEntregaveisFromContrato({ contratoId });

      const result = await db.execute(sql`
        SELECT * FROM staging.entregaveis WHERE contrato_id = ${contratoId} ORDER BY nivel, ordem
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error generating entregaveis:", error);
      res.status(500).json({ error: "Failed to generate entregaveis" });
    }
  });

  // Dashboard: progress per contrato
  app.get("/api/contratos/entregaveis/dashboard", isAuthenticated, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT
          e.contrato_id,
          c.numero_contrato,
          ent.nome as cliente_nome,
          COUNT(*) FILTER (WHERE e.id NOT IN (SELECT DISTINCT parent_id FROM staging.entregaveis WHERE parent_id IS NOT NULL)) as total_folhas,
          COUNT(*) FILTER (WHERE e.status = 'concluido' AND e.id NOT IN (SELECT DISTINCT parent_id FROM staging.entregaveis WHERE parent_id IS NOT NULL)) as concluidas,
          COUNT(*) FILTER (WHERE e.prazo < CURRENT_DATE AND e.status NOT IN ('concluido') AND e.prazo IS NOT NULL) as atrasadas
        FROM staging.entregaveis e
        JOIN staging.contratos c ON c.id = e.contrato_id
        LEFT JOIN staging.entidades ent ON ent.id = c.entidade_id
        GROUP BY e.contrato_id, c.numero_contrato, ent.nome
        ORDER BY atrasadas DESC, concluidas ASC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching entregaveis dashboard:", error);
      res.status(500).json({ error: "Failed to fetch dashboard" });
    }
  });
```

- [ ] **Step 5: Commit**

```bash
git add server/routes/contratos.ts
git commit -m "feat: add CRUD endpoints and dashboard for entregaveis"
```

---

### Task 4: Hook entregaveis generation into contract activation

**Files:**
- Modify: `server/routes/contratos.ts` (~line 1336-1345, where provisioning hook is)

- [ ] **Step 1: Add import and call in the activation hook**

In the PUT handler for `/api/contratos/contratos/:id`, find the provisioning hook block:

```typescript
      // Auto-provision client card when status changes to "ativo"
      const newStatus = data.status || 'rascunho';
      if (oldStatus !== 'ativo' && newStatus === 'ativo') {
```

Inside that if block, after the `provisionClienteFromContrato` call, add:

```typescript
        // Auto-generate entregaveis from contract scope
        import("../services/entregaveisGenerator").then(mod => {
          mod.generateEntregaveisFromContrato({ contratoId: parseInt(id) });
        }).catch(err => console.error("[entregaveis] Dynamic import failed:", err));
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/contratos.ts
git commit -m "feat: hook entregaveis generation on contract activation"
```

---

## Chunk 2: Frontend (Checklist + Dashboard + Alertas)

### Task 5: Create EntregaveisChecklist component

**Files:**
- Create: `client/src/components/EntregaveisChecklist.tsx`

- [ ] **Step 1: Create the checklist component**

```typescript
// client/src/components/EntregaveisChecklist.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronRight, ChevronDown, Plus, Trash2, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Entregavel {
  id: number;
  contrato_id: number;
  contrato_item_id: number | null;
  parent_id: number | null;
  titulo: string;
  descricao: string | null;
  status: string;
  responsavel: string | null;
  prazo: string | null;
  data_conclusao: string | null;
  prioridade: string;
  ordem: number;
  nivel: number;
  depth: number;
}

interface TreeNode extends Entregavel {
  children: TreeNode[];
}

function buildTree(items: Entregavel[]): TreeNode[] {
  const map = new Map<number, TreeNode>();
  const roots: TreeNode[] = [];

  for (const item of items) {
    map.set(item.id, { ...item, children: [] });
  }

  for (const item of items) {
    const node = map.get(item.id)!;
    if (item.parent_id && map.has(item.parent_id)) {
      map.get(item.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function countLeaves(node: TreeNode): { total: number; done: number } {
  if (node.children.length === 0) {
    return { total: 1, done: node.status === "concluido" ? 1 : 0 };
  }
  return node.children.reduce(
    (acc, child) => {
      const c = countLeaves(child);
      return { total: acc.total + c.total, done: acc.done + c.done };
    },
    { total: 0, done: 0 }
  );
}

const prioridadeColors: Record<string, string> = {
  alta: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  media: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  baixa: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

function EntregavelNode({
  node,
  onToggle,
  onDelete,
}: {
  node: TreeNode;
  onToggle: (id: number, status: string) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isOverdue = node.prazo && new Date(node.prazo) < new Date() && node.status !== "concluido";
  const { total, done } = countLeaves(node);
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="ml-0">
      <div className={`flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800/50 group ${isOverdue ? "bg-red-50/50 dark:bg-red-900/10" : ""}`}>
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="p-0.5 text-gray-400">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <span className="w-5" />
        )}

        <Checkbox
          checked={node.status === "concluido"}
          onCheckedChange={(checked) =>
            onToggle(node.id, checked ? "concluido" : "pendente")
          }
        />

        <span className={`flex-1 text-sm ${node.status === "concluido" ? "line-through text-gray-400 dark:text-zinc-500" : "text-gray-900 dark:text-white"}`}>
          {node.titulo}
        </span>

        {isOverdue && <AlertTriangle className="w-4 h-4 text-red-500" />}

        {hasChildren && (
          <span className="text-xs text-gray-400 dark:text-zinc-500">{done}/{total}</span>
        )}

        <Badge variant="outline" className={`text-[10px] ${prioridadeColors[node.prioridade] || ""}`}>
          {node.prioridade}
        </Badge>

        {node.prazo && (
          <span className={`text-xs ${isOverdue ? "text-red-500 font-medium" : "text-gray-400 dark:text-zinc-500"}`}>
            {new Date(node.prazo).toLocaleDateString("pt-BR")}
          </span>
        )}

        <button
          onClick={() => onDelete(node.id)}
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {hasChildren && expanded && (
        <div className="ml-6 border-l border-gray-200 dark:border-zinc-700 pl-2">
          {node.children.map((child) => (
            <EntregavelNode key={child.id} node={child} onToggle={onToggle} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

export function EntregaveisChecklist({ contratoId }: { contratoId: number }) {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState("");

  const { data: entregaveis = [], isLoading } = useQuery<Entregavel[]>({
    queryKey: ["/api/contratos", contratoId, "entregaveis"],
    queryFn: () => fetch(`/api/contratos/${contratoId}/entregaveis`).then((r) => r.json()),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      fetch(`/api/contratos/entregaveis/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/contratos", contratoId, "entregaveis"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/contratos/entregaveis/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/contratos", contratoId, "entregaveis"] }),
  });

  const createMutation = useMutation({
    mutationFn: (titulo: string) =>
      fetch(`/api/contratos/${contratoId}/entregaveis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo }),
      }),
    onSuccess: () => {
      setNewTitle("");
      queryClient.invalidateQueries({ queryKey: ["/api/contratos", contratoId, "entregaveis"] });
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => fetch(`/api/contratos/${contratoId}/gerar-entregaveis`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/contratos", contratoId, "entregaveis"] }),
  });

  const tree = buildTree(entregaveis);
  const allLeaves = entregaveis.filter((e) => !entregaveis.some((c) => c.parent_id === e.id));
  const doneLeaves = allLeaves.filter((e) => e.status === "concluido");
  const overdueCount = entregaveis.filter((e) => e.prazo && new Date(e.prazo) < new Date() && e.status !== "concluido").length;
  const progress = allLeaves.length > 0 ? Math.round((doneLeaves.length / allLeaves.length) * 100) : 0;

  if (isLoading) return <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Entregaveis</h3>
          <span className="text-xs text-gray-400">{doneLeaves.length}/{allLeaves.length}</span>
          {overdueCount > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              {overdueCount} atrasado{overdueCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="text-xs"
        >
          {generateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
          Gerar via IA
        </Button>
      </div>

      <Progress value={progress} className="h-2" />

      {tree.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-4">
          Nenhum entregavel. Clique em "Gerar via IA" ou adicione manualmente.
        </p>
      ) : (
        <div className="space-y-0.5">
          {tree.map((node) => (
            <EntregavelNode
              key={node.id}
              node={node}
              onToggle={(id, status) => toggleMutation.mutate({ id, status })}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-zinc-700">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Novo entregavel..."
          className="text-sm"
          onKeyDown={(e) => e.key === "Enter" && newTitle.trim() && createMutation.mutate(newTitle.trim())}
        />
        <Button
          size="sm"
          onClick={() => newTitle.trim() && createMutation.mutate(newTitle.trim())}
          disabled={!newTitle.trim() || createMutation.isPending}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/EntregaveisChecklist.tsx
git commit -m "feat: add EntregaveisChecklist component with nested tree UI"
```

---

### Task 6: Create EntregaveisDashboard component

**Files:**
- Create: `client/src/components/EntregaveisDashboard.tsx`

- [ ] **Step 1: Create the dashboard component**

```typescript
// client/src/components/EntregaveisDashboard.tsx
import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

interface DashboardItem {
  contrato_id: number;
  numero_contrato: string;
  cliente_nome: string | null;
  total_folhas: string;
  concluidas: string;
  atrasadas: string;
}

export function EntregaveisDashboard() {
  const { data: items = [], isLoading } = useQuery<DashboardItem[]>({
    queryKey: ["/api/contratos/entregaveis/dashboard"],
    queryFn: () => fetch("/api/contratos/entregaveis/dashboard").then((r) => r.json()),
  });

  if (isLoading) return <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Carregando dashboard...</div>;

  if (items.length === 0) return <p className="text-sm text-gray-400 text-center py-8">Nenhum contrato com entregaveis.</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => {
        const total = parseInt(item.total_folhas) || 0;
        const done = parseInt(item.concluidas) || 0;
        const overdue = parseInt(item.atrasadas) || 0;
        const progress = total > 0 ? Math.round((done / total) * 100) : 0;

        return (
          <div key={item.contrato_id} className="p-4 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{item.cliente_nome || "Sem cliente"}</p>
                <p className="text-xs text-gray-400">#{item.numero_contrato}</p>
              </div>
              {overdue > 0 ? (
                <Badge variant="destructive" className="text-[10px]">
                  <AlertTriangle className="w-3 h-3 mr-1" />{overdue} atrasado{overdue > 1 ? "s" : ""}
                </Badge>
              ) : progress === 100 ? (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-[10px]">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Completo
                </Badge>
              ) : null}
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-gray-400">
              <span>{done}/{total} entregaveis</span>
              <span>{progress}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/EntregaveisDashboard.tsx
git commit -m "feat: add EntregaveisDashboard component with progress cards"
```

---

### Task 7: Integrate checklist into ContratosModule detail panel

**Files:**
- Modify: `client/src/pages/ContratosModule.tsx`

- [ ] **Step 1: Add import at top of file**

```typescript
import { EntregaveisChecklist } from "@/components/EntregaveisChecklist";
```

- [ ] **Step 2: Find the contract detail panel and add the checklist**

In ContratosModule.tsx, find the section where `contratoDetail` is displayed (around line ~1933 where `{contratoDetail && (`). Inside the detail panel, after the existing content (services list, values, etc.), add a new section:

Look for the closing of the detail content area and add before it:

```typescript
                    {/* Entregaveis section */}
                    <div className="mt-6 pt-4 border-t border-gray-200 dark:border-zinc-700">
                      <EntregaveisChecklist contratoId={contratoDetail.id} />
                    </div>
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/ContratosModule.tsx
git commit -m "feat: integrate EntregaveisChecklist into contract detail panel"
```

---

### Task 8: Manual integration test and push

- [ ] **Step 1: Restart dev server and test**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
```

Test checklist:
1. Open Contratos module
2. Click on a contract to open detail
3. Verify "Entregaveis" section appears with "Gerar via IA" button
4. Click "Gerar via IA" - should call OpenAI and populate tree
5. Toggle checkboxes - should update status
6. Add manual entregavel via input
7. Delete an entregavel

- [ ] **Step 2: Push all commits**

```bash
git push
```

- [ ] **Step 3: Update Obsidian vault**

Update epic `entregaveis-como-tasks` from planejado to em-andamento or concluido.
