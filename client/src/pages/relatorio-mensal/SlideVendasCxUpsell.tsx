import { Handshake } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TurboMetrics } from "./types";
import SlideLayout from "./SlideLayout";
import { SlideHeader, SecondaryCard, ChartCard } from "./SlideComponents";

interface Props {
  metrics: TurboMetrics;
  mesLabel: string;
}

function fmtBRL(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

function fmtK(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
  return `${Math.round(v)}`;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const mrr = payload.find((p: any) => p.dataKey === "mrr")?.value || 0;
  const pont = payload.find((p: any) => p.dataKey === "pontual")?.value || 0;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs min-w-[160px]">
      <p className="font-bold text-white mb-1.5">{label}</p>
      <div className="space-y-0.5">
        <div className="flex justify-between gap-3">
          <span className="text-emerald-400">MRR:</span>
          <span className="font-bold text-emerald-400">{fmtBRL(mrr)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-purple-400">Pontual:</span>
          <span className="font-bold text-purple-400">{fmtBRL(pont)}</span>
        </div>
        <div className="flex justify-between gap-3 border-t border-zinc-700 pt-1 mt-1">
          <span className="text-amber-400">Total:</span>
          <span className="font-bold text-amber-400">{fmtBRL(mrr + pont)}</span>
        </div>
      </div>
    </div>
  );
}

export default function SlideVendasCxUpsell({ metrics, mesLabel }: Props) {
  const { crosssellMrr, crosssellPontual, crosssellContratos, crosssellPorCloser } = metrics;
  const crosssellTotal = crosssellMrr + crosssellPontual;

  const chartData = crosssellPorCloser.map(c => ({
    nome: c.nome,
    mrr: c.mrr,
    pontual: c.pontual,
  }));

  return (
    <SlideLayout section="comercial" padding="24px 32px">
      <SlideHeader
        icon={Handshake}
        iconColor="text-amber-400"
        title={`Vendas CX & Upsell — ${mesLabel}`}
        gradientColor="#f59e0b"
      />

      <div className="grid grid-cols-3 gap-3 mb-3 shrink-0">
        <SecondaryCard className="p-4 flex flex-col justify-center gap-1">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">MRR CX / Upsell</p>
          <p className="text-2xl font-black text-emerald-400">{fmtBRL(crosssellMrr)}</p>
          <p className="text-[10px] text-zinc-600">
            {crosssellContratos} contrato{crosssellContratos !== 1 ? "s" : ""} no mês
          </p>
        </SecondaryCard>

        <SecondaryCard className="p-4 flex flex-col justify-center gap-1">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Pontual CX / Upsell</p>
          <p className="text-2xl font-black text-purple-400">{fmtBRL(crosssellPontual)}</p>
          <p className="text-[10px] text-zinc-600">{mesLabel}</p>
        </SecondaryCard>

        <SecondaryCard className="p-4 flex flex-col justify-center gap-1" borderColor="#f59e0b">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Total CX / Upsell</p>
          <p className="text-2xl font-black text-amber-400">{fmtBRL(crosssellTotal)}</p>
          <p className="text-[10px] text-zinc-600">{mesLabel}</p>
        </SecondaryCard>
      </div>

      <ChartCard className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-zinc-300">Ranking Closers — CX & Upsell</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
              <span className="text-xs text-zinc-500">MRR</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-purple-400" />
              <span className="text-xs text-zinc-500">Pontual</span>
            </div>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
              Sem vendas CX/Upsell no mês
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={chartData}
                margin={{ top: 4, right: 60, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                <YAxis
                  type="category"
                  dataKey="nome"
                  tick={{ fill: "#a1a1aa", fontSize: 11 }}
                  axisLine={{ stroke: "#3f3f46" }}
                  tickLine={false}
                  width={120}
                />
                <XAxis
                  type="number"
                  tick={{ fill: "#a1a1aa", fontSize: 10 }}
                  axisLine={{ stroke: "#3f3f46" }}
                  tickLine={false}
                  tickFormatter={fmtK}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="mrr" name="MRR" stackId="cx" fill="#34d399" fillOpacity={0.85} />
                <Bar dataKey="pontual" name="Pontual" stackId="cx" fill="#c084fc" fillOpacity={0.8} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </ChartCard>
    </SlideLayout>
  );
}
