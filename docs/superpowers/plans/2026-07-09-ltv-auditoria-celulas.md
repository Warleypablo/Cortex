# Auditoria das células de LTV — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O drill das células `ltv_fat`/`ltv_dfc` audita o mês clicado: header = mediana da célula (reconciliada por construção), 3 grupos (acima/mediana/abaixo) com TODOS os clientes e a conta aberta no subtexto de cada um.

**Architecture:** Query única de auditoria por mês (validada em prod, 0,5s; ref. `docs/superpowers/specs/2026-07-09-ltv-auditoria-query.sql`) alimenta um helper puro `ltvAuditoriaToGrupos` (partição/mediana/textos — TDD). O endpoint monta os grupos e seta `realizado = mediana`. Frontend: só o campo novo `aberto?` por grupo. Spec: `docs/superpowers/specs/2026-07-09-ltv-auditoria-celulas-design.md`.

**Tech Stack:** Express + drizzle, PostgreSQL, vitest.

## Global Constraints

- **Escape drizzle:** `'\\D'` dentro de `` sql`...` `` (NUNCA `'\D'`).
- **`AS MATERIALIZED`** em todos os CTEs da query de auditoria (exceto `alvo` e `linhas`).
- `tipo_evento` MAIÚSCULO `'RECEITA'`; status minúsculo por igualdade/`IN`; `LENGTH IN (11, 14)` nos DOIS lados do match CNPJ.
- Cutoffs: teórico capado em `DATE '2025-09-30'`; real/pont_pre com `DATE '2025-10-01'`; pago até `< make_date(2026, mesNum, 1)`. Pago SEM filtro `status='QUITADO'` (decisão documentada no spec do LTV FAT×DFC).
- Reconciliação: mediana do helper (N par = média dos 2 centrais, `Math.round`) deve bater com a célula da matriz (jun: FAT 22.240 / DFC 23.488, N=213 em prod).
- Commits: Conventional Commits + `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`; direto na `main`.
- **Subagentes: NÃO `npm run dev`, NÃO matar porta 3000, NÃO `git stash`/`amend`/`rebase`/`push`.** Validar com `npx vitest run <arquivo>` e `npm run check 2>&1 | grep "ceoDashboard\|CeoKpi"; true` (zero linhas).

---

### Task 1: Helper `ltvAuditoriaToGrupos` + campo `aberto` (TDD)

**Files:**
- Modify: `server/routes/ceoDashboard.detalhe.helpers.ts` (adicionar bloco no fim; estender `CeoGrupo`)
- Modify: `client/src/components/ceo/CeoKpiDetail.tsx` (~L12 e ~L41: campo `aberto`)
- Test: `server/routes/ceoDashboard.detalhe.helpers.test.ts` (adicionar describe novo no fim)

**Interfaces:**
- Consumes: `CeoGrupo` existente (`{ titulo, total, formato, itens: Array<{nome, detalhe, data, valor}> }`).
- Produces (Task 2 usa): `CeoGrupo.aberto?: boolean`; `export interface LtvAuditoriaRow { nome: string; tem_match: boolean; valorr_snap: number; n_rec_snap: number; inicio_rec: string | null; rec_full: number; rec_pre: number; pont_full: number; pont_pre: number; pago: number; n_parcelas: number; ltv_fat: number; ltv_dfc: number }`; `export function ltvAuditoriaToGrupos(rows: LtvAuditoriaRow[], kpi: "ltv_fat" | "ltv_dfc", mesNum: number): { grupos: CeoGrupo[]; mediana: number | null; nSemMatch: number }`; `export function ultimoDiaAnterior(mesNum: number): string` (ex.: mes 6 → `"31/05"`; mes 1 → `"31/12"`).

- [ ] **Step 1: Escrever os testes (failing)**

Adicionar ao FINAL de `server/routes/ceoDashboard.detalhe.helpers.test.ts`:

```typescript
describe("ltvAuditoriaToGrupos", () => {
  const row = (over: Partial<LtvAuditoriaRow>): LtvAuditoriaRow => ({
    nome: "Cliente", tem_match: true, valorr_snap: 5000, n_rec_snap: 1,
    inicio_rec: "2025-07-30", rec_full: 50000, rec_pre: 10000,
    pont_full: 0, pont_pre: 0, pago: 40000, n_parcelas: 8,
    ltv_fat: 50000, ltv_dfc: 50000, ...over,
  });

  it("N ímpar: mediana = valor central; grupos particionam todos os clientes", () => {
    const rows = [row({ nome: "A", ltv_fat: 30000 }), row({ nome: "B", ltv_fat: 20000 }), row({ nome: "C", ltv_fat: 10000 })];
    const r = ltvAuditoriaToGrupos(rows, "ltv_fat", 6);
    expect(r.mediana).toBe(20000);
    expect(r.grupos.map((g) => g.titulo)).toEqual(["Acima da mediana (1)", "Mediana", "Abaixo da mediana (1)"]);
    expect(r.grupos[1].itens[0].nome).toBe("B");
    expect(r.grupos[1].aberto).toBe(true);
    expect(r.grupos[0].aberto).toBe(false);
    expect(r.grupos[0].total).toBe(30000);
    const totalItens = r.grupos.reduce((s, g) => s + g.itens.length, 0);
    expect(totalItens).toBe(3); // todos os clientes aparecem, sem corte
  });

  it("N par: mediana = média dos 2 centrais; grupo Mediana tem os 2", () => {
    const rows = [row({ ltv_dfc: 40000 }), row({ ltv_dfc: 30000 }), row({ ltv_dfc: 20000 }), row({ ltv_dfc: 10000 })];
    const r = ltvAuditoriaToGrupos(rows, "ltv_dfc", 6);
    expect(r.mediana).toBe(25000);
    expect(r.grupos[1].itens).toHaveLength(2);
    expect(r.grupos[1].itens.map((i) => i.valor)).toEqual([30000, 20000]);
  });

  it("rows vazio: sem grupos, mediana null", () => {
    expect(ltvAuditoriaToGrupos([], "ltv_fat", 6)).toEqual({ grupos: [], mediana: null, nSemMatch: 0 });
  });

  it("FAT: detalhe decompõe recorrente (single e multi contrato) e pontual", () => {
    const single = ltvAuditoriaToGrupos([row({ rec_full: 70300, ltv_fat: 73300, pont_full: 3000 })], "ltv_fat", 6);
    expect(single.grupos[0].itens[0].detalhe).toBe("recorrente R$ 70,3k (R$ 5.000/mês desde 30/07/25) + pontual entregue R$ 3,0k");
    const multi = ltvAuditoriaToGrupos([row({ n_rec_snap: 2, valorr_snap: 7200, pont_full: 0 })], "ltv_fat", 6);
    expect(multi.grupos[0].itens[0].detalhe).toBe("recorrente R$ 50,0k (2 contratos, R$ 7.200/mês)");
  });

  it("DFC: match com teórico+pago; nascido pós-corte só pago; pago zero; sem match → faturável", () => {
    const cheio = ltvAuditoriaToGrupos([row({ rec_pre: 28100, pont_pre: 0, pago: 35200, n_parcelas: 18 })], "ltv_dfc", 6);
    expect(cheio.grupos[0].itens[0].detalhe).toBe("teórico pré-out/25 R$ 28,1k + pago real R$ 35,2k (18 parcelas até 31/05)");
    const novo = ltvAuditoriaToGrupos([row({ rec_pre: 0, pont_pre: 0, pago: 14100, n_parcelas: 9 })], "ltv_dfc", 7);
    expect(novo.grupos[0].itens[0].detalhe).toBe("pago real R$ 14,1k (9 parcelas até 30/06)");
    const zero = ltvAuditoriaToGrupos([row({ rec_pre: 0, pont_pre: 0, pago: 0, n_parcelas: 0 })], "ltv_dfc", 6);
    expect(zero.grupos[0].itens[0].detalhe).toBe("sem pagamento registrado até 31/05");
    const sem = ltvAuditoriaToGrupos([row({ tem_match: false, rec_full: 30500, pont_full: 0 })], "ltv_dfc", 6);
    expect(sem.grupos[0].itens[0].detalhe).toBe("sem match CNPJ → régua faturável: recorrente R$ 30,5k");
    expect(sem.nSemMatch).toBe(1);
  });

  it("ultimoDiaAnterior cobre viradas de mês", () => {
    expect(ultimoDiaAnterior(1)).toBe("31/12");
    expect(ultimoDiaAnterior(3)).toBe("28/02");
    expect(ultimoDiaAnterior(7)).toBe("30/06");
  });
});
```

