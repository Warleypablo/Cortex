import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { fetchJson, buildUrl } from "./utils";
import type { CreatorItem } from "./types";

export function ItensTable({
  statusList, operadores,
}: { statusList: string[]; operadores: string[] }) {
  const [status, setStatus] = useState<string>("todos");
  const [operador, setOperador] = useState<string>("todos");

  const statusParam = status === "todos" ? undefined : status;
  const operadorParam = operador === "todos" ? undefined : operador;

  const { data } = useQuery({
    queryKey: ["/api/creators-pontual/itens", status, operador],
    queryFn: () =>
      fetchJson<{ itens: CreatorItem[]; total: number }>(
        buildUrl("/api/creators-pontual/itens", { page: "1", status: statusParam, operador: operadorParam }),
      ),
  });

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
            Itens em aberto ({data?.total ?? 0})
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[160px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {statusList.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={operador} onValueChange={setOperador}>
              <SelectTrigger className="w-[180px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
                <SelectValue placeholder="Operador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os operadores</SelectItem>
                {operadores.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {!data ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">Carregando…</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Squad</TableHead>
                  <TableHead>Operador</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Idade (d)</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.itens.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">
                      Nenhum item encontrado
                    </TableCell>
                  </TableRow>
                )}
                {data.itens.map((it) => (
                  <TableRow key={it.idSubtask}>
                    <TableCell className="font-medium">{it.nomeCliente ?? "—"}</TableCell>
                    <TableCell>{it.squad ?? "—"}</TableCell>
                    <TableCell>{it.operador ?? "—"}</TableCell>
                    <TableCell>{it.vendedor ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrencyNoDecimals(it.valor)}</TableCell>
                    <TableCell className="text-right">
                      {it.idadeDias >= 90 ? (
                        <Badge variant="destructive">{it.idadeDias}</Badge>
                      ) : (
                        it.idadeDias
                      )}
                    </TableCell>
                    <TableCell><Badge variant="outline">{it.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data.total > data.itens.length && (
              <p className="pt-3 text-center text-xs text-gray-400 dark:text-zinc-500">
                Mostrando os {data.itens.length} itens mais antigos de {data.total}.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
