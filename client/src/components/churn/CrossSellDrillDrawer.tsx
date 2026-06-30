import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { formatCurrencyNoDecimals } from "@/lib/utils";

export interface CrosssellDeal {
  id: string;
  cliente: string;
  closer: string;
  recorrente: number;
  pontual: number;
  data_fechamento: string | null;
}

export interface CrossSellDrillDrawerProps {
  open: boolean;
  onClose: () => void;
  deals: CrosssellDeal[];
  totalRecorrente: number;
  totalPontual: number;
  isLoading?: boolean;
}

function formatData(raw: string | null): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function CrossSellDrillDrawer({
  open,
  onClose,
  deals,
  totalRecorrente,
  totalPontual,
  isLoading = false,
}: CrossSellDrillDrawerProps): JSX.Element {
  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto bg-white dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-700"
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="text-gray-900 dark:text-white text-lg font-semibold">
            Cross-sell &amp; Up-sell do período
          </SheetTitle>
          <SheetDescription className="text-gray-500 dark:text-zinc-400 text-sm">
            Vendas de expansão para clientes existentes que entram no NRR.
          </SheetDescription>
        </SheetHeader>

        {/* Totais */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="flex flex-col gap-0.5 p-3 rounded-lg bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700">
            <span className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-zinc-400">Deals</span>
            <span className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">{deals.length}</span>
          </div>
          <div className="flex flex-col gap-0.5 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50">
            <span className="text-[11px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Recorrente</span>
            <span className="text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
              {formatCurrencyNoDecimals(totalRecorrente)}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50">
            <span className="text-[11px] uppercase tracking-wider text-blue-700 dark:text-blue-400">Pontual</span>
            <span className="text-xl font-bold tabular-nums text-blue-700 dark:text-blue-400">
              {formatCurrencyNoDecimals(totalPontual)}
            </span>
          </div>
        </div>

        {/* Lista de deals */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 rounded-md bg-gray-100 dark:bg-zinc-800/60 animate-pulse" />
            ))}
          </div>
        ) : deals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              Nenhuma venda de cross-sell registrada neste período.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-zinc-700 text-left">
                  <th className="px-2 py-2 font-medium text-gray-500 dark:text-zinc-400">Cliente</th>
                  <th className="px-2 py-2 font-medium text-gray-500 dark:text-zinc-400">Closer</th>
                  <th className="px-2 py-2 font-medium text-gray-500 dark:text-zinc-400 text-right">Recorrente</th>
                  <th className="px-2 py-2 font-medium text-gray-500 dark:text-zinc-400 text-right">Pontual</th>
                  <th className="px-2 py-2 font-medium text-gray-500 dark:text-zinc-400 text-right">Data</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="px-2 py-2 text-gray-900 dark:text-white font-medium max-w-[200px] truncate" title={d.cliente}>
                      {d.cliente}
                    </td>
                    <td className="px-2 py-2 text-gray-600 dark:text-zinc-400 max-w-[120px] truncate" title={d.closer}>
                      {d.closer}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                      {d.recorrente > 0 ? formatCurrencyNoDecimals(d.recorrente) : "—"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-blue-700 dark:text-blue-400">
                      {d.pontual > 0 ? formatCurrencyNoDecimals(d.pontual) : "—"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-gray-500 dark:text-zinc-400">
                      {formatData(d.data_fechamento)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
