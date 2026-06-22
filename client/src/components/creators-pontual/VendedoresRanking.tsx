import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { fetchJson } from "./utils";
import type { VendedorRow } from "./types";

interface VendedoresData {
  vendedores: VendedorRow[];
  semVendedor: { qtd: number; valor: number };
}

export function VendedoresRanking() {
  const { data } = useQuery({
    queryKey: ["/api/creators-pontual/vendedores"],
    queryFn: () => fetchJson<VendedoresData>("/api/creators-pontual/vendedores"),
  });

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Ranking de vendedores</CardTitle>
        {data && (
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            {data.semVendedor.qtd} vendas sem vendedor preenchido ({formatCurrencyNoDecimals(data.semVendedor.valor)})
          </p>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {!data ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">Carregando…</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.vendedores.map((v) => (
                  <TableRow key={v.vendedor}>
                    <TableCell className="font-medium">{v.vendedor}</TableCell>
                    <TableCell className="text-right">{v.qtd}</TableCell>
                    <TableCell className="text-right">{formatCurrencyNoDecimals(v.valor)}</TableCell>
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
