import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { Scorecard, type ScorecardModo } from "./scorecard/Scorecard";
import { EmBreveCard } from "./EmBreveCard";
import {
  useReportsMensal,
  useScorecardMetas,
  useLtLtvOverview,
  useLtLtvEvolucaoClientes,
  useCeoDashboard,
  useScorecardSeries,
  useScorecardResponsaveis,
  useSalvarResponsaveis,
} from "./hooks";
import type { ScorecardSection, ScorecardSeriePonto, ScorecardSerieDimPontoNullable, ScorecardResponsavelItem } from "./scorecard/tipos";
import type { ReceitaChurnPonto, VendasSeriePonto, CrosssellHistoricoPonto, EntregaProdutoMes, ReportsMensal } from "./tipos";
import type { OverviewData, EvolucaoClientePonto } from "@/components/lt-ltv-churn/types";

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** "YYYY-MM" → label curto (ex: "Jan") — mesmo padrão de `labelMesCurto` em SecaoChurn.tsx/
   SecaoEntregas.tsx/SecaoPerformance.tsx (duplicado localmente, não há util compartilhado). */
function labelMesCurto(mes: string): string {
  const m = Number(mes.split("-")[1]);
  return MESES_ABREV[m - 1] ?? mes;
}

/** crosssellHistorico não vem com `label` pronto do backend (diferente de ReceitaChurnPonto/
   VendasSeriePonto) — deriva aqui, mesmo padrão de `serieTaxaMensal` em SecaoChurn.tsx. */
function serieCrosssell(rows: CrosssellHistoricoPonto[] | undefined): ScorecardSeriePonto[] {
  return (rows ?? []).map((r) => ({ label: labelMesCurto(r.mes), valor: r.mrr, month: r.mes }));
}

// Shape mínimo do payload de GET /api/ceo-dashboard (server/routes/ceoDashboard.helpers.ts,
// CeoKpi) — sem tipo compartilhado client/server, mesmo cast local usado na v1 desta seção.
interface CeoKpiMin {
  key: string;
  valor: number | null;
}

/** Normaliza uma série que já vem com `label` do backend para o formato do Scorecard
   (mesmo helper de SecaoReceita.tsx/SecaoEntregas.tsx). Propaga `month` (quando a fonte
   tiver) para o modo evolução truncar/realçar no mês selecionado. */
function serieComLabel<T extends { label: string; month?: string }>(rows: T[] | undefined, valor: (r: T) => number): ScorecardSeriePonto[] {
  return (rows ?? []).map((r) => ({ label: r.label, valor: valor(r), month: r.month }));
}

export interface MontarSecoesVisaoGeralCeo {
  isError: boolean;
  kpis: CeoKpiMin[] | undefined;
}

/** Função pura: monta a seção-síntese de Visão Geral a partir do payload já resolvido de
   /api/reports/mensal + LTV overview + CEO dashboard (isolado, com `isError` porque o `sub`
   da linha "Receita/Cabeça" distingue falta de permissão de outros estados). Extraída de
   SecaoVisaoGeral para reuso pela aba Consolidado.
   Onda F: `evolucaoClientes` (useLtLtvEvolucaoClientes, já usado pela aba LT/LTV) dá SÉRIE à
   linha "LTV médio/cliente"; `receitaCabecaGeralPorMes` (novo campo de /api/scorecard/series,
   ver fetchReceitaCabecaGeralPorMes no backend) dá SÉRIE à linha "Receita / Cabeça". Ambos
   opcionais — degradação graciosa (linha cai para o comportamento anterior sem `serie`). */
