# Notificação Extrajudicial — Envio via SendGrid (Fase 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Envio efetivo da notificação extrajudicial via SendGrid com auditoria, BCC interno, detecção de duplicata e confirmação pré-envio. Remove o botão mailto.

**Architecture:** Backend (Express + Drizzle + @sendgrid/mail) com tabela de auditoria `notificacoes_extrajudiciais_enviadas`, service puro `sendgrid-notification.ts`, 2 endpoints (histórico + enviar). Frontend troca mailto por envio server-side com `ConfirmacaoEnvioDialog`.

**Tech Stack:** Express, Drizzle ORM, @sendgrid/mail, React + TypeScript, shadcn/ui (AlertDialog), React Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-04-23-notificacao-extrajudicial-envio-fase2-design.md`

---

## File Structure

| Arquivo | Ação |
|---|---|
| `package.json` | Modify (+ `@sendgrid/mail`) |
| `.env.example` | Modify (documentar 4 env vars novas) |
| `migrations/2026-04-23-create-notificacoes-enviadas.sql` | Create |
| `shared/schema.ts` | Modify (+ Drizzle table) |
| `server/services/sendgrid-notification.ts` | Create |
| `server/services/sendgrid-notification.test.ts` | Create |
| `server/routes/negativacao.ts` | Modify (+ 2 endpoints) |
| `client/src/lib/notificacao-extrajudicial.ts` | Modify (+ `renderizarNotificacaoHtml`) |
| `client/src/lib/notificacao-extrajudicial.test.ts` | Modify (+ testes HTML) |
| `client/src/components/juridico/ConfirmacaoEnvioDialog.tsx` | Create |
| `client/src/components/juridico/NotificacaoExtrajudicialModal.tsx` | Modify (remove mailto, + envio + dialog + histórico) |
| `client/src/pages/Negativacao.tsx` | Modify (passar idCliente ao modal) |

---

## Task 1: Instalar dependência e documentar env vars

**Files:** `package.json`, `.env.example`

- [ ] **Step 1: Instalar @sendgrid/mail**

```bash
cd /Users/mac0267/Cortex && npm install @sendgrid/mail
```

Verificar que a versão instalada aparece em `package.json` dependencies.

- [ ] **Step 2: Documentar env vars em `.env.example`**

Abrir `/Users/mac0267/Cortex/.env.example` (criar se não existir; se existir, apenas apendar) e adicionar ao final:

```
# SendGrid — envio de notificações extrajudiciais
SENDGRID_API_KEY=SG.your_api_key_here
SENDGRID_FROM_EMAIL=juridico@turbopartners.com.br
SENDGRID_FROM_NAME=Departamento Jurídico - Turbo Partners
SENDGRID_BCC_EMAIL=juridico@turbopartners.com.br
```

Se `.env.example` não existir, criar com apenas essas 4 linhas (não copiar outras envs do `.env` — apenas este bloco novo).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "$(cat <<'EOF'
feat(juridico): add @sendgrid/mail dependency and document env vars

Preparação para Fase 2 (envio efetivo). API key, email remetente,
display name e BCC ficam em variáveis de ambiente.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Criar migration SQL e schema Drizzle

**Files:** `migrations/2026-04-23-create-notificacoes-enviadas.sql`, `shared/schema.ts`

- [ ] **Step 1: Criar arquivo de migration**

Criar diretório se não existir: `mkdir -p /Users/mac0267/Cortex/migrations`

Criar `migrations/2026-04-23-create-notificacoes-enviadas.sql`:

```sql
-- Notificações extrajudiciais enviadas — auditoria completa
CREATE TABLE IF NOT EXISTS cortex_core.notificacoes_extrajudiciais_enviadas (
  id SERIAL PRIMARY KEY,
  cliente_id TEXT NOT NULL,
  cliente_nome TEXT,
  email_destino TEXT NOT NULL,
  assunto TEXT NOT NULL,
  corpo_texto TEXT NOT NULL,
  corpo_html TEXT NOT NULL,
  enviado_por TEXT NOT NULL,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sendgrid_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'enviado',
  erro TEXT,
  CONSTRAINT ck_notif_status CHECK (status IN ('enviado', 'erro', 'bounced'))
);

CREATE INDEX IF NOT EXISTS idx_notif_cliente_id
  ON cortex_core.notificacoes_extrajudiciais_enviadas(cliente_id);

CREATE INDEX IF NOT EXISTS idx_notif_enviado_em
  ON cortex_core.notificacoes_extrajudiciais_enviadas(enviado_em DESC);
```

- [ ] **Step 2: Rodar migration no banco local**

```bash
psql "postgresql://cortex:dev123@localhost:5432/cortex_dev" \
  -f /Users/mac0267/Cortex/migrations/2026-04-23-create-notificacoes-enviadas.sql
```

Expected: `CREATE TABLE` + 2 x `CREATE INDEX` sem erro.

Validar:
```bash
psql "postgresql://cortex:dev123@localhost:5432/cortex_dev" \
  -c "\d cortex_core.notificacoes_extrajudiciais_enviadas"
