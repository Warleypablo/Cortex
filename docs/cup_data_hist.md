# 📸 Tabela `"Clickup".cup_data_hist`

> Histórico diário (snapshots) da tabela de contratos `"Clickup".cup_contratos`.
> Cada linha é a **fotografia de um contrato/subtask em um dia específico**.

---

## 📊 Visão Geral

| Atributo | Valor |
|----------|-------|
| **Schema** | `"Clickup"` (precisa de aspas duplas — tem espaço/maiúscula) |
| **Origem** | Cópia diária de `"Clickup".cup_contratos` (ClickUp) |
| **Granularidade** | 1 linha por **subtask de contrato** por **dia de snapshot** |
| **Volume** | ~332 mil linhas |
| **Período coberto** | desde **17/nov/2025** até hoje |
| **Frequência** | 1 snapshot por dia (≈143 dias distintos) |
| **Índice** | `idx_cup_data_hist_data_snapshot` em `data_snapshot` (btree) |

A tabela `cup_contratos` guarda apenas o **estado atual** dos contratos. A `cup_data_hist`
acumula o estado de cada dia, permitindo responder perguntas **temporais** que a tabela viva
não consegue:

- Qual era o **MRR ativo** no último dia de cada mês?
- Quantos contratos estavam **ativos / em cancelamento / pausados** numa data passada?
- **Evolução mensal** de receita recorrente, churn e número de clientes.
- **Drop-off / churn** comparando o status do mesmo contrato entre dois snapshots.

---

## ⚙️ Como é populada

Um snapshot é gerado **copiando todas as linhas de `cup_contratos`** e carimbando a data:

```sql
INSERT INTO "Clickup".cup_data_hist
  (data_snapshot, servico, status, valorr, valorp, id_task, id_subtask,
   data_inicio, data_encerramento, data_pausa, squad, produto,
   responsavel, cs_responsavel, vendedor)
SELECT
  CURRENT_TIMESTAMP,
  servico, status, valorr, valorp, id_task, id_subtask,
  data_inicio, data_encerramento, data_pausa, squad, produto,
  responsavel, cs_responsavel, vendedor
FROM "Clickup".cup_contratos;
```

Endpoints que escrevem na tabela (em `server/routes.ts`):

| Endpoint | O que faz |
|----------|-----------|
| `POST /api/admin/contratos-snapshot` | Gera o snapshot do dia (idempotente — pula se já existe para hoje) |
| `POST /api/admin/generate-snapshot` | Gera/retroage snapshot para uma data específica (`snapshotDate`) |
| `GET /api/admin/snapshot-status` | Lista snapshots disponíveis agrupados por mês |

> ⚠️ Como cada snapshot copia a tabela inteira, a `cup_data_hist` cresce ~2 mil linhas/dia.
> Sempre filtrar por `data_snapshot` ao consultar (o índice torna isso barato).

---

## 🗂️ Dicionário de Colunas

| # | Coluna | Tipo | Função |
|---|--------|------|--------|
| 1 | `servico` | `varchar(255)` | Nome do serviço/oferta contratado (ex.: `Social Media - Enterprise`, `Creators Pontual - Starter`). Equivale ao nome da subtask no ClickUp. |
| 2 | `status` | `text` | Situação do contrato **naquele dia** (minúsculo). Valores: `ativo`, `onboarding`, `triagem`, `pausado`, `em cancelamento`, `cancelado/inativo`, `entregue`, `não usar`. |
| 3 | `valorr` | `numeric` | **Valor Recorrente (MRR)** do contrato. Base para somar receita recorrente. Use junto de `status='ativo'` (+ `onboarding`/`em cancelamento` conforme a métrica). |
| 4 | `valorp` | `numeric` | **Valor Pontual** (one-time / projeto pontual). Receita não recorrente daquele item. |
| 5 | `id_task` | `text` | ID da **task pai** no ClickUp = identifica o **cliente/conta**. Relaciona com `cup_clientes.task_id`. Use `COUNT(DISTINCT id_task)` para contar clientes. |
| 6 | `id_subtask` | `text` | ID da **subtask** no ClickUp = identifica o **contrato individual**. Granularidade da linha (um cliente pode ter várias subtasks). |
| 7 | `data_encerramento` | `date` | Data de encerramento/cancelamento efetivo do contrato (NULL se ativo). |
| 8 | `data_inicio` | `date` | Data de início do contrato. |
| 9 | `squad` | `text` | Squad responsável pela operação (ex.: `⚓️ Squadra`, `🪖 Selva`, `🖥️ Tech`). Squads com `(OFF)` são desativados/legados. Pode vir vazio em contratos novos/triagem. |
| 10 | `produto` | `text` | Linha de produto (ex.: `Performance`, `Creators`, `Social Media`, `Ecommerce`, `Landing Page`). |
| 11 | `data_solicitacao_encerramento` | `date` | Data em que o cliente **solicitou** o cancelamento (antecede `data_encerramento`). |
| 12 | `responsavel` | `text` | Responsável geral/operador do contrato. |
| 13 | `cs_responsavel` | `text` | Customer Success responsável pela conta. |
| 14 | `vendedor` | `text` | Vendedor que fechou o contrato. |
| 15 | `data_pausa` | `date` | Data em que o contrato foi pausado (relevante quando `status='pausado'`). |
| 16 | `motivo_cancelamento` | `text` | Motivo do cancelamento/churn (texto livre). |
| 17 | `plano` | `text` | Nível do plano (`Starter`, `Scale`, `Enterprise`, `Personalizado`, `Projeto Pontual`, `Antigo ⚠️`). Quase sempre vazio — preenchido só em parte da base. |
| 18 | `data_snapshot` | `date` | **Coluna-chave.** Data da fotografia. Todo filtro temporal usa esta coluna. Indexada. |
| 19 | `snapshot_date` | `date` | ⚠️ **Vestigial — 100% NULL.** Coluna duplicada nunca populada pelo processo de snapshot. Não usar. |
| 20 | `cliente` | `varchar(255)` | ⚠️ **Vestigial — 100% NULL.** Não é preenchida pelo INSERT. Para nome do cliente, faça JOIN via `id_task` → `cup_clientes`. |
| 21 | `created_at` | `timestamp` | Timestamp de gravação física da linha no banco (auditoria). Distinto de `data_snapshot` (que é a data lógica do snapshot). |

