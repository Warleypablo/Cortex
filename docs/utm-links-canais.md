# 🔗 Links com UTM — Canais Turbo + Sócios (versão enxuta)

> Documento pronto pra colar os links nos canais. Padrão da [Constituição UTM v1.4](./utm-constituicao.md).
> **Link de destino:** `https://www.turbopartners.com.br/`
> Atualizado em 28/06/2026 — **versão enxuta** (1 fixo + 1 post por canal) + notas de clicabilidade + ManyChat.

## Regras rápidas

- **FIXO** (link da bio): cola **uma vez** no perfil e esquece. `utm_content=site-home`.
- **POST** (link na publicação): troca o `utm_content` por `{nome-curto}-{aaaa-mm-dd}` a cada post. O `{nome-curto}` é um apelido do post de **3-5 palavras**, minúsculo, com hífen (ex: `5-erros-ecommerce-2026-06-28`). Não use o título completo (fica grande e quebra com acento/espaço).
- **`utm_campaign`** = a iniciativa. Padrão `always-on` (conteúdo contínuo, sem campanha nomeada). **Troque** quando o post fizer parte de algo:
  - Lançamento → `lancamento-{produto}-{aaaa-mm}` (ex: `lancamento-creators-2026-06`)
  - Evento → `{evento}-{aaaa-mm}` (ex: `creator-summit-2026-06`)
  - SDR conversando em DM → `social-selling` · ManyChat → `automacoes`
- **Nunca edite** `utm_source`, `utm_medium` e `utm_term` — são o padrão. Nos posts mudam o `utm_content` (sempre) e o `utm_campaign` (quando for campanha).

| Entidade | `utm_medium` |
|---|---|
| Turbo (canais oficiais) | `organic` |
| Victor (canal próprio) | `victor` |
| André (canal próprio) | `andre` |
| Rodrigo (canal próprio) | `rodrigo` |

## ⚠️ Clicabilidade — onde o link funciona

| Plataforma | 🟢 Fixo (bio) | 🔵 Post | Link clicável no post? |
|---|---|---|---|
| **LinkedIn** | `bio` (Website/Sobre) | `feed` (corpo do post) | ✅ sim |
| **YouTube** | `bio` (Sobre/links do canal) | `descricao-video` (descrição) | ✅ sim |
| **Instagram** | `bio` (link na bio) | `stories` (sticker de link) | ⚠️ **só nos Stories** |
| **TikTok** | `bio` (link na bio) | — | ❌ **não tem** |

**Por quê:** no **feed/reels do Instagram** e nos **vídeos do TikTok** a legenda **não é clicável**. A pessoa só consegue clicar:
- no link da **bio** (por isso o feed/reels "manda pra bio" → quem atribui é o link fixo da bio), ou
- via **Stories** (Instagram, sticker de link), ou
- via **ManyChat** (bot manda o link clicável na DM — ver seção abaixo).

## 🤖 ManyChat (comentou → bot manda o link na DM)

É como você atribui um **post de feed/reels** (IG/TikTok) que não tem link clicável: o post pede "comenta X", o bot responde na DM com o link **tagueado e clicável**.

**Padrão:** `utm_campaign=automacoes` · `utm_term=dm` · `utm_content={nome-do-post}-{aaaa-mm-dd}`

Como `automacoes` + `dm` já dizem "veio de ManyChat", o `utm_content` identifica **qual post/reel** a pessoa comentou — assim você sabe qual conteúdo gerou o lead. Troca o `utm_content` a cada post.

```
https://www.turbopartners.com.br/?utm_source=instagram&utm_medium=organic&utm_campaign=automacoes&utm_term=dm&utm_content=creators-ugc-2026-06-28
```
(troca `organic` por `victor`/`andre`/`rodrigo` no canal do sócio.)

---

## 🟣 TURBO — `utm_medium=organic`

