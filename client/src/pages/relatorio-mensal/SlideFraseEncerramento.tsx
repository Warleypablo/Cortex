import fotoEncerramento from "@assets/placeholder.svg";
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
        {/* Stronger vignette for spotlight effect */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse at center bottom, transparent 30%, rgba(0,0,0,0.6) 100%)",
          }}
        />
        <div className="absolute bottom-0 left-0 right-0 p-10 text-center">
          <div className="px-10 py-8 rounded-2xl bg-black/40 backdrop-blur-sm border border-white/[0.08] max-w-3xl mx-auto">
            <p className="text-2xl leading-relaxed italic font-light">
              <span className="bg-gradient-to-r from-violet-300 via-indigo-200 to-cyan-300 bg-clip-text text-transparent">
                "Voce sonha grande, e inconformado e por isso melhora todos os dias,
                pensando como dono e fazendo o que tem que ser feito,
                voce tera o que merece!"
              </span>
            </p>
            <p className="text-base text-zinc-400 mt-5 font-medium">— Queiroz, Musso</p>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
