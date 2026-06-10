# BP 2026 — Orçado × Realizado (Parte 1: Receitas) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página nova `/bp-2026` comparando orçado (planilha BP) × realizado (banco) × % atingimento para o bloco de receitas do DRE, mês a mês.

**Architecture:** Tabela `cortex_core.bp2026_orcado` populada 1:1 da planilha por script de seed; rota nova isolada `server/routes/bp2026.ts` calcula o realizado ao vivo (ClickUp para MRR, Bitrix para Pontual, Conta Azul para Outras) com cache de 10 min; frontend é uma tabela DRE com seletor de mês + coluna YTD.

**Tech Stack:** Express + Drizzle (`db.execute(sql\`...\`)`), PostgreSQL (GCP), React + TypeScript + Tailwind + React Query, vitest.

**Spec:** `docs/superpowers/specs/2026-06-10-bp2026-orcado-realizado-design.md`

**Contexto para quem nunca viu o projeto:**
- Banco prod: GCP `34.95.249.110/dados_turbo`; local: `postgresql://cortex:dev123@localhost:5432/cortex_dev`. Senha prod: extrair do `.env` da raiz com `PROD_PASS=$(grep -E "^# *DB_PASSWORD=" .env | head -1 | sed -E 's/^# *DB_PASSWORD=//' | tr -d '"'"'"' \r')`.
- Schemas com espaço exigem aspas duplas: `"Conta Azul".caz_parcelas`, `"Clickup".cup_data_hist`.
- Mudança de schema DEVE ser aplicada em local **e** produção.
- Dev server: `npm run dev` (porta 3000, sem watch — matar com `lsof -ti:3000 | xargs kill -9` e reiniciar após mudanças de backend).
- Testes: `npx vitest run <arquivo>`.
- Valores de referência do realizado (validados em prod em 2026-06-10): MRR jan=1.119.046, fev=1.139.795, mar=1.260.758, abr=1.100.088, mai=1.030.229; Pontual (Bitrix) jan=318.311, fev=472.127, mar=333.635, abr=386.082, mai=364.076; Outras jan=18.179, fev=17.812, mar=14.636, abr=17.954, mai=15.992.

---

### Task 1: Tabela e seed do orçado

**Files:**
- Create: `scripts/seed-bp2026-orcado.py`

- [ ] **Step 1: Criar a tabela em local e produção**

```bash
SQL='CREATE TABLE IF NOT EXISTS cortex_core.bp2026_orcado (
  metrica TEXT NOT NULL,
  mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  valor NUMERIC NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (metrica, mes)
);'
PGPASSWORD=dev123 psql -h localhost -U cortex -d cortex_dev -c "$SQL"
cd /Users/mac0267/Cortex && PROD_PASS=$(grep -E "^# *DB_PASSWORD=" .env | head -1 | sed -E 's/^# *DB_PASSWORD=//' | tr -d '"'"'"' \r') && PGPASSWORD="$PROD_PASS" psql -h 34.95.249.110 -U postgres -d dados_turbo -c "$SQL"
```

Expected: `CREATE TABLE` nos dois bancos.

- [ ] **Step 2: Escrever o script de seed**

```python
#!/usr/bin/env python3
"""Seed de cortex_core.bp2026_orcado a partir da planilha BP 2026.

Lê a aba Overview (linhas 4-6 = MRR Ativo, Receita Pontual, Outras Receitas;
colunas C..N = Janeiro..Dezembro) e gera /tmp/seed-bp2026-orcado.sql.
Aborta se os totais lidos divergirem dos totais conhecidos da planilha.
"""
import openpyxl

XLSX = "BP 2026 - Turbo - Financials.xlsx"
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

wb = openpyxl.load_workbook(XLSX, data_only=True)
ws = wb["Overview"]

stmts = []
for row, metrica in LINHAS.items():
    valores = [ws.cell(row=row, column=col).value for col in range(3, 15)]  # C..N
    assert all(isinstance(v, (int, float)) for v in valores), f"{metrica}: célula vazia/não numérica: {valores}"
    total = sum(valores)
    esperado = TOTAIS_ESPERADOS[metrica]
    assert abs(total - esperado) < 1, f"{metrica}: total lido {total:.1f} != esperado {esperado:.1f}"
    stmts.append(f"DELETE FROM cortex_core.bp2026_orcado WHERE metrica = '{metrica}';")
    for mes, valor in enumerate(valores, 1):
        stmts.append(
            f"INSERT INTO cortex_core.bp2026_orcado (metrica, mes, valor) VALUES ('{metrica}', {mes}, {round(valor, 2)});"
        )

with open("/tmp/seed-bp2026-orcado.sql", "w") as f:
    f.write("BEGIN;\n" + "\n".join(stmts) + "\nCOMMIT;\n")

print(f"OK: {len(stmts)} statements em /tmp/seed-bp2026-orcado.sql")
```

