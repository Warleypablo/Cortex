# CEO Dashboard — Bloco "Movimento de Receita" (8 métricas MRR + Pontual)

**Data:** 2026-07-14
**Tela:** `/ceo-dashboard` (`client/src/pages/CeoDashboard.tsx` → `CeoMatrizTabela`)
**Branch:** `feature/ceo-dashboard-movimento-receita`

## Objetivo

Adicionar, no fim da matriz mês×mês do CEO Dashboard, um bloco com 8 indicadores
de movimento de receita, agrupados em duas seções (Recorrente/MRR e Pontual):

1. Venda MRR
2. Churn MRR
3. Venda de Cross-sell/Upsell MRR
4. NRR
5. Venda Pontual
6. Churn Pontual
7. Venda de Cross-sell/Upsell Pontual
8. NRR Pontual

Reaproveitando ao máximo o que o BP 2026 (`computarBpReceitas`) já calcula.

## Decisões (validadas com o usuário)

| Tema | Decisão |
|------|---------|
| Escopo | **As 8 métricas nesta entrega** (inclui construir cross-sell/NRR e criar NRR Pontual do zero). |
| Convenção de NRR | **Régua de erosão do código** (`getNrr`): `nrr = (churn − cross-sell) / base × 100`. Número baixo, **menor = melhor**. Vale para NRR recorrente e pontual. |
| Base do NRR Pontual | **Estoque pontual inicial do mês** (`pontual_estoque_ini`): `nrr_pont = (churn_pont − cross_pont) / estoque_pont_ini × 100`. |
| Layout | **Cabeçalhos de seção** dentro da tabela ("Movimento de Receita — Recorrente" / "— Pontual"). |
| Drill | **Com drill por mês** para as 8 (auditoria clicável, total reconcilia com a célula). |

## Contexto do código atual

- A matriz é montada por `montarMatrizCeo` (`server/routes/ceoDashboard.matriz.helpers.ts`,
  lógica pura) a partir de `computarBpReceitas(db)` (`server/routes/bp2026.ts:171`).
  Cada linha do BP traz série mensal em `meses[]` = `{mes, orcado, realizado, atingimento}`.
- O front `CeoMatrizTabela.tsx` renderiza `data.linhas` como `<tr>` planos (sem seções hoje).
  Cor da célula = `atingimentoTom(atingimentoPct, direcao)`; `semMeta: true` força neutro;
  célula sem meta (`atingimentoPct null`) já cai em neutro automaticamente.
- Unidade `pct` já é suportada por `ceoFormat.ts` (`formatValor`/`formatCompacto`).
- O drill é `GET /api/ceo-dashboard/detalhe?kpi=&mes=` (`ceoDashboard.detalhe.ts`),
  que devolve `{ ...base, grupos[], evolucao?, nota }`. `grupos[]` são caixas com
  `{titulo, total, formato, itens[], aberto?}`; `total` reconcilia com a célula clicada.

### Onde cada métrica já existe (mapa de reaproveitamento)

| # | Métrica | Fonte pronta | Série mensal? |
|---|---------|--------------|---------------|
| 1 | Venda MRR | `bp.metricasGerais` → `vendas_mrr` (`bp2026.metricas.ts:200`) | ✅ com meta |
| 2 | Churn MRR | `bp.metricasGerais` → `churn_mes` (`bp2026.metricas.ts:213`) | ✅ com meta |
| 3 | Cross/Upsell MRR | `metricsAdapter.getVendasMrrBreakdown().crosssell` (por período) | ❌ construir |
| 4 | NRR | derivado (`getNrr`: `(churn−cross)/mrr_início`) | ❌ construir |
| 5 | Venda Pontual | `bp.metricasGerais` → `vendas_pontual` (`bp2026.metricas.ts:201`) | ✅ com meta |
| 6 | Churn Pontual | `bp.pontual` → `pontual_churn` (`bp2026.pontual.helpers.ts:418`) | ✅ (meta se seedada) |
| 7 | Cross/Upsell Pontual | `getVendasMrrBreakdown().crosssell_pontual` (por período) | ❌ construir |
| 8 | NRR Pontual | não existe — criar (base = `pontual_estoque_ini`) | ❌ construir |

Régua de cross-sell (reaproveitada de `buildVendasMrrQuery`, `metricsAdapter.ts:716`):
deal `source='PARTNER'` **e** cliente pré-existente (1º contrato antes do mês do
fechamento). `crosssell` = `SUM(valor_recorrente)` desses deals; `crosssell_pontual`
= `SUM(valor_pontual)`.

