import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSetPageInfo } from "@/contexts/PageContext";
import { fetchJson, buildUrl } from "@/components/creators-modelo/utils";
import type { RedesignPayload, Unidade, Agregador, Situacao } from "@/components/creators-modelo/types";
import { PlacarDecisao } from "@/components/creators-modelo/PlacarDecisao";
import { MixReceitaTempo } from "@/components/creators-modelo/MixReceitaTempo";
import { LtvMaturidade } from "@/components/creators-modelo/LtvMaturidade";
import { Retencao } from "@/components/creators-modelo/Retencao";
import { LeituraRecomendada } from "@/components/creators-modelo/LeituraRecomendada";
import { TabelaLtLtv } from "@/components/creators-modelo/TabelaLtLtv";

function gerarMeses(): string[] {
  const hoje = new Date();
  const out: string[] = [];
  const d = new Date(2024, 0, 1);
  while (d <= hoje) { out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); d.setMonth(d.getMonth() + 1); }
  return out;
}
const MESES = gerarMeses();

export default function CreatorsModelo() {
  useSetPageInfo("Creators: Recorrente × Pontual", "Vale mais pontual ou recorrente?");
  const [de, setDe] = useState("todos");
  const [ate, setAte] = useState("todos");
  // Controles da aba "Tabela LT/LTV"
  const [unidade, setUnidade] = useState<Unidade>("cliente");
  const [agregador, setAgregador] = useState<Agregador>("media");
  const [situacao, setSituacao] = useState<Situacao>("ambos");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/creators-modelo", de, ate],
    queryFn: () => fetchJson<RedesignPayload>(buildUrl("/api/creators-modelo", {
      de: de === "todos" ? undefined : de, ate: ate === "todos" ? undefined : ate,
    })),
  });
  const trig = "w-[150px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50";

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Select value={de} onValueChange={setDe}>
          <SelectTrigger className={trig}><SelectValue placeholder="De" /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Início: tudo</SelectItem>{MESES.map((m) => <SelectItem key={m} value={m}>De {m}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={ate} onValueChange={setAte}>
          <SelectTrigger className={trig}><SelectValue placeholder="Até" /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Até: tudo</SelectItem>{MESES.map((m) => <SelectItem key={m} value={m}>Até {m}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {isLoading || !data ? (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
      ) : (
        <Tabs defaultValue="decisao" className="space-y-6">
          <TabsList>
            <TabsTrigger value="decisao">Decisão</TabsTrigger>
            <TabsTrigger value="tabela">Tabela LT/LTV</TabsTrigger>
          </TabsList>
          <TabsContent value="decisao" className="space-y-6">
            <PlacarDecisao data={data} />
            <MixReceitaTempo data={data} />
            <LtvMaturidade data={data} />
            <Retencao data={data} />
            <LeituraRecomendada data={data} />
          </TabsContent>
          <TabsContent value="tabela" className="space-y-4">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Select value={unidade} onValueChange={(v) => setUnidade(v as Unidade)}>
                <SelectTrigger className={trig}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">Por cliente</SelectItem>
                  <SelectItem value="contrato">Por contrato</SelectItem>
                </SelectContent>
              </Select>
              <Select value={agregador} onValueChange={(v) => setAgregador(v as Agregador)}>
                <SelectTrigger className={trig}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="mediana">Mediana</SelectItem>
                </SelectContent>
              </Select>
              <Select value={situacao} onValueChange={(v) => setSituacao(v as Situacao)}>
                <SelectTrigger className={trig}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ambos">Todas situações</SelectItem>
                  <SelectItem value="ativo">Ativos</SelectItem>
                  <SelectItem value="cancelado">Cancelados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <TabelaLtLtv data={data} unidade={unidade} agregador={agregador} situacao={situacao} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
