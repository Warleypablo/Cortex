# Projeto UTM v1 — Histórico de implementação

> **Status:** Concluído nas partes principais (20/05/2026).
> **Cutover oficial:** 21/05/2026 (Constituição v1.1).
> **Pendências menores:** ver seção "O que ainda falta".

Esta é a página-mãe do projeto. Se você está voltando aqui depois de meses pra entender o que aconteceu, comece por aqui. Para cada subtema tem um doc dedicado linkado abaixo.

---

## TL;DR

A Turbo padronizou o tracking de UTMs em todos os canais (Meta Ads, Google Ads, LPs, Linktree, footer institucional, e-mails, WhatsApp). O projeto cobriu **5 frentes**:

1. **Schema** — 6 colunas novas em `Bitrix.crm_deal` (`utm_medium`, `fbclid`, `gclid`, `referrer`, `user_agent`, `ip`)
2. **Normalização** — `public.utm_source_map` cobrindo legado + Constituição v1.1
3. **UTM Builder** — tela `/utm-builder` no Cortex pra geração padronizada de links
4. **Tracking templates** — Meta Ads e Google Ads atualizados pro padrão v1.1
5. **Sync Bitrix→Postgres** — atualizado pra copiar os campos novos

A "constituição" oficial do padrão está em [`docs/utm-constituicao.md`](./utm-constituicao.md) (versão v1.1).

---

## Linha do tempo (PRs mergeados)

| PR | Data | O que entrou |
|---|---|---|
| **#188** | 17/05 | Linktree branch nova em `growth.ts`, `SPLIT_PART` em `storage.ts`, migrations iniciais (2 das 3 ficaram deferidas) |
| **#192** | 18/05 | UTM Builder em `/utm-builder`, tabelas `cortex_core.utm_vocabulary` + `generated_utm_links`, `public.utm_source_map` simplificada (2 colunas), Constituição **v1.1** em `docs/utm-constituicao.md` |
| **#198** | 20/05 | Migration `2026-05-20-utm-source-map-fill-gaps.sql` (16 INSERTs + 5 UPDATEs), refactor cirúrgico do `PLATFORM_CASE_SQL` para usar o map, doc [`utm-source-map-fill-gaps.md`](./utm-source-map-fill-gaps.md), liberação da tela "Configurar valores" pro time de Growth |
| **#199** | 20/05 | Cleanup: remoção das 2 migrations zumbis do PR #188 que ficaram obsoletas após o PR #192 tomar outra direção arquitetural |

---

## Estado final dos componentes

### Banco de dados (Cloud SQL)

**`Bitrix.crm_deal`** ganhou 6 colunas:
- `utm_medium`, `fbclid`, `gclid`, `referrer`, `user_agent`, `ip`

**`public.utm_source_map`** — dicionário de normalização (~48 entries):
- Schema: `(raw_source, normalized)`
- Cobre: legado (`clients`, `footer`, `guday`, `rede-construir`, `shopify`), canônicos v1.1 (`cliente`, `colaborador`, `afiliado`, `influencer`, `marketplace`, `pinterest`), variantes de plataformas (`fb`/`meta`/`meta_ads` → `facebook`, `instagram`/`ig` → `instagram`), testes (`smoke`, `ssource`, etc. → `test`)

**`cortex_core.utm_vocabulary`** + **`cortex_core.generated_utm_links`** — usadas pelo UTM Builder pra dropdowns + auditoria de links gerados.

### Código do Cortex

**`server/routes/growth.ts`** — constantes `PLATFORM_CASE_SQL` e `PLATFORM_CASE_SQL_BASIC`:
- Branches hardcoded mantidas (saídas iguais ao que o front já espera: `meta_ads`, `google_ads`, `instagram`, etc.)
- `ELSE` final substituído por `COALESCE((SELECT normalized FROM public.utm_source_map ...), 'outros')`
- Detecção Linktree v1.1: nova branch `WHEN utm_term='linktree'`

**`server/storage.ts`** — `SPLIT_PART(utm_term, '-', 1)` em 2 lugares (query `utmTerms` e CTE `adset_crm`) pra suportar o formato novo `{{adset.id}}-{{placement}}`.

**`shared/schema.ts`** — Drizzle reflete as 6 colunas novas em `crmDeal`.

### Tracking nas plataformas

**Meta Ads** — todos anúncios ativos com URL parameters padronizados:
```
utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.id}}&utm_term={{adset.id}}-{{placement}}&utm_content={{ad.id}}
```

**Google Ads** — Tracking template a nível de conta:
```
{lpurl}?utm_source=google&utm_medium=paid&utm_campaign={campaignid}&utm_term={adgroupid}-{network}-{device}-{matchtype}-{keyword}&utm_content={creative}
```
Auto-tagging ativado.

### Outros canais (responsabilidade Esther/comms)

Linktree, footer institucional, templates de e-mail, broadcast WhatsApp — todos no padrão v1.1 (`utm_source=instagram&utm_medium=organic&utm_campaign=bio&utm_term=linktree&utm_content=...` etc.).

---

## Como cada peça se conecta