**FIXO (bio):**
```
Instagram  https://www.turbopartners.com.br/?utm_source=instagram&utm_medium=organic&utm_campaign=always-on&utm_term=bio&utm_content=site-home
TikTok     https://www.turbopartners.com.br/?utm_source=tiktok&utm_medium=organic&utm_campaign=always-on&utm_term=bio&utm_content=site-home
YouTube    https://www.turbopartners.com.br/?utm_source=youtube&utm_medium=organic&utm_campaign=always-on&utm_term=bio&utm_content=site-home
LinkedIn   https://www.turbopartners.com.br/?utm_source=linkedin&utm_medium=organic&utm_campaign=always-on&utm_term=bio&utm_content=site-home
```
**POST (troca `utm_content` por `{nome-curto}-{aaaa-mm-dd}`):**
```
LinkedIn (feed)        https://www.turbopartners.com.br/?utm_source=linkedin&utm_medium=organic&utm_campaign=always-on&utm_term=feed&utm_content={nome-curto}-{aaaa-mm-dd}
YouTube (descrição)    https://www.turbopartners.com.br/?utm_source=youtube&utm_medium=organic&utm_campaign=always-on&utm_term=descricao-video&utm_content={nome-curto}-{aaaa-mm-dd}
Instagram (stories)    https://www.turbopartners.com.br/?utm_source=instagram&utm_medium=organic&utm_campaign=always-on&utm_term=stories&utm_content={nome-curto}-{aaaa-mm-dd}
ManyChat (IG, DM)      https://www.turbopartners.com.br/?utm_source=instagram&utm_medium=organic&utm_campaign=automacoes&utm_term=dm&utm_content={nome-curto}-{aaaa-mm-dd}
```
> TikTok e feed/reels do Instagram não têm post com link clicável → usam o **link fixo da bio** ou **ManyChat**.

---

## 🎙️ TURBO CAST (YouTube) — `utm_medium=organic` · `utm_source=youtube-cast`

> Canal separado do YouTube principal da Turbo. A **única** diferença pro canal principal é o `utm_source=youtube-cast` (em vez de `youtube`). Exige `utm_medium=organic` explícito.

**FIXO (Sobre/links do canal):**
```
YouTube  https://www.turbopartners.com.br/?utm_source=youtube-cast&utm_medium=organic&utm_campaign=always-on&utm_term=bio&utm_content=site-home
```
**POST (descrição — troca `{nome-curto}-{aaaa-mm-dd}`):**
```
YouTube  https://www.turbopartners.com.br/?utm_source=youtube-cast&utm_medium=organic&utm_campaign=always-on&utm_term=descricao-video&utm_content={nome-curto}-{aaaa-mm-dd}
```

---

## 🔵 VICTOR — `utm_medium=victor`

**FIXO (bio):**
```
Instagram  https://www.turbopartners.com.br/?utm_source=instagram&utm_medium=victor&utm_campaign=always-on&utm_term=bio&utm_content=site-home
TikTok     https://www.turbopartners.com.br/?utm_source=tiktok&utm_medium=victor&utm_campaign=always-on&utm_term=bio&utm_content=site-home
YouTube    https://www.turbopartners.com.br/?utm_source=youtube&utm_medium=victor&utm_campaign=always-on&utm_term=bio&utm_content=site-home
LinkedIn   https://www.turbopartners.com.br/?utm_source=linkedin&utm_medium=victor&utm_campaign=always-on&utm_term=bio&utm_content=site-home
```
**POST (troca `utm_content` por `{nome-curto}-{aaaa-mm-dd}`):**
```
LinkedIn (feed)        https://www.turbopartners.com.br/?utm_source=linkedin&utm_medium=victor&utm_campaign=always-on&utm_term=feed&utm_content={nome-curto}-{aaaa-mm-dd}
YouTube (descrição)    https://www.turbopartners.com.br/?utm_source=youtube&utm_medium=victor&utm_campaign=always-on&utm_term=descricao-video&utm_content={nome-curto}-{aaaa-mm-dd}
Instagram (stories)    https://www.turbopartners.com.br/?utm_source=instagram&utm_medium=victor&utm_campaign=always-on&utm_term=stories&utm_content={nome-curto}-{aaaa-mm-dd}
ManyChat (IG, DM)      https://www.turbopartners.com.br/?utm_source=instagram&utm_medium=victor&utm_campaign=automacoes&utm_term=dm&utm_content={nome-curto}-{aaaa-mm-dd}
```

---

## 🟢 ANDRÉ — `utm_medium=andre`

