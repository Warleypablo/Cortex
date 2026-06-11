# BP 2026 Parte 7 (Métricas Gerais como sub-aba) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sub-aba "Métricas Gerais" em `/bp-2026` com as 18 métricas do bloco da planilha, orçado × realizado × atingimento, na mesma matriz.

**Architecture:** O payload de `/api/bp2026/receitas` ganha `metricasGerais: LinhaReceita[]`, montado por `montarMetricasGerais(...)` em `server/routes/bp2026.metricas.ts`, que recebe as séries já computadas do DRE e roda só 4 consultas novas. Frontend ganha Tabs; `BPDreTable` ganha formatação por `unidade` e direção `neutro`.

**Tech Stack:** igual às partes anteriores.

**Spec:** `docs/superpowers/specs/2026-06-10-bp2026-parte7-metricas-gerais-design.md`

**Contexto:** worktree `/Users/mac0267/Cortex/.claude/worktrees/bp2026-metricas-gerais`, branch `feature/bp2026-metricas-gerais` (base = main `d20ca07b`, código das Partes 1–6). Xlsx só em `/Users/mac0267/Cortex/`. Senha prod via `.env` (`PROD_PASS=$(grep -E "^# *DB_PASSWORD=" .env | head -1 | sed -E 's/^# *DB_PASSWORD=//' | tr -d '"'"'"' \r')`). Referências (prod 2026-06-10): vendas_mrr jan–mai 273.531/214.663/259.517/239.945/281.908; headcount jan 109, mai 112; clientes/contratos mai 315/529; churn jan–mai 162.431/96.408/115.178/126.730/120.345; saldo atual 1.739.443; setores Inhire: Commerce 85, Tech Sites 10, Backoffice 7, Growth Interno 7, Sócios 3. `node_modules` resolve via repo pai; copiar `.env` se ainda não existir no worktree (já copiado).

---

### Task 1: Seed — 18 métricas novas

**Files:**
- Modify: `scripts/seed-bp2026-orcado.py`

- [ ] **Step 1:** Adicionar a `LINHAS` (após a entrada de `capex`):

```python
    ("Overview", 25, "receita_total"),
    ("Overview", 26, "despesa_total"),
    ("Overview", 27, "vendas_mrr"),
    ("Overview", 28, "vendas_pontual"),
    ("Overview", 29, "colaboradores"),
    ("Overview", 30, "receita_cabeca"),
    ("Overview", 31, "mrr_cabeca"),
    ("Overview", 32, "clientes"),
    ("Overview", 33, "contratos"),
    ("Overview", 34, "ticket_cliente"),
    ("Overview", 35, "ticket_contrato"),
    ("Overview", 36, "churn_mes"),
    ("Overview", 37, "aliquota_efetiva"),
    ("Overview", 39, "margem_geracao"),
    ("Overview", 40, "saldo_caixa"),
    ("Overview", 43, "pessoas_csv"),
    ("Overview", 44, "pessoas_cac"),
    ("Overview", 45, "pessoas_sgea"),
```

A `TOTAIS_ESPERADOS` (somas extraídas da planilha em 2026-06-10):

```python
    "receita_total": 24518198.06,
    "despesa_total": 20023941.87,
    "vendas_mrr": 3075000.0,
    "vendas_pontual": 4230000.0,
    "colaboradores": 1704.0,
    "receita_cabeca": 181563.68,
    "mrr_cabeca": 146258.20,
    "clientes": 5231.49,
    "contratos": 7246.86,
    "ticket_cliente": 59490.94,
    "ticket_contrato": 42974.33,
    "churn_mes": 1889827.03,
    "aliquota_efetiva": 2.27,
    "margem_geracao": 1.96,
    "saldo_caixa": 28936413.23,
    "pessoas_csv": 1203.0,
    "pessoas_cac": 359.0,
    "pessoas_sgea": 142.0,
```

- [ ] **Step 2:** Tolerância relativa para métricas pequenas — substituir a linha do assert de total por:

```python
    tol = 0.01 if esperado < 10 else 1
    assert abs(total - esperado) < tol, f"{metrica}: total lido {total:.2f} != esperado {esperado:.2f}"
```

