// Slide de tópico da seção Premiações (04) do deck trimestral.
// Não exibe premiados: anuncia a categoria enquanto os nomes são citados no palco.
// Irmão visual do SlideCapaSecao (void + aurora âmbar + título em gradiente), mas
// troca o numeral fantasma da seção por um troféu fantasma + contador de posição.
// Sem loops: o exportPdf fotografa cada slide, e animação contínua sai borrada.

const ACCENT = "#fbbf24";
const ACCENT_SOFT = "rgba(251,191,36,0.12)";

export default function SlidePremiacaoTrimestre({
  titulo,
  subtitulo,
  indice,
  total,
  label,
}: {
  titulo: string;      // "Colaborador Turbinado"
  subtitulo?: string;  // "Colaboradores" — ausente centraliza o título sozinho
  indice: number;      // 1-based
  total: number;       // 4
  label: string;       // "Q2 2026"
}) {
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="w-full h-full relative overflow-hidden flex flex-col" style={{ backgroundColor: "#05060f" }}>
      {/* Aurora âmbar */}
      <div
        className="absolute -top-1/4 -right-[10%] w-[60%] h-[80%] rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${ACCENT_SOFT}, transparent 65%)`, filter: "blur(45px)" }}
      />
      {/* Grade discreta no rodapé */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: "-20%",
          right: "-20%",
          bottom: "-12%",
          height: "45%",
          transform: "perspective(600px) rotateX(58deg)",
          backgroundImage: `linear-gradient(${ACCENT_SOFT} 1px, transparent 1px), linear-gradient(90deg, ${ACCENT_SOFT} 1px, transparent 1px)`,
          backgroundSize: "56px 56px",
          maskImage: "linear-gradient(to top, black 15%, transparent 80%)",
          WebkitMaskImage: "linear-gradient(to top, black 15%, transparent 80%)",
        }}
      />
      {/* Troféu fantasma, ecoando o numeral fantasma da capa de seção */}
      <svg
        aria-hidden
        className="absolute pointer-events-none select-none"
        style={{ right: 60, bottom: -40, width: 380, height: 380, opacity: 0.5 }}
        viewBox="0 0 24 24"
        fill="none"
        stroke={ACCENT_SOFT}
        strokeWidth="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </svg>

      <div className="relative z-10 flex-1 flex flex-col px-14 py-12">
        {/* Eyebrow: contador de posição + contexto */}
        <div
          className="flex items-center gap-4 animate-in fade-in duration-500 motion-reduce:animate-none"
          style={{ animationFillMode: "both" }}
        >
          <span className="text-sm font-black tabular-nums" style={{ color: ACCENT }}>
            {pad(indice)}
            <span className="text-zinc-600 font-bold"> / {pad(total)}</span>
          </span>
          <div className="w-px h-5 bg-white/15" />
          <p className="text-[11px] text-zinc-400 uppercase tracking-[0.35em]">Premiações · {label}</p>
        </div>

        {/* Categoria da premiação */}
        <div className="flex-1 flex flex-col justify-center">
          <div
            className="animate-in fade-in slide-in-from-bottom-6 duration-700 motion-reduce:animate-none"
            style={{ animationDelay: "100ms", animationFillMode: "both" }}
          >
            <h1
              className="font-black leading-[0.95] tracking-tight bg-clip-text text-transparent select-none max-w-[900px]"
              style={{
                fontSize: titulo.length > 16 ? 96 : 120,
                backgroundImage: `linear-gradient(135deg, #ffffff 20%, ${ACCENT} 90%)`,
              }}
            >
              {titulo}
            </h1>
          </div>
          {subtitulo && (
            <div
              className="flex items-center gap-3 mt-6 animate-in fade-in slide-in-from-bottom-3 duration-500 motion-reduce:animate-none"
              style={{ animationDelay: "350ms", animationFillMode: "both" }}
            >
              <div className="h-px w-12" style={{ background: `linear-gradient(to right, ${ACCENT}, transparent)` }} />
              <p className="text-3xl font-semibold text-zinc-300">{subtitulo}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
