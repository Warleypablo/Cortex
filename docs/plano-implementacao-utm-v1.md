# Plano de implementação — Constituição UTM Turbo v1

> Cutover: **21/05/2026 (quinta)**.
> Fonte do padrão: `~/Downloads/utm-turbo-novo-padrão.md` (Constituição UTM Turbo v1).
> Diagnóstico do estado atual: `docs/utms-status-atual.md` e `docs/mapa-utms-bitrix.md`.

---

## TL;DR

A partir de 21/05/2026, toda URL gerada pela Turbo segue o padrão da Constituição v1 (lowercase, vocabulário fechado de `medium` e `source`, tokens dinâmicos em ads pagos, IDs estruturados em orgânico/referral).

**O que faremos no Cortex:**
1. Adicionar 6 colunas em `Bitrix.crm_deal` (`utm_medium`, `fbclid`, `gclid`, `referrer`, `user_agent`, `ip`).
2. Reescrever a tabela `utm_source_map` para refletir a constituição **+** criar a view `Bitrix.crm_deal_normalized` que aplica a normalização em runtime (assim suportamos legado e novo padrão simultaneamente, sem alterar dados originais).
3. Atualizar `TURBO_URL_TAGS` em `server/services/adsCreation/creator.ts:31` para incluir `{{placement}}` no `utm_term`.
4. Adaptar queries de `growth.ts`, `storage.ts` e tela Criativos para usar a view nova e parsear o novo formato de `utm_term`.

**O que dependemos de terceiros:**
- **Warley** (owner do sync Bitrix→Postgres): criar campos custom no Bitrix CRM e atualizar o mapping do sync.
- **Esther** (social media): reconfigurar Linktree, footer institucional e links orgânicos com o novo padrão.
- **Ichino**: atualizar Tracking template no Google Ads, atualizar URL parameters dos ads ativos no Meta Ads, atualizar política de privacidade da Turbo (LGPD pelo `ip`), escrever material de treinamento do time comercial.

**Decisão central:** **não vamos migrar os dados legados** (zero UPDATE em `crm_deal`). Toda compatibilidade entre padrão antigo e novo acontece em uma view de normalização. Histórico fica preservado, queries ficam simples, zero risco de BPM trigger no Bitrix.

**Riscos críticos a monitorar:**
- 🔴 Se o sync Bitrix→Postgres não for atualizado a tempo (Warley), as 6 colunas novas ficam vazias mesmo com o Bitrix recebendo.
- 🔴 Se a query de detecção de Linktree (`growth.ts:19-52`) não for adaptada antes do deploy, leads de Linktree somem do dashboard "Instagram" durante a transição.
- 🟡 Ads criados manualmente no Meta (fora do Cortex) continuam o ponto fraco — mitigado por treinamento, não por código.

---

## 1. Contexto

A Turbo opera hoje com 16 variantes de `utm_source` (`facebook`, `fb`, `meta`, `clients`, `footer`, `guday`, `instagram`, …), `utm_medium` descartado pelo sync, 33% dos leads sem UTM nenhuma, e 58 deals/quarter com placeholder literal `{{ad.id}}` não substituído.

A Constituição UTM Turbo v1 resolve isso impondo:
- 6 categorias fechadas de `medium` (`paid`, `organic`, `eventos`, `referral`, `crm`, `outbound`)
- Vocabulário fechado de `source` por medium
- Tokens dinâmicos em mídia paga (`{{campaign.id}}`, `{{adset.id}}-{{placement}}`, `{{ad.id}}`)
- Captura técnica complementar (`fbclid`, `gclid`, `referrer`, `user_agent`, `ip`)
- Lei zero: `source` é categoria técnica, nunca entidade. Cliente específico (Guday, Dr. Rafael) vai em `campaign`.

---

## 2. Decisões já tomadas

| # | Decisão | Implicação |
|---|---|---|
| 1 | **Não migrar dados legados** — normalizar via `utm_source_map` + view | Zero UPDATE em `crm_deal`. Dados originais preservados. Sem risco de trigger BPM no Bitrix. |
| 2 | **Cortex suporta ambos os padrões para sempre** | Toda query de classificação por canal consulta a view `crm_deal_normalized`, não a tabela bruta. |
| 3 | **Reescrever `utm_source_map`** para a constituição v1, com coluna `entity_from` que reconstrói a identidade do cliente quando é legado | Migration `2026-05-17` é substituída por nova `2026-05-20`. |
| 4 | **Esther reconfigura Linktree + footer + orgânicos** | Briefing na Etapa 7. |
| 5 | **Capturar tudo (incluindo IP) desde 21/05** | Ichino atualiza política de privacidade até 20/05. |
| 6 | **Ichino escreve material de treinamento** | Fora do escopo deste plano. |

