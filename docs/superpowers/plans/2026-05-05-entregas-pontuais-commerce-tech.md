# Entregas Pontuais Commerce + Tech Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar dois slides ao Reporte Mensal — "Entregas Pontuais Commerce" (índice 16) e "Entregas Pontuais Tech" (índice 19) — exibindo o acumulado YTD de entregas pontuais por vertical, sem nenhuma nova query no backend.

**Architecture:** Dois novos componentes React reutilizam dados já presentes em `RelatorioMensalData` (`pontualData` para Commerce, `techData` para Tech). A lógica YTD é calculada inteiramente no frontend filtrando os arrays de séries mensais. `RelatorioMensal.tsx` recebe dois novos nomes no `FIXED_SLIDE_NAMES` e dois novos cases no `renderFixedSlide`, com os cases existentes 16-20 deslocados para 17-22.

**Tech Stack:** React, TypeScript, Recharts (BarChart stacked), Tailwind CSS, SlideLayout/SlideHeader/SecondaryCard/ChartCard do projeto.

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `client/src/pages/relatorio-mensal/SlideEntregasPontuaisCommerce.tsx` | **create** | Slide YTD Commerce: 4 KPI cards + BarChart stacked por produto × mês |
| `client/src/pages/relatorio-mensal/SlideEntregasPontuaisTech.tsx` | **create** | Slide YTD Tech: 3 KPI cards + BarChart stacked receita por tipo × mês |
| `client/src/pages/RelatorioMensal.tsx` | **modify** | Inserir 2 entradas em FIXED_SLIDE_NAMES, reindexar cases, STATIC_SLIDES = 23 |

---

## Task 1: SlideEntregasPontuaisCommerce.tsx

**Files:**
- Create: `client/src/pages/relatorio-mensal/SlideEntregasPontuaisCommerce.tsx`

Contexto: `pontualData.entregasPorProdutoMes` contém entregas por produto × mês para **todo o ano** (query usa `EXTRACT(YEAR FROM data_entrega) = anoDados`). `entregasMes.porSquad` e `entregasMes.total` são do mês atual. Não existe contagem YTD de contratos, então os cards mostram: Total YTD, Entregue no Mês, Ticket Médio do Mês, Top Produto YTD.

- [ ] **Step 1: Criar o arquivo**

