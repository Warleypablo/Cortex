import { Scorecard, type ScorecardModo } from "./scorecard/Scorecard";
import {
  useCeoDashboard,
  useScorecardMetas,
  useScorecardResponsaveis,
  useSalvarResponsaveis,
  useScorecardSeries,
  useContribuicaoSquadRanking,
  type ContribuicaoSquadRankingResponse,
} from "./hooks";
import { linhasPorDimensao, linhasReceitaCabeca } from "./scorecard/logica";
import { formatPercent } from "@/lib/utils";
import type { CeoKpi } from "@/components/ceo/CeoKpiCard";
import type { ScorecardSection, ScorecardRow, ScorecardResponsavelItem, ScorecardSeriesResponse } from "./scorecard/tipos";

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Onda C2: aviso de não-reconciliação exibido nas 2 seções de "Receita por Cabeça" por
   dimensão — usam MRR ativo + entregas deploy ÷ headcount RH, uma base DIFERENTE da seção
   "Receita por Cabeça (mês)" geral acima (receita em CAIXA ÷ headcount total do
   /api/ceo-dashboard). Não são a mesma métrica reconciliada em granularidades diferentes. */
const AVISO_RECEITA_CABECA_DIMENSAO =
  'Base = MRR ativo + entregas pontuais (deploy) ÷ pessoas (rh_pessoal). NÃO reconcilia com o "Receita por Cabeça (mês)" geral acima, que usa receita em CAIXA ÷ headcount total.';

/** "YYYY-MM" → label curto (ex: "Jan") — mesmo padrão de `labelMesCurto` em SecaoChurn.tsx/
   SecaoEntregas.tsx (duplicado localmente, não há util compartilhado entre seções). */
function labelMesCurto(mes: string): string {
  const m = Number(mes.split("-")[1]);
  return MESES_ABREV[m - 1] ?? mes;
}

/** Chave estável para linhas derivadas de listas variáveis (pessoa por equipe/squad) — mesmo
   padrão de SecaoChurn.tsx (slug determinístico, não por índice de posição). */
function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export interface MontarSecoesCapacityCeo {
  isError: boolean;
  kpis: CeoKpi[] | undefined;
}
export interface MontarSecoesCapacitySeries {
  isError: boolean;
  data: ScorecardSeriesResponse | undefined;
}
export interface MontarSecoesCapacityContribuicao {
  isError: boolean;
  data: ContribuicaoSquadRankingResponse | undefined;
}

/** Função pura: monta as seções de Capacity a partir dos payloads já resolvidos. `ceo`/`series`
   carregam o `isError` de cada query (além dos dados) porque o texto exibido distingue erro de
   loading (mesmo comportamento do componente original). Extraída de SecaoCapacity para reuso
   pela aba Consolidado.
   Onda4: a seção "Capacity por squad (snapshot)" (achatada por pessoa a partir de
   GET /api/capacity-times) foi REMOVIDA por ser redundante com "MRR por operador (evolução)"
   abaixo — mesma granularidade (pessoa), mas esta já tem série mensal real; a snapshot só
   repetia o último ponto. Por isso `capacity`/`CapacityTimesResponse` saíram da assinatura. */
