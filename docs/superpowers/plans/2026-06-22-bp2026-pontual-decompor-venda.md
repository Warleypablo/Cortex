# BP 2026 — Decompor a "Venda" do estoque pontual — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quebrar a linha "(+) Venda" do quadro "Movimento do estoque de contratos pontuais" em sub-linhas por motivo da entrada (venda do mês / entrada defasada / reativação / sem origem), mantendo a Venda total e a identidade da ponte de estoque.

**Architecture:** A tabela continua sendo uma ponte de estoque medida por snapshot (`cup_data_hist`). A entrada na foto (já calculada como "venda") passa a ser subdividida via `data_criado` (lido de `cup_contratos`, fonte viva) e via estado do snapshot anterior. Lógica pura em `bp2026.pontual.helpers.ts` (testada com vitest); query e drill nos arquivos de rota; frontend reaproveita o padrão de sub-linha "·" existente.

**Tech Stack:** TypeScript, Drizzle ORM (Postgres GCP), Vitest, React + Tailwind (`BPDreTable`).

## Global Constraints

- Ano do BP: **2026** (`const ANO = 2026`). Mês-alvo `m` ∈ 1–12; `m=0` = dez/2025 (só base da ponte).
- Identidade da ponte (NÃO pode quebrar): `estoque_ini + venda − entrega − churn − deletados − saída_atípica + reajuste = estoque_fim`.
- Invariante nova: `vendaMes + entradaDefasada + reativacao + semOrigem === venda` (total).
- `data_criado` vem de `"Clickup".cup_contratos` (fonte viva), **nunca** do campo do snapshot.
- Estoque pontual = `valorp > 0` e status ∉ {`entregue`, `cancelado/inativo`, `não usar`} (`ehEstoquePontual`, já existente).
- Status de churn (saída): {`cancelado/inativo`, `não usar`} (`CHURN_STATUS`, já existente).
- Sub-linhas usam título prefixado com `· ` e **não** usam `subItem` (senão o drill é desabilitado em `BPDreTable.tsx:240`).
- Co-author dos commits: `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`.
- Comando de teste do helper: `npx vitest run server/routes/bp2026.pontual.helpers.test.ts`.

## File Structure

- `server/routes/bp2026.pontual.helpers.ts` — **modificar**: tipos (`RegPontual`, `PonteMes`, `CategoriaPonte`), `classificarPonte`, `classificarPonteItens`, `montarLinhasPontual`, notas.
- `server/routes/bp2026.pontual.helpers.test.ts` — **modificar**: atualizar casos e adicionar cobertura das sub-categorias.
- `server/routes/bp2026.pontual.ts` — **modificar**: SQL traz `data_criado` (→ `criadoYm`).
- `server/routes/bp2026.detalhe.ts` — **modificar**: `carregaPontualSnapshot` traz `criadoYm`; `detPontualMovimento` aceita lista de categorias e `ymAlvo`; novos rótulos e roteamento.
- `client/src/components/bp2026/BPDreTable.tsx` — **verificar** (esperado: sem mudança).

---

## Task 1: Soma da ponte decomposta (helper + linhas + testes)

**Files:**
- Modify: `server/routes/bp2026.pontual.helpers.ts`
- Test: `server/routes/bp2026.pontual.helpers.test.ts`

**Interfaces:**
- Consumes: `ehEstoquePontual(r)`, `CHURN_STATUS` (já existentes).
- Produces:
  - `interface RegPontual { idSubtask: string; valorp: number; status: string; criadoYm?: string | null }`
  - `interface PonteMes { estoqueIni; venda; vendaMes; entradaDefasada; reativacao; semOrigem; entrega; churn; deletados; saidaAtipica; reajuste; estoqueFim }` (todos `number`)
  - `classificarPonte(ant: RegPontual[], atual: RegPontual[], ymAlvo: string): PonteMes`
  - `montarLinhasPontual(porMes, mesCorrente, mesFechado): LinhaPontual[]` (assinatura inalterada; agora emite as sub-linhas `pontual_venda_mes`, `pontual_entrada_defasada`, `pontual_reativacao` e, condicional, `pontual_sem_origem`)

- [ ] **Step 1: Atualizar os testes existentes de `classificarPonte` e adicionar casos das sub-categorias**

Substituir os blocos `describe("classificarPonte", ...)` e `describe("montarLinhasPontual", ...)` no arquivo de teste. O fixture `ant`/`atual` ganha `criadoYm` nos registros e a chamada recebe `ymAlvo`. `F` (venda nova) recebe `criadoYm: "2026-03"` para ser "venda do mês" quando `ymAlvo="2026-03"`.

