import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSetPageInfo } from "@/contexts/PageContext";
import { OverviewCards } from "@/components/lt-ltv-churn/OverviewCards";
import { BenchmarkProduto } from "@/components/lt-ltv-churn/BenchmarkProduto";
import { LtLtvPorProduto } from "@/components/lt-ltv-churn/LtLtvPorProduto";
import { ContratosTable } from "@/components/lt-ltv-churn/ContratosTable";
import { DistLtContratos } from "@/components/lt-ltv-churn/DistLtContratos";
import { fetchJson, buildUrl } from "@/components/lt-ltv-churn/utils";
import type { OverviewData, ProdutoBenchmark } from "@/components/lt-ltv-churn/types";

export default function LtLtvChurn() {
  useSetPageInfo("LTV por Contrato", "Lifetime e valor por contrato");
  const [produto, setProduto] = useState<string>("todos");

  const produtoParam = produto === "todos" ? undefined : produto;

  const { data: overview } = useQuery({
    queryKey: ["/api/lt-ltv-churn/overview", produto],
    queryFn: () =>
      fetchJson<OverviewData>(buildUrl("/api/lt-ltv-churn/overview", { produto: produtoParam })),
  });

  const { data: benchmark } = useQuery({
    queryKey: ["/api/lt-ltv-churn/benchmark"],
    queryFn: () =>
      fetchJson<{ produtos: ProdutoBenchmark[] }>("/api/lt-ltv-churn/benchmark"),
  });

  const produtos = benchmark?.produtos.map((p) => p.produto).filter(Boolean) ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-end">
        <Select value={produto} onValueChange={setProduto}>
          <SelectTrigger className="w-[200px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
            <SelectValue placeholder="Produto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os produtos</SelectItem>
            {produtos.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!overview ? (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
      ) : (
        <OverviewCards data={overview} />
      )}
      {!benchmark ? (
        <div className="h-64 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
      ) : (
        <>
          <LtLtvPorProduto produtos={benchmark.produtos} />
          <BenchmarkProduto produtos={benchmark.produtos} />
        </>
      )}
      <DistLtContratos produto={produtoParam} />
      <ContratosTable produto={produtoParam} />
    </div>
  );
}
