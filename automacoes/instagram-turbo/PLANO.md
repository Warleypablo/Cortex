# Plano de execução — Automação de publicação Instagram

**Stack:** ClickUp + Google Drive/Docs + Meta Graph API (Instagram) + **Claude Code como runtime** (sem n8n).
**Escopo MVP:** apenas Instagram do perfil TurboPartners.
**Última revisão:** 2026-05-04 (filtro de data + slots fixos 12h/18h).

## Regras de cronograma (atualizadas 2026-05-04)

- Agente posta **só tasks com `Data de Postagem == hoje`**. Não antecipa, não cobre passado.
- **Slots fixos hoje:** 12h e 18h, com **1h de tolerância** (slot 12h ativo até 12:59, slot 18h até 18:59). Fora desses intervalos, agente não publica nada.
- **Cada execução relê o ClickUp do zero.** Não há cache de "plano do dia" entre execuções — calendário muda no meio do dia (task aprovada vira pausada, ou move pra outro dia) e o agente respeita isso automaticamente.
- **Idempotência:** marker `[auto-posted]` no comentário garante que nenhuma task seja publicada 2× mesmo se o agente reiniciar.
- **Modo futuro:** equipe vai criar custom field `Horário de Postagem` no ClickUp e preencher por task. Quando isso acontecer, os slots 12h/18h fixos viram fallback e cada task usa seu próprio horário (com a mesma tolerância de 1h). Raquel avisa.

---

## 0. Contexto real (validado em dados, não em hipótese)

Rodei um script de investigação contra os sistemas reais. Achados que redesenharam o plano:

1. **Lista ClickUp Instagram 📷**: 1968 tasks. Posts classificados por status: 496 `complete` · 25 `to do` · 22 `postado` · 5 `review` · **4 `aprovado`** · 1 `pausado`.
2. **A descrição da task tem template consistente**, mas quase sempre com campos Copy/Pasta em branco. Só o `ID (Suba no Drive com este nome): TURBO_<slug>` é preenchido de verdade, e só **após o editor renomear** (template inicial vem como `TURBO_xpto`).
3. **Subtasks NÃO são "copy"**. Em task `Não basta empreender`, as subtasks reais são: `Roteirização`, `Gravar + upar ativos no drive`, `Mineração de ativos` (operacionais do editor). A premissa antiga "branch por subtask copy aprovada" está morta.
4. **Task pai `Social Media - <MÊS>`** tem schema `Documento de copy: / Link do Instagram: / Link do Site:` na descrição — sempre vazio. Os links do Doc e do Drive **não vivem no ClickUp**.
5. **1 Doc e 1 Drive por mês**, com estrutura descoberta:
   - Doc: `SOCIAL MEDIA TURBO [<MÊS>]` (owner: esther.fiorio@turbopartners.com.br)
   - Drive: pasta `MM - Mês` dentro de raiz fixa `1yGxKCORxe7PipuYKY1yd508IWQyKgIIt`
6. **Custom fields úteis preenchidos em posts reais**: `Data de Postagem` (timestamp) e `Formato do post` (dropdown).

---

## 1. Arquitetura (revisada)

```
        ┌────────────────────┐
        │  Claude Code       │  runtime (scheduled task a cada 5 min)
        │  cron OU daemon    │
        └─────────┬──────────┘
                  │ lê
                  ▼
        ┌────────────────────┐
        │  ClickUp API v2    │  lista Instagram 📷, filtro status=aprovado
        └─────────┬──────────┘
                  │ para cada task aprovada:
                  ▼
    ┌─────────────────────────────────────┐
    │ Resolver mês: task.parent.name      │
    │   "Social Media - ABRIL" → "ABRIL"  │
    └────────┬─────────────────────────┬──┘
             ▼                         ▼
    ┌─────────────────┐       ┌──────────────────┐
    │ Google Docs     │       │ Google Drive     │
    │ SOCIAL MEDIA    │       │ raiz fixa →      │
    │ TURBO [ABRIL]   │       │ 04 - Abril →     │
    │                 │       │ TURBO_<slug>/    │
    │ • seção UPPER   │       │ • N arquivos     │
    │   = task.name   │       │ • tipo inferido  │
    │ • extrai        │       │   por mimeType   │
    │   **LEGENDA**   │       │ • sort lexico    │
    └────────┬────────┘       └────────┬─────────┘
             │                         │
             └────────────┬────────────┘
                          ▼
              ┌──────────────────────┐
              │ Legenda vazia?       │
              │   ├── sim → Claude   │
              │   │        gera +    │
              │   │        pede      │
              │   │        approval  │
              │   │        (comment) │
              │   └── não → usa doc  │
              └──────────┬───────────┘
                         ▼
              ┌──────────────────────┐
              │ Meta Graph API       │
              │ /media + /publish    │
              │ (reels|carrossel|    │
              │  single)             │
              └──────────┬───────────┘
                         ▼
              ┌──────────────────────┐
              │ ClickUp update       │
              │ • status=postado     │
              │ • comment URL do IG  │
              │ • marker idempotência│
              └──────────────────────┘
```

