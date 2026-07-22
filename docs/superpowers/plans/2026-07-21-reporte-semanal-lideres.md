# Reporte Semanal dos Líderes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir `/reports/semanal` por uma tabela de 12 semanas com as métricas do Resumo dos Líderes, e unificar a régua de classificação de venda entre essa tela e a mensagem diária.

**Architecture:** Uma única função `vendasPorChannel(db, inicio, fim)` classifica venda nova vs. cross-sell pela marcação `crm_deal.channel`, e alimenta tanto o mês (mensagem diária) quanto a semana (tela). O cálculo de janelas e a derivação de métricas ficam em módulos puros, testáveis sem banco; as queries de série têm queries-gêmeas para o drill.

**Tech Stack:** TypeScript, Express, Drizzle (`db.execute(sql\`\`)`), Vitest, React + React Query, Tailwind, shadcn/ui (`Sheet`).

**Spec:** `docs/superpowers/specs/2026-07-21-reporte-semanal-lideres-design.md`

## Global Constraints

- Fuso: **America/Sao_Paulo** em toda data derivada de `NOW()`.
- Semana: **segunda→domingo**. `date_trunc('week')` do Postgres já começa na segunda.
- Régua de expansão: `TRIM(COALESCE(channel,'')) = 'Expansão de Conta'`. Venda nova é o complemento exato dessa condição — nunca uma lista de canais.
- `channel = 'Reativação'` conta como **venda nova**, não como expansão.
- **Sem guard de CNPJ** em nenhuma das duas classificações.
- Snapshots: sempre `MAX(data_snapshot) <= <data>`, nunca igualdade com o dia exato — há semanas com 6 de 7 dias.
- Motivos operacionais excluídos do "ajustado": `'Erro na Venda'`, `'Não começou'`, `'Inadimplente 1º Mês'`.
- Dark/light obrigatório: toda cor com variante `dark:`.
- Commits em Conventional Commits, com `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`.
- Rodar testes com `npx vitest run <caminho>`; typecheck com `npm run check`.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `shared/crm-channel.ts` | **Criar.** A constante `CHANNEL_EXPANSAO`, um lugar só |
| `server/crm/expansao.ts` | **Criar.** `vendasPorChannel` (série) + `dealsPorChannel` (drill) — a régua única |
| `server/crm/expansao.test.ts` | **Criar.** Mapeamento e tolerância a falha |
| `server/reportsSemanal/semanas.ts` | **Criar.** PURO — janelas seg→dom, flag `parcial` |
| `server/reportsSemanal/semanas.test.ts` | **Criar.** Virada de mês/ano, semana parcial |
| `server/reportsSemanal/derivar.ts` | **Criar.** PURO — `derivarSemana()` |
| `server/reportsSemanal/derivar.test.ts` | **Criar.** Net Churn, percentuais, base zero |
| `server/reportsSemanal/queries.ts` | **Criar.** Queries de série por `(inicio, fim)` |
| `server/routes/reportsSemanal.ts` | **Reescrever.** Rota da série + rota do drill |
| `server/routes/reportsSemanal.helpers.ts` | **Remover.** Lógica de data migra para `semanas.ts` |
| `server/routes/reportsSemanal.helpers.test.ts` | **Remover.** Substituído por `semanas.test.ts` |
| `server/routes/ceoDashboard.movimentoReceita.ts` | **Modificar.** Importar `CHANNEL_EXPANSAO` de `shared/` |
| `server/services/resumoLideres.ts` | **Modificar.** Régua `channel`; remover override manual |
| `server/services/resumoLideres.test.ts` | **Modificar.** Atualizar; remover suíte de override |
| `client/src/pages/RelatorioSemanal.tsx` | **Reescrever.** Página |
| `client/src/pages/relatorio-semanal/types.ts` | **Reescrever.** Tipos da tabela |
| `client/src/pages/relatorio-semanal/useRelatorioSemanal.ts` | **Reescrever.** Hooks de série e drill |
| `client/src/pages/relatorio-semanal/TabelaSemanal.tsx` | **Criar.** Tabela, seções, coluna Δ |
| `client/src/pages/relatorio-semanal/DrawerDetalhe.tsx` | **Criar.** Drill lateral |

---

### Task 1: Régua única de expansão (`shared/crm-channel.ts` + `server/crm/expansao.ts`)

**Files:**
- Create: `shared/crm-channel.ts`
- Create: `server/crm/expansao.ts`
- Test: `server/crm/expansao.test.ts`
- Modify: `server/routes/ceoDashboard.movimentoReceita.ts:20`

**Interfaces:**
- Produces: `CHANNEL_EXPANSAO: string`; `vendasPorChannel(db, inicio: string, fim: string): Promise<VendasPorChannel>` com `VendasPorChannel = { novoMrr: number; novoPontual: number; crossMrr: number; crossPontual: number; erro?: boolean }`; `dealsPorChannel(db, inicio, fim, tipo: "novo" | "cross"): Promise<DealExpansao[]>` com `DealExpansao = { cliente: string; closer: string; canal: string; data: string | null; recorrente: number; pontual: number }`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `server/crm/expansao.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { vendasPorChannel, dealsPorChannel } from "./expansao";
import { CHANNEL_EXPANSAO } from "../../shared/crm-channel";

function dbComLinhas(rows: any[]) {
  return { execute: vi.fn().mockResolvedValue({ rows }) } as any;
}

describe("CHANNEL_EXPANSAO", () => {
  it("é exatamente a marcação usada no CRM", () => {
    expect(CHANNEL_EXPANSAO).toBe("Expansão de Conta");
  });
});

describe("vendasPorChannel", () => {
  it("mapeia as 4 colunas da query para números", async () => {
    const db = dbComLinhas([
      { novo_mrr: "180339.00", novo_pontual: "383267.00", cross_mrr: "9300.00", cross_pontual: "15300.00" },
    ]);
    const r = await vendasPorChannel(db, "2026-07-01", "2026-07-31");
    expect(r).toEqual({
      novoMrr: 180339,
      novoPontual: 383267,
      crossMrr: 9300,
      crossPontual: 15300,
    });
  });

  it("devolve zeros com erro:true quando a query falha, em vez de propagar", async () => {
    const db = { execute: vi.fn().mockRejectedValue(new Error("connection reset")) } as any;
    const r = await vendasPorChannel(db, "2026-07-01", "2026-07-31");
    expect(r).toEqual({ novoMrr: 0, novoPontual: 0, crossMrr: 0, crossPontual: 0, erro: true });
  });

  it("trata período sem nenhum deal ganho como zeros, sem erro", async () => {
    const db = dbComLinhas([{ novo_mrr: "0", novo_pontual: "0", cross_mrr: "0", cross_pontual: "0" }]);
    const r = await vendasPorChannel(db, "2026-07-20", "2026-07-26");
    expect(r).toEqual({ novoMrr: 0, novoPontual: 0, crossMrr: 0, crossPontual: 0 });
  });

  it("trata resultado sem linhas (rows vazio) como zeros, sem erro", async () => {
    const db = dbComLinhas([]);
    const r = await vendasPorChannel(db, "2026-07-20", "2026-07-26");
    expect(r).toEqual({ novoMrr: 0, novoPontual: 0, crossMrr: 0, crossPontual: 0 });
  });
});

describe("dealsPorChannel", () => {
  it("mapeia as linhas do drill", async () => {
    const db = dbComLinhas([
      { cliente: "ACME", closer: "Ana", canal: "Expansão de Conta", data: "2026-07-21", rec: "3000.00", pont: "2500.00" },
    ]);
    const r = await dealsPorChannel(db, "2026-07-20", "2026-07-26", "cross");
    expect(r).toEqual([
      { cliente: "ACME", closer: "Ana", canal: "Expansão de Conta", data: "2026-07-21", recorrente: 3000, pontual: 2500 },
    ]);
  });

  it("devolve lista vazia quando a query falha", async () => {
    const db = { execute: vi.fn().mockRejectedValue(new Error("boom")) } as any;
    expect(await dealsPorChannel(db, "2026-07-20", "2026-07-26", "novo")).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `npx vitest run server/crm/expansao.test.ts`
Expected: FAIL — `Cannot find module './expansao'`

- [ ] **Step 3: Criar a constante compartilhada**

Criar `shared/crm-channel.ts`:

```ts
// Marcação de expansão de conta feita pelo comercial no CRM. Régua única de
// cross-sell/upsell do Cortex — substituiu `source='PARTNER'` em 2026-07-21,
// que dava R$ 0 em todo mês (1 deal em toda a base desde que crm_deal virou
// espelho do Synapse) e fazia o NRR sair idêntico ao Churn %.
//
// Vive em shared/ porque server/crm/expansao.ts e
// server/routes/ceoDashboard.movimentoReceita.ts precisam da MESMA string:
// duas cópias divergindo é a falha silenciosa que essa constante existe para
// impedir.
export const CHANNEL_EXPANSAO = "Expansão de Conta";
```

- [ ] **Step 4: Implementar o módulo da régua**

Criar `server/crm/expansao.ts`:

```ts
// Régua única de classificação de venda do Cortex.
//
// Cross-sell = deal ganho marcado como expansão de conta no CRM.
// Venda nova  = *todo* o resto dos deals ganhos — o complemento exato da
// condição acima, nunca uma lista de canais. É isso que garante que as duas
// linhas sejam mutuamente exclusivas e somem o total ganho no período.
//
// Substituiu duas réguas incompatíveis que conviviam na mensagem dos líderes:
// venda nova por "CNPJ sem contrato anterior" e cross-sell por override manual
// mensal. Medido em 2026: 40 dos 106 deals de expansão (R$ 121k de R$ 235k de
// MRR) não têm CNPJ e eram contados NAS DUAS linhas.
//
// Sem guard de CNPJ: a régua confia na marcação. Exigir CNPJ descartaria 32 dos
// 106 deals e 51% do MRR de expansão. `channel='Reativação'` cai em venda nova
// — win-back de cliente perdido não é expansão de conta ativa.
import { sql } from "drizzle-orm";
import { CHANNEL_EXPANSAO } from "../../shared/crm-channel";

export interface VendasPorChannel {
  novoMrr: number;
  novoPontual: number;
  crossMrr: number;
  crossPontual: number;
  /** true quando a query falhou e os zeros NÃO significam "não houve venda". */
  erro?: boolean;
}

export interface DealExpansao {
  cliente: string;
  closer: string;
  canal: string;
  data: string | null;
  recorrente: number;
  pontual: number;
}

