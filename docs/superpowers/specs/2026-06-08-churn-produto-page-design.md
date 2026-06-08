# Spec: Página Churn por Produto

**Data:** 2026-06-08
**Objetivo:** Página dedicada para análise de churn segmentada por produto, com heatmap produto×motivo e evolução temporal por produto.

---

## Localização no App

- **Rota:** `/dashboard/churn-produto`
- **Título:** "Churn por Produto"
- **Menu:** Seção "Gestão" no sidebar, abaixo de "Detalhamento de Churn"
- **Permission key:** `gestao.churn_produto` (novo)

---

## Origem dos Dados

Reutiliza os dois endpoints já existentes (criados para a aba em ChurnDetalhamento):

- `GET /api/churn/produto-motivo` — heatmap produto×motivo, últimos 12 meses
- `GET /api/churn/produto-motivo/mensal` — série temporal histórica, todos os meses disponíveis

Nenhuma nova API é necessária.

---

## Estrutura da Página

Duas abas no nível principal da página:

### Aba 1: "Produto × Motivo"

Componente: `ChurnProdutoMotivo` (já existente em `client/src/components/ChurnProdutoMotivo.tsx`)

Movido de `ChurnDetalhamento.tsx` para cá — sem alterações no componente.

### Aba 2: "Evolução Mensal"

Componente novo: `client/src/components/ChurnEvolucaoMensal.tsx`

**Layout:**
- Toggle no topo: "Cancelamentos" | "MRR Perdido" — controla a métrica exibida no eixo Y
- `LineChart` (Recharts) com:
  - X-axis: meses (`ano_mes` formatado como "Jan/26")
  - Y-axis: métrica selecionada (cancelamentos ou mrr_perdido)
  - Uma linha por produto, cada uma com cor distinta do array de cores do projeto
  - Legendas clicáveis para mostrar/esconder produtos individuais
  - Tooltip ao hover mostrando todos os produtos naquele mês
- Exibe histórico completo da view (sem filtro de período)
- Dark/light mode via `dark:` Tailwind e `useTheme()`

---

## Arquivos

| Ação | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Criar | `client/src/pages/ChurnProduto.tsx` | Página com header, 2 abas e montagem condicional dos componentes |
| Criar | `client/src/components/ChurnEvolucaoMensal.tsx` | Line chart de evolução mensal por produto |
| Modificar | `client/src/App.tsx` | Import lazy + rota `/dashboard/churn-produto` |
| Modificar | `shared/nav-config.ts` | Permission key `gestao.churn_produto` + entrada no menu Gestão |
| Modificar | `client/src/pages/ChurnDetalhamento.tsx` | Remover aba "Produto × Motivo" (tipo, TabsTrigger, renderização condicional, import) |

---

## Permissões

Em `shared/nav-config.ts`:

```typescript
// Em PERMISSION_KEYS.GESTAO:
CHURN_PRODUTO: 'gestao.churn_produto',

// Em permissionsToRoutes:
'/dashboard/churn-produto': PERMISSION_KEYS.GESTAO.CHURN_PRODUTO,

// Em NAV_CONFIG (seção Gestão, após Detalhamento de Churn):
{ title: 'Churn por Produto', url: '/dashboard/churn-produto', icon: 'TrendingDown', permissionKey: PERMISSION_KEYS.GESTAO.CHURN_PRODUTO },

// Em PERMISSION_LABELS:
[PERMISSION_KEYS.GESTAO.CHURN_PRODUTO]: 'Churn por Produto',
```

---

## Página `ChurnProduto.tsx`

Componente de página simples:

- Header com título "Churn por Produto" e `useSetPageInfo`
- Estado `activeTab: "produto-motivo" | "evolucao-mensal"` inicializado em `"produto-motivo"`
- `<Tabs>` com dois `TabsTrigger`:
  - "Produto × Motivo" (ícone `PieChart`)
  - "Evolução Mensal" (ícone `LineChart` do lucide-react)
- Renderização lazy: cada componente só monta quando a aba está ativa

---

## Componente `ChurnEvolucaoMensal.tsx`

```typescript
// Response type do endpoint /api/churn/produto-motivo/mensal
interface MensalRow {
  ano_mes: string;       // "2026-05-01"
  produto: string;
  motivo_cancelamento: string;
  cancelamentos: number;
  mrr_perdido: number;
  ticket_medio: number;
}
```

**Lógica de processamento:**
1. Buscar dados com `useQuery` em `/api/churn/produto-motivo/mensal`
2. Agregar por `(ano_mes, produto)` — somar cancelamentos e mrr_perdido desconsiderando motivo_cancelamento
3. Extrair lista de produtos únicos e lista de meses únicos ordenados
4. Construir dados no formato Recharts: array de objetos `{ mes: string, [produto]: number }`
5. Paleta de cores: array fixo de tons roxo/índigo/violeta para consistência visual

**Toggle de métrica:**
- Botões "Cancelamentos" | "MRR Perdido" no canto superior direito da card
- Estado local `metrica: "cancelamentos" | "mrr_perdido"`
- Troca apenas o `dataKey` das linhas e o formatter do tooltip/Y-axis

**Estados de loading/error:**
- Loading: skeleton `animate-pulse` cobrindo a área do gráfico
- Erro ou sem dados: mensagem "Sem dados disponíveis"

---

## Remoção de ChurnDetalhamento

Remover de `ChurnDetalhamento.tsx`:

1. `import { ChurnProdutoMotivo }` — linha do import
2. `"produto-motivo"` do tipo union de `mainTab`
3. `TabsTrigger value="produto-motivo"` do `TabsList`
4. `"produto-motivo"` do cast do `onValueChange`
5. Bloco condicional `mainTab === "produto-motivo"` na renderização

---

## Fora do Escopo

- Filtro de período customizável (página exibe janela fixa: 12M para heatmap, histórico completo para linha)
- Filtro por squad ou vendedor
- Exportação CSV
- Comparação entre períodos
