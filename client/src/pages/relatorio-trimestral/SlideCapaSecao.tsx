// Capa de seção do deck trimestral (Comercial / Operação / Tech).
// Irmã visual da capa Q2: void + aurora na cor da área + numeral fantasma da
// seção + título gigante em gradiente. Sem loops (transição rápida entre áreas).

export default function SlideCapaSecao({
  numero,
  titulo,
  subtitulo,
  accent,
  accentSoft,
  label,
}: {
  numero: string;      // "01"
  titulo: string;      // "Comercial"
  subtitulo: string;   // "Contratos fechados · Ranking closers"
  accent: string;      // cor da área (hex)
  accentSoft: string;  // rgba da aurora
  label: string;       // "Q2 2026"
}) {
  return (
    <div className="w-full h-full relative overflow-hidden flex flex-col" style={{ backgroundColor: "#05060f" }}>
      {/* Aurora na cor da área */}
      <div
        className="absolute -top-1/4 -right-[10%] w-[60%] h-[80%] rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${accentSoft}, transparent 65%)`, filter: "blur(45px)" }}
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
          backgroundImage: `linear-gradient(${accentSoft} 1px, transparent 1px), linear-gradient(90deg, ${accentSoft} 1px, transparent 1px)`,
          backgroundSize: "56px 56px",
          maskImage: "linear-gradient(to top, black 15%, transparent 80%)",
          WebkitMaskImage: "linear-gradient(to top, black 15%, transparent 80%)",
        }}
      />
      {/* Numeral fantasma da seção */}
      <span
        aria-hidden
        className="absolute font-black leading-none select-none pointer-events-none"
        style={{
          fontSize: 460,
          right: 40,
          bottom: -70,
          color: "transparent",
          WebkitTextStroke: `1px ${accentSoft}`,
          letterSpacing: "-0.05em",
        }}
      >
        {numero}
      </span>

      <div className="relative z-10 flex-1 flex flex-col px-14 py-12">
        {/* Eyebrow */}
        <div
          className="flex items-center gap-4 animate-in fade-in duration-500 motion-reduce:animate-none"
          style={{ animationFillMode: "both" }}
        >
          <span className="text-sm font-black tabular-nums" style={{ color: accent }}>{numero}</span>
          <div className="w-px h-5 bg-white/15" />
          <p className="text-[11px] text-zinc-400 uppercase tracking-[0.35em]">Reporte Trimestral · {label}</p>
        </div>

        {/* Título da área */}
        <div className="flex-1 flex flex-col justify-center">
          <div
            className="animate-in fade-in slide-in-from-bottom-6 duration-700 motion-reduce:animate-none"
            style={{ animationDelay: "100ms", animationFillMode: "both" }}
          >
            <h1
              className="font-black leading-none tracking-tight bg-clip-text text-transparent select-none"
              style={{
                fontSize: 120,
                backgroundImage: `linear-gradient(135deg, #ffffff 20%, ${accent} 90%)`,
              }}
            >
              {titulo}
            </h1>
          </div>
          <div
            className="flex items-center gap-3 mt-6 animate-in fade-in slide-in-from-bottom-3 duration-500 motion-reduce:animate-none"
            style={{ animationDelay: "350ms", animationFillMode: "both" }}
          >
            <div className="h-px w-12" style={{ background: `linear-gradient(to right, ${accent}, transparent)` }} />
            <p className="text-lg text-zinc-400">{subtitulo}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
