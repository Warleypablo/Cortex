# Inadimplência Snapshot Mensal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar o total de inadimplência da empresa ao meio-dia do último dia de cada mês em uma tabela histórica, com aviso por email em caso de falha.

**Architecture:** Nova tabela `cortex_core.inadimplencia_snapshots` (1 linha por mês, upsert por `mes_referencia`). Job em `setInterval` de 1h dentro de `server/index.ts` que verifica a cada tick se é último dia + 12h. Endpoint HTTP manual para recuperação. SendGrid dispara email para `financeiro@turbopartners.com.br` quando o job falha.

**Tech Stack:** TypeScript, Express, Drizzle ORM (`sql` template), PostgreSQL (Google Cloud SQL), `@sendgrid/mail` (já instalado), `vitest` (para teste unitário do helper).

**Spec:** `docs/superpowers/specs/2026-04-24-inadimplencia-snapshot-mensal-design.md`

---

## Task 1: Criar feature branch

**Files:** nenhum (operação git)

- [ ] **Step 1: Criar e mudar para a branch nova**

```bash
git checkout main
git pull origin main
git checkout -b feature/inadimplencia-snapshot-mensal
```

Expected: `Switched to a new branch 'feature/inadimplencia-snapshot-mensal'`

> **Nota:** se o usuário estiver trabalhando numa branch existente com stash/mudanças pendentes, confirme com ele antes de mexer. O comando acima assume workspace limpo.

---

## Task 2: Migration SQL — criar tabela `inadimplencia_snapshots`

**Files:**
- Create: `migrations/2026-04-24_inadimplencia_snapshots.sql`

- [ ] **Step 1: Criar o arquivo SQL**

```sql
-- migrations/2026-04-24_inadimplencia_snapshots.sql
-- Snapshot mensal de inadimplência total — 1 linha por mês, upsert por mes_referencia.

CREATE TABLE IF NOT EXISTS cortex_core.inadimplencia_snapshots (
  id                   SERIAL       PRIMARY KEY,
  mes_referencia       VARCHAR(7)   NOT NULL UNIQUE,
  data_snapshot        DATE         NOT NULL,
  valor_total          NUMERIC(14,2) NOT NULL,
  quantidade_clientes  INTEGER      NOT NULL,
  quantidade_parcelas  INTEGER      NOT NULL,
  ticket_medio         NUMERIC(14,2) NOT NULL,
  criado_em            TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inadimplencia_snapshots_mes
  ON cortex_core.inadimplencia_snapshots (mes_referencia);

COMMENT ON TABLE cortex_core.inadimplencia_snapshots IS
  'Snapshot mensal do total de inadimplência (caz_parcelas.nao_pago). Registrado pelo job que roda ao meio-dia do último dia de cada mês.';
```

- [ ] **Step 2: Aplicar no banco LOCAL (cortex_dev)**

Usar as credenciais do `.env` (host `localhost`, db `cortex_dev`). Rodar:

```bash
psql "postgresql://postgres:${DB_PASSWORD_LOCAL}@localhost:5432/cortex_dev" \
  -f migrations/2026-04-24_inadimplencia_snapshots.sql
```

Se não souber a senha local, verificar `.env` (variáveis `DB_HOST`/`DB_PASSWORD` podem já estar apontando para local). Alternativa pragmática: abrir o psql interativo e colar o conteúdo.

Expected output: `CREATE TABLE`, `CREATE INDEX`, `COMMENT`.

- [ ] **Step 3: Aplicar no banco de PRODUÇÃO (GCP)**

> **Regra do projeto (ver memory/feedback_db_prod_sync.md):** mudanças de schema também vão em prod. Host: `34.95.249.110`, db: `dados_turbo`.

```bash
psql "postgresql://postgres:${DB_PASSWORD_PROD}@34.95.249.110:5432/dados_turbo" \
  -f migrations/2026-04-24_inadimplencia_snapshots.sql
```

Confirmar com o usuário antes de rodar em prod se a senha não estiver no ambiente.

