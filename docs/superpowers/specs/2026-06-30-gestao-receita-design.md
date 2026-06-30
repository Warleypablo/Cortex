# Gestão de Receita — Painel Orçado × Realizado (Comercial)

**Data:** 2026-06-30
**Rota:** `/gestao/receita` · **Permission:** `gestao.receita`
**Status:** aprovado (design) — implementação em andamento

## Objetivo
Página de gestão comercial no padrão **Orçado × Realizado**, espelhando o mockup
de "Gestão de Receita" com **dados reais** do Cortex. 5 seções: Pessoas, Macro,
Micro, Funil, Qualidade.

## Decisões (aprovadas pelo usuário)
1. **Orçado** vem do **BP 2026** (`cortex_core.bp2026_orcado`), read-only. Sem inputs manuais.
2. **Venda nova** (MRR/Pontual) vem do **Bitrix** (`crm_deal`, stage `Negócio Ganho`).
3. **Página inteira** de uma vez. Reconstruída em **componentes do Cortex + Tailwind + dark mode**
   (NÃO usar o CSS inline do mockup).

## Arquitetura
- **Backend:** 1 endpoint agregador `GET /api/gestao/receita?mes=YYYY-MM`
  em `server/routes/gestaoReceita.ts`, registrado via `registerGestaoReceitaRoutes(app)`
  em `server/routes.ts`. Padrão: `db.execute(sql\`...\`)` (drizzle).
- **Frontend:** `client/src/pages/gestao/GestaoReceita.tsx` (lazy em `App.tsx`,
  item no grupo "Gestão" de `shared/nav-config.ts`).
- 1 fetch via React Query (`queryKey: ["/api/gestao/receita", { mes }]`).

## Mapa card → fonte (validado no banco, jun/2026)
| Seção | Card | Realizado | Orçado (bp2026_orcado) |
|---|---|---|---|
| Pessoas | Custo comercial | `cac_vendas`+`cac_pre_vendas` (realiz.) | idem |
| Pessoas | Top/Bottom Closers | `crm_deal`⋈`crm_closers` (closer=id) | — |
| Pessoas | Top/Bottom SDR | `crm_deal`⋈`crm_users` (sdr=id) | — |
| Pessoas | Comissões | `cac_comissoes` realizado | `cac_comissoes` |
| Macro | Venda MRR/Pontual | `crm_deal` ganho (data_fechamento) | `vendas_mrr`/`vendas_pontual` |
| Macro | Canais aquisição | `crm_deal` ganho por `source` | — |
| Macro | CAC produto/cliente | custo ÷ contratos/clientes | `cac` |
| Micro | Venda/ticket produto | `cup_contratos` (produto, valorr/valorp) | `aov_venda_*`, `vendas_*_seg` |
| Micro | Perf. vendedor/SDR | idem Pessoas | — |
| Funil | Lead→RA→RR→Venda | `crm_deal` (date_create/agendada/realizada/fechamento) | — |
| Funil | MQL/NMQL | `crm_deal.mql` (1/true=MQL) | — |
| Funil | CAC/Invest. por canal | `meta_ads` + custos `caz_parcelas` | — |
| Qualidade | Churn motivo/vendedor | `cup_churn` (motivo_cancelamento, vendedor, valor_r) | — |

## Limitações conhecidas (rotular na tela, não mascarar)
- `crm_deal.mql` vazio em ~89% dos leads → card MQL/NMQL mostra "(sem classificação)".
- `crm_deal.source` vazio em muitos deals → canal "(não informado)" é bucket legítimo.
- **Férias/lacunas** do time comercial: fora da v1 (sem fonte estruturada).
- Google Ads spend via Conta Azul (categoria 06.06), não API direta.

## Campos-chave confirmados
- Ganho: `stage_name = 'Negócio Ganho'` (`stage_semantic` está vazio).
- `closer` = `crm_closers.id`; `sdr` = `crm_users.id`.
- `source` = canal (CALL/WEBFORM/PARTNER); `fonte` = URL da landing.
- Datas: lead=`date_create`, RA=`data_reuniao_agendada`, RR=`data_reuniao_realizada`, venda=`data_fechamento`.
- BP orçado: tabela `cortex_core.bp2026_orcado(metrica, mes 1-12, valor)`.