### Por que não n8n

- **Claude Code já roda** (sem infra nova), **Python + MCPs** (ClickUp, Drive) que a gente precisa **já estão configurados** no workspace.
- **Idempotência via comentário** elimina necessidade de DB ou fila.
- **ClickUp comment para aprovação humana** elimina Slack/Webhook-wait do n8n.
- **Scheduled task** (via `mcp__scheduled-tasks__create_scheduled_task` ou cron local) faz o polling a cada 5-10 min.
- Latência de 5-10 min pra social media é irrelevante (versus webhook instantâneo).

---

## 2. Chaves e mapeamento ClickUp ↔ Doc ↔ Drive

| Chave | Origem | Pra onde aponta |
|---|---|---|
| `task.name` | Nome da task ClickUp | Header da seção no Doc (`task.name.upper()` ↔ `**TASK NAME**`) |
| `TURBO_<slug>` | Regex na descrição do card | Nome da subpasta no Drive |
| `task.parent.name` (`Social Media - ABRIL`) | Pai da task | Mês → resolve Doc e pasta Drive |

**Edge case**: se descrição ainda contém `TURBO_xpto` quando status=`aprovado` → é erro humano. Agente comenta `⚠️ ID não renomeado; corrija e me chame`, não publica.

---

## 3. Parser do Doc (essencial)

```python
def parse_doc(content: str) -> dict[str, str]:
    """
    Retorna { section_header_UPPER: legenda_text }.
    Seção = linha em bold TODO-MAIÚSCULO sem 'IMG', 'LEGENDA', 'TELA N'.
    Legenda = texto entre '**LEGENDA**' e próximo header (ou EOF).
    """
    # regex: headers bold uppercase
    # regex: **LEGENDA** ... até próximo header
    # retorna dict
```

Teste unitário: tem que extrair corretamente `RECORDE NEYMAR`, `E SE A GENTE SE MUDASSE`, `JUSTIN KARAOKE`, etc. Seções `CONTENT MKT`, `UM BOM MARKETING` (legenda vazia) retornam `""`.

---

## 4. Decidir tipo do post

```python
def tipo_do_post(assets: list[DriveFile]) -> str:
    videos = [f for f in assets if f.mime_type.startswith('video/')]
    imgs   = [f for f in assets if f.mime_type.startswith('image/')]
    if videos:               return 'reels'
    if len(imgs) >= 2:       return 'carousel'
    if len(imgs) == 1:       return 'single'
    raise ValueError('pasta vazia')
```

Meta Graph calls por tipo:
- **single**: `POST /{ig_id}/media` (image_url) → `POST /{ig_id}/media_publish`
- **reels**: `POST /{ig_id}/media` (video_url, media_type=REELS) → esperar status READY → `/media_publish`
- **carousel**: N × `POST /{ig_id}/media` (is_carousel_item=true) → `POST /{ig_id}/media` (CAROUSEL, children=[ids]) → `/media_publish`

Pré-requisito: assets precisam de **URL pública**. Opções:
- (a) Compartilhar pasta Drive como `Anyone with the link` e usar `https://drive.google.com/uc?id=<fileId>` (pode ter flakiness com reels).
- (b) Upload temporário pra S3/Vercel Blob/Cloudflare R2 antes de chamar Meta.
- **Decisão pendente**: começar com (a) e, se falhar, migrar.

---

## 5. Aprovação humana (sem Slack, sem ferramenta nova)

Disparada **só quando o Claude gera legenda** (porque Doc vazio).

1. Agente comenta na task:
   ```
   🤖 Legenda gerada por IA (Doc estava vazio). Preview:
   ---
   <texto da legenda>
   ---
   Responda este comentário com:
   • "aprovar" → publico agora
   • "editar" → cola a versão corrigida aqui
   • "cancelar" → abortar
   Prazo: 24h. Depois, arquivo e pulo.
   ```
2. Agente volta a cada 5 min. Se achou resposta nova → age. Se 24h sem resposta → comenta timeout e arquiva.

Zero status novo, zero custom field, zero webhook. Idempotência via marker `[auto-draft: v1]` no comment próprio.

