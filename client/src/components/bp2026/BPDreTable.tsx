// client/src/components/bp2026/BPDreTable.tsx
import { formatCurrencyNoDecimals } from "@/lib/utils";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

export interface BPMes {
  mes: number;
  orcado: number;
  realizado: number | null;
  atingimento: number | null;
  fonteAproximada?: boolean;
}

export interface BPLinha {
  metrica: string;
  titulo: string;
  tipoAgregacao: "fluxo" | "estoque";
  meses: BPMes[];
  ytd: { orcado: number; realizado: number | null; atingimento: number | null };
}

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function corAtingimento(a: number | null): string {
  if (a === null) return "text-gray-400 dark:text-zinc-500";
  if (a >= 1) return "text-emerald-600 dark:text-emerald-400";
  if (a >= 0.9) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function fmtPct(a: number | null): string {
  return a === null ? "—" : `${(a * 100).toFixed(1)}%`;
}

function fmtValor(v: number | null): string {
  return v === null ? "—" : formatCurrencyNoDecimals(v);
}

interface Props {
  linhas: BPLinha[];
  mes: number; // 1-12 (mês selecionado)
  mesFechado: number; // 0-12 (último mês fechado — período do YTD)
}

export function BPDreTable({ linhas, mes, mesFechado }: Props) {
  const ytdLabel = mesFechado >= 1 ? `YTD até ${MESES_CURTOS[mesFechado - 1]}` : "YTD";
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-zinc-700">
      <table className="w-full text-sm" data-testid="bp-dre-table">
        <thead>
          <tr className="bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400">
            <th className="px-4 py-3 text-left font-medium">Linha</th>
            <th className="px-4 py-3 text-right font-medium">Orçado</th>
            <th className="px-4 py-3 text-right font-medium">Realizado</th>
            <th className="px-4 py-3 text-right font-medium">Atingimento</th>
            <th className="px-4 py-3 text-right font-medium border-l border-gray-200 dark:border-zinc-700">
              {ytdLabel} · Orçado
            </th>
            <th className="px-4 py-3 text-right font-medium">{ytdLabel} · Realizado</th>
            <th className="px-4 py-3 text-right font-medium">{ytdLabel} · Ating.</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => {
            const m = linha.meses[mes - 1];
            const ehTotal = linha.metrica === "receita_total_faturavel";
            const ehEstoque = linha.tipoAgregacao === "estoque";
            return (
              <tr
                key={linha.metrica}
                className={
                  ehTotal
                    ? "bg-gray-100 dark:bg-zinc-800 font-bold text-gray-900 dark:text-white"
                    : "border-t border-gray-100 dark:border-zinc-800 text-gray-800 dark:text-zinc-200"
                }
                data-testid={`bp-linha-${linha.metrica}`}
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="flex items-center gap-1.5">
                    {linha.titulo}
                    {m.fonteAproximada && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-amber-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Snapshot do ClickUp não disponível no último dia do mês;
                            usado o mais próximo anterior.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtValor(m.orcado)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtValor(m.realizado)}</td>
                <td className={`px-4 py-3 text-right tabular-nums font-semibold ${corAtingimento(m.atingimento)}`}>
                  {fmtPct(m.atingimento)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums border-l border-gray-200 dark:border-zinc-700">
                  <span className="inline-flex items-center gap-1">
                    {fmtValor(linha.ytd.orcado)}
                    {ehEstoque && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-gray-400 dark:text-zinc-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            MRR é estoque: o acumulado mostra a posição no último mês
                            fechado, não a soma dos meses.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtValor(linha.ytd.realizado)}</td>
                <td className={`px-4 py-3 text-right tabular-nums font-semibold ${corAtingimento(linha.ytd.atingimento)}`}>
                  {fmtPct(linha.ytd.atingimento)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