---

## 3. Etapas técnicas (Cortex)

### Etapa 1 — Schema do Postgres (Cloud SQL + Drizzle)

**Quem:** nós.
**Pré-requisito:** acesso admin ao Cloud SQL (você ou Warley — `growth_dev` não tem ALTER).

1. Criar migration `migrations/2026-05-20-utm-v1-columns.sql`:
   ```sql
   ALTER TABLE "Bitrix".crm_deal
     ADD COLUMN IF NOT EXISTS utm_medium  varchar(64),
     ADD COLUMN IF NOT EXISTS fbclid      varchar(255),
     ADD COLUMN IF NOT EXISTS gclid       varchar(255),
     ADD COLUMN IF NOT EXISTS referrer    text,
     ADD COLUMN IF NOT EXISTS user_agent  text,
     ADD COLUMN IF NOT EXISTS ip          varchar(45);
   ```
2. Refletir no Drizzle: `shared/schema.ts:907-957` (adicionar `utmMedium`, `fbclid`, `gclid`, `referrer`, `userAgent`, `ip`).
3. Rodar a migration no Cloud SQL.

### Etapa 2 — Reescrever `utm_source_map` + criar view `crm_deal_normalized`

**Quem:** nós.
**Arquivo:** `migrations/2026-05-20-utm-source-map-v1.sql` (substitui `2026-05-17-utm-source-map.sql` que nunca chegou a ser usada no código).

#### 2a. Tabela `utm_source_map`

A coluna `entity_from` diz **de onde reconstruir a identidade do cliente/parceiro** quando é dado legado. Sem isso, a normalização perde "qual cliente específico" (ex: ao mapear `guday → cliente`, perdíamos que era a Guday).

```sql
CREATE TABLE IF NOT EXISTS public.utm_source_map (
  raw         text PRIMARY KEY,
  canonical   text NOT NULL,
  medium      text NOT NULL,
  paid        boolean NOT NULL,
  is_legacy   boolean NOT NULL DEFAULT false,
  entity_from text                              -- 'self' | 'utm_campaign' | 'utm_content' | NULL
);
```

Seeds (legado + novo padrão na mesma tabela):

| raw | canonical | medium | paid | is_legacy | entity_from |
|---|---|---|---|---|---|
| facebook | facebook | paid | true | false | NULL |
| fb | facebook | paid | true | true | NULL |
| meta | facebook | paid | true | true | NULL |
| google | google | paid | true | false | NULL |
| youtube | youtube | paid | true | false | NULL |
| linkedin | linkedin | paid | true | false | NULL |
| tiktok | tiktok | paid | true | false | NULL |
| pinterest | pinterest | paid | true | false | NULL |
| instagram | instagram | organic | false | false | NULL |
| cliente | cliente | referral | false | false | NULL |
| clients | cliente | referral | false | true | `utm_content` |
| footer | cliente | referral | false | true | `utm_campaign` |
| guday | cliente | referral | false | true | `self` |
| rede-construir | cliente | referral | false | true | `self` |
| shopify | marketplace | referral | false | true | `self` |
| funcionario | funcionario | referral | false | false | NULL |
| afiliado | afiliado | referral | false | false | NULL |
| influencer | influencer | referral | false | false | NULL |
| marketplace | marketplace | referral | false | false | NULL |
| email | email | crm | false | false | NULL |
| whatsapp | whatsapp | crm | false | false | NULL |
| sms | sms | crm | false | false | NULL |
| email-frio | email-frio | outbound | false | false | NULL |
| linkedin-outreach | linkedin-outreach | outbound | false | false | NULL |
| whatsapp-frio | whatsapp-frio | outbound | false | false | NULL |
| ligacao | ligacao | outbound | false | false | NULL |
| turbo-news | email | crm | false | true | NULL |
| teste, teste-n8n, claude-test, ssource, source | test | test | false | true | NULL |

Eventos ficam fora da tabela (vocabulário aberto — `nome-do-evento` em slug). Qualquer deal com `utm_medium='eventos'` é tratado como evento.

#### 2b. View `Bitrix.crm_deal_normalized`

