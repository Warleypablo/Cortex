# Payload pré-pronto da routine `/schedule`

Quando deploy estiver concluído e `FCA_API_TOKEN` configurado no servidor de prod, executar este payload via `RemoteTrigger create`.

## Configuração

- **Cron:** `0 11 * * 1` — toda segunda às 11h UTC = **8h America/Sao_Paulo**
- **Environment:** `env_016hPBfykFqNUocVcdrAgQ25` (W Pablo)
- **Repo:** `https://github.com/Warleypablo/Cortex` (não é estritamente necessário, mas dá ao agente contexto)
- **MCP connections:** nenhum (o endpoint do Cortex já cria a task ClickUp; agente só dispara via curl)
- **Tools allowed:** `Bash` (precisa só de `curl`)

## Prompt do agente

```
Você é um agente automatizado disparando o relatório FCA semanal do funil Creators.

Sua única tarefa: rodar este curl exatamente como está abaixo e reportar o resultado em 2-3 linhas.

curl -s -X POST https://cortex.turbopartners.com.br/api/fca/run \
  -H "Authorization: Bearer $FCA_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"funil":"Creators","createTask":true}' \
  --max-time 180

Esperado: response JSON com `ok: true` e `task.url` apontando pra task criada no ClickUp.

Se der erro (status != 200, ou ok: false):

1. Acesse https://cortex.turbopartners.com.br/api/fca/health (sem auth) pra diagnóstico
2. Crie uma task de alerta no ClickUp via API direta — assim Ichino é notificado pelo canal padrão:

curl -s -X POST https://api.clickup.com/api/v2/list/901322140780/task \
  -H "Authorization: $CLICKUP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "⚠️ FCA falhou — Creators (semana <YYYY-Www>)",
    "description": "Routine FCA Creators falhou em <ISO timestamp>.\n\n**HTTP status:** <status>\n**Erro:** <mensagem>\n**Healthcheck:** <ok|fail>\n\nVer logs em https://claude.ai/code/routines",
    "assignees": [55120346],
    "priority": 2
  }'

3. Reporte no output do agente: HTTP status do /api/fca/run, erro, e se a task de alerta foi criada.

Não tente debugar nem retentar o FCA. Apenas reporte e crie o alerta.
```

## Body completo do RemoteTrigger create

```json
{
  "name": "FCA Creators Weekly",
  "cron_expression": "0 11 * * 1",
  "enabled": true,
  "job_config": {
    "ccr": {
      "environment_id": "env_016hPBfykFqNUocVcdrAgQ25",
      "session_context": {
        "model": "claude-sonnet-4-6",
        "sources": [
          {"git_repository": {"url": "https://github.com/Warleypablo/Cortex"}}
        ],
        "allowed_tools": ["Bash", "Read"]
      },
      "events": [
        {"data": {
          "uuid": "8f57d0a1-dd08-4e32-b145-534532507a92",
          "session_id": "",
          "type": "user",
          "parent_tool_use_id": null,
          "message": {
            "content": "Você é um agente automatizado disparando o relatório FCA semanal do funil Creators.\n\nSua única tarefa: rodar este curl exatamente como está abaixo e reportar o resultado em 2-3 linhas.\n\ncurl -s -X POST https://cortex.turbopartners.com.br/api/fca/run \\\n  -H \"Authorization: Bearer $FCA_API_TOKEN\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"funil\":\"Creators\",\"createTask\":true}' \\\n  --max-time 180\n\nEsperado: response JSON com `ok: true` e `task.url` apontando pra task criada no ClickUp.\n\nSe der erro (status != 200, ou ok: false):\n1. Acesse https://cortex.turbopartners.com.br/api/fca/health pra diagnóstico\n2. Crie uma task de alerta no ClickUp via API direta (lista 901322140780, assignee 55120346):\n\ncurl -s -X POST https://api.clickup.com/api/v2/list/901322140780/task \\\n  -H \"Authorization: $CLICKUP_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"name\":\"⚠️ FCA falhou — Creators\",\"description\":\"<detalhe do erro>\",\"assignees\":[55120346],\"priority\":2}'\n\n3. Reporte: HTTP status, erro, e se a task de alerta foi criada.\n\nNão tente debugar nem retentar. Apenas reporte e alerte.",
            "role": "user"
          }
        }}
      ]
    }
  }
}
```

**Atenção sobre `$FCA_API_TOKEN` e `$CLICKUP_API_KEY`:** o agente remoto NÃO tem essas variáveis de ambiente automaticamente. Vamos precisar de uma de duas estratégias:

1. **Hardcoded no prompt** (menos seguro): substituir `$FCA_API_TOKEN` e `$CLICKUP_API_KEY` pelos valores literais no prompt. Risco: tokens ficam visíveis em logs/histórico de routines.

2. **Via env_vars do job_config** (mais seguro, se suportado): a API do RemoteTrigger pode aceitar `env_vars` no ccr — investigar antes de criar.

Pra primeira run, vai com **hardcoded** e depois investigamos a opção 2. Tokens ficam restritos a routines visíveis só pra Ichino.

## Pra rodar (depois do deploy)

1. Carregar tool: `ToolSearch select:RemoteTrigger`
2. Substituir `$FCA_API_TOKEN` pelo valor real no prompt do JSON acima
3. Chamar `RemoteTrigger action:"create" body:<JSON acima>`
4. Output retorna `trigger_id` — link da routine: `https://claude.ai/code/routines/{trigger_id}`

## Manutenção futura

- **Atualizar prompt:** `RemoteTrigger action:"update" trigger_id:"..." body:{...}`
- **Listar routines:** `RemoteTrigger action:"list"`
- **Rodar agora pra testar:** `RemoteTrigger action:"run" trigger_id:"..."`
- **Deletar:** não é possível via tool — usar https://claude.ai/code/routines
