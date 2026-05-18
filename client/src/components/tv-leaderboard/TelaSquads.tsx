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
