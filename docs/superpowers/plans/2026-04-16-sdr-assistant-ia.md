# SDR Assistant IA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar V1 do SDR Assistant — um chat interno em `/sdr-assistant` que consulta histórico de empresas no Bitrix via LLM (Claude Sonnet 4.6) com tool-use, retornando timeline de deals em segundos.

**Architecture:** Backend Express + Drizzle-orm chama Anthropic SDK em loop tool-use com 2 tools SQL contra `"Bitrix".crm_deal`. Frontend React+Wouter renderiza chat markdown com dark mode. Stateless: histórico da conversa vem no body a cada request.

**Tech Stack:** Node/Express + TypeScript, Drizzle-orm, `@anthropic-ai/sdk` v0.78.0, React 18, Wouter, Tailwind, `react-markdown`, Vitest.

**Spec de referência:** `docs/superpowers/specs/2026-04-16-sdr-assistant-ia-design.md`

---

## File Structure

### Novos

- `server/routes/sdr-assistant.ts` — export `registerSdrAssistantRoutes(app, db)` com rota `POST /api/sdr-assistant/chat`, 2 tools (`searchCompanies`, `getCompanyTimeline`), classificação de status
- `server/routes/sdr-assistant.test.ts` — testes Vitest das tools + classificação
- `server/migrations/2026-04-16-sdr-assistant-usage.sql` — cria `cortex_core.sdr_assistant_usage`
- `client/src/pages/SdrAssistant.tsx` — página chat completa (input + mensagens + loading + markdown)

### Modificados

- `server/routes.ts` — registrar `registerSdrAssistantRoutes(app, db)`
- `client/src/App.tsx` — registrar rota `/sdr-assistant`
- `client/src/components/app-sidebar.tsx` — link no menu "Comercial"

---

## Task 1: Validar schema real de `"Bitrix".crm_deal`

Antes de escrever qualquer query, confirmar os nomes exatos das colunas. Spec assume `data_criacao`, `assigned_by_id`, etc — mas podem ser `date_create`, `responsavel_id` etc.

**Files:**
- Leitura apenas (nenhum arquivo criado/modificado nesta task)

- [ ] **Step 1: Conectar ao banco de dev e listar colunas**

Run:
```bash
psql "$DEV_DATABASE_URL" -c "\d \"Bitrix\".crm_deal" | head -60
```

Expected: lista de ~48 colunas. Anotar os nomes exatos de:
- ID do responsável (candidatos: `assigned_by_id`, `responsavel_id`, `assigned_by`)
- ID do closer (candidatos: `closer_id`, `id_closer`)
- Data de criação (`data_criacao` vs `date_create`)
- Data de fechamento (`data_fechamento` vs `date_modify` vs `closed_at`)
- Campo de comentários (`comments`, `observacoes`, `comentarios`)
- Nome da empresa (`company_name`, `company`, `empresa`)

- [ ] **Step 2: Confirmar `crm_users` e `crm_closers`**

Run:
```bash
psql "$DEV_DATABASE_URL" -c "\d \"Bitrix\".crm_users"
psql "$DEV_DATABASE_URL" -c "\d \"Bitrix\".crm_closers"
```

Expected: ambas têm `id` e `nome` (ou `name`). Anotar nome real da coluna.

- [ ] **Step 3: Amostrar 3 linhas de `crm_deal` com JOINs**

Run:
```bash
psql "$DEV_DATABASE_URL" -c "
  SELECT d.id, d.company_name, d.stage_name, d.title
  FROM \"Bitrix\".crm_deal d
  LIMIT 3;
"
```

Expected: 3 linhas com dados. Confirmar que `company_name` tem valor preenchido (se for vazio, usar `title` como fallback nas queries).

- [ ] **Step 4: Documentar o mapa real em variáveis locais**

Criar um rascunho mental (não commita ainda) com os nomes reais. Estas duas variáveis ficarão na Task 5:

```ts
// Nomes reais das colunas (preencher após Step 1):
// Exemplo hipotético — SUBSTITUA pelos valores reais da query:
const COL_RESPONSAVEL_ID  = "assigned_by_id";   // ← confirmar
const COL_CLOSER_ID       = "closer_id";        // ← confirmar
const COL_DATA_CRIACAO    = "data_criacao";     // ← confirmar
const COL_DATA_FECHAMENTO = "data_fechamento";  // ← confirmar
const COL_COMMENTS        = "comments";         // ← confirmar
```

- [ ] **Step 5: Nenhum commit nesta task** — é só investigação. Siga pra Task 2 com os nomes corretos na cabeça.

---

## Task 2: Migration — criar `cortex_core.sdr_assistant_usage`

**Files:**
- Create: `server/migrations/2026-04-16-sdr-assistant-usage.sql`

- [ ] **Step 1: Criar o arquivo de migration**

Conteúdo completo de `server/migrations/2026-04-16-sdr-assistant-usage.sql`:

```sql
CREATE TABLE IF NOT EXISTS cortex_core.sdr_assistant_usage (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER,
  query           TEXT,
  matched_company TEXT,
  tool_calls      INTEGER,
  tokens_total    INTEGER,
  duration_ms     INTEGER,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sdr_usage_user_date
  ON cortex_core.sdr_assistant_usage (user_id, created_at DESC);
```

- [ ] **Step 2: Aplicar em dev**

