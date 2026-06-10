# BP 2026 — Orçado × Realizado (Parte 3: CSV e Margem Bruta)

**Data:** 2026-06-10
**Status:** Aprovado
**Base:** Partes 1–2 (`2026-06-10-bp2026-orcado-realizado-design.md`, `2026-06-10-bp2026-parte2-deducoes-design.md`).

## Escopo

Quatro linhas novas na matriz, após `(=) Receita Líquida`:

| Linha | Orçado total 2026 | Tipo |
|---|---|---|
| (−) CSV — Salários | R$ 6.314.099 | persistida (linha 11 da aba Overview) |
| (−) CSV — Benefício | R$ 481.200 | persistida (linha 12) |
| (−) CSV — Stack Tecnologia | R$ 565.344 | persistida (linha 13) |
| (=) Margem Bruta | R$ 14.735.144 | derivada (Receita Líquida − 3 CSVs; confere com a planilha) |

Métrica auxiliar persistida (não exibida): `beneficio_total_empresa` — linha "(-) Beneficio Caju" da **aba SG&A** (jan 44.000 … dez 84.500; total R$ 736.000). Denominador do rateio do benefício.

**Fora de escopo:** CAC/SG&A/Bônus/EBITDA (Parte 4), IR+CSLL/CAPEX/Geração de Caixa (Parte 5), métricas gerais.

## Decisões (aprovadas pelo usuário)

| Decisão | Escolha |
|---|---|
| Salários realizado | Regime caixa: categorias `05.01.%` **exceto** `05.01.10` (Premiações — orçadas no SG&A) **+** `05.02.%` (freelancers de operação). Jan validado: R$ 333.550 (96,5% do orçado). |
| Benefício realizado | O Caju (`06.10.04`) não separa operação de administrativo (centro de custo vazio). **Rateio pela fração orçada do mês**: realizado CSV-Benefício = total pago de `06.10.04` no mês × (`csv_beneficio[mes] ÷ beneficio_total_empresa[mes]`). Ex.: jan 48.678 × (29.200/44.000) ≈ 32.305 (110,6%). Tooltip na linha explica a aproximação. A Parte 4 usará o complemento. |
| Stack realizado | A planilha trata todo o software da empresa como CSV-Stack (a linha Software da aba SG&A é o mesmo valor). Categorias: `05.03.%` + `05.04.01%` + `06.05.03%` + `06.10.01%`. Jan validado: R$ 55.573 (133,8%). |
| Regime | Caixa (quitação), consistente com a Parte 2. |
| Direção | As 3 linhas CSV são `menor_melhor`; Margem Bruta `maior_melhor` com destaque de linha de total. |

## Validação executada (produção, 2026-06-10, regime caixa)

| Mês | Salários (05.01−prem +05.02) | Benefício total (06.10.04) | Stack |
|---|---|---|---|
| Jan | 333.550 | 48.678 | 55.573 |
| Fev | 366.693 | 71.344 | 72.291 |
| Mar | 377.582 | 54.339 | 39.102 |
| Abr | 383.816 | 49.923 | 30.839 |
| Mai | 363.558 | 50.935 | 34.751 |

(Salários = salarios_squad + freelancers das colunas validadas.)

## Mudanças

### Seed (`scripts/seed-bp2026-orcado.py`)
- Generalizar para ler múltiplas abas: Overview linhas 11→`csv_salarios`, 12→`csv_beneficio`, 13→`csv_stack`; aba **SG&A** linha 11→`beneficio_total_empresa` (colunas C..N).
- Anti-drift: 6.314.099,1 / 481.200 / 565.344 / 736.000.
- Re-rodar em local e produção.

### Helpers (`bp2026.helpers.ts`)
- `ratear(valor: number | null, numerador: number, denominador: number): number | null` — null-safe; denominador 0 ou valor null → null. Com testes.

### API (`server/routes/bp2026.ts`)
- 2 queries novas em regime caixa: salários (categorias acima) e benefício total (`06.10.04`); stack (categorias acima) — 3 queries.
- `realizadoPorMetrica`: `csv_salarios` e `csv_stack` com `?? 0`; `csv_beneficio` = `ratear(beneficioTotalPorMes[mes] ?? 0, orcado.csv_beneficio[mes], orcado.beneficio_total_empresa[mes])` para meses ≤ corrente.
- Linhas no payload (ordem): …receita_liquida, `csv_salarios` "(−) CSV — Salários", `csv_beneficio` "(−) CSV — Benefício" (com `nota`), `csv_stack` "(−) CSV — Stack Tecnologia", `margem_bruta` "(=) Margem Bruta" (derivada = receita_liquida − 3 CSVs via `subtrairMeses`).
- `beneficio_total_empresa` NÃO vira linha do payload.
- Campo novo opcional `nota?: string` em LinhaReceita; na linha Benefício: "O benefício (Caju) não separa operação de administrativo no Conta Azul; o realizado é rateado pela fração orçada do mês."

### Frontend (`BPDreTable.tsx`)
- `BPLinha.nota?: string`; quando presente, ícone Info com tooltip ao lado do título (mesmo padrão do tooltip de estoque).
- `ehTotal` inclui `margem_bruta`.

## Erros e casos-limite
- Rateio com `beneficio_total_empresa[mes]` ausente/0 → realizado null (não 0) — sinaliza problema de seed em vez de mascarar.
- Mês corrente parcial: mesmas regras das deduções (`?? 0`; benefício rateado sobre o total parcial).
- Margem Bruta herda propagação de null do `subtrairMeses`.

## Workflow
- Mesma branch/worktree, PR #247.
- Subagent-driven com revisão dupla; validação visual dark/light com dados sincronizados.
