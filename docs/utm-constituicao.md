# Constituição UTM Turbo v1.4

> Padrão único e definitivo de instrumentação de UTMs da Turbo Partners.
> Vigência: a partir de **21 de maio de 2026**.
> Documento vivo. Mudanças exigem aprovação do Growth + Pre-Sales.

> **Versão 1.4 — refinamentos** (09/06/2026):
> - **`content` ganha duas lógicas** (ver §4.2): **link fixo** (bio/linktree/banner) usa `content={tipo-de-destino}` (`site-home`, `lp-creators`, `whatsapp`); **post** (feed/stories/reels/descrição/DM) usa `content={nome-do-post}-{aaaa-mm-dd}`
> - **Prefixo `link-` descontinuado** — substituído por `site-`/`lp-`, que carregam o tipo real de destino (permite agrupar "LP vs site" no relatório). Exemplos do doc atualizados.
> - **Bio com múltiplos links** documentada — até 5 links nativos no Instagram, todos `term=bio`, diferenciados por `content` (tipo de destino) (ver §4.2)
> - Nota sobre WhatsApp: UTM em link `wa.me`/`api.whatsapp.com` não rastreia; usar página de redirect tracked

> **Versão 1.3 — refinamentos** (08/06/2026):
> - **`rodrigo` adicionado como medium-exceção** — terceira figura-chave com canal próprio, mesmo tratamento de `victor` e `andre` (ver §3.7 e §4.7)

> **Versão 1.2 — refinamentos pós-treinamento** (26/05/2026):
> - Vocabulário de `term` por plataforma explicitado (Instagram, LinkedIn, YouTube, TikTok)
> - YouTube ganha `descricao-video`, `descricao-shorts`, `card`, `bio`, `banner`
> - LinkedIn enxuto: só `bio`, `feed`, `dm` (cobrir formatos extras é adicionar conforme uso)
> - Regra `bio` vs `linktree` reescrita: decisão pela pessoa que está fisicamente colando o link
> - `facebook` removido de `organic` (Turbo não opera Facebook orgânico)
> - Slugs oficiais de produto fixados: `creators`, `ecommerce`, `comercial`, `flash`
> - Convenção de `content` em organic: `{slug-curto}-{aaaa-mm-dd}` sem repetir formato
> - **`victor` e `andre` adicionados como mediums-exceção** (figuras-chave com canal próprio robusto — ver §3.7 e §4.7)

> **Versão 1.1 — refinamentos** (19/05/2026):
> - `bio`, `destaques-fixados` movidos de campaign → term em organic
> - `destaques` e `destaques-fixados` unificados em `destaques` (plural)
> - Campaigns canônicas de organic definidas: `always-on`, `automacoes`, `social-selling`
> - `social-selling` redefinido: iniciativa de SDR conversando ativamente nas DMs dos canais orgânicos da Turbo
> - `funcionario` → `colaborador` em referral
> - Outbound simplificado: sources sem sufixo `-frio`/`-outreach`. `ligacao` removido.
> - `facebook` e `pinterest` adicionados como sources em organic
> - Exemplos práticos adicionados pra distinguir `colaborador` (referral) de `social-selling` (organic)

---

## 1. Princípios fundamentais

Estas são as **leis** que regem todas as decisões de naming e classificação. Quando bater dúvida, volta aqui antes de inventar.

### Lei zero — `source` é categoria, não entidade

`source` é **sempre o canal técnico de onde o clique saiu**. Nunca é nome de pessoa, cliente, marca ou ferramenta específica.

- Entidade específica (cliente, influencer, marca) → vai em `campaign`
- Tipo de iniciativa (social-selling, programa-indicacao) → vai em `campaign`
- Ferramenta de envio (RD Station, Mailchimp) → não entra no UTM, é detalhe operacional

**Teste rápido:** se o valor que você está pensando em colocar em `source` é o nome de uma entidade específica, ele NÃO vai em `source`. Vai em `campaign`.

### Lei um — Vocabulário fechado

Os valores permitidos para `medium` e `source` estão listados nas tabelas deste documento. Adicionar valor novo exige:

1. Validar que é um canal técnico ou categoria de relação (não entidade)
2. Confirmar que vai durar mais de 12 meses
3. Confirmar que faz sentido olhar relatório agregado por ele
4. Aprovação do Growth + Pre-Sales

### Lei dois — Formatação

- Tudo em **lowercase**
- **Sem acento**
- Separador entre palavras: **hífen `-`**
- Nunca usar espaço, underline ou maiúscula

### Lei três — Source é a verdade do clique

Mesmo que uma iniciativa (ex: social selling) seja conceitualmente "diferente", se o clique saiu do Instagram, o source é `instagram`. A iniciativa específica vai em `campaign`.

### Lei quatro — Campaign é iniciativa, term é local

`campaign` responde **"de qual iniciativa de marketing esse link faz parte?"** (always-on, lançamento de produto, social selling, fluxo de nutrição da Turma 6, cliente Dr. Rafael, etc).

`term` responde **"onde fisicamente esse link foi colado?"** (bio, stories, feed, linktree, footer do site, descrição de vídeo, etc).

`content` responde **"qual peça/post/touchpoint específico?"** (id do post, nome do link na linktree, número do touchpoint da régua, etc).

---

## 2. Mediums permitidos (6 categorias + 3 exceções)

| medium | descrição |
|---|---|
| `paid` | Mídia paga em qualquer plataforma (Meta, Google, etc) |
| `organic` | Conteúdo orgânico próprio em plataformas de terceiros |
| `eventos` | Presença física ou digital em eventos |
| `referral` | Alguém externo trazendo lead (cliente, colaborador, influencer, parceiro, marketplace) |
| `crm` | Comunicação ativa para base própria (email, WhatsApp broadcast, SMS) |
| `outbound` | Prospecção fria via SDR (lead que nunca interagiu antes) |
| `victor` | **Exceção** — canal próprio do Victor (ver §3.7) |
| `andre` | **Exceção** — canal próprio do André (ver §3.7) |
| `rodrigo` | **Exceção** — canal próprio do Rodrigo (ver §3.7) |

