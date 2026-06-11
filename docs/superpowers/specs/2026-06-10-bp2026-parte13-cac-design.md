# BP 2026 — Orçado × Realizado (Parte 13: sub-aba CAC)

**Data:** 2026-06-10
**Status:** Aprovado
**Base:** Partes 7–12 (branch `feature/bp2026-metricas-gerais`, PR #248). Oitava sub-aba.

## Escopo

Sub-aba **"CAC"** com o detalhamento do custo de aquisição (bloco esquerdo da aba CAC da planilha, linhas 7–15), no padrão da sub-aba SG&A (Parte 11) + drill (Parte 12). 11 linhas:

| Linha | metrica | Orçado (aba CAC, col C..N) | Realizado (caixa) — predicado |
|---|---|---|---|
| CAC total (**destaque**) | `cac_total_detalhe` | derivado: soma das 10 | derivado: soma das 10 |
| Pré Vendas | `cac_pre_vendas` | linha 7 | `06.04.03%` |
| Vendas | `cac_vendas` | linha 8 | `06.04.02%` |
| Gerência | `cac_gerencia` | linha 9 | `06.04.01%` |
| Comissões | `cac_comissoes` | linha 10 | `06.04.04% OR 06.04.05%` (inclui Indique e Ganhe) |
| Growth | `cac_growth` | linha 11 | `06.06.02%` |
| ADs | `cac_ads` | linha 12 | `06.06.01%` |
| Eventos | `cac_eventos` | linha 13 | `06.07.01%` |
| Brindes | `cac_brindes` | linha 14 | `06.07.02%` |
| Viagens | `cac_viagens` | linha 15 | `05.04.02% OR 06.05.04%` |
| Outras comerciais (não orçadas) | `cac_outras_sub` | 0 (sem seed) | `06.05.05% OR 06.07.03%` |

Todas `menor_melhor`, brl, fluxo, regime caixa (mesmo `somaDespesaCaixaPorMes`). Notas: no total — "Soma das sub-linhas comerciais — deve bater com a linha CAC do DRE (mesmos prefixos de categoria)"; em Comissões — "inclui Indique e Ganhe (06.04.05)"; em Outras — "Categorias que entram no CAC do DRE mas não têm linha no BP (Outras Despesas Comerciais, Patrocínios)".

**Invariante:** união dos 11 predicados ⊆ predicado `cac` do DRE; validar no smoke `cac_total_detalhe ≡ célula cac do DRE` em todos os meses ≤ mesCorrente (hoje a união cobre 100% do realizado — categorias novas futuras dentro de 06.04/06.06/06.07 fora das enumeradas apareceriam como divergência; o smoke pega).

Sanity planilha (extraído 2026-06-10): soma das 9 sub-linhas = linha 6 "(=) CAC" exata nos 12 meses (4.449.113,71).

## Seed
+9 métricas (aba "CAC", linhas 7–15, col default 3): anti-drift cac_pre_vendas 439200, cac_vendas 410600, cac_gerencia 255000, cac_comissoes 953313.70653, cac_growth 396000, cac_ads 1360000, cac_eventos 380000, cac_brindes 195000, cac_viagens 60000. Total: 82 métricas.

## API
- `bp2026.predicados.ts`: +`PREDICADOS_CAC_SUB` (10 chaves: as 9 + `cac_outras_sub`).
- `bp2026.detalhamentos.ts`: `montarDetalhamentos` passa a devolver também `cac: Linha[]` — mesma mecânica do SG&A (loop sobre defs com `somaDespesaCaixaPorMes`, total derivado por soma; `cac_outras_sub` com orçado fixo 0).
- `bp2026.detalhe.ts`: sub-linhas roteiam para `itensDespesaBucket` com `PREDICADOS_CAC_SUB` (mesmo branch-pattern do SGA_SUB); `cac_total_detalhe` entra em DERIVADAS (server 400 + composição client-side).
- Payload: `cacDetalhe`.

## Frontend
- 8ª tab "CAC" entre SG&A e Outras Receitas, com onCellClick; `cacDetalhe` na concatenação do BPCellDetail; DERIVADAS client += `cac_total_detalhe: [as 10 sub]`.

## Workflow
Mesma branch/PR #248; subagent-driven com revisão; visual dark/light.