```
                       ┌─────────────────────┐
                       │  UTM Builder        │
                       │  (/utm-builder)     │  ←  Time de marketing
                       │  Gera links no      │     gera links padronizados
                       │  padrão v1.1        │
                       └──────────┬──────────┘
                                  │
                                  ▼
                       Links com UTMs no padrão certo
                                  │
                                  ▼
                       Visitante clica e cai numa LP
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │  JS da LP captura:  │
                       │  - utm_*            │
                       │  - fbclid/gclid     │
                       │  - referrer         │
                       └──────────┬──────────┘
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │  Form da LP envia   │
                       │  pro Bitrix CRM     │
                       └──────────┬──────────┘
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │  Sync (Warley)      │
                       │  Copia Bitrix CRM   │
                       │  → Cloud SQL        │
                       └──────────┬──────────┘
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │  Cortex consulta    │
                       │  com JOIN no        │
                       │  utm_source_map     │  →  Dashboards, FCA, etc.
                       │  (PLATFORM_CASE_SQL)│
                       └─────────────────────┘
```

---

## O que ainda falta

### 🔴 Crítico

**5 campos custom no Bitrix CRM ainda não chegam no Postgres**

`utm_medium` está sincronizando (✅ 70% dos deals), mas `fbclid`, `gclid`, `referrer`, `user_agent`, `ip` estão **zerados em 100% dos deals** desde sempre. Cada hora que passa nessa situação é informação perdida pra sempre (só existe no momento do clique).

**Quem resolve:** Warley.
**O que precisa:**
1. Confirmar/criar os 5 campos custom no Bitrix CRM (`FBCLID`, `GCLID`, `REFERRER`, `USER_AGENT`, `IP_ADDRESS`)
2. Adicionar mapping desses 5 campos no script de sync Bitrix→Postgres

### 🟡 Menor

**`utm_term` ainda sem hífen na maioria dos deals**

Tracking template do Meta foi atualizado, mas leads de hoje ainda chegam com `utm_term=120247987601400450` (sem `-{placement}`). Pode ser delay do Meta aplicando o template novo ou clicks ainda do tracking antigo.

**Como validar:** rodar `scripts/check-sync-status.ts` daqui alguns dias e ver se a coluna "com_hifen" começa a aumentar.

### 🟢 Cosmético

**`PLATFORM_CASE_SQL` ainda tem nomes de saída não alinhados à Constituição**

Hoje retorna `meta_ads` (legado interno) em vez de `facebook` (canônico v1.1). Mudar quebraria o front-end. Pode revisar num futuro PR específico de alinhamento.

---

## Documentos relacionados

| Doc | Quando ler |
|---|---|
| [`docs/utm-constituicao.md`](./utm-constituicao.md) | Padrão oficial v1.1 — fonte de verdade do vocabulário (mediums, sources, campaigns canônicas) |
| [`docs/utm-source-map-fill-gaps.md`](./utm-source-map-fill-gaps.md) | Detalhe do PR #198 — decisões, riscos, como reverter |
| [`docs/plano-implementacao-utm-v1.md`](./plano-implementacao-utm-v1.md) | Plano original do projeto (PR #188 e contexto inicial) |

---

## Pontos de cuidado pra quem mexer nisso no futuro

1. **A `public.utm_source_map` é consultada no `PLATFORM_CASE_SQL` via subquery escalar** (fallback do `ELSE`). Se você adicionar entry nova nessa tabela, ela passa a valer **imediatamente** em todas as queries do Cortex que usam essa constante — sem deploy necessário.

2. **Não use `DROP TABLE public.utm_source_map`.** A tabela é usada pelo UTM Builder. Foi por isso que removemos a migration `2026-05-20-utm-source-map-v1.sql` no PR #199.

3. **Os 5 campos custom (`fbclid`, etc.) só existem no momento do clique.** Não dá pra backfillar deals antigos — se você descobrir um dia que esses campos estavam zerados por um período, esse período é perda permanente.

4. **Eventos** (RD Summit, B2B Stack, etc.) **não entram na `utm_source_map`** — vocabulário aberto. Use `utm_medium='eventos'` direto na query pra filtrar.

5. **Tela Criativos depende de `utm_content` = `ad_id` numérico.** Se algum dia mudar o padrão pra colocar slug textual no `utm_content` em paid, essa tela quebra.

---

## Como reverter o projeto inteiro (caso emergência)

Não recomendado, mas pra registro:

1. Reverter PR #198 (`git revert`) → tira o COALESCE do `PLATFORM_CASE_SQL`, volta hardcoded
2. Reverter PR #199 → restaura as 2 migrations zumbis (mas elas não fazem nada útil)
3. Não dá pra "reverter" as 6 colunas em `crm_deal` sem perder dados — pode fazer `DROP COLUMN` se realmente quiser, mas perde tudo que já foi capturado
4. UTM Builder (PR #192) é independente — pode coexistir desligado

Pra reverter o map sem mexer no código:
```sql
-- Voltar utm_source_map ao estado pré-PR#198
DELETE FROM public.utm_source_map WHERE raw_source IN (
  'clients','footer','guday','rede-construir','shopify','funcionario',
  'cliente','colaborador','afiliado','influencer','marketplace','pinterest',
  'claude-test','teste-n8n','smoke','ssource'
);
UPDATE public.utm_source_map SET normalized='meta' WHERE raw_source IN ('facebook','fb','instagram','ig');
```

---

*Documento vivo. Atualizar quando houver mudança relevante no projeto UTM.*
