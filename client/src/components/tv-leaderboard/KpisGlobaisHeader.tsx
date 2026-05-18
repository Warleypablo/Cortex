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
        gradiente="from-cyan-500/20 via-cyan-500/5 to-transparent"
        ringCor="ring-cyan-500/40"
        textCor="from-cyan-300 to-cyan-100"
      />
      <KpiCard
        icone="💼"
        label="Base ativa total"
        valor={fmtBRL(kpis.mrrTotalBase)}
        gradiente="from-emerald-500/20 via-emerald-500/5 to-transparent"
        ringCor="ring-emerald-500/40"
        textCor="from-emerald-300 to-emerald-100"
      />
      <KpiCard
        icone="⚠️"
        label="Churn acumulado 6m"
        valor={fmtBRL(kpis.churnAcumulado6m)}
        gradiente="from-red-500/20 via-red-500/5 to-transparent"
        ringCor="ring-red-500/40"
        textCor="from-red-300 to-orange-200"
      />
    </div>
  );
}

function KpiCard({
  icone,
  label,
  valor,
  gradiente,
  ringCor,
  textCor,
}: {
  icone: string;
  label: string;
  valor: string;
  gradiente: string;
  ringCor: string;
  textCor: string;
}) {
  return (
    <div
      className={`relative overflow-hidden flex items-center gap-4 rounded-xl bg-gradient-to-br ${gradiente} border border-zinc-800 ring-1 ${ringCor} px-5 py-3`}
    >
      <div className="text-3xl drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]" aria-hidden>
        {icone}
      </div>
      <div className="flex flex-col">
        <span className="text-zinc-400 text-[11px] uppercase tracking-[0.15em] font-semibold">
          {label}
        </span>
        <span
          className={`text-2xl font-black leading-tight bg-gradient-to-r ${textCor} bg-clip-text text-transparent`}
        >
          {valor}
        </span>
      </div>
    </div>
  );
}
