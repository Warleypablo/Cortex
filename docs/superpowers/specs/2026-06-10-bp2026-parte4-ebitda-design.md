# BP 2026 — Orçado × Realizado (Parte 4: CAC, SG&A, Bônus e EBITDA)

**Data:** 2026-06-10
**Status:** Aprovado
**Base:** Partes 1–3 (specs `2026-06-10-bp2026-*.md`).

## Escopo

Quatro linhas novas na matriz, após `(=) Margem Bruta`:

| Linha | Orçado total 2026 | Tipo |
|---|---|---|
| (−) CAC | R$ 4.449.114 | persistida (linha 15 da aba Overview) |
| (−) SG&A | R$ 2.688.672 | persistida (linha 16) |
| (−) Bônus | R$ 100.000 (jan 54k, fev/mar 23k, resto 0) | persistida (linha 17; células vazias = 0) |
| (=) EBITDA | derivado mensal | Margem Bruta − CAC − SG&A − Bônus |

**Nota de fidelidade:** a coluna Total anual da aba Overview mostra EBITDA R$ 7.597.358, que NÃO subtrai o Bônus (bug de fórmula da planilha); a aba oculta "BP ORÇADO X REALIZADO" mostra R$ 7.497.358, que é o valor consistente com a derivação mensal (e o que nossa derivada produz). Conferência mensal: jan = 782.933 − 262.496 − 227.706 − 54.000 = 238.731 ✓ (bate com a planilha).

**Inclui refactor** (follow-up do revisor da Parte 3, justificado pela 4ª família de linhas): extrair builder comum de linhas e helper de query de despesa-caixa. Sem mudança de comportamento.

**Fora de escopo:** IR+CSLL/CAPEX/Geração de Caixa e métricas gerais (Parte 5).

## Decisões (aprovadas pelo usuário)

| Decisão | Escolha |
|---|---|
| CAC realizado | Caixa: `05.04.02%` (locomoção) + `06.04%` (comercial) + `06.05.04%` (viagens) + `06.05.05%` (outras desp. comerciais) + `06.06%` (anúncios/growth) + `06.07%` (eventos/brindes). Software comercial `06.05.03` fica fora — já contado no CSV-Stack. Jan validado: R$ 238.227 (90,8%). |
| SG&A realizado | Caixa: `06.02%` + `06.03%` + `06.08%` + `06.09%` + `06.10.02%` + `06.10.03%` + `06.10.06%` + `06.10.07%` + `06.10.08%` **+ complemento do benefício** = `ratear(beneficioTotal[mes], beneficio_total_empresa[mes] − csv_beneficio[mes], beneficio_total_empresa[mes])` — o complemento fecha o rateio da Parte 3 (CSV + SG&A = 100% do Caju). Nota em tooltip. Jan validado: 189.823 + 16.373 ≈ R$ 206.196 (90,5%). |
| Bônus realizado | Caixa: `05.01.10%` (Premiações). A categoria rastreia a linha Bônus quase exato em jan–mar (95,7% / 92,8% / 94,1%) e cai para ~R$ 5k/mês depois (premiações mensais, que o BP orça no SG&A). Nota em tooltip explicando a mistura. Já estava excluída do CSV-Salários (Parte 3) — sem dupla contagem. |
| Direções | CAC/SG&A/Bônus `menor_melhor`; EBITDA `maior_melhor` com destaque de total. |

## Validação executada (produção, 2026-06-10, caixa)

| Mês | CAC | SG&A (sem benefício) | Bônus (05.01.10) |
|---|---|---|---|
| Jan | 238.227 | 189.823 | 51.664 |
| Fev | 235.910 | 158.670 | 21.342 |
| Mar | 304.046 | 186.545 | 21.648 |
| Abr | 496.949 | 190.787 | 3.300 |
| Mai | 334.622 | 203.058 | 6.224 |

## Mudanças

### Seed (`scripts/seed-bp2026-orcado.py`)
- 3 entradas novas: Overview 15→`cac`, 16→`sga`, 17→`bonus`.
- Suporte a células vazias: lista `PERMITE_VAZIO = {"bonus"}` — para essas métricas, `None` vira `0` antes do assert; demais mantêm o assert estrito.
- Anti-drift: cac 4.449.113,7; sga 2.688.672; bonus 100.000.
- Re-rodar em local e produção (12 métricas × 12 meses).

### API (`server/routes/bp2026.ts`)
- **Refactor primeiro (sem mudança de comportamento):**
  - `somaDespesaCaixaPorMes(db, predicadoSql)` — helper local que encapsula a query padrão de despesa-caixa (DESPESA + QUITADO + data_quitacao 2026 + GROUP BY mês), parametrizada pelo predicado de categorias; reusar nas queries de impostos/salários/benefício/stack existentes e nas 3 novas.
  - `buildLinhas(defs, orcado, realizadoPorMetrica)` — builder comum para famílias de linhas sem `fonteAproximada` (deduções, CSV, e a nova família); o map de receitas (com fonteAproximada) permanece como está.
  - Validar o refactor comparando o payload antes/depois (smoke).
- 3 queries novas via helper: CAC, SG&A (sem benefício), Bônus.
- `realizadoPorMetrica`: `cac` e `bonus` com `?? 0`; `sga` = bucket + `ratear(beneficioTotal[mes] ?? 0, beneficio_total_empresa[mes] − csv_beneficio[mes], beneficio_total_empresa[mes])` (complemento; se rateio null e bucket presente, somar só o bucket — complemento null só ocorre com seed quebrado, então propagar null é aceitável e preferível: usar null para sinalizar).
  - Regra precisa: `sga(mes) = bucket[mes] ?? 0` somado ao complemento; se complemento for null (denominador inválido) ⇒ realizado null.
- Linhas (ordem): …margem_bruta, `cac` "(−) CAC", `sga` "(−) SG&A" (nota), `bonus` "(−) Bônus" (nota), `ebitda` "(=) EBITDA" (derivado de `margemMeses` via `subtrairMeses`).
- Notas: SG&A — "Inclui o complemento do benefício (Caju) não atribuído ao CSV, rateado pela fração orçada do mês."; Bônus — "Realizado usa a categoria Premiações (05.01.10), que também inclui premiações mensais orçadas no SG&A (~R$ 5k/mês)."

### Frontend (`BPDreTable.tsx`)
- `ehTotal` inclui `ebitda`. Nenhuma outra mudança (nota/direção já genéricos).

## Erros e casos-limite
- Complemento do benefício com denominador inválido → SG&A realizado null (sinaliza seed quebrado; mesmo princípio da Parte 3).
- Bônus em meses sem orçamento (abr–dez, orçado 0): atingimento null (divisão por zero protegida em `calcAtingimento`) — exibe "—"; realizado aparece normalmente.
- EBITDA herda propagação de null.

## Workflow
- Mesma branch/worktree, PR #247. Subagent-driven; validação visual dark/light.
