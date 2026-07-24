import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useDetalheOperacao } from "./useRelatorioOperacao";
import type { CelulaSelecionada } from "./types";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function DrawerDetalhe({
  celula,
  onClose,
}: {
  celula: CelulaSelecionada | null;
  onClose: () => void;
}) {
  const { data, isLoading, isError, error } = useDetalheOperacao(celula);
  const linhas = data?.linhas ?? [];
  const total = linhas.reduce((s, l) => s + l.valor, 0);

  // Estoque é foto de uma data, não fluxo de um período — descrever como
  // 'semana de X a Y' induziria a ler como entradas da semana.
  const ehFoto = celula?.metrica === "estoquePontual";
  const periodo = ehFoto
    ? `Foto de ${celula?.fim.split("-").reverse().join("/")}`
    : `Semana de ${celula?.inicio.split("-").reverse().join("/")} a ${celula?.fim
        .split("-")
        .reverse()
        .join("/")}`;

  return (
    <Sheet open={celula !== null} onOpenChange={(aberto) => !aberto && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{celula?.rotulo}</SheetTitle>
          <SheetDescription>
            {periodo} · {linhas.length} {linhas.length === 1 ? "registro" : "registros"} ·{" "}
            {fmtBRL(total)}
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
              Nenhum registro.
            </p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
              {linhas.map((l, i) => (
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
                        <Badge variant="outline" className="text-[10px] py-0">
                          abonado
                        </Badge>
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
