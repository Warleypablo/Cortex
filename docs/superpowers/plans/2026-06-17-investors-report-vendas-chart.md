# Gráfico de Vendas (Recorrente × Pontual) no Investors Report — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um gráfico de linhas com vendas mensais (recorrente e pontual) ao Investors Report, usando `"Bitrix".crm_deal`.

**Architecture:** O endpoint `GET /api/investors-report` roda uma query no Bitrix (deals ganhos por `data_fechamento`, somando `valor_recorrente` e `valor_pontual`) e expõe `vendasMensais` no JSON. O frontend (`InvestorsReport.tsx`) consome o campo, filtra por período e renderiza um `LineChart` com duas linhas. Sem função pura/teste unitário — não há lógica de negócio além do `SUM` no SQL; validação via query real + browser.

**Tech Stack:** TypeScript, Express, Drizzle (`db.execute(sql\`\`)`), Postgres, React, React Query, Recharts.

## Global Constraints

- Fonte: `"Bitrix".crm_deal`, `stage_name = 'Negócio Ganho'`, `data_fechamento IS NOT NULL`, agrupado por `TO_CHAR(data_fechamento,'YYYY-MM')`. Somar `valor_recorrente` (recorrente) e `valor_pontual` (pontual). Mesma definição do Relatório Mensal.
- Schemas com espaço usam aspas duplas: `"Bitrix".crm_deal`.
- Conversão numérica: `Number(x) || 0` (padrão do `routes.ts`).
- Visual: duas linhas — recorrente verde `#10b981`, pontual azul `#1978D5`; eixo Y único em R$; `connectNulls={false}`.
- Dark/light: containers com classes de tema (`bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`); elementos Recharts com as mesmas cores hardcoded dos gráficos vizinhos (`stroke="#334155"`, `fill: '#94a3b8'`, tooltip `#1e293b`/`#f8fafc`).
- Mudança puramente aditiva (não alterar queries/campos existentes do endpoint, incluindo o churn já presente).
- Commits: Conventional Commits + `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

**Valores de referência reais (prod, validados em 2026-06-17)** — para sanity-check:

| mês | vendas_recorrente | vendas_pontual | num_deals |
|-----|-------------------|----------------|-----------|
| 2025-09 | 202.049 | 431.058 | 91 |
| 2025-10 | 197.328 | 266.528 | 75 |
| 2025-11 | 177.554 | 305.864 | 65 |
| 2025-12 | 217.270 | 263.035 | 47 |
| 2026-01 | 273.531 | 318.311 | 68 |
| 2026-02 | 214.663 | 472.127 | 70 |
| 2026-03 | 259.517 | 333.635 | 80 |
| 2026-04 | 239.945 | 386.082 | 73 |
| 2026-05 | 262.908 | 349.576 | 84 |
| 2026-06 | 137.782 | 198.438 | 45 (parcial) |

Deals ganhos existem de 2025-08-12 em diante — sem dados antes de set/2025.

---

### Task 1: Query e campo `vendasMensais` no endpoint `/api/investors-report`

**Files:**
- Modify: `server/routes.ts` — query após o bloco do churn (logo após a linha 3481, onde fecha `const evolucaoChurn = computeEvolucaoChurn(...)`); campo no `res.json` após `evolucaoChurn,` (linha 3548).

**Interfaces:**
- Consumes: nada novo.
- Produces: campo `vendasMensais: Array<{ mes: string; vendasRecorrente: number; vendasPontual: number; numDeals: number }>` no JSON de `GET /api/investors-report`, ordenado por mês ascendente.

- [ ] **Step 1: Adicionar a query de vendas**

Em `server/routes.ts`, logo após o bloco que fecha `const evolucaoChurn = computeEvolucaoChurn(...)` (a linha `);` em 3481) e antes de `const clientes = clientesResult.rows[0] ...` (3483), inserir:

```ts

      // Vendas mensais (Bitrix) — deals ganhos por data_fechamento, separados em
      // recorrente (MRR novo) e pontual. Mesma definição do Relatório Mensal.
      const vendasResult = await db.execute(sql`
        SELECT TO_CHAR(data_fechamento, 'YYYY-MM') AS mes,
               COALESCE(SUM(valor_recorrente), 0) AS vendas_recorrente,
               COALESCE(SUM(valor_pontual), 0)    AS vendas_pontual,
               COUNT(*)                            AS num_deals
        FROM "Bitrix".crm_deal
        WHERE stage_name = 'Negócio Ganho'
          AND data_fechamento IS NOT NULL
        GROUP BY 1
        ORDER BY 1
      `);
