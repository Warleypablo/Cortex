# Notificação Extrajudicial — Envio via SendGrid (Fase 2) — Design

**Data:** 2026-04-23
**Autor:** Warleypablo + Claude
**Status:** Aprovado para implementação
**Fase:** 2 (envio efetivo) — segue Fase 1 (`2026-04-23-notificacao-extrajudicial-juridico-design.md`)

---

## 1. Contexto e objetivo

A Fase 1 entregou geração do texto da notificação extrajudicial + ações client-side (copiar, abrir mailto). Esta fase 2 adiciona **envio server-side via SendGrid** com auditoria completa, cópia interna automática e detecção de duplicatas. O botão "Abrir no email" (mailto) é removido — o envio passa a ser 100% server-side.

## 2. Escopo

### 2.1 Dentro do escopo

- Envio via SendGrid (plain text + HTML fallback)
- Tabela de auditoria `cortex_core.notificacoes_extrajudiciais_enviadas` com corpo completo, usuário, status
- BCC automático para `juridico@turbopartners.com.br`
- Dialog de confirmação antes do envio
- Detecção e aviso de duplicata (cliente já notificado antes)
- Histórico por cliente exposto via endpoint
- Remoção do botão "Abrir no email" (mailto)

### 2.2 Fora do escopo

- Geração de PDF anexado (fica para Fase 3)
- Webhook SendGrid para status delivered/bounced (fica para Fase 3)
- UI de histórico de notificações (tabela com lista de envios) — só endpoint nessa fase
- Templates variados (protesto, ação judicial) — continua só notificação
- Logo no HTML — assinatura textual apenas

## 3. Decisões consolidadas

| Item | Escolha |
|---|---|
| Provedor | SendGrid (`@sendgrid/mail`) |
| Remetente | `juridico@turbopartners.com.br` |
| Display name | `Departamento Jurídico - Turbo Partners` |
| Reply-to | `juridico@turbopartners.com.br` (mesmo endereço) |
| BCC | `juridico@turbopartners.com.br` (arquivo interno) |
| Formato | HTML + plain text fallback |
| Logo no email | Sem logo |
| Duplicata | Dialog de aviso (permite reenvio consciente) |
| Anexo PDF | Não |
| Confirmação pré-envio | Obrigatória (AlertDialog) |

## 4. Arquitetura

### 4.1 Fluxo end-to-end

```
Modal → botão "Enviar agora"
  → query GET /api/negativacao/cliente/:id/notificacoes-enviadas
      → retorna lista (último envio em destaque se existir)
  → abre ConfirmacaoEnvioDialog
      ├─ exibe email destino, display name do remetente
      ├─ se há histórico: aviso amarelo "já notificado em dd/mm"
      └─ botões: Cancelar / Enviar
  → Enviar → mutation POST /api/negativacao/notificacoes/enviar
      → Backend:
          1. Validação (Zod)
          2. INSERT notificacoes_extrajudiciais_enviadas (status=enviado tentativo)
          3. Chama SendGridService.send()
          4. UPDATE com sendgrid_message_id e status final
          5. Retorna { id, status, enviadoEm, sendgridMessageId }
  → Sucesso: toast verde, fecha modal, invalida query de histórico
  → Erro: toast vermelho com detalhe, modal permanece aberto para retry
```

### 4.2 Componentes

**Backend:**
| Arquivo | Ação |
|---|---|
| `package.json` | + `@sendgrid/mail` |
| `.env` + `.env.example` | 4 env vars novas |
| `migrations/YYYY-MM-DD-create-notificacoes-enviadas.sql` | Criar |
| `shared/schema.ts` | Adicionar tabela Drizzle |
| `server/services/sendgrid-notification.ts` | Criar (wrapper puro) |
| `server/services/sendgrid-notification.test.ts` | Criar |
| `server/routes/negativacao.ts` | +2 endpoints |

**Frontend:**
| Arquivo | Ação |
|---|---|
| `client/src/lib/notificacao-extrajudicial.ts` | + `renderizarNotificacaoHtml` |
| `client/src/lib/notificacao-extrajudicial.test.ts` | + testes do HTML |
| `client/src/components/juridico/ConfirmacaoEnvioDialog.tsx` | Criar |
| `client/src/components/juridico/NotificacaoExtrajudicialModal.tsx` | Trocar mailto por envio server-side + confirmação + histórico |

## 5. Backend

### 5.1 Env vars

```bash
SENDGRID_API_KEY=SG.xxxxx
SENDGRID_FROM_EMAIL=juridico@turbopartners.com.br
SENDGRID_FROM_NAME=Departamento Jurídico - Turbo Partners
SENDGRID_BCC_EMAIL=juridico@turbopartners.com.br
```

