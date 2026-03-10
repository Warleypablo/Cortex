# Funil de Vendas em Tempo Real - Design Spec

**Data:** 2026-03-10
**Status:** Aprovado

## Resumo

Pagina dedicada para visualizacao do pipeline de vendas com funil visual (barras decrescentes), KPIs, metricas de conversao entre etapas, e tabela de deals individuais. Dados vem de `"Bitrix".crm_deal`. Filtros por periodo, closer, SDR e fonte.

## Fonte de Dados

Tabela principal: `"Bitrix".crm_deal`

Campos utilizados:
- `stage_name` - Etapa do deal (ex: "Lead", "Qualificado", "Reuniao Agendada", "Proposta", "Negociacao", "Negocio Ganho", "Negocio Perdido")
- `category_name` - Pipeline/funil do Bitrix
- `closer` - ID do closer responsavel
- `sdr` - SDR de origem
- `source` / `source_id` - Fonte do lead
- `valor_recorrente` - MRR do deal
- `valor_pontual` - Valor one-time
- `date_create` - Data de criacao
- `data_fechamento` - Data de fechamento
- `title` - Titulo do deal
- `company_id` - Empresa vinculada

Tabelas auxiliares:
- `"Bitrix".crm_closers` - Lista de closers (id, name)
- `"Bitrix".crm_users` - Lista de usuarios

## Mapeamento de Etapas

Ordem logica do funil (hardcoded, baseada nos stage_name reais do Bitrix):

```typescript
const FUNNEL_STAGES = [
  { key: "lead", names: ["Novo", "Lead", "Lead Novo", "Contato Inicial"], label: "Lead" },
  { key: "qualificado", names: ["Qualificado", "Qualificação"], label: "Qualificado" },
  { key: "reuniao", names: ["Reunião Agendada", "Reunião Realizada"], label: "Reunião" },
  { key: "proposta", names: ["Proposta", "Proposta Enviada", "Apresentação"], label: "Proposta" },
  { key: "negociacao", names: ["Negociação", "Em negociação", "Fechamento"], label: "Negociação" },
  { key: "ganho", names: ["Negócio Ganho", "Ganho"], label: "Ganho" },
  { key: "perdido", names: ["Negócio Perdido", "Negócio perdido", "Perdido", "Descartado", "Descartado/sem fit"], label: "Perdido" },
];
```

Deals cujo `stage_name` nao bate com nenhum mapeamento vao para uma categoria "Outros".

## API Endpoints

### GET /api/comercial/funil/filtros
Retorna listas para popular dropdowns.

```json
{
  "closers": [{ "id": 1, "name": "João" }],
  "sdrs": ["Maria", "Pedro"],
  "sources": ["Google", "Indicação", "Evento"]
}
```

### GET /api/comercial/funil/etapas
Query params: `dataInicio`, `dataFim`, `closer`, `sdr`, `source`

Retorna metricas agregadas por etapa do funil.

```json
{
  "etapas": [
    { "key": "lead", "label": "Lead", "count": 150, "valor": 450000 },
    { "key": "qualificado", "label": "Qualificado", "count": 80, "valor": 320000 },
    { "key": "reuniao", "label": "Reunião", "count": 50, "valor": 250000 },
    { "key": "proposta", "label": "Proposta", "count": 30, "valor": 200000 },
    { "key": "negociacao", "label": "Negociação", "count": 15, "valor": 120000 },
    { "key": "ganho", "label": "Ganho", "count": 10, "valor": 90000 },
    { "key": "perdido", "label": "Perdido", "count": 25, "valor": 0 }
  ],
  "kpis": {
    "total_deals": 360,
    "valor_pipeline": 1430000,
    "taxa_conversao": 6.7,
    "ticket_medio": 9000
  }
}
```

Conversao entre etapas: calculada no frontend como `etapa[i].count / etapa[i-1].count * 100`.

### GET /api/comercial/funil/deals
Query params: `dataInicio`, `dataFim`, `closer`, `sdr`, `source`, `stage` (key do funil), `limit`, `offset`

```json
[
  {
    "id": 123,
    "title": "Projeto XYZ",
    "company_name": "Empresa ABC",
    "closer_name": "João",
    "sdr": "Maria",
    "valor_recorrente": 5000,
    "valor_pontual": 2000,
    "stage_name": "Proposta Enviada",
    "stage_key": "proposta",
    "source": "Google",
    "date_create": "2026-01-15",
    "data_fechamento": null
  }
]
```

## Frontend

### Pagina: FunilVendas.tsx
Rota: `/comercial/funil`

### Layout

1. **Header** - Titulo + filtros inline (Select de periodo, closer, SDR, fonte)

2. **KPI Cards** (4 cards em grid):
   - Total de Deals (icone: Users)
   - Valor do Pipeline (icone: DollarSign)
   - Taxa de Conversao Geral (icone: TrendingUp)
   - Ticket Medio (icone: Target)

3. **Funil Visual** - Container com barras horizontais decrescentes:
   - Cada barra: width proporcional ao count (lead = 100%, proximas diminuem)
   - Cor gradient por etapa (azul → verde para ganho, vermelho para perdido)
   - Label: nome da etapa, quantidade, valor formatado
   - Entre barras: badge com % conversao
   - Clique na barra: seta `selectedStage` para filtrar tabela abaixo
   - Ganho e Perdido ficam lado a lado na ultima linha

4. **Tabela de Deals**:
   - Filtrada por `selectedStage` (ou mostra todos)
   - Colunas: Empresa, Titulo, Closer, SDR, MRR, Pontual, Etapa, Fonte, Data Criacao
   - Paginacao simples
   - Hover highlight, dark/light mode

### Dark/Light Mode
Todos os componentes com classes `dark:` do Tailwind.

## Arquivos Impactados

### Backend
1. `server/routes/comercial.ts` - 3 novos endpoints (funil/filtros, funil/etapas, funil/deals)

### Frontend
2. `client/src/pages/FunilVendas.tsx` (novo) - Pagina completa do funil
3. `client/src/App.tsx` - Adicionar rota `/comercial/funil`

## Decisoes

- **Pagina dedicada** - Nao mistura com dashboards existentes
- **Etapas hardcoded** - Mapeamento de stage_name → etapa logica no backend (evita depender de IDs do Bitrix)
- **Conversao no frontend** - Calculo simples de % entre etapas adjacentes
- **Sem WebSocket** - React Query refetch on focus e suficiente
- **Todos os funis** - Agrega deals de todos os pipelines do Bitrix
- **Funil visual com barras** - Mais intuitivo que chart/pie, e interativo (filtra tabela)
