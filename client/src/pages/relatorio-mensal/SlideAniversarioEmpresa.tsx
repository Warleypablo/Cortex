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

export default function SlideAniversarioEmpresa({ aniversarios }: Props) {
  return (
    <div className="w-full h-full flex flex-col text-white p-10 relative overflow-hidden" style={{ background: "linear-gradient(145deg, #0d0b2e 0%, #1e1145 35%, #2a1a5e 55%, #1a0f3a 80%, #0d0b2e 100%)" }}>
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-15" style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)" }} />
      <div className="absolute bottom-[-15%] left-[-5%] w-[400px] h-[400px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)" }} />
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      <div className="relative z-10 flex flex-col flex-1">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-white/10 backdrop-blur p-2 rounded-lg">
            <Award className="h-5 w-5 text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Aniversários de Empresa</h2>
          <span className="text-sm text-zinc-500">({aniversarios.length})</span>
        </div>
        <div className="h-px bg-gradient-to-r from-amber-500/40 to-transparent" />
      </div>

      {aniversarios.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-500">Nenhum aniversário de empresa neste mês</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 auto-rows-min">
          {aniversarios.map((c) => (
            <div key={c.id} className="flex flex-col items-center gap-3 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-5 border border-white/[0.08] shadow-lg shadow-black/20 text-center">
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
      </div>
    </div>
  );
}
