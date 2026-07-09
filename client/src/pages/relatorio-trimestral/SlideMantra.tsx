import turboLogo from "@assets/logo-branca.png";

// Slide de abertura: o mantra da Turbo em tipografia cinética.
// Linhas revelam em cascata; palavras-chave acesas em gradiente.

interface Trecho {
  texto: string;
  destaque?: boolean;
}

// Cada linha do mantra, com os trechos que acendem em gradiente
const LINHAS: Trecho[][] = [
  [{ texto: "Você " }, { texto: "sonha grande", destaque: true }, { texto: "," }],
  [{ texto: "é inconformado e por isso" }],
  [{ texto: "melhora " }, { texto: "todos os dias", destaque: true }, { texto: "," }],
  [{ texto: "pensando como " }, { texto: "dono", destaque: true }],
  [{ texto: "e fazendo o que tem que ser feito," }],
  [{ texto: "você terá " }, { texto: "o que merece", destaque: true }, { texto: "." }],
];

export default function SlideMantra() {
  return (
    <div className="w-full h-full relative overflow-hidden flex flex-col" style={{ backgroundColor: "#05060f" }}>
      {/* Aurora central discreta */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[80%] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(16,185,129,0.09), transparent 60%)", filter: "blur(50px)" }}
      />
      {/* Aspas fantasma de fundo */}
      <span
        aria-hidden
        className="absolute font-black select-none pointer-events-none leading-none"
        style={{ fontSize: 420, top: -90, left: 24, color: "transparent", WebkitTextStroke: "1px rgba(255,255,255,0.05)" }}
      >
        “
      </span>

      <div className="relative z-10 flex-1 flex flex-col px-16 py-12">
        {/* Topo: logo + eyebrow */}
        <div
          className="flex items-center gap-4 animate-in fade-in duration-500 motion-reduce:animate-none"
          style={{ animationFillMode: "both" }}
        >
          <img src={turboLogo} alt="Turbo Partners" className="h-7 object-contain" />
          <div className="w-px h-5 bg-white/15" />
          <p className="text-[11px] text-zinc-500 uppercase tracking-[0.35em]">O Mantra</p>
        </div>

        {/* Mantra: linhas em cascata */}
        <div className="flex-1 flex flex-col justify-center gap-1.5">
          {LINHAS.map((linha, i) => (
            <p
              key={i}
              className="text-[42px] leading-[1.25] font-bold tracking-tight animate-in fade-in slide-in-from-bottom-4 duration-500 motion-reduce:animate-none"
              style={{ animationDelay: `${150 + i * 110}ms`, animationFillMode: "both" }}
            >
              {linha.map((t, j) =>
                t.destaque ? (
                  <span key={j} className="bg-gradient-to-r from-emerald-300 to-cyan-400 bg-clip-text text-transparent font-black">
                    {t.texto}
                  </span>
                ) : (
                  <span key={j} className="text-zinc-200">{t.texto}</span>
                ),
              )}
            </p>
          ))}
        </div>

        {/* Assinatura */}
        <div
          className="flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500 motion-reduce:animate-none"
          style={{ animationDelay: "900ms", animationFillMode: "both" }}
        >
          <div className="h-px w-10 bg-gradient-to-r from-emerald-400 to-cyan-400" />
          <p className="text-sm font-bold text-zinc-400 tracking-[0.25em] uppercase">UZK</p>
        </div>
      </div>
    </div>
  );
}
