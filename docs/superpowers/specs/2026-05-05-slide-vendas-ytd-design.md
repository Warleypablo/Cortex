---
name: Slide Vendas YTD — Reporte Mensal
description: Novo slide no Reporte Mensal exibindo Vendas YTD (MRR, Pontual, Total) com gráfico mensal stacked, reutilizando contratosMes.vendasSeries sem novas queries
type: project
---

# Slide Vendas YTD — Reporte Mensal

## Contexto

Continuação da sessão de adição de slides YTD ao Reporte Mensal. O slide anterior "Faturamento YTD" foi inserido na posição 4. Este slide entra na posição 5, logo após.

## Objetivo

Mostrar em um único slide:
1. **KPIs YTD** — Vendas MRR, Vendas Pontual e Total (acumulado Jan → mês selecionado)
2. **Gráfico mensal** — BarChart stacked MRR + Pontual por mês

## Fonte de dados

`data.contratosMes.vendasSeries` — já existe na resposta do endpoint `/api/reports/mensal`.
A query (item 27 em relatorioMensalSlides.ts) já traz dados de Jan 1 até `dataEnd` do ano selecionado.

**Zero novas queries. Zero novos tipos TypeScript.**

Cálculo dos YTDs no frontend:
```ts
const vendasMrrYtd    = vendasSeries.reduce((s, m) => s + m.vendasMrr, 0)
const vendasPontualYtd = vendasSeries.reduce((s, m) => s + m.vendasPontual, 0)
const vendasTotalYtd  = vendasMrrYtd + vendasPontualYtd
const contratosYtd    = vendasSeries.reduce((s, m) => s + m.numContratos, 0)
```

## Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [ShoppingBag] Vendas YTD — Abril 2026          gradient line  │
├──────────────────┬──────────────────┬──────────────────┤
│  Vendas MRR YTD  │ Vendas Pont. YTD │   Total Vendas   │
│    (emerald)     │    (purple)      │     (cyan)       │
│  + nº contratos  │  + nº contratos  │  + total contr.  │
├─────────────────────────────────────────────────────────────────┤
│   BarChart stacked MRR (emerald) + Pontual (purple) por mês    │
└─────────────────────────────────────────────────────────────────┘
```

- **Section theme:** `comercial` (amber) — coerente com a seção comercial que vem logo depois
- **Padrão:** `SlideLayout` + `SlideHeader` + `SecondaryCard` + `ChartCard` (Recharts BarChart)

## Arquivos

| Arquivo | Ação | O que muda |
|---|---|---|
| `client/src/pages/relatorio-mensal/SlideVendasYtd.tsx` | create | Novo componente |
| `client/src/pages/RelatorioMensal.tsx` | edit | Inserir "Vendas YTD" em index 5; reindexar cases 5→19 para 6→20 em `renderFixedSlide` |

## Comportamento

- `vendasSeries` pode ter 0 a 12 entradas (apenas meses com negócios fechados)
- Se `vendasSeries` estiver vazio, os KPIs mostram R$ 0 e o gráfico fica em branco
- Section `comercial` usa cores amber/orange — distinto do slide Faturamento YTD (intro/roxo)
