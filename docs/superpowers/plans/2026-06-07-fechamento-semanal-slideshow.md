# Fechamento Semanal — Slideshow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar uma página slideshow em `/presentation/fechamento-semanal` com 8 slides de desempenho semanal para apresentação gerencial do COO, navegável por teclado e com tela cheia.

**Architecture:** Nova página `FechamentoSemanal.tsx` (engine do slideshow) com 8 componentes de slide independentes em `components/fechamento-semanal/`. Cada slide recebe `semanaInicio`/`semanaFim` e faz seu próprio `useQuery`. Dois novos endpoints backend para novos contratos e saúde dos squads. Endpoints existentes de closers, SDRs, churn e inadimplência já aceitam range livre de datas.

**Tech Stack:** React + TypeScript, Framer Motion (AnimatePresence + motion.div), Recharts, React Query (@tanstack/react-query), date-fns, Tailwind CSS, Express + Drizzle (backend).

---

## Mapa de Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `client/src/pages/FechamentoSemanal.tsx` |
| Criar | `client/src/components/fechamento-semanal/SlideCapaSemana.tsx` |
| Criar | `client/src/components/fechamento-semanal/SlideMRR.tsx` |
| Criar | `client/src/components/fechamento-semanal/SlideChurn.tsx` |
| Criar | `client/src/components/fechamento-semanal/SlideInadimplencia.tsx` |
| Criar | `client/src/components/fechamento-semanal/SlideRankingClosers.tsx` |
| Criar | `client/src/components/fechamento-semanal/SlideRankingSDRs.tsx` |
| Criar | `client/src/components/fechamento-semanal/SlideNovosContratos.tsx` |
| Criar | `client/src/components/fechamento-semanal/SlideSaudeSquads.tsx` |
| Modificar | `server/routes.ts` — registrar 2 novos endpoints |
| Criar | `server/routes/fechamentoSemanal.ts` — lógica dos 2 novos endpoints |
| Modificar | `client/src/App.tsx` — registrar rota + isPresentationMode |
| Modificar | `client/src/components/app-sidebar.tsx` — adicionar link no menu |

---

## Task 1: Backend — Endpoint de Novos Contratos

**Files:**
- Criar: `server/routes/fechamentoSemanal.ts`
- Modificar: `server/routes.ts` (registrar import)

- [ ] **Step 1: Criar arquivo de rotas**

Crie `server/routes/fechamentoSemanal.ts` com o seguinte conteúdo:

```typescript
import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

export function registerFechamentoSemanalRoutes(app: Express) {
  // Novos contratos assinados na semana
  app.get("/api/fechamento-semanal/novos-contratos", async (req, res) => {
    try {
      const { semanaInicio, semanaFim } = req.query;

      if (!semanaInicio || !semanaFim) {
        return res.status(400).json({ error: "semanaInicio e semanaFim são obrigatórios" });
      }

      const result = await db.execute(sql`
        SELECT
          c.id_subtask,
          c.nome AS contrato_nome,
          cl.nome AS cliente_nome,
          c.produto,
          c.squad,
          c.cs_responsavel,
          c.vendedor,
          COALESCE(c.valorr::numeric, 0) AS valor_mrr,
          c.data_inicio
        FROM "Clickup".cup_contratos c
        LEFT JOIN "Clickup".cup_clientes cl ON c.id_task = cl.task_id
        WHERE c.data_inicio >= ${semanaInicio}::date
          AND c.data_inicio <= ${semanaFim}::date
          AND c.status IN ('ativo', 'onboarding', 'triagem')
          AND c.valorr IS NOT NULL
          AND c.valorr::numeric > 0
        ORDER BY c.valorr::numeric DESC
      `);

      const contratos = result.rows.map((row: any) => ({
        id: row.id_subtask,
        contratoNome: row.contrato_nome || "Sem nome",
        clienteNome: row.cliente_nome || "Cliente não identificado",
        produto: row.produto || "Não especificado",
        squad: row.squad || "Sem Squad",
        csResponsavel: row.cs_responsavel || "—",
        vendedor: row.vendedor || "—",
        valorMrr: parseFloat(row.valor_mrr) || 0,
        dataInicio: row.data_inicio,
      }));

      res.json(contratos);
    } catch (error) {
      console.error("[api] Error fetching novos contratos semanal:", error);
      res.status(500).json({ error: "Failed to fetch novos contratos" });
    }
  });

  // Saúde dos squads na semana
  app.get("/api/fechamento-semanal/saude-squads", async (req, res) => {
    try {
      const { semanaInicio, semanaFim } = req.query;

      if (!semanaInicio || !semanaFim) {
        return res.status(400).json({ error: "semanaInicio e semanaFim são obrigatórios" });
      }

      // MRR atual por squad (dados ao vivo)
      const mrrResult = await db.execute(sql`
        SELECT
          COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad') AS squad,
          COALESCE(SUM(valorr::numeric), 0) AS mrr,
          COUNT(DISTINCT id_task) AS clientes,
          COUNT(DISTINCT id_subtask) AS contratos
        FROM "Clickup".cup_contratos
        WHERE status IN ('ativo', 'onboarding', 'triagem')
          AND valorr IS NOT NULL AND valorr::numeric > 0
        GROUP BY COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad')
        ORDER BY mrr DESC
      `);

      // Churn da semana por squad
      const churnResult = await db.execute(sql`
        SELECT
          COALESCE(NULLIF(TRIM(c.squad), ''), 'Sem Squad') AS squad,
          COUNT(*) AS churns,
          COALESCE(SUM(c.valor_r::numeric), 0) AS mrr_perdido
        FROM cortex_core.vw_cup_churn_ajustado c
        WHERE c.data_solicitacao_encerramento >= ${semanaInicio}::date
          AND c.data_solicitacao_encerramento <= ${semanaFim}::date
          AND c.data_solicitacao_encerramento IS NOT NULL
        GROUP BY COALESCE(NULLIF(TRIM(c.squad), ''), 'Sem Squad')
      `);

      // Mapa de churn por squad
      const churnMap = new Map<string, { churns: number; mrrPerdido: number }>();
      for (const row of churnResult.rows as any[]) {
        churnMap.set(row.squad, {
          churns: parseInt(row.churns) || 0,
          mrrPerdido: parseFloat(row.mrr_perdido) || 0,
        });
      }

      const squads = (mrrResult.rows as any[]).map((row) => {
        const mrr = parseFloat(row.mrr) || 0;
        const churn = churnMap.get(row.squad) || { churns: 0, mrrPerdido: 0 };
        const churnRate = mrr > 0 ? (churn.mrrPerdido / mrr) * 100 : 0;
        const saude =
          churnRate === 0 ? "verde" : churnRate < 3 ? "amarelo" : "vermelho";

        return {
          squad: row.squad,
          mrr,
          clientes: parseInt(row.clientes) || 0,
          contratos: parseInt(row.contratos) || 0,
          churns: churn.churns,
          mrrPerdido: churn.mrrPerdido,
          churnRate: parseFloat(churnRate.toFixed(2)),
          saude,
        };
      });

      res.json(squads);
    } catch (error) {
      console.error("[api] Error fetching saude squads semanal:", error);
      res.status(500).json({ error: "Failed to fetch saude squads" });
    }
  });
}
```

