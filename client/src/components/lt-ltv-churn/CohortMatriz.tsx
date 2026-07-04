import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";
import { fetchJson, buildUrl } from "./utils";
import { CohortDetalhe, type CohortDrillRef } from "./CohortDetalhe";
import type { CohortMatrizData } from "./types";

interface Props {
  produto?: string;
}

type Unidade = "cliente" | "contrato";
type Modo = "pct" | "abs";
type Metrica = "qtd" | "mrr";

const MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function labelSafra(safra: string): string {
  const [ano, mes] = safra.split("-");
  return `${MESES_PT[Number(mes) - 1]}/${ano.slice(2)}`;
}

function fmtMrr(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(".", ",") + "M";
  if (v >= 1_000) return Math.round(v / 1_000) + "k";
  return String(Math.round(v));
}

export function CohortMatriz({ produto }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [unidade, setUnidade] = useState<Unidade>("cliente");
  const [modo, setModo] = useState<Modo>("pct");
  const [metrica, setMetrica] = useState<Metrica>("qtd");
  const [drill, setDrill] = useState<CohortDrillRef | null>(null);

  const { data } = useQuery({
    queryKey: ["/api/lt-ltv-churn/cohort", unidade, produto],
    queryFn: () =>
      fetchJson<CohortMatrizData>(
        buildUrl("/api/lt-ltv-churn/cohort", { unidade, produto })
      ),
  });

  // Escala divergente vermelho -> âmbar -> verde (0% -> 50% -> 100% de retenção),
  // interpolada por segmentos pra não atravessar o marrom. Alpha fixo por tema e
  // tinta fixa (escura no claro, clara no escuro) mantêm contraste >=4.5:1; o número
  // na célula segura a leitura pra daltônicos (verde-vermelho é o par crítico).
  const corCelula = (pct: number) => {
    const t = Math.max(0, Math.min(100, pct)) / 100;
    const vermelho = isDark ? [239, 68, 68] : [220, 38, 38]; // red-500 | red-600
    const ambar = [245, 158, 11]; // amber-500
    const verde = isDark ? [16, 185, 129] : [5, 150, 105]; // emerald-500 | emerald-600
    const [de, ate, f] = t < 0.5 ? [vermelho, ambar, t / 0.5] : [ambar, verde, (t - 0.5) / 0.5];
    const rgb = de.map((c, i) => Math.round(c + (ate[i] - c) * f)).join(",");
    return {
      backgroundColor: `rgba(${rgb},${isDark ? 0.45 : 0.55})`,
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
              variant={metrica === "qtd" ? "default" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setMetrica("qtd")}
            >
              Qtd
            </Button>
            <Button
              variant={metrica === "mrr" ? "default" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setMetrica("mrr")}
            >
              MRR
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
                    const baseQtd = s.cells[0] || 0;
                    const baseMrr = s.mrr[0] || 0;
                    return (
                      <tr key={s.safra}>
                        <td className="sticky left-0 z-10 whitespace-nowrap border border-gray-200 bg-white px-2 py-1 font-medium text-gray-900 dark:border-zinc-700/50 dark:bg-zinc-900 dark:text-zinc-100">
                          {labelSafra(s.safra)}
                        </td>
                        <td className="border border-gray-200 bg-gray-50 px-2 py-1 text-center font-medium text-gray-900 dark:border-zinc-700/50 dark:bg-zinc-800/50 dark:text-zinc-100">
                          {metrica === "qtd" ? baseQtd : fmtMrr(baseMrr)}
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
                          const mrr = s.mrr[off] || 0;
                          const pctQtd = baseQtd > 0 ? (n / baseQtd) * 100 : 0;
                          const pctMrr = baseMrr > 0 ? (mrr / baseMrr) * 100 : 0;
                          const pct = metrica === "qtd" ? pctQtd : pctMrr;
                          const valor =
                            modo === "pct"
                              ? `${Math.round(pct)}%`
                              : metrica === "qtd"
                                ? String(n)
                                : fmtMrr(mrr);
                          return (
                            <td
                              key={off}
                              style={corCelula(pct)}
                              className="border border-gray-200 p-0 text-center tabular-nums dark:border-zinc-700/50"
                            >
                              <button
                                type="button"
                                onClick={() => setDrill({ unidade, safra: s.safra, offset: off })}
                                style={{ color: "inherit" }}
                                className="h-full w-full cursor-pointer px-1 py-1 ring-inset hover:ring-2 hover:ring-gray-900/50 dark:hover:ring-white/60"
                                title={`${labelSafra(s.safra)} · M${off}: ${n} de ${baseQtd} ${unidade === "cliente" ? "clientes" : "contratos"} (${pctQtd.toFixed(1)}%) · MRR R$ ${Math.round(mrr).toLocaleString("pt-BR")} de R$ ${Math.round(baseMrr).toLocaleString("pt-BR")} (${pctMrr.toFixed(1)}%) — clique para auditar`}
                              >
                                {valor}
                              </button>
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
                  : "Safra = mês de início do contrato recorrente; vivo do início até o cancelamento."}{" "}
                {metrica === "mrr" &&
                  (unidade === "cliente"
                    ? "MRR = soma do Valor R dos contratos vivos no mês, incluindo contratos abertos depois da safra (expansão) — pode passar de 100%. "
                    : "MRR = soma do Valor R dos contratos da safra ainda vivos no mês. ")}
                Clique numa célula para auditar quem está vivo e quem saiu.
              </p>
              <div className="flex items-center gap-1.5">
                <span>0%</span>
                <div
                  className="h-2.5 w-24 rounded-sm"
                  style={{
                    background: isDark
                      ? "linear-gradient(to right, rgba(239,68,68,0.45), rgba(245,158,11,0.45), rgba(16,185,129,0.45))"
                      : "linear-gradient(to right, rgba(220,38,38,0.55), rgba(245,158,11,0.55), rgba(5,150,105,0.55))",
                  }}
                />
                <span>100%</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
      <CohortDetalhe drill={drill} produto={produto} onClose={() => setDrill(null)} />
    </Card>
  );
}
