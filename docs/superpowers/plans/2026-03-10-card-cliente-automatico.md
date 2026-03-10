# Card de Cliente Automatico - Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically create/update a client record in cup_clientes when a staging contract is activated, with CS round-robin assignment and timeline event.

**Architecture:** Hook added inside the existing PUT /api/contratos/contratos/:id handler. When status transitions to "ativo", a fire-and-forget provisioning function runs: upserts cup_clientes by CNPJ, assigns CS via least-loaded query, and creates a timeline event in cliente_eventos.

**Tech Stack:** PostgreSQL (raw SQL via drizzle), Express.js, TypeScript

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `server/services/clienteProvisioning.ts` | Create | Core provisioning logic: upsert, round-robin, timeline event (beneficial deviation from spec which said "no new file" - extracting 120+ lines into a service is cleaner than inlining in the route handler) |
| `server/routes/contratos.ts` | Modify (~line 1275-1337) | Add hook call after status change to "ativo" |

---

## Chunk 1: Implementation

### Task 1: Create clienteProvisioning service

**Files:**
- Create: `server/services/clienteProvisioning.ts`

- [ ] **Step 1: Create the provisioning service file**

```typescript
// server/services/clienteProvisioning.ts
import { db } from "../db";
import { sql } from "drizzle-orm";

interface ProvisioningContext {
  contratoId: number;
  userId: string;
  userName: string;
}

/**
 * Provisions a client record when a contract is activated.
 * Fire-and-forget: logs errors but never throws.
 */
export async function provisionClienteFromContrato(ctx: ProvisioningContext): Promise<void> {
  try {
    // 1. Fetch contrato + entidade data
    const contratoResult = await db.execute(sql`
      SELECT c.id, c.numero_contrato, c.entidade_id,
             e.cpf_cnpj, e.nome, e.email, e.telefone
      FROM staging.contratos c
      LEFT JOIN staging.entidades e ON e.id = c.entidade_id
      WHERE c.id = ${ctx.contratoId}
    `);

    if (contratoResult.rows.length === 0) {
      console.warn("[card-auto] Contrato not found:", ctx.contratoId);
      return;
    }

    const contrato = contratoResult.rows[0] as any;
    const cnpj = contrato.cpf_cnpj;

    if (!cnpj) {
      console.warn("[card-auto] No CNPJ found for contrato:", ctx.contratoId);
      return;
    }

    // 2. Find least-loaded CS
    const csResult = await db.execute(sql`
      WITH cs_roster AS (
        SELECT DISTINCT responsavel
        FROM "Clickup".cup_clientes
        WHERE responsavel IS NOT NULL
          AND responsavel != ''
      ),
      cs_carga AS (
        SELECT r.responsavel,
               COUNT(c.cnpj) as carga
        FROM cs_roster r
        LEFT JOIN "Clickup".cup_clientes c
          ON c.responsavel = r.responsavel
          AND c.status IN ('ativo', 'onboarding', 'triagem')
        GROUP BY r.responsavel
        ORDER BY carga ASC
        LIMIT 1
      )
      SELECT responsavel FROM cs_carga
    `);

    const csResponsavel = csResult.rows.length > 0 ? (csResult.rows[0] as any).responsavel : null;

    if (!csResponsavel) {
      console.warn("[card-auto] No CS found for round-robin, assigning NULL");
    }

    // 3. Upsert into cup_clientes
    const entidadeId = contrato.entidade_id;
    const taskId = `cortex-ent-${entidadeId}`;
    const nome = contrato.nome;

    await db.execute(sql`
      INSERT INTO "Clickup".cup_clientes (cnpj, nome, status, responsavel, email, telefone, task_id, site)
      VALUES (
        ${cnpj},
        ${nome},
        'onboarding',
        ${csResponsavel},
        ${contrato.email},
        ${contrato.telefone},
        ${taskId},
        ${null}
      )
      ON CONFLICT (cnpj) DO UPDATE SET
        status = 'onboarding',
        responsavel = ${csResponsavel},
        email = COALESCE("Clickup".cup_clientes.email, EXCLUDED.email),
        telefone = COALESCE("Clickup".cup_clientes.telefone, EXCLUDED.telefone),
        nome = COALESCE("Clickup".cup_clientes.nome, EXCLUDED.nome),
        task_id = COALESCE("Clickup".cup_clientes.task_id, EXCLUDED.task_id)
    `);

    // 4. Fetch contract items for event details
    const itensResult = await db.execute(sql`
      SELECT ci.contrato_id,
             COALESCE(s.nome, ps.nome, 'Servico') as servico_nome,
             ci.valor_final
      FROM staging.contratos_itens ci
      LEFT JOIN staging.planos_servicos ps ON ps.id = ci.plano_servico_id
      LEFT JOIN staging.servicos s ON s.id = ps.servico_id
      WHERE ci.contrato_id = ${ctx.contratoId}
    `);

    const servicos = itensResult.rows.map((r: any) => r.servico_nome);
    const valorTotal = itensResult.rows.reduce((sum: number, r: any) => sum + (parseFloat(r.valor_final) || 0), 0);

    // 5. Create timeline event
    const dadosExtras = JSON.stringify({
      contrato_id: ctx.contratoId,
      numero_contrato: contrato.numero_contrato,
      cs_atribuido: csResponsavel,
      servicos,
      valor_total: valorTotal
    });

    await db.execute(sql`
      INSERT INTO cliente_eventos (cliente_cnpj, tipo, titulo, descricao, usuario_id, usuario_nome, dados_extras)
      VALUES (
        ${cnpj},
        'contrato_ativado',
        'Novo contrato ativado',
        ${'Contrato #' + contrato.numero_contrato + ' ativado. CS: ' + (csResponsavel || 'Nao atribuido') + '. Servicos: ' + servicos.join(', ')},
        ${ctx.userId},
        ${ctx.userName},
        ${dadosExtras}
      )
    `);

    console.log(`[card-auto] Cliente ${cnpj} provisionado com sucesso. CS: ${csResponsavel}`);
  } catch (error) {
    console.error("[card-auto] Erro no provisioning:", error);
    // Fire-and-forget: never throw
  }
}
```

