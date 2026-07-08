import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { Scorecard, type ScorecardModo } from "./scorecard/Scorecard";
import {
  useReportsMensal,
  useEstoqueOverview,
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
import type { EntregaProdutoMes, ReportsMensal } from "./tipos";

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** "YYYY-MM" → label curto (ex: "Jan") — mesmo padrão de `labelMesCurto` em SecaoChurn.tsx/
   SecaoReceita.tsx (duplicado localmente, não há util compartilhado entre seções). */
function labelMesCurto(mes: string): string {
  const m = Number(mes.split("-")[1]);
  return MESES_ABREV[m - 1] ?? mes;
}

// Shape espelha o handler de GET /api/estoque-pontual/overview (server/routes/estoquePontual.ts),
// confirmado lendo o SELECT — não há tipo compartilhado client/server para este endpoint
// (mesmo cast local já usado na v1 desta seção). Exportado para reuso por SecaoConsolidado.tsx.
export interface EstoqueOverview {
  valorEstoque: number;
  qtdItens: number;
  idadeMedia: number;
  qtdEnvelhecidos: number;
  valorEnvelhecidos: number;
}

/** Chave estável para linhas derivadas de listas variáveis (produto, operador) — usada como
   `metrica_key` de persistência do responsável manual (CelulaResponsavel), mesmo padrão de
   `slug` em SecaoChurn.tsx (determinística por entidade, não por índice de posição). */
function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Normaliza uma série que já vem com `label` do backend para o formato do Scorecard
   (mesmo helper de SecaoReceita.tsx). Propaga `month` (quando a fonte tiver) para o modo
   evolução truncar/realçar no mês selecionado (ver Scorecard.tsx). */
function serieComLabel<T extends { label: string; month?: string }>(rows: T[] | undefined, valor: (r: T) => number): ScorecardSeriePonto[] {
  return (rows ?? []).map((r) => ({ label: r.label, valor: valor(r), month: r.month }));
}

/** entregasPorTipo (techData) é um pivot { month, label, [tipo]: contagem } — soma os tipos
   por mês para virar uma série de CONTAGEM total de entregas tech. Confirmado lendo
   server/routes/relatorioMensalSlides.ts: tanto `entregasPorTipo` (COUNT(*) as entregas)
   quanto `techKpis.entregues` (COUNT(*) as entregues) contam linhas de
   cup_projetos_tech(_fechados) — mesma unidade (contagem, não R$), por isso a série soma
   corretamente com `atual: techKpis.entregues`. */
function serieEntregasTech(rows: Record<string, unknown>[] | undefined): ScorecardSeriePonto[] {
  return (rows ?? []).map((r) => {
    const month = typeof r.month === "string" ? r.month : undefined;
    const label = typeof r.label === "string" ? r.label : (month ?? "");
    const valor = Object.entries(r)
      .filter(([chave]) => chave !== "month" && chave !== "label")
      .reduce((acc, [, v]) => acc + (typeof v === "number" ? v : 0), 0);
    return { label, valor, month };
  });
}

/** Função pura: monta as seções de Entregas a partir do payload já resolvido de
   /api/reports/mensal + estoque/series (ambos isolados, toleram `undefined`). Extraída de
   SecaoEntregas para reuso pela aba Consolidado. */
export function montarSecoesEntregas(
  rm: ReportsMensal,
  estoque: EstoqueOverview | undefined,
  series: ScorecardSeriesResponse | undefined,
  mes: string,
): ScorecardSection[] {
  const p = rm.pontualData;
  const techKpis = rm.techData.kpis;

  // Ausente = mês sem snapshot de entregas por produto registrado ainda (ex: mês corrente
  // antes do fechamento) — mesma leitura da v1 desta seção.
  const serieMes = p.entregasPorProdutoMes.find((s) => s.month === mes);
  const produtoRows: ScorecardRow[] = serieMes
    ? Object.entries(serieMes.produtos)
        .sort((a, b) => b[1] - a[1])
        .map(([produto, valor]) => ({
          key: `entregas_produto_${slug(produto)}`,
          metrica: produto,
          atual: valor,
          formato: "brl",
          // Série real do produto ao longo do ano (payload já traz todos os meses) — antes só
          // existia o ponto do mês selecionado, então o modo evolução caía em "sem série".
          serie: p.entregasPorProdutoMes.map((m) => ({ month: m.month, label: m.label, valor: m.produtos[produto] ?? 0 })),
          temporalidade: "mes",
          drillParams: { tipo: "entregue", dim: "produto", valor: produto },
        }))
    : [];

  // Onda2-A: substitui o `topOperadores.topEntregas` (só do mês, sem série) pela série por
  // operador — mesma fonte para `atual` E `serie` (reconcilia número do mês com a linha do
  // tempo do modo Evolução). Formato "brl" (a query soma `valorp`, R$ entregue — não é mais
  // uma contagem de entregas).
  const operadorRows: ScorecardRow[] = linhasPorDimensao(series?.series.entregasPorOperador, mes, {
    keyFn: (dim) => `entregas_operador_${slug(dim)}`,
    formato: "brl",
    labelMes: labelMesCurto,
    top: 8,
    // Dono automático (o próprio operador) — célula somente-leitura, mesmo padrão de
    // operadorRows em SecaoChurn.tsx.
    responsavelAuto: true,
    drillParams: (dim) => ({ tipo: "entregue", dim: "operador", valor: dim }),
  });

  return [
    {
      id: "entregas-resumo",
      titulo: "Entregas — Resumo (mês)",
      linhas: [
        {
          key: "entregas_resumo_entregue",
          metrica: "Entregue (R$)",
          atual: p.entregasMes.total,
          formato: "brl",
          serie: serieComLabel<EntregaProdutoMes>(p.entregasPorProdutoMes, (r) => r.total),
          temporalidade: "mes",
          drillParams: { tipo: "entregue" },
        },
        {
          key: "entregas_resumo_tech",
          metrica: "Entregas Tech",
          atual: techKpis.entregues,
          formato: "int",
          serie: serieEntregasTech(rm.techData.entregasPorTipo),
          temporalidade: "mes",
        },
        {
          key: "entregas_resumo_no_prazo_pct",
          metrica: "Entregas no prazo %",
          // Não existe no payload de /api/reports/mensal (o cálculo equivalente só sai no
          // agregado trimestral de okrObjectives) — sem "atual", a linha mostra só a meta
          // (BP2026/OKR de entregas_no_prazo_pct).
          atual: null,
          formato: "pct",
          metaKey: "entregas_no_prazo_pct",
          temporalidade: "mes",
        },
      ],
    },
    {
      id: "entregas-produto",
      titulo: "Entregas — Por produto (mês)",
      subtitulo: produtoRows.length === 0 ? "sem entregas no mês" : undefined,
      linhas: produtoRows,
    },
    {
      id: "entregas-operador",
      titulo: "Entregas — Por operador (mês)",
      linhas: operadorRows,
    },
    {
      id: "entregas-aberto-entregue",
      titulo: "Aberto × Entregue",
      linhas: [
        {
          key: "entregas_aberto_estoque",
          metrica: "Aberto (estoque)",
          sub: estoque ? `${estoque.qtdItens} itens` : undefined,
          atual: estoque ? estoque.valorEstoque : null,
          formato: "brl",
          temporalidade: "snapshot",
          drillParams: { tipo: "estoque_aberto" },
        },
        {
          key: "entregas_aberto_entregue_mes",
          metrica: "Entregue no mês",
          atual: p.entregasMes.total,
          formato: "brl",
          // Mesma série já usada em "Entregue (R$)" no resumo — antes esta linha não tinha
          // série (caía em "sem série" no modo Evolução).
          serie: serieComLabel<EntregaProdutoMes>(p.entregasPorProdutoMes, (r) => r.total),
          temporalidade: "mes",
          drillParams: { tipo: "entregue" },
        },
      ],
    },
  ];
}

export function SecaoEntregas({ mes, modo }: { mes: string; modo: ScorecardModo }) {
  const rm = useReportsMensal(mes);
  const estoqueQ = useEstoqueOverview();
  // Série por operador (Onda2-A) — fonte de `operadorRows` abaixo. Falha/loading isolados
  // (não bloqueiam a seção): linhasPorDimensao devolve [] sem `series.data`.
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

  if (rm.isError) {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40">
        <CardContent className="flex items-center gap-2 py-4 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle className="h-4 w-4" /> Falha ao carregar entregas.
        </CardContent>
      </Card>
    );
  }
  if (rm.isLoading || !rm.data) {
    return <div className="space-y-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-56" />)}</div>;
  }

  // Query isolada (não bloqueia a seção inteira, mesma filosofia de SecaoChurn) — ausente
  // (loading ou erro) só zera a linha "Aberto (estoque)" (atual: null renderiza "—").
  const estoque = estoqueQ.data as EstoqueOverview | undefined;

  const secoes = montarSecoesEntregas(rm.data, estoque, series.data, mes);

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
