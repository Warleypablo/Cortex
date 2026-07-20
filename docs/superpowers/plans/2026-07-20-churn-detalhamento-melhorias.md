# Melhorias em /dashboard/churn-detalhamento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar visível a receita pontual hoje exibida como "R$ 0", expor o responsável pelo contrato perdido com participação e churn% da carteira, mostrar percentual da base MRR no histórico e remover a dimensão Cluster enquanto o dado não existe.

**Architecture:** Duas mudanças de backend em `server/routes.ts` (campo `valorp` no endpoint de detalhamento e MRR base por responsável), e o restante em componentes de `client/src/components/churn/`. Toda lógica de agregação vai para um módulo puro `churnAggregations.ts` com testes em vitest — os componentes só renderizam.

**Tech Stack:** TypeScript, React, Drizzle (`db.execute(sql\`\`)`), Recharts, Tailwind, vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-07-20-churn-detalhamento-melhorias-design.md`

## Global Constraints

- Dark mode e light mode obrigatórios em toda UI nova: sempre usar variantes `dark:` (padrão do projeto: `text-gray-900 dark:text-white`, `border-gray-200 dark:border-zinc-700`, `text-gray-600 dark:text-zinc-400`).
- Valores monetários sempre via `formatCurrency` / `formatCurrencyNoDecimals` de `@/lib/utils`. Nunca `toFixed` cru.
- Nunca renderizar `R$ 0` para valor ausente — usar `—` em cinza.
- Nunca renderizar `Infinity%` ou `NaN%` — quando a base for 0 ou ausente, omitir o percentual.
- Rodar `npm run check` (tsc) antes de cada commit. Rodar `npm test` quando a task tiver teste.
- **NÃO** rodar `npm run dev` nem matar a porta 3000 (há sessões concorrentes). Validação de tipos via `npm run check`.
- Banco local está 13 dias atrasado (julho/2026 tem 23 linhas contra 52 em prod). Não usar números do local para conferir contra os prints de origem.
- Commits em Conventional Commits, com `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Branch de trabalho: `feature/churn-detalhamento-melhorias` (já criada, spec já commitada).

## File Structure

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `client/src/components/churn/churnAggregations.ts` | Funções puras: totais do drawer, percentual sobre base, agregação por responsável | **Criar** |
| `client/src/components/churn/churnAggregations.test.ts` | Testes das funções puras | **Criar** |
| `server/routes.ts` | Endpoints `churn-detalhamento` (campo `valorp`, base por responsável) | Modificar |
| `client/src/components/churn/types.ts` | `ChurnContract.valorp`, `ChurnPorPessoa.percentual` nullable, `soma_mrr_bases_por_pessoa` | Modificar |
| `client/src/components/churn/ChurnDrillDrawer.tsx` | Header com dois totais, largura do drawer, repasse da base | Modificar |
| `client/src/components/churn/drawer/DrawerContratosTable.tsx` | Colunas Responsável, MRR, Pontual | Modificar |
| `client/src/components/churn/drawer/DrawerSubMotivo.tsx` | Bloco por responsável | Modificar |
| `client/src/components/churn/ChurnHistoricoMensal.tsx` | Percentual no tooltip e no label | Modificar |
| `client/src/components/churn/ChurnPorDimensao.tsx` | Remoção da dimensão Cluster; tratar `percentual` nullable | Modificar |
| `client/src/pages/ChurnDetalhamento.tsx` | Repasse da base por responsável ao drawer | Modificar |

**Ordem de dependência:** Task 1 → Task 2. **Task 3 → Task 5** e **Task 4 → Task 5** (a Task 5 usa
`pctDaBase`/`formatPct` da Task 3 e o campo `soma_mrr_bases_por_pessoa` da Task 4). Task 6 é
independente e pode rodar a qualquer momento.

**Nota sobre o campo `responsavel`:** `cup_churn.responsavel_geral`, mapeado para
`ChurnContract.responsavel`, contém o **operador da subtask**, não o líder da conta (medido:
51/52 batem com `cup_contratos.responsavel`, 0/52 com `cup_clientes.responsavel_geral`). O
denominador do churn% em `cup_data_hist.responsavel` é a mesma dimensão. **Não trocar por
`cup_clientes.responsavel_geral`** — quebraria o cálculo.

---

### Task 1: Backend — expor `valorp` no endpoint de detalhamento

**Files:**
- Modify: `server/routes.ts:4941-4979` (SELECT e FROM da query de churn), `server/routes.ts:4988-5028` (mapeamento)
- Modify: `client/src/components/churn/types.ts:1-33`

**Interfaces:**
- Consumes: nada
- Produces: `ChurnContract.valorp: number` — sempre número, 0 quando ausente. Consumido pelas Tasks 2 e 5.

- [ ] **Step 1: Adicionar o join lateral e a coluna ao SELECT**

Em `server/routes.ts`, na query principal do endpoint `/api/analytics/churn-detalhamento`, adicionar `ct.valorp` logo após `c.valor_r`:

```
          c.valor_r,
          ct.valorp,
```

E, logo abaixo do `LEFT JOIN "Clickup".cup_clientes cl ON c.parent_id = cl.task_id`, adicionar:

```sql
        LEFT JOIN LATERAL (
          SELECT MAX(x.valorp::numeric) AS valorp
          FROM "Clickup".cup_contratos x
          WHERE x.id_subtask = c.task_id
        ) ct ON TRUE
```

O `LATERAL` com `MAX` em vez de um `LEFT JOIN` direto é deliberado: garante uma linha por contrato de churn mesmo que `cup_contratos` tenha mais de uma linha para o mesmo `id_subtask`. Um join direto poderia duplicar linhas e inflar o MRR total do drawer silenciosamente.

- [ ] **Step 2: Mapear o campo no objeto retornado**

No `.map()` logo abaixo, junto de `const valorr = Number(row.valor_r) || 0;`, adicionar:

```typescript
        const valorp = Number(row.valorp) || 0;
```

E no objeto retornado, logo após a linha `valorr: valorr,`:

```typescript
          valorp: valorp,
```

- [ ] **Step 3: Adicionar o campo ao tipo do frontend**

