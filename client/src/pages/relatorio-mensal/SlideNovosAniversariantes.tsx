import { UserPlus, Cake } from "lucide-react";
import type { NovoColaborador, Aniversariante } from "./types";

interface Props {
  novos: NovoColaborador[];
  aniversariantes: Aniversariante[];
  mesLabel: string;
}

function Avatar({ nome, fotoUrl }: { nome: string; fotoUrl: string | null }) {
  const initials = nome.split(" ").filter(Boolean).slice(0, 2).map(n => n[0]).join("").toUpperCase();

  if (fotoUrl) {
    return (
      <img
        src={fotoUrl}
        alt={nome}
        className="w-14 h-14 rounded-full object-cover border-2 border-zinc-700"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <div className="w-14 h-14 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center text-sm font-bold text-zinc-400">
      {initials}
    </div>
  );
}

export default function SlideNovosAniversariantes({ novos, aniversariantes, mesLabel }: Props) {
  return (
    <div className="w-full h-full flex flex-col bg-zinc-950 text-white p-10 overflow-hidden">
      {/* Novos Colaboradores */}
      <div className="flex-1 min-h-0">
        <div className="flex items-center gap-3 mb-4">
          <UserPlus className="h-6 w-6 text-emerald-400" />
          <h2 className="text-xl font-bold">Novos Colaboradores</h2>
          <span className="text-sm text-zinc-500">({novos.length})</span>
        </div>

        {novos.length === 0 ? (
          <p className="text-zinc-500 text-sm">Nenhum novo colaborador no mês anterior</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {novos.map((c) => (
              <div key={c.id} className="flex items-center gap-3 bg-zinc-900/60 rounded-xl p-3 border border-zinc-800">
                <Avatar nome={c.nome} fotoUrl={c.fotoUrl} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{c.nome}</p>
                  <p className="text-xs text-zinc-400 truncate">{c.cargo}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-800 my-4" />

      {/* Aniversariantes */}
      <div className="flex-1 min-h-0">
        <div className="flex items-center gap-3 mb-4">
          <Cake className="h-6 w-6 text-pink-400" />
          <h2 className="text-xl font-bold">Aniversários do Mês</h2>
          <span className="text-sm text-zinc-500">({aniversariantes.length})</span>
        </div>

        {aniversariantes.length === 0 ? (
          <p className="text-zinc-500 text-sm">Nenhum aniversário neste mês</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {aniversariantes.map((c) => (
              <div key={c.id} className="flex items-center gap-3 bg-zinc-900/60 rounded-xl p-3 border border-zinc-800">
                <Avatar nome={c.nome} fotoUrl={c.fotoUrl} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{c.nome}</p>
                  <p className="text-xs text-zinc-400">Dia {c.dia}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
