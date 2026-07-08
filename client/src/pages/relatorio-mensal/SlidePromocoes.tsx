import { useState } from "react";
import { Award } from "lucide-react";
import type { Promocao } from "./types";
import SlideLayout from "./SlideLayout";
import { SlideHeader } from "./SlideComponents";

interface Props {
  promocoes: Promocao[];
}

function iniciais(nome: string): string {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function Avatar({ nome, fotoUrl }: { nome: string; fotoUrl: string | null }) {
  const [erro, setErro] = useState(false);

  if (fotoUrl && !erro) {
    return (
      <img
        src={fotoUrl}
        alt={nome}
        className="w-16 h-16 rounded-full object-cover ring-2 ring-amber-400/20 shadow-lg shadow-amber-500/10"
        onError={() => setErro(true)}
      />
    );
  }
  return (
    <div className="w-16 h-16 rounded-full bg-white/[0.06] ring-2 ring-amber-400/20 shadow-lg shadow-amber-500/10 flex items-center justify-center text-base font-bold text-amber-200/70">
      {iniciais(nome)}
    </div>
  );
}

export default function SlidePromocoes({ promocoes }: Props) {
  return (
    <SlideLayout section="people" padding="40px">
      <SlideHeader
        icon={Award}
        iconColor="text-amber-400"
        title="Promoções do Trimestre"
        subtitle={`(${promocoes.length})`}
        gradientColor="#f59e0b"
      />

      {promocoes.length === 0 ? (
        <p className="text-zinc-500 text-sm">Nenhuma promoção neste trimestre</p>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-3 content-start">
          {promocoes.map((p, i) => (
            <div
              key={`${p.nome}-${i}`}
              className="flex flex-col items-center text-center gap-2 bg-white/[0.04] rounded-xl p-3 border border-white/[0.08] shadow-lg shadow-black/20"
            >
              <Avatar nome={p.nome} fotoUrl={p.fotoUrl} />
              <p className="text-xs font-semibold leading-tight text-zinc-100">{p.nome}</p>
            </div>
          ))}
        </div>
      )}
    </SlideLayout>
  );
}
