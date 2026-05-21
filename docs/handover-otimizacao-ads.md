# Handover — Feature Otimização de Ads (Cortex)

> Documento criado para transferir o contexto desta feature para uma nova
> sessão de chat sem perder o trabalho feito até aqui.
> Última atualização: 2026-05-01.

---

## 0. TL;DR

Feature de **Otimização de Ads** já está **implementada no MVP e rodando**
no dev server. Branch: `feature/otimizacao-de-ads`. Falta:
1. Refinar o `server/playbooks/ads-optimization.md` com base no PSOP
   completo do usuário (Seção 6 deste doc).
2. Adicionar 3 melhorias de baixo esforço (corte rápido / learning phase /
   whitelist parser).
3. Testar end-to-end e commitar.

---

## 1. Contexto da feature

A aba **Criativos** (`/growth/criativos`) e **Meta Ads** (`/growth/meta-ads`)
mostram performance mas **nenhuma ação pode ser executada de dentro do
Cortex** — o usuário precisava abrir o Ads Manager pra pausar/ajustar.

A feature **Otimização de Ads** introduz um agente de IA (gpt-4o + tool
calling) que:

1. Lê automaticamente performance dos últimos 7 dias (sync incremental
   sob demanda quando usuário clica o botão).
2. Compara contra um **playbook de regras** versionado em md.
3. Gera propostas de ações **(somente pause no MVP — reativação foi
   cortada)** com justificativa numérica.
4. Apresenta em modal (aprovar / editar / negar por proposta).
5. Quando aprovado, executa via **Graph API do Meta**.

---

## 2. Decisões fechadas

| Tema | Decisão |
|---|---|
| **Execução** | Graph API direta (`MetaGraphExecutor`). Camada `executor` desacoplada para trocar por Manus no futuro sem reescrever o agente. |
| **LLM** | OpenAI `gpt-4o` (mesmo padrão de `growth-ai.ts`). |
| **Playbook** | 1 arquivo md em `server/playbooks/ads-optimization.md` com tabela de targets por produto + regras + whitelist. |
| **Identificação do produto** | Extraída do nome da campanha via regex `[Produto]` (mesma convenção de `Criativos.tsx:135-162`). |
| **Aprovador (whoami)** | Lista hardcoded de emails: `vinicius.ichino@turbopartners.com.br` + `warleyreserva4@gmail.com`. |
| **Editar proposta** | Trocar ação (pause/skip — sem reactivate) + trocar entidade alvo (descer da campanha pra adset/ad) + nota livre. |
| **Limite por batch** | Sem limite hard. |
| **Whitelist** | No próprio md (padrões glob ou IDs). Filtra antes do LLM ver os dados. |
| **Dry run** | Sem dry run. Aprovação manual já é o controle. |
| **Frequência** | Só sob demanda (botão "Otimizar com IA"). Sem cron. |
| **Cooldown** | 48h entre ações na mesma entidade (`getRecentlyTouchedEntityIds`). |
| **Reativação** | **Cortada do MVP.** Será tratada na feature futura de "subir campanhas" (criação). |
| **Granularidade no MVP** | Apenas **adset**. Pause de campaign/ad fica para fase futura. |
| **Faseamento** | Fase 1 (atual): só pause. Fase 2: budget. Fase 3: duplicar. Fase 4: criativos/targeting. |

---

## 3. Estado da implementação (arquivos)

### Branch
`feature/otimizacao-de-ads` (criada de `origin/main`).

### Arquivos novos

**Backend:**
- `server/services/adsOptimization/types.ts` — interfaces (`AdsExecutor`, `AgentProposal`, etc.)
- `server/services/adsOptimization/playbook.ts` — parser do md, whitelist, extração de produto.
- `server/services/adsOptimization/dataLoader.ts` — query agregada por adset (filtra ACTIVE, schema `meta_ads.*`), cooldown 48h, summarize para LLM.
- `server/services/adsOptimization/agent.ts` — gpt-4o com tool calling (`propose_action`). Só aceita `action: "pause"`.
- `server/services/adsOptimization/executor.ts` — `MetaGraphExecutor` com retry/backoff (R2), check de status atual (R3), allowlist de operações (R10).
- `server/middleware/requireEmail.ts` — middleware de permissão por email.
- `server/routes/ads-optimization.ts` — 4 rotas + `whoami`. Registrada em `server/routes.ts`.