```

Deve listar as 12 colunas + índices.

**IMPORTANT (CLAUDE.md):** Aplicar a mesma migration no banco de produção (GCP 34.95.249.110/dados_turbo). Execute manualmente ou via `psql` com credenciais de produção. Se não tiver acesso agora, **NÃO** bloqueie a task — registre em DONE_WITH_CONCERNS para o Warley aplicar em prod depois.

- [ ] **Step 3: Adicionar tabela no schema Drizzle**

Abrir `/Users/mac0267/Cortex/shared/schema.ts`. Localizar outras tabelas em `cortex_core` (usar grep se necessário: `grep -n "cortex_core\." shared/schema.ts | head -10`). Seguindo o mesmo padrão, adicionar ao final do arquivo (ou em bloco próximo às outras tabelas de cortex_core):

```ts
export const notificacoesExtrajudiciaisEnviadas = pgTable(
  'notificacoes_extrajudiciais_enviadas',
  {
    id: serial('id').primaryKey(),
    clienteId: text('cliente_id').notNull(),
    clienteNome: text('cliente_nome'),
    emailDestino: text('email_destino').notNull(),
    assunto: text('assunto').notNull(),
    corpoTexto: text('corpo_texto').notNull(),
    corpoHtml: text('corpo_html').notNull(),
    enviadoPor: text('enviado_por').notNull(),
    enviadoEm: timestamp('enviado_em', { withTimezone: true }).defaultNow().notNull(),
    sendgridMessageId: text('sendgrid_message_id'),
    status: text('status').notNull().default('enviado'),
    erro: text('erro'),
  },
);
```

Observação de schema: no projeto outras tabelas de `cortex_core` geralmente usam `pgSchema('cortex_core').table(...)`. Antes de escrever, verifique qual padrão é usado nas tabelas `cortex_core` existentes em `shared/schema.ts` e SIGA ESSE PADRÃO. Se as tabelas existentes usam `pgSchema('cortex_core').table(...)`, reescreva o código acima usando esse padrão.

Imports no topo do arquivo (provavelmente já existem): `pgTable`/`pgSchema`, `serial`, `text`, `timestamp`.

- [ ] **Step 4: Type-check**

```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | grep -E "schema\.ts" | head -10
```

Expected: nenhum erro novo.

- [ ] **Step 5: Commit**

```bash
git add migrations/2026-04-23-create-notificacoes-enviadas.sql shared/schema.ts
git commit -m "$(cat <<'EOF'
feat(juridico): create notificacoes_extrajudiciais_enviadas audit table

Tabela de auditoria com corpo completo (texto + HTML), destinatário,
usuário que enviou, status e sendgrid_message_id para rastreabilidade
jurídica.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Criar service SendGrid (TDD)

**Files:** `server/services/sendgrid-notification.ts`, `server/services/sendgrid-notification.test.ts`

- [ ] **Step 1: Criar diretório se não existir**

```bash
mkdir -p /Users/mac0267/Cortex/server/services
```

- [ ] **Step 2: Escrever testes primeiro**

Criar `server/services/sendgrid-notification.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de @sendgrid/mail antes do import do service
const mockSend = vi.fn();
const mockSetApiKey = vi.fn();

vi.mock('@sendgrid/mail', () => ({
  default: {
    send: (...args: any[]) => mockSend(...args),
    setApiKey: (...args: any[]) => mockSetApiKey(...args),
  },
}));

import { sendNotificacaoExtrajudicial, SendGridError } from './sendgrid-notification';

describe('sendNotificacaoExtrajudicial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SENDGRID_API_KEY = 'SG.test_key';
    process.env.SENDGRID_FROM_EMAIL = 'juridico@turbopartners.com.br';
    process.env.SENDGRID_FROM_NAME = 'Departamento Jurídico - Turbo Partners';
    process.env.SENDGRID_BCC_EMAIL = 'juridico@turbopartners.com.br';
  });

  it('monta payload correto (from, replyTo, bcc, subject, text, html)', async () => {
    mockSend.mockResolvedValue([
      { statusCode: 202, headers: { 'x-message-id': 'msg-abc-123' } },
    ]);

    await sendNotificacaoExtrajudicial({
      to: 'cliente@empresa.com',
      subject: 'Notificação Extrajudicial',
      text: 'Texto da notificação...',
      html: '<div>HTML</div>',
    });

    expect(mockSetApiKey).toHaveBeenCalledWith('SG.test_key');
    expect(mockSend).toHaveBeenCalledWith({
      to: 'cliente@empresa.com',
      from: {
        email: 'juridico@turbopartners.com.br',
        name: 'Departamento Jurídico - Turbo Partners',
      },
      replyTo: 'juridico@turbopartners.com.br',
      bcc: 'juridico@turbopartners.com.br',
      subject: 'Notificação Extrajudicial',
      text: 'Texto da notificação...',
      html: '<div>HTML</div>',
    });
  });

  it('retorna messageId do header x-message-id', async () => {
    mockSend.mockResolvedValue([
      { statusCode: 202, headers: { 'x-message-id': 'msg-abc-123' } },
    ]);

    const result = await sendNotificacaoExtrajudicial({
      to: 'cliente@empresa.com',
      subject: 'Sub',
      text: 'Text',
      html: '<p>HTML</p>',
    });

    expect(result.messageId).toBe('msg-abc-123');
  });

  it('lança SendGridError em 4xx', async () => {
    const error = Object.assign(new Error('Unauthorized'), {
      code: 401,
      response: { body: { errors: [{ message: 'API key inválida' }] } },
    });
    mockSend.mockRejectedValue(error);

    await expect(
      sendNotificacaoExtrajudicial({
        to: 'cliente@empresa.com',
        subject: 'Sub',
        text: 'Text',
        html: '<p>HTML</p>',
      })
    ).rejects.toBeInstanceOf(SendGridError);
  });

  it('lança SendGridError em 5xx', async () => {
    const error = Object.assign(new Error('Service Unavailable'), {
      code: 503,
      response: { body: 'Service down' },
    });
    mockSend.mockRejectedValue(error);

    await expect(
      sendNotificacaoExtrajudicial({
        to: 'cliente@empresa.com',
        subject: 'Sub',
        text: 'Text',
        html: '<p>HTML</p>',
      })
    ).rejects.toBeInstanceOf(SendGridError);
  });

  it('SendGridError expõe status e body para auditoria', async () => {
    const error = Object.assign(new Error('Unauthorized'), {
      code: 401,
      response: { body: { errors: [{ message: 'API key inválida' }] } },
    });
    mockSend.mockRejectedValue(error);

    try {
      await sendNotificacaoExtrajudicial({
        to: 'cliente@empresa.com',
        subject: 'Sub',
        text: 'Text',
        html: '<p>HTML</p>',
      });
    } catch (e) {
      expect(e).toBeInstanceOf(SendGridError);
      expect((e as SendGridError).status).toBe(401);
      expect((e as SendGridError).body).toEqual({
        errors: [{ message: 'API key inválida' }],
      });
    }
  });
});
```

