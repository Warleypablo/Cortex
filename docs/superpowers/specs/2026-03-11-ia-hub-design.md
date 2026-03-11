# Hub de IAs Premium — Design Spec

## Objetivo

Substituir o GPTurbo atual (`/cases/chat`) por um hub multi-modelo que permite aos colaboradores conversar com GPT-4, Claude e Gemini pelo Cortex, com historico de conversas persistido.

## Requisitos

- 3 provedores: OpenAI (GPT-4o), Anthropic (Claude Sonnet), Google (Gemini Flash)
- Modelo trocavel a qualquer momento dentro da mesma conversa
- Historico de conversas salvo no banco com sidebar para navegar
- Cada mensagem registra qual modelo respondeu
- Chat de texto puro com markdown rendering
- Substitui GPTurbo na rota `/cases/chat`

## Arquitetura

### Database

Duas novas tabelas em `cortex_core`:

**ia_hub_conversas**
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | serial PK | ID da conversa |
| user_id | integer | ID do usuario (ref users) |
| titulo | text | Titulo da conversa (gerado automaticamente) |
| created_at | timestamp | Criacao |
| updated_at | timestamp | Ultima atualizacao |

**ia_hub_mensagens**
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | serial PK | ID da mensagem |
| conversa_id | integer FK | Ref ia_hub_conversas |
| role | text | 'user' ou 'assistant' |
| content | text | Conteudo da mensagem |
| modelo | text | Qual modelo respondeu (null para user) |
| created_at | timestamp | Criacao |

### Backend Endpoints

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | /api/ia-hub/conversas | Lista conversas do usuario |
| POST | /api/ia-hub/conversas | Cria nova conversa |
| DELETE | /api/ia-hub/conversas/:id | Deleta conversa e mensagens |
| GET | /api/ia-hub/conversas/:id/mensagens | Lista mensagens de uma conversa |
| POST | /api/ia-hub/chat | Envia mensagem, recebe resposta da IA |

**POST /api/ia-hub/chat** recebe:
```json
{
  "conversaId": 123,
  "message": "texto do usuario",
  "modelo": "gpt-4o"
}
```

O endpoint roteia para a SDK correta baseado no campo `modelo`:
- `gpt-4o` -> OpenAI SDK
- `claude-sonnet-4-5-20250514` -> Anthropic SDK
- `gemini-2.0-flash` -> Google Generative AI SDK

Salva mensagem do usuario e resposta da IA no banco. Retorna a resposta.

### Frontend

**Layout**: Sidebar esquerda + area de chat principal (mesmo padrao do Assistente Juridico).

**Sidebar**:
- Botao "Nova conversa" no topo
- Lista de conversas ordenada por updated_at desc
- Busca por titulo
- Botao de deletar conversa

**Area de chat**:
- Header com seletor de modelo (dropdown com GPT-4, Claude, Gemini)
- Area de mensagens com scroll
- Cada mensagem do assistente mostra badge com icone/nome do modelo
- Input de texto com botao de enviar na parte inferior
- Sugestoes no estado vazio

**Seletor de modelo**:
- Dropdown com 3 opcoes
- Icone/cor distinta por provedor
- Trocavel a qualquer momento

### Modelos

| Display | ID API | Provedor | SDK |
|---------|--------|----------|-----|
| GPT-4o | gpt-4o | OpenAI | openai |
| Claude Sonnet | claude-sonnet-4-5-20250514 | Anthropic | @anthropic-ai/sdk |
| Gemini Flash | gemini-2.0-flash | Google | @google/generative-ai |

### API Keys

- `OPENAI_API_KEY` — ja existe
- `ANTHROPIC_API_KEY` — adicionar ao .env
- `GOOGLE_GEMINI_API_KEY` — adicionar ao .env

### Permissoes

Reutiliza a permissao existente `general.gpturbo`. Sem alteracoes no sistema de permissoes.

## Fora de Escopo

- Upload de arquivos/imagens
- Streaming de respostas (pode ser adicionado depois)
- System prompts customizados por usuario
- Integracao com dados do Cortex (GPTurbo atual tem isso, mas o hub e generico)
