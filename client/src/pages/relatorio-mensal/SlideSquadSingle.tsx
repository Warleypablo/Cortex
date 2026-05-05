import { LayoutGrid } from "lucide-react";
import type { SquadDetail } from "./types";
import SlideLayout from "./SlideLayout";
import { SlideHeader, SecondaryCard } from "./SlideComponents";

interface Props {
  squad: SquadDetail;
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
  "Black":         "#475569",
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

export default function SlideSquadSingle({ squad, mesLabel }: Props) {
  const { emoji, name } = parseSquadName(squad.squad);
  const color = getColor(name);
  const churnColor = squad.churnPct >= 8 ? "#ef4444" : "#22c55e";
  const evolColor = squad.evolucaoMrr >= 0 ? "#22c55e" : "#ef4444";
  const evolSign = squad.evolucaoMrr >= 0 ? "+" : "";
  const title = `${emoji ? emoji + " " : ""}${name.toUpperCase()} — ${mesLabel}`;

  return (
    <SlideLayout section="commerce" padding="28px 36px">
      <SlideHeader
        icon={LayoutGrid}
        iconColor="text-zinc-300"
        title={title}
        gradientColor={color}
      />

      <div className="flex-1 grid grid-cols-4 gap-4 min-h-0 content-start pt-2">
        {/* MRR Ativo */}
        <SecondaryCard className="p-5 flex flex-col justify-center gap-2" borderColor={color}>
          <p className="text-[11px] text-zinc-500 uppercase tracking-wide">MRR Ativo</p>
          <p className="text-3xl font-black" style={{ color }}>{fmtBRL(squad.mrr)}</p>
          <p className="text-[11px] text-zinc-600">{squad.clientes} cliente{squad.clientes !== 1 ? "s" : ""}</p>
        </SecondaryCard>

        {/* Pontual Entregue */}
        <SecondaryCard className="p-5 flex flex-col justify-center gap-2">
          <p className="text-[11px] text-zinc-500 uppercase tracking-wide">Pontual Entregue</p>
          <p className="text-3xl font-black text-cyan-400">{fmtBRL(squad.pontual)}</p>
          <p className="text-[11px] text-zinc-600">{mesLabel}</p>
        </SecondaryCard>

        {/* Churn */}
        <SecondaryCard className="p-5 flex flex-col justify-center gap-2">
          <p className="text-[11px] text-zinc-500 uppercase tracking-wide">Churn</p>
          <p className="text-3xl font-black" style={{ color: churnColor }}>
            {squad.churnPct.toFixed(1).replace(".", ",")}%
          </p>
          <p className="text-[11px] text-zinc-600">
            {fmtBRL(squad.churnBrl)} / {fmtBRL(squad.mrrBase || 0)}
          </p>
        </SecondaryCard>

        {/* Evolução MRR */}
        <SecondaryCard className="p-5 flex flex-col justify-center gap-2">
          <p className="text-[11px] text-zinc-500 uppercase tracking-wide">Evolução MRR</p>
          <p className="text-3xl font-black" style={{ color: evolColor }}>
            {evolSign}{fmtBRL(squad.evolucaoMrr)}
          </p>
          <p className="text-[11px] text-zinc-600">vs. mês anterior</p>
        </SecondaryCard>
      </div>
    </SlideLayout>
  );
}
