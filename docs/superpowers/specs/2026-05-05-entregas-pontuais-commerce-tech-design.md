---
name: Entregas Pontuais Commerce + Tech — Reporte Mensal
description: Dois novos slides no Reporte Mensal mostrando entregas pontuais YTD, separados por vertical (Commerce via cup_contratos, Tech via cup_projetos_tech), reutilizando dados já carregados sem novas queries
type: project
---

# Entregas Pontuais Commerce + Tech — Reporte Mensal

## Contexto

Continuação da sessão de adição de slides YTD ao Reporte Mensal. Os slides anteriores "Faturamento YTD" (índice 4) e "Vendas YTD" (índice 5) foram inseridos. Estes dois novos slides entram nas posições 16 e 19 da apresentação.

## Objetivo

Mostrar em dois slides separados o acumulado YTD de entregas pontuais por vertical:

1. **Entregas Pontuais Commerce** — posição 16 (após slide "Pontual")
2. **Entregas Pontuais Tech** — posição 19 (após slide "Area Tech")

Diferença dos slides existentes:
- "Pontual" (15) = visão do mês atual — em aberto, aquisição, variação estoque
- "Area Tech" (18) = visão geral do time Tech — N° projetos, pipeline, em aberto
- **Novos slides** = foco no **acumulado YTD** com evolução mensal Jan → mês selecionado

## Fonte de dados

**Zero novas queries. Zero novos tipos TypeScript.**

| Slide | Prop | Origem |
|---|---|---|
| Commerce | `pontualData` (já em `RelatorioMensalData`) | `cup_contratos` via queries 29-33 |
| Tech | `techData` (já em `RelatorioMensalData`) | `cup_projetos_tech` via queries 18-21 |

### Cálculos YTD no frontend

**Commerce:**
```ts
// entregasPorProdutoMes já contém todo o ano (EXTRACT(YEAR FROM data_entrega) = anoDados)
// Filtrar Jan → mês selecionado pelo índice do label
const ytdMeses = entregasPorProdutoMes.slice(0, reportMesIdx + 1)
const totalEntregueYtd = ytdMeses.reduce((s, m) => s + m.total, 0)
const topProduto = <produto com maior valor acumulado nos ytdMeses>
const ticketMedio = totalEntregueYtd / numContratos (ou 0 se 0 contratos)
```

**Tech:**
```ts
// entregasPorTipo cobre últimos 12 meses — filtrar Jan → mês selecionado do ano
const anoDados = parseInt(mesLabel.split(" ")[1])
const ytdTipos = entregasPorTipo.filter(m => {
  const [y, mo] = m.month.split("-").map(Number)
  return y === anoDados && mo <= reportMesIdx + 1
})
const projetosYtd = ytdTipos.reduce((s, m) => s + tiposList.reduce((t, tipo) => t + ((m[tipo] as number) || 0), 0), 0)
const receitaYtd = receitaPorTipo filtrado da mesma forma
```

## Layout

### Slide Entregas Pontuais Commerce

```
┌─────────────────────────────────────────────────────────┐
│ [Package] Entregas Pontuais Commerce — Abril 2026       │
├────────────┬────────────┬────────────┬─────────────────┤
│ Total YTD  │ N° Contr.  │ Ticket Méd │ Top Produto     │
│ (purple)   │ (emerald)  │  (cyan)    │   (amber)       │
├─────────────────────────────────────────────────────────┤
│   BarChart stacked por produto × mês  (Jan → mês)      │
│   + legenda inline                                      │
└─────────────────────────────────────────────────────────┘
```

- **Section theme:** `commerce` (purple)
- **Icon:** `Package`, `iconColor="text-purple-400"`, `gradientColor="#a855f7"`
- **Cards:**
  - Total R$ entregue YTD — `text-purple-400`, `borderColor="#a855f7"`
  - N° contratos entregues YTD — `text-emerald-400`
  - Ticket médio (R$/contrato) — `text-cyan-400`
  - Top produto (nome + valor) — `text-amber-400`
- **ChartCard:** BarChart stacked, `entregasPorProdutoMes` filtrado para Jan→mês
  - Top 5 produtos + "Outros" (mesma lógica de `SlidePontual.tsx`)
  - Cores: `PRODUTO_COLORS` reutilizado (cyan, purple, emerald, amber, pink, slate)
  - Legenda inline acima do gráfico

### Slide Entregas Pontuais Tech

```
┌─────────────────────────────────────────────────────────┐
│ [Code2] Entregas Pontuais Tech — Abril 2026             │
├──────────────┬──────────────┬─────────────────────────┤
│ Projetos YTD │ Receita YTD  │   Tempo Médio Mês       │
│   (blue)     │  (emerald)   │   (cyan)                │
├─────────────────────────────────────────────────────────┤
│  BarChart stacked receita por tipo × mês (Jan → mês)   │
│  + legenda inline                                       │
└─────────────────────────────────────────────────────────┘
```

- **Section theme:** `tech` (blue)
- **Icon:** `Code2`, `iconColor="text-blue-400"`, `gradientColor="#3b82f6"`
- **Cards:**
  - Projetos entregues YTD (contagem) — `text-blue-400`, `borderColor="#3b82f6"`
  - Receita YTD (R$) — `text-emerald-400`
  - Tempo médio por projeto (mês atual, `kpis.tempoMedio`) — `text-cyan-400`
- **ChartCard:** BarChart stacked, `receitaPorTipo` filtrado para Jan→mês do ano
  - Tipos extraídos dinamicamente (mesmo padrão de `SlideAreaTech`)
  - Cores: `TIPO_COLORS` reutilizado de `SlideAreaTech`
  - Legenda inline acima do gráfico

## Posicionamento no array

Antes (21 slides, índices 0-20):
```
...
15: Pontual
16: Capa Tech
17: Area Tech
18: Tópicos
19: Frase
20: Q&A
```

Depois (23 slides, índices 0-22):
```
...
15: Pontual
16: Entregas Pontuais Commerce  ← NOVO
17: Capa Tech
18: Area Tech
19: Entregas Pontuais Tech      ← NOVO
20: Tópicos
21: Frase
22: Q&A
```

`STATIC_SLIDES` passa de 21 para 23. `renderFixedSlide` cases 16→20 são reindexados para 17→22.

## Arquivos

| Arquivo | Ação | O que muda |
|---|---|---|
| `client/src/pages/relatorio-mensal/SlideEntregasPontuaisCommerce.tsx` | create | Novo componente |
| `client/src/pages/relatorio-mensal/SlideEntregasPontuaisTech.tsx` | create | Novo componente |
| `client/src/pages/RelatorioMensal.tsx` | edit | Inserir em índice 16 e 19; reindexar cases 16→20 para 17→22; STATIC_SLIDES = 23 |

## Comportamento de borda

- Se `entregasPorProdutoMes` estiver vazio: KPIs mostram R$ 0 e gráfico em branco
- Se `entregasPorTipo` não tiver meses do ano selecionado: KPIs 0 e gráfico em branco
- `ticketMedio` = 0 quando `numContratos = 0` (não dividir por zero)
- Meses sem entregas exibem barra vazia (não são omitidos — o eixo X mostra Jan → mês)
