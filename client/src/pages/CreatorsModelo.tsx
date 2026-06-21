// client/src/pages/CreatorsModelo.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSetPageInfo } from "@/contexts/PageContext";
import { fetchJson, buildUrl } from "@/components/creators-modelo/utils";
import type { CreatorsModeloPayload, Unidade, Agregador, Situacao } from "@/components/creators-modelo/types";
import { AvisosMetodologicos } from "@/components/creators-modelo/AvisosMetodologicos";
import { HeadlineCards } from "@/components/creators-modelo/HeadlineCards";
import { TabelaLtLtv } from "@/components/creators-modelo/TabelaLtLtv";
import { FunilSobrevivencia } from "@/components/creators-modelo/FunilSobrevivencia";
import { CardRecompra } from "@/components/creators-modelo/CardRecompra";

function gerarMeses(): string[] {
  const hoje = new Date();
  const out: string[] = [];
  const d = new Date(2024, 0, 1);
  while (d <= hoje) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}
const MESES = gerarMeses();

export default function CreatorsModelo() {
  useSetPageInfo("Creators: Recorrente × Pontual", "Comparação de LT, LTV e churn dos dois modelos");
  const [unidade, setUnidade] = useState<Unidade>("cliente");
  const [agregador, setAgregador] = useState<Agregador>("media");
  const [situacao, setSituacao] = useState<Situacao>("ambos");
  const [de, setDe] = useState<string>("todos");
  const [ate, setAte] = useState<string>("todos");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/creators-modelo", de, ate],
    queryFn: () => fetchJson<CreatorsModeloPayload>(
      buildUrl("/api/creators-modelo", {
        de: de === "todos" ? undefined : de,
        ate: ate === "todos" ? undefined : ate,
      }),
    ),
  });

  const triggerCls = "w-[150px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50";

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Select value={unidade} onValueChange={(v) => setUnidade(v as Unidade)}>
          <SelectTrigger className={triggerCls}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cliente">Por cliente</SelectItem>
            <SelectItem value="contrato">Por contrato</SelectItem>
          </SelectContent>
        </Select>
        <Select value={agregador} onValueChange={(v) => setAgregador(v as Agregador)}>
          <SelectTrigger className={triggerCls}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="mediana">Mediana</SelectItem>
          </SelectContent>
        </Select>
        <Select value={situacao} onValueChange={(v) => setSituacao(v as Situacao)}>
          <SelectTrigger className={triggerCls}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ambos">Todas situações</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="cancelado">Cancelados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={de} onValueChange={setDe}>
          <SelectTrigger className={triggerCls}><SelectValue placeholder="De" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Início: tudo</SelectItem>
            {MESES.map((m) => <SelectItem key={m} value={m}>De {m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={ate} onValueChange={setAte}>
          <SelectTrigger className={triggerCls}><SelectValue placeholder="Até" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Até: tudo</SelectItem>
            {MESES.map((m) => <SelectItem key={m} value={m}>Até {m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading || !data ? (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
      ) : (
        <>
          <AvisosMetodologicos meta={data.meta} coorte={data.coorte} />
          <HeadlineCards data={data} unidade={unidade} agregador={agregador} />
          <TabelaLtLtv data={data} unidade={unidade} agregador={agregador} situacao={situacao} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2"><FunilSobrevivencia data={data} /></div>
            <CardRecompra recompra={data.recompra} />
          </div>
        </>
      )}
    </div>
  );
}
