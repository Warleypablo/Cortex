import { Skeleton } from "@/components/ui/skeleton";
import { Scorecard, type ScorecardModo } from "./scorecard/Scorecard";
import {
  useReportsMensal,
  useScorecardMetas,
  useScorecardResponsaveis,
  useSalvarResponsaveis,
  useChurnDetalhamento,
  useChurnProdutoMotivo,
  useChurnTaxaMensal,
  useChurnPontorrente,
  useEstoqueOverview,
  useLtLtvOverview,
  useLtLtvDist,
  useLtLtvClientes,
  useLtLtvEvolucaoProduto,
  useLtLtvEvolucaoClientes,
  useScorecardSeries,
  useBp2026ReconciliacaoTotal,
  useBp2026PontualTotal,
  useContribuicaoSquadRanking,
  useContribuicaoSquadBulk,
  useGeracaoCaixa,
} from "./hooks";
import { montarSecoesVisaoGeral } from "./SecaoVisaoGeral";
import { montarSecoesReceita } from "./SecaoReceita";
import { montarSecoesChurn } from "./SecaoChurn";
import { montarSecoesEntregas, type EstoqueOverview } from "./SecaoEntregas";
import { montarSecoesCapacity } from "./SecaoCapacity";
import { montarSecoesLtLtv } from "./SecaoLtLtv";
import { montarSecoesPerformance } from "./SecaoPerformance";
import type { ScorecardSection, ScorecardResponsavelItem } from "./scorecard/tipos";
import type { OverviewData, BucketDist, ClienteRow } from "@/components/lt-ltv-churn/types";

/** Aba "Consolidado": empilha TODAS as seções das 7 abas numa única tabela (mesmo componente
   Scorecard — a faixa navy de cada `ScorecardSection` já separa visualmente os blocos). Chama
   os mesmos hooks que cada `Secao*` individual chama e concatena o resultado das 7 funções
   puras `montarSecoes*` (extraídas de cada aba) na ordem das abas: Visão Geral, Receita, Churn,
   Entregas, Capacity, LT/LTV, Performance.

   Degradação graciosa: só `useReportsMensal` (fonte mais pesada, usada por 4 das 7 famílias)
   bloqueia a tela inteira com um skeleton geral enquanto carrega. Depois disso, cada família
   renderiza com o que tiver disponível — uma query isolada em erro/loading (churn, LT/LTV,
   capacity, séries) só deixa a família correspondente vazia (`montarSecoes*` já retorna [] ou
   omite linhas), nunca derruba as demais. */
export function SecaoConsolidado({ mes, modo }: { mes: string; modo: ScorecardModo }) {
  const rm = useReportsMensal(mes);
  const metas = useScorecardMetas(mes);
  const responsaveis = useScorecardResponsaveis();
  const salvarResponsaveis = useSalvarResponsaveis();

  const churnDet = useChurnDetalhamento(mes);
  const produtoMotivo = useChurnProdutoMotivo(mes);
  const taxaMensal = useChurnTaxaMensal(mes);
  const pontorrente = useChurnPontorrente(mes);
  const series = useScorecardSeries(mes);
  const contribuicaoSquad = useContribuicaoSquadRanking(mes);
  const contribuicaoSquadBulk = useContribuicaoSquadBulk(mes);
  const geracaoCaixa = useGeracaoCaixa();
  const reconciliacaoTotal = useBp2026ReconciliacaoTotal(mes);
  const pontualTotal = useBp2026PontualTotal();

  const estoqueQ = useEstoqueOverview();

  const overviewQ = useLtLtvOverview();
  const distQ = useLtLtvDist();
  const clientesQ = useLtLtvClientes();
  const evolucaoProdutoQ = useLtLtvEvolucaoProduto();
  const evolucaoClientesQ = useLtLtvEvolucaoClientes();

  function onEditResponsavel(metricaKey: string, valor: string) {
    const atuais = responsaveis.data?.itens ?? [];
    const atualizado: ScorecardResponsavelItem[] = [
      ...atuais.filter((i) => i.metrica_key !== metricaKey),
      { metrica_key: metricaKey, responsavel: valor },
    ];
    salvarResponsaveis.mutate(atualizado);
  }

  // Único bloqueio da tela inteira: /api/reports/mensal é a fonte mais pesada e alimenta 4 das
  // 7 famílias (Visão Geral, Receita, Entregas, Performance). As demais (churn/capacity/lt-ltv)
  // resolvem em paralelo e não precisam esperar por ela.
  if (rm.isLoading) {
    return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-56" />)}</div>;
  }

  const ltvOverview = overviewQ.data as OverviewData | undefined;
  const dist = (distQ.data as { ltv: BucketDist[]; lt: BucketDist[] } | undefined)?.ltv ?? [];
  const clientes = (clientesQ.data as { clientes: ClienteRow[] } | undefined)?.clientes ?? [];
  const estoque = estoqueQ.data as EstoqueOverview | undefined;

  // Onda F: mesma fonte de série já buscada nesta função para outras abas — evolucaoClientesQ
  // (LT/LTV) — reaproveitada aqui sem novo hook (evita duplicar chamadas de rede no Consolidado).
  const secoesVisaoGeral = rm.data
    ? montarSecoesVisaoGeral(
        rm.data,
        ltvOverview,
        evolucaoClientesQ.data?.serie,
      )
    : [];
  const secoesReceita = rm.data
    ? montarSecoesReceita(rm.data, mes, {
        reconciliacaoTotal: reconciliacaoTotal.data,
        pontualTotal: pontualTotal.data?.linhas,
      }, series.data)
    : [];
  const secoesChurn = churnDet.data
    ? montarSecoesChurn(churnDet.data, produtoMotivo.data, taxaMensal.data, pontorrente.data, series.data, rm.data, mes)
    : [];
  const secoesEntregas = rm.data ? montarSecoesEntregas(rm.data, estoque, series.data, mes) : [];
  const secoesCapacity = montarSecoesCapacity(
    { isError: series.isError, data: series.data },
    mes,
    { isError: contribuicaoSquad.isError, data: contribuicaoSquad.data },
    { isError: contribuicaoSquadBulk.isError, data: contribuicaoSquadBulk.data },
    { isError: geracaoCaixa.isError, data: geracaoCaixa.data },
  );
  const secoesLtLtv = ltvOverview
    ? montarSecoesLtLtv(
        ltvOverview,
        dist,
        clientes,
        { data: evolucaoProdutoQ.data, isLoading: evolucaoProdutoQ.isLoading, isError: evolucaoProdutoQ.isError },
        evolucaoClientesQ.data?.serie,
      )
    : [];
  const secoesPerformance = rm.data
    ? montarSecoesPerformance(rm.data, clientes, { data: series.data, isLoading: series.isLoading, isError: series.isError }, mes)
    : [];

  const todasSecoes: ScorecardSection[] = [
    ...secoesVisaoGeral,
    ...secoesReceita,
    ...secoesChurn,
    ...secoesEntregas,
    ...secoesCapacity,
    ...secoesLtLtv,
    ...secoesPerformance,
  ];

  return (
    <Scorecard
      secoes={todasSecoes}
      mes={mes}
      modo={modo}
      metas={metas.data?.metas ?? {}}
      responsaveis={responsaveis.data?.itens ?? []}
      onEditResponsavel={onEditResponsavel}
    />
  );
}
