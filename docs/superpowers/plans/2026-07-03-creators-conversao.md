# Creators Conversão (Pontual → Recorrente) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tela auxiliar `/creators-conversao` que lista os clientes pontuais de Creators (default jan–jun/2026) que se tornaram recorrentes, com resumo de conversão.

**Architecture:** Um endpoint Express novo (`server/routes/creatorsConversao.ts`, padrão `registerXxxRoutes(app, db)` com `db.execute(sql\`...\`)` do Drizzle) + uma página React única (`client/src/pages/CreatorsConversao.tsx`) consumindo via React Query. Registro de rota/permissão em `shared/nav-config.ts` e `client/src/App.tsx`.

**Tech Stack:** Express + Drizzle (`sql` tag), Vitest + Supertest (backend), React + TanStack Query + shadcn/ui + Tailwind (frontend).

**Spec:** `docs/superpowers/specs/2026-07-03-creators-conversao-design.md`

## Global Constraints

- Filtro creators: `(produto ILIKE '%creator%' OR servico ILIKE '%creator%')` — `%creator%` SEM "s" (capta compostos).
- Pontual = `valorp > 0`; recorrente = `valorr > 0`; datas por `data_criado` de `"Clickup".cup_contratos`.
- Conversão = primeiro recorrente estritamente **posterior** (`>`) ao primeiro pontual do período.
- Grão = cliente (`id_task`); nome via `"Clickup".cup_clientes.task_id`.
- Período default: `de=2026-01`, `ate=2026-06`; params validados com regex `/^\d{4}-\d{2}$/` → 400 se inválidos (equivale à intenção do spec; segue o padrão de `creatorsModelo.ts` em vez de Zod).
- Dark/light mode obrigatório em toda classe de cor (`dark:` variant).
- Commits em Conventional Commits com `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`.
- NÃO rodar `npm run dev` nem matar a porta 3000 em subagentes — validar com `npx tsc --noEmit` e `npx vitest run <arquivo>`. O restart do server é feito pelo orquestrador na Task 4.
- Números de referência validados em PROD (2026-07-03, jan–jun/2026): 181 pontuais, 9 convertidos, 3 p/ Creators Rec. (Doctors Group, Creamy, Meliuz). O banco LOCAL pode divergir (espelho parcial) — na validação manual, comparar com query no banco local, não com estes números.

---

### Task 1: Backend — endpoint `GET /api/creators-conversao`

**Files:**
- Create: `server/routes/creatorsConversao.ts`
- Create: `server/routes/creatorsConversao.test.ts`
- Modify: `server/routes.ts` (import ~linha 98, registro ~linha 8609)

**Interfaces:**
- Consumes: `db.execute(sql\`...\`)` (Drizzle, pool de `server/db.ts`), `Express` app.
- Produces: `registerCreatorsConversaoRoutes(app: Express, db: any)` e o payload JSON:

```ts
// Shape da resposta (o frontend da Task 3 tipa exatamente isto)
{
  resumo: {
    totalPontuais: number;       // clientes com pontual de Creators criado no período
    convertidos: number;         // quantos viraram recorrentes depois (qualquer produto)
    convertidosCreators: number; // subconjunto: recorrente em Creators
    taxa: number;                // convertidos / totalPontuais (0 se base vazia)
  },
  clientes: Array<{
    idTask: string;
    nome: string | null;
    nPontuais: number;
    valorPontual: number;
    primeiroPontual: string;      // 'YYYY-MM-DD'
    primeiroRecorrente: string;   // 'YYYY-MM-DD'
    diasAteConverter: number;
    mrr: number;                  // soma do valorr dos recorrentes do cliente
    servicosRecorrentes: string;  // 'Serviço A | Serviço B'
    recEmCreators: boolean;
  }>
}
```

- [ ] **Step 1: Escrever os testes que falham**

Criar `server/routes/creatorsConversao.test.ts`:

