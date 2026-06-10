# BP 2026 — Orçado × Realizado (Parte 5: Impostos Diretos, CAPEX e Geração de Caixa)

**Data:** 2026-06-10
**Status:** Aprovado
**Base:** Partes 1–4 (specs `2026-06-10-bp2026-*.md`). Fecha o DRE (17 linhas).

## Escopo

Três linhas novas após `(=) EBITDA`:

| Linha | Orçado total 2026 | Tipo |
|---|---|---|
| (−) IR + CSLL + ICMS + DIFAL | R$ 2.583.102 | persistida (linha 19 da aba Overview), métrica `impostos_diretos` |
| (−) CAPEX | R$ 420.000 (35k/mês) | persistida (linha 20), métrica `capex` |
| (=) Geração de Caixa | derivada mensal | EBITDA − impostos diretos − CAPEX |

Conferência: jan orçado = 238.731 − 99.529 − 35.000 = 104.203 ✓. O bug da coluna Total da Overview (não subtrai Bônus no EBITDA) propaga-se à Geração anual da planilha (mostra R$ 4.594.256; o consistente é R$ 4.494.256, como na aba oculta) — nossa derivação mensal produz o valor consistente.

**Fora de escopo:** bloco Métricas Gerais (vendas, headcount, clientes/contratos, churn) — eventual Parte 6, com design próprio (não é cascata de DRE).

## Decisões (aprovadas pelo usuário)

| Decisão | Escolha |
|---|---|
| Impostos diretos realizado | Caixa: `06.12%` (ICMS/DIFAL) + `06.13%` + `08.01%` (vazias hoje — capturam quando lançadas). **Achado da investigação: não há NENHUM pagamento de IRPJ/CSLL lançado no Conta Azul em 2026** (jan realizado R$ 2.265 vs R$ 99.529 orçados; IRRF retido já está na Parte 2). Nota em tooltip: atingimento baixo = lacuna de lançamento, não economia. |
| CAPEX realizado | Caixa: `06.11%` (computadores + conserto de ativo). Compras em lote (mar R$ 72.603) contra orçado linear — YTD é a comparação justa (R$ 105k vs R$ 175k). |
| Geração de Caixa | Derivada via `subtrairMeses(ebitdaMeses, …)`, `maior_melhor`, destaque de total, **nota**: "Enquanto IRPJ/CSLL não forem lançados no Conta Azul, o realizado desta linha fica superestimado." |
| Direções | impostos_diretos/capex `menor_melhor`. |

## Validação executada (produção, 2026-06-10, caixa)

| Mês | Impostos diretos (06.12+06.13+08.01) | CAPEX (06.11) |
|---|---|---|
| Jan | 2.265 | 1.582 |
| Fev | 216 | 17.113 |
| Mar | 297 | 72.603 |
| Abr | 347 | 202 |
| Mai | 1.263 | 13.852 |

## Mudanças

### Seed (`scripts/seed-bp2026-orcado.py`)
- `LINHAS` += Overview 19→`impostos_diretos`, 20→`capex`. Anti-drift: 2.583.101,7 e 420.000. (14 métricas × 12.)

### API (`server/routes/bp2026.ts`)
- 2 queries via `somaDespesaCaixaPorMes` (predicados acima).
- `realizadoPorMetrica`: ambas com `?? 0`.
- `LINHAS_POS_EBITDA: DefLinha[]` — `impostos_diretos` "(−) IR + CSLL + ICMS + DIFAL" (nota), `capex` "(−) CAPEX"; via `buildLinhas`.
- `geracao_caixa` "(=) Geração de Caixa" derivada de `ebitdaMeses` via `subtrairMeses`, `maior_melhor`, com nota.

### Frontend (`BPDreTable.tsx`)
- `ehTotal` inclui `geracao_caixa`.

## Erros e casos-limite
- Herdados das partes anteriores (null propagation, `?? 0` para deduções, atingimento null com orçado 0 — não ocorre aqui pois ambas têm orçamento em todos os meses).

## Workflow
- Mesma branch/worktree, PR #247. Subagent-driven; validação visual dark/light.
