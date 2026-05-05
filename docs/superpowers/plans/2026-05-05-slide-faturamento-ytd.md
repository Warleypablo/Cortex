# Slide Faturamento YTD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar novo slide "Faturamento YTD" no Reporte Mensal logo após "Aniv. Empresa", exibindo métricas YTD de faturamento e um gráfico de DFC de recebimento mensal.

**Architecture:** Novas queries SQL no endpoint `/api/reports/mensal` alimentam uma nova interface TypeScript; um novo componente `SlideFaturamentoYtd.tsx` renderiza os dados seguindo o padrão visual existente (SlideLayout + SecondaryCard + ChartCard); o array `FIXED_SLIDE_NAMES` em `RelatorioMensal.tsx` recebe o slide na posição 4, deslocando os subsequentes.

**Tech Stack:** TypeScript, React, Recharts (BarChart), Tailwind CSS, Drizzle ORM (sql template tag), PostgreSQL

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `client/src/pages/relatorio-mensal/types.ts` | Modify | Adiciona `DfcRecebimentoMes`, `FaturamentoYtdData`, campo em `RelatorioMensalData` |
| `server/routes/relatorioMensalSlides.ts` | Modify | 2 novas queries no `Promise.all`, monta `faturamentoYtd` no response |
| `client/src/pages/relatorio-mensal/SlideFaturamentoYtd.tsx` | Create | Componente do slide |
| `client/src/pages/RelatorioMensal.tsx` | Modify | Insere slide no index 4 e atualiza `renderFixedSlide` |

---

## Task 1: Adicionar tipos TypeScript

**Files:**
- Modify: `client/src/pages/relatorio-mensal/types.ts`

- [ ] **Adicionar interfaces e campo em `RelatorioMensalData`**

Adicionar antes do `export interface RelatorioMensalData` existente:

```typescript
export interface DfcRecebimentoMes {
  month: string;   // "YYYY-MM"
  label: string;   // "Jan", "Fev", ...
  recebido: number;
}

export interface FaturamentoYtdData {
  faturamentoBrutoYtd: number;
  inadimplenciaYtd: number;
  impostoYtd: number;
  dfcRecebimentoMensal: DfcRecebimentoMes[];
}
```

Adicionar campo em `RelatorioMensalData` (após `pontualData: PontualData;`):

```typescript
  faturamentoYtd: FaturamentoYtdData;
```

- [ ] **Commit**

```bash
git add client/src/pages/relatorio-mensal/types.ts
git commit -m "feat(relatorio-mensal): adicionar tipos FaturamentoYtdData e DfcRecebimentoMes"
```

---

## Task 2: Adicionar queries no backend

**Files:**
- Modify: `server/routes/relatorioMensalSlides.ts`

- [ ] **Calcular `ytdStart` (1º de janeiro do ano dos dados)**

Adicionar logo após a linha onde `dataEnd` é definida (aprox. linha 118, onde `const dataEnd = ...`):

```typescript
      // YTD: de 1º de janeiro do ano atual até dataEnd
      const ytdStart = `${anoDados}-01-01`;
```

- [ ] **Adicionar 2 novas variáveis na desestruturação do `Promise.all`**

Na lista de variáveis (linhas 121-163), adicionar ao final da lista, antes do `] = await Promise.all([`:

```typescript
        faturamentoYtdResult,
        dfcRecebimentoYtdResult,
```

- [ ] **Adicionar as 2 novas queries no final do `Promise.all`**

Adicionar como últimas entradas do array (após `pontualTempoMedioResult`), antes do fechamento `])`):

