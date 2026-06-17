# Gráfico de Vendas (Recorrente × Pontual) no Investors Report — Design

**Data:** 2026-06-17
**Branch:** `feature/investors-report-vendas`
**Autor:** Warleypablo + Claude

## Objetivo

Adicionar ao Investors Report um gráfico de **vendas mensais** segmentadas em
recorrente (MRR novo) e pontual (projetos), fechadas no Bitrix. Duas linhas ao
longo dos meses.

## Decisões de design

| Decisão | Escolha |
|---------|---------|
| Métrica | Valor de vendas fechadas por mês, separado em recorrente e pontual |
| Fonte | `"Bitrix".crm_deal`, `stage_name = 'Negócio Ganho'`, por `data_fechamento` |
| Visualização | Duas linhas (recorrente verde `#10b981`, pontual azul `#1978D5`), eixo único em R$ |
| Período | Respeita o filtro de/até já existente; dados desde set/2025 |
| Contagem de deals | Disponível no dado (`numDeals`), sem linha própria (fora de escopo visual) |

## Contexto investigado

- "Vendas" na empresa = deals ganhos no Bitrix. A query canônica já é usada no
  Relatório Mensal (`server/routes/relatorioMensalSlides.ts:830-842`):
  `SUM(valor_recorrente)` e `SUM(valor_pontual)` de `crm_deal` com
  `stage_name = 'Negócio Ganho'`, agrupado por `TO_CHAR(data_fechamento,'YYYY-MM')`.
- **Cobertura temporal:** deals ganhos existem de **2025-08-12 até hoje**
  (set/2025 é o primeiro mês cheio). O Investors Report vai de 2023+, mas o
  gráfico de vendas só terá pontos a partir de set/2025 — meses anteriores ficam
  sem dado (igual ao churn antes de dez/2025).
- Valores reais validados (prod, 2026-06-17): MRR ~180–270k/mês, pontual
  ~200–470k/mês.
- `valor_recorrente` e `valor_pontual` são colunas distintas do mesmo deal; um
  deal pode ter os dois. Não há view consolidada de vendas mensais — usar query
  direta.

## Backend

Endpoint: `GET /api/investors-report` (`server/routes.ts`), o mesmo que já serve
faturamento e churn.

Adicionar campo `vendasMensais` ao retorno, alimentado por uma query:

```sql
SELECT TO_CHAR(data_fechamento, 'YYYY-MM') AS mes,
       COALESCE(SUM(valor_recorrente), 0) AS vendas_recorrente,
       COALESCE(SUM(valor_pontual), 0)    AS vendas_pontual,
       COUNT(*)                            AS num_deals
FROM "Bitrix".crm_deal
WHERE stage_name = 'Negócio Ganho'
  AND data_fechamento IS NOT NULL
GROUP BY 1
ORDER BY 1;
```

Mapeamento inline (trivial, sem função pura separada — não há lógica de negócio
além do `SUM` no SQL, então não há o que testar unitariamente de forma
significativa; a validação é via query real + browser):

```typescript
vendasMensais: Array<{
  mes: string;            // "YYYY-MM"
  vendasRecorrente: number;
  vendasPontual: number;
  numDeals: number;
}>
```

Array ordenado por mês ascendente. O frontend reordena/filtra por período.

## Frontend

Arquivo: `client/src/pages/InvestorsReport.tsx`.

1. **Interface:** estender `InvestorsReportData` com `vendasMensais` (tipo acima).
2. **Filtro de período:** novo `useMemo` que filtra `vendasMensais` pelo mesmo
   range de/até e adiciona `mesLabel`, espelhando o padrão de `churnChartData` /
   `filteredData`.
3. **Gráfico:** novo `Card` com `LineChart` (ou `ComposedChart` só com `Line`s),
   posicionado logo após o gráfico "Evolução da Margem":
   - `Line` `vendasRecorrente` — verde `#10b981`, "Vendas Recorrente".
   - `Line` `vendasPontual` — azul `#1978D5`, "Vendas Pontual".
   - Eixo Y único em R$ (`formatCurrencyShort`); `connectNulls={false}`.
   - `Tooltip` em R$; `Legend`.
   - Título "Vendas por Mês (Recorrente e Pontual)".
4. **Tema:** classes `dark:`/de tema nos containers; cores hardcoded dos gráficos
   vizinhos nos elementos Recharts (grid `#334155`, ticks `#94a3b8`, tooltip
   `#1e293b`/`#f8fafc`).

## Fora de escopo (YAGNI)

- Linha/série de contagem de deals.
- Breakdown por produto/segmento Bitrix.
- Metas/orçado de vendas.
- Receita/faturamento (este gráfico é vendas fechadas, não recebimento).

## Riscos / observações

- O dashboard roda em **produção** (`dados_turbo`); refletir exige merge → deploy.
  O `cortex_dev` local pode estar defasado no Bitrix (última sync conhecida do
  `crm_deal` em prod: ~2026-06-05) — validar contagens locais vs prod.
- Sem pontos antes de set/2025 (sem deals ganhos no Bitrix). Esperado, tratado
  com `connectNulls={false}`.
- Trabalho isolado em git worktree (`feature/investors-report-vendas`) a partir
  da `main` atualizada, para evitar colisão com sessões concorrentes no clone.
