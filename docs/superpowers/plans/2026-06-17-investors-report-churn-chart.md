# Gráfico de Churn no Investors Report — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um gráfico de evolução mensal do churn (MRR perdido em barras + taxa de churn % em linha) ao Investors Report, usando `"Clickup".cup_churn`.

**Architecture:** A lógica de combinação churn×denominador vira uma função pura testável (`server/investorsReport/churn.ts`). O endpoint `GET /api/investors-report` roda duas queries (churn R$ por mês + MRR de fim de mês) e chama essa função, expondo `evolucaoChurn` no JSON. O frontend (`InvestorsReport.tsx`) consome o novo campo, filtra por período e renderiza um `ComposedChart` com eixo duplo.

**Tech Stack:** TypeScript, Express, Drizzle (`db.execute(sql\`\`)`), Postgres, React, React Query, Recharts, Vitest.

## Global Constraints

- Churn **bruto alinhado ao ClickUp**: `valor_r > 0 AND status IN ('cancelado/inativo','em cancelamento')`, agrupado por mês de `data_solicitacao_encerramento`. **Sem** filtros de `abonar_churn`/`motivo_cancelamento`. (Idêntico ao BP 2026.)
- Denominador da taxa = MRR ativo do **fim do mês anterior** = último snapshot de `cup_data_hist` no mês (`MAX(data_snapshot)`), `status IN ('ativo','onboarding','triagem')`, `SUM(valorr)`.
- Taxa do mês N: `churn[N] / mrrFim[N-1] * 100`; `null` quando não há denominador ou ele é zero.
- Schemas com espaço usam aspas duplas: `"Clickup".cup_churn`.
- Dark/light: containers usam classes de tema (`bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`); elementos Recharts usam as **mesmas cores hardcoded** dos gráficos vizinhos (`stroke="#334155"`, `fill: '#94a3b8'`, tooltip `#1e293b`). Não inventar padrão novo.
- Cor do churn: vermelho `#ef4444` (barras); taxa %: âmbar `#f59e0b` (linha).
- Commits: Conventional Commits + `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

**Valores de referência reais (prod, validados em 2026-06-17)** — usar para sanity-check:

| mês | mrrChurn | qtd | mrrFim mês ant. | taxaChurn |
|-----|----------|-----|-----------------|-----------|
| 2025-11 | 92.468 | 38 | — (sem snapshot out) | null |
| 2025-12 | 77.210 | 38 | 936.787 | 8.2% |
| 2026-01 | 162.431 | 68 | 1.030.089 | 15.8% |
| 2026-02 | 99.658 | 34 | 1.119.046 | 8.9% |
| 2026-03 | 151.063 | 55 | 1.139.795 | 13.3% |
| 2026-04 | 175.765 | 61 | 1.260.758 | 13.9% |
| 2026-05 | 172.826 | 61 | 1.100.088 | 15.7% |
| 2026-06 | 111.951 | 28 | 1.030.229 | 10.9% |

---

### Task 1: Função pura `computeEvolucaoChurn` + testes (TDD)

**Files:**
- Create: `server/investorsReport/churn.ts`
- Test: `server/investorsReport/churn.test.ts`

**Interfaces:**
- Consumes: nada (função pura sobre arrays vindos das queries).
- Produces:
  - `interface ChurnRow { mes: string; mrr_churn: number | string; qtd: number | string }`
  - `interface MrrFimRow { mes: string; mrr_fim: number | string | null }`
  - `interface EvolucaoChurnItem { mes: string; mrrChurn: number; taxaChurn: number | null; qtd: number }`
  - `function computeEvolucaoChurn(churnRows: ChurnRow[], mrrFimRows: MrrFimRow[]): EvolucaoChurnItem[]`

- [ ] **Step 1: Escrever os testes que falham**

Criar `server/investorsReport/churn.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeEvolucaoChurn, type ChurnRow, type MrrFimRow } from './churn';

