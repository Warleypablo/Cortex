# BP 2026 — Decompor a "Venda" do movimento de estoque pontual

**Data:** 2026-06-22
**Aba:** BP 2026 → Orçado × Realizado → Pontual ("Movimento do estoque de contratos pontuais")
**Tipo:** Melhoria de modelagem/transparência (não é bugfix — a ponte sempre fechou)

## Problema

A linha **"(+) Venda"** do quadro "Movimento do estoque de contratos pontuais" não mede venda
comercial. Ela mede *entrada na foto do estoque* — contratos que passaram a constar no último
snapshot do mês (`"Clickup".cup_data_hist`), medida por diferença entre snapshots. Isso mistura
coisas de naturezas diferentes numa única linha rotulada "Venda".

Decomposição real auditada em produção (2026-06-22):

| Mês | Venda (tabela) | Venda real do mês¹ | Entrada defasada² | Reativação³ | Sem origem⁴ |
|-----|---------------:|-------------------:|------------------:|------------:|------------:|
| Jan | 398.584 | 363.528 | 35.056 | – | – |
| Fev | 355.568 | 338.077 | 11.994 | 5.497 | – |
| Mar | 380.308 | 282.017 | 91.491 | 2.800 | 4.000 |
| **Abr** | **1.103.483** | **514.240** | **562.043** | 8.000 | 19.200 |
| Mai | 609.388 | 522.803 | 84.085 | – | 2.500 |
| Jun | 810.281 | 590.162 | 213.122 | 6.997 | – |

¹ `data_criado` no próprio mês · ² `data_criado` em mês anterior · ³ voltou de entregue/cancelado ·
⁴ está na foto mas sem registro em `cup_contratos`

O pico de abril (1,1 M) é **51% entrada defasada** — vendas de meses anteriores que só apareceram no
snapshot em abril. Isso é o "isso aqui é loucura" reportado pelo usuário: a linha "Venda" inflada por
atraso da foto, não por venda.

### Por que não basta "fazer bater" com a Receita Pontual da Visão Geral

São réguas estruturalmente diferentes e nunca batem sozinhas:

- **Visão Geral / Receita Pontual** = `cup_contratos` por `data_criado` (fato comercial — quando o
  contrato nasceu). Fonte: `bp2026.vendasProduto.ts` (`carregarVendasProdutoClickup`).
- **Movimento de estoque** = `cup_data_hist`, foto do estoque (defasada ~1 mês). Fonte:
  `bp2026.pontual.ts` + `bp2026.pontual.helpers.ts`.

Ex.: março — Receita Pontual VG = 954 k, mas só 282 k apareceu no estoque até 31/03 (o resto entrou
em abril). Forçar a "Venda" do estoque a usar `data_criado` exigiria uma linha de "plug" para a ponte
fechar, quebrando a pureza da conta de estoque.

## Decisão

**Decompor a entrada da foto**, mantendo a régua do estoque (snapshot). A ponte continua fechando sem
plug; a linha "Venda" total permanece idêntica, apenas ganha 4 sub-linhas que explicam de que é feita.

Decisões registradas no brainstorming:
1. **Semântica:** decompor a entrada da foto (manter régua do estoque). [não trocar para `data_criado`]
2. **Layout:** linha-mãe `(+) Venda` (total + YTD) com sub-linhas indentadas `·` — mesmo padrão do
   "Estoque final".
3. **Sem `data_criado`:** bucket próprio (`· Sem origem`), não dissolvido em "Entrada defasada".

## Estrutura-alvo da tabela

```
(=) Estoque inicial
(+) Venda                    ← total (= soma das 4 sub-linhas), clicável (drill = todas as entradas)
   · Venda do mês            ← data_criado no próprio mês  (venda real)
   · Entrada defasada        ← data_criado em mês anterior (vendido antes, foto atrasou)
   · Reativação              ← voltou de "entregue/cancelado" ao estoque
   · Sem origem              ← na foto mas sem registro em cup_contratos (só aparece se houver valor)
(−) Entrega
(−) Churn
(−) Deletados
(−) Saída atípica
(±) Reajuste de valor
(=) Estoque final
   · Em execução (ativo) / Triagem / Pausado / Onboarding / Em cancelamento
```

