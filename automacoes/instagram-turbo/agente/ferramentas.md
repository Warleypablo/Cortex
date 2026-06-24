# Ferramentas — MCPs vs APIs diretas

Mapeamento de como cada sistema é acessado, escolhendo a ferramenta certa pra cada caso.

## ClickUp

| Operação | Ferramenta | Por quê |
|---|---|---|
| Listar tasks aprovadas | **API REST direta** (`GET /list/{id}/task`) | MCP não tem filtro por status; REST é mais rápido e previsível |
| Ler descrição + custom fields + subtasks | **API REST direta** (`GET /task/{id}?include_subtasks=true`) | mesmo motivo |
| Criar comment | **API REST direta** (`POST /task/{id}/comment`) | controle total sobre format + idempotência |
| Atualizar status | **API REST direta** (`PUT /task/{id}`) | atomicidade |
| Ler comments (pra idempotência) | **API REST direta** (`GET /task/{id}/comment`) | |

O MCP do ClickUp tem ~50 tools disponíveis — útil pra investigação interativa (como foi feito na fase de descoberta), mas pro agente em produção a API REST é mais leve e testável.

Endpoint base: `https://api.clickup.com/api/v2`
Header: `Authorization: $CLICKUP_API_TOKEN`

## Google Drive / Docs

| Operação | Ferramenta | Por quê |
|---|---|---|
| Buscar pasta do mês / Doc do mês | **API Drive v3** (`files.list`) com OAuth | MCP do Drive não suporta `in parents` na query |
| Listar arquivos dentro de `TURBO_<slug>/` | **API Drive v3** (`files.list?q="<id>" in parents`) | mesmo |
| Ler conteúdo do Doc mestre | **API Docs v1** (`documents.get`) | precisa do texto estruturado com headers bold; o MCP retorna só o "content snippet" concatenado |
| Download de asset (img/vídeo) | **API Drive v3** (`files.get?alt=media`) ou share link público | |

OAuth: Desktop app flow (ver `scripts/2-get-google-refresh-token.py`).
Escopos mínimos: `drive.readonly` + `documents.readonly`.

## Meta / Instagram

| Operação | Ferramenta | Por quê |
|---|---|---|
| Criar container de media | **Graph API** (`POST /{ig_id}/media`) | não tem MCP |
| Publicar | **Graph API** (`POST /{ig_id}/media_publish`) | |
| Polling status reels | **Graph API** (`GET /{container_id}?fields=status_code`) | |
| Renovar long-lived token | **Graph API** (`GET /oauth/access_token?grant_type=fb_exchange_token`) | cron separado |

Endpoint base: `https://graph.facebook.com/v20.0`

## Anthropic (Claude)

| Operação | Ferramenta | Por quê |
|---|---|---|
| Gerar legenda fallback | **Messages API direta** (`POST /v1/messages`) | usar prompt caching em `system[].cache_control` |

Modelo: `claude-sonnet-4-6`. Input caching no brand voice guide (~1000 tokens) gera 90% de economia.

## Scheduled task

| Opção | Como |
|---|---|
| **Claude Code scheduled-tasks** | `mcp__scheduled-tasks__create_scheduled_task` — roda dentro da sessão do Claude, logs integrados |
| **Cron macOS** | `crontab -e` — independente, mais "boring", mas logs isolados |

Default recomendado: cron local (Opção B). Mais estável, não depende do Claude Code estar rodando.

## Observabilidade

| Camada | Onde |
|---|---|
| Logs estruturados | `logs/YYYY-MM-DD.jsonl` (1 linha por evento) |
| Métricas diárias | `logs/daily-metrics.csv` |
| Lockfile anti-concorrência | `.cache/.lock` |
| Cache de mapeamento mês → ids | `.cache/meses.json` (TTL 30 dias) |
| Alerta de falha | comment automático no card + task "⚠️" na lista da Raquel |
