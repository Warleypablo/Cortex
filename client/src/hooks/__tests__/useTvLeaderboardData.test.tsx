import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTvLeaderboardData } from '../useTvLeaderboardData';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useTvLeaderboardData', () => {
  it('retorna data com todas as seções do dashboard', async () => {
    const { result } = renderHook(() => useTvLeaderboardData(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data!.meta).toBeDefined();
    expect(result.current.data!.squads.length).toBeGreaterThan(0);
    expect(result.current.data!.rankingMrr.length).toBeGreaterThan(0);
    expect(result.current.data!.rankingNrr.length).toBeGreaterThan(0);
    expect(result.current.data!.rankingAntiChurn.length).toBeGreaterThan(0);
  });
});
