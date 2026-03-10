import { BarChart3, TrendingUp, Zap, FileText, DollarSign, Receipt } from "lucide-react";
import type { ContratosMes } from "./types";

interface Props {
  dados: ContratosMes;
  mesLabel: string;
}

function formatBRL(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
  return `R$ ${v.toFixed(0)}`;
}

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center gap-4 bg-zinc-800/50 rounded-xl px-5 py-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${accent ? accent.replace("text-", "bg-").replace("400", "500/15") : "bg-zinc-700/30"}`}>
        <Icon className={`h-5 w-5 ${accent || "text-zinc-400"}`} />
      </div>
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-wide">{label}</p>
        <p className={`text-xl font-bold ${accent || "text-white"}`}>{value}</p>
      </div>
    </div>
  );
}

export default function SlideGraficoContratos({ dados, mesLabel }: Props) {
  const total = dados.receitaRecorrente + dados.receitaPontual;
  const pctRecorrente = total > 0 ? (dados.receitaRecorrente / total) * 100 : 0;
  const pctPontual = total > 0 ? (dados.receitaPontual / total) * 100 : 0;

  return (
    <div className="w-full h-full flex flex-col bg-zinc-950 text-white p-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <BarChart3 className="h-7 w-7 text-cyan-400" />
        <h2 className="text-2xl font-bold">Contratos Fechados — {mesLabel}</h2>
      </div>

      {/* Top row: Total summary with progress bar */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 mb-6">
        <div className="flex items-end justify-between mb-5">
          <div>
            <p className="text-sm text-zinc-500 mb-1">Total de Contratos</p>
            <p className="text-5xl font-black">{dados.numContratos}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-zinc-500 mb-1">Receita Total</p>
            <p className="text-5xl font-black text-cyan-400">{formatBRL(total)}</p>
          </div>
        </div>

        {/* Stacked bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-4 rounded-full overflow-hidden bg-zinc-800 flex">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${pctRecorrente}%` }}
            />
            <div
              className="h-full bg-purple-500 transition-all"
              style={{ width: `${pctPontual}%` }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-xs text-zinc-400">Recorrente {pctRecorrente.toFixed(0)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span className="text-xs text-zinc-400">Pontual {pctPontual.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Bottom: Two sections */}
      <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
        {/* Recorrente */}
        <div className="bg-zinc-900/40 border border-emerald-500/20 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">Recorrente (MRR)</h3>
          </div>
          <div className="space-y-3 flex-1 flex flex-col justify-center">
            <StatCard icon={FileText} label="Contratos" value={dados.contratosRecorrente.toString()} />
            <StatCard icon={DollarSign} label="Receita" value={formatBRL(dados.receitaRecorrente)} accent="text-emerald-400" />
            <StatCard icon={Receipt} label="Ticket Médio" value={formatBRL(dados.tmRecorrente)} />
          </div>
        </div>

        {/* Pontual */}
        <div className="bg-zinc-900/40 border border-purple-500/20 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5 text-purple-400" />
            <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider">Pontual</h3>
          </div>
          <div className="space-y-3 flex-1 flex flex-col justify-center">
            <StatCard icon={FileText} label="Contratos" value={dados.contratosPontual.toString()} />
            <StatCard icon={DollarSign} label="Receita" value={formatBRL(dados.receitaPontual)} accent="text-purple-400" />
            <StatCard icon={Receipt} label="Ticket Médio" value={formatBRL(dados.tmPontual)} />
          </div>
        </div>
      </div>

      {/* Pipeline Breakdown */}
      {dados.pipelineBreakdown && dados.pipelineBreakdown.length > 0 && (
        <div className="mt-4 bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 shrink-0">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold mb-3">Por Pipeline</p>
          <div className="grid grid-cols-3 gap-3">
            {dados.pipelineBreakdown.map((p) => (
              <div key={p.pipeline} className="bg-zinc-800/40 rounded-xl px-4 py-3">
                <p className="text-sm font-bold text-white mb-1">{p.pipeline}</p>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-zinc-400">{p.contratos} contratos</span>
                  <span className="text-emerald-400 font-bold">{formatBRL(p.receitaRecorrente)} R</span>
                  <span className="text-purple-400 font-bold">{formatBRL(p.receitaPontual)} P</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
