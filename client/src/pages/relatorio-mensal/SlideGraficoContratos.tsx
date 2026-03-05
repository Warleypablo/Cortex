import { BarChart3, TrendingUp, Zap } from "lucide-react";
import type { ContratosMes } from "./types";

interface Props {
  dados: ContratosMes;
  mesLabel: string;
}

function formatBRL(v: number): string {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(1)}k`;
  return `R$${v.toFixed(0)}`;
}

function KPICard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 text-center">
      <p className="text-xs text-zinc-400 mb-2 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold ${accent || "text-white"}`}>{value}</p>
    </div>
  );
}

export default function SlideGraficoContratos({ dados, mesLabel }: Props) {
  const total = dados.receitaRecorrente + dados.receitaPontual;

  return (
    <div className="w-full h-full flex flex-col bg-zinc-950 text-white p-10">
      <div className="flex items-center gap-3 mb-6">
        <BarChart3 className="h-7 w-7 text-cyan-400" />
        <h2 className="text-2xl font-bold">Contratos Fechados — {mesLabel}</h2>
      </div>

      {/* Total destaque */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-400 mb-1">Total de Contratos no Mês</p>
          <p className="text-4xl font-bold">{dados.numContratos}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-zinc-400 mb-1">Receita Total</p>
          <p className="text-4xl font-bold text-cyan-400">{formatBRL(total)}</p>
        </div>
      </div>

      {/* Cards divididos */}
      <div className="grid grid-cols-2 gap-6 flex-1">
        {/* Recorrente */}
        <div className="bg-zinc-900/40 border border-emerald-500/20 rounded-2xl p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wide">Recorrente (MRR)</h3>
          </div>
          <div className="grid grid-cols-3 gap-4 flex-1 items-center">
            <KPICard label="Contratos" value={dados.contratosRecorrente.toString()} />
            <KPICard label="Receita" value={formatBRL(dados.receitaRecorrente)} accent="text-emerald-400" />
            <KPICard label="Ticket Médio" value={formatBRL(dados.tmRecorrente)} />
          </div>
        </div>

        {/* Pontual */}
        <div className="bg-zinc-900/40 border border-purple-500/20 rounded-2xl p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5 text-purple-400" />
            <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wide">Pontual</h3>
          </div>
          <div className="grid grid-cols-3 gap-4 flex-1 items-center">
            <KPICard label="Contratos" value={dados.contratosPontual.toString()} />
            <KPICard label="Receita" value={formatBRL(dados.receitaPontual)} accent="text-purple-400" />
            <KPICard label="Ticket Médio" value={formatBRL(dados.tmPontual)} />
          </div>
        </div>
      </div>
    </div>
  );
}
