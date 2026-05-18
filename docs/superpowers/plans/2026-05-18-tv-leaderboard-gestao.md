# TV Leaderboard de Gestão — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir um dashboard gamificado em modo TV (fullscreen, dark, sem sidebar) que alterna a cada 30s entre uma tela de squads (MRR/NRR/Churn + meta 25MM) e uma tela de rankings individuais (pódio top 3 + lista 4º–10º para MRR, NRR e Anti-churn).

**Architecture:** Nova rota `/gestao/tv-leaderboard` em React + Wouter. Página renderiza fullscreen (sem `AppShell`/sidebar) com um `<TvRotator>` que faz cross-fade entre `<TelaSquads>` e `<TelaPessoas>`. Dados consumidos via React Query reaproveitando endpoints existentes (`/api/analise-squads`, `/api/analytics/nrr`, `/api/churn-por-responsavel`, `/api/visao-geral/mrr-evolucao`, `/api/analise-squads/detalhe`, `/api/contribuicao-squad/ranking`). Componentes pequenos e focados; `RankingColuna` é genérico parametrizado por métrica.

**Tech Stack:** React 18, TypeScript, Wouter (routing), Tailwind CSS, React Query, Recharts (sparklines), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-05-18-tv-leaderboard-gestao-design.md`

---

## File Structure

**Criar:**
- `client/src/pages/gestao/TvLeaderboard.tsx` — rota e composição (fullscreen, dark, monta `<TvRotator>`)
- `client/src/components/tv-leaderboard/TvRotator.tsx` — alterna telas + barra de progresso
- `client/src/components/tv-leaderboard/TelaSquads.tsx` — composição da tela 1
- `client/src/components/tv-leaderboard/TelaPessoas.tsx` — composição da tela 2
- `client/src/components/tv-leaderboard/MetaFaturamentoHero.tsx` — gauge 25MM
- `client/src/components/tv-leaderboard/SquadKpiCard.tsx` — card por squad
- `client/src/components/tv-leaderboard/SquadPodium.tsx` — pódio horizontal squads
- `client/src/components/tv-leaderboard/RankingColuna.tsx` — coluna genérica (MRR/NRR/Churn)
- `client/src/components/tv-leaderboard/PodiumTop3.tsx` — pódio top 3 com avatares
- `client/src/components/tv-leaderboard/RankingListaItem.tsx` — item 4º–10º
- `client/src/components/tv-leaderboard/types.ts` — tipos compartilhados
- `client/src/hooks/useTvLeaderboardData.ts` — hook agregador
- `client/src/components/tv-leaderboard/__tests__/TvRotator.test.tsx` — teste de rotação
- `client/src/components/tv-leaderboard/__tests__/RankingColuna.test.tsx` — smoke test

**Modificar:**
- `client/src/App.tsx` — adicionar a rota e ajustar layout para não renderizar sidebar nessa rota
- `shared/nav-config.ts` — adicionar item de menu "TV Leaderboard" no grupo Gestão e nova permission key
- `shared/permission-defaults.ts` (se existir) — habilitar permissão por padrão para admin/gestor

---

## Task 1: Tipos compartilhados e permission key

**Files:**
- Create: `client/src/components/tv-leaderboard/types.ts`
- Modify: `shared/nav-config.ts`

- [ ] **Step 1: Criar arquivo de tipos**

```ts
// client/src/components/tv-leaderboard/types.ts
export type SquadKpi = {
  squad: string;
  cor: string;
  mrrAtivo: number;
  nrrPct: number;
  nrrDeltaPct: number;
  churnValor: number;
  churnPct: number;
  sparkline: number[];
  badges: Array<'crescimento' | 'menor-churn' | 'meta'>;
};

export type SquadCrescimento = {
  squad: string;
  cor: string;
  delta: number;
  posicao: 1 | 2 | 3;
};

export type MetaFaturamento = {
  realizadoYtd: number;
  meta: number;
  pctAtingido: number;
  ritmoNecessarioDia: number;
  status: 'no-ritmo' | 'atras' | 'critico';
};

export type RankingPessoa = {
  id: string;
  nome: string;
  avatarUrl: string | null;
  squad: string;
  corSquad: string;
  valor: number;
  posicaoAtual: number;
  posicaoAnterior: number | null;
};

export type RankingMetrica = 'mrr' | 'nrr' | 'anti-churn';