E adicionar ao import existente do topo do arquivo de teste: `ltvAuditoriaToGrupos, ultimoDiaAnterior, type LtvAuditoriaRow` (de `./ceoDashboard.detalhe.helpers`).

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run server/routes/ceoDashboard.detalhe.helpers.test.ts`
Expected: FAIL — exports inexistentes.

- [ ] **Step 3: Implementar o helper**

Em `server/routes/ceoDashboard.detalhe.helpers.ts`:

1. Estender `CeoGrupo` (interface existente no topo) com o campo:

```typescript
  aberto?: boolean; // controla o <details> do drawer; ausente = regra padrão do front
```

2. Adicionar ao FINAL do arquivo:

```typescript
// ---- Auditoria das células de LTV (FAT/DFC) ----
// Uma linha por cliente ativo no snapshot do mês (query de auditoria mensal).
export interface LtvAuditoriaRow {
  nome: string;
  tem_match: boolean;
  valorr_snap: number;
  n_rec_snap: number;
  inicio_rec: string | null; // "YYYY-MM-DD"
  rec_full: number;
  rec_pre: number;
  pont_full: number;
  pont_pre: number;
  pago: number;
  n_parcelas: number;
  ltv_fat: number;
  ltv_dfc: number;
}

const fmtBrlCompacto = (v: number): string =>
  Math.abs(v) >= 1000
    ? `R$ ${(v / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`
    : `R$ ${Math.round(v).toLocaleString("pt-BR")}`;

const fmtPorMes = (v: number): string => `R$ ${Math.round(v).toLocaleString("pt-BR")}/mês`;

const fmtDataCurta = (iso: string | null): string | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : null;
};

