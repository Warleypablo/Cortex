# Design — Dashboard de LT, LTV e Churn (por contrato e por cliente)

**Data:** 2026-06-02
**Status:** Aprovação pendente
**Autor:** Warleypablo + Claude

---

## 1. Objetivo

Construir um dashboard confiável no Cortex que responda, com base nos dados do
ClickUp (`cup_contratos`, `cup_clientes`, `cup_churn`):

- **LT (lifetime)** — quanto tempo os contratos/clientes permanecem.
- **LTV (lifetime value)** — quanto cada contrato/cliente vale ao longo da vida.
- **Churn** — quanto de receita recorrente é perdido, por tipo de contrato.
- **Diagnóstico** — por que os clientes cancelam (motivos, evitabilidade).

Cobre os quatro objetivos definidos no brainstorming: valor econômico (LTV),
saúde de carteira/retenção, benchmark por tipo de contrato e diagnóstico de churn.

---

## 2. Achados da investigação (o terreno real)

Investigação rodada direto no banco de produção (`dados_turbo` @ GCP). Números reais:

### 2.1 Volume e granularidade
- `cup_contratos`: **2.682 contratos** (1 linha = 1 subtask), **1.387 clientes**
  (média 1,93 contratos/cliente, máx. 11).
- `cup_churn`: **4.154 linhas** — tabela curada/histórica de churn. Cruza com
  `cup_contratos` via `cup_churn.task_id = cup_contratos.id_subtask`
  (2.679 dos 2.682 batem).

### 2.2 Armadilha 1 — Recorrente vs Pontual (~40% são pontuais)
- **1.506 recorrentes** (`valorr>0`) — têm MRR, fazem sentido de lifetime.
- **1.053 pontuais** (só `valorp>0`) — entregas one-shot (Creators, Ecommerce,
  Landing Page, Site, ID Visual). **Não têm "lifetime" recorrente.**
- Decisão: LT/LTV/churn calculados **só sobre recorrentes**; pontuais entram
  **apenas no LTV do cliente** como receita adicional.

### 2.3 Armadilha 2 — Datas sujas (19-22% de LT negativo)
- `data_criado` = `data_inicio` em **100%** dos contratos (irrelevante qual usar).
- Usando `data_inicio` → `data_encerramento`, **258 de 1.183 encerrados (22%)**
  dão **LT negativo** (até −19 meses): a task foi criada/preenchida no ClickUp
  depois do encerramento real (migração tardia).
- **Excluir os negativos muda o LT médio de 1,9 → 5,1 meses.** Os negativos
  afundavam a média.

### 2.4 Armadilha 3 — Fontes "factuais" de início NÃO são viáveis
Testadas e descartadas como base de início do lifetime:
- **1ª parcela paga (Conta Azul):** `caz_parcelas` só tem receita **desde
  10/set/2025** (~9 meses), cobertura de **39%**, ainda gera 114 negativos. ❌
- **Snapshots (`cup_data_hist`):** só desde **17/nov/2025** (~6,5 meses). ❌
- **`cup_churn.data_inicio_projeto`:** vai a 2022 mas cobre só 61%; combinar com
  `data_inicio` reduz apenas 1 caso negativo — não compensa a complexidade.

Conclusão: **não existe fonte factual/financeira de início confiável**. Todas as
datas vêm de campos manuais do ClickUp. A melhor base é `data_inicio` (100% de
cobertura) com exclusão dos inconsistentes.

### 2.5 Armadilha 4 — Campo `lt` da `cup_churn` é inutilizável
A coluna `cup_churn.lt` mistura valores em meses (`0.5`, `0.7`) com **timestamps
epoch em milissegundos** (`1780297200000`). Custom field do ClickUp com fórmula
quebrada. **Ignorar — recalcular o LT.**

### 2.6 Viés de censura (base jovem)
- Quase nenhum contrato recorrente é pré-2024 (só 4); 349 em 2024, 1.161 em 2025+.
- **310 contratos ativos já vivem 6,0 meses em média e continuam** — esse LT em
  curso não entra na média de encerrados. Por isso medimos LT de **ativos** e
  **cancelados** separadamente.

### 2.7 Números-prova (já calculáveis hoje)

**LT/LTV por produto (recorrentes encerrados, datas válidas):**

| Produto | Encerrados | LT médio | LTV médio |
|---|---|---|---|
| Performance | 477 | 4,6 m | R$ 10.686 |
| Social Media | 217 | 4,6 m | R$ 9.482 |
| Creators | 112 | 3,9 m | R$ 10.008 |
| Broadcast | 48 | 6,1 m | R$ 9.945 |

**LT por cliente:** ativos **6,6 m** (mediana 5,5) vs. cancelados **4,9 m** (mediana 3,8).
**LTV médio por cliente: R$ 18.952** (R$ 13.053 recorrente + R$ 5.899 pontual), 1.134 clientes.

