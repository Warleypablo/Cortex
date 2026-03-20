# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Turbo Cortex** — Internal platform for Turbo Partners (marketing agency). Centralizes client management, contracts, financial data, HR, commercial intelligence, and operations. Full-stack TypeScript monolith.

## Tech Stack

- **Frontend:** React 18 + Vite 5 + Wouter (routing) + TanStack Query (server state)
- **Backend:** Express.js (ESM) + Node.js
- **Database:** PostgreSQL via Drizzle ORM + raw `pg` Pool
- **UI:** shadcn/ui (new-york style) + Radix UI + Tailwind CSS 3
- **Auth:** Google OAuth2 via Passport.js + express-session (PostgreSQL-backed)
- **Charts:** Recharts
- **Build:** Vite (client) + esbuild (server)
- **Deploy:** Render (Web Service) — auto-deploy from GitHub
- **CI/CD:** GitHub Actions (lint, type-check, build, test on every PR)

## Environments

| Ambiente | Banco | URL | Branch |
|----------|-------|-----|--------|
| **Local** | Docker PostgreSQL (`cortex_dev`) | `localhost:3000` | `feature/*` |
| **Staging** | Render PostgreSQL (`cortex_staging`) | `cortex-staging-vo1j.onrender.com` | `staging` |
| **Producao** | Google Cloud SQL (`dados_turbo`) | `cortex.turbopartners.com.br` | `main` |

**CRITICO:** Dev local NUNCA aponta para banco de producao. O `.env` usa `DB_HOST=localhost`.

### Branching & Deploy

- **`main`** — Producao. NUNCA push direto. So recebe PR de `staging`.
- **`staging`** — Pre-producao. Recebe PRs de `feature/*`. Merge dispara deploy no Render.
- **`feature/*`** — Desenvolvimento. Criada a partir de `staging`. Merge via PR para `staging`.

```
feature/* → PR → staging (Render auto-deploy) → PR → main (Render auto-deploy)
```

### Local Dev Setup

```bash
docker start cortex-dev-db       # Ligar banco local
npm run dev                       # Servidor em localhost:3000
# DB vars no .env: DB_HOST=localhost DB_NAME=cortex_dev DB_USER=cortex DB_PASSWORD=dev123
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server on port 3000. No watch — requires manual restart |
| `npm run build` | Production build (Vite + esbuild) |
| `npm run check` | TypeScript type checking (`tsc --noEmit`) |
| `npm test` | Run tests once (`vitest run`) |
| `npm run test:watch` | Tests in watch mode |
| `npm run lint` | ESLint (`--max-warnings 0`) |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run db:push` | Push Drizzle schema changes to DB (needs `DATABASE_URL` env var) |
| `docker start cortex-dev-db` | Start local PostgreSQL (Docker) |
| `docker stop cortex-dev-db` | Stop local PostgreSQL |

**Kill dev server before restart:** `lsof -ti:3000 | xargs kill -9`

**Health check:** `curl localhost:3000/api/health` (or staging/prod URL)

## Architecture

### Client-Server Monolith

Single Express process serves both API and frontend on port 3000:
- **Dev:** Vite dev server middleware'd into Express (HMR)
- **Prod:** Static files from `dist/public` with SPA fallback

### Directory Layout

| Path | Purpose |
|------|---------|
| `client/src/pages/` | ~110 lazy-loaded page components (one per route) |
| `client/src/components/ui/` | 69+ shadcn/ui components |
| `client/src/contexts/` | AuthContext, ClientAuthContext, CreatorAuthContext, PageContext |
| `server/routes.ts` | Main routes file (~11K lines) + inline routes |
| `server/routes/` | 31 modular route files (growth, hr, contratos, creators, etc.) |
| `server/storage.ts` | Data access layer (~13K lines) |
| `server/db.ts` | DB pool + `CREATE TABLE IF NOT EXISTS` initializers |
| `server/services/` | Business logic (churnRisk, dfcAnalysis, metaAdsSync, etc.) |
| `server/auth/` | Passport config, auth routes, middleware, session store |
| `shared/schema.ts` | Drizzle ORM schema definitions (~3K lines), Zod schemas, types |
| `shared/nav-config.ts` | Navigation config, PERMISSION_KEYS, route-to-permission mapping |
| `agents/` | AI development agent/skill files (see below) |

### Auth & Routing

- Auth routes at `/auth/google*` and `/api/auth/*` registered BEFORE the auth middleware
- `app.use("/api", isAuthenticated)` protects all `/api/*` routes
- Client uses Wouter with `lazyWithRetry()` for chunk-load failure recovery
- RBAC: `admin`/`user` roles + hierarchical permission keys (e.g., `fin.dre`, `gestao.churn_detalhamento`)
- Three auth contexts: internal users, client portal, creator portal

### Database

- **Schemas** (some require double quotes in SQL):
  - `cortex_core` — Core app tables (new tables go here)
  - `"Clickup"` — ClickUp data (`cup_*` tables)
  - `"Conta Azul"` — ERP financial data (`caz_*` tables)
  - `"Bitrix"` — CRM data (`crm_*` tables)
  - `"Inhire"` — HR data (`rh_*` tables)
  - `meta_ads`, `google_ads`, `sys`, `staging`
