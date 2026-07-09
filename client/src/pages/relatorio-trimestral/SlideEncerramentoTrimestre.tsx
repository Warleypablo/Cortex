import turboLogo from "@assets/logo-branca.png";

// Slide de encerramento do deck trimestral: fecha o ritual aberto pelo SlideMantra.
// Mesmo universo visual (fundo void #05060f, aurora, logo em feixe de luz) —
// aqui a mesma frase-mantra retorna como despedida, com assinatura e rodapé do trimestre.
// Loop contínuo é intencional (slide ritual, não fotografado em sequência de dados).

interface Trecho {
  texto: string;
  destaque?: boolean;
}

// Mesmo mantra do SlideMantra (abertura) — ecoado no encerramento, com assinatura e "!" final
// (texto-base de client/src/pages/relatorio-mensal/SlideFraseEncerramento.tsx).
const LINHAS: Trecho[][] = [
  [{ texto: "Você " }, { texto: "sonha grande", destaque: true }, { texto: "," }],
  [{ texto: "é inconformado e por isso" }],
  [{ texto: "melhora " }, { texto: "todos os dias", destaque: true }, { texto: "," }],
  [{ texto: "pensando como " }, { texto: "dono", destaque: true }],
  [{ texto: "e fazendo o que tem que ser feito," }],
  [{ texto: "você terá " }, { texto: "o que merece", destaque: true }, { texto: "!" }],
];

export default function SlideEncerramentoTrimestre({ label }: { label: string }) {
  return (
    <div className="w-full h-full relative overflow-hidden flex flex-col" style={{ backgroundColor: "#05060f" }}>
      {/* Animações ambiente (contínuas) deste slide — nomes únicos p/ não colidir com SlideMantra */}
      <style>{`
        @keyframes encerramentoLogoScan {
          0%   { transform: translateX(-130%) skewX(-12deg); }
          70%  { transform: translateX(360%) skewX(-12deg); }
          100% { transform: translateX(360%) skewX(-12deg); }
        }
        @keyframes encerramentoAuroraPulse {
          0%, 100% { opacity: 0.7; transform: translate(-50%, -50%) scale(1); }
          50%      { opacity: 1;   transform: translate(-50%, -50%) scale(1.12); }
        }
        @media (prefers-reduced-motion: reduce) {
          .encerramento-scan-beam { animation: none !important; opacity: 0 !important; }
          .encerramento-aurora    { animation: none !important; }
        }
      `}</style>

      {/* Aurora central com respiração lenta */}
      <div
        className="encerramento-aurora absolute top-1/2 left-1/2 w-[70%] h-[80%] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(16,185,129,0.09), transparent 60%)",
          filter: "blur(50px)",
          transform: "translate(-50%, -50%)",
          animation: "encerramentoAuroraPulse 9s ease-in-out infinite",
        }}
      />

      {/* Logo Turbo em destaque central, riscada continuamente por um feixe de luz (máscara via PNG) */}
      <div aria-hidden className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="relative overflow-hidden"
          style={{
            width: "64%",
            height: "50%",
            WebkitMaskImage: `url(${turboLogo})`,
            maskImage: `url(${turboLogo})`,
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskSize: "contain",
            maskSize: "contain",
            WebkitMaskPosition: "center",
            maskPosition: "center",
          }}
        >
          {/* Silhueta base, quase imperceptível */}
          <div className="absolute inset-0" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
          {/* Feixe gradiente que varre a logo em loop */}
          <div
            className="encerramento-scan-beam absolute top-0 bottom-0 left-0"
            style={{
              width: "42%",
              background:
                "linear-gradient(100deg, transparent, rgba(52,211,153,0.6) 40%, rgba(56,189,248,0.6) 60%, transparent)",
              filter: "blur(5px)",
              animation: "encerramentoLogoScan 4.6s ease-in-out infinite",
            }}
          />
        </div>
      </div>

      {/* Aspas fantasma de fechamento, no canto oposto ao da abertura */}
      <span
        aria-hidden
        className="absolute font-black select-none pointer-events-none leading-none"
        style={{ fontSize: 420, bottom: -150, right: 24, color: "transparent", WebkitTextStroke: "1px rgba(255,255,255,0.05)" }}
      >
        ”
      </span>

      <div className="relative z-10 flex-1 flex flex-col px-16 py-12">
        {/* Topo: logo + eyebrow */}
        <div
          className="flex items-center gap-4 animate-in fade-in duration-500 motion-reduce:animate-none"
          style={{ animationFillMode: "both" }}
        >
          <img src={turboLogo} alt="Turbo Partners" className="h-7 object-contain" />
          <div className="w-px h-5 bg-white/15" />
          <p className="text-[11px] text-zinc-500 uppercase tracking-[0.35em]">Encerramento</p>
        </div>

        {/* Frase final: linhas em cascata, ecoando o mantra da abertura */}
        <div className="flex-1 flex flex-col justify-center gap-1.5">
          {LINHAS.map((linha, i) => (
            <p
              key={i}
              className="text-[40px] leading-[1.25] font-bold tracking-tight animate-in fade-in slide-in-from-bottom-4 duration-500 motion-reduce:animate-none"
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
          <p
            className="text-sm text-zinc-500 mt-5 animate-in fade-in slide-in-from-bottom-2 duration-500 motion-reduce:animate-none"
            style={{ animationDelay: "820ms", animationFillMode: "both" }}
          >
            — Queiroz, Musso
          </p>
        </div>

        {/* Rodapé discreto: trimestre + traço gradiente */}
        <div
          className="flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500 motion-reduce:animate-none"
          style={{ animationDelay: "950ms", animationFillMode: "both" }}
        >
          <div className="h-px w-10 bg-gradient-to-r from-emerald-400 to-cyan-400" />
          <p className="text-xs font-medium text-zinc-500 tracking-[0.2em] uppercase">
            {label} · Turbo Partners
          </p>
        </div>
      </div>
    </div>
  );
}