**Taxonomia de motivos de churn** (`cup_churn.motivo_cancelamento`): Falta de
Resultado (211), Erro na Venda (181), Sem Orçamento (146), Erro Operacional (129),
Inadimplente (103), Pausa/Reestruturação (94), Cliente Impaciente (79),
Internalizou Serviço (78), Troca de Agência (54)...

---

## 3. Metodologia (decisões fechadas)

| Dimensão | Decisão |
|---|---|
| **Universo de LT/LTV/churn** | Recorrentes (`valorr>0`). Pontuais só no LTV do cliente. |
| **Início do lifetime** | `data_inicio`. Excluir os contratos com `data_fim < data_inicio` (flag `data_inconsistente`). |
| **Fim do lifetime** | Cancelado → `COALESCE(data_encerramento, ultimo_dia_operacao)`. Ativo → `CURRENT_DATE` (LT em curso). |
| **Status ativo** | `ativo`, `onboarding`, `pausado`, `em cancelamento`, `triagem`. |
| **Status churned** | `cancelado/inativo`. |
| **LT** | Por contrato e por cliente, segmentado em **ativos** (em curso) e **cancelados** (fechado). Em dias e meses (÷30,44). |
| **LTV contrato** | `valorr × lt_meses`. |
| **LTV cliente** | Σ LTV recorrente dos contratos + Σ `valorp` (pontuais). |
| **LT cliente** | `min(data_inicio)` do cliente até o último fim (ou hoje se ≥1 contrato ativo). |
| **Churn rate** | **Revenue churn mensal**: MRR perdido no mês ÷ MRR ativo no início do mês. Série temporal com tendência. |
| **Benchmark** | Por produto (e squad; plano via `cup_churn`). |
| **Diagnóstico** | `cup_churn`: `motivo_cancelamento`, `submotivo_cancelamento`, `evitabilidade_churn`, `possibilidade_retencao`, `reteve`. |
| **Tratamento de inconsistentes** | LT/LTV = NULL; contabilizados à parte e reportados com transparência (nunca escondidos). |

---

## 4. Arquitetura (híbrida: view canônica SQL + endpoints TS)

### 4.1 Camada SQL — fonte da verdade

**`cortex_core.vw_lt_contratos`** — view canônica por contrato. Resolve as
armadilhas **uma única vez** e é reutilizada por todo o resto.

```sql
CREATE OR REPLACE VIEW cortex_core.vw_lt_contratos AS
WITH base AS (
  SELECT
    co.id_subtask, co.id_task,
    co.servico, co.produto, co.squad, co.vendedor, co.cs_responsavel, co.responsavel,
    co.status, co.valorr, co.valorp, co.data_inicio, co.data_encerramento,
    ch.ultimo_dia_operacao, ch.data_solicitacao_encerramento,
    ch.motivo_cancelamento, ch.submotivo_cancelamento,
    ch.evitabilidade_churn, ch.possibilidade_retencao, ch.reteve,
    ch.cluster, ch.tipo_negocio, ch.plano,
    CASE WHEN co.valorr > 0 THEN 'recorrente'
         WHEN co.valorp > 0 THEN 'pontual'
         ELSE 'sem_valor' END AS tipo_receita,
    COALESCE(co.data_encerramento, ch.ultimo_dia_operacao) AS data_fim,
    (co.status IN ('ativo','onboarding','pausado','em cancelamento','triagem')) AS is_ativo,
    (co.status = 'cancelado/inativo') AS is_churned
  FROM "Clickup".cup_contratos co
  LEFT JOIN "Clickup".cup_churn ch ON ch.task_id = co.id_subtask
),
calc AS (
  SELECT b.*,
    (b.data_fim IS NOT NULL AND b.data_fim < b.data_inicio) AS data_inconsistente,
    CASE
      WHEN b.data_inicio IS NULL THEN NULL
      WHEN b.is_ativo THEN (CURRENT_DATE - b.data_inicio)
      WHEN b.data_fim IS NOT NULL AND b.data_fim >= b.data_inicio THEN (b.data_fim - b.data_inicio)
      ELSE NULL
    END AS lt_dias
  FROM base b
)
SELECT c.*,
  ROUND((c.lt_dias / 30.44)::numeric, 2) AS lt_meses,
  CASE WHEN c.tipo_receita = 'recorrente' AND c.lt_dias IS NOT NULL
       THEN ROUND((c.valorr * c.lt_dias / 30.44)::numeric, 2) END AS ltv_recorrente
FROM calc c;
```

**`cortex_core.vw_ltv_clientes`** — agrega por `id_task` (cliente): LT do
relacionamento (min início → último fim/hoje), LTV recorrente realizado/em curso,
LTV pontual, flag ativo/cancelado, contagem de contratos.

