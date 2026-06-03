---
name: turbo-fca-report
description: >
  Agent de relatório FCA (Fato, Causa, Ação) para análise de performance dos funis da Turbo Partners.
  Use esta skill SEMPRE que Ichino pedir para gerar relatório de performance, analisar funil, rodar FCA,
  fazer diagnóstico de constraint, ou qualquer variação: "roda o FCA", "FCA da semana", "FCA de hoje",
  "Morning Brief", "analisa o funil", "como tá o funil X", "diagnóstico", "relatório semanal",
  "o que tá quebrando no funil", "onde tá o constraint".

  Parâmetro `modo`:
   - `weekly` (default) — toda segunda 8h, cobre últimos 7 dias rolling, cascata completa + drill
     por campanha + drill por criativo + comparação W-1. Foco: decisão semanal.
   - `daily` — todos os dias 6h30, cobre últimas 24h, snapshot enxuto + delta D-1 + top 3 alertas
     SOP + 1-3 ações. Foco: leitura de 5min antes do trabalho começar.

  Roda no projeto Cortex (`/Users/ichino/Documents/Turbo/Cortex/`). Banco postgres do GCP tem
  todos os dados nativos: Meta Ads (`meta_ads.*`), Bitrix (`Bitrix.crm_deal`), metas em
  `meta_ads.growth_budgets`. Consome via Drizzle queries ou SQL direto.
---

# Turbo FCA Report Agent (v3)

Analisar performance dos funis da Turbo Partners usando Theory of Constraints + framework FCA, com output como task no ClickUp + cópia local versionada no projeto Cortex.

**Mudanças v3 (2026-05-20):**
- Tabela de metas corrigida: `meta_ads.growth_budgets` (não `metas` inventada da v2)
- Threshold SOP corrigido: zonas 90%/110% do CPMQL alvo (alinhado ao SOP real 27/03/2026)
- Fórmula Hook/Hold corrigida (alinhada ao código real do Cortex e à fonte de verdade Meta Ads): `video_3_sec_watched_actions/impressions` (Hook) e `video_thruplay_watched_actions/impressions` (Hold). NÃO usar `video_p25/video_p100` nem `video_play_actions`.
- No-show: validar fórmula real do app (`(RA-RR)/RA`) antes de aplicar ÷8; reportar valor real direto contra meta (≈ 5%, não 10%)
- Lookup hierárquico de metas: `funil=Creators` → fallback `funil=todos`
- Validação de Field IDs ClickUp em tempo de execução

---

## VISÃO GERAL

O agent recebe parâmetro `modo`, decide o período de análise, consulta o banco postgres do Cortex, escaneia o funil identificando o constraint pela cascata, faz drill down (só weekly), gera o relatório FCA estruturado, salva cópia local no projeto Cortex (git autopush) e cria task no ClickUp.

**Funis cobertos (v1):** Creators, E-Commerce.

**Excluídos da v1:** Estruturação Comercial (em reestruturação), Odonto (descontinuado).

**Outputs:**
- Cópia local: `/Turbo/Cortex/docs/fca/<arquivo>.md` (versionada via git autopush)
- Task no ClickUp lista `901322140780`, status `complete`

---

## PASSO 0 — Inicialização

### Inputs do agent

1. **`modo`** (obrigatório): `weekly` ou `daily`
   - Inferir de gatilhos:
     - "FCA da semana", "FCA semanal", "rodar o FCA" (sem qualificar), "/schedule segunda 8h" → `weekly`
     - "FCA de hoje", "Morning Brief", "FCA diário", "/schedule diário 6h30" → `daily`
   - Quando ambíguo → perguntar a Ichino antes de rodar
2. **Funis** (default: ambos): Creators + E-Commerce. Se Ichino especificar só 1, processar só esse.

### Período de análise

| Modo | Período principal | Período de comparação |
|---|---|---|
| `weekly` | Últimos 7 dias rolling (segunda 8h → cobre semana ISO anterior fechada) | 7 dias anteriores ao período principal (W-1) |
| `daily` | Últimas 24h (corte 6h00 → cobre dia anterior fechado) | 24h anteriores (D-1) |

### Fonte de dados

**Banco postgres do Cortex** (Google Cloud SQL, schema multi: `meta_ads`, `Bitrix`, `Conta Azul`, `Clickup`, `cortex_core`). Acesso via Drizzle ORM ou SQL direto.

Não usar:
- Meta Ads API direto (já está ETL-ado pro banco)
- Planilhas externas
- Bitrix24 UI

Antes de rodar queries, **confirmar conexão**. Se conexão falhar, abortar e pedir Ichino verificar `.env`.

---

## PASSO 1 — Carregar Metas (`meta_ads.growth_budgets`)

### Estrutura da tabela

```
meta_ads.growth_budgets
  mes        VARCHAR(7)   -- "2026-05"
  segmento   VARCHAR(20)  -- meta_ads | ads | mql | nao_mql | google_ads | instagram | youtube | linkedin
  funil      VARCHAR(100) -- Creators | Ecommerce | Geral | todos
  metricas   JSONB        -- { cpl, cpm, ctr, cpmql, percMqls, videoHook, videoHold, percRaMql, ... }
  UNIQUE(mes, segmento, funil)
```

