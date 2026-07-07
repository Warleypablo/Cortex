# Painel Executivo Mensal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar uma página React única (`/dashboard/painel-executivo`) que consolida, por mês, as métricas executivas da Turbo (Receita MRR+Pontual, Churn rec+pontual, LT/LTV, Capacity/Receita por cabeça, Entregas Pontuais e Performance), reaproveitando endpoints existentes com drill-down inline auditável.

**Architecture:** Página consome endpoints já existentes via React Query (queryFn global, cookies automáticos). Fonte mensal principal = `GET /api/reports/mensal?mes=YYYY-MM` (entregas, rankings, cross-sell/upsell, série receita×churn, movimentos de MRR). Endpoints complementares preenchem o detalhe (churn por produto/motivo/operador, LT/LTV, estoque pontual, capacity, receita por cabeça). Cada bloco declara sua **temporalidade** (dado "do mês" vs "snapshot atual") via badge, porque vários endpoints ignoram filtro de mês. **Zero backend novo no MVP.**

**Tech Stack:** React 18 + TypeScript, wouter (rotas), @tanstack/react-query v5, Tailwind (dark mode por classe), shadcn/ui (Tabs, Sheet, Card, Select, Table, Skeleton), Recharts, lucide-react. Testes: vitest.

## Global Constraints

Copiadas verbatim do spec e das convenções do projeto. Todas as tasks herdam estas regras.

