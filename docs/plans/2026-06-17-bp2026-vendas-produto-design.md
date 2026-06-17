# BP 2026 — Aba "Vendas por Produto" via ClickUp (design)

**Data:** 2026-06-17
**Branch:** `feature/bp2026-cac-ajustes` (criar `feature/bp2026-vendas-produto` para esta entrega)
**Status:** design aprovado em brainstorming — aguardando revisão do spec

## 1. Problema

A aba "Vendas por Produto" do BP 2026 hoje deriva o **realizado** do Bitrix
(`"Bitrix".crm_deal`, deals em `stage_name = 'Negócio Ganho'`), atribuindo valor a
segmentos por uma cascata (product-rows do Bitrix → mix ClickUp por CNPJ → AOV médio).
O comercial preenche o Bitrix de forma inconsistente, então esses números não são
confiáveis. Queremos passar a **medir vendas por produto a partir do ClickUp**, que tem
o cadastro operacional real dos contratos.

## 2. Objetivo

Reconstruir o **realizado** da aba "Vendas por Produto" usando `"Clickup".cup_contratos`,
contabilizando cada contrato no mês da sua **data de criação** (`data_criado`), mantendo o
formato padrão do BP (**Orçado × Realizado × % atingimento**, 12 meses + YTD) e
reaproveitando o orçado já existente. O Bitrix sai de cena **apenas nesta aba**.

## 3. Decisões de design (do brainstorming)

| Decisão | Escolha |
|---|---|
| Fonte do realizado | **Substituir Bitrix por ClickUp** (`cup_contratos`) |
| Janela temporal | Mês de **`data_criado`** (não `data_inicio`) |
| Formato | **Orçado × Realizado** mantido (formato padrão do BP) |
| Agrupamento | Reaproveitar os **buckets de orçado existentes** (Top-N + Outros), mapeando `produto` → segmento |
| Granularidade do orçado | **Por produto** (todas as linhas têm orçado×realizado) |
| Linhas de AOV | **Manter** (ticket médio por segmento, recalculado do ClickUp) |
| De-para ambíguos | Proposto aqui; usuário revisa |

## 4. Fonte de dados e regras

- **Tabela:** `"Clickup".cup_contratos` (tabela viva). `data_criado` é atributo fixo do
  contrato → não precisa de snapshots (`cup_data_hist` **não** carrega `data_criado`).
  Cobertura validada: 2765/2765 linhas preenchidas, jun/2023 → hoje.
- **Janela:** contrato conta no mês de `data_criado`. Para o BP 2026:
  `data_criado >= '2026-01-01' AND data_criado < '2027-01-01'`.
- **Status:** incluir **todos os status exceto `'não usar'`** (lixo). Contratos
  `cancelado/inativo` permanecem na tabela e devem contar — uma venda criada em janeiro
  é venda de janeiro mesmo que tenha churnado depois. Comparar sempre com
  `LOWER(TRIM(status))`.
- **MRR vs Pontual:** `valorr` (recorrente) alimenta o bloco **Recorrente**; `valorp`
  (pontual) alimenta o bloco **Pontual**. Usar `COALESCE(..., 0)` (podem ser NULL).
- **Semântica:** "Receita MRR" aqui é **MRR novo vendido no mês** (bookings), não a base
  ativa — alinhado com a métrica de orçado `vendas_mrr` e com o que a aba já representava.

## 5. Estrutura da tela

Reusa o componente `BPDreTable` e a interface `BPLinha` (grupo/segmento/subItem/destaque).
Frontend praticamente sem mudança — só muda o conteúdo do payload `data.vendasProduto`.

### 5.1 Linha Superior (totais — Orçado × Realizado × %)

| Linha | Realizado (ClickUp) | Orçado |
|---|---|---|
| **Receita Total** | `SUM(valorr) + SUM(valorp)` dos criados no mês | `vendas_mrr + vendas_pontual` |
| **Receita MRR** | `SUM(valorr)` | `vendas_mrr` |
| **Receita Pontual** | `SUM(valorp)` | `vendas_pontual` |
| **Nº de Contratos** | `COUNT(DISTINCT id_subtask)` criados no mês | soma de `contratos_vendidos_mrr_*` + `contratos_vendidos_pontual_*` ⚠️ |
| **Nº de Clientes** | `COUNT(DISTINCT id_task)` criados no mês | **realizado-only** (não há orçado de clientes novos) ⚠️ |