Em `client/src/components/churn/types.ts`, na interface `ChurnContract`, logo após `valorr: number;`:

```typescript
  /** Receita pontual do contrato (cup_contratos.valorp). 0 quando ausente. */
  valorp: number;
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run check`
Expected: sem erros novos. O campo é obrigatório no tipo, mas o payload agora sempre o envia. Se algum mock/fixture de teste construir `ChurnContract` à mão, o tsc vai apontar — nesse caso adicionar `valorp: 0` ao mock.

- [ ] **Step 5: Commit**

```bash
git add server/routes.ts client/src/components/churn/types.ts
git commit -m "feat(churn): expor valor pontual no endpoint de detalhamento

O R\$ 0 dos drawers era receita pontual invisível: a view de churn só
tem valor_r, e o pontual vive em cup_contratos.valorp. Em julho/26 são
R\$ 171k de pontual contra R\$ 67k de MRR, 100% fora da tela.

Join lateral com MAX para não duplicar linha caso haja mais de um
contrato por id_subtask.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Drawer — colunas Responsável, MRR e Pontual

**Files:**
- Create: `client/src/components/churn/churnAggregations.ts`
- Create: `client/src/components/churn/churnAggregations.test.ts`
- Modify: `client/src/components/churn/drawer/DrawerContratosTable.tsx`
- Modify: `client/src/components/churn/ChurnDrillDrawer.tsx:51` (total), `:57` (largura), `:63-70` (header)

**Interfaces:**
- Consumes: `ChurnContract.valorp` (Task 1)
- Produces: `somarValoresDrawer(contratos: ChurnContract[]): { mrr: number; pontual: number }` — consumido pelo header do drawer.

- [ ] **Step 1: Escrever o teste que falha**

Criar `client/src/components/churn/churnAggregations.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { somarValoresDrawer } from "./churnAggregations";
import type { ChurnContract } from "./types";

/** Constrói um ChurnContract mínimo; só os campos do teste importam. */
function contrato(over: Partial<ChurnContract>): ChurnContract {
  return {
    id: "t1", cliente_nome: "Cliente", cnpj: "", produto: "P", squad: "S",
    responsavel: "Não especificado", cs_responsavel: "", vendedor: "",
    valorr: 0, valorp: 0, data_inicio: "2026-01-01", data_encerramento: "2026-07-01",
    data_pausa: null, status: "encerrado", servico: "P", tipo: "churn",
    lifetime_meses: 0, ltv: 0, ...over,
  };
}

