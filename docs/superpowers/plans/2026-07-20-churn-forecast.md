# Forecast Churn — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um bloco "Forecast Churn" à tela de churn — a lista de clientes em risco que ainda não pediram para sair, com o valor exposto e o score de risco do motor de ML já existente.

**Architecture:** Endpoint novo `GET /api/analytics/churn-forecast` que lê a população de risco do Postgres (`cup_contratos` + `cup_churn` + `churn_risk_scores`), sem tocar na API do ClickUp. Um componente novo `ChurnForecast.tsx` renderiza a faixa de valor exposto + tabela, com agregação em função pura testável em `churnAggregations.ts`.

**Tech Stack:** TypeScript, React, Drizzle (`db.execute(sql\`\`)`), React Query, Tailwind, vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-07-20-churn-forecast-design.md`

## Global Constraints

- Trabalhar em `/Users/mac0267/Cortex-wt-churn-detalhamento`, branch `feature/churn-forecast`. **NÃO** usar `/Users/mac0267/Cortex` — outra sessão está ativa lá.
- Fonte de dados: **Postgres**, sem API do ClickUp.
- Dark mode E light mode obrigatórios. Cor via classes Tailwind com `dark:` ou helpers de `severity.ts`; nunca hex fixo cru.
- Valores monetários sempre via `formatCurrencyNoDecimals` de `@/lib/utils`.
- Nunca renderizar `R$ 0` nem valor ausente como informação — usar `—` em cinza.
- Score de ML: contratos `pausado` não têm score → exibir `—`, nunca `0`.
- `cup_churn.nome` é nome de SERVIÇO, não de cliente — cliente vem de `cup_clientes` via `task_id = cup_contratos.id_task`.
- JOIN a partir de `cup_contratos` (não de `cup_churn`, que tem histórico); usar `cup_churn` cru, não `vw_cup_churn_ajustado`.
- `npm run check` tem **124 erros pré-existentes** fora do escopo. Baseline antes de editar, comparar depois.
- NÃO rodar `npm run dev`. NÃO matar a porta 3000. NÃO usar `git stash`. NÃO amend nem rebase.
- Commits em Conventional Commits com `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## File Structure

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `client/src/components/churn/churnAggregations.ts` | `agregarForecast` (função pura) + tipos `ForecastContrato`/`ForecastMetricas` | Modificar |
| `client/src/components/churn/churnAggregations.test.ts` | Testes de `agregarForecast` | Modificar |
| `server/routes.ts` | Endpoint `GET /api/analytics/churn-forecast` | Modificar |
| `client/src/components/churn/forecastRiskColor.ts` | Mapa tier → classes de badge (theme-aware) | **Criar** |
| `client/src/components/churn/ChurnForecast.tsx` | Bloco: faixa de topo + tabela + expandível de contexto | **Criar** |
| `client/src/pages/ChurnDetalhamento.tsx` | Montar `ChurnForecast` após `ChurnKpisHero` | Modificar |

**Ordem de dependência:** Task 1 (backend + tipos) → Task 2 (agregação pura) → Task 3 (cor do tier) → Task 4 (componente) → Task 5 (montagem na página) → Task 6 (validação). Tasks 2 e 3 são independentes entre si.

---

### Task 1: Backend — endpoint de forecast e tipos

**Files:**
- Modify: `server/routes.ts` (novo handler junto dos `/api/analytics/churn-*`)
- Modify: `client/src/components/churn/churnAggregations.ts` (tipos)

**Interfaces:**
- Consumes: nada
- Produces:
  - Tipos em `churnAggregations.ts`:
    ```typescript
    export interface ForecastContrato {
      contrato_id: string;
      cliente: string;
      servico: string;
      valorr: number;
      valorp: number;
      status: string;
      status_conta: string | null;
      status_cancelamento: string | null;
      possibilidade_retencao: string | null;
      responsavel: string | null;
      contexto_risco: string | null;
      risco_score: number | null;
      risco_tier: "baixo" | "moderado" | "alto" | "critico" | null;
    }
    export interface ForecastResponse {
      contratos: ForecastContrato[];
      riscoCalculadoEm: string | null;
    }
    ```
  - Endpoint `GET /api/analytics/churn-forecast` devolvendo `ForecastResponse`.

- [ ] **Step 1: Adicionar os tipos ao churnAggregations.ts**

No topo de `client/src/components/churn/churnAggregations.ts`, após os imports existentes, adicionar os tipos `ForecastContrato` e `ForecastResponse` exatamente como no bloco Interfaces acima.

