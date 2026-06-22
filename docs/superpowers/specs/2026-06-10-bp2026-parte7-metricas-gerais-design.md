# BP 2026 — Orçado × Realizado (Parte 7: Métricas Gerais como sub-aba)

**Data:** 2026-06-10
**Status:** Aprovado
**Base:** Partes 1–6 mergeadas na main (squash `d20ca07b`). Branch nova `feature/bp2026-metricas-gerais` a partir da main.

## Escopo

Sub-aba **"Métricas Gerais"** na página `/bp-2026` (Tabs: DRE | Métricas Gerais), espelhando o bloco Métricas Gerais da planilha (aba Overview, linhas 25–45), na mesma matriz anual orçado × realizado × atingimento.

Linhas (18), na ordem da planilha:

| Linha | Overview | Unidade | Direção | Realizado |
|---|---|---|---|---|
| Receita Total | 25 | brl | maior | derivada: faturável − inadimplência (séries do DRE) |
| Despesa Total | 26 | brl | menor | derivada: impostos + CSVs + CAC + SG&A + bônus + IR + CAPEX |
| Vendas MRR | 27 | brl | maior | Bitrix `valor_recorrente` de deals ganhos no mês (validado: jan 273.531) |
| Vendas Pontual | 28 | brl | maior | série existente `pontualPorMes` (orçado próprio: 270k jan ≠ 240k da receita) |
| Número de Colaboradores | 29 | int | **neutro** | Inhire `rh_pessoal` ativos no fim do mês (validado: jan 109, mai 112) |
| Receita Cabeça | 30 | brl | maior | derivada: receita_total / colaboradores |
| MRR Cabeça | 31 | brl | maior | derivada: mrr / colaboradores |
| Número de Clientes | 32 | int | maior | `cup_data_hist` snapshot fim do mês, COUNT(DISTINCT id_task) (validado: mai 315) |
| Número de Contratos | 33 | int | maior | idem, COUNT(DISTINCT id_subtask) (mai 529) — extensão da query de snapshot do MRR |
| Ticket Médio Cliente | 34 | brl | maior | derivada: mrr / clientes |
| Ticket Médio Contratos | 35 | brl | maior | derivada: mrr / contratos |
| Churn Mês | 36 | brl | menor | `cortex_core.vw_cup_churn_ajustado`: solicitação de encerramento no mês, não abonado, motivos ('Inadimplente 1º Mês','Não começou','Erro na Venda') excluídos, valor_r > 0 (validado: jan 162.431) |
| Alíquota Imposto Efetiva | 37 | pct | menor | derivada: (impostos s/ receita + impostos diretos) / faturável |
| Margem de Geração | 39 | pct | maior | derivada: geração de caixa / faturável |
| Saldo de Caixa | 40 | brl | maior | reconstrução retroativa: saldo atual (`caz_bancos`, R$ 1.739.443 hoje) − Σ fluxos quitados dos meses posteriores (reusa a série do DFC). **Nota**: aproximação; não captura ajustes manuais de conta. |
| Pessoas em CSV | 43 | int | neutro | Inhire por setor: Commerce + Tech Sites |
| Pessoas em CAC | 44 | int | neutro | Growth Interno |
| Pessoas em SGEA | 45 | int | neutro | Backoffice + Sócios. **Nota nas 3 linhas**: mapeamento aproximado — o time comercial está dentro de Commerce no Inhire (CAC subcontado vs conceito do BP). |

Não entram: Geração de Caixa (38; já está no DRE) e o Número de Colaboradores duplicado (42 = 29).

## Decisões (aprovadas)

- **Arquitetura:** o endpoint existente `/api/bp2026/receitas` ganha o bloco `metricasGerais: LinhaReceita[]` no payload, montado por `montarMetricasGerais(deps)` em arquivo novo `server/routes/bp2026.metricas.ts` — recebe as séries já computadas do DRE (mrr, pontual, faturável, inadimplência+estornos, impostos, CSVs, CAC, SG&A, bônus, IR, CAPEX, geração, dfc) e executa apenas as 4 consultas novas (vendas MRR, colaboradores+pessoas/área, clientes/contratos via extensão da query MRR, churn, saldo atual). Sem endpoint novo; uma chamada alimenta as duas abas.
- **Unidade por linha:** `unidade: "brl" | "int" | "pct"` em `DefLinha`/payload; frontend formata (int sem R$; pct = fração × 100 com 1 casa).
- **Direção `neutro`:** novo valor em `Direcao`; atingimento renderiza em cinza.
- **Sub-aba sem drill** (Parte 8 se necessário); células não clicáveis na aba Métricas Gerais.
- **Percentuais no seed como fração** (0.1641…), como na planilha.