## Arquitetura

### Helper compartilhado (novo)

`server/routes/ceoDashboard.movimentoReceita.ts`

```
computarMovimentoReceita(db, bp, mesNum) => {
  // séries mensais Record<mes, number> (1..mesNum)
  vendaMrr, churnMrr, crossMrr, nrr,
  vendaPontual, churnPontual, crossPontual, nrrPontual,
  // ingredientes p/ reconciliação e drills
  mrrInicioPorMes, estoquePontIniPorMes, crossMrrPorMes, crossPontPorMes,
}
```

- **Reusa do `bp`** (sem query nova): `vendas_mrr`, `churn_mes`, `vendas_pontual`
  (`metricasGerais`), `pontual_churn`, `pontual_estoque_ini` (`pontual`). Lê a série
  `meses[].realizado` de cada linha.
- **2 queries novas**, ambas agregando por mês (não loop por período):
  1. **Cross-sell por mês** — `crm_deal` com a régua de `buildVendasMrrQuery`, mas
     `GROUP BY TO_CHAR(data_fechamento,'YYYY-MM')`, devolvendo `crosssell` (MRR) e
     `crosssell_pontual` por mês de 2026.
  2. **MRR-início por mês** — `SUM(valorr)` dos ativos (`status IN
     ('ativo','onboarding','triagem')`) no 1º snapshot (`cup_data_hist`) de cada mês.
- **Derivações (régua de erosão):**
  - `nrr[m] = mrrInicio[m] > 0 ? (churnMrr[m] − crossMrr[m]) / mrrInicio[m] × 100 : null`
  - `nrrPontual[m] = estoquePontIni[m] > 0 ? (churnPontual[m] − crossPont[m]) / estoquePontIni[m] × 100 : null`
  - Base ausente/zero → célula `null` ("—"), não 0 (não inventa retenção perfeita).

Esse helper é a **fonte única** para matriz e detalhe → a régua do NRR vive num só
lugar e é testada isoladamente.

### Matriz (transposição)

`ceoDashboard.matriz.ts` chama `computarMovimentoReceita` e passa as séries para
`montarMatrizCeo`. Em `ceoDashboard.matriz.helpers.ts`:

- Novo tipo de linha **separadora de seção**: `CeoMatrizLinha` ganha
  `tipo?: "secao"` (default "dado"). Linha de seção tem só `key`+`label`,
  sem células.
- As 4 linhas com fonte no BP (`vendas_mrr`, `churn_mes`, `vendas_pontual`,
  `pontual_churn`) reutilizam `celulasDoBp` (herdam meta/atingimento).
- Cross-sell e NRR usam `celulasDaSerie` (sem meta → neutro).

Ordem final da matriz:

```
… (15 indicadores atuais) …
[secao] Movimento de Receita — Recorrente (MRR)
  Venda MRR            (bp vendas_mrr)      brl  maior_melhor
  Churn MRR            (bp churn_mes)       brl  menor_melhor
  Cross/Upsell MRR     (serie crossMrr)     brl  maior_melhor  semMeta
  NRR                  (serie nrr)          pct  menor_melhor  semMeta
[secao] Movimento de Receita — Pontual
  Venda Pontual        (bp vendas_pontual)  brl  maior_melhor
  Churn Pontual        (bp pontual_churn)   brl  menor_melhor
  Cross/Upsell Pontual (serie crossPont)    brl  maior_melhor  semMeta
  NRR Pontual          (serie nrrPontual)   pct  menor_melhor  semMeta
```

Keys: `venda_mrr`, `churn_mrr`, `cross_mrr`, `nrr`, `venda_pontual`,
`churn_pontual`, `cross_pontual`, `nrr_pontual`.

### Front (`CeoMatrizTabela.tsx`)

- Renderizar `tipo === "secao"` como um `<tr>` de cabeçalho que ocupa todas as
  colunas (`colSpan`), sticky na 1ª coluna, estilo discreto (uppercase, borda
  superior), dark/light. Linhas de seção não são clicáveis.
- As 8 linhas de dado são clicáveis (drill) como as demais. NRR/cross-sell (sem
  meta) permanecem clicáveis mesmo neutras.
- Atualizar a legenda do rodapé mencionando o novo bloco e a régua de NRR (erosão).

### Drill (`ceoDashboard.detalhe.ts`)