- [ ] **Step 3: Rodar teste e confirmar falha**

```bash
cd /Users/mac0267/Cortex && npx vitest run server/services/sendgrid-notification.test.ts
```

Expected: FAIL com "Cannot find module './sendgrid-notification'".

- [ ] **Step 4: Implementar o service**

Criar `server/services/sendgrid-notification.ts`:

```ts
import sgMail from '@sendgrid/mail';

export interface SendParams {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface SendResult {
  messageId: string;
}

export class SendGridError extends Error {
  constructor(
    public status: number,
    public body: any,
    message: string,
  ) {
    super(message);
    this.name = 'SendGridError';
  }
}

let apiKeyConfigured = false;

function ensureConfig(): void {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY não configurada');
  }
  if (!process.env.SENDGRID_FROM_EMAIL) {
    throw new Error('SENDGRID_FROM_EMAIL não configurada');
  }
  if (!process.env.SENDGRID_FROM_NAME) {
    throw new Error('SENDGRID_FROM_NAME não configurada');
  }
  if (!process.env.SENDGRID_BCC_EMAIL) {
    throw new Error('SENDGRID_BCC_EMAIL não configurada');
  }
  if (!apiKeyConfigured) {
    sgMail.setApiKey(apiKey);
    apiKeyConfigured = true;
  }
}

export async function sendNotificacaoExtrajudicial(
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
    bcc: process.env.SENDGRID_BCC_EMAIL!,
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

**IMPORTANTE — test config**: o projeto `tsconfig.json` inclui `server/**/*` mas exclui `**/*.test.ts`. Verificar se o Vitest roda arquivos em `server/`. Caso o vitest config não inclua `server/`, adicionar ao `vitest.config.ts` ou criar: a rotina é checar `/Users/mac0267/Cortex/vitest.config.ts` (ou `vite.config.ts`). Se necessário, ajustar include de test para `['client/**/*.test.ts', 'server/**/*.test.ts']`. Se a config atual já rodar tudo, pular esse ajuste.

- [ ] **Step 5: Rodar teste e confirmar que passa**

```bash
cd /Users/mac0267/Cortex && npx vitest run server/services/sendgrid-notification.test.ts
```

Expected: 5/5 tests passing.

Se o teste não for detectado, verificar `vitest.config.ts` e ajustar glob de `test.include` para aceitar `server/**/*.test.ts`. Commit essa mudança junto.

- [ ] **Step 6: Commit**

