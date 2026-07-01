# Capacity por função (Selva / Black / Squadra) — Design

**Data:** 2026-06-30
**Página:** `/capacity-times` (`client/src/pages/CapacityTimes.tsx`)

## Objetivo

Reorganizar a aba de Capacity para agrupar pessoas por **função**, usando o
**cargo no RH** (`"Inhire".rh_pessoal`) como fonte de verdade:

- **Selva** = Designers (`cargo = 'Designer'`)
- **Black** = Accounts (`cargo ILIKE '%account%'` — cargo que o RH vai criar)
- **Squadra** = GPs (`cargo = 'Gestor de Performance'`)

Mapa cargo→grupo centralizado em `shared/capacityGrupos.ts` (fácil de ajustar
quando o RH padronizar os cargos).

## Réguas de cálculo

### Squadra (GPs) e Black (Accounts) — igual ao modelo atual
- Carteira via campo `responsavel` dos contratos (fuzzy match `similarity > 0.4`).
- Métricas: MRR (`valorr`), contas, status (ativo/onboarding/cancelamento).
- Caps (`cap_mrr`, `cap_contas`) reaproveitadas de `cortex_core.capacity_metas`,
  casadas por nome (similarity). Editáveis na aba Configurar.
- Black fica vazia até o RH ter o cargo de account; popula sozinha depois.

### Selva (Designers) — régua nova
Designers quase não aparecem como `responsavel` (4/18) → carteira medida pelo
**squad de CS** do designer (`rh_pessoal.squad` ↔ `cup_contratos.squad`,
normalizados sem emoji).

- **Capacity por Faturamento = Recorrente + Pontual** (`valorr + valorp`).
- **Cap. derivada do TM da carteira:** `Cap (R$) = Ticket Médio × META_CONTAS_DESIGNER`.
- `fatia/designer = faturamento_squad ÷ nº designers do squad`.
- `% ocupação = fatia ÷ cap`.
- `META_CONTAS_DESIGNER` é constante configurável (default a calibrar com o time).

Colunas Selva: Designer · Squad · Faturamento (Rec+Pont) · Contas · Ticket Médio
· Fatia/Designer · Cap. (R$) · % Ocupação.

## Fora de escopo (removido da renderização)
- Squads operacionais antigos (Pulse, Olimpo) e vendedores (Selva = closers).
- Dados em `capacity_metas` **não** são apagados, só deixam de ser renderizados
  como abas próprias (ainda servem de fonte de caps por nome).

## Aprovação
Design aprovado por Ichino no chat (2026-06-30): "pode seguir".
Fórmulas da Selva são proposta inicial, ajustáveis após validação visual.
