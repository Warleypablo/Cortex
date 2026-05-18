import { ChurnGlobalHero } from './ChurnGlobalHero';
import { MetaFaturamentoHero } from './MetaFaturamentoHero';
import { SquadKpiCard } from './SquadKpiCard';
import { SquadPodium } from './SquadPodium';
import type { TvLeaderboardData } from './types';

const PADROES_OCULTOS = ['squad x', 'tech'];

function isOculta(nome: string): boolean {
  const lower = nome.toLowerCase();
  return PADROES_OCULTOS.some((p) => lower.includes(p));
}

export function TelaSquads({ data }: { data: TvLeaderboardData }) {
  const visiveis = data.squads.filter((s) => !isOculta(s.squad));
  const ordenadas = [...visiveis].sort((a, b) => b.mrrAtivo - a.mrrAtivo);
  const liderId = ordenadas[0]?.squad;
  const crescimentoVisivel = data.crescimentoSquads
    .filter((s) => !isOculta(s.squad))
    .slice(0, 3)
    .map((s, idx) => ({ ...s, posicao: (idx + 1) as 1 | 2 | 3 }));

  return (
    <div className="relative grid grid-rows-[auto_minmax(0,12%)_minmax(0,32%)_minmax(0,1fr)] h-full gap-4 p-6 bg-zinc-950 overflow-hidden">
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl" aria-hidden />

      <header className="relative text-center">
        <h1 className="text-3xl font-black tracking-[0.25em] bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(251,191,36,0.4)]">
          🏆 SQUADS — MAIO/2026
        </h1>
        <div className="mt-1 mx-auto h-px w-48 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
      </header>

      <div className="grid grid-cols-2 gap-4">
        <MetaFaturamentoHero data={data.meta} />
        <ChurnGlobalHero squads={visiveis} />
      </div>

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${ordenadas.length}, minmax(0, 1fr))` }}
      >
        {ordenadas.map((s) => (
          <SquadKpiCard key={s.squad} kpi={s} isLider={s.squad === liderId} />
        ))}
      </div>

      <SquadPodium squads={crescimentoVisivel} />
    </div>
  );
}