Aplica a normalização em runtime. Toda query de classificação por canal consulta a view, não a tabela bruta.

```sql
CREATE OR REPLACE VIEW "Bitrix".crm_deal_normalized AS
SELECT
  d.*,
  COALESCE(m.canonical, NULLIF(LOWER(TRIM(d.utm_source)), '')) AS norm_source,
  COALESCE(NULLIF(d.utm_medium, ''), m.medium)                 AS norm_medium,
  CASE
    WHEN m.entity_from = 'self'         THEN LOWER(TRIM(d.utm_source))
    WHEN m.entity_from = 'utm_campaign' THEN d.utm_campaign
    WHEN m.entity_from = 'utm_content'  THEN d.utm_content
    ELSE d.utm_campaign                              -- novo padrão: campaign já tem a entidade
  END AS norm_campaign,
  d.utm_content AS norm_content,
  d.utm_term    AS norm_term,
  m.is_legacy   AS is_legacy_utm
FROM "Bitrix".crm_deal d
LEFT JOIN public.utm_source_map m
       ON m.raw = LOWER(TRIM(d.utm_source));
```

**Decisões refletidas na view:**

1. **Deals sem UTM ficam NULL** (não inventamos "direto"). O `NULLIF(..., '')` garante que string vazia também vira NULL. Aparece como "sem rastreio" nos dashboards — é honesto e nos força a atacar o problema (esperado cair com `referrer` capturado a partir de 21/05).
2. **`utm_medium` real ganha do map quando existir**, com fallback pro map. Necessário porque `linkedin`/`youtube`/`tiktok` podem ser tanto `paid` quanto `organic` na constituição — só o `utm_medium` da URL distingue. Enquanto o sync do Warley não mapear `UTM_MEDIUM`, o COALESCE cai pro `medium` da map.
3. **`turbo-news` colapsa em `email` genérico** (sem preservar a identidade da newsletter). É 1 deal histórico, perda desprezível.

**Resultado prático — "quantos leads o cliente Guday trouxe?":**
```sql
SELECT COUNT(*) FROM "Bitrix".crm_deal_normalized
WHERE norm_source = 'cliente' AND norm_campaign = 'guday';
```
Pega tanto deals legados (`utm_source=guday`) quanto deals novos (`utm_source=cliente, utm_campaign=guday`).

#### 2c. Escopo da normalização — onde funciona, onde não funciona

A view é um objeto Postgres dentro do Cloud SQL. Quem consome:

| Sistema | Enxerga a view? |
|---|---|
| Cortex (server queries via Drizzle) | ✅ Sim — basta o código apontar pra `crm_deal_normalized` em vez de `crm_deal` |
| Bitrix CRM (UI nativa, relatórios internos) | ❌ Não — Bitrix é a fonte, não consome do Cloud SQL |
| Dashboards externos (Looker/Metabase/Power BI) | ✅ Apenas se conectarem no Cloud SQL **e** apontarem pra view |
| Planilhas manuais com export do Bitrix | ❌ Não |
| Scripts ad hoc do repo (`scripts/*.ts`) | ✅ Quando forem atualizados pra usar a view |

**Implicação:** se a Esther configurar a Linktree com `utm_source=instagram` e alguém abrir o relatório nativo do Bitrix, vai ver `instagram` cru. Toda a inteligência de classificação acontece no Cortex (e em qualquer BI que decidir consultar via Cloud SQL). Hoje só o Cortex consome — então é onde a normalização precisa funcionar.

### Etapa 3 — Atualizar `TURBO_URL_TAGS` (DEFERIDA)

**Status:** ⏸️ **Não aplicável no cutover de 21/05.**

A constante `TURBO_URL_TAGS` vive em `server/services/adsCreation/creator.ts:31`, **mas esse arquivo está em `stash@{0}` da branch `feature/criar-campanhas-meta-ads`** (pausada). Não existe nem no working tree nem na main. Logo, nenhuma campanha está sendo criada via Cortex em produção hoje — todos os ads ativos foram criados manualmente no Meta Ads Manager.

**Consequência:** a garantia do padrão v1 em ads pagos vem 100% da Etapa 8 (atualização manual dos URL parameters no Meta Ads Manager).

**Quando esta etapa volta a ser relevante:** no dia em que a feature `criar-campanhas-meta-ads` for retomada e o stash for aplicado. Nesse momento, o `TURBO_URL_TAGS` deve já nascer no formato v1:

```
utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.id}}&utm_term={{adset.id}}-{{placement}}&utm_content={{ad.id}}
```

