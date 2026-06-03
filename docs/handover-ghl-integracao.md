# Handover — Integração GoHighLevel (GHL) no Cortex

**Branch:** `feature/ghl-integracao`
**Data:** 2026-05-22 (sessão 3, atualização final)
**Status:** Implementação completa (15 commits). Pendente abrir PR, deploy, cadastrar webhook GHL e validar BASE_TAG_MAP com Marketing.
**Escopo:** Relatórios de Email Marketing, WhatsApp Marketing, Tags + dashboard avançado (Diagnóstico, Biblioteca, Calendário, Gerador IA) baseado em inteligência de domínio do estagiário Turbo.

## Sumário executivo dos findings

| Item | Resultado |
|---|---|
| PIT auth | ✅ Funciona (`Authorization: Bearer ${PIT}` + `Version: 2021-07-28`) |
| Location | Turbo Partners (BR/ES, timezone São Paulo) |
| Tags | 191 tags, nomenclatura `[categoria]_subitem` bem estruturada |
| Contatos | **48.030** — paginação cursor (`startAfter` + `startAfterId`) |
| Conversas | **46.386** — filtrável por `lastMessageType` (7.179 WhatsApp) |
| Campanhas Email | **191** — vem com `totalCount/success/failed/processed/dateScheduled` |
| Open/Click/Bounce de email | ❌ **NÃO existe via REST** — requer webhook |

---

## 1. Contexto

A Turbo usa GoHighLevel (GHL) para Conversas (WhatsApp/Email/SMS) e dispara campanhas de Email e WhatsApp Marketing por lá. Hoje esses dados ficam isolados — o Cortex não tem visibilidade de performance dessas campanhas nem de evolução de tags de contatos.

**Objetivo:** trazer pro Cortex dashboards de:
- **Email Marketing**: open rate, click rate, bounce rate, unsubscribe rate por campanha; evolução temporal.
- **WhatsApp Marketing**: volume enviado/recebido, response rate, tempo médio de resposta.
- **Tags**: distribuição atual de contatos por tag, evolução de tags-chave no tempo.

Escopo limitado: **1 sublocation só** (token único, sem multi-tenancy).

---

## 2. Autenticação — Private Integration Token (PIT)

GHL oferece três formas de auth (OAuth 2.0, API Key v1 legada, PIT). Pra 1 sublocation e uso interno, **PIT é o caminho certo**: token longo, sem refresh, escopos definidos na criação.

### Como gerar o PIT

1. Logar no GHL com conta admin da sublocation.
2. **Settings** (engrenagem, canto inferior esquerdo) → **Private Integrations** (no menu lateral, dentro de Settings da sub-conta — não da agência).
3. Clicar **Create New Integration**.
4. Nome sugerido: `Cortex - Relatórios`.
5. **Escopos necessários** (marcar todos):
   - `contacts.readonly`
   - `contacts/tags.readonly` (ou equivalente — pode aparecer como `locations/tags.readonly`)
   - `conversations.readonly`
   - `conversations/message.readonly`
   - `emails/schedule.readonly` (ou `emails.readonly` se aparecer assim)
   - `emails/builder.readonly`
   - `locations.readonly`
   - `opportunities.readonly` (opcional — útil se depois integrarmos pipelines)
6. Confirmar e **copiar o token na hora** (não é mostrado de novo).
7. Pegar o **Location ID** em Settings → Business Info (campo "Location ID" ou na URL `/v2/location/{LOCATION_ID}/...`).

### Onde guardar

`.env` (e Replit Secrets na produção):
```
GHL_PIT_TOKEN=pit-xxxxxxxxxxxxxxxx
GHL_LOCATION_ID=xxxxxxxxxxxxxxxx
GHL_API_VERSION=2021-07-28
```

> **Nota:** `Version` header é obrigatório em chamadas v2. Valor padrão atual: `2021-07-28`. Documentar e versionar.

### Como autenticar nas requests

```
Authorization: Bearer ${GHL_PIT_TOKEN}
Version: 2021-07-28
Accept: application/json
```

Base URL: `https://services.leadconnectorhq.com`

---

## 3. Endpoints CONFIRMADOS (testados 2026-05-22)

