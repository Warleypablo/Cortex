# Phase 4: Secrets Removal & Full Security Hardening

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all hardcoded secrets, fix remaining SQL injections, harden auth endpoints, and update vulnerable dependencies — making the repo safe for public exposure.

**Architecture:** Replace all hardcoded credential fallbacks with required environment variables that throw on startup if missing. Convert remaining `sql.raw()` with user input to parameterized queries. Remove/protect debug endpoints. Update `.gitignore` and untrack sensitive files.

**Tech Stack:** Node.js, Express, Drizzle ORM, PostgreSQL, bcryptjs

---

## Chunk 1: Secrets Removal

### Task 1: Remove hardcoded DB credentials from server/index.ts

**Files:**
- Modify: `server/index.ts:213-220` (Meta Ads pool)
- Modify: `server/index.ts:252-259` (Google Ads pool)

- [ ] **Step 1: Create helper function for required env vars**

Add at top of `server/index.ts` (after imports):

```typescript
function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Environment variable ${name} is required`);
  return val;
}
```

- [ ] **Step 2: Replace Meta Ads pool (line ~213)**

Replace:
```typescript
const pool = new Pool({
  host: process.env.DATABASE_HOST || "***REMOVED***",
  port: 5432,
  database: "dados_turbo",
  user: "postgres",
  password: process.env.DATABASE_PASSWORD || "***REMOVED***",
  ssl: false,
});
```

With:
```typescript
const pool = new Pool({
  host: requireEnv("DATABASE_HOST"),
  port: 5432,
  database: process.env.DATABASE_NAME || "dados_turbo",
  user: process.env.DATABASE_USER || "postgres",
  password: requireEnv("DATABASE_PASSWORD"),
  ssl: process.env.DB_SSL_REJECT_UNAUTHORIZED === "false" ? false : { rejectUnauthorized: false },
});
```

- [ ] **Step 3: Replace Google Ads pool (line ~252)**

Same replacement pattern as Step 2.

- [ ] **Step 4: Harden session secret**

Replace:
```typescript
secret: process.env.SESSION_SECRET || "development-secret-change-in-production",
```

With:
```typescript
secret: requireEnv("SESSION_SECRET"),
```

Also remove the `NODE_ENV === 'production'` guard above (lines 59-61) since `requireEnv` already handles it.

- [ ] **Step 5: Commit**

```bash
git add server/index.ts
git commit -m "fix(security): remove hardcoded DB credentials and session secret from server/index.ts"
```

---

### Task 2: Remove hardcoded DB credentials from server/routes.ts

**Files:**
- Modify: `server/routes.ts:6452-6459` (Meta Ads sync endpoint pool)
- Modify: `server/routes.ts:6504-6511` (Google Ads sync endpoint pool)

- [ ] **Step 1: Add requireEnv helper at top of routes.ts**

Add the same `requireEnv` helper or import it from a shared location.

- [ ] **Step 2: Replace both Pool instantiations**

Replace both pool configs (lines ~6452 and ~6504) with the same pattern from Task 1 Step 2.

- [ ] **Step 3: Commit**

```bash
git add server/routes.ts
git commit -m "fix(security): remove hardcoded DB credentials from routes.ts sync endpoints"
```

---

### Task 3: Remove hardcoded DB credentials from scripts/

**Files:**
- Modify: `scripts/scan-nfs.ts:9-16`
- Modify: `scripts/sync-meta-ads.ts:16-23`

- [ ] **Step 1: Fix scan-nfs.ts**

Replace:
```typescript
const pool = new Pool({
  host: "***REMOVED***",
  port: 5432,
  database: "dados_turbo",
  user: "postgres",
  password: "***REMOVED***",
  ssl: false,
});
```

With:
```typescript
import { config } from 'dotenv';
config({ path: '.env' });

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Environment variable ${name} is required. Check your .env file.`);
  return val;
}

const pool = new Pool({
  host: requireEnv("DATABASE_HOST"),
  port: 5432,
  database: process.env.DATABASE_NAME || "dados_turbo",
  user: process.env.DATABASE_USER || "postgres",
  password: requireEnv("DATABASE_PASSWORD"),
  ssl: process.env.DB_SSL_REJECT_UNAUTHORIZED === "false" ? false : { rejectUnauthorized: false },
});
```

