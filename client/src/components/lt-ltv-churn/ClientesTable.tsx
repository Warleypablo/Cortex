import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { fetchJson, buildUrl } from "./utils";
import type { ClienteRow } from "./types";

export function ClientesTable({ produto, status }: { produto?: string; status?: string }) {
  const { data: clientes } = useQuery({
    queryKey: ["/api/lt-ltv-churn/clientes", produto, status],
    queryFn: () =>
      fetchJson<{ clientes: ClienteRow[]; total: number }>(
        buildUrl("/api/lt-ltv-churn/clientes", { page: "1", produto, status })
      ),
  });

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
          Clientes ({clientes?.total ?? 0})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {!clientes ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">Carregando…</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Contratos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">LT (m)</TableHead>
                  <TableHead className="text-right">LTV recorr.</TableHead>
                  <TableHead className="text-right">LTV pontual</TableHead>
                  <TableHead className="text-right">LTV total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.clientes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">
                      Nenhum cliente encontrado
                    </TableCell>
                  </TableRow>
                )}
                {clientes.clientes.map((c) => (
                  <TableRow key={c.idTask}>
                    <TableCell className="font-medium">{c.nomeCliente ?? "—"}</TableCell>
                    <TableCell className="text-right">{c.nContratosRec}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{c.ativo ? "Ativo" : "Cancelado"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {c.ltMeses != null ? c.ltMeses : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrencyNoDecimals(c.ltvRecorrente)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrencyNoDecimals(c.ltvPontual)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrencyNoDecimals(c.ltvTotal)}
                    </TableCell>
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
