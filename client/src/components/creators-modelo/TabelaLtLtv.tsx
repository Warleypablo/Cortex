// client/src/components/creators-modelo/TabelaLtLtv.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { ESTADO_LABEL } from "./utils";
import type { RedesignPayload, Grupo, Unidade, Agregador, Situacao } from "./types";

// Ordem de exibição das linhas
const ORDEM: Array<{ modelo: "recorrente" | "pontual"; estado: string }> = [
  { modelo: "recorrente", estado: "ativo" },
  { modelo: "recorrente", estado: "cancelado" },
  { modelo: "recorrente", estado: "total" },
  { modelo: "pontual", estado: "em_producao" },
  { modelo: "pontual", estado: "concluido" },
  { modelo: "pontual", estado: "cancelado" },
  { modelo: "pontual", estado: "total" },
];

// Mapa situação (filtro) -> estados visíveis. "concluido" sempre visível (sucesso).
function visivel(estado: string, situacao: Situacao): boolean {
  if (situacao === "ambos") return true;
  if (estado === "total" || estado === "concluido") return true;
  if (situacao === "ativo") return estado === "ativo" || estado === "em_producao";
  return estado === "cancelado"; // situacao === 'cancelado'
}

export function TabelaLtLtv({
  data, unidade, agregador, situacao,
}: {
  data: RedesignPayload; unidade: Unidade; agregador: Agregador; situacao: Situacao;
}) {
  const grupos = data.tabela?.[unidade] ?? [];
  const byKey = (modelo: string, estado: string): Grupo | undefined =>
    grupos.find((g) => g.modelo === modelo && g.estado === estado);

  const lt = (g: Grupo) => (agregador === "media" ? g.metricas.ltMesesMedia : g.metricas.ltMesesMediana);
  const ent = (g: Grupo) => (agregador === "media" ? g.metricas.nEntregasMedia : g.metricas.nEntregasMediana);
  const ltv = (g: Grupo) => (agregador === "media" ? g.metricas.ltvMedia : g.metricas.ltvMediana);

  const th = "px-3 py-2 text-left font-medium text-gray-500 dark:text-zinc-400";
  const td = "px-3 py-2 text-gray-900 dark:text-zinc-100";

  const linhas = ORDEM
    .filter((o) => visivel(o.estado, situacao))
    .map((o) => ({ ...o, g: byKey(o.modelo, o.estado) }))
    .filter((o): o is { modelo: "recorrente" | "pontual"; estado: string; g: Grupo } => !!o.g);

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <CardTitle className="text-base">LT e LTV por modelo</CardTitle>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          {unidade === "cliente" ? "Por cliente" : "Por contrato"} · {agregador === "media" ? "Média" : "Mediana"}
          {" "}· LTV recorrente = realizado até hoje · LT pontual = tempo entre entregas elegíveis
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-zinc-700/50">
              <th className={th}>Modelo / situação</th>
              <th className={th}>Nº</th>
              <th className={th}>LT (meses)</th>
              <th className={th}>Nº entregas</th>
              <th className={th}>LTV {agregador}</th>
              <th className={th}>LTV total</th>
              <th className={th}>Idade média (m)</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ modelo, estado, g }) => {
              const isTotal = estado === "total";
              const isPont = modelo === "pontual";
              return (
                <tr
                  key={`${modelo}-${estado}`}
                  className={`border-b border-gray-100 dark:border-zinc-800/50 ${isTotal ? "font-semibold bg-gray-50/60 dark:bg-zinc-800/30" : ""}`}
                >
                  <td className={td}>
                    <span className={modelo === "recorrente" ? "text-sky-600 dark:text-sky-400" : "text-indigo-600 dark:text-indigo-400"}>
                      {modelo === "recorrente" ? "Recorrente" : "Pontual"}
                    </span>
                    {!isTotal && <span className="text-gray-500 dark:text-zinc-400"> · {ESTADO_LABEL[estado] ?? estado}</span>}
                  </td>
                  <td className={td}>{g.metricas.n}</td>
                  <td className={td}>{isPont && unidade === "contrato" ? "—" : lt(g)}</td>
                  <td className={td}>{isPont && unidade === "cliente" ? ent(g) : "—"}</td>
                  <td className={td}>{formatCurrencyNoDecimals(ltv(g))}</td>
                  <td className={td}>{formatCurrencyNoDecimals(g.metricas.ltvTotal)}</td>
                  <td className={td}>{g.metricas.idadeMediaMeses}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
