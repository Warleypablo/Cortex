# BP 2026 — Ajustes na aba CAC (Design)

**Data:** 2026-06-17
**Branch:** `feature/bp2026-cac-ajustes`
**Escopo:** aba **CAC** do módulo BP 2026 (Orçado × Realizado), `/bp-2026`.

## Objetivo

Três ajustes pedidos para o BP Financeiro, na aba CAC:

1. **CAC por Produto** — nova seção mostrando quanto do CAC cada produto recorrente consumiu.
2. **% do total por item** — linha-filha sob cada item de custo do CAC, mostrando sua participação no CAC total.
3. **Remover "os 150k"** — **fora de escopo / ignorado** (não há valor 150k no código nem na tabela de orçado `cortex_core.bp2026_orcado`; nada a fazer).

## Decisões (confirmadas com o usuário)

- **Cálculo do CAC por produto:** rateio do CAC total mensal **proporcional aos contratos vendidos** de cada produto, expresso em **R$**. A soma das linhas por produto fecha com o CAC total do mês.
  - `CAC_produto(m) = CAC_total(m) × contratos_vendidos_produto(m) ÷ Σ contratos_vendidos(m)`
  - Foi a leitura escolhida por dar número comparável por produto. A leitura literal "CAC ÷ contratos" resultaria em valor uniforme (CAC total ÷ contratos totais) para todos os produtos — não informativo.
- **Base de contratos:** **contratos vendidos no mês** (novos), com a mesma atribuição da aba "Vendas por Produto" (`agregarVendasProduto` → `contratosRec`). Coerente com o conceito de CAC (custo de aquisição).
- **Produtos:** apenas os **5 recorrentes** do BP — Performance, Creators, Social, Gestão de Comunidade, Others. Todo o CAC é atribuído a esses 5 produtos pela participação nos contratos recorrentes vendidos (pontual não recebe bucket próprio de CAC — anotado como premissa no tooltip).
- **% do total:** **linha-filha** indentada sob cada item de custo (não coluna nem 4º valor na célula).

## Estado atual (investigado)

- Backend: `server/routes/bp2026.detalhamentos.ts` → `montarDetalhamentos()` retorna `cac = [cacTotal, ...10 sub-linhas de custo, cacPorCliente, cacPctReceita, cacPayback]`.
  - As 10 sub-linhas de custo: Pré Vendas, Vendas, Gerência, Comissões, Growth, ADs, Eventos, Brindes, Viagens, Outras comerciais (não orçadas).
  - `cacTotalSerie = somaSeries(cacSeries)` (realizado/mês, soma das 10 sub-linhas) e `cacOrcMes(m)` (orçado/mês) já existem na função.
- Handler `server/routes/bp2026.ts`:
  - `cacPorMes` (linha ~293): CAC total realizado do DRE (bate com `cacTotalSerie`).
  - `montarVendasProduto()` (linha ~517) chama `carregarAtribuicaoVendas(db)` + `agregarVendasProduto(...)`, produzindo contratos por segmento/mês.
  - `montarDetalhamentos()` (linha ~528) recebe hoje só totais (`vendasMrrPorMes`, `pontualPorMes`, `ganhosPorMes`).
- Orçado de contratos por produto: chaves `contratos_vendidos_mrr_{performance|creators|social|gc|others}` existem (12 meses cada) em `cortex_core.bp2026_orcado`. CAC orçado total = 4.449.114 (bate com soma das sub-linhas orçadas).
- Frontend:
  - `client/src/components/bp2026/BPDreTable.tsx` — renderiza 1 `<tr>` por `BPLinha`; suporta cabeçalho de `grupo`/`segmento`; célula = realizado / orçado / atingimento; célula clicável quando `onCellClick && realizado !== null`.
  - `client/src/components/bp2026/BPCellDetail.tsx` — painel de drill; métricas derivadas listadas em `DERIVADAS`.
  - `client/src/pages/BP2026.tsx` — aba `cac` renderiza `data.cacDetalhe` com `BPDreTable`.

## Arquitetura da mudança

### Backend

**1. Plumbing — reaproveitar a atribuição de vendas (sem query duplicada)**

- Em `bp2026.ts`, carregar a atribuição uma vez:
  ```ts
  const atrib = await carregarAtribuicaoVendas(db);
  const agg = agregarVendasProduto(atrib.deals, atrib.prMix, atrib.mixRec, atrib.mixPont, atrib.aovRec, atrib.aovPont);
  ```
- `montarVendasProduto()` passa a aceitar `atrib?` opcional em `Deps` e reaproveitá-lo (fallback: carrega internamente — backward compatible).
- Derivar série realizada de contratos recorrentes vendidos por produto:
  `contratosVendidosRec: Record<slug, (number|null)[]>` (12 posições; `null` para meses futuros `m > mesCorrente`), a partir de `agg.get(m)?.get(segmento)?.contratosRec ?? 0`.
- Passar `contratosVendidosRec` como nova dep de `montarDetalhamentos()`.

**2. `montarDetalhamentos()` — seção CAC por Produto**

- Constante local:
  ```ts
  const PRODUTOS_CAC = [
    { slug: "performance", titulo: "Performance" },
    { slug: "creators",    titulo: "Creators" },
    { slug: "social",      titulo: "Social" },
    { slug: "gc",          titulo: "Gestão de Comunidade" },
    { slug: "others",      titulo: "Others" },
  ];
  ```
