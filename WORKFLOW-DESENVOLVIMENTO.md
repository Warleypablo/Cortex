# Workflow de Desenvolvimento — Turbo Cortex

## Visao Geral

Este documento descreve o workflow completo de desenvolvimento do Turbo Cortex,
desde a criacao de features ate o deploy em producao.

```
LOCAL (sua maquina)          STAGING (Render)           PRODUCAO (Render)
npm run dev                  Auto-deploy                Auto-deploy
localhost:3000               cortex-staging.render.com  cortex.turbopartners.com.br
DB: PostgreSQL local         DB: Render PostgreSQL      DB: Google Cloud SQL
(Docker/brew)                (managed)                  (dados_turbo)
      |                           |                         |
      |    feature/* branch       |                         |
      |    desenvolve + testa     |                         |
      |                           |                         |
      +--- PR merge em staging -->+   deploy automatico     |
                                  |   testa integrado       |
                                  |                         |
                                  +--- PR merge em main --->+  deploy automatico
                                                            |  producao atualizada
```

**Stack do Cortex:**
- **Frontend:** React 18 + Vite 5 + Wouter + TanStack Query
- **Backend:** Express.js (ESM) + Node.js
- **Database:** PostgreSQL (Google Cloud SQL) via Drizzle ORM
- **Build:** Vite (client) + esbuild (server)
- **Deploy:** Render (Web Service)
- **CI/CD:** GitHub Actions
- **Versionamento:** GitHub (`Warleypablo/Cortex`)

---

## Ambientes

| Ambiente | Database | Frontend | Branch Git | Render Service |
|----------|----------|----------|------------|----------------|
| Local | PostgreSQL local (Docker ou brew) | `localhost:3000` | `feature/*` | — |
| Staging | Render PostgreSQL (managed) | `cortex-staging.onrender.com` | `staging` | Web Service + PostgreSQL |
| Producao | Google Cloud SQL (`dados_turbo`) | `cortex.turbopartners.com.br` | `main` | Web Service (prod) |

### Separacao de banco de dados

**CRITICO:** Nunca desenvolver apontando para o banco de producao.

Cada ambiente tem seu proprio banco de dados, completamente isolado:

```
LOCAL (sua maquina)                RENDER (staging)              GOOGLE CLOUD SQL (producao)
PostgreSQL via Docker              Render PostgreSQL              dados_turbo
├── cortex_dev                     ├── cortex_staging             ├── cortex_core.*
├── Gratuito                       ├── Managed (free tier)        ├── "Clickup".*
├── Zero latencia                  ├── Mesmo datacenter           ├── "Conta Azul".*
├── Pode destruir livremente       ├── Replica estrutura prod     └── ...
└── Sem risco nenhum               └── Sem acesso a prod
```

### Banco de dados local — Setup

**Opcao 1: Docker (recomendado)**

```bash
# Criar e iniciar container PostgreSQL
docker run -d \
  --name cortex-dev-db \
  -e POSTGRES_DB=cortex_dev \
  -e POSTGRES_USER=cortex \
  -e POSTGRES_PASSWORD=dev123 \
  -p 5432:5432 \
  -v cortex_pgdata:/var/lib/postgresql/data \
  postgres:16

# Variaveis de conexao para o .env local:
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=cortex_dev
# DB_USER=cortex
# DB_PASSWORD=dev123
# DB_SSL=false
```

Comandos uteis do Docker:
```bash
docker start cortex-dev-db      # Iniciar (apos reiniciar o Mac)
docker stop cortex-dev-db       # Parar
docker logs cortex-dev-db       # Ver logs
docker exec -it cortex-dev-db psql -U cortex -d cortex_dev   # Conectar no psql
```

O `-v cortex_pgdata:/var/lib/postgresql/data` cria um **volume persistente**.
Os dados sobrevivem mesmo se voce parar ou remover o container.

**Opcao 2: PostgreSQL direto no Mac (sem Docker)**

```bash
brew install postgresql@16
brew services start postgresql@16

# Criar o database
createdb cortex_dev

# Variaveis de conexao para o .env local:
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=cortex_dev
# DB_USER=<seu_usuario>
# DB_PASSWORD=
# DB_SSL=false
```

### Popular o banco local com schema

Apos criar o banco, push do schema Drizzle:

```bash
# Com as variaveis DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD apontando para o banco local
npm run db:push
```

Isso cria todas as tabelas definidas em `shared/schema.ts`.
O runtime (`CREATE TABLE IF NOT EXISTS` em `server/db.ts`) cria
as tabelas adicionais ao iniciar o servidor com `npm run dev`.

### Dados de teste (seed)

O banco local comeca vazio. Para ter dados minimos de teste,
manter um script de seed:

```bash
# scripts/seed-dev.sql
# Rodar: psql -U cortex -d cortex_dev -f scripts/seed-dev.sql

-- Usuario de teste (para login funcionar com Google OAuth de dev)
INSERT INTO cortex_core.users (id, email, name, role)
VALUES (1, 'dev@turbopartners.com.br', 'Dev Teste', 'admin')
ON CONFLICT DO NOTHING;

-- Dados minimos para navegar pelo sistema
-- (adicionar conforme necessidade)
```

**Alternativa: Copiar subset de dados de producao**

Para testes mais realistas, copiar tabelas especificas de producao:

```bash
# Exportar dados essenciais de producao (somente leitura, cuidado)
pg_dump -h 34.95.249.110 -U <user> -d dados_turbo \
  --data-only \
  -t cortex_core.users \
  -t '"Clickup".cup_clientes' \
  > prod_seed.sql

# Importar no banco local
psql -U cortex -d cortex_dev < prod_seed.sql
```

### Variaveis de banco por ambiente

