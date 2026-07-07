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
} from "./hooks";
import { paramsParaMes, labelMes } from "./temporalidade";
import type { ScorecardSection, ScorecardSeriePonto, ScorecardResponsavelItem } from "./scorecard/tipos";
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

// Tipos válidos aceitos por /api/gestao/receita/detalhe (server/routes/gestaoReceita.detalhe.ts,
// const TIPOS). "venda"/"churn" (soltos) NÃO existem — usar "venda_mrr"/"venda_pontual" e
// "churn_motivo"/"churn_vendedor" (que exigem uma chave específica, não "total").

export interface MontarSecoesReceitaExtras {
  /** Abre o DrillSheet (estado fica no componente) — omitido = linha "Nova receita" sem drill. */
  onDrill?: (tipo: string, chave: string) => void;
}

/** Função pura: monta as seções de Receita a partir do payload já resolvido de
   /api/reports/mensal. Extraída de SecaoReceita para reuso pela aba Consolidado. */
export function montarSecoesReceita(rm: ReportsMensal, extras: MontarSecoesReceitaExtras = {}): ScorecardSection[] {
  const tm = rm.turboMetrics;
  const p = rm.pontualData;

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
          key: "receita_pontual_crosssell",
          metrica: "Cross-sell",
          atual: tm.crosssellPontual,
          formato: "brl",
          serie: serieCrosssell(tm.crosssellHistorico, (r) => r.pontual),
          temporalidade: "mes",
        },
        {
          key: "receita_pontual_em_aberto",
          metrica: "Em aberto (estoque)",
          sub: `${p.emAberto.contratos} itens`,
          atual: p.emAberto.valor,
          formato: "brl",
          // Snapshot do estoque em aberto (não é fluxo do mês) — sem meta/série mensal, marcado
          // como "snapshot" (Scorecard renderiza badge dedicado e não calcula Δ M-1/status).
          temporalidade: "snapshot",
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

  const secoes = montarSecoesReceita(rm.data, { onDrill: abrirDrill });

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
