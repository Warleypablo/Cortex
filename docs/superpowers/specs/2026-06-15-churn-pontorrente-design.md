# Design — Churn Pontorrente

**Data:** 2026-06-15
**Status:** Aprovado (aguardando revisão da spec)
**Branch:** `worktree-churn-pontorrente`

## Contexto

Contratos **ponto-recorrentes** ("pontorrentes") são serviços **pontuais vendidos em
sequência de entregas** (1ª, 2ª, 3ª, 4ª entrega). Hoje não há visualização do "churn"
desse tipo de contrato. Diferente do recorrente (onde churn = cancelamento de MRR),
o churn relevante aqui é o **drop-off entre entregas**: o cliente fez a Nª entrega mas
não avançou para a (N+1)ª.

### Por que isso importa
- São **263 contratos** (de 2.724 na `cup_contratos`), ~**70 jornadas** (cliente × produto).
- Valor majoritariamente **pontual** (`valorp` ~R$ 1,5M; `valorr` ~R$ 16k) — o "valor" do
  churn é `valorp`, não MRR.
- Produtos: Creators (211), Performance (29), Social Media (18) + resíduos.

## Origem dos dados

Tudo vem de `"Clickup".cup_contratos` (snapshot do estado atual). Investigação feita em
**local** (`cortex_dev`); a implementação deve revalidar contra **prod**
(`34.95.249.110/dados_turbo`).

### Identificação do universo pontorrente
Contratos cujo `servico` casa o padrão de entrega numerada **e** dos quais a regex extrai
um nível. A nomenclatura no ClickUp é bagunçada — 4 formatos convivem:
- `1ª Entrega - Creators` (ordinal antes)
- `Entrega 1 - Performance - Starter` (número depois; às vezes `Entrega 3-` sem espaço)
- `Creators (Entrega 01) - Starter` (entre parênteses, com zero à esquerda)
- Vários dizem literalmente `Ponto-rrente` (ex.: `Entrega 2 - Gestão de performance Ponto-rrente - Starter`)

### Extração do nível da entrega (validada)
```sql
CASE
  WHEN servico ~* 'entrega\s*0*([0-9]+)'    THEN (regexp_match(servico, 'entrega\s*0*([0-9]+)', 'i'))[1]::int
  WHEN servico ~* '([0-9]+)\s*ª?\s*entrega' THEN (regexp_match(servico, '([0-9]+)\s*ª?\s*entrega', 'i'))[1]::int
END AS num_entrega
```
- Pega "Entrega 1", "Entrega 01" (zero à esquerda), "1ª Entrega", "4 entregas".
- Único falso-positivo observado: `"Entrega de 3 rótulos para a embalagem"` → **excluído**
  por exigirmos `num_entrega IS NOT NULL` com número adjacente a "entrega".
- **Critério do universo:** `servico ILIKE '%entrega%' AND num_entrega IS NOT NULL`.

## Definições centrais (contrato de dados)

| Conceito | Definição |
|---|---|
| **Jornada** (unidade do funil) | par `(id_task, produto)` — sequência de entregas de **um cliente dentro de uma linha de produto**. Creators e Performance do mesmo cliente são jornadas distintas. |
| **Nível atingido pela jornada** | `MAX(num_entrega)` por jornada — robusto aos buracos (há jornadas com entrega 4 sem linha de entrega 1). |
| **Situação atual da jornada** | status do estágio de maior nível |

### Classificação de situação (a partir de `status`, minúsculo)
- **Entregue** → `status = 'entregue'`
- **Em andamento** → `status IN ('triagem','onboarding','ativo','pausado')` — *não é churn* (ainda pode avançar)
- **Churn** → `status IN ('cancelado/inativo','não usar')`

## Métrica central — funil de sobrevivência

Funil de **sobrevivência**: nº de jornadas que atingiram **≥ N**. Snapshot atual (local):

| Degrau | Jornadas (≥N) | Retenção | Drop |
|---|---|---|---|
| Entrega 1 | 70 | 100% | — |
| Entrega 2 | 69 | 98,6% | −1,4% |
| Entrega 3 | 63 | 90,0% | −8,6% |
| Entrega 4 | 54 | 77,1% | −12,9% |

