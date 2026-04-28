# Receita por Squad: bater 100% com DFC via pipeline de itens

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar a divergência entre "Contribuição por Squad" (R$ 1.098 MM em jan/26) e DFC (R$ 1.259 MM), substituindo o simulador heurístico FIFO por atribuição direta via `caz_vendas_itens`, com regras determinísticas para itens sem match.

**Architecture:**
1. **Fase 1 — Robustecer matching (independente de backfill):** incluir contratos cancelados/zerados, ratear `item_total` proporcionalmente ao `valor_pago`, adicionar fallback "contrato de maior valor", expandir `item_alias_map`, enriquecer bucket "Sem Squad" com causa.
2. **Fase 2 — Arrancar simulador (gate: backfill operacional concluído):** remover `simulator.ts`, remover pipeline de fallback do endpoint, manter apenas pipeline de itens.

**Tech Stack:** PostgreSQL (Cloud SQL), Drizzle ORM, TypeScript, Express, Vitest, React.

**Pré-requisito operacional (fora do escopo de código):** backfill de `caz_vendas_itens` para vendas com `data` em 2023, 2024, 2025 e 2027+ (vendas agendadas). Hoje só TP/2026 está sincronizado. Sem backfill, Fase 2 não pode rodar — atribuirá ~R$ 473k/mês a "Sem Squad". A Fase 1 funciona e melhora o status quo independente disso.

---

## Decisões já alinhadas com o usuário

| # | Decisão | Detalhe |
|---|---|---|
| 1 | Causa 1 (5 clientes só no Conta Azul, R$ 36k/mês) | **Aceitar como "⚠️ Sem Squad"** até que o time cadastre no Clickup |
| 2 | Sub-grupo B (item não casa nem com cancelados) | **Política: atribuir ao squad do contrato ATIVO de maior valor** do mesmo CNPJ |
| 3 | DOT e similares (item casa com contrato cancelado) | **Incluir contratos cancelados/zerados na CTE de matching** — match histórico vale |
| 4 | Squad de contrato cancelado | **Manter o squad original** mesmo se a squad foi reorganizada (preserva histórico) |
| 5 | LANCAMENTO_FINANCEIRO / RENEGOCIACAO (R$ 24k/mês, sem `venda_id`) | **Política "maior valor de contrato ativo"** ou "Sem Squad" se cliente sem contrato |

---

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `server/contribuicaoSquad/receitaPorItens.ts` | Modify | Query SQL principal: incluir cancelados, rateio, fallback, retornar causa |
| `server/contribuicaoSquad/matchPipeline.ts` | Modify | Manter sincronizado com mudanças de aliases/stopwords |
| `server/contribuicaoSquad/matchPipeline.test.ts` | Modify | Adicionar testes para novos aliases e fallback |
| `server/routes.ts` (5347–5780) | Modify | Fase 1: usar nova estrutura de retorno; Fase 2: remover simulador A3 |
| `server/contribuicaoSquad/simulator.ts` | Delete (Fase 2) | Eliminar simulação FIFO |
| `client/src/pages/ContribuicaoSquad.tsx` | Modify | Mostrar causa na expansão de "⚠️ Sem Squad" |
| `scripts/validateSquadVsDFC.ts` | Create | Script de validação automatizada (compara mês a mês) |
| `migrations/2026-04-16-aliases-novos.sql` | Create | INSERTs no `cortex_core.item_alias_map` |

---

## Fase 1: Robustecer matching

### Task 1: Branch + worktree

**Files:** N/A (operação git)

- [ ] **Step 1: Criar feature branch a partir de main**

```bash
cd /Users/mac0267/Cortex
git fetch origin
git worktree add -b feature/receita-squad-100pct .claude/worktrees/receita-squad-100pct origin/main
cd .claude/worktrees/receita-squad-100pct
```

- [ ] **Step 2: Confirmar branch limpa**

Run: `git status`
Expected: `nothing to commit, working tree clean`

---

### Task 2: Aliases novos (SQL migration)

**Files:**
- Create: `migrations/2026-04-16-aliases-novos.sql`

Decisão alinhada: 6 aliases para casos identificados no diagnóstico de jan/26 (Sub-grupo A da Causa 2).

- [ ] **Step 1: Criar arquivo de migração**

Create `migrations/2026-04-16-aliases-novos.sql`:

```sql
-- Aliases adicionados para reduzir órfãos identificados no diagnóstico de jan/2026.
-- Contexto: docs/superpowers/plans/2026-04-16-receita-squad-100pct-itens.md
INSERT INTO cortex_core.item_alias_map (item_pattern, target_token, active) VALUES
  ('account manegement',  'consultoria',  true),  -- typo Calebito
  ('account management',  'consultoria',  true),  -- forma correta (defensiva)
  ('agente ia',           'automacao',    true),  -- Grupo Fibra
  ('broadcast',           'email',        true),  -- SIOMARA Isadora Duncan
  ('mentoria',            'consultoria',  true),  -- Genesis Company (preventivo)
  ('criacao de conteudo', 'creators',     true)   -- Agência Conteúdo (quando cadastrarem)
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Aplicar em produção (GCP) e local**

Run:
```bash
PGPASSWORD='Turbosenha*' psql -h 34.95.249.110 -U postgres -d dados_turbo -f migrations/2026-04-16-aliases-novos.sql
PGPASSWORD='dev123' psql -h localhost -U cortex -d cortex_dev -f migrations/2026-04-16-aliases-novos.sql
```

Expected: `INSERT 0 6` (ou menos se houver duplicatas).

- [ ] **Step 3: Validar inserção**

Run: `PGPASSWORD='Turbosenha*' psql -h 34.95.249.110 -U postgres -d dados_turbo -c "SELECT item_pattern, target_token FROM cortex_core.item_alias_map WHERE active=true ORDER BY item_pattern"`

Expected: lista contém os 6 novos pares.

- [ ] **Step 4: Commit**

```bash
git add migrations/2026-04-16-aliases-novos.sql
git commit -m "feat(receita-squad): adicionar 6 aliases para reduzir órfãos identificados em jan/26"
```

---

### Task 3: Incluir contratos cancelados/zerados na CTE de matching

**Files:**
- Modify: `server/contribuicaoSquad/receitaPorItens.ts:97-111`

Hoje a CTE `contratos` filtra `(valorr > 0 OR valorp > 0)` e exclui contratos cancelados com valores zerados — perdemos clientes como DOT que têm "Performance" cancelado mas continuam pagando "Variável Mensal" (alias → performance).

- [ ] **Step 1: Atualizar a CTE `contratos`**

In `server/contribuicaoSquad/receitaPorItens.ts`, replace the `contratos` CTE (linhas ~97-111):

```typescript
contratos AS (
  SELECT
    REPLACE(REPLACE(REPLACE(COALESCE(cl.cnpj, ''), '.', ''), '-', ''), '/', '') AS cnpj_limpo,
    ct.id_subtask,
    ct.servico AS contrato_raw,
    COALESCE(NULLIF(TRIM(ct.squad), ''), '⚠️ Sem Squad') AS squad,
    GREATEST(COALESCE(ct.valorr::numeric, 0), COALESCE(ct.valorp::numeric, 0)) AS contrato_valor,
    -- Flag para priorizar contratos ativos no desempate
    CASE
      WHEN COALESCE(ct.valorr::numeric, 0) > 0 OR COALESCE(ct.valorp::numeric, 0) > 0 THEN 1
      ELSE 0
    END AS is_ativo,
    TRIM(REGEXP_REPLACE(REGEXP_REPLACE(LOWER(unaccent(ct.servico)), '[^a-z0-9 ]', ' ', 'g'), '\\s+', ' ', 'g')) AS contrato_norm,
    REGEXP_REPLACE(LOWER(unaccent(ct.servico)), '[^a-z0-9]', '', 'g') AS contrato_compact
  FROM "Clickup".cup_clientes cl
  JOIN "Clickup".cup_contratos ct ON cl.task_id = ct.id_task
  WHERE ct.servico IS NOT NULL AND TRIM(ct.servico) != ''
    -- REMOVIDO: filtro `(valorr > 0 OR valorp > 0)` — agora inclui cancelados/zerados
    -- para preservar match histórico (ex: cliente paga item de serviço já cancelado).
    AND cl.cnpj IS NOT NULL AND TRIM(cl.cnpj) != ''
),
```

- [ ] **Step 2: Atualizar o ORDER BY da CTE `melhor` para preferir contratos ativos**

In `server/contribuicaoSquad/receitaPorItens.ts`, replace lines ~147-154:

```typescript
melhor AS (
  SELECT DISTINCT ON (parcela_id, item_id)
    parcela_id::text, item_id::text, cnpj_limpo, cliente_nome, mes, item_raw, item_total::float8,
    id_subtask::text, squad, contrato_raw, prioridade
  FROM candidatos
  WHERE prioridade IS NOT NULL
  ORDER BY parcela_id, item_id, prioridade ASC, is_ativo DESC, contrato_valor DESC NULLS LAST
),
```

- [ ] **Step 3: Validar via SQL ad-hoc — DOT deve passar a casar**

Run:
```bash
PGPASSWORD='Turbosenha*' psql -h 34.95.249.110 -U postgres -d dados_turbo <<'SQL'
-- Reproduzir a query principal pra DOT em jan/2026 e ver o squad atribuído
-- (cole aqui a CTE completa do receitaPorItens.ts atualizado, filtrando cliente DOT)
SQL
```

Expected: DOT — itens "Variável Mensal" e "Referente a Aceleração Mensal" atribuídos ao squad ⚓️ Squadra (do contrato Performance cancelado).

- [ ] **Step 4: Reiniciar dev server e validar pelo navegador**

Run:
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; cd /Users/mac0267/Cortex/.claude/worktrees/receita-squad-100pct && npm run dev &
```