**Playbook:**
- `server/playbooks/ads-optimization.md` — atual com placeholders. **PRECISA SER REFINADO** com base no PSOP do usuário (Seção 6).

**Frontend:**
- `client/src/hooks/useAdsOptimization.ts` — React Query: `useIsApprover`, `useProposeOptimization`, `usePatchProposal`, `useExecuteBatch`.
- `client/src/components/criativos/AdsOptimizationDialog.tsx` — modal principal (propostas agrupadas por produto).
- `client/src/components/criativos/EditProposalSheet.tsx` — editor (action `pause`/`skip` + dropdown adset/ad + nota).

**Migration:**
- `scripts/create-meta-optimization-proposals-table.ts` — script idempotente. Foi rodado e a tabela existe no banco.

### Arquivos modificados
- `shared/schema.ts` — adicionado `metaOptimizationProposals` (no schema public, padrão das outras meta_*) + types.
- `server/routes.ts` — registra `registerAdsOptimizationRoutes(app)`.
- `client/src/pages/Criativos.tsx` — botão "Otimizar com IA" (só visível se `useIsApprover().data.isApprover === true`).

### Banco
- Tabela `meta_optimization_proposals` **já criada** em `public` via `scripts/create-meta-optimization-proposals-table.ts`. **NÃO usar `npm run db:push`** — o `shared/schema.ts` está incompleto em relação ao banco real e o push entra em modo interativo perigoso.
- Tabelas Meta Ads existentes estão em **schema `meta_ads`** (`meta_ads.meta_adsets`, `meta_ads.meta_campaigns`, `meta_ads.meta_insights_daily`, etc.) — apesar de `shared/schema.ts` declará-las como public.

### Env vars
- `ACCESS_TOKEN_META_SYSTEM` — token Meta. **Já validado: tem `ads_management`, `ads_read`, `business_management`.**
  - ⚠️ **É um User token (não System User)**. App: "Turbo Painel de Controle" (ID `733366652352713`). Emitido pelo user `Caio Massaroni`. **Expira em ~2 semanas a partir de 2026-05-01.** Quando expirar, tudo para. Recomendado migrar para System User token antes de expirar.
- `BUSINESS_ID_META` — Business ID da Turbo (já configurado).
- `OPENAI_API_KEY` — já configurada (compartilhada com `growth-ai`).

### Permissões/segurança
- Backend: middleware `requireEmail(APPROVER_EMAILS)` em todas as 4 rotas mutativas + a `propose`. Em `whoami` é permitido para qualquer autenticado mas só retorna `isApprover: true` se o email bater.
- Frontend: botão só renderiza se `isApprover === true` (defesa em profundidade).
- Lista atual: `vinicius.ichino@turbopartners.com.br`, `warleyreserva4@gmail.com`.

### Account ID
Hardcoded em `server/services/metaAdsSync.ts`: `act_1331413260627780` (Turbo).

---

## 4. Conta de risco e safeguards (já implementados)

