# LTV FAT × LTV DFC no CEO Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a linha única "LTV" da matriz do CEO Dashboard por duas linhas — LTV FAT (faturável, ClickUp) e LTV DFC (caixa, híbrido ClickUp + Conta Azul) — com drill por cliente para ambas.

**Architecture:** Query SQL única (validada em prod, 0,85s) no endpoint da matriz retorna as duas séries mensais; helpers puros montam as duas linhas; o drill (`/api/ceo-dashboard/detalhe`) ganha as keys `ltv_fat`/`ltv_dfc` com ranking por cliente (foto de hoje). Spec: `docs/superpowers/specs/2026-07-09-ltv-dfc-fat-ceo-dashboard-design.md`; SQL de referência: `docs/superpowers/specs/2026-07-09-ltv-dfc-fat-query.sql`.

**Tech Stack:** Express + drizzle (`sql` template), PostgreSQL, vitest, React (tabela já renderiza linhas genericamente).

## Global Constraints

- **Escape em drizzle:** dentro de `` sql`...` `` escrever `'\\D'` (NUNCA `'\D'` — JS engole a barra e o regex vira `'D'`, quebrando o match de CNPJ em silêncio).
- **`MATERIALIZED` obrigatório** em todos os CTEs da query da matriz (sem isso o Postgres re-executa subqueries ~16k vezes: 25s vs 0,85s).
- `caz_parcelas.tipo_evento` é MAIÚSCULO: `'RECEITA'`.
- Status de `cup_contratos`/`cup_data_hist` é minúsculo e comparado por igualdade/`IN` (nunca `ILIKE` — `'inativo'` contém `'ativo'`).
- Corte do híbrido: teórico até `DATE '2025-09-30'`; real com `data_quitacao >= DATE '2025-10-01'`.
- Commits: Conventional Commits + `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`; commit direto na `main` (autorizado).
- **Subagentes: NÃO rodar `npm run dev`, NÃO matar a porta 3000, NÃO usar `git stash`/`amend`/`rebase`.** Validar com vitest e `npm run check`.
- Typecheck: `npm run check` tem erros pré-existentes; validar com `npm run check 2>&1 | grep "ceoDashboard\|CeoMatriz"` (deve voltar vazio).

---

### Task 1: Backend da matriz — séries LTV FAT e LTV DFC

**Files:**
- Modify: `server/routes/ceoDashboard.matriz.helpers.ts` (interface `CeoMatrizSources` ~L31-43; linha `ltv` em `montarMatrizCeo` ~L97-99)
- Modify: `server/routes/ceoDashboard.matriz.ts` (query LTV ~L23-57; chamada `montarMatrizCeo` ~L83-93)
- Test: `server/routes/ceoDashboard.matriz.helpers.test.ts`

**Interfaces:**
- Consumes: `montarMatrizCeo(s: CeoMatrizSources)` existente.
- Produces: `CeoMatrizSources` passa a ter `ltvFatSeriePorMes: Record<number, number>` e `ltvDfcSeriePorMes: Record<number, number>` (substituem `ltvSeriePorMes`). Linhas da matriz com keys `"ltv_fat"` (label `"LTV FAT"`) e `"ltv_dfc"` (label `"LTV DFC"`), ambas `unidade: "brl"`, `direcao: "maior_melhor"`, `semMeta: true`, na posição da antiga `ltv` (entre `cac` e `headcount`), FAT antes de DFC. Total: 12 linhas.

- [ ] **Step 1: Atualizar os testes dos helpers (failing)**

Em `server/routes/ceoDashboard.matriz.helpers.test.ts`:

1. Em `baseSources` (~L37), substituir a linha `ltvSeriePorMes: { 1: 12000, 2: 13000, 3: 14000 },` por:

```typescript
    ltvFatSeriePorMes: { 1: 12000, 2: 13000, 3: 14000 },
    ltvDfcSeriePorMes: { 1: 11000, 2: 13500 }, // mês 3 sem dado → gap (célula null)
```

2. Substituir o teste `"expõe as 11 linhas na ordem dos cards"` (~L57-63) por:

```typescript
  it("expõe as 12 linhas na ordem dos cards (LTV FAT antes de LTV DFC)", () => {
    const m = montarMatrizCeo(baseSources());
    expect(m.linhas.map((l) => l.key)).toEqual([
      "receita", "custos", "lucro", "caixa", "inadimplencia",
      "nps", "cac", "ltv_fat", "ltv_dfc", "headcount", "enps", "receita_cabeca",
    ]);
  });
```

