import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { Scorecard, type ScorecardModo } from "./scorecard/Scorecard";
import { DrillSheet } from "./DrillSheet";
import {
  useReportsMensal,
  useGestaoReceitaDetalhe,
  useScorecardMetas,
  useScorecardResponsaveis,
  useSalvarResponsaveis,
  useBp2026ReconciliacaoTotal,
  useBp2026PontualTotal,
  useScorecardSeries,
  type Bp2026ReconciliacaoTotalResponse,
  type Bp2026PontualLinha,
} from "./hooks";
import { paramsParaMes, labelMes } from "./temporalidade";
import type { ScorecardSection, ScorecardSeriePonto, ScorecardResponsavelItem, ScorecardSeriesResponse } from "./scorecard/tipos";
import type { ReceitaChurnPonto, VendasSeriePonto, CrosssellHistoricoPonto, EntregaProdutoMes, ReportsMensal } from "./tipos";

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** crosssellHistorico (server) só traz `mes` ("YYYY-MM"), sem `label` pronto (diferente das
   outras séries de ReportsMensal, que já vêm com `label` abreviado) — deriva aqui com a mesma
   convenção de abreviação ("Jan", "Fev"...) usada pelo backend nas demais séries. */
function labelMesCurto(mes: string): string {
  const m = Number(mes.split("-")[1]);
  return MESES_ABREV[m - 1] ?? mes;
}

/** Normaliza uma série que já vem com `label` do backend para o formato do Scorecard.
   Propaga `month` (quando a fonte tiver) para o modo evolução truncar/realçar no mês
   selecionado (ver Scorecard.tsx). */
function serieComLabel<T extends { label: string; month?: string }>(rows: T[] | undefined, valor: (r: T) => number): ScorecardSeriePonto[] {
  return (rows ?? []).map((r) => ({ label: r.label, valor: valor(r), month: r.month }));
}

/** crosssellHistorico: sem `label`, ordena por `mes` (string "YYYY-MM", ordena cronologicamente
   por comparação lexicográfica) e deriva o label curto. */
function serieCrosssell(rows: CrosssellHistoricoPonto[] | undefined, valor: (r: CrosssellHistoricoPonto) => number): ScorecardSeriePonto[] {
  return (rows ?? [])
    .slice()
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map((r) => ({ label: labelMesCurto(r.mes), valor: valor(r), month: r.mes }));
}

/** Converte uma série SEM dimensão de /api/scorecard/series (`{month,valor}[]`, já vem em ordem
   cronológica e com os 12 meses zero-fillados — ver `rowsParaSerieUnica` no backend) para o
   formato do Scorecard, derivando o `label` curto. Usada pelos saldos de estoque pontual (Onda
   D: "Em aberto (estoque)"/"Pausado (estoque)"), que agora têm série mensal legítima em vez de
   só o snapshot atual. */
function serieSaldoEstoque(pontos: { month: string; valor: number }[] | undefined): ScorecardSeriePonto[] {
  return (pontos ?? []).map((p) => ({ label: labelMesCurto(p.month), valor: p.valor, month: p.month }));
}

// Tipos válidos aceitos por /api/gestao/receita/detalhe (server/routes/gestaoReceita.detalhe.ts,
// const TIPOS). "venda"/"churn" (soltos) NÃO existem — usar "venda_mrr"/"venda_pontual" e
// "churn_motivo"/"churn_vendedor" (que exigem uma chave específica, não "total").

export interface MontarSecoesReceitaExtras {
  /** Abre o DrillSheet (estado fica no componente) — omitido = linha "Nova receita" sem drill. */
  onDrill?: (tipo: string, chave: string) => void;
}

/** Fontes bp2026 (Onda B2) — opcionais: hooks isolados, ausência = linhas com "—" (degradação
   graciosa), nunca derruba o resto da seção. Ver useBp2026ReconciliacaoTotal/useBp2026PontualTotal
   em hooks.ts para o motivo de cada endpoint (shape real diverge do assumido inicialmente:
   reconciliação é por-produto — agregamos os 5; pontual não tem endpoint "?mes=", devolve o
   ANO inteiro em `linhas[].meses` e quem consome indexa pelo mês selecionado, aqui). */
export interface MontarSecoesReceitaBp2026 {
  reconciliacaoTotal?: Bp2026ReconciliacaoTotalResponse;
  pontualTotal?: Bp2026PontualLinha[];
}

