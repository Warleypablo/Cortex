import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSetPageInfo } from "@/contexts/PageContext";
import { OverviewClientesCards } from "@/components/lt-ltv-churn/OverviewClientesCards";
import { ClientesTable } from "@/components/lt-ltv-churn/ClientesTable";
import { DistClientesCharts } from "@/components/lt-ltv-churn/DistClientesCharts";
import { fetchJson, buildUrl } from "@/components/lt-ltv-churn/utils";
import type { OverviewClientesData, ProdutoBenchmark } from "@/components/lt-ltv-churn/types";

export default function LtvClientes() {
  useSetPageInfo("LTV por Cliente", "Lifetime value e retenção por cliente");
  const [produto, setProduto] = useState<string>("todos");
  const [situacao, setSituacao] = useState<"todos" | "ativo" | "cancelado">("todos");

  const produtoParam = produto === "todos" ? undefined : produto;
  const statusParam = situacao === "todos" ? undefined : situacao;

  const { data: overview } = useQuery({
    queryKey: ["/api/lt-ltv-churn/overview-clientes", produto, situacao],
    queryFn: () =>
      fetchJson<OverviewClientesData>(
        buildUrl("/api/lt-ltv-churn/overview-clientes", { produto: produtoParam, status: statusParam })
      ),
  });

  const { data: benchmark } = useQuery({
    queryKey: ["/api/lt-ltv-churn/benchmark"],
    queryFn: () =>
      fetchJson<{ produtos: ProdutoBenchmark[] }>("/api/lt-ltv-churn/benchmark"),
  });

  const produtos = benchmark?.produtos.map((p) => p.produto).filter(Boolean) ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-end gap-2">
        <Select value={situacao} onValueChange={(v) => setSituacao(v as "todos" | "ativo" | "cancelado")}>
          <SelectTrigger className="w-[200px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
            <SelectValue placeholder="Situação" />
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
        <OverviewClientesCards data={overview} />
      )}
      <DistClientesCharts produto={produtoParam} status={statusParam} />
      <ClientesTable produto={produtoParam} status={statusParam} />
    </div>
  );
}
