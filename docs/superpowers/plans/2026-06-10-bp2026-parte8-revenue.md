# BP 2026 Parte 8 (sub-aba Revenue) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Terceira sub-aba "Revenue" em `/bp-2026`: MRR, Contratos, AOV e Churn % por linha de serviço (Performance, Creators, Social, GC, Others), orçado × realizado.

**Architecture:** Módulo `bp2026.revenue.ts` no padrão do `bp2026.metricas.ts` (2 queries próprias com CASE de produto compartilhado; derivadas locais); payload ganha `revenue`; frontend ganha a 3ª tab e o campo genérico `destaque`.

**Tech Stack:** igual às partes anteriores.

**Spec:** `docs/superpowers/specs/2026-06-10-bp2026-parte8-revenue-design.md` (valores de anti-drift e definições de YTD estão lá — é parte deste plano).

**Contexto:** worktree `/Users/mac0267/Cortex/.claude/worktrees/bp2026-metricas-gerais`, branch `feature/bp2026-metricas-gerais` (PR #248). Xlsx só em `/Users/mac0267/Cortex/`. Referências (prod, snapshot 2026-05-31): Performance 166 contratos / 472.823; Creators 171 / 279.395; Social Media 67 / 144.807; GC 5 / 43.500; Others ≈ 89.704. Snapshots desde 2025-11-17.

---

### Task 1: Seed — coluna inicial por entrada + 20 métricas da aba Revenue

**Files:**
- Modify: `scripts/seed-bp2026-orcado.py`

- [ ] **Step 1: Suporte a col_inicial.** O loop atual desempacota `for aba, row, metrica in LINHAS:` e lê `range(3, 15)`. Mudar para:

```python
for entrada in LINHAS:
    aba, row, metrica = entrada[0], entrada[1], entrada[2]
    col_inicial = entrada[3] if len(entrada) > 3 else 3  # C; aba Revenue usa 4 (D)
    ws = wb[aba]
    valores = [ws.cell(row=row, column=col).value for col in range(col_inicial, col_inicial + 12)]
```

(restante do loop inalterado.)

- [ ] **Step 2: 20 entradas novas** em `LINHAS` (após as de métricas gerais), todas da aba "Revenue" com col_inicial=4:

```python
    ("Revenue", 7, "mrr_performance", 4),
    ("Revenue", 8, "aov_performance", 4),
    ("Revenue", 9, "contratos_performance", 4),
    ("Revenue", 10, "churn_pct_performance", 4),
    ("Revenue", 12, "mrr_creators", 4),
    ("Revenue", 13, "aov_creators", 4),
    ("Revenue", 14, "contratos_creators", 4),
    ("Revenue", 15, "churn_pct_creators", 4),
    ("Revenue", 17, "mrr_social", 4),
    ("Revenue", 18, "aov_social", 4),
    ("Revenue", 19, "contratos_social", 4),
    ("Revenue", 20, "churn_pct_social", 4),
    ("Revenue", 22, "mrr_gc", 4),
    ("Revenue", 23, "aov_gc", 4),
    ("Revenue", 24, "contratos_gc", 4),
    ("Revenue", 25, "churn_pct_gc", 4),
    ("Revenue", 27, "mrr_others", 4),
    ("Revenue", 28, "aov_others", 4),
    ("Revenue", 29, "contratos_others", 4),
    ("Revenue", 30, "churn_pct_others", 4),
```

E em `TOTAIS_ESPERADOS` (somas do spec, seção Seed):

```python
    "mrr_performance": 7426334.8933,
    "aov_performance": 34141.465714,
    "contratos_performance": 2604.204968,
    "churn_pct_performance": 1.08,
    "mrr_creators": 5004613.2318,
    "aov_creators": 56074.061264,
    "contratos_creators": 1063.612613,
    "churn_pct_creators": 1.08,
    "mrr_social": 4014651.4263,
    "aov_social": 26732.128216,
    "contratos_social": 1795.775497,
    "churn_pct_social": 1.08,
    "mrr_gc": 2634209.6604,
    "aov_gc": 108740.581448,
    "contratos_gc": 286.346478,
    "churn_pct_gc": 1.08,
    "mrr_others": 1918268.8799,
    "aov_others": 20565.197133,
    "contratos_others": 1112.449569,
    "churn_pct_others": 1.08,
```

- [ ] **Step 3: Rodar e aplicar** (cwd /Users/mac0267/Cortex; comandos padrão local+prod das partes anteriores). Expected: `OK: 676 statements` (52 DELETEs + 624 INSERTs), COMMIT nos dois. Verificar 52×12 nos dois bancos; spot-check jan: mrr_performance 496750, churn_pct_performance 0.09, aov_gc ≈ 7891.0369. Se assert falhar, BLOCKED com valores lidos.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-bp2026-orcado.py
git commit -m "feat(bp2026): seed da aba Revenue (20 métricas) com coluna inicial por entrada"
```

---

### Task 2: API — montarRevenue

**Files:**
- Create: `server/routes/bp2026.revenue.ts`
- Modify: `server/routes/bp2026.ts`

- [ ] **Step 1: `destaque` nos tipos.** Em `bp2026.ts`: `DefLinha` e `LinhaReceita` ganham `destaque?: boolean;`.

- [ ] **Step 2: Criar `server/routes/bp2026.revenue.ts`:**

```typescript
// server/routes/bp2026.revenue.ts
// Sub-aba Revenue: MRR/Contratos/AOV/Churn% por linha de serviço.
// Mapeamento por produto exato; Others = demais — soma das 5 = MRR total da matriz.
import { sql } from "drizzle-orm";
import { calcAtingimento, calcYtd, type MesValor } from "./bp2026.helpers";

interface MesLinha extends MesValor { atingimento: number | null }
interface Linha {
  metrica: string; titulo: string; tipoAgregacao: "fluxo" | "estoque";
  direcao: "maior_melhor" | "menor_melhor" | "neutro";
  unidade?: "brl" | "int" | "pct"; nota?: string; destaque?: boolean;
  meses: MesLinha[];
  ytd: { orcado: number; realizado: number | null; atingimento: number | null };
}

const LINHAS_SERVICO = [
  { chave: "performance", titulo: "Performance" },
  { chave: "creators", titulo: "Creators" },
  { chave: "social", titulo: "Social" },
  { chave: "gc", titulo: "Gestão de Comunidade" },
  { chave: "others", titulo: "Others" },
] as const;

const NOTA_OTHERS =
  "Agrega os demais produtos recorrentes do ClickUp (Broadcast, Sustentação, " +
  "CRM de Vendas, TikTok Shop, Consultoria de Performance, sem produto, etc.).";

const NOTA_CHURN =
  "Taxa do mês = churn (não abonado) do produto ÷ MRR da linha no fim do mês anterior.";

// mesma expressão nas duas queries — mapeamento único
const CASE_PRODUTO = sql`CASE TRIM(produto)
  WHEN 'Performance' THEN 'performance'
  WHEN 'Creators' THEN 'creators'
  WHEN 'Social Media' THEN 'social'
  WHEN 'Gestão de Comunidade' THEN 'gc'
  ELSE 'others' END`;

interface Deps {
  db: any;
  orcado: Record<string, Record<number, number>>;
  mesCorrente: number;
  mesFechado: number;
}

function razao(num: number | null, den: number | null): number | null {
  if (num === null || den === null || !den) return null;
  return num / den;
}

export async function montarRevenue({ db, orcado, mesCorrente, mesFechado }: Deps): Promise<Linha[]> {
  // snapshots fim de mês: índice 0 = dez/2025 (denominador do churn de janeiro), 1..12 = 2026
  const snapResult = await db.execute(sql`
    WITH alvo AS (
      SELECT gs.mes, MAX(h.data_snapshot::date) AS d
      FROM generate_series(0, 12) AS gs(mes)
      JOIN "Clickup".cup_data_hist h
        ON h.data_snapshot::date >= (make_date(2025, 12, 1) + (gs.mes || ' months')::interval)::date
       AND h.data_snapshot::date < (make_date(2025, 12, 1) + ((gs.mes + 1) || ' months')::interval)::date
      GROUP BY gs.mes
    )
    SELECT a.mes, ${CASE_PRODUTO} AS linha,
           SUM(h.valorr::numeric) AS mrr,
           COUNT(DISTINCT h.id_subtask) AS contratos
    FROM alvo a
    JOIN "Clickup".cup_data_hist h ON h.data_snapshot::date = a.d
    WHERE h.status IN ('ativo', 'onboarding', 'triagem')
    GROUP BY 1, 2
    ORDER BY 1
  `);
  const snap: Record<string, Record<number, { mrr: number; contratos: number }>> = {};
  for (const row of snapResult.rows as any[]) {
    const linha = row.linha as string;
    if (!snap[linha]) snap[linha] = {};
    snap[linha][Number(row.mes)] = { mrr: parseFloat(row.mrr), contratos: parseInt(row.contratos) };
  }

  const churnResult = await db.execute(sql`
    SELECT EXTRACT(MONTH FROM data_solicitacao_encerramento)::int AS mes,
           ${CASE_PRODUTO} AS linha,
           SUM(valor_r) AS total
    FROM cortex_core.vw_cup_churn_ajustado
    WHERE data_solicitacao_encerramento >= '2026-01-01' AND data_solicitacao_encerramento < '2027-01-01'
      AND COALESCE(abonar_churn, '') != 'Sim'
      AND COALESCE(motivo_cancelamento, '') NOT IN ('Inadimplente 1º Mês', 'Não começou', 'Erro na Venda')
      AND valor_r > 0
    GROUP BY 1, 2
    ORDER BY 1
  `);
  const churnRs: Record<string, Record<number, number>> = {};
  for (const row of churnResult.rows as any[]) {
    const linha = row.linha as string;
    if (!churnRs[linha]) churnRs[linha] = {};
    churnRs[linha][Number(row.mes)] = parseFloat(row.total);
  }

  const linhas: Linha[] = [];
  for (const { chave, titulo } of LINHAS_SERVICO) {
    const s = snap[chave] ?? {};
    const c = churnRs[chave] ?? {};
    const mrrSerie = Array.from({ length: 12 }, (_, i) => (i + 1 <= mesCorrente ? s[i + 1]?.mrr ?? null : null));
    const contratosSerie = Array.from({ length: 12 }, (_, i) => (i + 1 <= mesCorrente ? s[i + 1]?.contratos ?? null : null));
    const aovSerie = Array.from({ length: 12 }, (_, i) => razao(mrrSerie[i], contratosSerie[i]));
    const churnPctSerie = Array.from({ length: 12 }, (_, i) =>
      i + 1 <= mesCorrente ? razao(c[i + 1] ?? 0, s[i]?.mrr ?? null) : null
    );

    const fazLinha = (
      def: { metrica: string; titulo: string; tipoAgregacao: "fluxo" | "estoque"; direcao: Linha["direcao"]; unidade: NonNullable<Linha["unidade"]>; nota?: string; destaque?: boolean },
      serie: (number | null)[],
      ytdOverride?: { orcado: number; realizado: number | null }
    ): Linha => {
      const meses: MesLinha[] = Array.from({ length: 12 }, (_, i) => {
        const mes = i + 1;
        const o = orcado[def.metrica]?.[mes] ?? 0;
        const r = serie[i];
        return { mes, orcado: o, realizado: r, atingimento: calcAtingimento(o, r) };
      });
      let ytd: Linha["ytd"];
      if (mesFechado === 0) {
        ytd = { orcado: 0, realizado: null, atingimento: null };
      } else if (ytdOverride) {
        ytd = { ...ytdOverride, atingimento: calcAtingimento(ytdOverride.orcado, ytdOverride.realizado) };
      } else {
        const v = calcYtd(meses, mesFechado, def.tipoAgregacao);
        ytd = { ...v, atingimento: calcAtingimento(v.orcado, v.realizado) };
      }
      return { ...def, meses, ytd };
    };

    // YTD do AOV: razão das posições no mês fechado (orçado idem)
    const aovYtd = mesFechado === 0 ? undefined : {
      orcado: razao(orcado[`mrr_${chave}`]?.[mesFechado] ?? 0, orcado[`contratos_${chave}`]?.[mesFechado] ?? 0) ?? 0,
      realizado: razao(mrrSerie[mesFechado - 1], contratosSerie[mesFechado - 1]),
    };

    // YTD do churn %: Σ churn R$ ÷ Σ denominadores (taxa média mensal ponderada);
    // orçado = Σ(pct_orc(m) × mrr_orc(m)) ÷ Σ mrr_orc(m)
    let churnYtd: { orcado: number; realizado: number | null } | undefined;
    if (mesFechado > 0) {
      let somaChurn = 0;
      let somaDen = 0;
      for (let m = 1; m <= mesFechado; m++) {
        somaChurn += c[m] ?? 0;
        somaDen += s[m - 1]?.mrr ?? 0;
      }
      let numOrc = 0;
      let denOrc = 0;
      for (let m = 1; m <= mesFechado; m++) {
        const mrrOrc = orcado[`mrr_${chave}`]?.[m] ?? 0;
        numOrc += (orcado[`churn_pct_${chave}`]?.[m] ?? 0) * mrrOrc;
        denOrc += mrrOrc;
      }
      churnYtd = { orcado: denOrc ? numOrc / denOrc : 0, realizado: somaDen ? somaChurn / somaDen : null };
    }

    linhas.push(
      fazLinha({ metrica: `mrr_${chave}`, titulo: `MRR — ${titulo}`, tipoAgregacao: "estoque", direcao: "maior_melhor", unidade: "brl", destaque: true, ...(chave === "others" ? { nota: NOTA_OTHERS } : {}) }, mrrSerie),
      fazLinha({ metrica: `contratos_${chave}`, titulo: `Contratos — ${titulo}`, tipoAgregacao: "estoque", direcao: "maior_melhor", unidade: "int" }, contratosSerie),
      fazLinha({ metrica: `aov_${chave}`, titulo: `AOV — ${titulo}`, tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade: "brl" }, aovSerie, aovYtd),
      fazLinha({ metrica: `churn_pct_${chave}`, titulo: `Churn — ${titulo}`, tipoAgregacao: "fluxo", direcao: "menor_melhor", unidade: "pct", nota: NOTA_CHURN }, churnPctSerie, churnYtd)
    );
  }
  return linhas;
}
```

- [ ] **Step 3: Integração em `bp2026.ts`.** Import; após `montarMetricasGerais`, chamar:

```typescript
      // 9. Revenue por linha de serviço (sub-aba)
      const revenue = await montarRevenue({ db, orcado, mesCorrente, mesFechado });
```

e incluir `revenue` no payload.

- [ ] **Step 4: Smoke** — criar `bp2026-smoke.ts` na raiz (rodar, DELETAR antes do commit):

```typescript
import "dotenv/config";
import express from "express";
import { registerBp2026Routes } from "./server/routes/bp2026";
import { db } from "./server/db";
const app = express();
registerBp2026Routes(app, db);
const server = app.listen(3981, async () => {
  const json: any = await (await fetch("http://localhost:3981/api/bp2026/receitas")).json();
  console.log("revenue:", json.revenue?.length);
  const by = (m: string) => json.revenue.find((x: any) => x.metrica === m);
  // identidade: soma dos 5 MRR = MRR total da matriz, mês a mês (jan e mai)
  const dreMrr = json.linhas.find((x: any) => x.metrica === "mrr_ativo");
  for (const i of [0, 4]) {
    const soma = ["performance", "creators", "social", "gc", "others"].reduce((acc, k) => acc + by(`mrr_${k}`).meses[i].realizado, 0);
    console.log(`mes ${i + 1}: soma 5 linhas = ${soma} | mrr_ativo = ${dreMrr.meses[i].realizado}`, Math.abs(soma - dreMrr.meses[i].realizado) < 0.01 ? "OK" : "DIVERGE");
  }
  for (const m of ["mrr_performance", "contratos_gc", "aov_creators", "churn_pct_performance"]) {
    const l = by(m);
    console.log(m, l.unidade, l.direcao, "destaque:", !!l.destaque, "jan:", l.meses[0].orcado, l.meses[0].realizado, "ytd:", JSON.stringify(l.ytd));
  }
  // aov identidade
  const aov = by("aov_creators").meses[4].realizado;
  const recalc = by("mrr_creators").meses[4].realizado / by("contratos_creators").meses[4].realizado;
  console.log("aov_creators mai:", aov, "recalc:", recalc, Math.abs(aov - recalc) < 0.01 ? "OK" : "DIVERGE");
  server.close(); process.exit(0);
});
```

Expected: 20 linhas; soma dos 5 MRR = mrr_ativo da matriz (jan e mai) OK; mrr_performance mai ≈ 472823 (col mai: meses[4]); contratos_gc int; churn_pct_performance pct menor_melhor com jan ≈ 333096-parte? (jan performance churn/denominador dez); aov identidade OK; destaque true só nos mrr_*. `npx tsc --noEmit -p . 2>&1 | grep -i bp2026` vazio; vitest 14/14.

- [ ] **Step 5: Commit**

```bash
git add server/routes/bp2026.revenue.ts server/routes/bp2026.ts
git commit -m "feat(bp2026): sub-aba revenue — MRR/contratos/AOV/churn por linha de serviço"
```

---

### Task 3: Frontend — 3ª tab + destaque genérico

**Files:**
- Modify: `client/src/components/bp2026/BPDreTable.tsx`
- Modify: `client/src/pages/BP2026.tsx`

- [ ] **Step 1: BPDreTable.** `BPLinha` ganha `destaque?: boolean;`. Generalizar `ehTotal`:

```typescript
            const ehTotal =
              linha.destaque ??
              (linha.metrica === "receita_total_faturavel" ||
                linha.metrica === "receita_liquida" ||
                linha.metrica === "margem_bruta" ||
                linha.metrica === "ebitda" ||
                linha.metrica === "geracao_caixa" ||
                linha.metrica === "dfc_real");
```

- [ ] **Step 2: BP2026.tsx.** `ReceitasResponse` ganha `revenue: BPLinha[];`. Terceira tab:

```tsx
        <TabsTrigger value="revenue">Revenue</TabsTrigger>
        ...
        <TabsContent value="revenue" className="mt-4">
          <BPDreTable linhas={data.revenue} mesCorrente={data.mesCorrente} mesFechado={data.mesFechado} />
        </TabsContent>
```

- [ ] **Step 3: Verificar** — tsc grep bp2026 vazio; dev server; curl 200. Visual do controller (3ª aba, 5 grupos com MRR em destaque, pct/int formatados, dark+light).

- [ ] **Step 4: Commit**

```bash
git add client/src/components/bp2026/BPDreTable.tsx client/src/pages/BP2026.tsx
git commit -m "feat(bp2026): terceira sub-aba revenue com destaque genérico por linha"
```

---

### Task 4: Verificação final e PR

- [ ] **Step 1:** `npx vitest run` — 14 bp2026 verdes.
- [ ] **Step 2:** Push; atualizar PR #248 (título "feat: BP 2026 — sub-abas Métricas Gerais e Revenue (partes 7-8)" e corpo com a seção Parte 8) via REST se o gh edit falhar.