/** Extrai de `Bp2026PontualLinha[]` (ano inteiro) o ponto do mês selecionado + a série completa
   já no formato do Scorecard. `temporalidade` deriva do `tipoAgregacao` real da linha (fluxo =
   movimento do mês, "mes"; estoque = saldo num ponto no tempo, "snapshot" — mesma convenção já
   usada por "Em aberto (estoque)" abaixo). bp2026 só cobre o ano 2026 (módulo inteiro é
   hardcoded pro ano do BP) — fora disso, `atual` fica null (linha mostra "—"). */
function bp2026PontualLinha(
  linhas: Bp2026PontualLinha[] | undefined,
  metrica: string,
  mes: string,
): { atual: number | null; serie: ScorecardSeriePonto[]; temporalidade: "mes" | "snapshot" } {
  const linha = linhas?.find((l) => l.metrica === metrica);
  if (!linha) return { atual: null, serie: [], temporalidade: "mes" };
  const [ano, mNum] = mes.split("-").map(Number);
  const ponto = ano === 2026 ? linha.meses.find((m) => m.mes === mNum) : undefined;
  const serie: ScorecardSeriePonto[] = linha.meses.map((m) => ({
    label: MESES_ABREV[m.mes - 1] ?? String(m.mes),
    valor: m.realizado,
    month: `2026-${String(m.mes).padStart(2, "0")}`,
  }));
  return {
    atual: ponto?.realizado ?? null,
    serie,
    temporalidade: linha.tipoAgregacao === "estoque" ? "snapshot" : "mes",
  };
}

/** Função pura: monta as seções de Receita a partir do payload já resolvido de
   /api/reports/mensal. Extraída de SecaoReceita para reuso pela aba Consolidado.
   `series` (Onda D, opcional) dá série mensal aos saldos de estoque pontual ("Em aberto"/
   "Pausado") — mesmo padrão de degradação graciosa do resto do arquivo: ausente (loading/erro
   do endpoint) mantém o comportamento anterior (snapshot, sem série). */
