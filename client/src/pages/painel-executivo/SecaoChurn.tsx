import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { formatPercent } from "@/lib/utils";
import { Scorecard, type ScorecardModo } from "./scorecard/Scorecard";
import {
  useReportsMensal,
  useChurnDetalhamento,
  useChurnProdutoMotivo,
  useChurnTaxaMensal,
  useChurnPontorrente,
  useScorecardMetas,
  useScorecardResponsaveis,
  useSalvarResponsaveis,
  useScorecardSeries,
} from "./hooks";
import type {
  ScorecardSection,
  ScorecardRow,
  ScorecardSeriePonto,
  ScorecardResponsavelItem,
  ScorecardSeriesResponse,
} from "./scorecard/tipos";
import { linhasPorDimensao } from "./scorecard/logica";
import type { ChurnDetalhamento, ChurnProdutoMotivo, ChurnTaxaMensal, ChurnTaxaMensalRow, ChurnProdutoMotivoCelula, ReceitaChurnPonto, ReportsMensal } from "./tipos";
import type { ChurnPontorrentePayload } from "@/components/churn-pontorrente/types";

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** taxaMensal.rows (server já ordena por mes ASC) só traz `mes` ("YYYY-MM"), sem `label` pronto
   (diferente das séries de ReportsMensal usadas em SecaoReceita) — deriva aqui, mesmo padrão de
   `labelMesCurto`/`serieCrosssell` em SecaoReceita.tsx. */
function labelMesCurto(mes: string): string {
  const m = Number(mes.split("-")[1]);
  return MESES_ABREV[m - 1] ?? mes;
}

function serieTaxaMensal(rows: ChurnTaxaMensalRow[] | undefined, valor: (r: ChurnTaxaMensalRow) => number): ScorecardSeriePonto[] {
  return (rows ?? []).map((r) => ({ label: labelMesCurto(r.mes), valor: valor(r), month: r.mes }));
}

/** Normaliza uma série que já vem com `label` do backend (mesmo helper de SecaoReceita.tsx/
   SecaoVisaoGeral.tsx) — usado pelo "Churn R$" geral, que agora compartilha fonte com as
   outras duas abas (turboMetrics.receitaChurnSeries), não mais o churn-detalhamento. Propaga
   `month` (quando a fonte tiver) para o modo evolução truncar/realçar no mês selecionado. */
function serieComLabel<T extends { label: string; month?: string }>(rows: T[] | undefined, valor: (r: T) => number): ScorecardSeriePonto[] {
  return (rows ?? []).map((r) => ({ label: r.label, valor: valor(r), month: r.month }));
}

/** Chave estável para linhas derivadas de listas variáveis (produto+motivo, operador, squad) —
   usada como `metrica_key` de persistência do responsável manual (CelulaResponsavel), por isso
   precisa ser determinística por entidade (não por índice de posição, que muda mês a mês). */
function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Agrega `produtoMotivo.celulas` (produto × motivo) POR MOTIVO — soma `mrr_perdido` e
   `cancelamentos` de todos os produtos com o mesmo `motivo_cancelamento`. Fonte da seção
   "Motivos de Churn" (sem série: /api/churn/produto-motivo não traz série mensal por motivo,
   só o snapshot do período selecionado). Ordena por mrr_perdido desc, top 8. */
function linhasPorMotivo(produtoMotivo: ChurnProdutoMotivo | undefined): ScorecardRow[] {
  const porMotivo = new Map<string, { mrr_perdido: number; cancelamentos: number }>();
  for (const c of produtoMotivo?.celulas ?? []) {
    const acc = porMotivo.get(c.motivo_cancelamento) ?? { mrr_perdido: 0, cancelamentos: 0 };
    acc.mrr_perdido += c.mrr_perdido;
    acc.cancelamentos += c.cancelamentos;
    porMotivo.set(c.motivo_cancelamento, acc);
  }

  return Array.from(porMotivo.entries())
    .sort((a, b) => b[1].mrr_perdido - a[1].mrr_perdido)
    .slice(0, 8)
    .map(([motivo, agg]) => ({
      key: `churn_motivo_${slug(motivo)}`,
      metrica: motivo,
      sub: `${agg.cancelamentos} cancelamentos`,
      atual: agg.mrr_perdido,
      formato: "brl",
      temporalidade: "mes",
    }));
}

