# CEO Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma tela executiva de snapshot único (`/ceo-dashboard`) com 11 KPI cards (Receita, Custos, Lucro, Saldo de Caixa, Inadimplência, NPS, CAC, LTV, Headcount, E-NPS, Receita/Cabeça), comparando realizado vs meta do BP 2026.

**Architecture:** Um endpoint consolidado `GET /api/ceo-dashboard` monta 7 KPIs a partir de **uma única** chamada a `computarBpReceitas(db)` (que já traz `linhas[]` do DRE + `metricasGerais[]`, ambos com `{orcado, realizado, atingimento}` por mês) e 3 KPIs de fontes próprias (Inadimplência via `storage.getInadimplenciaResumo()`, LTV via SQL em `vw_lt_contratos`, E-NPS via `storage.getRhNpsDashboard()`); o NPS de clientes é placeholder "em breve". A montagem final é uma função pura (`assembleCeoKpis`) testável isoladamente. O frontend faz 1 chamada e renderiza uma grade de `CeoKpiCard`.

**Tech Stack:** TypeScript, Express, Drizzle (`sql`), React + React Query, Recharts (sparkline), Tailwind (dark/light), Vitest.

## Global Constraints

- **Fonte financeira = BP 2026** (`computarBpReceitas`), nunca o Investors Report.
- **Acesso:** só `admin` ou perfil `CONTROL_TOWER` (guard no backend `canAccessCeo` + `ROUTE_TO_PERMISSION`).
- **Dark/light mode obrigatório:** toda cor com variante `dark:`; nunca hardcodar cor.
- **Formatadores de moeda** para valores `brl` (sem casas decimais).
- **Commits:** Conventional Commits; co-autor `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`.
- **Testes:** Vitest, co-locados. Rodar um arquivo: `npx vitest run <caminho>`.
- Após concluir, seguir o git-autopush (`agents/git-autopush-SKILL.md`).

---

### Task 1: Backend — tipos + funções puras de montagem dos KPIs

**Files:**
- Create: `server/routes/ceoDashboard.helpers.ts`
- Test: `server/routes/ceoDashboard.helpers.test.ts`

**Interfaces:**
- Consumes: nada (funções puras).
- Produces:
  - `type CeoUnidade = "brl" | "pct" | "int" | "score"`
  - `type CeoDirecao = "maior_melhor" | "menor_melhor" | "neutro"`
  - `interface CeoKpi { key, label, valor, unidade, meta, atingimentoPct, direcao, mom, sparkline, status, nota? }`
  - `interface BpLinha { metrica, titulo?, direcao?, unidade?, meses: {mes,orcado,realizado,atingimento}[] }`
  - `interface CeoDashboardResponse { mes: string; kpis: CeoKpi[] }`
  - `bpLinhaToKpi(linha, opts): CeoKpi`
  - `momFromSerie(serie): number | null`
  - `simpleKpi(opts): CeoKpi`
  - `emBreveKpi(opts): CeoKpi`
  - `assembleCeoKpis(sources): CeoKpi[]`
  - `canAccessCeo(user): boolean`

- [ ] **Step 1: Write the failing test**

