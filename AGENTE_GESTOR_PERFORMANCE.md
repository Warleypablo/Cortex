# Agente Gestor de Performance — Handoff

Documento de transferência de contexto para continuar o trabalho em outro terminal/sessão.
Branch: `feature/agente-gestor-meta-ads` (baseado em `origin/staging`).

---

## 1. Objetivo da feature

Criar um **agente de IA "Gestor de Performance"** que analisa criativos de Meta Ads
(na aba **Criativos** do Cortex) e pode **pausar/reativar anúncios** ou **ajustar daily
budget** via Meta Marketing API. Na V1, o agente opera em **modo supervisionado**:
ele sugere ações (propostas), mas quem executa é sempre um admin humano que confirma
no drawer lateral.

### Por que supervisionado
- Zero risco de agente "ensandecido" pausando anúncios errados
- Auditoria completa (quem aprovou, quando, por quê)
- Permite ganhar confiança antes de migrar para semi-autônomo (Fase 3+)

---

## 2. Decisões-chave já tomadas

| Decisão | Escolha | Razão |
|---|---|---|
| Aprovador | Reusar middleware `isAdmin` existente (Caio + Warley) | Simples. V1 não precisa de granularidade. |
| Ações suportadas | pause / resume / budget_update | Cobre 95% das intervenções manuais. |
| Teto de budget | R$ 1.000/dia por padrão (`META_ADS_MAX_DAILY_BUDGET_CENTS=100000`) | Limite absoluto acima do guard-rail de ±30%. |
| Delta máximo de budget | ±30% do valor atual | Evita saltos absurdos. |
| Mínimo de dados pra pausar | 7 dias consecutivos | Evita pausar por variação aleatória. |
| Mínimo pra aumentar budget | ROAS ≥ 1.5× meta por ≥ 14 dias | Evita queimar budget em hype. |
| Modelo do agente | Claude Sonnet 4.5 (`claude-sonnet-4-5-20250514`) | Já usado em `ia-hub.ts`; barato e capaz. |
| Fase 1 filosofia | **100% aditiva** — zero mudança em código existente | Único cenário de falha possível: "a feature nova não funciona". Nada pré-existente pode quebrar. |

### Fase 2 (documentada, não implementada)
- Migrar `metaAdsSync.ts` para Bearer header (hoje usa token em query string)
- Upgrade da API de `v18.0` → `v21.0` no sync
- Adicionar `isAdmin` na rota `/api/meta-ads/sync` (furo de segurança atual)
- Coluna `protected_until` em `meta_ads.meta_ads` (pra proteger criativos em teste)
- Campo granular `canManageMetaAds` em `auth_users`
- Step-up reauth Google antes de confirmar ações destrutivas
- Cache de LLM por filtro
- Rate limit local
- Modo semi-autônomo / autônomo / cron

---

## 3. Arquitetura

```
Criativos.tsx  ─(click "Analisar com IA")─►  POST /api/criativos/agent/analyze
                                                          │
                                                          ▼
                                             criativosAgent.ts (Anthropic SDK)
                                                          │
                                                          │ tool_use loop
                                                          ▼
                                             growthAiTools.ts
                                              ├─ [leitura]  getAdsMetrics, getDealsMetrics,
                                              │              getBudgets, getCriativoTimeSeries
                                              └─ [escrita*] proposePauseEntity, proposeResumeEntity,
                                                            proposeBudgetChange
                                                            (*apenas INSERT em meta_actions_log, NUNCA chama Meta API)

                                                          ▼
                                             cortex_core.meta_actions_log  (status='pending')
                                                          │
                                                          ▼
Drawer em Criativos.tsx  ◄─── GET /api/meta/actions/pending (polling 15s quando drawer aberto)

Admin clica "Confirmar"  ─────►  POST /api/meta/actions/pause|resume|budget
                                                          │
                                                          │ optimistic lock
                                                          │ UPDATE ... WHERE id=? AND status='pending'
                                                          │ (rowcount=0 → 409 Conflict)
                                                          ▼
                                             metaAdsWrite.ts (v21.0, Bearer header)
                                                          │
                                                          ▼
                                             Meta Marketing API  ───► sucesso ou erro sanitizado
                                                          │
                                                          ▼
                                             cortex_core.meta_actions_log  (status='success' ou 'error')
                                             meta_ads.meta_ads|adsets|campaigns  (mirror local atualizado)
```