- [ ] **Step 2: Registrar no routes.ts**

Abra `server/routes.ts`. Encontre a área de imports de rotas (próximo às linhas onde outros `registerXxxRoutes` são chamados — grep por `registerGrowthRoutes\|registerComercialRoutes` para localizar). Adicione:

```typescript
import { registerFechamentoSemanalRoutes } from "./routes/fechamentoSemanal";
```

E na função que registra as rotas, adicione a chamada:

```typescript
registerFechamentoSemanalRoutes(app);
```

- [ ] **Step 3: Testar os endpoints manualmente**

Com o servidor rodando (`npm run dev`), execute:

```bash
curl "http://localhost:3000/api/fechamento-semanal/novos-contratos?semanaInicio=2026-06-02&semanaFim=2026-06-08" | jq '.[0]'
```

Esperado: objeto com campos `id`, `clienteNome`, `valorMrr`, etc. (pode ser array vazio se não houver contratos novos na semana).

```bash
curl "http://localhost:3000/api/fechamento-semanal/saude-squads?semanaInicio=2026-06-02&semanaFim=2026-06-08" | jq '.[0]'
```

Esperado: objeto com `squad`, `mrr`, `clientes`, `churns`, `saude`.

- [ ] **Step 4: Commit**

```bash
git add server/routes/fechamentoSemanal.ts server/routes.ts
git commit -m "feat(backend): add fechamento-semanal endpoints for novos-contratos and saude-squads

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Engine do Slideshow — FechamentoSemanal.tsx

**Files:**
- Criar: `client/src/pages/FechamentoSemanal.tsx`

- [ ] **Step 1: Criar a engine do slideshow**

Crie `client/src/pages/FechamentoSemanal.tsx`:

```tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { format, startOfWeek, endOfWeek, subWeeks, addWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/use-page-title";
import turboLogo from "@assets/logo-branca.png";

import SlideCapaSemana from "@/components/fechamento-semanal/SlideCapaSemana";
import SlideMRR from "@/components/fechamento-semanal/SlideMRR";
import SlideChurn from "@/components/fechamento-semanal/SlideChurn";
import SlideInadimplencia from "@/components/fechamento-semanal/SlideInadimplencia";
import SlideRankingClosers from "@/components/fechamento-semanal/SlideRankingClosers";
import SlideRankingSDRs from "@/components/fechamento-semanal/SlideRankingSDRs";
import SlideNovosContratos from "@/components/fechamento-semanal/SlideNovosContratos";
import SlideSaudeSquads from "@/components/fechamento-semanal/SlideSaudeSquads";

export interface SlideProps {
  semanaInicio: string;
  semanaFim: string;
}

const SLIDES = [
  { id: "capa", label: "Capa", component: SlideCapaSemana },
  { id: "mrr", label: "MRR", component: SlideMRR },
  { id: "churn", label: "Churn", component: SlideChurn },
  { id: "inadimplencia", label: "Inadimplência", component: SlideInadimplencia },
  { id: "closers", label: "Closers", component: SlideRankingClosers },
  { id: "sdrs", label: "SDRs", component: SlideRankingSDRs },
  { id: "novos", label: "Novos Contratos", component: SlideNovosContratos },
  { id: "squads", label: "Squads", component: SlideSaudeSquads },
];

export default function FechamentoSemanal() {
  usePageTitle("Fechamento Semanal");

  const [baseDate, setBaseDate] = useState(() => new Date());
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isPresenting, setIsPresenting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const semanaInicio = format(
    startOfWeek(baseDate, { weekStartsOn: 1 }),
    "yyyy-MM-dd"
  );
  const semanaFim = format(
    endOfWeek(baseDate, { weekStartsOn: 1 }),
    "yyyy-MM-dd"
  );
  const semanaLabel = `${format(startOfWeek(baseDate, { weekStartsOn: 1 }), "dd MMM", { locale: ptBR })} – ${format(endOfWeek(baseDate, { weekStartsOn: 1 }), "dd MMM yyyy", { locale: ptBR })}`;

  const goNext = useCallback(() => {
    if (currentSlide < SLIDES.length - 1) {
      setDirection(1);
      setCurrentSlide((s) => s + 1);
    }
  }, [currentSlide]);

  const goPrev = useCallback(() => {
    if (currentSlide > 0) {
      setDirection(-1);
      setCurrentSlide((s) => s - 1);
    }
  }, [currentSlide]);

  const enterPresentation = () => {
    setIsPresenting(true);
    containerRef.current?.requestFullscreen?.();
  };

  const exitPresentation = () => {
    setIsPresenting(false);
    if (document.fullscreenElement) document.exitFullscreen();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isPresenting) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goNext();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goPrev();
      if (e.key === "Escape") exitPresentation();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPresenting, goNext, goPrev]);

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setIsPresenting(false);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const slideProps: SlideProps = { semanaInicio, semanaFim };
  const CurrentSlideComponent = SLIDES[currentSlide].component;

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0 }),
  };

  if (!isPresenting) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white p-8">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Fechamento Semanal</h1>
              <p className="text-zinc-400 mt-1">Selecione a semana e inicie a apresentação</p>
            </div>
            <img src={turboLogo} alt="Turbo" className="h-8 opacity-80" />
          </div>

          {/* Seletor de semana */}
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
            <p className="text-sm text-zinc-400 mb-3">Semana selecionada</p>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
                onClick={() => setBaseDate((d) => subWeeks(d, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-2xl font-semibold flex-1 text-center">{semanaLabel}</span>
              <Button
                variant="outline"
                size="icon"
                className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
                onClick={() => setBaseDate((d) => addWeeks(d, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Lista de slides */}
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
            <p className="text-sm text-zinc-400 mb-4">Slides ({SLIDES.length})</p>
            <div className="grid grid-cols-2 gap-2">
              {SLIDES.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => { setCurrentSlide(i); setIsPresenting(true); containerRef.current?.requestFullscreen?.(); }}
                  className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-left transition-colors"
                >
                  <span className="text-zinc-500 text-sm w-5">{i + 1}</span>
                  <span className="text-sm font-medium">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          <Button
            size="lg"
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-6 text-lg rounded-xl"
            onClick={() => { setCurrentSlide(0); enterPresentation(); }}
          >
            <Play className="h-5 w-5 mr-2" />
            Apresentar
          </Button>
        </div>
      </div>
    );
  }

  // Modo apresentação
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-zinc-950 text-white overflow-hidden select-none"
      style={{ zIndex: 9999 }}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-8 py-4 bg-gradient-to-b from-zinc-950/80 to-transparent">
        <span className="text-zinc-400 text-sm font-medium">{semanaLabel}</span>
        <img src={turboLogo} alt="Turbo" className="h-7 opacity-70" />
        <button
          onClick={exitPresentation}
          className="text-zinc-500 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Slide content */}
      <div className="absolute inset-0 flex items-center justify-center">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentSlide}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            <CurrentSlideComponent {...slideProps} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Botões de navegação laterais */}
      {currentSlide > 0 && (
        <button
          onClick={goPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center rounded-full bg-zinc-800/60 hover:bg-zinc-700 text-white transition-colors"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {currentSlide < SLIDES.length - 1 && (
        <button
          onClick={goNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center rounded-full bg-zinc-800/60 hover:bg-zinc-700 text-white transition-colors"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Barra de progresso inferior */}
      <div className="absolute bottom-6 left-0 right-0 z-10 flex items-center justify-center gap-2">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => { setDirection(i > currentSlide ? 1 : -1); setCurrentSlide(i); }}
            className={`w-2 h-2 rounded-full transition-all ${
              i === currentSlide ? "bg-white w-6" : "bg-zinc-600 hover:bg-zinc-400"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar imports**

Confirme que `turboLogo` existe em `@assets/logo-branca.png` rodando:

```bash
ls client/src/assets/ | grep logo
```

Se o arquivo tiver nome diferente, ajuste o import.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/FechamentoSemanal.tsx
git commit -m "feat(frontend): add FechamentoSemanal slideshow engine with week selector and fullscreen

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Registrar Rota e Atualizar Sidebar

**Files:**
- Modificar: `client/src/App.tsx`
- Modificar: `client/src/components/app-sidebar.tsx`

- [ ] **Step 1: Adicionar import e rota no App.tsx**

No `client/src/App.tsx`, localize onde `PresentationMode` é importado (linha ~104) e adicione logo abaixo:

```tsx
const FechamentoSemanal = lazyWithRetry(() => import("@/pages/FechamentoSemanal"));
```

Localize a rota `/presentation` (linha ~386) e adicione logo após:

```tsx
<Route path="/presentation/fechamento-semanal">{() => <ProtectedRoute path="/presentation/fechamento-semanal" component={FechamentoSemanal} />}</Route>
```

Localize a linha onde `isPresentationMode` é definido (linha ~489):

```tsx
const isPresentationMode = location === "/dashboard/comercial/apresentacao" || location === "/presentation";
```

Altere para:

```tsx
const isPresentationMode = location === "/dashboard/comercial/apresentacao" || location === "/presentation" || location === "/presentation/fechamento-semanal";
```

- [ ] **Step 2: Adicionar link no sidebar**

No `client/src/components/app-sidebar.tsx`, localize o bloco do link de Apresentação (próximo à linha 472, com `href="/presentation"` e ícone `Tv`). Logo após o `</Tooltip>` desse bloco, adicione:

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <Link
      href="/presentation/fechamento-semanal"
      className="flex items-center justify-center h-8 w-8 rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
    >
      <CalendarCheck className="h-4 w-4" />
    </Link>
  </TooltipTrigger>
  <TooltipContent side={isCollapsed ? "right" : "top"}>
    Fechamento Semanal
  </TooltipContent>
</Tooltip>
```

Confirme que `CalendarCheck` já está importado de `lucide-react` no topo do arquivo. Se não estiver, adicione ao import existente.

- [ ] **Step 3: Commit**

```bash
git add client/src/App.tsx client/src/components/app-sidebar.tsx
git commit -m "feat(routing): register /presentation/fechamento-semanal route and sidebar link

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Slide 1 (Capa) + Slide 2 (MRR)

**Files:**
- Criar: `client/src/components/fechamento-semanal/SlideCapaSemana.tsx`
- Criar: `client/src/components/fechamento-semanal/SlideMRR.tsx`

- [ ] **Step 1: Criar SlideCapaSemana.tsx**

```tsx
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { SlideProps } from "@/pages/FechamentoSemanal";
import turboLogo from "@assets/logo-branca.png";

export default function SlideCapaSemana({ semanaInicio, semanaFim }: SlideProps) {
  const inicio = parseISO(semanaInicio);
  const fim = parseISO(semanaFim);
  const periodoLabel = `${format(inicio, "dd 'de' MMMM", { locale: ptBR })} – ${format(fim, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`;

  return (
    <div className="h-full flex flex-col items-center justify-center bg-zinc-950 text-white px-12">
      <img src={turboLogo} alt="Turbo" className="h-16 mb-12 opacity-90" />
      <h1 className="text-7xl font-bold tracking-tight text-center mb-6">
        Fechamento Semanal
      </h1>
      <p className="text-2xl text-zinc-400 font-medium text-center">{periodoLabel}</p>
      <div className="mt-16 w-24 h-1 bg-emerald-500 rounded-full" />
    </div>
  );
}
```

- [ ] **Step 2: Criar SlideMRR.tsx**

O endpoint `/api/visao-geral/mrr-evolucao` retorna array mensal. Usamos os últimos 8 meses para o gráfico e comparamos o penúltimo com o último para mostrar variação. Recebe `mesAno` baseado no `semanaInicio`.

```tsx
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyCompact } from "@/lib/utils";
import type { SlideProps } from "@/pages/FechamentoSemanal";

interface MrrPonto {
  mes: string;
  mesLabel: string;
  mrr: number;
}

export default function SlideMRR({ semanaInicio }: SlideProps) {
  const mesAno = semanaInicio.substring(0, 7); // "YYYY-MM"

  const { data, isLoading } = useQuery<MrrPonto[]>({
    queryKey: ["/api/visao-geral/mrr-evolucao", mesAno],
    queryFn: async () => {
      const res = await fetch(`/api/visao-geral/mrr-evolucao?mesAno=${mesAno}&qtdMeses=9`);
      return res.json();
    },
  });

  const chartData = data?.slice(-8) ?? [];
  const atual = chartData[chartData.length - 1]?.mrr ?? 0;
  const anterior = chartData[chartData.length - 2]?.mrr ?? 0;
  const delta = atual - anterior;
  const pct = anterior > 0 ? (delta / anterior) * 100 : 0;

  const TrendIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const trendColor = delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-zinc-400";

  return (
    <div className="h-full flex flex-col items-center justify-center bg-zinc-950 text-white px-16 py-12">
      <h2 className="text-3xl font-bold text-zinc-300 mb-10">MRR Atual</h2>

      {isLoading ? (
        <Skeleton className="h-24 w-64 bg-zinc-800" />
      ) : (
        <>
          <div className="flex items-end gap-6 mb-4">
            <span className="text-7xl font-bold tabular-nums">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(atual)}
            </span>
            <div className={`flex items-center gap-1 mb-3 ${trendColor}`}>
              <TrendIcon className="h-6 w-6" />
              <span className="text-xl font-semibold">{Math.abs(pct).toFixed(1)}%</span>
            </div>
          </div>
          <p className="text-zinc-500 text-sm mb-12">
            {delta > 0 ? "+" : ""}{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(delta)} vs mês anterior
          </p>
        </>
      )}

      {chartData.length > 0 && (
        <div className="w-full max-w-2xl h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="mesLabel" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={(v: number) => [formatCurrencyCompact(v), "MRR"]}
                contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                labelStyle={{ color: "#a1a1aa" }}
              />
              <Area type="monotone" dataKey="mrr" stroke="#10b981" strokeWidth={2} fill="url(#mrrGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/fechamento-semanal/SlideCapaSemana.tsx client/src/components/fechamento-semanal/SlideMRR.tsx
git commit -m "feat(slides): add SlideCapaSemana and SlideMRR

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Slide 3 (Churn) + Slide 4 (Inadimplência)

**Files:**
- Criar: `client/src/components/fechamento-semanal/SlideChurn.tsx`
- Criar: `client/src/components/fechamento-semanal/SlideInadimplencia.tsx`

- [ ] **Step 1: Criar SlideChurn.tsx**

O endpoint `analytics/churn-detalhamento` retorna array de contratos churned. Calculamos total de contratos, MRR perdido e taxa:

```tsx
import { useQuery } from "@tanstack/react-query";
import { TrendingDown, DollarSign, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyCompact } from "@/lib/utils";
import type { SlideProps } from "@/pages/FechamentoSemanal";

interface ChurnContrato {
  id: string;
  cliente_nome: string;
  squad: string;
  valorr: number;
  motivo_cancelamento: string;
  produto: string;
  responsavel: string;
}

interface ChurnData {
  contratos: ChurnContrato[];
  mrrTotal: number;
  qtdContratos: number;
}

export default function SlideChurn({ semanaInicio, semanaFim }: SlideProps) {
  const { data, isLoading } = useQuery<ChurnData>({
    queryKey: ["/api/analytics/churn-detalhamento", { startDate: semanaInicio, endDate: semanaFim }],
    queryFn: async () => {
      const res = await fetch(
        `/api/analytics/churn-detalhamento?startDate=${semanaInicio}&endDate=${semanaFim}`,
        { credentials: "include" }
      );
      const raw: ChurnContrato[] = await res.json();
      const mrrTotal = raw.reduce((sum, c) => sum + (c.valorr || 0), 0);
      return { contratos: raw.slice(0, 8), mrrTotal, qtdContratos: raw.length };
    },
  });

  const cards = [
    { label: "Contratos Perdidos", value: String(data?.qtdContratos ?? 0), icon: TrendingDown, color: "text-red-400" },
    { label: "MRR Perdido", value: formatCurrencyCompact(data?.mrrTotal ?? 0), icon: DollarSign, color: "text-red-400" },
  ];

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-white px-16 py-16">
      <h2 className="text-3xl font-bold text-zinc-300 mb-8">Churn da Semana</h2>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full bg-zinc-800" />
          <Skeleton className="h-48 w-full bg-zinc-800" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-6 mb-10">
            {cards.map((c) => (
              <div key={c.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex items-center gap-5">
                <c.icon className={`h-10 w-10 ${c.color}`} />
                <div>
                  <p className="text-zinc-400 text-sm">{c.label}</p>
                  <p className={`text-4xl font-bold ${c.color}`}>{c.value}</p>
                </div>
              </div>
            ))}
          </div>

          {data && data.contratos.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-zinc-800 flex-1">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900">
                  <tr>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">Cliente</th>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">Squad</th>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">Motivo</th>
                    <th className="text-right px-4 py-3 text-zinc-400 font-medium">MRR</th>
                  </tr>
                </thead>
                <tbody>
                  {data.contratos.map((c, i) => (
                    <tr key={c.id} className={i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/50"}>
                      <td className="px-4 py-3 font-medium">{c.cliente_nome}</td>
                      <td className="px-4 py-3 text-zinc-400">{c.squad}</td>
                      <td className="px-4 py-3 text-zinc-400">{c.motivo_cancelamento}</td>
                      <td className="px-4 py-3 text-right text-red-400 font-semibold">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(c.valorr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-zinc-500 text-xl">Nenhum churn registrado nesta semana 🎉</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Criar SlideInadimplencia.tsx**

O endpoint `inadimplencia/resumo` retorna dados do estado atual (independente de semana). Mostramos snapshot atual + top devedores:

```tsx
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyCompact } from "@/lib/utils";
import type { SlideProps } from "@/pages/FechamentoSemanal";

interface InadimplenciaResumo {
  totalInadimplente: number;
  quantidadeClientes: number;
  faixas: {
    ate30dias: { valor: number; quantidade: number; percentual: number };
    de31a60dias: { valor: number; quantidade: number; percentual: number };
    de61a90dias: { valor: number; quantidade: number; percentual: number };
    acima90dias: { valor: number; quantidade: number; percentual: number };
  };
}

interface InadimplenciaCliente {
  idCliente: string;
  nome: string;
  totalDevido: number;
  diasAtrasoMedio: number;
}

export default function SlideInadimplencia({ }: SlideProps) {
  const { data: resumo, isLoading: loadingResumo } = useQuery<InadimplenciaResumo>({
    queryKey: ["/api/inadimplencia/resumo"],
    queryFn: async () => {
      const res = await fetch("/api/inadimplencia/resumo", { credentials: "include" });
      return res.json();
    },
  });

  const { data: clientes } = useQuery<InadimplenciaCliente[]>({
    queryKey: ["/api/inadimplencia/clientes", { limite: 5, ordenarPor: "valor" }],
    queryFn: async () => {
      const res = await fetch("/api/inadimplencia/clientes?limite=5&ordenarPor=valor", { credentials: "include" });
      return res.json();
    },
  });

  const faixas = resumo
    ? [
        { label: "0–30 dias", valor: resumo.faixas.ate30dias.valor, pct: resumo.faixas.ate30dias.percentual, color: "bg-yellow-500" },
        { label: "31–60 dias", valor: resumo.faixas.de31a60dias.valor, pct: resumo.faixas.de31a60dias.percentual, color: "bg-orange-500" },
        { label: "61–90 dias", valor: resumo.faixas.de61a90dias.valor, pct: resumo.faixas.de61a90dias.percentual, color: "bg-red-500" },
        { label: "+90 dias", valor: resumo.faixas.acima90dias.valor, pct: resumo.faixas.acima90dias.percentual, color: "bg-red-800" },
      ]
    : [];

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-white px-16 py-16">
      <h2 className="text-3xl font-bold text-zinc-300 mb-8">Inadimplência</h2>

      {loadingResumo ? (
        <Skeleton className="h-32 w-full bg-zinc-800" />
      ) : resumo ? (
        <>
          <div className="flex items-end gap-8 mb-10">
            <div>
              <p className="text-zinc-400 text-sm mb-1">Total em Aberto</p>
              <p className="text-6xl font-bold text-red-400">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(resumo.totalInadimplente)}
              </p>
            </div>
            <div className="mb-2">
              <p className="text-zinc-400 text-sm mb-1">Clientes</p>
              <p className="text-3xl font-semibold">{resumo.quantidadeClientes}</p>
            </div>
          </div>

          {/* Barras por faixa */}
          <div className="space-y-3 mb-10">
            {faixas.map((f) => (
              <div key={f.label} className="flex items-center gap-4">
                <span className="text-zinc-400 text-sm w-20">{f.label}</span>
                <div className="flex-1 bg-zinc-800 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-full ${f.color} rounded-full transition-all`}
                    style={{ width: `${Math.min(f.pct, 100)}%` }}
                  />
                </div>
                <span className="text-sm text-zinc-300 w-32 text-right">{formatCurrencyCompact(f.valor)}</span>
              </div>
            ))}
          </div>

          {/* Top 5 devedores */}
          {clientes && clientes.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900">
                  <tr>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">Cliente</th>
                    <th className="text-right px-4 py-3 text-zinc-400 font-medium">Valor em Aberto</th>
                    <th className="text-right px-4 py-3 text-zinc-400 font-medium">Dias médios</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c, i) => (
                    <tr key={c.idCliente} className={i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/50"}>
                      <td className="px-4 py-3 font-medium">{c.nome}</td>
                      <td className="px-4 py-3 text-right text-red-400 font-semibold">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(c.totalDevido)}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-300">{c.diasAtrasoMedio}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/fechamento-semanal/SlideChurn.tsx client/src/components/fechamento-semanal/SlideInadimplencia.tsx
git commit -m "feat(slides): add SlideChurn and SlideInadimplencia

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Slide 5 (Ranking Closers) + Slide 6 (Ranking SDRs)

**Files:**
- Criar: `client/src/components/fechamento-semanal/SlideRankingClosers.tsx`
- Criar: `client/src/components/fechamento-semanal/SlideRankingSDRs.tsx`

- [ ] **Step 1: Criar SlideRankingClosers.tsx**

Usa `/api/closers/chart-receita` com `dataFechamentoInicio`/`dataFechamentoFim` = semana selecionada. Pódio para top 3, tabela para os demais:

```tsx
import { useQuery } from "@tanstack/react-query";
import { Crown, Medal, Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyCompact } from "@/lib/utils";
import type { SlideProps } from "@/pages/FechamentoSemanal";

interface RankingCloser {
  closer: string;
  mrr: number;
  pontual: number;
  reunioes: number;
  negociosGanhos: number;
  taxaConversao: number;
}

const PODIUM_ICONS = [Crown, Trophy, Medal];
const PODIUM_COLORS = ["text-yellow-400", "text-zinc-300", "text-amber-600"];

export default function SlideRankingClosers({ semanaInicio, semanaFim }: SlideProps) {
  const params = new URLSearchParams({
    dataFechamentoInicio: semanaInicio,
    dataFechamentoFim: semanaFim,
    dataReuniaoInicio: semanaInicio,
    dataReuniaoFim: semanaFim,
  });

  const { data, isLoading } = useQuery<RankingCloser[]>({
    queryKey: ["/api/closers/chart-receita", { semanaInicio, semanaFim }],
    queryFn: async () => {
      const res = await fetch(`/api/closers/chart-receita?${params}`, { credentials: "include" });
      const raw: RankingCloser[] = await res.json();
      return raw.sort((a, b) => (b.mrr + b.pontual) - (a.mrr + a.pontual));
    },
  });

  const top3 = data?.slice(0, 3) ?? [];
  const rest = data?.slice(3) ?? [];

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-white px-16 py-16">
      <h2 className="text-3xl font-bold text-zinc-300 mb-8">Ranking de Closers</h2>

      {isLoading ? (
        <Skeleton className="h-48 w-full bg-zinc-800" />
      ) : !data || data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-500 text-xl">Nenhuma venda registrada nesta semana</p>
        </div>
      ) : (
        <>
          {/* Pódio */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {top3.map((c, i) => {
              const Icon = PODIUM_ICONS[i];
              const color = PODIUM_COLORS[i];
              return (
                <div key={c.closer} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col items-center text-center">
                  <Icon className={`h-8 w-8 ${color} mb-2`} />
                  <p className="font-bold text-lg leading-tight">{c.closer.split(" ")[0]}</p>
                  <p className={`text-3xl font-bold mt-2 ${color}`}>{formatCurrencyCompact(c.mrr + c.pontual)}</p>
                  <p className="text-zinc-500 text-xs mt-1">{c.negociosGanhos} negócios</p>
                </div>
              );
            })}
          </div>

          {/* Restante */}
          {rest.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-zinc-800 flex-1">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900">
                  <tr>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">Closer</th>
                    <th className="text-right px-4 py-3 text-zinc-400 font-medium">MRR</th>
                    <th className="text-right px-4 py-3 text-zinc-400 font-medium">Pontual</th>
                    <th className="text-right px-4 py-3 text-zinc-400 font-medium">Reuniões</th>
                    <th className="text-right px-4 py-3 text-zinc-400 font-medium">Negócios</th>
                  </tr>
                </thead>
                <tbody>
                  {rest.map((c, i) => (
                    <tr key={c.closer} className={i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/50"}>
                      <td className="px-4 py-3 font-medium">{c.closer}</td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-semibold">{formatCurrencyCompact(c.mrr)}</td>
                      <td className="px-4 py-3 text-right text-blue-400">{formatCurrencyCompact(c.pontual)}</td>
                      <td className="px-4 py-3 text-right text-zinc-300">{c.reunioes}</td>
                      <td className="px-4 py-3 text-right text-zinc-300">{c.negociosGanhos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Criar SlideRankingSDRs.tsx**

Usa `/api/sdrs/chart-reunioes` com `dataReuniaoInicio`/`dataReuniaoFim` e `dataLeadInicio`/`dataLeadFim` = semana selecionada:

```tsx
import { useQuery } from "@tanstack/react-query";
import { Crown, Trophy, Medal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { SlideProps } from "@/pages/FechamentoSemanal";

interface RankingSDR {
  sdr: string;
  sdrId: number;
  leads: number;
  reunioesRealizadas: number;
  conversao: number;
}

const PODIUM_ICONS = [Crown, Trophy, Medal];
const PODIUM_COLORS = ["text-yellow-400", "text-zinc-300", "text-amber-600"];

export default function SlideRankingSDRs({ semanaInicio, semanaFim }: SlideProps) {
  const params = new URLSearchParams({
    dataReuniaoInicio: semanaInicio,
    dataReuniaoFim: semanaFim,
    dataLeadInicio: semanaInicio,
    dataLeadFim: semanaFim,
  });

  const { data, isLoading } = useQuery<RankingSDR[]>({
    queryKey: ["/api/sdrs/chart-reunioes", { semanaInicio, semanaFim }],
    queryFn: async () => {
      const res = await fetch(`/api/sdrs/chart-reunioes?${params}`, { credentials: "include" });
      return res.json();
    },
  });

  const sorted = data ? [...data].sort((a, b) => b.reunioesRealizadas - a.reunioesRealizadas) : [];
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-white px-16 py-16">
      <h2 className="text-3xl font-bold text-zinc-300 mb-8">Ranking de SDRs</h2>

      {isLoading ? (
        <Skeleton className="h-48 w-full bg-zinc-800" />
      ) : !data || data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-500 text-xl">Nenhuma reunião registrada nesta semana</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {top3.map((s, i) => {
              const Icon = PODIUM_ICONS[i];
              const color = PODIUM_COLORS[i];
              return (
                <div key={s.sdrId} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col items-center text-center">
                  <Icon className={`h-8 w-8 ${color} mb-2`} />
                  <p className="font-bold text-lg leading-tight">{s.sdr.split(" ")[0]}</p>
                  <p className={`text-4xl font-bold mt-2 ${color}`}>{s.reunioesRealizadas}</p>
                  <p className="text-zinc-500 text-xs mt-1">reuniões</p>
                  <p className="text-zinc-400 text-xs mt-1">{s.leads} leads · {s.conversao.toFixed(0)}% conv.</p>
                </div>
              );
            })}
          </div>

          {rest.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-zinc-800 flex-1">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900">
                  <tr>
                    <th className="text-left px-4 py-3 text-zinc-400 font-medium">SDR</th>
                    <th className="text-right px-4 py-3 text-zinc-400 font-medium">Leads</th>
                    <th className="text-right px-4 py-3 text-zinc-400 font-medium">Reuniões</th>
                    <th className="text-right px-4 py-3 text-zinc-400 font-medium">Conversão</th>
                  </tr>
                </thead>
                <tbody>
                  {rest.map((s, i) => (
                    <tr key={s.sdrId} className={i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/50"}>
                      <td className="px-4 py-3 font-medium">{s.sdr}</td>
                      <td className="px-4 py-3 text-right text-zinc-300">{s.leads}</td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-semibold">{s.reunioesRealizadas}</td>
                      <td className="px-4 py-3 text-right text-zinc-300">{s.conversao.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/fechamento-semanal/SlideRankingClosers.tsx client/src/components/fechamento-semanal/SlideRankingSDRs.tsx
git commit -m "feat(slides): add SlideRankingClosers and SlideRankingSDRs

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Slide 7 (Novos Contratos) + Slide 8 (Saúde dos Squads)

**Files:**
- Criar: `client/src/components/fechamento-semanal/SlideNovosContratos.tsx`
- Criar: `client/src/components/fechamento-semanal/SlideSaudeSquads.tsx`

- [ ] **Step 1: Criar SlideNovosContratos.tsx**

```tsx
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyCompact } from "@/lib/utils";
import type { SlideProps } from "@/pages/FechamentoSemanal";

interface NovoContrato {
  id: string;
  contratoNome: string;
  clienteNome: string;
  produto: string;
  squad: string;
  csResponsavel: string;
  vendedor: string;
  valorMrr: number;
  dataInicio: string;
}

export default function SlideNovosContratos({ semanaInicio, semanaFim }: SlideProps) {
  const { data, isLoading } = useQuery<NovoContrato[]>({
    queryKey: ["/api/fechamento-semanal/novos-contratos", { semanaInicio, semanaFim }],
    queryFn: async () => {
      const res = await fetch(
        `/api/fechamento-semanal/novos-contratos?semanaInicio=${semanaInicio}&semanaFim=${semanaFim}`,
        { credentials: "include" }
      );
      return res.json();
    },
  });

  const totalMrr = data?.reduce((sum, c) => sum + c.valorMrr, 0) ?? 0;

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-white px-16 py-16">
      <div className="flex items-baseline gap-6 mb-8">
        <h2 className="text-3xl font-bold text-zinc-300">Novos Contratos</h2>
        {data && data.length > 0 && (
          <span className="text-2xl font-bold text-emerald-400">
            +{formatCurrencyCompact(totalMrr)} MRR
          </span>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full bg-zinc-800" />
      ) : !data || data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-500 text-xl">Nenhum contrato novo nesta semana</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800 flex-1">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900">
              <tr>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Cliente</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Produto</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Squad</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">CS</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">MRR</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c, i) => (
                <tr key={c.id} className={i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/50"}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-600 text-white text-xs px-1.5 py-0 shrink-0">NOVO</Badge>
                      <span className="font-medium">{c.clienteNome}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{c.produto}</td>
                  <td className="px-4 py-3 text-zinc-400">{c.squad}</td>
                  <td className="px-4 py-3 text-zinc-400">{c.csResponsavel}</td>
                  <td className="px-4 py-3 text-right text-emerald-400 font-bold">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(c.valorMrr)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Criar SlideSaudeSquads.tsx**

```tsx
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyCompact } from "@/lib/utils";
import type { SlideProps } from "@/pages/FechamentoSemanal";

interface SquadSaude {
  squad: string;
  mrr: number;
  clientes: number;
  contratos: number;
  churns: number;
  mrrPerdido: number;
  churnRate: number;
  saude: "verde" | "amarelo" | "vermelho";
}

const SAUDE_DOT: Record<string, string> = {
  verde: "bg-emerald-500",
  amarelo: "bg-yellow-400",
  vermelho: "bg-red-500",
};

export default function SlideSaudeSquads({ semanaInicio, semanaFim }: SlideProps) {
  const { data, isLoading } = useQuery<SquadSaude[]>({
    queryKey: ["/api/fechamento-semanal/saude-squads", { semanaInicio, semanaFim }],
    queryFn: async () => {
      const res = await fetch(
        `/api/fechamento-semanal/saude-squads?semanaInicio=${semanaInicio}&semanaFim=${semanaFim}`,
        { credentials: "include" }
      );
      return res.json();
    },
  });

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-white px-16 py-16">
      <h2 className="text-3xl font-bold text-zinc-300 mb-8">Saúde dos Squads</h2>

      {isLoading ? (
        <Skeleton className="h-48 w-full bg-zinc-800" />
      ) : !data || data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-500 text-xl">Sem dados de squads disponíveis</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800 flex-1">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900">
              <tr>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Squad</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">MRR</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">Clientes</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">Churns</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">MRR Perdido</th>
                <th className="text-center px-4 py-3 text-zinc-400 font-medium">Saúde</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s, i) => (
                <tr key={s.squad} className={i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/50"}>
                  <td className="px-4 py-3 font-medium">{s.squad}</td>
                  <td className="px-4 py-3 text-right text-emerald-400 font-semibold">{formatCurrencyCompact(s.mrr)}</td>
                  <td className="px-4 py-3 text-right text-zinc-300">{s.clientes}</td>
                  <td className="px-4 py-3 text-right text-zinc-300">{s.churns}</td>
                  <td className="px-4 py-3 text-right text-red-400">
                    {s.mrrPerdido > 0 ? formatCurrencyCompact(s.mrrPerdido) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <span className={`w-3 h-3 rounded-full ${SAUDE_DOT[s.saude]}`} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/fechamento-semanal/SlideNovosContratos.tsx client/src/components/fechamento-semanal/SlideSaudeSquads.tsx
git commit -m "feat(slides): add SlideNovosContratos and SlideSaudeSquads

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Verificação e Teste no Browser

**Files:** Nenhum (verificação)

- [ ] **Step 1: Reiniciar servidor**

```bash
lsof -ti:3000 | xargs kill -9; npm run dev
```

- [ ] **Step 2: Abrir no browser**

Navegue para `http://localhost:3000/presentation/fechamento-semanal`.

Verificar:
- [ ] Tela de setup aparece com seletor de semana
- [ ] Navegação `‹ ›` de semana funciona
- [ ] Botão "Apresentar" abre fullscreen (ou navega se fullscreen não disponível)
- [ ] Slides navegam com teclado `←/→`
- [ ] Setas laterais aparecem e funcionam
- [ ] Bolinhas de progresso clicáveis funcionam
- [ ] `Esc` fecha a apresentação
- [ ] Sidebar tem o novo ícone de CalendarCheck

- [ ] **Step 3: Verificar cada slide individualmente**

Clique em cada slide na lista da tela de setup e verifique:
- Slide 1 (Capa): logo + título + período
- Slide 2 (MRR): número grande + gráfico de área
- Slide 3 (Churn): cards + tabela (ou mensagem vazia)
- Slide 4 (Inadimplência): total em aberto + barras de faixa + top devedores
- Slide 5 (Closers): pódio top 3 + tabela
- Slide 6 (SDRs): pódio top 3 + tabela
- Slide 7 (Novos Contratos): tabela com badge NOVO
- Slide 8 (Squads): tabela com semáforo de saúde

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "feat(fechamento-semanal): complete weekly closing slideshow

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Notas de Implementação

- `formatCurrencyCompact` vem de `@/lib/utils` — já existe no projeto
- `turboLogo` está em `@assets/logo-branca.png` — confirmar nome exato com `ls client/src/assets/`
- A `SlideProps` interface é exportada de `FechamentoSemanal.tsx` e importada nos slides
- O `isPresentationMode` no App.tsx controla se o sidebar é renderizado — sem isso a sidebar aparece em cima dos slides
- Para o slide de inadimplência, os campos `diasAtrasoMedio` e `totalDevido` dependem do shape retornado por `storage.getInadimplenciaClientes` — se os campos tiverem nomes diferentes (ex: `total_devido`), ajustar no componente
