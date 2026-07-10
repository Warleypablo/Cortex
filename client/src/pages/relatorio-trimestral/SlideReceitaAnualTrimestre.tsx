import { TrendingUp } from "lucide-react";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader } from "../relatorio-mensal/SlideComponents";
import { formatBRL } from "./deck-kit";

// Receita anual da Turbo (2022→2026). Dados hardcoded (fornecidos pelo Ichino 2026-07-10).
// A barra de 2026 é EMPILHADA: faturado efetivo (emerald) + gap até a meta (amber).
// A altura de cada barra é proporcional à META de 2026 (o topo do gráfico).
const META_2026 = 25_000_000;
const FATURADO_2026 = 8_440_000;

const DADOS: { ano: string; faturado: number; meta?: number }[] = [
  { ano: "2022", faturado: 1_133_000 },
  { ano: "2023", faturado: 2_258_000 },
  { ano: "2024", faturado: 5_025_000 },
  { ano: "2025", faturado: 11_082_096 },
  { ano: "2026", faturado: FATURADO_2026, meta: META_2026 },
];
const MAX = META_2026; // a barra da meta 2026 é a mais alta

export default function SlideReceitaAnualTrimestre() {
  return (
    <SlideLayout section="commerce" padding="36px 56px">
      <style>{`
        @keyframes barGrowUp { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @media (prefers-reduced-motion: reduce) { .bar-grow { animation: none !important; transform: scaleY(1) !important; } }
      `}</style>
      <SlideHeader
        icon={TrendingUp}
        iconColor="text-emerald-400"
        title="Receita Anual da Turbo"
        gradientColor="#34d399"
        subtitle="2022 → 2026 · meta R$ 25M"
      />

      <div className="flex-1 flex items-end justify-center gap-12 pb-2 min-h-0">
        {DADOS.map((d, i) => {
          const isMeta = !!d.meta;
          const alturaValor = isMeta ? d.meta! : d.faturado; // barra vai até a meta no 2026
          const hPct = (alturaValor / MAX) * 100;
          const faturadoPct = isMeta ? (d.faturado / d.meta!) * 100 : 100;
          const delay = i * 120;
          return (
            <div key={d.ano} className="flex flex-col items-center justify-end h-full" style={{ width: 150 }}>
              {/* Rótulo de valor acima da barra */}
              <div className="mb-3 text-center shrink-0">
                {isMeta ? (
                  <>
                    <p className="text-emerald-400 font-black text-[26px] leading-none tabular-nums">{formatBRL(d.faturado)}</p>
                    <p className="text-amber-400/90 text-xs font-semibold mt-1 tabular-nums">meta {formatBRL(d.meta!)}</p>
                  </>
                ) : (
                  <p className="text-white font-black text-xl leading-none tabular-nums">{formatBRL(d.faturado)}</p>
                )}
              </div>

              {/* Barra (empilhada no 2026) */}
              <div
                className="bar-grow w-full rounded-t-xl overflow-hidden flex flex-col shadow-lg shadow-black/30"
                style={{ height: `${hPct}%`, transformOrigin: "bottom", animation: `barGrowUp 650ms ease-out ${delay}ms both` }}
              >
                {isMeta && (
                  <div
                    className="w-full flex items-start justify-center pt-2"
                    style={{
                      height: `${100 - faturadoPct}%`,
                      background: "linear-gradient(to top, rgba(251,191,36,0.28), rgba(251,191,36,0.12))",
                      borderBottom: "2px dashed rgba(251,191,36,0.5)",
                    }}
                  >
                    <span className="text-amber-300/90 text-[11px] font-bold uppercase tracking-wider">gap p/ meta</span>
                  </div>
                )}
                <div
                  className="w-full"
                  style={{
                    height: isMeta ? `${faturadoPct}%` : "100%",
                    background: "linear-gradient(to top, #059669, #34d399)",
                  }}
                />
              </div>

              <p className="mt-3 font-bold text-zinc-200 shrink-0">{d.ano}</p>
            </div>
          );
        })}
      </div>
    </SlideLayout>
  );
}
