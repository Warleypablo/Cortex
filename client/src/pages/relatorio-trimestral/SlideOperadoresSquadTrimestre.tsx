import { Trophy } from "lucide-react";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader, SecondaryCard } from "../relatorio-mensal/SlideComponents";
import type { SquadOperadores, OperadorSquad } from "./types";
import { fmtCompact, entrance } from "./deck-kit";

// Emoji-prefixo + nome-base de "🪖 Selva"
function parseSquadName(raw: string): { emoji: string; name: string } {
  const trimmed = (raw || "").trim();
  const idx = trimmed.search(/[A-Za-z]/);
  if (idx > 0) return { emoji: trimmed.slice(0, idx).trim(), name: trimmed.slice(idx).trim() };
  return { emoji: "", name: trimmed };
}

function firstName(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${parts[1]}` : (parts[0] ?? name);
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

// Cores de medalha (1º/2º/3º)
const MEDAL = ["#f59e0b", "#a1a1aa", "#f97316"];

function Avatar({ nome, url, px }: { nome: string; url: string | null; px: number }) {
  const style = { width: px, height: px };
  if (url) return <img src={url} alt={nome} style={style} className="rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />;
  return (
    <div style={{ ...style, fontSize: Math.max(px * 0.34, 9) }} className="rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center font-bold text-white/90 shrink-0">
      {initials(nome)}
    </div>
  );
}

function OperadorRow({ op, pos }: { op: OperadorSquad; pos: number }) {
  const medal = MEDAL[pos] ?? "#52525b";
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative shrink-0">
        <div className="rounded-full" style={{ padding: 2, border: `2px solid ${medal}` }}>
          <Avatar nome={op.nome} url={op.fotoUrl} px={pos === 0 ? 40 : 34} />
        </div>
        <span
          className="absolute -bottom-1 -right-1 rounded-full text-white text-[9px] font-black flex items-center justify-center"
          style={{ width: 15, height: 15, backgroundColor: medal }}
        >
          {pos + 1}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-bold text-white truncate ${pos === 0 ? "text-sm" : "text-xs"}`}>{firstName(op.nome)}</p>
        {op.cargo && <p className="text-[10px] text-zinc-500 truncate">{op.cargo}</p>}
      </div>
      <span className={`font-black text-emerald-400 tabular-nums shrink-0 ${pos === 0 ? "text-lg" : "text-sm"}`}>
        {fmtCompact(op.mrr)}
      </span>
    </div>
  );
}

function SquadCard({ sq, delayMs }: { sq: SquadOperadores; delayMs: number }) {
  const { emoji, name } = parseSquadName(sq.squad);
  return (
    <div className={entrance(delayMs).className} style={entrance(delayMs).style}>
      <SecondaryCard className="px-5 py-4 h-full flex flex-col" borderColor="#34d399">
        <div className="flex items-center gap-2.5 mb-3 shrink-0">
          {emoji
            ? <span style={{ fontSize: 22, lineHeight: 1 }}>{emoji}</span>
            : <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />}
          <p className="text-lg font-black text-white truncate flex-1">{name}</p>
          <div className="text-right shrink-0">
            <p className="text-sm font-black text-emerald-400 tabular-nums">{fmtCompact(sq.totalMrr)}</p>
            <p className="text-[9px] text-zinc-500 uppercase tracking-wider">{sq.numOperadores} operadores</p>
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-center gap-3">
          {sq.operadores.map((op, i) => <OperadorRow key={`${op.nome}-${i}`} op={op} pos={i} />)}
        </div>
      </SecondaryCard>
    </div>
  );
}

export default function SlideOperadoresSquadTrimestre({ squads, label }: { squads: SquadOperadores[]; label: string }) {
  if (squads.length === 0) {
    return (
      <SlideLayout section="commerce" padding="28px 36px">
        <SlideHeader icon={Trophy} iconColor="text-emerald-400" title={`Operadores por Squad — ${label}`} gradientColor="#10b981" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-500">Sem dados de operadores para este trimestre</p>
        </div>
      </SlideLayout>
    );
  }

  return (
    <SlideLayout section="commerce" padding="28px 36px">
      <SlideHeader icon={Trophy} iconColor="text-emerald-400" title={`Operadores por Squad — ${label}`} gradientColor="#10b981" subtitle="Top 3 por MRR sob gestão" />
      <div className="flex-1 grid grid-cols-3 gap-5 min-h-0" style={{ gridAutoRows: "1fr" }}>
        {squads.map((sq, i) => <SquadCard key={sq.squad} sq={sq} delayMs={i * 90} />)}
      </div>
    </SlideLayout>
  );
}