Create `server/routes/ceoDashboard.helpers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  bpLinhaToKpi,
  momFromSerie,
  simpleKpi,
  emBreveKpi,
  assembleCeoKpis,
  canAccessCeo,
  type BpLinha,
} from "./ceoDashboard.helpers";

const linhaReceita: BpLinha = {
  metrica: "receita_total",
  direcao: "maior_melhor",
  unidade: "brl",
  meses: [
    { mes: 1, orcado: 100, realizado: 90, atingimento: 90 },
    { mes: 2, orcado: 100, realizado: 110, atingimento: 110 },
    { mes: 3, orcado: 100, realizado: null, atingimento: null },
  ],
};

describe("bpLinhaToKpi", () => {
  it("seleciona o mês pedido e copia orcado/realizado/atingimento do BP", () => {
    const kpi = bpLinhaToKpi(linhaReceita, {
      key: "receita", label: "Receita", mesNum: 2, direcao: "maior_melhor", unidade: "brl",
    });
    expect(kpi.valor).toBe(110);
    expect(kpi.meta).toBe(100);
    expect(kpi.atingimentoPct).toBe(110);
    expect(kpi.status).toBe("ok");
    expect(kpi.direcao).toBe("maior_melhor");
  });

  it("monta a sparkline com os realizados até o mês pedido (ignora null)", () => {
    const kpi = bpLinhaToKpi(linhaReceita, {
      key: "receita", label: "Receita", mesNum: 3, direcao: "maior_melhor", unidade: "brl",
    });
    expect(kpi.sparkline).toEqual([90, 110]);
    expect(kpi.valor).toBeNull(); // mês 3 sem realizado
  });

  it("linha inexistente vira KPI vazio, sem quebrar", () => {
    const kpi = bpLinhaToKpi(undefined, {
      key: "x", label: "X", mesNum: 1, direcao: "maior_melhor", unidade: "brl",
    });
    expect(kpi.valor).toBeNull();
    expect(kpi.sparkline).toBeNull();
  });
});

describe("momFromSerie", () => {
  it("calcula variação % do último vs o anterior", () => {
    expect(momFromSerie([100, 110])).toBe(10);
    expect(momFromSerie([100, 90])).toBe(-10);
  });
  it("retorna null com menos de 2 pontos ou base zero", () => {
    expect(momFromSerie([100])).toBeNull();
    expect(momFromSerie(null)).toBeNull();
    expect(momFromSerie([0, 5])).toBeNull();
  });
});

describe("simpleKpi", () => {
  it("nunca tem meta/atingimento e calcula MoM da série", () => {
    const kpi = simpleKpi({
      key: "inadimplencia", label: "Inadimplência Total", valor: 50,
      unidade: "brl", direcao: "menor_melhor", serie: [40, 50],
    });
    expect(kpi.meta).toBeNull();
    expect(kpi.atingimentoPct).toBeNull();
    expect(kpi.mom).toBe(25);
    expect(kpi.status).toBe("sem_meta");
  });
});

describe("emBreveKpi", () => {
  it("marca status em_breve com valor null", () => {
    const kpi = emBreveKpi({ key: "nps", label: "NPS Clientes", unidade: "score" });
    expect(kpi.status).toBe("em_breve");
    expect(kpi.valor).toBeNull();
  });
});

describe("assembleCeoKpis", () => {
  it("devolve 11 KPIs na ordem fixa da grade", () => {
    const kpis = assembleCeoKpis({
      bpLinhas: [{ metrica: "ebitda", direcao: "maior_melhor", unidade: "brl", meses: [{ mes: 1, orcado: 10, realizado: 8, atingimento: 80 }] },
                 { metrica: "cac", direcao: "menor_melhor", unidade: "brl", meses: [{ mes: 1, orcado: 5, realizado: 4, atingimento: 80 }] }],
      bpMetricas: [
        { metrica: "receita_total", direcao: "maior_melhor", unidade: "brl", meses: [{ mes: 1, orcado: 100, realizado: 90, atingimento: 90 }] },
        { metrica: "despesa_total", direcao: "menor_melhor", unidade: "brl", meses: [{ mes: 1, orcado: 80, realizado: 70, atingimento: 87 }] },
        { metrica: "saldo_caixa", direcao: "maior_melhor", unidade: "brl", meses: [{ mes: 1, orcado: 50, realizado: 60, atingimento: 120 }] },
        { metrica: "colaboradores", direcao: "menor_melhor", unidade: "int", meses: [{ mes: 1, orcado: 140, realizado: 142, atingimento: 101 }] },
        { metrica: "receita_cabeca", direcao: "maior_melhor", unidade: "brl", meses: [{ mes: 1, orcado: 12, realizado: 13, atingimento: 108 }] },
      ],
      mesNum: 1,
      inadimplencia: { total: 20, serie: [18, 20] },
      ltvMedioCliente: 28000,
      enpsScore: 48,
    });
    expect(kpis.map((k) => k.key)).toEqual([
      "receita", "custos", "lucro", "caixa",
      "inadimplencia", "nps", "cac", "ltv",
      "headcount", "enps", "receita_cabeca",
    ]);
    // BP com meta
    expect(kpis.find((k) => k.key === "custos")!.meta).toBe(80);
    // fonte própria sem meta
    expect(kpis.find((k) => k.key === "ltv")!.meta).toBeNull();
    expect(kpis.find((k) => k.key === "ltv")!.valor).toBe(28000);
    expect(kpis.find((k) => k.key === "nps")!.status).toBe("em_breve");
  });
});

describe("canAccessCeo", () => {
  it("libera admin", () => {
    expect(canAccessCeo({ role: "admin" })).toBe(true);
  });
  it("libera quem tem /ceo-dashboard em allowedRoutes", () => {
    expect(canAccessCeo({ role: "user", allowedRoutes: ["/ceo-dashboard"] })).toBe(true);
  });
  it("bloqueia os demais", () => {
    expect(canAccessCeo({ role: "user", allowedRoutes: ["/outra"] })).toBe(false);
    expect(canAccessCeo(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/routes/ceoDashboard.helpers.test.ts`
