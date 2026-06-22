// client/src/components/creators-modelo/EvolucaoLtLtv.tsx
import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { fetchJson, buildUrl } from "@/components/lt-ltv-churn/utils";
import { EvolucaoAuditoriaDrawer } from "./EvolucaoAuditoriaDrawer";
import type { Unidade, Agregador, Situacao } from "./types";

interface ModMetric { clientes: number; lt: number | null; ltv: number | null; faturamento: number | null; }
interface EvolucaoMes { mes: string; recorrente: ModMetric; pontual: ModMetric; }

const MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function fmtMes(m: string): string {
  const [y, mm] = m.split("-");
  return `${MESES_PT[Number(mm) - 1]}/${y.slice(2)}`;
}
const fmtLt = (v: number | null) => (v == null ? "—" : `${v} m`);
const fmtLtv = (v: number | null) => (v == null ? "—" : formatCurrencyNoDecimals(v));

const LINHAS: Array<{ label: string; get: (x: ModMetric) => string; forte?: boolean }> = [
  { label: "Clientes", get: (x) => String(x.clientes) },
  { label: "LT", get: (x) => fmtLt(x.lt) },
  { label: "LTV", get: (x) => fmtLtv(x.ltv), forte: true },
  { label: "Faturamento", get: (x) => fmtLtv(x.faturamento), forte: true },
];

const GRUPOS: Array<{ key: "recorrente" | "pontual"; label: string; cor: string; barra: string }> = [
  { key: "recorrente", label: "Recorrente", cor: "text-sky-600 dark:text-sky-400", barra: "bg-sky-500" },
  { key: "pontual", label: "Pontual", cor: "text-indigo-600 dark:text-indigo-400", barra: "bg-indigo-500" },
];

export function EvolucaoLtLtv({
  unidade, agregador, estado, de, ate,
}: {
  unidade: Unidade; agregador: Agregador; estado: Situacao; de?: string; ate?: string;
}) {
  const [audit, setAudit] = useState<{ modelo: "recorrente" | "pontual"; mes: string } | null>(null);
  const estadoParam = estado === "ambos" ? "todos" : estado;
  const { data } = useQuery({
    queryKey: ["/api/creators-modelo/evolucao", unidade, agregador, estadoParam, de, ate],
    queryFn: () =>
      fetchJson<{ meses: EvolucaoMes[] }>(
        buildUrl("/api/creators-modelo/evolucao", { unidade, agregador, estado: estadoParam, de, ate }),
      ),
  });

  const th = "px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-zinc-500";
  const td = "px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-zinc-100";
  const meses = data?.meses ?? [];

  return (
    <>
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <CardTitle className="text-base">Evolução mensal — LT &amp; LTV Recorrente × Pontual</CardTitle>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Base presente em cada snapshot de fim de mês (cup_data_hist). Recorrente = base ativa do mês
          (exclui churnados que já saíram → lê mais alto que o total acima, que é blended com cancelados).
          {" "}Pontual: 1 entrega entregue = 1 mês (entrega única fora do LT); LTV = realizado (só entregues).
          {" "}Faturamento = total realizado da base no mês (tudo que foi entregue, inclui entrega única; recorrente = Σ valorr × meses).
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {!data ? (
          <div className="h-40 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-700/50">
                <th className={`${th} text-left`}>Métrica</th>
                {meses.map((m) => (
                  <th key={m.mes} className={`${th} text-right`}>{fmtMes(m.mes)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GRUPOS.map((g) => (
                <Fragment key={g.key}>
                  <tr className="bg-gray-50/70 dark:bg-zinc-800/30">
                    <td colSpan={meses.length + 1} className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <span className={`inline-block h-3.5 w-1 rounded-full ${g.barra}`} />
                        <span className={`text-xs font-semibold uppercase tracking-wide ${g.cor}`}>{g.label}</span>
                      </span>
                    </td>
                  </tr>
                  {LINHAS.map((l) => (
                    <tr key={l.label} className="border-b border-gray-100 last:border-0 dark:border-zinc-800/50">
                      <td className="px-3 py-2.5 text-gray-500 dark:text-zinc-400">{l.label}</td>
                      {meses.map((m) => (
                        <td key={m.mes} className={`${td}${l.forte ? " font-semibold" : ""}`}>
                          {l.label === "Clientes" ? (
                            <button
                              onClick={() => setAudit({ modelo: g.key, mes: m.mes })}
                              className="font-medium text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
                              title="Ver clientes e auditar entregas deste mês"
                            >
                              {l.get(m[g.key])}
                            </button>
                          ) : (
                            l.get(m[g.key])
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
    <EvolucaoAuditoriaDrawer alvo={audit} estado={estado} de={de} ate={ate} onClose={() => setAudit(null)} />
    </>
  );
}