describe("somarValoresDrawer", () => {
  it("soma MRR e pontual independentemente", () => {
    const r = somarValoresDrawer([
      contrato({ valorr: 2997, valorp: 0 }),
      contrato({ valorr: 0, valorp: 14997 }),
      contrato({ valorr: 2000, valorp: 500 }),
    ]);
    expect(r.mrr).toBe(4997);
    expect(r.pontual).toBe(15497);
  });

  it("trata nulos e undefined como zero", () => {
    const r = somarValoresDrawer([
      contrato({ valorr: undefined as unknown as number, valorp: null as unknown as number }),
      contrato({ valorr: 1000, valorp: 100 }),
    ]);
    expect(r.mrr).toBe(1000);
    expect(r.pontual).toBe(100);
  });

  it("retorna zeros para lista vazia", () => {
    expect(somarValoresDrawer([])).toEqual({ mrr: 0, pontual: 0 });
  });

  it("preserva ajustes manuais negativos", () => {
    const r = somarValoresDrawer([
      contrato({ valorr: 10000 }),
      contrato({ valorr: -26500 }),
    ]);
    expect(r.mrr).toBe(-16500);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run client/src/components/churn/churnAggregations.test.ts`
Expected: FAIL — `Failed to resolve import "./churnAggregations"`.

- [ ] **Step 3: Implementar o mínimo**

Criar `client/src/components/churn/churnAggregations.ts`:

```typescript
import { type ChurnContract } from "./types";

/**
 * Soma MRR e pontual de um recorte de contratos, independentemente.
 * Ajustes manuais entram com valor negativo e são preservados de propósito —
 * eles reduzem o churn do mês.
 */
export function somarValoresDrawer(
  contratos: ChurnContract[],
): { mrr: number; pontual: number } {
  let mrr = 0;
  let pontual = 0;
  for (const c of contratos) {
    mrr += Number(c.valorr) || 0;
    pontual += Number(c.valorp) || 0;
  }
  return { mrr, pontual };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run client/src/components/churn/churnAggregations.test.ts`
Expected: PASS — 4 testes.

- [ ] **Step 5: Alargar o drawer e usar os dois totais no header**

Em `client/src/components/churn/ChurnDrillDrawer.tsx`:

Trocar o import de `formatCurrency` para incluir o helper:

```typescript
import { somarValoresDrawer } from "./churnAggregations";
```

Substituir a linha 51:

```typescript
  const totalMrr = contratos.reduce((sum, c) => sum + (c.valorr ?? 0), 0);
```

por:

```typescript
  const { mrr: totalMrr, pontual: totalPontual } = somarValoresDrawer(contratos);
```

Na linha 57, trocar `sm:max-w-2xl` por `sm:max-w-4xl`:

```typescript
        className="w-full sm:max-w-4xl overflow-y-auto bg-white dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-700"
```

Substituir o `<SheetDescription>` (linhas 63-70) por:

```tsx
          <SheetDescription className="text-gray-500 dark:text-zinc-400 text-sm">
            {contratos.length} contrato{contratos.length !== 1 ? "s" : ""}
            {" · "}
            MRR perdido:{" "}
            <span className="font-medium text-red-600 dark:text-red-400">
              {formatCurrency(totalMrr)}
            </span>
            {totalPontual !== 0 && (
              <>
                {" · "}
                Pontual:{" "}
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  {formatCurrency(totalPontual)}
                </span>
              </>
            )}
          </SheetDescription>
```

O bloco do pontual só aparece quando há pontual no recorte — recortes 100% recorrentes seguem com o header enxuto de hoje.

- [ ] **Step 6: Adicionar as três colunas na tabela**

Em `client/src/components/churn/drawer/DrawerContratosTable.tsx`, substituir o `<thead>` inteiro (linhas 39-60) por:

```tsx
        <thead>
          <tr className="border-b border-gray-200 dark:border-zinc-700">
            <th className="text-left py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">
              Cliente
            </th>
            <th className="text-left py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">
              Responsável
            </th>
            <th className="text-right py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">
              MRR
            </th>
            <th className="text-right py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">
              Pontual
            </th>
            <th className="text-left py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">
              Motivo
            </th>
            <th className="text-right py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">
              LT
            </th>
            <th className="text-right py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">
              Data enc.
            </th>
            <th className="text-center py-2 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">
              Abonar
            </th>
          </tr>
        </thead>
```

Depois, substituir as células de Cliente e MRR (linhas 70-75) por:

```tsx
                <td className="py-2 pr-3 text-gray-900 dark:text-white font-medium max-w-[160px] truncate">
                  {c.cliente_nome}
                </td>
                <td
                  className="py-2 pr-3 text-gray-600 dark:text-zinc-400 max-w-[130px] truncate"
                  title={c.responsavel || undefined}
                >
                  {c.responsavel && c.responsavel !== "Não especificado" ? (
                    c.responsavel
                  ) : (
                    <span className="text-gray-400 dark:text-zinc-600">—</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-right font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">
                  {c.valorr ? (
                    formatCurrency(c.valorr)
                  ) : (
                    <span className="font-normal text-gray-400 dark:text-zinc-600">—</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-right font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                  {c.valorp ? (
                    formatCurrency(c.valorp)
                  ) : (
                    <span className="font-normal text-gray-400 dark:text-zinc-600">—</span>
                  )}
                </td>
```

`c.valorr ?` cobre 0, null e undefined de uma vez — exatamente o caso "R$ 0" que motivou a mudança. Valores negativos (ajustes manuais) são truthy e continuam aparecendo.

- [ ] **Step 7: Verificar tipos e testes**

Run: `npm run check && npx vitest run client/src/components/churn/churnAggregations.test.ts`
Expected: tsc sem erros novos; 4 testes passando.

- [ ] **Step 8: Commit**

```bash
git add client/src/components/churn/churnAggregations.ts \
        client/src/components/churn/churnAggregations.test.ts \
        client/src/components/churn/ChurnDrillDrawer.tsx \
        client/src/components/churn/drawer/DrawerContratosTable.tsx
git commit -m "feat(churn): separar MRR e Pontual no drawer e mostrar responsável

Tabela do drawer ganha colunas Responsável, MRR e Pontual; valores
ausentes viram travessão em vez do R\$ 0 enganoso. Header mostra os dois
totais. Drawer alarga para max-w-4xl para caber 8 colunas.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Histórico — percentual sobre a base MRR

**Files:**
- Modify: `client/src/components/churn/churnAggregations.ts` (nova função)
- Modify: `client/src/components/churn/churnAggregations.test.ts` (novos testes)
- Modify: `client/src/components/churn/ChurnHistoricoMensal.tsx:68-92` (chartData), `:97-131` (tooltip), `:137-142` (subtítulo), `:182-189` (label)

**Interfaces:**
- Consumes: nada de outras tasks
- Produces: `pctDaBase(valor: number, base: number): number | null` — retorna a fração (0.084 para 8,4%), ou `null` quando a base não permite calcular. E `formatPct(fracao: number, casas?: number): string`.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final de `client/src/components/churn/churnAggregations.test.ts`:

```typescript
import { pctDaBase, formatPct } from "./churnAggregations";

describe("pctDaBase", () => {
  it("calcula a fração sobre a base", () => {
    expect(pctDaBase(162431, 1930000)).toBeCloseTo(0.08416, 5);
  });

  it("retorna null quando a base é zero", () => {
    expect(pctDaBase(1000, 0)).toBeNull();
  });

  it("retorna null quando a base é ausente", () => {
    expect(pctDaBase(1000, undefined as unknown as number)).toBeNull();
    expect(pctDaBase(1000, NaN)).toBeNull();
  });

  it("retorna null quando a base é negativa", () => {
    expect(pctDaBase(1000, -500)).toBeNull();
  });

  it("aceita valor zero com base válida", () => {
    expect(pctDaBase(0, 1000)).toBe(0);
  });
});

describe("formatPct", () => {
  it("formata com uma casa e vírgula decimal", () => {
    expect(formatPct(0.084)).toBe("8,4%");
  });

  it("respeita o número de casas pedido", () => {
    expect(formatPct(0.0169, 2)).toBe("1,69%");
  });

  it("formata zero", () => {
    expect(formatPct(0)).toBe("0,0%");
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run client/src/components/churn/churnAggregations.test.ts`
Expected: FAIL — `pctDaBase is not a function` / `formatPct is not a function`.

- [ ] **Step 3: Implementar**

Adicionar ao final de `client/src/components/churn/churnAggregations.ts`:

```typescript
/**
 * Fração de um valor sobre a base de MRR do mês (0.084 = 8,4%).
 * Retorna null quando a base não permite um percentual honesto — nesses
 * casos a UI deve omitir o percentual, nunca mostrar 0% ou Infinity%.
 */
export function pctDaBase(valor: number, base: number): number | null {
  const b = Number(base);
  if (!Number.isFinite(b) || b <= 0) return null;
  return (Number(valor) || 0) / b;
}

/** Formata uma fração como percentual pt-BR: 0.084 -> "8,4%". */
export function formatPct(fracao: number, casas = 1): string {
  return `${(fracao * 100).toFixed(casas).replace(".", ",")}%`;
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run client/src/components/churn/churnAggregations.test.ts`
Expected: PASS — 12 testes no total.

- [ ] **Step 5: Levar a base e o flag de mês corrente para o chartData**

Em `client/src/components/churn/ChurnHistoricoMensal.tsx`, adicionar ao import de utils:

```typescript
import { pctDaBase, formatPct } from "./churnAggregations";
```

No `useMemo` do `chartData` (linhas 68-92), substituir o corpo do `for` por:

```typescript
    for (let m = 1; m <= ultimoMes; m++) {
      const mesKey = `${ano}-${String(m).padStart(2, "0")}`;
      const serie = porMes[mesKey];
      // Meta = % fixo do MRR real (ativo) daquele mês
      const mrrBaseMes = data?.mrrBasePorMes?.[mesKey] ?? 0;
      const isMesCorrente = ano === hoje.getFullYear() && m === hoje.getMonth() + 1;
      const row: Record<string, number | string | boolean> = {
        mes: mesKey,
        mesLabel: isMesCorrente ? `${MESES_PT[m - 1]}*` : MESES_PT[m - 1],
        total: serie ? Math.round(serie.total) : 0,
        meta: Math.round(mrrBaseMes * metaPct),
        mrrBase: mrrBaseMes,
        isMesCorrente,
      };
      motivos.forEach((motivo) => {
        row[motivo] = serie ? Math.round(serie.porMotivo[motivo] ?? 0) : 0;
      });
      linhas.push(row);
    }
```

E ajustar a declaração de `linhas` logo acima para acomodar o boolean:

```typescript
    const linhas: Array<Record<string, number | string | boolean>> = [];
```

- [ ] **Step 6: Adicionar os percentuais ao tooltip**

Substituir o `CustomTooltip` inteiro (linhas 97-131) por:

```tsx
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const row = payload[0]?.payload as Record<string, number | string | boolean>;
    const total = Number(row?.total ?? 0);
    const meta = Number(row?.meta ?? 0);
    const mrrBase = Number(row?.mrrBase ?? 0);
    const isMesCorrente = Boolean(row?.isMesCorrente);
    const pctTotal = pctDaBase(total, mrrBase);
    const itens = motivos
      .map((motivo, i) => ({ motivo, valor: Number(row?.[motivo] ?? 0), cor: corDoMotivo(motivo, i) }))
      .filter((x) => x.valor > 0)
      .sort((a, b) => b.valor - a.valor);
    return (
      <div className="rounded-md border border-border bg-background px-3 py-2 shadow-lg text-xs space-y-1 min-w-[200px]">
        <p className="font-semibold text-foreground capitalize">
          {label} {ano}
          {isMesCorrente && (
            <span className="ml-1 font-normal text-muted-foreground">· mês em curso</span>
          )}
        </p>
        <p className="text-muted-foreground">
          Churn: <span className="font-semibold text-foreground">{formatCurrencyNoDecimals(total)}</span>
          {pctTotal !== null && (
            <span className="font-semibold text-foreground"> · {formatPct(pctTotal)}</span>
          )}
        </p>
        {meta > 0 && (
          <p className="text-muted-foreground">
            Meta ({formatPct(metaPct)}): <span className="font-medium text-foreground">{formatCurrencyNoDecimals(meta)}</span>
            {total > meta && (
              <span className="text-red-500">
                {" "}(+{formatCurrencyNoDecimals(total - meta)}
                {pctTotal !== null && ` · +${((pctTotal - metaPct) * 100).toFixed(1).replace(".", ",")}pp`})
              </span>
            )}
          </p>
        )}
        <div className="pt-1 border-t border-border/50 space-y-0.5">
          {itens.map((x) => {
            const pctItem = pctDaBase(x.valor, mrrBase);
            return (
              <div key={x.motivo} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="inline-block w-2 h-2 rounded-sm" style={{ background: x.cor }} />
                  {x.motivo}
                </span>
                <span className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-medium text-foreground tabular-nums">{formatCurrencyNoDecimals(x.valor)}</span>
                  {pctItem !== null && (
                    <span className="text-muted-foreground tabular-nums w-10 text-right">
                      {formatPct(pctItem, 2)}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
```

- [ ] **Step 7: Label de duas linhas com cor condicional no topo da barra**

Substituir o bloco `<LabelList ... />` (linhas 182-189) por um label customizado:

```tsx
                {i === motivos.length - 1 && (
                  <LabelList
                    dataKey="total"
                    position="top"
                    content={(props: any) => {
                      const { x, y, width, index } = props;
                      const row = chartData[index] as Record<string, number | string | boolean>;
                      const total = Number(row?.total ?? 0);
                      if (!total) return null;
                      const pct = pctDaBase(total, Number(row?.mrrBase ?? 0));
                      const acimaDaMeta = pct !== null && pct > metaPct;
                      const cx = Number(x) + Number(width) / 2;
                      return (
                        <g>
                          <text
                            x={cx}
                            y={Number(y) - 14}
                            textAnchor="middle"
                            style={{ fontSize: 10, fill: axisColor, fontWeight: 600 }}
                          >
                            {formatCurrencyNoDecimals(total)}
                          </text>
                          {pct !== null && (
                            <text
                              x={cx}
                              y={Number(y) - 3}
                              textAnchor="middle"
                              style={{
                                fontSize: 10,
                                fill: acimaDaMeta ? "#ef4444" : "#10b981",
                                fontWeight: 700,
                              }}
                            >
                              {formatPct(pct)}
                            </text>
                          )}
                        </g>
                      );
                    }}
                  />
                )}
```

O `margin` do `ComposedChart` (linha 156) precisa acomodar as duas linhas de label — trocar `top: 24` por `top: 34`.

- [ ] **Step 8: Atualizar o subtítulo**

Substituir o parágrafo do subtítulo (linhas 138-142) por:

```tsx
          <p className="text-xs text-muted-foreground">
            MRR perdido por mês e motivo · % sobre o MRR ativo do mês · linha tracejada = meta {formatPct(metaPct)}
            {filterAbono === "nao_abonados" && " · sem abonados"}
            {filterAbono === "abonados" && " · só abonados"}
            {" · * mês em curso"}
          </p>
```

- [ ] **Step 9: Verificar tipos e testes**

Run: `npm run check && npx vitest run client/src/components/churn/churnAggregations.test.ts`
Expected: tsc sem erros novos; 12 testes passando.

- [ ] **Step 10: Commit**

```bash
git add client/src/components/churn/churnAggregations.ts \
        client/src/components/churn/churnAggregations.test.ts \
        client/src/components/churn/ChurnHistoricoMensal.tsx
git commit -m "feat(churn): percentual da base MRR no histórico mensal

Tooltip e label das barras passam a mostrar o churn como % do MRR ativo
do mês — a mesma régua da meta de 8% que já era desenhada. Excedente
também em pontos percentuais. Cor condicional no label (vermelho acima
da meta, verde dentro) e marcação de mês em curso, que aparecia baixo
só por estar incompleto.

Percentual é omitido quando não há base no mês, em vez de Infinity%.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Backend — expor a base por pessoa e corrigir o 0% falso

**Files:**
- Modify: `server/routes.ts:5188-5192` (expor `somaMrrBasesPorPessoa`), `:5213-5215` (percentual null)
- Modify: `client/src/components/churn/types.ts:43-48` (`ChurnPorPessoa.percentual`), `ChurnMetricas`

**Interfaces:**
- Consumes: nada
- Produces: `metricas.soma_mrr_bases_por_pessoa: Record<string, number>` — carteira somada dos meses do range, por operador. Chave = nome cru de `cup_data_hist.responsavel`. Consumido pela Task 5.
- Altera: `ChurnPorPessoa.percentual` passa de `number` para `number | null`.

O cálculo pesado **já existe**: `somaMrrBasesPorPessoa` (`routes.ts:5188-5192`) já soma as bases mensais por operador, com a régua de snapshot correta. Esta task só o expõe e conserta o `0` mentiroso.

- [ ] **Step 1: Expor a base por pessoa no `res.json`**

Em `server/routes.ts`, dentro do objeto `metricas` do `res.json` do endpoint `/api/analytics/churn-detalhamento`, logo após a linha `soma_mrr_bases: somaMrrBases,`:

```typescript
          // Carteira por operador, somada nos meses do range. Denominador do
          // churn% por responsável nos drawers: MRR perdido no recorte ÷ carteira
          // total da pessoa ("quanto da carteira do X foi perdido em Performance").
          soma_mrr_bases_por_pessoa: somaMrrBasesPorPessoa,
```

- [ ] **Step 2: Trocar o 0% falso por null**

Substituir o cálculo de `churnPorPessoa` (`routes.ts:5208-5215`) por:

```typescript
      const churnPorPessoa = allPessoaNames.map(pessoa => ({
        pessoa,
        mrr_ativo: mrrBasesPrimeiroPorPessoa[pessoa] || 0,
        mrr_perdido: mrrPerdidoPorPessoa[pessoa] || 0,
        // null quando não há carteira no snapshot: exibir "—", nunca 0%.
        // Antes isto retornava 0 e mostrava 0% para churn real — atingia 4,11%
        // do MRR perdido de julho/2026 (operador com única linha em triagem,
        // valorr = 0, portanto base zero).
        percentual: (somaMrrBasesPorPessoa[pessoa] || 0) > 0
          ? ((mrrPerdidoPorPessoa[pessoa] || 0) / somaMrrBasesPorPessoa[pessoa]) * 100
          : null,
      })).sort((a, b) => (b.percentual ?? -1) - (a.percentual ?? -1));
```

A ordenação usa `?? -1` para que as pessoas sem base fiquem no fim, em vez de serem tratadas como 0%.

- [ ] **Step 3: Adicionar um comentário sobre a semântica do campo**

Logo acima do bloco `// Churn por pessoa (responsavel)` (`routes.ts:5186`), adicionar:

```typescript
      // ATENÇÃO: "responsavel" aqui é o OPERADOR da subtask, não o líder da conta.
      // cup_churn.responsavel_geral tem nome enganoso — seu conteúdo bate com
      // cup_contratos.responsavel em 51/52 casos e com cup_clientes.responsavel_geral
      // em 0/52. O denominador (cup_data_hist.responsavel) é a mesma dimensão.
      // NÃO trocar por cup_clientes.responsavel_geral: quebraria o cálculo.
```

- [ ] **Step 4: Refletir nos tipos do frontend**

Em `client/src/components/churn/types.ts`, na interface `ChurnPorPessoa`:

```typescript
export interface ChurnPorPessoa {
  pessoa: string;
  mrr_ativo: number;
  mrr_perdido: number;
  /** null quando a pessoa não tem carteira no snapshot — exibir "—", nunca 0%. */
  percentual: number | null;
}
```

E na interface `ChurnMetricas`:

```typescript
  /** Carteira somada por operador nos meses do range. Denominador do churn% nos drawers. */
  soma_mrr_bases_por_pessoa?: Record<string, number>;
```

- [ ] **Step 5: Corrigir os consumidores que o tsc apontar**

Run: `npm run check`
Expected: erros em `ChurnPorDimensao.tsx`, onde `percentual` é usado em modo taxa e agora pode ser `null`. Tratar exibindo `—` no lugar do percentual e mantendo o item no fim da ordenação — **não** usar `?? 0`, que reintroduziria exatamente a mentira que esta task corrige.

Rodar de novo até ficar limpo:

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add server/routes.ts client/src/components/churn/types.ts \
        client/src/components/churn/ChurnPorDimensao.tsx
git commit -m "fix(churn): não exibir 0% quando o operador não tem carteira

churnPorPessoa.percentual retornava 0 quando a base do snapshot era
zero, mostrando 0% para churn real — 4,11% do MRR perdido de julho/26.
Passa a ser null e a UI exibe travessão.

Expõe também soma_mrr_bases_por_pessoa, já calculada no endpoint, como
denominador do churn% por responsável nos drawers.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Aba Submotivo — bloco por responsável

**Files:**
- Modify: `client/src/components/churn/churnAggregations.ts`
- Modify: `client/src/components/churn/churnAggregations.test.ts`
- Modify: `client/src/components/churn/drawer/DrawerSubMotivo.tsx`
- Modify: `client/src/components/churn/ChurnDrillDrawer.tsx` (repassar a base)
- Modify: `client/src/pages/ChurnDetalhamento.tsx` (repassar a base ao drawer)

**Interfaces:**
- Consumes: `metricas.soma_mrr_bases_por_pessoa` (Task 4); `pctDaBase` e `formatPct` (Task 3)
- Produces: `agregarPorResponsavel(contratos, basePorResponsavel): LinhaResponsavel[]` e o tipo `LinhaResponsavel`.

**Depende da Task 3** — `agregarPorResponsavel` chama `pctDaBase`, e a tabela usa `formatPct`.

**Assimetria conhecida das chaves compostas:** o backend agrega a base pela chave crua de
`cup_data_hist.responsavel`, então existe uma chave literal `"Breno Carmo; Davi Ferraz"`. O
frontend normaliza o contrato para o primeiro nome (`"Breno Carmo"`), que não casa com essa chave.
Resultado: esses casos caem em `churnPct = null` e exibem `—`. É o comportamento correto — somar a
carteira compartilhada inteira a um dos dois inflaria o denominador — e são 4 linhas no snapshot de
julho. Não tentar "consertar" casando parcialmente.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final de `client/src/components/churn/churnAggregations.test.ts`:

```typescript
import { agregarPorResponsavel } from "./churnAggregations";

describe("agregarPorResponsavel", () => {
  const base = { "Glauber Pereira": 98400, "Debora Mund": 210300 };

  it("agrupa por responsável e ordena por MRR desc", () => {
    const r = agregarPorResponsavel(
      [
        contrato({ responsavel: "Debora Mund", valorr: 1000 }),
        contrato({ responsavel: "Glauber Pereira", valorr: 3000 }),
        contrato({ responsavel: "Debora Mund", valorr: 500 }),
      ],
      base,
    );
    expect(r.map((l) => l.responsavel)).toEqual(["Glauber Pereira", "Debora Mund"]);
    expect(r[0].mrr).toBe(3000);
    expect(r[1].mrr).toBe(1500);
    expect(r[1].contratos).toBe(2);
  });

  it("participação soma 100%", () => {
    const r = agregarPorResponsavel(
      [
        contrato({ responsavel: "Glauber Pereira", valorr: 3000 }),
        contrato({ responsavel: "Debora Mund", valorr: 1000 }),
      ],
      base,
    );
    const soma = r.reduce((s, l) => s + (l.participacao ?? 0), 0);
    expect(soma).toBeCloseTo(1, 6);
  });

  it("calcula churn% sobre a carteira do responsável", () => {
    const r = agregarPorResponsavel(
      [contrato({ responsavel: "Glauber Pereira", valorr: 12988 })],
      { "Glauber Pereira": 98400 },
    );
    expect(r[0].churnPct).toBeCloseTo(12988 / 98400, 6);
  });

  it("churn% é null quando não há base para o responsável", () => {
    const r = agregarPorResponsavel(
      [contrato({ responsavel: "Fulano Sem Base", valorr: 1000 })],
      base,
    );
    expect(r[0].churnPct).toBeNull();
  });

  it("atribui nomes múltiplos ao primeiro nome", () => {
    const r = agregarPorResponsavel(
      [
        contrato({ responsavel: "Glauber Pereira; Debora Mund", valorr: 1000 }),
        contrato({ responsavel: "Glauber Pereira", valorr: 500 }),
      ],
      base,
    );
    expect(r).toHaveLength(1);
    expect(r[0].responsavel).toBe("Glauber Pereira");
    expect(r[0].mrr).toBe(1500);
  });

  it("joga 'Não especificado' para o fim mesmo com MRR maior", () => {
    const r = agregarPorResponsavel(
      [
        contrato({ responsavel: "Não especificado", valorr: 90000 }),
        contrato({ responsavel: "Glauber Pereira", valorr: 100 }),
      ],
      base,
    );
    expect(r[r.length - 1].responsavel).toBe("Não especificado");
    expect(r[r.length - 1].isNaoEspecificado).toBe(true);
    expect(r[r.length - 1].churnPct).toBeNull();
  });

  it("trata responsável vazio como Não especificado", () => {
    const r = agregarPorResponsavel([contrato({ responsavel: "" }), contrato({ responsavel: "  " })], base);
    expect(r).toHaveLength(1);
    expect(r[0].responsavel).toBe("Não especificado");
    expect(r[0].contratos).toBe(2);
  });

  it("não quebra com ajuste manual negativo e sem responsável", () => {
    const r = agregarPorResponsavel(
      [
        contrato({ responsavel: "Glauber Pereira", valorr: 10000 }),
        contrato({ responsavel: "Não especificado", valorr: -26500 }),
      ],
      base,
    );
    const naoEsp = r.find((l) => l.isNaoEspecificado)!;
    expect(naoEsp.mrr).toBe(-26500);
    expect(naoEsp.participacao).toBeNull();
  });

  it("retorna lista vazia para entrada vazia", () => {
    expect(agregarPorResponsavel([], base)).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npx vitest run client/src/components/churn/churnAggregations.test.ts`
Expected: FAIL — `agregarPorResponsavel is not a function`.

- [ ] **Step 3: Implementar**

Adicionar ao final de `client/src/components/churn/churnAggregations.ts`:

```typescript
export const NAO_ESPECIFICADO = "Não especificado";

export interface LinhaResponsavel {
  responsavel: string;
  contratos: number;
  mrr: number;
  /** Fração do MRR do recorte. null para a linha "Não especificado". */
  participacao: number | null;
  /** MRR perdido ÷ carteira do responsável. null quando não há base. */
  churnPct: number | null;
  isNaoEspecificado: boolean;
}

/** "Nome A; Nome B" -> "Nome A". Rateio inventaria precisão que o dado não tem. */
export function primeiroNome(raw: string): string {
  return (raw || "").split(";")[0].trim();
}

/**
 * Agrega o churn de um recorte por responsável.
 *
 * A linha "Não especificado" é sempre a última e não recebe participação nem
 * churn%: ela acumula contratos sem responsável e os ajustes manuais, que
 * entram com valor negativo e sem carteira a que atribuir.
 */
export function agregarPorResponsavel(
  contratos: ChurnContract[],
  basePorResponsavel: Record<string, number> = {},
): LinhaResponsavel[] {
  const grupos = new Map<string, { contratos: number; mrr: number }>();

  for (const c of contratos) {
    const nome = primeiroNome(c.responsavel) || NAO_ESPECIFICADO;
    const chave = nome === NAO_ESPECIFICADO ? NAO_ESPECIFICADO : nome;
    const g = grupos.get(chave) || { contratos: 0, mrr: 0 };
    g.contratos += 1;
    g.mrr += Number(c.valorr) || 0;
    grupos.set(chave, g);
  }

  // Participação é sobre o MRR dos responsáveis identificados, para que
  // a soma feche em 100% sem ser distorcida por ajustes negativos.
  let totalIdentificado = 0;
  for (const [nome, g] of grupos) {
    if (nome !== NAO_ESPECIFICADO) totalIdentificado += g.mrr;
  }

  const linhas: LinhaResponsavel[] = [];
  for (const [nome, g] of grupos) {
    const isNaoEsp = nome === NAO_ESPECIFICADO;
    const base = basePorResponsavel[nome];
    linhas.push({
      responsavel: nome,
      contratos: g.contratos,
      mrr: g.mrr,
      participacao: isNaoEsp || totalIdentificado <= 0 ? null : g.mrr / totalIdentificado,
      churnPct: isNaoEsp ? null : pctDaBase(g.mrr, base),
      isNaoEspecificado: isNaoEsp,
    });
  }

  linhas.sort((a, b) => {
    if (a.isNaoEspecificado) return 1;
    if (b.isNaoEspecificado) return -1;
    return b.mrr - a.mrr;
  });

  return linhas;
}
```

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `npx vitest run client/src/components/churn/churnAggregations.test.ts`
Expected: PASS — 21 testes no total.

- [ ] **Step 5: Renderizar o bloco na aba Submotivo**

Em `client/src/components/churn/drawer/DrawerSubMotivo.tsx`, ampliar a assinatura do componente e envolver o retorno atual:

**Adicionar** (sem remover os existentes — `formatCurrencyNoDecimals` e `severityHex` continuam em uso) o import:

```typescript
import { agregarPorResponsavel, formatPct } from "@/components/churn/churnAggregations";
```

Trocar a assinatura (linha 15):

```typescript
export function DrawerSubMotivo({
  contratos,
  basePorResponsavel,
}: {
  contratos: ChurnContract[];
  basePorResponsavel?: Record<string, number>;
}): JSX.Element {
```

Adicionar o cálculo logo após `motivoSubmotivoTree`:

```typescript
  const linhasResponsavel = useMemo(
    () => agregarPorResponsavel(contratos, basePorResponsavel ?? {}),
    [contratos, basePorResponsavel],
  );
```

Envolver o `return` atual: o `<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">` existente passa a ser o primeiro filho de um wrapper, e o bloco novo vira o segundo. Ou seja, trocar a linha 79 por:

```tsx
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
```

e, antes do `);` final do componente, fechar o wrapper adicionando o bloco novo:

```tsx
      </div>

      {/* ── Churn por responsável ────────────────────────────────────────────── */}
      {linhasResponsavel.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            Churn por responsável
          </p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-700">
                <th className="text-left py-1.5 pr-2 font-medium text-gray-600 dark:text-zinc-400">
                  Responsável
                </th>
                <th className="text-right py-1.5 pr-2 font-medium text-gray-600 dark:text-zinc-400">
                  Contratos
                </th>
                <th className="text-right py-1.5 pr-2 font-medium text-gray-600 dark:text-zinc-400">
                  R$
                </th>
                <th className="text-right py-1.5 pr-2 font-medium text-gray-600 dark:text-zinc-400">
                  Part.
                </th>
                <th className="text-right py-1.5 font-medium text-gray-600 dark:text-zinc-400">
                  Churn%
                </th>
              </tr>
            </thead>
            <tbody>
              {linhasResponsavel.map((linha) => {
                const maxMrrResp = Math.max(
                  ...linhasResponsavel.filter((l) => !l.isNaoEspecificado).map((l) => l.mrr),
                  1,
                );
                const cor = linha.isNaoEspecificado
                  ? "#94a3b8"
                  : severityHex(maxMrrResp > 0 ? linha.mrr / maxMrrResp : 0);
                return (
                  <tr
                    key={linha.responsavel}
                    className="border-b border-gray-100 dark:border-zinc-800 last:border-0"
                  >
                    <td className="py-1.5 pr-2">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cor }}
                        />
                        <span
                          className="truncate text-gray-700 dark:text-zinc-300"
                          title={linha.responsavel}
                        >
                          {linha.responsavel}
                        </span>
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-gray-700 dark:text-zinc-300">
                      {linha.contratos}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums font-semibold text-gray-900 dark:text-white">
                      {formatCurrencyNoDecimals(linha.mrr)}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground">
                      {linha.participacao !== null ? formatPct(linha.participacao, 0) : "—"}
                    </td>
                    <td
                      className="py-1.5 text-right tabular-nums font-medium"
                      style={{ color: linha.churnPct !== null ? cor : undefined }}
                    >
                      {linha.churnPct !== null ? (
                        formatPct(linha.churnPct)
                      ) : (
                        <span className="text-gray-400 dark:text-zinc-600 font-normal">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
```

- [ ] **Step 6: Encadear a base do endpoint até o componente**

Em `client/src/components/churn/ChurnDrillDrawer.tsx`, adicionar a prop à interface:

```typescript
  basePorResponsavel?: Record<string, number>;
```

Adicioná-la ao destructuring do componente e repassar ao `DrawerSubMotivo` (linha 103):

```tsx
            <DrawerSubMotivo contratos={contratos} basePorResponsavel={basePorResponsavel} />
```

Em `client/src/pages/ChurnDetalhamento.tsx`, no `<ChurnDrillDrawer ... />` (linha 488), adicionar a prop:

```tsx
          basePorResponsavel={data?.metricas?.soma_mrr_bases_por_pessoa}
```

O nome da variável do `useQuery` é `data` (linha 155: `const { data, isLoading, error } = useQuery<ChurnDetalhamentoData>`), e o arquivo já acessa métricas assim em outros pontos (ex.: linha 260, `data?.metricas?.mrr_ativo_ref`).

- [ ] **Step 7: Verificar tipos e testes**

Run: `npm run check && npx vitest run client/src/components/churn/churnAggregations.test.ts`
Expected: tsc sem erros novos; 21 testes passando.

- [ ] **Step 8: Commit**

```bash
git add client/src/components/churn/churnAggregations.ts \
        client/src/components/churn/churnAggregations.test.ts \
        client/src/components/churn/drawer/DrawerSubMotivo.tsx \
        client/src/components/churn/ChurnDrillDrawer.tsx \
        client/src/pages/ChurnDetalhamento.tsx
git commit -m "feat(churn): bloco de churn por responsável na aba Submotivo

Participação (soma 100%) e churn% sobre a carteira do responsável, lado
a lado. Nomes múltiplos vão para o primeiro nome; 'Não especificado'
fica por último sem participação nem churn%, porque acumula contratos
sem responsável e ajustes manuais negativos.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Esconder a dimensão Cluster

**Files:**
- Modify: `client/src/components/churn/ChurnPorDimensao.tsx:6` (type), `:8-14` (labels), `:23-25` (getFieldValue), `:195` (dimButtons)

**Interfaces:**
- Consumes: nada
- Produces: nada

O filtro de cluster não está exposto em `ChurnControls.tsx` (verificado: zero ocorrências de "cluster" no arquivo), e a dimensão não é persistida — é `useState<Dimensao>("motivo")` local na linha 65. Então a remoção é contida a este arquivo.

- [ ] **Step 1: Remover do type e dos labels**

Linha 6:

```typescript
export type Dimensao = "motivo" | "produto" | "pessoa" | "squad";
```

E remover a entrada `cluster: "Cluster",` de `DIMENSAO_LABELS`.

- [ ] **Step 2: Remover o case do getFieldValue**

Remover as duas linhas:

```typescript
    case "cluster":
      return c.cluster || "Não especificado";
```

- [ ] **Step 3: Remover do seletor de botões**

Linha 195:

```typescript
  const dimButtons: Dimensao[] = ["motivo", "produto", "pessoa", "squad"];
```

- [ ] **Step 4: Deixar registrado por que o backend continua**

Adicionar um comentário logo acima do type `Dimensao`:

```typescript
// "cluster" foi removido em 2026-07-20: o dado está 100% vazio na origem
// (cup_churn, cup_clientes e cortex_core.clientes), e enriquecer via
// Bitrix.crm_deal.bx_cluster cobriria só 33,7%. O backend segue calculando
// churn_por_cluster e filtros.clusters — para religar, basta devolver
// "cluster" a este type, a DIMENSAO_LABELS, a getFieldValue e a dimButtons.
// Ver docs/superpowers/specs/2026-07-20-churn-detalhamento-melhorias-design.md
```

- [ ] **Step 5: Verificar que compila**

Run: `npm run check`
Expected: sem erros novos. Se o tsc apontar algum uso remanescente de `"cluster"` como `Dimensao`, remover também — isso é o compilador confirmando que a remoção foi completa.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/churn/ChurnPorDimensao.tsx
git commit -m "feat(churn): esconder dimensão Cluster enquanto não há dado

cluster está 100% vazio nas 3 tabelas de origem. O caminho certo é
preencher cup_clientes.cluster (catalog_clusters já existe e a view já
expõe a coluna), não derivar do Bitrix, que cobriria só 33,7% e traria
dois rótulos como IDs crus sem de-para.

Backend intacto para religar a dimensão quando a origem for preenchida.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Validação manual e fechamento

**Files:** nenhum (validação)

- [ ] **Step 1: Rodar a suíte inteira e o typecheck**

Run: `npm run check && npm test`
Expected: tsc limpo; suíte passando. Se houver falhas pré-existentes não relacionadas a churn, comparar com a baseline na `main` antes de investigar (`git stash` é proibido — usar `git worktree` se precisar comparar).

- [ ] **Step 2: Conferir os números contra prod**

Rodar contra **prod** (`dados_turbo`), não local — o local está 13 dias atrasado. Conferir que o drawer "Produto: Performance" de julho/2026 mostra pontual nos contratos que hoje aparecem como "R$ 0" (Envase Brand, Flico, LUMAI). Referência medida: julho/2026 tem SUM(`valor_r`) = R$ 66.930 e SUM(`valorp`) = R$ 171.272.

- [ ] **Step 3: Validar visualmente em build de produção**

O boot do dev server é instável neste projeto e há sessões concorrentes na porta 3000. Validar com build de produção numa porta livre, sem tocar na 3000:

```bash
npm run build && PORT=3005 node dist/index.js
```

Conferir, em dark mode E light mode:
- Drawer de Squad (17 linhas) na largura nova, sem scroll horizontal
- Colunas Responsável / MRR / Pontual com travessão onde não há valor
- Aba Submotivo: bloco de responsável com Part. somando 100% e Churn% preenchido
- Histórico: tooltip com percentuais, label de duas linhas, mês corrente com `*`
- Seletor de dimensão sem o botão Cluster

- [ ] **Step 4: Atualizar o CHANGELOG e sincronizar Obsidian + chamado**

Seguir `agents/obsidian-sync-SKILL.md`. O workflow pós-conclusão do projeto exige, nesta ordem: commit + push, atualização do vault em `~/Documents/Obsidian Vault/Córtex 2.0/Tasks/`, e o chamado no Cortex DB com `status='review'` (não `concluido`).

- [ ] **Step 5: Abrir o PR**

```bash
git push -u origin feature/churn-detalhamento-melhorias
```

Descrever no corpo do PR os dois achados que motivaram decisões contra a intuição inicial (pontual invisível 2,6× o MRR; cluster vazio na origem) e listar as dívidas registradas na spec — em especial o filtro de squads irrelevantes que é no-op, que deve virar tarefa própria.

---

## Dívidas fora deste plano

Registradas na spec, não implementadas aqui:

| Dívida | Por que fica fora |
|---|---|
| Filtro de squads irrelevantes é no-op (compara `'turbo interno'` com valores que têm prefixo emoji) | Corrigir muda o denominador do churn% e da meta de 8% em todos os meses — merece validação própria |
| `cup_clientes.cluster` vazia na origem | Trabalho de dados, não de tela |
| `cup_churn.responsavel_geral` contém operador, não líder — nome da coluna mente | Renomear na origem; por ora só o comentário da Task 4 Step 3 |
| Chaves compostas `"Nome A; Nome B"` como pessoa literal | Fragmentam a base do operador individual. 4 linhas no snapshot de julho |
| `cnpj` da view 1% preenchido em 2026 (era 45% em 2024) | Regressão na origem; bloqueia cruzamentos por CNPJ |
