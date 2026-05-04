# Snapshot Diário de Saldo Bancário — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar tabela `cortex_core.saldo_diario_snapshots` e job que captura o saldo total consolidado de `caz_bancos` todos os dias às 18h.

**Architecture:** Nova tabela com `data DATE PRIMARY KEY` e `saldo_total NUMERIC`. Job independente em `server/services/saldoDiarioSnapshotJob.ts` segue o padrão exato do `inadimplenciaSnapshotJob` — verificação horária via `tick()`, recovery no startup, alerta por email em falha. Endpoint admin manual para backfill e teste.

**Tech Stack:** Node.js/TypeScript, Drizzle ORM (`db.execute` + `sql` template), Vitest para testes, SendGrid para alertas.

---

## Mapa de Arquivos

| Ação | Arquivo | Responsabilidade |
|---|---|---|
| Criar | `server/services/saldoDiarioSnapshotJob.ts` | Lógica do job: tick, recovery, runSnapshotJob, alerta |
| Criar | `server/services/saldoDiarioSnapshotJob.test.ts` | Testes unitários do job |
| Criar | `server/routes/saldoDiario.ts` | Endpoint POST /api/admin/saldo-diario/snapshot/run |
| Modificar | `server/db.ts` | Adicionar `initializeSaldoDiarioSnapshotsTable()` |
| Modificar | `server/index.ts` | Importar migration + registrar job + registrar rota |
| Modificar | `server/routes.ts` | Importar e chamar `registerSaldoDiarioRoutes` |

---

## Task 1: Migration — tabela `saldo_diario_snapshots`

**Files:**
- Modify: `server/db.ts` (ao final das funções `initialize*`, antes da última função)
- Modify: `server/index.ts:10` (import) e `server/index.ts:147` (Promise.all)

### Passos

- [ ] **1.1 Adicionar função de migration em `server/db.ts`**

Adicionar após a função `initializeDfcSnapshotsTable` (linha ~1937):

```typescript
export async function initializeSaldoDiarioSnapshotsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_core.saldo_diario_snapshots (
        data        DATE            PRIMARY KEY,
        saldo_total NUMERIC(15,2)   NOT NULL,
        criado_em   TIMESTAMPTZ     DEFAULT NOW()
      )
    `);
    console.log('[database] saldo_diario_snapshots table initialized');
  } catch (error) {
    console.error('[database] Error initializing saldo_diario_snapshots:', error);
  }
}
```

- [ ] **1.2 Adicionar ao import em `server/index.ts`**

Na linha 10, adicionar `initializeSaldoDiarioSnapshotsTable` ao final do import de `./db`:

```typescript
import { ..., initializeItemAliasMapTable, initializeSaldoDiarioSnapshotsTable } from "./db";
```

- [ ] **1.3 Adicionar ao `Promise.all` em `server/index.ts`**

Após `initializeItemAliasMapTable()` (linha ~147):

```typescript
    initializeItemAliasMapTable(),
    initializeSaldoDiarioSnapshotsTable(),
  ]);
```

- [ ] **1.4 Aplicar migration no banco de produção (GCP)**

```bash
PGPASSWORD=Turbosenha* psql -h 34.95.249.110 -U postgres -d dados_turbo -c "
CREATE TABLE IF NOT EXISTS cortex_core.saldo_diario_snapshots (
  data        DATE            PRIMARY KEY,
  saldo_total NUMERIC(15,2)   NOT NULL,
  criado_em   TIMESTAMPTZ     DEFAULT NOW()
);
"
```

Verificar: output deve ser `CREATE TABLE` ou `NOTICE: relation already exists`.

- [ ] **1.5 Verificar tabela criada**

```bash
PGPASSWORD=Turbosenha* psql -h 34.95.249.110 -U postgres -d dados_turbo -c "
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'cortex_core' AND table_name = 'saldo_diario_snapshots'
ORDER BY ordinal_position;
"
```

Esperado: 3 linhas — `data DATE`, `saldo_total numeric`, `criado_em timestamp with time zone`.

- [ ] **1.6 Commit**

```bash
git add server/db.ts server/index.ts
git commit -m "feat(saldo-diario): migration da tabela saldo_diario_snapshots

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Criar job `saldoDiarioSnapshotJob.ts`

**Files:**
- Create: `server/services/saldoDiarioSnapshotJob.ts`

- [ ] **2.1 Criar o arquivo do job**

```typescript
import { db } from "../db";
import { sql } from "drizzle-orm";
import { sendAlertEmail, SendGridError } from "./sendgrid-notification";

const ALERT_EMAIL_TO = "financeiro@turbopartners.com.br";
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1h
const TRIGGER_HOUR = 18;

export interface SaldoDiarioSnapshotRecord {
  data: string;
  saldoTotal: number;
  criadoEm: string;
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function snapshotExists(date: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 FROM cortex_core.saldo_diario_snapshots
    WHERE data = ${date}::date
    LIMIT 1
  `);
  return result.rows.length > 0;
}

