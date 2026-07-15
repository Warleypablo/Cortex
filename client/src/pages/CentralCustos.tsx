import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KpisCustos, type ResumoMes } from "@/components/custos/KpisCustos";
import { EvolucaoCustos } from "@/components/custos/EvolucaoCustos";
import { AbaAssinaturas } from "@/components/custos/AbaAssinaturas";
import { AbaItens } from "@/components/custos/AbaItens";

function ultimosMeses(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

export default function CentralCustos() {
  const meses = ultimosMeses(12);
  const [mes, setMes] = useState(meses[0]);
  const [moeda, setMoeda] = useState<"BRL" | "USD">("BRL");
  const [tab, setTab] = useState("assinaturas");

  const { data: evolucao = [], isLoading } = useQuery<ResumoMes[]>({
    queryKey: ["/api/custos/evolucao", { ate: mes }],
  });

  const atual = evolucao.find((r) => r.mes === mes) || evolucao[evolucao.length - 1];
  const idx = evolucao.findIndex((r) => r.mes === mes);
  const anterior = idx > 0 ? evolucao[idx - 1] : undefined;

  return (
    <div className="min-h-full bg-gray-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Central de Custos de IA</h1>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden">
              {(["BRL", "USD"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMoeda(m)}
                  data-testid={`toggle-moeda-${m}`}
                  className={`px-3 py-1.5 text-sm ${moeda === m ? "bg-violet-600 text-white" : "bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-400"}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger className="w-36" data-testid="select-mes"><SelectValue /></SelectTrigger>
              <SelectContent>
                {meses.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading || !atual ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            <KpisCustos atual={atual} anterior={anterior} moeda={moeda} />
            {atual.cambioEstimado && (
              <div className="text-xs text-amber-600 dark:text-amber-400">
                ⚠ Câmbio do mês estimado (usando a última taxa conhecida: {atual.taxa.toFixed(2)}).
              </div>
            )}
            <Card className="dark:bg-zinc-900 dark:border-zinc-800">
              <CardContent className="p-4">
                <div className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-3">Evolução mensal</div>
                <EvolucaoCustos dados={evolucao} moeda={moeda} />
              </CardContent>
            </Card>
          </>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="assinaturas" data-testid="tab-assinaturas">Assinaturas</TabsTrigger>
            <TabsTrigger value="ferramentas" data-testid="tab-ferramentas">Ferramentas</TabsTrigger>
            <TabsTrigger value="gcp" data-testid="tab-gcp">GCP</TabsTrigger>
            <TabsTrigger value="anthropic" data-testid="tab-anthropic">API Anthropic</TabsTrigger>
            <TabsTrigger value="synapse" data-testid="tab-synapse">Synapse</TabsTrigger>
          </TabsList>
          <TabsContent value="assinaturas"><AbaAssinaturas moeda={moeda} /></TabsContent>
          <TabsContent value="ferramentas"><AbaItens moeda={moeda} /></TabsContent>
          <TabsContent value="gcp"><div className="p-6 text-gray-500 dark:text-zinc-400">Em breve.</div></TabsContent>
          <TabsContent value="anthropic"><div className="p-6 text-gray-500 dark:text-zinc-400">Em breve.</div></TabsContent>
          <TabsContent value="synapse"><div className="p-6 text-gray-500 dark:text-zinc-400">Em breve.</div></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
