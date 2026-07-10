import { Repeat, Users, UserCheck, TrendingUp, Zap } from "lucide-react";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader, SecondaryCard } from "../relatorio-mensal/SlideComponents";
import type { Crosssell } from "./types";
import { ACCENT, fmtCompact, entrance, DeckKeyframes, GrowBar } from "./deck-kit";
import { useCountUp } from "./useCountUp";

// Cross-sell (negócios ganhos internos) do Q2 — maio + junho/2026, transcrito da tela
// "Máquina de Vendas Internas" (Ichino 2026-07-10). Hardcoded porque o "Mapeamento"
// não existe no nosso banco. Eixos destacados: valor por CX e valor por quem mapeou.
type Negocio = { cliente: string; cx: string; mapeamento: string; rec: number; pont: number };

const NEGOCIOS: Negocio[] = [
  // Abril/2026 (planilha: coluna "Fonte" → CX, coluna "Operação" → mapeamento)
  { cliente: "Awe", cx: "Zon", mapeamento: "Vinicius", rec: 0, pont: 6800 },
  { cliente: "Wave", cx: "Zon", mapeamento: "Ismael", rec: 0, pont: 15000 },
  { cliente: "EA", cx: "Zon", mapeamento: "Vinicius", rec: 0, pont: 1400 },
  { cliente: "Vitacora", cx: "Zon", mapeamento: "Andrey", rec: 0, pont: 6000 },
  { cliente: "Clickcannabis", cx: "Zon", mapeamento: "Robertinho", rec: 15000, pont: 0 },
  { cliente: "Repeat", cx: "Robertinho", mapeamento: "—", rec: 2000, pont: 16000 },
  { cliente: "Lab Genisis", cx: "Fabio", mapeamento: "—", rec: 4000, pont: 3000 },
  { cliente: "It's Lit", cx: "Zon", mapeamento: "—", rec: 2500, pont: 0 },
  { cliente: "Neophase (abr)", cx: "Zon", mapeamento: "—", rec: 0, pont: 5000 },
  { cliente: "Umeda engenharia", cx: "João", mapeamento: "—", rec: 2500, pont: 0 },
  { cliente: "Star Beauty", cx: "Zon", mapeamento: "Gabriel Taufner", rec: 0, pont: 9000 },
  { cliente: "Balmo", cx: "Zon", mapeamento: "Teto", rec: 2997, pont: 0 },
  { cliente: "Wonderlev", cx: "Zon", mapeamento: "—", rec: 0, pont: 5500 },
  { cliente: "Haux", cx: "Zon", mapeamento: "Gabriel Taufner", rec: 0, pont: 15000 },
  // Maio/2026
  { cliente: "Glulac", cx: "Cazé", mapeamento: "Gabriel Taufner", rec: 0, pont: 9000 },
  { cliente: "Latam Fit", cx: "Iasmyn", mapeamento: "Lara e Iasmyn", rec: 1997, pont: 0 },
  { cliente: "Neophase", cx: "Ray", mapeamento: "Rayane", rec: 3000, pont: 0 },
  { cliente: "Yo! Inglês", cx: "Ray", mapeamento: "Allan", rec: 0, pont: 4000 },
  { cliente: "Bevi Protein", cx: "Iasmyn", mapeamento: "Iasmyn", rec: 0, pont: 5500 },
  { cliente: "Bebedouro e Cia", cx: "Aline", mapeamento: "Allan", rec: 0, pont: 4000 },
  { cliente: "Awe Energy", cx: "Ray", mapeamento: "Vinicius Paiva", rec: 0, pont: 5300 },
  { cliente: "Gingah", cx: "Cazé", mapeamento: "—", rec: 5500, pont: 0 },
  { cliente: "Niquitin", cx: "Cazé", mapeamento: "—", rec: 0, pont: 15000 },
  { cliente: "Bueno Mate", cx: "Deborah", mapeamento: "—", rec: 2100, pont: 0 },
  { cliente: "Feat Nutrition", cx: "Ray", mapeamento: "Victor Klein", rec: 0, pont: 1800 },
  // Junho/2026
  { cliente: "Fitbar", cx: "Iasmyn", mapeamento: "Karla", rec: 2997, pont: 0 },
  { cliente: "Anttinno", cx: "Cazé", mapeamento: "Ramon", rec: 3397, pont: 0 },
  { cliente: "Melliuz", cx: "Cazé", mapeamento: "Eduardo e Ana", rec: 13000, pont: 0 },
  { cliente: "PetHelp", cx: "Deborah", mapeamento: "Ismael", rec: 6500, pont: 0 },
  { cliente: "Zuzzi Drinks", cx: "Cazé", mapeamento: "Ismael e Aline", rec: 0, pont: 5000 },
  { cliente: "Suntech", cx: "Ray", mapeamento: "Pedro Barreto", rec: 3000, pont: 0 },
  { cliente: "Nuudo", cx: "Deborah", mapeamento: "Deborah e Victor Klein", rec: 2997, pont: 1500 },
  { cliente: "Pep Protein", cx: "Iasmyn", mapeamento: "Ismael", rec: 750, pont: 0 },
  { cliente: "Creamy", cx: "Deborah", mapeamento: "—", rec: 30000, pont: 0 },
  { cliente: "MenoCare", cx: "Aline", mapeamento: "Aline e Bibiana", rec: 0, pont: 375 },
  { cliente: "Ultra Vida", cx: "Cazé", mapeamento: "Ismael", rec: 0, pont: 18000 },
  { cliente: "Outlive", cx: "Cazé", mapeamento: "Thiago Andrey", rec: 0, pont: 5500 },
  { cliente: "Volta Vibe", cx: "Cazé", mapeamento: "Julia Manhães", rec: 0, pont: 580 },
  { cliente: "Anellá", cx: "Iasmyn", mapeamento: "Iasmyn", rec: 3300, pont: 0 },
  { cliente: "Creamy", cx: "Deborah", mapeamento: "Daniel", rec: 0, pont: 20000 },
  { cliente: "Cath Beauty", cx: "Iasmyn", mapeamento: "Iasmyn", rec: 0, pont: 2750 },
  { cliente: "Black Tucano", cx: "Cazé", mapeamento: "Victor Klein", rec: 3900, pont: 0 },
  { cliente: "Óticas Paris", cx: "Cazé", mapeamento: "Victor Arpini", rec: 0, pont: 5500 },
];