### Lookup hierárquico (importante!)

Para cada métrica da cascata, fazer fallback em ordem:

1. Tentar `funil = <funil-alvo>, segmento = <segmento-relevante>, mes = <mes-do-periodo>`
2. Se não existe ou meta é 0/null, fallback para `funil = 'todos', segmento = <mesmo-segmento>, mes = <mesmo-mes>`
3. Se ainda não existe, fallback para o mês anterior (Creators tem dados só até 2026-04)
4. Se ainda não existe, marcar a métrica como "sem meta" e exibir 🔘 (cinza) na cascata, não classificar

### Segmentos por bloco da cascata

| Bloco | Segmento(s) |
|---|---|
| Topo Meta Ads (cpm, ctr, hook, hold, cpl, percMqls, cpmql, connectRate, taxaConversaoPagina, investimento) | `meta_ads` (ou `ads` se segmento `meta_ads` não existir para o funil) |
| Pré-vendas MQL (percRaMql, percNoShow MQL, percRrMql) | `mql` |
| Pré-vendas Não-MQL (percRaNmql, percNoShow Não-MQL, percRrNmql) | `nao_mql` |
| Resultado (novosClientes, faturamento, cac, aov) | `mql` + `nao_mql` agregados (somam novos clientes; ticket médio ponderado) |

### Query típica (lookup hierárquico em 1 query)

```sql
WITH ranked AS (
  SELECT
    segmento, funil, metricas,
    CASE WHEN funil = $1 THEN 1 ELSE 2 END AS prioridade
  FROM meta_ads.growth_budgets
  WHERE mes = $2 AND segmento = $3 AND funil IN ($1, 'todos')
)
SELECT metricas FROM ranked ORDER BY prioridade LIMIT 1;
```

Onde `$1 = 'Creators'`, `$2 = '2026-05'`, `$3 = 'meta_ads'`.

### Comparação realizado vs meta

| Status | Regra |
|---|---|
| 🟢 Saudável | Dentro ou melhor que a meta |
| 🟡 Atenção | Até 10% fora da meta |
| 🔴 Crítico | Acima de 10% fora da meta |
| 🔘 Sem meta | Métrica sem benchmark cadastrado — exibir valor, não classificar |

**Inversão de lógica:** Para `CPM, CPL, CPMQL, CAC, %No-show` "melhor" = menor. Para `CTR, Hook, Hold, ConnectRate, %MQL, %RA, %RR→Venda, TxConversaoLP` "melhor" = maior.

### No-show — bruto + corrigido lado a lado (v3)

O sistema mede no-show bruto que tende a ~80%. Convenção verbal do time é que o no-show "real" é ~10% (8× menor). Causa raiz **não está documentada** — provavelmente duplicação de eventos no Bitrix ou definição divergente.

**Comportamento v3:** Não esconder o bruto. Reportar AMBOS lado a lado e classificar 🟢/🟡/🔴 pelo corrigido, com nota explicativa.

```
%No-show MQL: 78,4% bruto / 9,8% corrigido (÷8) — meta 10% — 🟢
              ⚠️ Correção ÷8 é convenção verbal; raiz não documentada.
```

Se a primeira run mostrar que bruto ÷ 8 não bate com a leitura intuitiva do time, escalar pra investigação.

---

## PASSO 2 — Análise de Constraint (Cascata)

### Lógica principal

**Métrica norte de Growth: CPMQL** (custo por MQL). CAC é resultado conjunto (Growth + Pré-vendas + Vendas) — não é métrica controlável apenas por marketing. O FCA prioriza diagnosticar problemas que afetam CPMQL.

### Cascata por camada de responsabilidade

A cascata é dividida em 3 camadas. **Constraint principal só sai de Growth (1-10).** Constraint em 11-16 vira "Escalar pra pré-vendas/comercial". Camada 17-19 é resultado, não vira constraint principal.

**Importante:** Hook/Hold rate NÃO estão na cascata — são diagnóstico de criativo, não de funil.

