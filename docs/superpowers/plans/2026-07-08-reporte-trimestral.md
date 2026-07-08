# Reporte Trimestral Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar `/reports/trimestral` — um deck de slides variante do Reporte Mensal, agregado por trimestre, com 2 slides novos de tendência (Visão do Trimestre com QoQ e Evolução por Trimestre).

**Architecture:** Endpoint dedicado `server/routes/reportsTrimestral.ts` que espelha as queries do subconjunto do `relatorioMensalSlides.ts` com janela trimestral e agregação por tipo de métrica (fluxo soma; estoque = foto de fim de tri; ratio recalculado). Não toca no endpoint mensal (produção). O frontend é uma casca (`RelatorioTrimestral.tsx`) que reusa os componentes de slide do mensal, alimentados com números trimestrais, + 2 slides novos. O payload tem o mesmo shape das seções do `RelatorioMensalData` (para reuso direto dos slides) + um bloco `trend`.

**Tech Stack:** TypeScript, React (wouter routes, React Query), Express, Drizzle `sql`, Postgres (schemas `"Clickup"`, `"Conta Azul"`, `cortex_core`), Recharts, Vitest.

## Global Constraints

- **Não modificar** `server/routes/relatorioMensalSlides.ts` nem `client/src/pages/RelatorioMensal.tsx` (produção). Só ler para espelhar.
- **Antes de escrever qualquer query final**, ler `agents/db-specialist.md` e `DATABASE.md` e rodar a query real (local ou prod) para validar colunas/filtros. Fontes canônicas (memória do projeto): churn = `"Clickup".cup_churn`; MRR = snapshot `"Clickup".cup_data_hist`; clientes = `"Clickup".cup_clientes`; financeiro = `"Conta Azul".caz_parcelas`.
- **Agregação por tipo** (regra fixa deste plano):
  - **Fluxo** → soma dos meses do trimestre (vendas, churn R$/count, entregas, faturamento, cross-sell).
  - **Estoque/foto** → snapshot na `fotoDate` da janela (MRR ativo, clientes/contratos ativos, estoque pontual, pausados).
  - **Ratio** → recalculado sobre os agregados (nunca média de médias).
- **Trimestre parcial**: agrega só sobre `mesesComputados`; foto usa `fotoDate` (hoje, se parcial; fim do tri, se fechado).
- **Comparação**: apenas QoQ (trimestre anterior). Sem YoY.
- **NPS**: `SlideNPS` é hardcoded (sem fonte de dados). Reusar como está, passando o label do trimestre. NPS não entra no payload.
- **Dark/light**: herdado dos componentes reusados; os 2 slides novos seguem o padrão dos slides existentes (fundo escuro do deck via `SlideLayout`).
- **Permissão**: reusa `PERMISSION_KEYS.REPORTS.MENSAL` (`'reports.mensal'`).
- **Formato do parâmetro**: `?trimestre=YYYY-Qn` (regex `^\d{4}-Q[1-4]$`).
- **Commits**: Conventional Commits, co-author `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`.

## File Structure

**Criar:**
- `server/routes/reportsTrimestral.window.ts` — helper puro de janela trimestral (parse, janela, opções, default, foto). Testável.
- `server/routes/reportsTrimestral.window.test.ts` — testes Vitest do helper.
- `server/routes/reportsTrimestral.ts` — endpoint `GET /api/reports/trimestral` + `registerReportsTrimestralRoutes`.
- `client/src/pages/RelatorioTrimestral.tsx` — casca do deck (seletor de trimestre, banner de parcial, navegação, apresentação, export PDF).
- `client/src/pages/relatorio-trimestral/types.ts` — payload trimestral (reusa tipos do mensal + `TrendData`).
- `client/src/pages/relatorio-trimestral/useRelatorioTrimestral.ts` — hook React Query.
- `client/src/pages/relatorio-trimestral/SlideVisaoTrimestre.tsx` — slide novo (cards QoQ).
- `client/src/pages/relatorio-trimestral/SlideEvolucaoTrimestre.tsx` — slide novo (gráficos por trimestre).

**Modificar:**
- `client/src/App.tsx` — import lazy (linha ~142) + `<Route>` (linha ~448).
- `shared/nav-config.ts` — item no grupo Reports (linha ~603) + mapa path→permissão (linha ~332).
- `server/routes.ts` — import (linha ~62) + chamada de registro (linha ~8556).

---

### Task 1: Helper de janela trimestral (puro, testável)

**Files:**
- Create: `server/routes/reportsTrimestral.window.ts`
- Test: `server/routes/reportsTrimestral.window.test.ts`

**Interfaces:**
- Produces:
  - `interface QuarterWindow { trimestre; label; ano; quarter; startMonth; dataStart; dataEnd; fotoDate; meses; parcial; mesesComputados; prev }`
  - `parseTrimestre(t: string): { ano: number; quarter: number } | null`
  - `buildQuarterWindow(trimestre: string, hoje: Date): QuarterWindow`
  - `getTrimestreOptions(hoje: Date, count: number): { value: string; label: string }[]`
  - `getDefaultTrimestre(hoje: Date): string`

- [ ] **Step 1: Write the failing test**

```ts
// server/routes/reportsTrimestral.window.test.ts
import { describe, it, expect } from "vitest";
import {
  parseTrimestre,
  buildQuarterWindow,
  getTrimestreOptions,
  getDefaultTrimestre,
} from "./reportsTrimestral.window";

describe("parseTrimestre", () => {
  it("parses valid quarter", () => {
    expect(parseTrimestre("2026-Q3")).toEqual({ ano: 2026, quarter: 3 });
  });
  it("rejects invalid", () => {
    expect(parseTrimestre("2026-13")).toBeNull();
    expect(parseTrimestre("2026-Q5")).toBeNull();
    expect(parseTrimestre("lixo")).toBeNull();
  });
});

describe("buildQuarterWindow", () => {
  it("closed quarter Q2 2026 seen from Jul 8 2026", () => {
    const w = buildQuarterWindow("2026-Q2", new Date(2026, 6, 8)); // month idx 6 = Julho
    expect(w.label).toBe("Q2 2026");
    expect(w.startMonth).toBe(4);
    expect(w.dataStart).toBe("2026-04-01");
    expect(w.dataEnd).toBe("2026-07-01");
    expect(w.meses).toEqual(["2026-04", "2026-05", "2026-06"]);
    expect(w.parcial).toBe(false);
    expect(w.mesesComputados).toEqual(["2026-04", "2026-05", "2026-06"]);
    expect(w.fotoDate).toBe("2026-07-01"); // fim exclusivo do tri fechado
    expect(w.prev.trimestre).toBe("2026-Q1");
    expect(w.prev.dataStart).toBe("2026-01-01");
    expect(w.prev.dataEnd).toBe("2026-04-01");
  });

  it("partial current quarter Q3 2026 seen from Jul 8 2026", () => {
    const w = buildQuarterWindow("2026-Q3", new Date(2026, 6, 8));
    expect(w.dataStart).toBe("2026-07-01");
    expect(w.dataEnd).toBe("2026-10-01");
    expect(w.parcial).toBe(true);
    expect(w.mesesComputados).toEqual(["2026-07"]); // só o mês corrente decorrido
    expect(w.fotoDate).toBe("2026-07-08"); // parcial → hoje
  });

  it("Q1 rolls prev back to Q4 of previous year", () => {
    const w = buildQuarterWindow("2026-Q1", new Date(2026, 6, 8));
    expect(w.prev.trimestre).toBe("2025-Q4");
    expect(w.prev.dataStart).toBe("2025-10-01");
    expect(w.prev.dataEnd).toBe("2026-01-01");
  });
});

describe("getDefaultTrimestre / getTrimestreOptions", () => {
  it("default is the current quarter", () => {
    expect(getDefaultTrimestre(new Date(2026, 6, 8))).toBe("2026-Q3");
  });
  it("options are most-recent-first and include current", () => {
    const opts = getTrimestreOptions(new Date(2026, 6, 8), 6);
    expect(opts).toHaveLength(6);
    expect(opts[0]).toEqual({ value: "2026-Q3", label: "Q3 2026" });
    expect(opts[1]).toEqual({ value: "2026-Q2", label: "Q2 2026" });
    expect(opts[5]).toEqual({ value: "2025-Q2", label: "Q2 2025" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/routes/reportsTrimestral.window.test.ts`
