import type { LucideIcon } from "lucide-react";
import { LayoutGrid, Activity, Sparkles, Ticket, Users, DollarSign, TrendingUp, TrendingDown, Coins, AlertTriangle, BarChart3 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from "recharts";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader } from "../relatorio-mensal/SlideComponents";
import type { ChurnCliente } from "../relatorio-mensal/types";
import type { SquadDetailTri } from "./types";
import { ACCENT, entrance, DeckKeyframes, fmtK, LegendDot, TOOLTIP_STYLE } from "./deck-kit";
import { useCountUp } from "./useCountUp";

interface Props {
  details: SquadDetailTri[];
  mesLabel: string;
}

const SQUAD_COLORS: Record<string, string> = {
  "Selva":         "#22c55e",
  "Squadra":       "#3b82f6",
  "Pulse":         "#ec4899",
  "Squad X":       "#6366f1",
  "Tech":          "#0ea5e9",
  "Makers":        "#06b6d4",
  "Hunters":       "#a855f7",
  "Chama":         "#f43f5e",
  "Aurea":         "#fbbf24",
  "Supreme":       "#8b5cf6",
  "Bloomfield":    "#10b981",
  "Black":         "#94a3b8",
  "Ventures":      "#f59e0b",
  "Vendas":        "#f97316",
  "CX&CS":         "#14b8a6",
  "Nitro":         "#ef4444",
  "Turbo Interno": "#94a3b8",
};

function parseSquadName(raw: string): { emoji: string; name: string } {
  const trimmed = raw.trim();
  const idx = trimmed.search(/[A-Za-z]/);
  if (idx > 0) return { emoji: trimmed.slice(0, idx).trim(), name: trimmed.slice(idx).trim() };
  return { emoji: "", name: trimmed };
}

function getColor(baseName: string): string {
  if (SQUAD_COLORS[baseName]) return SQUAD_COLORS[baseName];
  const clean = baseName.replace(/\s*\(OFF\)\s*$/i, "").trim();
  return SQUAD_COLORS[clean] || "#71717a";
}