// Último dia do mês ANTERIOR à célula (o pago real conta até a ENTRADA do mês).
export function ultimoDiaAnterior(mesNum: number): string {
  const d = new Date(2026, mesNum - 1, 0); // dia 0 = último dia do mês anterior
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function detalheFat(r: LtvAuditoriaRow): string {
  const desde = fmtDataCurta(r.inicio_rec);
  const ctx = r.n_rec_snap > 1
    ? ` (${r.n_rec_snap} contratos, ${fmtPorMes(r.valorr_snap)})`
    : desde ? ` (${fmtPorMes(r.valorr_snap)} desde ${desde})` : ` (${fmtPorMes(r.valorr_snap)})`;
  const rec = `recorrente ${fmtBrlCompacto(r.rec_full)}${ctx}`;
  return r.pont_full > 0 ? `${rec} + pontual entregue ${fmtBrlCompacto(r.pont_full)}` : rec;
}

function detalheDfc(r: LtvAuditoriaRow, ateDia: string): string {
  if (!r.tem_match) {
    const pont = r.pont_full > 0 ? ` + pontual ${fmtBrlCompacto(r.pont_full)}` : "";
    return `sem match CNPJ → régua faturável: recorrente ${fmtBrlCompacto(r.rec_full)}${pont}`;
  }
  const teorico = r.rec_pre + r.pont_pre;
  const pagoTxt = r.pago > 0
    ? `pago real ${fmtBrlCompacto(r.pago)} (${r.n_parcelas} parcela${r.n_parcelas === 1 ? "" : "s"} até ${ateDia})`
    : `sem pagamento registrado até ${ateDia}`;
  return teorico > 0 ? `teórico pré-out/25 ${fmtBrlCompacto(teorico)} + ${pagoTxt}` : pagoTxt;
}

// Particiona os clientes do mês em acima/mediana/abaixo e compõe a decomposição
// de cada um. A mediana daqui é a MESMA régua da célula (PERCENTILE_CONT 0.5 =
// valor central; N par = média dos 2 centrais) — reconciliação por construção.
export function ltvAuditoriaToGrupos(
  rows: LtvAuditoriaRow[],
  kpi: "ltv_fat" | "ltv_dfc",
  mesNum: number
): { grupos: CeoGrupo[]; mediana: number | null; nSemMatch: number } {
  const ateDia = ultimoDiaAnterior(mesNum);
  const valorDe = (r: LtvAuditoriaRow) => (kpi === "ltv_fat" ? r.ltv_fat : r.ltv_dfc);
  const ordenado = [...rows].sort((a, b) => valorDe(b) - valorDe(a));
  const n = ordenado.length;
  if (n === 0) return { grupos: [], mediana: null, nSemMatch: 0 };

  // Índices centrais na ordenação desc (mesmos da asc, por simetria do meio).
  const centrais = n % 2 === 1 ? [(n - 1) / 2] : [n / 2 - 1, n / 2];
  const mediana = Math.round(centrais.reduce((s, i) => s + valorDe(ordenado[i]), 0) / centrais.length);

  const toItem = (r: LtvAuditoriaRow) => ({
    nome: r.nome || "—",
    detalhe: kpi === "ltv_fat" ? detalheFat(r) : detalheDfc(r, ateDia),
    data: null,
    valor: Math.round(valorDe(r)),
  });
  const grupo = (titulo: string, slice: LtvAuditoriaRow[], aberto: boolean): CeoGrupo => ({
    titulo, formato: "brl", aberto,
    total: Math.round(slice.reduce((s, r) => s + valorDe(r), 0)),
    itens: slice.map(toItem),
  });

  const acima = ordenado.slice(0, centrais[0]);
  const meio = centrais.map((i) => ordenado[i]);
  const abaixo = ordenado.slice(centrais[centrais.length - 1] + 1);
  const grupos = [
    grupo(`Acima da mediana (${acima.length})`, acima, false),
    grupo("Mediana", meio, true),
    grupo(`Abaixo da mediana (${abaixo.length})`, abaixo, false),
  ].filter((g) => g.itens.length > 0);
  return { grupos, mediana, nSemMatch: rows.filter((r) => !r.tem_match).length };
}
```

- [ ] **Step 4: Front honra o campo `aberto`**

Em `client/src/components/ceo/CeoKpiDetail.tsx`:

1. Na interface `GrupoDet` (~L12), adicionar `aberto?: boolean`:

```typescript
interface GrupoDet { titulo: string; total: number; sinal?: "+" | "-"; formato: "brl" | "num"; itens: ItemDet[]; itensOmitidos?: { qtd: number; valor: number }; aberto?: boolean }
```

2. No `<details>` (~L41), trocar `open={data.grupos.length <= 4}` por:

```tsx
open={g.aberto ?? data.grupos.length <= 4}
```

- [ ] **Step 5: Rodar os testes e typecheck**

Run: `npx vitest run server/routes/ceoDashboard.detalhe.helpers.test.ts && npm run check 2>&1 | grep "ceoDashboard\|CeoKpi"; true`
Expected: vitest PASS (novos + antigos); grep sem linhas.

- [ ] **Step 6: Commit**

```bash
git add server/routes/ceoDashboard.detalhe.helpers.ts server/routes/ceoDashboard.detalhe.helpers.test.ts client/src/components/ceo/CeoKpiDetail.tsx
git commit -m "feat(ceo-dashboard): helper de auditoria de LTV (partição pela mediana + decomposição)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Endpoint — branches de auditoria do mês

**Files:**
- Modify: `server/routes/ceoDashboard.detalhe.ts` (import; substituir os DOIS branches `kpi === "ltv_fat"` e `kpi === "ltv_dfc"` por UM branch combinado)

**Interfaces:**
- Consumes: `ltvAuditoriaToGrupos`, `ultimoDiaAnterior`, `LtvAuditoriaRow` (Task 1); `mesNum` já disponível no escopo (`parseMesNum`).
- Produces: `GET /api/ceo-dashboard/detalhe?kpi=ltv_fat|ltv_dfc&mes=N` retorna `realizado` = mediana da célula do mês N e 3 grupos de auditoria.

- [ ] **Step 1: Atualizar import**

No import de `./ceoDashboard.detalhe.helpers` (topo do arquivo), adicionar: `ltvAuditoriaToGrupos, ultimoDiaAnterior, type LtvAuditoriaRow` — e REMOVER `ltvRowsToGrupos` se nenhum outro branch usar (verificar com grep; se ficou sem uso, remover também a função exportada do helpers? NÃO — remover só o import; a função exportada fica, outros consumidores podem existir. Verificar com `grep -rn "ltvRowsToGrupos" server/ client/`; se o único uso era os branches antigos, remover do import e deixar a função no helpers com os testes existentes).

- [ ] **Step 2: Substituir os dois branches por um**

Remover os blocos `} else if (kpi === "ltv_fat") { ... }` e `} else if (kpi === "ltv_dfc") { ... }` inteiros e no lugar inserir (o `} else if (kpi === "enps") {` continua sendo o próximo branch):

```typescript
  } else if (kpi === "ltv_fat" || kpi === "ltv_dfc") {
    // AUDITORIA do mês clicado: mesma população e régua da célula da matriz
    // (spec: docs/superpowers/specs/2026-07-09-ltv-auditoria-celulas-design.md).
    // MATERIALIZED obrigatório (mesmo racional da query da matriz).
    const rows: any = await db.execute(sql`
      WITH alvo AS (SELECT make_date(2026, ${mesNum}, 1) AS m),
      snap_ref AS MATERIALIZED (
        SELECT COALESCE(
          (SELECT data_snapshot FROM "Clickup".cup_data_hist, alvo WHERE data_snapshot = alvo.m LIMIT 1),
          (SELECT MIN(data_snapshot) FROM "Clickup".cup_data_hist, alvo WHERE date_trunc('month', data_snapshot) = alvo.m)
        ) AS snap
      ),
      ativos AS MATERIALIZED (
        SELECT h.id_task, MAX(sr.snap) AS snap,
          COALESCE(SUM(h.valorr) FILTER (WHERE h.status IN ('ativo','onboarding','triagem') AND h.valorr > 0), 0) AS valorr_snap,
          COUNT(*) FILTER (WHERE h.status IN ('ativo','onboarding','triagem') AND h.valorr > 0) AS n_rec_snap
        FROM snap_ref sr
        JOIN "Clickup".cup_data_hist h ON h.data_snapshot = sr.snap
        WHERE sr.snap IS NOT NULL
        GROUP BY h.id_task
        HAVING BOOL_OR(h.status IN ('ativo','onboarding','triagem') AND h.valorr > 0)
      ),
      click_norm AS MATERIALIZED (
        SELECT cl.task_id, regexp_replace(cl.cnpj::text, '\\D', '', 'g') AS cnpj_norm
        FROM "Clickup".cup_clientes cl
        WHERE LENGTH(regexp_replace(cl.cnpj::text, '\\D', '', 'g')) IN (11, 14)
      ),
      caz_norm AS MATERIALIZED (
        SELECT c.ids, regexp_replace(c.cnpj::text, '\\D', '', 'g') AS cnpj_norm
        FROM "Conta Azul".caz_clientes c
        WHERE LENGTH(regexp_replace(c.cnpj::text, '\\D', '', 'g')) IN (11, 14)
      ),
      caz_map AS MATERIALIZED (
        SELECT DISTINCT k.task_id, z.ids FROM click_norm k JOIN caz_norm z USING (cnpj_norm)
      ),
      match_task AS MATERIALIZED (SELECT DISTINCT task_id FROM caz_map),
      rec_stats AS MATERIALIZED (
        SELECT a.id_task,
          COALESCE(SUM(v.valorr * GREATEST((LEAST(COALESCE(v.data_fim, a.snap), a.snap) - v.data_inicio)::numeric, 0) / 30.44), 0) AS rec_full,
          COALESCE(SUM(v.valorr * GREATEST((LEAST(COALESCE(v.data_fim, DATE '2025-09-30'), DATE '2025-09-30') - v.data_inicio)::numeric, 0) / 30.44), 0) AS rec_pre,
          MIN(v.data_inicio) AS inicio_rec
        FROM ativos a
        LEFT JOIN cortex_core.vw_lt_contratos v
          ON v.id_task = a.id_task AND v.tipo_receita = 'recorrente' AND v.data_inicio IS NOT NULL
        GROUP BY a.id_task
      ),
      pont_stats AS MATERIALIZED (
        SELECT a.id_task,
          COALESCE(SUM(co.valorp) FILTER (WHERE COALESCE(co.data_entrega, co.data_criado) < a.snap), 0) AS pont_full,
          COALESCE(SUM(co.valorp) FILTER (WHERE COALESCE(co.data_entrega, co.data_criado) < DATE '2025-10-01'), 0) AS pont_pre
        FROM ativos a
        JOIN "Clickup".cup_contratos co
          ON co.id_task = a.id_task AND co.valorp > 0 AND (co.valorr IS NULL OR co.valorr = 0) AND co.status = 'entregue'
        GROUP BY a.id_task
      ),
      pago_stats AS MATERIALIZED (
        SELECT cm.task_id, SUM(pa.valor_pago) AS pago, COUNT(*) AS n_parcelas
        FROM caz_map cm
        JOIN "Conta Azul".caz_parcelas pa ON pa.id_cliente::text = cm.ids
        CROSS JOIN alvo
        WHERE pa.tipo_evento = 'RECEITA'
          AND pa.data_quitacao >= DATE '2025-10-01'
          AND pa.data_quitacao::date < alvo.m
        GROUP BY cm.task_id
      )
      SELECT a.id_task,
        COALESCE(c.nome, a.id_task) AS nome,
        mt.task_id IS NOT NULL AS tem_match,
        a.valorr_snap, a.n_rec_snap, r.inicio_rec,
        ROUND(r.rec_full, 2) AS rec_full,
        ROUND(r.rec_pre, 2) AS rec_pre,
        COALESCE(p.pont_full, 0) AS pont_full,
        COALESCE(p.pont_pre, 0) AS pont_pre,
        COALESCE(pg.pago, 0) AS pago,
        COALESCE(pg.n_parcelas, 0) AS n_parcelas,
        ROUND(r.rec_full + COALESCE(p.pont_full, 0), 2) AS ltv_fat,
        ROUND(CASE WHEN mt.task_id IS NOT NULL
          THEN r.rec_pre + COALESCE(p.pont_pre, 0) + COALESCE(pg.pago, 0)
          ELSE r.rec_full + COALESCE(p.pont_full, 0) END, 2) AS ltv_dfc
      FROM ativos a
      LEFT JOIN "Clickup".cup_clientes c ON c.task_id = a.id_task
      LEFT JOIN match_task mt ON mt.task_id = a.id_task
      LEFT JOIN rec_stats r ON r.id_task = a.id_task
      LEFT JOIN pont_stats p ON p.id_task = a.id_task
      LEFT JOIN pago_stats pg ON pg.task_id = a.id_task`);
    const parsed: LtvAuditoriaRow[] = (rows.rows ?? []).map((x: any) => ({
      nome: String(x.nome ?? "—"),
      tem_match: !!x.tem_match,
      valorr_snap: Number(x.valorr_snap) || 0,
      n_rec_snap: Number(x.n_rec_snap) || 0,
      // node-postgres devolve DATE como Date JS; normalizar para "YYYY-MM-DD".
      inicio_rec: x.inicio_rec instanceof Date
        ? x.inicio_rec.toISOString().slice(0, 10)
        : x.inicio_rec ? String(x.inicio_rec).slice(0, 10) : null,
      rec_full: Number(x.rec_full) || 0,
      rec_pre: Number(x.rec_pre) || 0,
      pont_full: Number(x.pont_full) || 0,
      pont_pre: Number(x.pont_pre) || 0,
      pago: Number(x.pago) || 0,
      n_parcelas: Number(x.n_parcelas) || 0,
      ltv_fat: Number(x.ltv_fat) || 0,
      ltv_dfc: Number(x.ltv_dfc) || 0,
    }));
    const aud = ltvAuditoriaToGrupos(parsed, kpi, mesNum);
    grupos = aud.grupos;
    base.realizado = aud.mediana;
    const regua = kpi === "ltv_fat"
      ? "Régua FAT (faturável): Valor R × meses de vida até o snapshot + pontual entregue"
      : `Régua DFC (caixa): faturável teórico até 30/set/25 + pago real no Conta Azul via CNPJ (parcelas RECEITA quitadas até ${ultimoDiaAnterior(mesNum)})${aud.nSemMatch > 0 ? `; ${aud.nSemMatch} cliente${aud.nSemMatch === 1 ? "" : "s"} sem match CNPJ usa${aud.nSemMatch === 1 ? "" : "m"} a régua faturável` : ""}`;
    nota = `Célula = MEDIANA de ${parsed.length} clientes ativos no snapshot de 01/${String(mesNum).padStart(2, "0")} (N par = média dos 2 centrais). ${regua}.`;
  } else if (kpi === "enps") {
```

**Atenção ao TypeScript:** `kpi` é `string`; ao chamar `ltvAuditoriaToGrupos(parsed, kpi, mesNum)` o parâmetro exige o union — usar `kpi as "ltv_fat" | "ltv_dfc"` (o branch garante).

- [ ] **Step 3: Typecheck + grep de sobras**

Run: `npm run check 2>&1 | grep "ceoDashboard\|CeoKpi"; true` → zero linhas.
Run: `grep -rn "ltvRowsToGrupos" server/ client/ --include="*.ts" --include="*.tsx"` → esperado: só a definição/testes em helpers (nenhum uso no detalhe.ts). Relatar o resultado.

- [ ] **Step 4: Validação de runtime contra o banco local**

Criar `server/tmp-validate-auditoria.ts` (APAGAR antes do commit):

```typescript
import "dotenv/config";
import { db } from "./db";
import { buildCeoMatriz } from "./routes/ceoDashboard.matriz";
import { buildCeoDetalhe } from "./routes/ceoDashboard.detalhe";

async function main() {
  const m = await buildCeoMatriz(db, "2026-07");
  for (const kpi of ["ltv_fat", "ltv_dfc"] as const) {
    const linha = m.linhas.find((l) => l.key === kpi)!;
    for (const mes of [1, 6]) {
      const celula = linha.celulas.find((c) => c.mes === mes)!;
      const d: any = await buildCeoDetalhe(db, kpi, `2026-${String(mes).padStart(2, "0")}`);
      const nItens = d.grupos.reduce((s: number, g: any) => s + g.itens.length, 0);
      const ok = celula.valor === d.realizado ? "OK" : "DIVERGE";
      console.log(`${kpi} mes=${mes}: celula=${celula.valor} drawer=${d.realizado} [${ok}] grupos=${d.grupos.map((g: any) => `${g.titulo}:${g.itens.length}`).join(" | ")} total_itens=${nItens}`);
      console.log(`  mediana item: ${JSON.stringify(d.grupos.find((g: any) => g.titulo === "Mediana")?.itens)}`);
    }
  }
  process.exit(0);
}
main().catch((e) => { console.error("FALHOU:", e); process.exit(1); });
```

Run: `npx tsx server/tmp-validate-auditoria.ts`
Expected: 4 linhas com `[OK]` (célula == drawer para fat/dfc × jan/jun); `total_itens` == população do mês (~242 jan, ~213 jun); grupo Mediana com 1 ou 2 itens e `detalhe` preenchido. Colar a saída no report. Depois: `rm server/tmp-validate-auditoria.ts`.

- [ ] **Step 5: Commit**

```bash
git add server/routes/ceoDashboard.detalhe.ts
git commit -m "feat(ceo-dashboard): células de LTV auditáveis — drill vira auditoria do mês

Header do drawer = mediana da célula (reconciliada por construção); 3 grupos
(acima/mediana/abaixo) com todos os clientes do snapshot e a conta aberta de
cada um (FAT: valorr × meses + pontual; DFC: teórico pré-corte + pago real).

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Validação integrada (sessão principal, não subagente)

- [ ] Reiniciar dev server (conferir CWD do processo na 3000 antes de matar).
- [ ] Conferir célula×drawer no app + dark/light (ou pedir ao usuário, sem browser tool).
- [ ] `git push`.

---

## Self-review (feito na escrita)

- Spec coverage: header reconciliado (Task 2 `realizado=mediana` + validação Step 4), 3 grupos todos-os-clientes (helper sem corte), decomposição FAT/DFC com todos os casos (testes Task 1), nota metodológica (Task 2), campo `aberto` (Task 1), frontend mínimo. Meses sem snapshot → rows vazio → grupos vazios + "Sem detalhamento para este mês" do front (comportamento já existente).
- Sem placeholders; código completo.
- Consistência: `LtvAuditoriaRow`/`ltvAuditoriaToGrupos`/`ultimoDiaAnterior` exportados na Task 1 e importados na Task 2; `aberto` no back (Task 1.3) e front (Task 1.4).