```typescript
describe("classificarPonte", () => {
  const p = classificarPonte(
    ant.map((r) => ({ ...r, criadoYm: "2026-03" })),
    atual.map((r) => ({ ...r, criadoYm: r.idSubtask === "F" ? "2026-03" : "2026-03" })),
    "2026-03",
  );
  it("classifica cada categoria", () => {
    expect(p.estoqueIni).toBe(2150);
    expect(p.venda).toBe(700);        // F (total)
    expect(p.vendaMes).toBe(700);     // F criado em 2026-03 == ymAlvo
    expect(p.entradaDefasada).toBe(0);
    expect(p.reativacao).toBe(0);
    expect(p.semOrigem).toBe(0);
    expect(p.entrega).toBe(500);
    expect(p.churn).toBe(300);
    expect(p.deletados).toBe(200);
    expect(p.saidaAtipica).toBe(150);
    expect(p.reajuste).toBe(100);
    expect(p.estoqueFim).toBe(1800);
  });
  it("soma das 4 sub-categorias = venda total", () => {
    expect(p.vendaMes + p.entradaDefasada + p.reativacao + p.semOrigem).toBe(p.venda);
  });
  it("a ponte fecha (identidade)", () => {
    expect(
      p.estoqueIni + p.venda - p.entrega - p.churn - p.deletados - p.saidaAtipica + p.reajuste
    ).toBe(p.estoqueFim);
  });
});

describe("classificarPonte — sub-categorias da venda", () => {
  // base anterior: H estava entregue (fora do estoque) -> reativa; demais ausentes
  const anterior = [
    { idSubtask: "H", valorp: 400, status: "entregue", criadoYm: "2025-11" }, // volta -> reativação
  ];
  const agora = [
    { idSubtask: "H", valorp: 400, status: "ativo", criadoYm: "2025-11" },    // reativação (precede data)
    { idSubtask: "M", valorp: 300, status: "ativo", criadoYm: "2026-04" },    // venda do mês
    { idSubtask: "P", valorp: 200, status: "ativo", criadoYm: "2026-02" },    // entrada defasada
    { idSubtask: "S", valorp: 100, status: "ativo", criadoYm: null },         // sem origem
  ];
  const p = classificarPonte(anterior, agora, "2026-04");
  it("separa reativação, venda do mês, defasada e sem origem", () => {
    expect(p.reativacao).toBe(400);
    expect(p.vendaMes).toBe(300);
    expect(p.entradaDefasada).toBe(200);
    expect(p.semOrigem).toBe(100);
    expect(p.venda).toBe(1000);
  });
  it("reativação tem precedência sobre data_criado", () => {
    // H tem criadoYm 2025-11 (defasada) mas estava no snapshot anterior fora do estoque -> reativação
    expect(p.reativacao).toBe(400);
    expect(p.entradaDefasada).toBe(200); // só P, não H
  });
});
```

No `describe("montarLinhasPontual", ...)`, ajustar o fixture e adicionar asserts das sub-linhas:

```typescript
describe("montarLinhasPontual", () => {
  const porMes = {
    0: ant.map((r) => ({ ...r, criadoYm: "2025-12" })),
    1: atual.map((r) => ({ ...r, criadoYm: r.idSubtask === "F" ? "2026-01" : "2025-12" })),
  };
  const linhas = montarLinhasPontual(porMes, 1, 1);
  const by = (m: string) => linhas.find((l) => l.metrica === m)!;
  it("estoque inicial positivo, fluxos com sinal, estoque final destaque", () => {
    expect(by("pontual_estoque_ini").meses[0].realizado).toBe(2150);
    expect(by("pontual_venda").meses[0].realizado).toBe(700);
    expect(by("pontual_entrega").meses[0].realizado).toBe(-500);
    expect(by("pontual_estoque_fim").meses[0].realizado).toBe(1800);
    expect(by("pontual_estoque_fim").destaque).toBe(true);
  });
  it("emite as sub-linhas da venda logo após (+) Venda", () => {
    expect(by("pontual_venda_mes").meses[0].realizado).toBe(700);    // F criado em 2026-01 == mês 1
    expect(by("pontual_entrada_defasada").meses[0].realizado).toBe(0);
    expect(by("pontual_reativacao").meses[0].realizado).toBe(0);
    expect(by("pontual_venda_mes").titulo).toBe("· Venda do mês");
    const idxVenda = linhas.findIndex((l) => l.metrica === "pontual_venda");
    expect(linhas[idxVenda + 1].metrica).toBe("pontual_venda_mes");
  });
  it("não emite '· Sem origem' quando não há valor", () => {
    expect(linhas.find((l) => l.metrica === "pontual_sem_origem")).toBeUndefined();
  });
  it("decomposição por status soma ao estoque final", () => {
    expect(by("pontual_status_ativo").meses[0].realizado).toBe(1100);
    expect(by("pontual_status_triagem").meses[0].realizado).toBe(700);
  });
  it("todas as linhas são só-realizado (orcado 0, atingimento null, neutro)", () => {
    for (const l of linhas) {
      expect(l.direcao).toBe("neutro");
      expect(l.meses[0].orcado).toBe(0);
      expect(l.meses[0].atingimento).toBeNull();
    }
  });
  it("YTD: inicial=jan(dez), venda somada, final=posição", () => {
    expect(by("pontual_estoque_ini").ytd.realizado).toBe(2150);
    expect(by("pontual_venda").ytd.realizado).toBe(700);
    expect(by("pontual_estoque_fim").ytd.realizado).toBe(1800);
  });
});
```

