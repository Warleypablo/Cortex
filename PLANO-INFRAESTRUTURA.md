# Plano de Implementacao — Infraestrutura de Desenvolvimento Cortex

> **Objetivo:** Sair do cenario atual (tudo em producao, sem CI/CD, sem staging)
> para um workflow profissional com ambientes isolados, validacao automatica e
> deploy seguro.
>
> **Referencia:** O workflow completo esta documentado em `WORKFLOW-DESENVOLVIMENTO.md`.

## Situacao Atual

```
HOJE:
  Dev local → npm run dev → banco de PRODUCAO (dados_turbo)
  Git push direto em main → Render faz deploy automatico
  Sem CI/CD, sem staging, sem health check, sem validacao
```

## Situacao Desejada

```
FUTURO:
  Dev local → npm run dev → banco LOCAL (Docker PostgreSQL)
       |
       +→ PR para staging → GitHub Actions valida → Render staging deploya
                                                     (banco: Render PostgreSQL)
       |
       +→ PR para main → GitHub Actions valida → Render prod deploya
                                                   (banco: Google Cloud SQL)
```

---

## Fases

| Fase | O que | Onde | Depende de | Risco |
|------|-------|------|------------|-------|
| **0** | Banco local Docker | Sua maquina | Nada | Nenhum |
| **0.5** | Banco staging Render | Render Dashboard | Nada | Nenhum |
| **1** | Branch staging + protection | GitHub | Nada | Nenhum |
| **2** | Health check endpoint | Codigo (server/) | Nada | Baixo |
| **3** | GitHub Actions CI/CD | Codigo (.github/) | Fase 1 | Nenhum |
| **4** | Web Service staging Render | Render Dashboard | Fases 0.5, 1, 2 | Nenhum |
| **5** | Teste end-to-end | Tudo junto | Todas | Nenhum |

**Fases 0, 0.5 e 1 podem ser feitas em paralelo** (sao independentes).
Fase 2 tambem e independente mas e pre-requisito da 4.

```
Paralelo:  Fase 0 ──────┐
           Fase 0.5 ─────┤
           Fase 1 ───────┤
           Fase 2 ───────┤
                          ▼
Sequencial:          Fase 3 → Fase 4 → Fase 5
```

---

## Fase 0: Banco de dados local (Docker)

> **Objetivo:** Parar de usar banco de producao para desenvolvimento.
> **Tempo estimado:** 15 minutos
> **Quem executa:** Dev (sua maquina)

### Checklist

- [ ] **0.1** Instalar Docker Desktop (se nao tem)
  ```bash
  brew install --cask docker
  # Abrir Docker Desktop e aguardar inicializar
  ```

- [ ] **0.2** Criar container PostgreSQL local
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

- [ ] **0.3** Atualizar `.env` para apontar para banco local
  ```bash
  # Alterar DATABASE_URL no .env:
  DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=cortex_dev
   DB_USER=cortex
   DB_PASSWORD=dev123
   DB_SSL=false
  ```

- [ ] **0.4** Push do schema Drizzle para o banco local
  ```bash
  npm run db:push
  ```

- [ ] **0.5** Iniciar o servidor e verificar que funciona
  ```bash
  npm run dev
  # O runtime cria tabelas adicionais via CREATE TABLE IF NOT EXISTS
  # Verificar: http://localhost:3000 carrega?
  ```

- [x] **0.6** ~~Criar `.env.example`~~ — **FEITO** (`.env.example` criado na raiz)

- [ ] **0.7** (Opcional) Criar `scripts/seed-dev.sql` com dados minimos de teste

### Validacao

```bash
docker ps | grep cortex-dev-db     # Container rodando?
npm run dev                         # Servidor inicia sem erro?
# Navegar para http://localhost:3000 — carrega a pagina?
```

---

## Fase 0.5: Banco de dados staging (Render PostgreSQL)

> **Objetivo:** Criar banco isolado para o ambiente de staging.
> **Tempo estimado:** 10 minutos
> **Quem executa:** Admin (Render Dashboard)

