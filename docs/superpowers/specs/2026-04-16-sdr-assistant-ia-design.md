# SDR Assistant — IA para Confirmação Automática de Leads (V1)

**Data:** 2026-04-16
**Autor:** Warleypablo + Claude
**Status:** Design aprovado — aguarda implementação

---

## 1. Contexto e problema

O time de SDR da Turbo Partners gasta tempo significativo verificando manualmente se uma empresa já foi prospectada, está em negociação ativa, ou foi descartada no passado. Essa checagem hoje envolve:

- Abrir o Bitrix, buscar pelo nome da empresa, conferir funil e responsável
- Em alguns casos, perguntar em grupos de Slack/WhatsApp
- Risco de abordagem duplicada (dois SDRs trabalhando o mesmo lead) ou indevida (cliente ativo)

O objetivo deste projeto é entregar uma **IA de consulta rápida dentro do Cortex** que o SDR usa antes de abordar um lead, retornando histórico e status da empresa no Bitrix em segundos.

## 2. Objetivos

- Reduzir o tempo médio de qualificação inicial de um lead
- Eliminar abordagens duplicadas (mesmo lead trabalhado por dois SDRs)
- Eliminar abordagens indevidas (cliente ativo sendo prospectado)
- Servir de base para expansões futuras (Instagram, ClickUp, HubSpot)

### Métricas de sucesso (a medir após 30 dias de produção)

- **Adoção:** ≥ 70% dos SDRs consultam o assistente pelo menos 5× por semana
- **Volume:** média ≥ 10 consultas/SDR ativo/dia
- **Custo LLM:** ≤ US$ 100/mês (guardrail)
- **Satisfação:** survey qualitativo pós-30d (escala 1-5, alvo ≥ 4)

## 3. Escopo V1

### Em escopo

- Nova página `/sdr-assistant` no Cortex (chat)
- Input: **nome da empresa** (texto livre)
- Integração: **somente Bitrix** (schema `"Bitrix"` no PostgreSQL GCP)
- Backend LLM com **tool-use** via Anthropic SDK (Claude Sonnet 4.6)
- Duas tools: `search_companies` e `get_company_timeline`
- Timeline completa de todos os deals da empresa em ordem cronológica
- Disambiguação interativa quando há múltiplos matches
- Classificação automática de status (`ativo` / `ganho` / `perdido`)
- Log de uso em `cortex_core.sdr_assistant_usage`
- Dark/light mode (padrão Cortex)
- Auth: qualquer **colaborador interno** logado (reusa `isAuthenticated` + filtro por tipo de usuário — clientes externos do portal são bloqueados)

### Fora de escopo

- **Input por Instagram** — preparar a interface para receber, mas ativar só quando `crm_deal` tiver o campo populado (V2)
- **Motivo de perda** — código prevê a coluna `crm_deal.motivo_perda`, mas renderiza "motivo não registrado" até a coluna existir (V2)
- **ClickUp** — flag "já é cliente" cruzando `cup_clientes` e `cup_churn` (V2)
- **HubSpot** — depende de decisão sobre plano pago (V3)
- **Persistir histórico de conversas** por SDR (V3)
- **Streaming token-a-token** (SSE) — V3
- **Follow-ups conversacionais avançados** ("quais leads do Kaike em Proposta enviada?") — V3
- **Multi-idioma** — só português

## 4. Arquitetura

```
Frontend (React)                    Backend (Express)              Dados
─────────────────                   ──────────────────             ──────
client/src/pages/                   server/routes/                 Postgres GCP
  SdrAssistant.tsx  ──POST /api──►  sdr-assistant.ts   ──SQL──►   "Bitrix".crm_deal
  (chat UI)                          │                            "Bitrix".crm_closers
                                     │                            "Bitrix".crm_users
                                     ▼
                               Anthropic SDK (Claude Sonnet 4.6)
                               com tool-use + prompt caching
```

### Decisões chave

- **LLM:** Claude Sonnet 4.6 (já temos `@anthropic-ai/sdk` v0.78.0 em uso). GPT-4o fica como fallback via ENV.
- **Padrão tool-use:** replica o que já existe em `server/routes/growth-ai.ts`.
- **Stateless:** cada request envia o histórico da conversa no body. Simplifica e evita sessões no servidor.
- **Sem persistência de conversa em V1:** reset ao fechar a aba.
- **Prompt caching obrigatório:** system prompt + definição das tools viram `cache_control`; cada pergunta do SDR só paga tokens da mensagem nova.

