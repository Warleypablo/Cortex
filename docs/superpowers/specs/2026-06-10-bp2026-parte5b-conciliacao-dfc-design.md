# BP 2026 — Orçado × Realizado (Parte 5b: Conciliação com a DFC)

**Data:** 2026-06-10
**Status:** Aprovado
**Origem:** auditoria solicitada pelo usuário — a Geração de Caixa derivada (YTD R$ 1.584k) vs caixa real (YTD R$ 917k) tinha gap de R$ 667k. Decomposição fechou exata: R$ 246k de despesas fora dos buckets + R$ 421k estrutural do lado receita (base contratada/vendido ≠ recebido; parcelamento de pontual).

## Mudanças (todas em `server/routes/bp2026.ts`; frontend inalterado)

1. **Estornos na linha de Inadimplência** — categoria `05.06%` (Estornos e Devoluções de Serviço, R$ 36k YTD) é dedução de receita não orçada no BP. A linha `inadimplencia` passa a:
   - título: `(−) Inadimplência e Estornos`
   - realizado: foto atual do não-pago vencido (como hoje) **+ estornos pagos no mês** (caixa, `05.06%`)
   - nota nova: "Inadimplência: não pago das parcelas já vencidas (foto atual). Estornos: devoluções de serviço pagas no mês. O BP orçou apenas a provisão de inadimplência."
2. **Turbooh no SG&A** — bucket do SG&A (4h) ganha `06.01%` (custo da venture, ~R$ 3-5k/mês; a receita Turbooh está em Outras Receitas). Nota do SG&A atualizada para citar Turbooh.
3. **Lançamento sem código nos impostos** — predicado de impostos sobre receita (4c) ganha `OR categoria_nome ILIKE 'Impostos retidos%'` (captura lançamentos sem código de categoria; R$ 1.258 em mai). Registrar pedido ao financeiro para categorizar.
4. **Linha informativa "(=) Fluxo de Caixa (DFC)"** — última linha da matriz, métrica `dfc_real`:
   - realizado: entradas − saídas QUITADO por `data_quitacao` no mês (caixa real, tudo incluído — inclusive distribuição a sócios)
   - orçado: o mesmo orçado mensal da Geração de Caixa derivada (o plano de caixa do BP)
   - `maior_melhor`, destaque de total, nota: "Caixa real: entradas − saídas quitadas no mês, incluindo distribuição a sócios. Difere da Geração derivada pelo timing de recebimento (vendas parceladas, base contratada vs recebido) e pela distribuição."
5. **Transferência dos Sócios (07.x) segue fora do DRE** — decisão consciente: é financiamento; o BP define a Geração antes da distribuição.

## Valores de referência (produção, 2026-06-10)

| Mês | Estornos (05.06) | Turbooh (06.01) | Retidos s/ código | DFC real |
|---|---|---|---|---|
| Jan | 0 | 3.254 | 0 | 220.229 |
| Fev | 3.503 | 4.058 | 0 | 184.195 |
| Mar | 13.187 | 5.100 | 0 | 167.103 |
| Abr | 11.488 | 3.555 | 0 | 149.031 |
| Mai | 7.899 | 1.813 | 1.258 | 196.737 |

Pós-mudança, o lado despesa do modelo fecha com as saídas reais exceto pela distribuição a sócios (intencional); a linha DFC real torna o confronto permanente.

## Workflow
Mesma branch/PR #247; implementação direta com revisão (mudança pequena e bem definida); validação visual dark/light.