```bash
# .env (local — aponta para Docker/brew) — variaveis individuais
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cortex_dev
DB_USER=cortex
DB_PASSWORD=dev123
DB_SSL=false

# Render staging (env vars do servico — gerado automaticamente pelo Render PostgreSQL)
# Render injeta DATABASE_URL como connection string unica
DATABASE_URL=postgresql://cortex_staging_user:pass@dpg-xxx.render.com:5432/cortex_staging

# Render producao (env vars do servico — Google Cloud SQL) — variaveis individuais
# DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD configurados no Render
```

---

## Branches

### `main` — Producao

- Codigo estavel, testado, em producao
- **NUNCA** faca push direto nessa branch
- So recebe codigo via Pull Request de `staging`
- Merge aqui dispara deploy automatico no Render (producao)

### `staging` — Testes integrados

- Ambiente de teste pre-producao
- Recebe PRs de branches `feature/*`
- Merge aqui dispara deploy automatico no Render (staging)
- Quando tudo esta ok, cria PR de `staging` para `main`

### `feature/*` — Desenvolvimento

- Cada feature/bugfix/melhoria tem sua propria branch
- Criada a partir de `staging` (sempre atualizada)
- Padrao de nome: `feature/nome-da-feature`, `fix/descricao-do-bug`, `refactor/o-que-mudou`
- Desenvolve e testa localmente
- Quando pronta, cria PR para `staging`

---

## Fluxo Dia-a-Dia (Passo a Passo)

### 1. Iniciar uma feature

```bash
# Garantir que staging esta atualizado
git checkout staging
git pull origin staging

# Criar branch da feature
git checkout -b feature/dashboard-financeiro
```

### 2. Desenvolver e testar localmente

```bash
# 1. Garantir que o banco local esta rodando
docker start cortex-dev-db   # ou: brew services start postgresql@16

# 2. Garantir que .env aponta para o banco LOCAL (NUNCA para dados_turbo)
#    DB_HOST=localhost  DB_NAME=cortex_dev  (ver .env.example na raiz do projeto)

# 3. Iniciar dev server
npm run dev
# → http://localhost:3000

# 4. Se criou novas tabelas em shared/schema.ts, push para o banco dev:
npm run db:push

# 5. Rodar type-check para garantir que nada quebrou:
npm run check

# 6. Rodar testes:
npm test
```

### 3. Fazer commits

```bash
# Adicionar arquivos especificos (NUNCA git add . em producao)
git add client/src/pages/DashboardFinanceiro.tsx
git add server/routes/financeiro.ts
git add shared/schema.ts

git commit -m "feat(financeiro): add dashboard financeiro page"
```

**Convencao de commits (Conventional Commits):**
- `feat:` nova funcionalidade
- `fix:` correcao de bug
- `refactor:` refatoracao sem mudar comportamento
- `chore:` tarefas de manutencao, config, CI
- `docs:` documentacao
- `style:` formatacao, whitespace
- `perf:` melhoria de performance
- `test:` adicao/correcao de testes

**Co-author em todos os commits feitos com Claude:**
```
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### 4. Push e Pull Request para Staging

```bash
# Enviar branch para o GitHub
git push -u origin feature/dashboard-financeiro
```

No GitHub:
1. Acesse o repositorio `Warleypablo/Cortex`
2. Clique em "Compare & pull request" (aparece automaticamente)
3. Base: `staging` ← Compare: `feature/dashboard-financeiro`
4. Preencha titulo e descricao do que foi feito
5. Clique "Create pull request"
6. Aguarde os checks do GitHub Actions (lint, type-check, build, testes)
7. Se todos passarem, clique "Merge pull request"

**O que acontece automaticamente apos o merge:**
- GitHub Actions roda validacao (lint, check, build, test)
- Render detecta push em `staging` e faz deploy automatico
- Schema changes sao aplicados pelo runtime (`CREATE TABLE IF NOT EXISTS`)
- Health check confirma que o deploy subiu

### 5. Testar em Staging

- Acesse `cortex-staging.onrender.com`
- Teste a feature com dados do banco staging
- Se encontrar bug, volte para a branch feature, corrija, faca novo PR

### 6. Promover para Producao

Quando staging esta ok:
1. No GitHub, crie PR: `staging` → `main`
2. Revise todas as mudancas que vao para producao
3. Aprove e merge

**O que acontece automaticamente:**
- GitHub Actions roda validacao final
- Render detecta push em `main` e faz deploy em producao
- Health check confirma que producao esta saudavel
- Schema changes aplicados pelo runtime

---

## GitHub Actions — CI/CD

### Workflow: Validacao de PR

Arquivo: `.github/workflows/pr-checks.yml`

**Trigger:** Pull Request para `staging` ou `main`
**Acoes:**
1. Instala dependencias (`npm ci`)
2. Roda lint (`npm run lint`)
3. Roda type-check (`npm run check`)
4. Roda build (`npm run build`)
5. Roda testes (`npm test`)

```yaml
name: PR Checks

on:
  pull_request:
    branches: [staging, main]

jobs:
  validate:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run check

      - name: Build
        run: npm run build

      - name: Test
        run: npm test
        env:
          NODE_ENV: test
```

### Workflow: Schema Diff Check

Detecta mudancas em `shared/schema.ts` e alerta no PR.

Arquivo: `.github/workflows/schema-check.yml`

```yaml
name: Schema Change Detection

on:
  pull_request:
    branches: [staging, main]
    paths:
      - 'shared/schema.ts'
      - 'server/db.ts'

