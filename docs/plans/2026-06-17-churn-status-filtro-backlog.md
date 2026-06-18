# Backlog — Filtro de status nas queries de churn (entregue/pausado)

**Data:** 2026-06-17
**Origem:** Bug reportado no BP 2026 (aba Revenue, "Churn R$ Total" inflado — Mai/2026 mostrava 184.823 vs 172.826 reais do ClickUp).
**Status do BP:** ✅ Corrigido no PR #271 (branch `fix/bp2026-churn-status-entregue-pausado`).
**Status do resto:** ⏳ Pendente (decisão: tratar depois).

## Causa raiz

A view `cortex_core.vw_cup_churn_ajustado` (= `"Clickup".cup_churn` UNION ALL ajustes manuais) contém
contratos de **todos** os status: `ativo`, `onboarding`, `triagem`, `entregue`, `pausado`,
`cancelado/inativo`, `em cancelamento`, `não usar`.

Só `cancelado/inativo` e `em cancelamento` são churn de verdade. Registros `entregue`
(projeto pontual concluído) e `pausado` (pausa ≠ cancelamento) **não são churn**, mas entram quando
a query soma `valor_r` por `data_solicitacao_encerramento` sem filtrar `status`.

O gráfico "Churn Commerce MoM" do ClickUp (fonte de verdade) conta só os dois status de churn.
Validado em produção: com `status IN ('cancelado/inativo','em cancelamento')` os 6 meses de 2026
batem exatamente com o ClickUp.

## A correção (mesma em todos os pontos)

Adicionar ao `WHERE` de cada query que SOMA churn:

```sql
AND status IN ('cancelado/inativo', 'em cancelamento')
```

Impacto medido (2026): remove Fev −1.997, Abr −2.997, Mai −11.997, Jun −8.997 nas queries brutas.
Nas queries "ajustadas" (que já excluem abonar/motivo) o impacto é Fev −1.997, Mai −11.997, Jun −8.997
(Abr já caía no filtro de motivo). Registros responsáveis (5 no ano): contratos `entregue`/`pausado`
de Social Media e Gestão de Performance.

## Queries pendentes (TEM_BUG — somam churn sem filtrar status)

| Arquivo | Linha (aprox.) | O que calcula |
|---------|------|---------------|
| `server/routes.ts` | ~2196 | Churn por squad/mês (Evolução Mensal) |
| `server/routes.ts` | ~2283 | Churn 3m por responsável (TV Leaderboard) |
| `server/routes.ts` | ~2383 | Churn por squad/mês (Insights) |
| `server/routes.ts` | ~6381 | Churn por squad (mês atual) |
| `server/routes.ts` | ~6436 | Churn evolução 6m por squad |
| `server/routes.ts` | ~6602 | Churn por operador (mês) |
| `server/routes.ts` | ~6672 | Churn por operador (mês anterior) |
| `server/routes.ts` | ~6832 | Evolução churn mensal 12m |
| `server/routes.ts` | ~6845 | Churn por motivo 12m |
| `server/storage.ts` | ~4380 | Churn mensal (Visão Geral) |
| `server/routes/relatorioMensal.ts` | ~153 | Churn receita mensal |
| `server/routes/relatorioMensalSlides.ts` | ~381 | Churn & Pausados (slides) — **CUIDADO:** separa pausados de propósito; revisar antes |
| `server/routes/fechamentoSemanal.ts` | ~79 | Churn semanal por squad — **sem nenhum filtro** (também falta abonar/motivo) |
| `server/okr2026/metricsAdapter.ts` | ~383 | `getGrossChurnMrr()` |
| `server/routes/okr2026.ts` | ~676 | Churn mensal OKR (snapshot) |
| `server/routes/okr2026.ts` | ~807 | Churn MRR OKR (mês atual) |
| `server/routes/churnProdutoMotivo.ts` | ~141 | Churn squad-motivo — **usa cup_churn direto, sem abonar/motivo** |
| `server/routes/churnProdutoMotivo.ts` | ~329 | Churn mensal (taxa) |
| `server/routes/churnProdutoMotivo.ts` | ~389 | Churn por motivo |
| `server/routes/ltLtvChurn.ts` | ~143 | Churn mensal LT/LTV — **falta também `data_solicitacao_encerramento IS NOT NULL`** |

> As linhas são aproximadas (snapshot 2026-06-17) — confirmar com grep antes de editar.

## Queries que JÁ filtram status (não mexer)

- `server/routes.ts` ~5098 — Churn consolidado trimestral
- `server/routes.ts` ~5126 — Churn posterior trimestral
- `server/routes/churnProdutoMotivo.ts` ~247 — Churn por produto
- `server/routes/bpProdutos.ts` ~117 — Churn BP Produtos

## Observação separada (fora deste escopo)

Duas queries não filtram nem `abonar_churn` nem `motivo_cancelamento`, divergindo da semântica
"ajustada" dos demais dashboards:
- `server/routes/fechamentoSemanal.ts` ~79
- `server/routes/churnProdutoMotivo.ts` ~141

Decidir caso a caso se devem ser brutas (como o BP) ou ajustadas antes de uniformizar.

## Como validar após corrigir

Comparar o total mensal de cada dashboard contra o gráfico "Churn Commerce MoM" do ClickUp
(meses de 2026): Jan 162.431 · Fev 99.658,5 · Mar 151.063 · Abr 175.765 · Mai 172.826 · Jun 111.951
(para dashboards brutos; dashboards ajustados ficam abaixo disso por excluírem abonados/motivos).