### Endpoints

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/sdr-assistant/chat` | Recebe `{ messages: [...], userId }`, retorna `{ response, tool_calls, usage }` |

Middleware: `isAuthenticated` (já existe em `routes.ts:721`) + guard adicional que valida `req.user.tipo` / role para garantir que é colaborador interno (não cliente externo do portal). Se a flag ainda não existir no schema de usuários, adicioná-la antes da implementação.

## 5. Tools do LLM

### 5.1. `search_companies(query: string)`

Busca empresas no Bitrix por nome (fuzzy).

```sql
SELECT DISTINCT
  d.company_name,
  COUNT(*) AS deal_count,
  MAX(d.id) AS last_deal_id,
  MAX(d.stage_name) AS last_stage
FROM "Bitrix".crm_deal d
WHERE d.company_name ILIKE '%' || $1 || '%'
   OR d.title       ILIKE '%' || $1 || '%'
GROUP BY d.company_name
ORDER BY deal_count DESC, last_deal_id DESC
LIMIT 10;
```

**Comportamento do LLM baseado no resultado:**

- `0` → responde "Empresa nova — sem histórico no Bitrix." Sugere prosseguir.
- `1` → chama `get_company_timeline` automaticamente com o `company_name` encontrado.
- `>1` → lista até 5 opções com SDR e stage, pede disambiguação por número ou nome completo.

**Validação de input:**

- `query` precisa ter ≥ 3 caracteres (IA pede reformulação se menor).

### 5.2. `get_company_timeline(company_name: string)`

Retorna todos os deals da empresa com contexto completo.

```sql
SELECT
  d.id, d.title, d.stage_name, d.category_name, d.source,
  d.valor_recorrente, d.valor_pontual,
  d.data_criacao, d.data_fechamento,
  d.comments,
  NULL AS motivo_perda,           -- V2: d.motivo_perda
  u.nome  AS responsavel_nome,
  c.nome  AS closer_nome
FROM "Bitrix".crm_deal d
LEFT JOIN "Bitrix".crm_users    u ON d.assigned_by_id = u.id
LEFT JOIN "Bitrix".crm_closers  c ON d.closer_id      = c.id
WHERE d.company_name = $1
ORDER BY d.data_criacao DESC;
```

**Retorno estruturado por deal:**

```json
{
  "id": 12345,
  "title": "Padaria Delícia - Tráfego",
  "stage": "Proposta enviada",
  "categoria": "Comercial",
  "sdr": "Laura Silva",
  "closer": "João Pedro",
  "criado_em": "2026-04-01",
  "valor_mrr": 3500,
  "status": "ativo",
  "motivo_perda": null
}
```

### Regra de classificação de status

- `stage_name` contém "Perdido" / "LOSE" → `"perdido"`
- `stage_name` contém "Ganho" / "WON" → `"ganho"`
- caso contrário → `"ativo"`

### Nomes de colunas — validação obrigatória na implementação

Antes de escrever as tools, **a primeira task do plano** é rodar `\d "Bitrix".crm_deal` e confirmar os nomes exatos de:

- `assigned_by_id` / `closer_id` (ou variantes como `responsavel_id`, `assigned_by`)
- `data_criacao` / `data_fechamento` (ou `date_create`, `date_modify`)
- `comments`
- `company_name` (ou `company`, `title` como fallback)

Se algum nome divergir, ajustar as queries SQL no momento da implementação sem mudar o desenho macro.

## 6. Fluxo de conversa e prompt

### 6.1. System prompt (esqueleto)

```
Você é o SDR Assistant da Turbo Partners. Ajuda o time comercial a checar
histórico de empresas no CRM Bitrix antes de abordar.

REGRAS:
1. SDR envia nome da empresa (futuro: @instagram). Você busca no Bitrix.
2. Se múltiplos matches, peça disambiguação (liste até 5 com SDR + stage).
3. Se 1 match, apresente timeline completa: todos os deals em ordem cronológica
   decrescente. Para cada deal: SDR responsável, stage atual, valor MRR (se
   houver), data. Destaque o deal ATIVO no topo.
4. Se 0 matches, diga "Empresa nova — sem histórico no Bitrix." e sugira que
   o SDR prossiga.
5. Para descartes, informe o motivo SE o campo motivo_perda estiver preenchido.
   Caso contrário, diga "motivo não registrado".
6. Tom: direto, sem floreio. SDR tem pressa. Use bullets.
7. Nunca invente dados. Se a tool não retornou, diga que não tem.

FORMATO PADRÃO da resposta quando há histórico:

🟢 ATIVO — <SDR> | <stage> | criado em <data>
   <detalhes relevantes: valor, origem, último comentário resumido>

📜 HISTÓRICO (N deals anteriores):
   • <data> — <SDR> | <stage_final> | <motivo se descarte>
   • ...
