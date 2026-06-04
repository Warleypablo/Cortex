import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { OverviewCards } from "@/components/creators-pontual/OverviewCards";
import { EntradaSaida } from "@/components/creators-pontual/EntradaSaida";
import { EvolucaoCreators } from "@/components/creators-pontual/EvolucaoCreators";
import { FunilStatus } from "@/components/creators-pontual/FunilStatus";
import { ProdutividadeOperadores } from "@/components/creators-pontual/ProdutividadeOperadores";
import { VendasMensal } from "@/components/creators-pontual/VendasMensal";
import { ItensTable } from "@/components/creators-pontual/ItensTable";
import { fetchJson } from "@/components/creators-pontual/utils";
import type { CreatorsOverview, StatusRow, OperadorRow } from "@/components/creators-pontual/types";

export default function CreatorsPontual() {
  useSetPageInfo("Creators Pontual", "Aprofundamento no estoque de Creators: vendas, produtividade e diagnóstico");

  const { data: overview } = useQuery({
    queryKey: ["/api/creators-pontual/overview"],
    queryFn: () => fetchJson<CreatorsOverview>("/api/creators-pontual/overview"),
  });

  const { data: funil } = useQuery({
    queryKey: ["/api/creators-pontual/funil"],
    queryFn: () => fetchJson<{ status: StatusRow[] }>("/api/creators-pontual/funil"),
  });

  const { data: operadores } = useQuery({
    queryKey: ["/api/creators-pontual/operadores"],
    queryFn: () => fetchJson<{ operadores: OperadorRow[] }>("/api/creators-pontual/operadores"),
  });

  const statusList = funil?.status.map((s) => s.status) ?? [];
  const operadoresList = operadores?.operadores.map((o) => o.operador) ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      {!overview ? (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
      ) : (
        <OverviewCards data={overview} />
      )}

      <EntradaSaida />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <EvolucaoCreators />
        <VendasMensal />
      </div>

      <FunilStatus />

      <ProdutividadeOperadores />

      <ItensTable statusList={statusList} operadores={operadoresList} />
    </div>
  );
}
