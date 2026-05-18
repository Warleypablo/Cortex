import { RankingColuna } from './RankingColuna';
import type { TvLeaderboardData } from './types';

type Props = {
  data: TvLeaderboardData;
  rankingsLoading?: boolean;
  rankingsError?: Error | undefined;
};

export function TelaPessoas({ data, rankingsLoading, rankingsError }: Props) {
  const totalLinhas = data.rankingMrr.length + data.rankingAntiChurn.length;

  let placeholder: React.ReactNode = null;
  if (totalLinhas === 0) {
    if (rankingsError) {
      placeholder = (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-red-400">
          <span className="text-2xl">Falha ao carregar rankings</span>
          <span className="text-sm text-zinc-500">{rankingsError.message}</span>
        </div>
      );
    } else if (rankingsLoading) {
      placeholder = (
        <div className="flex items-center justify-center flex-1 text-zinc-400 text-2xl">
          Carregando rankings…
        </div>
      );
    } else {
      placeholder = (
        <div className="flex items-center justify-center flex-1 text-zinc-500 text-2xl">
          Sem dados para o mês atual
        </div>
      );
    }
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 p-6 gap-4">
      <header className="text-center">
        <h1 className="text-white text-3xl font-bold tracking-wider">
          RANKING INDIVIDUAL — MAIO/2026
        </h1>
      </header>
      {placeholder ?? (
        <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
          <RankingColuna titulo="MRR Ativo" icone="💰" ranking={data.rankingMrr} metrica="mrr" />
          <RankingColuna titulo="Anti-Churn" icone="🛡️" ranking={data.rankingAntiChurn} metrica="anti-churn" />
        </div>
      )}
    </div>
  );
}