jobs:
  check-schema:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Detect schema changes
        run: |
          echo "## Schema Changes Detected" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "The following files were modified:" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY

          if git diff origin/${{ github.base_ref }}...HEAD -- shared/schema.ts | grep -q .; then
            echo "### shared/schema.ts" >> $GITHUB_STEP_SUMMARY
            echo '```diff' >> $GITHUB_STEP_SUMMARY
            git diff origin/${{ github.base_ref }}...HEAD -- shared/schema.ts >> $GITHUB_STEP_SUMMARY
            echo '```' >> $GITHUB_STEP_SUMMARY
          fi

          if git diff origin/${{ github.base_ref }}...HEAD -- server/db.ts | grep -q .; then
            echo "### server/db.ts" >> $GITHUB_STEP_SUMMARY
            echo '```diff' >> $GITHUB_STEP_SUMMARY
            git diff origin/${{ github.base_ref }}...HEAD -- server/db.ts >> $GITHUB_STEP_SUMMARY
            echo '```' >> $GITHUB_STEP_SUMMARY
          fi

          echo "" >> $GITHUB_STEP_SUMMARY
          echo "⚠️ **Review these changes carefully.**" >> $GITHUB_STEP_SUMMARY
          echo "Schema changes affect the database structure." >> $GITHUB_STEP_SUMMARY
          echo "Cortex uses runtime \`CREATE TABLE IF NOT EXISTS\` — new tables are safe." >> $GITHUB_STEP_SUMMARY
          echo "Column renames, drops, or type changes require manual verification." >> $GITHUB_STEP_SUMMARY

      - name: Comment on PR
        uses: actions/github-script@v7
        with:
          script: |
            const { data: files } = await github.rest.pulls.listFiles({
              owner: context.repo.owner,
              repo: context.repo.repo,
              pull_number: context.issue.number,
            });

            const schemaChanged = files.some(f => f.filename === 'shared/schema.ts');
            const dbChanged = files.some(f => f.filename === 'server/db.ts');

            if (schemaChanged || dbChanged) {
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
                body: `## ⚠️ Schema Changes Detected

This PR modifies database schema files:
${schemaChanged ? '- \`shared/schema.ts\` — Drizzle ORM schema definitions' : ''}
${dbChanged ? '- \`server/db.ts\` — Table initializers (CREATE TABLE IF NOT EXISTS)' : ''}

**Checklist before merge:**
- [ ] New tables use \`cortex_core\` schema
- [ ] \`CREATE TABLE IF NOT EXISTS\` added to \`server/db.ts\` for new tables
- [ ] No destructive changes (DROP TABLE, DROP COLUMN, column type changes)
- [ ] Tested \`npm run db:push\` locally against dev database
- [ ] Column names follow existing conventions (snake_case)`
              });
            }
```

### Workflow: Health Check Pos-Deploy

Arquivo: `.github/workflows/health-check.yml`

```yaml
name: Post-Deploy Health Check

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to check'
        required: true
        type: choice
        options:
          - staging
          - production

  # Tambem roda quando Render notifica via webhook (opcional)
  repository_dispatch:
    types: [render-deploy-completed]

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - name: Determine URL
        id: url
        run: |
          if [ "${{ github.event.inputs.environment || 'production' }}" = "staging" ]; then
            echo "url=${{ vars.STAGING_URL }}" >> $GITHUB_OUTPUT
            echo "env=staging" >> $GITHUB_OUTPUT
          else
            echo "url=${{ vars.PRODUCTION_URL }}" >> $GITHUB_OUTPUT
            echo "env=production" >> $GITHUB_OUTPUT
          fi

      - name: Wait for deploy propagation
        run: sleep 30

      - name: Health check - API
        run: |
          HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
            "${{ steps.url.outputs.url }}/api/health" \
            --max-time 15)

          if [ "$HTTP_CODE" != "200" ]; then
            echo "❌ API health check failed (HTTP $HTTP_CODE)"
            exit 1
          fi

          echo "✅ API is responding (HTTP 200)"

      - name: Health check - Frontend
        run: |
          HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
            "${{ steps.url.outputs.url }}" \
            --max-time 15)

          if [ "$HTTP_CODE" != "200" ]; then
            echo "❌ Frontend returned HTTP $HTTP_CODE"
            exit 1
          fi

          echo "✅ Frontend is responding (HTTP 200)"

      - name: Notify on failure
        if: failure()
        run: |
          gh issue create \
            --title "Smoke test failed on ${{ steps.url.outputs.env }}" \
            --body "Deploy smoke test failed. Check: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}" \
            --label "bug,urgent"
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Secrets e Variables no GitHub

Configurar em: GitHub → Repo → Settings → Secrets and variables → Actions

**Secrets (valores sensiveis, mascarados nos logs):**

| Secret | Descricao |
|--------|-----------|
| `DATABASE_URL_DEV` | Connection string do banco `cortex_dev` |
| `DATABASE_URL_STAGING` | Connection string do banco `cortex_staging` |

**Variables (valores nao-sensiveis, visiveis nos logs):**

| Variable | Valor |
|----------|-------|
| `STAGING_URL` | `https://cortex-staging.onrender.com` |
| `PRODUCTION_URL` | `https://cortex.turbopartners.com.br` |

---

## Render — Configuracao

### Infraestrutura no Render

O Render conecta-se ao GitHub e faz auto-deploy quando a branch configurada
recebe push. Precisamos de **dois Web Services** e **um PostgreSQL** (staging):

```
Render Dashboard
│
├── cortex-prod              ← Web Service, branch: main
│   ├── Build: npm run build
│   ├── Start: npm start
│   ├── Env: DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD → Google Cloud SQL (dados_turbo)
│   └── Custom domain: cortex.turbopartners.com.br
│
├── cortex-staging           ← Web Service, branch: staging
│   ├── Build: npm run build
│   ├── Start: npm start
│   ├── Env: DATABASE_URL → Render PostgreSQL (cortex-staging-db)
│   └── URL: cortex-staging.onrender.com
│
└── cortex-staging-db        ← PostgreSQL (managed by Render)
    ├── Plan: Free (90 dias) ou Starter ($7/mes)
    ├── PostgreSQL 16
    └── Internal URL gerada automaticamente
```

### Passo a passo: Criar staging no Render

**1. Criar PostgreSQL para staging:**

1. Render Dashboard → New → PostgreSQL
2. Configurar:
   | Campo | Valor |
   |-------|-------|
   | Name | `cortex-staging-db` |
   | Database | `cortex_staging` |
   | User | `cortex_staging_user` |
   | Region | Ohio (mesmo da app) |
   | PostgreSQL Version | 16 |
   | Plan | Free (90 dias) ou Starter |

