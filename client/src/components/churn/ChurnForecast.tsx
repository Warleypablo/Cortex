import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import {
  agregarForecast,
  type ForecastContrato,
  type ForecastResponse,
} from "./churnAggregations";
import { forecastRiskBadgeClass } from "./forecastRiskColor";

function formatDataCurta(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  } catch {
    return "—";
  }
}

export function ChurnForecast(): JSX.Element | null {
  const { data, isLoading, isError } = useQuery<ForecastResponse>({
    queryKey: ["/api/analytics/churn-forecast"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/churn-forecast");
      if (!res.ok) throw new Error("Failed to fetch churn forecast");
      return res.json();
    },
  });

  const [expandido, setExpandido] = useState<string | null>(null);

  const contratos = data?.contratos ?? [];
  const metricas = useMemo(() => agregarForecast(contratos), [contratos]);

  if (isLoading) {
    return (
      <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground animate-pulse rounded-xl border border-border bg-card">
        Carregando forecast...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          Forecast de Churn
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Não foi possível carregar o forecast. Tente recarregar a página.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      {/* Cabeçalho + faixa de valor exposto */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            Forecast de Churn
          </p>
          <p className="text-xs text-muted-foreground">
            Contratos em risco que ainda não pediram para sair · indicador antecedente
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {data?.riscoCalculadoEm
            ? `score de risco calculado em ${formatDataCurta(data.riscoCalculadoEm)}`
            : "score de risco não calculado"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <span className="text-muted-foreground">
          Em risco:{" "}
          <span className="font-semibold text-foreground">{metricas.total_clientes}</span> clientes
        </span>
        <span className="text-muted-foreground">
          MRR exposto:{" "}
          <span className="font-semibold text-red-600 dark:text-red-400">
            {formatCurrencyNoDecimals(metricas.mrr_exposto)}
          </span>
        </span>
        {metricas.pontual_exposto > 0 && (
          <span className="text-muted-foreground">
            Pontual:{" "}
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              {formatCurrencyNoDecimals(metricas.pontual_exposto)}
            </span>
          </span>
        )}
      </div>

      {/* Tabela */}
      {contratos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhum contrato em risco no forecast.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-700 text-left">
                <th className="py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 w-6"></th>
                <th className="py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">Cliente</th>
                <th className="py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">Responsável</th>
                <th className="py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 text-right whitespace-nowrap">MRR</th>
                <th className="py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 text-center whitespace-nowrap">Risco</th>
                <th className="py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">Retenção</th>
                <th className="py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">Saúde</th>
                <th className="py-2 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">Possib.</th>
              </tr>
            </thead>
            <tbody>
              {contratos.map((c) => {
                const isOpen = expandido === c.contrato_id;
                const temContexto = !!c.contexto_risco;
                return (
                  <React.Fragment key={c.contrato_id}>
                    <tr
                      className={`border-b border-gray-100 dark:border-zinc-800 ${temContexto ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50" : ""} transition-colors`}
                      onClick={() => temContexto && setExpandido(isOpen ? null : c.contrato_id)}
                    >
                      <td className="py-2 pr-3 text-gray-400 dark:text-zinc-600">
                        {temContexto ? (isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />) : null}
                      </td>
                      <td className="py-2 pr-3 text-gray-900 dark:text-white font-medium max-w-[180px] truncate" title={c.cliente}>
                        {c.cliente}
                      </td>
                      <td className="py-2 pr-3 text-gray-600 dark:text-zinc-400 max-w-[130px] truncate" title={c.responsavel ?? undefined}>
                        {c.responsavel || <span className="text-gray-400 dark:text-zinc-600">—</span>}
                      </td>
                      <td className="py-2 pr-3 text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                        {c.valorr ? formatCurrencyNoDecimals(c.valorr) : <span className="font-normal text-gray-400 dark:text-zinc-600">—</span>}
                      </td>
                      <td className="py-2 pr-3 text-center whitespace-nowrap">
                        {c.risco_tier ? (
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${forecastRiskBadgeClass(c.risco_tier)}`}>
                            {c.risco_tier}{c.risco_score !== null ? ` ${c.risco_score}` : ""}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-gray-600 dark:text-zinc-400 whitespace-nowrap">
                        {c.status_cancelamento || <span className="text-gray-400 dark:text-zinc-600">—</span>}
                      </td>
                      <td className="py-2 pr-3 text-gray-600 dark:text-zinc-400 whitespace-nowrap">
                        {c.status_conta || <span className="text-gray-400 dark:text-zinc-600">—</span>}
                      </td>
                      <td className="py-2 text-gray-600 dark:text-zinc-400 whitespace-nowrap">
                        {c.possibilidade_retencao || <span className="text-gray-400 dark:text-zinc-600">—</span>}
                      </td>
                    </tr>
                    {isOpen && temContexto && (
                      <tr className="border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/30">
                        <td></td>
                        <td colSpan={7} className="py-2 pr-3 text-xs text-gray-600 dark:text-zinc-400">
                          <span className="font-medium text-gray-500 dark:text-zinc-500">O que pode gerar churn: </span>
                          {c.contexto_risco}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
