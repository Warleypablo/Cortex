import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { Scorecard, type ScorecardModo } from "./scorecard/Scorecard";
import { EmBreveCard } from "./EmBreveCard";
import {
  useReportsMensal,
  useLtLtvClientes,
  useScorecardMetas,
  useScorecardResponsaveis,
  useSalvarResponsaveis,
  useScorecardSeries,
} from "./hooks";
import type { ScorecardSection, ScorecardRow, ScorecardResponsavelItem } from "./scorecard/tipos";
import { linhasPorDimensao } from "./scorecard/logica";
import type { ClienteRow } from "@/components/lt-ltv-churn/types";

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** "YYYY-MM" → label curto (ex: "Jan") — mesmo padrão de `labelMesCurto` em SecaoChurn.tsx/
   SecaoEntregas.tsx (duplicado localmente, não há util compartilhado entre seções). */
function labelMesCurto(mes: string): string {
  const m = Number(mes.split("-")[1]);
  return MESES_ABREV[m - 1] ?? mes;
}

/** Chave estável para linhas derivadas de listas variáveis (operador, squad) — mesmo padrão
   de `slug` em SecaoChurn.tsx/SecaoEntregas.tsx (determinística por entidade, não por índice
   de posição). */
function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function SecaoPerformance({ mes, modo }: { mes: string; modo: ScorecardModo }) {
  const rm = useReportsMensal(mes);
  const clientesQ = useLtLtvClientes();
  // Série por operador/squad (Onda2-A/Onda3) — fonte de operadorRows/squadRows abaixo. Falha/
  // loading isolados (não bloqueiam a seção): linhasPorDimensao devolve [] sem `series.data`.
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
          <AlertTriangle className="h-4 w-4" /> Falha ao carregar performance.
        </CardContent>
      </Card>
    );
  }
  if (rm.isLoading || !rm.data) {
    return <div className="space-y-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-56" />)}</div>;
  }

  // Query isolada (não bloqueia a seção inteira, mesma filosofia de SecaoEntregas/estoqueQ) —
  // ausente (loading ou erro) só deixa a seção de maiores clientes vazia.
  const clientes = (clientesQ.data as { clientes: ClienteRow[] } | undefined)?.clientes ?? [];
  const topClientes = [...clientes].sort((a, b) => b.ltvTotal - a.ltvTotal).slice(0, 10);

  // Onda3: substitui `topOperadores.topMrrPontual`/`rankingSquads` (só do mês, sem série) pelas
  // séries por dimensão (mesma fonte de SecaoChurn/SecaoEntregas) — reconcilia número do mês
  // com a linha do tempo do modo Evolução.
  const operadorRows: ScorecardRow[] = linhasPorDimensao(series.data?.series.mrrPorOperador, mes, {
    keyFn: (dim) => `performance_operador_${slug(dim)}`,
    formato: "brl",
    labelMes: labelMesCurto,
    top: 10,
    // Dono automático (o próprio operador) — célula somente-leitura, mesmo padrão de
    // operadorRows em SecaoChurn.tsx/SecaoEntregas.tsx.
    responsavelAuto: true,
  });

  const squadRows: ScorecardRow[] = linhasPorDimensao(series.data?.series.mrrPorSquad, mes, {
    keyFn: (dim) => `performance_squad_${slug(dim)}`,
    formato: "brl",
    labelMes: labelMesCurto,
  });

  const clienteRows: ScorecardRow[] = topClientes.map((c) => ({
    key: `performance_cliente_${c.idTask}`,
    metrica: c.nomeCliente ?? "—",
    sub: c.ltMeses != null ? `${c.ltMeses} meses` : undefined,
    atual: c.ltvTotal,
    formato: "brl",
    temporalidade: "snapshot",
  }));

  const secoes: ScorecardSection[] = [
    {
      id: "performance-top-operadores",
      titulo: "Top operadores (mês)",
      subtitulo: series.isLoading ? "carregando série…" : series.isError ? "falha ao carregar série" : undefined,
      linhas: operadorRows,
    },
    {
      id: "performance-ranking-squads",
      titulo: "Ranking de squads (mês)",
      subtitulo: series.isLoading ? "carregando série…" : series.isError ? "falha ao carregar série" : undefined,
      linhas: squadRows,
    },
    {
      id: "performance-maiores-clientes",
      titulo: "Maiores clientes por R$ (snapshot)",
      linhas: clienteRows,
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
        <EmBreveCard titulo="Maiores crescimentos do mês" motivo="Fase 2 — requer delta MoM por cliente" />
        <EmBreveCard titulo="Maiores investimentos" motivo="Fase 2 — requer fonte de ads/Growth" />
      </div>
    </div>
  );
}
