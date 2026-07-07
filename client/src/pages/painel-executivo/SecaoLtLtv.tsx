import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Info } from "lucide-react";
import { Scorecard, type ScorecardModo } from "./scorecard/Scorecard";
import { serieOverviewLtLtv } from "./scorecard/logica";
import {
  useLtLtvOverview,
  useLtLtvDist,
  useLtLtvClientes,
  useLtLtvEvolucaoProduto,
  useScorecardMetas,
  useScorecardResponsaveis,
  useSalvarResponsaveis,
} from "./hooks";
import type { ScorecardSection, ScorecardRow, ScorecardSeriePonto, ScorecardResponsavelItem } from "./scorecard/tipos";
import type {
  OverviewData,
  BucketDist,
  ClienteRow,
  EvolucaoProdutoTabelaData,
  EvolucaoProdutoTabelaCelula,
} from "@/components/lt-ltv-churn/types";
import { ErroCard } from "./_ui";

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** "YYYY-MM" → label curto (ex: "Jan") — mesmo padrão de `labelMesCurto` em SecaoChurn.tsx/
   SecaoEntregas.tsx. */
function labelMesCurto(mes: string): string {
  const m = Number(mes.split("-")[1]);
  return MESES_ABREV[m - 1] ?? mes;
}

/** Aviso fixo: os endpoints /api/lt-ltv-churn/overview (etc.) ignoram o mês selecionado no
   topo da página — `atual` sempre reflete a base ativa ATUAL (vw_lt_contratos, sem filtro de
   data), mesmo nas linhas que ganharam série (Onda4: LT médio ativo, LTV médio/cliente, Total
   recorrentes) ou têm temporalidade "mes" (LTV por produto). "LT médio cancelado", "Maiores
   clientes" e "Distribuição de LTV" continuam puro snapshot (sem série histórica). */
function AvisoSnapshot() {
  return (
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
      <CardContent className="flex items-center gap-2 py-3 text-sm text-amber-800 dark:text-amber-300">
        <Info className="h-4 w-4 shrink-0" />
        LT/LTV refletem a base ativa atual, não o mês selecionado.
      </CardContent>
    </Card>
  );
}

/** Chave estável para linhas derivadas de listas variáveis (faixa de distribuição) — mesmo
   padrão de `slug` usado em SecaoChurn.tsx. */
function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export interface MontarSecoesLtLtvEvolucaoProduto {
  data: EvolucaoProdutoTabelaData | undefined;
  isLoading: boolean;
  isError: boolean;
}

/** Função pura: monta as seções de LT/LTV a partir dos dados já resolvidos (snapshot, ignora
   `mes`). `evolucaoProduto` carrega `isLoading`/`isError` porque o texto exibido no subtítulo
   distingue os dois estados (mesmo comportamento do componente original). Extraída de
   SecaoLtLtv para reuso pela aba Consolidado. */
