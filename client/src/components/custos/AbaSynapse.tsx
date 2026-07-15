import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrencyNoDecimals, formatCurrencyUSD } from "@/lib/utils";
import type { ResumoMes } from "./KpisCustos";

const PILAR_LABEL: Record<string, string> = { assinaturas: "Assinaturas", anthropic: "API Anthropic", gcp: "GCP", ferramentas: "Ferramentas" };

export function AbaSynapse({ mes, moeda }: { mes: string; moeda: "BRL" | "USD" }) {
  const { data } = useQuery<ResumoMes & { linhas: any[] }>({ queryKey: ["/api/custos/consolidado", { mes }] });
  const linhas = (data?.linhas || []).filter((l: any) => l.projeto === "Synapse");
  const totalBRL = linhas.reduce((s: number, l: any) => s + l.valorBRL, 0);
  const totalUSD = linhas.reduce((s: number, l: any) => s + l.valorUSD, 0);
  const total = moeda === "BRL" ? formatCurrencyNoDecimals(totalBRL) : formatCurrencyUSD(totalUSD);

  const porPilar: Record<string, { brl: number; usd: number }> = {};
  for (const l of linhas) {
    porPilar[l.pilar] = porPilar[l.pilar] || { brl: 0, usd: 0 };
    porPilar[l.pilar].brl += l.valorBRL;
    porPilar[l.pilar].usd += l.valorUSD;
  }

  return (
    <div className="space-y-4 py-4">
      <Card className="border-violet-300 dark:border-violet-800 dark:bg-zinc-900">
        <CardContent className="p-4">
          <div className="text-sm text-violet-600 dark:text-violet-400">Custo total do Synapse — {mes}</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{total}</div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(porPilar).map(([pilar, v]) => (
          <Card key={pilar} className="dark:bg-zinc-900 dark:border-zinc-800" data-testid={`synapse-pilar-${pilar}`}>
            <CardContent className="p-4">
              <div className="text-xs text-gray-500 dark:text-zinc-400">{PILAR_LABEL[pilar] || pilar}</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {moeda === "BRL" ? formatCurrencyNoDecimals(v.brl) : formatCurrencyUSD(v.usd)}
              </div>
            </CardContent>
          </Card>
        ))}
        {linhas.length === 0 && <div className="col-span-4 text-center text-gray-500 dark:text-zinc-400 py-8">Nada marcado como Synapse neste mês. Marque assinaturas/itens com projeto "Synapse" ou mapeie um projeto GCP.</div>}
      </div>
    </div>
  );
}
