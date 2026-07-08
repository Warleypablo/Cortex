import { Scorecard, type ScorecardModo } from "./scorecard/Scorecard";
import {
  useScorecardMetas,
  useScorecardResponsaveis,
  useSalvarResponsaveis,
  useScorecardSeries,
  useContribuicaoSquadRanking,
  useContribuicaoSquadBulk,
  useGeracaoCaixa,
  type ContribuicaoSquadRankingResponse,
  type ContribuicaoSquadBulkResponse,
  type GeracaoCaixaResponse,
} from "./hooks";
import {
  linhasPorDimensao,
  linhasReceitaCabeca,
  serieContribuicaoPorSquad,
  pontoContribuicaoNoMes,
  serieGeracaoCaixa,
  pontoGeracaoCaixaNoMes,
  encontrarSerieSquad,
  ehSquadOff,
} from "./scorecard/logica";
import { formatPercent } from "@/lib/utils";
import type { ScorecardSection, ScorecardRow, ScorecardResponsavelItem, ScorecardSeriePonto, ScorecardSeriesResponse } from "./scorecard/tipos";

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

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

export interface MontarSecoesCapacitySeries {
  isError: boolean;
  data: ScorecardSeriesResponse | undefined;
}
export interface MontarSecoesCapacityContribuicao {
  isError: boolean;
  data: ContribuicaoSquadRankingResponse | undefined;
}
/** Onda E: fonte da SÉRIE mensal de Margem de Contribuição (bulk do ano) — complementa
   `MontarSecoesCapacityContribuicao` acima, que só traz o período do mês selecionado (sem série).
   Falha/loading isolados: degrada para as linhas sem `serie` (ver uso abaixo). */
export interface MontarSecoesCapacityContribuicaoBulk {
  isError: boolean;
  data: ContribuicaoSquadBulkResponse | undefined;
}
/** Fonte da seção "Geração de Caixa (mês)" (GET /api/investors-report/geracao-caixa) — substitui
   a antiga "Margem de Contribuição — Geral" (custos parciais/diretos) por receita recebida −
   TODAS as despesas pagas da DFC. Falha/loading isolados: `pontoGeracaoCaixaNoMes` devolve null
   → linhas mostram "—" em vez de derrubar a seção. */
export interface MontarSecoesCapacityGeracaoCaixa {
  isError: boolean;
  data: GeracaoCaixaResponse | undefined;
}

/** Função pura: monta as seções de Capacity a partir dos payloads já resolvidos. Cada payload
   carrega o `isError` da query (além dos dados) porque o texto exibido distingue erro de
   loading (mesmo comportamento do componente original). Extraída de SecaoCapacity para reuso
   pela aba Consolidado.
   Onda4: a seção "Capacity por squad (snapshot)" (achatada por pessoa a partir de
   GET /api/capacity-times) foi REMOVIDA por ser redundante com "MRR por operador (evolução)"
   abaixo — mesma granularidade (pessoa), mas esta já tem série mensal real; a snapshot só
   repetia o último ponto. Por isso `capacity`/`CapacityTimesResponse` saíram da assinatura. */