---

## 6. Idempotência

Marker de comentário no card após cada ação irreversível:
```
[auto-posted media_id=17945... run_id=abc123 at=2026-04-21T14:32:00Z]
```

Agente, ao processar uma task, primeiro lê os comentários: se achou `[auto-posted`, pula.

---

## 7. Roadmap de execução (ordem sugerida)

| Bloco | Descrição | Mexe em sistemas externos? |
|---|---|---|
| **A. Validação final** | Rodar `scripts/0-validar-estrutura.py` e `investigar-estrutura.py` contra 10 tasks reais pra confirmar parser | ✅ só leitura ClickUp |
| **B. Credenciais** | Meta Graph (app + long-lived token + IG business ID) + Google OAuth (escopo Docs+Drive read, Drive write opcional) | nenhum ClickUp write |
| **C. Agente base** | `agente/main.py` com loop: lista aprovadas → resolve mês → lê Doc → lê Drive → decide publicação. **Modo dry-run** = não chama Meta, só loga plano | só leitura |
| **D. Meta publish** | Implementar 3 tipos (single/reels/carousel). Testar com IG de teste ou arquivo `.env` `DRY_RUN=1` | nenhum |
| **E. ClickUp write** | Após publish: update status → postado, comment com URL. **Pedir permissão antes de ativar.** | ✅ ClickUp write |
| **F. Fallback Claude** | Se Doc vazio → gera + aprovação via comment loop | ClickUp write |
| **G. Scheduled task** | Ativa polling a cada 5-10 min em DISABLED state até dry-run passar | nenhum |
| **H. Dry-run 1 semana** | Scheduled rodando, só logando no console. Valida match rate. | só leitura |
| **I. Ativação** | Flip `DRY_RUN=0`. Observar primeiros 3 publishes manualmente. | tudo |
| **J. Hardening** | Retry, logs estruturados, alerta em failure (ClickUp comment). | ClickUp write |

---

## 8. Estrutura de pastas do projeto

```
Automação n8n/                          (vamos renomear depois pra "automacao-instagram")
├── _arquivado/
│   └── n8n/                            ← tudo relacionado a n8n vai pra cá
├── agente/
│   ├── main.py                         ← entry point (loop de processamento)
│   ├── clickup.py                      ← wrappers read/write ClickUp API
│   ├── drive.py                        ← wrappers Google Drive
│   ├── docs_parser.py                  ← parser do Doc mestre
│   ├── instagram.py                    ← Meta Graph publish
│   ├── caption_ai.py                   ← Claude fallback
│   ├── idempotency.py                  ← comment markers
│   ├── runbook.md                      ← como rodar, debugar, ver logs
│   └── ferramentas.md                  ← mapa de MCPs vs APIs usadas
├── scripts/
│   ├── 0-validar-estrutura.py          ← valida ClickUp
│   ├── investigar-estrutura.py         ← inspeciona descrição/custom fields
│   └── 1-test-meta-token.sh            ← valida token Meta
├── .env                                ← (gitignore) credenciais
├── .env.example                        ← template
├── PLANO.md                            ← este doc
├── CHECKLIST-EXECUCAO.md               ← passo a passo
└── README.md
```

---

## 9. Decisões já tomadas

- ❌ Sem criar custom fields no ClickUp (workspace compartilhado).
- ❌ Sem Slack — aprovação e alertas via **comment no ClickUp**.
- ❌ Sem lista "Sandbox" no ClickUp.
- ❌ LinkedIn/YouTube/TikTok fora de escopo do MVP.
- ❌ **Sem n8n** — runtime é Claude Code + Python.
- ✅ Se Claude gerar legenda, **NÃO escreve de volta no Doc mestre** (evita poluir Doc da Esther). Legenda gerada fica no comment do ClickUp como preview + publicação direta após aprovação.

## 10. Decisões pendentes (bloqueiam Bloco B)

1. **Meta / Instagram**: app já existe em developers.facebook.com? Se não, criar + gerar long-lived token (60 dias). Quem administra?
2. **Google OAuth**: usar conta pessoal da Raquel (caio) ou service account da TurboPartners?
3. **Asset URL pública**: começar compartilhando Drive público (simples) ou upload pra S3/Vercel Blob (robusto)?
4. **Brand voice guide** pro Claude: copiar de algum material existente da Turbo ou escrever do zero com 3-5 exemplos de legendas pasted?
5. **Onde rodar o scheduled task**: dentro do próprio Claude Code (via `mcp__scheduled-tasks`) ou cron local no macOS da Raquel? (primeiro é mais observável, segundo é mais independente)
