# CONTEXTO DO PROJETO — Instagram Analytics Platform

## 🎯 Objetivo
Construir uma plataforma web que se conecta ao Instagram via **API oficial (Meta Graph API)** para extrair métricas e insights de contas Business/Creator. O sistema deve ser robusto, seguro, escalável e pronto para produção.

---

## 🧱 Stack Técnica

- **Backend:** Node.js + TypeScript + Fastify (ou Express)
- **Banco de Dados:** PostgreSQL com Drizzle ORM (ou Prisma)
- **Frontend:** React + TypeScript + TailwindCSS + shadcn/ui
- **Autenticação:** OAuth 2.0 via Meta (Facebook Login)
- **Infra:** Docker Compose para desenvolvimento local
- **Variáveis de ambiente:** dotenv + validação com zod

> Se o usuário especificar outra stack, adapte sem questionar.

---

## 📐 Arquitetura do Sistema

```
/
├── apps/
│   ├── api/              # Backend Fastify/Express
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   │   ├── instagram/
│   │   │   │   │   ├── auth.service.ts
│   │   │   │   │   ├── media.service.ts
│   │   │   │   │   ├── insights.service.ts
│   │   │   │   │   └── webhook.service.ts
│   │   │   ├── db/
│   │   │   │   ├── schema.ts
│   │   │   │   └── migrations/
│   │   │   ├── middlewares/
│   │   │   └── utils/
│   └── web/              # Frontend React
│       └── src/
│           ├── pages/
│           ├── components/
│           └── hooks/
├── docker-compose.yml
└── .env.example
```

---

## 🔐 Fluxo de Autenticação OAuth (PRIORIDADE 1)

### Como funciona:
1. Usuário clica em "Conectar Instagram"
2. Redireciona para `https://www.facebook.com/v21.0/dialog/oauth`
3. Usuário autoriza o app no Facebook
4. Meta retorna `code` via redirect_uri
5. Backend troca o `code` por `short-lived access token`
6. Backend troca pelo `long-lived access token` (válido 60 dias)
7. Salvar token criptografado no banco

### Escopos necessários (solicitar apenas o mínimo):
```
instagram_basic
instagram_manage_insights
instagram_content_publish     (se for publicar)
pages_show_list
pages_read_engagement
business_management
```

### Endpoints de autenticação a implementar:
```
GET  /auth/instagram           → redireciona para Meta OAuth
GET  /auth/instagram/callback  → recebe code, troca por token, salva
POST /auth/instagram/refresh   → renova long-lived token
DELETE /auth/instagram/revoke  → revoga acesso e limpa token
GET  /auth/instagram/status    → verifica validade do token atual
```

### Schema do banco para tokens:
```sql
CREATE TABLE instagram_connections (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL,
  ig_user_id    TEXT NOT NULL,
  username      TEXT NOT NULL,
  access_token  TEXT NOT NULL,        -- criptografado com AES-256
  token_type    TEXT DEFAULT 'long_lived',
  expires_at    TIMESTAMP,
  scopes        TEXT[],
  account_type  TEXT,                 -- BUSINESS | CREATOR
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);
```

---

## 📊 Módulo de Métricas e Insights (CORE)

### 1. Dados do Perfil
**Endpoint Graph API:** `GET /{ig-user-id}?fields=...`

Campos a buscar:
```
id, username, name, biography, website,
followers_count, follows_count, media_count,
profile_picture_url, account_type,
ig_id
```

### 2. Insights do Perfil (conta)
**Endpoint Graph API:** `GET /{ig-user-id}/insights`

Métricas disponíveis:
```
reach                    - Alcance único (período)
impressions              - Total de impressões
profile_views            - Visualizações do perfil (DEPRECIADO v21+, verificar)
follower_count           - Crescimento de seguidores
email_contacts           - Contatos por email (DEPRECIADO v21+)
```

Períodos: `day`, `week`, `days_28`, `month`

**⚠️ ATENÇÃO:** Desde janeiro/2025 (API v21+), os seguintes campos foram DEPRECIADOS:
- `video_views` (non-Reels)
- `email_contacts` (time series)
- `profile_views`
- `website_clicks`
- `phone_call_clicks`
- `text_message_clicks`

Sempre verificar a versão da API e tratar campos depreciados com fallback gracioso.

### 3. Posts (Media)
**Endpoint Graph API:** `GET /{ig-user-id}/media?fields=...`

Campos por post:
```
id, caption, media_type, media_url, thumbnail_url,
permalink, timestamp, like_count, comments_count,
is_shared_to_feed
```

`media_type`: IMAGE | VIDEO | CAROUSEL_ALBUM | REELS

### 4. Insights por Post
**Endpoint Graph API:** `GET /{ig-media-id}/insights?metric=...`

Métricas por tipo de mídia:

| Métrica | IMAGE | VIDEO | REELS | CAROUSEL |
|---------|-------|-------|-------|----------|
| impressions | ✅ | ✅ | ✅ | ✅ |
| reach | ✅ | ✅ | ✅ | ✅ |
| likes | ✅ | ✅ | ✅ | ✅ |
| comments | ✅ | ✅ | ✅ | ✅ |
| saved | ✅ | ✅ | ✅ | ✅ |
| shares | ✅ | ✅ | ✅ | ✅ |
| plays | ❌ | ✅ | ✅ | ❌ |
| video_views | ❌ | ✅ | ✅ | ❌ |
| total_interactions | ✅ | ✅ | ✅ | ✅ |

### 5. Insights de Audiência
**Endpoint Graph API:** `GET /{ig-user-id}/insights`

```
audience_gender_age      - Breakdown por gênero e faixa etária
audience_locale          - Breakdown por idioma
audience_country         - Breakdown por país
audience_city            - Breakdown por cidade
```

**⚠️ NOTA:** Dados demográficos têm delay de até 48h e só aparecem para contas com +100 seguidores.

---

## 🔄 Estratégia de Sincronização

### Sincronização Automática (Jobs/Cron)
Implementar sistema de filas (BullMQ + Redis) para:

```
SYNC_PROFILE      → a cada 6 horas
SYNC_MEDIA        → a cada 3 horas  
SYNC_INSIGHTS     → a cada 24 horas (dados do dia anterior)
REFRESH_TOKEN     → 7 dias antes de expirar
```

### Endpoints de sync manual:
```
POST /instagram/sync/profile       → força sync do perfil
POST /instagram/sync/media         → força sync dos posts
POST /instagram/sync/insights      → força sync dos insights
GET  /instagram/sync/status        → status da última sync
```

### Schema de histórico no banco:
```sql
CREATE TABLE metrics_snapshots (
  id              SERIAL PRIMARY KEY,
  connection_id   INTEGER NOT NULL,
  ig_user_id      TEXT NOT NULL,
  metric_date     DATE NOT NULL,
  followers       INTEGER,
  following       INTEGER,
  posts_count     INTEGER,
  reach_day       INTEGER,
  impressions_day INTEGER,
  profile_views   INTEGER,
  recorded_at     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE post_metrics (
  id              SERIAL PRIMARY KEY,
  connection_id   INTEGER NOT NULL,
  ig_media_id     TEXT NOT NULL UNIQUE,
  media_type      TEXT,
  caption         TEXT,
  permalink       TEXT,
  posted_at       TIMESTAMP,
  likes           INTEGER DEFAULT 0,
  comments        INTEGER DEFAULT 0,
  saves           INTEGER DEFAULT 0,
  shares          INTEGER DEFAULT 0,
  impressions     INTEGER DEFAULT 0,
  reach           INTEGER DEFAULT 0,
  plays           INTEGER DEFAULT 0,
  total_interactions INTEGER DEFAULT 0,
  last_synced_at  TIMESTAMP
);
```

---

## 🪝 Webhooks (Opcional — para dados em tempo real)

Meta permite webhooks para eventos do Instagram:
- Novos comentários
- Novas menções
- Mensagens recebidas

```
POST /webhooks/instagram        → recebe eventos
GET  /webhooks/instagram        → verificação do Meta (hub.challenge)
```

Implementar verificação de assinatura HMAC-SHA256 com `X-Hub-Signature-256`.

---

## ⚡ Rate Limits — CRÍTICO

A Graph API tem limites rígidos. **Sempre implementar:**

### Limites por padrão:
- **200 calls/hora** por token de usuário
- **4800 calls/hora** por app (Business API)
- Hashtag search: **30 hashtags únicas/semana/conta**

### Como lidar:
```typescript
// Sempre checar headers de resposta:
// X-App-Usage: {"call_count":25,"total_cputime":10,"total_time":15}
// X-Business-Use-Case-Usage: {...}

// Implementar retry com exponential backoff:
async function callGraphAPI(url: string, retries = 3) {
  try {
    const res = await fetch(url);
    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After') || '60';
      await sleep(parseInt(retryAfter) * 1000);
      return callGraphAPI(url, retries - 1);
    }
    return res.json();
  } catch (err) {
    if (retries > 0) {
      await sleep(2000 * (4 - retries));
      return callGraphAPI(url, retries - 1);
    }
    throw err;
  }
}
```

---

## 🛡️ Segurança

1. **Tokens:** sempre criptografados no banco (AES-256-GCM)
2. **App Secret Proof:** obrigatório em chamadas server-side
   ```
   appsecret_proof = HMAC-SHA256(access_token, app_secret)
   ```
3. **HTTPS only:** nunca expor tokens em logs
4. **Validar webhooks:** checar assinatura `X-Hub-Signature-256`
5. **Escopos mínimos:** só solicitar o que o app realmente usa

---

## 📡 Endpoints da API Interna

