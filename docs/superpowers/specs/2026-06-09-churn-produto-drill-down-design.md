# Spec: Drill-down e Taxa Total no Histórico Mensal por Produto

**Data:** 2026-06-09  
**Componente alvo:** `ChurnEvolucaoMensal.tsx` (BarChart "Histórico Mensal por Produto")

---

## Contexto

O gráfico "Histórico Mensal por Produto" exibe cancelamentos por motivo para um produto selecionado. Os usuários precisam de:
1. Um modo que mostre a taxa total de churn do produto (sem quebra por motivo)
2. A eliminação de meses sem dados quando visualizando taxas
3. Capacidade de clicar em qualquer barra e ver o detalhamento completo daquele mês

---

## Mudança 1 — Novo toggle "Taxa Total" + filtro de meses vazios

### Toggle
O toggle passa de 3 para 4 opções: `Contratos | MRR Perdido | % Churn | Taxa Total`

- **"% Churn"** — mantém comportamento atual (barras empilhadas por motivo, % de incidência)
- **"Taxa Total"** — nova opção; barra única por mês mostrando a taxa total de churn do produto (mrr_churn_produto / mrr_base_produto × 100). Usa os dados já buscados de `/api/churn/taxa-por-produto`.

### Filtro de meses vazios
Quando `metrica === "taxa_churn"` ou `metrica === "taxa_total_produto"`, filtrar do array de dados os meses onde o total de mrr_churn do produto selecionado é 0. Remove a cauda vazia à esquerda do gráfico.

### Implementação
- Adicionar `"taxa_total_produto"` ao tipo `Metrica`
- Novo `useMemo` `produtoTaxaTotalChartData`: filtra `taxaProdutoData.rows` para o produto selecionado, aplica filtro de meses vazios, retorna `[{ mesLabel, taxa }]`
- O BarChart usa `produtoTaxaTotalChartData` quando `metrica === "taxa_total_produto"`, com uma única `<Bar dataKey="taxa" />`
- Tooltip formatter: `${value.toFixed(2)}%`
- YAxis formatter: `${v.toFixed(1)}%`

---

## Mudança 2 — Click na barra → Sheet de detalhamento

### Comportamento
Clicar em qualquer barra do BarChart (todos os modos do toggle) define `selectedMes: string | null` com o mês clicado (formato `YYYY-MM`). Isso abre o `ChurnDetalheDrawer`.

### Componente `ChurnDetalheDrawer`
Arquivo novo: `client/src/components/ChurnDetalheDrawer.tsx`

**Props:**
```ts
interface Props {
  produto: string;
  mes: string | null;       // null = fechado
  onClose: () => void;
}
```

**Estrutura do Sheet** (largura 520px, `side="right"`, scroll vertical):

```
┌─────────────────────────────────────────┐
│ Performance — Mar/26                     │
│ 28 contratos · R$ 79.194 perdidos       │
├─────────────────────────────────────────┤
│ [Pie: Por Squad]    [Pie: Por Operador] │
├─────────────────────────────────────────┤
│ LTV Mediano da Safra                    │
│ R$ 4.500                                │
├─────────────────────────────────────────┤
│ Contratos Perdidos                      │
│ Nome · Squad · Operador · MRR · Motivo  │
└─────────────────────────────────────────┘
```

**Fetch:** `GET /api/churn/produto-mes-detalhe?produto=X&mes=YYYY-MM`  
Acionado só quando `mes !== null` e `produto` estão definidos (React Query `enabled`).

---

## Mudança 3 — Novo endpoint

### `GET /api/churn/produto-mes-detalhe`

**Query params:** `produto: string`, `mes: string (YYYY-MM)`

**Response:**
```ts
{
  produto: string;
  mes: string;
  total_cancelamentos: number;
  total_mrr: number;
  ltv_mediano: number;
  squads: Array<{ squad: string; cancelamentos: number; mrr: number; pct: number }>;
  operadores: Array<{ operador: string; cancelamentos: number; mrr: number; pct: number }>;
  contratos: Array<{
    nome: string;
    squad: string;
    operador: string;
    valor_r: number;
    motivo: string;
  }>;
}
```

**SQL — fonte de dados:** `cortex_core.vw_cup_churn_ajustado`  
**Filtros padrão aplicados:**
- `valor_r > 0`
- `data_solicitacao_encerramento IS NOT NULL`
- `DATE_TRUNC('month', data_solicitacao_encerramento) = mes::date`
- `COALESCE(abonar_churn, '') != 'Sim'`
- `motivo_cancelamento NOT IN ('Inadimplente 1º Mês','Não começou','Erro na Venda')`
- Squads excluídos: lista padrão usada nos outros endpoints
- `produto = $produto`

**LTV calculado** (evita campo `lt` corrompido):
```sql
valor_r * GREATEST(
  EXTRACT(MONTH FROM AGE(
    data_solicitacao_encerramento,
    COALESCE(data_primeiro_pagamento, data_criado)
  )), 1
) AS ltv
```

**ltv_mediano:** `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ltv)`

**squads / operadores:** GROUP BY com COUNT(*) e SUM(valor_r). `pct` = cancelamentos_grupo / total_cancelamentos × 100. Os pie charts usam cancelamentos como métrica de distribuição; o tooltip mostra também o MRR perdido do grupo.

---

## Arquitetura — o que muda onde

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `ChurnEvolucaoMensal.tsx` | Modificação | Novo Metrica, filtro vazios, selectedMes, click handler, render drawer |
| `ChurnDetalheDrawer.tsx` | Novo componente | Sheet completo com React Query fetch |
| `server/routes/churnProdutoMotivo.ts` | Modificação | Novo endpoint `/api/churn/produto-mes-detalhe` |

---

## Fora de escopo

- Filtro de período no drawer (sempre mostra o mês clicado)
- Export de dados do drawer
- Mudanças nos outros dois gráficos da mesma página (linha por produto, linha por motivo)
