# Design — Tier (cluster) dos clientes

**Data:** 2026-06-02
**Status:** Aprovado (brainstorming)
**Autor:** Warleypablo + Claude

---

## 1. Objetivo

Dar um **ambiente para incluir/editar o "tier" de cada cliente** na tela LTV por Cliente, reaproveitando o conceito de **cluster** que já existe no Cortex mas nunca foi preenchido. O tier permite segmentar a carteira por importância e, futuramente, filtrar análises por tier.

Decisões do brainstorming:
- **Reusar o cluster existente** (não criar conceito novo).
- **Sugestão automática por MRR** + **override manual** por cliente.
- **Ambiente = coluna editável** na tabela de Clientes (tela LTV por Cliente).

## 2. Estado atual (investigação, produção 2026-06-02)

- **Catálogo de clusters** em `shared/constants.ts` (`CLUSTER_OPTIONS`): `"1"` NFNC (cinza), `"2"` Regulares (azul), `"3"` Chaves (verde), `"4"` Imperdíveis (índigo). Há também `cortex_core.catalog_clusters` (slug-based) — o frontend usa o `CLUSTER_OPTIONS` numérico.
- **Onde o cluster vive/é escrito:** `"Clickup".cup_clientes.cluster` (texto). O endpoint de edição existente (`PATCH /api/cliente/:id`) escreve aqui via `UPDATE ... WHERE cnpj`. **Está 100% vazio** (1.389 clientes sem cluster). `cortex_core.clientes.cluster` também existe e está vazio — fora do escopo (provável cópia).
- **Join com a tela LTV:** `vw_lt_contratos.id_task = cup_clientes.task_id` é **1:1** (1.389 task_ids, todos distintos). A tela agrupa por `id_task`, então essa é a unidade de atribuição.
- **MRR ativo por cliente** (recorrente em `ativo/onboarding/triagem`): só **213 clientes** têm MRR > 0 (resto cancelado). Percentis: p50 R$ 3.000 · p75 R$ 5.000 · p90 R$ 9.000. Máx ~R$ 30k (Skyfit).
- ⚠️ **Não reusar `PATCH /api/cliente/:id`**: ele faz `SET telefone=${...??null}, responsavel=${...??null}, ...` sem COALESCE — editar só o cluster por ele **zeraria** os demais campos. Precisamos de um endpoint focado.

## 3. Definições (fechadas)

| Conceito | Regra |
|---|---|
| **Tier** | `cup_clientes.cluster` ∈ {"1","2","3","4"} (NFNC, Regulares, Chaves, Imperdíveis) |
| **MRR ativo do cliente** | `SUM(valorr) FILTER (WHERE tipo_receita='recorrente' AND status IN ('ativo','onboarding','triagem'))` por `id_task` |
| **Tier sugerido (auto)** | `mrr ≥ 7000 → "4"` · `4000–6999 → "3"` · `2000–3999 → "2"` · `< 2000 ou sem MRR (cancelado) → "1"` |
| **Override manual** | `cup_clientes.cluster_manual = true` — o "aplicar automático" NÃO sobrescreve estes |

A ordem de valor dos clusters é crescente: NFNC(1) < Regulares(2) < Chaves(3) < Imperdíveis(4).

## 4. Arquitetura

### Migração (prod + local)
```sql
ALTER TABLE "Clickup".cup_clientes ADD COLUMN IF NOT EXISTS cluster_manual boolean DEFAULT false;
```
Aplicar no banco de produção E no local (ver [[reference_databases]]). Idempotente.

### Backend (`server/routes/ltLtvChurn.ts` + helper)

**Helper puro** (`ltLtvChurn.helpers.ts`): `sugerirTier(mrr: number | null): "1"|"2"|"3"|"4"` com as faixas acima. Testável.

