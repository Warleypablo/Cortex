# Slide Vendas YTD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar slide "Vendas YTD" no Reporte Mensal na posição 5 (entre "Faturamento YTD" e "KRs"), mostrando Vendas MRR, Pontual e Total acumulados no ano com gráfico mensal stacked.

**Architecture:** Zero mudanças no backend — os dados já existem em `data.contratosMes.vendasSeries` (tipo `VendasMes[]`). O componente calcula os totais YTD no frontend via reduce. O slide é registrado em `RelatorioMensal.tsx` na posição 5, deslocando KRs e demais +1.

**Tech Stack:** TypeScript, React, Recharts (BarChart stackado), Tailwind CSS

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `client/src/pages/relatorio-mensal/SlideVendasYtd.tsx` | Create | Componente do slide |
| `client/src/pages/RelatorioMensal.tsx` | Modify | Import + "Vendas YTD" no index 5 + reindexar renderFixedSlide |

---

## Task 1: Criar o componente `SlideVendasYtd.tsx`

**Files:**
- Create: `client/src/pages/relatorio-mensal/SlideVendasYtd.tsx`

Antes de criar, leia estes arquivos de referência para entender o padrão visual:
- `client/src/pages/relatorio-mensal/SlideLayout.tsx` — seções disponíveis (use `section="comercial"`)
- `client/src/pages/relatorio-mensal/SlideComponents.tsx` — SecondaryCard, ChartCard, SlideHeader
- `client/src/pages/relatorio-mensal/types.ts` — interface `VendasMes` e `ContratosMes`

- [ ] **Criar o arquivo com o componente completo**

```tsx
import { ShoppingBag, TrendingUp, Zap } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { VendasMes } from "./types";
import SlideLayout from "./SlideLayout";
import { SlideHeader, SecondaryCard, ChartCard } from "./SlideComponents";

interface Props {
  vendasSeries: VendasMes[];
  mesLabel: string;
}

function fmtBRL(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(3).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1).replace(".", ",")}k`;
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

function fmtK(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
  return `${Math.round(v)}`;
}

function fmtBarLabel(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000).toFixed(0)}k`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
  return `${Math.round(v)}`;
}

function makeBarLabel(data: VendasMes[], dataKey: keyof VendasMes) {
  return ({ x, y, width, height, index }: any) => {
    if (index == null || height < 16) return null;
    const val = (data[index]?.[dataKey] as number) || 0;
    if (val <= 0) return null;
    return (
      <text x={x + width / 2} y={y + height / 2} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
        {fmtBarLabel(val)}
      </text>
    );
  };
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const mrr = payload.find((p: any) => p.dataKey === "vendasMrr")?.value || 0;
  const pont = payload.find((p: any) => p.dataKey === "vendasPontual")?.value || 0;
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

export default function SlideVendasYtd({ vendasSeries, mesLabel }: Props) {
  const vendasMrrYtd     = vendasSeries.reduce((s, m) => s + m.vendasMrr, 0);
  const vendasPontualYtd = vendasSeries.reduce((s, m) => s + m.vendasPontual, 0);
  const vendasTotalYtd   = vendasMrrYtd + vendasPontualYtd;
  const contratosYtd     = vendasSeries.reduce((s, m) => s + m.numContratos, 0);
  const contratosMrr     = vendasSeries.filter(m => m.vendasMrr > 0).length;
  const contratosPont    = vendasSeries.filter(m => m.vendasPontual > 0).length;

  const mesAtual = mesLabel.split(" ")[0];

  return (
    <SlideLayout section="comercial" padding="24px 32px">
      <SlideHeader
        icon={ShoppingBag}
        iconColor="text-amber-400"
        title={`Vendas YTD — ${mesLabel}`}
        gradientColor="#f59e0b"
      />

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3 mb-3 shrink-0">
        <SecondaryCard className="p-4 flex flex-col justify-center gap-1">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Vendas MRR YTD</p>
          </div>
          <p className="text-2xl font-black text-emerald-400">{fmtBRL(vendasMrrYtd)}</p>
          <p className="text-[10px] text-zinc-600">
            {contratosMrr > 0 ? `${contratosMrr} meses com vendas — Jan → ${mesAtual}` : `Jan → ${mesAtual}`}
          </p>
        </SecondaryCard>

        <SecondaryCard className="p-4 flex flex-col justify-center gap-1">
          <div className="flex items-center gap-1.5 mb-1">
            <Zap className="h-3.5 w-3.5 text-purple-400" />
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Vendas Pontual YTD</p>
          </div>
          <p className="text-2xl font-black text-purple-400">{fmtBRL(vendasPontualYtd)}</p>
          <p className="text-[10px] text-zinc-600">
            {contratosPont > 0 ? `${contratosPont} meses com vendas — Jan → ${mesAtual}` : `Jan → ${mesAtual}`}
          </p>
        </SecondaryCard>

        <SecondaryCard className="p-4 flex flex-col justify-center gap-1" borderColor="#f59e0b">
          <div className="flex items-center gap-1.5 mb-1">
            <ShoppingBag className="h-3.5 w-3.5 text-amber-400" />
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Total Vendas YTD</p>
          </div>
          <p className="text-2xl font-black text-amber-400">{fmtBRL(vendasTotalYtd)}</p>
          <p className="text-[10px] text-zinc-600">{contratosYtd} contrato{contratosYtd !== 1 ? "s" : ""} fechado{contratosYtd !== 1 ? "s" : ""}</p>
        </SecondaryCard>
      </div>

      {/* Chart */}
      <ChartCard className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-zinc-300">Vendas por Mês — Jan → {mesAtual}</p>
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
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={vendasSeries} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                axisLine={{ stroke: "#3f3f46" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#a1a1aa", fontSize: 10 }}
                axisLine={{ stroke: "#3f3f46" }}
                tickLine={false}
                tickFormatter={fmtK}
                width={50}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="vendasMrr" name="MRR" stackId="vendas" radius={[0, 0, 0, 0]} barSize={36} fill="#34d399" fillOpacity={0.8} label={makeBarLabel(vendasSeries, "vendasMrr")} />
              <Bar dataKey="vendasPontual" name="Pontual" stackId="vendas" radius={[4, 4, 0, 0]} barSize={36} fill="#a855f7" fillOpacity={0.7} label={makeBarLabel(vendasSeries, "vendasPontual")} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </SlideLayout>
  );
}
```

