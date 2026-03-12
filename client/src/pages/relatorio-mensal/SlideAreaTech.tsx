import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import type { TechSlideData } from "./types";

interface Props {
  techData: TechSlideData;
  mesLabel: string;
}

const TIPO_COLORS: Record<string, string> = {
  "LP Shopify": "#f97316",
  "Landing Page": "#ec4899",
  "E-Commerce Standard": "#22c55e",
  "Ecommerce": "#22c55e",
  "Site": "#3b82f6",
  "CRO": "#eab308",
  "Sustentação": "#8b5cf6",
  "Alteração": "#6366f1",
  "Integração": "#71717a",
  "Outros": "#71717a",
};

function getColor(tipo: string): string {
  return TIPO_COLORS[tipo] || "#71717a";
}

function fmtBRL(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

function fmtK(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
  return `${Math.round(v)}`;
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

const RADIAN = Math.PI / 180;
function renderPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, value }: any) {
  if (!value) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight="bold">
      {value}
    </text>
  );
}

function BarLabel({ x, y, width, height, value, fill }: any) {
  if (!value || height < 14) return null;
  return (
    <text
      x={x + width / 2}
      y={y + height / 2}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={10}
      fontWeight="bold"
    >
      {typeof value === "number" && value >= 1000 ? fmtK(value) : value}
    </text>
  );
}