- **Dark/light mode obrigatório:** todo elemento com cor usa par `dark:` (ex: `text-gray-900 dark:text-white`, `bg-white dark:bg-zinc-900`, `border-gray-200 dark:border-zinc-700`). Componentes shadcn (Card/Tabs) já usam tokens semânticos — não precisam de `dark:`.
- **Formatadores canônicos:** importar de `@/lib/utils` — `formatCurrencyNoDecimals`, `formatCurrencyCompact`, `formatPercent`, `cn`. Nunca formatar moeda à mão.
- **Fetch:** usar `useQuery({ queryKey: [url, paramsObj] })` sem `queryFn` (o global monta a query string e envia cookies). Valor `"todos"` em params é omitido de propósito pelo queryFn global.
- **Zero backend novo:** nenhuma rota/query nova no servidor. Só consumo dos endpoints listados.
- **Temporalidade explícita:** todo card/seção mostra um badge indicando se o número é do mês selecionado (`Mês`) ou snapshot atual da base (`Snapshot atual`). Endpoints que ignoram mês (lt-ltv-churn/*, estoque-pontual/*, capacity-times) são sempre `Snapshot atual`.
- **Arquivos focados:** manter cada arquivo < 500 linhas (regra do CLAUDE.md). Quebrar seções em arquivos próprios em `pages/painel-executivo/`.
- **Rota:** `/dashboard/painel-executivo`, autenticada via `ProtectedRoute`.
- **Commits:** Conventional Commits; co-author `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## Mapa fonte → campo (referência para todas as tasks)

**Fonte principal — `GET /api/reports/mensal?mes=YYYY-MM`** (mensal; obrigatório `mes`, 400 sem ele; endpoint pesado ~49 queries → usar `staleTime` alto):
- `turboMetrics.mrrAtivo` → MRR ativo do mês
- `turboMetrics.mrrAdicionado` → Nova receita MRR
- `turboMetrics.churnMrr` / `turboMetrics.churnCount` → Churn MRR (recorrente)
- `turboMetrics.pausadosMrr` / `turboMetrics.pausadosCount` → Pausado/Reativado
- `turboMetrics.crosssellMrr` / `turboMetrics.crosssellPontual` → Cross-sell/Upsell
- `turboMetrics.receitaChurnSeries[]` = `{month,label,mrr,pontual,churnBrl,churnPct}` → série 12m (Visão Geral)
- `pontualData.aquisicao.{valor,contratos}` → Nova receita pontual
- `pontualData.entregasMes.{porSquad[],total}` → Entregue pontual (mês) por squad
- `pontualData.entregasPorProdutoMes[]` = `{month,label,produtos{},total}` → série de entregas por produto (ano)
- `pontualData.tempoMedioEntrega[]` = `{produto,diasMedio,contratos}` → Lead time por produto (últimos 6m)
- `pontualData.emAberto.{valor,contratos,porServico[]}` → estoque pontual em aberto (**snapshot atual**)
- `techData.kpis.{entregues,valorEntregues,tempoMedio,adicionados}` → Entregas Tech (mês)
- `techData.entregasPorTipo[]` → série entregas tech por tipo
- `topOperadores.{topMrr[],topMrrPontual[],topEntregas[]}` = `{nome,valor,fotoUrl,cargo}` → rankings (snapshot fim do mês / entregas do mês)
- `rankingSquads[]` = `{squad,mrr,pontual,contratos,clientes,posicao}` → ranking de squads
- `rankingClosers[]`, `rankingSDRs[]` → rankings comerciais
- `squadDetails[]` = `{squad,mrr,pontual,churnPct,churnBrl,nrrBrl,nrrPct,...}` → churn/nrr por squad
- `okrObjectives[]` → KR `nps` (`metricKey:"nps"`, pode vir `actual:null`) e `entregas_no_prazo_pct`

**Complementares mensais:**
- `GET /api/gestao/receita?de=YYYY-MM&ate=YYYY-MM` → macro receita comercial (drill de venda)
- `GET /api/gestao/receita/detalhe?de=&ate=&tipo=&chave=` → drill de qualquer número de receita: `{titulo,subtitulo,total,unidade,grupos[]}`
- `GET /api/analytics/churn-detalhamento?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` → churn recorrente completo: `{contratos[],metricas{churn_percentual,churn_por_squad,churn_por_pessoa,churn_por_motivo,mrr_perdido,lt_medio,ltv_total,...}}`
- `GET /api/churn/produto-motivo?dataInicio=YYYY-MM&dataFim=YYYY-MM` → `{produtos[],motivos[],celulas[{produto,motivo_cancelamento,cancelamentos,mrr_perdido}],totais}`
- `GET /api/churn/taxa-mensal?dataInicio=YYYY-MM&dataFim=YYYY-MM` → `{rows[{mes,mrr_base,mrr_churn,cancelamentos,taxa}]}`
- `GET /api/churn-por-responsavel?mesInicio=YYYY-MM&mesFim=YYYY-MM` → `[{responsavel,quantidadeContratos,valorTotal,percentualChurn}]`
- `GET /api/churn-pontorrente?de=YYYY-MM&ate=YYYY-MM` → churn pontual (drop-off por jornada)
- `GET /api/ceo-dashboard?mes=YYYY-MM` → `{mes,kpis}` inclui receita/cabeça, receita caixa, custos (**acesso restrito: pode dar 403** — tratar como "sem permissão")

**Snapshot atual (ignoram mês — sempre badge `Snapshot atual`):**
- `GET /api/lt-ltv-churn/overview` → `{mrrAtivo,ltMedioAtivo,ltMedioCancelado,ltvMedioCliente,totalRecorrentes}`
- `GET /api/lt-ltv-churn/dist-clientes` → `{ltv[{faixa,qtd}],lt[{faixa,qtd}]}`
- `GET /api/lt-ltv-churn/evolucao-produto-tabela` → `{meses[],produtos[],celulas{}}` (tem eixo temporal — dá pra ler a coluna do mês)
- `GET /api/lt-ltv-churn/clientes?sort=ltvTotal&dir=desc&page=1` → `{total,page,clientes[{idTask,nomeCliente,ltvTotal,ltMeses,...}]}` (maiores clientes por LTV)
- `GET /api/estoque-pontual/overview` → `{valorEstoque,qtdItens,idadeMedia,qtdEnvelhecidos}`
- `GET /api/estoque-pontual/por-produto` → `{produtos[{produto,qtd,valor,idadeMedia}]}`
- `GET /api/capacity-times` → `{selva[],black[],squadra[],cxcs[],squads[{squad,rows[]}],metaContasDesigner}`

**Convenções de param de mês (4 dialetos — o helper `temporalidade.ts` mapeia todos):**
| Dialeto | Endpoints |
|---|---|
| `mes=YYYY-MM` | reports/mensal, ceo-dashboard |
| `de/ate=YYYY-MM` | gestao/receita(+detalhe), churn-pontorrente |
| `dataInicio/dataFim=YYYY-MM` | churn/produto-motivo, churn/taxa-mensal, churn/squad-motivo |
| `mesInicio/mesFim=YYYY-MM` | churn-por-responsavel, churn-por-servico |
| `startDate/endDate=YYYY-MM-DD` | analytics/nrr, analytics/churn-detalhamento |

---

## File Structure

```
client/src/pages/PainelExecutivo.tsx                      # shell: header, seletor de mês, Tabs, dispatch de abas
client/src/pages/painel-executivo/
  temporalidade.ts                                        # PURO: mesDefault(), paramsParaMes(mes), labelMes(mes)  [TESTADO]
  temporalidade.test.ts                                   # testes vitest do helper puro
  tipos.ts                                                # interfaces TS parciais dos payloads consumidos
  hooks.ts                                                # hooks React Query (um por fonte), com enabled/staleTime
  KpiCard.tsx                                             # card de KPI reutilizável (valor, delta, badge temporalidade, onClick)
  DrillSheet.tsx                                          # drawer lateral genérico de drill-down
  TemporalidadeBadge.tsx                                  # badge "Mês" | "Snapshot atual"
  SecaoVisaoGeral.tsx                                     # aba default
  SecaoReceita.tsx                                        # MRR + Pontual
  SecaoChurn.tsx                                          # Recorrente + Pontual (sub-tabs)
  SecaoLtLtv.tsx                                          # LT/LTV
  SecaoCapacity.tsx                                       # Receita por cabeça
  SecaoEntregas.tsx                                       # Entregas pontuais + tech
  SecaoPerformance.tsx                                    # rankings TOP 10
  EmBreveCard.tsx                                         # placeholder fase 2 (NPS, Margem, Maiores crescimentos)
```

Regras de decomposição: cada `Secao*.tsx` é um deliverable revisável (uma aba). `hooks.ts`/`tipos.ts`/`temporalidade.ts` são compartilhados. Se um `Secao*.tsx` passar de ~400 linhas, extrair sub-componentes para uma subpasta própria.

---

## Task 1: Helper de temporalidade (puro, testado) + esqueleto da página + rota

**Files:**
- Create: `client/src/pages/painel-executivo/temporalidade.ts`
- Test: `client/src/pages/painel-executivo/temporalidade.test.ts`
- Create: `client/src/pages/PainelExecutivo.tsx`
- Modify: `client/src/App.tsx` (import lazy ~L78-125; Route ~L360-372)

**Interfaces:**
- Produces:
  - `mesDefault(hoje?: Date): string` → último mês fechado em `YYYY-MM` (hoje 2026-07-07 → `"2026-06"`).
  - `labelMes(mes: string): string` → `"Junho 2026"`.
  - `paramsParaMes(mes: string): ParamsMes` onde `ParamsMes = { mes: string; deAte: {de:string;ate:string}; dataInicioFim: {dataInicio:string;dataFim:string}; mesInicioFim: {mesInicio:string;mesFim:string}; startEndDate: {startDate:string;endDate:string} }`.
  - `mesesOptions(hoje?: Date, n?: number): {value:string;label:string}[]` → lista dos últimos `n` (default 12) meses para o Select.

- [ ] **Step 1: Write the failing test**

```ts
// client/src/pages/painel-executivo/temporalidade.test.ts
import { describe, it, expect } from "vitest";
import { mesDefault, labelMes, paramsParaMes, mesesOptions } from "./temporalidade";

describe("temporalidade", () => {
  it("mesDefault retorna o mês anterior ao atual", () => {
    expect(mesDefault(new Date(2026, 6, 7))).toBe("2026-06"); // julho → junho
    expect(mesDefault(new Date(2026, 0, 15))).toBe("2025-12"); // janeiro → dezembro ano anterior
  });

  it("labelMes formata em pt-BR", () => {
    expect(labelMes("2026-06")).toBe("Junho 2026");
  });

  it("paramsParaMes cobre os 4 dialetos e o range de datas do mês", () => {
    const p = paramsParaMes("2026-06");
    expect(p.mes).toBe("2026-06");
    expect(p.deAte).toEqual({ de: "2026-06", ate: "2026-06" });
    expect(p.dataInicioFim).toEqual({ dataInicio: "2026-06", dataFim: "2026-06" });
    expect(p.mesInicioFim).toEqual({ mesInicio: "2026-06", mesFim: "2026-06" });
    expect(p.startEndDate).toEqual({ startDate: "2026-06-01", endDate: "2026-06-30" });
  });

  it("startEndDate calcula o último dia de fevereiro corretamente", () => {
    expect(paramsParaMes("2026-02").startEndDate.endDate).toBe("2026-02-28");
  });

  it("mesesOptions gera n meses decrescentes começando no mês fechado", () => {
    const opts = mesesOptions(new Date(2026, 6, 7), 3);
    expect(opts.map((o) => o.value)).toEqual(["2026-06", "2026-05", "2026-04"]);
    expect(opts[0].label).toBe("Junho 2026");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/pages/painel-executivo/temporalidade.test.ts`
Expected: FAIL — "Failed to resolve import ./temporalidade" / funções não definidas.

- [ ] **Step 3: Write minimal implementation**

```ts
// client/src/pages/painel-executivo/temporalidade.ts
const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Último mês FECHADO em relação a `hoje` (default: mês anterior ao atual). */
export function mesDefault(hoje: Date = new Date()): string {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function labelMes(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  return `${MESES_PT[m - 1]} ${ano}`;
}

export interface ParamsMes {
  mes: string;
  deAte: { de: string; ate: string };
  dataInicioFim: { dataInicio: string; dataFim: string };
  mesInicioFim: { mesInicio: string; mesFim: string };
  startEndDate: { startDate: string; endDate: string };
}

export function paramsParaMes(mes: string): ParamsMes {
  const [ano, m] = mes.split("-").map(Number);
  const ultimoDia = new Date(ano, m, 0).getDate(); // dia 0 do mês seguinte = último dia deste mês
  const dd = String(ultimoDia).padStart(2, "0");
  return {
    mes,
    deAte: { de: mes, ate: mes },
    dataInicioFim: { dataInicio: mes, dataFim: mes },
    mesInicioFim: { mesInicio: mes, mesFim: mes },
    startEndDate: { startDate: `${mes}-01`, endDate: `${mes}-${dd}` },
  };
}

export function mesesOptions(hoje: Date = new Date(), n = 12): { value: string; label: string }[] {
  const base = mesDefault(hoje); // começa no mês fechado
  const [ano, m] = base.split("-").map(Number);
  const opts: { value: string; label: string }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(ano, m - 1 - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    opts.push({ value, label: labelMes(value) });
  }
  return opts;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/pages/painel-executivo/temporalidade.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Create the page shell**

```tsx
// client/src/pages/PainelExecutivo.tsx
import { useState } from "react";
import { LayoutDashboard } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mesDefault, mesesOptions } from "./painel-executivo/temporalidade";

const ABAS = [
  { value: "visao-geral", label: "Visão Geral" },
  { value: "receita", label: "Receita" },
  { value: "churn", label: "Churn" },
  { value: "lt-ltv", label: "LT / LTV" },
  { value: "capacity", label: "Capacity" },
  { value: "entregas", label: "Entregas" },
  { value: "performance", label: "Performance" },
] as const;

export default function PainelExecutivo() {
  usePageTitle("Painel Executivo Mensal");
  useSetPageInfo("Painel Executivo Mensal", "Consolidado mensal auditável");
  const [mes, setMes] = useState<string>(mesDefault());
  const opcoes = mesesOptions();

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-6 w-6 text-teal-600 dark:text-teal-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Painel Executivo Mensal</h1>
            <p className="text-sm text-gray-500 dark:text-zinc-400">Consolidado auditável — clique nos números para o detalhe</p>
          </div>
        </div>
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {opcoes.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="visao-geral">
        <TabsList className="flex w-full flex-wrap justify-start gap-1">
          {ABAS.map((a) => <TabsTrigger key={a.value} value={a.value}>{a.label}</TabsTrigger>)}
        </TabsList>
        {ABAS.map((a) => (
          <TabsContent key={a.value} value={a.value} className="mt-4">
            <div className="text-sm text-gray-500 dark:text-zinc-400">Em construção: {a.label} — {mes}</div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 6: Register the route in App.tsx**

Adicionar no bloco de imports lazy (~L78-125):
```ts
const PainelExecutivo = lazyWithRetry(() => import("@/pages/PainelExecutivo"));
```
Adicionar no `<Switch>` do `ProtectedRouter`, junto às rotas `/dashboard/*` (~L360-372):
```tsx
<Route path="/dashboard/painel-executivo">{() => <ProtectedRoute path="/dashboard/painel-executivo" component={PainelExecutivo} />}</Route>
```

- [ ] **Step 7: Type-check**

Run: `npm run check`
Expected: sem erros novos referentes a `PainelExecutivo`/`temporalidade`.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/PainelExecutivo.tsx client/src/pages/painel-executivo/temporalidade.ts client/src/pages/painel-executivo/temporalidade.test.ts client/src/App.tsx
git commit -m "feat(painel-executivo): esqueleto da página, rota e helper de temporalidade"
```

---

## Task 2: Tipos, hooks de dados e componentes-base (KpiCard, DrillSheet, TemporalidadeBadge)

**Files:**
- Create: `client/src/pages/painel-executivo/tipos.ts`
- Create: `client/src/pages/painel-executivo/hooks.ts`
- Create: `client/src/pages/painel-executivo/TemporalidadeBadge.tsx`
- Create: `client/src/pages/painel-executivo/KpiCard.tsx`
- Create: `client/src/pages/painel-executivo/DrillSheet.tsx`

**Interfaces:**
- Consumes: `paramsParaMes` (Task 1).
- Produces:
  - Hooks: `useReportsMensal(mes)`, `useGestaoReceita(mes)`, `useChurnDetalhamento(mes)`, `useChurnProdutoMotivo(mes)`, `useChurnTaxaMensal(mes)`, `useChurnPorResponsavel(mes)`, `useChurnPontorrente(mes)`, `useCeoDashboard(mes)`, `useLtLtvOverview()`, `useLtLtvDist()`, `useLtLtvClientes()`, `useEstoqueOverview()`, `useEstoquePorProduto()`, `useCapacityTimes()`, `useGestaoReceitaDetalhe(params, enabled)`. Cada um retorna o `UseQueryResult` do React Query.
  - `KpiCard` props: `{ titulo: string; valor: string; sub?: string; temporalidade: "mes" | "snapshot"; delta?: {valor:string; positivo:boolean}; icone?: React.ReactNode; onClick?: () => void }`.
  - `DrillSheet` props: `{ open: boolean; onClose: () => void; titulo: string; subtitulo?: string; colunas: {chave:string; label:string; tipo?:"brl"|"int"|"pct"|"text"}[]; linhas: Record<string, unknown>[]; carregando?: boolean; erro?: boolean }`.
  - `DrillState` type: `{ titulo: string; subtitulo?: string; colunas: DrillColuna[]; linhas: Record<string,unknown>[] } | null` — usado pelas seções para acionar o drawer.

- [ ] **Step 1: Definir tipos parciais dos payloads**

```ts
// client/src/pages/painel-executivo/tipos.ts
export interface OperadorRank { nome: string; valor: number; fotoUrl: string | null; cargo: string | null; }
export interface SquadRank { squad: string; mrr: number; pontual: number; contratos: number; clientes: number; posicao: number; }
export interface ReceitaChurnPonto { month: string; label: string; mrr: number; pontual: number; churnBrl: number; churnPct: number; }
export interface EntregaSquad { squad: string; valor: number; contratos: number; }
export interface EntregaProdutoMes { month: string; label: string; produtos: Record<string, number>; total: number; }
export interface TempoEntrega { produto: string; diasMedio: number; contratos: number; }

export interface ReportsMensal {
  mesReferencia: string; mesLabel: string;
  turboMetrics: {
    mrrAtivo: number; mrrAdicionado: number; churnMrr: number; churnCount: number;
    pausadosMrr: number; pausadosCount: number; crosssellMrr: number; crosssellPontual: number;
    receitaChurnSeries: ReceitaChurnPonto[];
  };
  pontualData: {
    aquisicao: { valor: number; contratos: number };
    entregasMes: { porSquad: EntregaSquad[]; total: number };
    entregasPorProdutoMes: EntregaProdutoMes[];
    tempoMedioEntrega: TempoEntrega[];
    emAberto: { valor: number; contratos: number; porServico: { servico: string; valor: number; contratos: number }[] };
  };
  techData: { kpis: { entregues: number; valorEntregues: number; tempoMedio: number; adicionados: number }; entregasPorTipo: Record<string, unknown>[] };
  topOperadores: { topMrr: OperadorRank[]; topMrrPontual: OperadorRank[]; topEntregas: OperadorRank[] };
  rankingSquads: SquadRank[];
  squadDetails: { squad: string; mrr: number; pontual: number; churnPct: number; churnBrl: number; nrrBrl: number; nrrPct: number }[];
  okrObjectives: { id: string; title: string; krs: { id: string; title: string; unit: string; actual: number | null; achievement: number }[] }[];
}

export interface ChurnDetalhamento {
  contratos: { id: number; cliente_nome: string; produto: string; squad: string; responsavel: string; valorr: number; motivo_cancelamento: string; lifetime_meses: number; ltv: number }[];
  metricas: {
    total_churned: number; mrr_perdido: number; churn_percentual: number; lt_medio: number; ltv_total: number;
    churn_por_squad: Record<string, unknown>; churn_por_pessoa: Record<string, unknown>; churn_por_motivo: Record<string, unknown>;
  };
}

export interface DrillColuna { chave: string; label: string; tipo?: "brl" | "int" | "pct" | "text"; }
export type DrillState = { titulo: string; subtitulo?: string; colunas: DrillColuna[]; linhas: Record<string, unknown>[] } | null;
```

- [ ] **Step 2: Criar os hooks de dados**

```ts
// client/src/pages/painel-executivo/hooks.ts
import { useQuery } from "@tanstack/react-query";
import { paramsParaMes } from "./temporalidade";
import type { ReportsMensal, ChurnDetalhamento } from "./tipos";

const STALE = 5 * 60 * 1000;

// Mensal principal (endpoint pesado → staleTime alto)
export function useReportsMensal(mes: string) {
  return useQuery<ReportsMensal>({ queryKey: ["/api/reports/mensal", { mes }], enabled: !!mes, staleTime: STALE });
}
export function useGestaoReceita(mes: string) {
  const { de, ate } = paramsParaMes(mes).deAte;
  return useQuery({ queryKey: ["/api/gestao/receita", { de, ate }], enabled: !!mes, staleTime: STALE });
}
export function useGestaoReceitaDetalhe(params: Record<string, string> | null) {
  return useQuery({ queryKey: ["/api/gestao/receita/detalhe", params ?? {}], enabled: !!params, staleTime: STALE });
}
export function useChurnDetalhamento(mes: string) {
  const { startDate, endDate } = paramsParaMes(mes).startEndDate;
  return useQuery<ChurnDetalhamento>({ queryKey: ["/api/analytics/churn-detalhamento", { startDate, endDate }], enabled: !!mes, staleTime: STALE });
}
export function useChurnProdutoMotivo(mes: string) {
  const { dataInicio, dataFim } = paramsParaMes(mes).dataInicioFim;
  return useQuery({ queryKey: ["/api/churn/produto-motivo", { dataInicio, dataFim }], enabled: !!mes, staleTime: STALE });
}
export function useChurnTaxaMensal(mes: string) {
  const { dataInicio, dataFim } = paramsParaMes(mes).dataInicioFim;
  return useQuery({ queryKey: ["/api/churn/taxa-mensal", { dataInicio, dataFim }], enabled: !!mes, staleTime: STALE });
}
export function useChurnPorResponsavel(mes: string) {
  const { mesInicio, mesFim } = paramsParaMes(mes).mesInicioFim;
  return useQuery({ queryKey: ["/api/churn-por-responsavel", { mesInicio, mesFim }], enabled: !!mes, staleTime: STALE });
}
export function useChurnPontorrente(mes: string) {
  const { de, ate } = paramsParaMes(mes).deAte;
  return useQuery({ queryKey: ["/api/churn-pontorrente", { de, ate }], enabled: !!mes, staleTime: STALE });
}
export function useCeoDashboard(mes: string) {
  return useQuery({ queryKey: ["/api/ceo-dashboard", { mes }], enabled: !!mes, staleTime: STALE, retry: false });
}
// Snapshot atual (ignoram mês)
export function useLtLtvOverview() { return useQuery({ queryKey: ["/api/lt-ltv-churn/overview"], staleTime: STALE }); }
export function useLtLtvDist() { return useQuery({ queryKey: ["/api/lt-ltv-churn/dist-clientes"], staleTime: STALE }); }
export function useLtLtvClientes() { return useQuery({ queryKey: ["/api/lt-ltv-churn/clientes", { sort: "ltvTotal", dir: "desc", page: "1" }], staleTime: STALE }); }
export function useEstoqueOverview() { return useQuery({ queryKey: ["/api/estoque-pontual/overview"], staleTime: STALE }); }
export function useEstoquePorProduto() { return useQuery({ queryKey: ["/api/estoque-pontual/por-produto"], staleTime: STALE }); }
export function useCapacityTimes() { return useQuery({ queryKey: ["/api/capacity-times"], staleTime: STALE }); }
```

- [ ] **Step 3: TemporalidadeBadge**

```tsx
// client/src/pages/painel-executivo/TemporalidadeBadge.tsx
import { Calendar, Camera } from "lucide-react";
import { labelMes } from "./temporalidade";

export function TemporalidadeBadge({ tipo, mes }: { tipo: "mes" | "snapshot"; mes: string }) {
  if (tipo === "mes") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
        <Calendar className="h-3 w-3" /> {labelMes(mes)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
      <Camera className="h-3 w-3" /> Snapshot atual
    </span>
  );
}
```

- [ ] **Step 4: KpiCard**

```tsx
// client/src/pages/painel-executivo/KpiCard.tsx
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TemporalidadeBadge } from "./TemporalidadeBadge";

interface KpiCardProps {
  titulo: string; valor: string; sub?: string;
  temporalidade: "mes" | "snapshot"; mes: string;
  delta?: { valor: string; positivo: boolean };
  icone?: React.ReactNode; onClick?: () => void;
}

export function KpiCard({ titulo, valor, sub, temporalidade, mes, delta, icone, onClick }: KpiCardProps) {
  return (
    <Card
      className={cn("transition-shadow", onClick && "cursor-pointer hover:shadow-md")}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500 dark:text-zinc-400">{titulo}</span>
          {icone}
        </div>
        <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{valor}</div>
        <div className="mt-1 flex items-center gap-2">
          <TemporalidadeBadge tipo={temporalidade} mes={mes} />
          {delta && (
            <span className={cn("text-[11px] font-medium", delta.positivo ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
              {delta.valor}
            </span>
          )}
        </div>
        {sub && <div className="mt-1 text-xs text-gray-400 dark:text-zinc-500">{sub}</div>}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: DrillSheet**

```tsx
// client/src/pages/painel-executivo/DrillSheet.tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrencyNoDecimals, formatPercent } from "@/lib/utils";
import type { DrillColuna } from "./tipos";

interface DrillSheetProps {
  open: boolean; onClose: () => void;
  titulo: string; subtitulo?: string;
  colunas: DrillColuna[]; linhas: Record<string, unknown>[];
  carregando?: boolean; erro?: boolean;
}

function fmt(v: unknown, tipo?: DrillColuna["tipo"]): string {
  if (v == null) return "—";
  if (tipo === "brl") return formatCurrencyNoDecimals(Number(v));
  if (tipo === "pct") return formatPercent(Number(v));
  if (tipo === "int") return String(Math.round(Number(v)));
  return String(v);
}

export function DrillSheet({ open, onClose, titulo, subtitulo, colunas, linhas, carregando, erro }: DrillSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-[560px] sm:max-w-[560px] overflow-y-auto bg-white dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-700">
        <SheetHeader className="border-b border-gray-200 pb-3 dark:border-zinc-700">
          <SheetTitle className="text-base font-semibold text-gray-900 dark:text-white">{titulo}</SheetTitle>
          {subtitulo && <p className="text-sm text-gray-500 dark:text-zinc-400">{subtitulo}</p>}
        </SheetHeader>
        <div className="mt-4">
          {carregando && <div className="h-40 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800" />}
          {erro && <div className="text-sm text-red-600 dark:text-red-400">Falha ao carregar o detalhe.</div>}
          {!carregando && !erro && (
            <Table>
              <TableHeader>
                <TableRow>{colunas.map((c) => <TableHead key={c.chave}>{c.label}</TableHead>)}</TableRow>
              </TableHeader>
              <TableBody>
                {linhas.length === 0 && (
                  <TableRow><TableCell colSpan={colunas.length} className="text-center text-sm text-gray-400">Sem registros neste mês.</TableCell></TableRow>
                )}
                {linhas.map((linha, i) => (
                  <TableRow key={i}>
                    {colunas.map((c) => <TableCell key={c.chave}>{fmt(linha[c.chave], c.tipo)}</TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 6: Type-check**

Run: `npm run check`
Expected: sem erros novos.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/painel-executivo/tipos.ts client/src/pages/painel-executivo/hooks.ts client/src/pages/painel-executivo/TemporalidadeBadge.tsx client/src/pages/painel-executivo/KpiCard.tsx client/src/pages/painel-executivo/DrillSheet.tsx
git commit -m "feat(painel-executivo): tipos, hooks de dados e componentes-base (KpiCard, DrillSheet, badge)"
```

---

## Task 3: Aba Visão Geral

**Files:**
- Create: `client/src/pages/painel-executivo/SecaoVisaoGeral.tsx`
- Modify: `client/src/pages/PainelExecutivo.tsx` (renderizar `<SecaoVisaoGeral mes={mes} />` na aba `visao-geral`)

**Interfaces:**
- Consumes: `useReportsMensal`, `useLtLtvOverview`, `useCeoDashboard` (hooks), `KpiCard`, `formatCurrency*`.
- Produces: `SecaoVisaoGeral({ mes }: { mes: string })`.

**Conteúdo (KPIs macro, grid responsivo `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`):**
| KPI | Fonte | Campo | Temporalidade |
|---|---|---|---|
| MRR Ativo | reports/mensal | `turboMetrics.mrrAtivo` | mes |
| Nova Receita MRR | reports/mensal | `turboMetrics.mrrAdicionado` | mes |
| Churn MRR | reports/mensal | `turboMetrics.churnMrr` (+ `churnCount`) | mes |
| Cross-sell | reports/mensal | `turboMetrics.crosssellMrr + crosssellPontual` | mes |
| Entregas Pontuais (R$) | reports/mensal | `pontualData.entregasMes.total` | mes |
| Entregas Tech | reports/mensal | `techData.kpis.entregues` | mes |
| LTV médio/cliente | lt-ltv/overview | `ltvMedioCliente` | snapshot |
| Receita/Cabeça | ceo-dashboard | KR/linha `receita_cabeca` (fallback "—" se 403) | mes |

Abaixo dos KPIs, um gráfico Recharts (ComposedChart) da série `turboMetrics.receitaChurnSeries` (barras `mrr`+`pontual`, linha `churnPct`), 12 meses. Loading = grid de Skeletons; erro = Card vermelho (padrão do projeto). Se `useCeoDashboard` retornar erro 403, mostrar o KPI Receita/Cabeça com valor "—" e sub "sem permissão", sem derrubar a aba.

- [ ] **Step 1: Implementar SecaoVisaoGeral**

Estrutura (o mesmo padrão de KpiCard se repete por KPI — não repetir aqui, seguir a tabela acima):
```tsx
// client/src/pages/painel-executivo/SecaoVisaoGeral.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatCurrencyCompact, formatCurrencyNoDecimals, formatPercent } from "@/lib/utils";
import { KpiCard } from "./KpiCard";
import { useReportsMensal, useLtLtvOverview, useCeoDashboard } from "./hooks";

export function SecaoVisaoGeral({ mes }: { mes: string }) {
  const rm = useReportsMensal(mes);
  const ltv = useLtLtvOverview();
  const ceo = useCeoDashboard(mes);

  if (rm.isError) {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40">
        <CardContent className="flex items-center gap-2 py-4 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle className="h-4 w-4" /> Falha ao carregar os dados do mês. Tente recarregar.
        </CardContent>
      </Card>
    );
  }
  if (rm.isLoading || !rm.data) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    );
  }

  const tm = rm.data.turboMetrics;
  const receitaCabeca = (ceo.data as any)?.kpis?.receita_cabeca;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <KpiCard mes={mes} temporalidade="mes" titulo="MRR Ativo" valor={formatCurrencyNoDecimals(tm.mrrAtivo)} />
        <KpiCard mes={mes} temporalidade="mes" titulo="Nova Receita MRR" valor={formatCurrencyNoDecimals(tm.mrrAdicionado)} />
        <KpiCard mes={mes} temporalidade="mes" titulo="Churn MRR" valor={formatCurrencyNoDecimals(tm.churnMrr)} sub={`${tm.churnCount} contratos`} />
        <KpiCard mes={mes} temporalidade="mes" titulo="Cross-sell / Upsell" valor={formatCurrencyNoDecimals(tm.crosssellMrr + tm.crosssellPontual)} />
        <KpiCard mes={mes} temporalidade="mes" titulo="Entregas Pontuais" valor={formatCurrencyNoDecimals(rm.data.pontualData.entregasMes.total)} />
        <KpiCard mes={mes} temporalidade="mes" titulo="Entregas Tech" valor={String(rm.data.techData.kpis.entregues)} />
        <KpiCard mes={mes} temporalidade="snapshot" titulo="LTV médio/cliente" valor={ltv.data ? formatCurrencyNoDecimals((ltv.data as any).ltvMedioCliente) : "—"} />
        <KpiCard mes={mes} temporalidade="mes" titulo="Receita / Cabeça" valor={receitaCabeca != null ? formatCurrencyNoDecimals(receitaCabeca) : "—"} sub={ceo.isError ? "sem permissão" : "meta R$ 20k"} />
      </div>

      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Receita × Churn — 12 meses</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={tm.receitaChurnSeries}>
              <XAxis dataKey="label" fontSize={12} />
              <YAxis yAxisId="l" tickFormatter={(v) => formatCurrencyCompact(v)} fontSize={12} />
              <YAxis yAxisId="r" orientation="right" tickFormatter={(v) => `${v}%`} fontSize={12} />
              <Tooltip formatter={(v: number, n) => n === "churnPct" ? formatPercent(v) : formatCurrencyNoDecimals(v)} />
              <Legend />
              <Bar yAxisId="l" dataKey="mrr" name="MRR" fill="#14b8a6" stackId="a" />
              <Bar yAxisId="l" dataKey="pontual" name="Pontual" fill="#0ea5e9" stackId="a" />
              <Line yAxisId="r" dataKey="churnPct" name="Churn %" stroke="#ef4444" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Ligar na página** — em `PainelExecutivo.tsx`, importar `SecaoVisaoGeral` e trocar o placeholder da aba `visao-geral` por `<SecaoVisaoGeral mes={mes} />`.

- [ ] **Step 3: Type-check + validação visual**

Run: `npm run check`
Validação: subir o app (ver seção "Validação" no fim do plano), abrir `/dashboard/painel-executivo`, confirmar os 8 KPIs e o gráfico com dados de junho/2026, em dark e light mode.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/painel-executivo/SecaoVisaoGeral.tsx client/src/pages/PainelExecutivo.tsx
git commit -m "feat(painel-executivo): aba Visão Geral (KPIs macro + série receita×churn)"
```

---

## Task 4: Aba Receita (MRR + Pontual) com drill-down

**Files:**
- Create: `client/src/pages/painel-executivo/SecaoReceita.tsx`
- Modify: `client/src/pages/PainelExecutivo.tsx`

**Interfaces:**
- Consumes: `useReportsMensal`, `useGestaoReceitaDetalhe`, `KpiCard`, `DrillSheet`, `DrillState`.
- Produces: `SecaoReceita({ mes }: { mes: string })`.

**Conteúdo — dois blocos (2 grids de KpiCard), todos `temporalidade="mes"`, fonte `reports/mensal`:**

Bloco **MRR**:
| KPI | Campo |
|---|---|
| Receita MRR (ativo) | `turboMetrics.mrrAtivo` |
| Nova receita | `turboMetrics.mrrAdicionado` |
| Churn | `turboMetrics.churnMrr` (`churnCount` no sub) |
| Pausado/Reativado | `turboMetrics.pausadosMrr` (`pausadosCount` no sub) |
| Cross-sell | `turboMetrics.crosssellMrr` |

Bloco **Pontual**:
| KPI | Campo |
|---|---|
| Nova receita (aquisição) | `pontualData.aquisicao.valor` (`.contratos` no sub) |
| Entregue | `pontualData.entregasMes.total` |
| Cross-sell | `turboMetrics.crosssellPontual` |
| Em aberto (estoque) | `pontualData.emAberto.valor` — **temporalidade="snapshot"** |

**Drill-down:** clicar num KpiCard de MRR abre o `DrillSheet` alimentado por `useGestaoReceitaDetalhe`. Mapear o KPI → params do detalhe:
- Churn MRR → `{ de: mes, ate: mes, tipo: "churn", chave: "total" }`
- Venda/Nova receita → `{ de, ate, tipo: "venda", chave: "mrr" }`
Como o shape de `/detalhe` é `{titulo,subtitulo,total,unidade,grupos[]}` (não uma lista flat de contratos), o drill exibe os `grupos` como linhas (colunas: `label`, `valor`). Para KPIs sem endpoint de detalhe compatível (pausado, cross-sell), o card NÃO é clicável nesta fase (sem `onClick`) — evita drawer vazio. Documentar isso como limitação conhecida no card (sem cursor-pointer).

- [ ] **Step 1: Implementar SecaoReceita** (padrão de KpiCard repetido conforme as duas tabelas acima; estado `const [drill, setDrill] = useState<DrillState>(null)`; drawer no fim):

```tsx
// client/src/pages/painel-executivo/SecaoReceita.tsx
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { KpiCard } from "./KpiCard";
import { DrillSheet } from "./DrillSheet";
import { useReportsMensal, useGestaoReceitaDetalhe } from "./hooks";
import type { DrillState } from "./tipos";
import { paramsParaMes, labelMes } from "./temporalidade";

export function SecaoReceita({ mes }: { mes: string }) {
  const rm = useReportsMensal(mes);
  const [detalheParams, setDetalheParams] = useState<Record<string, string> | null>(null);
  const detalhe = useGestaoReceitaDetalhe(detalheParams);
  const [drillAberto, setDrillAberto] = useState(false);

  function abrirDrill(tipo: string, chave: string) {
    const { de, ate } = paramsParaMes(mes).deAte;
    setDetalheParams({ de, ate, tipo, chave });
    setDrillAberto(true);
  }

  if (rm.isError) return <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40"><CardContent className="flex items-center gap-2 py-4 text-sm text-red-700 dark:text-red-300"><AlertTriangle className="h-4 w-4" /> Falha ao carregar receita.</CardContent></Card>;
  if (rm.isLoading || !rm.data) return <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>;

  const tm = rm.data.turboMetrics;
  const p = rm.data.pontualData;
  const grupos = (detalhe.data as any)?.grupos ?? [];

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">MRR</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <KpiCard mes={mes} temporalidade="mes" titulo="Receita MRR" valor={formatCurrencyNoDecimals(tm.mrrAtivo)} onClick={() => abrirDrill("venda", "mrr")} />
          <KpiCard mes={mes} temporalidade="mes" titulo="Nova receita" valor={formatCurrencyNoDecimals(tm.mrrAdicionado)} onClick={() => abrirDrill("venda", "mrr")} />
          <KpiCard mes={mes} temporalidade="mes" titulo="Churn" valor={formatCurrencyNoDecimals(tm.churnMrr)} sub={`${tm.churnCount} contratos`} onClick={() => abrirDrill("churn", "total")} />
          <KpiCard mes={mes} temporalidade="mes" titulo="Pausado/Reativado" valor={formatCurrencyNoDecimals(tm.pausadosMrr)} sub={`${tm.pausadosCount} contratos`} />
          <KpiCard mes={mes} temporalidade="mes" titulo="Cross-sell" valor={formatCurrencyNoDecimals(tm.crosssellMrr)} />
        </div>
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Pontual</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard mes={mes} temporalidade="mes" titulo="Nova receita" valor={formatCurrencyNoDecimals(p.aquisicao.valor)} sub={`${p.aquisicao.contratos} contratos`} />
          <KpiCard mes={mes} temporalidade="mes" titulo="Entregue" valor={formatCurrencyNoDecimals(p.entregasMes.total)} />
          <KpiCard mes={mes} temporalidade="mes" titulo="Cross-sell" valor={formatCurrencyNoDecimals(tm.crosssellPontual)} />
          <KpiCard mes={mes} temporalidade="snapshot" titulo="Em aberto (estoque)" valor={formatCurrencyNoDecimals(p.emAberto.valor)} sub={`${p.emAberto.contratos} itens`} />
        </div>
      </section>

      <DrillSheet
        open={drillAberto}
        onClose={() => setDrillAberto(false)}
        titulo={(detalhe.data as any)?.titulo ?? "Detalhe"}
        subtitulo={`${(detalhe.data as any)?.subtitulo ?? ""} · ${labelMes(mes)}`}
        colunas={[{ chave: "label", label: "Grupo", tipo: "text" }, { chave: "valor", label: "Valor", tipo: "brl" }]}
        linhas={grupos}
        carregando={detalhe.isLoading}
        erro={detalhe.isError}
      />
    </div>
  );
}
```

- [ ] **Step 2: Ligar na página** — trocar placeholder da aba `receita` por `<SecaoReceita mes={mes} />`.
- [ ] **Step 3: Type-check + validação** — `npm run check`; abrir aba Receita, conferir os dois blocos e o drill de Churn abrindo o drawer com grupos.
- [ ] **Step 4: Commit**

```bash
git add client/src/pages/painel-executivo/SecaoReceita.tsx client/src/pages/PainelExecutivo.tsx
git commit -m "feat(painel-executivo): aba Receita (MRR + Pontual) com drill-down de detalhe"
```

---

## Task 5: Aba Churn (Recorrente + Pontual)

**Files:**
- Create: `client/src/pages/painel-executivo/SecaoChurn.tsx`
- Modify: `client/src/pages/PainelExecutivo.tsx`

**Interfaces:**
- Consumes: `useChurnDetalhamento`, `useChurnProdutoMotivo`, `useChurnTaxaMensal`, `useChurnPorResponsavel`, `useChurnPontorrente`, sub-Tabs, `DrillSheet`.
- Produces: `SecaoChurn({ mes }: { mes: string })`.

**Conteúdo — sub-abas internas `Tabs` (Recorrente | Pontual):**

**Recorrente** (`temporalidade="mes"`):
- KPIs: Churn geral R$ (`churnDetalhamento.metricas.mrr_perdido`), % (`metricas.churn_percentual`), nº contratos (`metricas.total_churned`). Fonte `useChurnDetalhamento`.
- **Por produto + Motivos**: tabela de `useChurnProdutoMotivo` → `celulas[]` (colunas: produto, motivo_cancelamento, cancelamentos, mrr_perdido).
- **Por operador**: tabela de `useChurnPorResponsavel` → `[{responsavel,quantidadeContratos,valorTotal,percentualChurn}]`.
- **Por squad**: derivar de `churnDetalhamento.metricas.churn_por_squad` (objeto → linhas).
- **% série**: mini-gráfico de `useChurnTaxaMensal` → `rows[{mes,taxa}]`.
- Drill: clicar numa linha de produto abre `DrillSheet` com os `contratos` de `churnDetalhamento` filtrados por aquele produto (colunas: cliente_nome, squad, responsavel, valorr(brl), motivo_cancelamento).

**Pontual** (`temporalidade="mes"`, fonte `useChurnPontorrente`):
- KPIs e tabela do payload de churn-pontorrente (drop-off por jornada). Renderizar total e a lista de itens com `{nomeCliente, produto, servico, motivoCancelamento, valorp}`.

Loading/erro padrão por sub-aba (Skeleton / Card vermelho).

- [ ] **Step 1: Implementar SecaoChurn** — seguir o padrão: `Tabs defaultValue="recorrente"` com `TabsTrigger` Recorrente/Pontual; dentro de cada, os KPIs (KpiCard) + tabelas (`Table` do shadcn) conforme mapeamento acima; estado de drill como na Task 4. Reusar o bloco de loading/erro. (Código segue exatamente os padrões das Tasks 3-4; usar os campos das tabelas acima.)

- [ ] **Step 2: Ligar na página** — aba `churn` → `<SecaoChurn mes={mes} />`.
- [ ] **Step 3: Type-check + validação** — `npm run check`; conferir sub-abas Recorrente/Pontual, tabelas populadas e drill por produto.
- [ ] **Step 4: Commit**

```bash
git add client/src/pages/painel-executivo/SecaoChurn.tsx client/src/pages/PainelExecutivo.tsx
git commit -m "feat(painel-executivo): aba Churn (recorrente + pontual, por produto/motivo/operador/squad)"
```

---

## Task 6: Aba LT/LTV

**Files:**
- Create: `client/src/pages/painel-executivo/SecaoLtLtv.tsx`
- Modify: `client/src/pages/PainelExecutivo.tsx`

**Interfaces:**
- Consumes: `useLtLtvOverview`, `useLtLtvDist`, `useLtLtvClientes` (todos snapshot).
- Produces: `SecaoLtLtv({ mes }: { mes: string })`.

**Conteúdo (TUDO `temporalidade="snapshot"` — deixar explícito no topo com um aviso: "LT/LTV refletem a base ativa atual, não o mês selecionado"):**
- KPIs de `useLtLtvOverview`: LT médio ativo (`ltMedioAtivo`), LT médio cancelado (`ltMedioCancelado`), LTV médio/cliente (`ltvMedioCliente`), total recorrentes (`totalRecorrentes`).
- **Distribuição** (`useLtLtvDist`): dois gráficos de barras Recharts — `ltv[{faixa,qtd}]` e `lt[{faixa,qtd}]` (média/mediana visível pela distribuição).
- **Maiores por LTV** (`useLtLtvClientes`): tabela top (`clientes[{nomeCliente,ltvTotal,ltMeses}]`).

- [ ] **Step 1: Implementar SecaoLtLtv** — aviso no topo (Card âmbar), grid de KpiCard snapshot, 2 BarChart, 1 tabela. Padrões das tasks anteriores.
- [ ] **Step 2: Ligar na página** — aba `lt-ltv` → `<SecaoLtLtv mes={mes} />`.
- [ ] **Step 3: Type-check + validação** — `npm run check`; conferir gráficos e aviso de snapshot.
- [ ] **Step 4: Commit**

```bash
git add client/src/pages/painel-executivo/SecaoLtLtv.tsx client/src/pages/PainelExecutivo.tsx
git commit -m "feat(painel-executivo): aba LT/LTV (overview, distribuição, maiores por LTV)"
```

---

## Task 7: Aba Capacity (Receita por cabeça)

**Files:**
- Create: `client/src/pages/painel-executivo/SecaoCapacity.tsx`
- Modify: `client/src/pages/PainelExecutivo.tsx`

**Interfaces:**
- Consumes: `useCeoDashboard` (mensal, pode 403), `useCapacityTimes` (snapshot).
- Produces: `SecaoCapacity({ mes }: { mes: string })`.

**Conteúdo:**
- **Receita por cabeça (mês)**: de `useCeoDashboard` → `kpis.receita_cabeca` (valor macro), com barra vs **meta R$ 20k** (`min(valor/20000,1)` largura). `temporalidade="mes"`. Se 403: Card informando "Receita por cabeça requer permissão de CEO".
- **Por squad / operador (snapshot)**: de `useCapacityTimes` → tabelas por squad (`squads[{squad,rows[]}]`, cada row com faturamento/utilização) e listas `selva/black/squadra/cxcs`. `temporalidade="snapshot"`.

- [ ] **Step 1: Implementar SecaoCapacity** — barra de meta 20k (div com `width: ${pct}%`), tabelas de capacity. Tratar `ceo.isError` (403) com Card informativo, sem quebrar a aba.
- [ ] **Step 2: Ligar na página** — aba `capacity` → `<SecaoCapacity mes={mes} />`.
- [ ] **Step 3: Type-check + validação** — `npm run check`; conferir barra de meta e tabelas.
- [ ] **Step 4: Commit**

```bash
git add client/src/pages/painel-executivo/SecaoCapacity.tsx client/src/pages/PainelExecutivo.tsx
git commit -m "feat(painel-executivo): aba Capacity (receita por cabeça vs meta 20k + carteira por squad)"
```

---

## Task 8: Aba Entregas Pontuais

**Files:**
- Create: `client/src/pages/painel-executivo/SecaoEntregas.tsx`
- Modify: `client/src/pages/PainelExecutivo.tsx`

**Interfaces:**
- Consumes: `useReportsMensal` (entregas do mês), `useEstoqueOverview`, `useEstoquePorProduto` (snapshot).
- Produces: `SecaoEntregas({ mes }: { mes: string })`.

**Conteúdo:**
- **Total entregue (mês)**: `reports/mensal → pontualData.entregasMes.total` + `techData.kpis.entregues`. `temporalidade="mes"`.
- **Por produto**: última coluna da série `pontualData.entregasPorProdutoMes` correspondente ao `mes` (ler o item com `month === mes`, expandir `.produtos` como tabela produto→valor). `temporalidade="mes"`.
- **Por operador**: `reports/mensal → topOperadores.topEntregas` (`{nome,valor}` = contagem de entregas do mês). `temporalidade="mes"`.
- **Aberto × Entregue**: Aberto = `useEstoqueOverview → qtdItens/valorEstoque` (`snapshot`); Entregue = `pontualData.entregasMes.total`/`contratos` (`mes`). Dois cards lado a lado com badges distintos.
- **Lead time por produto**: `reports/mensal → pontualData.tempoMedioEntrega[{produto,diasMedio,contratos}]` (tabela ordenada; nota "últimos 6 meses"). `temporalidade="mes"` com sub "janela 6m".

- [ ] **Step 1: Implementar SecaoEntregas** — encontrar `serieMes = pontualData.entregasPorProdutoMes.find(x => x.month === mes)`; se ausente, mostrar "sem entregas registradas no mês". Tabelas + cards conforme mapeamento.
- [ ] **Step 2: Ligar na página** — aba `entregas` → `<SecaoEntregas mes={mes} />`.
- [ ] **Step 3: Type-check + validação** — `npm run check`; conferir por-produto do mês, lead time e aberto×entregue.
- [ ] **Step 4: Commit**

```bash
git add client/src/pages/painel-executivo/SecaoEntregas.tsx client/src/pages/PainelExecutivo.tsx
git commit -m "feat(painel-executivo): aba Entregas (total, por produto/operador, aberto×entregue, lead time)"
```

---

## Task 9: Aba Performance + cards "Em breve" (fase 2) + polish final

**Files:**
- Create: `client/src/pages/painel-executivo/SecaoPerformance.tsx`
- Create: `client/src/pages/painel-executivo/EmBreveCard.tsx`
- Modify: `client/src/pages/painel-executivo/SecaoVisaoGeral.tsx` (adicionar cards Em breve: NPS, Margem)
- Modify: `client/src/pages/PainelExecutivo.tsx`

**Interfaces:**
- Consumes: `useReportsMensal` (rankings), `useLtLtvClientes` (maiores clientes).
- Produces: `SecaoPerformance({ mes }: { mes: string })`, `EmBreveCard({ titulo, motivo })`.

**Conteúdo Performance:**
- **TOP 10 Maiores clientes (R$)**: `useLtLtvClientes` → `clientes` ordenado por `ltvTotal` desc, top 10 (nome, ltvTotal, ltMeses). `temporalidade="snapshot"`.
- **TOP operadores (mês)**: `reports/mensal → topOperadores.topMrrPontual` (nome, valor, cargo, fotoUrl). `temporalidade="mes"`.
- **Ranking de squads (mês)**: `reports/mensal → rankingSquads` (squad, mrr, pontual, posicao). `temporalidade="mes"`.
- **Maiores crescimentos** e **Maiores investimentos**: `EmBreveCard` (fase 2).

**EmBreveCard:** card neutro, ícone `Clock`, título + motivo ("Fase 2 — requer fonte de dados X"). Usado para NPS (Visão Geral), Margem de Contribuição (Visão Geral) e Maiores Crescimentos/Investimentos (Performance).

- [ ] **Step 1: Implementar EmBreveCard**

```tsx
// client/src/pages/painel-executivo/EmBreveCard.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";

export function EmBreveCard({ titulo, motivo }: { titulo: string; motivo: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-gray-400 dark:text-zinc-500">
          <Clock className="h-4 w-4" />
          <span className="text-xs font-medium">{titulo}</span>
        </div>
        <div className="mt-2 text-sm text-gray-400 dark:text-zinc-500">Em breve</div>
        <div className="mt-1 text-[11px] text-gray-400 dark:text-zinc-600">{motivo}</div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Implementar SecaoPerformance** — 3 tabelas/listas (maiores clientes, top operadores, ranking squads) + 2 EmBreveCard (Maiores crescimentos "requer delta MoM por cliente"; Maiores investimentos "requer fonte de ads").
- [ ] **Step 3: Adicionar EmBreve na Visão Geral** — no fim de `SecaoVisaoGeral`, uma linha com `<EmBreveCard titulo="NPS" motivo="Fase 2 — requer fonte cortex_core.nps_clientes" />` e `<EmBreveCard titulo="Margem de Contribuição" motivo="Fase 2 — receita − custos de operação por squad" />`.
- [ ] **Step 4: Ligar na página** — aba `performance` → `<SecaoPerformance mes={mes} />`.
- [ ] **Step 5: Polish** — revisar responsividade (grids `grid-cols-2` no mobile), overflow de tabelas (`overflow-x-auto`), dark mode em todos os elementos custom, e consistência de espaçamento entre abas.
- [ ] **Step 6: Suite completa + type-check + lint**

Run: `npm run check && npx vitest run client/src/pages/painel-executivo/ && npm run lint`
Expected: tsc sem erros; testes de temporalidade passam; lint sem warnings novos.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/painel-executivo/SecaoPerformance.tsx client/src/pages/painel-executivo/EmBreveCard.tsx client/src/pages/painel-executivo/SecaoVisaoGeral.tsx client/src/pages/PainelExecutivo.tsx
git commit -m "feat(painel-executivo): aba Performance + cards Em breve (NPS, Margem, crescimentos) da fase 2"
```

---

## Validação (rodar após cada task com deliverable visual)

O dev server do Cortex é `tsx` sem watch (backend exige restart manual; frontend Vite recarrega). Como só mexemos no frontend, o Vite HMR cobre. Para validar autenticado:
1. Garantir server rodando: `npm run dev` (porta 3000). Se ocupada por outra sessão, subir 2º server do repo principal em `PORT=3001` (ver memória de projeto).
2. Navegar autenticado (Chrome já logado na 3000/3001) para `/dashboard/painel-executivo`.
3. Para cada aba: confirmar dados de junho/2026, trocar o mês no seletor e ver o refetch, testar dark E light mode, e (nas abas com drill) abrir o drawer.
4. Conferir a auditabilidade: os KPIs de churn/receita batem com `/dashboard/churn-detalhamento` e `/gestao/receita` no mesmo mês.

## Self-Review (checado contra o spec)

- **Cobertura do spec:** Receita MRR+Pontual e movimentos (Task 3-4) ✅; Churn rec+pontual por produto/motivo/operador/squad (Task 5) ✅; LT/LTV por produto + média/mediana via distribuição (Task 6) ✅; Receita por cabeça vs meta 20k (Task 7) ✅; Entregas total/produto/operador/aberto×entregue/lead time (Task 8) ✅; Performance maiores clientes + rankings (Task 9) ✅; Auditável via DrillSheet + badges de temporalidade ✅; seletor de mês (Task 1) ✅. Fase 2 (NPS, Margem, Maiores crescimentos) como EmBreveCard ✅.
- **Divergências do spec assumidas conscientemente:** (1) Fonte principal virou `reports/mensal` (não os endpoints individuais de gestão/receita), porque só ele entrega os movimentos MENSAIS — os individuais eram foto-atual. (2) "Maiores investimentos" desceu para fase 2 (EmBreveCard) por depender de confirmar a fonte de ads. (3) Drill de MRR usa `gestao/receita/detalhe` (grupos), não lista flat de contratos — KPIs sem detalhe compatível ficam não-clicáveis nesta fase.
- **Temporalidade:** blocos foto-atual (LT/LTV, Capacity por squad, Estoque em aberto) recebem badge `Snapshot atual` — nunca fingem ser do mês. Esse é o núcleo da auditabilidade.
