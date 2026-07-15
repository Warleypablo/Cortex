# Central de Custos de IA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a tela `/central-custos` que consolida o gasto de infraestrutura de IA da Turbo (assinaturas Claude, API Anthropic, infra GCP e custos do Synapse), com evolução mês a mês e valores em USD original + BRL convertido.

**Architecture:** Abordagem híbrida. Dados automáticos (GCP via BigQuery Billing Export, Anthropic via Admin Cost Report) são espelhados em tabelas-cache de série diária por jobs de sync no boot (`server/index.ts`). Cadastros manuais (assinaturas, ferramentas) são CRUD. A lógica de consolidação é **pura e testada** (`shared/custos-calc.ts`) — o backend só carrega dados e delega o cálculo. O Synapse é uma **dimensão** (`projeto`) que atravessa todas as fontes.

**Tech Stack:** TypeScript, Express, Drizzle (`db.execute(sql\`\`)` → `result.rows`), Postgres (schema `cortex_core`), React + wouter + @tanstack/react-query + Tailwind/shadcn + Recharts, `@google-cloud/bigquery` (novo), `@anthropic-ai/sdk` (Admin API via `fetch`), vitest.

## Global Constraints

- **Dark/light mode obrigatório**: toda UI usa variantes `dark:` (padrão `bg-white dark:bg-zinc-900`, cores de eixo/grid via `useTheme().isDark`). Testar nos dois modos.
- **`data-testid` obrigatório** em botões, inputs, células e linhas (convenção da base, ex: `button-add-assinatura`, `row-assinatura-${id}`).
- **Fetch no frontend**: sempre `apiRequest(method, url, data)` de `@/lib/queryClient` (injeta `credentials:'include'` + `Content-Type`). Nunca `fetch` cru.
- **DB access no backend**: `db.execute(sql\`...\`)` com interpolação parametrizada `${valor}`; ler sempre `result.rows`. `sql` de `drizzle-orm`.
- **Guard de escrita**: endpoints de mutação usam `isAdmin` (definido no molde `server/routes/metas.ts:5-10`). Leitura é coberta pelo `app.use("/api", isAuthenticated)` global.
- **Aplicar schema em PROD também**, não só local (regra do projeto — Task 15).
- **Validação de tipos**: `npm run check` (tsc) deve passar limpo ao fim de cada task de código.
- **Commits**: Conventional Commits, terminar com `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Subagentes NÃO devem subir o dev server nem matar a porta 3000** (regra do projeto). Validar backend com `npm run check` e `npm run test`; validação em browser é do operador humano.
- **Moeda**: valores guardados na moeda original (`USD`/`BRL`); conversão USD→BRL só na consolidação, via taxa mensal.

## Env vars novas (documentar em `.env.example`)

- `ANTHROPIC_ADMIN_KEY` — Admin API key da Anthropic (`sk-ant-admin…`), para o Cost Report. (A key normal `ANTHROPIC_API_KEY` já existe e NÃO serve para a Admin API.)
- `GCP_BILLING_BQ_TABLE` — tabela do billing export totalmente qualificada, ex: `auto-report-turbo.billing_export.gcp_billing_export_v1_0123AB_4567CD_89EF01`.
- Reutiliza `GOOGLE_SERVICE_ACCOUNT_JSON` (já existente) para credencial do BigQuery.

## File Structure

**Backend**
- `shared/schema.ts` (modify) — 7 tabelas em `cortex_core` + types `$inferSelect`/`$inferInsert`.
- `shared/custos-calc.ts` (create) — tipos + lógica pura de consolidação (rateio, conversão, agregação).
- `shared/custos-calc.test.ts` (create) — testes vitest da lógica pura.
- `migrations/2026-07-14-central-custos.sql` (create) — `CREATE TABLE IF NOT EXISTS` idempotente.
- `scripts/apply-custos-migration.ts` (create) — runner para aplicar a migration em prod.
- `server/services/custos/cambio.ts` (create) — busca AwesomeAPI + get/upsert taxa mensal.
- `server/services/custos/consolidacao.ts` (create) — carrega dados do mês (queries) e delega a `custos-calc`.
- `server/services/custos/gcpBillingSync.ts` (create) — query no BigQuery → upsert `custo_gcp_diario`.
- `server/services/custos/anthropicCostSync.ts` (create) — fetch Cost Report → upsert `custo_anthropic_diario`.
- `server/routes/custos.ts` (create) — todos os endpoints `/api/custos/*`.
- `server/routes.ts` (modify) — import + chamada de `registerCustosRoutes`.
- `server/index.ts` (modify) — jobs agendados (GCP diário, Anthropic diário, câmbio semanal).

**Frontend**
- `client/src/lib/utils.ts` (modify) — `formatCurrencyUSD`.
- `client/src/pages/CentralCustos.tsx` (create) — página (header, seletor de mês, toggle moeda, tabs).
- `client/src/components/custos/KpisCustos.tsx` (create) — cards de KPI.
- `client/src/components/custos/EvolucaoCustos.tsx` (create) — gráfico stacked de evolução.
- `client/src/components/custos/AbaAssinaturas.tsx` + `DialogAssinatura.tsx` (create) — CRUD + MultiSelect RH.
- `client/src/components/custos/AbaItens.tsx` + `DialogItem.tsx` (create) — CRUD ferramentas.
- `client/src/components/custos/AbaGcp.tsx`, `AbaAnthropic.tsx`, `AbaSynapse.tsx` (create) — leitura + sync.
- `client/src/App.tsx` (modify) — import lazy + `<Route>`.
- `shared/nav-config.ts` (modify) — permissão + item de menu (categoria Admin).

## Fatos do codebase (validados na investigação — use como referência)

- `rh_pessoal` está no schema Postgres **`"Inhire"`**. PK `id` (integer, atribuído manualmente), nome em `nome` (varchar 150), emails `email_turbo`/`email_pessoal`, `squad`, `cargo`. **Não há boolean `ativo`** — filtrar `LOWER(status) = 'ativo'`.
- CRUD template literal: `server/routes/metas.ts` (isAdmin 5-10; GET 140; POST c/ ON CONFLICT 266; PUT c/ COALESCE 306; DELETE 343). `db.execute(query)` → `result.rows`.
- Registro de módulo: `server/routes.ts` — imports por volta da linha 42, chamadas por volta da 8504; `db` importado em `routes.ts:11`.
- Jobs recorrentes: IIFE de boot em `server/index.ts` (após `registerRoutes`, ~linha 191). Padrão `setTimeout` (1º disparo escalonado) + `setInterval`, worker via `await import(...)` dinâmico, status em `globalThis.__xStatus`.
- Credencial GCP: `process.env.GOOGLE_SERVICE_ACCOUNT_JSON` (JSON inline), parse em `server/autoreport/credentials.ts`; `project_id` = `auto-report-turbo`. `@google-cloud/bigquery` **não** está instalado.
- Anthropic client normal: `server/services/aiText.ts:19` (lazy singleton). Admin API **não** está no SDK → usar `fetch`.
- Migration runner: `scripts/apply-content-migration.ts` (Pool via `DB_HOST/...` ou `DATABASE_URL`, `pool.query(sql)`, `npx tsx --env-file=.env`).
- Frontend CRUD: `client/src/pages/AdminUsuarios.tsx` + `apiRequest`/`useMutation` de `@/lib/queryClient`; `MultiSelect` de `@/components/ui/multi-select` (`{options, selected, onChange}`); Recharts stacked em `ChurnEvolucaoMensal.tsx` (`stackId="a"`); `formatCurrency*` em `@/lib/utils` (só BRL — USD precisa ser criado); Tabs de `@/components/ui/tabs`.

---

### Task 1: Schema das 7 tabelas + migration + runner de prod

**Files:**
- Modify: `shared/schema.ts` (adicionar bloco de tabelas + types; `cortexCoreSchema` já existe em `shared/schema.ts:7`)
- Create: `migrations/2026-07-14-central-custos.sql`
- Create: `scripts/apply-custos-migration.ts`

**Interfaces:**
- Produces (tabelas Postgres, schema `cortex_core`): `custo_assinaturas`, `custo_assinatura_usuarios`, `custo_itens_manuais`, `custo_gcp_diario`, `custo_anthropic_diario`, `custo_gcp_projeto_map`, `custo_cambio_mensal`.
- Produces (types TS): `CustoAssinatura`, `InsertCustoAssinatura`, `CustoItemManual`, `InsertCustoItemManual`, `CustoGcpDiario`, `CustoAnthropicDiario`, `CustoCambioMensal`.

- [ ] **Step 1: Criar a migration SQL idempotente**

Create `migrations/2026-07-14-central-custos.sql`:

```sql
-- Central de Custos de IA — tabelas base (idempotente / aditivo)
CREATE SCHEMA IF NOT EXISTS cortex_core;

CREATE TABLE IF NOT EXISTS cortex_core.custo_assinaturas (
  id                      SERIAL PRIMARY KEY,
  fornecedor              VARCHAR(80)  NOT NULL,
  plano                   VARCHAR(120) NOT NULL,
  valor                   DECIMAL(18,2) NOT NULL DEFAULT 0,
  moeda                   VARCHAR(3)   NOT NULL DEFAULT 'USD',
  ciclo                   VARCHAR(10)  NOT NULL DEFAULT 'mensal', -- 'mensal' | 'anual'
  data_assinatura         DATE         NOT NULL,
  data_cancelamento       DATE,
  status                  VARCHAR(10)  NOT NULL DEFAULT 'ativo',  -- 'ativo' | 'inativo'
  responsavel_pessoa_id   INTEGER,
  projeto                 VARCHAR(20)  NOT NULL DEFAULT 'Geral',  -- 'Synapse' | 'Cortex' | 'Geral'
  observacoes             TEXT,
  created_at              TIMESTAMP    DEFAULT NOW(),
  updated_at              TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cortex_core.custo_assinatura_usuarios (
  id             SERIAL PRIMARY KEY,
  assinatura_id  INTEGER NOT NULL REFERENCES cortex_core.custo_assinaturas(id) ON DELETE CASCADE,
  pessoa_id      INTEGER NOT NULL,
  CONSTRAINT uq_custo_assinatura_usuario UNIQUE (assinatura_id, pessoa_id)
);
CREATE INDEX IF NOT EXISTS idx_custo_assinatura_usuarios_assinatura ON cortex_core.custo_assinatura_usuarios(assinatura_id);

CREATE TABLE IF NOT EXISTS cortex_core.custo_itens_manuais (
  id                      SERIAL PRIMARY KEY,
  descricao               VARCHAR(160) NOT NULL,
  fornecedor              VARCHAR(80),
  categoria               VARCHAR(40),
  valor                   DECIMAL(18,2) NOT NULL DEFAULT 0,
  moeda                   VARCHAR(3)   NOT NULL DEFAULT 'USD',
  ciclo                   VARCHAR(10)  NOT NULL DEFAULT 'mensal', -- 'mensal' | 'anual' | 'pontual'
  data_inicio             DATE         NOT NULL,
  data_fim                DATE,
  status                  VARCHAR(10)  NOT NULL DEFAULT 'ativo',
  projeto                 VARCHAR(20)  NOT NULL DEFAULT 'Geral',
  responsavel_pessoa_id   INTEGER,
  observacoes             TEXT,
  created_at              TIMESTAMP    DEFAULT NOW(),
  updated_at              TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cortex_core.custo_gcp_diario (
  id               SERIAL PRIMARY KEY,
  data             DATE NOT NULL,
  gcp_project_id   VARCHAR(120) NOT NULL,
  servico          VARCHAR(120) NOT NULL,
  custo            DECIMAL(18,4) NOT NULL DEFAULT 0,
  moeda            VARCHAR(3) NOT NULL DEFAULT 'USD',
  projeto_interno  VARCHAR(20) NOT NULL DEFAULT 'Geral',
  synced_at        TIMESTAMP DEFAULT NOW(),
  CONSTRAINT uq_custo_gcp_diario UNIQUE (data, gcp_project_id, servico)
);
CREATE INDEX IF NOT EXISTS idx_custo_gcp_diario_data ON cortex_core.custo_gcp_diario(data);

CREATE TABLE IF NOT EXISTS cortex_core.custo_anthropic_diario (
  id               SERIAL PRIMARY KEY,
  data             DATE NOT NULL,
  workspace        VARCHAR(120) NOT NULL DEFAULT '',
  modelo           VARCHAR(80)  NOT NULL DEFAULT '',
  custo_usd        DECIMAL(18,4) NOT NULL DEFAULT 0,
  tokens_input     BIGINT,
  tokens_output    BIGINT,
  projeto_interno  VARCHAR(20) NOT NULL DEFAULT 'Geral',
  synced_at        TIMESTAMP DEFAULT NOW(),
  CONSTRAINT uq_custo_anthropic_diario UNIQUE (data, workspace, modelo)
);
CREATE INDEX IF NOT EXISTS idx_custo_anthropic_diario_data ON cortex_core.custo_anthropic_diario(data);

CREATE TABLE IF NOT EXISTS cortex_core.custo_gcp_projeto_map (
  id               SERIAL PRIMARY KEY,
  gcp_project_id   VARCHAR(120) NOT NULL UNIQUE,
  projeto_interno  VARCHAR(20)  NOT NULL DEFAULT 'Geral'
);

CREATE TABLE IF NOT EXISTS cortex_core.custo_cambio_mensal (
  id            SERIAL PRIMARY KEY,
  ano_mes       VARCHAR(7) NOT NULL UNIQUE, -- 'YYYY-MM'
  taxa_usd_brl  DECIMAL(10,4) NOT NULL,
  fonte         VARCHAR(10) NOT NULL DEFAULT 'auto', -- 'auto' | 'manual'
  updated_at    TIMESTAMP DEFAULT NOW()
);
```

- [ ] **Step 2: Adicionar as tabelas Drizzle em `shared/schema.ts`**

Anexar ao final de `shared/schema.ts` (garanta que os helpers `serial, integer, varchar, decimal, date, timestamp, text` já estão importados no topo — eles já são usados no arquivo):

```ts
// ============ Central de Custos de IA ============
export const custoAssinaturas = cortexCoreSchema.table("custo_assinaturas", {
  id: serial("id").primaryKey(),
  fornecedor: varchar("fornecedor", { length: 80 }).notNull(),
  plano: varchar("plano", { length: 120 }).notNull(),
  valor: decimal("valor", { precision: 18, scale: 2 }).notNull().default("0"),
  moeda: varchar("moeda", { length: 3 }).notNull().default("USD"),
  ciclo: varchar("ciclo", { length: 10 }).notNull().default("mensal"),
  dataAssinatura: date("data_assinatura").notNull(),
  dataCancelamento: date("data_cancelamento"),
  status: varchar("status", { length: 10 }).notNull().default("ativo"),
  responsavelPessoaId: integer("responsavel_pessoa_id"),
  projeto: varchar("projeto", { length: 20 }).notNull().default("Geral"),
  observacoes: text("observacoes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export type CustoAssinatura = typeof custoAssinaturas.$inferSelect;
export type InsertCustoAssinatura = typeof custoAssinaturas.$inferInsert;

export const custoAssinaturaUsuarios = cortexCoreSchema.table("custo_assinatura_usuarios", {
  id: serial("id").primaryKey(),
  assinaturaId: integer("assinatura_id").notNull(),
  pessoaId: integer("pessoa_id").notNull(),
});

export const custoItensManuais = cortexCoreSchema.table("custo_itens_manuais", {
  id: serial("id").primaryKey(),
  descricao: varchar("descricao", { length: 160 }).notNull(),
  fornecedor: varchar("fornecedor", { length: 80 }),
  categoria: varchar("categoria", { length: 40 }),
  valor: decimal("valor", { precision: 18, scale: 2 }).notNull().default("0"),
  moeda: varchar("moeda", { length: 3 }).notNull().default("USD"),
  ciclo: varchar("ciclo", { length: 10 }).notNull().default("mensal"),
  dataInicio: date("data_inicio").notNull(),
  dataFim: date("data_fim"),
  status: varchar("status", { length: 10 }).notNull().default("ativo"),
  projeto: varchar("projeto", { length: 20 }).notNull().default("Geral"),
  responsavelPessoaId: integer("responsavel_pessoa_id"),
  observacoes: text("observacoes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export type CustoItemManual = typeof custoItensManuais.$inferSelect;
export type InsertCustoItemManual = typeof custoItensManuais.$inferInsert;

export const custoGcpDiario = cortexCoreSchema.table("custo_gcp_diario", {
  id: serial("id").primaryKey(),
  data: date("data").notNull(),
  gcpProjectId: varchar("gcp_project_id", { length: 120 }).notNull(),
  servico: varchar("servico", { length: 120 }).notNull(),
  custo: decimal("custo", { precision: 18, scale: 4 }).notNull().default("0"),
  moeda: varchar("moeda", { length: 3 }).notNull().default("USD"),
  projetoInterno: varchar("projeto_interno", { length: 20 }).notNull().default("Geral"),
  syncedAt: timestamp("synced_at").defaultNow(),
});
export type CustoGcpDiario = typeof custoGcpDiario.$inferSelect;

export const custoAnthropicDiario = cortexCoreSchema.table("custo_anthropic_diario", {
  id: serial("id").primaryKey(),
  data: date("data").notNull(),
  workspace: varchar("workspace", { length: 120 }).notNull().default(""),
  modelo: varchar("modelo", { length: 80 }).notNull().default(""),
  custoUsd: decimal("custo_usd", { precision: 18, scale: 4 }).notNull().default("0"),
  tokensInput: bigint("tokens_input", { mode: "number" }),
  tokensOutput: bigint("tokens_output", { mode: "number" }),
  projetoInterno: varchar("projeto_interno", { length: 20 }).notNull().default("Geral"),
  syncedAt: timestamp("synced_at").defaultNow(),
});
export type CustoAnthropicDiario = typeof custoAnthropicDiario.$inferSelect;

export const custoGcpProjetoMap = cortexCoreSchema.table("custo_gcp_projeto_map", {
  id: serial("id").primaryKey(),
  gcpProjectId: varchar("gcp_project_id", { length: 120 }).notNull(),
  projetoInterno: varchar("projeto_interno", { length: 20 }).notNull().default("Geral"),
});

export const custoCambioMensal = cortexCoreSchema.table("custo_cambio_mensal", {
  id: serial("id").primaryKey(),
  anoMes: varchar("ano_mes", { length: 7 }).notNull(),
  taxaUsdBrl: decimal("taxa_usd_brl", { precision: 10, scale: 4 }).notNull(),
  fonte: varchar("fonte", { length: 10 }).notNull().default("auto"),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export type CustoCambioMensal = typeof custoCambioMensal.$inferSelect;
```

Se `bigint` não estiver na lista de imports do topo de `shared/schema.ts`, adicione-o ao import existente de `drizzle-orm/pg-core` (junto de `serial`, `integer`, etc.).

- [ ] **Step 3: Criar o runner de migration para prod**

Create `scripts/apply-custos-migration.ts` (molde: `scripts/apply-content-migration.ts`):

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

const SQL_FILES = ["migrations/2026-07-14-central-custos.sql"];

function makePool(): Pool {
  const ssl = process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false };
  if (process.env.DATABASE_URL) {
    return new Pool({ connectionString: process.env.DATABASE_URL, ssl });
  }
  if (!process.env.DB_HOST) {
    throw new Error(
      "Sem credenciais do banco. Defina DATABASE_URL, ou DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD. " +
        "Dica: rode com `npx tsx --env-file=.env scripts/apply-custos-migration.ts`.",
    );
  }
  return new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl,
  });
}

async function main() {
  const pool = makePool();
  console.log("→ aplicando migration central-custos…");
  for (const rel of SQL_FILES) {
    const sql = readFileSync(resolve(process.cwd(), rel), "utf8");
    process.stdout.write(`   • ${rel} … `);
    await pool.query(sql);
    console.log("ok");
  }
  const { rows } = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='cortex_core' AND table_name LIKE 'custo\\_%' ORDER BY table_name",
  );
  console.log("✓ Pronto. Tabelas custo_*:");
  console.table(rows);
  await pool.end();
}

main().catch((err) => {
  console.error("✗ Falhou:", err.message);
  process.exit(1);
});
```

- [ ] **Step 4: Aplicar local e validar**

Run: `npx tsx --env-file=.env scripts/apply-custos-migration.ts`
Expected: imprime "ok" para o arquivo e uma tabela com as 7 tabelas `custo_*`.

Run: `npm run check`
Expected: sem erros de tipo relacionados ao `shared/schema.ts`.

- [ ] **Step 5: Commit**

```bash
git add shared/schema.ts migrations/2026-07-14-central-custos.sql scripts/apply-custos-migration.ts
git commit -m "feat(custos): schema base das 7 tabelas da Central de Custos + runner de migration

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Lógica pura de consolidação (TDD)

**Files:**
- Create: `shared/custos-calc.ts`
- Create: `shared/custos-calc.test.ts`

**Interfaces:**
- Produces: `type Moeda`, `type Projeto`, `type Pilar`, `interface LinhaCusto`, `interface ItemRecorrente`.
- Produces: `mesDe(dataISO: string): string`, `ativoNoMes(input, mes): boolean`, `custoMensalRecorrente(input: ItemRecorrente, mes: string): number`, `converter(valor: number, moeda: Moeda, taxaUsdBrl: number): {valorUSD, valorBRL}`, `agruparPor(linhas: LinhaCusto[], chave: keyof LinhaCusto): Record<string, number>`, `totalBRL(linhas): number`, `totalUSD(linhas): number`.
- Consumed por `server/services/custos/consolidacao.ts` (Task 4).

- [ ] **Step 1: Escrever os testes que falham**

Create `shared/custos-calc.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  mesDe, ativoNoMes, custoMensalRecorrente, converter, agruparPor, totalBRL, totalUSD,
  type LinhaCusto,
} from "./custos-calc";

describe("mesDe", () => {
  it("extrai YYYY-MM de uma data ISO", () => {
    expect(mesDe("2026-07-14")).toBe("2026-07");
  });
});

describe("ativoNoMes", () => {
  const base = { dataInicio: "2026-03-10", dataFim: null as string | null, status: "ativo" };
  it("ativo quando o mês está dentro da janela aberta", () => {
    expect(ativoNoMes(base, "2026-07")).toBe(true);
  });
  it("inativo antes do início", () => {
    expect(ativoNoMes(base, "2026-02")).toBe(false);
  });
  it("respeita data de cancelamento (conta até o mês do fim, inclusive)", () => {
    const cancelado = { dataInicio: "2026-03-10", dataFim: "2026-05-20", status: "inativo" };
    expect(ativoNoMes(cancelado, "2026-05")).toBe(true);
    expect(ativoNoMes(cancelado, "2026-06")).toBe(false);
  });
  it("inativo sem data de fim não conta em nenhum mês", () => {
    expect(ativoNoMes({ dataInicio: "2026-03-10", dataFim: null, status: "inativo" }, "2026-07")).toBe(false);
  });
});

describe("custoMensalRecorrente", () => {
  it("mensal retorna o valor cheio", () => {
    expect(custoMensalRecorrente({ valor: 100, ciclo: "mensal", dataInicio: "2026-01-01", dataFim: null, status: "ativo" }, "2026-07")).toBe(100);
  });
  it("anual rateia por 12", () => {
    expect(custoMensalRecorrente({ valor: 1200, ciclo: "anual", dataInicio: "2026-01-01", dataFim: null, status: "ativo" }, "2026-07")).toBe(100);
  });
  it("pontual conta só no mês do início", () => {
    const item = { valor: 500, ciclo: "pontual" as const, dataInicio: "2026-07-05", dataFim: null, status: "ativo" };
    expect(custoMensalRecorrente(item, "2026-07")).toBe(500);
    expect(custoMensalRecorrente(item, "2026-08")).toBe(0);
  });
  it("fora da janela retorna 0", () => {
    expect(custoMensalRecorrente({ valor: 100, ciclo: "mensal", dataInicio: "2026-09-01", dataFim: null, status: "ativo" }, "2026-07")).toBe(0);
  });
});

describe("converter", () => {
  it("USD → BRL multiplica pela taxa; USD fica igual", () => {
    expect(converter(10, "USD", 5.5)).toEqual({ valorUSD: 10, valorBRL: 55 });
  });
  it("BRL → USD divide pela taxa; BRL fica igual", () => {
    expect(converter(55, "BRL", 5.5)).toEqual({ valorUSD: 10, valorBRL: 55 });
  });
  it("taxa 0 não quebra (USD estimado 0)", () => {
    expect(converter(55, "BRL", 0)).toEqual({ valorUSD: 0, valorBRL: 55 });
  });
});

describe("agregações", () => {
  const linhas: LinhaCusto[] = [
    { pilar: "assinaturas", fornecedor: "Anthropic", projeto: "Geral", moeda: "USD", valorOriginal: 20, valorUSD: 20, valorBRL: 110 },
    { pilar: "gcp", fornecedor: "Google", projeto: "Synapse", moeda: "USD", valorOriginal: 30, valorUSD: 30, valorBRL: 165 },
    { pilar: "assinaturas", fornecedor: "Anthropic", projeto: "Synapse", moeda: "USD", valorOriginal: 10, valorUSD: 10, valorBRL: 55 },
  ];
  it("totalBRL soma tudo", () => {
    expect(totalBRL(linhas)).toBe(330);
  });
  it("totalUSD soma tudo", () => {
    expect(totalUSD(linhas)).toBe(60);
  });
  it("agruparPor pilar soma BRL por pilar", () => {
    expect(agruparPor(linhas, "pilar")).toEqual({ assinaturas: 165, gcp: 165 });
  });
  it("agruparPor projeto isola o Synapse", () => {
    expect(agruparPor(linhas, "projeto")).toEqual({ Geral: 110, Synapse: 220 });
  });
});
```

- [ ] **Step 2: Rodar e verificar que falham**

Run: `npm run test -- custos-calc`
Expected: FAIL — módulo `./custos-calc` não existe / funções indefinidas.

- [ ] **Step 3: Implementar `shared/custos-calc.ts`**

```ts
export type Moeda = "USD" | "BRL";
export type Projeto = "Synapse" | "Cortex" | "Geral";
export type Pilar = "assinaturas" | "anthropic" | "gcp" | "ferramentas";

export interface LinhaCusto {
  pilar: Pilar;
  fornecedor: string;
  projeto: Projeto;
  moeda: Moeda;
  valorOriginal: number;
  valorUSD: number;
  valorBRL: number;
}

export interface ItemRecorrente {
  valor: number;
  ciclo: "mensal" | "anual" | "pontual";
  dataInicio: string;   // YYYY-MM-DD
  dataFim: string | null;
  status: string;       // 'ativo' | 'inativo'
}

/** Extrai 'YYYY-MM' de uma data ISO 'YYYY-MM-DD'. */
export function mesDe(dataISO: string): string {
  return dataISO.slice(0, 7);
}

