# CEO Dashboard — Bloco "Movimento de Receita" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar 8 indicadores de movimento de receita (Venda/Churn/Cross-sell/NRR × MRR/Pontual) ao fim da matriz mês×mês do CEO Dashboard, agrupados em duas seções, com drill por mês.

**Architecture:** Um helper compartilhado (`ceoDashboard.movimentoReceita.ts`) é a fonte única das 8 séries: reusa 5 linhas já prontas de `computarBpReceitas` e adiciona só 2 queries (cross-sell por mês, MRR-início por mês). A matriz transpõe as linhas; o drill reusa o mesmo helper para header, gráfico e reconciliação. Toda a régua (inclusive NRR) vive em uma função pura testável.

**Tech Stack:** TypeScript, Express, Drizzle (`db.execute(sql\`...\`)`), React, TanStack Query, Vitest, Tailwind.

## Global Constraints

- NRR = régua de **erosão** do código: `(churn − cross-sell) / base × 100`, **menor = melhor**. Base ausente/zero → célula `null` (nunca 0).
- NRR Pontual: base = **estoque pontual inicial** (`pontual_estoque_ini`).
- `churn_mes` (metricasGerais) tem `realizado` **positivo**; `pontual_churn` (pontual) tem `realizado` **negativo** e `orcado: 0` → normalizar para positivo ao exibir/derivar.
- Cross-sell e NRR **não têm meta** → linha `semMeta: true` (neutro). Venda/Churn MRR e Venda Pontual herdam a meta do BP (`semMeta: false`).
- Dark/light mode obrigatório em qualquer UI nova (classes `dark:`).
- Ano fixo 2026 (o BP é 2026). Mês corrente é parcial (herda `mesFechado`; coluna `mes > mesFechado` recebe `*`).
- Commits: Conventional Commits + `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Branch: `feature/ceo-dashboard-movimento-receita` (já criada).
- Subagentes: NÃO rodar `npm run dev` nem matar a porta 3000; validar só com `npm run check` (tsc) e `npx vitest run`.

**Keys das 8 linhas (usadas em toda parte):** `venda_mrr`, `churn_mrr`, `cross_mrr`, `nrr`, `venda_pontual`, `churn_pontual`, `cross_pontual`, `nrr_pontual`.

**Comandos de referência:**
- Typecheck: `npm run check`
- Um teste: `npx vitest run <arquivo.test.ts>`
- Prod psql (validação de query):
  ```bash
  PROD_PASS=$(grep -E "^# *DB_PASSWORD=" .env | head -1 | sed -E 's/^# *DB_PASSWORD=//' | tr -d '"'"'"' \r')
  PGPASSWORD="$PROD_PASS" psql -h 34.95.249.110 -U postgres -d dados_turbo -P pager=off -c "<SQL>"
  ```

---

### Task 1: Queries IO — cross-sell por mês + MRR-início por mês

**Files:**
- Create: `server/routes/ceoDashboard.movimentoReceita.ts`

**Interfaces:**
- Produces: `carregarMovimentoQueries(db): Promise<MovimentoQueries>` onde
  `interface MovimentoQueries { crossMrrPorMes: Record<number, number>; crossPontPorMes: Record<number, number>; mrrInicioPorMes: Record<number, number>; }`

- [ ] **Step 1: Validar a query de cross-sell por mês no banco**

Rodar (psql prod, ver comando no header). Espera: linhas por mês de 2026 com `cross_mrr`/`cross_pont` (podem ser 0; jul é parcial):

```sql
WITH cliente_inicio AS (
  SELECT REGEXP_REPLACE(COALESCE(c.cnpj,''),'[^0-9]','','g') AS cnpj_norm,
         MIN(ct.data_inicio)::date AS primeiro_contrato
  FROM "Clickup".cup_clientes c
  JOIN "Clickup".cup_contratos ct ON ct.id_task = c.task_id
  WHERE COALESCE(c.cnpj,'') <> '' GROUP BY 1
),
deals AS (
  SELECT EXTRACT(MONTH FROM d.data_fechamento)::int AS mes,
    COALESCE(d.valor_recorrente::numeric,0) AS rec,
    COALESCE(d.valor_pontual::numeric,0) AS pont,
    (d.source='PARTNER' AND ci.primeiro_contrato IS NOT NULL
      AND ci.primeiro_contrato < date_trunc('month', d.data_fechamento)::date) AS is_cross
  FROM "Bitrix".crm_deal d
  LEFT JOIN cliente_inicio ci ON REGEXP_REPLACE(COALESCE(d.cnpj,''),'[^0-9]','','g') = ci.cnpj_norm
  WHERE d.stage_name='Negócio Ganho' AND d.data_fechamento IS NOT NULL
    AND EXTRACT(YEAR FROM d.data_fechamento)=2026
)
SELECT mes,
  COALESCE(SUM(rec) FILTER (WHERE is_cross),0) AS cross_mrr,
  COALESCE(SUM(pont) FILTER (WHERE is_cross),0) AS cross_pont
FROM deals GROUP BY mes ORDER BY mes;
```

- [ ] **Step 2: Validar a query de MRR-início por mês no banco**

Rodar (psql prod). Espera: 1 linha por mês com `mrr_inicio > 0` (nº grande, base recorrente no 1º snapshot do mês). `cup_data_hist` só existe desde 17/nov/2025, então meses sem snapshot no início do mês retornam via `MIN` do mês:

```sql
WITH meses AS (SELECT generate_series(1,12) AS mes),
snap AS (
  SELECT m.mes,
    (SELECT MIN(data_snapshot) FROM "Clickup".cup_data_hist h
     WHERE date_trunc('month', h.data_snapshot) = make_date(2026, m.mes, 1)) AS snap
  FROM meses m
)
SELECT s.mes, COALESCE(SUM(h.valorr::numeric),0) AS mrr_inicio
FROM snap s
LEFT JOIN "Clickup".cup_data_hist h
  ON h.data_snapshot = s.snap
  AND h.status IN ('ativo','onboarding','triagem') AND h.valorr > 0
WHERE s.snap IS NOT NULL
GROUP BY s.mes ORDER BY s.mes;
```

- [ ] **Step 3: Escrever o arquivo com as duas queries**

```typescript
// server/routes/ceoDashboard.movimentoReceita.ts
// Fonte única do bloco "Movimento de Receita" do CEO Dashboard.
// Reusa 5 linhas de computarBpReceitas (vendas_mrr, churn_mes, vendas_pontual,
// pontual_churn, pontual_estoque_ini) e adiciona só 2 queries: cross-sell por mês
// e MRR-início por mês. A régua das 8 métricas (inclusive NRR = erosão) vive na
// função pura montarMovimentoReceita — testável sem IO.
import { sql } from "drizzle-orm";
import type { BpLinha } from "./ceoDashboard.helpers";

