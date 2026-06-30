---
name: subir-conteudo-organico
description: >
  Blueprint do publicador de conteúdo orgânico multiplataforma da Turbo (código em
  automacoes/instagram-turbo). Use esta skill SEMPRE que for: (1) entender/operar como o
  agente posta conteúdo orgânico a partir do ClickUp + Google Doc + Drive; (2) ADICIONAR
  UMA NOVA PLATAFORMA ao publicador (replicar o Instagram para TikTok, YouTube, LinkedIn,
  etc.) seguindo o mesmo núcleo agnóstico e só trocando o passo de publicação; (3) debugar
  por que um post não saiu (slot, data, legenda vazia, pasta do Drive, idempotência).
  Gatilhos: "subir conteúdo", "publicar no instagram/tiktok", "adicionar plataforma de
  publicação", "replicar para o tiktok/youtube/linkedin", "como o agente posta", "por que
  não postou", "novo orquestrador de publicação".

  Fonte da verdade: automacoes/instagram-turbo/ (Instagram = produção; TikTok = referência
  já implementada). Painel operador no Cortex lê/comanda via Postgres (tabelas content_*).
---

# Subir Conteúdo Orgânico — Blueprint do Publicador Multiplataforma

Publica conteúdo orgânico (Instagram hoje; TikTok já espelhado; YouTube/LinkedIn próximos) a
partir de tasks `aprovado` numa lista do ClickUp, lendo legenda do **Google Doc** e mídia do
**Google Drive**, e escrevendo o resultado de volta no ClickUp.

**Filosofia central — e a razão desta skill existir:** o pipeline tem um **núcleo agnóstico de
plataforma** (ler ClickUp → resolver mês → legenda do Doc → assets do Drive → planejar) que é
**100% reusado**, e um **adaptador por plataforma** (o passo de publicação + as regras do que
cada rede aceita) que é a **única coisa que muda**. Adicionar uma plataforma = escrever um
adaptador fino, **nunca** reescrever o núcleo.

> Confirmado no código: `agente/main_tiktok.py` reusa `clickup.list_approved_tasks` +
> `main.plan_task` e só troca o passo de publish. É exatamente esse o padrão a replicar.

---

## 1. Arquitetura: núcleo agnóstico vs adaptador de plataforma

| Camada | Arquivo(s) | Reusa entre plataformas? |
|---|---|---|
| Leitura ClickUp (lista, descrição, comentários, mês) | `agente/clickup.py` | ✅ sempre |
| Planejamento (mês → Doc/legenda → pasta Drive → tipo/assets → idempotência → slot/data) | `agente/main.py::plan_task` → `PlannedAction` | ✅ sempre |
| Parser de legenda do Doc | `agente/docs_parser.py::find_legenda_for_task` | ✅ sempre |
| Drive (resolver pasta do mês, achar `TURBO_<slug>`, classificar assets) | `agente/drive.py` | ✅ sempre |
| Idempotência (lock + markers em comentário) | `agente/idempotency.py` | ✅ sempre |
| Writeback ClickUp (status `postado`, comment com link, marker, erro) | `agente/clickup_write.py` | ✅ sempre |
| **Publicação** (criar mídia na rede) | `agente/instagram.py` · `agente/tiktok.py` · *(novo)* | ❌ **troca por plataforma** |
| **Readiness** (o que a rede aceita) | `PlannedAction.is_ready_to_publish` (IG) · `main_tiktok.tiktok_ready` | ❌ **troca por plataforma** |
| **Entrega de asset** | rehost p/ URL pública (IG) · upload de bytes direto (TikTok) | ❌ **troca por plataforma** |
| **Orquestrador** (entrypoint) | `agente/main.py` (IG) · `agente/main_tiktok.py` (TikTok) · *(novo)* | ❌ **fino, 1 por plataforma** |

---

## 2. O pipeline (Instagram = referência)

Por execução (`python3 -m agente.main`, default `DRY_RUN=1`):

