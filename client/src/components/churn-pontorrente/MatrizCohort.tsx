import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import type { Jornada } from "./types";

type DimKey = "mes" | "produto" | "squad" | "responsavel";
const DIM_LABEL: Record<DimKey, string> = {
  mes: "Mês de início", produto: "Produto", squad: "Squad", responsavel: "Responsável",
};

type Metrica = "retencao" | "churn";

const SIT: Record<Jornada["situacaoFinal"], { label: string; cls: string }> = {
  entregue: { label: "Concluído", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  em_andamento: { label: "Em andamento", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  churn: { label: "Churn", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

function cohortKey(j: Jornada, dim: DimKey): string {
  if (dim === "mes") return j.dataInicioPrimeira ? j.dataInicioPrimeira.slice(0, 7) : "(sem data)";
  const v = dim === "produto" ? j.produto : dim === "squad" ? j.squad : j.responsavel;
  const t = (v ?? "").trim();
  return t === "" ? "(não informado)" : t;
}

const reached = (js: Jornada[], n: number) => js.filter((j) => j.nivelMax >= n).length;
const churnAt = (js: Jornada[], n: number) => js.filter((j) => j.nivelMax === n && j.situacaoFinal === "churn").length;
const churnAll = (js: Jornada[]) => js.filter((j) => j.situacaoFinal === "churn");

type Drill = { linha: string; kind: "safra" | "reached" | "churnAt" | "churnSafra"; nivel: number };

export function MatrizCohort({ jornadas }: { jornadas: Jornada[] }) {
  const [dim, setDim] = useState<DimKey>("mes");
  const [metrica, setMetrica] = useState<Metrica>("churn");
  const [drill, setDrill] = useState<Drill | null>(null);

  const maxNivel = jornadas.length ? Math.max(...jornadas.map((j) => j.nivelMax)) : 4;
  const niveis = Array.from({ length: maxNivel }, (_, i) => i + 1);

  const rowsMap = new Map<string, Jornada[]>();
  for (const j of jornadas) {
    const k = cohortKey(j, dim);
    (rowsMap.get(k) ?? rowsMap.set(k, []).get(k)!).push(j);
  }
  const linhas = Array.from(rowsMap.entries());
  if (dim === "mes") linhas.sort((a, b) => a[0].localeCompare(b[0]));
  else linhas.sort((a, b) => b[1].length - a[1].length);

  // escalas dos heatmaps
  const maxChurnCell = Math.max(0, ...linhas.flatMap(([, js]) => niveis.map((n) => churnAt(js, n))));
  const maxChurnSafra = Math.max(0, ...linhas.map(([, js]) => churnAll(js).length));
  const indigo = (pct: number) => `rgba(99,102,241,${(0.10 + (pct / 100) * 0.6).toFixed(2)})`;
  const red = (c: number, max: number) => (c > 0 && max > 0 ? `rgba(239,68,68,${(0.15 + (c / max) * 0.65).toFixed(2)})` : undefined);

  const drillList = drill
    ? (rowsMap.get(drill.linha) ?? [])
        .filter((j) =>
          drill.kind === "safra" ? true
          : drill.kind === "reached" ? j.nivelMax >= drill.nivel
          : drill.kind === "churnAt" ? j.nivelMax === drill.nivel && j.situacaoFinal === "churn"
          : j.situacaoFinal === "churn", // churnSafra
        )
        .sort((a, b) => b.valorp - a.valorp)
    : [];

  const drillTitle = (d: Drill) =>
    d.kind === "safra" ? `${d.linha} · safra completa`
    : d.kind === "reached" ? `${d.linha} · atingiram a Entrega ${d.nivel}`
    : d.kind === "churnAt" ? `${d.linha} · churn na Entrega ${d.nivel}`
    : `${d.linha} · churn da safra`;

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <CardTitle className="text-base">Cohort de continuidade</CardTitle>
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            {metrica === "churn"
              ? "Quantos churnaram em cada entrega, por safra — clique numa célula para ver os contratos"
              : "Quantos atingiram cada entrega, por safra — clique numa célula para ver os contratos"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-gray-200 dark:border-zinc-700">
            {(["churn", "retencao"] as const).map((m) => (
              <Button
                key={m} type="button" size="sm" variant={metrica === m ? "default" : "ghost"}
                className="rounded-none" onClick={() => setMetrica(m)}
              >
                {m === "churn" ? "Churn" : "Retenção"}
              </Button>
            ))}
          </div>
          <Select value={dim} onValueChange={(v) => setDim(v as DimKey)}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(DIM_LABEL) as DimKey[]).map((k) => (
                <SelectItem key={k} value={k}>{DIM_LABEL[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {linhas.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400 dark:text-zinc-500">Sem jornadas no filtro atual</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 dark:text-zinc-400">
                <th className="py-2 pr-2 text-left font-medium">{DIM_LABEL[dim]}</th>
                <th className="px-3 py-2 text-center font-medium">Jornadas</th>
                {niveis.map((n) => (
                  <th key={n} className="px-3 py-2 text-center font-medium">Entrega {n}</th>
                ))}
                <th className="px-3 py-2 text-center font-medium text-red-600 dark:text-red-400">Churn (safra)</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(([linha, js]) => {
                const total = js.length;
                const churned = churnAll(js);
                const churnValor = churned.reduce((a, j) => a + j.valorp, 0);
                return (
                  <tr key={linha} className="border-t border-gray-100 dark:border-zinc-800">
                    <td className="py-1.5 pr-2 text-left whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setDrill({ linha, kind: "safra", nivel: 0 })}
                        className="rounded px-1.5 py-1 text-left font-medium text-gray-700 transition hover:text-indigo-600 hover:underline dark:text-zinc-200 dark:hover:text-indigo-400"
                        title="Ver todos os contratos da safra (inclui churnados)"
                      >
                        {linha}
                      </button>
                    </td>
                    <td className="px-1.5 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => setDrill({ linha, kind: "safra", nivel: 0 })}
                        className="w-full rounded-md px-2 py-1.5 font-semibold tabular-nums text-gray-800 transition hover:ring-2 hover:ring-indigo-400 dark:text-zinc-100"
                        title="Ver todos os contratos da safra"
                      >
                        {total}
                      </button>
                    </td>
                    {niveis.map((n) => {
                      const isChurn = metrica === "churn";
                      const c = isChurn ? churnAt(js, n) : reached(js, n);
                      const pct = total > 0 ? Math.round((c / total) * 100) : 0;
                      const bg = isChurn ? red(c, maxChurnCell) : c > 0 ? indigo(pct) : undefined;
                      return (
                        <td key={n} className="px-1.5 py-1.5 text-center">
                          <button
                            type="button"
                            disabled={c === 0}
                            onClick={() => setDrill({ linha, kind: isChurn ? "churnAt" : "reached", nivel: n })}
                            style={{ backgroundColor: bg }}
                            className="w-full rounded-md px-2 py-1.5 tabular-nums transition hover:ring-2 hover:ring-indigo-400 disabled:cursor-default disabled:opacity-40"
                            title={isChurn ? `${c} churn na entrega ${n} — clique para ver` : `${c} de ${total} (${pct}%) — clique para ver`}
                          >
                            <span className="font-semibold text-gray-900 dark:text-zinc-100">{c}</span>
                            {!isChurn && <span className="ml-1 text-[10px] text-gray-600 dark:text-zinc-400">{pct}%</span>}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-1.5 py-1.5 text-center">
                      <button
                        type="button"
                        disabled={churned.length === 0}
                        onClick={() => setDrill({ linha, kind: "churnSafra", nivel: 0 })}
                        style={{ backgroundColor: red(churned.length, maxChurnSafra) }}
                        className="w-full rounded-md px-2 py-1.5 tabular-nums transition hover:ring-2 hover:ring-red-400 disabled:cursor-default disabled:opacity-40"
                        title="Ver os contratos churnados da safra"
                      >
                        <span className="font-semibold text-red-700 dark:text-red-300">{churned.length}</span>
                        {churnValor > 0 && (
                          <span className="ml-1 text-[10px] text-red-600/80 dark:text-red-400/80">{formatCurrencyNoDecimals(churnValor)}</span>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>

      <Dialog open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{drill ? drillTitle(drill) : ""}</DialogTitle>
            <DialogDescription>{drillList.length} contrato(s) — ordenado por valor pontual</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-center">Nível atual</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Valor pontual</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Squad</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drillList.map((j) => (
                  <TableRow key={`${j.idTask}-${j.produto}`}>
                    <TableCell>{j.nomeCliente ?? "—"}</TableCell>
                    <TableCell>{j.produto}</TableCell>
                    <TableCell className="text-center tabular-nums">{j.nivelMax}ª</TableCell>
                    <TableCell>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${SIT[j.situacaoFinal].cls}`}>
                        {SIT[j.situacaoFinal].label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrencyNoDecimals(j.valorp)}</TableCell>
                    <TableCell>{j.responsavel ?? "—"}</TableCell>
                    <TableCell>{j.squad ?? "—"}</TableCell>
                    <TableCell>{j.motivoCancelamento ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
