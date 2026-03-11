# Top MRR por Area - Design Spec

## Context
TASK-11: "Mostrar Top MRR por area" solicitado por Rafael Vilella.
Areas definidas como agrupamento de squads:
- **Comunicacao**: Makers, Pulse
- **Performance**: todos os demais squads

## Location
Nova secao na pagina `AnaliseSquads.tsx`, abaixo dos componentes existentes.

## Data Source
- Tabela: `"Clickup".cup_contratos` (contratos ativos, `valorr > 0`)
- Join com `"Clickup".cup_clientes` via `id_task` para obter nome do cliente
- Filtro de status: `IN ('ativo', 'onboarding', 'triagem')`
- Historico: `"Clickup".cup_data_hist` para meses anteriores ao atual

## Area Mapping
```typescript
const AREA_SQUADS: Record<string, string[]> = {
  "Comunicacao": ["Makers", "Pulse"],
  "Performance": [] // all other squads
};
```

## Backend

### Endpoint
`GET /api/analise-squads/top-mrr-area?mesAno=YYYY-MM`

### Response
```json
{
  "comunicacao": {
    "mrr": 150000,
    "contratos": 45,
    "ticketMedio": 3333.33,
    "clientes": [
      {
        "nome": "Cliente X",
        "squad": "Makers",
        "mrr": 12000,
        "contratos": 3,
        "responsavel": "Fulano"
      }
    ]
  },
  "performance": {
    "mrr": 350000,
    "contratos": 120,
    "ticketMedio": 2916.67,
    "clientes": [...]
  }
}
```

### Query Logic
1. Query `cup_contratos` (or `cup_data_hist` for past months) with active status filter
2. Join `cup_clientes` on `id_task` for client name
3. Classify each contract's squad into Comunicacao or Performance
4. Aggregate per client: SUM(valorr), COUNT(contratos)
5. Sort by MRR descending within each area

## Frontend

### Component: `TopMrrPorArea.tsx`
- Receives `mesAno` prop from parent AnaliseSquads page
- Fetches data from `/api/analise-squads/top-mrr-area?mesAno=...`
- Renders 2 cards side by side (responsive: stacked on mobile)

### Card Layout
Each card contains:
1. **Header**: area name + color indicator
2. **KPI row**: MRR total | Contratos ativos | Ticket medio
3. **Scrollable table** (max-h-96 overflow-y-auto):
   - Columns: Nome, Squad, MRR (R$), Responsavel
   - Sorted by MRR descending
   - All clients listed (no limit)

### Styling
- Dark/light mode via Tailwind `dark:` variants
- Comunicacao color: pink/magenta accent
- Performance color: blue/indigo accent
- Currency formatted with `formatCurrencyNoDecimals` utility

## Dependencies
- Existing `mesAno` selector in AnaliseSquads
- Existing SQUAD_COLORS map
- React Query for data fetching
- Tailwind CSS for styling
