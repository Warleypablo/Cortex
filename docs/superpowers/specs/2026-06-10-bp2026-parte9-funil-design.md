# BP 2026 — Orçado × Realizado (Parte 9: sub-aba Funil Comercial)

**Data:** 2026-06-10
**Status:** Aprovado (carta branca)
**Base:** Partes 7–8 (mesma branch `feature/bp2026-metricas-gerais`, PR #248). Quarta sub-aba.

## Escopo e limitação aceita

Sub-aba **"Funil Comercial"** com o funil de vendas agregado vs metas da aba CAC. **A quebra de vendas por produto da planilha NÃO entra**: o campo `produtos` do Bitrix é lista de IDs multi-valor sem split de valor por deal e os prefixos de título são inconsistentes — registrado como melhoria futura (exige registro de valor por produto no CRM). `category_name` é único ("Geral") — novas × monetização também não separável.

## Linhas (8)

| Linha | metrica | Unidade | Direção | Orçado | Realizado |
|---|---|---|---|---|---|
| Vendas MRR (**destaque**) | `funil_vendas_mrr` | brl | maior | reuso `vendas_mrr` (Overview, seedado) | reuso série Bitrix `valor_recorrente` |
| Vendas Pontual (**destaque**) | `funil_vendas_pontual` | brl | maior | reuso `vendas_pontual` | reuso série Bitrix `valor_pontual` |
| Contratos vendidos — MRR | `contratos_vendidos_mrr` | int | maior | derivado: `vendas_mrr_orc ÷ aov_venda_mrr_orc` | COUNT deals ganhos com `valor_recorrente > 0` no mês |
| Contratos vendidos — Pontual | `contratos_vendidos_pontual` | int | maior | derivado: `vendas_pontual_orc ÷ aov_venda_pontual_orc` | COUNT deals com `valor_pontual > 0` |
| AOV de venda — MRR | `aov_venda_mrr` | brl | maior | seed aba CAC linha 70 (R$ 4.290) | vendas ÷ contratos vendidos |
| AOV de venda — Pontual | `aov_venda_pontual` | brl | maior | seed linha 69 (R$ 9.840) | idem |
| Reuniões realizadas | `reunioes` | int | maior | seed linha 72 ("Reuniões Necessárias", 197,4→290,5) | COUNT `data_reuniao_realizada` no mês (qualquer deal) |
| Taxa de conversão | `taxa_conversao` | pct | maior | seed linha 71 (**0,275**) | deals ganhos no mês (MRR ou pontual > 0) ÷ reuniões realizadas no mês |

Posições na aba CAC: labels coluna P (16), valores jan..dez = colunas Q..AB (17..28) → `col_inicial=17`. Anti-drift: aov_venda_pontual 118080; aov_venda_mrr 51480; taxa_conversao 3.3; reunioes_necessarias 2918.7741306.

Notas em tooltip: taxa de conversão ("deals ganhos ÷ reuniões realizadas no mesmo mês — aproximação de coorte; um deal pode fechar em mês diferente da reunião"); na linha de Vendas MRR, nota da limitação ("quebra por produto indisponível — o CRM não registra valor por produto").

## YTDs
- Somas (fluxo): vendas, contratos vendidos, reuniões.
- Razões de agregados: AOVs (Σ vendas ÷ Σ contratos; orçado idem), taxa de conversão (Σ ganhos ÷ Σ reuniões; orçado = média ponderada pelas reuniões necessárias).

## Arquitetura
- Seed: +4 métricas (`aov_venda_mrr`, `aov_venda_pontual`, `taxa_conversao`, `reunioes_necessarias`) da aba CAC com `col_inicial=17` (mecanismo da Parte 8). Total 56 métricas.
- `server/routes/bp2026.funil.ts` (novo, padrão dos módulos 7–8): `montarFunil({db, orcado, vendasMrrPorMes, pontualPorMes, mesCorrente, mesFechado})`; 1 query nova (contagens por mês: deals ganhos MRR, deals ganhos pontual, deals ganhos qualquer, reuniões realizadas — uma query com FILTER); derivadas null-safe.
  - As séries `vendasMrrPorMes` (hoje interna ao `bp2026.metricas.ts`) e `pontualPorMes` precisam fluir do handler: a query de vendas MRR sobe para o `bp2026.ts` (ou o metricas exporta) — decisão de implementação: **mover a query de vendas MRR para `bp2026.ts`** ao lado da de pontual e passar a série aos dois módulos (metricas e funil), eliminando duplicação.
- Payload: `funil: LinhaReceita[]`; 4ª tab "Funil Comercial" no frontend (sem onCellClick). Zero mudança no BPDreTable.

## Erros e casos-limite
- Mês sem reuniões → taxa null (divisão por zero protegida); contagens `?? 0` em mês iniciado; meses futuros null.

## Workflow
Mesma branch/PR #248; subagent-driven com revisão; validação visual dark/light.
