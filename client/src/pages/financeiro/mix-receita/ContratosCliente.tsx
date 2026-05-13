import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyNoDecimals } from "@/lib/utils";

interface ContratoCliente {
  cliente_nome: string;
  id_task: string;
  id_subtask: string;
  mrr_recorrente: number;
  total_pontual: number;
  total: number;
  squad: string;
  responsavel: string;
  status: string;
}

interface ClientesPorProdutoResponse {
  produto: string;
  contratos: ContratoCliente[];
  totais: {
    contratos: number;
    mrr_recorrente: number;
    total_pontual: number;
    receita_total: number;
  };
}

interface ContratosClienteProps {
  produto: string;
  statusFiltro: string[];
  squad: string;
}

function statusBadgeClass(status: string): string {
  const s = (status || "").toLowerCase().trim();
  if (s === "ativo") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400";
  if (s === "onboarding" || s === "pausado") return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400";
  if (s === "em cancelamento") return "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400";
  if (s === "entregue") return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400";
  return "bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-400";
}

export function ContratosCliente({ produto, statusFiltro, squad }: ContratosClienteProps) {
  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.set("produto", produto);
    if (statusFiltro.length > 0) p.set("status", statusFiltro.join(","));
    if (squad !== "todos") p.set("squad", squad);
    return p.toString();
  }, [produto, statusFiltro, squad]);

  const { data, isLoading, error } = useQuery<ClientesPorProdutoResponse>({
    queryKey: [`/api/financeiro/mix-receita/clientes?${params}`],
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-rose-700 dark:text-rose-400">
        Erro ao carregar contratos: {(error as Error).message}
      </div>
    );
  }

  if (!data || data.contratos.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500 dark:text-zinc-400 italic">
        Sem contratos para este produto com os filtros atuais
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-zinc-900/30 border-l-4 border-emerald-500 dark:border-emerald-600">
      <table className="w-full text-xs">
        <thead className="border-b border-gray-200 dark:border-zinc-800">
          <tr>
            <th className="p-2 pl-12 text-left font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Cliente</th>
            <th className="p-2 text-right font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">MRR</th>
            <th className="p-2 text-right font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Pontual</th>
            <th className="p-2 text-left font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Squad</th>
            <th className="p-2 text-left font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Responsável</th>
            <th className="p-2 text-center font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.contratos.map((c) => {
            const isUnknownClient = c.cliente_nome === "(cliente não identificado)";
            return (
              <tr
                key={c.id_subtask}
                className="border-b border-gray-100 dark:border-zinc-900/60 hover:bg-white dark:hover:bg-zinc-900/60"
              >
                <td className={`p-2 pl-12 font-medium ${isUnknownClient ? "text-gray-400 dark:text-zinc-500 italic" : "text-gray-900 dark:text-white"}`}>
                  {c.cliente_nome}
                </td>
                <td className="p-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                  {c.mrr_recorrente > 0 ? formatCurrencyNoDecimals(c.mrr_recorrente) : "—"}
                </td>
                <td className="p-2 text-right tabular-nums text-orange-700 dark:text-orange-400">
                  {c.total_pontual > 0 ? formatCurrencyNoDecimals(c.total_pontual) : "—"}
                </td>
                <td className="p-2 text-gray-700 dark:text-zinc-300">{c.squad}</td>
                <td className="p-2 text-gray-700 dark:text-zinc-300">{c.responsavel}</td>
                <td className="p-2 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${statusBadgeClass(c.status)}`}>
                    {c.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-gray-100 dark:bg-zinc-900/60 border-t border-gray-200 dark:border-zinc-800">
          <tr>
            <td className="p-2 pl-12 font-semibold text-gray-700 dark:text-zinc-300">
              {data.totais.contratos} contrato{data.totais.contratos !== 1 ? "s" : ""}
            </td>
            <td className="p-2 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
              {formatCurrencyNoDecimals(data.totais.mrr_recorrente)}
            </td>
            <td className="p-2 text-right tabular-nums font-semibold text-orange-700 dark:text-orange-400">
              {formatCurrencyNoDecimals(data.totais.total_pontual)}
            </td>
            <td colSpan={3} className="p-2 text-right tabular-nums font-semibold text-gray-900 dark:text-white pr-4">
              Total: {formatCurrencyNoDecimals(data.totais.receita_total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