```
 #   | Métrica                  | Camada           | Pergunta                              | Diagnóstico se 🔴
-----|--------------------------|------------------|---------------------------------------|------------------------------------
 1   | Investimento             | Growth           | Gastou o orçado?                       | Pacing — BM bloqueada, pausa
                                                                                              de aprovação, billing.
-----|--------------------------|------------------|---------------------------------------|------------------------------------
 2   | CPM                      | Growth           | Está acima da meta?                   | Custo de impressão — overlap de
                                                                                              adsets, saturação de público,
                                                                                              segmentação restrita, leilão.
                                                                                              NÃO mexer em criativo aqui.
-----|--------------------------|------------------|---------------------------------------|------------------------------------
 3   | CTR (outbound)           | Growth           | Está abaixo da meta?                  | Engajamento de criativo — copy,
                                                                                              hook, thumbnail, ângulo.
                                                                                              Cross-link SOP de criativos.
-----|--------------------------|------------------|---------------------------------------|------------------------------------
 4   | Connect Rate             | Growth           | Está abaixo da meta?                  | Cliques sumindo entre ad e LP —
                                                                                              tracking/pixel/UTM com erro,
                                                                                              LP com 4xx/5xx, lentidão mobile.
                                                                                              Validar com Devtools/Network.
-----|--------------------------|------------------|---------------------------------------|------------------------------------
 5   | Tx Conversão LP          | Growth           | Está abaixo da meta?                  | LP convertendo abaixo — copy/oferta
                                                                                              desalinhada com ad, form longo,
                                                                                              mobile vs desktop. Cruzar com bug
                                                                                              de utm_content em pages.turbo.
-----|--------------------------|------------------|---------------------------------------|------------------------------------
 6   | Leads                    | Growth           | Está abaixo da meta?                  | É efeito, não causa. Identificar
                                                                                              primeiro 🔴 nas etapas 1-5.
-----|--------------------------|------------------|---------------------------------------|------------------------------------
 7   | CPL                      | Growth           | Está acima da meta?                   | Derivado: CPL = Investimento/Leads.
                                                                                              Decompor: CPM ou Tx Conv LP?
-----|--------------------------|------------------|---------------------------------------|------------------------------------
 8   | MQLs                     | Growth           | Está abaixo da meta?                  | Volume × qualidade. Decompor:
                                                                                              MQLs = Leads × %MQL.
-----|--------------------------|------------------|---------------------------------------|------------------------------------
 9   | %MQL                     | Growth           | Está abaixo da meta?                  | Qualidade do lead — criativo atrai
                                                                                              perfil errado, segmentação ampla
                                                                                              demais, LP sem filtro/critério.
-----|--------------------------|------------------|---------------------------------------|------------------------------------
10   | CPMQL ⭐                 | Growth (NORTE)   | Está acima da meta?                   | Métrica norte de Growth. Decompor:
                                                                                              combinação de CPL × %MQL.
                                                                                              Onde está o pior delta?
-----|--------------------------|------------------|---------------------------------------|------------------------------------
11   | %RA MQL                  | Pré-vendas       | Está abaixo da meta?                  | Tempo de resposta SDR, script,
                                                                                              qualificação. ESCALAR.
-----|--------------------------|------------------|---------------------------------------|------------------------------------
12   | %No-show MQL             | Pré-vendas       | Está acima da meta?                   | Confirmação de reunião, lembrete
                                                                                              dia anterior, follow-up. ESCALAR.
-----|--------------------------|------------------|---------------------------------------|------------------------------------
13   | %RR→Venda MQL            | Pré-vendas       | Está abaixo da meta?                  | Closer: fit do produto, expectativa
                                                                                              desalinhada, sales script. ESCALAR.
-----|--------------------------|------------------|---------------------------------------|------------------------------------
14   | %RA Não-MQL              | Pré-vendas       | Idem #11                              | Idem #11. ESCALAR.
-----|--------------------------|------------------|---------------------------------------|------------------------------------
15   | %No-show Não-MQL         | Pré-vendas       | Idem #12                              | Idem #12. ESCALAR.
-----|--------------------------|------------------|---------------------------------------|------------------------------------
16   | %RR→Venda Não-MQL        | Pré-vendas       | Idem #13                              | Idem #13. ESCALAR.
-----|--------------------------|------------------|---------------------------------------|------------------------------------
17   | Novos Clientes           | Resultado        | Está abaixo da meta?                  | Soma do que está acima. Não vira
                                                                                              constraint principal — é leitura.
-----|--------------------------|------------------|---------------------------------------|------------------------------------
18   | Faturamento              | Resultado        | Está abaixo da meta?                  | Novos Clientes × Ticket Médio.
                                                                                              Se Clientes ok mas Faturamento 🔴:
                                                                                              mix/desconto/ticket.
-----|--------------------------|------------------|---------------------------------------|------------------------------------
19   | CAC                      | Resultado        | Está acima da meta?                   | Resultado conjunto Growth+Pré+Vendas.
                                                                                              Decompor: CPMQL × Funil de vendas.
```

### Regra do constraint (v3.7)

**Filosofia:** o FCA identifica TODOS os gargalos do funil, em qualquer camada. O que muda é o **tipo de ação** que o leitor de Growth toma.

- **Gargalo de Growth (1-10)** = primeiro 🔴 nessas etapas. Vira **ação executável** pelo time de marketing ("auditar adsets X", "refazer LP Y").
- **Gargalo de Pré-vendas (11-16)** = primeiro 🔴 nessas etapas. Vira **ação de comunicação** do Growth lead: agendar 1:1 com responsável de pré-vendas, alinhar plano de ação, definir prazo. Não some do relatório — aparece como gargalo identificado igualmente importante.
- **Gargalo em Resultado (17-19)** = sinaliza efeito (Novos Clientes, Faturamento, CAC). Em geral é leitura, não constraint primário. Se CAC 🔴 enquanto CPMQL 🟢, o problema está em pré-vendas/vendas — escalar.

**No FCA sempre listar:**
1. O gargalo principal de Growth (se houver 🔴 em 1-10)
2. O gargalo principal de Pré-vendas/Vendas (se houver 🔴 em 11-19)
3. Sinais positivos (oportunidades de scaling)

Se nenhuma camada tem 🔴: relatório "funil saudável", foca em scaling do que performa melhor.

### Realizado: queries-chave

**Meta Ads (CPM, CTR, Hook, Hold, CPL, CPMQL, %MQL, Investimento) — `meta_ads.meta_insights_daily`:**