### Checklist

- [ ] **0.5.1** No Render Dashboard → New → PostgreSQL
  | Campo | Valor |
  |-------|-------|
  | Name | `cortex-staging-db` |
  | Database | `cortex_staging` |
  | User | `cortex_staging_user` |
  | Region | Ohio (ou mesma regiao da app) |
  | PostgreSQL Version | 16 |
  | Plan | Free (90 dias) ou Starter ($7/mes) |

- [ ] **0.5.2** Anotar a **Internal Database URL**
  - Formato: `postgresql://cortex_staging_user:pass@dpg-xxx.render.com:5432/cortex_staging`
  - Sera usada na Fase 4

- [ ] **0.5.3** (Opcional) Copiar dados essenciais de producao para staging
  ```bash
  # Exportar subset de producao
  pg_dump -h 34.95.249.110 -U <user> -d dados_turbo \
    -t cortex_core.users \
    -t cortex_core.user_permissions \
    --data-only > staging_seed.sql

  # Importar no Render PostgreSQL (usar External Database URL)
  psql <RENDER_EXTERNAL_URL> < staging_seed.sql
  ```

### Validacao

```bash
# Conectar no banco staging via External URL
psql <RENDER_EXTERNAL_URL> -c "SELECT 1;"
# Deve retornar sem erro
```

---

## Fase 1: Configuracao do Git (branches)

> **Objetivo:** Criar branch staging e proteger main/staging contra push direto.
> **Tempo estimado:** 10 minutos
> **Quem executa:** Admin (GitHub)

### Checklist

- [x] **1.1** ~~Criar branch `staging` a partir de `main`~~ — **FEITO** (branch `staging` criada e pushed)

- [x] **1.2** ~~Configurar branch protection para `main`~~ — **FEITO** (PR required + status check `validate`)

- [x] **1.3** ~~Configurar branch protection para `staging`~~ — **FEITO** (PR required + status check `validate`)

- [x] **1.4** ~~Ativar auto-delete de branches~~ — **FEITO** (`delete_branch_on_merge: true`)

### Validacao

```bash
git push origin main  # Deve ser REJEITADO (protection ativo)
git branch -a         # Deve mostrar origin/staging e origin/main
```

---

## Fase 2: Health Check Endpoint

> **Objetivo:** Criar endpoint `/api/health` para monitoramento.
> **Tempo estimado:** 20 minutos
> **Quem executa:** Dev (codigo)

### Checklist

