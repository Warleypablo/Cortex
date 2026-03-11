import turboLogo from "@assets/Logo-Turbo-branca_(1)_1766081013390.png";

export default function SlideFraseEncerramento() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 text-white p-12 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-blue-500 to-purple-600" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600" />
      </div>

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
