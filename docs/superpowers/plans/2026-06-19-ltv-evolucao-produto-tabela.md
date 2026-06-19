# Sub-aba Tabela de Evolução de LT/LTV por produto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma sub-aba "Tabela" ao card *Evolução de LT/LTV por produto* (tela `/lt-ltv-churn`), com filtro de status Ativos/Cancelados/Todos, mostrando LT (meses) e LTV (R$) por produto × mês.

**Architecture:** Backend reaproveita a query de snapshot do endpoint `evolucao-produto` (Ativos) e a view `cortex_core.vw_lt_contratos` (Cancelados por coorte de `data_fim`); o pivoteamento/bucketing/médias-medianas é feito por função pura testável em `ltLtvChurn.helpers.ts`. Frontend transforma o card `EvolucaoProduto` num container com `Tabs` (Gráfico = atual extraído; Tabela = nova), com os toggles de métrica/agregador compartilhados.

**Tech Stack:** TypeScript, Express, Drizzle (`sql` template), PostgreSQL; React + React Query + Recharts + Tailwind + shadcn/ui (`Tabs`, `Select`); Vitest.

## Global Constraints

- Spec de referência: `docs/superpowers/specs/2026-06-19-ltv-evolucao-produto-tabela-design.md`.
- Status em `cup_data_hist` é minúsculo; usar igualdade exata, **nunca** `ILIKE '%ativo%'`.
- Ativos = `status IN ('ativo','onboarding','triagem')`; cancelados = `is_churned` da view.
- Excluir LT negativo: Ativos via `data_snapshot >= data_inicio`; Cancelados via `NOT data_inconsistente`.
- Só recorrentes (`valorr > 0`). LTV = `valorr × LT`.
- Cobertura de produto `≥ 0.5` por mês no lado snapshot (gotcha do `produto` vazio).
- Produtos-linha: `Performance`, `Social Media`, `Creators`, `Outros`, `Total`.
- Dark/light mode obrigatório (classes `dark:`).
- Commits Conventional Commits, terminando com:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Sem migração de banco: `vw_lt_contratos` já existe.

## File Structure

- **Modify** `server/routes/ltLtvChurn.helpers.ts` — adicionar `PRODUTOS_PRINCIPAIS`, `BUCKETS_ORDER`, `produtoBucket`, `mediana`, `buildMatrizEvolucaoProduto` e tipos `ContratoMesRow`, `CelulaMetrica`, `MatrizEvolucao`.
- **Modify** `server/routes/ltLtvChurn.helpers.test.ts` — testes das funções puras novas.
- **Modify** `server/routes/ltLtvChurn.ts` — novo endpoint `GET /api/lt-ltv-churn/evolucao-produto-tabela`.
- **Modify** `client/src/components/lt-ltv-churn/types.ts` — tipo `EvolucaoProdutoTabelaData`.
- **Create** `client/src/components/lt-ltv-churn/TabelaEvolucaoProduto.tsx` — render da tabela + select de status.
- **Create** `client/src/components/lt-ltv-churn/GraficoEvolucaoProduto.tsx` — gráfico atual extraído (parametrizado por props).
- **Modify** `client/src/components/lt-ltv-churn/EvolucaoProduto.tsx` — container com `Tabs` + toggles compartilhados.

---

### Task 1: Helpers de pivoteamento (lógica pura) + testes

**Files:**
- Modify: `server/routes/ltLtvChurn.helpers.ts`
- Test: `server/routes/ltLtvChurn.helpers.test.ts`

**Interfaces:**
- Consumes: nada (funções puras).
- Produces:
  - `PRODUTOS_PRINCIPAIS: readonly ["Performance","Social Media","Creators"]`
  - `BUCKETS_ORDER: readonly ["Performance","Social Media","Creators","Outros","Total"]`
  - `produtoBucket(produto: string | null | undefined): "Performance"|"Social Media"|"Creators"|"Outros"`
  - `mediana(values: number[]): number`
  - `interface ContratoMesRow { mes: string; produto: string | null; lt: number; valorr: number }`
  - `interface CelulaMetrica { lt: number; ltv: number; lt_mediana: number; ltv_mediana: number; n: number }`
  - `interface MatrizEvolucao { meses: string[]; produtos: string[]; celulas: Record<string, Record<string, CelulaMetrica>> }`
  - `buildMatrizEvolucaoProduto(rows: ContratoMesRow[], meses: string[]): MatrizEvolucao`