**Nota conceitual:** `paid` e `organic` descrevem **como o link foi distribuído** (compra ou postagem própria). `eventos`, `referral`, `crm`, `outbound` descrevem **o tipo de relação ou contexto** em que o link foi entregue. Naturezas diferentes, mas todas respondem à pergunta "como esse lead chegou aqui?".

**Sobre `victor`, `andre` e `rodrigo`:** são exceções deliberadas à Lei 1 (vocabulário fechado). São figuras-chave de distribuição com canal próprio robusto, tratadas como dimensão de primeira ordem no relatório. Toda nova figura nesse formato exige aprovação Growth + Pre-Sales (caso a caso, não automático).

---

## 3. Sources permitidos por medium

### 3.1 `paid`

| source | quando usar |
|---|---|
| `facebook` | Meta Ads (Facebook + Instagram, unificado na plataforma de gestão Meta). Nome consagrado pela continuidade do legado da Turbo |
| `google` | Google Ads (search, display, demand gen) |
| `youtube` | YouTube Ads (gerenciado dentro do Google Ads — `{network}` retorna `youtube` automaticamente) |
| `linkedin` | LinkedIn Ads |
| `tiktok` | TikTok Ads |
| `pinterest` | Pinterest Ads |

**Notas:**
- `fb` é proibido. Sempre `facebook`
- `meta` é proibido. Sempre `facebook` (continuidade do legado da Turbo)

### 3.2 `organic`

| source | quando usar |
|---|---|
| `instagram` | Posts, reels, stories, destaques, DM, link na bio (direto ou via Linktree — ver seção 4.2) |
| `linkedin` | Posts da página Turbo, DMs de SDR via canal LinkedIn da Turbo |
| `youtube` | Descrição de vídeo, Shorts, card, bio do canal, banner |
| `youtube-cast` | Canal **Turbo Cast** no YouTube — separado do canal principal pra leitura própria no relatório (exige `utm_medium=organic` explícito) |
| `tiktok` | Bio, descrição de vídeos, DMs |
| `pinterest` | Pins orgânicos (raro hoje mas reservado) |

**Facebook orgânico removido em v1.2:** a Turbo não opera Facebook orgânico. Caso volte a operar, propor PR pra readicionar.

**Sobre Linktree:** Linktree não é source porque é apenas um intermediário entre a bio e a LP final. O clique original vem de uma plataforma (Instagram, TikTok, etc) — essa é a verdadeira origem. Linktree entra como `term=linktree` para preservar a informação de que houve passagem pela ferramenta. Ver seção 4.2.

### 3.3 `eventos`

Vocabulário **aberto**, mas com regra: `nome-do-evento` em slug (lowercase, sem acento, hífen).

| padrão | exemplos |
|---|---|
| `{nome-do-evento}` | `rd-summit-2026`, `fire-festival`, `b2b-stack`, `turbo-workshop-creators-sp` |

**Regra:** se o evento é próprio da Turbo, prefixa com `turbo-`. Se é de terceiro, usa o nome direto.

### 3.4 `referral`

| source | quando usar | exemplo de campaign |
|---|---|---|
| `cliente` | Lead vindo via cliente atual da Turbo (footer, indicação direta, prova social) | `dr-rafael`, `bready`, `guday`, `clinica-x` |
| `colaborador` | Indicação **informal** de alguém do time — DM pessoal, WhatsApp pessoal, conversa de café. Não confundir com social-selling (que é iniciativa orgânica coordenada de SDR — ver seção 4.2 e exemplos da seção 5.3) | `lucas`, `caio`, `ichino` |
| `afiliado` | Programa formal de afiliados (futuro) | nome-do-afiliado |
| `influencer` | Criador externo postando link em conteúdo dele | `joao-silva`, `maria-marketing` |
| `marketplace` | Diretório de parceiros | `shopify-partners`, `rd-partners`, `hubspot-solutions` |

### 3.5 `crm`

| source | quando usar |
|---|---|
| `email` | Qualquer disparo de e-mail (newsletter, régua, broadcast, transacional com CTA) |
| `whatsapp` | Broadcast e disparos via WhatsApp (lista de transmissão, API oficial) |
| `sms` | Disparos de SMS |

**Nota:** `source` é sempre o canal de entrega, **não a ferramenta de envio**. Se migrar de RD Station pra Mailchimp, o source `email` continua igual.

### 3.6 `outbound`

| source | quando usar |
|---|---|
| `email` | Cold email via Apollo, Reply, Lemlist, etc |
| `linkedin` | Conexão + DM via LinkedIn (manual ou Sales Navigator) |
| `whatsapp` | Abordagem direta no WhatsApp do prospect |

**Distinção crítica `crm` vs `outbound`:**
- `crm` → comunicação para **base própria** (já é lead/cliente)
- `outbound` → prospecção **fria** (ainda não é lead)

**Sobre os nomes dos sources:** os sources de outbound usam os mesmos slugs que crm (`email`, `linkedin`, `whatsapp`) porque o medium já distingue a natureza. Sufixos como `-frio` ou `-outreach` seriam redundantes e dificultariam relatórios cross-medium.

**Sobre ligações:** ligações telefônicas (cold calls) **não entram aqui** porque o link nunca sai de uma ligação — ele é enviado depois por email/WhatsApp. Esses cliques devem ser registrados com o canal de envio efetivo (`email` ou `whatsapp`) e podem usar `term=pos-ligacao` ou `content=follow-up-call-X` para indicar que veio de cold call.

### 3.7 `victor`, `andre` e `rodrigo` (mediums-exceção)

Figuras-chave da Turbo com canal próprio robusto e distribuição independente. Tratadas como **mediums** (não como `campaign` dentro de `organic`) porque:

1. Operam ecossistemas próprios (canal no YouTube, perfil no Instagram, LinkedIn etc) com audiência e marca pessoal — não são apenas peças de uma iniciativa Turbo
2. Devem aparecer como **dimensão de primeira ordem** no relatório, lado a lado com `paid`/`organic`, pra leitura imediata de performance por canal
3. Quando o Victor um dia rodar mídia paga apontando pra Turbo, o medium continua `victor` (a natureza "distribuição via canal-próprio do Victor" é preservada); informação de pago vs orgânico fica em `campaign`/`content`

| source | quando usar |
|---|---|
| `instagram` | Perfil do Instagram da figura (posts, reels, stories, bio, linktree, DM) |
| `youtube` | Canal do YouTube da figura (descrição, bio, banner, card) |
| `linkedin` | Perfil pessoal no LinkedIn |
| `tiktok` | Perfil no TikTok |

**Quando NÃO usar `victor`/`andre`/`rodrigo`:**
- Conteúdo orgânico da página/canal **da Turbo** (mesmo que cite o Victor) → `organic`
- Anúncio pago **da Turbo** que tem o Victor como rosto do criativo → `paid` (a figura aparece no `content` do ad, não no medium)
- Indicação informal do Victor por WhatsApp pessoal pra um amigo → `referral/colaborador/victor`

**Crescimento do vocabulário:** abrir exceção pra nova figura (ex: Camila) exige aprovação Growth + Pre-Sales caso a caso. NÃO é regra automática — manter o vocabulário enxuto evita inflação de mediums.

---

## 4. Regras de naming para `campaign`, `term` e `content`

### 4.1 Mídia paga (`paid`)

Use **tokens dinâmicos da plataforma** sempre que possível. A plataforma substitui automaticamente no momento do clique.

| campo | Meta Ads | Google Ads |
|---|---|---|
| campaign | `{{campaign.id}}` | `{campaignid}` |
| term | `{{adset.id}}-{{placement}}` | `{adgroupid}-{network}-{device}-{matchtype}-{keyword}` |
| content | `{{ad.id}}` | `{creative}` |

### 4.2 Conteúdo orgânico (`organic`)

#### Campaign (vocabulário fechado de iniciativas)

| campaign | quando usar |
|---|---|
| `always-on` | Presença contínua sem campanha nomeada (default) |
| `automacoes` | Fluxos automáticos (ManyChat, bots de DM) |
| `social-selling` | SDR conversando ativamente em DMs dos canais orgânicos da Turbo |
| `lancamento-{slug}-{aaaa-mm}` | Campanha pontual de lançamento de produto (ver slugs em §4.2.4) |
| `{evento}-{aaaa-mm}` | Workshop/evento pontual da Turbo (ex: `workshop-shopify-2026-04`) |

#### Term por plataforma (vocabulário fechado)

`term` responde **"onde fisicamente o link com UTM está colado?"**

**Instagram:**

| term | onde fica |
|---|---|
| `bio` | link único na bio do perfil (direto pra LP, sem Linktree) |
| `linktree` | link cadastrado dentro da Linktree (ver §4.2.3) |
| `feed` | post no feed/timeline |
| `stories` | stories temporários |
| `reels` | Reels |
| `destaques` | destaques fixados (Story Highlights) |
| `dm` | mensagem direta (social-selling do SDR ou automação) |

**LinkedIn:**

| term | onde fica |
|---|---|
| `bio` | seção "Sobre" do perfil ou da página da Turbo |
| `feed` | post no feed (página oficial ou perfil pessoal de colaborador) |
| `dm` | mensagem direta (social-selling do SDR) |

**YouTube:**

| term | onde fica |
|---|---|
| `descricao-video` | descrição abaixo do vídeo |
| `descricao-shorts` | descrição de YouTube Shorts |
| `card` | cards interativos no canto do vídeo |
| `bio` | seção "Sobre" do canal |
| `banner` | links clicáveis no banner/cabeçalho do canal |

**TikTok:**

| term | onde fica |
|---|---|
| `bio` | link único na bio do perfil (direto pra LP) |
| `linktree` | link cadastrado dentro da Linktree (se aplicável) |
| `feed` | vídeos no feed |
| `dm` | mensagem direta (social-selling) |

#### Content (convenção)

`content` = identificador único da peça específica. **Não repete o formato** (que já está em `term`). Tem **duas lógicas**, conforme o link seja fixo ou um post.

**Link FIXO** (bio, linktree, banner, destaques, "sobre") → `content = {tipo-de-destino}`. O que importa é *para onde* o link leva — o link não muda, então não há "post" a identificar:

| tipo | quando usar | exemplos |
|---|---|---|
| `site-{pagina}` | site institucional (`www.turbopartners.com.br`) | `site-home`, `site-ecommerce` |
| `lp-{slug}` | landing page (`pages.turbopartners.com.br`) | `lp-creators`, `lp-creator-summit` |
| `whatsapp` | redirect de WhatsApp (tipo próprio) | `whatsapp` |

Link fixo é "cola e esquece" → **sem data** no `content`.

**POST** (feed, stories, reels, descrição de vídeo/shorts, DM) → `content = {nome-do-post}-{aaaa-mm-dd}`. O destino costuma ser sempre o mesmo (bio/LP padrão); o que diferencia é *qual post* gerou o clique:

```
content = {nome-do-post}-{aaaa-mm-dd}
```

`{nome-do-post}` = tema/identificador do post (`creators`, `5-erros-ecommerce`, `case-bready`).

**Prefixo `link-` descontinuado** (v1.4): não dizia nada além do óbvio. `site-`/`lp-` o substituem porque carregam o **tipo real de destino**, permitindo agrupar no relatório "quanto foi pra LP vs site".

Exemplos:
- `term=bio` + `content=lp-creators` ✅ (link fixo → tipo de destino, sem data)
- `term=bio` + `content=site-home` ✅
- `term=banner` + `content=lp-creator-summit` ✅ (link fixo, sem data)
- `term=descricao-video` + `content=creators-ugc-2026-05-26` ✅ (post → nome + data)
- `term=descricao-video` + `content=video-creators-ugc-2026-05-26` ❌ (repete formato)
- `term=feed` + `content=case-bready-2026-05-26` ✅ (post)
- `term=dm` + `content=camila-2026-05-26` ✅ (post)

