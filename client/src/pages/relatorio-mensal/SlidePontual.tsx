import { Package, TrendingUp, TrendingDown, ShoppingCart, Boxes } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { PontualData } from "./types";
import SlideLayout from "./SlideLayout";
import { SlideHeader, SecondaryCard, ChartCard } from "./SlideComponents";

interface Props {
  pontualData: PontualData;
  mesLabel: string;
}

const MESES_ALL = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_PT_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// Palette para produtos (Top 5 + Outros)
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

function fmtFull(v: number): string {
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

function fmtK(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
  return `${Math.round(v)}`;
}

export default function SlidePontual({ pontualData, mesLabel }: Props) {
  const { emAberto, aquisicao, entregasMes, variacaoEstoque, entregasPorProdutoMes } = pontualData;

  // Determinar Top 5 produtos (agregando valor de todos os meses) + Outros
  const produtoTotais = new Map<string, number>();
  for (const mes of entregasPorProdutoMes) {
    for (const [prod, val] of Object.entries(mes.produtos)) {
      produtoTotais.set(prod, (produtoTotais.get(prod) || 0) + val);
    }
  }
  const topProdutos = Array.from(produtoTotais.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([p]) => p);
  const topProdutosSet = new Set(topProdutos);

  // Ano do relatório e mês selecionado (extrair do mesLabel, ex: "Março 2026")
  const mesLabelParts = mesLabel.split(" ");
  const reportYear = parseInt(mesLabelParts[mesLabelParts.length - 1] || "0");
  const reportMesNome = mesLabelParts[0] || "";
  const reportMesIdx = MESES_PT_FULL.findIndex(m => m.toLowerCase() === reportMesNome.toLowerCase());
  const ultimoMesIncluso = reportMesIdx >= 0 ? reportMesIdx : 11;

  // Montar chartData: apenas meses de Janeiro até o mês selecionado (inclusive)
  const chartData = MESES_ALL.slice(0, ultimoMesIncluso + 1).map((label, i) => {
    const monthKey = `${reportYear}-${String(i + 1).padStart(2, "0")}`;
    const found = entregasPorProdutoMes.find(m => m.month === monthKey);
    const row: any = { label, total: 0 };
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

  const topServicosAberto = emAberto.porServico.slice(0, 10);
  const maxServicoValor = topServicosAberto[0]?.valor || 1;

  const topEntregasSquad = entregasMes.porSquad.slice(0, 5);

  const isCrescimento = variacaoEstoque.delta >= 0;

  function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;
    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs min-w-[180px]">
        <p className="font-bold text-white mb-1.5">{label}</p>
        <div className="border-b border-zinc-700 pb-1 mb-1.5">
          <div className="flex justify-between items-center gap-3">
            <span className="text-zinc-400">Total:</span>
            <span className="font-bold text-cyan-400 text-sm">{fmtBRL(data.total)}</span>
          </div>
        </div>
        <div className="space-y-0.5">
          {[...topProdutos, "Outros"].map((prod, idx) => {
            const val = data[prod] || 0;
            if (val === 0) return null;
            return (
              <div key={prod} className="flex justify-between gap-3">
                <span style={{ color: PRODUTO_COLORS[idx] }}>{prod}:</span>
                <span style={{ color: PRODUTO_COLORS[idx] }}>{fmtBRL(val)}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <SlideLayout section="commerce" padding="24px 32px">
      <SlideHeader
        icon={Package}
        iconColor="text-purple-400"
        title={`Pontual — ${mesLabel}`}
        gradientColor="#a855f7"
      />

      {/* Linha 1 — 4 cards compactos */}
      <div className="grid grid-cols-4 gap-3 mb-3 shrink-0">
        {/* Em Aberto */}
        <SecondaryCard className="p-3 flex flex-col justify-center">
          <div className="flex items-center gap-1.5 mb-1">
            <Boxes className="h-3.5 w-3.5 text-purple-400" />
            <p className="text-xs text-zinc-500 uppercase tracking-wide">Em Aberto</p>
          </div>
          <p className="text-2xl font-black text-purple-400">{fmtBRL(emAberto.valor)}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{emAberto.contratos} contratos</p>
        </SecondaryCard>

        {/* Aquisição */}
        <SecondaryCard className="p-3 flex flex-col justify-center">
          <div className="flex items-center gap-1.5 mb-1">
            <ShoppingCart className="h-3.5 w-3.5 text-emerald-400" />
            <p className="text-xs text-zinc-500 uppercase tracking-wide">Aquisição</p>
          </div>
          <p className="text-2xl font-black text-emerald-400">{fmtBRL(aquisicao.valor)}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{aquisicao.contratos} contratos novos</p>
        </SecondaryCard>

        {/* Variação do Estoque */}
        <SecondaryCard className="p-3 flex flex-col justify-center">
          <div className="flex items-center gap-1.5 mb-1">
            {isCrescimento ? (
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-red-400" />
            )}
            <p className="text-xs text-zinc-500 uppercase tracking-wide">Variação Estoque</p>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500">Entrou:</span>
              <span className="text-xs font-bold text-emerald-400">+{fmtBRL(variacaoEstoque.entrou)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500">Saiu:</span>
              <span className="text-xs font-bold text-red-400">-{fmtBRL(variacaoEstoque.saiu)}</span>
            </div>
            <div className="border-t border-white/[0.06] pt-0.5 flex items-center justify-between">
              <span className="text-[10px] text-zinc-500">Δ:</span>
              <span className={`text-sm font-black ${isCrescimento ? "text-emerald-400" : "text-red-400"}`}>
                {isCrescimento ? "+" : "-"}{fmtBRL(Math.abs(variacaoEstoque.delta))} {isCrescimento ? "↑" : "↓"}
              </span>
            </div>
          </div>
        </SecondaryCard>

        {/* Entrega por Squad */}
        <SecondaryCard className="p-3 flex flex-col">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1.5">Entrega por Squad</p>
          {topEntregasSquad.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">Sem entregas</p>
          ) : (
            <div className="space-y-0.5 flex-1">
              {topEntregasSquad.map(s => (
                <div key={s.squad} className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400 truncate max-w-[100px]" title={s.squad}>{s.squad}</span>
                  <span className="text-xs font-bold text-cyan-400">{fmtBRL(s.valor)}</span>
                </div>
              ))}
            </div>
          )}
        </SecondaryCard>
      </div>

      {/* Linha 2 — Gráfico + Lista em aberto por serviço (preenche o espaço restante) */}
      <div className="grid grid-cols-7 grid-rows-1 gap-3 flex-1 min-h-0">
        {/* Gráfico: Entregas por produto × mês */}
        <ChartCard title="Entregas por Produto × Mês" className="col-span-5">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                  barSize={24}
                  fill={PRODUTO_COLORS[idx]}
                  fillOpacity={0.85}
                />
              ))}
              <Bar
                dataKey="Outros"
                name="Outros"
                stackId="a"
                barSize={24}
                fill={PRODUTO_COLORS[5]}
                fillOpacity={0.7}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
          {/* Legenda */}
          <div className="flex flex-wrap gap-2 mt-1 px-1">
            {[...topProdutos, "Outros"].map((prod, idx) => (
              <div key={prod} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: PRODUTO_COLORS[idx] }} />
                <span className="text-[9px] text-zinc-500">{prod}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Lista: Em aberto por serviço */}
        <ChartCard title="Em Aberto por Serviço" className="col-span-2 overflow-hidden">
          <div className="space-y-1 overflow-y-auto pr-1" style={{ maxHeight: "100%" }}>
            {topServicosAberto.map(s => {
              const pct = (s.valor / maxServicoValor) * 100;
              return (
                <div key={s.servico} className="relative">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-zinc-300 truncate max-w-[130px]" title={s.servico}>{s.servico}</span>
                    <span className="text-[10px] font-bold text-purple-400">{fmtBRL(s.valor)}</span>
                  </div>
                  <div className="w-full h-1 bg-white/[0.04] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500/70 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[8px] text-zinc-600 mt-0.5">{s.contratos} contrato{s.contratos !== 1 ? "s" : ""}</p>
                </div>
              );
            })}
          </div>
        </ChartCard>
      </div>

    </SlideLayout>
  );
}