/** Um item está ativo no mês se o mês cai dentro de [inicio, fim]. Inativo sem fim não conta. */
export function ativoNoMes(
  input: { dataInicio: string; dataFim: string | null; status: string },
  mes: string,
): boolean {
  const inicio = mesDe(input.dataInicio);
  if (mes < inicio) return false;
  const fim = input.dataFim ? mesDe(input.dataFim) : null;
  if (fim && mes > fim) return false;
  if (!fim && input.status.toLowerCase() !== "ativo") return false;
  return true;
}

/** Custo mensal de um item recorrente no mês dado, tratando ciclo e janela de atividade. */
export function custoMensalRecorrente(input: ItemRecorrente, mes: string): number {
  if (!ativoNoMes(input, mes)) return 0;
  if (input.ciclo === "pontual") return mesDe(input.dataInicio) === mes ? input.valor : 0;
  if (input.ciclo === "anual") return input.valor / 12;
  return input.valor;
}

/** Converte um valor da moeda de origem para USD e BRL usando a taxa USD→BRL do mês. */
export function converter(valor: number, moeda: Moeda, taxaUsdBrl: number): { valorUSD: number; valorBRL: number } {
  if (moeda === "BRL") {
    return { valorUSD: taxaUsdBrl ? valor / taxaUsdBrl : 0, valorBRL: valor };
  }
  return { valorUSD: valor, valorBRL: valor * taxaUsdBrl };
}

export function totalBRL(linhas: LinhaCusto[]): number {
  return linhas.reduce((s, l) => s + l.valorBRL, 0);
}

export function totalUSD(linhas: LinhaCusto[]): number {
  return linhas.reduce((s, l) => s + l.valorUSD, 0);
}