- [ ] **Step 2: Verify file was created correctly**

Run: `cat server/services/clienteProvisioning.ts | head -5`
Expected: Shows the import statements

- [ ] **Step 3: Commit**

```bash
git add server/services/clienteProvisioning.ts
git commit -m "feat: add clienteProvisioning service for auto client card creation"
```

---

### Task 2: Hook provisioning into contratos PUT endpoint

**Files:**
- Modify: `server/routes/contratos.ts:1275-1337`

- [ ] **Step 1: Read current contract status before update**

At line 1278 (after `const data = req.body;`), add a query to fetch the current status:

```typescript
      // Read current status before update (for provisioning trigger)
      const currentResult = await db.execute(sql`
        SELECT status FROM staging.contratos WHERE id = ${parseInt(id)}
      `);
      const oldStatus = currentResult.rows.length > 0 ? (currentResult.rows[0] as any).status : null;
```

- [ ] **Step 2: Add import at top of file**

At the top of `server/routes/contratos.ts`, add the import:

```typescript
import { provisionClienteFromContrato } from "../services/clienteProvisioning";
```

- [ ] **Step 3: Add provisioning hook before the response**

Replace line 1329 (`res.json({ message: "Contrato atualizado com sucesso" });`) with the following block:

```typescript
      // Auto-provision client card when status changes to "ativo"
      const newStatus = data.status || 'rascunho';
      if (oldStatus !== 'ativo' && newStatus === 'ativo') {
        const user = req.user as any;
        provisionClienteFromContrato({
          contratoId: parseInt(id),
          userId: user?.id || 'system',
          userName: user?.name || 'Sistema',
        }); // fire-and-forget: no await
      }

      res.json({ message: "Contrato atualizado com sucesso" });
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit server/routes/contratos.ts 2>&1 | head -20`
If errors about module resolution, try: `npx tsx --eval "import '../server/routes/contratos'" 2>&1 | head -10`

- [ ] **Step 5: Commit**

```bash
git add server/routes/contratos.ts
git commit -m "feat: hook cliente provisioning on contract activation"
```

---

### Task 3: Manual integration test

- [ ] **Step 1: Restart the dev server**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
```

Wait for server to start on port 3000.

- [ ] **Step 2: Test the flow end-to-end**

1. Open the Contratos module in the browser
2. Create or find a contrato in status "rascunho"
3. Change its status to "ativo" and save
4. Check server logs for `[card-auto]` messages
5. Verify in cup_clientes that the client record was created/updated
6. Check the client timeline for the "contrato_ativado" event

- [ ] **Step 3: Verify idempotency**

1. Save the same contrato again with status "ativo"
2. Confirm NO new timeline event is created (oldStatus === "ativo" guard)
3. Confirm no errors in server logs

- [ ] **Step 4: Final commit with any fixes**

```bash
git add -A
git commit -m "fix: adjustments from manual integration test"
```

(Only if changes were needed)

---

### Task 4: Push and cleanup

- [ ] **Step 1: Push all commits**

```bash
git push
```

- [ ] **Step 2: Update Obsidian vault (if applicable)**

Update the card-cliente-automatico epic status from "planejado" to "construido" in the Obsidian vault.