**Para a referência futura, o arquivo:** `server/services/adsCreation/creator.ts:31` (aplicada em `url_tags` nas linhas 496, 533, 684).

De:
```
utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&utm_term={{adset.id}}
```

Para:
```
utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.id}}&utm_term={{adset.id}}-{{placement}}&utm_content={{ad.id}}
```

Diferença: `utm_term` agora carrega `{{adset.id}}-{{placement}}` (não só `{{adset.id}}`). Permite saber se o clique veio de `instagram_stories`, `facebook_feed`, etc., sem cruzar com Marketing API.

### Etapa 4 — Adaptar queries do Cortex

**Quem:** nós.

| Arquivo:linha | Mudança |
|---|---|
| `server/storage.ts:6291` | `utm_term = a.adset_id` → `SPLIT_PART(utm_term, '-', 1) = a.adset_id` (parser pro novo formato com `-{placement}`) |
| `server/routes/growth.ts:520, 603, 792-800, 1327, 2070-2075, 2272-2277, 3221` | Filtros literais `LIKE '%facebook%' OR '%fb%' OR = 'meta'` → trocar `FROM "Bitrix".crm_deal` por `FROM "Bitrix".crm_deal_normalized` e filtrar `norm_source = 'facebook'` |
| `server/routes/growth.ts:19-52` (linhas 25, 47) | Detecção Linktree antiga (`utm_campaign='linktree' AND utm_content='linktree'`) → **manter** essa branch (legado) **E adicionar** branch nova (`utm_term='linktree'`). OR entre as duas. |
| Qualquer query que classifique por "qual cliente trouxe o lead" | Usar `norm_source`/`norm_campaign` da view — uma única SELECT cobre legado + novo padrão |

Padrão de uso da view:
```sql
SELECT norm_source, norm_medium, norm_campaign, COUNT(*) AS deals
FROM "Bitrix".crm_deal_normalized
WHERE date_created >= NOW() - INTERVAL '90 days'
GROUP BY 1, 2, 3
ORDER BY 4 DESC;
```

### Etapa 5 — Captura técnica complementar (LPs)

**Quem:** nós + quem mantém as LPs.

**Client-side (JS na LP):**
- Capturar `document.referrer` no carregamento.
- Capturar `fbclid` e `gclid` da query string.
- Adicionar todos no payload de criação do deal no Bitrix.

**Server-side (endpoint que serve a LP):**
- Capturar `req.headers['user-agent']` → coluna `user_agent`.
- Capturar IP via `req.headers['x-forwarded-for']` (primeiro IP) ou `req.ip` → coluna `ip`.

**Arquitetura:** o Cortex não recebe form de LP direto — tudo passa pelo Bitrix. Logo, o JS da LP grava esses campos diretamente em campos custom do Bitrix CRM (via form/webhook). Server-side fica a cargo do código que serve a LP.

→ Depende de coordenação com Warley (campos no Bitrix) + quem mantém o código das LPs.

---

## 4. Etapas com terceiros

### Etapa 6 — Briefing para Warley (sync Bitrix→Postgres)

1. Criar campos custom no Bitrix CRM (em `crm_deal`):
   - `UTM_MEDIUM` — já existe nativo, **não precisa criar**, só mapear no sync.
   - `FBCLID`, `GCLID`, `REFERRER`, `USER_AGENT`, `IP_ADDRESS` — criar como campos custom string.
2. Atualizar o sync Bitrix→Postgres para mapear esses 6 campos nas colunas correspondentes do Cloud SQL (criadas na Etapa 1).
3. Garantir que o sync continue UPSERT incremental — sem rebuild.
4. Confirmar se rodar `ALTER TABLE` no Cloud SQL na Etapa 1 quebra alguma coisa do sync (não deveria, mas pergunta).
5. **Deadline: 20/05/2026.**

### Etapa 7 — Briefing para Esther (social media / links orgânicos)

1. Reconfigurar todos os links da Linktree do @turbopartners:
   ```
   ?utm_source=instagram&utm_medium=organic&utm_campaign=bio&utm_term=linktree&utm_content=<nome-do-link>
   ```
2. Reconfigurar links do footer do site institucional (clientes que indicam):
   ```
   ?utm_source=cliente&utm_medium=referral&utm_campaign=<slug-do-cliente>&utm_term=footer&utm_content=rodape-home
   ```
