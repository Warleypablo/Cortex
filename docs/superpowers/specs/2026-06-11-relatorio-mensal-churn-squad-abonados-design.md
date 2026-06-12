# Relatório Mensal — Churn Total e Churn s/ Abonados por Squad

**Data:** 2026-06-11
**Status:** Aprovado e implementado

## Objetivo

Na seção "Detalhes por Squad" do Relatório Mensal, substituir o card único de Churn por dois cards:

1. **Churn Total** — todos os churns do squad no mês
2. **Churn s/ Abonados** — descontando apenas os marcados na coluna `abonar_churn`

## Decisões de design

- **A coluna `abonar_churn` de `cup_churn` é o único critério de abono.** A heurística de motivos
  "artificiais" (`Inadimplente 1º Mês`, `Não começou`, `Erro na Venda`) que era aplicada nessa query
  **deixou de existir nesta seção** — churns com esses motivos só saem do número se estiverem
  marcados como abonados na coluna. (Decisão explícita do usuário.)
- Ambos os percentuais usam a mesma base: MRR do mês anterior (fallback: MRR do próprio mês).
- Escopo restrito à seção de squads — os demais slides do relatório (churn geral etc.) não mudam.

## Implementação

### Backend — `server/routes/relatorioMensalSlides.ts` (query 16)

Uma única query com `FILTER`:

```sql
SELECT
  squad,
  COALESCE(SUM(valor_r), 0)::numeric as churn_total_brl,
  COUNT(*)::int as churn_total_count,
  COALESCE(SUM(valor_r) FILTER (WHERE COALESCE(abonar_churn, '') != 'Sim'), 0)::numeric as churn_brl,
  (COUNT(*) FILTER (WHERE COALESCE(abonar_churn, '') != 'Sim'))::int as churn_count
FROM cortex_core.vw_cup_churn_ajustado
WHERE data_solicitacao_encerramento IS NOT NULL
  AND data_solicitacao_encerramento >= :dataStart
  AND data_solicitacao_encerramento < :dataEnd
  AND squad IS NOT NULL AND TRIM(squad) != ''
GROUP BY squad
```

`SquadDetail` ganhou `churnTotalPct` e `churnTotalBrl`.

### Frontend — `client/src/pages/relatorio-mensal/SlideSquadSingle.tsx`

Card de Churn vira dois cards com % grande + valor monetário sempre visível (base "/ R$ X"
só no hero, onde há espaço). KPIs por densidade:

- **1-4 squads:** linha 1 = MRR / Pontual / Faturamento Total; linha 2 = Churn Total /
  Churn s/ Abonados / Evolução MRR.
- **5+ squads (2 linhas de cards, densidade compacta):** MRR / Pontual; Faturamento /
  Evol. MRR; Churn Total / Churn s/ Abono — labels curtos, sem progress bar.

**Faturamento Total** = MRR ativo + pontual entregue no mês (calculado no frontend).

**Tooltip de clientes:** hover em qualquer card de churn lista os clientes churnados do squad
(nome do cliente via `LEFT JOIN cup_clientes ON parent_id = task_id`, valor exato, badge
"abonado"). O card "s/ Abonados" filtra os abonados. Lista vem da própria query 16
(`json_agg` com `valor_r > 0`), limitada a 12 itens + "+ N outros" no frontend.

**Normalização de squad:** os lookups por squad (churn, pontual entregue, MRR anterior)
usam nome normalizado (sem emoji, sem sufixo "(OFF)", lowercase) para casar fontes que
divergem após renomeação do squad — ex.: snapshot "✨ Aura" × cup_churn "✨ Aura (OFF)".

## Validação (maio/2026, endpoint × SQL direto)

| Squad   | Total            | s/ Abonados      |
|---------|------------------|------------------|
| Squadra | 16,6% (R$ 51.014) | 13,1% (R$ 40.317) |
| Selva   | 22,5% (R$ 31.673) | 15,0% (R$ 21.179) |
| Black   | 20,9% (R$ 20.494) | 4,6% (R$ 4.497)   |

Números do endpoint conferidos contra query direta no banco; UI verificada no browser
(slides de build-up e grid completo com 7 squads).
