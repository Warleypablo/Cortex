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
