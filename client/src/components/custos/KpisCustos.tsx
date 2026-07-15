import { Card, CardContent } from "@/components/ui/card";
import { formatCurrencyNoDecimals, formatCurrencyUSD } from "@/lib/utils";

export interface ResumoMes {
  mes: string;
  totalBRL: number;
  totalUSD: number;
  porPilar: Record<string, number>;
  porProjeto: Record<string, number>;
  porFornecedor: Record<string, number>;
  taxa: number;
  cambioEstimado: boolean;
}

const PILAR_LABEL: Record<string, string> = {
  assinaturas: "Assinaturas", anthropic: "API Anthropic", gcp: "GCP", ferramentas: "Ferramentas",
};

function fmt(brl: number, moeda: "BRL" | "USD", totalBRL: number, totalUSD: number) {
  // usa proporção BRL para estimar o valor em USD de um subtotal quando só temos BRL
  if (moeda === "USD") return formatCurrencyUSD(totalBRL ? (brl / totalBRL) * totalUSD : 0);
  return formatCurrencyNoDecimals(brl);
}

export function KpisCustos({ atual, anterior, moeda }: { atual: ResumoMes; anterior?: ResumoMes; moeda: "BRL" | "USD" }) {
  const totalAtual = moeda === "BRL" ? atual.totalBRL : atual.totalUSD;
  const totalAnt = anterior ? (moeda === "BRL" ? anterior.totalBRL : anterior.totalUSD) : 0;
  const variacao = totalAnt ? ((totalAtual - totalAnt) / totalAnt) * 100 : 0;
  const synapseBRL = atual.porProjeto?.Synapse || 0;
  const pctSynapse = atual.totalBRL ? (synapseBRL / atual.totalBRL) * 100 : 0;
  const fmtTotal = moeda === "BRL" ? formatCurrencyNoDecimals : formatCurrencyUSD;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="dark:bg-zinc-900 dark:border-zinc-800" data-testid="kpi-total">
        <CardContent className="p-4">
          <div className="text-sm text-gray-500 dark:text-zinc-400">Total do mês</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{fmtTotal(totalAtual)}</div>
          {anterior && (
            <div className={`text-xs mt-1 ${variacao > 0 ? "text-red-500" : "text-emerald-500"}`}>
              {variacao > 0 ? "▲" : "▼"} {Math.abs(variacao).toFixed(1)}% vs. mês anterior
            </div>
          )}
        </CardContent>
      </Card>
      {(["assinaturas", "anthropic", "gcp", "ferramentas"] as const).map((p) => (
        <Card key={p} className="dark:bg-zinc-900 dark:border-zinc-800" data-testid={`kpi-${p}`}>
          <CardContent className="p-4">
            <div className="text-sm text-gray-500 dark:text-zinc-400">{PILAR_LABEL[p]}</div>
            <div className="text-xl font-semibold text-gray-900 dark:text-white">
              {fmt(atual.porPilar?.[p] || 0, moeda, atual.totalBRL, atual.totalUSD)}
            </div>
          </CardContent>
        </Card>
      ))}
      <Card className="sm:col-span-2 lg:col-span-1 border-violet-300 dark:border-violet-800 dark:bg-zinc-900" data-testid="kpi-synapse">
        <CardContent className="p-4">
          <div className="text-sm text-violet-600 dark:text-violet-400">Synapse</div>
          <div className="text-xl font-semibold text-gray-900 dark:text-white">
            {fmt(synapseBRL, moeda, atual.totalBRL, atual.totalUSD)}
          </div>
          <div className="text-xs text-gray-500 dark:text-zinc-400 mt-1">{pctSynapse.toFixed(0)}% do total</div>
        </CardContent>
      </Card>
    </div>
  );
}