Run:
```bash
psql "$DEV_DATABASE_URL" -f server/migrations/2026-04-16-sdr-assistant-usage.sql
```

Expected: `CREATE TABLE` e `CREATE INDEX` sem erro.

- [ ] **Step 3: Aplicar em prod**

(Seguindo regra de `feedback_db_prod_sync.md`: schema sempre espelhado.)

Run:
```bash
psql "$PROD_DATABASE_URL" -f server/migrations/2026-04-16-sdr-assistant-usage.sql
```

Expected: `CREATE TABLE` e `CREATE INDEX` sem erro.

- [ ] **Step 4: Verificar estrutura em ambos**

Run:
```bash
psql "$DEV_DATABASE_URL"  -c "\d cortex_core.sdr_assistant_usage"
psql "$PROD_DATABASE_URL" -c "\d cortex_core.sdr_assistant_usage"
```

Expected: tabela com 8 colunas + índice `idx_sdr_usage_user_date` em ambos ambientes.

- [ ] **Step 5: Commit**

```bash
git add server/migrations/2026-04-16-sdr-assistant-usage.sql
git commit -m "feat(sdr-assistant): migration tabela de log de uso"
```

---

## Task 3: Backend — skeleton da rota + registro

Criar a rota mínima que responde 200 OK, sem lógica de LLM ainda. Protegida por auth.

**Files:**
- Create: `server/routes/sdr-assistant.ts`
- Modify: `server/routes.ts` (adicionar import + registrar)

- [ ] **Step 1: Criar skeleton de `server/routes/sdr-assistant.ts`**

Conteúdo completo:

```ts
import type { Express, Request, Response } from "express";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { isAuthenticated } from "../auth/middleware";

function requireInternalCollaborator(req: Request, res: Response, next: Function) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: "not authenticated" });
  }
  const allowedDepartments = ["admin", "comercial"];
  if (!allowedDepartments.includes(user.department)) {
    return res.status(403).json({ error: "forbidden — internal collaborators only" });
  }
  next();
}

export function registerSdrAssistantRoutes(app: Express, db: NodePgDatabase<any>) {
  app.post(
    "/api/sdr-assistant/chat",
    isAuthenticated,
    requireInternalCollaborator,
    async (req: Request, res: Response) => {
      return res.json({ response: "skeleton ok", tool_calls: [], usage: null });
    }
  );
}
```

> **Nota:** Se `department` no schema real de user tiver outros nomes (ex: `marketing`, `financeiro`), a allowlist `["admin", "comercial"]` cobre apenas comercial. Ajuste aqui se o time decidir ampliar o acesso.

- [ ] **Step 2: Registrar a rota em `server/routes.ts`**

Edit em `server/routes.ts`:

Procurar a seção onde outras rotas são registradas (linhas ~40-80 têm vários `registerXxxRoutes`). Adicionar, em ordem alfabética:

```ts
import { registerSdrAssistantRoutes } from "./routes/sdr-assistant";
```

E mais abaixo, onde as rotas são chamadas:

```ts
registerSdrAssistantRoutes(app, db);
```

- [ ] **Step 3: Reiniciar dev server e testar**

Run:
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
sleep 3
```

Então:
```bash
curl -sS -X POST http://localhost:3000/api/sdr-assistant/chat
```

Expected: `{"error":"not authenticated"}` com status 401 (pois não estamos logados).

- [ ] **Step 4: Teste manual com cookie de sessão**

Logar via browser em `http://localhost:3000`. Abrir DevTools → Network → copiar cookie `connect.sid` ou similar.

Run (substituindo `<COOKIE>`):
```bash
curl -sS -X POST http://localhost:3000/api/sdr-assistant/chat \
  -H "Cookie: connect.sid=<COOKIE>"
```

Expected (se logado como colaborador): `{"response":"skeleton ok","tool_calls":[],"usage":null}`

- [ ] **Step 5: Commit**

```bash
git add server/routes/sdr-assistant.ts server/routes.ts
git commit -m "feat(sdr-assistant): skeleton da rota com auth + guard interno"
```

---

## Task 4: Classificação de status — função pura + testes

Função pura `classifyDealStatus(stage_name)` retorna `"ativo" | "ganho" | "perdido"`. Fazemos TDD.

**Files:**
- Modify: `server/routes/sdr-assistant.ts`
- Create: `server/routes/sdr-assistant.test.ts`

- [ ] **Step 1: Criar o arquivo de teste com teste falhando**

Conteúdo completo de `server/routes/sdr-assistant.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { classifyDealStatus } from "./sdr-assistant";

describe("classifyDealStatus", () => {
  it("retorna 'perdido' quando stage contém 'Perdido'", () => {
    expect(classifyDealStatus("Negócio Perdido")).toBe("perdido");
    expect(classifyDealStatus("Perdido - sem interesse")).toBe("perdido");
  });

  it("retorna 'perdido' quando stage contém 'LOSE'", () => {
    expect(classifyDealStatus("LOSE")).toBe("perdido");
    expect(classifyDealStatus("C1:LOSE")).toBe("perdido");
  });

  it("retorna 'ganho' quando stage contém 'Ganho' ou 'WON'", () => {
    expect(classifyDealStatus("Negócio Ganho")).toBe("ganho");
    expect(classifyDealStatus("WON")).toBe("ganho");
    expect(classifyDealStatus("C1:WON")).toBe("ganho");
  });

  it("retorna 'ativo' em qualquer outro caso", () => {
    expect(classifyDealStatus("Proposta enviada")).toBe("ativo");
    expect(classifyDealStatus("Contactado")).toBe("ativo");
    expect(classifyDealStatus("")).toBe("ativo");
  });

  it("é case-insensitive", () => {
    expect(classifyDealStatus("negócio perdido")).toBe("perdido");
    expect(classifyDealStatus("lose")).toBe("perdido");
    expect(classifyDealStatus("negócio ganho")).toBe("ganho");
  });
});
```

