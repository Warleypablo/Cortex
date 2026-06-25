# Reporte Semanal de Desempenho — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a tela `/reports/semanal` no Cortex com 4 KPIs (MRR Ativo, Churn, Entregas Pontuais, Churn Pontual) — valor da semana corrente (seg→hoje) vs mesmo trecho da semana anterior.

**Architecture:** Endpoint backend consolidado `GET /api/reports/semanal?ate=YYYY-MM-DD` calcula os 4 KPIs × 2 janelas com tolerância a falha por KPI; a régua de datas vive num módulo de helpers puro e testável. O frontend é uma página React que só renderiza o JSON em 4 cards, com cor de variação semântica pela direção desejada de cada KPI.

**Tech Stack:** Node + Express, Drizzle (`db.execute(sql\`...\`)`) sobre `pg`, Vitest (testes co-localizados `*.test.ts`), React + wouter + React Query + Tailwind (dark/light via classes `dark:`), ícones lucide-react.

## Global Constraints

- Banco: schema `"Clickup"` (aspas duplas obrigatórias) e view `cortex_core.vw_cup_churn_ajustado`.
- Coluna de valor de churn recorrente: `valor_r` **com** underscore (na view). Em `cup_contratos`/`cup_data_hist` é `valorr`/`valorp` **sem** underscore. Não trocar.
- Snapshot de `cup_data_hist`: usar **`data_snapshot`** (a coluna `snapshot_date` é 100% NULL — nunca usar). Há dias com carga duplicada (ex: 2026-06-20 com ~4×) e gaps de fim de semana → deduplicar por `id_subtask` e ancorar via `MAX(data_snapshot) <= fim`.
- Status "ativo" para MRR = `status IN ('ativo','onboarding','triagem')` (minúsculo). Status "entregue" = `'entregue'` (minúsculo).
- Dark/light mode obrigatório: toda cor com variante `dark:`.
- Commit co-author: `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`.
- Branch: trabalhar direto na `main` (autorizado), commits granulares Conventional Commits.

## File Structure

**Backend (novos):**
- `server/routes/reportsSemanal.helpers.ts` — lógica pura: cálculo de janelas, variação %, montagem de KPI.
- `server/routes/reportsSemanal.helpers.test.ts` — testes Vitest dos helpers.
- `server/routes/reportsSemanal.ts` — rota `GET /api/reports/semanal` (as 4 queries SQL + montagem da resposta).

**Backend (modificar):**
- `server/routes.ts` — import + registro da rota (linhas ~56 e ~8343).

**Frontend (novos):**
- `client/src/pages/relatorio-semanal/types.ts` — tipos da resposta.
- `client/src/pages/relatorio-semanal/useRelatorioSemanal.ts` — hook React Query.
- `client/src/pages/RelatorioSemanal.tsx` — página + cards.

**Frontend (modificar):**
- `client/src/App.tsx` — import lazy (linha ~136) + `<Route>` (linha ~432).
- `shared/nav-config.ts` — item de menu (linha ~584) + mapa de rota (linha ~319).

---

### Task 1: Helpers puros (janela de datas + variação + montagem de KPI)

**Files:**
- Create: `server/routes/reportsSemanal.helpers.ts`
- Test: `server/routes/reportsSemanal.helpers.test.ts`

**Interfaces:**
- Produces:
  - `interface Janela { inicio: string; fim: string }` (datas `'YYYY-MM-DD'`)
  - `interface Janelas { atual: Janela; anterior: Janela }`
  - `calcularJanelas(ate: string): Janelas`
  - `type Direction = "up" | "down"`
  - `interface Kpi { atual: number | null; anterior: number | null; variacaoPct: number | null; betterDirection: Direction }`
  - `variacaoPct(atual: number | null, anterior: number | null): number | null`
  - `montarKpi(atual: number | null, anterior: number | null, betterDirection: Direction): Kpi`