export function montarSecoesCapacity(
  ceo: MontarSecoesCapacityCeo,
  series: MontarSecoesCapacitySeries,
  mes: string,
  contribuicao: MontarSecoesCapacityContribuicao,
): ScorecardSection[] {
  // /api/ceo-dashboard exige permissão de CEO (403 para os demais papéis; useCeoDashboard já
  // usa retry:false). Isolado: a linha mostra atual=null + aviso, sem derrubar a aba inteira.
  const receitaCabecaValor = ceo.isError ? null : (ceo.kpis?.find((k) => k.key === "receita_cabeca")?.valor ?? null);

  const secaoReceitaCabeca: ScorecardSection = {
    id: "capacity-receita-cabeca",
    titulo: "Receita por Cabeça (mês)",
    linhas: [
      {
        key: "capacity_receita_cabeca",
        metrica: "Receita / Cabeça",
        sub: ceo.isError ? "requer permissão CEO" : undefined,
        atual: receitaCabecaValor,
        formato: "brl",
        // /api/scorecard/metas já devolve o override fixo (R$ 20.000, direction "up") p/ esta chave.
        metaKey: "receita_cabeca",
        temporalidade: "mes",
      },
    ],
  };

  // Onda C2: Receita por Cabeça por squad/operador — (MRR ativo + entregas pontuais deploy) ÷
  // headcount, com série mensal real (mesma fonte de "MRR por squad/operador (evolução)" abaixo
  // + entregas). Denominador de squad = headcount RH casado por `pessoasPorSquad` (constante,
  // não série); de operador = 1 (o próprio operador). NÃO reconcilia com "Receita por Cabeça
  // (mês)" geral acima — ver `AVISO_RECEITA_CABECA_DIMENSAO`.
  const receitaCabecaSquadRows: ScorecardRow[] = linhasReceitaCabeca(
    series.data?.series.mrrPorSquad,
    series.data?.series.entregasPorSquad,
    mes,
    {
      keyFn: (dim) => `capacity_receita_cabeca_squad_${slug(dim)}`,
      labelMes: labelMesCurto,
      pessoasPorDim: (dim) => series.data?.series.pessoasPorSquad?.[dim],
    },
  );
  const secaoReceitaCabecaSquad: ScorecardSection = {
    id: "capacity-receita-cabeca-squad",
    titulo: "Receita por Cabeça — por squad",
    subtitulo: series.isError
      ? "falha ao carregar série por squad"
      : AVISO_RECEITA_CABECA_DIMENSAO,
    linhas: receitaCabecaSquadRows,
  };

  const receitaCabecaOperadorRows: ScorecardRow[] = linhasReceitaCabeca(
    series.data?.series.mrrPorOperador,
    series.data?.series.entregasPorOperador,
    mes,
    {
      keyFn: (dim) => `capacity_receita_cabeca_operador_${slug(dim)}`,
      labelMes: labelMesCurto,
      pessoasPorDim: () => 1,
      top: 10,
      responsavelAuto: true,
    },
  );
  const secaoReceitaCabecaOperador: ScorecardSection = {
    id: "capacity-receita-cabeca-operador",
    titulo: "Receita por Cabeça — por operador",
    subtitulo: series.isError
      ? "falha ao carregar série por operador"
      : AVISO_RECEITA_CABECA_DIMENSAO,
    linhas: receitaCabecaOperadorRows,
  };

  // Onda C1: Margem de Contribuição (Geral + por squad) — GET /api/contribuicao-squad/ranking.
  // Sem série (o endpoint devolve só o período selecionado, não uma janela mensal) — mesma
  // limitação de "Receita por Cabeça" acima.
  const totaisContribuicao = contribuicao.data?.totais;
  const margemGeral =
    totaisContribuicao && totaisContribuicao.receita > 0
      ? (totaisContribuicao.contribuicao / totaisContribuicao.receita) * 100
      : null;

  const secaoContribuicaoGeral: ScorecardSection = {
    id: "capacity-contribuicao-geral",
    titulo: "Margem de Contribuição — Geral (mês)",
    subtitulo: contribuicao.isError
      ? "falha ao carregar margem de contribuição"
      : !totaisContribuicao
        ? "carregando…"
        : undefined,
    linhas: totaisContribuicao
      ? [
          {
            key: "capacity_contribuicao_geral_brl",
            metrica: "Contribuição (R$)",
            atual: totaisContribuicao.contribuicao,
            formato: "brl",
            temporalidade: "mes",
          },
          {
            key: "capacity_contribuicao_geral_margem",
            metrica: "Margem %",
            atual: margemGeral,
            formato: "pct",
            temporalidade: "mes",
          },
          {
            key: "capacity_contribuicao_geral_receita",
            metrica: "Receita",
            atual: totaisContribuicao.receita,
            formato: "brl",
            temporalidade: "mes",
          },
          {
            key: "capacity_contribuicao_geral_custos",
            metrica: "Custos",
            atual: totaisContribuicao.despesa,
            formato: "brl",
            temporalidade: "mes",
          },
        ]
      : [],
  };

  const rankingContribuicao = (contribuicao.data?.ranking ?? [])
    .slice()
    .sort((a, b) => b.contribuicao - a.contribuicao);
  const contribuicaoSquadRows: ScorecardRow[] = rankingContribuicao.map((item) => ({
    key: `capacity_contribuicao_squad_${slug(item.squad)}`,
    metrica: item.squad,
    sub: `Margem ${formatPercent(item.margem, 1)}`,
    atual: item.contribuicao,
    formato: "brl",
    temporalidade: "mes",
  }));
  const secaoContribuicaoSquad: ScorecardSection = {
    id: "capacity-contribuicao-squad",
    titulo: "Margem de Contribuição por squad (mês)",
    // Nota metodológica (por squad, não por operador — custo/operador no backend é heurístico
    // e só funciona filtrando 1 pessoa por vez, inviável em lote).
    subtitulo: contribuicao.isError
      ? "falha ao carregar margem de contribuição"
      : contribuicaoSquadRows.length === 0
        ? "carregando…"
        : "custo = folha (rh_pessoal) + benefícios + freelas + impostos (18% da receita); margem por operador não é viável (heurística exige filtrar 1 pessoa por vez)",
    linhas: contribuicaoSquadRows,
  };

  // MRR por squad/operador com série real (Onda2-A) — ao contrário da seção "snapshot" abaixo
  // (achatada por pessoa, só o valor do momento), estas linhas têm `atual` E `serie` vindos do
  // MESMO endpoint (/api/scorecard/series), reconciliando o número do mês com o modo Evolução.
  const mrrSquadRows: ScorecardRow[] = linhasPorDimensao(series.data?.series.mrrPorSquad, mes, {
    keyFn: (dim) => `capacity_mrr_squad_${slug(dim)}`,
    formato: "brl",
    labelMes: labelMesCurto,
  });
  const mrrOperadorRows: ScorecardRow[] = linhasPorDimensao(series.data?.series.mrrPorOperador, mes, {
    keyFn: (dim) => `capacity_mrr_operador_${slug(dim)}`,
    formato: "brl",
    labelMes: labelMesCurto,
    top: 10,
    responsavelAuto: true,
  });
  const secaoMrrSquad: ScorecardSection = {
    id: "capacity-mrr-squad",
    titulo: "Capacity — MRR por squad (evolução)",
    subtitulo: series.isError
      ? "falha ao carregar série por squad"
      : mrrSquadRows.length === 0
        ? "carregando série…"
        : undefined,
    linhas: mrrSquadRows,
  };
  const secaoMrrOperador: ScorecardSection = {
    id: "capacity-mrr-operador",
    titulo: "Capacity — MRR por operador (evolução)",
    subtitulo: series.isError
      ? "falha ao carregar série por operador"
      : mrrOperadorRows.length === 0
        ? "carregando série…"
        : undefined,
    linhas: mrrOperadorRows,
  };

  return [
    secaoReceitaCabeca,
    secaoReceitaCabecaSquad,
    secaoReceitaCabecaOperador,
    secaoContribuicaoGeral,
    secaoContribuicaoSquad,
    secaoMrrSquad,
    secaoMrrOperador,
  ];
}

