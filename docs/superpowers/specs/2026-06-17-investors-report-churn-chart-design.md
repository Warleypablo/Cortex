# Gráfico de Churn no Investors Report — Design

**Data:** 2026-06-17
**Branch:** `feature/investors-report-churn`
**Autor:** Warleypablo + Claude

## Objetivo

Adicionar um gráfico de evolução mensal do churn na visualização do Investors
Report, usando a tabela `"Clickup".cup_churn`. O gráfico mostra o MRR perdido
por mês (R$) em barras e a taxa de churn (%) em linha sobre eixo secundário.

## Decisões de design

| Decisão | Escolha |
|---------|---------|
| Métrica principal | MRR perdido (R$) em barras + taxa de churn (%) em linha |
| Definição de churn | **Bruto, alinhado ao ClickUp** — sem filtros de abono/motivo |
| Filtro de status | `status IN ('cancelado/inativo','em cancelamento')` (igual ao BP 2026) |
| Denominador da taxa | MRR ativo do **fim do mês anterior** (último snapshot de `cup_data_hist`) |
| Card de KPI no topo | **Não** — apenas o gráfico |
| Período | Respeita o filtro de/até já existente no report |

## Contexto investigado

- **Investors Report** vive em `client/src/pages/InvestorsReport.tsx` (componente
  React Query + Recharts) e é servido por `GET /api/investors-report` em
  `server/routes.ts` (linhas ~3323-3515). Hoje **não há nada de churn** lá.
- A tabela `"Clickup".cup_churn` tem `valor_r` (MRR), `data_solicitacao_encerramento`,
  `status`, `motivo_cancelamento`, `abonar_churn`, entre outras.
- **Validação contra o ClickUp:** com `status IN ('cancelado/inativo','em cancelamento')`
  e `valor_r > 0`, o churn mensal reproduz exatamente os números do ClickUp
  (jan=162.431, mar=151.063) — mesma definição que o BP 2026 usa desde 2026-06-16.
- **Denominador:** `cup_data_hist` tem snapshots de fim de mês desde nov/2025
  (nov=936.787, dez=1.030.089, jan=1.119.046, …). O **último** snapshot de cada
  mês é o MRR base; o **primeiro** snapshot vem incompleto (vinha zerado), por isso
  usa-se `MAX(data_snapshot)` do mês.

## Backend

Endpoint: `GET /api/investors-report` (`server/routes.ts`).

Adicionar campo `evolucaoChurn` ao objeto de retorno, alimentado por duas queries.

### Query 1 — Churn R$ por mês (bruto, alinhado ao ClickUp)

```sql
SELECT TO_CHAR(data_solicitacao_encerramento,'YYYY-MM') AS mes,
       COALESCE(SUM(valor_r),0) AS mrr_churn,
       COUNT(*) AS qtd
FROM "Clickup".cup_churn
WHERE valor_r > 0
  AND status IN ('cancelado/inativo','em cancelamento')
  AND data_solicitacao_encerramento IS NOT NULL
GROUP BY 1 ORDER BY 1;
```

### Query 2 — MRR de fim de mês (denominador da taxa)

```sql
WITH alvo AS (
  SELECT DATE_TRUNC('month', data_snapshot)::date AS mes,
         MAX(data_snapshot::date) AS d
  FROM "Clickup".cup_data_hist
  GROUP BY 1
)
SELECT TO_CHAR(a.mes,'YYYY-MM') AS mes,
       SUM(h.valorr::numeric) FILTER (
         WHERE h.status IN ('ativo','onboarding','triagem')
       ) AS mrr_fim
FROM alvo a
JOIN "Clickup".cup_data_hist h ON h.data_snapshot::date = a.d
GROUP BY 1;
```

### Combinação em JS

Para cada mês `N`:

```
taxaChurn[N] = mrrFim[N-1] ? (mrrChurn[N] / mrrFim[N-1]) * 100 : null
```

Quando não existe snapshot do mês anterior (meses anteriores a nov/2025), a taxa
fica `null` — a linha não desenha aquele ponto, mas a barra de MRR perdido aparece
normalmente.

### Formato de retorno

```typescript
evolucaoChurn: Array<{
  mes: string;          // "YYYY-MM"
  mrrChurn: number;     // R$ perdido no mês
  taxaChurn: number | null; // % (mrrChurn / MRR fim mês anterior)
  qtd: number;          // nº de contratos cancelados
}>
```

Array ordenado por mês ascendente. O frontend reordena/filtra por período em
`useMemo` (como já faz com `evolucaoFaturamento`), então a ordem do backend não é
crítica — basta ser consistente.

## Frontend

Arquivo: `client/src/pages/InvestorsReport.tsx`.

1. **Interface:** estender `InvestorsReportData` com `evolucaoChurn` (tipo acima).
2. **Filtro de período:** novo `useMemo` que filtra `evolucaoChurn` pelo mesmo
   range de/até, espelhando o `filteredData` de `evolucaoFaturamento`.
3. **Gráfico:** novo `ComposedChart` na grade de gráficos, posicionado após
   "Receita vs Despesas":
   - `Bar` `mrrChurn` — vermelho `#ef4444`, eixo Y esquerdo (R$).
   - `Line` `taxaChurn` — eixo Y direito (%), `connectNulls={false}`.
   - `ReferenceLine` com a taxa média de churn do período filtrado.
   - `Tooltip` com formatação R$ (sem decimais) e % (1 casa).
   - Título "Evolução do Churn".
4. **Tema:** classes `dark:` em textos, grids e eixos, seguindo o padrão dos
   gráficos vizinhos (`bg-background`, `text-foreground`, `border-border`).

## Fora de escopo (YAGNI)

- Card de KPI de churn no topo do report.
- Churn ajustado/oficial (com filtros de abono/motivo).
- Churn líquido / NRR.
- Breakdown de churn por squad ou produto.

## Riscos / observações

- O dashboard que o usuário vê roda em **produção** (`dados_turbo`); refletir a
  mudança exige merge → deploy. O `cortex_dev` local fica defasado no churn do mês
  corrente.
- A taxa % não terá ponto para meses anteriores a dez/2025 (sem denominador). É
  esperado e tratado com `null` / `connectNulls={false}`.
- Manter exatamente o mesmo filtro de status do BP 2026 garante que os dois
  dashboards contem a mesma história de churn.