```sql
SELECT
  SUM(spend) AS investimento,
  SUM(impressions) AS impressoes,
  SUM(clicks) AS clicks,
  SUM(outbound_clicks) AS outbound_clicks,
  SUM(spend) / NULLIF(SUM(impressions), 0) * 1000 AS cpm,
  SUM(outbound_clicks)::float / NULLIF(SUM(impressions), 0) AS ctr,
  SUM(video_3_sec_watched_actions)::float / NULLIF(SUM(impressions), 0) AS hook_rate,
  SUM(video_thruplay_watched_actions)::float / NULLIF(SUM(impressions), 0) AS hold_rate
FROM meta_ads.meta_insights_daily i
JOIN meta_ads.meta_campaigns c ON c.campaign_id = i.campaign_id
WHERE i.date_start BETWEEN $1 AND $2
  AND LOWER(c.campaign_name) LIKE '%creators%'
```

**Hook = `video_3_sec_watched_actions / impressions`** — pessoas que assistiram 3+ segundos de vídeo (Meta Ads `actions[].video_view`)
**Hold = `video_thruplay_watched_actions / impressions`** — pessoas que assistiram thruplay completo (≥15s ou vídeo todo se < 15s)

**NÃO usar:**
- `video_play_actions` — conta apenas o start do vídeo, não retenção de 3s
- `video_p25_watched_actions` / `video_p100_watched_actions` — métricas de etapa de retenção (25%/100% do vídeo), diferentes do conceito Hook/Hold da Meta

Fonte da verdade: `server/routes/growth.ts` linhas 1096-1101 e 2694-2695 do Cortex.

**Bitrix (Leads, MQL, %RA, %No-show, %RR→Venda) — `Bitrix.crm_deal`:**

Filtro de funil: `d.fnl_ngc ILIKE 'creators'`

```sql
SELECT
  COUNT(*) AS leads,
  COUNT(*) FILTER (WHERE mql = true) AS mqls,
  COUNT(*) FILTER (WHERE reuniao_agendada = true)::float
    / NULLIF(COUNT(*), 0) AS perc_ra,
  COUNT(*) FILTER (WHERE no_show = true)::float
    / NULLIF(COUNT(*) FILTER (WHERE reuniao_agendada = true), 0) AS perc_no_show_bruto,
  COUNT(*) FILTER (WHERE won = 'Y')::float
    / NULLIF(COUNT(*) FILTER (WHERE reuniao_realizada = true), 0) AS perc_rr_venda
FROM "Bitrix".crm_deal d
WHERE d.date_create BETWEEN $1 AND $2
  AND d.fnl_ngc ILIKE 'creators'
```

(Adaptar nomes de coluna ao schema real — `mql`, `reuniao_agendada`, `no_show` podem ser fields customizados do Bitrix com nomes diferentes; investigar antes da primeira run.)

### Regras de interpretação

- **Constraint fora de Growth**: Se está em pré-vendas, no-show ou vendas, **registrar explicitamente**. Growth identifica e escala pra dona da área.
- **Constraints múltiplos**: Constraint principal = **primeiro 🔴** na cascata. Se 🔴 são independentes (áreas separadas), reportar ambos.
- **Volume baixo**: <20 MQLs no período → indicar "amostra pequena, conclusões preliminares".
- **MQL vs Não-MQL**: Analisar SEPARADAMENTE.
- **Métricas 🔘 sem meta**: Listar no final do FATO como "métricas sem benchmark — gap de planejamento".

---

## PASSO 3 — Drill Down por Campanha

**Só executa no modo `weekly`** e se há constraint identificado.

### Lógica

1. Rankear campanhas pela métrica do constraint (filtro funil via `campaign_name LIKE '%creators%'`)
2. Identificar campanha com:
   - Pior performance na métrica do constraint
   - Maior % do budget alocado (maior impacto)
3. Identificar campanha performando bem (oportunidade de scaling)

---

## PASSO 4 — (REMOVIDO em v3.2)

Drill por criativo foi removido do FCA — relatório fica mais objetivo e focado no diagnóstico do funil. Análise por criativo continua disponível **fora do FCA** (página de Criativos, scripts ad-hoc como `top-ads-analise.ts`, SOP de criativos).

Cross-link com SOP de criativos permanece **se** a ação derivada do constraint envolver pausar/escalar — basta citar a regra (90/110% CPMQL alvo), sem listar criativos no relatório.

---

## PASSO 5 — Gerar Relatório FCA

### Estrutura — Modo `weekly` (5W) — **constraint-first**

A estrutura é "constraint-first": o leitor entende em <30 segundos qual é o constraint, por quê, e o que fazer. Dados completos ficam no apêndice. NÃO repetir métricas saudáveis na narrativa.

```markdown
# [FCA] {Funil} — Semana 2026-W{semana} ({data_inicio}-{data_fim}/{mês})

**Período:** {de} → {ate} · **vs W-1:** {de_prev} → {ate_prev} · **Gerado em:** {data} · **Skill:** v{versão}

---

## Cabeçalho do relatório

Sem H1 (`# Título...`) — o título já está no nome da task no ClickUp.
Sem linha "Skill: v3.X" — serve só pra debug.

Início do relatório em 2 partes:

1. **Headline `## Contexto`** + bullets de período (Funil, Acumulado do mês, Semana fechada, Comparação vs)
2. Resumo executivo (PRIMEIRA seção analítica) vem **antes** do Pacing

```
## Contexto

- **Funil:** Creators
- **Acumulado do mês:** 1-20/mai
- **Semana fechada:** 11-17/mai (W-20)
- **Comparação vs:** 4-10/mai (W-19)
```

---

## Ordem das seções

1. Contexto (cabeçalho)
2. **Resumo executivo** ← responde "o que está acontecendo" em 30s
3. **Pacing da meta** ← responde "vamos bater a meta?" em 10s
4. Métricas Inbound — Consolidado (MTD)
5. Comparação semanal
6. Gargalos identificados
7. Ações desta semana
8. Sinais positivos
9. Impedimentos

---

## Resumo executivo

(Bullets curtos com quebras de linha. 3-4 itens. Cada um: 1 frase enxuta.)

- **Growth:** {gargalo de marketing em 1 frase com número-chave}
- **Pré-vendas/Vendas:** {gargalo fora de Growth em 1 frase, se houver}
- **Ação prioritária:** {a alavanca mais alta da semana}
- **Sinal positivo:** {oportunidade ou destaque, opcional}

---

## Pacing da meta (vem DEPOIS do Resumo executivo)

**Razão de ser:** responder em <10s: *"estamos no pacing pra bater a meta do mês?"*. A meta principal a observar é **CAC** (resultado conjunto Growth + Pré-vendas + Vendas). CPMQL aparece como métrica controlável de Growth.

Estrutura:

```markdown
## Pacing da meta

**{dias}/{dias_mês} dias do mês ({pct}%).** Resposta direta: **{SIM/NÃO/PARCIAL} vamos bater {CAC ou métrica em foco}.**

| Métrica | MTD | Meta mensal | Projeção fim de mês | Δ |   |
|---|---:|---:|---:|---:|:---:|
| **CAC** ⭐ | {realizado} | {meta} | {projecao} | {delta}% | 🟢/🟡/🔴/🔘 |
| CPMQL ⭐ | {realizado} | {meta} | {projecao} | {delta}% | 🟢/🟡/🔴 |
| MQLs | ... | ... | ... | ... | ... |
| Leads | ... | ... | ... | ... | ... |
| Investimento | ... | ... | ... | ... | ... |

**Diagnóstico de pacing:**
- {Quantas vendas/MQLs/leads faltam. Ritmo necessário vs ritmo atual.}
- {Trade-off real, se houver: "Pra fechar CAC e investimento juntos, próximos X dias precisam Y".}
```

### Cálculo da projeção (linear simples)

- **Volume** (Leads, MQLs, Investimento, Vendas, Faturamento): `projecao_mes = realizado_MTD / dias_MTD × dias_do_mês`
- **Taxa/custo** (CAC, CPMQL, CPM, CPL, %MQL): valor atual MTD ≈ projeção (assume comportamento estável)
- **Pacing temporal**: `dias_MTD / dias_do_mês × 100`

### Regras de status

- 🟢 Vai bater: projeção ≤ 5% pior que meta
- 🟡 Borderline: 5-15% pior
- 🔴 Não vai bater: > 15% pior
- 🔘 Sem meta cadastrada — listar no "Impedimentos" como gap a resolver

### Métricas obrigatórias no Pacing

1. **CAC** (meta final da Turbo — resultado conjunto)
2. **CPMQL** (métrica controlável de Growth)
3. **MQLs** (volume da meta de Growth)
4. **Leads** (volume topo — indica se MQL vai vir)
5. **Investimento** (controle de budget — risco de estouro)

CPL, CPM, CTR, Hook e demais ficam na Consolidada, não no Pacing.

---

## Métricas Inbound — Consolidado

**Período:** acumulado do mês (ex: 1-20/mai). Mostra o estado do funil somado desde o início do mês.

Tabela enxuta. Cabeçalho: `# | Métrica | Real | Meta | Δ | <emoji>`. Camada vira **linha separadora dentro da tabela** (header de bloco em negrito), não coluna.

Formatação:
- Valores monetários: `R$ 49.812` (sem centavos pra MTD; com centavos só em CPM/CPL/CPMQL)
- Percentuais: 1 casa decimal
- Δ: sempre com sinal `+`/`-`, 1 casa decimal

---

## Comparação semanal

Tabela curta (~8-10 linhas) comparando a semana ISO fechada vs a anterior.

**Cabeçalho com datas explícitas** pra quem lê entender o período sem precisar saber o que é "W-20":

```
| Métrica | W-20 (11-17/mai) | W-19 (4-10/mai) | Δ |
```

Só métricas-chave: CPM, CTR, CPL, **CPMQL**, Leads, MQLs, %No-show MQL, Vendas, Faturamento.

---

## Gargalos identificados

### Growth ({métrica de Growth em crise})
**{Métrica} ({realizado} vs meta {meta}, {desvio})** — etapa {N} da cascata.
(1 parágrafo curto. Por que esse é o gargalo de Growth — como ele arrasta o resto. Sustentar com 2-3 dados.)

### Pré-vendas / Vendas ({métrica fora de Growth em crise}, se houver)
**{Métrica} ({realizado} vs meta {meta}, {desvio})** — etapa {N} da cascata.
(1-2 linhas. Que time precisa atacar. Não detalhar como resolver — quem detalha é o time correspondente.)