/** Sub opcional da linha "por produto": top motivo de cancelamento daquele produto, casado
   por nome EXATO com o produto da série nova (churn/produto-motivo continua sendo a única
   fonte de motivo — a série de /api/scorecard/series não traz motivo). Quando o produto não
   casa (nome diferente entre as duas fontes), a linha fica sem sub — não aproximamos. */
function topMotivoPorProduto(produto: string, celulas: ChurnProdutoMotivoCelula[] | undefined): string | undefined {
  const doProduto = (celulas ?? []).filter((c) => c.produto === produto);
  if (doProduto.length === 0) return undefined;
  return [...doProduto].sort((a, b) => b.mrr_perdido - a.mrr_perdido)[0]?.motivo_cancelamento;
}

/** Função pura: monta as seções de Churn a partir dos payloads já resolvidos (o `churnDet` é a
   fonte primária/bloqueante do componente — as demais são isoladas e podem estar `undefined`
   em loading/erro, mesma tolerância do componente original). Extraída de SecaoChurn para
   reuso pela aba Consolidado. */
export function montarSecoesChurn(
  churnDet: ChurnDetalhamento,
  produtoMotivo: ChurnProdutoMotivo | undefined,
  taxaMensal: ChurnTaxaMensal | undefined,
  pontorrente: ChurnPontorrentePayload | undefined,
  series: ScorecardSeriesResponse | undefined,
  rm: ReportsMensal | undefined,
  mes: string,
): ScorecardSection[] {
  const m = churnDet.metricas;

  // Breakdowns por dimensão (produto/operador/squad) — Onda2-A: fonte única `series` para
  // `atual` E `serie`, reconciliando o número do mês com a linha do tempo do modo Evolução.
  const produtoRows: ScorecardRow[] = linhasPorDimensao(series?.series.churnPorProduto, mes, {
    keyFn: (dim) => `churn_produto_${slug(dim)}`,
    formato: "brl",
    labelMes: labelMesCurto,
    top: 8,
    sub: (dim) => topMotivoPorProduto(dim, produtoMotivo?.celulas),
  });

  const operadorRows: ScorecardRow[] = linhasPorDimensao(series?.series.churnPorOperador, mes, {
    keyFn: (dim) => `churn_operador_${slug(dim)}`,
    formato: "brl",
    labelMes: labelMesCurto,
    top: 6,
    // Dono automático (o próprio operador) — célula somente-leitura, não faz sentido reatribuir.
    responsavelAuto: true,
  });

  const squadRowsSemSub = linhasPorDimensao(series?.series.churnPorSquad, mes, {
    keyFn: (dim) => `churn_squad_${slug(dim)}`,
    formato: "brl",
    labelMes: labelMesCurto,
  });
  // % do total (share entre as squads da própria série — mesma fonte do `atual`, não mistura
  // com `m.churn_por_squad`, que agora é uma fonte diferente/desalinhada desta série nova).
  const totalSquadChurn = squadRowsSemSub.reduce((acc, r) => acc + (r.atual ?? 0), 0);
  const squadRows: ScorecardRow[] = squadRowsSemSub.map((r) => ({
    ...r,
    sub: totalSquadChurn > 0 && r.atual !== null ? formatPercent((r.atual / totalSquadChurn) * 100) : undefined,
  }));

  const pontualOverview = pontorrente?.overview;
  const pontualRows: ScorecardRow[] = pontualOverview
    ? [
        {
          key: "churn_pontual_confirmado_brl",
          metrica: "Churn confirmado (R$)",
          atual: pontualOverview.valorpPerdido,
          formato: "brl",
          temporalidade: "mes",
        },
        {
          key: "churn_pontual_drop_medio",
          metrica: "Drop médio",
          atual: pontualOverview.dropMedio,
          formato: "pct",
          temporalidade: "mes",
        },
      ]
    : [];

  return [
    {
      id: "churn-geral",
      titulo: "Churn Recorrente — Geral",
      linhas: [
        {
          key: "churn_geral_brl",
          metrica: "Churn R$",
          // Mesma fonte e mesma meta de Receita/Visão Geral (turboMetrics.churnMrr +
          // churn_mrr_month) — evita 2 valores/2 metas para a mesma métrica no scorecard.
          atual: rm?.turboMetrics.churnMrr ?? null,
          formato: "brl",
          metaKey: "churn_mrr_month",
          serie: serieComLabel<ReceitaChurnPonto>(rm?.turboMetrics.receitaChurnSeries, (r) => r.churnBrl),
          temporalidade: "mes",
        },
        {
          key: "churn_geral_pct",
          metrica: "Churn %",
          atual: m.churn_percentual,
          formato: "pct",
          serie: serieTaxaMensal(taxaMensal?.rows, (r) => r.taxa),
          temporalidade: "mes",
        },
        {
          key: "churn_geral_contratos",
          metrica: "Contratos cancelados",
          atual: m.total_churned,
          formato: "int",
          serie: serieTaxaMensal(taxaMensal?.rows, (r) => r.cancelamentos),
          temporalidade: "mes",
        },
      ],
    },
    {
      id: "churn-produto",
      titulo: "Churn Recorrente — Por produto",
      subtitulo: "detalhamento (fonte ClickUp); pode não somar ao geral",
      linhas: produtoRows,
    },
    {
      id: "churn-motivos",
      titulo: "Churn Recorrente — Motivos",
      subtitulo: "detalhamento (fonte ClickUp); pode não somar ao geral",
      linhas: linhasPorMotivo(produtoMotivo),
    },
    {
      id: "churn-operador",
      titulo: "Churn Recorrente — Por operador",
      linhas: operadorRows,
    },
    {
      id: "churn-squad",
      titulo: "Churn Recorrente — Por squad",
      linhas: squadRows,
    },
    {
      id: "churn-pontual",
      titulo: "Churn Pontual",
      linhas: pontualRows,
    },
  ];
}