### Auth header (todos os requests)
```
Authorization: Bearer ${GHL_PIT_TOKEN}
Version: 2021-07-28
Accept: application/json
```
Base: `https://services.leadconnectorhq.com`

### Contacts & Tags
- `GET /locations/{LOC}/tags` ✅ — retorna `{tags: [{id, name, locationId}]}` (191 tags).
- `GET /contacts/?locationId={LOC}&limit=100` ✅ — retorna `{contacts: [...], meta: {total, nextPageUrl, startAfterId, startAfter}}`. **Paginação**: na próxima request passar `&startAfter={ms}&startAfterId={id}` da resposta anterior (cursor). Campos relevantes: `id`, `email`, `phone`, `tags[]`, `dateAdded`, `dateUpdated`, `attributions[]` (UTMs primeiros e últimos!), `customFields[]`, `contactName`, `type` (lead/customer).
- `GET /contacts/{contactId}` — detalhe completo de um contato.
- Filtros úteis: `&query=` (texto livre, retorna 22310 pra "lead"), `&tagIds[]=...`.

### Conversations & Messages
- `GET /conversations/search?locationId={LOC}&limit=100` ✅ — **GET, não POST** (POST retorna 404). Retorna `{conversations: [...], total: 46386}`. Campos: `id`, `contactId`, `lastMessageType` (`TYPE_EMAIL` | `TYPE_WHATSAPP` | `TYPE_SMS` | `TYPE_PHONE`...), `lastMessageDirection`, `lastMessageDate` (Unix ms), `unreadCount`, `tags[]` (do contato), `email`, `phone`, `contactName`.
- Filtros confirmados: `&lastMessageType=TYPE_WHATSAPP` (filtra 7.179), idem para outros tipos. **Não há paginação por cursor documentada aqui** — `startAfterDate` provavelmente funciona, validar na implementação. Limite máximo testar (100 é seguro).
- `GET /conversations/{convId}/messages?limit=100` ✅ — retorna `{messages: {messages: [...], lastMessageId, nextPage: bool}}` (atenção à dupla aninhada). Cada msg tem: `id`, `direction`, `status` (sempre `sent` — não atualiza pra `delivered/opened`), `type` (3=email), `messageType` (`TYPE_EMAIL` etc), `body` (HTML), `contentType`, `dateAdded`, `meta.email.messageIds[]` (ID interno do tracking de email), `meta.email.subject`, `source` (`workflow` | `bulk` | `manual` | ...).
- `GET /conversations/messages/email/{emailMsgId}` ✅ — detalhe de email específico (mesmo `sent`, sem opens/clicks).
- `GET /conversations/messages/{msgId}` ✅ — detalhe genérico de qualquer mensagem.

### Email Marketing — Campanhas
- `GET /emails/schedule?locationId={LOC}&limit=100` ✅ — retorna `{schedules: [...], total: [{total: 191}], count: 191}`. Cada campanha: `id`, `name`, `subject`, `campaignType` (`send_now` | `drip_schedule` | `schedule_later`), `status` (`complete` | `scheduled` | `draft`), `dateScheduled` (Unix ms), `totalCount`, `success` (entregues), `processed` (tentativas), `failed`, `error`, `queuedCount`, `hasTracking`, `hasUtmTracking`, `isPlainText`, `templateId`, `previewUrl`. **Sem opens/clicks aqui.**
- `GET /emails/builder?locationId={LOC}&limit=100` ✅ — só templates (96), não interessa pra métricas.
- ❌ **Open/click/bounce stats não existem via REST** (4 variantes testadas: `/emails/{id}/stats`, `/emails/{id}/statistics`, `/emails/schedule/{id}/stats`, `/reports/email-events`, todos 404). Caminho oficial = webhook (ver seção 8).

### WhatsApp Marketing
GHL não tem objeto "campanha de WhatsApp". Disparos saem via Workflows ou Bulk Actions. Métricas a derivar de `messages`:
- Enviadas = `messageType=TYPE_WHATSAPP AND direction=outbound`
- Recebidas = mesmo com `direction=inbound`
- Response rate = % de outbound seguido de inbound do mesmo contact em janela X
- Status individual (`delivered/read`) **não chega via API** — mesmo limite do email.

> Aviso de campo: `source` na mensagem (`workflow` vs `bulk` vs `manual`) é a melhor forma de identificar disparo de marketing vs conversa 1:1.