#### Bio com múltiplos links (Instagram, TikTok, etc.)

A bio nativa hoje permite **vários links diretos** (até 5 no Instagram), funcionando como uma Linktree embutida na plataforma. Como todos ficam fisicamente na bio, **todos usam `term=bio`** — o `content` é o que diferencia cada botão.

- `content` = tipo de destino de cada botão (`lp-creators`, `site-home`, `whatsapp`) — é link fixo, então segue a lógica de destino, não de post
- Botão de bio é estável ("cola e esquece") → **sem data** no `content`
- `campaign` permanece `always-on` para botões de presença contínua; muda só quando o botão pertence a uma iniciativa específica (ex: `creator-summit-2026`)

Exemplo de uma bio com 4 botões:

| Botão | campaign | term | content |
|---|---|---|---|
| Página Creators | `always-on` | `bio` | `lp-creators` |
| Creator Summit | `creator-summit-2026` | `bio` | `lp-creator-summit` |
| WhatsApp | `always-on` | `bio` | `whatsapp` |
| Site | `always-on` | `bio` | `site-home` |

> **Nota WhatsApp:** UTM colada direto num link `wa.me`/`api.whatsapp.com` **não rastreia** — o WhatsApp ignora os parâmetros e o lead cai na conversa sem chegar ao Bitrix. Para rastrear o botão de WhatsApp da bio, aponte para uma página de redirect tracked (ex: `pages.turbopartners.com.br/wpp?...`) que registra a UTM e redireciona para o `wa.me`.

#### Slugs oficiais de produto

Usar em campaign de lançamento (`lancamento-{slug}-…`) e em `content` de link fixo (`lp-{slug}`):

| Produto | slug | também conhecido como |
|---|---|---|
| Creators | `creators` | UGC, GC (mesma coisa) |
| E-Commerce | `ecommerce` | Shopify (todo projeto é em Shopify) |
| Estruturação Comercial | `comercial` | — |
| Flash | `flash` | — |

#### Regra `bio` vs `linktree`

A decisão depende de **onde a pessoa está fisicamente colando o link com UTM no momento**:

- **`term=bio`** → quando o link com UTM vai **direto no campo "site/website" do perfil** (Instagram, TikTok, LinkedIn). Aponta direto pra LP final, sem Linktree no meio.
- **`term=linktree`** → quando o link com UTM está cadastrado **dentro da Linktree** (você está editando a Linktree e colando a URL no campo de algum botão de lá).

**Por que separar:** permite medir se a Linktree ajuda ou atrapalha (cliques perdidos no intermediário) e qual link de lá performa melhor. Saber qual produto puxou o lead é via `content` (`lp-creators`, `lp-ecommerce`).

**Definição operacional de `social-selling` na Turbo:**

> Social-selling é a iniciativa do **time de SDR (Pré-vendas) conversando ativamente nas DMs dos canais orgânicos da Turbo** (Instagram, LinkedIn, TikTok, YouTube — qualquer canal orgânico onde tenha DM ativa). É uma operação coordenada — não é qualquer colaborador postando algo no perfil pessoal.

**Distinção `social-selling` (organic) vs `colaborador` (referral):**

| Situação | Classificação |
|---|---|
| SDR responde DM no Instagram oficial da Turbo com link | `organic/instagram/social-selling/term=dm` |
| SDR responde DM no LinkedIn oficial da Turbo com link | `organic/linkedin/social-selling/term=dm` |
| Colaborador manda link da Turbo no WhatsApp pessoal pra um amigo | `referral/colaborador/lucas/term=indicacao` |
| Colaborador conta sobre Turbo em conversa de café e depois manda link | `referral/colaborador/lucas/term=indicacao` |
| Colaborador faz post no LinkedIn pessoal dele com link | `organic/linkedin/always-on/feed/content=post-{slug}-{data}` |

### 4.3 Eventos

| campo | valor |
|---|---|
| campaign | tipo + ano: `presencial-2026`, `workshop-online-2026-11` |
| term | `palestra`, `estande`, `material-impresso`, `qrcode-cracha` |
| content | ação específica: `slide-final-cta`, `panfleto-frente` |

### 4.4 Referral

| campo | valor |
|---|---|
| campaign | nome da entidade (cliente, colaborador, influencer, marketplace) em slug |
| term | tipo de mecanismo: `footer`, `indicacao`, `prova-social`, `co-marketing`, `bio-influencer` |
| content | local específico do link: `rodape-home`, `stories-link-bio`, `post-feed`, `whatsapp-amigo-loja-x` |

### 4.5 CRM

| campo | valor |
|---|---|
| campaign | nome do fluxo ou campanha: `turma-6-rafa-mais-proximo`, `nutricao-creators-2026-11` |
| term | segmento da lista: `lista-quentes`, `mql-nao-convertido`, `inscritos` |
| content | touchpoint específico: `touchpoint-12-audio-convite`, `cta-agendar-diagnostico` |

### 4.6 Outbound

| campo | valor |
|---|---|
| campaign | nome da cadência: `cadencia-q4-donos-agencia` |
| term | perfil do lead: `agencia-50-funcionarios`, `dono-clinica-odonto` |
| content | touchpoint ou template: `email-2-quebra-objecao`, `linkedin-msg-1` |

### 4.7 Mediums-exceção `victor`, `andre` e `rodrigo`

Mesma lógica de naming que `organic` (ver §4.2), porque a natureza do conteúdo é orgânica — o que muda é só quem distribui (a figura, não a Turbo).

| campo | valor |
|---|---|
| campaign | `always-on` (default presença contínua) · `lancamento-{slug}-{aaaa-mm}` (parceria pontual com Turbo) · `paid-{{campaign.id}}` (se a figura rodar anúncio próprio apontando pra Turbo) |
| term | mesmo vocabulário por plataforma de organic: `bio`, `linktree`, `descricao-video`, `feed`, `stories`, `reels`, etc |
| content | `{slug-curto}-{aaaa-mm-dd}` — ex: `canal-victor`, `creators-2026-05`, `video-creators-2026-05-28` |

