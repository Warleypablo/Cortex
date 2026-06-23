# BP 2026 — Expandir linhas da aba Pontual por produto (toggle ▶)

**Data:** 2026-06-23
**Aba:** BP 2026 → Orçado × Realizado → Pontual
**Tipo:** Nova interação (expand/collapse por produto) + suporte no BPDreTable

## Objetivo

Permitir **expandir** 4 linhas principais da aba Pontual para ver sua composição **por produto**
(Creators, Ecommerce, Performance, …), via um toggle ▶/▼ em cada linha.

## Decisões (brainstorming)
1. **Modo:** expandir por linha (cada linha tem seu toggle; abre/fecha sob demanda; começa fechado).
2. **Linhas com toggle:** `(+) Venda Pontual`, `(+) Entrada na foto`, `(−) Entrega`, `(=) Estoque final`.
3. **Fonte do produto:** Venda → `cup_contratos.produto`; Entrada/Entrega/Estoque → `produto` do snapshot
   (96% preenchido; resto = `(sem produto)`).
4. **Filtro <10K:** produtos com < R$ 10K no mês corrente agregam em `· Outros (< R$ 10K)`; soma das
   sub-linhas = a linha-pai (reusa `SQUAD_MIN_EXIBIR`).
5. **Drill:** sub-linha de produto é clicável → lista os contratos daquele produto na categoria/mês.

## Comportamento

Cada linha-pai expansível mostra um ▶ (fechado) / ▼ (aberto) antes do título. Ao abrir, aparecem as
sub-linhas por produto (com `· `), com série mensal completa daquela métrica. A soma das sub-linhas
de cada mês = valor da linha-pai naquele mês.

## Arquitetura

### `bp2026.pontual.helpers.ts`
- `RegPontual` ganha `produto?: string`.
- `LinhaPontual` ganha `expansivel?: boolean` e `paiMetrica?: string`.
- `decomporProduto(regs): Record<string, number>` — SUM `valorp` por produto, só do estoque
  (análogo a `decomporSquad`; produto vazio → `(sem produto)`).
- `classificarPontePorProduto(ant, atual): { entrada: Record<string,number>; entrega: Record<string,number> }`
  — mesma classificação de `classificarPonte`, agregando por produto (entrada = contratos que
  (re)entraram no estoque; entrega = contratos que viraram `entregue`).
- `montarLinhasPontual(..., vendaPorProdutoPorMes)`:
  - marca as 4 linhas-pai com `expansivel: true`;
  - emite as sub-linhas por produto logo após cada pai, com `paiMetrica = <metrica do pai>`,
    aplicando o filtro <10K → `· Outros` (helper genérico `montarSubLinhasProduto`).
  - Pais e fontes:
    - `pontual_venda_comercial` → `vendaPorProdutoPorMes` (cup_contratos).
    - `pontual_entrada` → `classificarPontePorProduto(...).entrada` por mês.
    - `pontual_entrega` → `classificarPontePorProduto(...).entrega` por mês.
    - `pontual_estoque_fim` → `decomporProduto(porMes[m])` por mês.

### `bp2026.pontual.ts`
- Query do snapshot traz `COALESCE(NULLIF(TRIM(h.produto),''),'(sem produto)') AS produto`.
- Nova query: venda por produto × mês = `cup_contratos` por `data_criado`, `SUM(valorp)` por produto.

### `bp2026.detalhe.ts`
- Métrica de sub-linha: `pontual_prod:<pai>:<produto>` → drill filtrado por produto:
  - pai `venda_comercial` → `detVendaPontualComercial` filtrado por produto.
  - pai `entrada`/`entrega` → `detPontualMovimento` da categoria, filtrado por produto.
  - pai `estoque_fim` → `detPontualSnapshot` filtrado por produto.
- Gate `conhecida` reconhece `metrica.startsWith("pontual_prod:")`; título derivado.

### `client/src/components/bp2026/BPDreTable.tsx`
- `BPLinha` ganha `expansivel?: boolean` e `paiMetrica?: string`.
- Estado `expandidas: Set<string>` (métricas-pai abertas). Linha `expansivel` mostra ▶/▼ clicável que
  alterna o set (não dispara drill). Linha com `paiMetrica` só renderiza se `paiMetrica ∈ expandidas`.
- Opt-in: linhas sem `expansivel`/`paiMetrica` não mudam → outras abas do BP intactas.

## Testes (`bp2026.pontual.helpers.test.ts`)
- `decomporProduto`: soma por produto, só estoque, produto vazio → `(sem produto)`.
- `classificarPontePorProduto`: entrada/entrega por produto batem com `classificarPonte` (soma).
- `montarLinhasPontual`: 4 pais com `expansivel`; sub-linhas com `paiMetrica` corretas; soma das
  sub-linhas (incl. `· Outros`) = linha-pai; filtro <10K.

## Edge cases
- Produto do snapshot corrompido em janelas antigas (memória `reference_bp2026_mrr_produto_reclassif`):
  já houve backfill; 96% fill atual. Itens sem produto → `(sem produto)`.
- Filtro <10K por mês corrente (igual squad), para a sub-linha de cada pai independentemente.

## Fora de escopo
- Demais linhas (Churn, Deletados, Saída atípica, Reajuste, Estoque inicial, status, squad) NÃO ganham
  toggle por produto agora.
- Não alterar a lógica/valores das linhas-pai — só adicionar a decomposição expansível.