- [ ] **Step 2: Rodar o teste e verificar falha**

Run:
```bash
npm test -- server/routes/sdr-assistant.test.ts
```

Expected: falha com "classifyDealStatus is not defined" (ou similar).

- [ ] **Step 3: Implementar a função em `server/routes/sdr-assistant.ts`**

Adicionar no topo do arquivo (antes de `registerSdrAssistantRoutes`):

```ts
export type DealStatus = "ativo" | "ganho" | "perdido";

export function classifyDealStatus(stageName: string): DealStatus {
  const s = (stageName || "").toLowerCase();
  if (s.includes("perdido") || s.includes("lose")) return "perdido";
  if (s.includes("ganho")   || s.includes("won"))  return "ganho";
  return "ativo";
}
```

- [ ] **Step 4: Rodar o teste e verificar que passa**

Run:
```bash
npm test -- server/routes/sdr-assistant.test.ts
```

Expected: 5 testes passando.

- [ ] **Step 5: Commit**

```bash
git add server/routes/sdr-assistant.ts server/routes/sdr-assistant.test.ts
git commit -m "feat(sdr-assistant): classificação de status ativo/ganho/perdido + testes"
```

---

## Task 5: Tool `searchCompanies` — SQL + testes

**Files:**
- Modify: `server/routes/sdr-assistant.ts`
- Modify: `server/routes/sdr-assistant.test.ts`

> **IMPORTANTE:** Use os nomes de colunas **reais** confirmados na Task 1. Os exemplos abaixo assumem os nomes da spec; substitua se divergirem.

- [ ] **Step 1: Adicionar testes para `searchCompanies`**

Adicionar ao fim de `server/routes/sdr-assistant.test.ts`:

```ts
import { searchCompanies } from "./sdr-assistant";

describe("searchCompanies", () => {
  const mockDb = {
    execute: vi.fn(),
  } as any;

  beforeEach(() => {
    mockDb.execute.mockReset();
  });

  it("rejeita query com menos de 3 caracteres", async () => {
    await expect(searchCompanies(mockDb, "ab")).rejects.toThrow(/3 caracteres/);
    expect(mockDb.execute).not.toHaveBeenCalled();
  });

  it("rejeita query vazia ou só espaços", async () => {
    await expect(searchCompanies(mockDb, "")).rejects.toThrow(/3 caracteres/);
    await expect(searchCompanies(mockDb, "   ")).rejects.toThrow(/3 caracteres/);
  });

  it("retorna lista vazia quando não há matches", async () => {
    mockDb.execute.mockResolvedValueOnce({ rows: [] });
    const result = await searchCompanies(mockDb, "EmpresaInexistente");
    expect(result).toEqual([]);
  });

  it("retorna lista de matches com deal_count e last_stage", async () => {
    mockDb.execute.mockResolvedValueOnce({
      rows: [
        { company_name: "Padaria Delícia", deal_count: 3, last_deal_id: 99, last_stage: "Proposta enviada" },
        { company_name: "Padaria Boa",     deal_count: 1, last_deal_id: 50, last_stage: "Negócio Perdido" },
      ],
    });
    const result = await searchCompanies(mockDb, "Padaria");
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      company_name: "Padaria Delícia",
      deal_count: 3,
      last_stage: "Proposta enviada",
    });
  });

  it("limita a 10 resultados (via SQL LIMIT)", async () => {
    mockDb.execute.mockResolvedValueOnce({
      rows: Array.from({ length: 10 }, (_, i) => ({
        company_name: `Empresa ${i}`, deal_count: 1, last_deal_id: i, last_stage: "Novo",
      })),
    });
    const result = await searchCompanies(mockDb, "Empresa");
    expect(result).toHaveLength(10);
  });
});
```

> **Nota:** Adicione `import { vi, beforeEach } from "vitest";` no topo do arquivo de teste, se ainda não estiver lá.

- [ ] **Step 2: Rodar testes e verificar falha**

Run:
```bash
npm test -- server/routes/sdr-assistant.test.ts
```

Expected: falhas com "searchCompanies is not defined".

- [ ] **Step 3: Implementar `searchCompanies` em `server/routes/sdr-assistant.ts`**

Primeiro, adicionar ao TOPO do arquivo (junto com os outros imports já existentes da Task 3):

```ts
import { sql } from "drizzle-orm";
```

Depois, adicionar após a função `classifyDealStatus`:

```ts
export interface CompanyMatch {
  company_name: string;
  deal_count: number;
  last_deal_id: number;
  last_stage: string;
}

export async function searchCompanies(
  db: NodePgDatabase<any>,
  query: string
): Promise<CompanyMatch[]> {
  const trimmed = (query || "").trim();
  if (trimmed.length < 3) {
    throw new Error("query precisa ter pelo menos 3 caracteres");
  }
  const pattern = `%${trimmed}%`;
  const result = await db.execute(sql`
    SELECT
      d.company_name,
      COUNT(*)::int            AS deal_count,
      MAX(d.id)::int           AS last_deal_id,
      MAX(d.stage_name)        AS last_stage
    FROM "Bitrix".crm_deal d
    WHERE d.company_name ILIKE ${pattern}
       OR d.title        ILIKE ${pattern}
    GROUP BY d.company_name
    ORDER BY deal_count DESC, last_deal_id DESC
    LIMIT 10
  `);
  return (result.rows || []) as CompanyMatch[];
}
```

- [ ] **Step 4: Rodar testes e verificar que passam**

Run:
```bash
npm test -- server/routes/sdr-assistant.test.ts
```

Expected: todos os testes anteriores + 5 novos de `searchCompanies` passando.

- [ ] **Step 5: Teste integração com banco real (smoke test manual)**

Run (em um REPL ou script temporário):
```bash
npx tsx -e "
  import('./server/db.js').then(async ({ db }) => {
    const { searchCompanies } = await import('./server/routes/sdr-assistant.ts');
    const r = await searchCompanies(db, 'Marketing');
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  });
"
```

Expected: array com até 10 empresas reais do banco de dev.

- [ ] **Step 6: Commit**

```bash
git add server/routes/sdr-assistant.ts server/routes/sdr-assistant.test.ts
git commit -m "feat(sdr-assistant): tool searchCompanies com fuzzy match + testes"
```

---

## Task 6: Tool `getCompanyTimeline` — SQL + testes

**Files:**
- Modify: `server/routes/sdr-assistant.ts`
- Modify: `server/routes/sdr-assistant.test.ts`

- [ ] **Step 1: Adicionar testes para `getCompanyTimeline`**

Append a `server/routes/sdr-assistant.test.ts`:

```ts
import { getCompanyTimeline } from "./sdr-assistant";

describe("getCompanyTimeline", () => {
  const mockDb = { execute: vi.fn() } as any;
  beforeEach(() => { mockDb.execute.mockReset(); });

  it("retorna array vazio quando empresa não tem deals", async () => {
    mockDb.execute.mockResolvedValueOnce({ rows: [] });
    const result = await getCompanyTimeline(mockDb, "Inexistente LTDA");
    expect(result).toEqual([]);
  });

  it("classifica status correto em cada deal", async () => {
    mockDb.execute.mockResolvedValueOnce({
      rows: [
        { id: 3, title: "X", stage_name: "Proposta enviada", company_name: "X", categoria: "Comercial",
          source: null, valor_recorrente: 1000, valor_pontual: null, data_criacao: "2026-04-01",
          data_fechamento: null, comments: null, motivo_perda: null,
          responsavel_nome: "Laura", closer_nome: null },
        { id: 2, title: "X", stage_name: "Negócio Perdido", company_name: "X", categoria: "Comercial",
          source: null, valor_recorrente: null, valor_pontual: null, data_criacao: "2024-08-01",
          data_fechamento: "2024-08-15", comments: "já tem agência", motivo_perda: "já possui agência",
          responsavel_nome: "Kaike", closer_nome: null },
        { id: 1, title: "X", stage_name: "Negócio Ganho", company_name: "X", categoria: "Comercial",
          source: null, valor_recorrente: 2000, valor_pontual: null, data_criacao: "2023-11-01",
          data_fechamento: "2023-11-20", comments: null, motivo_perda: null,
          responsavel_nome: "Guilherme", closer_nome: "João" },
      ],
    });
    const result = await getCompanyTimeline(mockDb, "X");
    expect(result).toHaveLength(3);
    expect(result[0].status).toBe("ativo");
    expect(result[1].status).toBe("perdido");
    expect(result[1].motivo_perda).toBe("já possui agência");
    expect(result[2].status).toBe("ganho");
  });

  it("mantém ordem cronológica decrescente (do mais novo ao mais antigo)", async () => {
    mockDb.execute.mockResolvedValueOnce({
      rows: [
        { id: 10, title: "X", stage_name: "Ativo", company_name: "X", categoria: null,
          source: null, valor_recorrente: null, valor_pontual: null, data_criacao: "2026-04-10",
          data_fechamento: null, comments: null, motivo_perda: null,
          responsavel_nome: null, closer_nome: null },
        { id: 5, title: "X", stage_name: "Perdido", company_name: "X", categoria: null,
          source: null, valor_recorrente: null, valor_pontual: null, data_criacao: "2025-01-01",
          data_fechamento: null, comments: null, motivo_perda: null,
          responsavel_nome: null, closer_nome: null },
      ],
    });
    const result = await getCompanyTimeline(mockDb, "X");
    expect(result[0].criado_em).toBe("2026-04-10");
    expect(result[1].criado_em).toBe("2025-01-01");
  });
});
```

- [ ] **Step 2: Rodar testes e verificar falha**

Run:
```bash
npm test -- server/routes/sdr-assistant.test.ts
```

Expected: falha com "getCompanyTimeline is not defined".

- [ ] **Step 3: Implementar `getCompanyTimeline`**

Append a `server/routes/sdr-assistant.ts`:

```ts
export interface DealDetails {
  id: number;
  title: string;
  stage: string;
  categoria: string | null;
  sdr: string | null;
  closer: string | null;
  criado_em: string | null;
  fechado_em: string | null;
  valor_mrr: number | null;
  valor_pontual: number | null;
  status: DealStatus;
  motivo_perda: string | null;
  origem: string | null;
}

export async function getCompanyTimeline(
  db: NodePgDatabase<any>,
  companyName: string
): Promise<DealDetails[]> {
  const result = await db.execute(sql`
    SELECT
      d.id, d.title, d.stage_name, d.category_name AS categoria, d.source,
      d.valor_recorrente, d.valor_pontual,
      d.data_criacao, d.data_fechamento,
      d.comments,
      NULL::text AS motivo_perda,
      u.nome AS responsavel_nome,
      c.nome AS closer_nome
    FROM "Bitrix".crm_deal d
    LEFT JOIN "Bitrix".crm_users   u ON d.assigned_by_id = u.id
    LEFT JOIN "Bitrix".crm_closers c ON d.closer_id      = c.id
    WHERE d.company_name = ${companyName}
    ORDER BY d.data_criacao DESC
  `);

  return (result.rows || []).map((row: any): DealDetails => ({
    id: row.id,
    title: row.title,
    stage: row.stage_name,
    categoria: row.categoria,
    sdr: row.responsavel_nome,
    closer: row.closer_nome,
    criado_em: row.data_criacao,
    fechado_em: row.data_fechamento,
    valor_mrr: row.valor_recorrente ? Number(row.valor_recorrente) : null,
    valor_pontual: row.valor_pontual ? Number(row.valor_pontual) : null,
    status: classifyDealStatus(row.stage_name),
    motivo_perda: row.motivo_perda,  // V2: leremos de d.motivo_perda quando coluna existir
    origem: row.source,
  }));
}
```

> **ATENÇÃO (V2):** quando a coluna `crm_deal.motivo_perda` for criada, trocar `NULL::text AS motivo_perda` por `d.motivo_perda`. O resto do código já está preparado.

- [ ] **Step 4: Rodar testes e verificar que passam**

Run:
```bash
npm test -- server/routes/sdr-assistant.test.ts
```

Expected: todos os testes passando.

- [ ] **Step 5: Smoke test com dado real**

Run (após rodar `searchCompanies` para pegar um nome real):
```bash
npx tsx -e "
  import('./server/db.js').then(async ({ db }) => {
    const { getCompanyTimeline } = await import('./server/routes/sdr-assistant.ts');
    const r = await getCompanyTimeline(db, '<NOME REAL DA EMPRESA>');
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  });
"
```

Expected: array com todos os deals da empresa, ordenados do mais novo ao mais antigo.

- [ ] **Step 6: Commit**

```bash
git add server/routes/sdr-assistant.ts server/routes/sdr-assistant.test.ts
git commit -m "feat(sdr-assistant): tool getCompanyTimeline com classificação + testes"
```

---

## Task 7: Integração Anthropic SDK com tool-use loop

**Files:**
- Modify: `server/routes/sdr-assistant.ts`

- [ ] **Step 1: Adicionar imports e constantes do Anthropic**

Append ao topo (junto dos outros imports) de `server/routes/sdr-assistant.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-4-5-20250929";  // pin minor version for stability
const MAX_TOOL_ITERATIONS = 5;
```

> Modelo exato: confira em `server/routes/ia-hub.ts` qual ID está em uso. Se o projeto já padronizou outro nome (ex: claude-sonnet-4-6), use o mesmo.

- [ ] **Step 2: Definir as tools no formato do Anthropic SDK**

Append em `server/routes/sdr-assistant.ts`:

```ts
const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "search_companies",
    description:
      "Busca empresas no CRM Bitrix por nome (fuzzy match). Use quando o SDR informa o nome de uma empresa para verificar histórico.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Nome ou parte do nome da empresa (mínimo 3 caracteres)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_company_timeline",
    description:
      "Retorna todos os deals de uma empresa específica em ordem cronológica decrescente. Use após identificar a empresa correta via search_companies.",
    input_schema: {
      type: "object",
      properties: {
        company_name: {
          type: "string",
          description: "Nome exato da empresa conforme retornado por search_companies",
        },
      },
      required: ["company_name"],
    },
  },
];

const SYSTEM_PROMPT = `Você é o SDR Assistant da Turbo Partners. Ajuda o time comercial a checar histórico de empresas no CRM Bitrix antes de abordar.

REGRAS:
1. SDR envia nome da empresa. Você busca no Bitrix usando search_companies.
2. Se múltiplos matches (>1), peça disambiguação. Liste até 5 opções com: número, nome completo, SDR responsável, stage atual. Peça "digite o número ou o nome completo".
3. Se 1 match, chame get_company_timeline automaticamente e apresente o resultado.
4. Se 0 matches, responda "Empresa nova — sem histórico no Bitrix." e sugira prosseguir.
5. Para descartes, informe motivo se motivo_perda estiver preenchido; caso contrário, diga "motivo não registrado".
6. Tom: direto, sem floreio. SDR tem pressa. Use bullets e emojis 🟢 📜.
7. NUNCA invente dados. Se a tool não retornou, diga que não tem.

FORMATO PADRÃO quando há histórico:

🟢 ATIVO — <SDR> | <stage> | criado em <data>
   <valor MRR se houver> | Origem: <origem>

📜 HISTÓRICO (N deals anteriores):
   • <data> — <SDR> | <stage_final> | <motivo se descarte>
   • ...