| ID | Risco | Mitigação |
|---|---|---|
| **R1** | Frescor dos dados | Sync incremental sob demanda (TTL 15min) antes do agente analisar. UI mostra timestamp. |
| **R2** | Rate limit Graph API | Executor sequencial. Retry com backoff exponencial (30s, 60s, 120s) em códigos 4/17/80004. |
| **R3** | Concorrência (alguém edita no Ads Manager) | Antes de cada ação, executor faz GET do status atual. Se já está no estado desejado → `noop` registrado. |
| **R4** | Flip-flop | Cooldown 48h: `getRecentlyTouchedEntityIds` exclui entidades com `executed_at` recente. |
| **R5** | Sem limite por batch | Aceito conscientemente. UI agrupa por produto e ordena por desvio do alvo. |
| **R6** | Campanha sem produto | `extractProduto` retorna null → entidade entra em `ignored` no payload. Reportado na UI. |
| **R7** | Whitelist | Filtro aplicado **antes** do LLM ver os dados. Defesa dupla no executor (`executeAction`) recusa entidade whitelisted. |
| **R8** | Custo do LLM | Dados pré-agregados em SQL (1 linha por adset, não 10K rows raw). Estimativa $0.04-0.07 por execução. |
| **R9** | Reversão / undo | Sem botão automático. Usuário reverte no Ads Manager. Histórico fica em `meta_optimization_proposals`. |
| **R10** | Bug do agente | Allowlist hard-coded de operações (`pause` apenas hoje). Operação fora da lista é rejeitada antes da Graph API. |

---

## 5. Pré-requisitos do usuário

### ✅ Já feitos
- Token Meta com `ads_management` (já tem).
- Tabela `meta_optimization_proposals` criada no banco.

### ⚠️ Pendentes
- **Playbook real refinado** — usuário entregou PSOP completo (Seção 6). Precisa transformar em `ads-optimization.md` operacional + decidir lacunas (Seção 7).
- **Migrar para System User token** antes que o atual expire (~2 semanas a partir de 2026-05-01). Não bloqueante para testar agora.

---

## 6. Playbook PSOP entregue pelo usuário

> Documento PSOP completo (de 27/03/2026) entregue pelo usuário. Esta é a
> referência canônica para refinar `server/playbooks/ads-optimization.md`.

### 6.1 Resumo

PSOP — Teste e Otimização de Criativos (Meta Ads) — Turbo Partners.

Estrutura:
- **ABO (Teste):** 1 adset por criativo, 3 hooks por adset. Análise no
  nível do **ad individual**, não do adset.
- **CBO (Escala):** 1 adset com criativos validados (≥10 MQLs + CPMQL na
  meta + %MQL OK). Meta distribui orçamento automaticamente.

### 6.2 Métricas de decisão

| Nível | Métrica | Quando usar |
|---|---|---|
| Primária | **CPMQL** | Pausar / manter / escalar |
| Secundária | CAC | Após ≥3 vendas atribuídas ao criativo |
| Qualidade | %MQL | Abaixo do mínimo do funil em 2 análises → pausar |
| Funil | %RA, %RR, %RR→Venda | Quando ≥10 MQLs |
| Corte rápido | CPL | 3 dias, gastou 50% CPMQL alvo sem lead → pausa |
| Diagnóstico | Hook Rate, Hold Rate, CTR, CPM | Para entender porquê (não decide) |

### 6.3 Fórmulas-chave

- **Orçamento diário do adset (ABO):** `(CPMQL alvo ÷ 7) × 3`
- **Verba semanal de teste:** `(Budget mensal ÷ 4) − Gasto semanal dos ads escalados`

### 6.4 Regras ABO

**Corte rápido (a partir do dia 3):**
- Ad gastou ≥50% do CPMQL alvo e nenhum lead → **PAUSA IMEDIATA**

**Zonas (janela 14 dias):**
| Zona | Critério | Ação |
|---|---|---|
| 🟢 Verde | CPMQL < 90% do alvo | Descer pro 7d/3d → escalar (dobrar ou +20%) |
| 🟠 Laranja | 90–110% do alvo | Aplicar 14-7-3 |
| 🔴 Vermelha | > 110% do alvo | PAUSAR ad |

**Lógica 14-7-3:**
- Janelas: 14d (performance) → 7d (tendência) → 3d (confirmação)
- Tabela só cobre 4 das 9 combinações (verde/laranja/vermelha × verde/laranja/vermelha) — **5 buracos**.
- Combinações cobertas:
  - 7d 🟢 + 3d 🟢 → ESCALAR
  - 7d 🟠 + 3d 🔴 → REDUZIR (10-30%) se escalado
  - 7d 🔴 + 3d 🔴 → REDUZIR ou pausar
  - 7d 🔴 + 3d 🟢 → MANTER

