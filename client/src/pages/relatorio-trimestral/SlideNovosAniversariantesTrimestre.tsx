import { UserPlus, Cake } from "lucide-react";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader } from "../relatorio-mensal/SlideComponents";
import type { NovoColaborador, Aniversariante } from "../relatorio-mensal/types";
import { entrance } from "./deck-kit";
import { PessoaAvatar } from "./pessoas-kit";

// Slide de abertura (seção people): quem entrou no último mês do trimestre + quem
// faz aniversário no mês da apresentação. Recriado com o DNA do deck trimestral
// (entrance em stagger), não reusa o componente do mensal.

function PessoaCard({ nome, sub, fotoUrl, delayMs }: { nome: string; sub: string; fotoUrl: string | null; delayMs: number }) {
  const e = entrance(delayMs);
  return (
    <div
      className={`${e.className} flex items-center gap-2.5 bg-white/[0.04] rounded-xl p-2 border border-white/[0.08] shadow-lg shadow-black/20`}
      style={e.style}
    >
      <PessoaAvatar nome={nome} fotoUrl={fotoUrl} px={42} />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold truncate leading-tight">{nome}</p>
        <p className="text-[11px] text-zinc-400 truncate">{sub}</p>
      </div>
    </div>
  );
}

export default function SlideNovosAniversariantesTrimestre({
  novos,
  aniversariantes,
  mesLabel,
}: {
  novos: NovoColaborador[];
  aniversariantes: Aniversariante[];
  mesLabel: string;
}) {
  return (
    <SlideLayout section="people" padding="24px 32px">
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
          <p className="text-zinc-500 text-sm">Nenhum novo colaborador no trimestre</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {novos.map((c, i) => (
              <PessoaCard key={c.id} nome={c.nome} sub={c.cargo} fotoUrl={c.fotoUrl} delayMs={i * 40} />
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-3" />

      {/* Aniversários do Mês */}
      <div className="flex-1 min-h-0">
        <SlideHeader
          icon={Cake}
          iconColor="text-pink-400"
          title={`Aniversários — ${mesLabel}`}
          subtitle={`(${aniversariantes.length})`}
          gradientColor="#ec4899"
        />
        {aniversariantes.length === 0 ? (
          <p className="text-zinc-500 text-sm">Nenhum aniversário neste mês</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-2.5">
            {aniversariantes.map((c, i) => (
              <PessoaCard key={c.id} nome={c.nome} sub={`Dia ${c.dia}`} fotoUrl={c.fotoUrl} delayMs={i * 40} />
            ))}
          </div>
        )}
      </div>
    </SlideLayout>
  );
}
