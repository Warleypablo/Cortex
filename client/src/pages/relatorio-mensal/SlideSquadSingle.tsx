import { LayoutGrid, TrendingUp, TrendingDown, Activity, Sparkles, AlertTriangle, DollarSign, Coins } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ChurnCliente, SquadDetail } from "./types";
import SlideLayout from "./SlideLayout";
import { SlideHeader } from "./SlideComponents";

interface Props {
  details: SquadDetail[];
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
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

// Acima deste número de clientes o tooltip passa a 2 colunas pra não estourar a altura do slide
const TOOLTIP_DUAS_COLUNAS = 14;

function fmtBRLExato(v: number): string {
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

function ChurnClientesTooltip({ titulo, clientes, expansao = 0 }: { titulo: string; clientes: ChurnCliente[]; expansao?: number }) {
  if (clientes.length === 0 && expansao <= 0) {
    return <p className="text-xs text-zinc-400">Nenhum churn no período</p>;
  }
  const duasColunas = clientes.length > TOOLTIP_DUAS_COLUNAS;
  return (
    <div className={duasColunas ? "max-w-lg" : "max-w-xs"}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
        {titulo} · {clientes.length} cliente{clientes.length > 1 ? "s" : ""}
      </p>
      <ul className={`max-h-[60vh] overflow-y-auto ${duasColunas ? "grid grid-cols-2 gap-x-4 gap-y-0.5" : "space-y-0.5"}`}>
        {clientes.map((c, i) => (
          <li key={`${c.nome}-${i}`} className="flex items-baseline justify-between gap-4 text-xs">
            <span className={`truncate ${c.abonado ? "text-zinc-400" : "text-zinc-100"}`}>
              {c.nome}
              {c.abonado && <span className="ml-1 text-[9px] uppercase text-amber-500">abonado</span>}
            </span>
            <span className="tabular-nums shrink-0 text-zinc-100">{fmtBRLExato(c.valor)}</span>
          </li>
        ))}
        {expansao > 0 && (
          <li className={`flex items-baseline justify-between gap-4 text-xs border-t border-white/10 mt-1 pt-1 ${duasColunas ? "col-span-2" : ""}`}>
            <span className="text-emerald-400">Expansão (abatida)</span>
            <span className="tabular-nums shrink-0 text-emerald-400">− {fmtBRLExato(expansao)}</span>
          </li>
        )}
      </ul>
    </div>
  );
}

export default function SlideSquadSingle({ details, mesLabel }: Props) {
  if (details.length === 0) {
    return (
      <SlideLayout section="commerce">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-500">Sem dados de squads para este período</p>
        </div>
      </SlideLayout>
    );
  }

  // Layout density baseado em quantos squads aparecem ao mesmo tempo
  // 1 = hero;  2 = lado a lado;  3-4 = 2 cols;  5-6 = 3 cols;  7-8 = 4 cols
  const cols =
    details.length === 1 ? 1 :
    details.length === 2 ? 2 :
    details.length <= 4 ? 2 :
    details.length <= 6 ? 3 :
    4;

  const isHero = details.length === 1;
  // 5+ squads = 2 linhas de cards; usa densidade compacta para caber na altura do slide
  const isCompact = details.length >= 5;

  return (
    <SlideLayout section="commerce" padding="28px 36px">
      <SlideHeader
        icon={LayoutGrid}
        iconColor="text-purple-400"
        title={`Detalhes por Squad — ${mesLabel}`}
        gradientColor="#a855f7"
      />

      <div
        className={`flex-1 grid gap-4 min-h-0 content-start ${
          cols === 4 ? "grid-cols-4" :
          cols === 3 ? "grid-cols-3" :
          cols === 2 ? "grid-cols-2" :
          "grid-cols-1"
        }`}
        style={{ gridAutoRows: details.length <= 2 ? "1fr" : "min-content" }}
      >
        {details.map((sq, idx) => {
          const { emoji, name } = parseSquadName(sq.squad);
          const color = getColor(name);
          const evolUp = sq.evolucaoMrr >= 0;
          const evolColor = evolUp ? "#22c55e" : "#ef4444";
          const evolSign = evolUp ? "+" : "−";
          const evolAbs = Math.abs(Math.round(sq.evolucaoMrr));
          const churnClientes = sq.churnClientes ?? [];
          const expansaoNrr = sq.expansaoNrr ?? 0;
          // NRR = churn s/ abonados − abatimento da expansão; sempre exibido, mesmo sem expansão no mês
          const churnCards = [
            { label: "Churn Total", labelCompact: "Churn Total", pct: sq.churnTotalPct ?? sq.churnPct, brl: sq.churnTotalBrl ?? sq.churnBrl, clientes: churnClientes, expansao: 0, spanCompact: false },
            { label: "Churn s/ Abonados", labelCompact: "S/ Abono", pct: sq.churnPct, brl: sq.churnBrl, clientes: churnClientes.filter((c) => !c.abonado), expansao: 0, spanCompact: false },
            // spanCompact: no compact (3 colunas) o NRR fecha a última linha ocupando 2 células
            { label: "NRR", labelCompact: "NRR", pct: sq.nrrPct ?? sq.churnPct, brl: sq.nrrBrl ?? sq.churnBrl, clientes: churnClientes.filter((c) => !c.abonado), expansao: expansaoNrr, spanCompact: true },
          ];
          const faturamentoTotal = sq.mrr + sq.pontual;
          const vendasCard = (
            <div className={`rounded-xl bg-white/[0.03] border border-white/5 flex flex-col gap-1 ${isCompact ? "p-2" : "p-3"} ${!isHero && !isCompact ? "col-span-2" : ""}`}>
              <div className="flex items-center gap-1.5">
                {!isCompact && <Coins className="h-3 w-3 shrink-0 text-zinc-500" />}
                <p className="text-[9px] text-zinc-500 uppercase tracking-wider whitespace-nowrap">{isCompact ? "Vendas" : "Total de Vendas"}</p>
              </div>
              <p className={`font-black tabular-nums ${isHero ? "text-3xl" : isCompact ? "text-sm" : "text-xl"}`} style={{ color: "#fff" }}>
                {fmtBRL(sq.vendasMes ?? 0)}
              </p>
            </div>
          );
          const evolCard = (
            <div className={`rounded-xl bg-white/[0.03] border border-white/5 flex flex-col gap-1 ${isCompact ? "p-2" : "p-3"} ${!isHero && !isCompact ? "col-span-2" : ""}`}>
              <div className="flex items-center gap-1.5">
                {!isCompact && (evolUp ? (
                  <TrendingUp className="h-3 w-3 shrink-0 text-zinc-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 shrink-0 text-zinc-500" />
                ))}
                <p className="text-[9px] text-zinc-500 uppercase tracking-wider whitespace-nowrap">{isCompact ? "Evol. MRR" : "Evolução MRR"}</p>
              </div>
              <p
                className={`font-black tabular-nums ${isHero ? "text-3xl" : isCompact ? "text-sm" : "text-xl"}`}
                style={{ color: evolColor }}
              >
                {isCompact ? `${evolSign} ${fmtBRL(evolAbs)}` : `${evolSign} R$ ${evolAbs.toLocaleString("pt-BR")}`}
              </p>
            </div>
          );
          // O último card é o "novo" no build-up — anima mais marcadamente
          const isLast = idx === details.length - 1;

          return (
            <div
              key={sq.squad}
              className={`rounded-2xl flex flex-col overflow-hidden shadow-xl shadow-black/30 animate-in fade-in ${
                isLast ? "slide-in-from-bottom-6 zoom-in-95" : "slide-in-from-bottom-2"
              }`}
              style={{
                background: `linear-gradient(135deg, ${color}14 0%, rgba(255,255,255,0.02) 60%)`,
                border: `1px solid ${color}30`,
                animationDelay: `${idx * 90}ms`,
                animationDuration: isLast ? "550ms" : "380ms",
                animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
                animationFillMode: "backwards",
              }}
            >
              {/* Header com avatar colorido */}
              <div
                className={`flex items-center gap-3 ${isCompact ? "px-3 py-2" : isHero ? "px-5 py-4" : "px-5 py-3"}`}
                style={{ borderBottom: `1px solid ${color}25` }}
              >
                <div
                  className="rounded-full flex items-center justify-center shrink-0"
                  style={{
                    width: isHero ? 64 : isCompact ? 36 : 48,
                    height: isHero ? 64 : isCompact ? 36 : 48,
                    background: `radial-gradient(circle at 30% 30%, ${color}50, ${color}20)`,
                    border: `2px solid ${color}`,
                    boxShadow: `0 0 24px ${color}40`,
                  }}
                >
                  {emoji ? (
                    <span style={{ fontSize: isHero ? 32 : isCompact ? 18 : 24, lineHeight: 1 }}>{emoji}</span>
                  ) : (
                    <span className="font-black text-white" style={{ fontSize: isHero ? 22 : isCompact ? 14 : 18 }}>
                      {name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3
                    className={`font-black tracking-wide truncate ${isHero ? "text-3xl" : isCompact ? "text-base" : "text-xl"}`}
                    style={{ color }}
                  >
                    {name.toUpperCase()}
                  </h3>
                  {!isCompact && (
                    <p className="text-[11px] text-zinc-500 uppercase tracking-widest mt-0.5">
                      Performance · {mesLabel}
                    </p>
                  )}
                </div>
              </div>

              {/* KPIs: hero em 2 colunas (4 linhas); compact em 3 colunas (3 linhas); média em 8 colunas (2 linhas de 4) */}
              <div className={`grid ${isHero ? "grid-cols-2" : isCompact ? "grid-cols-3" : "grid-cols-8"} ${isHero ? "p-6 gap-5" : isCompact ? "p-2 gap-2" : "p-3 gap-2"}`}>
                {/* MRR Ativo */}
                <div className={`rounded-xl bg-white/[0.03] border border-white/5 flex flex-col gap-1 ${isCompact ? "p-2" : "p-3"} ${!isHero && !isCompact ? "col-span-2" : ""}`}>
                  <div className="flex items-center gap-1.5">
                    {!isCompact && <Activity className="h-3 w-3 shrink-0 text-zinc-500" />}
                    <p className="text-[9px] text-zinc-500 uppercase tracking-wider whitespace-nowrap">MRR Ativo</p>
                  </div>
                  <p className={`font-black tabular-nums ${isHero ? "text-3xl" : isCompact ? "text-sm" : "text-xl"}`} style={{ color: "#fff" }}>
                    {fmtBRL(sq.mrr)}
                  </p>
                </div>

                {/* Pontual Entregue */}
                <div className={`rounded-xl bg-white/[0.03] border border-white/5 flex flex-col gap-1 ${isCompact ? "p-2" : "p-3"} ${!isHero && !isCompact ? "col-span-2" : ""}`}>
                  <div className="flex items-center gap-1.5">
                    {!isCompact && <Sparkles className="h-3 w-3 shrink-0 text-zinc-500" />}
                    <p className="text-[9px] text-zinc-500 uppercase tracking-wider whitespace-nowrap">{isCompact ? "Pontual" : "Pontual Entregue"}</p>
                  </div>
                  <p className={`font-black tabular-nums ${isHero ? "text-3xl" : isCompact ? "text-sm" : "text-xl"}`} style={{ color: "#fff" }}>
                    {fmtBRL(sq.pontual)}
                  </p>
                </div>

                {/* Faturamento Total = MRR ativo + pontual entregue no mês */}
                <div className={`rounded-xl bg-white/[0.03] border border-white/5 flex flex-col gap-1 ${isCompact ? "p-2" : "p-3"} ${!isHero && !isCompact ? "col-span-2" : ""}`}>
                  <div className="flex items-center gap-1.5">
                    {!isCompact && <DollarSign className="h-3 w-3 shrink-0 text-zinc-500" />}
                    <p className="text-[9px] text-zinc-500 uppercase tracking-wider whitespace-nowrap">{isCompact ? "Faturamento" : "Faturamento Total"}</p>
                  </div>
                  <p className={`font-black tabular-nums ${isHero ? "text-3xl" : isCompact ? "text-sm" : "text-xl"}`} style={{ color: "#fff" }}>
                    {fmtBRL(faturamentoTotal)}
                  </p>
                </div>

                {/* Evolução fecha a linha do Faturamento */}
                {evolCard}

                {/* Total de Vendas (expansão do mês) abre a linha dos churns */}
                {vendasCard}

                {/* Churn Total, Churn s/ Abonados (coluna abonar_churn) e NRR */}
                {churnCards.map((card) => {
                  const cardColor = card.pct >= 8 ? "#ef4444" : "#22c55e";
                  return (
                    <Tooltip key={card.label}>
                      <TooltipTrigger asChild>
                        <div className={`rounded-xl bg-white/[0.03] border border-white/5 flex flex-col gap-1 cursor-default ${isCompact ? "p-2" : "p-3"} ${!isHero && !isCompact ? "col-span-2" : ""} ${isCompact && card.spanCompact ? "col-span-2" : ""}`}>
                          <div className="flex items-center gap-1.5">
                            {!isCompact && <AlertTriangle className="h-3 w-3 shrink-0 text-zinc-500" />}
                            <p className="text-[9px] text-zinc-500 uppercase tracking-wider whitespace-nowrap">
                              {isCompact ? card.labelCompact : card.label}
                            </p>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <p
                              className={`font-black tabular-nums ${isHero ? "text-3xl" : isCompact ? "text-sm" : "text-xl"}`}
                              style={{ color: cardColor }}
                            >
                              {card.pct.toFixed(1).replace(".", ",")}%
                            </p>
                            {/* Valor monetário do churn sempre visível; base só no hero (espaço) */}
                            <p className={`tabular-nums whitespace-nowrap ${isCompact ? "text-[9px] text-zinc-500" : "text-[10px] text-zinc-600"}`}>
                              {isHero ? `${fmtBRL(card.brl)} / ${fmtBRL(sq.mrrBase || 0)}` : fmtBRL(card.brl)}
                            </p>
                          </div>
                          {/* Mini progress bar — só fora do compact */}
                          {!isCompact && (
                            <div className="h-1 rounded-full bg-white/5 overflow-hidden mt-1">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(Math.max(card.pct, 0) * 5, 100)}%`,
                                  background: cardColor,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </TooltipTrigger>
                      {/* Slide é sempre escuro — força tooltip dark independente do tema do app */}
                      <TooltipContent side="top" className="bg-zinc-900 border border-white/10 text-zinc-100 shadow-xl">
                        <ChurnClientesTooltip titulo={card.label} clientes={card.clientes} expansao={card.expansao} />
                      </TooltipContent>
                    </Tooltip>
                  );
                })}

              </div>
            </div>
          );
        })}
      </div>
    </SlideLayout>
  );
}
