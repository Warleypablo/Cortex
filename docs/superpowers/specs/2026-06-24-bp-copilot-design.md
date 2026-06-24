# BP Copilot — Chat especialista de tomada de decisão no BP

**Data:** 2026-06-24
**Autor:** Warley + Claude
**Status:** Em revisão (skill já implementada; backend/tools/UI a seguir)

## Objetivo

Um chat no módulo BP, alimentado pelas métricas do Business Plan, que atua como
**especialista de tomada de decisão**: domínio técnico de métricas de negócio,
**análises preditivas** (cenários hipotéticos / what-if), **identificação de gargalos**
e **recomendações**. Usa a API da Anthropic (`claude-opus-4-8`).

## Decisões (travadas com o usuário)

| Dimensão | Decisão |
|---|---|
| Persona | Copiloto consultivo **híbrido** (cético em risco/caixa, propositivo em crescimento) |
| Público | Sócios / C-level |
| Acesso a dados | **Híbrido** — visão geral no contexto + ferramentas de drill (reaproveita `bp2026.*`) |
| Predição | **Code execution** (sandbox Anthropic) p/ projeções e what-if |
| Ação | Consultivo + pode **propor ações registráveis** (só executa com confirmação) |
| Modelo | `claude-opus-4-8`, adaptive thinking, streaming, prompt caching |
| Nome | **BP Copilot** |
| Padrão de implementação | Segue o assistente **Growth AI** (`/growth/ai`) — o template mais próximo |

## Arquitetura — 4 subsistemas

### 1. Skill / persona ✅ (feito)
`agents/bp-copilot-SKILL.md` — system prompt em 7 blocos, com os gotchas do BP embutidos.
Carregado pelo backend via um `buildSystemPrompt()` (padrão do `juridico-assistente`).

### 2. Pipeline de dados + Ferramentas
**Reaproveita os módulos `bp2026.*`.** Hoje o handler em `bp2026.ts:507` prepara as deps
(orçado seedado + séries `vendasMrrPorMes`/`pontualPorMes`, `mesCorrente`, `mesFechado`) e
chama `montarMetricasGerais`, `montarRevenue`, `montarVendasProduto`, `montarFunil`,
`montarCapacity`, `montarDetalhamentos`, `montarPontual`. **Extrair essa preparação de deps
para um helper compartilhado** (`prepararDepsBp(db, ano)`) que as tools e o handler usem.

**Visão geral no contexto:** no início da conversa, montar um resumo compacto (texto) a partir
de `montarMetricasGerais` + topo do `montarRevenue` (MRR Ativo, churn, vendas, caixa, atingimento
YTD) e injetar como bloco cacheável **depois** da skill (a skill é o prefixo estável; o snapshot
é cacheável por período). Assim o agente já "conhece o cenário" sem gastar uma tool.

**Catálogo de ferramentas (tool use):**
| Tool | Reaproveita | Uso |
|---|---|---|
| `get_bp_overview(ano, mesAte)` | `montarMetricasGerais` | Visão geral / re-fetch do snapshot |
| `get_bp_revenue(ano, mesAte)` | `montarRevenue` | MRR/Contratos/AOV/Churn por produto |
| `get_bp_vendas_produto(ano)` | `montarVendasProduto` | Vendas MRR/pontual e AOV por segmento |
| `get_bp_funil(ano)` | `montarFunil` | Reuniões, conversão, AOV de venda |
| `get_bp_capacity(ano)` | `montarCapacity` | Gestores/designers, contratos por gestor |
| `get_bp_detalhamentos(ano, mesAte)` | `montarDetalhamentos` | SG&A, CAC (sub-linhas/produto), payback |
| `get_bp_pontual(ano)` | `montarPontual` | Venda comercial × estoque, por jornada |
| `get_bp_churn_detalhe(ano, mes, produto?)` | `bp2026.detalhe` | Drill de churn (lista de contratos) |

Tools **específicas** (não uma genérica) — descrições prescritivas ("use quando…"), inputs
validados, mais claras para o modelo. Todas read-only.

**Code execution:** habilitar o server-tool de code execution da Anthropic. Fluxo v1: o agente
busca dados via tools → números entram no contexto → escreve Python com esses números → roda →
projeta (run-rate, cenário what-if). Premissas ficam visíveis no código (auditável). PTC
(programmatic tool calling) fica como evolução.

**Ação registrável:** tool `propose_action(tipo, descricao, payload)` que **não executa** — registra
a proposta e devolve para confirmação. Execução real (ex.: abrir chamado em `cortex_core.chamados`)
só após `confirm_action` explícito do usuário.

### 3. Backend
Arquivo `server/routes/bp-copilot.ts`, registrado em `routes.ts` (padrão `registerBpCopilotRoutes`).
- **Cliente:** `@anthropic-ai/sdk` (já instalado), `claude-opus-4-8`, `thinking: {type:"adaptive"}`,
  prompt caching (cache_control ephemeral na skill + snapshot).
