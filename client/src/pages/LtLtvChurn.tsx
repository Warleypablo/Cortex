import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSetPageInfo } from "@/contexts/PageContext";
import { OverviewCards } from "@/components/lt-ltv-churn/OverviewCards";
import { BenchmarkProduto } from "@/components/lt-ltv-churn/BenchmarkProduto";
import { LtLtvPorProduto } from "@/components/lt-ltv-churn/LtLtvPorProduto";
import { ContratosTable } from "@/components/lt-ltv-churn/ContratosTable";
import { DistLtContratos } from "@/components/lt-ltv-churn/DistLtContratos";
import { CohortMatriz } from "@/components/lt-ltv-churn/CohortMatriz";
import { EvolucaoProduto } from "@/components/lt-ltv-churn/EvolucaoProduto";
import { fetchJson, buildUrl } from "@/components/lt-ltv-churn/utils";
import type { OverviewData, ProdutoBenchmark } from "@/components/lt-ltv-churn/types";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TabelaLtLtv } from "@/components/creators-modelo/TabelaLtLtv";
import { EvolucaoLtLtv } from "@/components/creators-modelo/EvolucaoLtLtv";
import type { RedesignPayload, Unidade, Agregador, Situacao } from "@/components/creators-modelo/types";

export default function LtLtvChurn() {
  useSetPageInfo("LTV por Contrato", "Lifetime e valor por contrato");
  const [produto, setProduto] = useState<string>("todos");
  // Filtros globais da sub-aba Creators (controlam a tabela e a evolução).
  const [unidade, setUnidade] = useState<Unidade>("cliente");
  const [agregador, setAgregador] = useState<Agregador>("media");
  const [estado, setEstado] = useState<Situacao>("ambos");
  const [periodo, setPeriodo] = useState<string>("tudo"); // "tudo" | "2026" | "2025"
  const [incluirUnicas, setIncluirUnicas] = useState(false); // incluir entrega única no LT/LTV
  const incluirUnicasParam = incluirUnicas ? "1" : undefined;

  const anoAtual = new Date().getFullYear();
  const anos = [anoAtual, anoAtual - 1].map(String);
  // Período = coorte por data de início do contrato (de/ate em 'YYYY-MM').
  const de = periodo === "tudo" ? undefined : `${periodo}-01`;
  const ate = periodo === "tudo" ? undefined : `${periodo}-12`;

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

  // Sub-aba "Creators: Recorrente × Pontual" — serviço de Creators.
  const { data: creators } = useQuery({
    queryKey: ["/api/creators-modelo", de, ate, incluirUnicasParam],
    queryFn: () => fetchJson<RedesignPayload>(buildUrl("/api/creators-modelo", { de, ate, incluirUnicas: incluirUnicasParam })),
  });

  const produtos = benchmark?.produtos.map((p) => p.produto).filter(Boolean) ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Tabs defaultValue="produtos" className="space-y-6">
        <TabsList>
          <TabsTrigger value="produtos">Por produto</TabsTrigger>
          <TabsTrigger value="creators">Creators: Recorrente × Pontual</TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="space-y-6">
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
              <EvolucaoProduto />
              <BenchmarkProduto produtos={benchmark.produtos} />
            </>
          )}
          <DistLtContratos produto={produtoParam} />
          <CohortMatriz produto={produtoParam} />
          <ContratosTable produto={produtoParam} />
        </TabsContent>

        <TabsContent value="creators" className="space-y-6">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Select value={unidade} onValueChange={(v) => setUnidade(v as Unidade)}>
              <SelectTrigger className="w-[150px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cliente">Por cliente</SelectItem>
                <SelectItem value="contrato">Por contrato</SelectItem>
              </SelectContent>
            </Select>
            <Select value={agregador} onValueChange={(v) => setAgregador(v as Agregador)}>
              <SelectTrigger className="w-[130px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="mediana">Mediana</SelectItem>
              </SelectContent>
            </Select>
            <Select value={estado} onValueChange={(v) => setEstado(v as Situacao)}>
              <SelectTrigger className="w-[150px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ambos">Todos</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="cancelado">Cancelados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-[160px] bg-white dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-700/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tudo">Todo o período</SelectItem>
                {anos.map((a) => (
                  <SelectItem key={a} value={a}>{a === String(anoAtual) ? `${a} (ano atual)` : a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 dark:border-zinc-700/50 dark:bg-zinc-900/50">
              <Switch id="incluir-unicas" checked={incluirUnicas} onCheckedChange={setIncluirUnicas} />
              <Label htmlFor="incluir-unicas" className="cursor-pointer text-sm text-gray-600 dark:text-zinc-300">
                Incluir entregas únicas
              </Label>
            </div>
          </div>
          {!creators ? (
            <div className="h-64 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
          ) : (
            <TabelaLtLtv data={creators} unidade={unidade} agregador={agregador} estado={estado} de={de} ate={ate} incluirUnicas={incluirUnicas} />
          )}
          <EvolucaoLtLtv unidade={unidade} agregador={agregador} estado={estado} de={de} ate={ate} incluirUnicas={incluirUnicas} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
