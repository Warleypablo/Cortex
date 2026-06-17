# BP 2026 — Movimento de Estoque (Ponte do MRR + Aba Pontual)

**Data:** 2026-06-17
**Status:** Design aprovado — aguardando plano de implementação
**Módulo:** BP 2026 (Orçado × Realizado), rota `/bp-2026`

## Contexto e objetivo

O BP 2026 hoje mostra MRR/churn por produto na aba **Revenue** como posições e taxas,
mas não mostra o **movimento** do estoque de um mês para o outro (a "ponte"). O pedido tem
duas frentes independentes:

1. **Revenue (recorrente):** adicionar a ponte do MRR mês a mês — `(=) Estoque inicial →
   (+) Vendas → (−) Churn → (=) Estoque final` — com coluna consolidada (YTD) no fim.
2. **Nova aba Pontual (100% pontual, sem nada de recorrente):** ponte do estoque de contratos
   pontuais — `(=) Estoque inicial → (+) Venda → (−) Entrega → (−) Churn → (=) Estoque final`
   — mais a decomposição do estoque final por status (Em execução, Triagem, Pausado, Onboarding,
   Em cancelamento).

## Decisões (brainstorming 2026-06-17)

| Tema | Decisão |
|------|---------|
| Ponte recorrente | Ponte completa do MRR (estoque inicial → vendas → churn → estoque final) |
| `( ) Pausado, Triagem` no pontual | Decompor o **estoque final** por status (linhas informativas), não movimento |
| Granularidade (ambas) | **Total consolidado** (sem quebra por produto/segmento) |
| Orçado × Realizado | **Só realizado** nas duas pontes (sem coluna de orçado/atingimento) |
| Local da view pontual | **Nova 10ª sub-aba** no BP 2026, reusando `BPDreTable` |
| Linha "Δ não explicado" (recorrente) | **Mostrar** (a ponte só fecha com ela; expõe o vazamento de MRR) |
| Linha "Ajustes" (pontual) | **Detalhar** em Deletados + Saída atípica + Reajuste de valor |

## Frente 1 — Ponte do MRR na aba Revenue

Bloco novo **"Ponte do MRR"** no topo da aba Revenue (acima da tabela por produto que já existe),
consolidado, **só realizado**. Todas as séries já são calculadas hoje no backend; é montagem,
não cálculo novo.

### Linhas (consolidado, mensal + YTD)

| Linha | Sinal | Fonte | tipoAgregacao |
|-------|-------|-------|---------------|
| (=) MRR inicial | + | MRR ativo do mês anterior (`cup_data_hist`); jan usa MRR de dez/2025 (`mrrDez25`, já calculado em `metricas.ts`) | estoque |
| (+) Vendas MRR | + | Bitrix `crm_deal` ganho, `valor_recorrente` (`vendasMrrPorMes`, já no handler) | fluxo |
| (−) Churn | − | `vw_cup_churn_ajustado` bruto (`churnPorMes`, já calculado) | fluxo |
| (±) Δ não explicado | ± | `mrr_delta_nao_explicado` (já existe em `metricas.ts`): downgrades, reajustes, vendas não ativadas | fluxo |
| **(=) MRR final** | + | MRR ativo do mês (`mrr_ativo`) | estoque |

### Por que a linha Δ é obrigatória

MRR inicial (snapshot), Vendas (Bitrix) e Churn (view) vêm de **bases diferentes**, então
`inicial + vendas − churn ≠ final`. A diferença (~R$240k/mês, YTD ~649k) é MRR que vazou sem
virar churn declarado. A linha Δ absorve essa diferença para a ponte fechar exato e, de quebra,
torna o vazamento visível (é informação de negócio valiosa).

**Identidade (sinais para a soma vertical fechar):**
`MRR inicial + Vendas − Churn + Δ = MRR final`, onde `Δ = MRR final − MRR inicial − Vendas + Churn`
(negativo quando houve vazamento). Obs.: a métrica `mrr_delta_nao_explicado` da aba Métricas guarda
o sinal oposto (`inicial + vendas − churn − final`); na ponte exibimos o valor negado para a coluna somar.

## Frente 2 — Nova aba Pontual

