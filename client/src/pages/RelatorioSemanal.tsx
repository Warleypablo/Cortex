import { usePageTitle } from "@/hooks/use-page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarRange, AlertTriangle } from "lucide-react";
import { useReporteSemanal } from "./relatorio-semanal/useRelatorioSemanal";
import { TabelaSemanal } from "./relatorio-semanal/TabelaSemanal";

export default function RelatorioSemanal() {
  usePageTitle("Reporte Semanal");
  const { data, isLoading, isError, error } = useReporteSemanal(12);

  const semanas = data?.semanas ?? [];
  const algumaVendaIndisponivel = semanas.some((s) => s.vendasIndisponivel);

  return (
    <div className="p-6 space-y-6">
      <div>
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-500">
          <CalendarRange className="h-3.5 w-3.5" /> Reportes
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Reporte Semanal
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
          As métricas do Resumo dos Líderes semana a semana (segunda a domingo), nas últimas 12 semanas.
        </p>
      </div>

      {algumaVendaIndisponivel && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            A apuração de vendas falhou em pelo menos uma semana. As linhas de MRR Adicionado,
            Pontual Vendido e Cross Sell podem estar zeradas por erro de consulta, não por ausência
            de vendas.
          </span>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : isError ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">
          Falha ao carregar o reporte: {(error as Error)?.message}
        </p>
      ) : (
        <TabelaSemanal semanas={semanas} />
      )}

      <div className="space-y-1 text-xs text-gray-500 dark:text-zinc-500">
        <p>
          <strong>*</strong> Semana em curso — dados parciais. Fica de fora do cálculo da coluna Δ.
        </p>
        <p>
          Δ compara a última semana fechada com a anterior.
        </p>
        <p>
          Cross Sell = deals ganhos marcados como <strong>Expansão de Conta</strong> no CRM. Novas
          Vendas = todo o resto dos deals ganhos. Mesma régua da mensagem diária dos líderes.
        </p>
        <p>
          Churn Ajustado desconsidera erro de venda, clientes que não iniciaram e inadimplência de
          até 1 mês. Percentuais de MRR usam a carteira no fechamento da semana anterior; os de
          pontual, o estoque em aberto na mesma data.
        </p>
      </div>

    </div>
  );
}