- [ ] **Step 2: Rodar os testes e verificar que falham**

Run: `npx vitest run server/routes/bp2026.pontual.helpers.test.ts`
Expected: FAIL (ex.: `p.vendaMes` undefined; `classificarPonte` espera 2 args; `pontual_venda_mes` não encontrado).

- [ ] **Step 3: Adicionar `ANO`, estender `RegPontual` e `PonteMes`, reescrever `classificarPonte`**

No topo do módulo, após os `Set`s existentes, adicionar:

```typescript
const ANO = 2026;
```

Trocar a interface `RegPontual`:

```typescript
export interface RegPontual {
  idSubtask: string;
  valorp: number;
  status: string;
  criadoYm?: string | null; // 'YYYY-MM' de data_criado (cup_contratos); ausente => sem origem
}
```

Trocar a interface `PonteMes`:

```typescript
export interface PonteMes {
  estoqueIni: number;
  venda: number;          // total das 4 sub-categorias abaixo
  vendaMes: number;       // criadoYm == mês-alvo
  entradaDefasada: number;// criadoYm de mês anterior/futuro
  reativacao: number;     // estava na foto anterior fora do estoque
  semOrigem: number;      // sem registro em cup_contratos
  entrega: number;
  churn: number;
  deletados: number;
  saidaAtipica: number;
  reajuste: number;
  estoqueFim: number;
}
```

Reescrever `classificarPonte` (assinatura + corpo). O 1º loop (saídas/reajuste) é igual ao atual; o 2º loop (entradas) subdivide:

```typescript
export function classificarPonte(ant: RegPontual[], atual: RegPontual[], ymAlvo: string): PonteMes {
  const antMap = new Map(ant.map((r) => [r.idSubtask, r]));
  const p: PonteMes = {
    estoqueIni: 0, venda: 0, vendaMes: 0, entradaDefasada: 0, reativacao: 0, semOrigem: 0,
    entrega: 0, churn: 0, deletados: 0, saidaAtipica: 0, reajuste: 0, estoqueFim: 0,
  };
  const atualMap = new Map(atual.map((r) => [r.idSubtask, r]));
  for (const r of ant) {
    if (!ehEstoquePontual(r)) continue;
    p.estoqueIni += r.valorp;
    const a = atualMap.get(r.idSubtask);
    if (!a) { p.deletados += r.valorp; continue; }
    if (ehEstoquePontual(a)) { p.reajuste += a.valorp - r.valorp; continue; }
    if (a.status === "entregue") p.entrega += r.valorp;
    else if (CHURN_STATUS.has(a.status)) p.churn += r.valorp;
    else p.saidaAtipica += r.valorp;
  }
  for (const r of atual) {
    if (!ehEstoquePontual(r)) continue;
    p.estoqueFim += r.valorp;
    const prev = antMap.get(r.idSubtask);
    if (prev && ehEstoquePontual(prev)) continue; // permaneceu (reajuste já tratado)
    // entrada no estoque: subdividir
    if (prev) p.reativacao += r.valorp;                 // estava na foto anterior, fora do estoque
    else if (!r.criadoYm) p.semOrigem += r.valorp;      // sem registro em cup_contratos
    else if (r.criadoYm === ymAlvo) p.vendaMes += r.valorp;
    else p.entradaDefasada += r.valorp;
    p.venda += r.valorp;
  }
  return p;
}
```

- [ ] **Step 4: Atualizar `montarLinhasPontual` — passar `ymAlvo` e emitir sub-linhas**

Dentro de `montarLinhasPontual`, na construção do array `ponte[m]`, passar o mês-alvo:

```typescript
  for (let m = 1; m <= 12; m++) {
    if (m > mesCorrente) continue;
    const ym = `${ANO}-${String(m).padStart(2, "0")}`;
    ponte[m] = classificarPonte(porMes[m - 1] ?? [], porMes[m] ?? [], ym);
    decomp[m] = decomporStatus(porMes[m] ?? []);
  }
```

Substituir o array literal `const linhas: LinhaPontual[] = [ ... ];` (da `pontual_estoque_ini` até `pontual_estoque_fim`) por construção com as sub-linhas e o `sem_origem` condicional:

```typescript
  const serieVenda = serieFluxo((p) => p.venda, 1);
  const serieVendaMes = serieFluxo((p) => p.vendaMes, 1);
  const serieDefasada = serieFluxo((p) => p.entradaDefasada, 1);
  const serieReativacao = serieFluxo((p) => p.reativacao, 1);
  const serieSemOrigem = serieFluxo((p) => p.semOrigem, 1);

  const linhas: LinhaPontual[] = [
    mk("pontual_estoque_ini", "(=) Estoque inicial", "estoque", serieEstoqueIni, ponte[1]?.estoqueIni ?? null),
    mk("pontual_venda", "(+) Venda", "fluxo", serieVenda, sumYtd(serieVenda), { nota: NOTA_VENDA }),
    mk("pontual_venda_mes", "· Venda do mês", "fluxo", serieVendaMes, sumYtd(serieVendaMes), { nota: NOTA_VENDA_MES }),
    mk("pontual_entrada_defasada", "· Entrada defasada", "fluxo", serieDefasada, sumYtd(serieDefasada), { nota: NOTA_DEFASADA }),
    mk("pontual_reativacao", "· Reativação", "fluxo", serieReativacao, sumYtd(serieReativacao), { nota: NOTA_REATIVACAO }),
  ];
  if (serieSemOrigem.some((v) => v !== null && Math.abs(v) > 0.5)) {
    linhas.push(mk("pontual_sem_origem", "· Sem origem", "fluxo", serieSemOrigem, sumYtd(serieSemOrigem), { nota: NOTA_SEM_ORIGEM }));
  }
  linhas.push(
    mk("pontual_entrega", "(−) Entrega", "fluxo", serieFluxo((p) => p.entrega, -1), sumYtd(serieFluxo((p) => p.entrega, -1))),
    mk("pontual_churn", "(−) Churn", "fluxo", serieFluxo((p) => p.churn, -1), sumYtd(serieFluxo((p) => p.churn, -1))),
    mk("pontual_deletados", "(−) Deletados", "fluxo", serieFluxo((p) => p.deletados, -1), sumYtd(serieFluxo((p) => p.deletados, -1))),
    mk("pontual_saida_atipica", "(−) Saída atípica", "fluxo", serieFluxo((p) => p.saidaAtipica, -1), sumYtd(serieFluxo((p) => p.saidaAtipica, -1))),
    mk("pontual_reajuste", "(±) Reajuste de valor", "fluxo", serieFluxo((p) => p.reajuste, 1), sumYtd(serieFluxo((p) => p.reajuste, 1))),
    mk("pontual_estoque_fim", "(=) Estoque final", "estoque", serieEstoqueFim, mesFechado === 0 ? null : ponte[mesFechado]?.estoqueFim ?? null, { destaque: true }),
  );
```

Atualizar a constante `NOTA_VENDA` e adicionar as novas notas (junto ao `NOTA_VENDA` existente):

```typescript
const NOTA_VENDA =
  "Venda = entrada no estoque (snapshot do ClickUp), medida por diferença de snapshots — " +
  "não é a venda comercial da Visão Geral. Decomposta abaixo pelo motivo da entrada.";
const NOTA_VENDA_MES =
  "Contratos com data de criação (cup_contratos) no próprio mês — a venda real do período.";
const NOTA_DEFASADA =
  "Contratos criados em meses anteriores que só agora apareceram no snapshot (a foto do estoque atrasa ~1 mês).";
const NOTA_REATIVACAO =
  "Contratos que estavam como entregue/cancelado e voltaram ao estoque.";
const NOTA_SEM_ORIGEM =
  "Contratos presentes no snapshot mas sem registro atual em cup_contratos (órfãos).";
```

- [ ] **Step 5: Rodar os testes e verificar que passam**

Run: `npx vitest run server/routes/bp2026.pontual.helpers.test.ts`
Expected: PASS (todos os `describe`, incluindo sub-categorias e ordem das sub-linhas).

- [ ] **Step 6: Commit**

```bash
git add server/routes/bp2026.pontual.helpers.ts server/routes/bp2026.pontual.helpers.test.ts
git commit -m "feat(bp2026): decompor soma da Venda do estoque pontual em venda do mês/defasada/reativação/sem origem

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Query traz `data_criado` (montarPontual)

**Files:**
- Modify: `server/routes/bp2026.pontual.ts`

**Interfaces:**
- Consumes: `montarLinhasPontual`, `RegPontual` (com `criadoYm`) da Task 1.
- Produces: `porMes[m]` agora com `criadoYm` preenchido.

- [ ] **Step 1: Adicionar `data_criado` ao SQL e ao `RegPontual`**

Na query de `montarPontual`, fazer `LEFT JOIN cup_contratos` por `id_subtask` e selecionar `to_char(c.data_criado,'YYYY-MM')`. Substituir o `SELECT ... FROM alvo a JOIN ...` por:

```typescript
    SELECT a.mes, h.id_subtask, h.valorp::numeric AS valorp, h.status,
           to_char(c.data_criado, 'YYYY-MM') AS criado_ym
    FROM alvo a
    JOIN "Clickup".cup_data_hist h ON h.data_snapshot::date = a.d
    LEFT JOIN "Clickup".cup_contratos c ON c.id_subtask = h.id_subtask
    WHERE h.valorp::numeric > 0
    ORDER BY a.mes
```

No loop que monta `porMes`, preencher `criadoYm`:

```typescript
    (porMes[mes] ??= []).push({
      idSubtask: String(row.id_subtask),
      valorp: parseFloat(row.valorp),
      status: row.status,
      criadoYm: row.criado_ym ?? null,
    });
