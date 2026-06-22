import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GraficoEvolucaoProduto } from "./GraficoEvolucaoProduto";
import { TabelaEvolucaoProduto } from "./TabelaEvolucaoProduto";

export function EvolucaoProduto() {
  const [metrica, setMetrica] = useState<"lt" | "ltv">("lt");
  const [agregador, setAgregador] = useState<"media" | "mediana">("media");
  const labelAgregador = agregador === "media" ? "médio" : "mediano";

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Evolução de LT/LTV por produto</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={metrica} onValueChange={(v) => setMetrica(v as "lt" | "ltv")}>
              <SelectTrigger className="w-[170px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lt">LT {labelAgregador} (meses)</SelectItem>
                <SelectItem value="ltv">LTV {labelAgregador} (R$)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={agregador} onValueChange={(v) => setAgregador(v as "media" | "mediana")}>
              <SelectTrigger className="w-[120px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="mediana">Mediana</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="grafico">
          <TabsList className="mb-4">
            <TabsTrigger value="grafico">Gráfico</TabsTrigger>
            <TabsTrigger value="tabela">Tabela</TabsTrigger>
          </TabsList>
          <TabsContent value="grafico">
            <GraficoEvolucaoProduto metrica={metrica} agregador={agregador} />
          </TabsContent>
          <TabsContent value="tabela">
            <TabelaEvolucaoProduto metrica={metrica} agregador={agregador} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
