# Slide Vendas CX & Upsell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar slide "Vendas CX & Upsell" ao Reporte Mensal (posição 6) mostrando vendas PARTNER do mês com ranking de closers, e remover o card cross-sell do SlideTurboMetrics.

**Architecture:** Novo query 12b agrupa `crm_deal` PARTNER por closer (JOIN crm_closers). `TurboMetrics` recebe dois novos campos (`crosssellContratos`, `crosssellPorCloser[]`). Novo componente `SlideVendasCxUpsell.tsx` usa `turboMetrics`. `SlideTurboMetrics.tsx` perde o sub-card cross-sell. `RelatorioMensal.tsx` insere o slide no índice 6 e reindexar cases 6→22 para 7→23.

**Tech Stack:** React, TypeScript, Recharts (BarChart com layout="vertical" para barras horizontais), Tailwind CSS, SlideLayout/SlideHeader/SecondaryCard/ChartCard.

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `server/routes/relatorioMensalSlides.ts` | modify | Query 12b (closer breakdown PARTNER) + expor crosssellContratos |
| `client/src/pages/relatorio-mensal/types.ts` | modify | Interface CrosssellCloser + campos TurboMetrics |
| `client/src/pages/relatorio-mensal/SlideVendasCxUpsell.tsx` | create | Novo slide: 3 KPI cards + BarChart horizontal por closer |
| `client/src/pages/relatorio-mensal/SlideTurboMetrics.tsx` | modify | Remover sub-card Cross-sell (linhas 195-212) |
| `client/src/pages/RelatorioMensal.tsx` | modify | Inserir índice 6, reindexar 6→22 para 7→23, STATIC_SLIDES=24 |

---

## Task 1: Backend — query 12b + crosssellContratos

**Files:**
- Modify: `server/routes/relatorioMensalSlides.ts`

Contexto: O query 12 já existe e retorna `crosssell_mrr`, `crosssell_pontual`, `solicitacoes` (count). O campo `solicitacoes` não está sendo exposto em `TurboMetrics`. O novo query 12b vai logo após o query 12 no array do `Promise.all`. Para descobrir a posição exata no `Promise.all`, procurar pelo comentário `// 12. Cross-sell` e inserir após o bloco `db.execute(sql`...`)`.

O padrão de JOIN com closers é: `JOIN "Bitrix".crm_closers c ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id` (usado no query 5 do mesmo arquivo).

- [ ] **Step 1: Localizar query 12 e inserir query 12b após ela**

Encontrar no arquivo a seção do query 12 (buscar `// 12. Cross-sell`). Logo após o `)`+ vírgula do `db.execute` do query 12, inserir:

```typescript
        // 12b. Cross-sell por closer (source PARTNER, mês de dados)
        db.execute(sql`
          SELECT
            COALESCE(c.nome, 'Sem Responsável') as nome,
            COALESCE(SUM(d.valor_recorrente), 0)::numeric as mrr,
            COALESCE(SUM(d.valor_pontual), 0)::numeric as pontual,
            COUNT(*)::int as contratos
          FROM "Bitrix".crm_deal d
          LEFT JOIN "Bitrix".crm_closers c
            ON CASE WHEN d.closer ~ '^[0-9]+$' THEN d.closer::integer ELSE NULL END = c.id
          WHERE d.stage_name = 'Negócio Ganho'
            AND d.source = 'PARTNER'
            AND d.data_fechamento >= ${dataStart}
            AND d.data_fechamento < ${dataEnd}
          GROUP BY COALESCE(c.nome, 'Sem Responsável')
          ORDER BY (COALESCE(SUM(d.valor_recorrente), 0) + COALESCE(SUM(d.valor_pontual), 0)) DESC
        `),
```

- [ ] **Step 2: Adicionar a variável de desestruturação para o novo resultado**

Localizar o bloco de desestruturação do `Promise.all` onde estão `pontualCommerceQtrResult`, `pontualEmAbertoResult`, etc. O query 12b precisa de uma variável. Encontrar `crosssellResult` (ou o nome da variável do query 12) e adicionar `crosssellPorCloserResult` na posição correspondente.

Exemplo de como o array de resultados é desestruturado (o padrão usa index posicional ou desestruturação nomeada — verificar qual padrão o arquivo usa e seguir). Se for desestruturação posicional com nomes, adicionar após o resultado do query 12:

