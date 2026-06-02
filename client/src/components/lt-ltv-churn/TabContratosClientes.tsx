import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import type { ContratoRow, ClienteRow } from "./types";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erro ao buscar ${url}`);
  return res.json();
}

function buildUrl(base: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") search.set(k, v);
  });
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}

export function TabContratosClientes({ produto }: { produto?: string }) {
  const { data: contratos } = useQuery({
    queryKey: ["/api/lt-ltv-churn/contratos", produto],
    queryFn: () =>
      fetchJson<{ contratos: ContratoRow[]; total: number }>(
        buildUrl("/api/lt-ltv-churn/contratos", { page: "1", produto })
      ),
  });

  const { data: clientes } = useQuery({
    queryKey: ["/api/lt-ltv-churn/clientes", produto],
    queryFn: () =>
      fetchJson<{ clientes: ClienteRow[]; total: number }>(
        buildUrl("/api/lt-ltv-churn/clientes", { page: "1", produto })
      ),
  });

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardContent className="p-4">
        <Tabs defaultValue="contratos">
          <TabsList>
            <TabsTrigger value="contratos">
              Por contrato ({contratos?.total ?? 0})
            </TabsTrigger>
            <TabsTrigger value="clientes">
              Por cliente ({clientes?.total ?? 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contratos">
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
                  {contratos?.contratos.map((c) => (
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
                      <TableCell className="text-right">{c.ltMeses ?? "—"}</TableCell>
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
          </TabsContent>

          <TabsContent value="clientes">
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
                  {clientes?.clientes.map((c) => (
                    <TableRow key={c.idTask}>
                      <TableCell className="font-medium">{c.nomeCliente ?? "—"}</TableCell>
                      <TableCell className="text-right">{c.nContratosRec}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{c.ativo ? "Ativo" : "Cancelado"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{c.ltMeses}</TableCell>
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
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