(Se uma camada não tem 🔴, omitir a subseção dela.)

---

## Ações desta semana

(Máximo 3-4 ações por camada. Diferenciar tipo:)

**Growth (executar com o time de marketing):**
- [ ] {ação executável 1 — específica, métrica afetada, critério de sucesso}
- [ ] {ação 2}

**Pré-vendas / Vendas (sua ação = comunicação):**
- [ ] {Agendar 1:1 com {responsável pré-vendas} até {data}. Levar evidência: {dados}. Acordar plano de ação até {prazo}.}

---

## Sinais positivos (contraponto)

(Opcional, só se houver. 1-2 linhas. Não floreio — só destacar o que está indo bem e merece scaling.)

---

## Impedimentos

(Lista numerada. Metas faltantes, hacks de cálculo, fontes de erro conhecidas, links com bugs conhecidos.)

```

**Observação importante:** O formato constraint-first SUBSTITUI o antigo FATO/CAUSA/AÇÃO. Não gerar essas seções separadas — a narrativa de TL;DR + Constraint + Ações já cumpre o papel de forma mais enxuta. O "FATO" está implícito na tabela do apêndice; o "CAUSA" no parágrafo do constraint; o "AÇÃO" na lista de ações.

### Modo `daily` — DESATIVADO em v3.6

V1 do FCA roda apenas **weekly** (toda segunda). Daily entra depois quando o weekly estiver maduro. Estrutura do daily preservada na v2 da skill se precisar reativar.

### Regras de escrita

**TL;DR:** 2-3 linhas. Primeira identifica o constraint, segunda quantifica o impacto, terceira aponta a ação prioritária. Sem floreio.

**Constraint:** 1 parágrafo curto sustentado por 2-3 dados. Não enumerar tudo — só o que explica POR QUE essa métrica é o constraint principal. Se constraint secundário está fora de Growth, 1-2 linhas direto a quem escalar.

**Ações:** específicas e verificáveis. Citar threshold SOP quando criativo. Máximo 3-4 weekly / 2-3 daily. Ação genérica ("monitorar X") não conta — substituir por ação concreta com critério de sucesso. Se constraint é fora de Growth: "Escalar para {time} com evidência de {dados}".

**Sinais positivos:** opcional. Só se houver algo que merece scaling. 1-2 linhas. Não usar pra "balancear o relatório" — só pra destacar oportunidade real.

**Apêndice:** dado denso vai aqui. Tabela Consolidada com 22 etapas, comparação W-1 enxuta, caveats técnicos. O leitor que quer auditar abre; o leitor de rotina ignora.

**Tom:** PT-BR direto, sem floreio. Mesmo registro do `_changelog.md`. Nunca repetir números entre seções — se está na tabela, não está no parágrafo (ou vice-versa).

---

## PASSO 6 — Criar Task no ClickUp

### Configuração

- **Lista ID:** `901322140780`
- **Nome:**
  - Weekly: `[FCA] {Funil} - Semana 2026-W{semana} ({data_inicio}-{data_fim}/{mês})`
  - Daily: `[FCA Daily] {Funil} - {dia}/{mês}/{ano}`
- **Responsável:** Ichino (`55120346`)
- **Status:** `complete`
- **Descrição:** Relatório completo em markdown (Passo 5)

### Validação de campos customizados (v3)

**ANTES** de criar a task, validar os field IDs via `clickup_get_custom_fields` na lista. Se algum ID mudou, abortar e avisar Ichino.

| Campo | Field ID esperado | Tipo | Como preencher |
|---|---|---|---|
| Canal | `f1269c53-1ee0-40bf-8796-2961f0ca767b` | labels | Meta Ads: `2b7e74d1-78ec-4d5b-a0c8-553b64d2d1c0` |
| Funil | `b036cff5-6866-45d5-b1a4-19366e32a532` | labels | Creators: `d96d739e-a3f0-4c2e-9edb-5e22a0d84d05` / Ecommerce: `62a087fc-73a5-4bbd-bddc-aaa9caeb1c5d` |
| Tipo | `c58c4fd0-8a03-400f-ac81-5316643bd6ed` | labels | Sempre Relatório de Mídia: `3ca91709-20ed-4c67-9e60-1a5525f522d9` |
| Date | `8cfba79a-d243-4911-8563-fd39c2523357` | date | Timestamp ms |

### Múltiplos funis

Se rodando os 2 funis: **UMA task por funil**. Cada funil = FCA independente — responsável e ações distintas.

### Subtasks atribuídas (v3.6)

Cada **Ação desta semana** do relatório vira **uma subtask da task FCA**, atribuída ao responsável correspondente. Forçar accountability.

**Mapeamento responsável → tipo de ação:** PENDENTE (a definir com Ichino). Estrutura esperada:

| Tipo de ação | Responsável padrão |
|---|---|
| Auditar overlap adsets / segmentação / CPM | Gestor de Performance |
| Auditar criativo / CTR / pausa-escala | Gestor de Performance + Designer |
| Auditar LP / Tx Conv / Connect Rate | Dev + Designer (CRO) |
| Auditar tracking / pixel / UTM | Dev |
| Cadastrar metas / planejamento | Ichino |
| (qualquer ação de pré-vendas) | NÃO vira subtask aqui — ver "Escalonamento" abaixo |

Status inicial da subtask: `to do`. Status da task FCA principal: `complete` (snapshot do relatório está fechado, ações abertas estão nas subtasks).

### Escalonamento fora de Growth (v3.6)

Se houver constraint secundário em etapas 11-16 (pré-vendas/comercial):

- Criar **task separada** na lista do comercial/pré-vendas (lista ID e responsável: PENDENTE — a definir)
- Título: `[Escalonamento FCA] {Funil} W{semana} — {métrica em crise}`
- Descrição: contexto + métricas + link da task FCA principal + `@menção` do responsável
- Nunca colocar ações de pré-vendas como subtasks da task FCA (manter separação de área)

---

## PASSO 7 — Cópia local + git-autopush

### Path

| Modo | Path |
|---|---|
| weekly | `/Turbo/Cortex/docs/fca/2026-W{semana}_{funil}_weekly.md` |
| daily | `/Turbo/Cortex/docs/fca/{ano}-{mês}-{dia}_{funil}_daily.md` |

Exemplos:
- `docs/fca/2026-W20_creators_weekly.md`
- `docs/fca/2026-05-20_creators_daily.md`

### Auto-push

Disparar workflow descrito em `agents/git-autopush-SKILL.md`:

```
git add docs/fca/<arquivo>.md
git commit -m "feat(fca): {modo} {funil} {periodo}"
git push
```

**Atenção:** git-autopush bloqueia push direto em `main`/`staging`. Para FCA recorrente, manter branch própria (ex: `feature/fca-reports` ou usar a branch do PR aberto).

Conventional Commits (regra do `CLAUDE.md` do Cortex).

---

## REGRAS GERAIS

1. **Theory of Constraints primeiro:** Escanear funil INTEIRO antes de concluir constraint.
2. **Dados reais only:** Nunca inventar. Se falta, indicar e ajustar.
3. **Metas hierárquicas:** Tenta funil-específico, fallback `todos`, depois mês anterior. Sem meta → 🔘.
4. **Um constraint por vez:** Foco no principal. Mencionar secundários.
5. **Separar MQL de Não-MQL:** Pré-vendas pode divergir.
6. **Linguagem direta:** Relatório é pra decisão, não storytelling.
7. **Cross-link com SOP:** Citar zonas reais (90/110% CPMQL).
8. **No-show transparente:** Bruto + corrigido lado a lado, classificar pelo corrigido com nota.
9. **Comparação W-1 obrigatória** no weekly.
10. **Validar Field IDs ClickUp** antes do create task.
11. **Perguntar se faltar info crítica:** Conexão falha, tabela esperada não existe → abortar.

---

## Execução via endpoint REST (v3.15)

Além da invocação manual via conversa com o Claude, o FCA tem **endpoint HTTP** próprio.

**Endpoints:**

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/api/fca/health` | nenhum | Retorna versão, endpoint disponível, se token está configurado |
| `POST` | `/api/fca/run` | Bearer token | Gera relatório + opcionalmente cria task ClickUp |