export function SecaoChurn({ mes, modo }: { mes: string; modo: ScorecardModo }) {
  // Fonte mensal canônica do painel (mesma de SecaoReceita/SecaoVisaoGeral) — usada SÓ para
  // o "Churn R$" geral, para que as 3 abas mostrem o MESMO valor e a MESMA meta. Os
  // breakdowns abaixo (produto/operador/squad) usam `series` (Onda2-A), não o churn-detalhamento
  // (continuam sendo detalhamentos, não o total — podem não somar ao geral).
  const rm = useReportsMensal(mes);
  const detalhamento = useChurnDetalhamento(mes);
  const produtoMotivo = useChurnProdutoMotivo(mes);
  const taxaMensal = useChurnTaxaMensal(mes);
  const pontorrente = useChurnPontorrente(mes);
  // Séries por dimensão (Onda2-A) — fonte dos 3 breakdowns abaixo (produto/operador/squad).
  // Falha/loading isolados (não bloqueiam a seção): linhasPorDimensao devolve [] sem `series.data`.
  const series = useScorecardSeries(mes);
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

  // Fonte primária: bloqueia a seção inteira. As demais (produtoMotivo, taxaMensal, series,
  // pontorrente) falham isoladas — a seção correspondente só fica sem linhas.
  if (detalhamento.isError) {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40">
        <CardContent className="flex items-center gap-2 py-4 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle className="h-4 w-4" /> Falha ao carregar churn.
        </CardContent>
      </Card>
    );
  }
  if (detalhamento.isLoading || !detalhamento.data) {
    return <div className="space-y-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-56" />)}</div>;
  }

  const secoes = montarSecoesChurn(detalhamento.data, produtoMotivo.data, taxaMensal.data, pontorrente.data, series.data, rm.data, mes);

  return (
    <Scorecard
      secoes={secoes}
      mes={mes}
      modo={modo}
      metas={metas.data?.metas ?? {}}
      responsaveis={responsaveis.data?.itens ?? []}
      onEditResponsavel={onEditResponsavel}
    />
  );
}
