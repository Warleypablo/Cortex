# YouTube — Como dar acesso dos canais à Data Central

> Objetivo: trazer as métricas (inscritos, views, tempo assistido, engajamento) dos
> canais de YouTube dos sócios para a Data Central da Turbo.

## Contexto da decisão

Os canais dos sócios são **monetizados** e **não são Conta de Marca (Brand Account)**.
Migrar um canal monetizado para Brand Account mexe na vinculação do AdSense e é arriscado
demais só para ler analytics — então **descartamos o modelo de "conta Turbo como gerente"**.

A tela de consentimento OAuth da Data Central (projeto GCP `datalake-turbopartners`) está
em modo **Interno** — só contas `@turbopartners.com.br` conseguem autorizar. Como o "Tipo
de usuário" é **por projeto**, virar a DataLake inteira para External afetaria todas as
outras integrações (Google Ads etc.) e forçaria a verificação a cobrir todos os escopos.

**Caminho escolhido (Forma B):** criar um **projeto GCP dedicado só para o YouTube**, com
consent screen **External + verificado**. Aí o dono do canal autoriza com a **conta
pessoal dele**, sem tocar no canal, e a DataLake continua Interna e intacta.

---

## Passo 1 — Criar o projeto GCP dedicado

No [console.cloud.google.com](https://console.cloud.google.com):

1. Criar novo projeto, ex.: **"Turbo YouTube Analytics"**
2. **APIs e Serviços → Biblioteca** → ativar:
   - **YouTube Data API v3**
   - **YouTube Analytics API**

## Passo 2 — Configurar a tela de consentimento (External)

1. **APIs e Serviços → Tela de permissão OAuth** (Google Auth Platform)
2. Tipo de usuário: **Externo**
3. Preencher: nome do app, e-mail de suporte, domínio (`turbopartners.com.br`), logo,
   link de política de privacidade
4. Escopos: adicionar
   - `.../auth/youtube.readonly`
   - `.../auth/yt-analytics.readonly`
5. **Test users** (para a fase de PoC): adicionar os e-mails do André e do Vitor

## Passo 3 — Criar o OAuth Client

1. **APIs e Serviços → Credenciais → Criar credenciais → ID do cliente OAuth**
2. Tipo: **Aplicativo da Web**
3. **URI de redirecionamento autorizado:**
   `https://cortex.turbopartners.com.br/api/oauth/youtube/callback`
4. Copiar **Client ID** e **Client Secret**

## Passo 4 — Plugar no Cortex

Setar as env vars de produção (o código já aceita; se vazias, cai no client Internal):

```
YOUTUBE_CLIENT_ID=<client id do projeto novo>
YOUTUBE_CLIENT_SECRET=<client secret do projeto novo>
```

> ⚠️ O refresh_token é específico do client. Ao trocar para o client dedicado, qualquer
> canal que já tenha autorizado antes precisa **reautorizar**.

---

## Passo 5 — PoC (enquanto não verifica)

Em modo **Testing**, os test users (André/Vitor) já conseguem autorizar:

1. Cada dono loga com a **conta pessoal** dele e acessa **`/api/oauth/youtube/start`**
2. Disparar sync: **`POST /api/admin/youtube/sync`** (`?days=30`, `?skipVideos=true` opc.)
3. Conferir: **`GET /api/admin/youtube/status`**

> ⚠️ **Limite do modo Testing:** o refresh_token de escopo sensível **expira em 7 dias**.
> Serve só para validar o fluxo end-to-end — não para produção.

## Passo 6 — Verificação → Produção

1. Submeter o app para **verificação do Google** (escopos sensíveis: justificativa +
   provavelmente um vídeo do fluxo OAuth). Leva de dias a algumas semanas.
2. Após aprovado, publicar como **Em produção** → o refresh_token passa a ser durável e
   qualquer dono de canal autoriza com a conta pessoal, sem expirar.

---

## Resumo do fluxo

```
Projeto GCP dedicado (External) → ativar YouTube Data + Analytics API
        │
        ▼
Consent screen External + escopos + test users (André/Vitor)
        │
        ▼
OAuth Client (Web) → redirect /api/oauth/youtube/callback
        │
        ▼
YOUTUBE_CLIENT_ID/SECRET no Cortex
        │
        ├── PoC (Testing): dono autoriza c/ conta pessoal → sync (token expira em 7 dias)
        │
        ▼
Verificação Google → Produção → token durável
```
