import { Award } from "lucide-react";
import type { AniversarioEmpresa } from "./types";
import SlideLayout from "./SlideLayout";
import { SlideHeader } from "./SlideComponents";

interface Props {
  aniversarios: AniversarioEmpresa[];
}

function Avatar({ nome, fotoUrl }: { nome: string; fotoUrl: string | null }) {
  const initials = nome.split(" ").filter(Boolean).slice(0, 2).map(n => n[0]).join("").toUpperCase();

  if (fotoUrl) {
    return (
      <img
        src={fotoUrl}
        alt={nome}
        className="w-16 h-16 rounded-full object-cover ring-2 ring-white/10 shadow-lg shadow-purple-500/10"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <div className="w-16 h-16 rounded-full bg-white/[0.06] ring-2 ring-white/10 shadow-lg shadow-purple-500/10 flex items-center justify-center text-base font-bold text-zinc-400">
      {initials}
    </div>
  );
}

// Colaboradores ocultos do slide (nome normalizado: lower + accents removidos + trim)
const COLABORADORES_OCULTOS = new Set([
  "thiago andrey da silva marinho",
  "fabiely laurett gums",
]);

const normalize = (s: string): string =>
  (s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

export default function SlideAniversarioEmpresa({ aniversarios }: Props) {
  const visiveis = aniversarios.filter((c) => !COLABORADORES_OCULTOS.has(normalize(c.nome)));

  return (
    <SlideLayout section="people" padding="40px">
      <SlideHeader
        icon={Award}
        iconColor="text-amber-400"
        title="Aniversarios de Empresa"
        subtitle={`(${visiveis.length})`}
        gradientColor="#f59e0b"
      />

      {visiveis.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-500">Nenhum aniversario de empresa neste mes</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 auto-rows-min">
          {visiveis.map((c) => (
            <div key={c.id} className="flex flex-col items-center gap-3 bg-white/[0.04] rounded-2xl p-5 border border-white/[0.08] shadow-lg shadow-black/20 text-center">
              <Avatar nome={c.nome} fotoUrl={c.fotoUrl} />
              <div>
                <p className="text-sm font-semibold">{c.nome}</p>
                <p className="text-xs text-zinc-400">{c.cargo}</p>
              </div>
              <div className="bg-white/[0.06] border border-amber-500/20 text-amber-400 rounded-full px-3 py-1 text-sm font-bold">
                {c.anosDeEmpresa} {c.anosDeEmpresa === 1 ? "ano" : "anos"}
              </div>
            </div>
          ))}
        </div>
      )}
    </SlideLayout>
  );
}