3. Apos criar, copiar a **Internal Database URL** (usada pelo Web Service)

**2. Criar Web Service para staging:**

1. Render Dashboard → New → Web Service
2. Conectar ao repositorio `Warleypablo/Cortex`
3. Configurar:
   | Campo | Valor |
   |-------|-------|
   | Name | `cortex-staging` |
   | Environment | Node |
   | Branch | `staging` |
   | Build Command | `npm install && npm run build` |
   | Start Command | `npm start` |
   | Auto-Deploy | Yes |
   | Health Check Path | `/api/health` |

**3. Configurar Environment Variables do staging:**

Copiar todas as env vars de producao para staging, mas alterar:

| Variavel | Producao | Staging |
|----------|----------|---------|
| DB vars / `DATABASE_URL` | `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` → Google Cloud SQL (`dados_turbo`) | `DATABASE_URL` → Render PostgreSQL (Internal URL) |
| `NODE_ENV` | `production` | `production` |
| `SESSION_SECRET` | (valor de prod) | (gerar novo com `openssl rand -hex 32`) |
| `GOOGLE_CLIENT_ID` | (mesmo) | (mesmo — ou criar app OAuth separado) |
| `BASE_URL` | `https://cortex.turbopartners.com.br` | `https://cortex-staging.onrender.com` |

**Dica:** O Render permite "link" entre o PostgreSQL e o Web Service.
Ao linkar, ele injeta a `DATABASE_URL` automaticamente como env var.

### Producao (ja existente)

O Web Service de producao ja existe. Apenas garantir:

| Campo | Valor esperado |
|-------|----------------|
| Branch | `main` |
| Auto-Deploy | Yes |
| Health Check Path | `/api/health` (adicionar se nao tem) |

### render.yaml (Infrastructure as Code — opcional)

Definir a infraestrutura como codigo para reprodutibilidade:

```yaml
# render.yaml (raiz do projeto)
databases:
  - name: cortex-staging-db
    plan: starter
    databaseName: cortex_staging
    user: cortex_staging_user
    postgresMajorVersion: "16"

services:
  - type: web
    name: cortex-prod
    env: node
    plan: starter
    branch: main
    buildCommand: npm install && npm run build
    startCommand: npm start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: DB_HOST
        sync: false  # configurado manualmente (Google Cloud SQL)
      - key: DB_PORT
        sync: false
      - key: DB_NAME
        sync: false
      - key: DB_USER
        sync: false
      - key: DB_PASSWORD
        sync: false

  - type: web
    name: cortex-staging
    env: node
    plan: starter
    branch: staging
    buildCommand: npm install && npm run build
    startCommand: npm start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: cortex-staging-db
          property: connectionString
```

---

## Health Check Endpoint

Criar no Express para que o Render (e GitHub Actions) possam verificar
se a aplicacao esta saudavel.

**Endpoint:** `GET /api/health` (registrado ANTES do middleware de auth)

```typescript
// server/routes/health.ts
import { Router } from 'express';
import { pool } from '../db';

const router = Router();

router.get('/health', async (req, res) => {
  const start = Date.now();
  const checks: Record<string, { ok: boolean; ms: number; error?: string }> = {};

  // 1. Database connection
  try {
    const t = Date.now();
    const result = await pool.query('SELECT 1 as health');
    checks.database = { ok: result.rows[0]?.health === 1, ms: Date.now() - t };
  } catch (e) {
    checks.database = { ok: false, ms: 0, error: String(e) };
  }

  // 2. Critical tables exist
  try {
    const t = Date.now();
    const tables = [
      'cortex_core.users',
      '"Clickup".cup_clientes',
      '"Clickup".cup_contratos',
    ];
    const errors: string[] = [];
    for (const table of tables) {
      try {
        await pool.query(`SELECT 1 FROM ${table} LIMIT 0`);
      } catch (e) {
        errors.push(`${table}: ${String(e)}`);
      }
    }
    checks.tables = {
      ok: errors.length === 0,
      ms: Date.now() - t,
      ...(errors.length > 0 && { error: errors.join('; ') }),
    };
  } catch (e) {
    checks.tables = { ok: false, ms: 0, error: String(e) };
  }

  // 3. Memory usage
  const mem = process.memoryUsage();
  checks.memory = {
    ok: mem.heapUsed < 500 * 1024 * 1024, // < 500MB
    ms: 0,
    ...(mem.heapUsed >= 500 * 1024 * 1024 && {
      error: `Heap: ${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
    }),
  };

  const allOk = Object.values(checks).every((c) => c.ok);

  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    total_ms: Date.now() - start,
    uptime_seconds: Math.round(process.uptime()),
    checks,
  });
});

export default router;
```

**Registrar ANTES do auth middleware em `server/index.ts`:**

```typescript
import healthRouter from './routes/health';

// Health check (nao requer auth)
app.use('/api', healthRouter);

