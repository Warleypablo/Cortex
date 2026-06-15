import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { Filtros } from "@/components/churn-pontorrente/Filtros";
import { OverviewCards } from "@/components/churn-pontorrente/OverviewCards";
import { InsightsChurn } from "@/components/churn-pontorrente/InsightsChurn";
import { ChurnPorMes } from "@/components/churn-pontorrente/ChurnPorMes";
import { ChurnPorEntrega } from "@/components/churn-pontorrente/ChurnPorEntrega";
import { ChurnPorDimensao } from "@/components/churn-pontorrente/ChurnPorDimensao";
import { DetalhamentoTable } from "@/components/churn-pontorrente/DetalhamentoTable";
import { fetchJson, buildUrl } from "@/components/churn-pontorrente/utils";
import type { ChurnPontorrentePayload, FiltrosState } from "@/components/churn-pontorrente/types";

export default function ChurnPontorrente() {
  useSetPageInfo("Churn Pontorrente", "Drop-off entre entregas dos contratos ponto-recorrentes");
  const [filtros, setFiltros] = useState<FiltrosState>({});

  const url = buildUrl("/api/churn-pontorrente", {
    produto: filtros.produto,
    squad: filtros.squad,
    responsavel: filtros.responsavel,
    de: filtros.de,
    ate: filtros.ate,
  });

  const { data, isLoading } = useQuery({
    queryKey: [url],
    queryFn: () => fetchJson<ChurnPontorrentePayload>(url),
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Filtros value={filtros} onChange={setFiltros} opcoes={data?.filtrosDisponiveis} />
      {isLoading || !data ? (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
      ) : (
        <>
          <InsightsChurn jornadas={data.jornadas} />
          <OverviewCards data={data.overview} />
          <ChurnPorMes jornadas={data.jornadas} />
          <ChurnPorEntrega jornadas={data.jornadas} />
          <ChurnPorDimensao jornadas={data.jornadas} />
          <DetalhamentoTable rows={data.detalhamento} />
        </>
      )}
    </div>
  );
}