- [ ] **Step 4: Verificar que a tabela existe nos dois bancos**

```bash
psql "$DATABASE_URL_LOCAL" -c "\d cortex_core.inadimplencia_snapshots"
psql "$DATABASE_URL_PROD"  -c "\d cortex_core.inadimplencia_snapshots"
```

Expected: lista das 7 colunas (`id`, `mes_referencia`, `data_snapshot`, `valor_total`, `quantidade_clientes`, `quantidade_parcelas`, `ticket_medio`, `criado_em`) com o `UNIQUE` em `mes_referencia`.

- [ ] **Step 5: Commit**

```bash
git add migrations/2026-04-24_inadimplencia_snapshots.sql
git commit -m "feat(inadimplencia): migration da tabela inadimplencia_snapshots

Tabela cortex_core.inadimplencia_snapshots para snapshot mensal
do total de inadimplência. Upsert idempotente via UNIQUE(mes_referencia).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Adicionar `sendAlertEmail` genérico em SendGrid

**Files:**
- Modify: `server/services/sendgrid-notification.ts` (append function no final)

- [ ] **Step 1: Adicionar função `sendAlertEmail` no final do arquivo**

Abrir `server/services/sendgrid-notification.ts`. Após a função `sendNotificacaoExtrajudicial` (termina na linha ~82), adicionar:

```ts
/**
 * Envia email de alerta interno (falhas de jobs, etc).
 * Reusa a mesma config do SendGrid já presente.
 */
export async function sendAlertEmail(
  params: SendParams,
): Promise<SendResult> {
  ensureConfig();

  const msg = {
    to: params.to,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL!,
      name: process.env.SENDGRID_FROM_NAME!,
    },
    replyTo: process.env.SENDGRID_FROM_EMAIL!,
    subject: params.subject,
    text: params.text,
    html: params.html,
  };

  try {
    const [response] = await sgMail.send(msg as any);
    const messageId = response.headers['x-message-id'] as string | undefined;
    if (!messageId) {
      throw new SendGridError(
        response.statusCode ?? 0,
        response,
        'SendGrid não retornou x-message-id',
      );
    }
    return { messageId };
  } catch (err: any) {
    if (err instanceof SendGridError) throw err;
    const status = err.code ?? err.response?.statusCode ?? 0;
    const body = err.response?.body ?? { message: err.message };
    throw new SendGridError(status, body, err.message ?? 'Falha no envio SendGrid');
  }
}
```

> Nota: é muito parecida com `sendNotificacaoExtrajudicial` mas **sem BCC** (alertas internos não precisam de cópia para o jurídico). Não refatorei em helper comum para não alterar a função existente — YAGNI.

- [ ] **Step 2: Rodar o type-check**

```bash
npx tsc --noEmit
```

Expected: sem erros relacionados a `sendgrid-notification.ts`.

- [ ] **Step 3: Commit**

```bash
git add server/services/sendgrid-notification.ts
git commit -m "feat(sendgrid): adicionar sendAlertEmail para alertas internos

Função genérica para envio de alertas (sem BCC do jurídico).
Reusa ensureConfig() já presente.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Criar o serviço `inadimplenciaSnapshotJob.ts`

**Files:**
- Create: `server/services/inadimplenciaSnapshotJob.ts`
- Create: `test/services/inadimplenciaSnapshotJob.test.ts` (teste unitário do helper `isLastDayOfMonth`)

### 4.1 Teste do helper `isLastDayOfMonth`

- [ ] **Step 1: Escrever teste falhando**