Aguardar startup, abrir `http://localhost:3000/contribuicao-squad?ano=2026`. "⚠️ Sem Squad" em janeiro deve cair de R$ 62.978 para ~R$ 50k.

- [ ] **Step 5: Commit**

```bash
git add server/contribuicaoSquad/receitaPorItens.ts
git commit -m "feat(receita-squad): incluir contratos cancelados no matching para preservar histórico"
```

---

### Task 4: Rateio proporcional do item_total

**Files:**
- Modify: `server/contribuicaoSquad/receitaPorItens.ts:74-86` (CTE `itens`)

Hoje cada parcela puxa `i.valor * i.quantidade` da venda inteira. Se uma venda de R$ 12k é parcelada em 12x, cada parcela recebe R$ 12k em itens (overcount 12x). Solução: ratear proporcionalmente ao quanto a parcela representa do total da venda.

- [ ] **Step 1: Buscar o total da venda no JOIN e ratear**

In `server/contribuicaoSquad/receitaPorItens.ts`, replace the `itens` CTE (linhas ~74-86):

```typescript
itens AS (
  SELECT
    pa.parcela_id, pa.cnpj_limpo, pa.cliente_nome, pa.mes, pa.valor_pago,
    i.id AS item_id,
    i.nome AS item_raw,
    -- Rateio proporcional: cada parcela leva sua fração dos itens da venda.
    -- Se a venda total é R$ 12k em 12 parcelas de R$ 1k, cada parcela leva 1/12 dos itens.
    -- Fallback: se v.total for NULL/0, usa valor_pago direto (degrada graciosamente).
    CASE
      WHEN COALESCE(v.total, 0) > 0
        THEN ((i.valor * i.quantidade) * (pa.valor_pago / v.total))::numeric
      ELSE (i.valor * i.quantidade)::numeric
    END AS item_total,
    TRIM(REGEXP_REPLACE(REGEXP_REPLACE(LOWER(unaccent(i.nome)), '[^a-z0-9 ]', ' ', 'g'), '\\s+', ' ', 'g')) AS item_norm,
    REGEXP_REPLACE(LOWER(unaccent(i.nome)), '[^a-z0-9]', '', 'g') AS item_compact
  FROM parcelas_ano pa
  JOIN "Conta Azul".caz_vendas_itens i
    ON CAST(i.venda_id AS text) = CAST(pa.venda_id AS text)
   AND i.empresa = pa.empresa
  LEFT JOIN "Conta Azul".caz_vendas v
    ON CAST(v.id AS text) = CAST(pa.venda_id AS text)
),
```

- [ ] **Step 2: Validar rateio via SQL — soma de itens da parcela deve ≈ valor_pago**

Run:
```bash
PGPASSWORD='Turbosenha*' psql -h 34.95.249.110 -U postgres -d dados_turbo <<'SQL'
-- Após o rateio, total atribuído por parcela deve bater com valor_pago (cobertura ≈ 100%)
WITH itens_rateados AS (
  -- (cole aqui a query completa atualizada, filtrando jan/2026)
  SELECT 1 -- placeholder
)
SELECT
  COUNT(*) AS qtd_parcelas,
  AVG(soma_itens / valor_pago) AS cobertura_media,
  COUNT(*) FILTER (WHERE ABS(soma_itens - valor_pago) < 0.01) AS cobertura_perfeita
FROM (
  SELECT parcela_id, valor_pago, SUM(item_total) AS soma_itens
  FROM itens_rateados
  GROUP BY parcela_id, valor_pago
) t;
SQL
```

Expected: `cobertura_media` ≈ 1.0 (não mais 1.4× como antes), `cobertura_perfeita` próxima do total.

- [ ] **Step 3: Validar pelo navegador**

Reiniciar dev server, recarregar `/contribuicao-squad?ano=2026`. Receita Total de janeiro deve subir (estava perdendo overcount escondido) E "Sem Squad" deve estabilizar.

- [ ] **Step 4: Commit**

```bash
git add server/contribuicaoSquad/receitaPorItens.ts
git commit -m "fix(receita-squad): ratear item_total proporcional ao valor_pago da parcela"
```

---

### Task 5: Fallback "contrato de maior valor"

**Files:**
- Modify: `server/contribuicaoSquad/receitaPorItens.ts` (CTE `orfaos`)

Hoje órfãos vão direto para "⚠️ Sem Squad". Política aprovada: se o CNPJ tem contratos no Clickup mas o item não casou em nenhuma das 5 prioridades, atribuir ao squad do **contrato ATIVO de maior valor** (preferir `valorr`, depois `valorp`).