**Exemplo:**
```
?utm_source=youtube&utm_medium=victor&utm_campaign=always-on&utm_term=descricao-video&utm_content=video-creators-2026-05-28
```

---

## 5. Padrões de URL completos por plataforma

### 5.1 Meta Ads (Facebook + Instagram)

**Onde aplicar:** campo "URL parameters" no nível do anúncio (ad), no Meta Ads Manager.

**Configuração no Cortex:** `server/services/adsCreation/creator.ts:31` — constante `TURBO_URL_TAGS`.

```
utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.id}}&utm_term={{adset.id}}-{{placement}}&utm_content={{ad.id}}
```

**Exemplo de URL real após o clique:**
```
https://turbopartners.com.br/creators?utm_source=facebook&utm_medium=paid&utm_campaign=120215204345090450&utm_term=120242625739510450-instagram_stories&utm_content=120242625739540450&fbclid=IwAR...
```

**Tokens substituídos automaticamente:**
- `{{campaign.id}}` → ID numérico da campanha
- `{{adset.id}}` → ID numérico do conjunto
- `{{placement}}` → `facebook_feed`, `instagram_stories`, `instagram_reels`, `facebook_reels`, `audience_network`, etc
- `{{ad.id}}` → ID numérico do anúncio
- `fbclid` → adicionado automaticamente pelo Meta (não está no template)

### 5.2 Google Ads

**Onde aplicar:** Configurações da conta → Modelo de acompanhamento (Tracking template) — **a nível de conta, não por campanha**.

**Caminho:** Google Ads → Engrenagem → Configurações da conta → Tracking template.

```
{lpurl}?utm_source=google&utm_medium=paid&utm_campaign={campaignid}&utm_term={adgroupid}-{network}-{device}-{matchtype}-{keyword}&utm_content={creative}
```

**Pré-requisito:** Auto-tagging precisa estar **ativado** (Configurações → Acompanhamento automático). Sem isso, `gclid` não é injetado.

**Tokens substituídos automaticamente:**
- `{lpurl}` → URL final do ad (ex: `https://turbopartners.com.br/creators`)
- `{campaignid}` → ID da campanha
- `{adgroupid}` → ID do conjunto de anúncios
- `{network}` → `search`, `display`, `youtube`
- `{device}` → `mobile`, `tablet`, `desktop`
- `{matchtype}` → `exact`, `phrase`, `broad` (em search)
- `{keyword}` → palavra-chave que disparou
- `{creative}` → ID do criativo
- `gclid` → adicionado automaticamente (Auto-tagging ativo)

**Importante:** sempre testar o template no botão "Test" do Google Ads antes de salvar.

### 5.3 Templates por cenário (não-paid)

**Instagram — link fixo na bio apontando pra LP de Creators (sem data):**
```
?utm_source=instagram&utm_medium=organic&utm_campaign=always-on&utm_term=bio&utm_content=lp-creators
```

**Link da Linktree (configurado dentro da própria Linktree, com UTM embutida):**
```
?utm_source=instagram&utm_medium=organic&utm_campaign=always-on&utm_term=linktree&utm_content=lp-creators
```
*Nota: quem mantém a Linktree precisa cadastrar cada link já com UTM. Source troca conforme a rede que tem Linktree (`instagram`, `tiktok`, etc).*

**Lançamento de produto (campanha pontual em organic):**
```
?utm_source=instagram&utm_medium=organic&utm_campaign=lancamento-creators-2026-05&utm_term=stories&utm_content=story-cta-final
```

**Social selling — SDR via DM do Instagram:**
```
?utm_source=instagram&utm_medium=organic&utm_campaign=social-selling&utm_term=dm&utm_content=conversa-2026-05-19-leandro
```

**Social selling — SDR via DM do LinkedIn:**
```
?utm_source=linkedin&utm_medium=organic&utm_campaign=social-selling&utm_term=dm&utm_content=conversa-2026-05-19-camila
```

**Automação ManyChat respondendo comentário no Instagram:**
```
?utm_source=instagram&utm_medium=organic&utm_campaign=automacoes&utm_term=dm&utm_content=manychat-creators-quero
```

**Footer da clínica do Dr. Rafael:**
```
?utm_source=cliente&utm_medium=referral&utm_campaign=dr-rafael&utm_term=footer&utm_content=rodape-home
```

**Colaborador (informal) mandando link via WhatsApp pessoal:**
```
?utm_source=colaborador&utm_medium=referral&utm_campaign=lucas&utm_term=indicacao&utm_content=whatsapp-amigo-loja-x
```

**Bready usando link da Turbo no stories:**
```
?utm_source=cliente&utm_medium=referral&utm_campaign=bready&utm_term=prova-social&utm_content=stories-link-bio
```

**Influencer postando link:**
```
?utm_source=influencer&utm_medium=referral&utm_campaign=joao-silva&utm_term=bio-influencer&utm_content=stories-link-bio
```

**Régua de WhatsApp da Turma 6 do Dr. Rafael (toque 12 de 41):**
```
?utm_source=whatsapp&utm_medium=crm&utm_campaign=turma-6-rafa-mais-proximo&utm_term=lista-quentes&utm_content=touchpoint-12-audio-convite
```

**E-mail de nutrição do funil Creators:**
```
?utm_source=email&utm_medium=crm&utm_campaign=nutricao-creators-2026-11&utm_term=mql-nao-convertido&utm_content=cta-agendar-diagnostico
```

**Cadência de cold email do SDR:**
```
?utm_source=email&utm_medium=outbound&utm_campaign=cadencia-q4-donos-agencia&utm_term=agencia-50-funcionarios&utm_content=email-2-quebra-objecao
```

