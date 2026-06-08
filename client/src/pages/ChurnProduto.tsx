import { useState } from "react";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, LineChart, Users } from "lucide-react";
import { ChurnProdutoMotivo } from "@/components/ChurnProdutoMotivo";
import { ChurnEvolucaoMensal } from "@/components/ChurnEvolucaoMensal";
import { ChurnEvolucaoSquad } from "@/components/ChurnEvolucaoSquad";

type ActiveTab = "produto-motivo" | "evolucao-mensal" | "evolucao-squad";

export default function ChurnProduto() {
  useSetPageInfo("Churn por Produto", "Análise de cancelamentos segmentada por produto");
  const [activeTab, setActiveTab] = useState<ActiveTab>("produto-motivo");

  return (
    <div className="space-y-6 p-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)}>
        <TabsList>
          <TabsTrigger value="produto-motivo" className="gap-2">
            <PieChart className="h-4 w-4" />
            Produto × Motivo
          </TabsTrigger>
          <TabsTrigger value="evolucao-mensal" className="gap-2">
            <LineChart className="h-4 w-4" />
            Evolução Mensal
          </TabsTrigger>
          <TabsTrigger value="evolucao-squad" className="gap-2">
            <Users className="h-4 w-4" />
            Evolução por Squad
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === "produto-motivo" && <ChurnProdutoMotivo />}
      {activeTab === "evolucao-mensal" && <ChurnEvolucaoMensal />}
      {activeTab === "evolucao-squad" && <ChurnEvolucaoSquad />}
    </div>
  );
}