// Auth middleware (protege todas as outras rotas /api/*)
app.use('/api', isAuthenticated);
```

---

## Gerenciamento de Schema (Drizzle ORM)

O Cortex **nao usa arquivos de migration**. O schema e definido em
`shared/schema.ts` e sincronizado de duas formas:

### Como schemas propagam entre ambientes

```
1. Dev define tabela em shared/schema.ts
2. Dev adiciona CREATE TABLE IF NOT EXISTS em server/db.ts
3. Dev roda npm run db:push localmente (banco cortex_dev)
4. Codigo vai para staging via PR
5. Render staging faz deploy → server inicia → runtime cria tabelas
6. Codigo vai para producao via PR
7. Render prod faz deploy → server inicia → runtime cria tabelas
```

### Tipos de mudanca e como lidar

**SEGURO (automatico pelo runtime):**
- Criar nova tabela → `CREATE TABLE IF NOT EXISTS`
- Adicionar nova coluna → `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`

**REQUER CUIDADO (nao e automatico):**
- Renomear coluna → Requer script manual
- Mudar tipo de coluna → Requer script manual
- Remover coluna → Requer script manual
- Remover tabela → Requer script manual

**Para mudancas destrutivas:**

1. Criar script SQL na pasta `scripts/migrations/`:
   ```
   scripts/migrations/
   └── 2026-03-20_rename_column_x.sql
   ```

2. Executar manualmente em cada ambiente (dev → staging → prod)

3. Documentar no PR quais scripts precisam rodar:
   ```markdown
   ## Manual Steps Required
   - [ ] Run `scripts/migrations/2026-03-20_rename_column_x.sql` on staging DB
   - [ ] Run `scripts/migrations/2026-03-20_rename_column_x.sql` on production DB
   ```

### Regras de ouro para schema

1. **Sempre** use `cortex_core` schema para novas tabelas
2. **Sempre** adicione `CREATE TABLE IF NOT EXISTS` em `server/db.ts`
3. **Nunca** modifique tabelas de schemas externos (`Clickup`, `Conta Azul`, etc.)
4. **Nunca** faca DROP sem confirmar que nenhum codigo referencia a coluna/tabela
5. **Sempre** teste `npm run db:push` localmente antes do PR
6. **Sempre** leia `agents/db-specialist.md` e `DATABASE.md` antes de mexer em schema

---

## Desenvolvimento Paralelo com Worktrees

### Worktree vs Branch — Entendendo a diferenca

```
Branch   = NO QUE voce trabalha (uma versao/linha do codigo)
Worktree = ONDE voce trabalha (uma pasta fisica no disco)
```

**Branch e sempre obrigatorio** — toda mudanca acontece em uma branch.
**Worktree e opcional** — e uma conveniencia para ter varias branches
abertas ao mesmo tempo em pastas separadas.

Se voce esta trabalhando em uma coisa so, nao precisa de worktree.
Basta criar a branch direto na pasta Cortex/ e trabalhar.

### Como funciona o Git normalmente (sem worktree)

Um repositorio Git tem **uma pasta** e **uma branch ativa** por vez:

```
Cortex/                       ← pasta no disco
├── .git/                     ← "cerebro" do Git (todo o historico)
├── client/                   ← arquivos da branch ATUAL
├── server/
├── shared/
└── package.json
```

Quando voce faz `git checkout outra-branch`, o Git **substitui todos os
arquivos** da pasta pelos da outra branch. Nao da para ter duas branches
abertas ao mesmo tempo na mesma pasta.

### Como funciona com Worktree

Worktree cria uma **segunda pasta** que compartilha o mesmo `.git`
(mesmo historico, mesmos remotes, mesmos commits), mas com uma
**branch diferente** checked out:

```
Cortex/                       ← pasta original, branch "staging"
├── .git/                     ← cerebro COMPARTILHADO
├── client/
├── server/
└── shared/

cortex-feat-dashboard/        ← worktree, branch "feature/dashboard"
├── .git (arquivo, nao pasta) ← ponteiro para Cortex/.git
├── client/
├── server/
└── shared/
```

As duas pastas sao **independentes** — voce pode editar arquivos em uma
sem afetar a outra. Mas commits, branches e push/pull sao compartilhados
porque o `.git` e o mesmo.

### Criando um Worktree — Passo a Passo

**Metodo recomendado: Criar branch e worktree juntos**

```bash
cd /Users/mac0267/Cortex

# Garantir que staging esta atualizado
git checkout staging
git pull origin staging

# Criar branch + worktree de uma vez
git worktree add -b feature/dashboard-financeiro ../cortex-feat-dashboard staging
#                 ↑                               ↑                       ↑
#           cria branch nova                pasta destino         base (a partir de staging)
```

**O que acontece nesse comando:**
1. Git cria a branch `feature/dashboard-financeiro` a partir de `staging`
2. Cria a pasta `../cortex-feat-dashboard/`
3. Faz checkout da branch nessa pasta
4. Cria um arquivo `.git` dentro que aponta para o `.git` original

**Resultado no Finder:**

```
/Users/mac0267/
├── Cortex/                        ← branch staging (repo original)
│   ├── .git/                      ← repositorio completo
│   ├── client/
│   ├── server/
│   └── shared/
│
└── cortex-feat-dashboard/         ← branch feature/dashboard-financeiro (worktree)
    ├── .git                       ← ARQUIVO (nao pasta), aponta para Cortex/.git
    ├── client/
    ├── server/
    └── shared/
```

### Trabalhando dentro do Worktree

Uma vez criado, funciona como repositorio normal:

```bash
cd /Users/mac0267/cortex-feat-dashboard

git status          # mostra branch feature/dashboard-financeiro
npm install         # instalar deps (node_modules nao e compartilhado)
npm run dev         # dev server nessa branch (usar porta diferente se necessario)
git add .
git commit -m "..."
git push
```

**IMPORTANTE:** Cada worktree tem seu proprio `node_modules`. Rode
`npm install` ao criar um novo worktree.

### Regra importante: 1 branch = 1 lugar

Git **nao permite** a mesma branch estar em dois lugares ao mesmo tempo:

```bash
# Se Cortex/ esta em "staging":
git worktree add ../outro-staging staging
# ERRO: 'staging' is already checked out
```

### Gerenciando Worktrees

```bash
# Listar todos os worktrees ativos
git worktree list
# Saida:
# /Users/mac0267/Cortex                    abc1234 [staging]
# /Users/mac0267/cortex-feat-dashboard     def5678 [feature/dashboard-financeiro]

# Remover um worktree (apos merge do PR)
git worktree remove ../cortex-feat-dashboard

# Se tem mudancas nao commitadas, precisa forcar:
git worktree remove --force ../cortex-feat-dashboard