- [ ] **Step 2: Fix sync-meta-ads.ts**

Same pattern — replace the hardcoded fallback password.

- [ ] **Step 3: Commit**

```bash
git add scripts/scan-nfs.ts scripts/sync-meta-ads.ts
git commit -m "fix(security): remove hardcoded DB credentials from standalone scripts"
```

---

### Task 4: Remove hardcoded Assinafy API keys

**Files:**
- Modify: `server/scripts/importAssinafy.ts:24-35`
- Modify: `server/scripts/updateAssinafy.ts:6-12`

- [ ] **Step 1: Fix importAssinafy.ts**

Replace the hardcoded `account_id` and `api_key` values with env var references:

```typescript
const accountId = process.env.ASSINAFY_ACCOUNT_ID;
const apiKey = process.env.ASSINAFY_API_KEY;
if (!accountId || !apiKey) {
  throw new Error('ASSINAFY_ACCOUNT_ID and ASSINAFY_API_KEY env vars are required');
}

await db.execute(sql`
  INSERT INTO cortex_core.assinafy_config (id, account_id, api_key, api_url, webhook_url, webhook_secret, ativo, data_cadastro, data_atualizacao)
  VALUES (
    1,
    ${accountId},
    ${apiKey},
    'https://api.assinafy.com.br/v1',
    ${process.env.ASSINAFY_WEBHOOK_URL || ''},
    NULL,
    true,
    '2025-09-25 15:36:43',
    '2025-09-25 23:04:34'
  )
  ON CONFLICT (id) DO UPDATE SET
    account_id = EXCLUDED.account_id,
    api_key = EXCLUDED.api_key,
    api_url = EXCLUDED.api_url
`);
```

- [ ] **Step 2: Fix updateAssinafy.ts**

Replace hardcoded values with env vars:

```typescript
const apiKey = process.env.ASSINAFY_API_KEY;
const accountId = process.env.ASSINAFY_ACCOUNT_ID;
if (!apiKey || !accountId) {
  throw new Error('ASSINAFY_API_KEY and ASSINAFY_ACCOUNT_ID env vars are required');
}

await db.execute(sql`
  UPDATE cortex_core.assinafy_config
  SET api_key = ${apiKey},
      account_id = ${accountId},
      data_atualizacao = CURRENT_TIMESTAMP
  WHERE ativo = true
`);
```

- [ ] **Step 3: Commit**

```bash
git add server/scripts/importAssinafy.ts server/scripts/updateAssinafy.ts
git commit -m "fix(security): remove hardcoded Assinafy API keys from scripts"
```

---

### Task 5: Remove plaintext passwords from courses seed data

**Files:**
- Modify: `server/routes.ts:7330-7379+` (courses seed data array)

- [ ] **Step 1: Set all `senha` fields to null in the seed data**

In the `coursesData` array starting at line 7330, replace every `senha: "..."` value with `senha: null`. The actual passwords should only exist in the database, not in source code.

Use a regex-based find-replace: for each object in the array, change `senha: "..."` to `senha: null`.

- [ ] **Step 2: Add comment explaining why**

Add above the array:
```typescript
// NOTE: Passwords are stored only in the database, never in source code.
// This seed data is only used when the courses table is empty.
```

- [ ] **Step 3: Commit**

```bash
git add server/routes.ts
git commit -m "fix(security): remove 60+ plaintext passwords from courses seed data"
```

---

### Task 6: Remove password comment from auth routes and harden defaults

**Files:**
- Modify: `server/auth/routes.ts:13` (password comment)
- Modify: `server/auth/routes.ts:268` (default password)

- [ ] **Step 1: Remove the comment revealing plaintext password**

