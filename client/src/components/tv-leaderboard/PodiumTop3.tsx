import type { RankingPessoa, RankingMetrica } from './types';

const MEDALHAS = { 1: '🥇', 2: '🥈', 3: '🥉' } as const;

function iniciais(nome: string) {
  return nome.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

function formatValor(metrica: RankingMetrica, valor: number) {
  if (metrica === 'nrr') return `${valor.toFixed(1)}%`;
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export function PodiumTop3({
  top3,
  metrica,
}: {
  top3: RankingPessoa[];
  metrica: RankingMetrica;
}) {
  const ordem = [top3[1], top3[0], top3[2]].filter(Boolean);
  return (
    <div className="flex items-end justify-center gap-3 mb-4">
      {ordem.map((p) => {
        const pos = p.posicaoAtual as 1 | 2 | 3;
        const isLider = pos === 1;
        const tamanho = isLider ? 'h-24 w-24 text-3xl' : 'h-16 w-16 text-xl';
        return (
          <div key={p.id} className="flex flex-col items-center gap-1 min-w-[100px]">
            <div className="text-2xl">{MEDALHAS[pos]}</div>
            <div
              className={`rounded-full flex items-center justify-center font-bold text-white ${tamanho} ${
                isLider ? 'ring-4 ring-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.6)]' : ''
              }`}
              style={{ backgroundColor: p.corSquad }}
              aria-label={p.nome}
            >
              {p.avatarUrl ? (
                <img src={p.avatarUrl} alt={p.nome} className="h-full w-full rounded-full object-cover" />
              ) : (
                iniciais(p.nome)
              )}
            </div>
            <div className={`text-white font-bold text-center ${isLider ? 'text-lg' : 'text-sm'}`}>
              {p.nome}
            </div>
            <div className={`font-bold ${isLider ? 'text-amber-400 text-2xl' : 'text-zinc-300 text-lg'}`}>
              {formatValor(metrica, p.valor)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
