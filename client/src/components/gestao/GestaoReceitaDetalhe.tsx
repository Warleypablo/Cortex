// client/src/components/gestao/GestaoReceitaDetalhe.tsx
// Sheet lateral de drill-down da página Gestão de Receita — espelha o BPCellDetail.
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

export interface DrillRef { tipo: string; chave?: string }

interface ItemDet { nome: string; detalhe: string; data: string | null; valor: number; url?: string }
interface GrupoDet { titulo: string; total: number; itens: ItemDet[]; itensOmitidos?: { qtd: number; valor: number } }
interface DetalheResp { titulo: string; subtitulo: string; total: number; unidade: "brl" | "int"; grupos: GrupoDet[]; nota?: string }

const fmt = (v: number) => "R$ " + Math.round(v).toLocaleString("pt-BR");

export function GestaoReceitaDetalhe({ drill, mes, onClose }: { drill: DrillRef | null; mes: string; onClose: () => void }) {
  const aberto = drill !== null;
  const { data, isLoading, error } = useQuery<DetalheResp>({
    queryKey: ["/api/gestao/receita/detalhe", { tipo: drill?.tipo ?? "", chave: drill?.chave ?? "", mes }],
    enabled: aberto,
  });
  const isInt = data?.unidade === "int";

  return (
    <Sheet open={aberto} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-white dark:bg-zinc-900">
        <SheetHeader>
          <SheetTitle className="text-gray-900 dark:text-white">{data?.titulo ?? "Detalhamento"}</SheetTitle>
          <SheetDescription className="text-gray-600 dark:text-zinc-400">
            {data ? `Total: ${data.subtitulo}` : "Carregando…"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {isLoading ? (
            <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-32 w-full" /></div>
          ) : error || !data ? (
            <p className="text-sm text-red-600 dark:text-red-400">Erro ao carregar o detalhamento.</p>
          ) : data.grupos.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-zinc-500">Sem itens neste mês.</p>
          ) : (
            <>
              {data.grupos.map((g) => {
                const totalGrupo = isInt
                  ? (g.itens.length + (g.itensOmitidos?.qtd ?? 0)).toLocaleString("pt-BR")
                  : fmt(g.total);
                return (
                  <details key={g.titulo} open={data.grupos.length <= 3} className="rounded-lg border border-gray-200 dark:border-zinc-700">
                    <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white">
                      <span>{g.titulo}</span>
                      <span className="tabular-nums">{totalGrupo}</span>
                    </summary>
                    <div className="border-t border-gray-100 dark:border-zinc-800">
                      {g.itens.map((it, idx) => (
                        <div key={idx} className="flex items-start justify-between gap-2 px-3 py-1.5 text-xs border-b border-gray-50 dark:border-zinc-800/50 last:border-0">
                          <div className="min-w-0">
                            <p className="truncate text-gray-800 dark:text-zinc-200">
                              {it.url ? <a href={it.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">{it.nome}</a> : it.nome}
                            </p>
                            {(it.detalhe || it.data) && (
                              <p className="truncate text-gray-500 dark:text-zinc-500">{[it.detalhe, it.data].filter(Boolean).join(" · ")}</p>
                            )}
                          </div>
                          {!isInt && <span className="shrink-0 tabular-nums text-gray-900 dark:text-white">{fmt(it.valor)}</span>}
                        </div>
                      ))}
                      {g.itensOmitidos && (
                        <p className="px-3 py-1.5 text-xs text-gray-500 dark:text-zinc-500">
                          +{g.itensOmitidos.qtd} itens ({isInt ? g.itensOmitidos.qtd.toLocaleString("pt-BR") : fmt(g.itensOmitidos.valor)})
                        </p>
                      )}
                    </div>
                  </details>
                );
              })}
              {data.nota && <p className="text-xs text-gray-500 dark:text-zinc-500">{data.nota}</p>}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
