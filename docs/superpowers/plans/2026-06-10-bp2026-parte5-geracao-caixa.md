# BP 2026 Parte 5 (Impostos Diretos, CAPEX, Geração de Caixa) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o DRE da matriz `/bp-2026` com (−) IR+CSLL+ICMS+DIFAL, (−) CAPEX e (=) Geração de Caixa (17 linhas).

**Architecture:** Mesma extensão incremental: seed +2 métricas; API com 2 queries via `somaDespesaCaixaPorMes`, família `LINHAS_POS_EBITDA` via `buildLinhas`, derivada via `subtrairMeses(ebitdaMeses, …)`; frontend só ganha o destaque.

**Tech Stack:** igual às partes anteriores.

**Spec:** `docs/superpowers/specs/2026-06-10-bp2026-parte5-geracao-caixa-design.md`

**Contexto:** worktree `/Users/mac0267/Cortex/.claude/worktrees/bp2026-orcado-realizado`, branch `feature/bp2026-orcado-realizado` (PR #247). Xlsx só em `/Users/mac0267/Cortex/`. Senha prod via `.env` (`PROD_PASS=$(grep -E "^# *DB_PASSWORD=" .env | head -1 | sed -E 's/^# *DB_PASSWORD=//' | tr -d '"'"'"' \r')`). Referências (prod, caixa): impostos_diretos jan=2.265, fev=216, mar=297, abr=347, mai=1.263; capex jan=1.582, fev=17.113, mar=72.603, abr=202, mai=13.852. Orçado: impostos_diretos jan=99.528,6; capex 35.000/mês; geração orçada jan=104.202,67 (=238.731,27−99.528,6−35.000).

---

### Task 1: Seed — impostos_diretos e capex

**Files:**
- Modify: `scripts/seed-bp2026-orcado.py`

- [ ] **Step 1:** Em `LINHAS`, adicionar (após a entrada de `bonus`):

```python
    ("Overview", 19, "impostos_diretos"),
    ("Overview", 20, "capex"),
```

Em `TOTAIS_ESPERADOS`, adicionar:

```python
    "impostos_diretos": 2583101.7,
    "capex": 420000.0,
```

- [ ] **Step 2: Rodar e aplicar**

```bash
cd /Users/mac0267/Cortex && python3 /Users/mac0267/Cortex/.claude/worktrees/bp2026-orcado-realizado/scripts/seed-bp2026-orcado.py
PGPASSWORD=dev123 psql -h localhost -U cortex -d cortex_dev -f /tmp/seed-bp2026-orcado.sql
PROD_PASS=$(grep -E "^# *DB_PASSWORD=" .env | head -1 | sed -E 's/^# *DB_PASSWORD=//' | tr -d '"'"'"' \r') && PGPASSWORD="$PROD_PASS" psql -h 34.95.249.110 -U postgres -d dados_turbo -f /tmp/seed-bp2026-orcado.sql
```

Expected: `OK: 182 statements` (14 DELETEs + 168 INSERTs), COMMIT nos dois. Se o assert das novas falhar, reporte BLOCKED com os valores lidos (não ajuste sozinho).

- [ ] **Step 3: Verificar** — grupo nos dois bancos (14 métricas; novas: impostos_diretos 2583102, capex 420000). Spot-check: `SELECT mes, valor FROM cortex_core.bp2026_orcado WHERE metrica='capex' ORDER BY mes LIMIT 3;` → 35000×3; `... metrica='impostos_diretos' AND mes=1` → 99528.6 (aprox).

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-bp2026-orcado.py
git commit -m "feat(bp2026): seed de impostos diretos e CAPEX"
```

---

### Task 2: API — linhas pós-EBITDA e Geração de Caixa

**Files:**
- Modify: `server/routes/bp2026.ts`

Leia o arquivo inteiro antes (~427 linhas). Existem: `somaDespesaCaixaPorMes`, `DefLinha`, `buildLinhas`; blocos até 4i (bônus); `realizadoPorMetrica`; montagem até 6g (`ebitdaMeses` + push do ebitda).

- [ ] **Step 1: Definições** — após `LINHAS_OPEX`:

```typescript
const NOTA_IMPOSTOS_DIRETOS =
  "IRPJ/CSLL ainda não aparecem lançados no Conta Azul em 2026 — o atingimento " +
  "baixo reflete lacuna de lançamento, não economia.";

const NOTA_GERACAO =
  "Enquanto IRPJ/CSLL não forem lançados no Conta Azul, o realizado desta linha " +
  "fica superestimado.";

const LINHAS_POS_EBITDA: DefLinha[] = [
  { metrica: "impostos_diretos", titulo: "(−) IR + CSLL + ICMS + DIFAL", tipoAgregacao: "fluxo", direcao: "menor_melhor", nota: NOTA_IMPOSTOS_DIRETOS },
  { metrica: "capex", titulo: "(−) CAPEX", tipoAgregacao: "fluxo", direcao: "menor_melhor" },
];
```

- [ ] **Step 2: Queries** — após o bloco 4i:

```typescript
      // 4j. Impostos diretos: caixa — ICMS/DIFAL + IRPJ/CSLL quando lançados
      const impostosDiretosPorMes = await somaDespesaCaixaPorMes(
        db,
        sql`categoria_nome LIKE '06.12%' OR categoria_nome LIKE '06.13%' OR categoria_nome LIKE '08.01%'`
      );

      // 4k. CAPEX: caixa — computadores, periféricos e conserto de ativo
      const capexPorMes = await somaDespesaCaixaPorMes(db, sql`categoria_nome LIKE '06.11%'`);
```

- [ ] **Step 3: realizadoPorMetrica** — acrescentar:

```typescript
        impostos_diretos: (mes) => (mes <= mesCorrente ? impostosDiretosPorMes[mes] ?? 0 : null),
        capex: (mes) => (mes <= mesCorrente ? capexPorMes[mes] ?? 0 : null),
```

- [ ] **Step 4: Montagem** — após o push do `ebitda` (bloco 6g):

```typescript
      // 6h. Pós-EBITDA: impostos diretos e CAPEX
      const linhasPosEbitda = buildLinhas(LINHAS_POS_EBITDA, orcado, realizadoPorMetrica);
      linhas.push(...linhasPosEbitda);

      // 6i. Geração de Caixa = EBITDA − impostos diretos − CAPEX
      const geracaoMeses = subtrairMeses(
        ebitdaMeses,
        linhasPosEbitda.map((l) => l.meses)
      );
      linhas.push({
        metrica: "geracao_caixa",
        titulo: "(=) Geração de Caixa",
        tipoAgregacao: "fluxo",
        direcao: "maior_melhor",
        nota: NOTA_GERACAO,
        meses: geracaoMeses.map((m) => ({
          ...m,
          atingimento: calcAtingimento(m.orcado, m.realizado),
        })),
      });
```

- [ ] **Step 5: Smoke** — criar `bp2026-smoke.ts` na raiz (rodar e DELETAR antes do commit):

```typescript
import "dotenv/config";
import express from "express";
import { registerBp2026Routes } from "./server/routes/bp2026";
import { db } from "./server/db";
const app = express();
registerBp2026Routes(app, db);
const server = app.listen(3990, async () => {
  const res = await fetch("http://localhost:3990/api/bp2026/receitas");
  const json: any = await res.json();
  console.log("ordem:", json.linhas.map((l: any) => l.metrica).join(","));
  const by = (m: string) => json.linhas.find((l: any) => l.metrica === m);
  for (const m of ["impostos_diretos", "capex", "geracao_caixa"]) {
    const l = by(m);
    console.log(m, l.direcao, l.nota ? "[nota]" : "", "jan:", l.meses[0].orcado, l.meses[0].realizado, "jul:", l.meses[6].realizado, "ytd:", JSON.stringify(l.ytd));
  }
  const e = by("ebitda"), i = by("impostos_diretos"), c = by("capex"), g = by("geracao_caixa");
  const recalc = e.meses[0].realizado - i.meses[0].realizado - c.meses[0].realizado;
  console.log("geracao jan recompute:", recalc, "json:", g.meses[0].realizado);
  server.close(); process.exit(0);
});
```

Expected: 17 linhas terminando em `…ebitda, impostos_diretos, capex, geracao_caixa`; impostos_diretos jan orcado 99528.6 / realizado ≈2265 [nota]; capex jan 35000 / ≈1582; geracao_caixa jan orcado ≈104202.67, realizado = recompute exato, [nota]; jul null; ytds coerentes. Also `npx tsc --noEmit -p . 2>&1 | grep -i bp2026` vazio; `npx vitest run server/routes/bp2026.helpers.test.ts` 11/11. DELETAR o smoke.

- [ ] **Step 6: Commit**

```bash
git add server/routes/bp2026.ts
git commit -m "feat(bp2026): impostos diretos, CAPEX e geração de caixa — DRE completo"
```

---

### Task 3: Frontend — destaque da Geração de Caixa

**Files:**
- Modify: `client/src/components/bp2026/BPDreTable.tsx`

- [ ] **Step 1:** Incluir `geracao_caixa` no `ehTotal`:

```typescript
            const ehTotal =
              linha.metrica === "receita_total_faturavel" ||
              linha.metrica === "receita_liquida" ||
              linha.metrica === "margem_bruta" ||
              linha.metrica === "ebitda" ||
              linha.metrica === "geracao_caixa";
```

- [ ] **Step 2:** `npx tsc --noEmit -p . 2>&1 | grep -iE "bp2026|BP2026"` vazio; reiniciar dev server; `curl -s -o /dev/null -w "%{http_code}" localhost:3000/bp-2026` → 200. Visual do controller na sequência.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/bp2026/BPDreTable.tsx
git commit -m "feat(bp2026): destaque da linha geração de caixa"
```

---

### Task 4: Verificação final

- [ ] **Step 1:** `npx vitest run` — 11 bp2026 verdes; ignorar 2 suites pré-existentes.
- [ ] **Step 2:** Push; atualizar PR #247 via REST (`gh api repos/Warleypablo/Cortex/pulls/247 -X PATCH -F body=@/tmp/pr247-body.md`).
