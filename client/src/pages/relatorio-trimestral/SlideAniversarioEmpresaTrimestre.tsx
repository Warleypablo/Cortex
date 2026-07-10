import { Award } from "lucide-react";
import SlideLayout from "../relatorio-mensal/SlideLayout";
import { SlideHeader } from "../relatorio-mensal/SlideComponents";
import type { AniversarioEmpresa } from "../relatorio-mensal/types";
import { entrance } from "./deck-kit";
import { PessoaAvatar } from "./pessoas-kit";

// Aniversário de empresa (seção people). A curadoria de quem aparece é feita no
// backend (ANIVERSARIO_EMPRESA_WHITELIST em reportsTrimestral.ts) — aqui só renderiza.

export default function SlideAniversarioEmpresaTrimestre({
  aniversarios,
  mesLabel,
}: {
  aniversarios: AniversarioEmpresa[];
  mesLabel: string;
}) {
  return (
    <SlideLayout section="people" padding="40px">
      <SlideHeader
        icon={Award}
        iconColor="text-amber-400"
        title={`Aniversários de Empresa — ${mesLabel}`}
        subtitle={`(${aniversarios.length})`}
        gradientColor="#f59e0b"
      />

      {aniversarios.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-500">Nenhum aniversário de empresa neste mês</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-wrap items-center justify-center gap-6 content-center">
          {aniversarios.map((c, i) => {
            const e = entrance(i * 90);
            return (
              <div
                key={c.id}
                className={`${e.className} flex flex-col items-center gap-3 bg-white/[0.04] rounded-2xl px-8 py-6 border border-white/[0.08] shadow-lg shadow-black/20 text-center`}
                style={e.style}
              >
                <PessoaAvatar nome={c.nome} fotoUrl={c.fotoUrl} px={72} />
                <div>
                  <p className="text-base font-semibold">{c.nome}</p>
                  <p className="text-xs text-zinc-400">{c.cargo}</p>
                </div>
                <div className="bg-white/[0.06] border border-amber-500/20 text-amber-400 rounded-full px-4 py-1 text-sm font-bold">
                  {c.anosDeEmpresa} {c.anosDeEmpresa === 1 ? "ano" : "anos"}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SlideLayout>
  );
}