- [ ] **Commit**

```bash
cd /Users/mac0267/Cortex && git add client/src/pages/relatorio-mensal/SlideVendasYtd.tsx && git commit -m "feat(relatorio-mensal): componente SlideVendasYtd

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Registrar o slide em `RelatorioMensal.tsx`

**Files:**
- Modify: `client/src/pages/RelatorioMensal.tsx`

Estado atual do arquivo (já modificado pelo slide Faturamento YTD):
- Linha 15: `import SlideFaturamentoYtd from "./relatorio-mensal/SlideFaturamentoYtd";`
- Linha 33–42: `FIXED_SLIDE_NAMES` com 20 elementos (índices 0–19)
- Linha 44: `const STATIC_SLIDES = FIXED_SLIDE_NAMES.length; // 20`
- Linha 249–274: `renderFixedSlide` com cases 0–19

- [ ] **Adicionar o import após `SlideFaturamentoYtd`**

Adicionar logo após a linha `import SlideFaturamentoYtd from "./relatorio-mensal/SlideFaturamentoYtd";`:

```typescript
import SlideVendasYtd from "./relatorio-mensal/SlideVendasYtd";
```

- [ ] **Inserir "Vendas YTD" em `FIXED_SLIDE_NAMES` na posição 5**

Substituir:
```typescript
const FIXED_SLIDE_NAMES = [
  "Capa", "Q&A", "Novos & Aniversários", "Aniv. Empresa",
  "Faturamento YTD",
  "KRs", "Capa Comercial", "Ranking Closers",
  "Ranking SDRs", "Contratos", "Capa Commerce", "Squad Details", "Ranking Squads", "Turbo Commerce",
  "Pontual",
  "Capa Tech", "Area Tech",
  "Tópicos",
  "Frase", "Q&A"
];
```

Por:
```typescript
const FIXED_SLIDE_NAMES = [
  "Capa", "Q&A", "Novos & Aniversários", "Aniv. Empresa",
  "Faturamento YTD", "Vendas YTD",
  "KRs", "Capa Comercial", "Ranking Closers",
  "Ranking SDRs", "Contratos", "Capa Commerce", "Squad Details", "Ranking Squads", "Turbo Commerce",
  "Pontual",
  "Capa Tech", "Area Tech",
  "Tópicos",
  "Frase", "Q&A"
];
```

- [ ] **Atualizar `STATIC_SLIDES` comentário**

Substituir:
```typescript
const STATIC_SLIDES = FIXED_SLIDE_NAMES.length; // 20
```
Por:
```typescript
const STATIC_SLIDES = FIXED_SLIDE_NAMES.length; // 21
```

- [ ] **Substituir a função `renderFixedSlide` inteira**

Substituir todo o bloco `const renderFixedSlide = (fixedIndex: number) => { ... }` por:

```typescript
  const renderFixedSlide = (fixedIndex: number) => {
    if (!data) return null;
    switch (fixedIndex) {
      case 0:  return <SlideCapa mesLabel={data.mesLabel} />;
      case 1:  return <SlideQRCode />;
      case 2:  return <SlideNovosAniversariantes novos={data.novosColaboradores} aniversariantes={data.aniversariantes} mesLabel={data.mesLabel} />;
      case 3:  return <SlideAniversarioEmpresa aniversarios={data.aniversariosEmpresa} />;
      case 4:  return <SlideFaturamentoYtd data={data.faturamentoYtd} mesLabel={data.mesDadosLabel} />;
      case 5:  return <SlideVendasYtd vendasSeries={data.contratosMes.vendasSeries} mesLabel={data.mesDadosLabel} />;
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
      case 16: return <SlideCapaTech />;
      case 17: return <SlideAreaTech techData={data.techData} mesLabel={data.mesDadosLabel} />;
      case 18: return <SlideTopicosDiscussao />;
      case 19: return <SlideFraseEncerramento />;
      case 20: return <SlideQRCode />;
      default: return null;
    }
  };
```

- [ ] **Commit**

```bash
cd /Users/mac0267/Cortex && git add client/src/pages/RelatorioMensal.tsx && git commit -m "feat(relatorio-mensal): registrar SlideVendasYtd na posição 5

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Verificar TypeScript e reiniciar servidor

- [ ] **Checar erros TypeScript relacionados ao novo slide**

```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | grep -i "SlideVendas\|vendasSeries\|VendasYtd"
```

Esperado: sem output (zero erros relacionados).

- [ ] **Reiniciar o dev server**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
sleep 8 && curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
```

Esperado: `200`

- [ ] **Confirmar que o slide aparece na posição correta**

Abrir `http://localhost:3000/reports/mensal`. O slide "Vendas YTD" deve aparecer entre "Faturamento YTD" (dot 5) e "KRs" (dot 7) nos dots de navegação.