Replace:
```typescript
// Senhas hasheadas para usuários externos (hash de "***REMOVED***")
```

With:
```typescript
// Hashed passwords for external users
```

- [ ] **Step 2: Make CLIENT_DEFAULT_PASSWORD required**

Replace:
```typescript
const defaultPassword = process.env.CLIENT_DEFAULT_PASSWORD || '***REMOVED***';
```

With:
```typescript
const defaultPassword = process.env.CLIENT_DEFAULT_PASSWORD;
if (!defaultPassword) {
  return res.status(500).json({ message: "CLIENT_DEFAULT_PASSWORD not configured" });
}
```

- [ ] **Step 3: Commit**

```bash
git add server/auth/routes.ts
git commit -m "fix(security): remove plaintext password comment and require CLIENT_DEFAULT_PASSWORD env var"
```

---

### Task 7: Remove INTERNAL_API_TOKEN from .replit

**Files:**
- Modify: `.replit:47`

- [ ] **Step 1: Remove the INTERNAL_API_TOKEN line from .replit**

Remove line 47: `INTERNAL_API_TOKEN = "***REMOVED***"`

The token should only be set via environment variable in the deployment platform, not in tracked config files.

- [ ] **Step 2: Commit**

```bash
git add .replit
git commit -m "fix(security): remove INTERNAL_API_TOKEN from tracked .replit config"
```

---

## Chunk 2: Git Tracking & .gitignore Fixes

### Task 8: Fix .gitignore and untrack sensitive files

**Files:**
- Modify: `.gitignore`
- Untrack: `credentials/conta_servico_google.json`

- [ ] **Step 1: Fix .gitignore formatting and add entries**

The current `.gitignore` has a bug on line 13: `*.pem.superpowers/` should be two separate lines. Fix and add new entries:

```
.env
.env.*
.vite-dev.log
nul
credentials/
*.key
*.pem
.superpowers/
contracts.db/
attached_assets/*.csv
```

- [ ] **Step 2: Untrack credentials file**

```bash
git rm --cached credentials/conta_servico_google.json
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "fix(security): fix .gitignore formatting and untrack sensitive files"
```

---

## Chunk 3: SQL Injection Fixes

### Task 9: Add date validation to fluxo-caixa endpoint

**Files:**
- Modify: `server/routes.ts:1976-2068`

- [ ] **Step 1: Add date format validation**

After line 1983 (`if (!dataInicio || !dataFim)` check), add:

```typescript
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
if (!dateRegex.test(dataInicio) || !dateRegex.test(dataFim)) {
  return res.status(400).json({ error: "dataInicio and dataFim must be in YYYY-MM-DD format" });
}
```

- [ ] **Step 2: Commit**

```bash
git add server/routes.ts
git commit -m "fix(security): add date format validation to fluxo-caixa endpoint"
```

---

### Task 10: Fix SQL injection in turbozap.ts

**Files:**
- Modify: `server/services/turbozap.ts:686-719` (getEnvios)
- Modify: `server/services/turbozap.ts:804-839` (updatePipelineJuridico)

- [ ] **Step 1: Rewrite getEnvios with parameterized query**

Replace the string concatenation approach with Drizzle's `sql` tagged template:

```typescript
export async function getEnvios(filters: {
  data_inicio?: string;
  data_fim?: string;
  tipo_cobranca?: string;
  status?: string;
  busca?: string;
}): Promise<EnvioRegistro[]> {
  const conditions: any[] = [sql`1=1`];

  if (filters.data_inicio) {
    conditions.push(sql`e.criado_em >= ${filters.data_inicio}::date`);
  }
  if (filters.data_fim) {
    conditions.push(sql`e.criado_em < (${filters.data_fim}::date + interval '1 day')`);
  }
  if (filters.tipo_cobranca && filters.tipo_cobranca !== "todos") {
    conditions.push(sql`e.tipo_cobranca = ${filters.tipo_cobranca}`);
  }
  if (filters.status && filters.status !== "todos") {
    conditions.push(sql`e.status = ${filters.status}`);
  }
  if (filters.busca) {
    const searchTerm = `%${filters.busca}%`;
    conditions.push(sql`(e.cliente_nome ILIKE ${searchTerm} OR e.cnpj ILIKE ${searchTerm} OR e.telefone ILIKE ${searchTerm})`);
  }

  const whereClause = sql.join(conditions, sql` AND `);
  const result = await db.execute(
    sql`SELECT * FROM cortex_core.turbozap_envios e WHERE ${whereClause} ORDER BY e.criado_em DESC LIMIT 500`
  );
  return result.rows as EnvioRegistro[];
}
```

