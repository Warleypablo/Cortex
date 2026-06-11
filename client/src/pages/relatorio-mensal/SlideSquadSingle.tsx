import { LayoutGrid, TrendingUp, TrendingDown, Activity, Sparkles, AlertTriangle } from "lucide-react";
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

const TOOLTIP_MAX_CLIENTES = 12;

function fmtBRLExato(v: number): string {
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

function ChurnClientesTooltip({ titulo, clientes }: { titulo: string; clientes: ChurnCliente[] }) {
  if (clientes.length === 0) {
    return <p className="text-xs text-zinc-400">Nenhum churn no período</p>;
  }
  const visiveis = clientes.slice(0, TOOLTIP_MAX_CLIENTES);
  const restantes = clientes.slice(TOOLTIP_MAX_CLIENTES);
  const valorRestante = restantes.reduce((acc, c) => acc + c.valor, 0);
  return (
    <div className="max-w-xs">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
        {titulo} · {clientes.length} cliente{clientes.length > 1 ? "s" : ""}
      </p>
      <ul className="space-y-0.5">
        {visiveis.map((c, i) => (
          <li key={`${c.nome}-${i}`} className="flex items-baseline justify-between gap-4 text-xs">
            <span className={`truncate ${c.abonado ? "text-zinc-400" : "text-zinc-100"}`}>
              {c.nome}
              {c.abonado && <span className="ml-1 text-[9px] uppercase text-amber-500">abonado</span>}
            </span>
            <span className="tabular-nums shrink-0 text-zinc-100">{fmtBRLExato(c.valor)}</span>
          </li>
        ))}
        {restantes.length > 0 && (
          <li className="flex items-baseline justify-between gap-4 text-xs text-zinc-400">
            <span>+ {restantes.length} outros</span>
            <span className="tabular-nums shrink-0">{fmtBRLExato(valorRestante)}</span>
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
          const churnCards = [
            { label: "Churn Total", labelCompact: "Churn Total", pct: sq.churnTotalPct ?? sq.churnPct, brl: sq.churnTotalBrl ?? sq.churnBrl, clientes: churnClientes },
            { label: "Churn s/ Abonados", labelCompact: "Churn s/ Abono", pct: sq.churnPct, brl: sq.churnBrl, clientes: churnClientes.filter((c) => !c.abonado) },
          ];
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

              {/* KPIs: hero/compact em 2 colunas; densidade média em 6 colunas (2 linhas) */}
              <div className={`grid ${isHero || isCompact ? "grid-cols-2" : "grid-cols-6"} ${isHero ? "p-6 gap-5" : isCompact ? "p-2 gap-2" : "p-3 gap-2"}`}>
                {/* MRR Ativo */}
                <div className={`rounded-xl bg-white/[0.03] border border-white/5 flex flex-col gap-1 ${isCompact ? "p-2" : "p-3"} ${!isHero && !isCompact ? "col-span-2" : ""}`}>
                  <div className="flex items-center gap-1.5">
                    <Activity className="h-3 w-3 text-zinc-500" />
                    <p className="text-[9px] text-zinc-500 uppercase tracking-wider">MRR Ativo</p>
                  </div>
                  <p className={`font-black tabular-nums ${isHero ? "text-3xl" : isCompact ? "text-sm" : "text-xl"}`} style={{ color: "#fff" }}>
                    {fmtBRL(sq.mrr)}
                  </p>
                </div>

                {/* Pontual Entregue */}
                <div className={`rounded-xl bg-white/[0.03] border border-white/5 flex flex-col gap-1 ${isCompact ? "p-2" : "p-3"} ${!isHero && !isCompact ? "col-span-2" : ""}`}>
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-zinc-500" />
                    <p className="text-[9px] text-zinc-500 uppercase tracking-wider">{isCompact ? "Pontual" : "Pontual Entregue"}</p>
                  </div>
                  <p className={`font-black tabular-nums ${isHero ? "text-3xl" : isCompact ? "text-sm" : "text-xl"}`} style={{ color: "#fff" }}>
                    {fmtBRL(sq.pontual)}
                  </p>
                </div>

                {/* Evolução MRR */}
                <div className={`rounded-xl bg-white/[0.03] border border-white/5 flex flex-col gap-1 col-span-2 ${isCompact ? "p-2" : "p-3"}`}>
                  <div className="flex items-center gap-1.5">
                    {evolUp ? (
                      <TrendingUp className="h-3 w-3 text-zinc-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-zinc-500" />
                    )}
                    <p className="text-[9px] text-zinc-500 uppercase tracking-wider">{isCompact ? "Evol. MRR" : "Evolução MRR"}</p>
                  </div>
                  <p
                    className={`font-black tabular-nums ${isHero ? "text-3xl" : isCompact ? "text-sm" : "text-xl"}`}
                    style={{ color: evolColor }}
                  >
                    {evolSign} R$ {evolAbs.toLocaleString("pt-BR")}
                  </p>
                </div>

                {/* Churn Total e Churn s/ Abonados (coluna abonar_churn) */}
                {churnCards.map((card) => {
                  const cardColor = card.pct >= 8 ? "#ef4444" : "#22c55e";
                  return (
                    <Tooltip key={card.label}>
                      <TooltipTrigger asChild>
                        <div className={`rounded-xl bg-white/[0.03] border border-white/5 flex flex-col gap-1 cursor-default ${isCompact ? "p-2" : "p-3"} ${!isHero && !isCompact ? "col-span-3" : ""}`}>
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className="h-3 w-3 text-zinc-500" />
                            <p className="text-[9px] text-zinc-500 uppercase tracking-wider">
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
                            {!isCompact && (
                              <p className="text-[10px] text-zinc-600 tabular-nums">
                                {fmtBRL(card.brl)} / {fmtBRL(sq.mrrBase || 0)}
                              </p>
                            )}
                          </div>
                          {/* Mini progress bar — só fora do compact */}
                          {!isCompact && (
                            <div className="h-1 rounded-full bg-white/5 overflow-hidden mt-1">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(card.pct * 5, 100)}%`,
                                  background: cardColor,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </TooltipTrigger>
                      {/* Slide é sempre escuro — força tooltip dark independente do tema do app */}
                      <TooltipContent side="top" className="bg-zinc-900 border border-white/10 text-zinc-100 shadow-xl">
                        <ChurnClientesTooltip titulo={card.label} clientes={card.clientes} />
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