- [x] **2.1** ~~Criar `server/routes/health.ts`~~ — **FEITO**
  ```typescript
  import { Router } from 'express';
  import { pool } from '../db';

  const router = Router();

  router.get('/health', async (req, res) => {
    const start = Date.now();
    const checks: Record<string, { ok: boolean; ms: number; error?: string }> = {};

    // Database connection
    try {
      const t = Date.now();
      const result = await pool.query('SELECT 1 as health');
      checks.database = { ok: result.rows[0]?.health === 1, ms: Date.now() - t };
    } catch (e) {
      checks.database = { ok: false, ms: 0, error: String(e) };
    }

    // Critical tables
    try {
      const t = Date.now();
      const tables = ['cortex_core.users', '"Clickup".cup_clientes', '"Clickup".cup_contratos'];
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

    // Memory
    const mem = process.memoryUsage();
    checks.memory = {
      ok: mem.heapUsed < 500 * 1024 * 1024,
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

- [x] **2.2** ~~Registrar em `server/routes.ts` ANTES do auth middleware~~ — **FEITO** (linha 418)
  ```typescript
  import healthRouter from './routes/health';
  // ...
  app.use('/api', healthRouter);      // Health check (sem auth)
  app.use('/api', isAuthenticated);   // Auth middleware (protege o resto)
  ```

- [ ] **2.3** Testar localmente (requer banco local — Fase 0)
  ```bash
  npm run dev
  curl http://localhost:3000/api/health | jq .
  # Deve retornar { "status": "healthy", ... }
  ```

- [x] **2.4** ~~Commit e push~~ — **FEITO** (commit `76f7d340`)

### Validacao

```
HTTP 200 + JSON com status "healthy" = OK
HTTP 503 + JSON com status "degraded" = algo falhou (ver campo checks)
```

---

## Fase 3: GitHub Actions (CI/CD)

> **Objetivo:** Validacao automatica em cada PR (lint, type-check, build, tests).
> **Tempo estimado:** 30 minutos
> **Quem executa:** Dev (codigo)
> **Depende de:** Fase 1 (branch staging deve existir)

### Checklist

- [x] **3.1** ~~Criar `.github/workflows/pr-checks.yml`~~ — **FEITO**
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

- [x] **3.2** ~~Criar `.github/workflows/schema-check.yml`~~ — **FEITO**
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
            echo "> **Review these changes carefully.** Schema changes affect the database." >> $GITHUB_STEP_SUMMARY

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
                  body: `## ⚠️ Schema Changes Detected\n\nThis PR modifies database schema files:\n${schemaChanged ? '- \`shared/schema.ts\`\n' : ''}${dbChanged ? '- \`server/db.ts\`\n' : ''}\n**Checklist before merge:**\n- [ ] New tables use \`cortex_core\` schema\n- [ ] \`CREATE TABLE IF NOT EXISTS\` added to \`server/db.ts\`\n- [ ] No destructive changes (DROP TABLE/COLUMN)\n- [ ] Tested \`npm run db:push\` locally`
                });
              }
  ```

- [ ] **3.3** Criar `.github/workflows/health-check.yml` (opcional, pos-deploy — fazer depois da Fase 4)
  ```yaml
  name: Post-Deploy Health Check

  on:
    workflow_dispatch:
      inputs:
        environment:
          description: 'Environment to check'
          required: true
          type: choice
          options: [staging, production]

  jobs:
    health-check:
      runs-on: ubuntu-latest
      steps:
        - name: Determine URL
          id: url
          run: |
            if [ "${{ github.event.inputs.environment }}" = "staging" ]; then
              echo "url=${{ vars.STAGING_URL }}" >> $GITHUB_OUTPUT
            else
              echo "url=${{ vars.PRODUCTION_URL }}" >> $GITHUB_OUTPUT
            fi

        - name: Health check
          run: |
            sleep 30
            HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
              "${{ steps.url.outputs.url }}/api/health" --max-time 15)
            if [ "$HTTP_CODE" != "200" ]; then
              echo "Health check failed (HTTP $HTTP_CODE)"
              exit 1
            fi
            echo "Health check passed (HTTP 200)"
  ```

- [x] **3.4** ~~Commit e push~~ — **FEITO** (incluido no commit `76f7d340`, ja em main e staging)

- [x] **3.5** ~~Configurar GitHub Variables~~ — **FEITO** (`STAGING_URL`, `PRODUCTION_URL`)

- [x] **3.6** ~~Ativar required status checks~~ — **FEITO** (check `validate` obrigatorio em main e staging)

### Validacao

```
Criar PR de teste → GitHub Actions roda automaticamente?
  ✅ Lint passou?
  ✅ Type check passou?
  ✅ Build passou?
  ✅ Testes passaram?
```

---

## Fase 4: Web Service Staging no Render

> **Objetivo:** Ambiente staging com deploy automatico a partir da branch staging.
> **Tempo estimado:** 20 minutos
> **Quem executa:** Admin (Render Dashboard)
> **Depende de:** Fases 0.5 (DB), 1 (branch), 2 (health check)

### Checklist

- [ ] **4.1** Render Dashboard → New → Web Service

  | Campo | Valor |
  |-------|-------|
  | Source | GitHub → `Warleypablo/Cortex` |
  | Name | `cortex-staging` |
  | Environment | Node |
  | Branch | `staging` |
  | Build Command | `npm install && npm run build` |
  | Start Command | `npm start` |
  | Plan | Starter ($7/mes) ou Free |
  | Auto-Deploy | Yes |
  | Health Check Path | `/api/health` |

- [ ] **4.2** Linkar PostgreSQL ao Web Service
  - No servico `cortex-staging` → Environment → Add from Service
  - Selecionar `cortex-staging-db`
  - Isso injeta `DATABASE_URL` automaticamente

- [ ] **4.3** Copiar env vars de producao para staging
  - Copiar TODAS as env vars do `cortex-prod`
  - **Alterar:**
    | Variavel | Valor staging |
    |----------|---------------|
    | `DATABASE_URL` | (ja linkado no passo anterior) |
    | `BASE_URL` | `https://cortex-staging.onrender.com` |
    | `SESSION_SECRET` | Gerar novo: `openssl rand -hex 32` |

