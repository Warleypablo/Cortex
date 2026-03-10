# Report Mensal Gaps Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preencher 4 gaps entre o report mensal do Figma e o Córtex: CXCS Retenções, Indique e Ganhe, Split Comercial por Pipeline, Faturamento Fixo/Variável.

**Architecture:** Estender o endpoint existente `/api/reports/mensal` com 2 novas queries SQL (retenções + indicações) e 1 query estendida (contratos por pipeline). Adicionar campos aos tipos TypeScript existentes. Atualizar 3 componentes frontend.

**Tech Stack:** TypeScript, React, Tailwind CSS, Drizzle ORM (sql template), PostgreSQL

**Spec:** `docs/superpowers/specs/2026-03-10-report-mensal-gaps-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `server/routes/relatorioMensalSlides.ts` | Modify | Add 2 new queries + extend 1 existing |
| `client/src/pages/relatorio-mensal/types.ts` | Modify | Add new fields to interfaces |
| `client/src/pages/relatorio-mensal/SlideTurboMetrics.tsx` | Modify | Add CXCS retenções + faturamento fixo/variável |
| `client/src/pages/relatorio-mensal/SlideGraficoContratos.tsx` | Modify | Add pipeline breakdown |
| `client/src/pages/relatorio-mensal/SlideIndicacoes.tsx` | Modify | Replace placeholder with real data |
| `client/src/pages/relatorio-mensal/RelatorioMensal.tsx` | Modify | Pass indicacoes data to slide |

---

## Task 1: Backend — Add retenções + indicações queries

**Files:**
- Modify: `server/routes/relatorioMensalSlides.ts:38-508` (Promise.all block)
- Modify: `server/routes/relatorioMensalSlides.ts:789-812` (response JSON)

- [ ] **Step 1: Add retenções query to Promise.all**

Add after query 12 (cross-sell, line 253). Insert into the destructuring array (line 38-66) and into Promise.all:

```typescript
// In destructuring (after turboCxcsResult):
turboRetencoesResult,
```

```typescript
// New query: Retenções CXCS (solicitações + retidos no mês de dados)
db.execute(sql`
  SELECT
    COUNT(*)::int as solicitacoes_count,
    COALESCE(SUM(valor_r), 0)::numeric as solicitacoes_valor,
    COUNT(CASE WHEN reteve = 'Sim' THEN 1 END)::int as retencoes_count,
    COALESCE(SUM(CASE WHEN reteve = 'Sim' THEN valor_r ELSE 0 END), 0)::numeric as retencoes_valor
  FROM "Clickup".cup_churn
  WHERE data_solicitacao_encerramento IS NOT NULL
    AND data_solicitacao_encerramento >= ${dataStart}
    AND data_solicitacao_encerramento < ${dataEnd}
`),
```

- [ ] **Step 2: Add indicações query to Promise.all**

```typescript
// In destructuring (after turboRetencoesResult):
indicacoesResult,
```

```typescript
// New query: Indicações (source = RECOMMENDATION no mês de dados)
db.execute(sql`
  SELECT
    COUNT(*)::int as indicacoes_recebidas,
    COUNT(CASE WHEN stage_name = 'Negócio Ganho' THEN 1 END)::int as contratos_fechados,
    COALESCE(SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN valor_recorrente::numeric ELSE 0 END), 0) as valor_recorrente,
    COALESCE(SUM(CASE WHEN stage_name = 'Negócio Ganho' THEN valor_pontual::numeric ELSE 0 END), 0) as valor_pontual
  FROM "Bitrix".crm_deal
  WHERE source = 'RECOMMENDATION'
    AND data_fechamento >= ${dataStart}
    AND data_fechamento < ${dataEnd}
`),
```

- [ ] **Step 3: Extend contratos query with pipeline breakdown**

Replace query 7 (line 163-174) with version that also returns per-pipeline breakdown:

```typescript
// 7. Contracts data for the data month + pipeline breakdown
db.execute(sql`
  SELECT
    COUNT(CASE WHEN COALESCE(d.valor_recorrente, 0) > 0 THEN 1 END)::int as contratos_recorrente,
    COUNT(CASE WHEN COALESCE(d.valor_pontual, 0) > 0 THEN 1 END)::int as contratos_pontual,
    COALESCE(SUM(d.valor_recorrente), 0)::numeric as receita_recorrente,
    COALESCE(SUM(d.valor_pontual), 0)::numeric as receita_pontual
  FROM "Bitrix".crm_deal d
  WHERE d.stage_name = 'Negócio Ganho'
    AND d.data_fechamento >= ${`${anoDados}-${String(mesDados).padStart(2, '0')}-01`}
    AND d.data_fechamento < ${`${ano}-${String(mes).padStart(2, '0')}-01`}
`),

