# Design — Tela de Aprofundamento: Creators Pontual

**Data:** 2026-06-02
**Status:** Aprovado (brainstorming)
**Autor:** Warleypablo + Claude

---

## 1. Objetivo

Tela `/creators-pontual` (grupo Gestão) para **aprofundar no produto Creators pontual** — o maior item do estoque de pontual (R$ 1,0M, 53% do valor). Objetivo: **diagnosticar por que o estoque não para de crescer**, cruzando **vendas (entrada)**, **produtividade de entrega do operador (saída)** e o **gargalo de início de produção**.

Acessível por item de menu próprio e por um link "Creators" a partir da tela de Estoque de Pontual.

## 2. Achados da investigação (produção, 2026-06-02)

Filtro base de Creators: `produto ILIKE '%creators%' AND valorp > 0`. Estoque em aberto: `+ status NOT IN ('entregue','cancelado/inativo','não usar')`.

- **Estoque atual:** 147 contratos / **R$ 1.000.924** · ticket médio R$ 6.809 · idade média 51d. Creators = **53% do valor** de todo o estoque pontual.
- **Funil por status (o gargalo):** triagem **78 itens / R$ 544.458 (54%)** · ativo 50 / R$ 334k · onboarding 10 / R$ 76k · pausado 9 / R$ 46k. **Mais da metade do valor está parado em triagem — vendido mas a produção nem começou.**
- **Entrada × saída mensal** (qtd, criados × entregues): jan 31/19 · fev 30/28 · **mar 109/27** · abr 45/28 · mai 58/46. Março explodiu em vendas; a entrega não acompanhou. Entradas seguem > saídas, então o estoque continua subindo.
- **Produtividade por operador** (`responsavel`, com `trim()`): Mariana Dalto 35 abertos/R$223k (21 entregues, ciclo 52d) · Larissa Farias 34/R$274k (13 entregues, ciclo 67d — sobrecarregada/lenta) · Debora Mund 18 abertos mas **48 entregues** (alto throughput) · Ana Clara 20 · Victor Klein 10 · Julia Manhães 10.
- **Série histórica corrigida** (`ILIKE '%creator%'` em `cup_data_hist`): nov R$243k · dez R$273k · **jan R$43k (anomalia de retagueamento)** · fev R$281k · mar R$302k · **abr R$761k · mai R$925k · jun R$905k**. O salto real abr→mai vem das vendas de março/abril que entraram no estoque e não saíram.

### Esclarecimento da hipótese do crescimento
O salto NÃO foi esvaziamento da receita recorrente (recorrente ficou estável ~3/mês). Foi **(a)** pico de **vendas pontuais reais em março** (109 = 3,6× fev) somado a **(b)** retagueamento de contratos compostos ("Performance; Creators Pontual") que distorce a série em jan. O motor estrutural é o **gargalo de início**: 54% do valor nunca sai da triagem.

## 3. Limites dos dados (gaps — não prometer o que não existe)

- **Sem time tracking / horas:** `cup_tasks.time_spent` vazio em 100%. Produtividade = **throughput + tempo de ciclo + carga**, nunca horas/eficiência por pessoa.
- **Sem tempo-em-status:** `cup_status_history` tem 0 match com Creators e está stale. Não dá "quanto tempo em cada etapa".
- **Sem SLA/due_date:** "atraso" só derivável de aging (`CURRENT_DATE - data_criado`).
- **Operador (`responsavel`) ≠ CS (`cs_responsavel`) ≠ Creator externo:** a tela usa **`responsavel`** como operador (decisão do usuário). Creator externo é seção à parte (v2).
- **22% das vendas sem vendedor** (100 de 462; R$ 323k em 2026): o ranking de vendedores exibe "(sem vendedor)" e a ressalva.
- **Higienização obrigatória:** `trim()` em `vendedor` e `responsavel` (trailing spaces, 263 casos). Série histórica via `ILIKE '%creator%'` (capta compostos antigos), não `'%creators%'` limpo.
- **Margem (v2):** custo pago ao creator (~R$200) vem de `cortex_core.contratos_creators`; o join `contratos_creators.cliente_task_id = cup_contratos.id_task` faz **fan-out** (1 task = vários creators) — agregar valor do cliente com `DISTINCT id_task`.

## 4. Tabelas-chave e joins

- **Núcleo:** `"Clickup".cup_contratos` — estoque, vendas (`vendedor`), entregas (`responsavel`, `data_entrega`), `status`, `valorp`, `squad`, `produto`, `id_task`, `id_subtask`, `data_criado`. **Sem coluna `id`.**
- **Cliente:** `cup_contratos.id_task = "Clickup".cup_clientes.task_id` → `nome`, `cnpj`.
- **Histórico:** `"Clickup".cup_data_hist` (snapshots; mesma estrutura + `data_snapshot`). Série via `ILIKE '%creator%'`, último snapshot de cada mês.
- **Creator externo (v2):** `cup_contratos.id_task = cortex_core.contratos_creators.cliente_task_id` → `contratos_creators.creator_id = cortex_core.creators.id`. Volume por `qtd_videos`; custo pago ao creator em `contratos_creators` (validar coluna no plano).

## 5. Arquitetura

### Backend
Módulo novo `server/routes/creatorsPontual.ts` exportando `registerCreatorsPontualRoutes(app, db)`, registrado em `server/routes.ts`. Padrão: `db.execute(sql\`...\`)`, error handling `[api]` + 500, testes Vitest+supertest com mock de `../db`.