**Cold outreach LinkedIn:**
```
?utm_source=linkedin&utm_medium=outbound&utm_campaign=cadencia-q4-donos-agencia&utm_term=agencia-50-funcionarios&utm_content=linkedin-msg-1
```

**Follow-up de cold call (link enviado por WhatsApp depois da ligação):**
```
?utm_source=whatsapp&utm_medium=outbound&utm_campaign=cadencia-q4-donos-agencia&utm_term=pos-ligacao&utm_content=follow-up-call-2026-05-19
```

**Evento (palestra com QR code no slide):**
```
?utm_source=rd-summit-2026&utm_medium=eventos&utm_campaign=presencial-2026&utm_term=palestra&utm_content=slide-final-cta
```

**Victor — bio do canal no YouTube apontando pra Turbo:**
```
?utm_source=youtube&utm_medium=victor&utm_campaign=always-on&utm_term=bio&utm_content=site-home
```

**Victor — descrição de vídeo no canal dele:**
```
?utm_source=youtube&utm_medium=victor&utm_campaign=always-on&utm_term=descricao-video&utm_content=video-creators-2026-05-28
```

**Victor — link da Turbo dentro da Linktree do Instagram dele:**
```
?utm_source=instagram&utm_medium=victor&utm_campaign=always-on&utm_term=linktree&utm_content=site-home
```

**André — descrição de vídeo no canal dele:**
```
?utm_source=youtube&utm_medium=andre&utm_campaign=always-on&utm_term=descricao-video&utm_content=video-creators-2026-05-28
```

**André — link da Turbo dentro da Linktree do Instagram dele:**
```
?utm_source=instagram&utm_medium=andre&utm_campaign=always-on&utm_term=linktree&utm_content=site-home
```

**Rodrigo — Sobre do perfil no LinkedIn apontando pra Turbo:**
```
?utm_source=linkedin&utm_medium=rodrigo&utm_campaign=always-on&utm_term=bio&utm_content=site-home
```

**Rodrigo — post no feed do LinkedIn dele:**
```
?utm_source=linkedin&utm_medium=rodrigo&utm_campaign=always-on&utm_term=feed&utm_content=creators-2026-06-08
```

---

## 6. Captura técnica complementar

Além das 5 UTMs, capturar também as seguintes informações em **colunas próprias do Bitrix** (`crm_deal`):

| Coluna | Origem | Como capturar | Valor analítico |
|---|---|---|---|
| `fbclid` | URL (Meta injeta automaticamente) | Parsear da query string | Cruzar com Marketing API do Meta para metadados completos do clique |
| `gclid` | URL (Google injeta com Auto-tagging ativo) | Parsear da query string | Cruzar com Google Ads API para metadados do clique |
| `referrer` | `document.referrer` via JS na LP | JS no carregamento da LP | Resolver os ~33% de leads sem UTM (P5 do diagnóstico atual) |
| `user_agent` | Header HTTP (automático) | Capturar server-side | Análise iOS vs Android, navegador, sistema |
| `ip` | Header HTTP (automático) | Capturar server-side | Geolocalização (cidade/estado), futura prospecção B2B reversa |

**Atenção LGPD:** IP é dado pessoal. Coleta é permitida para finalidade legítima, mas precisa estar declarada na política de privacidade da Turbo.

---

## 7. Tratamento do legado e migração

### 7.1 Cenário atual (até 20/05/2026)

Diagnóstico completo no documento "UTMs — Como estão funcionando hoje" (auditoria de 07/05/2026, 5.295 deals em 90 dias).

**Inconsistências conhecidas (já mapeadas):**
- `fb` (7 deals) — grafia inconsistente de `facebook`
- `clients` (130 deals) e `footer` (18 deals) — mesma realidade, dois nomes diferentes (footer de cliente)
- `guday` (12 deals) — cliente, deveria estar como `cliente` com `campaign=guday`
- `shopify`, `ssource`, `teste-n8n`, `rede-construir` (4 deals total) — testes pontuais, ignorar
- 58 deals com placeholders literais `{{campaign.id}}` — bug já corrigido (LPs do `pages.turbopartners`)
- Parâmetros `hsa_*` (HubSpot Ads) tanto no Meta quanto no Google — legado de quando vocês usavam HubSpot, não persistem em coluna nenhuma

### 7.2 Migração via UPDATE no Bitrix

A ser executada no dia 21/05/2026, junto com o cutover.

```sql
-- Normalização de fb → facebook (7 deals)
UPDATE crm_deal
SET utm_source = 'facebook'
WHERE utm_source = 'fb';

-- Unificação de clients + footer → cliente / legado-footer (148 deals)
UPDATE crm_deal
SET utm_source = 'cliente',
    utm_campaign = 'legado-footer',
    utm_term = 'footer'
WHERE utm_source IN ('clients', 'footer');

-- Reclassificação de guday (12 deals)
UPDATE crm_deal
SET utm_source = 'cliente',
    utm_campaign = 'guday'
WHERE utm_source = 'guday';
```

**Decisão filosófica:** o histórico anterior à data de corte fica marcado com `campaign=legado-footer` para deixar explícito que é dado pré-padronização. Permite filtrar facilmente "tudo legado" no relatório.

### 7.3 Itens a deletar das URLs

**Meta Ads:** remover todos os `hsa_*` (HubSpot Ads, redundantes/quebrados):
- `hsa_acc`, `hsa_cam`, `hsa_grp`, `hsa_ad`, `hsa_src`, `hsa_net`, `hsa_ver`

**Google Ads:** remover todos os `hsa_*` e o `utm_ad` (parâmetro inexistente):
- `utm_ad`, `hsa_acc`, `hsa_cam`, `hsa_grp`, `hsa_ad`, `hsa_src`, `hsa_tgt`, `hsa_kw`, `hsa_mt`, `hsa_net`, `hsa_ver`

---

## 8. Plano de implementação

### Data de corte: 21 de maio de 2026 (quinta-feira)

A partir dessa data, todo tráfego novo segue o padrão desta constituição.

### 8.1 Pré-requisitos técnicos (até 20/05/2026)

