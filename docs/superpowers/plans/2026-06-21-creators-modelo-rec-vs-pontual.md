# Creators: Recorrente × Pontual — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a página `/creators-modelo` que compara LT, LTV e churn dos clientes Creators no modelo Recorrente vs Pontual, para subsidiar a decisão estratégica do pivot de março/2026.

**Architecture:** Um endpoint `GET /api/creators-modelo` puxa todas as linhas de Creators da view `cortex_core.vw_lt_contratos` (recorrente + pontual) e delega 100% da regra de negócio a helpers puros e testáveis em `server/routes/creatorsModelo.helpers.ts`. O frontend (`CreatorsModelo.tsx` + componentes em `client/src/components/creators-modelo/`) recebe um payload pré-computado e faz os toggles (cliente/contrato, média/mediana, situação) client-side; só o filtro de período re-busca. Reaproveita `mediana` de `ltLtvChurn.helpers` e o funil de entregas (`toJornadas`/`buildFunil`) de `churnPontorrente.helpers`.

**Tech Stack:** TypeScript, Express, Drizzle (`db.execute(sql\`\`)`), Vitest + supertest (backend); React + React Query + Recharts + Tailwind (frontend). Wouter para rotas.

## Global Constraints

- **Dark/light mode obrigatório** em todo componente: usar variantes `dark:` do Tailwind (ex.: `bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50`). Nunca hardcodar cor.
- **Moeda** sempre via `formatCurrencyNoDecimals` de `@/lib/utils` (sem decimais).
- **Commits** Conventional Commits, granulares (uma mudança lógica por commit), com rodapé `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Testes** rodam com `npx vitest run <arquivo>`. Helpers são puros (sem banco); rotas testadas com supertest + `db.execute` mockado.
- **Fonte de dados única:** `cortex_core.vw_lt_contratos`, filtrando `produto = 'Creators'`. Nunca usar `caz_parcelas` nem `cup_churn.lt` (corrompido).
- **Universo Creators:** `tipo_receita IN ('recorrente','pontual')` (exclui `sem_valor`).
- **Datas:** o helper recebe `hoje` ('YYYY-MM-DD') por parâmetro (determinismo nos testes); a rota passa `new Date().toISOString().slice(0,10)`. Mês de uma data = `slice(0,7)`. 1 mês = 30.44 dias.
- **Não rodar git destrutivo encadeado com pipe.** Push sem `--force`.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `server/routes/creatorsModelo.helpers.ts` (criar) | Tipos + toda a lógica pura: classificação modelo/estado, montagem de unidades, agregação média/mediana, curva recorrente, recompra, payload final |
| `server/routes/creatorsModelo.helpers.test.ts` (criar) | Testes unitários dos helpers |
| `server/routes/creatorsModelo.ts` (criar) | Endpoint `GET /api/creators-modelo`: query na view + delega ao helper |
| `server/routes/creatorsModelo.test.ts` (criar) | Teste do endpoint (supertest + db mockado) |
| `server/routes.ts` (modificar) | Importar e registrar `registerCreatorsModeloRoutes` |
| `client/src/components/creators-modelo/types.ts` (criar) | Tipos do payload (espelham o backend) |
| `client/src/components/creators-modelo/utils.ts` (criar) | `fetchJson`, `buildUrl`, helpers de formatação locais |
| `client/src/components/creators-modelo/AvisosMetodologicos.tsx` (criar) | Banners de honestidade metodológica |
| `client/src/components/creators-modelo/HeadlineCards.tsx` (criar) | 3 cards: Recorrente, Pontual, Δ |
| `client/src/components/creators-modelo/TabelaLtLtv.tsx` (criar) | Tabela principal LT/LTV por modelo/estado |
| `client/src/components/creators-modelo/FunilSobrevivencia.tsx` (criar) | Funil de entregas (pontual) + curva mensal (recorrente) |
| `client/src/components/creators-modelo/CardRecompra.tsx` (criar) | Card de recompra dos avulsos |
| `client/src/pages/CreatorsModelo.tsx` (criar) | Página: filtros + composição dos componentes |
| `client/src/App.tsx` (modificar) | Lazy import + `<Route path="/creators-modelo">` |
| `shared/nav-config.ts` (modificar) | Permission key + route map + item de menu (Gestão) |

---

## Task 1: Helpers — tipos e classificação

**Files:**
- Create: `server/routes/creatorsModelo.helpers.ts`
- Test: `server/routes/creatorsModelo.helpers.test.ts`

**Interfaces:**
- Consumes: nada (primeira task).
- Produces:
  - `interface RawRow { idTask, idSubtask, produto, servico, status, tipoReceita, valorr, valorp, ltMeses, ltvRecorrente, isAtivo, isChurned, dataInconsistente, dataInicio, dataFim }`
  - `type Modelo = "recorrente" | "pontual"`
  - `type EstadoRec = "ativo" | "cancelado"`
  - `type EstadoPont = "em_producao" | "concluido" | "cancelado"`
  - `function classifyModelo(r: RawRow): Modelo | null`
  - `function classifyEstadoRecorrente(r: RawRow): EstadoRec`
  - `function classifyEstadoPontual(status: string | null): EstadoPont`
  - `function isSequenciado(servico: string | null): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// server/routes/creatorsModelo.helpers.test.ts
import { describe, it, expect } from "vitest";
import {
  classifyModelo, classifyEstadoRecorrente, classifyEstadoPontual, isSequenciado,
  type RawRow,
} from "./creatorsModelo.helpers";

function row(p: Partial<RawRow>): RawRow {
  return {
    idTask: "T1", idSubtask: "S1", produto: "Creators", servico: "Creators Pontual",
    status: "ativo", tipoReceita: "pontual", valorr: 0, valorp: 5000,
    ltMeses: null, ltvRecorrente: null, isAtivo: true, isChurned: false,
    dataInconsistente: false, dataInicio: "2026-03-01", dataFim: null, ...p,
  };
}

describe("classifyModelo", () => {
  it("recorrente quando tipo_receita=recorrente", () => {
    expect(classifyModelo(row({ tipoReceita: "recorrente" }))).toBe("recorrente");
  });
  it("pontual quando tipo_receita=pontual", () => {
    expect(classifyModelo(row({ tipoReceita: "pontual" }))).toBe("pontual");
  });
  it("null para sem_valor", () => {
    expect(classifyModelo(row({ tipoReceita: "sem_valor" }))).toBeNull();
  });
});

describe("classifyEstadoRecorrente", () => {
  it("cancelado quando is_churned", () => {
    expect(classifyEstadoRecorrente(row({ isChurned: true }))).toBe("cancelado");
  });
  it("ativo quando não churned", () => {
    expect(classifyEstadoRecorrente(row({ isChurned: false }))).toBe("ativo");
  });
});

describe("classifyEstadoPontual", () => {
  it("concluido para entregue", () => {
    expect(classifyEstadoPontual("entregue")).toBe("concluido");
  });
  it("cancelado para cancelado/inativo e não usar", () => {
    expect(classifyEstadoPontual("cancelado/inativo")).toBe("cancelado");
    expect(classifyEstadoPontual("não usar")).toBe("cancelado");
  });
  it("em_producao para triagem/onboarding/ativo/pausado", () => {
    expect(classifyEstadoPontual("triagem")).toBe("em_producao");
    expect(classifyEstadoPontual("ativo")).toBe("em_producao");
  });
});

