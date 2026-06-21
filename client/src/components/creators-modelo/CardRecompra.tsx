// client/src/components/creators-modelo/CardRecompra.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Repeat } from "lucide-react";
import type { Recompra } from "./types";

export function CardRecompra({ recompra }: { recompra: Recompra }) {
  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Repeat className="h-4 w-4 text-indigo-500" /> Recompra (avulsos)
        </CardTitle>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Clientes pontuais de compra única (sem sequência de entregas)
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
          {recompra.pctRecompra}%
        </div>
        <p className="text-sm text-gray-600 dark:text-zinc-300">
          {recompra.comRecompra} de {recompra.totalAvulsos} clientes avulsos compraram 2+ vezes.
        </p>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Para os avulsos, "recompra" é o sinal de retenção — não há funil de 4 entregas.
        </p>
      </CardContent>
    </Card>
  );
}
