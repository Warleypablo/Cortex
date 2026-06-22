// client/src/components/creators-modelo/AuditoriaClientesDrawer.tsx
import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ChevronRight } from "lucide-react";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { fetchJson, buildUrl, ESTADO_LABEL } from "./utils";
import type { ClienteDetalhe } from "./types";

type Modelo = "recorrente" | "pontual";

interface Resp { modelo: Modelo; clientes: ClienteDetalhe[]; }

function lifetimeLabel(c: ClienteDetalhe): string {
  return c.ltMeses == null ? "—" : `${c.ltMeses} meses`;
}

export function AuditoriaClientesDrawer({
  modelo, de, ate, onClose,
}: {
  modelo: Modelo | null; de?: string; ate?: string; onClose: () => void;
}) {
  const [aberto, setAberto] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/creators-modelo/clientes", modelo, de, ate],
    enabled: !!modelo,
    queryFn: () => fetchJson<Resp>(buildUrl("/api/creators-modelo/clientes", { modelo: modelo!, de, ate })),
  });

  const clientes = data?.clientes ?? [];
  const corModelo = modelo === "recorrente" ? "text-sky-600 dark:text-sky-400" : "text-indigo-600 dark:text-indigo-400";

  const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-zinc-500";
  const thNum = th + " text-right";
  const td = "px-3 py-2.5 text-sm text-gray-900 dark:text-zinc-100";
  const tdNum = td + " text-right tabular-nums";

  return (
    <Sheet open={!!modelo} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800">
        <SheetHeader>
          <SheetTitle className="text-base">
            Auditoria de clientes — <span className={corModelo}>{modelo === "recorrente" ? "Recorrente" : "Pontual"}</span>
          </SheetTitle>
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            {isLoading ? "Carregando…" : `${clientes.length} clientes · clique numa linha para ver as entregas · LT e LTV por cliente`}
          </p>
        </SheetHeader>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-700/50">
                <th className={th}>Cliente</th>
                <th className={th}>Estado</th>
                <th className={thNum}>Entregas</th>
                <th className={thNum}>LT</th>
                <th className={thNum}>LTV</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => {
                const open = aberto === c.idTask;
                return (
                  <Fragment key={c.idTask}>
                    <tr
                      onClick={() => setAberto(open ? null : c.idTask)}
                      className="cursor-pointer border-b border-gray-100 dark:border-zinc-800/50 hover:bg-gray-50 dark:hover:bg-zinc-800/40"
                    >
                      <td className={td}>
                        <span className="flex items-center gap-1.5">
                          <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`} />
                          <span className="font-medium">{c.nome ?? "(sem nome)"}</span>
                        </span>
                      </td>
                      <td className={td}><span className="text-gray-500 dark:text-zinc-400">{ESTADO_LABEL[c.estado] ?? c.estado}</span></td>
                      <td className={tdNum}>{c.nEntregas}</td>
                      <td className={tdNum}>{lifetimeLabel(c)}</td>
                      <td className={`${tdNum} font-semibold`}>{formatCurrencyNoDecimals(c.ltv)}</td>
                    </tr>
                    {open && (
                      <tr className="bg-gray-50/70 dark:bg-zinc-900/50">
                        <td colSpan={5} className="px-3 py-3">
                          <table className="w-full">
                            <thead>
                              <tr className="text-xs text-gray-400 dark:text-zinc-500">
                                <th className="px-2 py-1 text-left font-medium">Entrega / serviço</th>
                                <th className="px-2 py-1 text-left font-medium">Status</th>
                                <th className="px-2 py-1 text-left font-medium">Início</th>
                                <th className="px-2 py-1 text-left font-medium">Fim</th>
                                <th className="px-2 py-1 text-right font-medium">Valor</th>
                              </tr>
                            </thead>
                            <tbody>
                              {c.entregas.map((e, i) => (
                                <tr key={i} className="text-sm text-gray-700 dark:text-zinc-300">
                                  <td className="px-2 py-1">{e.servico}</td>
                                  <td className="px-2 py-1">{e.status ?? "—"}</td>
                                  <td className="px-2 py-1 tabular-nums">{e.dataInicio ?? "—"}</td>
                                  <td className="px-2 py-1 tabular-nums">{e.dataFim ?? "—"}</td>
                                  <td className="px-2 py-1 text-right tabular-nums">{formatCurrencyNoDecimals(e.valor)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {!isLoading && clientes.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">Nenhum cliente no período.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
