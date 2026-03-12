import { UserPlus, Cake } from "lucide-react";
import type { NovoColaborador, Aniversariante } from "./types";
import SlideLayout from "./SlideLayout";
import { SlideHeader } from "./SlideComponents";

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
    <SlideLayout section="people" padding="40px">
      {/* Novos Colaboradores */}
      <div className="flex-1 min-h-0">
        <SlideHeader
          icon={UserPlus}
          iconColor="text-emerald-400"
          title="Novos Colaboradores"
          subtitle={`(${novos.length})`}
          gradientColor="#10b981"
        />

        {novos.length === 0 ? (
          <p className="text-zinc-500 text-sm">Nenhum novo colaborador no mes anterior</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {novos.map((c) => (
              <div key={c.id} className="flex items-center gap-3 bg-white/[0.04] rounded-xl p-3 border border-white/[0.08] shadow-lg shadow-black/20">
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
        <SlideHeader
          icon={Cake}
          iconColor="text-pink-400"
          title="Aniversarios do Mes"
          subtitle={`(${aniversariantes.length})`}
          gradientColor="#ec4899"
        />

        {aniversariantes.length === 0 ? (
          <p className="text-zinc-500 text-sm">Nenhum aniversario neste mes</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {aniversariantes.map((c) => (
              <div key={c.id} className="flex items-center gap-3 bg-white/[0.04] rounded-xl p-3 border border-white/[0.08] shadow-lg shadow-black/20">
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
    </SlideLayout>
  );
}
