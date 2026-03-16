# Integração Conta Azul API — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Enviar para Conta Azul" button in contract details that creates a person and generates accounts receivable in the Conta Azul ERP via API.

**Architecture:** New backend route module (`server/routes/contaazul.ts`) with auth service (`server/services/contaAzulAuth.ts`). Frontend button added directly in the existing `ContratosModule.tsx` detail dialog alongside existing action buttons.

**Tech Stack:** Express routes with raw SQL, fetch for external API calls, React Query mutations, Tailwind + shadcn UI components.

**Spec:** `docs/superpowers/specs/2026-03-16-integracao-contaazul-api-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `server/services/contaAzulAuth.ts` | Create | OAuth2 token management (get, refresh, persist) |
| `server/routes/contaazul.ts` | Create | Endpoints: enviar contrato, buscar/criar pessoa, criar conta a receber |
| `server/routes.ts` | Modify (2 lines) | Import + register new route module |
| `client/src/pages/ContratosModule.tsx` | Modify | Add mutation + button in detail dialog header (inline, follows existing pattern — all mutations/buttons are inline in this file) |

---

## Chunk 1: Backend Auth Service + DB Migration

### Task 1: Create Conta Azul Auth Service

**Files:**
- Create: `server/services/contaAzulAuth.ts`

- [ ] **Step 1: Create the auth service file**

```typescript
// server/services/contaAzulAuth.ts
import { db } from "../db";
import { sql } from "drizzle-orm";

const CONTAAZUL_BASE_URL = "https://api-v2.contaazul.com";

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

