import { Repeat, Users, Package, TrendingUp, Zap } from "lucide-react";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader, SecondaryCard } from "../relatorio-mensal/SlideComponents";
import type { Crosssell, CrosssellRanking } from "./types";
import { ACCENT, fmtCompact, entrance, DeckKeyframes, GrowBar } from "./deck-kit";
import { useCountUp } from "./useCountUp";

// Cross-sell do trimestre: deals PARTNER ganhos para clientes PRÉ-EXISTENTES
// (mesma régua do drawer de NRR). Dois eixos: CX responsável e produto vendido.
//
// A coluna "Mapeamento" da planilha de cross-sell não existe em nenhuma tabela
// nossa; o eixo de produto entra no lugar dela (decisão 2026-07-09, Ichino).

function firstName(nome: string): string {
  const parts = nome.split(" ").filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${parts[1]}` : (parts[0] ?? nome);
}

function Ranking({
  titulo,
  icone: Icone,
  linhas,
  cor,
  encurtaNome,
  delayBase,
}: {
  titulo: string;
  icone: typeof Users;
  linhas: CrosssellRanking[];
  cor: string;
  encurtaNome?: boolean;
  delayBase: number;
}) {
  const max = Math.max(...linhas.map((l) => l.total), 1);

  return (
    <SecondaryCard className="px-6 py-5 flex-1 flex flex-col min-h-0">
      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest shrink-0" style={{ color: cor }}>
        <Icone className="h-4 w-4" /> {titulo}
      </span>
      <div className="flex-1 flex flex-col justify-center gap-2.5 mt-4 min-h-0">
        {linhas.length === 0 ? (
          <p className="text-xs text-zinc-600 italic">Sem cross-sell no período</p>
        ) : (
          linhas.map((l, i) => (
            <div key={l.nome} className="flex items-center gap-3">
              <span className="w-[130px] shrink-0 text-[13px] text-zinc-300 truncate">
                {encurtaNome ? firstName(l.nome) : l.nome}
              </span>
              <div className="flex-1 h-5 rounded bg-zinc-800/60 overflow-hidden">
                <GrowBar widthPct={(l.total / max) * 100} delayMs={delayBase + i * 70} className="rounded">
                  <div className="w-full h-full rounded" style={{ background: `linear-gradient(to right, ${cor}, ${cor}99)` }} />
                </GrowBar>
              </div>
              <span className="w-[76px] shrink-0 text-right text-[13px] font-bold tabular-nums text-zinc-200">
                {fmtCompact(l.total)}
              </span>
              <span className="w-[38px] shrink-0 text-right text-[11px] tabular-nums text-zinc-500">{l.deals}d</span>
            </div>
          ))
        )}
      </div>
    </SecondaryCard>
  );
}

export default function SlideCrosssellTrimestre({ crosssell, label }: { crosssell: Crosssell; label: string }) {
  const totalAnim = useCountUp(crosssell.total, 800, 150);
  const recAnim = useCountUp(crosssell.recorrente, 750, 300);
  const pontAnim = useCountUp(crosssell.pontual, 750, 400);

  // 6 linhas cabem sem apertar os 720px; o resto vira "Outros" implícito na cauda.
  const porCx = crosssell.porCx.slice(0, 6);
  const porProduto = crosssell.porProduto.slice(0, 6);

  return (
    <SlideLayout section="commerce" padding="28px 36px">
      <DeckKeyframes />
      <SlideHeader icon={Repeat} iconColor="text-sky-400" title={`Cross-sell — ${label}`} gradientColor="#38bdf8" />

      <div className="flex-1 flex flex-col gap-4 min-h-0">
        {/* Hero: total do trimestre + composição */}
        <div className={`${entrance(0).className} shrink-0`} style={entrance(0).style}>
          <SecondaryCard className="px-8 py-5 flex items-end justify-between">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-[0.25em]">Cross-sell no trimestre</p>
              <p className="text-6xl font-black leading-none mt-2 bg-gradient-to-r from-sky-300 to-cyan-400 bg-clip-text text-transparent">
                {fmtCompact(totalAnim)}
              </p>
            </div>
            <div className="flex items-center gap-8">
              <div className="text-right">
                <span className="flex items-center justify-end gap-1.5 text-[11px] font-bold text-emerald-400 uppercase tracking-widest">
                  <TrendingUp className="h-3.5 w-3.5" /> Recorrente
                </span>
                <p className="text-3xl font-black text-emerald-400 mt-1">{fmtCompact(recAnim)}</p>
              </div>
              <div className="text-right">
                <span className="flex items-center justify-end gap-1.5 text-[11px] font-bold text-purple-400 uppercase tracking-widest">
                  <Zap className="h-3.5 w-3.5" /> Pontual
                </span>
                <p className="text-3xl font-black text-purple-400 mt-1">{fmtCompact(pontAnim)}</p>
              </div>
              <div className="text-right pl-6 border-l border-white/10">
                <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Deals</p>
                <p className="text-3xl font-black text-zinc-200 mt-1 tabular-nums">{crosssell.totalDeals}</p>
              </div>
            </div>
          </SecondaryCard>
        </div>

        {/* Dois eixos: quem vendeu (CX) e o que foi vendido (produto) */}
        <div className="flex-1 grid grid-cols-2 gap-5 min-h-0">
          <div className={`${entrance(150).className} flex flex-col min-h-0`} style={entrance(150).style}>
            <Ranking titulo="Por CX" icone={Users} linhas={porCx} cor={ACCENT.cyan} encurtaNome delayBase={350} />
          </div>
          <div className={`${entrance(300).className} flex flex-col min-h-0`} style={entrance(300).style}>
            <Ranking titulo="Por produto" icone={Package} linhas={porProduto} cor={ACCENT.vendas} delayBase={500} />
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
