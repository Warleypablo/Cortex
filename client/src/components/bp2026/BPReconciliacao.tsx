// client/src/components/bp2026/BPReconciliacao.tsx
import { useQuery } from "@tanstack/react-query";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

interface ContratoMov {
  id_subtask: string; cliente: string; servico: string;
  valorrIni: number; valorrFim: number; delta: number;
  dataInicio?: string | null;
  ultimoSnapshot?: string | null; emCupChurn?: boolean;
}
interface Componente {
  chave: string; titulo: string; valor: number; n: number; contratos: ContratoMov[];
}
interface RecResponse {
  produto: string; mes: number; mrrInicio: number; mrrFim: number;
  reconcilia: boolean; componentes: Componente[];
}

const fmt = (v: number) =>
  `${v < 0 ? "−" : v > 0 ? "+" : ""}R$ ${Math.abs(Math.round(v)).toLocaleString("pt-BR")}`;
const fmtAbs = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;

interface Props {
  produto: string | null;
  mes: number | null;
  titulo: string;
  onClose: () => void;
}

export function BPReconciliacao({ produto, mes, titulo, onClose }: Props) {
  const aberto = produto !== null && mes !== null;
  const { data, isLoading, error } = useQuery<RecResponse>({
    queryKey: ["/api/bp2026/reconciliacao", { produto: produto ?? "", mes: String(mes ?? "") }],
    enabled: aberto,
  });

  return (
    <Sheet open={aberto} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-white dark:bg-zinc-900">
        <SheetHeader>
          <SheetTitle className="text-gray-900 dark:text-white">
            Reconciliação · {titulo} · {mes ? MESES[mes - 1] : ""} 2026
          </SheetTitle>
          <SheetDescription className="text-gray-600 dark:text-zinc-400">
            Movimento de MRR do fim do mês anterior até o fim deste mês.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {isLoading ? (
            <><Skeleton className="h-10 w-full" /><Skeleton className="h-40 w-full" /></>
          ) : error || !data ? (
            <p className="text-sm text-red-600 dark:text-red-400">Erro ao carregar a reconciliação.</p>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white">
                <span>MRR início (mês anterior)</span>
                <span className="tabular-nums">{fmtAbs(data.mrrInicio)}</span>
              </div>

              {data.componentes.map((c) => (
                <details key={c.chave} className="rounded-lg border border-gray-200 dark:border-zinc-700">
                  <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm text-gray-800 dark:text-zinc-200">
                    <span>{c.titulo} <span className="text-gray-400 dark:text-zinc-500">({c.n})</span></span>
                    <span className={`tabular-nums font-medium ${c.valor < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {fmt(c.valor)}
                    </span>
                  </summary>
                  <div className="border-t border-gray-100 dark:border-zinc-800">
                    {c.contratos.map((m) => (
                      <div key={m.id_subtask} className="flex items-start justify-between gap-2 px-3 py-1.5 text-xs border-b border-gray-50 dark:border-zinc-800/50 last:border-0">
                        <div className="min-w-0">
                          <p className="truncate text-gray-800 dark:text-zinc-200">{m.cliente}</p>
                          <p className="truncate text-gray-500 dark:text-zinc-500">
                            {[m.servico,
                              m.dataInicio ? `início ${m.dataInicio}` : null,
                              m.valorrIni != null && m.valorrFim != null && m.valorrIni !== m.valorrFim
                                ? `${fmtAbs(m.valorrIni)} → ${fmtAbs(m.valorrFim)}` : null,
                              c.chave === "saidas_sem_rastreio" ? `último ${m.ultimoSnapshot ?? "?"}` : null,
                              c.chave === "saidas_sem_rastreio" && m.emCupChurn === false ? "⚠ ausente em cup_churn" : null,
                            ].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <span className="shrink-0 tabular-nums text-gray-900 dark:text-white">{fmt(m.delta)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              ))}

              <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white">
                <span>MRR fim (este mês)</span>
                <span className="tabular-nums">{fmtAbs(data.mrrFim)}</span>
              </div>

              {!data.reconcilia && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠ Componentes não fecham com o MRR fim — investigar.
                </p>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
