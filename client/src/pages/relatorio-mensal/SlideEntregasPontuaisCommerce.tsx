import { Package } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { PontualData } from "./types";
import SlideLayout from "./SlideLayout";
import { SlideHeader, SecondaryCard, ChartCard } from "./SlideComponents";

interface Props {
  pontualData: PontualData;
  mesLabel: string;
}

const MESES_ALL = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_PT_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const PRODUTO_COLORS = [
  "#06b6d4", // cyan
  "#a855f7", // purple
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ec4899", // pink
  "#64748b", // slate (Outros)
];

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
  const row = payload[0]?.payload;
  if (!row) return null;
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
        <div className="flex justify-between gap-3 border-t border-zinc-700 pt-1 mt-1">
          <span className="text-zinc-400">Total:</span>
          <span className="font-bold text-white">{fmtBRL(row.total)}</span>
        </div>
      </div>
    </div>
  );
}

export default function SlideEntregasPontuaisCommerce({ pontualData, mesLabel }: Props) {
  const { entregasPorProdutoMes, entregasMes } = pontualData;

  const mesLabelParts = mesLabel.split(" ");
  const reportYear = parseInt(mesLabelParts[mesLabelParts.length - 1] || "0") || new Date().getFullYear();
  const reportMesNome = mesLabelParts[0] || "";
  const reportMesIdx = MESES_PT_FULL.findIndex(m => m.toLowerCase() === reportMesNome.toLowerCase());
  const safeMesIdx = reportMesIdx >= 0 ? reportMesIdx : 11;
  const mesAtual = MESES_ALL[safeMesIdx] || mesLabel;

  // Filtrar Jan → mês selecionado
  const ytdMeses = entregasPorProdutoMes.filter(m => {
    const parts = m.month.split("-").map(Number);
    return parts[0] === reportYear && parts[1] <= (safeMesIdx + 1);
  });

  // Total YTD
  const totalYtd = ytdMeses.reduce((s, m) => s + m.total, 0);

  // Top 5 produtos YTD + Outros
  const produtoTotais = new Map<string, number>();
  for (const mes of ytdMeses) {
    for (const [prod, val] of Object.entries(mes.produtos)) {
      produtoTotais.set(prod, (produtoTotais.get(prod) || 0) + val);
    }
  }
  const sorted = Array.from(produtoTotais.entries()).sort((a, b) => b[1] - a[1]);
  const topProdutos = sorted.slice(0, 5).map(([p]) => p);
  const topProdutosSet = new Set(topProdutos);
  const topProdutoNome = sorted[0]?.[0] ?? "—";
  const topProdutoValor = sorted[0]?.[1] ?? 0;

  // Contratos e ticket médio do mês atual
  const contratosMonth = entregasMes.porSquad.reduce((s, sq) => s + sq.contratos, 0);
  const ticketMedio = contratosMonth > 0 ? entregasMes.total / contratosMonth : 0;

  // Chart data
  const chartData = MESES_ALL.slice(0, safeMesIdx + 1).map((lbl, i) => {
    const monthKey = `${reportYear}-${String(i + 1).padStart(2, "0")}`;
    const found = entregasPorProdutoMes.find(m => m.month === monthKey);
    const row: any = { label: lbl, total: 0 };
    for (const p of topProdutos) row[p] = 0;
    row["Outros"] = 0;
    if (found) {
      for (const [prod, val] of Object.entries(found.produtos)) {
        if (topProdutosSet.has(prod)) {
          row[prod] = val;
        } else {
          row["Outros"] += val;
        }
        row.total += val;
      }
    }
    return row;
  });

  const hasOutros = chartData.some(row => (row["Outros"] as number) > 0);

  return (
    <SlideLayout section="commerce" padding="24px 32px">
      <SlideHeader
        icon={Package}
        iconColor="text-purple-400"
        title={`Entregas Pontuais Commerce — ${mesLabel}`}
        gradientColor="#a855f7"
      />

      <div className="grid grid-cols-4 gap-3 mb-3 shrink-0">
        <SecondaryCard className="p-4 flex flex-col justify-center gap-1" borderColor="#a855f7">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Total Entregue YTD</p>
          <p className="text-2xl font-black text-purple-400">{fmtBRL(totalYtd)}</p>
          <p className="text-[10px] text-zinc-600">Jan → {mesAtual}</p>
        </SecondaryCard>

        <SecondaryCard className="p-4 flex flex-col justify-center gap-1">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Entregue no Mês</p>
          <p className="text-2xl font-black text-cyan-400">{fmtBRL(entregasMes.total)}</p>
          <p className="text-[10px] text-zinc-600">{mesAtual}</p>
        </SecondaryCard>

        <SecondaryCard className="p-4 flex flex-col justify-center gap-1">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Ticket Médio</p>
          <p className="text-2xl font-black text-emerald-400">{fmtBRL(ticketMedio)}</p>
          <p className="text-[10px] text-zinc-600">{contratosMonth} contrato{contratosMonth !== 1 ? "s" : ""} no mês</p>
        </SecondaryCard>

        <SecondaryCard className="p-4 flex flex-col justify-center gap-1">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Top Produto YTD</p>
          <p className="text-sm font-black text-amber-400 truncate" title={topProdutoNome}>{topProdutoNome}</p>
          <p className="text-[10px] text-zinc-600">{fmtBRL(topProdutoValor)}</p>
        </SecondaryCard>
      </div>

      <ChartCard className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-zinc-300">Entregas por Produto × Mês — Jan → {mesAtual}</p>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {topProdutos.map((prod, idx) => (
              <div key={prod} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: PRODUTO_COLORS[idx] }} />
                <span className="text-[9px] text-zinc-500">{prod}</span>
              </div>
            ))}
            {hasOutros && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: PRODUTO_COLORS[5] }} />
                <span className="text-[9px] text-zinc-500">Outros</span>
              </div>
            )}
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
              {topProdutos.map((prod, idx) => (
                <Bar
                  key={prod}
                  dataKey={prod}
                  name={prod}
                  stackId="a"
                  barSize={28}
                  fill={PRODUTO_COLORS[idx]}
                  fillOpacity={0.85}
                  radius={!hasOutros && idx === topProdutos.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
              {hasOutros && (
                <Bar
                  dataKey="Outros"
                  name="Outros"
                  stackId="a"
                  barSize={28}
                  fill={PRODUTO_COLORS[5]}
                  fillOpacity={0.7}
                  radius={[4, 4, 0, 0]}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </SlideLayout>
  );
}