1. **Lock** (`.cache/.lock`) — garante 1 execução por vez.
2. **Lista tasks aprovadas** — `clickup.list_approved_tasks()` na lista Instagram 📷 (`901300920768`).
3. Pra cada task, **`plan_task`** monta um `PlannedAction`:
   - `clickup.parse_description` → `TURBO_<slug>`, formato, criativo.
   - mês via `clickup.extract_month_from_parent_name` (parent `Social Media - ABRIL` → `ABRIL`).
   - **idempotência**: lê comentários (`inspect_comments` / `should_process`) → pula se já postado / em aprovação.
   - **filtro de data/slot**: só posta se `Data de Postagem == hoje` e dentro do slot (12h/18h, tolerância 1h). `--force-now` bypassa (só teste).
   - **legenda**: Doc de copy do card (`caption_doc_id`) → fallback Doc mensal `SOCIAL MEDIA TURBO [MÊS]`; `find_legenda_for_task(doc_text, task.name)`. Vazia → `legenda_source="claude-precisa"`.
   - **assets**: `drive.find_post_folder(TURBO_<slug>)` → `classify_assets` → `tipo_post` ∈ {single, reels, carousel} + `asset_ids`/`asset_mimes`.
4. **`DRY_RUN=1`** → imprime o plano e sai. **`DRY_RUN=0`** → `execute_plan`:
   - **rehost**: `rehost.rehost_file_id` transforma cada arquivo do Drive em **signed URL de bucket GCS** (a Meta baixa anonimamente; link do Drive cai em login).
   - **publish**: `instagram.publish_single | publish_reel | publish_carousel` (ciclo container → poll status `FINISHED` → `media_publish`).
   - **writeback**: `clickup_write.mark_posted(task, media_id, permalink, tipo, run_id)` → status `postado` + comment com link + marker `[agente:postado ...]`. Em falha → `mark_error`.

---

## 3. Contrato do núcleo (NÃO reescrever ao adicionar plataforma)

- `clickup.list_approved_tasks(list_id?) -> list[Task]`
- `main.plan_task(task, *, force_now=False) -> PlannedAction` — campos úteis pro adaptador:
  `task_id, task_name, mes, turbo_slug, tipo_post, asset_count, asset_ids, asset_mimes,
  legenda_text, legenda_len, legenda_empty, legenda_source, posting_date, slot_now,
  skip_reason, error, oauth_pending, already_posted, pending_approval`.
- Idempotência: markers de comentário + `Lock()`. **Listas de ClickUp separadas por plataforma**
  → o mesmo marker `[agente:postado]` não colide entre redes (TikTok e IG vivem em listas diferentes).
- Writeback: `clickup_write.mark_posted / mark_error / create_comment / update_task_status`.

---

## 4. Como ADICIONAR uma plataforma (o checklist que se replica)

TikTok já está feito — use `agente/tiktok.py` + `agente/main_tiktok.py` como molde. Para uma rede
nova (YouTube, LinkedIn, …):

1. **ClickUp** — lista própria pra rede + env `CLICKUP_LIST_ID_<PLAT>`. (Não criar custom fields no
   workspace compartilhado sem permissão.)
2. **`agente/<plat>.py`** — o adaptador de publicação. Implementar:
   - `verify_token()` / `whoami()` — confirma credencial e **identifica a conta certa** antes de publicar.
   - `publish_*(...)` — cria a mídia na rede e retorna um id permanente + (se houver) permalink.
   - Erro tipado próprio (ex.: `MetaError`) com status + payload + operação.
3. **`agente/main_<plat>.py`** — orquestrador **fino**: importa `from agente import main as core`, chama
   `core.plan_task(...)`, e só troca (a) a função de readiness e (b) o passo de publish. Reusa
   `clickup_write` pro writeback. (Veja `main_tiktok.py` — ~230 linhas, quase tudo é log/resumo.)
4. **Readiness** — o que a rede aceita. Ex.: TikTok é **vídeo-only** (`tiktok_ready` rejeita
   carrossel/foto); YouTube = vídeo; LinkedIn = imagem/vídeo/artigo. Filtrar `tipo_post`/`asset_mimes`.
