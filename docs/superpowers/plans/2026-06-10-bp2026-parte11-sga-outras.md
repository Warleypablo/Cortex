# BP 2026 Parte 11 (sub-abas SG&A e Outras Receitas) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sexta e sétima sub-abas: detalhamento do SG&A por sub-linha (visão da aba SG&A da planilha) e de Outras Receitas.

**Architecture:** Seed +9; +predicados de sub-linha em `bp2026.predicados.ts`; módulo único `bp2026.detalhamentos.ts` (SG&A via `somaDespesaCaixaPorMes` exportado; Outras via query por competência idêntica ao DRE); 2 tabs novas.

**Spec:** `docs/superpowers/specs/2026-06-10-bp2026-parte11-sga-outras-design.md` (mapeamentos, notas, anti-drift — parte deste plano).

**Contexto:** worktree `/Users/mac0267/Cortex/.claude/worktrees/bp2026-metricas-gerais`, branch `feature/bp2026-metricas-gerais` (PR #248).

---

### Task 1: Seed — 9 métricas (abas SG&A e Outras Receitas)

**Files:**
- Modify: `scripts/seed-bp2026-orcado.py`

- [ ] **Step 1:** Em `LINHAS` (após as entradas da aba CSV; col default 3 — NÃO passar 4º elemento):

```python
    ("SG&A", 7, "sga_uzk"),
    ("SG&A", 8, "sga_backoffice"),
    ("SG&A", 9, "sga_software"),
    ("SG&A", 10, "sga_ocupacao"),
    ("SG&A", 12, "sga_premiacoes"),
    ("SG&A", 13, "sga_eventos"),
    ("SG&A", 14, "sga_outras"),
    ("Outras Receitas", 3, "or_receita_variavel"),
    ("Outras Receitas", 7, "or_stack_digital"),
```

(linha 11 da aba SG&A é o Caju — JÁ seedada como `beneficio_total_empresa` na Parte 7; não duplicar.)

Em `TOTAIS_ESPERADOS`:

```python
    "sga_uzk": 960000.0,
    "sga_backoffice": 616000.0,
    "sga_software": 565344.0,
    "sga_ocupacao": 404840.0,
    "sga_premiacoes": 60000.0,
    "sga_eventos": 180000.0,
    "sga_outras": 213032.0,
    "or_receita_variavel": 120000.0,
    "or_stack_digital": 78000.0,
```

- [ ] **Step 2:** Rodar e aplicar local+prod (comandos padrão; cwd /Users/mac0267/Cortex). Expected: `OK: 949 statements` (73 DELETEs + 876 INSERTs). Verificar 73×12 nos dois; spot-check jan: sga_uzk 80000, sga_outras 13336, or_receita_variavel 10000. Sanity: soma das 7 seedadas + beneficio_total_empresa jan (44000) = 298446 = orçado `sga`... ATENÇÃO: o orçado `sga` da Overview pode diferir da soma (Software/Caju agrupados diferente) — NÃO asserte contra `sga`; asserte só os totais individuais.

- [ ] **Step 3: Commit** — `feat(bp2026): seed dos detalhamentos de SG&A e outras receitas`

---

### Task 2: API — predicados de sub-linha + montarDetalhamentos

**Files:**
- Modify: `server/routes/bp2026.predicados.ts`
- Create: `server/routes/bp2026.detalhamentos.ts`
- Modify: `server/routes/bp2026.ts`

- [ ] **Step 1: Predicados.** Em `bp2026.predicados.ts`, adicionar APÓS os existentes (não alterar nenhum):

```typescript
// Sub-linhas do detalhamento SG&A (visão da aba SG&A da planilha).
// A união de uzk+backoffice+ocupacao+eventos(06.10.06)+premiacoes(06.10.08)+outras_sub
// = sga_bucket; software (06.10.01) e caju (06.10.04) vêm de outros buckets do DRE.
export const PREDICADOS_SGA_SUB: Record<string, SQL> = {
  sga_uzk: sql`categoria_nome LIKE '06.09%'`,
  sga_backoffice: sql`categoria_nome LIKE '06.08%'`,
  sga_software: sql`categoria_nome LIKE '06.10.01%'`,
  sga_ocupacao: sql`categoria_nome LIKE '06.02%'`,
  sga_premiacoes: sql`categoria_nome LIKE '06.10.08%'`,
  sga_eventos: sql`categoria_nome LIKE '06.10.06%'`,
  sga_outras_sub: sql`categoria_nome LIKE '06.01%' OR categoria_nome LIKE '06.03%'
            OR categoria_nome LIKE '06.10.02%' OR categoria_nome LIKE '06.10.03%'
            OR categoria_nome LIKE '06.10.07%'`,
};

// Sub-linhas do detalhamento de Outras Receitas (união = PREDICADO_OUTRAS_RECEITAS).
export const PREDICADOS_OUTRAS_SUB: Record<string, SQL> = {
  or_variavel: sql`categoria_nome LIKE '03.02%'`,
  or_stack: sql`categoria_nome LIKE '03.03%'`,
  or_demais: sql`categoria_nome LIKE '04.01%' OR categoria_nome LIKE '04.03%'`,
};
```

- [ ] **Step 2: Exportar o helper.** Em `bp2026.ts`, trocar `async function somaDespesaCaixaPorMes(` por `export async function somaDespesaCaixaPorMes(` (sem outras mudanças).

- [ ] **Step 3: Criar `server/routes/bp2026.detalhamentos.ts`:**

```typescript
// server/routes/bp2026.detalhamentos.ts
// Sub-abas SG&A (detalhe por sub-linha, visão da aba SG&A da planilha) e
// Outras Receitas (detalhe por categoria). Mesmos regimes do DRE:
// despesas em caixa (QUITADO), receitas por competência.
import { sql } from "drizzle-orm";
import { calcAtingimento, calcYtd, type MesValor } from "./bp2026.helpers";
import { PREDICADOS_SGA_SUB, PREDICADOS_OUTRAS_SUB } from "./bp2026.predicados";
import { somaDespesaCaixaPorMes } from "./bp2026";

interface MesLinha extends MesValor { atingimento: number | null }
interface Linha {
  metrica: string; titulo: string; tipoAgregacao: "fluxo" | "estoque";
  direcao: "maior_melhor" | "menor_melhor" | "neutro";
  unidade?: "brl" | "int" | "pct" | "dec"; nota?: string; destaque?: boolean;
  meses: MesLinha[];
  ytd: { orcado: number; realizado: number | null; atingimento: number | null };
}

const NOTA_SGA_TOTAL =
  "Visão da aba SG&A da planilha — difere da linha SG&A do DRE: aqui o Caju " +
  "entra integral (no DRE é rateado com CSV) e Software entra aqui (no DRE " +
  "está em CSV Stack).";

const NOTA_PREMIACOES = "A categoria do Conta Azul inclui uniformes e brindes.";
const NOTA_EVENTOS = "Mapeado para a categoria Confraternizações (06.10.06).";
const NOTA_DEMAIS =
  "Mentoria, Infoproduto e Turbooh não têm categorias próprias no Conta Azul — " +
  "agrupados com rendimentos e demais receitas (04.x).";

interface Deps {
  db: any;
  orcado: Record<string, Record<number, number>>;
  mesCorrente: number;
  mesFechado: number;
}

interface DefSub {
  metrica: string;            // chave do orçado (bp2026_orcado)
  titulo: string;
  predicado: keyof typeof PREDICADOS_SGA_SUB | keyof typeof PREDICADOS_OUTRAS_SUB;
  nota?: string;
}

const SUB_SGA: DefSub[] = [
  { metrica: "sga_uzk", titulo: "UZK", predicado: "sga_uzk" },
  { metrica: "sga_backoffice", titulo: "Backoffice", predicado: "sga_backoffice" },
  { metrica: "sga_software", titulo: "Software", predicado: "sga_software" },
  { metrica: "sga_ocupacao", titulo: "Ocupação", predicado: "sga_ocupacao" },
  { metrica: "beneficio_total_empresa", titulo: "Benefício Caju", predicado: "sga_caju" },
  { metrica: "sga_premiacoes", titulo: "Premiações", predicado: "sga_premiacoes", nota: NOTA_PREMIACOES },
  { metrica: "sga_eventos", titulo: "Eventos e Brindes Internos", predicado: "sga_eventos", nota: NOTA_EVENTOS },
  { metrica: "sga_outras", titulo: "Outras despesas", predicado: "sga_outras_sub" },
];

export async function montarDetalhamentos(deps: Deps): Promise<{ sga: Linha[]; outrasReceitas: Linha[] }> {
  const { db, orcado, mesCorrente, mesFechado } = deps;

  const mensal = (porMes: Record<number, number>) =>
    Array.from({ length: 12 }, (_, i) => (i + 1 <= mesCorrente ? porMes[i + 1] ?? 0 : null));

  const fazLinha = (
    def: { metrica: string; titulo: string; direcao: Linha["direcao"]; nota?: string; destaque?: boolean },
    serie: (number | null)[],
    orcadoMes: (m: number) => number
  ): Linha => {
    const meses: MesLinha[] = Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      const o = orcadoMes(mes);
      const r = serie[i];
      return { mes, orcado: o, realizado: r, atingimento: calcAtingimento(o, r) };
    });
    const ytd = mesFechado === 0
      ? { orcado: 0, realizado: null as number | null, atingimento: null as number | null }
      : (() => { const v = calcYtd(meses, mesFechado, "fluxo"); return { ...v, atingimento: calcAtingimento(v.orcado, v.realizado) }; })();
    return { ...def, tipoAgregacao: "fluxo", unidade: "brl", meses, ytd };
  };

  // ---- SG&A: caixa por predicado de sub-linha ----
  const sgaLinhas: Linha[] = [];
  const sgaSeries: (number | null)[][] = [];
  for (const def of SUB_SGA) {
    const predicado = def.predicado === "sga_caju"
      ? sql`categoria_nome LIKE '06.10.04%'`
      : PREDICADOS_SGA_SUB[def.predicado as keyof typeof PREDICADOS_SGA_SUB];
    const porMes = await somaDespesaCaixaPorMes(db, predicado);
    const serie = mensal(porMes);
    sgaSeries.push(serie);
    sgaLinhas.push(fazLinha(
      { metrica: def.metrica, titulo: def.titulo, direcao: "menor_melhor", nota: def.nota },
      serie,
      (m) => orcado[def.metrica]?.[m] ?? 0
    ));
  }
  const somaSeries = (series: (number | null)[][]) =>
    Array.from({ length: 12 }, (_, i) =>
      series.some((s) => s[i] === null) ? null : series.reduce((acc, s) => acc + (s[i] ?? 0), 0)
    );
  const sgaTotal = fazLinha(
    { metrica: "sga_total_detalhe", titulo: "SG&A (soma das sub-linhas)", direcao: "menor_melhor", nota: NOTA_SGA_TOTAL, destaque: true },
    somaSeries(sgaSeries),
    (m) => SUB_SGA.reduce((acc, d) => acc + (orcado[d.metrica]?.[m] ?? 0), 0)
  );

  // ---- Outras Receitas: competência, 3 agregações condicionais (mesmo regime do DRE) ----
  const outrasResult = await db.execute(sql`
    SELECT EXTRACT(MONTH FROM data_competencia)::int AS mes,
           SUM(valor_liquido::numeric) FILTER (WHERE ${PREDICADOS_OUTRAS_SUB.or_variavel}) AS variavel,
           SUM(valor_liquido::numeric) FILTER (WHERE ${PREDICADOS_OUTRAS_SUB.or_stack}) AS stack,
           SUM(valor_liquido::numeric) FILTER (WHERE ${PREDICADOS_OUTRAS_SUB.or_demais}) AS demais
    FROM "Conta Azul".caz_parcelas
    WHERE tipo_evento = 'RECEITA'
      AND data_competencia >= '2026-01-01' AND data_competencia < '2027-01-01'
      AND (${PREDICADOS_OUTRAS_SUB.or_variavel} OR ${PREDICADOS_OUTRAS_SUB.or_stack} OR ${PREDICADOS_OUTRAS_SUB.or_demais})
    GROUP BY 1 ORDER BY 1
  `);
  const orPorMes: Record<number, { variavel: number; stack: number; demais: number }> = {};
  for (const row of outrasResult.rows as any[]) {
    orPorMes[Number(row.mes)] = {
      variavel: parseFloat(row.variavel ?? 0), stack: parseFloat(row.stack ?? 0), demais: parseFloat(row.demais ?? 0),
    };
  }
  const orSerie = (k: "variavel" | "stack" | "demais") =>
    Array.from({ length: 12 }, (_, i) => (i + 1 <= mesCorrente ? orPorMes[i + 1]?.[k] ?? 0 : null));

  const orcDemais = (m: number) =>
    (orcado["outras_receitas"]?.[m] ?? 0) - (orcado["or_receita_variavel"]?.[m] ?? 0) - (orcado["or_stack_digital"]?.[m] ?? 0);

  const variavelL = fazLinha({ metrica: "or_receita_variavel", titulo: "Receita Variável", direcao: "maior_melhor" }, orSerie("variavel"), (m) => orcado["or_receita_variavel"]?.[m] ?? 0);
  const stackL = fazLinha({ metrica: "or_stack_digital", titulo: "Stack Digital", direcao: "maior_melhor" }, orSerie("stack"), (m) => orcado["or_stack_digital"]?.[m] ?? 0);
  const demaisL = fazLinha({ metrica: "or_demais", titulo: "Demais (Mentoria, Infoproduto, Turbooh…)", direcao: "maior_melhor", nota: NOTA_DEMAIS }, orSerie("demais"), orcDemais);
  const orTotal = fazLinha(
    { metrica: "or_total_detalhe", titulo: "Outras Receitas (total)", direcao: "maior_melhor", destaque: true },
    somaSeries([orSerie("variavel"), orSerie("stack"), orSerie("demais")]),
    (m) => orcado["outras_receitas"]?.[m] ?? 0
  );

  return { sga: [sgaTotal, ...sgaLinhas], outrasReceitas: [orTotal, variavelL, stackL, demaisL] };
}
```

ATENÇÃO: `sga_caju` não existe em PREDICADOS_SGA_SUB — o predicado é resolvido inline (mesma expressão do `beneficio_total` do DRE); alternativa equivalente: usar `PREDICADOS_DESPESA.beneficio_total` importado. Implementador escolhe e mantém comentário.

- [ ] **Step 4: Integração em `bp2026.ts`:** import; após `montarCapacity`, `const { sga: sgaDetalhe, outrasReceitas: outrasDetalhe } = await montarDetalhamentos({ db, orcado, mesCorrente, mesFechado });`; ambos no payload (`sgaDetalhe`, `outrasDetalhe`).

- [ ] **Step 5: Smoke** (porta 3974, DELETAR depois): sga 9 linhas, outras 4; INVARIANTE: or_total_detalhe.meses ≡ outras_receitas do DRE (cada mês, tolerância 0.01); sga_total jan = soma das 8 sub-linhas jan; orçado sga_total jan = 298446; or_demais orçado jan ≈ 5766.67 (20766.67 − 10000 − 5000); jul null. tsc grep bp2026 vazio; vitest 14/14.

- [ ] **Step 6: Commit** — `feat(bp2026): detalhamentos de SG&A e outras receitas por sub-linha`

---

### Task 3: Frontend — 2 tabs novas

**Files:**
- Modify: `client/src/pages/BP2026.tsx`

- [ ] `ReceitasResponse` ganha `sgaDetalhe: BPLinha[]; outrasDetalhe: BPLinha[];`; tabs `value="sga"` "SG&A" e `value="outras"` "Outras Receitas" com as respectivas tabelas (sem onCellClick), após Capacity.
- [ ] tsc grep vazio; dev server; curl 200; visual do controller. Commit — `feat(bp2026): sub-abas sg&a e outras receitas`

---

### Task 4: Verificação final e PR

- [ ] `npx vitest run`; push; atualizar PR #248 (título "partes 7-11" + seções) via REST.