- [ ] **Step 1: Substituir a CTE `orfaos` por nova lógica em duas etapas**

In `server/contribuicaoSquad/receitaPorItens.ts`, replace the `orfaos` CTE (linhas ~155-169):

```typescript
fallback_por_cnpj AS (
  -- Para cada CNPJ, escolhe o contrato ATIVO de maior valor como fallback.
  SELECT DISTINCT ON (cnpj_limpo)
    cnpj_limpo, id_subtask, squad, contrato_raw
  FROM contratos_tok
  WHERE is_ativo = 1
  ORDER BY cnpj_limpo, contrato_valor DESC NULLS LAST
),
orfaos AS (
  SELECT DISTINCT
    i.parcela_id::text,
    i.item_id::text,
    i.cnpj_limpo,
    i.cliente_nome,
    i.mes,
    i.item_raw,
    i.item_total::float8,
    fb.id_subtask::text AS id_subtask,
    COALESCE(fb.squad, '⚠️ Sem Squad')::text AS squad,
    fb.contrato_raw::text AS contrato_raw,
    CASE WHEN fb.id_subtask IS NOT NULL THEN 99 ELSE NULL END::int AS prioridade
    -- prioridade 99 = "fallback contrato maior valor" (acima de 5, abaixo de NULL/órfão real)
  FROM itens_tok i
  LEFT JOIN fallback_por_cnpj fb ON fb.cnpj_limpo = i.cnpj_limpo
  WHERE NOT EXISTS (
    SELECT 1 FROM candidatos c
    WHERE c.parcela_id = i.parcela_id
      AND c.item_id = i.item_id
      AND c.prioridade IS NOT NULL
  )
)
```

- [ ] **Step 2: Validar — "Sem Squad" em jan/26 deve cair para ~R$ 36k (apenas Causa 1)**

Run:
```bash
PGPASSWORD='Turbosenha*' psql -h 34.95.249.110 -U postgres -d dados_turbo <<'SQL'
-- Total de "⚠️ Sem Squad" REAL em jan/2026 (após Tasks 3+4+5)
-- Esperado: apenas os 5 clientes Causa 1 (R$ 36k)
SELECT SUM(item_total) AS total_sem_squad
FROM (/* cole a query atualizada */) x
WHERE squad = '⚠️ Sem Squad' AND mes = '2026-01';
SQL
```

Expected: ~R$ 36k (só Causa 1), não mais R$ 62k.

- [ ] **Step 3: Validar pelo navegador**

Recarregar `/contribuicao-squad?ano=2026`. "⚠️ Sem Squad" janeiro ≈ R$ 36k.

- [ ] **Step 4: Commit**

```bash
git add server/contribuicaoSquad/receitaPorItens.ts
git commit -m "feat(receita-squad): fallback contrato de maior valor para itens sem match"
```

---

### Task 6: Expor causa na resposta da API

**Files:**
- Modify: `server/contribuicaoSquad/receitaPorItens.ts` (interface + SELECT final)
- Modify: `server/routes.ts` (passar causa pro frontend)

Bucket "Sem Squad" precisa mostrar a causa quando expandido para o usuário tomar ação (cadastrar cliente, criar contrato, etc.).

- [ ] **Step 1: Adicionar campo `causa` na CTE final**

In `server/contribuicaoSquad/receitaPorItens.ts`, dentro do SELECT final (linhas ~170-177), adicionar uma coluna `causa`:

```typescript
SELECT
  parcela_id, item_id, cnpj_limpo, cliente_nome, mes, item_raw, item_total,
  id_subtask, squad, contrato_raw, prioridade,
  CASE
    WHEN prioridade BETWEEN 1 AND 5 THEN 'match'
    WHEN prioridade = 99 THEN 'fallback_maior_valor'
    WHEN squad = '⚠️ Sem Squad' AND NOT EXISTS (
      SELECT 1 FROM contratos c WHERE c.cnpj_limpo = melhor.cnpj_limpo
    ) THEN 'cnpj_sem_contrato_clickup'
    ELSE 'item_nao_casou'
  END AS causa
FROM melhor
UNION ALL
SELECT
  parcela_id, item_id, cnpj_limpo, cliente_nome, mes, item_raw, item_total,
  id_subtask, squad, contrato_raw, prioridade,
  CASE
    WHEN prioridade = 99 THEN 'fallback_maior_valor'
    WHEN NOT EXISTS (SELECT 1 FROM contratos c WHERE c.cnpj_limpo = orfaos.cnpj_limpo) THEN 'cnpj_sem_contrato_clickup'
    ELSE 'item_nao_casou'
  END AS causa
FROM orfaos
```

- [ ] **Step 2: Atualizar interface TypeScript**