Expected: FAIL — "Cannot find module './ceoDashboard.helpers'".

- [ ] **Step 3: Write minimal implementation**

Create `server/routes/ceoDashboard.helpers.ts`:

```ts
// Tipos e funções puras do CEO Dashboard.
// Toda a lógica de montagem de KPI vive aqui para poder ser testada sem IO.

export type CeoUnidade = "brl" | "pct" | "int" | "score";
export type CeoDirecao = "maior_melhor" | "menor_melhor" | "neutro";

export interface CeoKpi {
  key: string;
  label: string;
  valor: number | null;
  unidade: CeoUnidade;
  meta: number | null;
  atingimentoPct: number | null;
  direcao: CeoDirecao;
  mom: number | null;
  sparkline: number[] | null;
  status: "ok" | "sem_meta" | "em_breve";
  nota?: string;
}

// Uma linha do payload de computarBpReceitas (linhas[] ou metricasGerais[]).
export interface BpLinha {
  metrica: string;
  titulo?: string;
  direcao?: CeoDirecao;
  unidade?: "brl" | "int" | "pct";
  meses: Array<{ mes: number; orcado: number; realizado: number | null; atingimento: number | null }>;
}

export interface CeoDashboardResponse {
  mes: string; // "2026-06"
  kpis: CeoKpi[];
}

// Constrói um KPI a partir de uma linha do BP, para o mês pedido (1..12).
// direcao/unidade são explícitos (a régua vem da tabela de sourcing do spec),
// não dependemos de a linha do BP carregar esses campos.
export function bpLinhaToKpi(
  linha: BpLinha | undefined,
  opts: { key: string; label: string; mesNum: number; direcao: CeoDirecao; unidade: CeoUnidade; nota?: string }
): CeoKpi {
  const meses = linha?.meses ?? [];
  const mesData = meses.find((m) => m.mes === opts.mesNum);
  const serie = meses
    .filter((m) => m.mes <= opts.mesNum && m.realizado !== null)
    .map((m) => m.realizado as number);
  return {
    key: opts.key,
    label: opts.label,
    valor: mesData?.realizado ?? null,
    unidade: opts.unidade,
    meta: mesData?.orcado ?? null,
    atingimentoPct: mesData?.atingimento ?? null,
    direcao: opts.direcao,
    mom: null,
    sparkline: serie.length ? serie : null,
    status: "ok",
    nota: opts.nota,
  };
}

// Variação percentual (1 casa) do último ponto vs o anterior; null se <2 pontos ou base 0.
export function momFromSerie(serie: number[] | null | undefined): number | null {
  if (!serie || serie.length < 2) return null;
  const atual = serie[serie.length - 1];
  const anterior = serie[serie.length - 2];
  if (anterior === 0) return null;
  return Math.round(((atual - anterior) / Math.abs(anterior)) * 1000) / 10;
}

// KPI de fonte própria (sem meta no BP): valor pontual + série opcional p/ sparkline/MoM.
export function simpleKpi(opts: {
  key: string;
  label: string;
  valor: number | null;
  unidade: CeoUnidade;
  direcao: CeoDirecao;
  serie?: number[] | null;
  nota?: string;
}): CeoKpi {
  const serie = opts.serie && opts.serie.length ? opts.serie : null;
  return {
    key: opts.key,
    label: opts.label,
    valor: opts.valor,
    unidade: opts.unidade,
    meta: null,
    atingimentoPct: null,
    direcao: opts.direcao,
    mom: momFromSerie(serie),
    sparkline: serie,
    status: "sem_meta",
    nota: opts.nota,
  };
}

// KPI placeholder "em breve" (ex.: NPS de clientes, sem fonte de dados).
export function emBreveKpi(opts: { key: string; label: string; unidade: CeoUnidade; nota?: string }): CeoKpi {
  return {
    key: opts.key,
    label: opts.label,
    valor: null,
    unidade: opts.unidade,
    meta: null,
    atingimentoPct: null,
    direcao: "maior_melhor",
    mom: null,
    sparkline: null,
    status: "em_breve",
    nota: opts.nota,
  };
}

export interface CeoSources {
  bpLinhas: BpLinha[];
  bpMetricas: BpLinha[];
  mesNum: number;
  inadimplencia: { total: number | null; serie: number[] | null };
  ltvMedioCliente: number | null;
  enpsScore: number | null;
}

// Monta os 11 KPIs na ordem fixa da grade (4 / 4 / 3).
export function assembleCeoKpis(s: CeoSources): CeoKpi[] {
  const find = (arr: BpLinha[], metrica: string) => arr.find((l) => l.metrica === metrica);
  const bp = (
    arr: BpLinha[], metrica: string, key: string, label: string, direcao: CeoDirecao, unidade: CeoUnidade
  ) => bpLinhaToKpi(find(arr, metrica), { key, label, mesNum: s.mesNum, direcao, unidade });

  return [
    bp(s.bpMetricas, "receita_total",  "receita",        "Receita",           "maior_melhor", "brl"),
    bp(s.bpMetricas, "despesa_total",  "custos",         "Custos & Despesas", "menor_melhor", "brl"),
    bp(s.bpLinhas,   "ebitda",         "lucro",          "Lucro (EBITDA)",    "maior_melhor", "brl"),
    bp(s.bpMetricas, "saldo_caixa",    "caixa",          "Saldo de Caixa",    "maior_melhor", "brl"),
    simpleKpi({ key: "inadimplencia", label: "Inadimplência Total", valor: s.inadimplencia.total, unidade: "brl", direcao: "menor_melhor", serie: s.inadimplencia.serie }),
    emBreveKpi({ key: "nps", label: "NPS Clientes", unidade: "score", nota: "Sem fonte de dados de NPS de clientes ainda" }),
    bp(s.bpLinhas,   "cac",            "cac",            "CAC",               "menor_melhor", "brl"),
    simpleKpi({ key: "ltv", label: "LTV", valor: s.ltvMedioCliente, unidade: "brl", direcao: "maior_melhor" }),
    bp(s.bpMetricas, "colaboradores",  "headcount",      "Headcount",         "menor_melhor", "int"),
    simpleKpi({ key: "enps", label: "E-NPS", valor: s.enpsScore, unidade: "score", direcao: "maior_melhor" }),
    bp(s.bpMetricas, "receita_cabeca", "receita_cabeca", "Receita / Cabeça",  "maior_melhor", "brl"),
  ];
}

// Guard de acesso: admin OU allowedRoutes inclui /ceo-dashboard.
export function canAccessCeo(user: { role?: string; allowedRoutes?: string[] } | undefined | null): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return Array.isArray(user.allowedRoutes) && user.allowedRoutes.includes("/ceo-dashboard");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/routes/ceoDashboard.helpers.test.ts`
Expected: PASS (todos os describes verdes).

