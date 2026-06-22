// client/src/components/creators-modelo/AvisosMetodologicos.tsx
import { AlertTriangle } from "lucide-react";
import type { CreatorsModeloPayload } from "./types";

export function AvisosMetodologicos({
  meta, coorte,
}: {
  meta: CreatorsModeloPayload["meta"];
  coorte: CreatorsModeloPayload["coorte"];
}) {
  const avisos: string[] = [];
  if (coorte.avisoMaturidade) {
    avisos.push(
      `Maturidade desigual: recorrente tem ${coorte.recorrenteIdadeMedia} meses de idade média vs ${coorte.pontualIdadeMedia} do pontual. Use o filtro de período para comparar coortes parecidas — o LTV pontual ainda está em formação.`,
    );
  }
  avisos.push(
    `Funil de 4 entregas cobre só ${meta.pctSequenciados}% dos clientes pontuais (${meta.nSequenciados} sequenciados); os outros ${meta.nAvulsos} são compra única (ver card de recompra).`,
  );
  avisos.push(
    "LT do pontual = tempo entre a 1ª e a última entrega (só entregue/ativo/pausado; exclui triagem/onboarding/cancelado). Fica ~0 para quem teve uma única entrega (a maioria) — leia junto com nº de entregas.",
  );

  return (
    <div className="space-y-2">
      {avisos.map((a, i) => (
        <div
          key={i}
          className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{a}</span>
        </div>
      ))}
    </div>
  );
}