export function montarSecoesVisaoGeral(
  rm: ReportsMensal,
  ltvOverview: OverviewData | undefined,
  ceo: MontarSecoesVisaoGeralCeo,
  evolucaoClientes: EvolucaoClientePonto[] | undefined,
  receitaCabecaGeralPorMes: ScorecardSerieDimPontoNullable[] | undefined,
): ScorecardSection[] {
  const tm = rm.turboMetrics;
  const p = rm.pontualData;

  // LTV médio/cliente (Onda F) — série mensal por CLIENTE (mesma régua/fonte do valor `atual`:
  // `ltv` já é a MÉDIA por cliente, casando com `ltvMedioCliente` do overview). Mesmo padrão de
  // ordenação de `serieClientesOrdenada` em SecaoLtLtv.tsx (a fonte não garante ordem). `atual`
  // prioriza o overview (base ativa "agora"); cai pro último ponto da série só quando o overview
  // ainda não resolveu/falhou (degradação graciosa, evita "—" com dado disponível).
  const evolucaoClientesOrdenada = [...(evolucaoClientes ?? [])].sort((a, b) => (a.mes < b.mes ? -1 : a.mes > b.mes ? 1 : 0));
  const ltvMedioSerie: ScorecardSeriePonto[] = evolucaoClientesOrdenada.map((pt) => ({ month: pt.mes, label: labelMesCurto(pt.mes), valor: pt.ltv }));
  const ltvUltimoPonto = evolucaoClientesOrdenada.length > 0 ? evolucaoClientesOrdenada[evolucaoClientesOrdenada.length - 1].ltv : null;
  const ltvMedioCliente = ltvOverview?.ltvMedioCliente ?? ltvUltimoPonto ?? null;

  // Receita/Cabeça GERAL (Onda F) — série mensal em regime de CAIXA (fetchReceitaCabecaGeralPorMes
  // no backend, reusa o mesmo cálculo do card do CEO Dashboard). `atual` prioriza o CEO Dashboard
  // (fonte original desta linha); cai pro último ponto NÃO-nulo da série quando o CEO Dashboard
  // não tiver o valor (loading OU sem permissão) — /api/scorecard/series não é gated por
  // permissão de CEO (mesma exposição de MRR/margem por squad já presentes neste endpoint), então
  // a série substitui o "—" nesse caso; `sub` abaixo só avisa "sem permissão" quando nem a série
  // salvou a linha.
  const receitaCabecaSerie: ScorecardSeriePonto[] = (receitaCabecaGeralPorMes ?? []).map((pt) => ({
    month: pt.month,
    label: labelMesCurto(pt.month),
    valor: pt.valor,
  }));
  const receitaCabecaUltimoPonto = [...receitaCabecaSerie].reverse().find((pt) => pt.valor != null)?.valor ?? null;
  const receitaCabecaCeo = ceo.isError ? null : (ceo.kpis?.find((k) => k.key === "receita_cabeca")?.valor ?? null);
  const receitaCabeca = receitaCabecaCeo ?? receitaCabecaUltimoPonto;

  // Último ponto válido da série mensal de churn % (mesma fonte que a linha "Churn R$" abaixo).
  const churnSerie = tm.receitaChurnSeries ?? [];
  const churnPctAtual = churnSerie.length > 0 ? churnSerie[churnSerie.length - 1].churnPct : null;

  return [
    {
      id: "resumo-mes",
      titulo: "Resumo do mês",
      linhas: [
        {
          key: "visao_mrr_ativo",
          metrica: "MRR ativo",
          atual: tm.mrrAtivo,
          formato: "brl",
          metaKey: "mrr_active",
          serie: serieComLabel<ReceitaChurnPonto>(tm.receitaChurnSeries, (r) => r.mrr),
          temporalidade: "mes",
        },
        {
          key: "visao_mrr_nova",
          metrica: "Nova receita MRR",
          atual: tm.mrrAdicionado,
          formato: "brl",
          metaKey: "sales_mrr_new_target",
          serie: serieComLabel<VendasSeriePonto>(rm.contratosMes.vendasSeries, (r) => r.vendasMrr),
          temporalidade: "mes",
        },
        {
          key: "visao_churn_brl",
          metrica: "Churn R$",
          sub: `${tm.churnCount} contratos`,
          atual: tm.churnMrr,
          formato: "brl",
          metaKey: "churn_mrr_month",
          serie: serieComLabel<ReceitaChurnPonto>(tm.receitaChurnSeries, (r) => r.churnBrl),
          temporalidade: "mes",
        },
        {
          key: "visao_churn_pct",
          metrica: "Churn %",
          atual: churnPctAtual,
          formato: "pct",
          serie: serieComLabel<ReceitaChurnPonto>(tm.receitaChurnSeries, (r) => r.churnPct),
          temporalidade: "mes",
        },
        {
          key: "visao_crosssell",
          metrica: "Cross-sell",
          // metaKey é MRR-only (sales_mrr_monetization_target) — somar o pontual aqui infla o
          // "atual" e distorce o status vs. a meta. Mesma fonte/meta da aba Receita. Série
          // (Onda3) usa só o `mrr` de cada ponto, pela mesma razão do `atual`.
          atual: tm.crosssellMrr,
          formato: "brl",
          metaKey: "sales_mrr_monetization_target",
          serie: serieCrosssell(tm.crosssellHistorico),
          temporalidade: "mes",
        },
        {
          key: "visao_entregas",
          metrica: "Entregas (R$)",
          atual: p.entregasMes.total,
          formato: "brl",
          // Série real (Onda3) — mesma fonte usada em SecaoEntregas.tsx ("Entregue (R$)").
          serie: serieComLabel<EntregaProdutoMes>(p.entregasPorProdutoMes, (r) => r.total),
          temporalidade: "mes",
        },
        {
          key: "visao_receita_cabeca",
          metrica: "Receita / Cabeça",
          // "sem permissão" só quando NEM o CEO Dashboard NEM a série (Onda F) resolveram um
          // valor — evitar mostrar o aviso ao lado de um número real vindo da série.
          sub: ceo.isError && receitaCabeca == null ? "sem permissão" : undefined,
          atual: receitaCabeca,
          formato: "brl",
          metaKey: "receita_cabeca",
          serie: receitaCabecaSerie.length > 0 ? receitaCabecaSerie : undefined,
          temporalidade: "mes",
        },
        {
          key: "visao_ltv_medio",
          metrica: "LTV médio/cliente",
          atual: ltvMedioCliente,
          formato: "brl",
          serie: ltvMedioSerie.length > 0 ? ltvMedioSerie : undefined,
          temporalidade: "mes",
        },
        {
          key: "visao_nps",
          metrica: "NPS",
          atual: null,
          formato: "int",
          metaKey: "nps",
          temporalidade: "mes",
        },
      ],
    },
  ];
}