```ts
// server/routes/creatorsConversao.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const mockExecute = vi.fn();

import { registerCreatorsConversaoRoutes } from "./creatorsConversao";

function makeApp() {
  const app = express();
  app.use((req, _res, next) => { (req as any).user = { email: "t@t.com" }; next(); });
  registerCreatorsConversaoRoutes(app, { execute: mockExecute } as any);
  return app;
}

beforeEach(() => vi.clearAllMocks());

// ORDEM dos executes no handler: 1º convertidos, 2º total de pontuais.
const convertidosRows = [
  {
    id_task: "T1", nome: "Creamy", n_pontuais: 3, valor_pontual: "32997",
    primeiro_pontual: "2026-04-08", primeiro_rec: "2026-06-23",
    dias_ate_converter: 76, mrr: "150000",
    servicos_rec: "Creators Recorrente - Enterprise", rec_em_creators: true,
  },
  {
    id_task: "T2", nome: "Organoils", n_pontuais: 1, valor_pontual: "6000",
    primeiro_pontual: "2026-01-15", primeiro_rec: "2026-03-17",
    dias_ate_converter: 61, mrr: "5097",
    servicos_rec: "Gestão de performance - Starter", rec_em_creators: false,
  },
];

describe("GET /api/creators-conversao", () => {
  it("retorna resumo e clientes convertidos mapeados", async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: convertidosRows })
      .mockResolvedValueOnce({ rows: [{ total: 181 }] });
    const res = await request(makeApp()).get("/api/creators-conversao");
    expect(res.status).toBe(200);
    expect(res.body.resumo.totalPontuais).toBe(181);
    expect(res.body.resumo.convertidos).toBe(2);
    expect(res.body.resumo.convertidosCreators).toBe(1);
    expect(res.body.resumo.taxa).toBeCloseTo(2 / 181, 5);
    expect(res.body.clientes).toHaveLength(2);
    expect(res.body.clientes[0]).toEqual({
      idTask: "T1", nome: "Creamy", nPontuais: 3, valorPontual: 32997,
      primeiroPontual: "2026-04-08", primeiroRecorrente: "2026-06-23",
      diasAteConverter: 76, mrr: 150000,
      servicosRecorrentes: "Creators Recorrente - Enterprise", recEmCreators: true,
    });
  });

  it("base vazia → taxa 0 (sem divisão por zero)", async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: 0 }] });
    const res = await request(makeApp()).get("/api/creators-conversao");
    expect(res.status).toBe(200);
    expect(res.body.resumo.taxa).toBe(0);
    expect(res.body.clientes).toEqual([]);
  });

  it("params de período inválidos → 400", async () => {
    const res = await request(makeApp()).get("/api/creators-conversao?de=2026-1&ate=x");
    expect(res.status).toBe(400);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("falha de banco → 500", async () => {
    mockExecute.mockRejectedValueOnce(new Error("db down"));
    const res = await request(makeApp()).get("/api/creators-conversao");
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run server/routes/creatorsConversao.test.ts`
Expected: FAIL — `Cannot find module './creatorsConversao'` (ou equivalente).

- [ ] **Step 3: Implementar a rota**

Criar `server/routes/creatorsConversao.ts`:

