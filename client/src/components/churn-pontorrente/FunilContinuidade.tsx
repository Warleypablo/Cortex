import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { FunilNivel } from "./types";

const fmtPct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

type Linha = {
  label: string;
  dot?: string;
  cls?: string;
  cell: (n: FunilNivel, i: number, total: number) => ReactNode;
};

export function FunilContinuidade({ data }: { data: FunilNivel[] }) {
  const base = data[0]?.atingiram ?? 0;
  const ret = (n: FunilNivel) => (base > 0 ? Math.round((n.atingiram / base) * 1000) / 10 : 0);

  const linhas: Linha[] = [
    { label: "Atingiram", cell: (n) => <span className="font-semibold">{n.atingiram}</span> },
    { label: "Retenção", cell: (n) => fmtPct(ret(n)) },
    {
      label: "Drop p/ próxima",
      cls: "text-red-500 dark:text-red-400",
      cell: (n, i, total) => (i < total - 1 ? `−${fmtPct(n.dropPct)}` : "—"),
    },
    { label: "Concluído", dot: "bg-emerald-500", cls: "text-emerald-600 dark:text-emerald-400", cell: (n) => n.concluido },
    { label: "Em andamento", dot: "bg-amber-500", cls: "text-amber-600 dark:text-amber-400", cell: (n) => n.emAndamento },
    { label: "Churn (caiu)", dot: "bg-red-500", cls: "text-red-600 dark:text-red-400", cell: (n) => n.churn },
    {
      label: "Valor perdido",
      cls: "text-red-600 dark:text-red-400",
      cell: (n) => (n.valorpChurn > 0 ? formatCurrencyNoDecimals(n.valorpChurn) : "—"),
    },
  ];

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <CardTitle className="text-base">Funil de continuidade</CardTitle>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Sobrevivência por entrega + situação de quem parou em cada degrau (caiu / ainda roda / concluído)
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 dark:text-zinc-400">
              <th className="py-2 pr-4 text-left font-medium" />
              {data.map((n) => (
                <th key={n.nivel} className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-zinc-200">
                  Entrega {n.nivel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.label} className="border-t border-gray-100 dark:border-zinc-800">
                <td className="py-2 pr-4 text-left whitespace-nowrap text-gray-600 dark:text-zinc-400">
                  <span className="inline-flex items-center gap-2">
                    {linha.dot && <span className={`h-2 w-2 rounded-full ${linha.dot}`} />}
                    {linha.label}
                  </span>
                </td>
                {data.map((n, i) => (
                  <td
                    key={n.nivel}
                    className={`px-3 py-2 text-center tabular-nums ${linha.cls ?? "text-gray-800 dark:text-zinc-200"}`}
                  >
                    {linha.cell(n, i, data.length)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