- [ ] **Step 3: Rodar o script e aplicar nos dois bancos**

```bash
cd /Users/mac0267/Cortex && python3 scripts/seed-bp2026-orcado.py
PGPASSWORD=dev123 psql -h localhost -U cortex -d cortex_dev -f /tmp/seed-bp2026-orcado.sql
PROD_PASS=$(grep -E "^# *DB_PASSWORD=" .env | head -1 | sed -E 's/^# *DB_PASSWORD=//' | tr -d '"'"'"' \r') && PGPASSWORD="$PROD_PASS" psql -h 34.95.249.110 -U postgres -d dados_turbo -f /tmp/seed-bp2026-orcado.sql
```

Expected: `OK: 39 statements`, depois `COMMIT` nos dois bancos.

Nota: o script vive no repo principal junto com o xlsx; se executando a partir do worktree, rodar com `cd /Users/mac0267/Cortex` mesmo assim (o xlsx está só lá) e copiar o .py para o worktree para commit.

- [ ] **Step 4: Verificar o seed**

```bash
PGPASSWORD=dev123 psql -h localhost -U cortex -d cortex_dev -c "SELECT metrica, COUNT(*), ROUND(SUM(valor)) FROM cortex_core.bp2026_orcado GROUP BY metrica ORDER BY 1;"
```

Expected:
```
 mrr_ativo        | 12 | 20998078
 outras_receitas  | 12 |  1040111
 receita_pontual  | 12 |  4045000
```

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-bp2026-orcado.py
git commit -m "feat(bp2026): tabela e seed do orçado extraído 1:1 da planilha BP"
```

---

### Task 2: Helpers puros com testes (TDD)

**Files:**
- Create: `server/routes/bp2026.helpers.ts`
- Test: `server/routes/bp2026.helpers.test.ts`

- [ ] **Step 1: Escrever os testes (falhando)**

```typescript
// server/routes/bp2026.helpers.test.ts
import { describe, it, expect } from "vitest";
import { calcAtingimento, calcYtd, ultimoDiaDoMes } from "./bp2026.helpers";

describe("calcAtingimento", () => {
  it("calcula razão realizado/orçado", () => {
    expect(calcAtingimento(1156850, 1119046)).toBeCloseTo(0.9673, 3);
  });
  it("retorna null sem realizado", () => {
    expect(calcAtingimento(1156850, null)).toBeNull();
  });
  it("retorna null com orçado zero (sem divisão por zero)", () => {
    expect(calcAtingimento(0, 100)).toBeNull();
  });
});

describe("calcYtd", () => {
  const meses = [
    { mes: 1, orcado: 100, realizado: 90 },
    { mes: 2, orcado: 110, realizado: 120 },
    { mes: 3, orcado: 120, realizado: null },
  ];
  it("soma fluxo até o mês selecionado, ignorando meses sem realizado no realizado", () => {
    expect(calcYtd(meses, 2, "fluxo")).toEqual({ orcado: 210, realizado: 210 });
    expect(calcYtd(meses, 3, "fluxo")).toEqual({ orcado: 330, realizado: 210 });
  });
  it("estoque usa o valor do mês selecionado (ou último com dado)", () => {
    expect(calcYtd(meses, 2, "estoque")).toEqual({ orcado: 110, realizado: 120 });
    expect(calcYtd(meses, 3, "estoque")).toEqual({ orcado: 120, realizado: 120 });
  });
});