# Deletar a branch tambem (apos merge)
git branch -d feature/dashboard-financeiro
```

### Quando usar Branch simples vs Worktree

```
Situacao                                        Usar
──────────────────────────────────────────────  ──────────────
Trabalhando sozinho em 1 coisa por vez          So branch
Precisa alternar rapido entre 2+ features       Worktree
Rodando multiplos Claude Code em paralelo       Worktree
Bug urgente enquanto esta no meio de feature    Worktree
```

### Worktrees com Claude Code

Cada instancia do Claude Code trabalha em uma pasta separada.
Worktrees permitem rodar **multiplas sessoes em paralelo**:

```
Terminal 1 (Claude Code):
  cd /Users/mac0267/cortex-feat-dashboard
  # Trabalhando em feature/dashboard-financeiro
  npm run dev  # porta 3000

Terminal 2 (Claude Code):
  cd /Users/mac0267/cortex-feat-reports
  # Trabalhando em feature/reports
  PORT=3001 npm run dev  # porta 3001

Terminal 3 (Claude Code):
  cd /Users/mac0267/cortex-fix-auth
  # Trabalhando em fix/auth-session-expiry
  PORT=3002 npm run dev  # porta 3002
```

**Cuidado com portas:** Cada dev server precisa de uma porta diferente.
Use a env var `PORT` para alterar:

```bash
PORT=3001 npm run dev
```

**Cuidado com o banco:** Todos os worktrees apontam para o mesmo
`.env` por padrao. Se quiser isolar, crie `.env.local` em cada worktree.

### Ciclo de Vida Completo de uma Feature

```
 FASE 1: CRIAR          git worktree add -b feature/x ../cortex-feat staging
    |
    v
 FASE 2: DESENVOLVER    editar → commit → testar local → commit → ...
    |
    v
 FASE 3: STAGING        git push → PR para staging → merge
    |                    → Render deploya automaticamente
    |                    → testar em staging
    |
    v
 FASE 4: PRODUCAO       PR staging → main → merge
    |                    → Render deploya automaticamente
    |                    → verificar em producao
    |
    v
 FASE 5: LIMPAR         git worktree remove → git branch -d
    |
    v
 PROXIMO CICLO          git worktree add -b feature/y ../cortex-feat staging
```

### Limpeza apos merge

```bash
# Voltar para o repo principal
cd /Users/mac0267/Cortex

# Remover o worktree (deleta a pasta do disco)
git worktree remove ../cortex-feat-dashboard

# Deletar a branch local (ja foi merged, nao precisa mais)
git branch -d feature/dashboard-financeiro

# Atualizar staging e main locais
git checkout staging && git pull origin staging
```

**Dica:** No GitHub, va em Settings → General → "Automatically delete
head branches". Ative isso e o GitHub deleta a branch remota
automaticamente apos o merge do PR.

---

## Conflitos entre Branches

### Como conflitos funcionam

Conflitos NAO acontecem durante o desenvolvimento. Cada worktree/branch
trabalha isolada. O conflito so aparece **na hora do merge** (quando o
PR e merged em staging).

```
Worktree A (feature/dashboard)         Worktree B (feature/reports)
│                                       │
│ Edita: server/routes.ts              │ Edita: server/routes.ts
│ Edita: shared/schema.ts             │ Edita: shared/schema.ts
│                                       │
▼                                       ▼
PR para staging                         PR para staging
│                                       │
▼                                       │
Merge OK (primeiro a chegar)            │
                                        ▼
                                        CONFLITO detectado aqui!
                                        GitHub mostra: "Can't merge automatically"
```

### Tipos de conflito no Cortex

**1. Mesmo arquivo, linhas DIFERENTES — merge automatico (sem problema)**

```
Feature A editou linhas 10-20 do routes.ts
Feature B editou linhas 500-510 do routes.ts
→ Git resolve sozinho, sem conflito.
```

**2. Mesmo arquivo, mesmas LINHAS — conflito manual**

```
Feature A editou shared/schema.ts linha 150: adicionou tabela X
Feature B editou shared/schema.ts linha 150: adicionou tabela Y
→ Git nao sabe qual escolher. Pede para voce decidir.
```

**3. Schema no mesmo arquivo (o mais comum no Cortex)**

No Cortex, `shared/schema.ts` e o arquivo mais propenso a conflitos
porque toda definicao de tabela esta ali. Duas features que adicionam
tabelas novas vao editar o mesmo arquivo.

**Prevencao:** Adicione novas tabelas no FINAL do arquivo para
minimizar conflitos de posicao.

### Como prevenir conflitos

**Regra 1: Features com escopo pequeno e focado**

```
RUIM:  Feature A = "refatorar todo o sistema financeiro"
BOM:   Feature A = "adicionar campo status ao dashboard financeiro"
```

**Regra 2: Sempre atualizar sua branch antes de criar PR**

```bash
cd ../cortex-feat-reports
git pull origin staging
# Se houver conflito, resolve aqui (ambiente seguro)
```

**Regra 3: Comunicacao**

Se duas features vao mexer em `shared/schema.ts` ou `server/routes.ts`,
combinem antes para evitar conflito.

### Como resolver conflito

```bash
# No worktree da feature que tem conflito
cd ../cortex-feat-reports

# Trazer as mudancas mais recentes de staging
git pull origin staging

# Git marca os conflitos nos arquivos afetados:
#
#   <<<<<<< HEAD
#   export const dashboardTable = pgTable(...)
#   =======
#   export const reportsTable = pgTable(...)
#   >>>>>>> feature/reports

# Edite o arquivo e MANTENHA AMBAS as definicoes (geralmente e isso)
# Delete as linhas com <<<<<<<, =======, >>>>>>>

# Commit da resolucao
git add shared/schema.ts
git commit -m "fix: resolve merge conflict in schema.ts"
git push

