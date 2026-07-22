import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useDetalheSemanal } from "./useRelatorioSemanal";
import type { CelulaSelecionada, LinhaDrillDeal, LinhaDrillChurn, MetricaChave } from "./types";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// Qual campo do deal compõe a célula clicada. Sem isso o total do drawer soma
// recorrente + pontual e nunca bate com uma célula que é só um dos dois.
// Partial (não Record<string, ...>): uma chave de MetricaChave sem entrada aqui
// deve virar `undefined` explícito, não cair em "recorrente" por acaso — um
// typo numa métrica nova precisa quebrar visivelmente, não silenciosamente.
const CAMPO_DA_METRICA: Partial<Record<MetricaChave, "recorrente" | "pontual">> = {
  mrrAdicionado: "recorrente",
  pontualVendido: "pontual",
  crossMrr: "recorrente",
  crossPontual: "pontual",
};

export function DrawerDetalhe({
  celula,
  onClose,
}: {
  celula: CelulaSelecionada | null;
  onClose: () => void;
}) {
  const { data, isLoading, isError, error } = useDetalheSemanal(celula);

  const linhas = data?.linhas ?? [];
  // Célula de deals é SEMPRE um único campo (rec OU pont), nunca os dois — ver
  // CAMPO_DA_METRICA acima. Célula de churn/entrega é Σ valor, sem esse split.
  const campoMetrica = celula ? CAMPO_DA_METRICA[celula.metrica] : undefined;
  const total =
    data?.tipo === "deals"
      ? (linhas as LinhaDrillDeal[]).reduce(
          (s, l) => s + (campoMetrica === "pontual" ? l.pontual : l.recorrente),
          0,
        )
      : (linhas as LinhaDrillChurn[]).reduce((s, l) => s + l.valor, 0);
  // Rótulo honesto do total: para deals, deixa explícito qual campo foi somado
  // — senão o usuário soma rec+pont na hora e estranha o número menor.
  const sufixoTotal =
    data?.tipo === "deals" ? (campoMetrica === "pontual" ? " em pontual" : " em recorrente") : "";

  return (
    <Sheet open={celula !== null} onOpenChange={(aberto) => !aberto && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{celula?.rotulo}</SheetTitle>
          <SheetDescription>
            Semana de {celula?.inicio.split("-").reverse().join("/")} a{" "}
            {celula?.fim.split("-").reverse().join("/")} · {linhas.length}{" "}
            {linhas.length === 1 ? "registro" : "registros"} · {fmtBRL(total)}
            {sufixoTotal}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : isError ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">
              Falha ao carregar: {(error as Error)?.message}
            </p>
          ) : linhas.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-zinc-500">
              Nenhum registro nesta semana.
            </p>
          ) : data?.tipo === "deals" ? (
            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
              {(linhas as LinhaDrillDeal[]).map((l, i) => (
                <div key={i} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-zinc-100">
                      {l.cliente}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-500">
                      {l.closer || "sem closer"} · {l.canal}
                      {l.data && ` · ${l.data.split("-").reverse().join("/")}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    {l.recorrente > 0 && (
                      <p className="text-sm text-gray-900 dark:text-zinc-100">{fmtBRL(l.recorrente)}<span className="text-xs text-gray-400 dark:text-zinc-500"> rec</span></p>
                    )}
                    {l.pontual > 0 && (
                      <p className="text-sm text-gray-600 dark:text-zinc-400">{fmtBRL(l.pontual)}<span className="text-xs text-gray-400 dark:text-zinc-500"> pont</span></p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
              {(linhas as LinhaDrillChurn[]).map((l, i) => (
                <div key={i} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-zinc-100">
                      {l.cliente}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {l.motivo && (
                        <span className="text-xs text-gray-500 dark:text-zinc-500">{l.motivo}</span>
                      )}
                      {l.abonado && (
                        <Badge variant="outline" className="text-[10px] py-0">abonado</Badge>
                      )}
                    </div>
                  </div>
                  <p className="shrink-0 text-sm tabular-nums text-gray-900 dark:text-zinc-100">
                    {fmtBRL(l.valor)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