3. Substituir o teste `"LTV usa série mensal (uma célula por mês, sem meta)"` (~L95-100) por:

```typescript
  it("LTV FAT e LTV DFC usam séries mensais próprias, sem meta", () => {
    const m = montarMatrizCeo(baseSources({ mesNum: 3 }));
    const fat = m.linhas.find((l) => l.key === "ltv_fat")!;
    expect(fat.label).toBe("LTV FAT");
    expect(fat.semMeta).toBe(true);
    expect(fat.celulas.map((c) => c.valor)).toEqual([12000, 13000, 14000]);
    const dfc = m.linhas.find((l) => l.key === "ltv_dfc")!;
    expect(dfc.label).toBe("LTV DFC");
    expect(dfc.semMeta).toBe(true);
    // mês 3 sem dado na série → gap (null), não zero
    expect(dfc.celulas.map((c) => c.valor)).toEqual([11000, 13500, null]);
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run server/routes/ceoDashboard.matriz.helpers.test.ts`
Expected: FAIL — TypeScript reclama de `ltvFatSeriePorMes` inexistente em `CeoMatrizSources` e/ou asserts de 12 linhas falham.

- [ ] **Step 3: Atualizar os helpers**

Em `server/routes/ceoDashboard.matriz.helpers.ts`:

1. Na interface `CeoMatrizSources`, substituir

```typescript
  ltvSeriePorMes: Record<number, number>; // LTV médio dos ativos por mês (snapshots)
```

por:

```typescript
  ltvFatSeriePorMes: Record<number, number>; // LTV faturável mediano dos ativos (ClickUp: valorr × meses + pontual entregue)
  ltvDfcSeriePorMes: Record<number, number>; // LTV caixa mediano dos ativos (pago real Conta Azul + teórico pré-out/2025)
```

2. Em `montarMatrizCeo`, substituir a linha `ltv` (objeto `{ key: "ltv", ... }`) por duas:

```typescript
    { key: "ltv_fat", label: "LTV FAT", unidade: "brl", direcao: "maior_melhor", semMeta: true,
      nota: "LTV faturável mediano dos clientes ativos no mês (ClickUp): Valor R × meses de vida + pontual entregue.",
      celulas: celulasDaSerie(s.ltvFatSeriePorMes, mesNum) },
    { key: "ltv_dfc", label: "LTV DFC", unidade: "brl", direcao: "maior_melhor", semMeta: true,
      nota: "LTV caixa mediano dos clientes ativos no mês: pago real no Conta Azul desde out/2025 + faturável teórico antes disso (sem CNPJ casado, usa o faturável).",
      celulas: celulasDaSerie(s.ltvDfcSeriePorMes, mesNum) },
```

3. Atualizar o comentário da interface (`// inadimplência, ltv, enps, nps` → `// inadimplência, ltv_fat, ltv_dfc, enps, nps`).

- [ ] **Step 4: Rodar os testes dos helpers**