describe('computeEvolucaoChurn', () => {
  it('calcula a taxa como churn do mês ÷ MRR do fim do mês anterior', () => {
    const churn: ChurnRow[] = [{ mes: '2026-01', mrr_churn: '162431', qtd: '68' }];
    const mrrFim: MrrFimRow[] = [{ mes: '2025-12', mrr_fim: '1030089' }];
    expect(computeEvolucaoChurn(churn, mrrFim)).toEqual([
      { mes: '2026-01', mrrChurn: 162431, taxaChurn: 15.8, qtd: 68 },
    ]);
  });

  it('retorna taxaChurn null quando não há snapshot do mês anterior', () => {
    const churn: ChurnRow[] = [{ mes: '2025-11', mrr_churn: '92468', qtd: '38' }];
    const mrrFim: MrrFimRow[] = []; // out/2025 não existe
    expect(computeEvolucaoChurn(churn, mrrFim)).toEqual([
      { mes: '2025-11', mrrChurn: 92468, taxaChurn: null, qtd: 38 },
    ]);
  });

  it('retorna taxaChurn null quando o denominador é zero (evita divisão por zero)', () => {
    const churn: ChurnRow[] = [{ mes: '2026-03', mrr_churn: 1000, qtd: 2 }];
    const mrrFim: MrrFimRow[] = [{ mes: '2026-02', mrr_fim: 0 }];
    expect(computeEvolucaoChurn(churn, mrrFim)).toEqual([
      { mes: '2026-03', mrrChurn: 1000, taxaChurn: null, qtd: 2 },
    ]);
  });

  it('trata a virada de ano ao buscar o mês anterior (jan → dez do ano anterior)', () => {
    const churn: ChurnRow[] = [{ mes: '2026-01', mrr_churn: 50000, qtd: 5 }];
    const mrrFim: MrrFimRow[] = [{ mes: '2025-12', mrr_fim: 1000000 }];
    expect(computeEvolucaoChurn(churn, mrrFim)[0].taxaChurn).toBe(5);
  });

  it('ordena o resultado por mês ascendente', () => {
    const churn: ChurnRow[] = [
      { mes: '2026-02', mrr_churn: 100, qtd: 1 },
      { mes: '2026-01', mrr_churn: 200, qtd: 2 },
    ];
    expect(computeEvolucaoChurn(churn, []).map((r) => r.mes)).toEqual(['2026-01', '2026-02']);
  });
});
```

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `npm test -- server/investorsReport/churn.test.ts`
Expected: FAIL — `Failed to resolve import "./churn"` (arquivo ainda não existe).

- [ ] **Step 3: Implementar a função**

Criar `server/investorsReport/churn.ts`:

```ts
export interface ChurnRow {
  mes: string; // "YYYY-MM"
  mrr_churn: number | string;
  qtd: number | string;
}

export interface MrrFimRow {
  mes: string; // "YYYY-MM"
  mrr_fim: number | string | null;
}

export interface EvolucaoChurnItem {
  mes: string;
  mrrChurn: number;
  taxaChurn: number | null; // % (1 casa decimal) ou null sem denominador
  qtd: number;
}

/** Mês anterior de uma string "YYYY-MM", tratando a virada de ano. */
function mesAnterior(mes: string): string {
  const [year, month] = mes.split('-').map(Number);
  const ano = month === 1 ? year - 1 : year;
  const m = month === 1 ? 12 : month - 1;
  return `${ano}-${String(m).padStart(2, '0')}`;
}

/**
 * Combina o churn R$ mensal com o MRR de fim de mês (denominador) para produzir
 * a série de evolução do churn. Taxa do mês N = churn[N] / MRR do fim do mês N-1.
 * Sem denominador (mês anterior sem snapshot) ou denominador zero → taxa = null.
 */
export function computeEvolucaoChurn(
  churnRows: ChurnRow[],
  mrrFimRows: MrrFimRow[],
): EvolucaoChurnItem[] {
  const mrrFimPorMes = new Map<string, number>();
  for (const r of mrrFimRows) {
    mrrFimPorMes.set(r.mes, Number(r.mrr_fim) || 0);
  }

  return churnRows
    .map((r) => {
      const mrrChurn = Number(r.mrr_churn) || 0;
      const qtd = Number(r.qtd) || 0;
      const denom = mrrFimPorMes.get(mesAnterior(r.mes)) ?? 0;
      const taxaChurn = denom > 0 ? Math.round((mrrChurn / denom) * 1000) / 10 : null;
      return { mes: r.mes, mrrChurn, taxaChurn, qtd };
    })
    .sort((a, b) => a.mes.localeCompare(b.mes));
}
```

- [ ] **Step 4: Rodar os testes e ver passar**

Run: `npm test -- server/investorsReport/churn.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add server/investorsReport/churn.ts server/investorsReport/churn.test.ts
git commit -m "feat(investors-report): função pura de evolução do churn

computeEvolucaoChurn combina churn R\$/mês com MRR de fim de mês (denominador)
e calcula a taxa de churn; null sem denominador. Cobertura TDD.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Queries e wiring no endpoint `/api/investors-report`

**Files:**
- Modify: `server/routes.ts` — import no topo; queries + cálculo após a linha 3442 (logo após `faturamentoAnoResult`); campo no `res.json` após `evolucaoFaturamento` (linha ~3509).

**Interfaces:**
- Consumes: `computeEvolucaoChurn` da Task 1.
- Produces: campo `evolucaoChurn: EvolucaoChurnItem[]` no JSON de `GET /api/investors-report`.

