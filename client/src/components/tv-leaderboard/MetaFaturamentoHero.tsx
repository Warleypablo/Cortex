import type { MetaFaturamento } from './types';

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const STATUS_COLORS = {
  'no-ritmo': 'bg-emerald-500',
  atras: 'bg-amber-500',
  critico: 'bg-red-500',
} as const;

const STATUS_LABEL = {
  'no-ritmo': 'NO RITMO',
  atras: 'ATRÁS DA META',
  critico: 'CRÍTICO',
} as const;

export function MetaFaturamentoHero({ data }: { data: MetaFaturamento }) {
  const pct = Math.min(100, data.pctAtingido);
  const cor = STATUS_COLORS[data.status];

  return (
    <div className="relative overflow-hidden flex items-center gap-6 rounded-xl bg-gradient-to-br from-emerald-500/20 via-emerald-500/5 to-transparent border border-zinc-800 ring-1 ring-emerald-500/40 px-5 py-3 h-full">
      <div className="flex flex-col">
        <span className="text-zinc-400 text-[11px] uppercase tracking-[0.15em] font-semibold">
          Faturamento YTD
        </span>
        <span className="text-2xl font-black leading-tight bg-gradient-to-r from-emerald-300 to-emerald-100 bg-clip-text text-transparent">
          {fmtBRL(data.realizadoYtd)}
        </span>
      </div>

      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span className={`px-2 py-0.5 rounded-full font-bold text-white text-[10px] ${cor}`}>
            {STATUS_LABEL[data.status]}
          </span>
          <span>
            Meta 2026: <span className="text-zinc-200 font-semibold">{fmtBRL(data.meta)}</span>
            <span className="mx-2 text-zinc-600">·</span>
            Ritmo/dia: <span className="text-zinc-200 font-semibold">{fmtBRL(data.ritmoNecessarioDia)}</span>
          </span>
        </div>
        <div className="relative h-5 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className={`h-full ${cor} transition-[width] duration-700`}
            style={{ width: `${pct}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold drop-shadow">
            {pct.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
}
