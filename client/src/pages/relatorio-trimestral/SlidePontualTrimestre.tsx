import { Package, Boxes, ShoppingCart, Truck, TrendingUp, TrendingDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader, SecondaryCard, ChartCard } from "../relatorio-mensal/SlideComponents";
import type { PontualDataTrimestral, EntregaProdutoTri } from "./types";
import { ACCENT, fmtCompact, fmtK, entrance, LegendDot, DeckKeyframes, GrowBar, TOOLTIP_STYLE } from "./deck-kit";
import { useCountUp } from "./useCountUp";

interface Props {
  pontualData: PontualDataTrimestral;
  label: string;
}

/**
 * Rótulo no topo da pilha: total entregue no trimestre e, do 2º em diante, a
 * variação contra o trimestre anterior (delta em R$ + %).
 *
 * `content` e não `formatter`: no Recharts 2.x o formatter recebe só o valor,
 * sem o índice necessário para alcançar a barra anterior.
 */
function TopoBarraEntregas({ trimestres, ...props }: any) {
  const { x, y, width, index } = props;
  const t = trimestres[index] as EntregaProdutoTri | undefined;
  if (!t || typeof x !== "number") return null;

  const anterior = index > 0 ? (trimestres[index - 1] as EntregaProdutoTri) : null;
  const delta = anterior ? t.total - anterior.total : 0;
  const temDelta = !!anterior && anterior.total > 0;
  const pctDelta = temDelta ? (delta / anterior.total) * 100 : 0;
  const subiu = delta >= 0;
  const cx = x + width / 2;

  return (
    <g>
      <text x={cx} y={y - (temDelta ? 24 : 7)} textAnchor="middle" fill="#e4e4e7" fontSize={12} fontWeight={700}>
        {fmtCompact(t.total)}
      </text>
      {temDelta && (
        <text x={cx} y={y - 7} textAnchor="middle" fill={subiu ? ACCENT.mrr : ACCENT.churn} fontSize={11} fontWeight={700}>
          {subiu ? "▲" : "▼"} {fmtCompact(Math.abs(delta))} · {subiu ? "+" : "−"}
          {Math.abs(pctDelta).toFixed(1).replace(".", ",")}%
        </text>
      )}
    </g>
  );
}

// Paleta de produtos derivada dos ACCENTs do deck (máx 4 produtos + "Outros")
const PRODUTO_COLORS = [ACCENT.cyan, ACCENT.vendas, ACCENT.mrr, ACCENT.amber, "#64748b"];

function HeroStat({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <SecondaryCard className="px-4 py-3.5 flex flex-col justify-center h-full" borderColor={color}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5" style={{ color }} />
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-2xl font-black text-white tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-zinc-500 mt-0.5">{sub}</p>}
    </SecondaryCard>
  );
}

