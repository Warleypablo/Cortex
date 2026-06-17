# Investors Report — "Geração de Caixa Acumulada" em base caixa (DFC)

**Data:** 2026-06-17
**Branch:** `feature/investors-geracao-caixa-dfc`

## Problema

O card "Geração de Caixa Acumulada" (`client/src/pages/InvestorsReport.tsx`) acumula
`geracaoCaixa = faturamento − despesas`, onde a **receita** vem de `caz_receber.total`
por `data_vencimento` (competência/emitido) e a **despesa** já é caixa
(`caz_pagar.pago` por data de pagamento). Esse descasamento faz o gráfico misturar
competência com caixa — não reflete geração de caixa real.

## Objetivo

Para **este gráfico apenas**, usar a **linha de geração de caixa da DFC** em regime de
caixa puro, restrito ao **ano corrente**, acumulando do zero em janeiro até o **último
mês fechado** (exclui o mês corrente parcial).

## Decisões (aprovadas)

1. **Fonte:** reaproveitar o cálculo exato da DFC (`storage.getDfc`) — `caz_parcelas`,
   `status='QUITADO'`, por `data_quitacao`, valor `valor_pago − desconto`,
   RECEITAS (categorias `03/04`) − DESPESAS (categorias `05/06/07/08`), incluindo o
   ajuste de conciliação temporário de R$ 10.000 em mai/2026 (categoria `09` sob
   DESPESAS). Garante paridade 100% com a tela `/dfc`.
2. **Período:** ano corrente dinâmico (hoje 2026), Jan → último mês fechado,
   **ignorando** o seletor de datas da página. Future-proof (2027 vira 2027 sozinho).
3. **Mês corrente parcial:** excluído.

## Backend — endpoint dedicado

`GET /api/investors-report/geracao-caixa` (read-only, sob `isAuthenticated`).

1. `ano = ano atual`; `dataInicio = '${ano}-01-01'`.
2. `dataFim = último dia do mês anterior ao atual` (último mês fechado). Se o mês
   atual for janeiro, série vazia.
3. `dfc = await storage.getDfc(dataInicio, dataFim)` (sem filtro de empresa = todas).
4. Localizar nós top-level `RECEITAS` e `DESPESAS` em `dfc.nodes`. Para cada mês `m`
   em `dfc.meses` com `m >= '${ano}-01'` e `m <= mês de dataFim`:
   `geracaoMes = RECEITAS.valuesByMonth[m] − Math.abs(DESPESAS.valuesByMonth[m])`
   (mesma fórmula de `dfcAnalysis.ts:calculateMonthlyData`).
5. Acumular: `caixaAcumulado += geracaoMes`.
6. Retornar `{ ano, series: [{ mes, mesLabel, geracaoMes, caixaAcumulado }] }`.

## Frontend — `InvestorsReport.tsx`

- Novo `useQuery` (`geracaoCaixaQuery`) para o endpoint, **independente** do seletor de
  período da página.
- Card "Geração de Caixa Acumulada":
  - Trocar a fonte do `ComposedChart` de `chartDataWithMetrics` →
    `geracaoCaixaQuery.data.series`.
  - Mantém `dataKey="caixaAcumulado"` e `XAxis dataKey="mesLabel"`; tooltip mostra
    também `geracaoMes` do mês.
  - `CardDescription` → "Regime de caixa (DFC) — acumulado em {ano}".
  - Loading/empty próprios desse query.
- **Não alterar** os demais cards que usam `chartDataWithMetrics`.

## Validação

- Conferir valores mensais extraídos contra a tela `/dfc` para 2026 — devem bater
  exatamente (incl. ajuste R$ 10k em mai/26).
- Último ponto da curva = soma de jan…último mês fechado.

## Fora de escopo

- Não alterar `evolucaoFaturamento` nem os outros gráficos.
- Não remover o ajuste de conciliação (responsabilidade do financeiro).
