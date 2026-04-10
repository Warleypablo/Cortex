import { BarChart3, TrendingUp, Zap } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { ContratosMes } from "./types";
import SlideLayout from "./SlideLayout";
import { SlideHeader } from "./SlideComponents";

interface Props {
  dados: ContratosMes;
  mesLabel: string;
}

function formatBRL(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
  return `R$ ${v.toFixed(0)}`;
}

function fmtK(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
  return `${Math.round(v)}`;
}

function fmtBarLabel(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000).toFixed(0)}k`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
  return `${Math.round(v)}`;
}

function makeBarLabel(data: any[], dataKey: string) {
  return ({ x, y, width, height, index }: any) => {
    if (index == null || height < 16) return null;
    const val = data[index]?.[dataKey] || 0;
    if (val <= 0) return null;
    return (
      <text x={x + width / 2} y={y + height / 2} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
        {fmtBarLabel(val)}
      </text>
    );
  };
}

// Label combinado para a barra do topo: segmento interno (pontual) + total acima da stack
function makeTopBarCombinedLabel(data: any[]) {
  return ({ x, y, width, height, index }: any) => {
    if (index == null) return null;
    const d = data[index] || {};
    const pontual = d.vendasPontual || 0;
    const total = (d.vendasMrr || 0) + pontual;
    return (
      <g>
        {total > 0 && (
          <text
            x={x + width / 2}
            y={y - 6}
            fill="#f4f4f5"
            textAnchor="middle"
            fontSize={12}
            fontWeight="bold"
          >
            {fmtBarLabel(total)}
          </text>
        )}
        {pontual > 0 && height >= 16 && (
          <text
            x={x + width / 2}
            y={y + height / 2}
            fill="white"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={11}
            fontWeight="bold"
          >
            {fmtBarLabel(pontual)}
          </text>
        )}
      </g>
    );
  };
}

function ChartTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs">
      <p className="font-bold text-white mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color || p.fill }}>
          {p.name}: {formatBRL(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function SlideGraficoContratos({ dados, mesLabel }: Props) {
  const total = dados.receitaRecorrente + dados.receitaPontual;
  const pctRecorrente = total > 0 ? (dados.receitaRecorrente / total) * 100 : 0;
  const pctPontual = total > 0 ? (dados.receitaPontual / total) * 100 : 0;

  const series = dados.vendasSeries || [];

  return (
    <SlideLayout section="comercial" padding="24px 32px">
      <SlideHeader
        icon={BarChart3}
        iconColor="text-cyan-400"
        title={`Contratos Fechados — ${mesLabel}`}
        gradientColor="#06b6d4"
      />

      {/* Top row: Total summary with progress bar */}
      <div className="bg-white/[0.04] border border-white/[0.08] shadow-lg shadow-black/20 rounded-2xl px-5 py-3 mb-3">
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-xs text-zinc-500 mb-0.5">Total de Contratos</p>
            <p className="text-3xl font-black">{dados.numContratos}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-500 mb-0.5">Receita Total</p>
            <p className="text-3xl font-black text-cyan-400">{formatBRL(total)}</p>
          </div>
        </div>

        {/* Stacked bar */}
        <div className="flex-1 h-3 rounded-full overflow-hidden bg-zinc-800 flex">
          <div className="h-full bg-emerald-500" style={{ width: `${pctRecorrente}%` }} />
          <div className="h-full bg-purple-500" style={{ width: `${pctPontual}%` }} />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-zinc-400">Recorrente {pctRecorrente.toFixed(0)}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span className="text-xs text-zinc-400">Pontual {pctPontual.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Bottom: Chart + metrics */}
      <div className={`flex-1 grid ${series.length > 0 ? "grid-cols-5" : "grid-cols-2"} gap-3 min-h-0`}>
        {/* Chart - only if data exists */}
        {series.length > 0 && (
          <div className="col-span-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Vendas por Mês</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
                  <span className="text-xs text-zinc-500">MRR</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
                  <span className="text-xs text-zinc-500">Pontual</span>
                </div>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#a1a1aa", fontSize: 10 }}
                    axisLine={{ stroke: "#3f3f46" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#a1a1aa", fontSize: 9 }}
                    axisLine={{ stroke: "#3f3f46" }}
                    tickLine={false}
                    tickFormatter={fmtK}
                    width={45}
                  />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="vendasMrr" name="MRR" stackId="vendas" radius={[0, 0, 0, 0]} barSize={32} fill="#34d399" fillOpacity={0.8} label={makeBarLabel(series, "vendasMrr")} />
                  <Bar dataKey="vendasPontual" name="Pontual" stackId="vendas" radius={[4, 4, 0, 0]} barSize={32} fill="#a855f7" fillOpacity={0.7} label={makeTopBarCombinedLabel(series)} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Metrics cards */}
        <div className={`${series.length > 0 ? "col-span-2" : "col-span-2"} flex flex-col gap-2`}>
          {/* Recorrente */}
          <div className="flex-1 bg-white/[0.03] border border-emerald-500/15 rounded-xl p-3 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Recorrente (MRR)</h3>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-400">Contratos</span>
                <span className="text-sm font-bold">{dados.contratosRecorrente}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-400">Receita</span>
                <span className="text-sm font-bold text-emerald-400">{formatBRL(dados.receitaRecorrente)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-400">Ticket Medio</span>
                <span className="text-sm font-bold">{formatBRL(dados.tmRecorrente)}</span>
              </div>
            </div>
          </div>

          {/* Pontual */}
          <div className="flex-1 bg-white/[0.03] border border-purple-500/15 rounded-xl p-3 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="h-3.5 w-3.5 text-purple-400" />
              <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider">Pontual</h3>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-400">Contratos</span>
                <span className="text-sm font-bold">{dados.contratosPontual}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-400">Receita</span>
                <span className="text-sm font-bold text-purple-400">{formatBRL(dados.receitaPontual)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-400">Ticket Medio</span>
                <span className="text-sm font-bold">{formatBRL(dados.tmPontual)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
