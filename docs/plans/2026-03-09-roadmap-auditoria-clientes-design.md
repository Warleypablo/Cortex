# Roadmap de Auditoria de Clientes

## Objetivo

Criar uma página de auditoria visual (pipeline Kanban) que rastreia o caminho completo do cliente através dos 3 sistemas: **Bitrix** (CRM/venda) → **ClickUp** (operação/contratos) → **Conta Azul** (financeiro/cobrança). Identifica divergências de valores e clientes que se perderam entre etapas.

## Decisões de Design

| Decisão | Escolha |
|---------|---------|
| Tipo de página | Nova página separada (não evolução da existente) |
| Foco | Divergências de valor + clientes faltando no pipe (ambos) |
| Interface | Pipeline visual Kanban (3 colunas) |
| Validação Conta Azul | Soma das parcelas do mês atual |
| Match Bitrix↔ClickUp | Fuzzy com pg_trgm, similarity >= 0.8 |

## Arquitetura de Dados

### Endpoint: `GET /api/auditoria/roadmap-clientes`

**Parâmetros:** `month` (YYYY-MM), `threshold` (% divergência, default 5)

### Query (3 CTEs):

1. **`bitrix_deals`** — Deals de `"Bitrix".crm_deal` onde `stage_name = 'Negócio Ganho'` no mês selecionado (por `data_fechamento`). Campos: `company_name`, `valor_recorrente`, `valor_pontual`, `closer`, `data_fechamento`.

2. **`clickup_clientes`** — Clientes de `cup_clientes` JOIN `cup_contratos` (status ativo/onboarding). Campos: `nome`, `cnpj`, `SUM(valorr)` como `valor_clickup`, contagem de contratos.

3. **`contaazul_parcelas`** — `caz_parcelas` JOIN `caz_clientes` no mês (tipo recebimento). Campos: `cnpj`, `nome`, `SUM(valor_bruto)` como `valor_contaazul`.

### Matching:
- ClickUp ↔ Conta Azul: JOIN por `cnpj`
- Bitrix ↔ ClickUp: `pg_trgm` similarity(`company_name`, `nome`) >= 0.8
- Normalização prévia: lowercase, remover "ltda", "me", "sa", "eireli", "- epp", acentos

### Interface de Retorno:

```typescript
interface AuditoriaRoadmapItem {
  clienteNome: string;
  cnpj: string | null;

  // Bitrix
  bitrix_encontrado: boolean;
  bitrix_valor_recorrente: number;
  bitrix_valor_pontual: number;
  bitrix_closer: string;
  bitrix_data_fechamento: string;
  bitrix_company_name: string;
  bitrix_match_score: number;

  // ClickUp
  clickup_encontrado: boolean;
  clickup_valor_total: number;
  clickup_qtd_contratos: number;
  clickup_status: string;
  clickup_squad: string;

  // Conta Azul
  contaazul_encontrado: boolean;
  contaazul_valor_mes: number;
  contaazul_qtd_parcelas: number;

  // Divergências
  divergencia_bitrix_clickup: number;
  divergencia_clickup_contaazul: number;
  status: 'ok' | 'divergencia_valor' | 'faltando_clickup' | 'faltando_contaazul' | 'faltando_ambos';
}
```

## Interface Visual

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  Roadmap de Auditoria de Clientes                       │
│  [Mês ▼]  [Tolerância ▼]  [Status ▼]  [Busca 🔍]     │
├─────────────────────────────────────────────────────────┤
│  [Total Clientes] [Divergências] [Faltando] [MRR Risco]│
├─────────────────────────────────────────────────────────┤
│  ┌─ BITRIX ──────┐ ┌─ CLICKUP ─────┐ ┌─ CONTA AZUL ─┐│
│  │ Negócio Ganho │ │ Contratos     │ │ Parcelas Mês  ││
│  │               │ │               │ │               ││
│  │ [Card]  ────→ │ │ [Card]  ────→ │ │ [Card]        ││
│  │ [Card]  ────→ │ │ [Card]  ────→ │ │ [Card]        ││
│  │ [Card]  ✗     │ │               │ │               ││
│  └───────────────┘ └───────────────┘ └───────────────┘│
└─────────────────────────────────────────────────────────┘
```

### Cards dos Clientes

- Nome do cliente
- Valor naquele sistema
- Status visual: ✅ ok | ⚠️ divergência | 🔴 não encontrado no próximo
- Setas visuais conectando o mesmo cliente entre colunas

### Cards Resumo (Hero)

- **Total de Clientes** no pipe
- **Divergências de Valor** (count com valor > threshold)
- **Faltando no Pipe** (clientes que existem num sistema mas não no próximo)
- **MRR em Risco** (soma dos valores divergentes)

### Painel Lateral (ao clicar no card)

Detalhe completo: valores em cada sistema, datas, contratos individuais, parcelas

### Filtros

- Mês de referência
- Tolerância de divergência (5%, 10%, 20%)
- Status: Todos | Só divergências | Só faltantes
- Busca por nome

## Navegação

- Rota: `/dashboard/roadmap-auditoria`
- Seção: Financeiro
- Permissão: `fin.roadmap_auditoria`

## Performance

- React Query com `staleTime: 5min` (query pesada por causa do fuzzy)
- Fuzzy match limitado a deals "Negócio Ganho" do mês (reduz combinações)
- Habilitar extensão `pg_trgm` no banco se não estiver habilitada
