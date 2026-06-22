# Redesign /creators-modelo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reformular a tela `/creators-modelo` numa tela de DECISÃO que responde "vale mais pontual ou recorrente?" — placar de 2 dimensões + break-even, mix de receita no tempo, LTV ajustado por maturidade, retenção e leitura recomendada — corrigindo os bugs apontados pelo Victor.

**Architecture:** Estende os helpers puros e testáveis em `server/routes/creatorsModelo.helpers.ts` com novos builders (placar, LTV maduro, break-even, mix mensal, sobrevivência por safra) e corrige a classificação do recorrente ativo. O endpoint `GET /api/creators-modelo` passa a devolver o payload do redesign com o filtro de período aplicado a TODOS os blocos. O frontend é reescrito em 5 seções (componentes focados). Fonte única: `cortex_core.vw_lt_contratos` (produto='Creators').

**Tech Stack:** TypeScript, Express, Drizzle (`db.execute(sql\`\`)`), Vitest + supertest (backend); React + React Query + Recharts + Tailwind + wouter (frontend).

## Global Constraints

- **Fonte única:** `cortex_core.vw_lt_contratos`, `WHERE produto='Creators' AND tipo_receita IN ('recorrente','pontual')`. Nunca `caz_parcelas` nem `cup_churn.lt`.
- **Helpers puros**: sem `new Date()` dentro deles; `hoje` ('YYYY-MM-DD') é parâmetro. A rota passa `new Date().toISOString().slice(0,10)`. 1 mês = 30.44 dias.
- **Comparações apples-to-apples:** o placar compara LTV/cliente **blended × blended** (NUNCA recorrente-ativo vs pontual-blended). O ajuste de maturidade vive na seção de LTV.
- **Bug #1 (fantasmas):** contratos recorrentes com `ltv_recorrente IS NULL` (status `entregue`/`em cancelamento`) NÃO entram no balde "ativo"; recorrente ativo = `is_ativo=true` na view.
- **Bug #2:** o filtro de período é aplicado a TODOS os blocos do payload.
- **Margem fica FORA** (cobertura 12% de `contratos_creators`). Não computar.
- **Dark/light obrigatório** (`dark:` em toda cor). Moeda via `formatCurrencyNoDecimals`. Conventional Commits com rodapé `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Testes:** `npx vitest run <arquivo>`. Não encadear git destrutivo após pipe. Push sem `--force`.
- **Preservado da base:** `isEntregaElegivel` + LT pontual = span entre entregas elegíveis (já no helper). Reusar funil (`churnPontorrente.helpers`) e `mediana` (`ltLtvChurn.helpers`).

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `server/routes/creatorsModelo.helpers.ts` (modificar) | Fix recorrente ativo + novos builders puros (placar, LTV maduro, break-even, mix mensal, sobrevivência safra, leitura) |
| `server/routes/creatorsModelo.helpers.test.ts` (modificar) | Testes dos novos builders + fix |
| `server/routes/creatorsModelo.ts` (modificar) | Endpoint devolve novo payload, período em todos os blocos |
| `server/routes/creatorsModelo.test.ts` (modificar) | Teste do novo payload |
| `client/src/components/creators-modelo/types.ts` (reescrever) | Tipos do novo payload |
| `client/src/components/creators-modelo/PlacarDecisao.tsx` (criar) | Seção 1 — 3 blocos hero |
| `client/src/components/creators-modelo/MixReceitaTempo.tsx` (criar) | Seção 2 — mix mensal |
| `client/src/components/creators-modelo/LtvMaturidade.tsx` (criar) | Seção 3 — LTV faixa + coorte |
| `client/src/components/creators-modelo/Retencao.tsx` (criar) | Seção 4 — funil + safra + recompra |
| `client/src/components/creators-modelo/LeituraRecomendada.tsx` (criar) | Seção 5 — "e daí?" |
| `client/src/pages/CreatorsModelo.tsx` (reescrever) | Composição das 5 seções + filtros |
| `client/src/components/creators-modelo/{HeadlineCards,TabelaLtLtv,AvisosMetodologicos}.tsx` (remover) | Substituídos |
| `client/src/components/creators-modelo/{FunilSobrevivencia,CardRecompra}.tsx` | Absorvidos por `Retencao` (remover após migrar) |
| `client/src/pages/CreatorsPontual.tsx`, `client/src/pages/LtLtvChurn.tsx` (modificar) | Cross-link para /creators-modelo |

---

## Task 1: Backend — corrigir recorrente ativo (fantasmas, bug #1)

**Files:**
- Modify: `server/routes/creatorsModelo.helpers.ts`
- Test: `server/routes/creatorsModelo.helpers.test.ts`

**Interfaces:**
- Consumes: `RawRow`, `mesesEntre`, `mediana` (já existem).
- Produces: `classifyEstadoRecorrente(r: RawRow): "ativo" | "cancelado" | null` (agora pode retornar null); `buildUnitsRecorrente` ignora contratos com estado null.

- [ ] **Step 1: Write the failing test**

```ts
// adicionar em server/routes/creatorsModelo.helpers.test.ts (no describe de buildUnitsRecorrente)
  it("ignora 'fantasma' recorrente (entregue/ltv null) do balde ativo", () => {
    const units = buildUnitsRecorrente(
      [
        // ativo real
        row({ idTask: "A", tipoReceita: "recorrente", valorr: 1000, ltMeses: 3, ltvRecorrente: 3000, isAtivo: true, isChurned: false, status: "ativo", dataInicio: "2026-03-01" }),
        // fantasma: status entregue, ltv null, não-ativo não-churned → NÃO conta
        row({ idTask: "B", tipoReceita: "recorrente", valorr: 1000, ltMeses: null, ltvRecorrente: null, isAtivo: false, isChurned: false, status: "entregue", dataInicio: "2026-03-01" }),
      ],
      "contrato", "2026-06-21",
    );
    expect(units).toHaveLength(1);       // só o ativo real
    expect(units[0].ltv).toBe(3000);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/routes/creatorsModelo.helpers.test.ts`
Expected: FAIL (units terá 2 itens; o fantasma entra com ltv 0).

- [ ] **Step 3: Write minimal implementation**

Substituir `classifyEstadoRecorrente` (a função inteira) por:

```ts
/**
 * Recorrente: ativo (assinatura viva) / cancelado / null (descartar).
 * Bug #1: status 'entregue'/'em cancelamento' com ltv_recorrente NULL NÃO são
 * "ativo" — a view marca como não-churned, mas não têm valor realizado. Usa
 * is_ativo (status ativo/onboarding/triagem/pausado) para o balde ativo.
 */
export function classifyEstadoRecorrente(r: RawRow): "ativo" | "cancelado" | null {
  if (r.isChurned) return "cancelado";
  if (r.isAtivo) return "ativo";
  return null; // fantasma (ex.: recorrente 'entregue') — fora dos baldes
}
```

No `buildUnitsRecorrente`, na construção dos units por CONTRATO, pular estado null:

```ts
  if (unidade === "contrato") {
    return rows
      .map((r) => ({ r, estado: classifyEstadoRecorrente(r) }))
      .filter((x): x is { r: RawRow; estado: "ativo" | "cancelado" } => x.estado !== null)
      .map(({ r, estado }) => ({
        estado,
        lt: r.dataInconsistente || r.ltMeses == null ? null : r.ltMeses,
        nEntregas: 0,
        ltv: r.ltvRecorrente ?? 0,
        idadeMeses: r.dataInicio ? mesesEntre(r.dataInicio, hoje) : 0,
      }));
  }
```

E no branch por CLIENTE, ao decidir `ativo`, usar `is_ativo` e ignorar clientes sem nenhum contrato ativo/churned válido:

```ts
  // ... dentro do loop por cliente, substituir o cálculo de `ativo`:
    const temAtivo = items.some((r) => classifyEstadoRecorrente(r) === "ativo");
    const temCancelado = items.some((r) => classifyEstadoRecorrente(r) === "cancelado");
    if (!temAtivo && !temCancelado) continue; // cliente só com fantasmas → fora
    const ativo = temAtivo;
```

(Mantém o restante do branch por cliente: `finsValidos`, `lt`, `ltv = Σ ltvRecorrente`, `idadeMeses`. O `estado` do push passa a ser `ativo ? "ativo" : "cancelado"`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/routes/creatorsModelo.helpers.test.ts`
Expected: PASS (incluindo os testes pré-existentes de buildUnitsRecorrente).

- [ ] **Step 5: Commit**

```bash
git add server/routes/creatorsModelo.helpers.ts server/routes/creatorsModelo.helpers.test.ts
git commit -m "fix(creators-modelo): recorrente ativo exclui fantasmas (ltv null) — bug Victor #1

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Backend — Placar (por-cliente blended, volume/caixa, break-even) + LTV maduro

**Files:**
- Modify: `server/routes/creatorsModelo.helpers.ts`
- Test: `server/routes/creatorsModelo.helpers.test.ts`

**Interfaces:**
- Consumes (Task 1): `RawRow`, `classifyModelo`, `buildUnitsRecorrente`, `buildUnitsPontual`, `aggregateMetricas`, `isEntregaElegivel`.
- Produces:
  - `interface LtvMaduro { realizadoBlended: number; realizadoAtivo: number; projetadoChurn: number; premissaChurnMeses: number }`
  - `interface BreakEven { ticketPontual: number; minRecompras: number; maxRecompras: number; recompraRealPct: number }`
  - `interface Placar { porCliente: { recorrente: number; pontual: number; recorrenteAtivo: number; razao: number }; volume: { pontualReceita: number; pontualClientes: number; recorrenteRealizado: number; recorrenteMrrCorrente: number; recorrenteClientes: number }; breakEven: BreakEven }`
  - `function buildLtvMaduro(rows: RawRow[], hoje: string): LtvMaduro`
  - `function buildPlacar(rows: RawRow[], hoje: string): Placar`

- [ ] **Step 1: Write the failing test**

```ts
// adicionar em server/routes/creatorsModelo.helpers.test.ts
import { buildLtvMaduro, buildPlacar } from "./creatorsModelo.helpers";

describe("buildLtvMaduro", () => {
  it("faixa: blended <= ativo; projeção por churn = MRR x LT cancelado", () => {
    const rows = [
      // ativo: MRR 1000, ltv realizado 6000 (6 meses vivos)
      row({ idTask: "A", tipoReceita: "recorrente", valorr: 1000, ltMeses: 6, ltvRecorrente: 6000, isAtivo: true, isChurned: false, status: "ativo", dataInicio: "2026-01-01" }),
      // cancelado: MRR 1000, ltv 2000 (2 meses), LT cancelado define a premissa de churn
      row({ idTask: "B", tipoReceita: "recorrente", valorr: 1000, ltMeses: 2, ltvRecorrente: 2000, isAtivo: false, isChurned: true, dataInconsistente: false, status: "cancelado/inativo", dataInicio: "2026-01-01", dataFim: "2026-03-01" }),
    ];
    const m = buildLtvMaduro(rows, "2026-06-21");
    expect(m.realizadoBlended).toBe(4000);  // (6000+2000)/2
    expect(m.realizadoAtivo).toBe(6000);    // só o ativo
    expect(m.premissaChurnMeses).toBe(2);   // LT médio dos cancelados
    expect(m.projetadoChurn).toBe(2000);    // MRR_ativo(1000) x LT_cancelado(2)
  });
});

describe("buildPlacar", () => {
  const rows = [
    row({ idTask: "R1", tipoReceita: "recorrente", valorr: 1000, ltMeses: 6, ltvRecorrente: 6000, isAtivo: true, isChurned: false, status: "ativo", dataInicio: "2026-01-01" }),
    row({ idTask: "R2", tipoReceita: "recorrente", valorr: 1000, ltMeses: 2, ltvRecorrente: 2000, isAtivo: false, isChurned: true, dataInconsistente: false, status: "cancelado/inativo", dataInicio: "2026-01-01", dataFim: "2026-03-01" }),
    row({ idTask: "P1", tipoReceita: "pontual", valorp: 1000, status: "entregue", servico: "Creators Pontual", dataInicio: "2026-03-01" }),
    row({ idTask: "P2", tipoReceita: "pontual", valorp: 3000, status: "entregue", servico: "Creators Pontual", dataInicio: "2026-03-01" }),
  ];
  it("por cliente é blended×blended e calcula razão", () => {
    const p = buildPlacar(rows, "2026-06-21");
    expect(p.porCliente.recorrente).toBe(4000);  // (6000+2000)/2
    expect(p.porCliente.pontual).toBe(2000);     // (1000+3000)/2
    expect(p.porCliente.recorrenteAtivo).toBe(6000);
    expect(p.porCliente.razao).toBe(2);          // 4000/2000
  });
  it("volume/caixa soma receita por modelo", () => {
    const p = buildPlacar(rows, "2026-06-21");
    expect(p.volume.pontualReceita).toBe(4000);       // 1000+3000
    expect(p.volume.recorrenteRealizado).toBe(8000);  // 6000+2000
    expect(p.volume.recorrenteMrrCorrente).toBe(1000); // só o ativo
    expect(p.volume.pontualClientes).toBe(2);
    expect(p.volume.recorrenteClientes).toBe(2);
  });
  it("break-even = LTV recorrente / ticket pontual (faixa)", () => {
    const p = buildPlacar(rows, "2026-06-21");
    expect(p.breakEven.ticketPontual).toBe(2000);     // média valorp entregues (1000+3000)/2
    expect(p.breakEven.minRecompras).toBe(2);         // blended 4000/2000
    expect(p.breakEven.maxRecompras).toBe(3);         // ativo 6000/2000
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/routes/creatorsModelo.helpers.test.ts`
Expected: FAIL — funções não exportadas.

- [ ] **Step 3: Write minimal implementation**

```ts
// adicionar em server/routes/creatorsModelo.helpers.ts
export interface LtvMaduro {
  realizadoBlended: number;
  realizadoAtivo: number;
  projetadoChurn: number;
  premissaChurnMeses: number;
}

export function buildLtvMaduro(rows: RawRow[], hoje: string): LtvMaduro {
  const rec = rows.filter((r) => classifyModelo(r) === "recorrente");
  const cli = buildUnitsRecorrente(rec, "cliente", hoje);
  const blended = aggregateMetricas(cli);
  const ativos = cli.filter((u) => u.estado === "ativo");
  const realizadoAtivo = aggregateMetricas(ativos).ltvMedia;
  const mrrAtivo = (() => {
    const v = rec.filter((r) => classifyEstadoRecorrente(r) === "ativo" && r.valorr > 0).map((r) => r.valorr);
    return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : 0;
  })();
  const ltCancelados = rec
    .filter((r) => classifyEstadoRecorrente(r) === "cancelado" && !r.dataInconsistente && r.ltMeses != null)
    .map((r) => r.ltMeses!);
  const premissaChurnMeses = ltCancelados.length
    ? Math.round((ltCancelados.reduce((s, x) => s + x, 0) / ltCancelados.length) * 10) / 10
    : 0;
  return {
    realizadoBlended: blended.ltvMedia,
    realizadoAtivo,
    projetadoChurn: Math.round(mrrAtivo * premissaChurnMeses),
    premissaChurnMeses,
  };
}

export interface BreakEven {
  ticketPontual: number;
  minRecompras: number;
  maxRecompras: number;
  recompraRealPct: number;
}

export interface Placar {
  porCliente: { recorrente: number; pontual: number; recorrenteAtivo: number; razao: number };
  volume: {
    pontualReceita: number; pontualClientes: number;
    recorrenteRealizado: number; recorrenteMrrCorrente: number; recorrenteClientes: number;
  };
  breakEven: BreakEven;
}

export function buildPlacar(rows: RawRow[], hoje: string): Placar {
  const rec = rows.filter((r) => classifyModelo(r) === "recorrente");
  const pont = rows.filter((r) => classifyModelo(r) === "pontual");
  const recCli = buildUnitsRecorrente(rec, "cliente", hoje);
  const pontCli = buildUnitsPontual(pont, "cliente", hoje);
  const recAgg = aggregateMetricas(recCli);
  const pontAgg = aggregateMetricas(pontCli);
  const recAtivoAgg = aggregateMetricas(recCli.filter((u) => u.estado === "ativo"));

  const ltv = buildLtvMaduro(rows, hoje);
  const ticketsEntregue = pont.filter((r) => r.status?.trim().toLowerCase() === "entregue").map((r) => r.valorp ?? 0);
  const ticketPontual = ticketsEntregue.length
    ? Math.round(ticketsEntregue.reduce((s, x) => s + x, 0) / ticketsEntregue.length)
    : 0;
  const recompra = buildRecompra(rows);

  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    porCliente: {
      recorrente: recAgg.ltvMedia,
      pontual: pontAgg.ltvMedia,
      recorrenteAtivo: recAtivoAgg.ltvMedia,
      razao: pontAgg.ltvMedia ? round1(recAgg.ltvMedia / pontAgg.ltvMedia) : 0,
    },
    volume: {
      pontualReceita: Math.round(pont.reduce((s, r) => s + (r.valorp ?? 0), 0)),
      pontualClientes: pontCli.length,
      recorrenteRealizado: Math.round(rec.reduce((s, r) => s + (r.ltvRecorrente ?? 0), 0)),
      recorrenteMrrCorrente: Math.round(
        rec.filter((r) => classifyEstadoRecorrente(r) === "ativo").reduce((s, r) => s + (r.valorr ?? 0), 0),
      ),
      recorrenteClientes: recCli.length,
    },
    breakEven: {
      ticketPontual,
      minRecompras: ticketPontual ? round1(ltv.realizadoBlended / ticketPontual) : 0,
      maxRecompras: ticketPontual ? round1(ltv.realizadoAtivo / ticketPontual) : 0,
      recompraRealPct: recompra.pctRecompra,
    },
  };
}
```

> Nota: `buildRecompra` já existe (Task 3 original). `minRecompras`/`maxRecompras` arredondam a 1 casa (2.0 e 3.0 no teste).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/routes/creatorsModelo.helpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routes/creatorsModelo.helpers.ts server/routes/creatorsModelo.helpers.test.ts
git commit -m "feat(creators-modelo): builders Placar + LTV maduro (faixa) + break-even

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Backend — Mix de receita mensal por modelo

**Files:**
- Modify: `server/routes/creatorsModelo.helpers.ts`
- Test: `server/routes/creatorsModelo.helpers.test.ts`

**Interfaces:**
- Consumes: `RawRow`, `classifyModelo`.
- Produces:
  - `interface MixMes { mes: string; pontualN: number; pontualValor: number; recorrenteN: number; recorrenteMrrNovo: number }`
  - `function buildMixMensal(rows: RawRow[]): MixMes[]` (ordenado por mês asc, só meses com ≥1 contrato).

- [ ] **Step 1: Write the failing test**

```ts
// adicionar em server/routes/creatorsModelo.helpers.test.ts
import { buildMixMensal } from "./creatorsModelo.helpers";

describe("buildMixMensal", () => {
  it("agrupa vendas novas por mês de data_inicio e modelo", () => {
    const rows = [
      row({ tipoReceita: "pontual", valorp: 5000, dataInicio: "2026-03-10" }),
      row({ tipoReceita: "pontual", valorp: 6000, dataInicio: "2026-03-20" }),
      row({ tipoReceita: "recorrente", valorr: 1000, valorp: 0, dataInicio: "2026-03-05" }),
      row({ tipoReceita: "pontual", valorp: 4000, dataInicio: "2026-04-01" }),
    ];
    const mix = buildMixMensal(rows);
    expect(mix).toHaveLength(2);
    const mar = mix.find((m) => m.mes === "2026-03")!;
    expect(mar.pontualN).toBe(2);
    expect(mar.pontualValor).toBe(11000);
    expect(mar.recorrenteN).toBe(1);
    expect(mar.recorrenteMrrNovo).toBe(1000);
    expect(mix.find((m) => m.mes === "2026-04")!.pontualN).toBe(1);
  });
  it("ignora linhas sem data_inicio", () => {
    expect(buildMixMensal([row({ tipoReceita: "pontual", dataInicio: null })])).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/routes/creatorsModelo.helpers.test.ts`
Expected: FAIL — `buildMixMensal` não existe.

- [ ] **Step 3: Write minimal implementation**

```ts
// adicionar em server/routes/creatorsModelo.helpers.ts
export interface MixMes {
  mes: string; pontualN: number; pontualValor: number; recorrenteN: number; recorrenteMrrNovo: number;
}

export function buildMixMensal(rows: RawRow[]): MixMes[] {
  const map = new Map<string, MixMes>();
  for (const r of rows) {
    if (!r.dataInicio) continue;
    const mes = r.dataInicio.slice(0, 7);
    const m = map.get(mes) ?? { mes, pontualN: 0, pontualValor: 0, recorrenteN: 0, recorrenteMrrNovo: 0 };
    const modelo = classifyModelo(r);
    if (modelo === "pontual") { m.pontualN += 1; m.pontualValor += r.valorp ?? 0; }
    else if (modelo === "recorrente") { m.recorrenteN += 1; m.recorrenteMrrNovo += r.valorr ?? 0; }
    map.set(mes, m);
  }
  return Array.from(map.values())
    .map((m) => ({ ...m, pontualValor: Math.round(m.pontualValor), recorrenteMrrNovo: Math.round(m.recorrenteMrrNovo) }))
    .sort((a, b) => a.mes.localeCompare(b.mes));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/routes/creatorsModelo.helpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routes/creatorsModelo.helpers.ts server/routes/creatorsModelo.helpers.test.ts
git commit -m "feat(creators-modelo): buildMixMensal (vendas novas por mês e modelo)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Backend — Sobrevivência por safra + aviso de maturidade por razão

**Files:**
- Modify: `server/routes/creatorsModelo.helpers.ts`
- Test: `server/routes/creatorsModelo.helpers.test.ts`

**Interfaces:**
- Consumes: `RawRow`, `classifyModelo`, `classifyEstadoRecorrente`, `buildUnitsRecorrente`, `buildUnitsPontual`, `aggregateMetricas`.
- Produces:
  - `interface SafraPonto { safra: string; n: number; pctAtivo: number }`
  - `function buildSobrevivenciaSafra(rows: RawRow[]): SafraPonto[]` (recorrente, por mês de entrada, % ainda ativo hoje)
  - `function avisoMaturidadePorRazao(rows: RawRow[], hoje: string): { recorrenteIdade: number; pontualIdade: number; aviso: boolean }`

- [ ] **Step 1: Write the failing test**

```ts
// adicionar em server/routes/creatorsModelo.helpers.test.ts
import { buildSobrevivenciaSafra, avisoMaturidadePorRazao } from "./creatorsModelo.helpers";

describe("buildSobrevivenciaSafra", () => {
  it("agrupa recorrente por mês de entrada e calcula % ainda ativo (não mistura coortes)", () => {
    const rows = [
      row({ tipoReceita: "recorrente", isAtivo: true, isChurned: false, status: "ativo", dataInicio: "2026-01-05" }),
      row({ tipoReceita: "recorrente", isAtivo: false, isChurned: true, status: "cancelado/inativo", dataInicio: "2026-01-20" }),
      row({ tipoReceita: "recorrente", isAtivo: true, isChurned: false, status: "ativo", dataInicio: "2026-02-10" }),
    ];
    const s = buildSobrevivenciaSafra(rows);
    expect(s).toHaveLength(2);
    expect(s.find((x) => x.safra === "2026-01")).toMatchObject({ n: 2, pctAtivo: 50 });
    expect(s.find((x) => x.safra === "2026-02")).toMatchObject({ n: 1, pctAtivo: 100 });
  });
});

describe("avisoMaturidadePorRazao", () => {
  it("acende quando uma coorte é >40% mais velha (corrige limiar absoluto)", () => {
    const rows = [
      row({ tipoReceita: "recorrente", isAtivo: true, isChurned: false, status: "ativo", dataInicio: "2025-01-01" }), // ~17m
      row({ tipoReceita: "pontual", status: "entregue", dataInicio: "2026-04-01" }), // ~2.6m
    ];
    const a = avisoMaturidadePorRazao(rows, "2026-06-21");
    expect(a.aviso).toBe(true);
    expect(a.recorrenteIdade).toBeGreaterThan(a.pontualIdade);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/routes/creatorsModelo.helpers.test.ts`
Expected: FAIL — funções não exportadas.

- [ ] **Step 3: Write minimal implementation**

```ts
// adicionar em server/routes/creatorsModelo.helpers.ts
export interface SafraPonto { safra: string; n: number; pctAtivo: number; }

export function buildSobrevivenciaSafra(rows: RawRow[]): SafraPonto[] {
  const rec = rows.filter((r) => classifyModelo(r) === "recorrente" && r.dataInicio);
  const map = new Map<string, { n: number; ativos: number }>();
  for (const r of rec) {
    const safra = r.dataInicio!.slice(0, 7);
    const cur = map.get(safra) ?? { n: 0, ativos: 0 };
    cur.n += 1;
    if (classifyEstadoRecorrente(r) === "ativo") cur.ativos += 1;
    map.set(safra, cur);
  }
  return Array.from(map.entries())
    .map(([safra, v]) => ({ safra, n: v.n, pctAtivo: v.n ? Math.round((v.ativos / v.n) * 1000) / 10 : 0 }))
    .sort((a, b) => a.safra.localeCompare(b.safra));
}

export function avisoMaturidadePorRazao(
  rows: RawRow[], hoje: string,
): { recorrenteIdade: number; pontualIdade: number; aviso: boolean } {
  const rec = rows.filter((r) => classifyModelo(r) === "recorrente");
  const pont = rows.filter((r) => classifyModelo(r) === "pontual");
  const recIdade = aggregateMetricas(buildUnitsRecorrente(rec, "cliente", hoje)).idadeMediaMeses;
  const pontIdade = aggregateMetricas(buildUnitsPontual(pont, "cliente", hoje)).idadeMediaMeses;
  const maior = Math.max(recIdade, pontIdade), menor = Math.min(recIdade, pontIdade);
  return { recorrenteIdade: recIdade, pontualIdade: pontIdade, aviso: menor > 0 && maior / menor > 1.4 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/routes/creatorsModelo.helpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routes/creatorsModelo.helpers.ts server/routes/creatorsModelo.helpers.test.ts
git commit -m "feat(creators-modelo): sobrevivência por safra + aviso maturidade por razão (bugs Victor #3,#4)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Backend — novo payload do endpoint + período em todos os blocos

**Files:**
- Modify: `server/routes/creatorsModelo.helpers.ts` (builder do payload)
- Modify: `server/routes/creatorsModelo.ts` (rota)
- Modify: `server/routes/creatorsModelo.test.ts`

**Interfaces:**
- Consumes (Tasks 1-4): `buildPlacar`, `buildLtvMaduro`, `buildMixMensal`, `buildSobrevivenciaSafra`, `avisoMaturidadePorRazao`, `aplicarPeriodo`, `buildFunil`+`toJornadas` (via toPontRows), `buildRecompra`, `isSequenciado`.
- Produces:
  - `interface RedesignPayload { meta; placar: Placar; ltvMaduro: LtvMaduro; mixMensal: MixMes[]; retencao: { funilVendido: FunilNivel[]; funilEntregue: FunilNivel[]; safra: SafraPonto[]; recompra: Recompra }; maturidade: { recorrenteIdade: number; pontualIdade: number; aviso: boolean } }`
  - `function buildRedesignPayload(rows: RawRow[], opts: { de?: string; ate?: string; hoje: string }): RedesignPayload`

- [ ] **Step 1: Write the failing test**

```ts
// substituir o conteúdo de teste relevante em server/routes/creatorsModelo.test.ts
// (manter o boilerplate de mock/supertest do topo do arquivo)
const dbRows = [
  { id_task: "R1", id_subtask: "S1", produto: "Creators", servico: "Creators Recorrente", status: "ativo", tipo_receita: "recorrente", valorr: "1000", valorp: "0", lt_meses: "6", ltv_recorrente: "6000", is_ativo: true, is_churned: false, data_inconsistente: false, data_inicio: "2026-01-01", data_fim: null },
  { id_task: "R2", id_subtask: "S2", produto: "Creators", servico: "Creators Recorrente", status: "cancelado/inativo", tipo_receita: "recorrente", valorr: "1000", valorp: "0", lt_meses: "2", ltv_recorrente: "2000", is_ativo: false, is_churned: true, data_inconsistente: false, data_inicio: "2026-01-01", data_fim: "2026-03-01" },
  { id_task: "P1", id_subtask: "S3", produto: "Creators", servico: "Creators Pontual", status: "entregue", tipo_receita: "pontual", valorr: "0", valorp: "2000", lt_meses: null, ltv_recorrente: null, is_ativo: false, is_churned: false, data_inconsistente: false, data_inicio: "2026-03-01", data_fim: null },
];

describe("GET /api/creators-modelo (redesign)", () => {
  it("retorna placar, ltvMaduro, mixMensal, retencao e maturidade", async () => {
    mockExecute.mockResolvedValueOnce({ rows: dbRows });
    const res = await request(makeApp()).get("/api/creators-modelo");
    expect(res.status).toBe(200);
    expect(res.body.placar.porCliente.recorrente).toBe(4000);
    expect(res.body.placar.volume.pontualReceita).toBe(2000);
    expect(res.body.ltvMaduro.realizadoAtivo).toBe(6000);
    expect(Array.isArray(res.body.mixMensal)).toBe(true);
    expect(res.body.retencao).toHaveProperty("safra");
    expect(res.body.retencao).toHaveProperty("funilEntregue");
    expect(typeof res.body.maturidade.aviso).toBe("boolean");
  });
  it("período filtra todos os blocos", async () => {
    mockExecute.mockResolvedValueOnce({ rows: dbRows });
    const res = await request(makeApp()).get("/api/creators-modelo?de=2026-03&ate=2026-03");
    expect(res.status).toBe(200);
    // só P1 (mar) entra; recorrentes (jan) saem → placar recorrente zera
    expect(res.body.placar.volume.recorrenteClientes).toBe(0);
    expect(res.body.placar.volume.pontualReceita).toBe(2000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/routes/creatorsModelo.test.ts`
Expected: FAIL — payload novo não existe.

- [ ] **Step 3: Write the payload builder** (em `creatorsModelo.helpers.ts`)

```ts
// adicionar em server/routes/creatorsModelo.helpers.ts
export interface RedesignPayload {
  meta: { de: string | null; ate: string | null; hoje: string; nSequenciados: number; nAvulsos: number; pctSequenciados: number };
  placar: Placar;
  ltvMaduro: LtvMaduro;
  mixMensal: MixMes[];
  retencao: { funilVendido: FunilNivel[]; funilEntregue: FunilNivel[]; safra: SafraPonto[]; recompra: Recompra };
  maturidade: { recorrenteIdade: number; pontualIdade: number; aviso: boolean };
}

export function buildRedesignPayload(
  rows: RawRow[], opts: { de?: string; ate?: string; hoje: string },
): RedesignPayload {
  const { de, ate, hoje } = opts;
  const periodo = aplicarPeriodo(rows, de, ate); // bug #2: período em TUDO

  // cobertura sequenciado/avulso (reusa lógica existente)
  const pontRows = periodo.filter((r) => classifyModelo(r) === "pontual");
  const seqCli = new Set<string>(), avuCli = new Set<string>();
  const byCli = new Map<string, RawRow[]>();
  for (const r of pontRows) {
    const k = r.idTask ?? r.idSubtask ?? "";
    (byCli.get(k) ?? byCli.set(k, []).get(k)!).push(r);
  }
  for (const [k, items] of Array.from(byCli.entries())) {
    if (items.some((r) => isSequenciado(r.servico))) seqCli.add(k); else avuCli.add(k);
  }
  const pontParaFunil = toPontRows(periodo.filter((r) => classifyModelo(r) === "pontual"));
  const mat = avisoMaturidadePorRazao(periodo, hoje);

  return {
    meta: {
      de: de ?? null, ate: ate ?? null, hoje,
      nSequenciados: seqCli.size, nAvulsos: avuCli.size,
      pctSequenciados: (seqCli.size + avuCli.size) ? Math.round((seqCli.size / (seqCli.size + avuCli.size)) * 1000) / 10 : 0,
    },
    placar: buildPlacar(periodo, hoje),
    ltvMaduro: buildLtvMaduro(periodo, hoje),
    mixMensal: buildMixMensal(periodo),
    retencao: {
      funilVendido: buildFunil(toJornadas(pontParaFunil, "vendido")),
      funilEntregue: buildFunil(toJornadas(pontParaFunil, "entregue")),
      safra: buildSobrevivenciaSafra(periodo),
      recompra: buildRecompra(periodo),
    },
    maturidade: mat,
  };
}
```

(O `toPontRows` privado já existe no arquivo, da implementação anterior. Se foi removido, recriar conforme o helper de Task 4 original do payload antigo.)

- [ ] **Step 4: Update the route** (`server/routes/creatorsModelo.ts`)

Trocar a chamada do builder antigo pelo novo. Manter a query e o mapeamento de `RawRow` exatamente como estão; só trocar a última linha:

```ts
      const hoje = new Date().toISOString().slice(0, 10);
      res.json(buildRedesignPayload(rows, { de, ate, hoje }));
```

E o import no topo: `import { buildRedesignPayload, type RawRow } from "./creatorsModelo.helpers";`

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run server/routes/creatorsModelo.test.ts server/routes/creatorsModelo.helpers.test.ts`
Expected: PASS (rota + helpers).

- [ ] **Step 6: Commit**

```bash
git add server/routes/creatorsModelo.ts server/routes/creatorsModelo.helpers.ts server/routes/creatorsModelo.test.ts
git commit -m "feat(creators-modelo): payload do redesign + período em todos os blocos (bug Victor #2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Frontend — tipos + página (filtros/scaffold) + PlacarDecisao

**Files:**
- Rewrite: `client/src/components/creators-modelo/types.ts`
- Create: `client/src/components/creators-modelo/PlacarDecisao.tsx`
- Rewrite: `client/src/pages/CreatorsModelo.tsx`

**Interfaces:**
- Consumes: payload de `GET /api/creators-modelo` (Task 5).
- Produces: `RedesignPayload` (e sub-tipos) em types.ts; `<PlacarDecisao data={...} />`; página default `CreatorsModelo`.

- [ ] **Step 1: Rewrite `types.ts`**

```ts
// client/src/components/creators-modelo/types.ts
export interface Placar {
  porCliente: { recorrente: number; pontual: number; recorrenteAtivo: number; razao: number };
  volume: { pontualReceita: number; pontualClientes: number; recorrenteRealizado: number; recorrenteMrrCorrente: number; recorrenteClientes: number };
  breakEven: { ticketPontual: number; minRecompras: number; maxRecompras: number; recompraRealPct: number };
}
export interface LtvMaduro { realizadoBlended: number; realizadoAtivo: number; projetadoChurn: number; premissaChurnMeses: number; }
export interface MixMes { mes: string; pontualN: number; pontualValor: number; recorrenteN: number; recorrenteMrrNovo: number; }
export interface FunilNivel { nivel: number; atingiram: number; pararamAqui: number; churn: number; emAndamento: number; concluido: number; valorpChurn: number; dropPct: number; }
export interface SafraPonto { safra: string; n: number; pctAtivo: number; }
export interface Recompra { totalAvulsos: number; comRecompra: number; pctRecompra: number; }
export interface RedesignPayload {
  meta: { de: string | null; ate: string | null; hoje: string; nSequenciados: number; nAvulsos: number; pctSequenciados: number };
  placar: Placar;
  ltvMaduro: LtvMaduro;
  mixMensal: MixMes[];
  retencao: { funilVendido: FunilNivel[]; funilEntregue: FunilNivel[]; safra: SafraPonto[]; recompra: Recompra };
  maturidade: { recorrenteIdade: number; pontualIdade: number; aviso: boolean };
}
```

(Manter `fetchJson`/`buildUrl` em `utils.ts` — não mexer.)

- [ ] **Step 2: Create `PlacarDecisao.tsx`**

```tsx
// client/src/components/creators-modelo/PlacarDecisao.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { Users, Banknote, Repeat } from "lucide-react";
import type { RedesignPayload } from "./types";

export function PlacarDecisao({ data }: { data: RedesignPayload }) {
  const { placar } = data;
  const pc = placar.porCliente, vol = placar.volume, be = placar.breakEven;
  const card = "bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50";
  const big = "text-2xl font-bold text-gray-900 dark:text-white";
  const sub = "text-xs text-gray-500 dark:text-zinc-400";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className={card}>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-gray-700 dark:text-zinc-200"><Users className="h-4 w-4 text-sky-500" /> Valor por cliente</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <div className={big}>Recorrente vale {placar.porCliente.razao}x</div>
          <p className={sub}>
            Recorrente {formatCurrencyNoDecimals(pc.recorrente)} vs Pontual {formatCurrencyNoDecimals(pc.pontual)} / cliente (blended).
            Entre ativos, recorrente {formatCurrencyNoDecimals(pc.recorrenteAtivo)} (ver maturidade abaixo).
          </p>
        </CardContent>
      </Card>
      <Card className={card}>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-gray-700 dark:text-zinc-200"><Banknote className="h-4 w-4 text-indigo-500" /> Volume / caixa</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <div className={big}>Pontual {formatCurrencyNoDecimals(vol.pontualReceita)}</div>
          <p className={sub}>
            {vol.pontualClientes} clientes pontuais · Recorrente {formatCurrencyNoDecimals(vol.recorrenteRealizado)} realizado
            + {formatCurrencyNoDecimals(vol.recorrenteMrrCorrente)}/mês de MRR vivo ({vol.recorrenteClientes} clientes).
          </p>
        </CardContent>
      </Card>
      <Card className={card}>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-gray-700 dark:text-zinc-200"><Repeat className="h-4 w-4 text-amber-500" /> Break-even de recompra</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <div className={big}>{be.minRecompras}–{be.maxRecompras}x</div>
          <p className={sub}>
            Um pontual precisaria recomprar {be.minRecompras}–{be.maxRecompras} vezes (ticket {formatCurrencyNoDecimals(be.ticketPontual)})
            para igualar 1 recorrente. Hoje só <span className="font-semibold text-amber-600 dark:text-amber-400">{be.recompraRealPct}%</span> recompram.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `CreatorsModelo.tsx`** (scaffold: filtro de período + fetch + PlacarDecisao; demais seções entram nas Tasks 7-10)

```tsx
// client/src/pages/CreatorsModelo.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSetPageInfo } from "@/contexts/PageContext";
import { fetchJson, buildUrl } from "@/components/creators-modelo/utils";
import type { RedesignPayload } from "@/components/creators-modelo/types";
import { PlacarDecisao } from "@/components/creators-modelo/PlacarDecisao";
import { MixReceitaTempo } from "@/components/creators-modelo/MixReceitaTempo";
import { LtvMaturidade } from "@/components/creators-modelo/LtvMaturidade";
import { Retencao } from "@/components/creators-modelo/Retencao";
import { LeituraRecomendada } from "@/components/creators-modelo/LeituraRecomendada";

function gerarMeses(): string[] {
  const hoje = new Date();
  const out: string[] = [];
  const d = new Date(2024, 0, 1);
  while (d <= hoje) { out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); d.setMonth(d.getMonth() + 1); }
  return out;
}
const MESES = gerarMeses();

export default function CreatorsModelo() {
  useSetPageInfo("Creators: Recorrente × Pontual", "Vale mais pontual ou recorrente?");
  const [de, setDe] = useState("todos");
  const [ate, setAte] = useState("todos");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/creators-modelo", de, ate],
    queryFn: () => fetchJson<RedesignPayload>(buildUrl("/api/creators-modelo", {
      de: de === "todos" ? undefined : de, ate: ate === "todos" ? undefined : ate,
    })),
  });
  const trig = "w-[150px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50";

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Select value={de} onValueChange={setDe}>
          <SelectTrigger className={trig}><SelectValue placeholder="De" /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Início: tudo</SelectItem>{MESES.map((m) => <SelectItem key={m} value={m}>De {m}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={ate} onValueChange={setAte}>
          <SelectTrigger className={trig}><SelectValue placeholder="Até" /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Até: tudo</SelectItem>{MESES.map((m) => <SelectItem key={m} value={m}>Até {m}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {isLoading || !data ? (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
      ) : (
        <>
          <PlacarDecisao data={data} />
          <MixReceitaTempo data={data} />
          <LtvMaturidade data={data} />
          <Retencao data={data} />
          <LeituraRecomendada data={data} />
        </>
      )}
    </div>
  );
}
```

> Importa componentes das Tasks 7-10 — não compila isolado até a Task 10. Build/verify só na Task 10.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/creators-modelo/types.ts client/src/components/creators-modelo/PlacarDecisao.tsx client/src/pages/CreatorsModelo.tsx
git commit -m "feat(creators-modelo): tipos do redesign + placar de decisão + scaffold da página

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Frontend — MixReceitaTempo

**Files:**
- Create: `client/src/components/creators-modelo/MixReceitaTempo.tsx`

**Interfaces:**
- Consumes: `RedesignPayload` (mixMensal), `useTheme`.
- Produces: `<MixReceitaTempo data={...} />`.

- [ ] **Step 1: Create the component**

```tsx
// client/src/components/creators-modelo/MixReceitaTempo.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { RedesignPayload } from "./types";

export function MixReceitaTempo({ data }: { data: RedesignPayload }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";
  const dados = data.mixMensal.map((m) => ({
    mes: m.mes, "Pontual (R$)": m.pontualValor, "Novo MRR rec (R$)": m.recorrenteMrrNovo,
    "Pontual (nº)": m.pontualN, "Recorrente (nº)": m.recorrenteN,
  }));
  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <CardTitle className="text-base">Mix de vendas no tempo</CardTitle>
        <p className="text-xs text-gray-500 dark:text-zinc-400">Vendas novas por mês de início · barras = R$ vendido · linha = nº de contratos novos. O pivot de mar/2026 salta aos olhos.</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={dados} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="mes" tick={{ fill: axis, fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
            <YAxis yAxisId="r" tick={{ fill: axis, fontSize: 11 }} tickFormatter={(v) => formatCurrencyNoDecimals(v)} />
            <YAxis yAxisId="n" orientation="right" tick={{ fill: axis, fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={{ backgroundColor: isDark ? "#18181b" : "#fff", border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`, borderRadius: 8, color: isDark ? "#f4f4f5" : "#111827" }}
              formatter={(v: number, n: string) => n.includes("R$") ? formatCurrencyNoDecimals(v) : v} />
            <Legend />
            <Bar yAxisId="r" dataKey="Pontual (R$)" fill="#6366f1" radius={[3, 3, 0, 0]} />
            <Bar yAxisId="r" dataKey="Novo MRR rec (R$)" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
            <Line yAxisId="n" dataKey="Pontual (nº)" stroke="#818cf8" strokeWidth={2} dot={false} />
            <Line yAxisId="n" dataKey="Recorrente (nº)" stroke="#38bdf8" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/creators-modelo/MixReceitaTempo.tsx
git commit -m "feat(creators-modelo): mix de vendas no tempo (história do pivot)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Frontend — LtvMaturidade

**Files:**
- Create: `client/src/components/creators-modelo/LtvMaturidade.tsx`

**Interfaces:**
- Consumes: `RedesignPayload` (placar.porCliente, ltvMaduro, maturidade), `useTheme`.
- Produces: `<LtvMaturidade data={...} />`.

- [ ] **Step 1: Create the component**

```tsx
// client/src/components/creators-modelo/LtvMaturidade.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { AlertTriangle } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { RedesignPayload } from "./types";

export function LtvMaturidade({ data }: { data: RedesignPayload }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";
  const lt = data.ltvMaduro;
  const dados = [
    { nome: "Pontual (realizado)", valor: data.placar.porCliente.pontual, cor: "#6366f1" },
    { nome: "Recorrente (blended)", valor: lt.realizadoBlended, cor: "#7dd3fc" },
    { nome: "Recorrente (ativos)", valor: lt.realizadoAtivo, cor: "#0ea5e9" },
    { nome: "Recorrente (proj. churn)", valor: lt.projetadoChurn, cor: "#0369a1" },
  ];
  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <CardTitle className="text-base">LTV por cliente — ajustado por maturidade</CardTitle>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Pontual já é realizado. Recorrente vai da faixa realizado (blended → ativos) à projeção por churn
          (premissa: vida média de {lt.premissaChurnMeses}m dos cancelados). Comparar maçã com maçã exige olhar a faixa, não o blended.
        </p>
      </CardHeader>
      <CardContent>
        {data.maturidade.aviso && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Maturidades diferentes: recorrente {data.maturidade.recorrenteIdade}m vs pontual {data.maturidade.pontualIdade}m de idade média. O LTV recorrente realizado ainda vai crescer — compare pela faixa/projeção.</span>
          </div>
        )}
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={dados} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="nome" tick={{ fill: axis, fontSize: 10 }} angle={-15} textAnchor="end" height={60} />
            <YAxis tick={{ fill: axis, fontSize: 11 }} tickFormatter={(v) => formatCurrencyNoDecimals(v)} />
            <Tooltip contentStyle={{ backgroundColor: isDark ? "#18181b" : "#fff", border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`, borderRadius: 8, color: isDark ? "#f4f4f5" : "#111827" }} formatter={(v: number) => formatCurrencyNoDecimals(v)} />
            <Bar dataKey="valor" radius={[4, 4, 0, 0]} name="LTV/cliente">
              {dados.map((d, i) => <Cell key={i} fill={d.cor} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/creators-modelo/LtvMaturidade.tsx
git commit -m "feat(creators-modelo): LTV por cliente ajustado por maturidade (faixa + aviso)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Frontend — Retencao (funil + safra + recompra)

**Files:**
- Create: `client/src/components/creators-modelo/Retencao.tsx`

**Interfaces:**
- Consumes: `RedesignPayload` (retencao, meta.pctSequenciados), `useTheme`.
- Produces: `<Retencao data={...} />`.

- [ ] **Step 1: Create the component**

```tsx
// client/src/components/creators-modelo/Retencao.tsx
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Repeat } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import type { RedesignPayload } from "./types";

export function Retencao({ data }: { data: RedesignPayload }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";
  const tt = { backgroundColor: isDark ? "#18181b" : "#fff", border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`, borderRadius: 8, color: isDark ? "#f4f4f5" : "#111827" };
  const [base, setBase] = useState<"vendido" | "entregue">("entregue");
  const funil = (base === "entregue" ? data.retencao.funilEntregue : data.retencao.funilVendido)
    .map((f) => ({ nome: `${f.nivel}ª`, valor: f.atingiram }));
  const safra = data.retencao.safra.map((s) => ({ nome: s.safra, valor: s.pctAtivo }));
  const rec = data.retencao.recompra;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2 bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Retenção: pontual × recorrente</CardTitle>
              <p className="text-xs text-gray-500 dark:text-zinc-400">Pontual = funil de entregas concluídas (clientes) · Recorrente = % ainda ativo por safra de entrada</p>
            </div>
            <Select value={base} onValueChange={(v) => setBase(v as "vendido" | "entregue")}>
              <SelectTrigger className="w-[150px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="entregue">Base: entregue</SelectItem><SelectItem value="vendido">Base: vendido</SelectItem></SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="mb-2 text-xs font-medium text-indigo-600 dark:text-indigo-400">Pontual — clientes por entrega ({data.meta.pctSequenciados}% sequenciados)</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={funil} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} /><XAxis dataKey="nome" tick={{ fill: axis, fontSize: 11 }} /><YAxis tick={{ fill: axis, fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={tt} />
                  <Bar dataKey="valor" radius={[4, 4, 0, 0]} name="Clientes">{funil.map((_, i) => <Cell key={i} fill="#6366f1" />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-sky-600 dark:text-sky-400">Recorrente — % ativo por safra</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={safra} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} /><XAxis dataKey="nome" tick={{ fill: axis, fontSize: 10 }} angle={-30} textAnchor="end" height={50} /><YAxis domain={[0, 100]} tick={{ fill: axis, fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={tt} formatter={(v: number) => `${v}%`} />
                  <Bar dataKey="valor" radius={[4, 4, 0, 0]} name="% ativo">{safra.map((_, i) => <Cell key={i} fill="#0ea5e9" />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Repeat className="h-4 w-4 text-indigo-500" /> Recompra (avulsos)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{rec.pctRecompra}%</div>
          <p className="text-sm text-gray-600 dark:text-zinc-300">{rec.comRecompra} de {rec.totalAvulsos} clientes avulsos compraram 2+ vezes.</p>
          <p className="text-xs text-gray-500 dark:text-zinc-400">Para os avulsos (compra única), recompra é o sinal de retenção.</p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/creators-modelo/Retencao.tsx
git commit -m "feat(creators-modelo): retenção (funil + sobrevivência por safra + recompra)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Frontend — LeituraRecomendada + remover antigos + wiring + verificação

**Files:**
- Create: `client/src/components/creators-modelo/LeituraRecomendada.tsx`
- Delete: `HeadlineCards.tsx`, `TabelaLtLtv.tsx`, `AvisosMetodologicos.tsx`, `FunilSobrevivencia.tsx`, `CardRecompra.tsx`
- Modify: `client/src/pages/CreatorsPontual.tsx`, `client/src/pages/LtLtvChurn.tsx` (cross-link)

**Interfaces:**
- Consumes: `RedesignPayload`.
- Produces: `<LeituraRecomendada data={...} />`; tela completa navegável.

- [ ] **Step 1: Create `LeituraRecomendada.tsx`**

```tsx
// client/src/components/creators-modelo/LeituraRecomendada.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { RedesignPayload } from "./types";

export function LeituraRecomendada({ data }: { data: RedesignPayload }) {
  const be = data.placar.breakEven;
  const linhas = [
    `Pontual ganha em caixa/volume: ${formatCurrencyNoDecimals(data.placar.volume.pontualReceita)} de ${data.placar.volume.pontualClientes} clientes — mas só se houver fluxo contínuo de clientes novos a CAC baixo.`,
    `Recorrente ganha em valor por cliente (${data.placar.porCliente.razao}x) e em ativo que compõe (${formatCurrencyNoDecimals(data.placar.volume.recorrenteMrrCorrente)}/mês de MRR vivo).`,
    `Risco do pivot: trocar MRR que compõe por caixa de uma vez. Um pontual precisaria recomprar ${be.minRecompras}–${be.maxRecompras}x para igualar 1 recorrente, e hoje só ${be.recompraRealPct}% recompram.`,
  ];
  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Lightbulb className="h-4 w-4 text-yellow-500" /> Leitura recomendada</CardTitle></CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm text-gray-700 dark:text-zinc-300">
          {linhas.map((l, i) => <li key={i} className="flex gap-2"><span className="text-gray-400 dark:text-zinc-500">•</span><span>{l}</span></li>)}
        </ul>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Delete the superseded components**

```bash
git rm client/src/components/creators-modelo/HeadlineCards.tsx \
       client/src/components/creators-modelo/TabelaLtLtv.tsx \
       client/src/components/creators-modelo/AvisosMetodologicos.tsx \
       client/src/components/creators-modelo/FunilSobrevivencia.tsx \
       client/src/components/creators-modelo/CardRecompra.tsx
```

- [ ] **Step 3: Add cross-links**

Em `client/src/pages/CreatorsPontual.tsx` e `client/src/pages/LtLtvChurn.tsx`, localizar o cabeçalho/filtros do topo e adicionar um link discreto (usar `Link` do wouter, já importado nas páginas; se não, importar `import { Link } from "wouter";`). Exemplo a inserir no topo do JSX retornado de cada página:

```tsx
        <Link href="/creators-modelo" className="text-xs text-sky-600 dark:text-sky-400 hover:underline">
          → Creators: Recorrente × Pontual
        </Link>
```

(Posicionar dentro do container de filtros existente; não alterar mais nada.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -E "creators-modelo|CreatorsModelo" || echo "NO FEATURE-FILE TYPE ERRORS"`
Expected: `NO FEATURE-FILE TYPE ERRORS`. (Erros pré-existentes em arquivos não relacionados podem ser ignorados.)

- [ ] **Step 5: Run all feature tests**

Run: `npx vitest run server/routes/creatorsModelo.helpers.test.ts server/routes/creatorsModelo.test.ts`
Expected: PASS (todos verdes).

- [ ] **Step 6: Commit**

```bash
git add client/src/components/creators-modelo/LeituraRecomendada.tsx client/src/pages/CreatorsPontual.tsx client/src/pages/LtLtvChurn.tsx
git commit -m "feat(creators-modelo): leitura recomendada + cross-links + remove componentes antigos

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 7: Verificação no browser (controller)**

O controller (sessão principal) faz a verificação: subir server em porta livre (ex.: `PORT=3005 npm run dev`, pois a 3000 pode estar ocupada por outro worktree), abrir `/creators-modelo`, conferir as 5 seções com dados reais, light + dark mode, sem erros de console, e os números-âncora (placar recorrente ~1,5x; pontual receita ~R$3M; break-even ~2,7–5,6x; recompra ~5%). NÃO é responsabilidade do usuário achar bug básico.

---

## Self-Review (preenchido pelo autor do plano)

**Cobertura do spec:**
- §4 Seção 1 (placar 2D + break-even) → Task 2 (buildPlacar) + Task 6 (PlacarDecisao) ✓
- §4 Seção 2 (mix mensal desde 2024) → Task 3 (buildMixMensal) + Task 7 (MixReceitaTempo) ✓
- §4 Seção 3 (LTV faixa + coorte + aviso razão) → Task 2 (buildLtvMaduro) + Task 4 (aviso) + Task 8 (LtvMaturidade) ✓
- §4 Seção 4 (funil + safra + recompra) → Task 4 (safra) + Task 5 (funil/recompra no payload) + Task 9 (Retencao) ✓
- §4 Seção 5 (leitura) → Task 10 (LeituraRecomendada) ✓
- Bug #1 fantasmas → Task 1 ✓; bug #2 período → Task 5 ✓; bug #3 curva por safra → Task 4 ✓; bug #4 aviso razão → Task 4 ✓; bug #5 cross-links → Task 10 ✓
- Margem fora → não há task (correto) ✓
- Substituição completa → Task 10 remove componentes antigos ✓

**Placeholders:** sem TBD/TODO; código completo em cada passo. ✓

**Consistência de tipos:** `Placar`, `LtvMaduro`, `MixMes`, `SafraPonto`, `Recompra`, `FunilNivel`, `RedesignPayload` idênticos entre backend (helpers) e frontend (types.ts). `buildPlacar/buildLtvMaduro/buildMixMensal/buildSobrevivenciaSafra/avisoMaturidadePorRazao/buildRedesignPayload` consistentes onde consumidos. `classifyEstadoRecorrente` agora retorna `"ativo"|"cancelado"|null` — consumidores (Task 2/4) tratam null. ✓

**Nota de simplificação registrada:** o "MRR vivo decaindo" do spec §4 Seção 2 é representado por "novo MRR recorrente vendido por mês" (derivável da fonte única); MRR-vivo-histórico exigiria `cup_data_hist` (só desde nov/2025, não cobre 2024). Decisão consciente, dentro do espírito do spec.