- Para cada produto `p`:
  - Realizado/mês: `alloc = cacTotalSerie[i] === null ? null : (totalCtrReal === 0 ? null : cacTotalSerie[i] × ctrReal_p / totalCtrReal)`, onde `ctrReal_p = contratosVendidosRec[p.slug][i] ?? 0` e `totalCtrReal = Σ_p ctrReal_p` (do mês `i`).
  - Orçado/mês (`orcadoMes(m)`): `cacOrcMes(m) × orcCtr_p(m) / orcTotalCtr(m)`, com `orcCtr_p(m) = orcado["contratos_vendidos_mrr_"+slug]?.[m] ?? 0` e `orcTotalCtr(m) = Σ_p orcCtr_p(m)` (0 quando denominador 0).
  - Montar com `fazLinha({ metrica: "cac_produto_"+slug, titulo: p.titulo, direcao: "menor_melhor", info: INFO_RATEIO }, allocReal, orcadoMes)`. YTD sai correto pelo `calcYtd` (fluxo = Σ meses fechados das alocações).
  - Campos novos na `Linha`: `grupo: "CAC por Produto"` (cabeçalho do bloco), `semDetalhe: true` (sem drill; explicação via tooltip `info`).
- `info` (tooltip) do bloco: definição "CAC total do mês rateado pela participação do produto nos contratos recorrentes vendidos", fonte "CAC: Conta Azul (caixa) · Contratos: Bitrix (deals ganhos)", cálculo "CAC_mês × contratos do produto ÷ contratos recorrentes totais. Pontual não recebe bucket próprio."
- **Atenção `anexarInfo` (`bp2026.ts` ~533):** hoje faz `info: INFO_METRICAS[l.metrica]`, o que **zera** qualquer `info` setado em `montarDetalhamentos`. Ajustar para `info: INFO_METRICAS[l.metrica] ?? (l as any).info` — preserva `info` inline (CAC por produto) e mantém o comportamento atual das demais linhas.

**3. `montarDetalhamentos()` — linha-filha "% do CAC total" por item de custo**

- Para cada uma das 10 sub-linhas de custo (`cacLinhas[k]`), gerar uma linha-filha logo abaixo:
  - `metrica: cacLinhas[k].metrica + "_pct_total"`, `titulo: "↳ % do CAC total"`, `unidade: "pct"`, `direcao: "neutro"`, `subItem: true`, `semDetalhe: true`.
  - Realizado/mês: `razao(cacSeries[k][i], cacTotalSerie[i])`. Orçado/mês: `razao(subOrc_k(m), cacOrcMes(m))` (onde `subOrc_k` = orçado da sub-linha; `cac_outras_sub` tem orçado 0 → 0%).
  - **Atingimento sempre `null`** (linha de composição, sem semântica de meta) — aplicar pós-processamento zerando `meses[].atingimento` e `ytd.atingimento`.
  - YTD: `ytdOverride` com `realizado = Σsub / ΣcacTotal` e `orcado = ΣsubOrc / ΣcacOrc` sobre meses fechados (não média de razões).
- Ordem final do array `cac`:
  `[cacTotal, (sub-linha, %filha)×10, cacPorCliente, cacPctReceita, cacPayback, ...cacPorProduto(bloco)]`.

### Frontend

**`BPDreTable.tsx`**

- `BPLinha`: adicionar `subItem?: boolean` e `semDetalhe?: boolean`.
- Render:
  - `clicavel = !!onCellClick && m.realizado !== null && !linha.semDetalhe`.
  - Linha `subItem`: rótulo indentado (`pl-8`) e em tom mais fraco/menor (`text-gray-500 dark:text-zinc-500 text-xs`); não entra na lógica `ehTotal`.

**`BPCellDetail.tsx`**

- Sem mudança obrigatória: linhas com `semDetalhe` não são clicáveis, então não abrem o painel. Continuam presentes no array combinado (inofensivo).

**`BP2026.tsx`**

- Nenhuma mudança (a aba CAC já renderiza `data.cacDetalhe` inteiro).

## Edge cases

- `Σ contratos = 0` (realizado ou orçado) no mês → alocação/`%` = `null` (`razao` já trata denominador 0).
- Meses futuros (`m > mesCorrente`): realizado `null` (séries já o fazem).
- `mesFechado = 0` (nenhum mês fechado): YTD `{orcado:0, realizado:null}` como nas demais linhas.
- Soma das 5 linhas de CAC por produto = CAC total do mês (quando `Σ contratos > 0`) — verificável em teste.
- `cac_outras_sub` (não orçada): orçado% = 0; realizado% conforme valor.

## Testes

- Unit (helper de rateio): dado CAC total e contratos por produto, soma das alocações = CAC total; produto com 0 contratos → 0; `Σ=0` → null.
- Unit (% do total): soma dos % das 10 sub-linhas = 100% (quando CAC total > 0); YTD usa Σ/Σ.
- Reaproveitamento: `montarVendasProduto` com `atrib` injetado retorna o mesmo resultado de quando carrega internamente (não diverge).
- Smoke: `GET /api/bp2026/receitas` retorna `cacDetalhe` com as 5 linhas `cac_produto_*` (grupo "CAC por Produto") e 10 linhas `*_pct_total` (subItem).

## Fora de escopo

- "Os 150k": não existe no código/orçado; nenhuma ação.
- Drill-down das linhas de CAC por produto e das linhas-filha de %: não clicáveis nesta entrega (explicação via tooltip).
- CAC por contrato (R$/contrato): omitido — com rateio por contratos seria uniforme entre produtos.