/** Agrupa somando valorBRL por uma chave da linha (ex: 'pilar', 'projeto', 'fornecedor'). */
export function agruparPor(linhas: LinhaCusto[], chave: keyof LinhaCusto): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of linhas) {
    const k = String(l[chave]);
    out[k] = (out[k] || 0) + l.valorBRL;
  }
  return out;
}
```

- [ ] **Step 4: Rodar e verificar que passam**

Run: `npm run test -- custos-calc`
Expected: PASS — todos os testes verdes.

- [ ] **Step 5: Commit**

```bash
git add shared/custos-calc.ts shared/custos-calc.test.ts
git commit -m "feat(custos): logica pura de consolidacao (rateio, conversao, agregacao) com testes

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Serviço de câmbio USD→BRL

**Files:**
- Create: `server/services/custos/cambio.ts`

**Interfaces:**
- Consumes: `db` (de `../../db`), `sql` (de `drizzle-orm`).
- Produces: `buscarTaxaAwesomeAPI(): Promise<number>`, `upsertTaxaMes(db, anoMes: string, taxa: number, fonte: "auto"|"manual"): Promise<void>`, `getTaxaMes(db, anoMes: string): Promise<{taxa: number; estimada: boolean}>`, `syncCambioMesAtual(db): Promise<number>`.

- [ ] **Step 1: Implementar `server/services/custos/cambio.ts`**

```ts
import { sql } from "drizzle-orm";

/** Busca a cotação USD→BRL atual na AwesomeAPI (sem key). */
export async function buscarTaxaAwesomeAPI(): Promise<number> {
  const res = await fetch("https://economia.awesomeapi.com.br/last/USD-BRL");
  if (!res.ok) throw new Error(`AwesomeAPI status ${res.status}`);
  const json: any = await res.json();
  const bid = parseFloat(json?.USDBRL?.bid);
  if (!bid || Number.isNaN(bid)) throw new Error("AwesomeAPI: cotação inválida");
  return bid;
}

/** Grava/atualiza a taxa de um mês. fonte='manual' não é sobrescrita pelo job automático. */
export async function upsertTaxaMes(
  db: any, anoMes: string, taxa: number, fonte: "auto" | "manual",
): Promise<void> {
  await db.execute(sql`
    INSERT INTO cortex_core.custo_cambio_mensal (ano_mes, taxa_usd_brl, fonte, updated_at)
    VALUES (${anoMes}, ${taxa}, ${fonte}, NOW())
    ON CONFLICT (ano_mes) DO UPDATE SET
      taxa_usd_brl = EXCLUDED.taxa_usd_brl,
      fonte = EXCLUDED.fonte,
      updated_at = NOW()
  `);
}

/** Taxa do mês; se ausente usa a última conhecida (estimada=true); se não houver nenhuma, busca on-demand. */
export async function getTaxaMes(db: any, anoMes: string): Promise<{ taxa: number; estimada: boolean }> {
  const r = await db.execute(sql`
    SELECT taxa_usd_brl FROM cortex_core.custo_cambio_mensal WHERE ano_mes = ${anoMes}
  `);
  if (r.rows.length) return { taxa: parseFloat(r.rows[0].taxa_usd_brl), estimada: false };

  const last = await db.execute(sql`
    SELECT taxa_usd_brl FROM cortex_core.custo_cambio_mensal ORDER BY ano_mes DESC LIMIT 1
  `);
  if (last.rows.length) return { taxa: parseFloat(last.rows[0].taxa_usd_brl), estimada: true };

  try {
    const taxa = await buscarTaxaAwesomeAPI();
    await upsertTaxaMes(db, anoMes, taxa, "auto");
    return { taxa, estimada: false };
  } catch {
    return { taxa: 0, estimada: true };
  }
}

/** Atualiza a taxa do mês corrente com a cotação atual, exceto se o mês estiver marcado como 'manual'. */
export async function syncCambioMesAtual(db: any): Promise<number> {
  const anoMes = new Date().toISOString().slice(0, 7);
  const existing = await db.execute(sql`
    SELECT fonte FROM cortex_core.custo_cambio_mensal WHERE ano_mes = ${anoMes}
  `);
  if (existing.rows.length && existing.rows[0].fonte === "manual") {
    return parseFloat((await getTaxaMes(db, anoMes)).taxa.toString());
  }
  const taxa = await buscarTaxaAwesomeAPI();
  await upsertTaxaMes(db, anoMes, taxa, "auto");
  return taxa;
}
```

- [ ] **Step 2: Validar tipos e execução real da API**

Run: `npm run check`
Expected: sem erros de tipo.

Run: `curl -s "https://economia.awesomeapi.com.br/last/USD-BRL"`
Expected: JSON com `USDBRL.bid` (string decimal, ex: `"5.43"`). Confirma o caminho de parse.

- [ ] **Step 3: Commit**

```bash
git add server/services/custos/cambio.ts
git commit -m "feat(custos): servico de cambio USD-BRL (AwesomeAPI + override manual)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Consolidação (backend) + endpoints de leitura + registro da rota

**Files:**
- Create: `server/services/custos/consolidacao.ts`
- Create: `server/routes/custos.ts`
- Modify: `server/routes.ts` (import ~linha 42; chamada ~linha 8504)

**Interfaces:**
- Consumes: `custos-calc` (Task 2), `getTaxaMes` (Task 3), `db`, `sql`.
- Produces (service): `consolidarMes(db, mes: string): Promise<ResumoMes>`, `evolucao(db, de: string, ate: string): Promise<ResumoMes[]>`, `mesesEntre(de: string, ate: string): string[]`. `ResumoMes = { mes, totalBRL, totalUSD, porPilar, porProjeto, porFornecedor, taxa, cambioEstimado, linhas }`.
- Produces (rotas): `registerCustosRoutes(app, db)`; endpoints `GET /api/custos/consolidado`, `GET /api/custos/evolucao`, `GET /api/custos/cambio`, `PUT /api/custos/cambio/:anoMes`, `GET /api/custos/pessoas`.
- Consumed por: Tasks 5–8 (adicionam handlers no mesmo `custos.ts`) e frontend (Tasks 11–14).

- [ ] **Step 1: Implementar `server/services/custos/consolidacao.ts`**

```ts
import { sql } from "drizzle-orm";
import {
  custoMensalRecorrente, converter, agruparPor, totalBRL, totalUSD,
  type LinhaCusto, type Moeda, type Projeto,
} from "../../../shared/custos-calc";
import { getTaxaMes } from "./cambio";

export interface ResumoMes {
  mes: string;
  totalBRL: number;
  totalUSD: number;
  porPilar: Record<string, number>;
  porProjeto: Record<string, number>;
  porFornecedor: Record<string, number>;
  taxa: number;
  cambioEstimado: boolean;
  linhas: LinhaCusto[];
}

function asProjeto(v: any): Projeto {
  return v === "Synapse" || v === "Cortex" ? v : "Geral";
}
function asMoeda(v: any): Moeda {
  return v === "BRL" ? "BRL" : "USD";
}

/** Lista de meses 'YYYY-MM' de `de` até `ate`, inclusive. */
export function mesesEntre(de: string, ate: string): string[] {
  const out: string[] = [];
  let [y, m] = de.split("-").map(Number);
  const [ay, am] = ate.split("-").map(Number);
  while (y < ay || (y === ay && m <= am)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

export async function consolidarMes(db: any, mes: string): Promise<ResumoMes> {
  const { taxa, estimada } = await getTaxaMes(db, mes);
  const linhas: LinhaCusto[] = [];

  // Assinaturas (pilar 'assinaturas')
  const assinaturas = await db.execute(sql`
    SELECT fornecedor, valor, moeda, ciclo, data_assinatura, data_cancelamento, status, projeto
    FROM cortex_core.custo_assinaturas
  `);
  for (const r of assinaturas.rows as any[]) {
    const custo = custoMensalRecorrente(
      { valor: parseFloat(r.valor), ciclo: r.ciclo, dataInicio: r.data_assinatura, dataFim: r.data_cancelamento, status: r.status },
      mes,
    );
    if (custo <= 0) continue;
    const moeda = asMoeda(r.moeda);
    const { valorUSD, valorBRL } = converter(custo, moeda, taxa);
    linhas.push({ pilar: "assinaturas", fornecedor: r.fornecedor, projeto: asProjeto(r.projeto), moeda, valorOriginal: custo, valorUSD, valorBRL });
  }

  // Itens manuais / ferramentas (pilar 'ferramentas')
  const itens = await db.execute(sql`
    SELECT descricao, fornecedor, valor, moeda, ciclo, data_inicio, data_fim, status, projeto
    FROM cortex_core.custo_itens_manuais
  `);
  for (const r of itens.rows as any[]) {
    const custo = custoMensalRecorrente(
      { valor: parseFloat(r.valor), ciclo: r.ciclo, dataInicio: r.data_inicio, dataFim: r.data_fim, status: r.status },
      mes,
    );
    if (custo <= 0) continue;
    const moeda = asMoeda(r.moeda);
    const { valorUSD, valorBRL } = converter(custo, moeda, taxa);
    linhas.push({ pilar: "ferramentas", fornecedor: r.fornecedor || r.descricao, projeto: asProjeto(r.projeto), moeda, valorOriginal: custo, valorUSD, valorBRL });
  }

  // GCP (pilar 'gcp') — soma do mês por serviço/projeto
  const gcp = await db.execute(sql`
    SELECT servico, SUM(custo) AS custo, moeda, projeto_interno
    FROM cortex_core.custo_gcp_diario
    WHERE to_char(data, 'YYYY-MM') = ${mes}
    GROUP BY servico, moeda, projeto_interno
  `);
  for (const r of gcp.rows as any[]) {
    const moeda = asMoeda(r.moeda);
    const { valorUSD, valorBRL } = converter(parseFloat(r.custo), moeda, taxa);
    linhas.push({ pilar: "gcp", fornecedor: "Google Cloud", projeto: asProjeto(r.projeto_interno), moeda, valorOriginal: parseFloat(r.custo), valorUSD, valorBRL });
  }

  // Anthropic API (pilar 'anthropic') — soma do mês por workspace/projeto (sempre USD)
  const anthropic = await db.execute(sql`
    SELECT workspace, SUM(custo_usd) AS custo, projeto_interno
    FROM cortex_core.custo_anthropic_diario
    WHERE to_char(data, 'YYYY-MM') = ${mes}
    GROUP BY workspace, projeto_interno
  `);
  for (const r of anthropic.rows as any[]) {
    const { valorUSD, valorBRL } = converter(parseFloat(r.custo), "USD", taxa);
    linhas.push({ pilar: "anthropic", fornecedor: "Anthropic API", projeto: asProjeto(r.projeto_interno), moeda: "USD", valorOriginal: parseFloat(r.custo), valorUSD, valorBRL });
  }

  return {
    mes,
    totalBRL: totalBRL(linhas),
    totalUSD: totalUSD(linhas),
    porPilar: agruparPor(linhas, "pilar"),
    porProjeto: agruparPor(linhas, "projeto"),
    porFornecedor: agruparPor(linhas, "fornecedor"),
    taxa,
    cambioEstimado: estimada,
    linhas,
  };
}

export async function evolucao(db: any, de: string, ate: string): Promise<ResumoMes[]> {
  const meses = mesesEntre(de, ate);
  const out: ResumoMes[] = [];
  for (const m of meses) out.push(await consolidarMes(db, m));
  return out;
}
```

- [ ] **Step 2: Criar `server/routes/custos.ts` com os endpoints de leitura**

```ts
import type { Express } from "express";
import { sql } from "drizzle-orm";
import { consolidarMes, evolucao } from "../services/custos/consolidacao";
import { upsertTaxaMes } from "../services/custos/cambio";

function isAdmin(req: any, res: any, next: any) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden - Admin access required" });
  }
  next();
}

function mesAtual(): string {
  return new Date().toISOString().slice(0, 7);
}

export function registerCustosRoutes(app: Express, db: any) {
  // Consolidado de um mês
  app.get("/api/custos/consolidado", async (req, res) => {
    try {
      const mes = (req.query.mes as string) || mesAtual();
      res.json(await consolidarMes(db, mes));
    } catch (error) {
      console.error("[custos] consolidado:", error);
      res.status(500).json({ error: "Failed to build consolidado" });
    }
  });

  // Evolução mês a mês (default: últimos 6 meses até o mês atual)
  app.get("/api/custos/evolucao", async (req, res) => {
    try {
      const ate = (req.query.ate as string) || mesAtual();
      let de = req.query.de as string;
      if (!de) {
        const [y, m] = ate.split("-").map(Number);
        const d = new Date(Date.UTC(y, m - 1 - 5, 1));
        de = d.toISOString().slice(0, 7);
      }
      res.json(await evolucao(db, de, ate));
    } catch (error) {
      console.error("[custos] evolucao:", error);
      res.status(500).json({ error: "Failed to build evolucao" });
    }
  });

  // Câmbio: lista
  app.get("/api/custos/cambio", async (_req, res) => {
    try {
      const r = await db.execute(sql`
        SELECT ano_mes, taxa_usd_brl, fonte, updated_at
        FROM cortex_core.custo_cambio_mensal ORDER BY ano_mes DESC
      `);
      res.json(r.rows.map((row: any) => ({
        anoMes: row.ano_mes, taxa: parseFloat(row.taxa_usd_brl), fonte: row.fonte, updatedAt: row.updated_at,
      })));
    } catch (error) {
      console.error("[custos] cambio list:", error);
      res.status(500).json({ error: "Failed to list cambio" });
    }
  });

  // Câmbio: override manual
  app.put("/api/custos/cambio/:anoMes", isAdmin, async (req, res) => {
    try {
      const { anoMes } = req.params;
      const taxa = parseFloat(req.body?.taxa);
      if (!taxa || Number.isNaN(taxa)) return res.status(400).json({ error: "taxa inválida" });
      await upsertTaxaMes(db, anoMes, taxa, "manual");
      res.json({ anoMes, taxa, fonte: "manual" });
    } catch (error) {
      console.error("[custos] cambio put:", error);
      res.status(500).json({ error: "Failed to set cambio" });
    }
  });

  // Pessoas do RH (para o multi-select de usuários das assinaturas)
  app.get("/api/custos/pessoas", async (_req, res) => {
    try {
      const r = await db.execute(sql`
        SELECT id, nome FROM "Inhire".rh_pessoal
        WHERE LOWER(status) = 'ativo' ORDER BY nome
      `);
      res.json(r.rows.map((row: any) => ({ id: row.id, nome: row.nome })));
    } catch (error) {
      console.error("[custos] pessoas:", error);
      res.status(500).json({ error: "Failed to list pessoas" });
    }
  });
}
```

- [ ] **Step 3: Registrar a rota em `server/routes.ts`**

Adicionar o import junto ao bloco de imports de rotas (perto de `server/routes.ts:42`):

```ts
import { registerCustosRoutes } from "./routes/custos";
```

Adicionar a chamada dentro de `registerRoutes`, perto da linha 8504 (onde `registerMetasRoutes` é chamado). `db` já está em escopo:

```ts
  // Central de Custos de IA
  registerCustosRoutes(app, db);