export default function SlidePontualTrimestre({ pontualData, label }: Props) {
  const { emAberto, aquisicao, entregasMes, variacaoEstoque, entregasPorProdutoTri, tempoMedioEntrega } = pontualData;

  const isCrescimento = variacaoEstoque.delta >= 0;
  const totalContratosEntregues = (entregasMes.porSquad ?? []).reduce((acc, s) => acc + s.contratos, 0);

  // Count-up sincronizado com a entrada do bloco hero (delay 0 + 150/200/250/300)
  const estoqueAnim = useCountUp(emAberto.valor, 750, 150);
  const aquisicaoAnim = useCountUp(aquisicao.valor, 750, 200);
  const entregasAnim = useCountUp(entregasMes.total, 750, 250);
  const deltaAnim = useCountUp(variacaoEstoque.delta, 750, 300);

  // Em aberto por serviço — top 8
  const topServicos = [...(emAberto.porServico ?? [])].sort((a, b) => b.valor - a.valor).slice(0, 8);
  const maxServicoValor = Math.max(...topServicos.map((s) => s.valor), 1);

  // Entregas por produto × trimestre do ano (stacked) — top 4 produtos do ano + Outros
  const trimestres = entregasPorProdutoTri ?? [];
  const produtoTotais = new Map<string, number>();
  for (const t of trimestres) {
    for (const [prod, val] of Object.entries(t.produtos ?? {})) {
      produtoTotais.set(prod, (produtoTotais.get(prod) ?? 0) + val);
    }
  }
  const topProdutos = Array.from(produtoTotais.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([p]) => p);
  const topProdutosSet = new Set(topProdutos);

  const chartData = trimestres.map((t) => {
    const row: Record<string, number | string> = {
      label: t.parcial ? `${t.label} *` : t.label,
      total: t.total,
      Outros: 0,
    };
    for (const p of topProdutos) row[p] = 0;
    for (const [prod, val] of Object.entries(t.produtos ?? {})) {
      if (topProdutosSet.has(prod)) row[prod] = (row[prod] as number) + val;
      else row.Outros = (row.Outros as number) + val;
    }
    return row;
  });
  const hasOutros = chartData.some((r) => (r.Outros as number) > 0);
  const seriesKeys = hasOutros ? [...topProdutos, "Outros"] : topProdutos;
  const lastKey = seriesKeys[seriesKeys.length - 1];

  function ChartTooltip({ active, payload, label: lbl }: any) {
    if (!active || !payload?.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;
    return (
      <div style={TOOLTIP_STYLE} className="px-3 py-2 min-w-[160px]">
        <p className="font-bold text-white mb-1">{lbl}</p>
        <div className="space-y-0.5">
          {seriesKeys.map((prod, idx) => {
            const val = (data[prod] as number) || 0;
            if (val === 0) return null;
            return (
              <div key={prod} className="flex justify-between gap-3">
                <span style={{ color: PRODUTO_COLORS[idx] }}>{prod}</span>
                <span style={{ color: PRODUTO_COLORS[idx] }}>{fmtCompact(val)}</span>
              </div>
            );
          })}
        </div>
        <div className="border-t border-white/10 mt-1 pt-1 flex justify-between gap-3">
          <span className="text-zinc-400">Total</span>
          <span className="font-bold text-white">{fmtCompact((data.total as number) || 0)}</span>
        </div>
      </div>
    );
  }

  // Tempo médio de entrega — chips discretas no rodapé (top 6 por volume)
  const chipsTempo = [...(tempoMedioEntrega ?? [])].sort((a, b) => b.contratos - a.contratos).slice(0, 6);

  const leftEntrance = entrance(150);
  const rightEntrance = entrance(250);

  return (
    <SlideLayout section="commerce" padding="28px 36px">
      <DeckKeyframes />
      <SlideHeader icon={Package} iconColor="text-purple-400" title={`Pontual — ${label}`} gradientColor={ACCENT.pontual} />

      <div className="flex-1 flex flex-col gap-4 min-h-0">
        {/* Hero: 4 stats com count-up */}
        <div {...entrance(0)}>
          <div className="grid grid-cols-4 gap-3">
            <HeroStat
              icon={Boxes}
              label="Estoque em aberto"
              value={fmtCompact(estoqueAnim)}
              sub={`${emAberto.contratos} contrato${emAberto.contratos !== 1 ? "s" : ""}`}
              color={ACCENT.pontual}
            />
            <HeroStat
              icon={ShoppingCart}
              label="Aquisição no tri"
              value={fmtCompact(aquisicaoAnim)}
              sub={`${aquisicao.contratos} contrato${aquisicao.contratos !== 1 ? "s" : ""} novos`}
              color={ACCENT.vendas}
            />
            <HeroStat
              icon={Truck}
              label="Entregas no tri"
              value={fmtCompact(entregasAnim)}
              sub={`${totalContratosEntregues} contrato${totalContratosEntregues !== 1 ? "s" : ""}`}
              color={ACCENT.mrr}
            />
            <HeroStat
              icon={isCrescimento ? TrendingUp : TrendingDown}
              label="Variação de estoque"
              value={`${deltaAnim >= 0 ? "+" : "-"}${fmtCompact(Math.abs(deltaAnim))}`}
              sub={`entrou ${fmtCompact(variacaoEstoque.entrou)} · saiu ${fmtCompact(variacaoEstoque.saiu)}`}
              color={isCrescimento ? ACCENT.mrr : ACCENT.churn}
            />
          </div>
        </div>

        {/* Duas colunas: Em aberto por serviço | Entregas por produto no trimestre */}
        <div className="grid grid-cols-5 gap-4 flex-1 min-h-0">
          <div className={`${leftEntrance.className} col-span-2 flex flex-col min-h-0`} style={leftEntrance.style}>
            <SecondaryCard className="px-5 py-4 flex-1 flex flex-col min-h-0" borderColor={ACCENT.pontual}>
              <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest mb-3">Em aberto por serviço</p>
              {topServicos.length === 0 ? (
                <p className="text-xs text-zinc-600 italic">Sem estoque em aberto</p>
              ) : (
                <div className="flex-1 flex flex-col justify-center gap-2.5 min-h-0 overflow-hidden">
                  {topServicos.map((s, i) => {
                    const pct = (s.valor / maxServicoValor) * 100;
                    return (
                      <div key={s.servico} className="flex items-center gap-3">
                        <span className="w-28 text-xs text-zinc-400 truncate text-right shrink-0" title={s.servico}>
                          {s.servico}
                        </span>
                        <div className="flex-1 h-5 rounded-md overflow-hidden bg-white/[0.03]">
                          <GrowBar
                            widthPct={pct}
                            delayMs={200 + i * 50}
                            className="bg-gradient-to-r from-purple-500/85 to-purple-400/70 rounded-md"
                          />
                        </div>
                        <span className="w-16 text-xs font-bold text-white text-right shrink-0 tabular-nums">
                          {fmtCompact(s.valor)}
                        </span>
                        <span className="w-12 text-[10px] text-zinc-500 text-right shrink-0 tabular-nums">
                          {s.contratos} ctr
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </SecondaryCard>
          </div>

          <div className={`${rightEntrance.className} col-span-3 flex flex-col min-h-0`} style={rightEntrance.style}>
            <ChartCard title="Entregas por produto por trimestre" className="flex-1">
              {chartData.length === 0 ? (
                <p className="text-xs text-zinc-600 italic">Sem entregas no período</p>
              ) : (
                <>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 38, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
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
                          width={44}
                        />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                        {seriesKeys.map((prod, idx) => {
                          const isLast = prod === lastKey;
                          return (
                            <Bar
                              key={prod}
                              dataKey={prod}
                              name={prod}
                              stackId="a"
                              maxBarSize={56}
                              fill={PRODUTO_COLORS[idx]}
                              fillOpacity={prod === "Outros" ? 0.6 : 0.85}
                              animationDuration={700}
                              {...(isLast
                                ? {
                                    radius: [4, 4, 0, 0] as [number, number, number, number],
                                    label: (p: any) => <TopoBarraEntregas {...p} trimestres={trimestres} />,
                                  }
                                : {})}
                            />
                          );
                        })}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2 px-1 shrink-0">
                    {seriesKeys.map((prod, idx) => (
                      <LegendDot key={prod} color={PRODUTO_COLORS[idx]} label={prod} />
                    ))}
                  </div>
                </>
              )}
            </ChartCard>
          </div>
        </div>

        {/* Tempo médio de entrega — chips discretas no rodapé */}
        {chipsTempo.length > 0 && (
          <div {...entrance(350)}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] text-zinc-600 uppercase tracking-widest mr-1">Tempo médio de entrega</span>
              {chipsTempo.map((t) => (
                <span
                  key={t.produto}
                  className="text-[10px] text-zinc-400 bg-white/[0.04] border border-white/[0.06] rounded-full px-2 py-0.5"
                >
                  {t.produto}: {Math.round(t.diasMedio)}d
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </SlideLayout>
  );
}
