# Forecast Churn na tela de churn

**Data:** 2026-07-20
**Origem:** pedido "Adicionar Forecast Churn" apontando para o board de Forecast do ClickUp
(`https://app.clickup.com/31021986/v/db/xjpx2-278133`).

## Contexto

A tela `/dashboard/churn-detalhamento` mostra churn **já efetivado/solicitado** — filtra
`vw_cup_churn_ajustado` por `data_solicitacao_encerramento`. Falta o indicador **antecedente**:
quem está em risco e ainda não pediu para sair.

O board de Forecast do ClickUp é um pipeline de CS: clientes em risco/negociação de cancelamento,
com campos de retenção (`Status do cancelamento`, `Possibilidade de retenção`, contexto). O pedido
associado no ClickUp ("Inserir coluna de risco de churn na tela de Forecast") indica que o time
quer cruzar esse pipeline com o **score de risco do motor de ML que o Cortex já tem**
(`server/services/churnRiskEngine.ts`, página `ChurnPredicao`).

## Investigação (PROD, `dados_turbo`, 2026-07-20)

### O board já está espelhado no Postgres

Os campos do board vivem em `"Clickup".cup_churn` (e na view `vw_cup_churn_ajustado`), **não** em
`cup_contratos`. Keyados por `cup_churn.task_id = cup_contratos.id_subtask`. Frescor de ~1 dia
(`cup_contratos.data_criado` máx 2026-07-19; snapshot `cup_data_hist` de hoje). **Ler do Postgres
resolve — sem tocar na API do ClickUp.**

Valores de `status_cancelamento` batem exatamente com o board: Em negociação (25), Não retido (400),
Contato sem sucesso (13), Aguardando contexto (13), Recuperação (Futuro) (3), Retido (1), vazio (4048).
`possibilidade_retencao`: Baixa (668), Média (102), Alta (13), vazio (3714).

**Dois campos do board NÃO estão espelhados:** `Data do Próximo Contato` e `Status do contato`
(existem só em `cup_tech`, outro contexto). Ficam fora do escopo.

### A régua de risco

`status_cancelamento` fica preenchido durante todo o ciclo de churn — dos 25 "Em negociação",
21 já têm `data_solicitacao_encerramento`. Então o campo do board sozinho, restrito a pré-churn,
rende só 13 contratos. O sinal com volume é a saúde da conta. Régua escolhida = **união**:

| régua | contratos | MRR exposto |
|---|---:|---:|
| board de cancelamento (`status_cancelamento` preenchido) | 13 | R$ 27,3k |
| saúde de conta (`status_conta` ∈ {Requer Atenção, Insatisfeito}) | 95 | R$ 203k |
| **união + `possibilidade_retencao` preenchida** | **106 (67 clientes)** | **R$ 223,5k** (+ R$ 230,5k pontual) |

### O cruzamento com o ML é viável

`churnRiskEngine` persiste em `cortex_core.churn_risk_scores`, keyado por
`contrato_id = cup_contratos.id_subtask` — **mesma chave da população de forecast**. O motor pontua
`status IN ('ativo','onboarding','triagem')`, então contratos `pausado` do forecast ficam **sem
score** (exibir "—"). **Gotcha:** o recálculo é só manual (`POST /api/churn-risk/recalculate`); não
há job. O score é tão fresco quanto o último recálculo — a tela deve expor `calculated_at`.

## Decisões

| Item | Decisão |
|---|---|
| Fonte de dados | **Postgres** (`cup_contratos` + `cup_churn` + `churn_risk_scores`), sem API do ClickUp |
| Régua de risco | **União**: board de cancelamento ∪ saúde de conta em risco ∪ possibilidade de retenção |
| Formato | **Bloco novo na tela de churn** (`ChurnDetalhamento`), com coluna de score de ML |
| Fronteira com o churn confirmado | Contratos `em cancelamento` (já solicitaram) **ficam fora** — são o funil de churn, mostrado pelo resto da tela |
| `Data do Próximo Contato` / `Status do contato` | Fora — não espelhados no Postgres |
| Recálculo automático do score | Fora — hoje manual; exposto `calculated_at`; job fica como dívida |

## Design

### Backend — `GET /api/analytics/churn-forecast`

Novo handler em `server/routes.ts`, ao lado dos demais `/api/analytics/churn-*`. Sem parâmetro de
período (o forecast é foto do agora, não uma janela histórica).

Query da população, a partir de `cup_contratos` (contratos vivos) para não pegar histórico:

```sql
SELECT
  ct.id_subtask                         AS contrato_id,
  cl.nome                               AS cliente,
  ct.servico,
  COALESCE(ct.valorr::numeric, 0)       AS valorr,
  COALESCE(ct.valorp::numeric, 0)       AS valorp,
  ct.status,
  ch.status_conta,
  ch.status_cancelamento,
  ch.possibilidade_retencao,
  ch.responsavel_geral,
  ch.cs_responsavel,
  COALESCE(NULLIF(TRIM(ch.mensagem_cliente), ''),
           NULLIF(TRIM(ch.contexto_cx), ''),
           NULLIF(TRIM(ch.contexto_operacao), '')) AS contexto_risco,
  rs.score                              AS risco_score,
  rs.tier                               AS risco_tier,
  rs.calculated_at                      AS risco_calculado_em
FROM "Clickup".cup_contratos ct
JOIN "Clickup".cup_churn ch          ON ch.task_id = ct.id_subtask
LEFT JOIN "Clickup".cup_clientes cl  ON cl.task_id = ct.id_task
LEFT JOIN cortex_core.churn_risk_scores rs ON rs.contrato_id = ct.id_subtask
WHERE LOWER(ct.status) IN ('ativo','onboarding','pausado','triagem')
  AND ct.data_solicitacao_encerramento IS NULL
  AND ( COALESCE(ch.status_cancelamento, '') <> ''
     OR ch.status_conta IN ('Requer Atenção', 'Insatisfeito')
     OR COALESCE(ch.possibilidade_retencao, '') <> '' )
ORDER BY ct.valorr::numeric DESC NULLS LAST
```

