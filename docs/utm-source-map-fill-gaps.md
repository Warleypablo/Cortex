# UTM Source Map — Preenchimento de gaps e adoção em queries

> **Data:** 20/05/2026
> **Branch:** `feature/utm-source-map-fill-gaps`
> **Cutover relacionado:** Constituição UTM Turbo v1.1 (21/05/2026)

---

## Contexto

Até 19/05/2026, a tabela `public.utm_source_map` (criada pelo PR #192 — UTM Builder) tinha 32 entradas mas **nenhum código do Cortex a consultava**. As queries de classificação por canal usavam constantes hardcoded em `server/routes/growth.ts` (`PLATFORM_CASE_SQL` e `PLATFORM_CASE_SQL_BASIC`) com `LIKE '%facebook%' OR '%fb%' OR '%meta%'`.

Além disso, **176 deals históricos** chegavam com `utm_source` não coberto por nenhuma branch do CASE WHEN (`clients`, `footer`, `guday`, `rede-construir`, `shopify`) e ficavam classificados como `'outros'`.

A Constituição UTM Turbo v1.1 (cutover 21/05) introduz 6 sources novos (`cliente`, `colaborador`, `afiliado`, `influencer`, `marketplace`, `pinterest`) que também ficariam como `'outros'` se não fossem mapeados.

## Decisões

| # | Decisão | Implicação |
|---|---|---|
| 1 | **Adotar a Abordagem 1 (JOIN/subquery em runtime)**, não materialização via trigger | Mais simples, sem dependência do Warley pra trigger, sem reprocessamento ao mudar o map |
| 2 | **Não refatorar as ~30 queries individualmente** — usar subquery escalar nas 2 constantes centrais | Mudança propaga automaticamente pra todos os usos |
| 3 | **Manter as branches hardcoded existentes** (facebook/google/youtube/etc.) — usar o map APENAS como fallback do `ELSE` | Zero impacto nos valores que o frontend já espera (`meta_ads`, `google_ads`, etc.) |
| 4 | **Mapear `clients`/`footer`/`guday`/`rede-construir` todos como `cliente`** | Unifica histórico de "indicação via cliente" num único bucket |
| 5 | **Mudar `instagram`/`ig` de `meta` → `instagram`** | Separa orgânico do paid Meta |
| 6 | **Alinhar variantes de Meta (`fb`/`meta`/`meta_ads`/`meta-ads`) a `facebook`** | Coerente com a Constituição v1.1 (proíbe `meta` como source canônico) |
| 7 | **Defensivo: `COALESCE(map.normalized, 'outros')`** | Se a migration `2026-05-20-utm-source-map-fill-gaps.sql` não tiver rodado ainda quando o deploy do código sair, sources não mapeados caem em `'outros'` (comportamento atual) em vez de `NULL` |

## Mudanças aplicadas

### Migration `migrations/2026-05-20-utm-source-map-fill-gaps.sql`

**16 INSERTs (ON CONFLICT DO UPDATE):**

Legado pré-cutover (176 deals históricos):
- `clients`, `footer`, `guday`, `rede-construir` → `cliente`
- `shopify` → `marketplace`
- `funcionario` → `colaborador`

Constituição v1.1 (vão chegar a partir de 21/05):
- `cliente`, `colaborador`, `afiliado`, `influencer`, `marketplace`, `pinterest` → mesmo valor (canônicos)

Testes (isolar do volume real):
- `claude-test`, `teste-n8n`, `smoke`, `ssource` → `test`

**5 UPDATEs:**

- `instagram` → `meta` virou `instagram → instagram`
- `ig` → `meta` virou `ig → instagram`
- `facebook` → `meta` virou `facebook → facebook`
- `fb` → `meta` virou `fb → facebook`
- `meta`, `meta_ads`, `meta-ads` → `meta` viraram `*  → facebook`

### Refactor `server/routes/growth.ts`

Mudança cirúrgica nas constantes `PLATFORM_CASE_SQL` e `PLATFORM_CASE_SQL_BASIC`:

```sql
-- Antes:
ELSE 'outros'

-- Depois:
ELSE COALESCE(
  (SELECT normalized FROM public.utm_source_map
   WHERE raw_source = LOWER(TRIM(COALESCE(utm_source, '')))),
  'outros'
)
```

Resto do CASE WHEN permanece igual. Branches especiais (`source='WEB'`, `source='UC_4VCKGM'`, detecção Linktree, LIKE '%facebook%' etc.) continuam tendo prioridade.

## Sources históricos esperados pós-mudança

| Source legado | Volume (90d) | Antes | Depois |
|---|---|---|---|
| `clients` | 146 | `outros` | `cliente` |
| `instagram` (Linktree) | 172 | `meta_ads` (via LIKE) | `instagram` (via LIKE) — sem mudança real, mas alinhado |
| `footer` | 16 | `outros` | `cliente` |
| `guday` | 11 | `outros` | `cliente` |
| `fb` | 7 | `meta_ads` (via LIKE) | `meta_ads` (via LIKE) — sem mudança no code |
| `rede-construir` | 2 | `outros` | `cliente` |
| `claude-test`, `smoke`, `ssource`, `teste-n8n` | 4 | `outros` | `test` |
| `shopify` | 1 | `outros` | `marketplace` |

**Total realocado de `outros` pra categorias canônicas: ~180 deals.**

## Impacto em dashboards

- **"Funil Geral" / por canal**: bucket `outros` diminui ~180 deals, buckets `cliente` / `marketplace` / `test` aparecem
- **Orçado x Realizado**: mesmo comportamento de antes pra Meta/Google/Instagram (branches LIKE continuam ativas)
- **Tela Criativos**: não afetada (usa `utm_content`, não classificação)
- **Front-end**: não precisa de mudança — valores retornados (`meta_ads`, `google_ads`, `instagram`, etc.) continuam idênticos

## Como reverter

### Reverter o code (`growth.ts`)
```bash
git revert <hash-do-commit-do-refactor>
```
Volta às constantes hardcoded sem subquery.

### Reverter os dados no banco (utm_source_map)
```sql
-- Reverter UPDATEs (volta ao bucket "meta" antigo)
UPDATE public.utm_source_map SET normalized = 'meta'  WHERE raw_source IN ('facebook', 'fb', 'instagram', 'ig');
UPDATE public.utm_source_map SET normalized = 'meta'  WHERE raw_source IN ('meta', 'meta_ads', 'meta-ads'); -- já era 'meta', noop

-- Remover INSERTs novos
DELETE FROM public.utm_source_map WHERE raw_source IN (
  'clients', 'footer', 'guday', 'rede-construir', 'shopify',
  'cliente', 'colaborador', 'afiliado', 'influencer', 'marketplace', 'pinterest',
  'funcionario', 'claude-test', 'teste-n8n', 'smoke', 'ssource'
);
```

## Pequena divergência semântica em `growth.ts:794-813`

O endpoint que filtra por canal (`canal=outros` etc.) usa uma lista hardcoded de exclusões (`NOT LIKE '%facebook%' AND NOT LIKE '%fb%' AND ...`). Esse filtro **não foi tocado** nesta refatoração porque não usa `PLATFORM_CASE_SQL`.

Depois do refactor, leads com `utm_source` em (`clients`, `footer`, `guday`, etc.) caem em `cliente` no `PLATFORM_CASE_SQL`, mas ainda aparecem no resultado de `canal=outros` (porque essa lista de exclusão não os exclui).

**Impacto baixíssimo:** o endpoint do filtro por canal é raramente usado pelos dashboards principais. Se aparecer regressão, é uma adição simples na lista de NOT LIKE.

## O que NÃO foi feito (intencionalmente)

- **Materialização via trigger / view dedicada** — descartado por simplicidade
- **Refactor das ~30 queries individuais pra usarem JOIN explícito** — desnecessário com a subquery centralizada nas 2 constantes
- **Renomear valores de saída** (ex: trocar `meta_ads` por `facebook` no que o frontend recebe) — quebraria contrato com front. Pode ser feito num PR separado se algum dia for desejado
- **Backfill dos 5 campos custom** (`fbclid`, `gclid`, `referrer`, `user_agent`, `ip`) pra deals antigos — **impossível** (dados só existem no momento do clique e não foram capturados)
- **Resolver os 33% de leads sem UTM nenhuma** — exige instrumentar LPs (escopo separado)
- **Resolver 58 deals com placeholders literais `{{...}}`** — dado original já bugado, sem recuperação

## Sequência de execução

1. ✅ Branch criada: `feature/utm-source-map-fill-gaps`
2. ✅ Migration `.sql` escrita (este PR)
3. ✅ Refactor de `growth.ts` (este PR)
4. ⏳ PR aberto contra `main`
5. ⏳ Você mergea o PR
6. ⏳ Deploy do Cortex
7. ⏳ Warley executa a migration `2026-05-20-utm-source-map-fill-gaps.sql` no Cloud SQL
8. ⏳ Smoke test: rodar query e verificar que `clients`/`footer`/`guday` agora aparecem como `cliente` em dashboards

A ordem dos passos 6 e 7 pode ser invertida sem quebrar nada (o COALESCE garante fallback).

## Notas pra futuro

- Quando aparecer source novo no banco que não está no map, fica como `'outros'`. Pra mapear, basta `INSERT` na tabela — afeta todas as queries imediatamente (sem deploy de código).
- A inconsistência entre nomes de saída (`meta_ads`, `google_ads`) e nomes canônicos da Constituição v1.1 (`facebook`, `google`) permanece. Vale revisar em alguma futura iteração se valer a pena alinhar 100%.
- O hardcoded em `growth.ts` continua sendo a fonte primária de classificação (LIKE patterns); o map só pega o que cai no `ELSE`. Se algum dia quiser migrar pra map 100%, precisa garantir que valores de saída batem com o que o front espera.