Expected: FAIL — `Cannot find module './reportsTrimestral.window'`.

- [ ] **Step 3: Write the implementation**

```ts
// server/routes/reportsTrimestral.window.ts

export interface QuarterWindow {
  trimestre: string;        // "2026-Q3"
  label: string;            // "Q3 2026"
  ano: number;
  quarter: number;          // 1..4
  startMonth: number;       // 1,4,7,10
  dataStart: string;        // "2026-07-01"
  dataEnd: string;          // "2026-10-01" (limite superior EXCLUSIVO)
  fotoDate: string;         // data do snapshot p/ métricas de estoque (YYYY-MM-DD)
  meses: string[];          // ["2026-07","2026-08","2026-09"]
  parcial: boolean;
  mesesComputados: string[];// meses ≤ mês corrente (decorridos)
  prev: {
    trimestre: string;
    label: string;
    dataStart: string;
    dataEnd: string;
    meses: string[];
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function ymd(ano: number, mes: number, dia: number): string {
  return `${ano}-${pad(mes)}-${pad(dia)}`;
}

function ym(ano: number, mes: number): string {
  return `${ano}-${pad(mes)}`;
}

export function parseTrimestre(trimestre: string): { ano: number; quarter: number } | null {
  if (!/^\d{4}-Q[1-4]$/.test(trimestre)) return null;
  const [anoStr, qStr] = trimestre.split("-Q");
  return { ano: parseInt(anoStr, 10), quarter: parseInt(qStr, 10) };
}

function quarterMeses(ano: number, quarter: number): string[] {
  const startMonth = (quarter - 1) * 3 + 1;
  return [0, 1, 2].map((i) => ym(ano, startMonth + i));
}

function firstDayAfterQuarter(ano: number, quarter: number): { ano: number; mes: number } {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 3; // 1º mês após o tri (pode ser 13 → jan do ano seguinte)
  if (endMonth > 12) return { ano: ano + 1, mes: endMonth - 12 };
  return { ano, mes: endMonth };
}

export function buildQuarterWindow(trimestre: string, hoje: Date): QuarterWindow {
  const parsed = parseTrimestre(trimestre);
  if (!parsed) throw new Error(`Trimestre inválido: ${trimestre}`);
  const { ano, quarter } = parsed;
  const startMonth = (quarter - 1) * 3 + 1;
  const meses = quarterMeses(ano, quarter);
  const after = firstDayAfterQuarter(ano, quarter);
  const dataStart = ymd(ano, startMonth, 1);
  const dataEnd = ymd(after.ano, after.mes, 1);

  const mesCorrente = ym(hoje.getFullYear(), hoje.getMonth() + 1); // "YYYY-MM"
  const parcial = meses.some((m) => m >= mesCorrente);
  const mesesComputados = meses.filter((m) => m <= mesCorrente);

  // Foto: se parcial, snapshot de hoje; se fechado, primeiro dia após o tri (fim exclusivo).
  const fotoDate = parcial
    ? ymd(hoje.getFullYear(), hoje.getMonth() + 1, hoje.getDate())
    : dataEnd;

  // Trimestre anterior
  const prevQuarter = quarter === 1 ? 4 : quarter - 1;
  const prevAno = quarter === 1 ? ano - 1 : ano;
  const prevStartMonth = (prevQuarter - 1) * 3 + 1;
  const prevMeses = quarterMeses(prevAno, prevQuarter);
  const prevAfter = firstDayAfterQuarter(prevAno, prevQuarter);

  return {
    trimestre,
    label: `Q${quarter} ${ano}`,
    ano,
    quarter,
    startMonth,
    dataStart,
    dataEnd,
    fotoDate,
    meses,
    parcial,
    mesesComputados,
    prev: {
      trimestre: `${prevAno}-Q${prevQuarter}`,
      label: `Q${prevQuarter} ${prevAno}`,
      dataStart: ymd(prevAno, prevStartMonth, 1),
      dataEnd: ymd(prevAfter.ano, prevAfter.mes, 1),
      meses: prevMeses,
    },
  };
}

export function getDefaultTrimestre(hoje: Date): string {
  const q = Math.floor(hoje.getMonth() / 3) + 1;
  return `${hoje.getFullYear()}-Q${q}`;
}

export function getTrimestreOptions(hoje: Date, count: number): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  let q = Math.floor(hoje.getMonth() / 3) + 1;
  let ano = hoje.getFullYear();
  for (let i = 0; i < count; i++) {
    options.push({ value: `${ano}-Q${q}`, label: `Q${q} ${ano}` });
    q -= 1;
    if (q === 0) { q = 4; ano -= 1; }
  }
  return options;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/routes/reportsTrimestral.window.test.ts`
Expected: PASS (todos os casos).

- [ ] **Step 5: Commit**

```bash
git add server/routes/reportsTrimestral.window.ts server/routes/reportsTrimestral.window.test.ts
git commit -m "feat(reporte-trimestral): helper de janela trimestral + testes

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Endpoint skeleton + payload vazio + registro backend

Entrega um endpoint que responde 200 com o shape completo do payload **zero-preenchido** (para os slides reusados renderizarem sem quebrar) + os campos de janela/parcial reais. As seções ganham dados reais nas tasks seguintes.

**Files:**
- Modify: `server/routes/reportsTrimestral.ts` (Create)
- Modify: `server/routes.ts:62` (import), `server/routes.ts:8556` (registro)

**Interfaces:**
- Consumes: `buildQuarterWindow` (Task 1).
- Produces: `registerReportsTrimestralRoutes(app)` e o contrato de resposta:
  ```ts
  {
    trimestre: string; label: string; parcial: boolean; mesesComputados: string[];
    trend: { series: TrendPoint[]; qoq: { mrr: Qoq; vendas: Qoq; churn: Qoq } };
    turboMetrics: TurboMetrics;         // shape do mensal (types.ts)
    contratosMes: ContratosMes;
    rankingClosers: CloserRanking[]; topPontual: CloserRanking | null;
    rankingSquads: SquadRanking[]; squadDetails: SquadDetail[];
    pontualData: PontualData; techData: TechSlideData;
    faturamentoYtd: FaturamentoYtdData;
  }
  // TrendPoint = { q: string; label: string; mrr: number; vendas: number; churn: number }
  // Qoq = { atual: number; anterior: number; betterDirection: "up" | "down" }
  ```

- [ ] **Step 1: Criar o endpoint com payload zero-preenchido**

```ts
// server/routes/reportsTrimestral.ts
import type { Express } from "express";
import { buildQuarterWindow } from "./reportsTrimestral.window";

