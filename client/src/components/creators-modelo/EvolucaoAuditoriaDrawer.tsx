// client/src/components/creators-modelo/EvolucaoAuditoriaDrawer.tsx
import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ChevronRight } from "lucide-react";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { fetchJson, buildUrl, ESTADO_LABEL } from "./utils";
import type { ClienteDetalhe, Situacao } from "./types";

type Modelo = "recorrente" | "pontual";
interface Resp { mes: string; modelo: Modelo; clientes: ClienteDetalhe[]; }

const MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function fmtMes(m: string | null): string {
  if (!m) return "";
  const [y, mm] = m.split("-");
  return `${MESES_PT[Number(mm) - 1]}/${y.slice(2)}`;
}

export function EvolucaoAuditoriaDrawer({
  alvo, estado = "ambos", de, ate, onClose,
}: {
  alvo: { modelo: Modelo; mes: string } | null; estado?: Situacao; de?: string; ate?: string; onClose: () => void;
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  const modelo = alvo?.modelo ?? null;
  const mes = alvo?.mes ?? null;
  const estadoParam = estado === "ambos" ? "todos" : estado;

  const { data, isLoading } = useQuery({
    queryKey: ["/api/creators-modelo/evolucao/clientes", modelo, mes, estadoParam, de, ate],
    enabled: !!alvo,
    queryFn: () =>
      fetchJson<Resp>(buildUrl("/api/creators-modelo/evolucao/clientes", { modelo: modelo!, mes: mes!, estado: estadoParam, de, ate })),
  });

  const clientes = data?.clientes ?? [];
  const corModelo = modelo === "recorrente" ? "text-sky-600 dark:text-sky-400" : "text-indigo-600 dark:text-indigo-400";
  const isRec = modelo === "recorrente";

  const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-zinc-500";
  const thNum = th + " text-right";
  const td = "px-3 py-2.5 text-sm text-gray-900 dark:text-zinc-100";
  const tdNum = td + " text-right tabular-nums";

  return (
    <Sheet open={!!alvo} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800">
        <SheetHeader>
          <SheetTitle className="text-base">
            Auditoria — <span className={corModelo}>{isRec ? "Recorrente" : "Pontual"}</span> · {fmtMes(mes)}
          </SheetTitle>
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            {isLoading ? "Carregando…" : `${clientes.length} clientes na base do snapshot · `}
            {isRec
              ? "LT = idade da base (meses) · LTV = realizado (valorr × meses)"
              : "LT = nº de entregas entregues (1 = 1 mês; entrega única fora do LT) · LTV = realizado (só entregues)"}
          </p>
        </SheetHeader>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-700/50">
                <th className={th}>Cliente</th>
                <th className={th}>Estado</th>
                <th className={thNum}>{isRec ? "Contratos" : "Entregas"}</th>
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
                      <td className={tdNum}>{c.ltMeses == null ? "—" : `${c.ltMeses} m`}</td>
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
                                <th className="px-2 py-1 text-right font-medium">Valor</th>
                              </tr>
                            </thead>
                            <tbody>
                              {c.entregas.map((e, i) => {
                                const status = (e.status ?? "").trim().toLowerCase();
                                const entregue = status === "entregue";
                                const cancelado = status === "cancelado/inativo" || status === "não usar";
                                const rowCls = entregue
                                  ? "text-gray-700 dark:text-zinc-300"
                                  : cancelado
                                    ? "text-gray-400 line-through decoration-gray-300 dark:text-zinc-600 dark:decoration-zinc-700"
                                    : "text-gray-400 dark:text-zinc-500";
                                return (
                                  <tr key={i} className={`text-sm ${rowCls}`}>
                                    <td className="px-2 py-1">{e.servico}</td>
                                    <td className="px-2 py-1">
                                      {entregue
                                        ? <span className="font-medium text-emerald-600 dark:text-emerald-400">{e.status}</span>
                                        : (e.status ?? "—")}
                                    </td>
                                    <td className="px-2 py-1 tabular-nums">{e.dataInicio ?? "—"}</td>
                                    <td className="px-2 py-1 text-right tabular-nums">{formatCurrencyNoDecimals(e.valor)}</td>
                                  </tr>
                                );
                              })}
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
            <p className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">Nenhum cliente nesse mês/estado.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