Adicionar as 8 keys a `KPIS_VALIDOS` e a `TITULOS`. `buildCeoDetalhe` chama
`computarMovimentoReceita` (via `bp`) para header (`realizado`/`orcado`) e
`evolucao` (série do helper). Grupos por tipo:

- **Venda MRR / Venda Pontual** — 1 grupo com deals ganhos do mês (reusa
  `dealsGanhosDoMes`, filtro `vr>0` / `vp>0`); item = título, closer, data, valor;
  `total` = venda do mês.
- **Cross/Upsell MRR / Pontual** — `getCrosssellDealsDetail(iniMes, fimMes)`
  (`metricsAdapter.ts:808`); usa `total_recorrente` / `total_pontual` conforme a
  linha; itens = deals cross-sell.
- **Churn MRR** — clientes que caíram no mês (reusa `getChurnDetail` /
  `vw_cup_churn_ajustado` filtrado ao mês); item = cliente, valor_r; `total` =
  `churn_mes` do mês.
- **Churn Pontual** — contratos pontuais que saíram do estoque no mês (mesma régua
  do `pontual_churn`, snapshot-diff); `total` = `pontual_churn` do mês.
- **NRR / NRR Pontual** — **decomposição** em 3 caixas: `Base` (MRR-início |
  estoque pontual inicial), `Churn (−)`, `Cross-sell (+)`; `nota` com a conta
  literal e o resultado em %. Header `realizado` = a própria erosão da célula.

`CeoKpiDetail.tsx` deve exibir esses grupos com o componente existente; ajustar só
se a decomposição do NRR precisar de formato diferente (esperado: reuso).

## Formatação e cor

- Venda/Churn/Cross (1,2,3,5,6,7): unidade `brl`, compacto (`R$ 4K`).
- NRR / NRR Pontual (4,8): unidade `pct`, 1 casa (`4,2%`).
- Direções: venda/cross = `maior_melhor`; churn/NRR = `menor_melhor`.
- Com meta (1,2,5,6 quando seedada): cor por `atingimentoTom`.
- Sem meta (3,4,7,8): `semMeta: true` → neutro (só valor, sem "% meta").

## Testes

`ceoDashboard.movimentoReceita.test.ts` (helper puro, sem IO — injetar `bp` fake e
resultados das 2 queries):

1. NRR = `(churn − cross)/mrrInicio×100`; base 0/ausente → `null`.
2. NRR Pontual = `(churnPont − crossPont)/estoquePontIni×100`; base 0 → `null`.
3. Reaproveitamento correto das séries do BP (venda/churn MRR e pontual).
4. Séries respeitam `1..mesNum`; meses futuros ausentes.

`ceoDashboard.matriz.helpers.test.ts` (estender):

5. Ordem e keys das 8 linhas + 2 seções.
6. Linhas do BP herdam meta; cross-sell/NRR entram `semMeta`.
7. Linha de seção sem células e não clicável.

## Riscos / edge cases

- **Reconciliação drill↔célula:** o `total` de cada grupo deve bater com a célula.
  Venda/churn usam o valor do BP como `total` autoritativo (fonte da célula);
  a lista de itens é ilustrativa (pode ter `itensOmitidos` como no CAC).
- **Mês parcial:** herda `mesFechado`; colunas `mes > mesFechado` recebem `*`.
  Venda/cross/NRR do mês corrente despencam (parcial) — esperado, não é queda real.
- **NRR erosão pode ser negativo** (cross-sell > churn = retenção líquida positiva).
  Exibir o valor com sinal; `menor_melhor` já trata negativo como ótimo em
  `atingimentoTom` — mas como é `semMeta`, fica neutro de qualquer forma.
- **Cross-sell depende de CNPJ casado** (`crm_deal.cnpj` × `cup_clientes.cnpj`).
  Deals sem CNPJ ou sem contrato anterior contam como "novo", não cross-sell —
  mesma limitação já aceita no OKR/scorecard.
- **Performance:** +2 queries mensais (leves; a de MRR-início varre `cup_data_hist`
  no 1º snapshot de cada mês — usar índice `data_snapshot` existente). Bem abaixo do
  custo da query de LTV que já roda na matriz.

## Fora de escopo (fase 2 possível)

- Metas de cross-sell/NRR (hoje não há orçado no BP para eles).
- NRR "clássico" SaaS (>100% = expansão) — decisão foi manter a régua de erosão.