Identidade contábil preservada: `estoque_ini + Venda − Entrega − Churn − Deletados − Saída_atípica
+ Reajuste = estoque_fim`. A `Venda` total não muda — `vendaMes + entradaDefasada + reativacao +
semOrigem = venda`.

## Classificação (árvore de decisão)

Para cada `id_subtask` que **está no estoque do snapshot atual e não estava no estoque do anterior**
(definição atual de "venda" em `classificarPonte`):

1. Estava na foto anterior (`cup_data_hist`, `valorp>0`) mas **fora do estoque** (status
   entregue/cancelado/não-usar)? → **Reativação**
2. Senão, **sem registro** em `cup_contratos` (`data_criado` nulo)? → **Sem origem**
3. Senão, `data_criado` é do **próprio mês** (ano 2026, mês == mês-alvo)? → **Venda do mês**
4. Senão (`data_criado` de mês anterior, ou futura) → **Entrada defasada**

Regras:
- **Reativação tem precedência** sobre a data: um contrato reativado pode ter `data_criado` de meses
  atrás, mas é retorno ao estoque, não venda nova.
- Mês-alvo = o mês do snapshot atual (`m`, 1–12, ano 2026). `m=0` (dez/2025) só é base, nunca atual.
- `data_criado` é lida de `cup_contratos` (fonte viva) via `id_subtask`, **não** do campo do snapshot
  (que já se corrompeu em janelas de falha de pipeline — ver memória `reference_bp2026_mrr_produto_reclassif`).

## Arquitetura da mudança

### Camada de dados
- `bp2026.pontual.ts` (`montarPontual`): a query do snapshot passa a trazer `data_criado` via
  `LEFT JOIN "Clickup".cup_contratos c ON c.id_subtask = h.id_subtask`.
- `bp2026.detalhe.ts` (`carregaPontualSnapshot`): mesmo join, para o drill conseguir reclassificar.

### Tipos e lógica pura (`bp2026.pontual.helpers.ts`)
- `RegPontual` ganha `mesCriado: number | null` e `anoCriado: number | null` (derivados de
  `data_criado`).
- `PonteMes` ganha `vendaMes`, `entradaDefasada`, `reativacao`, `semOrigem`. `venda` permanece como
  total (= soma dos 4), preservando a linha-mãe e seu YTD.
- `classificarPonte(ant, atual, mesAlvo)`: nova assinatura com `mesAlvo`; o ramo de "venda" aplica a
  árvore de decisão acima.
- `classificarPonteItens(ant, atual, mesAlvo)`: novo `mesAlvo`; o `Record` passa a emitir
  `venda_mes`, `entrada_defasada`, `reativacao`, `sem_origem` (além de entrega/churn/...). A linha-mãe
  `venda` é a concatenação das 4 subcategorias.
- `montarLinhasPontual`: insere as 4 sub-linhas logo após `(+) Venda`. `· Sem origem` só entra quando
  há valor em algum mês (mesmo padrão defensivo da linha "· Outros status").

### Drill-down (`bp2026.detalhe.ts`)
- Novas métricas roteadas: `pontual_venda_mes`, `pontual_entrada_defasada`, `pontual_reativacao`,
  `pontual_sem_origem` → `detPontualMovimento(db, mes, <categoria>)`.
- `pontual_venda` (linha-mãe) continua → drill com todas as entradas (concatenação).
- `TITULOS_SUBABAS` e `TITULO_CATEGORIA`: novos rótulos.
- `detPontualMovimento` passa `mesAlvo` para `classificarPonteItens`.

### Frontend (`client/src/components/bp2026/BPDreTable.tsx`)
- Esperado: **nenhuma mudança** — sub-linhas com título iniciado em "·" já são indentadas (igual ao
  "Estoque final"). Confirmar na implementação; se a indentação depender de outra marca, ajustar.

### Notas/tooltips
- A nota de `(+) Venda` deixa explícito: "entrada na foto do estoque (snapshot), não a venda comercial
  da Visão Geral — veja a decomposição abaixo".
