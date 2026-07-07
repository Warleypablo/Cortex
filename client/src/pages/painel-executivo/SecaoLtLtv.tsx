import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Info } from "lucide-react";
import { Scorecard, type ScorecardModo } from "./scorecard/Scorecard";
import {
  useLtLtvOverview,
  useLtLtvDist,
  useLtLtvClientes,
  useScorecardMetas,
  useScorecardResponsaveis,
  useSalvarResponsaveis,
} from "./hooks";
import type { ScorecardSection, ScorecardRow, ScorecardResponsavelItem } from "./scorecard/tipos";
import type { OverviewData, BucketDist, ClienteRow } from "@/components/lt-ltv-churn/types";
import { ErroCard } from "./_ui";

/** Aviso fixo: TODOS os dados desta aba são temporalidade="snapshot" — os endpoints
   /api/lt-ltv-churn/* ignoram o mês selecionado no topo da página e refletem a base
   ativa ATUAL (vw_lt_contratos, sem filtro de data). */
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

export function SecaoLtLtv({ mes, modo }: { mes: string; modo: ScorecardModo }) {
  const overviewQ = useLtLtvOverview();
  const distQ = useLtLtvDist();
  const clientesQ = useLtLtvClientes();
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

  const secoes: ScorecardSection[] = [
    {
      id: "lt-ltv-base-ativa",
      titulo: "LT / LTV — Base ativa (snapshot)",
      linhas: [
        {
          key: "lt_ltv_lt_medio_ativo",
          metrica: "LT médio ativo",
          atual: overview.ltMedioAtivo,
          formato: "meses",
          temporalidade: "snapshot",
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
          temporalidade: "snapshot",
        },
        {
          key: "lt_ltv_total_recorrentes",
          metrica: "Total recorrentes",
          atual: overview.totalRecorrentes,
          formato: "int",
          temporalidade: "snapshot",
        },
      ],
    },
    {
      id: "lt-ltv-maiores-clientes",
      titulo: "Maiores clientes por LTV (snapshot)",
      linhas: clienteRows,
    },
    {
      id: "lt-ltv-distribuicao",
      titulo: "Distribuição de LTV por cliente (snapshot)",
      linhas: distRows,
    },
  ];

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
