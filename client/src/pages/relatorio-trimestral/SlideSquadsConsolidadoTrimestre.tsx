import { LayoutGrid, TrendingUp, TrendingDown } from "lucide-react";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader } from "../relatorio-mensal/SlideComponents";
import type { SquadDetailTri } from "./types";
import { ACCENT, entrance, DeckKeyframes } from "./deck-kit";
import { parseSquadName, getColor, fmtBRL } from "./squad-kit";

interface Props {
  details: SquadDetailTri[];
  label: string;
}

// Tabela leaderboard com TODAS as squads num slide só (substitui os antigos slides
// "Squad em Destaque" um-a-um). Ordenada por faturamento (MRR + pontual entregue),
// com barra sutil de faturamento atrás de cada linha. Churn/NRR já vêm como TAXA
// MENSAL média (ver reportsTrimestral.churn.ts) — o "/mês" no cabeçalho das colunas.

const fmtTicket = (v: number): string => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;

// nome (largo) + 7 colunas numéricas de largura igual
const GRID_COLS = "minmax(148px, 1.7fr) repeat(7, minmax(0, 1fr))";

function HeaderCell({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider text-zinc-500 ${first ? "text-left" : "text-right"}`}>
      {children}
    </span>
  );
}

function Num({ children, color, strong }: { children: React.ReactNode; color?: string; strong?: boolean }) {
  return (
    <span
      className={`text-right tabular-nums ${strong ? "text-[15px] font-black" : "text-[13px] font-semibold text-zinc-200"}`}
      style={color ? { color } : undefined}
    >
      {children}
    </span>
  );
}

function SquadRow({ sq, maxFat, delayMs }: { sq: SquadDetailTri; maxFat: number; delayMs: number }) {
  const { emoji, name } = parseSquadName(sq.squad);
  const color = getColor(name);
  const faturamento = sq.mrr + sq.pontual;
  const churnColor = sq.churnPct >= 8 ? ACCENT.churn : ACCENT.mrr;
  const nrrPositivo = sq.nrrBrl <= 0; // expansão >= churn → retenção líquida positiva
  const nrrColor = nrrPositivo ? ACCENT.mrr : ACCENT.churn;
  const e = entrance(delayMs);

  return (
    <div className={`relative ${e.className}`} style={e.style}>
      {/* Barra de faturamento atrás da linha (relativa ao líder) */}
      <div
        className="absolute inset-y-0 left-0 rounded-lg pointer-events-none"
        style={{ width: `${(faturamento / maxFat) * 100}%`, background: `linear-gradient(to right, ${color}1f, ${color}08)` }}
      />
      <div
        className="relative grid items-center gap-3 px-3 py-2.5 rounded-lg border border-white/5"
        style={{ gridTemplateColumns: GRID_COLS }}
      >
        {/* Squad: avatar + nome */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: `${color}22`, border: `1.5px solid ${color}` }}
          >
            {emoji ? (
              <span style={{ fontSize: 15, lineHeight: 1 }}>{emoji}</span>
            ) : (
              <span className="text-[9px] font-black text-white">{name.slice(0, 2).toUpperCase()}</span>
            )}
          </div>
          <span className="text-[15px] font-bold text-white truncate">{name}</span>
        </div>

        <Num strong color="#f4f4f5">{fmtBRL(faturamento)}</Num>
        <Num>{fmtBRL(sq.mrr)}</Num>
        <Num>{fmtBRL(sq.pontual)}</Num>
        <Num>{fmtTicket(sq.ticketMedio)}</Num>
        <Num>{sq.clientes}</Num>
        <Num color={churnColor}>{sq.churnPct.toFixed(1).replace(".", ",")}%</Num>
        <span className="text-right tabular-nums text-[13px] font-semibold inline-flex items-center justify-end gap-0.5" style={{ color: nrrColor }}>
          {nrrPositivo ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {Math.abs(sq.nrrPct).toFixed(1).replace(".", ",")}%
        </span>
      </div>
    </div>
  );
}

export default function SlideSquadsConsolidadoTrimestre({ details, label }: Props) {
  const squads = [...details].sort((a, b) => (b.mrr + b.pontual) - (a.mrr + a.pontual));

  // Totais do rodapé (agregados do trimestre). Ticket e churn/NRR são ratios, não
  // somáveis — o rodapé traz só os aditivos (faturamento, MRR, pontual, clientes).
  const totFat = squads.reduce((s, q) => s + q.mrr + q.pontual, 0);
  const totMrr = squads.reduce((s, q) => s + q.mrr, 0);
  const totPontual = squads.reduce((s, q) => s + q.pontual, 0);
  const totClientes = squads.reduce((s, q) => s + q.clientes, 0);
  const maxFat = Math.max(...squads.map((q) => q.mrr + q.pontual), 1);

  return (
    <SlideLayout section="commerce" padding="28px 36px">
      <DeckKeyframes />
      <SlideHeader icon={LayoutGrid} iconColor="text-purple-400" title={`Performance por Squad — ${label}`} gradientColor="#a855f7" />

      {squads.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-500">Sem dados de squads para este trimestre</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Cabeçalho de colunas */}
          <div className="grid items-center gap-3 px-3 pb-2 shrink-0" style={{ gridTemplateColumns: GRID_COLS }}>
            <HeaderCell first>Squad</HeaderCell>
            <HeaderCell>Faturamento</HeaderCell>
            <HeaderCell>MRR</HeaderCell>
            <HeaderCell>Pontual</HeaderCell>
            <HeaderCell>Ticket</HeaderCell>
            <HeaderCell>Clientes</HeaderCell>
            <HeaderCell>Churn/mês</HeaderCell>
            <HeaderCell>NRR/mês</HeaderCell>
          </div>

          {/* Linhas */}
          <div className="flex-1 flex flex-col justify-center gap-2 min-h-0">
            {squads.map((sq, i) => (
              <SquadRow key={sq.squad} sq={sq} maxFat={maxFat} delayMs={120 + i * 80} />
            ))}
          </div>

          {/* Rodapé: total do grupo (só métricas aditivas) */}
          <div
            className="grid items-center gap-3 px-3 py-2.5 mt-2 shrink-0 rounded-lg bg-white/[0.04] border border-white/10"
            style={{ gridTemplateColumns: GRID_COLS }}
          >
            <span className="text-[13px] font-black uppercase tracking-wider text-zinc-400">Total</span>
            <Num strong color="#f4f4f5">{fmtBRL(totFat)}</Num>
            <Num>{fmtBRL(totMrr)}</Num>
            <Num>{fmtBRL(totPontual)}</Num>
            <span className="text-right text-zinc-600 text-[13px]">—</span>
            <Num>{totClientes}</Num>
            <span className="text-right text-zinc-600 text-[13px]">—</span>
            <span className="text-right text-zinc-600 text-[13px]">—</span>
          </div>
        </div>
      )}
    </SlideLayout>
  );
}
