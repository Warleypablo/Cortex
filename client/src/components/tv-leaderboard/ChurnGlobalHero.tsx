import type { SquadKpi } from './types';

const CHURN_MAX = 8;

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function corDoChurn(pct: number) {
  if (pct <= 3) return 'bg-emerald-500';
  if (pct <= 5) return 'bg-amber-500';
  return 'bg-red-500';
}

function labelDoChurn(pct: number) {
  if (pct <= 3) return { texto: 'SAUDÁVEL', cor: 'bg-emerald-500' };
  if (pct <= 5) return { texto: 'ATENÇÃO', cor: 'bg-amber-500' };
  return { texto: 'CRÍTICO', cor: 'bg-red-500' };
}

export function ChurnGlobalHero({ squads }: { squads: SquadKpi[] }) {
  const baseAtiva = squads.reduce((acc, s) => acc + s.mrrAtivo, 0);
  const churnTotal = squads.reduce((acc, s) => acc + s.churnValor, 0);
  const pct = baseAtiva > 0 ? (churnTotal / baseAtiva) * 100 : 0;
  const pctClamp = Math.min(CHURN_MAX, Math.max(0, pct));
  const fillPct = (pctClamp / CHURN_MAX) * 100;
  const cor = corDoChurn(pct);
  const status = labelDoChurn(pct);

  return (
    <div className="flex items-center gap-6 rounded-xl bg-zinc-900 border border-zinc-800 px-5 py-3 h-full">
      <div className="flex flex-col">
        <span className="text-zinc-400 text-[11px] uppercase tracking-wider">Churn Consolidado</span>
        <span className="text-white text-2xl font-bold leading-tight">{pct.toFixed(2)}%</span>
      </div>

      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span className={`px-2 py-0.5 rounded-full font-bold text-white text-[10px] ${status.cor}`}>
            {status.texto}
          </span>
          <span>
            Churn R$: <span className="text-zinc-200 font-semibold">{fmtBRL(churnTotal)}</span>
            <span className="mx-2 text-zinc-600">·</span>
            Base ativa: <span className="text-zinc-200 font-semibold">{fmtBRL(baseAtiva)}</span>
          </span>
        </div>
        <div className="relative h-5 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className={`h-full ${cor} transition-[width] duration-700`}
            style={{ width: `${fillPct}%` }}
          />
          <div
            className="absolute top-0 bottom-0 w-px bg-zinc-600"
            style={{ left: `${(3 / CHURN_MAX) * 100}%` }}
            aria-hidden
          />
          <div
            className="absolute top-0 bottom-0 w-px bg-zinc-600"
            style={{ left: `${(5 / CHURN_MAX) * 100}%` }}
            aria-hidden
          />
        </div>
        <div className="flex justify-between text-[10px] text-zinc-500">
          <span>0%</span>
          <span>3%</span>
          <span>5%</span>
          <span>máx {CHURN_MAX}%</span>
        </div>
      </div>
    </div>
  );
}