```tsx
import { Package } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { PontualData } from "./types";
import SlideLayout from "./SlideLayout";
import { SlideHeader, SecondaryCard, ChartCard } from "./SlideComponents";

interface Props {
  pontualData: PontualData;
  mesLabel: string;
}

const MESES_ALL = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_PT_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const PRODUTO_COLORS = [
  "#a855f7", // purple
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ec4899", // pink
  "#64748b", // slate (Outros)
];

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
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs min-w-[160px]">
      <p className="font-bold text-white mb-1.5">{label}</p>
      <div className="space-y-0.5">
        {payload.map((p: any) => (
          p.value > 0 && (
            <div key={p.dataKey} className="flex justify-between gap-3">
              <span style={{ color: p.fill }}>{p.name}:</span>
              <span style={{ color: p.fill }} className="font-bold">{fmtBRL(p.value)}</span>
            </div>
          )
        ))}
        <div className="flex justify-between gap-3 border-t border-zinc-700 pt-1 mt-1">
          <span className="text-zinc-400">Total:</span>
          <span className="font-bold text-white">{fmtBRL(row.total)}</span>
        </div>
      </div>
    </div>
  );
}

export default function SlideEntregasPontuaisCommerce({ pontualData, mesLabel }: Props) {
  const { entregasPorProdutoMes, entregasMes } = pontualData;

  const mesLabelParts = mesLabel.split(" ");
  const reportYear = parseInt(mesLabelParts[mesLabelParts.length - 1] || "0");
  const reportMesNome = mesLabelParts[0] || "";
  const reportMesIdx = MESES_PT_FULL.findIndex(m => m.toLowerCase() === reportMesNome.toLowerCase());
  const mesAtual = MESES_ALL[reportMesIdx] || mesLabel;

  // Filtrar Jan → mês selecionado
  const ytdMeses = entregasPorProdutoMes.filter(m => {
    const parts = m.month.split("-").map(Number);
    return parts[0] === reportYear && parts[1] <= (reportMesIdx + 1);
  });

  // Total YTD
  const totalYtd = ytdMeses.reduce((s, m) => s + m.total, 0);

  // Top 5 produtos YTD + Outros
  const produtoTotais = new Map<string, number>();
  for (const mes of ytdMeses) {
    for (const [prod, val] of Object.entries(mes.produtos)) {
      produtoTotais.set(prod, (produtoTotais.get(prod) || 0) + val);
    }
  }
  const sorted = Array.from(produtoTotais.entries()).sort((a, b) => b[1] - a[1]);
  const topProdutos = sorted.slice(0, 5).map(([p]) => p);
  const topProdutosSet = new Set(topProdutos);
  const topProdutoNome = sorted[0]?.[0] ?? "—";
  const topProdutoValor = sorted[0]?.[1] ?? 0;

  // Contratos e ticket médio do mês atual
  const contratosMonth = entregasMes.porSquad.reduce((s, sq) => s + sq.contratos, 0);
  const ticketMedio = contratosMonth > 0 ? entregasMes.total / contratosMonth : 0;

  // Chart data
  const chartData = MESES_ALL.slice(0, reportMesIdx + 1).map((lbl, i) => {
    const monthKey = `${reportYear}-${String(i + 1).padStart(2, "0")}`;
    const found = entregasPorProdutoMes.find(m => m.month === monthKey);
    const row: any = { label: lbl, total: 0 };
    for (const p of topProdutos) row[p] = 0;
    row["Outros"] = 0;
    if (found) {
      for (const [prod, val] of Object.entries(found.produtos)) {
        if (topProdutosSet.has(prod)) {
          row[prod] = val;
        } else {
          row["Outros"] += val;
        }
        row.total += val;
      }
    }
    return row;
  });

  return (
    <SlideLayout section="commerce" padding="24px 32px">
      <SlideHeader
        icon={Package}
        iconColor="text-purple-400"
        title={`Entregas Pontuais Commerce — ${mesLabel}`}
        gradientColor="#a855f7"
      />

      <div className="grid grid-cols-4 gap-3 mb-3 shrink-0">
        <SecondaryCard className="p-4 flex flex-col justify-center gap-1" borderColor="#a855f7">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Total Entregue YTD</p>
          <p className="text-2xl font-black text-purple-400">{fmtBRL(totalYtd)}</p>
          <p className="text-[10px] text-zinc-600">Jan → {mesAtual}</p>
        </SecondaryCard>

        <SecondaryCard className="p-4 flex flex-col justify-center gap-1">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Entregue no Mês</p>
          <p className="text-2xl font-black text-cyan-400">{fmtBRL(entregasMes.total)}</p>
          <p className="text-[10px] text-zinc-600">{mesAtual}</p>
        </SecondaryCard>

        <SecondaryCard className="p-4 flex flex-col justify-center gap-1">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Ticket Médio</p>
          <p className="text-2xl font-black text-emerald-400">{fmtBRL(ticketMedio)}</p>
          <p className="text-[10px] text-zinc-600">{contratosMonth} contrato{contratosMonth !== 1 ? "s" : ""} no mês</p>
        </SecondaryCard>

        <SecondaryCard className="p-4 flex flex-col justify-center gap-1">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Top Produto YTD</p>
          <p className="text-sm font-black text-amber-400 truncate" title={topProdutoNome}>{topProdutoNome}</p>
          <p className="text-[10px] text-zinc-600">{fmtBRL(topProdutoValor)}</p>
        </SecondaryCard>
      </div>

      <ChartCard className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-zinc-300">Entregas por Produto × Mês — Jan → {mesAtual}</p>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {[...topProdutos, "Outros"].map((prod, idx) => (
              <div key={prod} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: PRODUTO_COLORS[idx] }} />
                <span className="text-[9px] text-zinc-500">{prod}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}>
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
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              {topProdutos.map((prod, idx) => (
                <Bar
                  key={prod}
                  dataKey={prod}
                  name={prod}
                  stackId="a"
                  barSize={28}
                  fill={PRODUTO_COLORS[idx]}
                  fillOpacity={0.85}
                />
              ))}
              <Bar
                dataKey="Outros"
                name="Outros"
                stackId="a"
                barSize={28}
                fill={PRODUTO_COLORS[5]}
                fillOpacity={0.7}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </SlideLayout>
  );
}
```