3. Reconfigurar links em e-mail templates / WhatsApp broadcast com padrão `crm` (seção 5.3 da constituição).
4. **Deadline: 20/05/2026.**

### Etapa 8 — Google Ads + Meta Ads (Ichino)

**Google Ads:**
- Substituir Tracking template a nível de conta (Configurações da conta → Tracking template):
  ```
  {lpurl}?utm_source=google&utm_medium=paid&utm_campaign={campaignid}&utm_term={adgroupid}-{network}-{device}-{matchtype}-{keyword}&utm_content={creative}
  ```
- Confirmar Auto-tagging ativo.
- Remover `hsa_*` e `utm_ad` se aparecerem em URLs ativas.
- Testar com botão "Test" antes de salvar.

**Meta Ads:**
- Atualizar URL parameters dos ads ativos relevantes (só os que estão rodando):
  ```
  utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.id}}&utm_term={{adset.id}}-{{placement}}&utm_content={{ad.id}}
  ```
- Remover `hsa_*` se aparecerem.

---

## 5. Verificação pós-cutover

**Frequência:** semanal nas primeiras 4 semanas, depois mensal.

1. Rodar `npx tsx scripts/audit-utms-bitrix.ts`.
2. Validar:
   - Cobertura geral > 85%
   - 0 placeholders literais `{{...}}`
   - `utm_medium` preenchido em > 80% dos deals pagos
   - `fbclid` em > 70% dos deals com `utm_source=facebook` (Meta nem sempre injeta)
   - `gclid` em > 90% dos deals com `utm_source=google` (Auto-tagging garante)
   - `referrer` em > 50% dos deals "sem UTM" (faixa de 33% deve cair)
3. Smoke test:
   - Tela Criativos do Cortex carrega sem erro.
   - Orçado x Realizado mostra atribuição Instagram correta (Linktree pegos pelo `utm_term=linktree` ou pelo fallback legado).
   - FCA sem regressão.

---

## 6. Riscos

Em ordem de gravidade:

| # | Risco | Mitigação |
|---|---|---|
| 🔴 R1 | Sync Bitrix→Postgres não atualizado a tempo — colunas novas ficam vazias mesmo com Bitrix recebendo | Briefing pro Warley com deadline firme em 20/05. Validar com ele 19/05. |
| 🔴 R2 | Query de detecção Linktree em `growth.ts:19-52` não adaptada antes do deploy — leads de Linktree somem do dashboard "Instagram" na transição | Etapa 4 do plano cobre. Manter branch legada **E** adicionar branch nova. |
| 🟡 R3 | Ads manuais no Meta (fora do Cortex) continuam quebrando o padrão (58 deals/quarter com placeholder literal) | Treinamento do time. Sem fix de código resolve. |
| 🟡 R4 | Queries que assumem `utm_term` numérico quebram com o novo `{{adset.id}}-{{placement}}` | Etapa 4: parser `SPLIT_PART` em `storage.ts:6291`. Auditar grep `utm_term =` no codebase antes do deploy. |
| 🟡 R5 | Dashboards externos (Looker, Metabase, planilhas) que filtram por valores literais `fb`, `clients`, `footer` ficam zerados | Já estão errados hoje. Mapear depois do cutover e migrar pra view. |
| 🟢 R6 | Captura de IP sem política de privacidade atualizada (LGPD) | Ichino atualiza até 20/05. |
| 🟢 R7 | Time comercial cria sources não-canônicos | Treinamento + auditoria semanal. |

---

## 7. Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `migrations/2026-05-17-utm-source-map.sql` | Descontinuar (não foi usada no código). |
| `migrations/2026-05-20-utm-v1-columns.sql` | Criar — 6 colunas novas em `crm_deal`. |
| `migrations/2026-05-20-utm-source-map-v1.sql` | Criar — tabela `utm_source_map` (com `is_legacy` + `entity_from`) + view `crm_deal_normalized`. |
| `shared/schema.ts:907-957` | Adicionar 6 campos no Drizzle. |
| `server/services/adsCreation/creator.ts:31` | Atualizar `TURBO_URL_TAGS`. |
| `server/storage.ts:6291` | Parser `SPLIT_PART(utm_term, '-', 1)`. |
| `server/routes/growth.ts:19-52` | Linktree: branch antiga + nova (OR). |
| `server/routes/growth.ts` (linhas 520, 603, 792-800, 1327, 2070-2075, 2272-2277, 3221) | Filtros via `crm_deal_normalized`. |

---

## 8. Ordem de execução proposta