function fmtBRL(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace(".", ",")}M`;
  if (abs >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  color = "#fff",
  hero = false,
}: {
  icon?: LucideIcon;
  label: string;
  value: string;
  color?: string;
  hero?: boolean;
}) {
  return (
    <div className={`rounded-xl bg-white/[0.03] border border-white/5 flex flex-col gap-1 ${hero ? "p-3" : "p-2.5"}`}>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3 shrink-0 text-zinc-500" />}
        <p className="text-[9px] text-zinc-500 uppercase tracking-wider whitespace-nowrap">{label}</p>
      </div>
      <p className={`font-black tabular-nums ${hero ? "text-3xl" : "text-lg"}`} style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function MiniSquadCard({ sq, delayMs }: { sq: SquadDetailTri; delayMs: number }) {
  const { emoji, name } = parseSquadName(sq.squad);
  const color = getColor(name);
  const e = entrance(delayMs);
  return (
    <div
      className={`${e.className} flex items-center gap-2 rounded-full bg-white/[0.03] border pl-1.5 pr-3 py-1 shrink-0`}
      style={{ ...e.style, borderColor: `${color}30` }}
    >
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
        style={{ background: `${color}25`, border: `1.5px solid ${color}` }}
      >
        {emoji ? (
          <span style={{ fontSize: 12, lineHeight: 1 }}>{emoji}</span>
        ) : (
          <span className="text-[8px] font-black text-white">{name.slice(0, 2).toUpperCase()}</span>
        )}
      </div>
      <span className="text-[11px] font-semibold text-zinc-300 truncate max-w-[80px]">{name}</span>
      <span className="text-[11px] font-bold text-white tabular-nums">{fmtBRL(sq.mrr + sq.pontual)}</span>
    </div>
  );
}

function ChurnCard({
  label,
  pct,
  brl,
}: {
  label: string;
  pct: number;
  brl: number;
  clientes: ChurnCliente[];
}) {
  const color = pct >= 8 ? ACCENT.churn : ACCENT.mrr;
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/5 p-2.5 flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <AlertTriangle className="h-3 w-3 shrink-0 text-zinc-500" />
        <p className="text-[9px] text-zinc-500 uppercase tracking-wider whitespace-nowrap">{label}</p>
      </div>
      <div className="flex items-baseline gap-1.5">
        <p className="text-lg font-black tabular-nums" style={{ color }}>
          {pct.toFixed(1).replace(".", ",")}%
        </p>
        <p className="text-[10px] text-zinc-600 tabular-nums">{fmtBRL(brl)}</p>
      </div>
      <div className="h-1 rounded-full bg-white/5 overflow-hidden mt-0.5">
        <div className="h-full rounded-full" style={{ width: `${Math.min(Math.max(pct, 0) * 5, 100)}%`, background: color }} />
      </div>
    </div>
  );
}

/**
 * Evolução do faturamento QoQ da squad: barras empilhadas MRR + Pontual, com o
 * total rotulado no topo e um badge de variação. Preenche o espaço livre da coluna
 * esquerda do hero. Animação das barras desligada — o card já entra com o hero e o
 * export em PDF captura estático.
 */
function EvolucaoFaturamentoCard({ evolucao }: { evolucao: SquadDetailTri["evolucao"] }) {
  const pontos = evolucao ?? [];
  const anterior = pontos[0];
  const atual = pontos[pontos.length - 1];
  const temDados = pontos.length >= 2 && (anterior.total > 0 || atual.total > 0);

  // Variação QoQ só faz sentido com base > 0 (tri anterior sem snapshot → mrr 0).
  // Squad nova (base ínfima) estoura o percentual (ex.: Olimpo +10.205%): acima de
  // 1000% mostramos o multiplicador, que se lê muito melhor ("103,1×").
  const ratio = anterior?.total > 0 ? atual.total / anterior.total : null;
  const deltaPct = ratio !== null ? (ratio - 1) * 100 : null;
  const up = (deltaPct ?? 0) >= 0;
  const deltaLabel =
    deltaPct === null
      ? null
      : Math.abs(deltaPct) >= 1000
        ? `${ratio!.toFixed(1).replace(".", ",")}× QoQ`
        : `${up ? "+" : "−"}${Math.abs(deltaPct).toFixed(1).replace(".", ",")}% QoQ`;

  return (
    <div className="flex-1 min-h-0 rounded-xl bg-white/[0.03] border border-white/5 p-3 flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-1.5 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <BarChart3 className="h-3 w-3 shrink-0 text-zinc-500" />
          <p className="text-[9px] text-zinc-500 uppercase tracking-wider whitespace-nowrap">Evolução do faturamento</p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <LegendDot color={ACCENT.mrr} label="MRR" />
          <LegendDot color={ACCENT.pontual} label="Pontual" />
          {deltaLabel && (
            <span
              className={`text-[10px] font-bold rounded-full px-2 py-0.5 tabular-nums whitespace-nowrap ${
                up ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"
              }`}
            >
              {deltaLabel}
            </span>
          )}
        </div>
      </div>

      {!temDados ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-zinc-600 italic">Sem histórico de faturamento para comparar</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pontos} margin={{ top: 20, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="label" stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={{ stroke: "#3f3f46" }} />
              <YAxis stroke="#a1a1aa" fontSize={9} tickFormatter={fmtK} tickLine={false} axisLine={false} width={34} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                formatter={(v: any, n: any) => [fmtBRL(Number(v)), n === "mrr" ? "MRR" : "Pontual"]}
              />
              <Bar dataKey="mrr" stackId="fat" fill={ACCENT.mrr} maxBarSize={64} isAnimationActive={false} />
              <Bar dataKey="pontual" stackId="fat" fill={ACCENT.pontual} maxBarSize={64} radius={[5, 5, 0, 0]} isAnimationActive={false}>
                <LabelList
                  dataKey="total"
                  position="top"
                  formatter={(v: any) => fmtBRL(Number(v))}
                  fill="#e4e4e7"
                  fontSize={11}
                  fontWeight={700}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function SlideSquadTrimestre({ details, mesLabel }: Props) {
  if (details.length === 0) {
    return (
      <SlideLayout section="commerce" padding="28px 36px">
        <SlideHeader icon={LayoutGrid} iconColor="text-purple-400" title={`Squad em Destaque — ${mesLabel}`} gradientColor="#a855f7" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-500">Sem dados de squads para este trimestre</p>
        </div>
      </SlideLayout>
    );
  }

  const hero = details[details.length - 1];
  const trail = details.slice(0, -1);

  const { emoji, name } = parseSquadName(hero.squad);
  const color = getColor(name);

  // Stagger da trilha e delay do hero limitados (independentes do nº de squads já revelados)
  // p/ garantir que a última animação continue dentro do orçamento (~1100-1200ms do export)
  const trailStep = trail.length > 1 ? Math.min(50, Math.floor(200 / (trail.length - 1))) : 0;
  const heroDelay = trail.length > 0 ? Math.min(200, trail.length * trailStep) + 80 : 80;
  const countUpDelay = heroDelay + 120;

  const evolUp = hero.evolucaoMrr >= 0;
  const evolColor = evolUp ? ACCENT.mrr : ACCENT.churn;
  const evolSign = evolUp ? "+" : "−";
  const faturamentoTotal = hero.mrr + hero.pontual;
  const churnClientes = hero.churnClientes ?? [];
  const churnSemAbonados = churnClientes.filter((c) => !c.abonado);
  const nrrBrl = hero.nrrBrl ?? hero.churnBrl;
  const nrrPct = hero.nrrPct ?? hero.churnPct;
  const nrrPositivo = nrrBrl <= 0; // negativo/zero = retenção líquida positiva (expansão >= churn)

  const mrrAnim = useCountUp(hero.mrr, 750, countUpDelay);
  const pontualAnim = useCountUp(hero.pontual, 750, countUpDelay);
  const ticketAnim = useCountUp(hero.ticketMedio, 750, countUpDelay);
  const clientesAnim = useCountUp(hero.clientes, 750, countUpDelay);
  const faturamentoAnim = useCountUp(faturamentoTotal, 750, countUpDelay + 20);
  const evolAnim = useCountUp(Math.abs(hero.evolucaoMrr), 750, countUpDelay + 20);
  const vendasAnim = useCountUp(hero.vendasMes ?? 0, 750, countUpDelay + 20);

  // 4 itens + linha "+N outros" é o que cabe no card sem cortar linha ao meio
  // (o bloco divide altura com Churn/NRR; validado visualmente no deck Q2-2026).
  const listaClientes = [...churnClientes].sort((a, b) => b.valor - a.valor).slice(0, 4);
  const restantes = churnClientes.length - listaClientes.length;

  return (
    <SlideLayout section="commerce" padding="28px 36px">
      <DeckKeyframes />
      <SlideHeader icon={LayoutGrid} iconColor="text-purple-400" title={`Squad em Destaque — ${mesLabel}`} gradientColor={color} />

      <div className="flex-1 flex flex-col gap-3 min-h-0">
        {/* Trilha: squads já revelados no trimestre */}
        {trail.length > 0 && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <span className="text-[9px] text-zinc-600 uppercase tracking-widest shrink-0">Já revelados</span>
            {trail.map((sq, i) => (
              <MiniSquadCard key={sq.squad} sq={sq} delayMs={i * trailStep} />
            ))}
          </div>
        )}

        {/* Hero: squad em destaque */}
        <div
          className="flex-1 min-h-0 flex flex-col rounded-2xl overflow-hidden shadow-xl shadow-black/30 animate-in fade-in slide-in-from-bottom-6 zoom-in-95 duration-500 motion-reduce:animate-none"
          style={{
            background: `linear-gradient(135deg, ${color}14 0%, rgba(255,255,255,0.02) 60%)`,
            border: `1px solid ${color}30`,
            animationDelay: `${heroDelay}ms`,
            animationFillMode: "both",
          }}
        >
          {/* Header com avatar colorido */}
          <div className="flex items-center gap-3 px-5 py-3 shrink-0" style={{ borderBottom: `1px solid ${color}25` }}>
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: `radial-gradient(circle at 30% 30%, ${color}50, ${color}20)`,
                border: `2px solid ${color}`,
                boxShadow: `0 0 24px ${color}40`,
              }}
            >
              {emoji ? (
                <span style={{ fontSize: 24, lineHeight: 1 }}>{emoji}</span>
              ) : (
                <span className="font-black text-white text-lg">{name.slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-black tracking-wide truncate" style={{ color }}>
                {name.toUpperCase()}
              </h3>
              <p className="text-[11px] text-zinc-500 uppercase tracking-widest mt-0.5">Performance no trimestre</p>
            </div>
          </div>

          {/* Corpo: stats principais + churn/NRR */}
          <div className="flex-1 grid grid-cols-[3fr_2fr] gap-4 p-4 min-h-0">
            {/* Coluna esquerda: MRR/Pontual/Ticket/Clientes + Faturamento/Evolução/Vendas */}
            <div className="flex flex-col gap-3 min-h-0">
              <div className="grid grid-cols-4 gap-3 shrink-0">
                <StatCard icon={Activity} label="MRR" value={fmtBRL(mrrAnim)} hero />
                <StatCard icon={Sparkles} label="Pontual" value={fmtBRL(pontualAnim)} hero />
                <StatCard icon={Ticket} label="Ticket médio" value={fmtBRL(ticketAnim)} hero />
                <StatCard icon={Users} label="Clientes" value={String(Math.round(clientesAnim))} hero />
              </div>
              <div className="grid grid-cols-3 gap-3 shrink-0">
                <StatCard icon={DollarSign} label="Faturamento Total" value={fmtBRL(faturamentoAnim)} />
                <StatCard
                  icon={evolUp ? TrendingUp : TrendingDown}
                  label="Evolução MRR"
                  value={`${evolSign} ${fmtBRL(evolAnim)}`}
                  color={evolColor}
                />
                <StatCard icon={Coins} label="Total de Vendas" value={fmtBRL(vendasAnim)} />
              </div>

              {/* Preenche o espaço livre: evolução do faturamento (MRR + pontual) QoQ */}
              <EvolucaoFaturamentoCard evolucao={hero.evolucao} />
            </div>

            {/* Coluna direita: churn total, churn s/ abonados, NRR e lista de churn */}
            <div className="flex flex-col gap-2.5 min-h-0">
              <div className="grid grid-cols-2 gap-2.5">
                <ChurnCard
                  label="Churn Total"
                  pct={hero.churnTotalPct ?? hero.churnPct}
                  brl={hero.churnTotalBrl ?? hero.churnBrl}
                  clientes={churnClientes}
                />
                <ChurnCard label="Churn s/ Abonados" pct={hero.churnPct} brl={hero.churnBrl} clientes={churnSemAbonados} />
              </div>

              {/* NRR */}
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-2.5 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[9px] text-zinc-500 uppercase tracking-wider">NRR</p>
                  <p className="text-lg font-black tabular-nums" style={{ color: nrrPositivo ? ACCENT.mrr : ACCENT.churn }}>
                    {nrrPct.toFixed(1).replace(".", ",")}%
                    <span className="text-[10px] text-zinc-600 ml-1.5 font-normal">{fmtBRL(nrrBrl)}</span>
                  </p>
                </div>
                <span
                  className={`text-[10px] font-bold rounded-full px-2 py-0.5 whitespace-nowrap ${
                    nrrPositivo ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"
                  }`}
                >
                  {nrrPositivo ? "Retenção líquida +" : "Churn líquido"}
                </span>
              </div>

              {/* Lista de clientes em churn no trimestre */}
              <div className="flex-1 min-h-0 rounded-xl bg-white/[0.03] border border-white/5 p-2.5 flex flex-col">
                <p className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1 shrink-0">
                  Clientes em churn no trimestre{churnClientes.length > 0 ? ` · ${churnClientes.length}` : ""}
                </p>
                {listaClientes.length === 0 ? (
                  <p className="text-xs text-zinc-600 italic">Nenhum churn no trimestre</p>
                ) : (
                  <ul className="flex-1 min-h-0 overflow-hidden flex flex-col gap-0.5">
                    {listaClientes.map((c, i) => (
                      <li key={`${c.nome}-${i}`} className="flex items-baseline justify-between gap-3 text-[11px]">
                        <span className={`truncate ${c.abonado ? "text-zinc-500" : "text-zinc-200"}`}>
                          {c.nome}
                          {c.abonado && <span className="ml-1 text-[8px] uppercase text-amber-500">abonado</span>}
                        </span>
                        <span className="tabular-nums shrink-0 text-zinc-300">{fmtBRL(c.valor)}</span>
                      </li>
                    ))}
                    {restantes > 0 && <li className="text-[10px] text-zinc-600 mt-0.5">+ {restantes} outros</li>}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