function getEnvOrThrow(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Environment variable ${name} is required`);
  return val;
}

export async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  // Try to get refresh token from DB first, then env
  let refreshToken: string;
  try {
    const result = await db.execute(sql`
      SELECT value FROM cortex_core.system_settings
      WHERE key = 'contaazul_refresh_token'
      LIMIT 1
    `);
    refreshToken = (result.rows[0] as any)?.value || getEnvOrThrow("CONTAAZUL_REFRESH_TOKEN");
  } catch {
    refreshToken = getEnvOrThrow("CONTAAZUL_REFRESH_TOKEN");
  }

  const clientId = getEnvOrThrow("CONTAAZUL_CLIENT_ID");
  const clientSecret = getEnvOrThrow("CONTAAZUL_CLIENT_SECRET");

  const response = await fetch("https://api.contaazul.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Conta Azul auth failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;

  // Persist new refresh token if rotated
  if (data.refresh_token && data.refresh_token !== refreshToken) {
    try {
      await db.execute(sql`
        INSERT INTO cortex_core.system_settings (key, value, updated_at)
        VALUES ('contaazul_refresh_token', ${data.refresh_token}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = ${data.refresh_token}, updated_at = NOW()
      `);
    } catch (err) {
      console.error("[contaazul] Failed to persist refresh token:", err);
    }
  }

  return cachedToken!;
}

/**
 * Make an authenticated request to the Conta Azul API.
 * Handles 401 by refreshing the token once and retrying.
 */
export async function contaAzulFetch(
  method: string,
  path: string,
  body?: unknown
): Promise<Response> {
  let token = await getAccessToken();

  let res = await fetch(`${CONTAAZUL_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // If 401, force refresh and retry once
  if (res.status === 401) {
    cachedToken = null;
    tokenExpiresAt = 0;
    token = await getAccessToken();

    res = await fetch(`${CONTAAZUL_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  return res;
}

export { CONTAAZUL_BASE_URL };
```

- [ ] **Step 2: Ensure system_settings table exists**

Add the following migration in the `initContaAzulRoutes` function (Task 2). The `cortex_core.system_settings` table may not exist yet. We'll create it IF NOT EXISTS:

```sql
CREATE TABLE IF NOT EXISTS cortex_core.system_settings (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

- [ ] **Step 3: Commit**

```bash
git add server/services/contaAzulAuth.ts
git commit -m "feat(contaazul): add OAuth2 auth service with token refresh and persistence

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Create Backend Route Module

**Files:**
- Create: `server/routes/contaazul.ts`
- Modify: `server/routes.ts` (lines 27, 7128 area — add import and register call)

- [ ] **Step 1: Create the route module with DB migrations and helper functions**

```typescript
// server/routes/contaazul.ts
import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { isAuthenticated } from "../auth/middleware";
import { contaAzulFetch } from "../services/contaAzulAuth";

/**
 * Sanitize CPF/CNPJ: remove dots, dashes, slashes, keep only digits
 */
function sanitizeCpfCnpj(value: string): string {
  return value.replace(/[.\-\/]/g, "");
}

/**
 * Map staging.entidades row → Conta Azul API person payload
 */
function mapEntidadeToPessoa(entidade: any) {
  const tipoPessoa = entidade.tipo_pessoa === "fisica" ? "Física" : "Jurídica";
  const docSanitizado = sanitizeCpfCnpj(entidade.cpf_cnpj);

  const payload: any = {
    nome: entidade.nome,
    tipo_pessoa: tipoPessoa,
    ativo: true,
    perfis: [],
  };

  // Document field depends on type
  if (tipoPessoa === "Jurídica") {
    payload.cnpj = docSanitizado;
  } else {
    payload.cpf = docSanitizado;
  }

  // Optional fields
  if (entidade.email) payload.email = entidade.email;
  if (entidade.telefone) payload.telefone_comercial = entidade.telefone;

  // Address
  if (entidade.endereco || entidade.cidade) {
    payload.enderecos = [{
      logradouro: entidade.endereco || "",
      numero: entidade.numero || "",
      complemento: entidade.complemento || "",
      bairro: entidade.bairro || "",
      cidade: entidade.cidade || "",
      estado: entidade.estado || "",
      cep: entidade.cep || "",
      pais: "Brasil",
    }];
  }

  // Billing contact
  if (entidade.email_cobranca) {
    payload.contato_cobranca_faturamento = {
      emails: [entidade.email_cobranca],
    };
  }

  // Profiles
  if (entidade.eh_cliente) payload.perfis.push({ tipo_perfil: "Cliente" });
  if (entidade.eh_fornecedor) payload.perfis.push({ tipo_perfil: "Fornecedor" });
  if (payload.perfis.length === 0) payload.perfis.push({ tipo_perfil: "Cliente" });

  return payload;
}

/**
 * Calculate installment dates for recurring items
 */
function calcularParcelas(
  item: any,
  contrato: any,
  diaVencimento: number
): Array<{ data_vencimento: string; valor: number }> {
  const valor = Number(item.valor_final) || Number(item.valor_total) || 0;
  if (valor <= 0) return [];

  const modalidade = (item.modalidade || "").toLowerCase();

  if (modalidade === "pontual") {
    const dataBase = contrato.data_inicio_cobranca_pontuais || contrato.data_inicio_pontuais;
    if (!dataBase) return [];
    const d = new Date(dataBase);
    d.setDate(diaVencimento);
    return [{ data_vencimento: d.toISOString().split("T")[0], valor }];
  }

  // Recorrente
  let numParcelas = Number(item.num_parcelas) || 0;
  if (numParcelas <= 0) {
    // Calculate from dates
    const inicio = contrato.data_inicio_cobranca_recorrentes || contrato.data_inicio_recorrentes;
    const fim = item.data_fim;
    if (inicio && fim) {
      const dInicio = new Date(inicio);
      const dFim = new Date(fim);
      numParcelas = Math.ceil(
        (dFim.getFullYear() - dInicio.getFullYear()) * 12 +
        (dFim.getMonth() - dInicio.getMonth()) + 1
      );
    }
    if (numParcelas <= 0) numParcelas = 12; // Default
  }

  const dataBase = contrato.data_inicio_cobranca_recorrentes || contrato.data_inicio_recorrentes;
  if (!dataBase) return [];

  const parcelas: Array<{ data_vencimento: string; valor: number }> = [];
  const d = new Date(dataBase);

  for (let i = 0; i < numParcelas; i++) {
    const parcDate = new Date(d.getFullYear(), d.getMonth() + i, diaVencimento);
    parcelas.push({
      data_vencimento: parcDate.toISOString().split("T")[0],
      valor,
    });
  }

  return parcelas;
}

export function registerContaAzulRoutes(app: Express) {

  // Init: ensure new columns exist
  (async () => {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS cortex_core.system_settings (
          key VARCHAR(255) PRIMARY KEY,
          value TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await db.execute(sql`
        ALTER TABLE staging.entidades ADD COLUMN IF NOT EXISTS id_conta_azul VARCHAR(255)
      `);
      await db.execute(sql`
        ALTER TABLE staging.contratos ADD COLUMN IF NOT EXISTS id_conta_azul_receber VARCHAR(255)
      `);
      await db.execute(sql`
        ALTER TABLE staging.contratos ADD COLUMN IF NOT EXISTS data_envio_conta_azul TIMESTAMP
      `);
      console.log("[contaazul] Migrations applied successfully");
    } catch (err) {
      console.error("[contaazul] Migration error:", err);
    }
  })();

  /**
   * POST /api/contaazul/enviar/:contratoId
   * Main endpoint: find/create person in CA + create accounts receivable
   */
  app.post("/api/contaazul/enviar/:contratoId", isAuthenticated, async (req, res) => {
    const contratoId = parseInt(req.params.contratoId);
    if (isNaN(contratoId)) {
      return res.status(400).json({ error: "ID de contrato inválido" });
    }

    try {
      // 1. Fetch contract + entity with FOR UPDATE lock
      const contratoResult = await db.execute(sql`
        SELECT c.*,
               e.nome as entidade_nome, e.tipo_pessoa, e.cpf_cnpj, e.email, e.telefone,
               e.email_cobranca, e.endereco, e.numero, e.complemento,
               e.bairro, e.cidade, e.estado, e.cep, e.eh_cliente, e.eh_fornecedor,
               e.id_conta_azul, e.id as entidade_id_real
        FROM staging.contratos c
        JOIN staging.entidades e ON e.id = c.entidade_id
        WHERE c.id = ${contratoId}
        FOR UPDATE OF c
      `);

      if (contratoResult.rows.length === 0) {
        return res.status(404).json({ error: "Contrato não encontrado" });
      }

      const contrato = contratoResult.rows[0] as any;

      // 2. Validate preconditions
      if (!contrato.documento_assinado) {
        return res.status(400).json({ error: "Contrato ainda não foi assinado" });
      }
      if (!contrato.cpf_cnpj) {
        return res.status(400).json({ error: "Entidade não possui CPF/CNPJ cadastrado" });
      }
      if (contrato.id_conta_azul_receber) {
        return res.status(400).json({ error: "Contrato já foi enviado para o Conta Azul" });
      }

      // Validate CPF/CNPJ format
      const docSanitizado = sanitizeCpfCnpj(contrato.cpf_cnpj);
      if (contrato.tipo_pessoa === "juridica" && docSanitizado.length !== 14) {
        return res.status(400).json({ error: `CNPJ inválido (${docSanitizado.length} dígitos, esperado 14)` });
      }
      if (contrato.tipo_pessoa === "fisica" && docSanitizado.length !== 11) {
        return res.status(400).json({ error: `CPF inválido (${docSanitizado.length} dígitos, esperado 11)` });
      }

      // 3. Find or create person in Conta Azul
      let pessoaIdCA = contrato.id_conta_azul;

      if (!pessoaIdCA) {
        // Search by document
        const searchRes = await contaAzulFetch("GET", `/v1/pessoas?documento=${docSanitizado}`);

        if (searchRes.ok) {
          const searchData = await searchRes.json();
          // API returns array or paginated result
          const pessoas = Array.isArray(searchData) ? searchData : (searchData.data || []);
          if (pessoas.length > 0) {
            pessoaIdCA = pessoas[0].id;
          }
        }

        if (!pessoaIdCA) {
          // Create new person
          const entidadeObj = {
            nome: contrato.entidade_nome,
            tipo_pessoa: contrato.tipo_pessoa,
            cpf_cnpj: contrato.cpf_cnpj,
            email: contrato.email,
            telefone: contrato.telefone,
            email_cobranca: contrato.email_cobranca,
            endereco: contrato.endereco,
            numero: contrato.numero,
            complemento: contrato.complemento,
            bairro: contrato.bairro,
            cidade: contrato.cidade,
            estado: contrato.estado,
            cep: contrato.cep,
            eh_cliente: contrato.eh_cliente,
            eh_fornecedor: contrato.eh_fornecedor,
          };

          const payload = mapEntidadeToPessoa(entidadeObj);
          const createRes = await contaAzulFetch("POST", "/v1/pessoas", payload);

          if (!createRes.ok) {
            const errBody = await createRes.text();
            // Log failure
            await db.execute(sql`
              INSERT INTO sync_logs (integration, operation, status, details, created_at)
              VALUES ('conta_azul', 'criar_pessoa', 'erro', ${JSON.stringify({ contratoId, error: errBody })}, NOW())
            `);
            return res.status(createRes.status === 400 ? 400 : 502).json({
              error: "Erro ao criar pessoa no Conta Azul",
              details: errBody,
            });
          }

          const createData = await createRes.json();
          pessoaIdCA = createData.id;
        }

        // Save the CA person ID on the entity
        await db.execute(sql`
          UPDATE staging.entidades SET id_conta_azul = ${pessoaIdCA} WHERE id = ${contrato.entidade_id_real}
        `);
      }

      // 4. Fetch contract items + billing config
      const itensResult = await db.execute(sql`
        SELECT ci.*, cf.dia_vencimento
        FROM staging.contratos_itens ci
        LEFT JOIN staging.clientes_faturamento cf ON cf.cliente_id = ${contrato.entidade_id_real}
        WHERE ci.contrato_id = ${contratoId}
      `);

      const diaVencimento = (itensResult.rows[0] as any)?.dia_vencimento || 10;
      const itens = itensResult.rows as any[];

      // Build all installments
      const todasParcelas: Array<{ data_vencimento: string; valor: number }> = [];
      for (const item of itens) {
        const parcelas = calcularParcelas(item, contrato, diaVencimento);
        todasParcelas.push(...parcelas);
      }

      if (todasParcelas.length === 0) {
        return res.status(400).json({ error: "Nenhuma parcela gerada — verifique os itens e datas do contrato" });
      }

      // 5. Create accounts receivable in CA
      const receberPayload = {
        id_cliente: pessoaIdCA,
        descricao: `Contrato ${contrato.numero_contrato}`,
        parcelas: todasParcelas,
      };

      const receberRes = await contaAzulFetch(
        "POST",
        "/v1/financeiro/eventos-financeiros/contas-a-receber",
        receberPayload
      );

      if (!receberRes.ok) {
        const errBody = await receberRes.text();
        await db.execute(sql`
          INSERT INTO sync_logs (integration, operation, status, details, created_at)
          VALUES ('conta_azul', 'criar_receber', 'erro', ${JSON.stringify({ contratoId, pessoaIdCA, error: errBody })}, NOW())
        `);
        return res.status(receberRes.status === 400 ? 400 : 502).json({
          error: "Pessoa criada/vinculada, mas erro ao gerar conta a receber no Conta Azul",
          details: errBody,
          pessoaIdCA,
        });
      }

      const receberData = await receberRes.json();
      const receberIdCA = receberData.id;

      // 6. Update contract in DB (transaction)
      await db.execute(sql`
        UPDATE staging.contratos SET
          id_conta_azul_receber = ${receberIdCA},
          data_envio_conta_azul = NOW(),
          status_faturamento = 'enviado_ca'
        WHERE id = ${contratoId}
      `);

      // 7. Audit log
      await db.execute(sql`
        INSERT INTO sync_logs (integration, operation, status, details, created_at)
        VALUES ('conta_azul', 'enviar_contrato', 'sucesso', ${JSON.stringify({
          contratoId,
          pessoaIdCA,
          receberIdCA,
          numParcelas: todasParcelas.length,
        })}, NOW())
      `);

      res.json({
        success: true,
        pessoaId: pessoaIdCA,
        receberId: receberIdCA,
        numParcelas: todasParcelas.length,
        message: "Cliente vinculado e conta a receber criada no Conta Azul",
      });

    } catch (error: any) {
      console.error("[contaazul] Error sending to Conta Azul:", error);

      // Audit log for unexpected errors
      try {
        await db.execute(sql`
          INSERT INTO sync_logs (integration, operation, status, details, created_at)
          VALUES ('conta_azul', 'enviar_contrato', 'erro', ${JSON.stringify({ contratoId, error: error.message })}, NOW())
        `);
      } catch { /* ignore logging errors */ }

      res.status(500).json({ error: "Erro interno ao enviar para o Conta Azul", details: error.message });
    }
  });
}
```

- [ ] **Step 2: Register the route module in routes.ts**

Add import at top of `server/routes.ts` (near line 27, alongside other route imports):

```typescript
import { registerContaAzulRoutes } from "./routes/contaazul";
```

Add registration call in `registerRoutes()` (near line 7128, alongside other registrations):

```typescript
registerContaAzulRoutes(app);
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/contaazul.ts server/routes.ts
git commit -m "feat(contaazul): add backend endpoint to sync contract to Conta Azul

Creates person (or links existing) and generates accounts receivable
via Conta Azul Open API v2. Includes validation, idempotency, audit logging.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Chunk 2: Frontend Button + Integration

### Task 3: Add Enviar para Conta Azul Button in Contract Detail

**Files:**
- Modify: `client/src/pages/ContratosModule.tsx` (3 edits)

- [ ] **Step 1: Add the mutation (near line 1733, after `verificarStatusMutation`)**

Insert after the `verificarStatusMutation` definition (after line 1733):

```typescript
  const enviarContaAzulMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/contaazul/enviar/${id}`);
      return await res.json();
    },
    onSuccess: (data: { message?: string; numParcelas?: number }) => {
      toast({
        title: "Enviado para Conta Azul",
        description: data.message || `${data.numParcelas || 0} parcelas geradas com sucesso`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/contratos/contratos'] });
      if (selectedContrato) {
        queryClient.invalidateQueries({ queryKey: ['/api/contratos/contratos', selectedContrato.id] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar para Conta Azul",
        description: error.message || "Verifique os dados do contrato e tente novamente",
        variant: "destructive",
      });
    },
  });
```

- [ ] **Step 2: Add the button in the detail dialog header (after "Verificar Status" button, before the Badge — around line 2044)**

Insert after the closing `)}` of the "Verificar Status" conditional block (line 2044) and before the `<Badge` (line 2045):

```tsx
                    {contratoDetail.documento_assinado && (
                      <Button
                        variant={contratoDetail.id_conta_azul_receber ? "outline" : "default"}
                        size="sm"
                        onClick={() => enviarContaAzulMutation.mutate(contratoDetail.id)}
                        disabled={enviarContaAzulMutation.isPending || !!contratoDetail.id_conta_azul_receber}
                        data-testid="button-enviar-conta-azul"
                        className={contratoDetail.id_conta_azul_receber ? "bg-green-500/10 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-500/30 dark:border-green-900/50 cursor-default" : ""}
                      >
                        {enviarContaAzulMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : contratoDetail.id_conta_azul_receber ? (
                          <CheckCircle className="h-4 w-4 mr-2" />
                        ) : (
                          <Send className="h-4 w-4 mr-2" />
                        )}
                        {contratoDetail.id_conta_azul_receber ? "Enviado ao CA" : "Enviar p/ Conta Azul"}
                      </Button>
                    )}
```

- [ ] **Step 3: Add CheckCircle to lucide-react imports (line 1, where other icons are imported)**

Find the existing lucide-react import at the top of the file and add `CheckCircle` to it. The import already includes `Send`, `Loader2`, and other icons — just add `CheckCircle` to the destructured list.

Example — if current import is:
```typescript
import { FileText, Plus, Send, Loader2, ... } from "lucide-react";
```
Change to:
```typescript
import { FileText, Plus, Send, Loader2, CheckCircle, ... } from "lucide-react";
```

- [ ] **Step 4: Verify the contract detail query returns the new fields**

Check the backend endpoint that fetches contract details (`GET /api/contratos/contratos/:id` in `server/routes/contratos.ts`). It uses `SELECT c.*, e.*` which will automatically include `id_conta_azul_receber` and `documento_assinado` since we used `c.*`. No changes needed if the query uses `*`.

If it does NOT return these fields, add them to the SELECT. Check line ~1187 in `server/routes/contratos.ts`.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/ContratosModule.tsx
git commit -m "feat(contaazul): add 'Enviar para Conta Azul' button in contract detail

Shows when contract is signed. Creates person + accounts receivable
in Conta Azul. Shows 'Enviado ao CA' badge after successful send.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 4: Add Environment Variables + Final Push

**Files:**
- Modify: `.env` (add 3 variables)

- [ ] **Step 1: Add env variables to .env**

Append to the `.env` file:

```env
# Conta Azul API Integration
CONTAAZUL_CLIENT_ID=
CONTAAZUL_CLIENT_SECRET=
CONTAAZUL_REFRESH_TOKEN=
```

> **Note:** The actual values need to be filled in by the team. Leave empty for now — the auth service will throw a clear error if they're missing.

- [ ] **Step 2: Restart dev server and verify no crashes**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev
```

Check console for:
- `[contaazul] Migrations applied successfully` — DB columns created
- No crash on startup (env vars are only checked when the endpoint is called)

- [ ] **Step 3: Final commit + push**

```bash
git add -A
git commit -m "feat(contaazul): add env vars placeholder for Conta Azul API credentials

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push
```

---

## Testing Checklist

After implementation, manually test:

1. **Without env vars** — clicking button should show error toast about missing credentials
2. **With env vars** — on a contract with `documento_assinado = true`:
   - Button should appear and be enabled
   - Click → loading → success toast with parcelas count
   - Button changes to "Enviado ao CA" (green, disabled)
   - Refreshing page shows "Enviado ao CA" persisted
3. **Already sent** — button shows "Enviado ao CA" (disabled, green badge)
4. **Unsigned contract** — button should not appear
5. **Contract without CNPJ** — should show validation error toast
6. **Dark mode** — verify button looks correct in both themes
