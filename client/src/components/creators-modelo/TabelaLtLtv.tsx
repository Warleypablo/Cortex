// client/src/components/creators-modelo/TabelaLtLtv.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { RedesignPayload, Grupo, Unidade, Agregador } from "./types";

const MODELOS: Array<{ modelo: "recorrente" | "pontual"; label: string; cor: string; barra: string }> = [
  { modelo: "recorrente", label: "Recorrente", cor: "text-sky-600 dark:text-sky-400", barra: "bg-sky-500" },
  { modelo: "pontual", label: "Pontual", cor: "text-indigo-600 dark:text-indigo-400", barra: "bg-indigo-500" },
];

export function TabelaLtLtv({
  data, unidade, agregador,
}: {
  data: RedesignPayload; unidade: Unidade; agregador: Agregador;
}) {
  const grupos = data.tabela?.[unidade] ?? [];
  const total = (modelo: string): Grupo | undefined =>
    grupos.find((g) => g.modelo === modelo && g.estado === "total");

  const lt = (g: Grupo) => (agregador === "media" ? g.metricas.ltMesesMedia : g.metricas.ltMesesMediana);
  const ent = (g: Grupo) => (agregador === "media" ? g.metricas.nEntregasMedia : g.metricas.nEntregasMediana);
  const ltv = (g: Grupo) => (agregador === "media" ? g.metricas.ltvMedia : g.metricas.ltvMediana);

  const th = "px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-zinc-500";
  const thNum = th + " text-right";
  const td = "px-4 py-4 text-gray-900 dark:text-zinc-100";
  const tdNum = td + " text-right tabular-nums";

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <CardTitle className="text-base">LT &amp; LTV — Recorrente × Pontual</CardTitle>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          {unidade === "cliente" ? "Por cliente" : "Por contrato"} · {agregador === "media" ? "Média" : "Mediana"}
          {" "}· LTV recorrente = realizado até hoje · LT pontual = tempo entre entregas elegíveis
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-zinc-700/50">
              <th className={th}>Modelo</th>
              <th className={thNum}>{unidade === "cliente" ? "Clientes" : "Contratos"}</th>
              <th className={thNum}>LT (meses)</th>
              <th className={thNum}>Nº entregas</th>
              <th className={thNum}>LTV {agregador}</th>
              <th className={thNum}>LTV total</th>
            </tr>
          </thead>
          <tbody>
            {MODELOS.map(({ modelo, label, cor, barra }) => {
              const g = total(modelo);
              if (!g) return null;
              const isPont = modelo === "pontual";
              return (
                <tr key={modelo} className="border-b border-gray-100 last:border-0 dark:border-zinc-800/50">
                  <td className={td}>
                    <span className="flex items-center gap-2">
                      <span className={`inline-block h-4 w-1 rounded-full ${barra}`} />
                      <span className={`font-semibold ${cor}`}>{label}</span>
                    </span>
                  </td>
                  <td className={tdNum}>{g.metricas.n}</td>
                  <td className={tdNum}>{isPont && unidade === "contrato" ? "—" : lt(g)}</td>
                  <td className={tdNum}>{isPont && unidade === "cliente" ? ent(g) : "—"}</td>
                  <td className={`${tdNum} text-base font-bold`}>{formatCurrencyNoDecimals(ltv(g))}</td>
                  <td className={tdNum}>{formatCurrencyNoDecimals(g.metricas.ltvTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