## Mudanças

### Seed
- +18 métricas (linhas/nomes acima; chaves: `receita_total`, `despesa_total`, `vendas_mrr`, `vendas_pontual`, `colaboradores`, `receita_cabeca`, `mrr_cabeca`, `clientes`, `contratos`, `ticket_cliente`, `ticket_contrato`, `churn_mes`, `aliquota_efetiva`, `margem_geracao`, `saldo_caixa`, `pessoas_csv`, `pessoas_cac`, `pessoas_sgea`). Totais anti-drift: somas das linhas correspondentes da planilha (o plano fixa os valores extraídos). Para `aliquota_efetiva` e `margem_geracao` o "total" da planilha é média/valor anual — anti-drift usa a SOMA das 12 frações (calculada na escrita do plano).
- Aplicar em local e produção (32 métricas × 12).

### API
- `server/routes/bp2026.metricas.ts` (novo): `montarMetricasGerais(db, orcado, series, mesCorrente, mesFechado)` → `LinhaReceita[]` com ytd por linha (mesma regra: meses fechados; estoque para colaboradores/clientes/contratos/saldo/pessoas — são posições, não fluxos; per-capita/tickets/alíquota/margem YTD = recalculo sobre os agregados YTD, não média).
- `bp2026.ts`: passa as séries; payload ganha `metricasGerais`. `Direcao` ganha `"neutro"`. `DefLinha`/`LinhaReceita` ganham `unidade` (default `brl`).
- Queries novas: vendas MRR (Bitrix); colaboradores + pessoas por área (Inhire, 1 query com CASE de setor por mês via generate_series); clientes/contratos (estender a query de snapshot do MRR para devolver os 2 counts); churn (vw_cup_churn_ajustado); saldo atual (caz_bancos) + reconstrução com a série DFC.

### Frontend
- `BP2026.tsx`: Tabs (shadcn) "DRE" | "Métricas Gerais"; segunda aba renderiza `BPDreTable` com `linhas={data.metricasGerais}` e sem `onCellClick`.
- `BPDreTable`: `onCellClick` vira opcional (sem clique quando ausente); `BPLinha.unidade?`; formatação por unidade; cor cinza para direção `neutro`; nenhuma linha de "total" nesta aba (ehTotal não se aplica).

### YTD — semântica por linha
- Fluxo (soma): receita_total, despesa_total, vendas_mrr, vendas_pontual, churn_mes.
- Estoque (último mês fechado): colaboradores, clientes, contratos, saldo_caixa, pessoas_*.
- Razões (recalculadas sobre YTD): receita_cabeca, mrr_cabeca, ticket_cliente, ticket_contrato, aliquota_efetiva, margem_geracao — derivadas dos agregados YTD dos componentes (não média de percentuais mensais). Implementação: essas linhas têm `ytdDerivado` calculado no `montarMetricasGerais` a partir dos YTDs dos componentes.

## Erros e casos-limite
- Divisões por zero nas derivadas → null (via `calcAtingimento`/`ratear`-like guards).
- Mês corrente: colaboradores/clientes/contratos/saldo usam a posição mais recente (parcial como nas demais); vendas/churn parciais `?? 0`.
- Snapshot ausente no fim do mês: mesma resolução MAX(d) do MRR.

## Validação executada (produção, 2026-06-10)
Vendas MRR jan–mai: 273.531 / 214.663 / 259.517 / 239.945 / 281.908. Headcount jan 109 (= orçado), mai 112. Clientes/contratos mai: 315 / 529. Churn jan–mai: 162.431 / 96.408 / 115.178 / 126.730 / 120.345. Saldo atual: 1.739.443. Setores Inhire: Commerce 85, Tech Sites 10, Backoffice 7, Growth Interno 7, Sócios 3.

## Workflow
Worktree `bp2026-metricas-gerais` (branch da main pós-#247). Subagent-driven; PR novo para a main; validação visual dark/light.