function num(v: unknown): number {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Venda nova e cross-sell de um intervalo de datas [inicio, fim] inclusive,
 * por `data_fechamento` do deal ganho. Serve o mês (mensagem diária dos
 * líderes) e a semana (tela /reports/semanal) — é a MESMA query, e é por isso
 * que as duas superfícies não podem divergir.
 *
 * Tolerante a falha: devolve zeros com `erro: true` em vez de lançar, porque a
 * mensagem diária não deve deixar de sair por causa do Bitrix. Quem consome
 * precisa exibir o aviso quando `erro` for true, senão uma falha de query vira
 * "mês sem vendas" em silêncio.
 */
export async function vendasPorChannel(
  db: any,
  inicio: string,
  fim: string,
): Promise<VendasPorChannel> {
  try {
    const r: any = await db.execute(sql`
      SELECT
        COALESCE(SUM(d.valor_recorrente::numeric) FILTER (WHERE TRIM(COALESCE(d.channel, '')) <> ${CHANNEL_EXPANSAO}), 0) AS novo_mrr,
        COALESCE(SUM(d.valor_pontual::numeric)    FILTER (WHERE TRIM(COALESCE(d.channel, '')) <> ${CHANNEL_EXPANSAO}), 0) AS novo_pontual,
        COALESCE(SUM(d.valor_recorrente::numeric) FILTER (WHERE TRIM(COALESCE(d.channel, '')) = ${CHANNEL_EXPANSAO}), 0) AS cross_mrr,
        COALESCE(SUM(d.valor_pontual::numeric)    FILTER (WHERE TRIM(COALESCE(d.channel, '')) = ${CHANNEL_EXPANSAO}), 0) AS cross_pontual
      FROM "Bitrix".crm_deal d
      WHERE d.stage_name = 'Negócio Ganho'
        AND d.data_fechamento IS NOT NULL
        AND d.data_fechamento >= ${inicio}::date
        AND d.data_fechamento <= ${fim}::date
    `);
    const row = (r.rows ?? [])[0] as any;
    return {
      novoMrr: num(row?.novo_mrr),
      novoPontual: num(row?.novo_pontual),
      crossMrr: num(row?.cross_mrr),
      crossPontual: num(row?.cross_pontual),
    };
  } catch (error: any) {
    console.error("[crm/expansao] vendasPorChannel falhou:", error?.message);
    return { novoMrr: 0, novoPontual: 0, crossMrr: 0, crossPontual: 0, erro: true };
  }
}

/**
 * Deals por trás de uma célula de venda nova ou cross-sell — a query GÊMEA de
 * `vendasPorChannel`. Mesmo filtro de stage, mesmo intervalo, mesma condição de
 * channel (só invertida por `tipo`).
 *
 * ⚠️ Se o filtro de uma mudar, a outra TEM que mudar junto, senão o drawer
 * deixa de somar a célula que ele detalha.
 */
export async function dealsPorChannel(
  db: any,
  inicio: string,
  fim: string,
  tipo: "novo" | "cross",
): Promise<DealExpansao[]> {
  const filtroChannel =
    tipo === "cross"
      ? sql`TRIM(COALESCE(d.channel, '')) = ${CHANNEL_EXPANSAO}`
      : sql`TRIM(COALESCE(d.channel, '')) <> ${CHANNEL_EXPANSAO}`;

  try {
    const r: any = await db.execute(sql`
      SELECT
        COALESCE(NULLIF(TRIM(cl.nome), ''), NULLIF(d.company_name, ''), d.title, 'Sem nome') AS cliente,
        COALESCE(NULLIF(TRIM(c.nome), ''), '') AS closer,
        COALESCE(NULLIF(TRIM(d.channel), ''), '—') AS canal,
        d.data_fechamento::date::text AS data,
        COALESCE(d.valor_recorrente::numeric, 0) AS rec,
        COALESCE(d.valor_pontual::numeric, 0) AS pont
      FROM "Bitrix".crm_deal d
      LEFT JOIN "Bitrix".crm_closers c
        ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
      LEFT JOIN "Clickup".cup_clientes cl
        ON REGEXP_REPLACE(COALESCE(cl.cnpj, ''), '[^0-9]', '', 'g') = REGEXP_REPLACE(COALESCE(d.cnpj, ''), '[^0-9]', '', 'g')
       AND COALESCE(d.cnpj, '') <> ''
      WHERE d.stage_name = 'Negócio Ganho'
        AND d.data_fechamento IS NOT NULL
        AND d.data_fechamento >= ${inicio}::date
        AND d.data_fechamento <= ${fim}::date
        AND ${filtroChannel}
      ORDER BY d.valor_recorrente::numeric DESC NULLS LAST, d.valor_pontual::numeric DESC NULLS LAST
    `);
    return ((r.rows ?? []) as any[]).map((x) => ({
      cliente: String(x.cliente),
      closer: String(x.closer || ""),
      canal: String(x.canal),
      data: x.data ? String(x.data) : null,
      recorrente: num(x.rec),
      pontual: num(x.pont),
    }));
  } catch (error: any) {
    console.error("[crm/expansao] dealsPorChannel falhou:", error?.message);
    return [];
  }
}
```

- [ ] **Step 5: Rodar o teste para ver passar**

Run: `npx vitest run server/crm/expansao.test.ts`
Expected: PASS — 7 testes

- [ ] **Step 6: Apontar o CEO Dashboard para a constante compartilhada**

Em `server/routes/ceoDashboard.movimentoReceita.ts`, remover a declaração local (linha 20 e o bloco de comentário logo acima, que dizia "Definida aqui … Ao unificá-las, mover isto para um módulo compartilhado") e importar do módulo novo. As queries do arquivo **não mudam**.

Trocar:

```ts
// Marcação de expansão de conta no CRM — régua única do cross-sell deste bloco.
// Definida aqui (e não em okr2026/metricsAdapter, que segue em `source='PARTNER'`) porque a
// troca foi decidida só para o CEO Dashboard: as demais telas de cross-sell continuam na régua
// antiga. Ao unificá-las, mover isto para um módulo compartilhado.
const CHANNEL_EXPANSAO = "Expansão de Conta";
```

por (no bloco de imports, junto aos demais):

```ts
import { CHANNEL_EXPANSAO } from "../../shared/crm-channel";
```

- [ ] **Step 7: Verificar que nada quebrou**

Run: `npm run check 2>&1 | grep -E "ceoDashboard|crm/expansao|crm-channel"`
Expected: nenhuma linha (sem erro de tipo nesses arquivos)

Run: `npx vitest run server/routes/ceoDashboard`
Expected: PASS — suítes do CEO Dashboard seguem verdes

- [ ] **Step 8: Commit**

```bash
git add shared/crm-channel.ts server/crm/expansao.ts server/crm/expansao.test.ts server/routes/ceoDashboard.movimentoReceita.ts
git commit -m "$(cat <<'EOF'
feat(crm): régua única de expansão de conta em server/crm/expansao

vendasPorChannel classifica venda nova vs cross-sell por crm_deal.channel
num intervalo de datas — serve o mês (mensagem dos líderes) e a semana
(tela /reports/semanal) com a MESMA query, então não podem divergir.

dealsPorChannel é a query gêmea para o drill, com o mesmo filtro.

CHANNEL_EXPANSAO sai de ceoDashboard.movimentoReceita.ts para shared/,
resolvendo o TODO que o próprio arquivo deixou escrito.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Janelas semanais (`server/reportsSemanal/semanas.ts`)

**Files:**
- Create: `server/reportsSemanal/semanas.ts`
- Test: `server/reportsSemanal/semanas.test.ts`

**Interfaces:**
- Produces: `Semana = { inicio: string; fim: string; label: string; parcial: boolean }`; `gerarSemanas(hoje: string, quantidade: number): Semana[]` (ordem cronológica, a última é a semana que contém `hoje`); `hojeSP(): string`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `server/reportsSemanal/semanas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { gerarSemanas } from "./semanas";

describe("gerarSemanas", () => {
  it("devolve a quantidade pedida, em ordem cronológica", () => {
    const s = gerarSemanas("2026-07-21", 12);
    expect(s).toHaveLength(12);
    expect(s[0].inicio < s[11].inicio).toBe(true);
  });

  it("toda janela vai de segunda a domingo", () => {
    for (const semana of gerarSemanas("2026-07-21", 12)) {
      expect(new Date(semana.inicio + "T00:00:00Z").getUTCDay()).toBe(1); // segunda
      expect(new Date(semana.fim + "T00:00:00Z").getUTCDay()).toBe(0); // domingo
    }
  });

  it("a última janela é a semana que contém hoje", () => {
    // 2026-07-21 é uma terça-feira
    const s = gerarSemanas("2026-07-21", 3);
    expect(s[2]).toMatchObject({ inicio: "2026-07-20", fim: "2026-07-26" });
  });

  it("marca só a semana corrente como parcial", () => {
    const s = gerarSemanas("2026-07-21", 3);
    expect(s.map((x) => x.parcial)).toEqual([false, false, true]);
  });

  it("domingo ainda é semana corrente e parcial (o dia não acabou)", () => {
    const s = gerarSemanas("2026-07-26", 2); // 2026-07-26 é domingo
    expect(s[1]).toMatchObject({ inicio: "2026-07-20", fim: "2026-07-26", parcial: true });
  });

  it("segunda-feira abre uma semana nova, e a anterior já conta como fechada", () => {
    const s = gerarSemanas("2026-07-27", 2); // segunda
    expect(s[1]).toMatchObject({ inicio: "2026-07-27", fim: "2026-08-02", parcial: true });
    expect(s[0]).toMatchObject({ inicio: "2026-07-20", fim: "2026-07-26", parcial: false });
  });

  it("atravessa virada de mês sem quebrar", () => {
    const s = gerarSemanas("2026-07-02", 2); // quinta
    expect(s[0]).toMatchObject({ inicio: "2026-06-22", fim: "2026-06-28" });
    expect(s[1]).toMatchObject({ inicio: "2026-06-29", fim: "2026-07-05" });
  });

  it("atravessa virada de ano sem quebrar", () => {
    const s = gerarSemanas("2027-01-07", 2); // quinta
    expect(s[0]).toMatchObject({ inicio: "2026-12-28", fim: "2027-01-03" });
    expect(s[1]).toMatchObject({ inicio: "2027-01-04", fim: "2027-01-10" });
  });

  it("label é dia/mês do início da semana", () => {
    expect(gerarSemanas("2026-07-21", 1)[0].label).toBe("20/07");
  });

  it("quantidade 1 devolve só a semana corrente", () => {
    expect(gerarSemanas("2026-07-21", 1)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `npx vitest run server/reportsSemanal/semanas.test.ts`
Expected: FAIL — `Cannot find module './semanas'`

- [ ] **Step 3: Implementar**

Criar `server/reportsSemanal/semanas.ts`:

```ts
// Cálculo puro das janelas semanais da tela /reports/semanal.
//
// Toda aritmética de data acontece em UTC sobre a data civil 'YYYY-MM-DD' para
// não sofrer com horário de verão nem com o timezone do servidor — o mesmo
// truque que reportsSemanal.helpers.ts usava antes de ser absorvido aqui.

export interface Semana {
  /** segunda-feira, 'YYYY-MM-DD' */
  inicio: string;
  /** domingo, 'YYYY-MM-DD' */
  fim: string;
  /** rótulo curto da coluna, 'DD/MM' do início */
  label: string;
  /** true na semana que contém "hoje": ainda está em curso, dados incompletos */
  parcial: boolean;
}

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

/** Data civil de hoje em America/Sao_Paulo, 'YYYY-MM-DD'. */
export function hojeSP(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/**
 * As `quantidade` últimas semanas (segunda→domingo) terminando na semana que
 * contém `hoje`, em ordem cronológica. A última é sempre a semana corrente e
 * vem com `parcial: true` — inclusive no domingo, porque o dia ainda não
 * terminou.
 */
export function gerarSemanas(hoje: string, quantidade: number): Semana[] {
  const hojeDt = parseISO(hoje);
  const dow = hojeDt.getUTCDay(); // 0=domingo .. 6=sábado
  const segundaCorrente = addDays(hojeDt, -((dow + 6) % 7));

  const semanas: Semana[] = [];
  for (let i = quantidade - 1; i >= 0; i--) {
    const inicio = addDays(segundaCorrente, -7 * i);
    const fim = addDays(inicio, 6);
    semanas.push({
      inicio: fmt(inicio),
      fim: fmt(fim),
      label: `${fmt(inicio).slice(8, 10)}/${fmt(inicio).slice(5, 7)}`,
      parcial: i === 0,
    });
  }
  return semanas;
}
```

- [ ] **Step 4: Rodar o teste para ver passar**

Run: `npx vitest run server/reportsSemanal/semanas.test.ts`
Expected: PASS — 10 testes

- [ ] **Step 5: Commit**

```bash
git add server/reportsSemanal/semanas.ts server/reportsSemanal/semanas.test.ts
git commit -m "$(cat <<'EOF'
feat(reporte-semanal): janelas semanais puras seg→dom

gerarSemanas devolve N janelas em ordem cronológica com flag `parcial` na
semana corrente. Aritmética em UTC sobre a data civil para não sofrer com
horário de verão nem timezone do servidor.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Derivação das métricas da semana (`server/reportsSemanal/derivar.ts`)

**Files:**
- Create: `server/reportsSemanal/derivar.ts`
- Test: `server/reportsSemanal/derivar.test.ts`

**Interfaces:**
- Consumes: `Semana` (Task 2), `VendasPorChannel` (Task 1).
- Produces: `EntradaSemana`, `SemanaMetricas`, `derivarSemana(entrada: EntradaSemana): SemanaMetricas`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `server/reportsSemanal/derivar.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { derivarSemana, type EntradaSemana } from "./derivar";

// Números reais da semana 22/06–28/06 apurados em produção, usados como base
// para as variações abaixo.
const ENTRADA: EntradaSemana = {
  semana: { inicio: "2026-06-22", fim: "2026-06-28", label: "22/06", parcial: false },
  vendas: { novoMrr: 75724, novoPontual: 93994, crossMrr: 36747, crossPontual: 6875 },
  carteira: { triagemOnboarding: 120000, ativo: 1023674, emCancelamento: 106874 },
  baseMrr: 924086,
  basePontual: 2000000,
  entregaPontual: 50000,
  churnMrr: { total: 51023, ajustado: 32032 },
  churnPontual: { total: 16000, ajustado: 10000 },
};

describe("derivarSemana", () => {
  it("repassa a identidade da semana", () => {
    const r = derivarSemana(ENTRADA);
    expect(r).toMatchObject({ inicio: "2026-06-22", fim: "2026-06-28", label: "22/06", parcial: false });
  });

  it("MRR Ativo = triagem/onboarding + ativo", () => {
    expect(derivarSemana(ENTRADA).mrrAtivo).toBe(1143674);
  });

  it("MRR Operando = MRR Ativo + em cancelamento", () => {
    expect(derivarSemana(ENTRADA).mrrOperando).toBe(1250548);
  });

  it("crossTotal = crossMrr + crossPontual", () => {
    expect(derivarSemana(ENTRADA).crossTotal).toBe(43622);
  });

  it("Net Churn ajustado subtrai APENAS o cross de MRR", () => {
    // 32032 - 36747 = -4715 (expansão líquida na semana)
    expect(derivarSemana(ENTRADA).netChurnAjustado).toBe(-4715);
  });

  it("Net Churn bruto subtrai APENAS o cross de MRR", () => {
    // 51023 - 36747 = 14276
    expect(derivarSemana(ENTRADA).netChurnBruto).toBe(14276);
  });

  it("percentuais de MRR usam a base de abertura da semana", () => {
    const r = derivarSemana(ENTRADA);
    expect(r.churnMrrTotalPct).toBeCloseTo(5.5215, 3);
    expect(r.churnMrrAjustadoPct).toBeCloseTo(3.4664, 3);
  });

  it("percentuais de pontual usam a base pontual de abertura", () => {
    const r = derivarSemana(ENTRADA);
    expect(r.churnPontualTotalPct).toBeCloseTo(0.8, 3);
    expect(r.churnPontualAjustadoPct).toBeCloseTo(0.5, 3);
  });

  it("base de MRR zero não vira divisão por zero — percentuais saem 0", () => {
    const r = derivarSemana({ ...ENTRADA, baseMrr: 0 });
    expect(r.churnMrrTotalPct).toBe(0);
    expect(r.churnMrrAjustadoPct).toBe(0);
    expect(r.netChurnAjustadoPct).toBe(0);
    expect(r.netChurnBrutoPct).toBe(0);
  });

  it("base pontual zero não vira divisão por zero", () => {
    const r = derivarSemana({ ...ENTRADA, basePontual: 0 });
    expect(r.churnPontualTotalPct).toBe(0);
    expect(r.churnPontualAjustadoPct).toBe(0);
  });

  it("venda nova e cross-sell nunca se sobrepõem: a soma reproduz o total ganho", () => {
    const r = derivarSemana(ENTRADA);
    expect(r.mrrAdicionado + r.crossMrr).toBe(75724 + 36747);
    expect(r.pontualVendido + r.crossPontual).toBe(93994 + 6875);
  });

  it("erro na query de vendas vira vendasIndisponivel, para o zero não passar por 'sem vendas'", () => {
    const r = derivarSemana({
      ...ENTRADA,
      vendas: { novoMrr: 0, novoPontual: 0, crossMrr: 0, crossPontual: 0, erro: true },
    });
    expect(r.vendasIndisponivel).toBe(true);
    expect(r.mrrAdicionado).toBe(0);
  });

  it("sem erro na query, vendasIndisponivel é false mesmo com tudo zerado", () => {
    const r = derivarSemana({
      ...ENTRADA,
      vendas: { novoMrr: 0, novoPontual: 0, crossMrr: 0, crossPontual: 0 },
    });
    expect(r.vendasIndisponivel).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `npx vitest run server/reportsSemanal/derivar.test.ts`
Expected: FAIL — `Cannot find module './derivar'`

- [ ] **Step 3: Implementar**

Criar `server/reportsSemanal/derivar.ts`:

```ts
// Derivação pura das métricas de uma semana, a partir das entradas cruas das
// queries. Sem I/O, para que as fórmulas — Net Churn sobre o cross de MRR,
// MRR Ativo vs Operando, bases dos percentuais — sejam testáveis sem banco.
// Mesmo desenho de `derivarMetricas` em services/resumoLideres.ts.
import type { Semana } from "./semanas";
import type { VendasPorChannel } from "../crm/expansao";

export interface EntradaSemana {
  semana: Semana;
  vendas: VendasPorChannel;
  carteira: { triagemOnboarding: number; ativo: number; emCancelamento: number };
  /** MRR (triagem+onboarding+ativo) no último snapshot ANTES da segunda-feira */
  baseMrr: number;
  /** valorp em aberto no mesmo snapshot de abertura */
  basePontual: number;
  entregaPontual: number;
  churnMrr: { total: number; ajustado: number };
  churnPontual: { total: number; ajustado: number };
}

export interface SemanaMetricas {
  inicio: string;
  fim: string;
  label: string;
  parcial: boolean;

  mrrAdicionado: number;
  pontualVendido: number;

  carteiraTriagemOnboarding: number;
  carteiraAtivo: number;
  carteiraEmCancelamento: number;
  mrrAtivo: number;
  mrrOperando: number;
  entregaPontual: number;

  baseMrr: number;
  basePontual: number;

  churnMrrTotal: number;
  churnMrrTotalPct: number;
  churnMrrAjustado: number;
  churnMrrAjustadoPct: number;
  churnPontualTotal: number;
  churnPontualTotalPct: number;
  churnPontualAjustado: number;
  churnPontualAjustadoPct: number;

  crossMrr: number;
  crossPontual: number;
  crossTotal: number;

  netChurnAjustado: number;
  netChurnAjustadoPct: number;
  netChurnBruto: number;
  netChurnBrutoPct: number;

  /** true quando a query de vendas falhou: os zeros não significam "sem vendas" */
  vendasIndisponivel: boolean;
}

function pct(valor: number, base: number): number {
  return base > 0 ? (valor / base) * 100 : 0;
}

export function derivarSemana(e: EntradaSemana): SemanaMetricas {
  const mrrAtivo = e.carteira.triagemOnboarding + e.carteira.ativo;
  const mrrOperando = mrrAtivo + e.carteira.emCancelamento;

  // Net Churn subtrai só o cross de MRR (crossMrr), nunca o crossTotal: somar
  // pontual ao numerador de uma taxa cuja base é MRR mistura duas grandezas.
  // Mesma régua da mensagem diária desde a v3.
  const netChurnAjustado = e.churnMrr.ajustado - e.vendas.crossMrr;
  const netChurnBruto = e.churnMrr.total - e.vendas.crossMrr;

  return {
    inicio: e.semana.inicio,
    fim: e.semana.fim,
    label: e.semana.label,
    parcial: e.semana.parcial,

    mrrAdicionado: e.vendas.novoMrr,
    pontualVendido: e.vendas.novoPontual,

    carteiraTriagemOnboarding: e.carteira.triagemOnboarding,
    carteiraAtivo: e.carteira.ativo,
    carteiraEmCancelamento: e.carteira.emCancelamento,
    mrrAtivo,
    mrrOperando,
    entregaPontual: e.entregaPontual,

    baseMrr: e.baseMrr,
    basePontual: e.basePontual,

    churnMrrTotal: e.churnMrr.total,
    churnMrrTotalPct: pct(e.churnMrr.total, e.baseMrr),
    churnMrrAjustado: e.churnMrr.ajustado,
    churnMrrAjustadoPct: pct(e.churnMrr.ajustado, e.baseMrr),
    churnPontualTotal: e.churnPontual.total,
    churnPontualTotalPct: pct(e.churnPontual.total, e.basePontual),
    churnPontualAjustado: e.churnPontual.ajustado,
    churnPontualAjustadoPct: pct(e.churnPontual.ajustado, e.basePontual),

    crossMrr: e.vendas.crossMrr,
    crossPontual: e.vendas.crossPontual,
    crossTotal: e.vendas.crossMrr + e.vendas.crossPontual,

    netChurnAjustado,
    netChurnAjustadoPct: pct(netChurnAjustado, e.baseMrr),
    netChurnBruto,
    netChurnBrutoPct: pct(netChurnBruto, e.baseMrr),

    vendasIndisponivel: e.vendas.erro === true,
  };
}
```

Nota sobre `pct` com numerador negativo: `netChurnAjustado` pode ser negativo (expansão líquida) e a fórmula devolve percentual negativo, que é o resultado correto. O guard `base > 0` protege só o denominador.

- [ ] **Step 4: Rodar o teste para ver passar**

Run: `npx vitest run server/reportsSemanal/derivar.test.ts`
Expected: PASS — 13 testes

- [ ] **Step 5: Commit**

```bash
git add server/reportsSemanal/derivar.ts server/reportsSemanal/derivar.test.ts
git commit -m "$(cat <<'EOF'
feat(reporte-semanal): derivação pura das métricas da semana

derivarSemana calcula MRR Ativo/Operando, os 4 percentuais de churn e o
Net Churn (que subtrai só o cross de MRR, como na mensagem v3). Sem I/O,
para testar fórmula sem mockar banco.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Queries de série (`server/reportsSemanal/queries.ts`)

**Files:**
- Create: `server/reportsSemanal/queries.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores — recebe datas `'YYYY-MM-DD'` como string.
- Produces: `carteiraNoFim(db, fim)`, `baseNaAbertura(db, inicio)`, `entregaPontualNaSemana(db, inicio, fim)`, `churnMrrNaSemana(db, inicio, fim)`, `churnPontualNaSemana(db, inicio, fim)`, e os detalhes `detalheChurnMrr(db, inicio, fim)`, `detalheChurnPontual(db, inicio, fim)`, `detalheEntregaPontual(db, inicio, fim)`. Tipos: `Carteira = { triagemOnboarding: number; ativo: number; emCancelamento: number }`, `Base = { mrr: number; pontual: number }`, `ChurnValores = { total: number; ajustado: number }`, `LinhaDetalhe = { cliente: string; valor: number; motivo: string | null; abonado: boolean }`.

Sem teste unitário: são queries SQL puras, cuja corretude é verificada na reconciliação da Task 8. O mapeamento de linhas já está coberto pelo padrão da Task 1.

- [ ] **Step 1: Implementar as queries de série**

Criar `server/reportsSemanal/queries.ts`:

```ts
// Queries de série da tela /reports/semanal, todas parametrizadas por
// (inicio, fim) da semana. Vendas e cross-sell NÃO estão aqui: vêm de
// server/crm/expansao.ts, compartilhado com a mensagem diária dos líderes.
//
// Snapshots: sempre `MAX(data_snapshot) <= data`, nunca igualdade com o dia
// exato — cup_data_hist tem semanas com 6 de 7 dias, e exigir o domingo
// preciso zeraria a carteira dessas semanas em silêncio.
import { sql } from "drizzle-orm";

export interface Carteira {
  triagemOnboarding: number;
  ativo: number;
  emCancelamento: number;
}

export interface Base {
  mrr: number;
  pontual: number;
}

export interface ChurnValores {
  total: number;
  ajustado: number;
}

export interface LinhaDetalhe {
  cliente: string;
  valor: number;
  motivo: string | null;
  abonado: boolean;
}

// Motivos que o "ajustado" exclui: são erro de venda/começo, não churn real.
const MOTIVOS_EXCLUIDOS = sql`('Erro na Venda', 'Não começou', 'Inadimplente 1º Mês')`;

function num(v: unknown): number {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

/** Foto da carteira no último snapshot <= fim da semana. */
export async function carteiraNoFim(db: any, fim: string): Promise<Carteira> {
  const r: any = await db.execute(sql`
    WITH snap AS (
      SELECT MAX(data_snapshot) AS d FROM "Clickup".cup_data_hist WHERE data_snapshot <= ${fim}::date
    )
    SELECT
      COALESCE(SUM(h.valorr::numeric) FILTER (WHERE h.status IN ('triagem','onboarding')), 0) AS triagem_onboarding,
      COALESCE(SUM(h.valorr::numeric) FILTER (WHERE h.status = 'ativo'), 0) AS ativo,
      COALESCE(SUM(h.valorr::numeric) FILTER (WHERE h.status = 'em cancelamento'), 0) AS em_cancelamento
    FROM "Clickup".cup_data_hist h, snap
    WHERE h.data_snapshot = snap.d
  `);
  const row = (r.rows ?? [])[0] as any;
  return {
    triagemOnboarding: num(row?.triagem_onboarding),
    ativo: num(row?.ativo),
    emCancelamento: num(row?.em_cancelamento),
  };
}

/**
 * Bases dos percentuais: último snapshot ANTES da segunda-feira da semana —
 * o fechamento da semana anterior. Uma query só devolve as duas bases.
 */
export async function baseNaAbertura(db: any, inicio: string): Promise<Base> {
  const r: any = await db.execute(sql`
    WITH snap AS (
      SELECT MAX(data_snapshot) AS d FROM "Clickup".cup_data_hist WHERE data_snapshot < ${inicio}::date
    )
    SELECT
      COALESCE(SUM(h.valorr::numeric) FILTER (WHERE h.status IN ('triagem','onboarding','ativo')), 0) AS mrr,
      COALESCE(SUM(h.valorp::numeric) FILTER (
        WHERE h.valorp > 0 AND h.status NOT IN ('entregue','cancelado/inativo','não usar')
      ), 0) AS pontual
    FROM "Clickup".cup_data_hist h, snap
    WHERE h.data_snapshot = snap.d
  `);
  const row = (r.rows ?? [])[0] as any;
  return { mrr: num(row?.mrr), pontual: num(row?.pontual) };
}

/**
 * Pontual que PASSOU a 'entregue' durante a semana: está 'entregue' no
 * snapshot de fechamento e não estava (ou nem existia) no de abertura.
 */
export async function entregaPontualNaSemana(db: any, inicio: string, fim: string): Promise<number> {
  const r: any = await db.execute(sql`
    WITH snap_fim AS (
      SELECT MAX(data_snapshot) AS d FROM "Clickup".cup_data_hist WHERE data_snapshot <= ${fim}::date
    ),
    snap_ini AS (
      SELECT MAX(data_snapshot) AS d FROM "Clickup".cup_data_hist WHERE data_snapshot < ${inicio}::date
    ),
    entregue_fim AS (
      SELECT h.id_subtask, h.valorp
      FROM "Clickup".cup_data_hist h, snap_fim
      WHERE h.data_snapshot = snap_fim.d AND h.status = 'entregue' AND h.valorp > 0
    )
    SELECT COALESCE(SUM(e.valorp::numeric), 0) AS total
    FROM entregue_fim e
    LEFT JOIN "Clickup".cup_data_hist i
      ON i.id_subtask = e.id_subtask AND i.data_snapshot = (SELECT d FROM snap_ini)
    WHERE i.status IS DISTINCT FROM 'entregue'
  `);
  return num((r.rows ?? [])[0]?.total);
}

/** Churn de MRR por data do pedido de encerramento, bruto e ajustado. */
export async function churnMrrNaSemana(db: any, inicio: string, fim: string): Promise<ChurnValores> {
  const r: any = await db.execute(sql`
    SELECT
      COALESCE(SUM(valor_r), 0) AS total,
      COALESCE(SUM(valor_r) FILTER (
        WHERE COALESCE(motivo_cancelamento, '') NOT IN ${MOTIVOS_EXCLUIDOS}
      ), 0) AS ajustado
    FROM "Clickup".cup_churn
    WHERE data_solicitacao_encerramento >= ${inicio}::date
      AND data_solicitacao_encerramento <= ${fim}::date
  `);
  const row = (r.rows ?? [])[0] as any;
  return { total: num(row?.total), ajustado: num(row?.ajustado) };
}

/** Churn pontual: cup_churn não tem valor_p, ele vem do contrato via id_subtask. */
export async function churnPontualNaSemana(db: any, inicio: string, fim: string): Promise<ChurnValores> {
  const r: any = await db.execute(sql`
    SELECT
      COALESCE(SUM(ct.valorp), 0) AS total,
      COALESCE(SUM(ct.valorp) FILTER (
        WHERE COALESCE(ch.motivo_cancelamento, '') NOT IN ${MOTIVOS_EXCLUIDOS}
      ), 0) AS ajustado
    FROM "Clickup".cup_churn ch
    JOIN "Clickup".cup_contratos ct ON ct.id_subtask = ch.task_id AND ct.valorp > 0
    WHERE ch.data_solicitacao_encerramento >= ${inicio}::date
      AND ch.data_solicitacao_encerramento <= ${fim}::date
  `);
  const row = (r.rows ?? [])[0] as any;
  return { total: num(row?.total), ajustado: num(row?.ajustado) };
}
```

- [ ] **Step 2: Acrescentar as queries gêmeas do drill no mesmo arquivo**

Anexar ao final de `server/reportsSemanal/queries.ts`:

```ts
// ============================================
// Queries GÊMEAS do drill.
// Cada uma repete o filtro da query de série correspondente. ⚠️ Se um filtro
// mudar, o par TEM que mudar junto, senão o drawer deixa de somar a célula.
// ============================================

/** Gêmea de churnMrrNaSemana. */
export async function detalheChurnMrr(db: any, inicio: string, fim: string): Promise<LinhaDetalhe[]> {
  const r: any = await db.execute(sql`
    SELECT
      COALESCE(NULLIF(TRIM(nome), ''), 'Sem nome') AS cliente,
      COALESCE(valor_r, 0) AS valor,
      NULLIF(TRIM(COALESCE(motivo_cancelamento, '')), '') AS motivo,
      (COALESCE(abonar_churn, '') = 'Sim') AS abonado
    FROM "Clickup".cup_churn
    WHERE data_solicitacao_encerramento >= ${inicio}::date
      AND data_solicitacao_encerramento <= ${fim}::date
    ORDER BY valor_r DESC NULLS LAST
  `);
  return ((r.rows ?? []) as any[]).map((x) => ({
    cliente: String(x.cliente),
    valor: num(x.valor),
    motivo: x.motivo ? String(x.motivo) : null,
    abonado: x.abonado === true,
  }));
}

/** Gêmea de churnPontualNaSemana. */
export async function detalheChurnPontual(db: any, inicio: string, fim: string): Promise<LinhaDetalhe[]> {
  const r: any = await db.execute(sql`
    SELECT
      COALESCE(NULLIF(TRIM(ch.nome), ''), 'Sem nome') AS cliente,
      COALESCE(ct.valorp, 0) AS valor,
      NULLIF(TRIM(COALESCE(ch.motivo_cancelamento, '')), '') AS motivo,
      (COALESCE(ch.abonar_churn, '') = 'Sim') AS abonado
    FROM "Clickup".cup_churn ch
    JOIN "Clickup".cup_contratos ct ON ct.id_subtask = ch.task_id AND ct.valorp > 0
    WHERE ch.data_solicitacao_encerramento >= ${inicio}::date
      AND ch.data_solicitacao_encerramento <= ${fim}::date
    ORDER BY ct.valorp DESC NULLS LAST
  `);
  return ((r.rows ?? []) as any[]).map((x) => ({
    cliente: String(x.cliente),
    valor: num(x.valor),
    motivo: x.motivo ? String(x.motivo) : null,
    abonado: x.abonado === true,
  }));
}

/** Gêmea de entregaPontualNaSemana. */
export async function detalheEntregaPontual(db: any, inicio: string, fim: string): Promise<LinhaDetalhe[]> {
  const r: any = await db.execute(sql`
    WITH snap_fim AS (
      SELECT MAX(data_snapshot) AS d FROM "Clickup".cup_data_hist WHERE data_snapshot <= ${fim}::date
    ),
    snap_ini AS (
      SELECT MAX(data_snapshot) AS d FROM "Clickup".cup_data_hist WHERE data_snapshot < ${inicio}::date
    ),
    entregue_fim AS (
      SELECT h.id_subtask, h.id_task, h.valorp
      FROM "Clickup".cup_data_hist h, snap_fim
      WHERE h.data_snapshot = snap_fim.d AND h.status = 'entregue' AND h.valorp > 0
    )
    SELECT
      COALESCE(NULLIF(TRIM(cl.nome), ''), 'Sem nome') AS cliente,
      COALESCE(e.valorp, 0) AS valor
    FROM entregue_fim e
    LEFT JOIN "Clickup".cup_data_hist i
      ON i.id_subtask = e.id_subtask AND i.data_snapshot = (SELECT d FROM snap_ini)
    LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = e.id_task
    WHERE i.status IS DISTINCT FROM 'entregue'
    ORDER BY e.valorp DESC NULLS LAST
  `);
  return ((r.rows ?? []) as any[]).map((x) => ({
    cliente: String(x.cliente),
    valor: num(x.valor),
    motivo: null,
    abonado: false,
  }));
}
```

- [ ] **Step 3: Verificar o typecheck**

Run: `npm run check 2>&1 | grep "reportsSemanal/queries"`
Expected: nenhuma linha

- [ ] **Step 4: Commit**

```bash
git add server/reportsSemanal/queries.ts
git commit -m "$(cat <<'EOF'
feat(reporte-semanal): queries de série e suas gêmeas de drill

Carteira e bases por snapshot (MAX(data_snapshot) <= data, porque há
semanas com 6 de 7 dias), churn MRR/pontual por data do pedido e entrega
pontual por flip de status entre os snapshots de abertura e fechamento.

Cada query de série tem a gêmea do drill logo abaixo, com aviso de que as
duas mudam juntas — senão o drawer deixa de somar a célula.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Rota da série (`GET /api/reports/semanal`)

**Files:**
- Rewrite: `server/routes/reportsSemanal.ts`
- Delete: `server/routes/reportsSemanal.helpers.ts`, `server/routes/reportsSemanal.helpers.test.ts`

**Interfaces:**
- Consumes: `gerarSemanas`, `hojeSP` (Task 2); `derivarSemana` (Task 3); queries (Task 4); `vendasPorChannel` (Task 1).
- Produces: `GET /api/reports/semanal?semanas=12` → `{ semanas: SemanaMetricas[] }`. `registerReportsSemanalRoutes(app)` mantém o nome, já registrado em `server/routes.ts:8719`.

- [ ] **Step 1: Reescrever a rota**

Substituir todo o conteúdo de `server/routes/reportsSemanal.ts` por:

```ts
// Tela /reports/semanal — métricas do Resumo dos Líderes em recorte semanal.
// Spec: docs/superpowers/specs/2026-07-21-reporte-semanal-lideres-design.md
//
// A classificação venda nova × cross-sell vem de server/crm/expansao.ts, o
// MESMO módulo que a mensagem diária usa. É o que impede a tela e a mensagem
// de divergirem.
import type { Express } from "express";
import { db } from "../db";
import { gerarSemanas, hojeSP } from "../reportsSemanal/semanas";
import { derivarSemana, type SemanaMetricas } from "../reportsSemanal/derivar";
import { vendasPorChannel, dealsPorChannel } from "../crm/expansao";
import {
  carteiraNoFim,
  baseNaAbertura,
  entregaPontualNaSemana,
  churnMrrNaSemana,
  churnPontualNaSemana,
  detalheChurnMrr,
  detalheChurnPontual,
  detalheEntregaPontual,
} from "../reportsSemanal/queries";

const SEMANAS_PADRAO = 12;
const SEMANAS_MAX = 26;

export function registerReportsSemanalRoutes(app: Express) {
  app.get("/api/reports/semanal", async (req, res) => {
    try {
      const pedido = Number(req.query.semanas);
      const quantidade = Number.isFinite(pedido)
        ? Math.min(Math.max(Math.trunc(pedido), 1), SEMANAS_MAX)
        : SEMANAS_PADRAO;

      const semanas = gerarSemanas(hojeSP(), quantidade);

      // Semanas em SÉRIE, de propósito. As 6 queries de uma semana rodam em
      // paralelo, mas as semanas não: o pool da aplicação é max: 5
      // (server/db.ts) e é compartilhado com todos os outros endpoints.
      // Paralelizar 12 semanas dispararia 72 queries concorrentes e deixaria
      // o resto do app esperando conexão enquanto esta tela carrega.
      const metricas: SemanaMetricas[] = [];
      for (const semana of semanas) {
        const [vendas, carteira, base, entregaPontual, churnMrr, churnPontual] = await Promise.all([
          vendasPorChannel(db, semana.inicio, semana.fim),
          carteiraNoFim(db, semana.fim),
          baseNaAbertura(db, semana.inicio),
          entregaPontualNaSemana(db, semana.inicio, semana.fim),
          churnMrrNaSemana(db, semana.inicio, semana.fim),
          churnPontualNaSemana(db, semana.inicio, semana.fim),
        ]);
        metricas.push(derivarSemana({
          semana,
          vendas,
          carteira,
          baseMrr: base.mrr,
          basePontual: base.pontual,
          entregaPontual,
          churnMrr,
          churnPontual,
        }));
      }

      res.json({ semanas: metricas });
    } catch (e: any) {
      console.error("[reports/semanal] erro geral:", e);
      res.status(500).json({ error: "Falha ao montar o reporte semanal", details: e?.message });
    }
  });

  // Drill de uma célula: as linhas por trás do número.
  app.get("/api/reports/semanal/detalhe", async (req, res) => {
    try {
      const metrica = String(req.query.metrica || "");
      const inicio = String(req.query.inicio || "");
      const fim = String(req.query.fim || "");

      if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) {
        return res.status(400).json({ error: "Parâmetros 'inicio' e 'fim' devem ser datas YYYY-MM-DD" });
      }

      switch (metrica) {
        case "mrrAdicionado":
        case "pontualVendido": {
          const deals = await dealsPorChannel(db, inicio, fim, "novo");
          return res.json({ tipo: "deals", linhas: deals });
        }
        case "crossMrr":
        case "crossPontual": {
          const deals = await dealsPorChannel(db, inicio, fim, "cross");
          return res.json({ tipo: "deals", linhas: deals });
        }
        case "churnMrrTotal":
        case "churnMrrAjustado":
          return res.json({ tipo: "churn", linhas: await detalheChurnMrr(db, inicio, fim) });
        case "churnPontualTotal":
        case "churnPontualAjustado":
          return res.json({ tipo: "churn", linhas: await detalheChurnPontual(db, inicio, fim) });
        case "entregaPontual":
          return res.json({ tipo: "churn", linhas: await detalheEntregaPontual(db, inicio, fim) });
        default:
          return res.status(400).json({ error: `Métrica '${metrica}' não tem drill` });
      }
    } catch (e: any) {
      console.error("[reports/semanal/detalhe] erro:", e);
      res.status(500).json({ error: "Falha ao carregar o detalhe", details: e?.message });
    }
  });
}
```

- [ ] **Step 2: Remover os helpers antigos**

A lógica de data deles migrou para `semanas.ts` (Task 2), com testes próprios e mais casos.

```bash
git rm server/routes/reportsSemanal.helpers.ts server/routes/reportsSemanal.helpers.test.ts
```

- [ ] **Step 3: Confirmar que ninguém mais importa os helpers**

Run: `grep -rn "reportsSemanal.helpers" --include="*.ts" --include="*.tsx" server client shared`
Expected: nenhuma linha

- [ ] **Step 4: Typecheck e suíte completa do server**

Run: `npm run check 2>&1 | grep -E "reportsSemanal|crm/expansao"`
Expected: nenhuma linha

Run: `npx vitest run server/`
Expected: PASS (a suíte de `reportsSemanal.helpers.test.ts` some junto com o arquivo)

- [ ] **Step 5: Testar a rota com o servidor rodando**

Subir o dev server (`npm run dev`) e, autenticado no browser em `http://localhost:3000`, abrir:

```
http://localhost:3000/api/reports/semanal?semanas=4
```

Expected: JSON com `semanas` de 4 itens; a última com `"parcial": true`; `mrrAtivo` na casa de R$ 1,2 milhão; `churnMrrTotal` presente.

- [ ] **Step 6: Commit**

```bash
git add server/routes/reportsSemanal.ts
git commit -m "$(cat <<'EOF'
feat(reporte-semanal): rota da série de 12 semanas + drill por célula

GET /api/reports/semanal devolve a série derivada; /detalhe devolve as
linhas por trás de uma célula, usando as queries gêmeas.

Remove reportsSemanal.helpers: a aritmética de data migrou para
reportsSemanal/semanas.ts com mais casos de teste (virada de mês, de ano,
domingo, segunda).

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Tabela semanal (client)

**Files:**
- Rewrite: `client/src/pages/relatorio-semanal/types.ts`
- Rewrite: `client/src/pages/relatorio-semanal/useRelatorioSemanal.ts`
- Create: `client/src/pages/relatorio-semanal/TabelaSemanal.tsx`
- Rewrite: `client/src/pages/RelatorioSemanal.tsx`

**Interfaces:**
- Consumes: `GET /api/reports/semanal` (Task 5).
- Produces: `SemanaMetricas` (espelho do tipo do server), `useReporteSemanal(semanas?: number)`, `<TabelaSemanal semanas={...} onCelula={...} />`, `LINHAS` e `MetricaChave`.

- [ ] **Step 1: Reescrever os tipos**

Substituir todo o conteúdo de `client/src/pages/relatorio-semanal/types.ts` por:

```ts
// Espelho de SemanaMetricas em server/reportsSemanal/derivar.ts.
// Mudou lá? Mude aqui.
export interface SemanaMetricas {
  inicio: string;
  fim: string;
  label: string;
  parcial: boolean;

  mrrAdicionado: number;
  pontualVendido: number;

  carteiraTriagemOnboarding: number;
  carteiraAtivo: number;
  carteiraEmCancelamento: number;
  mrrAtivo: number;
  mrrOperando: number;
  entregaPontual: number;

  baseMrr: number;
  basePontual: number;

  churnMrrTotal: number;
  churnMrrTotalPct: number;
  churnMrrAjustado: number;
  churnMrrAjustadoPct: number;
  churnPontualTotal: number;
  churnPontualTotalPct: number;
  churnPontualAjustado: number;
  churnPontualAjustadoPct: number;

  crossMrr: number;
  crossPontual: number;
  crossTotal: number;

  netChurnAjustado: number;
  netChurnAjustadoPct: number;
  netChurnBruto: number;
  netChurnBrutoPct: number;

  vendasIndisponivel: boolean;
}

export type MetricaChave = keyof Omit<SemanaMetricas, "inicio" | "fim" | "label" | "parcial" | "vendasIndisponivel">;

export interface LinhaDrillDeal {
  cliente: string;
  closer: string;
  canal: string;
  data: string | null;
  recorrente: number;
  pontual: number;
}

export interface LinhaDrillChurn {
  cliente: string;
  valor: number;
  motivo: string | null;
  abonado: boolean;
}

export interface DetalheResp {
  tipo: "deals" | "churn";
  linhas: LinhaDrillDeal[] | LinhaDrillChurn[];
}

export interface CelulaSelecionada {
  metrica: MetricaChave;
  rotulo: string;
  inicio: string;
  fim: string;
  labelSemana: string;
}
```

- [ ] **Step 2: Reescrever os hooks**

Substituir todo o conteúdo de `client/src/pages/relatorio-semanal/useRelatorioSemanal.ts` por:

```ts
import { useQuery } from "@tanstack/react-query";
import type { SemanaMetricas, DetalheResp, CelulaSelecionada } from "./types";

async function buscar<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.details || body.error || `Erro ${res.status}`);
  }
  return res.json();
}