```

- [ ] **Step 2: Expor o campo no JSON**

Em `server/routes.ts`, no objeto do `res.json({ ... })`, logo após a linha `evolucaoChurn,` (3548), inserir:

```ts
        vendasMensais: vendasResult.rows.map((r: any) => ({
          mes: r.mes,
          vendasRecorrente: Number(r.vendas_recorrente) || 0,
          vendasPontual: Number(r.vendas_pontual) || 0,
          numDeals: Number(r.num_deals) || 0,
        })),
```

- [ ] **Step 3: Validar a query contra os dados reais**

Não há teste unitário (a lógica é só o `SUM` no SQL). Validar rodando a query direto no banco local:

```bash
PGPASSWORD=dev123 psql -h localhost -U cortex -d cortex_dev -c "
SELECT TO_CHAR(data_fechamento,'YYYY-MM') AS mes,
       COALESCE(SUM(valor_recorrente),0)::int AS vendas_recorrente,
       COALESCE(SUM(valor_pontual),0)::int AS vendas_pontual,
       COUNT(*) AS num_deals
FROM \"Bitrix\".crm_deal
WHERE stage_name='Negócio Ganho' AND data_fechamento IS NOT NULL
GROUP BY 1 ORDER BY 1;"
```

Expected: os meses set/2025 → jun/2026 com valores na ordem de grandeza da tabela de referência (MRR ~180–270k, pontual ~200–470k). Local pode divergir levemente de prod (sync do Bitrix), mas a ordem de grandeza deve bater.

- [ ] **Step 4: Confirmar que o type-check não regrediu**

```bash
cd /Users/mac0267/Cortex-wt-vendas
npx tsc --noEmit 2>&1 | grep -E "routes\.ts" | grep -v "461|1184|5686|5990|6083|811[0-9]|812[0-9]|813[0-9]|816[0-9]|817[0-9]|821[0-9]|822[0-9]|823[0-9]|1160[0-9]|1163[0-9]" || echo "sem novos erros em routes.ts"
```

Expected: nenhum erro novo nas linhas do bloco de vendas. (O projeto tem ~123 erros `tsc` pré-existentes não relacionados; o relevante é não introduzir novos.) Forma robusta: `npx tsc --noEmit 2>&1 | grep -c "error TS"` deve dar o mesmo número com e sem a mudança.

- [ ] **Step 5: Commit**

```bash
git add server/routes.ts
git commit -m "feat(investors-report): expõe vendasMensais no endpoint

Query no Bitrix (deals ganhos por data_fechamento) somando valor_recorrente e
valor_pontual; resultado vai no JSON como vendasMensais.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Gráfico de vendas no frontend

**Files:**
- Modify: `client/src/pages/InvestorsReport.tsx` — interface (após a linha 92, `}>;` que fecha `evolucaoChurn`); `useMemo` (após `churnChartData`, linha 190); novo Card (após a Charts Row 1, antes do comentário `Charts Row 2`, linha 782).

**Interfaces:**
- Consumes: campo `vendasMensais` do endpoint (Task 1).
- Produces: nada (componente de tela).

- [ ] **Step 1: Estender a interface `InvestorsReportData`**