- [ ] **Step 5: Commit**

```bash
git add server/routes/ceoDashboard.helpers.ts server/routes/ceoDashboard.helpers.test.ts
git commit -m "feat(ceo-dashboard): funções puras de montagem dos KPIs

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Backend — endpoint `GET /api/ceo-dashboard`

**Files:**
- Create: `server/routes/ceoDashboard.ts`
- Modify: `server/routes.ts` (import + registro, seguindo o padrão da linha 90/8602)

**Interfaces:**
- Consumes: `computarBpReceitas(db)` de `./bp2026`; `storage.getInadimplenciaResumo()`, `storage.getRhNpsDashboard()` de `../storage`; `assembleCeoKpis`, `canAccessCeo`, `CeoDashboardResponse` de `./ceoDashboard.helpers`.
- Produces: `registerCeoDashboardRoutes(app, db)`; `buildCeoDashboard(db, mes?): Promise<CeoDashboardResponse>`.

- [ ] **Step 1: Escrever o módulo do endpoint**

Create `server/routes/ceoDashboard.ts`:

```ts
import type { Express } from "express";
import { sql } from "drizzle-orm";
import { computarBpReceitas } from "./bp2026";
import { storage } from "../storage";
import {
  assembleCeoKpis,
  canAccessCeo,
  type CeoDashboardResponse,
} from "./ceoDashboard.helpers";

// "2026-06" -> 6. BP é fixo em ANO=2026; fora disso cai no mês corrente do payload.
function parseMesNum(mes: string | undefined, mesCorrente: number): number {
  if (!mes) return mesCorrente;
  const m = /^2026-(\d{2})$/.exec(mes);
  if (!m) return mesCorrente;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= 12 ? n : mesCorrente;
}

