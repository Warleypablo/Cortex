import { PodiumTop3 } from './PodiumTop3';
import { RankingListaItem } from './RankingListaItem';
import type { RankingPessoa, RankingMetrica } from './types';

export function RankingColuna({
  titulo,
  icone,
  ranking,
  metrica,
}: {
  titulo: string;
  icone: string;
  ranking: RankingPessoa[];
  metrica: RankingMetrica;
}) {
  const top3 = ranking.slice(0, 3);
  const resto = ranking.slice(3, 15);

  return (
    <section className="relative flex flex-col rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900/80 to-zinc-950 border border-zinc-800 p-5 h-full min-h-0 overflow-hidden">
      <div className="pointer-events-none absolute -top-32 -right-32 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" aria-hidden />
      <header className="relative flex items-center gap-3 mb-4">
        <span className="text-3xl drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]" aria-hidden>{icone}</span>
        <h2 className="text-transparent bg-gradient-to-r from-white to-zinc-300 bg-clip-text text-2xl font-black uppercase tracking-[0.2em]">
          {titulo}
        </h2>
      </header>
      <PodiumTop3 top3={top3} metrica={metrica} />
      <ul className="flex-1 overflow-y-auto pr-1">
        {resto.map((p) => (
          <RankingListaItem key={p.id} pessoa={p} metrica={metrica} />
        ))}
      </ul>
    </section>
  );
}