- [ ] **Step 1: Write the failing test**

Create `server/routes/reportsSemanal.helpers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { calcularJanelas, variacaoPct, montarKpi } from "./reportsSemanal.helpers";

describe("calcularJanelas", () => {
  it("meio da semana: quinta 2026-06-25 → atual seg(22)-25, anterior seg(15)-18", () => {
    expect(calcularJanelas("2026-06-25")).toEqual({
      atual: { inicio: "2026-06-22", fim: "2026-06-25" },
      anterior: { inicio: "2026-06-15", fim: "2026-06-18" },
    });
  });

  it("quando 'ate' é segunda, a janela atual tem 1 dia (inicio === fim)", () => {
    expect(calcularJanelas("2026-06-22")).toEqual({
      atual: { inicio: "2026-06-22", fim: "2026-06-22" },
      anterior: { inicio: "2026-06-15", fim: "2026-06-15" },
    });
  });

  it("domingo pertence à semana que começou na segunda anterior", () => {
    expect(calcularJanelas("2026-06-28")).toEqual({
      atual: { inicio: "2026-06-22", fim: "2026-06-28" },
      anterior: { inicio: "2026-06-15", fim: "2026-06-21" },
    });
  });

  it("virada de mês", () => {
    expect(calcularJanelas("2026-07-01")).toEqual({
      atual: { inicio: "2026-06-29", fim: "2026-07-01" },
      anterior: { inicio: "2026-06-22", fim: "2026-06-24" },
    });
  });

  it("virada de ano", () => {
    expect(calcularJanelas("2026-01-01")).toEqual({
      atual: { inicio: "2025-12-29", fim: "2026-01-01" },
      anterior: { inicio: "2025-12-22", fim: "2025-12-25" },
    });
  });
});

describe("variacaoPct", () => {
  it("calcula a variação percentual", () => {
    expect(variacaoPct(110, 100)).toBeCloseTo(10);
    expect(variacaoPct(90, 100)).toBeCloseTo(-10);
  });
  it("retorna null quando anterior é 0 ou algum valor é null", () => {
    expect(variacaoPct(50, 0)).toBeNull();
    expect(variacaoPct(null, 100)).toBeNull();
    expect(variacaoPct(100, null)).toBeNull();
  });
});

describe("montarKpi", () => {
  it("monta o objeto com variação e direção", () => {
    expect(montarKpi(110, 100, "up")).toEqual({
      atual: 110, anterior: 100, variacaoPct: 10, betterDirection: "up",
    });
  });
  it("propaga null sem quebrar", () => {
    expect(montarKpi(null, null, "down")).toEqual({
      atual: null, anterior: null, variacaoPct: null, betterDirection: "down",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/routes/reportsSemanal.helpers.test.ts`
Expected: FAIL — `Cannot find module './reportsSemanal.helpers'`.

- [ ] **Step 3: Write minimal implementation**

Create `server/routes/reportsSemanal.helpers.ts`:

```ts
export interface Janela {
  inicio: string;
  fim: string;
}

export interface Janelas {
  atual: Janela;
  anterior: Janela;
}

export type Direction = "up" | "down";

export interface Kpi {
  atual: number | null;
  anterior: number | null;
  variacaoPct: number | null;
  betterDirection: Direction;
}

// Trabalha em UTC sobre a data civil 'YYYY-MM-DD' para não sofrer com
// horário de verão / timezone do servidor.
function parseISO(d: string): Date {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd));
}

function fmt(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

function addDays(dt: Date, n: number): Date {
  return new Date(dt.getTime() + n * 86400000);
}

export function calcularJanelas(ate: string): Janelas {
  const fimAtual = parseISO(ate);
  const dow = fimAtual.getUTCDay(); // 0=domingo .. 6=sábado
  const diasAteSegunda = (dow + 6) % 7;
  const inicioAtual = addDays(fimAtual, -diasAteSegunda);
  return {
    atual: { inicio: fmt(inicioAtual), fim: fmt(fimAtual) },
    anterior: {
      inicio: fmt(addDays(inicioAtual, -7)),
      fim: fmt(addDays(fimAtual, -7)),
    },
  };
}

export function variacaoPct(
  atual: number | null,
  anterior: number | null,
): number | null {
  if (atual == null || anterior == null || anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

export function montarKpi(
  atual: number | null,
  anterior: number | null,
  betterDirection: Direction,
): Kpi {
  return { atual, anterior, variacaoPct: variacaoPct(atual, anterior), betterDirection };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/routes/reportsSemanal.helpers.test.ts`