### 5.2 Schema (Drizzle + SQL migration)

```ts
export const notificacoesExtrajudiciaisEnviadas = cortexCore.table(
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

SQL migration espelha Drizzle + índices em `cliente_id` e `enviado_em DESC`.

### 5.3 Service `sendgrid-notification.ts`

```ts
interface SendParams {
  to: string;
  subject: string;
  text: string;
  html: string;
}

interface SendResult {
  messageId: string;
}

export class SendGridError extends Error {
  constructor(public status: number, public body: any, message: string) {
    super(message);
  }
}

export async function sendNotificacaoExtrajudicial(params: SendParams): Promise<SendResult>;
```

Lê config do `.env`. Configura `sgMail.setApiKey()` na primeira chamada. Monta payload com `from`, `replyTo`, `bcc` automático. Retorna `messageId` extraído de `response.headers['x-message-id']`. Lança `SendGridError` em 4xx/5xx.

### 5.4 Endpoints

**`GET /api/negativacao/cliente/:clienteId/notificacoes-enviadas`**

Retorna array ordenado por `enviado_em DESC` (mais recente primeiro), limitado a 10 registros. Campos: `{ id, emailDestino, enviadoPor, enviadoEm, status }` (omite corpo para economizar payload).

**`POST /api/negativacao/notificacoes/enviar`**

Body validado via Zod:
```ts
{
  clienteId: z.string().min(1),
  clienteNome: z.string().optional(),
  emailDestino: z.string().email(),
  assunto: z.string().min(10).max(200),
  corpoTexto: z.string().min(100).max(50000),
  corpoHtml: z.string().min(100).max(100000),
}
```

Fluxo:
1. `INSERT` com `status=enviado` (otimista)
2. Chama `sendNotificacaoExtrajudicial()`
3. Se OK: `UPDATE sendgrid_message_id = ?, status = 'enviado'`
4. Se erro: `UPDATE status = 'erro', erro = <detalhe>` e retorna 500 com o erro visível ao usuário

Response: `{ id, sendgridMessageId, status, enviadoEm }`.

Usuário logado via `(req as any).user?.name || (req as any).user?.googleId || 'Sistema'`.

## 6. Frontend

### 6.1 Função `renderizarNotificacaoHtml(texto: string): string`

Pure function. Transformações:
- Split por `\n\n` → parágrafos
- Primeiro parágrafo → `<h2 style="font-size:16px;font-weight:bold;margin-bottom:20px;">`
- Parágrafos com `NOTIFICANTE:` ou `NOTIFICADA:` → primeira palavra em `<strong>`
- Demais → `<p style="margin:12px 0;line-height:1.6;">`
- Wrap final: `<div style="font-family:Georgia,'Times New Roman',serif;max-width:600px;color:#1a1a1a;padding:20px;">...</div>`

Determinística, testável, sem dependências externas.

### 6.2 Componente `ConfirmacaoEnvioDialog`

Usa `AlertDialog` do shadcn. Props:

```ts
interface ConfirmacaoEnvioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  emailDestino: string;
  clienteNome: string;
  ultimoEnvio?: { enviadoEm: string; enviadoPor: string } | null;
  isSending: boolean;
}
```

Renderiza:
- Título: `Confirmar envio da notificação?`
- Corpo:
  - `Para: ${emailDestino}`
  - `Cliente: ${clienteNome}`
  - `De: Departamento Jurídico - Turbo Partners <juridico@turbopartners.com.br>`
  - Se `ultimoEnvio`: alert amarelo "⚠ Este cliente já foi notificado em dd/mm/aaaa às hh:mm por [enviadoPor]."
- Footer:
  - Cancelar (secundário, fecha)
  - Enviar (primário; `variant="destructive"` se `ultimoEnvio` existe; mostra spinner se `isSending`)

### 6.3 Modal principal — mudanças

- Remove `handleAbrirEmail`, botão "Abrir no email", constante `MAILTO_MAX_LENGTH`
- Remove import de `Mail` icon (continua tendo `Copy`, `AlertTriangle`, `RotateCcw`, e novo `Send`)
- Adiciona query `useQuery` para `/api/negativacao/cliente/${cliente.idCliente}/notificacoes-enviadas`
  - (cliente precisa expor `idCliente` — ajustar prop shape)
- Adiciona mutation `useMutation` para POST
- Estado `[confirmacaoOpen, setConfirmacaoOpen]`
- Botão "Copiar texto" **permanece** (útil para arquivo paralelo)
- Botão novo "Enviar agora" (primário): abre `ConfirmacaoEnvioDialog`
- Dentro do `ConfirmacaoEnvioDialog`: confirmação chama mutation com `{ clienteId, emailDestino: form.email, assunto, corpoTexto: preview, corpoHtml: renderizarNotificacaoHtml(preview) }`
- Sucesso da mutation: toast "Notificação enviada com sucesso", fecha dialog + modal, invalida query de histórico do kanban (caso exista)

### 6.4 Propagação de `clienteId`

Na integração atual (`Negativacao.tsx`), o modal recebe `cliente` sem `idCliente`. Vamos adicionar o ID ao shape da prop para poder fazer a query de histórico e enviar no body do POST.

```ts
cliente: ClienteParaNotificacao & {
  idCliente: string;
  email: string | null;
  endereco: string | null;
  servicos: string | null;
};
```

Call site em `Negativacao.tsx` passa `idCliente: notificacaoClienteId`.

## 7. Error handling

| Cenário | Tratamento |
|---|---|
| Email destino inválido (regex) | Botão "Enviar agora" desabilitado |
| SendGrid 401/403 (API key inválida) | Toast "API key do SendGrid inválida — contate o admin"; grava status=erro |
| SendGrid 403 (sender não verificado) | Toast "Remetente não verificado — contate o admin"; status=erro |
| SendGrid 5xx | Toast "Serviço de email indisponível, tente novamente em instantes"; status=erro |
| Timeout rede (30s) | Toast "Timeout no envio"; status=erro; registro fica para retry manual |
| Usuário não autenticado | 401 do middleware `/api` — toast genérico |
| Body inválido (Zod) | 400 com lista de erros; toast com detalhes |
| Corpo > 50KB | Validação bloqueia (limite SendGrid é ~30MB mas aqui protegemos o banco) |

Todos os erros gravam linha na tabela de auditoria com `status=erro` e `erro=<detalhe>`, exceto validação Zod que falha antes do INSERT.

## 8. Testes

### 8.1 Unit backend

`server/services/sendgrid-notification.test.ts`:
1. Mock de `@sendgrid/mail` — valida payload construído (from, replyTo, bcc, to, subject, text, html)
2. Retorna `messageId` do header `x-message-id`
3. Lança `SendGridError` em 4xx
4. Lança `SendGridError` em 5xx
5. Lê env vars corretamente

### 8.2 Unit frontend

Adicionar ao `notificacao-extrajudicial.test.ts`:
1. `renderizarNotificacaoHtml` gera `<h2>` para primeira linha
2. Aplica `<strong>` em `NOTIFICANTE:` e `NOTIFICADA:`
3. Usa `<p>` para demais parágrafos
4. Inclui inline styles de fonte serif
5. Escapa caracteres especiais (`<`, `>`, `&`) no corpo (proteção XSS mesmo sendo email)

### 8.3 Manual (QA)

1. Configurar `SENDGRID_API_KEY` e demais env vars
2. Rodar migration no banco local
3. Enviar email de teste para `teste@turbopartners.com.br` (ou outro email pessoal do dev) — verificar:
   - Chegou na inbox
   - Display name correto
   - Reply-to aparece ao responder
   - BCC chegou na caixa `juridico@`
   - Formatação HTML renderiza bem em Gmail/Outlook
   - Plain text aparece como fallback (visível em clientes sem HTML)
4. Tentar enviar de novo mesmo cliente → dialog de duplicata aparece
5. Confirmar reenvio → segundo envio registrado na tabela
6. Testar com API key inválida → toast de erro + registro com `status=erro`
7. Conferir tabela `cortex_core.notificacoes_extrajudiciais_enviadas`: 3 linhas (2 envios OK + 1 erro)

## 9. Segurança

- API key do SendGrid **nunca** no código — só em `.env` (não commitado)
- `.env.example` listado com valores placeholder para onboarding
- Endpoint `POST` requer auth (middleware `/api` já garante)
- Rate limiting: ainda não implementado (a conta SendGrid tem limite global que protege contra abuso acidental)
- Corpo do email é auditado em texto puro — nada é executado/avaliado; escape de HTML aplicado no `renderizarNotificacaoHtml` para prevenir injeção via preview editado

## 10. Referências

- Fase 1: `docs/superpowers/specs/2026-04-23-notificacao-extrajudicial-juridico-design.md`
- Fase 1 plan: `docs/superpowers/plans/2026-04-23-notificacao-extrajudicial-juridico.md`
- SendGrid API: https://github.com/sendgrid/sendgrid-nodejs/tree/main/packages/mail
- Tabela `cortex_core.negativacao_acoes` (não modificada)
- `caz_clientes` (não modificada — dados já fluem via endpoint Fase 1)