- [ ] **Step 1: Adicionar o import**

No bloco de imports do topo de `server/routes.ts`, junto aos demais imports relativos, adicionar:

```ts
import { computeEvolucaoChurn } from "./investorsReport/churn";
```

- [ ] **Step 2: Adicionar as duas queries**

Em `server/routes.ts`, imediatamente após o fechamento de `faturamentoAnoResult` (linha 3442, o `\`);`) e antes de `const clientes = clientesResult.rows[0] ...` (linha 3445), inserir:

```ts
      // Evolução do churn (cup_churn) — churn BRUTO alinhado ao ClickUp:
      // valor_r > 0 e status de churn real (cancelado/inativo + em cancelamento),
      // SEM filtros de abono/motivo. Mesma definição usada pelo BP 2026.
      const churnResult = await db.execute(sql`
        SELECT TO_CHAR(data_solicitacao_encerramento, 'YYYY-MM') AS mes,
               COALESCE(SUM(valor_r), 0) AS mrr_churn,
               COUNT(*) AS qtd
        FROM "Clickup".cup_churn
        WHERE valor_r > 0
          AND status IN ('cancelado/inativo', 'em cancelamento')
          AND data_solicitacao_encerramento IS NOT NULL
        GROUP BY 1
        ORDER BY 1
      `);

      // Denominador da taxa de churn: MRR ativo do FIM de cada mês
      // (último snapshot de cup_data_hist no mês). Padrão idêntico ao BP 2026.
      const mrrFimResult = await db.execute(sql`
        WITH alvo AS (
          SELECT DATE_TRUNC('month', data_snapshot)::date AS mes,
                 MAX(data_snapshot::date) AS d
          FROM "Clickup".cup_data_hist
          GROUP BY 1
        )
        SELECT TO_CHAR(a.mes, 'YYYY-MM') AS mes,
               SUM(h.valorr::numeric) FILTER (
                 WHERE h.status IN ('ativo', 'onboarding', 'triagem')
               ) AS mrr_fim
        FROM alvo a
        JOIN "Clickup".cup_data_hist h ON h.data_snapshot::date = a.d
        GROUP BY 1
      `);

      const evolucaoChurn = computeEvolucaoChurn(
        churnResult.rows as any[],
        mrrFimResult.rows as any[],
      );
```

- [ ] **Step 3: Expor o campo no JSON de resposta**

Em `server/routes.ts`, no objeto do `res.json({ ... })`, logo após o bloco `evolucaoFaturamento: ...reverse(),` (termina na linha 3509), adicionar a linha:

```ts
        evolucaoChurn,
```

- [ ] **Step 4: Reiniciar o dev server e validar o endpoint**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
sleep 6
curl -s http://localhost:3000/api/investors-report | npx --yes node-jq '.evolucaoChurn[-4:]'
```

Expected: array com os últimos 4 meses, cada item no formato `{ "mes": "2026-MM", "mrrChurn": <num>, "taxaChurn": <num|null>, "qtd": <num> }`. As taxas devem estar na faixa de ~8–16% (ver tabela de referência; valores locais podem variar levemente do prod, mas a ordem de grandeza deve bater). Se o endpoint exigir autenticação e retornar HTML/redirect, validar via psql rodando as duas queries da Task 2 e conferir contra a tabela de referência.

- [ ] **Step 5: Commit**

```bash
git add server/routes.ts
git commit -m "feat(investors-report): expõe evolucaoChurn no endpoint

Duas queries (churn R\$/mês bruto alinhado ao ClickUp + MRR fim de mês como
denominador) alimentam computeEvolucaoChurn e o resultado vai no JSON.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Gráfico de churn no frontend

**Files:**
- Modify: `client/src/pages/InvestorsReport.tsx` — interface (após linha 86); `useMemo` (após `chartDataWithMetrics`, ~linha 150); novo Card (após a Row 2 de gráficos, ~linha 814).

**Interfaces:**
- Consumes: campo `evolucaoChurn` do endpoint (Task 2).
- Produces: nada (componente de tela).

- [ ] **Step 1: Estender a interface `InvestorsReportData`**

Em `client/src/pages/InvestorsReport.tsx`, dentro de `interface InvestorsReportData`, logo após o bloco `evolucaoFaturamento: Array<{...}>;` (fecha na linha 86), adicionar:

```ts
  evolucaoChurn: Array<{
    mes: string;
    mrrChurn: number;
    taxaChurn: number | null;
    qtd: number;
  }>;
```

- [ ] **Step 2: Adicionar os `useMemo` de dados do gráfico**

