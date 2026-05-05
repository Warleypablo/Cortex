import { Code2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { TechSlideData } from "./types";
import SlideLayout from "./SlideLayout";
import { SlideHeader, SecondaryCard, ChartCard } from "./SlideComponents";

interface Props {
  techData: TechSlideData;
  mesLabel: string;
}

const MESES_PT_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MESES_ALL = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const TIPO_COLORS: Record<string, string> = {
  "LP Shopify": "#f97316",
  "Landing Page": "#ec4899",
  "E-Commerce Standard": "#22c55e",
  "Ecommerce": "#22c55e",
  "Site": "#3b82f6",
  "CRO": "#eab308",
  "Sustentacao": "#8b5cf6",
  "Alteracao": "#6366f1",
  "Integracao": "#71717a",
  "Outros": "#71717a",
};

function getColor(tipo: string): string {
  return TIPO_COLORS[tipo] || "#71717a";
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
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs min-w-[160px]">
      <p className="font-bold text-white mb-1.5">{label}</p>
      <div className="space-y-0.5">
        {payload.map((p: any) => (
          p.value > 0 && (
            <div key={p.dataKey} className="flex justify-between gap-3">
              <span style={{ color: p.fill }}>{p.name}:</span>
              <span style={{ color: p.fill }} className="font-bold">{fmtBRL(p.value)}</span>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

export default function SlideEntregasPontuaisTech({ techData, mesLabel }: Props) {
  const { kpis, entregasPorTipo, receitaPorTipo } = techData;

  const mesLabelParts = mesLabel.split(" ");
  const reportYear = parseInt(mesLabelParts[mesLabelParts.length - 1] || "0") || new Date().getFullYear();
  const reportMesNome = mesLabelParts[0] || "";
  const reportMesIdx = MESES_PT_FULL.findIndex(m => m.toLowerCase() === reportMesNome.toLowerCase());
  const safeMesIdx = reportMesIdx >= 0 ? reportMesIdx : 11;
  const mesAtual = MESES_ALL[safeMesIdx] || mesLabel;

  // Extrair lista de tipos das chaves (excluindo month e label)
  const tiposList = entregasPorTipo.length > 0
    ? Object.keys(entregasPorTipo[0]).filter(k => k !== "month" && k !== "label")
    : [];

  // Filtrar Jan → mês selecionado do ano
  const ytdEntregas = entregasPorTipo.filter(m => {
    const parts = m.month.split("-").map(Number);
    return parts[0] === reportYear && parts[1] <= (safeMesIdx + 1);
  });
  const ytdReceita = receitaPorTipo.filter(m => {
    const parts = m.month.split("-").map(Number);
    return parts[0] === reportYear && parts[1] <= (safeMesIdx + 1);
  });

  // YTD totais
  const projetosYtd = ytdEntregas.reduce((s, m) =>
    s + tiposList.reduce((t, tipo) => t + ((m[tipo] as number) || 0), 0), 0);
  const receitaYtd = ytdReceita.reduce((s, m) =>
    s + tiposList.reduce((t, tipo) => t + ((m[tipo] as number) || 0), 0), 0);

  // Chart data: Jan → mês selecionado
  const chartData = MESES_ALL.slice(0, safeMesIdx + 1).map((lbl, i) => {
    const monthKey = `${reportYear}-${String(i + 1).padStart(2, "0")}`;
    const found = ytdReceita.find(m => m.month === monthKey);
    const row: any = { label: lbl };
    for (const tipo of tiposList) row[tipo] = found ? ((found[tipo] as number) || 0) : 0;
    return row;
  });

  return (
    <SlideLayout section="tech" padding="24px 32px">
      <SlideHeader
        icon={Code2}
        iconColor="text-blue-400"
        title={`Entregas Pontuais Tech — ${mesLabel}`}
        gradientColor="#3b82f6"
      />

      <div className="grid grid-cols-3 gap-3 mb-3 shrink-0">
        <SecondaryCard className="p-4 flex flex-col justify-center gap-1" borderColor="#3b82f6">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Projetos Entregues YTD</p>
          <p className="text-2xl font-black text-blue-400">{projetosYtd}</p>
          <p className="text-[10px] text-zinc-600">Jan → {mesAtual}</p>
        </SecondaryCard>

        <SecondaryCard className="p-4 flex flex-col justify-center gap-1">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Receita YTD</p>
          <p className="text-2xl font-black text-emerald-400">{fmtBRL(receitaYtd)}</p>
          <p className="text-[10px] text-zinc-600">Jan → {mesAtual}</p>
        </SecondaryCard>

        <SecondaryCard className="p-4 flex flex-col justify-center gap-1">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Tempo Médio / Projeto</p>
          <p className="text-2xl font-black text-cyan-400">{kpis.tempoMedio}</p>
          <p className="text-[10px] text-zinc-600">{mesAtual}</p>
        </SecondaryCard>
      </div>

      <ChartCard className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-zinc-300">Receita por Tipo × Mês — Jan → {mesAtual}</p>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {tiposList.map(tipo => (
              <div key={tipo} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getColor(tipo) }} />
                <span className="text-[9px] text-zinc-500">{tipo}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}>
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
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              {tiposList.map((tipo, i) => (
                <Bar
                  key={tipo}
                  dataKey={tipo}
                  name={tipo}
                  stackId="a"
                  barSize={32}
                  fill={getColor(tipo)}
                  fillOpacity={0.85}
                  radius={i === tiposList.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </SlideLayout>
  );
}
