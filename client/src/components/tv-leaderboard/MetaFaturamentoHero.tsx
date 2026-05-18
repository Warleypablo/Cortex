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
    <div className="flex flex-col gap-4 rounded-2xl bg-zinc-900 border border-zinc-800 p-8 h-full">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-zinc-400 text-lg uppercase tracking-wider">Faturamento YTD</div>
          <div className="text-white text-7xl font-bold leading-tight">{fmtBRL(data.realizadoYtd)}</div>
        </div>
        <div className="text-right">
          <div className="text-zinc-400 text-lg uppercase tracking-wider">Meta 2026</div>
          <div className="text-zinc-200 text-4xl font-semibold">{fmtBRL(data.meta)}</div>
        </div>
      </div>

      <div className="relative h-12 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={`h-full ${cor} transition-[width] duration-700`}
          style={{ width: `${pct}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-white text-2xl font-bold drop-shadow">
          {pct.toFixed(1)}%
        </div>
      </div>

      <div className="flex items-center justify-between text-lg">
        <span className={`px-3 py-1 rounded-full font-bold text-white ${cor}`}>
          {STATUS_LABEL[data.status]}
        </span>
        <span className="text-zinc-300">
          Ritmo necessário/dia: <span className="font-bold text-white">{fmtBRL(data.ritmoNecessarioDia)}</span>
        </span>
      </div>
    </div>
  );
}
