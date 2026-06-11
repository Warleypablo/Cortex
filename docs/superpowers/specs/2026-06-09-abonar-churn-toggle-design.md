# Spec: Toggle Abonar Churn no Detalhamento

**Data:** 2026-06-09  
**Componente alvo:** `client/src/pages/ChurnDetalhamento.tsx` (aba Contratos)

---

## Contexto

A tela "Detalhamento de Churn" exibe a lista de contratos encerrados. O campo `abonar_churn` marca contratos que devem ser excluídos das métricas de churn (ex: cancelamentos por erro de venda, inadimplência no 1º mês). Hoje esse campo só pode ser alterado fora da tela. O objetivo é permitir ativar/desativar o abono diretamente na tabela.

---

## Comportamento

- Aba "Contratos" ganha uma coluna **"Abonar"** ao final da tabela
- Cada linha exibe um `Switch` (shadcn/ui) com `checked={contrato.is_abonado}`
- Ao alternar:
  1. **Optimistic update** — estado local muda imediatamente, sem esperar resposta
  2. `PATCH /api/churn/abonar/:taskId` enviado com `{ abonar: boolean }`
  3. Se erro: reverte o estado e exibe `toast.error(...)`
- Quando `is_abonado = true`, a linha mantém o estilo de opacidade reduzida já existente

---

## Endpoint

### `PATCH /api/churn/abonar/:taskId`

**Auth:** `isAuthenticated` (sem role check adicional)

**Body:** `{ abonar: boolean }`

**Lógica:**
- `abonar === true` → `UPDATE "Clickup".cup_churn SET abonar_churn = 'Sim' WHERE task_id = $taskId`
- `abonar === false` → `UPDATE "Clickup".cup_churn SET abonar_churn = NULL WHERE task_id = $taskId`

**Response:** `{ ok: true }`

**Erro:** 400 se `taskId` ausente, 500 em falha de DB

---

## Arquitetura — o que muda onde

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `server/routes.ts` | Modificação | Novo endpoint `PATCH /api/churn/abonar/:taskId` |
| `client/src/pages/ChurnDetalhamento.tsx` | Modificação | Nova coluna "Abonar" com Switch + optimistic update |

---

## Fora de escopo

- Histórico de quem abonó/desabonó
- Restrição de role (qualquer usuário autenticado pode alternar)
- Recalcular métricas em tempo real após toggle (página já refetch ao reabrir)
