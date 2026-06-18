# Investors Report — Regime de Caixa (2026+) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Faturamento, Margem e Receita vs Despesas em regime de CAIXA a partir de 2026-01 (via `caz_parcelas`), mantendo o histórico pré-2026 em competência e sinalizando a transição.

**Architecture:** Módulo puro `server/investorsReport/regime.ts` faz o merge das séries (competência pré-corte + caixa pós-corte), calcula margem, YTD e o mês de transição. SQL fica no `routes.ts` (padrão de `churn.ts`). Geração-de-caixa passa a usar a mesma série caixa → reconcilia por construção.

**Tech Stack:** TypeScript, Express, Drizzle (`db.execute(sql\`...\`)`), Postgres, Recharts, Vitest.

## Global Constraints

- Corte: `REGIME_CUTOVER = '2026-01-01'` (constante única no módulo).
- Caixa = `caz_parcelas.valor_pago` por `data_quitacao`, `tipo_evento` RECEITA/DESPESA.
- Competência (pré-corte) = queries atuais intactas (`caz_receber.total`/`caz_pagar.pago`).
- Inadimplência (Ano) permanece competência (denominador próprio) — NÃO usar faturamento caixa como denominador.
- Função do módulo é PURA (recebe `.rows`, sem `db`); testes com Vitest (`vitest run`).
- Commits Conventional Commits + `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Módulo puro `regime.ts` + testes

**Files:**
- Create: `server/investorsReport/regime.ts`
- Test: `server/investorsReport/regime.test.ts`

**Interfaces:**
- Produces:
  - `REGIME_CUTOVER: string`
  - `type Fonte = 'competencia' | 'caixa'`
  - `interface CompetenciaRow { mes: string; faturamento: number|string; despesas: number|string; inadimplencia: number|string }`
  - `interface CaixaRow { mes: string; faturamento: number|string; despesas: number|string }`
  - `interface MesRegime { mes: string; faturamento: number; despesas: number; inadimplencia: number; fonte: Fonte }`
  - `interface RegimeYTD { faturamentoAno: number; faturamentoFechado: number; despesasFechado: number; margemAno: number; mesesFechados: number }`
  - `interface RegimeResult { series: MesRegime[]; ytd: RegimeYTD; transicaoMes: string | null }`
  - `function buildRegime(competenciaRows: CompetenciaRow[], caixaRows: CaixaRow[], hojeYM: string): RegimeResult`

- [ ] **Step 1: Write failing tests** — `server/investorsReport/regime.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { buildRegime, REGIME_CUTOVER, type CompetenciaRow, type CaixaRow } from './regime';

