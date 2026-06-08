# Spec: View de Churn Detalhado por Produto

**Data:** 2026-06-08  
**Objetivo:** Diagnóstico de causas de churn cruzando produto × motivo de cancelamento

---

## Contexto

A tabela `"Clickup".cup_churn` consolida todos os contratos cancelados. A view `cortex_core.vw_cup_churn_ajustado` já enriquece esses dados com ajustes manuais (`cortex_core.churn_ajustes_manuais`). Este spec define duas views analíticas sobre essa base para diagnóstico de padrões.

---

## Escopo

Criação de duas views SQL em `cortex_core`. Sem alterações em `schema.ts`, Drizzle, ou endpoints de API.

---

## Views

### 1. `cortex_core.vw_churn_detalhado_produto`

**Propósito:** Visão agregada dos últimos 12 meses — contagens, MRR perdido e distribuição percentual por célula `(produto × motivo)`.

**Fonte:** `cortex_core.vw_cup_churn_ajustado`

**Filtro:** `ultimo_dia_operacao >= CURRENT_DATE - INTERVAL '12 months'`

**Exclusão:** Registros com `valor_r <= 0` (ajustes negativos distorcem ticket médio)

**Granularidade:** Uma linha por `(produto, motivo_cancelamento)`

**Colunas:**

| Coluna | Tipo | Cálculo |
|--------|------|---------|
| `produto` | text | `COALESCE(produto, 'Não Identificado')` |
| `motivo_cancelamento` | text | `COALESCE(motivo_cancelamento, 'Não Informado')` |
| `cancelamentos` | bigint | `COUNT(*)` |
| `mrr_perdido` | numeric | `SUM(valor_r)` |
| `ticket_medio` | numeric | `AVG(valor_r)` |
| `pct_dentro_produto` | numeric | `COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY produto)` |
| `pct_total` | numeric | `COUNT(*) * 100.0 / SUM(COUNT(*)) OVER ()` |

---

### 2. `cortex_core.vw_churn_produto_motivo_mensal`

**Propósito:** Série temporal sem filtro fixo — permite análise de evolução dos motivos por produto mês a mês.

**Fonte:** `cortex_core.vw_cup_churn_ajustado`

**Filtro:** Nenhum (cobre todo o histórico disponível: 2024-12-31 a 2026-07-20)

**Exclusão:** Registros com `valor_r <= 0`

**Granularidade:** Uma linha por `(ano_mes, produto, motivo_cancelamento)`

**Colunas:**

| Coluna | Tipo | Cálculo |
|--------|------|---------|
| `ano_mes` | date | `DATE_TRUNC('month', ultimo_dia_operacao)::date` |
| `produto` | text | `COALESCE(produto, 'Não Identificado')` |
| `motivo_cancelamento` | text | `COALESCE(motivo_cancelamento, 'Não Informado')` |
| `cancelamentos` | bigint | `COUNT(*)` |
| `mrr_perdido` | numeric | `SUM(valor_r)` |
| `ticket_medio` | numeric | `AVG(valor_r)` |

---

## Decisões Técnicas

- **DDL direto:** `CREATE OR REPLACE VIEW` — não passa pelo Drizzle/ORM
- **Schema:** `cortex_core` (padrão do projeto para views analíticas internas)
- **Naming:** prefixo `vw_` seguindo convenção existente (`vw_cup_churn_ajustado`, `vw_cohort_contratos`)
- **Sem índice adicional:** `cup_churn` tem ~4k registros; filtro por `ultimo_dia_operacao` é leve
- **LT excluído das métricas:** campo `lt` está corrompido em ~22% dos registros
- **Sync obrigatório:** aplicar em local (`cortex_dev`) e produção (GCP `dados_turbo`)

---

## Fora do Escopo

- Endpoint de API (`/api/churn/...`)
- Alterações em `shared/schema.ts` ou `server/db.ts`
- Dashboard ou componente frontend
- Filtro de período parametrizado (pode ser adicionado como função SQL futuramente)
