import { useState } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CalendarRange, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { useReporteOperacao } from "./relatorio-operacao/useRelatorioOperacao";
import { TabelaComparativa } from "./relatorio-operacao/TabelaComparativa";
import { TabelaChurnMotivo } from "./relatorio-operacao/TabelaChurnMotivo";
import { TabelaEstoqueProduto } from "./relatorio-operacao/TabelaEstoqueProduto";
import { DrawerDetalhe } from "./relatorio-operacao/DrawerDetalhe";
import type { CelulaSelecionada } from "./relatorio-operacao/types";

/** Desloca uma data 'YYYY-MM-DD' em dias, em UTC (imune a fuso e horário de verão). */
function deslocarDias(data: string, dias: number): string {
  const [y, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + dias * 86400000).toISOString().slice(0, 10);
}

/**
 * Âncora do parâmetro `ate` que faz o servidor devolver como semana atual a
 * semana que TERMINA em `fim`.
 *
 * O servidor trata `ate` como um "hoje simulado" e descarta a semana que contém
 * essa data (é a semana em curso). Então passar o próprio domingo da semana
 * desejada devolveria a semana ERRADA — a anterior a ela. A âncora certa é o
 * dia seguinte, que cai na semana seguinte. Ver o teste 'CONTRATO DE ÂNCORA' em
 * server/reportsSemanal/semanas.test.ts.
 */
function ancoraPara(fim: string): string {
  return deslocarDias(fim, 1);
}

export default function RelatorioOperacao() {
  usePageTitle("Reporte Semanal de Operação");
  const [ate, setAte] = useState<string | undefined>(undefined);
  const [celula, setCelula] = useState<CelulaSelecionada | null>(null);
  const { data, isLoading, isError, error } = useReporteOperacao(ate);

  // Navegação sempre a partir do que a tela está mostrando, nunca de "hoje":
  // assim os cliques encadeiam corretamente. Avançar além do presente é inócuo
  // — o servidor ignora `ate` no futuro e volta para a última semana fechada.
  const voltar = () => data && setAte(ancoraPara(deslocarDias(data.atual.fim, -7)));
  const avancar = () => data && setAte(ancoraPara(deslocarDias(data.atual.fim, 7)));

  // Snapshot anterior ao início da semana = nenhum snapshot caiu dentro dela
  // inteira ("Clickup".cup_data_hist tem buracos de até 32 dias): carteira,
  // estoque e estoque por produto daquela coluna são, na prática, a foto da
  // semana anterior repetida — comparação de string funciona porque as duas
  // datas são 'YYYY-MM-DD'.
  const semFotoPropria = (s: { inicio: string; snapshotFim: string | null }) =>
    s.snapshotFim !== null && s.snapshotFim < s.inicio;
  const atualSemFoto = data ? semFotoPropria(data.atual) : false;
  const anteriorSemFoto = data ? semFotoPropria(data.anterior) : false;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-500">
            <CalendarRange className="h-3.5 w-3.5" /> Reportes
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Reporte Semanal de Operação
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            A última semana fechada (segunda a domingo) comparada com a anterior.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={voltar} disabled={isLoading}>
            <ChevronLeft className="h-4 w-4" /> Semana anterior
          </Button>
          <Button variant="outline" size="sm" onClick={avancar} disabled={isLoading || !ate}>
            Semana seguinte <ChevronRight className="h-4 w-4" />
          </Button>
          {ate && (
            <Button variant="ghost" size="sm" onClick={() => setAte(undefined)}>
              Hoje
            </Button>
          )}
        </div>
      </div>

      {(atualSemFoto || anteriorSemFoto) && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            {atualSemFoto && anteriorSemFoto
              ? "A semana atual e a anterior não têm foto própria: nenhum snapshot de carteira caiu dentro delas."
              : atualSemFoto
              ? "A semana atual não tem foto própria: nenhum snapshot de carteira caiu dentro dela."
              : "A semana anterior não tem foto própria: nenhum snapshot de carteira caiu dentro dela."}{" "}
            Os números de carteira, estoque e estoque por produto daquela coluna repetem os da foto
            anterior disponível.
          </span>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : isError ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">
          Falha ao carregar o reporte: {(error as Error)?.message}
        </p>
      ) : data ? (
        <div className="space-y-8">
          <TabelaComparativa dados={data} onCelula={setCelula} />

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Churn por motivo</h2>
            <TabelaChurnMotivo dados={data} onCelula={setCelula} />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Estoque pontual por produto
            </h2>
            <TabelaEstoqueProduto dados={data} onCelula={setCelula} />
          </section>
        </div>
      ) : null}

      <div className="space-y-1 text-xs text-gray-500 dark:text-zinc-500">
        <p>
          <strong>Churn Líquido = Churn Total − Churn Abonado</strong> (marcação{" "}
          <em>abonar churn</em> no ClickUp). Régua diferente do <strong>Churn Ajustado</strong> do BP
          2026 e do Reporte Semanal, que em vez do abono exclui os motivos Erro na Venda, Não começou
          e Inadimplente 1º Mês. Os dois números não batem, e nenhum dos dois está errado.
        </p>
        <p>
          Percentuais usam a carteira de <strong>abertura</strong> da semana — a mesma foto que
          aparece na coluna da semana anterior.
        </p>
        <p>
          Churn por motivo é <strong>bruto</strong> (abonados incluídos), então a coluna de MRR
          soma exatamente o Churn Total.
        </p>
        <p>
          <strong>Por cabeça</strong> usa o headcount de <strong>operação</strong> (Commerce e Tech
          Sites, sem as squads de Vendas) — não bate com a receita por cabeça do BP 2026, que divide
          pela empresa inteira. Faturamento por cabeça tem numerador mensal: dentro do mês só se
          move pelo headcount.
        </p>
        <p>
          <strong>*</strong> ao lado do Faturamento por cabeça marca um mês ainda em curso: o
          faturável usado no cálculo está incompleto, não é o mês fechado.
        </p>
      </div>

      <DrawerDetalhe celula={celula} onClose={() => setCelula(null)} />
    </div>
  );
}