- Cada sub-linha ganha tooltip com sua régua (definições da árvore de decisão).

## Testes (`bp2026.pontual.helpers.test.ts`)
- Casos cobrindo cada sub-categoria (venda do mês, defasada, reativação, sem origem).
- Invariante: `vendaMes + entradaDefasada + reativacao + semOrigem === venda` (total).
- Invariante: a ponte continua fechando (`estoque_ini + venda − saídas + reajuste === estoque_fim`).
- Atualizar o teste "soma dos itens por categoria casa" para as novas categorias (drill × célula).
- Precedência reativação > data (contrato reativado com `data_criado` antigo conta como reativação).

## Edge cases
- `data_criado` futura (depois do mês do snapshot): raríssimo; cai em "Entrada defasada" (não é venda
  do mês). Aceitável.
- `id_subtask` sem registro em `cup_contratos`: "Sem origem".
- Contrato com `valorp=0` no snapshot anterior (não entra no `porMes`, filtrado por `valorp>0`):
  tratado como entrada nova → classificado por `data_criado` (venda do mês ou defasada). Coerente.

## Fora de escopo
- Não alterar a "Receita Pontual" da Visão Geral nem a aba "Vendas por Produto".
- Não criar reconciliação/plug entre as duas réguas (decisão explícita de NÃO trocar a fonte).

---

## ADENDO (2026-06-22, pós-validação visual) — "venda tem que bater com venda"

Após ver a feature pronta, o usuário apontou que a decomposição **não resolveu** o pedido original:
nenhuma linha da aba de estoque bate com a "Receita Pontual" de Vendas por Produto — nem `· Venda do
mês`, porque o snapshot exclui contratos criados no mês que já saíram da foto (entregues no mês) ou que
ainda não entraram (lag). Ex. confirmado em prod: março — Receita Pontual = 954.344, mas só 282.017 é
"venda do mês na foto"; os 672.327 restantes não estão no estoque de 31/03.

**Nova decisão (aprovada):** separar os dois conceitos em **dois blocos** na aba Pontual, cada um com
nome e nota próprios, e a **Venda batendo com a Venda sempre**:

### Bloco 1 — "Venda Pontual (comercial)"
- Linha `(+) Venda Pontual` (metrica `pontual_venda_comercial`), grupo `"Venda Pontual (comercial)"`.
- Fonte: `cup_contratos` por `data_criado`, `SUM(valorp)`, `status <> 'não usar'`, `valorp > 0` —
  **idêntica** à Receita Pontual da Visão Geral → bate 100%, independente da situação.
- Drill: lista os contratos pontuais criados no mês (por produto/cliente).
- Nota: "Quanto foi vendido no mês (data de criação do contrato). Igual a Vendas por Produto."

### Bloco 2 — "Movimento do estoque (foto do ClickUp)"
- As linhas de estoque já existentes ganham grupo `"Movimento do estoque (foto do ClickUp)"`.
- A linha-mãe `(+) Venda` é **renomeada** para `(+) Entrada no estoque` (metrica passa a
  `pontual_entrada`; drill continua concatenando as 4 sub-linhas via `SUBCATS_VENDA`).
- Sub-linhas (`· Venda do mês / · Entrada defasada / · Reativação / · Sem origem`) e o resto da ponte
  permanecem como implementado nas Tasks 1–3 (régua de snapshot, ponte fecha).
- Nota: "O que entrou/saiu da foto do estoque. Difere da venda pela defasagem do snapshot."

### Implementação do adendo
- `LinhaPontual` ganha `grupo?: string`; `montarLinhasPontual` recebe `vendaComercialPorMes:
  Record<number, number>` e emite o bloco 1 + aplica `grupo` aos dois blocos + renomeia a linha-mãe.
- `bp2026.pontual.ts`: nova query da venda comercial por mês (mesmas regras da Receita Pontual).
- `bp2026.detalhe.ts`: rótulos/roteamento — `pontual_entrada` (era `pontual_venda`) e
  `pontual_venda_comercial` (novo handler que lista contratos por `data_criado`).
