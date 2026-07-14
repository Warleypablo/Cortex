import { atingimentoTom, tomPorFaixa, formatCompacto, formatValor, type CeoUnidade, type CeoDirecao } from "./ceoFormat";

// Espelha CeoMatrizResponse do servidor (server/routes/ceoDashboard.matriz.helpers.ts).
export interface CeoMatrizCelula {
  mes: number;
  valor: number | null;
  meta: number | null;
  atingimentoPct: number | null;
}
export interface CeoMatrizLinha {
  key: string;
  tipo?: "secao" | "dado";
  label: string;
  unidade: CeoUnidade;
  direcao: CeoDirecao;
  semMeta: boolean;
  semCompacto?: boolean; // valor cheio (R$ 4.290) em vez de compacto (R$ 4K)
  faixasTom?: { ambar: number; vermelho: number };
  nota?: string;
  celulas: CeoMatrizCelula[];
}
export interface CeoMatrizResponse {
  ate: string;
  mesFechado: number; // colunas com mes > mesFechado são parciais (mês em andamento)
  meses: { mes: number; label: string }[];
  linhas: CeoMatrizLinha[];
}

const TOM_TEXTO: Record<string, string> = {
  verde: "text-emerald-600 dark:text-emerald-400",
  ambar: "text-amber-600 dark:text-amber-400",
  vermelho: "text-rose-600 dark:text-rose-400",
  neutro: "text-gray-900 dark:text-white",
};

// bg opaco na 1ª coluna (sticky) — precisa cobrir o conteúdo que rola por baixo.
const STICKY = "sticky left-0 z-10 bg-white dark:bg-zinc-900";

export function CeoMatrizTabela({
  data,
  onCelula,
}: {
  data: CeoMatrizResponse;
  onCelula: (kpi: string, mes: number, tom: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-2xl border border-gray-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-zinc-800">
              <th className={`${STICKY} px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500 dark:text-zinc-400`}>
                Indicador
              </th>
              {data.meses.map((m) => {
                const parcial = m.mes > data.mesFechado;
                return (
                  <th
                    key={m.mes}
                    title={parcial ? "Mês em andamento — valores parciais" : undefined}
                    className="min-w-[92px] px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500 dark:text-zinc-400"
                  >
                    {m.label}
                    {parcial && <span className="ml-0.5 font-normal normal-case text-amber-500" title="Mês em andamento">*</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.linhas.map((linha) => {
              if (linha.tipo === "secao") {
                return (
                  <tr key={linha.key} className="border-b border-gray-200 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-800/40">
                    <th
                      scope="colgroup"
                      colSpan={data.meses.length + 1}
                      className={`${STICKY} !bg-gray-50 dark:!bg-zinc-800/40 px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-zinc-400`}
                    >
                      {linha.label}
                    </th>
                  </tr>
                );
              }
              const emBreve = linha.key === "nps";
              return (
                <tr
                  key={linha.key}
                  className="group border-b border-gray-100 dark:border-zinc-800/60 last:border-0"
                >
                  <th
                    scope="row"
                    title={linha.nota}
                    className={`${STICKY} px-4 py-2.5 text-left font-medium text-gray-700 dark:text-zinc-300 whitespace-nowrap group-hover:bg-gray-50 dark:group-hover:bg-zinc-800/40`}
                  >
                    <span className="flex items-center gap-2">
                      {linha.label}
                      {emBreve && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-gray-500 dark:bg-zinc-800 dark:text-zinc-400">
                          Em breve
                        </span>
                      )}
                    </span>
                  </th>
                  {linha.celulas.map((cel) => {
                    const temValor = cel.valor !== null;
                    const tomKey = linha.faixasTom
                      ? tomPorFaixa(cel.valor, linha.faixasTom)
                      : linha.semMeta ? "neutro" : atingimentoTom(cel.atingimentoPct, linha.direcao);
                    const clicavel = temValor && !emBreve;
                    const corValor = linha.semMeta && !linha.faixasTom ? "text-gray-900 dark:text-white" : TOM_TEXTO[tomKey];
                    const title = temValor
                      ? `${formatValor(cel.valor, linha.unidade)}${cel.meta != null ? ` · meta ${formatValor(cel.meta, linha.unidade)}` : ""}`
                      : undefined;
                    return (
                      <td
                        key={cel.mes}
                        title={title}
                        onClick={clicavel ? () => onCelula(linha.key, cel.mes, tomKey) : undefined}
                        onKeyDown={
                          clicavel
                            ? (e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  onCelula(linha.key, cel.mes, tomKey);
                                }
                              }
                            : undefined
                        }
                        {...(clicavel ? { role: "button", tabIndex: 0 } : {})}
                        className={[
                          "px-3 py-2.5 text-right tabular-nums transition-colors group-hover:bg-gray-50 dark:group-hover:bg-zinc-800/40",
                          clicavel ? "cursor-pointer hover:!bg-gray-100 dark:hover:!bg-zinc-800" : "",
                        ].join(" ")}
                      >
                        {temValor ? (
                          <div className="flex flex-col items-end leading-tight">
                            <span className={`font-semibold ${corValor}`}>{(linha.semCompacto ? formatValor : formatCompacto)(cel.valor, linha.unidade)}</span>
                            {cel.atingimentoPct !== null && (
                              <span className="text-[10px] text-gray-400 dark:text-zinc-500">
                                {Math.round(cel.atingimentoPct)}% meta
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300 dark:text-zinc-700">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-1 text-[11px] text-gray-400 dark:text-zinc-500">
        Cor pela régua do BP (verde ≥100% · âmbar ≥80% · vermelho &lt;80%). <span className="text-amber-500">*</span> mês em
        andamento (parcial). Inadimplência por mês de vencimento; LTV FAT = faturável mediano dos ativos (ClickUp: Valor R × meses + pontual entregue);
        LTV DFC = caixa mediano (pago real no Conta Azul desde out/25 + faturável antes); E-NPS por onda de pesquisa (meses sem pesquisa ficam vazios). Clique numa célula para o detalhamento do mês.
        Movimento de Receita (MRR e Pontual): venda, churn e cross-sell/upsell; Churn % (MRR e Pontual) = churn ÷ base do fechamento anterior; verde &lt;7%, âmbar 7–9%, vermelho &gt;9%.
        NRR = erosão (churn − cross-sell) ÷ base, menor é melhor.
      </p>
    </div>
  );
}