**Filtro %MQL:** abaixo do mínimo por 2+ análises → avaliar com pré-vendas, cogitar pausar.

**Ritmo de escala (ABO):**
| Semana | Orçamento | MQLs esperados |
|---|---|---|
| 1 | base | 1–3 |
| 2 | 2× | 6–9 |
| 3 | 4× | 12–18 |
| 4+ | +10–30%/sem | — |

### 6.5 Validação ABO → CBO

Critério: ≥10 MQLs (acumulado do ad) + CPMQL na meta + %MQL OK.
Ação: **duplicar** (não migrar) o ad para CBO. Continua na ABO enquanto performar.

### 6.6 Regras CBO

| Situação | Ação |
|---|---|
| 🟢 Verde | Manter |
| 🔴 Vermelho + investimento significativo | PAUSAR |
| 🔴 Vermelho + gasto irrelevante | NÃO pausar (Meta tira investimento sozinho) |

Escala CBO: dentro do alvo por 2 análises consecutivas → +10–30% no orçamento.

### 6.7 Constraint analysis (cascata)

Olhar funil de cima pra baixo. Primeiro gargalo = constraint:
CPM → CTR → Connect Rate → Conversão de Página → CPMQL → %MQL → %RA → %RR → %RR→Venda → CAC.

### 6.8 Transição CPMQL → CAC

Ativar CAC como métrica primária quando o criativo acumula ≥3 vendas dentro do CAC meta. Lead time 20–30 dias.

### 6.9 Frequência de análise

Segunda, quarta, sexta. Segunda é dia de otimização + revisão de alocação.

---

## 7. Análise crítica do PSOP (gap analysis)

### Inconsistências a corrigir
1. **CPMQL Creators** aparece como R$300 (Seção 3.3) e R$330 (exemplo da Seção 5.1).
2. **Tabela 14-7-3 incompleta** — 5 das 9 combinações não têm decisão definida.
3. **Conflito 5.3 vs 5.7:** "Verde no 14d → escalar" vs "Dobra só na verde após confirmação 7d/3d".
4. **Passo 1 da 14-7-3 não diferencia verde de laranja na ação** (ambos descem pro 7).
5. **"Reduzir 10-30%" sem critério explícito** de qual % usar quando.

### Faltando (essencial pro agente)
1. **Tabela canônica de targets** por produto (CPMQL, %MQL, CAC pontual, CAC aceleração, budget mensal).
2. **Whitelist** de campanhas protegidas (always-on, branding, retargeting).
3. **Tratamento de Learning Phase** do Meta — não pausar campanhas em learning.
4. **Tratamento de naming não padronizado** (sem `[Produto]` ou múltiplos produtos).
5. **Cooldown** entre ações (já 48h no MVP, falta documentar no md).
6. **%MQL mínimo por produto** explícito na tabela canônica.
7. **Janelas de evento** (BlackFriday etc.) — pausar otimização ou afrouxar tolerância.
8. **Política duplicação ABO→CBO** — agente sinaliza ou executa? Quando?
9. **Granularidade pause** — ad vs adset vs campanha (regra clara).
10. **Lead time formal** — 30 dias antes de considerar CAC.

### Redundâncias
- Seção 11 (Fluxograma) duplica 5.x — útil mas precisa marcar como "resumo executivo".
- FAQ tem perguntas que só repetem ("ver Seção X").
- Glossário tem termos sem uso operacional (Lead Time, CAC Pontual vs Aceleração se não houver regra distinta).

---

## 8. Cobertura playbook PSOP × MVP atual

