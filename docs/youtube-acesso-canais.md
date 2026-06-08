# YouTube — Como dar acesso dos canais à Data Central

> Objetivo: trazer as métricas (inscritos, views, tempo assistido, engajamento) dos
> canais de YouTube dos sócios para a Data Central da Turbo.

## Por que não é só "logar e autorizar"

A tela de consentimento OAuth do nosso projeto Google (Data Central) está em modo
**Internal** — ou seja, **só contas `@turbopartners.com.br` conseguem autorizar**.
Uma conta Google pessoal (Gmail comum do sócio) será **bloqueada** pelo Google na hora
de conectar.

Por isso o modelo é: **uma conta Turbo entra como gerente do canal**, e é essa conta
Turbo quem faz a autorização. Uma única autorização da conta Turbo já traz **todos os
canais que ela gerencia**.

---

## Passo 1 — Descobrir se o canal é "Conta de Marca" (Brand Account)

O dono do canal faz (leva 1 minuto):

1. Entrar em **studio.youtube.com** com a conta dele
2. **Configurações** (engrenagem, canto inferior esquerdo) → aba **Permissões**
3. Verificar:
   - ✅ Aparece lista de pessoas com botão **"Convidar"** → **é Brand Account** → vá pro Passo 2A
   - ⚠️ Aparece aviso **"Para adicionar gerentes, mova o canal para uma Conta de Marca"**
     → **é canal pessoal** → vá pro Passo 2B

Checagem alternativa: abrir **https://myaccount.google.com/brandaccounts** com a conta
do dono. Se o canal aparecer ali, é Brand Account.

---

## Passo 2A — Canal é Brand Account: adicionar a conta Turbo como gerente

1. Dono em **studio.youtube.com** → **Configurações** → **Permissões** → **Convidar**
2. Adicionar o e-mail da conta Turbo (ex.: `ferramentas@turbopartners.com.br`)
3. Papel: **Gerente**
   - *(Se depois o Analytics não vier pela API, subir o papel para **Proprietário**.)*
4. A conta Turbo aceita o convite (chega por e-mail)

→ Seguir pro Passo 3.

---

## Passo 2B — Canal é pessoal: migrar para Conta de Marca primeiro

Canal pessoal **não permite** adicionar gerentes. É preciso mover o canal para uma
Conta de Marca antes:

1. Dono em **youtube.com** → avatar → **Configurações** → **Configurações avançadas**
2. Opção **"Mover canal para uma conta de marca"**
3. Seguir o fluxo do Google

> ⚠️ Atenção: a migração tem regras (o canal não pode já estar vinculado a outra Conta
> de Marca, etc.) e algumas mudanças são difíceis de reverter. Fazer com calma.

Depois de migrado → voltar pro **Passo 2A**.

---

## Passo 3 — A conta Turbo autoriza na Data Central

Com a conta Turbo já como gerente do(s) canal(is):

1. Logar na conta Turbo no navegador
2. Acessar **`/api/oauth/youtube/start`** (na Data Central)
3. Concluir o consentimento do Google

O sistema descobre automaticamente todos os canais que essa conta Turbo gerencia e salva
as credenciais (`youtube.credentials` + `youtube.channels`).

---

## Passo 4 — Rodar o sync e conferir

Endpoints admin (exigem usuário com papel `admin`):

- **Disparar sync:** `POST /api/admin/youtube/sync`
  - `?days=30` → janela das métricas diárias (padrão 30)
  - `?skipVideos=true` → pula a listagem de vídeos (sync mais rápido)
- **Conferir status:** `GET /api/admin/youtube/status`
  - retorna canais autorizados, range das métricas diárias e últimas execuções

Validar com **um canal** antes de escalar para os demais (em especial confirmar que o
papel "Gerente" libera o Analytics via API; se não, usar "Proprietário").

---

## Resumo do fluxo

```
Canal é Brand Account?
├── Sim → dono adiciona conta Turbo como Gerente (Passo 2A)
└── Não → dono migra canal para Conta de Marca (Passo 2B) → depois 2A
                                │
                                ▼
        Conta Turbo autoriza em /api/oauth/youtube/start (Passo 3)
                                │
                                ▼
        POST /api/admin/youtube/sync  →  GET /api/admin/youtube/status (Passo 4)
```
