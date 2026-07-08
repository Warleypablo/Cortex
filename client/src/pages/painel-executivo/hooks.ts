import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { paramsParaMes } from "./temporalidade";
import type { ReportsMensal, ChurnDetalhamento, ChurnProdutoMotivo, ChurnTaxaMensal } from "./tipos";
import type { ChurnPorResponsavel } from "@shared/schema";
import type { ChurnPontorrentePayload } from "@/components/churn-pontorrente/types";
import type { EvolucaoProdutoTabelaData, EvolucaoClientePonto } from "@/components/lt-ltv-churn/types";
import type {
  ScorecardMetasResponse,
  ScorecardResponsaveisResponse,
  ScorecardResponsavelItem,
  ScorecardSeriesResponse,
  DrillDetalhe,
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
// Histórico completo (todos os meses desde o 1º snapshot) — NÃO recebe `mes` (diferente das
// demais séries deste arquivo), a janela é definida no próprio backend (server/routes/
// ltLtvChurn.ts). Fonte da seção "LTV por produto (evolução)" de SecaoLtLtv.tsx (Onda3).
export function useLtLtvEvolucaoProduto() {
  return useQuery<EvolucaoProdutoTabelaData>({ queryKey: ["/api/lt-ltv-churn/evolucao-produto-tabela"], staleTime: STALE });
}
// Série mensal de LT/LTV ao nível de CLIENTE (mediana + média via PERCENTILE_CONT/AVG, base
// ativa) — server/routes/ltLtvChurn.ts:485-521. Mesmo padrão de useLtLtvEvolucaoProduto acima
// (sem `mes`, histórico completo definido no backend). Fonte de "LT mediano"/"LTV mediano/
// cliente" em SecaoLtLtv.tsx (Onda B1); já consumida (shape idêntico) por
// client/src/components/lt-ltv-churn/EvolucaoClientes.tsx.
export function useLtLtvEvolucaoClientes() {
  return useQuery<{ serie: EvolucaoClientePonto[] }>({ queryKey: ["/api/lt-ltv-churn/evolucao-clientes"], staleTime: STALE, retry: false });
}
export function useEstoqueOverview() { return useQuery({ queryKey: ["/api/estoque-pontual/overview"], staleTime: STALE }); }

// Scorecard executivo (Tasks 1-2: /api/scorecard/metas + /api/scorecard/responsaveis)
export function useScorecardMetas(mes: string) {
  return useQuery<ScorecardMetasResponse>({ queryKey: ["/api/scorecard/metas", { mes }], enabled: !!mes, staleTime: STALE });
}
export function useScorecardResponsaveis() {
  return useQuery<ScorecardResponsaveisResponse>({ queryKey: ["/api/scorecard/responsaveis"], staleTime: STALE });
}
// Séries mensais por dimensão (Onda2-A: /api/scorecard/series) — alimenta os breakdowns
// (produto/operador/squad) do modo Evolução em SecaoChurn/SecaoEntregas/SecaoCapacity.
export function useScorecardSeries(mes: string) {
  return useQuery<ScorecardSeriesResponse>({ queryKey: ["/api/scorecard/series", { mes }], enabled: !!mes, staleTime: STALE });
}
// Infra de drill genérico (Fase 1) — GET /api/scorecard/detalhe?tipo=&mes=&dim=&valor=. Estado
// do drill (o quê/quando abrir) mora no Scorecard (scorecard/Scorecard.tsx), não em cada Secao* —
// `params` null = drill fechado (`enabled` trava a query, mesmo padrão de useGestaoReceitaDetalhe).
export function useScorecardDetalhe(params: { tipo: string; mes: string; dim?: string; valor?: string } | null) {
  return useQuery<DrillDetalhe>({ queryKey: ["/api/scorecard/detalhe", params ?? {}], enabled: !!params, staleTime: STALE });
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

// Onda B2 (Receita): Upsell/Downsell de MRR + movimentos de Receita Pontual. Fontes reais
// (server/routes/bp2026.reconciliacao.ts e bp2026.ts) — divergem do endpoint único assumido
// inicialmente; ver bp2026PontualLinha() em SecaoReceita.tsx para o motivo de cada mapeamento.

// GET /api/bp2026/reconciliacao-total?mes=N (N = mês 1-12 do ano 2026). Só existe para 2026
// (todo o módulo bp2026 é hardcoded pro ano corrente do BP) — `enabled` trava fora desse ano.
export interface Bp2026ReconciliacaoTotalResponse {
  mes: number;
  upsell: number;
  upsellContratos: number;
  downsell: number;
  downsellContratos: number;
}
export function useBp2026ReconciliacaoTotal(mes: string) {
  const [ano, m] = mes.split("-").map(Number);
  return useQuery<Bp2026ReconciliacaoTotalResponse>({
    queryKey: ["/api/bp2026/reconciliacao-total", { mes: m }],
    enabled: !!mes && ano === 2026,
    staleTime: STALE,
    retry: false,
  });
}

// GET /api/bp2026/pontual-total — mesmo padrão de /api/bp2026/pontual-creators (server/routes/
// bp2026.ts), mas sem filtro de produto. Devolve a série do ANO INTEIRO (não aceita `mes`);
// quem consome indexa `linhas[].meses` pelo mês selecionado (ver SecaoReceita.tsx).
export interface Bp2026PontualMesPonto {
  mes: number;
  realizado: number | null;
}
export interface Bp2026PontualLinha {
  metrica: string;
  tipoAgregacao: "fluxo" | "estoque";
  meses: Bp2026PontualMesPonto[];
}
export interface Bp2026PontualTotalResponse {
  linhas: Bp2026PontualLinha[];
  mesCorrente: number;
  mesFechado: number;
}
export function useBp2026PontualTotal() {
  return useQuery<Bp2026PontualTotalResponse>({
    queryKey: ["/api/bp2026/pontual-total"],
    staleTime: STALE,
    retry: false,
  });
}

// Onda C1 (Capacity): Margem de Contribuição por squad — GET /api/contribuicao-squad/ranking
// (server/routes.ts:6565). Mesma query da DFC (getContribuicaoSquadDfc), reduzida a um ranking
// por squad + o total geral. Endpoint exige `dataInicio`/`dataFim` como data COMPLETA
// (YYYY-MM-DD, valida com regex) — diferente de `dataInicioFim` (que manda só "YYYY-MM"), por
// isso usamos `startEndDate` (mesmo helper de useChurnDetalhamento) e remapeamos os nomes dos
// params. `totais` do backend NÃO inclui `margem` (só soma receita/despesa/contribuicao/etc) —
// calculado no client a partir de `totais.contribuicao / totais.receita`.
export interface ContribuicaoSquadItem {
  squad: string;
  receita: number;
  despesa: number;
  resultadoBruto: number;
  impostos: number;
  contribuicao: number;
  margem: number;
}
export interface ContribuicaoSquadTotais {
  receita: number;
  despesa: number;
  resultadoBruto: number;
  impostos: number;
  contribuicao: number;
}
export interface ContribuicaoSquadRankingResponse {
  ranking: ContribuicaoSquadItem[];
  totais: ContribuicaoSquadTotais;
}
export function useContribuicaoSquadRanking(mes: string) {
  const { startDate, endDate } = paramsParaMes(mes).startEndDate;
  return useQuery<ContribuicaoSquadRankingResponse>({
    queryKey: ["/api/contribuicao-squad/ranking", { dataInicio: startDate, dataFim: endDate }],
    enabled: !!mes,
    staleTime: STALE,
    retry: false,
  });
}

// Onda E (Capacity): série mensal COMPLETA de Margem de Contribuição — GET
// /api/contribuicao-squad/dfc/bulk?ano=YYYY (server/routes.ts:5871). Ao contrário do ranking
// acima (só o período do mês selecionado, sem série), o bulk devolve os 12 meses do ANO de uma
// vez — usado para dar `serie` às linhas de Contribuição/Margem/Receita/Custos (Geral e por
// squad) no modo Evolução. O bulk devolve receita/despesa CRU por squad×mês; NÃO calcula
// impostos/contribuição/margem (a `despesa` já é sem impostos: folha (rh_pessoal) + freelancers
// + iFood) — a fórmula é fechada no client (ver serieContribuicaoGeral/PorSquad em
// scorecard/logica.ts), mesma fórmula do ranking (server/routes.ts:6610-6613).
export interface ContribuicaoSquadBulkDespesaMes {
  salarios: number;
  freelancers: number;
  ifood: number;
}
export interface ContribuicaoSquadBulkMes {
  mes: string; // YYYY-MM
  mesLabel: string;
  data: { totais: { receitaTotal: number } } | null;
}
export interface ContribuicaoSquadBulkResumo {
  squad: string;
  receitaTotal: number;
  porMes: number[]; // 12 posições, index 0 = janeiro
}
export interface ContribuicaoSquadBulkResponse {
  ano: number;
  squads: string[];
  meses: ContribuicaoSquadBulkMes[];
  resumoPorSquad: ContribuicaoSquadBulkResumo[];
  despesasMensais: Record<string, ContribuicaoSquadBulkDespesaMes>;
  despesasPorSquadMensais: Record<string, Record<string, ContribuicaoSquadBulkDespesaMes>>;
}
export function useContribuicaoSquadBulk(mes: string) {
  const ano = mes.slice(0, 4);
  return useQuery<ContribuicaoSquadBulkResponse>({
    queryKey: ["/api/contribuicao-squad/dfc/bulk", { ano }],
    enabled: !!mes,
    staleTime: STALE,
    retry: false,
  });
}

// Geração de Caixa (regime de CAIXA) — GET /api/investors-report/geracao-caixa (server/
// routes.ts:3662). Substitui, na Capacity, a antiga "Margem de Contribuição — Geral" (que somava
// só custos DIRETOS/parciais): aqui é receita recebida − TODAS as despesas pagas da DFC (folha +
// estrutura + impostos + sócios etc). Ignora `mes`/query params — o backend sempre devolve
// jan..último mês FECHADO do ano CORRENTE (exclui o mês parcial), sem aceitar `?ano=` (mesmo
// padrão "sem mes" de useLtLtvOverview/useEstoqueOverview acima).
export interface GeracaoCaixaMes {
  mes: string; // YYYY-MM
  mesLabel: string;
  receita: number;
  despesa: number;
  geracaoMes: number;
  caixaAcumulado: number;
}
export interface GeracaoCaixaResponse {
  ano: number;
  series: GeracaoCaixaMes[];
}
export function useGeracaoCaixa() {
  return useQuery<GeracaoCaixaResponse>({
    queryKey: ["/api/investors-report/geracao-caixa"],
    staleTime: STALE,
    retry: false,
  });
}
