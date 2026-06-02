import { useQuery } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { OverviewCards } from "@/components/estoque-pontual/OverviewCards";
import { EvolucaoEstoque } from "@/components/estoque-pontual/EvolucaoEstoque";
import { FluxoMensal } from "@/components/estoque-pontual/FluxoMensal";
import { DistribuicaoTabela } from "@/components/estoque-pontual/DistribuicaoTabela";
import { AgingChart } from "@/components/estoque-pontual/AgingChart";
import { ItensTable } from "@/components/estoque-pontual/ItensTable";
import { fetchJson } from "@/components/estoque-pontual/utils";
import type { EstoqueOverview, DistRow } from "@/components/estoque-pontual/types";

export default function EstoquePontual() {
  useSetPageInfo("Estoque de Pontual", "Gestão e diagnóstico do estoque de produtos pontuais");

  const { data: overview } = useQuery({
    queryKey: ["/api/estoque-pontual/overview"],
    queryFn: () => fetchJson<EstoqueOverview>("/api/estoque-pontual/overview"),
  });

  const { data: porProduto } = useQuery({
    queryKey: ["/api/estoque-pontual/por-produto"],
    queryFn: () =>
      fetchJson<{ produtos: { produto: string; qtd: number; valor: number; idadeMedia: number }[] }>(
        "/api/estoque-pontual/por-produto",
      ),
  });

  const { data: porSquad } = useQuery({
    queryKey: ["/api/estoque-pontual/por-squad"],
    queryFn: () =>
      fetchJson<{ squads: { squad: string; qtd: number; valor: number; idadeMedia: number }[] }>(
        "/api/estoque-pontual/por-squad",
      ),
  });

  const produtosRows: DistRow[] =
    porProduto?.produtos.map((p) => ({ chave: p.produto, qtd: p.qtd, valor: p.valor, idadeMedia: p.idadeMedia })) ?? [];
  const squadsRows: DistRow[] =
    porSquad?.squads.map((s) => ({ chave: s.squad, qtd: s.qtd, valor: s.valor, idadeMedia: s.idadeMedia })) ?? [];

  const produtosFiltro = produtosRows.map((r) => r.chave).filter((c) => c !== "(sem produto)");
  const squadsFiltro = squadsRows.map((r) => r.chave).filter((c) => c !== "(sem squad)");

  return (
    <div className="space-y-6 p-4 md:p-6">
      {!overview ? (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800/50" />
      ) : (
        <OverviewCards data={overview} />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <EvolucaoEstoque />
        <FluxoMensal />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DistribuicaoTabela titulo="Por produto" colChave="Produto" itens={produtosRows} />
        <DistribuicaoTabela titulo="Por squad" colChave="Squad" itens={squadsRows} />
      </div>

      <AgingChart />

      <ItensTable produtos={produtosFiltro} squads={squadsFiltro} />
    </div>
  );
}