export async function buildCeoDashboard(db: any, mes?: string): Promise<CeoDashboardResponse> {
  // 1) BP — 7 KPIs de uma só chamada (linhas[] do DRE + metricasGerais[]).
  const bp: any = await computarBpReceitas(db);
  const mesNum = parseMesNum(mes, bp.mesCorrente);

  // 2) Inadimplência (foto atual) + série mensal p/ sparkline/MoM.
  const inadResumo = await storage.getInadimplenciaResumo();
  const inadSerie = (inadResumo.evolucaoMensal ?? []).map((e: any) => Number(e.valor) || 0);

  // 3) LTV médio por cliente (mesma régua do /api/lt-ltv-churn/overview).
  const ltvRows: any = await db.execute(sql`
    SELECT ROUND(AVG(ltv_total)::numeric, 0) AS ltv FROM (
      SELECT id_task,
        SUM(COALESCE(ltv_recorrente,0)) + SUM(COALESCE(valorp,0)) AS ltv_total
      FROM cortex_core.vw_lt_contratos
      GROUP BY id_task
    ) t
  `);
  const ltv = Number(ltvRows.rows?.[0]?.ltv) || null;

  // 4) E-NPS (empresa) — mais recente disponível.
  let enpsScore: number | null = null;
  try {
    const npsDash: any = await storage.getRhNpsDashboard();
    enpsScore = npsDash?.empresa?.nps ?? null;
  } catch {
    enpsScore = null;
  }

  const kpis = assembleCeoKpis({
    bpLinhas: bp.linhas ?? [],
    bpMetricas: bp.metricasGerais ?? [],
    mesNum,
    inadimplencia: {
      total: inadResumo.totalInadimplente ?? null,
      serie: inadSerie.length ? inadSerie : null,
    },
    ltvMedioCliente: ltv,
    enpsScore,
  });

  return { mes: `2026-${String(mesNum).padStart(2, "0")}`, kpis };
}

export function registerCeoDashboardRoutes(app: Express, db: any) {
  app.get("/api/ceo-dashboard", async (req: any, res) => {
    try {
      if (!canAccessCeo(req.user)) {
        return res.status(403).json({ error: "Acesso restrito ao CEO Dashboard" });
      }
      const mes = typeof req.query.mes === "string" ? req.query.mes : undefined;
      const payload = await buildCeoDashboard(db, mes);
      res.json(payload);
    } catch (error) {
      console.error("[api] Error building CEO dashboard:", error);
      res.status(500).json({ error: "Falha ao montar o CEO Dashboard" });
    }
  });
}
```

- [ ] **Step 2: Registrar no `server/routes.ts`**

Adicionar o import junto aos demais `register*` (perto da linha 90):

```ts
import { registerCeoDashboardRoutes } from "./routes/ceoDashboard";
```

E a chamada de registro perto da linha 8602 (junto de `registerLtLtvChurnRoutes(app, db);`):

```ts
  registerCeoDashboardRoutes(app, db);
```

- [ ] **Step 3: Verificar que compila (tsc)**

Run: `npx tsc --noEmit`
Expected: sem erros novos referentes a `ceoDashboard`.

- [ ] **Step 4: Reiniciar o backend e testar o endpoint autenticado**

O dev server (tsx, sem watch) exige restart manual após mudança no backend:

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev
```

Testar (logado como admin no browser em http://localhost:3000). No console do navegador ou via `curl` com o cookie de sessão:

```bash
curl -s -b "<cookie-de-sessao>" "http://localhost:3000/api/ceo-dashboard?mes=2026-06" | head -c 400
```

Expected: JSON `{ "mes": "2026-06", "kpis": [ {"key":"receita",...}, ... ] }` com 11 itens.
Sem sessão/admin → `403 {"error":"Acesso restrito ao CEO Dashboard"}`.

- [ ] **Step 5: Commit**

```bash
git add server/routes/ceoDashboard.ts server/routes.ts
git commit -m "feat(ceo-dashboard): endpoint GET /api/ceo-dashboard (BP + fontes próprias)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Frontend — helper de formatação/cor + componente `CeoKpiCard`

**Files:**
- Create: `client/src/components/ceo/ceoFormat.ts`
- Create: `client/src/components/ceo/CeoKpiCard.tsx`
- Test: `client/src/components/ceo/ceoFormat.test.ts`

**Interfaces:**
- Consumes: tipo `CeoKpi` (redeclarado no client — ver Step 1; o backend não é importável no bundle do client).
- Produces:
  - `formatValor(valor, unidade): string`
  - `atingimentoTom(pct, direcao): "verde" | "ambar" | "vermelho" | "neutro"`
  - `CeoKpiCard` (componente React).

- [ ] **Step 1: Escrever o teste do helper**

Create `client/src/components/ceo/ceoFormat.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatValor, atingimentoTom } from "./ceoFormat";

