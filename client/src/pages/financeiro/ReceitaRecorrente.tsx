import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type {
  ResumoReceitaResponse,
  Empresa,
} from "@shared/receitaRecorrenteTypes";

type RangeKey = "6m" | "12m" | "ytd";

function computeRange(key: RangeKey): { ini: string; fim: string } {
  const now = new Date();
  const fim = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  let ini: Date;
  if (key === "6m") {
    ini = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  } else if (key === "12m") {
    ini = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  } else {
    ini = new Date(now.getFullYear(), 0, 1);
  }
  return {
    ini: ini.toISOString().slice(0, 10),
    fim: fim.toISOString().slice(0, 10),
  };
}

export default function ReceitaRecorrente() {
  usePageTitle("Receita Recorrente");
  useSetPageInfo("Receita Recorrente", "MRR realizado por centro de custo (Conta Azul)");

  const [rangeKey, setRangeKey] = useState<RangeKey>("6m");
  const [empresa, setEmpresa] = useState<Empresa | "todas">("todas");

  const { ini, fim } = useMemo(() => computeRange(rangeKey), [rangeKey]);

  // queryKey[1] deve ser objeto (não string) para que o queryFn default
  // em client/src/lib/queryClient.ts construa a query string corretamente.
  const queryParams = useMemo(() => {
    const params: Record<string, string> = { data_ini: ini, data_fim: fim };
    if (empresa !== "todas") params.empresa = empresa;
    return params;
  }, [ini, fim, empresa]);

  const { data, isLoading, error, refetch } = useQuery<ResumoReceitaResponse>({
    queryKey: ["/api/financeiro/receita-recorrente/resumo", queryParams],
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Receita Recorrente
          </h1>
          <p className="text-sm text-gray-600 dark:text-zinc-400">
            MRR realizado por centro de custo (Conta Azul) vs contratado (ClickUp)
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={rangeKey} onValueChange={(v) => setRangeKey(v as RangeKey)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="6m">Últimos 6 meses</SelectItem>
              <SelectItem value="12m">Últimos 12 meses</SelectItem>
              <SelectItem value="ytd">Ano corrente (YTD)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={empresa} onValueChange={(v) => setEmpresa(v as Empresa | "todas")}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas empresas</SelectItem>
              <SelectItem value="TURBO PARTNERS">Turbo Partners</SelectItem>
              <SelectItem value="PEIXOTO DEBBANE">Peixoto Debbane</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950">
          <CardContent className="p-4 flex items-center justify-between">
            <span className="text-red-700 dark:text-red-300">
              Falha ao carregar dados de receita.
            </span>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => refetch()}
            >
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-[400px] w-full rounded-lg" />
          <Skeleton className="h-[300px] w-full rounded-lg" />
        </>
      )}

      {/* Content placeholder — subcomponents wired in Task 11 */}
      {data && (
        <div className="text-sm text-gray-500">
          Carregado: {data.meses.length} linhas × mês × empresa.
          Cards e gráficos nas próximas tasks.
        </div>
      )}
    </div>
  );
}
