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
  const resto = ranking.slice(3, 10);

  return (
    <section className="flex flex-col rounded-2xl bg-zinc-900 border border-zinc-800 p-5 h-full">
      <header className="flex items-center gap-2 mb-4">
        <span className="text-2xl" aria-hidden>{icone}</span>
        <h2 className="text-white text-xl font-bold uppercase tracking-wider">{titulo}</h2>
      </header>
      <PodiumTop3 top3={top3} metrica={metrica} />
      <ul className="flex-1 overflow-hidden">
        {resto.map((p) => (
          <RankingListaItem key={p.id} pessoa={p} metrica={metrica} />
        ))}
      </ul>
    </section>
  );
}