```bash
git add server/services/sendgrid-notification.ts server/services/sendgrid-notification.test.ts vitest.config.ts 2>/dev/null
git add server/services/sendgrid-notification.ts server/services/sendgrid-notification.test.ts
git commit -m "$(cat <<'EOF'
feat(juridico): add SendGrid notification service with tests

Wrapper puro com validação de env vars, formatação de payload
(from/replyTo/bcc) e tratamento de erro via SendGridError que expõe
status e body para auditoria.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Criar endpoints GET histórico + POST enviar

**Files:** `server/routes/negativacao.ts`

- [ ] **Step 1: Adicionar imports**

Abrir `/Users/mac0267/Cortex/server/routes/negativacao.ts`. Localizar o bloco de imports no topo (linhas 1-3). Garantir que incluem (adicionar o que faltar):

```ts
import { eq, desc, asc, sql, and } from "drizzle-orm";
import { negativacaoAcoes, notificacoesExtrajudiciaisEnviadas } from "../../shared/schema";
import { z } from "zod";
import { sendNotificacaoExtrajudicial, SendGridError } from "../services/sendgrid-notification";
```

(Se `z` já está importado em outro lugar do projeto, seguir o mesmo padrão.)

- [ ] **Step 2: Adicionar schema Zod de validação**

Depois do bloco de imports e antes de `export function registerNegativacaoRoutes`, adicionar:

```ts
const enviarNotificacaoSchema = z.object({
  clienteId: z.string().min(1),
  clienteNome: z.string().optional(),
  emailDestino: z.string().email(),
  assunto: z.string().min(10).max(200),
  corpoTexto: z.string().min(100).max(50000),
  corpoHtml: z.string().min(100).max(100000),
});
```

- [ ] **Step 3: Adicionar endpoint GET /api/negativacao/cliente/:clienteId/notificacoes-enviadas**

Localizar onde está definido `GET /api/negativacao/cliente/:clienteId/notificacao-data` (task anterior). Logo após esse endpoint, adicionar:

```ts
  // GET /api/negativacao/cliente/:clienteId/notificacoes-enviadas — histórico de envios
  app.get(
    "/api/negativacao/cliente/:clienteId/notificacoes-enviadas",
    async (req, res) => {
      try {
        const { clienteId } = req.params;
        const rows = await db
          .select({
            id: notificacoesExtrajudiciaisEnviadas.id,
            emailDestino: notificacoesExtrajudiciaisEnviadas.emailDestino,
            enviadoPor: notificacoesExtrajudiciaisEnviadas.enviadoPor,
            enviadoEm: notificacoesExtrajudiciaisEnviadas.enviadoEm,
            status: notificacoesExtrajudiciaisEnviadas.status,
          })
          .from(notificacoesExtrajudiciaisEnviadas)
          .where(eq(notificacoesExtrajudiciaisEnviadas.clienteId, clienteId))
          .orderBy(desc(notificacoesExtrajudiciaisEnviadas.enviadoEm))
          .limit(10);

        res.json(rows);
      } catch (error) {
        console.error("[api] Error fetching notificacoes enviadas:", error);
        res.status(500).json({ error: "Failed to fetch notification history" });
      }
    },
  );
```

- [ ] **Step 4: Adicionar endpoint POST /api/negativacao/notificacoes/enviar**

Logo após o endpoint anterior, adicionar:

```ts
  // POST /api/negativacao/notificacoes/enviar — dispara envio + grava auditoria
  app.post("/api/negativacao/notificacoes/enviar", async (req, res) => {
    try {
      const parsed = enviarNotificacaoSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Validation failed",
          issues: parsed.error.issues,
        });
      }

      const user = (req as any).user;
      const enviadoPor = user?.name || user?.googleId || "Sistema";

      const { clienteId, clienteNome, emailDestino, assunto, corpoTexto, corpoHtml } = parsed.data;

      // 1. Grava registro otimista
      const [inserted] = await db
        .insert(notificacoesExtrajudiciaisEnviadas)
        .values({
          clienteId,
          clienteNome: clienteNome ?? null,
          emailDestino,
          assunto,
          corpoTexto,
          corpoHtml,
          enviadoPor,
          status: "enviado",
        })
        .returning({ id: notificacoesExtrajudiciaisEnviadas.id });

      // 2. Chama SendGrid
      try {
        const result = await sendNotificacaoExtrajudicial({
          to: emailDestino,
          subject: assunto,
          text: corpoTexto,
          html: corpoHtml,
        });

        // 3. Atualiza com message_id
        await db
          .update(notificacoesExtrajudiciaisEnviadas)
          .set({ sendgridMessageId: result.messageId })
          .where(eq(notificacoesExtrajudiciaisEnviadas.id, inserted.id));

        return res.json({
          id: inserted.id,
          status: "enviado",
          sendgridMessageId: result.messageId,
        });
      } catch (sendErr: any) {
        const erroMsg =
          sendErr instanceof SendGridError
            ? `SendGrid ${sendErr.status}: ${JSON.stringify(sendErr.body)}`
            : sendErr?.message ?? "Erro desconhecido";

        await db
          .update(notificacoesExtrajudiciaisEnviadas)
          .set({ status: "erro", erro: erroMsg })
          .where(eq(notificacoesExtrajudiciaisEnviadas.id, inserted.id));

        console.error("[api] SendGrid error:", erroMsg);
        return res
          .status(500)
          .json({ error: "Falha no envio", detail: erroMsg, auditId: inserted.id });
      }
    } catch (error: any) {
      console.error("[api] Error in POST /notificacoes/enviar:", error);
      return res
        .status(500)
        .json({ error: "Unexpected error", message: error?.message });
    }
  });
