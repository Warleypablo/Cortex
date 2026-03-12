import turboLogo from "@assets/Logo-Turbo-branca_(1)_1766081013390.png";
import SlideLayout from "./SlideLayout";

interface Props {
  mesLabel: string;
}

export default function SlideCapa({ mesLabel }: Props) {
  return (
    <SlideLayout section="intro" showLogo={false} padding="48px">
      <div className="flex-1 flex flex-col items-center justify-center gap-8 max-w-3xl mx-auto text-center">
        <img src={turboLogo} alt="Turbo Partners" className="h-16 object-contain" />

        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight">
            <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">
              Reporte Mensal
            </span>
          </h1>
          <p className="text-xl text-zinc-400">{mesLabel}</p>
        </div>

        <div className="mt-4 px-8 py-6 rounded-2xl bg-white/[0.04] border border-white/[0.08] shadow-lg shadow-black/20">
          <p className="text-lg leading-relaxed text-zinc-300 italic">
            "Voce sonha grande, e inconformado e por isso melhora todos os dias,
            pensando como dono, fazendo o que tem que ser feito, voce tera o que merece"
          </p>
          <p className="text-sm text-zinc-500 mt-4">UZK</p>
        </div>
      </div>
    </SlideLayout>
  );
}
