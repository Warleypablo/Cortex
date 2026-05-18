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
