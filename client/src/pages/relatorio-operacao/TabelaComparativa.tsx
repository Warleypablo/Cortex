import { Fragment } from "react";
import { calcularDelta } from "@shared/delta";
import { CelulaDelta, type Direcao } from "./CelulaDelta";
import type { Comparativo, MetricaChave, MetricaDrill, CelulaSelecionada } from "./types";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtPct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const fmtNum = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

interface Linha {
  chave: MetricaChave;
  rotulo: string;
  formato?: "moeda" | "percentual" | "inteiro";
  /** recuo, para a linha de % logo abaixo do valor que ela qualifica */
  indentada?: boolean;
  /** métrica do drill; sem ela a célula não é clicável */
  drill?: MetricaDrill;
  /** direção que conta como melhora, para a cor do Δ */
  melhor?: Direcao;
}

interface Secao {
  titulo: string;
  linhas: Linha[];
}

export const SECOES: Secao[] = [
  {
    titulo: "MRR (foto do fim da semana)",
    linhas: [
      { chave: "mrrAtivo", rotulo: "MRR Ativo", melhor: "up" },
      { chave: "mrrOperando", rotulo: "MRR Operando", melhor: "up" },
    ],
  },
  {
    titulo: "Churn de MRR",
    linhas: [
      { chave: "churnMrrTotal", rotulo: "Churn Total", drill: "churnMrrTotal", melhor: "down" },
      { chave: "churnMrrAbonado", rotulo: "Churn Abonado", drill: "churnMrrAbonado", melhor: "up" },
      { chave: "churnMrrLiquido", rotulo: "Churn Líquido", drill: "churnMrrLiquido", melhor: "down" },
      { chave: "churnMrrLiquidoPct", rotulo: "% da base", formato: "percentual", indentada: true, melhor: "down" },
    ],
  },
  {
    titulo: "Churn de Pontual",
    linhas: [
      { chave: "churnPontualTotal", rotulo: "Churn Total", drill: "churnPontualTotal", melhor: "down" },
      { chave: "churnPontualAbonado", rotulo: "Churn Abonado", drill: "churnPontualAbonado", melhor: "up" },
      { chave: "churnPontualLiquido", rotulo: "Churn Líquido", drill: "churnPontualLiquido", melhor: "down" },
      { chave: "churnPontualLiquidoPct", rotulo: "% do estoque", formato: "percentual", indentada: true, melhor: "down" },
    ],
  },
  {
    titulo: "Pontual",
    linhas: [
      { chave: "entregaPontual", rotulo: "Pontual Entregue", drill: "entregaPontual", melhor: "up" },
      { chave: "estoquePontual", rotulo: "Estoque Pontual", drill: "estoquePontual", melhor: "down" },
    ],
  },
  {
    titulo: "Produtividade",
    linhas: [
      { chave: "headcountOperacao", rotulo: "Headcount Operação", formato: "inteiro" },
      { chave: "mrrPorCabeca", rotulo: "MRR por cabeça", melhor: "up" },
      { chave: "faturamentoPorCabeca", rotulo: "Faturamento por cabeça", melhor: "up" },
    ],
  },
];

function formatar(valor: number | null, formato: Linha["formato"]): string {
  if (valor === null) return "—";
  if (formato === "percentual") return fmtPct(valor);
  if (formato === "inteiro") return fmtNum(valor);
  return fmtBRL(valor);
}

export function TabelaComparativa({
  dados,
  onCelula,
}: {
  dados: Comparativo;
  /** Sem handler, as células não são clicáveis — a tabela funciona sem o drill. */
  onCelula?: (c: CelulaSelecionada) => void;
}) {
  const periodo = (s: { inicio: string; fim: string }) =>
    `${s.inicio.slice(8, 10)}/${s.inicio.slice(5, 7)} – ${s.fim.slice(8, 10)}/${s.fim.slice(5, 7)}`;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-zinc-900">
            <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-zinc-200 min-w-[220px]">
              Métrica
            </th>
            <th className="px-3 py-3 text-right font-semibold text-gray-700 dark:text-zinc-200 whitespace-nowrap">
              {periodo(dados.atual)}
            </th>
            <th className="px-3 py-3 text-right font-semibold text-gray-500 dark:text-zinc-400 whitespace-nowrap">
              {periodo(dados.anterior)}
            </th>
            <th className="px-3 py-3 text-right font-semibold text-gray-700 dark:text-zinc-200">Δ</th>
          </tr>
        </thead>
        <tbody>
          {SECOES.map((secao) => (
            <Fragment key={secao.titulo}>
              <tr className="bg-gray-100/70 dark:bg-zinc-800/50">
                <td
                  colSpan={4}
                  className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400"
                >
                  {secao.titulo}
                </td>
              </tr>
              {secao.linhas.map((linha) => {
                const atual = dados.atual[linha.chave] as number | null;
                const anterior = dados.anterior[linha.chave] as number | null;
                const percentual = linha.formato === "percentual";
                const delta = calcularDelta(atual, anterior, percentual);
                const clicavel = linha.drill !== undefined && onCelula !== undefined;
                return (
                  <tr
                    key={linha.chave}
                    className="border-t border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/40"
                  >
                    <td
                      className={`px-4 py-2 text-gray-700 dark:text-zinc-300 ${
                        linha.indentada ? "pl-8 text-xs text-gray-500 dark:text-zinc-500" : ""
                      }`}
                    >
                      {linha.rotulo}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums whitespace-nowrap text-gray-900 dark:text-zinc-100 ${
                        linha.indentada ? "text-xs" : ""
                      } ${clicavel ? "cursor-pointer hover:underline decoration-dotted" : ""}`}
                      onClick={
                        clicavel
                          ? () =>
                              onCelula!({
                                metrica: linha.drill!,
                                rotulo: `${linha.rotulo} · ${secao.titulo}`,
                                inicio: dados.atual.inicio,
                                fim: dados.atual.fim,
                              })
                          : undefined
                      }
                    >
                      {formatar(atual, linha.formato)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums whitespace-nowrap text-gray-500 dark:text-zinc-400 ${
                        linha.indentada ? "text-xs" : ""
                      } ${clicavel ? "cursor-pointer hover:underline decoration-dotted" : ""}`}
                      onClick={
                        clicavel
                          ? () =>
                              onCelula!({
                                metrica: linha.drill!,
                                rotulo: `${linha.rotulo} · ${secao.titulo}`,
                                inicio: dados.anterior.inicio,
                                fim: dados.anterior.fim,
                              })
                          : undefined
                      }
                    >
                      {formatar(anterior, linha.formato)}
                    </td>
                    <CelulaDelta delta={delta} melhor={linha.melhor} percentual={percentual} />
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