**Endpoints:**
- **Estender `GET /api/lt-ltv-churn/clientes`** — adicionar ao agregado `mrr_ativo` (SUM filtrado) e juntar `cup_clientes` para `cluster`/`cluster_manual`. Retornar por cliente: `mrrAtivo`, `cluster` (ou null), `clusterManual` (bool), `clusterSugerido` (via `sugerirTier(mrrAtivo)`).
- **`PATCH /api/lt-ltv-churn/clientes/:idTask/tier`** — body `{ cluster: "1"|"2"|"3"|"4"|null }`. `UPDATE "Clickup".cup_clientes SET cluster=${cluster}, cluster_manual=${cluster != null} WHERE task_id=${idTask}`. (cluster null = limpar e voltar a ser auto-elegível.) Valida cluster ∈ catálogo. Retorna `{ ok: true }`.
- **`POST /api/lt-ltv-churn/clientes/aplicar-tiers-auto`** — UPDATE set-based: para cada `id_task` com `COALESCE(cluster_manual,false)=false`, seta `cluster` pela faixa de MRR (CASE). Retorna `{ atualizados: n }`. SQL:
  ```sql
  UPDATE "Clickup".cup_clientes cc SET cluster = CASE
      WHEN m.mrr >= 7000 THEN '4' WHEN m.mrr >= 4000 THEN '3'
      WHEN m.mrr >= 2000 THEN '2' ELSE '1' END
  FROM (SELECT id_task, SUM(valorr) FILTER (WHERE tipo_receita='recorrente'
          AND status IN ('ativo','onboarding','triagem')) mrr
        FROM cortex_core.vw_lt_contratos GROUP BY id_task) m
  WHERE cc.task_id = m.id_task AND COALESCE(cc.cluster_manual,false) = false;
  ```

Padrão do projeto: `db.execute(sql\`...\`)`, `[api]` + 500, testes Vitest+supertest.

### Frontend (`client/src/components/lt-ltv-churn/ClientesTable.tsx`)

Reusa `CLUSTER_OPTIONS`/`CLUSTER_MAP` de `@shared/constants`. React Query.

- **Coluna "Tier"** na tabela: badge colorido (cor de `CLUSTER_OPTIONS`) com o tier atribuído. Se vazio, mostra a sugestão em cinza/itálico (`sugere: Chaves`).
- **Edição inline:** a célula é um `Select` com os 4 tiers + "Limpar". onChange → `PATCH .../:idTask/tier` → invalida a query de clientes.
- **Botão "Aplicar sugestões automáticas"** no header do card → `POST .../aplicar-tiers-auto` → toast com nº atualizados → invalida a query. (Afeta todos os 1.389, respeitando overrides manuais.)
- **Filtro por tier** (Select no topo, junto aos filtros existentes): passa `cluster` ao endpoint `/clientes` (novo param opcional, filtra por `cup_clientes.cluster`).
- Tipos (`types.ts`): `ClienteRow` += `mrrAtivo`, `cluster: string | null`, `clusterManual: boolean`, `clusterSugerido: string`.

## 5. Faseamento

- **v1 (núcleo):** migração + helper `sugerirTier` + endpoints (clientes estendido, PATCH tier, aplicar-auto) + coluna Tier editável + botão aplicar + filtro por tier.
- **v2 (futuro, fora deste escopo):** usar o tier para segmentar os gráficos/KPIs da tela; gestão do catálogo de clusters; histórico de mudanças de tier.

## 6. Edge cases / qualidade

- Cliente sem MRR ativo (cancelado) → sugestão NFNC ("1").
- `cluster` em `cup_clientes` pode ter lixo (valores fora de "1".."4") — o filtro/badge trata valores desconhecidos como "sem tier".
- `cluster_manual` default false; ao limpar o tier manual, volta a `false` (auto-elegível).
- Edição é por `task_id` (unidade da tela). Caso raro de mesmo CNPJ com 2 task_ids: cada um tem seu tier (documentar; não bloqueante).
- Aplicar-auto é set-based (1 UPDATE) — rápido mesmo em 1.389 linhas; respeita `cluster_manual`.
- A migração roda em prod E local (regra do projeto).

## 7. Testes

- Helper `sugerirTier`: faixas de MRR (boundaries 1499/1500/2999/3000/4999/5000, null → "1").
- Endpoints com mock de `db.execute`: `/clientes` retorna cluster+clusterSugerido; PATCH valida cluster e seta manual; aplicar-auto retorna contagem; 500 em erro.
- Sanidade: faixas batem com a distribuição (Imperdíveis ~33, Chaves ~41, Regulares ~105 dos ativos).

## 8. Próximos passos

1. Aprovação deste design.
2. `writing-plans` → plano de implementação (v1).
3. Migração → endpoints → frontend → testes → validação E2E.