- `BP2026.tsx`: nota explicando os dois blocos. `BPDreTable` já renderiza headers por `grupo`.
- O `BPDreTable` renderiza um header de bloco quando `grupo` muda (não é mudança no componente).

---

## ADENDO 2 (2026-06-22) — uma única linha de Venda + Ajuste (sem dois blocos)

O usuário pediu **uma só linha de venda** (não a comercial + "venda do mês" do estoque) e o restante
numa categoria de ajuste. Estrutura final (ponte única, sem grupos):

```
(=) Estoque inicial
(+) Venda Pontual              = venda comercial (data_criado) = Vendas por Produto  [única venda]
(±) Ajuste estoque × venda     = entrada na foto (B) − venda comercial (A)            [reconciliação]
    · Entrada defasada         (+)
    · Reativação               (+)
    · Sem origem               (+)  (condicional)
    · Venda do mês fora da foto (−) = vendaMes − A  (venda do mês que ainda não entrou na foto)
(−) Entrega / Churn / Deletados / Saída atípica / (±) Reajuste de valor
(=) Estoque final  (· status…)
```

- Identidade: `Estoque inicial + Venda + Ajuste − Entrega − Churn − Deletados − Saída atípica
  + Reajuste = Estoque final` (pois `Venda(A) + Ajuste(B−A) = B`, a entrada real na foto).
- `· Ajuste` e `· Venda do mês fora da foto` são derivadas → `semDetalhe` (sem drill). As demais
  sub-linhas (defasada/reativação/sem origem) mantêm drill no snapshot; a Venda Pontual abre os
  contratos por produto (data_criado).
- Removidos: linha separada `pontual_venda_comercial` em bloco próprio, `pontual_entrada`/`(+) Entrada
  no estoque`, `· Venda do mês`, os grupos `GRUPO_VENDA/GRUPO_ESTOQUE` e `SUBCATS_VENDA`.
- Métricas novas: `pontual_ajuste`, `pontual_venda_fora_foto` (ambas `semDetalhe`). `pontual_venda_comercial`
  permanece como a linha de venda (drill por produto).

---

## ADENDO 3 (2026-06-22) — decompor a própria Venda (auditável), sem cruzar réguas

A linha "Venda do mês fora da foto" (Adendo 2) não era auditável: era `A(valor atual) −
vendaMes(valor do snapshot)`, subtração de duas réguas de valor → não corresponde a lista de
contratos (ex.: jan a lista real soma 71k, mas a linha mostrava −19k pela mudança de valor).

**Decisão final (aprovada):** não cruzar réguas. Dois blocos:

### Bloco "Venda Pontual (comercial)" — tudo na régua de cup_contratos (valor atual)
```
(+) Venda Pontual        = A (= Vendas por Produto)      [drill por produto]
   · Entrou no estoque    = A ∩ estoque do snapshot fim do mês   [drill]
   · Fora do estoque      = A − (A ∩ estoque)                    [drill]
```
`Entrou + Fora = Venda Pontual` exato (mesma régua) → auditável. Validado em prod (mar:
280.823 + 673.521 = 954.344; drill Fora=673.521 por produto).

### Bloco "Movimento do estoque (foto do ClickUp)" — régua do snapshot, fecha sozinho
```
(=) Estoque inicial
(+) Entrada na foto       = B (drill: novos do mês + defasada + reativação + sem origem)
(−) Entrega / Churn / Deletados / Saída atípica / (±) Reajuste
(=) Estoque final  (· status…)
```

### Implementação
- `montarLinhasPontual(porMes, mesCorrente, mesFechado, vendaComercialPorMes, vendaNoEstoquePorMes)`.
- `bp2026.pontual.ts`: query da venda traz `id_subtask`; cruza com o estoque do snapshot (Set por mês)
  para `vendaNoEstoquePorMes`.
- `bp2026.detalhe.ts`: `detVendaPorEstoque(db, mes, dentro)` (drill entrou/fora); `pontual_entrada`
  drilla `CATS_ENTRADA` (novos+defasada+reativação+sem origem).
- Removidos: `pontual_ajuste`, `pontual_venda_fora_foto`, `GRUPO_*` antigos não usados.
