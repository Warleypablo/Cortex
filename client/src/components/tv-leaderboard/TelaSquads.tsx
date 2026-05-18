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
  const crescimentoVisivel = data.crescimentoSquads.filter((s) => !isOculta(s.squad));

  return (
    <div className="grid grid-rows-[15%_60%_25%] h-full gap-4 p-6 bg-zinc-950">
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