```

- [ ] **Step 4: Validar tipos**

Run: `npm run check`
Expected: sem erros de tipo.

(Validação funcional dos endpoints é feita pelo operador humano com o dev server; subagentes não sobem o server.)

- [ ] **Step 5: Commit**

```bash
git add server/services/custos/consolidacao.ts server/routes/custos.ts server/routes.ts
git commit -m "feat(custos): consolidacao mensal + endpoints de leitura (consolidado, evolucao, cambio, pessoas)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: CRUD de Assinaturas (backend)

**Files:**
- Modify: `server/routes/custos.ts` (adicionar handlers dentro de `registerCustosRoutes`)

**Interfaces:**
- Produces: `GET /api/custos/assinaturas`, `POST /api/custos/assinaturas`, `PUT /api/custos/assinaturas/:id`, `DELETE /api/custos/assinaturas/:id`, `PUT /api/custos/assinaturas/:id/usuarios`.
- Cada assinatura retornada inclui `usuarios: {id, nome}[]` (join com `custo_assinatura_usuarios` + `"Inhire".rh_pessoal`).

- [ ] **Step 1: Adicionar os handlers de assinaturas em `server/routes/custos.ts`**

Inserir dentro de `registerCustosRoutes`, antes do fechamento da função:

```ts
  // ---- Assinaturas ----
  app.get("/api/custos/assinaturas", async (_req, res) => {
    try {
      const r = await db.execute(sql`
        SELECT a.*, COALESCE(
          json_agg(json_build_object('id', p.id, 'nome', p.nome)) FILTER (WHERE p.id IS NOT NULL),
          '[]'
        ) AS usuarios
        FROM cortex_core.custo_assinaturas a
        LEFT JOIN cortex_core.custo_assinatura_usuarios au ON au.assinatura_id = a.id
        LEFT JOIN "Inhire".rh_pessoal p ON p.id = au.pessoa_id
        GROUP BY a.id
        ORDER BY a.status ASC, a.fornecedor ASC, a.plano ASC
      `);
      res.json(r.rows.map((row: any) => ({
        id: row.id,
        fornecedor: row.fornecedor,
        plano: row.plano,
        valor: parseFloat(row.valor) || 0,
        moeda: row.moeda,
        ciclo: row.ciclo,
        dataAssinatura: row.data_assinatura,
        dataCancelamento: row.data_cancelamento,
        status: row.status,
        responsavelPessoaId: row.responsavel_pessoa_id,
        projeto: row.projeto,
        observacoes: row.observacoes,
        usuarios: row.usuarios,
      })));
    } catch (error) {
      console.error("[custos] assinaturas list:", error);
      res.status(500).json({ error: "Failed to list assinaturas" });
    }
  });

  app.post("/api/custos/assinaturas", isAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      if (!b.fornecedor || !b.plano || !b.dataAssinatura) {
        return res.status(400).json({ error: "fornecedor, plano e dataAssinatura são obrigatórios" });
      }
      const result = await db.execute(sql`
        INSERT INTO cortex_core.custo_assinaturas
          (fornecedor, plano, valor, moeda, ciclo, data_assinatura, data_cancelamento, status, responsavel_pessoa_id, projeto, observacoes)
        VALUES
          (${b.fornecedor}, ${b.plano}, ${b.valor || 0}, ${b.moeda || "USD"}, ${b.ciclo || "mensal"},
           ${b.dataAssinatura}, ${b.dataCancelamento || null}, ${b.status || "ativo"},
           ${b.responsavelPessoaId || null}, ${b.projeto || "Geral"}, ${b.observacoes || null})
        RETURNING id
      `);
      const id = (result.rows[0] as any).id;
      const usuarios: number[] = Array.isArray(b.usuarios) ? b.usuarios : [];
      for (const pid of usuarios) {
        await db.execute(sql`
          INSERT INTO cortex_core.custo_assinatura_usuarios (assinatura_id, pessoa_id)
          VALUES (${id}, ${pid}) ON CONFLICT DO NOTHING
        `);
      }
      res.status(201).json({ id });
    } catch (error) {
      console.error("[custos] assinatura create:", error);
      res.status(500).json({ error: "Failed to create assinatura" });
    }
  });

  app.put("/api/custos/assinaturas/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const b = req.body || {};
      const result = await db.execute(sql`
        UPDATE cortex_core.custo_assinaturas SET
          fornecedor = COALESCE(${b.fornecedor}, fornecedor),
          plano = COALESCE(${b.plano}, plano),
          valor = COALESCE(${b.valor}, valor),
          moeda = COALESCE(${b.moeda}, moeda),
          ciclo = COALESCE(${b.ciclo}, ciclo),
          data_assinatura = COALESCE(${b.dataAssinatura}, data_assinatura),
          data_cancelamento = ${b.dataCancelamento === undefined ? sql`data_cancelamento` : b.dataCancelamento},
          status = COALESCE(${b.status}, status),
          responsavel_pessoa_id = ${b.responsavelPessoaId === undefined ? sql`responsavel_pessoa_id` : b.responsavelPessoaId},
          projeto = COALESCE(${b.projeto}, projeto),
          observacoes = ${b.observacoes === undefined ? sql`observacoes` : b.observacoes},
          updated_at = NOW()
        WHERE id = ${id} RETURNING id
      `);
      if (result.rows.length === 0) return res.status(404).json({ error: "Assinatura not found" });
      res.json({ id });
    } catch (error) {
      console.error("[custos] assinatura update:", error);
      res.status(500).json({ error: "Failed to update assinatura" });
    }
  });

  app.delete("/api/custos/assinaturas/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = await db.execute(sql`
        DELETE FROM cortex_core.custo_assinaturas WHERE id = ${id} RETURNING id
      `);
      if (result.rows.length === 0) return res.status(404).json({ error: "Assinatura not found" });
      res.status(204).send();
    } catch (error) {
      console.error("[custos] assinatura delete:", error);
      res.status(500).json({ error: "Failed to delete assinatura" });
    }
  });

  // Substitui a lista de usuários (pessoas do RH) de uma assinatura
  app.put("/api/custos/assinaturas/:id/usuarios", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const usuarios: number[] = Array.isArray(req.body?.usuarios) ? req.body.usuarios : [];
      await db.execute(sql`DELETE FROM cortex_core.custo_assinatura_usuarios WHERE assinatura_id = ${id}`);
      for (const pid of usuarios) {
        await db.execute(sql`
          INSERT INTO cortex_core.custo_assinatura_usuarios (assinatura_id, pessoa_id)
          VALUES (${id}, ${pid}) ON CONFLICT DO NOTHING
        `);
      }
      res.json({ id, usuarios });
    } catch (error) {
      console.error("[custos] assinatura usuarios:", error);
      res.status(500).json({ error: "Failed to set usuarios" });
    }
  });
```

- [ ] **Step 2: Validar tipos**

Run: `npm run check`
Expected: sem erros de tipo.

- [ ] **Step 3: Commit**

```bash
git add server/routes/custos.ts
git commit -m "feat(custos): CRUD de assinaturas com vinculo de usuarios do RH

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: CRUD de Itens Manuais / Ferramentas (backend)

**Files:**
- Modify: `server/routes/custos.ts`

**Interfaces:**
- Produces: `GET/POST/PUT/DELETE /api/custos/itens[/:id]`.

- [ ] **Step 1: Adicionar os handlers de itens em `server/routes/custos.ts`**

Inserir dentro de `registerCustosRoutes`:

```ts
  // ---- Itens manuais / ferramentas ----
  app.get("/api/custos/itens", async (_req, res) => {
    try {
      const r = await db.execute(sql`
        SELECT * FROM cortex_core.custo_itens_manuais
        ORDER BY status ASC, projeto ASC, descricao ASC
      `);
      res.json(r.rows.map((row: any) => ({
        id: row.id,
        descricao: row.descricao,
        fornecedor: row.fornecedor,
        categoria: row.categoria,
        valor: parseFloat(row.valor) || 0,
        moeda: row.moeda,
        ciclo: row.ciclo,
        dataInicio: row.data_inicio,
        dataFim: row.data_fim,
        status: row.status,
        projeto: row.projeto,
        responsavelPessoaId: row.responsavel_pessoa_id,
        observacoes: row.observacoes,
      })));
    } catch (error) {
      console.error("[custos] itens list:", error);
      res.status(500).json({ error: "Failed to list itens" });
    }
  });

  app.post("/api/custos/itens", isAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      if (!b.descricao || !b.dataInicio) {
        return res.status(400).json({ error: "descricao e dataInicio são obrigatórios" });
      }
      const result = await db.execute(sql`
        INSERT INTO cortex_core.custo_itens_manuais
          (descricao, fornecedor, categoria, valor, moeda, ciclo, data_inicio, data_fim, status, projeto, responsavel_pessoa_id, observacoes)
        VALUES
          (${b.descricao}, ${b.fornecedor || null}, ${b.categoria || null}, ${b.valor || 0}, ${b.moeda || "USD"},
           ${b.ciclo || "mensal"}, ${b.dataInicio}, ${b.dataFim || null}, ${b.status || "ativo"},
           ${b.projeto || "Geral"}, ${b.responsavelPessoaId || null}, ${b.observacoes || null})
        RETURNING id
      `);
      res.status(201).json({ id: (result.rows[0] as any).id });
    } catch (error) {
      console.error("[custos] item create:", error);
      res.status(500).json({ error: "Failed to create item" });
    }
  });

  app.put("/api/custos/itens/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const b = req.body || {};
      const result = await db.execute(sql`
        UPDATE cortex_core.custo_itens_manuais SET
          descricao = COALESCE(${b.descricao}, descricao),
          fornecedor = ${b.fornecedor === undefined ? sql`fornecedor` : b.fornecedor},
          categoria = ${b.categoria === undefined ? sql`categoria` : b.categoria},
          valor = COALESCE(${b.valor}, valor),
          moeda = COALESCE(${b.moeda}, moeda),
          ciclo = COALESCE(${b.ciclo}, ciclo),
          data_inicio = COALESCE(${b.dataInicio}, data_inicio),
          data_fim = ${b.dataFim === undefined ? sql`data_fim` : b.dataFim},
          status = COALESCE(${b.status}, status),
          projeto = COALESCE(${b.projeto}, projeto),
          responsavel_pessoa_id = ${b.responsavelPessoaId === undefined ? sql`responsavel_pessoa_id` : b.responsavelPessoaId},
          observacoes = ${b.observacoes === undefined ? sql`observacoes` : b.observacoes},
          updated_at = NOW()
        WHERE id = ${id} RETURNING id
      `);
      if (result.rows.length === 0) return res.status(404).json({ error: "Item not found" });
      res.json({ id });
    } catch (error) {
      console.error("[custos] item update:", error);
      res.status(500).json({ error: "Failed to update item" });
    }
  });

  app.delete("/api/custos/itens/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = await db.execute(sql`
        DELETE FROM cortex_core.custo_itens_manuais WHERE id = ${id} RETURNING id
      `);
      if (result.rows.length === 0) return res.status(404).json({ error: "Item not found" });
      res.status(204).send();
    } catch (error) {
      console.error("[custos] item delete:", error);
      res.status(500).json({ error: "Failed to delete item" });
    }
  });
```

- [ ] **Step 2: Validar tipos**

Run: `npm run check`
Expected: sem erros de tipo.

- [ ] **Step 3: Commit**

```bash
git add server/routes/custos.ts
git commit -m "feat(custos): CRUD de itens manuais/ferramentas

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Sync GCP BigQuery Billing Export (backend)

**Files:**
- Modify: `package.json` (dependência `@google-cloud/bigquery`)
- Create: `server/services/custos/gcpBillingSync.ts`
- Modify: `server/routes/custos.ts` (endpoints GCP + mapa de projeto)

**Interfaces:**
- Consumes: `GCP_BILLING_BQ_TABLE`, `GOOGLE_SERVICE_ACCOUNT_JSON`.
- Produces: `syncGcpBilling(db, dias?: number): Promise<{ linhas: number; desde: string }>`.
- Produces (rotas): `GET /api/custos/gcp`, `POST /api/custos/gcp/sync`, `GET /api/custos/gcp/mapa`, `PUT /api/custos/gcp/mapa/:projectId`.

- [ ] **Step 1: Instalar a dependência**

Run: `npm install @google-cloud/bigquery`
Expected: adiciona `@google-cloud/bigquery` ao `package.json`.

- [ ] **Step 2: Implementar `server/services/custos/gcpBillingSync.ts`**

```ts
import { readFileSync } from "node:fs";
import { BigQuery } from "@google-cloud/bigquery";
import { sql } from "drizzle-orm";

/** Lê a credencial da service account de GOOGLE_SERVICE_ACCOUNT_JSON (JSON inline ou caminho .json). */
function getCredentials(): any {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON não configurada");
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  return JSON.parse(readFileSync(trimmed, "utf8"));
}

/**
 * Sincroniza os custos do GCP dos últimos `dias` a partir do BigQuery Billing Export,
 * agregando por dia × projeto × serviço, e faz upsert em custo_gcp_diario.
 */
export async function syncGcpBilling(db: any, dias = 45): Promise<{ linhas: number; desde: string }> {
  const table = process.env.GCP_BILLING_BQ_TABLE;
  if (!table) throw new Error("GCP_BILLING_BQ_TABLE não configurada");

  const credentials = getCredentials();
  const bq = new BigQuery({ credentials, projectId: credentials.project_id });

  const desde = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);

  // `table` vem de env (confiável); não pode ser bind param em BigQuery (nome de tabela).
  const query = `
    SELECT
      DATE(usage_start_time) AS data,
      project.id AS gcp_project_id,
      service.description AS servico,
      SUM(cost) AS custo,
      currency
    FROM \`${table}\`
    WHERE DATE(usage_start_time) >= @desde AND project.id IS NOT NULL
    GROUP BY data, gcp_project_id, servico, currency
  `;
  const [rows] = await bq.query({ query, params: { desde } });

  // Mapa projeto GCP → projeto interno (Synapse/Cortex/Geral)
  const mapRes = await db.execute(sql`SELECT gcp_project_id, projeto_interno FROM cortex_core.custo_gcp_projeto_map`);
  const map = new Map<string, string>((mapRes.rows as any[]).map((r) => [r.gcp_project_id, r.projeto_interno]));

  let count = 0;
  for (const r of rows as any[]) {
    const dataStr = typeof r.data === "string" ? r.data : r.data?.value; // BigQuery DATE vem como {value:'YYYY-MM-DD'}
    const projetoInterno = map.get(r.gcp_project_id) || "Geral";
    await db.execute(sql`
      INSERT INTO cortex_core.custo_gcp_diario (data, gcp_project_id, servico, custo, moeda, projeto_interno, synced_at)
      VALUES (${dataStr}, ${r.gcp_project_id}, ${r.servico || "—"}, ${r.custo || 0}, ${r.currency || "USD"}, ${projetoInterno}, NOW())
      ON CONFLICT (data, gcp_project_id, servico) DO UPDATE SET
        custo = EXCLUDED.custo,
        moeda = EXCLUDED.moeda,
        projeto_interno = EXCLUDED.projeto_interno,
        synced_at = NOW()
    `);
    count++;
  }
  return { linhas: count, desde };
}
```

- [ ] **Step 3: Adicionar os endpoints GCP em `server/routes/custos.ts`**

No topo do arquivo, adicionar o import:

```ts
import { syncGcpBilling } from "../services/custos/gcpBillingSync";
```

Dentro de `registerCustosRoutes`:

```ts
  // ---- GCP ----
  app.get("/api/custos/gcp", async (req, res) => {
    try {
      const mes = (req.query.mes as string) || new Date().toISOString().slice(0, 7);
      const r = await db.execute(sql`
        SELECT gcp_project_id, projeto_interno, servico, SUM(custo) AS custo, moeda
        FROM cortex_core.custo_gcp_diario
        WHERE to_char(data, 'YYYY-MM') = ${mes}
        GROUP BY gcp_project_id, projeto_interno, servico, moeda
        ORDER BY custo DESC
      `);
      res.json(r.rows.map((row: any) => ({
        gcpProjectId: row.gcp_project_id,
        projetoInterno: row.projeto_interno,
        servico: row.servico,
        custo: parseFloat(row.custo) || 0,
        moeda: row.moeda,
      })));
    } catch (error) {
      console.error("[custos] gcp detail:", error);
      res.status(500).json({ error: "Failed to fetch gcp detail" });
    }
  });

  app.post("/api/custos/gcp/sync", isAdmin, async (req, res) => {
    try {
      const dias = req.body?.dias ? parseInt(req.body.dias) : undefined;
      const out = await syncGcpBilling(db, dias);
      res.json({ ok: true, ...out });
    } catch (error: any) {
      console.error("[custos] gcp sync:", error);
      res.status(500).json({ error: error.message || "Failed to sync gcp" });
    }
  });

  app.get("/api/custos/gcp/mapa", async (_req, res) => {
    try {
      const r = await db.execute(sql`SELECT gcp_project_id, projeto_interno FROM cortex_core.custo_gcp_projeto_map ORDER BY gcp_project_id`);
      res.json(r.rows.map((row: any) => ({ gcpProjectId: row.gcp_project_id, projetoInterno: row.projeto_interno })));
    } catch (error) {
      console.error("[custos] gcp mapa list:", error);
      res.status(500).json({ error: "Failed to list mapa" });
    }
  });

  app.put("/api/custos/gcp/mapa/:projectId", isAdmin, async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const projetoInterno = req.body?.projetoInterno || "Geral";
      await db.execute(sql`
        INSERT INTO cortex_core.custo_gcp_projeto_map (gcp_project_id, projeto_interno)
        VALUES (${projectId}, ${projetoInterno})
        ON CONFLICT (gcp_project_id) DO UPDATE SET projeto_interno = EXCLUDED.projeto_interno
      `);
      // Reatribui as linhas já sincronizadas desse projeto
      await db.execute(sql`
        UPDATE cortex_core.custo_gcp_diario SET projeto_interno = ${projetoInterno} WHERE gcp_project_id = ${projectId}
      `);
      res.json({ gcpProjectId: projectId, projetoInterno });
    } catch (error) {
      console.error("[custos] gcp mapa put:", error);
      res.status(500).json({ error: "Failed to set mapa" });
    }
  });
