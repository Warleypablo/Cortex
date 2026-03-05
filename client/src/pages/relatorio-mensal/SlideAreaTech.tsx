import { Monitor, Package, Clock, PlusCircle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import type { TechSlideData } from "./types";

interface Props {
  techData: TechSlideData;
  mesLabel: string;
}

const TIPO_COLORS: Record<string, string> = {
  "Landing Page": "#3b82f6",
  "E-Commerce Standard": "#22c55e",
  "Site": "#f59e0b",
  "CRO": "#ec4899",
  "LP Shopify": "#8b5cf6",
  "Alteração": "#6366f1",
  "Integração": "#71717a",
  "Outros": "#71717a",
};

function getColor(tipo: string): string {
  return TIPO_COLORS[tipo] || "#71717a";
}

function fmtBRL(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1).replace(".", ",")}k`;
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

function fmtK(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
  return `${Math.round(v)}`;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 ${className}`}>
      {children}
    </div>
  );
}

function ChartTooltipContent({ active, payload, label, isCurrency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs">
      <p className="font-bold text-white mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.fill || p.color }}>
          {p.name}: {isCurrency ? fmtBRL(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

export default function SlideAreaTech({ techData, mesLabel }: Props) {
  if (!techData) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-950 text-zinc-500">
        Carregando dados Tech...
      </div>
    );
  }

  const { kpis, entregasPorTipo, receitaPorTipo, emAbertoPorTipo, mesLabel: techMesLabel } = techData;
  const displayLabel = techMesLabel || mesLabel;

  // Get all tipo keys from data (excluding month/label)
  const tipos = entregasPorTipo.length > 0
    ? Object.keys(entregasPorTipo[0]).filter(k => k !== "month" && k !== "label")
    : [];

  const totalAberto = emAbertoPorTipo.reduce((s, t) => s + t.quantidade, 0);
  const totalAbertoValor = emAbertoPorTipo.reduce((s, t) => s + t.valor, 0);

  return (
    <div className="w-full h-full flex flex-col bg-zinc-950 text-white" style={{ padding: "24px 32px" }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3 shrink-0">
        <Monitor className="h-6 w-6 text-blue-400" />
        <h2 className="text-xl font-bold">Area Tech — {displayLabel}</h2>
      </div>

      {/* Top row: KPI cards (col-span-2) + Stacked Bar entregas (col-span-5) */}
      <div className="flex-1 grid grid-cols-7 gap-3 min-h-0 mb-3">
        {/* KPI Cards */}
        <div className="col-span-2 flex flex-col gap-2">
          <Card className="flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 mb-1">
              <Package className="h-3.5 w-3.5 text-emerald-400" />
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Projetos Entregues</p>
            </div>
            <p className="text-3xl font-black text-emerald-400">{kpis.entregues}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{fmtBRL(kpis.valorEntregues)}</p>
          </Card>

          <Card className="flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Tempo Medio</p>
            </div>
            <p className="text-3xl font-black text-amber-400">{kpis.tempoMedio}<span className="text-base font-medium text-zinc-400 ml-1">dias</span></p>
          </Card>

          <Card className="flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 mb-1">
              <PlusCircle className="h-3.5 w-3.5 text-blue-400" />
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Adicionados</p>
            </div>
            <p className="text-3xl font-black text-blue-400">{kpis.adicionados}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{fmtBRL(kpis.valorAdicionados)}</p>
          </Card>
        </div>

        {/* Stacked Bar: N Projetos Entregues */}
        <Card className="col-span-5 flex flex-col">
          <p className="text-sm font-bold text-zinc-300 mb-1">N° Projetos Entregues</p>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={entregasPorTipo} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#a1a1aa", fontSize: 10 }}
                  axisLine={{ stroke: "#3f3f46" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#a1a1aa", fontSize: 10 }}
                  axisLine={{ stroke: "#3f3f46" }}
                  tickLine={false}
                  allowDecimals={false}
                  width={30}
                />
                <Tooltip content={<ChartTooltipContent isCurrency={false} />} />
                {tipos.map((tipo, i) => (
                  <Bar
                    key={tipo}
                    dataKey={tipo}
                    name={tipo}
                    stackId="a"
                    fill={getColor(tipo)}
                    radius={i === tipos.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Bottom row: Pie em aberto (col-span-2) + Stacked Bar receita (col-span-5) */}
      <div className="flex-1 grid grid-cols-7 gap-3 min-h-0">
        {/* Pie Chart: Projetos em Aberto */}
        <Card className="col-span-2 flex flex-col">
          <p className="text-sm font-bold text-zinc-300 mb-1">Projetos em Aberto</p>
          <div className="flex-1 min-h-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={emAbertoPorTipo}
                  dataKey="quantidade"
                  nameKey="tipo"
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="85%"
                  strokeWidth={1}
                  stroke="#18181b"
                >
                  {emAbertoPorTipo.map((entry) => (
                    <Cell key={entry.tipo} fill={getColor(entry.tipo)} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs">
                        <p className="font-bold text-white">{d.tipo}</p>
                        <p className="text-zinc-300">{d.quantidade} projetos</p>
                        <p className="text-zinc-400">{fmtBRL(d.valor)}</p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-2xl font-black">{totalAberto}</p>
              <p className="text-[9px] text-zinc-500">{fmtBRL(totalAbertoValor)}</p>
            </div>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
            {emAbertoPorTipo.map((t) => (
              <div key={t.tipo} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getColor(t.tipo) }} />
                <span className="text-[8px] text-zinc-400">{t.tipo} ({t.quantidade})</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Stacked Bar: Receita Tech */}
        <Card className="col-span-5 flex flex-col">
          <p className="text-sm font-bold text-zinc-300 mb-1">Receita Tech</p>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={receitaPorTipo} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#a1a1aa", fontSize: 10 }}
                  axisLine={{ stroke: "#3f3f46" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#a1a1aa", fontSize: 10 }}
                  axisLine={{ stroke: "#3f3f46" }}
                  tickLine={false}
                  tickFormatter={fmtK}
                  width={45}
                />
                <Tooltip content={<ChartTooltipContent isCurrency={true} />} />
                {tipos.map((tipo, i) => (
                  <Bar
                    key={tipo}
                    dataKey={tipo}
                    name={tipo}
                    stackId="a"
                    fill={getColor(tipo)}
                    radius={i === tipos.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