Run: `npx vitest run server/routes/ceoDashboard.matriz.helpers.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Substituir a query no endpoint**

Em `server/routes/ceoDashboard.matriz.ts`, substituir o bloco inteiro da seção 3 (comentário ~L23-26, declaração `ltvSeriePorMes` e o try/catch ~L27-57) por:

```typescript
  // 3) LTV FAT × LTV DFC — medianas dos ativos POR MÊS (spec: docs/superpowers/specs/2026-07-09-ltv-dfc-fat-ceo-dashboard-design.md).
  // FAT (faturável, ClickUp): valorr × meses de vida até o snapshot + valorp dos pontuais entregues.
  // DFC (caixa, híbrido): teórico até 30/set/2025 + pago real Conta Azul (via CNPJ) até a entrada do mês;
  // clientes sem match CNPJ caem no FAT. População: ativos no snapshot do dia 1º (ou 1º snapshot do mês).
  // MATERIALIZED é obrigatório: sem ele o planner re-executa as subqueries ~16k vezes (25s vs 0,9s).
  const ltvFatSeriePorMes: Record<number, number> = {};
  const ltvDfcSeriePorMes: Record<number, number> = {};
  try {
    const ltvRows: any = await db.execute(sql`
      WITH meses AS (
        SELECT generate_series('2026-01-01'::date, make_date(2026, ${mesNum}, 1), '1 month')::date m
      ),
      snap_ref AS MATERIALIZED (
        SELECT meses.m, COALESCE(
          (SELECT data_snapshot FROM "Clickup".cup_data_hist WHERE data_snapshot = meses.m LIMIT 1),
          (SELECT MIN(data_snapshot) FROM "Clickup".cup_data_hist WHERE date_trunc('month', data_snapshot) = meses.m)
        ) AS snap FROM meses
      ),
      ativos AS MATERIALIZED (
        SELECT sr.m, sr.snap, h.id_task
        FROM snap_ref sr
        JOIN "Clickup".cup_data_hist h ON h.data_snapshot = sr.snap
        WHERE sr.snap IS NOT NULL
        GROUP BY sr.m, sr.snap, h.id_task
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
        SELECT DISTINCT k.task_id, z.ids
        FROM click_norm k JOIN caz_norm z USING (cnpj_norm)
      ),
      match_task AS MATERIALIZED (SELECT DISTINCT task_id FROM caz_map),
      rec_contratos AS MATERIALIZED (
        SELECT v.id_task, v.valorr, v.data_inicio, v.data_fim
        FROM cortex_core.vw_lt_contratos v
        WHERE v.tipo_receita = 'recorrente' AND v.data_inicio IS NOT NULL
      ),
      pont_task AS MATERIALIZED (
        SELECT co.id_task, co.valorp, COALESCE(co.data_entrega, co.data_criado) AS data_ref
        FROM "Clickup".cup_contratos co
        WHERE co.valorp > 0 AND (co.valorr IS NULL OR co.valorr = 0) AND co.status = 'entregue'
      ),
      teo AS MATERIALIZED (
        SELECT a.m, a.id_task,
          COALESCE(SUM(r.valorr * GREATEST((LEAST(COALESCE(r.data_fim, a.snap), a.snap) - r.data_inicio)::numeric, 0) / 30.44), 0) AS rec_full,
          COALESCE(SUM(r.valorr * GREATEST((LEAST(COALESCE(r.data_fim, DATE '2025-09-30'), DATE '2025-09-30') - r.data_inicio)::numeric, 0) / 30.44), 0) AS rec_pre
        FROM ativos a
        LEFT JOIN rec_contratos r ON r.id_task = a.id_task
        GROUP BY a.m, a.id_task
      ),
      pont_agg AS MATERIALIZED (
        SELECT a.m, a.id_task,
          COALESCE(SUM(p.valorp) FILTER (WHERE p.data_ref < a.snap), 0) AS pont_full,
          COALESCE(SUM(p.valorp) FILTER (WHERE p.data_ref < DATE '2025-10-01'), 0) AS pont_pre
        FROM ativos a
        JOIN pont_task p ON p.id_task = a.id_task
        GROUP BY a.m, a.id_task
      ),
      real_task_mes AS MATERIALIZED (
        SELECT cm.task_id, date_trunc('month', pa.data_quitacao)::date AS mes_q, SUM(pa.valor_pago) AS pago
        FROM caz_map cm
        JOIN "Conta Azul".caz_parcelas pa ON pa.id_cliente::text = cm.ids
        WHERE pa.tipo_evento = 'RECEITA' AND pa.data_quitacao >= DATE '2025-10-01'
        GROUP BY cm.task_id, date_trunc('month', pa.data_quitacao)
      ),
      real_cum AS MATERIALIZED (
        SELECT ms.m, r.task_id, SUM(r.pago) AS pago
        FROM meses ms JOIN real_task_mes r ON r.mes_q < ms.m
        GROUP BY ms.m, r.task_id
      ),
      por_cliente AS (
        SELECT a.m,
          t.rec_full + COALESCE(pg.pont_full, 0) AS ltv_fat,
          CASE WHEN mt.task_id IS NOT NULL
               THEN t.rec_pre + COALESCE(pg.pont_pre, 0) + COALESCE(rc.pago, 0)
               ELSE t.rec_full + COALESCE(pg.pont_full, 0)
          END AS ltv_dfc
        FROM ativos a
        JOIN teo t ON t.m = a.m AND t.id_task = a.id_task
        LEFT JOIN pont_agg pg ON pg.m = a.m AND pg.id_task = a.id_task
        LEFT JOIN real_cum rc ON rc.m = a.m AND rc.task_id = a.id_task
        LEFT JOIN match_task mt ON mt.task_id = a.id_task
      )
      SELECT EXTRACT(MONTH FROM m)::int AS mes,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ltv_fat)::numeric, 0) AS ltv_fat,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ltv_dfc)::numeric, 0) AS ltv_dfc
      FROM por_cliente
      GROUP BY m ORDER BY m
    `);
    for (const r of ltvRows.rows ?? []) {
      const mes = Number((r as any).mes);
      if (!mes) continue;
      const fat = Number((r as any).ltv_fat);
      const dfc = Number((r as any).ltv_dfc);
      if (!Number.isNaN(fat)) ltvFatSeriePorMes[mes] = fat;
      if (!Number.isNaN(dfc)) ltvDfcSeriePorMes[mes] = dfc;
    }
  } catch (e) {
    console.error("[api] CEO matriz — falha na série de LTV FAT/DFC:", e);
  }