(Sem isso, as duas linhas percentuais — somas 2.27 e 1.96 — passariam no anti-drift mesmo lendo a linha errada.)

- [ ] **Step 3:** Rodar e aplicar nos dois bancos (xlsx em /Users/mac0267/Cortex):

```bash
cd /Users/mac0267/Cortex && python3 /Users/mac0267/Cortex/.claude/worktrees/bp2026-metricas-gerais/scripts/seed-bp2026-orcado.py
PGPASSWORD=dev123 psql -h localhost -U cortex -d cortex_dev -f /tmp/seed-bp2026-orcado.sql
PROD_PASS=$(grep -E "^# *DB_PASSWORD=" .env | head -1 | sed -E 's/^# *DB_PASSWORD=//' | tr -d '"'"'"' \r') && PGPASSWORD="$PROD_PASS" psql -h 34.95.249.110 -U postgres -d dados_turbo -f /tmp/seed-bp2026-orcado.sql
```

Expected: `OK: 416 statements` (32 DELETEs + 384 INSERTs), COMMIT nos dois. Verificar grupo (32 métricas × 12) nos dois bancos; spot-check jan: vendas_mrr 215000, colaboradores 109, aliquota_efetiva ≈ 0.16, saldo_caixa ≈ 639202.63.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-bp2026-orcado.py
git commit -m "feat(bp2026): seed das 18 métricas gerais com tolerância relativa no anti-drift"
```

---

### Task 2: API — montarMetricasGerais

**Files:**
- Create: `server/routes/bp2026.metricas.ts`
- Modify: `server/routes/bp2026.ts`

Leia `bp2026.ts` inteiro antes (~560 linhas, estado pós-merge das Partes 1–6).

- [ ] **Step 1: Tipos.** Em `bp2026.ts`:
  - `export type Direcao = "maior_melhor" | "menor_melhor" | "neutro";`
  - `DefLinha` e `LinhaReceita` ganham `unidade?: "brl" | "int" | "pct";` (ausente = brl).

- [ ] **Step 2: Estender a query de snapshot do MRR** (bloco 2) para devolver também os counts — adicionar ao SELECT final:

```sql
        COUNT(DISTINCT h.id_task) AS clientes,
        COUNT(DISTINCT h.id_subtask) AS contratos,
```

e ao map `mrrPorMes`: `clientes: parseInt(row.clientes)`, `contratos: parseInt(row.contratos)` (ajustar o tipo do Record).

- [ ] **Step 3: Criar `server/routes/bp2026.metricas.ts`** — código completo:

```typescript
// server/routes/bp2026.metricas.ts
// Bloco "Métricas Gerais" (sub-aba): monta as 18 linhas a partir das séries já
// computadas do DRE + 3 consultas próprias (vendas MRR, headcount/áreas, churn, saldo).
import { sql } from "drizzle-orm";
import { calcAtingimento, calcYtd, type MesValor } from "./bp2026.helpers";

// tipos estruturais mínimos (compatíveis com bp2026.ts)
interface MesLinha extends MesValor { atingimento: number | null }
interface Linha {
  metrica: string; titulo: string; tipoAgregacao: "fluxo" | "estoque";
  direcao: "maior_melhor" | "menor_melhor" | "neutro";
  unidade?: "brl" | "int" | "pct"; nota?: string;
  meses: MesLinha[];
  ytd: { orcado: number; realizado: number | null; atingimento: number | null };
}

const NOTA_SALDO =
  "Reconstrução retroativa: saldo bancário atual menos os fluxos quitados " +
  "posteriores ao fim do mês. Não captura ajustes manuais de conta.";

const NOTA_PESSOAS =
  "Mapeamento aproximado por setor do Inhire (Commerce+Tech→CSV; Growth→CAC; " +
  "Backoffice+Sócios→SG&A) — o time comercial está dentro de Commerce, " +
  "subcontando o CAC vs o conceito do BP.";

interface Deps {
  db: any;
  orcado: Record<string, Record<number, number>>;
  // séries de realizado mensal (índice 1..12; null = sem dado)
  realizadoDre: Record<string, (number | null)[]>; // por metrica do DRE, array[12]
  mrrInfoPorMes: Record<number, { valor: number; clientes: number; contratos: number }>;
  pontualPorMes: Record<number, number>;
  dfcPorMes: Record<number, number>;
  mesCorrente: number;
  mesFechado: number;
}

