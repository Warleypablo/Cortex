import turboLogo from "@assets/logo-branca.png";
import type { RelatorioTrimestralData, Qoq } from "./types";
import { useCountUp } from "./useCountUp";

// Capa dedicada do Reporte Trimestral: o trimestre é o protagonista.
// Numeral gigante em gradiente + horizonte de grade em perspectiva + 3 headlines com count-up.

const PERIODO_POR_QUARTER: Record<number, string> = {
  1: "Janeiro — Março",
  2: "Abril — Junho",
  3: "Julho — Setembro",
  4: "Outubro — Dezembro",
};

function fmtCompact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace(".", ",")}M`;
  if (abs >= 1_000) return `R$ ${Math.round(v / 1_000)}k`;
  return `R$ ${Math.round(v)}`;
}

function DeltaArrow({ q }: { q: Qoq }) {
  if (!q.anterior) return null;
  const pct = ((q.atual - q.anterior) / Math.abs(q.anterior)) * 100;
  const positivo = pct >= 0;
  const bom = q.betterDirection === "up" ? positivo : !positivo;
  return (
    <span className={`text-xs font-bold tabular-nums ${bom ? "text-emerald-400" : "text-red-400"}`}>
      {positivo ? "▲" : "▼"} {Math.abs(pct).toFixed(1).replace(".", ",")}%
    </span>
  );
}

function HeadlineChip({
  label,
  q,
  accent,
  delayMs,
}: {
  label: string;
  q: Qoq;
  accent: string;
  delayMs: number;
}) {
  // Count-up começa junto com a entrada do chip e termina antes do screenshot do PDF (1200ms)
  const v = useCountUp(q.atual, 700, delayMs);
  return (
    <div
      className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm px-5 py-4 animate-in fade-in slide-in-from-bottom-4 duration-500 motion-reduce:animate-none"
      style={{ animationDelay: `${delayMs}ms`, animationFillMode: "both", borderTop: `2px solid ${accent}` }}
    >
      <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em]">{label}</p>
      <div className="flex items-baseline gap-2 mt-1">
        <p className="text-2xl font-black text-white">{fmtCompact(v)}</p>
        <DeltaArrow q={q} />
      </div>
    </div>
  );
}

export default function SlideCapaTrimestre({ data }: { data: RelatorioTrimestralData }) {
  const [anoStr, qStr] = data.trimestre.split("-Q");
  const quarter = parseInt(qStr, 10);
  const periodo = PERIODO_POR_QUARTER[quarter] ?? "";
  const { qoq } = data.trend;

  return (
    <div className="w-full h-full relative overflow-hidden flex flex-col" style={{ backgroundColor: "#05060f" }}>
      {/* Aurora: dois lavados radiais discretos (verde/ciano — cores de receita do deck) */}
      <div
        className="absolute -top-1/4 -left-[10%] w-[55%] h-[70%] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(16,185,129,0.14), transparent 65%)", filter: "blur(40px)" }}
      />
      <div
        className="absolute -bottom-1/4 -right-[10%] w-[55%] h-[70%] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(56,189,248,0.10), transparent 65%)", filter: "blur(40px)" }}
      />

      {/* Horizonte: grade em perspectiva subindo do rodapé */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: "-20%",
          right: "-20%",
          bottom: "-12%",
          height: "58%",
          transform: "perspective(600px) rotateX(58deg)",
          backgroundImage:
            "linear-gradient(rgba(56,189,248,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.08) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "linear-gradient(to top, black 20%, transparent 85%)",
          WebkitMaskImage: "linear-gradient(to top, black 20%, transparent 85%)",
        }}
      />

      {/* Conteúdo */}
      <div className="relative z-10 flex-1 flex flex-col px-14 py-12">
        {/* Topo: logo + eyebrow */}
        <div className="flex items-center justify-between animate-in fade-in duration-500 motion-reduce:animate-none" style={{ animationFillMode: "both" }}>
          <div className="flex items-center gap-4">
            <img src={turboLogo} alt="Turbo Partners" className="h-8 object-contain" />
            <div className="w-px h-6 bg-white/15" />
            <p className="text-[11px] text-zinc-400 uppercase tracking-[0.35em]">Reporte Trimestral</p>
          </div>
          {data.parcial && (
            <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1 uppercase tracking-widest">
              Em andamento
            </span>
          )}
        </div>

        {/* Centro: o numeral do trimestre */}
        <div className="flex-1 flex items-center">
          <div className="relative">
            {/* Ghost atrás (contorno) */}
            <span
              aria-hidden
              className="absolute font-black leading-none select-none"
              style={{
                fontSize: 290,
                left: 14,
                top: -8,
                color: "transparent",
                WebkitTextStroke: "1px rgba(52,211,153,0.14)",
                letterSpacing: "-0.04em",
              }}
            >
              Q{quarter}
            </span>
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 motion-reduce:animate-none" style={{ animationDelay: "100ms", animationFillMode: "both" }}>
              <h1
                className="font-black leading-none bg-gradient-to-br from-emerald-300 via-emerald-400 to-cyan-400 bg-clip-text text-transparent select-none"
                style={{ fontSize: 290, letterSpacing: "-0.04em" }}
              >
                Q{quarter}
              </h1>
            </div>
            <div
              className="flex items-baseline gap-4 mt-2 animate-in fade-in slide-in-from-bottom-3 duration-500 motion-reduce:animate-none"
              style={{ animationDelay: "350ms", animationFillMode: "both" }}
            >
              <p className="text-5xl font-black text-white tracking-tight">{anoStr}</p>
              <p className="text-lg text-zinc-400">{periodo}</p>
            </div>
          </div>
        </div>

        {/* Rodapé: as 3 headlines do trimestre */}
        <div className="flex gap-4">
          <HeadlineChip label="MRR — fim do tri" q={qoq.mrr} accent="#34d399" delayMs={450} />
          <HeadlineChip label="Vendas recorrentes" q={qoq.vendas} accent="#38bdf8" delayMs={550} />
          <HeadlineChip label="Churn no tri" q={qoq.churn} accent="#f87171" delayMs={650} />
        </div>
      </div>
    </div>
  );
}