```

- [ ] **Step 2: Verificar que o helper-test continua verde (regressão)**

Run: `npx vitest run server/routes/bp2026.pontual.helpers.test.ts`
Expected: PASS (a Task 2 não altera o helper; só confirma que nada quebrou).

- [ ] **Step 3: Conferir os números contra a auditoria do spec (psql)**

Rodar a query de controle (replica a classificação) em produção e comparar com a tabela do spec. As credenciais saem do `.env`:

```bash
cd /Users/mac0267/Cortex/.claude/worktrees/feature+bp2026-pontual-decompor-venda
PROD_PASS=$(grep -E "^# *DB_PASSWORD=" .env | head -1 | sed -E 's/^# *DB_PASSWORD=//' | tr -d '"'"'"' \r')
PGPASSWORD="$PROD_PASS" psql -h 34.95.249.110 -U postgres -d dados_turbo -P pager=off <<'SQL'
WITH alvo AS (
  SELECT gs.mes, MAX(h.data_snapshot::date) AS d
  FROM generate_series(0,12) AS gs(mes)
  JOIN "Clickup".cup_data_hist h
    ON h.data_snapshot::date >= (make_date(2025,12,1) + (gs.mes||' months')::interval)::date
   AND h.data_snapshot::date <  (make_date(2025,12,1) + ((gs.mes+1)||' months')::interval)::date
  GROUP BY gs.mes
),
snap AS (
  SELECT a.mes, h.id_subtask, h.valorp::numeric AS valorp, h.status,
         to_char(c.data_criado,'YYYY-MM') AS criado_ym
  FROM alvo a JOIN "Clickup".cup_data_hist h ON h.data_snapshot::date = a.d
  LEFT JOIN "Clickup".cup_contratos c ON c.id_subtask = h.id_subtask
  WHERE h.valorp::numeric > 0
),
est AS (SELECT * FROM snap WHERE status NOT IN ('entregue','cancelado/inativo','não usar')),
venda AS (
  SELECT e.mes, e.valorp, e.criado_ym, (p2.id_subtask IS NOT NULL) AS reativa
  FROM est e
  LEFT JOIN est  p  ON p.id_subtask  = e.id_subtask AND p.mes  = e.mes-1
  LEFT JOIN snap p2 ON p2.id_subtask = e.id_subtask AND p2.mes = e.mes-1
  WHERE p.id_subtask IS NULL
)
SELECT mes,
  ROUND(SUM(valorp)) AS venda_total,
  ROUND(SUM(valorp) FILTER (WHERE NOT reativa AND criado_ym = to_char(make_date(2026,mes,1),'YYYY-MM'))) AS venda_do_mes,
  ROUND(SUM(valorp) FILTER (WHERE NOT reativa AND criado_ym IS NOT NULL AND criado_ym <> to_char(make_date(2026,mes,1),'YYYY-MM'))) AS defasada,
  ROUND(SUM(valorp) FILTER (WHERE reativa)) AS reativacao,
  ROUND(SUM(valorp) FILTER (WHERE NOT reativa AND criado_ym IS NULL)) AS sem_origem
FROM venda WHERE mes BETWEEN 1 AND 6 GROUP BY mes ORDER BY mes;
SQL
```

Expected (deve casar com o spec, ex.: abr venda_total≈1.103.483, venda_do_mes≈514.240, defasada≈562.043, reativacao≈8.000, sem_origem≈19.200).

- [ ] **Step 4: Commit**

```bash
git add server/routes/bp2026.pontual.ts
git commit -m "feat(bp2026): trazer data_criado no snapshot do estoque pontual (classifica venda do mês x defasada)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Drill por sub-categoria (classificarPonteItens + detalhe.ts)

**Files:**
- Modify: `server/routes/bp2026.pontual.helpers.ts`
- Modify: `server/routes/bp2026.detalhe.ts`
- Test: `server/routes/bp2026.pontual.helpers.test.ts`

**Interfaces:**
- Consumes: `RegPontualItem` (estende `RegPontual`, já com `criadoYm`), `classificarPonteItens`.
- Produces:
  - `type CategoriaPonte = "venda_mes" | "entrada_defasada" | "reativacao" | "sem_origem" | "entrega" | "churn" | "deletados" | "saida_atipica" | "reajuste"`
  - `classificarPonteItens(ant: RegPontualItem[], atual: RegPontualItem[], ymAlvo: string): Record<CategoriaPonte, ItemPonte[]>`
  - `SUBCATS_VENDA: CategoriaPonte[]` (em `detalhe.ts`)

- [ ] **Step 1: Atualizar os testes de `classificarPonteItens`**

Substituir o `describe("classificarPonteItens", ...)`. Os fixtures ganham `criadoYm` e a chamada recebe `ymAlvo`; `F` é "venda do mês".

