import { KpisGlobaisHeader } from './KpisGlobaisHeader';
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
    <div className="relative grid grid-rows-[auto_auto_1fr] h-full bg-zinc-950 p-6 gap-4 overflow-hidden">
      {/* Glow ambiente */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl" aria-hidden />

      <header className="relative text-center">
        <h1 className="text-4xl font-black tracking-[0.25em] bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(251,191,36,0.4)]">
          🏆 RANKING INDIVIDUAL — MAIO/2026
        </h1>
        <div className="mt-1 mx-auto h-px w-48 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
      </header>

      <KpisGlobaisHeader kpis={data.kpisGlobais} />

      {placeholder ?? (
        <div className="grid grid-cols-2 gap-4 min-h-0">
          <RankingColuna titulo="MRR Ativo" icone="💰" ranking={data.rankingMrr} metrica="mrr" />
          <RankingColuna titulo="Anti-Churn" icone="🛡️" ranking={data.rankingAntiChurn} metrica="anti-churn" />
        </div>
      )}
    </div>
  );
}