5. **Entrega de asset** — duas estratégias:
   - **URL pública (rehost)** quando a rede baixa por URL (Meta/IG) → reusar `rehost.rehost_file_id`.
   - **Upload de bytes direto** quando a rede sobe o arquivo (TikTok `FILE_UPLOAD`) → baixar do Drive e enviar; **pular rehost**.
6. **Auth/token** — credenciais no `.env` + plano de **renovação** (token longo da Meta = 60d;
   TikTok = refresh OAuth). O painel deve avisar "token expira em N dias".
7. **Idempotência/writeback** — reusa os markers. Lista separada → sem colisão.
8. **Estado pro painel** — ao fim de cada ciclo, escrever em **`content_*`** no Postgres do Cortex
   (run + estado por post + heartbeat) e consumir a fila de `commands`. Ver §6.

**Regra de ouro:** se você se pegar editando `plan_task`, `drive.py`, `docs_parser.py` ou `clickup.py`
pra "encaixar" a nova rede, pare — provavelmente dá pra resolver no adaptador. O núcleo é sagrado.

---

## 5. Diferenças por plataforma

| | Mídia | Entrega do asset | Auth | Modo de post | Gotchas |
|---|---|---|---|---|---|
| **Instagram** (prod) | single · reels · carousel | rehost → signed URL GCS | Meta long-lived token (60d) + `IG_BUSINESS_ACCOUNT_ID` | publica direto | reels: poll status `FINISHED`; rate limit 25/dia |
| **TikTok** (feito) | **só vídeo** | upload de bytes direto (`FILE_UPLOAD`) | OAuth (`TIKTOK_*`) | `draft` (rascunho, legenda manual) ou `direct` (precisa auditoria do app) | sem carrossel/foto; chunking 64–128MB |
| **YouTube** (próximo) | vídeo (Shorts/long) | upload resumable | OAuth Google | público/unlisted/agendado | título+descrição+tags; quota diária |
| **LinkedIn** (próximo) | imagem · vídeo · artigo/texto | upload de asset | OAuth LinkedIn | direto | página vs perfil pessoal |

---

## 6. Integração com o painel (Cortex)

O publicador é **headless**; quem o operadores veem é o **painel** (`feature/instagram-turbo-painel`).
Contrato Postgres como fonte da verdade (tabelas `content_*`, platform-agnósticas):

- **`content_publish_runs`** — 1 linha/ciclo (heartbeat, contagens, erros) → "saúde do agente".
- **`content_posts`** — 1 linha/task/dia (upsert): plataforma, tipo, slot, estado
  (`agendado | aguardando_ia | publicado | falhou | pulado`), origem da legenda, link.
- **`content_publish_commands`** — fila painel→worker (publicar agora / retry / pular / aprovar+editar legenda / pausar).
- **`content_publish_settings`** — agente ligado/pausado, dry-run.

O worker (Render, sempre-ligado) **escreve** runs/posts/heartbeat e **consome** commands. O backend
Express só lê/escreve Postgres — nunca chama o Python. Detalhes em
`memory/instagram-turbo-painel-operador`.

---

## 7. Guardas / não-fazer

- **`DRY_RUN=1` é o default.** Publicação real exige `DRY_RUN=0` explícito + conta verificada antes.
- **Não antecipa nem cobre passado**: só `Data de Postagem == hoje`, dentro do slot. Sem `--force-now` em produção.
- **Idempotência primeiro**: ler comentários antes de qualquer ação irreversível.
- **Nunca escrever a legenda gerada por IA de volta no Doc da Esther** — vai como preview no comment do ClickUp e publica após aprovação.
- **Não criar custom fields/listas/status/webhooks** no ClickUp compartilhado sem permissão.
- Se postou na rede mas falhou marcar no ClickUp → **logar gritando** e marcar manual (senão reposta no próximo ciclo).

---

## Changelog da skill

- **v1 (2026-06-24):** Versão inicial. Extrai o padrão núcleo-agnóstico + adaptador-por-plataforma de
  `agente/main.py` (Instagram, prod) e `agente/main_tiktok.py` (TikTok). Checklist de "adicionar
  plataforma" e contrato `content_*` do painel.
