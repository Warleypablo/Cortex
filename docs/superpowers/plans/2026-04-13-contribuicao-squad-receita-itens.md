# Contribuição por Squad — Receita via Itens de Venda — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o simulador A3 de atribuição de receita por squad pelo pipeline que usa `caz_vendas_itens` com match direto contrato↔item via pipeline (exato → substring → alias → token → fuzzy → "Sem Squad"), mantendo o simulador A3 como fallback para parcelas sem `venda_id`.

**Architecture:** Nova tabela `cortex_core.item_alias_map` para aliases curados. Query SQL com CTEs que normaliza nomes, gera tokens significativos e ranqueia candidatos por prioridade. Handler `/api/contribuicao-squad/dfc/bulk` roda pipeline novo primeiro (parcelas com `venda_id`) e usa simulador A3 como fallback para o que não foi coberto. Frontend ganha bucket explícito "⚠️ Sem Squad" e indicador de fonte dos dados (% via itens vs % via fallback).

**Tech Stack:** PostgreSQL (pg_trgm, unaccent), TypeScript, Drizzle ORM, Express, React + TanStack Query.

**Spec:** `docs/superpowers/specs/2026-04-13-contribuicao-squad-receita-itens-design.md`

---

## Branch

Criar nova feature branch a partir de `main`:

```bash
git checkout main && git pull origin main
git checkout -b feature/contribuicao-squad-itens-venda
```

> Nota: a branch atual `feature/despesas-atribuicao-real` é de outra feature e não deve ser misturada. Confirmar com o usuário se prefere worktree isolada via `superpowers:using-git-worktrees`.

---

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `shared/schema.ts` | Modify | Definir `itemAliasMap` em `cortex_core` |
| `server/db.ts` | Modify | Função `initializeItemAliasMapTable()` + seed inicial |
| `server/index.ts` ou onde tables são inicializadas | Modify | Chamar a nova init |
| `server/contribuicaoSquad/matchPipeline.ts` | Create | Helpers puros de normalização e matching (testáveis) |
| `server/contribuicaoSquad/matchPipeline.test.ts` | Create | Testes unitários dos helpers |
| `server/contribuicaoSquad/receitaPorItens.ts` | Create | Função `getReceitaPorItens(ano)` que roda a query SQL e devolve linhas `{parcela_id, item_id, squad, valor, mes, ...}` |
| `server/routes.ts` (~5348–5660) | Modify | Handler `/api/contribuicao-squad/dfc/bulk` — integrar novo pipeline + fallback A3 |
| `client/src/pages/ContribuicaoSquad.tsx` | Modify | Mostrar "⚠️ Sem Squad" bucket, badge de fonte de dados, drill-down dos órfãos |
| `scripts/compareSquadReceita.ts` | Create | Script de validação — roda os dois métodos e compara |

---

## Tasks

### Task 1: Criar tabela `cortex_core.item_alias_map`

**Files:**
- Modify: `shared/schema.ts` (adicionar após o bloco de tabelas `cortex_core`, ~linha 1572)
- Modify: `server/db.ts` (nova função de inicialização)

- [ ] **Step 1: Adicionar definição Drizzle em `shared/schema.ts`**

Localizar o último `cortexCoreSchema.table(...)` antes da seção `pgTable` normal (~linha 1572, após `iaHubMensagens`). Adicionar:

```typescript
// Item Alias Map — aliases para match item (Conta Azul) ↔ contrato (ClickUp)
// Usado pela aba Contribuição por Squad para atribuir receita correta quando
// o nome do item não casa literalmente com o serviço do contrato.
export const itemAliasMap = cortexCoreSchema.table("item_alias_map", {
  id: serial("id").primaryKey(),
  itemPattern: varchar("item_pattern", { length: 255 }).notNull(),
  targetToken: varchar("target_token", { length: 100 }).notNull(),
  notes: text("notes"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type ItemAliasMap = typeof itemAliasMap.$inferSelect;
```

- [ ] **Step 2: Criar função de inicialização em `server/db.ts`**

Localizar outras funções `initializeXxxTable` (ex: `initializeNotificationsTable` ~linha 47, `initializeIaHubTables`). Adicionar função nova no mesmo padrão:

```typescript
export async function initializeItemAliasMapTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_core.item_alias_map (
        id SERIAL PRIMARY KEY,
        item_pattern VARCHAR(255) NOT NULL,
        target_token VARCHAR(100) NOT NULL,
        notes TEXT,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_item_alias_map_pattern_active
      ON cortex_core.item_alias_map (item_pattern) WHERE active = true
    `);

    // Seed inicial — só insere se a tabela estiver vazia
    const existing = await db.execute(sql`
      SELECT COUNT(*)::int AS qtd FROM cortex_core.item_alias_map
    `);
    const count = Number((existing.rows[0] as any)?.qtd) || 0;
    if (count === 0) {
      await db.execute(sql`
        INSERT INTO cortex_core.item_alias_map (item_pattern, target_token, notes) VALUES
          ('aceleracao', 'performance', 'Aceleração Scale/Enterprise são variantes de Performance'),
          ('trafego pago', 'performance', 'Nome alternativo no CAZ'),
          ('trafego', 'performance', 'Nome alternativo no CAZ'),
          ('referente a aceleracao mensal', 'performance', 'Texto livre recorrente'),
          ('contrato personalizado', 'performance', 'Grupo Tommasi — cliente só tem squads Performance'),
          ('variavel mensal', 'performance', 'Tipo de cobrança — sempre Performance em 2026'),
          ('gameplan', 'gameplan', 'Mantém o termo para desambiguar'),
          ('desenvolvimento de e commerce', 'ecommerce', 'Mesma coisa no Tech'),
          ('sustentacao de site e ecommerce', 'ecommerce', 'Idem')
      `);
      console.log('[init] item_alias_map seeded com 9 aliases iniciais');
    }
  } catch (error) {
    console.error('[init] erro ao inicializar item_alias_map:', error);
    throw error;
  }
}
```

- [ ] **Step 3: Chamar a init no bootstrap**

Localizar onde outras `initializeXxxTable` são chamadas. Verificar com:

```bash
grep -n "initialize.*Table()" server/index.ts server/db.ts | head
```

Adicionar a chamada `initializeItemAliasMapTable()` no mesmo bloco, na sequência.

- [ ] **Step 4: Criar a tabela no banco de produção manualmente**

Por CLAUDE.md (memória `feedback_db_prod_sync`): mudanças de schema precisam ir também pro banco de produção, não só local.

```bash
PGPASSWORD='Turbosenha*' psql -h 34.95.249.110 -U postgres -d dados_turbo <<'SQL'
CREATE TABLE IF NOT EXISTS cortex_core.item_alias_map (
  id SERIAL PRIMARY KEY,
  item_pattern VARCHAR(255) NOT NULL,
  target_token VARCHAR(100) NOT NULL,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_item_alias_map_pattern_active
ON cortex_core.item_alias_map (item_pattern) WHERE active = true;

INSERT INTO cortex_core.item_alias_map (item_pattern, target_token, notes) VALUES
  ('aceleracao', 'performance', 'Aceleração Scale/Enterprise são variantes de Performance'),
  ('trafego pago', 'performance', 'Nome alternativo no CAZ'),
  ('trafego', 'performance', 'Nome alternativo no CAZ'),
  ('referente a aceleracao mensal', 'performance', 'Texto livre recorrente'),
  ('contrato personalizado', 'performance', 'Grupo Tommasi — cliente só tem squads Performance'),
  ('variavel mensal', 'performance', 'Tipo de cobrança — sempre Performance em 2026'),
  ('gameplan', 'gameplan', 'Mantém o termo para desambiguar'),
  ('desenvolvimento de e commerce', 'ecommerce', 'Mesma coisa no Tech'),
  ('sustentacao de site e ecommerce', 'ecommerce', 'Idem')
ON CONFLICT DO NOTHING;

SELECT COUNT(*) FROM cortex_core.item_alias_map WHERE active = true;
SQL
```

Expected: `9` rows.

- [ ] **Step 5: Commit**

```bash
git add shared/schema.ts server/db.ts
git commit -m "feat(contribuicao-squad): adiciona tabela item_alias_map com seed inicial"
```

---

### Task 2: Helpers puros de normalização e matching (TS)

**Files:**
- Create: `server/contribuicaoSquad/matchPipeline.ts`
- Create: `server/contribuicaoSquad/matchPipeline.test.ts`

Esses helpers não são usados na query SQL principal (que faz tudo inline), mas servem para:
- Documentar a lógica em um lugar testável.
- Ser reutilizados pelo script de comparação (Task 7) e pela eventual UI admin de aliases.

- [ ] **Step 1: Escrever testes primeiro (TDD)**

Criar `server/contribuicaoSquad/matchPipeline.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  normalizeNome,
  compactNome,
  tokenizeNome,
  STOPWORDS,
} from './matchPipeline';

describe('normalizeNome', () => {
  it('lowercase e unaccent', () => {
    expect(normalizeNome('Gestão de Performance')).toBe('gestao de performance');
  });

  it('remove pontuação para espaço', () => {
    expect(normalizeNome('E-commerce / Premium')).toBe('e commerce premium');
  });

  it('collapse whitespace', () => {
    expect(normalizeNome('  Social   Media  ')).toBe('social media');
  });

  it('string vazia', () => {
    expect(normalizeNome('')).toBe('');
  });
});

describe('compactNome', () => {
  it('remove todos os não-alfanuméricos', () => {
    expect(compactNome('E-commerce')).toBe('ecommerce');
    expect(compactNome('E commerce')).toBe('ecommerce');
    expect(compactNome('Ecommerce')).toBe('ecommerce');
  });

  it('preserva números', () => {
    expect(compactNome('1ª Entrega')).toBe('1aentrega');
  });

  it('unaccent antes de remover', () => {
    expect(compactNome('Gestão')).toBe('gestao');
  });
});

