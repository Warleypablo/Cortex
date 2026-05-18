import { RankingColuna } from './RankingColuna';
import type { TvLeaderboardData } from './types';

export function TelaPessoas({ data }: { data: TvLeaderboardData }) {
  const semDados =
    data.rankingMrr.length === 0 && data.rankingAntiChurn.length === 0;

  return (
    <div className="flex flex-col h-full bg-zinc-950 p-6 gap-4">
      <header className="text-center">
        <h1 className="text-white text-3xl font-bold tracking-wider">
          RANKING INDIVIDUAL — MAIO/2026
        </h1>
      </header>
      {semDados ? (
        <div className="flex items-center justify-center flex-1 text-zinc-400 text-2xl">
          Carregando rankings…
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
          <RankingColuna titulo="MRR Ativo" icone="💰" ranking={data.rankingMrr} metrica="mrr" />
          <RankingColuna titulo="Anti-Churn" icone="🛡️" ranking={data.rankingAntiChurn} metrica="anti-churn" />
        </div>
      )}
    </div>
  );
}