export async function runSnapshotJob(
  date?: string,
): Promise<SaldoDiarioSnapshotRecord> {
  const targetDate = date ?? formatDate(new Date());

  const result = await db.execute(sql`
    SELECT COALESCE(SUM(balance::numeric), 0) AS saldo_total
    FROM "Conta Azul".caz_bancos
    WHERE ativo = true
  `);

  const saldoTotal = Number((result.rows[0] as any)?.saldo_total || 0);

  await db.execute(sql`
    INSERT INTO cortex_core.saldo_diario_snapshots (data, saldo_total)
    VALUES (${targetDate}::date, ${saldoTotal})
    ON CONFLICT (data) DO UPDATE SET
      saldo_total = EXCLUDED.saldo_total,
      criado_em   = NOW()
  `);

  return { data: targetDate, saldoTotal, criadoEm: new Date().toISOString() };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendErrorAlert(err: unknown, date: string): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack ?? "(sem stack)" : "(sem stack)";
  const when = new Date().toISOString();

  const text = [
    `Falha no snapshot diário de saldo bancário.`,
    ``,
    `Data: ${date}`,
    `Horário: ${when}`,
    `Erro: ${message}`,
    ``,
    `Stack:`,
    stack,
    ``,
    `Para recuperar manualmente:`,
    `POST /api/admin/saldo-diario/snapshot/run  (body opcional: { "data": "${date}" })`,
  ].join("\n");

  const html = `
    <h2>Falha no snapshot diário de saldo bancário</h2>
    <p><strong>Data:</strong> ${date}</p>
    <p><strong>Horário:</strong> ${when}</p>
    <p><strong>Erro:</strong> ${escapeHtml(message)}</p>
    <pre style="background:#f6f8fa;padding:12px;border-radius:6px;overflow:auto;">${escapeHtml(stack)}</pre>
    <hr />
    <p>Para recuperar manualmente:<br />
      <code>POST /api/admin/saldo-diario/snapshot/run</code>
      (body opcional: <code>{ "data": "${date}" }</code>)
    </p>
  `;

  try {
    await sendAlertEmail({
      to: ALERT_EMAIL_TO,
      subject: `[Cortex] Falha no snapshot de saldo diário — ${date}`,
      text,
      html,
    });
    console.log(`[saldo-diario-snapshot] Alerta enviado para ${ALERT_EMAIL_TO}`);
  } catch (alertErr: any) {
    const detail =
      alertErr instanceof SendGridError
        ? `SendGrid ${alertErr.status}: ${JSON.stringify(alertErr.body)}`
        : alertErr?.message ?? String(alertErr);
    console.error(
      `[saldo-diario-snapshot] FALHA AO ENVIAR ALERTA: ${detail}`,
    );
  }
}

async function runWithAlert(date?: string): Promise<void> {
  try {
    const record = await runSnapshotJob(date);
    console.log(
      `[saldo-diario-snapshot] Snapshot OK — ${record.data}: saldo=${record.saldoTotal.toFixed(2)}`,
    );
  } catch (err) {
    console.error("[saldo-diario-snapshot] Falha ao executar:", err);
    await sendErrorAlert(err, date ?? formatDate(new Date()));
  }
}

export async function tick(): Promise<void> {
  const now = new Date();
  if (now.getHours() !== TRIGGER_HOUR) return;

  const today = formatDate(now);
  if (await snapshotExists(today)) return;

  console.log(
    `[saldo-diario-snapshot] Janela detectada (${today}, ${now.toISOString()}) — executando...`,
  );
  await runWithAlert(today);
}

export async function recoverOnStartup(): Promise<void> {
  const now = new Date();
  if (now.getHours() < TRIGGER_HOUR) return;

  const today = formatDate(now);
  if (await snapshotExists(today)) return;

  console.log(
    `[saldo-diario-snapshot] Recovery de startup — snapshot de ${today} faltando, disparando...`,
  );
  await runWithAlert(today);
}

export function setupSaldoDiarioSnapshotJob(): void {
  setTimeout(() => {
    recoverOnStartup().catch((err) =>
      console.error("[saldo-diario-snapshot] recoverOnStartup erro:", err),
    );
  }, 30_000);

  setInterval(() => {
    tick().catch((err) =>
      console.error("[saldo-diario-snapshot] tick erro:", err),
    );
  }, CHECK_INTERVAL_MS);

  console.log(
    `[saldo-diario-snapshot] Scheduled hourly check — trigger at ${TRIGGER_HOUR}:00 daily`,
  );
}
```

- [ ] **2.2 Verificar TypeScript sem erros**

```bash
npx tsc --noEmit 2>&1 | grep saldoDiario
```

Esperado: sem output (sem erros no arquivo novo).

- [ ] **2.3 Commit**

```bash
git add server/services/saldoDiarioSnapshotJob.ts
git commit -m "feat(saldo-diario): job de snapshot diário de saldo bancário às 18h

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Testes do job