> Os números acima vieram da investigação por **cliente** (`id_task`). Como a jornada é
> `(id_task, produto)`, a implementação **recalcula** por jornada — os totais podem subir
> levemente (cliente com 2 produtos = 2 jornadas). Servem como ordem de grandeza/sanity check.

A **queda de cada degrau é decomposta** (para não chamar de churn quem ainda roda):
- **Churn confirmado** — jornada cujo estágio atual em N está `cancelado/inativo` → conta como churn + soma `valorp` perdido.
- **Em andamento** — parou em N mas está ativo/triagem → *pipeline*, não churn.
- **Concluído sem renovar** — entregue e não seguiu → drop "natural" do pontual.

> Alerta de dado: muita coisa em `triagem` (no degrau 4, dos 54: **30 triagem**, 16
> cancelado, 7 entregue). Por isso o funil tem toggle **vendido × só entregue**.

## Dimensões de detalhamento (fill rate validado nos 263)

| Dimensão | Preenchimento | Observação |
|---|---|---|
| `squad` | 258/263 | Olimpo (100), Aura OFF (52), Pulse (46), Makers OFF (27), Selva (25)… |
| `responsavel` | 256/263 | ~22 distintos |
| `cs_responsavel` | 251/263 | |
| `vendedor` | 220/263 | |
| `motivo_cancelamento` | **46/50 dos cancelados (92%)** | Erro na Venda (20), Inadimplente (10), Não começou (4), Inadimplente 1º Mês (4), Encerrou Operação/Faliu (3), Sem Orçamento (3)… |

## Arquitetura

### Backend — `server/routes/churnPontorrente.ts`
Isolar a regex/classificação numa **view** para centralizar a lógica suja:

```sql
CREATE OR REPLACE VIEW cortex_core.vw_pontorrente AS
SELECT
  c.id_subtask, c.id_task, c.servico, c.produto, c.status,
  c.valorp, c.squad, c.responsavel, c.cs_responsavel, c.vendedor,
  c.motivo_cancelamento, c.data_inicio, c.data_entrega, c.data_solicitacao_encerramento,
  CASE
    WHEN c.servico ~* 'entrega\s*0*([0-9]+)'    THEN (regexp_match(c.servico, 'entrega\s*0*([0-9]+)', 'i'))[1]::int
    WHEN c.servico ~* '([0-9]+)\s*ª?\s*entrega' THEN (regexp_match(c.servico, '([0-9]+)\s*ª?\s*entrega', 'i'))[1]::int
  END AS num_entrega,
  CASE
    WHEN c.status = 'entregue' THEN 'entregue'
    WHEN c.status IN ('cancelado/inativo','não usar') THEN 'churn'
    ELSE 'em_andamento'
  END AS situacao
FROM "Clickup".cup_contratos c
WHERE c.servico ILIKE '%entrega%'
  AND (c.servico ~* 'entrega\s*0*[0-9]+' OR c.servico ~* '[0-9]+\s*ª?\s*entrega');
```
> A view deve ser criada em **local e prod** (regra de sync de schema). Os endpoints
> consultam só a view; a regex vive num lugar só.

Endpoints (padrão `creatorsPontual.ts` / `ltLtvChurn.ts`: `db.execute(sql\`...\`)`, snake→camel,
try/catch com `res.status(500)`). Todos aceitam filtros `produto`, `squad`, `responsavel`,
`de`, `ate`, `base` (`vendido|entregue`):

| Endpoint | Retorno |
|---|---|
| `GET /api/churn-pontorrente/overview` | KPIs: jornadas, retenção até última entrega, drop-off médio/degrau, churn confirmado (qtd), `valorp` perdido |
| `GET /api/churn-pontorrente/funil` | por nível: sobrevivência (≥N) + decomposição da queda (churn / em andamento / concluído) |
| `GET /api/churn-pontorrente/churn-por-dimensao?dim=motivo\|squad\|responsavel\|cs` | agregado de churn por dimensão (qtd + `valorp`) |
| `GET /api/churn-pontorrente/detalhamento` | uma linha por jornada churnada |