⚠️ **Caveats a confirmar na revisão:**
- *Nº de Contratos orçado:* a soma dos `contratos_vendidos_*` pode contar em dobro um
  contrato com `valorr>0` E `valorp>0` (aparece no bloco MRR e no Pontual). O realizado
  do topo usa `DISTINCT id_subtask` (sem dobra). Aceitável como aproximação; alternativa
  é deixar Nº Contratos do topo também realizado-only.
- *Nº de Clientes:* o orçado `clientes` existente (~436/mês) é **base ativa**, semântica
  diferente de "clientes novos por data de criação" → não usar como meta aqui.

### 5.2 Bloco Recorrente (por segmento — Orçado × Realizado)

Segmentos (= chaves de orçado MRR): **Performance · Creators · Social · Gestão de Comunidade · Outros**

Para cada segmento, 3 linhas (espelhando a aba atual):
- **Receita MRR** — `SUM(valorr)` dos contratos do segmento ↔ `vendas_mrr_<seg>`
- **Nº Contratos** — `COUNT(*) FILTER (WHERE valorr>0)` ↔ `contratos_vendidos_mrr_<seg>`
- **AOV** — `Receita MRR ÷ Nº Contratos` (derivada no client) ↔ `aov_venda_mrr_<seg>`

Slugs de orçado: `performance`, `creators`, `social`, `gc`, `others`.

### 5.3 Bloco Pontual (por segmento — Orçado × Realizado)

Segmentos (= chaves de orçado Pontual): **Creators · E-commerce · Site · Landing · CRM · Outros**

Para cada segmento, 3 linhas:
- **Receita Pontual** — `SUM(valorp)` ↔ `vendas_pontual_<seg>`
- **Nº Contratos** — `COUNT(*) FILTER (WHERE valorp>0)` ↔ `contratos_vendidos_pontual_<seg>`
- **AOV** — `Receita Pontual ÷ Nº Contratos` ↔ `aov_venda_pontual_<seg>`

Slugs de orçado: `creators`, `ecommerce`, `site`, `landing`, `crm`, `others`.

> Nota: um contrato com `valorr>0` e `valorp>0` aparece nos **dois** blocos (uma vez em
> cada natureza), igual à estrutura do orçado. Isso é intencional.

## 6. De-para `produto` (ClickUp) → segmento de orçado

Default para qualquer valor não listado (incl. produtos futuros e `(sem produto)`): **others**.
O mesmo produto cai no bucket MRR ou Pontual conforme tenha `valorr`/`valorp`; se um
segmento não existe naquele bloco (ex.: não há "crm" no bloco MRR), a parcela vai para
**others** desse bloco.

| Produto ClickUp | Segmento | Confiança |
|---|---|---|
| Performance | performance | óbvio |
| Consultoria de Performance | performance | serviços "Consultoria/Gestão de performance" |
| Gameplan | performance | serviços "Gameplan (Performance)", "Fee implantação (Performance)" `[REVISAR]` |
| Creators | creators | óbvio |
| Social Media | social | óbvio |
| Blog Post | social | conteúdo `[REVISAR]` (alternativa: others) |
| Gestão de Comunidade | gc | óbvio |
| Gestão & Atendimento | gc | atendimento/comunidade `[REVISAR]` |
| Ecommerce | ecommerce | óbvio |
| TikTok Shop | ecommerce | marketplace/loja `[REVISAR]` |
| CRO & Alteração | ecommerce | serviços Shopify/checkout/"Evolução de Ecommerce" `[REVISAR]` (alt.: others) |
| Site | site | óbvio |
| Landing Page | landing | óbvio |
| CRM de Vendas | crm | óbvio |
| Régua de Automação | crm | régua de e-mail/WhatsApp `[REVISAR]` |
| Broadcast | others | e-mail mkt/Reportana (CRM-MRR não existe) `[REVISAR]` (alt.: crm no Pontual) |
| Sustentação | others | manutenção site/ecommerce, majoritariamente MRR `[REVISAR]` |
| Estruturação Comercial | others | consultoria comercial |
| Estruturação Estratégica | others | consultoria estratégica |
| ID Visual | others | branding/design |
| Pacote Artes / Rótulos | others | design |
| SEO Full | others | `[REVISAR]` (alt.: performance) |
| Agente IA | others | IA/automação `[REVISAR]` (alt.: crm) |
| Fee de implantação | others | implantação avulsa |
| Dashboard | others | tech avulso |
| Account Management | others | gestão de conta |

