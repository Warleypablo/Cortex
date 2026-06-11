# BP 2026 — Orçado × Realizado (Parte 12: drill-down nas 6 sub-abas)

**Data:** 2026-06-10
**Status:** Aprovado ("mesmo estilo do DRE")
**Base:** Partes 7–11 (branch `feature/bp2026-metricas-gerais`, PR #248).

## Escopo

Células clicáveis em TODAS as sub-abas (Métricas Gerais, Revenue, Funil, Capacity, SG&A, Outras Receitas), com o mesmo drawer (`BPCellDetail`) e a mesma regra do DRE: **derivadas mostram composição client-side** (linhas-fonte com orç/real/% coloridos); **fontes diretas mostram listas de itens** vindas de `/api/bp2026/detalhe` com os MESMOS predicados/queries da agregação.

## Derivadas (composição client-side — estender o mapa DERIVADAS do BPCellDetail)

| metrica | componentes |
|---|---|
| receita_total | receita_total_faturavel, inadimplencia |
| despesa_total | impostos_receita, csv_salarios, csv_beneficio, csv_stack, cac, sga, bonus, impostos_diretos, capex |
| receita_cabeca | receita_total, colaboradores |
| mrr_cabeca | mrr_ativo, colaboradores |
| ticket_cliente | mrr_ativo, clientes |
| ticket_contrato | mrr_ativo, contratos |
| aliquota_efetiva | impostos_receita, impostos_diretos, receita_total_faturavel |
| margem_geracao | geracao_caixa, receita_total_faturavel |
| aov_performance/creators/social/gc/others | mrr_X, contratos_X |
| aov_venda_mrr | funil_vendas_mrr, contratos_vendidos_mrr |
| aov_venda_pontual | funil_vendas_pontual, contratos_vendidos_pontual |
| gestores_necessarios / designers_necessarios | cap_contratos_performance |
| necessidade_gestores | gestores_necessarios, gestores_atuais |
| contratos_por_gestor | cap_contratos_performance, gestores_atuais |
| contas_por_designer | cap_contratos_performance, designers_atuais |
| sga_total_detalhe | sga_uzk, sga_backoffice, sga_software, sga_ocupacao, beneficio_total_empresa, sga_premiacoes, sga_eventos, sga_outras |
| or_total_detalhe | or_receita_variavel, or_stack_digital, or_demais |

Para resolver componentes de abas diferentes, `BPCellDetail` passa a receber `linhas` = concatenação de TODAS as coleções do payload (chaves de metrica são únicas entre abas). O servidor adiciona essas metricas à lista DERIVADAS (400, coerente com o DRE).

## Fontes diretas (listas server-side — estender o switch de `bp2026.detalhe.ts`)

| metrica(s) | Itens | grupo | realizado retornado |
|---|---|---|---|
| vendas_mrr, funil_vendas_mrr | deals Bitrix ganhos no mês com `valor_recorrente > 0` (title, closer, data, valor_recorrente) | "Vendas MRR (Bitrix)" | Σ valores |
| vendas_pontual, funil_vendas_pontual | = query existente de `receita_pontual` (alias) | idem | Σ |
| contratos_vendidos_mrr / _pontual | mesmas listas de deals | idem | **contagem** de itens |
| reunioes | deals com `data_reuniao_realizada` no mês (title, closer/sdr, data) | "Reuniões realizadas" | contagem |
| taxa_conversao | deals ganhos no mês (MRR ou pontual > 0) | "Deals ganhos (numerador)" | a taxa (= célula); nota dinâmica "÷ N reuniões no mês" |
| colaboradores | Inhire ativos no fim do mês (nome; detalhe = cargo · squad) | setor | contagem |
| pessoas_csv / cac / sgea | idem filtrado pelo mapeamento de setores da P7 | setor real | contagem |
| gestores_atuais / designers_atuais | Inhire por cargo ('Gestor de Performance'/'Designer') | squad | contagem |
| clientes | snapshot fim do mês, 1 item por cliente (SUM valorr por id_task; MRR no campo detalhe) | squad | contagem |
| contratos | snapshot por contrato (como o drill do MRR; MRR no detalhe) | squad | contagem |
| churn_mes | `vw_cup_churn_ajustado` do mês (filtros do BP; nome, motivo, valor_r) | motivo_cancelamento | Σ valor_r |
| mrr_performance/creators/social/gc/others | drill do MRR filtrado pelo MESMO `CASE_PRODUTO` da Revenue (exportar de `bp2026.revenue.ts`) | squad | Σ |
| cap_contratos_performance, contratos_performance/creators/social/gc/others | mesma lista | squad | contagem |
| churn_pct_performance/… | churns do produto no mês (`CASE_PRODUTO_CHURN` exportado) | motivo | a taxa (= célula); nota dinâmica "churn R$ X ÷ MRR R$ Y (fim do mês anterior)" |
| saldo_caixa | grupo 1 "Contas bancárias (saldo atual)": linhas de `caz_bancos` (nome/banco, balance); grupo 2 "(−) Fluxos posteriores": 1 item por mês posterior com o DFC líquido | — | valor da célula |
| sga_uzk/backoffice/software/ocupacao/premiacoes/eventos/outras | `itensDespesaBucket` com `PREDICADOS_SGA_SUB` | categoria | Σ |
| beneficio_total_empresa | `itensDespesaBucket(beneficio_total)` integral (SEM rateio — visão da aba SG&A) | categoria | Σ |
| or_receita_variavel / or_stack_digital / or_demais | query de outras receitas (competência) com `PREDICADOS_OUTRAS_SUB` | categoria | Σ |

Invariante mantida: `realizado` retornado = valor da célula (Σ para brl, contagem para int, taxa para pct — nesses dois últimos a verificação é contra a célula, não contra a soma dos itens).

## Apresentação de linhas `int` e `pct` no drawer

- Linhas **int** (contagens): itens sem coluna de valor monetário (server envia `valor: 0` e informação útil no campo `detalhe`, ex.: MRR do cliente); o total do grupo exibe a **contagem** (`itens.length` + omitidos) em vez de R$; o header usa a formatação da unidade (sem R$).
- Linhas **pct** (taxas): grupos listam os itens do numerador em R$/unidades; header mostra a taxa; `notaDinamica` do response explica o denominador.
- O header do drawer já usa a célula do payload — passa a formatar por `linha.unidade` (mesma `fmtValor` exportada do BPDreTable).

## Frontend

- `BP2026.tsx`: as 6 sub-abas ganham `onCellClick` (mesma handler `setDetalhe`); `BPCellDetail` recebe `linhas` concatenadas de todas as coleções.
- `BPCellDetail`: DERIVADAS estendido; formatação por unidade; exibição condicional de valores para int; render de `notaDinamica`.
- `BPDreTable`: nenhuma mudança (onCellClick já opcional).

## Arquitetura server

- `bp2026.detalhe.ts` estendido com handlers PARAMETRIZADOS (4 formas: deals Bitrix por tipo; pessoas Inhire por filtro; snapshot por produto/agrupamento; bucket por predicado) — sem duplicar query por métrica; `CASE_PRODUTO`/`CASE_PRODUTO_CHURN` exportados de `bp2026.revenue.ts`; mapeamento de setores importável (constante compartilhada).
- DERIVADAS do servidor = lista do DRE + as da tabela acima.
- Response ganha `notaDinamica?: string` (separada da `nota` estática da linha).
- `TODAS_DEFS` passa a incluir defs das sub-abas (título para o header em caso de fallback; o header real vem do payload da matriz).

## Erros e casos-limite

Mesmos do DRE: mês futuro → grupos vazios; derivada → 400; mês corrente parcial ok. `saldo_caixa` em mês < mesCorrente lista o grupo de fluxos posteriores; no mês corrente só as contas.

## Workflow

Mesma branch/PR #248; subagent-driven com revisão dupla; validação visual.
