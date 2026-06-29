# Plano — Encurtador de Links da Turbo

> Branch: `feature/encurtador-links` · Status: **plano (sem código ainda)** · Data: 2026-06-29

## Objetivo

Encurtador de links próprio da Turbo em **`marketing.turbopartners.com.br/<slug>`**, que:

1. Redireciona pro destino **com a UTM intacta** (rápido, na borda).
2. Permite **criar o link a partir do UTM Builder que já existe** no Cortex.
3. Registra **cada clique no Postgres** pra cruzar `clique → lead (Bitrix) → venda` por UTM (**nível B**).

## Decisões travadas

| Item | Decisão | Por quê |
|---|---|---|
| Domínio | `marketing.turbopartners.com.br` | Verificado: subdomínio **livre** (não resolve), DNS já no Cloudflare |
| Redirect | **Cloudflare Worker** (na borda) | Domínio já vive no Cloudflare → rota de Worker é trivial; rápido e independente do Cortex estar de pé |
| Cérebro (criar/gerir/dado) | **Cortex** (Render) | UTM Builder + Postgres + cruzamento com Bitrix/Meta já moram aqui |
| Nível de tracking | **B — contar + cruzar** | Cliente quer otimizar por clique→venda, não só volume |
| Slug | **Personalizado** (`/reuniao-vitor`); aleatório quando não digitado | Decisão Ichino 2026-06-29 |
| Acesso | **Growth + admins** (igual UTM Builder) | Decisão Ichino 2026-06-29 |
| Fonte de verdade do redirect | **Cloudflare KV** | Leitura rápida na borda, resiliente; Postgres é o store analítico |
| **Auto-encurtar** | **Todo link gerado vira curto automaticamente** (slug custom ou aleatório) | Decisão Ichino 2026-06-29 — histórico 100% rastreável |
| **UI** | **Sem página `/links` separada**: colunas (curto/cliques/MQL/reunião/venda) entram na aba **Histórico** | Decisão Ichino 2026-06-29 |
| **Atribuição** | **Caminho A — por UTM**: cruza `short_links.utm_*` ⋈ `Bitrix.crm_deal.utm_*`. Granularidade = unicidade da UTM (links de mesma UTM ficam agrupados) | Decisão Ichino 2026-06-29 |

## Arquitetura

```
marketing.turbopartners.com.br/reuniao-vitor
        │
        ▼  Cloudflare Worker
        │   1. lê slug no KV → URL longa (com UTM)
        │   2. 302 redirect (UTM intacta)
        │   3. POST assíncrono do clique → Cortex (não atrasa o redirect)
        │                                   │
        └─ Cortex (Render) ◄────────────────┘
              • POST /api/links/shorten → grava no KV + cortex_core.short_links
              • POST /api/clicks        → grava cortex_core.short_link_clicks
              • UTM Builder ganha botão "Encurtar"
              • página /links: gestão + cliques
              • query de atribuição: short_link_clicks ⋈ Bitrix.crm_deal por UTM
```

---

## Fases de implementação

### Fase 1 — Banco (Cortex)
**Arquivo:** `shared/schema.ts` (~L3712, schema `cortex_core`, logo após `generatedUtmLinks`)

Duas tabelas novas:

- **`short_links`**
  - `id` (uuid pk), `slug` (varchar **unique**), `target_url` (text — URL longa com UTM)
  - desmembrado p/ cruzar: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`
  - `created_by` (userId), `created_at`, `expires_at` (nullable), `active` (bool default true)
- **`short_link_clicks`**
  - `id` (uuid pk), `slug` (fk lógica), `clicked_at`, `country`, `ip` (ou hash), `user_agent`, `referrer`

**Migração:** `npm run db:push` (schema-first, sem pasta de migrations — padrão do repo).

### Fase 2 — Backend Cortex
**Arquivo novo:** `server/routes/shortener.ts` (seguir padrão de `server/routes/utm.ts`)
Registrar em `registerRoutes(app)` (`server/index.ts:185`).

- **`POST /api/links/shorten`** (auth: Growth + admins, igual UTM Builder)
  - entrada: `target_url` (URL já com UTM) + `slug` opcional (senão gera aleatório curto)
  - ação: valida unicidade do slug → grava em `short_links` → **escreve `slug→target_url` no KV do Cloudflare** (via REST API do CF com token)
  - saída: `https://marketing.turbopartners.com.br/<slug>`
- **`POST /api/clicks`** (sem auth de sessão; protegido por **header secreto** compartilhado com o Worker)
  - entrada: `slug`, `country`, `user_agent`, `referrer`, `ts`
  - ação: insere em `short_link_clicks`. Idempotência leve / rate-limit básico.
- **`GET /api/links`** — lista links do usuário + contagem de cliques (join agregado)

**Env vars novas** (`.env.example` + Render): `CF_ACCOUNT_ID`, `CF_KV_NAMESPACE_ID`, `CF_API_TOKEN`, `CLICK_INGEST_SECRET`.

### Fase 3 — Cloudflare Worker
**Local:** pasta nova `cloudflare/shortener-worker/` no repo Cortex (deploy separado via `wrangler`, não pelo build do Cortex).

- `wrangler.toml`: bind do KV namespace + rota `marketing.turbopartners.com.br/*` + secret `CLICK_INGEST_SECRET`
- `src/index.ts`:
  1. extrai slug do path (`/` → página default ou redirect pra turbopartners.com.br)
  2. `KV.get(slug)` → se achar, `302` pro `target_url`; senão `404`/fallback
  3. `ctx.waitUntil(fetch(CORTEX/api/clicks, {POST, header secreto, body do clique}))` — **assíncrono**, não bloqueia o redirect
- **DNS:** registro `marketing` (proxied) no Cloudflare + rota do Worker

### Fase 4 — Frontend Cortex
- **`client/src/pages/UtmBuilder.tsx`**: botão **"Encurtar"** — depois de montar a UTM, chama `POST /api/links/shorten`, mostra o link curto + copiar + QR
- **`client/src/pages/LinkShortener.tsx`** (novo) + rota `/links` em `App.tsx` (mesmo padrão `ProtectedRoute` do UTM Builder): tabela de links, cliques, status, copiar/QR
- Dark/light mode obrigatório (padrão do projeto)

### Fase 5 — Atribuição (o "cruzar")
- Query/endpoint que liga `short_link_clicks` → `Bitrix.crm_deal` por `utm_campaign`/`utm_content` → funil `cliques → sessões → leads → vendas`
- Expor numa view simples na página `/links` (cliques x leads x vendas por link/UTM)

---

## Pontos de atenção

- **Não** botar o redirect dentro do Cortex: o slug colidiria com rotas do app (`/utm-builder`, `/growth`). Por isso o Worker fica num **host dedicado** (`marketing.`), onde todo path é slug.
- **`/api/clicks` é público** (o Worker chama de fora) → proteger com header secreto + rate-limit; nunca confiar em dados do clique pra escrever em outras tabelas.
- **KV é a fonte de verdade do redirect**; o Postgres é o store analítico. Manter os dois em sync na criação/edição/expiração do link.
- **Reuso:** `cortex_core.generated_utm_links` já existe — avaliar se `short_links` referencia ela (FK) em vez de duplicar os campos UTM.

## Fora de escopo (v1)
- QR code estilizado / branding pesado (v1 = QR simples)
- Edição de destino pós-criação (avaliar na v2)
- A/B de destino por slug