---

## 4. Schema Postgres proposto

Schema novo: `ghl`.

```sql
CREATE SCHEMA IF NOT EXISTS ghl;

CREATE TABLE ghl.contacts (
  id TEXT PRIMARY KEY,                 -- GHL contact ID
  email TEXT,
  phone TEXT,
  name TEXT,
  tags TEXT[],                          -- snapshot atual de tags
  date_added TIMESTAMPTZ,
  date_updated TIMESTAMPTZ,
  source TEXT,
  custom_fields JSONB,
  synced_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_ghl_contacts_email ON ghl.contacts (email);
CREATE INDEX idx_ghl_contacts_tags ON ghl.contacts USING GIN (tags);

CREATE TABLE ghl.conversations (
  id TEXT PRIMARY KEY,
  contact_id TEXT REFERENCES ghl.contacts(id),
  type TEXT,                            -- WhatsApp | Email | SMS | ...
  last_message_at TIMESTAMPTZ,
  unread_count INT,
  starred BOOLEAN,
  date_added TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ghl.messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES ghl.conversations(id),
  contact_id TEXT,
  direction TEXT,                       -- inbound | outbound
  channel TEXT,                         -- WhatsApp | Email | SMS
  status TEXT,                          -- sent | delivered | read | failed | bounced
  body TEXT,
  date_added TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_ghl_messages_conv ON ghl.messages (conversation_id);
CREATE INDEX idx_ghl_messages_date ON ghl.messages (date_added);
CREATE INDEX idx_ghl_messages_channel_dir ON ghl.messages (channel, direction);

CREATE TABLE ghl.email_campaigns (
  id TEXT PRIMARY KEY,                  -- schedule id do GHL
  name TEXT,
  subject TEXT,
  campaign_type TEXT,                   -- send_now | drip_schedule | schedule_later
  status TEXT,                          -- complete | scheduled | draft
  scheduled_at TIMESTAMPTZ,
  total_count INT,                      -- vem direto de /emails/schedule
  success_count INT,                    -- "entregues" segundo o GHL
  failed_count INT,
  processed_count INT,
  template_id TEXT,
  has_tracking BOOLEAN,
  has_utm_tracking BOOLEAN,
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- Open/Click vêm por webhook (não tem via REST)
CREATE TABLE ghl.email_events (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT UNIQUE,                 -- id do webhook payload (dedup)
  message_id TEXT,                      -- match com meta.email.messageIds da mensagem
  contact_id TEXT,
  campaign_id TEXT,                     -- enriquecer via join com mensagem→campanha quando possível
  event_type TEXT,                      -- EmailDelivered|Opened|Clicked|Bounced|Unsubscribed|Complained|Dropped
  occurred_at TIMESTAMPTZ,
  clicked_link TEXT,
  payload JSONB,
  received_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_ghl_email_events_message ON ghl.email_events (message_id);
CREATE INDEX idx_ghl_email_events_type_date ON ghl.email_events (event_type, occurred_at);

-- Snapshot diário pra evolução de tags
CREATE TABLE ghl.tags_snapshot (
  snapshot_date DATE NOT NULL,
  tag TEXT NOT NULL,
  contact_count INT NOT NULL,
  PRIMARY KEY (snapshot_date, tag)
);
```

> Drizzle schema correspondente vai em `shared/schema/ghl.ts`.

---

## 5. Sync jobs

### Backfill inicial (one-shot)
- Script `scripts/ghl-backfill.ts`
- 90 dias de contatos, conversas, mensagens e campanhas de email
- Rodar 1× manualmente

### Hourly
- Novos contatos e updates de tag (filtro `dateUpdated > last_sync`)
- Novas conversas + mensagens
- Atualização de stats de campanhas de email enviadas nas últimas 72h (opens/clicks chegam atrasados)

### Daily 6h
- Snapshot de tags: `INSERT INTO ghl.tags_snapshot SELECT current_date, tag, count(*) FROM ghl.contacts, unnest(tags) tag GROUP BY tag;`

### Onde rodar
Mesmo padrão dos jobs Meta/Google (provavelmente `server/jobs/*.ts` + scheduler atual). Confirmar onde fica o scheduler na Etapa 3 lendo o código.

---

## 6. Frontend — página `/ghl-marketing`