**`cortex_core.vw_churn_mensal`** — revenue churn por mês reconstruído por datas
(via `generate_series`): para cada mês, `mrr_perdido` = Σ`valorr` de contratos com
`data_fim` no mês; `mrr_ativo_inicio` = Σ`valorr` de contratos vivos no 1º dia do mês.
*Limitação registrada: depende da qualidade das datas; a partir de nov/2025 pode
ser cross-validado contra `cup_data_hist`.*

**`cortex_core.vw_churn_diagnostico`** (v2) — agregações de motivo/submotivo/
evitabilidade/retenção a partir de `cup_churn`.

### 4.2 Camada backend (TypeScript / Drizzle)
Endpoints finos sob `/api/lt-ltv-churn/*` que aplicam filtros (período, produto,
squad, recorrente/pontual), agregam e formatam. Toda a derivação pesada vem das views.

- `GET /api/lt-ltv-churn/overview` — KPIs gerais.
- `GET /api/lt-ltv-churn/contratos` — LT/LTV por contrato (ativos/cancelados).
- `GET /api/lt-ltv-churn/clientes` — LT/LTV por cliente.
- `GET /api/lt-ltv-churn/benchmark` — por produto.
- `GET /api/lt-ltv-churn/churn-mensal` — série temporal.
- `GET /api/lt-ltv-churn/diagnostico` — motivos (v2).

### 4.3 Camada frontend (React + Recharts)
Página nova `/lt-ltv-churn`, dark/light mode obrigatório, filtros globais no topo,
React Query para estado servidor, padrões visuais do app existente.

---

## 5. Estrutura do dashboard (faseada)

### v1 — Núcleo
1. **Visão geral** — cards: MRR ativo, LT médio (ativos/cancelados), LTV médio por
   cliente, revenue churn do mês.
2. **LT & LTV por contrato** — distribuição, ativos vs cancelados, tabela com drill.
3. **LT & LTV por cliente** — agregado, com pontual somado.
4. **Benchmark por produto** — LT, LTV e churn lado a lado (tabela + barras).
5. **Revenue churn mensal** — linha de tendência.
6. **Filtros globais** — período, produto, squad, recorrente/pontual.
7. **Aviso de qualidade** — banner discreto informando N contratos excluídos por
   data inconsistente (transparência).

### v2 — Enriquecimento
8. **Curva de retenção (cohort)** — LT honesto incorporando ativos
   (reusar/estender `vw_cohort_contratos`).
9. **Diagnóstico de churn** — motivos, submotivo, evitabilidade, possibilidade de
   retenção.
10. **Drill por squad/vendedor/CS**.

---

## 6. Qualidade de dados e edge cases

- **Contratos com `data_inicio` nula:** não há (100% preenchido), mas a view trata
  com `lt_dias = NULL` por segurança.
- **`data_inconsistente`:** excluídos dos cálculos de média/distribuição;
  contados e exibidos no banner de qualidade.
- **Contratos `sem_valor`** (`valorr=0` e `valorp=0`, 115 casos): fora do escopo
  de LT/LTV.
- **`tipo_evento` do Conta Azul é 'RECEITA'/'DESPESA' (maiúsculo)** — relevante se
  formos cruzar financeiro no futuro.
- **Status com substring traiçoeira:** `'inativo'` contém `'ativo'` —
  **sempre usar igualdade exata**, nunca `ILIKE '%ativo%'`.
- **Join cliente↔Conta Azul:** `caz_parcelas.id_cliente::text = caz_clientes.ids`
  (ambos UUID; cast por divergência de tipo).

---

## 7. Testes

- **Views:** queries de validação versionadas (contagens, ausência de LT negativo
  no resultado final, soma de LTV cliente = soma dos contratos + pontual).
- **Endpoints:** Vitest — filtros, agregações, formatação, casos de borda
  (cliente só-pontual, cliente multi-contrato, contrato inconsistente excluído).
- **Sanidade vs investigação:** os números do dashboard devem bater com os da
  seção 2.7 (LT Performance ~4,6m, LTV cliente ~R$ 18.9k).

---

## 8. Riscos e limitações (transparência)

1. **Base jovem** — poucos contratos maduros; LT de encerrados subestima o LT real
   (mitigado pela curva de retenção no v2).
2. **Datas manuais** — LT depende da qualidade do preenchimento no ClickUp; ~22%
   excluídos por inconsistência.
3. **Churn mensal reconstruído por datas** — não há histórico de MRR mensal antes
   de nov/2025; a série é derivada de início/fim, sensível a datas erradas.
4. **`plano` ausente em `cup_contratos`** — benchmark por plano depende da
   `cup_churn` (cobertura parcial).

---

## 9. Próximos passos
1. Aprovação deste design.
2. `writing-plans` → plano de implementação detalhado (v1).
3. Feature branch `feature/lt-ltv-churn-dashboard`.
4. Implementar view canônica → endpoints → frontend → testes.