- [ ] **Step 1: Escrever os testes (falhando)**

Adicionar ao final de `server/routes/ltLtvChurn.helpers.test.ts`. Ajustar o import da linha 2 para incluir os novos símbolos:

```ts
import {
  revenueChurnPct,
  resolveClienteSort,
  produtoBucket,
  mediana,
  buildMatrizEvolucaoProduto,
} from "./ltLtvChurn.helpers";
```

E acrescentar os blocos:

```ts
describe("produtoBucket", () => {
  it("mantém o nome dos 3 produtos principais", () => {
    expect(produtoBucket("Performance")).toBe("Performance");
    expect(produtoBucket("Social Media")).toBe("Social Media");
    expect(produtoBucket("Creators")).toBe("Creators");
  });
  it("joga qualquer outro produto (ou null) em Outros", () => {
    expect(produtoBucket("Broadcast")).toBe("Outros");
    expect(produtoBucket("CRM de Vendas")).toBe("Outros");
    expect(produtoBucket(null)).toBe("Outros");
    expect(produtoBucket(undefined)).toBe("Outros");
  });
});

describe("mediana", () => {
  it("ímpar = elemento do meio", () => {
    expect(mediana([4, 6, 10])).toBe(6);
  });
  it("par = média dos dois centrais", () => {
    expect(mediana([4, 6, 8, 12])).toBe(7);
  });
  it("vetor vazio retorna 0", () => {
    expect(mediana([])).toBe(0);
  });
});

describe("buildMatrizEvolucaoProduto", () => {
  const rows = [
    { mes: "2026-01", produto: "Performance", lt: 4, valorr: 1000 },
    { mes: "2026-01", produto: "Performance", lt: 6, valorr: 2000 },
    { mes: "2026-01", produto: "Broadcast", lt: 10, valorr: 500 },
    { mes: "2026-02", produto: "Creators", lt: 2, valorr: 3000 },
    { mes: "2025-12", produto: "Performance", lt: 99, valorr: 9999 }, // fora do eixo
  ];
  const meses = ["2026-01", "2026-02"];
  const out = buildMatrizEvolucaoProduto(rows, meses);

  it("preserva o eixo de meses recebido", () => {
    expect(out.meses).toEqual(["2026-01", "2026-02"]);
  });
  it("só lista buckets com dados, na ordem de BUCKETS_ORDER (Social Media sai)", () => {
    expect(out.produtos).toEqual(["Performance", "Creators", "Outros", "Total"]);
  });
  it("agrega média/mediana/n por produto e mês", () => {
    expect(out.celulas["Performance"]["2026-01"]).toEqual({
      lt: 5, ltv: 8000, lt_mediana: 5, ltv_mediana: 8000, n: 2,
    });
    expect(out.celulas["Outros"]["2026-01"]).toEqual({
      lt: 10, ltv: 5000, lt_mediana: 10, ltv_mediana: 5000, n: 1,
    });
  });
  it("Total soma todos os produtos do mês", () => {
    // lt [4,6,10] avg=6.7 mediana=6 ; ltv [4000,12000,5000] avg=7000 mediana=5000
    expect(out.celulas["Total"]["2026-01"]).toEqual({
      lt: 6.7, ltv: 7000, lt_mediana: 6, ltv_mediana: 5000, n: 3,
    });
  });
  it("ignora linhas de meses fora do eixo (2025-12)", () => {
    expect(out.celulas["Performance"]["2025-12"]).toBeUndefined();
  });
  it("célula sem dado fica ausente (não vira 0)", () => {
    expect(out.celulas["Performance"]?.["2026-02"]).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `npx vitest run server/routes/ltLtvChurn.helpers.test.ts`
Expected: FAIL — `produtoBucket is not a function` / `buildMatrizEvolucaoProduto is not exported`.

- [ ] **Step 3: Implementar as funções**

Acrescentar ao final de `server/routes/ltLtvChurn.helpers.ts`:

```ts
export const PRODUTOS_PRINCIPAIS = ["Performance", "Social Media", "Creators"] as const;
export const BUCKETS_ORDER = ["Performance", "Social Media", "Creators", "Outros", "Total"] as const;