Arquivo `test/services/inadimplenciaSnapshotJob.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isLastDayOfMonth } from '../../server/services/inadimplenciaSnapshotJob';

describe('isLastDayOfMonth', () => {
  it('retorna true para 30 de abril', () => {
    expect(isLastDayOfMonth(new Date(2026, 3, 30))).toBe(true);
  });

  it('retorna true para 31 de janeiro', () => {
    expect(isLastDayOfMonth(new Date(2026, 0, 31))).toBe(true);
  });

  it('retorna true para 28 de fevereiro (ano não-bissexto)', () => {
    expect(isLastDayOfMonth(new Date(2026, 1, 28))).toBe(true);
  });

  it('retorna true para 29 de fevereiro (ano bissexto)', () => {
    expect(isLastDayOfMonth(new Date(2024, 1, 29))).toBe(true);
  });

  it('retorna false para 28 de fevereiro (ano bissexto)', () => {
    expect(isLastDayOfMonth(new Date(2024, 1, 28))).toBe(false);
  });

  it('retorna false para dia do meio do mês', () => {
    expect(isLastDayOfMonth(new Date(2026, 3, 15))).toBe(false);
  });

  it('retorna false para dia 1', () => {
    expect(isLastDayOfMonth(new Date(2026, 3, 1))).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

```bash
npx vitest run test/services/inadimplenciaSnapshotJob.test.ts
```

Expected: FAIL — "Cannot find module" ou "isLastDayOfMonth is not exported".

### 4.2 Implementação do serviço

- [ ] **Step 3: Criar o arquivo de serviço**

Arquivo novo `server/services/inadimplenciaSnapshotJob.ts`:

```ts
import { db } from "../db";
import { sql } from "drizzle-orm";
import { sendAlertEmail, SendGridError } from "./sendgrid-notification";

const ALERT_EMAIL_TO = "financeiro@turbopartners.com.br";
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1h
const TRIGGER_HOUR = 12;

export interface InadimplenciaSnapshotRecord {
  mesReferencia: string;
  dataSnapshot: string;
  valorTotal: number;
  quantidadeClientes: number;
  quantidadeParcelas: number;
  ticketMedio: number;
}

/**
 * Retorna true se a data é o último dia do mês.
 */
export function isLastDayOfMonth(date: Date): boolean {
  const next = new Date(date);
  next.setDate(date.getDate() + 1);
  return next.getMonth() !== date.getMonth();
}

/**
 * Formata Date como 'YYYY-MM' no timezone local.
 */
function formatMesReferencia(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Executa o snapshot — calcula o total de inadimplência e faz upsert.
 * Propaga erros para o caller (que decide se notifica ou devolve no response).
 */
export async function runSnapshotJob(
  mesReferencia?: string,
): Promise<InadimplenciaSnapshotRecord> {
  const now = new Date();
  const mesRef = mesReferencia ?? formatMesReferencia(now);
  const dataSnapshot = now.toISOString().split("T")[0];

  // Mesma regra do getInadimplenciaResumo:
  // tipo_evento='RECEITA' AND data_vencimento < CURRENT_DATE AND nao_pago > 0
  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(nao_pago::numeric), 0)::numeric AS valor_total,
      COUNT(DISTINCT id_cliente)::int              AS quantidade_clientes,
      COUNT(*)::int                                AS quantidade_parcelas
    FROM "Conta Azul".caz_parcelas
    WHERE tipo_evento = 'RECEITA'
      AND data_vencimento < CURRENT_DATE
      AND nao_pago::numeric > 0
  `);

  const row = result.rows[0] as {
    valor_total: string | number;
    quantidade_clientes: number;
    quantidade_parcelas: number;
  };

  const valorTotal = Number(row.valor_total) || 0;
  const quantidadeClientes = Number(row.quantidade_clientes) || 0;
  const quantidadeParcelas = Number(row.quantidade_parcelas) || 0;
  const ticketMedio =
    quantidadeClientes > 0 ? valorTotal / quantidadeClientes : 0;

  await db.execute(sql`
    INSERT INTO cortex_core.inadimplencia_snapshots
      (mes_referencia, data_snapshot, valor_total, quantidade_clientes,
       quantidade_parcelas, ticket_medio)
    VALUES
      (${mesRef}, ${dataSnapshot}, ${valorTotal}, ${quantidadeClientes},
       ${quantidadeParcelas}, ${ticketMedio})
    ON CONFLICT (mes_referencia) DO UPDATE SET
      data_snapshot       = EXCLUDED.data_snapshot,
      valor_total         = EXCLUDED.valor_total,
      quantidade_clientes = EXCLUDED.quantidade_clientes,
      quantidade_parcelas = EXCLUDED.quantidade_parcelas,
      ticket_medio        = EXCLUDED.ticket_medio,
      criado_em           = NOW()
  `);

  return {
    mesReferencia: mesRef,
    dataSnapshot,
    valorTotal,
    quantidadeClientes,
    quantidadeParcelas,
    ticketMedio,
  };
}

/**
 * Retorna true se já existe snapshot para o mes_referencia informado.
 */
async function snapshotExists(mesRef: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1
    FROM cortex_core.inadimplencia_snapshots
    WHERE mes_referencia = ${mesRef}
    LIMIT 1
  `);
  return result.rows.length > 0;
}

