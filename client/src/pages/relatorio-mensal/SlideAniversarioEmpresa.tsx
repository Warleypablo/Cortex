import { Award } from "lucide-react";
import type { AniversarioEmpresa } from "./types";

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
        className="w-16 h-16 rounded-full object-cover border-2 border-zinc-700"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <div className="w-16 h-16 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center text-base font-bold text-zinc-400">
      {initials}
    </div>
  );
}

export default function SlideAniversarioEmpresa({ aniversarios }: Props) {
  return (
    <div className="w-full h-full flex flex-col bg-zinc-950 text-white p-10">
      <div className="flex items-center gap-3 mb-6">
        <Award className="h-7 w-7 text-amber-400" />
        <h2 className="text-2xl font-bold">Aniversários de Empresa</h2>
        <span className="text-sm text-zinc-500">({aniversarios.length})</span>
      </div>

      {aniversarios.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-500">Nenhum aniversário de empresa neste mês</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 auto-rows-min">
          {aniversarios.map((c) => (
            <div key={c.id} className="flex flex-col items-center gap-3 bg-zinc-900/60 rounded-2xl p-5 border border-zinc-800 text-center">
              <Avatar nome={c.nome} fotoUrl={c.fotoUrl} />
              <div>
                <p className="text-sm font-semibold">{c.nome}</p>
                <p className="text-xs text-zinc-400">{c.cargo}</p>
              </div>
              <div className="bg-amber-500/10 text-amber-400 rounded-full px-3 py-1 text-sm font-bold">
                {c.anosDeEmpresa} {c.anosDeEmpresa === 1 ? "ano" : "anos"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