function makeStackTopLabel(data: Record<string, any>[], tiposList: string[], isCurrency: boolean) {
  return ({ x, y, width, index }: any) => {
    if (index == null || !data[index]) return null;
    const row = data[index];
    const total = tiposList.reduce((s, t) => s + ((row[t] as number) || 0), 0);
    if (!total) return null;
    return (
      <text x={x + width / 2} y={y - 6} fill="white" textAnchor="middle" fontSize={12} fontWeight="bold">
        {isCurrency ? fmtK(total) : total}
      </text>
    );
  };
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

  // Filtrar apenas meses com dados (soma dos valores numéricos > 0)
  const hasData = (row: Record<string, any>) =>
    Object.entries(row).some(([k, v]) => k !== "month" && k !== "label" && typeof v === "number" && v > 0);
  const entregasFiltered = entregasPorTipo.filter(hasData);
  const receitaFiltered = receitaPorTipo.filter(hasData);

  const tipos = entregasPorTipo.length > 0
    ? Object.keys(entregasPorTipo[0]).filter(k => k !== "month" && k !== "label")
    : [];

  const totalAbertoValor = emAbertoPorTipo.reduce((s, t) => s + t.valor, 0);

  const pieData = emAbertoPorTipo.filter(t => t.quantidade > 0);

  return (
    <div
      className="w-full h-full flex flex-col text-white relative overflow-hidden"
      style={{
        padding: "28px 36px",
        background: "linear-gradient(145deg, #0d0b2e 0%, #1e1145 35%, #2a1a5e 55%, #1a0f3a 80%, #0d0b2e 100%)",
      }}
    >
      {/* Glow effects */}
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-15" style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)" }} />
      <div className="absolute bottom-[-15%] left-[-5%] w-[400px] h-[400px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)" }} />
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      {/* Title */}
      <div className="relative z-10 shrink-0 mb-5">
        <h2 className="text-4xl font-black text-center tracking-tight" style={{ fontFamily: "serif" }}>
          Área Tech
        </h2>
        <div className="h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent mt-3" />
      </div>

      {/* Top row */}
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0 mb-4 relative z-10">
        {/* KPI cards */}
        <div className="flex gap-3">
          {/* Projetos Entregues */}
          <div className="flex-1 border border-white/[0.08] rounded-xl bg-white/[0.04] backdrop-blur-xl shadow-lg shadow-black/20 flex flex-col items-center justify-center p-3">
            <p className="text-xs text-zinc-300 text-center mb-2">Projetos<br />entregues</p>
            <p className="text-4xl font-black mb-3">{kpis.entregues}</p>
            <span className="text-xs text-emerald-400 border border-emerald-500/30 rounded-lg px-3 py-1">
              Valor: {fmtBRL(kpis.valorEntregues)}
            </span>
          </div>

          {/* Tempo Medio */}
          <div className="flex-1 border border-white/[0.08] rounded-xl bg-white/[0.04] backdrop-blur-xl shadow-lg shadow-black/20 flex flex-col items-center justify-center p-3">
            <p className="text-xs text-zinc-300 text-center mb-2">Tempo médio<br />por projeto</p>
            <p className="text-4xl font-black mb-3">{kpis.tempoMedio}</p>
            <span className="text-xs text-zinc-500 invisible px-3 py-1">—</span>
          </div>

          {/* Adicionados */}
          <div className="flex-1 border border-white/[0.08] rounded-xl bg-white/[0.04] backdrop-blur-xl shadow-lg shadow-black/20 flex flex-col items-center justify-center p-3">
            <p className="text-xs text-zinc-300 text-center mb-2">Adicionados em<br />{displayLabel}</p>
            <p className="text-4xl font-black mb-3">{kpis.adicionados}</p>
            <span className="text-xs text-cyan-400 border border-cyan-500/30 rounded-lg px-3 py-1">
              {fmtBRL(kpis.valorAdicionados)}
            </span>
          </div>
        </div>

        {/* Stacked Bar: N Projetos Entregues */}
        <div className="border border-white/[0.08] rounded-xl bg-white/[0.04] backdrop-blur-xl shadow-lg shadow-black/20 p-3 flex flex-col">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <p className="text-sm font-bold text-zinc-200">N° Projetos Entregues</p>
            <div className="flex items-center gap-2 flex-wrap">
              {tipos.map(tipo => (
                <div key={tipo} className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getColor(tipo) }} />
                  <span className="text-[9px] text-zinc-400">{tipo}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={entregasFiltered} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a40" />
                <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 10 }} axisLine={{ stroke: "#3f3f46" }} tickLine={false} />
                <YAxis tick={{ fill: "#a1a1aa", fontSize: 10 }} axisLine={{ stroke: "#3f3f46" }} tickLine={false} allowDecimals={false} width={30} />
                <Tooltip content={<ChartTooltipContent isCurrency={false} />} />
                {tipos.map((tipo, i) => (
                  <Bar
                    key={tipo}
                    dataKey={tipo}
                    name={tipo}
                    stackId="a"
                    fill={getColor(tipo)}
                    radius={i === tipos.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                    label={i === tipos.length - 1 ? makeStackTopLabel(entregasFiltered, tipos, false) : <BarLabel />}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0 relative z-10">
        {/* Pie: Projetos em Aberto */}
        <div className="border border-white/[0.08] rounded-xl bg-white/[0.04] backdrop-blur-xl shadow-lg shadow-black/20 p-3 flex flex-col">
          <p className="text-sm font-bold text-zinc-200 text-center mb-1">Projetos em Aberto</p>
          <div className="flex-1 min-h-0 flex items-center">
            <div className="w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="quantidade"
                    nameKey="tipo"
                    cx="50%"
                    cy="50%"
                    outerRadius="85%"
                    label={renderPieLabel}
                    labelLine={false}
                    stroke="none"
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.tipo} fill={getColor(entry.tipo)} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 flex flex-col gap-2 pl-4">
              {pieData.map((entry) => (
                <div key={entry.tipo} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: getColor(entry.tipo) }} />
                  <span className="text-xs text-zinc-300">{entry.tipo}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-cyan-400 text-center mt-1 shrink-0">
            {fmtBRL(totalAbertoValor)} em projetos abertos
          </p>
        </div>

        {/* Stacked Bar: Receita Tech */}
        <div className="border border-white/[0.08] rounded-xl bg-white/[0.04] backdrop-blur-xl shadow-lg shadow-black/20 p-3 flex flex-col">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <p className="text-sm font-bold text-zinc-200">Receita Tech</p>
            <div className="flex items-center gap-2 flex-wrap">
              {tipos.map(tipo => (
                <div key={tipo} className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getColor(tipo) }} />
                  <span className="text-[9px] text-zinc-400">{tipo}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={receitaFiltered} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a40" />
                <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 10 }} axisLine={{ stroke: "#3f3f46" }} tickLine={false} />
                <YAxis tick={{ fill: "#a1a1aa", fontSize: 10 }} axisLine={{ stroke: "#3f3f46" }} tickLine={false} tickFormatter={fmtK} width={45} />
                <Tooltip content={<ChartTooltipContent isCurrency={true} />} />
                {tipos.map((tipo, i) => (
                  <Bar
                    key={tipo}
                    dataKey={tipo}
                    name={tipo}
                    stackId="a"
                    fill={getColor(tipo)}
                    radius={i === tipos.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                    label={i === tipos.length - 1 ? makeStackTopLabel(receitaFiltered, tipos, true) : <BarLabel />}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