- **Agentic loop** com tools + code execution, teto de iterações (ex.: 8).
- **Histórico:** tabelas `cortex_core.bp_copilot_conversas` / `bp_copilot_mensagens` (mesmo formato de
  Growth AI — `tool_calls` em JSONB).
- **Endpoints:** `GET/POST /api/bp-copilot/conversas`, `GET .../conversas/:id/mensagens`,
  `POST /api/bp-copilot/chat`, `DELETE .../conversas/:id`.
- **Auth:** restrito a **admin/sócios** (dado financeiro sensível) — checar `req.user` + papel.
- **Logging de uso:** tokens (input/output/cache), nº de tool calls, duração — tabela
  `bp_copilot_usage` (como o SDR Assistant faz).
- **Streaming:** **recomendado** (SSE) por causa do code execution lento + respostas longas →
  resposta única bloquearia e arriscaria timeout do Express (120s). Faseado (ver plano).

### 4. UI
Página no padrão `GrowthAI.tsx`: sidebar (conversas) + chat (ScrollArea + ReactMarkdown) +
cards de sugestão + input. Dark/light mode. Cards de sugestão específicos do BP
("Como fecha o ano no ritmo atual?", "Qual o maior gargalo agora?", "E se o churn subir 2pp?",
"Onde estou queimando caixa acima do orçado?"). **Localização:** rota `/bp-2026/copilot` com
entrada no menu/topo do BP. Render do code execution (mostrar que está calculando) e das
projeções de forma legível.

## Fluxo de uma conversa (exemplo)
1. Usuário: "E se o churn subir 2pp no 2º semestre, como fecha o caixa?"
2. Agente já tem o snapshot; chama `get_bp_overview` + `get_bp_revenue` p/ churn/MRR atuais.
3. Roda code execution: projeta MRR e geração de caixa nos 3 cenários, com a premissa de +2pp.
4. Responde BLUF: impacto no caixa de dez, faixa de cenários, o gargalo, recomendação.
5. (Opcional) propõe ação registrável ("quer que eu registre um alerta de churn?").

## Modelo de dados
```sql
CREATE TABLE IF NOT EXISTS cortex_core.bp_copilot_conversas (
  id SERIAL PRIMARY KEY, usuario_id VARCHAR(255) NOT NULL,
  titulo VARCHAR(500) DEFAULT 'Nova conversa',
  criado_em TIMESTAMP DEFAULT NOW(), atualizado_em TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS cortex_core.bp_copilot_mensagens (
  id SERIAL PRIMARY KEY,
  conversa_id INTEGER NOT NULL REFERENCES cortex_core.bp_copilot_conversas(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, conteudo TEXT NOT NULL, tool_calls JSONB,
  criado_em TIMESTAMP DEFAULT NOW());
-- bp_copilot_usage: user_id, conversa_id, tokens_in/out/cache, tool_calls, duration_ms, criado_em
```

## Segurança / custo
- **Auth restrita** a sócios/admin. Dado financeiro não vaza para papéis operacionais.
- **Custo:** prompt caching na skill + snapshot reduz input repetido; logar tokens p/ acompanhar.
  Code execution: 1.550h grátis/mês/org, depois $0.05/h.
- **Sem execução de ação sem confirmação.** `propose_action` é inerte; só `confirm_action` executa.

## Riscos e mitigações
- **Alucinação numérica** → regra de ouro na skill (número só via tool) + projeções só via code execution.
- **Confundir artefato com tendência** → gotchas embutidos na skill (bloco 3).
- **Latência do code execution** → streaming + indicador de progresso na UI.
- **Reaproveitar `montar*`** muda a assinatura (precisa das deps) → extrair `prepararDepsBp` sem
  alterar o comportamento do handler atual (cobrir com os testes existentes do BP).

## Plano de implementação (fases)
1. **Fase 1 — Backend núcleo (resposta única):** `prepararDepsBp` extraído; tools read-only;
   endpoint de chat com agentic loop + code execution + histórico; auth; sem streaming ainda.
   Validável via curl/Postman. Entrega o "cérebro + corpo" funcionando.
2. **Fase 2 — UI:** página no padrão Growth AI, cards de sugestão, dark/light, rota no BP.
3. **Fase 3 — Streaming (SSE):** troca a resposta única por streaming p/ UX de respostas longas.
4. **Fase 4 — Ações registráveis:** `propose_action` / `confirm_action` + integração com chamados.

## Fora de escopo (v1)
- Programmatic tool calling (PTC) — fluxo simples de code execution basta.
- Geração de relatórios/arquivos (PPTX/PDF) — possível evolução via skills da Anthropic.
- Acesso por papéis operacionais.