- [ ] **4.4** Aguardar primeiro deploy e verificar
  ```
  https://cortex-staging.onrender.com/api/health → HTTP 200?
  https://cortex-staging.onrender.com → Pagina carrega?
  ```

- [ ] **4.5** Atualizar producao: adicionar Health Check Path
  - Render Dashboard → `cortex-prod` → Settings → Health Check Path → `/api/health`

### Validacao

```
cortex-staging.onrender.com/api/health → { "status": "healthy" }
cortex-staging.onrender.com → Login page carrega
Render Dashboard → cortex-staging → Deploys → "Live" com check verde
```

---

## Fase 5: Teste End-to-End do Workflow

> **Objetivo:** Validar o fluxo completo feature → staging → producao.
> **Tempo estimado:** 15 minutos
> **Quem executa:** Dev
> **Depende de:** Todas as fases anteriores

### Checklist

- [ ] **5.1** Criar branch de teste
  ```bash
  git checkout staging
  git pull origin staging
  git checkout -b feature/test-workflow
  ```

- [ ] **5.2** Fazer mudanca minima (ex: adicionar comentario)
  ```bash
  # Editar qualquer arquivo inofensivo
  git add .
  git commit -m "chore: test CI/CD workflow"
  git push -u origin feature/test-workflow
  ```

- [ ] **5.3** Criar PR: `feature/test-workflow` → `staging`
  - GitHub → Compare & pull request

- [ ] **5.4** Verificar GitHub Actions
  - [ ] `PR Checks / validate` rodou e passou? (lint, check, build, test)

- [ ] **5.5** Merge PR e verificar staging
  - [ ] Render staging fez deploy automatico?
  - [ ] `cortex-staging.onrender.com/api/health` retorna 200?
  - [ ] App funciona em staging?

- [ ] **5.6** Criar PR: `staging` → `main`
  - [ ] GitHub Actions rodou e passou?

- [ ] **5.7** Merge e verificar producao
  - [ ] Render producao fez deploy automatico?
  - [ ] `cortex.turbopartners.com.br/api/health` retorna 200?
  - [ ] App funciona em producao?

- [ ] **5.8** Limpar
  ```bash
  git checkout staging && git pull
  git branch -d feature/test-workflow
  ```

### Validacao Final

Se todos os itens acima foram marcados, o workflow esta 100% operacional:

```
✅ Dev local com banco isolado (Docker)
✅ Branch protection em main e staging
✅ GitHub Actions validando PRs
✅ Staging com deploy automatico no Render
✅ Health check monitorando ambos os ambientes
✅ Fluxo feature → staging → producao funcionando
```

---

## Ordem de Execucao Recomendada

```
DIA 1 (setup basico):
  ├── Fase 0   — Docker local          (15 min)
  ├── Fase 0.5 — Render PostgreSQL     (10 min)
  └── Fase 1   — Git branches          (10 min)

DIA 1 (codigo):
  ├── Fase 2   — Health check endpoint (20 min)
  └── Fase 3   — GitHub Actions        (30 min)

DIA 2 (infraestrutura + teste):
  ├── Fase 4   — Render staging        (20 min)
  └── Fase 5   — Teste end-to-end      (15 min)

TOTAL: ~2 horas de trabalho efetivo
```
