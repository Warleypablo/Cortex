import type { RankingPessoa, RankingMetrica } from './types';

const MEDALHAS = { 1: '👑', 2: '🥈', 3: '🥉' } as const;

const RING_STYLE = {
  1: {
    ring: 'ring-4 ring-amber-300',
    glow: 'shadow-[0_0_48px_rgba(251,191,36,0.85)]',
    badge: 'bg-gradient-to-br from-amber-300 via-yellow-400 to-orange-500 text-black',
    nome: 'text-amber-200',
    valor: 'bg-gradient-to-r from-amber-300 to-yellow-400 bg-clip-text text-transparent',
  },
  2: {
    ring: 'ring-2 ring-zinc-300/70',
    glow: 'shadow-[0_0_28px_rgba(228,228,231,0.45)]',
    badge: 'bg-gradient-to-br from-zinc-200 via-zinc-400 to-zinc-500 text-zinc-900',
    nome: 'text-zinc-100',
    valor: 'text-zinc-100',
  },
  3: {
    ring: 'ring-2 ring-amber-700/70',
    glow: 'shadow-[0_0_24px_rgba(180,83,9,0.5)]',
    badge: 'bg-gradient-to-br from-amber-600 via-orange-700 to-amber-900 text-amber-100',
    nome: 'text-orange-200',
    valor: 'text-orange-200',
  },
} as const;

function iniciais(nome: string) {
  return nome.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

function formatValor(metrica: RankingMetrica, valor: number): string {
  if (metrica === 'nrr') return `${valor.toFixed(1)}%`;
  if (metrica === 'crescimento') {
    const abs = Math.abs(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    if (valor > 0) return `+${abs}`;
    if (valor < 0) return `−${abs}`;
    return abs;
  }
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
    <div className="flex items-end justify-center gap-4 mb-4 pt-6">
      {ordem.map((p) => {
        const pos = p.posicaoAtual as 1 | 2 | 3;
        const isLider = pos === 1;
        const style = RING_STYLE[pos];
        const tamanho = isLider ? 'h-28 w-28 text-4xl' : 'h-20 w-20 text-2xl';
        return (
          <div key={p.id} className="flex flex-col items-center gap-2 min-w-[120px]">
            <div className="relative">
              {/* Coroa flutuante para o líder */}
              {isLider && (
                <div
                  className="absolute -top-10 left-1/2 -translate-x-1/2 text-5xl animate-bounce"
                  style={{ animationDuration: '2s' }}
                >
                  {MEDALHAS[1]}
                </div>
              )}
              <div
                className={`relative rounded-full flex items-center justify-center font-bold ${tamanho} ${style.ring} ${style.glow} overflow-hidden`}
                style={{ backgroundColor: p.corSquad }}
                aria-label={p.nome}
              >
                {p.avatarUrl ? (
                  <img src={p.avatarUrl} alt={p.nome} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-white">{iniciais(p.nome)}</span>
                )}
              </div>
              {/* Badge da posição */}
              <div
                className={`absolute -bottom-2 -right-2 h-10 w-10 rounded-full flex items-center justify-center text-base font-black ${style.badge} ring-2 ring-zinc-950`}
              >
                {pos}
              </div>
            </div>

            <div className={`font-bold text-center max-w-[160px] ${style.nome} ${isLider ? 'text-base' : 'text-sm'}`}>
              {p.nome}
            </div>
            <div className={`font-black tracking-tight ${style.valor} ${isLider ? 'text-3xl' : 'text-xl'}`}>
              {formatValor(metrica, p.valor)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