// Defaults zero-preenchidos: os slides reusados renderizam sem quebrar até a
// task da seção substituir por dados reais.
function emptyTurboMetrics() {
  return {
    mrrAtivo: 0, ticketMedioContrato: 0, ticketMedioCliente: 0,
    clientesAtivos: 0, contratosAtivos: 0, clientesTotais: 0, contratosTotais: 0,
    mrrAdicionado: 0, churnMrr: 0, churnCount: 0, pausadosMrr: 0, pausadosCount: 0,
    crosssellMrr: 0, crosssellPontual: 0, crosssellContratos: 0, crosssellHistorico: [],
    cxcsSolicitacoes: 0, faturamentoPontual: 0, pontualCommerceQtr: 0, churnMetaMensal: 0,
    receitaChurnSeries: [], retencoesSolicitacoesCount: 0, retencoesSolicitacoesValor: 0,
    retencoesCount: 0, retencoesValor: 0,
  };
}
function emptyContratosMes() {
  return {
    numContratos: 0, contratosRecorrente: 0, contratosPontual: 0,
    receitaRecorrente: 0, receitaPontual: 0, tmRecorrente: 0, tmPontual: 0,
    pipelineBreakdown: [], vendasSeries: [],
  };
}
function emptyPontualData() {
  return {
    emAberto: { valor: 0, contratos: 0, porServico: [] },
    aquisicao: { valor: 0, contratos: 0 },
    entregasMes: { porSquad: [], total: 0 },
    variacaoEstoque: { entrou: 0, saiu: 0, delta: 0 },
    entregasPorProdutoMes: [], tempoMedioEntrega: [],
  };
}
function emptyTechData(label: string) {
  return {
    kpis: { entregues: 0, valorEntregues: 0, tempoMedio: 0, adicionados: 0, valorAdicionados: 0 },
    mesLabel: label, entregasPorTipo: [], receitaPorTipo: [], emAbertoPorTipo: [], pipeline: [],
  };
}
function emptyFaturamentoYtd() {
  return { faturamentoBrutoYtd: 0, inadimplenciaYtd: 0, impostoYtd: 0, dfcRecebimentoMensal: [] };
}

export function registerReportsTrimestralRoutes(app: Express) {
  app.get("/api/reports/trimestral", async (req, res) => {
    try {
      const trimestre = req.query.trimestre as string;
      if (!trimestre || !/^\d{4}-Q[1-4]$/.test(trimestre)) {
        return res.status(400).json({ error: "Parâmetro 'trimestre' inválido. Use YYYY-Qn." });
      }
      const w = buildQuarterWindow(trimestre, new Date());

      // TODO(Task 3): trend real. TODO(Tasks 6-11): seções reais.
      res.json({
        trimestre: w.trimestre,
        label: w.label,
        parcial: w.parcial,
        mesesComputados: w.mesesComputados,
        trend: {
          series: [],
          qoq: {
            mrr: { atual: 0, anterior: 0, betterDirection: "up" as const },
            vendas: { atual: 0, anterior: 0, betterDirection: "up" as const },
            churn: { atual: 0, anterior: 0, betterDirection: "down" as const },
          },
        },
        turboMetrics: emptyTurboMetrics(),
        contratosMes: emptyContratosMes(),
        rankingClosers: [],
        topPontual: null,
        rankingSquads: [],
        squadDetails: [],
        pontualData: emptyPontualData(),
        techData: emptyTechData(w.label),
        faturamentoYtd: emptyFaturamentoYtd(),
      });
    } catch (error: any) {
      console.error("[reports/trimestral] Error:", error?.message || error);
      res.status(500).json({ error: "Erro ao gerar dados do reporte trimestral", details: error?.message });
    }
  });
}
```

- [ ] **Step 2: Registrar no `server/routes.ts`**

Adicionar o import junto da linha 62 (após `registerReportsSemanalRoutes`):

```ts
import { registerReportsTrimestralRoutes } from "./routes/reportsTrimestral";
```

Adicionar a chamada de registro junto da linha 8556 (após `registerReportsSemanalRoutes(app);`):

```ts
  // Reporte Trimestral - variante trimestral do reporte mensal
  registerReportsTrimestralRoutes(app);
```

- [ ] **Step 3: Verificar compilação e resposta**

Run: `npx tsc --noEmit`
Expected: sem novos erros.

Testar o endpoint (autenticado — usar a sessão da :3000; ver memória `reference_testar_api_autenticada_worktree.md` se estiver em worktree):

Run: `curl -s 'http://localhost:3000/api/reports/trimestral?trimestre=2026-Q2' --cookie "<cookie da sessão>" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('label',j.label,'parcial',j.parcial,'meses',j.mesesComputados,'keys',Object.keys(j))})"`
Expected: `label Q2 2026 parcial false meses [ '2026-04','2026-05','2026-06' ]` e todas as chaves do contrato presentes.

> **Nota p/ subagente:** NÃO subir/derrubar dev server nem matar a porta 3000 (memória `feedback_subagents_dev_server.md`). Se o server não estiver rodando, validar só com `npx tsc --noEmit` e deixar o teste de curl anotado para o revisor humano.

- [ ] **Step 4: Commit**

```bash
git add server/routes/reportsTrimestral.ts server/routes.ts
git commit -m "feat(reporte-trimestral): endpoint skeleton com payload zero-preenchido

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Bloco `trend` real (série por trimestre + QoQ)

O valor central da variante. Reaproveita as séries **mensais** que o mensal já calcula (`vendasSeries`, `receitaChurnSeries`) e as **agrega por trimestre em JS** — sem SQL novo. A série do gráfico deixa de ser mês-a-mês e passa a ser Q1/Q2/Q3…

**Files:**
- Modify: `server/routes/reportsTrimestral.ts`
- Test: `server/routes/reportsTrimestral.trend.test.ts` (Create)

**Interfaces:**
- Consumes: as duas queries de série do mensal (espelhar `vendasSeriesResult` e `receitaChurnResult` de `relatorioMensalSlides.ts`), estendendo o lookback para cobrir ~6 trimestres.
- Produces: função pura `aggregateTrend(vendasPorMes, mrrChurnPorMes, window): { series; qoq }` e o preenchimento de `trend` no endpoint.

- [ ] **Step 1: Write the failing test (agregação pura)**

```ts
// server/routes/reportsTrimestral.trend.test.ts
import { describe, it, expect } from "vitest";
import { aggregateTrend } from "./reportsTrimestral";
import { buildQuarterWindow } from "./reportsTrimestral.window";

// vendasPorMes: { month: "YYYY-MM"; vendasMrr: number }[]
// mrrChurnPorMes: { month: "YYYY-MM"; mrr: number; churnBrl: number }[]
const vendas = [
  { month: "2026-01", vendasMrr: 100 }, { month: "2026-02", vendasMrr: 110 }, { month: "2026-03", vendasMrr: 90 },
  { month: "2026-04", vendasMrr: 120 }, { month: "2026-05", vendasMrr: 130 }, { month: "2026-06", vendasMrr: 100 },
];
const mrrChurn = [
  { month: "2026-01", mrr: 1000, churnBrl: 30 }, { month: "2026-02", mrr: 1050, churnBrl: 20 }, { month: "2026-03", mrr: 1100, churnBrl: 25 },
  { month: "2026-04", mrr: 1150, churnBrl: 40 }, { month: "2026-05", mrr: 1200, churnBrl: 10 }, { month: "2026-06", mrr: 1300, churnBrl: 15 },
];