**FIXO (bio):**
```
Instagram  https://www.turbopartners.com.br/?utm_source=instagram&utm_medium=andre&utm_campaign=always-on&utm_term=bio&utm_content=site-home
TikTok     https://www.turbopartners.com.br/?utm_source=tiktok&utm_medium=andre&utm_campaign=always-on&utm_term=bio&utm_content=site-home
YouTube    https://www.turbopartners.com.br/?utm_source=youtube&utm_medium=andre&utm_campaign=always-on&utm_term=bio&utm_content=site-home
LinkedIn   https://www.turbopartners.com.br/?utm_source=linkedin&utm_medium=andre&utm_campaign=always-on&utm_term=bio&utm_content=site-home
```
**POST (troca `utm_content` por `{nome-curto}-{aaaa-mm-dd}`):**
```
LinkedIn (feed)        https://www.turbopartners.com.br/?utm_source=linkedin&utm_medium=andre&utm_campaign=always-on&utm_term=feed&utm_content={nome-curto}-{aaaa-mm-dd}
YouTube (descrição)    https://www.turbopartners.com.br/?utm_source=youtube&utm_medium=andre&utm_campaign=always-on&utm_term=descricao-video&utm_content={nome-curto}-{aaaa-mm-dd}
Instagram (stories)    https://www.turbopartners.com.br/?utm_source=instagram&utm_medium=andre&utm_campaign=always-on&utm_term=stories&utm_content={nome-curto}-{aaaa-mm-dd}
ManyChat (IG, DM)      https://www.turbopartners.com.br/?utm_source=instagram&utm_medium=andre&utm_campaign=automacoes&utm_term=dm&utm_content={nome-curto}-{aaaa-mm-dd}
```

---

## 🟠 RODRIGO — `utm_medium=rodrigo`

**FIXO (bio):**
```
Instagram  https://www.turbopartners.com.br/?utm_source=instagram&utm_medium=rodrigo&utm_campaign=always-on&utm_term=bio&utm_content=site-home
TikTok     https://www.turbopartners.com.br/?utm_source=tiktok&utm_medium=rodrigo&utm_campaign=always-on&utm_term=bio&utm_content=site-home
YouTube    https://www.turbopartners.com.br/?utm_source=youtube&utm_medium=rodrigo&utm_campaign=always-on&utm_term=bio&utm_content=site-home
LinkedIn   https://www.turbopartners.com.br/?utm_source=linkedin&utm_medium=rodrigo&utm_campaign=always-on&utm_term=bio&utm_content=site-home
```
**POST (troca `utm_content` por `{nome-curto}-{aaaa-mm-dd}`):**
```
LinkedIn (feed)        https://www.turbopartners.com.br/?utm_source=linkedin&utm_medium=rodrigo&utm_campaign=always-on&utm_term=feed&utm_content={nome-curto}-{aaaa-mm-dd}
YouTube (descrição)    https://www.turbopartners.com.br/?utm_source=youtube&utm_medium=rodrigo&utm_campaign=always-on&utm_term=descricao-video&utm_content={nome-curto}-{aaaa-mm-dd}
Instagram (stories)    https://www.turbopartners.com.br/?utm_source=instagram&utm_medium=rodrigo&utm_campaign=always-on&utm_term=stories&utm_content={nome-curto}-{aaaa-mm-dd}
ManyChat (IG, DM)      https://www.turbopartners.com.br/?utm_source=instagram&utm_medium=rodrigo&utm_campaign=automacoes&utm_term=dm&utm_content={nome-curto}-{aaaa-mm-dd}
```

---

## ⚠️ Observações pro time

1. **Destino dos fixos = home** (`site-home`). Se o link apontar pra uma **landing page** (`pages.turbopartners.com.br/...`), troque `utm_content` por `lp-{slug}` (`lp-creators`, `lp-ecommerce`). Outra página do site institucional → `site-{pagina}`. Slugs de produto: `creators`, `ecommerce`, `comercial`, `flash`.
2. **`utm_content` dos posts = nome do post + data:** o `creators-2026-06-28` é só exemplo. Troque por `{nome-do-post}-{data-da-publicação}`.
3. **`utm_content` do ManyChat = nome do post + data** (igual aos posts) — `automacoes`+`dm` já marcam que veio de ManyChat, então o `utm_content` diz **qual post** disparou o fluxo.
4. **Feed/Reels (IG) e vídeos (TikTok) não têm link clicável** → a atribuição vem do **link da bio** ou de **ManyChat**. Não adianta colar UTM numa legenda que ninguém clica.
5. **WhatsApp:** UTM em `wa.me` direto **não rastreia**. Use uma página de redirect tracked (`pages.turbopartners.com.br/wpp?...`).
6. **Mídia paga** (Meta/Google/TikTok Ads) **não usa estes links** — lá os UTMs são injetados por token automático da plataforma (ver §5 da Constituição).