| Regra do playbook | Cobertura no MVP atual | Esforço pra adicionar |
|---|---|---|
| Corte rápido (50% alvo sem lead) | ❌ | 🟢 1h |
| Zona vermelha → pausar | ✅ Como R1 atual | — |
| Filtro de gasto mínimo | ✅ | — |
| Análise 14-7-3 | ❌ Só janela única (7d) | 🟡 4-6h |
| %MQL filter | ❌ Não calcula MQL | 🔴 8-12h (precisa JOIN com `crmDeal`) |
| Hook/Hold/CTR como gatilho | ❌ Não puxa | 🟡 3-4h |
| ABO vs CBO | ❌ Não distingue | 🟢 2h (parsing de nome) |
| Pausa de ad/campaign (não só adset) | ❌ | 🟡 4-6h |
| Learning phase check | ❌ | 🟢 1h (dado já no banco) |
| CAC após 3 vendas | ❌ | 🔴 12h+ |
| Ajustar budget | ❌ Fora do MVP | 🔴 Fase 2 |
| Duplicar ABO→CBO | ❌ Fora do MVP | 🔴 Fase 3 |
| Constraint analysis | ❌ | 🔴 16h+ |

---

## 9. Próximos passos sugeridos (em ordem)

1. **Usuário decide:** completar a tabela canônica (CPMQL alvo + %MQL mínimo) para os 4 produtos (Creators, Ecommerce, Comercial, Comunidade); listar campanhas/padrões protegidos; ajustar critério "Reduzir 10/20/30%".
2. **Eu (próxima sessão):** transformar o PSOP completo em `docs/playbook-psop-completo.md` (referência humana) e reescrever `server/playbooks/ads-optimization.md` com versão simplificada que o agente realmente aplica hoje.
3. **Eu (próxima sessão):** implementar 3 melhorias de baixo esforço:
   - **Corte rápido** (1h)
   - **Learning phase check** (1h)
   - **Whitelist parser robusto** (já existe, validar)
4. **Testar end-to-end** no preview com playbook real.
5. **Commitar e abrir PR** seguindo CLAUDE.md (commits granulares, conventional commits).
6. **Fora do MVP (futuras sessões):** análise 14-7-3 completa, %MQL via JOIN com Bitrix, pausa multi-nível (ad/campaign), ajuste de budget (Fase 2).

---

## 10. Como testar a feature hoje

1. `npm run dev` na raiz do Cortex.
2. Abrir `http://localhost:3000/growth/criativos`.
3. Login com `vinicius.ichino@turbopartners.com.br` ou `warleyreserva4@gmail.com`.
4. Botão **"Otimizar com IA"** (com ícone de sparkles ✨) ao lado do botão de Settings.
5. Clicar → modal abre → "Analisar campanhas e gerar propostas" → ~30-60s.
6. Lista propostas agrupadas por produto. Cada uma tem Aprovar / Editar / Negar.
7. Botão "Executar N aprovadas" pausa de verdade no Meta (cuidado em produção).

---

## 11. Restrições do ambiente

- `npm run db:push` **NÃO funciona** neste repo (o schema TypeScript está incompleto em relação ao banco real, e o push entra em modo interativo perigoso). Para qualquer migration: criar script `scripts/<nome>-table.ts` com `CREATE TABLE IF NOT EXISTS` e rodar isolado.
- Erros `permission denied for schema staging`, `permission denied for table contratos_creators` no log do dev server são **pré-existentes** e não relacionados à feature.
- Existem outros erros de typecheck pré-existentes em `server/services/turbozap.ts` e `server/storage.ts` — também não relacionados à feature de otimização (zero erros TS nos arquivos novos da feature).

---

## 12. Memórias relevantes do usuário

- Pedir permissão antes de commitar (mesmo com auto-push no CLAUDE.md).
- "Preview" sozinho = `npm run dev` + retornar o link (porta 3000 default).
- Usuário não tem muita experiência com dev — explicar com analogias quando precisar.
- Manter contexto entre sessões e atualizar memória ao final.
- Branch atual `feature/otimizacao-de-ads` (criada de `main`).
- Branch `feature/agente-gestor-meta-ads` está pausada (WIP de outra iniciativa).
