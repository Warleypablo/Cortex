# BP 2026 Parte 2 (Inadimplência, Impostos, Receita Líquida) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar as linhas (−) Inadimplência, (−) Impostos sobre Receita e (=) Receita Líquida à matriz anual de `/bp-2026`, com direção de métrica (menor-é-melhor) nas cores.

**Architecture:** Estende a Parte 1 sem mudanças estruturais: seed ganha 2 linhas da planilha; o endpoint `/api/bp2026/receitas` ganha 2 queries + 2 linhas + 1 derivada e o campo `direcao` por linha; o frontend inverte a escala de cor para `menor_melhor`. Helper novo `subtrairMeses` (com testes) para a derivação com propagação de null.

**Tech Stack:** igual à Parte 1 (Express + Drizzle sql tag, React + Tailwind, vitest).

**Spec:** `docs/superpowers/specs/2026-06-10-bp2026-parte2-deducoes-design.md`

**Contexto:** worktree `/Users/mac0267/Cortex/.claude/worktrees/bp2026-orcado-realizado`, branch `feature/bp2026-orcado-realizado` (PR #247 aberto — Parte 2 entra nele). O xlsx existe só em `/Users/mac0267/Cortex/`. Senha prod via `.env` (`PROD_PASS=$(grep -E "^# *DB_PASSWORD=" .env | head -1 | sed -E 's/^# *DB_PASSWORD=//' | tr -d '"'"'"' \r')`). Valores de referência (prod 2026-06-10): inadimplência jan=46.485, fev=43.909, mar=49.363, abr=52.674, mai=85.370; impostos (caixa) jan=104.303, fev=126.881, mar=119.972, abr=167.001, mai=143.015. Orçado planilha: inadimplência jan=85.057 (total 1.564.991,4); impostos jan=133.132 (total 2.422.411,4); receita líquida orçada jan=1.199.427 (derivada, confere com a linha 10 da planilha).

---

### Task 1: Seed das 2 linhas novas de orçado

**Files:**
- Modify: `scripts/seed-bp2026-orcado.py:11-21`

- [ ] **Step 1: Estender o mapa de linhas e totais**

Em `scripts/seed-bp2026-orcado.py`, substituir:

```python
LINHAS = {
    4: "mrr_ativo",
    5: "receita_pontual",
    6: "outras_receitas",
}
# Totais da coluna O da aba Overview, para verificação anti-drift
TOTAIS_ESPERADOS = {
    "mrr_ativo": 20998078.1,
    "receita_pontual": 4045000.0,
    "outras_receitas": 1040111.3,
}
```

por:

```python
LINHAS = {
    4: "mrr_ativo",
    5: "receita_pontual",
    6: "outras_receitas",
    8: "inadimplencia",
    9: "impostos_receita",
}
# Totais da coluna O da aba Overview, para verificação anti-drift
TOTAIS_ESPERADOS = {
    "mrr_ativo": 20998078.1,
    "receita_pontual": 4045000.0,
    "outras_receitas": 1040111.3,
    "inadimplencia": 1564991.4,
    "impostos_receita": 2422411.4,
}
```

(A linha 7 da planilha é o Total Faturável — derivado, não entra. Atualizar também o docstring: "linhas 4-6 e 8-9".)

- [ ] **Step 2: Rodar o seed e aplicar nos dois bancos**

```bash
cd /Users/mac0267/Cortex && python3 /Users/mac0267/Cortex/.claude/worktrees/bp2026-orcado-realizado/scripts/seed-bp2026-orcado.py
PGPASSWORD=dev123 psql -h localhost -U cortex -d cortex_dev -f /tmp/seed-bp2026-orcado.sql
PROD_PASS=$(grep -E "^# *DB_PASSWORD=" .env | head -1 | sed -E 's/^# *DB_PASSWORD=//' | tr -d '"'"'"' \r') && PGPASSWORD="$PROD_PASS" psql -h 34.95.249.110 -U postgres -d dados_turbo -f /tmp/seed-bp2026-orcado.sql
```

Expected: `OK: 65 statements` (5 DELETEs + 60 INSERTs), `COMMIT` nos dois.

- [ ] **Step 3: Verificar**

```bash
PGPASSWORD=dev123 psql -h localhost -U cortex -d cortex_dev -c "SELECT metrica, COUNT(*), ROUND(SUM(valor)) FROM cortex_core.bp2026_orcado GROUP BY metrica ORDER BY 1;"
```

Expected (5 linhas):
```
 impostos_receita | 12 |  2422411
 inadimplencia    | 12 |  1564991
 mrr_ativo        | 12 | 20998078
 outras_receitas  | 12 |  1040111
 receita_pontual  | 12 |  4045000
```
Mesma query em produção, mesmo resultado.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-bp2026-orcado.py
git commit -m "feat(bp2026): seed das linhas inadimplência e impostos sobre receita"
```

---

### Task 2: Helper subtrairMeses (TDD)

**Files:**
- Modify: `server/routes/bp2026.helpers.ts` (adicionar função)
- Test: `server/routes/bp2026.helpers.test.ts` (adicionar describe)

- [ ] **Step 1: Testes (falhando)** — acrescentar ao final de `bp2026.helpers.test.ts` (e incluir `subtrairMeses` no import existente do topo):

```typescript
describe("subtrairMeses", () => {
  const base = [
    { mes: 1, orcado: 1000, realizado: 900 },
    { mes: 2, orcado: 1100, realizado: 1200 },
    { mes: 3, orcado: 1200, realizado: null },
  ];
  const ded1 = [
    { mes: 1, orcado: 100, realizado: 50 },
    { mes: 2, orcado: 110, realizado: null },
    { mes: 3, orcado: 120, realizado: null },
  ];
  const ded2 = [
    { mes: 1, orcado: 200, realizado: 150 },
    { mes: 2, orcado: 210, realizado: 200 },
    { mes: 3, orcado: 220, realizado: null },
  ];

  it("subtrai orçado e realizado mês a mês", () => {
    const r = subtrairMeses(base, [ded1, ded2]);
    expect(r[0]).toEqual({ mes: 1, orcado: 700, realizado: 700 });
  });

  it("propaga null: qualquer componente sem realizado zera o realizado derivado", () => {
    const r = subtrairMeses(base, [ded1, ded2]);
    expect(r[1]).toEqual({ mes: 2, orcado: 780, realizado: null });
    expect(r[2]).toEqual({ mes: 3, orcado: 860, realizado: null });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run server/routes/bp2026.helpers.test.ts`
Expected: FAIL — `subtrairMeses is not a function` (ou erro de export no import).

- [ ] **Step 3: Implementar** — acrescentar ao final de `bp2026.helpers.ts`:

```typescript
export function subtrairMeses(
  minuendo: MesValor[],
  subtraendos: MesValor[][]
): MesValor[] {
  return minuendo.map((m, i) => {
    const partes = subtraendos.map((s) => s[i]);
    const orcado = partes.reduce((acc, p) => acc - p.orcado, m.orcado);
    const algumNull = m.realizado === null || partes.some((p) => p.realizado === null);
    const realizado = algumNull
      ? null
      : partes.reduce((acc, p) => acc - (p.realizado ?? 0), m.realizado ?? 0);
    return { mes: m.mes, orcado, realizado };
  });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run server/routes/bp2026.helpers.test.ts`
Expected: PASS (8 testes — 6 da Parte 1 + 2 novos).

- [ ] **Step 5: Commit**

```bash
git add server/routes/bp2026.helpers.ts server/routes/bp2026.helpers.test.ts
git commit -m "feat(bp2026): helper subtrairMeses com propagação de null"
```

---

### Task 3: API — linhas de dedução e receita líquida

**Files:**
- Modify: `server/routes/bp2026.ts`

- [ ] **Step 1: Tipo Direcao e LINHAS com direção**

No topo de `server/routes/bp2026.ts`, incluir `subtrairMeses` no import dos helpers. Substituir a interface e o array `LINHAS` (linhas 15-34) por:

```typescript
export type Direcao = "maior_melhor" | "menor_melhor";

interface LinhaReceita {
  metrica: string;
  titulo: string;
  tipoAgregacao: TipoAgregacao;
  direcao: Direcao;
  meses: Array<{
    mes: number;
    orcado: number;
    realizado: number | null;
    atingimento: number | null;
    fonteAproximada?: boolean;
  }>;
}

let cache: { payload: unknown; expiraEm: number } | null = null;

const LINHAS: Array<{
  metrica: string;
  titulo: string;
  tipoAgregacao: TipoAgregacao;
  direcao: Direcao;
}> = [
  { metrica: "mrr_ativo", titulo: "(+) MRR Ativo", tipoAgregacao: "estoque", direcao: "maior_melhor" },
  { metrica: "receita_pontual", titulo: "(+) Receita Pontual", tipoAgregacao: "fluxo", direcao: "maior_melhor" },
  { metrica: "outras_receitas", titulo: "(+) Outras Receitas", tipoAgregacao: "fluxo", direcao: "maior_melhor" },
];

const LINHAS_DEDUCOES: Array<{
  metrica: string;
  titulo: string;
  tipoAgregacao: TipoAgregacao;
  direcao: Direcao;
}> = [
  { metrica: "inadimplencia", titulo: "(−) Inadimplência", tipoAgregacao: "fluxo", direcao: "menor_melhor" },
  { metrica: "impostos_receita", titulo: "(−) Impostos sobre Receita", tipoAgregacao: "fluxo", direcao: "menor_melhor" },
];
```

- [ ] **Step 2: Queries novas** — após o bloco `// 4. Outras receitas` (linha ~114), inserir:

```typescript
      // 4b. Inadimplência: foto atual — não pago das parcelas vencidas no mês
      const inadResult = await db.execute(sql`
        SELECT EXTRACT(MONTH FROM data_vencimento)::int AS mes,
               SUM(nao_pago::numeric) AS total
        FROM "Conta Azul".caz_parcelas
        WHERE tipo_evento = 'RECEITA'
          AND data_vencimento >= '2026-01-01' AND data_vencimento < '2027-01-01'
          AND nao_pago::numeric > 0
        GROUP BY 1 ORDER BY 1
      `);
      const inadPorMes: Record<number, number> = {};
      for (const row of inadResult.rows as any[]) {
        inadPorMes[Number(row.mes)] = parseFloat(row.total);
      }

      // 4c. Impostos sobre receita: regime caixa (quitação), categorias 05.05.x
      const impostosResult = await db.execute(sql`
        SELECT EXTRACT(MONTH FROM data_quitacao)::int AS mes,
               SUM(COALESCE(valor_pago::numeric, 0)) AS total
        FROM "Conta Azul".caz_parcelas
        WHERE tipo_evento = 'DESPESA'
          AND categoria_nome LIKE '05.05%'
          AND status = 'QUITADO'
          AND data_quitacao >= '2026-01-01' AND data_quitacao < '2027-01-01'
        GROUP BY 1 ORDER BY 1
      `);
      const impostosPorMes: Record<number, number> = {};
      for (const row of impostosResult.rows as any[]) {
        impostosPorMes[Number(row.mes)] = parseFloat(row.total);
      }
```

- [ ] **Step 3: realizadoPorMetrica** — adicionar as duas entradas (note o `?? 0`: para deduções, ausência de lançamento em mês já iniciado significa zero, não "sem dado"):

```typescript
      const realizadoPorMetrica: Record<string, (mes: number) => number | null> = {
        mrr_ativo: (mes) => (mes <= mesCorrente ? mrrPorMes[mes]?.valor ?? null : null),
        receita_pontual: (mes) => (mes <= mesCorrente ? pontualPorMes[mes] ?? null : null),
        outras_receitas: (mes) => (mes <= mesCorrente ? outrasPorMes[mes] ?? null : null),
        inadimplencia: (mes) => (mes <= mesCorrente ? inadPorMes[mes] ?? 0 : null),
        impostos_receita: (mes) => (mes <= mesCorrente ? impostosPorMes[mes] ?? 0 : null),
      };
```

ATENÇÃO: `realizadoPorMetrica` é declarado depois de `mesCorrente`/`mesFechado` (linha ~125) — manter posição.

- [ ] **Step 4: Montagem das linhas** — o `linhas = LINHAS.map(...)` atual ganha `direcao` no objeto retornado (espalhar do item: `({ metrica, titulo, tipoAgregacao, direcao })` e incluir `direcao` no literal). A linha derivada de total ganha `direcao: "maior_melhor"`. Após o push do total (linha ~165), acrescentar:

```typescript
      // 6b. Deduções: inadimplência e impostos
      const deducoes: LinhaReceita[] = LINHAS_DEDUCOES.map(
        ({ metrica, titulo, tipoAgregacao, direcao }) => ({
          metrica,
          titulo,
          tipoAgregacao,
          direcao,
          meses: Array.from({ length: 12 }, (_, i) => {
            const mes = i + 1;
            const o = orcado[metrica]?.[mes] ?? 0;
            const r = realizadoPorMetrica[metrica](mes);
            return { mes, orcado: o, realizado: r, atingimento: calcAtingimento(o, r) };
          }),
        })
      );
      linhas.push(...deducoes);

      // 6c. Receita Líquida = Total Faturável − Inadimplência − Impostos
      const liquidaMeses = subtrairMeses(
        totalMeses,
        deducoes.map((d) => d.meses)
      );
      linhas.push({
        metrica: "receita_liquida",
        titulo: "(=) Receita Líquida",
        tipoAgregacao: "fluxo",
        direcao: "maior_melhor",
        meses: liquidaMeses.map((m) => ({
          ...m,
          atingimento: calcAtingimento(m.orcado, m.realizado),
        })),
      });
```

(`totalMeses` já existe no bloco 6; `deducoes[i].meses` é estruturalmente compatível com `MesValor[]`.)

- [ ] **Step 5: Smoke test** — criar `bp2026-smoke.ts` na raiz do worktree (rodar e DELETAR antes do commit):

```typescript
import "dotenv/config";
import express from "express";
import { registerBp2026Routes } from "./server/routes/bp2026";
import { db } from "./server/db";
const app = express();
registerBp2026Routes(app, db);
const server = app.listen(3996, async () => {
  const res = await fetch("http://localhost:3996/api/bp2026/receitas");
  const json: any = await res.json();
  for (const l of json.linhas) {
    const jan = l.meses[0];
    console.log(l.metrica, l.direcao, "jan:", jan.orcado, jan.realizado, "ytd:", JSON.stringify(l.ytd));
  }
  server.close(); process.exit(0);
});
```

Run: `npx tsx ./bp2026-smoke.ts`
Expected: 7 linhas na ordem `mrr_ativo, receita_pontual, outras_receitas, receita_total_faturavel, inadimplencia, impostos_receita, receita_liquida`; inadimplencia jan ≈ orcado 85057 / realizado ≈46485; impostos_receita jan ≈ orcado 133132 / realizado ≈104303; receita_liquida jan orcado ≈ 1199427 (= 1417617−85057−133132, bate com a linha 10 da planilha) e realizado = total jan − inad jan − impostos jan; meses ≥ julho com realizado null em todas; YTD da receita_liquida = soma jan..mai dos meses derivados. Conferir e DELETAR o arquivo.

Também: `npx tsc --noEmit -p . 2>&1 | grep -i bp2026` → vazio; `npx vitest run server/routes/bp2026.helpers.test.ts` → 8/8.

- [ ] **Step 6: Commit**

```bash
git add server/routes/bp2026.ts
git commit -m "feat(bp2026): linhas de inadimplência, impostos e receita líquida na API"
```

---

### Task 4: Frontend — direção da métrica e destaque da Receita Líquida

**Files:**
- Modify: `client/src/components/bp2026/BPDreTable.tsx`

- [ ] **Step 1: Interface e cor por direção** — em `BPDreTable.tsx`:

Adicionar o campo à interface `BPLinha` (após `tipoAgregacao`):

```typescript
  direcao: "maior_melhor" | "menor_melhor";
```

Substituir `corAtingimento` por:

```typescript
function corAtingimento(
  a: number | null,
  direcao: "maior_melhor" | "menor_melhor" = "maior_melhor"
): string {
  if (a === null) return "text-gray-400 dark:text-zinc-500";
  if (direcao === "menor_melhor") {
    if (a <= 1) return "text-emerald-600 dark:text-emerald-400";
    if (a <= 1.1) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  }
  if (a >= 1) return "text-emerald-600 dark:text-emerald-400";
  if (a >= 0.9) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}
```

- [ ] **Step 2: Propagar direção até as células** — `Celula` ganha a prop:

```typescript
interface CelulaProps {
  orcado: number;
  realizado: number | null;
  atingimento: number | null;
  direcao: "maior_melhor" | "menor_melhor";
}

function Celula({ orcado, realizado, atingimento, direcao }: CelulaProps) {
```

e dentro dela a linha do percentual usa `corAtingimento(atingimento, direcao)`. Nos três pontos de uso de `<Celula ...>` (meses e YTD), passar `direcao={linha.direcao}`.

- [ ] **Step 3: Destaque das linhas de total** — substituir a definição de `ehTotal`:

```typescript
            const ehTotal =
              linha.metrica === "receita_total_faturavel" ||
              linha.metrica === "receita_liquida";
```

- [ ] **Step 4: Verificar e validar no browser**

```bash
npx tsc --noEmit -p . 2>&1 | grep -iE "bp2026|BP2026"   # vazio
cd /Users/mac0267/Cortex/.claude/worktrees/bp2026-orcado-realizado
lsof -ti:3000 | xargs kill -9
npm run dev > /tmp/bp2026-dev-p2.log 2>&1 &
sleep 10
curl -s -o /dev/null -w "%{http_code}" localhost:3000/bp-2026   # 200
```

A validação visual (7 linhas, cores invertidas nas deduções — inadimplência jan 54,7% deve ser VERDE, dark+light) é feita pelo controller no browser na sequência.

- [ ] **Step 5: Commit e push**

```bash
git add client/src/components/bp2026/BPDreTable.tsx
git commit -m "feat(bp2026): direção da métrica nas cores e destaque da receita líquida"
git push
```

---

### Task 5: Verificação final

- [ ] **Step 1:** `npx vitest run` — 8 testes bp2026 + suíte verde (2 suites com falha pré-existente de ambiente: sdr-assistant e replyClassifier — ignorar).
- [ ] **Step 2:** `git log --oneline main..HEAD` — revisar commits da Parte 2.
- [ ] **Step 3:** PR #247 já existe — push atualiza; editar descrição do PR acrescentando a Parte 2 (`gh pr edit 247 --body ...` com o corpo anterior + seção Parte 2).