In `server/contribuicaoSquad/receitaPorItens.ts`, atualizar `ReceitaItemRow` e `ReceitaItemLinha`:

```typescript
type ReceitaItemRow = {
  parcela_id: string;
  item_id: string;
  cnpj_limpo: string;
  cliente_nome: string;
  mes: string;
  item_raw: string;
  item_total: string | number;
  id_subtask: string | null;
  squad: string;
  contrato_raw: string | null;
  prioridade: number | null;
  causa: 'match' | 'fallback_maior_valor' | 'cnpj_sem_contrato_clickup' | 'item_nao_casou';
};

export interface ReceitaItemLinha {
  parcelaId: string;
  itemId: string;
  cnpjLimpo: string;
  clienteNome: string;
  mes: string;
  itemRaw: string;
  itemTotal: number;
  idSubtask: string | null;
  squad: string;
  contratoRaw: string | null;
  prioridade: number | null;
  causa: 'match' | 'fallback_maior_valor' | 'cnpj_sem_contrato_clickup' | 'item_nao_casou';
}
```

E o map final:
```typescript
return (result.rows as ReceitaItemRow[]).map((row): ReceitaItemLinha => ({
  parcelaId: row.parcela_id,
  itemId: row.item_id,
  cnpjLimpo: row.cnpj_limpo ?? '',
  clienteNome: row.cliente_nome,
  mes: row.mes,
  itemRaw: row.item_raw,
  itemTotal: Number(row.item_total) || 0,
  idSubtask: row.id_subtask ?? null,
  squad: row.squad,
  contratoRaw: row.contrato_raw ?? null,
  prioridade: row.prioridade != null ? Number(row.prioridade) : null,
  causa: row.causa,
}));
```

- [ ] **Step 3: Propagar causa em routes.ts**

In `server/routes.ts`, na agregação de `receitaItens` no `mesesMap` (linhas ~5633-5680ish), incluir `causa` nos `parcelas` do `srv`:

```typescript
srv.parcelas.push({
  id: linha.idSubtask,
  valor: linha.itemTotal,
  dataQuitacao: null,
  linkNfse: null,
  numNfse: null,
  urlCobranca: null,
  clienteNome: linha.clienteNome,
  servicoNome: linha.itemRaw,
  squad: linha.squad,
  causa: linha.causa,  // NOVO
});
```

E adicionar `causa?: string` no type `ParcelaInfo`.

- [ ] **Step 4: Reiniciar server e validar resposta API**

Run:
```bash
curl -s 'http://localhost:3000/api/contribuicao-squad/dfc/bulk?ano=2026&squad=todos' \
  | jq '.meses["2026-01"].categorias["Sem Categoria"].clientes | to_entries | map(.value.servicos | to_entries | map(.value.parcelas[].causa))[0]'
```

Expected: array com valores em `['match', 'fallback_maior_valor', 'cnpj_sem_contrato_clickup', 'item_nao_casou']`.

- [ ] **Step 5: Commit**

```bash
git add server/contribuicaoSquad/receitaPorItens.ts server/routes.ts
git commit -m "feat(receita-squad): expor causa de atribuição (match/fallback/orphan) na API"
```

---

### Task 7: UI "Sem Squad" enriquecida

**Files:**
- Modify: `client/src/pages/ContribuicaoSquad.tsx`

Quando expandir o bucket "⚠️ Sem Squad", mostrar a causa de cada parcela com badge colorida + lista de ações sugeridas (cadastrar cliente / criar contrato).

- [ ] **Step 1: Identificar onde "Sem Squad" é renderizado**

Run: `grep -n "Sem Squad\|SEM_SQUAD" client/src/pages/ContribuicaoSquad.tsx | head -20`

Localizar a célula de expansão do squad.

- [ ] **Step 2: Renderizar badge da causa em cada parcela**

In `client/src/pages/ContribuicaoSquad.tsx`, na lista de parcelas dentro do bucket "⚠️ Sem Squad", adicionar:

```tsx
{parcela.causa && (
  <span className={
    "ml-2 px-2 py-0.5 text-xs rounded " +
    (parcela.causa === 'cnpj_sem_contrato_clickup'
      ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
      : parcela.causa === 'item_nao_casou'
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400')
  }>
    {parcela.causa === 'cnpj_sem_contrato_clickup' && 'Cadastrar no Clickup'}
    {parcela.causa === 'item_nao_casou' && 'Item sem match'}
    {parcela.causa === 'fallback_maior_valor' && 'Atribuído por fallback'}
  </span>
)}
```

- [ ] **Step 3: Atualizar tipo TypeScript da parcela no frontend**

Localizar a interface `ParcelaInfo` no frontend (provavelmente em `ContribuicaoSquad.tsx` ou em `shared/types.ts`) e adicionar `causa?: 'match' | 'fallback_maior_valor' | 'cnpj_sem_contrato_clickup' | 'item_nao_casou';`.

