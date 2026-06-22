# Design — Reconciliação de MRR por produto (aba Revenue, BP 2026)

**Data:** 2026-06-19
**Autor:** Warleypablo + Claude
**Status:** Aprovado (aguardando revisão da spec)

---

## 1. Contexto e problema

Na aba **Revenue** do `/bp-2026`, o MRR de **Performance** "saltou" de **R$ 422.159 (jan/2026)** para **R$ 510.012 (fev/2026)** (+87.853), sem vendas/churn que justificassem. A auditoria (2026-06-19) mostrou que **não houve mudança real de produto no ClickUp** — o `servico` dos contratos é estável.

**Causa-raiz:** o campo `"Clickup".cup_data_hist.produto` foi **corrompido** por uma falha do pipeline de snapshot entre **28/jan e 10/fev/2026**: o fill-rate do `produto` caiu de **99,4% (27/dez)** → **~7% (28/jan a 10/fev)** → **98% (11/fev, restaurado)**. Em parte dos contratos o `produto` ficou vazio; em outros, gravou valor errado (ex.: um contrato "Gestão de performance" ficou com `produto = 'E-mail Marketing'`).

O dashboard lê o MRR de janeiro do snapshot de **31/jan** — exatamente dentro da janela corrompida. O `CASE` de classificação (`server/routes/bp2026.revenue.ts`) checa `produto` primeiro e só cai no fallback `servico ILIKE` quando `produto` está **vazio**. Os contratos com `produto` **não-vazio mas errado** bateram na regra `produto <> '' → 'others'` e foram jogados em `others`, subcontando Performance em ~R$ 87k.

**Prova (mesma régua nos 2 meses, classificando só por `servico`):** Performance dez=471k, **jan=509.412**, **fev=510.012**, mar=529k. Com régua estável o "salto" desaparece — Performance ficou **flat (+600)**.

**Fatos adicionais relevantes:**
- Não existem snapshots entre **27/dez/2025 e 28/jan/2026** (o processo ficou parado janeiro inteiro e voltou quebrado).
- `produto` em **27/dez** e **11/fev** concordam em **99,7%** (1.935 de 1.940 subtasks; só 1 divergência real) → o carry-forward do backfill é praticamente inequívoco.
- O snapshot de **09/fev** é parcial (59 linhas) — quebrado, mas irrelevante para o MRR fim-de-mês.
- Há contratos que **somem** do snapshot (hard-delete no ClickUp): não viram status `cancelado`, somem de `cup_contratos` e **não têm registro em `cup_churn`** → escapam do churn. Ex. (jan→fev, Performance): IANIS 3× R$2.997 e Florest R$1.000.

## 2. Objetivos e não-objetivos

**Objetivos**
1. Corrigir a distorção do MRR por produto causada pela corrupção do `produto` (backfill na raiz).
2. Adicionar um **waterfall de reconciliação** por produto×mês que **fecha** `MRR_início + Σ componentes = MRR_fim`, com **células auditáveis** (lista de contratos por componente).
3. Tornar as **saídas sem rastreio** (hard-deletes) visíveis e auditáveis.

**Não-objetivos**
- Recriar os snapshots faltantes de janeiro (impossível — dados não existem).
- Alterar a linha **"Churn R$"** atual (vem de `vw_cup_churn_ajustado`, por `data_solicitacao`, alinhada ao gráfico do ClickUp). Ela continua como métrica de gestão, separada do waterfall.
- Mudar a metodologia de classificação de produto (continua `CASE_PRODUTO` por `produto`, agora confiável após o backfill).

## 3. Decisões aprovadas

| # | Decisão | Escolha |
|---|---------|---------|
| 1 | Escopo | Correção + waterfall de reconciliação |
| 2 | Fonte de churn do waterfall | Por movimento de snapshot (reconcilia). Linha "Churn R$" atual (ClickUp) mantida e separada, com nota |
| 3 | Fix da corrupção | **Backfill da `cup_data_hist`** (migração 1x, carry-forward), aplicado em prod + local |
| 4 | Apresentação | **Drill-down** ao clicar na célula de MRR; cada componente expande a lista de contratos |
| 5 | Downsell | Conta como churn (convenção do negócio); no drill, separável de cancelamentos para auditoria |
| 6 | Cobertura | Waterfall + saídas s/ rastreio para **todos os 5 produtos**, não só Performance |