Destaque sempre o deal ATIVO no topo (se existir). Se só tem deals fechados (perdidos/ganhos), liste todos em ordem decrescente.`;
```

- [ ] **Step 3: Implementar o loop de tool-use**

Append em `server/routes/sdr-assistant.ts`:

```ts
type ChatMessage = { role: "user" | "assistant"; content: string };

export async function runSdrAssistant(
  db: NodePgDatabase<any>,
  conversation: ChatMessage[]
): Promise<{ response: string; toolCalls: string[]; tokensTotal: number; matchedCompany: string | null }> {
  const messages: Anthropic.Messages.MessageParam[] = conversation.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const toolCalls: string[] = [];
  let matchedCompany: string | null = null;
  let totalTokens = 0;

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: TOOLS,
      messages,
    });

    totalTokens += (resp.usage?.input_tokens || 0) + (resp.usage?.output_tokens || 0);

    if (resp.stop_reason === "end_turn" || resp.stop_reason === "max_tokens") {
      const textBlock = resp.content.find((b) => b.type === "text") as Anthropic.Messages.TextBlock | undefined;
      return {
        response: textBlock?.text || "(sem resposta)",
        toolCalls,
        tokensTotal: totalTokens,
        matchedCompany,
      };
    }

    if (resp.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: resp.content });

      const toolUseBlocks = resp.content.filter(
        (b) => b.type === "tool_use"
      ) as Anthropic.Messages.ToolUseBlock[];

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const block of toolUseBlocks) {
        toolCalls.push(block.name);
        try {
          let result: unknown;
          if (block.name === "search_companies") {
            const { query } = block.input as { query: string };
            result = await searchCompanies(db, query);
          } else if (block.name === "get_company_timeline") {
            const { company_name } = block.input as { company_name: string };
            matchedCompany = company_name;
            result = await getCompanyTimeline(db, company_name);
          } else {
            result = { error: `unknown tool: ${block.name}` };
          }
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        } catch (err: any) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify({ error: err.message || "erro desconhecido" }),
            is_error: true,
          });
        }
      }
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    return {
      response: "(erro: stop_reason inesperado)",
      toolCalls,
      tokensTotal: totalTokens,
      matchedCompany,
    };
  }

  return {
    response: "(limite de iterações de tools excedido)",
    toolCalls,
    tokensTotal: totalTokens,
    matchedCompany,
  };
}
```

- [ ] **Step 4: Smoke test manual do loop**

Run (com ANTHROPIC_API_KEY setada):
```bash
npx tsx -e "
  import('./server/db.js').then(async ({ db }) => {
    const { runSdrAssistant } = await import('./server/routes/sdr-assistant.ts');
    const r = await runSdrAssistant(db, [
      { role: 'user', content: 'olha a Padaria Delícia pra mim' }
    ]);
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  });
"
```

Expected: resposta textual da IA mencionando a empresa, com `toolCalls: ["search_companies", "get_company_timeline"]` (se match único), e `tokensTotal > 0`.

- [ ] **Step 5: Commit**

```bash
git add server/routes/sdr-assistant.ts
git commit -m "feat(sdr-assistant): integração Anthropic SDK com tool-use loop"
```

---

## Task 8: Endpoint `/chat` completo + log de uso

**Files:**
- Modify: `server/routes/sdr-assistant.ts`

- [ ] **Step 1: Substituir o handler skeleton pela versão completa**

Em `server/routes/sdr-assistant.ts`, localizar a função `registerSdrAssistantRoutes` e substituir o handler da rota:

```ts
export function registerSdrAssistantRoutes(app: Express, db: NodePgDatabase<any>) {
  app.post(
    "/api/sdr-assistant/chat",
    isAuthenticated,
    requireInternalCollaborator,
    async (req: Request, res: Response) => {
      const user = (req as any).user;
      const { messages } = req.body as { messages?: ChatMessage[] };

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "messages deve ser array não vazio" });
      }
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
      const query = lastUserMsg?.content || "";

      const startedAt = Date.now();
      try {
        const result = await runSdrAssistant(db, messages);
        const durationMs = Date.now() - startedAt;

        await db.execute(sql`
          INSERT INTO cortex_core.sdr_assistant_usage
            (user_id, query, matched_company, tool_calls, tokens_total, duration_ms)
          VALUES
            (${user.id}, ${query}, ${result.matchedCompany},
             ${result.toolCalls.length}, ${result.tokensTotal}, ${durationMs})
        `);

        return res.json({
          response: result.response,
          tool_calls: result.toolCalls,
          usage: { tokens: result.tokensTotal, duration_ms: durationMs },
        });
      } catch (err: any) {
        console.error("[sdr-assistant] erro:", err);
        const durationMs = Date.now() - startedAt;
        await db.execute(sql`
          INSERT INTO cortex_core.sdr_assistant_usage
            (user_id, query, matched_company, tool_calls, tokens_total, duration_ms)
          VALUES
            (${user.id}, ${query}, NULL, 0, 0, ${durationMs})
        `).catch(() => {/* não propagar falha de log */});
        return res.status(500).json({ error: "Erro interno ao processar a consulta." });
      }
    }
  );
}
```

- [ ] **Step 2: Reiniciar dev server**