export interface MovimentoQueries {
  crossMrrPorMes: Record<number, number>;
  crossPontPorMes: Record<number, number>;
  mrrInicioPorMes: Record<number, number>;
}

// Cross-sell por mês (régua de buildVendasMrrQuery: source=PARTNER + cliente
// pré-existente) e MRR-início por mês (1º snapshot do mês). Ano fixo 2026.
export async function carregarMovimentoQueries(db: any): Promise<MovimentoQueries> {
  const crossMrrPorMes: Record<number, number> = {};
  const crossPontPorMes: Record<number, number> = {};
  const mrrInicioPorMes: Record<number, number> = {};

  const crossRes: any = await db.execute(sql`
    WITH cliente_inicio AS (
      SELECT REGEXP_REPLACE(COALESCE(c.cnpj,''),'[^0-9]','','g') AS cnpj_norm,
             MIN(ct.data_inicio)::date AS primeiro_contrato
      FROM "Clickup".cup_clientes c
      JOIN "Clickup".cup_contratos ct ON ct.id_task = c.task_id
      WHERE COALESCE(c.cnpj,'') <> '' GROUP BY 1
    ),
    deals AS (
      SELECT EXTRACT(MONTH FROM d.data_fechamento)::int AS mes,
        COALESCE(d.valor_recorrente::numeric,0) AS rec,
        COALESCE(d.valor_pontual::numeric,0) AS pont,
        (d.source='PARTNER' AND ci.primeiro_contrato IS NOT NULL
          AND ci.primeiro_contrato < date_trunc('month', d.data_fechamento)::date) AS is_cross
      FROM "Bitrix".crm_deal d
      LEFT JOIN cliente_inicio ci ON REGEXP_REPLACE(COALESCE(d.cnpj,''),'[^0-9]','','g') = ci.cnpj_norm
      WHERE d.stage_name='Negócio Ganho' AND d.data_fechamento IS NOT NULL
        AND EXTRACT(YEAR FROM d.data_fechamento)=2026
    )
    SELECT mes,
      COALESCE(SUM(rec) FILTER (WHERE is_cross),0) AS cross_mrr,
      COALESCE(SUM(pont) FILTER (WHERE is_cross),0) AS cross_pont
    FROM deals GROUP BY mes`);
  for (const r of crossRes.rows ?? []) {
    const mes = Number(r.mes);
    if (!mes) continue;
    crossMrrPorMes[mes] = Number(r.cross_mrr) || 0;
    crossPontPorMes[mes] = Number(r.cross_pont) || 0;
  }

  const mrrRes: any = await db.execute(sql`
    WITH meses AS (SELECT generate_series(1,12) AS mes),
    snap AS (
      SELECT m.mes,
        (SELECT MIN(data_snapshot) FROM "Clickup".cup_data_hist h
         WHERE date_trunc('month', h.data_snapshot) = make_date(2026, m.mes, 1)) AS snap
      FROM meses m
    )
    SELECT s.mes, COALESCE(SUM(h.valorr::numeric),0) AS mrr_inicio
    FROM snap s
    LEFT JOIN "Clickup".cup_data_hist h
      ON h.data_snapshot = s.snap
      AND h.status IN ('ativo','onboarding','triagem') AND h.valorr > 0
    WHERE s.snap IS NOT NULL
    GROUP BY s.mes`);
  for (const r of mrrRes.rows ?? []) {
    const mes = Number(r.mes);
    if (mes) mrrInicioPorMes[mes] = Number(r.mrr_inicio) || 0;
  }

  return { crossMrrPorMes, crossPontPorMes, mrrInicioPorMes };
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run check`
Expected: sem erros novos referentes a `ceoDashboard.movimentoReceita.ts`.

- [ ] **Step 5: Commit**

```bash
git add server/routes/ceoDashboard.movimentoReceita.ts
git commit -m "feat(ceo-dashboard): queries de cross-sell e MRR-início por mês (movimento de receita)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Helper puro — as 8 linhas + régua do NRR

**Files:**
- Modify: `server/routes/ceoDashboard.movimentoReceita.ts` (adicionar `montarMovimentoReceita`)
- Test: `server/routes/ceoDashboard.movimentoReceita.test.ts` (criar)

**Interfaces:**
- Consumes: `MovimentoQueries` (Task 1); `BpLinha` de `ceoDashboard.helpers`.
- Produces:
  ```typescript
  interface MovimentoIngredientes {
    mrrInicioPorMes: Record<number, number>;
    estoquePontIniPorMes: Record<number, number>;
    crossMrrPorMes: Record<number, number>;
    crossPontPorMes: Record<number, number>;
    churnMrrPorMes: Record<number, number>;       // positivo
    churnPontualPorMes: Record<number, number>;   // positivo
  }
  interface MovimentoReceita {
    linhas: {
      vendaMrr: BpLinha; churnMrr: BpLinha; crossMrr: BpLinha; nrr: BpLinha;
      vendaPontual: BpLinha; churnPontual: BpLinha; crossPontual: BpLinha; nrrPontual: BpLinha;
    };
    ingredientes: MovimentoIngredientes;
  }
  interface MovimentoInput {
    vendasMrr?: BpLinha; churnMes?: BpLinha; vendasPontual?: BpLinha;
    pontualChurn?: BpLinha; pontualEstoqueIni?: BpLinha;
    queries: MovimentoQueries; mesNum: number;
  }
  function montarMovimentoReceita(input: MovimentoInput): MovimentoReceita
  ```

- [ ] **Step 1: Escrever os testes**

```typescript
// server/routes/ceoDashboard.movimentoReceita.test.ts
import { describe, it, expect } from "vitest";
import { montarMovimentoReceita } from "./ceoDashboard.movimentoReceita";
import type { BpLinha } from "./ceoDashboard.helpers";

// Constrói uma BpLinha com meses 1..n a partir de pares [orcado, realizado].
function linha(metrica: string, pares: Array<[number, number | null]>): BpLinha {
  return {
    metrica,
    meses: pares.map(([orcado, realizado], i) => ({
      mes: i + 1, orcado, realizado,
      atingimento: realizado != null && orcado ? realizado / orcado : null,
    })),
  };
}

describe("montarMovimentoReceita", () => {
  const base = {
    vendasMrr: linha("vendas_mrr", [[100, 120], [100, 90]]),
    churnMes: linha("churn_mes", [[0, 10], [0, 20]]),          // positivo
    vendasPontual: linha("vendas_pontual", [[50, 60], [50, 40]]),
    pontualChurn: linha("pontual_churn", [[0, -5], [0, -8]]),   // negativo
    pontualEstoqueIni: linha("pontual_estoque_ini", [[0, 200], [0, 250]]),
    queries: {
      crossMrrPorMes: { 1: 4, 2: 6 },
      crossPontPorMes: { 1: 1, 2: 2 },
      mrrInicioPorMes: { 1: 1000, 2: 2000 },
    },
    mesNum: 2,
  };

  it("NRR recorrente = (churn − cross) / mrr_início × 100", () => {
    const r = montarMovimentoReceita(base);
    // mês 1: (10 − 4) / 1000 × 100 = 0.6 ; mês 2: (20 − 6) / 2000 × 100 = 0.7
    expect(r.linhas.nrr.meses[0].realizado).toBeCloseTo(0.6, 5);
    expect(r.linhas.nrr.meses[1].realizado).toBeCloseTo(0.7, 5);
    expect(r.linhas.nrr.unidade).toBe("pct");
  });

  it("NRR pontual = (churn_pont_abs − cross_pont) / estoque_ini × 100", () => {
    const r = montarMovimentoReceita(base);
    // mês 1: (5 − 1) / 200 × 100 = 2 ; mês 2: (8 − 2) / 250 × 100 = 2.4
    expect(r.linhas.nrrPontual.meses[0].realizado).toBeCloseTo(2, 5);
    expect(r.linhas.nrrPontual.meses[1].realizado).toBeCloseTo(2.4, 5);
  });

  it("base ausente/zero → NRR null (não 0)", () => {
    const r = montarMovimentoReceita({
      ...base,
      queries: { ...base.queries, mrrInicioPorMes: { 1: 0 } },
    });
    expect(r.linhas.nrr.meses[0].realizado).toBeNull();
  });

  it("churn pontual é normalizado para positivo", () => {
    const r = montarMovimentoReceita(base);
    expect(r.linhas.churnPontual.meses[0].realizado).toBe(5);
    expect(r.ingredientes.churnPontualPorMes[1]).toBe(5);
  });

  it("venda/churn MRR e venda pontual reusam a linha do BP (com meta)", () => {
    const r = montarMovimentoReceita(base);
    expect(r.linhas.vendaMrr.meses[0].realizado).toBe(120);
    expect(r.linhas.vendaMrr.meses[0].orcado).toBe(100);
    expect(r.linhas.churnMrr.meses[1].realizado).toBe(20);
    expect(r.linhas.vendaPontual.meses[0].orcado).toBe(50);
  });

  it("cross-sell entra como série sem meta (orcado 0, atingimento null)", () => {
    const r = montarMovimentoReceita(base);
    expect(r.linhas.crossMrr.meses[0].realizado).toBe(4);
    expect(r.linhas.crossMrr.meses[0].orcado).toBe(0);
    expect(r.linhas.crossMrr.meses[0].atingimento).toBeNull();
  });

  it("séries respeitam 1..mesNum", () => {
    const r = montarMovimentoReceita(base);
    expect(r.linhas.crossMrr.meses).toHaveLength(2);
    expect(r.linhas.nrr.meses).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run server/routes/ceoDashboard.movimentoReceita.test.ts`
Expected: FAIL com "montarMovimentoReceita is not a function" (ou "not exported").

- [ ] **Step 3: Implementar `montarMovimentoReceita`**

Adicionar ao fim de `server/routes/ceoDashboard.movimentoReceita.ts`:

```typescript
export interface MovimentoIngredientes {
  mrrInicioPorMes: Record<number, number>;
  estoquePontIniPorMes: Record<number, number>;
  crossMrrPorMes: Record<number, number>;
  crossPontPorMes: Record<number, number>;
  churnMrrPorMes: Record<number, number>;
  churnPontualPorMes: Record<number, number>;
}
export interface MovimentoReceita {
  linhas: {
    vendaMrr: BpLinha; churnMrr: BpLinha; crossMrr: BpLinha; nrr: BpLinha;
    vendaPontual: BpLinha; churnPontual: BpLinha; crossPontual: BpLinha; nrrPontual: BpLinha;
  };
  ingredientes: MovimentoIngredientes;
}
export interface MovimentoInput {
  vendasMrr?: BpLinha; churnMes?: BpLinha; vendasPontual?: BpLinha;
  pontualChurn?: BpLinha; pontualEstoqueIni?: BpLinha;
  queries: MovimentoQueries; mesNum: number;
}

// Extrai Record<mes, number> do realizado de uma BpLinha (aplica transform opcional).
function realizadoPorMes(linha: BpLinha | undefined, transform: (v: number) => number = (v) => v): Record<number, number> {
  const out: Record<number, number> = {};
  for (const m of linha?.meses ?? []) {
    if (m.realizado != null) out[m.mes] = transform(m.realizado);
  }
  return out;
}

// Constrói uma BpLinha de série própria (sem meta): orcado 0, atingimento null.
function linhaDeSerie(metrica: string, unidade: "brl" | "pct", seriePorMes: Record<number, number | null>, mesNum: number): BpLinha {
  const meses = [];
  for (let mes = 1; mes <= mesNum; mes++) {
    const v = seriePorMes[mes];
    meses.push({ mes, orcado: 0, realizado: v ?? null, atingimento: null });
  }
  return { metrica, unidade, meses };
}

// Erosão do NRR: (churn − cross) / base × 100. Base 0/ausente → null.
function serieNrr(churn: Record<number, number>, cross: Record<number, number>, base: Record<number, number>, mesNum: number): Record<number, number | null> {
  const out: Record<number, number | null> = {};
  for (let mes = 1; mes <= mesNum; mes++) {
    const b = base[mes];
    out[mes] = b && b > 0 ? ((churn[mes] ?? 0) - (cross[mes] ?? 0)) / b * 100 : null;
  }
  return out;
}

export function montarMovimentoReceita(input: MovimentoInput): MovimentoReceita {
  const { queries, mesNum } = input;
  const churnMrrPorMes = realizadoPorMes(input.churnMes);                    // já positivo
  const churnPontualPorMes = realizadoPorMes(input.pontualChurn, Math.abs);  // negativo → positivo
  const estoquePontIniPorMes = realizadoPorMes(input.pontualEstoqueIni);

  const nrrPorMes = serieNrr(churnMrrPorMes, queries.crossMrrPorMes, queries.mrrInicioPorMes, mesNum);
  const nrrPontualPorMes = serieNrr(churnPontualPorMes, queries.crossPontPorMes, estoquePontIniPorMes, mesNum);

  // Linha vazia como fallback quando o BP não trouxe a métrica.
  const vazia = (metrica: string): BpLinha => ({ metrica, meses: [] });

  return {
    linhas: {
      vendaMrr: input.vendasMrr ?? vazia("vendas_mrr"),
      churnMrr: input.churnMes ?? vazia("churn_mes"),
      crossMrr: linhaDeSerie("cross_mrr", "brl", queries.crossMrrPorMes, mesNum),
      nrr: linhaDeSerie("nrr", "pct", nrrPorMes, mesNum),
      vendaPontual: input.vendasPontual ?? vazia("vendas_pontual"),
      churnPontual: linhaDeSerie("churn_pontual", "brl", churnPontualPorMes, mesNum),
      crossPontual: linhaDeSerie("cross_pontual", "brl", queries.crossPontPorMes, mesNum),
      nrrPontual: linhaDeSerie("nrr_pontual", "pct", nrrPontualPorMes, mesNum),
    },
    ingredientes: {
      mrrInicioPorMes: queries.mrrInicioPorMes,
      estoquePontIniPorMes,
      crossMrrPorMes: queries.crossMrrPorMes,
      crossPontPorMes: queries.crossPontPorMes,
      churnMrrPorMes,
      churnPontualPorMes,
    },
  };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run server/routes/ceoDashboard.movimentoReceita.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Typecheck + commit**

```bash
npm run check
git add server/routes/ceoDashboard.movimentoReceita.ts server/routes/ceoDashboard.movimentoReceita.test.ts
git commit -m "feat(ceo-dashboard): régua das 8 métricas de movimento de receita (NRR = erosão)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Matriz — tipo "seção" + as 8 linhas

**Files:**
- Modify: `server/routes/ceoDashboard.matriz.helpers.ts`
- Test: `server/routes/ceoDashboard.matriz.helpers.test.ts` (estender)

**Interfaces:**
- Consumes: `MovimentoReceita["linhas"]` (Task 2).
- Produces: `CeoMatrizLinha` ganha `tipo?: "secao" | "dado"` (default = dado). `CeoMatrizSources` ganha `movimento?: MovimentoReceita["linhas"]`.

- [ ] **Step 1: Escrever os testes (estender o arquivo existente)**

Adicionar ao `server/routes/ceoDashboard.matriz.helpers.test.ts`:

```typescript
import { montarMatrizCeo } from "./ceoDashboard.matriz.helpers";
// (reusar os imports/fixtures já existentes no arquivo; BpLinha vem de ceoDashboard.helpers)

function linhaMov(metrica: string, unidade: "brl" | "pct", realizados: Array<number | null>) {
  return { metrica, unidade, meses: realizados.map((r, i) => ({ mes: i + 1, orcado: 0, realizado: r, atingimento: null })) };
}

describe("montarMatrizCeo — bloco movimento de receita", () => {
  const movimento = {
    vendaMrr: linhaMov("vendas_mrr", "brl", [120, 90]),
    churnMrr: linhaMov("churn_mes", "brl", [10, 20]),
    crossMrr: linhaMov("cross_mrr", "brl", [4, 6]),
    nrr: linhaMov("nrr", "pct", [0.6, 0.7]),
    vendaPontual: linhaMov("vendas_pontual", "brl", [60, 40]),
    churnPontual: linhaMov("churn_pontual", "brl", [5, 8]),
    crossPontual: linhaMov("cross_pontual", "brl", [1, 2]),
    nrrPontual: linhaMov("nrr_pontual", "pct", [2, 2.4]),
  };
  // sources mínimo — reusar helper de fixture do arquivo; aqui o essencial:
  const sourcesBase = {
    mesNum: 2, mesFechado: 2, bpLinhas: [], bpMetricas: [],
    receitaRecebida: { metrica: "receita_total", meses: [] },
    receitaCabecaCaixa: { metrica: "receita_cabeca", meses: [] },
    inadimplenciaSeriePorMes: {}, ltvFatSeriePorMes: {}, ltvDfcSeriePorMes: {}, enpsSeriePorMes: {},
    movimento,
  };

  it("adiciona 2 seções + 8 linhas de dado na ordem correta", () => {
    const res = montarMatrizCeo(sourcesBase as any);
    const keys = res.linhas.map((l) => l.key);
    const idx = keys.indexOf("mov_secao_mrr");
    expect(idx).toBeGreaterThan(-1);
    expect(keys.slice(idx, idx + 5)).toEqual(["mov_secao_mrr", "venda_mrr", "churn_mrr", "cross_mrr", "nrr"]);
    expect(keys.slice(idx + 5, idx + 10)).toEqual(["mov_secao_pontual", "venda_pontual", "churn_pontual", "cross_pontual", "nrr_pontual"]);
  });

  it("linha de seção tem tipo 'secao' e sem células", () => {
    const res = montarMatrizCeo(sourcesBase as any);
    const secao = res.linhas.find((l) => l.key === "mov_secao_mrr")!;
    expect(secao.tipo).toBe("secao");
    expect(secao.celulas).toHaveLength(0);
  });

  it("cross-sell e NRR entram semMeta; venda/churn MRR não", () => {
    const res = montarMatrizCeo(sourcesBase as any);
    expect(res.linhas.find((l) => l.key === "cross_mrr")!.semMeta).toBe(true);
    expect(res.linhas.find((l) => l.key === "nrr")!.semMeta).toBe(true);
    expect(res.linhas.find((l) => l.key === "venda_mrr")!.semMeta).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run server/routes/ceoDashboard.matriz.helpers.test.ts`
Expected: FAIL (nenhuma linha `mov_secao_mrr`; `movimento` ignorado).

- [ ] **Step 3: Estender os tipos e a montagem**

Em `server/routes/ceoDashboard.matriz.helpers.ts`:

3a. Adicionar `tipo` à interface `CeoMatrizLinha` (logo após `key: string;`):
```typescript
  tipo?: "secao" | "dado"; // "secao" = linha de cabeçalho de agrupamento (sem células)
```

3b. Importar o tipo do movimento no topo do arquivo:
```typescript
import type { MovimentoReceita } from "./ceoDashboard.movimentoReceita";
```

3c. Adicionar ao `CeoMatrizSources`:
```typescript
  movimento?: MovimentoReceita["linhas"]; // as 8 linhas do bloco de movimento de receita (opcional)
```

3d. Em `montarMatrizCeo`, adicionar um helper de seção e um de linha-de-série logo antes do `const linhas` (reusar `celulasDoBp` que já existe):
```typescript
  const secao = (key: string, label: string): CeoMatrizLinha => ({
    key, label, tipo: "secao", unidade: "brl", direcao: "neutro", semMeta: true, celulas: [],
  });
  const movLinha = (
    linha: BpLinha | undefined, key: string, label: string,
    direcao: CeoDirecao, unidade: CeoUnidade, semMeta: boolean, nota?: string
  ): CeoMatrizLinha => ({
    key, label, unidade, direcao, semMeta, nota, celulas: celulasDoBp(linha, mesNum),
  });
```

3e. No fim do array `linhas` (antes do `];`), depois de `receita_cabeca`, inserir o bloco (só se `s.movimento` existir):
```typescript
    ...(s.movimento ? [
      secao("mov_secao_mrr", "Movimento de Receita — Recorrente (MRR)"),
      movLinha(s.movimento.vendaMrr, "venda_mrr", "Venda MRR", "maior_melhor", "brl", false),
      movLinha(s.movimento.churnMrr, "churn_mrr", "Churn MRR", "menor_melhor", "brl", false),
      movLinha(s.movimento.crossMrr, "cross_mrr", "Venda de Cross-sell/Upsell MRR", "maior_melhor", "brl", true,
        "Deals de cross-sell/upsell recorrente (source PARTNER, cliente pré-existente). Sem meta no BP."),
      movLinha(s.movimento.nrr, "nrr", "NRR", "menor_melhor", "pct", true,
        "Erosão líquida da base recorrente = (Churn − Cross-sell) ÷ MRR do início do mês. Menor é melhor; sem meta no BP."),
      secao("mov_secao_pontual", "Movimento de Receita — Pontual"),
      movLinha(s.movimento.vendaPontual, "venda_pontual", "Venda Pontual", "maior_melhor", "brl", false),
      movLinha(s.movimento.churnPontual, "churn_pontual", "Churn Pontual", "menor_melhor", "brl", true,
        "Churn pontual por data de cancelamento (cup_contratos). Sem meta no BP."),
      movLinha(s.movimento.crossPontual, "cross_pontual", "Venda de Cross-sell/Upsell Pontual", "maior_melhor", "brl", true,
        "Parte pontual dos deals de cross-sell/upsell. Sem meta no BP."),
      movLinha(s.movimento.nrrPontual, "nrr_pontual", "NRR Pontual", "menor_melhor", "pct", true,
        "Erosão do estoque pontual = (Churn pontual − Cross-sell pontual) ÷ estoque pontual inicial. Menor é melhor; sem meta no BP."),
    ] : []),
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run server/routes/ceoDashboard.matriz.helpers.test.ts`
Expected: PASS (incluindo os testes já existentes do arquivo).

- [ ] **Step 5: Typecheck + commit**

```bash
npm run check
git add server/routes/ceoDashboard.matriz.helpers.ts server/routes/ceoDashboard.matriz.helpers.test.ts
git commit -m "feat(ceo-dashboard): 8 linhas + seções de movimento de receita na matriz

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Fiação IO — buildCeoMatriz alimenta o movimento

**Files:**
- Modify: `server/routes/ceoDashboard.matriz.ts`

**Interfaces:**
- Consumes: `carregarMovimentoQueries`, `montarMovimentoReceita` (Tasks 1-2); `montarMatrizCeo` com `movimento` (Task 3).

- [ ] **Step 1: Importar o helper**

Em `server/routes/ceoDashboard.matriz.ts`, adicionar aos imports:
```typescript
import { carregarMovimentoQueries, montarMovimentoReceita } from "./ceoDashboard.movimentoReceita";
```

- [ ] **Step 2: Carregar as queries e montar o movimento**

Dentro de `buildCeoMatriz`, depois do bloco de E-NPS (antes do `return montarMatrizCeo({`), adicionar:
```typescript
  // 5) Movimento de Receita (8 métricas): reusa linhas do BP + 2 queries próprias.
  const findLinha = (arr: any[], metrica: string) => (arr ?? []).find((l: any) => l.metrica === metrica);
  let movimento: ReturnType<typeof montarMovimentoReceita>["linhas"] | undefined;
  try {
    const queries = await carregarMovimentoQueries(db);
    movimento = montarMovimentoReceita({
      vendasMrr: findLinha(bp.metricasGerais, "vendas_mrr"),
      churnMes: findLinha(bp.metricasGerais, "churn_mes"),
      vendasPontual: findLinha(bp.metricasGerais, "vendas_pontual"),
      pontualChurn: findLinha(bp.pontual, "pontual_churn"),
      pontualEstoqueIni: findLinha(bp.pontual, "pontual_estoque_ini"),
      queries, mesNum,
    }).linhas;
  } catch (e) {
    console.error("[api] CEO matriz — falha ao montar movimento de receita:", e);
  }
```

- [ ] **Step 3: Passar `movimento` para `montarMatrizCeo`**

Adicionar a chave `movimento,` ao objeto passado a `montarMatrizCeo({ ... })` (junto de `cacPorContratoLinha`).

- [ ] **Step 4: Typecheck**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 5: Validar o endpoint (server local já rodando; senão pedir ao usuário)**

Run:
```bash
curl -s "http://localhost:3000/api/ceo-dashboard/matriz?ate=2026-07" -H "Cookie: $(cat /tmp/ceo_cookie 2>/dev/null)" | \
  npx --yes json 'linhas' 2>/dev/null | grep -o '"key":"[a-z_]*"' | tail -12
```
Expected: entre as keys aparecem `venda_mrr`, `churn_mrr`, `cross_mrr`, `nrr`, `venda_pontual`, `churn_pontual`, `cross_pontual`, `nrr_pontual` e as duas `mov_secao_*`.
(Se não houver cookie/sessão, anotar para validar no Step de verificação e2e — Task 8 — via browser.)

- [ ] **Step 6: Commit**

```bash
git add server/routes/ceoDashboard.matriz.ts
git commit -m "feat(ceo-dashboard): alimenta o bloco de movimento de receita na matriz (IO)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Front — renderizar seções e habilitar clique

**Files:**
- Modify: `client/src/components/ceo/CeoMatrizTabela.tsx`

**Interfaces:**
- Consumes: payload com `linhas[].tipo === "secao"` (Task 3).

- [ ] **Step 1: Adicionar `tipo` à interface do front**

Em `CeoMatrizLinha` (dentro de `CeoMatrizTabela.tsx`), adicionar após `key: string;`:
```typescript
  tipo?: "secao" | "dado";
```

- [ ] **Step 2: Renderizar a linha de seção**

No `<tbody>`, dentro do `.map((linha) => {`, logo no início do callback (antes de `const emBreve = ...`), inserir:
```typescript
              if (linha.tipo === "secao") {
                return (
                  <tr key={linha.key} className="border-b border-gray-200 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-800/40">
                    <th
                      scope="colgroup"
                      colSpan={data.meses.length + 1}
                      className={`${STICKY} !bg-gray-50 dark:!bg-zinc-800/40 px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-zinc-400`}
                    >
                      {linha.label}
                    </th>
                  </tr>
                );
              }
```
(O `colSpan` cobre a tabela inteira; a 1ª coluna continua sticky. `!bg-*` vence o `bg-white` do `STICKY`.)

- [ ] **Step 3: Typecheck**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/ceo/CeoMatrizTabela.tsx
git commit -m "feat(ceo-dashboard): cabeçalhos de seção na matriz (movimento de receita)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Drills — 8 KPIs no endpoint /detalhe

**Files:**
- Modify: `server/routes/ceoDashboard.detalhe.ts`
- Modify: `server/routes/ceoDashboard.detalhe.helpers.ts` (estender `CeoDetalheResponse.unidade`)

**Interfaces:**
- Consumes: `carregarMovimentoQueries`, `montarMovimentoReceita` (Tasks 1-2); `getCrosssellDealsDetail` de `okr2026/metricsAdapter`.
- Produces: header + `grupos[]` + `evolucao[]` para cada uma das 8 keys.

- [ ] **Step 1: Estender o tipo de unidade do detalhe**

Em `server/routes/ceoDashboard.detalhe.helpers.ts`, na interface `CeoDetalheResponse`, trocar:
```typescript
  unidade: "brl" | "int";
```
por:
```typescript
  unidade: "brl" | "int" | "pct";
```

- [ ] **Step 2: Adicionar imports e as 8 keys aos válidos/títulos**

Em `server/routes/ceoDashboard.detalhe.ts`:

2a. Imports:
```typescript
import { carregarMovimentoQueries, montarMovimentoReceita, type MovimentoReceita } from "./ceoDashboard.movimentoReceita";
import { getCrosssellDealsDetail } from "../okr2026/metricsAdapter";
```

2b. Adicionar as keys a `TITULOS`:
```typescript
  venda_mrr: "Venda MRR", churn_mrr: "Churn MRR", cross_mrr: "Venda de Cross-sell/Upsell MRR", nrr: "NRR",
  venda_pontual: "Venda Pontual", churn_pontual: "Churn Pontual", cross_pontual: "Venda de Cross-sell/Upsell Pontual", nrr_pontual: "NRR Pontual",
```

2c. Adicionar as 8 keys ao array `KPIS_VALIDOS` no `registerCeoDashboardDetalheRoutes`.

- [ ] **Step 3: Helpers de itens (deals ganhos por tipo, churn por mês)**

Adicionar perto de `dealsGanhosDoMes` em `ceoDashboard.detalhe.ts`:

```typescript
// Deals ganhos do mês com valor recorrente OU pontual (conforme campo), p/ os drills de venda.
async function dealsVendaDoMes(
  db: any, mesNum: number, campo: "valor_recorrente" | "valor_pontual"
): Promise<Array<{ nome: string; detalhe: string; data: string | null; valor: number }>> {
  const col = campo === "valor_recorrente" ? sql`d.valor_recorrente` : sql`d.valor_pontual`;
  const r: any = await db.execute(sql`
    SELECT COALESCE(NULLIF(d.company_name,''), d.title, '(sem nome)') AS nome,
           COALESCE(NULLIF(TRIM(c.nome), ''), d.assigned_by_name, '') AS closer,
           d.data_fechamento::date::text AS data,
           COALESCE(${col}::numeric, 0) AS valor
    FROM "Bitrix".crm_deal d
    LEFT JOIN "Bitrix".crm_closers c
      ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
    WHERE d.stage_name='Negócio Ganho'
      AND EXTRACT(YEAR FROM d.data_fechamento)=2026 AND EXTRACT(MONTH FROM d.data_fechamento)=${mesNum}
      AND COALESCE(${col}::numeric,0) > 0
    ORDER BY COALESCE(${col}::numeric,0) DESC`);
  return (r.rows ?? []).map((x: any) => ({
    nome: String(x.nome), detalhe: x.closer ? `closer ${x.closer}` : "",
    data: x.data ? String(x.data) : null, valor: Number(x.valor) || 0,
  }));
}

// Contratos recorrentes que deram churn no mês (mesma régua de churn_mes: vw_cup_churn_ajustado).
async function churnMrrDoMes(db: any, mesNum: number): Promise<Array<{ nome: string; detalhe: string; data: string | null; valor: number }>> {
  const r: any = await db.execute(sql`
    SELECT COALESCE(NULLIF(nome,''), '(sem nome)') AS nome,
           COALESCE(responsavel_geral, '') AS resp,
           data_solicitacao_encerramento::date::text AS data,
           valor_r::numeric AS valor
    FROM cortex_core.vw_cup_churn_ajustado
    WHERE valor_r > 0 AND data_solicitacao_encerramento IS NOT NULL
      AND EXTRACT(YEAR FROM data_solicitacao_encerramento)=2026
      AND EXTRACT(MONTH FROM data_solicitacao_encerramento)=${mesNum}
    ORDER BY valor_r::numeric DESC`);
  return (r.rows ?? []).map((x: any) => ({
    nome: String(x.nome), detalhe: x.resp ? String(x.resp) : "",
    data: x.data ? String(x.data) : null, valor: Number(x.valor) || 0,
  }));
}

// Contratos pontuais cancelados no mês por data de cancelamento (régua de pontual_churn).
async function churnPontualDoMes(db: any, mesNum: number): Promise<Array<{ nome: string; detalhe: string; data: string | null; valor: number }>> {
  const r: any = await db.execute(sql`
    SELECT COALESCE(NULLIF(cl.nome,''), '(sem nome)') AS nome,
           COALESCE(co.status,'') AS status,
           co.data_solicitacao_encerramento::date::text AS data,
           co.valorp::numeric AS valor
    FROM "Clickup".cup_contratos co
    LEFT JOIN "Clickup".cup_clientes cl ON co.id_task = cl.task_id
    WHERE co.valorp::numeric > 0
      AND LOWER(TRIM(co.status)) IN ('cancelado/inativo','em cancelamento','não usar')
      AND EXTRACT(YEAR FROM co.data_solicitacao_encerramento)=2026
      AND EXTRACT(MONTH FROM co.data_solicitacao_encerramento)=${mesNum}
    ORDER BY co.valorp::numeric DESC`);
  return (r.rows ?? []).map((x: any) => ({
    nome: String(x.nome), detalhe: x.status ? String(x.status) : "",
    data: x.data ? String(x.data) : null, valor: Number(x.valor) || 0,
  }));
}

// Converte itens simples num grupo do drawer (total = soma, cap LIMITE_ITENS).
function itensParaGrupo(titulo: string, itens: Array<{ nome: string; detalhe: string; data: string | null; valor: number }>, totalAutoritativo: number): CeoGrupo {
  const cap = itens.slice(0, LIMITE_ITENS);
  const omit = itens.slice(LIMITE_ITENS);
  return {
    titulo, formato: "brl", total: totalAutoritativo, aberto: true,
    itens: cap.map((it) => ({ nome: it.nome, detalhe: it.detalhe, data: it.data, valor: it.valor })),
    itensOmitidos: omit.length ? { qtd: omit.length, valor: omit.reduce((s, i) => s + i.valor, 0) } : undefined,
  };
}
```

- [ ] **Step 4: Montar o movimento uma vez e ramificar os 8 KPIs**

Em `buildCeoDetalhe`, depois de obter `bp` e `mesNum` (perto do topo), calcular o movimento sob demanda quando a key for de movimento:

```typescript
  const MOV_KEYS = ["venda_mrr","churn_mrr","cross_mrr","nrr","venda_pontual","churn_pontual","cross_pontual","nrr_pontual"];
```

Depois adicionar, ANTES do `else { throw new Error("kpi inválido"); }`, os branches (usam o helper compartilhado p/ header/evolução e as queries de item):

```typescript
  } else if (MOV_KEYS.includes(kpi)) {
    const findLinha = (arr: any[], metrica: string) => (arr ?? []).find((l: any) => l.metrica === metrica);
    const queries = await carregarMovimentoQueries(db);
    const mov = montarMovimentoReceita({
      vendasMrr: findLinha(bp.metricasGerais, "vendas_mrr"),
      churnMes: findLinha(bp.metricasGerais, "churn_mes"),
      vendasPontual: findLinha(bp.metricasGerais, "vendas_pontual"),
      pontualChurn: findLinha(bp.pontual, "pontual_churn"),
      pontualEstoqueIni: findLinha(bp.pontual, "pontual_estoque_ini"),
      queries, mesNum,
    });
    const linhaKpi: Record<string, BpLinhaLike> = {
      venda_mrr: mov.linhas.vendaMrr, churn_mrr: mov.linhas.churnMrr, cross_mrr: mov.linhas.crossMrr, nrr: mov.linhas.nrr,
      venda_pontual: mov.linhas.vendaPontual, churn_pontual: mov.linhas.churnPontual, cross_pontual: mov.linhas.crossPontual, nrr_pontual: mov.linhas.nrrPontual,
    };
    const linha = linhaKpi[kpi];
    const mesData = linha.meses.find((m) => m.mes === mesNum);
    base.realizado = mesData?.realizado ?? null;
    base.orcado = mesData?.orcado || null;
    const ehPct = kpi === "nrr" || kpi === "nrr_pontual";
    // unidade do detalhe (afeta o header/gráfico); o cast é seguro pois estendemos o tipo.
    (base as any).unidade = ehPct ? "pct" : "brl";

    const ini = `2026-${String(mesNum).padStart(2, "0")}-01`;
    const fim = mesNum >= 12 ? "2026-12-31" : `2026-${String(mesNum).padStart(2, "0")}-${new Date(2026, mesNum, 0).getDate()}`;

    if (kpi === "venda_mrr") {
      grupos = [itensParaGrupo("Deals recorrentes ganhos no mês", await dealsVendaDoMes(db, mesNum, "valor_recorrente"), base.realizado ?? 0)];
    } else if (kpi === "venda_pontual") {
      grupos = [itensParaGrupo("Deals pontuais ganhos no mês", await dealsVendaDoMes(db, mesNum, "valor_pontual"), base.realizado ?? 0)];
    } else if (kpi === "churn_mrr") {
      grupos = [itensParaGrupo("Contratos recorrentes cancelados no mês", await churnMrrDoMes(db, mesNum), base.realizado ?? 0)];
    } else if (kpi === "churn_pontual") {
      grupos = [itensParaGrupo("Contratos pontuais cancelados no mês", await churnPontualDoMes(db, mesNum), base.realizado ?? 0)];
    } else if (kpi === "cross_mrr" || kpi === "cross_pontual") {
      const det = await getCrosssellDealsDetail(ini, fim);
      const itens = det.items
        .map((d) => ({ nome: d.cliente, detalhe: d.closer ? `closer ${d.closer}` : "", data: d.data_fechamento, valor: kpi === "cross_mrr" ? d.recorrente : d.pontual }))
        .filter((it) => it.valor > 0);
      grupos = [itensParaGrupo("Deals de cross-sell/upsell no mês", itens, base.realizado ?? 0)];
    } else { // nrr | nrr_pontual — decomposição da erosão
      const ing = mov.ingredientes;
      const base_ = ehPct && kpi === "nrr" ? ing.mrrInicioPorMes[mesNum] ?? 0 : ing.estoquePontIniPorMes[mesNum] ?? 0;
      const churn_ = kpi === "nrr" ? ing.churnMrrPorMes[mesNum] ?? 0 : ing.churnPontualPorMes[mesNum] ?? 0;
      const cross_ = kpi === "nrr" ? ing.crossMrrPorMes[mesNum] ?? 0 : ing.crossPontPorMes[mesNum] ?? 0;
      grupos = [
        { titulo: kpi === "nrr" ? "MRR do início do mês (base)" : "Estoque pontual inicial (base)", total: base_, formato: "brl", itens: [], aberto: true },
        { titulo: "Churn no mês", total: churn_, formato: "brl", sinal: "-", itens: [] },
        { titulo: "Cross-sell/Upsell no mês", total: cross_, formato: "brl", sinal: "+", itens: [] },
      ];
      const pct = base_ > 0 ? ((churn_ - cross_) / base_ * 100) : null;
      nota = `NRR (erosão) = (Churn ${formatBRL(churn_)} − Cross-sell ${formatBRL(cross_)}) ÷ base ${formatBRL(base_)} = ${pct == null ? "—" : pct.toFixed(1) + "%"}. Menor é melhor.`;
    }
```

Onde `BpLinhaLike` = o tipo das linhas (`BpLinha`). Adicionar `import type { BpLinha } from "./ceoDashboard.helpers";` se ainda não houver, e usar `type BpLinhaLike = BpLinha;` (ou usar `BpLinha` direto).

- [ ] **Step 5: Série de evolução para as 8 keys**

No trecho de `evolucao` (perto do fim de `buildCeoDetalhe`), adicionar antes do `if (evolucao && evolucao.length < 2)`:
```typescript
  else if (MOV_KEYS.includes(kpi)) {
    // Reusa a mesma linha do movimento (recalcular é barato; queries já rodaram acima só no branch).
    // Para evitar recomputar, guardamos a linha usada no branch numa variável de escopo.
    // (ver Step 4: manter `linhaMovParaEvolucao` setada no branch)
  }
```
Para não recomputar, no Step 4 declarar antes dos branches `let linhaMovParaEvolucao: BpLinha | undefined;` no escopo de `buildCeoDetalhe`, setá-la com `linha` dentro do branch `MOV_KEYS`, e aqui usar:
```typescript
  else if (linhaMovParaEvolucao) {
    evolucao = serieEvolucao(linhaMovParaEvolucao, bp.mesFechado);
  }
```

- [ ] **Step 6: Typecheck**

Run: `npm run check`
Expected: sem erros (o cast `(base as any).unidade` só é necessário se o `base` foi tipado com união estreita; o tipo `CeoDetalheResponse.unidade` agora aceita "pct").

- [ ] **Step 7: Validar reconciliação no banco (opcional, rápido)**

Para 1 mês fechado (ex.: junho, mês 6): rodar `dealsVendaDoMes`/`churnMrrDoMes` equivalentes em psql e conferir que a soma se aproxima do realizado de `vendas_mrr`/`churn_mes` do BP (o total do grupo usa o valor do BP como autoritativo; a lista é ilustrativa).

- [ ] **Step 8: Commit**

```bash
git add server/routes/ceoDashboard.detalhe.ts server/routes/ceoDashboard.detalhe.helpers.ts
git commit -m "feat(ceo-dashboard): drills por mês das 8 métricas de movimento de receita

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Front — unidade pct no drawer

**Files:**
- Modify: `client/src/components/ceo/CeoKpiDetail.tsx`

**Interfaces:**
- Consumes: payload de detalhe com `unidade: "pct"` (Task 6).

- [ ] **Step 1: Estender o tipo de unidade no front**

Em `CeoKpiDetail.tsx`, na interface `DetalheResponse`, trocar:
```typescript
  kpi: string; titulo: string; mes: number; unidade: "brl" | "int";
```
por:
```typescript
  kpi: string; titulo: string; mes: number; unidade: "brl" | "int" | "pct";
```
E na assinatura do sub-componente `MedianaVsMedia`, trocar `unidade: "brl" | "int";` por `unidade: "brl" | "int" | "pct";` (só usado por LTV, mas mantém o tipo consistente). `formatValor` e `CeoEvolucaoChart` já aceitam `pct` — nada mais muda.

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/ceo/CeoKpiDetail.tsx
git commit -m "feat(ceo-dashboard): drawer aceita unidade pct (NRR)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Verificação end-to-end

**Files:** nenhum (validação).

- [ ] **Step 1: Rodar toda a suíte de testes do CEO Dashboard**

Run: `npx vitest run server/routes/ceoDashboard.movimentoReceita.test.ts server/routes/ceoDashboard.matriz.helpers.test.ts`
Expected: PASS.

- [ ] **Step 2: Typecheck completo**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 3: Subir o dev server e conferir no browser**

Reiniciar `npm run dev` (o usuário roda; subagentes NÃO). Abrir `/ceo-dashboard`:
- As duas seções ("Movimento de Receita — Recorrente (MRR)" e "— Pontual") aparecem no fim da tabela, com 4 linhas cada.
- Venda/Churn MRR e Venda Pontual pintam por meta; Cross-sell/NRR ficam neutros.
- NRR e NRR Pontual exibem `%` (1 casa).
- Coluna do mês corrente tem `*`.
- Clicar em cada uma das 8 células abre o drawer: header correto (R$ ou %), grupos com itens (venda/churn/cross) ou decomposição (NRR), e aba Evolução quando houver ≥2 meses.

- [ ] **Step 4: Conferir dark e light mode**

Alternar tema: cabeçalhos de seção, linhas e drawer legíveis nos dois modos.

- [ ] **Step 5: Reconciliação visual**

Para um mês fechado, o header do drawer de Venda MRR = a célula clicada; a soma dos itens de cross-sell = a célula de Cross-sell MRR (ou mostra "+N itens").

- [ ] **Step 6: Merge da branch**

Após validação do usuário, seguir `superpowers:finishing-a-development-branch` (merge para main — Ichino autoriza direto na main). Atualizar Obsidian + chamado (status `review`) conforme o workflow pós-conclusão.

---

## Self-Review (feita ao escrever o plano)

- **Cobertura da spec:** as 8 métricas (Tasks 2-4/6), seções (Tasks 3/5), drill por mês (Task 6), NRR erosão + NRR pontual sobre estoque inicial (Task 2), helper compartilhado (Tasks 1-2), unidade pct (Tasks 6-7). ✓
- **Sem placeholders:** todo passo de código tem o código real. ✓
- **Consistência de tipos:** `BpLinha` (meses `{mes,orcado,realizado,atingimento}`) usado em toda parte; `carregarMovimentoQueries`/`montarMovimentoReceita` com assinaturas fixas repetidas nos consumidores; keys idênticas nas Tasks 3/6/8. ✓
- **Risco anotado:** churn negativo normalizado (Task 2); total do grupo = valor do BP autoritativo (Task 6); mês parcial `*` (herdado, sem mudança).