## 4. Backfill da `cup_data_hist` (migração única)

**Janela corrompida:** `data_snapshot::date BETWEEN '2026-01-28' AND '2026-02-10'`.

**Fonte do valor correto (por `id_subtask`):** `COALESCE(produto em 2026-02-11, produto em 2025-12-27)`.
- `2026-02-11` (primeiro snapshot restaurado) é a fonte primária — reflete o estado corrigido.
- `2025-12-27` (último snapshot bom antes) é o fallback para subtasks ausentes em 11/fev (ex.: contratos que sumiram durante a janela).
- Subtasks ausentes em ambos (criados e removidos dentro da janela) ficam como estão; o fallback `servico` do `CASE` cuida deles.

**Regra:** só atualiza linhas onde o `produto` atual diverge do valor-fonte (idempotente — rodar duas vezes não muda nada na segunda).

**Script:** `scripts/backfill-cup-data-hist-produto-2026.sql` (versionado). Roda em transação, com `SELECT` de pré e pós-contagem para log.

**Validação pós-backfill (critérios de aceite):**
- Fill-rate de `produto` nos dias `28/jan–10/fev` ≥ 97%.
- MRR Performance jan (último snapshot do mês, `CASE_PRODUTO`) ≈ **506.662** (antes: 422.159).
  - ⚠️ Nota: os **509.412** citados na seção 1 são da **régua só-por-servico** (auditoria), método diferente do backfill. O backfill usa `produto` (carry-forward `COALESCE(11/fev, 27/dez)`) → resultado ~**506.662**. O gap (~2,7k) vem de contratos que a régua-servico e a régua-produto classificam diferente (ex.: o caso `Gestão de Comunidade`→`Performance` de 27/dez vs 11/fev). A régua-produto é a oficial (consistente com a linha MRR da aba). Valor confirmado igual em local e em dry-run de prod.
- Soma do MRR de todos os produtos em jan inalterada vs. soma por `servico` (o total não muda; só o mix).

**Aplicação prod + local:** rodar primeiro em local (`cortex_dev`), validar; depois em prod (`dados_turbo`). Conforme [[feedback_db_prod_sync]].

## 5. Lógica do waterfall (backend)

Novo módulo: `server/routes/bp2026.reconciliacao.ts`. Reutiliza `CASE_PRODUTO` exportado de `bp2026.revenue.ts` (classificação idêntica à linha MRR → consistência garantida).

**Definições.** Para produto `P` e mês `M`, comparar o snapshot fim-de-mês `S_{M-1}` (último do mês anterior) com `S_M` (último do mês). Para cada `id_subtask`:
- `prev` = está no pool de `P` em `S_{M-1}` (status ∈ `ativo/onboarding/triagem` **e** `CASE_PRODUTO = P`), com `valorr` `v_prev`.
- `cur` = está no pool de `P` em `S_M`, com `valorr` `v_cur`.

| Componente | Condição | Δ |
|------------|----------|---|
| **Vendas** | `id_subtask` ausente em `S_{M-1}` e `cur` | `+v_cur` |
| **Expansão** | `prev` e `cur` e `v_cur > v_prev` | `+(v_cur − v_prev)` |
| **Reativação** | presente em `S_{M-1}` mas fora do pool, e `cur` | `+v_cur` |
| **Churn — cancelamento** | `prev`, presente em `S_M` com status ∈ `cancelado/inativo`,`em cancelamento` | `−v_prev` |
| **Churn — downsell** | `prev` e `cur` e `v_cur < v_prev` | `(v_cur − v_prev)` (<0) |
| **Pausas** | `prev`, presente em `S_M` com status `pausado` | `−v_prev` |
| **Saídas s/ rastreio** | `prev`, `id_subtask` ausente em `S_M` | `−v_prev` |
| **Entregue** (borda) | `prev`, presente em `S_M` com status `entregue` | `−v_prev` |
| **Mudança de produto** (borda) | `prev`, `cur` em pool mas `CASE_PRODUTO ≠ P` | `−v_prev` (sai de P) |

