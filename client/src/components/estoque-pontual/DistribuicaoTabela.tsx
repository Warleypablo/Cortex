import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { DistRow } from "./types";

export function DistribuicaoTabela({
  titulo,
  colChave,
  itens,
}: {
  titulo: string;
  colChave: string;
  itens: DistRow[];
}) {
  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{colChave}</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Idade média</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">
                    Sem itens
                  </TableCell>
                </TableRow>
              )}
              {itens.map((r) => (
                <TableRow key={r.chave}>
                  <TableCell className="font-medium">{r.chave}</TableCell>
                  <TableCell className="text-right">{r.qtd}</TableCell>
                  <TableCell className="text-right">{formatCurrencyNoDecimals(r.valor)}</TableCell>
                  <TableCell className="text-right">{r.idadeMedia} d</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
