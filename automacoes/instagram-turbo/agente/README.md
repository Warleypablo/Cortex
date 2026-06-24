# Agente de publicação Instagram

Runtime Python simples que roda a cada 5-10 min (scheduled task ou cron) e:

1. Lê tasks `aprovado` na lista Instagram 📷 do ClickUp (list_id `901300920768`)
2. Resolve o mês pelo nome da task pai (ex: `Social Media - ABRIL` → `04 - Abril`)
3. Puxa a legenda do Doc mestre `SOCIAL MEDIA TURBO [MÊS]` (seção cujo header UPPER = `task.name.upper()`)
4. Puxa os assets da subpasta `TURBO_<slug>/` dentro da pasta do mês no Drive
5. Publica no Instagram via Meta Graph API (single/reels/carrossel conforme conteúdo da pasta)
6. Atualiza status pra `postado` no ClickUp e comenta a URL do post

Se o Doc tiver seção vazia, o Claude gera legenda e pede aprovação via comment no ClickUp.

## Estrutura

```
agente/
├── README.md              ← este doc
├── runbook.md             ← como rodar, debugar, lidar com falhas
├── ferramentas.md         ← mapa: MCPs vs APIs diretas usadas
├── brand_voice.md         ← guia de tom pra Claude (pendente, ver PLANO §10)
├── main.py                ← entry point
├── config.py              ← carrega .env
├── clickup.py             ← read/write ClickUp
├── drive.py               ← Google Drive (OAuth)
├── docs_parser.py         ← parser do Doc mestre
├── instagram.py           ← Meta Graph publish
├── caption_ai.py          ← Claude fallback
├── idempotency.py         ← comment markers + lockfile
└── tests/
    ├── test_docs_parser.py
    ├── test_idempotency.py
    └── fixtures/
        └── doc_abril.txt   ← snapshot do Doc de abril pra testes offline
```

## Status

- **Bloco A (validação)**: ✅ completo
- **Bloco B (credenciais externas)**: ⏳ aguardando inputs (ver `PLANO.md` §10)
- **Bloco C (agente base dry-run)**: 🔜 próximo — só precisa `CLICKUP_API_TOKEN` (já temos) e MCP Drive
- **Blocos D-J**: sequencial depois de C

## Segurança

- **Nunca** escreve no ClickUp em modo `DRY_RUN=1`.
- **Sempre** confirma idempotência via comment marker antes de qualquer ação irreversível.
- **Respeita** o workspace compartilhado: não cria custom fields, listas, statuses ou webhooks sem confirmação humana.
- **Não posta no Slack** — aprovação e alertas via comment no card.