Em `client/src/pages/InvestorsReport.tsx`, logo após o fechamento do `useMemo` de `chartDataWithMetrics` (linha 150), adicionar:

```ts
  const churnChartData = useMemo(() => {
    if (!data?.evolucaoChurn) return [];
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return data.evolucaoChurn
      .filter(item => {
        const [year, month] = item.mes.split('-').map(Number);
        const itemDate = new Date(year, month - 1, 1);
        return itemDate >= dateRange.start && itemDate <= dateRange.end;
      })
      .map(item => {
        const [year, month] = item.mes.split('-');
        return {
          ...item,
          mesLabel: `${monthNames[parseInt(month) - 1]}/${year.slice(2)}`,
        };
      });
  }, [data?.evolucaoChurn, dateRange]);

  const churnMediaTaxa = useMemo(() => {
    const taxas = churnChartData
      .map(d => d.taxaChurn)
      .filter((t): t is number => t !== null);
    if (!taxas.length) return null;
    return Math.round((taxas.reduce((a, b) => a + b, 0) / taxas.length) * 10) / 10;
  }, [churnChartData]);
```

- [ ] **Step 3: Adicionar o Card com o gráfico**

Em `client/src/pages/InvestorsReport.tsx`, logo após o fechamento da `div` da "Charts Row 2: Receita vs Despesas + Caixa Acumulado" (a `</div>` da linha 814) e antes do comentário `{/* Charts Row 3: Pie Charts */}` (linha 816), inserir:

```tsx
        {/* Charts Row 2.5: Evolução do Churn */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2 text-foreground">
              <TrendingDown className="h-5 w-5 text-red-400" />
              Evolução do Churn
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              MRR perdido por mês e taxa de churn (% do MRR ativo do mês anterior)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : !churnChartData.length ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Nenhum dado no período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={churnChartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="mesLabel" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => formatCurrencyShort(v)} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    formatter={(value: number, name: string, props: any) =>
                      props.dataKey === 'taxaChurn'
                        ? [`${formatDecimal(value)}%`, name]
                        : [formatCurrency(value), name]
                    }
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#f8fafc' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  {churnMediaTaxa !== null && (
                    <ReferenceLine
                      yAxisId="right"
                      y={churnMediaTaxa}
                      stroke="#f59e0b"
                      strokeDasharray="3 3"
                      strokeWidth={1.5}
                      label={{ value: `Média ${formatDecimal(churnMediaTaxa)}%`, fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }}
                    />
                  )}
                  <Bar yAxisId="left" dataKey="mrrChurn" fill="#ef4444" name="MRR Perdido" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="taxaChurn" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3, fill: '#f59e0b' }} name="Taxa de Churn %" connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

```

Nota: `TrendingDown`, `formatDecimal`, `formatCurrency`, `formatCurrencyShort`, `ComposedChart`, `Bar`, `Line`, `ReferenceLine`, `Legend` já estão importados no arquivo (linhas 12, 18, 35-52, 89). Não adicionar imports novos.

- [ ] **Step 4: Validar no browser (dark + light)**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
sleep 6
```

Abrir `http://localhost:3000` → Investors Report. Verificar:
- O card "Evolução do Churn" aparece após "Receita vs Despesas / Caixa Acumulado".
- Barras vermelhas de MRR perdido + linha âmbar da taxa %; eixo esquerdo em R$, direito em %.
- A linha da taxa **não** desenha ponto no primeiro mês sem denominador (`connectNulls={false}`).
- Linha de referência "Média X%" visível.
- Tooltip mostra R$ para "MRR Perdido" e % para "Taxa de Churn %".
- Mudar o filtro de período recalcula barras, linha e a média.
- Conferir em dark mode e light mode (toggle de tema): textos/containers legíveis nos dois.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/InvestorsReport.tsx
git commit -m "feat(investors-report): gráfico de evolução do churn

ComposedChart com MRR perdido (barras, eixo R\$) + taxa de churn % (linha,
eixo secundário) e linha de média. Respeita o filtro de período.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Pós-implementação

- Abrir PR da branch `feature/investors-report-churn` para `main` com descrição clara (rodar `superpowers:finishing-a-development-branch`).
- Lembrar: o dashboard que o usuário vê roda em **produção**; refletir a mudança exige merge → deploy.
- Atualizar Obsidian vault + status do chamado (se houver) conforme workflow pós-conclusão.

## Notas / riscos

- A taxa de churn fica ~8–16%/mês: é divisão direta do churn R$ (alinhado ao ClickUp) pela base de MRR. Se no review o usuário achar o denominador inadequado, é o ponto de ajuste (não muda a arquitetura, só a query do denominador).
- `cortex_dev` local pode estar levemente defasado no churn do mês corrente vs prod — esperado.
