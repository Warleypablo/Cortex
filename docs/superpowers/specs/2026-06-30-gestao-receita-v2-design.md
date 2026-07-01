# Gestão de Receita v2 — ajustes Macro/Micro/Funil

**Data:** 2026-06-30 · **Rota:** `/gestao/receita` · **Status:** aprovado · Entrega em **2 fases**

## Decisões aprovadas
- **Metas editáveis:** camada de override própria (`cortex_core.gestao_receita_metas`), não toca no BP.
- **Conversão:** por coorte (nunca >100%).
- **Inbound/Outbound:** por `source` (régua do `growth.ts`).
- **Funil:** inclui investimento + CPL (Meta Ads + Conta Azul).

## FASE 1 — Metas editáveis + métricas Macro/Micro
### Backend
- Tabela `cortex_core.gestao_receita_metas(id, chave, ano, mes, valor, updated_by, updated_at)`, UNIQUE(chave,ano,mes). Init em `db.ts` (CREATE IF NOT EXISTS → cria em local+prod no boot).
- `PUT /api/gestao/receita/metas` — batch upsert `{ ano, mes, metas: [{chave, valor}] }`.
- No `/api/gestao/receita`: orçado final = `override[chave] ?? BP[chave]`. Chaves: `venda_mrr`, `venda_pontual`, `prod_tm_mrr:<produto>`, `prod_ctr_mrr:<produto>`, `prod_tm_pont:<produto>`, `prod_ctr_pont:<produto>`.
- Conversão por coorte:
  - reunião→venda = deals com `data_reuniao_realizada` no mês E `stage='Negócio Ganho'` ÷ deals com reunião no mês.
  - lead→reunião = deals `date_create` no mês com `data_reuniao_realizada IS NOT NULL` ÷ deals criados no mês.
- Novos campos: macro `{ ticketMrr, ticketPontual, taxaConversao, numReunioes }`; closers `+ ticket, conv`; sdrs `+ conv` (mrr/pont já existem).

### Frontend
- Macro: cards Ticket Médio MRR / Pontual, Taxa de Conversão, Nº de Reuniões; metas de Venda MRR/Pontual editáveis (input inline + "Salvar metas").
- Micro: produto em 2 tabelas (MRR / Pontual); TM e nº contratos editáveis por produto (valor orçado = TM×contratos); vendedor + ticket/conv; SDR + conv + valor MRR/Pontual separado.

## FASE 2 — Funil inbound/outbound + investimento/CPL
- Dois funis (inbound, outbound): Lead→RA→RR→Venda + MQL/NMQL + conversões por coorte.
- Tabela investimento + CPL + CPL-MQ por canal (Meta Ads spend + custos Conta Azul 06.06). Se ambiente sem Meta Ads → "sem dados".

## Drill-down
Novos elementos clicáveis reusam o Sheet (`gestaoReceita.detalhe.ts`).

## Notas
- Metas editáveis exigem auth de escrita (endpoint PUT protegido pelo isAuthenticated global).
- Ticket médio macro = venda ÷ nº deals do tipo (Bitrix).
