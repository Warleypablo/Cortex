import { Fragment } from "react";
import type { SemanaMetricas, MetricaChave, CelulaSelecionada } from "./types";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtPct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

interface Linha {
  chave: MetricaChave;
  rotulo: string;
  /** percentual em vez de moeda */
  percentual?: boolean;
  /** recuo, para a linha de % logo abaixo do valor que ela qualifica */
  indentada?: boolean;
  /** abre o drawer ao clicar */
  drill?: boolean;
  /** direção que conta como melhora, para a cor do Δ */
  melhor?: "up" | "down";
}

interface Secao {
  titulo: string;
  linhas: Linha[];
}

// A ordem espelha os blocos da mensagem diária dos líderes.
export const SECOES: Secao[] = [
  {
    titulo: "Novas Vendas",
    linhas: [
      { chave: "mrrAdicionado", rotulo: "MRR Adicionado", drill: true, melhor: "up" },
      { chave: "pontualVendido", rotulo: "Pontual Vendido", drill: true, melhor: "up" },
    ],
  },
  {
    titulo: "Carteira (foto do fim da semana)",
    linhas: [
      { chave: "carteiraTriagemOnboarding", rotulo: "Triagem / Onboarding", melhor: "up" },
      { chave: "carteiraAtivo", rotulo: "Ativo", melhor: "up" },
      { chave: "carteiraEmCancelamento", rotulo: "Em Cancelamento", melhor: "down" },
      { chave: "mrrAtivo", rotulo: "MRR Ativo", melhor: "up" },
      { chave: "mrrOperando", rotulo: "MRR Operando", melhor: "up" },
      { chave: "entregaPontual", rotulo: "Entrega Pontual", drill: true, melhor: "up" },
    ],
  },
  {
    titulo: "Churn",
    linhas: [
      { chave: "churnMrrTotal", rotulo: "Churn MRR Total", drill: true, melhor: "down" },
      { chave: "churnMrrTotalPct", rotulo: "% da base", percentual: true, indentada: true, melhor: "down" },
      { chave: "churnMrrAjustado", rotulo: "Churn MRR Ajustado", drill: true, melhor: "down" },
      { chave: "churnMrrAjustadoPct", rotulo: "% da base", percentual: true, indentada: true, melhor: "down" },
      { chave: "churnPontualTotal", rotulo: "Churn Pontual Total", drill: true, melhor: "down" },
      { chave: "churnPontualTotalPct", rotulo: "% do estoque", percentual: true, indentada: true, melhor: "down" },
      { chave: "churnPontualAjustado", rotulo: "Churn Pontual Ajustado", drill: true, melhor: "down" },
    ],
  },
  {
    titulo: "Cross Sell",
    linhas: [
      { chave: "crossMrr", rotulo: "Cross Sell MRR", drill: true, melhor: "up" },
      { chave: "crossPontual", rotulo: "Cross Sell Pontual", drill: true, melhor: "up" },
      { chave: "crossTotal", rotulo: "Cross Sell Total", melhor: "up" },
    ],
  },
  {
    titulo: "Net Churn (MRR)",
    linhas: [
      { chave: "netChurnAjustado", rotulo: "Net Churn Ajustado", melhor: "down" },
      { chave: "netChurnAjustadoPct", rotulo: "% da base", percentual: true, indentada: true, melhor: "down" },
      { chave: "netChurnBruto", rotulo: "Net Churn Bruto", melhor: "down" },
    ],
  },
];

/**
 * Δ da última semana FECHADA contra a anterior. A semana em curso fica de fora:
 * comparar uma semana pela metade com uma inteira produz sempre uma queda
 * fantasma na segunda-feira.
 */
function calcularDelta(semanas: SemanaMetricas[], chave: MetricaChave): number | null {
  const fechadas = semanas.filter((s) => !s.parcial);
  if (fechadas.length < 2) return null;
  const atual = fechadas[fechadas.length - 1][chave];
  const anterior = fechadas[fechadas.length - 2][chave];
  if (typeof atual !== "number" || typeof anterior !== "number" || anterior === 0) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

function corDelta(delta: number | null, melhor: "up" | "down" | undefined): string {
  if (delta == null || delta === 0 || !melhor) return "text-gray-400 dark:text-zinc-500";
  const subiu = delta > 0;
  const bom = melhor === "up" ? subiu : !subiu;
  return bom ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
}

export function TabelaSemanal({
  semanas,
  onCelula,
}: {
  semanas: SemanaMetricas[];
  /** Sem handler, as células não são clicáveis — a tabela funciona sem o drill. */
  onCelula?: (c: CelulaSelecionada) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-zinc-900">
            <th className="sticky left-0 z-10 bg-gray-50 dark:bg-zinc-900 px-4 py-3 text-left font-semibold text-gray-700 dark:text-zinc-200 min-w-[220px]">
              Métrica
            </th>
            {semanas.map((s) => (
              <th
                key={s.inicio}
                className={`px-3 py-3 text-right font-semibold tabular-nums whitespace-nowrap ${
                  s.parcial
                    ? "text-gray-400 dark:text-zinc-500"
                    : "text-gray-700 dark:text-zinc-200"
                }`}
                title={`${s.inicio} a ${s.fim}`}
              >
                {s.label}
                {s.parcial && "*"}
              </th>
            ))}
            <th className="px-3 py-3 text-right font-semibold text-gray-700 dark:text-zinc-200 whitespace-nowrap">
              Δ
            </th>
          </tr>
        </thead>
        <tbody>
          {SECOES.map((secao) => (
            // Fragment com key: agrupa o cabeçalho da seção e suas linhas sem
            // um wrapper que quebraria a estrutura do <tbody>.
            <Fragment key={secao.titulo}>
              <tr className="bg-gray-100/70 dark:bg-zinc-800/50">
                <td
                  colSpan={semanas.length + 2}
                  className="sticky left-0 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400"
                >
                  {secao.titulo}
                </td>
              </tr>
              {secao.linhas.map((linha) => {
                const delta = calcularDelta(semanas, linha.chave);
                return (
                  <tr
                    key={linha.chave}
                    className="border-t border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/40"
                  >
                    <td
                      className={`sticky left-0 z-10 bg-white dark:bg-zinc-900 px-4 py-2 text-gray-700 dark:text-zinc-300 ${
                        linha.indentada ? "pl-8 text-xs text-gray-500 dark:text-zinc-500" : ""
                      }`}
                    >
                      {linha.rotulo}
                    </td>
                    {semanas.map((s) => {
                      const valor = s[linha.chave] as number;
                      const texto = linha.percentual ? fmtPct(valor) : fmtBRL(valor);
                      const clicavel = linha.drill === true && onCelula !== undefined;
                      return (
                        <td
                          key={s.inicio}
                          className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${
                            s.parcial ? "text-gray-400 dark:text-zinc-500" : "text-gray-900 dark:text-zinc-100"
                          } ${linha.indentada ? "text-xs" : ""} ${
                            clicavel ? "cursor-pointer hover:underline decoration-dotted" : ""
                          }`}
                          onClick={
                            clicavel
                              ? () =>
                                  onCelula!({
                                    metrica: linha.chave,
                                    rotulo: linha.rotulo,
                                    inicio: s.inicio,
                                    fim: s.fim,
                                    labelSemana: s.label,
                                  })
                              : undefined
                          }
                        >
                          {texto}
                        </td>
                      );
                    })}
                    <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap font-medium ${corDelta(delta, linha.melhor)}`}>
                      {delta == null
                        ? "—"
                        : `${delta > 0 ? "+" : ""}${delta.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
                    </td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
