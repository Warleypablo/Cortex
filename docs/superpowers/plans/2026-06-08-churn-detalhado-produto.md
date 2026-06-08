# Churn Detalhado por Produto — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar duas views SQL em `cortex_core` para diagnóstico de causas de churn por produto × motivo de cancelamento.

**Architecture:** Views de leitura analítica sobre `cortex_core.vw_cup_churn_ajustado` (que já consolida `cup_churn` + ajustes manuais). View plana com janela de 12 meses + view temporal sem filtro fixo. Sem alterações em ORM, schema.ts ou endpoints.

**Tech Stack:** PostgreSQL (Google Cloud SQL), psql CLI, conexão local `postgresql://cortex:dev123@localhost:5432/cortex_dev`, produção via `DATABASE_URL` do `.env.production`.

---

## Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `db/migrations/vw_churn_detalhado_produto.sql` |

Um único arquivo SQL com os dois `CREATE OR REPLACE VIEW`. Aplicado via `psql` no local e produção. Nenhum arquivo TypeScript alterado.

---

### Task 1: Criar a view plana `vw_churn_detalhado_produto` localmente

**Files:**
- Create: `db/migrations/vw_churn_detalhado_produto.sql`

- [ ] **Step 1: Verificar que a fonte existe**

```bash
psql "postgresql://cortex:dev123@localhost:5432/cortex_dev" \
  -c "SELECT COUNT(*) FROM cortex_core.vw_cup_churn_ajustado WHERE ultimo_dia_operacao >= CURRENT_DATE - INTERVAL '12 months' AND valor_r > 0;"
```

Resultado esperado: número > 0 (deve ser ~700–900 registros nos últimos 12 meses).

- [ ] **Step 2: Criar o arquivo SQL de migração**

Criar `db/migrations/vw_churn_detalhado_produto.sql` com o conteúdo:

```sql
-- View 1: churn detalhado por produto × motivo (últimos 12 meses)
CREATE OR REPLACE VIEW cortex_core.vw_churn_detalhado_produto AS
SELECT
  COALESCE(produto, 'Não Identificado')           AS produto,
  COALESCE(motivo_cancelamento, 'Não Informado')  AS motivo_cancelamento,
  COUNT(*)                                         AS cancelamentos,
  SUM(valor_r)                                     AS mrr_perdido,
  AVG(valor_r)                                     AS ticket_medio,
  ROUND(
    COUNT(*) * 100.0
    / SUM(COUNT(*)) OVER (PARTITION BY COALESCE(produto, 'Não Identificado')),
    2
  )                                                AS pct_dentro_produto,
  ROUND(
    COUNT(*) * 100.0
    / SUM(COUNT(*)) OVER (),
    2
  )                                                AS pct_total
FROM cortex_core.vw_cup_churn_ajustado
WHERE ultimo_dia_operacao >= CURRENT_DATE - INTERVAL '12 months'
  AND valor_r > 0
GROUP BY
  COALESCE(produto, 'Não Identificado'),
  COALESCE(motivo_cancelamento, 'Não Informado');
```

- [ ] **Step 3: Aplicar no banco local**

```bash
psql "postgresql://cortex:dev123@localhost:5432/cortex_dev" \
  -f db/migrations/vw_churn_detalhado_produto.sql
```

Resultado esperado: `CREATE VIEW`

- [ ] **Step 4: Validar a view — verificar estrutura**

```bash
psql "postgresql://cortex:dev123@localhost:5432/cortex_dev" \
  -c "\d cortex_core.vw_churn_detalhado_produto"
```

Resultado esperado: 7 colunas — `produto`, `motivo_cancelamento`, `cancelamentos`, `mrr_perdido`, `ticket_medio`, `pct_dentro_produto`, `pct_total`.

- [ ] **Step 5: Validar a view — sanidade dos dados**

```bash
psql "postgresql://cortex:dev123@localhost:5432/cortex_dev" -c "
SELECT produto, motivo_cancelamento, cancelamentos, mrr_perdido, ticket_medio,
       pct_dentro_produto, pct_total
FROM cortex_core.vw_churn_detalhado_produto
ORDER BY produto, cancelamentos DESC
LIMIT 20;"
```

Verificar:
- `pct_dentro_produto` soma ~100 para cada produto (tolerância de arredondamento)
- `pct_total` é coerente (soma total deve dar 100)
- Sem linhas com `cancelamentos = 0`
- Ticket médio > 0 em todas as linhas

- [ ] **Step 6: Commit**

```bash
git add db/migrations/vw_churn_detalhado_produto.sql
git commit -m "feat(db): criar view vw_churn_detalhado_produto

View analítica produto × motivo com cancelamentos, MRR perdido,
ticket médio e distribuição percentual (últimos 12 meses).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Adicionar a view temporal `vw_churn_produto_motivo_mensal`

**Files:**
- Modify: `db/migrations/vw_churn_detalhado_produto.sql`

- [ ] **Step 1: Adicionar a segunda view ao arquivo SQL**

Abrir `db/migrations/vw_churn_detalhado_produto.sql` e **acrescentar** após a primeira view:

```sql

