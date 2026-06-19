import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { fetchJson, buildUrl } from "./utils";
import type { EvolucaoProdutoTabelaData } from "./types";

type Status = "ativos" | "cancelados" | "todos";

const MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatMes(mes: string): string {
  const [y, m] = mes.split("-");
  return `${MESES_PT[Number(m) - 1]}/${y.slice(2)}`;
}

const DESCRICAO: Record<Status, string> = {
  ativos: "carteira ativa no snapshot do mês",
  cancelados: "coorte por mês de encerramento (vida realizada)",
  todos: "ativos no snapshot + cancelados do mês",
};

export function TabelaEvolucaoProduto({
  metrica,
  agregador,
}: {
  metrica: "lt" | "ltv";
  agregador: "media" | "mediana";
}) {
  const [status, setStatus] = useState<Status>("ativos");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/lt-ltv-churn/evolucao-produto-tabela", status],
    queryFn: () =>
      fetchJson<EvolucaoProdutoTabelaData>(
        buildUrl("/api/lt-ltv-churn/evolucao-produto-tabela", { status }),
      ),
  });

  const campo =
    agregador === "media" ? metrica : (`${metrica}_mediana` as "lt_mediana" | "ltv_mediana");

  const formatCell = (v: number | undefined): string => {
    if (v == null) return "—";
    return metrica === "lt" ? `${v.toFixed(1)}m` : formatCurrencyNoDecimals(v);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          {metrica === "lt" ? "LT" : "LTV"} {agregador === "media" ? "médio" : "mediano"} por
          produto e mês · {DESCRICAO[status]}
        </p>
        <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
          <SelectTrigger className="w-[150px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativos">Ativos</SelectItem>
            <SelectItem value="cancelados">Cancelados</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading || !data ? (
        <div className="h-72 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-700/50">
                <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-medium text-gray-600 dark:bg-zinc-900 dark:text-zinc-400">
                  Produto
                </th>
                {data.meses.map((mes) => (
                  <th
                    key={mes}
                    className="whitespace-nowrap px-3 py-2 text-right font-medium text-gray-600 dark:text-zinc-400"
                  >
                    {formatMes(mes)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.produtos.map((produto) => {
                const isTotal = produto === "Total";
                return (
                  <tr
                    key={produto}
                    className={`border-b border-gray-100 dark:border-zinc-800/50 ${
                      isTotal ? "font-semibold" : ""
                    }`}
                  >
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 text-left text-gray-900 dark:bg-zinc-900 dark:text-white">
                      {produto}
                    </td>
                    {data.meses.map((mes) => (
                      <td
                        key={mes}
                        className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-700 dark:text-zinc-300"
                      >
                        {formatCell(data.celulas[produto]?.[mes]?.[campo])}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
