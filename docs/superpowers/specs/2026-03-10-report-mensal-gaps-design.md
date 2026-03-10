# Design: Gaps do Report Mensal — Figma vs Córtex

**Data:** 2026-03-10
**Contexto:** Alinhar o relatório mensal do Córtex com o report do Figma (Turbo Report Mensal), preenchendo 4 gaps identificados.

---

## Resumo dos Gaps

| # | Gap | Slide Afetado | Fonte de Dados |
|---|-----|---------------|----------------|
| 1 | CXCS Retenções | Slide 9 (TurboMetrics) | `cup_churn.reteve` |
| 2 | Indique e Ganhe | Slide 13 (Indicacoes) | `crm_deal.source = 'RECOMMENDATION'` |
| 3 | Split Comercial Inbound/Outbound | Slide 8 (GraficoContratos) | `crm_deal.category_name` |
| 4 | Faturamento Fixo vs Variável | Slide 9 (TurboMetrics) | MRR ativo vs delta |

---

## Gap 1: CXCS Retenções

### Objetivo
Exibir métricas de retenção no card CXCS do Slide 9, mostrando:
- Solicitações de cancelamento (count + valor R$)
- Retenções realizadas (count + valor R$)
- Taxa de retenção (%)

### Dados
Tabela: `"Clickup".cup_churn`

```sql
-- Solicitações no mês
SELECT
  COUNT(*) as solicitacoes_count,
  COALESCE(SUM(valor_r), 0) as solicitacoes_valor
FROM "Clickup".cup_churn
WHERE data_solicitacao_encerramento IS NOT NULL
  AND TO_CHAR(data_solicitacao_encerramento::date, 'YYYY-MM') = :mes

-- Retenções no mês
SELECT
  COUNT(*) as retencoes_count,
  COALESCE(SUM(valor_r), 0) as retencoes_valor
FROM "Clickup".cup_churn
WHERE data_solicitacao_encerramento IS NOT NULL
  AND TO_CHAR(data_solicitacao_encerramento::date, 'YYYY-MM') = :mes
  AND reteve = 'Sim'
```

Taxa de retenção: `(retencoes_count / solicitacoes_count) × 100`

### UI
Estender o card CXCS existente no Slide 9 (SlideTurboMetrics). Adicionar 3 linhas acima do cross-sell:

```
Solicitações: 74 (R$ 152.455)
Retenções: 2 (3,6%)
Valor Retido: R$ 5.494
---
Cross-sell Recorrente: R$ 497
Cross-sell Pontual: R$ 7.997
Total Cross-sell: R$ 8.494
```

### Backend
Arquivo: `server/routes/relatorioMensalSlides.ts`
Adicionar query de retenções na seção que já calcula cross-sell (~linha 250).

### Frontend
Arquivo: `client/src/pages/relatorio-mensal/SlideTurboMetrics.tsx`
Estender o bloco CXCS para incluir as novas métricas.

---

## Gap 2: Indique e Ganhe

### Objetivo
Substituir o placeholder do Slide 13 com dados reais do programa de indicações.

### Dados
Tabela: `"Bitrix".crm_deal`
Filtro: `source = 'RECOMMENDATION'`

```sql
-- Indicações recebidas no mês
SELECT COUNT(*) as indicacoes_recebidas
FROM "Bitrix".crm_deal
WHERE source = 'RECOMMENDATION'
  AND TO_CHAR(data_fechamento, 'YYYY-MM') = :mes

-- Contratos fechados por indicação
SELECT
  COUNT(*) as contratos_fechados,
  COALESCE(SUM(valor_recorrente::numeric), 0) as valor_recorrente,
  COALESCE(SUM(valor_pontual::numeric), 0) as valor_pontual
FROM "Bitrix".crm_deal
WHERE source = 'RECOMMENDATION'
  AND stage_name = 'Negócio Ganho'
  AND TO_CHAR(data_fechamento, 'YYYY-MM') = :mes
```

### UI
Layout do slide com 3 KPIs em destaque:

```
Indicações Recebidas: 35
Contratos Fechados: 11
Valor Total: R$ 12.894 (R) + R$ 28.497 (P)
```

### Backend
Arquivo: `server/routes/relatorioMensalSlides.ts`
Adicionar nova query na seção do slide 13 (substituir dados mock).

