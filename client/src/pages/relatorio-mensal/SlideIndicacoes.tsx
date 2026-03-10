import { Gift, FileText, DollarSign, Users } from "lucide-react";
import type { Indicacoes } from "./types";

interface Props {
  dados: Indicacoes;
  mesLabel: string;
}

function formatBRL(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
  return `R$ ${v.toFixed(0)}`;
}

function KpiCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent: string }) {
  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-6 flex flex-col items-center text-center">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${accent.replace("text-", "bg-").replace("400", "500/15")}`}>
        <Icon className={`h-6 w-6 ${accent}`} />
      </div>
      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-black ${accent}`}>{value}</p>
    </div>
  );
}

export default function SlideIndicacoes({ dados, mesLabel }: Props) {
  const valorTotal = dados.valorRecorrente + dados.valorPontual;
  const hasData = dados.indicacoesRecebidas > 0 || dados.contratosFechados > 0;

  if (!hasData) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 text-white p-12">
        <Gift className="h-16 w-16 text-emerald-500 mb-6" />
        <h2 className="text-3xl font-bold mb-2">Indique e Ganhe — {mesLabel}</h2>
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-12 text-center max-w-lg">
          <p className="text-zinc-500 text-base">Nenhuma indicacao registrada neste mes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-zinc-950 text-white p-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Gift className="h-7 w-7 text-emerald-400" />
        <h2 className="text-2xl font-bold">Indique e Ganhe — {mesLabel}</h2>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <KpiCard
          icon={Users}
          label="Indicacoes Recebidas"
          value={dados.indicacoesRecebidas.toString()}
          accent="text-blue-400"
        />
        <KpiCard
          icon={FileText}
          label="Contratos Fechados"
          value={dados.contratosFechados.toString()}
          accent="text-emerald-400"
        />
        <KpiCard
          icon={DollarSign}
          label="Valor Total"
          value={formatBRL(valorTotal)}
          accent="text-cyan-400"
        />
      </div>

      {/* Revenue breakdown */}
      <div className="flex-1 flex items-center justify-center">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 flex gap-12">
          <div className="text-center">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Recorrente</p>
            <p className="text-2xl font-bold text-emerald-400">{formatBRL(dados.valorRecorrente)}</p>
          </div>
          <div className="w-px bg-zinc-800" />
          <div className="text-center">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Pontual</p>
            <p className="text-2xl font-bold text-purple-400">{formatBRL(dados.valorPontual)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