describe("aggregateTrend", () => {
  const w = buildQuarterWindow("2026-Q2", new Date(2026, 6, 8));
  const { series, qoq } = aggregateTrend(vendas, mrrChurn, w);

  it("vendas e churn somam os meses; mrr é a foto do ultimo mes do tri", () => {
    const q2 = series.find((s) => s.q === "2026-Q2")!;
    expect(q2.vendas).toBe(350);   // 120+130+100
    expect(q2.churn).toBe(65);     // 40+10+15
    expect(q2.mrr).toBe(1300);     // MRR de jun (fim do Q2)
  });

  it("qoq compara Q2 vs Q1", () => {
    expect(qoq.vendas.atual).toBe(350);
    expect(qoq.vendas.anterior).toBe(300);  // 100+110+90
    expect(qoq.churn.atual).toBe(65);
    expect(qoq.churn.anterior).toBe(75);    // 30+20+25
    expect(qoq.mrr.atual).toBe(1300);
    expect(qoq.mrr.anterior).toBe(1100);    // MRR de mar (fim do Q1)
    expect(qoq.churn.betterDirection).toBe("down");
    expect(qoq.mrr.betterDirection).toBe("up");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/routes/reportsTrimestral.trend.test.ts`
Expected: FAIL — `aggregateTrend is not exported`.

- [ ] **Step 3: Implementar `aggregateTrend` e exportá-la**

Adicionar em `server/routes/reportsTrimestral.ts`:

```ts
import type { QuarterWindow } from "./reportsTrimestral.window";

interface VendasMesInput { month: string; vendasMrr: number }
interface MrrChurnMesInput { month: string; mrr: number; churnBrl: number }
export interface TrendPoint { q: string; label: string; mrr: number; vendas: number; churn: number }
export interface Qoq { atual: number; anterior: number; betterDirection: "up" | "down" }

function mesToQuarter(month: string): { q: string; label: string; ano: number; quarter: number } {
  const [anoStr, mStr] = month.split("-");
  const ano = parseInt(anoStr, 10);
  const quarter = Math.floor((parseInt(mStr, 10) - 1) / 3) + 1;
  return { q: `${ano}-Q${quarter}`, label: `Q${quarter} ${ano}`, ano, quarter };
}

export function aggregateTrend(
  vendasPorMes: VendasMesInput[],
  mrrChurnPorMes: MrrChurnMesInput[],
  window: QuarterWindow,
): { series: TrendPoint[]; qoq: { mrr: Qoq; vendas: Qoq; churn: Qoq } } {
  // Acumula por trimestre: vendas e churn somam; mrr guarda a foto do ÚLTIMO mês (maior "YYYY-MM").
  const acc = new Map<string, { label: string; vendas: number; churn: number; mrrMonth: string; mrr: number }>();
  const ensure = (month: string) => {
    const { q, label } = mesToQuarter(month);
    if (!acc.has(q)) acc.set(q, { label, vendas: 0, churn: 0, mrrMonth: "", mrr: 0 });
    return acc.get(q)!;
  };
  for (const v of vendasPorMes) ensure(v.month).vendas += v.vendasMrr || 0;
  for (const m of mrrChurnPorMes) {
    const bucket = ensure(m.month);
    bucket.churn += m.churnBrl || 0;
    if (m.month >= bucket.mrrMonth) { bucket.mrrMonth = m.month; bucket.mrr = m.mrr || 0; }
  }

  const series: TrendPoint[] = [...acc.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([q, b]) => ({ q, label: b.label, mrr: b.mrr, vendas: b.vendas, churn: b.churn }));

  const atual = series.find((s) => s.q === window.trimestre);
  const anterior = series.find((s) => s.q === window.prev.trimestre);
  const mk = (get: (p: TrendPoint) => number, dir: "up" | "down"): Qoq => ({
    atual: atual ? get(atual) : 0,
    anterior: anterior ? get(anterior) : 0,
    betterDirection: dir,
  });

  return {
    series,
    qoq: {
      mrr: mk((p) => p.mrr, "up"),
      vendas: mk((p) => p.vendas, "up"),
      churn: mk((p) => p.churn, "down"),
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/routes/reportsTrimestral.trend.test.ts`
Expected: PASS.

- [ ] **Step 5: Ligar `aggregateTrend` ao endpoint com dados reais**

No handler do endpoint, **antes** do `res.json`, espelhar as duas queries de série do mensal e agregar. Abrir `server/routes/relatorioMensalSlides.ts`, localizar `vendasSeriesResult` (query "Vendas series") e `receitaChurnResult` (query "Receita×Churn series"); copiar a query, trocar o intervalo para cobrir do início do trimestre `prev` até `dataEnd` do trimestre atual (ou lookback fixo de ~18 meses terminando em `w.dataEnd`), e mapear para os inputs de `aggregateTrend`. Validar rodando a query real primeiro.

```ts
// dentro do handler, após montar `w`:
import { db } from "../db";       // conferir o caminho real do export usado no relatorioMensalSlides.ts
import { sql } from "drizzle-orm";

// (ESPELHAR vendasSeriesResult do mensal — rewindow para lookback de 18 meses até w.dataEnd)
const vendasRows = (await db.execute(sql`/* mesma lógica de vendasSeriesResult, com WHERE data >= (w.dataEnd - 18 meses) AND data < ${w.dataEnd} */`)).rows as any[];
// (ESPELHAR receitaChurnResult do mensal — mesmo lookback)
const mrrChurnRows = (await db.execute(sql`/* mesma lógica de receitaChurnResult */`)).rows as any[];

const vendasPorMes = vendasRows.map((r) => ({ month: r.month as string, vendasMrr: parseFloat(r.vendas_mrr) || 0 }));
const mrrChurnPorMes = mrrChurnRows.map((r) => ({
  month: r.month as string,
  mrr: parseFloat(r.mrr) || 0,
  churnBrl: parseFloat(r.churn_brl ?? r.churnbrl) || 0,
}));
const trend = aggregateTrend(vendasPorMes, mrrChurnPorMes, w);
```

Substituir o `trend` zero-preenchido no `res.json` por este `trend`.

> **Validação obrigatória antes de finalizar:** rodar a query de série real e conferir que `trend.series` tem os trimestres esperados (ex.: `2026-Q1`, `2026-Q2`, e `2025-Q4` parcial) e que `qoq.mrr.atual` bate com o MRR do mês de fim do trimestre no mensal.

- [ ] **Step 6: Verificar e commitar**

Run: `npx vitest run server/routes/reportsTrimestral.trend.test.ts && npx tsc --noEmit`
Expected: PASS + sem novos erros.

```bash
git add server/routes/reportsTrimestral.ts server/routes/reportsTrimestral.trend.test.ts
git commit -m "feat(reporte-trimestral): bloco trend (serie por trimestre + QoQ)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 4: Frontend — tipos, hook e casca do deck (vertical slice navegável)

Entrega a tela `/reports/trimestral` funcional: seletor de trimestre, banner de parcial, navegação, apresentação e export PDF. Slides reusados renderizam os defaults zero-preenchidos; os 2 novos entram nas Tasks 5-6. Slots de squad aparecem quando `squadDetails` tiver dados (Task 9).

**Files:**
- Create: `client/src/pages/relatorio-trimestral/types.ts`
- Create: `client/src/pages/relatorio-trimestral/useRelatorioTrimestral.ts`
- Create: `client/src/pages/RelatorioTrimestral.tsx`
- Modify: `client/src/App.tsx` (import ~142, rota ~448)
- Modify: `shared/nav-config.ts` (item ~603, mapa ~332)

**Interfaces:**
- Consumes: contrato do endpoint (Task 2) e `TrendPoint`/`Qoq` (Task 3).
- Produces: `RelatorioTrimestralData`, `useRelatorioTrimestral(trimestre)`, componente default `RelatorioTrimestral`.

- [ ] **Step 1: Tipos**

```ts
// client/src/pages/relatorio-trimestral/types.ts
import type {
  TurboMetrics, ContratosMes, CloserRanking, SquadRanking, SquadDetail,
  PontualData, TechSlideData, FaturamentoYtdData,
} from "../relatorio-mensal/types";

export interface TrendPoint { q: string; label: string; mrr: number; vendas: number; churn: number }
export interface Qoq { atual: number; anterior: number; betterDirection: "up" | "down" }

export interface TrendData {
  series: TrendPoint[];
  qoq: { mrr: Qoq; vendas: Qoq; churn: Qoq };
}

export interface RelatorioTrimestralData {
  trimestre: string;
  label: string;
  parcial: boolean;
  mesesComputados: string[];
  trend: TrendData;
  turboMetrics: TurboMetrics;
  contratosMes: ContratosMes;
  rankingClosers: CloserRanking[];
  topPontual: CloserRanking | null;
  rankingSquads: SquadRanking[];
  squadDetails: SquadDetail[];
  pontualData: PontualData;
  techData: TechSlideData;
  faturamentoYtd: FaturamentoYtdData;
}
```

- [ ] **Step 2: Hook**

```ts
// client/src/pages/relatorio-trimestral/useRelatorioTrimestral.ts
import { useQuery } from "@tanstack/react-query";
import type { RelatorioTrimestralData } from "./types";

export function useRelatorioTrimestral(trimestre: string) {
  return useQuery<RelatorioTrimestralData>({
    queryKey: ["/api/reports/trimestral", trimestre],
    queryFn: async () => {
      const res = await fetch(`/api/reports/trimestral?trimestre=${trimestre}`, { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.details || body.error || `Erro ${res.status}`);
      }
      return res.json();
    },
    enabled: !!trimestre,
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 3: Casca do deck**

Espelha a estrutura de `RelatorioMensal.tsx` (navegação por teclado, `useSlideScale`, modo apresentação, export PDF) com um modelo de slots trimestral e banner de parcial. `SlideVisaoTrimestre`/`SlideEvolucaoTrimestre` são importados mas só renderizam de fato após as Tasks 5-6 — nesta task, criar stubs mínimos que retornam `null` para não quebrar o import (serão substituídos). Melhor: criar os stubs agora.

```tsx
// client/src/pages/RelatorioTrimestral.tsx
import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2, Minimize, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRelatorioTrimestral } from "./relatorio-trimestral/useRelatorioTrimestral";
import { getTrimestreOptions, getDefaultTrimestre } from "@/../../server/routes/reportsTrimestral.window";
import SlideCapa from "./relatorio-mensal/SlideCapa";
import SlideRankingClosers from "./relatorio-mensal/SlideRankingClosers";
import SlideTurboMetrics from "./relatorio-mensal/SlideTurboMetrics";
import SlideRankingSquads from "./relatorio-mensal/SlideRankingSquads";
import SlideSquadSingle from "./relatorio-mensal/SlideSquadSingle";
import SlidePontual from "./relatorio-mensal/SlidePontual";
import SlideAreaTech from "./relatorio-mensal/SlideAreaTech";
import SlideNPS from "./relatorio-mensal/SlideNPS";
import SlideFaturamentoYtd from "./relatorio-mensal/SlideFaturamentoYtd";
import SlideGraficoContratos from "./relatorio-mensal/SlideGraficoContratos";
import SlideFraseEncerramento from "./relatorio-mensal/SlideFraseEncerramento";
import SlideVisaoTrimestre from "./relatorio-trimestral/SlideVisaoTrimestre";
import SlideEvolucaoTrimestre from "./relatorio-trimestral/SlideEvolucaoTrimestre";

const SLIDE_BASE_W = 1280;
const SLIDE_BASE_H = 720;

type TrimSlot =
  | { type: "capa" } | { type: "visao" } | { type: "vendas" } | { type: "evolucao" }
  | { type: "closers" } | { type: "turbo" } | { type: "squads-ranking" }
  | { type: "squad"; squadIndex: number } | { type: "pontual" } | { type: "tech" }
  | { type: "nps" } | { type: "faturamento" } | { type: "encerramento" };

function useSlideScale(containerRef: React.RefObject<HTMLDivElement | null>, enabled: boolean, reservedHeight = 0) {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    if (!enabled) { setScale(1); return; }
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const vw = el.clientWidth;
      const vh = el.clientHeight - reservedHeight;
      setScale(Math.min(vw / SLIDE_BASE_W, vh / SLIDE_BASE_H));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, enabled, reservedHeight]);
  return scale;
}

export default function RelatorioTrimestral() {
  const [selectedTri, setSelectedTri] = useState(() => getDefaultTrimestre(new Date()));
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const slideRef = useRef<HTMLDivElement>(null);
  const presentationRef = useRef<HTMLDivElement>(null);
  const slideAreaRef = useRef<HTMLDivElement>(null);
  const triOptions = useMemo(() => getTrimestreOptions(new Date(), 6), []);

  const presentationScale = useSlideScale(presentationRef, isPresentationMode);
  const editorScale = useSlideScale(slideAreaRef, !isPresentationMode, 60);

  const { data, isLoading, error } = useRelatorioTrimestral(selectedTri);

  const slots = useMemo<TrimSlot[]>(() => {
    const base: TrimSlot[] = [
      { type: "capa" }, { type: "visao" }, { type: "vendas" }, { type: "evolucao" },
      { type: "closers" }, { type: "turbo" }, { type: "squads-ranking" },
    ];
    const squads: TrimSlot[] = (data?.squadDetails ?? []).map((_, i) => ({ type: "squad", squadIndex: i }));
    const tail: TrimSlot[] = [
      { type: "pontual" }, { type: "tech" }, { type: "nps" }, { type: "faturamento" }, { type: "encerramento" },
    ];
    return [...base, ...squads, ...tail];
  }, [data]);
  const totalSlides = slots.length;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") { e.preventDefault(); setCurrentSlide((s) => Math.min(s + 1, totalSlides - 1)); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); setCurrentSlide((s) => Math.max(s - 1, 0)); }
      else if (e.key === "Escape") setIsPresentationMode(false);
      else if (e.key === "Home") setCurrentSlide(0);
      else if (e.key === "End") setCurrentSlide(totalSlides - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [totalSlides]);

  useEffect(() => { setCurrentSlide((s) => Math.min(s, Math.max(totalSlides - 1, 0))); }, [totalSlides]);

  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement) setIsPresentationMode(false); };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  useEffect(() => {
    if (isPresentationMode && presentationRef.current) {
      presentationRef.current.requestFullscreen?.().catch(() => {});
    }
  }, [isPresentationMode]);

  const exportPdf = useCallback(async () => {
    if (!slideRef.current || !data) return;
    setIsExporting(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const prev = currentSlide;
      for (let i = 0; i < totalSlides; i++) {
        setCurrentSlide(i);
        await new Promise((r) => setTimeout(r, 400));
        const canvas = await html2canvas(slideRef.current!, { scale: 2, useCORS: true, backgroundColor: "#09090b", logging: false });
        if (i > 0) pdf.addPage();
        const imgH = pageW * (canvas.height / canvas.width);
        const yOff = Math.max(0, (pageH - imgH) / 2);
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, yOff, pageW, Math.min(imgH, pageH));
      }
      pdf.save(`reporte-trimestral-${selectedTri}.pdf`);
      setCurrentSlide(prev);
    } catch (err) { console.error("Erro ao exportar PDF:", err); }
    finally { setIsExporting(false); }
  }, [data, currentSlide, selectedTri, totalSlides]);

  const renderSlide = () => {
    if (!data) return null;
    const slot = slots[currentSlide];
    if (!slot) return null;
    switch (slot.type) {
      case "capa":         return <SlideCapa mesLabel={data.label} />;
      case "visao":        return <SlideVisaoTrimestre data={data} />;
      case "vendas":       return <SlideGraficoContratos dados={data.contratosMes} mesLabel={data.label} />;
      case "evolucao":     return <SlideEvolucaoTrimestre trend={data.trend} />;
      case "closers":      return <SlideRankingClosers ranking={data.rankingClosers} topPontual={data.topPontual} />;
      case "turbo":        return <SlideTurboMetrics metrics={data.turboMetrics} mesLabel={data.label} />;
      case "squads-ranking": return <SlideRankingSquads ranking={data.rankingSquads} />;
      case "squad":        return <SlideSquadSingle details={data.squadDetails.slice(0, slot.squadIndex + 1)} mesLabel={data.label} />;
      case "pontual":      return <SlidePontual pontualData={data.pontualData} mesLabel={data.label} />;
      case "tech":         return <SlideAreaTech techData={data.techData} mesLabel={data.label} />;
      case "nps":          return <SlideNPS mesLabel={data.label} />;
      case "faturamento":  return <SlideFaturamentoYtd data={data.faturamentoYtd} mesLabel={data.label} />;
      case "encerramento": return <SlideFraseEncerramento />;
      default:             return null;
    }
  };

  if (isPresentationMode && data) {
    return (
      <div ref={presentationRef} className="fixed inset-0 z-50 bg-black flex items-center justify-center cursor-pointer"
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          if (e.clientX - rect.left < rect.width * 0.3) setCurrentSlide((s) => Math.max(s - 1, 0));
          else setCurrentSlide((s) => Math.min(s + 1, totalSlides - 1));
        }}>
        <div ref={slideRef} className="overflow-hidden"
          style={{ width: SLIDE_BASE_W, height: SLIDE_BASE_H, transform: `scale(${presentationScale})`, transformOrigin: "center center" }}>
          {renderSlide()}
        </div>
        <div className="absolute bottom-0 left-0 right-0 opacity-0 hover:opacity-100 transition-opacity">
          <div className="flex items-center justify-center gap-3 py-3 bg-gradient-to-t from-black/80 to-transparent">
            <span className="text-white/50 text-xs">{currentSlide + 1}/{totalSlides}</span>
            <button onClick={(e) => { e.stopPropagation(); setIsPresentationMode(false); if (document.fullscreenElement) document.exitFullscreen?.(); }} className="text-white/50 hover:text-white ml-4">
              <Minimize className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-foreground">Reporte Trimestral</h1>
          <Select value={selectedTri} onValueChange={(v) => { setSelectedTri(v); setCurrentSlide(0); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {triOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}{data?.parcial && o.value === selectedTri ? " *" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {data?.parcial && (
            <span className="text-xs text-amber-500 font-medium">
              * Trimestre em andamento — parcial (meses: {data.mesesComputados.join(", ")})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsPresentationMode(true)} disabled={!data || isLoading}>
            <Play className="h-4 w-4 mr-1" /> Apresentar
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={isExporting || isLoading}>
            {isExporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
            {isExporting ? "Exportando..." : "Exportar PDF"}
          </Button>
        </div>
      </div>

      <div ref={slideAreaRef} className="flex-1 flex flex-col items-center justify-center p-4 min-h-0 relative">
        {isLoading ? (
          <div className="flex items-center gap-3 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /> Carregando dados...</div>
        ) : error ? (
          <div className="text-red-500">Erro ao carregar dados: {(error as Error).message}</div>
        ) : data ? (
          <>
            <div ref={slideRef} className="rounded-xl overflow-hidden shadow-2xl border border-zinc-800 relative"
              style={{ width: SLIDE_BASE_W, height: SLIDE_BASE_H, transform: `scale(${editorScale})`, transformOrigin: "center center" }}>
              {renderSlide()}
            </div>
            <div className="flex items-center gap-4 mt-4">
              <Button variant="ghost" size="icon" onClick={() => setCurrentSlide((s) => Math.max(s - 1, 0))} disabled={currentSlide === 0}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-1.5">
                {slots.map((_, i) => (
                  <button key={i} onClick={() => setCurrentSlide(i)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${i === currentSlide ? "bg-primary w-6" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"}`} />
                ))}
              </div>
              <Button variant="ghost" size="icon" onClick={() => setCurrentSlide((s) => Math.min(s + 1, totalSlides - 1))} disabled={currentSlide === totalSlides - 1}>
                <ChevronRight className="h-5 w-5" />
              </Button>
              <span className="text-xs text-muted-foreground ml-2">{currentSlide + 1}/{totalSlides}</span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
```

> **Nota sobre o import do helper de janela:** o helper vive em `server/`. Se o import cross-boundary (`@/../../server/...`) não resolver no bundler do client, **duplicar** as funções `getTrimestreOptions`/`getDefaultTrimestre` (são puras e pequenas) dentro de `client/src/pages/relatorio-trimestral/` num arquivo local `trimestre-options.ts`. Verificar na compilação (Step 6) e escolher o caminho que compila.

- [ ] **Step 4: Criar stubs dos 2 slides novos (substituídos nas Tasks 5-6)**

```tsx
// client/src/pages/relatorio-trimestral/SlideVisaoTrimestre.tsx
import type { RelatorioTrimestralData } from "./types";
export default function SlideVisaoTrimestre({ data }: { data: RelatorioTrimestralData }) {
  return <div className="w-full h-full bg-zinc-950 flex items-center justify-center text-white">Visão do Trimestre — {data.label}</div>;
}
```

```tsx
// client/src/pages/relatorio-trimestral/SlideEvolucaoTrimestre.tsx
import type { TrendData } from "./types";
export default function SlideEvolucaoTrimestre({ trend }: { trend: TrendData }) {
  return <div className="w-full h-full bg-zinc-950 flex items-center justify-center text-white">Evolução — {trend.series.length} trimestres</div>;
}
```

- [ ] **Step 5: Registrar rota e menu**

`client/src/App.tsx` — após a linha 142:
```tsx
const RelatorioTrimestral = lazyWithRetry(() => import("@/pages/RelatorioTrimestral"));
```
`client/src/App.tsx` — após a linha 448:
```tsx
<Route path="/reports/trimestral">{() => <ProtectedRoute path="/reports/trimestral" component={RelatorioTrimestral} />}</Route>
```

`shared/nav-config.ts` — após a linha 603 (item Reporte Semanal):
```ts
{ title: 'Reporte Trimestral', url: '/reports/trimestral', icon: 'CalendarRange', permissionKey: PERMISSION_KEYS.REPORTS.MENSAL },
```
`shared/nav-config.ts` — após a linha 332 (mapa path→permissão):
```ts
'/reports/trimestral': PERMISSION_KEYS.REPORTS.MENSAL,
```

- [ ] **Step 6: Verificar compilação**

Run: `npx tsc --noEmit`
Expected: sem novos erros. Corrigir o import do helper de janela conforme a nota do Step 3 se necessário.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/RelatorioTrimestral.tsx client/src/pages/relatorio-trimestral/ client/src/App.tsx shared/nav-config.ts
git commit -m "feat(reporte-trimestral): casca do deck, rota e menu (vertical slice)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 5: Slide novo — Visão do Trimestre (cards QoQ)

**Files:**
- Modify: `client/src/pages/relatorio-trimestral/SlideVisaoTrimestre.tsx` (substitui o stub)

**Interfaces:**
- Consumes: `RelatorioTrimestralData` (usa `data.trend.qoq`, `data.turboMetrics`, `data.label`, `data.parcial`).

- [ ] **Step 1: Implementar o slide**

Reusar os primitivos do deck (`SlideLayout`, `SlideHeader` de `../relatorio-mensal/SlideComponents`) para consistência visual. Cada card mostra o valor atual do trimestre, a variação vs o trimestre anterior e a cor semântica por `betterDirection` (up: positivo=verde; down: positivo=vermelho).

```tsx
// client/src/pages/relatorio-trimestral/SlideVisaoTrimestre.tsx
import { TrendingUp } from "lucide-react";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader, SecondaryCard } from "../relatorio-mensal/SlideComponents";
import type { RelatorioTrimestralData, Qoq } from "./types";

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

function variacaoPct(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

function VariacaoBadge({ q }: { q: Qoq }) {
  const pct = variacaoPct(q.atual, q.anterior);
  if (pct === null) return <span className="text-zinc-500 text-sm">—</span>;
  const positivo = pct >= 0;
  const bom = q.betterDirection === "up" ? positivo : !positivo;
  const cor = bom ? "text-emerald-400" : "text-red-400";
  const seta = positivo ? "▲" : "▼";
  return <span className={`${cor} text-sm font-bold tabular-nums`}>{seta} {Math.abs(pct).toFixed(1).replace(".", ",")}%</span>;
}

function Card({ label, valor, q }: { label: string; valor: string; q: Qoq }) {
  return (
    <SecondaryCard className="p-5 flex flex-col gap-2">
      <p className="text-[11px] text-zinc-500 uppercase tracking-widest">{label}</p>
      <p className="text-3xl font-black text-white tabular-nums">{valor}</p>
      <div className="flex items-center gap-2">
        <VariacaoBadge q={q} />
        <span className="text-xs text-zinc-500">vs {formatBRL(q.anterior)}</span>
      </div>
    </SecondaryCard>
  );
}

export default function SlideVisaoTrimestre({ data }: { data: RelatorioTrimestralData }) {
  const { qoq } = data.trend;
  const churnPct = data.turboMetrics.mrrAtivo > 0
    ? (data.turboMetrics.churnMrr / data.turboMetrics.mrrAtivo) * 100 : 0;
  return (
    <SlideLayout section="commerce" padding="28px 36px">
      <SlideHeader
        icon={TrendingUp}
        iconColor="text-emerald-400"
        title={`Visão do Trimestre — ${data.label}${data.parcial ? " (parcial)" : ""}`}
        gradientColor="#10b981"
      />
      <div className="flex-1 grid grid-cols-3 gap-5 content-center">
        <Card label="MRR (fim do tri)" valor={formatBRL(qoq.mrr.atual)} q={qoq.mrr} />
        <Card label="Vendas (recorrente)" valor={formatBRL(qoq.vendas.atual)} q={qoq.vendas} />
        <Card label="Churn (R$)" valor={formatBRL(qoq.churn.atual)} q={qoq.churn} />
        <SecondaryCard className="p-5 flex flex-col gap-2">
          <p className="text-[11px] text-zinc-500 uppercase tracking-widest">Churn %</p>
          <p className="text-3xl font-black text-white tabular-nums">{churnPct.toFixed(1).replace(".", ",")}%</p>
          <span className="text-xs text-zinc-500">churn R$ ÷ MRR ativo</span>
        </SecondaryCard>
        <SecondaryCard className="p-5 flex flex-col gap-2">
          <p className="text-[11px] text-zinc-500 uppercase tracking-widest">Clientes ativos</p>
          <p className="text-3xl font-black text-white tabular-nums">{data.turboMetrics.clientesAtivos}</p>
          <span className="text-xs text-zinc-500">foto do fim do tri</span>
        </SecondaryCard>
        <SecondaryCard className="p-5 flex flex-col gap-2">
          <p className="text-[11px] text-zinc-500 uppercase tracking-widest">Ticket médio</p>
          <p className="text-3xl font-black text-white tabular-nums">{formatBRL(data.turboMetrics.ticketMedioCliente)}</p>
          <span className="text-xs text-zinc-500">MRR ÷ clientes</span>
        </SecondaryCard>
      </div>
    </SlideLayout>
  );
}
```

> **Antes de codar:** abrir `client/src/pages/relatorio-mensal/SlideComponents.tsx` e confirmar os nomes/props exatos exportados (`SlideHeader`, `SecondaryCard`, e assinatura). Ajustar o import se os nomes diferirem. Confirmar também que `SlideLayout` aceita `section`/`padding`.

- [ ] **Step 2: Verificar compilação**

Run: `npx tsc --noEmit`
Expected: sem novos erros.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/relatorio-trimestral/SlideVisaoTrimestre.tsx
git commit -m "feat(reporte-trimestral): slide Visao do Trimestre (cards QoQ)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 6: Slide novo — Evolução por Trimestre (gráficos)

**Files:**
- Modify: `client/src/pages/relatorio-trimestral/SlideEvolucaoTrimestre.tsx` (substitui o stub)

**Interfaces:**
- Consumes: `TrendData` (usa `trend.series` — eixo X = trimestres).

- [ ] **Step 1: Implementar com Recharts**

```tsx
// client/src/pages/relatorio-trimestral/SlideEvolucaoTrimestre.tsx
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { Activity } from "lucide-react";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader } from "../relatorio-mensal/SlideComponents";
import type { TrendData } from "./types";

function fmtK(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return String(v);
}

export default function SlideEvolucaoTrimestre({ trend }: { trend: TrendData }) {
  const data = trend.series.map((s) => ({ label: s.label, mrr: s.mrr, vendas: s.vendas, churn: s.churn }));
  return (
    <SlideLayout section="commerce" padding="28px 36px">
      <SlideHeader icon={Activity} iconColor="text-sky-400" title="Evolução por Trimestre" gradientColor="#0ea5e9" />
      <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">
        <div className="flex flex-col">
          <p className="text-sm text-zinc-400 mb-2">MRR (fim de cada trimestre)</p>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="label" stroke="#a1a1aa" fontSize={12} />
              <YAxis stroke="#a1a1aa" fontSize={12} tickFormatter={fmtK} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", color: "#fff" }} />
              <Line type="monotone" dataKey="mrr" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col">
          <p className="text-sm text-zinc-400 mb-2">Vendas (recorrente) × Churn por trimestre</p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="label" stroke="#a1a1aa" fontSize={12} />
              <YAxis stroke="#a1a1aa" fontSize={12} tickFormatter={fmtK} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", color: "#fff" }} />
              <Bar dataKey="vendas" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              <Bar dataKey="churn" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </SlideLayout>
  );
}
```

- [ ] **Step 2: Verificar compilação**

Run: `npx tsc --noEmit`
Expected: sem novos erros.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/relatorio-trimestral/SlideEvolucaoTrimestre.tsx
git commit -m "feat(reporte-trimestral): slide Evolucao por Trimestre (graficos)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Tasks 7-11: Seções reais (rewindow das queries do mensal)

Cada task espelha as queries de uma seção do `relatorioMensalSlides.ts`, troca a janela mensal (`dataStart`/`dataEnd`) pela janela trimestral conforme a regra de agregação, valida com query real e substitui o campo zero-preenchido no `res.json` do endpoint trimestral. **Receita de rewindow por tipo:**

- **Fluxo** (churn, vendas, entregas, faturamento, cross-sell): trocar o `WHERE data >= ${dataStart} AND data < ${dataEnd}` mensal por `>= ${w.dataStart} AND < ${w.dataEnd}`. Em trimestre parcial, `w.dataEnd` já é o 1º dia após o tri; a query naturalmente pega só o que existe até hoje.
- **Estoque/foto** (MRR ativo, clientes/contratos ativos, estoque pontual, pausados): trocar a data do snapshot do mensal (1º dia do mês seguinte) por `${w.fotoDate}`. Usar o snapshot mais recente `<= w.fotoDate` (padrão `ORDER BY data_snapshot DESC LIMIT 1` ou `MAX(data_snapshot) <= fotoDate`).
- **Ratio** (ticket médio, churn %, NRR): recalcular no JS a partir dos agregados trimestrais (não somar médias mensais).

**Regra comum para todas:** rodar a query real primeiro (local/prod), conferir contra o mensal de um mês do trimestre, só então gravar. `npx tsc --noEmit` + commit por task.

---

### Task 7: Seção Receita/MRR/Churn (`turboMetrics`)

**Files:** Modify `server/routes/reportsTrimestral.ts`.

- [ ] **Step 1:** Espelhar as queries do mensal que montam `turboMetrics` — `turboMrrResult` (MRR ativo, clientes/contratos ativos, pausados → **foto** em `w.fotoDate`), `turboChurnResult` (churn MRR + count → **soma** no tri), `turboFaturamentoResult`/`turboCxcsResult`/`crosssellHistoricoResult`/`turboRetencoesResult` (**fluxo** → soma), e `receitaChurnResult` (série — já obtida na Task 3). Recalcular ratios no JS: `ticketMedioCliente = mrrAtivo / clientesAtivos`, `ticketMedioContrato = mrrAtivo / contratosAtivos`.
- [ ] **Step 2:** Validar rodando o MRR foto real em `w.fotoDate` e comparar com o mensal do último mês do trimestre.
- [ ] **Step 3:** Substituir `turboMetrics: emptyTurboMetrics()` pelo objeto real no `res.json`. `receitaChurnSeries` pode continuar `[]` (o gráfico de evolução usa `trend`, não essa série).
- [ ] **Step 4:** `npx tsc --noEmit` e commit `feat(reporte-trimestral): secao turboMetrics agregada no tri`.

---

### Task 8: Seção Vendas/Contratos + Ranking Closers (`contratosMes`, `rankingClosers`, `topPontual`)

**Files:** Modify `server/routes/reportsTrimestral.ts`.

- [ ] **Step 1:** Espelhar `graficoResult`/`pipelineBreakdownResult` (contratos do período → **soma** no tri: `numContratos`, `receitaRecorrente`, `receitaPontual`, `pipelineBreakdown`) e `rankingResult`/`closerPhotosResult`/`topPontual` (ranking de closers no tri → **soma** por closer, re-rankeado sobre o trimestre inteiro). Recalcular `tmRecorrente`/`tmPontual` no JS. Deixar `vendasSeries: []` (a evolução usa `trend`).
- [ ] **Step 2:** Validar contagem de contratos do tri vs soma dos 3 meses no mensal.
- [ ] **Step 3:** Substituir `contratosMes`, `rankingClosers`, `topPontual` no `res.json`.
- [ ] **Step 4:** `npx tsc --noEmit` e commit `feat(reporte-trimestral): secao vendas/contratos + ranking closers`.

---

### Task 9: Seção Squads (`rankingSquads`, `squadDetails`)

**Files:** Modify `server/routes/reportsTrimestral.ts`.

- [ ] **Step 1:** Espelhar `rankingSquadsResult` (ranking por squad no tri), `churnSquadsResult` (churn por squad + lista de clientes → **soma** no tri; manter a distinção abonado/total), `pontualEntregueSquadResult` (pontual por squad → soma), e o MRR por squad **foto** em `w.fotoDate` (espelhar `mrrAnteriorSquadsResult`/base). Recalcular por squad: `churnPct`, `ticketMedio`, `nrrBrl`/`nrrPct`, `evolucaoMrr`. `squadDetails` habilita os slots de squad dinâmicos no frontend (Task 4).
- [ ] **Step 2:** Validar `squadDetails[].mrr` (foto) e `churnBrl` (soma do tri) contra o mensal.
- [ ] **Step 3:** Substituir `rankingSquads` e `squadDetails` no `res.json`.
- [ ] **Step 4:** `npx tsc --noEmit` e commit `feat(reporte-trimestral): secao squads (ranking + detalhes) no tri`.

---

### Task 10: Seção Pontual (`pontualData`)

**Files:** Modify `server/routes/reportsTrimestral.ts`.

- [ ] **Step 1:** Espelhar `pontualEmAbertoResult` (estoque em aberto → **foto** em `w.fotoDate`), `pontualAquisicaoResult`/`pontualEntregasSquadResult` (aquisição/entregas → **soma** no tri), `pontualEntregasProdutoMesResult` (entregas por produto — manter por mês do tri, os 3 meses), `pontualTempoMedioResult` (tempo médio → recalcular sobre entregas do tri) e `variacaoEstoque` (delta entre foto de início e fim do tri).
- [ ] **Step 2:** Validar estoque em aberto (foto) e total de entregas (soma) contra o mensal.
- [ ] **Step 3:** Substituir `pontualData` no `res.json`.
- [ ] **Step 4:** `npx tsc --noEmit` e commit `feat(reporte-trimestral): secao pontual agregada no tri`.

---

### Task 11: Seção Tech + Financeiro YTD (`techData`, `faturamentoYtd`)

**Files:** Modify `server/routes/reportsTrimestral.ts`.

- [ ] **Step 1:** Espelhar `techKpisEntreguesResult`/`techKpisAdicionadosResult`/`techEntregasPorTipoResult`/`techEmAbertoResult`/`techPipelineResult` — entregas/adicionados/receita → **soma** no tri; em aberto/pipeline → **foto** em `w.fotoDate`; `tempoMedio` → recalcular. `faturamentoYtd` (espelhar `faturamentoYtdResult`/`dfcRecebimentoYtdResult`): **YTD do início do ano até `w.dataEnd`** (limite superior do tri), não só o tri — mantém a semântica "YTD" do slide, agora fechando no fim do trimestre.
- [ ] **Step 2:** Validar faturamento YTD até o fim do tri e um KPI de Tech contra o mensal.
- [ ] **Step 3:** Substituir `techData` e `faturamentoYtd` no `res.json`.
- [ ] **Step 4:** `npx tsc --noEmit` e commit `feat(reporte-trimestral): secao tech + faturamento YTD no tri`.

---

### Task 12: Verificação end-to-end e fechamento

**Files:** nenhum arquivo novo (verificação).

- [ ] **Step 1: Suite de testes**

Run: `npx vitest run server/routes/reportsTrimestral.window.test.ts server/routes/reportsTrimestral.trend.test.ts`
Expected: PASS.

- [ ] **Step 2: Type check completo**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Exercitar o endpoint (revisor humano, com dev server rodando)**

Trimestre fechado:
Run: `curl -s 'http://localhost:3000/api/reports/trimestral?trimestre=2026-Q2' --cookie "<cookie>" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('parcial',j.parcial,'mrr',j.turboMetrics.mrrAtivo,'churn',j.turboMetrics.churnMrr,'squads',j.squadDetails.length,'trendQs',j.trend.series.map(s=>s.q),'qoqMrr',j.trend.qoq.mrr)})"`
Expected: `parcial false`, MRR/churn > 0, `squadDetails` não vazio, `trend.series` com os trimestres, `qoq.mrr` com atual/anterior coerentes.

Trimestre parcial:
Run: `curl -s 'http://localhost:3000/api/reports/trimestral?trimestre=2026-Q3' --cookie "<cookie>" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('parcial',j.parcial,'meses',j.mesesComputados)})"`
Expected: `parcial true`, `mesesComputados` só com os meses decorridos (ex.: `['2026-07']`).

- [ ] **Step 4: Conferência visual (revisor humano)**

Abrir `/reports/trimestral`, trocar entre um tri fechado e o parcial, navegar por todos os slides, entrar no modo apresentação e exportar o PDF. Conferir dark mode. Confirmar que o banner de parcial aparece só no tri em andamento e que a Visão do Trimestre mostra as setas QoQ com cor semântica.

- [ ] **Step 5: Reconciliação de sanidade (revisor humano)**

Para um trimestre fechado, conferir que o MRR (foto de fim do tri) bate com o Reporte Mensal do último mês do trimestre, e que o churn do tri ≈ soma do churn dos 3 meses no mensal. Divergências pequenas por reclassificações/overrides mensais são esperadas (documentar; não bloquear).

- [ ] **Step 6: Atualizar memória e Obsidian**

Seguir o Workflow Pós-Conclusão do CLAUDE.md: registrar no vault Obsidian e, se houver chamado associado, `status='review'`. Criar/atualizar memória de referência apontando a tela `/reports/trimestral` e as decisões-chave (agregação por tipo, tri parcial, QoQ, NPS hardcoded).

---

## Self-Review

**Spec coverage:**
- Endpoint dedicado `?trimestre=YYYY-Qn` → Tasks 1-2. ✓
- Agregação por tipo (fluxo/estoque/ratio) → Global Constraints + Tasks 7-11 (receita de rewindow). ✓
- Trimestre parcial com aviso → Task 1 (`parcial`/`fotoDate`) + Task 4 (banner/`*`). ✓
- QoQ vs tri anterior → Task 3 (`aggregateTrend`) + Task 5 (cards). ✓
- Gráficos por trimestre (não mês-a-mês) → Task 3 (série por tri) + Task 6. ✓
- Reuso dos slides do mensal → Task 4 (`renderSlide`). ✓
- Subconjunto estratégico (corta RH/Top Operadores/SDR) → Task 4 (slots não incluem essas seções). ✓
- NPS hardcoded reusado → Task 4 (`SlideNPS` com label). ✓
- Registro rota/menu/permissão → Task 4 Step 5. ✓
- Highlights v2 → fora de escopo (não há task). ✓

**Placeholder scan:** As Tasks 7-11 usam "receita de rewindow" com pointers às queries nomeadas do mensal em vez de SQL literal — intencional: são adaptações de queries validadas em produção que exigem leitura + validação real (Global Constraints proíbem escrever SQL sem rodar antes). Cada uma tem entregável testável e commit próprio. Todo código net-new (helper, trend, shell, 2 slides, tipos, hook) está completo.

**Type consistency:** `RelatorioTrimestralData` (client) espelha o contrato do endpoint (server); `TrendPoint`/`Qoq` idênticos nos dois lados; `aggregateTrend` retorna exatamente `{ series, qoq }` consumido por `trend`. Slides reusados recebem os shapes de `../relatorio-mensal/types` (importados em `client/.../types.ts`). `fotoDate`/`parcial`/`mesesComputados` produzidos na Task 1 e consumidos nas Tasks 4/7-11.
