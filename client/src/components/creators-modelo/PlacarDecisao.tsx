import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { Users, Banknote, Repeat } from "lucide-react";
import type { RedesignPayload } from "./types";

export function PlacarDecisao({ data }: { data: RedesignPayload }) {
  const { placar } = data;
  const pc = placar.porCliente, vol = placar.volume, be = placar.breakEven;
  const card = "bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50";
  const big = "text-2xl font-bold text-gray-900 dark:text-white";
  const sub = "text-xs text-gray-500 dark:text-zinc-400";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className={card}>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-gray-700 dark:text-zinc-200"><Users className="h-4 w-4 text-sky-500" /> Valor por cliente</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <div className={big}>Recorrente vale {placar.porCliente.razao}x</div>
          <p className={sub}>
            Recorrente {formatCurrencyNoDecimals(pc.recorrente)} vs Pontual {formatCurrencyNoDecimals(pc.pontual)} / cliente (blended).
            Entre ativos, recorrente {formatCurrencyNoDecimals(pc.recorrenteAtivo)} (ver maturidade abaixo).
          </p>
        </CardContent>
      </Card>
      <Card className={card}>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-gray-700 dark:text-zinc-200"><Banknote className="h-4 w-4 text-indigo-500" /> Volume / caixa</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <div className={big}>Pontual {formatCurrencyNoDecimals(vol.pontualReceita)}</div>
          <p className={sub}>
            {vol.pontualClientes} clientes pontuais · Recorrente {formatCurrencyNoDecimals(vol.recorrenteRealizado)} realizado
            + {formatCurrencyNoDecimals(vol.recorrenteMrrCorrente)}/mês de MRR vivo ({vol.recorrenteClientes} clientes).
          </p>
        </CardContent>
      </Card>
      <Card className={card}>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-gray-700 dark:text-zinc-200"><Repeat className="h-4 w-4 text-amber-500" /> Break-even de recompra</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <div className={big}>{be.minRecompras}–{be.maxRecompras}x</div>
          <p className={sub}>
            Um pontual precisaria recomprar {be.minRecompras}–{be.maxRecompras} vezes (ticket {formatCurrencyNoDecimals(be.ticketPontual)})
            para igualar 1 recorrente. Hoje só <span className="font-semibold text-amber-600 dark:text-amber-400">{be.recompraRealPct}%</span> recompram.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