**Notas de fidelidade ao dado (medidas na investigação):**
- `cup_churn.nome` é o nome do **serviço**, não do cliente — o nome vem de `cup_clientes` via
  `task_id = cup_contratos.id_task`.
- Fazer o JOIN a partir de `cup_contratos` (não de `cup_churn`, que tem 4.497 linhas incluindo
  histórico/deletados) restringe aos contratos vivos.
- Usar `cup_churn` cru, não `vw_cup_churn_ajustado` — a view soma ajustes manuais (alguns `valor_r`
  negativos) que são de churn efetivado, não de forecast.

O handler devolve `{ contratos: [...], metricas: {...}, riscoCalculadoEm }`:
- `metricas`: `total_contratos`, `total_clientes` (distintos por `cliente`), `mrr_exposto`
  (SUM valorr), `pontual_exposto` (SUM valorp), `por_tier` (contagem e MRR por tier de risco, com
  bucket "Sem score" para os `pausado`), `por_status_retencao` (por `status_cancelamento`, com
  bucket "Sem status").
- `riscoCalculadoEm`: o `MAX(calculated_at)` de `churn_risk_scores` — a data do último recálculo,
  para a UI sinalizar frescor. `null` se a tabela estiver vazia.

### Frontend — `client/src/components/churn/ChurnForecast.tsx`

Novo componente, inserido em `client/src/pages/ChurnDetalhamento.tsx` logo após `ChurnKpisHero`
(junto do bloco "Observatório"), com busca própria via `useQuery` em `/api/analytics/churn-forecast`.

Estrutura:
- **Faixa de topo:** "Em risco: {N} clientes · {MRR} exposto · {Pontual} pontual". Ao lado, em
  texto pequeno, "score de risco calculado em {data}" (ou "score não calculado" se `null`).
- **Tabela** de contratos, ordenada por MRR desc, colunas:
  - Cliente (truncado, `title` no hover)
  - Responsável (`responsavel_geral`, "—" se vazio)
  - MRR (`formatCurrencyNoDecimals`)
  - **Score** — badge colorido pelo tier (`baixo`/`moderado`/`alto`/`critico`); "—" quando sem
    score (contrato `pausado`)
  - Status de retenção (`status_cancelamento`; "—" se vazio). **Não** cair para `status_conta` aqui:
    são vocabulários distintos ("Em negociação" vs "Requer Atenção") e misturá-los na mesma coluna
    esconde a origem do valor. `status_conta` entra como coluna própria (Saúde), abaixo.
  - Saúde da conta (`status_conta`, "—" se vazia) — é o sinal que traz 95 dos 106; merece coluna
    própria em vez de fallback disfarçado
  - Possibilidade (`possibilidade_retencao`, "—" se vazia)
  - Clique na linha abre um drawer/expandível com `contexto_risco` (o "o que pode gerar churn").
- Empty state: "Nenhum contrato em risco no forecast." quando a lista vier vazia.
- Cores do tier reaproveitam a escala de `churnRiskEngine` (baixo=verde … critico=vermelho),
  theme-aware (`isDark ? claro : escuro`), sem hex fixo cru.

Ordenação alternável (MRR ↔ Score) fica **fora do MVP** — YAGNI; a ordenação por MRR cobre o caso
"onde está o maior valor exposto".

### Isolamento e testes

Lógica de agregação pura em `client/src/components/churn/churnAggregations.ts` (arquivo já existe):
- `agregarForecast(contratos)` → `{ total_contratos, total_clientes, mrr_exposto, pontual_exposto,
  por_tier, por_status_retencao }`. Testável sem banco.

Testes em `churnAggregations.test.ts`:
- soma MRR e pontual exposto; conta clientes distintos (um cliente com 2 contratos conta 1)
- bucket "Sem score" agrupa os contratos sem `risco_tier`
- `por_status_retencao` cai para "Sem status" quando `status_cancelamento` é vazio
- lista vazia → zeros, sem divisão por zero

Backend sem teste automatizado (o endpoint não tem suíte hoje); validação por reconciliação manual.

## Validação manual

- Reconciliar contra **prod**: a população deve dar **106 contratos, 67 clientes, R$ 223,5k de MRR
  exposto** (o local está atrasado). Um cliente com múltiplos contratos aparece em várias linhas mas
  conta 1 no total de clientes.
- Conferir que contratos `em cancelamento` **não** aparecem (já solicitaram encerramento).
- Contratos `pausado` aparecem com score "—".
- Dark mode e light mode.

## Dívidas registradas (fora do escopo)

| Dívida | Impacto |
|---|---|
| Score de ML só recalcula manualmente (sem job) | O forecast mostra o score da última execução; `calculated_at` exposto para não enganar. Um job diário resolveria |
| `Data do Próximo Contato` e `Status do contato` não espelhados | Se a tela precisar deles, exige adicionar custom fields ao sync externo do ClickUp |
| `cup_churn.nome` é nome de serviço, não de cliente | Tratado com JOIN em `cup_clientes`; documentar para quem tocar depois |
| Régua de risco por saúde de conta pode incluir contas estáveis marcadas "Requer Atenção" | 95 dos 106 vêm desse sinal; se gerar ruído, refinar com `possibilidade_retencao` ou score de ML mínimo |