```ts
// server/routes/creatorsConversao.ts
// Tela auxiliar: clientes pontuais de Creators que viraram recorrentes.
// Spec: docs/superpowers/specs/2026-07-03-creators-conversao-design.md
import type { Express } from "express";
import { sql } from "drizzle-orm";

const PERIODO_RE = /^\d{4}-\d{2}$/;

/** Primeiro dia do mês seguinte a um 'YYYY-MM' (limite exclusivo do período). */
function inicioMesSeguinte(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

export function registerCreatorsConversaoRoutes(app: Express, db: any) {
  app.get("/api/creators-conversao", async (req, res) => {
    const de = (req.query.de as string) || "2026-01";
    const ate = (req.query.ate as string) || "2026-06";
    if (!PERIODO_RE.test(de) || !PERIODO_RE.test(ate)) {
      return res.status(400).json({ error: "Período inválido: use de/ate no formato YYYY-MM" });
    }
    const deDate = `${de}-01`;
    const ateDate = inicioMesSeguinte(ate);

    try {
      // Convertidos: clientes com pontual de Creators criado no período cujo
      // PRIMEIRO recorrente (qualquer produto) veio depois do primeiro pontual.
      // Cliente que já era recorrente antes não conta (primeiro_rec < primeiro_pontual).
      const convertidos = (await db.execute(sql`
        WITH pontual AS (
          SELECT c.id_task,
                 MIN(c.data_criado::date) AS primeiro_pontual,
                 COUNT(*)::int AS n_pontuais,
                 SUM(c.valorp::numeric) AS valor_pontual
          FROM "Clickup".cup_contratos c
          WHERE (c.produto ILIKE '%creator%' OR c.servico ILIKE '%creator%')
            AND c.valorp > 0
            AND c.data_criado >= ${deDate} AND c.data_criado < ${ateDate}
          GROUP BY c.id_task
        ),
        rec AS (
          SELECT c.id_task,
                 MIN(c.data_criado::date) AS primeiro_rec,
                 BOOL_OR(c.produto ILIKE '%creator%' OR c.servico ILIKE '%creator%') AS rec_em_creators,
                 SUM(c.valorr::numeric) AS mrr,
                 STRING_AGG(DISTINCT c.servico, ' | ') AS servicos_rec
          FROM "Clickup".cup_contratos c
          WHERE c.valorr > 0
          GROUP BY c.id_task
        )
        SELECT p.id_task, cl.nome, p.n_pontuais, p.valor_pontual,
               to_char(p.primeiro_pontual, 'YYYY-MM-DD') AS primeiro_pontual,
               to_char(r.primeiro_rec, 'YYYY-MM-DD') AS primeiro_rec,
               (r.primeiro_rec - p.primeiro_pontual)::int AS dias_ate_converter,
               r.mrr, r.servicos_rec, r.rec_em_creators
        FROM pontual p
        JOIN rec r ON r.id_task = p.id_task AND r.primeiro_rec > p.primeiro_pontual
        LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = p.id_task
        ORDER BY r.primeiro_rec DESC
      `)).rows as any[];

      const totalRow = (await db.execute(sql`
        SELECT COUNT(*)::int AS total FROM (
          SELECT c.id_task
          FROM "Clickup".cup_contratos c
          WHERE (c.produto ILIKE '%creator%' OR c.servico ILIKE '%creator%')
            AND c.valorp > 0
            AND c.data_criado >= ${deDate} AND c.data_criado < ${ateDate}
          GROUP BY c.id_task
        ) t
      `)).rows as any[];

      const totalPontuais = Number(totalRow[0]?.total ?? 0);
      const clientes = convertidos.map((r) => ({
        idTask: r.id_task,
        nome: r.nome ?? null,
        nPontuais: Number(r.n_pontuais ?? 0),
        valorPontual: Number(r.valor_pontual ?? 0),
        primeiroPontual: r.primeiro_pontual,
        primeiroRecorrente: r.primeiro_rec,
        diasAteConverter: Number(r.dias_ate_converter ?? 0),
        mrr: Number(r.mrr ?? 0),
        servicosRecorrentes: r.servicos_rec ?? "",
        recEmCreators: !!r.rec_em_creators,
      }));

      res.json({
        resumo: {
          totalPontuais,
          convertidos: clientes.length,
          convertidosCreators: clientes.filter((c) => c.recEmCreators).length,
          taxa: totalPontuais > 0 ? clientes.length / totalPontuais : 0,
        },
        clientes,
      });
    } catch (error) {
      console.error("[api] Error fetching creators-conversao:", error);
      res.status(500).json({ error: "Failed to fetch creators-conversao" });
    }
  });
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run server/routes/creatorsConversao.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Registrar a rota em `server/routes.ts`**

Junto aos imports das outras rotas creators (~linha 98):

```ts
import { registerCreatorsConversaoRoutes } from "./routes/creatorsConversao";
```

Junto aos registros (~linha 8609, após `registerCreatorsModeloRoutes(app, db);`):

```ts
  registerCreatorsConversaoRoutes(app, db);
```

- [ ] **Step 6: Typecheck e commit**

Run: `npx tsc --noEmit` — Expected: sem erros novos (comparar com estado anterior se o repo já tiver erros pré-existentes).

```bash
git add server/routes/creatorsConversao.ts server/routes/creatorsConversao.test.ts server/routes.ts
git commit -m "feat(creators-conversao): endpoint de conversão pontual → recorrente

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Rota, permissão e menu (nav-config + App.tsx)

**Files:**
- Modify: `shared/nav-config.ts` (4 pontos: PERMISSION_KEYS ~linha 53, ROUTE_PERMISSIONS ~linha 258, NAV_CONFIG grupo Gestão ~linha 501, labels ~linha 744)
- Modify: `client/src/App.tsx` (lazy import ~linha 181, `<Route>` ~linha 340)

**Interfaces:**
- Consumes: página `@/pages/CreatorsConversao` (criada na Task 3 — o import lazy pode ser adicionado aqui apontando para o arquivo que a Task 3 cria; se as tasks rodarem em ordem 2→3, o typecheck desta task acusará módulo ausente. Por isso os steps abaixo criam um placeholder mínimo).
- Produces: rota `/creators-conversao` protegida pela permission key `gestao.creators_conversao`, visível no grupo Gestão.

