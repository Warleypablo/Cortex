import fotoEncerramento from "@assets/IMG_1925 1.png";
import SlideLayout from "./SlideLayout";

export default function SlideFraseEncerramento() {
  return (
    <SlideLayout section="closing" showLogo={false} padding="0">
      <div className="flex-1 relative">
        <img
          src={fotoEncerramento}
          alt="Turbo Partners"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-10 text-center">
          <div className="px-8 py-6 rounded-2xl bg-black/40 backdrop-blur-sm border border-white/[0.08] max-w-3xl mx-auto">
            <p className="text-xl leading-relaxed italic font-light">
              <span className="bg-gradient-to-r from-violet-300 via-indigo-200 to-cyan-300 bg-clip-text text-transparent">
                "Voce sonha grande, e inconformado e por isso melhora todos os dias,
                pensando como dono e fazendo o que tem que ser feito,
                voce tera o que merece!"
              </span>
            </p>
            <p className="text-sm text-zinc-400 mt-4 font-medium">— Queiroz, Musso</p>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