Nova sub-aba **"Pontual"** (10ª), consolidada, **só realizado**, via **snapshot-diff** de
`"Clickup".cup_data_hist`. Validado contra produção: a ponte **fecha exato**.

### Definição de estoque pontual (canônica, já usada em `/estoque-pontual`)

```
valorp > 0 AND status NOT IN ('entregue','cancelado/inativo','não usar')
```

### Método snapshot-diff (por mês m = 1..mesCorrente)

- `snap_atual` = `MAX(data_snapshot)` do mês m; `snap_ant` = `MAX(data_snapshot)` do mês m−1
  (para m=1, mês anterior = dez/2025, snapshot 2025-12-27).
- Classifica cada `id_subtask` pela transição entre o **estoque** em `snap_ant` e em `snap_atual`:

| Categoria | Critério | Sinal |
|-----------|----------|-------|
| Estoque inicial | em estoque(ant) | base + |
| Venda | em estoque(atual) e NÃO em estoque(ant) | + |
| Entrega | em estoque(ant), saiu, `status(atual) = 'entregue'` | − |
| Churn | em estoque(ant), saiu, `status(atual) IN ('cancelado/inativo','não usar')` | − |
| Deletados | em estoque(ant), não aparece no `snap_atual` | − |
| Saída atípica | em estoque(ant), aparece no `snap_atual` mas saiu por outro motivo (ex.: `valorp` virou 0) | − |
| Reajuste de valor | em estoque(ant) **e** estoque(atual): `Σ(valorp_atual − valorp_ant)` | ± |
| Estoque final | em estoque(atual) | base + |

**Identidade validada (abr→mai/2026, produção):**
`1.929.268 + 609.388 − 575.982 − 157.302 − 19.200 − 1.194 + 7.285 = 1.792.263` = estoque final ✓

### Linhas da aba (ordem)

1. (=) Estoque inicial — estoque
2. (+) Venda — fluxo
3. (−) Entrega — fluxo
4. (−) Churn — fluxo
5. (−) Deletados — fluxo
6. (−) Saída atípica — fluxo
7. (+) Reajuste de valor — fluxo
8. **(=) Estoque final** — estoque (destaque)
9. · Em execução (status `ativo`) — estoque
10. · Triagem — estoque
11. · Pausado — estoque
12. · Onboarding — estoque
13. · Em cancelamento — estoque

Saídas (3–6) armazenadas como **valores negativos** para a coluna somar verticalmente até o
estoque final. Linhas 9–13 são a decomposição do estoque final (somam ao estoque final), exibidas
com recuo/discretas. Validado mai/2026: ativo 979.641 · triagem 554.762 · pausado 195.377 ·
onboarding 59.485 · em cancelamento 2.997 (= 1.792.262, bate com estoque final).

### Nota da aba (exibida via tooltip, padrão do BP)

> "Venda" aqui é a **entrada no estoque** (contratos pontuais que passaram a constar no snapshot do
> ClickUp), medida por diferença de snapshots — **não** é o "Vendas Pontual" do Bitrix mostrado em
> outras abas (bases diferentes). Esta visão é só realizado; o mês corrente é parcial (último
> snapshot disponível).

## Mudanças de componente

`BPDreTable` ganha prop **`mostrarOrcado?: boolean`** (default `true`, retrocompatível). Quando
`false`:
- a `Celula` exibe **só o realizado** (esconde linha de orçado e de atingimento);
- desliga a lógica `naoOrcado` (que hoje pintaria "não orç." vermelho em tudo sem orçado);
- o sub-rótulo do cabeçalho "realizado · orçado · ating." vira só "realizado".

Usado pela aba Pontual e pelo bloco Ponte do MRR.

## Arquivos afetados

**Backend**
- `server/routes/bp2026.pontual.ts` *(novo)* — `montarPontual({ db, mesCorrente, mesFechado })`,
  retorna `BPLinha[]` (ponte + decomposição) via snapshot-diff.
- `server/routes/bp2026.revenue.ts` — montar o bloco Ponte do MRR (recebe `vendasMrrPorMes`,
  `churnPorMes`/série de churn, `mrrDez25`, série `mrr_ativo`, `mrr_delta`), retornado em campo próprio.
