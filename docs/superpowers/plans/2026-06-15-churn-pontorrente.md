# Churn Pontorrente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir uma visualização de churn de contratos ponto-recorrentes (pontorrentes) — o drop-off entre entregas (1→4), com decomposição da queda e detalhamento por motivo/responsável/CS/squad.

**Architecture:** Toda a lógica de negócio vive em **helpers puros TypeScript** (extração de nível via regex, classificação de situação, agregação em jornadas e funil), 100% testados com vitest. Um **único endpoint** `GET /api/churn-pontorrente` busca as linhas cruas de `"Clickup".cup_contratos` (`servico ILIKE '%entrega%'`), aplica os helpers e devolve o payload completo. O frontend é uma página standalone React (wouter + React Query + Recharts) na seção Gestão.

**Tech Stack:** TypeScript, Express, Drizzle (`db.execute(sql\`...\`)`), Postgres, vitest + supertest, React, wouter, @tanstack/react-query, Recharts, Tailwind.

**Refinamentos vs. spec (mesmo comportamento externo):**
- Sem view `cortex_core.vw_pontorrente` — lógica em helpers TS (testável, sem DDL em prod; dataset ~263 linhas).
- Um endpoint consolidado em vez de 4 — todos os blocos derivam do mesmo snapshot filtrado.

---

## File Structure

**Backend (`server/`)**
- Create `server/routes/churnPontorrente.helpers.ts` — lógica pura: extração, classificação, jornadas, funil, overview, dimensões, detalhamento, payload.
- Create `server/routes/churnPontorrente.helpers.test.ts` — unit tests dos helpers.
- Create `server/routes/churnPontorrente.ts` — `registerChurnPontorrenteRoutes(app, db)` com 1 endpoint.
- Create `server/routes/churnPontorrente.test.ts` — supertest mockando `db.execute`.
- Modify `server/routes.ts` — import (junto aos demais, ~linha 81) + chamada (junto às demais, ~linha 8213).

**Frontend (`client/src/`)**
- Create `client/src/components/churn-pontorrente/types.ts` — tipos do payload + estado de filtros.
- Create `client/src/components/churn-pontorrente/utils.ts` — `fetchJson`, `buildUrl` (mesmo padrão de `creators-pontual/utils.ts`).
- Create `client/src/components/churn-pontorrente/Filtros.tsx`
- Create `client/src/components/churn-pontorrente/OverviewCards.tsx`
- Create `client/src/components/churn-pontorrente/FunilContinuidade.tsx`
- Create `client/src/components/churn-pontorrente/ChurnPorDimensao.tsx`
- Create `client/src/components/churn-pontorrente/DetalhamentoTable.tsx`
- Create `client/src/pages/ChurnPontorrente.tsx` — página que compõe tudo.
- Modify `shared/nav-config.ts` — permission key + ROUTE_TO_PERMISSION + item de menu em Gestão.
- Modify `client/src/App.tsx` — lazy import + `<Route>`.

---

## Task 1: Helpers — extração de nível + classificação de situação

**Files:**
- Create: `server/routes/churnPontorrente.helpers.ts`
- Test: `server/routes/churnPontorrente.helpers.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `server/routes/churnPontorrente.helpers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { extractNivelEntrega, classifySituacao } from "./churnPontorrente.helpers";

describe("extractNivelEntrega", () => {
  it("pega 'Entrega N' (número depois)", () => {
    expect(extractNivelEntrega("Entrega 1 - Performance - Starter")).toBe(1);
    expect(extractNivelEntrega("Entrega 3- Social Media Ponto-rrente Starter")).toBe(3);
  });
  it("pega '(Entrega 0N)' com zero à esquerda", () => {
    expect(extractNivelEntrega("Creators (Entrega 01) - Starter")).toBe(1);
  });
  it("pega 'Nª Entrega' (ordinal antes)", () => {
    expect(extractNivelEntrega("1ª Entrega - Creators")).toBe(1);
    expect(extractNivelEntrega("4ª Entrega - Creators - Scale")).toBe(4);
  });
  it("ignora falso-positivo sem número adjacente a 'entrega'", () => {
    expect(extractNivelEntrega("Entrega de 3 rótulos para a embalagem")).toBeNull();
  });
  it("retorna null para vazio/sem entrega", () => {
    expect(extractNivelEntrega("")).toBeNull();
    expect(extractNivelEntrega(null)).toBeNull();
    expect(extractNivelEntrega("Creators Recorrente")).toBeNull();
  });
});

