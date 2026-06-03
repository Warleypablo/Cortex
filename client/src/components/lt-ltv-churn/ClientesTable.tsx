import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { CLUSTER_OPTIONS, CLUSTER_MAP } from "@shared/constants";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { fetchJson, buildUrl } from "./utils";
import type { ClienteRow } from "./types";

type Dir = "asc" | "desc";

const CLUSTER_COLOR: Record<string, string> = Object.fromEntries(
  CLUSTER_OPTIONS.map((o) => [o.value, o.color ?? ""]),
);

export function ClientesTable({ produto, status }: { produto?: string; status?: string }) {
  const qc = useQueryClient();
  const [sort, setSort] = useState<string>("ltvTotal");
  const [dir, setDir] = useState<Dir>("desc");
  const [tier, setTier] = useState<string>("todos");
  const [msg, setMsg] = useState<string>("");

  const tierParam = tier === "todos" ? undefined : tier;

  const queryKey = ["/api/lt-ltv-churn/clientes", produto, status, sort, dir, tier];
  const { data: clientes } = useQuery({
    queryKey,
    queryFn: () =>
      fetchJson<{ clientes: ClienteRow[]; total: number }>(
        buildUrl("/api/lt-ltv-churn/clientes", {
          page: "1", produto, status, sort, dir, cluster: tierParam,
        })
      ),
  });

  const setTierMut = useMutation({
    mutationFn: async ({ idTask, cluster }: { idTask: string; cluster: string | null }) => {
      const res = await fetch(`/api/lt-ltv-churn/clientes/${idTask}/tier`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cluster }),
      });
      if (!res.ok) throw new Error("falha ao salvar tier");
    },
    onMutate: () => setMsg(""),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/lt-ltv-churn/clientes"] }),
    onError: () => setMsg("Erro ao salvar o tier — tente novamente"),
  });

  const aplicarMut = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/lt-ltv-churn/clientes/aplicar-tiers-auto", { method: "POST" });
      if (!res.ok) throw new Error("falha ao aplicar");
      return (await res.json()) as { atualizados: number };
    },
    onMutate: () => setMsg(""),
    onSuccess: (d) => {
      setMsg(`${d.atualizados} clientes atualizados`);
      qc.invalidateQueries({ queryKey: ["/api/lt-ltv-churn/clientes"] });
    },
    onError: () => setMsg("Erro ao aplicar — tente novamente"),
  });

  function toggleSort(col: string) {
    if (sort === col) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSort(col); setDir("desc"); }
  }

  function onTierChange(idTask: string, value: string) {
    const cluster = value === "__clear__" ? null : value;
    setTierMut.mutate({ idTask, cluster });
  }

  function SortHead({ col, label, align = "left" }: { col: string; label: string; align?: "left" | "right" }) {
    const active = sort === col;
    const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <TableHead className={align === "right" ? "text-right" : ""}>
        <button
          type="button"
          onClick={() => toggleSort(col)}
          className={`inline-flex w-full items-center gap-1 ${
            align === "right" ? "justify-end" : "justify-start"
          } hover:text-gray-900 dark:hover:text-white ${active ? "text-gray-900 dark:text-white" : ""}`}
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
            Clientes ({clientes?.total ?? 0})
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {msg && <span className="text-xs text-gray-500 dark:text-zinc-400">{msg}</span>}
            <Button
              variant="outline"
              size="sm"
              disabled={aplicarMut.isPending}
              onClick={() => aplicarMut.mutate()}
            >
              {aplicarMut.isPending ? "Aplicando…" : "Aplicar sugestões automáticas"}
            </Button>
            <Select value={tier} onValueChange={setTier}>
              <SelectTrigger className="w-[150px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tiers</SelectItem>
                {CLUSTER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
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
                  <TableHead>Tier</TableHead>
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
                    <TableCell colSpan={8} className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">
                      Nenhum cliente encontrado
                    </TableCell>
                  </TableRow>
                )}
                {clientes.clientes.map((c) => (
                  <TableRow key={c.idTask}>
                    <TableCell className="font-medium">{c.nomeCliente ?? "—"}</TableCell>
                    <TableCell>
                      <Select
                        value={c.cluster ?? ""}
                        onValueChange={(v) => onTierChange(c.idTask, v)}
                      >
                        <SelectTrigger className="h-7 w-[150px] border-gray-200 dark:border-zinc-700/50 bg-transparent">
                          {c.cluster && CLUSTER_MAP[c.cluster] ? (
                            <Badge variant="outline" className={CLUSTER_COLOR[c.cluster]}>
                              {CLUSTER_MAP[c.cluster]}
                            </Badge>
                          ) : (
                            <span className="text-xs italic text-gray-400 dark:text-zinc-500">
                              sugere: {CLUSTER_MAP[c.clusterSugerido] ?? "—"}
                            </span>
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {CLUSTER_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                          <SelectItem value="__clear__">Limpar (automático)</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
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
