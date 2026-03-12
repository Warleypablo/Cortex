import turboLogo from "@assets/Logo-Turbo-branca_(1)_1766081013390.png";

export default function SlideFraseEncerramento() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-white p-12 relative overflow-hidden" style={{ background: "linear-gradient(145deg, #0d0b2e 0%, #1e1145 35%, #2a1a5e 55%, #1a0f3a 80%, #0d0b2e 100%)" }}>
      {/* Background glow effects */}
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-15" style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)" }} />
      <div className="absolute bottom-[-15%] left-[-5%] w-[400px] h-[400px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)" }} />
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

      <div className="relative z-10 flex flex-col items-center gap-8 max-w-3xl text-center">
        <img src={turboLogo} alt="Turbo Partners" className="h-14 object-contain" />

        <div className="px-10 py-8 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] shadow-lg shadow-black/20">
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