**Auth:** header `Authorization: Bearer ${FCA_API_TOKEN}`. Token configurado em `.env` do servidor.

**Body do POST:**
```json
{
  "funil": "Creators",
  "createTask": true
}
```

- `funil`: `"Creators"` (default) — `"Ecommerce"` pendente implementação
- `createTask`: `true` cria task no ClickUp; `false` só retorna markdown

**Response:**
```json
{
  "ok": true,
  "funil": "Creators",
  "periodos": { "semana": {...}, "semanaPrev": {...}, "mtd": {...}, "diasMTD": 20, "diasMes": 31 },
  "task": { "id": "86ahm3dzm", "url": "https://app.clickup.com/t/..." },
  "markdown": "## Contexto\n..."
}
```

**Exemplo curl:**
```bash
curl -X POST https://cortex.turbopartners.com.br/api/fca/run \
  -H "Authorization: Bearer $FCA_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"funil":"Creators"}'
```

**Quando usar:** automação (schedule cron remoto), integração com outras ferramentas, dispara workflow externamente.

**Quando NÃO usar:** rotina manual (continua mais simples falar "roda o FCA" com o Claude).

---

## SCHEDULE (configurar depois de validar manual 1× cada modo)

```
# Weekly — segunda 8h
/schedule cron "0 8 * * 1" tz America/Sao_Paulo
prompt: "Roda FCA modo weekly nos funis Creators e E-Commerce conforme turbo-fca-report SKILL."

# Daily — todo dia 6h30
/schedule cron "30 6 * * *" tz America/Sao_Paulo
prompt: "Roda FCA modo daily nos funis Creators e E-Commerce conforme turbo-fca-report SKILL."
```

Alternativa robusta: registrar como cron job em `server/index.ts` chamando endpoint REST.

---

## CHANGELOG DA SKILL