```

- [ ] **Step 4: Validar tipos e (com credenciais) a query real**

Run: `npm run check`
Expected: sem erros de tipo.

Antes de agendar o job (Task 9), valide a query real quando `GCP_BILLING_BQ_TABLE` e `GOOGLE_SERVICE_ACCOUNT_JSON` estiverem configuradas: o operador humano chama `POST /api/custos/gcp/sync` e confere que `linhas > 0`. Se o schema do billing export divergir (nomes de coluna), ajuste a query do Step 2 conforme o schema real da tabela (`SELECT column_name FROM ...INFORMATION_SCHEMA.COLUMNS`).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json server/services/custos/gcpBillingSync.ts server/routes/custos.ts
git commit -m "feat(custos): sync do GCP Billing Export via BigQuery + mapa de projeto interno

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Sync Anthropic Cost Report (backend)

**Files:**
- Create: `server/services/custos/anthropicCostSync.ts`
- Modify: `server/routes/custos.ts` (endpoints Anthropic)

**Interfaces:**
- Consumes: `ANTHROPIC_ADMIN_KEY`.
- Produces: `syncAnthropicCost(db, dias?: number): Promise<{ dias: number; desde: string }>`.
- Produces (rotas): `GET /api/custos/anthropic`, `POST /api/custos/anthropic/sync`.

- [ ] **Step 1: Implementar `server/services/custos/anthropicCostSync.ts`**

A Admin API não faz parte do fluxo do SDK — usa-se `fetch` com header `x-api-key` (a Admin key) + `anthropic-version`. Endpoint: `GET https://api.anthropic.com/v1/organizations/cost_report`, buckets diários (`bucket_width=1d`), agrupado por `workspace_id`. Cada bucket tem `starting_at` e `results[]` com `amount` (USD, string) e `workspace_id`.

```ts
import { sql } from "drizzle-orm";

const ANTHROPIC_VERSION = "2023-06-01";
const COST_URL = "https://api.anthropic.com/v1/organizations/cost_report";

/**
 * Sincroniza o Cost Report da Anthropic dos últimos `dias`, por dia × workspace,
 * e faz upsert em custo_anthropic_diario. Requer ANTHROPIC_ADMIN_KEY.
 */
export async function syncAnthropicCost(db: any, dias = 45): Promise<{ dias: number; desde: string }> {
  const adminKey = process.env.ANTHROPIC_ADMIN_KEY;
  if (!adminKey) throw new Error("ANTHROPIC_ADMIN_KEY não configurada");

  const desdeDate = new Date(Date.now() - dias * 86400000);
  const desde = desdeDate.toISOString().slice(0, 10);

  let page: string | null = null;
  let processados = 0;

  do {
    const url = new URL(COST_URL);
    url.searchParams.set("starting_at", desdeDate.toISOString());
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.append("group_by[]", "workspace_id");
    url.searchParams.set("limit", "31");
    if (page) url.searchParams.set("page", page);

    const res = await fetch(url, {
      headers: { "x-api-key": adminKey, "anthropic-version": ANTHROPIC_VERSION },
    });
    if (!res.ok) throw new Error(`Cost Report status ${res.status}: ${await res.text()}`);
    const json: any = await res.json();

    for (const bucket of json.data || []) {
      const dia = String(bucket.starting_at || "").slice(0, 10);
      if (!dia) continue;
      for (const result of bucket.results || []) {
        const workspace = result.workspace_id || "";
        const custo = parseFloat(result.amount ?? result.cost ?? "0") || 0;
        await db.execute(sql`
          INSERT INTO cortex_core.custo_anthropic_diario (data, workspace, modelo, custo_usd, projeto_interno, synced_at)
          VALUES (${dia}, ${workspace}, '', ${custo}, 'Geral', NOW())
          ON CONFLICT (data, workspace, modelo) DO UPDATE SET
            custo_usd = EXCLUDED.custo_usd,
            synced_at = NOW()
        `);
        processados++;
      }
    }
    page = json.has_more ? json.next_page : null;
  } while (page);

  return { dias, desde };
}
```

- [ ] **Step 2: Adicionar os endpoints Anthropic em `server/routes/custos.ts`**

No topo, adicionar o import:

```ts
import { syncAnthropicCost } from "../services/custos/anthropicCostSync";
```

Dentro de `registerCustosRoutes`:

```ts
  // ---- Anthropic API ----
  app.get("/api/custos/anthropic", async (req, res) => {
    try {
      const mes = (req.query.mes as string) || new Date().toISOString().slice(0, 7);
      const r = await db.execute(sql`
        SELECT workspace, projeto_interno, SUM(custo_usd) AS custo,
               SUM(COALESCE(tokens_input,0)) AS tokens_input, SUM(COALESCE(tokens_output,0)) AS tokens_output
        FROM cortex_core.custo_anthropic_diario
        WHERE to_char(data, 'YYYY-MM') = ${mes}
        GROUP BY workspace, projeto_interno
        ORDER BY custo DESC
      `);
      res.json(r.rows.map((row: any) => ({
        workspace: row.workspace,
        projetoInterno: row.projeto_interno,
        custoUsd: parseFloat(row.custo) || 0,
        tokensInput: parseInt(row.tokens_input) || 0,
        tokensOutput: parseInt(row.tokens_output) || 0,
      })));
    } catch (error) {
      console.error("[custos] anthropic detail:", error);
      res.status(500).json({ error: "Failed to fetch anthropic detail" });
    }
  });

  app.post("/api/custos/anthropic/sync", isAdmin, async (req, res) => {
    try {
      const dias = req.body?.dias ? parseInt(req.body.dias) : undefined;
      const out = await syncAnthropicCost(db, dias);
      res.json({ ok: true, ...out });
    } catch (error: any) {
      console.error("[custos] anthropic sync:", error);
      res.status(500).json({ error: error.message || "Failed to sync anthropic" });
    }
  });
```

- [ ] **Step 3: Validar tipos e (com a Admin key) o shape real**

Run: `npm run check`
Expected: sem erros de tipo.

Validação do shape real (operador humano, com `ANTHROPIC_ADMIN_KEY` setada) — confirmar os nomes de campo (`amount`, `workspace_id`, `starting_at`, `has_more`, `next_page`) antes de confiar no parse:

```bash
curl -s "https://api.anthropic.com/v1/organizations/cost_report?starting_at=2026-07-01T00:00:00Z&bucket_width=1d&group_by[]=workspace_id&limit=31" \
  -H "x-api-key: $ANTHROPIC_ADMIN_KEY" -H "anthropic-version: 2023-06-01" | head -c 2000
```
Se algum nome de campo divergir, ajustar o parse do Step 1 conforme o retorno real. Depois, o operador chama `POST /api/custos/anthropic/sync` e confere no banco.

- [ ] **Step 4: Commit**

```bash
git add server/services/custos/anthropicCostSync.ts server/routes/custos.ts
git commit -m "feat(custos): sync do Cost Report da Anthropic (Admin API)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Jobs agendados no boot (`server/index.ts`)

**Files:**
- Modify: `server/index.ts` (dentro do IIFE de boot, após `registerRoutes`, ~linha 191+)

**Interfaces:**
- Consumes: `syncGcpBilling` (Task 7), `syncAnthropicCost` (Task 8), `syncCambioMesAtual` (Task 3), `db`.

- [ ] **Step 1: Adicionar os três jobs no IIFE de boot de `server/index.ts`**

Localize o IIFE de boot (após `const server = await registerRoutes(app);`, ~linha 191) e adicione, seguindo o padrão `setTimeout` (1º disparo escalonado) + `setInterval` já usado por outros jobs no arquivo. O `db` é importado no topo de `server/index.ts` (mesma origem `./db` usada pelo restante); se não estiver, adicione `import { db } from "./db";`.

```ts
  // ===== Central de Custos de IA — jobs de sync =====
  const runCustosCambioJob = async () => {
    try {
      const { syncCambioMesAtual } = await import("./services/custos/cambio");
      const taxa = await syncCambioMesAtual(db);
      (globalThis as any).__custosCambioStatus = { lastSync: new Date().toISOString(), taxa, status: "success" };
    } catch (err: any) {
      (globalThis as any).__custosCambioStatus = { lastSync: new Date().toISOString(), status: "error", error: err.message };
    }
  };
  const runCustosGcpJob = async () => {
    try {
      const { syncGcpBilling } = await import("./services/custos/gcpBillingSync");
      const out = await syncGcpBilling(db);
      (globalThis as any).__custosGcpStatus = { lastSync: new Date().toISOString(), ...out, status: "success" };
    } catch (err: any) {
      (globalThis as any).__custosGcpStatus = { lastSync: new Date().toISOString(), status: "error", error: err.message };
    }
  };
  const runCustosAnthropicJob = async () => {
    try {
      const { syncAnthropicCost } = await import("./services/custos/anthropicCostSync");
      const out = await syncAnthropicCost(db);
      (globalThis as any).__custosAnthropicStatus = { lastSync: new Date().toISOString(), ...out, status: "success" };
    } catch (err: any) {
      (globalThis as any).__custosAnthropicStatus = { lastSync: new Date().toISOString(), status: "error", error: err.message };
    }
  };

  // Câmbio: 1x/dia (barato, mantém o mês corrente atualizado)
  setTimeout(() => runCustosCambioJob(), 3 * 60 * 1000);
  setInterval(() => runCustosCambioJob(), 24 * 60 * 60 * 1000);
  // GCP billing: 1x/dia (billing export tem latência de horas; não adianta rodar mais)
  setTimeout(() => runCustosGcpJob(), 5 * 60 * 1000);
  setInterval(() => runCustosGcpJob(), 24 * 60 * 60 * 1000);
  // Anthropic cost report: 1x/dia
  setTimeout(() => runCustosAnthropicJob(), 7 * 60 * 1000);
  setInterval(() => runCustosAnthropicJob(), 24 * 60 * 60 * 1000);
  console.log("[custos-jobs] Scheduled cambio/gcp/anthropic — daily");