-- View 2: série temporal por produto × motivo (histórico completo)
CREATE OR REPLACE VIEW cortex_core.vw_churn_produto_motivo_mensal AS
SELECT
  DATE_TRUNC('month', ultimo_dia_operacao)::date   AS ano_mes,
  COALESCE(produto, 'Não Identificado')            AS produto,
  COALESCE(motivo_cancelamento, 'Não Informado')   AS motivo_cancelamento,
  COUNT(*)                                          AS cancelamentos,
  SUM(valor_r)                                      AS mrr_perdido,
  AVG(valor_r)                                      AS ticket_medio
FROM cortex_core.vw_cup_churn_ajustado
WHERE valor_r > 0
GROUP BY
  DATE_TRUNC('month', ultimo_dia_operacao)::date,
  COALESCE(produto, 'Não Identificado'),
  COALESCE(motivo_cancelamento, 'Não Informado');
```

- [ ] **Step 2: Aplicar no banco local**

```bash
psql "postgresql://cortex:dev123@localhost:5432/cortex_dev" \
  -f db/migrations/vw_churn_detalhado_produto.sql
```

Resultado esperado: `CREATE VIEW` (duas vezes, uma por view — a primeira fará `CREATE OR REPLACE` sem erro).

- [ ] **Step 3: Validar estrutura da view temporal**

```bash
psql "postgresql://cortex:dev123@localhost:5432/cortex_dev" \
  -c "\d cortex_core.vw_churn_produto_motivo_mensal"
```

Resultado esperado: 6 colunas — `ano_mes`, `produto`, `motivo_cancelamento`, `cancelamentos`, `mrr_perdido`, `ticket_medio`.

- [ ] **Step 4: Validar sanidade da view temporal**

```bash
psql "postgresql://cortex:dev123@localhost:5432/cortex_dev" -c "
SELECT ano_mes, produto, SUM(cancelamentos) as total, SUM(mrr_perdido) as mrr
FROM cortex_core.vw_churn_produto_motivo_mensal
GROUP BY ano_mes, produto
ORDER BY ano_mes DESC, mrr DESC
LIMIT 20;"
```

Verificar:
- `ano_mes` tem sempre dia 1 (ex: `2026-05-01`, nunca `2026-05-15`)
- Dados cobrem desde `2024-12-01` até o mês atual
- Performance chega no topo (maior MRR perdido historicamente)

- [ ] **Step 5: Verificar totais consistentes com a fonte**

```bash
psql "postgresql://cortex:dev123@localhost:5432/cortex_dev" -c "
-- Total da view mensal nos últimos 12 meses deve bater com a view plana
SELECT SUM(cancelamentos) as total_mensal, SUM(mrr_perdido) as mrr_mensal
FROM cortex_core.vw_churn_produto_motivo_mensal
WHERE ano_mes >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months');

SELECT SUM(cancelamentos) as total_plana, SUM(mrr_perdido) as mrr_plana
FROM cortex_core.vw_churn_detalhado_produto;"
```

Resultado esperado: os totais dos dois SELECTs devem ser iguais (ou muito próximos — diferença máxima de 1-2 registros por arredondamento de datas no DATE_TRUNC vs CURRENT_DATE - INTERVAL).

- [ ] **Step 6: Commit**

```bash
git add db/migrations/vw_churn_detalhado_produto.sql
git commit -m "feat(db): adicionar view vw_churn_produto_motivo_mensal

Série temporal de churn por produto × motivo sem filtro de período,
cobrindo histórico completo para análise de tendências.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Aplicar as views em produção

**Files:** nenhum (somente execução remota)

- [ ] **Step 1: Verificar credenciais de produção**

```bash
cat .env.production 2>/dev/null | grep DATABASE_URL | head -1
# ou verificar em .env
grep -i "prod\|gcp\|34.95" .env 2>/dev/null | head -5
```

A URL de produção é `postgresql://...@34.95.249.110/dados_turbo` (conforme `reference_databases.md` na memória do projeto).

- [ ] **Step 2: Aplicar migração em produção**

```bash
psql "<URL_PRODUCAO>" -f db/migrations/vw_churn_detalhado_produto.sql
```

Resultado esperado: `CREATE VIEW` (duas vezes).

- [ ] **Step 3: Validar em produção**

```bash
psql "<URL_PRODUCAO>" -c "
SELECT COUNT(*) as total, SUM(mrr_perdido) as mrr_total
FROM cortex_core.vw_churn_detalhado_produto;"

psql "<URL_PRODUCAO>" -c "
SELECT COUNT(DISTINCT ano_mes) as meses, COUNT(*) as linhas
FROM cortex_core.vw_churn_produto_motivo_mensal;"
```

Verificar:
- View plana: total de linhas > 0, mrr_total > 0
- View mensal: número de meses coerente com o histórico (deve ser ~19 meses, de dez/2024 a jun/2026)

- [ ] **Step 4: Commit final**

```bash
git add db/migrations/vw_churn_detalhado_produto.sql
git commit -m "chore(db): sincronizar views churn com produção

Views vw_churn_detalhado_produto e vw_churn_produto_motivo_mensal
aplicadas no banco GCP (dados_turbo).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