---

## 4. Arquivos criados e modificados

### Criados (novos)

| Arquivo | O que faz |
|---|---|
| `scripts/create_meta_actions_log.sql` | Migration DDL da tabela `cortex_core.meta_actions_log` |
| `server/services/metaAdsWrite.ts` | Camada isolada de escrita Meta API v21.0: `pauseEntity`, `resumeEntity`, `updateDailyBudget`, `validateBudgetChange`, `readEntitySnapshot`, `sanitizeError`. Bearer header sempre, backoff exponencial em 80004/613, mirror local em `meta_ads.*` |
| `server/routes/metaActions.ts` | Router Express com `isAuthenticated + isAdmin` local: `POST pause/resume/budget`, `GET pending/history`, `POST :logId/ignore`. Suporta fluxo humano (sem `fromLogId`) e fluxo de confirmação de proposta (com `fromLogId` + optimistic lock) |
| `server/routes/criativosAgent.ts` | Router Express com `POST /analyze` que roda Claude Sonnet 4.5 via Anthropic SDK num loop de `tool_use` (até 8 turnos). Converte `GROWTH_AI_TOOLS` do formato OpenAI para Anthropic |

### Editados (aditivo)

| Arquivo | O que foi adicionado |
|---|---|
| `shared/schema.ts` | Tabela Drizzle `metaActionsLog` em `cortexCoreSchema` + tipos `MetaActionLog`, `InsertMetaActionLog` |
| `server/db.ts` | Função `initializeMetaActionsLogTable()` no final do arquivo |
| `server/index.ts` | Import + chamada de `initializeMetaActionsLogTable()` na fase paralela. Mount dos 2 routers novos: `app.use('/api/meta/actions', metaActionsRouter)` e `app.use('/api/criativos/agent', criativosAgentRouter)` |
| `server/services/growthAiTools.ts` | **⚠️ ESTADO ATUAL INCERTO — VER SEÇÃO 6.** Originalmente: append de 4 tools no array `GROWTH_AI_TOOLS` (propose*, getCriativoTimeSeries) + append de implementações + novo dispatcher `executeCriativosAgentTool` + tipo `CriativosAgentContext`. **Linter/user pode ter revertido** |
| `client/src/pages/Criativos.tsx` | Botão "Analisar com IA" + botão "Propostas" (admin only), drawer lateral com propostas, badge "IA" nas linhas com proposta pendente, mutations `analyzeMutation` / `confirmProposalMutation` / `ignoreProposalMutation`, query `/api/meta/actions/pending` |

### NÃO tocados nesta fase

- `server/services/metaAdsSync.ts` (continua em v18.0 + query string)
- `server/routes.ts` (o `isAdmin` foi copiado inline em cada router novo)
- Qualquer outra página do cliente
- Outras tabelas em `meta_ads.*` (sem `ALTER TABLE`)

---

## 5. Schema da tabela de auditoria

`cortex_core.meta_actions_log`:

```sql
id                    SERIAL PRIMARY KEY
created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
actor_type            VARCHAR(16)  -- 'human' | 'agent'
actor_user_id         VARCHAR(64)
actor_email           VARCHAR(255)
level                 VARCHAR(16)  -- 'ad' | 'adset' | 'campaign'
entity_id             VARCHAR(64)  -- Meta id (ad_id/adset_id/campaign_id)
entity_name           TEXT
action                VARCHAR(32)  -- 'pause' | 'resume' | 'budget_update'
payload_json          JSONB        -- valores novos
previous_value_json   JSONB        -- snapshot pré-ação (rollback/audit)
reason                TEXT         -- justificativa (>=5 chars, obrigatório)
agent_rationale_text  TEXT         -- rationale do agente quando actor_type='agent'
status                VARCHAR(16)  -- 'pending' | 'executing' | 'success' | 'error' | 'ignored'
meta_error_json       JSONB        -- erro Meta sanitizado (sem access_token)
confirmed_by_user_id  VARCHAR(64)
confirmed_at          TIMESTAMPTZ

Indexes:
  idx_meta_actions_log_entity   ON (entity_id, status)
  idx_meta_actions_log_pending  ON (status) WHERE status='pending'
```

