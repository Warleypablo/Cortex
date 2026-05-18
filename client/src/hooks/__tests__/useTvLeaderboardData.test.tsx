import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTvLeaderboardData } from '../useTvLeaderboardData';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  } as unknown as Response;
}

function mockFetchByUrl(payloadFor: (url: string) => unknown) {
  return vi.fn(async (url: string) => jsonResponse(payloadFor(url)));
}

describe('useTvLeaderboardData', () => {
  beforeEach(() => {
    const analiseSquads = {
      squads: [
        {
          squad: 'Squad A',
          mrr: 580_000,
          contratos: 50,
          clientes: 40,
          churns: 2,
          mrrChurn: 12_000,
          churnRate: 2.1,
          ticketMedio: 11_600,
        },
        {
          squad: 'Squad B',
          mrr: 430_000,
          contratos: 30,
          clientes: 25,
          churns: 1,
          mrrChurn: 9_000,
          churnRate: 2.0,
          ticketMedio: 14_333,
        },
      ],
      totais: {},
      evolucao: {
        mrr: [
          { mes: '2026-01', squad: 'Squad A', mrr_total: 510_000 },
          { mes: '2026-02', squad: 'Squad A', mrr_total: 540_000 },
          { mes: '2026-03', squad: 'Squad A', mrr_total: 560_000 },
          { mes: '2026-04', squad: 'Squad A', mrr_total: 575_000 },
          { mes: '2026-05', squad: 'Squad A', mrr_total: 580_000 },
        ],
        churns: [],
      },
      squadsLista: ['Squad A', 'Squad B'],
    };

    const okrSummary = {
      metrics: { receita_total_ytd: 9_800_000, nrr_pct: 105 },
    };

    const mrrCloser = [
      { closer: 'Alice', mrr: 50_000, pontual: 0, contratos: 3 },
      { closer: 'Bob', mrr: 35_000, pontual: 0, contratos: 2 },
      { closer: 'Não Atribuído', mrr: 1000, pontual: 0, contratos: 1 },
    ];

    const churnResp = [
      {
        responsavel: 'Carla',
        quantidadeContratos: 2,
        valorTotal: 3_000,
        percentualChurn: 2.1,
        valorAtivoTotal: 150_000,
      },
      {
        responsavel: 'Diego',
        quantidadeContratos: 1,
        valorTotal: 1_000,
        percentualChurn: 1.0,
        valorAtivoTotal: 100_000,
      },
    ];

    global.fetch = mockFetchByUrl((url) => {
      if (url.includes('/api/okr2026/summary')) return okrSummary;
      if (url.includes('/api/analise-squads')) return analiseSquads;
      if (url.includes('/api/analytics/nrr')) return { nrr_pct: 105 };
      if (url.includes('/api/vendas/mrr-por-closer')) return mrrCloser;
      if (url.includes('/api/churn-por-responsavel')) return churnResp;
      return {};
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retorna data com todas as seções do dashboard', async () => {
    const { result } = renderHook(() => useTvLeaderboardData(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data!.meta).toBeDefined();
    expect(result.current.data!.meta.meta).toBe(25_000_000);
    expect(result.current.data!.squads.length).toBeGreaterThan(0);
    expect(result.current.data!.rankingMrr.length).toBeGreaterThan(0);
    expect(result.current.data!.rankingNrr.length).toBeGreaterThan(0);
    expect(result.current.data!.rankingAntiChurn.length).toBeGreaterThan(0);
    expect(result.current.data!.crescimentoSquads.length).toBeGreaterThan(0);
    // Não atribuído deve ser filtrado
    expect(
      result.current.data!.rankingMrr.find((r) => r.nome === 'Não Atribuído'),
    ).toBeUndefined();
  });
});
