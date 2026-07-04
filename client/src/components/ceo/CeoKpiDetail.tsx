import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

interface ItemDet { nome: string; detalhe: string; data: string | null; valor: number; url?: string }
interface GrupoDet { titulo: string; total: number; sinal?: "+" | "-"; formato: "brl" | "num"; itens: ItemDet[]; itensOmitidos?: { qtd: number; valor: number } }
interface DetalheResponse {
  kpi: string; titulo: string; mes: number;
  orcado: number | null; realizado: number | null; atingimentoPct: number | null;
  grupos: GrupoDet[]; nota?: string;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const fmt = (v: number, f: "brl" | "num") => (f === "num" ? int.format(v) : brl.format(v));

export function CeoKpiDetail({ kpiKey, mes, onClose }: { kpiKey: string | null; mes: string; onClose: () => void }) {
  const aberto = kpiKey !== null;
  const { data, isLoading, isError } = useQuery<DetalheResponse>({
    queryKey: ["/api/ceo-dashboard/detalhe", { kpi: kpiKey, mes }],
    enabled: aberto,
  });

  return (
    <Sheet open={aberto} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-white dark:bg-zinc-900">
        <SheetHeader>
          <SheetTitle className="text-gray-900 dark:text-white">
            {data?.titulo ?? "Detalhe"}{data ? ` · ${MESES[data.mes - 1]} 2026` : ""}
          </SheetTitle>
          <SheetDescription className="text-gray-500 dark:text-zinc-400">
            {data && (data.orcado != null
              ? `Orçado ${brl.format(data.orcado)} · Realizado ${data.realizado != null ? brl.format(data.realizado) : "—"}${data.atingimentoPct != null ? ` · ${Math.round(data.atingimentoPct)}% da meta` : ""}`
              : data.realizado != null ? `Realizado ${brl.format(data.realizado)}` : "")}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {isLoading && <><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></>}
          {isError && <p className="text-sm text-rose-600 dark:text-rose-400">Falha ao carregar o detalhamento.</p>}
          {data && data.grupos.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-zinc-500">Sem detalhamento para este mês.</p>
          )}
          {data && data.grupos.map((g) => {
            const totalDisplay = g.formato === "num"
              ? int.format(g.itens.length ? g.itens.length + (g.itensOmitidos?.qtd ?? 0) : g.total)
              : brl.format(g.total);
            const prefixo = g.sinal ? `${g.sinal} ` : "";
            return (
              <details key={g.titulo} open={data.grupos.length <= 4} className="rounded-lg border border-gray-200 dark:border-zinc-700">
                <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <span>{prefixo}{g.titulo}</span>
                  <span className="tabular-nums">{totalDisplay}</span>
                </summary>
                {g.itens.length > 0 && (
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
                        {g.formato === "brl" && (
                          <span className="shrink-0 tabular-nums text-gray-900 dark:text-white">{brl.format(it.valor)}</span>
                        )}
                      </div>
                    ))}
                    {g.itensOmitidos && (
                      <p className="px-3 py-1.5 text-xs text-gray-500 dark:text-zinc-500">
                        +{g.itensOmitidos.qtd} itens ({g.formato === "num" ? int.format(g.itensOmitidos.qtd) : brl.format(g.itensOmitidos.valor)})
                      </p>
                    )}
                  </div>
                )}
              </details>
            );
          })}
          {data?.nota && <p className="text-xs text-gray-500 dark:text-zinc-500">{data.nota}</p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