# Volte ao GitHub — o PR agora mostra "Can merge automatically"
```

---

## Edge Cases e Cenarios Especiais

### 1. Rollback — Deploy quebrou producao

O Render permite rollback instantaneo para o deploy anterior:

```
Render Dashboard → cortex-prod → Deploys → clique em deploy anterior → "Rollback"
```

**Isso e instantaneo** — reverte para a versao anterior do codigo em
segundos, sem precisar mexer no Git.

**Para o banco de dados:**

Se o schema mudou e quebrou algo, voce precisa criar um script corretivo:

```sql
-- scripts/migrations/2026-03-20_rollback_coluna_x.sql
ALTER TABLE cortex_core.minha_tabela DROP COLUMN IF EXISTS coluna_problemática;
```

Rodar manualmente no banco de producao e depois commitar o fix.

### 2. Staging "preso" — Features misturadas

Cenario: 3 features foram merged em staging, mas so 2 estao prontas.

```
staging contem:
  ✅ feature/dashboard      (pronta)
  ✅ feature/reports         (pronta)
  ❌ feature/auth-refactor   (com bug)
```

**Solucao A: Corrigir o bug antes (preferida)**

Voltar para a branch da feature, corrigir, novo PR para staging.

**Solucao B: Reverter a feature com bug em staging**

```bash
git checkout staging
git revert <commit-hash-da-feature-com-bug>
git push
# Agora staging so tem as 2 features prontas
```

**Como prevenir:** Nao acumule features em staging. Ciclo rapido:
staging → main assim que testado.

### 3. Hotfix urgente — Bypass de staging

Bug critico em producao que nao pode esperar o fluxo completo.

```bash
# 1. Criar branch hotfix a partir de MAIN (nao staging!)
git checkout main
git pull origin main
git checkout -b hotfix/fix-critical-bug

# 2. Corrigir o minimo necessario
# ... edita apenas o que resolve o bug ...
git add .
git commit -m "hotfix: fix critical auth session expiry"
git push -u origin hotfix/fix-critical-bug

# 3. PR hotfix → main (deploy producao direto)
# No GitHub: base main ← compare hotfix/fix-critical-bug
# Review rapido, merge

# 4. IMPORTANTE: Trazer o hotfix de volta para staging
git checkout staging
git pull origin staging
git merge main
git push origin staging
```

**Quando usar hotfix:**
- Sistema fora do ar
- Bug que impede usuarios de usar funcionalidade critica
- Problema de seguranca

**Quando NAO usar hotfix:**
- Bug menor que pode esperar
- Feature incompleta
- "Urgencia" que nao e urgencia real

### 4. Schema change destrutivo

Mudancas que removem ou alteram colunas existentes precisam de cuidado
especial porque o `CREATE TABLE IF NOT EXISTS` nao trata esse caso.

**Fluxo seguro para mudancas destrutivas:**

```
1. Criar script SQL em scripts/migrations/
2. Testar no banco cortex_dev
3. Incluir no PR com checklist de execucao manual
4. No merge para staging: executar script no banco cortex_staging
5. No merge para main: executar script no banco dados_turbo
```

**Template do script:**

```sql
-- scripts/migrations/YYYY-MM-DD_descricao.sql
-- DESCRICAO: O que essa mudanca faz
-- REVERSIVEL: Sim/Nao
-- PERDA DE DADOS: Sim/Nao
-- EXECUTAR EM: dev → staging → producao (nessa ordem)

BEGIN;

-- Sua mudanca aqui
ALTER TABLE cortex_core.minha_tabela
  DROP COLUMN IF EXISTS coluna_antiga;

COMMIT;
```

### 5. Ordem de deploy — Frontend vs Backend

No Cortex, frontend e backend sao deployados JUNTOS (monolito).
O build gera `dist/index.js` (servidor) + `dist/public/` (frontend).

Isso significa que **nao ha gap** entre frontend e backend — ambos
sobem na mesma versao. Essa e uma vantagem do monolito.

O unico risco e durante o deploy (alguns segundos de downtime no Render).
O Render faz **zero-downtime deploy** por padrao (inicia o novo antes
de parar o antigo).

### 6. Ambiente de desenvolvimento local

**Setup inicial (uma vez):**

1. **Instalar pre-requisitos:**
   ```bash
   # Node.js 20+ (se nao tem)
   brew install node@20

   # Docker Desktop (para banco local)
   brew install --cask docker
   ```

2. **Clonar o repositorio:**
   ```bash
   git clone https://github.com/Warleypablo/Cortex.git
   cd Cortex
   npm install
   ```

3. **Subir banco de dados local:**
   ```bash
   docker run -d \
     --name cortex-dev-db \
     -e POSTGRES_DB=cortex_dev \
     -e POSTGRES_USER=cortex \
     -e POSTGRES_PASSWORD=dev123 \
     -p 5432:5432 \
     -v cortex_pgdata:/var/lib/postgresql/data \
     postgres:16
   ```

4. **Criar `.env` apontando para banco local:**
   ```bash
   cp .env.example .env
   # As variaveis DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD ja vem configuradas para localhost
   # O .env.example ja existe na raiz do projeto
   ```

5. **Push do schema e iniciar:**
   ```bash
   npm run db:push    # cria tabelas no banco local
   npm run dev        # inicia servidor em localhost:3000
   ```

**O `.env.example` ja existe na raiz do projeto.** Copie para `.env` e ajuste os valores:

```bash
# .env.example — copie para .env e preencha os valores

# Banco local (Docker) — variaveis individuais
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cortex_dev
DB_USER=cortex
DB_PASSWORD=dev123
DB_SSL=false

# Sessao
SESSION_SECRET=qualquer-string-aleatoria-para-dev

# Google OAuth (pedir ao admin do projeto)
GOOGLE_CLIENT_ID=seu-google-client-id
GOOGLE_CLIENT_SECRET=seu-google-client-secret

# URL base
BASE_URL=http://localhost:3000

# ... demais variaveis (ver .env.example para lista completa)
```

**Resetar banco local do zero:**

```bash
docker stop cortex-dev-db && docker rm cortex-dev-db
docker volume rm cortex_pgdata

# Recriar
docker run -d \
  --name cortex-dev-db \
  -e POSTGRES_DB=cortex_dev \
  -e POSTGRES_USER=cortex \
  -e POSTGRES_PASSWORD=dev123 \
  -p 5432:5432 \
  -v cortex_pgdata:/var/lib/postgresql/data \
  postgres:16

