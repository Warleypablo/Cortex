# Runbook — operação do agente

## Como rodar

### Manual (debug)
```bash
cd "/Users/raquelsoaressantos/Desktop/Automação n8n"
DRY_RUN=1 python3 agente/main.py
```

### Scheduled (polling a cada 5 min)
Duas opções:

**Opção A — scheduled task dentro do Claude Code** (recomendado, mais observável):
Dentro do Claude Code, rodar a skill `scheduled-tasks` (criar task a cada 5 min apontando pra `agente/main.py`). Vantagem: logs ficam junto com as conversas, fácil de investigar.

**Opção B — cron local no macOS**:
```bash
crontab -e
# adicionar:
*/5 * * * * cd "/Users/raquelsoaressantos/Desktop/Automação n8n" && DRY_RUN=0 python3 agente/main.py >> logs/agente.log 2>&1
```

## Modos de operação

| `DRY_RUN` | Lê ClickUp/Drive/Docs | Publica IG | Escreve ClickUp |
|---|---|---|---|
| `1` (default) | ✅ | ❌ | ❌ |
| `0` (produção) | ✅ | ✅ | ✅ |

## Slots de publicação

Hoje (modo fixo): **12h e 18h**, com 1h de tolerância. Janelas ativas: 12:00–12:59 e 18:00–18:59. Fora dessas janelas o agente não publica.

Se o agente cair / cron parar / Mac dormir e ele só voltar **depois** da janela do slot (ex: rodou 13:30, mas o slot 12h fechou 12:59), ele NÃO publica atrasado — protege contra postar fora do timing editorial. Hipótese de futuro hardening (Bloco J): comentar na task "agendada pra 12h, slot expirou, precisa repostagem manual ou reagendamento".

Quando equipe criar campo `Horário de Postagem` e preencher por task → cada task tem horário próprio + tolerância de 1h, e os slots fixos 12h/18h viram apenas fallback.

## Debug

### Ver o que aconteceu num ciclo
```bash
tail -f logs/$(date +%Y-%m-%d).jsonl
```

Cada linha é um evento JSON:
```json
{"ts": "2026-04-21T14:32:00Z", "event": "task_seen", "task_id": "86agwwzmz", "name": "Não basta empreender", "status": "aprovado"}
{"ts": "2026-04-21T14:32:01Z", "event": "doc_match", "task_id": "86agwwzmz", "section": "NÃO BASTA EMPREENDER", "legenda_len": 432}
{"ts": "2026-04-21T14:32:02Z", "event": "drive_match", "folder": "TURBO_naobastaempreender", "files": 6, "type": "carousel"}
{"ts": "2026-04-21T14:32:03Z", "event": "dry_run_skip_publish", "plan": {...}}
```

### Rodar só uma task específica
```bash
DRY_RUN=1 python3 agente/main.py --task-id 86agwwzmz
```

### Forçar reprocessamento (ignora idempotência)
```bash
DRY_RUN=1 python3 agente/main.py --task-id 86agwwzmz --force
```

## Falhas comuns e o que fazer

| Sintoma | Diagnóstico | Ação |
|---|---|---|
| `no doc match for task 'X'` | Header da seção no Doc não bate com task.name | 1) Checa se Esther escreveu o título igual. 2) Se título do Doc é abreviação (`JUSTIN KARAOKE` vs task `Justin bieber`), adicionar alias em `agente/aliases.json`. |
| `TURBO_xpto detected` | Editor esqueceu de renomear ID na descrição | Agente já avisa via comment automaticamente. Só esperar humano corrigir. |
| `doc section has empty LEGENDA` | Copy ainda não escrita | Agente aciona Claude fallback. Se não quer publicar, comenta "cancelar". |
| `meta rate limit (25/day)` | Publicou 25x hoje | Espera 00h UTC. Agente já pula ao atingir. |
| `drive file not public` | Share link expirou/foi removido | Verificar permissão da pasta no Drive (`Anyone with link`). |
| `long-lived token expired` | Token Meta passou de 60 dias | Renovar em developers.facebook.com. Cron separado deveria ter avisado. |

## Recuperação de erros

### "Publiquei errado, preciso desfazer"
1. Deletar o post no Instagram (manual, pelo app).
2. No ClickUp, reverter status: `postado → aprovado`.
3. Remover o comentário `[auto-posted...]` da task.
4. Próximo ciclo vai reprocessar.

### "Agente crashou e não sei onde parou"
1. `tail -100 logs/$(date +%Y-%m-%d).jsonl` — acha o último evento
2. Lockfile em `.cache/.lock` → remover se estiver presa: `rm .cache/.lock`
3. Roda `DRY_RUN=1 python3 agente/main.py` pra ver onde falha.

## Monitoramento

Métricas básicas por dia em `logs/daily-metrics.csv`:
```
date,approved_seen,doc_matched,ai_fallback,published,errors
2026-04-21,4,3,1,0,0    ← dry run
2026-04-28,5,4,1,5,0    ← produção, 100% sucesso
```

Se `errors > 0` por 2 dias seguidos, agente cria task no ClickUp: `⚠️ Automação IG com falhas recorrentes` (atribui pra Raquel).