Estrutura proposta (3 abas):

### Aba 1: Email Marketing
- Cards: Total enviado, Open rate médio, Click rate médio, Bounce rate, Unsub rate (período filtrado)
- Tabela de campanhas (nome, data, enviados, open%, click%, bounce%, unsub%)
- Gráfico de linha: open rate e click rate por semana
- Filtro de período (mesmo padrão dos outros dashboards)

### Aba 2: WhatsApp Marketing
- Cards: Mensagens enviadas, Entregues, Lidas, Respondidas, Response rate
- Gráfico de barras: volume enviado vs recebido por dia
- Tempo médio de primeira resposta (do contato)
- Lista de top tags de contatos que mais respondem

### Aba 3: Tags
- Treemap ou bar chart: distribuição atual de contatos por tag
- Gráfico de linha: evolução de tags-chave (multi-select) ao longo do tempo (usa `tags_snapshot`)
- Tabela: tag, contagem atual, crescimento 7d/30d

### Componentes a reusar
- `useTheme` (dark/light obrigatório — CLAUDE.md)
- Filtro de período do `EvolucaoMensal` ou `GrowthOrcadoRealizado`
- Recharts para gráficos
- React Query para fetches

---

## 6.1 Plano de PRs

### PR 1 — Backend completo + dashboard básico
Branch: `feature/ghl-integracao`

1. Schema Drizzle (`shared/schema/ghl.ts`)
2. Migration
3. Cliente GHL com throttle (`server/services/ghl-client.ts`)
4. Script de backfill (`scripts/ghl-backfill.ts`) — contatos, conversas, mensagens, campanhas
5. **Endpoint `POST /api/webhooks/ghl`** — recebe eventos de email (Delivered/Opened/Clicked/Bounced/Unsubscribed/Complained/Dropped) e WhatsApp (status updates)
6. Jobs scheduler: hourly (delta sync) + daily 6h (snapshot tags)
7. API endpoints internos: `/api/ghl/email-campaigns`, `/api/ghl/whatsapp-metrics`, `/api/ghl/tags`
8. Página `/ghl-marketing` com 3 abas (Email / WhatsApp / Tags) — dark/light mode
9. Item no menu lateral

**Ichino faz:** cadastrar webhook na UI do GHL apontando pra URL pública do Cortex; subscrever os eventos. Eu documento o passo-a-passo no PR.

### PR 2 (futuro) — Refinamentos pós-uso
- Filtros adicionais no dashboard conforme uso real
- Cohort de tags (tag X → comportamento de conversão)
- Alertas (ex: open rate caiu 20% em uma campanha)

---

## 7. Workflow de execução (próximas sessões)

### Etapa 3 — INVESTIGAR (próxima sessão, depois do PIT)
1. Receber `GHL_PIT_TOKEN` + `GHL_LOCATION_ID` do Ichino
2. Rodar curls reais nos endpoints listados na seção 3
3. Documentar formato exato de resposta (campos disponíveis, paginação, rate limits)
4. **Especialmente**: descobrir como pegar stats de Email Marketing (open/click) — é o ponto mais incerto
5. Atualizar este handover com endpoints confirmados

### Etapa 4 — IMPLEMENTAR
1. Schema Drizzle (`shared/schema/ghl.ts`)
2. Migration
3. Cliente GHL (`server/services/ghl-client.ts`)
4. Script de backfill (`scripts/ghl-backfill.ts`)
5. Jobs de sync (hourly + daily)
6. API endpoints (`/api/ghl/email-campaigns`, `/api/ghl/whatsapp-metrics`, `/api/ghl/tags`)
7. Página `client/src/pages/GhlMarketing.tsx` + rota
8. Item no menu lateral

### Etapa 5 — TESTAR
- Backfill rodando sem erro
- Dashboard com dados reais em ambos os temas
- Conferir números com a UI do próprio GHL (sanity check)

### Etapa 6+ — Commit, review, PR

---

## 8. Riscos, decisões e incógnitas

### 8.1 ✅ DECIDIDO: Stats de Email exigem webhook
Investigado em 2026-05-22 — REST não expõe open/click/bounce. Caminho oficial GHL = **webhooks de evento de email**. Implementação:

1. Criar endpoint público `POST /api/webhooks/ghl` no Cortex (mesmo padrão do que já existe pra outras integrações, se tiver).
2. No GHL: **Settings → Webhooks** (ou Workflows com "Webhook Trigger" se Settings não tiver esse painel — confirmar na hora) → cadastrar URL + escolher eventos:
   - `EmailDelivered` — entregue
   - `EmailOpened` — open (com `messageId`, `timestamp`, `contactId`)
   - `EmailClicked` — click (idem + `clickedLink`)
   - `EmailBounced` — bounce
   - `EmailUnsubscribed` — descadastro
   - `EmailComplained` — marcado como spam
   - `EmailDropped` — descartado (lista suprimida)
3. Persistir cada evento em `ghl.email_events (event_id, message_id, contact_id, event_type, occurred_at, payload jsonb)`.
4. Métricas da campanha = agregação dessas events + join com `ghl.email_campaigns` (campanha veio do `/emails/schedule`; vincular pelo `messageId` que está na `meta.email.messageIds` da mensagem na conversation).

**MVP sem webhook** (PR 1): mostrar só `success/totalCount` (= delivery rate) e `failed/totalCount` (= bounce rate aprox). PR 2 adiciona webhooks pra open/click.

### 8.2 Status individual de mensagem NÃO atualiza
`status: sent` para sempre, mesmo em mensagens entregues há horas. Não dá pra contar "lidas" sem webhook. Aplica-se a Email **E** WhatsApp.

### 8.3 Rate limit GHL
Documentação oficial: 100 req/10s por location (burst), 200.000 req/dia. Backfill de 48k contatos a 100 req com `limit=100` = ~480 requests → ~50s no mínimo respeitando o rate. Conversas idem. **Implementar throttle no cliente** (`bottleneck` ou similar — verificar o que o projeto já usa).

### 8.4 Cobertura de "WhatsApp Marketing"
GHL não tem objeto "campanha de WhatsApp". Métricas saem agregadas de `messages`. Validar com Ichino se o que ele chama de "WhatsApp Marketing" é:
- (a) Disparos em massa via Workflow/Bulk → filtrar por `source IN ('workflow','bulk')`
- (b) Todo tráfego WhatsApp (incluindo SDR 1:1) → não filtrar por source

### 8.5 Tags como string[] sem ID estável
Tags têm `id` na listagem (`/locations/{id}/tags`) mas no contato vêm como `name`. Renomear no GHL **mantém o id** mas muda o `name` — o array em `contact.tags[]` reflete a mudança. Snapshot diário em `ghl.tags_snapshot` mitiga futuro; histórico anterior à integração não existe.

### 8.6 Paginação de Conversations
Resposta NÃO trouxe `nextPage` ou `startAfter` óbvios — só `total`. Provável que aceite `startAfterDate=` ou `startAfter=` (Unix ms do `lastMessageDate`). **Validar na implementação** com curl real antes de codar o sync.

---

## 8.7 Expansão broadcast dashboard (sessão 3)

Após a PR 1A (Email/WhatsApp/Tags), foram trazidas 4 abas adicionais do dashboard-broadcast do estagiário Turbo (ZIP de 2026-05-22). A inteligência de domínio foi convertida pra TypeScript em `shared/ghl-broadcast/`:

| Helper | O que tem |
|---|---|
| `types.ts` | StatusMensagem, Servico, OfertaKey, PadraoKey, CategoriaBase, Alerta |
| `benchmarks.ts` | BENCHMARKS_TURBO por canal × categoria (wpp 25-50%, email 4-12%), avaliarPerformance(), CLASSIFICACAO_TAILWIND |
| `matriz-validacao.ts` | BASE_CATEGORIAS (18 bases), validarCombinacao() com 5 BLOCK + 6 WARN, COMPATIBILIDADE_BASE_{PADRAO,OFERTA} |
| `regras-calendario.ts` | LIMITES_MENSAIS por base, validarCadencia() (janela 7d/14d/limite mensal) |
| `base-tag-map.ts` | BASE_TAG_MAP: 18 bases nominais → filtros tagsAny/tagsAll/tagsNot das tags reais GHL |

### Abas novas em `/ghl-marketing`

