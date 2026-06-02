import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSetPageInfo } from "@/contexts/PageContext";
import { OverviewCards } from "@/components/lt-ltv-churn/OverviewCards";
import { BenchmarkProduto } from "@/components/lt-ltv-churn/BenchmarkProduto";
import { ChurnMensalChart } from "@/components/lt-ltv-churn/ChurnMensalChart";
import { TabContratosClientes } from "@/components/lt-ltv-churn/TabContratosClientes";
import type { OverviewData, ProdutoBenchmark, ChurnMensalPonto } from "@/components/lt-ltv-churn/types";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erro ao buscar ${url}`);
  return res.json();
}

function buildUrl(base: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") search.set(k, v);
  });
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}

export default function LtLtvChurn() {
  useSetPageInfo("LT, LTV & Churn", "Lifetime, valor e churn por contrato e cliente");
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">LT, LTV &amp; Churn</h1>
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

      {overview && <OverviewCards data={overview} />}
      {churn && <ChurnMensalChart serie={churn.serie} />}
      {benchmark && <BenchmarkProduto produtos={benchmark.produtos} />}
      <TabContratosClientes produto={produtoParam} />
    </div>
  );
}