```

- [ ] **Step 5: Type-check**

```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | grep -E "negativacao\.ts|sendgrid" | head -10
```

Expected: sem erros novos relacionados aos arquivos editados.

- [ ] **Step 6: Commit**

```bash
git add server/routes/negativacao.ts
git commit -m "$(cat <<'EOF'
feat(juridico): add notification history + send endpoints

GET /api/negativacao/cliente/:id/notificacoes-enviadas retorna histórico
(10 mais recentes) para detectar duplicata. POST /api/negativacao/
notificacoes/enviar grava auditoria otimista, chama SendGrid, atualiza
status e message_id. Erros são registrados com status=erro.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Implementar `renderizarNotificacaoHtml` (TDD)

**Files:** `client/src/lib/notificacao-extrajudicial.ts`, `client/src/lib/notificacao-extrajudicial.test.ts`

- [ ] **Step 1: Adicionar testes**

Apendar ao final de `client/src/lib/notificacao-extrajudicial.test.ts`:

```ts
import { renderizarNotificacaoHtml } from './notificacao-extrajudicial';

describe('renderizarNotificacaoHtml', () => {
  const textoSimples = `NOTIFICAÇÃO EXTRAJUDICIAL DE COBRANÇA

NOTIFICANTE: TURBO PARTNERS, pessoa jurídica com CNPJ 42.100.292/0001-84.

NOTIFICADA: EMPRESA LTDA, CNPJ 22.222.020/0002-22.

Texto do corpo da notificação.

Vitória/ES, 23/04/2026.`;

  it('envolve output em div com inline style de fonte serif', () => {
    const html = renderizarNotificacaoHtml(textoSimples);
    expect(html).toMatch(/<div[^>]*style="[^"]*Georgia[^"]*"[^>]*>/);
    expect(html).toContain('</div>');
  });

  it('usa <h2> para a primeira linha', () => {
    const html = renderizarNotificacaoHtml(textoSimples);
    expect(html).toMatch(/<h2[^>]*>NOTIFICAÇÃO EXTRAJUDICIAL DE COBRANÇA<\/h2>/);
  });

  it('aplica <strong> em NOTIFICANTE:', () => {
    const html = renderizarNotificacaoHtml(textoSimples);
    expect(html).toMatch(/<strong>NOTIFICANTE:<\/strong>/);
  });

  it('aplica <strong> em NOTIFICADA:', () => {
    const html = renderizarNotificacaoHtml(textoSimples);
    expect(html).toMatch(/<strong>NOTIFICADA:<\/strong>/);
  });

  it('usa <p> para parágrafos comuns', () => {
    const html = renderizarNotificacaoHtml(textoSimples);
    expect(html).toContain('<p style="margin:12px 0;line-height:1.6;">Texto do corpo da notificação.</p>');
  });

  it('escapa caracteres especiais HTML no corpo', () => {
    const textoComHtml = `Título\n\nParágrafo com <script>alert("xss")</script> e & ampersand.`;
    const html = renderizarNotificacaoHtml(textoComHtml);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });

  it('lida com texto vazio retornando div vazia', () => {
    const html = renderizarNotificacaoHtml('');
    expect(html).toMatch(/<div[^>]*><\/div>/);
  });
});
```

- [ ] **Step 2: Rodar teste e confirmar falha**

```bash
cd /Users/mac0267/Cortex && npx vitest run client/src/lib/notificacao-extrajudicial.test.ts
```

Expected: 7 novos falham com "renderizarNotificacaoHtml is not a function"; os 27 anteriores continuam passando.

- [ ] **Step 3: Implementar a função**

Adicionar ao final de `client/src/lib/notificacao-extrajudicial.ts`:

```ts
function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderizarNotificacaoHtml(texto: string): string {
  if (!texto.trim()) {
    return '<div style="font-family:Georgia,\'Times New Roman\',serif;max-width:600px;color:#1a1a1a;padding:20px;"></div>';
  }

  const paragrafos = texto.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

  const html = paragrafos.map((p, idx) => {
    const escapado = escaparHtml(p);

    if (idx === 0) {
      return `<h2 style="font-size:16px;font-weight:bold;margin-bottom:20px;">${escapado}</h2>`;
    }

    const paragrafoComBr = escapado.replace(/\n/g, '<br>');

    const matchLabel = /^(NOTIFICANTE|NOTIFICADA):/.exec(paragrafoComBr);
    if (matchLabel) {
      const label = matchLabel[1];
      const resto = paragrafoComBr.substring(matchLabel[0].length);
      return `<p style="margin:12px 0;line-height:1.6;"><strong>${label}:</strong>${resto}</p>`;
    }

    return `<p style="margin:12px 0;line-height:1.6;">${paragrafoComBr}</p>`;
  }).join('\n');

  return `<div style="font-family:Georgia,'Times New Roman',serif;max-width:600px;color:#1a1a1a;padding:20px;">${html}</div>`;
}
```

- [ ] **Step 4: Rodar testes e confirmar que passam**

```bash
cd /Users/mac0267/Cortex && npx vitest run client/src/lib/notificacao-extrajudicial.test.ts
```