1. **Hoje–19/05**: nós fazemos Etapas 1, 2, 3, 4 (código + migrations, sem rodar ainda).
2. **19/05**: Ichino briefa Warley + Esther.
3. **20/05**: rodar migrations no Cloud SQL (Etapa 1 + 2). Confirmar com Warley que sync continua funcionando. Política de privacidade publicada.
4. **21/05**: Etapa 8 (Google Ads + Meta Ads). Deploy do Cortex com Etapas 3 e 4.
5. **22/05 em diante**: Etapa 9 (auditoria semanal).

---

## 9. Checklist

### Pré-cutover (até 20/05/2026)

**Cortex (nós):**
- [x] Etapa 1 — migration `2026-05-20-utm-v1-columns.sql` escrita ✅
- [x] Etapa 1 — `shared/schema.ts:952-961` atualizado com 6 campos novos ✅
- [x] Etapa 2 — migration `2026-05-20-utm-source-map-v1.sql` escrita (tabela + seeds + view) ✅
- [ ] Etapa 3 — `TURBO_URL_TAGS` ⏸️ deferida (arquivo em stash da branch `feature/criar-campanhas-meta-ads`, pausada)
- [x] Etapa 4 — `server/storage.ts:6291` e `:6510` adaptados com `SPLIT_PART` ✅
- [x] Etapa 4 — detecção Linktree em `growth.ts` aceita legado + novo (`utm_term='linktree'`) ✅
- [ ] Etapa 4 — migração das ~30 queries de `crm_deal` pra view `crm_deal_normalized` (pós-cutover, backlog)
- [ ] Migrations rodadas no Cloud SQL (Warley executa em 19-20/05)
- [ ] Smoke test local: tela Criativos, Orçado x Realizado, FCA

**Warley (sync + Bitrix CRM):**
- [x] Briefing escrito em `docs/briefing-warley-utm-v1.md` ✅
- [ ] Briefing enviado pro Warley (Ichino)
- [ ] Campos custom criados no Bitrix CRM (`FBCLID`, `GCLID`, `REFERRER`, `USER_AGENT`, `IP_ADDRESS`)
- [ ] `UTM_MEDIUM` mapeado no sync (já existe nativo)
- [ ] Migration `2026-05-20-utm-v1-columns.sql` rodada no Cloud SQL
- [ ] 6 colunas novas mapeadas no sync
- [ ] Migration `2026-05-20-utm-source-map-v1.sql` rodada no Cloud SQL
- [ ] Sync confirmado funcionando após `ALTER TABLE` (20/05)

**Esther (links orgânicos):**
- [x] Briefing escrito em `docs/briefing-esther-utm-v1.md` ✅
- [ ] Briefing enviado pra Esther (Ichino)
- [ ] Linktree reconfigurada com novo padrão
- [ ] Footer institucional reconfigurado
- [ ] E-mail templates / WhatsApp broadcast reconfigurados

**Ichino (você):**
- [ ] Política de privacidade da Turbo atualizada (LGPD — IP)
- [ ] Material de treinamento escrito
- [ ] Treinamento agendado/realizado com Lucas, Amanda, Aline, Caio Malini
- [ ] Captura `referrer`/`fbclid`/`gclid` adicionada nas LPs + envio dos novos campos pro Bitrix (Etapa 5 — pendente investigação do repo das LPs)
- [x] Bug P2 das LPs `pages.turbopartners` confirmado corrigido ✅

### Cutover (21/05/2026)

- [ ] Deploy do Cortex com Etapas 3 e 4 mergeadas
- [ ] Google Ads — Tracking template substituído + Auto-tagging confirmado + `hsa_*`/`utm_ad` removidos
- [ ] Meta Ads — URL parameters dos ads ativos atualizados + `hsa_*` removidos
- [ ] Validação: criar 1 ad teste no Cortex e confirmar que o link gerado segue o novo padrão

### Pós-cutover (a partir de 22/05/2026)

- [ ] Semana 1 — auditoria com `scripts/audit-utms-bitrix.ts`
- [ ] Semana 2 — auditoria
- [ ] Semana 3 — auditoria
- [ ] Semana 4 — auditoria
- [ ] Smoke test mensal: Criativos, Orçado x Realizado, FCA
- [ ] Mapear dashboards externos (Looker, Metabase, planilhas) que ainda usam valores literais e migrar pra view

---

*Documento vivo. Atualizar ao longo da execução para registrar decisões e desvios.*
