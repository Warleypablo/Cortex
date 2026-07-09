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
    <span className={`text-xs font-bold tabular-nums rounded-full px-2 py-0.5 ${bom ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}>
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

function StatInline({ label, valor, cor = "text-white" }: { label: string; valor: string; cor?: string }) {
  return (
    <div className="flex-1">
      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{label}</p>
      <p className={`text-2xl font-black ${cor} mt-0.5`}>{valor}</p>
    </div>
  );
}

export default function SlideVendasTrimestre({
  dados,
  label,
  qoqVendas,
}: {
  dados: ContratosMes;
  label: string;
  qoqVendas: Qoq;
}) {
  const receitaTotal = dados.receitaRecorrente + dados.receitaPontual;
  const pctRec = receitaTotal > 0 ? (dados.receitaRecorrente / receitaTotal) * 100 : 0;

  const totalContratosAnim = useCountUp(dados.numContratos, 750, 150);
  const receitaTotalAnim = useCountUp(receitaTotal, 750, 150);
  const recReceitaAnim = useCountUp(dados.receitaRecorrente, 750, 350);
  const pontReceitaAnim = useCountUp(dados.receitaPontual, 750, 450);

  // Pipelines ordenados por receita total; top 6 preenchem o bloco inferior
  const pipelines = [...(dados.pipelineBreakdown ?? [])]
    .map((p) => ({ ...p, total: p.receitaRecorrente + p.receitaPontual }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
  const maxPipeline = Math.max(...pipelines.map((p) => p.total), 1);

  return (
    <SlideLayout section="commerce" padding="28px 36px">
      <style>{`
        @keyframes vendasGrowX { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @media (prefers-reduced-motion: reduce) { .vendas-grow { animation: none !important; transform: scaleX(1) !important; } }
      `}</style>
      <SlideHeader icon={BarChart3} iconColor="text-cyan-400" title={`Contratos Fechados — ${label}`} gradientColor="#06b6d4" />

      <div className="flex-1 flex flex-col gap-4 min-h-0">
        {/* Hero: totais + barra de proporção animada */}
        <div {...entrance(0)}>
          <SecondaryCard className="px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Total de contratos</p>
                <p className="text-4xl font-black text-white">{Math.round(totalContratosAnim)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Receita total</p>
                <p className="text-4xl font-black bg-gradient-to-r from-emerald-300 to-cyan-400 bg-clip-text text-transparent">
                  {fmtCompact(receitaTotalAnim)}
                </p>
              </div>
            </div>
            {/* Proporção Recorrente × Pontual (cresce na entrada) */}
            <div className="h-3 rounded-full overflow-hidden flex bg-white/[0.04] vendas-grow" style={{ transformOrigin: "left", animation: "vendasGrowX 700ms ease-out 250ms both" }}>
              <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${pctRec}%` }} />
              <div className="h-full bg-gradient-to-r from-violet-500 to-purple-400 flex-1" />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Recorrente {pctRec.toFixed(0)}%
              </span>
              <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                <span className="w-2 h-2 rounded-full bg-purple-400" /> Pontual {(100 - pctRec).toFixed(0)}%
              </span>
            </div>
          </SecondaryCard>
        </div>

        {/* Recorrente × Pontual: stats em linha, compactos */}
        <div className="grid grid-cols-2 gap-4">
          <div {...entrance(150)}>
            <SecondaryCard className="px-6 py-4 h-full" borderColor="#34d399">
              <div className="flex items-center justify-between mb-3">
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-widest">
                  <TrendingUp className="h-3.5 w-3.5" /> Recorrente (MRR)
                </span>
                <QoqBadge q={qoqVendas} />
              </div>
              <div className="flex gap-4">
                <StatInline label="Contratos" valor={String(dados.contratosRecorrente)} />
                <StatInline label="Receita" valor={fmtCompact(recReceitaAnim)} cor="text-emerald-400" />
                <StatInline label="Ticket médio" valor={fmtCompact(dados.tmRecorrente)} />
              </div>
            </SecondaryCard>
          </div>
          <div {...entrance(250)}>
            <SecondaryCard className="px-6 py-4 h-full" borderColor="#a855f7">
              <span className="flex items-center gap-1.5 text-xs font-bold text-purple-400 uppercase tracking-widest mb-3">
                <Zap className="h-3.5 w-3.5" /> Pontual
              </span>
              <div className="flex gap-4">
                <StatInline label="Contratos" valor={String(dados.contratosPontual)} />
                <StatInline label="Receita" valor={fmtCompact(pontReceitaAnim)} cor="text-purple-400" />
                <StatInline label="Ticket médio" valor={fmtCompact(dados.tmPontual)} />
              </div>
            </SecondaryCard>
          </div>
        </div>

        {/* Por pipeline: barras horizontais empilhadas (recorrente + pontual) */}
        {pipelines.length > 0 && (
          <div {...entrance(350)} >
            <SecondaryCard className="px-6 py-4 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest">Por pipeline</p>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" /> Recorrente
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <span className="w-2 h-2 rounded-full bg-purple-400" /> Pontual
                  </span>
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-center gap-2.5">
                {pipelines.map((p, i) => (
                  <div key={p.pipeline} className="flex items-center gap-3">
                    <span className="w-44 text-xs text-zinc-400 truncate text-right shrink-0" title={p.pipeline}>{p.pipeline}</span>
                    <div className="flex-1 h-5 rounded-md overflow-hidden flex bg-white/[0.03]">
                      <div
                        className="h-full flex vendas-grow"
                        style={{
                          width: `${(p.total / maxPipeline) * 100}%`,
                          transformOrigin: "left",
                          animation: `vendasGrowX 600ms ease-out ${450 + i * 80}ms both`,
                        }}
                      >
                        <div className="h-full bg-emerald-500/80" style={{ width: `${p.total > 0 ? (p.receitaRecorrente / p.total) * 100 : 0}%` }} />
                        <div className="h-full bg-purple-500/80 flex-1" />
                      </div>
                    </div>
                    <span className="w-20 text-xs font-bold text-white text-right shrink-0 tabular-nums">{fmtCompact(p.total)}</span>
                    <span className="w-16 text-[11px] text-zinc-500 text-right shrink-0 tabular-nums">{p.contratos} ctr</span>
                  </div>
                ))}
              </div>
            </SecondaryCard>
          </div>
        )}
      </div>
    </SlideLayout>
  );
}