type Linha = { nome: string; total: number; deals: number };

// Agrega por CX (chave única) ou por mapeador (split "X e Y", ignora "—", valor rateado).
function agregar(por: "cx" | "mapeamento"): Linha[] {
  const acc = new Map<string, { total: number; deals: number }>();
  for (const n of NEGOCIOS) {
    const valor = n.rec + n.pont;
    if (por === "cx") {
      const cur = acc.get(n.cx) ?? { total: 0, deals: 0 };
      acc.set(n.cx, { total: cur.total + valor, deals: cur.deals + 1 });
    } else {
      const nomes = n.mapeamento.split(/\s+e\s+/).map((s) => s.trim()).filter((s) => s && s !== "—");
      if (nomes.length === 0) continue;
      const fatia = valor / nomes.length;
      for (const nome of nomes) {
        const cur = acc.get(nome) ?? { total: 0, deals: 0 };
        acc.set(nome, { total: cur.total + fatia, deals: cur.deals + 1 });
      }
    }
  }
  return Array.from(acc.entries())
    .map(([nome, v]) => ({ nome, total: v.total, deals: v.deals }))
    .sort((a, b) => b.total - a.total);
}

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
  linhas: Linha[];
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
          <p className="text-xs text-zinc-600 italic">Sem dados no período</p>
        ) : (
          linhas.map((l, i) => (
            <div key={l.nome} className="flex items-center gap-3">
              <span className="w-[140px] shrink-0 text-[13px] text-zinc-300 truncate" title={l.nome}>
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

// `crosssell` do backend fica sem uso (o slide usa os negócios hardcoded); mantido na
// assinatura para não mexer no RelatorioTrimestral.
export default function SlideCrosssellTrimestre({ crosssell: _crosssell, label }: { crosssell: Crosssell; label: string }) {
  const totalRec = NEGOCIOS.reduce((s, n) => s + n.rec, 0);
  const totalPont = NEGOCIOS.reduce((s, n) => s + n.pont, 0);
  const total = totalRec + totalPont;

  const totalAnim = useCountUp(total, 800, 150);
  const recAnim = useCountUp(totalRec, 750, 300);
  const pontAnim = useCountUp(totalPont, 750, 400);

  // Zon e Robertinho vieram da planilha de abril (fonte/vendedor, não CX real) — fora do ranking Por CX.
  const CX_EXCLUIDOS = new Set(["Zon", "Robertinho"]);
  const porCx = agregar("cx").filter((l) => !CX_EXCLUIDOS.has(l.nome)).slice(0, 6);
  const porMapeamento = agregar("mapeamento").slice(0, 6);

  return (
    <SlideLayout section="commerce" padding="28px 36px">
      <DeckKeyframes />
      <SlideHeader icon={Repeat} iconColor="text-sky-400" title={`Cross-sell — ${label}`} gradientColor="#38bdf8" subtitle="Negócios ganhos por CX e por quem mapeou" />

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
                <p className="text-3xl font-black text-zinc-200 mt-1 tabular-nums">{NEGOCIOS.length}</p>
              </div>
            </div>
          </SecondaryCard>
        </div>

        {/* Dois eixos: valor por CX e valor por quem mapeou */}
        <div className="flex-1 grid grid-cols-2 gap-5 min-h-0">
          <div className={`${entrance(150).className} flex flex-col min-h-0`} style={entrance(150).style}>
            <Ranking titulo="Por CX" icone={Users} linhas={porCx} cor={ACCENT.cyan} delayBase={350} />
          </div>
          <div className={`${entrance(300).className} flex flex-col min-h-0`} style={entrance(300).style}>
            <Ranking titulo="Por mapeamento" icone={UserCheck} linhas={porMapeamento} cor={ACCENT.vendas} encurtaNome delayBase={500} />
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