```
# Auth
GET    /auth/instagram                    → inicia OAuth
GET    /auth/instagram/callback           → processa retorno
DELETE /auth/instagram/disconnect         → desconecta conta

# Perfil
GET    /instagram/profile                 → dados do perfil atual
GET    /instagram/profile/insights        → insights do perfil
       ?period=day|week|days_28|month
       &since=YYYY-MM-DD
       &until=YYYY-MM-DD

# Posts
GET    /instagram/media                   → lista de posts
       ?limit=25&after={cursor}
GET    /instagram/media/:mediaId          → dados de um post
GET    /instagram/media/:mediaId/insights → insights de um post

# Audiência
GET    /instagram/audience/demographics  → gênero, idade, país, cidade

# Dashboard
GET    /instagram/dashboard/summary      → resumo geral (últimos 30 dias)
GET    /instagram/dashboard/growth       → histórico de crescimento
GET    /instagram/dashboard/top-posts    → posts com melhor performance

# Sync
POST   /instagram/sync                   → força sincronização completa
GET    /instagram/sync/logs              → histórico de syncs
```

---

## 🖥️ Telas do Frontend (mínimo viável)

1. **Onboarding / Connect** — botão "Conectar Instagram" → fluxo OAuth
2. **Dashboard** — visão geral: seguidores, alcance, impressões, engajamento
3. **Posts** — grid de posts com métricas por post
4. **Audiência** — gráficos de demografia (gênero, país, cidade)
5. **Crescimento** — linha do tempo de seguidores / alcance
6. **Configurações** — gerenciar conexão, renovar token, desconectar

---

## 📋 Regras de Desenvolvimento

1. **TypeScript strict mode** em todo o projeto
2. **Validação de entrada** com Zod em todas as rotas
3. **Tratamento de erros** padronizado com códigos HTTP corretos
4. **Logs estruturados** (pino ou winston) — nunca logar access tokens
5. **Testes** — ao menos testes unitários nos services de Instagram
6. **`.env.example`** sempre atualizado com todas as variáveis necessárias
7. **Migrações versionadas** — nunca alterar schema sem migration
8. **Comentários em inglês** no código; respostas para o usuário em português

---

## 🔑 Variáveis de Ambiente Necessárias

```env
# Meta / Instagram
META_APP_ID=
META_APP_SECRET=
META_REDIRECT_URI=http://localhost:3000/auth/instagram/callback
META_GRAPH_API_VERSION=v21.0

# Banco de Dados
DATABASE_URL=postgresql://user:password@localhost:5432/instagram_analytics

# Criptografia
ENCRYPTION_KEY=                         # 32 bytes hex para AES-256

# Redis (para filas de sync)
REDIS_URL=redis://localhost:6379

# App
NODE_ENV=development
PORT=3333
FRONTEND_URL=http://localhost:5173
```

---

## ⚠️ Pré-requisitos para o Desenvolvedor (não implementar, apenas documentar)

Antes de rodar o projeto, o usuário deve:
1. Criar um app em [developers.facebook.com](https://developers.facebook.com)
2. Adicionar o produto **Instagram Graph API**
3. Configurar **Valid OAuth Redirect URIs**
4. Submeter o app para **App Review** com os escopos necessários (para produção)
5. Em desenvolvimento, adicionar o usuário como **Instagram Tester** no painel do app

---

## 🚀 Ordem de Implementação Sugerida

```
FASE 1 — Fundação
  [ ] Setup do projeto (monorepo, TypeScript, linting)
  [ ] Docker Compose (PostgreSQL + Redis)
  [ ] Schema do banco + migrations
  [ ] Serviço base de chamadas à Graph API (com rate limit + retry)

FASE 2 — Autenticação
  [ ] Fluxo OAuth completo (redirect → callback → token storage)
  [ ] Criptografia de tokens
  [ ] App Secret Proof
  [ ] Refresh de tokens

FASE 3 — Dados Core
  [ ] Sync de perfil
  [ ] Sync de posts/media
  [ ] Sync de insights por post
  [ ] Insights de audiência/demographics
  [ ] Histórico de métricas (snapshots diários)

FASE 4 — Jobs & Automação
  [ ] Filas com BullMQ
  [ ] Cron jobs de sincronização
  [ ] Renovação automática de tokens

FASE 5 — Frontend
  [ ] Dashboard principal
  [ ] Tela de posts com métricas
  [ ] Gráficos de crescimento e audiência

FASE 6 — Produção
  [ ] Webhooks do Instagram
  [ ] Alertas de token expirando
  [ ] Documentação de API interna
```

---

## 📚 Links de Referência

- Documentação oficial: https://developers.facebook.com/docs/instagram-api
- Insights API: https://developers.facebook.com/docs/instagram-api/reference/ig-user/insights
- Media Insights: https://developers.facebook.com/docs/instagram-api/reference/ig-media/insights
- Changelog Meta: https://developers.facebook.com/docs/graph-api/changelog
- Rate Limits: https://developers.facebook.com/docs/graph-api/overview/rate-limiting