Expected: PASS — todos os testes verdes.

- [ ] **Step 5: Commit**

```bash
git add server/routes/reportsSemanal.helpers.ts server/routes/reportsSemanal.helpers.test.ts
git commit -m "feat(reporte-semanal): helpers de janela de datas e variação

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Endpoint `GET /api/reports/semanal`

**Files:**
- Create: `server/routes/reportsSemanal.ts`
- Modify: `server/routes.ts` (import ~linha 56; registro ~linha 8343)

**Interfaces:**
- Consumes (Task 1): `calcularJanelas`, `montarKpi`, `Kpi`, `Janela` de `./reportsSemanal.helpers`.
- Produces: rota HTTP `GET /api/reports/semanal?ate=YYYY-MM-DD`. Resposta JSON:

```jsonc
{
  "periodo": {
    "atual":    { "inicio": "2026-06-22", "fim": "2026-06-25" },
    "anterior": { "inicio": "2026-06-15", "fim": "2026-06-18" }
  },
  "kpis": {
    "mrrAtivo":         { "atual": 909096, "anterior": 901230, "variacaoPct": 0.87, "betterDirection": "up" },
    "churn":            { "atual": 38500,  "anterior": 34200,  "variacaoPct": 12.5, "betterDirection": "down" },
    "entregasPontuais": { "atual": 39750,  "anterior": 21000,  "variacaoPct": 89.2, "betterDirection": "up",   "qtdAtual": 3, "qtdAnterior": 2 },
    "churnPontual":     { "atual": 11300,  "anterior": 12300,  "variacaoPct": -8.1, "betterDirection": "down", "qtdAtual": 4, "qtdAnterior": 5 }
  }
}
```

Cada KPI que falhar na query vem com `atual`/`anterior`/`variacaoPct` = `null` (não derruba a resposta).

- [ ] **Step 1: Criar o arquivo da rota**

Create `server/routes/reportsSemanal.ts`:

```ts
import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { calcularJanelas, montarKpi, type Janela, type Kpi } from "./reportsSemanal.helpers";

