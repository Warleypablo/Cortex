# Playbook de Otimização de Ads — Meta Ads (Fase 1)

> Versão operacional do PSOP da Turbo Partners para o agente automatizado.
> Trata apenas **pause** no nível de **ad individual**. Escala (Fase 2),
> duplicação ABO→CBO (Fase 3) e constraint analysis (Fase 4) ficam de fora.

---

## Configuração geral

- **Janela de avaliação:** últimos 14 dias (também usadas janelas de 7 e 3 dias para análise 14-7-3)
- **Cooldown:** 48 horas (não mexer 2× na mesma entidade nesse período)
- **Identificação do produto:** extraído do nome da campanha via padrão `[Produto]`
  (ex: `[TP] [Leads] [ABO] [Creators] - copy`).
- **Granularidade:** o agente analisa **cada ad** (cada hook é um ad).
- **Cadência:** roda em segunda, quarta e sexta. Mesma lógica de regras nos
  3 dias — o cooldown evita re-ação redundante.

## Produtos reconhecidos

```
Creators
Ecommerce
Comercial
Comunidade
```

## Targets — vêm do banco

Os valores de **CPMQL alvo** e **%MQL mínimo** por produto são lidos
dinamicamente de `meta_ads.growth_budgets` (chaves `cpmql`, `percMqls`)
para o **mês corrente**. Atualize via página **Planejamento de Metas**.

Se um funil não tiver linha no mês corrente, o agente o ignora
(reportado como `produto_sem_target_no_mes`).

---

## Campanhas protegidas (whitelist)

O agente **nunca propõe ações** para entidades cujo nome (campaign_name,
adset_name ou ad_name) bata um destes padrões. Aceita IDs do Meta (numéricos)
ou padrões glob case-insensitive.

```
*always-on*
*branding*
*retargeting*
```

> Adicione IDs específicos quando necessário, um por linha. Linhas começando
> com `#` são comentários e linhas em branco são ignoradas.

---

## Conceitos

- **Zonas (CPMQL vs alvo do produto):**
  - 🟢 Verde: CPMQL < 90% do alvo
  - 🟠 Laranja: 90–110% do alvo
  - 🔴 Vermelha: > 110% do alvo
- **Ad escalado:** `daily_spend ≥ 4 × ((cpmql_alvo ÷ 7) × 3)` (já vem
  calculado como `is_scaled` no payload).
- **Idade do ad:** dias desde o `created_time` (vem como `age_in_days`).

---

## Regras de decisão (ordem de aplicação — curto-circuita na 1ª que bater)

### R0 — Gate de idade (filtro de quais regras avaliar)
- 1–2 dias: só R1
- 3–7 dias: R1 + R2
- 8–14 dias: R1 + R2 + R3 (com 7d e 3d, sem 14d completo)
- 15+ dias: todas as regras

### R1 — Corte rápido
- **Se** `d14.spend ≥ cpmql_alvo × 0.5` **e** `d14.leads = 0`
- **→ pause** (`playbook_rule = "R1"`)

### R2 — Zona vermelha 14d
- **Se** `d14.zona = "vermelha"` (CPMQL > 110% do alvo)
- **→ pause** (`playbook_rule = "R2"`)

### R3 — Análise 14-7-3
- **Pré-condição:** `d14.zona ∈ {verde, laranja}` (vermelha já caiu em R2)
- Tabela de ações (apenas `pause` é executado; ESCALAR/REDUZIR são Fase 2):

| 7d        | 3d        | Ação                                       |
|-----------|-----------|--------------------------------------------|
| 🟢 Verde  | 🟢 Verde  | ESCALAR (Fase 2)                           |
| 🟢 Verde  | 🟠 Laranja| MANTER                                     |
| 🟢 Verde  | 🔴 Vermelha| MANTER se !is_scaled / REDUZIR -10% se is_scaled |
| 🟠 Laranja| 🟢 Verde  | MANTER                                     |
| 🟠 Laranja| 🟠 Laranja| MANTER                                     |
| 🟠 Laranja| 🔴 Vermelha| REDUZIR -10/20/30% se is_scaled (Fase 2) |
| 🔴 Vermelha| 🟢 Verde  | MANTER                                     |
| 🔴 Vermelha| 🟠 Laranja| MANTER se !is_scaled / REDUZIR -10% se is_scaled |
| 🔴 Vermelha| 🔴 Vermelha| **PAUSE** se !is_scaled / REDUZIR -20/30% se is_scaled |

- A única célula que dispara `pause` (R3) é **7d=🔴 + 3d=🔴 + !is_scaled**.

### R4 — Gate %MQL
- **Pré-condição:** `d14.leads ≥ 10` **e** `mql_min_pct` definido
- **Se** `d14.perc_mql < (mql_min_pct × 0.5)`:
  - **Se** `d14.zona = "verde"` → MANTER (lead barato compensa)
  - **Caso contrário** → **pause** (`playbook_rule = "R4"`)
- Lógica: CPMQL = CPL ÷ %MQL. Quando %MQL caiu mas CPL caiu junto, o
  CPMQL fica bom e o ad ainda é negócio. Só pausamos quando %MQL ruim
  E o CPMQL não compensa.

### R5 — Learning Phase (skip pré-LLM)
- Ads com `effective_status` em `LEARNING` ou `LEARNING_LIMITED` são
  filtrados ANTES de chegar ao agente (em `summarizeForAgent`). O agente
  não vê esses ads e portanto nunca propõe ação contra eles.

---

## Como o agente aplica este playbook

1. Carrega snapshots de cada ad ativo dos últimos 14 dias (3 janelas: 14d, 7d, 3d).
2. Busca targets do mês corrente em `meta_ads.growth_budgets`.
3. Filtra: cooldown 48h, whitelist, learning phase, ads sem produto reconhecido,
   produtos sem target.
4. Envia o payload pré-agregado pro LLM (gpt-4o) com este playbook como contexto.
5. LLM avalia R0 → R1 → R2 → R3 → R4 e chama `propose_action` apenas para
   matches. Cita números na justificativa.
6. Propostas vão pra UI agrupadas por produto, ordenadas por gravidade.
7. Após aprovação humana, executor executa via Graph API com defesa em profundidade
   (allowlist de operações, double-check whitelist, no-op se status já bate).

---

## Itens fora desta Fase 1 (referência futura)

- **Fase 2:** ajuste de orçamento (escala +10–30%, redução -10/20/30%)
- **Fase 3:** duplicação ABO→CBO quando ad acumula ≥10 MQLs com CPMQL na meta
- **Fase 4:** constraint analysis em cascata (CPM → CTR → Connect Rate → ...)
- Análise CAC após ≥3 vendas atribuídas ao criativo
- Análise de Hook Rate / Hold Rate / CTR como gatilho complementar