**Lifecycle típico de uma proposta do agente:**
1. Agente chama tool `proposePauseEntity` → INSERT com `status='pending'`, `actor_type='agent'`
2. Admin abre drawer → `GET /api/meta/actions/pending` lista
3. Admin clica "Confirmar" → `POST /api/meta/actions/pause` com `fromLogId`
4. Router faz `UPDATE ... SET status='executing' WHERE id=? AND status='pending'` (optimistic lock)
5. Se rowcount=1 → chama Meta API → atualiza status para `success` ou `error`
6. Se rowcount=0 → retorna `409 Conflict` ("outro admin já pegou")

---

## 6. ⚠️ Estado atual do preview e problemas conhecidos

### 6.1 `growthAiTools.ts` pode ter sido revertido

Um system-reminder indicou que o arquivo foi modificado "intencionalmente" após meu
append, mostrando que ele termina em **linha 125** (fim do array original) e o dispatcher
`executeGrowthTool` termina em **linha 534** — ou seja, as ~170 linhas que eu appendei
(tools propose*, implementações, `executeCriativosAgentTool`, `CriativosAgentContext`)
**podem ter sido removidas**.

Se sim, `criativosAgent.ts` quebra no import:
```ts
import { GROWTH_AI_TOOLS, executeCriativosAgentTool, type CriativosAgentContext } from '../services/growthAiTools';
```

**Checar primeiro:**
```bash
grep -n "executeCriativosAgentTool\|CriativosAgentContext\|proposePauseEntity" server/services/growthAiTools.ts
```

Se vazio → preciso re-adicionar o append (é pura adição, não destrutiva).

### 6.2 Erro separado do Vite (não relacionado)

O dev server mostrou também:
```
Failed to resolve import "@assets/logo-turbo-light.svg" from "client/src/components/app-sidebar.tsx"
```

Isso é um problema pré-existente do projeto (alias `@assets` não resolve no seu local) e
**não foi causado pelo meu trabalho** — `app-sidebar.tsx` não foi tocado nesta branch.
Pode ser cache do Vite, branch switch antigo ou asset faltando. Vale `git status` e
verificar se `client/public/assets/` ou `attached_assets/` tem esses SVGs.

### 6.3 Dev server
Quando rodar `npm run dev`, a porta padrão é **3000** (definida em `server/index.ts` via
`PORT || '3000'`). Se der `EADDRINUSE`, matar com:
```bash
lsof -ti tcp:3000 | xargs -r kill -9
```

Cache do Vite pode corromper ("file does not exist at .vite/deps/chunk-*"). Limpar com:
```bash
rm -rf node_modules/.vite
```

---

## 7. Variáveis de ambiente necessárias

Confirmar em `.env`:

| Var | Uso | Obrigatório |
|---|---|---|
| `ACCESS_TOKEN_META_SYSTEM` | Token System User com escopo `ads_management` | Sim |
| `BUSINESS_ID_META` | Business ID da conta | Sim (já existia) |
| `ANTHROPIC_API_KEY` | SDK do Claude (chama o agente) | **Sim — se não existir, `/analyze` retorna 500** |
| `META_ADS_MAX_DAILY_BUDGET_CENTS` | Teto absoluto de daily budget em centavos (default 100000 = R$ 1.000/dia) | Não (default existe) |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | Postgres GCP | Sim (já existiam) |

---

## 8. Etapas de validação end-to-end

Quando retomar de outro terminal, executar nesta ordem:

### Etapa 0: Sanity do código
```bash
cd /Users/ichino/Documents/Turbo/Cortex
git status                                # confirmar branch feature/agente-gestor-meta-ads
git diff --stat origin/staging            # confirmar arquivos modificados

# Checar se growthAiTools.ts tem as adições (item 6.1)
grep -n "executeCriativosAgentTool" server/services/growthAiTools.ts
grep -n "proposePauseEntity" server/services/growthAiTools.ts

# Typecheck dos meus arquivos
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "metaActions|metaAdsWrite|criativosAgent|growthAiTools|Criativos\.tsx|meta_actions_log"
# → deve retornar VAZIO (0 erros novos)
```

### Etapa 1: Aplicar a migration no banco
```bash
# Opção A: psql direto
psql "$DATABASE_URL" -f scripts/create_meta_actions_log.sql

# Opção B: via DBeaver / IDE — executar o conteúdo de scripts/create_meta_actions_log.sql

# Verificar
psql "$DATABASE_URL" -c "\d cortex_core.meta_actions_log"
# → deve mostrar 18 colunas + 2 indexes
```

### Etapa 2: Subir o dev server
```bash
lsof -ti tcp:3000 | xargs -r kill -9     # liberar porta se necessário
rm -rf node_modules/.vite                # limpar cache Vite
npm run dev
```

Abrir `http://localhost:3000/criativos` no browser logado como admin (Caio ou Warley).
Hard refresh (Cmd+Shift+R).

### Etapa 3: Smoke test das rotas novas (sem auth — esperar 401)
```bash
curl -s -o /dev/null -w "pending=%{http_code}\n"  http://localhost:3000/api/meta/actions/pending
curl -s -o /dev/null -w "history=%{http_code}\n"  http://localhost:3000/api/meta/actions/history
curl -s -o /dev/null -w "analyze=%{http_code}\n"  -X POST -H "content-type: application/json" \
     -d '{"period":{"startDate":"2026-03-01","endDate":"2026-03-31"}}' \
     http://localhost:3000/api/criativos/agent/analyze
curl -s -o /dev/null -w "proposals=%{http_code}\n" http://localhost:3000/api/criativos/agent/proposals

# → todos devem retornar 401 (rota existe, auth bloqueia)
```

### Etapa 4: Validar UI (admin logado)
1. Aba `/criativos` carrega normalmente (tabela + filtros)
2. Como admin: aparecem os botões roxo "Analisar com IA" + "Propostas" na barra
3. Clicar "Analisar com IA" → toast "Analisando…" → drawer abre com propostas
4. Verificar dark mode e light mode (`useTheme` toggle)
5. Verificar que a tabela antiga funciona IGUAL (zero regressão)

### Etapa 5: Guard-rails do `metaAdsWrite.ts`
Script Node ad-hoc (não commitar):
```ts
import { validateBudgetChange } from './server/services/metaAdsWrite';

console.log(validateBudgetChange(10000, 15000));  // delta 50% → { ok: false }
console.log(validateBudgetChange(10000, 12000));  // delta 20% → { ok: true }
console.log(validateBudgetChange(10000, 200000)); // acima do teto → { ok: false }
```

### Etapa 6: Smoke test real da Meta API (opcional, cuidado)
Criar um ad de teste em uma campanha de baixo volume, pegar `ad_id`, rodar:
1. Logado como admin, `POST /api/meta/actions/pause` com `{level, entityId, reason}`
2. Conferir no Meta Ads Manager que o anúncio ficou `PAUSED`
3. Conferir que `cortex_core.meta_actions_log` tem a linha com `status='success'`
4. Rodar `POST /api/meta/actions/resume` → anúncio volta a `ACTIVE`
5. **IMPORTANTE:** confirmar que a resposta de erro (forçar um ad_id inválido) **NÃO contém** a string do `access_token` — a função `sanitizeError` deve ter removido