```typescript
        // Faturamento Bruto YTD + Inadimplência YTD
        db.execute(sql`
          SELECT
            COALESCE(SUM(valor_bruto::numeric), 0) AS faturamento_bruto_ytd,
            COALESCE(SUM(CASE WHEN nao_pago::numeric > 0 THEN nao_pago::numeric ELSE 0 END), 0) AS inadimplencia_ytd
          FROM "Conta Azul".caz_parcelas
          WHERE tipo_evento = 'RECEITA'
            AND data_vencimento >= ${ytdStart}::date
            AND data_vencimento < ${dataEnd}::date
        `),

        // Imposto sobre Receita YTD (05.05) + DFC Recebimento mensal
        db.execute(sql`
          SELECT
            TO_CHAR(data_quitacao::date, 'YYYY-MM') AS month,
            COALESCE(SUM(CASE WHEN categoria_nome LIKE '05.05%' THEN valor_pago::numeric ELSE 0 END), 0) AS imposto,
            COALESCE(SUM(CASE WHEN tipo_evento = 'RECEITA' THEN valor_pago::numeric ELSE 0 END), 0) AS recebido
          FROM "Conta Azul".caz_parcelas
          WHERE status = 'QUITADO'
            AND data_quitacao::date >= ${ytdStart}::date
            AND data_quitacao::date < ${dataEnd}::date
          GROUP BY TO_CHAR(data_quitacao::date, 'YYYY-MM')
          ORDER BY month
        `),
```

- [ ] **Montar o objeto `faturamentoYtd` e incluir no `res.json`**

Adicionar o processamento dos resultados logo antes do bloco `res.json({...})` (aprox. linha 1286):

```typescript
      // ── Faturamento YTD ──
      const ytdRow = (faturamentoYtdResult.rows as any[])[0] || {};
      const faturamentoBrutoYtd = parseFloat(ytdRow.faturamento_bruto_ytd) || 0;
      const inadimplenciaYtd = parseFloat(ytdRow.inadimplencia_ytd) || 0;

      const MESES_SHORT_YTD = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      let impostoYtd = 0;
      const dfcRecebimentoMensal = (dfcRecebimentoYtdResult.rows as any[]).map((row: any) => {
        const m = parseInt(row.month.split("-")[1]) - 1;
        impostoYtd += parseFloat(row.imposto) || 0;
        return {
          month: row.month as string,
          label: MESES_SHORT_YTD[m] || row.month,
          recebido: parseFloat(row.recebido) || 0,
        };
      });

      const faturamentoYtd = {
        faturamentoBrutoYtd,
        inadimplenciaYtd,
        impostoYtd,
        dfcRecebimentoMensal,
      };
```

Adicionar `faturamentoYtd` no objeto retornado pelo `res.json({...})`, após `pontualData,`:

```typescript
        faturamentoYtd,
```

- [ ] **Commit**

```bash
git add server/routes/relatorioMensalSlides.ts
git commit -m "feat(relatorio-mensal): queries YTD de faturamento, inadimplência, imposto e DFC recebimento"
```

---

## Task 3: Criar o componente `SlideFaturamentoYtd.tsx`

**Files:**
- Create: `client/src/pages/relatorio-mensal/SlideFaturamentoYtd.tsx`

- [ ] **Criar o arquivo com o componente completo**

