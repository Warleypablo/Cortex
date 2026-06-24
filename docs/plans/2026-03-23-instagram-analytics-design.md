# Instagram Analytics — Design (Fase 1: Conexão + Coleta)

**Data:** 2026-03-23
**Status:** Aprovado

## Decisões

- Integrado ao Cortex (Express + Drizzle, sem dependências novas)
- Conexão por cliente (FK via CNPJ no `cup_clientes`)
- Escopo: perfil + posts com métricas individuais (sem demographics)
- Sync manual apenas (sem cron/filas)
- Frontend mínimo (tela de conexões, sem dashboard de gráficos)
- App Meta novo com escopos: `instagram_basic`, `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement`, `business_management`

## Modelo de Dados

Schema: `cortex_core`

### instagram_connections

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | SERIAL PK | ID interno |
| `cliente_cnpj` | TEXT NOT NULL | FK para `cup_clientes.cnpj` |
| `ig_user_id` | TEXT NOT NULL | ID do Instagram Business |
| `username` | TEXT NOT NULL | @username |
| `access_token` | TEXT NOT NULL | Token criptografado (AES-256-GCM) |
| `token_expires_at` | TIMESTAMP | Expiração do long-lived token |
| `account_type` | TEXT | BUSINESS ou CREATOR |
| `scopes` | TEXT[] | Escopos concedidos |
| `connected_by` | TEXT | ID do usuário Cortex que conectou |
| `is_active` | BOOLEAN DEFAULT true | Conexão ativa |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

### instagram_metrics_snapshots

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | SERIAL PK | |
| `connection_id` | INTEGER FK | Ref instagram_connections |
| `metric_date` | DATE NOT NULL | Data do snapshot |
| `followers` | INTEGER | |
| `following` | INTEGER | |
| `posts_count` | INTEGER | |
| `reach_day` | INTEGER | Alcance do dia |
| `impressions_day` | INTEGER | Impressões do dia |
| `recorded_at` | TIMESTAMP | |

UNIQUE em `(connection_id, metric_date)`.

### instagram_post_metrics

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | SERIAL PK | |
| `connection_id` | INTEGER FK | |
| `ig_media_id` | TEXT NOT NULL UNIQUE | ID do post na Graph API |
| `media_type` | TEXT | IMAGE, VIDEO, REELS, CAROUSEL_ALBUM |
| `caption` | TEXT | |
| `permalink` | TEXT | |
| `thumbnail_url` | TEXT | |
| `posted_at` | TIMESTAMP | |
| `likes` | INTEGER DEFAULT 0 | |
| `comments` | INTEGER DEFAULT 0 | |
| `saves` | INTEGER DEFAULT 0 | |
| `shares` | INTEGER DEFAULT 0 | |
| `impressions` | INTEGER DEFAULT 0 | |
| `reach` | INTEGER DEFAULT 0 | |
| `plays` | INTEGER DEFAULT 0 | |
| `total_interactions` | INTEGER DEFAULT 0 | |
| `last_synced_at` | TIMESTAMP | |

## Backend

### Rotas (`server/routes/instagram.ts`)

```
# Auth OAuth
GET  /auth/instagram?clienteCnpj=XXX     → monta URL Meta OAuth, redireciona
GET  /auth/instagram/callback            → recebe code, troca por token, salva

# API
GET    /api/instagram/connections                → lista conexões
GET    /api/instagram/connections/:id            → detalhe
DELETE /api/instagram/connections/:id            → desconecta
GET    /api/instagram/connections/:id/status     → valida token

# Sync manual
POST   /api/instagram/connections/:id/sync       → sync completo
GET    /api/instagram/connections/:id/sync/logs  → status

# Dados
GET    /api/instagram/connections/:id/profile    → último snapshot
GET    /api/instagram/connections/:id/metrics    → snapshots históricos
GET    /api/instagram/connections/:id/posts      → posts com métricas
```

### Serviço (`server/services/instagramSync.ts`)

- `exchangeCodeForToken(code)` — short-lived → long-lived
- `refreshLongLivedToken(connectionId)`
- `encryptToken(token)` / `decryptToken(encrypted)` — AES-256-GCM
- `callGraphAPI(endpoint, accessToken)` — retry + rate limit + app secret proof
- `syncProfile(connectionId)` — perfil + snapshot
- `syncMedia(connectionId)` — posts + métricas individuais
- `syncInsights(connectionId)` — insights de conta
- `revokeAccess(connectionId)` — revoga na Meta + desativa

### Segurança

- Tokens criptografados (AES-256-GCM com `INSTAGRAM_ENCRYPTION_KEY`)
- `appsecret_proof` = HMAC-SHA256(access_token, app_secret) em toda chamada
- State parameter no OAuth para CSRF
- Nunca logar tokens

### Rate Limiting

- Monitorar header `X-App-Usage` (pausar se call_count > 80%)
- Retry com exponential backoff em HTTP 429

## Frontend

### Página: `InstagramConexoes.tsx`

- Sidebar: novo item "Instagram" (seção Integrações)
- Protegida por `allowedRoutes`

Layout:
1. Header com título + botão "Nova Conexão"
2. Tabela de conexões: avatar, @username, cliente, status token (badge), última sync, ações
3. Estado vazio com ilustração

Fluxos:
- **Nova Conexão:** selecionar cliente → OAuth Meta → callback → toast sucesso
- **Sincronizar:** botão por conexão → POST sync → loading → toast resultado
- **Desconectar:** confirmação → DELETE → remove da lista

Padrões: dark/light mode, shadcn/ui, React Query.

## Variáveis de Ambiente Novas

```env
META_INSTAGRAM_APP_ID=
META_INSTAGRAM_APP_SECRET=
META_INSTAGRAM_REDIRECT_URI=http://localhost:3000/auth/instagram/callback
META_GRAPH_API_VERSION=v21.0
INSTAGRAM_ENCRYPTION_KEY=    # 32 bytes hex para AES-256
```
