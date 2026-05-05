---
name: Slide Faturamento YTD — Reporte Mensal
description: Novo slide no Reporte Mensal exibindo Faturamento YTD (Bruto, Inadimplência, Líquido, Imposto) e gráfico DFC de Recebimento mensal
type: project
---

# Slide Faturamento YTD — Reporte Mensal

## Contexto

O Reporte Mensal (`/reports/mensal`) é uma apresentação de slides que exibe dados financeiros e operacionais da Turbo Partners. O fluxo atual passa por: Capa → Q&A → Novos & Aniversários → Aniv. Empresa → KRs → Comercial → ...

O usuário solicitou um novo slide logo após "Aniv. Empresa" (index 3), antes dos KRs, mostrando o desempenho financeiro acumulado no ano (YTD).

## Objetivo

Mostrar em um único slide:
1. **Faturamento YTD** — métricas de faturamento acumuladas de janeiro ao mês selecionado
2. **DFC de Recebimento** — gráfico mensal de caixa efetivamente recebido (RECEITA QUITADA)

## Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [TrendingUp] Faturamento YTD — Abril 2026        gradientLine │
├──────────────┬──────────────┬──────────────┬──────────────┤
│ Fat. Bruto   │ (-) Inad.    │ (=) Fat.     │  Imposto     │
│    YTD       │    YTD       │ Líquido YTD  │  Receita YTD │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   BarChart — DFC Recebimento mensal (Jan → mês selecionado)    │
│   Barra por mês = SUM(valor_pago) RECEITA QUITADA              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- **Section theme:** `intro` (roxo) — coerente com o slide KRs seguinte
- **Padrão visual:** `SlideLayout` + `SlideHeader` + `SecondaryCard` + `ChartCard` (idêntico aos demais slides)

## Dados

### Interface TypeScript (types.ts)

```ts
export interface DfcRecebimentoMes {
  month: string;   // "YYYY-MM"
  label: string;   // "Jan", "Fev", ...
  recebido: number;
}

export interface FaturamentoYtdData {
  faturamentoBrutoYtd: number;
  inadimplenciaYtd: number;
  impostoYtd: number;
  dfcRecebimentoMensal: DfcRecebimentoMes[];
}
```

Campo adicionado em `RelatorioMensalData`:
```ts
faturamentoYtd: FaturamentoYtdData;
```

### Queries SQL (relatorioMensalSlides.ts)

YTD = de 1º de janeiro do ano do mês selecionado até o primeiro dia do mês seguinte ao selecionado.

```sql
-- 1. Faturamento Bruto YTD + Inadimplência YTD (uma query só)
SELECT
  COALESCE(SUM(valor_bruto::numeric), 0) AS faturamento_bruto_ytd,
  COALESCE(SUM(CASE WHEN nao_pago::numeric > 0 THEN nao_pago::numeric ELSE 0 END), 0) AS inadimplencia_ytd
FROM "Conta Azul".caz_parcelas
WHERE tipo_evento = 'RECEITA'
  AND data_vencimento >= '<ano>-01-01'::date
  AND data_vencimento < '<dataEnd>'::date

-- 2. Imposto sobre Receita YTD (categoria 05.05)
SELECT COALESCE(SUM(valor_pago::numeric), 0) AS imposto_ytd
FROM "Conta Azul".caz_parcelas
WHERE categoria_nome LIKE '05.05%'
  AND status = 'QUITADO'
  AND data_quitacao::date >= '<ano>-01-01'::date
  AND data_quitacao::date < '<dataEnd>'::date

-- 3. DFC Recebimento mensal
SELECT
  TO_CHAR(data_quitacao::date, 'YYYY-MM') AS month,
  COALESCE(SUM(valor_pago::numeric), 0) AS recebido
FROM "Conta Azul".caz_parcelas
WHERE tipo_evento = 'RECEITA'
  AND status = 'QUITADO'
  AND data_quitacao::date >= '<ano>-01-01'::date
  AND data_quitacao::date < '<dataEnd>'::date
GROUP BY TO_CHAR(data_quitacao::date, 'YYYY-MM')
ORDER BY month
```

## Arquivos Alterados

| Arquivo | Tipo | O que muda |
|---|---|---|
| `client/src/pages/relatorio-mensal/types.ts` | edit | Adiciona `DfcRecebimentoMes`, `FaturamentoYtdData`, campo em `RelatorioMensalData` |
| `server/routes/relatorioMensalSlides.ts` | edit | 2 novas queries no `Promise.all`, monta `faturamentoYtd` no objeto de resposta |
| `client/src/pages/relatorio-mensal/SlideFaturamentoYtd.tsx` | create | Novo componente do slide |
| `client/src/pages/RelatorioMensal.tsx` | edit | Insere slide no index 4 de `FIXED_SLIDE_NAMES` e no `renderFixedSlide` |

## Comportamento

- **YTD** é sempre calculado de 1º de janeiro do ano do mês selecionado até o final do mês selecionado
- **Faturamento Líquido YTD** = `faturamentoBrutoYtd - inadimplenciaYtd` (calculado no frontend)
- O gráfico mostra apenas meses com dados (barras zeradas são omitidas visualmente via opacidade)
- Ao inserir o slide no index 4, os slides subsequentes são deslocados +1 (KRs passa de 4→5, etc.)
