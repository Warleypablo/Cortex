// client/src/components/bp2026/BPCellDetail.tsx
import { useQuery } from "@tanstack/react-query";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { BPLinha } from "./BPDreTable";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const DERIVADAS: Record<string, string[]> = {
  receita_total_faturavel: ["mrr_ativo", "receita_pontual", "outras_receitas"],
  receita_liquida: ["receita_total_faturavel", "inadimplencia", "impostos_receita"],
  margem_bruta: ["receita_liquida", "csv_salarios", "csv_beneficio", "csv_stack"],
  ebitda: ["margem_bruta", "cac", "sga", "bonus"],
  geracao_caixa: ["ebitda", "impostos_diretos", "capex"],
};

interface ItemDet { nome: string; detalhe: string; data: string | null; valor: number }
interface GrupoDet { titulo: string; total: number; itens: ItemDet[]; itensOmitidos?: { qtd: number; valor: number } }
interface DetalheResponse {
  metrica: string; mes: number; titulo: string;
  orcado: number | null; realizado: number | null;
  grupos: GrupoDet[];
  rateio?: { fracao: number; totalBruto: number; totalRateado: number };
  nota?: string;
}

function fmt(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

interface Props {
  metrica: string | null;
  mes: number | null;
  linhas: BPLinha[];
  onClose: () => void;
}

export function BPCellDetail({ metrica, mes, linhas, onClose }: Props) {
  const aberto = metrica !== null && mes !== null;
  const ehDerivada = metrica !== null && metrica in DERIVADAS;

  const { data, isLoading, error } = useQuery<DetalheResponse>({
    queryKey: ["/api/bp2026/detalhe", { metrica: metrica ?? "", mes: String(mes ?? "") }],
    enabled: aberto && !ehDerivada,
  });

  const linha = linhas.find((l) => l.metrica === metrica);
  const celula = linha && mes ? linha.meses[mes - 1] : null;

  return (
    <Sheet open={aberto} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-white dark:bg-zinc-900">
        <SheetHeader>
          <SheetTitle className="text-gray-900 dark:text-white">
            {linha?.titulo} · {mes ? MESES[mes - 1] : ""} 2026
          </SheetTitle>
          <SheetDescription className="text-gray-600 dark:text-zinc-400">
            Orçado {fmt(celula?.orcado)} · Realizado {fmt(celula?.realizado)}
            {celula?.atingimento != null && ` · ${(celula.atingimento * 100).toFixed(1)}%`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {ehDerivada && linha && mes ? (
            <div className="space-y-1">
              <p className="text-xs text-gray-500 dark:text-zinc-500 mb-2">
                Composição do mês (clique nas linhas-fonte da matriz para ver itens):
              </p>
              {DERIVADAS[metrica!].map((m) => {
                const comp = linhas.find((l) => l.metrica === m);
                const cm = comp?.meses[mes - 1];
                return (
                  <div key={m} className="flex items-center justify-between rounded border border-gray-100 dark:border-zinc-800 px-3 py-2 text-sm">
                    <span className="text-gray-800 dark:text-zinc-200">{comp?.titulo}</span>
                    <span className="tabular-nums text-gray-900 dark:text-white">{fmt(cm?.realizado)}</span>
                  </div>
                );
              })}
            </div>
          ) : isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : error || !data ? (
            <p className="text-sm text-red-600 dark:text-red-400">Erro ao carregar o detalhamento.</p>
          ) : data.grupos.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-zinc-500">Sem itens neste mês.</p>
          ) : (
            <>
              {data.grupos.map((g) => (
                <details key={g.titulo} open={data.grupos.length <= 3} className="rounded-lg border border-gray-200 dark:border-zinc-700">
                  <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white">
                    <span>{g.titulo}</span>
                    <span className="tabular-nums">{fmt(g.total)}</span>
                  </summary>
                  <div className="border-t border-gray-100 dark:border-zinc-800">
                    {g.itens.map((it, idx) => (
                      <div key={idx} className="flex items-start justify-between gap-2 px-3 py-1.5 text-xs border-b border-gray-50 dark:border-zinc-800/50 last:border-0">
                        <div className="min-w-0">
                          <p className="truncate text-gray-800 dark:text-zinc-200">{it.nome}</p>
                          {(it.detalhe || it.data) && (
                            <p className="truncate text-gray-500 dark:text-zinc-500">
                              {[it.detalhe, it.data].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 tabular-nums text-gray-900 dark:text-white">{fmt(it.valor)}</span>
                      </div>
                    ))}
                    {g.itensOmitidos && (
                      <p className="px-3 py-1.5 text-xs text-gray-500 dark:text-zinc-500">
                        +{g.itensOmitidos.qtd} itens ({fmt(g.itensOmitidos.valor)})
                      </p>
                    )}
                  </div>
                </details>
              ))}
              {data.rateio && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                  Caju total {fmt(data.rateio.totalBruto)} × fração orçada {(data.rateio.fracao * 100).toFixed(1)}% =
                  <strong> {fmt(data.rateio.totalRateado)}</strong> (valor da célula)
                </div>
              )}
              {data.nota && (
                <p className="text-xs text-gray-500 dark:text-zinc-500">{data.nota}</p>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