export function montarSecoesReceita(
  rm: ReportsMensal,
  mes: string,
  extras: MontarSecoesReceitaExtras = {},
  bp2026: MontarSecoesReceitaBp2026 = {},
  series?: ScorecardSeriesResponse,
): ScorecardSection[] {
  const tm = rm.turboMetrics;
  const p = rm.pontualData;
  const rec = bp2026.reconciliacaoTotal;
  const pontualLinhas = bp2026.pontualTotal;

  return [
    {
      id: "receita-mrr",
      titulo: "Receita — MRR",
      linhas: [
        {
          key: "receita_mrr_ativo",
          metrica: "MRR ativo",
          atual: tm.mrrAtivo,
          formato: "brl",
          metaKey: "mrr_active",
          // Estoque de MRR ativo (ClickUp/cup_data_hist) — venda_mrr é FLUXO (Bitrix) e não
          // reconcilia com o estoque, por isso sem drill (mesma regra da v1 em cards).
          serie: serieComLabel<ReceitaChurnPonto>(tm.receitaChurnSeries, (r) => r.mrr),
          temporalidade: "mes",
        },
        {
          key: "receita_mrr_nova",
          metrica: "Nova receita",
          atual: tm.mrrAdicionado,
          formato: "brl",
          metaKey: "sales_mrr_new_target",
          serie: serieComLabel<VendasSeriePonto>(rm.contratosMes.vendasSeries, (r) => r.vendasMrr),
          temporalidade: "mes",
          drill: extras.onDrill ? () => extras.onDrill!("venda_mrr", "mrr") : undefined,
        },
        {
          key: "receita_mrr_upsell",
          metrica: "Upsell",
          sub: rec ? `${rec.upsellContratos} contratos` : undefined,
          // Agregado dos 5 produtos de /api/bp2026/reconciliacao-total (waterfall de
          // snapshot-diff do ClickUp) — sem série própria (endpoint só cobre o mês
          // selecionado; ver nota em MontarSecoesReceitaBp2026 acima).
          atual: rec?.upsell ?? null,
          formato: "brl",
          temporalidade: "mes",
        },
        {
          key: "receita_mrr_downsell",
          metrica: "Downsell",
          sub: rec ? `${rec.downsellContratos} contratos` : undefined,
          // Já vem negativo de computeReconciliacao (vFim < vIni) — mantém o sinal.
          atual: rec?.downsell ?? null,
          formato: "brl",
          temporalidade: "mes",
        },
        {
          key: "receita_mrr_churn",
          metrica: "Churn",
          sub: `${tm.churnCount} contratos`,
          atual: tm.churnMrr,
          formato: "brl",
          metaKey: "churn_mrr_month",
          serie: serieComLabel<ReceitaChurnPonto>(tm.receitaChurnSeries, (r) => r.churnBrl),
          temporalidade: "mes",
        },
        {
          key: "receita_mrr_pausado",
          metrica: "Pausado/Reativado",
          sub: `${tm.pausadosCount} contratos`,
          atual: tm.pausadosMrr,
          formato: "brl",
          temporalidade: "mes",
        },
        {
          key: "receita_mrr_crosssell",
          metrica: "Cross-sell",
          atual: tm.crosssellMrr,
          formato: "brl",
          metaKey: "sales_mrr_monetization_target",
          serie: serieCrosssell(tm.crosssellHistorico, (r) => r.mrr),
          temporalidade: "mes",
        },
      ],
    },
    {
      id: "receita-pontual",
      titulo: "Receita — Pontual",
      linhas: [
        {
          key: "receita_pontual_aquisicao",
          metrica: "Nova receita (aquisição)",
          sub: `${p.aquisicao.contratos} contratos`,
          atual: p.aquisicao.valor,
          formato: "brl",
          metaKey: "revenue_one_time",
          serie: serieComLabel<VendasSeriePonto>(rm.contratosMes.vendasSeries, (r) => r.vendasPontual),
          temporalidade: "mes",
        },
        {
          key: "receita_pontual_entregue",
          metrica: "Entregue",
          atual: p.entregasMes.total,
          formato: "brl",
          serie: serieComLabel<EntregaProdutoMes>(p.entregasPorProdutoMes, (r) => r.total),
          temporalidade: "mes",
        },
        {
          // Fonte: /api/bp2026/pontual-total, metrica "pontual_churn" — contratos que saíram do
          // estoque pontual (ClickUp) por cancelamento no mês. Já vem negativo (mesma convenção
          // de sinal do bp2026: saída = redução do estoque).
          key: "receita_pontual_churn",
          metrica: "Churn",
          ...bp2026PontualLinha(pontualLinhas, "pontual_churn", mes),
          formato: "brl",
        },
        {
          // "Pausado" aqui é um SALDO (estoque pontual atualmente em status pausado no fim do
          // mês, pontual_status_pausado) — NÃO o mesmo conceito da linha MRR "Pausado/Reativado"
          // acima (que é fluxo: contratos pausados NESTE mês). "Reativação" abaixo cobre a
          // metade do fluxo que o bp2026 expõe (retorno ao estoque de um contrato que estava
          // fora, ex. pausado antes).
          //
          // Onda D: `series.estoquePausadoPorMes` (snapshot de fim de mês de `cup_data_hist`,
          // mesma fonte/definição do estoque pontual) dá série mensal legítima — a evolução do
          // SALDO ao longo do tempo é uma leitura válida (diferente de um fluxo do mês, que não
          // faria sentido comparar mês a mês da mesma forma). `atual` continua vindo do bp2026
          // (fonte inalterada); só `serie`/`temporalidade` mudam quando `series` está disponível
          // — ausente (loading/erro), cai de volta no snapshot sem série de antes desta Onda.
          key: "receita_pontual_pausado",
          metrica: "Pausado (estoque)",
          ...bp2026PontualLinha(pontualLinhas, "pontual_status_pausado", mes),
          ...(series
            ? { serie: serieSaldoEstoque(series.series.estoquePausadoPorMes), temporalidade: "mes" as const }
            : {}),
          formato: "brl",
        },
        {
          key: "receita_pontual_reativacao",
          metrica: "Reativação",
          ...bp2026PontualLinha(pontualLinhas, "pontual_reativacao", mes),
          formato: "brl",
        },
        {
          // "pontual_reajuste": variação de valor de contratos que permaneceram no estoque no
          // mês (NET) — positivo = upsell/reajuste pra cima, negativo = desconto concedido.
          key: "receita_pontual_reajuste",
          metrica: "Upsell/downsell (desconto)",
          ...bp2026PontualLinha(pontualLinhas, "pontual_reajuste", mes),
          formato: "brl",
        },
        {
          key: "receita_pontual_crosssell",
          metrica: "Cross-sell",
          atual: tm.crosssellPontual,
          formato: "brl",
          serie: serieCrosssell(tm.crosssellHistorico, (r) => r.pontual),
          temporalidade: "mes",
        },
        {
          // Onda D: `series.estoquePontualEmAbertoPorMes` dá série mensal ao saldo (mesma fonte/
          // definição de `reference_estoque_pontual`, snapshot de fim de mês de `cup_data_hist`)
          // — a evolução do estoque em aberto ao longo do tempo é legítima, por isso a
          // temporalidade muda de "snapshot" para "mes" quando `series` está disponível. `atual`
          // continua vindo de `/api/reports/mensal` (fonte inalterada). Sem `series` (loading/
          // erro), mantém o comportamento anterior (snapshot, sem série/meta/Δ M-1).
          key: "receita_pontual_em_aberto",
          metrica: "Em aberto (estoque)",
          sub: `${p.emAberto.contratos} itens`,
          atual: p.emAberto.valor,
          formato: "brl",
          serie: series ? serieSaldoEstoque(series.series.estoquePontualEmAbertoPorMes) : undefined,
          temporalidade: series ? "mes" : "snapshot",
        },
      ],
    },
    {
      // Última seção do bloco de Receita: soma MRR ativo (estoque) + entregue no mês (pontual).
      // Sem metaKey (não existe meta de total combinado) e sem drill (agregado de 2 fontes,
      // não reconcilia com nenhum /detalhe único).
      id: "receita-total",
      titulo: "Receita — Total",
      linhas: [
        {
          key: "receita_total_mrr_pontual",
          metrica: "Total (MRR + Pontual)",
          atual: tm.mrrAtivo + p.entregasMes.total,
          formato: "brl",
          serie: serieComLabel<ReceitaChurnPonto>(tm.receitaChurnSeries, (r) => r.mrr + r.pontual),
          temporalidade: "mes",
        },
      ],
    },
  ];
}

