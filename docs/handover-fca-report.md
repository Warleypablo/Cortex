# Handover — FCA Report (skill `turbo-fca-report`)

**Última atualização:** 2026-05-21
**Autor da sessão original:** Ichino + Claude Code (Opus 4.7)

Documento de continuidade pra retomar o projeto FCA em qualquer nova sessão sem perder contexto. Quando abrir um novo chat e quiser continuar, basta dizer "continua o FCA" e o Claude vai ler:

1. Memória persistente: `~/.claude/projects/-Users-ichino-Documents-Turbo-Cortex/memory/project_fca_report.md`
2. Este handover: `docs/handover-fca-report.md`
3. Skill canônica: `.claude/skills/turbo-fca-report/SKILL.md`

---

## O que é o FCA Report

Relatório semanal automatizado dos funis de Growth da Turbo Partners. Responde 2 perguntas em <30s:
- **"Vamos bater a meta do mês?"** (Pacing)
- **"Onde estão os gargalos e o que atacar?"** (cascata + ações)

Estrutura fixa (skill v3.15):
1. Contexto (funil, períodos)
2. Resumo executivo (bullets)
3. Pacing da meta (MTD + projeção fim de mês)
4. Métricas Inbound — Consolidado (cascata por camada: Growth / Pré-vendas / Resultado)
5. Comparação semanal (W vs W-1)
6. Gargalos identificados
7. Ações da semana
8. Sinais positivos
9. Impedimentos

**Métricas norte:**
- CAC - Negócios (meta final, conjunta)
- CPMQL (controlável de Growth)

**Funis cobertos:** só Creators na v1. Ecommerce planejado pra depois de 2-3 semanas de Creators amadurecer.

---

## Estado atual (2026-05-21)

### O que está pronto