| # | Item | Responsável |
|---|---|---|
| 1 | Criar coluna `utm_medium` em `crm_deal` + mapear no Drizzle schema (`shared/schema.ts`) | Caio Massaroni / Thiago Folador |
| 2 | Criar colunas `fbclid`, `gclid`, `referrer`, `user_agent`, `ip` em `crm_deal` | Caio Massaroni / Thiago Folador |
| 3 | Implementar captura JS de `document.referrer` em todas as LPs | Caio Massaroni / Thiago Folador |
| 4 | Implementar captura server-side de `user_agent` e `ip` | Caio Massaroni / Thiago Folador |
| 5 | Validar que captura de UTM nas LPs `pages.turbopartners` está corrigida (P2) | Caio Massaroni / Thiago Folador |
| 6 | Atualizar `TURBO_URL_TAGS` em `server/services/adsCreation/creator.ts:31` | Caio Massaroni / Thiago Folador |
| 7 | Gerador de UTMs (`/utm-builder` no Cortex) operacional, com dropdowns refletindo esta constituição | Caio Massaroni / Thiago Folador |

### 8.2 Cutover (21/05/2026)

| # | Item | Responsável |
|---|---|---|
| 8 | Deploy do Cortex com novo `TURBO_URL_TAGS` e gerador de UTMs ativo | Caio Massaroni / Thiago Folador |
| 9 | Substituir Tracking template a nível de conta no Google Ads (com botão Test antes) | Caio Malini |
| 10 | Confirmar Auto-tagging ativado no Google Ads | Caio Malini |
| 11 | Rodar UPDATEs SQL de migração do legado (seção 7.2) | Caio Massaroni / Thiago Folador |
| 12 | Atualizar manualmente os ads ativos relevantes no Meta Ads Manager (URL parameters) | Caio Malini |
| 13 | Atualizar query SQL da tela Criativos no Cortex para parsear `utm_term` com `{{placement}}` | Caio Massaroni / Thiago Folador |
| 14 | Treinamento do time (Lucas, Amanda, Aline, Caio Malini, Esther) sobre o novo padrão + uso do gerador | Ichino |

### 8.3 Pós-cutover (a partir de 22/05/2026)

| # | Item | Responsável |
|---|---|---|
| 15 | Auditoria semanal das primeiras 4 semanas para validar cobertura e detectar inconsistências | Ichino |
| 16 | Monitoramento dos 33% de leads sem UTM — esperado cair com `referrer` ativado | Ichino + time técnico |
| 17 | Atualização de dashboards / queries do Cortex que usavam `utm_source IN ('clients', 'footer', 'fb')` | Caio Massaroni / Thiago Folador |

---

## 9. Governança

### 9.1 Quem pode adicionar source ou medium novo

Qualquer pessoa pode propor. **Aprovação:** Growth (Ichino) + Pre-Sales (Lucas).

Mudar `medium` ou `source` exige **PR no código** (`shared/utm-vocabulary.ts`) — propositalmente difícil pra evitar voltar ao caos.

### 9.2 Quem pode adicionar campaign ou term novo

Time de **Growth e admins** do Cortex, via aba "Configurar valores" do gerador (`/utm-builder`).

Critério leve: o valor faz sentido pro contexto (medium+source) e segue Lei 2 (lowercase, hífen, sem acento). Não tem aprovação formal — confia no time.

### 9.3 Critérios de aprovação para source novo

Para um valor novo de source entrar na lista:

1. É um canal técnico ou categoria de relação? (não é entidade específica)
2. Vai durar mais de 12 meses?
3. Faz sentido olhar relatório agregado por ele?
4. Não conflita com nenhum source existente?

Se as 4 respostas forem "sim", entra. Se alguma for "não", o caso provavelmente é de `campaign` ou `content`, não de novo source.

### 9.4 Auditoria periódica

**Mensal:** rodar `scripts/audit-utms-bitrix.ts` e revisar:
- Cobertura geral (alvo: > 85% após cutover)
- Valores não-canônicos em `utm_source` (deve ficar zerado)
- Volume de placeholders literais (deve ficar zerado)
- Distribuição de `utm_medium` (paid, organic, eventos, referral, crm, outbound)
- Valores "criados sem cadastro" (`is_adhoc=true`) na tabela `generated_utm_links` — promover ou descartar

**Trimestral:** revisar a constituição. Se algum padrão precisa evoluir, atualiza este documento e versiona (v1.2, v2, etc).

---

## 10. Anexos

### 10.1 Glossário

- **UTM**: Urchin Tracking Module. Padrão de parâmetros de URL para rastreamento de tráfego, criado pela Urchin Software Corp. (comprada pelo Google em 2005).
- **Token dinâmico**: placeholder na URL (ex: `{{campaign.id}}`, `{network}`) que a plataforma de ads substitui automaticamente pelo valor real no momento do clique.
- **Auto-tagging**: recurso do Google Ads que injeta automaticamente o parâmetro `gclid` em toda URL clicada.
- **Tracking template**: campo do Google Ads onde se define o padrão de URL para toda a conta.
- **`fbclid` / `gclid`**: identificadores únicos de clique injetados pelo Meta e pelo Google. Permitem cruzar dados de lead com a Marketing API da plataforma para enriquecer atribuição.
- **VTSD / Ladeirinha**: arquitetura de campanha em 5 etapas (Atração, Relacionamento, Conversão Morna, Conversão Quente, Remarketing) usada nos funis Turbo.
- **Always-on**: campanha de presença contínua, sem início/fim definidos. Em UTM da Turbo: `campaign=always-on` para todo conteúdo orgânico recorrente que não pertence a uma campanha nomeada específica.
- **Social-selling (Turbo)**: iniciativa do time de SDR (Pré-vendas) conversando ativamente nas DMs dos canais orgânicos da Turbo (Instagram, LinkedIn). É operação coordenada — não é qualquer post de colaborador.

### 10.2 Tabela de tokens dinâmicos por plataforma

