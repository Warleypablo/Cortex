# CrossSell Dashboard — Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar o dashboard de CrossSell com direção executiva (1 KPI hero + 4 secundários com delta vs mês anterior), funil de conversão visual, top 5 clientes em negociação e rankings com pódio.

**Architecture:** Backend (`server/routes/crosssell.ts` handler `/dashboard`) ganha (a) cálculo dos mesmos KPIs para o mês anterior, (b) lista top 5 clientes em negociação. Frontend (`client/src/pages/CrossSellDashboard.tsx`) é reescrito mantendo o mesmo arquivo: passa de 9 KPIs chapados + 2 bar charts + 2 cards cinzas para 1 hero + 4 secundários + funil custom + lista top + 2 pódios. Inline components seguindo o padrão de `CrossSellPipeline.tsx`.

**Tech Stack:** Express + Drizzle (backend), React 18 + TanStack Query + Tailwind CSS (frontend). Charts custom em divs (sem Recharts no funil). shadcn/ui já presente.

**Spec:** [`docs/superpowers/specs/2026-05-08-crosssell-dashboard-redesign-design.md`](../specs/2026-05-08-crosssell-dashboard-redesign-design.md)

**Branch alvo:** `feature/crosssell-dashboard-redesign` (criar a partir de `main`, não da branch do PR #179).

**Convenções (CLAUDE.md):**
- Migration de schema sempre **prod E local** (não há migration aqui — só código).
- Suporte dark/light mode obrigatório.
- Conventional Commits + `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`.
- Não há suite de testes automatizados pra esta área — verificação por curl + browser.

---

## File Structure

| Arquivo | Responsabilidade | Status |
|---------|------------------|--------|
| `server/routes/crosssell.ts` | Handler do dashboard estendido com mês anterior + top clientes | Modificar (~linha 466-615) |
| `client/src/pages/CrossSellDashboard.tsx` | Página completa reescrita: tipos, helper `formatDelta`, componentes inline `HeroKpi`, `SecondaryKpiCard`, `ConversionFunnel`, `TopClientesList`, `PodiumRanking`, mais o componente principal | Reescrever (438 linhas → ~700 linhas estimadas) |

Nenhum arquivo novo. Tudo segue o padrão do projeto: componentes inline na página principal.

---

## Task 0: Preparar branch

**Files:** —

- [ ] **Step 1: Voltar para main e atualizar**

```bash
git checkout main
git pull origin main
```

- [ ] **Step 2: Criar branch nova a partir de main**

```bash
git checkout -b feature/crosssell-dashboard-redesign
```

- [ ] **Step 3: Trazer apenas o spec (commit `3de94c64`) da branch anterior**

```bash
git cherry-pick 3de94c64
```

Expected: o spec aparece como commit nesta branch. Se conflitar, abortar e copiar o arquivo manualmente:

```bash
git cherry-pick --abort
git checkout feature/crosssell-vendedor-oportunidade -- docs/superpowers/specs/2026-05-08-crosssell-dashboard-redesign-design.md
git add docs/superpowers/specs/2026-05-08-crosssell-dashboard-redesign-design.md
git commit -m "docs(crosssell): add design spec for dashboard redesign"
```

- [ ] **Step 4: Confirmar dev server desligado**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null || echo "porta livre"
```

---

## Task 1: Backend — KPIs do mês anterior

**Files:**
- Modify: `server/routes/crosssell.ts:466-615` (handler `GET /api/comercial/crosssell/dashboard`)

- [ ] **Step 1: Adicionar cálculo de mês anterior no início do handler**

Localizar (linha ~469):

```ts
      const { mes, ano } = req.query;

      // Build date filter for ganhos
      let ganhoDateFilter = "";
```

Substituir por:

```ts
      const { mes, ano } = req.query;

      // Compute previous-month period for delta calculation.
      // Falls back to no-prev when month/year are missing.
      let mesPrev: number | null = null;
      let anoPrev: number | null = null;
      if (mes && ano) {
        const m = Number(mes);
        const y = Number(ano);
        if (m === 1) {
          mesPrev = 12;
          anoPrev = y - 1;
        } else {
          mesPrev = m - 1;
          anoPrev = y;
        }
      }

      // Build date filter for ganhos
      let ganhoDateFilter = "";
```

- [ ] **Step 2: Adicionar filtros de data para o mês anterior**

Logo após os blocos `ganhoDateFilter` e `opDateFilter` existentes (linhas ~471-485), adicionar:

```ts
      // Same filters but for previous month
      let ganhoDateFilterPrev = "";
      let opDateFilterPrev = "";
      if (mesPrev !== null && anoPrev !== null) {
        ganhoDateFilterPrev = `AND EXTRACT(MONTH FROM ng.mes_ganho) = ${mesPrev} AND EXTRACT(YEAR FROM ng.mes_ganho) = ${anoPrev}`;
        opDateFilterPrev = `AND EXTRACT(MONTH FROM o.criado_em) = ${mesPrev} AND EXTRACT(YEAR FROM o.criado_em) = ${anoPrev}`;
      }
```

- [ ] **Step 3: Adicionar query KPIs do mês anterior ao Promise.all**

A `Promise.all` atual (linha ~487) carrega 7 queries. Adicionar uma 8ª query para os KPIs do mês anterior. Localizar:

```ts
      const [
        kpisResult,
        funilResult,
        reunioesPorCxResult,
        rankingValorResult,
        rankingReunioesResult,
        clientesNegociacaoResult,
        coberturaResult,
      ] = await Promise.all([
```

Substituir por:

```ts
      const [
        kpisResult,
        kpisPrevResult,
        funilResult,
        reunioesPorCxResult,
        rankingValorResult,
        rankingReunioesResult,
        clientesNegociacaoResult,
        coberturaResult,
        topClientesResult,
      ] = await Promise.all([
```

(Estamos adicionando `kpisPrevResult` e `topClientesResult` à desestruturação. As próximas tasks adicionam as queries correspondentes.)

- [ ] **Step 4: Adicionar a query KPIs do mês anterior**

Logo após a query `kpisResult` (que termina por volta da linha 508 com `) AS sugestoes_total_transicoes \``, em um `db.execute(sql.raw(...))` block), inserir uma nova query similar mas usando os filtros `*Prev`:

Localizar o final do bloco da query KPIs original:

```ts
        db.execute(sql.raw(`
          SELECT
            (SELECT COUNT(*)::int FROM cortex_core.crosssell_oportunidades o WHERE o.etapa = 'reuniao_agendada' ${opDateFilter}) AS reunioes_agendadas,
            (SELECT COUNT(*)::int FROM cortex_core.crosssell_oportunidades o WHERE o.etapa = 'reuniao_realizada' ${opDateFilter}) AS reunioes_realizadas,
            (SELECT COALESCE(SUM(o.valor_r_negociacao), 0) FROM cortex_core.crosssell_oportunidades o WHERE o.etapa NOT IN ('ganho', 'perdido') ${opDateFilter}) AS total_r_negociacao,
            (SELECT COALESCE(SUM(o.valor_p_negociacao), 0) FROM cortex_core.crosssell_oportunidades o WHERE o.etapa NOT IN ('ganho', 'perdido') ${opDateFilter}) AS total_p_negociacao,
            (SELECT COUNT(*)::int FROM cortex_core.crosssell_negocios_ganhos ng WHERE 1=1 ${ganhoDateFilter}) AS total_ganhos,
            (SELECT COUNT(*)::int FROM cortex_core.crosssell_oportunidades o WHERE 1=1 ${opDateFilter}) AS total_oportunidades
            ,(SELECT COUNT(*)::int FROM cortex_core.crosssell_oportunidades o WHERE o.etapa = 'sugerido_sistema') AS sugestoes_ativas
            ,(SELECT COUNT(*)::int FROM cortex_core.crosssell_etapa_log el WHERE el.etapa_anterior = 'sugerido_sistema' AND el.etapa_nova != 'descartado') AS sugestoes_aceitas
            ,(SELECT COUNT(*)::int FROM cortex_core.crosssell_etapa_log el WHERE el.etapa_anterior = 'sugerido_sistema') AS sugestoes_total_transicoes
        `)),
```

Após a `,)` que fecha esse bloco, **inserir um novo bloco** (logo antes da query `funilResult`):

```ts
        // KPIs do mês anterior — apenas os 5 que serão exibidos com delta no front
        db.execute(sql.raw(`
          SELECT
            (SELECT COUNT(*)::int FROM cortex_core.crosssell_oportunidades o WHERE o.etapa = 'reuniao_agendada' ${opDateFilterPrev}) AS reunioes_agendadas,
            (SELECT COALESCE(SUM(o.valor_r_negociacao), 0) FROM cortex_core.crosssell_oportunidades o WHERE o.etapa NOT IN ('ganho', 'perdido') ${opDateFilterPrev}) AS total_r_negociacao,
            (SELECT COALESCE(SUM(o.valor_p_negociacao), 0) FROM cortex_core.crosssell_oportunidades o WHERE o.etapa NOT IN ('ganho', 'perdido') ${opDateFilterPrev}) AS total_p_negociacao,
            (SELECT COUNT(*)::int FROM cortex_core.crosssell_negocios_ganhos ng WHERE 1=1 ${ganhoDateFilterPrev}) AS total_ganhos,
            (SELECT COUNT(*)::int FROM cortex_core.crosssell_oportunidades o WHERE 1=1 ${opDateFilterPrev}) AS total_oportunidades
        `)),
```

- [ ] **Step 5: Adicionar mapeamento de `kpisAnterior` na resposta JSON**

Localizar o `res.json({ ... })` (linha ~572). Logo após o bloco `kpis: { ... }` (que fecha por volta da linha 591 com `coberturaBase: (() => { ... })()`,), adicionar:

```ts
        kpisAnterior: (() => {
          const prev = kpisPrevResult.rows[0] as any;
          if (!prev) {
            return {
              totalRNegociacao: 0,
              totalPNegociacao: 0,
              reunioesAgendadas: 0,
              taxaConversao: 0,
              coberturaBase: 0,
            };
          }
          const totalOpsPrev = Number(prev.total_oportunidades) || 0;
          const totalGanhosPrev = Number(prev.total_ganhos) || 0;
          return {
            totalRNegociacao: Number(prev.total_r_negociacao) || 0,
            totalPNegociacao: Number(prev.total_p_negociacao) || 0,
            reunioesAgendadas: Number(prev.reunioes_agendadas) || 0,
            taxaConversao: totalOpsPrev > 0
              ? Number(((totalGanhosPrev / totalOpsPrev) * 100).toFixed(1))
              : 0,
            // Cobertura é stateful — não temos snapshot histórico. Sempre 0 para forçar delta = 0.
            coberturaBase: 0,
          };
        })(),
```

- [ ] **Step 6: Reiniciar dev server e testar**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
```

Aguardar ~5s.

```bash
curl -s -b cookies.txt 'http://localhost:3000/api/comercial/crosssell/dashboard?mes=5&ano=2026' | head -c 800
```

Expected: 401 Unauthorized OR JSON contendo `kpisAnterior`. Se 401, verificar via psql que a query nova está sintaticamente válida (não houve erro nos logs do dev server).

Verificar logs do server para garantir ausência de erros:

```bash
ps aux | grep "tsx watch" | grep -v grep | head -3
```

- [ ] **Step 7: Commit**

```bash
git add server/routes/crosssell.ts
git commit -m "$(cat <<'EOF'
feat(api): expose previous-month KPIs in dashboard endpoint

Computa (mesPrev, anoPrev) com rollover de janeiro para dezembro do ano
anterior. Roda 1 query adicional em paralelo para os 5 KPIs visíveis
(R, P, reuniões agendadas, taxa conversão, cobertura). Cobertura sempre
0 no anterior — não há snapshot histórico, delta será 0pp.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Backend — top 5 clientes em negociação

**Files:**
- Modify: `server/routes/crosssell.ts` (mesmo handler, adicionar query e mapeamento)

- [ ] **Step 1: Adicionar query top clientes ao Promise.all**

Como Task 1 já adicionou `topClientesResult` à destructure, agora adicionamos a query correspondente ao final do array do `Promise.all`. Localizar a query `coberturaResult` (que é a última hoje, terminando por volta da linha 565):

```ts
        // Cobertura: clientes com oportunidades / total clientes ativos
        db.execute(sql.raw(`
          SELECT
            (SELECT COUNT(DISTINCT cnpj)::int
             FROM cortex_core.crosssell_oportunidades
             WHERE etapa NOT IN ('ganho', 'descartado')) AS com_oportunidade,
            (SELECT COUNT(*)::int
             FROM "Clickup".cup_clientes
             WHERE status IN ('ativo', 'Ativo', 'ATIVO')
               AND cnpj IS NOT NULL AND cnpj != '') AS total_ativos
        `)),
```

Logo após esse bloco (mantendo a vírgula do final), **adicionar** o bloco da nova query:

```ts
        // Top 5 clientes em negociação (por valor R, etapas ativas)
        db.execute(sql.raw(`
          SELECT
            o.cnpj,
            c.nome AS cliente_nome,
            o.etapa,
            o.valor_r_negociacao,
            o.id AS oportunidade_id
          FROM cortex_core.crosssell_oportunidades o
          LEFT JOIN "Clickup".cup_clientes c ON c.cnpj = o.cnpj
          WHERE o.etapa NOT IN ('ganho', 'descartado', 'sugerido_sistema')
            AND o.valor_r_negociacao IS NOT NULL
            AND o.valor_r_negociacao > 0
          ORDER BY o.valor_r_negociacao DESC NULLS LAST
          LIMIT 5
        `)),
```

- [ ] **Step 2: Adicionar `topClientes` na resposta JSON**

No mesmo `res.json({ ... })`, após `rankingReunioes: (...)` (que é hoje a última chave, fechando o objeto na linha ~609), adicionar antes do `})` que fecha o `res.json`:

```ts
        topClientes: (topClientesResult.rows as any[]).map((r) => ({
          cnpj: r.cnpj,
          clienteNome: r.cliente_nome,
          etapa: r.etapa,
          valorR: Number(r.valor_r_negociacao) || 0,
          oportunidadeId: r.oportunidade_id,
        })),
```

- [ ] **Step 3: Reiniciar dev server e validar via SQL**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
```

Validar diretamente via SQL (sem auth):

```bash
PGPASSWORD='dev123' psql -h localhost -U cortex -d cortex_dev -c "
  SELECT o.cnpj, c.nome, o.etapa, o.valor_r_negociacao
  FROM cortex_core.crosssell_oportunidades o
  LEFT JOIN \"Clickup\".cup_clientes c ON c.cnpj = o.cnpj
  WHERE o.etapa NOT IN ('ganho','descartado','sugerido_sistema')
    AND o.valor_r_negociacao IS NOT NULL
    AND o.valor_r_negociacao > 0
  ORDER BY o.valor_r_negociacao DESC NULLS LAST
  LIMIT 5;
"
```

Expected: 0-5 linhas (depende do estado atual do banco local). Sem erro de sintaxe.

- [ ] **Step 4: Commit**

```bash
git add server/routes/crosssell.ts
git commit -m "$(cat <<'EOF'
feat(api): add top 5 clientes em negociação to dashboard payload

Query ordena por valor_r_negociacao DESC, exclui ganho/descartado/sugerido,
filtra valor_r > 0. Retorna cnpj, nome (via join cup_clientes), etapa,
valorR e oportunidade_id para potencial drill-down futuro.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Frontend — atualizar tipos e remover componentes obsoletos

**Files:**
- Modify: `client/src/pages/CrossSellDashboard.tsx`

- [ ] **Step 1: Atualizar interface `DashboardData`**

Localizar (linhas ~75-91):

```ts
interface DashboardData {
  kpis: {
    reunioesAgendadas: number;
    reunioesRealizadas: number;
    totalRNegociacao: number;
    totalPNegociacao: number;
    taxaConversao: number;
    sugestoesAtivas: number;
    taxaAceitacao: number;
    clientesEmNegociacao: number;
    coberturaBase: number;
  };
  funilEtapas: Array<{ etapa: string; total: number }>;
  reunioesPorCx: Array<{ cxResponsavel: string; total: number }>;
  rankingValor: Array<{ cxResponsavel: string; totalR: number; totalP: number; totalDeals: number }>;
  rankingReunioes: Array<{ cxResponsavel: string; totalReunioes: number }>;
}
```

Substituir por:

```ts
interface DashboardData {
  kpis: {
    reunioesAgendadas: number;
    reunioesRealizadas: number;
    totalRNegociacao: number;
    totalPNegociacao: number;
    taxaConversao: number;
    sugestoesAtivas: number;
    taxaAceitacao: number;
    clientesEmNegociacao: number;
    coberturaBase: number;
  };
  kpisAnterior: {
    totalRNegociacao: number;
    totalPNegociacao: number;
    reunioesAgendadas: number;
    taxaConversao: number;
    coberturaBase: number;
  };
  topClientes: Array<{
    cnpj: string;
    clienteNome: string | null;
    etapa: string;
    valorR: number;
    oportunidadeId: number;
  }>;
  funilEtapas: Array<{ etapa: string; total: number }>;
  reunioesPorCx: Array<{ cxResponsavel: string; total: number }>;
  rankingValor: Array<{ cxResponsavel: string; totalR: number; totalP: number; totalDeals: number }>;
  rankingReunioes: Array<{ cxResponsavel: string; totalReunioes: number }>;
}
```

- [ ] **Step 2: Validar typecheck**

```bash
npx tsc --noEmit 2>&1 | grep CrossSellDashboard | head -10
```

Expected: nenhum erro.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/CrossSellDashboard.tsx
git commit -m "$(cat <<'EOF'
feat(crosssell-dashboard): extend DashboardData with kpisAnterior and topClientes

Adds optional fields. Components that consume them are added in subsequent tasks.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Frontend — helper `formatDelta`

**Files:**
- Modify: `client/src/pages/CrossSellDashboard.tsx`

- [ ] **Step 1: Adicionar helper logo após `medal()`**

Localizar (linha ~97):

```ts
function medal(index: number): string {
  if (index === 0) return "\u{1F947} ";
  if (index === 1) return "\u{1F948} ";
  if (index === 2) return "\u{1F949} ";
  return "";
}
```

Logo após o `}` que fecha `medal`, adicionar:

```ts
type DeltaDirection = "up" | "down" | "flat";

interface Delta {
  text: string;
  direction: DeltaDirection;
}

/**
 * Computes a delta string between current and previous values.
 * - "currency" / "count": shows percentage change.
 * - "percent": shows percentage-point difference (pp).
 *
 * Special cases:
 * - prev === 0 && curr > 0 → "novo" (up)
 * - prev === 0 && curr === 0 → "—" (flat)
 */
function formatDelta(
  curr: number,
  prev: number,
  type: "currency" | "count" | "percent",
): Delta {
  if (prev === 0) {
    return curr > 0
      ? { text: "novo", direction: "up" }
      : { text: "—", direction: "flat" };
  }
  const diff = curr - prev;
  const direction: DeltaDirection = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  const arrow = diff > 0 ? "↑" : diff < 0 ? "↓" : "";
  if (type === "percent") {
    const pp = Math.abs(diff).toFixed(1);
    return { text: `${arrow} ${pp}pp vs mês ant.`, direction };
  }
  const pct = Math.abs((diff / prev) * 100).toFixed(0);
  return { text: `${arrow} ${pct}% vs mês ant.`, direction };
}
```

- [ ] **Step 2: Validar typecheck**

```bash
npx tsc --noEmit 2>&1 | grep CrossSellDashboard | head -10
```

Expected: nenhum erro.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/CrossSellDashboard.tsx
git commit -m "$(cat <<'EOF'
feat(crosssell-dashboard): add formatDelta helper

Computes change vs previous period as %. For percent-typed metrics returns
percentage-point (pp) difference. Handles prev=0 edge case (returns "novo" or "—").

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Frontend — componente `HeroKpi`

**Files:**
- Modify: `client/src/pages/CrossSellDashboard.tsx` (adicionar componente após `EmptyState`)

- [ ] **Step 1: Implementar `HeroKpi`**

Localizar o componente `EmptyState` no final do arquivo (linha ~432):

```tsx
function EmptyState() {
  return (
    <div className="flex items-center justify-center h-48 text-gray-400 dark:text-zinc-500 text-sm">
      Sem dados no periodo
    </div>
  );
}
```

Após o `}` que fecha `EmptyState`, adicionar:

```tsx
// ---------------------------------------------------------------------------
// HeroKpi — KPI gigante com gradiente. O número que importa.
// ---------------------------------------------------------------------------

function HeroKpi({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: Delta;
}) {
  return (
    <div className="rounded-2xl p-6 text-white relative overflow-hidden
                    bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-500
                    dark:from-indigo-700 dark:via-purple-700 dark:to-purple-600">
      <div
        className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/15 blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <p className="text-xs font-semibold tracking-widest text-white/85 relative">
        {label}
      </p>
      <p className="text-4xl font-extrabold mt-1.5 leading-tight relative">
        {value}
      </p>
      <span
        className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full
                   bg-white/20 text-white text-xs font-semibold relative"
      >
        {delta.text}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Validar typecheck**

```bash
npx tsc --noEmit 2>&1 | grep CrossSellDashboard | head -10
```

Expected: nenhum erro.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/CrossSellDashboard.tsx
git commit -m "$(cat <<'EOF'
feat(crosssell-dashboard): add HeroKpi component

Gradient indigo→purple with subtle white blob, large value, pill delta badge.
Dark/light variants. Used as the single hero KPI at the top.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Frontend — componente `SecondaryKpiCard`

**Files:**
- Modify: `client/src/pages/CrossSellDashboard.tsx`

- [ ] **Step 1: Implementar `SecondaryKpiCard`**

Após o componente `HeroKpi` (criado em Task 5), adicionar:

```tsx
// ---------------------------------------------------------------------------
// SecondaryKpiCard — card branco/zinc com label, valor e delta colorido.
// ---------------------------------------------------------------------------

function SecondaryKpiCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: Delta;
}) {
  const deltaColor =
    delta.direction === "up"
      ? "text-green-600 dark:text-green-400"
      : delta.direction === "down"
        ? "text-red-600 dark:text-red-400"
        : "text-gray-400 dark:text-zinc-500";

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-4">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
        {value}
      </p>
      <p className={`text-xs font-semibold mt-1 ${deltaColor}`}>
        {delta.text}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Validar typecheck**

```bash
npx tsc --noEmit 2>&1 | grep CrossSellDashboard | head -10
```

Expected: nenhum erro.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/CrossSellDashboard.tsx
git commit -m "$(cat <<'EOF'
feat(crosssell-dashboard): add SecondaryKpiCard component

Compact card with uppercase label, bold value, and color-coded delta
(green up / red down / gray flat). Dark/light variants.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Frontend — componente `ConversionFunnel`

**Files:**
- Modify: `client/src/pages/CrossSellDashboard.tsx`

- [ ] **Step 1: Implementar `ConversionFunnel`**

Após `SecondaryKpiCard`, adicionar:

```tsx
// ---------------------------------------------------------------------------
// ConversionFunnel — funil custom em divs. Mostra cada etapa em ordem,
// barra proporcional ao topo, e taxa de conversão entre etapas consecutivas.
// 'descartado' é omitido (ramo lateral, não conversão).
// ---------------------------------------------------------------------------

const FUNNEL_ORDER = [
  "sugerido_sistema",
  "fazer_contato",
  "tentativa_contato",
  "em_contato",
  "reuniao_agendada",
  "proposta_enviada",
  "forte_interesse",
  "ganho",
] as const;

function ConversionFunnel({
  data,
}: {
  data: Array<{ etapa: string; total: number }>;
}) {
  // Build a lookup and project onto FUNNEL_ORDER (zero for missing)
  const counts: Record<string, number> = {};
  for (const d of data) counts[d.etapa] = Number(d.total);

  const stages = FUNNEL_ORDER.map((etapa) => ({
    etapa,
    label: ETAPA_LABELS[etapa] ?? etapa,
    color: ETAPA_COLORS[etapa] ?? "#6b7280",
    count: counts[etapa] ?? 0,
  }));

  const max = Math.max(...stages.map((s) => s.count), 1);

  if (stages.every((s) => s.count === 0)) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-1.5">
      {stages.map((s, i) => {
        const widthPct = max > 0 ? (s.count / max) * 100 : 0;
        const prev = i > 0 ? stages[i - 1].count : null;
        const conv = prev != null && prev > 0 ? (s.count / prev) * 100 : null;
        return (
          <div
            key={s.etapa}
            className="grid items-center gap-2"
            style={{ gridTemplateColumns: "110px 1fr 50px" }}
          >
            <span className="text-xs text-gray-700 dark:text-zinc-300 font-medium truncate">
              {s.label}
            </span>
            <div className="relative h-7">
              {conv !== null && (
                <span
                  className="absolute -top-3 right-0 text-[9px] text-gray-400 dark:text-zinc-500 px-1
                             bg-white dark:bg-zinc-900"
                >
                  ↓ {conv.toFixed(0)}%
                </span>
              )}
              <div
                className="h-full rounded flex items-center px-2 text-white text-xs font-semibold
                           transition-[width] duration-300"
                style={{ width: `${Math.max(widthPct, 2)}%`, backgroundColor: s.color }}
              >
                {s.count > 0 ? s.count : ""}
              </div>
            </div>
            <span className="text-xs font-semibold text-gray-900 dark:text-white text-right">
              {s.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Validar typecheck**

```bash
npx tsc --noEmit 2>&1 | grep CrossSellDashboard | head -10
```

Expected: nenhum erro.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/CrossSellDashboard.tsx
git commit -m "$(cat <<'EOF'
feat(crosssell-dashboard): add ConversionFunnel component

Custom funnel in divs (no Recharts). Fixed stage order (sugerido → ... → ganho),
omits descartado, computes inter-stage conversion rate. Bar width proportional
to max stage count. Uses ETAPA_COLORS for color consistency.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Frontend — componente `TopClientesList`

**Files:**
- Modify: `client/src/pages/CrossSellDashboard.tsx`

- [ ] **Step 1: Implementar `TopClientesList`**

Após `ConversionFunnel`, adicionar:

```tsx
// ---------------------------------------------------------------------------
// TopClientesList — top 5 clientes em negociação por valor R.
// Cada linha: badge da etapa, nome, valor R. Background com gradient.
// ---------------------------------------------------------------------------

function TopClientesList({
  data,
}: {
  data: Array<{
    cnpj: string;
    clienteNome: string | null;
    etapa: string;
    valorR: number;
    oportunidadeId: number;
  }>;
}) {
  if (!data || data.length === 0) {
    return <EmptyState />;
  }

  const max = Math.max(...data.map((d) => d.valorR), 1);

  return (
    <div className="space-y-1.5">
      {data.map((c) => {
        const widthPct = (c.valorR / max) * 100;
        const etapaLabel = ETAPA_LABELS[c.etapa] ?? c.etapa;
        const etapaColor = ETAPA_COLORS[c.etapa] ?? "#6b7280";
        return (
          <div
            key={c.oportunidadeId}
            className="grid items-center gap-2 px-2.5 py-2 rounded-lg
                       text-sm"
            style={{
              gridTemplateColumns: "auto 1fr auto",
              backgroundImage: `linear-gradient(90deg, rgba(99,102,241,0.08) ${widthPct}%, transparent ${widthPct}%)`,
            }}
          >
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-semibold whitespace-nowrap"
              style={{ backgroundColor: etapaColor }}
            >
              {etapaLabel}
            </span>
            <span className="text-gray-900 dark:text-white font-medium truncate">
              {c.clienteNome ?? c.cnpj}
            </span>
            <span className="text-indigo-600 dark:text-indigo-400 font-bold whitespace-nowrap">
              {formatCurrency(c.valorR)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Validar typecheck**

```bash
npx tsc --noEmit 2>&1 | grep CrossSellDashboard | head -10
```

Expected: nenhum erro.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/CrossSellDashboard.tsx
git commit -m "$(cat <<'EOF'
feat(crosssell-dashboard): add TopClientesList component

5 linhas: badge etapa (cor da etapa), nome cliente, valor R em destaque.
Background gradient proporcional ao valor relativo (à esquerda preenche
mais quanto maior o valor R).

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Frontend — componente `PodiumRanking`

**Files:**
- Modify: `client/src/pages/CrossSellDashboard.tsx`

- [ ] **Step 1: Implementar `PodiumRanking`**

Após `TopClientesList`, adicionar:

```tsx
// ---------------------------------------------------------------------------
// PodiumRanking — top 3 em formato pódio + linhas 4º a 7º em lista compacta.
// Suporta 2 métricas: "valor" (R$) ou "reunioes" (número).
// ---------------------------------------------------------------------------

interface PodiumPerson {
  name: string;
  primaryValue: number;     // valor R em "valor", número de reuniões em "reunioes"
  secondaryDeals?: number;  // só para "valor": número de deals
  secondaryP?: number;      // só para "valor": valor P
}

function PodiumRanking({
  data,
  metric,
}: {
  data: PodiumPerson[];
  metric: "valor" | "reunioes";
}) {
  if (!data || data.length === 0) {
    return <EmptyState />;
  }

  const formatVal = (v: number) =>
    metric === "valor" ? formatCurrency(v) : `${v}`;

  const top3 = data.slice(0, 3);
  const rest = data.slice(3, 7); // 4º a 7º

  // Pódio order: 2nd left, 1st center (bigger), 3rd right
  const podiumDisplayOrder = [top3[1], top3[0], top3[2]].filter(Boolean) as PodiumPerson[];

  return (
    <div>
      <div className="grid gap-2 items-end" style={{ gridTemplateColumns: "1fr 1.2fr 1fr" }}>
        {podiumDisplayOrder.map((p) => {
          // Determine actual rank (top3 index) by lookup
          const rank = top3.indexOf(p) + 1;
          const isFirst = rank === 1;
          const medalEmoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
          return (
            <div
              key={p.name}
              className={`text-center rounded-xl border bg-white dark:bg-zinc-900 ${
                isFirst
                  ? "border-amber-300 shadow-[0_0_0_2px_rgba(251,191,36,0.25)] dark:border-amber-500 py-4"
                  : "border-gray-200 dark:border-zinc-700 py-3"
              } px-2`}
            >
              <div className={isFirst ? "text-3xl leading-none" : "text-xl leading-none"}>
                {medalEmoji}
              </div>
              <div className="text-xs font-semibold text-gray-900 dark:text-white mt-1.5 truncate">
                {p.name || "—"}
              </div>
              <div
                className={`font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 ${
                  isFirst ? "text-base" : "text-sm"
                }`}
              >
                {formatVal(p.primaryValue)}
              </div>
            </div>
          );
        })}
      </div>

      {rest.length > 0 && (
        <div className="mt-3 space-y-0.5">
          {rest.map((p, i) => (
            <div
              key={p.name}
              className="grid items-center gap-2 px-2 py-1 text-xs"
              style={{ gridTemplateColumns: "20px 1fr 80px" }}
            >
              <span className="text-gray-400 dark:text-zinc-500">{i + 4}º</span>
              <span className="text-gray-700 dark:text-zinc-300 truncate">{p.name || "—"}</span>
              <span className="text-right font-semibold text-gray-900 dark:text-white">
                {formatVal(p.primaryValue)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Validar typecheck**

```bash
npx tsc --noEmit 2>&1 | grep CrossSellDashboard | head -10
```

Expected: nenhum erro.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/CrossSellDashboard.tsx
git commit -m "$(cat <<'EOF'
feat(crosssell-dashboard): add PodiumRanking component

Top 3 em pódio (2º left, 1º center bigger with amber border, 3º right).
4º a 7º em lista compacta. Suporta métrica 'valor' (currency) ou
'reunioes' (count) via prop.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Frontend — reescrever o componente principal `CrossSellDashboard`

**Files:**
- Modify: `client/src/pages/CrossSellDashboard.tsx` — substituir o body do componente principal entre o `useQuery` e o início dos sub-componentes (linhas ~123-397).

Esta é a task mais longa: substitui o `return (...)` inteiro.

- [ ] **Step 1: Atualizar imports**

Localizar o bloco de imports do topo. **Remover**:

```ts
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
```

Não usaremos Recharts nesta página (funil é custom, rankings são pódios).

E **remover** os imports de ícones não usados na nova UI:

```ts
import { Calendar, Phone, DollarSign, TrendingUp, BarChart3, Sparkles } from "lucide-react";
```

Substituir por (mantém apenas o que será usado nos titles dos cards):

```ts
import { TrendingUp, DollarSign, Trophy, Calendar } from "lucide-react";
```

- [ ] **Step 2: Substituir o `return (...)` do `CrossSellDashboard`**

Localizar (linha ~136):

```tsx
  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Period filter */}
      <div className="flex items-center gap-3 flex-wrap">
```

Esse `return` se estende até a linha ~397 (`</div>` final + `);` + `}`). **Substituir todo o conteúdo entre `return (` e o `}` final do componente** por:

```tsx
  // KPI deltas
  const deltaR = data
    ? formatDelta(data.kpis.totalRNegociacao, data.kpisAnterior.totalRNegociacao, "currency")
    : { text: "", direction: "flat" as const };
  const deltaP = data
    ? formatDelta(data.kpis.totalPNegociacao, data.kpisAnterior.totalPNegociacao, "currency")
    : { text: "", direction: "flat" as const };
  const deltaReunioes = data
    ? formatDelta(data.kpis.reunioesAgendadas, data.kpisAnterior.reunioesAgendadas, "count")
    : { text: "", direction: "flat" as const };
  const deltaConv = data
    ? formatDelta(data.kpis.taxaConversao, data.kpisAnterior.taxaConversao, "percent")
    : { text: "", direction: "flat" as const };
  // Cobertura: prev é sempre 0 (sem snapshot histórico). Forçamos delta neutro.
  const deltaCobertura: Delta = { text: "—", direction: "flat" };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Period filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-[160px] bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={ano} onValueChange={setAno}>
          <SelectTrigger className="w-[120px] bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Hero + Secondary KPIs */}
      {isLoading ? (
        <>
          <Skeleton className="h-32 rounded-2xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        </>
      ) : (
        <>
          <HeroKpi
            label="PIPELINE EM NEGOCIAÇÃO · RECORRENTE"
            value={formatCurrency(data?.kpis.totalRNegociacao ?? 0)}
            delta={deltaR}
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SecondaryKpiCard
              label="Negociação P"
              value={formatCurrency(data?.kpis.totalPNegociacao ?? 0)}
              delta={deltaP}
            />
            <SecondaryKpiCard
              label="Reuniões Agendadas"
              value={String(data?.kpis.reunioesAgendadas ?? 0)}
              delta={deltaReunioes}
            />
            <SecondaryKpiCard
              label="Taxa Conversão"
              value={`${data?.kpis.taxaConversao ?? 0}%`}
              delta={deltaConv}
            />
            <SecondaryKpiCard
              label="Cobertura da Base"
              value={`${data?.kpis.coberturaBase ?? 0}%`}
              delta={deltaCobertura}
            />
          </div>
        </>
      )}

      {/* Section: Pipeline */}
      <div>
        <h3 className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 dark:text-zinc-400 mb-3 px-1">
          Pipeline
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-500" />
                Funil de Conversão
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full rounded-lg" />
              ) : (
                <ConversionFunnel data={data?.funilEtapas ?? []} />
              )}
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                Top Clientes em Negociação
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48 w-full rounded-lg" />
              ) : (
                <TopClientesList data={data?.topClientes ?? []} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section: Performance da Equipe */}
      <div>
        <h3 className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 dark:text-zinc-400 mb-3 px-1">
          Performance da Equipe
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                Valor Gerado
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48 w-full rounded-lg" />
              ) : (
                <PodiumRanking
                  data={(data?.rankingValor ?? []).map((r) => ({
                    name: r.cxResponsavel,
                    primaryValue: Number(r.totalR),
                    secondaryDeals: Number(r.totalDeals),
                    secondaryP: Number(r.totalP),
                  }))}
                  metric="valor"
                />
              )}
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                Reuniões Agendadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48 w-full rounded-lg" />
              ) : (
                <PodiumRanking
                  data={(data?.rankingReunioes ?? []).map((r) => ({
                    name: r.cxResponsavel,
                    primaryValue: Number(r.totalReunioes),
                  }))}
                  metric="reunioes"
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Remover constantes não usadas**

A constante `CX_COLORS` (linha ~69) não é mais usada (era para o BarChart removido). **Remover** o bloco:

```ts
const CX_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#ef4444", "#10b981", "#ec4899", "#6366f1"];
```

A função `medal()` (linha ~97) também não é mais usada (PodiumRanking usa medalhas inline). **Remover**:

```ts
function medal(index: number): string {
  if (index === 0) return "\u{1F947} ";
  if (index === 1) return "\u{1F948} ";
  if (index === 2) return "\u{1F949} ";
  return "";
}
```

> **Atenção:** se `formatDelta` (Task 4) foi adicionado **logo após** `medal`, garanta que ele permaneça no arquivo após esta remoção (cole-o no lugar de `medal` se necessário).

- [ ] **Step 4: Validar typecheck**

```bash
npx tsc --noEmit 2>&1 | grep CrossSellDashboard | head -20
```

Expected: nenhum erro. Se houver "imported but not used" warnings sobre `BarChart3`, `Phone`, `Sparkles` etc., voltar ao Step 1 e confirmar que apenas os 4 ícones listados estão importados.

- [ ] **Step 5: Reiniciar dev server**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
```

Aguardar ~5s.

- [ ] **Step 6: Teste manual no browser**

Abrir `http://localhost:3000/comercial/crosssell/dashboard` (ou caminho equivalente). Validar:

1. ✅ Hero gradient indigo→purple no topo com valor R + delta.
2. ✅ 4 cards secundários abaixo (Total P, Reuniões, Conversão, Cobertura).
3. ✅ Cobertura mostra `—` (sem comparação histórica).
4. ✅ Heading "Pipeline" + funil + top clientes lado a lado.
5. ✅ Funil com etapas em ordem, sem `descartado`, com % de conversão.
6. ✅ Top clientes ordenado decrescente por R, com badge etapa colorido.
7. ✅ Heading "Performance da Equipe" + 2 pódios (Valor Gerado / Reuniões Agendadas).
8. ✅ 1º lugar central com borda dourada, 2º à esquerda, 3º à direita.
9. ✅ 4º a 7º (se houver) em lista compacta abaixo.
10. ✅ Trocar para mês sem dados → EmptyStates aparecem em cada componente.
11. ✅ Trocar para janeiro → delta compara com dezembro do ano anterior.
12. ✅ Alternar dark mode → todas cores corretas (especialmente hero gradient).

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/CrossSellDashboard.tsx
git commit -m "$(cat <<'EOF'
feat(crosssell-dashboard): rewrite layout with hero KPI + funnel + podiums

- 1 HeroKpi (Total Negociação R) com gradient + delta vs mês anterior
- 4 SecondaryKpiCards (P, Reuniões, Conversão, Cobertura) com delta
- Section "Pipeline": ConversionFunnel + TopClientesList lado a lado
- Section "Performance da Equipe": 2 PodiumRankings (Valor / Reuniões)
- Recharts removido da página (funil é custom em divs)
- Dead code removed: CX_COLORS, medal()

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Push e PR

**Files:** —

- [ ] **Step 1: Push da branch**

```bash
git push -u origin feature/crosssell-dashboard-redesign
```

- [ ] **Step 2: Abrir PR**

```bash
gh pr create --title "feat(crosssell): redesign dashboard com hero KPI, funil e pódios" --body "$(cat <<'EOF'
## Summary

- **1 KPI hero** (Total Negociação R) com gradiente + delta vs mês anterior
- **4 KPIs secundários** (P, Reuniões, Conversão, Cobertura) com delta colorido
- **Funil de Conversão** custom (barras estreitando, % entre etapas, omite descartado)
- **Top 5 Clientes em Negociação** (substitui chart "Reuniões por CX" que duplicava o ranking)
- **Pódios** nos rankings (1º central com borda dourada, 4º+ em lista compacta)
- Backend retorna KPIs do mês anterior + lista top clientes

## Spec & Plan

- Spec: `docs/superpowers/specs/2026-05-08-crosssell-dashboard-redesign-design.md`
- Plan: `docs/superpowers/plans/2026-05-08-crosssell-dashboard-redesign.md`

## Test plan

- [ ] Hero, 4 KPIs e deltas corretos para mês atual e anterior
- [ ] Cobertura mostra `—` (sem snapshot histórico)
- [ ] Funil exibe etapas em ordem, sem descartado, com % de conversão
- [ ] Top clientes ordenado por R desc com badge da etapa
- [ ] Pódios: 1º central com borda dourada, 4º+ em lista
- [ ] Janeiro compara com dezembro do ano anterior (rollover)
- [ ] Mês sem dados → EmptyState em cada seção
- [ ] Light + dark mode renderizam corretamente

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Confirmar URL do PR**

A saída do passo 2 contém a URL — copiar e enviar ao usuário.

---

## Self-Review

**1. Spec coverage:**
- ✅ Backend KPIs do mês anterior → Task 1
- ✅ Backend top 5 clientes → Task 2
- ✅ Cobertura com delta sempre 0 → Task 1 step 5 (documentado no JSON map) e Task 10 (UI mostra `—`)
- ✅ Tipos TypeScript do payload → Task 3
- ✅ Helper `formatDelta` → Task 4
- ✅ `HeroKpi` → Task 5
- ✅ `SecondaryKpiCard` → Task 6
- ✅ `ConversionFunnel` (custom em divs, omite descartado, % conversão) → Task 7
- ✅ `TopClientesList` → Task 8
- ✅ `PodiumRanking` (top 3 + 4º a 7º) → Task 9
- ✅ Layout final + 2 sections + remoção de Recharts/dead code → Task 10
- ✅ Dark/light mode → todas as tasks usam classes `dark:`
- ✅ Plano de testes manuais → Task 10 step 6
- ✅ Branch a partir de main → Task 0

**2. Placeholder scan:** sem TBDs, sem "implement later", sem "similar to Task N" — todo bloco de código exibido literalmente.

**3. Type consistency:**
- `Delta` interface (Task 4) — usada em `HeroKpi` (Task 5), `SecondaryKpiCard` (Task 6), e nas variáveis `deltaR/deltaP/...` em Task 10. Consistente.
- `DashboardData.kpisAnterior` campos (Task 3) batem exatamente com o que o backend retorna (Task 1 step 5).
- `DashboardData.topClientes` campos batem com TopClientesList prop (Task 8) e o backend (Task 2 step 2).
- `PodiumPerson` (Task 9) — `name`, `primaryValue` batem com o map em Task 10 (rankingValor → name=cxResponsavel, primaryValue=totalR; rankingReunioes → primaryValue=totalReunioes).
- `FUNNEL_ORDER` constante (Task 7) — etapas batem com `ETAPA_LABELS` e `ETAPA_COLORS` já definidas no topo do arquivo (linhas 30-50).