**Files:**
- Create: `server/services/saldoDiarioSnapshotJob.test.ts`

- [ ] **3.1 Criar arquivo de testes**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do db
const mockExecute = vi.fn();
vi.mock('../db', () => ({
  db: { execute: (...args: any[]) => mockExecute(...args) },
}));

// Mock do sendAlertEmail
const mockSendAlertEmail = vi.fn();
vi.mock('./sendgrid-notification', () => ({
  sendAlertEmail: (...args: any[]) => mockSendAlertEmail(...args),
  SendGridError: class SendGridError extends Error {
    status: number; body: any;
    constructor(status: number, body: any) { super('SendGrid error'); this.status = status; this.body = body; }
  },
}));

import {
  formatDate,
  snapshotExists,
  runSnapshotJob,
  tick,
  recoverOnStartup,
} from './saldoDiarioSnapshotJob';

describe('formatDate', () => {
  it('formata data como YYYY-MM-DD', () => {
    const d = new Date(2026, 3, 30); // 30 de abril de 2026
    expect(formatDate(d)).toBe('2026-04-30');
  });

  it('zero-pad mês e dia', () => {
    const d = new Date(2026, 0, 5); // 5 de janeiro
    expect(formatDate(d)).toBe('2026-01-05');
  });
});

describe('snapshotExists', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('retorna true quando há registro para a data', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    expect(await snapshotExists('2026-04-30')).toBe(true);
  });

  it('retorna false quando não há registro', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });
    expect(await snapshotExists('2026-04-30')).toBe(false);
  });
});

describe('runSnapshotJob', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('lê saldo de caz_bancos e faz upsert', async () => {
    // 1ª chamada: SELECT SUM(balance) → 1250715.46
    mockExecute.mockResolvedValueOnce({ rows: [{ saldo_total: '1250715.46' }] });
    // 2ª chamada: INSERT/UPDATE
    mockExecute.mockResolvedValueOnce({ rows: [] });

    const result = await runSnapshotJob('2026-04-30');

    expect(result.data).toBe('2026-04-30');
    expect(result.saldoTotal).toBe(1250715.46);
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it('usa data de hoje quando nenhuma data é passada', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ saldo_total: '500000' }] });
    mockExecute.mockResolvedValueOnce({ rows: [] });

    const result = await runSnapshotJob();

    expect(result.data).toBe(formatDate(new Date()));
  });

  it('trata saldo_total null como 0', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ saldo_total: null }] });
    mockExecute.mockResolvedValueOnce({ rows: [] });

    const result = await runSnapshotJob('2026-05-01');
    expect(result.saldoTotal).toBe(0);
  });
});

