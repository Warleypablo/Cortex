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
        className="w-14 h-14 rounded-full object-cover ring-2 ring-white/10 shadow-lg shadow-purple-500/10"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <div className="w-14 h-14 rounded-full bg-white/[0.06] ring-2 ring-white/10 shadow-lg shadow-purple-500/10 flex items-center justify-center text-sm font-bold text-zinc-400">
      {initials}
    </div>
  );
}

export default function SlideNovosAniversariantes({ novos, aniversariantes, mesLabel }: Props) {
  return (
    <div className="w-full h-full flex flex-col text-white p-10 relative overflow-hidden" style={{ background: "linear-gradient(145deg, #0d0b2e 0%, #1e1145 35%, #2a1a5e 55%, #1a0f3a 80%, #0d0b2e 100%)" }}>
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-15" style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)" }} />
      <div className="absolute bottom-[-15%] left-[-5%] w-[400px] h-[400px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)" }} />
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      <div className="relative z-10 flex-1 flex flex-col">
      {/* Novos Colaboradores */}
      <div className="flex-1 min-h-0">
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-white/10 backdrop-blur p-2 rounded-lg">
              <UserPlus className="h-5 w-5 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Novos Colaboradores</h2>
            <span className="text-sm text-zinc-500">({novos.length})</span>
          </div>
          <div className="h-px bg-gradient-to-r from-emerald-500/40 to-transparent" />
        </div>

        {novos.length === 0 ? (
          <p className="text-zinc-500 text-sm">Nenhum novo colaborador no mês anterior</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {novos.map((c) => (
              <div key={c.id} className="flex items-center gap-3 bg-white/[0.04] backdrop-blur-xl rounded-xl p-3 border border-white/[0.08] shadow-lg shadow-black/20">
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
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-4" />

      {/* Aniversariantes */}
      <div className="flex-1 min-h-0">
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-white/10 backdrop-blur p-2 rounded-lg">
              <Cake className="h-5 w-5 text-pink-400" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Aniversários do Mês</h2>
            <span className="text-sm text-zinc-500">({aniversariantes.length})</span>
          </div>
          <div className="h-px bg-gradient-to-r from-pink-500/40 to-transparent" />
        </div>

        {aniversariantes.length === 0 ? (
          <p className="text-zinc-500 text-sm">Nenhum aniversário neste mês</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {aniversariantes.map((c) => (
              <div key={c.id} className="flex items-center gap-3 bg-white/[0.04] backdrop-blur-xl rounded-xl p-3 border border-white/[0.08] shadow-lg shadow-black/20">
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
    </div>
  );
}
