# Design — Análise de Estoque de Produtos Pontuais

**Data:** 2026-06-02
**Status:** Aprovação pendente
**Autor:** Warleypablo + Claude

---

## 1. Objetivo

Criar uma página no Cortex para **gerenciar o estoque de produtos pontuais** (entregas avulsas vendidas mas ainda não entregues) e **diagnosticar seu crescimento**. O estoque quase dobrou em 2 meses (R$ 1,0M → R$ 1,9M) e precisa de gestão.

Dois objetivos (definidos no brainstorming):
- **Gestão operacional** — acompanhar e priorizar as entregas pendentes (o que está parado, por quem, há quanto tempo).
- **Diagnóstico do crescimento** — entender por que o estoque cresceu (produto, squad, venda vs entrega).

## 2. Achados da investigação (produção)

### Definição de "estoque"
**Estoque = contratos com `valorp > 0` e `status NOT IN ('entregue','cancelado/inativo','não usar')`** — ou seja, pontual vendido, não entregue e não cancelado. Hoje: **232 itens, R$ 1,9M**.

### O estoque cresceu — e foi por VENDA, não por falta de entrega
Fluxo mensal (entradas = pontuais criados; saídas = entregues por `data_entrega`):

| Mês | Entradas | Entregas | Saldo |
|---|---|---|---|
| nov–fev | 35–59 | 42–57 | ~equilibrado |
| **mar** | **139** (R$ 954k) | 54 | **+85** |
| abr | 90 | 44 | +46 |
| mai | 101 | 87 | +14 |

Março teve um pico de vendas pontuais (139 vs ~55 normal); a entrega (~50–87/mês) não acompanhou. Maio já reequilibra.

### Concentração (gestão operacional)
- 🏛️ Olimpo: 76 itens, R$ 528k · 🖥️ Tech: 34, R$ 475k (idade 63d — gargalo) · ✨ Aura: 56, R$ 360k
- Aging: maioria recente (0–90d, ~R$ 1,46M); ~36 itens com 90+ dias (~R$ 407k).

### Dados disponíveis
`cup_contratos` tem tudo para o estoque atual: `valorp`, `status`, `produto`, `squad`, `responsavel`/`cs_responsavel`, `data_criado`, `data_entrega`, `id_task` (→ nome do cliente via `cup_clientes`). A `vw_lt_contratos` **não** tem `data_criado`/`data_entrega`, então o estoque consulta `cup_contratos` direto. A evolução histórica usa `cup_data_hist` (snapshots, tem `valorp` e `status`, mas **não** `data_entrega`).

## 3. Definições (fechadas)

| Conceito | Regra |
|---|---|
| **Estoque (em aberto)** | `valorp > 0` AND `status NOT IN ('entregue','cancelado/inativo','não usar')` |
| **Idade** | `CURRENT_DATE - data_criado` (dias) |
| **Envelhecido** | idade ≥ 90 dias |
| **Entrada (mês)** | pontual criado no mês (`date_trunc('month', data_criado)`) |
| **Entrega (mês)** | pontual com `data_entrega` no mês |
| **Estoque histórico (snapshot)** | no snapshot do mês: `valorp>0 AND status NOT IN ('entregue','cancelado/inativo','não usar')` |

## 4. Arquitetura

### Camada SQL / Backend
Módulo novo `server/routes/estoquePontual.ts` exportando `registerEstoquePontualRoutes(app, db)`, registrado em `server/routes.ts`. Padrão do projeto: `db.execute(sql\`...\`)`, `isAuthenticated`, error handling `[api]` + 500. Endpoints:

- `GET /api/estoque-pontual/overview` → `{ valorEstoque, qtdItens, idadeMedia, qtdEnvelhecidos, valorEnvelhecidos }`
- `GET /api/estoque-pontual/evolucao?meses=8` → série mensal: `{ serie: [{ mes, valorEstoque, qtdEstoque }] }` (de `cup_data_hist`)
- `GET /api/estoque-pontual/fluxo?meses=8` → `{ serie: [{ mes, entradas, valEntrada, entregas, valEntregue }] }` (de `cup_contratos` por `data_criado`/`data_entrega`)
- `GET /api/estoque-pontual/por-produto` → `{ produtos: [{ produto, qtd, valor, idadeMedia }] }`
- `GET /api/estoque-pontual/por-squad` → `{ squads: [{ squad, qtd, valor, idadeMedia }] }`
- `GET /api/estoque-pontual/aging` → `{ buckets: [{ faixa, qtd, valor }] }` (0-30, 30-90, 90-180, 180-365, +365)
- `GET /api/estoque-pontual/itens?produto=&squad=&page=` → tabela paginada: `{ total, itens: [{ idSubtask, nomeCliente, produto, squad, responsavel, valor, idadeDias, status }] }` ordenada por idade DESC

### Frontend (React + Recharts)
Página `client/src/pages/EstoquePontual.tsx` + componentes em `client/src/components/estoque-pontual/`. Rota em `App.tsx` (wouter + lazyWithRetry), item de menu em `shared/nav-config.ts` (grupo Gestão). Dark/light obrigatório, React Query, padrões existentes.

## 5. Estrutura da página `/estoque-pontual`

1. **Cards (KPIs):** Valor em estoque · Itens em aberto · Idade média · Envelhecidos 90+ dias (qtd · R$)
2. **Diagnóstico:**
   - Evolução do estoque (LineChart, valor/mês)
   - Fluxo mensal: entradas (vendas) × entregas (BarChart agrupado)
3. **Distribuição:**
   - Por produto (tabela: qtd, valor, idade média)
   - Por squad (tabela: qtd, valor, idade média)
   - Aging (BarChart por faixa de idade)
4. **Tabela de gestão:** itens em aberto (cliente, produto, valor, idade, squad, responsável, status), ordenada por idade DESC, com filtros produto/squad. A lista acionável para destravar entregas.

## 6. Faseamento

- **v1 (núcleo):** cards + evolução + fluxo entrada/saída + por produto + por squad + tabela de gestão.
- **v2 (enriquecimento):** aging chart detalhado, alertas de SLA (itens > X dias), drill por responsável individual, exportação CSV.

## 7. Edge cases / qualidade
- `data_criado` pode ter as mesmas inconsistências do dashboard LTV (datas de migração 2025-01-02/03). Idade negativa (data_criado futura) → tratar como 0 ou excluir; reportar.
- `cup_data_hist` não tem `data_entrega` → a evolução do estoque usa `status` (não `data_entrega`); coerente.
- `squad`/`responsavel` podem ser NULL → agrupar como "(sem squad)".
- Contratos "ambos" (valorr>0 E valorp>0): incluídos se valorp>0; o status reflete o recorrente — aceitável (poucos casos), documentar.
- Status `'inativo'` contém `'ativo'` — usar igualdade/lista exata, nunca ILIKE.

## 8. Testes
- Endpoints com mock de `db.execute` (Vitest + supertest), shape + casos de borda.
- Helpers puros (cálculo de faixas de aging, % se houver) testados isoladamente.
- Sanidade vs investigação: estoque ≈ R$ 1,9M / 232 itens; pico de entradas em março.

## 9. Riscos
- Idade depende de `data_criado` (qualidade do ClickUp).
- Evolução do estoque limitada a snapshots desde nov/2025 (~7 meses).
- `data_entrega` cobre 638 de 1057 pontuais (60%) — o fluxo de "entregas" subestima onde a data não foi preenchida.

## 10. Próximos passos
1. Aprovação deste design.
2. `writing-plans` → plano de implementação (v1).
3. Implementar endpoints → página → testes.
