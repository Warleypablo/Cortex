// client/src/components/creators-modelo/TabelaLtLtv.tsx
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { AuditoriaClientesDrawer } from "./AuditoriaClientesDrawer";
import type { RedesignPayload, Grupo, Unidade, Agregador } from "./types";

const MODELOS: Array<{ modelo: "recorrente" | "pontual"; label: string; cor: string; barra: string }> = [
  { modelo: "recorrente", label: "Recorrente", cor: "text-sky-600 dark:text-sky-400", barra: "bg-sky-500" },
  { modelo: "pontual", label: "Pontual", cor: "text-indigo-600 dark:text-indigo-400", barra: "bg-indigo-500" },
];

export function TabelaLtLtv({ data, de, ate }: { data: RedesignPayload; de?: string; ate?: string }) {
  const [unidade, setUnidade] = useState<Unidade>("cliente");
  const [agregador, setAgregador] = useState<Agregador>("media");
  const [drawerModelo, setDrawerModelo] = useState<"recorrente" | "pontual" | null>(null);

  const grupos = data.tabela?.[unidade] ?? [];
  const total = (modelo: string): Grupo | undefined =>
    grupos.find((g) => g.modelo === modelo && g.estado === "total");

  const ltMeses = (g: Grupo) => (agregador === "media" ? g.metricas.ltMesesMedia : g.metricas.ltMesesMediana);
  const ltv = (g: Grupo) => (agregador === "media" ? g.metricas.ltvMedia : g.metricas.ltvMediana);

  // Lifetime = tempo de relação em meses (1ª compra → encerramento ou hoje), para os dois modelos.
  const lifetime = (g: Grupo): string => `${ltMeses(g)} meses`;

  const th = "px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-zinc-500";
  const thNum = th + " text-right";
  const td = "px-4 py-4 text-gray-900 dark:text-zinc-100";
  const tdNum = td + " text-right tabular-nums";
  const trig = "w-[140px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50";

  return (
    <>
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Creators (serviço) — LT &amp; LTV Recorrente × Pontual</CardTitle>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              {unidade === "cliente" ? "Por cliente" : "Por contrato"} · {agregador === "media" ? "Média" : "Mediana"}
              {" "}· LTV recorrente = realizado até hoje · LTV pontual = realizado (só entregas com status “entregue”)
              {" "}· Lifetime do pontual = nº de entregas entregues (1 entrega = 1 mês)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={unidade} onValueChange={(v) => setUnidade(v as Unidade)}>
              <SelectTrigger className={trig}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cliente">Por cliente</SelectItem>
                <SelectItem value="contrato">Por contrato</SelectItem>
              </SelectContent>
            </Select>
            <Select value={agregador} onValueChange={(v) => setAgregador(v as Agregador)}>
              <SelectTrigger className={trig}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="mediana">Mediana</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-zinc-700/50">
              <th className={th}>Modelo</th>
              <th className={thNum}>{unidade === "cliente" ? "Clientes" : "Contratos"}</th>
              <th className={thNum}>Lifetime</th>
              <th className={thNum}>LTV {agregador} / {unidade === "cliente" ? "cliente" : "contrato"}</th>
            </tr>
          </thead>
          <tbody>
            {MODELOS.map(({ modelo, label, cor, barra }) => {
              const g = total(modelo);
              if (!g) return null;
              return (
                <tr key={modelo} className="border-b border-gray-100 last:border-0 dark:border-zinc-800/50">
                  <td className={td}>
                    <span className="flex items-center gap-2">
                      <span className={`inline-block h-4 w-1 rounded-full ${barra}`} />
                      <span className={`font-semibold ${cor}`}>{label}</span>
                    </span>
                  </td>
                  <td className={tdNum}>
                    <button
                      onClick={() => setDrawerModelo(modelo)}
                      className="font-medium text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
                      title="Ver clientes e auditar entregas"
                    >
                      {g.metricas.n}
                    </button>
                  </td>
                  <td className={tdNum}>{lifetime(g)}</td>
                  <td className={`${tdNum} text-base font-bold`}>{formatCurrencyNoDecimals(ltv(g))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
    <AuditoriaClientesDrawer modelo={drawerModelo} de={de} ate={ate} onClose={() => setDrawerModelo(null)} />
    </>
  );
}
