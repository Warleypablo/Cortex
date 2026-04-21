# Design: Remoção automática de clientes quitados da Negativação

## Contexto

A aba de Negativação (`/financeiro/negativacao`) exibe um Kanban com clientes inadimplentes. Atualmente, quando um cliente paga todas as parcelas pendentes no Conta Azul, ele continua aparecendo no Kanban até ser removido manualmente. Isso gera ruído e informação desatualizada.

## Objetivo

Remover automaticamente do Kanban os clientes que já quitaram todas as parcelas pendentes, marcando suas ações como `concluido` com observação automática.

## Design

### Lógica de verificação

No endpoint `GET /api/negativacao/kanban`, **antes de retornar os dados**, executar:

1. Buscar todos os `cliente_id` distintos de `cortex_core.negativacao_acoes` com status ativo (`pendente` ou `em_andamento`)
2. Para cada um, verificar na `"Conta Azul".caz_parcelas` se a soma de `nao_pago` > 0 (excluindo `tipo_evento = 'DESPESA'`)
3. Se soma = 0 (cliente não deve nada) → atualizar todas as ações ativas desse cliente para:
   - `status = 'concluido'`
   - `observacoes = 'Quitado - removido automaticamente'`
   - `atualizado_em = NOW()`
4. Retornar o Kanban normalmente — clientes quitados não aparecem pois estão `concluido`

### Implementação

**Arquivo:** `server/routes/negativacao.ts` — endpoint `GET /api/negativacao/kanban`

**Abordagem:** Uma única query SQL com subquery que identifica clientes sem débito, seguida de um UPDATE em batch. Executa antes da query principal existente.

```sql
UPDATE cortex_core.negativacao_acoes
SET status = 'concluido',
    observacoes = 'Quitado - removido automaticamente',
    atualizado_em = NOW()
WHERE status IN ('pendente', 'em_andamento')
  AND cliente_id IN (
    SELECT DISTINCT n.cliente_id
    FROM cortex_core.negativacao_acoes n
    LEFT JOIN "Conta Azul".caz_parcelas p
      ON p.id_cliente::text = n.cliente_id::text
      AND p.nao_pago > 0
      AND p.tipo_evento != 'DESPESA'
    WHERE n.status IN ('pendente', 'em_andamento')
    GROUP BY n.cliente_id
    HAVING COALESCE(SUM(p.nao_pago), 0) = 0
  )
```

### Sem alteração no frontend

O frontend já filtra por status — ações com `concluido` não são exibidas como cards ativos no Kanban.

### Fora do escopo

- Cron job separado
- Novo status "quitado" (usa `concluido` existente)
- Notificações de remoção
- Alterações visuais no frontend
