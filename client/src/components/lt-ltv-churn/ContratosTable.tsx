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
import type { ContratoRow } from "./types";

export function ContratosTable({ produto }: { produto?: string }) {
  const { data: contratos } = useQuery({
    queryKey: ["/api/lt-ltv-churn/contratos", produto],
    queryFn: () =>
      fetchJson<{ contratos: ContratoRow[]; total: number }>(
        buildUrl("/api/lt-ltv-churn/contratos", { page: "1", produto })
      ),
  });

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
          Contratos ({contratos?.total ?? 0})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {!contratos ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">Carregando…</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">MRR</TableHead>
                  <TableHead className="text-right">LT (m)</TableHead>
                  <TableHead className="text-right">LTV</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratos.contratos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">
                      Nenhum contrato encontrado
                    </TableCell>
                  </TableRow>
                )}
                {contratos.contratos.map((c) => (
                  <TableRow key={c.idSubtask}>
                    <TableCell className="font-medium">{c.nomeCliente ?? "—"}</TableCell>
                    <TableCell>{c.produto ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{c.status}</Badge>
                      {c.dataInconsistente && (
                        <Badge variant="destructive" className="ml-1">
                          data?
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrencyNoDecimals(c.valorr)}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.ltMeses != null ? Number(c.ltMeses).toFixed(1) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.ltvRecorrente != null
                        ? formatCurrencyNoDecimals(c.ltvRecorrente)
                        : "—"}
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
