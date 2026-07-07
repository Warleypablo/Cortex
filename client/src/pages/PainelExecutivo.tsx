import { useState } from "react";
import { LayoutDashboard } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mesDefault, mesesOptions } from "./painel-executivo/temporalidade";
import { SecaoVisaoGeral } from "./painel-executivo/SecaoVisaoGeral";
import { SecaoReceita } from "./painel-executivo/SecaoReceita";
import { SecaoChurn } from "./painel-executivo/SecaoChurn";

const ABAS = [
  { value: "visao-geral", label: "Visão Geral" },
  { value: "receita", label: "Receita" },
  { value: "churn", label: "Churn" },
  { value: "lt-ltv", label: "LT / LTV" },
  { value: "capacity", label: "Capacity" },
  { value: "entregas", label: "Entregas" },
  { value: "performance", label: "Performance" },
] as const;

export default function PainelExecutivo() {
  usePageTitle("Painel Executivo Mensal");
  useSetPageInfo("Painel Executivo Mensal", "Consolidado mensal auditável");
  const [mes, setMes] = useState<string>(mesDefault());
  const opcoes = mesesOptions();

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-6 w-6 text-teal-600 dark:text-teal-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Painel Executivo Mensal</h1>
            <p className="text-sm text-gray-500 dark:text-zinc-400">Consolidado auditável — clique nos números para o detalhe</p>
          </div>
        </div>
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {opcoes.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="visao-geral">
        <TabsList className="flex w-full flex-wrap justify-start gap-1">
          {ABAS.map((a) => <TabsTrigger key={a.value} value={a.value}>{a.label}</TabsTrigger>)}
        </TabsList>
        {ABAS.map((a) => (
          <TabsContent key={a.value} value={a.value} className="mt-4">
            {a.value === "visao-geral" ? (
              <SecaoVisaoGeral mes={mes} />
            ) : a.value === "receita" ? (
              <SecaoReceita mes={mes} />
            ) : a.value === "churn" ? (
              <SecaoChurn mes={mes} />
            ) : (
              <div className="text-sm text-gray-500 dark:text-zinc-400">Em construção: {a.label} — {mes}</div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