Registrar `registerChurnPontorrenteRoutes(app)` no bootstrap de rotas (mesmo lugar onde
`creatorsPontual` é registrado).

### Frontend — `client/src/pages/ChurnPontorrente.tsx`
Página **standalone**, rota `/dashboard/churn-pontorrente`, seção **Gestão**. Padrão do
`EvolucaoMensal.tsx` (React Query com queryKey = URL, `useMemo`, `Skeleton`, dark/light):

1. **Filtros (topo):** Produto · Squad · Responsável/CS · Período (mês de início) · toggle **vendido × só entregue**.
2. **Cards (KPIs):** Jornadas · Retenção até última entrega (%) · Drop-off médio/degrau · Churn confirmado (qtd) · `valorp` perdido.
3. **Funil de continuidade** (Recharts): 4 degraus com sobrevivência + **% drop entre degraus**, queda decomposta por cor (churn / em andamento / concluído).
4. **Churn por dimensão** (barras): por **motivo de cancelamento**, **squad**, **responsável/CS**.
5. **Tabela de detalhamento:** uma linha por jornada churnada — cliente (nome via `cup_clientes.task_id = id_task`) · produto · nível em que caiu · **motivo de churn** · responsável · CS · squad · vendedor · `valorp` perdido · data de solicitação de encerramento. Com busca/ordenação.

### Navegação / permissão — `shared/nav-config.ts`
- `PERMISSION_KEYS.GESTAO.CHURN_PONTORRENTE = 'gestao.churn_pontorrente'`
- `ROUTE_TO_PERMISSION['/dashboard/churn-pontorrente'] = ...CHURN_PONTORRENTE`
- Item em `NAV_CONFIG` setor **Gestão** (`title: 'Churn Pontorrente'`, `icon: 'TrendingDown'`)
- Rota lazy em `client/src/App.tsx` (padrão `lazyWithRetry` + `ProtectedRoute`).

## Decisões assumidas
1. **Jornada = cliente × produto** (não cliente "global").
2. **Churn = `cancelado/inativo` + `não usar`**; "em andamento" não é churn.
3. **Nível máximo = 4** (teto atual); funil cresce sozinho se surgir entrega 5+.
4. **Base do funil padrão = "vendido"** (contrato existe), com toggle para "só entregue".
   - `vendido`: `MAX(num_entrega)` sobre **todos** os estágios da jornada.
   - `só entregue`: `MAX(num_entrega)` sobre estágios com `status = 'entregue'` apenas
     (mede progressão *efetivamente entregue*, ignorando o que está parado em triagem).
5. **Cohort por mês (heatmap) fica para v2** — N pequeno hoje (~70 jornadas).

## Fora de escopo (v1)
- Cohort retention por mês de entrada (heatmap).
- Cruzamento com financeiro (`caz_parcelas`) / inadimplência real.
- Análise preditiva de propensão a drop.

## Riscos / caveats
- **N pequeno** (~70 jornadas) → números sensíveis a poucos casos; alguns squads `(OFF)`.
- **Buracos nos dados** (jornadas não-monotônicas) → por isso usamos `MAX(num_entrega)`, não presença degrau a degrau.
- **"Vendido" ≠ "entregue"** → muita entrega presa em `triagem`; toggle obrigatório.
- Investigação em **local**; revalidar contagens em **prod** na implementação.
- `status` tem strings com acento/barra (`cancelado/inativo`, `não usar`) — casar exatamente.

## Critérios de aceite
- [ ] View `cortex_core.vw_pontorrente` criada em local **e** prod.
- [ ] Funil mostra sobrevivência 1→4 com % de drop e decomposição da queda.
- [ ] Toggle vendido × só entregue altera os números corretamente.
- [ ] Detalhamento lista jornadas churnadas com motivo, responsável, CS, squad, vendedor, `valorp`.
- [ ] Filtros (produto, squad, responsável, período) funcionam em todos os blocos.
- [ ] Dark e light mode ok.
- [ ] Item na sidebar (Gestão) e rota protegida por permissão.