| Aba | Endpoint | O que faz |
|---|---|---|
| **Diagnóstico** | `GET /api/ghl/diagnostico` | 18 queries paralelas (1 por base). Aplica benchmarks Turbo nos dados reais. Scatter chart volume × response rate, ranking de bases, insights automáticos |
| **Biblioteca** | `GET /api/ghl/messages` + `:id` | Histórico read-only de `ghl_messages` com filtros (canal, direção, source, base via BASE_TAG_MAP, busca). Paginação 50/pg, modal de detalhes |
| **Calendário** | `GET /api/ghl/calendar` | Grid mensal com broadcasts detectados (email campaigns + WA com >= 30 msgs/dia). Validação retroativa: badge âmbar se outro broadcast em 7d |
| **Gerador IA** | `POST /api/ghl/copy/{analyze,generate}` + `GET top-performers` | Claude haiku-4-5. Analisar copy retorna score 0-100 + critérios + sugestão. Gerar retorna 3 variações usando exemplos reais do banco (msgs com mais respostas em 48h) |

### Service

- `server/services/ghlCopyAi.ts` — wrapper Anthropic SDK com prompts adaptados do estagiário. Modelo `claude-haiku-4-5-20251001`. Usa `ANTHROPIC_API_KEY` que já existe no `.env`.
- `buscarTopPerformers()` — SQL agregando msgs WA outbound de `workflow/bulk/campaign` com replies em 48h, ordenando por replies desc.

### Decisões fechadas

1. Biblioteca = só histórico read-only (sem CRUD de planejamento). Não foi criada tabela `ghl_planned_broadcasts`.
2. Calendário mostra envios reais, sem planejamento.
3. IA usa ANTHROPIC_API_KEY existente. Modelo haiku-4-5 (rápido, barato).
4. Tudo em `/ghl-marketing`, não páginas separadas.

### Limitações conhecidas

1. Diagnóstico usa response rate como proxy de open rate (sem webhook ainda).
2. `BASE_TAG_MAP` é best-effort do snapshot 182 tags de 2026-05-22. Precisa validação da equipe de Marketing — bases podem trazer 0 contatos se tags reais tiverem nome diferente.
3. Calendário detecta WA broadcasts por heurística (>=30 msgs/dia outbound workflow/bulk). Pode falhar com volumes menores.

## 9. Checklist pra retomar

- [x] Ichino gerou o PIT no GHL e copiou o token
- [x] Ichino passou `GHL_PIT_TOKEN` + `GHL_LOCATION_ID` (já no `.env` local — não commitado)
- [x] Curls reais rodados em todos os endpoints da seção 3 (2026-05-22)
- [x] Confirmado: Email open/click só via webhook (decisão na 8.1)
- [x] **Decisão (2026-05-22)**: webhook implementado na PR 1 → Open/Click/Bounce desde o início
- [x] **Decisão (2026-05-22)**: sync de TODOS os sources (workflow + bulk + manual + api) com coluna `source` preservada. Filtros aplicados em queries/frontend, não no sync. Default de "WhatsApp Marketing" nas visualizações = `source IN ('workflow','bulk')`, mas dashboard terá filtro flexível.
- [x] Schema das 7 tabelas em `cortex_core.ghl_*` (Drizzle + SQL aplicado)
- [x] Cliente GHL com throttle (`server/services/goHighLevelSync.ts`)
- [x] Script de backfill (`scripts/ghl-backfill.ts`) — rodado: 48k contatos, 4.1k WA conversations, 43.5k messages, 191 campaigns, 182 tags
- [x] Endpoint `POST /webhooks/ghl` (sem auth, dedup por event_id) — testado com payload sintético
- [x] Jobs de sync no scheduler (hourly delta + daily tags snapshot às 00:10)
- [x] Dashboard `/ghl-marketing` com 7 abas + dark/light mode
- [x] Helpers do dashboard-broadcast (estagiário) em `shared/ghl-broadcast/`
- [x] Abas Diagnóstico + Biblioteca + Calendário + Gerador IA (Claude haiku-4-5)
- [ ] **PR aberta contra `main`** ← próximo passo
- [ ] Deploy em prod (Replit)
- [ ] Cadastrar webhook GHL (`/webhooks/ghl`) em Automations → Workflows (ver §8.1)
- [ ] Validar `BASE_TAG_MAP` com equipe de Marketing — refinar tags por base
