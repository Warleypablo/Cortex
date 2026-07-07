import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { Scorecard, type ScorecardModo } from "./scorecard/Scorecard";
import { EmBreveCard } from "./EmBreveCard";
import {
  useReportsMensal,
  useScorecardMetas,
  useLtLtvOverview,
  useCeoDashboard,
  useScorecardResponsaveis,
  useSalvarResponsaveis,
} from "./hooks";
import type { ScorecardSection, ScorecardSeriePonto, ScorecardResponsavelItem } from "./scorecard/tipos";
import type { ReceitaChurnPonto, VendasSeriePonto } from "./tipos";
import type { OverviewData } from "@/components/lt-ltv-churn/types";

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

/** Aba-síntese: 1 linha por métrica-chave de cada uma das outras 6 abas, com meta/status
   automáticos via `metaKey` (mesmo componente Scorecard, mesma fonte /api/scorecard/metas). */
export function SecaoVisaoGeral({ mes, modo }: { mes: string; modo: ScorecardModo }) {
  const rm = useReportsMensal(mes);
  const metas = useScorecardMetas(mes);
  const ltv = useLtLtvOverview();
  const ceo = useCeoDashboard(mes);
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

  const tm = rm.data.turboMetrics;
  const p = rm.data.pontualData;

  // kpis é um array (CeoKpi[]), não um mapa por chave — busca pelo campo `key`. ceo.isError
  // (403 sem permissão de CEO Dashboard) deixa ceo.data undefined → receitaCabeca cai em null
  // (linha mostra "—", só a meta fica visível), sem bloquear o resto da aba.
  const ceoKpis = (ceo.data as { kpis?: CeoKpiMin[] } | undefined)?.kpis;
  const receitaCabeca = ceoKpis?.find((k) => k.key === "receita_cabeca")?.valor ?? null;

  const ltvMedioCliente = (ltv.data as OverviewData | undefined)?.ltvMedioCliente ?? null;

  // Último ponto válido da série mensal de churn % (mesma fonte que a linha "Churn R$" abaixo).
  const churnSerie = tm.receitaChurnSeries ?? [];
  const churnPctAtual = churnSerie.length > 0 ? churnSerie[churnSerie.length - 1].churnPct : null;

  const secoes: ScorecardSection[] = [
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
          serie: serieComLabel<VendasSeriePonto>(rm.data.contratosMes.vendasSeries, (r) => r.vendasMrr),
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
          // "atual" e distorce o status vs. a meta. Mesma fonte/meta da aba Receita.
          atual: tm.crosssellMrr,
          formato: "brl",
          metaKey: "sales_mrr_monetization_target",
          temporalidade: "mes",
        },
        {
          key: "visao_entregas",
          metrica: "Entregas (R$)",
          atual: p.entregasMes.total,
          formato: "brl",
          temporalidade: "mes",
        },
        {
          key: "visao_receita_cabeca",
          metrica: "Receita / Cabeça",
          sub: ceo.isError ? "sem permissão" : undefined,
          atual: receitaCabeca,
          formato: "brl",
          metaKey: "receita_cabeca",
          temporalidade: "mes",
        },
        {
          key: "visao_ltv_medio",
          metrica: "LTV médio/cliente",
          atual: ltvMedioCliente,
          formato: "brl",
          temporalidade: "snapshot",
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