```typescript
describe("classificarPonteItens", () => {
  const antI = [
    { idSubtask: "A", valorp: 1000, status: "ativo", cliente: "Cli A", criadoYm: "2025-12" },
    { idSubtask: "B", valorp: 500, status: "triagem", cliente: "Cli B", criadoYm: "2025-12" },
    { idSubtask: "C", valorp: 300, status: "pausado", cliente: "Cli C", criadoYm: "2025-12" },
    { idSubtask: "D", valorp: 200, status: "ativo", cliente: "Cli D", criadoYm: "2025-12" },
    { idSubtask: "E", valorp: 100, status: "entregue", cliente: "Cli E", criadoYm: "2025-12" },
    { idSubtask: "G", valorp: 150, status: "ativo", cliente: "Cli G", criadoYm: "2025-12" },
    { idSubtask: "R", valorp: 250, status: "entregue", cliente: "Cli R", criadoYm: "2025-10" }, // reativa
  ];
  const atualI = [
    { idSubtask: "A", valorp: 1100, status: "ativo", cliente: "Cli A", criadoYm: "2025-12" },
    { idSubtask: "B", valorp: 500, status: "entregue", cliente: "Cli B", criadoYm: "2025-12" },
    { idSubtask: "C", valorp: 300, status: "cancelado/inativo", cliente: "Cli C", criadoYm: "2025-12" },
    { idSubtask: "G", valorp: 0, status: "ativo", cliente: "Cli G", criadoYm: "2025-12" },
    { idSubtask: "F", valorp: 700, status: "triagem", cliente: "Cli F", criadoYm: "2026-03" }, // venda do mês
    { idSubtask: "X", valorp: 400, status: "ativo", cliente: "Cli X", criadoYm: "2026-01" },   // defasada
    { idSubtask: "Y", valorp: 120, status: "ativo", cliente: "Cli Y", criadoYm: null },        // sem origem
    { idSubtask: "R", valorp: 250, status: "ativo", cliente: "Cli R", criadoYm: "2025-10" },   // reativação
  ];
  const out = classificarPonteItens(antI, atualI, "2026-03");
  it("lista os contratos de cada sub-categoria da venda", () => {
    expect(out.venda_mes.map((i) => i.idSubtask)).toEqual(["F"]);
    expect(out.entrada_defasada.map((i) => i.idSubtask)).toEqual(["X"]);
    expect(out.sem_origem.map((i) => i.idSubtask)).toEqual(["Y"]);
    expect(out.reativacao.map((i) => i.idSubtask)).toEqual(["R"]);
    expect(out.entrega.map((i) => i.idSubtask)).toEqual(["B"]);
    expect(out.churn.map((i) => i.idSubtask)).toEqual(["C"]);
    expect(out.deletados.map((i) => i.idSubtask)).toEqual(["D"]);
    expect(out.saida_atipica.map((i) => i.idSubtask)).toEqual(["G"]);
    expect(out.reajuste.map((i) => i.idSubtask)).toEqual(["A"]);
  });
  it("soma dos itens por sub-categoria casa com a classificação", () => {
    const sum = (a: { valor: number }[]) => a.reduce((s, i) => s + i.valor, 0);
    expect(sum(out.venda_mes)).toBe(700);
    expect(sum(out.entrada_defasada)).toBe(400);
    expect(sum(out.sem_origem)).toBe(120);
    expect(sum(out.reativacao)).toBe(250);
    expect(sum(out.reajuste)).toBe(100);
  });
});
```

- [ ] **Step 2: Rodar e verificar que falham**

Run: `npx vitest run server/routes/bp2026.pontual.helpers.test.ts`
Expected: FAIL (`out.venda_mes` indefinido; `classificarPonteItens` espera 2 args).

- [ ] **Step 3: Atualizar `CategoriaPonte` e `classificarPonteItens` no helper**

Trocar o tipo `CategoriaPonte`:

```typescript
export type CategoriaPonte =
  | "venda_mes" | "entrada_defasada" | "reativacao" | "sem_origem"
  | "entrega" | "churn" | "deletados" | "saida_atipica" | "reajuste";
```

Reescrever o 2º loop de `classificarPonteItens` (entradas) e o `out` inicial. O 1º loop (saídas/reajuste) é idêntico ao atual:

```typescript
export function classificarPonteItens(
  ant: RegPontualItem[],
  atual: RegPontualItem[],
  ymAlvo: string,
): Record<CategoriaPonte, ItemPonte[]> {
  const antMap = new Map(ant.map((r) => [r.idSubtask, r]));
  const atualMap = new Map(atual.map((r) => [r.idSubtask, r]));
  const out: Record<CategoriaPonte, ItemPonte[]> = {
    venda_mes: [], entrada_defasada: [], reativacao: [], sem_origem: [],
    entrega: [], churn: [], deletados: [], saida_atipica: [], reajuste: [],
  };
  for (const r of ant) {
    if (!ehEstoquePontual(r)) continue;
    const a = atualMap.get(r.idSubtask);
    if (!a) { out.deletados.push({ idSubtask: r.idSubtask, cliente: r.cliente, status: r.status, valor: r.valorp, detalhe: "sumiu do snapshot" }); continue; }
    if (ehEstoquePontual(a)) {
      const delta = a.valorp - r.valorp;
      if (delta !== 0) out.reajuste.push({ idSubtask: r.idSubtask, cliente: r.cliente, status: a.status, valor: delta, detalhe: `${brl(r.valorp)} → ${brl(a.valorp)}` });
      continue;
    }
    if (a.status === "entregue") out.entrega.push({ idSubtask: r.idSubtask, cliente: r.cliente, status: a.status, valor: r.valorp, detalhe: "" });
    else if (CHURN_STATUS.has(a.status)) out.churn.push({ idSubtask: r.idSubtask, cliente: r.cliente, status: a.status, valor: r.valorp, detalhe: "" });
    else out.saida_atipica.push({ idSubtask: r.idSubtask, cliente: r.cliente, status: a.status, valor: r.valorp, detalhe: `valorp ${brl(a.valorp)}` });
  }
  for (const r of atual) {
    if (!ehEstoquePontual(r)) continue;
    const prev = antMap.get(r.idSubtask);
    if (prev && ehEstoquePontual(prev)) continue;
    const base = { idSubtask: r.idSubtask, cliente: r.cliente, status: r.status, valor: r.valorp };
    if (prev) out.reativacao.push({ ...base, detalhe: `voltou de ${prev.status}` });
    else if (!r.criadoYm) out.sem_origem.push({ ...base, detalhe: "sem registro em cup_contratos" });
    else if (r.criadoYm === ymAlvo) out.venda_mes.push({ ...base, detalhe: "" });
    else out.entrada_defasada.push({ ...base, detalhe: `criado em ${r.criadoYm}` });
  }
  return out;
}
```