Run:
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
sleep 3
```

- [ ] **Step 3: Testar end-to-end (com cookie de usuário logado)**

Run:
```bash
curl -sS -X POST http://localhost:3000/api/sdr-assistant/chat \
  -H "Cookie: connect.sid=<COOKIE>" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"olha a <EMPRESA REAL> pra mim"}]}'
```

Expected: JSON com `response` (texto da IA), `tool_calls` (lista), `usage` (tokens + duração).

- [ ] **Step 4: Verificar log no banco**

Run:
```bash
psql "$DEV_DATABASE_URL" -c "
  SELECT id, user_id, query, matched_company, tool_calls, tokens_total, duration_ms, created_at
  FROM cortex_core.sdr_assistant_usage
  ORDER BY id DESC LIMIT 3;
"
```

Expected: linha nova com os dados da consulta recente.

- [ ] **Step 5: Commit**

```bash
git add server/routes/sdr-assistant.ts
git commit -m "feat(sdr-assistant): endpoint /chat com log de uso + tratamento de erro"
```

---

## Task 9: Frontend — página `SdrAssistant.tsx`

**Files:**
- Create: `client/src/pages/SdrAssistant.tsx`

- [ ] **Step 1: Criar o arquivo completo**

Conteúdo completo de `client/src/pages/SdrAssistant.tsx`:

```tsx
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { MessagesSquare, Send, Loader2, Plus } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

const INITIAL_MESSAGES: Message[] = [
  {
    role: "assistant",
    content:
      "Oi! 👋 Me diz o nome da empresa que você quer checar no Bitrix. Eu trago o histórico com SDR responsável, stage e motivos de descarte.",
  },
];

export default function SdrAssistant() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const resp = await fetch("/api/sdr-assistant/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setMessages((m) => [
          ...m,
          { role: "assistant", content: `⚠️ Erro: ${err.error || resp.statusText}` },
        ]);
      } else {
        const data = await resp.json();
        setMessages((m) => [...m, { role: "assistant", content: data.response }]);
      }
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `⚠️ Falha de conexão: ${e.message || "tenta de novo"}` },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function newConversation() {
    setMessages(INITIAL_MESSAGES);
    setInput("");
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-white dark:bg-zinc-950">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <MessagesSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            SDR Assistant
          </h1>
        </div>
        <button
          onClick={newConversation}
          className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
        >
          <Plus className="w-4 h-4" /> Nova conversa
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                m.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100"
              }`}
            >
              {m.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <span>{m.content}</span>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg px-4 py-2 flex items-center gap-2 text-gray-600 dark:text-zinc-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Consultando Bitrix...
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-zinc-800 p-4">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nome da empresa... (Enter para enviar, Shift+Enter para nova linha)"
            rows={1}
            className="flex-1 resize-none rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que `react-markdown` está instalado**

Run:
```bash
grep '"react-markdown"' package.json
```

Expected: linha com a versão. Se não aparecer, rodar:
```bash
npm install react-markdown
```

- [ ] **Step 3: Type-check**

Run:
```bash
npx tsc --noEmit
```

Expected: 0 erros no arquivo novo.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/SdrAssistant.tsx package.json package-lock.json
git commit -m "feat(sdr-assistant): página de chat com markdown e dark mode"
```

---

## Task 10: Frontend — rota + link no menu

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/components/app-sidebar.tsx`

- [ ] **Step 1: Registrar rota em `client/src/App.tsx`**

Localizar a seção onde outras rotas são definidas (procurar por `<Route path=`). Adicionar, em ordem lógica (seção Comercial):

```tsx
<Route path="/sdr-assistant">
  {() => <ProtectedRoute path="/sdr-assistant" component={SdrAssistant} />}
</Route>
```

No topo do arquivo, no bloco de imports com `lazyWithRetry`:

```tsx
const SdrAssistant = lazyWithRetry(() => import("./pages/SdrAssistant"));
```

> Se o projeto usa `lazy()` padrão do React em vez de `lazyWithRetry`, use o mesmo padrão das outras rotas.

- [ ] **Step 2: Adicionar link no menu lateral**

Em `client/src/components/app-sidebar.tsx`, localizar a seção do grupo "Comercial" e adicionar um novo item (mesmo formato dos existentes):

```ts
{
  title: "SDR Assistant",
  url: "/sdr-assistant",
  icon: "MessagesSquare",
  permissionKey: PERMISSION_KEYS.COM.SDR_ASSISTANT,
},
```

- [ ] **Step 3: Criar a permission key**

Procurar onde `PERMISSION_KEYS` é definido (provavelmente `client/src/lib/permissions.ts` ou similar). Adicionar em `COM`:

```ts
SDR_ASSISTANT: "com:sdr-assistant",
```

Se o sistema de permissões do Cortex exigir também um cadastro em `allowedRoutes` no backend, seguir o padrão de outras rotas recentes (ex: `com:closers`).

- [ ] **Step 4: Reiniciar dev server e testar navegação**

Run:
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
sleep 3
```

Abrir `http://localhost:3000/sdr-assistant` no browser (logado como usuário com departamento "comercial" ou "admin").

Expected:
- Página renderiza com header "🤖 SDR Assistant" e mensagem de boas-vindas
- Input tem foco automático
- Dark mode funciona (alternar via toggle do Cortex)
- Link visível no menu lateral, seção Comercial

- [ ] **Step 5: Commit**

