import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { paramsParaMes } from "./temporalidade";
import type { ReportsMensal, ChurnDetalhamento, ChurnProdutoMotivo, ChurnTaxaMensal } from "./tipos";
import type { ChurnPorResponsavel } from "@shared/schema";
import type { ChurnPontorrentePayload } from "@/components/churn-pontorrente/types";
import type {
  ScorecardMetasResponse,
  ScorecardResponsaveisResponse,
  ScorecardResponsavelItem,
} from "./scorecard/tipos";

const STALE = 5 * 60 * 1000;

// Mensal principal (endpoint pesado → staleTime alto)
export function useReportsMensal(mes: string) {
  return useQuery<ReportsMensal>({ queryKey: ["/api/reports/mensal", { mes }], enabled: !!mes, staleTime: STALE });
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
  return useQuery<ChurnProdutoMotivo>({ queryKey: ["/api/churn/produto-motivo", { dataInicio, dataFim }], enabled: !!mes, staleTime: STALE });
}
export function useChurnTaxaMensal(mes: string) {
  // GOTCHA: paramsParaMes(mes).dataInicioFim manda dataInicio=dataFim=mes, o que faz o endpoint
  // (generate_series de X até X) devolver 1 linha só — inútil para o mini-gráfico de série.
  // Construímos aqui uma janela de 12 meses terminando em `mes` (mesmo padrão do gráfico
  // "Receita × Churn — 12 meses" da Visão Geral, que usa uma série pronta do /api/reports/mensal).
  const [ano, m] = mes.split("-").map(Number);
  const inicio = new Date(ano, m - 1 - 11, 1);
  const dataInicio = `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, "0")}`;
  return useQuery<ChurnTaxaMensal>({ queryKey: ["/api/churn/taxa-mensal", { dataInicio, dataFim: mes }], enabled: !!mes, staleTime: STALE });
}
export function useChurnPorResponsavel(mes: string) {
  const { mesInicio, mesFim } = paramsParaMes(mes).mesInicioFim;
  return useQuery<ChurnPorResponsavel[]>({ queryKey: ["/api/churn-por-responsavel", { mesInicio, mesFim }], enabled: !!mes, staleTime: STALE });
}
export function useChurnPontorrente(mes: string) {
  const { de, ate } = paramsParaMes(mes).deAte;
  return useQuery<ChurnPontorrentePayload>({ queryKey: ["/api/churn-pontorrente", { de, ate }], enabled: !!mes, staleTime: STALE });
}
export function useCeoDashboard(mes: string) {
  return useQuery({ queryKey: ["/api/ceo-dashboard", { mes }], enabled: !!mes, staleTime: STALE, retry: false });
}
// Snapshot atual (ignoram mês)
export function useLtLtvOverview() { return useQuery({ queryKey: ["/api/lt-ltv-churn/overview"], staleTime: STALE }); }
export function useLtLtvDist() { return useQuery({ queryKey: ["/api/lt-ltv-churn/dist-clientes"], staleTime: STALE }); }
export function useLtLtvClientes() { return useQuery({ queryKey: ["/api/lt-ltv-churn/clientes", { sort: "ltvTotal", dir: "desc", page: "1" }], staleTime: STALE }); }
export function useEstoqueOverview() { return useQuery({ queryKey: ["/api/estoque-pontual/overview"], staleTime: STALE }); }
export function useCapacityTimes() { return useQuery({ queryKey: ["/api/capacity-times"], staleTime: STALE }); }

// Scorecard executivo (Tasks 1-2: /api/scorecard/metas + /api/scorecard/responsaveis)
export function useScorecardMetas(mes: string) {
  return useQuery<ScorecardMetasResponse>({ queryKey: ["/api/scorecard/metas", { mes }], enabled: !!mes, staleTime: STALE });
}
export function useScorecardResponsaveis() {
  return useQuery<ScorecardResponsaveisResponse>({ queryKey: ["/api/scorecard/responsaveis"], staleTime: STALE });
}
export function useSalvarResponsaveis() {
  return useMutation({
    mutationFn: async (itens: ScorecardResponsavelItem[]) => {
      const res = await apiRequest("PUT", "/api/scorecard/responsaveis", { itens });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scorecard/responsaveis"] });
    },
  });
}

// Responsáveis reais (carteira de contratos ativos) para o dropdown de atribuição manual
// do Scorecard (CelulaResponsavel, Task 4). Mesmo endpoint já usado por CapacityMetaDialog.
export interface ScorecardResponsavelOption {
  responsavel: string;
  contratos: number;
  mrr: number;
}
export function useResponsaveisDisponiveis() {
  return useQuery<ScorecardResponsavelOption[]>({ queryKey: ["/api/capacity-metas/responsaveis"], staleTime: STALE });
}
