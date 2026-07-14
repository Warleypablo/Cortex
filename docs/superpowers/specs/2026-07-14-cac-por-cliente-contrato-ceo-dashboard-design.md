# CAC por cliente e CAC por contrato na matriz do CEO Dashboard

**Data:** 2026-07-14
**Branch:** `feature/cac-cliente-contrato-ceo`
**Tela:** `/ceo-dashboard` (matriz indicador × mês)

## Objetivo

Inserir duas novas linhas de eficiência de aquisição na matriz do CEO Dashboard,
logo abaixo da linha "CAC" (que hoje mostra o investimento **total** de marketing
do mês):

- **CAC por cliente** = CAC total do mês ÷ deals ganhos no Bitrix (proxy de clientes adquiridos)
- **CAC por contrato** = CAC total do mês ÷ serviços vendidos no Bitrix (`servicos_vendidos`; 1 serviço = 1 contrato)

São a versão "por unidade" da linha CAC (valores na casa dos milhares de R$),
com a **mesma régua da aba CAC do BP 2026** — portanto reconciliam com aquela tela.

## Contexto / o que já existe

O motor do BP 2026 (`computarBpReceitas`, `server/routes/bp2026.ts`) **já calcula**
essas duas métricas e as entrega no mesmo payload que a matriz do CEO já consome,
sob `bp.cacDetalhe` (montado em `server/routes/bp2026.detalhamentos.ts`):

- `cac_por_cliente` — "CAC por cliente adquirido", CAC total ÷ `ganhosPorMes` (deals ganhos).
- `cac_por_contrato` — "CAC por contrato", CAC total ÷ `servicosVendidosTotalPorMes`.

Cada uma é uma `Linha` com `meses[]` no formato `{ mes, orcado, realizado, atingimento }`
— **idêntico** ao que a matriz transpõe via `celulasDoBp` (`ceoDashboard.matriz.helpers.ts`).
Ou seja: **têm meta (orçado) embutida**, então as linhas novas aparecem com "% meta"
e cor pela régua (menor = melhor), exatamente como a linha CAC atual.

**Nenhum SQL novo, nenhum cálculo novo** para exibir os valores — apenas reexpor.

## Arquitetura da mudança

### 1. Backend — matriz (`server/routes/ceoDashboard.matriz.ts`)
Em `buildCeoMatriz`, extrair de `bp.cacDetalhe` as linhas `cac_por_cliente` e
`cac_por_contrato` e passá-las em `montarMatrizCeo({...})` como novas fontes
(`cacPorClienteLinha`, `cacPorContratoLinha`).

### 2. Backend — montagem (`server/routes/ceoDashboard.matriz.helpers.ts`)
- Estender `CeoMatrizSources` com as duas linhas do BP.
- Inserir 2 linhas no array `linhas` **logo após a linha `cac`** (antes de `ltv_fat`),
  reusando `celulasDoBp`:
  - `key: "cac_por_cliente"`, `label: "CAC por cliente"`, `direcao: "menor_melhor"`, `unidade: "brl"`, `semMeta: false`
  - `key: "cac_por_contrato"`, `label: "CAC por contrato"`, `direcao: "menor_melhor"`, `unidade: "brl"`, `semMeta: false`
- Ambas com `nota` explicando numerador/denominador (herdada da nota do BP).
- Se a linha do BP não vier (defensivo), a linha degrada para células "—".

Ordem final da matriz: … CAC · **CAC por cliente** · **CAC por contrato** · LTV FAT …

### 3. Front-end (`client/src/components/ceo/CeoMatrizTabela.tsx`)
Renderiza `data.linhas` genericamente → **zero mudança** para exibir. As duas
linhas herdam valor + "% meta" + cor + clique.

### 4. Drill de composição (`server/routes/ceoDashboard.detalhe.ts`)
Como toda célula da matriz é clicável (menos NPS), as linhas novas abrem drill.
Formato **composição** (mesmo padrão de `receita_cabeca`):

```
CAC por cliente — <Mês>
  CAC total          R$ 334.622
  ÷ deals ganhos             78
  = CAC/cliente        R$ 4.290
```

- Adicionar branches `kpi === "cac_por_cliente"` e `kpi === "cac_por_contrato"`
  em `buildCeoDetalhe`.
- **Numerador** (CAC total do mês): reusar `montarDetalheBp(db, { metrica: "cac", mes })`
  (mesmo valor da linha CAC) para o item "CAC total".
- **Denominador** (deals ganhos / serviços vendidos): expor os counts do BP.
  Adicionar ao payload de `computarBpReceitas` um campo enxuto, ex.:
  `cacDenominadores: { deals: Record<mes, number>, servicos: Record<mes, number> }`
  (a partir de `ganhosPorMes` e `servicosVendidosTotalPorMes`, já computados no handler).
- **Header** (orçado/realizado do drill = a própria razão): ler de `bp.cacDetalhe`
  a linha correspondente (`meses[mes].orcado/realizado`), garantindo que o total do
  drill reconcilie com a célula clicada.
- `TITULOS`: adicionar rótulos "CAC por cliente" / "CAC por contrato".
- Evolução no drill (mini-série): opcional. `EVOLUCAO_FONTE` hoje só aceita
  `"linhas" | "metricasGerais"`; estender para aceitar `"cacDetalhe"` **se** for barato.
  Caso contrário, drill só com composição (aceitável).

## Reconciliação e gotchas conhecidos

- Valores idênticos à aba CAC do BP 2026 (mesma origem `bp.cacDetalhe`).
- "CAC por contrato" (÷ serviços vendidos, Bitrix) **não** bate 1:1 com "Nº de
  Contratos" do ClickUp — fontes e datas diferentes (Bitrix/data_fechamento ×
  ClickUp/data_criado). Esperado, não é bug.
- `servicos_vendidos` tem valores sujos (`"False"`, `"[]"`, null); o parse já é
  tratado no BP (`parseServicosVendidos`, piso 1 por deal). Nada a fazer aqui.
- Meta herda o orçado do BP (`reuniões × conversão` p/ cliente; contratos orçados
  p/ contrato). Onde o BP não tiver orçado no mês, a célula degrada para sem "% meta".

## Fora de escopo (YAGNI)

- Versão em **cards** do CEO Dashboard (legada) — só a matriz.
- Quebra de "CAC por produto" por segmento (`cac_contrato_produto_*` existe no BP,
  mas viraria N linhas — não pedido).
- Qualquer mudança na régua/fórmula do CAC (reuso puro).

## Verificação

- `npx tsc --noEmit` limpo.
- Local (`npm run dev`, porta 3000): abrir `/ceo-dashboard`, conferir as duas
  linhas novas abaixo de CAC, com valores na casa de milhares e "% meta"; cruzar
  jan–jun com a aba CAC do BP 2026 (devem ser iguais).
- Clicar numa célula de cada: o drill deve mostrar CAC total ÷ denominador = razão,
  e o resultado deve bater com o valor da célula.
- Dark **e** light mode.