Expected: 34 tests passing (27 anteriores + 7 novos).

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/notificacao-extrajudicial.ts client/src/lib/notificacao-extrajudicial.test.ts
git commit -m "$(cat <<'EOF'
feat(juridico): add renderizarNotificacaoHtml for email formatting

Função pura que gera HTML semântico do template com inline styles
(fonte serif, larguras máximas, destacando NOTIFICANTE/NOTIFICADA em
negrito). Escapa caracteres especiais para prevenir XSS no corpo do
email.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Criar ConfirmacaoEnvioDialog

**Files:** `client/src/components/juridico/ConfirmacaoEnvioDialog.tsx`

- [ ] **Step 1: Verificar existência do AlertDialog**

```bash
ls /Users/mac0267/Cortex/client/src/components/ui/alert-dialog.tsx
```

Deve existir. Se não existir, verificar com `ls /Users/mac0267/Cortex/client/src/components/ui/` e usar alternativa (Dialog simples serve, ajustar imports).

- [ ] **Step 2: Criar o componente**

Criar `client/src/components/juridico/ConfirmacaoEnvioDialog.tsx`:

```tsx
import { AlertTriangle, Loader2, Send } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UltimoEnvio {
  enviadoEm: string;
  enviadoPor: string;
}

interface ConfirmacaoEnvioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  emailDestino: string;
  clienteNome: string;
  ultimoEnvio?: UltimoEnvio | null;
  isSending: boolean;
}

export function ConfirmacaoEnvioDialog({
  open,
  onOpenChange,
  onConfirm,
  emailDestino,
  clienteNome,
  ultimoEnvio,
  isSending,
}: ConfirmacaoEnvioDialogProps) {
  const formatarData = (iso: string) => {
    try {
      return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return iso;
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar envio da notificação?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-semibold">Para:</span> {emailDestino}
              </div>
              <div>
                <span className="font-semibold">Cliente:</span> {clienteNome}
              </div>
              <div className="text-muted-foreground">
                <span className="font-semibold">De:</span> Departamento Jurídico - Turbo Partners &lt;juridico@turbopartners.com.br&gt;
              </div>
              <div className="text-muted-foreground">
                <span className="font-semibold">BCC:</span> juridico@turbopartners.com.br
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {ultimoEnvio && (
          <div
            className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 p-3 text-sm text-yellow-800 dark:text-yellow-200"
            data-testid="alert-duplicata-envio"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Este cliente já foi notificado em{' '}
              <strong>{formatarData(ultimoEnvio.enviadoEm)}</strong> por{' '}
              <strong>{ultimoEnvio.enviadoPor}</strong>. Enviar mesmo assim?
            </span>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSending} data-testid="button-cancelar-envio">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isSending}
            className={ultimoEnvio ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            data-testid="button-confirmar-envio"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | grep -E "ConfirmacaoEnvio" | head -5
```

Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/juridico/ConfirmacaoEnvioDialog.tsx
git commit -m "$(cat <<'EOF'
feat(juridico): add ConfirmacaoEnvioDialog with duplicate warning

AlertDialog que exige confirmação explícita antes do envio. Se o
cliente já foi notificado antes, exibe alerta amarelo com data/hora e
usuário do último envio, e estiliza o botão de confirmação como
destructive para forçar atenção.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Integrar envio server-side no modal

**Files:** `client/src/components/juridico/NotificacaoExtrajudicialModal.tsx`, `client/src/pages/Negativacao.tsx`

- [ ] **Step 1: Atualizar prop shape do modal (adicionar idCliente)**

Abrir `/Users/mac0267/Cortex/client/src/components/juridico/NotificacaoExtrajudicialModal.tsx`. Localizar `NotificacaoExtrajudicialModalProps` e atualizar:

```ts
interface NotificacaoExtrajudicialModalProps {
  open: boolean;
  onClose: () => void;
  cliente: ClienteParaNotificacao & {
    idCliente: string;
    email: string | null;
    endereco: string | null;
    servicos: string | null;
  };
  parcelas: ParcelaParaNotificacao[];
}
```

- [ ] **Step 2: Remover mailto, adicionar imports novos**

No topo do arquivo:
- Remover `Mail` do import de lucide-react (continua tendo `Copy`, `AlertTriangle`, `RotateCcw`; adicionar `Send`).
- Adicionar `useMutation, useQuery` ao import existente de `@tanstack/react-query` (ou novo import se não existe).
- Adicionar import: `import { queryClient } from '@/lib/queryClient';`
- Adicionar import: `import { ConfirmacaoEnvioDialog } from './ConfirmacaoEnvioDialog';`
- Adicionar: `import { renderizarNotificacao, renderizarNotificacaoHtml, ... } from '@/lib/notificacao-extrajudicial';`

Remover do arquivo:
- Constante `MAILTO_MAX_LENGTH` e constante `EMAIL_REGEX` → manter EMAIL_REGEX, é usado
- Função `handleAbrirEmail`
- Botão "Abrir no email" no footer

- [ ] **Step 3: Adicionar query de histórico**

Dentro do componente, depois dos outros `useState`:

```ts
const { data: historicoEnvios } = useQuery<
  { id: number; emailDestino: string; enviadoPor: string; enviadoEm: string; status: string }[]
>({
  queryKey: ['/api/negativacao/cliente', cliente.idCliente, 'notificacoes-enviadas'],
  queryFn: async () => {
    const r = await fetch(
      `/api/negativacao/cliente/${cliente.idCliente}/notificacoes-enviadas`,
      { credentials: 'include' },
    );
    if (!r.ok) throw new Error('Failed to fetch history');
    return r.json();
  },
  enabled: open,
});

const ultimoEnvio = historicoEnvios?.[0]
  ? { enviadoEm: historicoEnvios[0].enviadoEm, enviadoPor: historicoEnvios[0].enviadoPor }
  : null;
```

- [ ] **Step 4: Adicionar mutation de envio**

```ts
const [confirmacaoOpen, setConfirmacaoOpen] = useState(false);

const enviarMutation = useMutation({
  mutationFn: async () => {
    const corpoHtml = renderizarNotificacaoHtml(preview);
    const r = await fetch('/api/negativacao/notificacoes/enviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        clienteId: cliente.idCliente,
        clienteNome: cliente.nomeCliente,
        emailDestino: form.email.trim(),
        assunto: 'Notificação Extrajudicial de Cobrança - TURBO PARTNERS',
        corpoTexto: preview,
        corpoHtml,
      }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new Error(`HTTP ${r.status}: ${text || r.statusText}`);
    }
    return r.json();
  },
  onSuccess: (result) => {
    toast({
      title: 'Notificação enviada',
      description: `ID: ${result.sendgridMessageId ?? result.id}`,
    });
    queryClient.invalidateQueries({
      queryKey: ['/api/negativacao/cliente', cliente.idCliente, 'notificacoes-enviadas'],
    });
    setConfirmacaoOpen(false);
    onClose();
  },
  onError: (err: Error) => {
    toast({
      title: 'Falha no envio',
      description: err.message,
      variant: 'destructive',
    });
    setConfirmacaoOpen(false);
  },
});
```

- [ ] **Step 5: Adicionar botão "Enviar agora" no footer**

Substituir o footer:

```tsx
<DialogFooter className="gap-2">
  <Button variant="ghost" onClick={onClose} data-testid="button-fechar-notificacao">
    Fechar
  </Button>
  <Button
    variant="outline"
    onClick={handleCopiar}
    data-testid="button-copiar-notificacao"
  >
    <Copy className="h-4 w-4 mr-2" />
    Copiar texto
  </Button>
  <Button
    onClick={() => setConfirmacaoOpen(true)}
    disabled={!emailValido}
    data-testid="button-enviar-notificacao"
  >
    <Send className="h-4 w-4 mr-2" />
    Enviar agora
  </Button>
</DialogFooter>
```

- [ ] **Step 6: Renderizar ConfirmacaoEnvioDialog dentro do DialogContent**

Antes do `</DialogContent>`, adicionar:

```tsx
<ConfirmacaoEnvioDialog
  open={confirmacaoOpen}
  onOpenChange={setConfirmacaoOpen}
  onConfirm={() => enviarMutation.mutate()}
  emailDestino={form.email.trim()}
  clienteNome={cliente.nomeCliente || cliente.empresa || ''}
  ultimoEnvio={ultimoEnvio}
  isSending={enviarMutation.isPending}
/>
```

- [ ] **Step 7: Atualizar call site em Negativacao.tsx**

Abrir `/Users/mac0267/Cortex/client/src/pages/Negativacao.tsx`. Localizar onde `NotificacaoExtrajudicialModal` é renderizado. Atualizar para passar `idCliente`:

```tsx
{notificacaoClienteId && notificacaoData && (
  <NotificacaoExtrajudicialModal
    key={`${notificacaoClienteId}-loaded`}
    open={true}
    onClose={() => setNotificacaoClienteId(null)}
    cliente={{
      ...notificacaoData.cliente,
      idCliente: notificacaoClienteId,
    }}
    parcelas={notificacaoData.parcelas}
  />
)}
```

- [ ] **Step 8: Type-check**

```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | grep -E "NotificacaoExtrajudicialModal|Negativacao\.tsx|ConfirmacaoEnvio" | head -10
```

Expected: sem erros novos.

- [ ] **Step 9: Rodar todos os testes para garantir que nada quebrou**

```bash
cd /Users/mac0267/Cortex && npx vitest run
```

Expected: todos os testes passando (34 do juridico lib + 5 do sendgrid service + demais testes do projeto).

- [ ] **Step 10: Commit**