### Etapa 7: Race condition
1. Rodar "Analisar com IA" — gerar pelo menos 1 proposta
2. Abrir duas abas do browser, ambas logadas como admin
3. Clicar "Confirmar" na mesma proposta em ambas quase simultaneamente
4. Uma aba deve receber `200 OK`, a outra `409 Conflict` com "Proposta já foi processada"

### Etapa 8: Guard-rails do agente
Rodar `/analyze` com período de 3 dias. O agente deve se **abster de propor pauses**
(regra dos 7 dias mínimos) e retornar um texto explicando a janela é curta demais.

### Etapa 9: Regressão — nada quebrou
- Aba Criativos carrega sem clicar no botão novo (tabela intacta)
- Dashboard de Growth AI continua funcionando (usa o `executeGrowthTool` original)
- Sync Meta manual continua rodando em v18
- Zero erros novos no console do browser

---

## 9. Modelos mentais úteis

### "Por que duplicar `isAdmin` em vez de importar de `routes.ts`?"
O plano da Fase 1 proíbe editar `server/routes.ts`. `isAdmin` lá dentro é uma função
interna não exportada. Duplicar 6 linhas nos 2 routers novos é mais seguro do que
abrir um PR em `routes.ts` nesta fase.

### "Por que tool propose-only em vez de executar direto?"
Separação de responsabilidades:
- **Agente (LLM)** = inteligência analítica, sem side-effects reais
- **Admin humano** = autoridade final, revisor
- **`metaAdsWrite.ts`** = único lugar que fala com Meta API

Isso garante que **cada ação real** tem um humano no loop e um registro de auditoria
com `confirmed_by_user_id`.

### "Por que Bearer header em código novo mas deixar query string no sync antigo?"
Query string em URL fica em logs de proxy/CDN/Sentry. Bearer header não. Mas trocar no
sync antigo é arriscado (pode quebrar sync silenciosamente se o header for montado errado
em algum edge case). Código novo nasce com o padrão certo; sync migra na Fase 2 com PR
dedicado e testes específicos.

### "Por que `meta_actions_log` em `cortex_core` e não `meta_ads`?"
Regra de `agents/db-specialist.md`: "Novas tabelas internas vão em `cortex_core`". O
schema `meta_ads` é reservado para dados sincronizados da Meta — essa tabela é audit
trail nosso, não vem da Meta.

---

## 10. Próximos passos depois da validação

1. **Commit granular na branch** `feature/agente-gestor-meta-ads`:
   - commit 1: `feat(meta-actions): add audit trail table in cortex_core`
   - commit 2: `feat(meta-actions): add write layer with bearer + guard-rails`
   - commit 3: `feat(meta-actions): add admin-only action routes`
   - commit 4: `feat(criativos-agent): add propose-only tools for growth AI`
   - commit 5: `feat(criativos-agent): add Anthropic-backed analyze route`
   - commit 6: `feat(criativos): add "Analisar com IA" button + proposals drawer`
   - Nunca commitar `.claude/settings.local.json`

2. **PR para staging** (não main):
   - Título: `feat: agente gestor de performance meta ads (v1 supervisionado)`
   - Descrição cita Fase 1 enxuta + link para esse `AGENTE_GESTOR_PERFORMANCE.md`
   - Checklist das etapas 0–9 marcadas

3. **Merge só depois** de:
   - Typecheck limpo
   - Smoke test em dev com admin real (Caio ou Warley)
   - Migration aplicada em staging DB
   - `ANTHROPIC_API_KEY` configurado em staging

---

## 11. Contexto da stash de recuperação (não perder)

Durante a setup dessa branch apareceu uma WIP órfã em `shared/schema.ts` (tabela
`metaInsightsByPlatformDaily`) + `server/services/metaAdsSync.ts` (parseInsightRow
helper + breakdown por publisher_platform), ~275 linhas total, que não pertence a
nenhum commit. Foi preservada em:

```
stash@{0}: RECOVERED-FROM-STAGING-FORCE-PUSH: metaAdsSync byPlatform refactor + schema
```

Investigar com Warley antes de descartar — pode ser trabalho dele pré force-push em
staging. **Não faz parte desta feature.**
