# Checklist de execução

Ordem enxuta pra tirar do papel. Cada bloco tem critério "pronto" claro.

---

## Bloco A — Validação (zero risco, só leitura)  ⏱ 30 min

- [x] `CLICKUP_API_TOKEN` configurado no `.env`
- [x] `scripts/0-validar-estrutura.py` rodou — descobriu que template da descrição está 90% em branco mas consistente
- [x] `scripts/investigar-estrutura.py` rodou — confirmou custom fields, subtasks operacionais (não "copy"), links Doc/Drive fora do ClickUp
- [x] Doc mestre ABRIL lido via MCP Drive — delimitador `**<TITULO>**` + `**LEGENDA**` validados
- [x] Pasta `04 - Abril` inspecionada — subpasta `TURBO_<slug>` por post confirmada
- [x] Pasta-mãe fixa dos meses: `1yGxKCORxe7PipuYKY1yd508IWQyKgIIt`

**Pronto quando:** arquitetura final está em `PLANO.md` §1. ✅

---

## Bloco B — Credenciais externas  ⏱ 1-2h (Meta é o demorado)

### B.1 Meta / Instagram
- [ ] Confirmar se já existe app em [developers.facebook.com](https://developers.facebook.com) da TurboPartners. Se não, criar app tipo **Business**.
- [ ] Conectar Facebook Page + Instagram Business/Creator da TurboPartners
- [ ] Produtos: **Instagram Graph API** + **Pages API**
- [ ] Permissões: `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, `business_management`
- [ ] Gerar **Long-Lived Token** (60 dias) — anotar data de expiração
- [ ] Pegar `IG_BUSINESS_ACCOUNT_ID` via Graph Explorer: `GET /me/accounts?fields=instagram_business_account`
- [ ] Preencher `.env`: `META_APP_ID`, `META_APP_SECRET`, `META_LONG_LIVED_TOKEN`, `META_PAGE_ID`, `IG_BUSINESS_ACCOUNT_ID`

### B.2 Google Service Account (Drive + Docs)
- [x] [console.cloud.google.com](https://console.cloud.google.com) → projeto `n8n-reports-453301` → **Google Drive API** + **Google Docs API** ativadas
- [x] Service Account criada (`malini@n8n-reports-453301.iam.gserviceaccount.com`) + chave JSON baixada
- [x] Caminho do JSON colado no `.env` como `GOOGLE_SERVICE_ACCOUNT_JSON`
- [ ] **Compartilhar** a pasta raiz dos meses (`1yGxKCORxe7PipuYKY1yd508IWQyKgIIt`) com `malini@n8n-reports-453301.iam.gserviceaccount.com` (role: **Visualizador**)
- [ ] Idem para os Docs `SOCIAL MEDIA TURBO [MÊS]` se não herdarem permissão da pasta raiz

### B.3 Anthropic
- [ ] [console.anthropic.com](https://console.anthropic.com) → API Key → `ANTHROPIC_API_KEY`

**Pronto quando:** `scripts/test-creds.py` passa em tudo.

---

## Bloco C — Agente base (offline, zero publish)  ⏱ 1 dia

- [ ] Criar `agente/main.py` com loop principal
- [ ] Módulos: `clickup.py`, `drive.py`, `docs_parser.py`, `instagram.py`, `caption_ai.py`, `idempotency.py`
- [ ] `docs_parser.py`: regex de seções bold UPPER + `**LEGENDA**`, com testes unitários (5+ casos reais)
- [ ] Resolver mês: `parent.name → (doc_id, drive_folder_id)`, cache em `.cache/meses.json` (TTL 30 dias)
- [ ] `tipo_do_post(assets)` por mimeType
- [ ] `DRY_RUN=1` → fluxo completo sem chamar Meta nem escrever no ClickUp

**Pronto quando:** `DRY_RUN=1 python agente/main.py` imprime pras 4 tasks `aprovado` atuais:
- Doc section match (ou "vazia → Claude")
- Pasta Drive + tipo inferido
- Lista de files que seriam publicados
- Plano de comentário ClickUp

---

## Bloco D — Meta Graph publish  ⏱ 1 dia

- [ ] `publish_single`, `publish_reel`, `publish_carousel`
- [ ] Asset URL pública: Drive share (`uc?id=`) primeiro; se reels falhar → S3/Vercel Blob
- [ ] Testar cada tipo com assets reais de ABRIL + **conta IG de teste**
- [ ] Polling de status READY pro reels antes do publish
- [ ] Respeitar rate limit (25/dia)

**Pronto quando:** 1 single + 1 reel + 1 carousel publicados em conta teste.

---

## Bloco E — ClickUp write  ⏱ 2h  ⚠ pede permissão da Raquel antes

- [ ] `update_task(id, status='postado')`
- [ ] `create_comment(task_id, f'✅ Publicado: {ig_url}\\n[auto-posted media_id={id}]')`
- [ ] Idempotência: antes de processar, `get_comments(task)` — se achar `[auto-posted` skip

**Pronto quando:** Raquel confirmou, teste manual moveu 1 task `aprovado→postado`.

---

## Bloco F — Fallback Claude  ⏱ meio dia

- [ ] `agente/brand_voice.md` (perguntar à Esther: tem material?)
- [ ] `caption_ai.generate(task_name, context, formato)` com prompt caching
- [ ] Loop aprovação: comenta preview → aguarda "aprovar"/"editar"/"cancelar"
- [ ] Timeout 24h → arquiva

**Pronto quando:** 1 task com Doc vazio → Claude gera → Raquel comenta "aprovar" → publica.

---

## Bloco G — Scheduled task  ⏱ 30 min

- [ ] Scheduled via `mcp__scheduled-tasks__create_scheduled_task` a cada 5 min, **disabled** inicialmente
- [ ] OU cron local: `*/5 * * * * cd /path && python agente/main.py >> logs/agente.log 2>&1`
- [ ] Log JSON lines em `logs/YYYY-MM-DD.jsonl`

---

## Bloco H — Dry-run 1 semana  ⏱ 7 dias

- [ ] `DRY_RUN=1`, scheduled ativo
- [ ] Métrica: aprovadas/dia, match rate Doc, taxa de crash
- [ ] Match rate <80% → revisar parser

---

## Bloco I — Ativação  ⏱ 1 dia

- [ ] `DRY_RUN=0`
- [ ] Observar primeiros 3 publishes em stand-by
- [ ] Estranho? Reverte pra `DRY_RUN=1`

---

## Bloco J — Hardening  ⏱ ongoing

- [ ] Retry com backoff em Meta (3×, 30s)
- [ ] Renovação Long-Lived Token (cron, avisa <7 dias)
- [ ] Alerta em failure: comment no card + task "⚠️ Automação falhou"

---

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Drive share link não serve pra reels pesados | Upload temporário S3/Vercel Blob |
| Parser Doc falha em seção mal formatada | Testes unitários + fallback humano |
| `TURBO_xpto` não renomeado em task aprovada | Detecta e avisa via comment; não publica |
| Long-Lived Token expira | Cron separado avisa 7 dias antes |
| 2 ciclos rodando simultâneos | Lockfile `.cache/.lock` |
| Rate limit Meta (25/dia) | Contador + skip se atingir |

---

## Gaps (perguntar antes de avançar)

1. **Meta app** já existe na TurboPartners? Quem administra? → bloqueia B.1
2. **Google OAuth** — conta da Raquel serve, ou precisa conta "automação"? → bloqueia B.2
3. **Brand voice guide** — tem material existente ou escrevo do zero? → bloqueia F
4. **IG de teste** pra Bloco D — existe? → bloqueia D
5. **Scheduled runtime** — dentro do Claude Code ou cron local macOS? → bloqueia G

Trabalho útil sem resolver esses gaps: **Bloco C inteiro** (agente em dry-run só precisa do que já temos).