- **No migration files** — uses `drizzle-kit push` + runtime `CREATE TABLE IF NOT EXISTS`
- New tables: define in `shared/schema.ts`, add init function in `server/db.ts`, use `cortex_core` schema

### Path Aliases

- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`

## Mandatory Rules

### 1. Always Read Agent Files Before Relevant Work

Before writing ANY SQL query, read `agents/db-specialist.md` and `DATABASE.md`. Before designing dashboards, read `agents/dashboard-design-SKILL.md`. Check `agents/` for relevant context before starting any task.

Available agents:
| File | When to use |
|------|-------------|
| `agents/db-specialist.md` | SQL queries, new tables, relationships, migrations |
| `agents/dashboard-design-SKILL.md` | Creating or editing any dashboard UI |
| `agents/git-autopush-SKILL.md` | Post-change workflow (commit + push + changelog) |
| `agents/obsidian-sync-SKILL.md` | Sync progress to Obsidian vault |
| `agents/legal-contratos.md` | Contract law features |
| `agents/legal-cobranca.md` | Debt collection features |
| `agents/legal-trabalhista.md` | Labor law features |

### 2. Git Workflow (NEVER SKIP)

**Always work on a feature branch, never directly on `main` or `staging`.**

```bash
# Start: create branch from staging
git checkout staging && git pull
git checkout -b feature/my-feature

# Develop: commit and push to feature branch
git add <files>
git commit -m "feat(scope): description"
git push -u origin feature/my-feature

# Merge: create PR on GitHub
# feature/* → staging (test) → main (production)
```

After every code change, execute ALL steps in order:
1. **Git:** Stage, commit (Conventional Commits format), push to feature branch — see `agents/git-autopush-SKILL.md`
2. **Changelog:** Add entry to `docs/CHANGELOG.md`
3. **Obsidian:** Update vault at `/Users/mac0267/Documents/Obsidian Vault/Córtex 2.0/` — see `agents/obsidian-sync-SKILL.md`
4. **Chamados:** If working on a task, update status to `"review"` (NOT `"concluido"`):
   ```sql
   UPDATE cortex_core.chamados SET status='review', atualizado_em=NOW() WHERE id=<chamado_id>;
   ```

**GitHub Actions runs automatically on every PR:** lint, type-check, build, tests. If `shared/schema.ts` changed, a schema review checklist is posted.

### 3. Dark/Light Mode

Always use `dark:` Tailwind variants. Never hardcode colors.
```tsx
className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-white"
className="border-gray-200 dark:border-zinc-700"
```

### 4. Dashboard Design System

Follow the 3-level hierarchy: Hero (1-3 metrics, `text-2xl`), Supporting (3-6 cards), Detail (tables below fold). Max 8 KPIs visible without scroll. Use semantic color tokens from `agents/dashboard-design-SKILL.md`. No gradients, no backdrop-blur, no `hover:scale` on non-interactives.

## Conventions

- **Commits:** Conventional Commits (`feat(scope): description`). Co-author: `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
- **Components:** PascalCase filenames. Functional components with hooks.
- **Styling:** Tailwind CSS only. shadcn/ui components from `@/components/ui/`
- **Server state:** TanStack Query (`staleTime: Infinity`, no `refetchOnWindowFocus`)
- **Forms:** React Hook Form + Zod validation
- **Icons:** Lucide React
- **Validation middleware:** `validateBody()` with Zod schemas in `server/middleware/`
- **SQL safety:** Use Drizzle `sql` template literals (parameterized). NEVER use `sql.raw()` with user input
- **Prettier:** semi, singleQuote, trailingComma: all, printWidth: 120, tabWidth: 2

## Key Database Gotchas

- Churn table: `"Clickup".cup_churn` — columns are `valor_r` (not `valorr`), `responsavel_geral` (not `responsavel`), `nome` (client name directly)
- Clients table: `"Clickup".cup_clientes` — column is `nome` (not `nome_cliente`)
- Historical snapshots: `"Clickup".cup_data_hist` (daily contract snapshots)
- Financial: `"Conta Azul".caz_parcelas` — `categoria_nome` can have multiple values separated by `;`, use `regexp_split_to_table()`
- BP snapshots: `cortex_core.bp_snapshots` (JSONB `metricas` field)

## Scheduled Jobs (server/index.ts)

- Daily contract snapshots to `cup_data_hist` (startup + 00:05 daily)
- Meta Ads sync every 6 hours
- Google Ads keywords sync every 12 hours
- Assinafy signature polling every 5 minutes

## CI/CD & Deploy

- **GitHub Actions:** Runs on every PR to `staging` or `main` — lint, type-check, build, tests
- **Schema check:** PRs that modify `shared/schema.ts` or `server/db.ts` get an auto-comment with review checklist
- **Render:** Auto-deploys `staging` branch to staging service, `main` branch to production
- **Health check:** `GET /api/health` — registered before auth middleware, checks DB connection and critical tables
- **Workflow reference:** See `WORKFLOW-DESENVOLVIMENTO.md` for full development workflow
- **Implementation plan:** See `PLANO-INFRAESTRUTURA.md` for infrastructure setup checklist
<!-- CI billing test -->
