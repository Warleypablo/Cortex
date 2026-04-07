# Design: Exclusão de Contratos Freelancers com Assinafy

**Data:** 2026-04-07
**Status:** Aprovado

## Resumo

Botão de excluir em todos os contratos freelancers. Soft delete (status = 'excluido'). Confirmação extra com warning para contratos enviados/assinados. Se o contrato tem assinafy_document_id, chama DELETE na API do Assinafy antes de atualizar o status local.

## Fluxo

```
Usuário clica lixeira no contrato
  → Status é rascunho/recusado? → Confirmação simples
  → Status é enviado/assinado? → Warning sobre cancelamento no Assinafy
  → Confirma? → Backend:
    1. Se tem assinafy_document_id → DELETE /documents/{documentId} na Assinafy
    2. UPDATE contratos_creators SET status = 'excluido'
    3. Retorna sucesso
  → Erro na Assinafy? → Exclui local mesmo assim (log do erro)
```

## Backend

- DELETE /api/creators/contratos/:id
- Busca contrato, chama Assinafy se necessário, soft delete

## Frontend

- Botão lixeira em cada contrato (Todos os Contratos + view por creator)
- AlertDialog com warning extra para enviados/assinados
- Contratos excluídos filtrados das listagens

## Assinafy API

```
DELETE https://api.assinafy.com.br/v1/documents/{documentId}
Headers: X-Api-Key: {api_key}
```