- [ ] **Step 4: Rodar e verificar que passam**

Run: `npx vitest run server/routes/bp2026.pontual.helpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Atualizar `detalhe.ts` — `carregaPontualSnapshot` traz `criadoYm`**

No `SELECT` de `carregaPontualSnapshot`, adicionar `data_criado`:

```typescript
    SELECT h.id_subtask, h.valorp::numeric AS valorp, h.status,
           to_char(c.data_criado, 'YYYY-MM') AS criado_ym,
           COALESCE(NULLIF(TRIM(cl.nome), ''), '(sem cliente)') AS cliente,
           COALESCE(NULLIF(TRIM(h.squad), ''), '(sem squad)') AS squad
    FROM "Clickup".cup_data_hist h JOIN alvo a ON h.data_snapshot::date = a.d
    LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = h.id_task
    LEFT JOIN "Clickup".cup_contratos c ON c.id_subtask = h.id_subtask
    WHERE h.valorp::numeric > 0
```

E no `map`:

```typescript
  return (result.rows as any[]).map((r) => ({
    idSubtask: String(r.id_subtask), valorp: parseFloat(r.valorp), status: r.status,
    criadoYm: r.criado_ym ?? null,
    cliente: r.cliente, squad: r.squad,
  }));
```

- [ ] **Step 6: Atualizar `TITULO_CATEGORIA`, `detPontualMovimento`, rótulos e roteamento em `detalhe.ts`**

Substituir o `TITULO_CATEGORIA` (linha ~337):

```typescript
const TITULO_CATEGORIA: Record<CategoriaPonte, string> = {
  venda_mes: "Venda do mês (data de criação)",
  entrada_defasada: "Entrada defasada (vendas anteriores)",
  reativacao: "Reativações (voltaram ao estoque)",
  sem_origem: "Sem origem (órfãos do snapshot)",
  entrega: "Saídas por entrega", churn: "Saídas por churn",
  deletados: "Deletados do ClickUp", saida_atipica: "Saídas atípicas", reajuste: "Reajustes de valor",
};

const SUBCATS_VENDA: CategoriaPonte[] = ["venda_mes", "entrada_defasada", "reativacao", "sem_origem"];
```

Reescrever `detPontualMovimento` para aceitar uma ou várias categorias e passar `ymAlvo`:

```typescript
async function detPontualMovimento(
  db: any, mes: number, categorias: CategoriaPonte | CategoriaPonte[],
): Promise<ResultadoDet> {
  const cats = Array.isArray(categorias) ? categorias : [categorias];
  const ymAlvo = `${ANO}-${String(mes).padStart(2, "0")}`;
  const [ant, atual] = await Promise.all([
    carregaPontualSnapshot(db, mes, true), carregaPontualSnapshot(db, mes, false),
  ]);
  const rec = classificarPonteItens(ant, atual, ymAlvo);
  const itens: ItemDetalhe[] = [];
  for (const cat of cats) {
    for (const it of rec[cat]) {
      itens.push({
        grupo: TITULO_CATEGORIA[cat], nome: it.cliente,
        detalhe: [it.detalhe, `status ${it.status}`].filter(Boolean).join(" · "),
        data: null, valor: it.valor,
      });
    }
  }
  return { grupos: agruparItens(itens, LIMITE_ITENS), realizado: itens.reduce((s, i) => s + i.valor, 0) };
}
```

Adicionar os rótulos das novas linhas em `TITULOS_SUBABAS` (junto às chaves `pontual_*`, linha ~261). Substituir a linha do `pontual_venda` por:

```typescript
  pontual_estoque_ini: "(=) Estoque inicial", pontual_venda: "(+) Venda",
  pontual_venda_mes: "· Venda do mês", pontual_entrada_defasada: "· Entrada defasada",
  pontual_reativacao: "· Reativação", pontual_sem_origem: "· Sem origem",