export function montarSecoesLtLtv(
  overview: OverviewData,
  dist: BucketDist[],
  clientes: ClienteRow[],
  evolucaoProduto: MontarSecoesLtLtvEvolucaoProduto,
): ScorecardSection[] {
  const clienteRows: ScorecardRow[] = clientes.slice(0, 10).map((c) => ({
    key: `lt_ltv_cliente_${c.idTask}`,
    metrica: c.nomeCliente ?? "—",
    sub: c.ltMeses != null ? `${c.ltMeses} meses` : undefined,
    atual: c.ltvTotal,
    formato: "brl",
    temporalidade: "snapshot",
  }));

  const distRows: ScorecardRow[] = dist.map((b) => ({
    key: `lt_ltv_dist_${slug(b.faixa)}`,
    metrica: b.faixa,
    atual: b.qtd,
    formato: "int",
    temporalidade: "snapshot",
  }));

  // Onda3: única seção de fato histórica desta aba — GET /api/lt-ltv-churn/evolucao-produto-tabela
  // devolve uma MATRIZ `celulas[produto][mes] = {lt, ltv, lt_mediana, ltv_mediana, n}` (shape
  // confirmado em server/routes/ltLtvChurn.helpers.ts:buildMatrizEvolucaoProduto, já consumido
  // por client/src/components/lt-ltv-churn/TabelaEvolucaoProduto.tsx). `produtos` já vem ordenado
  // (BUCKETS_ORDER: Performance, Social Media, Creators, Outros, Total) e só lista buckets com
  // dado — "Total" entra como mais uma linha (agregado, mesmo tratamento do componente acima).
  // Sem `mes` no endpoint (histórico completo) — `atual` é o ÚLTIMO ponto da própria série, não
  // o ponto do mês selecionado no topo da página (essa aba já ignora o seletor de mês, ver
  // AvisoSnapshot; aqui a métrica em si é mensal, só a "atual" não é filtrada por ele).
  const evolucaoProdutoRows: ScorecardRow[] = evolucaoProduto.data
    ? evolucaoProduto.data.produtos.map((produto) => {
        const porMes = evolucaoProduto.data!.celulas[produto] ?? {};
        const pontos: { mes: string; cell: EvolucaoProdutoTabelaCelula }[] = evolucaoProduto.data!.meses
          .map((mes) => ({ mes, cell: porMes[mes] }))
          .filter((p): p is { mes: string; cell: EvolucaoProdutoTabelaCelula } => p.cell !== undefined);
        const serie: ScorecardSeriePonto[] = pontos.map((p) => ({ month: p.mes, label: labelMesCurto(p.mes), valor: p.cell.ltv }));
        const ultimo = pontos.length > 0 ? pontos[pontos.length - 1] : undefined;
        return {
          key: `lt_ltv_evolucao_produto_${slug(produto)}`,
          metrica: produto,
          sub: ultimo ? `n=${ultimo.cell.n}` : undefined,
          atual: ultimo ? ultimo.cell.ltv : null,
          formato: "brl",
          serie,
          temporalidade: "mes",
        };
      })
    : [];

  // Onda4: série do overview (LT médio ativo, LTV médio/cliente, Total recorrentes) agregada da
  // MESMA matriz produto×mês da seção "LTV por produto (evolução)" acima — ponderada por `n`
  // (ver serieOverviewLtLtv). `atual` continua vindo do endpoint overview (grão diferente:
  // cliente×contrato/status vs. contrato×produto da matriz) — o último ponto da série pode
  // divergir um pouco do `atual`, é tendência, não o número de fechamento do mês. Sem dado
  // (evolucaoProduto.data ausente) → arrays vazios, linha cai para "sem série" (degradação
  // graciosa do próprio Scorecard, ver LinhaEvolucao).
  const overviewSeries = serieOverviewLtLtv(evolucaoProduto.data);
  const toScorecardSerie = (pontos: { month: string; valor: number }[]): ScorecardSeriePonto[] =>
    pontos.map((p) => ({ month: p.month, label: labelMesCurto(p.month), valor: p.valor }));
  const ltMedioSerie = toScorecardSerie(overviewSeries.lt);
  const ltvMedioSerie = toScorecardSerie(overviewSeries.ltv);
  const totalRecorrentesSerie = toScorecardSerie(overviewSeries.totalRecorrentes);

  return [
    {
      id: "lt-ltv-base-ativa",
      titulo: "LT / LTV — Base ativa (snapshot)",
      linhas: [
        {
          key: "lt_ltv_lt_medio_ativo",
          metrica: "LT médio ativo",
          atual: overview.ltMedioAtivo,
          formato: "meses",
          serie: ltMedioSerie.length > 0 ? ltMedioSerie : undefined,
          temporalidade: "mes",
        },
        {
          key: "lt_ltv_lt_medio_cancelado",
          metrica: "LT médio cancelado",
          atual: overview.ltMedioCancelado,
          formato: "meses",
          temporalidade: "snapshot",
        },
        {
          key: "lt_ltv_ltv_medio_cliente",
          metrica: "LTV médio/cliente",
          atual: overview.ltvMedioCliente,
          formato: "brl",
          serie: ltvMedioSerie.length > 0 ? ltvMedioSerie : undefined,
          temporalidade: "mes",
        },
        {
          key: "lt_ltv_total_recorrentes",
          metrica: "Total recorrentes",
          atual: overview.totalRecorrentes,
          formato: "int",
          serie: totalRecorrentesSerie.length > 0 ? totalRecorrentesSerie : undefined,
          temporalidade: "mes",
        },
      ],
    },
    {
      id: "lt-ltv-maiores-clientes",
      titulo: "Maiores clientes por LTV (snapshot)",
      subtitulo: "estado atual da base",
      linhas: clienteRows,
    },
    {
      id: "lt-ltv-distribuicao",
      titulo: "Distribuição de LTV por cliente (snapshot)",
      subtitulo: "estado atual da base",
      linhas: distRows,
    },
    {
      id: "lt-ltv-evolucao-produto",
      titulo: "LTV por produto (evolução)",
      subtitulo: evolucaoProduto.isLoading
        ? "carregando série…"
        : evolucaoProduto.isError
          ? "falha ao carregar série"
          : undefined,
      linhas: evolucaoProdutoRows,
    },
  ];
}

export function SecaoLtLtv({ mes, modo }: { mes: string; modo: ScorecardModo }) {
  const overviewQ = useLtLtvOverview();
  const distQ = useLtLtvDist();
  const clientesQ = useLtLtvClientes();
  // Histórico completo (Onda3) — query isolada (não bloqueia a aba): loading/erro só deixam
  // a seção "LTV por produto (evolução)" vazia, mesma filosofia de clientesQ/distQ acima.
  const evolucaoProdutoQ = useLtLtvEvolucaoProduto();
  // Aba 100% snapshot — sem metas hoje, mas mantém o hook por consistência com as demais
  // seções (caso metas de LT/LTV sejam cadastradas futuramente em cortex_core.scorecard_metas).
  useScorecardMetas(mes);
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

  if (overviewQ.isError) {
    return (
      <div className="space-y-4">
        <AvisoSnapshot />
        <ErroCard mensagem="Falha ao carregar LT/LTV. Tente recarregar." />
      </div>
    );
  }
  if (overviewQ.isLoading || !overviewQ.data) {
    return (
      <div className="space-y-4">
        <AvisoSnapshot />
        {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-56" />)}
      </div>
    );
  }

  const overview = overviewQ.data as OverviewData;
  const dist = (distQ.data as { ltv: BucketDist[]; lt: BucketDist[] } | undefined)?.ltv ?? [];
  const clientes = (clientesQ.data as { clientes: ClienteRow[] } | undefined)?.clientes ?? [];
  const evolucaoProduto = evolucaoProdutoQ.data as EvolucaoProdutoTabelaData | undefined;

  const secoes = montarSecoesLtLtv(overview, dist, clientes, {
    data: evolucaoProduto,
    isLoading: evolucaoProdutoQ.isLoading,
    isError: evolucaoProdutoQ.isError,
  });

  return (
    <div className="space-y-4">
      <AvisoSnapshot />
      <Scorecard
        secoes={secoes}
        mes={mes}
        modo={modo}
        metas={{}}
        responsaveis={responsaveis.data?.itens ?? []}
        onEditResponsavel={onEditResponsavel}
      />
    </div>
  );
}