export function useReporteSemanal(semanas = 12) {
  return useQuery<{ semanas: SemanaMetricas[] }>({
    queryKey: ["/api/reports/semanal", semanas],
    queryFn: () => buscar(`/api/reports/semanal?semanas=${semanas}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDetalheSemanal(celula: CelulaSelecionada | null) {
  return useQuery<DetalheResp>({
    queryKey: ["/api/reports/semanal/detalhe", celula?.metrica, celula?.inicio, celula?.fim],
    queryFn: () =>
      buscar(
        `/api/reports/semanal/detalhe?metrica=${celula!.metrica}&inicio=${celula!.inicio}&fim=${celula!.fim}`,
      ),
    enabled: celula !== null,
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 3: Criar a tabela**

Criar `client/src/pages/relatorio-semanal/TabelaSemanal.tsx`:

```tsx
import { Fragment } from "react";
import type { SemanaMetricas, MetricaChave, CelulaSelecionada } from "./types";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtPct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

interface Linha {
  chave: MetricaChave;
  rotulo: string;
  /** percentual em vez de moeda */
  percentual?: boolean;
  /** recuo, para a linha de % logo abaixo do valor que ela qualifica */
  indentada?: boolean;
  /** abre o drawer ao clicar */
  drill?: boolean;
  /** direção que conta como melhora, para a cor do Δ */
  melhor?: "up" | "down";
}

interface Secao {
  titulo: string;
  linhas: Linha[];
}

// A ordem espelha os blocos da mensagem diária dos líderes.
export const SECOES: Secao[] = [
  {
    titulo: "Novas Vendas",
    linhas: [
      { chave: "mrrAdicionado", rotulo: "MRR Adicionado", drill: true, melhor: "up" },
      { chave: "pontualVendido", rotulo: "Pontual Vendido", drill: true, melhor: "up" },
    ],
  },
  {
    titulo: "Carteira (foto do fim da semana)",
    linhas: [
      { chave: "carteiraTriagemOnboarding", rotulo: "Triagem / Onboarding", melhor: "up" },
      { chave: "carteiraAtivo", rotulo: "Ativo", melhor: "up" },
      { chave: "carteiraEmCancelamento", rotulo: "Em Cancelamento", melhor: "down" },
      { chave: "mrrAtivo", rotulo: "MRR Ativo", melhor: "up" },
      { chave: "mrrOperando", rotulo: "MRR Operando", melhor: "up" },
      { chave: "entregaPontual", rotulo: "Entrega Pontual", drill: true, melhor: "up" },
    ],
  },
  {
    titulo: "Churn",
    linhas: [
      { chave: "churnMrrTotal", rotulo: "Churn MRR Total", drill: true, melhor: "down" },
      { chave: "churnMrrTotalPct", rotulo: "% da base", percentual: true, indentada: true, melhor: "down" },
      { chave: "churnMrrAjustado", rotulo: "Churn MRR Ajustado", drill: true, melhor: "down" },
      { chave: "churnMrrAjustadoPct", rotulo: "% da base", percentual: true, indentada: true, melhor: "down" },
      { chave: "churnPontualTotal", rotulo: "Churn Pontual Total", drill: true, melhor: "down" },
      { chave: "churnPontualTotalPct", rotulo: "% do estoque", percentual: true, indentada: true, melhor: "down" },
      { chave: "churnPontualAjustado", rotulo: "Churn Pontual Ajustado", drill: true, melhor: "down" },
    ],
  },
  {
    titulo: "Cross Sell",
    linhas: [
      { chave: "crossMrr", rotulo: "Cross Sell MRR", drill: true, melhor: "up" },
      { chave: "crossPontual", rotulo: "Cross Sell Pontual", drill: true, melhor: "up" },
      { chave: "crossTotal", rotulo: "Cross Sell Total", melhor: "up" },
    ],
  },
  {
    titulo: "Net Churn (MRR)",
    linhas: [
      { chave: "netChurnAjustado", rotulo: "Net Churn Ajustado", melhor: "down" },
      { chave: "netChurnAjustadoPct", rotulo: "% da base", percentual: true, indentada: true, melhor: "down" },
      { chave: "netChurnBruto", rotulo: "Net Churn Bruto", melhor: "down" },
    ],
  },
];

/**
 * Δ da última semana FECHADA contra a anterior. A semana em curso fica de fora:
 * comparar uma semana pela metade com uma inteira produz sempre uma queda
 * fantasma na segunda-feira.
 */
function calcularDelta(semanas: SemanaMetricas[], chave: MetricaChave): number | null {
  const fechadas = semanas.filter((s) => !s.parcial);
  if (fechadas.length < 2) return null;
  const atual = fechadas[fechadas.length - 1][chave];
  const anterior = fechadas[fechadas.length - 2][chave];
  if (typeof atual !== "number" || typeof anterior !== "number" || anterior === 0) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

function corDelta(delta: number | null, melhor: "up" | "down" | undefined): string {
  if (delta == null || delta === 0 || !melhor) return "text-gray-400 dark:text-zinc-500";
  const subiu = delta > 0;
  const bom = melhor === "up" ? subiu : !subiu;
  return bom ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
}

export function TabelaSemanal({
  semanas,
  onCelula,
}: {
  semanas: SemanaMetricas[];
  /** Sem handler, as células não são clicáveis — a tabela funciona sem o drill. */
  onCelula?: (c: CelulaSelecionada) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-zinc-900">
            <th className="sticky left-0 z-10 bg-gray-50 dark:bg-zinc-900 px-4 py-3 text-left font-semibold text-gray-700 dark:text-zinc-200 min-w-[220px]">
              Métrica
            </th>
            {semanas.map((s) => (
              <th
                key={s.inicio}
                className={`px-3 py-3 text-right font-semibold tabular-nums whitespace-nowrap ${
                  s.parcial
                    ? "text-gray-400 dark:text-zinc-500"
                    : "text-gray-700 dark:text-zinc-200"
                }`}
                title={`${s.inicio} a ${s.fim}`}
              >
                {s.label}
                {s.parcial && "*"}
              </th>
            ))}
            <th className="px-3 py-3 text-right font-semibold text-gray-700 dark:text-zinc-200 whitespace-nowrap">
              Δ
            </th>
          </tr>
        </thead>
        <tbody>
          {SECOES.map((secao) => (
            // Fragment com key: agrupa o cabeçalho da seção e suas linhas sem
            // um wrapper que quebraria a estrutura do <tbody>.
            <Fragment key={secao.titulo}>
              <tr className="bg-gray-100/70 dark:bg-zinc-800/50">
                <td
                  colSpan={semanas.length + 2}
                  className="sticky left-0 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400"
                >
                  {secao.titulo}
                </td>
              </tr>
              {secao.linhas.map((linha) => {
                const delta = calcularDelta(semanas, linha.chave);
                return (
                  <tr
                    key={linha.chave}
                    className="border-t border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/40"
                  >
                    <td
                      className={`sticky left-0 z-10 bg-white dark:bg-zinc-900 px-4 py-2 text-gray-700 dark:text-zinc-300 ${
                        linha.indentada ? "pl-8 text-xs text-gray-500 dark:text-zinc-500" : ""
                      }`}
                    >
                      {linha.rotulo}
                    </td>
                    {semanas.map((s) => {
                      const valor = s[linha.chave] as number;
                      const texto = linha.percentual ? fmtPct(valor) : fmtBRL(valor);
                      const clicavel = linha.drill === true && onCelula !== undefined;
                      return (
                        <td
                          key={s.inicio}
                          className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${
                            s.parcial ? "text-gray-400 dark:text-zinc-500" : "text-gray-900 dark:text-zinc-100"
                          } ${linha.indentada ? "text-xs" : ""} ${
                            clicavel ? "cursor-pointer hover:underline decoration-dotted" : ""
                          }`}
                          onClick={
                            clicavel
                              ? () =>
                                  onCelula!({
                                    metrica: linha.chave,
                                    rotulo: linha.rotulo,
                                    inicio: s.inicio,
                                    fim: s.fim,
                                    labelSemana: s.label,
                                  })
                              : undefined
                          }
                        >
                          {texto}
                        </td>
                      );
                    })}
                    <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap font-medium ${corDelta(delta, linha.melhor)}`}>
                      {delta == null
                        ? "—"
                        : `${delta > 0 ? "+" : ""}${delta.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
                    </td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Reescrever a página**

Substituir todo o conteúdo de `client/src/pages/RelatorioSemanal.tsx` por:

```tsx
import { usePageTitle } from "@/hooks/use-page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarRange, AlertTriangle } from "lucide-react";
import { useReporteSemanal } from "./relatorio-semanal/useRelatorioSemanal";
import { TabelaSemanal } from "./relatorio-semanal/TabelaSemanal";

export default function RelatorioSemanal() {
  usePageTitle("Reporte Semanal");
  const { data, isLoading, isError, error } = useReporteSemanal(12);

  const semanas = data?.semanas ?? [];
  const algumaVendaIndisponivel = semanas.some((s) => s.vendasIndisponivel);

  return (
    <div className="p-6 space-y-6">
      <div>
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-500">
          <CalendarRange className="h-3.5 w-3.5" /> Reportes
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Reporte Semanal
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
          As métricas do Resumo dos Líderes semana a semana (segunda a domingo), nas últimas 12 semanas.
        </p>
      </div>

      {algumaVendaIndisponivel && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            A apuração de vendas falhou em pelo menos uma semana. As linhas de MRR Adicionado,
            Pontual Vendido e Cross Sell podem estar zeradas por erro de consulta, não por ausência
            de vendas.
          </span>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : isError ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">
          Falha ao carregar o reporte: {(error as Error)?.message}
        </p>
      ) : (
        <TabelaSemanal semanas={semanas} />
      )}

      <div className="space-y-1 text-xs text-gray-500 dark:text-zinc-500">
        <p>
          <strong>*</strong> Semana em curso — dados parciais. Fica de fora do cálculo da coluna Δ.
        </p>
        <p>
          Δ compara a última semana fechada com a anterior.
        </p>
        <p>
          Cross Sell = deals ganhos marcados como <strong>Expansão de Conta</strong> no CRM. Novas
          Vendas = todo o resto dos deals ganhos. Mesma régua da mensagem diária dos líderes.
        </p>
        <p>
          Churn Ajustado desconsidera erro de venda, clientes que não iniciaram e inadimplência de
          até 1 mês. Percentuais de MRR usam a carteira no fechamento da semana anterior; os de
          pontual, o estoque em aberto na mesma data.
        </p>
      </div>

    </div>
  );
}
```

Nesta task a tabela vai sem drill: `onCelula` é opcional e a página não o passa, então as células não ficam clicáveis. A Task 7 acrescenta o estado e o handler. Não há código temporário a remover depois.

- [ ] **Step 5: Typecheck**

Run: `npm run check 2>&1 | grep -E "RelatorioSemanal|relatorio-semanal"`
Expected: nenhuma linha

- [ ] **Step 6: Validar no browser, nos dois temas**

Com `npm run dev` rodando, abrir `http://localhost:3000/reports/semanal`.

Verificar:
- 12 colunas de semana, a última com `*` e em tom mais claro.
- Primeira coluna fixa ao rolar horizontalmente; a **página** não rola na horizontal.
- Δ com sinal e cor: verde quando MRR sobe, vermelho quando churn sobe.
- Alternar dark/light: nenhuma superfície fica branca no escuro nem ilegível no claro.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/RelatorioSemanal.tsx client/src/pages/relatorio-semanal/
git commit -m "$(cat <<'EOF'
feat(reporte-semanal): tabela de 12 semanas substitui os cards

Linhas agrupadas nas 5 seções da mensagem dos líderes, primeira coluna
fixa, scroll horizontal no contêiner. Semana em curso marcada com * e
excluída do Δ — comparar semana pela metade com semana inteira produz
queda fantasma toda segunda-feira.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Drawer de drill (client)

**Files:**
- Create: `client/src/pages/relatorio-semanal/DrawerDetalhe.tsx`
- Modify: `client/src/pages/RelatorioSemanal.tsx`

**Interfaces:**
- Consumes: `useDetalheSemanal` (Task 6), `CelulaSelecionada`, `DetalheResp` (Task 6), `GET /api/reports/semanal/detalhe` (Task 5).
- Produces: `<DrawerDetalhe celula={...} onClose={...} />`.

- [ ] **Step 1: Criar o drawer**

Criar `client/src/pages/relatorio-semanal/DrawerDetalhe.tsx`:

```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useDetalheSemanal } from "./useRelatorioSemanal";
import type { CelulaSelecionada, LinhaDrillDeal, LinhaDrillChurn } from "./types";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function DrawerDetalhe({
  celula,
  onClose,
}: {
  celula: CelulaSelecionada | null;
  onClose: () => void;
}) {
  const { data, isLoading, isError, error } = useDetalheSemanal(celula);

  const linhas = data?.linhas ?? [];
  const total =
    data?.tipo === "deals"
      ? (linhas as LinhaDrillDeal[]).reduce((s, l) => s + l.recorrente + l.pontual, 0)
      : (linhas as LinhaDrillChurn[]).reduce((s, l) => s + l.valor, 0);

  return (
    <Sheet open={celula !== null} onOpenChange={(aberto) => !aberto && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{celula?.rotulo}</SheetTitle>
          <SheetDescription>
            Semana de {celula?.inicio.split("-").reverse().join("/")} a{" "}
            {celula?.fim.split("-").reverse().join("/")} · {linhas.length}{" "}
            {linhas.length === 1 ? "registro" : "registros"} · {fmtBRL(total)}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : isError ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">
              Falha ao carregar: {(error as Error)?.message}
            </p>
          ) : linhas.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-zinc-500">
              Nenhum registro nesta semana.
            </p>
          ) : data?.tipo === "deals" ? (
            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
              {(linhas as LinhaDrillDeal[]).map((l, i) => (
                <div key={i} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-zinc-100">
                      {l.cliente}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-500">
                      {l.closer || "sem closer"} · {l.canal}
                      {l.data && ` · ${l.data.split("-").reverse().join("/")}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    {l.recorrente > 0 && (
                      <p className="text-sm text-gray-900 dark:text-zinc-100">{fmtBRL(l.recorrente)}<span className="text-xs text-gray-400"> rec</span></p>
                    )}
                    {l.pontual > 0 && (
                      <p className="text-sm text-gray-600 dark:text-zinc-400">{fmtBRL(l.pontual)}<span className="text-xs text-gray-400"> pont</span></p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
              {(linhas as LinhaDrillChurn[]).map((l, i) => (
                <div key={i} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-zinc-100">
                      {l.cliente}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {l.motivo && (
                        <span className="text-xs text-gray-500 dark:text-zinc-500">{l.motivo}</span>
                      )}
                      {l.abonado && (
                        <Badge variant="outline" className="text-[10px] py-0">abonado</Badge>
                      )}
                    </div>
                  </div>
                  <p className="shrink-0 text-sm tabular-nums text-gray-900 dark:text-zinc-100">
                    {fmtBRL(l.valor)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Ligar o drawer na página**

Em `client/src/pages/RelatorioSemanal.tsx`, acrescentar aos imports:

```tsx
import { useState } from "react";
import { DrawerDetalhe } from "./relatorio-semanal/DrawerDetalhe";
import type { CelulaSelecionada } from "./relatorio-semanal/types";
```

Declarar o estado como primeira linha do componente, logo após `usePageTitle`:

```tsx
  const [celula, setCelula] = useState<CelulaSelecionada | null>(null);
```

Passar o handler para a tabela — de:

```tsx
        <TabelaSemanal semanas={semanas} />
```

para:

```tsx
        <TabelaSemanal semanas={semanas} onCelula={setCelula} />
```

E acrescentar o drawer como último elemento antes do `</div>` que fecha a página:

```tsx
      <DrawerDetalhe celula={celula} onClose={() => setCelula(null)} />
```

- [ ] **Step 3: Typecheck**

Run: `npm run check 2>&1 | grep -E "RelatorioSemanal|relatorio-semanal"`
Expected: nenhuma linha

- [ ] **Step 4: Validar o drill no browser e reconciliar**

Em `http://localhost:3000/reports/semanal`:

- Clicar numa célula de **Churn MRR Total** de uma semana com valor > 0: o drawer abre com os clientes, e o total no subtítulo **tem que ser igual ao valor da célula**.
- Repetir para **Cross Sell MRR** e **MRR Adicionado**. Divergência aqui significa que a query gêmea não está com o mesmo filtro da query de série.
- Clicar numa célula de **MRR Ativo**: nada acontece (não é drillável).
- Verificar dark e light.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/relatorio-semanal/DrawerDetalhe.tsx client/src/pages/RelatorioSemanal.tsx
git commit -m "$(cat <<'EOF'
feat(reporte-semanal): drawer de drill por célula

Clicar numa célula de venda, cross-sell, churn ou entrega abre as linhas
por trás do número, com o total no cabeçalho para conferir contra a
célula na hora.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Reconciliação antes de tocar na mensagem

**Files:** nenhum — é uma verificação de dados. Nada é commitado.

Esta task existe porque a Task 9 muda os números que os líderes recebem no WhatsApp. Se a soma das semanas não reproduzir o mês, a régua nova tem um furo, e é melhor descobrir agora.

- [ ] **Step 1: Somar as semanas de um mês fechado e comparar com o mês**

Rodar contra produção:

```bash
PROD_PASS=$(grep -E "^# *DB_PASSWORD=" .env | head -1 | sed -E 's/^# *DB_PASSWORD=//' | tr -d '"'"'"'\r')
PGPASSWORD="$PROD_PASS" psql -h 34.95.249.110 -U postgres -d dados_turbo -c "
SELECT
  'junho inteiro' AS recorte,
  ROUND(SUM(valor_recorrente::numeric) FILTER (WHERE TRIM(COALESCE(channel,'')) <> 'Expansão de Conta'))::int AS novo_mrr,
  ROUND(SUM(valor_recorrente::numeric) FILTER (WHERE TRIM(COALESCE(channel,'')) = 'Expansão de Conta'))::int AS cross_mrr
FROM \"Bitrix\".crm_deal
WHERE stage_name='Negócio Ganho' AND data_fechamento >= '2026-06-01' AND data_fechamento <= '2026-06-30'
UNION ALL
SELECT
  'soma das semanas' ,
  ROUND(SUM(valor_recorrente::numeric) FILTER (WHERE TRIM(COALESCE(channel,'')) <> 'Expansão de Conta'))::int,
  ROUND(SUM(valor_recorrente::numeric) FILTER (WHERE TRIM(COALESCE(channel,'')) = 'Expansão de Conta'))::int
FROM \"Bitrix\".crm_deal
WHERE stage_name='Negócio Ganho' AND data_fechamento >= '2026-06-01' AND data_fechamento <= '2026-06-30';
"
```

Expected: as duas linhas **idênticas**. (A segunda usa o mesmo intervalo de propósito: o que se está verificando é que a partição por `channel` é exaustiva e sem sobreposição, não o recorte de datas.)

- [ ] **Step 2: Conferir que a partição não perde nem duplica deal**

```bash
PGPASSWORD="$PROD_PASS" psql -h 34.95.249.110 -U postgres -d dados_turbo -c "
SELECT
  COUNT(*) AS ganhos,
  COUNT(*) FILTER (WHERE TRIM(COALESCE(channel,'')) = 'Expansão de Conta') AS cross,
  COUNT(*) FILTER (WHERE TRIM(COALESCE(channel,'')) <> 'Expansão de Conta') AS novo
FROM \"Bitrix\".crm_deal
WHERE stage_name='Negócio Ganho' AND data_fechamento >= '2026-01-01';
"
```

Expected: `cross + novo = ganhos`, exatamente. Qualquer sobra significa deal com `channel` NULL escapando dos dois filtros — o `COALESCE` existe para impedir isso.

- [ ] **Step 3: Conferir a tela contra a query**

Abrir `/reports/semanal` e comparar 3 células de semanas fechadas (uma de MRR Adicionado, uma de Cross Sell MRR, uma de Churn MRR Total) com o resultado da PoC da spec. Divergência = investigar antes de seguir.

Se algum passo falhar, **parar aqui** e reportar. A Task 9 não deve rodar com a régua furada.

---

### Task 9: Migrar a mensagem diária para a régua `channel`

**Files:**
- Modify: `server/services/resumoLideres.ts`
- Modify: `server/services/resumoLideres.test.ts`

**Interfaces:**
- Consumes: `vendasPorChannel` (Task 1).
- Produces: `derivarMetricas` sem o parâmetro `crossOverride`; `MetricasResumo` inalterado no formato.

- [ ] **Step 1: Ajustar os testes primeiro**

Em `server/services/resumoLideres.test.ts`:

1. Remover o `describe("crossOverride (override manual de Cross Sell)")` inteiro (a partir do comentário em ~L464 até o fecho do bloco) — o mecanismo deixa de existir.
2. No bloco `vi.hoisted`, trocar os mocks do metricsAdapter pelo do módulo novo:

```ts
const mocks = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  mockGetMrrInicioMes: vi.fn(),
  mockVendasPorChannel: vi.fn(),
}));
const { mockExecute, mockGetMrrInicioMes, mockVendasPorChannel } = mocks;

vi.mock("../db", () => ({ db: { execute: mocks.mockExecute } }));
vi.mock("../okr2026/metricsAdapter", () => ({
  getMrrInicioMes: mocks.mockGetMrrInicioMes,
}));
vi.mock("../crm/expansao", () => ({
  vendasPorChannel: mocks.mockVendasPorChannel,
}));
```

3. Substituir, em `ENTRADA_BASE` e nos testes que a usam, os campos `vendasNovas` e `breakdown` por um único `vendas`:

```ts
// antes:  vendasNovas: { mrr: 100000, pontual: 200000 }, breakdown: { crosssell: 30000, crosssell_pontual: 10000 }
// depois:
vendas: { novoMrr: 100000, novoPontual: 200000, crossMrr: 30000, crossPontual: 10000 },
```

4. Acrescentar o teste da partição:

```ts
describe("régua channel: venda nova e cross-sell não se sobrepõem", () => {
  it("mrrAdicionado e crossR vêm de campos distintos da mesma apuração", () => {
    const r = derivarMetricas({
      ...ENTRADA_BASE,
      vendas: { novoMrr: 180339, novoPontual: 383267, crossMrr: 9300, crossPontual: 15300 },
    });
    expect(r.mrrAdicionado).toBe(180339);
    expect(r.crossR).toBe(9300);
    expect(r.crossTotal).toBe(24600);
  });

  it("erro na apuração marca crossIndisponivel E vendasIndisponivel", () => {
    const r = derivarMetricas({
      ...ENTRADA_BASE,
      vendas: { novoMrr: 0, novoPontual: 0, crossMrr: 0, crossPontual: 0, erro: true },
    });
    expect(r.crossIndisponivel).toBe(true);
    expect(r.vendasIndisponivel).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar os testes para ver falhar**

Run: `npx vitest run server/services/resumoLideres.test.ts`
Expected: FAIL — a assinatura de `derivarMetricas` ainda espera `vendasNovas`/`breakdown`

- [ ] **Step 3: Trocar a régua em `resumoLideres.ts`**

Remover o import de `getVendasMrrBreakdown` e `getVendasNovasBreakdown`, e o de `sql` continua necessário:

```ts
import { getMrrInicioMes } from "../okr2026/metricsAdapter";
import { vendasPorChannel } from "../crm/expansao";
```

Remover por completo: as constantes `METRIC_KEY_CROSS_R` / `METRIC_KEY_CROSS_P`, a interface `CrossOverride` e a função `getCrossOverrideMesAtual`.

Em `derivarMetricas`, trocar a entrada e o começo do corpo:

```ts
export function derivarMetricas(entrada: {
  carteira: CarteiraMrr;
  mrrMesAnterior: number;
  estoquePontualInicioMes: number;
  entregaPontual: number;
  // Venda nova e cross-sell da MESMA apuração (server/crm/expansao.ts),
  // classificados pela marcação `channel` do CRM. Antes vinham de duas
  // funções com réguas incompatíveis: CNPJ sem contrato anterior para venda
  // nova e override manual mensal para cross-sell — 40 dos 106 deals de
  // expansão de 2026 (R$ 121k de MRR) contavam nas duas linhas.
  vendas: {
    novoMrr: number;
    novoPontual: number;
    crossMrr: number;
    crossPontual: number;
    erro?: boolean;
  };
  churn: { total: number; ajustado: number; brutoSemAbono: number };
  churnPontual: { total: number; ajustado: number };
}): MetricasResumo {
  const { carteira, mrrMesAnterior, estoquePontualInicioMes, entregaPontual, vendas, churn, churnPontual } =
    entrada;

  const crossR = vendas.crossMrr;
  const crossP = vendas.crossPontual;
  const crossTotal = crossR + crossP;
  const netChurn = churn.ajustado - crossR;
  const netChurnBruto = churn.total - crossR;
  const mrrAtivo = carteira.ativo + carteira.triagemOnboarding;
  const mrrOperando = mrrAtivo + carteira.emCancelamento;
```

No objeto de retorno, trocar as duas primeiras linhas e as duas flags:

```ts
    mrrAdicionado: vendas.novoMrr,
    pontualVendido: vendas.novoPontual,
```

```ts
    // Uma apuração só: se ela falhou, as duas famílias de número estão comprometidas.
    crossIndisponivel: vendas.erro === true,
    vendasIndisponivel: vendas.erro === true,
```

Em `calcularMetricasResumo`, trocar as chamadas:

```ts
export async function calcularMetricasResumo(): Promise<MetricasResumo> {
  // Mês corrente em America/Sao_Paulo, no formato que vendasPorChannel espera.
  const hojeSP = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const primeiroDiaDoMes = `${hojeSP.slice(0, 7)}-01`;

  const [
    carteira,
    mrrMesAnterior,
    vendas,
    churn,
    churnPontual,
    entregaPontual,
    estoquePontualInicioMes,
  ] = await Promise.all([
    getCarteiraMrr(),
    getMrrInicioMes(),
    vendasPorChannel(db, primeiroDiaDoMes, hojeSP),
    getChurnMes(),
    getChurnPontualMes(),
    getEntregaPontualMes(),
    getEstoquePontualInicioMes(),
  ]);

  const metricas = derivarMetricas({
    carteira,
    mrrMesAnterior,
    estoquePontualInicioMes,
    entregaPontual,
    vendas,
    churn,
    churnPontual,
  });
```

O resto de `calcularMetricasResumo` (o guard rail de `mrrAtivo <= 0`) fica como está.

- [ ] **Step 4: Atualizar o texto da mensagem**

Em `formatarMensagemResumo`, a nota do bloco de Novas Vendas descrevia a régua antiga. Trocar:

```
📌 Considera vendas para clientes sem contrato anterior. Deals sem CNPJ preenchido entram nesta linha, por não ser possível classificá-los.
```

por:

```
📌 Considera os deals ganhos que não foram marcados como Expansão de Conta no CRM.
```

E, no bloco de Disclaimers, trocar:

```
• MRR Adicionado e Pontual Vendido consideram vendas para clientes sem contrato anterior. Deals sem CNPJ preenchido não são classificáveis e entram nessas linhas.
```

por:

```
• MRR Adicionado e Pontual Vendido são os deals ganhos não marcados como Expansão de Conta no CRM; Cross Sell são os marcados. As duas linhas não se sobrepõem.
```

Atualizar também o cabeçalho de comentário do arquivo (linhas 1-7), acrescentando ao final:

```ts
// 2026-07-21: venda nova e cross sell passaram a ser classificados pela
// marcação `channel` do CRM (server/crm/expansao.ts), a mesma régua da tela
// /reports/semanal. Saiu o override manual mensal de cross sell.
```

- [ ] **Step 5: Rodar os testes para ver passar**

Run: `npx vitest run server/services/resumoLideres.test.ts`
Expected: PASS

Run: `npm run check 2>&1 | grep resumoLideres`
Expected: nenhuma linha

- [ ] **Step 6: Conferir a prévia da mensagem no browser**

Com `npm run dev` rodando, abrir `http://localhost:3000/admin/resumo-lideres` e ler a prévia.

Verificar:
- Cross Sell MRR e Pontual com valores diferentes de zero.
- A nota do bloco de Novas Vendas e o disclaimer com o texto novo.
- Nenhum `R$ NaN` em lugar nenhum.
- Net Churn = Churn − Cross Sell de MRR, conferindo na mão.

- [ ] **Step 7: Apagar as linhas de override em produção**

O código não lê mais essa tabela, mas as linhas ficariam órfãs e confundiriam quem for investigar o histórico depois.

```bash
PROD_PASS=$(grep -E "^# *DB_PASSWORD=" .env | head -1 | sed -E 's/^# *DB_PASSWORD=//' | tr -d '"'"'"'\r')
PGPASSWORD="$PROD_PASS" psql -h 34.95.249.110 -U postgres -d dados_turbo -c "
DELETE FROM cortex_core.metric_actual_overrides_monthly
WHERE metric_key IN ('resumo_lideres_cross_r', 'resumo_lideres_cross_p');
"
```

Expected: `DELETE 2`

- [ ] **Step 8: Commit**

```bash
git add server/services/resumoLideres.ts server/services/resumoLideres.test.ts
git commit -m "$(cat <<'EOF'
feat(resumo-lideres): mensagem diária adota a régua channel de expansão

Venda nova e cross sell passam a sair de vendasPorChannel — a mesma
apuração da tela /reports/semanal — em vez de duas réguas incompatíveis
(CNPJ sem contrato anterior + override manual mensal).

Efeito medido em prod: venda nova de junho cai de R$ 296.282 para
R$ 242.791, porque cross-sell sem CNPJ estava sendo contado como
aquisição. Cross de julho vai de R$ 28.797 (digitado à mão) para
R$ 24.600 apurado.

Remove o override manual: existia como muleta para source='PARTNER'
(morto) e agora só serviria para a mensagem divergir da tela em silêncio.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Fechamento

**Files:**
- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: Rodar a suíte inteira**

Run: `npx vitest run`
Expected: PASS, sem suíte quebrada

Run: `npm run check`
Expected: sem erros

- [ ] **Step 2: Registrar no CHANGELOG**

Acrescentar no topo da seção corrente de `docs/CHANGELOG.md`:

```markdown
### Reporte Semanal dos Líderes (2026-07-21)

- `/reports/semanal` virou tabela de 12 semanas com as métricas do Resumo dos Líderes, drill por
  célula e coluna Δ. Substitui os 3 cards KPI anteriores.
- Venda nova e cross-sell passam a ser classificados por `crm_deal.channel = 'Expansão de Conta'`
  na tela **e** na mensagem diária, a partir de `server/crm/expansao.ts`. Números da mensagem mudam:
  venda nova de junho cai R$ 53k (cross-sell sem CNPJ vinha entrando como aquisição).
- Override manual mensal de cross-sell aposentado.
```

- [ ] **Step 3: Avisar os líderes antes do próximo envio**

A mensagem das 10h vai sair com números diferentes. Combinar com o Ichino o aviso ao grupo antes do
primeiro envio pós-deploy — está na tabela de riscos da spec.

- [ ] **Step 4: Commit e push**

```bash
git add docs/CHANGELOG.md
git commit -m "$(cat <<'EOF'
docs: changelog do reporte semanal e da unificação da régua de expansão

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Cobertura da spec

| Requisito da spec | Task |
|---|---|
| §3 Régua unificada `channel` | 1 |
| §3.1 Impacto na mensagem | 9 |
| §3.2 Override aposentado | 9 (passos 3 e 7) |
| §3.3 Métricas por semana | 3, 4 |
| §3.4 Semana parcial | 2 (flag), 6 (`*` e exclusão do Δ) |
| §3.5 `MAX(data_snapshot) <=` | 4 |
| §4.1 Módulo compartilhado + CEO Dashboard | 1 |
| §4.2 Server da tela | 2, 3, 4, 5 |
| §4.3 Mensagem diária | 9 |
| §4.4 Client | 6 |
| §4.5 Drill com queries gêmeas | 4 (gêmeas), 5 (rota), 7 (drawer) |
| §5 Testes puros | 1, 2, 3 |
| §5 Reconciliação antes do merge | 8 |
| §6 Riscos (aviso aos líderes) | 10 |