```

### 6.2. Cenário A — Match único

```
SDR:  olha a Padaria Delícia pra mim
IA:   [chama search_companies("Padaria Delícia") → 1 match]
      [chama get_company_timeline("Padaria Delícia")]

      🟢 ATIVO — Laura Silva | Proposta enviada | criado 2026-04-01
         MRR previsto: R$ 3.500 | Origem: Instagram Ads

      📜 HISTÓRICO (2 deals anteriores):
         • 2024-08-15 — Kaike Souza | Negócio Perdido | motivo: já possui agência
         • 2023-11-02 — Guilherme Dias | Negócio Perdido | motivo não registrado
```

### 6.3. Cenário B — Múltiplos matches

```
SDR:  Marketing Digital
IA:   [search_companies → 8 matches]

      Encontrei 8 empresas com esse termo. Qual delas?
      1. MD Soluções Marketing Digital — Kaike | Proposta
      2. Marketing Digital XP          — Laura | Negócio Ganho (cliente)
      3. Agência Marketing Digital MG  — Guilherme | Negócio Perdido
      4. Elite Marketing Digital       — (sem SDR) | Novo lead
      5. Marketing Digital ABC         — Kaike | Contactado
      (mais 3 com menos atividade — digita o número ou o nome completo)

SDR:  2
IA:   [get_company_timeline("Marketing Digital XP") → resposta completa]
```

### 6.4. Tratamento de erro

- **Tool timeout / erro DB:** "Bitrix indisponível agora, tenta de novo em 30s."
- **Input vazio ou com < 3 caracteres:** "Me passa o nome da empresa (pelo menos 3 letras)."
- **Limite de turns:** 10 por sessão. Depois, SDR clica em "+ Nova conversa".

## 7. UI

### 7.1. Localização

- Rota: `/sdr-assistant`
- Link no menu lateral, seção "Comercial", ícone lucide `MessagesSquare`
- Acesso: qualquer usuário logado

### 7.2. Layout

```
┌─────────────────────────────────────────────────────────┐
│ 🤖 SDR Assistant                    [ + Nova conversa ] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [mensagem IA com markdown/bullets]                     │
│  [mensagem SDR, alinhada à direita]                     │
│  [...]                                                  │
│                                                         │
│  [skeleton "consultando Bitrix..." durante tool call]   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ [ Nome da empresa ou @instagram...              ] [↗]   │
└─────────────────────────────────────────────────────────┘
```

### 7.3. Estilo

- Tailwind + Inter (herda do Cortex)
- Bubble IA: `bg-zinc-100 dark:bg-zinc-800`
- Bubble SDR: `bg-blue-600 text-white`, alinhado à direita
- Markdown renderizado via `react-markdown` (classes `prose prose-sm dark:prose-invert`)
- Status "Consultando Bitrix..." reusa padrão do `growth-ai.ts`

### 7.4. Componentes

| Componente | Arquivo | Responsabilidade |
|---|---|---|
| `SdrAssistant` | `client/src/pages/SdrAssistant.tsx` | Página top-level, estado da conversa |
| `ChatMessages` | inline | Lista de mensagens com markdown |
| `ChatInput` | inline | Textarea + Enter para enviar, Shift+Enter nova linha |
| `ToolActivity` | inline | Indicador "Consultando Bitrix..." |

### 7.5. Interações

- Enter → envia; Shift+Enter → quebra linha
- "+ Nova conversa" → limpa estado local
- Auto-scroll ao fim quando nova mensagem chega
- Auto-focus no input ao carregar a página

## 8. Observabilidade

### 8.1. Logs no backend

Cada chamada registra:

- `user_id`
- `query` (mensagem original do SDR)
- `tool_name(s) chamada(s)`
- `tokens_in`, `tokens_out`
- `duration_ms`
- `status` (`ok` / `error`)

Não registrar conteúdo completo da resposta (LGPD + ruído). Erros 5xx com stack trace completo.

### 8.2. Tabela de uso

```sql
CREATE TABLE cortex_core.sdr_assistant_usage (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER,
  query           TEXT,
  matched_company TEXT,
  tool_calls      INTEGER,
  tokens_total    INTEGER,
  duration_ms     INTEGER,
  created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_sdr_usage_user_date ON cortex_core.sdr_assistant_usage (user_id, created_at DESC);
```

Migration aplicada em **prod e dev** (conforme regra em `feedback_db_prod_sync.md`).

### 8.3. Alertas

- Se erro rate > 10% em 1h → notificação (padrão do Cortex se existir, senão só log).

### 8.4. Custo LLM estimado

- Claude Sonnet 4.6 + prompt caching: ~US$ 0,005/consulta
- 10 SDRs × 50 consultas/dia × 22 dias úteis = 11.000 consultas/mês → **~US$ 55/mês**

## 9. Testes

### 9.1. Unitários (Vitest)

- `search_companies` — 0, 1, >1 matches, input vazio, query com < 3 chars
- `get_company_timeline` — empresa com: só ativo; só perdido; mix; sem deals
- Classificação de status a partir de `stage_name`
- Sanitização básica contra SQL injection (queries parametrizadas — garantir que `$1` é usado)

### 9.2. Integração (banco dev)

- `POST /api/sdr-assistant/chat` — envia prompt, verifica que chama tools certas
- Mock do Anthropic SDK com tool-use previsível
- Fluxo completo: search → disambiguation → timeline

### 9.3. QA manual (checklist pré-merge)

- [ ] Empresa nova (sem match)
- [ ] Empresa com 1 deal ativo
- [ ] Empresa com 1 deal descartado + motivo
- [ ] Empresa com 1 deal descartado SEM motivo
- [ ] Empresa com múltiplos deals (mix ativo + descartado + ganho)
- [ ] Disambiguação com >5 matches
- [ ] Dark mode + light mode
- [ ] Tablet (≥ 768px)
- [ ] Erro de Bitrix/DB — mensagem amigável, sem stack trace

## 10. Roadmap pós-V1

| Versão | Feature | Gatilho |
|---|---|---|
| V2 | Input por Instagram | Campo `@instagram` criado e populado em `crm_deal` |
| V2 | Motivo de perda real | Coluna `crm_deal.motivo_perda` criada |
| V2 | Flag "já é cliente" | Cruzamento com `cup_clientes` + `cup_churn` |
| V3 | Integração HubSpot | Decisão sobre plano pago |
| V3 | Persistir histórico de conversa | Demanda do SDR |
| V3 | Streaming SSE | Após medir latência P95 do V1 |
| V3 | Follow-ups conversacionais avançados | Após avaliar uso real |

## 11. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Nome de coluna em `crm_deal` diferente do esperado | Médio | Primeira task do plano é validar schema real e ajustar |
| Fuzzy match retorna lixo (query genérica ex: "Consultoria") | Médio | `LIMIT 10` + query mínima 3 chars + LLM filtra por relevância |
| LLM alucina dados | Alto | System prompt com "nunca inventar"; tools retornam JSON estruturado; teste de regressão |
| Custo LLM escala com adoção | Baixo (~US$ 55/mês p/ 10 SDRs) | Prompt caching obrigatório; review em 3 meses |
| Bitrix DB fora do ar | Baixo | Usamos DB espelhado, não API direta |
| SDR vê pipeline de colegas | Médio (política) | Log de uso; se virar problema, ativar role check |
| Cliente externo do portal acessa SDR Assistant | **Alto** (vazamento comercial) | Guard por tipo de usuário (colaborador interno) no middleware do endpoint |

## 12. Cronograma

| Etapa | Dias |
|---|---|
| Validar schema real de `crm_deal` + ajustar queries | 0,5 |
| Backend: rota `/api/sdr-assistant/chat`, tools, migration da tabela de log | 2 |
| Integração Anthropic SDK com tool-use (replica padrão `growth-ai.ts`) | 1 |
| Frontend: página, componentes, dark mode, menu lateral | 1,5 |
| Testes unitários + integração + QA manual | 1 |
| Review + ajustes + merge | 0,5 |
| **Total** | **~6,5 dias** (1 sprint) |

## 13. Arquivos impactados (previsão)

### Novos

- `client/src/pages/SdrAssistant.tsx`
- `server/routes/sdr-assistant.ts`
- `server/routes/sdr-assistant.test.ts`
- Migration SQL: `cortex_core.sdr_assistant_usage`

### Modificados

- `server/index.ts` — registrar rota `/api/sdr-assistant`
- `client/src/App.tsx` (ou router) — registrar rota `/sdr-assistant`
- Componente de menu lateral — link novo em "Comercial"

## 14. Referências internas

- `server/routes/growth-ai.ts` — padrão de tool-use (base a replicar)
- `server/routes/ia-hub.ts` — integração Anthropic SDK
- `CLAUDE.md` — workflow obrigatório, dark mode, conventional commits
- `agents/db-specialist.md` + `DATABASE.md` — ler antes de queries SQL
- `docs/plans/2026-03-20-bitrix-crm-integration.md` — contexto da integração Bitrix atual

---

**Próximo passo:** invocar `superpowers:writing-plans` para detalhar o plano de implementação com tasks executáveis.
