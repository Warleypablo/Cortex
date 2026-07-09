# Design: LTV FAT × LTV DFC no CEO Dashboard

**Data:** 2026-07-09
**Status:** aprovado (brainstorming com Ichino)
**Escopo:** substituir a linha única "LTV" da matriz do CEO Dashboard (`/api/ceo-dashboard/matriz`) por duas linhas: LTV FAT (faturável, ClickUp) e LTV DFC (caixa, híbrido com Conta Azul).

## Problema

A linha de LTV atual é 100% teórica (`valorr × meses de vida`, mediana dos ativos, só recorrência). Queremos:
1. Contabilizar o pontual.
2. Medir o LTV com pagamentos reais (Conta Azul) onde há dados de caixa.
3. Manter a visão faturável para ler o gap faturado × caixa (inadimplência, descontos, extras).

Validação amostral (10 clientes, seed `md5(task_id)`, 2026-07-09): pago real ≈ 90–95% do teórico recorrente na janela coberta pelo `caz_parcelas` → o `valorr` do ClickUp é ticket confiável, e o caixa é viável como régua (92% da receita paga de 2026 casa via CNPJ).

## Réguas

População de ambas as linhas (inalterada): clientes **ativos no snapshot do dia 1º de cada mês** de 2026 (`cup_data_hist`, `status IN ('ativo','onboarding','triagem') AND valorr > 0`; fallback = 1º snapshot do mês). Célula = **MEDIANA** dos ativos.

### LTV FAT (faturável — ClickUp)
Por cliente (`id_task`), vida toda até o snapshot:
- Recorrente: `Σ valorr × (min(data_fim, snap) − data_inicio) / 30.44` por contrato recorrente (`vw_lt_contratos`, `data_fim = COALESCE(data_encerramento, ultimo_dia_operacao)`).
- Pontual: `Σ valorp` dos contratos pontuais (`valorp>0`, sem valorr) com `status='entregue'` e `COALESCE(data_entrega, data_criado) < snap`.

Nota: NÃO é `valorr + valorp` cru — o recorrente precisa da dimensão tempo para ser LTV.

### LTV DFC (caixa — híbrido ClickUp + Conta Azul)
Corte em **01/out/2025** (1º mês cheio do `caz_parcelas`; parcelas quitadas em 10–30/set/2025 são descartadas para não duplicar com o teórico de setembro).
- Vida pré-corte (teórico): mesma régua do FAT, capada em 30/set/2025.
- Vida pós-corte (real): `Σ valor_pago` das parcelas `tipo_evento='RECEITA'` com `data_quitacao >= 2025-10-01` e `< dia 1º do mês da célula` (teto de calendário exato, não o dia do snap), casadas via CNPJ.
- Clientes ativos sem match CNPJ (~4% dos ativos): fallback = LTV FAT do cliente.

Match CNPJ: `regexp_replace(cnpj, '\D', '', 'g')` nos dois lados + `LENGTH IN (11, 14)`; parcela↔cliente via `caz_parcelas.id_cliente::text = caz_clientes.ids`.

## Série validada em prod (2026-07-09, 0,85s)

| Mediana dos ativos | jan | fev | mar | abr | mai | jun | jul* |
|---|---|---|---|---|---|---|---|
| LTV FAT | 14.869 | 14.783 | 16.990 | 19.672 | 19.668 | 22.240 | 21.052 |
| LTV DFC | 13.196 | 15.979 | 17.366 | 20.441 | 21.850 | 23.488 | 19.492 |

Comportamentos esperados (não são bugs):
- DFC > FAT (fev–jun): o caixa captura receita fora do ClickUp (extras, reajustes); o FAT usa `valorr` atual do snapshot (downgrade apaga passado).
- Queda em julho (mês corrente, marcado `*`): mix — clientes novos sem cadastro no Conta Azul (fallback com vida curta), churn de clientes antigos de LTV alto, cliente "Projeto RF" deletado do ClickUp.
- Mediana reage a mix da população mês a mês.

## Implementação

**Abordagem escolhida: query inline no `server/routes/ceoDashboard.matriz.ts`** (padrão do arquivo), substituindo a query atual da série de LTV. Uma única query retorna `mes, ltv_fat, ltv_dfc`. SQL de referência validado em prod: `docs/superpowers/specs/2026-07-09-ltv-dfc-fat-query.sql`.

Alternativas descartadas: view no banco (exige migração local+prod sem outro consumidor — YAGNI); computar em TS (mais código, sem ganho).

### Pontos críticos da query
- **`MATERIALIZED` obrigatório nos CTEs** — sem isso o Postgres inlina e re-executa subqueries ~16k vezes (25s → 0,85s com).
- **Escape no drizzle: `'\\D'`**, nunca `'\D'` (JS engole a barra e o regex vira `'D'`, quebrando o match de CNPJ em silêncio — bug já ocorrido 2× no repo).
- `tipo_evento` é MAIÚSCULO (`'RECEITA'`).
- Sem `ILIKE` em status (`'inativo'` contém `'ativo'`); igualdade exata, status minúsculo.
- Teórico com `GREATEST(…, 0)` para não gerar LTV negativo (contratos com `data_fim < data_inicio`).

### Backend
- `ceoDashboard.matriz.ts`: substituir `ltvSeriePorMes` por `ltvFatSeriePorMes` e `ltvDfcSeriePorMes` (mesmo shape `Record<number, number>`; try/catch com log como hoje).
- `ceoDashboard.matriz.helpers.ts`: a linha `ltv` vira duas (`ltv_fat`, `ltv_dfc`), labels "LTV FAT" e "LTV DFC", unidade `brl`, `direcao: maior_melhor`.

### Frontend
- `client/src/components/ceo/CeoMatrizTabela.tsx`: duas linhas com tooltips:
  - LTV FAT: "Mediana do LTV faturável dos clientes ativos (ClickUp): Valor R × meses de vida + pontual entregue."
  - LTV DFC: "Mediana do LTV em caixa: pago real no Conta Azul desde out/2025 + faturável teórico antes disso."
- Dark/light mode: seguir padrão existente da tabela (sem cores novas).

### Fora de escopo
- Endpoint legado `/api/ceo-dashboard` (cards): mantém a régua antiga.
- Tela `/lt-ltv-churn`: inalterada.

## Limitações conhecidas (documentadas, aceitas)
- `caz_parcelas` só cobre caixa desde 10/set/2025 — por isso o híbrido, não caixa puro.
- Clientes da carga de migração (dez/2024) têm `data_criado` da carga → fatia teórica subestima a vida real dos legados.
- O DFC soma tudo que o CNPJ pagou (mesmo receita sem contrato no ClickUp) — intencional: é o caixa do cliente.
- ~8% da receita paga de 2026 não casa via CNPJ (placeholders SEM-DOC etc.) → esses clientes usam fallback FAT.

## Testes
- Unit (helpers): montagem das duas linhas a partir das séries (seguir `ceoDashboard.matriz.helpers.test.ts`).
- Validação numérica: série do endpoint local deve bater com a tabela deste doc (dados sincronizados de 2026-07-04 podem divergir marginalmente do prod).
- Browser: tabela renderiza as duas linhas em dark e light mode.
