import { useState } from "react";
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
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { fetchJson, buildUrl } from "./utils";
import type { ClienteRow } from "./types";

type Dir = "asc" | "desc";

export function ClientesTable({ produto, status }: { produto?: string; status?: string }) {
  const [sort, setSort] = useState<string>("ltvTotal");
  const [dir, setDir] = useState<Dir>("desc");

  const { data: clientes } = useQuery({
    queryKey: ["/api/lt-ltv-churn/clientes", produto, status, sort, dir],
    queryFn: () =>
      fetchJson<{ clientes: ClienteRow[]; total: number }>(
        buildUrl("/api/lt-ltv-churn/clientes", { page: "1", produto, status, sort, dir })
      ),
  });

  function toggleSort(col: string) {
    if (sort === col) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(col);
      setDir("desc");
    }
  }

  function SortHead({
    col,
    label,
    align = "left",
  }: {
    col: string;
    label: string;
    align?: "left" | "right";
  }) {
    const active = sort === col;
    const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <TableHead className={align === "right" ? "text-right" : ""}>
        <button
          type="button"
          onClick={() => toggleSort(col)}
          className={`inline-flex w-full items-center gap-1 ${
            align === "right" ? "justify-end" : "justify-start"
          } hover:text-gray-900 dark:hover:text-white ${
            active ? "text-gray-900 dark:text-white" : ""
          }`}
        >
          {label}
          <Icon className={`h-3.5 w-3.5 ${active ? "opacity-100" : "opacity-40"}`} />
        </button>
      </TableHead>
    );
  }

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
                  <SortHead col="nome" label="Cliente" />
                  <SortHead col="contratos" label="Contratos" align="right" />
                  <TableHead>Status</TableHead>
                  <SortHead col="lt" label="LT (m)" align="right" />
                  <SortHead col="ltvRecorrente" label="LTV recorr." align="right" />
                  <SortHead col="ltvPontual" label="LTV pontual" align="right" />
                  <SortHead col="ltvTotal" label="LTV total" align="right" />
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