---

## ⚠️ Gotchas Importantes

1. **`status` é minúsculo** nesta tabela (`ativo`, `cancelado/inativo`, …), diferente de
   `cup_contratos` em alguns contextos. Sempre comparar em minúsculo.
2. **`snapshot_date` e `cliente` estão sempre NULL** — são colunas legadas. Use
   `data_snapshot` e o JOIN por `id_task`, respectivamente.
3. **Nome do cliente não está na tabela.** Para obtê-lo:
   ```sql
   JOIN "Clickup".cup_clientes c ON c.task_id = h.id_task
   ```
4. **Sempre filtre por `data_snapshot`.** Sem filtro você varre ~332k linhas. Com o
   índice `idx_cup_data_hist_data_snapshot` os filtros por data são instantâneos.
5. **"Último snapshot do mês"** é o padrão para MRR de fechamento:
   ```sql
   MAX(data_snapshot) WHERE DATE_TRUNC('month', data_snapshot) = '2026-05-01'
   ```
6. **Granularidade é subtask.** Para métricas por cliente use `COUNT(DISTINCT id_task)`;
   para somar MRR some `valorr` das subtasks com o `status` adequado.

---

## 🔧 Queries de Referência

**MRR ativo no último dia de um mês:**
```sql
WITH ultimo_snap AS (
  SELECT MAX(data_snapshot) AS d
  FROM "Clickup".cup_data_hist
  WHERE DATE_TRUNC('month', data_snapshot) = '2026-05-01'::date
)
SELECT SUM(valorr) AS mrr_ativo,
       COUNT(DISTINCT id_task) AS clientes
FROM "Clickup".cup_data_hist h, ultimo_snap u
WHERE h.data_snapshot = u.d
  AND h.status IN ('ativo', 'onboarding', 'em cancelamento');
```

**Evolução mensal do MRR (último snapshot de cada mês):**
```sql
WITH snaps AS (
  SELECT DATE_TRUNC('month', data_snapshot) AS mes,
         MAX(data_snapshot) AS d
  FROM "Clickup".cup_data_hist
  GROUP BY 1
)
SELECT s.mes,
       SUM(h.valorr) AS mrr,
       COUNT(DISTINCT h.id_task) AS clientes
FROM snaps s
JOIN "Clickup".cup_data_hist h ON h.data_snapshot = s.d
WHERE h.status IN ('ativo', 'onboarding', 'em cancelamento')
GROUP BY s.mes
ORDER BY s.mes;
```

**Churn / drop-off — contratos que estavam ativos e deixaram de estar:**
```sql
SELECT ontem.id_subtask, ontem.servico, ontem.valorr,
       ontem.status AS status_antes, hoje.status AS status_depois
FROM "Clickup".cup_data_hist ontem
JOIN "Clickup".cup_data_hist hoje
  ON hoje.id_subtask = ontem.id_subtask
 AND hoje.data_snapshot = '2026-06-16'
WHERE ontem.data_snapshot = '2026-05-31'
  AND ontem.status = 'ativo'
  AND hoje.status IN ('cancelado/inativo', 'em cancelamento');
```

---

## 🔗 Relacionamentos

```
cup_data_hist.id_task    ──→  cup_clientes.task_id      (cliente/conta)
cup_data_hist.id_subtask ──→  cup_contratos.id_subtask  (contrato vivo correspondente)
cup_data_hist.id_task    ──→  cup_contratos.id_task     (agrupamento por cliente)
```

Para casar com financeiro (Conta Azul), parta de `cup_clientes` → `cnpj` → `caz_clientes`
(ver `agents/db-specialist.md` e `DATABASE.md`).
