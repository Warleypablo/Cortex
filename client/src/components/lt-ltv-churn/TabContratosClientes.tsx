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
import type { ContratoRow, ClienteRow } from "./types";

interface Props {
  produto?: string;
  granularidade: "contrato" | "cliente";
  situacao: "todos" | "ativo" | "cancelado";
}

export function TabContratosClientes({ produto, granularidade, situacao }: Props) {
  const status = situacao === "todos" ? undefined : situacao;

  const { data: contratos } = useQuery({
    queryKey: ["/api/lt-ltv-churn/contratos", produto, status],
    queryFn: () =>
      fetchJson<{ contratos: ContratoRow[]; total: number }>(
        buildUrl("/api/lt-ltv-churn/contratos", { page: "1", produto, status })
      ),
    enabled: granularidade === "contrato",
  });

  const { data: clientes } = useQuery({
    queryKey: ["/api/lt-ltv-churn/clientes", produto, status],
    queryFn: () =>
      fetchJson<{ clientes: ClienteRow[]; total: number }>(
        buildUrl("/api/lt-ltv-churn/clientes", { page: "1", produto, status })
      ),
    enabled: granularidade === "cliente",
  });

  const total =
    granularidade === "contrato" ? contratos?.total ?? 0 : clientes?.total ?? 0;
  const titulo = granularidade === "contrato" ? "Contratos" : "Clientes";

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <CardTitle className="text-base">
          {titulo} ({total})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {granularidade === "contrato" ? (
          !contratos ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">
              Carregando…
            </p>
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
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400"
                      >
                        Nenhum contrato encontrado
                      </TableCell>
                    </TableRow>
                  )}
                  {contratos.contratos.map((c) => (
                    <TableRow key={c.idSubtask}>
                      <TableCell className="font-medium">
                        {c.nomeCliente ?? "—"}
                      </TableCell>
                      <TableCell>{c.produto ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{c.status}</Badge>
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
          )
        ) : !clientes ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">
            Carregando…
          </p>
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
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400"
                    >
                      Nenhum cliente encontrado
                    </TableCell>
                  </TableRow>
                )}
                {clientes.clientes.map((c) => (
                  <TableRow key={c.idTask}>
                    <TableCell className="font-medium">
                      {c.nomeCliente ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">{c.nContratosRec}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {c.ativo ? "Ativo" : "Cancelado"}
                      </Badge>
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