- [ ] **Step 2: Verificar que o arquivo foi criado corretamente**

```bash
ls client/src/pages/relatorio-mensal/SlideEntregasPontuaisCommerce.tsx
```
Expected: arquivo listado sem erro.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/relatorio-mensal/SlideEntregasPontuaisCommerce.tsx
git commit -m "feat(relatorio): slide Entregas Pontuais Commerce YTD

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: SlideEntregasPontuaisTech.tsx

**Files:**
- Create: `client/src/pages/relatorio-mensal/SlideEntregasPontuaisTech.tsx`

Contexto: `techData.entregasPorTipo` e `techData.receitaPorTipo` cobrem os últimos 12 meses. Cada entrada tem `{ month: "YYYY-MM", label: "Jan", [tipo]: number }`. `techData.kpis.tempoMedio` é o tempo médio do mês atual (string, ex: "14 dias"). As cores por tipo já estão definidas em `SlideAreaTech.tsx` — replicar o objeto `TIPO_COLORS` aqui.

- [ ] **Step 1: Criar o arquivo**

```tsx
import { Code2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { TechSlideData } from "./types";
import SlideLayout from "./SlideLayout";
import { SlideHeader, SecondaryCard, ChartCard } from "./SlideComponents";

interface Props {
  techData: TechSlideData;
  mesLabel: string;
}

const MESES_PT_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MESES_ALL = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const TIPO_COLORS: Record<string, string> = {
  "LP Shopify": "#f97316",
  "Landing Page": "#ec4899",
  "E-Commerce Standard": "#22c55e",
  "Ecommerce": "#22c55e",
  "Site": "#3b82f6",
  "CRO": "#eab308",
  "Sustentacao": "#8b5cf6",
  "Alteracao": "#6366f1",
  "Integracao": "#71717a",
  "Outros": "#71717a",
};

function getColor(tipo: string): string {
  return TIPO_COLORS[tipo] || "#71717a";
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
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs min-w-[160px]">
      <p className="font-bold text-white mb-1.5">{label}</p>
      <div className="space-y-0.5">
        {payload.map((p: any) => (
          p.value > 0 && (
            <div key={p.dataKey} className="flex justify-between gap-3">
              <span style={{ color: p.fill }}>{p.name}:</span>
              <span style={{ color: p.fill }} className="font-bold">{fmtBRL(p.value)}</span>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

export default function SlideEntregasPontuaisTech({ techData, mesLabel }: Props) {
  const { kpis, entregasPorTipo, receitaPorTipo } = techData;

  const mesLabelParts = mesLabel.split(" ");
  const reportYear = parseInt(mesLabelParts[mesLabelParts.length - 1] || "0");
  const reportMesNome = mesLabelParts[0] || "";
  const reportMesIdx = MESES_PT_FULL.findIndex(m => m.toLowerCase() === reportMesNome.toLowerCase());
  const mesAtual = MESES_ALL[reportMesIdx] || mesLabel;

  // Extrair lista de tipos das chaves (excluindo month e label)
  const tiposList = entregasPorTipo.length > 0
    ? Object.keys(entregasPorTipo[0]).filter(k => k !== "month" && k !== "label")
    : [];

  // Filtrar Jan → mês selecionado do ano
  const ytdEntregas = entregasPorTipo.filter(m => {
    const parts = m.month.split("-").map(Number);
    return parts[0] === reportYear && parts[1] <= (reportMesIdx + 1);
  });
  const ytdReceita = receitaPorTipo.filter(m => {
    const parts = m.month.split("-").map(Number);
    return parts[0] === reportYear && parts[1] <= (reportMesIdx + 1);
  });

  // YTD totais
  const projetosYtd = ytdEntregas.reduce((s, m) =>
    s + tiposList.reduce((t, tipo) => t + ((m[tipo] as number) || 0), 0), 0);
  const receitaYtd = ytdReceita.reduce((s, m) =>
    s + tiposList.reduce((t, tipo) => t + ((m[tipo] as number) || 0), 0), 0);

  // Chart data: Jan → mês selecionado
  const chartData = MESES_ALL.slice(0, reportMesIdx + 1).map((lbl, i) => {
    const monthKey = `${reportYear}-${String(i + 1).padStart(2, "0")}`;
    const found = ytdReceita.find(m => m.month === monthKey);
    const row: any = { label: lbl };
    for (const tipo of tiposList) row[tipo] = found ? ((found[tipo] as number) || 0) : 0;
    return row;
  });

  return (
    <SlideLayout section="tech" padding="24px 32px">
      <SlideHeader
        icon={Code2}
        iconColor="text-blue-400"
        title={`Entregas Pontuais Tech — ${mesLabel}`}
        gradientColor="#3b82f6"
      />

      <div className="grid grid-cols-3 gap-3 mb-3 shrink-0">
        <SecondaryCard className="p-4 flex flex-col justify-center gap-1" borderColor="#3b82f6">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Projetos Entregues YTD</p>
          <p className="text-2xl font-black text-blue-400">{projetosYtd}</p>
          <p className="text-[10px] text-zinc-600">Jan → {mesAtual}</p>
        </SecondaryCard>

        <SecondaryCard className="p-4 flex flex-col justify-center gap-1">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Receita YTD</p>
          <p className="text-2xl font-black text-emerald-400">{fmtBRL(receitaYtd)}</p>
          <p className="text-[10px] text-zinc-600">Jan → {mesAtual}</p>
        </SecondaryCard>

        <SecondaryCard className="p-4 flex flex-col justify-center gap-1">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Tempo Médio / Projeto</p>
          <p className="text-2xl font-black text-cyan-400">{kpis.tempoMedio}</p>
          <p className="text-[10px] text-zinc-600">{mesAtual}</p>
        </SecondaryCard>
      </div>

      <ChartCard className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-zinc-300">Receita por Tipo × Mês — Jan → {mesAtual}</p>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {tiposList.map(tipo => (
              <div key={tipo} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getColor(tipo) }} />
                <span className="text-[9px] text-zinc-500">{tipo}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}>
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
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              {tiposList.map((tipo, i) => (
                <Bar
                  key={tipo}
                  dataKey={tipo}
                  name={tipo}
                  stackId="a"
                  barSize={32}
                  fill={getColor(tipo)}
                  fillOpacity={0.85}
                  radius={i === tiposList.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </SlideLayout>
  );
}
```