- [ ] **Step 1: Criar página placeholder (evita quebra de build antes da Task 3)**

Criar `client/src/pages/CreatorsConversao.tsx`:

```tsx
export default function CreatorsConversao() {
  return null; // Task 3 substitui pela tela real
}
```

- [ ] **Step 2: Adicionar permission key em `shared/nav-config.ts`**

Em `PERMISSION_KEYS.GESTAO`, após `CREATORS_PONTUAL: 'gestao.creators_pontual',`:

```ts
    CREATORS_CONVERSAO: 'gestao.creators_conversao',
```

- [ ] **Step 3: Adicionar route permission**

Em `ROUTE_PERMISSIONS`, após `'/creators-pontual': PERMISSION_KEYS.GESTAO.CREATORS_PONTUAL,`:

```ts
  '/creators-conversao': PERMISSION_KEYS.GESTAO.CREATORS_CONVERSAO,
```

- [ ] **Step 4: Adicionar item no grupo Gestão do NAV_CONFIG**

Após a linha `{ title: 'Creators Pontual', url: '/creators-pontual', icon: 'Clapperboard', permissionKey: PERMISSION_KEYS.GESTAO.CREATORS_PONTUAL },`:

```ts
        { title: 'Creators Conversão', url: '/creators-conversao', icon: 'Clapperboard', permissionKey: PERMISSION_KEYS.GESTAO.CREATORS_CONVERSAO },
```

- [ ] **Step 5: Adicionar label da permissão**

Após `[PERMISSION_KEYS.GESTAO.CREATORS_PONTUAL]: 'Creators Pontual',`:

```ts
  [PERMISSION_KEYS.GESTAO.CREATORS_CONVERSAO]: 'Creators Conversão',
```

- [ ] **Step 6: Registrar rota no `client/src/App.tsx`**

Junto aos lazy imports (~linha 181, após `CreatorsPontual`):

```ts
const CreatorsConversao = lazyWithRetry(() => import("@/pages/CreatorsConversao"));
```

Junto às rotas (~linha 340, após a rota `/creators-pontual`):

```tsx
      <Route path="/creators-conversao">{() => <ProtectedRoute path="/creators-conversao" component={CreatorsConversao} />}</Route>
```

- [ ] **Step 7: Typecheck e commit**

Run: `npx tsc --noEmit` — Expected: sem erros novos.

```bash
git add shared/nav-config.ts client/src/App.tsx client/src/pages/CreatorsConversao.tsx
git commit -m "feat(creators-conversao): rota, permissão e item de menu no grupo Gestão

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Frontend — página `CreatorsConversao.tsx`

**Files:**
- Modify: `client/src/pages/CreatorsConversao.tsx` (substitui o placeholder da Task 2)

**Interfaces:**
- Consumes: `GET /api/creators-conversao?de=YYYY-MM&ate=YYYY-MM` (payload exato definido na Task 1); `fetchJson`/`buildUrl` de `@/components/lt-ltv-churn/utils`; `formatCurrencyNoDecimals` de `@/lib/utils`; componentes shadcn `Card`, `Badge`, `Switch`, `Label`, `Select*`, `Table*`; `useSetPageInfo` de `@/contexts/PageContext`.
- Produces: página completa da rota `/creators-conversao`.

- [ ] **Step 1: Implementar a página completa**

Substituir o conteúdo de `client/src/pages/CreatorsConversao.tsx` por:

```tsx
import { useState } from "react";
import type { ElementType } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Repeat, Clapperboard, Percent, ExternalLink } from "lucide-react";
import { useSetPageInfo } from "@/contexts/PageContext";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { fetchJson, buildUrl } from "@/components/lt-ltv-churn/utils";

interface ClienteConvertido {
  idTask: string;
  nome: string | null;
  nPontuais: number;
  valorPontual: number;
  primeiroPontual: string;
  primeiroRecorrente: string;
  diasAteConverter: number;
  mrr: number;
  servicosRecorrentes: string;
  recEmCreators: boolean;
}

interface ConversaoPayload {
  resumo: {
    totalPontuais: number;
    convertidos: number;
    convertidosCreators: number;
    taxa: number;
  };
  clientes: ClienteConvertido[];
}

