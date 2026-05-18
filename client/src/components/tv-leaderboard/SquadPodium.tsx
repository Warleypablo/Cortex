import type { SquadCrescimento } from './types';

const MEDALHAS = { 1: '🥇', 2: '🥈', 3: '🥉' } as const;
const ALTURAS = { 1: 'h-24', 2: 'h-20', 3: 'h-16' } as const;
const ORDEM_VISUAL = [2, 1, 3] as const;

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function SquadPodium({ squads }: { squads: SquadCrescimento[] }) {
  const porPosicao = new Map(squads.map((s) => [s.posicao, s]));

  return (
    <div className="flex items-end justify-center gap-6 h-full">
      {ORDEM_VISUAL.map((pos) => {
        const s = porPosicao.get(pos);
        if (!s) return null;
        return (
          <div key={pos} className="flex flex-col items-center gap-2 min-w-[180px]">
            <div className="text-3xl">{MEDALHAS[pos]}</div>
            <div className="text-white font-bold text-xl">{s.squad}</div>
            <div className="text-emerald-400 text-2xl font-bold">+{fmtBRL(s.delta)}</div>
            <div
              className={`w-full rounded-t-xl ${ALTURAS[pos]}`}
              style={{ backgroundColor: s.cor, opacity: 0.85 }}
            />
          </div>
        );
      })}
    </div>
  );
}
