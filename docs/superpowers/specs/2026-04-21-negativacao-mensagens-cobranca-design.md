# Design: Mensagens de Cobrança no Drawer de Negativação

## Contexto

A aba de Negativação (`/financeiro/negativacao`) exibe um Kanban de clientes inadimplentes com 4 etapas (notificação → protesto → negativação → ação judicial). Ao clicar em um card, abre-se um drawer com timeline de ações e formulário de edição.

O sistema TurboZap envia mensagens de cobrança via WhatsApp automaticamente (D-3 a D+55) e registra tudo na tabela `cortex_core.turbozap_envios`. Atualmente, essas mensagens não são visíveis no drawer de detalhes do cliente na aba de negativação.

## Objetivo

Exibir o histórico completo de mensagens de cobrança enviadas ao cliente em uma seção dedicada no drawer de detalhes, abaixo da timeline de ações existente.

## Design

### Seção "Mensagens de Cobrança"

**Posição:** Abaixo da timeline de ações no drawer de detalhes do cliente.

**Cabeçalho:**
- Ícone de WhatsApp (MessageSquare ou similar do Lucide)
- Título "Mensagens de Cobrança"
- Badge com contagem total de mensagens

**Cada item exibe:**

| Campo | Fonte (`turbozap_envios`) | Apresentação |
|-------|--------------------------|--------------|
| Tipo de cobrança | `tipo_cobranca` | Badge colorido (ex: "D+30", "D+50") |
| Data de envio | `criado_em` | Formato dd/mm/yyyy HH:mm |
| Valor cobrado | `valor` | Formatado R$ com 2 decimais |
| Telefone | `telefone` | Texto simples |
| Status | `status` | Ícone: verde ✓ (enviado), vermelho ✗ (erro), cinza ⏭ (pulado) |

**Ordenação:** Cronológica decrescente (mais recente primeiro).

**Estado vazio:** "Nenhuma mensagem de cobrança encontrada para este cliente."

**Tema:** Suporte completo dark/light mode usando classes Tailwind com `dark:` variants.

### Backend

**Novo endpoint:** `GET /api/negativacao/mensagens/:clienteId`

- Consulta `cortex_core.turbozap_envios` filtrando por `id_cliente = :clienteId`
- Retorna campos: `tipo_cobranca`, `criado_em`, `valor`, `telefone`, `status`
- Ordenado por `criado_em DESC`
- Sem paginação (histórico completo)

**Localização:** Adicionado ao arquivo `server/routes/negativacao.ts` junto com os demais endpoints de negativação.

### Frontend

**Localização:** Dentro do drawer de detalhes em `client/src/pages/Negativacao.tsx`.

**Comportamento:**
- Fetch disparado ao abrir o drawer (quando `selectedCliente` é definido)
- Loading state enquanto carrega
- Renderiza a lista de mensagens abaixo da timeline existente

### Fora do escopo

- Edição ou reenvio de mensagens
- Filtros ou busca na lista de mensagens
- Exibição do texto completo da mensagem (`mensagem_enviada`)
- Paginação
- Qualquer alteração nos cards do Kanban (mudança apenas no drawer)
