# Spec: Aba Churn Produto × Motivo

**Data:** 2026-06-08  
**Objetivo:** Análise diagnóstica de causas de churn por produto × motivo de cancelamento, acessível via nova aba em Churn Detalhamento

---

## Localização no App

Nova aba **"Produto × Motivo"** na página existente `ChurnDetalhamento` (`/dashboard/churn-detalhamento`). Sem nova rota ou entrada no menu.

---

## Fontes de Dados

- `cortex_core.vw_churn_detalhado_produto` — visão agregada dos últimos 12 meses (produto × motivo)
- `cortex_core.vw_churn_produto_motivo_mensal` — série temporal histórica (reservada para uso futuro, endpoint criado mas não consumido no frontend desta versão)

---

## Arquivos

| Ação | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Criar | `server/routes/churnProdutoMotivo.ts` | Dois endpoints de API |
| Criar | `client/src/components/churn-detalhamento/ChurnProdutoMotivo.tsx` | Componente principal da aba |
| Modificar | `server/routes.ts` | Registrar a nova rota |
| Modificar | `client/src/pages/ChurnDetalhamento.tsx` | Adicionar nova aba |

---

## API

### `GET /api/churn/produto-motivo`

Retorna dados da `vw_churn_detalhado_produto` transformados para o heatmap.

**Response:**
```typescript
{
  produtos: string[],           // produtos únicos, ordenados por mrr_perdido desc
  motivos: string[],            // top 8 motivos por volume total, resto agrupado em "Outros"
  celulas: Array<{
    produto: string,
    motivo_cancelamento: string,
    cancelamentos: number,
    mrr_perdido: number,        // numeric(2) do banco
    ticket_medio: number,       // numeric(2) do banco
    pct_dentro_produto: number,
    pct_total: number
  }>,
  totais: {
    cancelamentos: number,
    mrr_perdido: number,
    ticket_medio: number
  }
}
```

**Agrupamento "Outros":** motivos fora do top 8 são somados numa célula `motivo_cancelamento: "Outros"` por produto.

### `GET /api/churn/produto-motivo/mensal`

Retorna dados brutos da `vw_churn_produto_motivo_mensal`.

**Response:**
```typescript
{
  rows: Array<{
    ano_mes: string,            // ISO date "2026-05-01"
    produto: string,
    motivo_cancelamento: string,
    cancelamentos: number,
    mrr_perdido: number,
    ticket_medio: number
  }>
}
```

**Autenticação:** ambos os endpoints atrás de `isAuthenticated` (padrão do projeto).

---

## Componente `ChurnProdutoMotivo.tsx`

### Cards de Resumo (topo)

Três cards lado a lado:
- **Total Cancelamentos** — soma de `totais.cancelamentos`
- **MRR Perdido** — `totais.mrr_perdido` formatado como moeda
- **Ticket Médio** — `totais.ticket_medio` formatado como moeda

### Heatmap

Tabela estilizada com:
- **Linhas** = produtos (ordem: maior `mrr_perdido` primeiro)
- **Colunas** = motivos (top 8 por volume + coluna "Outros")
- **Célula** = `pct_dentro_produto` exibido em %, cor de fundo interpolada branco→roxo (`#ede9fe` → `#6d28d9`) proporcional ao valor
- **Hover** em célula: tooltip com `cancelamentos`, `mrr_perdido` formatado, `pct_dentro_produto`%
- **Clique na linha (produto)** → seleciona produto e exibe drill-down abaixo; segundo clique deseleciona

### Drill-down (condicional)

Aparece abaixo do heatmap quando um produto está selecionado:
- Título: "Motivos de churn — {produto selecionado}"
- `BarChart` horizontal (Recharts) com motivos no eixo Y, cancelamentos no eixo X
- Cada barra mostra: contagem + `pct_dentro_produto`% + `mrr_perdido`

### Tabela Detalhada (collapsible)

Abaixo do drill-down, recolhida por padrão:
- Título: "Dados completos" com botão expandir/recolher
- Colunas: Produto | Motivo | Cancelamentos | MRR Perdido | Ticket Médio | % no Produto
- Ordenação por clique em cabeçalho de coluna
- Mostra todas as células sem filtro de produto

### Período

Label fixo no topo da aba: **"Últimos 12 meses"**. Sem seletor de período nesta versão.

### Loading / Error States

- Enquanto carrega: skeleton com `animate-pulse` cobrindo a área do heatmap
- Em erro: mensagem simples "Não foi possível carregar os dados"

### Dark Mode

Todas as classes Tailwind com variante `dark:` conforme padrão do projeto.

---

## Integração em ChurnDetalhamento

Adicionar tab `"Produto × Motivo"` na lista de tabs existente. O componente `ChurnProdutoMotivo` só monta (e faz fetch) quando a tab está ativa — lazy mount via condicional `activeTab === "produto-motivo"`.

---

## Fora do Escopo

- Filtro de período customizável
- Exportação CSV
- Série temporal / gráfico de evolução mensal (view mensal criada, mas não consumida no frontend)
- Integração com outros filtros da página (squad, vendedor)