- [ ] **Step 2: Verificar que o arquivo foi criado**

```bash
ls client/src/pages/relatorio-mensal/SlideEntregasPontuaisTech.tsx
```
Expected: arquivo listado sem erro.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/relatorio-mensal/SlideEntregasPontuaisTech.tsx
git commit -m "feat(relatorio): slide Entregas Pontuais Tech YTD

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Registrar slides em RelatorioMensal.tsx

**Files:**
- Modify: `client/src/pages/RelatorioMensal.tsx`

Contexto: O arquivo fica em `client/src/pages/RelatorioMensal.tsx`. As seções a modificar são:
1. Bloco de imports (linhas ~11-31)
2. `FIXED_SLIDE_NAMES` array (linha ~34)
3. `const STATIC_SLIDES = FIXED_SLIDE_NAMES.length; // 21` (linha ~45)
4. `renderFixedSlide` switch (linhas ~250-274)

- [ ] **Step 1: Adicionar os dois imports após `import SlidePontual`**

Localizar no arquivo a linha:
```ts
import SlidePontual from "./relatorio-mensal/SlidePontual";
```

Substituir por:
```ts
import SlidePontual from "./relatorio-mensal/SlidePontual";
import SlideEntregasPontuaisCommerce from "./relatorio-mensal/SlideEntregasPontuaisCommerce";
import SlideEntregasPontuaisTech from "./relatorio-mensal/SlideEntregasPontuaisTech";
```

