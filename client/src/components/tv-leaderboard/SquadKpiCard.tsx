import { LineChart, Line, ResponsiveContainer } from 'recharts';
import type { SquadKpi } from './types';

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const BADGE_LABEL: Record<NonNullable<SquadKpi['badges'][number]>, string> = {
  crescimento: '🚀 Maior crescimento',
  'menor-churn': '🛡️ Menor churn',
  meta: '🎯 Bateu meta',
};

const CHURN_MAX = 8;

function churnTermometroCor(pct: number) {
  if (pct <= 3) return 'bg-emerald-500';
  if (pct <= 5) return 'bg-amber-500';
  return 'bg-red-500';
}

export function SquadKpiCard({ kpi, isLider }: { kpi: SquadKpi; isLider: boolean }) {
  const seta = kpi.nrrDeltaPct >= 0 ? '⬆️' : '⬇️';
  const churnPctClamp = Math.min(CHURN_MAX, Math.max(0, kpi.churnPct));
  const churnFillPct = (churnPctClamp / CHURN_MAX) * 100;
  const churnAcimaMax = kpi.churnPct >= CHURN_MAX;
  const churnCor = churnTermometroCor(kpi.churnPct);

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border bg-zinc-900 p-5 h-full transition-shadow ${
        isLider ? 'border-2 shadow-[0_0_30px_rgba(59,130,246,0.4)] animate-pulse' : 'border-zinc-800'
      }`}
      style={{ borderColor: isLider ? kpi.cor : undefined }}
    >
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: kpi.cor }} />
        <span className="text-white font-bold text-xl">{kpi.squad}</span>
      </div>

      <div>
        <div className="text-zinc-400 text-xs uppercase">MRR Ativo</div>
        <div className="text-white text-5xl font-bold">{fmtBRL(kpi.mrrAtivo)}</div>
      </div>

      <div>
        <div className="text-zinc-400 text-xs uppercase">NRR</div>
        <div className="text-white text-2xl font-bold">
          {kpi.nrrPct.toFixed(1)}% <span className="text-base">{seta}</span>
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-zinc-400 text-xs uppercase">Churn</span>
          <span className={`text-xl font-bold ${churnAcimaMax ? 'text-red-400' : 'text-white'}`}>
            {kpi.churnPct.toFixed(1)}%
          </span>
        </div>
        <div className="relative h-3 mt-1 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className={`h-full ${churnCor} transition-[width] duration-500`}
            style={{ width: `${churnFillPct}%` }}
          />
          <div
            className="absolute top-0 bottom-0 w-px bg-zinc-500"
            style={{ left: `${(3 / CHURN_MAX) * 100}%` }}
            aria-hidden
          />
          <div
            className="absolute top-0 bottom-0 w-px bg-zinc-500"
            style={{ left: `${(5 / CHURN_MAX) * 100}%` }}
            aria-hidden
          />
        </div>
        <div className="flex justify-between text-[10px] text-zinc-500 mt-0.5">
          <span>0%</span>
          <span>máx {CHURN_MAX}%</span>
        </div>
      </div>

      <div className="h-10 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={kpi.sparkline.map((v, i) => ({ i, v }))}>
            <Line type="monotone" dataKey="v" stroke={kpi.cor} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-1">
        {kpi.badges.map((b) => (
          <span key={b} className="text-xs bg-zinc-800 text-zinc-200 px-2 py-1 rounded">
            {BADGE_LABEL[b]}
          </span>
        ))}
      </div>
    </div>
  );
}
