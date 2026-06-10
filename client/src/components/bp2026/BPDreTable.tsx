// client/src/components/bp2026/BPDreTable.tsx
import {
  Tooltip, TooltipContent, TooltipTrigger,
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
  direcao: "maior_melhor" | "menor_melhor";
  nota?: string;
  meses: BPMes[];
  ytd: { orcado: number; realizado: number | null; atingimento: number | null };
}

const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function corAtingimento(
  a: number | null,
  direcao: "maior_melhor" | "menor_melhor" = "maior_melhor"
): string {
  if (a === null) return "text-gray-400 dark:text-zinc-500";
  if (direcao === "menor_melhor") {
    if (a <= 1) return "text-emerald-600 dark:text-emerald-400";
    if (a <= 1.1) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  }
  if (a >= 1) return "text-emerald-600 dark:text-emerald-400";
  if (a >= 0.9) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function fmtPct(a: number | null): string {
  return a === null ? "—" : `${(a * 100).toFixed(1)}%`;
}

// sem prefixo R$ para a tabela anual caber na tela; unidade indicada no cabeçalho
function fmtValor(v: number | null): string {
  return v === null ? "—" : Math.round(v).toLocaleString("pt-BR");
}

interface CelulaProps {
  orcado: number;
  realizado: number | null;
  atingimento: number | null;
  direcao: "maior_melhor" | "menor_melhor";
}

function Celula({ orcado, realizado, atingimento, direcao }: CelulaProps) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="text-xs font-medium tabular-nums text-gray-900 dark:text-white">
        {fmtValor(realizado)}
      </span>
      <span className="text-[10px] tabular-nums text-gray-500 dark:text-zinc-500">
        {fmtValor(orcado)}
      </span>
      <span className={`text-[10px] font-semibold tabular-nums ${corAtingimento(atingimento, direcao)}`}>
        {fmtPct(atingimento)}
      </span>
    </div>
  );
}

interface Props {
  linhas: BPLinha[];
  mesCorrente: number; // 0-12 (mês atual; parcial quando > mesFechado)
  mesFechado: number; // 0-12 (último mês fechado — período do acumulado)
  onCellClick: (metrica: string, mes: number) => void;
}

export function BPDreTable({ linhas, mesCorrente, mesFechado, onCellClick }: Props) {
  const ytdLabel = mesFechado >= 1 ? `YTD ${MESES_CURTOS[mesFechado - 1]}` : "YTD";
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-zinc-700">
      <table className="w-full text-sm" data-testid="bp-dre-table">
        <thead>
          <tr className="bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400">
            <th className="sticky left-0 z-10 bg-gray-50 dark:bg-zinc-800 px-4 py-3 text-left font-medium whitespace-nowrap">
              <div>Linha</div>
              <div className="text-[10px] font-normal normal-case text-gray-400 dark:text-zinc-500">
                realizado · orçado · ating. · valores em R$
              </div>
            </th>
            {MESES_CURTOS.map((nome, i) => {
              const mes = i + 1;
              const ehParcial = mes === mesCorrente && mesCorrente > mesFechado;
              return (
                <th key={mes} className="px-2 py-3 text-right font-medium whitespace-nowrap">
                  {nome}
                  {ehParcial && (
                    <span className="ml-1 text-[10px] font-normal text-amber-600 dark:text-amber-400">
                      parcial
                    </span>
                  )}
                </th>
              );
            })}
            <th className="px-3 py-3 text-right font-semibold whitespace-nowrap border-l border-gray-200 dark:border-zinc-700">
              {ytdLabel}
            </th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => {
            const ehTotal =
              linha.metrica === "receita_total_faturavel" ||
              linha.metrica === "receita_liquida" ||
              linha.metrica === "margem_bruta" ||
              linha.metrica === "ebitda" ||
              linha.metrica === "geracao_caixa" ||
              linha.metrica === "dfc_real";
            const ehEstoque = linha.tipoAgregacao === "estoque";
            return (
              <tr
                key={linha.metrica}
                className={
                  ehTotal
                    ? "bg-gray-100 dark:bg-zinc-800 font-bold text-gray-900 dark:text-white border-t border-gray-200 dark:border-zinc-700"
                    : "border-t border-gray-100 dark:border-zinc-800 text-gray-800 dark:text-zinc-200"
                }
                data-testid={`bp-linha-${linha.metrica}`}
              >
                <td
                  className={`sticky left-0 z-10 px-4 py-3 whitespace-nowrap align-top ${
                    ehTotal ? "bg-gray-100 dark:bg-zinc-800" : "bg-white dark:bg-zinc-900"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {linha.titulo}
                    {ehEstoque && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-gray-400 dark:text-zinc-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          MRR é estoque: o acumulado mostra a posição no último mês
                          fechado, não a soma dos meses.
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {linha.nota && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-gray-400 dark:text-zinc-500" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-72">{linha.nota}</TooltipContent>
                      </Tooltip>
                    )}
                  </span>
                </td>
                {linha.meses.map((m) => (
                  <td
                    key={m.mes}
                    className={`px-2 py-2 text-right align-top${m.realizado !== null ? " cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/70" : ""}`}
                    onClick={m.realizado !== null ? () => onCellClick(linha.metrica, m.mes) : undefined}
                  >
                    <span className="inline-flex items-start gap-1">
                      {m.fonteAproximada && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="mt-0.5 h-3 w-3 text-amber-500 dark:text-amber-400" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Snapshot do ClickUp não disponível no último dia do mês;
                            usado o mais próximo anterior.
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <Celula orcado={m.orcado} realizado={m.realizado} atingimento={m.atingimento} direcao={linha.direcao} />
                    </span>
                  </td>
                ))}
                <td className="px-3 py-2 text-right align-top border-l border-gray-200 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-800/50">
                  <Celula
                    orcado={linha.ytd.orcado}
                    realizado={linha.ytd.realizado}
                    atingimento={linha.ytd.atingimento}
                    direcao={linha.direcao}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