```typescript
crosssellPorCloserResult,
```

- [ ] **Step 3: Expor crosssellContratos e crosssellPorCloser no objeto turboMetrics**

Localizar no arquivo o bloco que monta `turboMetrics`. Encontrar:
```typescript
crosssellMrr: parseFloat(turboCxcs.crosssell_mrr) || 0,
crosssellPontual: parseFloat(turboCxcs.crosssell_pontual) || 0,
```

Adicionar após essas duas linhas:
```typescript
crosssellContratos: parseInt(turboCxcs.solicitacoes) || 0,
crosssellPorCloser: (crosssellPorCloserResult.rows as any[]).map((row: any) => ({
  nome: row.nome,
  mrr: parseFloat(row.mrr) || 0,
  pontual: parseFloat(row.pontual) || 0,
  contratos: parseInt(row.contratos) || 0,
})),
```

- [ ] **Step 4: Verificar que o servidor compila sem erros**

```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | grep "relatorioMensalSlides" | head -10
```
Expected: sem erros no arquivo. (Outros erros pré-existentes podem aparecer — ignorar.)

- [ ] **Step 5: Commit**

```bash
git add server/routes/relatorioMensalSlides.ts
git commit -m "feat(relatorio): query crossell por closer + expor crosssellContratos

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Tipos TypeScript

**Files:**
- Modify: `client/src/pages/relatorio-mensal/types.ts`

Contexto: `TurboMetrics` fica em `client/src/pages/relatorio-mensal/types.ts`. Atualmente tem `crosssellMrr` e `crosssellPontual` mas não `crosssellContratos` nem `crosssellPorCloser`.

- [ ] **Step 1: Adicionar interface CrosssellCloser antes de TurboMetrics**

Localizar no arquivo a linha `export interface TurboMetrics {`. Inserir antes dela:

```typescript
export interface CrosssellCloser {
  nome: string;
  mrr: number;
  pontual: number;
  contratos: number;
}

```

- [ ] **Step 2: Adicionar campos em TurboMetrics**

Localizar no arquivo:
```typescript
  crosssellMrr: number;
  crosssellPontual: number;
```

Substituir por:
```typescript
  crosssellMrr: number;
  crosssellPontual: number;
  crosssellContratos: number;
  crosssellPorCloser: CrosssellCloser[];
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | grep "types.ts" | head -10
```
Expected: sem erros em types.ts.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/relatorio-mensal/types.ts
git commit -m "feat(relatorio): tipos CrosssellCloser e campos TurboMetrics

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: SlideVendasCxUpsell.tsx

**Files:**
- Create: `client/src/pages/relatorio-mensal/SlideVendasCxUpsell.tsx`

Contexto: Slide para o Reporte Mensal mostrando vendas PARTNER (cross-sell + upsell) do mês. Usa `turboMetrics: TurboMetrics` como prop. O BarChart usa `layout="vertical"` do Recharts — isso inverte os eixos: `YAxis` recebe `dataKey="nome"` (strings), `XAxis` recebe valores numéricos.

- [ ] **Step 1: Criar o arquivo**

```tsx
import { Handshake } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TurboMetrics } from "./types";
import SlideLayout from "./SlideLayout";
import { SlideHeader, SecondaryCard, ChartCard } from "./SlideComponents";

interface Props {
  metrics: TurboMetrics;
  mesLabel: string;
}