```

Atualizar o roteamento do drill (linha ~656). Substituir o `else if (["pontual_venda", ...])` por dois ramos:

```typescript
      } else if (metrica === "pontual_venda") {
        ({ grupos, realizado } = await detPontualMovimento(db, mes, SUBCATS_VENDA));
      } else if ([
        "pontual_venda_mes", "pontual_entrada_defasada", "pontual_reativacao", "pontual_sem_origem",
        "pontual_entrega", "pontual_churn", "pontual_deletados", "pontual_saida_atipica", "pontual_reajuste",
      ].includes(metrica)) {
        ({ grupos, realizado } = await detPontualMovimento(db, mes, metrica.slice("pontual_".length) as CategoriaPonte));
      } else if (metrica === "or_receita_variavel" || metrica === "or_stack_digital" || metrica === "or_demais") {
```

- [ ] **Step 7: Verificar build TS dos arquivos de rota**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "bp2026\.(detalhe|pontual)" || echo "sem erros nos arquivos pontual/detalhe"`
Expected: `sem erros nos arquivos pontual/detalhe`.

- [ ] **Step 8: Commit**

```bash
git add server/routes/bp2026.pontual.helpers.ts server/routes/bp2026.pontual.helpers.test.ts server/routes/bp2026.detalhe.ts
git commit -m "feat(bp2026): drill por sub-categoria da Venda do estoque pontual

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Verificação visual e nota de rodapé

**Files:**
- Verify: `client/src/components/bp2026/BPDreTable.tsx` (esperado: sem mudança)
- Modify (se necessário): `client/src/pages/BP2026.tsx` (nota de rodapé da aba pontual)

**Interfaces:**
- Consumes: payload `data.pontual` com as novas linhas/sub-linhas.

- [ ] **Step 1: Subir o dev server**

```bash
cd /Users/mac0267/Cortex/.claude/worktrees/feature+bp2026-pontual-decompor-venda
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev
```

(Se a tela ficar branca após restarts: `rm -rf node_modules/.vite` e subir de novo — ver memória do projeto.)

- [ ] **Step 2: Conferir a aba Pontual no browser**

Abrir `http://localhost:3000` → BP 2026 → Orçado × Realizado → aba **Pontual**. Verificar:
- Sob "(+) Venda" aparecem "· Venda do mês", "· Entrada defasada", "· Reativação" (e "· Sem origem" nos meses com valor — mar/abr/mai).
- As 3–4 sub-linhas somam exatamente o valor de "(+) Venda" em cada mês.
- Abril: "· Entrada defasada" ≈ 562k (a maior parte do pico de 1,1M).
- Clicar em "(+) Venda" abre o drill com os 4 grupos; clicar numa sub-linha abre só o grupo correspondente.
- Conferir **dark mode e light mode** (toggle de tema): indentação e legibilidade OK.

- [ ] **Step 3: Atualizar a nota de rodapé da aba pontual (se houver texto desatualizado)**

Em `client/src/pages/BP2026.tsx`, na `TabsContent value="pontual"`, conferir se há legenda explicando a "Venda". Se existir e não mencionar a decomposição, ajustar para algo como: *"Venda = entrada no estoque (snapshot), decomposta por motivo. Não é a venda comercial da Visão Geral."* Se não houver legenda específica, pular este step (a nota por linha já cobre via tooltip).

- [ ] **Step 4: Rodar a suíte de testes completa (regressão geral)**

Run: `npm test`
Expected: PASS (sem regressões; em especial `bp2026.pontual.helpers.test.ts` e `bp2026.*`).

- [ ] **Step 5: Commit (se houve mudança no front)**

```bash
git add client/src/pages/BP2026.tsx
git commit -m "feat(bp2026): nota da aba pontual reflete decomposição da Venda

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

(Se nenhum arquivo de front mudou, registrar no relatório que a Task 4 foi só verificação visual — sem commit.)

---

## Self-Review (preenchido pelo autor do plano)

**Spec coverage:**
- Decompor entrada da foto (manter régua) → Task 1 (`classificarPonte`) + Task 2 (query). ✓
- Layout linha-mãe + sub-linhas `·` → Task 1 (`montarLinhasPontual`) + Task 4 (visual). ✓
- "Sem origem" em bucket próprio → Task 1 (linha condicional) + Task 3 (drill/rótulo). ✓
- Árvore de decisão com precedência da reativação → Task 1 e Task 3 (testes de precedência). ✓
- `data_criado` de `cup_contratos` (não do snapshot) → Task 2 e Task 3 (joins). ✓
- Drill por sub-categoria → Task 3. ✓
- Frontend sem mudança esperada → Task 4 (verificação). ✓
- Testes (soma=total, ponte fecha, soma dos itens casa, precedência) → Tasks 1 e 3. ✓

**Placeholder scan:** sem TBD/TODO; todo step tem código ou comando concreto.

**Type consistency:** `criadoYm?: string | null` (RegPontual) usado em pontual.ts/detalhe.ts; `CategoriaPonte` com as 9 chaves usado em `classificarPonteItens`, `TITULO_CATEGORIA`, `SUBCATS_VENDA` e roteamento; `classificarPonte`/`classificarPonteItens` ambos com 3º arg `ymAlvo: string` em todos os chamadores (montarLinhasPontual, detPontualMovimento) e testes.
