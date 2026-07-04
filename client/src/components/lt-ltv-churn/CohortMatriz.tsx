import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";
import { fetchJson, buildUrl } from "./utils";
import type { CohortMatrizData } from "./types";

interface Props {
  produto?: string;
}

type Unidade = "cliente" | "contrato";
type Modo = "pct" | "abs";

const MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function labelSafra(safra: string): string {
  const [ano, mes] = safra.split("-");
  return `${MESES_PT[Number(mes) - 1]}/${ano.slice(2)}`;
}

export function CohortMatriz({ produto }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [unidade, setUnidade] = useState<Unidade>("cliente");
  const [modo, setModo] = useState<Modo>("pct");

  const { data } = useQuery({
    queryKey: ["/api/lt-ltv-churn/cohort", unidade, produto],
    queryFn: () =>
      fetchJson<CohortMatrizData>(
        buildUrl("/api/lt-ltv-churn/cohort", { unidade, produto })
      ),
  });

  // Escala sequencial de um matiz só (emerald): alpha cresce com a retenção.
  // Tinta fixa por tema (escura no claro, clara no escuro) mantém contraste >=4.5:1
  // em toda a rampa; no escuro o alpha é limitado pra célula cheia não clarear demais.
  const corCelula = (pct: number) => {
    const alpha = isDark ? 0.08 + 0.57 * (pct / 100) : 0.06 + 0.74 * (pct / 100);
    const rgb = isDark ? "16,185,129" : "5,150,105";
    return {
      backgroundColor: `rgba(${rgb},${alpha.toFixed(3)})`,
      color: isDark ? "rgb(244,244,245)" : "rgb(31,41,55)", // zinc-100 | gray-800
    };
  };

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">
          Cohort de retenção {unidade === "cliente" ? "por cliente" : "por contrato"}
        </CardTitle>
        <div className="flex items-center gap-3">
          <div className="flex items-center overflow-hidden rounded-md border border-gray-200 dark:border-zinc-700/50">
            <Button
              variant={unidade === "cliente" ? "default" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setUnidade("cliente")}
            >
              Por cliente
            </Button>
            <Button
              variant={unidade === "contrato" ? "default" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setUnidade("contrato")}
            >
              Por contrato
            </Button>
          </div>
          <div className="flex items-center overflow-hidden rounded-md border border-gray-200 dark:border-zinc-700/50">
            <Button
              variant={modo === "pct" ? "default" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setModo("pct")}
            >
              %
            </Button>
            <Button
              variant={modo === "abs" ? "default" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setModo("abs")}
            >
              Nº
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!data ? (
          <div className="h-64 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 min-w-[72px] border border-gray-200 bg-white px-2 py-1.5 text-left font-semibold text-gray-700 dark:border-zinc-700/50 dark:bg-zinc-900 dark:text-zinc-300">
                      Safra
                    </th>
                    <th className="min-w-[52px] border border-gray-200 bg-gray-50 px-2 py-1.5 text-center font-semibold text-gray-700 dark:border-zinc-700/50 dark:bg-zinc-800/50 dark:text-zinc-300">
                      Base
                    </th>
                    {Array.from({ length: data.maxOffset + 1 }, (_, i) => (
                      <th
                        key={i}
                        className="min-w-[44px] border border-gray-200 px-2 py-1.5 text-center font-semibold text-gray-600 dark:border-zinc-700/50 dark:text-zinc-400"
                      >
                        M{i}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.safras.map((s) => {
                    const base = s.cells[0] || 0;
                    return (
                      <tr key={s.safra}>
                        <td className="sticky left-0 z-10 whitespace-nowrap border border-gray-200 bg-white px-2 py-1 font-medium text-gray-900 dark:border-zinc-700/50 dark:bg-zinc-900 dark:text-zinc-100">
                          {labelSafra(s.safra)}
                        </td>
                        <td className="border border-gray-200 bg-gray-50 px-2 py-1 text-center font-medium text-gray-900 dark:border-zinc-700/50 dark:bg-zinc-800/50 dark:text-zinc-100">
                          {base}
                        </td>
                        {Array.from({ length: data.maxOffset + 1 }, (_, off) => {
                          if (off >= s.cells.length) {
                            // Mês ainda no futuro para esta safra.
                            return (
                              <td
                                key={off}
                                className="border border-gray-200 bg-gray-50/50 dark:border-zinc-700/50 dark:bg-zinc-800/20"
                              />
                            );
                          }
                          const n = s.cells[off];
                          const pct = base > 0 ? (n / base) * 100 : 0;
                          return (
                            <td
                              key={off}
                              style={corCelula(pct)}
                              className="border border-gray-200 px-1 py-1 text-center tabular-nums dark:border-zinc-700/50"
                              title={`${labelSafra(s.safra)} · M${off}: ${n} de ${base} ${unidade === "cliente" ? "clientes" : "contratos"} (${pct.toFixed(1)}%)`}
                            >
                              {modo === "pct" ? `${Math.round(pct)}%` : n}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-zinc-400">
              <p>
                {unidade === "cliente"
                  ? "Safra = mês do 1º contrato recorrente do cliente; vivo enquanto tiver ≥1 contrato recorrente ativo no mês."
                  : "Safra = mês de início do contrato recorrente; vivo do início até o cancelamento."}
              </p>
              <div className="flex items-center gap-1.5">
                <span>0%</span>
                <div
                  className="h-2.5 w-24 rounded-sm"
                  style={{
                    background: isDark
                      ? "linear-gradient(to right, rgba(16,185,129,0.08), rgba(16,185,129,0.65))"
                      : "linear-gradient(to right, rgba(5,150,105,0.06), rgba(5,150,105,0.8))",
                  }}
                />
                <span>100%</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