npm run db:push
```

---

## Integracao com Workflow Existente

O Cortex ja tem um workflow pos-mudanca definido no `CLAUDE.md` e
nos agents. Esse workflow **continua valido** e se integra ao
fluxo de branches:

### Workflow pos-commit (em qualquer branch)

Apos cada mudanca de codigo, executar **TODOS** os passos:

1. **Git:** Stage, commit (Conventional Commits), push
   → Ver `agents/git-autopush-SKILL.md`

2. **Changelog:** Adicionar entrada em `docs/CHANGELOG.md`

3. **Obsidian:** Atualizar vault em
   `/Users/mac0267/Documents/Obsidian Vault/Córtex 2.0/`
   → Ver `agents/obsidian-sync-SKILL.md`

4. **Chamados:** Se trabalhando em uma task, atualizar status:
   ```sql
   UPDATE cortex_core.chamados
   SET status='review', atualizado_em=NOW()
   WHERE id=<chamado_id>;
   ```

### Quando executar cada passo

| Evento | Git | Changelog | Obsidian | Chamado |
|--------|-----|-----------|----------|---------|
| Cada commit | ✅ | ✅ | ✅ | — |
| Feature completa | ✅ | ✅ | ✅ | ✅ `review` |
| Merge em staging | — | — | — | — |
| Merge em main | — | — | — | — |

---

## Plano de Implementacao

O plano detalhado com checklist por fase esta em **`PLANO-INFRAESTRUTURA.md`**.

Resumo das fases:

| Fase | O que | Tempo |
|------|-------|-------|
| **0** | Banco local Docker | 15 min |
| **0.5** | Banco staging (Render PostgreSQL) | 10 min |
| **1** | Branch staging + protection no GitHub | 10 min |
| **2** | Health check endpoint `/api/health` | 20 min |
| **3** | GitHub Actions (lint, check, build, test) | 30 min |
| **4** | Web Service staging no Render | 20 min |
| **5** | Teste end-to-end do fluxo completo | 15 min |

---

## Comandos de Referencia Rapida

```bash
# === Banco Local (Docker) ===
docker start cortex-dev-db            # Iniciar banco (apos reiniciar Mac)
docker stop cortex-dev-db             # Parar banco
docker ps                             # Verificar se esta rodando
docker exec -it cortex-dev-db psql -U cortex -d cortex_dev  # Conectar psql

# === Git ===
git checkout staging && git pull                # Atualizar staging
git checkout -b feature/nome                    # Nova feature
git push -u origin feature/nome                 # Enviar para GitHub
git checkout staging && git pull                # Voltar e atualizar

# === Worktrees ===
git worktree add -b feature/x ../cortex-x staging   # Criar worktree + branch
git worktree list                                     # Listar worktrees
git worktree remove ../cortex-x                       # Remover worktree
git branch -d feature/x                               # Deletar branch local

# === Desenvolvimento ===
npm run dev                           # Dev server localhost:3000
PORT=3001 npm run dev                 # Dev server em porta alternativa
npm run db:push                       # Push schema para banco local
npm run check                         # Type-check
npm run lint                          # Lint
npm test                              # Testes
npm run build                         # Build de producao

# === Verificar status ===
git status                            # Mudancas locais
git log --oneline -10                 # Ultimos commits
git branch -a                         # Listar branches
lsof -ti:3000 | xargs kill -9        # Matar dev server na porta 3000
curl http://localhost:3000/api/health # Health check local
```

---

## Diagrama de Decisao

```
Preciso fazer uma mudanca?
       |
       v
Criar branch feature/* a partir de staging
       |
       v
Worktree? ---- So 1 coisa por vez ----> So branch, sem worktree
  |
  Multiplas features / Claude Code paralelo
  |
  v
git worktree add -b feature/x ../cortex-x staging
       |
       v
Desenvolver + testar localmente (banco cortex_dev)
       |
       v
Pronto? ---- Nao ----> Continuar desenvolvendo
  |
  Sim
  |
  v
Push + PR para staging
       |
       v
GitHub Actions valida (lint, check, build, test)
       |
       v
Merge + Render faz deploy automatico em staging
       |
       v
Testar em staging (banco cortex_staging) --- Bug? ---> Corrigir, novo PR
  |
  Ok
  |
  v
PR de staging para main
       |
       v
GitHub Actions valida + Render faz deploy em producao
       |
       v
Verificar em producao + Health check
       |
       v
Limpar worktree + branch
       |
       v
Done! Proximo ciclo.
```

---

## Glossario

| Termo | O que e |
|-------|---------|
| **Branch** | Uma "copia" paralela do codigo. Permite trabalhar sem afetar o original. |
| **Commit** | Um "snapshot" das suas mudancas, com mensagem descritiva. |
| **Push** | Enviar seus commits locais para o GitHub (remoto). |
| **Pull** | Baixar mudancas do GitHub para sua maquina. |
| **Pull Request (PR)** | Pedido de revisao para juntar uma branch em outra. |
| **Merge** | Juntar uma branch em outra (aplicar as mudancas). |
| **Worktree** | Copia fisica no disco do mesmo repo, com branch diferente. |
| **CI/CD** | Continuous Integration/Delivery — automacao que roda ao fazer push/merge. |
| **GitHub Actions** | Servico do GitHub que executa automacoes (os workflows). |
| **Render** | Plataforma de deploy (equivalente a Vercel/Heroku). |
| **Drizzle ORM** | ORM TypeScript para PostgreSQL usado no Cortex. |
| **Schema** | Definicao da estrutura do banco de dados (tabelas, colunas, tipos). |
| **Health Check** | Endpoint que verifica se a aplicacao esta funcionando. |
| **Monolito** | Arquitetura onde frontend + backend rodam no mesmo processo. |
| **Rollback** | Reverter para uma versao anterior do codigo/deploy. |
| **Hotfix** | Correcao urgente que vai direto para producao. |