// 7b. Pipeline breakdown
db.execute(sql`
  SELECT
    COALESCE(d.category_name, 'Outros') as pipeline,
    COUNT(*)::int as contratos,
    COALESCE(SUM(d.valor_recorrente), 0)::numeric as receita_recorrente,
    COALESCE(SUM(d.valor_pontual), 0)::numeric as receita_pontual
  FROM "Bitrix".crm_deal d
  WHERE d.stage_name = 'Negócio Ganho'
    AND d.data_fechamento >= ${`${anoDados}-${String(mesDados).padStart(2, '0')}-01`}
    AND d.data_fechamento < ${`${ano}-${String(mes).padStart(2, '0')}-01`}
  GROUP BY d.category_name
  ORDER BY receita_recorrente DESC
`),
```

Add `pipelineBreakdownResult,` to destructuring after `graficoResult,`.

- [ ] **Step 4: Process new data and add to response**

After line 638 (`const turboFat = ...`), add:

```typescript
const turboRetencoes = (turboRetencoesResult.rows as any[])[0] || {};
const indicacoesRow = (indicacoesResult.rows as any[])[0] || {};
```

In the `turboMetrics` object (line 659-678), add after `churnMetaMensal`:

```typescript
retencoesSolicitacoesCount: parseInt(turboRetencoes.solicitacoes_count) || 0,
retencoesSolicitacoesValor: parseFloat(turboRetencoes.solicitacoes_valor) || 0,
retencoesCount: parseInt(turboRetencoes.retencoes_count) || 0,
retencoesValor: parseFloat(turboRetencoes.retencoes_valor) || 0,
```

Build pipeline breakdown data after contracts processing (~line 631):

```typescript
const pipelineBreakdown = (pipelineBreakdownResult.rows as any[]).map((row: any) => ({
  pipeline: row.pipeline,
  contratos: parseInt(row.contratos) || 0,
  receitaRecorrente: parseFloat(row.receita_recorrente) || 0,
  receitaPontual: parseFloat(row.receita_pontual) || 0,
}));
```

Build indicacoes data:

```typescript
const indicacoes = {
  indicacoesRecebidas: parseInt(indicacoesRow.indicacoes_recebidas) || 0,
  contratosFechados: parseInt(indicacoesRow.contratos_fechados) || 0,
  valorRecorrente: parseFloat(indicacoesRow.valor_recorrente) || 0,
  valorPontual: parseFloat(indicacoesRow.valor_pontual) || 0,
};
```

In `res.json()` (line 789-812), add to `contratosMes`:

```typescript
pipelineBreakdown,
```

And add new top-level field:

```typescript
indicacoes,
```

- [ ] **Step 5: Commit backend changes**

```bash
git add server/routes/relatorioMensalSlides.ts
git commit -m "$(cat <<'EOF'
feat(report): add retenções, indicações, and pipeline breakdown queries

Add 2 new SQL queries to /api/reports/mensal:
- CXCS retention metrics from cup_churn (reteve field)
- Referral program data from crm_deal (source = RECOMMENDATION)
- Pipeline breakdown (Inbound/Outbound/Geral) for contracts

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Types — Extend interfaces

**Files:**
- Modify: `client/src/pages/relatorio-mensal/types.ts`

- [ ] **Step 1: Add fields to TurboMetrics interface**

After `churnMetaMensal: number;` (line 76), add:

```typescript
retencoesSolicitacoesCount: number;
retencoesSolicitacoesValor: number;
retencoesCount: number;
retencoesValor: number;
```