- [ ] **Step 4: Validar no navegador (dark + light mode)**

Recarregar `/contribuicao-squad?ano=2026`. Expandir "⚠️ Sem Squad" de janeiro. Cada parcela deve ter badge identificando a causa. Trocar tema e revalidar contraste.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/ContribuicaoSquad.tsx
git commit -m "feat(receita-squad): mostrar causa de órfão (cadastro/match) no bucket Sem Squad"
```

---

### Task 8: Script de validação automatizada Squad vs DFC

**Files:**
- Create: `scripts/validateSquadVsDFC.ts`

Comparar mês a mês os totais das duas APIs (Squad e DFC) e reportar divergências. Roda em CI ou manualmente.

- [ ] **Step 1: Criar o script**

Create `scripts/validateSquadVsDFC.ts`:

```typescript
/**
 * Validação automatizada: compara Receita Total mensal entre
 * /api/contribuicao-squad/dfc/bulk (Squad) e /api/dfc (DFC).
 *
 * Uso: npx tsx scripts/validateSquadVsDFC.ts [ano]
 * Padrão: ano corrente.
 *
 * Limite de divergência aceitável: 2% (clientes só no Conta Azul + LANCAMENTO/RENEGOCIACAO).
 * Se exceder, exit code 1.
 */
import { db } from '../server/db';
import { sql } from 'drizzle-orm';

const TOLERANCIA_PCT = 0.02;
const ANO = parseInt(process.argv[2]) || new Date().getFullYear();

async function totalDFC(ano: number): Promise<Map<string, number>> {
  const r = await db.execute(sql`
    SELECT TO_CHAR(p.data_quitacao, 'YYYY-MM') AS mes,
           SUM(COALESCE(p.valor_pago::numeric, 0) - COALESCE(p.desconto::numeric, 0)) AS total
    FROM "Conta Azul".caz_parcelas p
    WHERE p.tipo_evento = 'RECEITA'
      AND p.status IN ('QUITADO', 'RECEBIDO_PARCIAL')
      AND EXTRACT(YEAR FROM p.data_quitacao) = ${ano}
    GROUP BY 1 ORDER BY 1
  `);
  return new Map((r.rows as any[]).map(x => [x.mes, Number(x.total)]));
}

async function totalSquad(ano: number): Promise<Map<string, number>> {
  const res = await fetch(`http://localhost:3000/api/contribuicao-squad/dfc/bulk?ano=${ano}&squad=todos`);
  const data = await res.json() as { meses: Record<string, { receitaTotal: number }> };
  return new Map(Object.entries(data.meses).map(([m, v]) => [m, v.receitaTotal]));
}

async function main() {
  const [dfc, squad] = await Promise.all([totalDFC(ANO), totalSquad(ANO)]);
  const meses = Array.from(new Set([...dfc.keys(), ...squad.keys()])).sort();

  console.log(`\nValidação Squad vs DFC — ano ${ANO}\n`);
  console.log('Mês       | DFC          | Squad        | Δ            | %     | OK?');
  console.log('----------+--------------+--------------+--------------+-------+----');

  let falhou = false;
  for (const mes of meses) {
    const d = dfc.get(mes) || 0;
    const s = squad.get(mes) || 0;
    const delta = s - d;
    const pct = d > 0 ? Math.abs(delta) / d : 0;
    const ok = pct <= TOLERANCIA_PCT;
    if (!ok) falhou = true;
    console.log(
      `${mes}   | ${d.toFixed(2).padStart(12)} | ${s.toFixed(2).padStart(12)} | ${delta.toFixed(2).padStart(12)} | ${(pct*100).toFixed(2).padStart(5)}% | ${ok ? '✓' : '✗'}`
    );
  }

  if (falhou) {
    console.error(`\nFALHA: divergência > ${TOLERANCIA_PCT*100}% em algum mês`);
    process.exit(1);
  }
  console.log(`\nOK: todos os meses dentro de ${TOLERANCIA_PCT*100}%`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(2); });
