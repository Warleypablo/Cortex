import { useQuery } from "@tanstack/react-query";
import { paramsParaMes } from "./temporalidade";
import type { ReportsMensal, ChurnDetalhamento } from "./tipos";

const STALE = 5 * 60 * 1000;

// Mensal principal (endpoint pesado → staleTime alto)
export function useReportsMensal(mes: string) {
  return useQuery<ReportsMensal>({ queryKey: ["/api/reports/mensal", { mes }], enabled: !!mes, staleTime: STALE });
}
export function useGestaoReceita(mes: string) {
  const { de, ate } = paramsParaMes(mes).deAte;
  return useQuery({ queryKey: ["/api/gestao/receita", { de, ate }], enabled: !!mes, staleTime: STALE });
}
export function useGestaoReceitaDetalhe(params: Record<string, string> | null) {
  return useQuery({ queryKey: ["/api/gestao/receita/detalhe", params ?? {}], enabled: !!params, staleTime: STALE });
}
export function useChurnDetalhamento(mes: string) {
  const { startDate, endDate } = paramsParaMes(mes).startEndDate;
  return useQuery<ChurnDetalhamento>({ queryKey: ["/api/analytics/churn-detalhamento", { startDate, endDate }], enabled: !!mes, staleTime: STALE });
}
export function useChurnProdutoMotivo(mes: string) {
  const { dataInicio, dataFim } = paramsParaMes(mes).dataInicioFim;
  return useQuery({ queryKey: ["/api/churn/produto-motivo", { dataInicio, dataFim }], enabled: !!mes, staleTime: STALE });
}
export function useChurnTaxaMensal(mes: string) {
  const { dataInicio, dataFim } = paramsParaMes(mes).dataInicioFim;
  return useQuery({ queryKey: ["/api/churn/taxa-mensal", { dataInicio, dataFim }], enabled: !!mes, staleTime: STALE });
}
export function useChurnPorResponsavel(mes: string) {
  const { mesInicio, mesFim } = paramsParaMes(mes).mesInicioFim;
  return useQuery({ queryKey: ["/api/churn-por-responsavel", { mesInicio, mesFim }], enabled: !!mes, staleTime: STALE });
}
export function useChurnPontorrente(mes: string) {
  const { de, ate } = paramsParaMes(mes).deAte;
  return useQuery({ queryKey: ["/api/churn-pontorrente", { de, ate }], enabled: !!mes, staleTime: STALE });
}
export function useCeoDashboard(mes: string) {
  return useQuery({ queryKey: ["/api/ceo-dashboard", { mes }], enabled: !!mes, staleTime: STALE, retry: false });
}
// Snapshot atual (ignoram mês)
export function useLtLtvOverview() { return useQuery({ queryKey: ["/api/lt-ltv-churn/overview"], staleTime: STALE }); }
export function useLtLtvDist() { return useQuery({ queryKey: ["/api/lt-ltv-churn/dist-clientes"], staleTime: STALE }); }
export function useLtLtvClientes() { return useQuery({ queryKey: ["/api/lt-ltv-churn/clientes", { sort: "ltvTotal", dir: "desc", page: "1" }], staleTime: STALE }); }
export function useEstoqueOverview() { return useQuery({ queryKey: ["/api/estoque-pontual/overview"], staleTime: STALE }); }
export function useEstoquePorProduto() { return useQuery({ queryKey: ["/api/estoque-pontual/por-produto"], staleTime: STALE }); }
export function useCapacityTimes() { return useQuery({ queryKey: ["/api/capacity-times"], staleTime: STALE }); }
