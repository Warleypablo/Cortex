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
  direcao: "maior_melhor" | "menor_melhor" | "neutro";
  unidade?: "brl" | "int" | "pct" | "dec";
  nota?: string;
  info?: { definicao: string; fonte: string; calculo: string };
  destaque?: boolean;
  grupo?: string;      // bloco (ex.: Recorrente / Pontual) — agrupa linhas na tabela
  segmento?: string;   // produto (ex.: Performance / Creators) — sub-cabeçalho por produto
  meses: BPMes[];
  ytd: { orcado: number; realizado: number | null; atingimento: number | null };
}

const TOTAL_COLUNAS = 14; // Linha + 12 meses + YTD

const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function corAtingimento(
  a: number | null,
  direcao: "maior_melhor" | "menor_melhor" | "neutro" = "maior_melhor"
): string {
  if (a === null) return "text-gray-400 dark:text-zinc-500";
  if (direcao === "neutro") return "text-gray-500 dark:text-zinc-400";
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
function fmtValor(v: number | null, unidade: "brl" | "int" | "pct" | "dec" = "brl"): string {
  if (v === null) return "—";
  if (unidade === "pct") return `${(v * 100).toFixed(1)}%`;
  if (unidade === "dec")
    return v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return Math.round(v).toLocaleString("pt-BR");
}

interface CelulaProps {
  orcado: number;
  realizado: number | null;
  atingimento: number | null;
  direcao: "maior_melhor" | "menor_melhor" | "neutro";
  unidade: "brl" | "int" | "pct" | "dec";
  parcial?: boolean;
}

function Celula({ orcado, realizado, atingimento, direcao, unidade, parcial }: CelulaProps) {
  // gasto/receita sem orçamento: precisa saltar aos olhos, não virar "—"
  const naoOrcado = atingimento === null && orcado === 0 && realizado !== null && realizado > 0;
  // mês parcial: atingimento sem cor semântica (compara dias corridos com mês cheio)
  const corAting = parcial
    ? "text-gray-400 dark:text-zinc-500"
    : naoOrcado
      ? direcao === "menor_melhor"
        ? "text-red-600 dark:text-red-400"
        : "text-amber-600 dark:text-amber-400"
      : corAtingimento(atingimento, direcao);
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="text-xs font-medium tabular-nums text-gray-900 dark:text-white">
        {fmtValor(realizado, unidade)}
      </span>
      <span className="text-[10px] tabular-nums text-gray-500 dark:text-zinc-500">
        {fmtValor(orcado, unidade)}
      </span>
      <span className={`text-[10px] font-semibold tabular-nums ${corAting}`}>
        {naoOrcado ? "não orç." : fmtPct(atingimento)}
      </span>
    </div>
  );
}

interface Props {
  linhas: BPLinha[];
  mesCorrente: number; // 0-12 (mês atual; parcial quando > mesFechado)
  mesFechado: number; // 0-12 (último mês fechado — período do acumulado)
  onCellClick?: (metrica: string, mes: number) => void;
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
                realizado · orçado · ating.
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
          {(() => {
            const render: JSX.Element[] = [];
            let grupoAnterior: string | undefined;
            let segAnterior: string | undefined;
            linhas.forEach((linha) => {
              // cabeçalho de bloco (ex.: Recorrente / Pontual)
              if (linha.grupo && linha.grupo !== grupoAnterior) {
                render.push(
                  <tr key={`bloco-${linha.grupo}`} className="bg-gray-100 dark:bg-zinc-800/80">
                    <td colSpan={TOTAL_COLUNAS} className="sticky left-0 z-10 bg-gray-100 dark:bg-zinc-800/80 px-4 py-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 border-t-2 border-gray-300 dark:border-zinc-600">
                      {linha.grupo}
                    </td>
                  </tr>
                );
                grupoAnterior = linha.grupo;
                segAnterior = undefined;
              }
              // sub-cabeçalho de produto (ex.: Performance / Creators)
              if (linha.segmento && linha.segmento !== segAnterior) {
                render.push(
                  <tr key={`seg-${linha.grupo}-${linha.segmento}`} className="bg-gray-50 dark:bg-zinc-800/40">
                    <td colSpan={TOTAL_COLUNAS} className="sticky left-0 z-10 bg-gray-50 dark:bg-zinc-800/40 px-4 py-1.5 text-xs font-semibold text-gray-700 dark:text-zinc-300 border-t border-gray-200 dark:border-zinc-700">
                      {linha.segmento}
                    </td>
                  </tr>
                );
                segAnterior = linha.segmento;
              }
              const ehTotal =
                linha.destaque ??
                (linha.metrica === "receita_total_faturavel" ||
                  linha.metrica === "receita_liquida" ||
                  linha.metrica === "margem_bruta" ||
                  linha.metrica === "ebitda" ||
                  linha.metrica === "geracao_caixa" ||
                  linha.metrica === "dfc_real");
              const ehEstoque = linha.tipoAgregacao === "estoque";
              // sob um sub-cabeçalho de produto, encurta o título (remove "Produto — ")
              const tituloLinha = linha.segmento ? linha.titulo.replace(`${linha.segmento} — `, "") : linha.titulo;
              render.push(
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
                  } ${linha.segmento ? "pl-8" : ""}`}
                >
                  <span className="flex items-center gap-1.5">
                    {tituloLinha}
                    {(linha.info || linha.nota || ehEstoque) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 shrink-0 text-gray-400 dark:text-zinc-500" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-80 space-y-1.5">
                          {linha.info && (
                            <>
                              <p>{linha.info.definicao}</p>
                              <p>
                                <span className="font-semibold">Fonte:</span> {linha.info.fonte}
                              </p>
                              <p>
                                <span className="font-semibold">Cálculo:</span> {linha.info.calculo}
                              </p>
                            </>
                          )}
                          {linha.nota && (
                            <p className="border-t border-white/20 pt-1.5">{linha.nota}</p>
                          )}
                          {ehEstoque && (
                            <p className="text-[11px] opacity-80">
                              Métrica de posição: o acumulado mostra o último mês fechado, não a soma.
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </span>
                </td>
                {linha.meses.map((m) => {
                    const clicavel = !!onCellClick && m.realizado !== null;
                    return (
                      <td
                        key={m.mes}
                        className={`px-2 py-2 text-right align-top${clicavel ? " cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/70" : ""}`}
                        onClick={clicavel ? () => onCellClick!(linha.metrica, m.mes) : undefined}
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
                          <Celula orcado={m.orcado} realizado={m.realizado} atingimento={m.atingimento} direcao={linha.direcao} unidade={linha.unidade ?? "brl"} parcial={m.mes === mesCorrente && mesCorrente > mesFechado} />
                        </span>
                      </td>
                    );
                  })}
                <td className="px-3 py-2 text-right align-top border-l border-gray-200 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-800/50">
                  <Celula
                    orcado={linha.ytd.orcado}
                    realizado={linha.ytd.realizado}
                    atingimento={linha.ytd.atingimento}
                    direcao={linha.direcao}
                    unidade={linha.unidade ?? "brl"}
                  />
                </td>
              </tr>
              );
            });
            return render;
          })()}
        </tbody>
      </table>
    </div>
  );
}
