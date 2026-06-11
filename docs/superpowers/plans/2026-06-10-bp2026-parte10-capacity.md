# BP 2026 Parte 10 (sub-aba Capacity) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quinta sub-aba "Capacity": dimensionamento de gestores de Performance e designers vs plano da aba CSV.

**Architecture:** Seed +8 métricas (aba CSV, col_inicial=4); módulo `bp2026.capacity.ts` (1 query Inhire por cargo; contratos extraídos do retorno do revenue); unidade `dec` no frontend + 5ª tab.

**Spec:** `docs/superpowers/specs/2026-06-10-bp2026-parte10-capacity-design.md` (linhas, fórmulas, anti-drift — parte deste plano).

**Contexto:** worktree `/Users/mac0267/Cortex/.claude/worktrees/bp2026-metricas-gerais`, branch `feature/bp2026-metricas-gerais` (PR #248). Referências (prod): cargo 'Gestor de Performance' 21 ativos hoje, 'Designer' 18; contratos_performance mai = 168 (payload da Revenue).

---

### Task 1: Seed — 8 métricas da aba CSV

**Files:**
- Modify: `scripts/seed-bp2026-orcado.py`

- [ ] **Step 1:** Em `LINHAS` (após as entradas da aba CAC):

```python
    ("CSV", 13, "capacity_gestores", 4),
    ("CSV", 14, "gestores_necessarios", 4),
    ("CSV", 15, "gestores_atuais", 4),
    ("CSV", 17, "contratos_por_gestor", 4),
    ("CSV", 55, "capacity_designers", 4),
    ("CSV", 56, "designers_necessarios", 4),
    ("CSV", 57, "designers_atuais", 4),
    ("CSV", 59, "contas_por_designer", 4),
```

Em `TOTAIS_ESPERADOS`:

```python
    "capacity_gestores": 144.0,
    "gestores_necessarios": 217.017081,
    "gestores_atuais": 258.0,
    "contratos_por_gestor": 121.090493,
    "capacity_designers": 312.0,
    "designers_necessarios": 100.16173,
    "designers_atuais": 111.0,
    "contas_por_designer": 281.36058,
```

- [ ] **Step 2:** Rodar e aplicar local+prod (comandos padrão; cwd /Users/mac0267/Cortex). Expected: `OK: 832 statements` (64 DELETEs + 768 INSERTs). Verificar 64×12 nos dois; spot-check jan: capacity_gestores 12, gestores_atuais 17, contratos_por_gestor ≈ 10.697064. Assert falhou → BLOCKED com valores lidos.

- [ ] **Step 3: Commit** — `feat(bp2026): seed do capacity (aba CSV) — gestores e designers`

---

### Task 2: API — montarCapacity

**Files:**
- Create: `server/routes/bp2026.capacity.ts`
- Modify: `server/routes/bp2026.ts`

- [ ] **Step 1: Criar `server/routes/bp2026.capacity.ts`:**

```typescript
// server/routes/bp2026.capacity.ts
// Sub-aba Capacity: dimensionamento de gestores de Performance e designers vs aba CSV.
// Contratos Performance vêm da série da Revenue; headcount por cargo do Inhire.
import { sql } from "drizzle-orm";
import { calcAtingimento, calcYtd, type MesValor } from "./bp2026.helpers";

interface MesLinha extends MesValor { atingimento: number | null }
interface Linha {
  metrica: string; titulo: string; tipoAgregacao: "fluxo" | "estoque";
  direcao: "maior_melhor" | "menor_melhor" | "neutro";
  unidade?: "brl" | "int" | "pct" | "dec"; nota?: string; destaque?: boolean;
  meses: MesLinha[];
  ytd: { orcado: number; realizado: number | null; atingimento: number | null };
}

const NOTA_CONTRATOS_GESTOR =
  "Capacity planejada: 12 contratos/gestor. Acima do orçado = eficiência, " +
  "mas risco de churn por sobrecarga.";

const NOTA_DESIGNERS =
  "Conta todos com cargo Designer no Inhire — pode incluir designers fora " +
  "da operação de Performance.";

interface Deps {
  db: any;
  orcado: Record<string, Record<number, number>>;
  contratosPerformance: (number | null)[]; // série mensal (12) extraída do payload da Revenue
  mesCorrente: number;
  mesFechado: number;
}

function razao(num: number | null, den: number | null): number | null {
  if (num === null || den === null || !den) return null;
  return num / den;
}

export async function montarCapacity(deps: Deps): Promise<Linha[]> {
  const { db, orcado, contratosPerformance, mesCorrente, mesFechado } = deps;

  const result = await db.execute(sql`
    SELECT gs.mes,
           COUNT(*) FILTER (WHERE TRIM(p.cargo) = 'Gestor de Performance') AS gestores,
           COUNT(*) FILTER (WHERE TRIM(p.cargo) = 'Designer') AS designers
    FROM generate_series(1, 12) AS gs(mes)
    LEFT JOIN "Inhire".rh_pessoal p
      ON p.admissao IS NOT NULL
     AND p.admissao::date <= (make_date(2026, gs.mes, 1) + INTERVAL '1 month - 1 day')::date
     AND (p.demissao IS NULL OR p.demissao::date > (make_date(2026, gs.mes, 1) + INTERVAL '1 month - 1 day')::date)
    GROUP BY gs.mes ORDER BY gs.mes
  `);
  const hc: Record<number, { gestores: number; designers: number }> = {};
  for (const row of result.rows as any[]) {
    hc[Number(row.mes)] = { gestores: parseInt(row.gestores), designers: parseInt(row.designers) };
  }

  const mensal = (f: (m: number) => number | null) =>
    Array.from({ length: 12 }, (_, i) => (i + 1 <= mesCorrente ? f(i + 1) : null));

  const contratos = contratosPerformance;
  const gestores = mensal((m) => hc[m]?.gestores ?? null);
  const designers = mensal((m) => hc[m]?.designers ?? null);
  const orcDe = (metrica: string) => (m: number) => orcado[metrica]?.[m] ?? 0;

  const gestoresNec = Array.from({ length: 12 }, (_, i) =>
    razao(contratos[i], orcado["capacity_gestores"]?.[i + 1] ?? 0)
  );
  const designersNec = Array.from({ length: 12 }, (_, i) =>
    razao(contratos[i], orcado["capacity_designers"]?.[i + 1] ?? 0)
  );
  const necessidade = Array.from({ length: 12 }, (_, i) =>
    gestoresNec[i] === null || gestores[i] === null ? null : gestoresNec[i]! - gestores[i]!
  );
  const contratosPorGestor = Array.from({ length: 12 }, (_, i) => razao(contratos[i], gestores[i]));
  const contasPorDesigner = Array.from({ length: 12 }, (_, i) => razao(contratos[i], designers[i]));

  const fazLinha = (
    def: { metrica: string; titulo: string; tipoAgregacao: "fluxo" | "estoque"; direcao: Linha["direcao"]; unidade: NonNullable<Linha["unidade"]>; nota?: string; destaque?: boolean },
    serie: (number | null)[],
    orcadoMes: (m: number) => number,
    ytdOverride?: { orcado: number; realizado: number | null }
  ): Linha => {
    const meses: MesLinha[] = Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      const o = orcadoMes(mes);
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

  // todas as linhas são posições → tipoAgregacao estoque; YTD = posição no mês fechado
  const ytdPos = (serie: (number | null)[], orcadoMes: (m: number) => number) =>
    mesFechado === 0 ? undefined : { orcado: orcadoMes(mesFechado), realizado: serie[mesFechado - 1] };

  return [
    fazLinha({ metrica: "cap_contratos_performance", titulo: "Contratos Performance", tipoAgregacao: "estoque", direcao: "maior_melhor", unidade: "int", destaque: true }, contratos, orcDe("contratos_performance"), ytdPos(contratos, orcDe("contratos_performance"))),
    fazLinha({ metrica: "gestores_necessarios", titulo: "Gestores necessários", tipoAgregacao: "estoque", direcao: "neutro", unidade: "dec" }, gestoresNec, orcDe("gestores_necessarios"), ytdPos(gestoresNec, orcDe("gestores_necessarios"))),
    fazLinha({ metrica: "gestores_atuais", titulo: "Gestores atuais", tipoAgregacao: "estoque", direcao: "neutro", unidade: "int" }, gestores, orcDe("gestores_atuais"), ytdPos(gestores, orcDe("gestores_atuais"))),
    fazLinha({ metrica: "necessidade_gestores", titulo: "Necessidade de contratar (gestores)", tipoAgregacao: "estoque", direcao: "neutro", unidade: "dec" }, necessidade,
      (m) => (orcado["gestores_necessarios"]?.[m] ?? 0) - (orcado["gestores_atuais"]?.[m] ?? 0),
      ytdPos(necessidade, (m) => (orcado["gestores_necessarios"]?.[m] ?? 0) - (orcado["gestores_atuais"]?.[m] ?? 0))),
    fazLinha({ metrica: "contratos_por_gestor", titulo: "Contratos por gestor", tipoAgregacao: "estoque", direcao: "neutro", unidade: "dec", nota: NOTA_CONTRATOS_GESTOR }, contratosPorGestor, orcDe("contratos_por_gestor"), ytdPos(contratosPorGestor, orcDe("contratos_por_gestor"))),
    fazLinha({ metrica: "designers_necessarios", titulo: "Designers necessários", tipoAgregacao: "estoque", direcao: "neutro", unidade: "dec" }, designersNec, orcDe("designers_necessarios"), ytdPos(designersNec, orcDe("designers_necessarios"))),
    fazLinha({ metrica: "designers_atuais", titulo: "Designers atuais", tipoAgregacao: "estoque", direcao: "neutro", unidade: "int", nota: NOTA_DESIGNERS }, designers, orcDe("designers_atuais"), ytdPos(designers, orcDe("designers_atuais"))),
    fazLinha({ metrica: "contas_por_designer", titulo: "Contas por designer", tipoAgregacao: "estoque", direcao: "neutro", unidade: "dec" }, contasPorDesigner, orcDe("contas_por_designer"), ytdPos(contasPorDesigner, orcDe("contas_por_designer"))),
  ];
}
```

ATENÇÃO: o atingimento de `necessidade_gestores` pode dividir por orçado negativo/zero — `calcAtingimento` já devolve null para orçado 0; para orçado negativo a razão fica matematicamente válida porém sem leitura útil — aceito (direção neutra, cinza).

- [ ] **Step 2: Integração em `bp2026.ts`:** import; após `montarFunil`:

```typescript
      // 11. Capacity (sub-aba) — contratos Performance extraídos do retorno da Revenue
      const contratosPerformanceSerie =
        revenue.find((l) => l.metrica === "contratos_performance")?.meses.map((m) => m.realizado) ??
        Array.from({ length: 12 }, () => null);
      const capacity = await montarCapacity({
        db, orcado, contratosPerformance: contratosPerformanceSerie, mesCorrente, mesFechado,
      });
```

e `capacity` no payload.

- [ ] **Step 3: Smoke** (porta 3976, DELETAR depois): 8 linhas; identidades: cap_contratos_performance ≡ contratos_performance da Revenue; gestores_necessarios mai = contratos mai ÷ 12 (recompute); contratos_por_gestor mai = contratos ÷ gestores reais; necessidade = necessários − atuais; jul null; unidades dec/int corretas. tsc grep bp2026 vazio; vitest 14/14.

- [ ] **Step 4: Commit** — `feat(bp2026): sub-aba capacity — gestores e designers vs plano`

---

### Task 3: Frontend — unidade dec + 5ª tab

**Files:**
- Modify: `client/src/components/bp2026/BPDreTable.tsx`
- Modify: `client/src/pages/BP2026.tsx`

- [ ] **Step 1: BPDreTable:** tipo de `unidade` ganha `"dec"` (em `BPLinha`, `CelulaProps` e `fmtValor`):

```typescript
function fmtValor(v: number | null, unidade: "brl" | "int" | "pct" | "dec" = "brl"): string {
  if (v === null) return "—";
  if (unidade === "pct") return `${(v * 100).toFixed(1)}%`;
  if (unidade === "dec") return v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return Math.round(v).toLocaleString("pt-BR");
}
```

(o branch `int` colapsa no fallback — pode remover o if redundante de `int` se existir.)

- [ ] **Step 2: BP2026.tsx:** `ReceitasResponse.capacity: BPLinha[];`; 5ª tab `value="capacity"` "Capacity" com `linhas={data.capacity}` (sem onCellClick).

- [ ] **Step 3:** tsc grep vazio; dev server; curl 200; visual do controller (5ª aba, decimais com 1 casa, neutros cinza, notas, dark+light). Commit — `feat(bp2026): quinta sub-aba capacity com unidade decimal`

---

### Task 4: Verificação final e PR

- [ ] `npx vitest run` (14 bp2026); push; atualizar PR #248 (título "partes 7-10" + seção Capacity) via REST.