> O de-para vira uma constante única (`PRODUTO_PARA_SEGMENTO`) num módulo dedicado
> (ex.: `server/routes/bp2026.produtoSegmento.ts`), com função `segmentoDeProduto(produto)`.

## 7. Cálculo do realizado (query base)

Uma query agregadora por mês × segmento × natureza, mais agregados de topo:

```sql
SELECT
  EXTRACT(MONTH FROM data_criado)::int                       AS mes,
  <CASE de produto → segmento>                               AS segmento,
  COALESCE(SUM(valorr), 0)                                   AS mrr,
  COALESCE(SUM(valorp), 0)                                   AS pontual,
  COUNT(*) FILTER (WHERE COALESCE(valorr,0) > 0)             AS contratos_mrr,
  COUNT(*) FILTER (WHERE COALESCE(valorp,0) > 0)             AS contratos_pont
FROM "Clickup".cup_contratos
WHERE data_criado >= '2026-01-01' AND data_criado < '2027-01-01'
  AND LOWER(TRIM(status)) <> 'não usar'
GROUP BY 1, 2;
```

Totais de topo (Nº Contratos / Nº Clientes) calculados por mês com
`COUNT(DISTINCT id_subtask)` e `COUNT(DISTINCT id_task)` sobre o mesmo filtro.

YTD: somatório dos meses fechados para fluxo (receita/contratos); para clientes,
revisar se YTD soma ou usa distinct acumulado `[REVISAR]`.

## 8. Drill-down

Clicar numa célula lista os **contratos do ClickUp** daquele segmento/mês/natureza:
- Itens: nome do cliente (via join `cup_clientes` por `id_task`), `servico`, valor
  (`valorr` ou `valorp` conforme natureza), `data_criado`, `status`.
- Substitui o detalhe atual de deals do Bitrix.
- Métrica/parse: manter o padrão `vendas_mrr_<slug>` / `vendas_pontual_<slug>` /
  `contratos_vendidos_<slug>`; AOV continua derivada no client.
- **Consistência célula ≡ detalhe:** a soma dos itens do drill-down tem de bater com a
  célula agregada (mesmo filtro, mesmo de-para).

## 9. Superfície de implementação (arquivos)

- `server/routes/bp2026.produtoSegmento.ts` **(novo)** — de-para + `segmentoDeProduto()` e
  o `CASE` SQL gerado a partir dele (fonte única de verdade).
- `server/routes/bp2026.vendasProduto.ts` — reescrever `montarVendasProduto()` e o
  drill-down para ler do ClickUp; remover `carregarAtribuicaoVendas()` (cascata Bitrix).
- `server/routes/bp2026.vendasProduto.helpers.ts` — substituir `distribuirDeal()`/
  `agregarVendasProduto()` pela agregação ClickUp.
- `server/routes/bp2026.ts` — trocar o carregamento de dados da aba; **verificar** que
  nada mais (abas Revenue/Funil) depende do que for removido (o `crm_deal`/pontual do
  Bitrix continua alimentando outras abas — não remover globalmente).
- `server/routes/bp2026.detalhe.ts` — handler de drill-down → contratos ClickUp.
- Frontend (`BP2026.tsx`, `bp2026/BPDreTable.tsx`, `bp2026/BPCellDetail.tsx`) — sem
  mudança estrutural esperada; só validar render do payload e do detalhe.

## 10. Testes

- **Unit (de-para):** `segmentoDeProduto()` cobre os 27 produtos conhecidos + default.
- **Unit (agregação):** dado um conjunto fixo de contratos, MRR/Pontual/contratos por
  segmento batem; contrato com valorr+valorp aparece nos dois blocos.
- **Consistência:** soma do drill-down == célula agregada (smoke test).
- **Validação manual:** total realizado por mês bate com a query exploratória já rodada
  (jan: MRR 196k / Pont 382k; etc.), no banco local + produção.

## 11. Fora de escopo

- Não mexer nas abas Revenue, Funil, CAC, etc.
- Não re-semear orçado (reaproveita o existente).
- Não criar coluna nova no banco (`data_criado` já existe).
