import type { RankingPessoa, RankingMetrica } from './types';

function formatValor(metrica: RankingMetrica, valor: number) {
  if (metrica === 'nrr') return `${valor.toFixed(1)}%`;
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function variacao(p: RankingPessoa) {
  if (p.posicaoAnterior == null) return { txt: 'novo', cor: 'text-zinc-400' };
  const diff = p.posicaoAnterior - p.posicaoAtual;
  if (diff > 0) return { txt: `▲${diff}`, cor: 'text-emerald-400' };
  if (diff < 0) return { txt: `▼${-diff}`, cor: 'text-red-400' };
  return { txt: '=', cor: 'text-zinc-400' };
}

function iniciais(nome: string) {
  return nome.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

export function RankingListaItem({
  pessoa,
  metrica,
}: {
  pessoa: RankingPessoa;
  metrica: RankingMetrica;
}) {
  const v = variacao(pessoa);
  return (
    <li className="flex items-center gap-3 py-2 border-b border-zinc-800">
      <span className="text-zinc-500 w-6 text-right font-bold">{pessoa.posicaoAtual}</span>
      <span
        className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
        style={{ backgroundColor: pessoa.corSquad }}
        aria-hidden
      >
        {pessoa.avatarUrl ? (
          <img src={pessoa.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
        ) : (
          iniciais(pessoa.nome)
        )}
      </span>
      <span className="flex-1 text-white truncate">{pessoa.nome}</span>
      <span
        className="text-xs px-2 py-0.5 rounded-full text-white"
        style={{ backgroundColor: pessoa.corSquad }}
      >
        {pessoa.squad}
      </span>
      <span className={`text-sm w-12 text-right ${v.cor}`}>{v.txt}</span>
      <span className="text-white font-bold w-28 text-right">{formatValor(metrica, pessoa.valor)}</span>
    </li>
  );
}
