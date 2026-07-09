# Design: Auditoria das células de LTV (FAT/DFC) no CEO Dashboard

**Data:** 2026-07-09
**Status:** aprovado (brainstorming com Ichino)
**Escopo:** o drill das células `ltv_fat`/`ltv_dfc` deixa de mostrar ranking "foto de hoje" e passa a **auditar o mês clicado**: população da célula, decomposição por cliente e a mediana reconciliada.

## Problema

A célula mostra a mediana dos ativos do mês M, mas o drawer mostrava um ranking com régua de hoje — números não reconciliavam e o usuário não conseguia entender como o valor da célula nasce.

## Comportamento

Ao clicar na célula de LTV (FAT ou DFC) do mês M:

1. **Header do drawer = valor da célula.** A mediana é recalculada no helper a partir das MESMAS linhas exibidas (mediana = valor central; N par = média dos 2 centrais, arredondada) — reconciliação por construção. `orcado = null` (linha sem meta). Validado em prod: junho N=213, FAT 22.240, DFC 23.488 == células.
2. **3 grupos colapsáveis com TODOS os clientes** (sem limite de itens):
   - `Acima da mediana (N₁)` — ordenado desc;
   - `Mediana` — 1 cliente (N ímpar) ou 2 (N par), grupo aberto;
   - `Abaixo da mediana (N₂)` — ordenado desc.
   Total do grupo = soma dos LTVs do grupo (informativo).
3. **Decomposição no subtexto de cada cliente** (`item.detalhe`):
   - FAT: `recorrente R$ 70,3k (R$ 6.225/mês desde 30/07/25) + pontual entregue R$ 3,0k`; com vários contratos: `(2 contratos, R$ 7,2k/mês)`; sem pontual, omite a parcela.
   - DFC com match: `teórico pré-out/25 R$ 28,1k + pago real R$ 35,2k (18 parcelas até 31/05)`; nascido pós-corte: só a parte do pago; pago zero: `sem pagamento registrado até 31/05`.
   - DFC sem match CNPJ: `sem match CNPJ → régua faturável: recorrente R$ X + pontual R$ Y`.
4. **Nota metodológica no rodapé** com os números do mês: população = ativos no snapshot de 01/M (`cup_data_hist`), régua FAT/DFC, corte 30/set/25, pago real até a entrada do mês (célula de junho conta pagamentos até 31/mai), quantos clientes usam fallback sem match.

## Implementação

- **Query única de auditoria por mês** (validada em prod, 0,5s): variante de 1 mês da query da matriz, por cliente: `nome, tem_match, valorr_snap, n_rec_snap, inicio_rec, rec_full, rec_pre, pont_full, pont_pre, pago, n_parcelas, ltv_fat, ltv_dfc`. SQL de referência: `docs/superpowers/specs/2026-07-09-ltv-auditoria-query.sql`. Mesmos invariantes da matriz: CTEs `MATERIALIZED`, `'\\D'` no drizzle, `LENGTH IN (11,14)` nos dois lados do CNPJ, `tipo_evento='RECEITA'`, cutoffs 30/set–01/out/25, pago sem filtro `status='QUITADO'` (decisão documentada no spec do LTV FAT×DFC).
- **Helper puro** `ltvAuditoriaToGrupos(rows, kpi, mesNum)` em `ceoDashboard.detalhe.helpers.ts` → `{ grupos, mediana, nSemMatch }`; toda a lógica de partição/mediana/textos testável sem banco (TDD).
- **Endpoint** `ceoDashboard.detalhe.ts`: os dois branches usam a mesma query (o `mes` já chega no request); montam grupos conforme o kpi; `base.realizado = mediana`.
- **Frontend: zero mudança** — o drawer genérico (`CeoKpiDetail`) já renderiza grupos/subtexto/nota.

## Trade-off assumido

O ranking "foto de hoje" deixa de existir no drill (a auditoria do mês o substitui; o ranking do mês é visível nos grupos ordenados). Se fizer falta, vira uma aba no futuro.

## Limitações conhecidas

- Mesmas do LTV FAT×DFC (carga dez/2024, ~8% sem match → fallback, contratos sem data_fim).
- Meses sem snapshot (futuro) → drawer vazio com nota ("Sem detalhamento para este mês"), igual comportamento atual de célula sem valor (célula nem é clicável sem valor).

## Testes

- Helper: N ímpar/par (mediana e grupo central), contagens e somas dos grupos, textos FAT single/multi contrato, DFC match/sem match/pago zero/nascido pós-corte, rows vazio.
- Reconciliação real: célula da matriz × header do drawer para jan e jun (psql/tsx local).