- `server/routes/bp2026.ts` — chamar `montarPontual`; passar deps da ponte ao `montarRevenue`;
  adicionar `pontual` e `ponteMrr` ao payload `ReceitasResponse`. Reaproveitar `vendasMrrPorMes`,
  `churnPorMes`, `mrrDez25` já computados (evitar query duplicada).
- `server/routes/bp2026.info.ts` — entradas em `INFO_METRICAS` para cada métrica nova
  (obrigatório pelo padrão do módulo: toda métrica nova precisa de info).

**Frontend**
- `client/src/components/bp2026/BPDreTable.tsx` — prop `mostrarOrcado`.
- `client/src/pages/BP2026.tsx` — campos `ponteMrr`/`pontual` na interface; aba Revenue passa a
  renderizar a Ponte do MRR (`mostrarOrcado={false}`) acima da tabela atual; nova `TabsTrigger`
  "Pontual" + `TabsContent` com `BPDreTable mostrarOrcado={false}`.

## Drill-down (auditabilidade) — adicionado em 2026-06-17 a pedido do Warley

As células das duas views abrem o mesmo drawer de detalhe das outras abas
(`/api/bp2026/detalhe` + `BPCellDetail`). Mapeamento:
- **Ponte MRR:** `ponte_mrr_ini` → contratos ativos no snapshot do mês anterior; `ponte_mrr_vendas`
  → deals MRR ganhos no Bitrix (= `vendas_mrr`); `ponte_mrr_churn` → itens de churn bruto (= `churn_rs_total`);
  `ponte_mrr_fim` → contratos ativos no snapshot do mês (= `mrr_ativo`); `ponte_mrr_delta` →
  **derivada** (composição client-side das 4 linhas, igual ao `mrr_delta_nao_explicado`, pois é resíduo).
- **Pontual:** `pontual_estoque_ini`/`estoque_fim`/`status_*` → contratos em estoque no snapshot
  (anterior/atual/por status); `pontual_venda`/`entrega`/`churn`/`deletados`/`saida_atipica`/`reajuste`
  → os contratos que se moveram naquela categoria no mês (via snapshot-diff, com nome do cliente).

Nome do cliente: `LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = h.id_task` (a coluna
`cup_data_hist.cliente` está vazia; o join cobre 100%). A lógica de classificação por categoria é
single-source no helper (`classificarPonteItens` em `bp2026.pontual.helpers.ts`).

## Fora de escopo (YAGNI)

- Quebra por produto/segmento (decidido: consolidado).
- Comparação com orçado nas pontes (decidido: só realizado).
- Mexer na view `vw_cup_churn_ajustado` ou no módulo `/estoque-pontual` existente.

## Validação

- **Identidade da ponte pontual** deve fechar para cada mês fechado (jan–mai), usando valores
  absolutos com sinais explícitos:
  `estoque_ini + venda − entrega − churn − deletados − saída_atípica + reajuste = estoque_fim`.
- **Decomposição por status** deve somar ao estoque final de cada mês.
- **Ponte recorrente** deve fechar: `MRR inicial + Vendas − Churn + Δ = MRR final`.
- Conferir contra **produção** (`dados_turbo`) — local fica defasado em churn/snapshot do mês corrente.
- Teste mínimo: helper de classificação snapshot-diff (entrada: dois conjuntos de `{id_subtask, valorp, status}` → categorias).

## Gotchas

- `cup_data_hist` **não** tem `data_criado`/`data_entrega` (essas estão em `cup_contratos`); a ponte
  usa exclusivamente `id_subtask`/`status`/`valorp`/`data_snapshot` do histórico.
- Dez/2025 tem **um único snapshot** (27/12) — é a base da ponte de janeiro (recorrente e pontual).
- Mês corrente (jun) tem snapshot parcial (até dia 17) — o módulo já trata `mesCorrente` vs `mesFechado`.
- `'cancelado/inativo'` e `'não usar'` são valores de status exatos (lista/igualdade, nunca ILIKE).
- `'em cancelamento'` **conta como estoque** (não está na lista de exclusão) — aparece na decomposição.
- Mudanças de schema/seed, se houver, aplicar em **local e prod** (não há mudança de schema prevista).