- [ ] **Step 2: Rewrite updatePipelineJuridico with parameterized query**

Replace the string concatenation approach:

```typescript
export async function updatePipelineJuridico(
  id: number,
  updates: { etapa?: string; protesto_efetivado?: boolean; negativacao_efetivada?: boolean; observacoes?: string },
  atualizadoPor: string,
): Promise<PipelineJuridico> {
  const setClauses: any[] = [sql`atualizado_em = NOW()`, sql`atualizado_por = ${atualizadoPor}`];

  if (updates.etapa !== undefined) {
    setClauses.push(sql`etapa = ${updates.etapa}`);
  }
  if (updates.protesto_efetivado !== undefined) {
    setClauses.push(sql`protesto_efetivado = ${updates.protesto_efetivado}`);
  }
  if (updates.negativacao_efetivada !== undefined) {
    setClauses.push(sql`negativacao_efetivada = ${updates.negativacao_efetivada}`);
  }
  if (updates.observacoes !== undefined) {
    setClauses.push(sql`observacoes = ${updates.observacoes}`);
  }

  const setClause = sql.join(setClauses, sql`, `);
  const result = await db.execute(
    sql`UPDATE cortex_core.turbozap_pipeline_juridico SET ${setClause} WHERE id = ${id} RETURNING *`
  );

  if (result.rows.length === 0) {
    throw new Error(`Pipeline record #${id} não encontrado`);
  }
  return result.rows[0] as PipelineJuridico;
}
```

- [ ] **Step 3: Commit**

```bash
git add server/services/turbozap.ts
git commit -m "fix(security): replace sql.raw string concat with parameterized queries in turbozap"
```

---

### Task 11: Fix SQL injection in storage.ts

**Files:**
- Modify: `server/storage.ts:8136-8150` (getTechAllProjetos)
- Modify: `server/storage.ts:8906-8927` (inadimplencia filters)

- [ ] **Step 1: Fix getTechAllProjetos**

Replace single-quote escaping with parameterized approach. Since these are used inside `sql.raw()` with complex CTEs, add strict validation:

```typescript
async getTechAllProjetos(tipo: 'abertos' | 'fechados', responsavel?: string, tipoP?: string): Promise<TechProjetoDetalhe[]> {
  const table = tipo === 'abertos' ? '"Clickup".cup_projetos_tech' : '"Clickup".cup_projetos_tech_fechados';

  let whereConditions: any[] = [];
  if (responsavel) {
    whereConditions.push(sql`responsavel = ${responsavel}`);
  }
  if (tipoP) {
    whereConditions.push(sql`tipo = ${tipoP}`);
  }

  const whereClause = whereConditions.length > 0
    ? sql`WHERE ${sql.join(whereConditions, sql` AND `)}`
    : sql``;
  const orderBy = tipo === 'abertos' ? sql`ORDER BY data_criada DESC` : sql`ORDER BY lancamento DESC NULLS LAST`;

  const result = await db.execute(
    sql`SELECT clickup_task_id, task_name, status_projeto, responsavel, tipo, data_criada, lancamento, descricao FROM ${sql.raw(table)} ${whereClause} ${orderBy}`
  );
```

Note: `sql.raw(table)` is safe here because `table` comes from a ternary with hardcoded values, not user input.

- [ ] **Step 2: Fix inadimplencia filters**

For the inadimplencia query filters (lines 8906-8922), add strict validation since these values are used inside a large CTE with `sql.raw()`:

```typescript
const alphanumericPattern = /^[a-zA-ZÀ-ú0-9\s\-_.\/]+$/;

let filtroWhere = '';
if (filtroVendedor) {
  if (!alphanumericPattern.test(filtroVendedor)) throw new Error('Invalid vendedor filter');
  const vendedorSafe = filtroVendedor.replace(/'/g, "''");
  filtroWhere += ` AND COALESCE(contrato_info.vendedor, 'Não Identificado') = '${vendedorSafe}'`;
}
if (filtroSquad) {
  if (!alphanumericPattern.test(filtroSquad)) throw new Error('Invalid squad filter');
  const squadSafe = filtroSquad.replace(/'/g, "''");
  filtroWhere += ` AND COALESCE(contrato_info.squad, 'Não Identificado') = '${squadSafe}'`;
}
if (filtroResponsavel) {
  if (!alphanumericPattern.test(filtroResponsavel)) throw new Error('Invalid responsavel filter');
  const responsavelSafe = filtroResponsavel.replace(/'/g, "''");
  filtroWhere += ` AND COALESCE(cliente_info.responsavel, 'Não Identificado') = '${responsavelSafe}'`;
}
if (filtroProduto) {
  if (!alphanumericPattern.test(filtroProduto)) throw new Error('Invalid produto filter');
  const produtoSafe = filtroProduto.replace(/'/g, "''");
  filtroWhere += ` AND COALESCE(contrato_info.servico, 'Não Identificado') = '${produtoSafe}'`;
}
```

- [ ] **Step 3: Commit**

```bash
git add server/storage.ts
git commit -m "fix(security): parameterize queries and validate inputs in storage.ts"
```

---

## Chunk 4: Auth Hardening & Dependencies

### Task 12: Protect debug endpoints

**Files:**
- Modify: `server/auth/routes.ts:21-35` (/auth/debug)
- Modify: `server/auth/routes.ts:45-49` (/auth/google/callback-test)
- Modify: `server/auth/routes.ts:108-143` (/auth/dev-login)

- [ ] **Step 1: Protect /auth/debug with production gate**

Replace:
```typescript
router.get("/auth/debug", (req, res) => {
```

With:
```typescript
router.get("/auth/debug", (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ message: "Not found" });
  }
```

- [ ] **Step 2: Remove /auth/google/callback-test entirely**

Delete lines 45-49 (the callback-test endpoint). It serves no purpose in production.

- [ ] **Step 3: Harden dev-login gate**

Replace:
```typescript
const isProduction = process.env.NODE_ENV === "production" && !process.env.REPLIT_DEV_DOMAIN;
```

With:
```typescript
const isProduction = process.env.NODE_ENV === "production";
const devLoginEnabled = process.env.ENABLE_DEV_LOGIN === "true";

if (isProduction || !devLoginEnabled) {
  return res.status(403).json({ message: "Dev login not available" });
}
```

This requires explicit opt-in (`ENABLE_DEV_LOGIN=true`) rather than relying on NODE_ENV alone.

- [ ] **Step 4: Commit**

```bash
git add server/auth/routes.ts
git commit -m "fix(security): protect debug endpoints and harden dev-login gate"
```

---

### Task 13: Update xlsx dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update xlsx**

```bash
npm install xlsx@latest
```

- [ ] **Step 2: Verify no breaking changes**

The xlsx API should be backward-compatible. Run a quick build:

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "fix(security): update xlsx to fix Prototype Pollution and ReDoS vulnerabilities"
```

---

## Chunk 5: Obsidian Vault Update

### Task 14: Create Phase 4 epic and update overview in Obsidian

**Files:**
- Create: `/Users/mac0267/Documents/Obsidian Vault/Córtex 2.0/08-Infra-Seguranca/phase4-secrets-full-hardening.md`
- Modify: `/Users/mac0267/Documents/Obsidian Vault/Córtex 2.0/08-Infra-Seguranca/_overview.md`

- [ ] **Step 1: Create Phase 4 epic**

```markdown
---
tipo: epico
dominio: infra-seguranca
status: em-andamento
criado: 2026-03-10
atualizado: 2026-03-10
---
# Phase 4: Secrets Removal & Full Hardening

## Objetivo
Remover todas as credenciais hardcoded do código-fonte, corrigir SQL injections remanescentes, proteger endpoints de debug e atualizar dependências vulneráveis.

## Tasks
- [ ] Remover senha do banco hardcoded de server/index.ts #infra ⏫
- [ ] Remover senha do banco hardcoded de server/routes.ts #infra ⏫
- [ ] Remover senha do banco hardcoded de scripts/*.ts #infra ⏫
- [ ] Remover API keys Assinafy hardcoded #infra ⏫
- [ ] Remover 60+ senhas plaintext do seed de courses #infra ⏫
- [ ] Remover comentário com senha plaintext e obrigar CLIENT_DEFAULT_PASSWORD #infra ⏫
- [ ] Remover INTERNAL_API_TOKEN do .replit #infra ⏫
- [ ] Corrigir .gitignore e untrack arquivos sensíveis #infra ⏫
- [ ] Validar formato de datas no fluxo-caixa #infra 🔼
- [ ] Parametrizar queries no turbozap.ts #infra 🔼
- [ ] Parametrizar queries no storage.ts #infra 🔼
- [ ] Proteger endpoints de debug e dev-login #infra 🔼
- [ ] Atualizar xlsx para corrigir Prototype Pollution + ReDoS #infra 🔼

## Notas
- Auditoria completa realizada em 2026-03-10
- Fora do escopo: reescrita do histórico git (git filter-repo) e rotação de credenciais em serviços externos
- Phase 1 (SQL Injection) e Phase 2 (Zod + Rate Limiting) já concluídas
```

- [ ] **Step 2: Update _overview.md**

Add the Phase 4 epic to the list and update counts:

```markdown
## Status
- **Construídos:** 4
- **Em andamento:** 2 (Modularização de Rotas, Phase 4 Secrets Hardening)
- **Planejados:** 2

## Épicos
- [[phase1-sql-injection]] 🟢 Concluído
- [[phase2-zod-rate-limiting]] 🟢 Concluído
- [[modularizacao-rotas]] 🟡 Em andamento
- [[phase4-secrets-full-hardening]] 🟡 Em andamento
- [[phase3-auth-rbac]] ⚪ Planejado
- [[monitoramento-alertas]] ⚪ Planejado
- [[obsidian-sync-skill]] 🟢 Concluído
- [[chamados-obsidian-tasks]] 🟢 Concluído
```

- [ ] **Step 3: Commit all changes and push**

```bash
git add -A
git commit -m "fix(security): Phase 4 security hardening - remove all hardcoded secrets, fix SQL injections, harden auth"
git push
```

---

## Post-Implementation Checklist

After all tasks are complete:

- [ ] Verify `.env` has all required variables: `DATABASE_HOST`, `DATABASE_PASSWORD`, `SESSION_SECRET`, `CLIENT_DEFAULT_PASSWORD`, `ASSINAFY_ACCOUNT_ID`, `ASSINAFY_API_KEY`
- [ ] Run `npm run build` to verify no TypeScript errors
- [ ] Restart dev server and verify app loads
- [ ] Update Obsidian Phase 4 epic: mark all tasks `[x]`, set `status: concluido`

## CRITICAL: Manual Actions Required (Not in this plan)

1. **Rotate ALL compromised credentials** in the actual services:
   - DB password on GCP Cloud SQL
   - Assinafy API keys
   - INTERNAL_API_TOKEN
   - CLIENT_DEFAULT_PASSWORD
   - SESSION_SECRET
2. **Rewrite git history** using `git filter-repo` or BFG Repo Cleaner to remove secrets from all previous commits
3. **Restrict DB network access** - verify firewall rules on `***REMOVED***:5432`