function serie(realizadoDre: Record<string, (number | null)[]>, metrica: string): (number | null)[] {
  return realizadoDre[metrica] ?? Array.from({ length: 12 }, () => null);
}

function somaSeries(series: (number | null)[][]): (number | null)[] {
  return Array.from({ length: 12 }, (_, i) => {
    if (series.some((s) => s[i] === null)) return null;
    return series.reduce((acc, s) => acc + (s[i] ?? 0), 0);
  });
}

function razao(num: number | null, den: number | null): number | null {
  if (num === null || den === null || !den) return null;
  return num / den;
}

function buildLinhaGeral(
  def: { metrica: string; titulo: string; tipoAgregacao: "fluxo" | "estoque"; direcao: Linha["direcao"]; unidade: NonNullable<Linha["unidade"]>; nota?: string },
  orcado: Record<string, Record<number, number>>,
  realizado: (number | null)[],
  mesFechado: number,
  ytdOverride?: { orcado: number; realizado: number | null }
): Linha {
  const meses: MesLinha[] = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const o = orcado[def.metrica]?.[mes] ?? 0;
    const r = realizado[i];
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
}

export async function montarMetricasGerais(deps: Deps): Promise<Linha[]> {
  const { db, orcado, realizadoDre, mrrInfoPorMes, pontualPorMes, dfcPorMes, mesCorrente, mesFechado } = deps;

  // ---- consultas próprias ----
  const vendasResult = await db.execute(sql`
    SELECT EXTRACT(MONTH FROM data_fechamento)::int AS mes,
           SUM(valor_recorrente::numeric) AS total
    FROM "Bitrix".crm_deal
    WHERE stage_name = 'Negócio Ganho' AND valor_recorrente > 0
      AND data_fechamento >= '2026-01-01' AND data_fechamento < '2027-01-01'
    GROUP BY 1 ORDER BY 1
  `);
  const vendasMrrPorMes: Record<number, number> = {};
  for (const row of vendasResult.rows as any[]) vendasMrrPorMes[Number(row.mes)] = parseFloat(row.total);

  const pessoasResult = await db.execute(sql`
    SELECT gs.mes,
           COUNT(p.*) AS total,
           COUNT(*) FILTER (WHERE TRIM(p.setor) IN ('Commerce', 'Tech Sites')) AS csv,
           COUNT(*) FILTER (WHERE TRIM(p.setor) = 'Growth Interno') AS cac,
           COUNT(*) FILTER (WHERE TRIM(p.setor) IN ('Backoffice', 'Sócios')) AS sgea
    FROM generate_series(1, 12) AS gs(mes)
    LEFT JOIN "Inhire".rh_pessoal p
      ON p.admissao IS NOT NULL
     AND p.admissao::date <= (make_date(2026, gs.mes, 1) + INTERVAL '1 month - 1 day')::date
     AND (p.demissao IS NULL OR p.demissao::date > (make_date(2026, gs.mes, 1) + INTERVAL '1 month - 1 day')::date)
    GROUP BY gs.mes ORDER BY gs.mes
  `);
  const pessoasPorMes: Record<number, { total: number; csv: number; cac: number; sgea: number }> = {};
  for (const row of pessoasResult.rows as any[]) {
    pessoasPorMes[Number(row.mes)] = {
      total: parseInt(row.total), csv: parseInt(row.csv), cac: parseInt(row.cac), sgea: parseInt(row.sgea),
    };
  }

  const churnResult = await db.execute(sql`
    SELECT EXTRACT(MONTH FROM data_solicitacao_encerramento)::int AS mes,
           SUM(valor_r) AS total
    FROM cortex_core.vw_cup_churn_ajustado
    WHERE data_solicitacao_encerramento >= '2026-01-01' AND data_solicitacao_encerramento < '2027-01-01'
      AND COALESCE(abonar_churn, '') != 'Sim'
      AND COALESCE(motivo_cancelamento, '') NOT IN ('Inadimplente 1º Mês', 'Não começou', 'Erro na Venda')
      AND valor_r > 0
    GROUP BY 1 ORDER BY 1
  `);
  const churnPorMes: Record<number, number> = {};
  for (const row of churnResult.rows as any[]) churnPorMes[Number(row.mes)] = parseFloat(row.total);

  const saldoResult = await db.execute(sql`SELECT COALESCE(SUM(balance::numeric), 0) AS saldo FROM "Conta Azul".caz_bancos`);
  const saldoAtual = parseFloat((saldoResult.rows[0] as any).saldo);

  // ---- séries auxiliares (a partir do DRE) ----
  const fat = serie(realizadoDre, "receita_total_faturavel");
  const inad = serie(realizadoDre, "inadimplencia");
  const mrr = serie(realizadoDre, "mrr_ativo");
  const geracao = serie(realizadoDre, "geracao_caixa");
  const impostosRec = serie(realizadoDre, "impostos_receita");
  const impostosDir = serie(realizadoDre, "impostos_diretos");
  const despesaTotal = somaSeries([
    impostosRec, serie(realizadoDre, "csv_salarios"), serie(realizadoDre, "csv_beneficio"),
    serie(realizadoDre, "csv_stack"), serie(realizadoDre, "cac"), serie(realizadoDre, "sga"),
    serie(realizadoDre, "bonus"), impostosDir, serie(realizadoDre, "capex"),
  ]);
  const receitaTotal = somaSeries([fat, inad.map((v) => (v === null ? null : -v))]);

  const mensal = (f: (mes: number) => number | null): (number | null)[] =>
    Array.from({ length: 12 }, (_, i) => (i + 1 <= mesCorrente ? f(i + 1) : null));

  const colaboradores = mensal((m) => pessoasPorMes[m]?.total ?? null);
  const clientes = mensal((m) => mrrInfoPorMes[m]?.clientes ?? null);
  const contratos = mensal((m) => mrrInfoPorMes[m]?.contratos ?? null);
  const vendasMrr = mensal((m) => vendasMrrPorMes[m] ?? 0);
  const vendasPontual = mensal((m) => pontualPorMes[m] ?? 0);
  const churn = mensal((m) => churnPorMes[m] ?? 0);
  // saldo fim do mês m = saldo atual − Σ fluxos dos meses m+1..mesCorrente
  const saldo = mensal((m) => {
    let s = saldoAtual;
    for (let k = m + 1; k <= mesCorrente; k++) s -= dfcPorMes[k] ?? 0;
    return s;
  });

  const receitaCabeca = Array.from({ length: 12 }, (_, i) => razao(receitaTotal[i], colaboradores[i]));
  const mrrCabeca = Array.from({ length: 12 }, (_, i) => razao(mrr[i], colaboradores[i]));
  const ticketCliente = Array.from({ length: 12 }, (_, i) => razao(mrr[i], clientes[i]));
  const ticketContrato = Array.from({ length: 12 }, (_, i) => razao(mrr[i], contratos[i]));
  const aliquota = Array.from({ length: 12 }, (_, i) =>
    razao(somaSeries([impostosRec, impostosDir])[i], fat[i])
  );
  const margemGeracao = Array.from({ length: 12 }, (_, i) => razao(geracao[i], fat[i]));

  // ---- YTDs derivados (razões sobre agregados, não média de %) ----
  const ytdFluxo = (s: (number | null)[]) =>
    mesFechado === 0 ? null : s.slice(0, mesFechado).reduce<number | null>((acc, v) => (v === null ? acc : (acc ?? 0) + v), null);
  const ytdEstoque = (s: (number | null)[]) => (mesFechado === 0 ? null : s[mesFechado - 1]);
  const ytdOrcFluxo = (m: string) => Array.from({ length: mesFechado }, (_, i) => orcado[m]?.[i + 1] ?? 0).reduce((a, b) => a + b, 0);
  const ytdOrcEstoque = (m: string) => orcado[m]?.[mesFechado] ?? 0;
  // faturável orçado do mês = soma dos 3 orçados de receita (a métrica derivada não existe no seed;
  // a planilha soma o MRR mensal no faturável, então a soma direta é o conceito correto)
  const orcFaturavelMes = (mes: number) =>
    (orcado["mrr_ativo"]?.[mes] ?? 0) + (orcado["receita_pontual"]?.[mes] ?? 0) + (orcado["outras_receitas"]?.[mes] ?? 0);
  const ytdOrcFaturavel = () =>
    Array.from({ length: mesFechado }, (_, i) => orcFaturavelMes(i + 1)).reduce((a, b) => a + b, 0);
  // YTD orçado de linha percentual = média ponderada pelo faturável orçado (exata, derivável do seed)
  const ytdOrcPctPonderada = (metrica: string) => {
    let num = 0;
    let den = 0;
    for (let mes = 1; mes <= mesFechado; mes++) {
      const fatMes = orcFaturavelMes(mes);
      num += (orcado[metrica]?.[mes] ?? 0) * fatMes;
      den += fatMes;
    }
    return den ? num / den : 0;
  };

  const linhas: Linha[] = [
    buildLinhaGeral({ metrica: "receita_total", titulo: "Receita Total", tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade: "brl" }, orcado, receitaTotal, mesFechado),
    buildLinhaGeral({ metrica: "despesa_total", titulo: "Despesa Total", tipoAgregacao: "fluxo", direcao: "menor_melhor", unidade: "brl" }, orcado, despesaTotal, mesFechado),
    buildLinhaGeral({ metrica: "vendas_mrr", titulo: "Vendas MRR", tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade: "brl" }, orcado, vendasMrr, mesFechado),
    buildLinhaGeral({ metrica: "vendas_pontual", titulo: "Vendas Pontual", tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade: "brl" }, orcado, vendasPontual, mesFechado),
    buildLinhaGeral({ metrica: "colaboradores", titulo: "Número de Colaboradores", tipoAgregacao: "estoque", direcao: "neutro", unidade: "int" }, orcado, colaboradores, mesFechado),
    buildLinhaGeral({ metrica: "receita_cabeca", titulo: "Receita por Cabeça", tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade: "brl" }, orcado, receitaCabeca, mesFechado,
      mesFechado === 0 ? undefined : { orcado: razao(ytdOrcFluxo("receita_total"), ytdOrcEstoque("colaboradores")) ?? 0, realizado: razao(ytdFluxo(receitaTotal), ytdEstoque(colaboradores)) }),
    buildLinhaGeral({ metrica: "mrr_cabeca", titulo: "MRR por Cabeça", tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade: "brl" }, orcado, mrrCabeca, mesFechado,
      mesFechado === 0 ? undefined : { orcado: razao(ytdOrcEstoque("mrr_ativo"), ytdOrcEstoque("colaboradores")) ?? 0, realizado: razao(ytdEstoque(mrr), ytdEstoque(colaboradores)) }),
    buildLinhaGeral({ metrica: "clientes", titulo: "Número de Clientes", tipoAgregacao: "estoque", direcao: "maior_melhor", unidade: "int" }, orcado, clientes, mesFechado),
    buildLinhaGeral({ metrica: "contratos", titulo: "Número de Contratos", tipoAgregacao: "estoque", direcao: "maior_melhor", unidade: "int" }, orcado, contratos, mesFechado),
    buildLinhaGeral({ metrica: "ticket_cliente", titulo: "Ticket Médio por Cliente", tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade: "brl" }, orcado, ticketCliente, mesFechado,
      mesFechado === 0 ? undefined : { orcado: razao(ytdOrcEstoque("mrr_ativo"), ytdOrcEstoque("clientes")) ?? 0, realizado: razao(ytdEstoque(mrr), ytdEstoque(clientes)) }),
    buildLinhaGeral({ metrica: "ticket_contrato", titulo: "Ticket Médio por Contrato", tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade: "brl" }, orcado, ticketContrato, mesFechado,
      mesFechado === 0 ? undefined : { orcado: razao(ytdOrcEstoque("mrr_ativo"), ytdOrcEstoque("contratos")) ?? 0, realizado: razao(ytdEstoque(mrr), ytdEstoque(contratos)) }),
    buildLinhaGeral({ metrica: "churn_mes", titulo: "Churn do Mês", tipoAgregacao: "fluxo", direcao: "menor_melhor", unidade: "brl" }, orcado, churn, mesFechado),
    buildLinhaGeral({ metrica: "aliquota_efetiva", titulo: "Alíquota de Imposto Efetiva", tipoAgregacao: "fluxo", direcao: "menor_melhor", unidade: "pct" }, orcado, aliquota, mesFechado,
      mesFechado === 0 ? undefined : { orcado: razao(ytdOrcFluxo("impostos_receita") + ytdOrcFluxo("impostos_diretos"), ytdOrcFaturavel()) ?? 0, realizado: razao((ytdFluxo(impostosRec) ?? 0) + (ytdFluxo(impostosDir) ?? 0), ytdFluxo(fat)) }),
    buildLinhaGeral({ metrica: "margem_geracao", titulo: "Margem de Geração", tipoAgregacao: "fluxo", direcao: "maior_melhor", unidade: "pct" }, orcado, margemGeracao, mesFechado,
      mesFechado === 0 ? undefined : { orcado: ytdOrcPctPonderada("margem_geracao"), realizado: razao(ytdFluxo(geracao), ytdFluxo(fat)) }),
    buildLinhaGeral({ metrica: "saldo_caixa", titulo: "Saldo de Caixa", tipoAgregacao: "estoque", direcao: "maior_melhor", unidade: "brl", nota: NOTA_SALDO }, orcado, saldo, mesFechado),
    buildLinhaGeral({ metrica: "pessoas_csv", titulo: "Pessoas em CSV", tipoAgregacao: "estoque", direcao: "neutro", unidade: "int", nota: NOTA_PESSOAS }, orcado, mensal((m) => pessoasPorMes[m]?.csv ?? null), mesFechado),
    buildLinhaGeral({ metrica: "pessoas_cac", titulo: "Pessoas em CAC", tipoAgregacao: "estoque", direcao: "neutro", unidade: "int", nota: NOTA_PESSOAS }, orcado, mensal((m) => pessoasPorMes[m]?.cac ?? null), mesFechado),
    buildLinhaGeral({ metrica: "pessoas_sgea", titulo: "Pessoas em SGEA", tipoAgregacao: "estoque", direcao: "neutro", unidade: "int", nota: NOTA_PESSOAS }, orcado, mensal((m) => pessoasPorMes[m]?.sgea ?? null), mesFechado),
  ];
  return linhas;
}
```

ATENÇÕES para o implementador:
- Os YTDs das linhas percentuais usam os helpers já incluídos no código acima: alíquota = razão dos orçados de impostos sobre `ytdOrcFaturavel()`; margem = `ytdOrcPctPonderada("margem_geracao")` (média ponderada pelo faturável orçado — exata e derivável do seed).
- `mrr_cabeca`/tickets: a planilha calcula sobre o MRR do mês (estoque) — os YTD overrides acima já usam estoque no numerador.

- [ ] **Step 4: Integração em `bp2026.ts`.** Após montar `linhas` (todas as 19 do DRE) e antes do payload:

```typescript
      // 8. Métricas Gerais (sub-aba)
      const realizadoDre: Record<string, (number | null)[]> = {};
      for (const l of linhas) realizadoDre[l.metrica] = l.meses.map((m) => m.realizado);
      const metricasGerais = await montarMetricasGerais({
        db, orcado, realizadoDre,
        mrrInfoPorMes: mrrPorMes as any,
        pontualPorMes, dfcPorMes, mesCorrente, mesFechado,
      });