**Meta Ads (chave dupla `{{...}}`):**
- `{{campaign.id}}` → ID da campanha
- `{{adset.id}}` → ID do conjunto
- `{{ad.id}}` → ID do anúncio
- `{{placement}}` → posicionamento real do clique
- `{{site_source_name}}` → plataforma (`fb`, `ig`, `msg`, `an`)

**Google Ads (chave simples `{...}`):**
- `{lpurl}` → URL final do ad
- `{campaignid}` → ID da campanha
- `{adgroupid}` → ID do conjunto
- `{creative}` → ID do criativo
- `{network}` → `search`, `display`, `youtube`
- `{device}` → `mobile`, `tablet`, `desktop`
- `{matchtype}` → `exact`, `phrase`, `broad`
- `{keyword}` → palavra-chave disparadora

### 10.3 Referências

- Documento de diagnóstico: "UTMs — Como estão funcionando hoje" (07/05/2026)
- Código do Cortex: `server/services/adsCreation/creator.ts:31` (constante `TURBO_URL_TAGS`)
- Schema do Bitrix: `shared/schema.ts` (tabela `crm_deal`)
- Script de auditoria: `scripts/audit-utms-bitrix.ts`
- Gerador de UTMs: `client/src/pages/UtmBuilder.tsx` (rota `/utm-builder` no Cortex)

---

## 11. Histórico de versões

**v1.0** (07/05/2026) — Versão inicial. Vigência 21/05/2026.

**v1.1** (19/05/2026) — Refinamentos pós-auditoria interna:
- `bio` e `destaques-fixados` movidos de campaign → term em organic
- `destaques` e `destaques-fixados` unificados em `destaques` (plural)
- Campaigns canônicas de organic definidas explicitamente: `always-on`, `automacoes`, `social-selling`
- `social-selling` redefinido na seção 4.2: iniciativa de SDR conversando ativamente nas DMs dos canais orgânicos da Turbo (Instagram, LinkedIn). Não é qualquer post de colaborador.
- `funcionario` → `colaborador` em referral (alinha com cultura da Turbo)
- Outbound simplificado: sources `email`, `whatsapp`, `linkedin` (sem sufixo `-frio`/`-outreach`)
- `ligacao` removido de outbound (links nunca saem de uma ligação; usa o canal de envio efetivo com `term=pos-ligacao`)
- `facebook` e `pinterest` adicionados como sources em organic (cobrir gap)
- Exemplos práticos adicionados na seção 5.3 distinguindo `colaborador/referral` de `social-selling/organic`
- Lei quatro adicionada: campaign é iniciativa, term é local, content é peça específica
- Anexo 10.1 ganhou definições de Always-on e Social-selling
- Seção 9 (governança) ganhou item 9.2 separando aprovação de medium/source (PR) de campaign/term (UI direta)

**v1.1.1** (19/05/2026, mesma data — ajustes finos pós-teste do gerador):
- Term `end-screen` removido de organic/youtube (raramente usado)
- Term `dm-direta` renomeado para `dm` (mais conciso)
- Campaign `social-selling` agora vale para qualquer source de organic (era restrita a Instagram + LinkedIn). Cobre o caso futuro de DMs no TikTok, YouTube, etc.

**v1.2** (26/05/2026) — Refinamentos pós-treinamento do time + aba Guia em `/utm-builder`:
- Vocabulário de `term` por plataforma explicitado em tabelas (Instagram, LinkedIn, YouTube, TikTok)
- YouTube ganha vocabulário próprio: `descricao-video`, `descricao-shorts`, `card`, `bio`, `banner`
- LinkedIn enxuto: `bio`, `feed`, `dm`
- Regra `bio` vs `linktree` reescrita pela ótica de quem está colando o link (elimina confusão)
- `facebook` removido de organic (Turbo não opera Facebook orgânico)
- Slugs oficiais de produto fixados: `creators`, `ecommerce`, `comercial`, `flash`
- Convenção de `content` em organic: `{slug-curto}-{aaaa-mm-dd}` sem repetir o formato
- **`victor` e `andre` adicionados como mediums-exceção** (figuras-chave de distribuição com canal próprio robusto — §3.7 + §4.7 + exemplos em §5.3). Decisão deliberada de tratá-los como dimensão de primeira ordem no relatório, fugindo da Lei 1 (vocabulário fechado). Toda nova figura nesse formato exige aprovação Growth+Pre-Sales caso a caso.

**v1.3** (08/06/2026) — `rodrigo` adicionado como medium-exceção:
- Terceira figura-chave com canal próprio robusto, mesmo tratamento de `victor` e `andre` (§3.7 + §4.7 + exemplo no LinkedIn em §5.3)
- Sources liberados: `instagram`, `youtube`, `linkedin`, `tiktok` (idêntico às outras figuras)

**v1.4** (09/06/2026) — `content` por tipo de destino + bio com múltiplos links:
- `content` ganha duas lógicas (§4.2): **link fixo** (bio/linktree/banner/sobre) → `content={tipo-de-destino}` (`site-{pagina}`, `lp-{slug}`, `whatsapp`), sem data; **post** (feed/stories/reels/descrição/DM) → `content={nome-do-post}-{aaaa-mm-dd}`
- Prefixo `link-` descontinuado e substituído por `site-`/`lp-`, que carregam o tipo real de destino (permite agrupar "LP vs site institucional" no relatório). Todos os exemplos do doc atualizados (§4.2, §4.7, §5.3)
- Caso de **bio com múltiplos links nativos** documentado (§4.2): até 5 links no Instagram, todos `term=bio`, diferenciados por `content` (tipo de destino, sem data). `campaign` muda só quando o botão pertence a iniciativa específica
- Nota sobre WhatsApp: UTM em link `wa.me`/`api.whatsapp.com` não é capturada; rastrear via página de redirect tracked (`/wpp`)

---

**Versão:** 1.4
**Data de aprovação:** *aguardando Ichino*
**Vigência a partir de:** 21/05/2026
**Próxima revisão prevista:** agosto/2026 (revisão trimestral)
