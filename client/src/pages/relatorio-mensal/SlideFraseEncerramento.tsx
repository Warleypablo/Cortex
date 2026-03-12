import turboLogo from "@assets/Logo-Turbo-branca_(1)_1766081013390.png";
import SlideLayout from "./SlideLayout";

export default function SlideFraseEncerramento() {
  return (
    <SlideLayout section="closing" showLogo={false} padding="48px">
      <div className="flex-1 flex flex-col items-center justify-center gap-8 max-w-3xl mx-auto text-center">
        <img src={turboLogo} alt="Turbo Partners" className="h-14 object-contain" />

        <div className="px-10 py-8 rounded-2xl bg-white/[0.04] border border-white/[0.08] shadow-lg shadow-black/20">
          <p className="text-2xl leading-relaxed italic font-light">
            <span className="bg-gradient-to-r from-violet-300 via-indigo-200 to-cyan-300 bg-clip-text text-transparent">
              "Voce sonha grande, e inconformado e por isso melhora todos os dias,
              pensando como dono e fazendo o que tem que ser feito,
              voce tera o que merece!"
            </span>
          </p>
          <p className="text-base text-zinc-400 mt-6 font-medium">— Queiroz, Musso</p>
        </div>
      </div>
    </SlideLayout>
  );
}