```

E na chamada `montarMatrizCeo({...})` no fim da função, substituir `ltvSeriePorMes,` por:

```typescript
    ltvFatSeriePorMes,
    ltvDfcSeriePorMes,
```

- [ ] **Step 6: Typecheck e testes**

Run: `npx vitest run server/routes/ceoDashboard.matriz.helpers.test.ts && npm run check 2>&1 | grep "ceoDashboard\|CeoMatriz"; true`
Expected: vitest PASS; o grep não retorna nenhuma linha (erros pré-existentes de outros arquivos são ignorados).

- [ ] **Step 7: Validar a query contra o banco local**

Run: `PGPASSWORD=dev123 psql -h localhost -U cortex -d cortex_dev -f docs/superpowers/specs/2026-07-09-ltv-dfc-fat-query.sql`
Expected: 7 linhas (mes 1..7) com `ltv_fat`/`ltv_dfc` próximos da tabela do spec (jan FAT 14.869 / DFC 13.196 … jun FAT 22.240 / DFC 23.488). Dados locais sincronizados em 2026-07-04 → julho e valores DFC recentes podem divergir um pouco; jan–mai devem bater quase exato.

- [ ] **Step 8: Commit**

```bash
git add server/routes/ceoDashboard.matriz.ts server/routes/ceoDashboard.matriz.helpers.ts server/routes/ceoDashboard.matriz.helpers.test.ts
git commit -m "feat(ceo-dashboard): linha LTV vira LTV FAT × LTV DFC na matriz

FAT = faturável ClickUp (valorr × meses + pontual entregue), mediana dos ativos.
DFC = caixa híbrido (pago real Conta Azul via CNPJ desde out/2025 + teórico antes),
mediana dos ativos; sem match CNPJ cai no FAT. Query validada em prod (0,85s).

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Drill por cliente para as keys ltv_fat e ltv_dfc

**Files:**
- Modify: `server/routes/ceoDashboard.detalhe.ts` (TITULOS ~L39-43; branch `kpi === "ltv"` ~L121-129; KPIS_VALIDOS ~L161)

**Interfaces:**
- Consumes: `ltvRowsToGrupos(rows)` de `ceoDashboard.detalhe.helpers.ts` — espera rows `{ nome, ltv_total }` (inalterado). Front chama `/api/ceo-dashboard/detalhe?kpi=ltv_fat|ltv_dfc&mes=N`.
- Produces: endpoint aceita `ltv_fat` e `ltv_dfc` (e deixa de aceitar `ltv`, que não existe mais na matriz).

- [ ] **Step 1: Atualizar TITULOS e KPIS_VALIDOS**

Em `TITULOS`, substituir `ltv: "LTV",` por:

```typescript
  ltv_fat: "LTV FAT", ltv_dfc: "LTV DFC",
```

Em `KPIS_VALIDOS`, substituir `"ltv"` por `"ltv_fat","ltv_dfc"`:

```typescript
      const KPIS_VALIDOS = ["receita","custos","lucro","caixa","inadimplencia","cac","ltv_fat","ltv_dfc","headcount","enps","receita_cabeca"];
```

- [ ] **Step 2: Substituir o branch `kpi === "ltv"`**