```

- [ ] **Step 2: Validar tipos**

Run: `npm run check`
Expected: sem erros de tipo. (Os jobs falham graciosamente com `status:"error"` enquanto as env vars `GCP_BILLING_BQ_TABLE`/`ANTHROPIC_ADMIN_KEY` não estiverem configuradas — isso é esperado e não derruba o boot.)

- [ ] **Step 3: Commit**

```bash
git add server/index.ts
git commit -m "feat(custos): jobs diarios de sync (cambio, gcp billing, anthropic cost)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Frontend — formatador USD, rota, permissão e menu

**Files:**
- Modify: `client/src/lib/utils.ts` (adicionar `formatCurrencyUSD`)
- Modify: `shared/nav-config.ts` (permissão + rota + item de menu)
- Modify: `client/src/App.tsx` (import lazy + `<Route>`)
- Create: `client/src/pages/CentralCustos.tsx` (shell mínimo, substituído na Task 11)

**Interfaces:**
- Produces: `formatCurrencyUSD(value: number): string`; rota `/central-custos` acessível; item de menu na categoria Admin; `PERMISSION_KEYS.ADMIN.CENTRAL_CUSTOS = 'admin.central_custos'`.

- [ ] **Step 1: Adicionar `formatCurrencyUSD` em `client/src/lib/utils.ts`**

Após `formatCurrencyNoDecimals` (por volta de `utils.ts:83`):

```ts
export function formatCurrencyUSD(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
```

- [ ] **Step 2: Declarar permissão, rota→permissão, item de menu e label em `shared/nav-config.ts`**

Em `PERMISSION_KEYS.ADMIN` (objeto por volta de `nav-config.ts:144`), adicionar:

```ts
    CENTRAL_CUSTOS: 'admin.central_custos',
```

Em `ROUTE_TO_PERMISSION` (por volta de `nav-config.ts:217`), adicionar:

```ts
  '/central-custos': PERMISSION_KEYS.ADMIN.CENTRAL_CUSTOS,
```

Em `NAV_CONFIG.admin` (array por volta de `nav-config.ts:614`), adicionar o item:

```ts
    { title: 'Central de Custos', url: '/central-custos', icon: 'DollarSign', permissionKey: PERMISSION_KEYS.ADMIN.CENTRAL_CUSTOS },
```

Em `PERMISSION_LABELS` (por volta de `nav-config.ts:727`), adicionar:

```ts
  [PERMISSION_KEYS.ADMIN.CENTRAL_CUSTOS]: 'Central de Custos',
```

(`DollarSign` é ícone lucide-react; se não estiver mapeado em `app-sidebar.tsx`, use um já existente como `'LayoutDashboard'`.)

- [ ] **Step 3: Criar shell da página `client/src/pages/CentralCustos.tsx`**

```tsx
export default function CentralCustos() {
  return (
    <div className="min-h-full bg-gray-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl p-6 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Central de Custos de IA</h1>
        <p className="text-gray-600 dark:text-zinc-400">Em construção.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Registrar a rota em `client/src/App.tsx`**

No bloco de imports lazy (~linhas 53-188):

```tsx
const CentralCustos = lazyWithRetry(() => import("@/pages/CentralCustos"));
```

No `<Switch>` do `ProtectedRouter` (~linhas 305-484), junto das outras rotas admin:

```tsx
<Route path="/central-custos">{() => <ProtectedRoute path="/central-custos" component={CentralCustos} />}</Route>
```

- [ ] **Step 5: Validar tipos e commit**

Run: `npm run check`
Expected: sem erros de tipo.

```bash
git add client/src/lib/utils.ts shared/nav-config.ts client/src/App.tsx client/src/pages/CentralCustos.tsx
git commit -m "feat(custos): rota /central-custos, permissao admin, item de menu e formatador USD

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Página — header, seletor de mês, toggle de moeda, KPIs e gráfico de evolução

**Files:**
- Modify: `client/src/pages/CentralCustos.tsx` (substituir o shell)
- Create: `client/src/components/custos/KpisCustos.tsx`
- Create: `client/src/components/custos/EvolucaoCustos.tsx`

**Interfaces:**
- Consumes: `GET /api/custos/evolucao?ate=YYYY-MM` → `ResumoMes[]` (Task 4). `ResumoMes = { mes, totalBRL, totalUSD, porPilar, porProjeto, porFornecedor, taxa, cambioEstimado, linhas }`.
- Produces: componente de página com estado `mes`, `moeda` ('BRL'|'USD'), `activeTab`; passa `mes`/`moeda` às abas.
- Produces: `KpisCustos({ atual, anterior, moeda })`, `EvolucaoCustos({ dados, moeda })`.

- [ ] **Step 1: Criar `client/src/components/custos/KpisCustos.tsx`**

```tsx
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrencyNoDecimals, formatCurrencyUSD } from "@/lib/utils";

export interface ResumoMes {
  mes: string;
  totalBRL: number;
  totalUSD: number;
  porPilar: Record<string, number>;
  porProjeto: Record<string, number>;
  porFornecedor: Record<string, number>;
  taxa: number;
  cambioEstimado: boolean;
}

const PILAR_LABEL: Record<string, string> = {
  assinaturas: "Assinaturas", anthropic: "API Anthropic", gcp: "GCP", ferramentas: "Ferramentas",
};

function fmt(brl: number, moeda: "BRL" | "USD", totalBRL: number, totalUSD: number) {
  // usa proporção BRL para estimar o valor em USD de um subtotal quando só temos BRL
  if (moeda === "USD") return formatCurrencyUSD(totalBRL ? (brl / totalBRL) * totalUSD : 0);
  return formatCurrencyNoDecimals(brl);
}

export function KpisCustos({ atual, anterior, moeda }: { atual: ResumoMes; anterior?: ResumoMes; moeda: "BRL" | "USD" }) {
  const totalAtual = moeda === "BRL" ? atual.totalBRL : atual.totalUSD;
  const totalAnt = anterior ? (moeda === "BRL" ? anterior.totalBRL : anterior.totalUSD) : 0;
  const variacao = totalAnt ? ((totalAtual - totalAnt) / totalAnt) * 100 : 0;
  const synapseBRL = atual.porProjeto?.Synapse || 0;
  const pctSynapse = atual.totalBRL ? (synapseBRL / atual.totalBRL) * 100 : 0;
  const fmtTotal = moeda === "BRL" ? formatCurrencyNoDecimals : formatCurrencyUSD;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="dark:bg-zinc-900 dark:border-zinc-800" data-testid="kpi-total">
        <CardContent className="p-4">
          <div className="text-sm text-gray-500 dark:text-zinc-400">Total do mês</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{fmtTotal(totalAtual)}</div>
          {anterior && (
            <div className={`text-xs mt-1 ${variacao > 0 ? "text-red-500" : "text-emerald-500"}`}>
              {variacao > 0 ? "▲" : "▼"} {Math.abs(variacao).toFixed(1)}% vs. mês anterior
            </div>
          )}
        </CardContent>
      </Card>
      {(["assinaturas", "anthropic", "gcp", "ferramentas"] as const).map((p) => (
        <Card key={p} className="dark:bg-zinc-900 dark:border-zinc-800" data-testid={`kpi-${p}`}>
          <CardContent className="p-4">
            <div className="text-sm text-gray-500 dark:text-zinc-400">{PILAR_LABEL[p]}</div>
            <div className="text-xl font-semibold text-gray-900 dark:text-white">
              {fmt(atual.porPilar?.[p] || 0, moeda, atual.totalBRL, atual.totalUSD)}
            </div>
          </CardContent>
        </Card>
      ))}
      <Card className="sm:col-span-2 lg:col-span-1 border-violet-300 dark:border-violet-800 dark:bg-zinc-900" data-testid="kpi-synapse">
        <CardContent className="p-4">
          <div className="text-sm text-violet-600 dark:text-violet-400">Synapse</div>
          <div className="text-xl font-semibold text-gray-900 dark:text-white">
            {fmt(synapseBRL, moeda, atual.totalBRL, atual.totalUSD)}
          </div>
          <div className="text-xs text-gray-500 dark:text-zinc-400 mt-1">{pctSynapse.toFixed(0)}% do total</div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Criar `client/src/components/custos/EvolucaoCustos.tsx`**

```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals, formatCurrencyUSD } from "@/lib/utils";
import type { ResumoMes } from "./KpisCustos";

const PILARES = [
  { key: "assinaturas", label: "Assinaturas", cor: "#6366f1" },
  { key: "anthropic", label: "API Anthropic", cor: "#f59e0b" },
  { key: "gcp", label: "GCP", cor: "#10b981" },
  { key: "ferramentas", label: "Ferramentas", cor: "#ec4899" },
];

