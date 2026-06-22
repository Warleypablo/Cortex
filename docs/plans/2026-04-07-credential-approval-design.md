# Design: Aprovação de Credenciais via WhatsApp

**Data:** 2026-04-07
**Status:** Aprovado

## Resumo

Senhas de clientes ficam bloqueadas para todos exceto admins e Breno Carmo. Ao clicar no olho, uma notificação WhatsApp com botões interativos é enviada para aprovadores. Ao aprovar/reprovar, o usuário recebe feedback via toast.

## Fluxo

```
Usuário clica no olho
  → É admin ou Breno? → Mostra senha normalmente
  → Não é? → Cria solicitação no banco (status: pendente)
           → Envia WhatsApp com botões [Aprovar] [Reprovar]
           → Toast: "Solicitação enviada, aguarde aprovação"

Aprovador clica [Aprovar] no WhatsApp
  → Webhook recebe callback → Atualiza status para "aprovado"
  → Próximo polling do frontend detecta → Toast "Aprovado!"
  → Senha desbloqueada para aquele usuário/cliente pela sessão

Aprovador clica [Reprovar]
  → Webhook recebe callback → Atualiza status para "reprovado"
  → Próximo polling → Toast "Solicitação reprovada"
```

## Banco de Dados

Nova tabela `cortex_core.credential_access_requests`:
- `id` (UUID, PK)
- `user_email` (VARCHAR)
- `user_name` (VARCHAR)
- `client_id` (UUID)
- `client_name` (VARCHAR)
- `credential_id` (UUID)
- `platform` (VARCHAR)
- `status` (VARCHAR: pendente, aprovado, reprovado)
- `approved_by` (VARCHAR, nullable)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

## Backend - Novas Rotas

- **POST `/api/acessos/request-access`** — cria solicitação + envia WhatsApp com botões
- **POST `/api/acessos/webhook/credential-approval`** — recebe callback dos botões do WhatsApp
- **GET `/api/acessos/check-access/:credentialId`** — polling para saber se foi aprovado
- **GET `/api/acessos/credentials/:clientId`** — omite senhas para não-admins sem aprovação ativa

## WhatsApp (Evolution API)

Mensagem com botões interativos via Evolution API. Texto inclui: quem solicitou, qual cliente, qual plataforma. Botões: "Aprovar" e "Reprovar". Callback via webhook.

## Frontend

- Olho continua igual para admins/Breno
- Para demais: clique no olho → chama `request-access` → toast "Aguardando aprovação"
- Polling a cada 5s enquanto houver solicitação pendente
- Ao aprovar: toast + senha desbloqueada para sessão (estado local)
- Ao reprovar: toast "Solicitação reprovada"

## Aprovadores com Acesso Direto

- Admins: `caio.massaroni@turbopartners.com.br`, `warley.silva@turbopartners.com.br`
- Breno Carmo (email a confirmar)

## Números que Recebem Notificação

- Breno Carmo: `557199993135`
- Warley: `5527997823958`