describe("isSequenciado", () => {
  it("true para serviços com 'entrega' numerada", () => {
    expect(isSequenciado("1ª Entrega - Creators")).toBe(true);
    expect(isSequenciado("Entrega 3 - Creators - Starter")).toBe(true);
  });
  it("false para pacote avulso", () => {
    expect(isSequenciado("Creators Pontual")).toBe(false);
    expect(isSequenciado("Creators Scale")).toBe(false);
  });
  it("false para falso-positivo 'rótulos'", () => {
    expect(isSequenciado("Entrega de 3 rótulos")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/routes/creatorsModelo.helpers.test.ts`
Expected: FAIL — "Failed to resolve import './creatorsModelo.helpers'".

- [ ] **Step 3: Write minimal implementation**

```ts
// server/routes/creatorsModelo.helpers.ts
import { extractNivelEntrega } from "./churnPontorrente.helpers";

export interface RawRow {
  idTask: string | null;
  idSubtask: string | null;
  produto: string | null;
  servico: string;
  status: string | null;
  tipoReceita: string | null;       // 'recorrente' | 'pontual' | 'sem_valor'
  valorr: number;
  valorp: number;
  ltMeses: number | null;           // já calculado na view (recorrente)
  ltvRecorrente: number | null;     // já = valorr * ltMeses (realizado até hoje)
  isAtivo: boolean;
  isChurned: boolean;
  dataInconsistente: boolean;
  dataInicio: string | null;        // 'YYYY-MM-DD'
  dataFim: string | null;           // 'YYYY-MM-DD'
}

export type Modelo = "recorrente" | "pontual";
export type EstadoRec = "ativo" | "cancelado";
export type EstadoPont = "em_producao" | "concluido" | "cancelado";

export function classifyModelo(r: RawRow): Modelo | null {
  if (r.tipoReceita === "recorrente") return "recorrente";
  if (r.tipoReceita === "pontual") return "pontual";
  return null;
}

/** Recorrente: 2 estados. Churned = cancelado; o resto = ativo. */
export function classifyEstadoRecorrente(r: RawRow): EstadoRec {
  return r.isChurned ? "cancelado" : "ativo";
}

/** Pontual: 3 estados. 'entregue'=sucesso, cancelado/inativo|não usar=churn, resto=em produção. */
export function classifyEstadoPontual(status: string | null): EstadoPont {
  const s = (status ?? "").trim().toLowerCase();
  if (s === "entregue") return "concluido";
  if (s === "cancelado/inativo" || s === "não usar") return "cancelado";
  return "em_producao";
}

/** Contrato pontual com número de entrega no serviço (jornada sequenciada). */
export function isSequenciado(servico: string | null): boolean {
  if (!servico) return false;
  if (/rótulos/i.test(servico)) return false;
  return extractNivelEntrega(servico) != null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/routes/creatorsModelo.helpers.test.ts`
Expected: PASS (all 4 describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add server/routes/creatorsModelo.helpers.ts server/routes/creatorsModelo.helpers.test.ts
git commit -m "feat(creators-modelo): helpers de classificação modelo/estado

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Helpers — unidades e agregação (média/mediana, LT/LTV/nº entregas/idade)

**Files:**
- Modify: `server/routes/creatorsModelo.helpers.ts`
- Test: `server/routes/creatorsModelo.helpers.test.ts`

**Interfaces:**
- Consumes (Task 1): `RawRow`, `classifyEstadoRecorrente`, `classifyEstadoPontual`.
- Produces:
  - `interface Unit { estado: EstadoRec | EstadoPont; lt: number | null; nEntregas: number; ltv: number; idadeMeses: number }`
  - `interface Metricas { n, ltMesesMedia, ltMesesMediana, nEntregasMedia, nEntregasMediana, ltvMedia, ltvMediana, ltvTotal, idadeMediaMeses }`
  - `function mesesEntre(de: string, ate: string): number`
  - `function buildUnitsRecorrente(rows: RawRow[], unidade: "cliente" | "contrato", hoje: string): Unit[]`
  - `function buildUnitsPontual(rows: RawRow[], unidade: "cliente" | "contrato", hoje: string): Unit[]`
  - `function aggregateMetricas(units: Unit[]): Metricas`

- [ ] **Step 1: Write the failing test**

```ts
// adicionar em server/routes/creatorsModelo.helpers.test.ts
import {
  buildUnitsRecorrente, buildUnitsPontual, aggregateMetricas, mesesEntre,
} from "./creatorsModelo.helpers";

const HOJE = "2026-06-21";

describe("mesesEntre", () => {
  it("conta meses (30.44 dias) entre duas datas", () => {
    expect(mesesEntre("2026-01-01", "2026-04-01")).toBeCloseTo(2.96, 1);
  });
  it("0 quando ate < de", () => {
    expect(mesesEntre("2026-04-01", "2026-01-01")).toBe(0);
  });
});

describe("buildUnitsRecorrente", () => {
  it("por contrato: usa ltMeses e ltvRecorrente, exclui lt de inconsistentes", () => {
    const rows = [
      row({ tipoReceita: "recorrente", valorr: 1000, ltMeses: 5, ltvRecorrente: 5000, isChurned: true, dataInconsistente: false, dataInicio: "2026-01-01" }),
      row({ tipoReceita: "recorrente", valorr: 2000, ltMeses: 99, ltvRecorrente: 198000, isChurned: true, dataInconsistente: true, dataInicio: "2026-01-01" }),
    ];
    const units = buildUnitsRecorrente(rows, "contrato", HOJE);
    expect(units).toHaveLength(2);
    expect(units[0].lt).toBe(5);
    expect(units[0].ltv).toBe(5000);
    expect(units[1].lt).toBeNull(); // inconsistente → lt não conta
    expect(units[1].ltv).toBe(198000);
  });
  it("por cliente: agrega LTV e usa span de início→fim", () => {
    const rows = [
      row({ idTask: "A", tipoReceita: "recorrente", valorr: 1000, ltMeses: 3, ltvRecorrente: 3000, isChurned: true, dataInicio: "2026-01-01", dataFim: "2026-04-01" }),
      row({ idTask: "A", tipoReceita: "recorrente", valorr: 1000, ltMeses: 2, ltvRecorrente: 2000, isChurned: true, dataInicio: "2026-02-01", dataFim: "2026-04-01" }),
    ];
    const units = buildUnitsRecorrente(rows, "cliente", HOJE);
    expect(units).toHaveLength(1);
    expect(units[0].ltv).toBe(5000); // soma
    expect(units[0].lt).toBeCloseTo(2.96, 1); // jan→abr
  });
  it("por cliente ativo: span vai até hoje", () => {
    const units = buildUnitsRecorrente(
      [row({ idTask: "B", tipoReceita: "recorrente", valorr: 1000, ltMeses: 1, ltvRecorrente: 1000, isChurned: false, dataInicio: "2026-03-01", dataFim: null })],
      "cliente", HOJE,
    );
    expect(units[0].lt).toBeGreaterThan(3); // mar→jun
  });
});

describe("buildUnitsPontual", () => {
  it("por contrato: nEntregas=1, ltv=valorp, lt=0", () => {
    const units = buildUnitsPontual(
      [row({ tipoReceita: "pontual", valorp: 5000, status: "entregue" })],
      "contrato", HOJE,
    );
    expect(units[0].nEntregas).toBe(1);
    expect(units[0].ltv).toBe(5000);
    expect(units[0].estado).toBe("concluido");
  });
  it("por cliente: nEntregas=nº contratos, ltv=soma, lt=span, estado por prioridade", () => {
    const rows = [
      row({ idTask: "A", tipoReceita: "pontual", valorp: 5000, status: "entregue", dataInicio: "2026-01-01" }),
      row({ idTask: "A", tipoReceita: "pontual", valorp: 6000, status: "ativo", dataInicio: "2026-03-01" }),
    ];
    const units = buildUnitsPontual(rows, "cliente", HOJE);
    expect(units).toHaveLength(1);
    expect(units[0].nEntregas).toBe(2);
    expect(units[0].ltv).toBe(11000);
    expect(units[0].lt).toBeCloseTo(1.97, 1); // jan→mar span
    expect(units[0].estado).toBe("em_producao"); // em produção tem prioridade
  });
});

describe("aggregateMetricas", () => {
  it("calcula média/mediana ignorando lt null", () => {
    const m = aggregateMetricas([
      { estado: "ativo", lt: 2, nEntregas: 0, ltv: 1000, idadeMeses: 4 },
      { estado: "ativo", lt: 4, nEntregas: 0, ltv: 3000, idadeMeses: 6 },
      { estado: "ativo", lt: null, nEntregas: 0, ltv: 5000, idadeMeses: 8 },
    ]);
    expect(m.n).toBe(3);
    expect(m.ltMesesMedia).toBe(3);     // (2+4)/2, null ignorado
    expect(m.ltvMedia).toBe(3000);      // (1000+3000+5000)/3
    expect(m.ltvTotal).toBe(9000);
    expect(m.ltMesesMediana).toBe(3);
  });
  it("zera tudo para lista vazia", () => {
    const m = aggregateMetricas([]);
    expect(m.n).toBe(0);
    expect(m.ltvMedia).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/routes/creatorsModelo.helpers.test.ts`
Expected: FAIL — funções não exportadas.

- [ ] **Step 3: Write minimal implementation**

```ts
// adicionar em server/routes/creatorsModelo.helpers.ts
import { mediana } from "./ltLtvChurn.helpers";

const DIAS_MES = 30.44;

export interface Unit {
  estado: EstadoRec | EstadoPont;
  lt: number | null;     // recorrente: meses; pontual: span em meses; null = não conta na média de LT
  nEntregas: number;     // 0 para recorrente
  ltv: number;
  idadeMeses: number;
}

export interface Metricas {
  n: number;
  ltMesesMedia: number; ltMesesMediana: number;
  nEntregasMedia: number; nEntregasMediana: number;
  ltvMedia: number; ltvMediana: number;
  ltvTotal: number;
  idadeMediaMeses: number;
}

/** Meses (de 30.44 dias) entre duas datas 'YYYY-MM-DD'; 0 se ate < de. */
export function mesesEntre(de: string, ate: string): number {
  const a = Date.parse(de), b = Date.parse(ate);
  if (isNaN(a) || isNaN(b) || b < a) return 0;
  return (b - a) / (1000 * 60 * 60 * 24) / DIAS_MES;
}

function round1(n: number) { return Math.round(n * 10) / 10; }
function round0(n: number) { return Math.round(n); }
function avg(a: number[]) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0; }

export function buildUnitsRecorrente(
  rows: RawRow[], unidade: "cliente" | "contrato", hoje: string,
): Unit[] {
  if (unidade === "contrato") {
    return rows.map((r) => ({
      estado: classifyEstadoRecorrente(r),
      lt: r.dataInconsistente || r.ltMeses == null ? null : r.ltMeses,
      nEntregas: 0,
      ltv: r.ltvRecorrente ?? 0,
      idadeMeses: r.dataInicio ? mesesEntre(r.dataInicio, hoje) : 0,
    }));
  }
  // por cliente: agrega por idTask
  const byCli = new Map<string, RawRow[]>();
  for (const r of rows) {
    const k = r.idTask ?? r.idSubtask ?? "";
    (byCli.get(k) ?? byCli.set(k, []).get(k)!).push(r);
  }
  const units: Unit[] = [];
  for (const [, items] of Array.from(byCli.entries())) {
    const ativo = items.some((r) => !r.isChurned);
    const inicios = items.map((r) => r.dataInicio).filter((d): d is string => !!d).sort();
    const fins = items.map((r) => r.dataFim).filter((d): d is string => !!d).sort();
    const ini = inicios[0] ?? null;
    let lt: number | null = null;
    if (ini) {
      const fim = ativo ? hoje : (fins[fins.length - 1] ?? null);
      lt = fim ? mesesEntre(ini, fim) : null;
    }
    units.push({
      estado: ativo ? "ativo" : "cancelado",
      lt,
      nEntregas: 0,
      ltv: items.reduce((s, r) => s + (r.ltvRecorrente ?? 0), 0),
      idadeMeses: ini ? mesesEntre(ini, hoje) : 0,
    });
  }
  return units;
}

/** Prioridade de estado do cliente pontual: em produção > cancelado > concluído. */
function estadoClientePontual(items: RawRow[]): EstadoPont {
  const estados = items.map((r) => classifyEstadoPontual(r.status));
  if (estados.includes("em_producao")) return "em_producao";
  if (estados.includes("cancelado")) return "cancelado";
  return "concluido";
}

export function buildUnitsPontual(
  rows: RawRow[], unidade: "cliente" | "contrato", hoje: string,
): Unit[] {
  if (unidade === "contrato") {
    return rows.map((r) => ({
      estado: classifyEstadoPontual(r.status),
      lt: 0,            // 1 contrato pontual não tem span
      nEntregas: 1,
      ltv: r.valorp ?? 0,
      idadeMeses: r.dataInicio ? mesesEntre(r.dataInicio, hoje) : 0,
    }));
  }
  const byCli = new Map<string, RawRow[]>();
  for (const r of rows) {
    const k = r.idTask ?? r.idSubtask ?? "";
    (byCli.get(k) ?? byCli.set(k, []).get(k)!).push(r);
  }
  const units: Unit[] = [];
  for (const [, items] of Array.from(byCli.entries())) {
    const inicios = items.map((r) => r.dataInicio).filter((d): d is string => !!d).sort();
    const ini = inicios[0] ?? null;
    const ult = inicios[inicios.length - 1] ?? null;
    units.push({
      estado: estadoClientePontual(items),
      lt: ini && ult ? mesesEntre(ini, ult) : 0,
      nEntregas: items.length,
      ltv: items.reduce((s, r) => s + (r.valorp ?? 0), 0),
      idadeMeses: ini ? mesesEntre(ini, hoje) : 0,
    });
  }
  return units;
}

export function aggregateMetricas(units: Unit[]): Metricas {
  const lts = units.map((u) => u.lt).filter((x): x is number => x != null);
  const ltvs = units.map((u) => u.ltv);
  const ents = units.map((u) => u.nEntregas);
  const idades = units.map((u) => u.idadeMeses);
  return {
    n: units.length,
    ltMesesMedia: round1(avg(lts)),
    ltMesesMediana: round1(mediana(lts)),
    nEntregasMedia: round1(avg(ents)),
    nEntregasMediana: round1(mediana(ents)),
    ltvMedia: round0(avg(ltvs)),
    ltvMediana: round0(mediana(ltvs)),
    ltvTotal: round0(ltvs.reduce((s, x) => s + x, 0)),
    idadeMediaMeses: round1(avg(idades)),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/routes/creatorsModelo.helpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routes/creatorsModelo.helpers.ts server/routes/creatorsModelo.helpers.test.ts
git commit -m "feat(creators-modelo): unidades (cliente/contrato) e agregação média/mediana

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Helpers — curva de sobrevivência recorrente e recompra pontual

**Files:**
- Modify: `server/routes/creatorsModelo.helpers.ts`
- Test: `server/routes/creatorsModelo.helpers.test.ts`

**Interfaces:**
- Consumes (Tasks 1-2): `RawRow`, `classifyModelo`, `isSequenciado`, `mesesEntre`.
- Produces:
  - `interface CurvaPonto { meses: number; pctSobrevivencia: number; n: number }`
  - `interface Recompra { totalAvulsos: number; comRecompra: number; pctRecompra: number }`
  - `function buildCurvaRecorrente(rows: RawRow[], hoje: string): CurvaPonto[]` (marcos fixos 1,3,6,12)
  - `function buildRecompra(rows: RawRow[]): Recompra`

- [ ] **Step 1: Write the failing test**

```ts
// adicionar em server/routes/creatorsModelo.helpers.test.ts
import { buildCurvaRecorrente, buildRecompra } from "./creatorsModelo.helpers";

describe("buildCurvaRecorrente", () => {
  it("no marco de 3m: só conta quem teve chance (idade>=3) e sobreviveu (lt>=3 ou ativo)", () => {
    const rows = [
      // ativo há 5 meses → sobrevive a 1,3 (idade>=) ; não conta em 6,12
      row({ tipoReceita: "recorrente", isChurned: false, dataInicio: "2026-01-21", dataFim: null, ltMeses: 5, dataInconsistente: false }),
      // churned com lt=2 (entrou jan, saiu mar) → teve chance até 3m, NÃO sobreviveu a 3
      row({ tipoReceita: "recorrente", isChurned: true, dataInicio: "2026-01-01", dataFim: "2026-03-01", ltMeses: 2, dataInconsistente: false }),
    ];
    const curva = buildCurvaRecorrente(rows, "2026-06-21");
    const m3 = curva.find((c) => c.meses === 3)!;
    expect(m3.n).toBe(2);                 // ambos tiveram chance (idade>=3)
    expect(m3.pctSobrevivencia).toBe(50); // só o ativo sobreviveu
  });
  it("ignora contratos pontuais e inconsistentes", () => {
    const curva = buildCurvaRecorrente(
      [row({ tipoReceita: "pontual" }), row({ tipoReceita: "recorrente", dataInconsistente: true })],
      "2026-06-21",
    );
    expect(curva.every((c) => c.n === 0)).toBe(true);
  });
});

describe("buildRecompra", () => {
  it("conta clientes avulsos (sem sequência) com >=2 contratos pontuais", () => {
    const rows = [
      // cliente A: 2 contratos avulsos → recomprou
      row({ idTask: "A", tipoReceita: "pontual", servico: "Creators Pontual" }),
      row({ idTask: "A", tipoReceita: "pontual", servico: "Creators Scale" }),
      // cliente B: 1 contrato avulso → não recomprou
      row({ idTask: "B", tipoReceita: "pontual", servico: "Creators Pontual" }),
      // cliente C: sequenciado → não entra no universo avulso
      row({ idTask: "C", tipoReceita: "pontual", servico: "1ª Entrega - Creators" }),
    ];
    const r = buildRecompra(rows);
    expect(r.totalAvulsos).toBe(2);   // A e B
    expect(r.comRecompra).toBe(1);    // A
    expect(r.pctRecompra).toBe(50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/routes/creatorsModelo.helpers.test.ts`
Expected: FAIL — funções não exportadas.

- [ ] **Step 3: Write minimal implementation**

```ts
// adicionar em server/routes/creatorsModelo.helpers.ts
export interface CurvaPonto { meses: number; pctSobrevivencia: number; n: number; }
export interface Recompra { totalAvulsos: number; comRecompra: number; pctRecompra: number; }

const MARCOS = [1, 3, 6, 12];

export function buildCurvaRecorrente(rows: RawRow[], hoje: string): CurvaPonto[] {
  const recs = rows.filter(
    (r) => classifyModelo(r) === "recorrente" && !r.dataInconsistente && r.dataInicio,
  );
  return MARCOS.map((m) => {
    // tiveram chance de chegar ao marco m
    const comChance = recs.filter((r) => mesesEntre(r.dataInicio!, hoje) >= m);
    // sobreviveram ao marco: ativo (continua) OU churned mas durou >= m
    const sobreviveram = comChance.filter((r) =>
      !r.isChurned ? true : (r.ltMeses ?? 0) >= m,
    );
    return {
      meses: m,
      n: comChance.length,
      pctSobrevivencia: comChance.length
        ? Math.round((sobreviveram.length / comChance.length) * 1000) / 10
        : 0,
    };
  });
}

export function buildRecompra(rows: RawRow[]): Recompra {
  const pont = rows.filter((r) => classifyModelo(r) === "pontual");
  const byCli = new Map<string, RawRow[]>();
  for (const r of pont) {
    const k = r.idTask ?? r.idSubtask ?? "";
    (byCli.get(k) ?? byCli.set(k, []).get(k)!).push(r);
  }
  let totalAvulsos = 0, comRecompra = 0;
  for (const [, items] of Array.from(byCli.entries())) {
    const temSequencia = items.some((r) => isSequenciado(r.servico));
    if (temSequencia) continue;           // só universo avulso
    totalAvulsos++;
    if (items.length >= 2) comRecompra++;
  }
  return {
    totalAvulsos,
    comRecompra,
    pctRecompra: totalAvulsos ? Math.round((comRecompra / totalAvulsos) * 1000) / 10 : 0,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/routes/creatorsModelo.helpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routes/creatorsModelo.helpers.ts server/routes/creatorsModelo.helpers.test.ts
git commit -m "feat(creators-modelo): curva de sobrevivência recorrente + recompra avulsos

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Helpers — payload completo (assembla + reusa funil de entregas)

**Files:**
- Modify: `server/routes/creatorsModelo.helpers.ts`
- Test: `server/routes/creatorsModelo.helpers.test.ts`

**Interfaces:**
- Consumes (Tasks 1-3): tudo acima; e de `churnPontorrente.helpers`: `toJornadas`, `buildFunil`, `type RawRow as PontRawRow`, `type FunilNivel`.
- Produces:
  - `interface Grupo { modelo: Modelo; estado: string; metricas: Metricas }`
  - `interface CreatorsModeloPayload { meta, tabela: { cliente: Grupo[]; contrato: Grupo[] }, funilVendido, funilEntregue, curvaRecorrente, recompra, coorte }`
  - `function aplicarPeriodo(rows: RawRow[], de?: string, ate?: string): RawRow[]`
  - `function buildCreatorsModeloPayload(rows: RawRow[], opts: { de?: string; ate?: string; hoje: string }): CreatorsModeloPayload`

- [ ] **Step 1: Write the failing test**

```ts
// adicionar em server/routes/creatorsModelo.helpers.test.ts
import { buildCreatorsModeloPayload, aplicarPeriodo } from "./creatorsModelo.helpers";

describe("aplicarPeriodo", () => {
  it("filtra por mês de data_inicio (de/ate inclusivos)", () => {
    const rows = [
      row({ dataInicio: "2026-01-15" }), row({ dataInicio: "2026-03-10" }), row({ dataInicio: "2026-05-20" }),
    ];
    expect(aplicarPeriodo(rows, "2026-03", undefined)).toHaveLength(2);
    expect(aplicarPeriodo(rows, "2026-03", "2026-03")).toHaveLength(1);
  });
});

describe("buildCreatorsModeloPayload", () => {
  const rows = [
    row({ idTask: "R1", tipoReceita: "recorrente", valorr: 1000, ltMeses: 4, ltvRecorrente: 4000, isChurned: true, dataInicio: "2026-01-01", dataFim: "2026-05-01" }),
    row({ idTask: "P1", tipoReceita: "pontual", valorp: 5000, status: "entregue", servico: "Creators Pontual", dataInicio: "2026-03-01" }),
    row({ idTask: "P2", tipoReceita: "pontual", valorp: 6000, status: "ativo", servico: "1ª Entrega - Creators", dataInicio: "2026-04-01" }),
  ];
  it("monta grupos por modelo/estado nas duas unidades", () => {
    const p = buildCreatorsModeloPayload(rows, { hoje: "2026-06-21" });
    const recCancelado = p.tabela.cliente.find((g) => g.modelo === "recorrente" && g.estado === "cancelado");
    expect(recCancelado?.metricas.n).toBe(1);
    expect(recCancelado?.metricas.ltvMedia).toBe(4000);
    const pontConcluido = p.tabela.cliente.find((g) => g.modelo === "pontual" && g.estado === "concluido");
    expect(pontConcluido?.metricas.n).toBe(1);
  });
  it("inclui linha total por modelo", () => {
    const p = buildCreatorsModeloPayload(rows, { hoje: "2026-06-21" });
    const pontTotal = p.tabela.cliente.find((g) => g.modelo === "pontual" && g.estado === "total");
    expect(pontTotal?.metricas.n).toBe(2); // P1 + P2
  });
  it("monta meta com contagem sequenciado/avulso", () => {
    const p = buildCreatorsModeloPayload(rows, { hoje: "2026-06-21" });
    expect(p.meta.nSequenciados).toBe(1); // P2
    expect(p.meta.nAvulsos).toBe(1);      // P1
  });
  it("expõe funil, curva, recompra e coorte", () => {
    const p = buildCreatorsModeloPayload(rows, { hoje: "2026-06-21" });
    expect(Array.isArray(p.funilVendido)).toBe(true);
    expect(Array.isArray(p.curvaRecorrente)).toBe(true);
    expect(typeof p.recompra.pctRecompra).toBe("number");
    expect(typeof p.coorte.avisoMaturidade).toBe("boolean");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/routes/creatorsModelo.helpers.test.ts`
Expected: FAIL — funções não exportadas.

- [ ] **Step 3: Write minimal implementation**

```ts
// adicionar em server/routes/creatorsModelo.helpers.ts
import {
  toJornadas, buildFunil,
  type RawRow as PontRawRow, type FunilNivel,
} from "./churnPontorrente.helpers";

export interface Grupo { modelo: Modelo; estado: string; metricas: Metricas; }

export interface CreatorsModeloPayload {
  meta: { de: string | null; ate: string | null; hoje: string; nSequenciados: number; nAvulsos: number; pctSequenciados: number; };
  tabela: { cliente: Grupo[]; contrato: Grupo[]; };
  funilVendido: FunilNivel[];
  funilEntregue: FunilNivel[];
  curvaRecorrente: CurvaPonto[];
  recompra: Recompra;
  coorte: { recorrenteIdadeMedia: number; pontualIdadeMedia: number; avisoMaturidade: boolean; };
}

/** Filtra por mês ('YYYY-MM') de data_inicio, de/ate inclusivos. */
export function aplicarPeriodo(rows: RawRow[], de?: string, ate?: string): RawRow[] {
  return rows.filter((r) => {
    const mes = r.dataInicio ? r.dataInicio.slice(0, 7) : null;
    if (de && (!mes || mes < de)) return false;
    if (ate && (!mes || mes > ate)) return false;
    return true;
  });
}

const ESTADOS_REC = ["ativo", "cancelado"] as const;
const ESTADOS_PONT = ["em_producao", "concluido", "cancelado"] as const;

function gruposDeUnidade(rows: RawRow[], unidade: "cliente" | "contrato", hoje: string): Grupo[] {
  const recRows = rows.filter((r) => classifyModelo(r) === "recorrente");
  const pontRows = rows.filter((r) => classifyModelo(r) === "pontual");
  const recUnits = buildUnitsRecorrente(recRows, unidade, hoje);
  const pontUnits = buildUnitsPontual(pontRows, unidade, hoje);

  const grupos: Grupo[] = [];
  for (const e of ESTADOS_REC) {
    grupos.push({ modelo: "recorrente", estado: e, metricas: aggregateMetricas(recUnits.filter((u) => u.estado === e)) });
  }
  grupos.push({ modelo: "recorrente", estado: "total", metricas: aggregateMetricas(recUnits) });
  for (const e of ESTADOS_PONT) {
    grupos.push({ modelo: "pontual", estado: e, metricas: aggregateMetricas(pontUnits.filter((u) => u.estado === e)) });
  }
  grupos.push({ modelo: "pontual", estado: "total", metricas: aggregateMetricas(pontUnits) });
  return grupos;
}

/** Converte RawRow (view) para o RawRow do funil de entregas (churnPontorrente). */
function toPontRows(rows: RawRow[]): PontRawRow[] {
  return rows
    .filter((r) => classifyModelo(r) === "pontual")
    .map((r) => ({
      idTask: r.idTask,
      produto: r.produto,
      servico: r.servico ?? "",
      status: r.status,
      valorp: r.valorp,
      squad: null, responsavel: null, csResponsavel: null, vendedor: null,
      motivoCancelamento: null,
      dataInicio: r.dataInicio,
      dataEncerramento: r.dataFim,
      nomeCliente: null,
    }));
}

export function buildCreatorsModeloPayload(
  rows: RawRow[], opts: { de?: string; ate?: string; hoje: string },
): CreatorsModeloPayload {
  const { de, ate, hoje } = opts;
  const periodo = aplicarPeriodo(rows, de, ate);

  const pontRows = periodo.filter((r) => classifyModelo(r) === "pontual");
  const seqCli = new Set<string>(), avuCli = new Set<string>();
  {
    const byCli = new Map<string, RawRow[]>();
    for (const r of pontRows) {
      const k = r.idTask ?? r.idSubtask ?? "";
      (byCli.get(k) ?? byCli.set(k, []).get(k)!).push(r);
    }
    for (const [k, items] of Array.from(byCli.entries())) {
      if (items.some((r) => isSequenciado(r.servico))) seqCli.add(k); else avuCli.add(k);
    }
  }

  const pontParaFunil = toPontRows(periodo);

  const recUnitsCli = buildUnitsRecorrente(periodo.filter((r) => classifyModelo(r) === "recorrente"), "cliente", hoje);
  const pontUnitsCli = buildUnitsPontual(pontRows, "cliente", hoje);
  const recIdade = aggregateMetricas(recUnitsCli).idadeMediaMeses;
  const pontIdade = aggregateMetricas(pontUnitsCli).idadeMediaMeses;

  return {
    meta: {
      de: de ?? null, ate: ate ?? null, hoje,
      nSequenciados: seqCli.size,
      nAvulsos: avuCli.size,
      pctSequenciados: (seqCli.size + avuCli.size)
        ? Math.round((seqCli.size / (seqCli.size + avuCli.size)) * 1000) / 10 : 0,
    },
    tabela: {
      cliente: gruposDeUnidade(periodo, "cliente", hoje),
      contrato: gruposDeUnidade(periodo, "contrato", hoje),
    },
    funilVendido: buildFunil(toJornadas(pontParaFunil, "vendido")),
    funilEntregue: buildFunil(toJornadas(pontParaFunil, "entregue")),
    curvaRecorrente: buildCurvaRecorrente(periodo, hoje),
    recompra: buildRecompra(periodo),
    coorte: {
      recorrenteIdadeMedia: recIdade,
      pontualIdadeMedia: pontIdade,
      avisoMaturidade: Math.abs(recIdade - pontIdade) > 6,
    },
  };
}
```

> Nota: `toJornadas` restringe a `PRODUTOS_PONTORRENTE` (inclui 'Creators') e a serviços com nº de entrega — exatamente os sequenciados. Os avulsos saem do funil (correto) e entram só na recompra/tabela.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/routes/creatorsModelo.helpers.test.ts`
Expected: PASS (todas as describe verdes).

- [ ] **Step 5: Commit**

```bash
git add server/routes/creatorsModelo.helpers.ts server/routes/creatorsModelo.helpers.test.ts
git commit -m "feat(creators-modelo): payload completo reaproveitando funil de entregas

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Endpoint `GET /api/creators-modelo` + registro

**Files:**
- Create: `server/routes/creatorsModelo.ts`
- Create: `server/routes/creatorsModelo.test.ts`
- Modify: `server/routes.ts` (import ~linha 86, chamada ~linha 8385)

**Interfaces:**
- Consumes (Task 4): `buildCreatorsModeloPayload`, `type RawRow`.
- Produces: `function registerCreatorsModeloRoutes(app: Express, db: any): void`; rota `GET /api/creators-modelo?de=&ate=` retornando `CreatorsModeloPayload`.

- [ ] **Step 1: Write the failing test**

```ts
// server/routes/creatorsModelo.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const mockExecute = vi.fn();
vi.mock("../db", () => ({ db: { execute: mockExecute } }));

import { registerCreatorsModeloRoutes } from "./creatorsModelo";

function makeApp() {
  const app = express();
  app.use((req, _res, next) => { (req as any).user = { email: "t@t.com" }; next(); });
  registerCreatorsModeloRoutes(app, { execute: mockExecute } as any);
  return app;
}

beforeEach(() => vi.clearAllMocks());

const dbRows = [
  { id_task: "R1", id_subtask: "S1", produto: "Creators", servico: "Creators Recorrente", status: "cancelado/inativo", tipo_receita: "recorrente", valorr: "1000", valorp: "0", lt_meses: "4", ltv_recorrente: "4000", is_ativo: false, is_churned: true, data_inconsistente: false, data_inicio: "2026-01-01", data_fim: "2026-05-01" },
  { id_task: "P1", id_subtask: "S2", produto: "Creators", servico: "Creators Pontual", status: "entregue", tipo_receita: "pontual", valorr: "0", valorp: "5000", lt_meses: null, ltv_recorrente: null, is_ativo: false, is_churned: false, data_inconsistente: false, data_inicio: "2026-03-01", data_fim: null },
];

describe("GET /api/creators-modelo", () => {
  it("retorna o payload com tabela, funil, curva, recompra e coorte", async () => {
    mockExecute.mockResolvedValueOnce({ rows: dbRows });
    const res = await request(makeApp()).get("/api/creators-modelo");
    expect(res.status).toBe(200);
    expect(res.body.tabela.cliente.length).toBeGreaterThan(0);
    expect(res.body.tabela.contrato.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty("funilVendido");
    expect(res.body).toHaveProperty("curvaRecorrente");
    expect(res.body).toHaveProperty("recompra");
    expect(res.body.meta).toHaveProperty("nAvulsos");
  });

  it("propaga de/ate como filtro de período", async () => {
    mockExecute.mockResolvedValueOnce({ rows: dbRows });
    const res = await request(makeApp()).get("/api/creators-modelo?de=2026-03&ate=2026-03");
    expect(res.status).toBe(200);
    expect(res.body.meta.de).toBe("2026-03");
    // R1 (jan) fica de fora; só P1 (mar) entra
    const pontTotal = res.body.tabela.cliente.find((g: any) => g.modelo === "pontual" && g.estado === "total");
    expect(pontTotal.metricas.n).toBe(1);
    const recTotal = res.body.tabela.cliente.find((g: any) => g.modelo === "recorrente" && g.estado === "total");
    expect(recTotal.metricas.n).toBe(0);
  });

  it("retorna 500 quando a query falha", async () => {
    mockExecute.mockRejectedValueOnce(new Error("db down"));
    const res = await request(makeApp()).get("/api/creators-modelo");
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/routes/creatorsModelo.test.ts`
Expected: FAIL — "Failed to resolve import './creatorsModelo'".

- [ ] **Step 3: Write minimal implementation**

```ts
// server/routes/creatorsModelo.ts
import type { Express } from "express";
import { sql } from "drizzle-orm";
import { buildCreatorsModeloPayload, type RawRow } from "./creatorsModelo.helpers";

export function registerCreatorsModeloRoutes(app: Express, db: any) {
  app.get("/api/creators-modelo", async (req, res) => {
    try {
      const de = (req.query.de as string) || undefined;
      const ate = (req.query.ate as string) || undefined;

      const result = (await db.execute(sql`
        SELECT
          id_task, id_subtask, produto, servico, status, tipo_receita,
          valorr, valorp, lt_meses, ltv_recorrente,
          is_ativo, is_churned, data_inconsistente,
          to_char(data_inicio, 'YYYY-MM-DD') AS data_inicio,
          to_char(data_fim, 'YYYY-MM-DD')    AS data_fim
        FROM cortex_core.vw_lt_contratos
        WHERE produto = 'Creators' AND tipo_receita IN ('recorrente','pontual')
      `)).rows as any[];

      const rows: RawRow[] = result.map((r) => ({
        idTask: r.id_task ?? null,
        idSubtask: r.id_subtask ?? null,
        produto: r.produto ?? null,
        servico: r.servico ?? "",
        status: r.status ?? null,
        tipoReceita: r.tipo_receita ?? null,
        valorr: r.valorr != null ? Number(r.valorr) : 0,
        valorp: r.valorp != null ? Number(r.valorp) : 0,
        ltMeses: r.lt_meses != null ? Number(r.lt_meses) : null,
        ltvRecorrente: r.ltv_recorrente != null ? Number(r.ltv_recorrente) : null,
        isAtivo: !!r.is_ativo,
        isChurned: !!r.is_churned,
        dataInconsistente: !!r.data_inconsistente,
        dataInicio: r.data_inicio ?? null,
        dataFim: r.data_fim ?? null,
      }));

      const hoje = new Date().toISOString().slice(0, 10);
      res.json(buildCreatorsModeloPayload(rows, { de, ate, hoje }));
    } catch (error) {
      console.error("[api] Error fetching creators-modelo:", error);
      res.status(500).json({ error: "Failed to fetch creators-modelo" });
    }
  });
}
```

- [ ] **Step 4: Register the route in `server/routes.ts`**

Add the import next to the other route imports (near line 86, after `registerChurnPontorrenteRoutes`):

```ts
import { registerCreatorsModeloRoutes } from "./routes/creatorsModelo";
```

Add the registration call next to the others (near line 8385, after `registerChurnPontorrenteRoutes(app, db);`):

```ts
  registerCreatorsModeloRoutes(app, db);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run server/routes/creatorsModelo.test.ts`
Expected: PASS (3 testes verdes).

- [ ] **Step 6: Commit**

```bash
git add server/routes/creatorsModelo.ts server/routes/creatorsModelo.test.ts server/routes.ts
git commit -m "feat(creators-modelo): endpoint GET /api/creators-modelo

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Frontend — tipos, utils, página com filtros e fetch

**Files:**
- Create: `client/src/components/creators-modelo/types.ts`
- Create: `client/src/components/creators-modelo/utils.ts`
- Create: `client/src/pages/CreatorsModelo.tsx`

**Interfaces:**
- Consumes: payload de `GET /api/creators-modelo` (Task 5).
- Produces: tipos `CreatorsModeloPayload`, `Grupo`, `Metricas`, `FunilNivel`, `CurvaPonto`, `Recompra`; `fetchJson`, `buildUrl`; página default export `CreatorsModelo`.

- [ ] **Step 1: Create `types.ts`**

```ts
// client/src/components/creators-modelo/types.ts
export interface Metricas {
  n: number;
  ltMesesMedia: number; ltMesesMediana: number;
  nEntregasMedia: number; nEntregasMediana: number;
  ltvMedia: number; ltvMediana: number;
  ltvTotal: number;
  idadeMediaMeses: number;
}
export interface Grupo { modelo: "recorrente" | "pontual"; estado: string; metricas: Metricas; }
export interface FunilNivel {
  nivel: number; atingiram: number; pararamAqui: number; churn: number;
  emAndamento: number; concluido: number; valorpChurn: number; dropPct: number;
}
export interface CurvaPonto { meses: number; pctSobrevivencia: number; n: number; }
export interface Recompra { totalAvulsos: number; comRecompra: number; pctRecompra: number; }

export interface CreatorsModeloPayload {
  meta: { de: string | null; ate: string | null; hoje: string; nSequenciados: number; nAvulsos: number; pctSequenciados: number; };
  tabela: { cliente: Grupo[]; contrato: Grupo[]; };
  funilVendido: FunilNivel[];
  funilEntregue: FunilNivel[];
  curvaRecorrente: CurvaPonto[];
  recompra: Recompra;
  coorte: { recorrenteIdadeMedia: number; pontualIdadeMedia: number; avisoMaturidade: boolean; };
}

export type Unidade = "cliente" | "contrato";
export type Agregador = "media" | "mediana";
export type Situacao = "ambos" | "ativo" | "cancelado";
```

- [ ] **Step 2: Create `utils.ts`**

```ts
// client/src/components/creators-modelo/utils.ts
export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export function buildUrl(base: string, params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

/** Rótulo legível dos estados. */
export const ESTADO_LABEL: Record<string, string> = {
  ativo: "Ativo", cancelado: "Cancelado", total: "Total",
  em_producao: "Em produção", concluido: "Concluído",
};
```

- [ ] **Step 3: Create the page `CreatorsModelo.tsx` (filters + fetch + scaffolding)**

```tsx
// client/src/pages/CreatorsModelo.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSetPageInfo } from "@/contexts/PageContext";
import { fetchJson, buildUrl } from "@/components/creators-modelo/utils";
import type { CreatorsModeloPayload, Unidade, Agregador, Situacao } from "@/components/creators-modelo/types";
import { AvisosMetodologicos } from "@/components/creators-modelo/AvisosMetodologicos";
import { HeadlineCards } from "@/components/creators-modelo/HeadlineCards";
import { TabelaLtLtv } from "@/components/creators-modelo/TabelaLtLtv";
import { FunilSobrevivencia } from "@/components/creators-modelo/FunilSobrevivencia";
import { CardRecompra } from "@/components/creators-modelo/CardRecompra";

const MESES = ["2026-01","2026-02","2026-03","2026-04","2026-05","2026-06"];

export default function CreatorsModelo() {
  useSetPageInfo("Creators: Recorrente × Pontual", "Comparação de LT, LTV e churn dos dois modelos");
  const [unidade, setUnidade] = useState<Unidade>("cliente");
  const [agregador, setAgregador] = useState<Agregador>("media");
  const [situacao, setSituacao] = useState<Situacao>("ambos");
  const [de, setDe] = useState<string>("todos");
  const [ate, setAte] = useState<string>("todos");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/creators-modelo", de, ate],
    queryFn: () => fetchJson<CreatorsModeloPayload>(
      buildUrl("/api/creators-modelo", {
        de: de === "todos" ? undefined : de,
        ate: ate === "todos" ? undefined : ate,
      }),
    ),
  });

  const triggerCls = "w-[150px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50";

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Select value={unidade} onValueChange={(v) => setUnidade(v as Unidade)}>
          <SelectTrigger className={triggerCls}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cliente">Por cliente</SelectItem>
            <SelectItem value="contrato">Por contrato</SelectItem>
          </SelectContent>
        </Select>
        <Select value={agregador} onValueChange={(v) => setAgregador(v as Agregador)}>
          <SelectTrigger className={triggerCls}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="mediana">Mediana</SelectItem>
          </SelectContent>
        </Select>
        <Select value={situacao} onValueChange={(v) => setSituacao(v as Situacao)}>
          <SelectTrigger className={triggerCls}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ambos">Todas situações</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="cancelado">Cancelados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={de} onValueChange={setDe}>
          <SelectTrigger className={triggerCls}><SelectValue placeholder="De" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Início: tudo</SelectItem>
            {MESES.map((m) => <SelectItem key={m} value={m}>De {m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={ate} onValueChange={setAte}>
          <SelectTrigger className={triggerCls}><SelectValue placeholder="Até" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Até: tudo</SelectItem>
            {MESES.map((m) => <SelectItem key={m} value={m}>Até {m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading || !data ? (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
      ) : (
        <>
          <AvisosMetodologicos meta={data.meta} coorte={data.coorte} />
          <HeadlineCards data={data} unidade={unidade} agregador={agregador} />
          <TabelaLtLtv data={data} unidade={unidade} agregador={agregador} situacao={situacao} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2"><FunilSobrevivencia data={data} /></div>
            <CardRecompra recompra={data.recompra} />
          </div>
        </>
      )}
    </div>
  );
}
```

> Esta página importa 4 componentes ainda inexistentes (Tasks 7-9). Ela não compila até eles existirem — por isso o build/verify acontece na Task 10. As Tasks 7-9 criam cada componente isoladamente.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/creators-modelo/types.ts client/src/components/creators-modelo/utils.ts client/src/pages/CreatorsModelo.tsx
git commit -m "feat(creators-modelo): tipos, utils e página com filtros

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Frontend — AvisosMetodologicos + HeadlineCards

**Files:**
- Create: `client/src/components/creators-modelo/AvisosMetodologicos.tsx`
- Create: `client/src/components/creators-modelo/HeadlineCards.tsx`

**Interfaces:**
- Consumes: `CreatorsModeloPayload`, `Grupo`, `Unidade`, `Agregador` (Task 6).
- Produces: `<AvisosMetodologicos meta coorte />`, `<HeadlineCards data unidade agregador />`.

- [ ] **Step 1: Create `AvisosMetodologicos.tsx`**

```tsx
// client/src/components/creators-modelo/AvisosMetodologicos.tsx
import { AlertTriangle } from "lucide-react";
import type { CreatorsModeloPayload } from "./types";

export function AvisosMetodologicos({
  meta, coorte,
}: {
  meta: CreatorsModeloPayload["meta"];
  coorte: CreatorsModeloPayload["coorte"];
}) {
  const avisos: string[] = [];
  if (coorte.avisoMaturidade) {
    avisos.push(
      `Maturidade desigual: recorrente tem ${coorte.recorrenteIdadeMedia} meses de idade média vs ${coorte.pontualIdadeMedia} do pontual. Use o filtro de período para comparar coortes parecidas — o LTV pontual ainda está em formação.`,
    );
  }
  avisos.push(
    `Funil de 4 entregas cobre só ${meta.pctSequenciados}% dos clientes pontuais (${meta.nSequenciados} sequenciados); os outros ${meta.nAvulsos} são compra única (ver card de recompra).`,
  );
  avisos.push(
    "LT em meses do pontual é pouco informativo (contratos datados na venda) — leia o pontual por nº de entregas.",
  );

  return (
    <div className="space-y-2">
      {avisos.map((a, i) => (
        <div
          key={i}
          className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{a}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `HeadlineCards.tsx`**

```tsx
// client/src/components/creators-modelo/HeadlineCards.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { CreatorsModeloPayload, Grupo, Unidade, Agregador } from "./types";

function pick(g: Grupo | undefined, campo: "ltv" | "lt" | "ent", agg: Agregador): number {
  if (!g) return 0;
  const m = g.metricas;
  if (campo === "ltv") return agg === "media" ? m.ltvMedia : m.ltvMediana;
  if (campo === "lt") return agg === "media" ? m.ltMesesMedia : m.ltMesesMediana;
  return agg === "media" ? m.nEntregasMedia : m.nEntregasMediana;
}

function find(grupos: Grupo[], modelo: string, estado: string) {
  return grupos.find((g) => g.modelo === modelo && g.estado === estado);
}

export function HeadlineCards({
  data, unidade, agregador,
}: {
  data: CreatorsModeloPayload; unidade: Unidade; agregador: Agregador;
}) {
  const grupos = data.tabela[unidade];
  const recTotal = find(grupos, "recorrente", "total");
  const pontTotal = find(grupos, "pontual", "total");
  const recCanc = find(grupos, "recorrente", "cancelado");
  const ltvRec = pick(recTotal, "ltv", agregador);
  const ltvPont = pick(pontTotal, "ltv", agregador);

  // churn recorrente = % cancelado
  const churnRec = recTotal && recTotal.metricas.n
    ? Math.round(((recCanc?.metricas.n ?? 0) / recTotal.metricas.n) * 1000) / 10 : 0;
  // % que não chega à 4ª (sequenciados, base entregue)
  const fe = data.funilEntregue;
  const n1 = fe.find((f) => f.nivel === 1)?.atingiram ?? 0;
  const n4 = fe.find((f) => f.nivel === 4)?.atingiram ?? 0;
  const naoChega4 = n1 ? Math.round((1 - n4 / n1) * 1000) / 10 : 0;

  const melhor = ltvPont === ltvRec ? "empate" : ltvPont > ltvRec ? "Pontual" : "Recorrente";
  const delta = Math.abs(ltvPont - ltvRec);

  const cardCls = "bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50";
  const linha = (label: string, valor: string) => (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500 dark:text-zinc-400">{label}</span>
      <span className="font-semibold text-gray-900 dark:text-white">{valor}</span>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className={cardCls}>
        <CardHeader className="pb-2"><CardTitle className="text-base text-sky-600 dark:text-sky-400">Recorrente</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {linha("Clientes", String(recTotal?.metricas.n ?? 0))}
          {linha(`LTV ${agregador}`, formatCurrencyNoDecimals(ltvRec))}
          {linha(`LT ${agregador} (meses)`, String(pick(recTotal, "lt", agregador)))}
          {linha("Churn (% cancelado)", `${churnRec}%`)}
        </CardContent>
      </Card>
      <Card className={cardCls}>
        <CardHeader className="pb-2"><CardTitle className="text-base text-indigo-600 dark:text-indigo-400">Pontual</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {linha("Clientes", String(pontTotal?.metricas.n ?? 0))}
          {linha(`LTV ${agregador}`, formatCurrencyNoDecimals(ltvPont))}
          {linha(`Nº entregas ${agregador}`, String(pick(pontTotal, "ent", agregador)))}
          {linha("Não chega à 4ª entrega", `${naoChega4}%`)}
        </CardContent>
      </Card>
      <Card className={cardCls}>
        <CardHeader className="pb-2"><CardTitle className="text-base text-gray-700 dark:text-zinc-200">Δ Comparação</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {linha("Maior LTV/cliente", melhor)}
          {linha("Diferença", formatCurrencyNoDecimals(delta))}
          <p className="pt-1 text-xs text-gray-500 dark:text-zinc-400">
            {data.coorte.avisoMaturidade
              ? "⚠️ Maturidades diferentes — compare com cautela."
              : "Maturidades comparáveis."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/creators-modelo/AvisosMetodologicos.tsx client/src/components/creators-modelo/HeadlineCards.tsx
git commit -m "feat(creators-modelo): avisos metodológicos + cards headline

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Frontend — TabelaLtLtv

**Files:**
- Create: `client/src/components/creators-modelo/TabelaLtLtv.tsx`

**Interfaces:**
- Consumes: `CreatorsModeloPayload`, `Grupo`, `Unidade`, `Agregador`, `Situacao`, `ESTADO_LABEL`.
- Produces: `<TabelaLtLtv data unidade agregador situacao />`.

- [ ] **Step 1: Create `TabelaLtLtv.tsx`**

```tsx
// client/src/components/creators-modelo/TabelaLtLtv.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { ESTADO_LABEL } from "./utils";
import type { CreatorsModeloPayload, Grupo, Unidade, Agregador, Situacao } from "./types";

// Ordem de exibição das linhas
const ORDEM: Array<{ modelo: "recorrente" | "pontual"; estado: string }> = [
  { modelo: "recorrente", estado: "ativo" },
  { modelo: "recorrente", estado: "cancelado" },
  { modelo: "recorrente", estado: "total" },
  { modelo: "pontual", estado: "em_producao" },
  { modelo: "pontual", estado: "concluido" },
  { modelo: "pontual", estado: "cancelado" },
  { modelo: "pontual", estado: "total" },
];

// Mapa situação (filtro) -> estados visíveis. "concluido" sempre visível (sucesso).
function visivel(estado: string, situacao: Situacao): boolean {
  if (situacao === "ambos") return true;
  if (estado === "total" || estado === "concluido") return true;
  if (situacao === "ativo") return estado === "ativo" || estado === "em_producao";
  return estado === "cancelado"; // situacao === 'cancelado'
}

export function TabelaLtLtv({
  data, unidade, agregador, situacao,
}: {
  data: CreatorsModeloPayload; unidade: Unidade; agregador: Agregador; situacao: Situacao;
}) {
  const grupos = data.tabela[unidade];
  const byKey = (modelo: string, estado: string): Grupo | undefined =>
    grupos.find((g) => g.modelo === modelo && g.estado === estado);

  const lt = (g: Grupo) => (agregador === "media" ? g.metricas.ltMesesMedia : g.metricas.ltMesesMediana);
  const ent = (g: Grupo) => (agregador === "media" ? g.metricas.nEntregasMedia : g.metricas.nEntregasMediana);
  const ltv = (g: Grupo) => (agregador === "media" ? g.metricas.ltvMedia : g.metricas.ltvMediana);

  const th = "px-3 py-2 text-left font-medium text-gray-500 dark:text-zinc-400";
  const td = "px-3 py-2 text-gray-900 dark:text-zinc-100";

  const linhas = ORDEM
    .filter((o) => visivel(o.estado, situacao))
    .map((o) => ({ ...o, g: byKey(o.modelo, o.estado) }))
    .filter((o): o is { modelo: "recorrente" | "pontual"; estado: string; g: Grupo } => !!o.g);

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <CardTitle className="text-base">LT e LTV por modelo</CardTitle>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          {unidade === "cliente" ? "Por cliente" : "Por contrato"} · {agregador === "media" ? "Média" : "Mediana"}
          {" "}· LTV recorrente = realizado até hoje
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-zinc-700/50">
              <th className={th}>Modelo / situação</th>
              <th className={th}>Nº</th>
              <th className={th}>LT (meses)</th>
              <th className={th}>Nº entregas</th>
              <th className={th}>LTV {agregador}</th>
              <th className={th}>LTV total</th>
              <th className={th}>Idade média (m)</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ modelo, estado, g }) => {
              const isTotal = estado === "total";
              const isPont = modelo === "pontual";
              return (
                <tr
                  key={`${modelo}-${estado}`}
                  className={`border-b border-gray-100 dark:border-zinc-800/50 ${isTotal ? "font-semibold bg-gray-50/60 dark:bg-zinc-800/30" : ""}`}
                >
                  <td className={td}>
                    <span className={modelo === "recorrente" ? "text-sky-600 dark:text-sky-400" : "text-indigo-600 dark:text-indigo-400"}>
                      {modelo === "recorrente" ? "Recorrente" : "Pontual"}
                    </span>
                    {!isTotal && <span className="text-gray-500 dark:text-zinc-400"> · {ESTADO_LABEL[estado] ?? estado}</span>}
                  </td>
                  <td className={td}>{g.metricas.n}</td>
                  <td className={td}>{lt(g)}</td>
                  <td className={td}>{isPont ? ent(g) : "—"}</td>
                  <td className={td}>{formatCurrencyNoDecimals(ltv(g))}</td>
                  <td className={td}>{formatCurrencyNoDecimals(g.metricas.ltvTotal)}</td>
                  <td className={td}>{g.metricas.idadeMediaMeses}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/creators-modelo/TabelaLtLtv.tsx
git commit -m "feat(creators-modelo): tabela LT/LTV por modelo e estado

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Frontend — FunilSobrevivencia + CardRecompra

**Files:**
- Create: `client/src/components/creators-modelo/FunilSobrevivencia.tsx`
- Create: `client/src/components/creators-modelo/CardRecompra.tsx`

**Interfaces:**
- Consumes: `CreatorsModeloPayload`, `FunilNivel`, `CurvaPonto`, `Recompra`; `useTheme`.
- Produces: `<FunilSobrevivencia data />`, `<CardRecompra recompra />`.

- [ ] **Step 1: Create `FunilSobrevivencia.tsx`**

```tsx
// client/src/components/creators-modelo/FunilSobrevivencia.tsx
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import type { CreatorsModeloPayload } from "./types";

export function FunilSobrevivencia({ data }: { data: CreatorsModeloPayload }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";
  const [base, setBase] = useState<"vendido" | "entregue">("entregue");

  const funil = base === "entregue" ? data.funilEntregue : data.funilVendido;
  const dadosFunil = funil.map((f) => ({ nome: `${f.nivel}ª entrega`, valor: f.atingiram }));
  const dadosCurva = data.curvaRecorrente.map((c) => ({ nome: `${c.meses}m`, valor: c.pctSobrevivencia }));

  const tooltip = {
    backgroundColor: isDark ? "#18181b" : "#ffffff",
    border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
    borderRadius: 8,
    color: isDark ? "#f4f4f5" : "#111827",
  };

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Sobrevivência: pontual × recorrente</CardTitle>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Pontual = funil de entregas ({data.meta.pctSequenciados}% dos clientes) · Recorrente = % ativo após N meses
            </p>
          </div>
          <Select value={base} onValueChange={(v) => setBase(v as "vendido" | "entregue")}>
            <SelectTrigger className="w-[150px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="entregue">Base: entregue</SelectItem>
              <SelectItem value="vendido">Base: vendido</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="mb-2 text-xs font-medium text-indigo-600 dark:text-indigo-400">Pontual — entregas (clientes)</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dadosFunil} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis dataKey="nome" tick={{ fill: axis, fontSize: 11 }} />
                <YAxis tick={{ fill: axis, fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={tooltip} />
                <Bar dataKey="valor" radius={[4, 4, 0, 0]} name="Clientes">
                  {dadosFunil.map((_, i) => <Cell key={i} fill="#6366f1" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-sky-600 dark:text-sky-400">Recorrente — % ainda ativo</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dadosCurva} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis dataKey="nome" tick={{ fill: axis, fontSize: 11 }} />
                <YAxis tick={{ fill: axis, fontSize: 11 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={tooltip} formatter={(v: number) => `${v}%`} />
                <Bar dataKey="valor" radius={[4, 4, 0, 0]} name="% ativo">
                  {dadosCurva.map((_, i) => <Cell key={i} fill="#0ea5e9" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create `CardRecompra.tsx`**

```tsx
// client/src/components/creators-modelo/CardRecompra.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Repeat } from "lucide-react";
import type { Recompra } from "./types";

export function CardRecompra({ recompra }: { recompra: Recompra }) {
  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Repeat className="h-4 w-4 text-indigo-500" /> Recompra (avulsos)
        </CardTitle>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Clientes pontuais de compra única (sem sequência de entregas)
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
          {recompra.pctRecompra}%
        </div>
        <p className="text-sm text-gray-600 dark:text-zinc-300">
          {recompra.comRecompra} de {recompra.totalAvulsos} clientes avulsos compraram 2+ vezes.
        </p>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Para os avulsos, "recompra" é o sinal de retenção — não há funil de 4 entregas.
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/creators-modelo/FunilSobrevivencia.tsx client/src/components/creators-modelo/CardRecompra.tsx
git commit -m "feat(creators-modelo): funil de sobrevivência + card de recompra

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Wiring (rota, menu) + verificação no browser

**Files:**
- Modify: `client/src/App.tsx` (lazy import ~linha 175; `<Route>` ~linha 334)
- Modify: `shared/nav-config.ts` (permission key ~linha 57; route map ~linha 253; item de menu ~linha 491)

**Interfaces:**
- Consumes: página `CreatorsModelo` (Task 6) e endpoint (Task 5).
- Produces: rota navegável `/creators-modelo` no menu Gestão.

- [ ] **Step 1: Add lazy import + Route in `App.tsx`**

Após a linha `const CreatorsPontual = lazyWithRetry(() => import("@/pages/CreatorsPontual"));` adicionar:

```tsx
const CreatorsModelo = lazyWithRetry(() => import("@/pages/CreatorsModelo"));
```

Após a linha `<Route path="/creators-pontual">...</Route>` adicionar:

```tsx
      <Route path="/creators-modelo">{() => <ProtectedRoute path="/creators-modelo" component={CreatorsModelo} />}</Route>
```

- [ ] **Step 2: Add permission key, route map and menu item in `shared/nav-config.ts`**

No bloco `GESTAO` (após `CREATORS_PONTUAL: 'gestao.creators_pontual',`) adicionar:

```ts
    CREATORS_MODELO: 'gestao.creators_modelo',
```

No mapa de rotas→permissão (após `'/creators-pontual': PERMISSION_KEYS.GESTAO.CREATORS_PONTUAL,`) adicionar:

```ts
  '/creators-modelo': PERMISSION_KEYS.GESTAO.CREATORS_MODELO,
```

Nos itens do grupo Gestão (após o item `{ title: 'Creators Pontual', ... }`) adicionar:

```ts
        { title: 'Creators: Rec × Pontual', url: '/creators-modelo', icon: 'Clapperboard', permissionKey: PERMISSION_KEYS.GESTAO.CREATORS_MODELO },
```

- [ ] **Step 3: Run the full test suite for the new files**

Run: `npx vitest run server/routes/creatorsModelo.helpers.test.ts server/routes/creatorsModelo.test.ts`
Expected: PASS (todos verdes).

- [ ] **Step 4: Type-check the build**

Run: `npx tsc --noEmit`
Expected: sem erros nos arquivos `creators-modelo` / `CreatorsModelo.tsx` / `nav-config.ts` / `App.tsx`. (Se houver erros pré-existentes não relacionados ao módulo, ignorar — mas nenhum dos novos arquivos pode aparecer.)

- [ ] **Step 5: Manual verification in the browser**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev
```

Then in the browser:
1. Abrir `http://localhost:3000/creators-modelo` (logar se necessário).
2. Conferir que o menu Gestão mostra "Creators: Rec × Pontual" e navega para a página.
3. Verificar os 3 cards headline, a tabela, o funil duplo e o card de recompra carregam com dados.
4. Trocar toggles: **Por cliente/Por contrato**, **Média/Mediana**, **situação Ativos/Cancelados/Todas**, **período De/Até** — confirmar que os números mudam coerentemente (período re-busca; os demais são instantâneos).
5. Sanity dos números contra o preview do design: pontual concluído por cliente ~R$6.7k; recorrente cancelado ~R$9.9k; funil entregue 37→16→10→6.
6. **Alternar dark e light mode** — nenhuma cor hardcodada, contraste ok em ambos.

Confirmar tudo antes de prosseguir. Se algum número destoar do esperado, investigar (a view local pode estar desatualizada — comparar com produção conforme `reference_databases`).

- [ ] **Step 6: Commit**

```bash
git add client/src/App.tsx shared/nav-config.ts
git commit -m "feat(creators-modelo): rota, item de menu e wiring da página

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (preenchido pelo autor do plano)

**1. Cobertura do spec:**
- §2 LTV recorrente realizado → `ltvRecorrente` da view (Task 2/5) ✓
- §3.1 toggle cliente/contrato → `buildUnits*` + `tabela.{cliente,contrato}` (Tasks 2,4) ✓
- §3.2 três estados pontual → `classifyEstadoPontual` (Task 1) ✓
- §3.3 LT pontual nº entregas + span → `Unit.nEntregas` + `Unit.lt` (Task 2) ✓
- §3.4 funil + headline → `funilVendido/Entregue` + HeadlineCards (Tasks 4,7) ✓
- §3.5 página dedicada → Tasks 6-10 ✓
- §3.6 filtro de período + avisos → `aplicarPeriodo` + AvisosMetodologicos (Tasks 4,7) ✓
- §3.7 separar avulso/sequenciado → `isSequenciado` + `buildRecompra` + meta (Tasks 1,3,4) ✓
- §4 layout (filtros, cards, tabela, funil, recompra, avisos) → Tasks 6-9 ✓
- §6 backend reaproveita churnPontorrente + lt recorrente → Task 4 (`toJornadas/buildFunil`) e view (`lt_meses/ltv_recorrente`) ✓
- §8 testes mínimos → Tasks 1-5 ✓

**2. Placeholder scan:** sem TBD/TODO; todo código presente. ✓

**3. Type consistency:** `RawRow`, `Metricas`, `Grupo`, `Unit`, `CurvaPonto`, `Recompra`, `CreatorsModeloPayload` consistentes entre backend (helpers) e frontend (types.ts). Funções: `buildUnitsRecorrente/Pontual`, `aggregateMetricas`, `buildCurvaRecorrente`, `buildRecompra`, `buildCreatorsModeloPayload`, `aplicarPeriodo`, `classifyModelo/EstadoRecorrente/EstadoPontual`, `isSequenciado`, `mesesEntre` — nomes idênticos onde consumidos. ✓