```bash
git add client/src/App.tsx client/src/components/app-sidebar.tsx client/src/lib/permissions.ts
git commit -m "feat(sdr-assistant): rota /sdr-assistant + link no menu comercial"
```

---

## Task 11: QA manual — checklist completo

**Files:**
- Nenhum (só teste manual)

- [ ] **Step 1: Subir ambiente limpo**

Run:
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
sleep 4
```

Confirmar que não há erros no console.

- [ ] **Step 2: Checklist funcional (em `http://localhost:3000/sdr-assistant`)**

Marcar cada item após testar:

- [ ] Empresa nova (nome que não existe no Bitrix) → "Empresa nova — sem histórico"
- [ ] Empresa com 1 deal ativo → timeline com 🟢 ATIVO
- [ ] Empresa com deal perdido (sem `motivo_perda` no DB) → mostra "motivo não registrado"
- [ ] Empresa com múltiplos deals (mix ativo + ganho + perdido) → destaca ATIVO, lista histórico
- [ ] Query genérica com >5 matches (ex: "Marketing") → IA pede disambiguação com até 5 opções
- [ ] Responder com número ("2") após disambiguação → IA traz timeline da opção 2
- [ ] Query com menos de 3 caracteres ("ab") → IA pede reformulação (mensagem amigável)
- [ ] Botão "+ Nova conversa" → limpa tela
- [ ] Enter envia; Shift+Enter quebra linha
- [ ] Estado "Consultando Bitrix..." aparece durante request
- [ ] Dark mode renderiza corretamente (toggle no header do Cortex)
- [ ] Light mode renderiza corretamente
- [ ] Tablet (redimensionar browser para ~800px) → layout responsivo

- [ ] **Step 3: Checklist de segurança**

- [ ] Logar como cliente externo (email fora de `ALLOWED_EXTERNAL_EMAILS` do departamento comercial/admin) → acesso negado (403)
- [ ] Deslogar → requisição retorna 401
- [ ] Verificar log em `cortex_core.sdr_assistant_usage` após cada consulta (user_id preenchido)

- [ ] **Step 4: Checklist de robustez**

- [ ] Simular erro do Bitrix (stopping o DB local temporariamente) → mensagem amigável "tenta de novo em 30s", sem stack trace
- [ ] Mensagem sem significado ("xyz123abc") → IA lida graciosamente (diz que não achou empresa)
- [ ] 10+ turns de conversa seguidos → sem degradação visível

- [ ] **Step 5: Registrar problemas (se houver)**

Se algum item falhar, criar issue interno ou documentar em `docs/bugs-found.md` e voltar para a task correspondente. Se todos passarem, seguir.

- [ ] **Step 6: Sem commit nesta task** — é só verificação.

---

## Task 12: Finalização — review, PR, cleanup

**Files:**
- Nenhum novo (só git operations)

- [ ] **Step 1: Rodar todos os testes**

Run:
```bash
npm test
```

Expected: todos os testes (incluindo os novos de `sdr-assistant.test.ts`) passando. 0 falhas.

- [ ] **Step 2: Type-check completo**

Run:
```bash
npx tsc --noEmit
```

Expected: 0 erros.

- [ ] **Step 3: Revisar diff completo da branch**

Run:
```bash
git log --oneline origin/main..HEAD
git diff origin/main...HEAD --stat
```

Expected: lista de commits organizados (conventional commits) e diff razoável (~1.000-1.500 linhas de mudança total).

- [ ] **Step 4: Push e abrir PR para staging**

Run:
```bash
git push -u origin feature/sdr-assistant-ia
```

Então criar PR:
```bash
gh pr create --base staging --title "feat(sdr-assistant): IA para confirmação automática de leads (V1)" --body "$(cat <<'EOF'
## Summary
- Chat interno em `/sdr-assistant` que consulta histórico de empresas no Bitrix via Claude Sonnet com tool-use
- 2 tools: `search_companies` (fuzzy match) + `get_company_timeline` (timeline completa)
- Log de uso em `cortex_core.sdr_assistant_usage` para métricas de adoção
- Auth: colaboradores internos (departamento admin/comercial)

## Spec
`docs/superpowers/specs/2026-04-16-sdr-assistant-ia-design.md`

## Test plan
- [ ] Empresa nova, com 1 deal, com múltiplos deals
- [ ] Disambiguação com >5 matches
- [ ] Dark + light mode
- [ ] Cliente externo recebe 403
- [ ] Log registrado em `sdr_assistant_usage`

## Follow-ups (V2/V3)
- Ativar coluna `motivo_perda` quando criada no Bitrix
- Input por Instagram quando campo estiver populado em `crm_deal`
- Integração ClickUp (flag "já é cliente")

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR criado, URL retornada.

- [ ] **Step 5: Aguardar CI passar**

Run:
```bash
gh pr checks --watch
```

Expected: todos os checks verdes.

- [ ] **Step 6: Celebrar** 🎉

V1 pronto para revisão do time e merge.

---

## Resumo de comandos recorrentes

```bash
# Reiniciar dev server
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &

# Rodar só testes do SDR Assistant
npm test -- server/routes/sdr-assistant.test.ts

# Rodar todos os testes
npm test

# Type-check
npx tsc --noEmit

# Ver log de uso
psql "$DEV_DATABASE_URL" -c "SELECT * FROM cortex_core.sdr_assistant_usage ORDER BY id DESC LIMIT 10;"
```