/**
 * Envia email de alerta sobre falha no job.
 * Nunca lança — falha de envio é logada mas não propagada.
 */
async function sendErrorAlert(err: unknown, mesRef: string): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack ?? "(sem stack)" : "(sem stack)";
  const when = new Date().toISOString();

  const text = [
    `Falha no snapshot mensal de inadimplência.`,
    ``,
    `Mês de referência: ${mesRef}`,
    `Horário: ${when}`,
    `Erro: ${message}`,
    ``,
    `Stack:`,
    stack,
    ``,
    `Para recuperar manualmente:`,
    `POST /api/inadimplencia/snapshot/run  (body opcional: { "mesReferencia": "${mesRef}" })`,
  ].join("\n");

  const html = `
    <h2>Falha no snapshot mensal de inadimplência</h2>
    <p><strong>Mês de referência:</strong> ${mesRef}</p>
    <p><strong>Horário:</strong> ${when}</p>
    <p><strong>Erro:</strong> ${escapeHtml(message)}</p>
    <pre style="background:#f6f8fa;padding:12px;border-radius:6px;overflow:auto;">${escapeHtml(stack)}</pre>
    <hr />
    <p>Para recuperar manualmente, chame:<br />
      <code>POST /api/inadimplencia/snapshot/run</code>
      (body opcional: <code>{ "mesReferencia": "${mesRef}" }</code>)
    </p>
  `;

  try {
    await sendAlertEmail({
      to: ALERT_EMAIL_TO,
      subject: `[Cortex] Falha no snapshot de inadimplência — ${mesRef}`,
      text,
      html,
    });
    console.log(`[inadimplencia-snapshot] Alerta enviado para ${ALERT_EMAIL_TO}`);
  } catch (alertErr: any) {
    const detail =
      alertErr instanceof SendGridError
        ? `SendGrid ${alertErr.status}: ${JSON.stringify(alertErr.body)}`
        : alertErr?.message ?? String(alertErr);
    console.error(
      `[inadimplencia-snapshot] FALHA AO ENVIAR ALERTA: ${detail}`,
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Executa o snapshot e, em caso de erro, dispara alerta por email.
 * Uso: agendador interno (diferente do endpoint manual, que devolve o erro ao cliente).
 */
async function runWithAlert(mesRef?: string): Promise<void> {
  try {
    const record = await runSnapshotJob(mesRef);
    console.log(
      `[inadimplencia-snapshot] Snapshot OK — ${record.mesReferencia}: ` +
        `valor=${record.valorTotal.toFixed(2)} ` +
        `clientes=${record.quantidadeClientes} ` +
        `parcelas=${record.quantidadeParcelas}`,
    );
  } catch (err) {
    console.error("[inadimplencia-snapshot] Falha ao executar:", err);
    await sendErrorAlert(err, mesRef ?? formatMesReferencia(new Date()));
  }
}

/**
 * Verifica se agora é a janela de execução (último dia do mês, hora == TRIGGER_HOUR)
 * e ainda não há snapshot para o mês.
 */
async function tick(): Promise<void> {
  const now = new Date();
  if (!isLastDayOfMonth(now)) return;
  if (now.getHours() !== TRIGGER_HOUR) return;

  const mesRef = formatMesReferencia(now);
  if (await snapshotExists(mesRef)) return;

  console.log(
    `[inadimplencia-snapshot] Janela detectada (${mesRef}, ${now.toISOString()}) — executando...`,
  );
  await runWithAlert(mesRef);
}

/**
 * Recovery de restart: se o servidor reiniciar depois das 12h do último dia do mês
 * e ainda não houver snapshot, dispara agora.
 */
async function recoverOnStartup(): Promise<void> {
  const now = new Date();
  if (!isLastDayOfMonth(now)) return;
  if (now.getHours() < TRIGGER_HOUR) return;

  const mesRef = formatMesReferencia(now);
  if (await snapshotExists(mesRef)) return;

  console.log(
    `[inadimplencia-snapshot] Recovery de startup — snapshot de ${mesRef} faltando, disparando...`,
  );
  await runWithAlert(mesRef);
}

/**
 * Setup público chamado em server/index.ts.
 */
export function setupInadimplenciaSnapshotJob(): void {
  // Recovery após 30s (mesmo delay dos outros jobs para dar tempo das conexões)
  setTimeout(() => {
    recoverOnStartup().catch((err) =>
      console.error("[inadimplencia-snapshot] recoverOnStartup erro:", err),
    );
  }, 30_000);

  // Verificação horária
  setInterval(() => {
    tick().catch((err) =>
      console.error("[inadimplencia-snapshot] tick erro:", err),
    );
  }, CHECK_INTERVAL_MS);

  console.log(
    `[inadimplencia-snapshot] Scheduled hourly check — trigger at ${TRIGGER_HOUR}:00 on last day of month`,
  );
}
```

- [ ] **Step 4: Rodar teste unitário — deve passar agora**

```bash
npx vitest run test/services/inadimplenciaSnapshotJob.test.ts
```

Expected: 7 tests passing.

- [ ] **Step 5: Rodar type-check**

```bash
npx tsc --noEmit
```

Expected: sem erros em `inadimplenciaSnapshotJob.ts`.

- [ ] **Step 6: Commit**

```bash
git add server/services/inadimplenciaSnapshotJob.ts test/services/inadimplenciaSnapshotJob.test.ts
git commit -m "feat(inadimplencia): service do snapshot mensal com alerta por email

Job que roda ao meio-dia do último dia de cada mês, calcula o total de
inadimplência (caz_parcelas.nao_pago) e faz upsert em inadimplencia_snapshots.
Envia email para financeiro@turbopartners.com.br em caso de falha.

Inclui recovery de restart e teste unitário do helper isLastDayOfMonth.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Endpoint manual `POST /api/inadimplencia/snapshot/run`

**Files:**
- Modify: `server/routes/inadimplencia.ts` (adicionar endpoint + registrar uso do service)

- [ ] **Step 1: Adicionar import do service no topo do arquivo**

Abrir `server/routes/inadimplencia.ts`. No bloco de imports (linhas 1-8), adicionar:

```ts
import { runSnapshotJob } from "../services/inadimplenciaSnapshotJob";
```

- [ ] **Step 2: Adicionar handler do endpoint**

Dentro da função `registerInadimplenciaRoutes`, logo após o handler `app.get("/api/inadimplencia/resumo"...)` (linha ~22), adicionar:

```ts
app.post("/api/inadimplencia/snapshot/run", async (req, res) => {
  try {
    const mesReferencia =
      typeof req.body?.mesReferencia === "string" &&
      /^\d{4}-\d{2}$/.test(req.body.mesReferencia)
        ? req.body.mesReferencia
        : undefined;

    const record = await runSnapshotJob(mesReferencia);
    res.json({ ok: true, snapshot: record });
  } catch (error: any) {
    console.error("[api] Error running inadimplencia snapshot:", error);
    res.status(500).json({
      ok: false,
      error: error?.message ?? "Failed to run snapshot",
    });
  }
});
```

> **Nota de segurança:** o endpoint já está protegido por `isAuthenticated` que é aplicado globalmente em `/api` (ver `server/routes.ts` linha ~721). Qualquer usuário logado pode chamar — é aceitável porque (a) é idempotente e (b) só grava dados agregados. Se quiser restringir a admins no futuro, usar o mesmo padrão do endpoint de admin existente.

- [ ] **Step 3: Rodar type-check**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add server/routes/inadimplencia.ts
git commit -m "feat(inadimplencia): endpoint POST /snapshot/run para trigger manual

Permite disparar o snapshot fora do agendamento (recuperação após falha).
Body opcional { mesReferencia: 'YYYY-MM' } — padrão: mês corrente.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Registrar o job em `server/index.ts`

**Files:**
- Modify: `server/index.ts` (adicionar setup do job junto aos outros sync jobs)

- [ ] **Step 1: Adicionar setup do job**

Abrir `server/index.ts`. Localizar o bloco do `predictions` (linha ~774-795). Logo após o `console.log('[predictions] Scheduled every ...')` (linha ~795) e ANTES do `app.use((err...))` (linha ~797), adicionar:

```ts
  // Inadimplência — snapshot mensal (último dia do mês, meio-dia)
  try {
    const { setupInadimplenciaSnapshotJob } = await import(
      "./services/inadimplenciaSnapshotJob"
    );
    setupInadimplenciaSnapshotJob();
  } catch (err) {
    console.error(
      "[inadimplencia-snapshot] Falha ao registrar job:",
      err,
    );
  }
```

> **Por que `await import` dinâmico?** O padrão do projeto para sync jobs é carregar dinâmico (ver Meta Ads e Instagram jobs). Mantém consistência e evita impacto no bundle se o serviço tiver side-effects futuros.

- [ ] **Step 2: Rodar type-check**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 3: Reiniciar o dev server**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
npm run dev
```

> O dev server usa `tsx` sem watch (ver `memory/MEMORY.md`) — precisa reiniciar manualmente após mudanças no backend.

Expected: nos logs do startup, aparecer:
```
[inadimplencia-snapshot] Scheduled hourly check — trigger at 12:00 on last day of month
```

- [ ] **Step 4: Commit**

```bash
git add server/index.ts
git commit -m "feat(inadimplencia): registrar job do snapshot mensal no bootstrap

Chama setupInadimplenciaSnapshotJob() junto aos outros sync jobs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Validação end-to-end manual

**Files:** nenhum (validação)

- [ ] **Step 1: Disparar snapshot via endpoint manual**

Com o dev server rodando, autenticado (login Google obrigatório para `/api`):

```bash
# Via navegador autenticado — usar fetch na dev console do browser:
# fetch('/api/inadimplencia/snapshot/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.json()).then(console.log)
```

Ou via `curl` se souber como injetar o cookie de sessão:

```bash
curl -X POST http://localhost:3000/api/inadimplencia/snapshot/run \
  -H "Content-Type: application/json" \
  -H "Cookie: <cookie da sessão>" \
  -d '{}'
```

Expected response:
```json
{
  "ok": true,
  "snapshot": {
    "mesReferencia": "2026-04",
    "dataSnapshot": "2026-04-24",
    "valorTotal": 123456.78,
    "quantidadeClientes": 42,
    "quantidadeParcelas": 87,
    "ticketMedio": 2939.44
  }
}
```

- [ ] **Step 2: Verificar linha no banco**

```bash
psql "$DATABASE_URL_LOCAL" -c "SELECT * FROM cortex_core.inadimplencia_snapshots;"
```

Expected: 1 linha com o mês atual.

- [ ] **Step 3: Disparar de novo e confirmar idempotência**

Repetir o fetch do Step 1. Expected: `{"ok":true, ...}` com os mesmos dados. Re-rodar o `SELECT` do Step 2:

Expected: ainda 1 linha, `criado_em` atualizado.

- [ ] **Step 4: Comparar com o valor do painel de inadimplência ao vivo**

Chamar o endpoint de resumo:

```bash
curl http://localhost:3000/api/inadimplencia/resumo -H "Cookie: <cookie>" | jq .totalInadimplente
```

Expected: mesmo valor (ou muito próximo — pode ter diferença mínima se parcelas forem pagas entre as duas chamadas).

- [ ] **Step 5: Simular erro e confirmar email**

Temporariamente quebrar a query no service (ex: mudar `"Conta Azul"` para `"Conta Azulzz"`), reiniciar o server, chamar o endpoint. Expected: response 500 com mensagem de erro.

Para validar o envio de email por alerta, testar diretamente a função `sendErrorAlert` — editar temporariamente o service para chamar `sendErrorAlert(new Error("Teste de alerta"), "2026-04")` no `setupInadimplenciaSnapshotJob`, reiniciar, e confirmar recebimento em `financeiro@turbopartners.com.br`.

**Reverter** a mudança de teste após validar:
- Desfazer edição da query
- Desfazer chamada de teste do `sendErrorAlert`
- Reiniciar

> Se o valor do painel e do snapshot divergirem significativamente, investigar se a query do `getInadimplenciaResumo` aplica algum filtro adicional que o snapshot não — o spec pede paridade.

- [ ] **Step 6: Checklist final**

- [ ] Tabela criada em local E prod
- [ ] Linha persistiu via endpoint manual
- [ ] Upsert funciona (sem duplicação)
- [ ] Log do startup mostra `[inadimplencia-snapshot] Scheduled hourly check`
- [ ] Email de alerta chega em `financeiro@turbopartners.com.br` em caso de falha simulada
- [ ] `npx tsc --noEmit` sem erros
- [ ] `npx vitest run test/services/inadimplenciaSnapshotJob.test.ts` — 7 passing

---

## Task 8: Finalização da branch

- [ ] **Step 1: Push da branch**

```bash
git push -u origin feature/inadimplencia-snapshot-mensal
```

- [ ] **Step 2: Abrir PR**

```bash
gh pr create --title "feat(inadimplencia): snapshot mensal automático" --body "$(cat <<'EOF'
## Summary
- Nova tabela `cortex_core.inadimplencia_snapshots` (1 linha por mês, upsert idempotente).
- Job que roda ao meio-dia do último dia de cada mês e registra o total de inadimplência (mesma regra do painel ao vivo).
- Aviso por email via SendGrid para `financeiro@turbopartners.com.br` em caso de falha.
- Endpoint manual `POST /api/inadimplencia/snapshot/run` para recuperação.

Spec: `docs/superpowers/specs/2026-04-24-inadimplencia-snapshot-mensal-design.md`

## Test plan
- [x] Migration aplicada em local + prod
- [x] `vitest` do helper `isLastDayOfMonth` — 7 tests passing
- [x] `tsc --noEmit` limpo
- [x] `POST /snapshot/run` grava linha no banco
- [x] Chamada duplicada faz upsert (sem duplicar)
- [x] Valor bate com `/api/inadimplencia/resumo`
- [x] Email de alerta chega em `financeiro@turbopartners.com.br` quando simulo erro
- [ ] Validar em staging antes de merge para main

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Atualizar memória do projeto se aplicável**

Se surgir qualquer convenção nova durante a implementação (ex: padrão diferente para jobs agendados, comportamento específico do SendGrid), atualizar o arquivo de memória relevante em `/Users/mac0267/.claude/projects/-Users-mac0267-Cortex/memory/`.

---

## Notas finais

- **Paridade com o painel ao vivo:** se em alguma iteração futura o `getInadimplenciaResumo` ganhar filtros novos (empresa, exclusão de certos tipos), o `runSnapshotJob` tem que acompanhar. Risco conhecido — documentar no código se adicionar.
- **Fuso horário:** `new Date()` usa o timezone do servidor (configurado em GCP). Se o servidor estiver em UTC, o "meio-dia" será UTC — ainda está dentro do último dia em BRT (UTC-3), então está OK para o caso atual. Se mudar para outro fuso, revisitar.
- **Próximos passos possíveis (fora deste plano):** (a) endpoint GET para consultar o histórico, (b) card no dashboard mostrando evolução mês-a-mês, (c) detalhamento por faixa de atraso no snapshot.