describe("classifySituacao", () => {
  it("entregue", () => expect(classifySituacao("entregue")).toBe("entregue"));
  it("churn p/ cancelado e não usar", () => {
    expect(classifySituacao("cancelado/inativo")).toBe("churn");
    expect(classifySituacao("não usar")).toBe("churn");
  });
  it("em_andamento p/ os demais", () => {
    for (const s of ["triagem", "ativo", "onboarding", "pausado", "", null]) {
      expect(classifySituacao(s as any)).toBe("em_andamento");
    }
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- churnPontorrente.helpers`
Expected: FAIL — `Cannot find module './churnPontorrente.helpers'`.

- [ ] **Step 3: Implementar o mínimo**

Criar `server/routes/churnPontorrente.helpers.ts`:

```ts
// Lógica pura do churn de contratos ponto-recorrentes (pontorrentes).
// Os endpoints buscam as linhas cruas de cup_contratos (servico ILIKE '%entrega%')
// e delegam toda a regra de negócio para estas funções (testáveis sem banco).

export type Situacao = "entregue" | "em_andamento" | "churn";

// "Entrega 1", "Entrega 01" (número depois, com zero à esquerda)
const RE_DEPOIS = /entrega\s*0*(\d+)/i;
// "1ª Entrega", "4 entregas" (número antes, ordinal opcional)
const RE_ANTES = /(\d+)\s*ª?\s*entrega/i;

/** Extrai o número da entrega (1..N) do campo `servico`, ou null se não houver. */
export function extractNivelEntrega(servico: string | null | undefined): number | null {
  if (!servico) return null;
  const m1 = servico.match(RE_DEPOIS);
  if (m1) return parseInt(m1[1], 10);
  const m2 = servico.match(RE_ANTES);
  if (m2) return parseInt(m2[1], 10);
  return null;
}

/** Classifica o status do ClickUp em situação de jornada. */
export function classifySituacao(status: string | null | undefined): Situacao {
  const s = (status ?? "").trim().toLowerCase();
  if (s === "entregue") return "entregue";
  if (s === "cancelado/inativo" || s === "não usar") return "churn";
  return "em_andamento";
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- churnPontorrente.helpers`
Expected: PASS (todos os casos do describe).

- [ ] **Step 5: Commit**

```bash
git add server/routes/churnPontorrente.helpers.ts server/routes/churnPontorrente.helpers.test.ts
git commit -m "feat(churn-pontorrente): helpers de extração de nível e classificação de situação"
```

---

## Task 2: Helpers — montar jornadas + filtros

**Files:**
- Modify: `server/routes/churnPontorrente.helpers.ts`
- Test: `server/routes/churnPontorrente.helpers.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao final de `server/routes/churnPontorrente.helpers.test.ts`:

```ts
import { toJornadas, applyFiltros, type RawRow } from "./churnPontorrente.helpers";

function row(p: Partial<RawRow>): RawRow {
  return {
    idTask: "A", produto: "Creators", servico: "Entrega 1 - Creators", status: "entregue",
    valorp: 100, squad: "Olimpo", responsavel: "Mariana", csResponsavel: "CS1",
    vendedor: "V1", motivoCancelamento: null, dataInicio: "2025-06-25",
    dataEncerramento: null, nomeCliente: "Cliente A", ...p,
  };
}

describe("toJornadas (base vendido)", () => {
  const rows: RawRow[] = [
    row({ idTask: "A", servico: "Entrega 1 - Creators", status: "entregue" }),
    row({ idTask: "A", servico: "Entrega 4 - Creators", status: "cancelado/inativo", valorp: 1000, motivoCancelamento: "Inadimplente" }),
    row({ idTask: "B", servico: "Entrega 2 - Creators", status: "ativo", valorp: 500 }),
    row({ idTask: "B", servico: "Entrega 1 - Creators", status: "entregue", valorp: 50 }),
    row({ idTask: "Z", servico: "Entrega de 3 rótulos", status: "entregue" }), // sem nível → fora
  ];
  it("agrupa por (idTask, produto) e pega o estágio de maior nível", () => {
    const js = toJornadas(rows, "vendido");
    const a = js.find((j) => j.idTask === "A")!;
    expect(a.nivelMax).toBe(4);
    expect(a.situacaoFinal).toBe("churn");
    expect(a.valorp).toBe(1000);
    expect(a.motivoCancelamento).toBe("Inadimplente");
    const b = js.find((j) => j.idTask === "B")!;
    expect(b.nivelMax).toBe(2);
    expect(b.situacaoFinal).toBe("em_andamento");
  });
  it("descarta linhas sem nível extraível", () => {
    expect(toJornadas(rows, "vendido").some((j) => j.idTask === "Z")).toBe(false);
  });
});

describe("toJornadas (base entregue)", () => {
  const rows: RawRow[] = [
    row({ idTask: "A", servico: "Entrega 1 - Creators", status: "entregue" }),
    row({ idTask: "A", servico: "Entrega 4 - Creators", status: "cancelado/inativo", valorp: 1000 }),
    row({ idTask: "C", servico: "Entrega 1 - Performance", produto: "Performance", status: "cancelado/inativo" }),
  ];
  it("considera só estágios entregues", () => {
    const js = toJornadas(rows, "entregue");
    const a = js.find((j) => j.idTask === "A")!;
    expect(a.nivelMax).toBe(1);            // entrega 4 cancelada é ignorada
    expect(a.situacaoFinal).toBe("entregue");
    expect(js.some((j) => j.idTask === "C")).toBe(false); // C não tem nada entregue
  });
});

describe("applyFiltros", () => {
  const rows: RawRow[] = [
    row({ idTask: "A", produto: "Creators", squad: "Olimpo", responsavel: "Mariana", dataInicio: "2025-06-25" }),
    row({ idTask: "C", produto: "Performance", squad: "Selva", responsavel: "Larissa", dataInicio: "2026-01-10", servico: "Entrega 1 - Performance" }),
  ];
  const js = toJornadas(rows, "vendido");
  it("filtra por produto", () => {
    expect(applyFiltros(js, { produto: "Performance" }).map((j) => j.idTask)).toEqual(["C"]);
  });
  it("filtra por mês de início (de/ate)", () => {
    expect(applyFiltros(js, { de: "2026-01" }).map((j) => j.idTask)).toEqual(["C"]);
    expect(applyFiltros(js, { ate: "2025-12" }).map((j) => j.idTask)).toEqual(["A"]);
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test -- churnPontorrente.helpers`
Expected: FAIL — `toJornadas`/`applyFiltros`/`RawRow` não exportados.

- [ ] **Step 3: Implementar**

Adicionar a `server/routes/churnPontorrente.helpers.ts`:

```ts
export interface RawRow {
  idTask: string | null;
  produto: string | null;
  servico: string;
  status: string | null;
  valorp: number | null;
  squad: string | null;
  responsavel: string | null;
  csResponsavel: string | null;
  vendedor: string | null;
  motivoCancelamento: string | null;
  dataInicio: string | null;        // 'YYYY-MM-DD'
  dataEncerramento: string | null;  // data_solicitacao_encerramento, 'YYYY-MM-DD'
  nomeCliente: string | null;
}

export interface Jornada {
  idTask: string;
  produto: string;
  nomeCliente: string | null;
  nivelMax: number;
  situacaoFinal: Situacao;
  valorp: number;
  squad: string | null;
  responsavel: string | null;
  csResponsavel: string | null;
  vendedor: string | null;
  motivoCancelamento: string | null;
  dataInicioPrimeira: string | null;
  dataEncerramento: string | null;
}

export interface Filtros {
  produto?: string;
  squad?: string;
  responsavel?: string;
  de?: string;   // 'YYYY-MM' (mês de início >=)
  ate?: string;  // 'YYYY-MM' (mês de início <=)
}

/** Agrupa as linhas em jornadas (id_task × produto), conforme a base do funil. */
export function toJornadas(rows: RawRow[], base: "vendido" | "entregue"): Jornada[] {
  const groups = new Map<string, RawRow[]>();
  for (const r of rows) {
    if (extractNivelEntrega(r.servico) == null) continue;
    if (!r.idTask || !r.produto) continue;
    const key = `${r.idTask}|||${r.produto}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  }

  const jornadas: Jornada[] = [];
  for (const [key, stages] of groups) {
    const elegiveis = base === "entregue"
      ? stages.filter((s) => classifySituacao(s.status) === "entregue")
      : stages;
    if (elegiveis.length === 0) continue;

    let topo = elegiveis[0];
    let topoNivel = extractNivelEntrega(topo.servico)!;
    for (const s of elegiveis) {
      const n = extractNivelEntrega(s.servico)!;
      if (n > topoNivel || (n === topoNivel && (s.valorp ?? 0) > (topo.valorp ?? 0))) {
        topo = s; topoNivel = n;
      }
    }

    const datasInicio = stages
      .map((s) => s.dataInicio)
      .filter((d): d is string => !!d)
      .sort();
    const [idTask, produto] = key.split("|||");
    jornadas.push({
      idTask, produto,
      nomeCliente: topo.nomeCliente,
      nivelMax: topoNivel,
      situacaoFinal: classifySituacao(topo.status),
      valorp: topo.valorp ?? 0,
      squad: topo.squad,
      responsavel: topo.responsavel,
      csResponsavel: topo.csResponsavel,
      vendedor: topo.vendedor,
      motivoCancelamento: topo.motivoCancelamento,
      dataInicioPrimeira: datasInicio[0] ?? null,
      dataEncerramento: topo.dataEncerramento,
    });
  }
  return jornadas;
}

/** Filtra jornadas por produto/squad/responsável/mês de início. */
export function applyFiltros(jornadas: Jornada[], f: Filtros): Jornada[] {
  return jornadas.filter((j) => {
    if (f.produto && f.produto !== "todos" && j.produto !== f.produto) return false;
    if (f.squad && f.squad !== "todos" && j.squad !== f.squad) return false;
    if (f.responsavel && f.responsavel !== "todos" && j.responsavel !== f.responsavel) return false;
    const mes = j.dataInicioPrimeira ? j.dataInicioPrimeira.slice(0, 7) : null;
    if (f.de && (!mes || mes < f.de)) return false;
    if (f.ate && (!mes || mes > f.ate)) return false;
    return true;
  });
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- churnPontorrente.helpers`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routes/churnPontorrente.helpers.ts server/routes/churnPontorrente.helpers.test.ts
git commit -m "feat(churn-pontorrente): montagem de jornadas (cliente×produto) e filtros"
```

---

## Task 3: Helpers — funil de sobrevivência + overview

**Files:**
- Modify: `server/routes/churnPontorrente.helpers.ts`
- Test: `server/routes/churnPontorrente.helpers.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao teste:

```ts
import { buildFunil, buildOverview } from "./churnPontorrente.helpers";

const cenario: RawRow[] = [
  row({ idTask: "A", servico: "Entrega 1 - Creators", status: "entregue", valorp: 10 }),
  row({ idTask: "A", servico: "Entrega 2 - Creators", status: "entregue", valorp: 10 }),
  row({ idTask: "A", servico: "Entrega 3 - Creators", status: "entregue", valorp: 10 }),
  row({ idTask: "A", servico: "Entrega 4 - Creators", status: "cancelado/inativo", valorp: 1000, motivoCancelamento: "Inadimplente" }),
  row({ idTask: "B", servico: "Entrega 1 - Creators", status: "entregue", valorp: 50 }),
  row({ idTask: "B", servico: "Entrega 2 - Creators", status: "ativo", valorp: 500 }),
  row({ idTask: "C", produto: "Performance", servico: "Entrega 1 - Performance", status: "cancelado/inativo", valorp: 800, squad: "Selva", responsavel: "Larissa", motivoCancelamento: "Erro na Venda" }),
];

describe("buildFunil", () => {
  const funil = buildFunil(toJornadas(cenario, "vendido"));
  it("calcula sobrevivência por nível", () => {
    expect(funil.map((n) => n.atingiram)).toEqual([3, 2, 1, 1]);
  });
  it("decompõe quem parou em cada degrau", () => {
    expect(funil[0]).toMatchObject({ nivel: 1, pararamAqui: 1, churn: 1, valorpChurn: 800 });
    expect(funil[1]).toMatchObject({ nivel: 2, pararamAqui: 1, emAndamento: 1 });
    expect(funil[3]).toMatchObject({ nivel: 4, pararamAqui: 1, churn: 1, valorpChurn: 1000 });
  });
  it("calcula drop % para o próximo degrau", () => {
    expect(funil[0].dropPct).toBe(33.3); // (3-2)/3
    expect(funil[1].dropPct).toBe(50);   // (2-1)/2
    expect(funil[3].dropPct).toBe(0);    // último
  });
});

describe("buildOverview", () => {
  it("calcula KPIs", () => {
    const ov = buildOverview(toJornadas(cenario, "vendido"));
    expect(ov.jornadas).toBe(3);
    expect(ov.retencaoUltima).toBe(33.3);   // atingiram[4]/atingiram[1] = 1/3
    expect(ov.churnConfirmado).toBe(2);      // A e C
    expect(ov.valorpPerdido).toBe(1800);     // 1000 + 800
  });
  it("base entregue zera o churn (entrega 4 cancelada some)", () => {
    const ov = buildOverview(toJornadas(cenario, "entregue"));
    expect(ov.churnConfirmado).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test -- churnPontorrente.helpers`
Expected: FAIL — `buildFunil`/`buildOverview` não definidos.

- [ ] **Step 3: Implementar**

Adicionar a `churnPontorrente.helpers.ts`:

```ts
export interface FunilNivel {
  nivel: number;
  atingiram: number;     // jornadas com nivelMax >= nivel
  pararamAqui: number;   // nivelMax === nivel
  churn: number;
  emAndamento: number;
  concluido: number;
  valorpChurn: number;
  dropPct: number;       // queda % para o próximo degrau (0 no último)
}

export function buildFunil(jornadas: Jornada[]): FunilNivel[] {
  if (jornadas.length === 0) return [];
  const maxNivel = Math.max(...jornadas.map((j) => j.nivelMax));
  const niveis: FunilNivel[] = [];
  for (let n = 1; n <= maxNivel; n++) {
    const pararam = jornadas.filter((j) => j.nivelMax === n);
    niveis.push({
      nivel: n,
      atingiram: jornadas.filter((j) => j.nivelMax >= n).length,
      pararamAqui: pararam.length,
      churn: pararam.filter((j) => j.situacaoFinal === "churn").length,
      emAndamento: pararam.filter((j) => j.situacaoFinal === "em_andamento").length,
      concluido: pararam.filter((j) => j.situacaoFinal === "entregue").length,
      valorpChurn: pararam
        .filter((j) => j.situacaoFinal === "churn")
        .reduce((a, j) => a + j.valorp, 0),
      dropPct: 0,
    });
  }
  for (let i = 0; i < niveis.length - 1; i++) {
    const cur = niveis[i].atingiram;
    const next = niveis[i + 1].atingiram;
    niveis[i].dropPct = cur > 0 ? Math.round(((cur - next) / cur) * 1000) / 10 : 0;
  }
  return niveis;
}

export interface Overview {
  jornadas: number;
  retencaoUltima: number;
  dropMedio: number;
  churnConfirmado: number;
  valorpPerdido: number;
}

export function buildOverview(jornadas: Jornada[]): Overview {
  const funil = buildFunil(jornadas);
  const nivel1 = funil[0]?.atingiram ?? 0;
  const ultimo = funil[funil.length - 1]?.atingiram ?? 0;
  const drops = funil.slice(0, -1).map((n) => n.dropPct);
  const dropMedio = drops.length
    ? Math.round((drops.reduce((a, b) => a + b, 0) / drops.length) * 10) / 10
    : 0;
  const churned = jornadas.filter((j) => j.situacaoFinal === "churn");
  return {
    jornadas: jornadas.length,
    retencaoUltima: nivel1 > 0 ? Math.round((ultimo / nivel1) * 1000) / 10 : 0,
    dropMedio,
    churnConfirmado: churned.length,
    valorpPerdido: churned.reduce((a, j) => a + j.valorp, 0),
  };
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- churnPontorrente.helpers`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routes/churnPontorrente.helpers.ts server/routes/churnPontorrente.helpers.test.ts
git commit -m "feat(churn-pontorrente): funil de sobrevivência e KPIs de overview"
```

---

## Task 4: Helpers — churn por dimensão, detalhamento e payload

**Files:**
- Modify: `server/routes/churnPontorrente.helpers.ts`
- Test: `server/routes/churnPontorrente.helpers.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao teste:

```ts
import { aggregateChurnPorDimensao, buildDetalhamento, buildPayload } from "./churnPontorrente.helpers";

describe("aggregateChurnPorDimensao", () => {
  it("agrega churn por motivo, ordenado por qtd e valor", () => {
    const dim = aggregateChurnPorDimensao(toJornadas(cenario, "vendido"), "motivo");
    expect(dim).toEqual([
      { label: "Inadimplente", qtd: 1, valorp: 1000 },
      { label: "Erro na Venda", qtd: 1, valorp: 800 },
    ]);
  });
  it("rotula vazio como (não informado)", () => {
    const rows: RawRow[] = [row({ idTask: "X", servico: "Entrega 1 - Creators", status: "cancelado/inativo", motivoCancelamento: null })];
    expect(aggregateChurnPorDimensao(toJornadas(rows, "vendido"), "motivo")[0].label).toBe("(não informado)");
  });
});

describe("buildDetalhamento", () => {
  it("lista só jornadas churnadas, ordenadas por valorp desc", () => {
    const det = buildDetalhamento(toJornadas(cenario, "vendido"));
    expect(det.map((d) => d.valorp)).toEqual([1000, 800]);
    expect(det[0]).toMatchObject({ produto: "Creators", nivelCaiu: 4, motivo: "Inadimplente" });
  });
});

describe("buildPayload", () => {
  it("monta payload completo e lista filtros disponíveis", () => {
    const p = buildPayload(cenario, "vendido", {});
    expect(p.overview.jornadas).toBe(3);
    expect(p.funil).toHaveLength(4);
    expect(p.detalhamento).toHaveLength(2);
    expect(p.filtrosDisponiveis.produtos).toEqual(["Creators", "Performance"]);
  });
  it("aplica filtro de produto sem mexer nos filtros disponíveis", () => {
    const p = buildPayload(cenario, "vendido", { produto: "Performance" });
    expect(p.overview.jornadas).toBe(1);
    expect(p.filtrosDisponiveis.produtos).toEqual(["Creators", "Performance"]);
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test -- churnPontorrente.helpers`
Expected: FAIL — `aggregateChurnPorDimensao`/`buildDetalhamento`/`buildPayload` não definidos.

- [ ] **Step 3: Implementar**

Adicionar a `churnPontorrente.helpers.ts`:

```ts
export type Dim = "motivo" | "squad" | "responsavel" | "cs";
export interface DimRow { label: string; qtd: number; valorp: number; }

export function aggregateChurnPorDimensao(jornadas: Jornada[], dim: Dim): DimRow[] {
  const pick = (j: Jornada): string => {
    const v = dim === "motivo" ? j.motivoCancelamento
      : dim === "squad" ? j.squad
      : dim === "responsavel" ? j.responsavel
      : j.csResponsavel;
    const t = (v ?? "").trim();
    return t === "" ? "(não informado)" : t;
  };
  const map = new Map<string, DimRow>();
  for (const j of jornadas.filter((x) => x.situacaoFinal === "churn")) {
    const label = pick(j);
    const cur = map.get(label) ?? { label, qtd: 0, valorp: 0 };
    cur.qtd += 1;
    cur.valorp += j.valorp;
    map.set(label, cur);
  }
  return [...map.values()].sort((a, b) => b.qtd - a.qtd || b.valorp - a.valorp);
}

export interface DetalheRow {
  nomeCliente: string | null;
  produto: string;
  nivelCaiu: number;
  motivo: string | null;
  responsavel: string | null;
  cs: string | null;
  squad: string | null;
  vendedor: string | null;
  valorp: number;
  dataEncerramento: string | null;
}

export function buildDetalhamento(jornadas: Jornada[]): DetalheRow[] {
  return jornadas
    .filter((j) => j.situacaoFinal === "churn")
    .map((j) => ({
      nomeCliente: j.nomeCliente,
      produto: j.produto,
      nivelCaiu: j.nivelMax,
      motivo: j.motivoCancelamento,
      responsavel: j.responsavel,
      cs: j.csResponsavel,
      squad: j.squad,
      vendedor: j.vendedor,
      valorp: j.valorp,
      dataEncerramento: j.dataEncerramento,
    }))
    .sort((a, b) => b.valorp - a.valorp);
}

export interface ChurnPontorrentePayload {
  overview: Overview;
  funil: FunilNivel[];
  churnPorDimensao: { motivo: DimRow[]; squad: DimRow[]; responsavel: DimRow[]; cs: DimRow[] };
  detalhamento: DetalheRow[];
  filtrosDisponiveis: { produtos: string[]; squads: string[]; responsaveis: string[] };
}

function distinctSorted(values: (string | null)[]): string[] {
  const set = new Set<string>();
  for (const v of values) { const t = (v ?? "").trim(); if (t) set.add(t); }
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function buildPayload(
  rows: RawRow[],
  base: "vendido" | "entregue",
  filtros: Filtros,
): ChurnPontorrentePayload {
  const todas = toJornadas(rows, base);
  const filtrosDisponiveis = {
    produtos: distinctSorted(todas.map((j) => j.produto)),
    squads: distinctSorted(todas.map((j) => j.squad)),
    responsaveis: distinctSorted(todas.map((j) => j.responsavel)),
  };
  const jornadas = applyFiltros(todas, filtros);
  return {
    overview: buildOverview(jornadas),
    funil: buildFunil(jornadas),
    churnPorDimensao: {
      motivo: aggregateChurnPorDimensao(jornadas, "motivo"),
      squad: aggregateChurnPorDimensao(jornadas, "squad"),
      responsavel: aggregateChurnPorDimensao(jornadas, "responsavel"),
      cs: aggregateChurnPorDimensao(jornadas, "cs"),
    },
    detalhamento: buildDetalhamento(jornadas),
    filtrosDisponiveis,
  };
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- churnPontorrente.helpers`
Expected: PASS (toda a suíte de helpers verde).

- [ ] **Step 5: Commit**

```bash
git add server/routes/churnPontorrente.helpers.ts server/routes/churnPontorrente.helpers.test.ts
git commit -m "feat(churn-pontorrente): churn por dimensão, detalhamento e payload consolidado"
```

---

## Task 5: Endpoint `GET /api/churn-pontorrente` + registro

**Files:**
- Create: `server/routes/churnPontorrente.ts`
- Test: `server/routes/churnPontorrente.test.ts`
- Modify: `server/routes.ts` (import ~linha 81, chamada ~linha 8213)

- [ ] **Step 1: Escrever o teste que falha**

Criar `server/routes/churnPontorrente.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const mockExecute = vi.fn();
vi.mock("../db", () => ({ db: { execute: mockExecute } }));

import { registerChurnPontorrenteRoutes } from "./churnPontorrente";

function makeApp() {
  const app = express();
  app.use((req, _res, next) => { (req as any).user = { email: "t@t.com" }; next(); });
  registerChurnPontorrenteRoutes(app, { execute: mockExecute } as any);
  return app;
}

beforeEach(() => vi.clearAllMocks());

const dbRows = [
  { idTask: "A", produto: "Creators", servico: "Entrega 1 - Creators", status: "entregue", valorp: "10", squad: "Olimpo", responsavel: "Mariana", csResponsavel: "CS1", vendedor: "V1", motivoCancelamento: null, dataInicio: "2025-06-25", dataEncerramento: null, nomeCliente: "Cliente A" },
  { idTask: "A", produto: "Creators", servico: "Entrega 4 - Creators", status: "cancelado/inativo", valorp: "1000", squad: "Olimpo", responsavel: "Mariana", csResponsavel: "CS1", vendedor: "V1", motivoCancelamento: "Inadimplente", dataInicio: "2025-09-01", dataEncerramento: "2026-02-01", nomeCliente: "Cliente A" },
  { idTask: "C", produto: "Performance", servico: "Entrega 1 - Performance", status: "cancelado/inativo", valorp: "800", squad: "Selva", responsavel: "Larissa", csResponsavel: "CS2", vendedor: "V2", motivoCancelamento: "Erro na Venda", dataInicio: "2026-01-10", dataEncerramento: "2026-03-01", nomeCliente: "Cliente C" },
];

describe("GET /api/churn-pontorrente", () => {
  it("retorna payload com overview, funil e detalhamento", async () => {
    mockExecute.mockResolvedValueOnce({ rows: dbRows });
    const res = await request(makeApp()).get("/api/churn-pontorrente");
    expect(res.status).toBe(200);
    expect(res.body.overview.jornadas).toBe(2);
    expect(res.body.overview.churnConfirmado).toBe(2);
    expect(res.body.overview.valorpPerdido).toBe(1800);
    expect(res.body.detalhamento[0].valorp).toBe(1000);
    expect(res.body.filtrosDisponiveis.produtos).toEqual(["Creators", "Performance"]);
  });

  it("aplica filtro de produto via query", async () => {
    mockExecute.mockResolvedValueOnce({ rows: dbRows });
    const res = await request(makeApp()).get("/api/churn-pontorrente?produto=Performance");
    expect(res.status).toBe(200);
    expect(res.body.overview.jornadas).toBe(1);
    expect(res.body.detalhamento[0].produto).toBe("Performance");
  });

  it("base=entregue zera o churn", async () => {
    mockExecute.mockResolvedValueOnce({ rows: dbRows });
    const res = await request(makeApp()).get("/api/churn-pontorrente?base=entregue");
    expect(res.status).toBe(200);
    expect(res.body.overview.churnConfirmado).toBe(0);
  });

  it("retorna 500 em erro de banco", async () => {
    mockExecute.mockRejectedValueOnce(new Error("db down"));
    const res = await request(makeApp()).get("/api/churn-pontorrente");
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test -- churnPontorrente.test`
Expected: FAIL — `Cannot find module './churnPontorrente'`.

- [ ] **Step 3: Implementar o endpoint**

Criar `server/routes/churnPontorrente.ts`:

```ts
import type { Express } from "express";
import { sql } from "drizzle-orm";
import { buildPayload, type RawRow, type Filtros } from "./churnPontorrente.helpers";

export function registerChurnPontorrenteRoutes(app: Express, db: any) {
  // Snapshot completo do churn de contratos ponto-recorrentes (filtros aplicados em memória).
  app.get("/api/churn-pontorrente", async (req, res) => {
    try {
      const base = req.query.base === "entregue" ? "entregue" : "vendido";
      const filtros: Filtros = {
        produto: (req.query.produto as string) || undefined,
        squad: (req.query.squad as string) || undefined,
        responsavel: (req.query.responsavel as string) || undefined,
        de: (req.query.de as string) || undefined,
        ate: (req.query.ate as string) || undefined,
      };

      const result = (await db.execute(sql`
        SELECT
          c.id_task                       AS "idTask",
          c.produto                       AS produto,
          c.servico                       AS servico,
          c.status                        AS status,
          c.valorp                        AS valorp,
          c.squad                         AS squad,
          c.responsavel                   AS responsavel,
          c.cs_responsavel                AS "csResponsavel",
          c.vendedor                      AS vendedor,
          c.motivo_cancelamento           AS "motivoCancelamento",
          to_char(c.data_inicio, 'YYYY-MM-DD')                   AS "dataInicio",
          to_char(c.data_solicitacao_encerramento, 'YYYY-MM-DD') AS "dataEncerramento",
          cl.nome                         AS "nomeCliente"
        FROM "Clickup".cup_contratos c
        LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = c.id_task
        WHERE c.servico ILIKE '%entrega%'
      `)).rows as any[];

      const rows: RawRow[] = result.map((r) => ({
        idTask: r.idTask ?? null,
        produto: r.produto ?? null,
        servico: r.servico ?? "",
        status: r.status ?? null,
        valorp: r.valorp != null ? Number(r.valorp) : null,
        squad: r.squad ?? null,
        responsavel: r.responsavel ?? null,
        csResponsavel: r.csResponsavel ?? null,
        vendedor: r.vendedor ?? null,
        motivoCancelamento: r.motivoCancelamento ?? null,
        dataInicio: r.dataInicio ?? null,
        dataEncerramento: r.dataEncerramento ?? null,
        nomeCliente: r.nomeCliente ?? null,
      }));

      res.json(buildPayload(rows, base, filtros));
    } catch (error) {
      console.error("[api] Error fetching churn-pontorrente:", error);
      res.status(500).json({ error: "Failed to fetch churn-pontorrente" });
    }
  });
}
```

- [ ] **Step 4: Registrar a rota em `server/routes.ts`**

Após a linha `import { registerCreatorsPontualRoutes } from "./routes/creatorsPontual";` (~linha 81), adicionar:

```ts
import { registerChurnPontorrenteRoutes } from "./routes/churnPontorrente";
```

Após a linha `registerCreatorsPontualRoutes(app, db);` (~linha 8213), adicionar:

```ts
  registerChurnPontorrenteRoutes(app, db);
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm test -- churnPontorrente.test`
Expected: PASS (4 casos).

- [ ] **Step 6: Validar contra o banco real (sanity, prod-aware)**

Subir o dev server e bater no endpoint para confirmar que os números fazem sentido (~70 jornadas, retenção ~77% na base vendido):

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
sleep 4
curl -s "http://localhost:3000/api/churn-pontorrente" | head -c 400
```
Expected: JSON com `overview.jornadas` próximo de 70 e `funil` com 4 níveis. (Se rodar contra local: ~70; contra prod pode diferir — anotar.)

- [ ] **Step 7: Commit**

```bash
git add server/routes/churnPontorrente.ts server/routes/churnPontorrente.test.ts server/routes.ts
git commit -m "feat(churn-pontorrente): endpoint GET /api/churn-pontorrente + registro"
```

---

## Task 6: Frontend — scaffolding (types, utils, nav, rota, página vazia)

**Files:**
- Create: `client/src/components/churn-pontorrente/types.ts`
- Create: `client/src/components/churn-pontorrente/utils.ts`
- Create: `client/src/pages/ChurnPontorrente.tsx`
- Modify: `shared/nav-config.ts` (3 pontos)
- Modify: `client/src/App.tsx` (lazy import + rota)

- [ ] **Step 1: Criar os tipos do frontend**

Criar `client/src/components/churn-pontorrente/types.ts`:

```ts
export interface Overview {
  jornadas: number;
  retencaoUltima: number;
  dropMedio: number;
  churnConfirmado: number;
  valorpPerdido: number;
}
export interface FunilNivel {
  nivel: number;
  atingiram: number;
  pararamAqui: number;
  churn: number;
  emAndamento: number;
  concluido: number;
  valorpChurn: number;
  dropPct: number;
}
export interface DimRow { label: string; qtd: number; valorp: number; }
export interface DetalheRow {
  nomeCliente: string | null;
  produto: string;
  nivelCaiu: number;
  motivo: string | null;
  responsavel: string | null;
  cs: string | null;
  squad: string | null;
  vendedor: string | null;
  valorp: number;
  dataEncerramento: string | null;
}
export interface ChurnPontorrentePayload {
  overview: Overview;
  funil: FunilNivel[];
  churnPorDimensao: { motivo: DimRow[]; squad: DimRow[]; responsavel: DimRow[]; cs: DimRow[] };
  detalhamento: DetalheRow[];
  filtrosDisponiveis: { produtos: string[]; squads: string[]; responsaveis: string[] };
}
export interface FiltrosState {
  base: "vendido" | "entregue";
  produto?: string;
  squad?: string;
  responsavel?: string;
  de?: string;
  ate?: string;
}
```

- [ ] **Step 2: Criar utils do frontend**

Criar `client/src/components/churn-pontorrente/utils.ts`:

```ts
export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erro ao buscar ${url}`);
  return res.json();
}

export function buildUrl(base: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") search.set(k, v);
  });
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}
```

- [ ] **Step 3: Criar a página (esqueleto que já compila)**

Criar `client/src/pages/ChurnPontorrente.tsx`:

```tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { fetchJson, buildUrl } from "@/components/churn-pontorrente/utils";
import type { ChurnPontorrentePayload, FiltrosState } from "@/components/churn-pontorrente/types";

export default function ChurnPontorrente() {
  useSetPageInfo("Churn Pontorrente", "Drop-off entre entregas dos contratos ponto-recorrentes");
  const [filtros] = useState<FiltrosState>({ base: "vendido" });

  const url = buildUrl("/api/churn-pontorrente", {
    base: filtros.base,
    produto: filtros.produto,
    squad: filtros.squad,
    responsavel: filtros.responsavel,
    de: filtros.de,
    ate: filtros.ate,
  });

  const { data, isLoading } = useQuery({
    queryKey: [url],
    queryFn: () => fetchJson<ChurnPontorrentePayload>(url),
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      {isLoading || !data ? (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
      ) : (
        <pre className="text-xs">{JSON.stringify(data.overview, null, 2)}</pre>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Adicionar permission key + rota→permissão + item de menu em `shared/nav-config.ts`**

Em `PERMISSION_KEYS.GESTAO`, após `CHURN_ABONADOS: 'gestao.churn_abonados',` (~linha 56):

```ts
    CHURN_PONTORRENTE: 'gestao.churn_pontorrente',
```

Em `ROUTE_TO_PERMISSION`, após `'/dashboard/churn-abonados': PERMISSION_KEYS.GESTAO.CHURN_ABONADOS,` (~linha 243):

```ts
  '/dashboard/churn-pontorrente': PERMISSION_KEYS.GESTAO.CHURN_PONTORRENTE,
```

No setor **Gestão** de `NAV_CONFIG`, após o item `Churns Abonados` (~linha 478):

```ts
        { title: 'Churn Pontorrente', url: '/dashboard/churn-pontorrente', icon: 'TrendingDown', permissionKey: PERMISSION_KEYS.GESTAO.CHURN_PONTORRENTE },
```

- [ ] **Step 5: Registrar lazy import + rota em `client/src/App.tsx`**

Após `const ChurnAbonados = lazyWithRetry(() => import("@/pages/ChurnAbonados"));` (~linha 76):

```ts
const ChurnPontorrente = lazyWithRetry(() => import("@/pages/ChurnPontorrente"));
```

Após a rota `<Route path="/dashboard/churn-produto">...</Route>` (~linha 326):

```tsx
      <Route path="/dashboard/churn-pontorrente">{() => <ProtectedRoute path="/dashboard/churn-pontorrente" component={ChurnPontorrente} />}</Route>
```

- [ ] **Step 6: Verificar build/typecheck e a rota no browser**

Run: `npm run build` (ou reinicie `npm run dev`)
Expected: build sem erros de tipo. Acessar `/dashboard/churn-pontorrente` deve mostrar o JSON de overview e o item aparecer no menu Gestão.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/churn-pontorrente/types.ts client/src/components/churn-pontorrente/utils.ts client/src/pages/ChurnPontorrente.tsx shared/nav-config.ts client/src/App.tsx
git commit -m "feat(churn-pontorrente): scaffolding da página, nav e rota"
```

---

## Task 7: Frontend — componentes (filtros, cards, funil, dimensões, tabela) + wiring

**Files:**
- Create: `client/src/components/churn-pontorrente/Filtros.tsx`
- Create: `client/src/components/churn-pontorrente/OverviewCards.tsx`
- Create: `client/src/components/churn-pontorrente/FunilContinuidade.tsx`
- Create: `client/src/components/churn-pontorrente/ChurnPorDimensao.tsx`
- Create: `client/src/components/churn-pontorrente/DetalhamentoTable.tsx`
- Modify: `client/src/pages/ChurnPontorrente.tsx`

- [ ] **Step 1: Filtros**

Criar `client/src/components/churn-pontorrente/Filtros.tsx`:

```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { FiltrosState } from "./types";

const TODOS = "todos";

export function Filtros({
  value, onChange, opcoes,
}: {
  value: FiltrosState;
  onChange: (f: FiltrosState) => void;
  opcoes?: { produtos: string[]; squads: string[]; responsaveis: string[] };
}) {
  const set = (patch: Partial<FiltrosState>) => onChange({ ...value, ...patch });
  const norm = (v: string) => (v === TODOS ? undefined : v);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={value.produto ?? TODOS} onValueChange={(v) => set({ produto: norm(v) })}>
        <SelectTrigger className="w-[170px]"><SelectValue placeholder="Produto" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos os produtos</SelectItem>
          {opcoes?.produtos.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={value.squad ?? TODOS} onValueChange={(v) => set({ squad: norm(v) })}>
        <SelectTrigger className="w-[170px]"><SelectValue placeholder="Squad" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos os squads</SelectItem>
          {opcoes?.squads.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={value.responsavel ?? TODOS} onValueChange={(v) => set({ responsavel: norm(v) })}>
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Responsável" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos os responsáveis</SelectItem>
          {opcoes?.responsaveis.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
        </SelectContent>
      </Select>

      <input
        type="month" value={value.de ?? ""} onChange={(e) => set({ de: e.target.value || undefined })}
        className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        aria-label="Início (de)"
      />
      <input
        type="month" value={value.ate ?? ""} onChange={(e) => set({ ate: e.target.value || undefined })}
        className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        aria-label="Início (até)"
      />

      <div className="ml-auto flex overflow-hidden rounded-md border border-gray-200 dark:border-zinc-700">
        {(["vendido", "entregue"] as const).map((b) => (
          <Button
            key={b} type="button" variant={value.base === b ? "default" : "ghost"}
            size="sm" className="rounded-none" onClick={() => set({ base: b })}
          >
            {b === "vendido" ? "Vendido" : "Só entregue"}
          </Button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: OverviewCards**

Criar `client/src/components/churn-pontorrente/OverviewCards.tsx`:

```tsx
import type { ElementType } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Percent, TrendingDown, UserX, DollarSign } from "lucide-react";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { Overview } from "./types";

function Kpi({ icon: Icon, label, value, sub }: { icon: ElementType; label: string; value: string; sub?: string }) {
  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
        <div>
          <p className="text-xs text-gray-500 dark:text-zinc-400">{label}</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
          {sub && <p className="text-xs text-gray-400 dark:text-zinc-500">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function OverviewCards({ data }: { data: Overview }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Kpi icon={Users} label="Jornadas pontorrente" value={String(data.jornadas)} />
      <Kpi icon={Percent} label="Retenção até a última entrega" value={`${data.retencaoUltima}%`} />
      <Kpi icon={TrendingDown} label="Drop-off médio / degrau" value={`${data.dropMedio}%`} />
      <Kpi icon={UserX} label="Churn confirmado" value={String(data.churnConfirmado)} />
      <Kpi icon={DollarSign} label="Valor pontual perdido" value={formatCurrencyNoDecimals(data.valorpPerdido)} />
    </div>
  );
}
```

- [ ] **Step 3: FunilContinuidade (sobrevivência + composição da parada)**

Criar `client/src/components/churn-pontorrente/FunilContinuidade.tsx`:

```tsx
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "@/components/ThemeProvider";
import type { FunilNivel } from "./types";

export function FunilContinuidade({ data }: { data: FunilNivel[] }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";
  const tooltipStyle = {
    backgroundColor: isDark ? "#18181b" : "#ffffff",
    border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
    borderRadius: 8,
    color: isDark ? "#f4f4f5" : "#111827",
  };

  const chart = data.map((n) => ({
    nome: `Entrega ${n.nivel}`,
    atingiram: n.atingiram,
    dropLabel: n.dropPct > 0 ? `-${n.dropPct}%` : "",
    Concluído: n.concluido,
    "Em andamento": n.emAndamento,
    Churn: n.churn,
  }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
        <CardHeader>
          <CardTitle className="text-base">Funil de continuidade</CardTitle>
          <p className="text-xs text-gray-500 dark:text-zinc-400">Jornadas que atingiram cada entrega (e a queda para a próxima)</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chart} margin={{ top: 24, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="nome" tick={{ fill: axis, fontSize: 11 }} />
              <YAxis tick={{ fill: axis, fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="atingiram" name="Atingiram" fill="#6366f1" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="atingiram" position="top" style={{ fill: axis, fontSize: 11 }} />
                <LabelList dataKey="dropLabel" position="insideTop" style={{ fill: "#ef4444", fontSize: 11, fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
        <CardHeader>
          <CardTitle className="text-base">Composição de quem parou em cada degrau</CardTitle>
          <p className="text-xs text-gray-500 dark:text-zinc-400">Churn (caiu) × em andamento (ainda roda) × concluído</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chart} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="nome" tick={{ fill: axis, fontSize: 11 }} />
              <YAxis tick={{ fill: axis, fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Concluído" stackId="s" fill="#10b981" />
              <Bar dataKey="Em andamento" stackId="s" fill="#f59e0b" />
              <Bar dataKey="Churn" stackId="s" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: ChurnPorDimensao (seletor + barras horizontais)**

Criar `client/src/components/churn-pontorrente/ChurnPorDimensao.tsx`:

```tsx
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { DimRow } from "./types";

type DimKey = "motivo" | "squad" | "responsavel" | "cs";
const LABELS: Record<DimKey, string> = {
  motivo: "Motivo do churn", squad: "Squad", responsavel: "Responsável", cs: "CS",
};

export function ChurnPorDimensao({
  data,
}: {
  data: { motivo: DimRow[]; squad: DimRow[]; responsavel: DimRow[]; cs: DimRow[] };
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";
  const [dim, setDim] = useState<DimKey>("motivo");
  const rows = data[dim].slice(0, 12);

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Churn por dimensão</CardTitle>
          <p className="text-xs text-gray-500 dark:text-zinc-400">Jornadas churnadas agrupadas — valor pontual no tooltip</p>
        </div>
        <Select value={dim} onValueChange={(v) => setDim(v as DimKey)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(LABELS) as DimKey[]).map((k) => (
              <SelectItem key={k} value={k}>{LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 34)}>
          <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis type="number" tick={{ fill: axis, fontSize: 11 }} allowDecimals={false} />
            <YAxis type="category" dataKey="label" tick={{ fill: axis, fontSize: 11 }} width={160} />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#18181b" : "#ffffff",
                border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
                borderRadius: 8, color: isDark ? "#f4f4f5" : "#111827",
              }}
              formatter={(v: number, _n, item: any) =>
                [`${v} jornada(s) — ${formatCurrencyNoDecimals(item.payload.valorp)}`, "Churn"]}
            />
            <Bar dataKey="qtd" name="Churn" fill="#ef4444" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: DetalhamentoTable**

Criar `client/src/components/churn-pontorrente/DetalhamentoTable.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { DetalheRow } from "./types";

export function DetalhamentoTable({ rows }: { rows: DetalheRow[] }) {
  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <CardTitle className="text-base">Detalhamento do churn</CardTitle>
        <p className="text-xs text-gray-500 dark:text-zinc-400">{rows.length} jornada(s) churnada(s)</p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
              <th className="py-2 pr-3">Cliente</th>
              <th className="py-2 pr-3">Produto</th>
              <th className="py-2 pr-3">Caiu na entrega</th>
              <th className="py-2 pr-3">Motivo</th>
              <th className="py-2 pr-3">Responsável</th>
              <th className="py-2 pr-3">CS</th>
              <th className="py-2 pr-3">Squad</th>
              <th className="py-2 pr-3">Vendedor</th>
              <th className="py-2 pr-3 text-right">Valor pontual</th>
              <th className="py-2 pr-3">Encerramento</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-gray-100 text-gray-700 dark:border-zinc-800 dark:text-zinc-300">
                <td className="py-2 pr-3">{r.nomeCliente ?? "—"}</td>
                <td className="py-2 pr-3">{r.produto}</td>
                <td className="py-2 pr-3">{r.nivelCaiu}ª</td>
                <td className="py-2 pr-3">{r.motivo ?? "—"}</td>
                <td className="py-2 pr-3">{r.responsavel ?? "—"}</td>
                <td className="py-2 pr-3">{r.cs ?? "—"}</td>
                <td className="py-2 pr-3">{r.squad ?? "—"}</td>
                <td className="py-2 pr-3">{r.vendedor ?? "—"}</td>
                <td className="py-2 pr-3 text-right">{formatCurrencyNoDecimals(r.valorp)}</td>
                <td className="py-2 pr-3">{r.dataEncerramento ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="py-6 text-center text-gray-400 dark:text-zinc-500">Sem churn no filtro atual</td></tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: Ligar tudo na página**

Substituir o conteúdo de `client/src/pages/ChurnPontorrente.tsx` por:

```tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Filtros } from "@/components/churn-pontorrente/Filtros";
import { OverviewCards } from "@/components/churn-pontorrente/OverviewCards";
import { FunilContinuidade } from "@/components/churn-pontorrente/FunilContinuidade";
import { ChurnPorDimensao } from "@/components/churn-pontorrente/ChurnPorDimensao";
import { DetalhamentoTable } from "@/components/churn-pontorrente/DetalhamentoTable";
import { fetchJson, buildUrl } from "@/components/churn-pontorrente/utils";
import type { ChurnPontorrentePayload, FiltrosState } from "@/components/churn-pontorrente/types";

export default function ChurnPontorrente() {
  useSetPageInfo("Churn Pontorrente", "Drop-off entre entregas dos contratos ponto-recorrentes");
  const [filtros, setFiltros] = useState<FiltrosState>({ base: "vendido" });

  const url = buildUrl("/api/churn-pontorrente", {
    base: filtros.base,
    produto: filtros.produto,
    squad: filtros.squad,
    responsavel: filtros.responsavel,
    de: filtros.de,
    ate: filtros.ate,
  });

  const { data, isLoading } = useQuery({
    queryKey: [url],
    queryFn: () => fetchJson<ChurnPontorrentePayload>(url),
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Filtros value={filtros} onChange={setFiltros} opcoes={data?.filtrosDisponiveis} />
      {isLoading || !data ? (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
      ) : (
        <>
          <OverviewCards data={data.overview} />
          <FunilContinuidade data={data.funil} />
          <ChurnPorDimensao data={data.churnPorDimensao} />
          <DetalhamentoTable rows={data.detalhamento} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Verificar build/typecheck**

Run: `npm run build`
Expected: build sem erros de tipo.

- [ ] **Step 8: Commit**

```bash
git add client/src/components/churn-pontorrente/ client/src/pages/ChurnPontorrente.tsx
git commit -m "feat(churn-pontorrente): componentes (filtros, cards, funil, dimensões, tabela) + página"
```

---

## Task 8: Verificação manual + ajuste de números reais + commit final

**Files:** nenhum novo (só validação; ajustes pontuais se necessário).

- [ ] **Step 1: Subir o app e abrir a página**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev
```
Abrir `http://localhost:3000/dashboard/churn-pontorrente`.

- [ ] **Step 2: Conferir comportamento**

Validar manualmente:
- Cards mostram ~70 jornadas (base vendido) e retenção plausível (~77%).
- Funil com 4 degraus, labels de drop entre eles, e composição (churn/em andamento/concluído).
- Trocar **Vendido → Só entregue** muda os números (churn cai).
- Filtros de produto/squad/responsável/mês recortam todos os blocos.
- "Churn por dimensão" troca entre motivo/squad/responsável/CS.
- Tabela de detalhamento lista as jornadas churnadas com motivo, responsável, CS, squad, vendedor, valor.
- **Dark mode e light mode** ok.

- [ ] **Step 3: Rodar a suíte completa**

Run: `npm test -- churnPontorrente`
Expected: PASS (helpers + endpoint).

- [ ] **Step 4: Commit final (se houver ajustes)**

```bash
git add -A
git commit -m "test(churn-pontorrente): verificação manual e ajustes finais" || echo "nada a commitar"
```

---

## Notas de execução
- **Banco:** investigação foi em local (`cortex_dev`). Antes de considerar pronto, conferir que o dev server está lendo o banco esperado e que os números batem; se rodar contra prod, anotar diferenças (memória: aplicar mudanças de schema em prod também — aqui não há mudança de schema, apenas leitura).
- **Permissão:** a key `gestao.churn_pontorrente` entra no grupo GESTAO (auto-incluída via `getCategoryKeys('GESTAO')` para perfis que usam o grupo). Confirmar acesso ao abrir a página; se bloquear, conceder a permission key ao usuário/perfil.
- **Pós-conclusão:** seguir o workflow do projeto (git push, Obsidian, status do chamado) conforme `MEMORY.md`.
