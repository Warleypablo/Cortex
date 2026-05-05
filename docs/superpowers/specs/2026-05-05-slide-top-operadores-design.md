---
name: Slide Top Operadores — Reporte Mensal
description: Novo slide no Reporte Mensal exibindo Top 3 por operador (responsavel) em 3 categorias — MRR Ativo, Menor Churn e Projetos Entregues — usando cup_contratos e cup_churn
type: project
---

# Slide Top Operadores — Reporte Mensal

## Contexto

Novo slide inserido na posição 15 do deck (após "Ranking Squads", índice 14). Os slides 15→22 passam para 16→23. Total: 25 slides. "Operador" = campo `responsavel` de `cup_contratos` (gestor operacional do contrato). `cup_churn` tem campo `responsavel_geral` para o ranking de menor churn.

## Objetivo

Mostrar em um único slide quem são os 3 melhores operadores em cada categoria do mês, com visual de pódio (🥇🥈🥉).

## Fonte de Dados

**3 novas queries em `relatorioMensalSlides.ts`**, inseridas no `Promise.all` como queries 24a, 24b, 24c.

### Query 24a — Top 3 MRR Ativo por responsável

```sql
SELECT
  responsavel as nome,
  COALESCE(SUM(
    CASE WHEN valorrec ~ '^[0-9.]+$' THEN valorrec::numeric ELSE 0 END
  ), 0) as valor
FROM "Clickup".cup_contratos
WHERE LOWER(status) IN ('ativo', 'onboarding', 'triagem')
  AND responsavel IS NOT NULL
  AND TRIM(responsavel) != ''
GROUP BY responsavel
ORDER BY valor DESC
LIMIT 3
```

### Query 24b — Top 3 Menor Churn por responsavel_geral

```sql
SELECT
  responsavel_geral as nome,
  COALESCE(SUM(valor_r), 0)::numeric as valor
FROM "Clickup".cup_churn
WHERE data_solicitacao_encerramento IS NOT NULL
  AND data_solicitacao_encerramento >= ${dataStart}
  AND data_solicitacao_encerramento < ${dataEnd}
  AND COALESCE(abonar_churn, '') != 'Sim'
  AND COALESCE(motivo_cancelamento, '') NOT IN ('Inadimplente 1º Mês', 'Não começou', 'Erro na Venda')
  AND responsavel_geral IS NOT NULL
  AND TRIM(responsavel_geral) != ''
GROUP BY responsavel_geral
ORDER BY valor ASC
LIMIT 3
```

### Query 24c — Top 3 Projetos Entregues por responsável

```sql
SELECT
  responsavel as nome,
  COUNT(*)::int as valor
FROM "Clickup".cup_contratos
WHERE LOWER(status) = 'entregue'
  AND data_entrega >= ${dataStart}::date
  AND data_entrega < ${dataEnd}::date
  AND responsavel IS NOT NULL
  AND TRIM(responsavel) != ''
GROUP BY responsavel
ORDER BY valor DESC
LIMIT 3
```

## Novos Tipos TypeScript

```ts
export interface OperadorRanking {
  nome: string;
  valor: number;
}

export interface TopOperadores {
  topMrr: OperadorRanking[];
  topMenorChurn: OperadorRanking[];
  topEntregas: OperadorRanking[];
}
```

Adicionar `topOperadores: TopOperadores` em `RelatorioMensalData`.

## Layout

```
┌──────────────────────────────────────────────────────────┐
│ [Trophy] Top Operadores — Abril 2026                     │
│ ─────────────────────────── (amber gradient)             │
├──────────────┬───────────────────┬──────────────────────┤
│  MRR Ativo   │  Menor Churn      │  Proj. Entregues     │
│              │                   │                      │
│ 🥇 Ana       │ 🥇 João           │ 🥇 Pedro             │
│    R$ 85k    │    R$ 0           │    12                │
│              │                   │                      │
│ 🥈 João      │ 🥈 Ana            │ 🥈 Ana               │
│    R$ 72k    │    R$ 1,2k        │    9                 │
│              │                   │                      │
│ 🥉 Pedro     │ 🥉 Maria          │ 🥉 Maria             │
│    R$ 60k    │    R$ 2,5k        │    7                 │
└──────────────┴───────────────────┴──────────────────────┘
```

- `SlideLayout section="commerce"` padding `28px 36px`
- `SlideHeader`: `icon={Trophy}`, `iconColor="text-amber-400"`, `gradientColor="#f59e0b"`, `title="Top Operadores — {mesLabel}"`
- `grid-cols-3 gap-4 flex-1`
- Cada coluna: `SecondaryCard` com:
  - Título da categoria (texto pequeno, uppercase)
  - 3 linhas de pódio: medalha + nome + valor
  - Posição 1: `text-amber-400` (ouro), `text-lg font-black`
  - Posição 2: `text-zinc-300` (prata), `text-base font-bold`
  - Posição 3: `text-zinc-500` (bronze), `text-sm font-semibold`
- Se lista vazia: mensagem "Sem dados no mês"
- Formatação de valores:
  - MRR Ativo: `fmtBRL` (R$ XYk)
  - Menor Churn: `fmtBRL` (R$ XYk) — menor é melhor
  - Projetos Entregues: número inteiro (`valor` entregas)

## Posicionamento em RelatorioMensal.tsx

`FIXED_SLIDE_NAMES` — inserir `"Top Operadores"` entre `"Ranking Squads"` e `"Turbo Commerce"`:

```ts
"Ranking Squads", "Top Operadores", "Turbo Commerce",
```

`STATIC_SLIDES = 25`.

`renderFixedSlide`:
- case 15: `<SlideTopOperadores topOperadores={data.topOperadores} mesLabel={data.mesDadosLabel} />`
- case 16: `<SlideTurboMetrics ...>` (era 15)
- case 17: `<SlidePontual ...>` (era 16)
- case 18: `<SlideEntregasPontuaisCommerce ...>` (era 17)
- case 19: `<SlideCapaTech />` (era 18)
- case 20: `<SlideAreaTech ...>` (era 19)
- case 21: `<SlideEntregasPontuaisTech ...>` (era 20)
- case 22: `<SlideTopicosDiscussao />` (era 21)
- case 23: `<SlideFraseEncerramento />` (era 22)
- case 24: `<SlideQRCode />` (era 23)

## Arquivos

| Arquivo | Ação | O que muda |
|---|---|---|
| `server/routes/relatorioMensalSlides.ts` | edit | Queries 24a/b/c + `topOperadores` no res.json |
| `client/src/pages/relatorio-mensal/types.ts` | edit | `OperadorRanking`, `TopOperadores`, campo em `RelatorioMensalData` |
| `client/src/pages/relatorio-mensal/SlideTopOperadores.tsx` | create | Novo componente |
| `client/src/pages/RelatorioMensal.tsx` | edit | Import, FIXED_SLIDE_NAMES, case 15 + reindexar 15→22 para 16→24 |

## Comportamento de Borda

- Lista vazia em qualquer coluna → exibir `"Sem dados no mês"` centralizado no card
- Responsável com nome nulo ou em branco → excluído pelas queries (`WHERE responsavel IS NOT NULL AND TRIM(responsavel) != ''`)
- `valor` = 0 no Menor Churn → exibir `"R$ 0"` (é o melhor resultado possível)
- `valorrec` não numérico no cup_contratos → `CASE WHEN valorrec ~ '^[0-9.]+$'` já filtra o lixo
