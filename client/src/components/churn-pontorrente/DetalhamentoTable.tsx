import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { DetalheRow } from "./types";

export function DetalhamentoTable({ rows }: { rows: DetalheRow[] }) {
  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <CardTitle className="text-base">Detalhamento do churn</CardTitle>
        <p className="text-xs text-gray-500 dark:text-zinc-400">{rows.length} jornada(s) churnada(s)</p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
              <th className="py-2 pr-3">Cliente</th>
              <th className="py-2 pr-3">Produto</th>
              <th className="py-2 pr-3">Caiu na entrega</th>
              <th className="py-2 pr-3">Motivo</th>
              <th className="py-2 pr-3">Responsável</th>
              <th className="py-2 pr-3">CS</th>
              <th className="py-2 pr-3">Squad</th>
              <th className="py-2 pr-3">Vendedor</th>
              <th className="py-2 pr-3 text-right">Valor pontual</th>
              <th className="py-2 pr-3">Encerramento</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-gray-100 text-gray-700 dark:border-zinc-800 dark:text-zinc-300">
                <td className="py-2 pr-3">{r.nomeCliente ?? "—"}</td>
                <td className="py-2 pr-3">{r.produto}</td>
                <td className="py-2 pr-3">{r.nivelCaiu}ª</td>
                <td className="py-2 pr-3">{r.motivo ?? "—"}</td>
                <td className="py-2 pr-3">{r.responsavel ?? "—"}</td>
                <td className="py-2 pr-3">{r.cs ?? "—"}</td>
                <td className="py-2 pr-3">{r.squad ?? "—"}</td>
                <td className="py-2 pr-3">{r.vendedor ?? "—"}</td>
                <td className="py-2 pr-3 text-right">{formatCurrencyNoDecimals(r.valorp)}</td>
                <td className="py-2 pr-3">{r.dataEncerramento ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="py-6 text-center text-gray-400 dark:text-zinc-500">Sem churn no filtro atual</td></tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