```tsx
import { TrendingUp, AlertTriangle, CheckCircle, Receipt } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { FaturamentoYtdData } from "./types";
import SlideLayout from "./SlideLayout";
import { SlideHeader, SecondaryCard, ChartCard } from "./SlideComponents";

interface Props {
  data: FaturamentoYtdData;
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

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs min-w-[140px]">
      <p className="font-bold text-white mb-1">{label}</p>
      <div className="flex justify-between gap-3">
        <span className="text-emerald-400">Recebido:</span>
        <span className="font-bold text-emerald-400">{fmtBRL(payload[0]?.value || 0)}</span>
      </div>
    </div>
  );
}

export default function SlideFaturamentoYtd({ data, mesLabel }: Props) {
  const faturamentoLiquidoYtd = data.faturamentoBrutoYtd - data.inadimplenciaYtd;
  const totalRecebidoYtd = data.dfcRecebimentoMensal.reduce((s, m) => s + m.recebido, 0);
  const maxRecebido = Math.max(...data.dfcRecebimentoMensal.map(m => m.recebido), 1);

  return (
    <SlideLayout section="intro" padding="24px 32px">
      <SlideHeader
        icon={TrendingUp}
        iconColor="text-emerald-400"
        title={`Faturamento YTD — ${mesLabel}`}
        gradientColor="#10b981"
      />

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-3 mb-3 shrink-0">
        <SecondaryCard className="p-3 flex flex-col justify-center gap-1">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="h-3.5 w-3.5 text-cyan-400" />
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Faturamento Bruto YTD</p>
          </div>
          <p className="text-xl font-black text-cyan-400">{fmtBRL(data.faturamentoBrutoYtd)}</p>
          <p className="text-[10px] text-zinc-600">Total faturável Jan → {mesLabel.split(" ")[0]}</p>
        </SecondaryCard>

        <SecondaryCard className="p-3 flex flex-col justify-center gap-1">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">(-) Inadimplência YTD</p>
          </div>
          <p className="text-xl font-black text-red-400">{fmtBRL(data.inadimplenciaYtd)}</p>
          <p className="text-[10px] text-zinc-600">
            {data.faturamentoBrutoYtd > 0
              ? `${((data.inadimplenciaYtd / data.faturamentoBrutoYtd) * 100).toFixed(1)}% do bruto`
              : "—"}
          </p>
        </SecondaryCard>

        <SecondaryCard className="p-3 flex flex-col justify-center gap-1" borderColor="#10b981">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">(=) Fat. Líquido YTD</p>
          </div>
          <p className="text-xl font-black text-emerald-400">{fmtBRL(faturamentoLiquidoYtd)}</p>
          <p className="text-[10px] text-zinc-600">Bruto − Inadimplência</p>
        </SecondaryCard>

        <SecondaryCard className="p-3 flex flex-col justify-center gap-1">
          <div className="flex items-center gap-1.5 mb-1">
            <Receipt className="h-3.5 w-3.5 text-amber-400" />
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Imposto Receita YTD</p>
          </div>
          <p className="text-xl font-black text-amber-400">{fmtBRL(data.impostoYtd)}</p>
          <p className="text-[10px] text-zinc-600">Categoria 05.05 quitado</p>
        </SecondaryCard>
      </div>

      {/* DFC Recebimento chart */}
      <ChartCard className="flex-1" title="">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-zinc-300">
            DFC Recebimento — Jan → {mesLabel.split(" ")[0]}
          </p>
          <div className="bg-emerald-500/10 rounded-lg px-3 py-1">
            <span className="text-xs text-zinc-500">Total recebido: </span>
            <span className="text-sm font-black text-emerald-400">{fmtBRL(totalRecebidoYtd)}</span>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.dfcRecebimentoMensal}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
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
              <Bar dataKey="recebido" name="Recebido" radius={[4, 4, 0, 0]} barSize={40}>
                {data.dfcRecebimentoMensal.map((entry, i) => (
                  <Cell
                    key={i}
                    fill="#34d399"
                    fillOpacity={entry.recebido > 0 ? 0.4 + (entry.recebido / maxRecebido) * 0.55 : 0.15}
                  />
                ))}
              </Bar>
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
git add client/src/pages/relatorio-mensal/SlideFaturamentoYtd.tsx
git commit -m "feat(relatorio-mensal): componente SlideFaturamentoYtd"
```

---

## Task 4: Registrar o slide em `RelatorioMensal.tsx`

**Files:**
- Modify: `client/src/pages/RelatorioMensal.tsx`

- [ ] **Adicionar o import do novo componente**

Após a linha de import de `SlideAniversarioEmpresa`:

```typescript
import SlideFaturamentoYtd from "./relatorio-mensal/SlideFaturamentoYtd";
```

- [ ] **Inserir "Faturamento YTD" em `FIXED_SLIDE_NAMES` na posição 4**