```

- [ ] **Step 2: Rodar validação para 2026**

Run: `npx tsx scripts/validateSquadVsDFC.ts 2026`

Expected (Fase 1 ainda sem backfill):
- Janeiro: divergência ~3-4% (~R$ 50k de Causa 1 + R$ 24k de LANCAMENTO/RENEGOCIACAO)
- Provavelmente FALHA — esse é o esperado, indica que a Fase 2 (backfill) ainda é necessária.

- [ ] **Step 3: Documentar no script o threshold pós-backfill**

Acima de `const TOLERANCIA_PCT = 0.02;`, adicionar comentário:

```typescript
// Threshold:
// - Pré-backfill: ~5% de divergência esperada (vendas históricas sem itens).
// - Pós-backfill (Fase 2): 2% (apenas clientes só no Conta Azul + LANCAMENTO/RENEGOCIACAO).
// Após Fase 2 + backfill, deve cair para <0.5%.
```

- [ ] **Step 4: Commit**

```bash
git add scripts/validateSquadVsDFC.ts
git commit -m "test(receita-squad): script de validação automatizada Squad vs DFC mensal"
```

---

### Task 9: Atualizar matchPipeline.ts (referência testável)

**Files:**
- Modify: `server/contribuicaoSquad/matchPipeline.ts`
- Modify: `server/contribuicaoSquad/matchPipeline.test.ts`

`matchPipeline.ts` é a referência TS testável das regras de normalização (header explica). Precisa ficar em sincronia com os 6 aliases novos e a lógica de fallback.

- [ ] **Step 1: Verificar testes existentes e adicionar casos novos**

Run: `npm test -- matchPipeline.test.ts`

- [ ] **Step 2: Adicionar testes para os novos aliases**

In `server/contribuicaoSquad/matchPipeline.test.ts`, adicionar:

```typescript
describe('aliases novos (jan/26)', () => {
  it('mapeia "account manegement" (typo) para consultoria', () => {
    expect(resolveAlias('account manegement')).toContain('consultoria');
  });
  it('mapeia "agente ia" para automacao', () => {
    expect(resolveAlias('agente ia')).toContain('automacao');
  });
  it('mapeia "broadcast" para email', () => {
    expect(resolveAlias('broadcast')).toContain('email');
  });
  it('mapeia "criacao de conteudo" para creators', () => {
    expect(resolveAlias('criacao de conteudo')).toContain('creators');
  });
});
```

(Se `resolveAlias` não existir como função pura, usar a função equivalente que carrega `item_alias_map`. Verificar implementação atual.)

- [ ] **Step 3: Rodar testes**

Run: `npm test -- matchPipeline.test.ts`
Expected: todos passam.

- [ ] **Step 4: Commit**

```bash
git add server/contribuicaoSquad/matchPipeline.test.ts
git commit -m "test(receita-squad): cobrir aliases novos no matchPipeline"
```

---

### Task 10: Validação manual end-to-end + abrir PR Fase 1

**Files:** N/A

- [ ] **Step 1: Build production**

Run: `npm run build`
Expected: zero errors.

- [ ] **Step 2: Rodar script de validação final**

Run: `npx tsx scripts/validateSquadVsDFC.ts 2026 | tee /tmp/validation-fase1.txt`

- [ ] **Step 3: Comparar Sem Squad antes/depois**

| | Antes | Depois (Fase 1) |
|---|---|---|
| Sem Squad jan/26 | R$ 62.978 | ~R$ 36k esperado |
| Sem Squad fev/26 | R$ 93.766 | esperado <50k |
| Sem Squad mar/26 | R$ 95.313 | esperado <50k |
| Sem Squad abr/26 | R$ 45.524 | esperado <30k |

- [ ] **Step 4: Abrir PR para staging**

```bash
gh pr create --title "feat(receita-squad): robustecer matching para reduzir Sem Squad (Fase 1)" --body "$(cat <<'EOF'
## Summary
- Inclui contratos cancelados/zerados no matching (resolve casos como DOT)
- Rateio proporcional do item_total por valor_pago (corrige overcount em parcelamentos)
- Fallback "contrato de maior valor" para itens sem match
- 6 aliases novos para casos identificados em jan/26
- Bucket "Sem Squad" mostra causa (cadastro vs item sem match)
- Script automatizado de validação Squad vs DFC

## Resultado esperado
- Sem Squad em jan/26: R$ 62.978 → ~R$ 36k (apenas Causa 1: clientes só no Conta Azul)
- Divergência total Squad vs DFC: 13% → ~5% (resíduo é vendas históricas sem itens — endereçado na Fase 2)

