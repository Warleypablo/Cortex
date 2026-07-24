import { calcularDelta } from "@shared/delta";
import { CelulaDelta } from "./CelulaDelta";
import type { Comparativo, CelulaSelecionada } from "./types";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function TabelaChurnMotivo({
  dados,
  onCelula,
}: {
  dados: Comparativo;
  onCelula?: (c: CelulaSelecionada) => void;
}) {
  const totalMrrAtual = dados.motivos.reduce((s, m) => s + m.atual, 0);
  const totalMrrAnterior = dados.motivos.reduce((s, m) => s + m.anterior, 0);
  const totalPontualAtual = dados.motivos.reduce((s, m) => s + m.pontualAtual, 0);
  const totalPontualAnterior = dados.motivos.reduce((s, m) => s + m.pontualAnterior, 0);

  if (dados.motivos.length === 0) {
    return (
      <p className="rounded-xl border border-gray-200 dark:border-zinc-800 px-4 py-8 text-center text-sm text-gray-500 dark:text-zinc-500">
        Nenhum churn registrado nas duas semanas.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-zinc-900">
            <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-zinc-200 min-w-[200px]">
              Motivo
            </th>
            <th className="px-3 py-3 text-right font-semibold text-gray-700 dark:text-zinc-200">MRR atual</th>
            <th className="px-3 py-3 text-right font-semibold text-gray-500 dark:text-zinc-400">MRR anterior</th>
            <th className="px-3 py-3 text-right font-semibold text-gray-700 dark:text-zinc-200">Δ MRR</th>
            <th className="px-3 py-3 text-right font-semibold text-gray-700 dark:text-zinc-200">Pontual atual</th>
            <th className="px-3 py-3 text-right font-semibold text-gray-500 dark:text-zinc-400">Pontual anterior</th>
          </tr>
        </thead>
        <tbody>
          {dados.motivos.map((m) => {
            const delta = calcularDelta(m.atual, m.anterior);
            const clicavel = onCelula !== undefined;
            return (
              <tr
                key={m.chave}
                className="border-t border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/40"
              >
                <td className="px-4 py-2 text-gray-700 dark:text-zinc-300">{m.chave}</td>
                <td
                  className={`px-3 py-2 text-right tabular-nums text-gray-900 dark:text-zinc-100 ${
                    clicavel ? "cursor-pointer hover:underline decoration-dotted" : ""
                  }`}
                  onClick={
                    clicavel
                      ? () =>
                          onCelula!({
                            metrica: "churnMotivo",
                            rotulo: `Churn MRR · ${m.chave}`,
                            inicio: dados.atual.inicio,
                            fim: dados.atual.fim,
                            chave: m.chave,
                            campo: "mrr",
                          })
                      : undefined
                  }
                >
                  {fmtBRL(m.atual)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-zinc-400">
                  {fmtBRL(m.anterior)}
                </td>
                {/* churn melhora caindo */}
                <CelulaDelta delta={delta} melhor="down" />
                <td
                  className={`px-3 py-2 text-right tabular-nums text-gray-900 dark:text-zinc-100 ${
                    clicavel ? "cursor-pointer hover:underline decoration-dotted" : ""
                  }`}
                  onClick={
                    clicavel
                      ? () =>
                          onCelula!({
                            metrica: "churnMotivo",
                            rotulo: `Churn Pontual · ${m.chave}`,
                            inicio: dados.atual.inicio,
                            fim: dados.atual.fim,
                            chave: m.chave,
                            campo: "pontual",
                          })
                      : undefined
                  }
                >
                  {fmtBRL(m.pontualAtual)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-zinc-400">
                  {fmtBRL(m.pontualAnterior)}
                </td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 font-semibold">
            <td className="px-4 py-2 text-gray-700 dark:text-zinc-200">Total</td>
            <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-zinc-100">
              {fmtBRL(totalMrrAtual)}
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-zinc-400">
              {fmtBRL(totalMrrAnterior)}
            </td>
            <td className="px-3 py-2" />
            <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-zinc-100">
              {fmtBRL(totalPontualAtual)}
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-zinc-400">
              {fmtBRL(totalPontualAnterior)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
