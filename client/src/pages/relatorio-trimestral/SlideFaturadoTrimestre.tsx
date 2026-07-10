import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { Landmark, Receipt, AlertTriangle } from "lucide-react";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader, SecondaryCard } from "../relatorio-mensal/SlideComponents";
import type { Faturado } from "./types";
import { ACCENT, fmtCompact, fmtK, entrance, LegendDot, TOOLTIP_STYLE, DeckKeyframes, GrowBar } from "./deck-kit";
import { useCountUp } from "./useCountUp";

// Faturado do trimestre — leitura contábil do Conta Azul (caz_parcelas, grupo inteiro):
//   faturável (bruto) − inadimplência (atrasado/perdido) = faturado (caixa recebido)
// Substitui o antigo "Faturável", que vinha do ClickUp (MRR + pontual entregue) e
// portanto ignorava inadimplência. Os dois números NÃO são comparáveis.
//
// A diferença entre (faturável − inadimplência) e o faturado é o resíduo de
// RENEGOCIADO + RECEBIDO_PARCIAL: dinheiro que não entrou e não é calote.

function pct(v: number): string {
  return `${v.toFixed(1).replace(".", ",")}%`;
}

/**
 * Rótulo no topo da pilha: faturável do trimestre e, do 2º em diante, a variação
 * do FATURADO contra o trimestre anterior (delta em R$ + %).
 *
 * É `content` e não `formatter` de propósito: no Recharts 2.x o formatter recebe
 * apenas o valor — sem índice não há como alcançar a linha e comparar com a anterior.
 */
function TopoBarra({ trimestres, ...props }: any) {
  const { x, y, width, index } = props;
  const t = trimestres[index];
  if (!t || typeof x !== "number") return null;

  const anterior = index > 0 ? trimestres[index - 1] : null;
  const delta = anterior ? t.faturado - anterior.faturado : 0;
  const temDelta = !!anterior && anterior.faturado > 0;
  const pctDelta = temDelta ? (delta / anterior.faturado) * 100 : 0;
  const subiu = delta >= 0;
  const cx = x + width / 2;

  return (
    <g>
      <text x={cx} y={y - (temDelta ? 26 : 8)} textAnchor="middle" fill="#e4e4e7" fontSize={13} fontWeight={700}>
        {fmtCompact(t.faturavel)}
      </text>
      {temDelta && (
        <text x={cx} y={y - 8} textAnchor="middle" fill={subiu ? ACCENT.mrr : ACCENT.churn} fontSize={12} fontWeight={700}>
          {subiu ? "▲" : "▼"} {fmtCompact(Math.abs(delta))} · {subiu ? "+" : "−"}{pct(Math.abs(pctDelta))}
        </text>
      )}
    </g>
  );
}