export type TvLeaderboardData = {
  meta: MetaFaturamento;
  squads: SquadKpi[];
  crescimentoSquads: SquadCrescimento[];
  rankingMrr: RankingPessoa[];
  rankingNrr: RankingPessoa[];
  rankingAntiChurn: RankingPessoa[];
};
```

- [ ] **Step 2: Adicionar permission key**

Em `shared/nav-config.ts`, dentro do bloco `GESTAO` do `PERMISSION_KEYS`, adicionar:

```ts
TV_LEADERBOARD: 'gestao.tv_leaderboard',
```

- [ ] **Step 3: Adicionar item no menu Gestão**

Em `shared/nav-config.ts`, no array `items` da categoria `'Gestão'` (linhas 442–453), adicionar como último item:

```ts
{ title: 'TV Leaderboard', url: '/gestao/tv-leaderboard', icon: 'Tv', permissionKey: PERMISSION_KEYS.GESTAO.TV_LEADERBOARD },
```

- [ ] **Step 4: Commit**

```bash
git add client/src/components/tv-leaderboard/types.ts shared/nav-config.ts
git commit -m "feat(tv-leaderboard): tipos compartilhados e item de menu"
```

---

## Task 2: Hook agregador `useTvLeaderboardData` (mock-first)

Para destravar a UI sem depender da forma final dos endpoints, este hook começa retornando dados mockados determinísticos e expõe a mesma interface que será preenchida na Task 9 com queries reais.

**Files:**
- Create: `client/src/hooks/useTvLeaderboardData.ts`
- Create: `client/src/hooks/__tests__/useTvLeaderboardData.test.ts`

- [ ] **Step 1: Escrever teste do shape do retorno**

```ts
// client/src/hooks/__tests__/useTvLeaderboardData.test.ts
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTvLeaderboardData } from '../useTvLeaderboardData';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useTvLeaderboardData', () => {
  it('retorna data com todas as seções do dashboard', () => {
    const { result } = renderHook(() => useTvLeaderboardData(), { wrapper });
    expect(result.current.data).toBeDefined();
    expect(result.current.data!.meta).toBeDefined();
    expect(result.current.data!.squads.length).toBeGreaterThan(0);
    expect(result.current.data!.rankingMrr.length).toBeGreaterThan(0);
    expect(result.current.data!.rankingNrr.length).toBeGreaterThan(0);
    expect(result.current.data!.rankingAntiChurn.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Rodar teste e verificar falha**

Run: `npx vitest run client/src/hooks/__tests__/useTvLeaderboardData.test.ts`
Expected: FAIL com "Cannot find module '../useTvLeaderboardData'"

- [ ] **Step 3: Implementar hook com dados mockados**

```ts
// client/src/hooks/useTvLeaderboardData.ts
import { useQuery } from '@tanstack/react-query';
import type { TvLeaderboardData } from '@/components/tv-leaderboard/types';

const MOCK: TvLeaderboardData = {
  meta: {
    realizadoYtd: 9_800_000,
    meta: 25_000_000,
    pctAtingido: 39.2,
    ritmoNecessarioDia: 65_000,
    status: 'atras',
  },
  squads: [
    {
      squad: 'Squad A',
      cor: '#3b82f6',
      mrrAtivo: 580_000,
      nrrPct: 108.2,
      nrrDeltaPct: 1.4,
      churnValor: 12_000,
      churnPct: 2.1,
      sparkline: [510, 520, 540, 560, 570, 580],
      badges: ['crescimento'],
    },
    {
      squad: 'Squad B',
      cor: '#ef4444',
      mrrAtivo: 430_000,
      nrrPct: 102.5,
      nrrDeltaPct: -0.6,
      churnValor: 9_000,
      churnPct: 2.0,
      sparkline: [420, 410, 415, 425, 428, 430],
      badges: ['menor-churn'],
    },
  ],
  crescimentoSquads: [
    { squad: 'Squad A', cor: '#3b82f6', delta: 18_000, posicao: 1 },
    { squad: 'Squad B', cor: '#ef4444', delta: 5_000, posicao: 2 },
    { squad: 'Squad C', cor: '#10b981', delta: 1_500, posicao: 3 },
  ],
  rankingMrr: makeMockRanking('mrr'),
  rankingNrr: makeMockRanking('nrr'),
  rankingAntiChurn: makeMockRanking('anti-churn'),
};

function makeMockRanking(prefix: string) {
  return Array.from({ length: 10 }, (_, i) => ({
    id: `${prefix}-${i + 1}`,
    nome: `Pessoa ${i + 1}`,
    avatarUrl: null,
    squad: i % 2 === 0 ? 'Squad A' : 'Squad B',
    corSquad: i % 2 === 0 ? '#3b82f6' : '#ef4444',
    valor: 100_000 - i * 7_500,
    posicaoAtual: i + 1,
    posicaoAnterior: i === 0 ? 2 : i === 1 ? 1 : i + 1,
  }));
}

export function useTvLeaderboardData() {
  return useQuery<TvLeaderboardData>({
    queryKey: ['tv-leaderboard'],
    queryFn: async () => MOCK,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 4: Rodar teste e verificar passa**

Run: `npx vitest run client/src/hooks/__tests__/useTvLeaderboardData.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/hooks/useTvLeaderboardData.ts client/src/hooks/__tests__/useTvLeaderboardData.test.ts
git commit -m "feat(tv-leaderboard): hook agregador com dados mockados"
```

---

## Task 3: `TvRotator` com troca automática a cada 30s

**Files:**
- Create: `client/src/components/tv-leaderboard/TvRotator.tsx`
- Create: `client/src/components/tv-leaderboard/__tests__/TvRotator.test.tsx`

- [ ] **Step 1: Escrever teste de rotação com fake timers**

```tsx
// client/src/components/tv-leaderboard/__tests__/TvRotator.test.tsx
import { render, screen, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { TvRotator } from '../TvRotator';

describe('TvRotator', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renderiza a primeira tela inicialmente', () => {
    render(<TvRotator screens={[<div>Tela A</div>, <div>Tela B</div>]} intervalMs={30000} />);
    expect(screen.getByText('Tela A')).toBeInTheDocument();
    expect(screen.queryByText('Tela B')).not.toBeInTheDocument();
  });

  it('alterna para a próxima tela após o intervalo', () => {
    render(<TvRotator screens={[<div>Tela A</div>, <div>Tela B</div>]} intervalMs={30000} />);
    act(() => { vi.advanceTimersByTime(30000); });
    expect(screen.getByText('Tela B')).toBeInTheDocument();
    expect(screen.queryByText('Tela A')).not.toBeInTheDocument();
  });

  it('volta para a primeira tela ao concluir o ciclo', () => {
    render(<TvRotator screens={[<div>Tela A</div>, <div>Tela B</div>]} intervalMs={30000} />);
    act(() => { vi.advanceTimersByTime(60000); });
    expect(screen.getByText('Tela A')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar teste e verificar falha**

Run: `npx vitest run client/src/components/tv-leaderboard/__tests__/TvRotator.test.tsx`
Expected: FAIL com "Cannot find module '../TvRotator'"

- [ ] **Step 3: Implementar `TvRotator`**

```tsx
// client/src/components/tv-leaderboard/TvRotator.tsx
import { useEffect, useState, type ReactNode } from 'react';

type Props = { screens: ReactNode[]; intervalMs?: number };

export function TvRotator({ screens, intervalMs = 30000 }: Props) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (screens.length <= 1) return;
    const tick = 100;
    let elapsed = 0;
    const id = setInterval(() => {
      elapsed += tick;
      setProgress(Math.min(100, (elapsed / intervalMs) * 100));
      if (elapsed >= intervalMs) {
        setIndex((i) => (i + 1) % screens.length);
        elapsed = 0;
        setProgress(0);
      }
    }, tick);
    return () => clearInterval(id);
  }, [intervalMs, screens.length]);

  return (
    <div className="relative h-full w-full">
      <div key={index} className="h-full w-full animate-[fadeIn_400ms_ease-in-out]">
        {screens[index]}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800">
        <div
          className="h-full bg-primary transition-all duration-100"
          style={{ width: `${progress}%` }}
          aria-hidden
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rodar testes e verificar passam**

Run: `npx vitest run client/src/components/tv-leaderboard/__tests__/TvRotator.test.tsx`
Expected: PASS (3 testes)

- [ ] **Step 5: Adicionar keyframe `fadeIn` em `tailwind.config.ts` se ainda não existir**

Procurar no arquivo `tailwind.config.ts` a chave `keyframes`. Se `fadeIn` não estiver lá, adicionar:

```ts
fadeIn: {
  '0%': { opacity: '0' },
  '100%': { opacity: '1' },
},
```

Se a chave `keyframes` não existir dentro de `theme.extend`, criar:

```ts
theme: {
  extend: {
    keyframes: {
      fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
    },
  },
},
```

- [ ] **Step 6: Commit**

```bash
git add client/src/components/tv-leaderboard/TvRotator.tsx client/src/components/tv-leaderboard/__tests__/TvRotator.test.tsx tailwind.config.ts
git commit -m "feat(tv-leaderboard): TvRotator com troca a cada 30s"
```

---

## Task 4: `MetaFaturamentoHero` (gauge 25MM)

**Files:**
- Create: `client/src/components/tv-leaderboard/MetaFaturamentoHero.tsx`

- [ ] **Step 1: Implementar componente**

```tsx
// client/src/components/tv-leaderboard/MetaFaturamentoHero.tsx
import type { MetaFaturamento } from './types';

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const STATUS_COLORS = {
  'no-ritmo': 'bg-emerald-500',
  atras: 'bg-amber-500',
  critico: 'bg-red-500',
} as const;

const STATUS_LABEL = {
  'no-ritmo': 'NO RITMO',
  atras: 'ATRÁS DA META',
  critico: 'CRÍTICO',
} as const;

export function MetaFaturamentoHero({ data }: { data: MetaFaturamento }) {
  const pct = Math.min(100, data.pctAtingido);
  const cor = STATUS_COLORS[data.status];

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-zinc-900 border border-zinc-800 p-8 h-full">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-zinc-400 text-lg uppercase tracking-wider">Faturamento YTD</div>
          <div className="text-white text-7xl font-bold leading-tight">{fmtBRL(data.realizadoYtd)}</div>
        </div>
        <div className="text-right">
          <div className="text-zinc-400 text-lg uppercase tracking-wider">Meta 2026</div>
          <div className="text-zinc-200 text-4xl font-semibold">{fmtBRL(data.meta)}</div>
        </div>
      </div>

      <div className="relative h-12 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={`h-full ${cor} transition-[width] duration-700`}
          style={{ width: `${pct}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-white text-2xl font-bold drop-shadow">
          {pct.toFixed(1)}%
        </div>
      </div>

      <div className="flex items-center justify-between text-lg">
        <span className={`px-3 py-1 rounded-full font-bold text-white ${cor}`}>
          {STATUS_LABEL[data.status]}
        </span>
        <span className="text-zinc-300">
          Ritmo necessário/dia: <span className="font-bold text-white">{fmtBRL(data.ritmoNecessarioDia)}</span>
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/tv-leaderboard/MetaFaturamentoHero.tsx
git commit -m "feat(tv-leaderboard): hero gauge faturamento vs meta 25MM"
```

---

## Task 5: `SquadKpiCard` (card por squad)

**Files:**
- Create: `client/src/components/tv-leaderboard/SquadKpiCard.tsx`

- [ ] **Step 1: Implementar componente**

```tsx
// client/src/components/tv-leaderboard/SquadKpiCard.tsx
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import type { SquadKpi } from './types';

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const BADGE_LABEL: Record<NonNullable<SquadKpi['badges'][number]>, string> = {
  crescimento: '🚀 Maior crescimento',
  'menor-churn': '🛡️ Menor churn',
  meta: '🎯 Bateu meta',
};

export function SquadKpiCard({ kpi, isLider }: { kpi: SquadKpi; isLider: boolean }) {
  const seta = kpi.nrrDeltaPct >= 0 ? '⬆️' : '⬇️';
  const churnAcimaMeta = kpi.churnPct > 3;

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border bg-zinc-900 p-5 h-full transition-shadow ${
        isLider ? 'border-2 shadow-[0_0_30px_rgba(59,130,246,0.4)] animate-pulse' : 'border-zinc-800'
      }`}
      style={{ borderColor: isLider ? kpi.cor : undefined }}
    >
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: kpi.cor }} />
        <span className="text-white font-bold text-xl">{kpi.squad}</span>
      </div>

      <div>
        <div className="text-zinc-400 text-xs uppercase">MRR Ativo</div>
        <div className="text-white text-5xl font-bold">{fmtBRL(kpi.mrrAtivo)}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-zinc-400 text-xs uppercase">NRR</div>
          <div className="text-white text-2xl font-bold">
            {kpi.nrrPct.toFixed(1)}% <span className="text-base">{seta}</span>
          </div>
        </div>
        <div>
          <div className="text-zinc-400 text-xs uppercase">Churn</div>
          <div className={`text-2xl font-bold ${churnAcimaMeta ? 'text-red-400' : 'text-white'}`}>
            {kpi.churnPct.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="h-10 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={kpi.sparkline.map((v, i) => ({ i, v }))}>
            <Line type="monotone" dataKey="v" stroke={kpi.cor} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-1">
        {kpi.badges.map((b) => (
          <span key={b} className="text-xs bg-zinc-800 text-zinc-200 px-2 py-1 rounded">
            {BADGE_LABEL[b]}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/tv-leaderboard/SquadKpiCard.tsx
git commit -m "feat(tv-leaderboard): card de KPI por squad"
```

---

## Task 6: `SquadPodium` (pódio horizontal de squads por crescimento)

**Files:**
- Create: `client/src/components/tv-leaderboard/SquadPodium.tsx`

- [ ] **Step 1: Implementar componente**

```tsx
// client/src/components/tv-leaderboard/SquadPodium.tsx
import type { SquadCrescimento } from './types';

const MEDALHAS = { 1: '🥇', 2: '🥈', 3: '🥉' } as const;
const ALTURAS = { 1: 'h-24', 2: 'h-20', 3: 'h-16' } as const;
const ORDEM_VISUAL = [2, 1, 3] as const; // 2º à esquerda, 1º no meio, 3º à direita

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function SquadPodium({ squads }: { squads: SquadCrescimento[] }) {
  const porPosicao = new Map(squads.map((s) => [s.posicao, s]));

  return (
    <div className="flex items-end justify-center gap-6 h-full">
      {ORDEM_VISUAL.map((pos) => {
        const s = porPosicao.get(pos);
        if (!s) return null;
        return (
          <div key={pos} className="flex flex-col items-center gap-2 min-w-[180px]">
            <div className="text-3xl">{MEDALHAS[pos]}</div>
            <div className="text-white font-bold text-xl">{s.squad}</div>
            <div className="text-emerald-400 text-2xl font-bold">+{fmtBRL(s.delta)}</div>
            <div
              className={`w-full rounded-t-xl ${ALTURAS[pos]}`}
              style={{ backgroundColor: s.cor, opacity: 0.85 }}
            />
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/tv-leaderboard/SquadPodium.tsx
git commit -m "feat(tv-leaderboard): pódio de crescimento de squads"
```

---

## Task 7: `TelaSquads` (composição da tela 1)

**Files:**
- Create: `client/src/components/tv-leaderboard/TelaSquads.tsx`

- [ ] **Step 1: Implementar composição**

```tsx
// client/src/components/tv-leaderboard/TelaSquads.tsx
import { MetaFaturamentoHero } from './MetaFaturamentoHero';
import { SquadKpiCard } from './SquadKpiCard';
import { SquadPodium } from './SquadPodium';
import type { TvLeaderboardData } from './types';

export function TelaSquads({ data }: { data: TvLeaderboardData }) {
  const ordenadas = [...data.squads].sort((a, b) => b.mrrAtivo - a.mrrAtivo);
  const liderId = ordenadas[0]?.squad;

  return (
    <div className="grid grid-rows-[30%_50%_20%] h-full gap-4 p-6 bg-zinc-950">
      <MetaFaturamentoHero data={data.meta} />

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${ordenadas.length}, minmax(0, 1fr))` }}
      >
        {ordenadas.map((s) => (
          <SquadKpiCard key={s.squad} kpi={s} isLider={s.squad === liderId} />
        ))}
      </div>

      <SquadPodium squads={data.crescimentoSquads} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/tv-leaderboard/TelaSquads.tsx
git commit -m "feat(tv-leaderboard): composição da tela 1 (squads)"
```

---

## Task 8: `PodiumTop3`, `RankingListaItem`, `RankingColuna` e `TelaPessoas`

**Files:**
- Create: `client/src/components/tv-leaderboard/PodiumTop3.tsx`
- Create: `client/src/components/tv-leaderboard/RankingListaItem.tsx`
- Create: `client/src/components/tv-leaderboard/RankingColuna.tsx`
- Create: `client/src/components/tv-leaderboard/TelaPessoas.tsx`
- Create: `client/src/components/tv-leaderboard/__tests__/RankingColuna.test.tsx`

- [ ] **Step 1: Implementar `PodiumTop3`**

```tsx
// client/src/components/tv-leaderboard/PodiumTop3.tsx
import type { RankingPessoa, RankingMetrica } from './types';

const MEDALHAS = { 1: '🥇', 2: '🥈', 3: '🥉' } as const;

function iniciais(nome: string) {
  return nome.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

function formatValor(metrica: RankingMetrica, valor: number) {
  if (metrica === 'nrr') return `${valor.toFixed(1)}%`;
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export function PodiumTop3({
  top3,
  metrica,
}: {
  top3: RankingPessoa[];
  metrica: RankingMetrica;
}) {
  const ordem = [top3[1], top3[0], top3[2]].filter(Boolean); // 2º, 1º, 3º
  return (
    <div className="flex items-end justify-center gap-3 mb-4">
      {ordem.map((p) => {
        const pos = p.posicaoAtual as 1 | 2 | 3;
        const isLider = pos === 1;
        const tamanho = isLider ? 'h-24 w-24 text-3xl' : 'h-16 w-16 text-xl';
        return (
          <div key={p.id} className="flex flex-col items-center gap-1 min-w-[100px]">
            <div className="text-2xl">{MEDALHAS[pos]}</div>
            <div
              className={`rounded-full flex items-center justify-center font-bold text-white ${tamanho} ${
                isLider ? 'ring-4 ring-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.6)]' : ''
              }`}
              style={{ backgroundColor: p.corSquad }}
              aria-label={p.nome}
            >
              {p.avatarUrl ? (
                <img src={p.avatarUrl} alt={p.nome} className="h-full w-full rounded-full object-cover" />
              ) : (
                iniciais(p.nome)
              )}
            </div>
            <div className={`text-white font-bold text-center ${isLider ? 'text-lg' : 'text-sm'}`}>
              {p.nome}
            </div>
            <div className={`font-bold ${isLider ? 'text-amber-400 text-2xl' : 'text-zinc-300 text-lg'}`}>
              {formatValor(metrica, p.valor)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Implementar `RankingListaItem`**

```tsx
// client/src/components/tv-leaderboard/RankingListaItem.tsx
import type { RankingPessoa, RankingMetrica } from './types';

function formatValor(metrica: RankingMetrica, valor: number) {
  if (metrica === 'nrr') return `${valor.toFixed(1)}%`;
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function variacao(p: RankingPessoa) {
  if (p.posicaoAnterior == null) return { txt: 'novo', cor: 'text-zinc-400' };
  const diff = p.posicaoAnterior - p.posicaoAtual;
  if (diff > 0) return { txt: `▲${diff}`, cor: 'text-emerald-400' };
  if (diff < 0) return { txt: `▼${-diff}`, cor: 'text-red-400' };
  return { txt: '=', cor: 'text-zinc-400' };
}

function iniciais(nome: string) {
  return nome.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

export function RankingListaItem({
  pessoa,
  metrica,
}: {
  pessoa: RankingPessoa;
  metrica: RankingMetrica;
}) {
  const v = variacao(pessoa);
  return (
    <li className="flex items-center gap-3 py-2 border-b border-zinc-800">
      <span className="text-zinc-500 w-6 text-right font-bold">{pessoa.posicaoAtual}</span>
      <span
        className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
        style={{ backgroundColor: pessoa.corSquad }}
        aria-hidden
      >
        {pessoa.avatarUrl ? (
          <img src={pessoa.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
        ) : (
          iniciais(pessoa.nome)
        )}
      </span>
      <span className="flex-1 text-white truncate">{pessoa.nome}</span>
      <span
        className="text-xs px-2 py-0.5 rounded-full text-white"
        style={{ backgroundColor: pessoa.corSquad }}
      >
        {pessoa.squad}
      </span>
      <span className={`text-sm w-12 text-right ${v.cor}`}>{v.txt}</span>
      <span className="text-white font-bold w-28 text-right">{formatValor(metrica, pessoa.valor)}</span>
    </li>
  );
}
```

- [ ] **Step 3: Implementar `RankingColuna`**

```tsx
// client/src/components/tv-leaderboard/RankingColuna.tsx
import { PodiumTop3 } from './PodiumTop3';
import { RankingListaItem } from './RankingListaItem';
import type { RankingPessoa, RankingMetrica } from './types';

export function RankingColuna({
  titulo,
  icone,
  ranking,
  metrica,
}: {
  titulo: string;
  icone: string;
  ranking: RankingPessoa[];
  metrica: RankingMetrica;
}) {
  const top3 = ranking.slice(0, 3);
  const resto = ranking.slice(3, 10);

  return (
    <section className="flex flex-col rounded-2xl bg-zinc-900 border border-zinc-800 p-5 h-full">
      <header className="flex items-center gap-2 mb-4">
        <span className="text-2xl" aria-hidden>{icone}</span>
        <h2 className="text-white text-xl font-bold uppercase tracking-wider">{titulo}</h2>
      </header>
      <PodiumTop3 top3={top3} metrica={metrica} />
      <ul className="flex-1 overflow-hidden">
        {resto.map((p) => (
          <RankingListaItem key={p.id} pessoa={p} metrica={metrica} />
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Escrever smoke test de `RankingColuna`**

```tsx
// client/src/components/tv-leaderboard/__tests__/RankingColuna.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RankingColuna } from '../RankingColuna';
import type { RankingPessoa } from '../types';

const fakePessoa = (i: number): RankingPessoa => ({
  id: `p-${i}`,
  nome: `Pessoa ${i}`,
  avatarUrl: null,
  squad: 'Squad A',
  corSquad: '#3b82f6',
  valor: 1000 - i * 100,
  posicaoAtual: i,
  posicaoAnterior: i,
});

describe('RankingColuna', () => {
  it('renderiza top 3 no pódio e o restante na lista', () => {
    const ranking = Array.from({ length: 10 }, (_, i) => fakePessoa(i + 1));
    render(<RankingColuna titulo="MRR" icone="💰" ranking={ranking} metrica="mrr" />);
    expect(screen.getByText('MRR')).toBeInTheDocument();
    expect(screen.getByText('Pessoa 1')).toBeInTheDocument();
    expect(screen.getByText('Pessoa 4')).toBeInTheDocument();
    expect(screen.getByText('Pessoa 10')).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Rodar teste e verificar passa**

Run: `npx vitest run client/src/components/tv-leaderboard/__tests__/RankingColuna.test.tsx`
Expected: PASS

- [ ] **Step 6: Implementar `TelaPessoas`**

```tsx
// client/src/components/tv-leaderboard/TelaPessoas.tsx
import { RankingColuna } from './RankingColuna';
import type { TvLeaderboardData } from './types';

export function TelaPessoas({ data }: { data: TvLeaderboardData }) {
  return (
    <div className="flex flex-col h-full bg-zinc-950 p-6 gap-4">
      <header className="text-center">
        <h1 className="text-white text-3xl font-bold tracking-wider">
          RANKING INDIVIDUAL — MAIO/2026
        </h1>
      </header>
      <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
        <RankingColuna titulo="MRR" icone="💰" ranking={data.rankingMrr} metrica="mrr" />
        <RankingColuna titulo="NRR" icone="📈" ranking={data.rankingNrr} metrica="nrr" />
        <RankingColuna titulo="Anti-Churn" icone="🛡️" ranking={data.rankingAntiChurn} metrica="anti-churn" />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add client/src/components/tv-leaderboard/PodiumTop3.tsx client/src/components/tv-leaderboard/RankingListaItem.tsx client/src/components/tv-leaderboard/RankingColuna.tsx client/src/components/tv-leaderboard/TelaPessoas.tsx client/src/components/tv-leaderboard/__tests__/RankingColuna.test.tsx
git commit -m "feat(tv-leaderboard): tela de pessoas com 3 rankings gamificados"
```

---

## Task 9: Página `TvLeaderboard` + rota fullscreen

**Files:**
- Create: `client/src/pages/gestao/TvLeaderboard.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Implementar a página**

```tsx
// client/src/pages/gestao/TvLeaderboard.tsx
import { useEffect, useState } from 'react';
import { TvRotator } from '@/components/tv-leaderboard/TvRotator';
import { TelaSquads } from '@/components/tv-leaderboard/TelaSquads';
import { TelaPessoas } from '@/components/tv-leaderboard/TelaPessoas';
import { useTvLeaderboardData } from '@/hooks/useTvLeaderboardData';

function useRelogio() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function TvLeaderboard() {
  const now = useRelogio();
  const { data, isLoading, error, dataUpdatedAt } = useTvLeaderboardData();

  return (
    <div className="dark fixed inset-0 bg-zinc-950 text-white flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-6 py-3 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📺</span>
          <span className="text-zinc-300 text-lg uppercase tracking-wider">Forcell</span>
        </div>
        <div className="text-white text-xl font-semibold">
          {now.toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'medium' })}
        </div>
      </header>

      <main className="flex-1 min-h-0">
        {isLoading && (
          <div className="flex items-center justify-center h-full text-zinc-400 text-2xl">
            Carregando…
          </div>
        )}
        {error && !data && (
          <div className="flex items-center justify-center h-full text-red-400 text-2xl">
            Falha ao carregar dados
          </div>
        )}
        {data && (
          <TvRotator
            intervalMs={30000}
            screens={[<TelaSquads data={data} />, <TelaPessoas data={data} />]}
          />
        )}
      </main>

      {data && (
        <footer className="px-6 py-1 text-zinc-500 text-xs text-right">
          Última atualização: {new Date(dataUpdatedAt).toLocaleTimeString('pt-BR')}
        </footer>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Adicionar import lazy em `App.tsx`**

Em `client/src/App.tsx`, próximo à linha 73 onde `AnalisePreditiva` é importado, adicionar:

```ts
const TvLeaderboard = lazyWithRetry(() => import("@/pages/gestao/TvLeaderboard"));
```

- [ ] **Step 3: Registrar rota em `App.tsx`**

Em `client/src/App.tsx`, dentro do `<Switch>` do `ProtectedRouter` (após a linha 310, junto às rotas `/dashboard/*`), adicionar:

```tsx
<Route path="/gestao/tv-leaderboard">
  {() => <ProtectedRoute path="/gestao/tv-leaderboard" component={TvLeaderboard} />}
</Route>
```

**Importante:** A página renderiza `fixed inset-0` propositalmente para cobrir qualquer layout global (sidebar/topbar) e ocupar a TV inteira. Não envolver em `AppShell` adicional.

- [ ] **Step 4: Validar manualmente**

```bash
npm run dev
```

Abrir `http://localhost:3000/gestao/tv-leaderboard` e verificar:
- Header com data/hora atualizando a cada segundo
- Tela de squads renderiza primeiro com mock data
- Após 30s, troca para tela de pessoas
- Após mais 30s, volta para squads
- Barra de progresso no rodapé avança

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/gestao/TvLeaderboard.tsx client/src/App.tsx
git commit -m "feat(tv-leaderboard): página fullscreen com rotação automática"
```

---

## Task 10: Substituir dados mockados por queries reais

**Files:**
- Modify: `client/src/hooks/useTvLeaderboardData.ts`

Esta task descobre, em código, como agregar os dados reais a partir dos endpoints existentes. Antes de codar, fazer as chamadas via curl para confirmar formato.

- [ ] **Step 1: Sondar endpoints reais via curl**

Com o dev server rodando (`npm run dev`), abrir terminal autenticado (via cookie de sessão copiado do browser DevTools → Application → Cookies) ou usar o helper interno. Para cada endpoint, salvar uma amostra:

```bash
curl -s -b "connect.sid=<cookie>" "http://localhost:3000/api/analise-squads?periodo=mes-atual" | head -c 2000
curl -s -b "connect.sid=<cookie>" "http://localhost:3000/api/analytics/nrr" | head -c 2000
curl -s -b "connect.sid=<cookie>" "http://localhost:3000/api/churn-por-responsavel" | head -c 2000
curl -s -b "connect.sid=<cookie>" "http://localhost:3000/api/visao-geral/mrr-evolucao" | head -c 2000
curl -s -b "connect.sid=<cookie>" "http://localhost:3000/api/contribuicao-squad/ranking" | head -c 2000
curl -s -b "connect.sid=<cookie>" "http://localhost:3000/api/analise-squads/detalhe" | head -c 2000
```

Anotar o shape exato de cada resposta para uso no Step 2.

- [ ] **Step 2: Reescrever `useTvLeaderboardData` com queries reais**

Substituir o conteúdo do arquivo `client/src/hooks/useTvLeaderboardData.ts` por uma implementação que:

1. Usa `useQueries` do React Query para disparar em paralelo as 6 chamadas REST acima
2. Agrega o resultado num único `TvLeaderboardData` no `select` do hook
3. Mantém `staleTime: 5min` e `refetchInterval: 5min`
4. Para `crescimentoSquads`, calcula `delta = mrrAtivoMesAtual - mrrAtivoMesAnterior` por squad e pega top 3
5. Para `meta`, calcula `pctAtingido = realizadoYtd / meta * 100` e `status` baseado em `pctAtingido` vs `pctEsperadoNoDia` (`pctEsperado = (diaDoAno / 365) * 100`): no-ritmo ≥ pctEsperado, atras ≥ pctEsperado - 10, senão critico
6. Filtra `rankingNrr` para pessoas com `clientesAtivos >= 5` (campo deve vir de `/api/analise-squads/detalhe`)
7. `rankingAntiChurn` ordena por menor `churnValor` ascendente
8. Constante `META_FATURAMENTO_2026 = 25_000_000`

Template inicial (preencher campos conforme shapes reais coletados no Step 1):

```ts
// client/src/hooks/useTvLeaderboardData.ts
import { useQueries } from '@tanstack/react-query';
import type { TvLeaderboardData, RankingPessoa, SquadKpi, SquadCrescimento, MetaFaturamento } from '@/components/tv-leaderboard/types';

const META_FATURAMENTO_2026 = 25_000_000;
const MIN_CLIENTES_NRR = 5;

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

export function useTvLeaderboardData() {
  const results = useQueries({
    queries: [
      { queryKey: ['tv', 'squads'], queryFn: () => fetchJson<any>('/api/analise-squads?periodo=mes-atual'), staleTime: 5*60_000, refetchInterval: 5*60_000 },
      { queryKey: ['tv', 'nrr'], queryFn: () => fetchJson<any>('/api/analytics/nrr'), staleTime: 5*60_000, refetchInterval: 5*60_000 },
      { queryKey: ['tv', 'churn'], queryFn: () => fetchJson<any>('/api/churn-por-responsavel'), staleTime: 5*60_000, refetchInterval: 5*60_000 },
      { queryKey: ['tv', 'mrr-evolucao'], queryFn: () => fetchJson<any>('/api/visao-geral/mrr-evolucao'), staleTime: 5*60_000, refetchInterval: 5*60_000 },
      { queryKey: ['tv', 'ranking'], queryFn: () => fetchJson<any>('/api/contribuicao-squad/ranking'), staleTime: 5*60_000, refetchInterval: 5*60_000 },
      { queryKey: ['tv', 'detalhe'], queryFn: () => fetchJson<any>('/api/analise-squads/detalhe'), staleTime: 5*60_000, refetchInterval: 5*60_000 },
    ],
  });

  const isLoading = results.some((r) => r.isLoading);
  const error = results.find((r) => r.error)?.error;
  const dataUpdatedAt = Math.max(...results.map((r) => r.dataUpdatedAt));

  let data: TvLeaderboardData | undefined;
  if (results.every((r) => r.data)) {
    const [squadsRaw, nrrRaw, churnRaw, evolRaw, rankingRaw, detalheRaw] = results.map((r) => r.data);
    data = {
      meta: agregaMeta(evolRaw),
      squads: agregaSquads(squadsRaw, nrrRaw, churnRaw, evolRaw),
      crescimentoSquads: calculaCrescimentoSquads(evolRaw),
      rankingMrr: mapeiaRankingMrr(rankingRaw),
      rankingNrr: mapeiaRankingNrr(detalheRaw),
      rankingAntiChurn: mapeiaRankingAntiChurn(detalheRaw),
    };
  }

  return { data, isLoading, error, dataUpdatedAt };
}

// Implementar as funções abaixo após confirmar os shapes no Step 1:
function agregaMeta(evol: any): MetaFaturamento { /* ... */ throw new Error('preencher'); }
function agregaSquads(squads: any, nrr: any, churn: any, evol: any): SquadKpi[] { /* ... */ throw new Error('preencher'); }
function calculaCrescimentoSquads(evol: any): SquadCrescimento[] { /* ... */ throw new Error('preencher'); }
function mapeiaRankingMrr(r: any): RankingPessoa[] { /* ... */ throw new Error('preencher'); }
function mapeiaRankingNrr(d: any): RankingPessoa[] { /* ... */ throw new Error('preencher'); }
function mapeiaRankingAntiChurn(d: any): RankingPessoa[] { /* ... */ throw new Error('preencher'); }
```

Substituir cada `throw new Error('preencher')` com a transformação concreta a partir do shape real coletado no Step 1.

- [ ] **Step 3: Atualizar teste para usar `enabled: false` ou mock global de `fetch`**

Como o teste anterior validava apenas o shape, ajustá-lo para passar com `enabled: false`:

```ts
// client/src/hooks/__tests__/useTvLeaderboardData.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTvLeaderboardData } from '../useTvLeaderboardData';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useTvLeaderboardData', () => {
  it('agrega resposta dos endpoints num único objeto', async () => {
    global.fetch = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => fixtureFor(url),
    })) as any;

    const { result } = renderHook(() => useTvLeaderboardData(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data!.meta.meta).toBe(25_000_000);
    expect(result.current.data!.rankingMrr.length).toBeGreaterThan(0);
  });
});

function fixtureFor(url: string) {
  // Retornar um fixture mínimo coerente com o shape real coletado.
  // Preencher conforme as amostras do Step 1.
  return {};
}
```

Preencher `fixtureFor` com fixtures mínimos compatíveis com os shapes reais.

- [ ] **Step 4: Rodar testes**

Run: `npx vitest run client/src/hooks/__tests__/useTvLeaderboardData.test.ts`
Expected: PASS

- [ ] **Step 5: Validar manualmente no browser**

```bash
npm run dev
```

Abrir `http://localhost:3000/gestao/tv-leaderboard` e verificar:
- Dados reais carregam (não os mocks)
- Squads aparecem com seus nomes verdadeiros
- Faturamento YTD bate com o que aparece em `/visao-geral`
- Rankings têm nomes de colaboradores reais

- [ ] **Step 6: Commit**

```bash
git add client/src/hooks/useTvLeaderboardData.ts client/src/hooks/__tests__/useTvLeaderboardData.test.ts
git commit -m "feat(tv-leaderboard): plugar queries reais nos endpoints existentes"
```

---

## Task 11: Permissão por padrão e seed

**Files:**
- Modify: arquivo de defaults de permissão (descobrir no Step 1)

- [ ] **Step 1: Localizar onde permissões padrão são definidas**

```bash
grep -rn "gestao.analise_squads" shared server --include="*.ts" | head -10
grep -rn "PERMISSION_KEYS.GESTAO" server --include="*.ts" | head -10
```

Identificar o arquivo que mapeia roles → permissões (provavelmente `shared/permissions.ts` ou `server/permissions.ts`).

- [ ] **Step 2: Adicionar `gestao.tv_leaderboard` como permissão habilitada para `admin` e `gestor`**

No arquivo identificado, replicar o padrão usado por `gestao.analise_squads` e adicionar `gestao.tv_leaderboard` na mesma lista.

- [ ] **Step 3: Validar que o item aparece no menu lateral**

Reiniciar dev server (`lsof -ti:3000 | xargs kill -9 && npm run dev`), logar como admin, expandir Gestão na sidebar — deve aparecer "TV Leaderboard".

- [ ] **Step 4: Commit**

```bash
git add <arquivo-de-permissoes>
git commit -m "feat(tv-leaderboard): permissão padrão para admin/gestor"
```

---

## Task 12: Polimento visual e checagem em TV real

**Files:**
- Modify: `client/src/components/tv-leaderboard/*` conforme necessário

- [ ] **Step 1: Validar em 1920×1080**

No browser, abrir DevTools, ativar device emulation com resolução 1920×1080, verificar:
- Nenhum texto cortado
- Nenhum scroll
- Sparklines visíveis em todos os squad cards
- Pódios visualmente equilibrados

- [ ] **Step 2: Validar em TV física (se disponível)**

Conectar máquina na TV da operação, abrir Chrome em fullscreen (F11) na rota, observar por 2 ciclos completos (≥ 60s). Conferir:
- Legibilidade do texto a 3+ metros
- Cores não estouradas
- Animações suaves (sem stutter)

- [ ] **Step 3: Corrigir issues encontrados**

Ajustes provavelmente necessários: aumentar tamanho de fontes secundárias, intensificar contraste em verdes/vermelhos, reduzir densidade da lista (mostrar 4º–8º em vez de 4º–10º se a tela ficar apertada).

- [ ] **Step 4: Rodar suite completa de testes**

Run: `npx vitest run client/src/components/tv-leaderboard client/src/hooks/__tests__/useTvLeaderboardData.test.ts`
Expected: TODOS PASS

- [ ] **Step 5: Commit final**

```bash
git add client/src/components/tv-leaderboard
git commit -m "feat(tv-leaderboard): polimento visual após validação em TV"
```

---

## Self-Review

**Spec coverage:**
- Faturamento YTD vs meta 25MM → Task 4 (MetaFaturamentoHero) + Task 10 (agregaMeta)
- MRR Ativo por Squad → Task 5 (SquadKpiCard) + Task 10 (agregaSquads)
- NRR por Squad → Task 5 + Task 10
- Churn por Squad → Task 5 + Task 10
- Pódio crescimento de squads → Task 6 (SquadPodium) + Task 10 (calculaCrescimentoSquads)
- Ranking MRR por pessoa → Task 8 (RankingColuna) + Task 10 (mapeiaRankingMrr)
- Ranking NRR por pessoa (com filtro ≥5 clientes) → Task 8 + Task 10 (mapeiaRankingNrr)
- Ranking Anti-Churn por pessoa → Task 8 + Task 10 (mapeiaRankingAntiChurn)
- Pódio top 3 + lista 4º–10º → Task 8 (PodiumTop3 + RankingListaItem)
- Auto-rotação 30s → Task 3 (TvRotator)
- Variação ▲▼ vs mês anterior → Task 8 (RankingListaItem.variacao)
- Badges 🚀🛡️🎯 → Task 5 (SquadKpiCard.BADGE_LABEL)
- Glow no líder → Task 5 (isLider prop)
- Layout fullscreen, dark, sem sidebar → Task 9 (fixed inset-0 + className="dark")
- Header com período + relógio → Task 9 (useRelogio)
- Item no menu Gestão → Task 1
- Permissão → Task 11
- NPS excluído → não aparece em nenhuma task ✓

**Placeholder scan:** As únicas reticências (`/* ... */ throw new Error('preencher')`) na Task 10 são intencionais — exigem o shape real coletado pelo curl no Step 1 da mesma task. Estão documentadas com instruções concretas, não são placeholders abstratos.

**Type consistency:** `TvLeaderboardData`, `SquadKpi`, `RankingPessoa`, `MetaFaturamento`, `SquadCrescimento`, `RankingMetrica` definidos em Task 1 e usados consistentemente nas Tasks 2–10.
