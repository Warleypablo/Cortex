import type { SquadCrescimento } from './types';

const MEDALHAS = { 1: '🥇', 2: '🥈', 3: '🥉' } as const;
const ORDEM_VISUAL = [2, 1, 3] as const;

// Alturas relativas das colunas do pódio (em % da própria coluna)
const ALTURA_BARRA_PCT = { 1: 100, 2: 70, 3: 45 } as const;

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function SquadPodium({ squads }: { squads: SquadCrescimento[] }) {
  const porPosicao = new Map(squads.map((s) => [s.posicao, s]));

  return (
    <div className="flex flex-col h-full rounded-2xl bg-zinc-900/40 border border-zinc-800 px-6 py-3">
      <div className="text-zinc-400 text-xs uppercase tracking-[0.2em] font-bold mb-2 text-center">
        🚀 Maior crescimento do mês
      </div>
      <div className="flex items-end justify-center gap-8 flex-1 min-h-0">
        {ORDEM_VISUAL.map((pos) => {
          const s = porPosicao.get(pos);
          if (!s) return null;
          const isLider = pos === 1;
          return (
            <div
              key={pos}
              className="flex flex-col items-center justify-end gap-2 min-w-[240px] flex-1 max-w-[360px] h-full"
            >
              <div className={isLider ? 'text-7xl drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]' : 'text-5xl'}>
                {MEDALHAS[pos]}
              </div>
              <div
                className={`text-white font-bold tracking-wide text-center ${
                  isLider ? 'text-3xl' : 'text-2xl'
                }`}
              >
                {s.squad}
              </div>
              <div
                className={`font-bold ${
                  isLider ? 'text-emerald-400 text-4xl' : 'text-emerald-300 text-3xl'
                }`}
              >
                +{fmtBRL(s.delta)}
              </div>
              <div
                className={`w-full rounded-t-xl ${isLider ? 'shadow-[0_0_24px_rgba(251,191,36,0.35)]' : ''}`}
                style={{
                  backgroundColor: s.cor,
                  opacity: isLider ? 0.95 : 0.8,
                  height: `${ALTURA_BARRA_PCT[pos]}%`,
                  minHeight: '24px',
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