describe('tick', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('não executa quando hora atual não é 18', async () => {
    vi.setSystemTime(new Date('2026-05-04T10:00:00'));
    await tick();
    expect(mockExecute).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('não executa quando snapshot já existe para hoje', async () => {
    vi.setSystemTime(new Date('2026-05-04T18:30:00'));
    // snapshotExists retorna true
    mockExecute.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    await tick();
    expect(mockExecute).toHaveBeenCalledTimes(1); // só a consulta de existência
    vi.useRealTimers();
  });

  it('executa quando hora é 18 e snapshot não existe', async () => {
    vi.setSystemTime(new Date('2026-05-04T18:05:00'));
    // snapshotExists → false
    mockExecute.mockResolvedValueOnce({ rows: [] });
    // SELECT SUM(balance)
    mockExecute.mockResolvedValueOnce({ rows: [{ saldo_total: '999999' }] });
    // INSERT
    mockExecute.mockResolvedValueOnce({ rows: [] });

    await tick();
    expect(mockExecute).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});

describe('recoverOnStartup', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('não executa quando hora < 18 (servidor subiu cedo)', async () => {
    vi.setSystemTime(new Date('2026-05-04T08:00:00'));
    await recoverOnStartup();
    expect(mockExecute).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('não executa quando snapshot já existe', async () => {
    vi.setSystemTime(new Date('2026-05-04T20:00:00'));
    mockExecute.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    await recoverOnStartup();
    expect(mockExecute).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('dispara snapshot quando servidor subiu após 18h e não há registro', async () => {
    vi.setSystemTime(new Date('2026-05-04T22:00:00'));
    mockExecute.mockResolvedValueOnce({ rows: [] });         // snapshotExists → false
    mockExecute.mockResolvedValueOnce({ rows: [{ saldo_total: '750000' }] }); // SELECT
    mockExecute.mockResolvedValueOnce({ rows: [] });         // INSERT

    await recoverOnStartup();
    expect(mockExecute).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});
```

- [ ] **3.2 Rodar os testes**

```bash
npx vitest run server/services/saldoDiarioSnapshotJob.test.ts
```

Esperado: todos os testes passando (PASS).

- [ ] **3.3 Commit**

```bash
git add server/services/saldoDiarioSnapshotJob.test.ts
git commit -m "test(saldo-diario): testes unitários do job de snapshot

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Endpoint manual `POST /api/admin/saldo-diario/snapshot/run`

**Files:**
- Create: `server/routes/saldoDiario.ts`
- Modify: `server/routes.ts` (~linha 40 imports, ~linha 7963 registro)

- [ ] **4.1 Criar o arquivo de rota**

```typescript
import type { Express } from "express";
import { runSnapshotJob } from "../services/saldoDiarioSnapshotJob";

export function registerSaldoDiarioRoutes(
  app: Express,
  isAuthenticated: (req: any, res: any, next: any) => void,
  isAdmin: (req: any, res: any, next: any) => void,
) {
  app.post(
    "/api/admin/saldo-diario/snapshot/run",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const data =
          typeof req.body?.data === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(req.body.data)
            ? req.body.data
            : undefined;

        const record = await runSnapshotJob(data);
        res.json({ ok: true, snapshot: record });
      } catch (error: any) {
        console.error("[api] Error running saldo diario snapshot:", error);
        res.status(500).json({
          ok: false,
          error: error?.message ?? "Failed to run snapshot",
        });
      }
    },
  );
}
```

- [ ] **4.2 Importar no `server/routes.ts`**

Adicionar ao bloco de imports de rotas (~linha 40, junto com os outros `register*Routes`):

```typescript
import { registerSaldoDiarioRoutes } from "./routes/saldoDiario";
```

- [ ] **4.3 Registrar a rota em `server/routes.ts`**

Após `registerInadimplenciaRoutes(app)` (~linha 7963):

```typescript
  registerInadimplenciaRoutes(app);
  registerSaldoDiarioRoutes(app, isAuthenticated, isAdmin);
```

- [ ] **4.4 Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -i saldo
```

Esperado: sem output.

- [ ] **4.5 Commit**

```bash
git add server/routes/saldoDiario.ts server/routes.ts
git commit -m "feat(saldo-diario): endpoint admin para trigger manual do snapshot

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Registrar job no `server/index.ts`

**Files:**
- Modify: `server/index.ts` (~linha 831, após o bloco do inadimplência job)

- [ ] **5.1 Adicionar bloco de setup do job após o bloco de inadimplência**

Após o bloco `// Inadimplência — snapshot mensal` (~linha 826–837):

```typescript
  // Saldo diário — snapshot às 18h todos os dias
  try {
    const { setupSaldoDiarioSnapshotJob } = await import(
      "./services/saldoDiarioSnapshotJob"
    );
    setupSaldoDiarioSnapshotJob();
  } catch (err) {
    console.error(
      "[saldo-diario-snapshot] Falha ao registrar job:",
      err,
    );
  }
```

- [ ] **5.2 Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -i saldo
```

Esperado: sem output.

- [ ] **5.3 Verificar log no startup**

```bash
npm run dev 2>&1 | grep saldo-diario
```

Esperado: linha `[saldo-diario-snapshot] Scheduled hourly check — trigger at 18:00 daily` aparece dentro de 5s do startup.

- [ ] **5.4 Commit**

```bash
git add server/index.ts
git commit -m "feat(saldo-diario): registrar job de snapshot diário no bootstrap

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Smoke test em produção

- [ ] **6.1 Fazer deploy (push da branch + merge)**

Após todos os commits acima, criar PR e mergear para staging/main conforme o workflow do projeto.

- [ ] **6.2 Trigger manual via endpoint**

```bash
curl -X POST https://<URL-PROD>/api/admin/saldo-diario/snapshot/run \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{}'
```

Esperado: `{"ok":true,"snapshot":{"data":"2026-05-04","saldoTotal":...}}`

- [ ] **6.3 Verificar linha no banco de produção**

```bash
PGPASSWORD=Turbosenha* psql -h 34.95.249.110 -U postgres -d dados_turbo -c "
SELECT data, saldo_total, criado_em
FROM cortex_core.saldo_diario_snapshots
ORDER BY data DESC
LIMIT 5;
"
```

Esperado: pelo menos uma linha com data de hoje e `saldo_total` > 0.