export function SecaoReceita({ mes, modo }: { mes: string; modo: ScorecardModo }) {
  const rm = useReportsMensal(mes);
  const metas = useScorecardMetas(mes);
  const responsaveis = useScorecardResponsaveis();
  const salvarResponsaveis = useSalvarResponsaveis();
  // Onda B2: Upsell/Downsell (MRR) + movimentos de Receita Pontual — hooks isolados, cada um
  // com sua própria falha de rede; `montarSecoesReceita` já degrada pra "—" se `data` faltar.
  const reconciliacaoTotal = useBp2026ReconciliacaoTotal(mes);
  const pontualTotal = useBp2026PontualTotal();
  // Onda D: série mensal dos saldos de estoque pontual (em aberto/pausado) — isolado, falha/
  // loading só faz `montarSecoesReceita` cair de volta no snapshot sem série (ver série lá).
  const series = useScorecardSeries(mes);
  const [detalheParams, setDetalheParams] = useState<Record<string, string> | null>(null);
  const detalhe = useGestaoReceitaDetalhe(detalheParams);
  const [drillAberto, setDrillAberto] = useState(false);

  function abrirDrill(tipo: string, chave: string) {
    const { de, ate } = paramsParaMes(mes).deAte;
    setDetalheParams({ de, ate, tipo, chave });
    setDrillAberto(true);
  }

  function onEditResponsavel(metricaKey: string, valor: string) {
    const atuais = responsaveis.data?.itens ?? [];
    const atualizado: ScorecardResponsavelItem[] = [
      ...atuais.filter((i) => i.metrica_key !== metricaKey),
      { metrica_key: metricaKey, responsavel: valor },
    ];
    salvarResponsaveis.mutate(atualizado);
  }

  if (rm.isError) return <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40"><CardContent className="flex items-center gap-2 py-4 text-sm text-red-700 dark:text-red-300"><AlertTriangle className="h-4 w-4" /> Falha ao carregar receita.</CardContent></Card>;
  if (rm.isLoading || !rm.data) return <div className="space-y-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-56" />)}</div>;

  // /api/gestao/receita/detalhe (server/routes/gestaoReceita.detalhe.ts, DetalheResult) não tem
  // tipo compartilhado client/server — um único cast local evita repetir "as any" por linha
  // (inclui `total`, usado pelo rodapé de auditabilidade do DrillSheet).
  const detalheData = detalhe.data as { titulo?: string; subtitulo?: string; total?: number; grupos?: Record<string, unknown>[] } | undefined;
  const grupos = detalheData?.grupos ?? [];

  const secoes = montarSecoesReceita(rm.data, mes, { onDrill: abrirDrill }, {
    reconciliacaoTotal: reconciliacaoTotal.data,
    pontualTotal: pontualTotal.data?.linhas,
  }, series.data);

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

      <DrillSheet
        open={drillAberto}
        onClose={() => setDrillAberto(false)}
        titulo={detalheData?.titulo ?? "Detalhe"}
        subtitulo={`${detalheData?.subtitulo ?? ""} · ${labelMes(mes)}`}
        colunas={[{ chave: "titulo", label: "Grupo", tipo: "text" }, { chave: "total", label: "Valor", tipo: "brl" }]}
        linhas={grupos}
        carregando={detalhe.isLoading}
        erro={detalhe.isError}
        total={detalheData?.total}
      />
    </div>
  );
}
