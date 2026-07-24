import { calcularDelta } from "@shared/delta";
import { CelulaDelta } from "./CelulaDelta";
import type { Comparativo, CelulaSelecionada } from "./types";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function TabelaEstoqueProduto({
  dados,
  onCelula,
}: {
  dados: Comparativo;
  onCelula?: (c: CelulaSelecionada) => void;
}) {
  const totalAtual = dados.produtos.reduce((s, p) => s + p.atual, 0);
  const totalAnterior = dados.produtos.reduce((s, p) => s + p.anterior, 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-zinc-900">
            <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-zinc-200 min-w-[200px]">
              Produto
            </th>
            <th className="px-3 py-3 text-right font-semibold text-gray-700 dark:text-zinc-200">Estoque atual</th>
            <th className="px-3 py-3 text-right font-semibold text-gray-500 dark:text-zinc-400">Itens</th>
            <th className="px-3 py-3 text-right font-semibold text-gray-500 dark:text-zinc-400">Estoque anterior</th>
            <th className="px-3 py-3 text-right font-semibold text-gray-700 dark:text-zinc-200">Δ</th>
          </tr>
        </thead>
        <tbody>
          {dados.produtos.map((p) => {
            const delta = calcularDelta(p.atual, p.anterior);
            const clicavel = onCelula !== undefined;
            return (
              <tr
                key={p.chave}
                className="border-t border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/40"
              >
                <td
                  className={`px-4 py-2 text-gray-700 dark:text-zinc-300 ${
                    clicavel ? "cursor-pointer hover:underline decoration-dotted" : ""
                  }`}
                  onClick={
                    clicavel
                      ? () =>
                          onCelula!({
                            metrica: "estoquePontual",
                            rotulo: `Estoque Pontual · ${p.chave}`,
                            inicio: dados.atual.inicio,
                            fim: dados.atual.fim,
                            chave: p.chave,
                          })
                      : undefined
                  }
                >
                  {p.chave}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-zinc-100">
                  {fmtBRL(p.atual)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-zinc-400">
                  {p.qtdAtual}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-zinc-400">
                  {fmtBRL(p.anterior)}
                </td>
                {/* estoque parado melhora caindo: entregar reduz o estoque */}
                <CelulaDelta delta={delta} melhor="down" />
              </tr>
            );
          })}
          <tr className="border-t-2 border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 font-semibold">
            <td className="px-4 py-2 text-gray-700 dark:text-zinc-200">Total</td>
            <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-zinc-100">
              {fmtBRL(totalAtual)}
            </td>
            <td className="px-3 py-2" />
            <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-zinc-400">
              {fmtBRL(totalAnterior)}
            </td>
            <td className="px-3 py-2" />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