| Item | Local | Status |
|---|---|---|
| Skill `turbo-fca-report` v3.15 | `.claude/skills/turbo-fca-report/SKILL.md` | ✅ no repo (PR #204 mergeado em main) |
| Cópia canônica da skill | `/Turbo/chief-of-staff/02 - Resources/skills/turbo-fca-report/SKILL.md` | ✅ sincronizada |
| Endpoint REST | `server/routes/fca.ts` | ✅ no repo (PR #204) |
| Healthcheck (sem auth) | `GET /api/fca/health` | ✅ no PR #205 (aguardando merge) |
| Primeiro relatório W-20 | `docs/fca/2026-W20_creators_weekly.md` | ✅ no repo |
| Task ClickUp do W-20 | https://app.clickup.com/t/86ahm3dzm | ✅ criada |
| Payload pré-pronto da routine | `docs/fca/routine-payload.md` | ✅ no PR #205 |
| Memória persistente | `project_fca_report.md` | ✅ salvo |

### PRs

- **#204 — `feature/turbo-fca-report-setup`:** skill v3.14 + endpoint + relatório W20 — **MERGEADO em main**
- **#205 — `feature/turbo-fca-report-setup`:** healthcheck + skill v3.15 + payload doc — **aguardando merge**: https://github.com/Warleypablo/Cortex/pull/205

### O que está pendente (em sua mão)

1. **Deletar task duplicada no ClickUp:** `86ahmdqvb` (gerada num teste do endpoint; tem versão markdown antiga). Manter só `86ahm3dzm` (com iterações manuais). Permissão do Claude foi bloqueada pelo classifier — você precisa deletar manualmente no ClickUp UI.

2. **Adicionar `FCA_API_TOKEN` no `.env` do servidor `cortex.turbopartners.com.br`** via SSH:
   ```
   FCA_API_TOKEN=ea410774ba0fea92daf84417c1a7988351b874b326c0599ea20243883318e3c3
   ```
   Reiniciar serviço depois (pm2/systemctl).

3. **Mergear PR #205** no GitHub (auto-deploy via push em `main`).

4. **Validar deploy** com healthcheck:
   ```
   curl https://cortex.turbopartners.com.br/api/fca/health
   ```
   Esperado: `{"ok":true,"version":"v3.15","endpoint":"POST /api/fca/run","tokenConfigured":true,...}`

5. **Avisar** o Claude na próxima sessão: "deploy ok"

### O que está pendente (em mão do Claude, quando você avisar)

1. Testar `POST https://cortex.turbopartners.com.br/api/fca/run` via HTTPS com o token
2. Criar routine via `RemoteTrigger` usando `docs/fca/routine-payload.md` como base
3. Marcar como completo

### O que ficou pra próxima iteração (não bloqueante)

1. **Cadastrar metas faltantes** pra Creators Maio 2026 em `/planejamento-metas`:
   - CAC (alvo)
   - Faturamento Total (alvo)
   - Negócios Ganhos (alvo)
   - Sem essas metas, Pacing fica 🔘 nas linhas principais

2. **Subtasks atribuídas** no ClickUp: cada ação do relatório devia virar uma subtask filha da task pai, atribuída ao responsável (Gestor de Performance, Designer CRO, Dev, etc.). Hoje as ações ficam só na descrição. Falta mapeamento de **pessoa real → tipo de ação**.

3. **Task de escalonamento pra pré-vendas:** quando o constraint é fora de Growth (no-show alto, etc.), criar task separada na lista do comercial com `@menção`. Precisa saber a lista do comercial.

4. **Ecommerce:** replicar a query Creators pra Ecommerce. Esperar 2-3 semanas (conforme decisão de 2026-05-21) ou adiantar.

---

## Como retomar em nova sessão

### Caso 1: você já fez o deploy

Frases que ativam o Claude pra criar a routine:

> "Deploy ok, configura o schedule do FCA"

> "Roda o RemoteTrigger create do payload em docs/fca/routine-payload.md"

O Claude vai:
1. Carregar tool `RemoteTrigger` via `ToolSearch`
2. Ler `docs/fca/routine-payload.md`
3. Substituir `$FCA_API_TOKEN` pelo valor real no prompt do body
4. Chamar `RemoteTrigger action:"create" body:<...>`
5. Retornar link da routine

### Caso 2: deploy ainda não foi feito

> "Lembra do FCA, onde paramos?"

O Claude lê esta página + memória e te lista as pendências.

### Caso 3: quer iterar a estrutura do relatório

Mudanças vão na skill (`.claude/skills/turbo-fca-report/SKILL.md`) e no código do endpoint (`server/routes/fca.ts` — função `montarMarkdown`). Os 2 lugares precisam ficar em sync.

### Caso 4: quer rodar o FCA manualmente agora (não automático)

> "Roda o FCA Creators"

O Claude vai executar os 7 passos da skill via conversa (sem usar o endpoint). Cria task no ClickUp como sempre.

---

## Referências rápidas

### URLs e IDs

- **Servidor prod:** `https://cortex.turbopartners.com.br`
- **Repo:** `https://github.com/Warleypablo/Cortex`
- **Branch deploy:** `main` (auto-deploy)
- **ClickUp lista FCA:** `901322140780`
- **ClickUp user Ichino:** `55120346`
- **Routines Anthropic:** `https://claude.ai/code/routines`

### Custom fields ClickUp (lista 901322140780)

```
Canal:  f1269c53-1ee0-40bf-8796-2961f0ca767b
  → Meta Ads: 2b7e74d1-78ec-4d5b-a0c8-553b64d2d1c0
Funil:  b036cff5-6866-45d5-b1a4-19366e32a532
  → Creators: d96d739e-a3f0-4c2e-9edb-5e22a0d84d05
  → Ecommerce: 62a087fc-73a5-4bbd-bddc-aaa9caeb1c5d
Tipo:   c58c4fd0-8a03-400f-ac81-5316643bd6ed
  → Relatório de Mídia: 3ca91709-20ed-4c67-9e60-1a5525f522d9
Date:   8cfba79a-d243-4911-8563-fd39c2523357
```

### Env vars críticas

```
DATABASE_URL=postgresql://growth_dev:...@34.95.249.110:5432/dados_turbo
CLICKUP_API_KEY=pk_94063598_...
FCA_API_TOKEN=ea410774ba0fea92daf84417c1a7988351b874b326c0599ea20243883318e3c3
```

### Tabelas do banco usadas

- `meta_ads.meta_insights_daily` — investimento, impressões, cliques, LPV
- `meta_ads.meta_campaigns` — filtro por funil via `campaign_name ILIKE '%creators%'`
- `meta_ads.growth_budgets` — metas (JSONB por funil/mês/segmento)
- `"Bitrix".crm_deal` — leads, MQLs, RA, RR, vendas, faturamento; filtro `fnl_ngc ILIKE 'creators'`

### Filtros temporais corretos (cuidado com isso!)

| Métrica | Campo do filtro |
|---|---|
| Leads, MQLs (volume topo) | `created_at BETWEEN` |
| RA (reunião agendada) | `data_reuniao_agendada BETWEEN` |
| RR (reunião realizada) | `data_reuniao_realizada BETWEEN` |
| Negócios Ganhos, Faturamento | `data_fechamento BETWEEN` + `stage='Negócio Ganho'` |

**Filtros errados (que estavam no início):** todas as métricas filtravam por `created_at`. Isso inflava No-show e subestimava Negócios. Corrigido na v3.14.

---

## Decisões importantes tomadas

| Data | Decisão | Por quê |
|---|---|---|
| 2026-05-20 | Hook/Hold rate **fora** da cascata FCA | São diagnóstico de criativo, não de funil |
| 2026-05-20 | Formato constraint-first (não FATO/CAUSA/AÇÃO) | Leitura mais rápida, foco em ação |
| 2026-05-21 | CAC = meta final; CPMQL = norte controlável de Growth | CAC é resultado conjunto Growth + Pré + Vendas |
| 2026-05-21 | Pacing como 2ª seção (após Resumo executivo, não 1ª) | Resumo dá contexto antes do Pacing |
| 2026-05-21 | Filtros temporais corrigidos (data_fechamento, data_reuniao_*) | Os filtros antigos por created_at distorciam números |
| 2026-05-21 | Apenas weekly (modo daily desativado) | Foco em fazer um modo funcionar bem antes de expandir |
| 2026-05-21 | 1 task ClickUp por funil por semana | Cada funil tem responsável e ações diferentes |
| 2026-05-21 | Caminho A (endpoint REST em prod) em vez de B (DATABASE_URL no agente) | Cortex já tem URL pública; centraliza credenciais no backend |
| 2026-05-21 | Cron `0 11 * * 1` UTC = segunda 8h SP | Padrão de início de semana operacional |

---

## Gaps conhecidos no banco (ver Impedimentos no relatório)

1. Metas Maio Creators inexistentes em `growth_budgets` (skill usa Abril como fallback)
2. Meta `leads:1.206` em Abril Creators cadastrada como número 1.206 (1 vírgula 206), provavelmente quis dizer 1.206 (mil duzentos e seis) — bug de cadastro
3. Bug LPs `pages.turbopartners.com.br` perde `utm_content` → memória `project_lp_pages_turbo_bug`
4. `stage_semantic` sempre NULL em Creators → usar `stage='Negócio Ganho'`
5. Flag MQL no Bitrix usa threshold R$100k vs regra Turbo R$50k → memória `project_mql_threshold_bitrix`
6. CPL/Leads do Bitrix incluem leads orgânicos (não filtra por origem Meta Ads)

---

## Como invocar o relatório (3 caminhos)

### A) Manual via Claude (qualquer sessão)
> "roda o FCA Creators"

Claude executa os 7 passos da skill na conversa, cria task ClickUp.

### B) HTTP local (servidor `npm run dev`)
```bash
curl -X POST http://localhost:3000/api/fca/run \
  -H "Authorization: Bearer $FCA_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"funil":"Creators","createTask":true}'
```

### C) HTTP em produção (depois do deploy)
```bash
curl -X POST https://cortex.turbopartners.com.br/api/fca/run \
  -H "Authorization: Bearer ea410774ba0fea92daf84417c1a7988351b874b326c0599ea20243883318e3c3" \
  -H "Content-Type: application/json" \
  -d '{"funil":"Creators","createTask":true}'
```

### D) Schedule automático (depois de criar a routine)
Toda segunda 8h SP automaticamente, sem intervenção. Notificação aparece em https://claude.ai/code/routines.