- [ ] **Step 2: Escrever o handler do endpoint**

Em `server/routes.ts`, localizar o endpoint `app.get("/api/analytics/churn-detalhamento", ...)` e, logo antes dele, adicionar:

```typescript
  // Forecast Churn — indicador antecedente: contratos em risco que AINDA NÃO
  // pediram encerramento (data_solicitacao_encerramento IS NULL). Foto do agora,
  // sem parâmetro de período. Fonte: Postgres (cup_contratos + cup_churn +
  // churn_risk_scores), sem tocar na API do ClickUp.
  app.get("/api/analytics/churn-forecast", async (_req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT
          ct.id_subtask                   AS contrato_id,
          cl.nome                         AS cliente,
          ct.servico,
          COALESCE(ct.valorr::numeric, 0) AS valorr,
          COALESCE(ct.valorp::numeric, 0) AS valorp,
          ct.status,
          ch.status_conta,
          ch.status_cancelamento,
          ch.possibilidade_retencao,
          ch.responsavel_geral            AS responsavel,
          COALESCE(
            NULLIF(TRIM(ch.mensagem_cliente), ''),
            NULLIF(TRIM(ch.contexto_cx), ''),
            NULLIF(TRIM(ch.contexto_operacao), '')
          )                               AS contexto_risco,
          rs.score                        AS risco_score,
          rs.tier                         AS risco_tier
        FROM "Clickup".cup_contratos ct
        JOIN "Clickup".cup_churn ch          ON ch.task_id = ct.id_subtask
        LEFT JOIN "Clickup".cup_clientes cl  ON cl.task_id = ct.id_task
        LEFT JOIN cortex_core.churn_risk_scores rs ON rs.contrato_id = ct.id_subtask
        WHERE LOWER(ct.status) IN ('ativo','onboarding','pausado','triagem')
          AND ct.data_solicitacao_encerramento IS NULL
          AND (
                COALESCE(ch.status_cancelamento, '') <> ''
             OR ch.status_conta IN ('Requer Atenção', 'Insatisfeito')
             OR COALESCE(ch.possibilidade_retencao, '') <> ''
          )
        ORDER BY ct.valorr::numeric DESC NULLS LAST
      `);

      const contratos = (result.rows as any[]).map((r) => ({
        contrato_id: String(r.contrato_id),
        cliente: r.cliente || "Cliente não identificado",
        servico: r.servico || "—",
        valorr: Number(r.valorr) || 0,
        valorp: Number(r.valorp) || 0,
        status: r.status || "",
        status_conta: r.status_conta || null,
        status_cancelamento: r.status_cancelamento || null,
        possibilidade_retencao: r.possibilidade_retencao || null,
        responsavel: r.responsavel || null,
        contexto_risco: r.contexto_risco || null,
        risco_score: r.risco_score !== null && r.risco_score !== undefined ? Number(r.risco_score) : null,
        risco_tier: r.risco_tier || null,
      }));

      const calcResult = await db.execute(sql`
        SELECT MAX(calculated_at) AS ultimo FROM cortex_core.churn_risk_scores
      `);
      const riscoCalculadoEm = (calcResult.rows[0] as any)?.ultimo ?? null;

      res.json({ contratos, riscoCalculadoEm });
    } catch (error) {
      console.error("[api] Error fetching churn forecast:", error);
      res.status(500).json({ error: "Failed to fetch churn forecast data" });
    }
  });

```

- [ ] **Step 3: Verificar que compila**

Run: `npm run check`
Expected: os mesmos 124 erros pré-existentes, nenhum novo em `server/routes.ts` ou `churnAggregations.ts`.

- [ ] **Step 4: Commit**

```bash
git add server/routes.ts client/src/components/churn/churnAggregations.ts
git commit -m "feat(churn): endpoint /api/analytics/churn-forecast

População de risco antecedente (contratos que ainda não pediram para sair)
lida do Postgres: cup_contratos + cup_churn + churn_risk_scores por
id_subtask. Sem parâmetro de período — é foto do agora. Expõe também a data
do último recálculo do score de ML (calculated_at), que hoje é manual.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Agregação pura do forecast

**Files:**
- Modify: `client/src/components/churn/churnAggregations.ts`
- Modify: `client/src/components/churn/churnAggregations.test.ts`