describe("formatValor", () => {
  it("formata brl sem casas decimais", () => {
    expect(formatValor(1830000, "brl")).toMatch(/R\$\s?1\.830\.000/);
  });
  it("formata int e score como número puro, e null como travessão", () => {
    expect(formatValor(142, "int")).toBe("142");
    expect(formatValor(48, "score")).toBe("48");
    expect(formatValor(null, "brl")).toBe("—");
  });
  it("formata pct com sinal de porcentagem", () => {
    expect(formatValor(4.2, "pct")).toBe("4,2%");
  });
});

describe("atingimentoTom", () => {
  it("maior_melhor: >=100 verde, 80-99 âmbar, <80 vermelho", () => {
    expect(atingimentoTom(105, "maior_melhor")).toBe("verde");
    expect(atingimentoTom(90, "maior_melhor")).toBe("ambar");
    expect(atingimentoTom(70, "maior_melhor")).toBe("vermelho");
  });
  it("menor_melhor: gastar menos que a meta é verde", () => {
    expect(atingimentoTom(90, "menor_melhor")).toBe("verde");   // 90% da meta = bom
    expect(atingimentoTom(110, "menor_melhor")).toBe("ambar");
    expect(atingimentoTom(140, "menor_melhor")).toBe("vermelho");
  });
  it("null vira neutro", () => {
    expect(atingimentoTom(null, "maior_melhor")).toBe("neutro");
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run client/src/components/ceo/ceoFormat.test.ts`
Expected: FAIL — módulo `./ceoFormat` inexistente.

- [ ] **Step 3: Implementar o helper**

Create `client/src/components/ceo/ceoFormat.ts`:

```ts
export type CeoUnidade = "brl" | "pct" | "int" | "score";
export type CeoDirecao = "maior_melhor" | "menor_melhor" | "neutro";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL", maximumFractionDigits: 0,
});
const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const pct1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatValor(valor: number | null, unidade: CeoUnidade): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "—";
  if (unidade === "brl") return brl.format(valor);
  if (unidade === "pct") return `${pct1.format(valor)}%`; // ex.: 4,2%
  return int.format(valor); // int e score
}

// "score" onde maior = melhor. atingimento = realizado/orcado*100.
// menor_melhor inverte: gastar 90% da meta é ótimo.
export function atingimentoTom(
  pct: number | null,
  direcao: CeoDirecao
): "verde" | "ambar" | "vermelho" | "neutro" {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return "neutro";
  const efetivo = direcao === "menor_melhor" ? (pct <= 0 ? 200 : 10000 / pct) : pct;
  if (efetivo >= 100) return "verde";
  if (efetivo >= 80) return "ambar";
  return "vermelho";
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run client/src/components/ceo/ceoFormat.test.ts`
Expected: PASS.

- [ ] **Step 5: Implementar o `CeoKpiCard`**

Create `client/src/components/ceo/CeoKpiCard.tsx`:

```tsx
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { formatValor, atingimentoTom, type CeoUnidade, type CeoDirecao } from "./ceoFormat";

export interface CeoKpi {
  key: string;
  label: string;
  valor: number | null;
  unidade: CeoUnidade;
  meta: number | null;
  atingimentoPct: number | null;
  direcao: CeoDirecao;
  mom: number | null;
  sparkline: number[] | null;
  status: "ok" | "sem_meta" | "em_breve";
  nota?: string;
}

const TOM_CLASSES: Record<string, string> = {
  verde: "text-emerald-600 dark:text-emerald-400",
  ambar: "text-amber-600 dark:text-amber-400",
  vermelho: "text-rose-600 dark:text-rose-400",
  neutro: "text-gray-500 dark:text-zinc-400",
};

const TOM_STROKE: Record<string, string> = {
  verde: "#10b981",
  ambar: "#f59e0b",
  vermelho: "#f43f5e",
  neutro: "#a1a1aa",
};

export function CeoKpiCard({ kpi }: { kpi: CeoKpi }) {
  const emBreve = kpi.status === "em_breve";
  const tom = atingimentoTom(kpi.atingimentoPct, kpi.direcao);
  const spark = kpi.sparkline?.map((v, i) => ({ i, v })) ?? null;

  return (
    <div
      className={[
        "rounded-xl border p-4 flex flex-col gap-2 min-h-[120px]",
        "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700",
        emBreve ? "opacity-50" : "",
      ].join(" ")}
      title={kpi.nota}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-zinc-400">{kpi.label}</span>
        {emBreve && (
          <span className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400">
            Em breve
          </span>
        )}
      </div>

      <div className="text-2xl font-semibold text-gray-900 dark:text-white">
        {emBreve ? "—" : formatValor(kpi.valor, kpi.unidade)}
      </div>

      {/* Badge de comparação: atingimento (com meta) ou MoM (sem meta). */}
      {!emBreve && kpi.atingimentoPct !== null && (
        <div className={`text-xs font-medium ${TOM_CLASSES[tom]}`}>
          {Math.round(kpi.atingimentoPct)}% da meta
          <span className="text-gray-400 dark:text-zinc-500">
            {" "}· meta {formatValor(kpi.meta, kpi.unidade)}
          </span>
        </div>
      )}
      {!emBreve && kpi.atingimentoPct === null && kpi.mom !== null && (
        <div className="text-xs text-gray-500 dark:text-zinc-400">
          {kpi.mom >= 0 ? "▲" : "▼"} {Math.abs(kpi.mom)}% vs mês anterior
        </div>
      )}

      {spark && spark.length > 1 && (
        <div className="h-8 -mx-1 mt-auto">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark}>
              <Area
                type="monotone"
                dataKey="v"
                stroke={TOM_STROKE[tom]}
                fill={TOM_STROKE[tom]}
                fillOpacity={0.15}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Verificar tipos/lint do frontend**

Run: `npx tsc --noEmit`
Expected: sem erros em `client/src/components/ceo/*`.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/ceo/
git commit -m "feat(ceo-dashboard): CeoKpiCard + helpers de formatação/cor

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 4: Frontend — página `CeoDashboard` + rota + nav + acesso

**Files:**
- Create: `client/src/pages/CeoDashboard.tsx`
- Modify: `client/src/App.tsx` (lazy import + `<Route path="/ceo-dashboard">`)
- Modify: `shared/nav-config.ts` (PERMISSION_KEYS.ADMIN + ROUTE_TO_PERMISSION + NAV_CONFIG)

**Interfaces:**
- Consumes: `CeoKpiCard`, tipo `CeoKpi` de `@/components/ceo/CeoKpiCard`; endpoint `/api/ceo-dashboard`.
- Produces: componente default-export `CeoDashboard`.

- [ ] **Step 1: Criar a página**

Create `client/src/pages/CeoDashboard.tsx`:

```tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CeoKpiCard, type CeoKpi } from "@/components/ceo/CeoKpiCard";

interface CeoDashboardResponse {
  mes: string;
  kpis: CeoKpi[];
}

// Meses de 2026 até o corrente. Default = mês atual (ou dez/26 se já passou).
const MESES_2026 = Array.from({ length: 12 }, (_, i) => {
  const n = i + 1;
  const label = new Date(2026, i, 1).toLocaleDateString("pt-BR", { month: "long" });
  return { value: `2026-${String(n).padStart(2, "0")}`, label: `${label[0].toUpperCase()}${label.slice(1)} 2026` };
});

function mesCorrenteDefault(): string {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = ano < 2026 ? 1 : ano > 2026 ? 12 : hoje.getMonth() + 1;
  return `2026-${String(mes).padStart(2, "0")}`;
}

export default function CeoDashboard() {
  const [mes, setMes] = useState<string>(mesCorrenteDefault());

  const { data, isLoading, isError } = useQuery<CeoDashboardResponse>({
    queryKey: ["ceo-dashboard", mes],
    queryFn: async () => {
      const res = await fetch(`/api/ceo-dashboard?mes=${mes}`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">CEO Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Snapshot executivo · realizado vs meta do BP 2026
          </p>
        </div>
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MESES_2026.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 11 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 dark:border-zinc-700 h-[120px] animate-pulse bg-gray-100 dark:bg-zinc-800" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950 p-4 text-sm text-rose-700 dark:text-rose-300">
          Falha ao carregar o CEO Dashboard. Verifique seu acesso e tente novamente.
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {data.kpis.map((kpi) => (
            <CeoKpiCard key={kpi.key} kpi={kpi} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Registrar a rota em `client/src/App.tsx`**

Adicionar o lazy import junto aos demais (padrão `lazyWithRetry`, perto das linhas 53-180):

```tsx
const CeoDashboard = lazyWithRetry(() => import("@/pages/CeoDashboard"));
```

E a rota dentro do `<Switch>` do `ProtectedRouter` (seguindo o padrão das outras rotas):

```tsx
<Route path="/ceo-dashboard">{() => <ProtectedRoute path="/ceo-dashboard" component={CeoDashboard} />}</Route>
```

- [ ] **Step 3: Adicionar a permission key em `shared/nav-config.ts`**

No objeto `PERMISSION_KEYS.ADMIN` (colar junto às outras, ex. após `OKR_2026`):

```ts
    CEO_DASHBOARD: 'admin.ceo_dashboard',
```

(Ficando em `ADMIN`, entra automaticamente em `ALL_PERMISSION_KEYS` → `CONTROL_TOWER`, e fica fora de BASE/TIME/LIDER.)

- [ ] **Step 4: Mapear a rota → permission em `ROUTE_TO_PERMISSION`**

Adicionar (perto de `'/okr-2026': PERMISSION_KEYS.ADMIN.OKR_2026,`):

```ts
  '/ceo-dashboard': PERMISSION_KEYS.ADMIN.CEO_DASHBOARD,
```

- [ ] **Step 5: Adicionar o item de menu no `NAV_CONFIG`**

No array `NAV_CONFIG.governanca` (linha ~590), adicionar como primeiro item:

```ts
    { title: 'CEO Dashboard', url: '/ceo-dashboard', icon: 'LayoutDashboard', permissionKey: PERMISSION_KEYS.ADMIN.CEO_DASHBOARD },
```

Se `'LayoutDashboard'` não estiver no mapa de ícones do `app-sidebar.tsx`, reusar um ícone já mapeado (ex. `'Gauge'`) ou adicionar o import do ícone lucide ao mapa.

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 7: Testar no browser (dark E light)**

Com o dev server rodando (Task 2, Step 4), abrir http://localhost:3000/ceo-dashboard logado como admin.
Verificar:
- 11 cards aparecem; valores financeiros batem com `/bp-2026` no mesmo mês.
- Custos e CAC coloridos por "gastar menos = verde".
- Card NPS aparece apagado com selo "Em breve".
- Cards sem meta (Inadimplência, LTV, E-NPS) mostram valor sem badge de meta (Inadimplência com MoM).
- Alternar tema claro/escuro: sem cor quebrada.
- Trocar o mês no dropdown recarrega os valores.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/CeoDashboard.tsx client/src/App.tsx shared/nav-config.ts
git commit -m "feat(ceo-dashboard): página, rota e acesso (CONTROL_TOWER/admin)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 5: Verificação final + reconciliação

**Files:** nenhum (validação).

- [ ] **Step 1: Rodar toda a suíte de testes nova**

Run: `npx vitest run server/routes/ceoDashboard.helpers.test.ts client/src/components/ceo/ceoFormat.test.ts`
Expected: PASS em ambos.

- [ ] **Step 2: Typecheck geral**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Reconciliação com o BP**

No browser, comparar mês fechado (ex. 2026-06) entre `/ceo-dashboard` e `/bp-2026`:
- Receita = "Receita Total" do BP; Custos = "Despesa Total"; Lucro = EBITDA; CAC; Headcount = "Número de Colaboradores"; Receita/Cabeça; Saldo de Caixa.
Expected: valores idênticos (mesma fonte). Registrar qualquer divergência antes de fechar.

- [ ] **Step 4: Pós-conclusão (workflow obrigatório do projeto)**

- git-autopush já feito nos commits acima; garantir `git push`.
- Atualizar Obsidian vault (task correspondente) conforme `agents/obsidian-sync-SKILL.md`.
- Se houver chamado no Cortex, `UPDATE cortex_core.chamados SET status='review', atualizado_em=NOW() WHERE id=<id>;`.

---

## Notas de implementação

- **Por que `direcao`/`unidade` explícitos em `bpLinhaToKpi`?** Não dependemos de as linhas do BP
  (`metricasGerais` via `buildLinhaGeral`) carregarem esses campos no objeto de saída — a régua está
  na tabela de sourcing do spec, então passamos explicitamente. Determinístico e auto-documentado.
- **Sparkline dos KPIs do BP** usa a série de `realizado` até o mês pedido (meses futuros são null e
  ficam de fora). Para as fontes próprias, só Inadimplência tem série (via `evolucaoMensal`); LTV e
  E-NPS ficam sem sparkline (valor pontual) — comportamento previsto, o card simplesmente não desenha.
- **Cache do BP:** `computarBpReceitas` já tem cache interno de 10min; o CEO Dashboard herda isso.
- **Acesso:** o guard do backend (`canAccessCeo`) é a defesa real; o `ROUTE_TO_PERMISSION` + nav só
  controlam a UI.