Substituir o array atual:

```typescript
const FIXED_SLIDE_NAMES = [
  "Capa", "Q&A", "Novos & Aniversários", "Aniv. Empresa",
  "KRs", "Capa Comercial", "Ranking Closers",
  "Ranking SDRs", "Contratos", "Capa Commerce", "Squad Details", "Ranking Squads", "Turbo Commerce",
  "Pontual",
  "Capa Tech", "Area Tech",
  "Tópicos",
  "Frase", "Q&A"
];
```

Pelo novo array com "Faturamento YTD" inserido na posição 4:

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

- [ ] **Atualizar `renderFixedSlide` para incluir o novo case e reindexar os demais**

Substituir a função `renderFixedSlide` inteira (casos 0–18) pela versão com os índices atualizados (novo slide em 4, demais deslocados +1):

```typescript
  const renderFixedSlide = (fixedIndex: number) => {
    if (!data) return null;
    switch (fixedIndex) {
      case 0:  return <SlideCapa mesLabel={data.mesLabel} />;
      case 1:  return <SlideQRCode />;
      case 2:  return <SlideNovosAniversariantes novos={data.novosColaboradores} aniversariantes={data.aniversariantes} mesLabel={data.mesLabel} />;
      case 3:  return <SlideAniversarioEmpresa aniversarios={data.aniversariosEmpresa} />;
      case 4:  return <SlideFaturamentoYtd data={data.faturamentoYtd} mesLabel={data.mesDadosLabel} />;
      case 5:  return <SlideKRs objectives={data.okrObjectives} />;
      case 6:  return <SlideCapaComercial />;
      case 7:  return <SlideRankingClosers ranking={data.rankingClosers} topPontual={data.topPontual} />;
      case 8:  return <SlideRankingSDRs ranking={data.rankingSDRs} topReunioes={data.topReunioes} />;
      case 9:  return <SlideGraficoContratos dados={data.contratosMes} mesLabel={data.mesDadosLabel} />;
      case 10: return <SlideCapaCommerce />;
      case 11: return <SlideSquadDetails details={data.squadDetails} mesLabel={data.mesDadosLabel} />;
      case 12: return <SlideRankingSquads ranking={data.rankingSquads} />;
      case 13: return <SlideTurboMetrics metrics={data.turboMetrics} mesLabel={data.mesDadosLabel} />;
      case 14: return <SlidePontual pontualData={data.pontualData} mesLabel={data.mesDadosLabel} />;
      case 15: return <SlideCapaTech />;
      case 16: return <SlideAreaTech techData={data.techData} mesLabel={data.mesDadosLabel} />;
      case 17: return <SlideTopicosDiscussao />;
      case 18: return <SlideFraseEncerramento />;
      case 19: return <SlideQRCode />;
      default: return null;
    }
  };
```

- [ ] **Commit**

```bash
git add client/src/pages/RelatorioMensal.tsx
git commit -m "feat(relatorio-mensal): registrar SlideFaturamentoYtd na posição 4"
```

---

## Task 5: Testar e verificar

- [ ] **Reiniciar o dev server**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev
```

- [ ] **Abrir o browser em `http://localhost:3000/reports/mensal`**

Verificar:
1. O slide "Faturamento YTD" aparece entre "Aniv. Empresa" e "KRs" nos dots de navegação
2. Os 4 cards mostram valores numéricos (não zeros/NaN)
3. O gráfico de barras renderiza com os meses de Jan até o mês selecionado
4. Trocar o mês no seletor — os dados atualizam corretamente
5. Modo apresentação (botão "Apresentar") funciona sem erros

- [ ] **Verificar ausência de erros TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Esperado: sem erros relacionados a `faturamentoYtd` ou `SlideFaturamentoYtd`.

- [ ] **Commit final se tudo OK**

```bash
git add -A
git commit -m "chore(relatorio-mensal): ajustes pós-teste slide faturamento ytd"
```
