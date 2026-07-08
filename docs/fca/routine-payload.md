# Payload pré-pronto da routine `/schedule`

Quando o deploy estiver concluído e `FCA_API_TOKEN` configurado no servidor de prod, executar este payload via `RemoteTrigger create`.

> **Formato:** desde 08/07 o **v5 (imagem do Aprofundado + FATO/CAUSA/AÇÃO, janela 7D) é o DEFAULT** — não precisa mandar `formato:"v5"`. O payload `{"funil":"...","createTask":true}` já gera o relatório v5. (Legacy: `{"formato":"legacy"}` = markdown semanal antigo; `{"modo":"mensal"}` = tabela mensal antiga.)
>
> **Funis agendados:** Creators, CRM, Summit (canal default = `metaAds`). Uma routine dispara os 3 em sequência, cada um criando sua própria task no ClickUp.

## Configuração

- **Cron:** `0 11 * * 1` — toda segunda às 11h UTC = **8h America/Sao_Paulo**
- **Environment:** `env_016hPBfykFqNUocVcdrAgQ25` (W Pablo)
- **Repo:** `https://github.com/Warleypablo/Cortex` (não é estritamente necessário, mas dá ao agente contexto)
- **MCP connections:** nenhum (o endpoint do Cortex já cria a task ClickUp; agente só dispara via curl)
- **Tools allowed:** `Bash` (precisa só de `curl`)

## Prompt do agente

```
Você é um agente automatizado disparando os relatórios FCA semanais (formato v5).

Sua única tarefa: rodar este loop de curl exatamente como está abaixo e reportar o resultado em 3-5 linhas (uma por funil).

for FUNIL in Creators CRM Summit; do
  echo "=== $FUNIL ==="
  curl -s -X POST https://cortex.turbopartners.com.br/api/fca/run \
    -H "Authorization: Bearer $FCA_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"funil\":\"$FUNIL\",\"createTask\":true}" \
    --max-time 180
  echo
done

Esperado: para cada funil, response JSON com `ok: true`, `formato: "v5"` e `task.url` apontando pra task criada no ClickUp.

Se ALGUM funil der erro (status != 200, ou ok: false):

1. Acesse https://cortex.turbopartners.com.br/api/fca/health (sem auth) pra diagnóstico
2. Crie UMA task de alerta no ClickUp via API direta, listando os funis que falharam — assim Ichino é notificado pelo canal padrão:

curl -s -X POST https://api.clickup.com/api/v2/list/901322140780/task \
  -H "Authorization: $CLICKUP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "⚠️ FCA falhou — <funis> (semana <YYYY-Www>)",
    "description": "Routine FCA falhou em <ISO timestamp>.\n\n**Funis com erro:** <lista>\n**HTTP status:** <status>\n**Erro:** <mensagem>\n**Healthcheck:** <ok|fail>\n\nVer logs em https://claude.ai/code/routines",
    "assignees": [55120346],
    "priority": 2
  }'

3. Reporte no output do agente: por funil, o HTTP status do /api/fca/run e se criou a task; e se o alerta foi criado.

Não tente debugar nem retentar o FCA. Apenas reporte e crie o alerta.
```

## Body completo do RemoteTrigger create

```json
{
  "name": "FCA Weekly (Creators/CRM/Summit)",
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
            "content": "Você é um agente automatizado disparando os relatórios FCA semanais (formato v5).\n\nSua única tarefa: rodar este loop de curl exatamente como está abaixo e reportar o resultado em 3-5 linhas (uma por funil).\n\nfor FUNIL in Creators CRM Summit; do\n  echo \"=== $FUNIL ===\"\n  curl -s -X POST https://cortex.turbopartners.com.br/api/fca/run \\\n    -H \"Authorization: Bearer $FCA_API_TOKEN\" \\\n    -H \"Content-Type: application/json\" \\\n    -d \"{\\\"funil\\\":\\\"$FUNIL\\\",\\\"createTask\\\":true}\" \\\n    --max-time 180\n  echo\ndone\n\nEsperado: para cada funil, JSON com `ok: true`, `formato: \"v5\"` e `task.url`.\n\nSe ALGUM funil der erro (status != 200, ou ok: false):\n1. Acesse https://cortex.turbopartners.com.br/api/fca/health pra diagnóstico\n2. Crie UMA task de alerta no ClickUp via API direta (lista 901322140780, assignee 55120346) listando os funis que falharam:\n\ncurl -s -X POST https://api.clickup.com/api/v2/list/901322140780/task \\\n  -H \"Authorization: $CLICKUP_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"name\":\"⚠️ FCA falhou — <funis>\",\"description\":\"<detalhe do erro por funil>\",\"assignees\":[55120346],\"priority\":2}'\n\n3. Reporte: por funil o HTTP status e se criou a task; e se o alerta foi criado.\n\nNão tente debugar nem retentar o FCA. Apenas reporte e alerte.",
            "role": "user"
          }
        }}
      ]
    }
  }
}
```

**Atenção sobre `$FCA_API_TOKEN` e `$CLICKUP_API_KEY`:** o agente remoto NÃO tem essas variáveis de ambiente automaticamente. Duas estratégias:

1. **Hardcoded no prompt** (menos seguro): substituir `$FCA_API_TOKEN` e `$CLICKUP_API_KEY` pelos valores literais no prompt. Risco: tokens ficam visíveis em logs/histórico de routines.
2. **Via env_vars do job_config** (mais seguro, se suportado): a API do RemoteTrigger pode aceitar `env_vars` no ccr — investigar antes de criar.

Pra primeira run, vai com **hardcoded** e depois investigamos a opção 2. Tokens ficam restritos a routines visíveis só pra Ichino.

## Pra rodar (depois do deploy)

1. Carregar tool: `ToolSearch select:RemoteTrigger`
2. Substituir `$FCA_API_TOKEN` (e `$CLICKUP_API_KEY`) pelos valores reais no prompt do JSON acima
3. Chamar `RemoteTrigger action:"create" body:<JSON acima>`
4. Output retorna `trigger_id` — link da routine: `https://claude.ai/code/routines/{trigger_id}`
5. Testar imediatamente: `RemoteTrigger action:"run" trigger_id:"..."` e conferir que criou 3 tasks (Creators/CRM/Summit) na lista 901322140780

## Manutenção futura

- **Atualizar prompt:** `RemoteTrigger action:"update" trigger_id:"..." body:{...}`
- **Listar routines:** `RemoteTrigger action:"list"`
- **Rodar agora pra testar:** `RemoteTrigger action:"run" trigger_id:"..."`
- **Deletar:** não é possível via tool — usar https://claude.ai/code/routines