/** Aba-síntese: 1 linha por métrica-chave de cada uma das outras 6 abas, com meta/status
   automáticos via `metaKey` (mesmo componente Scorecard, mesma fonte /api/scorecard/metas). */
export function SecaoVisaoGeral({ mes, modo }: { mes: string; modo: ScorecardModo }) {
  const rm = useReportsMensal(mes);
  const metas = useScorecardMetas(mes);
  const ltv = useLtLtvOverview();
  // Onda F: fonte da SÉRIE de "LTV médio/cliente" (já usada pela aba LT/LTV, sem mês —
  // histórico completo definido no backend, ver useLtLtvEvolucaoClientes em hooks.ts).
  const evolucaoClientes = useLtLtvEvolucaoClientes();
  const ceo = useCeoDashboard(mes);
  // Onda F: fonte da SÉRIE de "Receita / Cabeça" geral (receitaCabecaGeralPorMes, novo campo de
  // /api/scorecard/series) — mesmo hook já usado por SecaoCapacity/SecaoConsolidado.
  const series = useScorecardSeries(mes);
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

  if (rm.isError) {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40">
        <CardContent className="flex items-center gap-2 py-4 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle className="h-4 w-4" /> Falha ao carregar os dados do mês. Tente recarregar.
        </CardContent>
      </Card>
    );
  }
  if (rm.isLoading || !rm.data) {
    return <div className="space-y-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-56" />)}</div>;
  }

  // kpis é um array (CeoKpi[]), não um mapa por chave — busca pelo campo `key`. ceo.isError
  // (403 sem permissão de CEO Dashboard) deixa ceo.data undefined → receitaCabeca cai na série
  // de /api/scorecard/series quando disponível (ver montarSecoesVisaoGeral), sem bloquear a aba.
  const ceoKpis = (ceo.data as { kpis?: CeoKpiMin[] } | undefined)?.kpis;
  const ltvOverview = ltv.data as OverviewData | undefined;

  const secoes = montarSecoesVisaoGeral(
    rm.data,
    ltvOverview,
    { isError: ceo.isError, kpis: ceoKpis },
    evolucaoClientes.data?.serie,
    series.data?.series.receitaCabecaGeralPorMes,
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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <EmBreveCard titulo="NPS de clientes" motivo="Fase 2 — requer fonte cortex_core.nps_clientes" />
        <EmBreveCard titulo="Margem de Contribuição" motivo="Fase 2 — receita − custos de operação por squad" />
      </div>
    </div>
  );
}