### Frontend
Arquivo: `client/src/pages/relatorio-mensal/SlideIndicacoes.tsx`
Substituir mensagem placeholder por cards com os KPIs.

---

## Gap 3: Split Comercial Inbound/Outbound

### Objetivo
No slide de contratos fechados, mostrar breakdown por pipeline do Bitrix (Inbound / Outbound / Geral).

### Dados
Tabela: `"Bitrix".crm_deal`

```sql
SELECT
  category_name,
  COUNT(*) as contratos,
  COALESCE(SUM(valor_recorrente::numeric), 0) as valor_recorrente,
  COALESCE(SUM(valor_pontual::numeric), 0) as valor_pontual
FROM "Bitrix".crm_deal
WHERE stage_name = 'Negócio Ganho'
  AND TO_CHAR(data_fechamento, 'YYYY-MM') = :mes
GROUP BY category_name
ORDER BY valor_recorrente DESC
```

### UI
No Slide 8 (SlideGraficoContratos), adicionar mini-cards ou barras empilhadas por pipeline abaixo do resumo total:

```
Inbound:  X contratos | R$ Y (R) | R$ Z (P)
Outbound: X contratos | R$ Y (R) | R$ Z (P)
Geral:    X contratos | R$ Y (R) | R$ Z (P)
```

### Backend
Arquivo: `server/routes/relatorioMensalSlides.ts`
Estender query existente de contratos (~linha 163) para incluir `GROUP BY category_name`.

### Frontend
Arquivo: `client/src/pages/relatorio-mensal/SlideGraficoContratos.tsx`
Adicionar seção de breakdown por pipeline.

---

## Gap 4: Faturamento Fixo vs Variável

### Objetivo
No slide de métricas (Slide 9), mostrar o faturamento dividido em:
- **Fixo**: MRR ativo (base recorrente dos contratos)
- **Variável**: Diferença entre faturamento total e MRR base (comissões, bônus, extras)
- **Total**: Fixo + Variável + Pontual

### Dados
- **Fixo (MRR base)**: Já calculado — soma de `valorr` dos contratos ativos em `cup_contratos`
- **Variável**: `faturamento_recorrente_caz - mrr_base`
  - Onde `faturamento_recorrente_caz` = soma de caz_parcelas recorrentes quitadas no mês
- **Total**: Já calculado no faturamento existente

```sql
-- MRR base (fixo)
SELECT COALESCE(SUM(valorr::numeric), 0) as mrr_base
FROM "Clickup".cup_contratos
WHERE status IN ('ativo', 'onboarding', 'triagem')
```

### UI
No card "Faturamento Mês" do Slide 9, alterar o layout de:
```
Recorrente: R$ X
Pontual: R$ Y
Total: R$ Z
```
Para:
```
Fixo: R$ 1.271.000
Variável: R$ 0
Pontual: R$ 252.111
Total: R$ 1.523.111
```

### Backend
Arquivo: `server/routes/relatorioMensalSlides.ts`
Adicionar cálculo de MRR base na query de faturamento (~linha 187).

### Frontend
Arquivo: `client/src/pages/relatorio-mensal/SlideTurboMetrics.tsx`
Alterar card de faturamento para exibir Fixo/Variável/Pontual.

---

## Arquivos Impactados

| Arquivo | Mudança |
|---------|---------|
| `server/routes/relatorioMensalSlides.ts` | 4 novas queries/extensões |
| `client/src/pages/relatorio-mensal/SlideTurboMetrics.tsx` | Gaps 1 e 4 (CXCS + Faturamento) |
| `client/src/pages/relatorio-mensal/SlideGraficoContratos.tsx` | Gap 3 (pipeline split) |
| `client/src/pages/relatorio-mensal/SlideIndicacoes.tsx` | Gap 2 (substituir placeholder) |

## Riscos / Considerações

- **RECOMMENDATION no Bitrix**: Só 4 deals ganhos com esse source. Se os dados parecerem escassos, pode ser que indicações estejam sendo registradas com outro source.
- **Retenções**: Apenas 17 registros com `reteve = 'Sim'` total. Os dados são recentes (cup_churn é de 2026-02 em diante).
- **Variável**: Se o resultado for sempre 0 ou próximo de 0, pode indicar que não há receita variável significativa — nesse caso simplificar para Fixo + Pontual + Total.