export function montarSecoesCapacity(
  series: MontarSecoesCapacitySeries,
  mes: string,
  contribuicao: MontarSecoesCapacityContribuicao,
  contribuicaoBulk: MontarSecoesCapacityContribuicaoBulk,
  geracaoCaixa: MontarSecoesCapacityGeracaoCaixa,
): ScorecardSection[] {
  // Onda C2: Receita por Cabeça por squad/operador — (MRR ativo + entregas pontuais deploy) ÷
  // headcount, com série mensal real (mesma fonte de "MRR por squad/operador (evolução)" abaixo
  // + entregas). Denominador de squad = headcount RH casado por `pessoasPorSquad` (constante,
  // não série); de operador = 1 (o próprio operador). NÃO reconcilia com "Receita por Cabeça
  // (mês)" geral acima.
  const receitaCabecaSquadRows: ScorecardRow[] = linhasReceitaCabeca(
    series.data?.series.mrrPorSquad,
    series.data?.series.entregasPorSquad,
    mes,
    {
      keyFn: (dim) => `capacity_receita_cabeca_squad_${slug(dim)}`,
      labelMes: labelMesCurto,
      pessoasPorDim: (dim) => series.data?.series.pessoasPorSquad?.[dim],
    },
  ).filter((row) => !ehSquadOff(row.metrica));
  const secaoReceitaCabecaSquad: ScorecardSection = {
    id: "capacity-receita-cabeca-squad",
    titulo: "Receita por Cabeça — por squad",
    subtitulo: series.isError ? "falha ao carregar série por squad" : undefined,
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
    subtitulo: series.isError ? "falha ao carregar série por operador" : undefined,
    linhas: receitaCabecaOperadorRows,
  };

  // Geração de Caixa (regime de CAIXA) — GET /api/investors-report/geracao-caixa. Substitui a
  // antiga "Margem de Contribuição — Geral" (que somava só custos DIRETOS/parciais de squad, uma
  // base que confundia o leitor): receita recebida − TODAS as despesas pagas da DFC (folha +
  // estrutura + impostos + sócios etc), já fechada no backend. `pontoGeracaoCaixaNoMes` devolve
  // null quando a série está vazia (loading/erro do hook) → linhas mostram "—" em vez de quebrar.
  const serieGeracaoCaixaCalc = serieGeracaoCaixa(geracaoCaixa.data);
  const pontoGeracaoCaixaAtual = pontoGeracaoCaixaNoMes(serieGeracaoCaixaCalc, mes);
  const serieGeracaoCaixaMetrica = (
    campo: "receita" | "despesa" | "geracaoMes" | "conversaoPct" | "caixaAcumulado",
  ): ScorecardSeriePonto[] | undefined =>
    serieGeracaoCaixaCalc.length > 0
      ? serieGeracaoCaixaCalc.map((p) => ({ month: p.month, label: labelMesCurto(p.month), valor: p[campo] }))
      : undefined;

  const secaoGeracaoCaixa: ScorecardSection = {
    id: "capacity-geracao-caixa",
    titulo: "Geração de Caixa (mês)",
    subtitulo: geracaoCaixa.isError
      ? "falha ao carregar geração de caixa"
      : !pontoGeracaoCaixaAtual
        ? "carregando…"
        : undefined,
    linhas: [
      {
        key: "capacity_geracao_caixa_receita",
        metrica: "Receita (caixa)",
        atual: pontoGeracaoCaixaAtual?.receita ?? null,
        formato: "brl",
        serie: serieGeracaoCaixaMetrica("receita"),
        temporalidade: "mes",
      },
      {
        key: "capacity_geracao_caixa_despesa",
        metrica: "(−) Despesas (DFC)",
        sub: "todas as despesas pagas no mês (folha, estrutura, impostos, sócios)",
        atual: pontoGeracaoCaixaAtual?.despesa ?? null,
        formato: "brl",
        serie: serieGeracaoCaixaMetrica("despesa"),
        temporalidade: "mes",
      },
      {
        key: "capacity_geracao_caixa_liquida",
        metrica: "(=) Geração de caixa",
        atual: pontoGeracaoCaixaAtual?.geracaoMes ?? null,
        formato: "brl",
        serie: serieGeracaoCaixaMetrica("geracaoMes"),
        temporalidade: "mes",
      },
      {
        key: "capacity_geracao_caixa_conversao",
        metrica: "Conversão em caixa %",
        atual: pontoGeracaoCaixaAtual?.conversaoPct ?? null,
        formato: "pct",
        serie: serieGeracaoCaixaMetrica("conversaoPct"),
        temporalidade: "mes",
      },
      {
        key: "capacity_geracao_caixa_acumulado",
        metrica: "Caixa acumulado (ano)",
        atual: pontoGeracaoCaixaAtual?.caixaAcumulado ?? null,
        formato: "brl",
        serie: serieGeracaoCaixaMetrica("caixaAcumulado"),
        temporalidade: "mes",
        // Saldo acumulado (já é um total corrente) — YTD = último ponto, não soma dos meses.
        ytdAgg: "ultimo",
      },
    ],
  };

  // Onda C1→E: Margem de Contribuição por squad — `contribuicao` (GET
  // /api/contribuicao-squad/ranking) traz só o período do mês selecionado (sem série);
  // `contribuicaoBulk` (GET /api/contribuicao-squad/dfc/bulk?ano=YYYY, Onda E) traz os 12 meses
  // do ano, usados para dar `serie` a estas linhas no modo Evolução. `atual`/`sub` preferem o
  // ponto do BULK no mês selecionado (reconcilia com a série exibida, mesma regra de
  // `linhasPorDimensao`); se o bulk não carregar, cai para o ranking (sem série) — degradação
  // graciosa.
  const rankingContribuicao = contribuicao.data?.ranking ?? [];
  const serieContribPorSquadCalc = serieContribuicaoPorSquad(contribuicaoBulk.data);
  const contribuicaoSquadRows: ScorecardRow[] = rankingContribuicao
    .map((item): ScorecardRow => {
      const serieSquad = encontrarSerieSquad(serieContribPorSquadCalc, item.squad);
      const pontoSquad = serieSquad ? pontoContribuicaoNoMes(serieSquad, mes) : null;
      const atual = pontoSquad ? pontoSquad.contribuicao : item.contribuicao;
      // pontoSquad.margem pode ser null (receita<=0 no mês) — cai pro margem do ranking (sempre
      // number, formatPercent abaixo não aceita null) em vez de mostrar "0%" ou quebrar o tipo.
      const margem = pontoSquad?.margem ?? item.margem;
      const serie: ScorecardSeriePonto[] | undefined = serieSquad
        ? serieSquad.map((p) => ({ month: p.month, label: labelMesCurto(p.month), valor: p.contribuicao }))
        : undefined;
      return {
        key: `capacity_contribuicao_squad_${slug(item.squad)}`,
        metrica: item.squad,
        sub: `Margem ${formatPercent(margem, 1)}`,
        atual,
        formato: "brl",
        serie,
        temporalidade: "mes",
      };
    })
    .filter((row) => !ehSquadOff(row.metrica))
    // Ordena pelo VALOR EXIBIDO (`atual`, que prioriza o bulk reconciliado com a série — ver
    // acima) — não pelo `contribuicao` bruto do ranking, que pode divergir do `atual` mostrado
    // e deixar a lista fora de ordem (squad com bulk mais alto exibido abaixo de um com ranking
    // mais alto, por exemplo).
    .sort((a, b) => (b.atual ?? -Infinity) - (a.atual ?? -Infinity));
  const secaoContribuicaoSquad: ScorecardSection = {
    id: "capacity-contribuicao-squad",
    titulo: "Margem de Contribuição por squad (mês)",
    // Por squad, não por operador — custo/operador no backend é heurístico e só funciona
    // filtrando 1 pessoa por vez, inviável em lote. Base DIFERENTE da "Geração de Caixa" acima
    // (custos DIRETOS do squad vs. TODAS as despesas pagas da DFC) — não reconciliam entre si.
    subtitulo: contribuicao.isError
      ? "falha ao carregar margem de contribuição"
      : contribuicaoSquadRows.length === 0
        ? "carregando…"
        : undefined,
    linhas: contribuicaoSquadRows,
  };

  // MRR por squad/operador com série real (Onda2-A) — ao contrário da seção "snapshot" abaixo
  // (achatada por pessoa, só o valor do momento), estas linhas têm `atual` E `serie` vindos do
  // MESMO endpoint (/api/scorecard/series), reconciliando o número do mês com o modo Evolução.
  const mrrSquadRows: ScorecardRow[] = linhasPorDimensao(series.data?.series.mrrPorSquad, mes, {
    keyFn: (dim) => `capacity_mrr_squad_${slug(dim)}`,
    formato: "brl",
    labelMes: labelMesCurto,
    // MRR é estoque (saldo do squad no mês) — YTD = último ponto, não soma dos meses.
    ytdAgg: "ultimo",
  }).filter((row) => !ehSquadOff(row.metrica));
  const mrrOperadorRows: ScorecardRow[] = linhasPorDimensao(series.data?.series.mrrPorOperador, mes, {
    keyFn: (dim) => `capacity_mrr_operador_${slug(dim)}`,
    formato: "brl",
    labelMes: labelMesCurto,
    top: 10,
    responsavelAuto: true,
    ytdAgg: "ultimo",
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
    secaoReceitaCabecaSquad,
    secaoReceitaCabecaOperador,
    secaoGeracaoCaixa,
    secaoContribuicaoSquad,
    secaoMrrSquad,
    secaoMrrOperador,
  ];
}

export function SecaoCapacity({ mes, modo }: { mes: string; modo: ScorecardModo }) {
  // Série de MRR por squad/operador (Onda2-A) — fonte das 2 seções de evolução abaixo. Falha/
  // loading isolados (não bloqueiam a aba): linhasPorDimensao devolve [] sem `series.data`.
  const series = useScorecardSeries(mes);
  const contribuicao = useContribuicaoSquadRanking(mes);
  const contribuicaoBulk = useContribuicaoSquadBulk(mes);
  const geracaoCaixa = useGeracaoCaixa();
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

  const secoes = montarSecoesCapacity(
    { isError: series.isError, data: series.data },
    mes,
    { isError: contribuicao.isError, data: contribuicao.data },
    { isError: contribuicaoBulk.isError, data: contribuicaoBulk.data },
    { isError: geracaoCaixa.isError, data: geracaoCaixa.data },
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