Em `client/src/pages/InvestorsReport.tsx`, dentro de `interface InvestorsReportData`, logo após o bloco `evolucaoChurn: Array<{...}>;` (fecha com `}>;` na linha 92) e antes do `}` que fecha a interface (linha 93), inserir:

```ts
  vendasMensais: Array<{
    mes: string;
    vendasRecorrente: number;
    vendasPontual: number;
    numDeals: number;
  }>;
```

- [ ] **Step 2: Adicionar o `useMemo` de dados do gráfico**

Em `client/src/pages/InvestorsReport.tsx`, logo após o fechamento do `useMemo` de `churnChartData` (linha 190, `}, [data?.evolucaoChurn, dateRange]);`), inserir:

```ts

  const vendasChartData = useMemo(() => {
    if (!data?.vendasMensais) return [];
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return data.vendasMensais
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
  }, [data?.vendasMensais, dateRange]);
```

- [ ] **Step 3: Adicionar o Card com o gráfico de linhas**

Em `client/src/pages/InvestorsReport.tsx`, logo após o `</div>` que fecha a Charts Row 1 (linha 780) e antes do comentário `{/* Charts Row 2: Receita vs Despesas + Caixa Acumulado */}` (linha 782), inserir:

```tsx
        {/* Charts Row 1.5: Vendas por Mês */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2 text-foreground">
              <DollarSign className="h-5 w-5 text-emerald-400" />
              Vendas por Mês (Recorrente e Pontual)
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Vendas fechadas no mês (Bitrix) — recorrente (MRR novo) e pontual
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : !vendasChartData.length ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Nenhum dado no período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={vendasChartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="mesLabel" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => formatCurrencyShort(v)} />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#f8fafc' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <Line type="monotone" dataKey="vendasRecorrente" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981' }} name="Vendas Recorrente" connectNulls={false} />
                  <Line type="monotone" dataKey="vendasPontual" stroke="#1978D5" strokeWidth={2.5} dot={{ r: 3, fill: '#1978D5' }} name="Vendas Pontual" connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

```

Nota: `DollarSign` (linha 16), `LineChart`/`Line`/`XAxis`/`YAxis`/`CartesianGrid`/`Tooltip`/`ResponsiveContainer`/`Legend` (linhas 35-52), `formatCurrency`/`formatCurrencyShort` (linhas 12, 89) já estão importados no arquivo. Não adicionar imports novos.

- [ ] **Step 4: Validar no browser (dark + light)**

```bash
cd /Users/mac0267/Cortex-wt-vendas
lsof -ti:3000 | xargs kill -9 2>/dev/null; PORT=3007 npm run dev &
sleep 6
```

Abrir `http://localhost:3007` → Investors Report. (Porta alternativa para não colidir com outras sessões na 3000.) Verificar:
- O card "Vendas por Mês (Recorrente e Pontual)" aparece logo após "Evolução da Margem".
- Duas linhas: recorrente verde, pontual azul; eixo em R$.
- Pontos só a partir de set/2025 (sem dados antes — sem linha à esquerda).
- Tooltip mostra R$ para "Vendas Recorrente" e "Vendas Pontual".
- Mudar o filtro de período recalcula as linhas.
- Conferir dark mode E light mode: textos/containers legíveis.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/InvestorsReport.tsx
git commit -m "feat(investors-report): gráfico de vendas (recorrente × pontual)

LineChart com duas linhas (recorrente verde, pontual azul) por mês, em R\$,
respeitando o filtro de período.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Pós-implementação

- Abrir PR de `feature/investors-report-vendas` para `main` (rodar `superpowers:finishing-a-development-branch`).
- O dashboard roda em produção; refletir exige merge → deploy.

## Notas / riscos

- Sem dados antes de set/2025 (Bitrix). Esperado, tratado com `connectNulls={false}`.
- `cortex_dev` local pode estar levemente defasado no Bitrix vs prod — ordem de grandeza deve bater mesmo assim.
- Trabalho isolado em worktree `feature/investors-report-vendas`, base `main` atualizada (já com o churn #272).