**Interfaces:**
- Consumes: `ForecastContrato` (Task 1)
- Produces:
  ```typescript
  export interface ForecastMetricas {
    total_contratos: number;
    total_clientes: number;
    mrr_exposto: number;
    pontual_exposto: number;
    por_tier: Array<{ tier: string; contratos: number; mrr: number }>;
    por_status_retencao: Array<{ status: string; contratos: number; mrr: number }>;
  }
  export function agregarForecast(contratos: ForecastContrato[]): ForecastMetricas;
  ```

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final de `client/src/components/churn/churnAggregations.test.ts`:

```typescript
import { agregarForecast, type ForecastContrato } from "./churnAggregations";

function fc(over: Partial<ForecastContrato>): ForecastContrato {
  return {
    contrato_id: "c1", cliente: "Cliente", servico: "S", valorr: 0, valorp: 0,
    status: "ativo", status_conta: null, status_cancelamento: null,
    possibilidade_retencao: null, responsavel: null, contexto_risco: null,
    risco_score: null, risco_tier: null, ...over,
  };
}

describe("agregarForecast", () => {
  it("soma MRR e pontual exposto", () => {
    const r = agregarForecast([
      fc({ valorr: 3000, valorp: 0 }),
      fc({ contrato_id: "c2", valorr: 2000, valorp: 500 }),
    ]);
    expect(r.mrr_exposto).toBe(5000);
    expect(r.pontual_exposto).toBe(500);
  });

  it("conta clientes distintos — um cliente com 2 contratos conta 1", () => {
    const r = agregarForecast([
      fc({ contrato_id: "c1", cliente: "Polpa Brasil", valorr: 297 }),
      fc({ contrato_id: "c2", cliente: "Polpa Brasil", valorr: 297 }),
      fc({ contrato_id: "c3", cliente: "Gloryful", valorr: 2997 }),
    ]);
    expect(r.total_contratos).toBe(3);
    expect(r.total_clientes).toBe(2);
  });

  it("agrupa por tier e joga contratos sem score no bucket 'Sem score'", () => {
    const r = agregarForecast([
      fc({ risco_tier: "critico", valorr: 1000 }),
      fc({ contrato_id: "c2", risco_tier: "critico", valorr: 500 }),
      fc({ contrato_id: "c3", risco_tier: null, valorr: 200 }),
    ]);
    const critico = r.por_tier.find((t) => t.tier === "critico")!;
    const semScore = r.por_tier.find((t) => t.tier === "Sem score")!;
    expect(critico.contratos).toBe(2);
    expect(critico.mrr).toBe(1500);
    expect(semScore.contratos).toBe(1);
    expect(semScore.mrr).toBe(200);
  });

  it("agrupa por status de retenção, com bucket 'Sem status' para vazio", () => {
    const r = agregarForecast([
      fc({ status_cancelamento: "Em negociação", valorr: 1000 }),
      fc({ contrato_id: "c2", status_cancelamento: null, valorr: 300 }),
    ]);
    const emNeg = r.por_status_retencao.find((s) => s.status === "Em negociação")!;
    const semStatus = r.por_status_retencao.find((s) => s.status === "Sem status")!;
    expect(emNeg.contratos).toBe(1);
    expect(semStatus.contratos).toBe(1);
  });

  it("lista vazia retorna zeros sem quebrar", () => {
    const r = agregarForecast([]);
    expect(r).toEqual({
      total_contratos: 0, total_clientes: 0, mrr_exposto: 0, pontual_exposto: 0,
      por_tier: [], por_status_retencao: [],
    });
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npx vitest run client/src/components/churn/churnAggregations.test.ts`
Expected: FAIL — `agregarForecast is not a function`.

- [ ] **Step 3: Implementar**

Adicionar ao final de `client/src/components/churn/churnAggregations.ts` (o tipo `ForecastMetricas` do bloco Interfaces + a função):