export function produtoBucket(
  produto: string | null | undefined,
): "Performance" | "Social Media" | "Creators" | "Outros" {
  if (produto === "Performance" || produto === "Social Media" || produto === "Creators") {
    return produto;
  }
  return "Outros";
}

export function mediana(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface ContratoMesRow {
  mes: string; // 'YYYY-MM'
  produto: string | null;
  lt: number; // meses
  valorr: number;
}

export interface CelulaMetrica {
  lt: number;
  ltv: number;
  lt_mediana: number;
  ltv_mediana: number;
  n: number;
}

export interface MatrizEvolucao {
  meses: string[];
  produtos: string[];
  celulas: Record<string, Record<string, CelulaMetrica>>;
}

export function buildMatrizEvolucaoProduto(
  rows: ContratoMesRow[],
  meses: string[],
): MatrizEvolucao {
  type Acc = { lt: number[]; ltv: number[] };
  const buckets: Record<string, Record<string, Acc>> = {};
  const ensure = (bucket: string, mes: string): Acc => {
    if (!buckets[bucket]) buckets[bucket] = {};
    if (!buckets[bucket][mes]) buckets[bucket][mes] = { lt: [], ltv: [] };
    return buckets[bucket][mes];
  };

  const mesesSet = new Set(meses);
  for (const r of rows) {
    if (!mesesSet.has(r.mes)) continue;
    const ltv = r.valorr * r.lt;
    const b = produtoBucket(r.produto);
    const cell = ensure(b, r.mes);
    cell.lt.push(r.lt);
    cell.ltv.push(ltv);
    const tot = ensure("Total", r.mes);
    tot.lt.push(r.lt);
    tot.ltv.push(ltv);
  }

  const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const round0 = (n: number) => Math.round(n);

  const celulas: Record<string, Record<string, CelulaMetrica>> = {};
  const produtos: string[] = [];
  for (const bucket of BUCKETS_ORDER) {
    const porMes = buckets[bucket];
    if (!porMes) continue;
    const linha: Record<string, CelulaMetrica> = {};
    for (const mes of meses) {
      const acc = porMes[mes];
      if (!acc || acc.lt.length === 0) continue;
      linha[mes] = {
        lt: round1(avg(acc.lt)),
        ltv: round0(avg(acc.ltv)),
        lt_mediana: round1(mediana(acc.lt)),
        ltv_mediana: round0(mediana(acc.ltv)),
        n: acc.lt.length,
      };
    }
    if (Object.keys(linha).length > 0) {
      celulas[bucket] = linha;
      produtos.push(bucket);
    }
  }
  return { meses, produtos, celulas };
}
```

- [ ] **Step 4: Rodar os testes e ver passar**

Run: `npx vitest run server/routes/ltLtvChurn.helpers.test.ts`
Expected: PASS — todos os `describe` (incluindo os 3 antigos) verdes.

- [ ] **Step 5: Commit**

```bash
git add server/routes/ltLtvChurn.helpers.ts server/routes/ltLtvChurn.helpers.test.ts
git commit -m "feat(lt-ltv-churn): helper de pivot LT/LTV por produto × mês

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Endpoint `evolucao-produto-tabela`

**Files:**
- Modify: `server/routes/ltLtvChurn.ts` (import na linha 3; novo handler junto aos demais `app.get`)

**Interfaces:**
- Consumes: `buildMatrizEvolucaoProduto`, `ContratoMesRow` (Task 1).
- Produces: `GET /api/lt-ltv-churn/evolucao-produto-tabela?status=ativos|cancelados|todos` → JSON `{ meses: string[]; produtos: string[]; celulas: Record<string, Record<string, CelulaMetrica>> }`.

- [ ] **Step 1: Ampliar o import dos helpers (linha 3)**

```ts
import {
  revenueChurnPct,
  resolveClienteSort,
  buildMatrizEvolucaoProduto,
  type ContratoMesRow,
} from "./ltLtvChurn.helpers";
```

- [ ] **Step 2: Adicionar o handler**

Inserir logo após o handler `app.get("/api/lt-ltv-churn/evolucao-produto", ...)` (que termina por volta da linha 384), dentro de `registerLtLtvChurnRoutes`:

```ts
  app.get("/api/lt-ltv-churn/evolucao-produto-tabela", async (req, res) => {
    try {
      const raw = req.query.status as string;
      const status: "ativos" | "cancelados" | "todos" =
        raw === "cancelados" ? "cancelados" : raw === "todos" ? "todos" : "ativos";

      // Eixo de meses: do 1º mês com snapshot até o mês anterior ao atual.
      const mesesRows = (await db.execute(sql`
        SELECT to_char(d,'YYYY-MM') AS mes
        FROM generate_series(
          (SELECT date_trunc('month', MIN(data_snapshot)) FROM "Clickup".cup_data_hist),
          date_trunc('month', CURRENT_DATE) - interval '1 month',
          interval '1 month') d
        ORDER BY d
      `)).rows as { mes: string }[];
      const meses = mesesRows.map((r) => r.mes);
      const minMes = meses[0];
      const maxMes = meses[meses.length - 1];

      const rows: ContratoMesRow[] = [];

      if (status === "ativos" || status === "todos") {
        const ativos = (await db.execute(sql`
          WITH meses AS (
            SELECT to_char(d,'YYYY-MM') AS mes, d::date AS m
            FROM generate_series(
              (SELECT date_trunc('month', MIN(data_snapshot)) FROM "Clickup".cup_data_hist),
              date_trunc('month', CURRENT_DATE) - interval '1 month',
              interval '1 month') d
          ),
          snap_ref AS (
            SELECT meses.mes, COALESCE(
              (SELECT data_snapshot FROM "Clickup".cup_data_hist WHERE data_snapshot = meses.m LIMIT 1),
              (SELECT MIN(data_snapshot) FROM "Clickup".cup_data_hist WHERE date_trunc('month',data_snapshot)=meses.m)
            ) snap FROM meses
          ),
          base AS (
            SELECT sr.mes, h.produto, h.valorr,
              (h.data_snapshot - h.data_inicio)::numeric/30.44 AS lt
            FROM snap_ref sr
            JOIN "Clickup".cup_data_hist h ON h.data_snapshot = sr.snap
            WHERE h.status IN ('ativo','onboarding','triagem') AND h.valorr>0 AND h.data_snapshot >= h.data_inicio
          ),
          cobertura AS (
            SELECT mes, COUNT(*) FILTER (WHERE produto IS NOT NULL)::numeric / NULLIF(COUNT(*),0) cob
            FROM base GROUP BY mes
          )
          SELECT b.mes, b.produto, b.lt::float8 AS lt, b.valorr::float8 AS valorr
          FROM base b JOIN cobertura c ON c.mes=b.mes AND c.cob>=0.5
          WHERE b.produto IS NOT NULL
        `)).rows as any[];
        rows.push(...ativos.map((x) => ({
          mes: x.mes as string, produto: x.produto as string | null,
          lt: Number(x.lt), valorr: Number(x.valorr),
        })));
      }

      if (status === "cancelados" || status === "todos") {
        const cancelados = (await db.execute(sql`
          SELECT to_char(date_trunc('month', data_fim),'YYYY-MM') AS mes,
            produto, lt_meses::float8 AS lt, valorr::float8 AS valorr
          FROM cortex_core.vw_lt_contratos
          WHERE tipo_receita='recorrente' AND is_churned AND NOT data_inconsistente
            AND data_fim IS NOT NULL AND produto IS NOT NULL
            AND to_char(date_trunc('month', data_fim),'YYYY-MM') BETWEEN ${minMes} AND ${maxMes}
        `)).rows as any[];
        rows.push(...cancelados.map((x) => ({
          mes: x.mes as string, produto: x.produto as string | null,
          lt: Number(x.lt), valorr: Number(x.valorr),
        })));
      }

      res.json(buildMatrizEvolucaoProduto(rows, meses));
    } catch (error) {
      console.error("[api] Error fetching lt-ltv-churn evolucao-produto-tabela:", error);
      res.status(500).json({ error: "Failed to fetch evolucao-produto-tabela" });
    }
  });
```

- [ ] **Step 3: Reiniciar o dev server**

Run: `lsof -ti:3000 | xargs kill -9; npm run dev` (em background; aguardar subir).

- [ ] **Step 4: Validar o endpoint nos 3 status**

Run:
```bash
for s in ativos cancelados todos; do
  echo "=== status=$s ==="
  curl -s "http://localhost:3000/api/lt-ltv-churn/evolucao-produto-tabela?status=$s" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print('meses', d['meses']); print('produtos', d['produtos']); print('Performance último mês', list(d['celulas'].get('Performance',{}).items())[-1:])"
done
```
Expected:
- `meses` começa em `2025-11` e vai até o mês anterior ao atual.
- `produtos` inclui `Performance`, `Social Media`, `Creators`, `Outros`, `Total` (os que tiverem dados).
- Em `status=cancelados`, a célula de `Performance` em `2026-05` deve ter `lt≈5.3` e `ltv≈14076` (bate com a validação em prod do design).

- [ ] **Step 5: Commit**

```bash
git add server/routes/ltLtvChurn.ts
git commit -m "feat(lt-ltv-churn): endpoint evolucao-produto-tabela (ativos/cancelados/todos)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Tipo + componente `TabelaEvolucaoProduto`

**Files:**
- Modify: `client/src/components/lt-ltv-churn/types.ts`
- Create: `client/src/components/lt-ltv-churn/TabelaEvolucaoProduto.tsx`

**Interfaces:**
- Consumes: endpoint `evolucao-produto-tabela` (Task 2); `fetchJson`, `buildUrl` de `./utils`; `formatCurrencyNoDecimals` de `@/lib/utils`.
- Produces: `export function TabelaEvolucaoProduto({ metrica, agregador }: { metrica: "lt"|"ltv"; agregador: "media"|"mediana" })`.

- [ ] **Step 1: Adicionar o tipo da resposta**

Acrescentar ao final de `client/src/components/lt-ltv-churn/types.ts`:

```ts
export interface EvolucaoProdutoTabelaCelula {
  lt: number;
  ltv: number;
  lt_mediana: number;
  ltv_mediana: number;
  n: number;
}

export interface EvolucaoProdutoTabelaData {
  meses: string[];
  produtos: string[];
  celulas: Record<string, Record<string, EvolucaoProdutoTabelaCelula>>;
}
```

- [ ] **Step 2: Criar o componente**

`client/src/components/lt-ltv-churn/TabelaEvolucaoProduto.tsx`:

```tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { fetchJson, buildUrl } from "./utils";
import type { EvolucaoProdutoTabelaData } from "./types";

type Status = "ativos" | "cancelados" | "todos";

const MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatMes(mes: string): string {
  const [y, m] = mes.split("-");
  return `${MESES_PT[Number(m) - 1]}/${y.slice(2)}`;
}

const DESCRICAO: Record<Status, string> = {
  ativos: "carteira ativa no snapshot do mês",
  cancelados: "coorte por mês de encerramento (vida realizada)",
  todos: "ativos no snapshot + cancelados do mês",
};

export function TabelaEvolucaoProduto({
  metrica,
  agregador,
}: {
  metrica: "lt" | "ltv";
  agregador: "media" | "mediana";
}) {
  const [status, setStatus] = useState<Status>("ativos");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/lt-ltv-churn/evolucao-produto-tabela", status],
    queryFn: () =>
      fetchJson<EvolucaoProdutoTabelaData>(
        buildUrl("/api/lt-ltv-churn/evolucao-produto-tabela", { status }),
      ),
  });

  const campo =
    agregador === "media" ? metrica : (`${metrica}_mediana` as "lt_mediana" | "ltv_mediana");

  const formatCell = (v: number | undefined): string => {
    if (v == null) return "—";
    return metrica === "lt" ? `${v.toFixed(1)}m` : formatCurrencyNoDecimals(v);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          {metrica === "lt" ? "LT" : "LTV"} {agregador === "media" ? "médio" : "mediano"} por
          produto e mês · {DESCRICAO[status]}
        </p>
        <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
          <SelectTrigger className="w-[150px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativos">Ativos</SelectItem>
            <SelectItem value="cancelados">Cancelados</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading || !data ? (
        <div className="h-72 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-700/50">
                <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-medium text-gray-600 dark:bg-zinc-900 dark:text-zinc-400">
                  Produto
                </th>
                {data.meses.map((mes) => (
                  <th
                    key={mes}
                    className="whitespace-nowrap px-3 py-2 text-right font-medium text-gray-600 dark:text-zinc-400"
                  >
                    {formatMes(mes)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.produtos.map((produto) => {
                const isTotal = produto === "Total";
                return (
                  <tr
                    key={produto}
                    className={`border-b border-gray-100 dark:border-zinc-800/50 ${
                      isTotal ? "font-semibold" : ""
                    }`}
                  >
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 text-left text-gray-900 dark:bg-zinc-900 dark:text-white">
                      {produto}
                    </td>
                    {data.meses.map((mes) => (
                      <td
                        key={mes}
                        className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-700 dark:text-zinc-300"
                      >
                        {formatCell(data.celulas[produto]?.[mes]?.[campo])}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/lt-ltv-churn/types.ts client/src/components/lt-ltv-churn/TabelaEvolucaoProduto.tsx
git commit -m "feat(lt-ltv-churn): componente TabelaEvolucaoProduto + tipo da resposta

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `EvolucaoProduto` vira container com Tabs (Gráfico | Tabela)

**Files:**
- Create: `client/src/components/lt-ltv-churn/GraficoEvolucaoProduto.tsx`
- Modify: `client/src/components/lt-ltv-churn/EvolucaoProduto.tsx`

**Interfaces:**
- Consumes: `TabelaEvolucaoProduto` (Task 3); `Tabs/TabsList/TabsTrigger/TabsContent` de `@/components/ui/tabs`.
- Produces: `GraficoEvolucaoProduto({ metrica, agregador })` (gráfico atual, sem mudança de dados); `EvolucaoProduto()` (sem props, igual ao consumo atual em `LtLtvChurn.tsx`).

- [ ] **Step 1: Extrair o gráfico atual para `GraficoEvolucaoProduto.tsx`**

Criar `client/src/components/lt-ltv-churn/GraficoEvolucaoProduto.tsx` (corpo do gráfico atual, parametrizado por props — sem os selects, que sobem para o container):

```tsx
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { fetchJson } from "./utils";
import type { EvolucaoProdutoData } from "./types";

const CORES = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#a855f7"];

export function GraficoEvolucaoProduto({
  metrica,
  agregador,
}: {
  metrica: "lt" | "ltv";
  agregador: "media" | "mediana";
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const grid = isDark ? "#27272a" : "#e5e7eb";
  const axis = isDark ? "#a1a1aa" : "#6b7280";

  const { data: evolucao, isLoading } = useQuery({
    queryKey: ["/api/lt-ltv-churn/evolucao-produto"],
    queryFn: () => fetchJson<EvolucaoProdutoData>("/api/lt-ltv-churn/evolucao-produto"),
  });

  if (isLoading || !evolucao) {
    return <div className="h-72 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />;
  }

  const chaveArray =
    agregador === "media" ? metrica : (`${metrica}_mediana` as keyof EvolucaoProdutoData);
  const chartData = evolucao[chaveArray] as Array<Record<string, number | string>>;

  return (
    <>
      <p className="mb-2 text-xs text-gray-500 dark:text-zinc-400">
        {agregador === "media" ? "Média" : "Mediana"} mensal da carteira ativa (snapshots) ·
        meses sem produto preenchido são omitidos
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} />
          <XAxis dataKey="mes" tick={{ fill: axis, fontSize: 11 }} />
          <YAxis
            tick={{ fill: axis, fontSize: 11 }}
            tickFormatter={(v) => (metrica === "lt" ? `${v}m` : formatCurrencyNoDecimals(v))}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? "#18181b" : "#ffffff",
              border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
              borderRadius: 8,
              color: isDark ? "#f4f4f5" : "#111827",
            }}
            formatter={(v: number) => (metrica === "lt" ? `${v}m` : formatCurrencyNoDecimals(v))}
          />
          <Legend />
          {evolucao.produtos.map((produto, i) => (
            <Line
              key={produto}
              dataKey={produto}
              type="monotone"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
              stroke={CORES[i % CORES.length]}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </>
  );
}
```

- [ ] **Step 2: Reescrever `EvolucaoProduto.tsx` como container com Tabs**

Substituir todo o conteúdo de `client/src/components/lt-ltv-churn/EvolucaoProduto.tsx` por:

```tsx
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GraficoEvolucaoProduto } from "./GraficoEvolucaoProduto";
import { TabelaEvolucaoProduto } from "./TabelaEvolucaoProduto";

export function EvolucaoProduto() {
  const [metrica, setMetrica] = useState<"lt" | "ltv">("lt");
  const [agregador, setAgregador] = useState<"media" | "mediana">("media");
  const labelAgregador = agregador === "media" ? "médio" : "mediano";

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Evolução de LT/LTV por produto</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={metrica} onValueChange={(v) => setMetrica(v as "lt" | "ltv")}>
              <SelectTrigger className="w-[170px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lt">LT {labelAgregador} (meses)</SelectItem>
                <SelectItem value="ltv">LTV {labelAgregador} (R$)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={agregador} onValueChange={(v) => setAgregador(v as "media" | "mediana")}>
              <SelectTrigger className="w-[120px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="mediana">Mediana</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="grafico">
          <TabsList className="mb-4">
            <TabsTrigger value="grafico">Gráfico</TabsTrigger>
            <TabsTrigger value="tabela">Tabela</TabsTrigger>
          </TabsList>
          <TabsContent value="grafico">
            <GraficoEvolucaoProduto metrica={metrica} agregador={agregador} />
          </TabsContent>
          <TabsContent value="tabela">
            <TabelaEvolucaoProduto metrica={metrica} agregador={agregador} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Typecheck/build do client**

Run: `npx vitest run` (garante que nada quebrou) e `npx tsc -p tsconfig.json --noEmit` (se o projeto tiver tsconfig client; caso o comando não exista/erre por config, pular e confiar na verificação de runtime do Step 4 da Task 5).
Expected: sem erros de tipo nos arquivos tocados.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/lt-ltv-churn/GraficoEvolucaoProduto.tsx client/src/components/lt-ltv-churn/EvolucaoProduto.tsx
git commit -m "feat(lt-ltv-churn): sub-aba Gráfico/Tabela no card Evolução por produto

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Verificação manual no browser

**Files:** nenhum (verificação).

- [ ] **Step 1: Garantir o dev server no ar**

Run: `lsof -ti:3000 >/dev/null && echo "server up" || (npm run dev &)`
Abrir `http://localhost:3000/lt-ltv-churn`.

- [ ] **Step 2: Verificar a sub-aba**

Confirmar no card "Evolução de LT/LTV por produto":
- Abas **Gráfico** e **Tabela**; Gráfico idêntico ao anterior.
- Na Tabela: linhas Performance / Social Media / Creators / Outros / Total; colunas por mês (nov/2025 →).
- Select **Ativos / Cancelados / Todos** muda os números.
- Toggles **LT/LTV** e **Média/Mediana** mudam as células **sem** recarregar a página.
- Cancelados de mai/2026 em Performance ≈ `5.3m` (LT) / `R$ 14.076` (LTV) com agregador = Média.

- [ ] **Step 3: Verificar dark E light mode**

Alternar tema; confirmar legibilidade do cabeçalho sticky, linha Total e células em ambos.

- [ ] **Step 4: Pós-conclusão (workflow obrigatório do projeto)**

Seguir o checklist de pós-conclusão do `CLAUDE.md`/memória: git push da branch, atualizar o Obsidian vault e o chamado no Cortex DB para `status='review'` (se houver chamado associado a esta task).

---

## Self-Review

**1. Spec coverage:**
- Sub-aba Tabela no card Evolução → Task 4. ✅
- Filtros Ativos/Cancelados/Todos com semânticas (snapshot / coorte / união) → Task 2 (SQL) + Task 3 (select). ✅
- Linhas 3 principais + Outros + Total → Task 1 (`produtoBucket`/`BUCKETS_ORDER`/Total). ✅
- Colunas por mês nov/2025→anterior → Task 2 (generate_series). ✅
- Toggles LT/LTV e Média/Mediana resolvidos no front sem refetch → Task 3 (`campo`) + Task 4 (state compartilhado). ✅
- Guards: LT negativo, valorr>0, cobertura ≥0.5 → Task 2 (WHERE/cobertura). ✅
- Dark/light → Tasks 3/4 (classes `dark:`) + Task 5 (verificação). ✅

**2. Placeholder scan:** sem TBD/TODO; todo passo tem código/comando concreto. ✅

**3. Type consistency:** `buildMatrizEvolucaoProduto`/`ContratoMesRow`/`CelulaMetrica` idênticos entre Task 1 (definição) e Task 2 (consumo); `EvolucaoProdutoTabelaData` (front) espelha `MatrizEvolucao` (back); props `{ metrica, agregador }` idênticas em GraficoEvolucaoProduto/TabelaEvolucaoProduto/EvolucaoProduto. ✅