describe('tokenizeNome', () => {
  it('filtra stopwords', () => {
    expect(tokenizeNome('Gestão de Performance')).toEqual(['gestao', 'performance']);
  });

  it('filtra tokens com length < 3', () => {
    expect(tokenizeNome('CRM e Automação')).toEqual(['crm', 'automacao']);
  });

  it('filtra sufixos de tier (starter, scale, enterprise)', () => {
    expect(tokenizeNome('Gestão de performance - Starter')).toEqual(['gestao', 'performance']);
    expect(tokenizeNome('Performance Enterprise')).toEqual(['performance']);
  });

  it('remove duplicatas', () => {
    expect(tokenizeNome('Performance Performance')).toEqual(['performance']);
  });
});

describe('STOPWORDS', () => {
  it('contém as palavras-chave da spec', () => {
    expect(STOPWORDS).toContain('starter');
    expect(STOPWORDS).toContain('enterprise');
    expect(STOPWORDS).toContain('implantacao');
    expect(STOPWORDS).toContain('mensal');
  });
});
```

- [ ] **Step 2: Rodar teste e ver que falha**

```bash
npx vitest run server/contribuicaoSquad/matchPipeline.test.ts
```

Expected: FAIL com "Cannot find module './matchPipeline'".

- [ ] **Step 3: Implementar helpers**

Criar `server/contribuicaoSquad/matchPipeline.ts`:

```typescript
export const STOPWORDS = new Set<string>([
  'para', 'com', 'por', 'sem', 'dos', 'das', 'mes', 'fee', 'uma',
  'starter', 'scale', 'enterprise', 'standard', 'premium',
  'pontual', 'recorrente', 'mensal', 'entrega', 'implantacao',
]);

