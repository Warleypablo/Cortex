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

Se der erro (status != 200, ou ok: false), reporte:
- O HTTP status
- A mensagem de erro
- Se conseguir acessar /api/fca/health (sem auth) pra diagnóstico

Não tente debugar nem retentar. Apenas reporte.
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
            "content": "Você é um agente automatizado disparando o relatório FCA semanal do funil Creators.\n\nSua única tarefa: rodar este curl exatamente como está abaixo e reportar o resultado em 2-3 linhas.\n\ncurl -s -X POST https://cortex.turbopartners.com.br/api/fca/run \\\n  -H \"Authorization: Bearer $FCA_API_TOKEN\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"funil\":\"Creators\",\"createTask\":true}' \\\n  --max-time 180\n\nEsperado: response JSON com `ok: true` e `task.url` apontando pra task criada no ClickUp.\n\nSe der erro (status != 200, ou ok: false), reporte:\n- O HTTP status\n- A mensagem de erro\n- Se conseguir acessar /api/fca/health (sem auth) pra diagnóstico\n\nNão tente debugar nem retentar. Apenas reporte.",
            "role": "user"
          }
        }}
      ]
    }
  }
}
```

**Atenção sobre `$FCA_API_TOKEN`:** o agente remoto NÃO tem essa variável de ambiente automaticamente. Vamos precisar de uma de duas estratégias:

1. **Hardcoded no prompt** (menos seguro): substituir `$FCA_API_TOKEN` pelo valor literal no prompt. Risco: token fica visível em logs/histórico de routines.

2. **Via env_vars do job_config** (mais seguro, se suportado): a API do RemoteTrigger pode aceitar `env_vars` no ccr — investigar antes de criar.

Pra primeira run, vai com **hardcoded** e depois investigamos a opção 2. Token tem 64 chars hex, baixíssimo risco se ficar restrito a routines visíveis só pra Ichino.

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
