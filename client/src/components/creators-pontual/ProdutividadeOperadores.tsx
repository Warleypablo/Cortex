import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { fetchJson } from "./utils";
import type { OperadorRow } from "./types";

export function ProdutividadeOperadores() {
  const { data } = useQuery({
    queryKey: ["/api/creators-pontual/operadores"],
    queryFn: () => fetchJson<{ operadores: OperadorRow[] }>("/api/creators-pontual/operadores"),
  });

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Produtividade por operador</CardTitle>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Carga em aberto, entregas (throughput) e tempo de ciclo — sem horas trabalhadas (não há time tracking)
        </p>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {!data ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">Carregando…</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operador</TableHead>
                  <TableHead className="text-right">Aberto</TableHead>
                  <TableHead className="text-right">Valor aberto</TableHead>
                  <TableHead className="text-right">Entregue</TableHead>
                  <TableHead className="text-right">Ciclo (d)</TableHead>
                  <TableHead className="text-right">Idade backlog (d)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.operadores.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">
                      Sem operadores
                    </TableCell>
                  </TableRow>
                )}
                {data.operadores.map((o) => (
                  <TableRow key={o.operador}>
                    <TableCell className="font-medium">{o.operador}</TableCell>
                    <TableCell className="text-right">{o.aberto}</TableCell>
                    <TableCell className="text-right">{formatCurrencyNoDecimals(o.valAberto)}</TableCell>
                    <TableCell className="text-right">{o.entregue}</TableCell>
                    <TableCell className="text-right">{o.cicloMedioDias ?? "—"}</TableCell>
                    <TableCell className="text-right">{o.idadeBacklogDias ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