```

e incluir `metricasGerais` (com o mesmo tratamento de ytd já embutido) no payload. Import no topo. O cache existente cobre tudo.

- [ ] **Step 5: Smoke** — criar `bp2026-smoke.ts` na raiz (rodar, DELETAR antes do commit):

```typescript
import "dotenv/config";
import express from "express";
import { registerBp2026Routes } from "./server/routes/bp2026";
import { db } from "./server/db";
const app = express();
registerBp2026Routes(app, db);
const server = app.listen(3983, async () => {
  const json: any = await (await fetch("http://localhost:3983/api/bp2026/receitas")).json();
  console.log("metricasGerais:", json.metricasGerais?.length);
  for (const m of ["receita_total", "vendas_mrr", "colaboradores", "ticket_cliente", "aliquota_efetiva", "saldo_caixa", "pessoas_csv", "churn_mes"]) {
    const l = json.metricasGerais.find((x: any) => x.metrica === m);
    console.log(m, l.unidade, l.direcao, "jan:", l.meses[0].orcado, l.meses[0].realizado, "jul:", l.meses[6].realizado, "ytd:", JSON.stringify(l.ytd));
  }
  server.close(); process.exit(0);
});
```

Expected: 18 linhas; receita_total jan ≈ faturável jan − inadimplência jan (recompute do payload DRE); vendas_mrr jan 273531/215000; colaboradores jan 109/109 (atingimento 1.0, direcao neutro); ticket_cliente jan = mrr jan / clientes jan; aliquota jan ≈ (104303+2265)/1455536 ≈ 0.0732 vs orçado 0.1641; saldo_caixa jan ≈ saldoAtual − Σ dfc fev..jun; pessoas_csv com nota; churn jan 162431/104117; jul tudo null. `npx tsc --noEmit -p . 2>&1 | grep -i bp2026` vazio; `npx vitest run server/routes/bp2026.helpers.test.ts` 14/14.

- [ ] **Step 6: Commit**

```bash
git add server/routes/bp2026.metricas.ts server/routes/bp2026.ts
git commit -m "feat(bp2026): bloco métricas gerais no payload — fontes novas + derivadas das séries do DRE"
```

---

### Task 3: Frontend — Tabs e formatação por unidade

**Files:**
- Modify: `client/src/components/bp2026/BPDreTable.tsx`
- Modify: `client/src/pages/BP2026.tsx`

- [ ] **Step 1: BPDreTable.** 
  - `BPLinha` ganha `unidade?: "brl" | "int" | "pct";` e `direcao` passa a `"maior_melhor" | "menor_melhor" | "neutro"` (TAMBÉM em `corAtingimento` — `neutro` retorna `"text-gray-500 dark:text-zinc-400"`).
  - `fmtValor` vira `fmtValor(v, unidade)`: `brl` como hoje; `int` = `Math.round(v).toLocaleString("pt-BR")`; `pct` = `(v * 100).toFixed(1) + "%"`. `Celula` ganha prop `unidade` e repassa.
  - `onCellClick` vira opcional (`onCellClick?:`); célula só é clicável quando `onCellClick` existe E `m.realizado !== null`.
  - Os call sites de `Celula` passam `unidade={linha.unidade ?? "brl"}`.

- [ ] **Step 2: BP2026.tsx.** Importar Tabs (`@/components/ui/tabs` — verificar que existe; se não, usar dois botões com estado). Estrutura:

```tsx
<Tabs defaultValue="dre">
  <TabsList>
    <TabsTrigger value="dre">DRE</TabsTrigger>
    <TabsTrigger value="metricas">Métricas Gerais</TabsTrigger>
  </TabsList>
  <TabsContent value="dre">
    <BPDreTable linhas={data.linhas} mesCorrente={...} mesFechado={...} onCellClick={...} />
  </TabsContent>
  <TabsContent value="metricas">
    <BPDreTable linhas={data.metricasGerais} mesCorrente={...} mesFechado={...} />
  </TabsContent>
</Tabs>
```

`ReceitasResponse` ganha `metricasGerais: BPLinha[]`. O `BPCellDetail` continua montado fora das Tabs (só a aba DRE dispara onCellClick).

- [ ] **Step 3: Verificar** — tsc grep bp2026 vazio; reiniciar dev server; curl 200. Visual do controller: sub-aba com 18 linhas, int sem R$, pct com %, neutro cinza, notas, dark+light.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/bp2026/BPDreTable.tsx client/src/pages/BP2026.tsx
git commit -m "feat(bp2026): sub-aba métricas gerais com formatação por unidade e direção neutra"
```

---

### Task 4: Verificação final e PR

- [ ] **Step 1:** `npx vitest run` — 14 bp2026 verdes; suites pré-existentes com falha de ambiente ignoradas.
- [ ] **Step 2:** Review final do diff; push.
- [ ] **Step 3:** Criar PR novo para a main: título `feat: BP 2026 — sub-aba Métricas Gerais (parte 7)`, corpo resumindo fontes/decisões (mapeamento de setores aproximado, saldo retroativo, direção neutra), validações e specs. (`gh pr create --base main ...`; se GraphQL der 401, usar REST `gh api repos/Warleypablo/Cortex/pulls -X POST ...`.)