**Exibição:** "Churn+downsell" = (cancelamento + downsell) numa linha (convenção do negócio); no drill, cancelamento e downsell aparecem separados. Linhas de borda (Entregue / Mudança de produto) só aparecem quando ≠ 0.

**Identidade (invariante):** `MRR_início(P,M) + Σ componentes = MRR_fim(P,M)`, e `MRR_fim(P,M)` == valor da linha `mrr_P` da aba Revenue para o mês `M`.

**Validação conhecida (Performance jan→fev, pós-backfill):** início 509.412; Vendas +61.064; Expansão +4.280; Reativação +8.697; Churn cancel −41.761; Downsell −7.699; Pausas −13.991; Saídas s/ rastreio −9.991; fim 510.012.

## 6. Drill auditável (endpoint)

`GET /api/bp2026/reconciliacao?produto=<chave>&mes=<1..12>` → retorna:
- `componentes`: `[{ chave, titulo, valor, n_contratos }]` na ordem do waterfall, mais `mrr_inicio` e `mrr_fim`.
- `contratos_por_componente`: para cada componente, lista de `{ id_subtask, cliente, servico, valorr_ini, valorr_fim }`.
  - Para **Saídas s/ rastreio**: incluir `ultimo_snapshot` (data) e `em_cup_churn` (bool) — para investigar cada hard-delete.

Cliente via `JOIN "Clickup".cup_clientes cl ON cl.task_id = h.id_task`. Listas podem ser lazy (carregar ao expandir) ou vir junto — decidir no plano conforme custo da query.

## 7. Frontend

- Em `BPDreTable`/`BP2026.tsx`: clique numa célula de **MRR de produto** (`metrica` começa com `mrr_` e ≠ `mrr_ativo`) abre um painel de reconciliação em vez do `BPCellDetail` genérico.
- Novo componente `BPReconciliacao` (ou variação do `BPCellDetail`): waterfall conforme o mockup aprovado — `MRR início`, componentes com sinal e cor (verde entradas / vermelho saídas), `MRR fim`.
- Cada componente é expansível e lista os contratos (id, cliente, serviço, valorr ini→fim). Saídas s/ rastreio destacam `ausente em cup_churn`.
- Dark/light obrigatório (`dark:` Tailwind). Formatação de moeda com os helpers existentes.

## 8. Testes e validação

- **Teste de reconciliação (automatizado):** para cada produto×mês fechado, `MRR_início + Σ componentes == MRR_fim` (tolerância R$ 0,01). Roda contra o banco (ou fixture de snapshot).
- **Teste de regressão de números conhecidos:** Performance jan→fev reproduz a tabela da seção 5.
- **Validação manual no browser:** abrir o drill de Performance/fev em dark e light; conferir as listas (IANIS e Florest em "Saídas s/ rastreio").
- **Pós-backfill:** rodar os critérios da seção 4.

## 9. Rollout

1. Rodar backfill em **local**, validar (seção 4).
2. Rodar backfill em **prod**, validar.
3. Deploy do backend + frontend.
4. Conferir aba Revenue: MRR jan corrigido e drill funcionando.

## 10. Riscos e bordas

- **Reescrever histórico:** o backfill altera linhas históricas de `cup_data_hist`. Mitigação: idempotente, em transação, com log de contagem; restrito à janela corrompida; carry-forward validado (99,7% de concordância).
- **Outras janelas de corrupção:** o fill-rate pós-fev fica 96–99%. Fora do escopo, mas o teste de reconciliação expõe meses que não fecham.
- **Saídas s/ rastreio (hard-deletes):** são perdas reais que escapam do `cup_churn`. O waterfall as expõe, mas a decisão de classificá-las como churn "oficial" é do negócio — aqui ficam como linha própria, auditável.
- **`servico` fallback no `CASE`:** mantido para contratos com `produto` genuinamente vazio; após o backfill raramente dispara na janela corrigida.

---

**Referências:** auditoria desta sessão (2026-06-19); memória `reference_bp2026_mrr_produto_reclassif`; `docs/cup_data_hist.md`; `server/routes/bp2026.revenue.ts`.