Substituir o bloco `} else if (kpi === "ltv") { ... }` por dois branches (ranking = foto de hoje; o card da matriz é a mediana histórica por snapshot — notas explicam):

```typescript
  } else if (kpi === "ltv_fat") {
    // LTV faturável por cliente (foto de hoje): valorr × meses de vida + pontual entregue.
    const rows: any = await db.execute(sql`
      WITH rec AS (
        SELECT id_task, SUM(COALESCE(ltv_recorrente, 0)) AS rec
        FROM cortex_core.vw_lt_contratos GROUP BY id_task
      ),
      pont AS (
        SELECT id_task, SUM(valorp) AS pontual FROM "Clickup".cup_contratos
        WHERE valorp > 0 AND (valorr IS NULL OR valorr = 0) AND status = 'entregue'
        GROUP BY id_task
      )
      SELECT COALESCE(c.nome, r.id_task) AS nome,
             ROUND(r.rec + COALESCE(p.pontual, 0), 2) AS ltv_total
      FROM rec r
      LEFT JOIN pont p ON p.id_task = r.id_task
      LEFT JOIN "Clickup".cup_clientes c ON c.task_id = r.id_task
      ORDER BY 2 DESC NULLS LAST LIMIT 200`);
    grupos = ltvRowsToGrupos(rows.rows ?? []);
    nota = "LTV faturável (ClickUp): Valor R × meses de vida + pontual entregue. Ranking = foto de hoje; a célula da matriz é a mediana dos ativos no mês.";
  } else if (kpi === "ltv_dfc") {
    // LTV caixa por cliente (foto de hoje): teórico até 30/set/2025 + pago real Conta Azul; sem match → faturável.
    const rows: any = await db.execute(sql`
      WITH click_norm AS MATERIALIZED (
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
        SELECT DISTINCT k.task_id, z.ids
        FROM click_norm k JOIN caz_norm z USING (cnpj_norm)
      ),
      rec AS MATERIALIZED (
        SELECT v.id_task,
          SUM(COALESCE(v.ltv_recorrente, 0)) AS rec_full,
          COALESCE(SUM(v.valorr * GREATEST((LEAST(COALESCE(v.data_fim, DATE '2025-09-30'), DATE '2025-09-30') - v.data_inicio)::numeric, 0) / 30.44)
            FILTER (WHERE v.tipo_receita = 'recorrente' AND v.data_inicio IS NOT NULL), 0) AS rec_pre
        FROM cortex_core.vw_lt_contratos v GROUP BY v.id_task
      ),
      pont AS MATERIALIZED (
        SELECT co.id_task,
          SUM(co.valorp) AS pont_full,
          COALESCE(SUM(co.valorp) FILTER (WHERE COALESCE(co.data_entrega, co.data_criado) < DATE '2025-10-01'), 0) AS pont_pre
        FROM "Clickup".cup_contratos co
        WHERE co.valorp > 0 AND (co.valorr IS NULL OR co.valorr = 0) AND co.status = 'entregue'
        GROUP BY co.id_task
      ),
      pago AS MATERIALIZED (
        SELECT cm.task_id, SUM(pa.valor_pago) AS pago
        FROM caz_map cm
        JOIN "Conta Azul".caz_parcelas pa ON pa.id_cliente::text = cm.ids
        WHERE pa.tipo_evento = 'RECEITA' AND pa.data_quitacao >= DATE '2025-10-01'
        GROUP BY cm.task_id
      )
      SELECT COALESCE(c.nome, r.id_task) AS nome,
        ROUND(CASE WHEN mt.task_id IS NOT NULL
          THEN r.rec_pre + COALESCE(p.pont_pre, 0) + COALESCE(pg.pago, 0)
          ELSE r.rec_full + COALESCE(p.pont_full, 0) END, 2) AS ltv_total
      FROM rec r
      LEFT JOIN pont p ON p.id_task = r.id_task
      LEFT JOIN (SELECT DISTINCT task_id FROM caz_map) mt ON mt.task_id = r.id_task
      LEFT JOIN pago pg ON pg.task_id = r.id_task
      LEFT JOIN "Clickup".cup_clientes c ON c.task_id = r.id_task
      ORDER BY 2 DESC NULLS LAST LIMIT 200`);
    grupos = ltvRowsToGrupos(rows.rows ?? []);
    nota = "LTV caixa: pago real no Conta Azul (desde out/2025, via CNPJ) + faturável teórico antes disso. Ranking = foto de hoje; a célula da matriz é a mediana dos ativos no mês.";
  } else if (kpi === "enps") {
```