describe('buildRegime', () => {
  const comp: CompetenciaRow[] = [
    { mes: '2025-11', faturamento: '100', despesas: '60', inadimplencia: '10' },
    { mes: '2025-12', faturamento: '200', despesas: '150', inadimplencia: '20' },
  ];
  const caixa: CaixaRow[] = [
    { mes: '2026-01', faturamento: '300', despesas: '180' },
    { mes: '2026-02', faturamento: '400', despesas: '200' },
  ];

  it('cutover é 2026-01-01', () => {
    expect(REGIME_CUTOVER).toBe('2026-01-01');
  });

  it('taga competência antes do corte e caixa a partir do corte, ordenado', () => {
    const r = buildRegime(comp, caixa, '2026-02');
    expect(r.series.map(s => [s.mes, s.fonte])).toEqual([
      ['2025-11', 'competencia'], ['2025-12', 'competencia'],
      ['2026-01', 'caixa'], ['2026-02', 'caixa'],
    ]);
  });

  it('transicaoMes é o primeiro mês caixa', () => {
    expect(buildRegime(comp, caixa, '2026-02').transicaoMes).toBe('2026-01');
  });

  it('YTD agrega só caixa do ano corrente; margem usa só meses fechados (exclui mês corrente)', () => {
    // hoje = 2026-02 → fechado: só 2026-01
    const r = buildRegime(comp, caixa, '2026-02');
    expect(r.ytd.faturamentoAno).toBe(700);       // 300 + 400 (inclui corrente)
    expect(r.ytd.faturamentoFechado).toBe(300);   // só jan
    expect(r.ytd.despesasFechado).toBe(180);
    expect(r.ytd.mesesFechados).toBe(1);
    expect(r.ytd.margemAno).toBe(40);             // (300-180)/300*100
  });

  it('margemAno = 0 quando faturamento fechado é 0 (sem divisão por zero)', () => {
    const r = buildRegime([], [{ mes: '2026-01', faturamento: 0, despesas: 0 }], '2026-02');
    expect(r.ytd.margemAno).toBe(0);
  });

  it('sem meses caixa → transicaoMes null e YTD zerado', () => {
    const r = buildRegime(comp, [], '2025-12');
    expect(r.transicaoMes).toBeNull();
    expect(r.ytd.faturamentoAno).toBe(0);
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run server/investorsReport/regime.test.ts` → FAIL ("buildRegime is not a function").

- [ ] **Step 3: Implement** — `server/investorsReport/regime.ts`

```ts
export const REGIME_CUTOVER = '2026-01-01'; // 1º mês em regime de caixa

export type Fonte = 'competencia' | 'caixa';

export interface CompetenciaRow { mes: string; faturamento: number | string; despesas: number | string; inadimplencia: number | string }
export interface CaixaRow { mes: string; faturamento: number | string; despesas: number | string }
export interface MesRegime { mes: string; faturamento: number; despesas: number; inadimplencia: number; fonte: Fonte }
export interface RegimeYTD { faturamentoAno: number; faturamentoFechado: number; despesasFechado: number; margemAno: number; mesesFechados: number }
export interface RegimeResult { series: MesRegime[]; ytd: RegimeYTD; transicaoMes: string | null }

const n = (v: number | string | null | undefined): number => Number(v) || 0;

export function buildRegime(competenciaRows: CompetenciaRow[], caixaRows: CaixaRow[], hojeYM: string): RegimeResult {
  const compostos: MesRegime[] = [
    ...competenciaRows.map(r => ({ mes: r.mes, faturamento: n(r.faturamento), despesas: n(r.despesas), inadimplencia: n(r.inadimplencia), fonte: 'competencia' as Fonte })),
    ...caixaRows.map(r => ({ mes: r.mes, faturamento: n(r.faturamento), despesas: n(r.despesas), inadimplencia: 0, fonte: 'caixa' as Fonte })),
  ].sort((a, b) => a.mes.localeCompare(b.mes));

  const transicaoMes = compostos.find(m => m.fonte === 'caixa')?.mes ?? null;

  const ano = hojeYM.slice(0, 4);
  const caixaAno = compostos.filter(m => m.fonte === 'caixa' && m.mes.slice(0, 4) === ano);
  const fechados = caixaAno.filter(m => m.mes < hojeYM);
  const faturamentoAno = caixaAno.reduce((s, m) => s + m.faturamento, 0);
  const faturamentoFechado = fechados.reduce((s, m) => s + m.faturamento, 0);
  const despesasFechado = fechados.reduce((s, m) => s + m.despesas, 0);
  const margemAno = faturamentoFechado > 0 ? ((faturamentoFechado - despesasFechado) / faturamentoFechado) * 100 : 0;

  return {
    series: compostos,
    ytd: {
      faturamentoAno,
      faturamentoFechado,
      despesasFechado,
      margemAno: Number(margemAno.toFixed(2)),
      mesesFechados: fechados.length,
    },
    transicaoMes,
  };
}
```

- [ ] **Step 4: Run, verify pass** — `npx vitest run server/investorsReport/regime.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git add server/investorsReport/regime.ts server/investorsReport/regime.test.ts && git commit -m "feat(investors-report): módulo regime (competência pré-2026 + caixa 2026+)"`

---

### Task 2: Wire `/api/investors-report` ao módulo

**Files:**
- Modify: `server/routes.ts` (handler `GET /api/investors-report`, ~3370–3560)

**Interfaces:**
- Consumes: `buildRegime`, `REGIME_CUTOVER` de `./investorsReport/regime`.

- [ ] **Step 1:** import no topo do `routes.ts`: `import { buildRegime, REGIME_CUTOVER } from "./investorsReport/regime";`

- [ ] **Step 2:** Substituir a query única de série (`faturamentoResult`) por DUAS queries:
  - Competência (`< REGIME_CUTOVER`): manter a query atual de `caz_receber.total`/`caz_pagar.pago`, adicionando `AND data_vencimento < ${REGIME_CUTOVER}` (receita) e o limite equivalente na despesa; SELECT `mes, faturamento, despesas, inadimplencia`.
  - Caixa (`>= REGIME_CUTOVER`): `SELECT TO_CHAR(data_quitacao,'YYYY-MM') mes, SUM(valor_pago) FILTER (WHERE tipo_evento='RECEITA') faturamento, SUM(valor_pago) FILTER (WHERE tipo_evento='DESPESA') despesas FROM "Conta Azul".caz_parcelas WHERE data_quitacao >= ${REGIME_CUTOVER} GROUP BY 1`.

- [ ] **Step 3:** `const regime = buildRegime(competenciaResult.rows, caixaResult.rows, hojeYM);` onde `hojeYM = new Date().toISOString().slice(0,7)`.

- [ ] **Step 4:** Manter a query competência `faturamentoAnoResult` SÓ para inadimplência: `taxaInadimplencia` = `inadimplencia_ano / faturamento_ano(competência) * 100`. Faturamento/Margem/Fat./Cabeça anuais passam a vir de `regime.ytd` (caixa): `faturamentoAno = regime.ytd.faturamentoAno`, `margemAno = regime.ytd.margemAno`, `faturamentoMensalMedio = regime.ytd.mesesFechados>0 ? regime.ytd.faturamentoFechado/regime.ytd.mesesFechados : 0`.

- [ ] **Step 5:** `evolucaoFaturamento` mapeia `regime.series`: `{ mes, mesLabel, fonte, faturamento, despesas, geracaoCaixa: faturamento - despesas, inadimplencia }`. Adicionar `transicaoMes: regime.transicaoMes` na resposta.

- [ ] **Step 6: Validar** — `npx tsc --noEmit` (sem novos erros no arquivo) e reiniciar dev server (Task 5).

- [ ] **Step 7: Commit** — `git commit -am "feat(investors-report): série e KPIs anuais em regime de caixa (2026+)"`

---

### Task 3: Geração-de-caixa na mesma base caixa

**Files:**
- Modify: `server/routes.ts` (handler `GET /api/investors-report/geracao-caixa`, ~3583)

- [ ] **Step 1:** Substituir `storage.getDfc(...)` pela query caixa de `caz_parcelas` do ano corrente (mesma de Task 2 Step 2, filtrando `data_quitacao` no ano), produzindo `receita`/`despesa` por mês.

- [ ] **Step 2:** `geracaoMes = receita - despesa`; acumular `caixaAcumulado`. Resposta mantém shape `{ ano, series: [{ mes, receita, despesa, geracaoMes, caixaAcumulado }] }`.

- [ ] **Step 3: Commit** — `git commit -am "fix(investors-report): geração de caixa usa caz_parcelas (reconcilia com Receita vs Despesas; remove ajuste artificial)"`

---

### Task 4: Frontend — rótulos e tipo

**Files:**
- Modify: `client/src/pages/InvestorsReport.tsx`

- [ ] **Step 1:** Tipo do ponto: `fonte: 'caixa' | 'emitido'` → `fonte: 'caixa' | 'competencia'` (linha ~81).
- [ ] **Step 2:** Legenda (linha ~723): `"Até a marca: competência (faturado) • Após: caixa (recebido)"`.
- [ ] **Step 3:** Label da marca (linha ~752): `value: 'competência → caixa'`.
- [ ] **Step 4:** Sublabel KPI Faturamento (Ano): "recebido no ano (YTD)"; Inadimplência (Ano): adicionar sublabel "competência".
- [ ] **Step 5: Commit** — `git commit -am "feat(investors-report): rótulos de transição competência→caixa"`

---

### Task 5: Validação end-to-end + reconciliação

- [ ] **Step 1:** `npx vitest run server/investorsReport/` → PASS.
- [ ] **Step 2:** Reiniciar dev server (`lsof -ti:3000 | xargs kill -9; npm run dev`).
- [ ] **Step 3:** Verificar logs: `GET /api/investors-report 200`, `/geracao-caixa 200`.
- [ ] **Step 4: Reconciliação** — para cada mês 2026, `evolucaoFaturamento[m].geracaoCaixa` == `geracaoCaixa.series[m].geracaoMes`. Conferir via query SQL no banco local.
- [ ] **Step 5:** Confirmar visual no localhost:3000 (marca competência→caixa em jan/26; KPIs caixa; inadimplência inalterada 4,54%).