function unaccent(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeNome(raw: string): string {
  if (!raw) return '';
  const lower = unaccent(raw.toLowerCase());
  const cleaned = lower.replace(/[^a-z0-9 ]/g, ' ');
  return cleaned.replace(/\s+/g, ' ').trim();
}

export function compactNome(raw: string): string {
  if (!raw) return '';
  return unaccent(raw.toLowerCase()).replace(/[^a-z0-9]/g, '');
}

export function tokenizeNome(raw: string): string[] {
  const norm = normalizeNome(raw);
  if (!norm) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of norm.split(' ')) {
    if (t.length < 3) continue;
    if (STOPWORDS.has(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}
```

- [ ] **Step 4: Rodar teste e confirmar passa**

```bash
npx vitest run server/contribuicaoSquad/matchPipeline.test.ts
```

Expected: todos os testes passam.

- [ ] **Step 5: Commit**

```bash
git add server/contribuicaoSquad/matchPipeline.ts server/contribuicaoSquad/matchPipeline.test.ts
git commit -m "feat(contribuicao-squad): helpers puros de normalização para match item↔contrato"
```

---

### Task 3: Query SQL principal + função `getReceitaPorItens`

**Files:**
- Create: `server/contribuicaoSquad/receitaPorItens.ts`

- [ ] **Step 1: Criar o módulo com a query**

```typescript
import { sql } from 'drizzle-orm';
import { db } from '../db';

export interface ReceitaItemLinha {
  parcelaId: string;
  itemId: string;
  cnpjLimpo: string;
  clienteNome: string;
  mes: string;              // 'YYYY-MM'
  itemRaw: string;          // nome do item
  itemTotal: number;        // valor atribuído
  idSubtask: string | null; // contrato do ClickUp que casou (null para órfão)
  squad: string;            // nome do squad (ou '⚠️ Sem Squad')
  contratoRaw: string | null;
  prioridade: number | null; // 1=exato, 2=substring, 3=alias, 4=token, 5=fuzzy, null=órfão
}

/**
 * Retorna uma linha por (parcela_id, item_id) com o squad atribuído.
 * Cobre apenas parcelas com venda_id populado (VENDA / VENDA_AGENDADA).
 * Parcelas sem venda_id ficam para o fallback do simulador A3.
 */
export async function getReceitaPorItens(ano: number): Promise<ReceitaItemLinha[]> {
  const result = await db.execute(sql`
    WITH
    parcelas_ano AS (
      SELECT
        p.id AS parcela_id,
        p.venda_id,
        p.empresa,
        p.valor_pago::numeric AS valor_pago,
        TO_CHAR(p.data_quitacao, 'YYYY-MM') AS mes,
        cc.nome AS cliente_nome,
        REPLACE(REPLACE(REPLACE(COALESCE(cc.cnpj, ''), '.', ''), '-', ''), '/', '') AS cnpj_limpo
      FROM "Conta Azul".caz_parcelas p
      JOIN "Conta Azul".caz_clientes cc
        ON TRIM(p.id_cliente::text) = TRIM(cc.ids::text)
      WHERE p.tipo_evento = 'RECEITA'
        AND p.status = 'QUITADO'
        AND p.venda_origem IN ('VENDA','VENDA_AGENDADA')
        AND p.venda_id IS NOT NULL
        AND EXTRACT(YEAR FROM p.data_quitacao) = ${ano}
        AND cc.cnpj IS NOT NULL AND TRIM(cc.cnpj) != ''
    ),
    itens AS (
      SELECT
        pa.parcela_id, pa.cnpj_limpo, pa.cliente_nome, pa.mes, pa.valor_pago,
        i.id AS item_id,
        i.nome AS item_raw,
        (i.valor * i.quantidade)::numeric AS item_total,
        TRIM(REGEXP_REPLACE(REGEXP_REPLACE(LOWER(unaccent(i.nome)), '[^a-z0-9 ]', ' ', 'g'), '\\s+', ' ', 'g')) AS item_norm,
        REGEXP_REPLACE(LOWER(unaccent(i.nome)), '[^a-z0-9]', '', 'g') AS item_compact
      FROM parcelas_ano pa
      JOIN "Conta Azul".caz_vendas_itens i
        ON CAST(i.venda_id AS text) = CAST(pa.venda_id AS text)
       AND i.empresa = pa.empresa
    ),
    itens_tok AS (
      SELECT i.*,
        COALESCE((
          SELECT array_agg(t)
          FROM unnest(string_to_array(i.item_norm, ' ')) AS t
          WHERE LENGTH(t) >= 3
            AND t NOT IN ('para','com','por','sem','dos','das','mes','fee','uma',
                          'starter','scale','enterprise','standard','premium',
                          'pontual','recorrente','mensal','entrega','implantacao')
        ), ARRAY[]::text[]) AS item_tokens
      FROM itens i
    ),
    contratos AS (
      SELECT
        REPLACE(REPLACE(REPLACE(COALESCE(cl.cnpj, ''), '.', ''), '-', ''), '/', '') AS cnpj_limpo,
        ct.id_subtask,
        ct.servico AS contrato_raw,
        COALESCE(NULLIF(TRIM(ct.squad), ''), 'Sem Squad') AS squad,
        GREATEST(COALESCE(ct.valorr::numeric, 0), COALESCE(ct.valorp::numeric, 0)) AS contrato_valor,
        TRIM(REGEXP_REPLACE(REGEXP_REPLACE(LOWER(unaccent(ct.servico)), '[^a-z0-9 ]', ' ', 'g'), '\\s+', ' ', 'g')) AS contrato_norm,
        REGEXP_REPLACE(LOWER(unaccent(ct.servico)), '[^a-z0-9]', '', 'g') AS contrato_compact
      FROM "Clickup".cup_clientes cl
      JOIN "Clickup".cup_contratos ct ON cl.task_id = ct.id_task
      WHERE ct.servico IS NOT NULL AND TRIM(ct.servico) != ''
        AND (COALESCE(ct.valorr::numeric,0) > 0 OR COALESCE(ct.valorp::numeric,0) > 0)
        AND cl.cnpj IS NOT NULL AND TRIM(cl.cnpj) != ''
    ),
    contratos_tok AS (
      SELECT c.*,
        COALESCE((
          SELECT array_agg(t)
          FROM unnest(string_to_array(c.contrato_norm, ' ')) AS t
          WHERE LENGTH(t) >= 3
            AND t NOT IN ('para','com','por','sem','dos','das','mes','fee','uma',
                          'starter','scale','enterprise','standard','premium',
                          'pontual','recorrente','mensal','entrega','implantacao')
        ), ARRAY[]::text[]) AS contrato_tokens
      FROM contratos c
    ),
    aliases AS (
      SELECT item_pattern, target_token
      FROM cortex_core.item_alias_map
      WHERE active = true
    ),
    candidatos AS (
      SELECT
        i.parcela_id, i.item_id, i.cliente_nome, i.mes, i.item_raw, i.item_total,
        c.id_subtask, c.squad, c.contrato_raw, c.contrato_valor,
        CASE
          WHEN c.contrato_norm = i.item_norm THEN 1
          WHEN c.contrato_compact LIKE '%' || i.item_compact || '%'
            OR i.item_compact LIKE '%' || c.contrato_compact || '%' THEN 2
          WHEN EXISTS (
                 SELECT 1 FROM aliases a
                 WHERE i.item_norm LIKE '%' || a.item_pattern || '%'
                   AND a.target_token = ANY(c.contrato_tokens)
               ) THEN 3
          WHEN c.contrato_tokens && i.item_tokens THEN 4
          WHEN similarity(c.contrato_norm, i.item_norm) >= 0.4 THEN 5
          ELSE NULL
        END AS prioridade
      FROM itens_tok i
      LEFT JOIN contratos_tok c ON c.cnpj_limpo = i.cnpj_limpo
    ),
    melhor AS (
      SELECT DISTINCT ON (parcela_id, item_id)
        parcela_id::text, item_id::text, cliente_nome, mes, item_raw, item_total::float8,
        id_subtask::text, squad, contrato_raw, prioridade
      FROM candidatos
      WHERE prioridade IS NOT NULL
      ORDER BY parcela_id, item_id, prioridade ASC, contrato_valor DESC NULLS LAST
    ),
    orfaos AS (
      SELECT DISTINCT
        i.parcela_id::text, i.item_id::text, i.cliente_nome, i.mes, i.item_raw, i.item_total::float8,
        NULL::text AS id_subtask,
        '⚠️ Sem Squad'::text AS squad,
        NULL::text AS contrato_raw,
        NULL::int AS prioridade
      FROM itens_tok i
      WHERE NOT EXISTS (
        SELECT 1 FROM candidatos c
        WHERE c.parcela_id = i.parcela_id
          AND c.item_id = i.item_id
          AND c.prioridade IS NOT NULL
      )
    )
    SELECT parcela_id, item_id, cliente_nome, mes, item_raw, item_total,
           id_subtask, squad, contrato_raw, prioridade
    FROM melhor
    UNION ALL
    SELECT parcela_id, item_id, cliente_nome, mes, item_raw, item_total,
           id_subtask, squad, contrato_raw, prioridade
    FROM orfaos
  `);

  return (result.rows as any[]).map((row): ReceitaItemLinha => ({
    parcelaId: row.parcela_id,
    itemId: row.item_id,
    cnpjLimpo: '',
    clienteNome: row.cliente_nome,
    mes: row.mes,
    itemRaw: row.item_raw,
    itemTotal: Number(row.item_total) || 0,
    idSubtask: row.id_subtask ?? null,
    squad: row.squad,
    contratoRaw: row.contrato_raw ?? null,
    prioridade: row.prioridade != null ? Number(row.prioridade) : null,
  }));
}

/**
 * Retorna o conjunto de parcela_ids que foram cobertos pelo pipeline novo.
 * Uma parcela é considerada coberta se a soma dos itens atribuídos é ≥ 99% do valor_pago.
 */
export function parcelasCobertas(
  linhas: ReceitaItemLinha[],
  parcelaValor: Map<string, number>
): Set<string> {
  const somaPorParcela = new Map<string, number>();
  for (const l of linhas) {
    somaPorParcela.set(l.parcelaId, (somaPorParcela.get(l.parcelaId) || 0) + l.itemTotal);
  }
  const cobertas = new Set<string>();
  for (const [parcelaId, soma] of Array.from(somaPorParcela.entries())) {
    const valor = parcelaValor.get(parcelaId) || 0;
    if (valor > 0 && soma >= valor * 0.99) cobertas.add(parcelaId);
  }
  return cobertas;
}
```

- [ ] **Step 2: Rodar a query manualmente pra validar smoke test**

```bash
PGPASSWORD='Turbosenha*' psql -h 34.95.249.110 -U postgres -d dados_turbo <<'SQL'
WITH parcelas_ano AS (
  SELECT p.id AS parcela_id, p.venda_id, p.empresa, p.valor_pago::numeric AS valor_pago,
         TO_CHAR(p.data_quitacao, 'YYYY-MM') AS mes, cc.nome AS cliente_nome,
         REPLACE(REPLACE(REPLACE(COALESCE(cc.cnpj, ''), '.', ''), '-', ''), '/', '') AS cnpj_limpo
  FROM "Conta Azul".caz_parcelas p
  JOIN "Conta Azul".caz_clientes cc ON TRIM(p.id_cliente::text) = TRIM(cc.ids::text)
  WHERE p.tipo_evento = 'RECEITA' AND p.status = 'QUITADO'
    AND p.venda_origem IN ('VENDA','VENDA_AGENDADA') AND p.venda_id IS NOT NULL
    AND EXTRACT(YEAR FROM p.data_quitacao) = 2026
    AND cc.cnpj IS NOT NULL AND TRIM(cc.cnpj) != ''
)
SELECT COUNT(*) AS parcelas_cobertas FROM parcelas_ano;
SQL
```

Expected: número > 0 (ex.: ~1500+ parcelas em 2026). Se 0, algo está errado com os filtros.

- [ ] **Step 3: Commit**

```bash
git add server/contribuicaoSquad/receitaPorItens.ts
git commit -m "feat(contribuicao-squad): query de receita por itens com pipeline de match"
```

---

### Task 4: Integrar novo pipeline no handler `/api/contribuicao-squad/dfc/bulk`

**Files:**
- Modify: `server/routes.ts` (handler `app.get("/api/contribuicao-squad/dfc/bulk", ...)` — começa ~linha 5348)

Estratégia: rodar o novo pipeline primeiro e identificar parcelas cobertas. Para as parcelas **não** cobertas, continuar rodando o simulador A3 atual (que já existe ~linhas 5389-5652). A agregação final combina os dois.

- [ ] **Step 1: Importar o novo módulo no topo de routes.ts**

Localizar o import do simulador existente:

```bash
grep -n "contribuicaoSquad/simulator" server/routes.ts
```

Adicionar import do novo módulo logo após:

```typescript
import { getReceitaPorItens, parcelasCobertas, type ReceitaItemLinha } from "./contribuicaoSquad/receitaPorItens";
```

- [ ] **Step 2: No handler, rodar o novo pipeline antes do simulador A3**

Localizar o início do bloco "RECEITAS: Reconciliação cumulativa A3" (~linha 5357). Inserir ANTES dele:

```typescript
// ──── NOVO: receita via caz_vendas_itens (parcelas com venda_id) ──────
const receitaItens = await getReceitaPorItens(ano);

// Map de valor_pago por parcela_id (para saber o que o A3 tem que explicar)
const parcelaValorMap = new Map<string, number>();
const pagamentosResultPreview = await db.execute(sql`
  SELECT p.id::text AS parcela_id, p.valor_pago::numeric AS valor_pago
  FROM "Conta Azul".caz_parcelas p
  WHERE p.tipo_evento = 'RECEITA'
    AND p.status = 'QUITADO'
    AND p.valor_pago::numeric > 0
    AND EXTRACT(YEAR FROM p.data_quitacao) = ${ano}
`);
for (const row of pagamentosResultPreview.rows as any[]) {
  parcelaValorMap.set(row.parcela_id, Number(row.valor_pago) || 0);
}

const parcelasCobertasSet = parcelasCobertas(receitaItens, parcelaValorMap);
const totalParcelasAno = parcelaValorMap.size;
```

- [ ] **Step 3: Ajustar query do simulador A3 para processar só CNPJs não cobertos**

Hoje, a query `pagamentosResult` (~linha 5417) agrega pagamentos por CNPJ+mês. Precisa adicionar um filtro que exclui parcelas cobertas pelo novo pipeline.

Alterar a query para receber lista de parcela_ids a excluir:

```typescript
const parcelasExcluidas = Array.from(parcelasCobertasSet);
const pagamentosResult = await db.execute(sql`
  SELECT
    REPLACE(REPLACE(REPLACE(COALESCE(caz.cnpj, ''), '.', ''), '-', ''), '/', '') AS cnpj_limpo,
    MAX(caz.nome) AS cliente_nome,
    TO_CHAR(p.data_quitacao, 'YYYY-MM') AS mes,
    SUM(p.valor_pago::numeric) AS total_pago_mes
  FROM "Conta Azul".caz_parcelas p
  INNER JOIN "Conta Azul".caz_clientes caz ON TRIM(p.id_cliente::text) = TRIM(caz.ids::text)
  WHERE p.tipo_evento = 'RECEITA'
    AND p.status = 'QUITADO'
    AND p.valor_pago::numeric > 0
    AND caz.cnpj IS NOT NULL AND TRIM(caz.cnpj) != ''
    AND ${parcelasExcluidas.length > 0 ? sql`p.id::text NOT IN (${sql.join(parcelasExcluidas.map(id => sql`${id}`), sql`, `)})` : sql`TRUE`}
  GROUP BY cnpj_limpo, TO_CHAR(p.data_quitacao, 'YYYY-MM')
  ORDER BY cnpj_limpo, mes
`);
```

> Nota: se `parcelasExcluidas` ficar muito grande (> 5000 ids), trocar o `NOT IN` por um `ANTI JOIN` via CTE de IDs. Rodar `SELECT COUNT(*)` do novo pipeline primeiro e avaliar. Para 2026 o esperado é ~1700 IDs, cabe no `NOT IN`.

- [ ] **Step 4: Depois do simulador, mesclar `receitaItens` dentro do `mesesMap`**

Localizar o bloco que monta o `mesesMap` iterando contratos simulados (~linha 5517-5573). Logo após esse loop, adicionar outro loop que insere as linhas do novo pipeline:

```typescript
// ──── Mesclar receita via itens no mesesMap ─────────────────────────
for (const linha of receitaItens) {
  const sqNorm = linha.squad;

  if (!matchesSquadFilter(sqNorm) && sqNorm !== '⚠️ Sem Squad') continue;

  squadsSet.add(sqNorm);

  if (!linha.mes.startsWith(`${ano}-`)) continue;
  if (linha.itemTotal <= 0) continue;

  if (!mesesMap.has(linha.mes)) {
    mesesMap.set(linha.mes, { categorias: new Map(), receitaTotal: 0, totalParcelas: 0 });
  }
  const mesData = mesesMap.get(linha.mes)!;
  mesData.receitaTotal += linha.itemTotal;
  mesData.totalParcelas += 1;

  const categoriaNome = 'Sem Categoria';
  if (!mesData.categorias.has(categoriaNome)) {
    mesData.categorias.set(categoriaNome, { nome: categoriaNome, valorTotal: 0, clientes: new Map() });
  }
  const cat = mesData.categorias.get(categoriaNome)!;
  cat.valorTotal += linha.itemTotal;

  if (!cat.clientes.has(linha.clienteNome)) {
    cat.clientes.set(linha.clienteNome, { valorTotal: 0, servicos: new Map() });
  }
  const cli = cat.clientes.get(linha.clienteNome)!;
  cli.valorTotal += linha.itemTotal;

  const chaveServico = `${linha.itemRaw}|${sqNorm}`;
  if (!cli.servicos.has(chaveServico)) {
    cli.servicos.set(chaveServico, { valor: 0, squad: sqNorm, parcelas: [] });
  }
  const srv = cli.servicos.get(chaveServico)!;
  srv.valor += linha.itemTotal;
  srv.parcelas.push({
    id: linha.idSubtask,
    valor: linha.itemTotal,
    dataQuitacao: null,
    linkNfse: null,
    numNfse: null,
    urlCobranca: null,
    clienteNome: linha.clienteNome,
    servicoNome: linha.itemRaw,
    squad: sqNorm,
  });
}
```

- [ ] **Step 5: Adicionar `fonteDados` ao response JSON**

Localizar o `res.json({...})` final do handler. Adicionar o campo:

```typescript
const viaItens = parcelasCobertasSet.size;
const viaSimuladorA3 = Math.max(0, totalParcelasAno - viaItens);
const pctViaItens = totalParcelasAno > 0 ? Math.round((viaItens / totalParcelasAno) * 1000) / 10 : 0;

res.json({
  // ... campos existentes ...
  fonteDados: {
    totalParcelas: totalParcelasAno,
    viaItens,
    viaSimuladorA3,
    pctViaItens,
  },
});
```

- [ ] **Step 6: Reiniciar o dev server e testar no browser**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
```

Esperar "ready", abrir `http://localhost:3000/contribuicao-squad`, verificar que:
- Página carrega sem erro.
- Aparecem os squads habituais.
- Aparece um squad novo "⚠️ Sem Squad".
- Devtools → network: response tem `fonteDados.pctViaItens > 80`.

- [ ] **Step 7: Commit**

```bash
git add server/routes.ts
git commit -m "feat(contribuicao-squad): handler bulk usa receita via itens com fallback A3"
```

---

### Task 5: Frontend — bucket "⚠️ Sem Squad" + indicador de fonte

**Files:**
- Modify: `client/src/pages/ContribuicaoSquad.tsx`

- [ ] **Step 1: Estender interface `BulkResponse`**

Localizar a definição da interface (~linha 64):

```typescript
interface BulkResponse {
  // ... campos existentes ...
  fonteDados?: {
    totalParcelas: number;
    viaItens: number;
    viaSimuladorA3: number;
    pctViaItens: number;
  };
}
```

- [ ] **Step 2: Identificar o "Sem Squad" como squad especial e dar destaque**

Localizar onde os squads são renderizados na tabela/listagem (provavelmente dentro de um `.map` de squads). Procurar:

```bash
grep -n "squad" client/src/pages/ContribuicaoSquad.tsx | head -40
```

Adicionar um helper próximo ao `isOffSquad` existente (linha 76):

```typescript
const isSemSquad = (squad: string) => squad === '⚠️ Sem Squad';
```

Onde renderiza o nome do squad, adicionar classe condicional:

```tsx
<span className={cn(
  "font-medium",
  isSemSquad(squad) && "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded"
)}>
  {squad}
</span>
```

- [ ] **Step 3: Adicionar badge de fonte dos dados no header**

Localizar o componente de header/hero da página (provavelmente logo abaixo do `useSetPageInfo`). Adicionar:

```tsx
{bulkData?.fonteDados && (
  <div className="text-xs text-gray-500 dark:text-zinc-400 mt-2">
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      {bulkData.fonteDados.pctViaItens.toFixed(1)}% via itens de venda
    </span>
    {bulkData.fonteDados.viaSimuladorA3 > 0 && (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 ml-2">
        {(100 - bulkData.fonteDados.pctViaItens).toFixed(1)}% via simulador (fallback)
      </span>
    )}
  </div>
)}
```

- [ ] **Step 4: Testar no browser (dark + light mode)**

Com dev server rodando, abrir `http://localhost:3000/contribuicao-squad`:
- Verificar que o badge de fonte aparece no header.
- Verificar que "⚠️ Sem Squad" tem destaque amber.
- Trocar tema pra dark mode e verificar que ambos elementos continuam legíveis.
- Expandir o "Sem Squad" e verificar que lista os itens órfãos por cliente.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/ContribuicaoSquad.tsx
git commit -m "feat(contribuicao-squad): bucket Sem Squad + badge de fonte de dados"
```

---

### Task 6: Script de validação comparativa

**Files:**
- Create: `scripts/compareSquadReceita.ts`

Objetivo: executar o endpoint atual (antes do merge) e o novo, comparar lado a lado, e imprimir delta por squad.

- [ ] **Step 1: Criar o script**

```typescript
// scripts/compareSquadReceita.ts
// Uso: tsx scripts/compareSquadReceita.ts 2026
//
// Baixa o response de /api/contribuicao-squad/dfc/bulk para o ano dado,
// agrega receita por squad e imprime uma tabela. Deve ser rodado ANTES
// e DEPOIS do merge para validação manual.

const ANO = parseInt(process.argv[2]) || new Date().getFullYear();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function main() {
  const res = await fetch(`${BASE_URL}/api/contribuicao-squad/dfc/bulk?ano=${ANO}`, {
    headers: { 'Cookie': process.env.AUTH_COOKIE || '' },
  });
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const data: any = await res.json();

  const porSquad = new Map<string, number>();
  let totalReceita = 0;

  for (const mes of data.meses || []) {
    if (!mes.data) continue;
    for (const linha of mes.data.receitas || []) {
      if (linha.nivel === 3 && linha.parcelas) {
        for (const p of linha.parcelas) {
          porSquad.set(p.squad, (porSquad.get(p.squad) || 0) + (p.valor || 0));
          totalReceita += p.valor || 0;
        }
      }
    }
  }

  console.log(`\n=== Receita por squad — ano ${ANO} ===`);
  console.log(`Total geral: R$ ${totalReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`);

  const ordenado = Array.from(porSquad.entries()).sort((a, b) => b[1] - a[1]);
  const maxSquadLen = Math.max(...ordenado.map(([s]) => s.length));

  for (const [squad, valor] of ordenado) {
    const pct = totalReceita > 0 ? ((valor / totalReceita) * 100).toFixed(1) : '0.0';
    console.log(
      `${squad.padEnd(maxSquadLen)}  R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(16)}  ${pct.padStart(5)}%`
    );
  }

  if (data.fonteDados) {
    console.log(`\nFonte dos dados:`);
    console.log(`  Total parcelas ano:   ${data.fonteDados.totalParcelas}`);
    console.log(`  Via caz_vendas_itens: ${data.fonteDados.viaItens} (${data.fonteDados.pctViaItens}%)`);
    console.log(`  Via simulador A3:     ${data.fonteDados.viaSimuladorA3}`);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Rodar o script e salvar o output "depois"**

Com o dev server rodando e login feito (copiar `AUTH_COOKIE` do devtools):

```bash
AUTH_COOKIE="..." npx tsx scripts/compareSquadReceita.ts 2026 > /tmp/squad_depois.txt
cat /tmp/squad_depois.txt
```

- [ ] **Step 3: Checkout da versão "antes" (antes das mudanças) e rodar de novo**

```bash
git stash
git checkout main
npm run dev &
# esperar ready
AUTH_COOKIE="..." npx tsx scripts/compareSquadReceita.ts 2026 > /tmp/squad_antes.txt
git checkout feature/contribuicao-squad-itens-venda
git stash pop
```

- [ ] **Step 4: Comparar os dois outputs**

```bash
diff -u /tmp/squad_antes.txt /tmp/squad_depois.txt
```

Analisar os deltas por squad. Deltas ≤ 5% são esperados (refinamento). Deltas > 20% em um squad individual merecem investigação — olhar no detalhe de cliente/item pra entender se é refinamento real ou bug.

**Critério de aceite:** total geral da receita não pode divergir mais de 10% entre antes/depois. Se divergir, investigar antes de mergear.

- [ ] **Step 5: Commit**

```bash
git add scripts/compareSquadReceita.ts
git commit -m "chore(contribuicao-squad): script de comparação antes/depois por squad"
```

---

### Task 7: QA manual + merge

- [ ] **Step 1: QA manual no dashboard**

Checklist:

- [ ] Abrir `/contribuicao-squad` — página carrega sem erro.
- [ ] Badge de fonte aparece no header e mostra % > 80%.
- [ ] Squad "⚠️ Sem Squad" aparece na lista com destaque amber.
- [ ] Expandir "⚠️ Sem Squad" mostra itens de pelo menos 1 cliente.
- [ ] Filtro por squad específico ainda funciona (não quebra com o squad "⚠️ Sem Squad").
- [ ] Despesas por squad continuam iguais (não foram afetadas).
- [ ] Total geral de receita do ano está dentro de ± 10% do valor antigo.
- [ ] Dark mode: todos os elementos legíveis.
- [ ] Light mode: idem.

- [ ] **Step 2: Rodar testes unitários**

```bash
npx vitest run server/contribuicaoSquad/matchPipeline.test.ts
```

Expected: todos passam.

- [ ] **Step 3: Criar PR**

Seguir `superpowers:finishing-a-development-branch`. Descrição do PR:

```
## Contribuição por Squad — receita via caz_vendas_itens

Substitui o simulador A3 como fonte primária de atribuição de receita por squad
pelo pipeline que usa `caz_vendas_itens` (parcelas com `venda_id`).

### Mudanças
- Nova tabela `cortex_core.item_alias_map` com 9 aliases iniciais
- Helpers puros de normalização em `server/contribuicaoSquad/matchPipeline.ts` + testes
- Query `getReceitaPorItens(ano)` com pipeline exato → substring → alias → token → fuzzy
- Handler `/api/contribuicao-squad/dfc/bulk` híbrido: novo pipeline + fallback A3
- Frontend: bucket "⚠️ Sem Squad" com destaque + badge de fonte de dados
- Script `scripts/compareSquadReceita.ts` para validação

### Cobertura esperada
~94% da receita via itens (medido em 2026), ~6% via fallback A3 / Sem Squad.

### Spec
`docs/superpowers/specs/2026-04-13-contribuicao-squad-receita-itens-design.md`
```

- [ ] **Step 4: Após merge, monitorar**

- Rodar `scripts/compareSquadReceita.ts` em prod diariamente por 3-5 dias.
- Coletar feedback dos usuários sobre o bucket "Sem Squad".
- Começar a curar aliases conforme novos itens aparecerem no bucket.

---

## Nota de segurança / rollback

Se aparecer divergência grande ou bug em prod após deploy:

1. **Rollback rápido:** reverter o commit do handler (Task 4). O simulador A3 continua no código e volta a ser única fonte.
2. **Rollback de schema:** `DROP TABLE cortex_core.item_alias_map CASCADE;` — a tabela é nova e não afeta nada fora desta feature.
3. Investigar via script de comparação (Task 6).