(O `} else if (kpi === "enps") {` final já existe — é o ponto de emenda, não duplicar.)

- [ ] **Step 3: Typecheck**

Run: `npm run check 2>&1 | grep "ceoDashboard"; true`
Expected: nenhuma linha.

- [ ] **Step 4: Validar as duas queries no banco local**

Run (colar a query FAT e depois a DFC num `psql -h localhost -U cortex -d cortex_dev`, trocando `'\\D'` por `'\D'` — o escape duplo é só para o template JS):
Expected: top do ranking com clientes de LTV alto (centenas de milhares), sem erro de sintaxe; DFC ≠ FAT para clientes com pagamentos no Conta Azul.

- [ ] **Step 5: Commit**

```bash
git add server/routes/ceoDashboard.detalhe.ts
git commit -m "feat(ceo-dashboard): drill por cliente para LTV FAT e LTV DFC

Substitui o drill do LTV antigo pelas duas réguas novas (foto de hoje),
com fallback FAT para clientes sem match de CNPJ no DFC.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Frontend — rodapé da tabela

**Files:**
- Modify: `client/src/components/ceo/CeoMatrizTabela.tsx` (rodapé ~L139-143)

**Interfaces:**
- Consumes: `data.linhas` do endpoint (as duas linhas novas aparecem automaticamente — a tabela renderiza `linhas` genericamente e o tooltip vem de `linha.nota`).
- Produces: nada consumido por outras tasks.

- [ ] **Step 1: Atualizar o texto do rodapé**

O parágrafo atual menciona o LTV duas vezes (texto desatualizado). Substituir:

```tsx
        andamento (parcial). Inadimplência por mês de vencimento; LTV = média dos ativos por mês (snapshots); E-NPS por onda de
        pesquisa (meses sem pesquisa ficam vazios); LTV = mediana recorrente dos clientes ativos (só recorrência, sem pontual). Clique numa célula para o detalhamento do mês.
```

por:

```tsx
        andamento (parcial). Inadimplência por mês de vencimento; LTV FAT = faturável mediano dos ativos (ClickUp: Valor R × meses + pontual entregue);
        LTV DFC = caixa mediano (pago real no Conta Azul desde out/25 + faturável antes); E-NPS por onda de pesquisa (meses sem pesquisa ficam vazios). Clique numa célula para o detalhamento do mês.
```

- [ ] **Step 2: Typecheck**

Run: `npm run check 2>&1 | grep "CeoMatriz"; true`
Expected: nenhuma linha.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/ceo/CeoMatrizTabela.tsx
git commit -m "style(ceo-dashboard): rodapé da matriz explica LTV FAT × LTV DFC

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 4: Validação integrada no browser (sessão principal, não subagente)

**Files:** nenhum (validação manual).

- [ ] **Step 1: Reiniciar o dev server** (`lsof -ti:3000 | xargs kill -9; npm run dev` — conferir que o CWD do server é este clone, não um worktree).
- [ ] **Step 2: Abrir `/ceo-dashboard` no browser**: a tabela mostra as linhas "LTV FAT" e "LTV DFC" entre CAC e Headcount, com valores próximos ao spec (jan–jun) e "—" onde não há dado.
- [ ] **Step 3: Clicar numa célula de cada linha**: o drawer abre com ranking por cliente e a nota da régua; sem erro 400/500 no console.
- [ ] **Step 4: Conferir dark mode E light mode** (toggle do app).
- [ ] **Step 5: Push** (`git push`), conforme workflow de git-autopush do repo.

---

## Self-review (feito na escrita)

- Spec coverage: réguas (Task 1 query = SQL validado), duas linhas + labels/notas (Task 1), drill (Task 2), rodapé (Task 3), validação numérica e browser (Tasks 1.7 e 4). Fora de escopo mantido fora (endpoint legado, /lt-ltv-churn).
- Sem placeholders; código completo em todos os steps.
- Consistência de nomes: `ltvFatSeriePorMes`/`ltvDfcSeriePorMes` (Tasks 1), keys `ltv_fat`/`ltv_dfc` (Tasks 1–3), alias `ltv_total` mantido para `ltvRowsToGrupos` (Task 2).
