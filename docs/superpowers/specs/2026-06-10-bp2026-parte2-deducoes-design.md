# BP 2026 — Orçado × Realizado (Parte 2: Inadimplência, Impostos e Receita Líquida)

**Data:** 2026-06-10
**Status:** Aprovado
**Base:** Parte 1 (`docs/superpowers/specs/2026-06-10-bp2026-orcado-realizado-design.md`) — tabela `cortex_core.bp2026_orcado`, endpoint `GET /api/bp2026/receitas`, matriz anual em `/bp-2026`.

## Escopo

Três linhas novas na matriz, na ordem do DRE, logo após `(=) Receita Total Faturável`:

| Linha | Orçado total 2026 | Tipo |
|---|---|---|
| (−) Inadimplência | R$ 1.564.991 | persistida (linha 8 da aba Overview) |
| (−) Impostos sobre Receita | R$ 2.422.411 | persistida (linha 9 da aba Overview) |
| (=) Receita Líquida | R$ 22.095.787 | derivada (Total Faturável − Inadimplência − Impostos; confere com a planilha) |

**Fora de escopo:** CSV/Margem Bruta (Parte 3), CAC/SG&A/EBITDA (Parte 4), IR+CSLL/CAPEX/Geração de Caixa, métricas gerais.

## Decisões (aprovadas pelo usuário)

| Decisão | Escolha |
|---|---|
| Inadimplência realizada | **Foto atual por vencimento**: `SUM(nao_pago)` das parcelas `tipo_evento='RECEITA'` com `data_vencimento` no mês e `nao_pago > 0`. Melhora retroativamente com recuperação (jan hoje R$ 46.485 vs R$ 283.761 na época). Mesma família de definição do módulo Inadimplência. |
| Impostos realizados | **Caixa (quitação)**: `SUM(valor_pago)` das parcelas `tipo_evento='DESPESA'`, `categoria_nome LIKE '05.05%'` (ISS, PIS/COFINS, Simples, Retidos), `status='QUITADO'`, por `data_quitacao`. Sempre completo para meses fechados; deslocado um mês em relação à competência (limitação registrada — jan R$ 104.303 coincide com a referência manual). |
| Arquitetura | Estender o endpoint existente (uma chamada → uma tabela). Sem endpoint novo, sem generalização por linha (YAGNI até a Parte 3). |
| Direção da métrica | Payload ganha `direcao: "maior_melhor" \| "menor_melhor"` por linha. Inadimplência e Impostos = `menor_melhor`; demais = `maior_melhor`. |

## Validação executada (produção, 2026-06-10)

| Mês | Inadimplência (nao_pago hoje) | Impostos (caixa) |
|---|---|---|
| Jan | 46.485 | 104.303 (= referência manual ✅) |
| Fev | 43.909 | 126.881 |
| Mar | 49.363 | 119.972 |
| Abr | 52.674 | 167.001 |
| Mai | 85.370 | 143.015 |

## Mudanças

### Seed (`scripts/seed-bp2026-orcado.py`)
- Acrescentar linhas 8 → `inadimplencia` e 9 → `impostos_receita` ao mapa `LINHAS`, com totais esperados 1.564.991,4 e 2.422.411,4 no anti-drift.
- Re-rodar em local e produção (idempotente).

### API (`server/routes/bp2026.ts`)
- 2 queries novas (inadimplência e impostos, conforme decisões acima); `realizado: null` para meses futuros; mês corrente parcial como nas demais.
- Linhas no payload, na ordem: `mrr_ativo`, `receita_pontual`, `outras_receitas`, `receita_total_faturavel`, `inadimplencia` ("(−) Inadimplência"), `impostos_receita` ("(−) Impostos sobre Receita"), `receita_liquida` ("(=) Receita Líquida", derivada = total − inadimplência − impostos; realizado null no mês se qualquer componente for null).
- Todas as linhas ganham `direcao`; deduções são `tipoAgregacao: "fluxo"`.
- YTD inalterado (meses fechados); derivada calcula YTD a partir dos próprios meses derivados.

### Frontend (`BPDreTable.tsx`)
- `corAtingimento(a, direcao)`: para `menor_melhor`, verde ≤ 100%, âmbar 100–110%, vermelho > 110% (escala invertida).
- Linhas com `metrica` em {`receita_total_faturavel`, `receita_liquida`} recebem o destaque de linha de total.
- Nenhuma outra mudança estrutural (linhas fluem da API).

### Testes (`bp2026.helpers.test.ts` + novos)
- Derivada com componente null → null.
- YTD de dedução (fluxo) e YTD da derivada.
- Se a lógica de cor por direção for extraída para helper compartilhável no client, testar; caso contrário, validação visual.

## Erros e casos-limite
- Mês fechado sem parcelas vencidas em aberto → inadimplência realizada 0 quando há parcelas no mês e todas pagas (query retorna ausência de linha → tratar como 0 para meses ≤ mesFechado, diferente da Parte 1; sem dado ≠ sem inadimplência — para inadimplência, ausência de não-pago É zero).
- Impostos: mês fechado sem quitação → 0 (mesma lógica).
- Demais linhas mantêm a semântica da Parte 1 (null = sem dado).

## Workflow
- Mesma branch/worktree `feature/bp2026-orcado-realizado` (PR #247 ainda aberto — Parte 2 entra no mesmo PR, ou em PR seguinte se #247 for mergeado antes).
- Subagent-driven, revisão dupla por task, validação visual dark/light.
