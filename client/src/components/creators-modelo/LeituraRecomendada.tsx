// client/src/components/creators-modelo/LeituraRecomendada.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { RedesignPayload } from "./types";

export function LeituraRecomendada({ data }: { data: RedesignPayload }) {
  const be = data.placar.breakEven;
  const linhas = [
    `Pontual ganha em caixa/volume: ${formatCurrencyNoDecimals(data.placar.volume.pontualReceita)} de ${data.placar.volume.pontualClientes} clientes — mas só se houver fluxo contínuo de clientes novos a CAC baixo.`,
    `Recorrente ganha em valor por cliente (${data.placar.porCliente.razao}x) e em ativo que compõe (${formatCurrencyNoDecimals(data.placar.volume.recorrenteMrrCorrente)}/mês de MRR vivo).`,
    `Risco do pivot: trocar MRR que compõe por caixa de uma vez. Um pontual precisaria recomprar ${be.minRecompras}–${be.maxRecompras}x para igualar 1 recorrente, e hoje só ${be.recompraRealPct}% recompram.`,
  ];
  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Lightbulb className="h-4 w-4 text-yellow-500" /> Leitura recomendada</CardTitle></CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm text-gray-700 dark:text-zinc-300">
          {linhas.map((l, i) => <li key={i} className="flex gap-2"><span className="text-gray-400 dark:text-zinc-500">•</span><span>{l}</span></li>)}
        </ul>
      </CardContent>
    </Card>
  );
}