export function EvolucaoCustos({ dados, moeda }: { dados: ResumoMes[]; moeda: "BRL" | "USD" }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const fmt = moeda === "BRL" ? formatCurrencyNoDecimals : formatCurrencyUSD;

  const chartData = dados.map((d) => {
    const fator = moeda === "USD" && d.totalBRL ? d.totalUSD / d.totalBRL : 1;
    const row: any = { mes: d.mes };
    for (const p of PILARES) row[p.key] = (d.porPilar?.[p.key] || 0) * (moeda === "USD" ? fator : 1);
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#3f3f46" : "#e5e7eb"} vertical={false} />
        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }} />
        <YAxis tickFormatter={(v) => fmt(v)} tick={{ fontSize: 11, fill: isDark ? "#a1a1aa" : "#6b7280" }} width={60} />
        <Tooltip
          formatter={(v: number, name: string) => [fmt(v), PILARES.find((p) => p.key === name)?.label || name]}
          contentStyle={{ background: isDark ? "#18181b" : "#fff", border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`, borderRadius: 6, fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} formatter={(name) => PILARES.find((p) => p.key === name)?.label || name} />
        {PILARES.map((p, i) => (
          <Bar key={p.key} dataKey={p.key} stackId="a" fill={p.cor} radius={i === PILARES.length - 1 ? [3, 3, 0, 0] : undefined} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 3: Reescrever `client/src/pages/CentralCustos.tsx`**

```tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KpisCustos, type ResumoMes } from "@/components/custos/KpisCustos";
import { EvolucaoCustos } from "@/components/custos/EvolucaoCustos";

function ultimosMeses(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

export default function CentralCustos() {
  const meses = ultimosMeses(12);
  const [mes, setMes] = useState(meses[0]);
  const [moeda, setMoeda] = useState<"BRL" | "USD">("BRL");
  const [tab, setTab] = useState("assinaturas");

  const { data: evolucao = [], isLoading } = useQuery<ResumoMes[]>({
    queryKey: ["/api/custos/evolucao", { ate: mes }],
  });

  const atual = evolucao.find((r) => r.mes === mes) || evolucao[evolucao.length - 1];
  const idx = evolucao.findIndex((r) => r.mes === mes);
  const anterior = idx > 0 ? evolucao[idx - 1] : undefined;

  return (
    <div className="min-h-full bg-gray-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Central de Custos de IA</h1>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden">
              {(["BRL", "USD"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMoeda(m)}
                  data-testid={`toggle-moeda-${m}`}
                  className={`px-3 py-1.5 text-sm ${moeda === m ? "bg-violet-600 text-white" : "bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-400"}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger className="w-36" data-testid="select-mes"><SelectValue /></SelectTrigger>
              <SelectContent>
                {meses.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading || !atual ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            <KpisCustos atual={atual} anterior={anterior} moeda={moeda} />
            {atual.cambioEstimado && (
              <div className="text-xs text-amber-600 dark:text-amber-400">
                ⚠ Câmbio do mês estimado (usando a última taxa conhecida: {atual.taxa.toFixed(2)}).
              </div>
            )}
            <Card className="dark:bg-zinc-900 dark:border-zinc-800">
              <CardContent className="p-4">
                <div className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-3">Evolução mensal</div>
                <EvolucaoCustos dados={evolucao} moeda={moeda} />
              </CardContent>
            </Card>
          </>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="assinaturas" data-testid="tab-assinaturas">Assinaturas</TabsTrigger>
            <TabsTrigger value="ferramentas" data-testid="tab-ferramentas">Ferramentas</TabsTrigger>
            <TabsTrigger value="gcp" data-testid="tab-gcp">GCP</TabsTrigger>
            <TabsTrigger value="anthropic" data-testid="tab-anthropic">API Anthropic</TabsTrigger>
            <TabsTrigger value="synapse" data-testid="tab-synapse">Synapse</TabsTrigger>
          </TabsList>
          <TabsContent value="assinaturas"><div className="p-6 text-gray-500 dark:text-zinc-400">Em breve.</div></TabsContent>
          <TabsContent value="ferramentas"><div className="p-6 text-gray-500 dark:text-zinc-400">Em breve.</div></TabsContent>
          <TabsContent value="gcp"><div className="p-6 text-gray-500 dark:text-zinc-400">Em breve.</div></TabsContent>
          <TabsContent value="anthropic"><div className="p-6 text-gray-500 dark:text-zinc-400">Em breve.</div></TabsContent>
          <TabsContent value="synapse"><div className="p-6 text-gray-500 dark:text-zinc-400">Em breve.</div></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Validar tipos e commit**

Run: `npm run check`
Expected: sem erros de tipo.

```bash
git add client/src/pages/CentralCustos.tsx client/src/components/custos/KpisCustos.tsx client/src/components/custos/EvolucaoCustos.tsx
git commit -m "feat(custos): pagina com KPIs, toggle de moeda, seletor de mes e grafico de evolucao

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Aba Assinaturas (frontend CRUD + MultiSelect de pessoas do RH)

**Files:**
- Create: `client/src/components/custos/AbaAssinaturas.tsx` (tabela + dialog de criar/editar inline)
- Modify: `client/src/pages/CentralCustos.tsx` (trocar o placeholder da aba "assinaturas")

**Interfaces:**
- Consumes: `GET /api/custos/assinaturas`, `POST/PUT/DELETE /api/custos/assinaturas[/:id]`, `PUT /api/custos/assinaturas/:id/usuarios`, `GET /api/custos/pessoas`.
- Produces: `AbaAssinaturas({ moeda })`.

- [ ] **Step 1: Criar `client/src/components/custos/AbaAssinaturas.tsx`**

```tsx
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MultiSelect } from "@/components/ui/multi-select";
import { Pencil, Trash2, Plus } from "lucide-react";
import { formatCurrencyNoDecimals, formatCurrencyUSD } from "@/lib/utils";

interface Usuario { id: number; nome: string; }
interface Assinatura {
  id: number; fornecedor: string; plano: string; valor: number; moeda: string; ciclo: string;
  dataAssinatura: string; dataCancelamento: string | null; status: string;
  responsavelPessoaId: number | null; projeto: string; observacoes: string | null; usuarios: Usuario[];
}

const VAZIA = {
  fornecedor: "Anthropic", plano: "", valor: 0, moeda: "USD", ciclo: "mensal",
  dataAssinatura: new Date().toISOString().slice(0, 10), dataCancelamento: "", status: "ativo",
  responsavelPessoaId: "", projeto: "Geral", observacoes: "", usuarios: [] as number[],
};

export function AbaAssinaturas({ moeda }: { moeda: "BRL" | "USD" }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Assinatura | null>(null);
  const [form, setForm] = useState({ ...VAZIA });

  const { data: assinaturas = [], isLoading } = useQuery<Assinatura[]>({ queryKey: ["/api/custos/assinaturas"] });
  const { data: pessoas = [] } = useQuery<Usuario[]>({ queryKey: ["/api/custos/pessoas"] });
  const pessoaOptions = pessoas.map((p) => ({ value: String(p.id), label: p.nome }));

  useEffect(() => {
    if (editing) {
      setForm({
        fornecedor: editing.fornecedor, plano: editing.plano, valor: editing.valor, moeda: editing.moeda,
        ciclo: editing.ciclo, dataAssinatura: editing.dataAssinatura?.slice(0, 10),
        dataCancelamento: editing.dataCancelamento?.slice(0, 10) || "", status: editing.status,
        responsavelPessoaId: editing.responsavelPessoaId ? String(editing.responsavelPessoaId) : "",
        projeto: editing.projeto, observacoes: editing.observacoes || "",
        usuarios: (editing.usuarios || []).map((u) => u.id),
      });
    } else {
      setForm({ ...VAZIA });
    }
  }, [editing, open]);

  function payload() {
    return {
      fornecedor: form.fornecedor, plano: form.plano, valor: Number(form.valor), moeda: form.moeda,
      ciclo: form.ciclo, dataAssinatura: form.dataAssinatura, dataCancelamento: form.dataCancelamento || null,
      status: form.status, responsavelPessoaId: form.responsavelPessoaId ? Number(form.responsavelPessoaId) : null,
      projeto: form.projeto, observacoes: form.observacoes || null, usuarios: form.usuarios,
    };
  }

  const createMut = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/custos/assinaturas", payload()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custos/assinaturas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/custos/evolucao"] });
      toast({ title: "Assinatura criada" });
      setOpen(false);
    },
    onError: (e: any) => toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/custos/assinaturas/${editing!.id}`, payload());
      await apiRequest("PUT", `/api/custos/assinaturas/${editing!.id}/usuarios`, { usuarios: form.usuarios });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custos/assinaturas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/custos/evolucao"] });
      toast({ title: "Assinatura atualizada" });
      setOpen(false);
    },
    onError: (e: any) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/custos/assinaturas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custos/assinaturas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/custos/evolucao"] });
      toast({ title: "Assinatura removida" });
    },
    onError: (e: any) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });

  const fmt = (v: number, m: string) => (m === "BRL" ? formatCurrencyNoDecimals(v) : formatCurrencyUSD(v));
  const saving = createMut.isPending || updateMut.isPending;

  function handleSave() {
    if (!form.fornecedor.trim() || !form.plano.trim()) {
      toast({ title: "Preencha fornecedor e plano", variant: "destructive" });
      return;
    }
    editing ? updateMut.mutate() : createMut.mutate();
  }

  return (
    <div className="space-y-4 py-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setOpen(true); }} data-testid="button-add-assinatura">
          <Plus className="h-4 w-4 mr-1" /> Nova assinatura
        </Button>
      </div>

      {isLoading ? (
        <div className="text-gray-500 dark:text-zinc-400">Carregando…</div>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-zinc-800 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fornecedor</TableHead><TableHead>Plano</TableHead><TableHead>Valor</TableHead>
                <TableHead>Ciclo</TableHead><TableHead>Projeto</TableHead><TableHead>Usuários</TableHead>
                <TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assinaturas.map((a) => (
                <TableRow key={a.id} data-testid={`row-assinatura-${a.id}`}>
                  <TableCell className="font-medium">{a.fornecedor}</TableCell>
                  <TableCell>{a.plano}</TableCell>
                  <TableCell>{fmt(a.valor, a.moeda)}<span className="text-xs text-gray-400"> {a.moeda}</span></TableCell>
                  <TableCell>{a.ciclo}</TableCell>
                  <TableCell><Badge variant="secondary">{a.projeto}</Badge></TableCell>
                  <TableCell className="text-xs text-gray-500 dark:text-zinc-400">{(a.usuarios || []).map((u) => u.nome).join(", ") || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={a.status === "ativo" ? "default" : "outline"}>{a.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(a); setOpen(true); }} data-testid={`button-edit-assinatura-${a.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Remover "${a.plano}"?`)) deleteMut.mutate(a.id); }} data-testid={`button-delete-assinatura-${a.id}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {assinaturas.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-gray-500 dark:text-zinc-400 py-8">Nenhuma assinatura cadastrada.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar assinatura" : "Nova assinatura"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Fornecedor</Label><Input value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} data-testid="input-fornecedor" /></div>
            <div><Label>Plano</Label><Input value={form.plano} onChange={(e) => setForm({ ...form, plano: e.target.value })} data-testid="input-plano" /></div>
            <div><Label>Valor</Label><Input type="number" value={form.valor} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} data-testid="input-valor" /></div>
            <div>
              <Label>Moeda</Label>
              <Select value={form.moeda} onValueChange={(v) => setForm({ ...form, moeda: v })}>
                <SelectTrigger data-testid="select-moeda"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="BRL">BRL</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ciclo</Label>
              <Select value={form.ciclo} onValueChange={(v) => setForm({ ...form, ciclo: v })}>
                <SelectTrigger data-testid="select-ciclo"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="mensal">Mensal</SelectItem><SelectItem value="anual">Anual</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>Projeto</Label>
              <Select value={form.projeto} onValueChange={(v) => setForm({ ...form, projeto: v })}>
                <SelectTrigger data-testid="select-projeto"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Geral">Geral</SelectItem><SelectItem value="Synapse">Synapse</SelectItem><SelectItem value="Cortex">Cortex</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Data de assinatura</Label><Input type="date" value={form.dataAssinatura} onChange={(e) => setForm({ ...form, dataAssinatura: e.target.value })} data-testid="input-data-assinatura" /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="inativo">Inativo</SelectItem></SelectContent>
              </Select>
            </div>
            {form.status === "inativo" && (
              <div><Label>Data de cancelamento</Label><Input type="date" value={form.dataCancelamento} onChange={(e) => setForm({ ...form, dataCancelamento: e.target.value })} data-testid="input-data-cancelamento" /></div>
            )}
            <div>
              <Label>Responsável</Label>
              <Select value={form.responsavelPessoaId} onValueChange={(v) => setForm({ ...form, responsavelPessoaId: v })}>
                <SelectTrigger data-testid="select-responsavel"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{pessoas.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Quem está usando</Label>
              <MultiSelect
                options={pessoaOptions}
                selected={form.usuarios.map(String)}
                onChange={(vals) => setForm({ ...form, usuarios: vals.map(Number) })}
                placeholder="Selecione as pessoas"
              />
            </div>
            <div className="col-span-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} data-testid="input-observacoes" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="button-save-assinatura">{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Ligar a aba na página**

Em `client/src/pages/CentralCustos.tsx`, adicionar o import:
```tsx
import { AbaAssinaturas } from "@/components/custos/AbaAssinaturas";
```
e trocar o placeholder da aba assinaturas por:
```tsx
<TabsContent value="assinaturas"><AbaAssinaturas moeda={moeda} /></TabsContent>
```

- [ ] **Step 3: Validar tipos e commit**

Run: `npm run check`
Expected: sem erros de tipo.

```bash
git add client/src/components/custos/AbaAssinaturas.tsx client/src/pages/CentralCustos.tsx
git commit -m "feat(custos): aba de assinaturas com CRUD e vinculo de pessoas do RH

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Aba Ferramentas / Itens manuais (frontend CRUD)

**Files:**
- Create: `client/src/components/custos/AbaItens.tsx`
- Modify: `client/src/pages/CentralCustos.tsx` (trocar placeholder da aba "ferramentas")

**Interfaces:**
- Consumes: `GET/POST/PUT/DELETE /api/custos/itens[/:id]`.
- Produces: `AbaItens({ moeda })`.

- [ ] **Step 1: Criar `client/src/components/custos/AbaItens.tsx`**

```tsx
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus } from "lucide-react";
import { formatCurrencyNoDecimals, formatCurrencyUSD } from "@/lib/utils";

interface Item {
  id: number; descricao: string; fornecedor: string | null; categoria: string | null; valor: number;
  moeda: string; ciclo: string; dataInicio: string; dataFim: string | null; status: string;
  projeto: string; observacoes: string | null;
}

const VAZIO = {
  descricao: "", fornecedor: "", categoria: "SaaS", valor: 0, moeda: "USD", ciclo: "mensal",
  dataInicio: new Date().toISOString().slice(0, 10), dataFim: "", status: "ativo", projeto: "Synapse", observacoes: "",
};

export function AbaItens({ moeda }: { moeda: "BRL" | "USD" }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState({ ...VAZIO });

  const { data: itens = [], isLoading } = useQuery<Item[]>({ queryKey: ["/api/custos/itens"] });

  useEffect(() => {
    if (editing) {
      setForm({
        descricao: editing.descricao, fornecedor: editing.fornecedor || "", categoria: editing.categoria || "SaaS",
        valor: editing.valor, moeda: editing.moeda, ciclo: editing.ciclo, dataInicio: editing.dataInicio?.slice(0, 10),
        dataFim: editing.dataFim?.slice(0, 10) || "", status: editing.status, projeto: editing.projeto, observacoes: editing.observacoes || "",
      });
    } else setForm({ ...VAZIO });
  }, [editing, open]);

  function payload() {
    return {
      descricao: form.descricao, fornecedor: form.fornecedor || null, categoria: form.categoria || null,
      valor: Number(form.valor), moeda: form.moeda, ciclo: form.ciclo, dataInicio: form.dataInicio,
      dataFim: form.dataFim || null, status: form.status, projeto: form.projeto, observacoes: form.observacoes || null,
    };
  }

  const inval = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/custos/itens"] });
    queryClient.invalidateQueries({ queryKey: ["/api/custos/evolucao"] });
  };
  const createMut = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/custos/itens", payload()),
    onSuccess: () => { inval(); toast({ title: "Item criado" }); setOpen(false); },
    onError: (e: any) => toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }),
  });
  const updateMut = useMutation({
    mutationFn: async () => apiRequest("PUT", `/api/custos/itens/${editing!.id}`, payload()),
    onSuccess: () => { inval(); toast({ title: "Item atualizado" }); setOpen(false); },
    onError: (e: any) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });
  const deleteMut = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/custos/itens/${id}`),
    onSuccess: () => { inval(); toast({ title: "Item removido" }); },
    onError: (e: any) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });

  const fmt = (v: number, m: string) => (m === "BRL" ? formatCurrencyNoDecimals(v) : formatCurrencyUSD(v));
  const saving = createMut.isPending || updateMut.isPending;

  function handleSave() {
    if (!form.descricao.trim()) { toast({ title: "Preencha a descrição", variant: "destructive" }); return; }
    editing ? updateMut.mutate() : createMut.mutate();
  }

  return (
    <div className="space-y-4 py-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setOpen(true); }} data-testid="button-add-item">
          <Plus className="h-4 w-4 mr-1" /> Novo item
        </Button>
      </div>
      {isLoading ? (
        <div className="text-gray-500 dark:text-zinc-400">Carregando…</div>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-zinc-800 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Valor</TableHead>
                <TableHead>Ciclo</TableHead><TableHead>Projeto</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((it) => (
                <TableRow key={it.id} data-testid={`row-item-${it.id}`}>
                  <TableCell className="font-medium">{it.descricao}</TableCell>
                  <TableCell>{it.categoria || "—"}</TableCell>
                  <TableCell>{fmt(it.valor, it.moeda)}<span className="text-xs text-gray-400"> {it.moeda}</span></TableCell>
                  <TableCell>{it.ciclo}</TableCell>
                  <TableCell><Badge variant="secondary">{it.projeto}</Badge></TableCell>
                  <TableCell><Badge variant={it.status === "ativo" ? "default" : "outline"}>{it.status}</Badge></TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(it); setOpen(true); }} data-testid={`button-edit-item-${it.id}`}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Remover "${it.descricao}"?`)) deleteMut.mutate(it.id); }} data-testid={`button-delete-item-${it.id}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {itens.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-gray-500 dark:text-zinc-400 py-8">Nenhum item cadastrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar item" : "Novo item"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Descrição</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} data-testid="input-item-descricao" /></div>
            <div><Label>Fornecedor</Label><Input value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} data-testid="input-item-fornecedor" /></div>
            <div><Label>Categoria</Label><Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} data-testid="input-item-categoria" /></div>
            <div><Label>Valor</Label><Input type="number" value={form.valor} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} data-testid="input-item-valor" /></div>
            <div>
              <Label>Moeda</Label>
              <Select value={form.moeda} onValueChange={(v) => setForm({ ...form, moeda: v })}>
                <SelectTrigger data-testid="select-item-moeda"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="BRL">BRL</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ciclo</Label>
              <Select value={form.ciclo} onValueChange={(v) => setForm({ ...form, ciclo: v })}>
                <SelectTrigger data-testid="select-item-ciclo"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="mensal">Mensal</SelectItem><SelectItem value="anual">Anual</SelectItem><SelectItem value="pontual">Pontual</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>Projeto</Label>
              <Select value={form.projeto} onValueChange={(v) => setForm({ ...form, projeto: v })}>
                <SelectTrigger data-testid="select-item-projeto"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Geral">Geral</SelectItem><SelectItem value="Synapse">Synapse</SelectItem><SelectItem value="Cortex">Cortex</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Início</Label><Input type="date" value={form.dataInicio} onChange={(e) => setForm({ ...form, dataInicio: e.target.value })} data-testid="input-item-inicio" /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger data-testid="select-item-status"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="inativo">Inativo</SelectItem></SelectContent>
              </Select>
            </div>
            {form.status === "inativo" && (
              <div><Label>Fim</Label><Input type="date" value={form.dataFim} onChange={(e) => setForm({ ...form, dataFim: e.target.value })} data-testid="input-item-fim" /></div>
            )}
            <div className="col-span-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} data-testid="input-item-observacoes" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="button-save-item">{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Ligar a aba na página**

Em `client/src/pages/CentralCustos.tsx`, adicionar `import { AbaItens } from "@/components/custos/AbaItens";` e trocar o placeholder por:
```tsx
<TabsContent value="ferramentas"><AbaItens moeda={moeda} /></TabsContent>
```

- [ ] **Step 3: Validar tipos e commit**

Run: `npm run check`
Expected: sem erros de tipo.

```bash
git add client/src/components/custos/AbaItens.tsx client/src/pages/CentralCustos.tsx
git commit -m "feat(custos): aba de ferramentas/itens manuais com CRUD

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Abas GCP, Anthropic e Synapse (frontend leitura + sync)

**Files:**
- Create: `client/src/components/custos/AbaGcp.tsx`
- Create: `client/src/components/custos/AbaAnthropic.tsx`
- Create: `client/src/components/custos/AbaSynapse.tsx`
- Modify: `client/src/pages/CentralCustos.tsx` (trocar os 3 placeholders; passar `mes`)

**Interfaces:**
- Consumes: `GET /api/custos/gcp?mes=`, `POST /api/custos/gcp/sync`, `GET /api/custos/anthropic?mes=`, `POST /api/custos/anthropic/sync`, `GET /api/custos/consolidado?mes=`.
- Produces: `AbaGcp({ mes, moeda })`, `AbaAnthropic({ mes, moeda })`, `AbaSynapse({ mes, moeda })`.

- [ ] **Step 1: Criar `client/src/components/custos/AbaGcp.tsx`**

```tsx
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { formatCurrencyNoDecimals } from "@/lib/utils";

interface LinhaGcp { gcpProjectId: string; projetoInterno: string; servico: string; custo: number; moeda: string; }

export function AbaGcp({ mes }: { mes: string; moeda: "BRL" | "USD" }) {
  const { toast } = useToast();
  const { data: linhas = [], isLoading } = useQuery<LinhaGcp[]>({ queryKey: ["/api/custos/gcp", { mes }] });

  const syncMut = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/custos/gcp/sync", {}),
    onSuccess: async (res) => {
      const j = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/custos/gcp"] });
      queryClient.invalidateQueries({ queryKey: ["/api/custos/evolucao"] });
      toast({ title: "Sync GCP concluído", description: `${j.linhas ?? 0} linhas desde ${j.desde ?? ""}` });
    },
    onError: (e: any) => toast({ title: "Erro no sync GCP", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4 py-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => syncMut.mutate()} disabled={syncMut.isPending} data-testid="button-sync-gcp">
          <RefreshCw className={`h-4 w-4 mr-1 ${syncMut.isPending ? "animate-spin" : ""}`} /> Sincronizar agora
        </Button>
      </div>
      {isLoading ? (
        <div className="text-gray-500 dark:text-zinc-400">Carregando…</div>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-zinc-800 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Projeto GCP</TableHead><TableHead>Interno</TableHead><TableHead>Serviço</TableHead><TableHead className="text-right">Custo</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l, i) => (
                <TableRow key={i} data-testid={`row-gcp-${i}`}>
                  <TableCell className="font-mono text-xs">{l.gcpProjectId}</TableCell>
                  <TableCell><Badge variant={l.projetoInterno === "Synapse" ? "default" : "secondary"}>{l.projetoInterno}</Badge></TableCell>
                  <TableCell>{l.servico}</TableCell>
                  <TableCell className="text-right">{formatCurrencyNoDecimals(l.custo)}<span className="text-xs text-gray-400"> {l.moeda}</span></TableCell>
                </TableRow>
              ))}
              {linhas.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-gray-500 dark:text-zinc-400 py-8">Sem dados de GCP no mês. Configure o BigQuery export e clique em sincronizar.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Criar `client/src/components/custos/AbaAnthropic.tsx`**

```tsx
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { formatCurrencyUSD } from "@/lib/utils";

interface LinhaAnthropic { workspace: string; projetoInterno: string; custoUsd: number; tokensInput: number; tokensOutput: number; }

export function AbaAnthropic({ mes }: { mes: string; moeda: "BRL" | "USD" }) {
  const { toast } = useToast();
  const { data: linhas = [], isLoading } = useQuery<LinhaAnthropic[]>({ queryKey: ["/api/custos/anthropic", { mes }] });

  const syncMut = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/custos/anthropic/sync", {}),
    onSuccess: async (res) => {
      const j = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/custos/anthropic"] });
      queryClient.invalidateQueries({ queryKey: ["/api/custos/evolucao"] });
      toast({ title: "Sync Anthropic concluído", description: `${j.dias ?? 0} dias desde ${j.desde ?? ""}` });
    },
    onError: (e: any) => toast({ title: "Erro no sync Anthropic", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4 py-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => syncMut.mutate()} disabled={syncMut.isPending} data-testid="button-sync-anthropic">
          <RefreshCw className={`h-4 w-4 mr-1 ${syncMut.isPending ? "animate-spin" : ""}`} /> Sincronizar agora
        </Button>
      </div>
      {isLoading ? (
        <div className="text-gray-500 dark:text-zinc-400">Carregando…</div>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-zinc-800 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Workspace</TableHead><TableHead>Interno</TableHead><TableHead className="text-right">Custo (USD)</TableHead><TableHead className="text-right">Tokens in/out</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l, i) => (
                <TableRow key={i} data-testid={`row-anthropic-${i}`}>
                  <TableCell className="font-mono text-xs">{l.workspace || "—"}</TableCell>
                  <TableCell><Badge variant={l.projetoInterno === "Synapse" ? "default" : "secondary"}>{l.projetoInterno}</Badge></TableCell>
                  <TableCell className="text-right">{formatCurrencyUSD(l.custoUsd)}</TableCell>
                  <TableCell className="text-right text-xs text-gray-500 dark:text-zinc-400">{l.tokensInput.toLocaleString()} / {l.tokensOutput.toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {linhas.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-gray-500 dark:text-zinc-400 py-8">Sem dados da API no mês. Configure a ANTHROPIC_ADMIN_KEY e clique em sincronizar.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Criar `client/src/components/custos/AbaSynapse.tsx`**

```tsx
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrencyNoDecimals, formatCurrencyUSD } from "@/lib/utils";
import type { ResumoMes } from "./KpisCustos";

const PILAR_LABEL: Record<string, string> = { assinaturas: "Assinaturas", anthropic: "API Anthropic", gcp: "GCP", ferramentas: "Ferramentas" };

export function AbaSynapse({ mes, moeda }: { mes: string; moeda: "BRL" | "USD" }) {
  const { data } = useQuery<ResumoMes & { linhas: any[] }>({ queryKey: ["/api/custos/consolidado", { mes }] });
  const linhas = (data?.linhas || []).filter((l: any) => l.projeto === "Synapse");
  const totalBRL = linhas.reduce((s: number, l: any) => s + l.valorBRL, 0);
  const totalUSD = linhas.reduce((s: number, l: any) => s + l.valorUSD, 0);
  const total = moeda === "BRL" ? formatCurrencyNoDecimals(totalBRL) : formatCurrencyUSD(totalUSD);

  const porPilar: Record<string, { brl: number; usd: number }> = {};
  for (const l of linhas) {
    porPilar[l.pilar] = porPilar[l.pilar] || { brl: 0, usd: 0 };
    porPilar[l.pilar].brl += l.valorBRL;
    porPilar[l.pilar].usd += l.valorUSD;
  }

  return (
    <div className="space-y-4 py-4">
      <Card className="border-violet-300 dark:border-violet-800 dark:bg-zinc-900">
        <CardContent className="p-4">
          <div className="text-sm text-violet-600 dark:text-violet-400">Custo total do Synapse — {mes}</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{total}</div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(porPilar).map(([pilar, v]) => (
          <Card key={pilar} className="dark:bg-zinc-900 dark:border-zinc-800" data-testid={`synapse-pilar-${pilar}`}>
            <CardContent className="p-4">
              <div className="text-xs text-gray-500 dark:text-zinc-400">{PILAR_LABEL[pilar] || pilar}</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {moeda === "BRL" ? formatCurrencyNoDecimals(v.brl) : formatCurrencyUSD(v.usd)}
              </div>
            </CardContent>
          </Card>
        ))}
        {linhas.length === 0 && <div className="col-span-4 text-center text-gray-500 dark:text-zinc-400 py-8">Nada marcado como Synapse neste mês. Marque assinaturas/itens com projeto "Synapse" ou mapeie um projeto GCP.</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Ligar as 3 abas na página**

Em `client/src/pages/CentralCustos.tsx`, adicionar os imports e trocar os placeholders (passando `mes`):
```tsx
import { AbaGcp } from "@/components/custos/AbaGcp";
import { AbaAnthropic } from "@/components/custos/AbaAnthropic";
import { AbaSynapse } from "@/components/custos/AbaSynapse";
```
```tsx
<TabsContent value="gcp"><AbaGcp mes={mes} moeda={moeda} /></TabsContent>
<TabsContent value="anthropic"><AbaAnthropic mes={mes} moeda={moeda} /></TabsContent>
<TabsContent value="synapse"><AbaSynapse mes={mes} moeda={moeda} /></TabsContent>
```

- [ ] **Step 5: Validar tipos e commit**

Run: `npm run check`
Expected: sem erros de tipo.

```bash
git add client/src/components/custos/AbaGcp.tsx client/src/components/custos/AbaAnthropic.tsx client/src/components/custos/AbaSynapse.tsx client/src/pages/CentralCustos.tsx
git commit -m "feat(custos): abas GCP, Anthropic e Synapse (leitura + sync manual)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Aplicar schema em produção + verificação final

**Files:** nenhum novo. Verificação e deploy da migration.

- [ ] **Step 1: Documentar as env vars novas em `.env.example`**

Adicionar ao `.env.example` (com comentário, sem valores reais):
```
# Central de Custos de IA
ANTHROPIC_ADMIN_KEY=            # Admin API key da Anthropic (sk-ant-admin...) para o Cost Report
GCP_BILLING_BQ_TABLE=           # tabela do billing export: projeto.dataset.gcp_billing_export_v1_XXXX
```
Commit:
```bash
git add .env.example
git commit -m "docs(custos): documenta env vars ANTHROPIC_ADMIN_KEY e GCP_BILLING_BQ_TABLE

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 2: Rodar a suíte de testes e o typecheck completos**

Run: `npm run test -- custos-calc`
Expected: PASS.

Run: `npm run check`
Expected: sem erros de tipo em todo o projeto.

- [ ] **Step 3: Aplicar a migration em PRODUÇÃO**

Aponte as env vars de banco para o Cloud SQL de produção (host `34.95.249.110`, base `dados_turbo`) — via um `.env.prod` ou variáveis inline — e rode o runner. **Confirme que está mirando prod antes de rodar.**

Run: `npx tsx --env-file=.env.prod scripts/apply-custos-migration.ts`
Expected: imprime "ok" e a tabela com as 7 tabelas `custo_*` criadas em prod.

(A migration é idempotente — `CREATE TABLE IF NOT EXISTS` — segura para reexecução.)

- [ ] **Step 4: Checklist de verificação humana (operador, no dev server)**

Este passo é do operador humano (subagentes não sobem o dev server):
- Abrir `/central-custos` logado como admin; conferir que aparece no menu **Admin**.
- Criar uma assinatura Claude com 2+ usuários do RH; confirmar que aparece na tabela e no KPI "Assinaturas".
- Criar um item de ferramenta com projeto "Synapse"; confirmar que entra na aba Synapse e no KPI Synapse.
- Alternar o toggle **BRL/USD** e conferir que KPIs e gráfico mudam.
- Verificar **dark mode e light mode** na tela inteira.
- Se as credenciais já estiverem setadas: clicar "Sincronizar agora" em GCP e Anthropic e conferir os dados.
- Ajustar o override de câmbio via `PUT /api/custos/cambio/2026-07` se a taxa automática destoar da fatura real.

- [ ] **Step 5: Liberar acesso e finalizar**

- Liberar a rota `/central-custos` para os usuários não-admin desejados (CEO/financeiro) via `/admin/usuarios` (`allowed_routes`).
- Atualizar o vault Obsidian e o chamado no Cortex conforme o workflow pós-conclusão do projeto (memória do projeto).

```bash
git push origin main
```

---

## Self-Review (executado pelo autor do plano)

**Cobertura do spec:**
- Assinaturas Claude (responsável, plano, valor, data, status, quem usa) → Tasks 1, 5, 12. ✓
- API Anthropic (custo automático) → Tasks 8, 14. ✓
- Infra GCP (BigQuery export automático) → Tasks 7, 14. ✓
- Synapse como dimensão → Tasks 1 (coluna `projeto`/mapa), 4 (consolidação por projeto), 14 (aba). ✓
- USD original + BRL convertido → Tasks 2 (`converter`), 3 (câmbio), 10 (`formatCurrencyUSD`), 11 (toggle). ✓
- Câmbio auto + override → Task 3, endpoints Task 4, job Task 9. ✓
- Evolução mês a mês → Tasks 4 (`evolucao`), 11 (gráfico). ✓
- Consolidação testada → Task 2 (vitest). ✓
- Menu Admin + permissão → Task 10. ✓
- Aplicar em prod → Task 15. ✓

**Consistência de tipos:** `ResumoMes` é definido no backend (Task 4) e redeclarado no frontend em `KpisCustos.tsx` (Task 11), reusado por `EvolucaoCustos`/`AbaSynapse` via `import type`. `LinhaCusto`/`converter`/`custoMensalRecorrente`/`agruparPor` definidos na Task 2 e consumidos na Task 4 com as mesmas assinaturas. Endpoints produzidos nas Tasks 4-8 batem com os consumidos nas Tasks 11-14.

**Nota de simplificação:** os modais de criar/editar foram consolidados dentro de `AbaAssinaturas.tsx` e `AbaItens.tsx` (dialog inline) em vez de arquivos `DialogAssinatura.tsx`/`DialogItem.tsx` separados — menos superfície, mesma responsabilidade.

**Aproximação conhecida (documentada, não é placeholder):** quando o usuário vê subtotais por pilar em USD, o valor é derivado proporcionalmente do total (o backend entrega `porPilar` só em BRL). Os totais principais (BRL e USD) e a aba Anthropic (USD nativo) são exatos. Se precisão de USD por pilar virar requisito, o backend pode passar a devolver `porPilarUSD` — fora do escopo atual.