describe("ultimoDiaDoMes", () => {
  it("calcula último dia, inclusive fevereiro", () => {
    expect(ultimoDiaDoMes(2026, 2)).toBe("2026-02-28");
    expect(ultimoDiaDoMes(2026, 12)).toBe("2026-12-31");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run server/routes/bp2026.helpers.test.ts`
Expected: FAIL — "Cannot find module './bp2026.helpers'"

- [ ] **Step 3: Implementar os helpers**

```typescript
// server/routes/bp2026.helpers.ts
export interface MesValor {
  mes: number;
  orcado: number;
  realizado: number | null;
}

export type TipoAgregacao = "fluxo" | "estoque";

export function calcAtingimento(orcado: number, realizado: number | null): number | null {
  if (realizado === null || !orcado) return null;
  return realizado / orcado;
}

export function calcYtd(
  meses: MesValor[],
  mesAte: number,
  tipo: TipoAgregacao
): { orcado: number; realizado: number | null } {
  const ate = meses.filter((m) => m.mes <= mesAte);
  if (tipo === "estoque") {
    const orcado = ate.length ? ate[ate.length - 1].orcado : 0;
    const comDado = ate.filter((m) => m.realizado !== null);
    const realizado = comDado.length ? comDado[comDado.length - 1].realizado : null;
    return { orcado, realizado };
  }
  const orcado = ate.reduce((s, m) => s + m.orcado, 0);
  const comDado = ate.filter((m) => m.realizado !== null);
  const realizado = comDado.length
    ? comDado.reduce((s, m) => s + (m.realizado ?? 0), 0)
    : null;
  return { orcado, realizado };
}

export function ultimoDiaDoMes(ano: number, mes: number): string {
  const d = new Date(Date.UTC(ano, mes, 0));
  return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run server/routes/bp2026.helpers.test.ts`
Expected: PASS (7 testes)

- [ ] **Step 5: Commit**

```bash
git add server/routes/bp2026.helpers.ts server/routes/bp2026.helpers.test.ts
git commit -m "feat(bp2026): helpers de atingimento, YTD e fim de mês"
```

---

### Task 3: Rota GET /api/bp2026/receitas

**Files:**
- Create: `server/routes/bp2026.ts`
- Modify: `server/routes.ts` (import no topo junto dos outros, invocação perto da linha 8200)

- [ ] **Step 1: Implementar a rota**

```typescript
// server/routes/bp2026.ts
import type { Express } from "express";
import { sql } from "drizzle-orm";
import {
  calcAtingimento,
  calcYtd,
  ultimoDiaDoMes,
  type MesValor,
  type TipoAgregacao,
} from "./bp2026.helpers";

const ANO = 2026;
const CACHE_TTL_MS = 10 * 60 * 1000;

interface LinhaReceita {
  metrica: string;
  titulo: string;
  tipoAgregacao: TipoAgregacao;
  meses: Array<{
    mes: number;
    orcado: number;
    realizado: number | null;
    atingimento: number | null;
    fonteAproximada?: boolean;
  }>;
}

let cache: { payload: unknown; expiraEm: number } | null = null;

const LINHAS: Array<{ metrica: string; titulo: string; tipoAgregacao: TipoAgregacao }> = [
  { metrica: "mrr_ativo", titulo: "(+) MRR Ativo", tipoAgregacao: "estoque" },
  { metrica: "receita_pontual", titulo: "(+) Receita Pontual", tipoAgregacao: "fluxo" },
  { metrica: "outras_receitas", titulo: "(+) Outras Receitas", tipoAgregacao: "fluxo" },
];

export function registerBp2026Routes(app: Express, db: any) {
  app.get("/api/bp2026/receitas", async (_req, res) => {
    try {
      if (cache && Date.now() < cache.expiraEm) {
        return res.json(cache.payload);
      }

      // 1. Orçado
      const orcadoResult = await db.execute(sql`
        SELECT metrica, mes, valor::numeric AS valor
        FROM cortex_core.bp2026_orcado
        ORDER BY metrica, mes
      `);
      const orcado: Record<string, Record<number, number>> = {};
      for (const row of orcadoResult.rows as any[]) {
        if (!orcado[row.metrica]) orcado[row.metrica] = {};
        orcado[row.metrica][Number(row.mes)] = parseFloat(row.valor);
      }

      // 2. MRR realizado: último snapshot disponível dentro de cada mês
      const mrrResult = await db.execute(sql`
        WITH snaps AS (
          SELECT DISTINCT data_snapshot::date AS d
          FROM "Clickup".cup_data_hist
          WHERE data_snapshot::date >= '2026-01-01'
        ),
        alvo AS (
          SELECT gs.mes, MAX(s.d) AS snapshot_dia
          FROM generate_series(1, 12) AS gs(mes)
          JOIN snaps s
            ON s.d >= make_date(2026, gs.mes, 1)
           AND s.d < (make_date(2026, gs.mes, 1) + INTERVAL '1 month')
          GROUP BY gs.mes
        )
        SELECT a.mes, a.snapshot_dia::text AS snapshot_dia, SUM(h.valorr::numeric) AS mrr
        FROM alvo a
        JOIN "Clickup".cup_data_hist h ON h.data_snapshot::date = a.snapshot_dia
        WHERE h.status IN ('ativo', 'onboarding', 'triagem')
        GROUP BY a.mes, a.snapshot_dia
        ORDER BY a.mes
      `);
      const mrrPorMes: Record<number, { valor: number; snapshotDia: string }> = {};
      for (const row of mrrResult.rows as any[]) {
        mrrPorMes[Number(row.mes)] = {
          valor: parseFloat(row.mrr),
          snapshotDia: row.snapshot_dia,
        };
      }

      // 3. Pontual realizado: vendas ganhas no Bitrix
      const pontualResult = await db.execute(sql`
        SELECT EXTRACT(MONTH FROM data_fechamento)::int AS mes,
               SUM(valor_pontual::numeric) AS total
        FROM "Bitrix".crm_deal
        WHERE stage_name = 'Negócio Ganho'
          AND data_fechamento >= '2026-01-01' AND data_fechamento < '2027-01-01'
          AND valor_pontual > 0
        GROUP BY 1 ORDER BY 1
      `);
      const pontualPorMes: Record<number, number> = {};
      for (const row of pontualResult.rows as any[]) {
        pontualPorMes[Number(row.mes)] = parseFloat(row.total);
      }

      // 4. Outras receitas: Conta Azul por competência
      const outrasResult = await db.execute(sql`
        SELECT EXTRACT(MONTH FROM data_competencia)::int AS mes,
               SUM(valor_liquido::numeric) AS total
        FROM "Conta Azul".caz_parcelas
        WHERE tipo_evento = 'RECEITA'
          AND data_competencia >= '2026-01-01' AND data_competencia < '2027-01-01'
          AND (categoria_nome LIKE '03.02%' OR categoria_nome LIKE '03.03%'
               OR categoria_nome LIKE '04.01%' OR categoria_nome LIKE '04.03%')
        GROUP BY 1 ORDER BY 1
      `);
      const outrasPorMes: Record<number, number> = {};
      for (const row of outrasResult.rows as any[]) {
        outrasPorMes[Number(row.mes)] = parseFloat(row.total);
      }

      // 5. Montagem: meses futuros => realizado null
      const agora = new Date();
      const mesCorrente =
        agora.getFullYear() > ANO ? 12 : agora.getFullYear() < ANO ? 0 : agora.getMonth() + 1;

      const realizadoPorMetrica: Record<string, (mes: number) => number | null> = {
        mrr_ativo: (mes) => (mes <= mesCorrente ? mrrPorMes[mes]?.valor ?? null : null),
        receita_pontual: (mes) => (mes <= mesCorrente ? pontualPorMes[mes] ?? null : null),
        outras_receitas: (mes) => (mes <= mesCorrente ? outrasPorMes[mes] ?? null : null),
      };

      const linhas: LinhaReceita[] = LINHAS.map(({ metrica, titulo, tipoAgregacao }) => ({
        metrica,
        titulo,
        tipoAgregacao,
        meses: Array.from({ length: 12 }, (_, i) => {
          const mes = i + 1;
          const o = orcado[metrica]?.[mes] ?? 0;
          const r = realizadoPorMetrica[metrica](mes);
          const fonteAproximada =
            metrica === "mrr_ativo" && r !== null && mes < mesCorrente
              ? mrrPorMes[mes]?.snapshotDia !== ultimoDiaDoMes(ANO, mes)
              : undefined;
          return { mes, orcado: o, realizado: r, atingimento: calcAtingimento(o, r), fonteAproximada };
        }),
      }));

      // 6. Linha derivada: Receita Total Faturável
      const totalMeses: MesValor[] = Array.from({ length: 12 }, (_, i) => {
        const mes = i + 1;
        const orcadoTotal = linhas.reduce((s, l) => s + l.meses[i].orcado, 0);
        const algumRealizado = linhas.some((l) => l.meses[i].realizado !== null);
        const realizadoTotal = algumRealizado
          ? linhas.reduce((s, l) => s + (l.meses[i].realizado ?? 0), 0)
          : null;
        return { mes, orcado: orcadoTotal, realizado: realizadoTotal };
      });
      linhas.push({
        metrica: "receita_total_faturavel",
        titulo: "(=) Receita Total Faturável",
        tipoAgregacao: "fluxo",
        meses: totalMeses.map((m) => ({
          ...m,
          atingimento: calcAtingimento(m.orcado, m.realizado),
        })),
      });

      // 7. YTD por linha (até o mês corrente, ou dez se ano encerrado)
      const mesYtd = Math.max(1, Math.min(mesCorrente, 12));
      const payload = {
        ano: ANO,
        mesCorrente,
        linhas: linhas.map((l) => ({
          ...l,
          ytd: (() => {
            const v = calcYtd(l.meses, mesYtd, l.tipoAgregacao);
            return { ...v, atingimento: calcAtingimento(v.orcado, v.realizado) };
          })(),
        })),
        atualizadoEm: new Date().toISOString(),
      };

      cache = { payload, expiraEm: Date.now() + CACHE_TTL_MS };
      res.json(payload);
    } catch (error) {
      console.error("[bp2026] Erro em /api/bp2026/receitas:", error);
      res.status(500).json({ error: "Erro ao calcular orçado x realizado" });
    }
  });
}
```

- [ ] **Step 2: Registrar em routes.ts**

Em `server/routes.ts`, junto aos imports de rotas (perto da linha 77):

```typescript
import { registerBp2026Routes } from "./routes/bp2026";
```

E junto às invocações (perto da linha 8200, após `registerEstoquePontualRoutes(app, db);`):

```typescript
registerBp2026Routes(app, db);
```

- [ ] **Step 3: Reiniciar dev server e testar o endpoint**

```bash
lsof -ti:3000 | xargs kill -9; npm run dev &
sleep 8
curl -s localhost:3000/api/bp2026/receitas | python3 -m json.tool | head -40
```

Expected: JSON com 4 linhas; conferir contra os valores de referência do cabeçalho do plano (MRR jan=1119046, Pontual jan=318311, Outras jan≈18179). Atenção: se a rota exigir sessão autenticada (middleware `isAuthenticated` global em `/api`), validar via browser logado em `localhost:3000/api/bp2026/receitas`.

- [ ] **Step 4: Commit**

```bash
git add server/routes/bp2026.ts server/routes.ts
git commit -m "feat(bp2026): endpoint /api/bp2026/receitas com orçado x realizado"
```

---

### Task 4: Componentes de UI

**Files:**
- Create: `client/src/components/bp2026/BPMonthSelector.tsx`
- Create: `client/src/components/bp2026/BPDreTable.tsx`

- [ ] **Step 1: BPMonthSelector**

```tsx
// client/src/components/bp2026/BPMonthSelector.tsx
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface Props {
  mes: number; // 1-12
  mesMaximo: number; // último mês com dado (mesCorrente)
  onChange: (mes: number) => void;
}

export function BPMonthSelector({ mes, mesMaximo, onChange }: Props) {
  return (
    <div className="flex items-center gap-2" data-testid="bp-month-selector">
      <Button
        variant="outline"
        size="icon"
        disabled={mes <= 1}
        onClick={() => onChange(mes - 1)}
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-36 text-center font-semibold text-gray-900 dark:text-white">
        {MESES[mes - 1]} 2026
      </span>
      <Button
        variant="outline"
        size="icon"
        disabled={mes >= mesMaximo}
        onClick={() => onChange(mes + 1)}
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: BPDreTable**

```tsx
// client/src/components/bp2026/BPDreTable.tsx
import { formatCurrencyNoDecimals } from "@/lib/utils";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

export interface BPMes {
  mes: number;
  orcado: number;
  realizado: number | null;
  atingimento: number | null;
  fonteAproximada?: boolean;
}

export interface BPLinha {
  metrica: string;
  titulo: string;
  tipoAgregacao: "fluxo" | "estoque";
  meses: BPMes[];
  ytd: { orcado: number; realizado: number | null; atingimento: number | null };
}

function corAtingimento(a: number | null): string {
  if (a === null) return "text-gray-400 dark:text-zinc-500";
  if (a >= 1) return "text-emerald-600 dark:text-emerald-400";
  if (a >= 0.9) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function fmtPct(a: number | null): string {
  return a === null ? "—" : `${(a * 100).toFixed(1)}%`;
}

function fmtValor(v: number | null): string {
  return v === null ? "—" : formatCurrencyNoDecimals(v);
}

interface Props {
  linhas: BPLinha[];
  mes: number; // 1-12
}

export function BPDreTable({ linhas, mes }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-zinc-700">
      <table className="w-full text-sm" data-testid="bp-dre-table">
        <thead>
          <tr className="bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400">
            <th className="px-4 py-3 text-left font-medium">Linha</th>
            <th className="px-4 py-3 text-right font-medium">Orçado</th>
            <th className="px-4 py-3 text-right font-medium">Realizado</th>
            <th className="px-4 py-3 text-right font-medium">Atingimento</th>
            <th className="px-4 py-3 text-right font-medium border-l border-gray-200 dark:border-zinc-700">
              YTD Orçado
            </th>
            <th className="px-4 py-3 text-right font-medium">YTD Realizado</th>
            <th className="px-4 py-3 text-right font-medium">YTD Ating.</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => {
            const m = linha.meses[mes - 1];
            const ehTotal = linha.metrica === "receita_total_faturavel";
            return (
              <tr
                key={linha.metrica}
                className={
                  ehTotal
                    ? "bg-gray-100 dark:bg-zinc-800 font-bold text-gray-900 dark:text-white"
                    : "border-t border-gray-100 dark:border-zinc-800 text-gray-800 dark:text-zinc-200"
                }
                data-testid={`bp-linha-${linha.metrica}`}
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="flex items-center gap-1.5">
                    {linha.titulo}
                    {m.fonteAproximada && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-amber-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Snapshot do ClickUp não disponível no último dia do mês;
                            usado o mais próximo anterior.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtValor(m.orcado)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtValor(m.realizado)}</td>
                <td className={`px-4 py-3 text-right tabular-nums font-semibold ${corAtingimento(m.atingimento)}`}>
                  {fmtPct(m.atingimento)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums border-l border-gray-200 dark:border-zinc-700">
                  {fmtValor(linha.ytd.orcado)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtValor(linha.ytd.realizado)}</td>
                <td className={`px-4 py-3 text-right tabular-nums font-semibold ${corAtingimento(linha.ytd.atingimento)}`}>
                  {fmtPct(linha.ytd.atingimento)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

Nota: o YTD exibido é o acumulado até o **mês corrente** (vem pronto da API). Se o produto preferir YTD até o mês *selecionado*, calcular no cliente com os `meses` da linha — decisão de UI a validar no teste local; manter o da API na primeira versão.

- [ ] **Step 3: Conferir tipagens compilando**

```bash
npx tsc --noEmit -p . 2>&1 | grep -i bp2026
```

Expected: nenhuma linha (sem erros nos arquivos novos).

- [ ] **Step 4: Commit**

```bash
git add client/src/components/bp2026/
git commit -m "feat(bp2026): componentes BPDreTable e BPMonthSelector"
```

---

### Task 5: Página, rota e menu

**Files:**
- Create: `client/src/pages/BP2026.tsx`
- Modify: `client/src/App.tsx` (lazy import perto da linha 87; rota perto da linha 355)
- Modify: `shared/nav-config.ts` (item no grupo Financeiro, perto da linha 455; mapeamento de rota perto da linha 232)

- [ ] **Step 1: Página**

```tsx
// client/src/pages/BP2026.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BPDreTable, type BPLinha } from "@/components/bp2026/BPDreTable";
import { BPMonthSelector } from "@/components/bp2026/BPMonthSelector";
import { Skeleton } from "@/components/ui/skeleton";

interface ReceitasResponse {
  ano: number;
  mesCorrente: number;
  linhas: BPLinha[];
  atualizadoEm: string;
}

export default function BP2026() {
  const { data, isLoading, error } = useQuery<ReceitasResponse>({
    queryKey: ["/api/bp2026/receitas"],
  });
  const [mes, setMes] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 text-red-600 dark:text-red-400">
        Erro ao carregar o orçado × realizado. Tente novamente.
      </div>
    );
  }

  const mesAtivo = mes ?? Math.max(1, Math.min(data.mesCorrente, 12));

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            BP 2026 — Orçado × Realizado
          </h1>
          <p className="text-sm text-gray-600 dark:text-zinc-400">
            Bloco de receitas · orçado fechado em dezembro/2025 · realizado ao vivo
          </p>
        </div>
        <BPMonthSelector
          mes={mesAtivo}
          mesMaximo={Math.max(1, Math.min(data.mesCorrente, 12))}
          onChange={setMes}
        />
      </div>
      <BPDreTable linhas={data.linhas} mes={mesAtivo} />
      <p className="text-xs text-gray-500 dark:text-zinc-500">
        MRR: ClickUp (snapshot fim do mês) · Pontual: Bitrix (vendas ganhas — proxy de
        faturamento) · Outras: Conta Azul (competência). Atualizado em{" "}
        {new Date(data.atualizadoEm).toLocaleString("pt-BR")}.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Rota no App.tsx**

Perto da linha 87 (junto dos outros lazy imports):

```typescript
const BP2026 = lazyWithRetry(() => import("@/pages/BP2026"));
```

Perto da linha 355 (junto das outras rotas financeiras):

```tsx
<Route path="/bp-2026">{() => <ProtectedRoute path="/bp-2026" component={BP2026} />}</Route>
```

- [ ] **Step 3: Menu em shared/nav-config.ts**

No grupo `Financeiro` de `setores` (perto da linha 455), após a linha do DRE:

```typescript
{ title: 'BP Orçado × Realizado', url: '/bp-2026', icon: 'Target', permissionKey: PERMISSION_KEYS.FIN.DRE },
```

No mapeamento de rotas→permissões (perto da linha 232), após `'/dashboard/dre'`:

```typescript
'/bp-2026': PERMISSION_KEYS.FIN.DRE,
```

Razão: reutiliza a permissão `fin.dre` — quem vê o DRE vê o BP (mesmo público; evita criar/atribuir permissão nova nesta parte).

- [ ] **Step 4: Testar no browser (dark E light)**

```bash
lsof -ti:3000 | xargs kill -9; npm run dev &
```

Abrir `localhost:3000/bp-2026` logado e verificar:
- Tabela mostra 4 linhas com valores do mês corrente; navegar ◀ ▶ até janeiro e conferir: MRR orçado 1.156.850 / realizado 1.119.046 / 96,7%; Pontual 240.000 / 318.311 / 132,6%; Outras 20.767 / 18.179 / 87,5%.
- Meses futuros inacessíveis pelo seletor.
- Alternar tema claro/escuro e conferir contraste de cores de atingimento.
- Item "BP Orçado × Realizado" visível no menu Financeiro.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/BP2026.tsx client/src/App.tsx shared/nav-config.ts
git commit -m "feat(bp2026): página /bp-2026 com tabela DRE, seletor de mês e menu"
```

---

### Task 6: Verificação final e PR

- [ ] **Step 1: Rodar a suíte de testes completa**

Run: `npx vitest run`
Expected: todos os testes passam (incluindo os pré-existentes).

- [ ] **Step 2: Conferir diff completo**

Run: `git log --oneline main..HEAD && git diff main --stat`
Revisar se só os arquivos do plano foram tocados.

- [ ] **Step 3: Push e PR para staging**

```bash
git push -u origin feature/bp2026-orcado-realizado
gh pr create --base staging --title "feat: BP 2026 Orçado × Realizado — Parte 1 (Receitas)" --body "$(cat <<'EOF'
## Resumo
- Página nova /bp-2026: orçado × realizado × atingimento do bloco de receitas do BP 2026
- Orçado extraído 1:1 da planilha BP (seed em cortex_core.bp2026_orcado)
- Realizado: MRR via ClickUp (snapshot fim do mês), Pontual via Bitrix (vendas ganhas), Outras via Conta Azul (competência)
- Substitui (em partes) a seção BP do OKR 2026, que permanece no ar

Spec: docs/superpowers/specs/2026-06-10-bp2026-orcado-realizado-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Workflow pós-conclusão (regra do projeto)**

Seguir o checklist de pós-conclusão do projeto: Obsidian vault + chamado no Cortex DB com status `review` (se houver chamado associado a esta task).