```typescript
export interface ForecastMetricas {
  total_contratos: number;
  total_clientes: number;
  mrr_exposto: number;
  pontual_exposto: number;
  por_tier: Array<{ tier: string; contratos: number; mrr: number }>;
  por_status_retencao: Array<{ status: string; contratos: number; mrr: number }>;
}

/**
 * Agrega a população de forecast. Contratos sem score de ML (pausados) caem no
 * bucket "Sem score"; sem status de cancelamento, no bucket "Sem status". Um
 * cliente com vários contratos conta 1 em total_clientes mas N em total_contratos.
 */
export function agregarForecast(contratos: ForecastContrato[]): ForecastMetricas {
  const clientes = new Set<string>();
  const tierMap = new Map<string, { contratos: number; mrr: number }>();
  const statusMap = new Map<string, { contratos: number; mrr: number }>();
  let mrr_exposto = 0;
  let pontual_exposto = 0;

  for (const c of contratos) {
    const mrr = Number(c.valorr) || 0;
    mrr_exposto += mrr;
    pontual_exposto += Number(c.valorp) || 0;
    clientes.add(c.cliente);

    const tier = c.risco_tier ?? "Sem score";
    const t = tierMap.get(tier) ?? { contratos: 0, mrr: 0 };
    t.contratos += 1;
    t.mrr += mrr;
    tierMap.set(tier, t);

    const status = c.status_cancelamento ?? "Sem status";
    const s = statusMap.get(status) ?? { contratos: 0, mrr: 0 };
    s.contratos += 1;
    s.mrr += mrr;
    statusMap.set(status, s);
  }

  return {
    total_contratos: contratos.length,
    total_clientes: clientes.size,
    mrr_exposto,
    pontual_exposto,
    por_tier: Array.from(tierMap.entries())
      .map(([tier, v]) => ({ tier, ...v }))
      .sort((a, b) => b.mrr - a.mrr),
    por_status_retencao: Array.from(statusMap.entries())
      .map(([status, v]) => ({ status, ...v }))
      .sort((a, b) => b.mrr - a.mrr),
  };
}
```

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `npx vitest run client/src/components/churn/churnAggregations.test.ts`
Expected: PASS — os 5 testes novos + os já existentes.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/churn/churnAggregations.ts client/src/components/churn/churnAggregations.test.ts
git commit -m "feat(churn): agregação pura do forecast (valor exposto, tiers, status)

agregarForecast soma MRR/pontual exposto, conta clientes distintos e agrupa
por tier de risco e por status de retenção, com buckets 'Sem score' (pausados)
e 'Sem status'.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Cor do tier de risco

**Files:**
- Create: `client/src/components/churn/forecastRiskColor.ts`

**Interfaces:**
- Consumes: nada
- Produces: `forecastRiskBadgeClass(tier: string | null): string` — classes Tailwind (fundo + texto) theme-aware para o badge do tier.

- [ ] **Step 1: Implementar**

Criar `client/src/components/churn/forecastRiskColor.ts`:

```typescript
/**
 * Classe de badge (fundo + texto) por tier de risco do churnRiskEngine.
 * Alinhado à escala de severity.ts: baixo=emerald … critico=red. Theme-aware.
 * tier null/desconhecido (contrato sem score) → cinza neutro.
 */
export function forecastRiskBadgeClass(tier: string | null): string {
  switch (tier) {
    case "critico":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    case "alto":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
    case "moderado":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    case "baixo":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    default:
      return "bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400";
  }
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run check`
Expected: mesmos 124 erros, nenhum novo.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/churn/forecastRiskColor.ts
git commit -m "feat(churn): mapa de cor do tier de risco para o badge do forecast

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Componente ChurnForecast

**Files:**
- Create: `client/src/components/churn/ChurnForecast.tsx`

**Interfaces:**
- Consumes: `ForecastContrato`, `ForecastResponse`, `agregarForecast` (Tasks 1-2); `forecastRiskBadgeClass` (Task 3)
- Produces: componente `ChurnForecast` (default export nomeado), sem props — busca os próprios dados.

- [ ] **Step 1: Implementar o componente**

Criar `client/src/components/churn/ChurnForecast.tsx`:

```tsx
import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import {
  agregarForecast,
  type ForecastContrato,
  type ForecastResponse,
} from "./churnAggregations";
import { forecastRiskBadgeClass } from "./forecastRiskColor";

function formatDataCurta(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  } catch {
    return "—";
  }
}

export function ChurnForecast(): JSX.Element | null {
  const { data, isLoading } = useQuery<ForecastResponse>({
    queryKey: ["/api/analytics/churn-forecast"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/churn-forecast");
      if (!res.ok) throw new Error("Failed to fetch churn forecast");
      return res.json();
    },
  });

  const [expandido, setExpandido] = useState<string | null>(null);

  const contratos = data?.contratos ?? [];
  const metricas = useMemo(() => agregarForecast(contratos), [contratos]);

  if (isLoading) {
    return (
      <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground animate-pulse rounded-xl border border-border bg-card">
        Carregando forecast...
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      {/* Cabeçalho + faixa de valor exposto */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Forecast de Churn
          </p>
          <p className="text-xs text-muted-foreground">
            Contratos em risco que ainda não pediram para sair · indicador antecedente
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {data?.riscoCalculadoEm
            ? `score de risco calculado em ${formatDataCurta(data.riscoCalculadoEm)}`
            : "score de risco não calculado"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <span className="text-muted-foreground">
          Em risco:{" "}
          <span className="font-semibold text-foreground">{metricas.total_clientes}</span> clientes
        </span>
        <span className="text-muted-foreground">
          MRR exposto:{" "}
          <span className="font-semibold text-red-600 dark:text-red-400">
            {formatCurrencyNoDecimals(metricas.mrr_exposto)}
          </span>
        </span>
        {metricas.pontual_exposto > 0 && (
          <span className="text-muted-foreground">
            Pontual:{" "}
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              {formatCurrencyNoDecimals(metricas.pontual_exposto)}
            </span>
          </span>
        )}
      </div>

      {/* Tabela */}
      {contratos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhum contrato em risco no forecast.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-700 text-left">
                <th className="py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 w-6"></th>
                <th className="py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">Cliente</th>
                <th className="py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">Responsável</th>
                <th className="py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 text-right whitespace-nowrap">MRR</th>
                <th className="py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 text-center whitespace-nowrap">Risco</th>
                <th className="py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">Retenção</th>
                <th className="py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">Saúde</th>
                <th className="py-2 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">Possib.</th>
              </tr>
            </thead>
            <tbody>
              {contratos.map((c) => {
                const isOpen = expandido === c.contrato_id;
                const temContexto = !!c.contexto_risco;
                return (
                  <React.Fragment key={c.contrato_id}>
                    <tr
                      className={`border-b border-gray-100 dark:border-zinc-800 ${temContexto ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50" : ""} transition-colors`}
                      onClick={() => temContexto && setExpandido(isOpen ? null : c.contrato_id)}
                    >
                      <td className="py-2 pr-3 text-gray-400">
                        {temContexto ? (isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />) : null}
                      </td>
                      <td className="py-2 pr-3 text-gray-900 dark:text-white font-medium max-w-[180px] truncate" title={c.cliente}>
                        {c.cliente}
                      </td>
                      <td className="py-2 pr-3 text-gray-600 dark:text-zinc-400 max-w-[130px] truncate" title={c.responsavel ?? undefined}>
                        {c.responsavel || <span className="text-gray-400 dark:text-zinc-600">—</span>}
                      </td>
                      <td className="py-2 pr-3 text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                        {c.valorr ? formatCurrencyNoDecimals(c.valorr) : <span className="font-normal text-gray-400 dark:text-zinc-600">—</span>}
                      </td>
                      <td className="py-2 pr-3 text-center whitespace-nowrap">
                        {c.risco_tier ? (
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${forecastRiskBadgeClass(c.risco_tier)}`}>
                            {c.risco_tier}{c.risco_score !== null ? ` ${c.risco_score}` : ""}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-gray-600 dark:text-zinc-400 whitespace-nowrap">
                        {c.status_cancelamento || <span className="text-gray-400 dark:text-zinc-600">—</span>}
                      </td>
                      <td className="py-2 pr-3 text-gray-600 dark:text-zinc-400 whitespace-nowrap">
                        {c.status_conta || <span className="text-gray-400 dark:text-zinc-600">—</span>}
                      </td>
                      <td className="py-2 text-gray-600 dark:text-zinc-400 whitespace-nowrap">
                        {c.possibilidade_retencao || <span className="text-gray-400 dark:text-zinc-600">—</span>}
                      </td>
                    </tr>
                    {isOpen && temContexto && (
                      <tr className="border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/30">
                        <td></td>
                        <td colSpan={7} className="py-2 pr-3 text-xs text-gray-600 dark:text-zinc-400">
                          <span className="font-medium text-gray-500 dark:text-zinc-500">O que pode gerar churn: </span>
                          {c.contexto_risco}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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

- [ ] **Step 2: Verificar que compila**

Run: `npm run check`
Expected: mesmos 124 erros, nenhum novo em `ChurnForecast.tsx`. O par de `<tr>` (linha + contexto) é agrupado por `<React.Fragment key={c.contrato_id}>` — por isso o `import React` no topo; `<>...</>` não aceitaria `key`.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/churn/ChurnForecast.tsx
git commit -m "feat(churn): componente ChurnForecast (faixa de valor exposto + tabela)

Lista de clientes em risco com badge de tier de ML, status de retenção e
saúde de conta em colunas próprias, e expansível com o contexto do risco.
Valores ausentes viram travessão; pausados sem score idem.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Montar o bloco na página

**Files:**
- Modify: `client/src/pages/ChurnDetalhamento.tsx` (import + render após `ChurnKpisHero`)

**Interfaces:**
- Consumes: componente `ChurnForecast` (Task 4)
- Produces: nada

- [ ] **Step 1: Importar o componente**

Em `client/src/pages/ChurnDetalhamento.tsx`, junto dos imports de `@/components/churn/*` (após a linha `import { ChurnPorDimensao } from "@/components/churn/ChurnPorDimensao";`):

```typescript
import { ChurnForecast } from "@/components/churn/ChurnForecast";
```

- [ ] **Step 2: Renderizar após o KpisHero**

Localizar o bloco `{!isLoading && data?.metricas?.mrr_ativo_ref !== undefined && ( <ChurnKpisHero ... /> )}` e, **logo após o seu fechamento** (o `)}` que fecha o bloco do KpisHero), inserir:

```tsx
      {/* Forecast Churn — indicador antecedente, foto do agora */}
      <ChurnForecast />
```

Não gatear por `isLoading` nem por período: o `ChurnForecast` busca os próprios dados e tem estado de loading próprio, e o forecast é foto do agora (independe do período selecionado na tela).

- [ ] **Step 3: Verificar que compila**

Run: `npm run check`
Expected: mesmos 124 erros, nenhum novo em `ChurnDetalhamento.tsx`.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/ChurnDetalhamento.tsx
git commit -m "feat(churn): montar bloco Forecast na tela de churn

ChurnForecast entra após o KpisHero, com busca própria e independente do
período (é foto do agora).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Validação e fechamento

**Files:** nenhum (validação)

- [ ] **Step 1: Rodar o typecheck e a suíte de churn**

Run: `npm run check && npx vitest run client/src/components/churn/ shared/churnPontual.test.ts`
Expected: tsc com 124 erros pré-existentes; testes de churn passando (incluindo os 5 novos de `agregarForecast`).

- [ ] **Step 2: Reconciliar contra prod**

Rodar contra **prod** (`dados_turbo`, 34.95.249.110), não local. A query do endpoint deve retornar **106 contratos, 67 clientes distintos, R$ 223,5k de MRR exposto** (a soma de `valorr`). Conferir:
- Contratos `em cancelamento` **não** aparecem (têm `data_solicitacao_encerramento` preenchida).
- Contratos `pausado` aparecem com `risco_tier` nulo (badge "—").

- [ ] **Step 3: Validar o visual em build de produção**

Não usar `npm run dev` nem a porta 3000. Subir o build:

```bash
npm run build && NODE_ENV=production PORT=3005 node dist/index.js
```

Conferir em `/dashboard/churn-detalhamento`, dark mode E light mode:
- O bloco Forecast aparece após os KPIs, com a faixa "Em risco: N clientes · R$ X exposto".
- A tabela lista os clientes com badge de tier colorido (crítico=vermelho … baixo=verde), e "—" nos pausados.
- Clicar numa linha com contexto expande "O que pode gerar churn".
- A data de "score calculado em" aparece (ou "não calculado" se a tabela `churn_risk_scores` estiver vazia — nesse caso, rodar `POST /api/churn-risk/recalculate` uma vez para popular).
- Sem scroll horizontal quebrando a página (a tabela rola dentro do seu container).

- [ ] **Step 4: Fechar**

Atualizar `docs/CHANGELOG.md` no padrão das entradas existentes, sincronizar o vault Obsidian conforme `agents/obsidian-sync-SKILL.md`, e atualizar o chamado no Cortex DB com `status='review'` (não `concluido`).

---

## Dívidas registradas (fora do escopo)

| Dívida | Por que fica fora |
|---|---|
| Score de ML só recalcula manualmente | `calculated_at` exposto na tela; um job diário resolveria, mas é outra mudança |
| `Data do Próximo Contato` / `Status do contato` não espelhados | Exigiria adicionar custom fields ao sync externo do ClickUp |
| Régua de saúde de conta pode incluir contas estáveis "Requer Atenção" | 95 dos 106 vêm desse sinal; refinar com score mínimo se gerar ruído |
| Endpoint sem teste automatizado | O projeto não tem suíte de endpoint; validação por reconciliação manual |
| Ordenação alternável (MRR ↔ Score) | YAGNI — ordenação por MRR cobre "onde está o maior valor exposto" |
