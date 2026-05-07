import { TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { FaturamentoYtdData } from "./types";
import SlideLayout from "./SlideLayout";
import { SlideHeader, SecondaryCard, ChartCard } from "./SlideComponents";

interface Props {
  data: FaturamentoYtdData;
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

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs min-w-[140px]">
      <p className="font-bold text-white mb-1">{label}</p>
      <div className="flex justify-between gap-3">
        <span className="text-emerald-400">Recebido:</span>
        <span className="font-bold text-emerald-400">{fmtBRL(payload[0]?.value || 0)}</span>
      </div>
    </div>
  );
}

export default function SlideFaturamentoYtd({ data, mesLabel }: Props) {
  const faturamentoLiquidoYtd = data.faturamentoBrutoYtd - data.inadimplenciaYtd;
  const totalRecebidoYtd = data.dfcRecebimentoMensal.reduce((s, m) => s + m.recebido, 0);
  const maxRecebido = Math.max(...data.dfcRecebimentoMensal.map(m => m.recebido), 1);

  return (
    <SlideLayout section="intro" padding="24px 32px">
      <SlideHeader
        icon={TrendingUp}
        iconColor="text-emerald-400"
        title={`Faturamento YTD — ${mesLabel}`}
        gradientColor="#10b981"
      />

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3 mb-3 shrink-0">
        <SecondaryCard className="p-3 flex flex-col justify-center gap-1">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="h-3.5 w-3.5 text-cyan-400" />
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Faturamento Bruto YTD</p>
          </div>
          <p className="text-xl font-black text-cyan-400">{fmtBRL(data.faturamentoBrutoYtd)}</p>
          <p className="text-[10px] text-zinc-600">Total faturável Jan → {mesLabel.split(" ")[0]}</p>
        </SecondaryCard>

        <SecondaryCard className="p-3 flex flex-col justify-center gap-1">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">(-) Inadimplência YTD</p>
          </div>
          <p className="text-xl font-black text-red-400">{fmtBRL(data.inadimplenciaYtd)}</p>
          <p className="text-[10px] text-zinc-600">
            {data.faturamentoBrutoYtd > 0
              ? `${((data.inadimplenciaYtd / data.faturamentoBrutoYtd) * 100).toFixed(1)}% do bruto`
              : "—"}
          </p>
        </SecondaryCard>

        <SecondaryCard className="p-3 flex flex-col justify-center gap-1" borderColor="#10b981">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">(=) Fat. Líquido YTD</p>
          </div>
          <p className="text-xl font-black text-emerald-400">{fmtBRL(faturamentoLiquidoYtd)}</p>
          <p className="text-[10px] text-zinc-600">Bruto − Inadimplência</p>
        </SecondaryCard>
      </div>

      {/* DFC Recebimento chart */}
      <ChartCard className="flex-1" title="">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-zinc-300">
            DFC Recebimento — Jan → {mesLabel.split(" ")[0]}
          </p>
          <div className="bg-emerald-500/10 rounded-lg px-3 py-1">
            <span className="text-xs text-zinc-500">Total recebido: </span>
            <span className="text-sm font-black text-emerald-400">{fmtBRL(totalRecebidoYtd)}</span>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.dfcRecebimentoMensal}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
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
              <Bar dataKey="recebido" name="Recebido" radius={[4, 4, 0, 0]} barSize={40}>
                {data.dfcRecebimentoMensal.map((entry, i) => (
                  <Cell
                    key={i}
                    fill="#34d399"
                    fillOpacity={entry.recebido > 0 ? 0.4 + (entry.recebido / maxRecebido) * 0.55 : 0.15}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </SlideLayout>
  );
}