Constante de filtro: `CREATORS = sql\`produto ILIKE '%creators%' AND valorp > 0\``. Estoque: `+ status NOT IN ('entregue','cancelado/inativo','não usar')`.

**Endpoints** (todos sob `/api/creators-pontual`):
- `GET /overview` → `{ valorEstoque, qtdItens, ticketMedio, idadeMedia, valorTriagem, pctTriagem }`
- `GET /funil` → `{ status: [{ status, qtd, valor }] }` (ordenado por valor desc)
- `GET /fluxo?meses=8` → `{ serie: [{ mes, entradas, valEntrada, entregas, valEntregue }] }` (entradas por `data_criado`, entregas por `data_entrega`; só Creators)
- `GET /evolucao?meses=8` → `{ serie: [{ mes, valorEstoque, qtdEstoque }] }` (de `cup_data_hist`, `ILIKE '%creator%'`, último snapshot/mês)
- `GET /operadores` → `{ operadores: [{ operador, aberto, valAberto, entregue, cicloMedioDias, idadeBacklogDias }] }` (`trim(responsavel)`, exclui vazio; ciclo só de entregues com `data_entrega >= data_criado`)
- `GET /vendedores` → `{ vendedores: [{ vendedor, qtd, valor }], semVendedor: { qtd, valor } }` (`trim(vendedor)`; vazio agregado em semVendedor)
- `GET /vendas-mensal?meses=8` → `{ serie: [{ mes, qtd, valor }] }` (vendas = `data_criado`, só Creators, valorp>0)
- `GET /itens?status=&operador=&page=` → tabela paginada: `{ total, page, pageSize, itens: [{ idSubtask, nomeCliente, produto, squad, operador, vendedor, valor, idadeDias, status }] }` (join cliente; ordenado por idade desc)
- **v2:** `GET /creators-externos` → `{ creators: [{ creator, contratos, qtdVideos, custoTotal, valorCobrado, margem }] }`

### Frontend
Página `client/src/pages/CreatorsPontual.tsx` + componentes em `client/src/components/creators-pontual/`. Rota em `App.tsx` (wouter + lazyWithRetry), item de menu em `shared/nav-config.ts` (grupo Gestão, permission key `GESTAO.CREATORS_PONTUAL`, ícone `Clapperboard`). Link cruzado a partir de `EstoquePontual` (linha "Creators" da tabela por produto → `/creators-pontual`). Dark/light, Recharts, React Query — padrão idêntico ao módulo `estoque-pontual`.

## 6. Estrutura da página

1. **KPIs:** Valor em estoque · Itens · Ticket médio · **Parado em triagem (R$ + %)** · Idade média
2. **Entrada × Saída** (ComposedChart): vendas (entradas) × entregas (saídas) + linha de saldo, mensal, só Creators (reusa o padrão de FluxoMensal do estoque, com toggle qtd/valor). Nota do retagueamento.
3. **Funil por status** (BarChart horizontal ou tabela): destaca o R$ 544k travado em triagem.
4. **Produtividade do operador** (tabela): operador · carga aberta (qtd+R$) · entregas (throughput) · ciclo médio (d) · idade do backlog. Ordenável; destaque para sobrecarregados/lentos.
5. **Vendas** (ranking + evolução): tabela de vendedores (qtd+R$) e LineChart de vendas/mês. Ressalva "(sem vendedor) 22%".
6. **Creators externos + margem** (v2): top produtores, volume, custo vs valor cobrado → margem.
7. **Tabela detalhada:** itens em aberto (cliente, produto, squad, operador, vendedor, valor, idade, status), filtros status/operador, ordenada por idade desc.

## 7. Faseamento

- **v1 (núcleo do diagnóstico):** seções 1, 2, 3, 4, 5, 7 + endpoints overview, funil, fluxo, evolucao, operadores, vendedores, vendas-mensal, itens. Rota + menu + link do estoque.
- **v2 (margem):** seção 6 + endpoint creators-externos (requer validar coluna de custo e tratar fan-out do join).

## 8. Edge cases / qualidade

- `trim()` em `vendedor` e `responsavel` sempre (trailing spaces).
- Série histórica: `ILIKE '%creator%'`; anomalia de jan/2026 (retagueamento) sinalizada com nota no gráfico, não "corrigida" artificialmente.
- Ciclo de entrega: excluir `data_entrega < data_criado` (4 casos de backfill) e entregues sem `data_entrega` (5 casos) do cálculo de média.
- Vendas sem vendedor: agregar em "(sem vendedor)", nunca dropar silenciosamente.
- `squad` NULL → "(sem squad)" (4 itens / R$ 22k).
- `status` `'inativo'` contém `'ativo'` — usar lista/igualdade exata, nunca ILIKE em status.
- Estoque vs Creators total: confirmar soma do funil = overview (147 / R$ 1,0M).

## 9. Testes

- Endpoints com mock de `db.execute` (Vitest + supertest): shape + casos de borda (trim aplicado, semVendedor agregado, ciclo ignora datas inválidas).
- Helpers puros (se houver — ex. cálculo de % triagem, faixas) testados isoladamente.
- Sanidade vs investigação: estoque ≈ R$ 1,0M / 147 itens; triagem ≈ 54%; pico de entradas em março.

## 10. Próximos passos

1. Aprovação deste design.
2. `writing-plans` → plano de implementação (v1).
3. Implementar endpoints → página → testes → validação E2E.
