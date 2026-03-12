import turboLogo from "@assets/Logo-Turbo-branca_(1)_1766081013390.png";

export default function SlideFraseEncerramento() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-white p-12 relative overflow-hidden" style={{ background: "linear-gradient(145deg, #0d0b2e 0%, #1e1145 35%, #2a1a5e 55%, #1a0f3a 80%, #0d0b2e 100%)" }}>
      {/* Background glow effects */}
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-15" style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)" }} />
      <div className="absolute bottom-[-15%] left-[-5%] w-[400px] h-[400px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)" }} />

      <div className="relative z-10 flex flex-col items-center gap-8 max-w-3xl text-center">
        <img src={turboLogo} alt="Turbo Partners" className="h-14 object-contain" />

        <div className="px-10 py-8 rounded-2xl bg-zinc-900/60 border border-zinc-800">
          <p className="text-2xl leading-relaxed text-zinc-200 italic font-light">
            "Você sonha grande, é inconformado e por isso melhora todos os dias,
            pensando como dono e fazendo o que tem que ser feito,
            você terá o que merece!"
          </p>
          <p className="text-base text-zinc-400 mt-6 font-medium">— Queiroz, Musso</p>
        </div>
      </div>
    </div>
  );
}
