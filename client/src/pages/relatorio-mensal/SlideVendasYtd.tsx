import { ShoppingBag, TrendingUp, Zap } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { VendasMes } from "./types";
import SlideLayout from "./SlideLayout";
import { SlideHeader, SecondaryCard, ChartCard } from "./SlideComponents";

interface Props {
  vendasSeries: VendasMes[];
  mesLabel: string;
}

function fmtBRL(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(3).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1).replace(".", ",")}k`;
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
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

function makeBarLabel(data: VendasMes[], dataKey: "vendasMrr" | "vendasPontual") {
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

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const mrr = payload.find((p: any) => p.dataKey === "vendasMrr")?.value || 0;
  const pont = payload.find((p: any) => p.dataKey === "vendasPontual")?.value || 0;
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

export default function SlideVendasYtd({ vendasSeries, mesLabel }: Props) {
  const vendasMrrYtd     = vendasSeries.reduce((s, m) => s + m.vendasMrr, 0);
  const vendasPontualYtd = vendasSeries.reduce((s, m) => s + m.vendasPontual, 0);
  const vendasTotalYtd   = vendasMrrYtd + vendasPontualYtd;
  const contratosYtd     = vendasSeries.reduce((s, m) => s + m.numContratos, 0);
  const contratosMrr     = vendasSeries.filter(m => m.vendasMrr > 0).length;
  const contratosPont    = vendasSeries.filter(m => m.vendasPontual > 0).length;
  const mesAtual         = mesLabel.split(" ")[0];

  return (
    <SlideLayout section="comercial" padding="24px 32px">
      <SlideHeader
        icon={ShoppingBag}
        iconColor="text-amber-400"
        title={`Vendas YTD — ${mesLabel}`}
        gradientColor="#f59e0b"
      />

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3 mb-3 shrink-0">
        <SecondaryCard className="p-4 flex flex-col justify-center gap-1">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Vendas MRR YTD</p>
          </div>
          <p className="text-2xl font-black text-emerald-400">{fmtBRL(vendasMrrYtd)}</p>
          <p className="text-[10px] text-zinc-600">
            {contratosMrr > 0 ? `${contratosMrr} meses com vendas — Jan → ${mesAtual}` : `Jan → ${mesAtual}`}
          </p>
        </SecondaryCard>

        <SecondaryCard className="p-4 flex flex-col justify-center gap-1">
          <div className="flex items-center gap-1.5 mb-1">
            <Zap className="h-3.5 w-3.5 text-purple-400" />
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Vendas Pontual YTD</p>
          </div>
          <p className="text-2xl font-black text-purple-400">{fmtBRL(vendasPontualYtd)}</p>
          <p className="text-[10px] text-zinc-600">
            {contratosPont > 0 ? `${contratosPont} meses com vendas — Jan → ${mesAtual}` : `Jan → ${mesAtual}`}
          </p>
        </SecondaryCard>

        <SecondaryCard className="p-4 flex flex-col justify-center gap-1" borderColor="#f59e0b">
          <div className="flex items-center gap-1.5 mb-1">
            <ShoppingBag className="h-3.5 w-3.5 text-amber-400" />
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Total Vendas YTD</p>
          </div>
          <p className="text-2xl font-black text-amber-400">{fmtBRL(vendasTotalYtd)}</p>
          <p className="text-[10px] text-zinc-600">{contratosYtd} contrato{contratosYtd !== 1 ? "s" : ""} fechado{contratosYtd !== 1 ? "s" : ""}</p>
        </SecondaryCard>
      </div>

      {/* Chart */}
      <ChartCard className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-zinc-300">Vendas por Mês — Jan → {mesAtual}</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
              <span className="text-xs text-zinc-500">MRR</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
              <span className="text-xs text-zinc-500">Pontual</span>
            </div>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={vendasSeries} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                axisLine={{ stroke: "#3f3f46" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#a1a1aa", fontSize: 10 }}
                axisLine={{ stroke: "#3f3f46" }}
                tickLine={false}
                tickFormatter={fmtK}
                width={50}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="vendasMrr" name="MRR" stackId="vendas" radius={[0, 0, 0, 0]} barSize={36} fill="#34d399" fillOpacity={0.8} label={makeBarLabel(vendasSeries, "vendasMrr")} />
              <Bar dataKey="vendasPontual" name="Pontual" stackId="vendas" radius={[4, 4, 0, 0]} barSize={36} fill="#a855f7" fillOpacity={0.7} label={makeBarLabel(vendasSeries, "vendasPontual")} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </SlideLayout>
  );
}