## Pré-requisito da Fase 2
Backfill de \`caz_vendas_itens\` para vendas pré-2026 e vendas agendadas.

## Test plan
- [ ] \`npx tsx scripts/validateSquadVsDFC.ts 2026\` divergência <5%
- [ ] Bucket Sem Squad em jan/26 ≈ R$ 36k
- [ ] DOT atribuído à ⚓️ Squadra (via contrato Performance cancelado)
- [ ] UI mostra badge de causa em dark + light mode

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Fase 2: Arrancar simulador (BLOQUEADA até backfill operacional)

> **GATE:** Esta fase só pode ser executada APÓS o backfill de `caz_vendas_itens` cobrir vendas pré-2026 e agendadas (atual: 38% gap em jan/26 vem daí).
>
> Verificação: `npx tsx scripts/validateSquadVsDFC.ts 2026` — divergência <2% em todos os meses.

### Task 11: Confirmar backfill operacional

- [ ] **Step 1: Validar cobertura por ano**

Run:
```bash
PGPASSWORD='Turbosenha*' psql -h 34.95.249.110 -U postgres -d dados_turbo <<'SQL'
SELECT EXTRACT(YEAR FROM v.data)::int AS ano, v.empresa,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Conta Azul".caz_vendas_itens i WHERE i.venda_id::text = v.id::text)) AS com_itens
FROM "Conta Azul".caz_vendas v WHERE v.data IS NOT NULL
GROUP BY 1, 2 ORDER BY 1 DESC, 2;
SQL
```

Expected: cada (ano, empresa) tem `com_itens >= total * 0.98`.

- [ ] **Step 2: Rodar validação**

Run: `npx tsx scripts/validateSquadVsDFC.ts 2026`
Expected: todos os meses <2% de divergência. Se exceder, NÃO PROSSEGUIR — investigar gap residual.

---

### Task 12: Remover simulador A3

**Files:**
- Delete: `server/contribuicaoSquad/simulator.ts`
- Modify: `server/routes.ts:5347-5780`

- [ ] **Step 1: Remover importação do simulador**

In `server/routes.ts`, remover a linha de import de `simulator.ts` e qualquer uso de `simulateCliente`, `ContratoSim`, `ClienteSim`.

- [ ] **Step 2: Remover Query 1 (contratos) e Query 2 (pagamentos) do endpoint**

In `server/routes.ts:5436-5486`, deletar as duas queries SQL e toda a lógica de montar `clientesMap`, chamar `simulateCliente`, e iterar `cliente.contratos` para popular `mesesMap`. Manter apenas o bloco `for (const linha of receitaItens)` que mescla itens (linhas ~5633+).

- [ ] **Step 3: Remover exclusão `parcelasCobertas`**

In `server/routes.ts:5397-5398`, remover `parcelasCobertasSet = parcelasCobertas(...)` e `totalParcelasElegiveis` (não há mais double-counting a evitar).

Em `receitaPorItens.ts`, deletar a função exportada `parcelasCobertas` (não mais usada).

- [ ] **Step 4: Deletar arquivo do simulador**

```bash
rm server/contribuicaoSquad/simulator.ts
```

- [ ] **Step 5: Garantir que testes do simulador foram removidos**

Run: `find . -name 'simulator.test.ts' -delete`
Run: `npm test`
Expected: zero erros de import.

- [ ] **Step 6: Validar — totais devem permanecer iguais ou melhorar**

Run: `npx tsx scripts/validateSquadVsDFC.ts 2026`
Expected: <2% em todos os meses (ideal <0.5%).

- [ ] **Step 7: Validar pelo navegador**

Recarregar `/contribuicao-squad?ano=2026`. Receita Total de janeiro deve estar ≈ R$ 1.235k (DFC R$ 1.259k − R$ 24k de LANCAMENTO/RENEGOCIACAO).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(receita-squad): remover simulador FIFO — pipeline de itens é a única fonte"
```

---

### Task 13: PR Fase 2

- [ ] **Step 1: Validação final**

Run: `npm run build && npm test && npx tsx scripts/validateSquadVsDFC.ts 2026`

- [ ] **Step 2: PR**

```bash
gh pr create --title "refactor(receita-squad): remover simulador FIFO (Fase 2)" --body "$(cat <<'EOF'
## Summary
Remove server/contribuicaoSquad/simulator.ts e o pipeline de fallback no endpoint /api/contribuicao-squad/dfc/bulk. Agora a única fonte de atribuição é caz_vendas_itens.

## Pré-requisito atendido
Backfill de caz_vendas_itens para anos históricos concluído. Validação script <2% em todos os meses de 2026.

## Resultado
Squad vs DFC: divergência <0.5% (resíduo: LANCAMENTO_FINANCEIRO + RENEGOCIACAO sem venda_id, ~R$ 24k/mês = bucket Sem Squad com causa visível).

## Test plan
- [ ] npx tsx scripts/validateSquadVsDFC.ts 2026 < 0.5%
- [ ] Sem regressão visual em /contribuicao-squad

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Notas finais para o engenheiro executor

1. **Não pular a ordem das tasks da Fase 1**: cada uma reduz independentemente o "Sem Squad" e a Task 8 (script de validação) precisa do código das Tasks 3-7 para medir corretamente.
2. **Fase 2 é GATED**: rodar Task 11 antes. Se backfill não estiver pronto, parar e abrir issue operacional.
3. **Em produção, aplicar Tasks 2 (SQL) primeiro em local + prod ANTES de deploy do código** — assim a query nova já encontra os aliases.
4. **Dark/light mode obrigatório** na Task 7 (UI).
5. **Não amend commits** — sempre commit novo por task.
6. **Restartar `npm run dev` após mudar receitaPorItens.ts** (não tem watch mode).