export default function SlideFaturadoTrimestre({ faturado, label }: { faturado: Faturado; label: string }) {
  const atual = faturado.atual;
  const faturadoAnim = useCountUp(atual?.faturado ?? 0, 800, 200);
  const faturavelAnim = useCountUp(atual?.faturavel ?? 0, 750, 350);
  const inadimplenciaAnim = useCountUp(atual?.inadimplencia ?? 0, 750, 450);

  const taxaInadimplencia = atual && atual.faturavel > 0 ? (atual.inadimplencia / atual.faturavel) * 100 : 0;
  const lastIdx = faturado.trimestres.length - 1;
  const temMeta = faturado.meta !== null && faturado.pctMeta !== null;

  return (
    <SlideLayout section="commerce" padding="28px 36px">
      <DeckKeyframes />
      <SlideHeader icon={Landmark} iconColor="text-emerald-400" title={`Faturado — ${label}`} gradientColor="#10b981" />

      <div className="flex-1 flex flex-col gap-4 min-h-0">
        <div className="flex-1 grid grid-cols-5 gap-5 min-h-0">
          {/* Coluna esquerda: a conta, de cima para baixo */}
          <div className={`${entrance(0).className} col-span-2 flex flex-col gap-4 min-h-0`} style={entrance(0).style}>
            <SecondaryCard className="px-6 py-5 flex-1 flex flex-col justify-center">
              <p className="text-xs text-zinc-500 uppercase tracking-[0.25em]">Faturado no trimestre</p>
              <p className="text-6xl font-black leading-none mt-2 bg-gradient-to-r from-emerald-300 to-cyan-400 bg-clip-text text-transparent">
                {fmtCompact(faturadoAnim)}
              </p>
            </SecondaryCard>

            <div className="grid grid-cols-2 gap-4 shrink-0">
              <SecondaryCard className="px-5 py-4 flex flex-col justify-center" borderColor={ACCENT.cyan}>
                <span className="flex items-center gap-2 text-[11px] font-bold text-cyan-400 uppercase tracking-widest">
                  <Receipt className="h-3.5 w-3.5" /> Faturável
                </span>
                <p className="text-3xl font-black text-cyan-400 mt-2">{fmtCompact(faturavelAnim)}</p>
                <p className="text-[11px] text-zinc-500 mt-1">bruto emitido</p>
              </SecondaryCard>
              <SecondaryCard className="px-5 py-4 flex flex-col justify-center" borderColor={ACCENT.amber}>
                <span className="flex items-center gap-2 text-[11px] font-bold text-amber-400 uppercase tracking-widest">
                  <AlertTriangle className="h-3.5 w-3.5" /> Inadimplência
                </span>
                <p className="text-3xl font-black text-amber-400 mt-2">{fmtCompact(inadimplenciaAnim)}</p>
                <p className="text-[11px] text-zinc-500 mt-1">{pct(taxaInadimplencia)} do faturável</p>
              </SecondaryCard>
            </div>
          </div>

          {/* Barras por trimestre do ano: faturado + inadimplência empilhados = faturável */}
          <div className={`${entrance(150).className} col-span-3 flex flex-col min-h-0`} style={entrance(150).style}>
            <SecondaryCard className="px-6 py-5 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest">Faturado por trimestre · {faturado.ano}</p>
                <div className="flex items-center gap-4">
                  <LegendDot color={ACCENT.mrr} label="Faturado" />
                  <LegendDot color={ACCENT.amber} label="Inadimplência" />
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={faturado.trimestres} margin={{ top: 40, right: 16, bottom: 4, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke="#a1a1aa"
                      fontSize={12}
                      tickLine={false}
                      axisLine={{ stroke: "#3f3f46" }}
                      tickFormatter={(v: string, i: number) => (faturado.trimestres[i]?.parcial ? `${v} *` : v)}
                    />
                    <YAxis stroke="#a1a1aa" fontSize={11} tickFormatter={fmtK} tickLine={false} axisLine={false} width={48} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v: number, name: string) => [fmtCompact(v), name === "faturado" ? "Faturado" : "Inadimplência"]}
                    />
                    <Bar dataKey="faturado" name="faturado" stackId="fat" maxBarSize={72} animationDuration={900}>
                      {faturado.trimestres.map((t, i) => (
                        <Cell key={i} fill={ACCENT.mrr} fillOpacity={t.parcial ? 0.45 : i === lastIdx ? 1 : 0.65} />
                      ))}
                    </Bar>
                    <Bar
                      dataKey="inadimplencia"
                      name="inadimplencia"
                      stackId="fat"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={72}
                      animationDuration={900}
                      label={(props: any) => <TopoBarra {...props} trimestres={faturado.trimestres} />}
                    >
                      {faturado.trimestres.map((t, i) => (
                        <Cell key={i} fill={ACCENT.amber} fillOpacity={t.parcial ? 0.45 : i === lastIdx ? 1 : 0.65} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SecondaryCard>
          </div>
        </div>

        {/* Rodapé: progresso da meta anual, com marcador do ritmo esperado */}
        {temMeta && (
          <div className={`${entrance(300).className} shrink-0`} style={entrance(300).style}>
            <SecondaryCard className="px-6 py-4">
              <div className="flex items-baseline justify-between mb-2.5">
                <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest">
                  Meta {faturado.ano} · {fmtCompact(faturado.ytdFaturado)} de {fmtCompact(faturado.meta!)}
                </p>
                <div className="flex items-baseline gap-3">
                  {faturado.pctAnoDecorrido !== null && (
                    <span className="text-[11px] text-zinc-500">
                      esperado {pct(faturado.pctAnoDecorrido)} do ano
                    </span>
                  )}
                  <span
                    className="text-lg font-black tabular-nums"
                    style={{
                      color:
                        faturado.pctAnoDecorrido !== null && faturado.pctMeta! < faturado.pctAnoDecorrido
                          ? ACCENT.amber
                          : ACCENT.mrr,
                    }}
                  >
                    {pct(faturado.pctMeta!)}
                  </span>
                </div>
              </div>
              <div className="relative h-4 rounded-full bg-zinc-800/80 overflow-hidden">
                <GrowBar widthPct={faturado.pctMeta!} delayMs={450} className="rounded-full">
                  <div className="w-full h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" />
                </GrowBar>
                {/* Marcador do ritmo: onde deveríamos estar se a receita fosse linear no ano */}
                {faturado.pctAnoDecorrido !== null && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-zinc-300/70"
                    style={{ left: `${Math.min(faturado.pctAnoDecorrido, 100)}%` }}
                    title={`Ritmo esperado: ${pct(faturado.pctAnoDecorrido)}`}
                  />
                )}
              </div>
            </SecondaryCard>
          </div>
        )}

        {faturado.coberturaParcial && (
          <p className="text-[11px] text-amber-500/80 shrink-0">
            * Conta Azul só tem dados a partir de out/2025 — trimestres anteriores aparecem truncados.
          </p>
        )}
      </div>
    </SlideLayout>
  );
}
