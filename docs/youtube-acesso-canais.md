# YouTube — Como dar acesso dos canais à Data Central

> Objetivo: trazer as métricas (inscritos, views, tempo assistido, engajamento) dos
> canais de YouTube dos sócios para a Data Central da Turbo.

## Contexto da decisão

O YouTube Analytics é **dado privado** → ler as métricas de um canal **exige
consentimento OAuth de alguém com acesso ao canal**. Não existe service account nem API
key para canal de terceiro — o consentimento humano é inevitável em qualquer solução.

A tela de consentimento OAuth da Data Central (projeto GCP `datalake-turbopartners`) está
em modo **Interno** — só contas `@turbopartners.com.br` conseguem autorizar.

**O problema:** os canais dos sócios pertencem às contas **pessoais** deles, e:

1. **Canal comum é soldado a UMA conta Google** — não dá para "adicionar" a Turbo nem
   "trocar o email do dono". O canal *é* aquela conta.
2. **Conta pessoal não vira `@turbopartners`** — `@turbopartners` é Google Workspace,
   provisionado pelo admin; é um tipo de conta diferente, não dá para converter.

**Caminho escolhido — Conta de Marca (Brand Account):** o dono converte o canal em Conta
de Marca (um *tipo* de conta que aceita vários usuários) e adiciona uma conta Turbo como
proprietária. Aí a conta Turbo autoriza o OAuth usando o **client Interno atual**, sem
verificação do Google e sem token que expira.

> ℹ️ **"Conta de Marca" NÃO é uma marca-guarda-chuva da Turbo.** Cada canal vira a sua
> própria Conta de Marca, independente, e **continua pertencendo ao dono original**. Mesmo
> nome, mesmas inscrições, mesma monetização. Adicionar a Turbo é como **compartilhar um
> Google Doc**: o dono segue Proprietário Principal e pode revogar o acesso quando quiser.
> A Turbo nunca "possui" o canal — só ganha uma chave de **leitura** revogável.

> ⚠️ **Risco da monetização:** migrar um canal monetizado para Conta de Marca pode
> re-vincular o AdSense ou disparar uma re-revisão do YPP. É um risco baixo-mas-não-zero.
> Por isso o **Passo 0** abaixo é obrigatório.

---

## Passo 0 — Testar num canal descartável (OBRIGATÓRIO)

Antes de tocar nos canais reais do André e do Vitor:

1. Pegar/criar um **canal de teste não-monetizado**.
2. Rodar os Passos 1 → 5 inteiros nele.
3. Confirmar que as métricas entram na Data Central (`GET /api/admin/youtube/status`).

Só depois de validar a pipeline ponta-a-ponta, repetir nos canais reais cientes do risco.

---

## Passo 1 — Dono converte o canal em Conta de Marca

Cada dono faz no canal dele, logado com a **conta pessoal**:

1. Acessar **[youtube.com/account_advanced](https://www.youtube.com/account_advanced)**
   (Configurações → Configurações avançadas).
2. Clicar em **"Transferir canal para uma Conta de Marca"**.
3. O YouTube mostra os avisos do que não migra (alguns comentários etc.) e cria/associa
   uma Conta de Marca.
4. Confirmar.

> O canal continua com o mesmo nome, inscritos, conteúdo e monetização. O dono permanece
> **Proprietário Principal**.

## Passo 2 — Dono adiciona a conta Turbo como Proprietário

Já com o canal em Conta de Marca:

1. YouTube → **Configurações → "Adicionar ou remover gerentes"** (abre a página de
   permissões da Conta de Marca no Google).
2. **Gerenciar permissões → Convidar novos usuários**.
3. Adicionar **`ferramentas@turbopartners.com.br`** com papel **Proprietário**.
   - *(Com nossos escopos só-leitura não-monetários, "Gerente" já bastaria, mas
     Proprietário é mais limpo.)*
4. A conta Turbo **aceita o convite** (o acesso vale assim que aceito).

## Passo 3 — Turbo autoriza o OAuth (client Interno)

Feito pela equipe Turbo, com a conta `ferramentas@turbopartners.com.br`:

1. Logar com `ferramentas@turbopartners.com.br`.
2. Acessar **`/api/oauth/youtube/start`**.
3. No login Google, escolher a **Conta de Marca do canal** no seletor de marca.
4. Aceitar os escopos (`youtube.readonly` + `yt-analytics.readonly`).

> Usa o **client Interno do projeto `datalake-turbopartners`** (o código cai nele por
> fallback quando `YOUTUBE_CLIENT_ID/SECRET` estão vazias). **Sem verificação do Google,
> sem expiração de 7 dias** — o refresh_token é durável.

## Passo 4 — Disparar e conferir o sync

1. Disparar: **`POST /api/admin/youtube/sync`** (`?days=30`, `?skipVideos=true` opcional).
2. Conferir: **`GET /api/admin/youtube/status`**.

---

## Pendência técnica (Turbo)

Se a **mesma** conta `ferramentas@` for proprietária de **mais de um** canal, atenção:
`youtube.credentials` tem `UNIQUE(google_user_id)` e o callback faz
`ON CONFLICT (google_user_id) DO UPDATE` (`server/routes/youtubeOAuth.ts`). Como as duas
autorizações vêm do mesmo `google_user_id` (a conta Turbo), a 2ª **sobrescreve** a 1ª e o
primeiro canal perde a credencial.

**Resolver antes de autorizar o 2º canal**, escolhendo uma das opções:
- (a) **Chavear a credencial por canal** (ajuste de schema/lógica) — recomendado; ou
- (b) usar **uma conta Turbo distinta por canal** (ex.: `ferramentas@` num, outra conta
  Workspace no outro) — mais simples, porém menos elegante.

---

## Resumo do fluxo

```
Passo 0: validar tudo num canal de teste não-monetizado
        │
        ▼
Dono: youtube.com/account_advanced → Transferir p/ Conta de Marca
        │
        ▼
Dono: Adicionar gerentes → ferramentas@turbopartners.com.br como Proprietário
        │
        ▼
Turbo: /api/oauth/youtube/start → escolher a marca → autoriza (client Interno, sem verificação)
        │
        ▼
Turbo: POST /api/admin/youtube/sync → GET /api/admin/youtube/status
```
