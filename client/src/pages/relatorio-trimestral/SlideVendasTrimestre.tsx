import { BarChart3, TrendingUp, Zap } from "lucide-react";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader, SecondaryCard } from "../relatorio-mensal/SlideComponents";
import type { ContratosMes } from "../relatorio-mensal/types";
import type { Qoq } from "./types";
import { useCountUp } from "./useCountUp";

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

function fmtCompact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace(".", ",")}M`;
  if (abs >= 1_000) return `R$ ${Math.round(v / 1_000)}k`;
  return formatBRL(v);
}

function QoqBadge({ q }: { q: Qoq }) {
  if (!q.anterior) return null;
  const pct = ((q.atual - q.anterior) / Math.abs(q.anterior)) * 100;
  const positivo = pct >= 0;
  const bom = q.betterDirection === "up" ? positivo : !positivo;
  return (
    <span className={`text-sm font-bold tabular-nums rounded-full px-3 py-1 ${bom ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}>
      {positivo ? "▲" : "▼"} {Math.abs(pct).toFixed(1).replace(".", ",")}% QoQ
    </span>
  );
}

function entrance(delayMs: number) {
  return {
    className: "animate-in fade-in slide-in-from-bottom-4 duration-500 motion-reduce:animate-none",
    style: { animationDelay: `${delayMs}ms`, animationFillMode: "both" as const },
  };
}

function SubStat({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex-1 text-center">
      <p className="text-[11px] text-zinc-500 uppercase tracking-widest">{label}</p>
      <p className="text-3xl font-black text-white mt-1">{valor}</p>
    </div>
  );
}

export default function SlideVendasTrimestre({
  dados,
  label,
  qoqVendas,
  vendaPontual,
  qoqPontual,
}: {
  dados: ContratosMes;
  label: string;
  qoqVendas: Qoq;
  vendaPontual: { valor: number; contratos: number };
  qoqPontual: Qoq;
}) {
  // O pontual vem do ClickUp (aquisição no tri: cup_contratos criados com valorp), não do
  // Bitrix (deals ganhos). O Bitrix só enxerga o pontual que virou deal no CRM e subestima
  // — o resto do deck (Visão Pontual, slide Pontual) já mede pelo ClickUp. O recorrente
  // segue do Bitrix (deals ganhos recorrentes); o hero soma as duas fontes.
  const pontualContratos = vendaPontual.contratos;
  const tmPontual = pontualContratos > 0 ? vendaPontual.valor / pontualContratos : 0;
  const numContratos = dados.contratosRecorrente + pontualContratos;
  const receitaTotal = dados.receitaRecorrente + vendaPontual.valor;
  const pctRec = receitaTotal > 0 ? (dados.receitaRecorrente / receitaTotal) * 100 : 0;

  const totalContratosAnim = useCountUp(numContratos, 750, 150);
  const receitaTotalAnim = useCountUp(receitaTotal, 750, 150);
  const recReceitaAnim = useCountUp(dados.receitaRecorrente, 750, 400);
  const pontReceitaAnim = useCountUp(vendaPontual.valor, 750, 500);

  return (
    <SlideLayout section="commerce" padding="28px 36px">
      <style>{`
        @keyframes vendasGrowX { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @media (prefers-reduced-motion: reduce) { .vendas-grow { animation: none !important; transform: scaleX(1) !important; } }
      `}</style>
      <SlideHeader icon={BarChart3} iconColor="text-cyan-400" title={`Contratos Fechados — ${label}`} gradientColor="#06b6d4" />

      <div className="flex-1 flex flex-col gap-5 min-h-0">
        {/* Hero: totais do trimestre + proporção Recorrente × Pontual */}
        <div className={`${entrance(0).className} flex-[2] min-h-0 flex`} style={entrance(0).style}>
          <SecondaryCard className="px-8 py-6 w-full flex flex-col justify-center">
            <div className="flex items-end justify-between mb-5">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-[0.25em]">Total de contratos</p>
                <p className="text-7xl font-black text-white leading-none mt-2">{Math.round(totalContratosAnim)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-500 uppercase tracking-[0.25em]">Receita total</p>
                <p className="text-7xl font-black leading-none mt-2 bg-gradient-to-r from-emerald-300 to-cyan-400 bg-clip-text text-transparent">
                  {fmtCompact(receitaTotalAnim)}
                </p>
              </div>
            </div>
            <div
              className="h-4 rounded-full overflow-hidden flex bg-white/[0.04] vendas-grow"
              style={{ transformOrigin: "left", animation: "vendasGrowX 700ms ease-out 250ms both" }}
            >
              <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${pctRec}%` }} />
              <div className="h-full bg-gradient-to-r from-violet-500 to-purple-400 flex-1" />
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="flex items-center gap-2 text-sm text-zinc-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Recorrente {pctRec.toFixed(0)}%
              </span>
              <span className="flex items-center gap-2 text-sm text-zinc-400">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400" /> Pontual {(100 - pctRec).toFixed(0)}%
              </span>
            </div>
          </SecondaryCard>
        </div>

        {/* Recorrente × Pontual: os dois protagonistas, receita como hero de cada card */}
        <div className="grid grid-cols-2 gap-5 flex-[3] min-h-0">
          <div className={`${entrance(200).className} min-h-0 flex`} style={entrance(200).style}>
            <SecondaryCard className="px-8 py-6 w-full flex flex-col justify-center" borderColor="#34d399">
              <div className="flex items-center justify-between mb-4">
                <span className="flex items-center gap-2 text-sm font-bold text-emerald-400 uppercase tracking-widest">
                  <TrendingUp className="h-4 w-4" /> Recorrente (MRR)
                </span>
                <QoqBadge q={qoqVendas} />
              </div>
              <p className="text-6xl font-black text-emerald-400 leading-none text-center my-4">{fmtCompact(recReceitaAnim)}</p>
              <p className="text-xs text-zinc-500 uppercase tracking-widest text-center mb-5">Receita no trimestre</p>
              <div className="flex gap-4 border-t border-white/[0.06] pt-5">
                <SubStat label="Contratos" valor={String(dados.contratosRecorrente)} />
                <div className="w-px bg-white/[0.06]" />
                <SubStat label="Ticket médio" valor={fmtCompact(dados.tmRecorrente)} />
              </div>
            </SecondaryCard>
          </div>
          <div className={`${entrance(300).className} min-h-0 flex`} style={entrance(300).style}>
            <SecondaryCard className="px-8 py-6 w-full flex flex-col justify-center" borderColor="#a855f7">
              <div className="flex items-center justify-between mb-4">
                <span className="flex items-center gap-2 text-sm font-bold text-purple-400 uppercase tracking-widest">
                  <Zap className="h-4 w-4" /> Pontual
                </span>
                <QoqBadge q={qoqPontual} />
              </div>
              <p className="text-6xl font-black text-purple-400 leading-none text-center my-4">{fmtCompact(pontReceitaAnim)}</p>
              <p className="text-xs text-zinc-500 uppercase tracking-widest text-center mb-5">Vendido no trimestre</p>
              <div className="flex gap-4 border-t border-white/[0.06] pt-5">
                <SubStat label="Contratos" valor={String(pontualContratos)} />
                <div className="w-px bg-white/[0.06]" />
                <SubStat label="Ticket médio" valor={fmtCompact(tmPontual)} />
              </div>
            </SecondaryCard>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
