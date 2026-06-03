---
name: Slide Vendas CX & Upsell — Reporte Mensal
description: Novo slide no Reporte Mensal exibindo vendas Cross-sell e Upsell do mês (source=PARTNER no Bitrix), com 3 KPI cards e ranking de closers; remove card CX do SlideTurboMetrics
type: project
---

# Slide Vendas CX & Upsell — Reporte Mensal

## Contexto

Sessão de adição de slides ao Reporte Mensal. Após "Vendas YTD" (índice 5), entra um slide dedicado às vendas de Cross-sell e Upsell do mês. O card de cross-sell existente no `SlideTurboMetrics` é removido (libera espaço no slide Commerce).

## Objetivo

Mostrar em um único slide:
1. **KPIs do mês** — MRR CX/Upsell, Pontual CX/Upsell, Total
2. **Ranking de closers** — quem fechou CX/Upsell no mês, com MRR + Pontual stacked

Definição de negócios: `crm_deal WHERE source = 'PARTNER' AND stage_name = 'Negócio Ganho'` para o mês de dados.

## Fonte de dados

**Backend — 2 mudanças:**

### 1. Expor `crosssellContratos` (query 12 já retorna `solicitacoes`, só não salva)

Em `relatorioMensalSlides.ts`, no bloco de montagem de `turboMetrics`, adicionar:
```ts
crosssellContratos: parseInt(turboCxcs.solicitacoes) || 0,
```

### 2. Novo query (inserir como query 12b após o query 12)

Segue o mesmo padrão do ranking de closers (query 5): JOIN em `crm_closers` via `d.closer::integer = c.id`.

```sql
SELECT
  COALESCE(c.nome, 'Sem Responsável') as nome,
  COALESCE(SUM(d.valor_recorrente), 0)::numeric as mrr,
  COALESCE(SUM(d.valor_pontual), 0)::numeric as pontual,
  COUNT(*)::int as contratos
FROM "Bitrix".crm_deal d
LEFT JOIN "Bitrix".crm_closers c
  ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
WHERE d.stage_name = 'Negócio Ganho'
  AND d.source = 'PARTNER'
  AND d.data_fechamento >= ${dataStart}
  AND d.data_fechamento < ${dataEnd}
GROUP BY COALESCE(c.nome, 'Sem Responsável')
ORDER BY (COALESCE(SUM(d.valor_recorrente), 0) + COALESCE(SUM(d.valor_pontual), 0)) DESC
```

### 3. Novo tipo TypeScript

```ts
export interface CrosssellCloser {
  nome: string;
  mrr: number;
  pontual: number;
  contratos: number;
}
```

Adicionar a `TurboMetrics`:
```ts
crosssellContratos: number;
crosssellPorCloser: CrosssellCloser[];
```

## Layout

```
┌──────────────────────────────────────────────────────────┐
│ [Handshake] Vendas CX & Upsell — Abril 2026             │
├────────────────┬──────────────────┬────────────────────┤
│  MRR CX/Up     │  Pontual CX/Up   │  Total CX/Up       │
│  (emerald)     │  (purple)        │  (amber, borda)    │
│  N contratos   │                  │                    │
├──────────────────────────────────────────────────────────┤
│  Ranking de Closers — CX & Upsell no mês               │
│  BarChart horizontal: nome | [MRR emerald][Pont purple] │
└──────────────────────────────────────────────────────────┘
```

- **Section theme:** `comercial` (amber)
- **Icon:** `Handshake`, `iconColor="text-amber-400"`, `gradientColor="#f59e0b"`
- **Cards:**
  - MRR CX/Upsell — `text-emerald-400`, subtitle: `{N} contrato(s) no mês`
  - Pontual CX/Upsell — `text-purple-400`
  - Total CX/Upsell — `text-amber-400`, `borderColor="#f59e0b"`
- **ChartCard:** `BarLayout` horizontal (`layout="vertical"` no Recharts = barras horizontais)
  - `YAxis dataKey="nome"` (nomes dos closers)
  - `XAxis` numérico com `tickFormatter=fmtK`
  - `Bar` MRR (emerald, stackId) + Bar Pontual (purple, stackId)
  - Se `crosssellPorCloser` vazio: mensagem "Sem vendas CX/Upsell no mês"

## Remoção do card cross-sell em SlideTurboMetrics

Arquivo: `client/src/pages/relatorio-mensal/SlideTurboMetrics.tsx`

Remover o bloco `border-t` com o sub-card Cross-sell do segundo SecondaryCard (linhas ~195-212):
```tsx
// REMOVER:
<div className="border-t border-white/[0.06] pt-1.5 mt-1.5 space-y-0.5">
  <div className="flex items-center gap-1 mb-0.5">
    <Handshake className="h-3 w-3 text-purple-400" />
    <span className="text-xs text-purple-400 font-bold">Cross-sell</span>
  </div>
  <div className="flex justify-between">
    <span className="text-xs text-zinc-400">Rec:</span>
    <span className="text-sm font-bold text-emerald-400">{fmtBRL(metrics.crosssellMrr)}</span>
  </div>
  <div className="flex justify-between">
    <span className="text-xs text-zinc-400">Pont:</span>
    <span className="text-sm font-bold text-purple-400">{fmtBRL(metrics.crosssellPontual)}</span>
  </div>
  <div className="flex justify-between">
    <span className="text-xs text-zinc-400">Total:</span>
    <span className="text-sm font-bold text-cyan-400">{fmtBRL(crosssellTotal)}</span>
  </div>
</div>
```

Preservar: Adicionado, Cancelados, Pausados MRR (linhas ~172-193).
Remover também: `const crosssellTotal = ...` se não for mais usado.

## Posicionamento

Antes (24 slides após tasks anteriores desta sessão):
```
5: Vendas YTD
6: KRs
...
```

Depois (25 slides):
```
5: Vendas YTD
6: Vendas CX & Upsell  ← NOVO
7: KRs
...
22: Tópicos
23: Frase
24: Q&A
```

`STATIC_SLIDES` passa de 23 para 24. Cases 6→22 reindexados para 7→23.

## Arquivos

| Arquivo | Ação | O que muda |
|---|---|---|
| `server/routes/relatorioMensalSlides.ts` | edit | Novo query 12b (closer breakdown), expor crosssellContratos |
| `client/src/pages/relatorio-mensal/types.ts` | edit | CrosssellCloser interface, campos em TurboMetrics |
| `client/src/pages/relatorio-mensal/SlideVendasCxUpsell.tsx` | create | Novo componente |
| `client/src/pages/relatorio-mensal/SlideTurboMetrics.tsx` | edit | Remover sub-card cross-sell |
| `client/src/pages/RelatorioMensal.tsx` | edit | Inserir em índice 6, reindexar 6→22 para 7→23, STATIC_SLIDES=24 |

## Comportamento de borda

- `crosssellPorCloser` vazio → ChartCard mostra mensagem "Sem vendas CX/Upsell no mês"
- `crosssellMrr = 0` e `crosssellPontual = 0` → KPIs mostram R$ 0
- Se `responsible_name` não existir no schema real de `crm_deal`, ajustar para o campo correto