const MESES_LABEL = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Meses selecionáveis: jan/2025 até o mês atual. */
function mesesDisponiveis(): string[] {
  const out: string[] = [];
  const now = new Date();
  const fim = now.getFullYear() * 12 + now.getMonth();
  for (let k = 2025 * 12; k <= fim; k++) {
    out.push(`${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, "0")}`);
  }
  return out;
}

function fmtMes(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MESES_LABEL[Number(m) - 1]}/${y}`;
}

function fmtData(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function Kpi({
  icon: Icon, label, value, sub,
}: { icon: ElementType; label: string; value: string; sub?: string }) {
  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-zinc-400">{label}</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
          {sub && <p className="text-xs text-gray-400 dark:text-zinc-500">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function CreatorsConversao() {
  useSetPageInfo("Creators Conversão", "Clientes pontuais de Creators que se tornaram recorrentes");
  const [de, setDe] = useState("2026-01");
  const [ate, setAte] = useState("2026-06");
  const [soCreators, setSoCreators] = useState(false);
  const meses = mesesDisponiveis();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/creators-conversao", de, ate],
    queryFn: () => fetchJson<ConversaoPayload>(buildUrl("/api/creators-conversao", { de, ate })),
  });

  const clientes = (data?.clientes ?? []).filter((c) => !soCreators || c.recEmCreators);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-gray-500 dark:text-zinc-400">Pontual criado de</Label>
          <Select value={de} onValueChange={setDe}>
            <SelectTrigger className="w-[120px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {meses.map((m) => (
                <SelectItem key={m} value={m}>{fmtMes(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label className="text-xs text-gray-500 dark:text-zinc-400">até</Label>
          <Select value={ate} onValueChange={setAte}>
            <SelectTrigger className="w-[120px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {meses.map((m) => (
                <SelectItem key={m} value={m}>{fmtMes(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="so-creators" checked={soCreators} onCheckedChange={setSoCreators} />
          <Label htmlFor="so-creators" className="text-xs text-gray-600 dark:text-zinc-400">
            Só Creators Rec.
          </Label>
        </div>
      </div>

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
      ) : isError || !data ? (
        <p className="text-sm text-red-600 dark:text-red-400">Erro ao carregar os dados.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon={Users} label="Pontuais no período" value={String(data.resumo.totalPontuais)} />
            <Kpi icon={Repeat} label="Converteram p/ recorrente" value={String(data.resumo.convertidos)} />
            <Kpi icon={Clapperboard} label="p/ Creators Recorrente" value={String(data.resumo.convertidosCreators)} />
            <Kpi icon={Percent} label="Taxa de conversão" value={`${(data.resumo.taxa * 100).toFixed(1)}%`} />
          </div>

          <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
            <CardContent className="p-0">
              {clientes.length === 0 ? (
                <p className="p-6 text-sm text-gray-500 dark:text-zinc-400">
                  Nenhuma conversão no período.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-200 dark:border-zinc-700/50">
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Pontuais</TableHead>
                      <TableHead className="text-right">Valor pontual</TableHead>
                      <TableHead>1º pontual</TableHead>
                      <TableHead>Conversão</TableHead>
                      <TableHead className="text-right">Dias até converter</TableHead>
                      <TableHead className="text-right">MRR contratado</TableHead>
                      <TableHead>Serviço recorrente</TableHead>
                      <TableHead>Destino</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientes.map((c) => (
                      <TableRow key={c.idTask} className="border-gray-200 dark:border-zinc-700/50">
                        <TableCell className="font-medium text-gray-900 dark:text-white">
                          <a
                            href={`https://app.clickup.com/t/${c.idTask}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            {c.nome ?? c.idTask}
                            <ExternalLink className="h-3 w-3 text-gray-400 dark:text-zinc-500" />
                          </a>
                        </TableCell>
                        <TableCell className="text-right">{c.nPontuais}</TableCell>
                        <TableCell className="text-right">{formatCurrencyNoDecimals(c.valorPontual)}</TableCell>
                        <TableCell>{fmtData(c.primeiroPontual)}</TableCell>
                        <TableCell>{fmtData(c.primeiroRecorrente)}</TableCell>
                        <TableCell className="text-right">{c.diasAteConverter}d</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrencyNoDecimals(c.mrr)}</TableCell>
                        <TableCell className="max-w-[280px] truncate text-gray-600 dark:text-zinc-400" title={c.servicosRecorrentes}>
                          {c.servicosRecorrentes}
                        </TableCell>
                        <TableCell>
                          {c.recEmCreators ? (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400">
                              Creators Rec.
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-gray-600 dark:text-zinc-400">
                              Outro produto
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` — Expected: sem erros novos. NÃO rodar `npm run dev` nesta task.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/CreatorsConversao.tsx
git commit -m "feat(creators-conversao): página com cards de resumo e tabela de convertidos

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 4: Validação local no browser (orquestrador — NÃO delegar a subagente)

**Files:** nenhum (validação manual).

**Interfaces:**
- Consumes: tela `/creators-conversao` completa e endpoint registrado (Tasks 1–3).
- Produces: confirmação visual (dark + light) e numérica (tela × query no banco local).

- [ ] **Step 1: Reiniciar o dev server** (backend novo exige restart; tsx sem watch)

```bash
lsof -ti:3000 | xargs kill -9; npm run dev
```

- [ ] **Step 2: Obter os números esperados do banco LOCAL** (espelho parcial — não usar os números de prod como gabarito)

```bash
PGPASSWORD=dev123 psql -h localhost -U cortex -d cortex_dev -c "
WITH pontual AS (
  SELECT c.id_task FROM \"Clickup\".cup_contratos c
  WHERE (c.produto ILIKE '%creator%' OR c.servico ILIKE '%creator%')
    AND c.valorp > 0 AND c.data_criado >= '2026-01-01' AND c.data_criado < '2026-07-01'
  GROUP BY c.id_task
),
rec AS (
  SELECT c.id_task, MIN(c.data_criado::date) AS primeiro_rec,
         BOOL_OR(c.produto ILIKE '%creator%' OR c.servico ILIKE '%creator%') AS em_creators
  FROM \"Clickup\".cup_contratos c WHERE c.valorr > 0 GROUP BY c.id_task
),
p2 AS (
  SELECT c.id_task, MIN(c.data_criado::date) AS primeiro_pontual
  FROM \"Clickup\".cup_contratos c
  WHERE (c.produto ILIKE '%creator%' OR c.servico ILIKE '%creator%')
    AND c.valorp > 0 AND c.data_criado >= '2026-01-01' AND c.data_criado < '2026-07-01'
  GROUP BY c.id_task
)
SELECT (SELECT COUNT(*) FROM pontual) AS total,
       COUNT(*) FILTER (WHERE r.primeiro_rec > p.primeiro_pontual) AS convertidos,
       COUNT(*) FILTER (WHERE r.primeiro_rec > p.primeiro_pontual AND r.em_creators) AS em_creators
FROM p2 p LEFT JOIN rec r USING (id_task);"
```

- [ ] **Step 3: Validar no browser** (Chrome via MCP ou manual): abrir `http://localhost:3000/creators-conversao` e conferir:
  - Cards batem com a query do Step 2.
  - Tabela ordenada por conversão mais recente; badges corretos; links do ClickUp abrem a task.
  - Toggle "Só Creators Rec." filtra a tabela sem alterar os cards.
  - Mudar o período (ex.: `abr–jun/2026`) refaz a busca e muda os números.
  - Dark mode E light mode legíveis (alternar tema no sidebar).
  - Estado vazio: escolher período sem conversões (ex.: `jan–fev/2025`) → "Nenhuma conversão no período."

- [ ] **Step 4: Push e workflow pós-conclusão**

```bash
git push
```

Seguir o workflow pós-task do projeto (git-autopush já coberto pelos commits; Obsidian/chamado somente se houver TASK-N/chamado associado — esta demanda veio direto do usuário, sem chamado).

---

## Self-Review (executado na escrita do plano)

- **Cobertura do spec:** régua/definições → Task 1 (SQL); endpoint+validação+erros → Task 1; navegação/permissão → Task 2; cards/tabela/filtros/badge/dark-light/estados → Task 3; testes mínimos → Task 1 Step 1; validação manual → Task 4. Fora de escopo respeitado (sem drill-down, sem CSV, sem lista de não-convertidos).
- **Placeholders:** nenhum — todo step de código tem o código completo.
- **Consistência de tipos:** payload da Task 1 (`resumo`/`clientes` camelCase) = interfaces da Task 3; nome do register igual em Task 1 Steps 3/5; placeholder da Task 2 é substituído integralmente na Task 3.
- **Desvio consciente do spec:** validação com regex (padrão do codebase) em vez de Zod — mesmo comportamento (400 em params inválidos), registrado em Global Constraints.