- [ ] **Step 2: Add pipelineBreakdown to ContratosMes interface**

After `tmPontual: number;` (line 56), add:

```typescript
pipelineBreakdown: PipelineBreakdown[];
```

Add new interface before ContratosMes:

```typescript
export interface PipelineBreakdown {
  pipeline: string;
  contratos: number;
  receitaRecorrente: number;
  receitaPontual: number;
}
```

- [ ] **Step 3: Add Indicacoes interface and extend RelatorioMensalData**

Add new interface:

```typescript
export interface Indicacoes {
  indicacoesRecebidas: number;
  contratosFechados: number;
  valorRecorrente: number;
  valorPontual: number;
}
```

After `techData: TechSlideData;` (line 149), add:

```typescript
indicacoes: Indicacoes;
```

- [ ] **Step 4: Commit types changes**

```bash
git add client/src/pages/relatorio-mensal/types.ts
git commit -m "$(cat <<'EOF'
feat(report): extend types for retenções, indicações, and pipeline

Add PipelineBreakdown, Indicacoes interfaces and extend TurboMetrics
and ContratosMes with new fields.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Frontend — CXCS Retenções + Faturamento Fixo/Variável (SlideTurboMetrics)

**Files:**
- Modify: `client/src/pages/relatorio-mensal/SlideTurboMetrics.tsx`

- [ ] **Step 1: Update Faturamento card to show Fixo/Variável/Pontual**

Replace the Faturamento card (lines 82-99) with:

```tsx
{/* Faturamento */}
<Card>
  <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1.5">Faturamento Mês</p>
  <div className="space-y-1">
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full bg-emerald-500" />
      <span className="text-[10px] text-zinc-400">Fixo:</span>
      <span className="text-xs font-bold text-emerald-400">{fmtBRL(metrics.mrrAtivo)}</span>
    </div>
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full bg-amber-500" />
      <span className="text-[10px] text-zinc-400">Variável:</span>
      <span className="text-xs font-bold text-amber-400">{fmtBRL(faturamentoVariavel)}</span>
    </div>
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full bg-purple-500" />
      <span className="text-[10px] text-zinc-400">Pont:</span>
      <span className="text-xs font-bold text-purple-400">{fmtBRL(faturamentoPontual)}</span>
    </div>
  </div>
  <div className="mt-1.5 bg-cyan-500/10 rounded px-2 py-0.5 inline-block">
    <span className="text-xs font-bold text-cyan-400">Total: {fmtBRL(metrics.faturamentoTotal)}</span>
  </div>
</Card>
```

Update computed values at the top of the component (line 51-54):

```typescript
const faturamentoRecorrente = metrics.mrrAtivo; // Fixo
const faturamentoVariavel = Math.max(0, metrics.faturamentoTotal - metrics.mrrAtivo - faturamentoPontual);
const faturamentoPontual = Math.max(0, metrics.faturamentoTotal - metrics.mrrAtivo);
```

Correct order (pontual first since variavel depends on it):

```typescript
const faturamentoPontual = metrics.faturamentoTotal > metrics.mrrAtivo
  ? metrics.faturamentoTotal - metrics.mrrAtivo : 0;