- **v3.15 (2026-05-21):** Documentação do endpoint REST (`POST /api/fca/run` + `GET /api/fca/health`). Skill agora pode ser executada de 2 formas: (1) conversa com Claude — mesmo gatilhos de antes; (2) requisição HTTPS direto (pra automação/schedule cron). Comportamento idêntico — endpoint usa as mesmas queries e formato de markdown que a skill descreve.
- **v3.14 (2026-05-21):** (1) **Nomenclatura alinhada à planilha Planejamento de Metas** (`client/src/lib/metasBudgetConfig.ts`): "Novos Clientes" → "Negócios Ganhos"; "Faturamento" → "Faturamento Total"; "Ticket Médio" → "Ticket Médio Geral"; "CAC" desmembrado em **"CAC - Negócios"** (invest/negócios) e **"CAC - Contrato"** (invest/contratos). (2) Adicionadas métricas que faltavam no Consolidado: Faturamento Implantação, Faturamento Aceleração, Ticket Médio Implantação, Ticket Médio Aceleração, Lead Time. (3) **Correção crítica de filtros temporais**: Negócios Ganhos / Faturamento agora filtram só por `data_fechamento BETWEEN` (não por `created_at`); RA / RR / No-show filtram por `data_reuniao_agendada/realizada BETWEEN` (não por `created_at`). Antes, o filtro errado inflava No-show e subestimava Negócios.
- **v3.13 (2026-05-21):** Ordem Contexto → Resumo executivo → Pacing → resto. Headline `## Contexto`. Pacing focado em CAC. "Limitações" → "Impedimentos".
- **v3.12 (2026-05-21):** Pacing da meta adicionado. CPMQL como métrica norte de Growth + projeção linear pro fim do mês.
- **v3.11 (2026-05-21):** Linguagem mais clara. H1 do relatório removido (título já está no nome da task ClickUp). "Skill: v3.X" removido do header. Cabeçalho em bullets. "MTD" → "acumulado do mês". "Caveats e gaps técnicos" → "Impedimentos".
- **v3.10 (2026-05-21):** "TL;DR" → "Resumo executivo". "Consolidado" → "Métricas Inbound — Consolidado". Datas explícitas na comparação semanal. "Aprofundado por plataforma" removido.
- **v3.9 (2026-05-21):** TL;DR em bullets. Tabela Consolidada com colunas enxutas. Período da Consolidada virou MTD. Comparação semanal W vs W-1.
- **v3.8 (2026-05-21):** Layout sem `<details>/<summary>` (ClickUp não renderiza HTML colapsável). Tabela Consolidada e Comparação W-1 movidas pra ANTES dos Gargalos.
- **v3.7 (2026-05-21):** Filosofia do constraint ajustada. FCA agora identifica TODOS os gargalos (Growth + Pré-vendas + Vendas/Resultado). Camada define tipo de ação: Growth = executável; Pré-vendas/Vendas = ação de comunicação. Estrutura "Gargalos identificados" por camada.
- **v3.6 (2026-05-21):** Cascata reordenada — Connect Rate e Tx Conv LP vêm ANTES de CPL. Cascata dividida em 3 camadas. CPMQL marcado como métrica norte de Growth. Diagnóstico por etapa expandido (playbook). Subtasks por ação atribuídas a responsáveis. Modo daily desativado.
- **v3.5 (2026-05-20):** Hook rate e Hold rate removidos da cascata do funil. São métricas de diagnóstico de criativo, não de funil — aparecem em análise por ad/campanha, nunca no FCA. Argumento "não é problema de criativo" agora sustentado por CTR e %MQL.
- **v3.4 (2026-05-20):** Formato **constraint-first**. Substitui o antigo FATO/CAUSA/AÇÃO por TL;DR (2-3 linhas) + Constraint + Ações + Sinais Positivos no topo. Dados completos vão pra apêndice colapsável (`<details>`).
- **v3.3 (2026-05-20):** Estrutura de tabelas reorganizada. 4 tabelas separadas consolidadas em UMA única "Consolidado" ordenada pela cascata. "Aprofundado por plataforma" só gerada se funil rodar em múltiplas plataformas. Cascata como tabela separada removida.
- **v3.2 (2026-05-20):** Drill por criativo removido — FCA fica mais objetivo, foca no diagnóstico do funil. Análise por criativo continua na página de Criativos e scripts ad-hoc.
- **v3.1 (2026-05-20):** Fórmula Hook/Hold corrigida — usar `video_3_sec_watched_actions/impressions` (Hook) e `video_thruplay_watched_actions/impressions` (Hold). v3 estava usando `video_p25/video_p100` por engano. Alinha com `server/routes/growth.ts` e fonte de verdade Meta Ads. CTR também alinhado (`outbound_clicks/impressions`).
- **v3 (2026-05-20):** Tabela de metas corrigida para `meta_ads.growth_budgets` (não `metas` inventada). Threshold SOP alinhado ao real (90/110% CPMQL alvo). Hook/Hold com fórmulas explícitas (mas erradas — corrigidas em v3.1). No-show validado contra fórmula real do Cortex. Lookup hierárquico (funil → todos). Validação de Field IDs ClickUp.
- **v2 (2026-05-16):** Migração pro Cortex (banco postgres). Modo `daily`. Hook + Hold na cascata. Drill criativo via benchmarks históricos. Comparação W-1. Cross-link SOP. Correção no-show ÷8. Cópia local + git autopush.
- **v1 (2026-05-11):** Versão original. Input manual CSV. Cascata 20 etapas. Output só ClickUp.
