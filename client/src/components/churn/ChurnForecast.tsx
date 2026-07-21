import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrencyNoDecimals } from "@/lib/utils";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import {
  agregarForecast,
  agruparPorTemperatura,
  type FaixaTemperatura,
  type TemperaturaId,
  type ForecastResponse,
} from "./churnAggregations";
import { forecastRiskBadgeClass, temperaturaTom } from "./forecastRiskColor";

/** Quantos contratos a faixa mostra antes de pedir "ver os outros N". */
const LIMITE_LINHAS = 15;

/** A partir de quantos dias o score de risco deixa de ser confiável. */
const DIAS_SCORE_DEFASADO = 30;

function formatDataCurta(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  } catch {
    return "—";
  }
}

function diasDesde(iso: string | null): number | null {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return null;
  return Math.floor((Date.now() - ts) / 86_400_000);
}

function Vazio(): JSX.Element {
  return <span className="text-gray-400 dark:text-zinc-600">—</span>;
}

/**
 * Uma faixa do accordion. Esconde as colunas que a própria faixa já determina:
 * dentro de "Insatisfeito" a coluna Saúde seria "Insatisfeito" em todas as
 * linhas, e fora de "Em negociação de saída" a coluna Retenção é sempre vazia.
 */
function BlocoFaixa({
  faixa,
  aberta,
  onToggle,
}: {
  faixa: FaixaTemperatura;
  aberta: boolean;
  onToggle: () => void;
}): JSX.Element {
  const [verTodos, setVerTodos] = useState(false);
  const [contextoAberto, setContextoAberto] = useState<string | null>(null);

  const tom = temperaturaTom(faixa.id);
  const mostraRetencao = faixa.id === "negociando";
  const mostraSaude = faixa.id === "negociando" || faixa.id === "fraco";

  const visiveis = verTodos ? faixa.contratos : faixa.contratos.slice(0, LIMITE_LINHAS);
  const ocultos = faixa.contratos.length - visiveis.length;
  const colSpanContexto = 4 + (mostraRetencao ? 1 : 0) + (mostraSaude ? 1 : 0);

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={aberta}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        {aberta ? (
          <ChevronDown className="w-4 h-4 shrink-0 text-gray-400 dark:text-zinc-500" />
        ) : (
          <ChevronRight className="w-4 h-4 shrink-0 text-gray-400 dark:text-zinc-500" />
        )}
        <span className={`w-2 h-2 rounded-full shrink-0 ${tom.ponto}`} />

        <span className="min-w-0">
          <span className="text-sm font-medium text-gray-900 dark:text-white">{faixa.titulo}</span>
          <span className="hidden lg:inline text-xs text-muted-foreground ml-2">· {faixa.criterio}</span>
        </span>

        <span className="flex-1" />

        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {faixa.contratos.length} {faixa.contratos.length === 1 ? "contrato" : "contratos"}
        </span>
        <span className={`text-sm font-semibold whitespace-nowrap tabular-nums w-24 text-right ${tom.valor}`}>
          {formatCurrencyNoDecimals(faixa.mrr)}
        </span>
        <span className="hidden sm:flex items-center gap-2 w-28 shrink-0">
          <span className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden">
            <span
              className={`block h-full rounded-full ${tom.barra}`}
              style={{ width: `${Math.round(faixa.participacaoMrr * 100)}%` }}
            />
          </span>
          <span className="text-[11px] text-muted-foreground tabular-nums w-8 text-right">
            {Math.round(faixa.participacaoMrr * 100)}%
          </span>
        </span>
      </button>

      {aberta && (
        <div className="border-t border-border/60 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-700 text-left bg-gray-50/50 dark:bg-zinc-800/30">
                <th className="py-2 pl-3 pr-3 font-medium text-gray-600 dark:text-zinc-400 w-6"></th>
                <th className="py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">Cliente</th>
                <th className="py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">Responsável</th>
                <th className="py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 text-right whitespace-nowrap">MRR</th>
                {mostraRetencao && (
                  <th className="py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">Retenção</th>
                )}
                {mostraSaude && (
                  <th className="py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">Saúde</th>
                )}
                <th className="py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">Possib.</th>
                <th className="py-2 pr-3 font-medium text-gray-600 dark:text-zinc-400 text-center whitespace-nowrap">Risco</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((c) => {
                const isOpen = contextoAberto === c.contrato_id;
                const temContexto = !!c.contexto_risco;
                return (
                  <React.Fragment key={c.contrato_id}>
                    <tr
                      className={`border-b border-gray-100 dark:border-zinc-800 ${temContexto ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50" : ""} transition-colors`}
                      onClick={() => temContexto && setContextoAberto(isOpen ? null : c.contrato_id)}
                    >
                      <td className="py-2 pl-3 pr-3 text-gray-400 dark:text-zinc-600">
                        {temContexto ? (isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />) : null}
                      </td>
                      <td className="py-2 pr-3 text-gray-900 dark:text-white font-medium max-w-[180px] truncate" title={c.cliente}>
                        {c.cliente}
                      </td>
                      <td className="py-2 pr-3 text-gray-600 dark:text-zinc-400 max-w-[130px] truncate" title={c.responsavel ?? undefined}>
                        {c.responsavel || <Vazio />}
                      </td>
                      <td className="py-2 pr-3 text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap tabular-nums">
                        {c.valorr ? formatCurrencyNoDecimals(c.valorr) : <Vazio />}
                      </td>
                      {mostraRetencao && (
                        <td className="py-2 pr-3 text-gray-600 dark:text-zinc-400 whitespace-nowrap">
                          {c.status_cancelamento || <Vazio />}
                        </td>
                      )}
                      {mostraSaude && (
                        <td className="py-2 pr-3 text-gray-600 dark:text-zinc-400 whitespace-nowrap">
                          {c.status_conta || <Vazio />}
                        </td>
                      )}
                      <td className="py-2 pr-3 text-gray-600 dark:text-zinc-400 whitespace-nowrap">
                        {c.possibilidade_retencao || <Vazio />}
                      </td>
                      <td className="py-2 pr-3 text-center whitespace-nowrap">
                        {c.risco_tier ? (
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${forecastRiskBadgeClass(c.risco_tier)}`}>
                            {c.risco_tier}{c.risco_score !== null ? ` ${c.risco_score}` : ""}
                          </span>
                        ) : (
                          <Vazio />
                        )}
                      </td>
                    </tr>
                    {isOpen && temContexto && (
                      <tr className="border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/30">
                        <td></td>
                        <td colSpan={colSpanContexto} className="py-2 pr-3 text-xs text-gray-600 dark:text-zinc-400">
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

          {ocultos > 0 && (
            <button
              type="button"
              onClick={() => setVerTodos(true)}
              className="w-full py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              ver os outros {ocultos} contratos
            </button>
          )}
        </div>
      )}
    </div>
  );
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

  // null = ninguém clicou ainda; a faixa mais quente abre sozinha.
  const [abertasManual, setAbertasManual] = useState<Set<TemperaturaId> | null>(null);

  const contratos = data?.contratos ?? [];
  const metricas = useMemo(() => agregarForecast(contratos), [contratos]);
  const faixas = useMemo(() => agruparPorTemperatura(contratos), [contratos]);

  const abertas = abertasManual ?? new Set(faixas.length > 0 ? [faixas[0].id] : []);
  const toggleFaixa = (id: TemperaturaId) => {
    const proximo = new Set(abertas);
    if (proximo.has(id)) proximo.delete(id);
    else proximo.add(id);
    setAbertasManual(proximo);
  };

  const diasScore = diasDesde(data?.riscoCalculadoEm ?? null);
  const scoreDefasado = diasScore !== null && diasScore > DIAS_SCORE_DEFASADO;

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
      {/* Cabeçalho + carimbo do score */}
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
        {data?.riscoCalculadoEm ? (
          <p
            className={`text-[11px] flex items-center gap-1 ${scoreDefasado ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}
            title={scoreDefasado ? `O score de risco não é recalculado há ${diasScore} dias — a coluna Risco não reflete contratos novos.` : undefined}
          >
            {scoreDefasado && <AlertTriangle className="w-3 h-3" />}
            {scoreDefasado ? "score defasado · " : "score de risco "}
            calculado em {formatDataCurta(data.riscoCalculadoEm)}
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">score de risco não calculado</p>
        )}
      </div>

      {/* Faixa-resumo da exposição total */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <span className="text-muted-foreground">
          <span className="font-semibold text-foreground">{metricas.total_contratos}</span> contratos
        </span>
        <span className="text-muted-foreground">
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

      {/* Faixas por temperatura — a mais quente já abre */}
      {faixas.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhum contrato em risco no forecast.
        </p>
      ) : (
        <div className="space-y-2">
          {faixas.map((faixa) => (
            <BlocoFaixa
              key={faixa.id}
              faixa={faixa}
              aberta={abertas.has(faixa.id)}
              onToggle={() => toggleFaixa(faixa.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