```bash
git add client/src/components/juridico/NotificacaoExtrajudicialModal.tsx client/src/pages/Negativacao.tsx
git commit -m "$(cat <<'EOF'
feat(juridico): replace mailto with server-side send via SendGrid

Remove botão 'Abrir no email' e adiciona 'Enviar agora' que dispara
mutation POST /api/negativacao/notificacoes/enviar. Query de histórico
detecta duplicata e abre ConfirmacaoEnvioDialog com aviso quando
cliente já foi notificado antes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: QA manual + documentação

**Files:** nenhum — apenas validação.

- [ ] **Step 1: Configurar env vars reais no `.env`**

O Warley precisa colocar a API key real do SendGrid e os outros valores em `/Users/mac0267/Cortex/.env`:

```
SENDGRID_API_KEY=SG.<chave-real>
SENDGRID_FROM_EMAIL=juridico@turbopartners.com.br
SENDGRID_FROM_NAME=Departamento Jurídico - Turbo Partners
SENDGRID_BCC_EMAIL=juridico@turbopartners.com.br
```

- [ ] **Step 2: Reiniciar dev server**

```bash
cd /Users/mac0267/Cortex && lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev
```

- [ ] **Step 3: Aplicar migration em produção**

```bash
psql "<DATABASE_URL_PROD>" \
  -f /Users/mac0267/Cortex/migrations/2026-04-23-create-notificacoes-enviadas.sql
```

(Se não tiver DATABASE_URL de produção, pedir ao Warley para rodar manualmente.)

- [ ] **Step 4: Teste funcional — envio OK**

No navegador em `/negativacao`:
1. Abrir card da coluna Notificacao
2. Clicar em "Notificar"
3. No modal, preencher nº contrato, data, serviço
4. Mudar o campo email para um email de teste pessoal (ex: `teste@turbopartners.com.br` ou email próprio do Warley)
5. Clicar "Enviar agora"
6. Dialog de confirmação aparece — verificar dados exibidos
7. Confirmar
8. Toast verde "Notificação enviada"
9. Verificar inbox do email de teste — email chegou? Display name correto?
10. Verificar inbox do `juridico@turbopartners.com.br` — BCC chegou?
11. `psql "$DATABASE_URL" -c "SELECT * FROM cortex_core.notificacoes_extrajudiciais_enviadas ORDER BY id DESC LIMIT 1;"` — registro existe com `status=enviado` e `sendgrid_message_id` preenchido?

- [ ] **Step 5: Teste funcional — duplicata**

1. Voltar ao mesmo card
2. Clicar "Notificar" → "Enviar agora" de novo
3. Dialog deve mostrar aviso amarelo "Este cliente já foi notificado em dd/mm/aaaa às hh:mm por [enviadoPor]"
4. Botão "Enviar" fica destructive
5. Cancelar → nada acontece
6. Tentar de novo → confirmar → segundo envio OK
7. Verificar tabela: 2 registros para o mesmo `cliente_id`

- [ ] **Step 6: Teste funcional — erro SendGrid**

1. Temporariamente substituir `SENDGRID_API_KEY` no `.env` por algo inválido (ex: `SG.INVALID`)
2. Reiniciar server
3. Tentar enviar novamente
4. Toast vermelho "Falha no envio" com detalhe
5. Verificar tabela: registro com `status=erro` e `erro=<detalhe>`
6. Restaurar API key correta

- [ ] **Step 7: Atualizar Obsidian e chamado (workflow pós-task — CLAUDE.md)**

- Atualizar task correspondente no vault `/Users/mac0267/Documents/Obsidian Vault/Córtex 2.0/Tasks/` se aplicável
- Se houver chamado associado, atualizar status para `review`

---

## Self-Review

### Cobertura da spec

| Spec section | Task |
|---|---|
| §2.1 Envio via SendGrid | Tasks 3, 4 |
| §2.1 Tabela de auditoria | Task 2 |
| §2.1 BCC automático | Task 3 (service) |
| §2.1 Dialog confirmação | Task 6 |
| §2.1 Duplicata | Tasks 4 (GET), 6 (dialog), 7 (integração) |
| §2.1 Histórico via endpoint | Task 4 |
| §2.1 Remoção mailto | Task 7 |
| §3 Decisões | Tasks 1 (env), 3 (payload) |
| §4 Arquitetura | Todas |
| §5 Backend detalhado | Tasks 1, 2, 3, 4 |
| §6 Frontend detalhado | Tasks 5, 6, 7 |
| §7 Error handling | Tasks 3, 4, 7 |
| §8.1 Unit backend | Task 3 |
| §8.2 Unit frontend | Task 5 |
| §8.3 Manual QA | Task 8 |
| §9 Segurança (escape HTML) | Task 5 |

### Placeholders

Nenhum TBD/TODO. Todos steps têm código concreto ou comandos claros.

### Consistência de tipos

- `SendParams` / `SendResult` definidos em Task 3, usados em Task 4
- Drizzle `notificacoesExtrajudiciaisEnviadas` definido em Task 2, usado em Task 4
- `ConfirmacaoEnvioDialogProps.ultimoEnvio` tipo `UltimoEnvio` — subset de `/notificacoes-enviadas` payload (só `enviadoEm`, `enviadoPor`) — consistente
- `cliente.idCliente: string` adicionado ao prop do modal (Task 7 Step 1) — call site em Negativacao atualizado no mesmo task (Step 7)
- Schema Zod `enviarNotificacaoSchema` no backend bate com body enviado do frontend (mutation Task 7 Step 4)

Plano completo.