// "Hoje" no fuso de São Paulo, em 'YYYY-MM-DD'.
function hojeSP(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function num(v: unknown): number {
  return v == null ? 0 : Number(v);
}

// --- MRR Ativo: snapshot mais recente <= fim, deduplicado por id_subtask ---
async function mrrAtivoNaData(fim: string): Promise<number> {
  const r = await db.execute(sql`
    WITH snap AS (
      SELECT MAX(data_snapshot) AS d
      FROM "Clickup".cup_data_hist
      WHERE data_snapshot <= ${fim}::date
    ),
    linhas AS (
      SELECT DISTINCT ON (h.id_subtask) h.id_subtask, h.valorr, h.status
      FROM "Clickup".cup_data_hist h, snap
      WHERE h.data_snapshot = snap.d
      ORDER BY h.id_subtask
    )
    SELECT COALESCE(SUM(valorr::numeric), 0) AS mrr
    FROM linhas
    WHERE status IN ('ativo','onboarding','triagem') AND valorr IS NOT NULL
  `);
  return num((r.rows[0] as any)?.mrr);
}

// --- Churn recorrente: view ajustada por data_solicitacao_encerramento ---
async function churnNaJanela(j: Janela): Promise<{ valor: number; qtd: number }> {
  const r = await db.execute(sql`
    SELECT
      COALESCE(SUM(valor_r::numeric), 0) AS valor,
      COUNT(*) AS qtd
    FROM cortex_core.vw_cup_churn_ajustado
    WHERE data_solicitacao_encerramento IS NOT NULL
      AND data_solicitacao_encerramento >= ${j.inicio}::date
      AND data_solicitacao_encerramento <= ${j.fim}::date
  `);
  const row = r.rows[0] as any;
  return { valor: num(row?.valor), qtd: num(row?.qtd) };
}

// --- Entregas pontuais: itens com valorp>0 entregues na janela (data_entrega) ---
async function entregasPontuaisNaJanela(j: Janela): Promise<{ valor: number; qtd: number }> {
  const r = await db.execute(sql`
    SELECT
      COUNT(*) AS qtd,
      COALESCE(SUM(valorp::numeric), 0) AS valor
    FROM "Clickup".cup_contratos
    WHERE valorp > 0
      AND data_entrega >= ${j.inicio}::date
      AND data_entrega <= ${j.fim}::date
  `);
  const row = r.rows[0] as any;
  return { valor: num(row?.valor), qtd: num(row?.qtd) };
}

// --- Churn pontual: contratos de entrega cancelados na janela (proxy datável) ---
async function churnPontualNaJanela(j: Janela): Promise<{ valor: number; qtd: number }> {
  const r = await db.execute(sql`
    SELECT
      COUNT(*) AS qtd,
      COALESCE(SUM(valorp::numeric), 0) AS valor
    FROM "Clickup".cup_contratos
    WHERE servico ILIKE '%entrega%'
      AND status IN ('cancelado/inativo','não usar')
      AND valorp > 0
      AND data_solicitacao_encerramento >= ${j.inicio}::date
      AND data_solicitacao_encerramento <= ${j.fim}::date
  `);
  const row = r.rows[0] as any;
  return { valor: num(row?.valor), qtd: num(row?.qtd) };
}

// Executa um cálculo das 2 janelas com tolerância a falha → KPI null em erro.
async function calcKpi(
  fn: (j: Janela) => Promise<number>,
  janelas: { atual: Janela; anterior: Janela },
  betterDirection: "up" | "down",
): Promise<Kpi> {
  try {
    const [a, b] = await Promise.all([fn(janelas.atual), fn(janelas.anterior)]);
    return montarKpi(a, b, betterDirection);
  } catch (e) {
    console.error("[reports/semanal] KPI falhou:", e);
    return montarKpi(null, null, betterDirection);
  }
}

export function registerReportsSemanalRoutes(app: Express) {
  app.get("/api/reports/semanal", async (req, res) => {
    try {
      const ate = (typeof req.query.ate === "string" && req.query.ate) || hojeSP();
      const janelas = calcularJanelas(ate);

      // MRR Ativo é snapshot por data (fim de cada janela).
      const mrrAtivo = await calcKpi(
        (j) => mrrAtivoNaData(j.fim),
        janelas,
        "up",
      ).catch(() => montarKpi(null, null, "up"));

      // Os outros 3 retornam {valor, qtd}; preservamos qtd à parte.
      const churn = await calcKpi((j) => churnNaJanela(j).then((x) => x.valor), janelas, "down");

      let entregasPontuais: Kpi & { qtdAtual: number | null; qtdAnterior: number | null };
      try {
        const [a, b] = await Promise.all([
          entregasPontuaisNaJanela(janelas.atual),
          entregasPontuaisNaJanela(janelas.anterior),
        ]);
        entregasPontuais = { ...montarKpi(a.valor, b.valor, "up"), qtdAtual: a.qtd, qtdAnterior: b.qtd };
      } catch (e) {
        console.error("[reports/semanal] entregasPontuais falhou:", e);
        entregasPontuais = { ...montarKpi(null, null, "up"), qtdAtual: null, qtdAnterior: null };
      }

      let churnPontual: Kpi & { qtdAtual: number | null; qtdAnterior: number | null };
      try {
        const [a, b] = await Promise.all([
          churnPontualNaJanela(janelas.atual),
          churnPontualNaJanela(janelas.anterior),
        ]);
        churnPontual = { ...montarKpi(a.valor, b.valor, "down"), qtdAtual: a.qtd, qtdAnterior: b.qtd };
      } catch (e) {
        console.error("[reports/semanal] churnPontual falhou:", e);
        churnPontual = { ...montarKpi(null, null, "down"), qtdAtual: null, qtdAnterior: null };
      }

      res.json({
        periodo: janelas,
        kpis: { mrrAtivo, churn, entregasPontuais, churnPontual },
      });
    } catch (e: any) {
      console.error("[reports/semanal] erro geral:", e);
      res.status(500).json({ error: "Falha ao montar o reporte semanal", details: e?.message });
    }
  });
}
```

- [ ] **Step 2: Registrar a rota em `server/routes.ts`**

Adicionar o import junto aos outros de rotas (perto da linha 56, ao lado de `registerFechamentoSemanalRoutes`):

```ts
import { registerReportsSemanalRoutes } from "./routes/reportsSemanal";
```

E a chamada de registro na mesma região de `registerFechamentoSemanalRoutes(app);` (perto da linha 8343):

```ts
registerReportsSemanalRoutes(app);
```

- [ ] **Step 3: Type-check**

Run: `npm run check`
Expected: sem erros novos relacionados a `reportsSemanal`.

- [ ] **Step 4: Subir o dev server e validar o endpoint com dados reais**

Run (reiniciar o server — porta 3000):

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; sleep 1; npm run dev > /tmp/cortex-dev.log 2>&1 &
sleep 4
curl -s "http://localhost:3000/api/reports/semanal?ate=2026-06-25" | head -c 1200
```

Expected: JSON com `periodo.atual = {inicio:"2026-06-22", fim:"2026-06-25"}`, `periodo.anterior = {inicio:"2026-06-15", fim:"2026-06-18"}` e os 4 KPIs preenchidos. Sanity: `kpis.mrrAtivo.atual` na faixa ~R$900k–1,1M; `entregasPontuais.qtdAtual` pequeno (poucas entregas/semana). Se a chamada exigir auth e retornar 401, validar via uma rota já liberada ou logar/autenticar conforme o padrão do projeto (a rota fica sob `/api` → `isAuthenticated`).

> Nota de ambiente: o banco LOCAL pode estar 1 dia atrás (último snapshot disponível); em produção o snapshot do dia já existe. O endpoint usa `MAX(data_snapshot) <= fim`, então funciona nos dois — apenas o MRR ativo local reflete o snapshot mais recente disponível.

- [ ] **Step 5: Commit**

```bash
git add server/routes/reportsSemanal.ts server/routes.ts
git commit -m "feat(reporte-semanal): endpoint GET /api/reports/semanal (4 KPIs)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Frontend — tipos + hook de fetch

**Files:**
- Create: `client/src/pages/relatorio-semanal/types.ts`
- Create: `client/src/pages/relatorio-semanal/useRelatorioSemanal.ts`

**Interfaces:**
- Consumes (Task 2): resposta de `GET /api/reports/semanal`.
- Produces:
  - `interface KpiData { atual: number | null; anterior: number | null; variacaoPct: number | null; betterDirection: "up" | "down" }`
  - `interface KpiComQtd extends KpiData { qtdAtual: number | null; qtdAnterior: number | null }`
  - `interface RelatorioSemanalData { periodo: {...}; kpis: { mrrAtivo: KpiData; churn: KpiData; entregasPontuais: KpiComQtd; churnPontual: KpiComQtd } }`
  - `useRelatorioSemanal(ate?: string)` → React Query result tipado.

- [ ] **Step 1: Criar os tipos**

Create `client/src/pages/relatorio-semanal/types.ts`:

```ts
export interface KpiData {
  atual: number | null;
  anterior: number | null;
  variacaoPct: number | null;
  betterDirection: "up" | "down";
}

export interface KpiComQtd extends KpiData {
  qtdAtual: number | null;
  qtdAnterior: number | null;
}

export interface PeriodoJanela {
  inicio: string;
  fim: string;
}

export interface RelatorioSemanalData {
  periodo: { atual: PeriodoJanela; anterior: PeriodoJanela };
  kpis: {
    mrrAtivo: KpiData;
    churn: KpiData;
    entregasPontuais: KpiComQtd;
    churnPontual: KpiComQtd;
  };
}
```

- [ ] **Step 2: Criar o hook**

Create `client/src/pages/relatorio-semanal/useRelatorioSemanal.ts` (mesmo padrão de `useRelatorioMensal`):

```ts
import { useQuery } from "@tanstack/react-query";
import type { RelatorioSemanalData } from "./types";

export function useRelatorioSemanal(ate?: string) {
  const qs = ate ? `?ate=${ate}` : "";
  return useQuery<RelatorioSemanalData>({
    queryKey: ["/api/reports/semanal", ate ?? "hoje"],
    queryFn: async () => {
      const res = await fetch(`/api/reports/semanal${qs}`, { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.details || body.error || `Erro ${res.status}`);
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 3: Type-check**

Run: `npm run check`
Expected: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/relatorio-semanal/types.ts client/src/pages/relatorio-semanal/useRelatorioSemanal.ts
git commit -m "feat(reporte-semanal): tipos e hook de fetch do frontend

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 4: Frontend — página, cards, rota e menu

**Files:**
- Create: `client/src/pages/RelatorioSemanal.tsx`
- Modify: `client/src/App.tsx` (import lazy ~136; `<Route>` ~432)
- Modify: `shared/nav-config.ts` (mapa de rota ~319; item de menu ~584)

**Interfaces:**
- Consumes (Task 3): `useRelatorioSemanal`, `RelatorioSemanalData`, `KpiData`, `KpiComQtd`.

- [ ] **Step 1: Criar a página com os 4 cards**

Create `client/src/pages/RelatorioSemanal.tsx`:

```tsx
import { TrendingUp, TrendingDown, Package, AlertTriangle, ArrowUp, ArrowDown } from "lucide-react";
import { useRelatorioSemanal } from "./relatorio-semanal/useRelatorioSemanal";
import type { KpiData } from "./relatorio-semanal/types";

const fmtBRL = (v: number | null) =>
  v == null
    ? "—"
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtDiaMes = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

// Cor semântica: positivo é bom quando betterDirection==="up"; ruim quando "down".
function corVariacao(pct: number | null, dir: "up" | "down"): string {
  if (pct == null || pct === 0) return "text-gray-400 dark:text-zinc-500";
  const positivo = pct > 0;
  const bom = dir === "up" ? positivo : !positivo;
  return bom ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
}

function KpiCard({
  label,
  icon: Icon,
  valorFormatado,
  kpi,
  refFormatado,
  subValor,
}: {
  label: string;
  icon: typeof TrendingUp;
  valorFormatado: string;
  kpi: KpiData;
  refFormatado: string;
  subValor?: string;
}) {
  const pct = kpi.variacaoPct;
  const Seta = pct != null && pct < 0 ? ArrowDown : ArrowUp;
  const pctTxt =
    pct == null ? "—" : `${pct > 0 ? "+" : ""}${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-zinc-400">
        <Icon className="h-4 w-4" />
        <span className="uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-3 text-3xl font-bold text-gray-900 dark:text-white">{valorFormatado}</div>
      {subValor && <div className="mt-0.5 text-sm text-gray-500 dark:text-zinc-400">{subValor}</div>}
      <div className="mt-2 flex items-center gap-2 text-sm">
        <span className={`flex items-center gap-0.5 font-semibold ${corVariacao(pct, kpi.betterDirection)}`}>
          {pct != null && <Seta className="h-3.5 w-3.5" />}
          {pctTxt}
        </span>
        <span className="text-gray-400 dark:text-zinc-500">vs {refFormatado}</span>
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
      <div className="h-4 w-28 animate-pulse rounded bg-gray-200 dark:bg-zinc-800" />
      <div className="mt-4 h-8 w-40 animate-pulse rounded bg-gray-200 dark:bg-zinc-800" />
      <div className="mt-3 h-4 w-32 animate-pulse rounded bg-gray-200 dark:bg-zinc-800" />
    </div>
  );
}

export default function RelatorioSemanal() {
  const { data, isLoading, error } = useRelatorioSemanal();

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reporte Semanal</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Desempenho da empresa na semana</p>
        </div>
        {data && (
          <div className="text-sm text-gray-500 dark:text-zinc-400">
            Semana {fmtDiaMes(data.periodo.atual.inicio)}–{fmtDiaMes(data.periodo.atual.fim)}
            <span className="mx-1">·</span>
            vs {fmtDiaMes(data.periodo.anterior.inicio)}–{fmtDiaMes(data.periodo.anterior.fim)}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          Não foi possível carregar o reporte: {error.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {isLoading || !data ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <KpiCard
              label="MRR Ativo"
              icon={TrendingUp}
              valorFormatado={fmtBRL(data.kpis.mrrAtivo.atual)}
              kpi={data.kpis.mrrAtivo}
              refFormatado={fmtBRL(data.kpis.mrrAtivo.anterior)}
            />
            <KpiCard
              label="Churn"
              icon={TrendingDown}
              valorFormatado={fmtBRL(data.kpis.churn.atual)}
              kpi={data.kpis.churn}
              refFormatado={fmtBRL(data.kpis.churn.anterior)}
            />
            <KpiCard
              label="Entregas Pontuais"
              icon={Package}
              valorFormatado={fmtBRL(data.kpis.entregasPontuais.atual)}
              kpi={data.kpis.entregasPontuais}
              refFormatado={fmtBRL(data.kpis.entregasPontuais.anterior)}
              subValor={
                data.kpis.entregasPontuais.qtdAtual != null
                  ? `${data.kpis.entregasPontuais.qtdAtual} entregas`
                  : undefined
              }
            />
            <KpiCard
              label="Churn Pontual"
              icon={AlertTriangle}
              valorFormatado={fmtBRL(data.kpis.churnPontual.atual)}
              kpi={data.kpis.churnPontual}
              refFormatado={fmtBRL(data.kpis.churnPontual.anterior)}
              subValor={
                data.kpis.churnPontual.qtdAtual != null
                  ? `${data.kpis.churnPontual.qtdAtual} cancelamentos`
                  : undefined
              }
            />
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Registrar a rota em `client/src/App.tsx`**

Junto aos outros lazy imports (perto da linha 136, ao lado de `RelatorioMensal`):

```tsx
const RelatorioSemanal = lazyWithRetry(() => import("@/pages/RelatorioSemanal"));
```

Junto às outras `<Route>` (perto da linha 432, ao lado de `/reports/mensal`):

```tsx
<Route path="/reports/semanal">{() => <ProtectedRoute path="/reports/semanal" component={RelatorioSemanal} />}</Route>
```

- [ ] **Step 3: Adicionar ao menu em `shared/nav-config.ts`**

No mapa `permissionsToRoutes` (logo após a linha `'/reports/mensal': PERMISSION_KEYS.REPORTS.MENSAL,` — ~linha 319), reusando a permissão de Reportes:

```ts
'/reports/semanal': PERMISSION_KEYS.REPORTS.MENSAL,
```

No item de menu (logo após o objeto `{ title: 'Reporte Mensal', url: '/reports/mensal', ... }` — ~linha 584):

```ts
{ title: 'Reporte Semanal', url: '/reports/semanal', icon: 'CalendarRange', permissionKey: PERMISSION_KEYS.REPORTS.MENSAL },
```

> Verificar que o ícone `'CalendarRange'` é resolvido pelo `getIcon` do sidebar (lucide-react o exporta). Se o projeto usar um mapa de ícones restrito e `CalendarRange` não existir lá, usar `'CalendarDays'` (já em uso no menu).

- [ ] **Step 4: Type-check**

Run: `npm run check`
Expected: sem erros novos.

- [ ] **Step 5: Validar no browser (dark + light)**

Reiniciar o dev server e abrir a tela:

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; sleep 1; npm run dev > /tmp/cortex-dev.log 2>&1 &
sleep 4
```

Abrir `http://localhost:3000/reports/semanal`. Conferir:
- Os 4 cards aparecem em grid 2×2 (desktop) com valores reais e o período no header.
- Variação: Churn/Churn Pontual subindo ficam **vermelhos**; MRR/Entregas subindo ficam **verdes** (cor pela direção, não pelo sinal).
- Alternar tema (toggle do `ThemeProvider`) e confirmar legibilidade em **dark e light**.
- O item "Reporte Semanal" aparece no menu lateral, na seção de Reportes, e navega para a tela.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/RelatorioSemanal.tsx client/src/App.tsx shared/nav-config.ts
git commit -m "feat(reporte-semanal): tela /reports/semanal com 4 KPIs e item de menu

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Self-Review (preenchido)

**Spec coverage:**
- 4 KPIs (MRR Ativo, Churn, Entregas Pontuais, Churn Pontual) → Task 2 (queries) + Task 4 (cards). ✓
- Janela seg→hoje vs mesmo trecho da semana anterior → Task 1 (`calcularJanelas`) + testes. ✓
- Variação semântica por direção → Task 1 (`betterDirection`) + Task 4 (`corVariacao`). ✓
- Endpoint consolidado → Task 2. ✓
- Tolerância a falha por KPI + skeleton + `—` → Task 2 (`calcKpi`/try-catch) + Task 4 (`CardSkeleton`, `fmtBRL(null)`). ✓
- Dark/light mode → Task 4 (classes `dark:`). ✓
- Nova rota acessível pelo menu → Task 4 (App.tsx + nav-config). ✓

**Placeholder scan:** sem TBD/TODO; todas as queries, tipos e código estão completos. ✓

**Type consistency:** `KpiData`/`KpiComQtd`/`betterDirection`/`variacaoPct` consistentes entre Task 1 (backend), Task 3 (frontend types) e Task 4 (consumo). Nomes de queries e colunas conferidos contra schema real (`valor_r` na view, `valorr`/`valorp` em cup_*, `data_snapshot`, `data_entrega`, `data_solicitacao_encerramento`). ✓

## Riscos conhecidos (decisões registradas)

- **Churn Pontual** usa um proxy datável (contratos de serviço de entrega com status de cancelamento e `data_solicitacao_encerramento` na janela), **não** a lógica completa de drop-off entre entregas da tela `/dashboard/churn-pontorrente` (que não tem filtro por data de churn). É a definição mais simples e datável para um KPI semanal; pode ser refinada numa v2 se a reunião pedir.
- **MRR Ativo** depende do snapshot diário de `cup_data_hist`. Em dias com carga duplicada (ex: 2026-06-20) o `DISTINCT ON (id_subtask)` protege a soma; gaps de fim de semana são absorvidos pelo `MAX(data_snapshot) <= fim`.
- **Semana corrente incompleta:** os números crescem ao longo da semana — esperado; a comparação com o mesmo trecho da semana anterior mantém a leitura justa.