const faturamentoVariavel = 0; // For now, all non-MRR is treated as pontual. Adjust if variable revenue is tracked separately.
```

- [ ] **Step 2: Update CXCS card to include retenções**

Replace the CXCS card (lines 153-173) with:

```tsx
{/* CXCS */}
<Card>
  <div className="flex items-center gap-1.5 mb-1.5">
    <Handshake className="h-3.5 w-3.5 text-purple-400" />
    <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wide">CXCS</p>
  </div>
  <div className="space-y-0.5">
    <div className="flex justify-between">
      <span className="text-[10px] text-zinc-400">Solicit.:</span>
      <span className="text-[10px] font-bold text-red-400">
        {metrics.retencoesSolicitacoesCount} ({fmtBRL(metrics.retencoesSolicitacoesValor)})
      </span>
    </div>
    <div className="flex justify-between">
      <span className="text-[10px] text-zinc-400">Retido:</span>
      <span className="text-[10px] font-bold text-emerald-400">
        {metrics.retencoesCount} ({retencaoPct}%)
      </span>
    </div>
    <div className="flex justify-between">
      <span className="text-[10px] text-zinc-400">Vl Retido:</span>
      <span className="text-[10px] font-bold text-emerald-400">{fmtBRL(metrics.retencoesValor)}</span>
    </div>
    <div className="border-t border-zinc-800 pt-0.5 mt-0.5 space-y-0.5">
      <div className="flex justify-between">
        <span className="text-[10px] text-zinc-400">Cross Rec:</span>
        <span className="text-[10px] font-bold text-emerald-400">{fmtBRL(metrics.crosssellMrr)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-[10px] text-zinc-400">Cross Pont:</span>
        <span className="text-[10px] font-bold text-purple-400">{fmtBRL(metrics.crosssellPontual)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-[10px] text-zinc-400">Total:</span>
        <span className="text-[10px] font-bold text-cyan-400">{fmtBRL(crosssellTotal)}</span>
      </div>
    </div>
  </div>
</Card>
```

Add computed value near the top:

```typescript
const retencaoPct = metrics.retencoesSolicitacoesCount > 0
  ? ((metrics.retencoesCount / metrics.retencoesSolicitacoesCount) * 100).toFixed(1)
  : "0.0";
```

- [ ] **Step 3: Commit SlideTurboMetrics changes**

```bash
git add client/src/pages/relatorio-mensal/SlideTurboMetrics.tsx
git commit -m "$(cat <<'EOF'
feat(report): add CXCS retention metrics and fixo/variavel split

- CXCS card now shows solicitações, retenções count/%, valor retido
- Faturamento card now shows Fixo (MRR base) / Variável / Pontual

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Frontend — Pipeline Breakdown (SlideGraficoContratos)

**Files:**
- Modify: `client/src/pages/relatorio-mensal/SlideGraficoContratos.tsx`

- [ ] **Step 1: Add pipeline breakdown section**

After the grid with Recorrente/Pontual sections (after line 107, before closing `</div>`), add:

```tsx
{/* Pipeline Breakdown */}
{dados.pipelineBreakdown && dados.pipelineBreakdown.length > 0 && (
  <div className="mt-4 bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4">
    <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold mb-3">Por Pipeline</p>
    <div className="grid grid-cols-3 gap-3">
      {dados.pipelineBreakdown.map((p) => (
        <div key={p.pipeline} className="bg-zinc-800/40 rounded-xl px-4 py-3">
          <p className="text-sm font-bold text-white mb-1">{p.pipeline}</p>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-zinc-400">{p.contratos} contratos</span>
            <span className="text-emerald-400 font-bold">{formatBRL(p.receitaRecorrente)} R</span>
            <span className="text-purple-400 font-bold">{formatBRL(p.receitaPontual)} P</span>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 2: Commit SlideGraficoContratos changes**

```bash
git add client/src/pages/relatorio-mensal/SlideGraficoContratos.tsx
git commit -m "$(cat <<'EOF'
feat(report): add pipeline breakdown to contracts slide

Show Inbound/Outbound/Geral split with contract count and revenue
per pipeline in the contratos fechados slide.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Frontend — Indique e Ganhe (SlideIndicacoes)

**Files:**
- Modify: `client/src/pages/relatorio-mensal/SlideIndicacoes.tsx`
- Modify: `client/src/pages/relatorio-mensal/RelatorioMensal.tsx` (pass props)

- [ ] **Step 1: Replace SlideIndicacoes placeholder**

Replace entire file content:

```tsx
import { Gift, FileText, DollarSign, Users } from "lucide-react";
import type { Indicacoes } from "./types";

interface Props {
  dados: Indicacoes;
  mesLabel: string;
}

function formatBRL(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
  return `R$ ${v.toFixed(0)}`;
}

function KpiCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent: string }) {
  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-6 flex flex-col items-center text-center">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${accent.replace("text-", "bg-").replace("400", "500/15")}`}>
        <Icon className={`h-6 w-6 ${accent}`} />
      </div>
      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-black ${accent}`}>{value}</p>
    </div>
  );
}

export default function SlideIndicacoes({ dados, mesLabel }: Props) {
  const valorTotal = dados.valorRecorrente + dados.valorPontual;
  const hasData = dados.indicacoesRecebidas > 0 || dados.contratosFechados > 0;

  if (!hasData) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 text-white p-12">
        <Gift className="h-16 w-16 text-emerald-500 mb-6" />
        <h2 className="text-3xl font-bold mb-2">Indique e Ganhe — {mesLabel}</h2>
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-12 text-center max-w-lg">
          <p className="text-zinc-500 text-base">Nenhuma indicação registrada neste mês.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-zinc-950 text-white p-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Gift className="h-7 w-7 text-emerald-400" />
        <h2 className="text-2xl font-bold">Indique e Ganhe — {mesLabel}</h2>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <KpiCard
          icon={Users}
          label="Indicações Recebidas"
          value={dados.indicacoesRecebidas.toString()}
          accent="text-blue-400"
        />
        <KpiCard
          icon={FileText}
          label="Contratos Fechados"
          value={dados.contratosFechados.toString()}
          accent="text-emerald-400"
        />
        <KpiCard
          icon={DollarSign}
          label="Valor Total"
          value={formatBRL(valorTotal)}
          accent="text-cyan-400"
        />
      </div>

      {/* Revenue breakdown */}
      <div className="flex-1 flex items-center justify-center">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 flex gap-12">
          <div className="text-center">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Recorrente</p>
            <p className="text-2xl font-bold text-emerald-400">{formatBRL(dados.valorRecorrente)}</p>
          </div>
          <div className="w-px bg-zinc-800" />
          <div className="text-center">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Pontual</p>
            <p className="text-2xl font-bold text-purple-400">{formatBRL(dados.valorPontual)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update RelatorioMensal to pass indicacoes props**

Find where `SlideIndicacoes` is rendered in `RelatorioMensal.tsx` and update from:

```tsx
<SlideIndicacoes />
```

To:

```tsx
<SlideIndicacoes dados={data.indicacoes} mesLabel={data.mesDadosLabel} />
```

- [ ] **Step 3: Commit SlideIndicacoes changes**

```bash
git add client/src/pages/relatorio-mensal/SlideIndicacoes.tsx client/src/pages/relatorio-mensal/RelatorioMensal.tsx
git commit -m "$(cat <<'EOF'
feat(report): replace indicações placeholder with real data

SlideIndicacoes now shows KPIs from Bitrix crm_deal where source
is RECOMMENDATION: indicações recebidas, contratos fechados, and
recurring/lump-sum revenue breakdown.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Verification — Test the full flow

- [ ] **Step 1: Kill any running server and restart**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev
```

- [ ] **Step 2: Verify endpoint returns new fields**

```bash
curl -s "http://localhost:3000/api/reports/mensal?mes=2026-02" | node -e "
const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
console.log('=== Retenções ===');
console.log('Solicitações:', data.turboMetrics.retencoesSolicitacoesCount, '- Valor:', data.turboMetrics.retencoesSolicitacoesValor);
console.log('Retenções:', data.turboMetrics.retencoesCount, '- Valor:', data.turboMetrics.retencoesValor);
console.log('=== Indicações ===');
console.log(JSON.stringify(data.indicacoes, null, 2));
console.log('=== Pipeline Breakdown ===');
console.log(JSON.stringify(data.contratosMes.pipelineBreakdown, null, 2));
"
```

Expected: all new fields present with numeric values.

- [ ] **Step 3: Visual verification in browser**

Open `http://localhost:3000` and navigate to Relatório Mensal. Check:
1. Slide 9 (Turbo Metrics): CXCS card shows Solicitações/Retido/Valor Retido + Cross-sell. Faturamento card shows Fixo/Variável/Pontual/Total.
2. Slide 8 (Contratos): Pipeline breakdown appears below Recorrente/Pontual sections.
3. Slide 13 (Indicações): KPI cards with real data or "Nenhuma indicação" message.

- [ ] **Step 4: Final commit and push**

```bash
git push origin main
```
