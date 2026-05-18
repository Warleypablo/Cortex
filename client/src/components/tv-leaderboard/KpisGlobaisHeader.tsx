import type { KpisGlobais } from './types';

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const fmtInt = (v: number) => v.toLocaleString('pt-BR');

export function KpisGlobaisHeader({ kpis }: { kpis: KpisGlobais }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <KpiCard
        icone="👥"
        label="Operadores ativos"
        valor={fmtInt(kpis.operadoresAtivos)}
        cor="text-cyan-400"
      />
      <KpiCard
        icone="💼"
        label="Base ativa total"
        valor={fmtBRL(kpis.mrrTotalBase)}
        cor="text-emerald-400"
      />
      <KpiCard
        icone="⚠️"
        label="Churn acumulado 6m"
        valor={fmtBRL(kpis.churnAcumulado6m)}
        cor="text-red-400"
      />
    </div>
  );
}

function KpiCard({
  icone,
  label,
  valor,
  cor,
}: {
  icone: string;
  label: string;
  valor: string;
  cor: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-zinc-900 border border-zinc-800 px-5 py-3">
      <div className="text-3xl" aria-hidden>
        {icone}
      </div>
      <div className="flex flex-col">
        <span className="text-zinc-400 text-[11px] uppercase tracking-wider">{label}</span>
        <span className={`${cor} text-2xl font-bold leading-tight`}>{valor}</span>
      </div>
    </div>
  );
}
