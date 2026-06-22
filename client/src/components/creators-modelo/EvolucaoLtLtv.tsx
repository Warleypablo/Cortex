// client/src/components/creators-modelo/EvolucaoLtLtv.tsx
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { fetchJson } from "@/components/lt-ltv-churn/utils";

interface ModMetric { clientes: number; lt: number | null; ltv: number | null; }
interface EvolucaoMes { mes: string; recorrente: ModMetric; pontual: ModMetric; }

const MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function fmtMes(m: string): string {
  const [y, mm] = m.split("-");
  return `${MESES_PT[Number(mm) - 1]}/${y.slice(2)}`;
}
const fmtLt = (v: number | null) => (v == null ? "—" : `${v} m`);
const fmtLtv = (v: number | null) => (v == null ? "—" : formatCurrencyNoDecimals(v));

export function EvolucaoLtLtv() {
  const { data } = useQuery({
    queryKey: ["/api/creators-modelo/evolucao"],
    queryFn: () => fetchJson<{ meses: EvolucaoMes[] }>("/api/creators-modelo/evolucao"),
  });

  const th = "px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-zinc-500";
  const tdNum = "px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-zinc-100";
  const bl = "border-l border-gray-100 dark:border-zinc-800/50";

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <CardTitle className="text-base">Evolução mensal — LT &amp; LTV Recorrente × Pontual</CardTitle>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Base presente em cada snapshot de fim de mês (cup_data_hist). Recorrente = base ativa do mês
          (exclui churnados que já saíram → lê mais alto que o total acima, que é blended com cancelados).
          {" "}Pontual: 1 entrega entregue = 1 mês; LTV = realizado (só entregues).
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {!data ? (
          <div className="h-40 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-700/50">
                <th className={`${th} text-left`} rowSpan={2}>Mês</th>
                <th className={`${th} text-center ${bl}`} colSpan={3}>
                  <span className="text-sky-600 dark:text-sky-400">Recorrente</span>
                </th>
                <th className={`${th} text-center ${bl}`} colSpan={3}>
                  <span className="text-indigo-600 dark:text-indigo-400">Pontual</span>
                </th>
              </tr>
              <tr className="border-b border-gray-200 dark:border-zinc-700/50">
                <th className={`${th} text-right ${bl}`}>Clientes</th>
                <th className={`${th} text-right`}>LT</th>
                <th className={`${th} text-right`}>LTV</th>
                <th className={`${th} text-right ${bl}`}>Clientes</th>
                <th className={`${th} text-right`}>LT</th>
                <th className={`${th} text-right`}>LTV</th>
              </tr>
            </thead>
            <tbody>
              {data.meses.map((m) => (
                <tr key={m.mes} className="border-b border-gray-100 last:border-0 dark:border-zinc-800/50">
                  <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-zinc-100">{fmtMes(m.mes)}</td>
                  <td className={`${tdNum} ${bl}`}>{m.recorrente.clientes}</td>
                  <td className={tdNum}>{fmtLt(m.recorrente.lt)}</td>
                  <td className={`${tdNum} font-semibold`}>{fmtLtv(m.recorrente.ltv)}</td>
                  <td className={`${tdNum} ${bl}`}>{m.pontual.clientes}</td>
                  <td className={tdNum}>{fmtLt(m.pontual.lt)}</td>
                  <td className={`${tdNum} font-semibold`}>{fmtLtv(m.pontual.ltv)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
