import { Sparkles } from "lucide-react";
import SlideLayout from "./SlideLayout";
import { SlideHeader } from "./SlideComponents";

// Princípios da Turbo, revelados um por slide (reveal acumulativo).
const TOPICOS = [
  "O óbvio não existe",
  "As coisas dão errado",
  "Tudo tem que ter um dono",
  "Zele pelo seu nome",
  "Tudo se resume a gente",
  "Pense grande",
];

const ACCENT = "#a78bfa"; // tema "closing"

interface Props {
  revealCount: number; // 1..6 — quantos tópicos estão revelados; o último é o destaque
}

export default function SlideTopicosFinais({ revealCount }: Props) {
  return (
    <SlideLayout section="closing" padding="44px 64px">
      <SlideHeader
        icon={Sparkles}
        iconColor="text-violet-300"
        title="Tópicos Finais"
        gradientColor="#a78bfa"
      />

      <div className="flex-1 flex flex-col justify-center gap-5 w-full max-w-4xl mx-auto">
        {TOPICOS.map((topico, i) => {
          const n = i + 1;
          const isCurrent = n === revealCount;
          const isHidden = n > revealCount;
          return (
            <div
              key={topico}
              className="flex items-center gap-6 transition-all duration-500 ease-out"
              style={{ opacity: isHidden ? 0.16 : isCurrent ? 1 : 0.4 }}
            >
              {/* Barra lateral — só no tópico atual */}
              <div
                className="w-1.5 self-stretch rounded-full transition-all duration-500"
                style={{
                  background: isCurrent ? ACCENT : "transparent",
                  boxShadow: isCurrent ? `0 0 16px ${ACCENT}aa` : "none",
                }}
              />

              {/* Número 01–06 */}
              <span
                className="font-black tabular-nums shrink-0 transition-all duration-500"
                style={{
                  fontSize: isCurrent ? 46 : 30,
                  lineHeight: 1,
                  color: isCurrent ? ACCENT : "#52525b",
                  width: 76,
                }}
              >
                {String(n).padStart(2, "0")}
              </span>

              {/* Texto do tópico ou placeholder (ainda oculto) */}
              {isHidden ? (
                <span className="text-2xl text-zinc-700 tracking-[0.3em] select-none">
                  ——————
                </span>
              ) : (
                <span
                  className="font-bold transition-all duration-500"
                  style={{
                    fontSize: isCurrent ? 42 : 26,
                    lineHeight: 1.1,
                    color: isCurrent ? "#ffffff" : "#a1a1aa",
                  }}
                >
                  {topico}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </SlideLayout>
  );
}