function fmtBRL(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

function fmtK(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
  return `${Math.round(v)}`;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const mrr = payload.find((p: any) => p.dataKey === "mrr")?.value || 0;
  const pont = payload.find((p: any) => p.dataKey === "pontual")?.value || 0;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs min-w-[160px]">
      <p className="font-bold text-white mb-1.5">{label}</p>
      <div className="space-y-0.5">
        <div className="flex justify-between gap-3">
          <span className="text-emerald-400">MRR:</span>
          <span className="font-bold text-emerald-400">{fmtBRL(mrr)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-purple-400">Pontual:</span>
          <span className="font-bold text-purple-400">{fmtBRL(pont)}</span>
        </div>
        <div className="flex justify-between gap-3 border-t border-zinc-700 pt-1 mt-1">
          <span className="text-amber-400">Total:</span>
          <span className="font-bold text-amber-400">{fmtBRL(mrr + pont)}</span>
        </div>
      </div>
    </div>
  );
}

export default function SlideVendasCxUpsell({ metrics, mesLabel }: Props) {
  const { crosssellMrr, crosssellPontual, crosssellContratos, crosssellPorCloser } = metrics;
  const crosssellTotal = crosssellMrr + crosssellPontual;

  // Preparar dados para BarChart horizontal (layout="vertical")
  // Recharts com layout="vertical": YAxis usa dataKey (strings), XAxis usa valores
  const chartData = crosssellPorCloser.map(c => ({
    nome: c.nome,
    mrr: c.mrr,
    pontual: c.pontual,
  }));

  return (
    <SlideLayout section="comercial" padding="24px 32px">
      <SlideHeader
        icon={Handshake}
        iconColor="text-amber-400"
        title={`Vendas CX & Upsell — ${mesLabel}`}
        gradientColor="#f59e0b"
      />

      <div className="grid grid-cols-3 gap-3 mb-3 shrink-0">
        <SecondaryCard className="p-4 flex flex-col justify-center gap-1">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">MRR CX / Upsell</p>
          <p className="text-2xl font-black text-emerald-400">{fmtBRL(crosssellMrr)}</p>
          <p className="text-[10px] text-zinc-600">
            {crosssellContratos} contrato{crosssellContratos !== 1 ? "s" : ""} no mês
          </p>
        </SecondaryCard>

        <SecondaryCard className="p-4 flex flex-col justify-center gap-1">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Pontual CX / Upsell</p>
          <p className="text-2xl font-black text-purple-400">{fmtBRL(crosssellPontual)}</p>
          <p className="text-[10px] text-zinc-600">{mesLabel}</p>
        </SecondaryCard>

        <SecondaryCard className="p-4 flex flex-col justify-center gap-1" borderColor="#f59e0b">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Total CX / Upsell</p>
          <p className="text-2xl font-black text-amber-400">{fmtBRL(crosssellTotal)}</p>
          <p className="text-[10px] text-zinc-600">{mesLabel}</p>
        </SecondaryCard>
      </div>

      <ChartCard className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-zinc-300">Ranking Closers — CX & Upsell</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
              <span className="text-xs text-zinc-500">MRR</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
              <span className="text-xs text-zinc-500">Pontual</span>
            </div>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
              Sem vendas CX/Upsell no mês
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={chartData}
                margin={{ top: 4, right: 60, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                <YAxis
                  type="category"
                  dataKey="nome"
                  tick={{ fill: "#a1a1aa", fontSize: 11 }}
                  axisLine={{ stroke: "#3f3f46" }}
                  tickLine={false}
                  width={120}
                />
                <XAxis
                  type="number"
                  tick={{ fill: "#a1a1aa", fontSize: 10 }}
                  axisLine={{ stroke: "#3f3f46" }}
                  tickLine={false}
                  tickFormatter={fmtK}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="mrr" name="MRR" stackId="cx" fill="#34d399" fillOpacity={0.85} />
                <Bar dataKey="pontual" name="Pontual" stackId="cx" fill="#a855f7" fillOpacity={0.8} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </ChartCard>
    </SlideLayout>
  );
}
```

- [ ] **Step 2: Verificar que o arquivo foi criado**

```bash
ls client/src/pages/relatorio-mensal/SlideVendasCxUpsell.tsx
```
Expected: arquivo listado.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/relatorio-mensal/SlideVendasCxUpsell.tsx
git commit -m "feat(relatorio): slide Vendas CX & Upsell com ranking de closers

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Remover card cross-sell do SlideTurboMetrics

**Files:**
- Modify: `client/src/pages/relatorio-mensal/SlideTurboMetrics.tsx`

Contexto: O arquivo tem um SecondaryCard (linhas ~171-213) que contém: (a) Adicionado/Cancelados/Pausados MRR e (b) sub-seção Cross-sell separada por `border-t`. Remover apenas a parte (b): o `<div className="border-t ...">` e tudo dentro dele até o `</div>` de fechamento (aprox. linhas 195-212). Manter a parte (a) intacta.

Também remover `const crosssellTotal = ...` (linha 88) e o import `Handshake` se não for mais usado em outro lugar.

- [ ] **Step 1: Remover o sub-card Cross-sell**

Localizar e remover exatamente este bloco (linhas ~195-212):
```tsx
          <div className="border-t border-white/[0.06] pt-1.5 mt-1.5 space-y-0.5">
            <div className="flex items-center gap-1 mb-0.5">
              <Handshake className="h-3 w-3 text-purple-400" />
              <span className="text-xs text-purple-400 font-bold">Cross-sell</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-zinc-400">Rec:</span>
              <span className="text-sm font-bold text-emerald-400">{fmtBRL(metrics.crosssellMrr)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-zinc-400">Pont:</span>
              <span className="text-sm font-bold text-purple-400">{fmtBRL(metrics.crosssellPontual)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-zinc-400">Total:</span>
              <span className="text-sm font-bold text-cyan-400">{fmtBRL(crosssellTotal)}</span>
            </div>
          </div>
```

- [ ] **Step 2: Remover a variável crosssellTotal e o import Handshake**

Remover a linha:
```tsx
  const crosssellTotal = metrics.crosssellMrr + metrics.crosssellPontual;
```

Verificar se `Handshake` ainda é usado em outro lugar no arquivo. Se não for, remover do import:
```tsx
import { Activity, Users, TrendingUp, TrendingDown, Pause, CreditCard, Target, Handshake } from "lucide-react";
```
→ retirar apenas `Handshake` da lista.

- [ ] **Step 3: Verificar TypeScript**

```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | grep "SlideTurboMetrics" | head -10
```
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/relatorio-mensal/SlideTurboMetrics.tsx
git commit -m "refactor(relatorio): remover card cross-sell do SlideTurboMetrics

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Registrar slide em RelatorioMensal.tsx

**Files:**
- Modify: `client/src/pages/RelatorioMensal.tsx`

Contexto: Estado atual (23 slides, cases 0-22). O novo slide entra na posição 6. Os slides nas posições 6-22 se tornam 7-23. STATIC_SLIDES vai de 23 para 24.

**Mapeamento completo dos cases após a mudança:**
- case 0-5: inalterados (Capa, Q&A, Novos, Aniv.Empresa, FaturamentoYtd, VendasYtd)
- case 6: **SlideVendasCxUpsell** (NOVO)
- case 7: SlideKRs (era 6)
- case 8: SlideCapaComercial (era 7)
- case 9: SlideRankingClosers (era 8)
- case 10: SlideRankingSDRs (era 9)
- case 11: SlideGraficoContratos (era 10)
- case 12: SlideCapaCommerce (era 11)
- case 13: SlideSquadDetails (era 12)
- case 14: SlideRankingSquads (era 13)
- case 15: SlideTurboMetrics (era 14)
- case 16: SlidePontual (era 15)
- case 17: SlideEntregasPontuaisCommerce (era 16)
- case 18: SlideCapaTech (era 17)
- case 19: SlideAreaTech (era 18)
- case 20: SlideEntregasPontuaisTech (era 19)
- case 21: SlideTopicosDiscussao (era 20)
- case 22: SlideFraseEncerramento (era 21)
- case 23: SlideQRCode (era 22)

- [ ] **Step 1: Adicionar import**

Localizar:
```tsx
import SlideVendasYtd from "./relatorio-mensal/SlideVendasYtd";
```

Adicionar após:
```tsx
import SlideVendasCxUpsell from "./relatorio-mensal/SlideVendasCxUpsell";
```

- [ ] **Step 2: Atualizar FIXED_SLIDE_NAMES**

Localizar:
```tsx
  "Faturamento YTD", "Vendas YTD",
  "KRs", "Capa Comercial",
```

Substituir por:
```tsx
  "Faturamento YTD", "Vendas YTD", "Vendas CX & Upsell",
  "KRs", "Capa Comercial",
```

Atualizar comentário:
```tsx
const STATIC_SLIDES = FIXED_SLIDE_NAMES.length; // 24
```

- [ ] **Step 3: Atualizar renderFixedSlide — inserir case 6 e reindexar 6-22 para 7-23**

Localizar no switch:
```tsx
      case 6:  return <SlideKRs objectives={data.okrObjectives} />;
      case 7:  return <SlideCapaComercial />;
      case 8:  return <SlideRankingClosers ranking={data.rankingClosers} topPontual={data.topPontual} />;
      case 9:  return <SlideRankingSDRs ranking={data.rankingSDRs} topReunioes={data.topReunioes} />;
      case 10: return <SlideGraficoContratos dados={data.contratosMes} mesLabel={data.mesDadosLabel} />;
      case 11: return <SlideCapaCommerce />;
      case 12: return <SlideSquadDetails details={data.squadDetails} mesLabel={data.mesDadosLabel} />;
      case 13: return <SlideRankingSquads ranking={data.rankingSquads} />;
      case 14: return <SlideTurboMetrics metrics={data.turboMetrics} mesLabel={data.mesDadosLabel} />;
      case 15: return <SlidePontual pontualData={data.pontualData} mesLabel={data.mesDadosLabel} />;
      case 16: return <SlideEntregasPontuaisCommerce pontualData={data.pontualData} mesLabel={data.mesDadosLabel} />;
      case 17: return <SlideCapaTech />;
      case 18: return <SlideAreaTech techData={data.techData} mesLabel={data.mesDadosLabel} />;
      case 19: return <SlideEntregasPontuaisTech techData={data.techData} mesLabel={data.mesDadosLabel} />;
      case 20: return <SlideTopicosDiscussao />;
      case 21: return <SlideFraseEncerramento />;
      case 22: return <SlideQRCode />;
```

Substituir por:
```tsx
      case 6:  return <SlideVendasCxUpsell metrics={data.turboMetrics} mesLabel={data.mesDadosLabel} />;
      case 7:  return <SlideKRs objectives={data.okrObjectives} />;
      case 8:  return <SlideCapaComercial />;
      case 9:  return <SlideRankingClosers ranking={data.rankingClosers} topPontual={data.topPontual} />;
      case 10: return <SlideRankingSDRs ranking={data.rankingSDRs} topReunioes={data.topReunioes} />;
      case 11: return <SlideGraficoContratos dados={data.contratosMes} mesLabel={data.mesDadosLabel} />;
      case 12: return <SlideCapaCommerce />;
      case 13: return <SlideSquadDetails details={data.squadDetails} mesLabel={data.mesDadosLabel} />;
      case 14: return <SlideRankingSquads ranking={data.rankingSquads} />;
      case 15: return <SlideTurboMetrics metrics={data.turboMetrics} mesLabel={data.mesDadosLabel} />;
      case 16: return <SlidePontual pontualData={data.pontualData} mesLabel={data.mesDadosLabel} />;
      case 17: return <SlideEntregasPontuaisCommerce pontualData={data.pontualData} mesLabel={data.mesDadosLabel} />;
      case 18: return <SlideCapaTech />;
      case 19: return <SlideAreaTech techData={data.techData} mesLabel={data.mesDadosLabel} />;
      case 20: return <SlideEntregasPontuaisTech techData={data.techData} mesLabel={data.mesDadosLabel} />;
      case 21: return <SlideTopicosDiscussao />;
      case 22: return <SlideFraseEncerramento />;
      case 23: return <SlideQRCode />;
```

- [ ] **Step 4: Verificar TypeScript**

```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | grep -E "SlideVendasCx|RelatorioMensal.tsx" | grep -v node_modules | head -10
```
Expected: sem erros nos arquivos tocados.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/RelatorioMensal.tsx
git commit -m "feat(relatorio): registrar slide Vendas CX & Upsell na posição 6

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Teste visual no browser

**Files:** nenhum alterado

- [ ] **Step 1: Reiniciar servidor**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; sleep 1
npm run dev &
sleep 5
```

- [ ] **Step 2: Verificar que o servidor subiu**

```bash
curl -s http://localhost:3000/ | head -3
```
Expected: `<!DOCTYPE html>`

- [ ] **Step 3: Verificar slide CX & Upsell (índice 6)**

Abrir `http://localhost:3000` → Reporte Mensal → selecionar mês → avançar até slide 7 (posição 6). Verificar:
- Header "Vendas CX & Upsell — {mês}"
- 3 cards: MRR (emerald), Pontual (purple), Total (amber, borda)
- BarChart horizontal com closers (ou mensagem "Sem vendas CX/Upsell" se nenhum dado)

- [ ] **Step 4: Verificar slide Turbo Commerce (índice 15)**

Avançar até slide 16 (posição 15). Confirmar que o card Cross-sell foi removido — card "Adicionado/Cancelados/Pausados" deve permanecer, mas sem o sub-bloco border-t de Cross-sell.

- [ ] **Step 5: Verificar navegação dos slides seguintes**

Confirmar que slides 16-23 renderizam sem crash.