- [ ] **Step 2: Atualizar FIXED_SLIDE_NAMES**

Localizar:
```ts
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
const STATIC_SLIDES = FIXED_SLIDE_NAMES.length; // 21
```

Substituir por:
```ts
const FIXED_SLIDE_NAMES = [
  "Capa", "Q&A", "Novos & Aniversários", "Aniv. Empresa",
  "Faturamento YTD", "Vendas YTD",
  "KRs", "Capa Comercial", "Ranking Closers",
  "Ranking SDRs", "Contratos", "Capa Commerce", "Squad Details", "Ranking Squads", "Turbo Commerce",
  "Pontual", "Entregas Pontuais Commerce",
  "Capa Tech", "Area Tech", "Entregas Pontuais Tech",
  "Tópicos",
  "Frase", "Q&A"
];
const STATIC_SLIDES = FIXED_SLIDE_NAMES.length; // 23
```

- [ ] **Step 3: Atualizar renderFixedSlide**

Localizar o bloco switch existente (cases 15-20):
```ts
      case 15: return <SlidePontual pontualData={data.pontualData} mesLabel={data.mesDadosLabel} />;
      case 16: return <SlideCapaTech />;
      case 17: return <SlideAreaTech techData={data.techData} mesLabel={data.mesDadosLabel} />;
      case 18: return <SlideTopicosDiscussao />;
      case 19: return <SlideFraseEncerramento />;
      case 20: return <SlideQRCode />;
```

Substituir por:
```ts
      case 15: return <SlidePontual pontualData={data.pontualData} mesLabel={data.mesDadosLabel} />;
      case 16: return <SlideEntregasPontuaisCommerce pontualData={data.pontualData} mesLabel={data.mesDadosLabel} />;
      case 17: return <SlideCapaTech />;
      case 18: return <SlideAreaTech techData={data.techData} mesLabel={data.mesDadosLabel} />;
      case 19: return <SlideEntregasPontuaisTech techData={data.techData} mesLabel={data.mesDadosLabel} />;
      case 20: return <SlideTopicosDiscussao />;
      case 21: return <SlideFraseEncerramento />;
      case 22: return <SlideQRCode />;
```

- [ ] **Step 4: Verificar TypeScript sem erros**

```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | grep -E "SlideEntregas|relatorio-mensal" | head -20
```
Expected: sem linhas de erro relacionadas aos novos slides. (Outros erros pré-existentes podem aparecer — ignorar se não forem dos arquivos novos.)

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/RelatorioMensal.tsx
git commit -m "feat(relatorio): registrar slides Entregas Pontuais Commerce e Tech

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Teste visual no browser

**Files:** nenhum alterado nesta task

- [ ] **Step 1: Matar servidor existente e reiniciar**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; sleep 1
```

```bash
cd /Users/mac0267/Cortex && npm run dev &
```
Expected: "serving on port 3000" ou similar nos logs.

- [ ] **Step 2: Verificar slide Commerce (índice 16)**

Abrir `http://localhost:3000` → navegar até Reporte Mensal → selecionar um mês com dados → avançar até o slide 17 (posição 16 no array). Verificar:
- Header "Entregas Pontuais Commerce — {mês}"
- 4 cards: Total YTD (purple), Entregue no Mês (cyan), Ticket Médio (emerald), Top Produto (amber)
- BarChart stacked com barras de Jan até o mês selecionado
- Legenda com nomes de produtos

- [ ] **Step 3: Verificar slide Tech (índice 19)**

Avançar até o slide 20 (posição 19 no array). Verificar:
- Header "Entregas Pontuais Tech — {mês}"
- 3 cards: Projetos YTD (blue), Receita YTD (emerald), Tempo Médio (cyan)
- BarChart stacked com receita por tipo, Jan até o mês selecionado
- Legenda com tipos de projeto
- Se não houver dados Tech no ano, barras ficam em branco — comportamento esperado

- [ ] **Step 4: Verificar slides após os novos não quebraram**

Avançar slides 20 (Tópicos), 21 (Frase), 22 (Q&A) e confirmar que renderizam normalmente.
