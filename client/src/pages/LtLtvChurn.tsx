import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSetPageInfo } from "@/contexts/PageContext";
import { OverviewCards } from "@/components/lt-ltv-churn/OverviewCards";
import { BenchmarkProduto } from "@/components/lt-ltv-churn/BenchmarkProduto";
import { ChurnMensalChart } from "@/components/lt-ltv-churn/ChurnMensalChart";
import { TabContratosClientes } from "@/components/lt-ltv-churn/TabContratosClientes";
import { fetchJson, buildUrl } from "@/components/lt-ltv-churn/utils";
import type { OverviewData, ProdutoBenchmark, ChurnMensalPonto } from "@/components/lt-ltv-churn/types";

export default function LtLtvChurn() {
  useSetPageInfo("LT, LTV & Churn", "Lifetime, valor e churn por contrato e cliente");
  const [produto, setProduto] = useState<string>("todos");
  const [granularidade, setGranularidade] = useState<"contrato" | "cliente">("contrato");
  const [situacao, setSituacao] = useState<"todos" | "ativo" | "cancelado">("todos");

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

  const { data: churn } = useQuery({
    queryKey: ["/api/lt-ltv-churn/churn-mensal", produto],
    queryFn: () =>
      fetchJson<{ serie: ChurnMensalPonto[] }>(
        buildUrl("/api/lt-ltv-churn/churn-mensal", { meses: "8", produto: produtoParam })
      ),
  });

  const produtos = benchmark?.produtos.map((p) => p.produto).filter(Boolean) ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Select
          value={granularidade}
          onValueChange={(v) => setGranularidade(v as "contrato" | "cliente")}
        >
          <SelectTrigger className="w-[150px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="contrato">Por contrato</SelectItem>
            <SelectItem value="cliente">Por cliente</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={situacao}
          onValueChange={(v) => setSituacao(v as "todos" | "ativo" | "cancelado")}
        >
          <SelectTrigger className="w-[170px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Ativos e cancelados</SelectItem>
            <SelectItem value="ativo">Apenas ativos</SelectItem>
            <SelectItem value="cancelado">Apenas cancelados</SelectItem>
          </SelectContent>
        </Select>
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
      {!churn ? (
        <div className="h-64 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
      ) : (
        <ChurnMensalChart serie={churn.serie} />
      )}
      {!benchmark ? (
        <div className="h-64 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
      ) : (
        <BenchmarkProduto produtos={benchmark.produtos} />
      )}
      <TabContratosClientes produto={produtoParam} granularidade={granularidade} situacao={situacao} />
    </div>
  );
}