export function SecaoCapacity({ mes, modo }: { mes: string; modo: ScorecardModo }) {
  const ceo = useCeoDashboard(mes);
  // Série de MRR por squad/operador (Onda2-A) — fonte das 2 seções de evolução abaixo. Falha/
  // loading isolados (não bloqueiam a aba): linhasPorDimensao devolve [] sem `series.data`.
  const series = useScorecardSeries(mes);
  const contribuicao = useContribuicaoSquadRanking(mes);
  const metas = useScorecardMetas(mes);
  const responsaveis = useScorecardResponsaveis();
  const salvarResponsaveis = useSalvarResponsaveis();

  function onEditResponsavel(metricaKey: string, valor: string) {
    const atuais = responsaveis.data?.itens ?? [];
    const atualizado: ScorecardResponsavelItem[] = [
      ...atuais.filter((i) => i.metrica_key !== metricaKey),
      { metrica_key: metricaKey, responsavel: valor },
    ];
    salvarResponsaveis.mutate(atualizado);
  }

  const ceoKpis = (ceo.data as { kpis?: CeoKpi[] } | undefined)?.kpis;
  const secoes = montarSecoesCapacity(
    { isError: ceo.isError, kpis: ceoKpis },
    { isError: series.isError, data: series.data },
    mes,
    { isError: contribuicao.isError, data: contribuicao.data },
  );

  return (
    <div className="space-y-4">
      <Scorecard
        secoes={secoes}
        mes={mes}
        modo={modo}
        metas={metas.data?.metas ?? {}}
        responsaveis={responsaveis.data?.itens ?? []}
        onEditResponsavel={onEditResponsavel}
      />
    </div>
  );
}
