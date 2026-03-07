# Design: Assistente Jurídico com Function Calling

**Data:** 2026-03-07
**Status:** Aprovado

## Contexto

Criar um chat assistente jurídico dentro do módulo Jurídico do Cortex, alimentado por markdowns de conhecimento (skills) e com acesso a dados reais do banco via function calling da OpenAI.

## Decisões

- **Provedor AI:** OpenAI (já configurado no projeto como GPTurbo)
- **UI:** Página dedicada em `/juridico/assistente`
- **Domínios:** Cobrança/inadimplência, contratos empresariais, trabalhista
- **Dados:** Conhecimento (markdowns) + consulta ao banco via function calling
- **Histórico:** Persistido no PostgreSQL
- **Abordagem:** Function Calling nativo da OpenAI (Abordagem A)

## Arquitetura

```
Frontend: /juridico/assistente
  └─ Chat UI (mensagens + input + sidebar de conversas)
       │
       │ POST /api/juridico/assistente/chat
       ▼
Backend: server/routes/juridico-assistente.ts
  1. Carrega markdowns de agents/legal-*.md
  2. Monta system prompt com conhecimento jurídico
  3. Chama OpenAI com function calling
  4. Executa functions (queries no banco)
  5. Loop até resposta final
  6. Persiste mensagens no banco
```

## Markdowns de Conhecimento

Três arquivos em `agents/`:

| Arquivo | Conteúdo |
|---------|----------|
| `agents/legal-cobranca.md` | Procedimentos de cobrança, notificação extrajudicial, protesto, execução, prazos, acordo, regras de escalonamento |
| `agents/legal-contratos.md` | Análise de cláusulas, tipos de contrato (SaaS, serviço, parceria), rescisão, renovação, SLA, multas |
| `agents/legal-trabalhista.md` | CLT vs PJ, obrigações contratuais, rescisão, aviso prévio, FGTS, férias, documentação |

## Functions (Tools)

| Function | Descrição | Parâmetros |
|----------|-----------|------------|
| `buscar_clientes_inadimplentes` | Lista clientes com atraso | `dias_atraso_min`, `dias_atraso_max`, `status_juridico` |
| `buscar_processos` | Consulta processos judiciais | `status`, `cliente`, `tipo_acao` |
| `buscar_contratos` | Consulta contratos ativos | `cliente`, `status`, `tipo` |
| `buscar_contratos_colaboradores` | Consulta contratos de colaboradores | `status`, `colaborador` |
| `buscar_regras_escalonamento` | Retorna regras de escalonamento por dias de atraso | `dias_atraso` |
| `buscar_parcelas_cliente` | Consulta faturas/parcelas de um cliente | `cnpj`, `status` |

## Tabelas no Banco

```sql
-- cortex_core.juridico_chat_conversas
id SERIAL PRIMARY KEY
usuario_id INTEGER NOT NULL
titulo VARCHAR(200)
criado_em TIMESTAMP DEFAULT NOW()
atualizado_em TIMESTAMP DEFAULT NOW()

-- cortex_core.juridico_chat_mensagens
id SERIAL PRIMARY KEY
conversa_id INTEGER REFERENCES juridico_chat_conversas(id)
role VARCHAR(20) NOT NULL          -- 'user' | 'assistant' | 'system'
conteudo TEXT NOT NULL
criado_em TIMESTAMP DEFAULT NOW()
```

## Endpoints da API

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/juridico/assistente/conversas` | Lista conversas do usuário |
| `POST` | `/api/juridico/assistente/conversas` | Cria nova conversa |
| `GET` | `/api/juridico/assistente/conversas/:id/mensagens` | Mensagens de uma conversa |
| `POST` | `/api/juridico/assistente/chat` | Envia mensagem e recebe resposta (streaming) |
| `DELETE` | `/api/juridico/assistente/conversas/:id` | Apaga conversa |

## UI - Página /juridico/assistente

Layout em duas colunas:
- **Sidebar esquerda:** lista de conversas anteriores + botão "Nova conversa"
- **Área principal:** chat com mensagens + input na parte inferior
- **Sugestões rápidas** na tela inicial (sem conversa ativa):
  - "Quais clientes estão inadimplentes há mais de 90 dias?"
  - "Resuma os processos judiciais ativos"
  - "Quais contratos vencem nos próximos 30 dias?"

Dark/light mode com `dark:` variants.

## Permissões

Nova permission key: `JUR.ASSISTENTE` no nav-config, restrito a perfis Líder e Control Tower.

## Stack

- **Frontend:** React + Tailwind + componentes UI existentes (ScrollArea, Input, Button, Card)
- **Backend:** Express + Drizzle ORM + OpenAI SDK (já configurado)
- **Banco:** PostgreSQL (Google Cloud SQL) - schema cortex_core
