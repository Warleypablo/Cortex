# ClickUp — Setup da Lista "Instagram 📷"

Caminho real: **GROWTH → GROWTH → Instagram 📷**
- Workspace ID: `31021986`
- Space ID: `901312907585`
- Folder ID: `90133026279`
- List ID: `901300920768`

Cada post é uma **subtask de "Social Media - <MÊS>"** dentro dessa lista.

---

## 1. Custom fields — NÃO criar novos agora

Os dados do post vivem na **descrição** da tarefa pai em texto livre (template abaixo), não em custom fields.

Custom fields que já existem na lista (não mexer): `Data de Postagem`, `Formato do post`, `CTA do post`, `Expert`, `Intenção`, `Aprovação rápida?`, `Área`, `Tipo Task`, `Tipo de task`, `Prioridade`.

> **Regra do workspace:** antes de criar, editar ou excluir QUALQUER custom field ou status, pedir permissão à usuária. O workspace é compartilhado da TurboPartners.

**Campos úteis que poderíamos adicionar** (só com autorização):
- `URL do post publicado` (URL) — o n8n preenche após o publish
- `Log Automação` (long text) — debug de erros
- `Copy gerada por IA` (checkbox) — marca quando Claude gerou a legenda

---

## 2. Template da descrição (já em uso pelo time)

```
Criativo: <nome>
Formato: <4x5 | 1x1 | 9x16 | etc.>
Ativos:
Copy: <URL do Google Docs>
Referência: <link ou vazio>
ID (Suba no Drive com este nome): TURBO_<slug>
Quando finalizar, colocar nessa pasta: <URL da pasta do Google Drive>
```

O workflow do n8n parseia esse bloco com regex. Se o template mudar, atualizar o node `Parser da Descrição`.

---

## 3. Statuses da tarefa pai (já configurados — não mexer)

```
PENDENTE → COPY PRONTA → GRAVAÇÃO AGENDADA → GRAVADO →
EM EDIÇÃO/DESIGN → REVIEW → APROVADO → POSTADO → CONCLUÍDO
                              ▲
                              └── GATILHO da automação
```

Também existe `PAUSADO` em paralelo.

A **subtask obrigatória `copy`** tem statuses próprios (inclui `aprovado`). O workflow checa o status dela na hora do gatilho:
- **`aprovado`** → lê o Google Docs da descrição (copy pronta)
- **qualquer outro** → Claude gera a legenda a partir do contexto (criativo, referência, brand voice)

---

## 4. Webhook ClickUp → n8n

Criar via API (depois do n8n no ar):

```bash
curl -X POST https://api.clickup.com/api/v2/team/31021986/webhook \
  -H "Authorization: $CLICKUP_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "https://<seu-n8n>.app.n8n.cloud/webhook/clickup-publish",
    "events": ["taskStatusUpdated"],
    "list_id": "901300920768"
  }'
```

No n8n, o primeiro IF filtra:
```
$json.body.history_items[0].after.status === "aprovado"
&& $json.body.list_id === "901300920768"
```

---

## 5. IDs úteis (já descobertos)

| Chave | Valor |
|---|---|
| `CLICKUP_WORKSPACE_ID` | `31021986` |
| `CLICKUP_SPACE_ID_GROWTH` | `901312907585` |
| `CLICKUP_FOLDER_ID_GROWTH` | `90133026279` |
| `CLICKUP_LIST_ID_INSTAGRAM` | `901300920768` |

Checagem rápida de acesso:
```bash
curl -H "Authorization: $CLICKUP_API_TOKEN" \
  https://api.clickup.com/api/v2/list/901300920768
```
