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
    <div className="relative grid grid-rows-[12%_50%_38%] h-full gap-4 p-6 bg-zinc-950 overflow-hidden">
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" aria-hidden />
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
